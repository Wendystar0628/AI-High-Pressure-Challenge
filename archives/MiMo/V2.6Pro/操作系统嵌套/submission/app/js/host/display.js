/* display.js — host display device.
   2D: renders submitted graphics command lists onto a canvas.
   3D: renders submitted scene state through Three.js (imported separately).
   The device does not advance scene state; identical submissions give identical pictures. */

import { roundRect } from './wallpaper.js';

export class Display2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.w = 0; this.h = 0;
  }
  resize(w, h) {
    this.w = w; this.h = h;
    this.canvas.width = Math.max(1, Math.floor(w * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(h * this.dpr));
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  /* commands: array of draw ops in logical pixels */
  render(commands) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const stack = [];
    for (const cmd of commands) {
      try { this._exec(ctx, cmd, stack); } catch (e) { /* skip bad cmd */ }
    }
  }
  _exec(ctx, cmd, stack) {
    const op = cmd.op;
    if (op === 'clear') {
      ctx.fillStyle = cmd.color || '#000';
      ctx.fillRect(0, 0, this.w, this.h);
    } else if (op === 'save') {
      ctx.save(); stack.push(1);
    } else if (op === 'restore') {
      if (stack.length) { ctx.restore(); stack.pop(); }
    } else if (op === 'clip') {
      ctx.beginPath();
      if (cmd.radius) roundRect(ctx, cmd.x, cmd.y, cmd.w, cmd.h, cmd.radius);
      else ctx.rect(cmd.x, cmd.y, cmd.w, cmd.h);
      ctx.clip();
    } else if (op === 'rect') {
      const x = cmd.x || 0, y = cmd.y || 0, w = cmd.w || 0, h = cmd.h || 0;
      if (cmd.radius) {
        ctx.beginPath();
        roundRect(ctx, x, y, w, h, cmd.radius);
        if (cmd.fill) { ctx.fillStyle = cmd.fill; ctx.fill(); }
        if (cmd.stroke) { ctx.strokeStyle = cmd.stroke; ctx.lineWidth = cmd.lineWidth || 1; ctx.stroke(); }
      } else {
        if (cmd.fill) { ctx.fillStyle = cmd.fill; ctx.fillRect(x, y, w, h); }
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke; ctx.lineWidth = cmd.lineWidth || 1;
          ctx.strokeRect(x, y, w, h);
        }
      }
    } else if (op === 'gradient-rect') {
      const x = cmd.x || 0, y = cmd.y || 0, w = cmd.w || 0, h = cmd.h || 0;
      let gr;
      if (cmd.dir === 'h') gr = ctx.createLinearGradient(x, y, x + w, y);
      else if (cmd.dir === 'diag') gr = ctx.createLinearGradient(x, y, x + w, y + h);
      else gr = ctx.createLinearGradient(x, y, x, y + h);
      gr.addColorStop(0, cmd.from || '#000');
      gr.addColorStop(1, cmd.to || '#fff');
      ctx.fillStyle = gr;
      if (cmd.radius) { ctx.beginPath(); roundRect(ctx, x, y, w, h, cmd.radius); ctx.fill(); }
      else ctx.fillRect(x, y, w, h);
    } else if (op === 'circle') {
      ctx.beginPath();
      ctx.arc(cmd.x, cmd.y, cmd.r || 0, 0, Math.PI * 2);
      if (cmd.fill) { ctx.fillStyle = cmd.fill; ctx.fill(); }
      if (cmd.stroke) { ctx.strokeStyle = cmd.stroke; ctx.lineWidth = cmd.lineWidth || 1; ctx.stroke(); }
    } else if (op === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(cmd.x, cmd.y, cmd.rx, cmd.ry, cmd.rotation || 0, 0, Math.PI * 2);
      if (cmd.fill) { ctx.fillStyle = cmd.fill; ctx.fill(); }
      if (cmd.stroke) { ctx.strokeStyle = cmd.stroke; ctx.lineWidth = cmd.lineWidth || 1; ctx.stroke(); }
    } else if (op === 'line') {
      ctx.beginPath();
      ctx.moveTo(cmd.x1, cmd.y1);
      ctx.lineTo(cmd.x2, cmd.y2);
      ctx.strokeStyle = cmd.stroke || '#fff';
      ctx.lineWidth = cmd.lineWidth || 1;
      if (cmd.dash) ctx.setLineDash(cmd.dash); else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (op === 'path') {
      const pts = cmd.points || [];
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (cmd.close) ctx.closePath();
      if (cmd.fill) { ctx.fillStyle = cmd.fill; ctx.fill(); }
      if (cmd.stroke) {
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.lineWidth || 1;
        if (cmd.dash) ctx.setLineDash(cmd.dash);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (op === 'text') {
      ctx.font = `${cmd.italic ? 'italic ' : ''}${cmd.weight || ''} ${cmd.size || 12}px ${cmd.font || '"Microsoft YaHei UI", "Segoe UI", sans-serif'}`;
      ctx.fillStyle = cmd.color || '#fff';
      ctx.textAlign = cmd.align || 'left';
      ctx.textBaseline = cmd.baseline || 'top';
      if (cmd.shadow) {
        ctx.shadowColor = cmd.shadow;
        ctx.shadowBlur = cmd.shadowBlur || 4;
      }
      if (cmd.maxWidth) ctx.fillText(cmd.text || '', cmd.x, cmd.y, cmd.maxWidth);
      else ctx.fillText(cmd.text || '', cmd.x, cmd.y);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else if (op === 'image') {
      const img = imageCache(cmd.src);
      if (img && img.complete && img.naturalWidth) {
        if (cmd.sw !== undefined) {
          ctx.drawImage(img, cmd.sx || 0, cmd.sy || 0, cmd.sw, cmd.sh, cmd.x, cmd.y, cmd.w, cmd.h);
        } else {
          ctx.drawImage(img, cmd.x, cmd.y, cmd.w || img.naturalWidth, cmd.h || img.naturalHeight);
        }
      }
    } else if (op === 'shadow') {
      ctx.shadowColor = cmd.color || 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = cmd.blur || 8;
      ctx.shadowOffsetX = cmd.offsetX || 0;
      ctx.shadowOffsetY = cmd.offsetY || 0;
    } else if (op === 'shadowOff') {
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    } else if (op === 'globalAlpha') {
      ctx.globalAlpha = cmd.value;
    }
  }
}

const imgCacheMap = {};
function imageCache(src) {
  if (!src) return null;
  if (!imgCacheMap[src]) {
    const img = new Image();
    img.src = src;
    imgCacheMap[src] = img;
  }
  return imgCacheMap[src];
}

/* Composite renderer for a subsystem: takes a list of window frames,
   each frame = { clip: {x,y,w,h}, commands: [...] }, paints them in order. */
export class Composite2D {
  constructor(canvas) {
    this.inner = new Display2D(canvas);
  }
  resize(w, h) { this.inner.resize(w, h); }
  render(frames) {
    const ctx = this.inner.ctx;
    ctx.setTransform(this.inner.dpr, 0, 0, this.inner.dpr, 0, 0);
    ctx.clearRect(0, 0, this.inner.w, this.inner.h);
    for (const f of frames) {
      ctx.save();
      if (f.clip) {
        ctx.beginPath();
        ctx.rect(f.clip.x, f.clip.y, f.clip.w, f.clip.h);
        ctx.clip();
      }
      if (f.origin) ctx.translate(f.origin.x, f.origin.y);
      const stack = [];
      for (const cmd of f.commands) {
        try { this.inner._exec(ctx, cmd, stack); } catch (e) { }
      }
      ctx.restore();
    }
  }
}
