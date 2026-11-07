// 曲线编辑器：值曲线/速度曲线、关键帧与手柄拖动
import { clamp, lerp } from '../core/math.js';

export class GraphEditor {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.mode = 'value'; // value | speed
    this.colorMap = ['#4d9fff', '#e8b64c', '#5dcea2', '#a78bfa', '#e26d6d', '#56d3e0'];
    this._drag = null;
    this._bind();
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      const pt = this._eventToData(e);
      const sel = this._hitTest(pt);
      if (sel) {
        this._drag = sel;
        e.preventDefault();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!this._drag) return;
      const pt = this._eventToData(e);
      this._dragMove(pt);
    });
    window.addEventListener('mouseup', () => {
      if (this._drag) {
        this._drag = null;
        this.ctx.pushHistory('调整曲线');
        this.ctx.refreshTimeline();
      }
    });
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.viewW = rect.width;
    this.viewH = rect.height;
    this.dpr = dpr;
    this.draw();
  }

  _eventToData(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  }

  _dataToTime(x) {
    const pad = 40;
    const t0 = 0, t1 = this.ctx.comp().duration;
    return t0 + ((x - pad) / (this.viewW - pad * 2)) * (t1 - t0);
  }

  _timeToX(t) {
    const pad = 40;
    const t0 = 0, t1 = this.ctx.comp().duration;
    return pad + ((t - t0) / (t1 - t0)) * (this.viewW - pad * 2);
  }

  _valToY(v, range) {
    const pad = 24;
    const mid = this.viewH / 2;
    return mid - ((v - range.mid) / (range.span || 1)) * (this.viewH - pad * 2) * 0.5;
  }

  _yToVal(y, range) {
    const pad = 24;
    const mid = this.viewH / 2;
    return range.mid - ((y - mid) / ((this.viewH - pad * 2) * 0.5)) * (range.span || 1);
  }

  draw() {
    const g = this.canvas.getContext('2d');
    const dpr = this.dpr || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = this.viewW || this.canvas.clientWidth;
    const h = this.viewH || this.canvas.clientHeight;
    g.clearRect(0, 0, w, h);

    // 背景网格
    g.fillStyle = '#12151c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * w;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const y = (i / 6) * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }

    const prop = this.ctx.selectedProp;
    const layer = this.ctx.selectedPropLayer;
    if (!prop) {
      g.fillStyle = '#5c6577';
      g.font = '13px sans-serif';
      g.textAlign = 'center';
      g.fillText('选择图层属性以查看 / 编辑曲线', w / 2, h / 2);
      return;
    }

    const t0 = 0, t1 = this.ctx.comp().duration;
    const ee = layer._exprEval;

    // 计算值域
    let vMin = Infinity, vMax = -Infinity;
    const samples = [];
    const steps = Math.max(60, Math.floor(w));
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      let vals;
      if (this.mode === 'speed') {
        const a = prop.evalFinal(Math.max(t0, t - 0.012), ee);
        const b = prop.evalFinal(Math.min(t1, t + 0.012), ee);
        vals = b.map((bv, j) => (bv - (a[j] ?? 0)) / 0.024);
      } else {
        vals = prop.evalFinal(t, ee);
      }
      samples.push({ t, vals });
      for (const v of vals) {
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
    }
    if (!isFinite(vMin)) { vMin = -1; vMax = 1; }
    const span = Math.max(1e-6, vMax - vMin) * 1.25 || 1;
    const range = { mid: (vMin + vMax) / 2, span };

    // 绘制曲线
    const dims = samples[0]?.vals.length || 1;
    for (let d = 0; d < dims; d++) {
      g.strokeStyle = this.colorMap[d % this.colorMap.length];
      g.lineWidth = 1.8;
      g.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const x = this._timeToX(samples[i].t);
        const y = this._valToY(samples[i].vals[d] ?? 0, range);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }

    // 关键帧点与手柄
    for (const k of prop.keys) {
      const x = this._timeToX(k.time);
      for (let d = 0; d < dims; d++) {
        const y = this._valToY(k.value[d] ?? 0, range);
        const sel = this.ctx.selectedKeys.has(k);
        // 手柄
        if (this.mode === 'value' && k.easeOut && k.easeOut.type === 'bezier') {
          const hx = x + (k.easeOut.influence || 33) * 0.55;
          g.strokeStyle = 'rgba(232,182,76,0.55)';
          g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, y); g.lineTo(hx, y); g.stroke();
          g.fillStyle = '#e8b64c';
          g.beginPath(); g.arc(hx, y, 3.2, 0, Math.PI * 2); g.fill();
        }
        if (this.mode === 'value' && k.easeIn && k.easeIn.type === 'bezier') {
          const hx = x - (k.easeIn.influence || 33) * 0.55;
          g.strokeStyle = 'rgba(232,182,76,0.55)';
          g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, y); g.lineTo(hx, y); g.stroke();
          g.fillStyle = '#e8b64c';
          g.beginPath(); g.arc(hx, y, 3.2, 0, Math.PI * 2); g.fill();
        }
        // 关键帧
        g.fillStyle = sel ? '#ffe2a0' : '#d9a84e';
        g.strokeStyle = sel ? '#fff' : '#8a6420';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, y, sel ? 5.5 : 4.5, 0, Math.PI * 2);
        g.fill(); g.stroke();
      }
    }

    // 播放头
    const px = this._timeToX(this.ctx.time);
    g.strokeStyle = '#e8524a';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h); g.stroke();

    // 标签
    g.fillStyle = '#8a93a6';
    g.font = '10px sans-serif';
    g.textAlign = 'left';
    g.fillText(prop.name + (this.mode === 'speed' ? ' (速度)' : ' (值)'), 8, 14);
  }

  _hitTest(pt) {
    const prop = this.ctx.selectedProp;
    const layer = this.ctx.selectedPropLayer;
    if (!prop) return null;
    const t0 = 0, t1 = this.ctx.comp().duration;
    const ee = layer._exprEval;
    let vMin = Infinity, vMax = -Infinity;
    for (const k of prop.keys) {
      for (const v of k.value) {
        vMin = Math.min(vMin, v);
        vMax = Math.max(vMax, v);
      }
    }
    if (!isFinite(vMin)) { vMin = -1; vMax = 1; }
    const span = Math.max(1e-6, vMax - vMin) * 1.25;
    const range = { mid: (vMin + vMax) / 2, span };

    for (const k of prop.keys) {
      const x = this._timeToX(k.time);
      for (let d = 0; d < prop.dims; d++) {
        const y = this._valToY(k.value[d] ?? 0, range);
        if (Math.hypot(pt.x - x, pt.y - y) < 9) {
          return { type: 'key', key: k, dim: d, range };
        }
        // 手柄
        if (k.easeOut && k.easeOut.type === 'bezier') {
          const hx = x + (k.easeOut.influence || 33) * 0.55;
          if (Math.hypot(pt.x - hx, pt.y - y) < 7) {
            return { type: 'handleOut', key: k, dim: d, range, kx: x, ky: y };
          }
        }
        if (k.easeIn && k.easeIn.type === 'bezier') {
          const hx = x - (k.easeIn.influence || 33) * 0.55;
          if (Math.hypot(pt.x - hx, pt.y - y) < 7) {
            return { type: 'handleIn', key: k, dim: d, range, kx: x, ky: y };
          }
        }
      }
    }
    return null;
  }

  _dragMove(pt) {
    const d = this._drag;
    const prop = this.ctx.selectedProp;
    if (!prop || !d) return;
    if (d.type === 'key') {
      const t = clamp(this._dataToTime(pt.x), 0, this.ctx.comp().duration);
      const v = this._yToVal(pt.y, d.range);
      d.key.time = t;
      d.key.value[d.dim] = v;
      prop.keys.sort((a, b) => a.time - b.time);
    } else if (d.type === 'handleOut') {
      const infl = clamp((pt.x - d.kx) / 0.55, 0, 100);
      d.key.easeOut = { type: 'bezier', influence: infl };
    } else if (d.type === 'handleIn') {
      const infl = clamp((d.kx - pt.x) / 0.55, 0, 100);
      d.key.easeIn = { type: 'bezier', influence: infl };
    }
    this.draw();
    this.ctx.requestRender();
  }
}
