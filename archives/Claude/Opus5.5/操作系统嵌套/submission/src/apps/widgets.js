// 小组件面板：时钟与日历、倒计时与秒表、便笺、剪贴板历史、通知中心、快捷设置
import { h, clear, icon } from '../ui/dom.js';
import { ACCENTS, WALLPAPERS, SCALES } from '../ui/desktop.js';

// 计时状态属于根系统（关闭面板后仍在运行）
const T = { timer: { total: 0, left: 0, running: false, endAt: 0 }, sw: { running: false, start: 0, acc: 0, laps: [] } };
let tickerStarted = false;
function startTicker(desktop) {
  if (tickerStarted) return; tickerStarted = true;
  setInterval(() => {
    const t = T.timer;
    if (t.running) {
      t.left = Math.max(0, t.endAt - Date.now());
      if (t.left <= 0) { t.running = false; t.left = 0; desktop.notify({ title: '倒计时结束', body: `${fmtDur(t.total)} 的倒计时已到`, level: 'ok', source: 'timer' }); }
    }
    desktop.emit('widget-tick');
  }, 200);
}
function fmtDur(ms) { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function fmtSw(ms) { const cs = Math.floor(ms / 10); return `${String(Math.floor(cs / 6000)).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; }

export default {
  id: 'widgets', name: '小组件', icon: 'widgets', single: true, w: 860, h: 600, keywords: 'widgets 时钟 日历 倒计时 秒表 便笺 剪贴板 通知',
  create(ctx) {
    const { desktop, fs, win } = ctx;
    startTicker(desktop);
    const ds = { 'data-system-id': 'outer', 'data-window-id': win.id };
    let calMonth = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
    const card = (title, ic, ...kids) => h('div', { class: 'wg-card' }, h('div', { class: 'wg-title', html: icon(ic) }, h('span', { text: title })), ...kids);
    // 时钟与日历
    const clockBig = h('div', { class: 'wg-clock' }); const dateEl = h('div', { class: 'wg-date' });
    const calHead = h('div', { class: 'wg-cal-head' }); const calGrid = h('div', { class: 'wg-cal' });
    const prev = h('button', { class: 'btn icon', html: icon('back'), tid: 'widget-cal-prev', ...ds, 'aria-label': '上个月' });
    const next = h('button', { class: 'btn icon', html: icon('forward'), tid: 'widget-cal-next', ...ds, 'aria-label': '下个月' });
    const calTitle = h('b', { tid: 'widget-cal-title', ...ds });
    prev.onclick = () => { calMonth.m--; if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; } renderCal(); };
    next.onclick = () => { calMonth.m++; if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; } renderCal(); };
    calHead.append(prev, calTitle, next);
    function renderCal() {
      calTitle.textContent = `${calMonth.y} 年 ${calMonth.m + 1} 月`;
      clear(calGrid);
      for (const d of ['一', '二', '三', '四', '五', '六', '日']) calGrid.append(h('div', { class: 'wg-cal-w', text: d }));
      const first = new Date(calMonth.y, calMonth.m, 1); const off = (first.getDay() + 6) % 7;
      const days = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
      const today = new Date();
      for (let i = 0; i < off; i++) calGrid.append(h('div'));
      for (let d = 1; d <= days; d++) {
        const isToday = today.getFullYear() === calMonth.y && today.getMonth() === calMonth.m && today.getDate() === d;
        calGrid.append(h('div', { class: 'wg-cal-d' + (isToday ? ' today' : ''), text: String(d) }));
      }
    }
    // 倒计时
    const tin = h('input', { class: 'inp', type: 'number', min: '1', value: '60', tid: 'widget-timer-input', ...ds, 'aria-label': '倒计时秒数', style: { width: '90px' } });
    const tdisp = h('div', { class: 'wg-big', tid: 'widget-timer-display', ...ds });
    const tstart = h('button', { class: 'btn primary', html: icon('play'), tid: 'widget-timer-start', ...ds, 'aria-label': '开始倒计时' }, '开始');
    const tpause = h('button', { class: 'btn', html: icon('pause'), tid: 'widget-timer-pause', ...ds, 'aria-label': '暂停倒计时' }, '暂停');
    const treset = h('button', { class: 'btn', html: icon('restart'), tid: 'widget-timer-reset', ...ds, 'aria-label': '重置倒计时' }, '重置');
    tstart.onclick = () => {
      const t = T.timer;
      if (!t.running) {
        if (t.left <= 0) { const s = Math.max(1, Math.floor(Number(tin.value) || 0)); t.total = s * 1000; t.left = t.total; }
        t.endAt = Date.now() + t.left; t.running = true;
      }
      paint();
    };
    tpause.onclick = () => { const t = T.timer; if (t.running) { t.left = Math.max(0, t.endAt - Date.now()); t.running = false; } paint(); };
    treset.onclick = () => { T.timer = { total: 0, left: 0, running: false, endAt: 0 }; paint(); };
    tin.addEventListener('keydown', (e) => { if (e.key === 'Enter') tstart.onclick(); });
    // 秒表
    const swd = h('div', { class: 'wg-big', tid: 'widget-stopwatch-display', ...ds });
    const swStart = h('button', { class: 'btn primary', tid: 'widget-stopwatch-start', ...ds, 'aria-label': '秒表开始/暂停' });
    const swLap = h('button', { class: 'btn', text: '计次', tid: 'widget-stopwatch-lap', ...ds });
    const swReset = h('button', { class: 'btn', text: '重置', tid: 'widget-stopwatch-reset', ...ds });
    const laps = h('div', { class: 'wg-laps' });
    const swNow = () => T.sw.acc + (T.sw.running ? Date.now() - T.sw.start : 0);
    swStart.onclick = () => { const s = T.sw; if (s.running) { s.acc += Date.now() - s.start; s.running = false; } else { s.start = Date.now(); s.running = true; } paint(); };
    swLap.onclick = () => { T.sw.laps.unshift(swNow()); paint(); };
    swReset.onclick = () => { T.sw = { running: false, start: 0, acc: 0, laps: [] }; paint(); };
    // 便笺
    const note = h('textarea', { class: 'wg-note', tid: 'widget-note-text', ...ds, 'aria-label': '便笺', placeholder: '写点什么…' });
    note.value = fs.read('/Documents/便笺.txt') || '';
    const noteState = h('span', { class: 'muted', style: { fontSize: '11px' } });
    const noteSave = h('button', { class: 'btn', html: icon('save'), tid: 'widget-note-save', ...ds, 'aria-label': '保存便笺' }, '保存');
    const saveNote = () => { fs.write('/Documents/便笺.txt', note.value); noteState.textContent = '已保存到 /Documents/便笺.txt'; };
    noteSave.onclick = saveNote;
    let nt = 0; note.addEventListener('input', () => { noteState.textContent = '未保存…'; clearTimeout(nt); nt = setTimeout(saveNote, 1500); });
    note.addEventListener('keydown', (e) => e.stopPropagation());
    // 剪贴板历史
    const clipList = h('div', { class: 'wg-list scroll', tid: 'widget-clipboard-list', ...ds, 'aria-label': '剪贴板历史' });
    function renderClip() {
      clear(clipList);
      if (!desktop.clipboard.length) clipList.append(h('div', { class: 'muted', text: '复制的文本与表格选区会出现在这里' }));
      for (const c of desktop.clipboard) {
        const it = h('div', { class: 'wg-clip', tid: 'widget-clipboard-item', title: '点击再次复制' }, h('small', { text: `${c.type === 'range' ? '表格选区 ' + (c.range || '') : c.type === 'files' ? '文件' : '文本'} · ${c.source || ''} · ${new Date(c.time).toLocaleTimeString()}` }), h('pre', { text: c.text.length > 200 ? c.text.slice(0, 200) + '…' : c.text }));
        it.onclick = () => { navigator.clipboard.writeText(c.text).catch(() => {}); desktop.notify({ title: '已再次复制', body: c.text.slice(0, 40), level: 'ok' }); };
        clipList.append(it);
      }
    }
    // 通知中心
    const notifList = h('div', { class: 'wg-list scroll', tid: 'widget-notifications', ...ds, 'aria-label': '通知中心' });
    const dnd = h('input', { type: 'checkbox', tid: 'widget-dnd', ...ds, 'aria-label': '免打扰' });
    dnd.onchange = () => desktop.setSetting('dnd', dnd.checked);
    function renderNotifs() {
      clear(notifList);
      dnd.checked = !!desktop.settings.dnd;
      if (!desktop.notifications.length) notifList.append(h('div', { class: 'muted', text: '暂无通知' }));
      for (const n of desktop.notifications.slice(0, 50)) notifList.append(h('div', { class: 'wg-notif ' + n.level, html: icon(n.level === 'error' ? 'error' : n.source === 'timer' ? 'timer' : n.level === 'ok' ? 'ok' : 'info') }, h('div', {}, h('b', { text: n.title }), h('p', { text: n.body }), h('small', { text: new Date(n.time).toLocaleTimeString() + ' · ' + ({ timer: '倒计时', files: '文件操作', spreadsheet: '电子表格' }[n.source] || '系统') }))));
    }
    // 快捷设置（与“设置”应用同一份状态）
    const quick = h('div', { class: 'wg-quick' });
    function renderQuick() {
      clear(quick);
      const s = desktop.settings;
      const acc = h('div', { class: 'wg-q-row' }, ACCENTS.map((a) => { const b = h('button', { class: 'st-acc mini' + (s.accent === a.id ? ' on' : ''), title: a.name, 'aria-label': '强调色 ' + a.name, tid: 'quick-accent', 'data-value': a.id, ...ds, style: { '--sw': a.c } }, h('i')); b.onclick = () => desktop.setSetting('accent', a.id); return b; }));
      const wp = h('select', { class: 'inp', tid: 'quick-wallpaper', ...ds, 'aria-label': '壁纸' }, WALLPAPERS.map((w) => h('option', { value: w.id, text: w.name })));
      wp.value = s.wallpaper; wp.onchange = () => desktop.setSetting('wallpaper', wp.value);
      const sc = h('select', { class: 'inp', tid: 'quick-scale', ...ds, 'aria-label': '界面缩放' }, SCALES.map((v) => h('option', { value: String(v), text: v + '%' })));
      sc.value = String(s.scale); sc.onchange = () => desktop.setSetting('scale', Number(sc.value));
      const qd = h('button', { class: 'btn' + (s.dnd ? ' primary' : ''), html: icon('dnd'), tid: 'quick-dnd', ...ds }, s.dnd ? '免打扰：开' : '免打扰：关');
      qd.onclick = () => desktop.setSetting('dnd', !s.dnd);
      quick.append(h('div', { class: 'wg-q-label', text: '强调色' }), acc, h('div', { class: 'wg-q-row' }, h('span', { class: 'wg-q-label', text: '壁纸' }), wp, h('span', { class: 'wg-q-label', text: '缩放' }), sc), qd);
    }
    function paint() {
      const d = new Date();
      clockBig.textContent = d.toLocaleTimeString('zh-CN', { hour12: false });
      dateEl.textContent = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      const t = T.timer;
      tdisp.textContent = t.total || t.running ? fmtDur(t.left) : '--:--';
      tdisp.classList.toggle('run', t.running);
      tstart.lastChild.textContent = t.running ? '计时中' : (t.left > 0 ? '继续' : '开始');
      swd.textContent = fmtSw(swNow());
      swStart.textContent = T.sw.running ? '暂停' : '开始';
      clear(laps); T.sw.laps.slice(0, 5).forEach((l, i) => laps.append(h('div', { text: `#${T.sw.laps.length - i}  ${fmtSw(l)}` })));
    }
    const grid = h('div', { class: 'wg-grid scroll', tid: 'widgets-panel', ...ds },
      card('时钟与日历', 'calendar', clockBig, dateEl, calHead, calGrid),
      card('倒计时', 'timer', h('div', { class: 'wg-row' }, tin, h('span', { class: 'muted', text: '秒' })), tdisp, h('div', { class: 'wg-row' }, tstart, tpause, treset)),
      card('秒表', 'clock', swd, h('div', { class: 'wg-row' }, swStart, swLap, swReset), laps),
      card('便笺', 'note', note, h('div', { class: 'wg-row' }, noteSave, noteState)),
      card('剪贴板历史', 'clipboard', clipList),
      card('通知中心', 'bell', h('label', { class: 'wg-row' }, dnd, h('span', { text: '免打扰' })), notifList),
      card('快捷设置', 'settings', quick));
    const el = h('div', { class: 'widgets' }, grid);
    renderCal(); renderClip(); renderNotifs(); renderQuick(); paint();
    const offs = [desktop.on('widget-tick', paint), desktop.on('clipboard', renderClip), desktop.on('notifications', renderNotifs), desktop.on('settings', () => { renderQuick(); renderNotifs(); })];
    return {
      el,
      onArgs() {},
      dispose() { offs.forEach((f) => f()); },
    };
  },
};
