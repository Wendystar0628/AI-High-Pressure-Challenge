// 显示设备（宿主提供）。按程序经系统接口提交的显示列表绘制画面：
// 显示列表是可复制的数据，设备只负责把它画出来；不推进任何程序状态。
// 每个显示面（surface）以全局标识区分：<系统>:desktop、<系统>:wN、<窗口>@proj ……
import { Scene3D } from './scene3d.js';

const FONTS = {
  ui: '"HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif',
  mono: '"Cascadia Mono", "Consolas", "Microsoft YaHei UI", monospace',
  display: '"HarmonyOS Sans SC", "Segoe UI", "Microsoft YaHei UI", sans-serif',
};
const SHADOWS = ['none', '0 1px 3px rgba(0,0,0,.35)', '0 6px 18px rgba(0,0,0,.38)', '0 14px 40px rgba(0,0,0,.5)'];

export function sysOfSid(sid) {
  const i = sid.indexOf(':');
  return i < 0 ? sid : sid.slice(0, i);
}

export class DisplayDevice {
  constructor() {
    this.surfaces = new Map();
    this.res = new Map();
    this.scene3d = new Scene3D(this);
    this.onInput = null;      // (sid, ev) 设备输入框事件
    this.onSynthetic = null;  // (clientX, clientY, el) 合成点击（自动化 element.click()）
    this.onMeta = null;
    this.projPause = null;    // (sid) => 暂停原因或 null
    this.renderCount = 0;
  }

  // ---------- 显示面 ----------
  surface(sid) {
    let s = this.surfaces.get(sid);
    if (!s) {
      const el = document.createElement('div');
      el.className = 'surface';
      el.dataset.sid = sid;
      s = { sid, sys: sysOfSid(sid), el, list: null, meta: null, keyed: new Map(), ctx: null, overlay: null };
      this.surfaces.set(sid, s);
      this.bindSurface(s);
    }
    return s;
  }
  surfaceEl(sid) { return this.surface(sid).el; }
  setContext(sid, ctx) {
    const s = this.surface(sid);
    const key = JSON.stringify(ctx || null);
    if (s.ctxKey === key) return;
    s.ctx = ctx; s.ctxKey = key;
    if (s.list) this.render(s);
  }
  submit(sid, list, meta) {
    if (list == null) { this.drop(sid); return; }
    const s = this.surface(sid);
    s.list = list; s.meta = meta || null; s.time = performance.now();
    this.render(s);
    if (this.onMeta) this.onMeta(sid, meta);
  }
  drop(sid) {
    const s = this.surfaces.get(sid);
    if (!s) return;
    this.scene3d.detachSurface(s.el);
    s.el.remove();
    this.surfaces.delete(sid);
  }
  dropSystems(ids) {
    for (const [sid, s] of [...this.surfaces]) if (ids.has(s.sys)) this.drop(sid);
    this.scene3d.dropSystems(ids);
    for (const id of ids) this.res.delete(id);
  }
  resource(sys, name, data) {
    const r = this.res.get(sys) || {};
    r[name] = data;
    this.res.set(sys, r);
    for (const s of this.surfaces.values()) if (s.sys === sys && s.list) this.render(s);
  }
  icons(sys) { const r = this.res.get(sys) || this.res.get('outer') || {}; return r.icons || (this.res.get('outer') || {}).icons || {}; }
  scene(op, sid, data) { this.scene3d.op(op, sid, data); }

  capture(ids) {
    const set = new Set(ids);
    const surfaces = [];
    for (const s of this.surfaces.values()) if (set.has(s.sys) && s.list) surfaces.push([s.sid, s.list, s.meta]);
    const res = {};
    for (const id of set) if (this.res.has(id)) res[id] = this.res.get(id);
    return JSON.parse(JSON.stringify({ surfaces, res, scenes: this.scene3d.capture(set) }));
  }
  restore(data) {
    if (!data) return;
    for (const id of Object.keys(data.res || {})) this.res.set(id, data.res[id]);
    this.scene3d.restore(data.scenes || []);
    for (const [sid, list, meta] of data.surfaces || []) this.submit(sid, list, meta);
  }

  // ---------- 绘制 ----------
  render(s) {
    this.renderCount++;
    const list = s.list;
    const el = s.el;
    el.style.width = (list.w || 100) + 'px';
    el.style.height = (list.h || 100) + 'px';
    el.style.background = list.bg || 'transparent';
    let ctxSys = s.sys, ctxWin = null;
    if (s.sid.includes('@proj')) { if (s.ctx) { ctxSys = s.ctx.systemId; ctxWin = s.ctx.windowId; } }
    else if (!s.sid.endsWith(':desktop')) ctxWin = s.sid;
    const env = { s, ctxSys, ctxWin, icons: this.icons(s.sys), winStack: [] };
    this.reconcile(el, list.nodes || [], env, s.keyed);
    this.updateOverlay(s);
  }
  updateOverlay(s) {
    if (!s.sid.includes('@proj') || !this.projPause) return;
    const why = this.projPause(s.sid);
    if (why) {
      if (!s.overlay) { s.overlay = document.createElement('div'); s.overlay.className = 'proj-paused'; }
      s.overlay.textContent = why;
      if (s.overlay.parentNode !== s.el) s.el.appendChild(s.overlay);
      s.el.classList.add('frozen');
    } else if (s.overlay) { s.overlay.remove(); s.el.classList.remove('frozen'); }
  }
  refreshOverlays() { for (const s of this.surfaces.values()) this.updateOverlay(s); }

  reconcile(parent, nodes, env, keyed) {
    const seen = new Set();
    const order = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || typeof n !== 'object') continue;
      const key = (n.k != null ? 'k:' + n.k : n.t + ':' + i);
      seen.add(key);
      let rec = keyed.get(key);
      const tag = n.t === 'input' ? (n.multi ? 'textarea' : 'input') : n.t === 'view3d' ? 'canvas' : n.t === 'svg' ? 'svg' : 'div';
      if (!rec || rec.tag !== tag || rec.t !== n.t) {
        if (rec) this.disposeEl(rec.el);
        const el = tag === 'svg' ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement(tag);
        rec = { el, tag, t: n.t, keyed: new Map(), sig: '' };
        keyed.set(key, rec);
        if (tag === 'input' || tag === 'textarea') this.bindField(rec, env);
      }
      this.apply(rec, n, env);
      order.push(rec.el);
    }
    for (const [key, rec] of keyed) if (!seen.has(key)) { this.disposeEl(rec.el); rec.el.remove(); keyed.delete(key); }
    // 按显示列表顺序排列（决定遮挡次序）
    let cur = parent.firstChild;
    for (const el of order) {
      if (cur === el) { cur = cur.nextSibling; continue; }
      parent.insertBefore(el, cur);
    }
  }
  disposeEl(el) { if (el.tagName === 'CANVAS') this.scene3d.detachCanvas(el); el.querySelectorAll && el.querySelectorAll('canvas').forEach((c) => this.scene3d.detachCanvas(c)); }

  apply(rec, n, env) {
    const el = rec.el;
    const st = el.style;
    const isSvgRoot = rec.tag === 'svg';
    st.position = 'absolute';
    st.left = (n.x || 0) + 'px'; st.top = (n.y || 0) + 'px';
    st.width = Math.max(0, n.w || 0) + 'px'; st.height = Math.max(0, n.h || 0) + 'px';
    st.opacity = n.op == null ? '' : String(n.op);
    st.display = n.hidden ? 'none' : '';
    st.cursor = n.cursor || '';
    // 标识与可访问名称
    if (n.tid) {
      el.setAttribute('data-testid', n.tid);
      el.setAttribute('data-system-id', env.ctxSys);
      const wid = (n.attrs && n.attrs['window-id']) || env.ctxWin;
      if (wid) el.setAttribute('data-window-id', wid); else el.removeAttribute('data-window-id');
      if (env.s.ctx && env.s.ctx.source) for (const k of Object.keys(env.s.ctx.source)) el.setAttribute('data-' + k, env.s.ctx.source[k]);
    } else if (el.hasAttribute('data-testid')) { el.removeAttribute('data-testid'); el.removeAttribute('data-system-id'); el.removeAttribute('data-window-id'); }
    if (n.attrs) for (const k of Object.keys(n.attrs)) { const v = n.attrs[k]; if (v == null) el.removeAttribute('data-' + k); else el.setAttribute('data-' + k, String(v)); }
    if (n.label) el.setAttribute('aria-label', String(n.label)); else if (rec.tag !== 'input' && rec.tag !== 'textarea') el.removeAttribute('aria-label');
    if (n.role) el.setAttribute('role', n.role);
    if (n.title) el.setAttribute('title', n.title); else el.removeAttribute('title');
    if (n.disabled) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
    switch (n.t) {
      case 'box': {
        el.className = 'n-box';
        st.background = n.grad ? `linear-gradient(${n.grad[2] || 180}deg, ${n.grad[0]}, ${n.grad[1]})` : (n.fill || 'transparent');
        st.border = n.stroke ? `${n.sw || 1}px solid ${n.stroke}` : 'none';
        st.borderRadius = n.r ? n.r + 'px' : '';
        st.boxShadow = n.shadow ? SHADOWS[n.shadow] || SHADOWS[2] : '';
        st.backdropFilter = n.blur ? `blur(${n.blur}px)` : '';
        st.boxSizing = 'border-box';
        break;
      }
      case 'text': {
        el.className = 'n-text' + (n.wrap ? ' wrap' : '');
        if (el.textContent !== n.text) el.textContent = n.text;
        st.fontSize = (n.size || 12) + 'px';
        st.color = n.color || '#e7ecf6';
        st.fontWeight = n.weight || '';
        st.fontFamily = FONTS[n.font] || FONTS.ui;
        st.textAlign = n.align || 'left';
        st.lineHeight = n.lh ? n.lh + 'px' : (n.valign === 'middle' && !n.wrap ? (n.h || 16) + 'px' : '');
        st.textShadow = n.shadow ? '0 1px 3px rgba(0,0,0,.85)' : '';
        st.whiteSpace = n.wrap ? 'pre-wrap' : 'pre';
        st.background = n.bg || '';
        break;
      }
      case 'icon': {
        el.className = 'n-icon';
        const sig = n.name + '|' + (n.color || '') + '|' + (n.w || 16);
        if (rec.sig !== sig) { rec.sig = sig; el.innerHTML = iconSvg(env.icons[n.name] || env.icons.file, n.color); }
        st.color = n.color || '#e7ecf6';
        break;
      }
      case 'group': {
        el.className = 'n-group';
        st.overflow = n.clip ? 'hidden' : '';
        st.borderRadius = n.r ? n.r + 'px' : '';
        this.reconcile(el, n.kids || [], env, rec.keyed);
        break;
      }
      case 'surf': {
        el.className = 'n-surf';
        st.overflow = 'hidden';
        const target = this.surface(n.ref);
        if (n.ref.includes('@proj')) {
          const wid = env.winStack.length ? env.winStack[env.winStack.length - 1] : null;
          this.setContext(n.ref, { systemId: env.ctxSys, windowId: (n.attrs && n.attrs['window-id']) || wid || env.ctxWin });
        }
        if (target.el.parentNode !== el) { el.innerHTML = ''; el.appendChild(target.el); }
        break;
      }
      case 'input': {
        el.className = 'n-input' + (n.mono ? ' mono' : '');
        if (rec.tag === 'input') el.type = 'text';
        el.placeholder = n.ph || '';
        el.setAttribute('aria-label', n.label || n.id || '输入');
        el.dataset.field = n.id;
        st.fontSize = (n.size || 12) + 'px';
        st.fontFamily = n.mono ? FONTS.mono : FONTS.ui;
        if (n.readonly) el.setAttribute('readonly', ''); else el.removeAttribute('readonly');
        rec.field = n.id;
        const v = n.value == null ? '' : String(n.value);
        const forced = n.rev != null && n.rev !== rec.rev;
        if (forced || (document.activeElement !== el && el.value !== v) || (rec.lastSent === undefined && el.value !== v)) {
          el.value = v; rec.last = v;
        }
        rec.rev = n.rev;
        rec.lastSent = v;
        if (n.scrollTop != null && forced) el.scrollTop = n.scrollTop;
        break;
      }
      case 'svg': {
        el.setAttribute('viewBox', `0 0 ${n.vb ? n.vb[0] : n.w} ${n.vb ? n.vb[1] : n.h}`);
        el.setAttribute('class', 'n-svg');
        const html = svgKids(n.kids || []);
        if (rec.sig !== html) { rec.sig = html; el.innerHTML = html; }
        break;
      }
      case 'view3d': {
        el.className = 'n-view3d';
        this.scene3d.attachCanvas(el, n.scene, n.w, n.h, n);
        break;
      }
      default: break;
    }
    if (n.attrs && n.attrs['window-id'] && n.t === 'group') {
      // 子节点处于该窗口范围内（供投送面确定所属窗口）
    }
    void isSvgRoot;
  }

  // ---------- 输入 ----------
  bindSurface(s) {
    // 自动化工具的 element.click() 不带坐标：换算为元素中心的指针事件
    s.el.addEventListener('click', (e) => {
      if (e.isTrusted) return;
      e.stopPropagation();
      const t = e.target.closest('[data-testid]') || e.target;
      const r = t.getBoundingClientRect();
      if (this.onSynthetic) this.onSynthetic(r.left + r.width / 2, r.top + r.height / 2, t);
    }, true);
  }
  bindField(rec, env) {
    const el = rec.el;
    const sidOf = () => { const sEl = el.closest('.surface'); return sEl ? sEl.dataset.sid : env.s.sid; };
    rec.last = '';
    el.addEventListener('input', () => {
      const v = el.value; const old = rec.last == null ? '' : rec.last;
      let a = 0; while (a < old.length && a < v.length && old[a] === v[a]) a++;
      let b = 0; while (b < old.length - a && b < v.length - a && old[old.length - 1 - b] === v[v.length - 1 - b]) b++;
      rec.last = v;
      if (this.onInput) this.onInput(sidOf(), { type: 'text', field: rec.field, from: a, to: old.length - b, ins: v.slice(a, v.length - b), len: v.length });
    });
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const special = ['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'F5'].includes(e.key) || e.ctrlKey || e.metaKey;
      if (e.key === 'Tab' && rec.tag === 'textarea') {
        e.preventDefault();
        const s0 = el.selectionStart, s1 = el.selectionEnd;
        el.setRangeText('  ', s0, s1, 'end');
        el.dispatchEvent(new Event('input'));
        return;
      }
      if (special && this.onInput) {
        if (e.ctrlKey && ['s', 'Enter'].includes(e.key)) e.preventDefault();
        if (e.key === 'Enter' && rec.tag === 'input') e.preventDefault();
        this.onInput(sidOf(), { type: 'key', key: e.key, code: e.code, field: rec.field, inField: true, mods: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey } });
      }
    });
    el.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('focus', () => {
      // 非指针造成的聚焦（例如自动化填写）：先送一次点击，让窗口管理程序把焦点交给该窗口
      if (!this.pointerFocus && this.onSynthetic) {
        const r = el.getBoundingClientRect();
        this.onSynthetic(r.left + Math.min(r.width / 2, 20), r.top + r.height / 2, el, true);
      }
    });
  }
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function iconSvg(layers, color) {
  if (!layers) return '';
  let out = '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">';
  for (const l of layers) {
    const c = l[1] === 'cur' ? (color || 'currentColor') : l[1];
    if (l[2]) out += `<path d="${l[0]}" fill="none" stroke="${c}" stroke-width="${l[2]}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else out += `<path d="${l[0]}" fill="${c}"/>`;
  }
  return out + '</svg>';
}
function svgKids(kids) {
  let s = '';
  for (const k of kids) {
    if (!k) continue;
    const common = `${k.fill != null ? ` fill="${esc(k.fill)}"` : ''}${k.stroke ? ` stroke="${esc(k.stroke)}" stroke-width="${k.sw || 1}"` : ''}${k.op != null ? ` opacity="${k.op}"` : ''}${k.dash ? ` stroke-dasharray="${k.dash}"` : ''}`;
    const tid = k.tid ? ` data-testid="${esc(k.tid)}"` : '';
    const lab = k.label ? ` aria-label="${esc(k.label)}"` : '';
    switch (k.e) {
      case 'rect': s += `<rect x="${k.x}" y="${k.y}" width="${Math.max(0, k.w)}" height="${Math.max(0, k.h)}" rx="${k.r || 0}"${common}${tid}${lab}/>`; break;
      case 'circle': s += `<circle cx="${k.cx}" cy="${k.cy}" r="${k.r}"${common}${tid}${lab}/>`; break;
      case 'line': s += `<line x1="${k.x1}" y1="${k.y1}" x2="${k.x2}" y2="${k.y2}"${common}/>`; break;
      case 'path': s += `<path d="${esc(k.d)}"${common} stroke-linejoin="round" stroke-linecap="round"/>`; break;
      case 'poly': s += `<polyline points="${(k.pts || []).join(' ')}"${common} fill="${k.fill || 'none'}" stroke-linejoin="round" stroke-linecap="round"/>`; break;
      case 'text': s += `<text x="${k.x}" y="${k.y}" font-size="${k.size || 12}" fill="${esc(k.fill || '#e7ecf6')}" text-anchor="${k.anchor || 'start'}" font-weight="${k.weight || 400}" font-family='"HarmonyOS Sans SC","Microsoft YaHei UI",sans-serif'${k.rot ? ` transform="rotate(${k.rot} ${k.x} ${k.y})"` : ''}>${esc(k.text)}</text>`; break;
      default: break;
    }
  }
  return s;
}
