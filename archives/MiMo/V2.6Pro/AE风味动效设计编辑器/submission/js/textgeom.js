/* textgeom.js — 文字排版、字形轮廓提取、文字动画器 */
(function(global) {
'use strict';

const T = {};

const FONT_STACK = {
  'Microsoft YaHei': '"Microsoft YaHei", "微软雅黑", sans-serif',
  'SimHei': '"SimHei", "黑体", sans-serif',
  'KaiTi': '"KaiTi", "楷体", serif',
  'FangSong': '"FangSong", "仿宋", serif',
  'Arial': 'Arial, Helvetica, sans-serif',
  'default': '"Microsoft YaHei", "PingFang SC", sans-serif'
};
T.FONT_STACK = FONT_STACK;
T.AVAILABLE_FONTS = Object.keys(FONT_STACK);

function fontCss(name, size) {
  return `${size}px ${FONT_STACK[name] || FONT_STACK.default}`;
}

// 布局文字 → 每个字符的位置与包围盒
// 返回 { lines: [{chars: [{ch, x, y, w, h, line, col, idx}], width, height}], width, height, baseline }
T.layoutText = function(content, opts = {}) {
  const fontSize = opts.fontSize || 64;
  const lineHeight = (opts.lineHeight || 1.3) * fontSize;
  const tracking = opts.tracking || 0;
  const align = opts.align || 'center';
  const font = opts.font || 'default';
  const cv = T._cv || (T._cv = document.createElement('canvas'));
  const ctx = cv.getContext('2d');
  ctx.font = fontCss(font, fontSize);

  const rawLines = String(content || '').split(/\r?\n/);
  const lines = [];
  let maxW = 0;
  let globalIdx = 0;

  rawLines.forEach((lineText, li) => {
    const chars = [];
    let x = 0;
    // 按字符排布（中文逐字，英文/数字整词可连排）
    const tokens = [];
    let latin = '';
    for (const ch of lineText) {
      if (/[\x00-\x7F]/.test(ch) && ch !== ' ' && ch !== '\t') {
        latin += ch;
      } else {
        if (latin) { tokens.push({ t: latin, latin: true }); latin = ''; }
        tokens.push({ t: ch, latin: false });
      }
    }
    if (latin) tokens.push({ t: latin, latin: true });

    tokens.forEach(tok => {
      const w = ctx.measureText(tok.t).width + (tok.latin ? tracking * tok.t.length : tracking);
      chars.push({
        ch: tok.t, x, y: li * lineHeight, w,
        h: fontSize, line: li, col: chars.length, idx: globalIdx++,
        center: { x: x + w / 2, y: li * lineHeight + fontSize * 0.5 }
      });
      x += w;
    });
    const width = x;
    maxW = Math.max(maxW, width);
    lines.push({ chars, width, height: lineHeight, text: lineText });
  });

  // 对齐偏移
  lines.forEach(line => {
    let dx = 0;
    if (align === 'center') dx = (maxW - line.width) / 2;
    else if (align === 'right') dx = maxW - line.width;
    line.chars.forEach(c => { c.x += dx; c.center.x += dx; });
  });

  return {
    lines,
    width: maxW,
    height: lines.length * lineHeight,
    fontSize, lineHeight: lineHeight / fontSize, tracking, align, font,
    totalChars: globalIdx
  };
};

// 字形轮廓：栅格化 + marching squares
const outlineCache = new Map();

T.glyphOutlines = function(ch, font, fontSize = 96) {
  const key = ch + '|' + font + '|' + fontSize;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const res = Math.max(48, Math.ceil(fontSize * 1.4));
  const cv = document.createElement('canvas');
  cv.width = res; cv.height = res;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, res, res);
  ctx.fillStyle = '#fff';
  ctx.font = fontCss(font, fontSize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, res / 2, res / 2);
  const img = ctx.getImageData(0, 0, res, res).data;
  const mask = new Uint8Array(res * res);
  for (let i = 0; i < res * res; i++) mask[i] = img[i * 4 + 3];

  // marching squares（同 geom，轻量复制）
  const contours = traceMask(mask, res, 0, 0, res, res);
  // 缩放到字面坐标系（原点=中心）
  const scale = 1;
  contours.forEach(c => {
    c.pts.forEach(p => {
      p.x = (p.x - res / 2) * scale;
      p.y = (p.y - res / 2) * scale;
    });
  });
  outlineCache.set(key, contours);
  return contours;
};

function traceMask(mask, res, minX, minY, w, h) {
  const get = (x, y) => {
    if (x < 0 || y < 0 || x >= res || y >= res) return 0;
    return mask[y * res + x] > 110 ? 1 : 0;
  };
  const visited = new Uint8Array(res * res);
  const contours = [];
  const sx = w / res, sy = h / res;
  for (let y = 0; y < res - 1; y++) {
    for (let x = 0; x < res - 1; x++) {
      const v = get(x, y) | (get(x + 1, y) << 1) | (get(x + 1, y + 1) << 2) | (get(x, y + 1) << 3);
      if (v === 0 || v === 15) continue;
      if (visited[y * res + x]) continue;
      const pts = [];
      let cx = x, cy = y, dir = 0;
      for (let it = 0; it < res * 8; it++) {
        if (cx < 0 || cy < 0 || cx >= res - 1 || cy >= res - 1) break;
        visited[cy * res + cx] = 1;
        pts.push({ x: minX + (cx + 0.5) * sx, y: minY + (cy + 0.5) * sy });
        let moved = false;
        const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        for (let d = 0; d < 4; d++) {
          const dd = (dir + d) % 4;
          const nx = cx + dirs[dd][0], ny = cy + dirs[dd][1];
          if (nx < 0 || ny < 0 || nx >= res - 1 || ny >= res - 1) continue;
          const nv = get(nx, ny) | (get(nx + 1, ny) << 1) | (get(nx + 1, ny + 1) << 2) | (get(nx, ny + 1) << 3);
          if (nv === 0 || nv === 15) continue;
          cx = nx; cy = ny; dir = dd; moved = true; break;
        }
        if (!moved) break;
        if (cx === x && cy === y) break;
      }
      if (pts.length > 3) {
        const simp = U.simplify(pts, 1.0);
        if (simp.length > 2) {
          contours.push({
            pts: simp.map(p => ({ x: p.x, y: p.y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false })),
            closed: true
          });
        }
      }
    }
  }
  return contours;
}
T.traceMask = traceMask;

// 整段文字 → 轮廓集合（以文字块中心为局部原点），用于挤出/形变
T.textContours = function(content, opts = {}) {
  const layout = T.layoutText(content, opts);
  const all = [];
  const ox = layout.width / 2, oy = layout.height / 2;
  layout.lines.forEach(line => {
    line.chars.forEach(c => {
      const glyph = T.glyphOutlines(c.ch, opts.font || 'default', 96);
      const s = (opts.fontSize || 64) / 96;
      glyph.forEach(g => {
        all.push({
          closed: true,
          pts: g.pts.map(p => ({
            x: p.x * s + c.center.x - ox,
            y: p.y * s + c.center.y - oy - (opts.fontSize || 64) * 0.12,
            in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false
          }))
        });
      });
    });
  });
  return { contours: all, layout };
};

// 文字动画器：按范围计算每个字符的变换
T.charAnimTransform = function(anim, charIdx, totalChars, t) {
  if (!anim || !anim.enabled) return null;
  // 范围（百分比）
  const start = anim.start + (anim.offset || 0);
  const end = anim.end + (anim.offset || 0);
  const soft = Math.max(0, anim.soft || 0) / 100;
  let amount;
  if (anim.rangeType === 'all') {
    amount = 1;
  } else {
    // 字符位置百分比
    const pos = totalChars <= 1 ? 0 : charIdx / (totalChars - 1) * 100;
    const s0 = start, s1 = end;
    // 软边：在 [s0, s0+soft] 内淡入
    if (pos < s0) amount = 0;
    else if (pos > s1) amount = 1;
    else {
      const u = (pos - s0) / Math.max(1e-6, s1 - s0);
      amount = U.smoothstep(U.clamp(u, 0, 1));
    }
  }
  if (amount <= 0) return null;
  // 不透明度：默认动画量越大越可见（opacity 参数是目标值）
  const op = U.lerp(anim.opacity != null ? anim.opacity : 0, 100, amount);
  return {
    position: [
      U.lerp(anim.position ? anim.position[0] : 0, 0, amount),
      U.lerp(anim.position ? anim.position[1] : 0, 0, amount),
      U.lerp(anim.position ? anim.position[2] : 0, 0, amount)
    ],
    rotation: U.lerp(anim.rotation || 0, 0, amount),
    scale: [
      U.lerp(anim.scale ? anim.scale[0] : 100, 100, amount),
      U.lerp(anim.scale ? anim.scale[1] : 100, 100, amount)
    ],
    opacity: U.clamp(op, 0, 100),
    amount
  };
};

// Canvas2D 渲染文字（2D 层用）
T.renderTextToCtx = function(ctx, content, opts, charFilter) {
  const layout = T.layoutText(content, opts);
  const fontSize = opts.fontSize || 64;
  const font = opts.font || 'default';
  ctx.save();
  ctx.font = fontCss(font, fontSize);
  ctx.fillStyle = U.colorToCss(opts.color || [0.9, 0.9, 0.92]);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let charIdx = 0;
  layout.lines.forEach(line => {
    line.chars.forEach(c => {
      let tr = null;
      if (charFilter) tr = charFilter(charIdx, c);
      charIdx++;
      if (tr && tr.opacity <= 0) return;
      ctx.save();
      const cx = c.x + c.w / 2, cy = c.y + fontSize * 0.55;
      ctx.translate(cx + (tr ? tr.position[0] : 0), cy + (tr ? tr.position[1] : 0));
      if (tr) {
        ctx.rotate(U.deg2rad(tr.rotation));
        ctx.scale(tr.scale[0] / 100, tr.scale[1] / 100);
        ctx.globalAlpha *= (tr.opacity / 100);
      }
      ctx.fillText(c.ch, -c.w / 2, fontSize * 0.32);
      ctx.restore();
    });
  });
  ctx.restore();
  return layout;
};

global.TextGeom = T;
})(window);
