// 文本与程序编辑器：打开/保存巢语程序、运行并查看输出、编辑内核与飞控
import * as M from '../../model.js';
import { el, pathBase, pathExt } from '../../util.js';
import { ui as glyph } from '../../icons.js';
import { promptValue, confirmDialog, chooseFromList, toast, confirmSave } from '../common.js';
import { changed } from '../../store.js';
import { createRunner, stopRunner } from '../../program-runner.js';
import { spawnEditorProgram } from '../../kernel.js';
import { compile } from '../../lang.js';
import { invalidateScene } from '../../services.js';

const STARTER = `# 新建巢语程序
# 支持 let / if / while / for / fn / 数组 / 对象 / sys 服务
let n = 12
let sum = 0
for (let i = 1; i <= n; i = i + 1) {
  sum = sum + i
}
print("1..", n, " 的和 =", sum)
`;

function collectFiles(sys, dir, out = []) {
  for (const f of M.fsList(sys, dir)) {
    if (f.type === 'dir') collectFiles(sys, f.path, out);
    else {
      const ext = pathExt(f.name);
      if (['nest', 'txt', 'md', 'json', 'log', 'cfg'].includes(ext)) out.push(f.path);
    }
  }
  return out;
}

export function mount(ctx) {
  const { sys, win, body, ui, view } = ctx;
  let st = sys.apps.editors[win.id];
  if (!st) {
    let path = win.payload && win.payload.path || null;
    let content = STARTER;
    if (path) {
      const c = M.fsRead(sys, path);
      if (c != null) content = c;
      else path = null;
    }
    st = { path, content, dirty: false, name: path ? pathBase(path) : '未命名.nest', runnerId: null, logs: [] };
    sys.apps.editors[win.id] = st;
  }
  if (st.path) ctx.setTitle(pathBase(st.path), st.path);
  const root = el('div', { class: 'editor' });
  const bar = el('div', { class: 'editor-bar' });
  const filename = el('input', { class: 'editor-filename', dataset: { testid: 'editor-filename' }, 'aria-label': '文件路径', spellcheck: 'false' });
  filename.value = st.path || '';
  const btnOpen = el('button', { class: 'btn sm', dataset: { testid: 'editor-open' }, text: '打开' });
  const btnSave = el('button', { class: 'btn sm primary', dataset: { testid: 'editor-save' }, text: '保存' });
  const btnRun = el('button', { class: 'btn sm', dataset: { testid: 'editor-run' }, text: '▶ 运行' });
  const btnCheck = el('button', { class: 'btn sm ghost', dataset: { testid: 'editor-check' }, text: '校验' });
  bar.append(filename, btnOpen, btnSave, btnRun, btnCheck);
  const main = el('div', { class: 'editor-main' });
  const gutter = el('div', { class: 'editor-gutter' });
  const ta = el('textarea', { class: 'editor-text', spellcheck: 'false', dataset: { testid: 'editor-text' }, 'aria-label': '程序或文本内容' });
  ta.value = st.content;
  main.append(gutter, ta);
  const cons = el('div', { class: 'editor-console' });
  const status = el('div', { class: 'statusbar' });
  root.append(bar, main, cons, status);
  body.append(root);

  const refreshGutter = () => {
    const lines = ta.value.split('\n').length;
    gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    status.innerHTML = '';
    status.append(
      el('span', { text: st.path || '未保存' }),
      el('span', { text: `${lines} 行` }),
      el('span', { text: st.dirty ? '● 未保存' : '已保存' }),
      el('span', { class: 'spacer', style: { flex: 1 } }),
      el('span', { text: '巢语 · NestLang' }),
      el('button', { class: 'btn sm ghost', text: '清空控制台', onclick: () => { cons.innerHTML = ''; st.logs = []; } })
    );
  };
  function setDirty(d) {
    st.dirty = d;
    ctx.setTitle((d ? '● ' : '') + (st.path ? pathBase(st.path) : (st.name || '未命名.nest')), st.path || '未保存');
    refreshGutter();
  }
  ta.addEventListener('input', () => { st.content = ta.value; st.dirty = true; setDirty(true); });
  ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
  ta.addEventListener('copy', () => {
    if (!sys.isRoot) return;
    const text = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if (!text) return;
    sys.widgets.clipboard = sys.widgets.clipboard || [];
    sys.widgets.clipboard.unshift({ text, time: sys.clock, source: st.path ? pathBase(st.path) : '编辑器' });
    if (sys.widgets.clipboard.length > 40) sys.widgets.clipboard.length = 40;
    changed('clipboard');
  });
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); save(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
      st.content = ta.value; st.dirty = true; setDirty(true);
    }
    e.stopPropagation();
  });
  filename.addEventListener('change', () => {
    st.path = filename.value.trim() || null;
    ctx.setTitle((st.dirty ? '● ' : '') + (st.path ? pathBase(st.path) : '未命名.nest'), st.path || '');
    refreshGutter();
  });
  filename.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') filename.blur(); });

  async function save() {
    if (!st.path) {
      const p = await promptValue(sys, '保存程序', '目标路径（示例 /System/programs/my.nest）', '/System/programs/my-program.nest');
      if (!p) return false;
      st.path = p;
      filename.value = p;
    }
    const r = M.fsWrite(sys, st.path, ta.value, pathExt(st.path) === 'nest' ? 'text/x-nestlang' : 'text/plain');
    if (!r.ok) { toast('保存失败', r.error, 'err', sys); return false; }
    st.content = ta.value;
    st.dirty = false;
    setDirty(false);
    M.chargeWork(sys, 'editor', 120 + ta.value.length / 6);
    if (st.path.includes('/System/subsystems/') && st.path.endsWith('kernel.nest')) {
      const id = st.path.split('/System/subsystems/')[1].split('/')[0];
      toast('内核已保存', `重启 ${id} 后生效；语法错误会让该子系统显示内核错误。`, 'warn', sys);
    } else if (pathExt(st.path) === 'nest') {
      toast('已保存程序', st.path, 'ok', sys);
    } else {
      toast('已保存', st.path, 'ok', sys);
    }
    invalidateScene(st.path);
    changed('editor-save');
    return true;
  }

  btnSave.addEventListener('click', save);
  btnOpen.addEventListener('click', async () => {
    const files = collectFiles(sys, '/').sort();
    const item = await chooseFromList(sys, {
      title: '打开文件', items: files.map(f => ({ label: f, path: f, icon: '' })), emptyText: '没有可编辑的文本文件'
    });
    if (!item) return;
    if (st.dirty) {
      const choice = await confirmSave(sys, '当前内容未保存', '打开其他文件前要保存当前内容吗？');
      if (choice === 'cancel') return;
      if (choice === 'save') await save();
    }
    const c = M.fsRead(sys, item.path);
    if (c == null) { toast('打开失败', '文件不存在', 'err', sys); return; }
    st.path = item.path; st.content = c; st.dirty = false;
    filename.value = item.path; ta.value = c;
    setDirty(false);
    ctx.setTitle(pathBase(item.path), item.path);
  });
  btnRun.addEventListener('click', () => {
    const name = (st.path ? pathBase(st.path).replace(/\.[^.]+$/, '') : '未命名程序') || '程序';
    if (st.path && st.path.endsWith('kernel.nest')) {
      const c = compile(ta.value);
      openConsole();
      appendLog(c.ok ? '✔ 内核语法校验通过。重启对应子系统后按新内核运行。' : '✘ 内核语法错误：' + c.error, !c.ok);
      return;
    }
    openConsole();
    if (!sys.isRoot) {
      // 子系统中由内核调度这个程序，预算与暂停由系统树实际控制
      const r = spawnEditorProgram(sys, ta.value, st.path || `/System/programs/${name}.nest`, name, (text) => appendLog(text));
      if (!r.ok) appendLog('启动失败：' + r.error, true);
      else appendLog(`内核已启动进程 ${r.pid}（${r.instructions} 条指令），由本系统调度器执行。`);
      return;
    }
    const runner = createRunner({
      sysId: sys.id, source: ta.value, name, path: st.path || '',
      onLog: (text) => appendLog(text)
    });
    if (runner) {
      st.runnerId = runner.id;
      appendLog(`进程 ${runner.pid} 已启动，按编辑器中的代码执行；输出与服务调用会计入本系统预算。`);
    }
  });
  btnCheck.addEventListener('click', () => {
    const c = compile(ta.value);
    openConsole();
    appendLog(c.ok ? `✔ 编译通过：${c.compiled.code.length} 条指令、${Object.keys(c.compiled.funcs).length} 个函数。` : '✘ ' + c.error, !c.ok);
  });
  function openConsole() { cons.classList.add('open'); }
  function appendLog(text, isErr) {
    const line = el('div', { class: 'log-line' + (isErr ? ' err' : ''), text });
    cons.append(line);
    cons.scrollTop = cons.scrollHeight;
    st.logs.push(text);
    if (st.logs.length > 300) { st.logs.shift(); cons.firstChild?.remove(); }
  }
  // 恢复已有日志
  if (st.logs && st.logs.length) { openConsole(); for (const l of st.logs) cons.append(el('div', { class: 'log-line', text: l })); }

  refreshGutter();
  if (st.dirty) setDirty(true);
  return {
    destroy() { },
    async requestClose() {
      if (!st.dirty) return true;
      const choice = await confirmSave(sys, '未保存的程序', '程序内容已修改但尚未保存。', true);
      if (choice === 'cancel') return false;
      if (choice === 'save') { const ok = await save(); return ok; }
      return true;
    }
  };
}
