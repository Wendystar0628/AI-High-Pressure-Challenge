// 电子表格: 公式 / 依赖重算 / 撤销重做 / 保存 / 实时发布
import { el, escapeHtml } from '../core/util.js';
import { showContextMenu, confirmDialog } from '../desktop/window-manager.js';

const COLS = 26, ROWS = 60;

export function colName(i) {
  let s = '';
  i += 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}
export function parseAddr(a) {
  const m = /^([A-Z]+)(\d+)$/i.exec(String(a).trim());
  if (!m) return null;
  let c = 0;
  for (const ch of m[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { col: c - 1, row: parseInt(m[2], 10) - 1 };
}
export function addrOf(col, row) { return colName(col) + (row + 1); }

// ---- 公式求值 ----
export function evaluateFormula(src, getCell, addr, depth = 0, stack = []) {
  if (depth > 32) return { error: '循环依赖' };
  const text = src.replace(/^=/, '').trim();
  try {
    const val = evalExpr(text, getCell, depth, stack.concat([addr]));
    return { value: val };
  } catch (e) {
    return { error: e.message || '无效公式' };
  }
}

function tokenize(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      t.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j;
    } else if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_.]/.test(s[j])) j++;
      const word = s.slice(i, j);
      if (word.toUpperCase() === 'SUM') t.push({ t: 'fn', v: 'SUM' });
      else t.push({ t: 'ref', v: word.toUpperCase() });
      i = j;
    } else if ('+-*/(),:'.includes(c)) {
      t.push({ t: c });
      i++;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < s.length && s[j] !== c) j++;
      t.push({ t: 'str', v: s.slice(i + 1, j) });
      i = j + 1;
    } else throw new Error('无效字符: ' + c);
  }
  return t;
}

function evalExpr(text, getCell, depth, stack) {
  const toks = tokenize(text);
  let pos = 0;
  const peek = () => toks[pos];
  const eat = (type) => {
    const tk = toks[pos];
    if (type && (!tk || tk.t !== type)) throw new Error('语法错误');
    pos++;
    return tk;
  };

  function parsePrimary() {
    const tk = peek();
    if (!tk) throw new Error('公式不完整');
    if (tk.t === 'num') { pos++; return tk.v; }
    if (tk.t === 'str') { pos++; return tk.v; }
    if (tk.t === '(') {
      eat('(');
      const v = parseAdd();
      eat(')');
      return v;
    }
    if (tk.t === 'fn') {
      const fn = eat('fn').v;
      eat('(');
      const args = [];
      if (peek() && peek().t !== ')') {
        args.push(parseRangeArg(getCell, depth, stack));
        while (peek() && peek().t === ',') {
          eat(',');
          args.push(parseRangeArg(getCell, depth, stack));
        }
      }
      eat(')');
      if (fn === 'SUM') {
        let s = 0;
        for (const a of args) {
          if (Array.isArray(a)) for (const x of a) {
            if (typeof x === 'number') s += x;
            else if (x !== null && x !== '' && !isNaN(Number(x))) s += Number(x);
          }
          else if (typeof a === 'number') s += a;
          else if (a !== null && a !== '' && !isNaN(Number(a))) s += Number(a);
        }
        return s;
      }
      throw new Error('未知函数: ' + fn);
    }
    if (tk.t === 'ref') {
      return parseRangeArg(getCell, depth, stack);
    }
    if (tk.t === '-') { pos++; return -parsePrimary(); }
    if (tk.t === '+') { pos++; return parsePrimary(); }
    throw new Error('语法错误');
  }

  function parseRangeArg(getCell, depth, stack) {
    const tk = peek();
    if (tk.t === 'ref') {
      const a = eat('ref').v;
      if (peek() && peek().t === ':') {
        eat(':');
        const b = eat('ref').v;
        return expandRange(a, b, getCell, depth, stack);
      }
      return resolveRef(a, getCell, depth, stack);
    }
    return parsePrimary();
  }

  function parseMul() {
    let v = parsePrimary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = toks[pos++].t;
      const r = parsePrimary();
      if (op === '*') v = v * r;
      else {
        if (r === 0) throw new Error('除零错误');
        v = v / r;
      }
    }
    return v;
  }
  function parseAdd() {
    let v = parseMul();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = toks[pos++].t;
      const r = parseMul();
      if (op === '+') {
        if (typeof v === 'string' || typeof r === 'string') v = String(v) + String(r);
        else v = v + r;
      } else v = v - r;
    }
    return v;
  }

  const v = parseAdd();
  if (pos < toks.length) throw new Error('公式有多余内容');
  return v;
}

function resolveRef(ref, getCell, depth, stack) {
  const a = parseAddr(ref);
  if (!a) throw new Error('无效引用: ' + ref);
  const key = addrOf(a.col, a.row);
  if (stack.includes(key)) throw new Error('循环依赖');
  const r = getCell(a.col, a.row, depth, stack);
  if (r && r.error) throw new Error(r.error);
  const v = r ? r.value : null;
  return v;
}

function expandRange(a, b, getCell, depth, stack) {
  const p1 = parseAddr(a), p2 = parseAddr(b);
  if (!p1 || !p2) throw new Error('无效区域引用');
  const c0 = Math.min(p1.col, p2.col), c1 = Math.max(p1.col, p2.col);
  const r0 = Math.min(p1.row, p2.row), r1 = Math.max(p1.row, p2.row);
  const out = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const key = addrOf(c, r);
      if (stack.includes(key)) throw new Error('循环依赖');
      const res = getCell(c, r, depth, stack);
      if (res && res.error) throw new Error(res.error);
      out.push(res ? res.value : null);
    }
  }
  return out;
}

// ---- 工作簿模型 ----
export class Workbook {
  constructor(name = '工作簿') {
    this.name = name;
    this.cells = {};      // "A1" -> {v: 显示值|字符串|公式, raw}
    this.formats = {};    // "A1" -> {bold, align}
    this.dirty = false;
    this.listeners = new Set();
  }
  getRaw(addr) { return this.cells[addr] ?? ''; }
  setRaw(addr, raw) {
    if (raw === '' || raw == null) delete this.cells[addr];
    else this.cells[addr] = raw;
    this.dirty = true;
    this._emit();
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(); }

  evaluateAll() {
    const cache = {};
    const getCell = (col, row, depth = 0, stack = []) => {
      const key = addrOf(col, row);
      if (cache[key] !== undefined) return cache[key];
      const raw = this.cells[key];
      if (raw === undefined || raw === '') {
        cache[key] = { value: null };
        return cache[key];
      }
      if (typeof raw === 'number') {
        cache[key] = { value: raw };
        return cache[key];
      }
      const s = String(raw);
      if (s.startsWith('=')) {
        const r = evaluateFormula(s, getCell, key, depth + 1, stack);
        cache[key] = r;
        return r;
      }
      if (s !== '' && !isNaN(Number(s)) && /^-?[0-9.]+$/.test(s)) {
        cache[key] = { value: Number(s) };
        return cache[key];
      }
      cache[key] = { value: s };
      return cache[key];
    };
    const out = {};
    for (const key of Object.keys(this.cells)) {
      const a = parseAddr(key);
      if (a) out[key] = getCell(a.col, a.row);
    }
    return out;
  }

  serialize() {
    return {
      format: 'nested-sheet/1',
      name: this.name,
      cells: this.cells,
      formats: this.formats,
    };
  }
  static load(obj) {
    const wb = new Workbook(obj.name || '工作簿');
    wb.cells = { ...(obj.cells || {}) };
    wb.formats = { ...(obj.formats || {}) };
    return wb;
  }
  // TSV 选区
  rangeToTSV(a1, a2) {
    const p1 = parseAddr(a1), p2 = parseAddr(a2);
    const vals = this.evaluateAll();
    const c0 = Math.min(p1.col, p2.col), c1 = Math.max(p1.col, p2.col);
    const r0 = Math.min(p1.row, p2.row), r1 = Math.max(p1.row, p2.row);
    const lines = [];
    for (let r = r0; r <= r1; r++) {
      const cells = [];
      for (let c = c0; c <= c1; c++) {
        const k = addrOf(c, r);
        const v = vals[k] && vals[k].value;
        cells.push(v == null ? '' : String(v));
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
}

// ---- 发布选区版本(供图表实时连接) ----
function publishRange(ctx, wb, range) {
  if (!range) return;
  const { a1, a2 } = range;
  const p1 = parseAddr(a1), p2 = parseAddr(a2);
  if (!p1 || !p2) return;
  const vals = wb.evaluateAll();
  const c0 = Math.min(p1.col, p2.col), c1 = Math.max(p1.col, p2.col);
  const r0 = Math.min(p1.row, p2.row), r1 = Math.max(p1.row, p2.row);
  const rows = [];
  for (let r = r0; r <= r1; r++) {
    const row = [];
    for (let c = c0; c <= c1; c++) {
      const k = addrOf(c, r);
      const e = vals[k];
      row.push(e ? e.value : null);
    }
    rows.push(row);
  }
  ctx.bus.emit('sheet-published', {
    workbookId: wb.name,
    workbookTitle: wb.name,
    range: { a1, a2 },
    rows,
    version: Date.now(),
    cols: [c0, c1],
    rowsRange: [r0, r1],
  });
}

// ---- 打开应用 ----
export function launchSpreadsheet(ctx, arg = {}) {
  const { wm, fs, shell, bus } = ctx;
  if (arg.path) {
    const exist = wm.list().find(w => w.appId === 'spreadsheet' && w.meta.path === arg.path);
    if (exist) { wm.focus(exist.id); return exist; }
  }

  let wb;
  let path = arg.path || null;
  if (path) {
    const txt = fs.readFile(path);
    if (txt) {
      try { wb = Workbook.load(JSON.parse(txt)); }
      catch (e) { wb = new Workbook(path.split('/').pop()); }
    } else wb = new Workbook(path.split('/').pop());
  } else {
    wb = new Workbook('未命名工作簿');
    path = null;
  }

  // 历史
  const undoStack = [], redoStack = [];
  const snapshot = () => JSON.stringify(wb.cells);
  const pushUndo = () => {
    undoStack.push(snapshot());
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  };

  let sel = { a1: 'A1', a2: 'A1' };
  let editing = false;
  let chartLinkRange = null; // {a1,a2}

  const win = wm.create({
    appId: 'spreadsheet',
    title: (path ? path.split('/').pop() : '未命名工作簿') + ' — 电子表格',
    icon: '📊',
    x: 120, y: 60, w: 900, h: 580,
    minWidth: 520, minHeight: 340,
    meta: { path },
    onClose: async () => {
      if (wb.dirty) {
        const r = await confirmSave();
        if (r === 'cancel') return false;
        if (r === 'save') doSave();
      }
      return true;
    },
    bodyBuilder(body) {
      body.innerHTML = `
        <div class="sheet-app">
          <div class="sheet-toolbar">
            <input class="sheet-filename" data-testid="sheet-filename" value="${escapeHtml(wb.name)}" />
            <button data-testid="sheet-new">新建</button>
            <button data-testid="sheet-save">保存</button>
            <button data-testid="sheet-open">打开</button>
            <button data-testid="sheet-undo" title="撤销">↶</button>
            <button data-testid="sheet-redo" title="重做">↷</button>
            <button data-testid="sheet-copy">复制</button>
            <button data-testid="sheet-paste">粘贴</button>
            <span class="status-chip" data-testid="sheet-dirty" style="display:none;"><span class="dot" style="background:var(--warn)"></span>未保存</span>
            <input class="sheet-formula" data-testid="sheet-formula" placeholder="值或公式,如 =SUM(D2:D4)" />
          </div>
          <div class="sheet-grid-wrap">
            <table class="sheet-grid" data-testid="sheet-grid"></table>
          </div>
        </div>`;

      const gridEl = body.querySelector('.sheet-grid');
      const formulaEl = body.querySelector('.sheet-formula');
      const nameEl = body.querySelector('.sheet-filename');
      const dirtyEl = body.querySelector('[data-testid="sheet-dirty"]');

      function renderGrid() {
        const vals = wb.evaluateAll();
        let html = '<thead><tr><th class="corner"></th>';
        for (let c = 0; c < COLS; c++) html += `<th>${colName(c)}</th>`;
        html += '</tr></thead><tbody>';
        const p1 = parseAddr(sel.a1), p2 = parseAddr(sel.a2);
        const c0 = Math.min(p1.col, p2.col), c1 = Math.max(p1.col, p2.col);
        const r0 = Math.min(p1.row, p2.row), r1 = Math.max(p1.row, p2.row);
        for (let r = 0; r < ROWS; r++) {
          html += `<tr><th class="rowhead">${r + 1}</th>`;
          for (let c = 0; c < COLS; c++) {
            const addr = addrOf(c, r);
            const raw = wb.getRaw(addr);
            const e = vals[addr];
            let disp = '';
            let err = false;
            if (e) {
              if (e.error) { disp = e.error; err = true; }
              else if (e.value == null) disp = '';
              else if (typeof e.value === 'number') {
                disp = Number.isInteger(e.value) ? String(e.value) : e.value.toFixed(4).replace(/\.?0+$/, '');
              } else disp = String(e.value);
            }
            const isFormula = String(raw).startsWith('=');
            const cls = [];
            if (addr === sel.a1) cls.push('selected');
            else if (c >= c0 && c <= c1 && r >= r0 && r <= r1) cls.push('in-range');
            if (err) cls.push('error');
            if (isFormula) cls.push('formula');
            html += `<td class="${cls.join(' ')}" data-testid="sheet-cell" data-cell-address="${addr}">${escapeHtml(disp)}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody>';
        gridEl.innerHTML = html;
        formulaEl.value = rawDisplay(wb.getRaw(sel.a1));
        dirtyEl.style.display = wb.dirty ? '' : 'none';
      }

      function rawDisplay(raw) {
        return raw == null ? '' : String(raw);
      }

      function setSel(a1, a2) {
        sel = { a1, a2: a2 || a1 };
        renderGrid();
      }

      function commitEdit(addr, value) {
        pushUndo();
        wb.setRaw(addr, value);
        renderGrid();
        publishCurrent();
      }

      function publishCurrent() {
        if (chartLinkRange) {
          publishRange(ctx, wb, chartLinkRange);
        } else {
          // 发布默认示例区域,便于图表自动连接
          publishRange(ctx, wb, { a1: 'A1', a2: 'D4' });
        }
      }
      win.publishCurrent = publishCurrent;
      win.setChartLink = (r) => {
        chartLinkRange = r;
        publishCurrent();
      };

      // 单元格交互
      gridEl.addEventListener('mousedown', (e) => {
        const td = e.target.closest('td[data-cell-address]');
        if (!td) return;
        const addr = td.dataset.cellAddress;
        if (e.shiftKey) {
          setSel(sel.a1, addr);
        } else if (editing) {
          finishEdit();
          setSel(addr);
        } else {
          setSel(addr);
          // 拖选
          const onMove = (ev) => {
            const t = document.elementFromPoint(ev.clientX, ev.clientY);
            const td2 = t && t.closest && t.closest('td[data-cell-address]');
            if (td2) setSel(sel.a1, td2.dataset.cellAddress);
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }
      });
      gridEl.addEventListener('dblclick', (e) => {
        const td = e.target.closest('td[data-cell-address]');
        if (td) beginEdit(td.dataset.cellAddress);
      });

      let inputEl = null;
      function beginEdit(addr) {
        if (editing) finishEdit();
        editing = true;
        const td = gridEl.querySelector(`td[data-cell-address="${addr}"]`);
        if (!td) return;
        inputEl = document.createElement('input');
        inputEl.className = 'sheet-cell-input';
        inputEl.value = rawDisplay(wb.getRaw(addr));
        const wrap = gridEl.parentElement;
        inputEl.style.left = td.offsetLeft + 'px';
        inputEl.style.top = td.offsetTop + 'px';
        inputEl.style.width = td.offsetWidth + 'px';
        inputEl.style.height = td.offsetHeight + 'px';
        wrap.appendChild(inputEl);
        inputEl.focus();
        inputEl.select();
        inputEl.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            finishEdit();
            const a = parseAddr(addr);
            setSel(addrOf(a.col, a.row + 1));
            formulaEl.value = rawDisplay(wb.getRaw(addrOf(a.col, a.row + 1)));
          } else if (e.key === 'Escape') {
            editing = false;
            inputEl.remove();
            inputEl = null;
            renderGrid();
          }
        });
        inputEl.addEventListener('blur', () => finishEdit());
      }
      function finishEdit() {
        if (!editing || !inputEl) return;
        const addr = sel.a1;
        const v = inputEl.value;
        editing = false;
        inputEl.remove();
        inputEl = null;
        if (v !== rawDisplay(wb.getRaw(addr))) {
          commitEdit(addr, v);
        } else {
          renderGrid();
        }
      }
      win.finishEdit = finishEdit;

      formulaEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          commitEdit(sel.a1, formulaEl.value);
          gridEl.focus();
        }
      });
      formulaEl.addEventListener('change', () => {
        commitEdit(sel.a1, formulaEl.value);
      });

      // 键盘导航
      body.tabIndex = 0;
      body.addEventListener('keydown', (e) => {
        if (editing || document.activeElement === formulaEl) return;
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); doUndo(); return; }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); doRedo(); return; }
        if (e.ctrlKey && e.key === 'c') { e.preventDefault(); doCopy(); return; }
        if (e.ctrlKey && e.key === 'v') { e.preventDefault(); doPaste(); return; }
        const a = parseAddr(sel.a1);
        if (!a) return;
        let { col, row } = a;
        if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
        else if (e.key === 'ArrowDown') row = Math.min(ROWS - 1, row + 1);
        else if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
        else if (e.key === 'ArrowRight') col = Math.min(COLS - 1, col + 1);
        else if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault();
          beginEdit(sel.a1);
          return;
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          commitEdit(sel.a1, '');
          return;
        } else if (e.key === 'Tab') {
          e.preventDefault();
          col = e.shiftKey ? Math.max(0, col - 1) : Math.min(COLS - 1, col + 1);
        } else return;
        e.preventDefault();
        setSel(addrOf(col, row));
      });

      // 工具栏
      body.querySelector('[data-testid="sheet-new"]').addEventListener('click', async () => {
        if (wb.dirty) {
          const r = await confirmSave();
          if (r === 'cancel') return;
          if (r === 'save') doSave();
        }
        wb = new Workbook('未命名工作簿');
        path = null;
        win.meta.path = null;
        wm.setTitle(win.id, '未命名工作簿 — 电子表格');
        undoStack.length = 0;
        redoStack.length = 0;
        renderGrid();
      });
      body.querySelector('[data-testid="sheet-save"]').addEventListener('click', () => doSave());
      body.querySelector('[data-testid="sheet-open"]').addEventListener('click', async () => {
        const p = prompt('输入工作簿路径(如 /Demo/sample.sheet)', '/Demo/sample.sheet');
        if (!p) return;
        openPath(p);
      });
      body.querySelector('[data-testid="sheet-undo"]').addEventListener('click', doUndo);
      body.querySelector('[data-testid="sheet-redo"]').addEventListener('click', doRedo);
      body.querySelector('[data-testid="sheet-copy"]').addEventListener('click', doCopy);
      body.querySelector('[data-testid="sheet-paste"]').addEventListener('click', doPaste);
      nameEl.addEventListener('change', () => {
        wb.name = nameEl.value || '未命名工作簿';
        wb.dirty = true;
        renderGrid();
      });

      async function openPath(p) {
        const txt = fs.readFile(p);
        if (!txt) {
          shell.notify('打开失败', '文件不存在: ' + p, 'err');
          return;
        }
        if (wb.dirty) {
          const r = await confirmSave();
          if (r === 'cancel') return;
          if (r === 'save') doSave();
        }
        try {
          wb = Workbook.load(JSON.parse(txt));
        } catch (e) {
          shell.notify('打开失败', '不是有效的工作簿文件', 'err');
          return;
        }
        path = p;
        win.meta.path = p;
        nameEl.value = wb.name;
        wm.setTitle(win.id, (p.split('/').pop()) + ' — 电子表格');
        undoStack.length = 0;
        redoStack.length = 0;
        wb.dirty = false;
        renderGrid();
        publishCurrent();
        shell.notify('已打开工作簿', p, 'ok');
      }
      win.openPath = openPath;

      function doSave() {
        let p = path;
        if (!p) {
          const name = (nameEl.value || '未命名工作簿').replace(/\.sheet$/, '') + '.sheet';
          p = '/Documents/' + name;
        }
        wb.name = nameEl.value || wb.name;
        fs.writeFile(p, JSON.stringify(wb.serialize(), null, 2), { kind: 'sheet' });
        path = p;
        win.meta.path = p;
        wb.dirty = false;
        wm.setTitle(win.id, p.split('/').pop() + ' — 电子表格');
        shell.notify('已保存', p, 'ok');
        renderGrid();
      }
      function doUndo() {
        if (!undoStack.length) return;
        redoStack.push(snapshot());
        wb.cells = JSON.parse(undoStack.pop());
        wb.dirty = true;
        renderGrid();
        publishCurrent();
      }
      function doRedo() {
        if (!redoStack.length) return;
        undoStack.push(snapshot());
        wb.cells = JSON.parse(redoStack.pop());
        wb.dirty = true;
        renderGrid();
        publishCurrent();
      }
      function doCopy() {
        const tsv = wb.rangeToTSV(sel.a1, sel.a2);
        try { navigator.clipboard.writeText(tsv); } catch (e) { /* ignore */ }
        ctx.clipboardHistory = ctx.clipboardHistory || [];
        ctx.clipboardHistory.unshift({ text: tsv, time: Date.now(), kind: 'tsv' });
        if (ctx.clipboardHistory.length > 50) ctx.clipboardHistory.pop();
        ctx.bus.emit('clipboard-changed');
        shell.notify('已复制', '选区已复制为文本', 'ok');
      }
      async function doPaste() {
        let text = '';
        try { text = await navigator.clipboard.readText(); } catch (e) { /* ignore */ }
        if (!text) return;
        pushUndo();
        const rows = text.split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === ''));
        const p1 = parseAddr(sel.a1);
        rows.forEach((line, ri) => {
          line.split('\t').forEach((cell, ci) => {
            wb.setRaw(addrOf(p1.col + ci, p1.row + ri), cell);
          });
        });
        renderGrid();
        publishCurrent();
      }

      async function confirmSave() {
        return new Promise((resolve) => {
          const mask = document.createElement('div');
          mask.style.cssText = 'position:fixed;inset:0;background:rgba(5,8,20,0.55);z-index:15000;display:flex;align-items:center;justify-content:center;';
          mask.innerHTML = `<div class="panel" style="width:380px;background:var(--glass-strong);">
            <h3>未保存的修改</h3>
            <div class="muted" style="font-size:13px;margin-bottom:16px;">工作簿「${escapeHtml(wb.name)}」有未保存的修改,是否保存?</div>
            <div class="row" style="justify-content:flex-end;">
              <button data-act="cancel">取消</button>
              <button data-act="discard">放弃</button>
              <button class="primary" data-act="save">保存</button>
            </div></div>`;
          document.body.appendChild(mask);
          mask.addEventListener('click', (e) => {
            const act = e.target.dataset && e.target.dataset.act;
            if (!act) return;
            mask.remove();
            resolve(act);
          });
        });
      }

      // 右键菜单
      gridEl.addEventListener('contextmenu', (e) => {
        const td = e.target.closest('td[data-cell-address]');
        if (td) setSel(td.dataset.cellAddress);
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [
          { label: '复制', icon: '⧉', action: doCopy },
          { label: '粘贴', icon: '📋', action: doPaste },
          '-',
          { label: '插入 SUM 公式', icon: 'Σ', action: () => {
            commitEdit(sel.a1, '=SUM(D2:D4)');
          }, testid: 'sheet-insert-sum' },
          { label: '清空单元格', icon: '✕', action: () => commitEdit(sel.a1, '') },
        ]);
      });

      renderGrid();
      publishCurrent();
    },
  });
  return win;
}
