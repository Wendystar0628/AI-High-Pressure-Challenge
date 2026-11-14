// Root System Single-Sheet Spreadsheet (A1:Z50)
// Supports formulas (+, -, *, /, parentheses, cell & range refs, SUM/AVG/MIN/MAX/COUNT),
// topological DAG recalculation, cycle detection (#CYCLE!/#REF!/#DIV/0!/#VALUE!),
// copy/paste (pushing to Clipboard History), undo/redo, unsaved prompt, and live Workbook publishing!

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colToIdx(col) {
  return col.toUpperCase().charCodeAt(0) - 65;
}

function idxToCol(i) {
  return String.fromCharCode(65 + i);
}

function parseAddr(addr) {
  const m = /^([A-Za-z])([1-9][0-9]*)$/.exec(String(addr || '').trim());
  if (!m) return null;
  const col = colToIdx(m[1]);
  const row = parseInt(m[2], 10);
  if (col < 0 || col > 25 || row < 1 || row > 50) return null;
  return { col, row, addr: idxToCol(col) + row };
}

function parseRange(rangeStr) {
  const parts = String(rangeStr || 'A1:D4').trim().split(':');
  const a = parseAddr(parts[0]);
  const b = parts[1] ? parseAddr(parts[1]) : a;
  if (!a || !b) return null;
  return {
    c1: Math.min(a.col, b.col),
    r1: Math.min(a.row, b.row),
    c2: Math.max(a.col, b.col),
    r2: Math.max(a.row, b.row)
  };
}

class FormulaEngine {
  constructor() {
    this.raw = {}; // addr -> string
    this.values = {}; // addr -> number | string
    this.errors = {}; // addr -> '#DIV/0!' | ...
    this.deps = {}; // addr -> Set<addr>
  }

  loadCells(cellObj) {
    this.raw = {};
    for (const [k, v] of Object.entries(cellObj || {})) {
      const p = parseAddr(k);
      if (!p) continue;
      const rawVal = (v && typeof v === 'object') ? (v.raw ?? v.value ?? '') : v;
      this.raw[p.addr] = String(rawVal ?? '');
    }
    this.recalculate();
  }

  getRaw(addr) {
    return this.raw[addr] ?? '';
  }

  getDisplay(addr) {
    if (this.errors[addr]) return this.errors[addr];
    const v = this.values[addr];
    return v === undefined || v === null ? '' : v;
  }

  setCell(addr, rawVal) {
    const s = String(rawVal ?? '');
    if (s === '') delete this.raw[addr];
    else this.raw[addr] = s;
    this.recalculate();
  }

  recalculate() {
    this.values = {};
    this.errors = {};
    this.deps = {};

    const state = {}; // 0=unvisited, 1=visiting, 2=done

    const evalCell = (addr) => {
      if (state[addr] === 2) {
        if (this.errors[addr]) throw new Error(this.errors[addr]);
        return this.values[addr] ?? '';
      }
      if (state[addr] === 1) {
        this.errors[addr] = '#CYCLE!';
        throw new Error('#CYCLE!');
      }
      state[addr] = 1;
      const raw = this.raw[addr];
      if (raw === undefined || raw === '') {
        this.values[addr] = '';
        state[addr] = 2;
        return '';
      }
      if (!raw.startsWith('=')) {
        const trimmed = raw.trim();
        const num = Number(trimmed);
        this.values[addr] = trimmed !== '' && !Number.isNaN(num) ? num : raw;
        state[addr] = 2;
        return this.values[addr];
      }

      try {
        const val = this.evalFormula(raw.slice(1), addr, evalCell);
        this.values[addr] = val;
        state[addr] = 2;
        return val;
      } catch (err) {
        const code = err.message.startsWith('#') ? err.message : '#VALUE!';
        this.errors[addr] = code;
        this.values[addr] = code;
        state[addr] = 2;
        throw new Error(code);
      }
    };

    for (const addr of Object.keys(this.raw)) {
      if (state[addr] !== 2) {
        try {
          evalCell(addr);
        } catch {
          // Error already stored in this.errors[addr]
        }
      }
    }
  }

  evalFormula(expr, ownerAddr, evalCell) {
    const tokens = [];
    let i = 0;
    const s = String(expr || '');
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      if ('+-*/():,'.includes(ch)) {
        tokens.push({ t: ch, v: ch });
        i++;
        continue;
      }
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        let j = i;
        while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
        tokens.push({ t: 'NUM', v: parseFloat(s.slice(i, j)) });
        i = j;
        continue;
      }
      if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
        let j = i;
        while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++;
        tokens.push({ t: 'ID', v: s.slice(i, j).toUpperCase() });
        i = j;
        continue;
      }
      throw new Error('#NAME!');
    }

    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    const toNum = (v) => {
      if (v === '' || v === undefined || v === null) return 0;
      if (typeof v === 'number') {
        if (Number.isNaN(v)) throw new Error('#VALUE!');
        return v;
      }
      const n = Number(v);
      if (Number.isNaN(n)) throw new Error('#VALUE!');
      return n;
    };

    const evalArgList = () => {
      const vals = [];
      if (peek() && peek().t === ')') return vals;
      while (pos < tokens.length) {
        if (peek()?.t === 'ID' && tokens[pos + 1]?.t === ':' && tokens[pos + 2]?.t === 'ID') {
          const a = next().v;
          next(); // ':'
          const b = next().v;
          const rng = parseRange(`${a}:${b}`);
          if (!rng) throw new Error('#REF!');
          for (let r = rng.r1; r <= rng.r2; r++) {
            for (let c = rng.c1; c <= rng.c2; c++) {
              const ca = idxToCol(c) + r;
              if (ca === ownerAddr) throw new Error('#CYCLE!');
              const v = evalCell(ca);
              if (v !== '' && typeof v === 'number') vals.push(v);
              else if (typeof v === 'string' && v !== '') {
                const n = Number(v);
                if (!Number.isNaN(n)) vals.push(n);
              }
            }
          }
        } else {
          vals.push(parseExpr());
        }
        if (peek()?.t === ',') next();
        else break;
      }
      return vals;
    };

    const parsePrimary = () => {
      const tk = peek();
      if (!tk) throw new Error('#VALUE!');
      if (tk.t === 'NUM') {
        next();
        if (Number.isNaN(tk.v)) throw new Error('#VALUE!');
        return tk.v;
      }
      if (tk.t === '(') {
        next();
        const v = parseExpr();
        if (peek()?.t !== ')') throw new Error('#VALUE!');
        next();
        return v;
      }
      if (tk.t === 'ID') {
        next();
        if (peek()?.t === '(') {
          next();
          const args = evalArgList();
          if (peek()?.t !== ')') throw new Error('#VALUE!');
          next();
          const fn = tk.v;
          if (fn === 'SUM') return args.reduce((acc, x) => acc + toNum(x), 0);
          if (fn === 'AVG' || fn === 'AVERAGE') return args.length ? args.reduce((a, x) => a + toNum(x), 0) / args.length : 0;
          if (fn === 'MIN') return args.length ? Math.min(...args.map(toNum)) : 0;
          if (fn === 'MAX') return args.length ? Math.max(...args.map(toNum)) : 0;
          if (fn === 'COUNT') return args.length;
          throw new Error('#NAME!');
        }
        const addr = parseAddr(tk.v);
        if (!addr) {
          if (/^[A-Z]+[0-9]+$/.test(tk.v)) throw new Error('#REF!');
          throw new Error('#NAME!');
        }
        if (addr.addr === ownerAddr) throw new Error('#CYCLE!');
        return toNum(evalCell(addr.addr));
      }
      throw new Error('#VALUE!');
    };

    const parseUnary = () => {
      if (peek()?.t === '+') { next(); return toNum(parseUnary()); }
      if (peek()?.t === '-') { next(); return -toNum(parseUnary()); }
      return parsePrimary();
    };

    const parseMul = () => {
      let left = toNum(parseUnary());
      while (peek() && (peek().t === '*' || peek().t === '/')) {
        const op = next().t;
        const right = toNum(parseUnary());
        if (op === '*') left *= right;
        else {
          if (right === 0) throw new Error('#DIV/0!');
          left /= right;
        }
      }
      return left;
    };

    const parseExpr = () => {
      let left = toNum(parseMul());
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = next().t;
        const right = toNum(parseMul());
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const res = parseExpr();
    if (pos < tokens.length) throw new Error('#VALUE!');
    return Math.round(res * 1000000) / 1000000;
  }
}

export function mountRootSpreadsheet({ container, win, hostKernel }) {
  const ROWS = 50;
  const COLS = 26;
  const engine = new FormulaEngine();

  const docId = `wb-${win.id}`;
  let filePath = win.params?.filePath || '/Demo/sample.sheet';
  let dirty = false;
  let activeAddr = 'A1';
  let rangeStart = { col: 0, row: 1 };
  let rangeEnd = { col: 0, row: 1 };
  let editingAddr = null;
  let undoStack = [];
  let redoStack = [];
  let statusMsg = '就绪';
  let selecting = false;

  let boldCells = {}; // addr -> boolean

  const snapshotCells = () => ({ raw: { ...engine.raw }, bold: { ...boldCells } });
  const restoreSnapshot = (snap) => {
    if (snap && snap.raw) {
      engine.loadCells(snap.raw);
      boldCells = { ...(snap.bold || {}) };
    } else {
      engine.loadCells(snap || {});
      boldCells = {};
    }
  };

  const loadFromPath = (path) => {
    const rd = hostKernel.rootRead(path);
    filePath = path;
    boldCells = {};
    if (rd.ok) {
      try {
        const parsed = JSON.parse(rd.content);
        const cells = parsed.cells || {};
        for (const [k, v] of Object.entries(cells)) {
          if (v && typeof v === 'object' && v.bold) boldCells[k.toUpperCase()] = true;
        }
        engine.loadCells(cells);
        dirty = false;
        statusMsg = `已打开 ${path}`;
      } catch {
        engine.loadCells({});
        statusMsg = '工作簿 JSON 格式无效，已建空白表';
      }
    } else {
      engine.loadCells({});
      statusMsg = '新建工作簿';
    }
  };

  loadFromPath(filePath);

  const wbEntry = {
    docId,
    title: filePath.split('/').pop() || 'sample.sheet',
    path: filePath,
    version: 1,
    closed: false,
    getRangeData: (rangeStr) => {
      const r = parseRange(rangeStr || 'A1:D4') || { c1: 0, r1: 1, c2: 3, r2: 4 };
      const cols = [];
      for (let c = r.c1; c <= r.c2; c++) cols.push(idxToCol(c));
      const rows = [];
      for (let row = r.r1; row <= r.r2; row++) {
        const rowVals = [];
        for (let c = r.c1; c <= r.c2; c++) {
          const val = engine.getDisplay(idxToCol(c) + row);
          rowVals.push(val === undefined ? '' : val);
        }
        rows.push(rowVals);
      }
      return { cols, startRow: r.r1, rows };
    }
  };
  hostKernel.registerWorkbook(wbEntry);

  container.innerHTML = `
    <div class="sheet-root">
      <div class="sheet-toolbar">
        <button class="os-btn act-new">新建</button>
        <input class="os-inp ns-inp-sm" data-testid="sheet-filename" data-system-id="outer" data-window-id="${esc(win.id)}" value="${esc(filePath)}" />
        <button class="os-btn act-open">打开</button>
        <button class="os-btn os-btn-accent" data-testid="sheet-save" data-system-id="outer" data-window-id="${esc(win.id)}">保存</button>
        <button class="os-btn act-copy">复制</button>
        <button class="os-btn act-paste">粘贴</button>
        <button class="os-btn act-bold" title="切换加粗">B</button>
        <button class="os-btn act-undo">撤销</button>
        <button class="os-btn act-redo">重做</button>
      </div>
      <div class="sheet-prompt-slot"></div>
      <div class="sheet-formula-row">
        <span class="sheet-addr-badge">A1</span>
        <input class="os-inp flex-1" data-testid="sheet-formula" data-system-id="outer" data-window-id="${esc(win.id)}" />
      </div>
      <div class="sheet-grid-wrap" data-testid="sheet-grid" data-system-id="outer" data-window-id="${esc(win.id)}">
        <table class="sheet-table"><thead></thead><tbody></tbody></table>
      </div>
      <div class="sheet-status-bar">
        <span class="sheet-status-msg"></span>
        <span class="sheet-range-msg"></span>
      </div>
    </div>
  `;

  const fileInp = container.querySelector('[data-testid="sheet-filename"]');
  const formulaInp = container.querySelector('[data-testid="sheet-formula"]');
  const addrBadge = container.querySelector('.sheet-addr-badge');
  const thead = container.querySelector('.sheet-table thead');
  const tbody = container.querySelector('.sheet-table tbody');
  const statusEl = container.querySelector('.sheet-status-msg');
  const rangeEl = container.querySelector('.sheet-range-msg');

  // Build static header & 50x26 grid once
  let hdrHtml = '<tr><th class="sheet-row-hdr"></th>';
  for (let c = 0; c < COLS; c++) hdrHtml += `<th>${idxToCol(c)}</th>`;
  hdrHtml += '</tr>';
  thead.innerHTML = hdrHtml;

  const cellEls = new Map();
  const frag = document.createDocumentFragment();
  for (let r = 1; r <= ROWS; r++) {
    const tr = document.createElement('tr');
    const rh = document.createElement('td');
    rh.className = 'sheet-row-hdr';
    rh.textContent = String(r);
    tr.appendChild(rh);
    for (let c = 0; c < COLS; c++) {
      const addr = idxToCol(c) + r;
      const td = document.createElement('td');
      td.className = 'sheet-cell';
      td.setAttribute('data-testid', 'sheet-cell');
      td.setAttribute('data-system-id', 'outer');
      td.setAttribute('data-window-id', win.id);
      td.setAttribute('data-cell-address', addr);
      td.dataset.col = String(c);
      td.dataset.row = String(r);
      tr.appendChild(td);
      cellEls.set(addr, td);
    }
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);

  const commitValue = (addr, val) => {
    const prev = snapshotCells();
    if (String(val ?? '') === engine.getRaw(addr)) return;
    undoStack.push(prev);
    if (undoStack.length > 60) undoStack.shift();
    redoStack = [];
    engine.setCell(addr, val);
    dirty = true;
    wbEntry.title = filePath.split('/').pop() || 'sample.sheet';
    wbEntry.path = filePath;
    hostKernel.publishWorkbookUpdate(docId);
    statusMsg = `已更新 ${addr}`;
    renderGridState();
  };

  const renderGridState = () => {
    const c1 = Math.min(rangeStart.col, rangeEnd.col);
    const c2 = Math.max(rangeStart.col, rangeEnd.col);
    const r1 = Math.min(rangeStart.row, rangeEnd.row);
    const r2 = Math.max(rangeStart.row, rangeEnd.row);

    for (let r = 1; r <= ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const addr = idxToCol(c) + r;
        const td = cellEls.get(addr);
        const isActive = addr === activeAddr;
        const inRange = c >= c1 && c <= c2 && r >= r1 && r <= r2;
        td.classList.toggle('active', isActive);
        td.classList.toggle('in-range', inRange && !isActive);

        if (editingAddr === addr) continue;
        const disp = engine.getDisplay(addr);
        const isErr = Boolean(engine.errors[addr]);
        td.classList.toggle('is-err', isErr);
        td.classList.toggle('is-bold', Boolean(boldCells[addr]));
        td.textContent = disp === undefined ? '' : String(disp);
      }
    }

    addrBadge.textContent = activeAddr;
    if (document.activeElement !== formulaInp) {
      formulaInp.value = engine.getRaw(activeAddr);
    }
    if (document.activeElement !== fileInp) {
      fileInp.value = filePath;
    }
    statusEl.textContent = (dirty ? '● 未保存 · ' : '') + statusMsg;
    rangeEl.textContent = `选区 ${idxToCol(c1)}${r1}:${idxToCol(c2)}${r2}`;
  };

  const startInlineEdit = (addr, initialChar = null) => {
    if (editingAddr && editingAddr !== addr) finishInlineEdit(true);
    editingAddr = addr;
    const td = cellEls.get(addr);
    if (!td) return;
    const inp = document.createElement('input');
    inp.className = 'sheet-cell-edit-inp';
    inp.value = initialChar !== null ? initialChar : engine.getRaw(addr);
    td.textContent = '';
    td.appendChild(inp);
    inp.focus();
    if (initialChar === null) inp.select();

    inp.addEventListener('input', () => {
      formulaInp.value = inp.value;
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishInlineEdit(true);
        const p = parseAddr(addr);
        if (p && p.row < ROWS) {
          activeAddr = idxToCol(p.col) + (p.row + 1);
          rangeStart = { col: p.col, row: p.row + 1 };
          rangeEnd = { ...rangeStart };
          renderGridState();
        }
      } else if (e.key === 'Escape') {
        finishInlineEdit(false);
      }
    });
    inp.addEventListener('blur', () => finishInlineEdit(true));
  };

  const finishInlineEdit = (save) => {
    if (!editingAddr) return;
    const addr = editingAddr;
    const td = cellEls.get(addr);
    const inp = td?.querySelector('.sheet-cell-edit-inp');
    const nextVal = inp ? inp.value : engine.getRaw(addr);
    editingAddr = null;
    if (save) commitValue(addr, nextVal);
    else renderGridState();
  };

  tbody.addEventListener('mousedown', (e) => {
    const td = e.target.closest('.sheet-cell');
    if (!td || editingAddr) return;
    const col = Number(td.dataset.col);
    const row = Number(td.dataset.row);
    const addr = td.dataset.cellAddress;
    if (e.shiftKey) {
      rangeEnd = { col, row };
    } else {
      activeAddr = addr;
      rangeStart = { col, row };
      rangeEnd = { col, row };
      selecting = true;
    }
    renderGridState();
  });

  tbody.addEventListener('mousemove', (e) => {
    if (!selecting) return;
    const td = e.target.closest('.sheet-cell');
    if (td) {
      rangeEnd = { col: Number(td.dataset.col), row: Number(td.dataset.row) };
      renderGridState();
    }
  });

  window.addEventListener('mouseup', () => { selecting = false; });

  tbody.addEventListener('dblclick', (e) => {
    const td = e.target.closest('.sheet-cell');
    if (td) startInlineEdit(td.dataset.cellAddress);
  });

  formulaInp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(activeAddr, formulaInp.value);
      formulaInp.blur();
    }
  });
  formulaInp.addEventListener('change', () => {
    commitValue(activeAddr, formulaInp.value);
  });

  const doCopy = () => {
    const c1 = Math.min(rangeStart.col, rangeEnd.col);
    const c2 = Math.max(rangeStart.col, rangeEnd.col);
    const r1 = Math.min(rangeStart.row, rangeEnd.row);
    const r2 = Math.max(rangeStart.row, rangeEnd.row);
    const lines = [];
    for (let r = r1; r <= r2; r++) {
      const cols = [];
      for (let c = c1; c <= c2; c++) cols.push(String(engine.getRaw(idxToCol(c) + r)));
      lines.push(cols.join('\t'));
    }
    const text = lines.join('\n');
    hostKernel.pushClipboard(text, '电子表格');
    statusMsg = `已复制选区 ${idxToCol(c1)}${r1}:${idxToCol(c2)}${r2}`;
    renderGridState();
    return text;
  };

  const doPaste = () => {
    const clip = hostKernel.clipboardHistory[0]?.text;
    if (!clip) return;
    const anchor = parseAddr(activeAddr);
    if (!anchor) return;
    undoStack.push(snapshotCells());
    redoStack = [];
    const lines = clip.split(/\r?\n/);
    for (let dr = 0; dr < lines.length; dr++) {
      const cells = lines[dr].split('\t');
      for (let dc = 0; dc < cells.length; dc++) {
        const c = anchor.col + dc;
        const r = anchor.row + dr;
        if (c < COLS && r <= ROWS) {
          const a = idxToCol(c) + r;
          if (cells[dc] === '') delete engine.raw[a];
          else engine.raw[a] = cells[dc];
        }
      }
    }
    engine.recalculate();
    dirty = true;
    hostKernel.publishWorkbookUpdate(docId);
    statusMsg = `已粘贴到 ${activeAddr}`;
    renderGridState();
  };

  container.querySelector('.act-copy').onclick = doCopy;
  container.querySelector('.act-paste').onclick = doPaste;
  container.querySelector('.act-bold').onclick = () => {
    undoStack.push(snapshotCells());
    redoStack = [];
    const c1 = Math.min(rangeStart.col, rangeEnd.col);
    const c2 = Math.max(rangeStart.col, rangeEnd.col);
    const r1 = Math.min(rangeStart.row, rangeEnd.row);
    const r2 = Math.max(rangeStart.row, rangeEnd.row);
    const turnOn = !boldCells[activeAddr];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const a = idxToCol(c) + r;
        if (turnOn) boldCells[a] = true;
        else delete boldCells[a];
      }
    }
    dirty = true;
    statusMsg = turnOn ? '已设加粗' : '已取消加粗';
    renderGridState();
  };
  container.querySelector('.act-undo').onclick = () => {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotCells());
    restoreSnapshot(undoStack.pop());
    dirty = true;
    hostKernel.publishWorkbookUpdate(docId);
    renderGridState();
  };
  container.querySelector('.act-redo').onclick = () => {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotCells());
    restoreSnapshot(redoStack.pop());
    dirty = true;
    hostKernel.publishWorkbookUpdate(docId);
    renderGridState();
  };

  const saveNow = () => {
    filePath = fileInp.value.trim() || filePath;
    const serializedCells = {};
    const allKeys = new Set([...Object.keys(engine.raw), ...Object.keys(boldCells)]);
    for (const k of allKeys) {
      const r = engine.raw[k] ?? '';
      const b = Boolean(boldCells[k]);
      if (r !== '' || b) {
        serializedCells[k] = b ? { raw: r, bold: true } : { raw: r };
      }
    }
    const payload = JSON.stringify({ magic: 'NSSHEET', version: 1, name: filePath.split('/').pop(), cells: serializedCells }, null, 2);
    const wr = hostKernel.rootWrite(filePath, payload);
    if (wr.ok) {
      dirty = false;
      wbEntry.title = filePath.split('/').pop();
      wbEntry.path = filePath;
      hostKernel.publishWorkbookUpdate(docId);
      statusMsg = `已保存至 ${filePath}`;
      renderGridState();
      return true;
    }
    statusMsg = wr.error;
    renderGridState();
    return false;
  };

  const promptSlot = container.querySelector('.sheet-prompt-slot');
  const guardDirtyAction = (action) => {
    if (!dirty) {
      action();
      return;
    }
    promptSlot.innerHTML = `
      <div class="ns-inline-prompt">
        <span>当前工作簿有未保存修改：</span>
        <button class="os-btn os-btn-accent act-sp-save">保存并继续</button>
        <button class="os-btn os-btn-danger act-sp-discard">放弃修改</button>
        <button class="os-btn act-sp-cancel">取消</button>
      </div>
    `;
    const clearPrompt = () => { promptSlot.innerHTML = ''; };
    promptSlot.querySelector('.act-sp-save').onclick = () => { if (saveNow()) { clearPrompt(); action(); } };
    promptSlot.querySelector('.act-sp-discard').onclick = () => { clearPrompt(); action(); };
    promptSlot.querySelector('.act-sp-cancel').onclick = clearPrompt;
  };

  container.querySelector('.act-new').onclick = () => guardDirtyAction(() => {
    filePath = '/Documents/untitled.sheet';
    engine.loadCells({});
    boldCells = {};
    dirty = false;
    wbEntry.title = 'untitled.sheet';
    wbEntry.path = filePath;
    hostKernel.publishWorkbookUpdate(docId);
    renderGridState();
  });

  container.querySelector('.act-open').onclick = () => guardDirtyAction(() => {
    loadFromPath(fileInp.value.trim() || '/Demo/sample.sheet');
    wbEntry.title = filePath.split('/').pop();
    wbEntry.path = filePath;
    hostKernel.publishWorkbookUpdate(docId);
    renderGridState();
  });

  container.querySelector('[data-testid="sheet-save"]').onclick = saveNow;
  container.querySelector('[data-testid="sheet-grid"]')?.setAttribute('tabindex', '0');
  container.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveNow(); return; }
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (k === 'c') { e.preventDefault(); doCopy(); }
    else if (k === 'v') { e.preventDefault(); doPaste(); }
    else if (k === 'b') { e.preventDefault(); container.querySelector('.act-bold')?.click(); }
    else if (k === 'z') { e.preventDefault(); container.querySelector('.act-undo')?.click(); }
    else if (k === 'y') { e.preventDefault(); container.querySelector('.act-redo')?.click(); }
  });

  renderGridState();

  return {
    save: saveNow,
    isDirty: () => dirty,
    confirmMessage: '工作簿有未保存的更改，确定放弃更改并关闭吗？',
    destroy: () => {
      hostKernel.closeWorkbook(docId);
    }
  };
}
