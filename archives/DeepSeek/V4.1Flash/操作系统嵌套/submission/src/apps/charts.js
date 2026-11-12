import { appIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc, fmtNumber, clamp } from '../ui/common.js';
import * as FS from '../core/fs.js';

export const meta = {
  title: '图表工作台', desc: '根系统电子表格实时数据',
  width: 1040, height: 690, minW: 600, minH: 380, innerOnly: true,
};

const COLORS = ['#a78bfa', '#fbbf24', '#5eead4', '#fb7185', '#60a5fa', '#c084fc', '#34d399', '#f472b6'];
const CONN_LABEL = {
  disconnected: '未连接', connecting: '连接中', connected: '已连接', paused: '已暂停',
  'source-closed': '数据源已关闭', restored: '已恢复，待重新连接', error: '连接错误',
};

function parseAddress(a) {
  const m = String(a).replace(/\$/g, '').toUpperCase().match(/^([A-Z]{1,2})(\d{1,3})$/);
  if (!m) return null;
  let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64); c -= 1;
  return { col: c, row: parseInt(m[2], 10) - 1, addr: m[1] + m[2] };
}
function colName(i) { let s = ''; let n = i + 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
function parseRange(r) {
  const p = String(r || '').replace(/\$/g, '').toUpperCase().split(':');
  const a = parseAddress(p[0]); const b = parseAddress(p[1] || p[0]);
  if (!a || !b) return null;
  return { c1: Math.min(a.col, b.col), c2: Math.max(a.col, b.col), r1: Math.min(a.row, b.row), r2: Math.max(a.row, b.row) };
}
function niceMax(v) {
  if (!Number.isFinite(v) || v <= 0) return 10;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const n = v / base;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return mult * base;
}
function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }

function buildGeometry(chart, sys, sceneAccent) {
  const cache = chart.cache;
  if (!cache || !Array.isArray(cache.matrix)) return null;
  const range = parseRange(chart.range);
  const columns = cache.columns || [];
  const labelIndex = columns.indexOf(String(chart.labelColumn || 'A').toUpperCase());
  let seriesCols = (chart.series || []).map((s) => String(s).toUpperCase()).filter((c) => columns.includes(c));
  if (!seriesCols.length && columns.length > 1) seriesCols = [columns[columns.length - 1]];
  if (labelIndex < 0 || !seriesCols.length) return null;
  let rows = cache.matrix.map((r) => [ ...r ]);
  let header = null;
  // 若首行像表头（标签与数值列均为文本），作为图例并从数据行中移除
  if (rows.length > 1) {
    const first = rows[0];
    const nums = seriesCols.map((c) => Number(first[columns.indexOf(c)]));
    const allText = seriesCols.every((c) => {
      const v = first[columns.indexOf(c)];
      return typeof v === 'string' && !/^-?\d+(\.\d+)?$/.test(v.trim());
    });
    if (allText || nums.every((n) => !Number.isFinite(n))) {
      header = Object.fromEntries(seriesCols.map((c) => [c, String(first[columns.indexOf(c)] ?? c)]));
      rows = rows.slice(1);
    }
  }
  if (!rows.length) return null;
  const groups = rows.map((r, i) => String(r[labelIndex] ?? `行 ${i + 1}`));
  const series = seriesCols.map((c, i) => ({
    col: c, name: header?.[c] || ('列 ' + c), color: COLORS[i % COLORS.length],
    values: rows.map((r) => {
      const v = r[columns.indexOf(c)];
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      const n = Number(String(v).replace(/[¥,%\s]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }),
  }));
  const allVals = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(1e-6, ...allVals));
  const min = Math.min(0, ...allVals);
  const plot = { x: 0.09, y: 0.14, w: 0.86, h: 0.68 };
  const groupW = plot.w / groups.length;
  const gap = clamp(Number(sys.appConfig.charts?.barGap ?? 0.18), 0.02, 0.7);
  const barArea = groupW * (1 - gap);
  const bars = [];
  series.forEach((s, si) => {
    s.values.forEach((v, gi) => {
      const bw = barArea / series.length;
      const x = plot.x + groupW * gi + (groupW - barArea) / 2 + si * bw;
      const h = ((v - min) / (max - min || 1)) * plot.h;
      bars.push({ group: gi, series: si, x: x + bw * 0.08, y: plot.y + plot.h - h, w: bw * 0.84, h, value: v });
    });
  });
  const lines = series.map((s, si) => ({
    series: si, color: s.color,
    points: s.values.map((v, gi) => ({
      x: plot.x + groupW * gi + groupW / 2,
      y: plot.y + plot.h - ((v - min) / (max - min || 1)) * plot.h,
      value: v, group: gi,
    })),
  }));
  return {
    tech: chart.chartType, labels: groups, series: series.map(({ col, name, color }) => ({ col, name, color })),
    max: max + 0, min, plot, bars, lines, title: cache.docTitle || '实时数据', range: chart.range,
    version: cache.seq || 0, progress: chart.geometry?.progress ?? 0,
    lineWidth: clamp(Number(sys.appConfig.charts?.lineWidth ?? 2), 1, 8),
  };
}

function drawChart(canvas, state, opts = {}) {
  if (!canvas) return { rect: null };
  const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 600;
  const cssH = canvas.clientHeight || canvas.parentElement?.clientHeight || 360;
  if (cssW < 10 || cssH < 10) return { rect: null };
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const W = cssW, H = cssH;
  const chart = state;
  const geo = chart.geometry;
  const pad = { l: 52, r: 22, t: opts.compact ? 30 : 50, b: 44 };
  const plotW = Math.max(20, W - pad.l - pad.r);
  const plotH = Math.max(20, H - pad.t - pad.b);
  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(255,255,255,.018)');
  bg.addColorStop(1, 'rgba(255,255,255,.004)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (!geo) {
    ctx.fillStyle = 'rgba(255,255,255,.26)';
    ctx.font = '11px "Segoe UI", "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = 'center';
    const msg = chart.cache ? '等待图表进程计算…' : '选择源工作簿与区域，然后点击“连接”';
    ctx.fillText(msg, W / 2, H / 2);
    return { rect: { x: 0, y: 0, w: W, h: H }, empty: true };
  }
  const prog = easeOut(geo.progress ?? 1);
  const plot = { x: pad.l, y: pad.t, w: plotW, h: plotH };
  const gx = (nx) => pad.l + nx * plotW;
  const gy = (ny) => pad.t + ny * plotH;
  // 标题
  if (!opts.compact) {
    ctx.fillStyle = '#f0ecfa'; ctx.font = '600 13px "Segoe UI", "Microsoft YaHei UI", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(geo.title || '实时数据', pad.l, 25);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.font = '8px "Cascadia Mono", monospace';
    ctx.fillText(`${geo.range || ''} · 版本 ${geo.version} · ${geo.tech === 'line' ? '折线图' : '分组柱状图'}`, pad.l, 38);
  }
  // 图例
  let lx = W - pad.r;
  ctx.textAlign = 'right';
  for (let i = geo.series.length - 1; i >= 0; i--) {
    const s = geo.series[i];
    ctx.font = '8.5px "Segoe UI", "Microsoft YaHei UI", sans-serif';
    const label = s.name;
    const w = ctx.measureText(label).width + 16;
    lx -= w;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(lx + 4, pad.t - 16, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(235,232,245,.7)';
    ctx.textAlign = 'left';
    ctx.fillText(label, lx + 12, pad.t - 13);
    ctx.textAlign = 'right';
  }
  // 网格与 y 轴
  const ticks = 5;
  ctx.textAlign = 'right';
  for (let i = 0; i <= ticks; i++) {
    const frac = i / ticks;
    const y = pad.t + plotH - frac * plotH;
    const val = geo.min + (geo.max - geo.min) * frac;
    ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.055)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y + .5); ctx.lineTo(pad.l + plotW, y + .5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '7.5px "Cascadia Mono", monospace';
    ctx.fillText(fmtNumber(Math.round(val * 100) / 100), pad.l - 7, y + 2.5);
  }
  // x 标签
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = `${opts.compact ? 7 : 8.5}px "Segoe UI", "Microsoft YaHei UI", sans-serif`;
  const step = Math.ceil(geo.labels.length / (opts.compact ? 6 : 14));
  geo.labels.forEach((label, i) => {
    if (i % step !== 0 && i !== geo.labels.length - 1) return;
    const x = gx(geo.plot.x + geo.plot.w / geo.labels.length * (i + 0.5));
    const text = String(label).length > 9 ? String(label).slice(0, 8) + '…' : String(label);
    ctx.fillText(text, x, pad.t + plotH + 18);
  });
  // 柱状图
  if (geo.tech !== 'line') {
    geo.bars.forEach((b) => {
      const bh = b.h * prog * plotH;
      const x = gx(b.x), y = gy(b.y + b.h - b.h * prog), w = Math.max(2, b.w * plotW);
      const color = (geo.series[b.series] || {}).color || COLORS[0];
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, color); g.addColorStop(1, color + '66');
      ctx.fillStyle = g;
      if (chart.selected && chart.selected.group === b.group && chart.selected.series === b.series) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(x, y, w, bh, [3, 3, 0, 0]); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.roundRect(x, y, w, bh, [3, 3, 0, 0]); ctx.fill();
      }
      if (bh > 16 && geo.series.length <= 3) {
        ctx.fillStyle = 'rgba(255,255,255,.64)';
        ctx.font = '7px "Cascadia Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(fmtNumber(Math.round(b.value * 100) / 100), x + w / 2, y - 4);
      }
    });
  } else {
    geo.lines.forEach((line) => {
      const s = geo.series[line.series];
      ctx.strokeStyle = s.color; ctx.lineWidth = geo.lineWidth || 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      line.points.forEach((p, i) => {
        const x = gx(p.x), y = gy(geo.plot.y + geo.plot.h) + (gy(p.y) - gy(geo.plot.y + geo.plot.h)) * prog;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      line.points.forEach((p) => {
        const x = gx(p.x), y = gy(geo.plot.y + geo.plot.h) + (gy(p.y) - gy(geo.plot.y + geo.plot.h)) * prog;
        ctx.fillStyle = '#0e1320'; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, y, 2.3, 0, Math.PI * 2); ctx.fill();
      });
    });
  }
  return { rect: { x: pad.l, y: pad.t, w: plotW, h: plotH }, geo };
}

function computeGeometryProcess(chart, sys) {
  const g = buildGeometry(chart, sys);
  if (!g) return null;
  const prevProgress = chart.geometry?.progress ?? 0;
  g.progress = 0;
  chart.geometry = g;
  chart.anim = { start: sys.clock, duration: Math.max(0.05, Number(sys.appConfig.charts?.transition) || 0.35), shape: 'new' };
  return g;
}

export function mount(ctx) {
  const { sys, os, shell, body, data, window: win } = ctx;
  if (!data.charts) {
    data.charts = {
      docId: '', sourceTitle: '', range: 'A1:D4', labelColumn: 'A', series: ['D'],
      chartType: 'bar', connectionState: 'disconnected', subscriptionId: null,
      cache: null, geometry: null, version: 0, error: null, selected: null,
      renderDirty: false, animateStart: 0,
    };
  }
  const chart = data.charts;
  let destroyed = false;
  let hover = null;
  if (!win.procIds) win.procIds = {};
  if (chart.connectionState === 'connected' && chart.subscriptionId && !os.chartSubs.has(chart.subscriptionId)) {
    chart.connectionState = 'restored';
    chart.subscriptionId = null;
  }

  body.innerHTML = `<div class="charts-app">
    <div class="charts-toolbar">
      <div class="charts-title">${appIcon('charts', { size: 30 })}<div><b>图表工作台</b><span>${esc(sys.name)} · L${sys.depth + 1} · 根系统电子表格实时数据</span></div></div>
      <div class="charts-conn-state" data-chart-conn><i></i><span>未连接</span></div>
      <span class="spacer"></span>
      <button type="button" class="icon-button" data-chart-refresh title="刷新数据源" aria-label="刷新">${uiIcon('reload')}</button>
    </div>
    <div class="charts-main">
      <aside class="charts-side">
        <div class="chart-section">
          <div class="chart-section-title">数据源</div>
          <label class="chart-field"><span>根系统工作簿</span><select class="chart-select" data-testid="chart-source" data-chart-source aria-label="源工作簿"></select></label>
          <label class="chart-field"><span>区域</span><div class="chart-inline"><input class="chart-input mono" data-testid="chart-range" data-chart-range value="${esc(chart.range)}" spellcheck="false" aria-label="数据区域"><button type="button" class="tiny-button" data-chart-preset>A1:D4</button></div></label>
          <div class="chart-field-row">
            <label class="chart-field"><span>标签列</span><select class="chart-select" data-testid="chart-label-column" data-chart-label aria-label="标签列"></select></label>
            <label class="chart-field"><span>图表类型</span><button type="button" class="chart-type-button" data-testid="chart-type" data-chart-type><span data-chart-type-label>分组柱状图</span>${uiIcon('chevron')}</button></label>
          </div>
          <div class="chart-field"><span>数值列</span><div class="chart-series" data-chart-series-list></div></div>
          <div class="chart-actions">
            <button type="button" class="primary-button" data-testid="chart-connect" data-chart-connect>${uiIcon('link')} 连接</button>
            <button type="button" class="ghost-button" data-testid="chart-disconnect" data-chart-disconnect>断开</button>
          </div>
          <div class="chart-connection-note" data-chart-note></div>
        </div>
        <div class="chart-section">
          <div class="chart-section-title">处理进程</div>
          <div class="chart-processes" data-chart-processes></div>
          <div class="chart-section-title" style="margin-top:10px">连接状态</div>
          <div class="chart-meta">
            <div><span>数据源</span><b data-chart-source-title>—</b></div>
            <div><span>版本</span><b data-chart-version>—</b></div>
            <div><span>最近更新</span><b data-chart-updated>—</b></div>
            <div><span>选区</span><b data-chart-range-label>—</b></div>
          </div>
        </div>
        <div class="chart-section chart-source-hint">
          <div class="chart-section-title">数据边界</div>
          <p>连接按工作簿文档身份与选区建立，数据以副本跨层传递。根系统表格提交并重算后，完整选区的新版本进入本系统消息队列。断开连接不会清除已接收数据。</p>
          <button type="button" class="small-button" data-chart-open-root>${uiIcon('spreadsheet')} 查看根系统电子表格</button>
        </div>
      </aside>
      <div class="charts-view">
        <div class="chart-canvas-card">
          <canvas class="chart-canvas" data-testid="chart-canvas" data-chart-canvas></canvas>
          <div class="chart-hover-tip hidden" data-chart-hover></div>
          <div class="chart-empty-overlay" data-chart-empty>
            <div>${uiIcon('dataset')}</div>
            <b>尚未连接实时数据</b>
            <span>在左侧选择已打开的根系统工作簿、区域与数值列，点击连接。</span>
          </div>
        </div>
        <div class="chart-view-foot">
          <span data-chart-foot-status>等待连接</span>
          <span class="spacer"></span>
          <span>过渡使用子系统虚拟时间 · 最小刷新版本</span>
        </div>
      </div>
    </div>
    <div class="charts-statusbar">
      <span>系统 ${esc(sys.name)}</span><span class="spacer"></span>
      <span data-chart-source-state>数据源：未连接</span>
      <span class="tb-sep"></span>
      <span data-chart-clock>虚拟时钟 ${sys.clock.toFixed(2)} s</span>
    </div>
  </div>`;

  const canvas = $s(body, '[data-chart-canvas]');
  const sourceSel = $s(body, '[data-chart-source]');
  const rangeInput = $s(body, '[data-chart-range]');
  const labelSel = $s(body, '[data-chart-label]');
  const typeBtn = $s(body, '[data-chart-type]');
  const seriesList = $s(body, '[data-chart-series-list]');

  function sourceOptions() {
    const docs = os.listOpenWorkbooks();
    const selected = chart.docId;
    let html = '<option value="">选择已打开的工作簿…</option>';
    for (const d of docs) html += `<option value="${esc(d.docId)}" ${d.docId === selected ? 'selected' : ''}>${esc(d.title)}${d.dirty ? ' •' : ''}</option>`;
    if (selected && !docs.some((d) => d.docId === selected)) html += `<option value="${esc(selected)}" selected>${esc(chart.sourceTitle || '已关闭的工作簿')}（已关闭）</option>`;
    sourceSel.innerHTML = html;
    $s(body, '[data-chart-foot-status]').textContent = docs.length ? `${docs.length} 个根系统工作簿已打开` : '根系统没有已打开的工作簿';
  }

  function updateColumns() {
    const r = parseRange(rangeInput.value);
    const cols = [];
    if (r) for (let c = r.c1; c <= r.c2; c++) cols.push(colName(c));
    labelSel.innerHTML = cols.map((c) => `<option value="${c}" ${chart.labelColumn === c ? 'selected' : ''}>${c}</option>`).join('') || '<option value="">—</option>';
    seriesList.innerHTML = cols.map((c) => `<button type="button" class="series-chip ${chart.series.includes(c) ? 'on' : ''}" data-testid="chart-series" data-value="${c}" data-series-col="${c}">${c}</button>`).join('');
    for (const chip of $all(seriesList, '[data-series-col]')) {
      chip.addEventListener('click', () => {
        const c = chip.dataset.seriesCol;
        if (chart.series.includes(c)) chart.series = chart.series.filter((x) => x !== c);
        else chart.series.push(c);
        if (!chart.series.length) chart.series = [c];
        chip.classList.toggle('on');
        ctx.refreshTaskbar?.();
      });
    }
    if (!cols.includes(chart.labelColumn)) chart.labelColumn = cols[0] || 'A';
    labelSel.value = chart.labelColumn;
    chart.series = chart.series.filter((c) => cols.includes(c));
    if (!chart.series.length && cols.length > 1) chart.series = [cols[cols.length - 1]];
    for (const chip of $all(seriesList, '[data-series-col]')) chip.classList.toggle('on', chart.series.includes(chip.dataset.seriesCol));
  }

  function ensureProcesses() {
    for (const [role, name, tick] of [
      ['rx', '图表接收', rxTick],
      ['render', '图表绘制', renderTick],
    ]) {
      let p = sys.processes.find((x) => x.windowId === win.id && x.role === role);
      if (!p) p = os.registerNativeProcess(sys.id, { name, role, windowId: win.id, appId: 'charts', tick, quota: 800, memory: 16 * 1024 });
      if (p) { p.tick = tick; p.name = name; win.procIds[role] = p.pid; }
    }
  }

  function sendCommand(cmd, payload = {}) {
    const rx = win.procIds.rx;
    if (!rx) return false;
    return os.sendMessage(sys.id, 0, rx, { chartCommand: { cmd, ...payload } });
  }

  function handleConnect() {
    const docId = sourceSel.value;
    if (!docId) { ctx.toast('请选择一个已打开的根系统工作簿', 'warn'); sourceSel.focus(); return; }
    const range = rangeInput.value.trim().toUpperCase();
    if (!parseRange(range)) { ctx.toast('区域格式无效，例如 A1:D4', 'error'); return; }
    if (!chart.series.length) { ctx.toast('请至少选择一个数值列', 'warn'); return; }
    const label = labelSel.value;
    if (!label) { ctx.toast('请选择标签列', 'warn'); return; }
    if (chart.subscriptionId) { os.disconnectChart(chart.subscriptionId, 'reconnect'); chart.subscriptionId = null; }
    chart.docId = docId;
    chart.range = range;
    chart.labelColumn = label;
    chart.connectionState = 'connecting';
    chart.error = null;
    const docTitle = sourceSel.selectedOptions[0]?.textContent?.replace(' •', '') || chart.sourceTitle;
    chart.sourceTitle = docTitle;
    ensureProcesses();
    const res = os.connectChart({
      systemId: sys.id, windowId: win.id, docId, docTitle,
      range, labelColumn: label, series: [...chart.series],
    });
    if (!res.ok) {
      chart.connectionState = 'error'; chart.error = res.error;
      ctx.toast(res.error, 'error');
    } else {
      chart.subscriptionId = res.subscriptionId;
      chart.connectionState = sys?.state === 'paused' ? 'paused' : 'connecting';
      if (res.payload) chart.pendingInitial = res.payload;
      chart.renderDirty = true;
      ctx.toast('连接建立，等待图表进程接收数据版本', 'success');
    }
    syncUI(true);
  }

  function handleDisconnect() {
    if (!chart.subscriptionId) { chart.connectionState = 'disconnected'; syncUI(true); return; }
    os.disconnectChart(chart.subscriptionId, 'user');
    chart.subscriptionId = null;
    chart.connectionState = 'disconnected';
    sendCommand('state', { state: 'disconnected' });
    syncUI(true);
    ctx.toast('已断开连接，保留最后数据', 'info');
  }

  function toggleType(source = 'source') {
    if (source === 'projection') { sendCommand('type'); return; }
    const next = chart.chartType === 'bar' ? 'line' : 'bar';
    sendCommand('type', { value: next });
    chart.chartType = next;
    chart.renderDirty = true;
    if (chart.geometry) { chart.geometry.tech = next; chart.geometry.progress = 0; chart.anim = { start: sys.clock, duration: Number(sys.appConfig.charts?.transition) || 0.35 }; }
    syncUI(true);
  }

  // ---------------- 内部进程 ----------------
  function rxTick(c) {
    let cost = 2;
    const msgs = c.messages || [];
    let got = false;
    for (const m of msgs) {
      if (m?.chartPayload) {
        const p = m.chartPayload;
        if (p.type === 'data') {
          if (chart.connectionState === 'disconnected' && chart.subscriptionId === null) continue;
          if (chart.cache && p.seq && p.seq < chart.cache.seq) continue;
          const payloadBytes = JSON.stringify(p.matrix || []).length * 4;
          if (payloadBytes + 16 * 1024 * 1024 > sys.memoryLimitMB * 1024 * 1024) {
            chart.connectionState = 'error';
            chart.error = '图表数据超过本系统内存配额（' + sys.memoryLimitMB + ' MB），已丢弃该版本';
            os.notify(sys.id, { title: '图表内存不足', body: chart.error, kind: 'error', appId: 'charts' });
            continue;
          }
          chart.cache = {
            seq: p.seq || p.version || 0, version: p.version || 0, matrix: p.matrix || [], columns: p.columns || [],
            labels: p.labels, rows: p.rows, docId: p.docId, docTitle: p.docTitle, range: p.range,
            labelColumn: p.labelColumn, series: p.series, at: sys.clock, processedVersion: p.version || p.seq,
          };
          chart.version = chart.cache.seq;
          chart.sourceTitle = p.docTitle || chart.sourceTitle;
          chart.connectionState = 'connected';
          chart.error = null;
          chart.renderDirty = true;
          const renderPid = win.procIds.render;
          if (renderPid) os.sendMessage(sys.id, c.proc.pid, renderPid, { chartRender: { version: chart.version, docId: chart.cache.docId, at: sys.clock } });
          os.notify(sys.id, { title: '图表已更新', body: `${p.docTitle} · ${p.range} · 版本 ${p.seq}`, kind: 'success', appId: 'charts' });
          got = true;
        } else if (p.type === 'source-closed') {
          chart.connectionState = 'source-closed';
          chart.error = p.error || '源工作簿已关闭，保留已接收数据';
          chart.subscriptionId = null;
          os.notify(sys.id, { title: '数据源已关闭', body: p.docTitle || chart.sourceTitle, kind: 'warn', appId: 'charts' });
        } else if (p.type === 'disconnected') {
          chart.connectionState = 'disconnected';
        }
        cost += 3;
      }
      if (m?.chartCommand) {
        const cmd = m.chartCommand;
        if (cmd.cmd === 'type') {
          const next = cmd.value || (chart.chartType === 'bar' ? 'line' : 'bar');
          chart.chartType = next === 'line' ? 'line' : 'bar';
          chart.renderDirty = true;
          if (chart.geometry) {
            chart.geometry.tech = chart.chartType;
            chart.geometry.progress = 0;
            chart.anim = { start: sys.clock, duration: Number(sys.appConfig.charts?.transition) || 0.35 };
          }
          const renderPid = win.procIds.render;
          if (renderPid) os.sendMessage(sys.id, c.proc.pid, renderPid, { chartRender: { type: chart.chartType } });
          cost += 2;
        } else if (cmd.cmd === 'select') {
          chart.selected = { group: Number(cmd.group), series: Number(cmd.series) };
          cost += 1;
        } else if (cmd.cmd === 'state') {
          chart.connectionState = cmd.state || chart.connectionState;
        }
      }
    }
    if (c.proc) {
      c.proc.remaining = msgs.filter((m) => m?.chartPayload).length;
      c.proc.memory = 8192 + (chart.cache ? JSON.stringify(chart.cache.matrix).length * 4 : 0);
    }
    if (got) syncUI(true);
    return Math.min(c.budget || cost, cost);
  }

  function renderTick(c) {
    let cost = 2;
    if (!chart.cache) return cost;
    if (chart.renderDirty || !chart.geometry) {
      const geo = computeGeometryProcess(chart, sys);
      chart.renderDirty = false;
      cost += Math.min(40, (chart.cache.matrix?.length || 1) * (chart.cache.columns?.length || 1));
      if (geo && c.proc) c.proc.remaining = 1;
    }
    if (chart.geometry && chart.anim) {
      const t = clamp((sys.clock - chart.anim.start) / (chart.anim.duration || .35), 0, 1);
      chart.geometry.progress = easeOut(t);
      if (t >= 1) chart.anim = null;
      if (c.proc) c.proc.remaining = t < 1 ? Math.ceil((1 - t) * 10) : 0;
      cost += 1;
    }
    if (c.proc) c.proc.memory = 8192 + (chart.geometry ? JSON.stringify(chart.geometry.bars).length * 2 : 0);
    return Math.min(c.budget || cost, cost);
  }

  function syncUI(render = false) {
    if (destroyed) return;
    const conn = $s(body, '[data-chart-conn]');
    if (conn) { conn.dataset.state = chart.connectionState; conn.querySelector('span').textContent = CONN_LABEL[chart.connectionState] || chart.connectionState; }
    const connNote = $s(body, '[data-chart-note]');
    if (connNote) {
      if (chart.connectionState === 'connected') connNote.innerHTML = `${uiIcon('success')} <span>实时连接中 · 每个完整版本按序处理</span>`;
      else if (chart.connectionState === 'connecting') connNote.innerHTML = `${uiIcon('reload')} <span>等待子系统接收进程处理…</span>`;
      else if (chart.connectionState === 'restored') connNote.innerHTML = `${uiIcon('warning')} <span>快照已恢复。数据保留，需重新连接以接收新版本。</span>`;
      else if (chart.connectionState === 'source-closed') connNote.innerHTML = `${uiIcon('warning')} <span>源工作簿已关闭；重新打开并选择后可再次连接。</span>`;
      else if (chart.connectionState === 'error') connNote.innerHTML = `${uiIcon('warning')} <span>${esc(chart.error || '连接失败')}</span>`;
      else connNote.innerHTML = `${uiIcon('info')} <span>断开连接保留最后数据；连接后先取得完整选区。</span>`;
    }
    $s(body, '[data-chart-source-title]').textContent = chart.sourceTitle || '—';
    $s(body, '[data-chart-version]').textContent = chart.version ? String(chart.version) : '—';
    $s(body, '[data-chart-updated]').textContent = chart.cache ? `${(chart.cache.at || 0).toFixed(2)} s` : '—';
    $s(body, '[data-chart-range-label]').textContent = chart.range || '—';
    $s(body, '[data-chart-source-state]').textContent = `数据源：${CONN_LABEL[chart.connectionState] || chart.connectionState}${chart.sourceTitle ? ' · ' + chart.sourceTitle : ''}`;
    $s(body, '[data-chart-clock]').textContent = `虚拟时钟 ${sys.clock.toFixed(2)} s`;
    $s(body, '[data-chart-type-label]').textContent = chart.chartType === 'line' ? '折线图' : '分组柱状图';
    $s(body, '[data-chart-type]').dataset.type = chart.chartType;
    $s(body, '[data-chart-foot-status]').textContent = chart.cache ? `${chart.sourceTitle || '数据源'} · 版本 ${chart.version}` : '等待连接';
    $s(body, '[data-chart-disconnect]').disabled = !chart.subscriptionId;
    $s(body, '[data-chart-empty]').hidden = !!chart.cache;
    const procs = win.procIds;
    const rx = sys.processes.find((p) => p.pid === procs.rx);
    const renderP = sys.processes.find((p) => p.pid === procs.render);
    $s(body, '[data-chart-processes]').innerHTML = `<div class="chart-proc"><span class="proc-dot ${rx?.state || 'error'}"></span><b>图表接收</b><i>PID ${procs.rx || '—'} · ${rx ? (rx.state === 'waiting' ? '就绪' : rx.state) : '未启动'}</i></div>
      <div class="chart-proc"><span class="proc-dot ${renderP?.state || 'error'}"></span><b>图表绘制</b><i>PID ${procs.render || '—'} · ${renderP ? (renderP.state === 'waiting' ? '就绪' : renderP.state) : '未启动'}</i></div>
      <div class="chart-proc"><span class="proc-dot ${sys.state}"></span><b>系统调度</b><i>${esc(sys.name)} · ${os.isEffectivelyPaused(sys.id) ? '已暂停' : '运行中'}</i></div>`;
    if (chart.connectionState === 'connected' && os.isEffectivelyPaused(sys.id)) {
      conn.dataset.state = 'paused'; conn.querySelector('span').textContent = '已暂停';
    }
    if (sourceSel.value !== chart.docId && chart.docId) {
      const opt = [...sourceSel.options].find((o) => o.value === chart.docId);
      if (opt) sourceSel.value = chart.docId;
    }
    labelSel.value = chart.labelColumn;
    for (const chip of $all(seriesList, '[data-series-col]')) chip.classList.toggle('on', chart.series.includes(chip.dataset.seriesCol));
    if (render) drawView();
  }

  function drawView() {
    drawChart(canvas, chart, { compact: false });
    if (hover) {
      const tip = $s(body, '[data-chart-hover]');
      if (tip) { tip.hidden = false; tip.innerHTML = `<b>${esc(hover.label)}</b><span>${esc(hover.series)}：${fmtNumber(hover.value)}</span>`; tip.style.left = `${hover.px}px`; tip.style.top = `${hover.py}px`; }
    }
  }

  // ---------------- 事件 ----------------
  sourceSel.addEventListener('change', () => {
    chart.docId = sourceSel.value;
    const opt = sourceSel.selectedOptions[0];
    chart.sourceTitle = opt ? opt.textContent.replace(' •', '') : '';
    syncUI(true);
  });
  rangeInput.addEventListener('change', () => {
    chart.range = rangeInput.value.trim().toUpperCase();
    updateColumns();
    syncUI(true);
  });
  labelSel.addEventListener('change', () => { chart.labelColumn = labelSel.value; });
  typeBtn.addEventListener('click', () => toggleType());
  $s(body, '[data-chart-connect]').addEventListener('click', handleConnect);
  $s(body, '[data-chart-disconnect]').addEventListener('click', handleDisconnect);
  $s(body, '[data-chart-preset]').addEventListener('click', () => { rangeInput.value = 'A1:D4'; chart.range = 'A1:D4'; updateColumns(); });
  $s(body, '[data-chart-refresh]').addEventListener('click', () => { sourceOptions(); syncUI(true); ctx.toast('已刷新数据源列表', 'info'); });
  $s(body, '[data-chart-open-root]').addEventListener('click', () => {
    const d = shell.getDesktop('outer');
    if (d) shell.openAppById('outer', 'spreadsheet');
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const W = rect.width, H = rect.height;
    const geo = chart.geometry;
    if (!geo) return;
    const pad = { l: 52, r: 22, t: 50, b: 44 };
    const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
    if (x < pad.l || x > pad.l + plotW || y < pad.t || y > pad.t + plotH) { hover = null; $s(body, '[data-chart-hover]').hidden = true; return; }
    const groupW = geo.plot.w / geo.labels.length;
    const gi = clamp(Math.floor((x - pad.l) / plotW / geo.plot.w * geo.labels.length), 0, geo.labels.length - 1);
    let nearest = null;
    for (const b of geo.bars) {
      const bx = pad.l + (b.x) * plotW, bw = b.w * plotW;
      const by = pad.t + (b.y + b.h * (1 - (geo.progress || 1))) * plotH;
      if (x >= bx && x <= bx + bw) {
        const s = geo.series[b.series];
        nearest = { label: geo.labels[b.group], series: s?.name || '', value: b.value, px: x + 12, py: y - 10 };
      }
    }
    hover = nearest;
    const tip = $s(body, '[data-chart-hover]');
    if (!nearest) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(nearest.label)}</b><span>${esc(nearest.series)}：${fmtNumber(nearest.value)}</span>`;
    tip.style.left = `${nearest.px}px`; tip.style.top = `${nearest.py}px`;
  });
  canvas.addEventListener('mouseleave', () => { hover = null; $s(body, '[data-chart-hover]').hidden = true; });
  canvas.addEventListener('click', (e) => {
    if (!chart.geometry) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const pad = { l: 52, r: 22, t: 50, b: 44 };
    const plotW = rect.width - pad.l - pad.r, plotH = rect.height - pad.t - pad.b;
    const groupW = chart.geometry.plot.w / chart.geometry.labels.length;
    const group = clamp(Math.floor((x - pad.l) / plotW / chart.geometry.plot.w * chart.geometry.labels.length), 0, chart.geometry.labels.length - 1);
    let series = 0;
    for (const b of chart.geometry.bars) if (b.group === group && x >= pad.l + b.x * plotW && x <= pad.l + (b.x + b.w) * plotW) series = b.series;
    chart.selected = { group, series };
    sendCommand('select', { group, series });
    syncUI(true);
  });

  // 更新监听
  const unsubs = [];
  unsubs.push(os.on('workbooks-updated', () => { sourceOptions(); syncUI(false); }));
  unsubs.push(os.on('fs-changed', (e) => { if (e.systemId === 'outer') sourceOptions(); }));
  unsubs.push(os.on('chart-connected', (e) => { if (e.subscription?.windowId === win.id) { /* initial */ } }));
  unsubs.push(os.on('chart-disconnected', (e) => { if (e.subscription?.windowId === win.id) { chart.connectionState = 'disconnected'; chart.subscriptionId = null; syncUI(true); } }));
  unsubs.push(os.on('system-updated', (e) => { if (e?.id === sys.id) syncUI(false); }));
  unsubs.push(os.on('app-config', (e) => { if (e.systemId === sys.id) syncUI(false); }));

  updateColumns();
  ensureProcesses();
  sourceOptions();
  if (!chart.series?.length) chart.series = ['D'];
  if (!chart.labelColumn) chart.labelColumn = 'A';
  if (chart.cache && !chart.geometry) chart.renderDirty = true;
  syncUI(true);
  let autoReconnect = null;
  if (chart.connectionState === 'restored' && chart.docId && [...sourceSel.options].some((o) => o.value === chart.docId)) {
    autoReconnect = setTimeout(() => {
      if (!destroyed && chart.connectionState === 'restored' && chart.docId) {
        ctx.toast('快照恢复后自动重建数据连接', 'info');
        handleConnect();
      }
    }, 600);
  }
  const uiTimer = setInterval(() => { if (!destroyed) syncUI(false); }, 500);
  const drawTimer = setInterval(() => { if (!destroyed) drawView(); }, 80);

  return {
    destroy(opts = {}) {
      destroyed = true;
      clearTimeout(autoReconnect);
      clearInterval(uiTimer); clearInterval(drawTimer);
      for (const u of unsubs) u();
      if (opts.silent) {
        for (const p of sys.processes) if (p.windowId === win.id) p.tick = null;
        return;
      }
      if (chart.subscriptionId) os.disconnectChart(chart.subscriptionId, 'window-closed');
      chart.subscriptionId = null;
      for (const role of ['rx', 'render']) {
        const p = sys.processes.find((x) => x.windowId === win.id && x.role === role);
        if (p) os.removeProcess(sys.id, p.pid, { keepWindow: true });
      }
    },
    inspect() {
      return {
        sourceTitle: chart.sourceTitle || '',
        range: chart.range,
        chartType: chart.chartType,
        connectionState: chart.connectionState,
      };
    },
    // 投送使用
    getChartState: () => chart,
    sendChartCommand: (cmd, payload) => sendCommand(cmd, payload),
    drawChartTo(canvasEl, width, height) {
      return drawChart(canvasEl, chart, { compact: false });
    },
    toggleChartType: () => toggleType('projection'),
    selectPoint(group, series) { chart.selected = { group, series }; sendCommand('select', { group, series }); },
  };
}

// ---------------- 投送图表 ----------------
export function mountProjection(ctx, sourceView) {
  const { body, os } = ctx;
  body.innerHTML = `<div class="chart-projection">
    <div class="projection-chart-head">
      <div><b data-pc-title>图表投送</b><span data-pc-meta>—</span></div>
      <span class="badge" data-pc-state>同步</span>
    </div>
    <div class="projection-chart-canvas-wrap">
      <canvas class="projection-chart-canvas" data-testid="chart-canvas" data-pc-canvas></canvas>
      <div class="projection-chart-empty hidden" data-pc-empty>源图表尚未连接数据</div>
    </div>
    <div class="projection-chart-controls">
      <button type="button" class="chip-button" data-testid="chart-type" data-pc-type>${uiIcon('charts')} <span data-pc-type-label>切换类型</span></button>
      <span class="projection-chart-note">输入经消息队列送回源系统</span>
      <span class="spacer"></span>
      <span class="projection-chart-source" data-pc-source>—</span>
    </div>
  </div>`;
  const canvas = $s(body, '[data-pc-canvas]');
  const st = () => sourceView.getChartState();
  const paused = () => os.isEffectivelyPaused(sourceView.sysId);
  $s(body, '[data-pc-type]').addEventListener('click', () => {
    if (paused()) return;
    sourceView.toggleChartType();
  });
  canvas.addEventListener('click', (e) => {
    if (paused()) return;
    const state = st();
    if (!state.geometry) return;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const pad = { l: 52, r: 22, t: 50, b: 44 };
    const plotW = W - pad.l - pad.r;
    const group = clamp(Math.floor((e.clientX - rect.left - pad.l) / plotW / state.geometry.plot.w * state.geometry.labels.length), 0, state.geometry.labels.length - 1);
    let series = 0;
    for (const b of state.geometry.bars) {
      const bx = pad.l + b.x * plotW, bw = b.w * plotW;
      if (b.group === group && e.clientX - rect.left >= bx && e.clientX - rect.left <= bx + bw) series = b.series;
    }
    sourceView.selectPoint(group, series);
  });
  const timer = setInterval(() => {
    if (!document.body.contains(body)) return;
    const state = st();
    const rect = canvas.getBoundingClientRect();
    sourceView.drawChartTo(canvas, rect.width, rect.height);
    $s(body, '[data-pc-title]').textContent = state.sourceTitle || '图表投送';
    $s(body, '[data-pc-meta]').textContent = `${state.range} · ${state.chartType === 'line' ? '折线图' : '柱状图'} · 版本 ${state.version || '—'}`;
    $s(body, '[data-pc-state]').textContent = paused() ? '源系统暂停' : (state.connectionState === 'connected' ? '同步中' : (CONN_LABEL[state.connectionState] || state.connectionState));
    $s(body, '[data-pc-type-label]').textContent = state.chartType === 'line' ? '切换为柱状图' : '切换为折线图';
    $s(body, '[data-pc-type]').disabled = paused();
    $s(body, '[data-pc-empty]').hidden = !!state.cache;
    $s(body, '[data-pc-source]').textContent = `来源 ${sourceView.sys.name} · ${sourceView.win.title}`;
  }, 160);
  return { destroy() { clearInterval(timer); } };
}
