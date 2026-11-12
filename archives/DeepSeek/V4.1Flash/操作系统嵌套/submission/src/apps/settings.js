import { appIcon, uiIcon } from '../ui/icons.js';
import { WALLPAPERS } from '../ui/wallpaper.js';
import { el, $s, $all, esc } from '../ui/common.js';

export const meta = {
  title: '设置', desc: '名称、壁纸、强调色与界面缩放', width: 860, height: 600,
  minW: 620, minH: 400, rootOnly: true,
};

const ACCENTS = [
  ['#a78bfa', '紫罗兰'], ['#fbbf24', '琥珀'], ['#5eead4', '青碧'],
  ['#fb7185', '绯红'], ['#60a5fa', '星蓝'], ['#c084fc', '霓虹'],
];
const SCALES = [0.9, 1, 1.15, 1.3];

export function mount(ctx) {
  const { sys, os, shell, body } = ctx;
  let info = null;
  window.nestHost?.info().then((i) => { info = i; renderInfo(); }).catch(() => {});

  body.innerHTML = `<div class="settings-app">
    <aside class="settings-nav">
      <div class="settings-brand">${appIcon('settings', { size: 36 })}<div><b>系统设置</b><span>NESTED OS 1.0</span></div></div>
      <button type="button" class="settings-nav-item active" data-settings-tab="appearance">${uiIcon('widgets')} 个性化</button>
      <button type="button" class="settings-nav-item" data-settings-tab="about">${uiIcon('info')} 关于本系统</button>
      <div class="settings-nav-foot">根系统设置会保存到数据目录<br><span class="mono">outer</span></div>
    </aside>
    <main class="settings-main">
      <section class="settings-page" data-page="appearance">
        <div class="settings-page-head"><div><h1>个性化</h1><p>壁纸、强调色和界面缩放会立即应用到根桌面，并随数据目录保存。</p></div>
          <span class="settings-live"><i></i> 实时预览</span>
        </div>
        <div class="settings-card">
          <div class="settings-card-head"><div><h2>系统名称</h2><p>显示在开始菜单、任务栏和系统徽标中。</p></div></div>
          <div class="settings-name-row">
            <input class="text-input" data-setting-name value="${esc(sys.settings.name || 'NESTED 根系统')}" aria-label="系统名称">
            <button type="button" class="small-button" data-apply-name>应用</button>
          </div>
        </div>
        <div class="settings-card">
          <div class="settings-card-head"><div><h2>壁纸</h2><p>随项目交付的三张原创风景壁纸。</p></div><span class="mono muted">${Object.keys(WALLPAPERS).length} 张</span></div>
          <div class="wallpaper-grid">
            ${Object.entries(WALLPAPERS).map(([id, w]) => `<button type="button" class="wallpaper-option ${sys.settings.wallpaper === id ? 'selected' : ''}" data-testid="settings-wallpaper" data-value="${id}" data-wallpaper-choice="${id}">
              <span class="wallpaper-thumb">${w.svg()}</span>
              <span class="wallpaper-name">${esc(w.name)}${sys.settings.wallpaper === id ? '<i>当前</i>' : ''}</span>
            </button>`).join('')}
          </div>
        </div>
        <div class="settings-grid-2">
          <div class="settings-card">
            <div class="settings-card-head"><div><h2>强调色</h2><p>影响窗口焦点、任务栏和控件。</p></div></div>
            <div class="accent-row">
              ${ACCENTS.map(([c, name]) => `<button type="button" class="accent-swatch ${sys.settings.accent === c ? 'selected' : ''}" data-testid="settings-accent" data-value="${c}" data-accent="${c}" title="${name}" style="--sw:${c}"><span></span></button>`).join('')}
            </div>
            <div class="accent-caption">当前 <b class="mono" data-accent-current>${esc(sys.settings.accent)}</b></div>
          </div>
          <div class="settings-card">
            <div class="settings-card-head"><div><h2>界面缩放</h2><p>缩放后输入命中、窗口拖动和嵌套显示仍保持正确。</p></div></div>
            <div class="scale-options">
              ${SCALES.map((s) => `<button type="button" class="scale-option ${Number(sys.settings.scale) === s ? 'selected' : ''}" data-testid="settings-scale" data-value="${s}" data-scale="${s}">${Math.round(s * 100)}%</button>`).join('')}
            </div>
            <div class="scale-note">当前缩放 <b data-scale-current>${Math.round((sys.settings.scale || 1) * 100)}%</b> · 根 UI 逻辑尺寸按比例换算</div>
          </div>
        </div>
        <div class="settings-card subtle-card">
          <div class="settings-card-head"><div><h2>快捷设置同步</h2><p>夜间、网络、蓝牙与免打扰在开始菜单、小组件和设置间共用同一份状态。</p></div></div>
          <div class="sync-toggles">
            <label class="switch-row"><span>${uiIcon('moon')} 夜间模式</span><input type="checkbox" data-sync-toggle="night" ${os.rootState.widgets.night ? 'checked' : ''}><i class="switch"></i></label>
            <label class="switch-row"><span>${uiIcon('bell')} 免打扰</span><input type="checkbox" data-sync-toggle="dnd" ${os.rootState.widgets.dnd ? 'checked' : ''}><i class="switch"></i></label>
          </div>
        </div>
      </section>
      <section class="settings-page hidden" data-page="about">
        <div class="settings-page-head"><div><h1>关于本系统</h1><p>根系统由宿主直接实现；其下每一级都由父系统中的内核程序运行。</p></div></div>
        <div class="about-hero">
          <div class="about-mark">${'<span></span>'.repeat(3)}</div>
          <div><h2>NESTED OS</h2><p>可递归嵌套的图形操作系统 / 1.0</p></div>
        </div>
        <div class="settings-card" id="settings-info">
          <div class="settings-card-head"><div><h2>运行信息</h2><p>数据目录相互独立，不写回源码目录。</p></div></div>
          <div class="info-grid"><span>系统标识</span><b>outer</b><span>系统名称</span><b>${esc(sys.settings.name)}</b><span>虚拟时钟</span><b>${sys.clock.toFixed(2)} s</b><span>总预算</span><b>${sys.totalBudget.toLocaleString()} / 逻辑步</b><span>内存配额</span><b>${sys.memoryLimitMB} MB</b><span>存储配额</span><b>${sys.storageLimitMB} MB</b><span>数据目录</span><b class="mono">加载中…</b><span>Electron</span><b class="mono">--</b><span>Chromium</span><b class="mono">--</b></div>
        </div>
        <div class="settings-card"><div class="settings-card-head"><div><h2>系统接口</h2><p>程序格式、内核位置与预算含义可在操作说明中查看。</p></div></div>
          <button type="button" class="primary-button" data-open-help>${uiIcon('help')} 打开操作说明</button>
        </div>
      </section>
    </main>
  </div>`;

  const applyName = () => {
    const name = $s(body, '[data-setting-name]').value.trim() || 'NESTED 根系统';
    sys.settings.name = name;
    sys.displayName = name;
    os.emit('system-updated', sys);
    os.emit('fs-changed', { systemId: sys.id });
    os.scheduleSave?.();
    ctx.toast('系统名称已更新', 'success');
    const startName = shell.getDesktop(sys.id)?.start.querySelector('.start-user b');
    if (startName) startName.textContent = name;
  };
  $s(body, '[data-apply-name]').addEventListener('click', applyName);
  $s(body, '[data-setting-name]').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyName(); });

  for (const opt of $all(body, '[data-wallpaper-choice]')) {
    opt.addEventListener('click', () => {
      sys.settings.wallpaper = opt.dataset.wallpaperChoice;
      os.scheduleSave?.();
      shell.refreshWallpaper(sys.id);
      for (const o of $all(body, '[data-wallpaper-choice]')) o.classList.toggle('selected', o === opt);
      ctx.toast('壁纸已更换', 'success');
    });
  }
  for (const sw of $all(body, '[data-accent]')) {
    sw.addEventListener('click', () => {
      sys.settings.accent = sw.dataset.accent;
      os.scheduleSave?.();
      shell.refreshWallpaper(sys.id);
      for (const o of $all(body, '[data-accent]')) o.classList.toggle('selected', o === sw);
      const cap = $s(body, '[data-accent-current]');
      if (cap) cap.textContent = sys.settings.accent;
      ctx.toast('强调色已应用', 'success');
    });
  }
  for (const s of $all(body, '[data-scale]')) {
    s.addEventListener('click', () => {
      sys.settings.scale = Number(s.dataset.scale);
      os.scheduleSave?.();
      shell.layoutRoot();
      shell.reflowDesktop('outer');
      for (const o of $all(body, '[data-scale]')) o.classList.toggle('selected', o === s);
      const cur = $s(body, '[data-scale-current]');
      if (cur) cur.textContent = Math.round(sys.settings.scale * 100) + '%';
      ctx.toast('界面缩放已调整，点击与拖动仍然准确', 'success');
    });
  }
  for (const input of $all(body, '[data-sync-toggle]')) {
    input.addEventListener('change', () => {
      const key = input.dataset.syncToggle;
      if (key === 'dnd') os.rootState.widgets.dnd = input.checked;
      else os.rootState.widgets.quick[key] = input.checked;
      document.documentElement.classList.toggle('night-mode', !!os.rootState.widgets.quick.night);
      os.scheduleSave?.();
    });
  }
  for (const tab of $all(body, '[data-settings-tab]')) {
    tab.addEventListener('click', () => {
      const id = tab.dataset.settingsTab;
      for (const t of $all(body, '[data-settings-tab]')) t.classList.toggle('active', t === tab);
      for (const p of $all(body, '[data-page]')) p.classList.toggle('hidden', p.dataset.page !== id);
    });
  }
  $s(body, '[data-open-help]')?.addEventListener('click', () => ctx.openApp('help'));

  function renderInfo() {
    const grid = $s(body, '#settings-info .info-grid');
    if (!grid) return;
    grid.innerHTML = `<span>系统标识</span><b>outer</b>
      <span>系统名称</span><b>${esc(sys.settings.name)}</b>
      <span>虚拟时钟</span><b>${sys.clock.toFixed(2)} s</b>
      <span>总预算</span><b>${sys.totalBudget.toLocaleString()} / 逻辑步</b>
      <span>内存配额</span><b>${sys.memoryLimitMB} MB</b>
      <span>存储配额</span><b>${sys.storageLimitMB} MB</b>
      <span>数据目录</span><b class="mono">${esc(info?.dataDir || '独立数据目录')}</b>
      <span>Electron</span><b class="mono">${esc(info?.electron || '-')}</b>
      <span>Chromium</span><b class="mono">${esc(info?.chrome || '-')}</b>`;
  }

  return {
    destroy() {},
    inspect() { return { title: '设置' }; },
  };
}
