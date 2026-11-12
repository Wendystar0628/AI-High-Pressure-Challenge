/* settings.js — system settings */
import { el } from '../../utils.js';
import { makeWallpaper, iconDataURL } from '../../host/wallpaper.js';

const WALLPAPERS = [
  { id: 'valley', name: '山谷晨光' },
  { id: 'aurora', name: '极光夜空' },
  { id: 'dusk', name: '暮色群山' },
  { id: 'peaks', name: '雪峰远望' },
  { id: 'minimal', name: '极简光晕' }
];
const ACCENTS = ['#4f7cff', '#7c6df2', '#3ecf8e', '#f5b83d', '#ff6b9d', '#39b8e8', '#ff7a59', '#b266ff'];

export class SettingsApp {
  constructor(root) { this.root = root; }

  open() {
    const win = this.root.createWindow({
      appId: 'settings', title: '设置', icon: 'settings',
      w: 720, h: 520
    });
    this._render(win.body, win);
    return win;
  }

  _render(body, win) {
    body.innerHTML = '';
    const app = el('div', {
      class: 'app-root', 'data-app-id': 'settings',
      'data-system-id': this.root.id, 'data-window-id': win.id
    });
    const layout = el('div', { class: 'settings-layout' });

    // name
    const sec1 = el('div', { class: 'settings-section' }, [el('h3', { text: '系统标识' })]);
    const nameRow = el('div', { class: 'settings-row' }, [
      el('label', { text: '系统名称' }),
      el('input', {
        type: 'text', value: this.root.settings.name, style: 'width:240px',
        onchange: (e) => {
          this.root.settings.name = e.target.value;
          this.root.saveSettings();
          this.root.toast('已更新系统名称', e.target.value, 'good');
        }
      })
    ]);
    sec1.appendChild(nameRow);

    // wallpaper
    const sec2 = el('div', { class: 'settings-section' }, [el('h3', { text: '壁纸' })]);
    const wpGrid = el('div', { class: 'wallpaper-grid', 'data-testid': 'settings-wallpaper' });
    for (const w of WALLPAPERS) {
      const opt = el('div', {
        class: 'wallpaper-opt' + (this.root.settings.wallpaper === w.id ? ' selected' : ''),
        'data-value': w.id,
        title: w.name
      });
      const img = makeWallpaper(w.id, this.root.settings.accent);
      opt.style.backgroundImage = `url(${img})`;
      opt.addEventListener('click', () => {
        this.root.settings.wallpaper = w.id;
        this.root.saveSettings();
        this.root.applySettings();
        this._render(body, win);
        this.root.toast('壁纸已更换', w.name, 'good');
      });
      wpGrid.appendChild(opt);
    }
    sec2.appendChild(wpGrid);

    // accent
    const sec3 = el('div', { class: 'settings-section' }, [el('h3', { text: '强调色' })]);
    const acGrid = el('div', { class: 'accent-grid', 'data-testid': 'settings-accent' });
    for (const c of ACCENTS) {
      const opt = el('div', {
        class: 'accent-opt' + (this.root.settings.accent === c ? ' selected' : ''),
        'data-value': c
      });
      opt.style.background = c;
      opt.addEventListener('click', () => {
        this.root.settings.accent = c;
        this.root.saveSettings();
        this.root.applySettings();
        this._render(body, win);
      });
      acGrid.appendChild(opt);
    }
    sec3.appendChild(acGrid);

    // scale
    const sec4 = el('div', { class: 'settings-section' }, [el('h3', { text: '界面缩放' })]);
    const scaleRow = el('div', { class: 'settings-row', 'data-testid': 'settings-scale' }, [
      el('label', { text: '缩放比例' }),
      (() => {
        const sel = el('select');
        for (const v of [0.85, 1, 1.15, 1.3, 1.5]) {
          const o = el('option', { value: String(v), text: Math.round(v * 100) + '%', 'data-value': String(v) });
          if (Math.abs(this.root.settings.scale - v) < 0.01) o.selected = true;
          sel.appendChild(o);
        }
        sel.addEventListener('change', () => {
          this.root.settings.scale = parseFloat(sel.value);
          this.root.saveSettings();
          this.root.applySettings();
          this.root.toast('界面缩放已调整', sel.value + '×');
        });
        return sel;
      })()
    ]);
    sec4.appendChild(scaleRow);

    layout.appendChild(sec1);
    layout.appendChild(sec2);
    layout.appendChild(sec3);
    layout.appendChild(sec4);
    app.appendChild(layout);
    body.appendChild(app);
  }
}
