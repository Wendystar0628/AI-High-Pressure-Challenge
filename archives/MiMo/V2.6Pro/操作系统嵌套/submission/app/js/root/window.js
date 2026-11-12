/* window.js — native window manager for the root system (host-implemented). */
import { el, uid, clamp } from '../utils.js';
import { getIcon } from '../host/wallpaper.js';

let zCounter = 100;

export class RootWindow {
  constructor(opts) {
    this.id = opts.id || uid('win');
    this.appId = opts.appId;
    this.title = opts.title || '窗口';
    this.icon = opts.icon || 'unknown';
    this.systemId = opts.systemId || 'outer';
    this.x = opts.x ?? 80; this.y = opts.y ?? 60;
    this.w = opts.w ?? 860; this.h = opts.h ?? 560;
    this.minW = opts.minW || 320; this.minH = opts.minH || 200;
    this.state = 'normal'; // normal | minimized | maximized | snapped-left | snapped-right
    this.prevRect = null;
    this.z = ++zCounter;
    this.onClose = opts.onClose || null;
    this.onFocus = opts.onFocus || null;
    this.onResize = opts.onResize || null;
    this.onMinimize = opts.onMinimize || null;
    this.isProjection = !!opts.isProjection;
    this.projInfo = opts.projInfo || null;

    this.el = el('div', {
      class: 'app-window' + (this.isProjection ? ' projection' : '') + (opts.className ? ' ' + opts.className : ''),
      'data-testid': 'app-window',
      'data-window-id': this.id,
      'data-app-id': this.appId,
      'data-system-id': this.systemId
    });
    if (this.isProjection && this.projInfo) {
      this.el.setAttribute('data-source-system-id', this.projInfo.sourceSystemId);
      this.el.setAttribute('data-source-window-id', this.projInfo.sourceWindowId);
      this.el.setAttribute('data-source-app-id', this.projInfo.sourceAppId);
    }

    const titleIcon = el('div', { class: 'window-title-icon' });
    titleIcon.style.backgroundImage = `url(${getIcon(this.icon, 36)})`;
    titleIcon.style.backgroundSize = 'cover';
    this.titleText = el('div', { class: 'window-title-text', text: this.title });
    const minBtn = el('div', { class: 'window-ctrl', 'data-testid': 'window-minimize', title: '最小化', text: '─' });
    const maxBtn = el('div', { class: 'window-ctrl', 'data-testid': 'window-maximize', title: '最大化', text: '□' });
    const closeBtn = el('div', { class: 'window-ctrl close', 'data-testid': 'window-close', title: '关闭', text: '✕' });
    const controls = el('div', { class: 'window-controls' }, [minBtn, maxBtn, closeBtn]);
    this.titlebar = el('div', { class: 'window-titlebar', 'data-testid': 'window-titlebar' }, [titleIcon, this.titleText, controls]);
    this.body = el('div', { class: 'window-body' });

    this.el.appendChild(this.titlebar);
    this.el.appendChild(this.body);

    // resize handles
    for (const dir of ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']) {
      const h = el('div', { class: 'window-resize ' + dir, 'data-testid': 'window-resize', 'data-dir': dir });
      this.el.appendChild(h);
      h.addEventListener('mousedown', (e) => this._startResize(e, dir));
    }

    this._applyGeom();

    minBtn.addEventListener('click', (e) => { e.stopPropagation(); this.minimize(); });
    maxBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMaximize(); });
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
    this.titlebar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.window-ctrl')) return;
      this.toggleMaximize();
    });
    this.titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.window-ctrl')) return;
      this._startDrag(e);
    });
    this.el.addEventListener('mousedown', () => this.focus(), true);
  }

  setTitle(t) { this.title = t; this.titleText.textContent = t; }

  _applyGeom() {
    if (this.state === 'maximized') {
      const p = this.el.parentElement;
      const pw = p ? p.clientWidth : 1600, ph = p ? p.clientHeight : 900;
      this.el.style.left = '0px'; this.el.style.top = '0px';
      this.el.style.width = pw + 'px'; this.el.style.height = ph + 'px';
    } else if (this.state === 'snapped-left' || this.state === 'snapped-right') {
      const p = this.el.parentElement;
      const pw = p ? p.clientWidth : 1600, ph = p ? p.clientHeight : 900;
      const half = Math.floor(pw / 2);
      this.el.style.left = (this.state === 'snapped-left' ? 0 : half) + 'px';
      this.el.style.top = '0px';
      this.el.style.width = half + 'px';
      this.el.style.height = ph + 'px';
    } else {
      this.el.style.left = this.x + 'px';
      this.el.style.top = this.y + 'px';
      this.el.style.width = this.w + 'px';
      this.el.style.height = this.h + 'px';
    }
    this.el.classList.toggle('maximized', this.state === 'maximized');
    if (this.onResize) this.onResize(this.contentW(), this.contentH());
  }

  contentW() { return this.el.clientWidth; }
  contentH() { return this.el.clientHeight - this.titlebar.offsetHeight; }

  focus() {
    this.z = ++zCounter;
    this.el.style.zIndex = this.z;
    this.el.classList.add('focused');
    if (this.onFocus) this.onFocus();
  }
  blur() { this.el.classList.remove('focused'); }

  minimize() {
    if (this.state === 'minimized') return;
    this.prevState = this.state;
    this.state = 'minimized';
    this.el.classList.add('minimized');
    if (this.onMinimize) this.onMinimize();
  }
  restore() {
    this.state = this.prevState && this.prevState !== 'minimized' ? this.prevState : 'normal';
    this.el.classList.remove('minimized');
    this._applyGeom();
    this.focus();
  }
  toggleMaximize() {
    if (this.state === 'maximized') {
      this.state = 'normal';
      if (this.prevRect) { this.x = this.prevRect.x; this.y = this.prevRect.y; this.w = this.prevRect.w; this.h = this.prevRect.h; }
    } else {
      this.prevRect = { x: this.x, y: this.y, w: this.w, h: this.h };
      this.state = 'maximized';
    }
    this._applyGeom();
  }
  snap(side) {
    if (this.state === 'normal') this.prevRect = { x: this.x, y: this.y, w: this.w, h: this.h };
    this.state = side === 'left' ? 'snapped-left' : 'snapped-right';
    this._applyGeom();
    this.focus();
  }
  close() {
    if (this.onClose) {
      const allow = this.onClose();
      if (allow === false) return;
    }
    this.destroy();
  }
  destroy() {
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
    this.dead = true;
  }

  _startDrag(e) {
    if (this.state === 'maximized') {
      // drag out of maximize
      const rect = this.el.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      this.state = 'normal';
      this.w = this.prevRect ? this.prevRect.w : 860;
      this.h = this.prevRect ? this.prevRect.h : 560;
      this.x = e.clientX - relX;
      this.y = e.clientY - 16;
      this._applyGeom();
    }
    const startX = e.clientX, startY = e.clientY;
    const ox = this.x, oy = this.y;
    const host = this.el.parentElement;
    const snapPreview = el('div', { class: 'snap-preview' });
    let previewSide = null;
    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      this.x = ox + dx;
      this.y = Math.max(0, oy + dy);
      this._applyGeom();
      // snap preview near edges
      const hw = host.clientWidth, hh = host.clientHeight;
      previewSide = null;
      if (ev.clientY < 40) previewSide = 'max';
      else if (ev.clientX < 24) previewSide = 'left';
      else if (ev.clientX > hw - 24) previewSide = 'right';
      if (previewSide) {
        snapPreview.style.display = 'block';
        if (previewSide === 'max') {
          snapPreview.style.left = '0'; snapPreview.style.top = '0';
          snapPreview.style.width = hw + 'px'; snapPreview.style.height = hh + 'px';
        } else if (previewSide === 'left') {
          snapPreview.style.left = '0'; snapPreview.style.top = '0';
          snapPreview.style.width = Math.floor(hw / 2) + 'px'; snapPreview.style.height = hh + 'px';
        } else {
          snapPreview.style.left = Math.floor(hw / 2) + 'px'; snapPreview.style.top = '0';
          snapPreview.style.width = Math.floor(hw / 2) + 'px'; snapPreview.style.height = hh + 'px';
        }
        if (!snapPreview.parentElement) host.appendChild(snapPreview);
      } else {
        snapPreview.style.display = 'none';
      }
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (previewSide === 'max') { this.toggleMaximize(); }
      else if (previewSide === 'left') this.snap('left');
      else if (previewSide === 'right') this.snap('right');
      if (snapPreview.parentElement) snapPreview.parentElement.removeChild(snapPreview);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  }

  _startResize(e, dir) {
    if (this.state === 'maximized') return;
    const startX = e.clientX, startY = e.clientY;
    const ox = this.x, oy = this.y, ow = this.w, oh = this.h;
    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (dir.includes('e')) this.w = Math.max(this.minW, ow + dx);
      if (dir.includes('s')) this.h = Math.max(this.minH, oh + dy);
      if (dir.includes('w')) {
        this.w = Math.max(this.minW, ow - dx);
        this.x = ox + (ow - this.w);
      }
      if (dir.includes('n')) {
        this.h = Math.max(this.minH, oh - dy);
        this.y = oy + (oh - this.h);
      }
      this._applyGeom();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
    e.stopPropagation();
  }
}
