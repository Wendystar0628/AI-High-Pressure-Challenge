// HTML 窗口框架: 拖动/缩放/最小化/最大化/贴靠/层级/焦点
// 每个窗口是 .app-window 元素,由 WindowManager 统一管理。

export class WindowManager {
  constructor(desktopEl, opts = {}) {
    this.desktopEl = desktopEl;
    this.windows = new Map();
    this.zTop = 100;
    this.focusedId = null;
    this.onChange = opts.onChange || (() => {});
    this.onCloseRequest = opts.onCloseRequest || null; // (win, def) => bool|Promise<bool>
    this.snapPreview = null;
    this._initSnapPreview();
  }

  _initSnapPreview() {
    this.snapPreview = document.createElement('div');
    this.snapPreview.style.cssText =
      'position:absolute;display:none;border:2px solid rgba(124,92,255,0.75);' +
      'background:rgba(124,92,255,0.18);border-radius:10px;pointer-events:none;z-index:99999;';
    this.desktopEl.appendChild(this.snapPreview);
  }

  create(def) {
    // def: {id?, appId, title, icon, systemId, systemName, x,y,w,h, minWidth,minHeight,
    //       resizable=true, maximizable=true, onClose, bodyBuilder(el, win), className}
    const id = def.id || (def.appId + '-' + Math.random().toString(36).slice(2, 8));
    const el = document.createElement('div');
    el.className = 'app-window';
    if (def.className) el.className += ' ' + def.className;
    el.dataset.testid = 'app-window';
    el.dataset.appId = def.appId;
    el.dataset.windowId = id;
    el.dataset.systemId = def.systemId || 'outer';
    if (def.sourceSystemId) el.dataset.sourceSystemId = def.sourceSystemId;
    if (def.sourceWindowId) el.dataset.sourceWindowId = def.sourceWindowId;
    if (def.sourceAppId) el.dataset.sourceAppId = def.sourceAppId;

    const sysChip = def.systemId && def.systemId !== 'outer'
      ? `<span class="sys-chip">${escapeHtml(def.systemName || def.systemId)}</span>` : '';

    el.innerHTML = `
      <div class="window-titlebar" data-testid="window-titlebar">
        <div class="t-ico">${def.icon || '▣'}</div>
        <div class="t-title"><span class="t-text">${escapeHtml(def.title || '')}</span>${sysChip}</div>
        <div class="window-controls">
          <button class="wbtn" data-testid="window-minimize" title="最小化">─</button>
          <button class="wbtn" data-testid="window-maximize" title="最大化">▢</button>
          <button class="wbtn close" data-testid="window-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="window-body"></div>
      ${['n','s','w','e','nw','ne','sw','se'].map(d => `<div class="window-resize ${d}" data-testid="window-resize" data-dir="${d}"></div>`).join('')}
    `;

    const win = {
      id, appId: def.appId, title: def.title || '', icon: def.icon || '▣',
      systemId: def.systemId || 'outer', systemName: def.systemName || '',
      el,
      body: el.querySelector('.window-body'),
      x: def.x ?? 80, y: def.y ?? 60,
      w: def.w ?? 720, h: def.h ?? 480,
      minW: def.minWidth ?? 260, minH: def.minHeight ?? 160,
      minimized: false, maximized: false, snap: null,
      resizable: def.resizable !== false, maximizable: def.maximizable !== false,
      prevRect: null,
      onClose: def.onClose || null,
      meta: def.meta || {},
    };
    if (!win.maximizable) {
      const mb = el.querySelector('[data-testid="window-maximize"]');
      if (mb) mb.style.display = 'none';
    }

    this.windows.set(id, win);
    this.desktopEl.appendChild(el);
    if (def.bodyBuilder) def.bodyBuilder(win.body, win);
    this._wire(win);
    this._applyRect(win);
    this.focus(id);
    this.onChange();
    return win;
  }

  _wire(win) {
    const el = win.el;
    const tb = el.querySelector('.window-titlebar');

    el.addEventListener('pointerdown', () => this.focus(win.id), true);

    el.querySelector('[data-testid="window-minimize"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimize(win.id);
    });
    el.querySelector('[data-testid="window-maximize"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize(win.id);
    });
    el.querySelector('[data-testid="window-close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.requestClose(win.id);
    });
    tb.addEventListener('dblclick', (e) => {
      if (e.target.closest('.wbtn')) return;
      if (win.maximizable) this.toggleMaximize(win.id);
    });

    // 标题栏拖动 + 贴靠
    tb.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.wbtn')) return;
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const ox = win.x, oy = win.y;
      let moved = false;
      const rect = () => this.desktopEl.getBoundingClientRect();
      const onMove = (ev) => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        moved = true;
        if (win.maximized && (Math.abs(dx) + Math.abs(dy) > 8)) {
          // 从最大化拖出
          const r = rect();
          const ratio = ev.clientX / r.width;
          this.restore(win.id);
          win.x = Math.round(ev.clientX - win.w * ratio);
          win.y = Math.max(0, ev.clientY - 19);
        } else {
          win.x = ox + dx;
          win.y = oy + dy;
        }
        // 贴靠预览
        const r = rect();
        const snapSide = this._snapSide(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height);
        if (snapSide && win.maximizable) {
          const p = this._snapRect(snapSide, r.width, r.height);
          Object.assign(this.snapPreview.style, {
            display: 'block', left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px',
          });
        } else {
          this.snapPreview.style.display = 'none';
        }
        this._applyRect(win);
      };
      const onUp = (ev) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        this.snapPreview.style.display = 'none';
        const r = rect();
        const snapSide = this._snapSide(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height);
        if (snapSide && win.maximizable && moved) {
          this.snapWindow(win.id, snapSide);
        }
        this.onChange();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    // 边缘缩放
    if (win.resizable) {
      el.querySelectorAll('.window-resize').forEach((h) => {
        h.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.preventDefault(); e.stopPropagation();
          this.focus(win.id);
          const dir = h.dataset.dir;
          const startX = e.clientX, startY = e.clientY;
          const o = { x: win.x, y: win.y, w: win.w, h: win.h };
          const onMove = (ev) => {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (dir.includes('e')) win.w = Math.max(win.minW, o.w + dx);
            if (dir.includes('s')) win.h = Math.max(win.minH, o.h + dy);
            if (dir.includes('w')) {
              win.w = Math.max(win.minW, o.w - dx);
              win.x = o.x + (o.w - win.w);
            }
            if (dir.includes('n')) {
              win.h = Math.max(win.minH, o.h - dy);
              win.y = o.y + (o.h - win.h);
            }
            if (win.maximized) { win.maximized = false; win.snap = null; el.classList.remove('maximized'); }
            this._applyRect(win);
          };
          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            this.onChange();
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
      });
    }
  }

  _snapSide(x, y, W, H) {
    if (x <= 2) return 'left';
    if (x >= W - 2) return 'right';
    if (y <= 2) return 'top';
    return null;
  }
  _snapRect(side, W, H) {
    if (side === 'left') return { x: 0, y: 0, w: Math.round(W / 2), h: H };
    if (side === 'right') return { x: Math.round(W / 2), y: 0, w: W - Math.round(W / 2), h: H };
    return { x: 0, y: 0, w: W, h: H };
  }

  snapWindow(id, side) {
    const win = this.windows.get(id);
    if (!win) return;
    const r = this.desktopEl.getBoundingClientRect();
    const p = this._snapRect(side, r.width, r.height - 0);
    if (!win.snap) win.prevRect = { x: win.x, y: win.y, w: win.w, h: win.h };
    win.snap = side;
    win.maximized = side === 'top';
    win.el.classList.toggle('maximized', win.maximized);
    Object.assign(win, p);
    this._applyRect(win);
    this.focus(id);
    this.onChange();
  }

  toggleMaximize(id) {
    const win = this.windows.get(id);
    if (!win || !win.maximizable) return;
    if (win.maximized || win.snap) {
      this.restore(id);
    } else {
      win.prevRect = { x: win.x, y: win.y, w: win.w, h: win.h };
      const r = this.desktopEl.getBoundingClientRect();
      win.x = 0; win.y = 0; win.w = r.width; win.h = r.height;
      win.maximized = true; win.snap = 'top';
      win.el.classList.add('maximized');
      this._applyRect(win);
    }
    this.onChange();
  }

  restore(id) {
    const win = this.windows.get(id);
    if (!win) return;
    const r = win.prevRect || { x: 80, y: 60, w: 720, h: 480 };
    win.x = r.x; win.y = r.y; win.w = r.w; win.h = r.h;
    win.maximized = false; win.snap = null;
    win.el.classList.remove('maximized');
    win.minimized = false;
    win.el.style.display = 'flex';
    this._applyRect(win);
    this.focus(id);
    this.onChange();
  }

  minimize(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.minimized = true;
    win.el.style.display = 'none';
    if (this.focusedId === id) {
      this.focusedId = null;
      // 焦点转给下一个可见窗口
      const visible = [...this.windows.values()].filter(w => !w.minimized);
      if (visible.length) {
        visible.sort((a, b) => (+b.el.style.zIndex || 0) - (+a.el.style.zIndex || 0));
        this.focus(visible[0].id);
      }
    }
    this.onChange();
  }

  unminimize(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.minimized = false;
    win.el.style.display = 'flex';
    this.focus(id);
    this.onChange();
  }

  focus(id) {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.minimized) { this.unminimize(id); return; }
    this.zTop += 1;
    win.el.style.zIndex = String(this.zTop);
    if (this.focusedId && this.windows.get(this.focusedId)) {
      this.windows.get(this.focusedId).el.classList.remove('focused');
    }
    win.el.classList.add('focused');
    this.focusedId = id;
    this.onChange();
  }

  setTitle(id, title) {
    const win = this.windows.get(id);
    if (!win) return;
    win.title = title;
    const t = win.el.querySelector('.t-text');
    if (t) t.textContent = title;
    this.onChange();
  }

  async requestClose(id) {
    const win = this.windows.get(id);
    if (!win) return;
    if (this.onCloseRequest) {
      const ok = await this.onCloseRequest(win);
      if (!ok) return;
    }
    if (win.onClose) {
      const ok = await win.onClose(win);
      if (ok === false) return;
    }
    this.close(id);
  }

  close(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.el.remove();
    this.windows.delete(id);
    if (this.focusedId === id) {
      this.focusedId = null;
      const visible = [...this.windows.values()].filter(w => !w.minimized);
      if (visible.length) {
        visible.sort((a, b) => (+b.el.style.zIndex || 0) - (+a.el.style.zIndex || 0));
        this.focus(visible[0].id);
      }
    }
    this.onChange();
  }

  get(id) { return this.windows.get(id); }
  list() { return [...this.windows.values()]; }

  _applyRect(win) {
    const el = win.el;
    el.style.left = Math.round(win.x) + 'px';
    el.style.top = Math.round(win.y) + 'px';
    el.style.width = Math.round(win.w) + 'px';
    el.style.height = Math.round(win.h) + 'px';
    if (win.onResize) win.onResize(win);
    // 自定义事件供内部画布同步
    win.el.dispatchEvent(new CustomEvent('win-resize', { detail: win }));
  }

  // 桌面尺寸变化时保持最大化/贴靠窗口正确
  relayout() {
    const r = this.desktopEl.getBoundingClientRect();
    for (const win of this.windows.values()) {
      if (win.maximized) {
        win.x = 0; win.y = 0; win.w = r.width; win.h = r.height;
      } else if (win.snap === 'left' || win.snap === 'right') {
        const p = this._snapRect(win.snap, r.width, r.height);
        Object.assign(win, p);
      }
      // 窗口不完全脱离桌面
      win.x = Math.min(win.x, Math.max(0, r.width - 80));
      win.y = Math.min(win.y, Math.max(0, r.height - 60));
      this._applyRect(win);
    }
    this.onChange();
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 简易上下文菜单
export function showContextMenu(x, y, items, opts = {}) {
  document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.dataset.testid = 'context-menu';
  for (const it of items) {
    if (it === '-') {
      const sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
      continue;
    }
    const d = document.createElement('div');
    d.className = 'ctx-item' + (it.disabled ? ' disabled' : '');
    d.dataset.testid = it.testid || 'ctx-item';
    d.innerHTML = `<span>${it.icon || ''}</span><span>${escapeHtml(it.label)}</span>`;
    d.addEventListener('click', () => {
      menu.remove();
      it.action && it.action();
    });
    menu.appendChild(d);
  }
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  const close = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      window.removeEventListener('pointerdown', close, true);
      opts.onClose && opts.onClose();
    }
  };
  setTimeout(() => window.addEventListener('pointerdown', close, true), 0);
  return menu;
}

// 模态确认框
export function confirmDialog({ title, body, okText = '确定', cancelText = '取消' }) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.style.cssText =
      'position:fixed;inset:0;background:rgba(5,8,20,0.55);z-index:15000;display:flex;' +
      'align-items:center;justify-content:center;';
    mask.innerHTML = `
      <div class="panel" style="width:380px;background:var(--glass-strong);box-shadow:var(--shadow-2);">
        <h3>${escapeHtml(title)}</h3>
        <div class="muted" style="font-size:13px;line-height:1.6;margin-bottom:16px;">${escapeHtml(body)}</div>
        <div class="row" style="justify-content:flex-end;">
          <button data-act="cancel">${escapeHtml(cancelText)}</button>
          <button class="primary" data-act="ok">${escapeHtml(okText)}</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    mask.addEventListener('click', (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (act === 'ok') { mask.remove(); resolve(true); }
      else if (act === 'cancel') { mask.remove(); resolve(false); }
      else if (e.target === mask) { mask.remove(); resolve(false); }
    });
    mask.querySelector('[data-act="ok"]').focus();
  });
}
