/* ============================================================
   text.js — 文字排版、字符动画器、字形轮廓提取（可转为几何）
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const G = AE.geom;
  const T = AE.text = {};

  T.FONTS = [
    { id: 'Microsoft YaHei', label: '微软雅黑', cn: true, weight: 400 },
    { id: 'Microsoft YaHei UI', label: '雅黑 UI', cn: true, weight: 400 },
    { id: 'SimHei', label: '黑体', cn: true, weight: 400 },
    { id: 'SimSun', label: '宋体', cn: true, weight: 400 },
    { id: 'KaiTi', label: '楷体', cn: true, weight: 400 },
    { id: 'Arial', label: 'Arial', cn: false, weight: 400 },
    { id: 'Georgia', label: 'Georgia', cn: false, weight: 400 }
  ];

  let measureCanvas = null, measureCtx = null;
  function mctx() {
    if (!measureCanvas) {
      measureCanvas = document.createElement('canvas');
      measureCanvas.width = 64; measureCanvas.height = 64;
      measureCtx = measureCanvas.getContext('2d');
    }
    return measureCtx;
  }

  T.fontString = function (family, weight, size) {
    family = family || 'Microsoft YaHei';
    return `${weight || 400} ${size || 100}px "${family}", "Microsoft YaHei", "SimHei", "PingFang SC", sans-serif`;
  };
  T.fontLabel = function (id) {
    const f = T.FONTS.find(x => x.id === id);
    return f ? f.label : id;
  };
  T.supportsChinese = function (id) {
    const f = T.FONTS.find(x => x.id === id);
    return f ? f.cn : false;
  };

  // ---------------- 排版 ----------------
  T.layout = function (params) {
    const text = String(params.text === undefined ? '锻字' : params.text);
    const fontSize = Math.max(1, params.fontSize || 100);
    const font = params.font || 'Microsoft YaHei';
    const weight = params.weight || 400;
    const tracking = params.tracking || 0;
    const lineHeightPct = params.lineHeight || 120;
    const align = params.align || 'center';
    const ctx = mctx();
    ctx.font = T.fontString(font, weight, fontSize);
    const lines = text.split('\n');
    const all = [];
    let maxWidth = 0;
    const wordSet = [];
    let wordCounter = 0;
    let lastWasCJK = false;
    lines.forEach((lineStr, li) => {
      const chars = [];
      let x = 0;
      let widx = -1;
      for (let i = 0; i < lineStr.length; i++) {
        const ch = lineStr[i];
        const w = ctx.measureText(ch).width;
        const isSpace = /\s/.test(ch);
        const isCJK = /[\u3000-\u9fff\uff00-\uffef]/.test(ch);
        if (isSpace) {
          widx = -1;
        } else if (isCJK || widx < 0) {
          widx = wordCounter++;
        }
        const item = {
          ch, x, w, line: li, index: all.length,
          word: isSpace ? -1 : widx,
          isSpace,
          cx: 0, cy: 0, baseline: 0
        };
        chars.push(item);
        all.push(item);
        x += w + tracking;
      }
      const lineW = Math.max(0, x - (chars.length ? tracking : 0));
      maxWidth = Math.max(maxWidth, lineW);
      lines[li] = { str: lineStr, chars, lineW };
    });
    const lineHeightPx = fontSize * lineHeightPct / 100;
    const blockHeight = (lines.length - 1) * lineHeightPx + fontSize;
    let visIndex = 0;
    lines.forEach((line, li) => {
      const baseline = -blockHeight / 2 + fontSize * 0.885 + li * lineHeightPx;
      for (const c of line.chars) {
        if (align === 'left') c.alignX = -maxWidth / 2;
        else if (align === 'right') c.alignX = maxWidth / 2 - line.lineW;
        else c.alignX = -line.lineW / 2;
        c.baseline = baseline;
        c.cx = c.alignX + c.x + c.w / 2;
        c.cy = baseline - fontSize * 0.36;
        c.charCenterY = c.cy;
        if (!c.isSpace) c.visIndex = visIndex++;
      }
    });
    all.forEach((c, i) => { c.index = i; });
    return {
      text, font, weight, fontSize, tracking, lineHeightPct, align,
      lines, chars: all, width: maxWidth, height: blockHeight,
      lineHeightPx, fontString: T.fontString(font, weight, fontSize)
    };
  };

  T.layerParams = function (layer, t) {
    const tx = layer.text;
    const ctx = A.newCtx(layer._comp, layer, t);
    return {
      text: tx.content === undefined ? '' : tx.content,
      font: tx.font,
      weight: A.n(A.sample(tx.weight, t, layer, ctx)) || 400,
      fontSize: Math.max(1, A.n(A.sample(tx.fontSize, t, layer, ctx))),
      tracking: A.n(A.sample(tx.tracking, t, layer, ctx)),
      lineHeight: A.n(A.sample(tx.lineHeight, t, layer, ctx)),
      align: tx.align || 'center'
    };
  };

  T.getLayout = function (layer, t) {
    return T.layout(T.layerParams(layer, t));
  };

  // ---------------- 字符动画器 ----------------
  T.animatorWeights = function (layer, t, layout) {
    const anims = layer.text.animators || [];
    const chars = layout.chars;
    const result = chars.map(() => ({ px: 0, py: 0, rot: 0, sx: 1, sy: 1, opacity: 1, color: null }));
    const total = chars.filter(c => !c.isSpace).length;
    const maxWord = chars.reduce((m, c) => Math.max(m, c.word), 0) + 1;
    const totalLines = layout.lines.length;
    for (const an of anims) {
      if (an.enabled === false) continue;
      const ctx = A.newCtx(layer._comp, layer, t);
      const sel = an.selector || {};
      const start = A.n(A.sample(sel.start, t, layer, ctx));
      const end = A.n(A.sample(sel.end, t, layer, ctx));
      const offset = A.n(A.sample(sel.offset, t, layer, ctx));
      const soft = Math.max(0, A.n(A.sample(sel.soft, t, layer, ctx)));
      const pos = A.vec3(A.sample(an.position, t, layer, ctx));
      const rot = A.n(A.sample(an.rotation, t, layer, ctx));
      const sc = A.vec3(A.sample(an.scale, t, layer, ctx));
      const op = A.n(A.sample(an.opacity, t, layer, ctx));
      const mode = an.mode || 'char';
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        let u;
        if (mode === 'line') u = totalLines <= 1 ? 0 : (c.line / (totalLines - 1)) * 100;
        else if (mode === 'word') u = maxWord <= 1 ? 0 : ((c.word < 0 ? 0 : c.word) / (maxWord - 1)) * 100;
        else u = total <= 1 ? 0 : (c.visIndex === undefined ? i : c.visIndex) / Math.max(1, chars.length - 1) * 100;
        const s = start + offset, e = end + offset;
        let w = 1;
        if (soft <= 0.01) w = (u >= s && u <= e) ? 1 : 0;
        else {
          const a = U.smoothstep(s - soft, s + soft, u);
          const b = 1 - U.smoothstep(e - soft, e + soft, u);
          w = U.clamp(a * b, 0, 1);
        }
        if (w <= 0) continue;
        const r = result[i];
        r.px += pos.x * w; r.py += pos.y * w;
        r.rot += rot * w;
        r.sx += (sc.x / 100 - 1) * w; r.sy += (sc.y / 100 - 1) * w;
        r.opacity *= 1 + (op / 100 - 1) * w;
      }
    }
    return result;
  };

  // ---------------- 绘制 ----------------
  T.drawLayer = function (ctx, layer, t, opts) {
    opts = opts || {};
    const layout = T.getLayout(layer, t);
    const weights = T.animatorWeights(layer, t, layout);
    const tx = layer.text;
    const ctxA = A.newCtx(layer._comp, layer, t);
    const fillColor = tx.fillColor ? A.sample(tx.fillColor, t, layer, ctxA) : '#ffffff';
    const fillOpacity = tx.fillOpacity ? U.clamp(A.n(A.sample(tx.fillOpacity, t, layer, ctxA)), 0, 100) / 100 : 1;
    const strokeColor = tx.strokeColor ? A.sample(tx.strokeColor, t, layer, ctxA) : '#ffffff';
    const strokeW = tx.strokeWidth ? A.n(A.sample(tx.strokeWidth, t, layer, ctxA)) : 0;
    const strokeOpacity = tx.strokeOpacity ? U.clamp(A.n(A.sample(tx.strokeOpacity, t, layer, ctxA)), 0, 100) / 100 : 1;
    const fontSize = layout.fontSize;
    ctx.save();
    ctx.font = layout.fontString;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (let i = 0; i < layout.chars.length; i++) {
      const c = layout.chars[i];
      if (c.isSpace) continue;
      const wgt = weights[i];
      if (wgt.opacity <= 0.001) continue;
      const sx = Math.max(0.001, wgt.sx), sy = Math.max(0.001, wgt.sy);
      ctx.save();
      ctx.translate(c.cx + wgt.px, c.cy + wgt.py);
      ctx.rotate(wgt.rot * U.DEG);
      ctx.scale(sx, sy);
      ctx.globalAlpha = (opts.alpha === undefined ? 1 : opts.alpha) * wgt.opacity * fillOpacity;
      const drawX = -c.w / 2;
      const drawY = c.baseline - c.cy;
      if (fillOpacity > 0.001) {
        ctx.fillStyle = fillColor;
        ctx.fillText(c.ch, drawX, drawY);
      }
      if (strokeW > 0.01 && strokeOpacity > 0.001) {
        ctx.globalAlpha = (opts.alpha === undefined ? 1 : opts.alpha) * wgt.opacity * strokeOpacity;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeW;
        ctx.strokeText(c.ch, drawX, drawY);
      }
      ctx.restore();
    }
    ctx.restore();
    return layout;
  };

  T.measureLayer = function (layer, t) {
    const layout = T.getLayout(layer, t);
    return { width: layout.width, height: layout.height };
  };

  // ---------------- 字形轮廓提取 ----------------
  const GLYPH_CACHE = new Map();
  T.glyphCache = GLYPH_CACHE;

  T.contoursFor = function (text, font, fontSize, tracking, lineHeight, align, weight) {
    text = String(text === undefined ? '锻' : text);
    fontSize = Math.max(1, fontSize || 100);
    const key = [text, font, fontSize, tracking || 0, lineHeight || 120, align || 'center', weight || 400].join('|');
    if (GLYPH_CACHE.has(key)) return G.cloneContours(GLYPH_CACHE.get(key));
    const layout = T.layout({ text, font, fontSize, tracking, lineHeight, align, weight });
    if (!layout.chars.length || layout.width < 0.1) {
      GLYPH_CACHE.set(key, []);
      return [];
    }
    const pad = Math.max(8, fontSize * 0.08);
    const qualityScale = U.clamp(560 / fontSize, 1, 3);
    let W = Math.ceil((layout.width + pad * 2) * qualityScale);
    let H = Math.ceil((layout.height + pad * 2) * qualityScale);
    const maxSide = 2200;
    let s = qualityScale;
    if (W > maxSide || H > maxSide) {
      const k = Math.min(maxSide / W, maxSide / H);
      s *= k;
      W = Math.ceil((layout.width + pad * 2) * s);
      H = Math.ceil((layout.height + pad * 2) * s);
    }
    const cv = document.createElement('canvas');
    cv.width = Math.max(4, W); cv.height = Math.max(4, H);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.scale(s, s);
    ctx.translate(pad + layout.width / 2, pad + layout.height / 2);
    ctx.font = T.fontString(font, weight, fontSize);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    for (const c of layout.chars) {
      if (c.isSpace) continue;
      ctx.fillText(c.ch, c.alignX + c.x, c.baseline);
    }
    ctx.restore();
    let img;
    try { img = ctx.getImageData(0, 0, cv.width, cv.height).data; }
    catch (e) { return []; }
    const alpha = new Uint8Array(cv.width * cv.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = img[i * 4 + 3];
    const loops = G.traceAlpha(alpha, cv.width, cv.height, 128);
    const out = [];
    for (const loop of loops) {
      if (loop.pts.length < 3) continue;
      const pts = loop.pts.map(p => ({
        x: p.x / s - pad - layout.width / 2,
        y: p.y / s - pad - layout.height / 2
      }));
      const simp = G.simplifyPolyline(pts, Math.max(0.5, 0.75 / s));
      if (simp.length >= 3) out.push(G.contour(simp.map(p => G.pt(p.x, p.y)), true));
    }
    GLYPH_CACHE.set(key, G.cloneContours(out));
    if (GLYPH_CACHE.size > 40) {
      const it = GLYPH_CACHE.keys();
      for (let i = 0; i < 10; i++) { const r = it.next(); if (r.done) break; GLYPH_CACHE.delete(r.value); }
    }
    return out;
  };

  T.layerContours = function (layer, t) {
    const p = T.layerParams(layer, t);
    return T.contoursFor(p.text, p.font, p.fontSize, p.tracking, p.lineHeight, p.align, p.weight);
  };

  T.layerExtents = function (layer, t) {
    const layout = T.getLayout(layer, t);
    return {
      x0: -layout.width / 2, y0: -layout.height / 2,
      x1: layout.width / 2, y1: layout.height / 2,
      width: layout.width, height: layout.height
    };
  };

})(window);
