// 桌面小组件: 时钟日历 / 倒计时秒表 / 便笺 / 剪贴板历史 / 通知中心 / 快捷设置
import { el, fmtDate, fmtClock, escapeHtml } from '../core/util.js';
import { applySettings } from './settings.js';

export function launchWidgets(ctx, tab = 'clock') {
  const { wm, shell, settings, saveSettings, bus, fs } = ctx;
  let win = wm.list().find(w => w.appId === 'widgets');
  if (win) {
    wm.focus(win.id);
    win.switchTab && win.switchTab(tab);
    return win;
  }

  // 便笺持久化
  let notes = settings.notes || [];
  let calMonth = new Date();

  win = wm.create({
    appId: 'widgets',
    title: '小组件',
    icon: '🧩',
    x: 200, y: 100, w: 720, h: 520,
    minWidth: 520, minHeight: 380,
    bodyBuilder(body) {
      body.innerHTML = `
        <div class="widgets-app">
          <div class="widget-tabs">
            <div class="t active" data-tab="clock">🕐 时钟日历</div>
            <div class="t" data-tab="timer">⏱ 倒计时秒表</div>
            <div class="t" data-tab="notes">🗒 便笺</div>
            <div class="t" data-tab="clipboard">📋 剪贴板历史</div>
            <div class="t" data-tab="notifications">🔔 通知中心</div>
            <div class="t" data-tab="quick">⚡ 快捷设置</div>
          </div>
          <div class="widget-main"></div>
        </div>`;
      const main = body.querySelector('.widget-main');

      const switchTab = (t) => {
        body.querySelectorAll('.widget-tabs .t').forEach(d =>
          d.classList.toggle('active', d.dataset.tab === t));
        if (t === 'clock') renderClock();
        else if (t === 'timer') renderTimer();
        else if (t === 'notes') renderNotes();
        else if (t === 'clipboard') renderClipboard();
        else if (t === 'notifications') renderNotifications();
        else if (t === 'quick') renderQuick();
      };
      win.switchTab = switchTab;
      body.querySelectorAll('.widget-tabs .t').forEach(d =>
        d.addEventListener('click', () => switchTab(d.dataset.tab)));

      // ===== 时钟日历 =====
      let clockTimer = null;
      function renderClock() {
        clearInterval(clockTimer);
        main.innerHTML = `
          <div class="widget-card">
            <div class="big-time" data-testid="widget-clock-time">--:--:--</div>
            <div class="big-date" data-testid="widget-clock-date">----</div>
          </div>
          <div class="widget-card" style="margin-top:12px;">
            <div class="row" style="justify-content:space-between;">
              <h3 data-testid="widget-cal-title" style="margin:0;">日历</h3>
              <div class="row">
                <button data-testid="widget-cal-prev">◀</button>
                <button data-testid="widget-cal-today">今天</button>
                <button data-testid="widget-cal-next">▶</button>
              </div>
            </div>
            <div class="cal-head"><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div></div>
            <div class="cal-grid" data-testid="widget-calendar"></div>
          </div>`;
        const tick = () => {
          const d = new Date();
          const t = main.querySelector('[data-testid="widget-clock-time"]');
          const dd = main.querySelector('[data-testid="widget-clock-date"]');
          if (!t) return;
          t.textContent = fmtClock(d) + ':' + String(d.getSeconds()).padStart(2, '0');
          const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
          dd.textContent = `${fmtDate(d)} 星期${week}`;
        };
        tick();
        clockTimer = setInterval(tick, 250);

        function renderCal() {
          const y = calMonth.getFullYear(), m = calMonth.getMonth();
          main.querySelector('[data-testid="widget-cal-title"]').textContent = `${y} 年 ${m + 1} 月`;
          const grid = main.querySelector('[data-testid="widget-calendar"]');
          grid.innerHTML = '';
          const first = new Date(y, m, 1);
          const startDay = (first.getDay() + 6) % 7; // 周一为0
          const days = new Date(y, m + 1, 0).getDate();
          const prevDays = new Date(y, m, 0).getDate();
          const today = new Date();
          for (let i = 0; i < 42; i++) {
            const dayNum = i - startDay + 1;
            let label, dim = false, dateObj;
            if (dayNum < 1) { label = prevDays + dayNum; dim = true; dateObj = new Date(y, m - 1, label); }
            else if (dayNum > days) { label = dayNum - days; dim = true; dateObj = new Date(y, m + 1, label); }
            else { label = dayNum; dateObj = new Date(y, m, dayNum); }
            const isToday = dateObj.toDateString() === today.toDateString();
            const c = el('div', {
              class: 'cal-cell' + (dim ? ' dim' : '') + (isToday ? ' today' : ''),
              'data-testid': 'widget-cal-cell',
              'data-value': fmtDate(dateObj),
              text: String(label),
            });
            c.addEventListener('click', () => {
              shell.notify('日期', fmtDate(dateObj) + ' 星期' + ['日','一','二','三','四','五','六'][dateObj.getDay()]);
            });
            grid.appendChild(c);
          }
        }
        renderCal();
        main.querySelector('[data-testid="widget-cal-prev"]').addEventListener('click', () => {
          calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
          renderCal();
        });
        main.querySelector('[data-testid="widget-cal-next"]').addEventListener('click', () => {
          calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
          renderCal();
        });
        main.querySelector('[data-testid="widget-cal-today"]').addEventListener('click', () => {
          calMonth = new Date();
          renderCal();
        });
      }

      // ===== 倒计时与秒表 =====
      let timerState = { remain: 0, running: false, total: 0, iv: null };
      let swState = { elapsed: 0, running: false, iv: null, laps: [] };
      function renderTimer() {
        main.innerHTML = `
          <div class="widget-card">
            <h3>倒计时</h3>
            <div class="big-time" data-testid="widget-timer-display">00:00:00</div>
            <div class="row" style="margin-top:10px;">
              <input type="number" data-testid="widget-timer-input" placeholder="秒数" value="5"
                     style="width:90px;" />
              <button class="primary" data-testid="widget-timer-start">开始</button>
              <button data-testid="widget-timer-pause">暂停</button>
              <button data-testid="widget-timer-resume">继续</button>
              <button data-testid="widget-timer-reset">重置</button>
            </div>
          </div>
          <div class="widget-card" style="margin-top:12px;">
            <h3>秒表</h3>
            <div class="big-time" data-testid="widget-swatch-display">00:00.00</div>
            <div class="row" style="margin-top:10px;">
              <button class="primary" data-testid="widget-swatch-start">开始</button>
              <button data-testid="widget-swatch-pause">暂停</button>
              <button data-testid="widget-swatch-reset">复位</button>
              <button data-testid="widget-swatch-lap">计次</button>
            </div>
            <div data-testid="widget-swatch-laps" style="margin-top:10px;"></div>
          </div>`;

        const fmtHMS = (ms) => {
          const s = Math.max(0, Math.ceil(ms / 1000));
          const p = (n) => String(n).padStart(2, '0');
          return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
        };
        const fmtSW = (ms) => {
          const p = (n, w = 2) => String(n).padStart(w, '0');
          return `${p(Math.floor(ms / 60000))}:${p(Math.floor(ms / 1000) % 60)}.${p(Math.floor(ms / 10) % 100)}`;
        };
        const tDisp = () => main.querySelector('[data-testid="widget-timer-display"]');
        const sDisp = () => main.querySelector('[data-testid="widget-swatch-display"]');

        function updateTimer() {
          const d = tDisp();
          if (d) d.textContent = fmtHMS(timerState.remain);
        }
        function updateSwatch() {
          const d = sDisp();
          if (d) d.textContent = fmtSW(swState.elapsed);
        }
        if (timerState.iv) clearInterval(timerState.iv);
        timerState.iv = setInterval(() => {
          if (timerState.running) {
            timerState.remain -= 100;
            if (timerState.remain <= 0) {
              timerState.remain = 0;
              timerState.running = false;
              shell.notify('倒计时结束', `倒计时 ${fmtHMS(timerState.total)} 已到时`, 'ok', { kind: 'timer' });
              ctx.systemManager && ctx.systemManager.rootNotify('倒计时结束', `倒计时 ${fmtHMS(timerState.total)} 已到时`);
            }
            updateTimer();
          }
        }, 100);
        if (swState.iv) clearInterval(swState.iv);
        let last = performance.now();
        swState.iv = setInterval(() => {
          const now = performance.now();
          if (swState.running) {
            swState.elapsed += now - last;
            updateSwatch();
          }
          last = now;
        }, 50);

        main.querySelector('[data-testid="widget-timer-start"]').addEventListener('click', () => {
          const v = parseFloat(main.querySelector('[data-testid="widget-timer-input"]').value) || 5;
          timerState.total = v * 1000;
          timerState.remain = v * 1000;
          timerState.running = true;
          updateTimer();
          shell.notify('倒计时开始', `时长 ${v} 秒`, 'info', { kind: 'timer' });
        });
        main.querySelector('[data-testid="widget-timer-pause"]').addEventListener('click', () => {
          timerState.running = false;
        });
        main.querySelector('[data-testid="widget-timer-resume"]').addEventListener('click', () => {
          if (timerState.remain > 0) timerState.running = true;
        });
        main.querySelector('[data-testid="widget-timer-reset"]').addEventListener('click', () => {
          timerState.running = false;
          timerState.remain = 0;
          updateTimer();
        });
        main.querySelector('[data-testid="widget-swatch-start"]').addEventListener('click', () => { swState.running = true; });
        main.querySelector('[data-testid="widget-swatch-pause"]').addEventListener('click', () => { swState.running = false; });
        main.querySelector('[data-testid="widget-swatch-reset"]').addEventListener('click', () => {
          swState.running = false; swState.elapsed = 0; swState.laps = [];
          updateSwatch(); renderLaps();
        });
        main.querySelector('[data-testid="widget-swatch-lap"]').addEventListener('click', () => {
          swState.laps.push(swState.elapsed);
          renderLaps();
        });
        function renderLaps() {
          const c = main.querySelector('[data-testid="widget-swatch-laps"]');
          if (!c) return;
          c.innerHTML = swState.laps.map((l, i) =>
            `<div class="clip-item"><span class="faint">计次 ${i + 1}</span><span class="grow"></span><span>${fmtSW(l)}</span></div>`).join('');
        }
        updateTimer(); updateSwatch(); renderLaps();
      }

      // ===== 便笺 =====
      function renderNotes() {
        main.innerHTML = `
          <div class="row" style="margin-bottom:12px;">
            <h3 style="margin:0;flex:1;">便笺</h3>
            <button class="primary" data-testid="widget-note-new">新建便笺</button>
          </div>
          <textarea data-testid="widget-note-text" placeholder="输入便笺内容…"
            style="width:100%;height:100px;resize:vertical;"></textarea>
          <div class="row" style="margin:8px 0 14px;">
            <button data-testid="widget-note-save">保存便笺</button>
            <span class="muted" data-note-hint style="font-size:12px;"></span>
          </div>
          <div data-testid="widget-notes-list"></div>`;
        const ta = main.querySelector('[data-testid="widget-note-text"]');
        const hint = main.querySelector('[data-note-hint]');
        function renderList() {
          const c = main.querySelector('[data-testid="widget-notes-list"]');
          c.innerHTML = notes.map((n, i) => `
            <div class="note-card" style="margin-bottom:8px;">
              <div class="row">
                <div class="grow" style="white-space:pre-wrap;font-size:12.5px;">${escapeHtml(n.text)}</div>
                <button data-edit="${i}" data-testid="widget-note-edit">编辑</button>
                <button data-del="${i}" data-testid="widget-note-delete">删除</button>
              </div>
              <div class="faint" style="font-size:10px;margin-top:6px;">${new Date(n.time).toLocaleString()}</div>
            </div>`).join('') || '<div class="muted">暂无便笺</div>';
          c.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
            notes.splice(+b.dataset.del, 1);
            settings.notes = notes; saveSettings();
            renderList();
          }));
          c.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
            ta.value = notes[+b.dataset.edit].text;
            notes.splice(+b.dataset.edit, 1);
            settings.notes = notes; saveSettings();
            renderList();
          }));
        }
        renderList();
        main.querySelector('[data-testid="widget-note-new"]').addEventListener('click', () => {
          ta.value = '';
          ta.focus();
        });
        main.querySelector('[data-testid="widget-note-save"]').addEventListener('click', () => {
          const text = ta.value.trim();
          if (!text) { hint.textContent = '内容为空'; return; }
          notes.unshift({ text, time: Date.now() });
          settings.notes = notes; saveSettings();
          ta.value = '';
          hint.textContent = '已保存';
          renderList();
          shell.notify('便笺已保存', text.slice(0, 30), 'ok');
        });
      }

      // ===== 剪贴板历史 =====
      function renderClipboard() {
        const hist = ctx.clipboardHistory || [];
        main.innerHTML = `
          <div class="row" style="margin-bottom:12px;">
            <h3 style="margin:0;flex:1;">剪贴板历史</h3>
            <button data-testid="widget-clipboard-clear">清空</button>
          </div>
          <div data-testid="widget-clipboard-list"></div>`;
        const c = main.querySelector('[data-testid="widget-clipboard-list"]');
        if (!hist.length) {
          c.innerHTML = '<div class="muted">暂无记录。在电子表格中复制选区后会出现在这里。</div>';
        } else {
          c.innerHTML = hist.map((h, i) => `
            <div class="clip-item">
              <div class="grow" style="white-space:pre-wrap;max-height:60px;overflow:hidden;">${escapeHtml(h.text)}</div>
              <button data-copy="${i}" data-testid="widget-clipboard-copy">复制</button>
            </div>`).join('');
          c.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
            const item = hist[+b.dataset.copy];
            try { await navigator.clipboard.writeText(item.text); } catch (e) { /* ignore */ }
            shell.notify('已复制', '已再次复制到剪贴板', 'ok');
          }));
        }
        main.querySelector('[data-testid="widget-clipboard-clear"]').addEventListener('click', () => {
          ctx.clipboardHistory = [];
          renderClipboard();
        });
      }

      // ===== 通知中心 =====
      function renderNotifications() {
        main.innerHTML = `
          <div class="row" style="margin-bottom:12px;">
            <h3 style="margin:0;flex:1;">通知中心</h3>
            <button data-testid="widget-dnd-toggle">${settings.dnd ? '关闭免打扰' : '开启免打扰'}</button>
            <button data-testid="widget-notifications-clear">全部已读</button>
            <button data-testid="widget-notifications-remove">清除全部</button>
          </div>
          <div data-testid="widget-notifications"></div>`;
        const c = main.querySelector('[data-testid="widget-notifications"]');
        const items = shell.notifications;
        if (!items.length) {
          c.innerHTML = '<div class="muted">暂无通知</div>';
        } else {
          c.innerHTML = items.map((n) => `
            <div class="notif-item ${n.kind} ${n.read ? '' : 'unread'}">
              <div class="grow">
                <div style="font-weight:600;font-size:13px;">${escapeHtml(n.title)}</div>
                <div class="muted" style="font-size:12px;margin-top:2px;">${escapeHtml(n.body)}</div>
                <div class="faint" style="font-size:10px;margin-top:4px;">${new Date(n.time).toLocaleTimeString()}</div>
              </div>
            </div>`).join('');
        }
        main.querySelector('[data-testid="widget-dnd-toggle"]').addEventListener('click', () => {
          settings.dnd = !settings.dnd;
          shell.setDnd(settings.dnd);
          saveSettings();
          renderNotifications();
        });
        main.querySelector('[data-testid="widget-notifications-clear"]').addEventListener('click', () => {
          shell.notifications.forEach(n => n.read = true);
          renderNotifications();
        });
        main.querySelector('[data-testid="widget-notifications-remove"]').addEventListener('click', () => {
          shell.notifications.length = 0;
          renderNotifications();
        });
      }

      // ===== 快捷设置 =====
      function renderQuick() {
        main.innerHTML = `
          <div class="widget-card">
            <h3>快捷设置</h3>
            <div class="set-row">
              <div><div class="lbl">免打扰</div><div class="sub">抑制弹出提示</div></div>
              <button data-testid="widget-quick-dnd">${settings.dnd ? '已开启' : '已关闭'}</button>
            </div>
            <div class="set-row">
              <div><div class="lbl">界面缩放</div><div class="sub">${Math.round((settings.scale || 1) * 100)}%</div></div>
              <div class="row">
                <button data-testid="widget-quick-scale-down">−</button>
                <button data-testid="widget-quick-scale-up">＋</button>
              </div>
            </div>
            <div class="set-row">
              <div><div class="lbl">主题</div><div class="sub">深色 / 浅色</div></div>
              <button data-testid="widget-quick-theme">${settings.theme === 'light' ? '浅色' : '深色'}</button>
            </div>
            <div class="set-row" style="border-bottom:none;">
              <div><div class="lbl">强调色</div><div class="sub">点击切换</div></div>
              <button data-testid="widget-quick-accent">切换强调色</button>
            </div>
          </div>`;
        main.querySelector('[data-testid="widget-quick-dnd"]').addEventListener('click', () => {
          settings.dnd = !settings.dnd;
          shell.setDnd(settings.dnd);
          saveSettings();
          renderQuick();
        });
        main.querySelector('[data-testid="widget-quick-scale-up"]').addEventListener('click', () => {
          settings.scale = Math.min(1.5, (settings.scale || 1) + 0.1);
          applySettings(settings); saveSettings(); renderQuick();
        });
        main.querySelector('[data-testid="widget-quick-scale-down"]').addEventListener('click', () => {
          settings.scale = Math.max(0.8, (settings.scale || 1) - 0.1);
          applySettings(settings); saveSettings(); renderQuick();
        });
        main.querySelector('[data-testid="widget-quick-theme"]').addEventListener('click', () => {
          settings.theme = settings.theme === 'light' ? 'dark' : 'light';
          applySettings(settings); saveSettings(); renderQuick();
        });
        main.querySelector('[data-testid="widget-quick-accent"]').addEventListener('click', () => {
          const ids = ['violet', 'azure', 'emerald', 'amber', 'rose', 'coral'];
          const i = ids.indexOf(settings.accent || 'violet');
          settings.accent = ids[(i + 1) % ids.length];
          applySettings(settings); saveSettings(); renderQuick();
        });
      }

      switchTab(tab === 'notifications' ? 'notifications' : tab);
      bus.on('notifications-changed', () => {
        if (body.querySelector('.widget-tabs .t.active')?.dataset.tab === 'notifications') {
          renderNotifications();
        }
      });
      bus.on('clipboard-changed', () => {
        if (body.querySelector('.widget-tabs .t.active')?.dataset.tab === 'clipboard') {
          renderClipboard();
        }
      });
    },
  });
  return win;
}
