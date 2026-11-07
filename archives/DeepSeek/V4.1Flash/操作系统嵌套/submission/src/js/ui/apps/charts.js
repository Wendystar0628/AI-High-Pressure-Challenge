// 图表工作台：根系统电子表格实时连接、分组柱状图/折线图与投送
import * as M from '../../model.js';
import { el, clamp, fmtNum, fmtTime } from '../../util.js';
import { ui as glyph } from '../../icons.js';
import { toast } from '../common.js';
import { changed } from '../../store.js';
import { makeChartState, subscribeChart, disconnectChart, reconnectChart, openWorkbooks, chartStatusLabel } from '../../databus.js';

const PALETTE = ['#8b7bff', '#4be3d1', '#ffd166', '#ff7aa2', '#5ba8ff', '#8ee06a'];

export function mount(ctx) {
  const sourceSys = ctx.sys, sourceWin = ctx.win;
  let chart = sourceSys.apps.charts[sourceWin.id];
  if (!chart) {
    chart = makeChartState(sourceSys, sourceWin.id);
    sourceSys.apps.charts[sourceWin.id] = chart;
  }
  ctx.setTitle('图表工作台', chart.sourceTitle ? `${chart.sourceTitle} · ${chart.range}` : '尚未连接数据源');
  return buildChartUI(ctx, sourceSys, sourceWin, chart, false);
}

export function mountProjection(ctx) {
  const model = ctx.ui.model;
  const pw = ctx.win;
  const srcSys = model.systems[pw.payload.sourceSystemId];
  const srcWin = srcSys ? srcSys.windows.find(w => w.id === pw.payload.sourceWindowId) : null;
  const chart = srcSys && srcWin ? srcSys.apps.charts[srcWin.id] : null;
  if (!srcSys || !srcWin || !chart) {
    ctx.body.append(el('div', { class: 'empty-state' }, el('div', { class: 'big', text: '⧉' }), el('div', { text: '源图表已关闭，投送结束。' })));
    return {
      destroy() { },
      onTick() {
        const s = model.systems[pw.payload.sourceSystemId];
        const w = s && s.windows.find(x => x.id === pw.payload.sourceWindowId);
        if (!w && model.systems[pw.systemId]) {
          M.closeWindow(model, model.systems[pw.systemId], pw.id);
          ctx.ui.refresh('projection-source-gone');
        }
      }
    };
  }
  return buildChartUI(ctx, srcSys, srcWin, chart, true);
}

function buildChartUI(ctx, sys, win, chart, projected) {
  const model = ctx.ui.model;
  const root = el('div', { class: 'app charts' });
  const bar = el('div', { class: 'charts-bar' });
  const sourceSel = el('select', { class: 'tsel', dataset: { testid: 'chart-source' }, 'aria-label': '工作簿', style: { maxWidth: '190px' } });
  const rangeInput = el('input', { class: 'tin', dataset: { testid: 'chart-range' }, 'aria-label': '数据区域', value: chart.range, style: { width: '92px' } });
  const labelInput = el('input', { class: 'tin', dataset: { testid: 'chart-label-column' }, 'aria-label': '标签列', value: chart.labelCol, style: { width: '44px' } });
  const seriesInput = el('input', { class: 'tin', dataset: { testid: 'chart-series' }, 'aria-label': '数值列', value: chart.series, style: { width: '58px' } });
  const typeSel = el('select', { class: 'tsel', dataset: { testid: 'chart-type' }, 'aria-label': '图表类型' },
    el('option', { value: 'bar', text: '分组柱状图' }), el('option', { value: 'line', text: '折线图' }));
  typeSel.value = chart.chartType || 'bar';
  const btnConnect = el('button', { class: 'btn sm primary', dataset: { testid: 'chart-connect' }, text: '连接' });
  const btnDisconnect = el('button', { class: 'btn sm ghost', dataset: { testid: 'chart-disconnect' }, text: '断开' });
  const btnReconnect = el('button', { class: 'btn sm ghost', text: '重新连接' });
  const btnRefresh = el('button', { class: 'iconbtn', title: '刷新工作簿列表', 'aria-label': '刷新', html: glyph('refresh', 14) });
  bar.append(el('label', { text: '源' }), sourceSel, btnRefresh, el('label', { text: '区域' }), rangeInput,
    el('label', { text: '标签列' }), labelInput, el('label', { text: '数值列' }), seriesInput, typeSel, btnConnect, btnDisconnect, btnReconnect);
  const wrap = el('div', { class: 'charts-canvas-wrap' });
  const canvas = el('canvas');
  const tooltip = el('div', { class: 'chart-tooltip' });
  const pausedOverlay = el('div', { class: 'sleep-overlay' }, el('div', { class: 'big', text: '⏸' }), el('div', { text: '源系统已暂停' }), el('div', { class: 'dim', text: '图表内容冻结；投送外框仍可操作' }));
  wrap.append(pausedOverlay);
  const empty = el('div', { class: 'chart-empty' },
    el('div', { style: { fontSize: '24px', opacity: '.5' }, html: glyph('charts', 30) }),
    el('div', { text: '选择根系统已打开的工作簿和区域，然后点击「连接」。' }),
    el('div', { class: 'dim', style: { fontSize: '10px' }, text: '示例：/Demo/sample.sheet · A1:D4 · 标签 A · 数值 D' }),
    (() => {
      const b = el('button', { class: 'btn sm', text: '打开示例工作簿', onclick: () => {
        const root = model.systems[model.rootId];
        if (M.fsRead(root, '/Demo/sample.sheet') == null) { toast('示例不存在', '', 'err', sys); return; }
        ctx.ui.openSpreadsheet(root, '/Demo/sample.sheet');
        toast('已打开示例工作簿', '请在图表中选择它并连接。', 'ok', sys);
        refreshSources();
      } });
      return b;
    })()
  );
  wrap.append(canvas, empty, tooltip);
  const meta = el('div', { class: 'charts-meta' });
  const status = el('div', { class: 'statusbar' });
  root.append(bar, wrap, meta, status);
  ctx.body.append(root);
  if (projected) {
    status.innerHTML = '';
    status.append(el('span', { class: 'dot ' + (M.runtimeState(model, sys) === 'running' ? 'ok' : 'pause') }), el('span', { text: `来源 ${sys.id} / ${win.id}` }));
  }
  const timeEl = el('span');
  meta.append(el('span', { class: 'pill info', text: '实时数据连接' }), timeEl,
    el('span', { style: { flex: 1 } }), el('span', { text: '图表过渡使用子系统虚拟时间' }));

  let hover = null;
  let lastDraw = 0;

  function refreshSources() {
    const prev = sourceSel.value;
    sourceSel.innerHTML = '';
    const docs = openWorkbooks(model);
    if (!docs.length) {
      sourceSel.append(el('option', { value: '', text: '（根系统未打开工作簿）' }));
      btnConnect.disabled = true;
    } else {
      btnConnect.disabled = false;
      for (const d of docs) sourceSel.append(el('option', { value: d.docId, text: `${d.title} · ${d.path}` }));
      const match = docs.find(d => d.docId === chart.sourceDocId) || docs.find(d => d.path === chart.sourcePath);
      if (match) sourceSel.value = match.docId;
      else if (prev && docs.some(d => d.docId === prev)) sourceSel.value = prev;
    }
    btnDisconnect.disabled = !chart.sourcePath;
    btnReconnect.disabled = !chart.sourcePath;
    rangeInput.value = chart.range;
    labelInput.value = chart.labelCol;
    seriesInput.value = chart.series;
    typeSel.value = chart.chartType || 'bar';
  }

  function doConnect() {
    if (M.runtimeState(model, sys) !== 'running') { toast('源系统暂停中', '恢复源系统后再连接。', 'warn', sys); return; }
    const docId = sourceSel.value;
    if (!docId) { toast('没有可连接的工作簿', '请先在根系统打开一个 .sheet 工作簿。', 'warn', sys); return; }
    const r = subscribeChart(model, sys, chart, {
      docId, range: rangeInput.value.trim(), labelCol: labelInput.value.trim(), series: seriesInput.value.trim(),
      chartType: typeSel.value
    });
    if (!r.ok) { toast('连接失败', r.error, 'err', sys); chart.error = r.error; return; }
    if (!projected) ctx.setTitle('图表工作台', `${chart.sourceTitle} · ${chart.range}`);
    toast('已建立实时连接', `${chart.sourceTitle} · ${chart.range} · 数值列 ${chart.series}`, 'ok', sys);
    changed('chart-connect');
    refreshSources();
  }
  btnConnect.addEventListener('click', doConnect);
  btnDisconnect.addEventListener('click', () => {
    disconnectChart(sys, chart);
    toast('已断开数据连接', '保留最后的图表与数据。', 'info', sys);
  });
  btnReconnect.addEventListener('click', () => {
    const r = reconnectChart(model, sys, chart);
    if (!r.ok) toast('重新连接失败', r.error, 'err', sys);
    else toast('已重新连接', '已取得源工作簿当前完整选区。', 'ok', sys);
  });
  btnRefresh.addEventListener('click', refreshSources);
  typeSel.addEventListener('change', () => { chart.chartType = typeSel.value; changed('chart-type'); });
  for (const inp of [rangeInput, labelInput, seriesInput]) inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') doConnect(); });

  // ---------- 绘图 ----------
  function draw() {
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    c.clearRect(0, 0, W, H);
    // 背景
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(22,27,45,.55)'); bg.addColorStop(1, 'rgba(9,12,21,.35)');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const data = chart.data;
    empty.style.display = data && data.labels && data.labels.length ? 'none' : 'flex';
    if (!data || !data.labels || !data.labels.length) { drawEmptyHint(c, W, H); updateStatus(); return; }
    const series = data.series || [];
    const labels = data.labels || [];
    const n = labels.length;
    const pad = { l: 52, r: 24, t: 58, b: 62 };
    const plotW = Math.max(20, W - pad.l - pad.r), plotH = Math.max(20, H - pad.t - pad.b);
    let maxV = 0;
    for (const s of series) for (const v of s.values || []) maxV = Math.max(maxV, Number(v) || 0);
    if (maxV === 0) maxV = 1;
    maxV *= 1.18;
    // 过渡
    let alpha = 1, grow = 1;
    if (chart.transition && chart.transition.start != null) {
      const elapsed = sys.clock - chart.transition.start;
      const u = clamp(elapsed / (chart.transition.dur || .45), 0, 1);
      alpha = .45 + .55 * u; grow = .82 + .18 * u;
    }
    c.save();
    c.globalAlpha = alpha;
    // 标题
    c.fillStyle = '#eef2ff'; c.font = '600 14px "Segoe UI","Microsoft YaHei UI",sans-serif'; c.textAlign = 'left';
    c.fillText(`${chart.sourceTitle || '未命名工作簿'} · ${data.range || chart.range}`, pad.l, 26);
    c.fillStyle = '#8f9bc0'; c.font = '10px "Segoe UI","Microsoft YaHei UI",sans-serif';
    c.fillText(`版本 v${data.version ?? chart.version} · ${chart.chartType === 'line' ? '折线图' : '分组柱状图'} · ${n} 组`, pad.l, 42);
    // 网格与 Y 轴
    c.textAlign = 'right'; c.fillStyle = '#7784a8'; c.font = '10px sans-serif';
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const y = pad.t + plotH - (i / ticks) * plotH;
      c.strokeStyle = i === 0 ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.07)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(pad.l, y); c.lineTo(pad.l + plotW, y); c.stroke();
      c.fillText(fmtNum(maxV / 1.18 * (i / ticks), 1), pad.l - 9, y + 3.5);
    }
    // X 标签
    c.textAlign = 'center'; c.fillStyle = '#9aa6c8'; c.font = '10px "Segoe UI","Microsoft YaHei UI",sans-serif';
    const groupW = plotW / n;
    const skip = Math.ceil(n / Math.max(4, Math.floor(plotW / 70)));
    for (let i = 0; i < n; i++) {
      if (i % skip !== 0 && i !== n - 1) continue;
      const x = pad.l + groupW * (i + .5);
      let label = String(labels[i]);
      if (label.length > 8) label = label.slice(0, 8) + '…';
      c.save();
      c.translate(x, pad.t + plotH + 15);
      if (n > 8 && groupW < 50) { c.rotate(-0.5); c.textAlign = 'right'; }
      c.fillText(label, 0, 0);
      c.restore();
    }
    // 图例
    c.textAlign = 'left'; c.font = '10px "Segoe UI","Microsoft YaHei UI",sans-serif';
    let lx = W - pad.r - 4;
    const legendW = series.map(s => 16 + String(s.name || s.key).length * 7).reduce((a, b) => a + b + 12, 0);
    lx = Math.max(pad.l, W - pad.r - legendW);
    const ly = 22;
    for (let si = 0; si < series.length; si++) {
      const s = series[si];
      const col = PALETTE[si % PALETTE.length];
      c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(lx, ly, 9, 9, 2) : c.rect(lx, ly, 9, 9); c.fill();
      c.fillStyle = '#c8d2ec';
      c.fillText(String(s.name || s.key || ('列 ' + s.key)), lx + 13, ly + 8);
      lx += 16 + String(s.name || s.key).length * 7 + 14;
    }
    // 图形
    if (chart.chartType === 'line') {
      for (let si = 0; si < series.length; si++) {
        const s = series[si];
        const col = PALETTE[si % PALETTE.length];
        c.strokeStyle = col; c.lineWidth = 2.4; c.lineJoin = 'round';
        c.beginPath();
        const pts = [];
        for (let i = 0; i < n; i++) {
          const x = pad.l + groupW * (i + .5);
          const y = pad.t + plotH - (Number(s.values[i]) || 0) / maxV * plotH * grow;
          pts.push([x, y]);
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
        // 填充
        if (pts.length) {
          const g = c.createLinearGradient(0, pad.t, 0, pad.t + plotH);
          g.addColorStop(0, col + '44'); g.addColorStop(1, col + '00');
          c.fillStyle = g;
          c.beginPath(); c.moveTo(pts[0][0], pad.t + plotH);
          for (const pt of pts) c.lineTo(pt[0], pt[1]);
          c.lineTo(pts[pts.length - 1][0], pad.t + plotH); c.closePath(); c.fill();
        }
        for (let i = 0; i < n; i++) {
          const x = pad.l + groupW * (i + .5);
          const y = pad.t + plotH - (Number(s.values[i]) || 0) / maxV * plotH * grow;
          c.fillStyle = '#0b0f1a'; c.beginPath(); c.arc(x, y, 4.2, 0, 7); c.fill();
          c.fillStyle = col; c.beginPath(); c.arc(x, y, 2.8, 0, 7); c.fill();
          c.fillStyle = '#dce4ff'; c.font = '9px sans-serif'; c.textAlign = 'center';
          if (n <= 12) c.fillText(fmtNum(Number(s.values[i]), 0), x, y - 8);
        }
      }
    } else {
      const sw = Math.max(4, Math.min(30, groupW * .68));
      const bw = sw / Math.max(1, series.length);
      for (let i = 0; i < n; i++) {
        const x0 = pad.l + groupW * (i + .5) - sw / 2;
        for (let si = 0; si < series.length; si++) {
          const s = series[si];
          const val = Number(s.values[i]) || 0;
          const bh = val / maxV * plotH * grow;
          const x = x0 + si * bw;
          const y = pad.t + plotH - bh;
          const col = PALETTE[si % PALETTE.length];
          const g = c.createLinearGradient(0, y, 0, pad.t + plotH);
          g.addColorStop(0, col); g.addColorStop(1, col + '99');
          c.fillStyle = g;
          c.beginPath();
          if (c.roundRect) c.roundRect(x + 1, y, Math.max(2, bw - 2), Math.max(0, bh), 3);
          else c.rect(x + 1, y, Math.max(2, bw - 2), Math.max(0, bh));
          c.fill();
          if (n <= 12 && bw >= 18) {
            c.fillStyle = '#eef2ff'; c.font = '9.5px sans-serif'; c.textAlign = 'center';
            c.fillText(fmtNum(val, 0), x + Math.max(2, bw - 2) / 2, y - 5);
          }
        }
      }
    }
    c.restore();
    // 悬停提示
    if (hover) {
      const i = clamp(Math.floor((hover.x - pad.l) / groupW), 0, n - 1);
      if (hover.x >= pad.l && hover.x <= pad.l + plotW && hover.y >= pad.t && hover.y <= pad.t + plotH) {
        c.strokeStyle = 'rgba(139,123,255,.4)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(pad.l + groupW * (i + .5), pad.t); c.lineTo(pad.l + groupW * (i + .5), pad.t + plotH); c.stroke();
        tooltip.style.display = 'block';
        tooltip.style.left = Math.min(W - 160, hover.x + 12) + 'px';
        tooltip.style.top = Math.max(4, hover.y - 20) + 'px';
        tooltip.innerHTML = `<b>${escapeHtml(String(labels[i]))}</b><br>` + series.map((s, si) => `<span style="color:${PALETTE[si % PALETTE.length]}">●</span> ${escapeHtml(String(s.name || s.key))}: <b>${fmtNum(Number(s.values[i]), 2)}</b>`).join('<br>');
      } else tooltip.style.display = 'none';
    } else tooltip.style.display = 'none';
    updateStatus();
    // 目标数据比较提示
    if (chart.transition && chart.transition.from && sys.clock - chart.transition.start < (chart.transition.dur || .45) + .2) {
      requestAnimationFrame(() => { });
    }
  }
  function drawEmptyHint(c, W, H) {
    c.fillStyle = 'rgba(255,255,255,.03)';
    c.fillRect(52, 60, W - 76, H - 120);
  }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x])); }
  for (const evt of ['mousemove', 'mouseleave']) {
    wrap.addEventListener(evt, (e) => {
      if (evt === 'mouseleave') hover = null;
      else { const r = wrap.getBoundingClientRect(); hover = { x: e.clientX - r.left, y: e.clientY - r.top }; }
    });
  }
  function updateStatus() {
    if (projected) return;
    status.innerHTML = '';
    const pending = (chart.pendingIn || []).length;
    status.append(
      el('span', { text: `连接：${chartStatusLabel(chart)}` }),
      el('span', { text: `源版本 v${chart.sourceVersion || 0} · 已处理 v${chart.displayVersion || 0} · 待处理 ${pending}` }),
      el('span', { text: `消息 ${chart.messageCount || 0}` }),
      el('span', { class: 'spacer', style: { flex: 1 } }),
      el('span', { text: `${chart.sourceTitle || '—'} · ${chart.range}` }),
      el('span', { text: chart.connection === 'connected' ? '根系统表格修改后自动发布新版本' : chart.connection === 'restored' ? '恢复后待重新连接' : '' })
    );
    timeEl.textContent = `已处理 ${chart.displayVersion ? 'v' + chart.displayVersion : '—'}`;
    if (chart.pendingIn && chart.pendingIn.length) {
      // 显示队列等待
      status.append(el('span', { class: 'pill warn', text: `${chart.pendingIn.length} 个版本排队` }));
    }
    if (chart.connection === 'source-closed') status.append(el('span', { class: 'pill warn', text: '数据源已关闭' }));
  }
  function refreshConnectionState() {
    refreshSources();
    updateStatus();
  }
  refreshConnectionState();
  draw();
  let lastTick = 0;
  let lastTitle = '';
  let lastOpenSig = '';
  return {
    onTick() {
      const now = performance.now();
      if (now - lastTick < 60) return;
      lastTick = now;
      const docs = openWorkbooks(model);
      const sig = docs.map(d => d.docId).join(',');
      if (sig !== lastOpenSig) { lastOpenSig = sig; refreshSources(); }
      const paused = M.runtimeState(model, sys) !== 'running';
      if (projected) {
        pausedOverlay.classList.toggle('show', paused);
        pausedOverlay.querySelectorAll('.dim')[0].textContent = paused ? '图表进程与数据更新已停止；恢复后按序处理积压版本' : '';
        for (const elx of [sourceSel, rangeInput, labelInput, seriesInput, typeSel, btnConnect, btnDisconnect, btnReconnect, btnRefresh]) elx.disabled = paused;
      }
      if (chart.sourceTitle && chart.sourceTitle !== lastTitle) {
        lastTitle = chart.sourceTitle;
        if (!projected) ctx.setTitle('图表工作台', `${chart.sourceTitle} · ${chart.range}`);
      }
      draw();
    },
    destroy() { },
    requestClose() { return true; }
  };
}
