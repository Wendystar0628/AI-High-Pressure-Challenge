/* charts.js — chart workbench with live data connection to root spreadsheet */
import { el, uid } from '../utils.js';
import { colName, colIndex, expandRange } from './spreadsheet.js';

const PALETTE = ['#4f7cff', '#3ecf8e', '#f5b83d', '#ff6b9d', '#b266ff', '#39b8e8', '#ff7a59', '#7c6df2'];

export class ChartsApp {
  constructor(context) {
    this.context = context;
  }

  open(params = {}) {
    const state = {
      connection: null,      // { docId, doc, range, labelCol, valueCols, version }
      chartType: 'bar',
      data: [],              // { label, values: [] }
      seriesNames: [],
      hover: null
    };
    const win = this.context.createWindow({
      appId: 'charts',
      title: '图表工作台',
      icon: 'charts',
      w: 880, h: 580,
      onResize: () => this._drawChart(state),
      onClose: () => {
        this._disconnect(state);
        return true;
      }
    });
    this._render(win.body, state, win);
    this.context.chartInfo = {
      windowId: win.id,
      systemId: this.context.systemId || 'outer',
      sourceTitle: '未连接',
      range: '',
      chartType: 'bar',
      connectionState: 'disconnected'
    };
    return win;
  }

  _render(body, state, win) {
    body.innerHTML = '';
    const app = el('div', {
      class: 'app-root chart-wrap',
      'data-app-id': 'charts', 'data-system-id': this.context.systemId || 'outer',
      'data-window-id': win.id
    });

    const sidebar = el('div', { class: 'chart-sidebar' });

    // data source select
    sidebar.appendChild(el('label', { text: '数据源工作簿' }));
    const srcSel = el('select', { 'data-testid': 'chart-source' });
    srcSel.appendChild(el('option', { value: '', text: '— 选择已打开的工作簿 —' }));
    sidebar.appendChild(srcSel);

    sidebar.appendChild(el('label', { text: '数据区域' }));
    const rangeInput = el('input', {
      type: 'text', 'data-testid': 'chart-range', value: 'A1:D4', placeholder: 'A1:D4'
    });
    sidebar.appendChild(rangeInput);

    sidebar.appendChild(el('label', { text: '标签列' }));
    const labelSel = el('select', { 'data-testid': 'chart-label-column' });
    for (const c of ['A', 'B', 'C', 'D', 'E', 'F']) {
      labelSel.appendChild(el('option', { value: c, text: c, 'data-value': c }));
    }
    sidebar.appendChild(labelSel);

    sidebar.appendChild(el('label', { text: '数值列（可多选）' }));
    const seriesBox = el('div', { style: 'display:flex;flex-direction:column;gap:4px', 'data-testid': 'chart-series' });
    const seriesChecks = {};
    for (const c of ['B', 'C', 'D', 'E', 'F']) {
      const lab = el('label', { style: 'display:flex;gap:6px;align-items:center;font-size:12px' });
      const cb = el('input', { type: 'checkbox', value: c });
      if (c === 'D') cb.checked = true;
      seriesChecks[c] = cb;
      lab.appendChild(cb);
      lab.appendChild(el('span', { text: c + ' 列' }));
      seriesBox.appendChild(lab);
    }
    sidebar.appendChild(seriesBox);

    const connectBtn = el('button', {
      class: 'btn primary', 'data-testid': 'chart-connect', text: '建立连接',
      onclick: () => this._connect(state, srcSel, rangeInput, labelSel, seriesChecks)
    });
    const disconnectBtn = el('button', {
      class: 'btn', 'data-testid': 'chart-disconnect', text: '断开连接',
      onclick: () => this._disconnect(state)
    });
    sidebar.appendChild(el('div', { style: 'height:8px' }));
    sidebar.appendChild(connectBtn);
    sidebar.appendChild(disconnectBtn);

    const projectBtn = el('button', {
      class: 'btn', 'data-testid': 'window-project', text: '投送到桌面',
      onclick: () => {
        if (this.context.requestProjection) {
          this.context.requestProjection(win.id, 'charts');
        }
      }
    });
    sidebar.appendChild(projectBtn);

    // main
    const main = el('div', { class: 'chart-main' });
    const canvasWrap = el('div', { class: 'chart-canvas-wrap' });
    const canvas = el('canvas', { 'data-testid': 'chart-canvas' });
    canvasWrap.appendChild(canvas);
    const tooltip = el('div', { class: 'chart-tooltip' });
    canvasWrap.appendChild(tooltip);

    const legend = el('div', { class: 'chart-legend' });
    const status = el('div', { class: 'chart-status', text: '未连接数据源。选择工作簿与区域后点击“建立连接”。' });

    // type switch
    const typeRow = el('div', { class: 'app-toolbar', style: 'border-bottom:1px solid var(--window-border)' }, [
      el('button', {
        class: 'btn', 'data-testid': 'chart-type', text: '切换图表类型',
        onclick: () => {
          state.chartType = state.chartType === 'bar' ? 'line' : 'bar';
          if (this.context.chartInfo) this.context.chartInfo.chartType = state.chartType;
          this._drawChart(state);
          this._renderLegend(state, legend);
        }
      }),
      el('span', { text: '', id: 'chart-type-label', style: 'font-size:12px;color:var(--text-dim)' })
    ]);

    main.appendChild(typeRow);
    main.appendChild(canvasWrap);
    main.appendChild(legend);
    main.appendChild(status);

    app.appendChild(sidebar);
    app.appendChild(main);
    body.appendChild(app);

    state._els = { canvas, canvasWrap, legend, status, tooltip, srcSel, typeLabel: typeRow.querySelector('#chart-type-label') };

    // populate sources
    this._refreshSources(state, srcSel);

    // hover
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      state.hover = { x: e.clientX - r.left, y: e.clientY - r.top };
      this._drawChart(state);
    });
    canvas.addEventListener('mouseleave', () => {
      state.hover = null;
      tooltip.style.display = 'none';
      this._drawChart(state);
    });

    // subscribe to workbook changes
    if (!this.context._sheetSubscribers) this.context._sheetSubscribers = [];
    const sub = (doc) => {
      if (state.connection && state.connection.docId === doc.id) {
        this._pullData(state);
        this._drawChart(state);
      }
    };
    this.context._sheetSubscribers.push(sub);
    state._subscriber = sub;

    this._drawChart(state);
  }

  _refreshSources(state, srcSel) {
    srcSel.innerHTML = '';
    srcSel.appendChild(el('option', { value: '', text: '— 选择已打开的工作簿 —' }));
    const books = this.context.openWorkbooks || new Map();
    for (const [id, doc] of books) {
      srcSel.appendChild(el('option', { value: id, text: doc.name || id, 'data-value': id }));
    }
  }

  _connect(state, srcSel, rangeInput, labelSel, seriesChecks) {
    const docId = srcSel.value;
    if (!docId) {
      this._status(state, '请先选择工作簿', true);
      return;
    }
    const books = this.context.openWorkbooks || new Map();
    const doc = books.get(docId);
    if (!doc) {
      this._status(state, '工作簿不存在', true);
      return;
    }
    const range = rangeInput.value.trim().toUpperCase();
    if (!/^[A-Z]+\d+:[A-Z]+\d+$/.test(range)) {
      this._status(state, '区域格式应为 A1:D4', true);
      return;
    }
    const valueCols = Object.keys(seriesChecks).filter(c => seriesChecks[c].checked);
    if (!valueCols.length) {
      this._status(state, '请至少选择一个数值列', true);
      return;
    }
    state.connection = {
      docId, doc, range,
      labelCol: labelSel.value,
      valueCols,
      version: Date.now()
    };
    this._pullData(state);
    this._drawChart(state);
    this._status(state, `已连接 ${doc.name} · ${range} · ${valueCols.join(',')} 列`);
    if (this.context.chartInfo) {
      this.context.chartInfo.sourceTitle = doc.name;
      this.context.chartInfo.range = range;
      this.context.chartInfo.chartType = state.chartType;
      this.context.chartInfo.connectionState = 'connected';
    }
    this.context.notify('图表已连接', `${doc.name} ${range}`);
  }

  _disconnect(state) {
    if (state._subscriber && this.context._sheetSubscribers) {
      const idx = this.context._sheetSubscribers.indexOf(state._subscriber);
      if (idx >= 0) this.context._sheetSubscribers.splice(idx, 1);
    }
    state.connection = null;
    this._drawChart(state);
    this._status(state, '已断开连接，保留最后数据');
    if (this.context.chartInfo) this.context.chartInfo.connectionState = 'disconnected';
  }

  _pullData(state) {
    const c = state.connection;
    if (!c) return;
    const [a1, a2] = c.range.split(':');
    const minR = parseInt(a1.match(/\d+/)[0]);
    const maxR = parseInt(a2.match(/\d+/)[0]);
    const minC = colIndex(a1.match(/[A-Z]+/)[0]);
    const maxC = colIndex(a2.match(/[A-Z]+/)[0]);
    const cells = c.doc.cells || {};
    // compute values (simple, no formula engine here — use raw or pre-computed)
    const getVal = (addr) => {
      const raw = cells[addr];
      if (raw === undefined || raw === null || raw === '') return '';
      const s = String(raw);
      if (s.startsWith('=')) {
        try {
          return c.doc.__computed ? (c.doc.__computed[addr] !== undefined ? c.doc.__computed[addr] : '') : evalSimple(s.slice(1), cells);
        } catch (e) { return s; }
      }
      const n = Number(s);
      return isNaN(n) ? s : n;
    };
    const rows = [];
    for (let r = minR + 1; r <= maxR; r++) {
      const label = String(getVal(colName(colIndex(c.labelCol)) + r) ?? r);
      const values = c.valueCols.map(col => {
        const v = getVal(col + r);
        return typeof v === 'number' ? v : (parseFloat(v) || 0);
      });
      rows.push({ label, values });
    }
    state.data = rows;
    state.seriesNames = c.valueCols.map(col => `${col} 列`);
    state.version = Date.now();
    if (state._els && state._els.legend) this._renderLegend(state, state._els.legend);
  }

  _renderLegend(state, legend) {
    legend.innerHTML = '';
    if (!state.seriesNames.length) return;
    if (state._els.typeLabel) state._els.typeLabel.textContent = '当前: ' + (state.chartType === 'bar' ? '分组柱状图' : '折线图');
    state.seriesNames.forEach((name, i) => {
      legend.appendChild(el('div', { class: 'lg' }, [
        el('div', { class: 'swatch' }),
        el('span', { text: name })
      ]));
      const sw = legend.lastChild.querySelector('.swatch');
      sw.style.background = PALETTE[i % PALETTE.length];
    });
  }

  _status(state, msg, isErr) {
    if (state._els && state._els.status) {
      state._els.status.textContent = msg;
      state._els.status.style.color = isErr ? 'var(--bad)' : 'var(--text-dim)';
    }
  }

  _drawChart(state) {
    const els = state._els;
    if (!els || !els.canvas) return;
    const canvas = els.canvas;
    const wrap = els.canvasWrap;
    const w = wrap.clientWidth - 24;
    const h = wrap.clientHeight - 24;
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    if (!state.data.length) {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.font = '13px "Microsoft YaHei UI", sans-serif';
      g.textAlign = 'center';
      g.fillText('暂无数据', w / 2, h / 2);
      return;
    }

    const padL = 52, padR = 16, padT = 18, padB = 42;
    const cw = w - padL - padR;
    const ch = h - padT - padB;
    const n = state.data.length;
    const seriesCount = state.seriesNames.length;

    // y range
    let maxV = 0, minV = 0;
    for (const row of state.data) {
      for (const v of row.values) {
        if (v > maxV) maxV = v;
        if (v < minV) minV = v;
      }
    }
    maxV = maxV || 1;
    const range = maxV - minV || 1;

    // axes
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(padL, padT);
    g.lineTo(padL, padT + ch);
    g.lineTo(padL + cw, padT + ch);
    g.stroke();

    // y ticks
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = '10.5px sans-serif';
    g.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = minV + range * i / 4;
      const y = padT + ch - ch * i / 4;
      g.fillText(String(+v.toFixed(1)), padL - 8, y + 3);
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + cw, y); g.stroke();
    }

    // x labels
    g.textAlign = 'center';
    const slot = cw / n;
    for (let i = 0; i < n; i++) {
      const x = padL + slot * i + slot / 2;
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillText(state.data[i].label, x, padT + ch + 18);
    }

    // bars / lines
    if (state.chartType === 'bar') {
      const barW = Math.min(38, slot * 0.72 / seriesCount);
      for (let i = 0; i < n; i++) {
        for (let s = 0; s < seriesCount; s++) {
          const v = state.data[i].values[s] || 0;
          const bh = (v - minV) / range * ch;
          const x = padL + slot * i + slot / 2 - (barW * seriesCount) / 2 + barW * s;
          const y = padT + ch - bh;
          g.fillStyle = PALETTE[s % PALETTE.length];
          g.fillRect(x, y, barW - 2, bh);
        }
      }
    } else {
      for (let s = 0; s < seriesCount; s++) {
        g.strokeStyle = PALETTE[s % PALETTE.length];
        g.lineWidth = 2.2;
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const v = state.data[i].values[s] || 0;
          const x = padL + slot * i + slot / 2;
          const y = padT + ch - (v - minV) / range * ch;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
        // dots
        g.fillStyle = PALETTE[s % PALETTE.length];
        for (let i = 0; i < n; i++) {
          const v = state.data[i].values[s] || 0;
          const x = padL + slot * i + slot / 2;
          const y = padT + ch - (v - minV) / range * ch;
          g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
        }
      }
    }

    // hover tooltip
    if (state.hover) {
      const idx = Math.floor((state.hover.x - padL) / slot);
      if (idx >= 0 && idx < n) {
        const row = state.data[idx];
        const tt = els.tooltip;
        tt.style.display = 'block';
        tt.style.left = (state.hover.x + 14) + 'px';
        tt.style.top = (state.hover.y + 10) + 'px';
        tt.innerHTML = `<b>${row.label}</b><br>` +
          row.values.map((v, i) => `${state.seriesNames[i]}: ${v}`).join('<br>');
      } else {
        els.tooltip.style.display = 'none';
      }
    }
  }
}

function evalSimple(expr, cells) {
  // very small evaluator for formulas in chart data
  const s = expr.replace(/\s+/g, '');
  const expand = (a1, a2) => expandRange(a1, a2).map(a => {
    const v = cells[a];
    return typeof v === 'number' ? v : (parseFloat(v) || 0);
  });
  if (/^SUM\([A-Z]+\d+:[A-Z]+\d+\)$/i.test(s)) {
    const m = s.match(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/i);
    return expand(m[1], m[2]).reduce((a, b) => a + b, 0);
  }
  if (/^[A-Z]+\d+\*[A-Z]+\d+$/i.test(s)) {
    const [a, b] = s.split('*');
    const va = cells[a], vb = cells[b];
    return (parseFloat(va) || 0) * (parseFloat(vb) || 0);
  }
  const n = parseFloat(s);
  return isNaN(n) ? s : n;
}
