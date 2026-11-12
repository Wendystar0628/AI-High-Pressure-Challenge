/* spreadsheet.js — single-sheet spreadsheet with formulas */
import { el, uid } from '../../utils.js';

const COLS = 12, ROWS = 40;

export class SpreadsheetApp {
  constructor(root) {
    this.root = root;
  }

  open(params = {}) {
    let doc = null;
    if (params.path) {
      try {
        const data = this.root.vfs.read(params.path);
        doc = {
          id: params.path,
          path: params.path,
          name: data.name || params.path.split('/').pop(),
          cells: data.cells || {},
          dirty: false
        };
      } catch (e) { }
    }
    if (!doc) {
      doc = {
        id: uid('wb'),
        path: params.path || null,
        name: params.name || '未命名.sheet',
        cells: {},
        dirty: false
      };
    }
    const state = {
      doc,
      sel: 'A1',
      editing: null,
      undoStack: [],
      redoStack: []
    };
    const win = this.root.createWindow({
      appId: 'spreadsheet',
      title: doc.name + ' — 电子表格',
      icon: 'spreadsheet',
      w: 860, h: 560,
      onClose: async () => {
        if (state.doc.dirty) {
          const r = await this.root.dialog({
            title: '未保存的修改',
            message: `${state.doc.name} 有未保存的修改。`,
            buttons: [
              { label: '取消', value: 'cancel' },
              { label: '放弃', value: 'discard', danger: true },
              { label: '保存', value: 'save', primary: true }
            ]
          });
          if (r === 'cancel') return false;
          if (r === 'save') this._save(state);
        }
        this.root.openWorkbooks.delete(state.doc.id);
        return true;
      }
    });
    this.root.openWorkbooks.set(state.doc.id, state.doc);
    this._render(win.body, state, win);
    return win;
  }

  _render(body, state, win) {
    body.innerHTML = '';
    const app = el('div', {
      class: 'app-root', 'data-app-id': 'spreadsheet',
      'data-system-id': this.root.id, 'data-window-id': win.id
    });

    // toolbar
    const toolbar = el('div', { class: 'app-toolbar' });
    const nameInput = el('input', {
      type: 'text', 'data-testid': 'sheet-filename',
      value: state.doc.name, style: 'width:180px',
      onchange: (e) => { state.doc.name = e.target.value; state.doc.dirty = true; this._updateDirty(state); }
    });
    const saveBtn = el('button', {
      class: 'btn primary', 'data-testid': 'sheet-save', text: '保存',
      onclick: () => this._save(state)
    });
    const undoBtn = el('button', { class: 'btn', text: '撤销', onclick: () => this._undo(state) });
    const redoBtn = el('button', { class: 'btn', text: '重做', onclick: () => this._redo(state) });
    toolbar.appendChild(nameInput);
    toolbar.appendChild(saveBtn);
    toolbar.appendChild(el('div', { class: 'sep' }));
    toolbar.appendChild(undoBtn);
    toolbar.appendChild(redoBtn);
    this.dirtyDot = el('span', { class: 'sheet-dirty-dot', title: '未保存', style: 'display:none' });
    toolbar.appendChild(this.dirtyDot);

    // formula bar
    const formulaBar = el('div', { class: 'sheet-formula-bar' });
    this.cellRef = el('div', { class: 'sheet-cell-ref', text: state.sel });
    this.formulaInput = el('input', {
      class: 'input sheet-formula', 'data-testid': 'sheet-formula', type: 'text'
    });
    this.formulaInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this._setCell(state, state.sel, this.formulaInput.value);
        this._moveSel(state, 1, 0);
      } else if (e.key === 'Escape') {
        this.formulaInput.value = this._cellFormula(state, state.sel);
      }
    });
    formulaBar.appendChild(this.cellRef);
    formulaBar.appendChild(this.formulaInput);

    // grid
    const gridWrap = el('div', { class: 'sheet-grid-wrap' });
    const table = el('table', { class: 'sheet-grid', 'data-testid': 'sheet-grid' });
    const thead = el('thead');
    const hr = el('tr');
    hr.appendChild(el('th', { text: '' }));
    for (let c = 0; c < COLS; c++) hr.appendChild(el('th', { text: colName(c) }));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el('tbody');
    for (let r = 1; r <= ROWS; r++) {
      const tr = el('tr');
      tr.appendChild(el('th', { text: String(r) }));
      for (let c = 0; c < COLS; c++) {
        const addr = colName(c) + r;
        const td = el('td', {
          'data-testid': 'sheet-cell',
          'data-cell-address': addr
        });
        td.addEventListener('mousedown', (e) => {
          state.sel = addr;
          this._renderSelection(state);
          this.formulaInput.value = this._cellFormula(state, addr);
          this.cellRef.textContent = addr;
        });
        td.addEventListener('dblclick', () => this._beginEdit(state, addr));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    gridWrap.appendChild(table);

    const statusbar = el('div', { class: 'app-statusbar' });
    this.statusEl = el('span', { text: '就绪' });
    statusbar.appendChild(this.statusEl);

    app.appendChild(toolbar);
    app.appendChild(formulaBar);
    app.appendChild(gridWrap);
    app.appendChild(statusbar);
    body.appendChild(app);

    state._els = { table, body, win };
    this._renderCells(state);
    this._renderSelection(state);
    this.formulaInput.value = this._cellFormula(state, state.sel);
  }

  _cellFormula(state, addr) {
    const v = state.doc.cells[addr];
    return v === undefined || v === null ? '' : String(v);
  }

  _beginEdit(state, addr) {
    const td = state._els.table.querySelector(`[data-cell-address="${addr}"]`);
    if (!td || td.querySelector('.cell-input')) return;
    const input = el('input', { class: 'cell-input' });
    input.value = this._cellFormula(state, addr);
    td.appendChild(input);
    input.focus();
    input.select();
    const commit = (mv) => {
      this._setCell(state, addr, input.value);
      if (input.parentElement) input.parentElement.removeChild(input);
      if (mv) this._moveSel(state, mv[0], mv[1]);
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') commit([1, 0]);
      else if (e.key === 'Tab') commit([0, 1]);
      else if (e.key === 'Escape') {
        if (input.parentElement) input.parentElement.removeChild(input);
      }
    });
    input.addEventListener('blur', () => commit(null));
  }

  _setCell(state, addr, value) {
    this._pushUndo(state);
    if (value === '') delete state.doc.cells[addr];
    else state.doc.cells[addr] = value;
    state.doc.dirty = true;
    this._renderCells(state);
    this._updateDirty(state);
    this._publish(state);
  }

  _pushUndo(state) {
    state.undoStack.push(JSON.stringify(state.doc.cells));
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack.length = 0;
  }
  _undo(state) {
    if (!state.undoStack.length) return;
    state.redoStack.push(JSON.stringify(state.doc.cells));
    state.doc.cells = JSON.parse(state.undoStack.pop());
    state.doc.dirty = true;
    this._renderCells(state);
    this._publish(state);
  }
  _redo(state) {
    if (!state.redoStack.length) return;
    state.undoStack.push(JSON.stringify(state.doc.cells));
    state.doc.cells = JSON.parse(state.redoStack.pop());
    state.doc.dirty = true;
    this._renderCells(state);
    this._publish(state);
  }

  _moveSel(state, dr, dc) {
    const m = /^([A-Z]+)(\d+)$/.exec(state.sel);
    if (!m) return;
    let c = colIndex(m[1]) + dc;
    let r = parseInt(m[2]) + dr;
    c = Math.max(0, Math.min(COLS - 1, c));
    r = Math.max(1, Math.min(ROWS, r));
    state.sel = colName(c) + r;
    this._renderSelection(state);
    this.cellRef.textContent = state.sel;
    this.formulaInput.value = this._cellFormula(state, state.sel);
    const td = state._els.table.querySelector(`[data-cell-address="${state.sel}"]`);
    if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  _renderSelection(state) {
    const table = state._els.table;
    table.querySelectorAll('td.selected').forEach(t => t.classList.remove('selected'));
    const td = table.querySelector(`[data-cell-address="${state.sel}"]`);
    if (td) td.classList.add('selected');
    this.cellRef.textContent = state.sel;
    this.formulaInput.value = this._cellFormula(state, state.sel);
  }

  _updateDirty(state) {
    if (this.dirtyDot) this.dirtyDot.style.display = state.doc.dirty ? 'inline-block' : 'none';
  }

  /* ---- formula engine ---- */
  _compute(state) {
    const cells = state.doc.cells;
    const cache = {};
    const visiting = new Set();
    const compute = (addr) => {
      if (addr in cache) return cache[addr];
      if (visiting.has(addr)) {
        cache[addr] = { err: '循环依赖' };
        return cache[addr];
      }
      const raw = cells[addr];
      if (raw === undefined || raw === null || raw === '') { cache[addr] = { v: '' }; return cache[addr]; }
      if (typeof raw === 'number') { cache[addr] = { v: raw }; return cache[addr]; }
      const s = String(raw);
      if (!s.startsWith('=')) {
        const n = Number(s);
        cache[addr] = { v: isNaN(n) ? s : n };
        return cache[addr];
      }
      visiting.add(addr);
      let result;
      try {
        result = this._evalFormula(s.slice(1), compute, state);
      } catch (e) {
        result = { err: e.message };
      }
      visiting.delete(addr);
      cache[addr] = result;
      return result;
    };
    for (const a of Object.keys(cells)) compute(a);
    return cache;
  }

  _evalFormula(expr, compute, state) {
    // tokenize and evaluate: numbers, cell refs, ranges, SUM, operators + - * / ( )
    let i = 0;
    const s = expr.replace(/\s+/g, '');
    const peek = () => s[i];
    const next = () => s[i++];
    function parseExpr() {
      let v = parseTerm();
      while (i < s.length && (peek() === '+' || peek() === '-')) {
        const op = next();
        const r = parseTerm();
        if (op === '+') {
          if (typeof v === 'string' || typeof r === 'string') v = String(v) + String(r);
          else v = v + r;
        } else v = num(v) - num(r);
      }
      return v;
    }
    function parseTerm() {
      let v = parseFactor();
      while (i < s.length && (peek() === '*' || peek() === '/')) {
        const op = next();
        const r = parseFactor();
        if (op === '*') v = num(v) * num(r);
        else {
          if (num(r) === 0) throw new Error('除零错误');
          v = num(v) / num(r);
        }
      }
      return v;
    }
    function parseFactor() {
      if (peek() === '(') {
        next();
        const v = parseExpr();
        if (peek() !== ')') throw new Error('括号不匹配');
        next();
        return v;
      }
      if (peek() === '-') {
        next();
        return -num(parseFactor());
      }
      if (peek() === '+') {
        next();
        return num(parseFactor());
      }
      // function call or ref or number
      let start = i;
      while (i < s.length && /[A-Za-z0-9_$.:]/.test(s[i])) i++;
      const tok = s.slice(start, i);
      if (!tok) throw new Error('无效公式');
      const up = tok.toUpperCase();
      if (up === 'SUM' && peek() === '(') {
        next();
        const args = [];
        while (i < s.length && peek() !== ')') {
          args.push(parseExpr());
          if (peek() === ',') next();
        }
        if (peek() !== ')') throw new Error('SUM 括号不匹配');
        next();
        // sum can also handle range objects
        let total = 0;
        for (const a of args) {
          if (a && a.__range) {
            for (const v of a.values) total += num(v);
          } else total += num(a);
        }
        return total;
      }
      if (/^[A-Z]+[0-9]+$/.test(up)) {
        const r = compute(up);
        if (r.err) throw new Error(r.err);
        return r.v;
      }
      if (/^[A-Z]+[0-9]+:[A-Z]+[0-9]+$/.test(up)) {
        const [a1, a2] = up.split(':');
        const values = expandRange(a1, a2).map(a => {
          const r = compute(a);
          return r.err ? 0 : r.v;
        });
        return { __range: true, values };
      }
      const n = Number(tok);
      if (!isNaN(n)) return n;
      throw new Error('无效引用: ' + tok);
    }
    return { v: parseExpr() };
  }

  _renderCells(state) {
    const computed = this._compute(state);
    const table = state._els.table;
    for (let r = 1; r <= ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const addr = colName(c) + r;
        const td = table.querySelector(`[data-cell-address="${addr}"]`);
        if (!td) continue;
        const comp = computed[addr];
        td.innerHTML = '';
        const inner = el('div', { class: 'cell-inner' });
        if (comp && comp.err) {
          td.classList.add('error-cell');
          inner.textContent = comp.err;
        } else {
          td.classList.remove('error-cell');
          const v = comp ? comp.v : '';
          inner.textContent = v === null || v === undefined ? '' : String(v);
          if (typeof v === 'number') inner.style.justifyContent = 'flex-end';
        }
        td.appendChild(inner);
      }
    }
  }

  _save(state) {
    const doc = state.doc;
    if (!doc.path) {
      doc.path = '/Documents/' + doc.name;
      if (!doc.name.endsWith('.sheet')) doc.path += '.sheet';
    }
    try {
      this.root.vfs.write(doc.path, {
        name: doc.name,
        cells: doc.cells,
        colCount: COLS, rowCount: ROWS
      });
      doc.dirty = false;
      this._updateDirty(state);
      this.root.notify('工作簿已保存', doc.path);
    } catch (e) {
      this.root.toast('保存失败', e.message, 'bad');
    }
  }

  /* publish region update to subscribers (charts) */
  _publish(state) {
    const doc = state.doc;
    const subs = this.root._sheetSubscribers || [];
    for (const sub of subs) {
      try { sub(doc); } catch (e) { }
    }
    if (this.root.onWorkbookChange) this.root.onWorkbookChange(doc);
  }

  /* read a rectangular region: returns { labels, series, matrix, version } */
  static readRegion(doc, range, labelCol, valueCols) {
    const [a1, a2] = range.split(':');
    const cells = expandRange(a1, a2);
    // group by row
    const minR = parseInt(a1.match(/\d+/)[0]);
    const maxR = parseInt(a2.match(/\d+/)[0]);
    const minC = colIndex(a1.match(/[A-Z]+/)[0]);
    const maxC = colIndex(a2.match(/[A-Z]+/)[0]);
    const computed = new SpreadsheetApp({ vfs: null })._compute({ doc });
    const rows = [];
    for (let r = minR; r <= maxR; r++) {
      const row = {};
      for (let c = minC; c <= maxC; c++) {
        const addr = colName(c) + r;
        const comp = computed[addr];
        row[colName(c)] = comp && !comp.err ? comp.v : '';
      }
      rows.push(row);
    }
    return rows;
  }
}

function colName(i) {
  let s = '';
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}
function colIndex(name) {
  let n = 0;
  for (const ch of name) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function expandRange(a1, a2) {
  const r1 = parseInt(a1.match(/\d+/)[0]), r2 = parseInt(a2.match(/\d+/)[0]);
  const c1 = colIndex(a1.match(/[A-Z]+/)[0]), c2 = colIndex(a2.match(/[A-Z]+/)[0]);
  const out = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      out.push(colName(c) + r);
  return out;
}
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

export { colName, colIndex, expandRange };
