// 桌面小组件面板：时钟日历、倒计时秒表、便笺、剪贴板历史、通知中心、快捷设置。
import { h } from './desktop.js';

export function installClipboard(desk) {
  desk.clipboard = [];
  desk.clipListeners = [];
  desk.clipboardAdd = (text, kind) => {
    if (!text) return;
    desk.clipboard.unshift({ text, kind: kind || 'text', time: Date.now() });
    if (desk.clipboard.length > 50) desk.clipboard.pop();
    for (const f of desk.clipListeners) f();
  };
  // 根系统实际发生的文本复制
  document.addEventListener('copy', (e) => {
    const t = e.target;
    let text = '';
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) text = t.value.slice(t.selectionStart, t.selectionEnd);
    else text = String(window.getSelection() || '');
    if (text) desk.clipboardAdd(text, 'text');
  }, true);
}

export function widgetsApp(desk) {
  const existing = [...desk.windows.values()].find((w) => w.app === 'widgets');
  if (existing) { desk.restore(existing); return existing; }
  const S = desk.settings;
  S.notes = S.notes || [];
  const pad = (n) => String(n).padStart(2, '0');

  // 时钟与日历
  const clockEl = h('div', { class: 'big-clock', tid: 'widget-clock' });
  const dateEl = h('div', { class: 'rlabel', tid: 'widget-date' });
  const now0 = new Date();
  let calY = now0.getFullYear(), calM = now0.getMonth(), picked = null;
  const calHead = h('b', { text: '' });
  const calBox = h('div', { class: 'cal', tid: 'widget-calendar' });
  const picks = h('div', { class: 'rlabel', tid: 'widget-picked-date', style: 'margin-top:4px', text: '点选日期查看' });
  function renderCal() {
    calHead.textContent = `${calY} 年 ${calM + 1} 月`;
    calBox.textContent = '';
    for (const w of '日一二三四五六') calBox.appendChild(h('div', { class: 'wk', text: w }));
    const first = new Date(calY, calM, 1).getDay();
    const days = new Date(calY, calM + 1, 0).getDate();
    for (let i = 0; i < first; i++) calBox.appendChild(h('div'));
    const t = new Date();
    for (let d = 1; d <= days; d++) {
      const today = t.getFullYear() === calY && t.getMonth() === calM && t.getDate() === d;
      const isPick = picked && picked[0] === calY && picked[1] === calM && picked[2] === d;
      calBox.appendChild(h('div', {
        class: 'day' + (today ? ' today' : '') + (isPick ? ' picked' : ''), text: String(d), role: 'button', label: `${calY}-${calM + 1}-${d}`,
        onclick: () => { picked = [calY, calM, d]; const w = '日一二三四五六'[new Date(calY, calM, d).getDay()]; picks.textContent = `${calY} 年 ${calM + 1} 月 ${d} 日 星期${w}`; renderCal(); },
      }));
    }
  }
  renderCal();
  const clockCard = h('div', { class: 'card' }, h('h4', { text: '时钟与日历' }), clockEl, dateEl,
    h('div', { class: 'flow', style: 'margin-top:6px' }, h('button', { class: 'rbtn', tid: 'widget-cal-prev', text: '‹', label: '上个月', onclick: () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); } }), calHead,
      h('button', { class: 'rbtn', tid: 'widget-cal-next', text: '›', label: '下个月', onclick: () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); } })), calBox, picks);

  // 倒计时（根系统虚拟时钟驱动）
  const K = desk.K;
  const timer = desk.timerState = desk.timerState || { total: 60, left: 60, running: false, last: 0 };
  const timerInput = h('input', { class: 'rfield', tid: 'widget-timer-input', 'data-system-id': 'outer', style: 'width:90px', value: String(timer.total), label: '倒计时秒数' });
  const timerShow = h('div', { class: 'big-clock mono', tid: 'widget-timer-display', style: 'font-size:28px' });
  const fmtT = (t) => { const s = Math.max(0, Math.ceil(t)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const swState = desk.swState = desk.swState || { t: 0, running: false, last: 0, laps: [] };
  const swShow = h('div', { class: 'big-clock mono', tid: 'widget-stopwatch-display', style: 'font-size:28px' });
  const lapsEl = h('div', { tid: 'widget-stopwatch-laps', class: 'mono', style: 'max-height:90px;overflow:auto;font-size:12px' });
  const fmtS = (t) => `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}.${pad(Math.floor((t * 100) % 100))}`;
  const tickFn = () => {
    const v = K.vtime;
    if (timer.running) {
      timer.left -= v - timer.last;
      timer.last = v;
      if (timer.left <= 0) { timer.left = 0; timer.running = false; desk.notify('info', `倒计时 ${timer.total} 秒已到`, '倒计时'); }
    }
    if (swState.running) { swState.t += v - swState.last; swState.last = v; }
  };
  if (!desk.timerTicker) { desk.timerTicker = true; K.tickListeners.add(tickFn); }
  const timerCard = h('div', { class: 'card' }, h('h4', { text: '倒计时与秒表' }), timerShow,
    h('div', { class: 'flow', style: 'flex-wrap:wrap;margin:6px 0' }, timerInput, h('span', { class: 'rlabel', text: '秒' }),
      h('button', { class: 'rbtn primary', tid: 'widget-timer-start', 'data-system-id': 'outer', text: '开始', onclick: () => { const v = parseFloat(timerInput.value); if (v > 0) { timer.total = v; timer.left = v; timer.running = true; timer.last = K.vtime; } } }),
      h('button', { class: 'rbtn', tid: 'widget-timer-pause', 'data-system-id': 'outer', text: '暂停/继续', onclick: () => { if (timer.left > 0) { timer.running = !timer.running; timer.last = K.vtime; } } }),
      h('button', { class: 'rbtn', tid: 'widget-timer-reset', 'data-system-id': 'outer', text: '重置', onclick: () => { timer.running = false; const v = parseFloat(timerInput.value); timer.total = v > 0 ? v : timer.total; timer.left = timer.total; } })),
    swShow,
    h('div', { class: 'flow', style: 'flex-wrap:wrap;margin-top:6px' },
      h('button', { class: 'rbtn', tid: 'widget-stopwatch-start', text: '开始/暂停', onclick: () => { swState.running = !swState.running; swState.last = K.vtime; } }),
      h('button', { class: 'rbtn', tid: 'widget-stopwatch-lap', text: '分段', onclick: () => { swState.laps.unshift(swState.t); renderLaps(); } }),
      h('button', { class: 'rbtn', tid: 'widget-stopwatch-reset', text: '复位', onclick: () => { swState.running = false; swState.t = 0; swState.laps = []; renderLaps(); } })), lapsEl);
  function renderLaps() { lapsEl.textContent = swState.laps.map((t, i) => `第 ${swState.laps.length - i} 段  ${fmtS(t)}`).join('\n'); lapsEl.style.whiteSpace = 'pre'; }
  renderLaps();

  // 便笺
  const noteText = h('textarea', { class: 'note-text', tid: 'widget-note-text', 'data-system-id': 'outer', placeholder: '写点什么…', label: '便笺内容' });
  let editIdx = -1;
  const notesEl = h('div', { tid: 'widget-note-list' });
  function renderNotes() {
    notesEl.textContent = '';
    S.notes.forEach((n, i) => notesEl.appendChild(h('div', { class: 'note-item', tid: 'widget-note' }, n,
      h('div', { class: 'flow', style: 'margin-top:4px' }, h('button', { class: 'rbtn', text: '编辑', tid: 'widget-note-edit', onclick: () => { editIdx = i; noteText.value = S.notes[i]; noteText.focus(); } }),
        h('button', { class: 'rbtn', text: '删除', tid: 'widget-note-delete', onclick: () => { S.notes.splice(i, 1); desk.saveSettings(); renderNotes(); } })))));
  }
  renderNotes();
  const noteCard = h('div', { class: 'card' }, h('h4', { text: '便笺' }), noteText,
    h('div', { class: 'flow', style: 'margin:6px 0' }, h('button', { class: 'rbtn primary', tid: 'widget-note-save', 'data-system-id': 'outer', text: '保存便笺', onclick: () => {
      const t = noteText.value.trim();
      if (!t) return;
      if (editIdx >= 0) S.notes[editIdx] = t; else S.notes.unshift(t);
      editIdx = -1; noteText.value = '';
      desk.saveSettings();
      renderNotes();
    } }), h('button', { class: 'rbtn', tid: 'widget-note-new', text: '新建', onclick: () => { editIdx = -1; noteText.value = ''; noteText.focus(); } })), notesEl);

  // 剪贴板历史
  const clipEl = h('div', { tid: 'widget-clipboard-list', 'data-system-id': 'outer' });
  function renderClip() {
    clipEl.textContent = '';
    if (!desk.clipboard.length) clipEl.appendChild(h('div', { class: 'rlabel', text: '还没有复制过内容' }));
    desk.clipboard.slice(0, 20).forEach((c) => clipEl.appendChild(h('div', { class: 'clip-item', tid: 'widget-clipboard-item', 'data-kind': c.kind }, c.text.length > 180 ? c.text.slice(0, 180) + '…' : c.text,
      h('div', { class: 'flow', style: 'margin-top:4px' }, h('span', { class: 'tag', text: c.kind === 'sheet' ? '表格选区' : '文本' }), h('button', { class: 'rbtn', text: '再次复制', tid: 'widget-clipboard-copy', onclick: () => { navigator.clipboard.writeText(c.text).catch(() => {}); desk.clipboardAdd(c.text, c.kind); } })))));
  }
  const clipFn = () => renderClip();
  desk.clipListeners.push(clipFn);
  renderClip();
  const clipCard = h('div', { class: 'card' }, h('h4', { text: '剪贴板历史' }), h('button', { class: 'rbtn', tid: 'widget-clipboard-clear', text: '清空', style: 'margin-bottom:4px', onclick: () => { desk.clipboard.length = 0; renderClip(); } }), clipEl);

  // 通知中心
  const notifEl = h('div', { tid: 'widget-notifications', 'data-system-id': 'outer' });
  const dndBtn = h('button', { class: 'rbtn', tid: 'widget-dnd', text: '免打扰', onclick: () => desk.setDnd(!desk.dnd) });
  function renderNotif() {
    notifEl.textContent = '';
    dndBtn.classList.toggle('on', desk.dnd);
    if (!desk.notifications.length) notifEl.appendChild(h('div', { class: 'rlabel', text: '没有通知' }));
    [...desk.notifications].reverse().slice(0, 30).forEach((n) => notifEl.appendChild(h('div', { class: 'notif-item' + (n.read ? '' : ' unread'), onclick: () => { n.read = true; desk.updateNotifBadge(); renderNotif(); }, text: `${new Date(n.time).toLocaleTimeString()}  ${n.text}` })));
  }
  const notifFn = () => renderNotif();
  desk.onNotify(notifFn);
  const notifCard = h('div', { class: 'card' }, h('h4', { text: '通知中心' }),
    h('div', { class: 'flow', style: 'margin-bottom:4px' }, h('button', { class: 'rbtn', tid: 'widget-notif-read', text: '全部已读', onclick: () => { desk.notifications.forEach((n) => { n.read = true; }); desk.updateNotifBadge(); renderNotif(); } }),
      h('button', { class: 'rbtn', tid: 'widget-notif-clear', text: '清除', onclick: () => { desk.notifications = []; desk.updateNotifBadge(); renderNotif(); } }), dndBtn), notifEl);
  renderNotif();

  // 快捷设置（与系统设置使用同一状态）
  const quick = h('div');
  function renderQuick() {
    quick.textContent = '';
    quick.append(
      h('div', { class: 'flow', style: 'margin-bottom:6px' }, h('span', { class: 'rlabel', text: '主题' }), [['dark', '深色'], ['light', '浅色']].map(([k, n]) => h('button', { class: 'rbtn' + (S.theme === k ? ' on' : ''), tid: 'widget-quick-theme', 'data-value': k, text: n, onclick: () => desk.setSetting('theme', k) }))),
      h('div', { class: 'flow', style: 'margin-bottom:6px' }, h('span', { class: 'rlabel', text: '强调色' }), ['#f5c542', '#8f6bff', '#4fe3c9', '#ff8f77'].map((c) => h('div', { class: 'swatch' + (S.accent === c ? ' on' : ''), tid: 'widget-quick-accent', 'data-value': c, role: 'button', label: c, style: `background:${c};width:26px;height:26px`, onclick: () => desk.setSetting('accent', c) }))),
      h('div', { class: 'flow', style: 'margin-bottom:6px;flex-wrap:wrap' }, h('span', { class: 'rlabel', text: '缩放' }), [0.9, 1, 1.25, 1.5].map((s) => h('button', { class: 'rbtn' + (S.scale === s ? ' on' : ''), tid: 'widget-quick-scale', 'data-value': String(s), text: Math.round(s * 100) + '%', onclick: () => desk.setSetting('scale', s) }))),
      h('div', { class: 'flow' }, h('span', { class: 'rlabel', text: '免打扰' }), h('button', { class: 'rbtn' + (desk.dnd ? ' on' : ''), tid: 'widget-quick-dnd', text: desk.dnd ? '已开启' : '已关闭', onclick: () => desk.setDnd(!desk.dnd) })));
  }
  renderQuick();
  desk.onSettings(() => { renderQuick(); renderNotif(); });
  const quickCard = h('div', { class: 'card' }, h('h4', { text: '快捷设置' }), quick);

  const body = h('div', { class: 'pane-body widgets', tid: 'widgets-panel', 'data-system-id': 'outer' }, clockCard, timerCard, noteCard, clipCard, notifCard, quickCard);
  const win = desk.createWindow({ app: 'widgets', title: '桌面小组件', icon: 'widgets', w: 900, h: 620, onClose: () => { clearInterval(ticker); desk.clipListeners = desk.clipListeners.filter((f) => f !== clipFn); return true; } });
  win.body.appendChild(h('div', { class: 'pane' }, body));
  const upd = () => {
    const d = new Date();
    clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    dateEl.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${'日一二三四五六'[d.getDay()]}`;
    timerShow.textContent = fmtT(timer.left);
    swShow.textContent = fmtS(swState.t);
  };
  const ticker = setInterval(upd, 100);
  upd();
  return win;
}
