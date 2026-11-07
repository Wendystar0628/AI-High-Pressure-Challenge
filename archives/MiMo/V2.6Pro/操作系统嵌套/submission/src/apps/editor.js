// 文本与程序编辑器: 新建/编辑/保存/运行程序, 打开内核源文件
import { el, escapeHtml } from '../core/util.js';

export function launchEditor(ctx, arg = {}) {
  const { wm, fs, shell, bus, systemManager } = ctx;

  let path = arg.path || null;
  let text = path ? (fs.readFile(path) ?? '') : (arg.text ?? '');
  let dirty = false;

  const win = wm.create({
    appId: 'editor',
    title: (path ? path.split('/').pop() : '未命名') + ' — 编辑器',
    icon: '📝',
    x: 140, y: 80, w: 780, h: 520,
    minWidth: 420, minHeight: 280,
    meta: { path },
    bodyBuilder(body) {
      body.innerHTML = `
        <div class="editor-app">
          <div class="editor-toolbar">
            <input data-testid="editor-filename" style="width:180px;height:28px;"
                   value="${escapeHtml(path || '未命名.prog')}" />
            <button data-testid="editor-new">新建</button>
            <button class="primary" data-testid="editor-save">保存</button>
            <button data-testid="editor-open">打开</button>
            <button data-testid="editor-run">▶ 运行程序</button>
            <button data-testid="editor-stop">■ 停止</button>
            <span class="status-chip" data-testid="editor-dirty" style="display:none;">
              <span class="dot" style="background:var(--warn)"></span>未保存</span>
          </div>
          <textarea class="editor-text" data-testid="editor-text" spellcheck="false"></textarea>
          <div class="editor-status" data-testid="editor-status">
            ${path ? '路径: ' + escapeHtml(path) : '新建文件'} · KS 程序语言
          </div>
        </div>`;
      const ta = body.querySelector('[data-testid="editor-text"]');
      const nameEl = body.querySelector('[data-testid="editor-filename"]');
      const statusEl = body.querySelector('[data-testid="editor-status"]');
      const dirtyEl = body.querySelector('[data-testid="editor-dirty"]');
      ta.value = text;

      function setDirty(v) {
        dirty = v;
        dirtyEl.style.display = v ? '' : 'none';
      }
      ta.addEventListener('input', () => {
        text = ta.value;
        setDirty(true);
      });

      function doSave() {
        let p = path;
        if (!p) {
          const n = nameEl.value || '未命名.prog';
          p = (n.startsWith('/') ? n : '/Documents/' + n);
        }
        fs.writeFile(p, ta.value, { kind: 'prog' });
        path = p;
        win.meta.path = p;
        text = ta.value;
        setDirty(false);
        wm.setTitle(win.id, p.split('/').pop() + ' — 编辑器');
        statusEl.textContent = '已保存: ' + p;
        shell.notify('已保存', p, 'ok');
      }

      body.querySelector('[data-testid="editor-save"]').addEventListener('click', doSave);
      body.querySelector('[data-testid="editor-new"]').addEventListener('click', () => {
        path = null;
        text = '';
        ta.value = '';
        nameEl.value = '未命名.prog';
        wm.setTitle(win.id, '未命名 — 编辑器');
        setDirty(false);
      });
      body.querySelector('[data-testid="editor-open"]').addEventListener('click', () => {
        const p = prompt('输入文件路径', path || '/Programs/accumulate.prog');
        if (!p) return;
        const t = fs.readFile(p);
        if (t == null) {
          shell.notify('打开失败', '文件不存在: ' + p, 'err');
          return;
        }
        path = p;
        text = t;
        ta.value = t;
        nameEl.value = p.split('/').pop();
        wm.setTitle(win.id, p.split('/').pop() + ' — 编辑器');
        statusEl.textContent = '路径: ' + p;
        setDirty(false);
      });

      body.querySelector('[data-testid="editor-run"]').addEventListener('click', () => {
        if (dirty) doSave();
        if (!path) {
          shell.notify('无法运行', '请先保存程序文件', 'err');
          return;
        }
        if (!systemManager) {
          shell.notify('无法运行', '系统尚未就绪', 'err');
          return;
        }
        const r = systemManager.runProgramFromEditor(path);
        if (r && r.ok) {
          shell.notify('程序已启动', `进程 #${r.pid} 运行 ${path}`, 'ok');
          statusEl.textContent = `运行中: 进程 #${r.pid} · ${path}`;
        } else {
          shell.notify('运行失败', (r && r.error) || '未知错误', 'err');
        }
      });
      body.querySelector('[data-testid="editor-stop"]').addEventListener('click', () => {
        if (systemManager) systemManager.stopEditorPrograms();
        shell.notify('已停止', '编辑器启动的进程已结束', 'info');
      });

      win.setFile = (p, t) => {
        path = p; text = t;
        ta.value = t;
        nameEl.value = p.split('/').pop();
        wm.setTitle(win.id, p.split('/').pop() + ' — 编辑器');
        statusEl.textContent = '路径: ' + p;
        setDirty(false);
      };
    },
  });
  return win;
}
