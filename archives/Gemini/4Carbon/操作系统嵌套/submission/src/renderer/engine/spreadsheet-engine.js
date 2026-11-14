export function colIndexToLetter(idx) {
  let n = idx;
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export function colLetterToIndex(letters) {
  const clean = String(letters || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(clean)) return -1;
  let idx = 0;
  for (let i = 0; i < clean.length; i++) {
    idx = idx * 26 + (clean.charCodeAt(i) - 64);
  }
  return idx - 1;
}

export function parseCellAddress(addr) {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(String(addr || '').trim());
  if (!m) return null;
  const col = colLetterToIndex(m[1]);
  const row = parseInt(m[2], 10) - 1;
  if (col < 0 || row < 0 || row > 999 || col > 51) return null;
  return { col, row, key: `${colIndexToLetter(col)}${row + 1}` };
}

export function parseRangeAddress(rangeStr) {
  const parts = String(rangeStr || '').trim().split(':');
  if (parts.length === 1) {
    const single = parseCellAddress(parts[0]);
    if (!single) return null;
    return { startCol: single.col, endCol: single.col, startRow: single.row, endRow: single.row };
  }
  if (parts.length !== 2) return null;
  const a = parseCellAddress(parts[0]);
  const b = parseCellAddress(parts[1]);
  if (!a || !b) return null;
  return {
    startCol: Math.min(a.col, b.col),
    endCol: Math.max(a.col, b.col),
    startRow: Math.min(a.row, b.row),
    endRow: Math.max(a.row, b.row)
  };
}

export class WorkbookModel {
  constructor(docId, filePath, rawJson = null) {
    this.docId = docId;
    this.filePath = filePath || '/Documents/untitled.sheet';
    this.title = (filePath || 'untitled.sheet').split('/').pop();
    this.cols = 10;
    this.rows = 26;
    this.colWidths = {};
    this.cells = {}; // "A1" -> { raw, value, display, error, bold, align }
    this.dirty = false;
    this.publishVersion = 1;
    this.undoStack = [];
    this.redoStack = [];
    this.lastRecalcCost = 0;

    if (rawJson) {
      this.loadFromJson(rawJson);
    } else {
      this.recalculateAll();
    }
  }

  loadFromJson(rawJson) {
    const obj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    this.cols = Math.max(8, Number(obj.cols || 10));
    this.rows = Math.max(20, Number(obj.rows || 26));
    this.colWidths = { ...(obj.colWidths || {}) };
    this.cells = {};
    if (obj.cells && typeof obj.cells === 'object') {
      for (const [k, v] of Object.entries(obj.cells)) {
        const parsed = parseCellAddress(k);
        if (parsed) {
          this.cells[parsed.key] = {
            raw: String(v && v.raw !== undefined ? v.raw : ''),
            bold: Boolean(v && v.bold),
            align: (v && v.align) || 'left',
            value: '',
            display: '',
            error: null
          };
          if (parsed.col >= this.cols) this.cols = parsed.col + 2;
          if (parsed.row >= this.rows) this.rows = parsed.row + 4;
        }
      }
    }
    this.dirty = false;
    this.undoStack = [];
    this.redoStack = [];
    this.recalculateAll();
  }

  toJsonString() {
    const outCells = {};
    for (const [k, cell] of Object.entries(this.cells)) {
      if (cell.raw !== '' || cell.bold || (cell.align && cell.align !== 'left')) {
        outCells[k] = {
          raw: cell.raw,
          bold: Boolean(cell.bold),
          align: cell.align || 'left'
        };
      }
    }
    return JSON.stringify(
      {
        format: 'nestedos-sheet-v1',
        title: this.title,
        cols: this.cols,
        rows: this.rows,
        colWidths: this.colWidths,
        cells: outCells
      },
      null,
      2
    );
  }

  snapshotRawCells() {
    const snap = {};
    for (const [k, c] of Object.entries(this.cells)) {
      snap[k] = { raw: c.raw, bold: c.bold, align: c.align };
    }
    return snap;
  }

  restoreRawCells(snap) {
    this.cells = {};
    for (const [k, c] of Object.entries(snap)) {
      this.cells[k] = {
        raw: c.raw,
        bold: Boolean(c.bold),
        align: c.align || 'left',
        value: '',
        display: '',
        error: null
      };
    }
  }

  pushUndo() {
    this.undoStack.push(this.snapshotRawCells());
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  getCell(addrKey) {
    return (
      this.cells[addrKey] || {
        raw: '',
        value: '',
        display: '',
        error: null,
        bold: false,
        align: 'left'
      }
    );
  }

  setCellRaw(addrKey, rawText) {
    const parsed = parseCellAddress(addrKey);
    if (!parsed) return { changed: false, cost: 1 };
    const prev = this.getCell(parsed.key);
    const nextRaw = String(rawText ?? '');
    if (prev.raw === nextRaw) return { changed: false, cost: 1 };

    this.pushUndo();
    this.cells[parsed.key] = {
      ...prev,
      raw: nextRaw
    };
    this.dirty = true;
    const cost = this.recalculateAll();
    this.publishVersion++;
    return { changed: true, cost, version: this.publishVersion };
  }

  setRangeValues(startCol, startRow, matrix2d) {
    this.pushUndo();
    for (let r = 0; r < matrix2d.length; r++) {
      for (let c = 0; c < matrix2d[r].length; c++) {
        const col = startCol + c;
        const row = startRow + r;
        if (col >= this.cols) this.cols = col + 2;
        if (row >= this.rows) this.rows = row + 2;
        const key = `${colIndexToLetter(col)}${row + 1}`;
        const prev = this.getCell(key);
        this.cells[key] = {
          ...prev,
          raw: String(matrix2d[r][c] ?? '')
        };
      }
    }
    this.dirty = true;
    const cost = this.recalculateAll();
    this.publishVersion++;
    return { changed: true, cost, version: this.publishVersion };
  }

  toggleCellBold(addrKeys) {
    this.pushUndo();
    for (const k of addrKeys) {
      const c = this.getCell(k);
      this.cells[k] = { ...c, bold: !c.bold };
    }
    this.dirty = true;
  }

  undo() {
    if (this.undoStack.length === 0) return { changed: false, cost: 0 };
    this.redoStack.push(this.snapshotRawCells());
    const snap = this.undoStack.pop();
    this.restoreRawCells(snap);
    this.dirty = true;
    const cost = this.recalculateAll();
    this.publishVersion++;
    return { changed: true, cost, version: this.publishVersion };
  }

  redo() {
    if (this.redoStack.length === 0) return { changed: false, cost: 0 };
    this.undoStack.push(this.snapshotRawCells());
    const snap = this.redoStack.pop();
    this.restoreRawCells(snap);
    this.dirty = true;
    const cost = this.recalculateAll();
    this.publishVersion++;
    return { changed: true, cost, version: this.publishVersion };
  }

  recalculateAll() {
    let cost = 4;
    const stateMap = {}; // key -> 0 unvisited, 1 visiting, 2 done

    const evalCell = (key) => {
      cost += 2;
      const parsed = parseCellAddress(key);
      if (!parsed || parsed.col >= this.cols || parsed.row >= this.rows) {
        return { error: '#REF!', errorDetail: '超出有效单元格范围: ' + key };
      }
      const cell = this.cells[parsed.key];
      if (!cell || cell.raw === '') {
        return { value: '', display: '', error: null };
      }
      if (stateMap[parsed.key] === 2) {
        return cell;
      }
      if (stateMap[parsed.key] === 1) {
        cell.value = '#CYCLE!';
        cell.display = '#CYCLE!';
        cell.error = '循环依赖错误 (#CYCLE!)';
        return cell;
      }

      stateMap[parsed.key] = 1;
      const raw = String(cell.raw);
      if (!raw.startsWith('=')) {
        const trimmed = raw.trim();
        const asNum = trimmed !== '' ? Number(trimmed) : NaN;
        if (!Number.isNaN(asNum)) {
          cell.value = asNum;
          cell.display = String(Math.round(asNum * 10000) / 10000);
        } else {
          cell.value = raw;
          cell.display = raw;
        }
        cell.error = null;
        stateMap[parsed.key] = 2;
        return cell;
      }

      try {
        const exprRes = this.evaluateFormulaExpr(raw.slice(1), evalCell, (addCost) => {
          cost += addCost;
        });
        if (exprRes.error) {
          cell.value = exprRes.code || '#ERR!';
          cell.display = exprRes.code || '#ERR!';
          cell.error = exprRes.error;
        } else {
          const v = exprRes.value;
          cell.value = v;
          cell.display = typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v ?? '');
          cell.error = null;
        }
      } catch (err) {
        cell.value = '#ERR!';
        cell.display = '#ERR!';
        cell.error = err && err.message ? err.message : '公式语法错误';
      }
      stateMap[parsed.key] = 2;
      return cell;
    };

    for (const k of Object.keys(this.cells)) {
      if (!stateMap[k]) {
        evalCell(k);
      }
    }
    this.lastRecalcCost = cost;
    return cost;
  }

  evaluateFormulaExpr(formulaStr, evalCell, chargeCost) {
    // Tokenizer for spreadsheet formulas
    const tokens = [];
    let i = 0;
    const s = formulaStr.trim();
    if (!s) return { value: 0 };

    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t') {
        i++;
        continue;
      }
      if ('+-*/(),:'.includes(ch)) {
        tokens.push({ t: 'OP', v: ch });
        i++;
        continue;
      }
      if ((ch >= '0' && ch <= '9') || ch === '.') {
        let numStr = '';
        let dots = 0;
        while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
          if (s[i] === '.') dots++;
          numStr += s[i++];
        }
        if (dots > 1 || Number.isNaN(Number(numStr))) {
          return { code: '#ERR!', error: '非法数值字面量: ' + numStr };
        }
        tokens.push({ t: 'NUM', v: Number(numStr) });
        continue;
      }
      if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '$') {
        let id = '';
        while (i < s.length && /[A-Za-z0-9$_]/.test(s[i])) {
          id += s[i++];
        }
        tokens.push({ t: 'ID', v: id.toUpperCase() });
        continue;
      }
      return { code: '#REF!', error: '无效公式符号: ' + ch };
    }

    tokens.push({ t: 'EOF', v: '' });
    let pos = 0;
    let foundErr = null;

    const setErr = (code, msg) => {
      if (!foundErr) foundErr = { code, error: msg };
    };

    const peek = () => tokens[pos] || tokens[tokens.length - 1];
    const next = () => tokens[pos++];

    const readCellNum = (cellKey) => {
      chargeCost(1);
      const parsed = parseCellAddress(cellKey);
      if (!parsed || parsed.col < 0 || parsed.row < 0 || parsed.col >= 52 || parsed.row >= 500) {
        setErr('#REF!', '无效单元格引用: ' + cellKey);
        return 0;
      }
      const c = evalCell(parsed.key);
      if (c.error) {
        setErr(String(c.value || '#ERR!'), c.error);
        return 0;
      }
      if (c.value === '' || c.value === null || c.value === undefined) return 0;
      const n = Number(c.value);
      if (Number.isNaN(n)) {
        setErr('#VALUE!', `单元格 ${parsed.key} 不是有效数值`);
        return 0;
      }
      return n;
    };

    const expandRangeValues = (aStr, bStr) => {
      const r = parseRangeAddress(`${aStr}:${bStr}`);
      if (!r) {
        setErr('#REF!', `无效区域引用: ${aStr}:${bStr}`);
        return [];
      }
      const vals = [];
      for (let row = r.startRow; row <= r.endRow; row++) {
        for (let col = r.startCol; col <= r.endCol; col++) {
          chargeCost(1);
          const key = `${colIndexToLetter(col)}${row + 1}`;
          const c = evalCell(key);
          if (c.error) {
            setErr(String(c.value || '#ERR!'), c.error);
            return [];
          }
          if (c.value !== '' && c.value !== null && c.value !== undefined) {
            const n = Number(c.value);
            if (!Number.isNaN(n)) vals.push(n);
          }
        }
      }
      return vals;
    };

    const parsePrimary = () => {
      const tok = peek();
      if (tok.t === 'NUM') {
        next();
        return tok.v;
      }
      if (tok.t === 'OP' && tok.v === '(') {
        next();
        const v = parseAdd();
        if (peek().t !== 'OP' || peek().v !== ')') {
          setErr('#ERR!', '缺少右括号 )');
        } else {
          next();
        }
        return v;
      }
      if (tok.t === 'ID') {
        next();
        if (peek().t === 'OP' && peek().v === '(') {
          // Function call: SUM, AVG/AVERAGE, MIN, MAX, COUNT
          next();
          const fnName = tok.v;
          const nums = [];
          if (!(peek().t === 'OP' && peek().v === ')')) {
            while (true) {
              if (peek().t === 'ID' && tokens[pos + 1] && tokens[pos + 1].v === ':') {
                const startId = next().v;
                next(); // ':'
                const endTok = next();
                if (endTok.t !== 'ID') {
                  setErr('#REF!', '无效区域终点');
                } else {
                  nums.push(...expandRangeValues(startId, endTok.v));
                }
              } else {
                nums.push(parseAdd());
              }
              if (peek().t === 'OP' && peek().v === ',') {
                next();
              } else {
                break;
              }
            }
          }
          if (peek().t !== 'OP' || peek().v !== ')') {
            setErr('#ERR!', '函数缺少右括号 )');
          } else {
            next();
          }
          chargeCost(2 + nums.length);
          if (fnName === 'SUM') return nums.reduce((a, b) => a + b, 0);
          if (fnName === 'AVG' || fnName === 'AVERAGE') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          if (fnName === 'MIN') return nums.length ? Math.min(...nums) : 0;
          if (fnName === 'MAX') return nums.length ? Math.max(...nums) : 0;
          if (fnName === 'COUNT') return nums.length;
          setErr('#NAME?', '未知公式函数: ' + fnName);
          return 0;
        }

        if (peek().t === 'OP' && peek().v === ':') {
          setErr('#VALUE!', '区域引用需配合聚合函数（如 SUM）使用');
          next();
          if (peek().t === 'ID') next();
          return 0;
        }
        return readCellNum(tok.v);
      }

      setErr('#ERR!', '无法识别的公式表达式: ' + (tok.v || '空'));
      next();
      return 0;
    };

    const parseUnary = () => {
      if (peek().t === 'OP' && peek().v === '-') {
        next();
        return -parseUnary();
      }
      if (peek().t === 'OP' && peek().v === '+') {
        next();
        return parseUnary();
      }
      return parsePrimary();
    };

    const parseMul = () => {
      let left = parseUnary();
      while (peek().t === 'OP' && (peek().v === '*' || peek().v === '/')) {
        const op = next().v;
        const right = parseUnary();
        chargeCost(1);
        if (op === '*') {
          left *= right;
        } else {
          if (right === 0) {
            setErr('#DIV/0!', '除零错误 (#DIV/0!)');
            left = 0;
          } else {
            left /= right;
          }
        }
      }
      return left;
    };

    const parseAdd = () => {
      let left = parseMul();
      while (peek().t === 'OP' && (peek().v === '+' || peek().v === '-')) {
        const op = next().v;
        const right = parseMul();
        chargeCost(1);
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const val = parseAdd();
    if (peek().t !== 'EOF' && !foundErr) {
      setErr('#ERR!', '多余的公式内容: ' + peek().v);
    }
    if (foundErr) return foundErr;
    return { value: val };
  }

  extractRangeSnapshot(rangeStr) {
    const r = parseRangeAddress(rangeStr);
    if (!r) return null;
    const matrix = [];
    for (let row = r.startRow; row <= r.endRow; row++) {
      const rowVals = [];
      for (let col = r.startCol; col <= r.endCol; col++) {
        const key = `${colIndexToLetter(col)}${row + 1}`;
        const c = this.getCell(key);
        rowVals.push(c.error ? c.display : c.value);
      }
      matrix.push(rowVals);
    }
    return {
      docId: this.docId,
      title: this.title,
      filePath: this.filePath,
      range: rangeStr.toUpperCase(),
      startCol: r.startCol,
      startRow: r.startRow,
      endCol: r.endCol,
      endRow: r.endRow,
      version: this.publishVersion,
      matrix
    };
  }
}
