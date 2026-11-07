// 设置：壁纸、强调色、界面缩放、系统名称与免打扰
import { el, clamp } from '../../util.js';
import { WALLPAPERS, ACCENTS, wallpaperCss } from '../../wallpapers.js';
import { changed } from '../../model.js';
import { appIcon, ui as glyph } from '../../icons.js';

export function mount(ctx) {
  const { sys, body, view } = ctx;
  const root = el('div', { class: 'settings' });
  const side = el('div', { class: 'settings-side' });
  const main = el('div', { class: 'settings-main' });
  root.append(side, main);
  body.append(root);
  const navs = [['外观', 'settings-wallpaper'], ['桌面', 'settings-scale'], ['系统', 'settings-name']];
  let active = '外观';
  const navEls = {};
  for (const [n] of navs) {
    const b = el('div', { class: 'settings-nav' + (n === active ? ' active' : ''), text: n });
    b.addEventListener('click', () => { active = n; for (const [k, x] of Object.entries(navEls)) x.classList.toggle('active', k === n); render(); });
    navEls[n] = b; side.append(b);
  }
  side.append(el('div', { style: { flex: 1 } }));
  side.append(el('div', { class: 'settings-nav', style: { fontSize: '10px', opacity: '.6' }, text: 'Nested OS v1.0' }));
  function apply(changes) {
    Object.assign(sys.settings, changes);
    sys.name = sys.settings.name;
    changed('settings');
    render();
    if (sys.isRoot) sys.widgets.dnd = sys.settings.dnd;
  }
  function render() {
    main.innerHTML = '';
    const s = sys.settings;
    main.append(el('h2', { text: active }), el('div', { class: 'sub', text: active === '外观' ? '壁纸、强调色与连续的设计语言' : active === '桌面' ? '界面缩放会同步影响文字、图标和窗口操作' : '系统身份、通知与设备' }));
    if (active === '外观') {
      main.append(el('div', { class: 'set-row', style: { alignItems: 'flex-start' } },
        el('div', { class: 'sr-label' }, el('div', { text: '壁纸' }), el('div', { class: 'sr-desc', text: '自绘风景壁纸随项目交付' })),
        el('div', { class: 'wp-grid', dataset: { testid: 'settings-wallpaper' } },
          ...Object.entries(WALLPAPERS).map(([key, wp]) => {
            const opt = el('button', {
              class: 'wp-opt' + (s.wallpaper === key ? ' active' : ''), title: wp.name,
              dataset: { value: key, testid: 'settings-wallpaper-option' },
              style: { backgroundImage: wp.css }
            }, el('span', { text: wp.name }));
            opt.addEventListener('click', () => apply({ wallpaper: key }));
            return opt;
          }))
      ));
      main.append(el('div', { class: 'set-row' },
        el('div', { class: 'sr-label' }, el('div', { text: '强调色' }), el('div', { class: 'sr-desc', text: '影响窗口、高亮和桌面光晕' })),
        el('div', { class: 'accent-row', dataset: { testid: 'settings-accent' } },
          ...ACCENTS.map(a => {
            const d = el('button', { class: 'accent-dot' + (s.accent === a.value ? ' active' : ''), title: a.name, dataset: { value: a.value, testid: 'settings-accent-option' }, style: { background: a.value } });
            d.addEventListener('click', () => apply({ accent: a.value }));
            return d;
          }))
      ));
      main.append(el('div', { class: 'set-row' },
        el('div', { class: 'sr-label', text: '界面缩放' }),
        el('div', { class: 'scale-opts', dataset: { testid: 'settings-scale' } },
          ...[[0.9, '小'], [1, '标准'], [1.15, '大'], [1.3, '特大']].map(([v, label]) => {
            const b = el('button', { class: 'scale-opt' + (Math.abs(s.scale - v) < 0.01 ? ' active' : ''), text: label + ' ' + Math.round(v * 100) + '%', dataset: { value: String(v) } });
            b.addEventListener('click', () => apply({ scale: v }));
            return b;
          }))
      ));
    } else if (active === '桌面') {
      main.append(el('div', { class: 'set-row' },
        el('div', { class: 'sr-label', text: '界面缩放' }),
        el('div', { class: 'scale-opts', dataset: { testid: 'settings-scale' } },
          ...[[0.9, '小'], [1, '标准'], [1.15, '大'], [1.3, '特大']].map(([v, label]) => {
            const b = el('button', { class: 'scale-opt' + (Math.abs(s.scale - v) < 0.01 ? ' active' : ''), text: label + ' ' + Math.round(v * 100) + '%', dataset: { value: String(v) } });
            b.addEventListener('click', () => apply({ scale: v }));
            return b;
          }))
      ));
      main.append(el('div', { class: 'set-row' },
        el('div', { class: 'sr-label' }, el('div', { text: '免打扰' }), el('div', { class: 'sr-desc', text: '抑制通知弹出，但保留记录' })),
        (() => { const t = el('div', { class: 'toggle' + (s.dnd ? ' on' : '') }); t.dataset.testid = 'settings-dnd'; t.addEventListener('click', () => apply({ dnd: !s.dnd })); return t; })()
      ));
      main.append(el('div', { class: 'set-row' },
        el('div', { class: 'sr-label', text: '壁纸快捷' }),
        el('div', { class: 'wp-grid', dataset: { testid: 'settings-wallpaper' } },
          ...Object.entries(WALLPAPERS).map(([key, wp]) => {
            const opt = el('button', { class: 'wp-opt' + (s.wallpaper === key ? ' active' : ''), style: { backgroundImage: wp.css }, dataset: { value: key } }, el('span', { text: wp.name }));
            opt.addEventListener('click', () => apply({ wallpaper: key }));
            return opt;
          })))
      );
    } else {
      main.append(el('div', { class: 'set-row' },
        el('div', { class: 'sr-label', text: '系统名称' }),
        (() => {
          const i = el('input', { class: 'name-input', value: s.name || sys.name, dataset: { testid: 'settings-name' } });
          i.addEventListener('change', () => { if (i.value.trim()) apply({ name: i.value.trim() }); });
          return i;
        })(), el('span', { class: 'dim', style: { fontSize: '10px' }, text: `标识：${sys.id}` }))
      );
      main.append(el('div', { class: 'set-row' },
        el('div', { class: 'sr-label', text: '系统身份' }),
        el('div', { class: 'col', style: { gap: '4px', fontSize: '11px', color: 'var(--muted)' } },
          el('span', { text: `实例：${sys.id} · 第 ${sys.depth + 1} 层 · 父系统 ${sys.parentId || '无'}` }),
          el('span', { text: `总预算：${sys.budget.total} u / 逻辑步 · 内存 ${sys.budget.memoryQuota} MB · 存储 ${(sys.budget.storageQuota / 1024 / 1024).toFixed(0)} MB` }),
          el('span', { text: `示例素材：/Demo/helicopter-24.scene、/Demo/sample.sheet` })))
      );
      main.append(el('div', { class: 'set-row' },
        el('div', { class: 'sr-label', text: '关于' }),
        el('div', { class: 'col', style: { gap: '4px', fontSize: '11px', color: 'var(--muted)' } },
          el('span', { text: 'Nested OS —— 可嵌套的图形操作系统。内核、程序、调度与投送都是可读可改的项目代码。' }),
          el('span', { text: '壁纸、图标、三维场景均由本项目自制。' })))
      );
    }
  }
  render();
  ctx.onTick = () => {};
  return { destroy() { } };
}
