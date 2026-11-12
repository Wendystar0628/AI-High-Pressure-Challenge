import { appIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc, fmtVirtualClock, fmtDuration, clamp } from '../ui/common.js';

export const meta = {
  title: '小组件', desc: '时钟、倒计时、便笺、剪贴板与通知',
  width: 448, height: 720, minW: 360, minH: 440, rootOnly: true,
};

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

export function mount(ctx) {
  const { sys, os, shell, body } = ctx;
  const W = os.rootState.widgets;
  if (!W.timer) W.timer = { duration: 300, remaining: 300, running: false, ended: false, label: '倒计时' };
  if (!W.stopwatch) W.stopwatch = { elapsed: 0, running: false, laps: [] };
  if (!W.calendar) W.calendar = { month: new Date().getMonth(), year: new Date().getFullYear() };
  if (!W.quick) W.quick = { wifi: true, bluetooth: false, night: false, volume: 62 };

  body.innerHTML = `<div class="widgets-app">
    <div class="widgets-head">
      <div class="widgets-title">${appIcon('widgets', { size: 30 })}<div><b>小组件</b><span>根系统 · outer</span></div></div>
      <div class="widgets-head-actions">
        <button type="button" class="icon-button ${W.dnd ? 'active' : ''}" data-widget-dnd title="免打扰" aria-label="免打扰">${uiIcon('moon')}</button>
        <button type="button" class="icon-button" data-widget-refresh title="刷新" aria-label="刷新">${uiIcon('reload')}</button>
      </div>
    </div>
    <div class="widgets-scroll">
      <section class="widget-card widget-clock-card">
        <div class="widget-clock-top">
          <div class="widget-clock-time" data-widget-clock>09:30</div>
          <div class="widget-clock-right"><span class="widget-weather">${uiIcon('moon')} 18°</span><span class="widget-date" data-widget-date></span></div>
        </div>
        <div class="widget-clock-foot">
          <span class="widget-virtual">虚拟时钟 <b data-widget-vclock>0.00 s</b></span>
          <span class="widget-live-dot"></span><span>LIVE</span>
          <span class="spacer"></span>
          <span>${new Date().getFullYear()} · ${new Date().toLocaleDateString('zh-CN', { weekday: 'long' })}</span>
        </div>
      </section>

      <section class="widget-card">
        <div class="widget-card-head"><div><h3>${uiIcon('timer')} 倒计时</h3><p>使用根系统虚拟时间，结束时产生通知。</p></div><span class="widget-badge" data-widget-timer-state>待机</span></div>
        <div class="timer-wrap">
          <div class="timer-ring" data-widget-timer-ring>
            <div class="timer-ring-inner"><span data-widget-timer-left>5:00</span><small>剩余</small></div>
          </div>
          <div class="timer-controls">
            <div class="timer-input-row">
              <input type="number" min="1" max="3599" value="${Math.max(1, Math.round(W.timer.duration))}" data-testid="widget-timer-input" aria-label="倒计时秒数">
              <span>秒</span>
            </div>
            <div class="timer-buttons">
              <button type="button" class="primary-button" data-testid="widget-timer-start" data-widget-timer-start>${uiIcon('play')} 开始</button>
              <button type="button" class="ghost-button" data-testid="widget-timer-pause" data-widget-timer-pause>${uiIcon('pause')} 暂停</button>
              <button type="button" class="ghost-button" data-testid="widget-timer-reset" data-widget-timer-reset>${uiIcon('reload')} 重置</button>
            </div>
          </div>
        </div>
      </section>

      <section class="widget-card">
        <div class="widget-card-head"><div><h3>${uiIcon('timer')} 秒表</h3><p>计时与实际虚拟时间同步。</p></div><span class="widget-badge" data-widget-sw-state>待机</span></div>
        <div class="stopwatch-display" data-widget-stopwatch>0:00.00</div>
        <div class="timer-buttons">
          <button type="button" class="small-button" data-widget-sw-toggle>开始</button>
          <button type="button" class="small-button" data-widget-sw-lap>计次</button>
          <button type="button" class="small-button" data-widget-sw-reset>重置</button>
          <span class="spacer"></span><span class="stopwatch-laps" data-widget-laps>0 次计次</span>
        </div>
      </section>

      <section class="widget-card">
        <div class="widget-card-head"><div><h3>${uiIcon('calendar')} 日历</h3><p>${W.calendar.year} 年</p></div>
          <div class="calendar-nav"><button type="button" class="icon-button" data-cal-prev aria-label="上个月">${uiIcon('arrowLeft')}</button><b data-cal-label>${MONTHS[W.calendar.month]}</b><button type="button" class="icon-button" data-cal-next aria-label="下个月">${uiIcon('arrowRight')}</button></div>
        </div>
        <div class="calendar-week">${WEEK.map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="calendar-grid" data-widget-calendar></div>
      </section>

      <section class="widget-card">
        <div class="widget-card-head"><div><h3>${uiIcon('note')} 便笺</h3><p>保存在根系统的数据目录中。</p></div><span class="widget-badge" data-widget-note-status>已保存</span></div>
        <textarea class="widget-note" data-testid="widget-note-text" placeholder="随手记点什么…" rows="4">${esc(W.note || '')}</textarea>
        <div class="note-actions"><span class="muted">${(W.note || '').length} 字符</span><button type="button" class="small-button" data-testid="widget-note-save">${uiIcon('success')} 保存便笺</button></div>
      </section>

      <section class="widget-card">
        <div class="widget-card-head"><div><h3>${uiIcon('clipboard')} 剪贴板历史</h3><p>记录应用内实际复制的文本与表格选区。</p></div><button type="button" class="mini-text-button" data-widget-clip-clear>清空</button></div>
        <div class="clipboard-list" data-testid="widget-clipboard-list"></div>
      </section>

      <section class="widget-card widget-notif-card">
        <div class="widget-card-head"><div><h3>${uiIcon('bell')} 通知</h3><p>来自实际事件的系统通知。</p></div>
          <button type="button" class="mini-text-button ${W.dnd ? 'on' : ''}" data-widget-dnd-toggle>${W.dnd ? '已免打扰' : '免打扰'}</button>
        </div>
        <div class="widget-notifications" data-testid="widget-notifications" data-widget-notif-list></div>
      </section>

      <section class="widget-card">
        <div class="widget-card-head"><div><h3>${uiIcon('settings')} 快捷设置</h3><p>与开始菜单、设置共享状态。</p></div></div>
        <div class="widget-quick-grid">
          <button type="button" class="quick-toggle ${W.quick.wifi ? 'on' : ''}" data-quick="wifi">${uiIcon('wifi')}<span>网络</span></button>
          <button type="button" class="quick-toggle ${W.quick.bluetooth ? 'on' : ''}" data-quick="bluetooth">${uiIcon('bluetooth')}<span>蓝牙</span></button>
          <button type="button" class="quick-toggle ${W.quick.night ? 'on' : ''}" data-quick="night">${uiIcon('moon')}<span>夜间</span></button>
          <button type="button" class="quick-toggle ${W.dnd ? 'on' : ''}" data-quick="dnd">${uiIcon('bell')}<span>免打扰</span></button>
        </div>
        <div class="volume-row"><span>${uiIcon('volume')} 音量</span><input type="range" min="0" max="100" value="${W.quick.volume ?? 62}" data-widget-volume><b data-volume-label>${W.quick.volume ?? 62}%</b></div>
      </section>
    </div>
  </div>`;

  const clockEl = $s(body, '[data-widget-clock]');
  const dateEl = $s(body, '[data-widget-date]');
  const vclockEl = $s(body, '[data-widget-vclock]');
  const timerLeft = $s(body, '[data-widget-timer-left]');
  const timerRing = $s(body, '[data-widget-timer-ring]');
  const timerState = $s(body, '[data-widget-timer-state]');
  const swEl = $s(body, '[data-widget-stopwatch]');
  const swState = $s(body, '[data-widget-sw-state]');
  const lapInfo = $s(body, '[data-widget-laps]');
  const calGrid = $s(body, '[data-widget-calendar]');
  const calLabel = $s(body, '[data-cal-label]');
  const noteInput = $s(body, '[data-testid="widget-note-text"]');
  const noteStatus = $s(body, '[data-widget-note-status]');
  let noteTimer = null;

  function renderCalendar() {
    const y = W.calendar.year, m = W.calendar.month;
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    let html = '';
    for (let i = 0; i < start; i++) html += '<span class="cal-empty"></span>';
    for (let d = 1; d <= days; d++) {
      const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
      html += `<button type="button" class="cal-day ${isToday ? 'today' : ''}" data-cal-day="${d}">${d}</button>`;
    }
    calGrid.innerHTML = html;
    calLabel.textContent = MONTHS[m];
    $s(body, '.widget-card:nth-of-type(4) .widget-card-head p').textContent = `${y} 年`;
  }

  function renderTimer() {
    const t = W.timer;
    const dur = Math.max(1, Number(t.duration) || 1);
    const remain = Math.max(0, Number(t.remaining) || 0);
    const ratio = clamp(remain / dur, 0, 1);
    timerLeft.textContent = fmtDuration(remain, false);
    timerRing.style.background = `conic-gradient(${t.running ? 'var(--accent)' : 'var(--gold)'} ${ratio * 360}deg, rgba(255,255,255,.06) 0deg)`;
    timerState.textContent = t.running ? '计时中' : t.ended ? '已结束' : '待机';
    timerState.classList.toggle('running', t.running);
    const startBtn = $s(body, '[data-widget-timer-start]');
    if (startBtn) startBtn.innerHTML = `${uiIcon('play')} ${t.running ? '重新开始' : '开始'}`;
  }

  function renderStopwatch() {
    swEl.textContent = fmtDuration(W.stopwatch.elapsed, true);
    swState.textContent = W.stopwatch.running ? '计时中' : '待机';
    lapInfo.textContent = `${W.stopwatch.laps?.length || 0} 次计次`;
    const toggle = $s(body, '[data-widget-sw-toggle]');
    if (toggle) toggle.textContent = W.stopwatch.running ? '暂停' : '开始';
  }

  function renderClipboard() {
    const list = $s(body, '[data-testid="widget-clipboard-list"]');
    if (!os.clip.length) { list.innerHTML = '<div class="widget-empty">剪贴板历史为空<br><span>复制表格选区或文件路径后会出现在这里</span></div>'; return; }
    list.innerHTML = os.clip.slice(0, 8).map((c, i) => `<button type="button" class="clip-item" data-clip-index="${i}">
      <span class="clip-kind">${c.meta?.kind === 'sheet' ? '表格' : c.meta?.kind === 'files' ? '文件' : '文本'}</span>
      <span class="clip-text">${esc((c.text || '').slice(0, 160))}</span>
      <span class="clip-time">${c.meta?.range ? esc(c.meta.range) : fmtVirtualClock(c.at || 0)}</span>
    </button>`).join('');
    for (const item of $all(list, '.clip-item')) {
      item.addEventListener('click', () => {
        const c = os.clip[Number(item.dataset.clipIndex)];
        if (!c) return;
        navigator.clipboard?.writeText(c.text).catch(() => {});
        ctx.toast('已复制到剪贴板', 'success');
      });
    }
  }

  function renderNotifications() {
    const list = $s(body, '[data-widget-notif-list]');
    const notes = sys.notifications.slice().reverse().slice(0, 8);
    if (!notes.length) { list.innerHTML = '<div class="widget-empty">暂无通知<br><span>倒计时、文件操作与系统事件会汇总到这里</span></div>'; return; }
    list.innerHTML = notes.map((n) => `<div class="widget-notif-item kind-${esc(n.kind)}">
      <span class="wni-icon">${uiIcon(n.kind === 'error' ? 'warning' : n.kind === 'success' ? 'success' : 'bell')}</span>
      <div><b>${esc(n.title)}</b><p>${esc(n.body || '')}</p><span>${fmtVirtualClock(n.at)}${n.read ? '' : ' · 新'}</span></div>
    </div>`).join('');
  }

  function syncQuick() {
    for (const q of $all(body, '[data-quick]')) {
      const key = q.dataset.quick;
      q.classList.toggle('on', key === 'dnd' ? !!os.rootState.widgets.dnd : !!os.rootState.widgets.quick[key]);
    }
    const dnd = $s(body, '[data-widget-dnd-toggle]');
    if (dnd) { dnd.textContent = os.rootState.widgets.dnd ? '已免打扰' : '免打扰'; dnd.classList.toggle('on', !!os.rootState.widgets.dnd); }
    const headDnd = $s(body, '[data-widget-dnd]');
    if (headDnd) headDnd.classList.toggle('active', !!os.rootState.widgets.dnd);
    shell.getDesktop('outer') && shell.buildStartMenu(shell.getDesktop('outer'));
  }

  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    vclockEl.textContent = `${sys.clock.toFixed(2)} s`;
  }

  // ---------------- 交互 ----------------
  $s(body, '[data-widget-timer-start]').addEventListener('click', () => {
    const input = $s(body, '[data-testid="widget-timer-input"]');
    const seconds = Math.max(1, Math.min(3599, Number(input.value) || 5));
    W.timer.duration = seconds;
    W.timer.remaining = seconds;
    W.timer.running = true;
    W.timer.ended = false;
    W.timer.label = '倒计时';
    os.scheduleSave?.();
    renderTimer();
    os.notify('outer', { title: '倒计时开始', body: `${seconds} 秒后提醒`, kind: 'info', appId: 'widgets' });
  });
  $s(body, '[data-widget-timer-pause]').addEventListener('click', () => {
    W.timer.running = false; os.scheduleSave?.(); renderTimer();
  });
  $s(body, '[data-widget-timer-reset]').addEventListener('click', () => {
    W.timer.running = false; W.timer.ended = false;
    W.timer.remaining = W.timer.duration;
    os.scheduleSave?.(); renderTimer();
  });
  $s(body, '[data-testid="widget-timer-input"]').addEventListener('change', (e) => {
    const v = Math.max(1, Math.min(3599, Number(e.target.value) || 5));
    e.target.value = v;
    W.timer.duration = v;
    if (!W.timer.running) W.timer.remaining = v;
    os.scheduleSave?.(); renderTimer();
  });
  $s(body, '[data-widget-sw-toggle]').addEventListener('click', () => { W.stopwatch.running = !W.stopwatch.running; os.scheduleSave?.(); renderStopwatch(); });
  $s(body, '[data-widget-sw-lap]').addEventListener('click', () => { W.stopwatch.laps = W.stopwatch.laps || []; W.stopwatch.laps.push(W.stopwatch.elapsed); renderStopwatch(); });
  $s(body, '[data-widget-sw-reset]').addEventListener('click', () => { W.stopwatch.running = false; W.stopwatch.elapsed = 0; W.stopwatch.laps = []; os.scheduleSave?.(); renderStopwatch(); });
  $s(body, '[data-cal-prev]').addEventListener('click', () => {
    W.calendar.month--; if (W.calendar.month < 0) { W.calendar.month = 11; W.calendar.year--; }
    os.scheduleSave?.(); renderCalendar();
  });
  $s(body, '[data-cal-next]').addEventListener('click', () => {
    W.calendar.month++; if (W.calendar.month > 11) { W.calendar.month = 0; W.calendar.year++; }
    os.scheduleSave?.(); renderCalendar();
  });
  noteInput.addEventListener('input', () => {
    noteStatus.textContent = '编辑中…';
    noteStatus.classList.add('editing');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => saveNote(false), 900);
  });
  $s(body, '[data-testid="widget-note-save"]').addEventListener('click', () => saveNote(true));
  function saveNote(showToast) {
    W.note = noteInput.value;
    os.scheduleSave?.();
    noteStatus.textContent = '已保存';
    noteStatus.classList.remove('editing');
    const counter = $s(body, '.note-actions .muted');
    if (counter) counter.textContent = `${W.note.length} 字符`;
    if (showToast) {
      ctx.toast('便笺已保存', 'success');
      os.notify('outer', { title: '便笺已保存', body: W.note.slice(0, 40) || '（空便笺）', kind: 'success', appId: 'widgets' });
    }
  }
  $s(body, '[data-widget-clip-clear]').addEventListener('click', () => {
    os.clip = []; os.rootState.clip = []; os.emit('clipboard-updated', { clip: [] }); renderClipboard(); os.scheduleSave?.();
  });
  const toggleDnd = () => {
    os.rootState.widgets.dnd = !os.rootState.widgets.dnd;
    syncQuick(); renderNotifications(); os.scheduleSave?.();
  };
  $s(body, '[data-widget-dnd]')?.addEventListener('click', toggleDnd);
  $s(body, '[data-widget-dnd-toggle]')?.addEventListener('click', toggleDnd);
  $s(body, '[data-widget-refresh]').addEventListener('click', () => { renderAll(); ctx.toast('小组件已刷新', 'info'); });
  for (const q of $all(body, '[data-quick]')) {
    q.addEventListener('click', () => {
      const key = q.dataset.quick;
      if (key === 'dnd') os.rootState.widgets.dnd = !os.rootState.widgets.dnd;
      else if (key === 'night') { os.rootState.widgets.quick.night = !os.rootState.widgets.quick.night; os.rootState.widgets.night = os.rootState.widgets.quick.night; document.documentElement.classList.toggle('night-mode', os.rootState.widgets.quick.night); }
      else os.rootState.widgets.quick[key] = !os.rootState.widgets.quick[key];
      os.scheduleSave?.(); syncQuick(); renderNotifications();
    });
  }
  $s(body, '[data-widget-volume]').addEventListener('input', (e) => {
    os.rootState.widgets.quick.volume = Number(e.target.value);
    $s(body, '[data-volume-label]').textContent = `${e.target.value}%`;
    os.scheduleSave?.();
  });

  function renderAll() {
    updateClock(); renderTimer(); renderStopwatch(); renderCalendar(); renderClipboard(); renderNotifications(); syncQuick();
  }
  renderAll();

  const unsubs = [];
  unsubs.push(os.on('clipboard-updated', renderClipboard));
  unsubs.push(os.on('notification', () => { renderNotifications(); }));
  unsubs.push(os.on('notifications-updated', renderNotifications));
  unsubs.push(os.on('widget-timer-ended', () => { renderTimer(); renderNotifications(); }));
  const timer = setInterval(() => {
    updateClock(); renderTimer(); renderStopwatch();
  }, 200);
  return { destroy() { clearInterval(timer); clearTimeout(noteTimer); for (const u of unsubs) u(); } };
}
