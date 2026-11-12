// 设置：系统名称、壁纸、强调色、界面缩放、免打扰（与快捷设置同一份状态，保存在 /System/settings.json）
import { h, clear, icon } from '../ui/dom.js';
import { WALLPAPERS, ACCENTS, SCALES } from '../ui/desktop.js';

export default {
  id: 'settings', name: '设置', icon: 'settings', single: true, w: 720, h: 560, keywords: 'settings 设置 壁纸 缩放 颜色',
  create(ctx) {
    const { desktop, win } = ctx;
    const ds = { 'data-system-id': 'outer', 'data-window-id': win.id };
    const body = h('div', { class: 'st-body scroll' });
    const el = h('div', { class: 'settings' }, body);
    function section(title, desc, ...kids) { return h('div', { class: 'st-sec' }, h('div', { class: 'st-title', text: title }), desc ? h('div', { class: 'st-desc', text: desc }) : null, ...kids); }
    function render() {
      const s = desktop.settings;
      clear(body);
      const name = h('input', { class: 'inp', value: s.name, tid: 'settings-name', ...ds, 'aria-label': '系统名称', style: { width: '260px' } });
      const saveName = h('button', { class: 'btn', text: '应用' });
      saveName.onclick = () => { desktop.setSetting('name', name.value.trim() || '根系统'); desktop.notify({ title: '系统名称已更新', body: name.value, level: 'ok' }); };
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName.click(); });
      body.append(section('系统名称', '显示在开始菜单、任务栏与系统树中。', h('div', { class: 'st-row' }, name, saveName)));
      const wps = h('div', { class: 'st-wps', role: 'radiogroup', 'aria-label': '壁纸' });
      for (const w of WALLPAPERS) {
        const b = h('button', { class: 'st-wp' + (s.wallpaper === w.id ? ' on' : ''), tid: 'settings-wallpaper', 'data-value': w.id, ...ds, 'aria-label': '壁纸 ' + w.name, role: 'radio', 'aria-checked': String(s.wallpaper === w.id) },
          h('div', { class: 'st-wp-img', style: { backgroundImage: `url("app://local/${w.file}")` } }), h('span', { text: w.name }));
        b.onclick = () => { desktop.setSetting('wallpaper', w.id); render(); };
        wps.append(b);
      }
      body.append(section('壁纸', '根系统壁纸是随项目交付的自制风景图。', wps));
      const accs = h('div', { class: 'st-accs', role: 'radiogroup', 'aria-label': '强调色' });
      for (const a of ACCENTS) {
        const b = h('button', { class: 'st-acc' + (s.accent === a.id ? ' on' : ''), tid: 'settings-accent', 'data-value': a.id, ...ds, 'aria-label': '强调色 ' + a.name, title: a.name, role: 'radio', 'aria-checked': String(s.accent === a.id), style: { '--sw': a.c } }, h('i'), h('span', { text: a.name }));
        b.onclick = () => { desktop.setSetting('accent', a.id); render(); };
        accs.append(b);
      }
      body.append(section('强调色', '用于焦点、选中、按钮与任务栏。', accs));
      const scs = h('div', { class: 'st-scales', role: 'radiogroup', 'aria-label': '界面缩放' });
      for (const v of SCALES) {
        const b = h('button', { class: 'btn' + (s.scale === v ? ' primary' : ''), tid: 'settings-scale', 'data-value': String(v), ...ds, 'aria-label': `界面缩放 ${v}%`, role: 'radio', 'aria-checked': String(s.scale === v), text: v + '%' });
        b.onclick = () => { desktop.setSetting('scale', v); render(); };
        scs.append(b);
      }
      body.append(section('界面缩放', '缩放整个根系统桌面（含各层子系统窗口）；缩放后指针命中与窗口操作仍按实际位置。', scs));
      const dnd = h('label', { class: 'st-row' }, h('input', { type: 'checkbox', checked: s.dnd, tid: 'settings-dnd', ...ds, onchange: (e) => desktop.setSetting('dnd', e.target.checked) }), h('span', { text: '免打扰：不弹出通知横幅（仍记录到通知中心）' }));
      body.append(section('通知', null, dnd));
      body.append(section('关于', null, h('div', { class: 'st-desc', html: `Nested OS · 根系统由宿主实现，子系统的内核、窗口管理与应用都是 Nest 程序。<br>数据目录与运行信息见任务管理器；完整说明见“操作说明”。` })));
    }
    render();
    const off = desktop.on('settings', () => render());
    return { el, dispose() { off(); } };
  },
};
