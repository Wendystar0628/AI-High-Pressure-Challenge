/* data-connection.js — real-time data connection between root spreadsheet and subsystem charts.
   The connection publishes full-region versions after each recalculation. */
export class DataConnectionHub {
  constructor(root) {
    this.root = root;
    this.connections = new Map(); // connId -> { targetSystem, targetProc, docId, range, labelCol, valueCols, active }
    this.nextId = 1;

    // hook spreadsheet changes
    root._sheetSubscribers.push((doc) => {
      this._publish(doc);
    });
  }

  connect(opts) {
    const id = 'conn-' + (this.nextId++);
    const conn = {
      id,
      targetSystem: opts.targetSystem,  // SubInstance
      targetProcId: opts.targetProcId,
      docId: opts.docId,
      range: opts.range,
      labelCol: opts.labelCol,
      valueCols: opts.valueCols,
      active: true,
      version: 0
    };
    this.connections.set(id, conn);
    // send initial data
    this._sendData(conn);
    return id;
  }

  disconnect(connId) {
    const c = this.connections.get(connId);
    if (c) {
      c.active = false;
      this.connections.delete(connId);
    }
  }

  _publish(doc) {
    for (const conn of this.connections.values()) {
      if (conn.active && conn.docId === doc.id) {
        this._sendData(conn);
      }
    }
  }

  _sendData(conn) {
    const books = this.root.openWorkbooks;
    const doc = books.get(conn.docId);
    if (!doc || !conn.targetSystem) return;
    // compute region values
    const rows = this._computeRegion(doc, conn.range, conn.labelCol, conn.valueCols);
    conn.version++;
    const payload = {
      type: 'data-update',
      connId: conn.id,
      version: conn.version,
      range: conn.range,
      labels: rows.map(r => r.label),
      series: conn.valueCols.map((_, si) => rows.map(r => r.values[si])),
      seriesNames: conn.valueCols.map(c => c + ' 列'),
      chartType: null
    };
    // deliver to subsystem via message
    try {
      if (conn.targetSystem.deliverToProc) {
        conn.targetSystem.deliverToProc(conn.targetProcId, payload);
      } else {
        // push into subsystem's message queue
        const pid = conn.targetProcId;
        if (!conn.targetSystem.msgQueues[pid]) conn.targetSystem.msgQueues[pid] = [];
        conn.targetSystem.msgQueues[pid].push({ from: 0, data: payload });
        // wake if waiting
        const p = conn.targetSystem.userProcs.get(pid);
        if (p && p.waiting === 'recv') {
          p.pendingInject = { from: 0, data: payload };
          conn.targetSystem.msgQueues[pid].pop();
          p.waiting = null;
          p.state = 'ready';
        }
      }
    } catch (e) {
      console.error('data push failed', e);
    }
  }

  _computeRegion(doc, range, labelCol, valueCols) {
    const [a1, a2] = range.split(':');
    const minR = parseInt(a1.match(/\d+/)[0]);
    const maxR = parseInt(a2.match(/\d+/)[0]);
    const cells = doc.cells || {};
    const getVal = (addr) => {
      const raw = cells[addr];
      if (raw === undefined || raw === null || raw === '') return '';
      const s = String(raw);
      if (s.startsWith('=')) {
        // simple formula evaluation
        try { return evalFormulaSimple(s.slice(1), cells); } catch (e) { return s; }
      }
      const n = Number(s);
      return isNaN(n) ? s : n;
    };
    const rows = [];
    for (let r = minR + 1; r <= maxR; r++) {
      const label = String(getVal(labelCol + r) ?? r);
      const values = valueCols.map(col => {
        const v = getVal(col + r);
        return typeof v === 'number' ? v : (parseFloat(v) || 0);
      });
      rows.push({ label, values });
    }
    return rows;
  }
}

function evalFormulaSimple(expr, cells) {
  const s = expr.replace(/\s+/g, '');
  // SUM(A1:A10)
  const sumM = s.match(/^SUM\(([A-Z]+\d+):([A-Z]+\d+)\)$/i);
  if (sumM) {
    const a1 = sumM[1], a2 = sumM[2];
    const r1 = parseInt(a1.match(/\d+/)[0]), r2 = parseInt(a2.match(/\d+/)[0]);
    const c1 = a1.match(/[A-Z]+/)[0], c2 = a2.match(/[A-Z]+/)[0];
    let total = 0;
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let ci = c1.charCodeAt(0); ci <= c2.charCodeAt(0); ci++) {
        const addr = String.fromCharCode(ci) + r;
        const v = cells[addr];
        total += typeof v === 'number' ? v : (parseFloat(v) || 0);
      }
    }
    return total;
  }
  // simple arithmetic with cell refs: B2*C2
  if (/^[A-Z]+\d+[\*\+\-\/][A-Z]+\d+$/i.test(s)) {
    const m = s.match(/^([A-Z]+\d+)([\*\+\-\/])([A-Z]+\d+)$/i);
    const va = parseFloat(cells[m[1]]) || 0;
    const vb = parseFloat(cells[m[3]]) || 0;
    if (m[2] === '*') return va * vb;
    if (m[2] === '+') return va + vb;
    if (m[2] === '-') return va - vb;
    if (m[2] === '/') return vb === 0 ? 0 : va / vb;
  }
  // pure number
  const n = parseFloat(s);
  return isNaN(n) ? s : n;
}
