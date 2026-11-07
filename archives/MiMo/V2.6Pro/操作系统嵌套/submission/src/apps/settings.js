// 根系统设置: 壁纸 / 强调色 / 缩放 / 主题 / 系统名称
import { el } from '../core/util.js';

const WALLPAPERS = [
  { id: 'dusk-lake', name: '黄昏湖山', url: 'app-assets://assets/wallpaper.png', thumb: 'app-assets://assets/wallpaper.png' },
  { id: 'green-valley', name: '翠绿山谷', url: 'app-assets://assets/wallpapers/green-valley.png', thumb: 'app-assets://assets/wallpapers/green-valley.png' },
  { id: 'star-night', name: '星夜极光', url: 'app-assets://assets/wallpapers/star-night.png', thumb: 'app-assets://assets/wallpapers/star-night.png' },
];

const ACCENTS = [
  { id: 'violet', name: '紫罗兰', color: '#7c5cff' },
  { id: 'azure', name: '天青', color: '#38b6ff' },
  { id: 'emerald', name: '翡翠', color: '#2fbf71' },
  { id: 'amber', name: '琥珀', color: '#ffb020' },
  { id: 'rose', name: '玫红', color: '#ff5d8f' },
  { id: 'coral', name: '珊瑚', color: '#ff7a5c' },
];

export function applySettings(s) {
  const root = document.documentElement;
  const accent = ACCENTS.find(a => a.id === s.accent) || ACCENTS[0];
  root.style.setProperty('--accent', accent.color);
  root.style.setProperty('--accent-soft', hexA(accent.color, 0.22));
  root.style.setProperty('--ui-scale', String(s.scale || 1));
  document.body.style.zoom = s.scale || 1;
  const wp = WALLPAPERS.find(w => w.id === s.wallpaper) || WALLPAPERS[0];
  const wall = document.getElementById('wallpaper');
  if (wall) wall.style.backgroundImage = `url("${wp.url}")`;
  if (s.theme === 'light') {
    root.style.setProperty('--glass-strong', 'rgba(240, 244, 255, 0.94)');
    root.style.setProperty('--glass', 'rgba(230, 236, 255, 0.82)');
    root.style.setProperty('--glass-soft', 'rgba(236, 240, 255, 0.7)');
    root.style.setProperty('--text', '#1a2140');
    root.style.setProperty('--text-dim', '#4a5578');
  } else {
    root.style.setProperty('--glass-strong', 'rgba(16, 22, 46, 0.94)');
    root.style.setProperty('--glass', 'rgba(20, 26, 52, 0.78)');
    root.style.setProperty('--glass-soft', 'rgba(28, 36, 68, 0.62)');
    root.style.setProperty('--text', '#e9edff');
    root.style.setProperty('--text-dim', '#9ba6cf');
  }
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function launchSettings(ctx) {
  const { wm, shell, settings, saveSettings } = ctx;
  // 复用已有窗口
  const exist = wm.list().find(w => w.appId === 'settings');
  if (exist) { wm.focus(exist.id); return; }

  wm.create({
    appId: 'settings',
    title: '设置',
    icon: '⚙',
    x: 160, y: 90, w: 780, h: 540,
    minWidth: 560, minHeight: 380,
    bodyBuilder(body) {
      body.innerHTML = `
        <div class="settings-app">
          <div class="settings-side">
            <div class="s-item active" data-tab="personal">个性化</div>
            <div class="s-item" data-tab="system">系统</div>
            <div class="s-item" data-tab="about">关于</div>
          </div>
          <div class="settings-main" data-testid="settings-main"></div>
        </div>`;
      const main = body.querySelector('.settings-main');
      const renderTab = (tab) => {
        body.querySelectorAll('.s-item').forEach(d =>
          d.classList.toggle('active', d.dataset.tab === tab));
        if (tab === 'personal') renderPersonal(main);
        else if (tab === 'system') renderSystem(main);
        else renderAbout(main);
      };
      body.querySelectorAll('.s-item').forEach(d =>
        d.addEventListener('click', () => renderTab(d.dataset.tab)));
      renderTab('personal');

      function renderPersonal(main) {
        main.innerHTML = `
          <h2>个性化</h2>
          <div class="desc">壁纸、强调色与外观会实际应用到根系统桌面并保留。</div>
          <div class="set-row" style="flex-direction:column;align-items:stretch;">
            <div><div class="lbl">壁纸</div><div class="sub">根系统桌面背景图片</div></div>
            <div class="wallpaper-grid" data-testid="settings-wallpaper"></div>
          </div>
          <div class="set-row">
            <div><div class="lbl">强调色</div><div class="sub">按钮、选中态与高亮颜色</div></div>
            <div class="accent-grid" data-testid="settings-accent"></div>
          </div>
          <div class="set-row">
            <div><div class="lbl">主题</div><div class="sub">深色 / 浅色外观</div></div>
            <select data-testid="settings-theme">
              <option value="dark">深色</option>
              <option value="light">浅色</option>
            </select>
          </div>`;
        const wg = main.querySelector('.wallpaper-grid');
        for (const wp of WALLPAPERS) {
          const d = el('div', {
            class: 'wallpaper-item' + (settings.wallpaper === wp.id ? ' selected' : ''),
            'data-testid': 'settings-wallpaper',
            'data-value': wp.id,
            title: wp.name,
          });
          d.style.backgroundImage = `url("${wp.thumb}")`;
          d.addEventListener('click', () => {
            settings.wallpaper = wp.id;
            applySettings(settings); saveSettings();
            renderPersonal(main);
          });
          wg.appendChild(d);
        }
        const ag = main.querySelector('.accent-grid');
        for (const a of ACCENTS) {
          const d = el('div', {
            class: 'accent-dot' + (settings.accent === a.id ? ' selected' : ''),
            'data-testid': 'settings-accent',
            'data-value': a.id,
            title: a.name,
          });
          d.style.background = a.color;
          d.addEventListener('click', () => {
            settings.accent = a.id;
            applySettings(settings); saveSettings();
            renderPersonal(main);
          });
          ag.appendChild(d);
        }
        const themeSel = main.querySelector('[data-testid="settings-theme"]');
        themeSel.value = settings.theme || 'dark';
        themeSel.addEventListener('change', () => {
          settings.theme = themeSel.value;
          applySettings(settings); saveSettings();
        });
      }

      function renderSystem(main) {
        main.innerHTML = `
          <h2>系统</h2>
          <div class="desc">名称、界面缩放与通知设置。</div>
          <div class="set-row">
            <div><div class="lbl">系统名称</div><div class="sub">显示在任务栏与关于页</div></div>
            <input id="set-sysname" data-testid="settings-sysname" style="width:200px;" />
          </div>
          <div class="set-row">
            <div><div class="lbl">界面缩放</div><div class="sub">调整整个桌面的显示比例,输入命中保持正确</div></div>
            <div class="row">
              <input type="range" min="0.8" max="1.5" step="0.1" value="${settings.scale || 1}"
                     data-testid="settings-scale" data-value="${settings.scale || 1}" style="width:160px;" />
              <span class="muted" data-scale-label>${Math.round((settings.scale || 1) * 100)}%</span>
            </div>
          </div>
          <div class="set-row">
            <div><div class="lbl">免打扰</div><div class="sub">抑制弹出提示,通知仍会记录</div></div>
            <button data-testid="settings-dnd">${settings.dnd ? '已开启' : '已关闭'}</button>
          </div>
          <div class="set-row">
            <div><div class="lbl">恢复默认</div><div class="sub">重置壁纸、强调色与缩放</div></div>
            <button data-testid="settings-reset">恢复默认设置</button>
          </div>`;
        const name = main.querySelector('#set-sysname');
        name.value = settings.name || 'Nested OS';
        name.addEventListener('change', () => {
          settings.name = name.value || 'Nested OS';
          saveSettings();
          shell.systemName = settings.name;
          ctx.bus.emit('settings-changed');
        });
        const scale = main.querySelector('[data-testid="settings-scale"]');
        const lbl = main.querySelector('[data-scale-label]');
        scale.addEventListener('input', () => {
          const v = parseFloat(scale.value);
          scale.dataset.value = String(v);
          lbl.textContent = Math.round(v * 100) + '%';
          settings.scale = v;
          applySettings(settings);
        });
        scale.addEventListener('change', () => saveSettings());
        main.querySelector('[data-testid="settings-dnd"]').addEventListener('click', (e) => {
          settings.dnd = !settings.dnd;
          e.target.textContent = settings.dnd ? '已开启' : '已关闭';
          shell.setDnd(settings.dnd);
          saveSettings();
        });
        main.querySelector('[data-testid="settings-reset"]').addEventListener('click', () => {
          Object.assign(settings, { wallpaper: 'dusk-lake', accent: 'violet', scale: 1, theme: 'dark' });
          applySettings(settings); saveSettings();
          renderSystem(main);
          ctx.shell.notify('设置已重置', '已恢复默认外观设置', 'ok');
        });
      }

      function renderAbout(main) {
        main.innerHTML = `
          <h2>关于</h2>
          <div class="desc">嵌套图形操作系统 · Nested OS</div>
          <div class="panel" style="max-width:520px;">
            <h3>系统信息</h3>
            <div class="col" style="gap:6px;font-size:13px;">
              <div class="row"><span class="muted" style="width:110px;">系统名称</span><span>${settings.name || 'Nested OS'}</span></div>
              <div class="row"><span class="muted" style="width:110px;">根系统标识</span><span>outer</span></div>
              <div class="row"><span class="muted" style="width:110px;">承载环境</span><span>Electron / Chromium</span></div>
              <div class="row"><span class="muted" style="width:110px;">三维绘制</span><span>WebGL 2 (Three.js)</span></div>
              <div class="row"><span class="muted" style="width:110px;">程序格式</span><span>KS (KernelScript)</span></div>
            </div>
          </div>
          <div class="panel" style="max-width:520px;margin-top:12px;">
            <h3>嵌套系统树</h3>
            <p class="muted" style="font-size:12.5px;line-height:1.7;">
              根系统桌面可创建任意层级子系统。每个子系统由父系统文件系统中的内核程序运行,
              调度、消息、文件与窗口管理均为系统内程序。子系统桌面完整嵌套在父系统窗口中。
            </p>
            <button class="primary" data-testid="settings-open-sysman">打开系统管理</button>
          </div>`;
        main.querySelector('[data-testid="settings-open-sysman"]').addEventListener('click', () => {
          ctx.bus.emit('open-sysman');
        });
      }
    },
  });
}

export { WALLPAPERS, ACCENTS };
