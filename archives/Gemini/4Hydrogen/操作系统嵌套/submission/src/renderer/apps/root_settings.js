// Root System Settings (System Name, Custom Wallpapers, Accent Color, UI Scale)
import { WALLPAPERS } from '../assets/wallpaper.js';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ACCENTS = [
  { id: '#38bdf8', name: '天空蓝' },
  { id: '#a855f7', name: '霓虹紫' },
  { id: '#22c55e', name: '翡翠绿' },
  { id: '#f59e0b', name: '琥珀金' },
  { id: '#f43f5e', name: '珊瑚红' }
];

const SCALES = [0.85, 1, 1.15, 1.25];

export function mountRootSettings({ container, win, hostKernel, onSettingsChange }) {
  const render = () => {
    const s = hostKernel.settings;
    container.innerHTML = `
      <div class="settings-root">
        <div class="settings-group">
          <div class="settings-title">系统名称与个性化标识</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input class="os-inp flex-1 sys-name-inp" value="${esc(s.systemName)}" />
            <button class="os-btn os-btn-accent act-save-name">应用名称</button>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-title">桌面壁纸 (自制矢量风光)</div>
          <div class="swatch-grid">
            ${WALLPAPERS.map((wp) => `
              <button class="wallpaper-opt ${s.wallpaper === wp.id ? 'active' : ''}"
                      data-testid="settings-wallpaper"
                      data-system-id="outer"
                      data-window-id="${esc(win.id)}"
                      data-value="${esc(wp.id)}">
                <div class="wp-preview" style="background:${wp.previewColor};"></div>
                <span>${esc(wp.name)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-title">主题强调色</div>
          <div class="swatch-grid">
            ${ACCENTS.map((ac) => `
              <button class="accent-opt ${s.accentColor === ac.id ? 'active' : ''}"
                      data-testid="settings-accent"
                      data-system-id="outer"
                      data-window-id="${esc(win.id)}"
                      data-value="${ac.id}">
                <span class="accent-dot" style="background:${ac.id};"></span>
                <span>${esc(ac.name)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-title">界面全局缩放</div>
          <div class="swatch-grid">
            ${SCALES.map((sc) => `
              <button class="scale-opt ${Math.abs((s.uiScale || 1) - sc) < 0.01 ? 'active' : ''}"
                      data-testid="settings-scale"
                      data-system-id="outer"
                      data-window-id="${esc(win.id)}"
                      data-value="${sc}">${Math.round(sc * 100)}%</button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.querySelector('.act-save-name').onclick = () => {
      const v = container.querySelector('.sys-name-inp').value.trim();
      if (v) {
        hostKernel.settings.systemName = v;
        onSettingsChange?.();
      }
    };
  };

  container.addEventListener('click', (e) => {
    const wpBtn = e.target.closest('[data-testid="settings-wallpaper"]');
    if (wpBtn) {
      hostKernel.settings.wallpaper = wpBtn.dataset.value;
      onSettingsChange?.();
      render();
      return;
    }
    const acBtn = e.target.closest('[data-testid="settings-accent"]');
    if (acBtn) {
      hostKernel.settings.accentColor = acBtn.dataset.value;
      onSettingsChange?.();
      render();
      return;
    }
    const scBtn = e.target.closest('[data-testid="settings-scale"]');
    if (scBtn) {
      hostKernel.settings.uiScale = Number(scBtn.dataset.value);
      onSettingsChange?.();
      render();
    }
  });

  render();
  return { destroy: () => {} };
}
