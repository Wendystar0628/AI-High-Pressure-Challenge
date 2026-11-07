/* 根系统电子表格 → 子系统图表的实时数据通道。
 * 数据以完整选区副本跨层传递，不共享可变对象。 */
import { readBlock, computeDoc } from './workbook.js';
import { notify, chargeWork, changed } from './model.js';

export function rootSystem(model) { return model.systems[model.rootId]; }

export function openWorkbooks(model) {
  const root = rootSystem(model);
  if (!root) return [];
  const openIds = new Set(root.windows.filter(w => w.appId === 'spreadsheet' && w.payload && w.payload.docId).map(w => w.payload.docId));
  return Object.values(root.apps.spreadsheets).filter(d => d && d.open !== false && openIds.has(d.id)).map(d => ({
    docId: d.id, title: d.name, path: d.path, version: d.version, doc: d
  }));
}

export function docById(model, id) {
  const root = rootSystem(model);
  return root ? root.apps.spreadsheets[id] || null : null;
}
export function docByPath(model, path) {
  const root = rootSystem(model);
  if (!root) return null;
  return Object.values(root.apps.spreadsheets).find(d => d.path === path) || null;
}

export function makeChartState(sys, winId) {
  return {
    winId, sourcePath: null, sourceTitle: '未连接', sourceDocId: null,
    range: 'A1:D4', labelCol: 'A', series: 'D', chartType: 'bar',
    connection: 'disconnected', data: null, pendingIn: [], version: 0,
    displayVersion: 0, sourceVersion: 0, receivedVersion: 0,
    transition: null, error: null, messageCount: 0, selectedSeries: 0,
    hover: null, statusText: '尚未建立数据连接'
  };
}

function specOf(chart) {
  return { range: chart.range, labelCol: chart.labelCol, series: chart.series };
}

export function readChartBlock(doc, chart) {
  computeDoc(doc);
  return readBlock(doc, chart.range, chart.labelCol, chart.series);
}

export function subscribeChart(model, sys, chart, spec) {
  const doc = spec.docId ? docById(model, spec.docId) : docByPath(model, spec.path);
  if (!doc) return { ok: false, error: '源工作簿未打开' };
  if (!rootSystem(model).windows.some(w => w.appId === 'spreadsheet' && w.payload && w.payload.docId === doc.id)) {
    return { ok: false, error: '源工作簿窗口已关闭' };
  }
  chart.range = (spec.range || chart.range || 'A1:D4').toUpperCase().replace(/\s/g, '');
  chart.labelCol = (spec.labelCol || chart.labelCol || 'A').toUpperCase().replace(/[^A-Z]/g, '');
  chart.series = (spec.series || chart.series || 'D').toUpperCase().replace(/[^A-Z,]/g, '');
  chart.chartType = spec.chartType || chart.chartType || 'bar';
  const block = readChartBlock(doc, chart);
  if (!block.ok) return { ok: false, error: block.error };
  chargeWork(sys, 'datafeed', 80 + (block.labels.length * block.series.length) * 2);
  chart.sourcePath = doc.path;
  chart.sourceDocId = doc.id;
  chart.sourceTitle = doc.name;
  chart.connection = 'connected';
  chart.error = null;
  chart.statusText = '已连接，等待数据版本';
  chart.displayVersion = 0;
  chart.receivedVersion = 0;
  chart.pendingIn = [];
  chart.pendingIn.push({ version: doc.version, block: JSON.parse(JSON.stringify(block)), at: 0 });
  chart.sourceVersion = doc.version;
  chart.startedAt = sys.clock;
  changed('chart-connect');
  return { ok: true, doc, block };
}

export function disconnectChart(sys, chart) {
  chart.connection = 'disconnected';
  chart.pendingIn = [];
  chart.statusText = '已断开，保留最后的图表与数据';
  changed('chart-disconnect');
}

export function reconnectChart(model, sys, chart) {
  let doc = chart.sourceDocId ? docById(model, chart.sourceDocId) : null;
  if (!doc) doc = docByPath(model, chart.sourcePath);
  if (!doc) return { ok: false, error: '数据源工作簿已关闭，请重新打开并选择' };
  if (!rootSystem(model).windows.some(w => w.appId === 'spreadsheet' && w.payload && w.payload.docId === doc.id)) {
    return { ok: false, error: '数据源工作簿窗口已关闭' };
  }
  return subscribeChart(model, sys, chart, { docId: doc.id, range: chart.range, labelCol: chart.labelCol, series: chart.series, chartType: chart.chartType });
}

export function publishWorkbook(model, root, doc) {
  const systems = Object.values(model.systems);
  let published = 0;
  for (const sys of systems) {
    for (const chart of Object.values(sys.apps.charts || {})) {
      if (chart.sourcePath !== doc.path) continue;
      if (chart.connection !== 'connected') continue;
      if (doc.version <= (chart.sourceVersion || 0)) continue;
      const block = readChartBlock(doc, chart);
      if (!block.ok) continue;
      chart.pendingIn = chart.pendingIn || [];
      chart.pendingIn.push({ version: doc.version, block: JSON.parse(JSON.stringify(block)), at: sys.clock });
      if (chart.pendingIn.length > 120) chart.pendingIn.splice(0, chart.pendingIn.length - 120);
      chart.sourceVersion = doc.version;
      chart.sourceTitle = doc.name;
      chart.statusText = `新版本 v${doc.version} 已排队`;
      published++;
    }
  }
  return published;
}

export function markSourceClosed(model, doc) {
  for (const sys of Object.values(model.systems)) {
    for (const chart of Object.values(sys.apps.charts || {})) {
      if (chart.sourcePath === doc.path && (chart.connection === 'connected' || chart.connection === 'restored')) {
        chart.connection = 'source-closed';
        chart.statusText = '数据源已关闭，保留已接收数据';
        notify(sys, '数据源已关闭', `工作簿「${doc.name}」已关闭，图表保留已接收的数据。`, { kind: 'warn', toast: false });
      }
    }
  }
}

export function markRestored(sys) {
  for (const chart of Object.values(sys.apps.charts || {})) {
    if (chart.connection === 'connected') {
      chart.connection = 'restored';
      chart.statusText = '已恢复，待重新连接';
    }
  }
}

export function chartStatusLabel(chart) {
  return {
    disconnected: '未连接', connected: '已连接', restored: '已恢复 · 待重连',
    'source-closed': '数据源已关闭', error: '连接错误'
  }[chart.connection] || chart.connection;
}
