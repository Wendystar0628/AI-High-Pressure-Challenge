// 桌面小组件面板：时钟日历、倒计时、秒表、便笺、剪贴板历史、通知中心、快捷设置
import { el, fmtClock, fmtNum, clamp, pathBase } from '../../util.js';
import { ui as glyph, appIcon, iconSvg } from '../../icons.js';
import { ACCENTS, WALLPAPERS } from '../../wallpapers.js';
import { changed } from '../../store.js';
import { toast } from '../common.js';

export function createWidgetsPanel(view) {
  const sys = view.sys;
  const wg = sys.widgets;
  wg.clipboard = wg.clipboard || [];
  wg.notes = wg.notes || [];
  wg.timer = wg.timer || { duration: 300, remaining: 300, running: false, endAt: null };
  wg.stopwatch = wg.stopwatch || { running: false, startedAt: null, elapsed: 0, laps: [] };
  let selectedNote = null;
  let isOpen = false;

  const panel = el('div', { class: 'widgets-panel', role: 'dialog', 'aria-label': '桌面小组件' });
  const head = el('div', { class: 'wg-head' },
    el('span', { class: 't', text: '桌面小组件' }),
    el('span', { class: 'pill info', text: '数据属于根系统' }),
    el('span', { class: 'spacer' }),
    el('button', { class: 'iconbtn', title: '关闭', 'aria-label': '关闭小组件', html: glyph('close', 14), onclick: () => api.close() })
  );
  const scroll = el('div', { class: 'wg-scroll' });
  panel.append(head, scroll);

  // ---- 时钟 ----
  const clockTime = el('div', { class: 'clockbig', text: '00:00' });
  const clockDate = el('div', { class: 'clockdate' });
  const clockCard = el('div', { class: 'wg-card' }, el('h5', {}, glyph('clock', 14), el('span', { text: '时钟' })),
    clockTime, clockDate);

  // ---- 日历 ----
  const calHead = el('div', { class: 'cal-head' });
  const calGrid = el('div', { class: 'cal-grid' });
  const calTitle = el('span');
  const btnPrev = el('button', { class: 'iconbtn', title: '上个月', 'aria-label': '上个月', html: glyph('chevronL', 13) });
  const btnNext = el('button', { class: 'iconbtn', title: '下个月', 'aria-label': '下个月', html: glyph('chevronR', 13) });
  const btnToday = el('button', { class: 'btn sm ghost', text: '今天' });
  calHead.append(btnPrev, calTitle, btnNext, el('span', { class: 'spacer', style: { flex: 1 } }), btnToday);
  const calCard = el('div', { class: 'wg-card' }, el('h5', {}, glyph('grid', 14), el('span', { text: '日历' })), calHead, calGrid);
  btnPrev.addEventListener('click', () => { wg.calendar.offset--; renderCalendar(); });
  btnNext.addEventListener('click', () => { wg.calendar.offset++; renderCalendar(); });
  btnToday.addEventListener('click', () => { wg.calendar.offset = 0; wg.calendar.selected = null; renderCalendar(); });

  function today() {
    return new Date((view.ui.model.bootEpoch || Date.now()) + sys.clock * 1000);
  }
  function renderCalendar() {
    const base = today();
    const first = new Date(base.getFullYear(), base.getMonth() + (wg.calendar.offset || 0), 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    calTitle.textContent = `${first.getFullYear()} 年 ${first.getMonth() + 1} 月`;
    calGrid.innerHTML = '';
    for (const d of ['日', '一', '二', '三', '四', '五', '六']) calGrid.append(el('div', { class: 'dow', text: d }));
    for (let i = 0; i < startDow; i++) calGrid.append(el('div', { class: 'cal-day other', text: '' }));
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === base.getDate() && first.getMonth() === base.getMonth() && first.getFullYear() === base.getFullYear() && !wg.calendar.offset;
      const isSel = wg.calendar.selected === d && wg.calendar.offset === 0;
      const cell = el('div', { class: 'cal-day' + (isToday ? ' today' : '') + (isSel ? ' sel' : ''), text: String(d) });
      cell.addEventListener('click', () => { wg.calendar.offset = 0; wg.calendar.selected = d; renderCalendar(); });
      calGrid.append(cell);
    }
    while (calGrid.children.length < 7 + ((startDow + daysInMonth + 6) / 7 | 0) * 7) calGrid.append(el('div', { class: 'cal-day other', text: '' }));
  }

  // ---- 倒计时 ----
  const timerDisplay = el('div', { class: 'timer-display', text: '05:00' });
  const timerInput = el('input', { class: 'tin', type: 'number', min: '1', max: '86399', value: String(wg.timer.duration || 300), dataset: { testid: 'widget-timer-input' }, 'aria-label': '倒计时秒数' });
  const btnTStart = el('button', { class: 'btn sm primary', dataset: { testid: 'widget-timer-start' }, text: '开始' });
  const btnTPause = el('button', { class: 'btn sm', dataset: { testid: 'widget-timer-pause' }, text: '暂停' });
  const btnTReset = el('button', { class: 'btn sm ghost', dataset: { testid: 'widget-timer-reset' }, text: '重置' });
  const timerRing = el('div', { class: 'timer-ring' }, el('i'));
  btnTStart.addEventListener('click', () => {
    const v = Math.max(1, Math.min(86400, Math.floor(Number(timerInput.value) || 300)));
    wg.timer.duration = v;
    if (!wg.timer.running) {
      if (!wg.timer.remaining || wg.timer.remaining <= 0 || wg.timer.remaining > v) wg.timer.remaining = v;
      wg.timer.endAt = sys.clock + wg.timer.remaining;
      wg.timer.running = true;
      wg.timer.lastStarted = Date.now();
      changed('timer-start'); view.ui.refresh('timer');
    }
  });
  btnTPause.addEventListener('click', () => {
    if (wg.timer.running) { wg.timer.remaining = Math.max(0, (wg.timer.endAt || 0) - sys.clock); wg.timer.running = false; wg.timer.endAt = null; }
    else { wg.timer.endAt = sys.clock + (wg.timer.remaining || wg.timer.duration); wg.timer.running = true; }
    changed('timer');
  });
  btnTReset.addEventListener('click', () => {
    wg.timer.running = false; wg.timer.endAt = null;
    wg.timer.duration = Math.max(1, Math.floor(Number(timerInput.value) || wg.timer.duration || 300));
    wg.timer.remaining = wg.timer.duration;
    changed('timer'); updateTimer();
  });
  timerInput.addEventListener('change', () => { wg.timer.duration = Math.max(1, Math.floor(Number(timerInput.value) || 300)); wg.timer.remaining = Math.min(wg.timer.remaining || wg.timer.duration, wg.timer.duration); });
  const timerCard = el('div', { class: 'wg-card' }, el('h5', {}, glyph('timer', 14), el('span', { text: '倒计时' })),
    timerDisplay, timerRing, el('div', { class: 'wg-row' }, timerInput, btnTStart, btnTPause, btnTReset));

  // ---- 秒表 ----
  const swDisplay = el('div', { class: 'timer-display', text: '00:00.0' });
  const swLaps = el('div', { class: 'clip-list', style: { maxHeight: '74px' } });
  const btnSwStart = el('button', { class: 'btn sm primary', text: '开始' });
  const btnSwPause = el('button', { class: 'btn sm', text: '暂停' });
  const btnSwReset = el('button', { class: 'btn sm ghost', text: '复位' });
  const btnSwLap = el('button', { class: 'btn sm ghost', text: '分段' });
  function swElapsed() { return (wg.stopwatch.elapsed || 0) + (wg.stopwatch.running ? Math.max(0, sys.clock - (wg.stopwatch.startedAt || sys.clock)) : 0); }
  btnSwStart.addEventListener('click', () => { if (!wg.stopwatch.running) { wg.stopwatch.running = true; wg.stopwatch.startedAt = sys.clock; changed('stopwatch'); } });
  btnSwPause.addEventListener('click', () => { if (wg.stopwatch.running) { wg.stopwatch.elapsed = swElapsed(); wg.stopwatch.running = false; changed('stopwatch'); } });
  btnSwReset.addEventListener('click', () => { wg.stopwatch = { running: false, startedAt: null, elapsed: 0, laps: [] }; changed('stopwatch'); renderLaps(); });
  btnSwLap.addEventListener('click', () => { if (wg.stopwatch.running) { wg.stopwatch.laps.unshift(swElapsed()); changed('stopwatch'); renderLaps(); } });
  function renderLaps() {
    swLaps.innerHTML = '';
    const laps = wg.stopwatch.laps || [];
    if (!laps.length) swLaps.append(el('div', { class: 'dim', style: { fontSize: '10px' }, text: '暂无分段' }));
    laps.slice(0, 6).forEach((t, i) => swLaps.append(el('div', { class: 'clip-item' }, el('span', { class: 'ct', text: `分段 ${laps.length - i}` }), el('span', { text: fmtClock(t) }))));
  }
  const stopwatchCard = el('div', { class: 'wg-card' }, el('h5', {}, glyph('speed', 14), el('span', { text: '秒表' })),
    swDisplay, swLaps, el('div', { class: 'wg-row' }, btnSwStart, btnSwPause, btnSwLap, btnSwReset));

  // ---- 便笺 ----
  const noteList = el('div', { class: 'note-list' });
  const noteText = el('textarea', { class: 'widget-note-text', dataset: { testid: 'widget-note-text' }, placeholder: '写点便笺…', 'aria-label': '便笺内容' });
  const btnNoteSave = el('button', { class: 'btn sm primary', dataset: { testid: 'widget-note-save' }, text: '保存便笺' });
  function renderNotes() {
    noteList.innerHTML = '';
    const notes = wg.notes || [];
    if (!notes.length) noteList.append(el('div', { class: 'dim', style: { fontSize: '10px' }, text: '暂无便笺' }));
    for (const n of notes) {
      const item = el('div', { class: 'note-item' },
        el('span', { class: 'ntext', text: n.text, title: n.text }),
        el('button', { class: 'del', title: '删除', 'aria-label': '删除便笺', html: glyph('trash', 12), onclick: () => { wg.notes = wg.notes.filter(x => x !== n); renderNotes(); changed('notes'); } }));
      item.addEventListener('click', (e) => { if (e.target.closest('.del')) return; noteText.value = n.text; selectedNote = n; });
      noteList.append(item);
    }
  }
  btnNoteSave.addEventListener('click', () => {
    const text = noteText.value.trim();
    if (!text) return;
    if (selectedNote) selectedNote.text = text;
    else { wg.notes.unshift({ id: 'n' + Date.now(), text, created: sys.clock }); }
    selectedNote = null; noteText.value = '';
    renderNotes(); changed('notes');
  });
  const notesCard = el('div', { class: 'wg-card' }, el('h5', {}, glyph('note', 14), el('span', { text: '便笺' }), el('span', { class: 'spacer' }), el('span', { style: { fontSize: '9px' }, text: `${wg.notes.length} 张` })),
    noteList, noteText, el('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '6px' } }, btnNoteSave));

  // ---- 剪贴板历史 ----
  const clipList = el('div', { class: 'clip-list', dataset: { testid: 'widget-clipboard-list' } });
  const clipCount = el('span', { style: { fontSize: '9px' }, text: '' });
  function renderClipboard() {
    clipList.innerHTML = '';
    const items = sys.widgets.clipboard || [];
    clipCount.textContent = `${items.length} 项`;
    if (!items.length) clipList.append(el('div', { class: 'dim', style: { fontSize: '10px' }, text: '复制表格选区或文本后会出现在这里' }));
    items.slice(0, 8).forEach((c, i) => {
      const item = el('div', { class: 'clip-item', title: '点击再次复制' },
        el('span', { class: 'ct', text: (c.text || '').replace(/\n/g, ' ⏎ ').slice(0, 70) }),
        el('span', { class: 'chip', text: c.source ? String(c.source).slice(0, 18) : '文本' }));
      item.addEventListener('click', () => {
        try { navigator.clipboard.writeText(c.text); } catch (e) { }
        toast('已复制', '内容已写入系统剪贴板。', 'ok', sys);
      });
      clipList.append(item);
    });
  }
  const btnClipClear = el('button', { class: 'btn sm ghost', text: '清空', onclick: () => { sys.widgets.clipboard = []; renderClipboard(); changed('clipboard'); } });
  const clipCard = el('div', { class: 'wg-card' }, el('h5', {}, glyph('clipboard', 14), el('span', { text: '剪贴板历史' }), el('span', { class: 'spacer' }), clipCount, btnClipClear), clipList);

  // ---- 通知中心 ----
  const notifList = el('div', { class: 'notif-list', dataset: { testid: 'widget-notifications' } });
  const dndToggle = el('div', { class: 'toggle' + (sys.settings.dnd ? ' on' : ''), title: '免打扰' });
  dndToggle.addEventListener('click', () => { setDnd(!sys.settings.dnd); });
  const btnReadAll = el('button', { class: 'btn sm ghost', text: '全部已读', onclick: () => { sys.notifications.forEach(n => n.read = true); changed('notif'); renderNotifications(); view.syncTray(); } });
  const btnClearNotif = el('button', { class: 'btn sm ghost', text: '清除', onclick: () => { sys.notifications = []; changed('notif'); renderNotifications(); view.syncTray(); } });
  function renderNotifications() {
    notifList.innerHTML = '';
    const list = sys.notifications || [];
    if (!list.length) notifList.append(el('div', { class: 'dim', style: { fontSize: '10px' }, text: '暂无通知' }));
    for (const n of list.slice(0, 20)) {
      const item = el('div', { class: 'notif-item' + (n.read ? '' : ' unread') },
        el('span', { style: { marginTop: '2px' }, html: glyph(n.kind === 'err' ? 'warning' : n.kind === 'ok' ? 'check' : 'info', 13) }),
        el('div', { class: 'grow' }, el('div', { class: 'nt', text: n.title }), el('div', { class: 'nb', text: n.body })),
        el('span', { class: 'ntime', text: fmtClock(n.clock) })
      );
      item.addEventListener('click', () => { n.read = true; changed('notif'); renderNotifications(); view.syncTray(); });
      notifList.append(item);
    }
  }
  const notifCard = el('div', { class: 'wg-card wide' }, el('h5', {}, glyph('bell', 14), el('span', { text: '通知中心' }), el('span', { class: 'spacer' }),
    el('span', { style: { fontSize: '9px' }, text: '免打扰' }), dndToggle, btnReadAll, btnClearNotif), notifList);

  // ---- 快捷设置 ----
  function setDnd(v) {
    sys.settings.dnd = v; sys.widgets.dnd = v;
    dndToggle.classList.toggle('on', v);
    changed('dnd'); view.syncTray(); toast(v ? '已开启免打扰' : '已关闭免打扰', v ? '通知保留记录，但不弹出提示。' : '', 'info', sys);
  }
  function setAccent(a) {
    sys.settings.accent = a; changed('settings'); view.syncSettings();
    renderQuick(); toast('强调色已切换', a, 'info', sys);
  }
  function setScale(s) {
    sys.settings.scale = s; changed('settings'); view.syncSettings();
    renderQuick();
  }
  function setWallpaper(w) {
    sys.settings.wallpaper = w; changed('settings'); view.syncSettings();
    renderQuick();
  }
  const quickCard = el('div', { class: 'wg-card wide' }, el('h5', {}, glyph('settings', 14), el('span', { text: '快捷设置' }), el('span', { class: 'spacer' }), el('span', { style: { fontSize: '9px', color: 'var(--dim)' }, text: '与设置应用共享状态' })));
  function renderQuick() {
    const old = quickCard.querySelector('.quick-body');
    if (old) old.remove();
    const body = el('div', { class: 'quick-body' });
    body.append(el('div', { class: 'quick-row' },
      el('span', { class: 'ql', text: '强调色' }),
      el('div', { class: 'wg-accent-dots' }, ...ACCENTS.map(a => {
        const d = el('button', { class: 'accent-dot' + (sys.settings.accent === a.value ? ' active' : ''), title: a.name, style: { background: a.value }, dataset: { value: a.value } });
        d.addEventListener('click', () => setAccent(a.value));
        return d;
      }))));
    body.append(el('div', { class: 'quick-row' },
      el('span', { class: 'ql', text: '界面缩放' }),
      el('div', { class: 'scale-opts' }, ...[0.9, 1, 1.15, 1.3].map(s => {
        const b = el('button', { class: 'scale-opt' + (Math.abs(sys.settings.scale - s) < 0.01 ? ' active' : ''), text: Math.round(s * 100) + '%', dataset: { value: String(s) } });
        b.addEventListener('click', () => setScale(s));
        return b;
      }))));
    body.append(el('div', { class: 'quick-row' },
      el('span', { class: 'ql', text: '壁纸' }),
      el('div', { class: 'wp-grid', style: { gridTemplateColumns: 'repeat(4,1fr)', flex: 1 } }, ...Object.entries(WALLPAPERS).map(([k, w]) => {
        const o = el('button', { class: 'wp-opt' + (sys.settings.wallpaper === k ? ' active' : ''), style: { backgroundImage: w.css, aspectRatio: '2.4' }, dataset: { value: k } }, el('span', { text: w.name }));
        o.addEventListener('click', () => setWallpaper(k));
        return o;
      }))));
    body.append(el('div', { class: 'quick-row' },
      el('span', { class: 'ql', text: '免打扰' }),
      (() => { const t = el('div', { class: 'toggle' + (sys.settings.dnd ? ' on' : '') }); t.addEventListener('click', () => { setDnd(!sys.settings.dnd); }); return t; })(),
      el('span', { class: 'dim', style: { fontSize: '10px' }, text: '通知仍记录' })));
    quickCard.append(body);
  }

  scroll.append(clockCard, calCard, timerCard, stopwatchCard, notesCard, clipCard, notifCard, quickCard);

  function updateTimer() {
    let sec = wg.timer.remaining || 0;
    if (wg.timer.running && wg.timer.endAt != null) sec = Math.max(0, wg.timer.endAt - sys.clock);
    timerDisplay.textContent = fmtClock(sec);
    timerDisplay.classList.toggle('warn', sec <= 10);
    const ratio = wg.timer.duration ? clamp(sec / wg.timer.duration, 0, 1) : 0;
    timerRing.querySelector('i').style.width = (ratio * 100) + '%';
  }
  function updateStopwatch() {
    const e = swElapsed();
    swDisplay.textContent = `${String(Math.floor(e / 60)).padStart(2, '0')}:${(e % 60).toFixed(1).padStart(4, '0')}`;
  }
  function updateClockAndDate() {
    const d = today();
    clockTime.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    clockDate.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${'日一二三四五六'[d.getDay()]}`;
  }
  let lastSec = -1;
  function onTick() {
    if (!isOpen) return;
    updateClockAndDate();
    if (new Date().getSeconds() !== lastSec) { lastSec = new Date().getSeconds(); renderCalendar(); }
    updateTimer();
    updateStopwatch();
  }
  function refresh() {
    dndToggle.classList.toggle('on', !!sys.settings.dnd);
    renderNotifications(); renderClipboard(); renderNotes(); renderLaps(); renderQuick();
    updateClockAndDate(); updateTimer(); updateStopwatch(); renderCalendar();
  }
  const api = {
    el: panel,
    isOpen: () => isOpen,
    open(section) {
      panel.classList.add('open');
      isOpen = true;
      if (sys.settings.dnd == null) sys.settings.dnd = false;
      refresh();
      if (section === 'notifications') notifCard.scrollIntoView({ block: 'nearest' });
      else if (section === 'clock') clockCard.scrollIntoView({ block: 'nearest' });
    },
    close() { panel.classList.remove('open'); isOpen = false; },
    toggle(section) { if (isOpen) this.close(); else this.open(section); },
    refresh, onTick,
    destroy() { panel.remove(); }
  };
  return api;
}
