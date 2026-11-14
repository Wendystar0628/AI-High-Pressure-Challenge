// 字体管理与字形几何提取：懒加载切片、中文多行排版、文字动画器、笔画与净轮廓导出

import opentype from 'opentype.js';
import { clamp, lerp, DEG2RAD } from '../core/math.js';
import {
  resolveFontContoursToMultiPolygon,
  multiPolygonToPathShape,
  flattenContour,
} from './shapes.js';

const FONT_PACKS = {};
const PARSED_SLICES = {};
const GLYPH_CACHE = new Map();

function ensurePacksLoaded() {
  if (FONT_PACKS['noto-serif-sc'] && FONT_PACKS['noto-sans-sc']) return;
  if (typeof window !== 'undefined') {
    if (window.__FONT_PACK_SERIF__) FONT_PACKS['noto-serif-sc'] = window.__FONT_PACK_SERIF__;
    if (window.__FONT_PACK_SANS__) FONT_PACKS['noto-sans-sc'] = window.__FONT_PACK_SANS__;
  }
}

export function registerFontPack(pack) {
  if (pack && pack.id) FONT_PACKS[pack.id] = pack;
}

export function getAvailableFonts() {
  ensurePacksLoaded();
  return Object.values(FONT_PACKS).map((p) => ({
    id: p.id,
    displayName: p.displayName,
    totalGlyphs: p.totalGlyphs,
    cjkCount: p.cjkCount,
    rangeDescription: p.rangeDescription,
  }));
}

export function getFontPack(fontId) {
  ensurePacksLoaded();
  return FONT_PACKS[fontId] || FONT_PACKS['noto-serif-sc'] || Object.values(FONT_PACKS)[0] || null;
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

function getParsedSlice(fontId, sliceIdx) {
  const key = `${fontId}::${sliceIdx}`;
  if (PARSED_SLICES[key]) return PARSED_SLICES[key];
  const pack = getFontPack(fontId);
  if (!pack || !pack.slices[sliceIdx]) return null;
  const ab = base64ToArrayBuffer(pack.slices[sliceIdx]);
  const font = opentype.parse(ab);
  PARSED_SLICES[key] = font;
  return font;
}

export function isCharSupported(fontId, ch) {
  const pack = getFontPack(fontId);
  if (!pack || !ch) return false;
  const cp = ch.codePointAt(0);
  return pack.charMap[cp] !== undefined;
}

export function getUnsupportedChars(fontId, text) {
  const missing = [];
  for (const ch of text || '') {
    if (ch === '\n' || ch === '\r' || ch === '\t' || ch === ' ') continue;
    if (!isCharSupported(fontId, ch) && !missing.includes(ch)) missing.push(ch);
  }
  return missing;
}

export function getGlyphEntry(fontId, ch) {
  const pack = getFontPack(fontId);
  if (!pack) return null;
  const cp = ch.codePointAt(0);
  const cacheKey = `${pack.id}::${cp}`;
  if (GLYPH_CACHE.has(cacheKey)) return GLYPH_CACHE.get(cacheKey);

  let sliceIdx = pack.charMap[cp];
  let fallback = false;
  if (sliceIdx === undefined) {
    // 空格或未知字符退回口框或空格度量
    if (ch === ' ' || ch === '\u3000') {
      const spaceEntry = {
        char: ch,
        advance: ch === '\u3000' ? 1.0 : 0.35,
        commands: [],
        missing: false,
      };
      GLYPH_CACHE.set(cacheKey, spaceEntry);
      return spaceEntry;
    }
    sliceIdx = pack.charMap[0x25a1] ?? pack.charMap[0x3f] ?? 0; // □ or ?
    fallback = true;
  }

  const font = getParsedSlice(pack.id, sliceIdx);
  if (!font) return null;
  const targetChar = fallback ? (pack.charMap[0x25a1] !== undefined ? '\u25a1' : '?') : ch;
  const glyph = font.charToGlyph(targetChar);
  const upm = font.unitsPerEm || 1000;
  const advance = (glyph.advanceWidth || upm) / upm;
  // 标准化到 1em 单位（y 向下为正，兼容画布坐标系）
  const p = glyph.getPath(0, 0, 1);
  const commands = p.commands.map((c) => ({ ...c }));

  const entry = { char: ch, advance, commands, missing: fallback };
  GLYPH_CACHE.set(cacheKey, entry);
  return entry;
}

// 将 opentype Path commands 转换为标准三次贝塞尔 PathShape 轮廓
export function commandsToContours(commands, offsetX = 0, offsetY = 0, scale = 1) {
  const contours = [];
  let pts = [];
  let cx = 0, cy = 0;

  const flush = (closed) => {
    if (pts.length >= 2) {
      // 去除首尾重合点
      if (closed && pts.length > 2) {
        const f = pts[0], l = pts[pts.length - 1];
        if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-3 * scale) {
          f.inX = l.inX;
          f.inY = l.inY;
          pts.pop();
        }
      }
      if (pts.length >= 2) {
        contours.push({ closed, points: pts });
      }
    }
    pts = [];
  };

  for (const c of commands) {
    if (c.type === 'M') {
      flush(true);
      cx = offsetX + c.x * scale;
      cy = offsetY + c.y * scale;
      pts.push({ x: cx, y: cy, inX: 0, inY: 0, outX: 0, outY: 0 });
    } else if (c.type === 'L') {
      const nx = offsetX + c.x * scale;
      const ny = offsetY + c.y * scale;
      if (Math.hypot(nx - cx, ny - cy) > 1e-4 * scale) {
        pts.push({ x: nx, y: ny, inX: 0, inY: 0, outX: 0, outY: 0 });
        cx = nx;
        cy = ny;
      }
    } else if (c.type === 'Q') {
      const qx = offsetX + c.x1 * scale;
      const qy = offsetY + c.y1 * scale;
      const nx = offsetX + c.x * scale;
      const ny = offsetY + c.y * scale;
      const prev = pts[pts.length - 1];
      if (prev) {
        prev.outX = (2 / 3) * (qx - cx);
        prev.outY = (2 / 3) * (qy - cy);
      }
      pts.push({
        x: nx,
        y: ny,
        inX: (2 / 3) * (qx - nx),
        inY: (2 / 3) * (qy - ny),
        outX: 0,
        outY: 0,
      });
      cx = nx;
      cy = ny;
    } else if (c.type === 'C') {
      const c1x = offsetX + c.x1 * scale;
      const c1y = offsetY + c.y1 * scale;
      const c2x = offsetX + c.x2 * scale;
      const c2y = offsetY + c.y2 * scale;
      const nx = offsetX + c.x * scale;
      const ny = offsetY + c.y * scale;
      const prev = pts[pts.length - 1];
      if (prev) {
        prev.outX = c1x - cx;
        prev.outY = c1y - cy;
      }
      pts.push({
        x: nx,
        y: ny,
        inX: c2x - nx,
        inY: c2y - ny,
        outX: 0,
        outY: 0,
      });
      cx = nx;
      cy = ny;
    } else if (c.type === 'Z') {
      flush(true);
    }
  }
  flush(true);
  return contours;
}

// 按偏旁区块先左后右、先上后下排序笔画轮廓，使修剪路径逐笔书写自然流畅
export function sortGlyphContoursForWriting(contours, fontSize) {
  const scored = contours.map((c, idx) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of c.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const cx = (minX + maxX) * 0.5;
    const colBucket = Math.floor(cx / Math.max(10, fontSize * 0.36));
    const score = colBucket * 10000 + minY * 1.4 + minX * 0.5;
    return { c, score, idx };
  });
  scored.sort((a, b) => a.score - b.score || a.idx - b.idx);
  return scored.map((s) => s.c);
}

// 中文多行排版，返回字符几何与文字动画器所需的索引与包围中心
export function layoutText(text, opts = {}) {
  const fontId = opts.fontId || 'noto-serif-sc';
  const fontSize = opts.fontSize || 120;
  const lineHeightRatio = opts.lineHeight || 1.2;
  const trackingPx = ((opts.tracking || 0) / 1000) * fontSize;
  const align = opts.align || 'center';

  const rawLines = String(text ?? '').split(/\r?\n/);
  const lineHeightPx = fontSize * lineHeightRatio;
  const totalHeight = rawLines.length * lineHeightPx;
  // 让文本整体以图层原点 (0,0) 为视觉垂直/水平居中基准
  const firstBaselineY = -totalHeight * 0.5 + fontSize * 0.84;

  const items = [];
  let charIdx = 0;
  let wordIdx = 0;

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const lineStr = rawLines[lineIdx];
    const chars = Array.from(lineStr);
    const glyphs = chars.map((ch) => getGlyphEntry(fontId, ch));
    let lineW = 0;
    for (let i = 0; i < glyphs.length; i++) {
      const adv = (glyphs[i]?.advance ?? 0.5) * fontSize;
      lineW += adv + (i < glyphs.length - 1 ? trackingPx : 0);
    }

    let cursorX = 0;
    if (align === 'center') cursorX = -lineW * 0.5;
    else if (align === 'right') cursorX = -lineW;

    const baseY = firstBaselineY + lineIdx * lineHeightPx;
    let inSpace = true;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const entry = glyphs[i];
      const adv = (entry?.advance ?? 0.5) * fontSize;

      if (ch === ' ' || ch === '\t' || ch === '\u3000') {
        inSpace = true;
        cursorX += adv + trackingPx;
        continue;
      }
      // 中文每个非空字符或拉丁连续词分段作为 wordIdx
      const isCJK = ch.codePointAt(0) >= 0x2e80;
      if (inSpace || isCJK) {
        if (items.length > 0) wordIdx++;
        inSpace = false;
      }

      const contours = commandsToContours(entry.commands, cursorX, baseY, fontSize);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const c of contours) {
        const flat = flattenContour(c, 5);
        for (const p of flat) {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
        }
      }
      if (!Number.isFinite(minX)) {
        minX = cursorX;
        maxX = cursorX + adv;
        minY = baseY - fontSize * 0.8;
        maxY = baseY + fontSize * 0.15;
      }

      items.push({
        char: ch,
        charIdx: charIdx++,
        wordIdx,
        lineIdx,
        x: cursorX,
        y: baseY,
        advance: adv,
        cx: (minX + maxX) * 0.5,
        cy: (minY + maxY) * 0.5,
        bounds: { minX, maxX, minY, maxY },
        contours,
      });

      cursorX += adv + trackingPx;
    }
    wordIdx++;
  }

  return {
    items,
    lineCount: rawLines.length,
    charCount: items.length,
    wordCount: wordIdx,
    fontSize,
  };
}

// 计算文字动画器范围选择器权重（支持按字、词、行，含起点/终点/偏移/软边）
export function computeAnimatorWeight(item, totals, anim) {
  let idx, count;
  if (anim.unit === 'line') {
    idx = item.lineIdx;
    count = Math.max(1, totals.lineCount);
  } else if (anim.unit === 'word') {
    idx = item.wordIdx;
    count = Math.max(1, totals.wordCount);
  } else {
    idx = item.charIdx;
    count = Math.max(1, totals.charCount);
  }

  const pos0 = idx / count;
  const pos1 = (idx + 1) / count;
  const posMid = (pos0 + pos1) * 0.5;

  const s = (Math.min(anim.start, anim.end) + anim.offset) / 100;
  const e = (Math.max(anim.start, anim.end) + anim.offset) / 100;
  const soft = Math.max(0.005, (anim.smoothness ?? 25) / 100) * 0.25;

  let w = 0;
  if (anim.shape === 'square') {
    if (posMid >= s && posMid <= e) w = 1;
    else if (posMid >= s - soft && posMid < s) w = (posMid - (s - soft)) / soft;
    else if (posMid > e && posMid <= e + soft) w = 1 - (posMid - e) / soft;
  } else if (anim.shape === 'rampUp') {
    if (posMid >= s && posMid <= e) w = (posMid - s) / Math.max(1e-5, e - s);
  } else if (anim.shape === 'rampDown') {
    if (posMid >= s && posMid <= e) w = 1 - (posMid - s) / Math.max(1e-5, e - s);
  } else if (anim.shape === 'triangle') {
    const mid = (s + e) * 0.5;
    if (posMid >= s && posMid <= e) {
      w = posMid <= mid ? (posMid - s) / Math.max(1e-5, mid - s) : 1 - (posMid - mid) / Math.max(1e-5, e - mid);
    }
  } else {
    // smooth
    if (posMid >= s && posMid <= e) {
      const inEdge = soft > 0 ? clamp((posMid - s) / soft, 0, 1) : 1;
      const outEdge = soft > 0 ? clamp((e - posMid) / soft, 0, 1) : 1;
      const u = Math.min(inEdge, outEdge);
      w = u * u * (3 - 2 * u);
    } else if (posMid >= s - soft && posMid < s) {
      const u = clamp((posMid - (s - soft)) / soft, 0, 1);
      w = u * u * (3 - 2 * u) * 0.5;
    } else if (posMid > e && posMid <= e + soft) {
      const u = clamp(1 - (posMid - e) / soft, 0, 1);
      w = u * u * (3 - 2 * u) * 0.5;
    }
  }
  return clamp(w, 0, 1);
}

// 变换单字轮廓（围绕自身中心 cx, cy 进行缩放、旋转与位移）
export function transformCharItemContours(item, dx, dy, rotDeg, sx, sy) {
  const rad = rotDeg * DEG2RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const cx = item.cx;
  const cy = item.cy;
  return item.contours.map((contour) => ({
    closed: contour.closed,
    points: contour.points.map((p) => {
      const lx = (p.x - cx) * sx;
      const ly = (p.y - cy) * sy;
      const rx = lx * c - ly * s + cx + dx;
      const ry = lx * s + ly * c + cy + dy;

      const iLx = (p.inX || 0) * sx;
      const iLy = (p.inY || 0) * sy;
      const oLx = (p.outX || 0) * sx;
      const oLy = (p.outY || 0) * sy;
      return {
        x: rx,
        y: ry,
        inX: iLx * c - iLy * s,
        inY: iLx * s + iLy * c,
        outX: oLx * c - oLy * s,
        outY: oLx * s + oLy * c,
      };
    }),
  }));
}

// 将文字层转为矢量路径（支持原始笔画 PathShape 与去重叠净轮廓 MultiPolygon/PathShape）
export function textToGeometry(text, opts = {}) {
  const layout = layoutText(text, opts);
  const allRawContours = [];
  for (const item of layout.items) {
    const sorted = sortGlyphContoursForWriting(item.contours, layout.fontSize);
    allRawContours.push(...sorted);
  }
  const rawStrokePath = {
    fillRule: 'nonzero',
    contours: allRawContours,
    fromFont: true,
  };
  const cleanMultiPolygon = resolveFontContoursToMultiPolygon(allRawContours, opts.curveSteps || 8);
  const cleanOutlinePath = multiPolygonToPathShape(cleanMultiPolygon, 'nonzero');
  return {
    layout,
    rawStrokePath,
    cleanMultiPolygon,
    cleanOutlinePath,
  };
}
