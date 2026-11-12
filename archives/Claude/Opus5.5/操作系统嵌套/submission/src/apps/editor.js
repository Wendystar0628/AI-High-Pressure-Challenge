// 根系统文本与程序编辑器：编辑任意文本文件；Nest 程序可编译检查与运行；
// 可打开直属子系统的内核源文件；编辑 /System/compiler.nest 后可“编译编译器”。
import { h, clear, icon } from '../ui/dom.js';

const KW = new Set(['def', 'defn', 'fn', 'var', 'set!', 'inc!', 'dec!', 'if', 'when', 'unless', 'cond', 'case', 'else', 'do', 'while', 'for', 'each', 'each-i', 'each-kv', 'break', 'continue', 'return', 'and', 'or', 'not', 'try', 'catch', 'throw', 'sys', 'include', 'let', 'list', 'dict', 'get', 'put!', 'apply']);
function highlight(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = ''; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ';') { const j = src.indexOf('\n', i); const e = j < 0 ? src.length : j; out += `<span class="hl-c">${esc(src.slice(i, e))}</span>`; i = e; continue; }
    if (c === '"') { let j = i + 1; while (j < src.length && src[j] !== '"') { if (src[j] === '\\') j++; j++; } out += `<span class="hl-s">${esc(src.slice(i, j + 1))}</span>`; i = j + 1; continue; }
    if ('()[]{}'.includes(c)) { out += `<span class="hl-p">${c}</span>`; i++; continue; }
    if (/\s/.test(c)) { out += c; i++; continue; }
    let j = i; while (j < src.length && !/[\s()\[\]{}";]/.test(src[j])) j++;
    const tok = src.slice(i, j);
    if (/^-?\d/.test(tok)) out += `<span class="hl-n">${esc(tok)}</span>`;
    else if (tok[0] === ':') out += `<span class="hl-s">${esc(tok)}</span>`;
    else if (KW.has(tok)) out += `<span class="hl-k">${esc(tok)}</span>`;
    else if (src[i - 1] === '(') out += `<span class="hl-f">${esc(tok)}</span>`;
    else out += esc(tok);
    i = j;
  }
  return out + '\n';
}

export default {
  id: 'editor', name: '文本与程序编辑器', icon: 'editor', w: 920, h: 600, keywords: 'editor code 编辑 程序 内核',
  create(ctx) {
    const { fs, desktop, win, root } = ctx;
    let path = null, dirty = false, readonly = false;
    const fname = h('span', { class: 'ed-fname', tid: 'editor-filename', 'data-system-id': 'outer', 'data-window-id': win.id });
    const ta = h('textarea', { class: 'ed-text', tid: 'editor-text', 'data-system-id': 'outer', 'data-window-id': win.id, spellcheck: 'false', 'aria-label': '编辑区', wrap: 'off' });
    const hl = h('pre', { class: 'ed-hl', 'aria-hidden': 'true' });
    const gutter = h('div', { class: 'ed-gutter' });
    const out = h('div', { class: 'ed-out scroll', tid: 'editor-output' });
    const btn = (tid, ic, label, fn, text) => { const b = h('button', { class: text ? 'btn' : 'btn icon', tid, 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': label, title: label, html: ic ? icon(ic) : '' }, text || ''); b.addEventListener('click', fn); return b; };
    const kernelSel = h('select', { class: 'inp', tid: 'editor-kernel-select', 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': '打开子系统内核源文件', style: { maxWidth: '170px' } });
    const fillKernels = () => {
      clear(kernelSel);
      kernelSel.append(h('option', { value: '', text: '子系统内核源文件…' }));
      kernelSel.append(h('option', { value: '/System/kernel.nest', text: '内核模板 kernel.nest' }));
      for (const id of root.childOrder) kernelSel.append(h('option', { value: root.children.get(id).kernel, text: `${id} 的内核` }));
      kernelSel.append(h('option', { value: '/System/compiler.nest', text: '编译器 compiler.nest' }));
    };
    kernelSel.addEventListener('focus', fillKernels);
    kernelSel.addEventListener('change', () => { const v = kernelSel.value; kernelSel.value = ''; if (v) guard(() => load(v)); });
    fillKernels();
    const runBtn = btn('editor-run', 'run', '运行程序', () => run(), '运行');
    const compBtn = btn('editor-compile', 'kernel', '编译检查', () => compileCheck(), '编译');
    const instBtn = btn('editor-install-compiler', 'restart', '用当前编译器编译新编译器并替换', () => installCompiler(), '编译编译器');
    const toolbar = h('div', { class: 'toolbar' },
      btn('editor-new', 'newfile', '新建', () => guard(() => { path = null; ta.value = ''; setDirty(false); refresh(); })),
      btn('editor-open', 'open', '打开', () => guard(() => openDialog())),
      btn('editor-save', 'save', '保存 (Ctrl+S)', () => save(false), '保存'),
      btn('editor-save-as', null, '另存为', () => save(true), '另存为'),
      h('div', { class: 'tb-sep' }), runBtn, compBtn, instBtn, kernelSel,
      h('div', { class: 'grow' }), fname);
    const code = h('div', { class: 'ed-code' }, gutter, h('div', { class: 'ed-wrap' }, hl, ta));
    const el = h('div', { class: 'editor' }, toolbar, code, out);

    function setDirty(d) { dirty = d; refreshTitle(); }
    function refreshTitle() {
      fname.textContent = (path || '未命名') + (dirty ? ' •' : '') + (readonly ? '（只读）' : '');
      desktop.setTitle(win, `${dirty ? '● ' : ''}${path ? path.split('/').pop() : '未命名'} — 编辑器`);
      const isNest = path && path.endsWith('.nest');
      runBtn.style.display = isNest ? '' : 'none';
      compBtn.style.display = isNest ? '' : 'none';
      instBtn.style.display = path === '/System/compiler.nest' ? '' : 'none';
    }
    function refresh() {
      const lines = ta.value.split('\n').length;
      if (gutter.childElementCount !== lines) { clear(gutter); for (let i = 1; i <= lines; i++) gutter.append(h('div', { text: String(i) })); }
      hl.innerHTML = (path && path.endsWith('.nest')) || ta.value.trimStart().startsWith(';') ? highlight(ta.value) : ta.value.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '\n';
      syncScroll();
      refreshTitle();
    }
    function syncScroll() { hl.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`; gutter.style.transform = `translateY(${-ta.scrollTop}px)`; }
    ta.addEventListener('scroll', syncScroll);
    let hlT = 0;
    ta.addEventListener('input', () => { if (!dirty) setDirty(true); clearTimeout(hlT); hlT = setTimeout(refresh, 60); });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(false); }
    });
    ta.addEventListener('copy', () => { const t = ta.value.slice(ta.selectionStart, ta.selectionEnd); if (t) desktop.recordClipboard({ type: 'text', text: t, source: '编辑器' }); });
    function print(text, cls = '') { out.append(h('div', { class: 'ed-line ' + cls, text })); out.scrollTop = out.scrollHeight; }
    function load(p) {
      const txt = fs.read(p);
      if (txt == null) { desktop.notify({ title: '打开失败', body: '文件不存在：' + p, level: 'error' }); return; }
      path = p; ta.value = txt; readonly = !!ctx.args.readonly && p === ctx.args.path; ta.readOnly = readonly;
      setDirty(false); refresh(); ta.scrollTop = 0;
      clear(out); print(`已打开 ${p}（${txt.length} 字符）`, 'dim');
    }
    async function save(as) {
      let p = path;
      if (!p || as) {
        const n = await desktop.prompt('保存为（根系统路径）', p || '/Documents/新程序.nest');
        if (!n) return false;
        p = n.startsWith('/') ? n : '/Documents/' + n;
      }
      try {
        fs.write(p, ta.value); path = p; setDirty(false);
        print(`已保存 ${p}`, 'ok');
        desktop.notify({ title: '文件已保存', body: p, level: 'ok', source: 'files' });
        if (p.startsWith('/System/Kernels/')) print('提示：内核源文件修改后，在系统窗口或任务管理器中“重启”该子系统即可生效。', 'dim');
        return true;
      } catch (e) { print('保存失败：' + e.message, 'err'); desktop.notify({ title: '保存失败', body: e.message, level: 'error' }); return false; }
    }
    async function guard(then) {
      if (!dirty) { then(); return true; }
      const r = await desktop.confirm({ title: '保存修改？', body: `${path || '未命名'} 有未保存的修改。`, ok: '保存', extra: '放弃', cancel: '取消', icon: 'warning' });
      if (r === 'cancel') return false;
      if (r === 'ok' && !(await save(false))) return false;
      then(); return true;
    }
    async function run() {
      if (dirty && !(await save(false))) return;
      try {
        const p = root.spawn(path, null, 'user', null);
        print(`▶ 启动 ${path}（进程 ${p.pid}）`, 'ok');
        watch(p);
      } catch (e) { print('启动失败：' + e.message, 'err'); }
    }
    function watch(p) {
      let seen = 0;
      const t = setInterval(() => {
        for (; seen < p.out.length; seen++) print(`[${p.pid}] ${p.out[seen]}`);
        if (p.state === 'done' || p.state === 'error') {
          clearInterval(t);
          if (p.state === 'error') print(`进程 ${p.pid} 异常：${p.error}`, 'err');
          else print(`进程 ${p.pid} 结束，返回值：${p.result === undefined ? 'nil' : JSON.stringify(p.result)}`, 'dim');
        }
      }, 250);
    }
    async function compileCheck() {
      if (dirty && !(await save(false))) return;
      print(`编译 ${path} …（由系统内的编译器程序执行）`, 'dim');
      root.compileAsync(path, fs.read(path), (res) => {
        if (typeof res === 'string') print(`编译成功：${(res.length / 1024).toFixed(1)} KB 可执行数据`, 'ok');
        else { print(`编译错误（第 ${res.line} 行）：${res.error}`, 'err'); gotoLine(res.line); }
      });
    }
    async function installCompiler() {
      if (dirty && !(await save(false))) return;
      print('用当前编译器编译 /System/compiler.nest …', 'dim');
      root.compileAsync('/System/compiler.nest', fs.read('/System/compiler.nest'), (res) => {
        if (typeof res !== 'string') { print(`新编译器编译失败（第 ${res.line} 行）：${res.error}`, 'err'); return; }
        const old = fs.read('/System/bin/compiler.nx');
        if (old) fs.write('/System/bin/compiler.prev.nx', old);
        fs.write('/System/bin/compiler.nx', res);
        root.loadBinIndex();
        print('新编译器已安装：此后启动的程序与子系统内核都由它编译（旧版本保存在 /System/bin/compiler.prev.nx）。', 'ok');
        desktop.notify({ title: '编译器已更新', body: '此后启动的程序使用新编译器', level: 'ok' });
      });
    }
    function gotoLine(n) {
      if (!n) return;
      const lines = ta.value.split('\n'); let pos = 0;
      for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      ta.focus(); ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
      ta.scrollTop = Math.max(0, (n - 5) * 19.5);
    }
    function openDialog() {
      const all = [...fs.files.entries()].filter(([p, e]) => e.type === 'file' && /\.(nest|txt|md|json|scene|rec)$/.test(p) && !p.startsWith('/System/Disks/') && !p.startsWith('/System/bin/')).map(([p]) => p).sort();
      const mask = h('div', { class: 'dialog-mask', tid: 'dialog' });
      const q = h('input', { class: 'inp', placeholder: '筛选…', style: { width: '100%', marginBottom: '8px' } });
      const list = h('div', { style: { maxHeight: '320px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' } });
      const fill = () => { clear(list); for (const p of all.filter((x) => x.toLowerCase().includes(q.value.toLowerCase())).slice(0, 200)) { const r = h('button', { class: 'btn', style: { justifyContent: 'flex-start' }, text: p, tid: 'editor-open-item', 'data-file-path': p }); r.onclick = () => { mask.remove(); load(p); }; list.append(r); } };
      q.addEventListener('input', fill); q.addEventListener('keydown', (e) => e.stopPropagation()); fill();
      const cancel = h('button', { class: 'btn', text: '取消' }); cancel.onclick = () => mask.remove();
      mask.append(h('div', { class: 'dialog', style: { width: '560px' } }, h('h3', { text: '打开文件' }), q, list, h('div', { class: 'row' }, cancel)));
      desktop.desk.append(mask);
      setTimeout(() => q.focus(), 20);
    }
    if (ctx.args.path) load(ctx.args.path); else { refresh(); print('新建文档。Nest 程序以 .nest 结尾，可点“运行”在根系统中启动。', 'dim'); }
    return {
      el,
      onArgs(a) { if (a && a.path && a.path !== path) guard(() => load(a.path)); },
      onFocus() { if (!el.contains(document.activeElement)) ta.focus({ preventScroll: true }); },
      async onClose() { return guard(() => {}); },
      get path() { return path; },
    };
  },
};
