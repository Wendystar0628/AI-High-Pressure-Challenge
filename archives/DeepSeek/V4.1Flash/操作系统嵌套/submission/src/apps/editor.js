import { appIcon, fileIcon, folderIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc, fmtBytes } from '../ui/common.js';
import * as FS from '../core/fs.js';

export const meta = {
  title: '文本与程序编辑器', desc: '编辑、保存并启动 NPL 程序',
  width: 980, height: 660, minW: 520, minH: 340,
};

const NEW_TEMPLATE = `// 新的 NPL 程序
// 可用的系统服务见“操作说明 → 程序与内核”
var n = 0;
while (n < 5) {
  n = n + 1;
  print("运行第 " + n + " 步；系统时间 " + sys.time());
  sys.wait(0.25);
}
print("程序结束");
`;

export function mount(ctx) {
  const { sys, os, shell, body, data, window: win } = ctx;
  if (!data.editor) data.editor = { path: win.props?.path || null, text: null, dirty: false, consoleOpen: true };
  const st = data.editor;
  let path = st.path;
  let text = st.text ?? '';
  let dirty = !!st.dirty;
  let runPid = 0;
  let compileMessage = '';
  let openDirs = new Set(['/Programs', '/System', '/Demo', '/Documents']);
  let lastSavedText = null;

  body.innerHTML = `<div class="editor-app">
    <div class="app-toolbar editor-toolbar">
      <button type="button" class="icon-button" data-editor-new title="新建程序" aria-label="新建程序">${uiIcon('plus')}</button>
      <button type="button" class="icon-button" data-editor-open title="打开文件" aria-label="打开文件">${uiIcon('folder')}</button>
      <button type="button" class="chip-button" data-testid="editor-save" data-editor-save title="保存 Ctrl+S">${uiIcon('success')} 保存</button>
      <span class="tb-sep"></span>
      <button type="button" class="chip-button run-button" data-editor-run title="编译并运行">${uiIcon('play')} 运行</button>
      <button type="button" class="chip-button" data-editor-stop title="结束运行">${uiIcon('stop')} 停止</button>
      <span class="tb-sep"></span>
      <span class="editor-filename" data-testid="editor-filename" data-editor-path>${esc(path || '未命名程序')}</span>
      <span class="editor-dirty" data-editor-dirty>${dirty ? '● 未保存' : ''}</span>
      <span class="spacer"></span>
      <span class="editor-kind" data-editor-kind>NPL/1</span>
      <button type="button" class="icon-button" data-editor-console-toggle title="切换输出面板" aria-label="输出">${uiIcon('list')}</button>
    </div>
    <div class="editor-body">
      <aside class="editor-side">
        <div class="editor-side-head"><span>文件</span><button type="button" class="icon-button" data-editor-refresh title="刷新">${uiIcon('reload')}</button></div>
        <div class="editor-tree" data-editor-tree></div>
        <div class="editor-side-foot">
          <div class="editor-system-chip"><span></span>${esc(sys.name)} · L${sys.depth + 1}</div>
          <div class="editor-tip">提示：内核源文件位于父系统 <code>/System</code>。<br>保存后重启对应子系统生效。</div>
        </div>
      </aside>
      <div class="editor-main">
        <div class="editor-pane" data-editor-pane>
          <div class="editor-gutter" data-editor-gutter>1</div>
          <textarea class="editor-text" data-testid="editor-text" spellcheck="false" wrap="off" aria-label="程序文本"></textarea>
        </div>
        <div class="editor-console ${st.consoleOpen ? '' : 'collapsed'}" data-editor-console>
          <div class="editor-console-head">
            <div class="editor-console-tabs"><button type="button" class="active" data-console-tab="output">程序输出</button><button type="button" data-console-tab="compile">编译与状态</button></div>
            <div class="editor-console-actions"><span class="editor-run-state" data-editor-runstate>未运行</span><button type="button" class="icon-button" data-editor-clear title="清空输出">${uiIcon('trash')}</button><button type="button" class="icon-button" data-editor-console-close title="收起">${uiIcon('minimize')}</button></div>
          </div>
          <div class="editor-console-body" data-editor-console-body>
            <div class="console-line muted">选择程序文件，点击“运行”查看输出。程序和内核均在系统调度下执行。</div>
          </div>
        </div>
      </div>
    </div>
    <div class="editor-status">
      <span data-editor-lines>0 行</span><span data-editor-cursor>行 1，列 1</span>
      <span class="spacer"></span>
      <span>UTF-8</span><span>NPL / 1</span><span data-editor-save-state>已保存</span>
    </div>
    <div class="editor-file-picker hidden" data-editor-picker></div>
  </div>`;

  const textarea = $s(body, '[data-testid="editor-text"]');
  const gutter = $s(body, '[data-editor-gutter]');
  const consoleBody = $s(body, '[data-editor-console-body]');
  const consoleEl = $s(body, '[data-editor-console]');
  const treeEl = $s(body, '[data-editor-tree]');
  const picker = $s(body, '[data-editor-picker]');

  if (path) loadFile(path, { initial: true });
  else {
    text = st.text ?? NEW_TEMPLATE;
    if (!st.text) { path = null; }
    textarea.value = text;
    updateAll();
  }

  function updateAll() {
    textarea.value = text;
    const lines = text.split('\n').length;
    gutter.innerHTML = Array.from({ length: Math.max(1, lines) }, (_, i) => i + 1).join('\n');
    const fn = $s(body, '[data-editor-path]');
    if (fn) fn.textContent = path || '未命名程序';
    const dirtyEl = $s(body, '[data-editor-dirty]');
    if (dirtyEl) dirtyEl.textContent = dirty ? '● 未保存' : '';
    const kind = $s(body, '[data-editor-kind]');
    if (kind) kind.textContent = path ? (path.endsWith('.kernel.prog') ? 'KERNEL · NPL' : path.endsWith('.prog') ? 'NPL/1' : '文本') : 'NPL/1';
    $s(body, '[data-editor-lines]').textContent = `${lines} 行`;
    $s(body, '[data-editor-save-state]').textContent = dirty ? '有未保存修改' : '已保存';
    $s(body, '[data-editor-run]').disabled = !path || !/\.prog$/.test(path) || path.endsWith('.kernel.prog') || path.endsWith('/flight.prog');
    $s(body, '[data-editor-stop]').disabled = !runPid;
    ctx.setTitle((path ? FS.baseName(path) : '未命名程序') + (dirty ? ' •' : '') + ' — 编辑器');
    ctx.setDirty(dirty);
    st.path = path; st.text = text; st.dirty = dirty;
    updateCursor();
  }

  function updateCursor() {
    const pos = textarea.selectionStart;
    const before = text.slice(0, pos);
    const lines = before.split('\n');
    $s(body, '[data-editor-cursor]').textContent = `行 ${lines.length}，列 ${lines[lines.length - 1].length + 1}`;
  }

  function setDirty(v) { dirty = !!v; st.dirty = dirty; updateAll(); }

  function loadFile(p, opts = {}) {
    const node = FS.resolveNode(sys.fs, p);
    if (!node || node.type !== 'file') { ctx.toast('文件不存在', 'error'); return false; }
    path = p;
    text = node.content;
    lastSavedText = text;
    st.path = p; st.text = text; st.dirty = false;
    dirty = false;
    runPid = 0;
    setConsoleOutput(`[已打开] ${p}\n${fmtBytes(FS.fileSize(node))} · ${new Date(node.updatedAt || node.createdAt).toLocaleString('zh-CN')}`, true);
    updateAll();
    renderTree();
    return true;
  }

  async function maybeSaveBeforeSwitch() {
    if (!dirty) return true;
    const res = await ctx.dialog({
      title: '文件未保存', message: `“${path ? FS.baseName(path) : '未命名程序'}”有未保存修改。`,
      buttons: [{ label: '取消', value: null }, { label: '放弃', value: 'discard', danger: true }, { label: '保存', value: 'save', primary: true }],
    });
    if (!res) return false;
    if (res.button.value === 'save') return await saveFile(true);
    return true;
  }

  async function saveFile(showToast = true) {
    if (!path) return await saveAs();
    try {
      os.writeFile(sys.id, path, text, { kind: FS.fileKind(path) });
      if (win.procId) os.chargeProcess(sys.id, win.procId, 8 + Math.ceil(text.length / 256));
      dirty = false; lastSavedText = text;
      st.text = text; st.dirty = false;
      updateAll();
      renderTree();
      if (showToast) ctx.toast('已保存 ' + FS.baseName(path), 'success');
      if (path.endsWith('.kernel.prog')) os.notify(sys.id, { title: '内核源文件已保存', body: '重启对应子系统后生效', kind: 'info', appId: 'editor' });
      return true;
    } catch (err) { ctx.toast('保存失败：' + err.message, 'error'); return false; }
  }

  async function saveAs() {
    const r = await ctx.dialog({ title: '另存为', fields: [{ name: 'path', label: '文件路径', value: path || '/Programs/新程序.prog' }], okLabel: '保存' });
    if (!r) return false;
    let p = FS.normalizePath(r.values.path);
    if (!/\.[a-z0-9]+$/i.test(p)) p += '.prog';
    try {
      os.writeFile(sys.id, p, text, { kind: FS.fileKind(p) });
      path = p; st.path = p; dirty = false; st.dirty = false;
      updateAll(); renderTree();
      ctx.toast('已保存到 ' + p, 'success');
      return true;
    } catch (err) { ctx.toast(err.message, 'error'); return false; }
  }

  function setConsoleOutput(line, replace = false) {
    if (replace) consoleBody.innerHTML = '';
    const div = el(`<div class="console-line">${esc(line)}</div>`);
    consoleBody.appendChild(div);
    while (consoleBody.children.length > 400) consoleBody.firstElementChild.remove();
    consoleBody.scrollTop = consoleBody.scrollHeight;
  }

  function renderTree() {
    const files = [];
    (function walk(node, base, depth) {
      if (!node || depth > 4) return;
      const children = [...(node.children || [])].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'zh') : a.type === 'dir' ? -1 : 1));
      for (const c of children) {
        const p = FS.joinPath(base, c.name);
        if (c.type === 'dir') {
          if (base === '/' && !['System', 'Programs', 'Apps', 'Demo', 'Documents'].includes(c.name)) continue;
          if (base === '/Documents' && depth > 2) continue;
          files.push({ type: 'dir', node: c, path: p, depth });
          walk(c, p, depth + 1);
        } else if (/\.(prog|txt|md|sheet|scene|flight|json)$/i.test(c.name)) {
          files.push({ type: 'file', node: c, path: p, depth });
        }
      }
    })(sys.fs, '/', 0);
    treeEl.innerHTML = files.map((f) => {
      if (f.type === 'dir') {
        return `<button type="button" class="tree-dir" data-tree-dir="${esc(f.path)}" style="padding-left:${6 + f.depth * 11}px">${uiIcon('folder')}<span>${esc(f.node.name)}</span></button>`;
      }
      const active = f.path === path;
      const kernel = f.path.endsWith('.kernel.prog');
      return `<button type="button" class="tree-file ${active ? 'active' : ''}" data-tree-file="${esc(f.path)}" style="padding-left:${6 + f.depth * 11 + 12}px" title="${esc(f.path)}">
        ${fileIcon(f.node.name, 17)}<span>${esc(f.node.name)}</span>${kernel ? '<i>KERNEL</i>' : ''}${f.node.meta?.trashed ? '<i>TRASH</i>' : ''}
      </button>`;
    }).join('');
    for (const btn of $all(treeEl, '[data-tree-file]')) {
      btn.addEventListener('click', async () => {
        if (btn.dataset.treeFile === path) return;
        if (!(await maybeSaveBeforeSwitch())) return;
        loadFile(btn.dataset.treeFile);
      });
    }
    for (const btn of $all(treeEl, '[data-tree-dir]')) {
      btn.addEventListener('click', () => { ctx.toast(btn.dataset.treeDir, 'info'); });
    }
  }

  function showPicker() {
    const files = [];
    (function walk(node, base, depth) {
      if (!node || depth > 3) return;
      for (const c of node.children || []) {
        const p = FS.joinPath(base, c.name);
        if (c.type === 'dir') walk(c, p, depth + 1);
        else if (/\.(prog|txt|md|json|sheet|scene|flight|snap)$/i.test(c.name)) files.push({ node: c, path: p });
      }
    })(sys.fs, '/', 0);
    picker.classList.remove('hidden');
    picker.innerHTML = `<div class="editor-picker-panel">
      <div class="sheet-picker-head"><div><b>打开文件</b><span>${files.length} 个可编辑文件</span></div><button type="button" class="icon-button" data-picker-close>${uiIcon('close')}</button></div>
      <div class="sheet-picker-list">${files.map((f, i) => `<button type="button" class="sheet-picker-item" data-picker-index="${i}">${fileIcon(f.node.name, 30)}<div><b>${esc(f.node.name)}</b><span>${esc(f.path)} · ${fmtBytes(FS.fileSize(f.node))}</span></div></button>`).join('')}</div>
      <div class="sheet-picker-foot"><button type="button" class="small-button" data-picker-path>按路径打开…</button></div>
    </div>`;
    $s(picker, '[data-picker-close]').addEventListener('click', () => picker.classList.add('hidden'));
    picker.addEventListener('click', (e) => { if (e.target === picker) picker.classList.add('hidden'); }, { once: true });
    for (const btn of $all(picker, '[data-picker-index]')) {
      btn.addEventListener('click', async () => {
        const f = files[Number(btn.dataset.pickerIndex)];
        picker.classList.add('hidden');
        if (!(await maybeSaveBeforeSwitch())) return;
        loadFile(f.path);
      });
    }
    $s(picker, '[data-picker-path]').addEventListener('click', async () => {
      picker.classList.add('hidden');
      const r = await ctx.dialog({ title: '按路径打开', fields: [{ name: 'path', label: '路径', value: '' }], okLabel: '打开' });
      if (r && r.values.path) { if (await maybeSaveBeforeSwitch()) loadFile(FS.normalizePath(r.values.path)); }
    });
  }

  async function newProgram() {
    if (!(await maybeSaveBeforeSwitch())) return;
    const r = await ctx.dialog({
      title: '新建程序', fields: [
        { name: 'name', label: '文件名', value: '新程序.prog' },
        { name: 'path', label: '目录', value: '/Programs' },
      ], okLabel: '创建',
    });
    if (!r) return;
    let name = (r.values.name || '新程序.prog').trim();
    if (!/\.[a-z0-9]+$/i.test(name)) name += '.prog';
    const p = FS.joinPath(FS.normalizePath(r.values.path || '/Programs'), name);
    try {
      if (!FS.resolveNode(sys.fs, FS.parentPath(p))) os.mkdir(sys.id, FS.parentPath(p));
      os.writeFile(sys.id, p, NEW_TEMPLATE, { kind: 'program' });
      loadFile(p);
      ctx.toast('已创建 ' + p, 'success');
    } catch (err) { ctx.toast(err.message, 'error'); }
  }

  async function runProgram() {
    if (!path) return;
    if (!/\.prog$/.test(path) || path.endsWith('.kernel.prog') || path.endsWith('/flight.prog')) {
      ctx.toast(path?.endsWith('.kernel.prog') ? '内核程序由父系统的承载进程执行；保存后重启子系统生效。' : '该文件不能直接运行。', 'warn');
      return;
    }
    if (dirty && !(await saveFile(false))) return;
    try {
      compileMessage = `[${new Date().toLocaleTimeString('zh-CN')}] 编译 ${FS.baseName(path)} …\n`;
      const proc = os.spawnProgram(sys.id, path, FS.baseName(path).replace(/\.prog$/, ''));
      runPid = proc.pid;
      setConsoleOutput(`[启动] PID ${proc.pid} · ${path}`, true);
      setConsoleOutput('程序已进入本系统进程表，由内核按预算调度。');
      $s(body, '[data-editor-runstate]').textContent = `运行中 · PID ${proc.pid}`;
      $s(body, '[data-editor-runstate]').classList.add('running');
      updateAll();
      renderTree();
    } catch (err) {
      setConsoleOutput(`[编译/启动失败] ${err.message}`, true);
      ctx.toast('运行失败：' + err.message, 'error');
    }
  }

  // ---------------- 事件 ----------------
  textarea.value = st.text ?? text;
  textarea.addEventListener('input', () => {
    text = textarea.value;
    dirty = text !== lastSavedText;
    st.text = text; st.dirty = dirty;
    updateAll();
  });
  textarea.addEventListener('scroll', () => { gutter.scrollTop = textarea.scrollTop; });
  textarea.addEventListener('copy', () => {
    const sel = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    if (sel) os.addClipboard(sel, { kind: 'text', systemId: sys.id, path });
  });
  textarea.addEventListener('keyup', updateCursor);
  textarea.addEventListener('click', updateCursor);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart, end = textarea.selectionEnd;
      textarea.value = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      text = textarea.value; dirty = true; st.text = text; st.dirty = true; updateAll();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(true); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runProgram(); }
  });
  $s(body, '[data-editor-save]').addEventListener('click', () => saveFile(true));
  $s(body, '[data-editor-run]').addEventListener('click', runProgram);
  $s(body, '[data-editor-stop]').addEventListener('click', () => {
    if (runPid) { os.removeProcess(sys.id, runPid); setConsoleOutput(`[结束] 进程 PID ${runPid}`); runPid = 0; $s(body, '[data-editor-runstate]').textContent = '已结束'; $s(body, '[data-editor-runstate]').classList.remove('running'); updateAll(); }
  });
  $s(body, '[data-editor-new]').addEventListener('click', newProgram);
  $s(body, '[data-editor-open]').addEventListener('click', showPicker);
  $s(body, '[data-editor-refresh]').addEventListener('click', renderTree);
  $s(body, '[data-editor-clear]').addEventListener('click', () => { consoleBody.innerHTML = ''; });
  $s(body, '[data-editor-console-close]').addEventListener('click', () => {
    consoleEl.classList.add('collapsed'); st.consoleOpen = false; data.editor.consoleOpen = false;
  });
  $s(body, '[data-editor-console-toggle]').addEventListener('click', () => {
    consoleEl.classList.toggle('collapsed'); st.consoleOpen = !consoleEl.classList.contains('collapsed'); data.editor.consoleOpen = st.consoleOpen;
  });
  for (const tab of $all(body, '[data-console-tab]')) {
    tab.addEventListener('click', () => {
      for (const t of $all(body, '[data-console-tab]')) t.classList.toggle('active', t === tab);
      if (tab.dataset.consoleTab === 'compile') {
        consoleBody.innerHTML = `<div class="console-line">文件：${esc(path || '未命名')}</div>
          <div class="console-line">格式：NPL/1 · ${text.split('\n').length} 行 · ${fmtBytes(new Blob([text]).size)}</div>
          <div class="console-line">编译器：${esc(sys.compilerConfig?.name || 'nplc')}（/System/compiler.prog）</div>
          <div class="console-line">循环许可：${sys.compilerConfig?.allowLoops === false ? '禁止' : '允许'} · 前导代码 ${sys.compilerConfig?.prelude?.length || 0} 字符</div>
          <div class="console-line muted">${esc(compileMessage || '运行时会编译并载入内核管理的执行环境。')}</div>`;
      }
    });
  }

  const unsubs = [];
  unsubs.push(os.on('process-output', (e) => {
    if (e.systemId !== sys.id) return;
    const proc = sys.processes.find((p) => p.pid === e.pid);
    if (e.pid === runPid || (proc && proc.role === 'custom' && proc.programPath === path)) {
      setConsoleOutput(`[${e.pid}] ${e.text}`);
    }
  }));
  unsubs.push(os.on('process-ended', (e) => {
    if (e.systemId === sys.id && e.pid === runPid) {
      setConsoleOutput(`[进程 ${e.pid} 已结束]`);
      $s(body, '[data-editor-runstate]').textContent = '已结束';
      $s(body, '[data-editor-runstate]').classList.remove('running');
      runPid = 0; updateAll();
    }
  }));
  unsubs.push(os.on('process-error', (e) => {
    if (e.systemId === sys.id && e.pid === runPid) {
      setConsoleOutput(`[进程异常] ${e.error}`);
      ctx.toast('程序异常：' + e.error, 'error');
      $s(body, '[data-editor-runstate]').textContent = '异常';
      runPid = 0; updateAll();
    }
  }));
  unsubs.push(os.on('fs-changed', (e) => { if (e.systemId === sys.id) renderTree(); }));

  renderTree();
  updateAll();
  if (!st.text && path) {
    // initial file loaded by loadFile above
  }
  if (st.text && !path) textarea.value = st.text;

  return {
    beforeClose: async () => {
      if (!dirty) return true;
      const res = await ctx.dialog({
        title: '保存文件？', message: `“${path ? FS.baseName(path) : '未命名程序'}”有未保存的修改。`,
        buttons: [{ label: '取消', value: null }, { label: '放弃', value: 'discard', danger: true }, { label: '保存', value: 'save', primary: true }],
      });
      if (!res) return false;
      if (res.button.value === 'save') return await saveFile(true);
      return true;
    },
    destroy() { for (const u of unsubs) u(); },
    inspect() { return { path, dirty, lines: text.split('\n').length }; },
  };
}
