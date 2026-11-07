/* PRISM text: glyph atlas, layout, range animators, path text, outline extraction */
(function () {
  const AE = window.AE, U = AE.U, G = AE.G;
  const T = (AE.T = {});
  T.DEFAULT_FONT = '"Bahnschrift SemiBold","DIN Alternate","Segoe UI",sans-serif';
  T.CN_FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
  T.UI_FONT = '"Microsoft YaHei","Segoe UI",sans-serif';
  T.FONT_LIST = [
    { label: 'Bahnschrift 展示体', value: T.DEFAULT_FONT, cn: false },
    { label: '微软雅黑 · 中文', value: T.CN_FONT, cn: true },
    { label: 'Segoe UI 现代', value: '"Segoe UI","Microsoft YaHei",sans-serif', cn: false },
    { label: '等线 / DIN 数字', value: '"Bahnschrift","Segoe UI",sans-serif', cn: true }
  ];
  const BASE = 176; // atlas render px
  let atlasCanvas = null, atlasCtx = null, atlas = null, atlasDirty = true, version = 0;
  const entries = new Map();
  const shelf = { x: 2, y: 2, rowH: 0, W: 2048, H: 2048 };

  function ensureAtlas() {
    if (atlasCanvas) return;
    atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = shelf.W; atlasCanvas.height = shelf.H;
    atlasCtx = atlasCanvas.getContext('2d');
    atlasCtx.clearRect(0, 0, shelf.W, shelf.H);
    atlas = null;
  }
  T.getAtlas = () => {
    ensureAtlas();
    if (atlasDirty) { atlas = { canvas: atlasCanvas, version: ++version }; atlasDirty = false; }
    return atlas;
  };
  T.atlasVersion = () => version;

  T.fontString = (font, weight, size) => `${weight || 600} ${size || BASE}px ${font || T.DEFAULT_FONT}`;

  T.glyph = (ch, font, weight) => {
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\u00a0') return null;
    const key = font + '|' + weight + '|' + ch;
    let e = entries.get(key);
    if (e) return e;
    ensureAtlas();
    const fs = BASE, PAD = 4;
    atlasCtx.font = T.fontString(font, weight, fs);
    const m = atlasCtx.measureText(ch);
    const asc = m.actualBoundingBoxAscent || fs * .8;
    const desc = m.actualBoundingBoxDescent || fs * .2;
    const left = Math.max(0, m.actualBoundingBoxLeft || 0);
    const adv = m.width || fs * .6;
    const w = Math.ceil(adv + left + PAD * 2 + 2);
    const h = Math.ceil(asc + desc + PAD * 2 + 2);
    if (shelf.x + w > shelf.W - 2) { shelf.x = 2; shelf.y += shelf.rowH + 2; shelf.rowH = 0; }
    if (shelf.y + h > shelf.H - 2) { console.warn('glyph atlas full'); return null; }
    atlasCtx.font = T.fontString(font, weight, fs);
    atlasCtx.fillStyle = '#fff';
    atlasCtx.textAlign = 'left';
    atlasCtx.textBaseline = 'alphabetic';
    atlasCtx.fillText(ch, shelf.x + PAD + left, shelf.y + PAD + asc);
    e = {
      ch, font, weight, size: fs, w, h, adv, asc, desc, left, pad: PAD,
      u0: (shelf.x + .5) / shelf.W, v0: (shelf.y + .5) / shelf.H,
      u1: (shelf.x + w - .5) / shelf.W, v1: (shelf.y + h - .5) / shelf.H,
      ax: shelf.x, ay: shelf.y,
      bearingX: -(PAD + left), bearingY: -(PAD + asc),
      x0: shelf.x, y0: shelf.y
    };
    entries.set(key, e);
    shelf.x += w + 2; shelf.rowH = Math.max(shelf.rowH, h);
    atlasDirty = true;
    return e;
  };

  T.clearAtlas = () => { entries.clear(); atlasCanvas = null; atlasCtx = null; atlasDirty = true; };

  // ---------- layout ----------
  function splitLines(content) { return String(content == null ? '' : content).split('\n'); }
  T.splitLines = splitLines;
  T.measure = (text, style) => {
    const font = style.font || T.DEFAULT_FONT, weight = style.weight || 600, size = style.fontSize || 80;
    ensureAtlas(); atlasCtx.font = T.fontString(font, weight, BASE);
    let w = 0;
    for (const ch of String(text)) w += (atlasCtx.measureText(ch).width || 0);
    return w * size / BASE;
  };

  T.charWeight = (anim, index, count) => {
    const sel = anim.selector || 'characters';
    const start = (anim.start == null ? 0 : anim.start) / 100;
    const end = (anim.end == null ? 100 : anim.end) / 100;
    const soft = (anim.softness || 0) / 100;
    const off = anim.offset || 0;
    let p = count > 1 ? index / (count - 1) : 0;
    p = p - off;
    const lo = Math.min(start, end), hi = Math.max(start, end);
    if (soft <= .001) return (p >= lo && p <= hi) ? 1 : 0;
    const a = U.smoothstep(lo - soft, lo + soft, p);
    const b = 1 - U.smoothstep(hi - soft, hi + soft, p);
    return U.clamp(Math.min(a, b));
  };

  T.layout = (layer, props, ctx) => {
    const content = String(props.content != null ? props.content : '');
    const style = {
      font: props.font || T.DEFAULT_FONT,
      weight: props.weight || 600,
      fontSize: props.fontSize || 80,
      tracking: props.tracking || 0,
      lineHeight: props.lineHeight || 1.18,
      align: props.align || 'center',
      justify: props.justify || 'top',
      strokeWidth: props.strokeWidth || 0,
      strokeColor: props.strokeColor || '#7fe7d4'
    };
    const lines = splitLines(content);
    const fontSize = style.fontSize, scale = fontSize / BASE;
    // build glyphs per line + words
    let maxW = 0;
    const built = [];
    let wordIndex = 0, charIndex = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const chars = [];
      let pen = 0;
      const words = line.split(/(\s+)/);
      let wi = 0;
      for (const wch of words) {
        const isSpace = /^\s+$/.test(wch);
        for (const ch of wch) {
          const g = T.glyph(ch, style.font, style.weight);
          if (g) {
            chars.push({ ch, g, pen, adv: g.adv * scale, word: wordIndex, char: charIndex, line: li, space: false });
          } else {
            chars.push({ ch, g: null, pen, adv: (style.fontSize * (ch === ' ' ? .3 : .6)), word: wordIndex, char: charIndex, space: true });
          }
          pen += (g ? g.adv * scale : (ch === ' ' ? fontSize * .3 : fontSize * .6)) + style.tracking;
          charIndex++;
        }
        if (isSpace) wordIndex++;
      }
      const w = chars.length ? chars[chars.length - 1].pen + chars[chars.length - 1].adv : 0;
      maxW = Math.max(maxW, w);
      built.push({ line, chars, width: w });
    }
    // vertical offsets
    const lineH = fontSize * style.lineHeight;
    const totalH = lineH * (built.length - 1) + fontSize;
    let baseY = 0;
    if (style.justify === 'middle') baseY = -totalH / 2 + fontSize * .8;
    else if (style.justify === 'bottom') baseY = -totalH + fontSize * .8;
    else baseY = fontSize * .8;
    const out = [];
    const wordCount = Math.max(1, wordIndex + (/\s$/.test(content) ? 0 : 1));
    const lineCount = Math.max(1, built.length);
    for (let li = 0; li < built.length; li++) {
      const b = built[li];
      let xoff = 0;
      if (style.align === 'center') xoff = -b.width / 2;
      else if (style.align === 'right') xoff = -b.width;
      for (const c of b.chars) {
        let gx = c.pen + xoff, gy = baseY + li * lineH;
        const glyph = c.g;
        out.push({
          ch: c.ch, g: glyph, line: c.line, word: c.word, char: c.char,
          penX: gx, baseline: gy,
          cx: gx + (glyph ? (glyph.bearingX + glyph.w / 2) * scale : c.adv / 2),
          cy: gy + (glyph ? (glyph.bearingY + glyph.h / 2) * scale : -fontSize * .3),
          x0: gx, y0: gy,
          adv: c.adv
        });
      }
    }
    // animators
    const animators = props.animators || [];
    for (let ai = 0; ai < animators.length; ai++) {
      const an = animators[ai];
      if (an.enabled === false) continue;
      const count = an.selector === 'characters' ? out.length : an.selector === 'words' ? wordCount : lineCount;
      for (const gl of out) {
        const idx = an.selector === 'characters' ? gl.char : an.selector === 'words' ? gl.word : gl.line;
        const w = T.charWeight(an, idx, count);
        if (w <= 0) continue;
        gl.penX += (an.position ? an.position[0] : 0) * w;
        gl.baseline += (an.position ? an.position[1] : 0) * w;
        gl.rot = (gl.rot || 0) + U.rad((an.rotation || 0) * w);
        gl.scale = (gl.scale || 1) * (1 + (an.scale == null ? 0 : (an.scale / 100 - 1)) * w);
        gl.opacity = (gl.opacity == null ? 1 : gl.opacity) * (an.opacity == null ? 1 : U.lerp(1, an.opacity / 100, w));
      }
    }
    for (const gl of out) {
      const g = gl.g;
      const sg = gl.scale || 1;
      if (g) {
        gl.cx = gl.penX + (g.bearingX + g.w / 2) * scale * sg;
        gl.cy = gl.baseline + (g.bearingY + g.h / 2) * scale * sg;
      } else {
        gl.cx = gl.penX + gl.adv / 2; gl.cy = gl.baseline - fontSize * .35;
      }
    }
    // path text
    if (props.onPath && props.path && props.path.contours && props.path.contours.length) {
      const contour = props.path.contours[0];
      const pts = G.sampleContour(contour, 24);
      const closed = contour.closed;
      if (closed) pts.push(pts[0]);
      const lens = [0];
      for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const total = lens[lens.length - 1] || 1;
      const align = props.pathAlign || 'center';
      const offset = (props.pathOffset || 0) * total;
      let cursor = 0;
      const totalAdv = out.reduce((a, g) => a + (g.g ? g.g.adv * scale + style.tracking : g.adv + style.tracking), 0);
      if (align === 'center') cursor = (total - totalAdv) / 2;
      else if (align === 'right') cursor = total - totalAdv;
      const at = (d) => {
        d = U.mod(d, total);
        let k = 1; while (k < lens.length - 1 && lens[k] < d) k++;
        const f = (d - lens[k - 1]) / ((lens[k] - lens[k - 1]) || 1);
        const p = [U.lerp(pts[k - 1][0], pts[k][0], f), U.lerp(pts[k - 1][1], pts[k][1], f)];
        const q = pts[Math.min(k, pts.length - 1)], q0 = pts[Math.max(0, k - 1)];
        const ang = Math.atan2(q[1] - q0[1], q[0] - q0[0]);
        return { p, ang };
      };
      for (const gl of out) {
        const adv = gl.g ? gl.g.adv * scale : gl.adv;
        const info = at(cursor + adv / 2 + offset);
        gl.penX = info.p[0];
        gl.baseline = info.p[1] + fontSize * .36;
        gl.rot = (gl.rot || 0) + info.ang;
        gl.pathPos = info.p;
        gl.cx = info.p[0]; gl.cy = info.p[1];
        cursor += adv + style.tracking;
      }
    }
    const b = T.layoutBounds(out);
    return { glyphs: out, width: maxW, height: totalH, lines: built, bounds: b, style, ctx };
  };

  T.layoutBounds = (glyphs) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const gl of glyphs) {
      const g = gl.g;
      if (!g) continue;
      const sc = gl.scale || 1, rot = gl.rot || 0;
      const w = g.w * (g.size ? 1 : 1) * (gl.fontScale || 1);
      // approximate glyph quad corners with the atlas image size in layout units
      const pxs = g.size || 176;
      const dw = g.w, dh = g.h;
      const ax = gl.penX + g.bearingX, ay = gl.baseline + g.bearingY;
      const c = Math.cos(rot), sn = Math.sin(rot);
      for (const [px, py] of [[0, 0], [dw, 0], [0, dh], [dw, dh]]) {
        const dx = px * sc, dy = py * sc;
        const X = ax + dx * c - dy * sn, Y = ay + dx * sn + dy * c;
        x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
      }
    }
    if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };

  // per glyph size in layout px needed by renderer
  T.glyphSize = (gl, fontSize) => {
    if (!gl.g) return null;
    const s = fontSize / (gl.g.size || BASE);
    return {
      x: gl.penX + gl.g.bearingX * s,
      y: gl.baseline + gl.g.bearingY * s,
      w: gl.g.w * s, h: gl.g.h * s,
      u0: gl.g.u0, v0: gl.g.v0, u1: gl.g.u1, v1: gl.g.v1,
      rot: gl.rot || 0, scale: gl.scale || 1, opacity: gl.opacity == null ? 1 : gl.opacity,
      u0p: gl.g.u0, v0p: gl.g.v0, u1p: gl.g.u1, v1p: gl.g.v1
    };
  };

  // ---------- outline extraction ----------
  const outlineCache = new Map();
  T.outline = (ch, font, weight, quality = 1) => {
    if (!ch || /\s/.test(ch)) return { contours: [] };
    const key = ch + '|' + font + '|' + weight;
    if (outlineCache.has(key)) return outlineCache.get(key);
    const FS = 300, PAD = 24;
    const cv = document.createElement('canvas');
    const ctx0 = cv.getContext('2d');
    ctx0.font = T.fontString(font, weight, FS);
    const m0 = ctx0.measureText(ch);
    const ascM = m0.actualBoundingBoxAscent || FS * .8, descM = m0.actualBoundingBoxDescent || FS * .2;
    const leftM = Math.max(0, m0.actualBoundingBoxLeft || 0), rightM = Math.max(0, m0.actualBoundingBoxRight || m0.width);
    const W = Math.ceil(leftM + m0.width + PAD * 2 + 4), H = Math.ceil(ascM + descM + PAD * 2 + 4);
    cv.width = Math.max(8, W); cv.height = Math.max(8, H);
    const ctx = cv.getContext('2d');
    ctx.font = T.fontString(font, weight, FS);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const penX = PAD + leftM, baseY = PAD + ascM;
    ctx.fillText(ch, penX, baseY);
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const CW = cv.width, CH = cv.height;
    const filled = new Uint8Array(CW * CH);
    for (let i = 0; i < CW * CH; i++) filled[i] = data[i * 4 + 3] > 127 ? 1 : 0;
    // build boundary edges (fill on the right side)
    const edges = [];
    const at = (x, y) => (x < 0 || y < 0 || x >= CW || y >= CH) ? 0 : filled[y * CW + x];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (!filled[y * CW + x]) continue;
      if (!at(x, y - 1)) edges.push({ x0: x, y0: y, x1: x + 1, y1: y });
      if (!at(x + 1, y)) edges.push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1 });
      if (!at(x, y + 1)) edges.push({ x0: x + 1, y0: y + 1, x1: x, y1: y + 1 });
      if (!at(x - 1, y)) edges.push({ x0: x, y0: y + 1, x1: x, y1: y });
    }
    const starts = new Map();
    const vk = (x, y) => x + ',' + y;
    for (let i = 0; i < edges.length; i++) {
      const k = vk(edges[i].x0, edges[i].y0);
      if (!starts.has(k)) starts.set(k, []);
      starts.get(k).push(i);
    }
    const used = new Uint8Array(edges.length);
    const loops = [];
    for (let i = 0; i < edges.length; i++) {
      if (used[i]) continue;
      const loop = [];
      let cur = i, guard = 0;
      while (guard++ < edges.length + 8) {
        if (used[cur]) break;
        used[cur] = 1;
        const e = edges[cur];
        loop.push([e.x0, e.y0]);
        const cands = (starts.get(vk(e.x1, e.y1)) || []).filter(j => !used[j]);
        if (!cands.length) break;
        let next = cands[0];
        if (cands.length > 1) {
          const dx = e.x1 - e.x0, dy = e.y1 - e.y0;
          const score = (j) => {
            const f = edges[j], fx = f.x1 - f.x0, fy = f.y1 - f.y0;
            const cross = dx * fy - dy * fx; // right turn (screen coords) positive
            const dot = dx * fx + dy * fy;
            return cross * 10 + dot;
          };
          cands.sort((a, b) => score(b) - score(a));
          next = cands[0];
        }
        cur = next;
      }
      if (loop.length > 6) loops.push(loop);
    }
    // simplify and smooth
    const contours = [];
    for (const loop of loops) {
      let pts = simplify(loop, 1.15);
      if (pts.length < 3) continue;
      // remove micro jitter: light 3-point averaging while keeping ends
      const n = Math.max(18, Math.min(180, Math.round(pts.length * 1.4)));
      const res = resampleLoop(pts, n);
      const em = res.map(p => [(p[0] - penX) / FS, (p[1] - baseY) / FS]);
      contours.push(G.pathFromPoints(em, true, true));
    }
    const res = {
      shape: { contours },
      advance: m0.width / FS,
      ascent: ascM / FS,
      descent: descM / FS,
      size: FS
    };
    outlineCache.set(key, res);
    return res;
  };
  function resampleLoop(pts, n) {
    if (pts.length < 2) return pts;
    const arr = pts.concat([pts[0]]);
    const lens = [0];
    for (let i = 1; i < arr.length; i++) lens.push(lens[i - 1] + Math.hypot(arr[i][0] - arr[i - 1][0], arr[i][1] - arr[i - 1][1]));
    const total = lens[lens.length - 1] || 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = total * i / n;
      let k = 1; while (k < lens.length - 1 && lens[k] < d) k++;
      const f = (d - lens[k - 1]) / ((lens[k] - lens[k - 1]) || 1);
      out.push([U.lerp(arr[k - 1][0], arr[k][0], f), U.lerp(arr[k - 1][1], arr[k][1], f)]);
    }
    return out;
  }
  function simplify(pts, eps) {
    if (pts.length < 3) return pts;
    const sq = eps * eps;
    function rdp(arr) {
      let dmax = 0, idx = 0;
      const a = arr[0], b = arr[arr.length - 1];
      for (let i = 1; i < arr.length - 1; i++) {
        const d = sqSeg(arr[i], a, b);
        if (d > dmax) { dmax = d; idx = i; }
      }
      if (dmax > sq) return rdp(arr.slice(0, idx + 1)).slice(0, -1).concat(rdp(arr.slice(idx)));
      return [a, b];
    }
    function sqSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy; if (!l2) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2; let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; t = U.clamp(t); return (p[0] - (a[0] + dx * t)) ** 2 + (p[1] - (a[1] + dy * t)) ** 2; }
    const a = rdp(pts.concat([pts[0]]));
    a.pop();
    return a;
  }
  T.simplify = simplify;

  // text outline shape (multiple glyphs, positioned & scaled) for 2D stroke / 3D extrude / mesh
  T.outlineShape = (layout, opts = {}) => {
    const contours = [];
    const scaleY = opts.flipY ? -1 : 1;
    for (const gl of layout.glyphs) {
      if (!gl.g) continue;
      const gls = gl.scale || 1;
      const o = T.outline(gl.ch, layout.style.font, layout.style.weight);
      if (!o.shape.contours.length) continue;
      const fs = layout.style.fontSize;
      const rot = gl.rot || 0;
      const cx = gl.cx - gl.penX, cy = gl.cy - gl.baseline;
      // translate to center, rotate/scale about center, then place and scale em outline
      let m = U.affine.mul([Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), gl.penX + cx, gl.baseline + cy],
        U.affine.mul([gls, 0, 0, gls, 0, 0], [1, 0, 0, scaleY, 0, 0]));
      m = U.affine.mul(m, [1, 0, 0, 1, -cx / gls, -cy / gls]);
      m = U.affine.mul([fs, 0, 0, fs, 0, 0], m);
      // rebuild correctly: em -> layout px, then pivot transform
      const emToPx = U.affine.mul([1, 0, 0, 1, gl.penX, gl.baseline], [fs, 0, 0, fs * scaleY, 0, 0]);
      const pivot = U.affine.mul([1, 0, 0, 1, gl.cx, gl.cy], U.affine.mul([Math.cos(rot) * gls, Math.sin(rot) * gls, -Math.sin(rot) * gls, Math.cos(rot) * gls, 0, 0], [1, 0, 0, 1, -gl.cx, -gl.cy]));
      const mat = U.affine.mul(pivot, emToPx);
      for (const c of o.shape.contours) contours.push({
        closed: c.closed, verts: c.verts.map(v => ({
          p: U.affine.apply(mat, v.p[0], v.p[1]), in: U.affine.apply(mat, v.in[0], v.in[1]), out: U.affine.apply(mat, v.out[0], v.out[1])
        }))
      });
    }
    return { contours };
  };
  T.outlineWidth = (layout) => {
    const b = { x0: Infinity, x1: -Infinity };
    for (const gl of layout.glyphs) { if (!gl.g) continue; b.x0 = Math.min(b.x0, gl.penX); b.x1 = Math.max(b.x1, gl.penX + gl.g.adv * (layout.style.fontSize / (gl.g.size || BASE))); }
    if (!isFinite(b.x0)) return 0;
    return b.x1 - b.x0;
  };

  // check whether a font can render a char
  T.supports = (ch, font, weight) => {
    ensureAtlas(); atlasCtx.font = T.fontString(font, weight || 600, 60);
    const m = atlasCtx.measureText(ch);
    return m.width > 0;
  };
  AE.Text = T;
})();
