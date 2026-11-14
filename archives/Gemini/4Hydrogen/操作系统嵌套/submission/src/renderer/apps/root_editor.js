// Root System Text & Program Editor
// Edits Root VFS files (/Documents/*, /Demo/*) AND direct child kernels (/Systems/<id>/kernel.ns)

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mountRootEditor({ container, win, hostKernel }) {
  let filePath = win.params?.filePath || '/Documents/notes.txt';
  let content = '';
  let dirty = false;
  let statusMsg = '就绪';

  container.innerHTML = `
    <div class="ns-editor-root">
      <div class="ns-editor-toolbar">
        <input class="os-inp flex-1" data-testid="editor-filename" data-system-id="outer" data-window-id="${esc(win.id)}" />
        <button class="os-btn act-open">打开</button>
        <button class="os-btn act-new">新建</button>
        <button class="os-btn os-btn-accent" data-testid="editor-save" data-system-id="outer" data-window-id="${esc(win.id)}">保存</button>
      </div>
      <textarea class="root-editor-area" spellcheck="false" data-testid="editor-text" data-system-id="outer" data-window-id="${esc(win.id)}"></textarea>
      <div class="ns-editor-footer">
        <span class="ed-status"></span>
        <span class="ed-hint">支持编辑根系统文件与 /Systems/&lt;id&gt;/kernel.ns</span>
      </div>
    </div>
  `;

  const fnInp = container.querySelector('[data-testid="editor-filename"]');
  const ta = container.querySelector('[data-testid="editor-text"]');
  const statusEl = container.querySelector('.ed-status');

  const updateFooter = () => {
    statusEl.textContent = (dirty ? '● 未保存 · ' : '') + statusMsg;
  };

  const openPath = (p) => {
    filePath = p;
    fnInp.value = filePath;
    const rd = hostKernel.rootRead(filePath);
    if (rd.ok) {
      content = rd.content;
      ta.value = content;
      dirty = false;
      statusMsg = `已打开 (${content.length} B)`;
    } else {
      content = '';
      ta.value = '';
      dirty = false;
      statusMsg = '新缓冲区 (未保存)';
    }
    updateFooter();
  };

  ta.addEventListener('input', () => {
    content = ta.value;
    dirty = true;
    updateFooter();
  });

  const saveNow = () => {
    filePath = fnInp.value.trim() || '/Documents/untitled.txt';
    const wr = hostKernel.rootWrite(filePath, ta.value);
    if (wr.ok) {
      content = ta.value;
      dirty = false;
      statusMsg = `已保存至 ${filePath}`;
      updateFooter();
      return true;
    }
    statusMsg = `保存失败: ${wr.error}`;
    updateFooter();
    return false;
  };

  container.querySelector('.act-open').onclick = () => openPath(fnInp.value.trim());
  container.querySelector('.act-new').onclick = () => openPath('/Documents/untitled.txt');
  container.querySelector('[data-testid="editor-save"]').onclick = saveNow;

  openPath(filePath);

  return {
    openPath,
    save: saveNow,
    isDirty: () => dirty,
    confirmMessage: '编辑器有未保存修改，确定放弃并关闭？',
    destroy: () => {}
  };
}
