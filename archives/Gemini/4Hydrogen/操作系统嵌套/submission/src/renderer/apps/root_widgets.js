// Root System Widgets Drawer (Clock/Calendar, Countdown/Stopwatch, Sticky Note, Clipboard History, Notifications w/ DND, Quick Settings)

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mountWidgetsDrawer({ drawerEl, hostKernel, onSettingsChange }) {
  const WIN_ID = 'root-widgets';
  let timerDuration = 10;
  let timerRemaining = 10;
  let timerRunning = false;
  let swRunning = false;
  let swElapsedMs = 0;
  let calDate = new Date();
  let lastTick = performance.now();

  drawerEl.setAttribute('data-system-id', 'outer');
  drawerEl.setAttribute('data-window-id', WIN_ID);
  drawerEl.setAttribute('data-app-id', 'widgets');

  drawerEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong style="font-size:14px;">桌面小组件与控制中心</strong>
      <button class="os-btn os-btn-xs act-close-drawer">收起</button>
    </div>

    <div class="widget-card">
      <div class="widget-card-hdr">
        <span>时钟与日历</span>
        <div style="display:flex;gap:4px;">
          <button class="os-btn os-btn-xs act-cal-prev">‹</button>
          <span class="cal-month-lbl"></span>
          <button class="os-btn os-btn-xs act-cal-next">›</button>
        </div>
      </div>
      <div class="widget-clock-big"></div>
      <div class="cal-grid"></div>
    </div>

    <div class="widget-card">
      <div class="widget-card-hdr">
        <span>倒计时与秒表</span>
        <span class="sw-readout" style="font-family:Consolas,monospace;color:#38bdf8;">秒表 0.0s</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <input type="number" min="1" max="3600" value="10" class="os-inp ns-inp-xs" data-testid="widget-timer-input" data-system-id="outer" data-window-id="${WIN_ID}" />
        <span style="font-size:12px;">秒 · 剩余 <b class="timer-rem">10</b>s</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;">
        <button class="os-btn os-btn-accent os-btn-xs" data-testid="widget-timer-start" data-system-id="outer" data-window-id="${WIN_ID}">开始倒计时</button>
        <button class="os-btn os-btn-xs" data-testid="widget-timer-pause" data-system-id="outer" data-window-id="${WIN_ID}">暂停</button>
        <button class="os-btn os-btn-xs" data-testid="widget-timer-reset" data-system-id="outer" data-window-id="${WIN_ID}">重置</button>
        <button class="os-btn os-btn-xs act-sw-toggle">秒表启停</button>
        <button class="os-btn os-btn-xs act-sw-reset">秒表归零</button>
      </div>
    </div>

    <div class="widget-card">
      <div class="widget-card-hdr">
        <span>快捷便签</span>
        <button class="os-btn os-btn-accent os-btn-xs" data-testid="widget-note-save" data-system-id="outer" data-window-id="${WIN_ID}">保存便签</button>
      </div>
      <textarea class="widget-note-ta" data-testid="widget-note-text" data-system-id="outer" data-window-id="${WIN_ID}" placeholder="随手记录工作笔记..."></textarea>
    </div>

    <div class="widget-card">
      <div class="widget-card-hdr"><span>剪贴板历史</span></div>
      <div class="clip-list-box" data-testid="widget-clipboard-list" data-system-id="outer" data-window-id="${WIN_ID}" style="display:flex;flex-direction:column;gap:4px;max-height:110px;overflow-y:auto;"></div>
    </div>

    <div class="widget-card">
      <div class="widget-card-hdr">
        <span>通知中心</span>
        <div style="display:flex;gap:4px;">
          <button class="os-btn os-btn-xs act-dnd-btn"></button>
          <button class="os-btn os-btn-xs act-clear-notif">清空</button>
        </div>
      </div>
      <div class="notif-list-box" data-testid="widget-notifications" data-system-id="outer" data-window-id="${WIN_ID}" style="display:flex;flex-direction:column;gap:4px;max-height:140px;overflow-y:auto;"></div>
    </div>

    <div class="widget-card">
      <div class="widget-card-hdr"><span>快捷设置</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;">
        <span>缩放:</span>
        ${[0.85, 1, 1.15].map((sc) => `<button class="os-btn os-btn-xs act-qs-scale" data-val="${sc}">${Math.round(sc * 100)}%</button>`).join('')}
        <span style="margin-left:6px;">主题色:</span>
        ${['#38bdf8', '#a855f7', '#22c55e', '#f59e0b'].map((c) => `<button class="os-btn os-btn-xs act-qs-accent" data-val="${c}" style="width:20px;height:20px;padding:0;background:${c};"></button>`).join('')}
      </div>
    </div>
  `;

  const clockEl = drawerEl.querySelector('.widget-clock-big');
  const monthLbl = drawerEl.querySelector('.cal-month-lbl');
  const calGrid = drawerEl.querySelector('.cal-grid');
  const timerInp = drawerEl.querySelector('[data-testid="widget-timer-input"]');
  const timerRemEl = drawerEl.querySelector('.timer-rem');
  const swEl = drawerEl.querySelector('.sw-readout');
  const noteTa = drawerEl.querySelector('[data-testid="widget-note-text"]');
  const clipBox = drawerEl.querySelector('[data-testid="widget-clipboard-list"]');
  const notifBox = drawerEl.querySelector('[data-testid="widget-notifications"]');
  const dndBtn = drawerEl.querySelector('.act-dnd-btn');

  const renderCalendar = () => {
    const y = calDate.getFullYear();
    const m = calDate.getMonth();
    monthLbl.textContent = `${y}年${m + 1}月`;
    const now = new Date();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let html = ['日', '一', '二', '三', '四', '五', '六'].map((d) => `<div class="cal-day-hdr">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) html += '<div></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = y === now.getFullYear() && m === now.getMonth() && day === now.getDate();
      html += `<div class="cal-cell ${isToday ? 'today' : ''}">${day}</div>`;
    }
    calGrid.innerHTML = html;
  };

  const renderDynamicLists = () => {
    if (document.activeElement !== noteTa) noteTa.value = hostKernel.stickyNoteText || '';
    dndBtn.textContent = hostKernel.settings.notificationsEnabled === false ? '免打扰: 开' : '免打扰: 关';

    clipBox.innerHTML = hostKernel.clipboardHistory.length === 0
      ? '<div style="font-size:11px;color:#64748b;">暂无复制记录</div>'
      : hostKernel.clipboardHistory.slice(0, 8).map((c) => `
        <div class="clip-item">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.text)}</span>
          <button class="os-btn os-btn-xs act-use-clip" data-text="${esc(c.text)}">复制</button>
        </div>
      `).join('');

    notifBox.innerHTML = hostKernel.notifications.length === 0
      ? '<div style="font-size:11px;color:#64748b;">暂无系统通知</div>'
      : hostKernel.notifications.slice(0, 10).map((n) => `
        <div class="notif-item">
          <div style="font-weight:700;display:flex;justify-content:space-between;">
            <span>${esc(n.title)}</span>
            <span style="color:#64748b;font-weight:400;">${esc(n.time)}</span>
          </div>
          <div style="color:#cbd5e1;margin-top:2px;">${esc(n.body)}</div>
        </div>
      `).join('');
  };

  drawerEl.querySelector('.act-close-drawer').onclick = () => drawerEl.classList.remove('open');
  drawerEl.querySelector('.act-cal-prev').onclick = () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1); renderCalendar(); };
  drawerEl.querySelector('.act-cal-next').onclick = () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1); renderCalendar(); };

  drawerEl.querySelector('[data-testid="widget-timer-start"]').onclick = () => {
    const v = Math.max(1, Number(timerInp.value) || 10);
    if (!timerRunning && timerRemaining === timerDuration) timerRemaining = v;
    timerDuration = v;
    if (timerRemaining <= 0) timerRemaining = v;
    timerRunning = true;
    lastTick = performance.now();
  };
  drawerEl.querySelector('[data-testid="widget-timer-pause"]').onclick = () => { timerRunning = false; };
  drawerEl.querySelector('[data-testid="widget-timer-reset"]').onclick = () => {
    timerRunning = false;
    timerDuration = Math.max(1, Number(timerInp.value) || 10);
    timerRemaining = timerDuration;
    timerRemEl.textContent = String(Math.ceil(timerRemaining));
  };
  drawerEl.querySelector('.act-sw-toggle').onclick = () => { swRunning = !swRunning; lastTick = performance.now(); };
  drawerEl.querySelector('.act-sw-reset').onclick = () => { swRunning = false; swElapsedMs = 0; swEl.textContent = '秒表 0.0s'; };

  drawerEl.querySelector('[data-testid="widget-note-save"]').onclick = () => {
    hostKernel.stickyNoteText = noteTa.value;
    hostKernel.pushNotification('便签已保存', '内容已存入数据目录持久化状态', 'widgets');
    renderDynamicLists();
  };

  clipBox.addEventListener('click', (e) => {
    const btn = e.target.closest('.act-use-clip');
    if (btn && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(btn.dataset.text).catch(() => {});
    }
  });

  dndBtn.onclick = () => {
    hostKernel.settings.notificationsEnabled = hostKernel.settings.notificationsEnabled === false;
    renderDynamicLists();
  };
  drawerEl.querySelector('.act-clear-notif').onclick = () => {
    hostKernel.notifications = [];
    renderDynamicLists();
  };

  drawerEl.addEventListener('click', (e) => {
    const scBtn = e.target.closest('.act-qs-scale');
    if (scBtn) {
      hostKernel.settings.uiScale = Number(scBtn.dataset.val);
      onSettingsChange?.();
    }
    const acBtn = e.target.closest('.act-qs-accent');
    if (acBtn) {
      hostKernel.settings.accentColor = acBtn.dataset.val;
      onSettingsChange?.();
    }
  });

  const intervalId = setInterval(() => {
    const now = performance.now();
    const dtSec = (now - lastTick) / 1000;
    lastTick = now;

    clockEl.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    if (timerRunning) {
      timerRemaining = Math.max(0, timerRemaining - dtSec);
      timerRemEl.textContent = String(Math.ceil(timerRemaining));
      if (timerRemaining <= 0) {
        timerRunning = false;
        if (hostKernel.settings.notificationsEnabled !== false) {
          hostKernel.pushNotification('倒计时完成', `${timerDuration} 秒计时已结束`, 'timer');
        }
        renderDynamicLists();
      }
    }
    if (swRunning) {
      swElapsedMs += dtSec * 1000;
      swEl.textContent = `秒表 ${(swElapsedMs / 1000).toFixed(1)}s`;
    }
  }, 200);

  const offNotif = hostKernel.on('notification', renderDynamicLists);
  const offClip = hostKernel.on('clipboard', renderDynamicLists);

  renderCalendar();
  renderDynamicLists();

  return {
    refresh: () => renderDynamicLists(),
    destroy: () => {
      clearInterval(intervalId);
      offNotif();
      offClip();
    }
  };
}
