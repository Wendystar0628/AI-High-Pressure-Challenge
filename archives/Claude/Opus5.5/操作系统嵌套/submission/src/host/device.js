// 显示与输入设备（宿主）。子系统程序经系统接口提交可复制的节点树，这里把它画成 DOM；
// 指针和键盘转成消息交回系统，由各层窗口管理器做命中判断。设备不推进任何系统状态。
import { iconSvg } from './icons.js';

const NATIVE = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION']);
const px = (v) => (typeof v === 'number' ? v + 'px' : v);

export class Device {
  constructor() {
    this.instances = new Map();
    this.kernel = null;
    this.gfx = null;
    this.tops = new Map();
    this.nextTop = 1;
    this.capture = null;
    this.pendingValues = new Map();
    this.valueTimer = 0;
    this.drag = null;
    this.dragCandidate = null;
    this.onDragTarget = null;
    this.bindInput();
  }
  inst(sys) {
    let I = this.instances.get(sys);
    if (!I) {
      const rootEl = document.createElement('div');
      rootEl.className = 'nest-instance';
      rootEl.dataset.instance = sys;
      I = { id: sys, surfaces: new Map(), rootEl, meta: {}, state: 'running', pendingMounts: new Map() };
      this.instances.set(sys, I);
    }
    return I;
  }
  surface(I, sid) {
    let s = I.surfaces.get(sid);
    if (!s) {
      s = { sid, tree: null, el: null, ctx: { sys: I.id, win: null, owner: I.id }, mountEl: null };
      I.surfaces.set(sid, s);
    }
    return s;
  }

  // —— 提交 ——
  commit(sys, sid, tree) {
    const I = this.inst(sys);
    const s = this.surface(I, sid);
    s.tree = tree;
    if (!s.el) {
      s.el = this.createEl(tree);
      s.el.dataset.surface = sys + '|' + sid;
      if (sid === 'root') I.rootEl.appendChild(s.el);
      else if (s.mountEl) s.mountEl.appendChild(s.el);
    }
    this.syncNode(s.el, tree, s.ctx, I, s);
    s.el.dataset.surface = sys + '|' + sid;
    const pm = I.pendingMounts.get(sid);
    if (pm) { I.pendingMounts.delete(sid); this.mountSurfaceInto(I, sid, pm.el, pm.ctx); }
    return true;
  }
  findNode(n, key) {
    if (!n) return null;
    if (n.k === key) return n;
    if (n.c) for (const c of n.c) { const r = this.findNode(c, key); if (r) return r; }
    return null;
  }
  patch(sys, sid, key, props) {
    const I = this.inst(sys);
    const s = I.surfaces.get(sid);
    if (!s || !s.tree) return false;
    const n = this.findNode(s.tree, key);
    if (!n) return false;
    const el = this.nodeEl(s.el, s.tree, n);
    Object.assign(n, props);
    if (el) this.syncNode(el, { ...n }, el._ctx || s.ctx, I, s);
    return true;
  }
  nodeEl(rootEl, root, target) {
    if (root === target) return rootEl;
    if (!root.c || !rootEl._kids) return null;
    for (const c of root.c) {
      const e = rootEl._kids.get(c.k);
      if (!e) continue;
      const r = this.nodeEl(e, c, target);
      if (r) return r;
    }
    return null;
  }
  focusNode(sys, sid, key) {
    const I = this.inst(sys);
    const s = I.surfaces.get(sid);
    if (!s || !s.tree) return false;
    const n = this.findNode(s.tree, key);
    const el = n && this.nodeEl(s.el, s.tree, n);
    if (el && el.focus) el.focus();
    return true;
  }
  surfaceDrop(sys, sid) {
    const I = this.instances.get(sys);
    if (!I) return true;
    const s = I.surfaces.get(sid);
    if (s) {
      if (s.el) { this.detachSubtree(s.el); s.el.remove(); }
      I.surfaces.delete(sid);
    }
    return true;
  }
  meta(sys, kind, data) { this.inst(sys).meta[kind] = data; return true; }
  sysState(sys, state, err) {
    const I = this.inst(sys);
    I.state = state; I.err = err;
    this.refreshProjSlots();
  }
  hasWindow(sys, wid) {
    const I = this.instances.get(sys);
    return !!(I && I.meta.windows && I.meta.windows.some((w) => w.id === wid));
  }

  // —— 节点到 DOM ——
  createEl(n) {
    const t = n.t;
    let el;
    if (t === 'input') { el = document.createElement('input'); el.type = n.itype || 'text'; el.autocomplete = 'off'; el.spellcheck = false; }
    else if (t === 'textarea') { el = document.createElement('textarea'); el.spellcheck = false; el.wrap = 'off'; }
    else if (t === 'select') el = document.createElement('select');
    else if (t === 'view3d' || t === 'draw') el = document.createElement('canvas');
    else el = document.createElement('div');
    el._t = t;
    return el;
  }
  syncNode(el, n, ctx, I, surf) {
    const p = el._n || {};
    el._ctx = ctx;
    if (n.cls !== p.cls || n.t !== p.t) {
      let base = n.cls || '';
      if (n.t === 'icon') base = 'ico ' + base;
      el.className = base;
    }
    if (n.st !== p.st) el.setAttribute('style', n.st || '');
    const force = n.st !== p.st;
    if (n.x !== undefined) {
      if (n.x !== p.x || force) { el.style.position = 'absolute'; el.style.left = px(n.x); }
      if (n.y !== p.y || force) el.style.top = px(n.y);
      if (n.w !== p.w || force) el.style.width = px(n.w);
      if (n.h !== p.h || force) el.style.height = px(n.h);
    }
    if (n.z !== p.z || force) el.style.zIndex = n.z === undefined ? '' : n.z;
    if (n.hide !== p.hide || force) el.style.display = n.hide ? 'none' : '';
    if (n.wp !== p.wp) el.dataset.wallpaper = n.wp || '';
    // 稳定标识与归属
    const nctx = n.win ? { sys: ctx.sys, win: n.win, owner: ctx.owner } : ctx;
    if (n.tid !== p.tid) { if (n.tid) el.dataset.testid = n.tid; else delete el.dataset.testid; }
    if (n.tid || n.drop || n.drag) {
      el.dataset.systemId = nctx.sys;
      if (nctx.win) el.dataset.windowId = nctx.win; else delete el.dataset.windowId;
    }
    if (n.drop !== p.drop) { if (n.drop) el.dataset.dropDir = n.drop; else delete el.dataset.dropDir; }
    if (n.drag !== p.drag) { if (n.drag) el.dataset.dragPaths = JSON.stringify(n.drag); else delete el.dataset.dragPaths; }
    if (n.label !== p.label) { if (n.label) el.setAttribute('aria-label', n.label); else el.removeAttribute('aria-label'); if (n.label && n.role) el.title = n.label; }
    if (n.role !== p.role) { if (n.role) el.setAttribute('role', n.role); else el.removeAttribute('role'); }
    if (n.a !== p.a) {
      if (p.a) for (const k in p.a) if (!n.a || n.a[k] === undefined) el.removeAttribute(k);
      if (n.a) for (const k in n.a) if (n.a[k] !== null && n.a[k] !== undefined) el.setAttribute(k, n.a[k]);
    }
    switch (n.t) {
      case 'input': case 'textarea': case 'select': this.syncNative(el, n, p, I, surf); break;
      case 'icon':
        if (n.icon !== p.icon) el.innerHTML = iconSvg(n.icon);
        break;
      case 'surface':
        this.mountSurfaceInto(I, n.sid, el, { sys: nctx.sys, win: nctx.win, owner: I.id });
        break;
      case 'child': this.mountChild(n.sys, el); break;
      case 'projslot': {
        const src = this.inst(n.src);
        el.dataset.projSrc = n.src;
        el._projLabel = n.src;
        this.mountSurfaceInto(src, n.sid, el, { sys: nctx.sys, win: nctx.win, owner: n.src });
        this.updateProjOverlay(el);
        break;
      }
      case 'view3d':
        if (n.vid !== p.vid) {
          el.dataset.vid = n.vid;
          if (this.gfx) this.gfx.attach(I.id === ctx.owner ? I.id : ctx.owner, n.vid, el);
        }
        if (this.gfx && (n.w !== p.w || n.h !== p.h)) this.gfx.resized(el);
        break;
      case 'draw':
        this.drawOps(el, n);
        break;
      default:
        if (n.icon !== p.icon) {
          if (n.icon) { el.innerHTML = iconSvg(n.icon); el.classList.add('has-ico'); }
          else if (p.icon) el.innerHTML = '';
        }
        if (!n.c && !n.icon && n.text !== p.text) el.textContent = n.text === undefined || n.text === null ? '' : n.text;
        if (n.c || p.c) this.syncChildren(el, n.c || [], nctx, I, surf);
    }
    el._n = n;
  }
  syncChildren(el, list, ctx, I, surf) {
    let kids = el._kids;
    if (!kids) { kids = new Map(); el._kids = kids; if (el.childNodes.length && !el._n?.c) el.textContent = ''; }
    const seen = new Set();
    let prev = null;
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n === null || n === undefined) continue;
      const key = n.k === undefined ? '#' + i : n.k;
      if (n.k === undefined) n.k = key;
      seen.add(key);
      let c = kids.get(key);
      if (c && c._t !== n.t) { this.detachSubtree(c); c.remove(); c = null; kids.delete(key); }
      if (!c) {
        c = this.createEl(n);
        kids.set(key, c);
        el.insertBefore(c, prev ? prev.nextSibling : el.firstChild);
      } else if (c.previousSibling !== prev && !(prev === null && c === el.firstChild)) {
        // 顺序变化时才移动节点；窗口次序用 z-index，避免搬动内容
        el.insertBefore(c, prev ? prev.nextSibling : el.firstChild);
      }
      this.syncNode(c, n, ctx, I, surf);
      prev = c;
    }
    for (const [key, c] of kids) {
      if (!seen.has(key)) { this.detachSubtree(c); c.remove(); kids.delete(key); }
    }
  }
  detachSubtree(el) {
    // 子实例根节点和投送显示面可以被重新挂载，移除父节点前先摘下来
    if (el.classList && el.classList.contains('nest-instance')) { el.remove(); return; }
    const list = el.querySelectorAll ? el.querySelectorAll('.nest-instance, canvas[data-vid]') : [];
    for (const x of list) { if (x.classList.contains('nest-instance')) x.remove(); else if (this.gfx) this.gfx.detach(x); }
  }
  syncNative(el, n, p, I, surf) {
    if (n.val !== p.val && !(el === document.activeElement && el.type === 'range' && el._dragging)) {
      const v = n.val === undefined || n.val === null ? '' : String(n.val);
      if (n.t === 'select') {
        this.syncOptions(el, n);
        el.value = v;
      } else if (el.value !== v) el.value = v;
    }
    if (n.t === 'select' && n.opts !== p.opts) { const cur = el.value; this.syncOptions(el, n); if (n.val !== undefined && n.val !== null) el.value = n.val; else el.value = cur; }
    if (n.ph !== p.ph) el.placeholder = n.ph || '';
    if (n.dis !== p.dis) el.disabled = !!n.dis;
    if (n.ro !== p.ro) el.readOnly = !!n.ro;
    if (n.min !== p.min) el.min = n.min;
    if (n.max !== p.max) el.max = n.max;
    if (n.step !== p.step) el.step = n.step;
    el.dataset.nk = n.k;
    el.dataset.owner = surf ? surf.owner || I.id : I.id;
    el.dataset.sid = surf ? surf.sid : '';
  }
  syncOptions(el, n) {
    const opts = n.opts || [];
    const sig = JSON.stringify(opts);
    if (el._sig === sig) return;
    el._sig = sig;
    el.textContent = '';
    for (const o of opts) {
      const e = document.createElement('option');
      if (Array.isArray(o)) { e.value = o[0]; e.textContent = o[1]; } else { e.value = o; e.textContent = o; }
      el.appendChild(e);
    }
  }
  mountSurfaceInto(I, sid, el, ctx) {
    const s = this.surface(I, sid);
    const changed = s.ctx.sys !== ctx.sys || s.ctx.win !== ctx.win;
    s.ctx = ctx;
    s.mountEl = el;
    s.owner = I.id;
    if (!s.el) { I.pendingMounts.set(sid, { el, ctx }); return; }
    if (s.el.parentNode !== el) el.insertBefore(s.el, el.firstChild);
    if (changed && s.tree) this.reSync(s.el, s.tree, ctx, I, s);
  }
  reSync(el, n, ctx, I, surf) {
    el._n = null;
    this.syncNode(el, n, ctx, I, surf);
  }
  mountChild(sys, el) {
    const I = this.inst(sys);
    if (I.rootEl.parentNode !== el) el.insertBefore(I.rootEl, el.firstChild);
    if (this.gfx) this.gfx.markAllDirty();
  }
  // 投送内容遵循源子树的暂停状态：内容冻结，控件禁用并提示原因
  effectivePaused(sys) {
    const K = this.kernel;
    if (!K) return null;
    let cur = K.systems.get(sys);
    while (cur) {
      if (cur.state === 'paused') return cur.id;
      cur = K.systems.get(cur.parentId);
    }
    return null;
  }
  updateProjOverlay(slot) {
    const src = slot.dataset.projSrc;
    const by = this.effectivePaused(src);
    let ov = slot._ov;
    if (by) {
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'proj-paused';
        slot._ov = ov;
        slot.appendChild(ov);
      }
      ov.textContent = `源系统已暂停（${by}），投送内容已冻结，控件暂不可用`;
      slot.classList.add('paused');
      slot.setAttribute('data-paused-by', by);
    } else if (ov) {
      ov.remove(); slot._ov = null;
      slot.classList.remove('paused');
      slot.removeAttribute('data-paused-by');
    }
  }
  refreshProjSlots() {
    for (const s of document.querySelectorAll('[data-proj-src]')) this.updateProjOverlay(s);
  }
  drawOps(el, n) {
    const dpr = (window.devicePixelRatio || 1) * (this.uiScale || 1);
    const W = Math.max(1, Math.round(n.w * dpr)), H = Math.max(1, Math.round(n.h * dpr));
    if (el.width !== W) el.width = W;
    if (el.height !== H) el.height = H;
    const g = el.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, n.w, n.h);
    drawOpsOn(g, n.ops || [], n.w, n.h);
  }

  // —— 实例生命周期 ——
  dropInstance(sys, keepSelf) {
    const I = this.instances.get(sys);
    if (!I) return;
    for (const sid of [...I.surfaces.keys()]) this.surfaceDrop(sys, sid);
    if (this.gfx) this.gfx.dropSystem(sys);
    I.meta = {};
    if (!keepSelf) { I.rootEl.remove(); this.instances.delete(sys); }
  }
  exportInstances(ids) {
    const instances = {}; const scenes = {};
    for (const id of ids) {
      const I = this.instances.get(id);
      if (!I) continue;
      const surfaces = {};
      for (const [sid, s] of I.surfaces) if (s.tree) surfaces[sid] = s.tree;
      const views = this.gfx ? this.gfx.exportViews(id, scenes) : {};
      instances[id] = { surfaces, meta: I.meta, views };
    }
    return JSON.parse(JSON.stringify({ instances, scenes }));
  }
  importInstances(data) {
    const inst = data.instances || {};
    for (const id of Object.keys(inst)) {
      const d = inst[id];
      const I = this.inst(id);
      I.meta = d.meta || {};
      if (this.gfx) this.gfx.importViews(id, d.views || {}, data.scenes || {});
      // 先提交普通显示面，根显示面最后，保证挂载点都能找到内容
      for (const sid of Object.keys(d.surfaces)) if (sid !== 'root') this.commit(id, sid, d.surfaces[sid]);
    }
    for (const id of Object.keys(inst)) {
      const d = inst[id];
      if (d.surfaces.root) this.commit(id, 'root', d.surfaces.root);
    }
    this.refreshProjSlots();
    if (this.gfx) this.gfx.markAllDirty();
  }
  gfxOpen(sys, vid, text) { return this.gfx ? this.gfx.open(sys, vid, text) : { error: '图形设备未就绪' }; }
  gfxFrame(sys, vid, frame, meta) {
    if (meta) this.inst(sys).meta[meta.kind] = meta.data;
    if (this.gfx) this.gfx.frame(sys, vid, frame);
    return true;
  }
  gfxClose(sys, vid) { if (this.gfx) this.gfx.close(sys, vid); return true; }
  gfxPick(sys, vid, x, y) { return this.gfx ? this.gfx.pick(sys, vid, x, y) : null; }

  // —— 输入 ——
  // 根桌面把系统窗口和投送窗口的显示区登记为“顶层视口”
  attachTop(el, target) {
    const id = String(this.nextTop++);
    el.dataset.nestTop = id;
    this.tops.set(id, { el, ...target });
    return id;
  }
  detachTop(el) { if (el.dataset.nestTop) this.tops.delete(el.dataset.nestTop); }
  sendEvent(top, ev) {
    const K = this.kernel;
    if (top.kind === 'system') {
      const c = K.children.get(top.sys);
      if (!c || c.state !== 'running' || c.paused) return;
      if (ev.k === 'move' && c.inbox.length) {
        const last = c.inbox[c.inbox.length - 1];
        if (last.op === 'input' && last.ev.k === 'move') { last.ev.x = ev.x; last.ev.y = ev.y; return; }
      }
      K.sysctl('input', top.sys, ev);
    } else if (top.kind === 'proj') {
      if (this.effectivePaused(top.src)) return;
      K.sendDown(top.path, { op: 'proj_input', sid: top.sid, ev });
    }
  }
  evCoords(top, e) {
    const r = top.el.getBoundingClientRect();
    const k = top.el.offsetWidth > 0 ? r.width / top.el.offsetWidth : 1;
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
  }
  bindInput() {
    const flagged = (e) => e.target && e.target.closest && e.target.closest('[data-nest-top]');
    const mk = (kind, e, top) => {
      const [x, y] = this.evCoords(top, e);
      return { k: kind, x, y, b: e.button, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, native: NATIVE.has(e.target.tagName) };
    };
    document.addEventListener('pointerdown', (e) => {
      this.flushValues();
      const c = e.target.closest && e.target.closest('[data-drag-paths]');
      if (c) this.dragCandidate = { el: c, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      const tel = flagged(e);
      if (!tel) return;
      const top = this.tops.get(tel.dataset.nestTop);
      if (!top) return;
      this.capture = top;
      this.lastTrusted = performance.now();
      if (e.target.type === 'range') e.target._dragging = true;
      this.sendEvent(top, mk('down', e, top));
    }, true);
    document.addEventListener('mousedown', (e) => {
      const tel = flagged(e);
      if (!tel) return;
      if (!NATIVE.has(e.target.tagName)) {
        e.preventDefault();
        const a = document.activeElement;
        if (a && NATIVE.has(a.tagName) && a.closest('[data-nest-top]')) a.blur();
      }
    }, true);
    document.addEventListener('pointermove', (e) => {
      if (this.drag) { this.dragMove(e); return; }
      if (this.dragCandidate) {
        const d = this.dragCandidate;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) { this.dragBegin(d, e); return; }
      }
      const top = this.capture || (flagged(e) && this.tops.get(flagged(e).dataset.nestTop));
      if (!top) return;
      this.sendEvent(top, mk('move', e, top));
    }, true);
    const up = (e) => {
      if (this.drag) { this.dragEnd(e); return; }
      this.dragCandidate = null;
      if (e.target && e.target.type === 'range') e.target._dragging = false;
      const top = this.capture || (flagged(e) && this.tops.get(flagged(e).dataset.nestTop));
      this.capture = null;
      if (top) this.sendEvent(top, mk('up', e, top));
    };
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', () => {
      if (this.drag) this.dragCancel();
    });
    document.addEventListener('dblclick', (e) => {
      const tel = flagged(e);
      if (!tel) return;
      const top = this.tops.get(tel.dataset.nestTop);
      if (top) this.sendEvent(top, mk('dbl', e, top));
    }, true);
    document.addEventListener('contextmenu', (e) => {
      const tel = flagged(e);
      if (!tel) return;
      if (!NATIVE.has(e.target.tagName)) e.preventDefault();
      const top = this.tops.get(tel.dataset.nestTop);
      if (top) this.sendEvent(top, mk('ctx', e, top));
    }, true);
    document.addEventListener('wheel', (e) => {
      const tel = flagged(e);
      if (!tel) return;
      if (e.target.tagName === 'TEXTAREA') return;
      const top = this.tops.get(tel.dataset.nestTop);
      if (!top) return;
      const ev = mk('wheel', e, top);
      ev.dy = e.deltaY;
      this.sendEvent(top, ev);
    }, { capture: true, passive: true });
    // 脚本触发的 click（没有经过指针事件）补成一次按下和抬起
    document.addEventListener('click', (e) => {
      if (e.isTrusted && e.detail > 0) return;
      const tel = flagged(e);
      if (!tel) return;
      const top = this.tops.get(tel.dataset.nestTop);
      if (!top) return;
      const r = e.target.getBoundingClientRect();
      const fake = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, ctrlKey: false, shiftKey: false, altKey: false, target: e.target };
      this.sendEvent(top, mk('down', fake, top));
      this.sendEvent(top, mk('up', fake, top));
    }, true);
    // 原生控件的取值变化
    const onInput = (e) => {
      const el = e.target;
      if (!NATIVE.has(el.tagName) || !el.dataset.nk || !el.dataset.owner) return;
      const key = el.dataset.owner + '|' + el.dataset.sid + '|' + el.dataset.nk;
      this.pendingValues.set(key, { owner: el.dataset.owner, sid: el.dataset.sid, key: el.dataset.nk, value: el.value });
      const delay = el.tagName === 'TEXTAREA' ? 120 : 0;
      if (delay === 0) this.flushValues();
      else if (!this.valueTimer) this.valueTimer = setTimeout(() => this.flushValues(), delay);
    };
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
  }
  flushValues() {
    if (this.valueTimer) { clearTimeout(this.valueTimer); this.valueTimer = 0; }
    if (!this.pendingValues.size) return;
    const K = this.kernel;
    for (const v of this.pendingValues.values()) {
      const rec = K && K.systems.get(v.owner);
      if (rec) K.sendDown(rec.path, { op: 'value', sid: v.sid, key: v.key, value: v.value });
    }
    this.pendingValues.clear();
  }
  sendKey(top, e) {
    this.flushValues();
    this.sendEvent(top, { k: e.type === 'keydown' ? 'keydown' : 'keyup', key: e.key, code: e.code, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, native: NATIVE.has((e.target && e.target.tagName) || '') });
  }

  // —— 跨系统文件拖放：拖动由宿主绘制，目标和传递都经系统接口 ——
  dragBegin(d, e) {
    let paths = [];
    try { paths = JSON.parse(d.el.dataset.dragPaths); } catch { return; }
    const sys = d.el.dataset.systemId;
    this.dragCandidate = null;
    // 让窗口管理器的捕获状态结束，拖动总能正常结束
    if (this.capture) { const top = this.capture; const [x, y] = this.evCoords(top, { clientX: d.x, clientY: d.y }); this.sendEvent(top, { k: 'up', x, y, b: 0, native: false, cancel: true }); this.capture = null; }
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.dataset.testid = 'file-drag-ghost';
    document.body.appendChild(ghost);
    document.body.classList.add('dragging-file');
    this.drag = { paths, sys, ghost, target: null, name: paths.length > 1 ? `${paths.length} 个文件` : paths[0].split('/').pop() };
    this.dragMove(e);
  }
  dragTargetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const h = el.closest('[data-drop-dir], [data-testid="app-window"]');
    if (!h || !h.dataset.dropDir) return null;
    return { el: h, sys: h.dataset.systemId, dir: h.dataset.dropDir };
  }
  dragMove(e) {
    const d = this.drag;
    d.ghost.style.left = e.clientX + 14 + 'px';
    d.ghost.style.top = e.clientY + 12 + 'px';
    const t = this.dragTargetAt(e.clientX, e.clientY);
    if (d.target && (!t || t.el !== d.target.el)) d.target.el.classList.remove('drop-target');
    if (t) t.el.classList.add('drop-target');
    d.target = t;
    d.ghost.textContent = t ? `${d.name} → ${t.sys} : ${t.dir}` : `${d.name}（这里不能投放）`;
    d.ghost.classList.toggle('invalid', !t);
  }
  dragEnd(e) {
    const d = this.drag;
    this.dragMove(e);
    const t = d.target;
    this.dragCancel();
    if (t && this.onDrop) this.onDrop(d.sys, d.paths, t.sys, t.dir);
  }
  dragCancel() {
    const d = this.drag;
    if (!d) return;
    if (d.target) d.target.el.classList.remove('drop-target');
    d.ghost.remove();
    document.body.classList.remove('dragging-file');
    this.drag = null;
  }
}

// 二维绘图指令（可复制的数据）→ Canvas。图表和程序输出都用它。
export function drawOpsOn(g, ops) {
  g.textBaseline = 'alphabetic';
  for (const op of ops) {
    switch (op[0]) {
      case 'clear': { g.fillStyle = op[1]; g.fillRect(0, 0, g.canvas.width, g.canvas.height); break; }
      case 'rect': g.fillStyle = op[5]; g.fillRect(op[1], op[2], op[3], op[4]); break;
      case 'rrect': {
        g.fillStyle = op[5];
        g.beginPath();
        g.roundRect(op[1], op[2], op[3], op[4], op[6] || 4);
        g.fill();
        break;
      }
      case 'stroke': g.strokeStyle = op[5]; g.lineWidth = op[6] || 1; g.strokeRect(op[1], op[2], op[3], op[4]); break;
      case 'line': g.strokeStyle = op[5]; g.lineWidth = op[6] || 1; g.setLineDash(op[7] || []); g.beginPath(); g.moveTo(op[1], op[2]); g.lineTo(op[3], op[4]); g.stroke(); g.setLineDash([]); break;
      case 'polyline': {
        const p = op[1];
        g.strokeStyle = op[2]; g.lineWidth = op[3] || 1; g.lineJoin = 'round';
        g.beginPath();
        for (let i = 0; i + 1 < p.length; i += 2) { if (i === 0) g.moveTo(p[i], p[i + 1]); else g.lineTo(p[i], p[i + 1]); }
        g.stroke();
        break;
      }
      case 'circle': g.fillStyle = op[4]; g.beginPath(); g.arc(op[1], op[2], op[3], 0, Math.PI * 2); g.fill(); if (op[5]) { g.strokeStyle = op[5]; g.lineWidth = op[6] || 1; g.stroke(); } break;
      case 'text':
        g.fillStyle = op[4] || '#fff';
        g.font = `${op[6] || ''} ${op[5] || 13}px "Microsoft YaHei UI","Microsoft YaHei",sans-serif`;
        g.textAlign = op[7] || 'left';
        g.fillText(op[3], op[1], op[2]);
        g.textAlign = 'left';
        break;
      default: break;
    }
  }
}
