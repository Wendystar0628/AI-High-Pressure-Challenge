// 文字排版与字形轮廓提取（Canvas 栅格 + 轮廓追踪）
import { ShapePath, makePoint } from './path.js';
import { clamp, lerp } from './math.js';

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

export function fontString(fontSize, fontFamily = "'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif", bold = false) {
  return `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
}

// 排版：支持多行、对齐、字距、行距
export function layoutText(text, opts = {}) {
  const fontSize = opts.fontSize || 72;
  const lineHeight = opts.lineHeight != null ? opts.lineHeight : 1.35;
  const tracking = opts.tracking || 0;
  const align = opts.align || 'left'; // left | center | right
  const fontFamily = opts.fontFamily || "'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif";
  const bold = !!opts.bold;
  measureCtx.font = fontString(fontSize, fontFamily, bold);
  const lines = String(text).split('\n');
  const result = { lines: [], width: 0, height: 0, fontSize, lineHeight, tracking, align, fontFamily, bold };
  let maxW = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const chars = [];
    let x = 0;
    const words = []; // 按字/词分组
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      const w = measureCtx.measureText(ch).width + tracking;
      chars.push({ char: ch, x, y: 0, width: w, index: ci, line: li, word: 0 });
      x += w;
      words.push(ci); // 中文按字，英文按空格分词
    }
    // 英文按空格聚合词
    let wordIdx = 0;
    let inWord = false;
    for (const c of chars) {
      const isSpace = c.char === ' ' || c.char === '\t';
      if (!isSpace && !inWord) { wordIdx++; inWord = true; }
      if (isSpace) inWord = false;
      c.word = wordIdx;
    }
    const lineWidth = x;
    maxW = Math.max(maxW, lineWidth);
    let offsetX = 0;
    if (align === 'center') offsetX = -lineWidth / 2;
    else if (align === 'right') offsetX = -lineWidth;
    for (const c of chars) {
      c.x += offsetX;
      c.y = li * fontSize * lineHeight;
    }
    result.lines.push({ chars, width: lineWidth, y: li * fontSize * lineHeight, index: li });
  }
  result.width = maxW;
  result.height = Math.max(fontSize, lines.length * fontSize * lineHeight);
  // 垂直居中偏移
  const yOff = -result.height / 2 + fontSize * 0.5;
  for (const line of result.lines) {
    for (const c of line.chars) c.y += yOff;
    line.y += yOff;
  }
  return result;
}

// 字符范围选择（文本动画器）：按 index/char/word/line
export function selectorProgress(charInfo, opts = {}) {
  const {
    start = 0, end = 1, offset = 0, smooth = 0.5,
    basedOn = 'chars', // chars | words | lines
  } = opts;
  const total = opts.total || 1;
  let idx = charInfo.index;
  if (basedOn === 'words') idx = charInfo.word;
  else if (basedOn === 'lines') idx = charInfo.line;
  const u = total > 1 ? idx / Math.max(1, total - 1) : 0;
  // 范围 + 偏移 + 软边
  const s = start + offset;
  const e = end + offset;
  const sm = Math.max(0.001, smooth);
  if (u < s - sm) return 0;
  if (u > e + sm) return 1;
  if (u < s + sm) return (u - (s - sm)) / (2 * sm);
  if (u > e - sm) return 1 - (u - (e - sm)) / (2 * sm);
  return 1;
}

// ---- 字形轮廓提取：渲染到 canvas 后追踪 ----
const outlineCanvas = document.createElement('canvas');
const outlineCtx = outlineCanvas.getContext('2d', { willReadFrequently: true });

/**
 * 提取单个文本的轮廓（含孔洞），返回 ShapePath（坐标以文本中心为原点，y 向下）
 * resolution: 栅格精度
 */
export function textToPath(text, opts = {}) {
  const fontSize = opts.fontSize || 100;
  const fontFamily = opts.fontFamily || "'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif";
  const bold = !!opts.bold;
  const pad = 12;
  measureCtx.font = fontString(fontSize, fontFamily, bold);
  const m = measureCtx.measureText(text);
  const w = Math.ceil(m.width) + pad * 2;
  const h = Math.ceil(fontSize * 1.6) + pad * 2;
  const scale = opts.resolution ? opts.resolution / Math.max(w, h) : 1;
  outlineCanvas.width = Math.max(4, Math.ceil(w * scale));
  outlineCanvas.height = Math.max(4, Math.ceil(h * scale));
  outlineCtx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);
  outlineCtx.save();
  outlineCtx.scale(scale, scale);
  outlineCtx.font = fontString(fontSize, fontFamily, bold);
  outlineCtx.fillStyle = '#fff';
  outlineCtx.textBaseline = 'middle';
  outlineCtx.fillText(text, pad, h / 2);
  outlineCtx.restore();
  const img = outlineCtx.getImageData(0, 0, outlineCanvas.width, outlineCanvas.height);
  const contours = traceAlphaContours(img.data, outlineCanvas.width, outlineCanvas.height, 1 / scale, pad, h / 2);
  return new ShapePath(
    contours.map((pts) => ({
      points: pts.map((p) => makePoint(p.x, p.y)),
      closed: true,
    }))
  );
}

// 追踪 alpha 轮廓（外轮廓与孔洞，基于 even-odd 语义）
function traceAlphaContours(data, w, h, invScale, originX, originY) {
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bin[i] = data[i * 4 + 3] > 110 ? 1 : 0;
  const contours = [];
  const visited = new Uint8Array(w * h);
  // 四邻接边界链追踪
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      if (visited[i]) continue;
      // 边界：从 (x,y) 到 (x+1,y) 的上边缘，或 (x,y) 到 (x,y+1) 的左边缘
      // 使用方格边界追踪（square tracing）
    }
  }
  // 更稳健：使用 marching-squares 网格点追踪
  return marchingSquares(bin, w, h, invScale, originX, originY);
}

function marchingSquares(bin, w, h, invScale, originX, originY) {
  // 在像素中心采样构建 (w-1)*(h-1) 网格的边界段，再链接
  const contours = [];
  const segs = [];
  const val = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bin[y * w + x]);
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const a = val(x, y), b = val(x + 1, y), c = val(x + 1, y + 1), d = val(x, y + 1);
      const code = (a << 3) | (b << 2) | (c << 1) | d;
      if (code === 0 || code === 15) continue;
      const T = { x: x + 0.5, y: y };
      const R = { x: x + 1, y: y + 0.5 };
      const B = { x: x + 0.5, y: y + 1 };
      const L = { x: x, y: y + 0.5 };
      const push = (p, q) => segs.push([p, q]);
      switch (code) {
        case 1: case 14: push(L, B); break;
        case 2: case 13: push(B, R); break;
        case 3: case 12: push(L, R); break;
        case 4: case 11: push(T, R); break;
        case 5: push(L, T); push(B, R); break;
        case 6: case 9: push(T, B); break;
        case 7: case 8: push(L, T); break;
        case 10: push(T, R); push(L, B); break;
        default: break;
      }
    }
  }
  // 链接线段
  const key = (p) => `${Math.round(p.x * 4)},${Math.round(p.y * 4)}`;
  const map = new Map();
  for (const [p, q] of segs) {
    const k = key(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push({ p, q });
  }
  const used = new Set();
  for (const [startKey, list] of map) {
    for (const item of list) {
      const id = key(item.p) + '>' + key(item.q);
      if (used.has(id)) continue;
      const contour = [];
      let cur = item.p;
      let nextSeg = item;
      for (let step = 0; step < segs.length + 4; step++) {
        const segId = key(nextSeg.p) + '>' + key(nextSeg.q);
        if (used.has(segId)) break;
        used.add(segId);
        contour.push(nextSeg.p);
        cur = nextSeg.q;
        const cands = map.get(key(cur)) || [];
        let found = null;
        for (const c of cands) {
          const cid = key(c.p) + '>' + key(c.q);
          if (!used.has(cid)) { found = c; break; }
        }
        if (!found) {
          contour.push(cur);
          break;
        }
        nextSeg = found;
      }
      if (contour.length > 6) {
        // 变换到局部坐标：x 中心，y 向上
        const pts = contour.map((p) => ({
          x: (p.x - originX) * invScale,
          y: -(p.y - originY) * invScale,
        }));
        contours.push(simplifyPts(pts, invScale * 0.8));
      }
    }
  }
  return contours;
}

function simplifyPts(pts, eps) {
  if (pts.length < 5) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    if (Math.hypot(pts[i].x - a.x, pts[i].y - a.y) >= eps) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// 沿路径排布文字
export function textOnPath(layout, pathShape, opts = {}) {
  const spacing = opts.spacing != null ? opts.spacing : 1;
  const orient = opts.orient !== false;
  const polys = pathShape.flatten(0.5);
  if (!polys.length) return layout;
  const poly = polys[0];
  // 累计弧长
  const segLens = [];
  let total = 0;
  for (let i = 1; i < poly.length; i++) {
    const d = Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
    segLens.push(d);
    total += d;
  }
  const chars = [];
  for (const line of layout.lines) {
    for (const c of line.chars) chars.push(c);
  }
  const textW = layout.width;
  let acc = opts.startOffset || 0;
  for (const c of chars) {
    const u = clamp((acc + c.width / 2) / Math.max(1, total), 0, 1);
    const target = u * total;
    let a = 0, px = poly[0].x, py = poly[0].y, angle = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (a + segLens[i] >= target) {
        const t = segLens[i] > 0 ? (target - a) / segLens[i] : 0;
        px = lerp(poly[i].x, poly[i + 1].x, t);
        py = lerp(poly[i].y, poly[i + 1].y, t);
        angle = Math.atan2(poly[i + 1].y - poly[i].y, poly[i + 1].x - poly[i].x);
        break;
      }
      a += segLens[i];
    }
    c.pathX = px;
    c.pathY = py;
    c.pathAngle = orient ? angle : 0;
    acc += c.width * spacing;
  }
  return layout;
}

// 为动画器计算每个字符的变换
export function charTransforms(layout, evalFn) {
  // evalFn(charInfo, total) -> {offset:[x,y,z], rotation, scale, opacity, anchor}
  const out = [];
  let totalChars = 0;
  for (const line of layout.lines) totalChars += line.chars.length;
  for (const line of layout.lines) {
    for (const c of line.chars) {
      const tr = evalFn(c, totalChars);
      out.push({
        char: c.char,
        x: c.x + (tr.dx || 0),
        y: c.y + (tr.dy || 0),
        z: tr.dz || 0,
        rotation: tr.rotation || 0,
        scaleX: tr.scaleX != null ? tr.scaleX : 1,
        scaleY: tr.scaleY != null ? tr.scaleY : 1,
        opacity: tr.opacity != null ? tr.opacity : 1,
        index: c.index,
        line: c.line,
        word: c.word,
        width: c.width,
      });
    }
  }
  return out;
}
