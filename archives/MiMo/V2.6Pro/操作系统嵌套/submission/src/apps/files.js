// 文件管理器
import { el, fmtBytes, clamp } from '../core/util.js';
import { showContextMenu } from '../desktop/window-manager.js';

export function launchFiles(ctx, arg = {}) {
  const { wm, fs, shell, bus } = ctx;
  let win = wm.list().find(w => w.appId === 'files');
  if (win && arg.path) {
    win.onNav && win.onNav(arg.path);
    wm.focus(win.id);
    return;
  }
  if (win) { wm.focus(win.id); return; }

  let cwd = arg.path || '/Documents';
  let selected = new Set();
  let clipboard = null; // {mode:'copy'|'cut', paths:[]}

  win = wm.create({
    appId: 'files',
    title: '文件管理器',
    icon: '📁',
    x: 90, y: 70, w: 820, h: 540,
    minWidth: 480, minHeight: 320,
    bodyBuilder(body) {
      body.innerHTML = `
        <div class="files-app">
          <div class="files-toolbar">
            <button data-testid="files-up" title="上级目录">↑</button>
            <button data-testid="files-back" title="后退">←</button>
            <input class="files-path" data-testid="files-path" />
            <button data-testid="files-new-file">新建文件</button>
            <button data-testid="files-new-folder">新建文件夹</button>
            <button data-testid="files-copy">复制</button>
            <button data-testid="files-paste">粘贴</button>
            <button data-testid="files-delete">删除</button>
          </div>
          <div class="files-nav" data-testid="files-nav"></div>
          <div class="files-body">
            <div class="files-side">
              <div class="side-item" data-path="/Documents">📄 文档</div>
              <div class="side-item" data-path="/Downloads">⬇ 下载</div>
              <div class="side-item" data-path="/Demo">🎬 示例</div>
              <div class="side-item" data-path="/Programs">💾 程序</div>
              <div class="side-item" data-path="/System">🧬 系统</div>
              <div class="side-item" data-path="/RecycleBin">🗑 回收站</div>
            </div>
            <div class="files-list" data-testid="files-list"></div>
          </div>
          <div class="files-status" data-testid="files-status"></div>
        </div>`;

      const listEl = body.querySelector('.files-list');
      const pathEl = body.querySelector('.files-path');
      const navEl = body.querySelector('.files-nav');
      const statusEl = body.querySelector('.files-status');
      const history = [];
      let histIdx = -1;

      function nav(p, pushHist = true) {
        p = fs.normalize(p);
        const st = fs.stat(p);
        if (st && st.kind !== 'dir') p = p.substring(0, p.lastIndexOf('/') + 1) || '/';
        if (!fs.exists(p)) p = '/';
        cwd = p;
        selected.clear();
        if (pushHist) {
          history.splice(histIdx + 1);
          history.push(p);
          histIdx = history.length - 1;
        }
        render();
      }
      win.onNav = nav;

      function render() {
        pathEl.value = cwd;
        // 面包屑
        navEl.innerHTML = '';
        const parts = cwd.split('/').filter(Boolean);
        const rootCrumb = el('div', { class: 'crumb' + (cwd === '/' ? ' current' : ''), 'data-testid': 'files-nav', text: '根' });
        rootCrumb.addEventListener('click', () => nav('/'));
        navEl.appendChild(rootCrumb);
        let acc = '';
        for (const part of parts) {
          acc += '/' + part;
          const p = acc;
          const c = el('div', {
            class: 'crumb' + (p === cwd ? ' current' : ''),
            'data-testid': 'files-nav', 'data-file-path': p, text: part,
          });
          c.addEventListener('click', () => nav(p));
          navEl.appendChild(c);
        }

        // 列表
        const items = fs.list(cwd);
        listEl.innerHTML = '';
        if (cwd === '/RecycleBin') {
          const b = el('button', { 'data-testid': 'files-empty-recycle', text: '清空回收站', style: 'grid-column:1/-1;' });
          b.addEventListener('click', () => {
            if (confirm('确定清空回收站?')) {
              fs.emptyRecycle();
              shell.notify('回收站已清空', '所有已删除项目已移除', 'ok');
            }
          });
          listEl.appendChild(b);
        }
        for (const it of items) {
          const icon = iconFor(it);
          const d = el('div', {
            class: 'files-item' + (selected.has(it.path) ? ' selected' : ''),
            'data-testid': 'files-item',
            'data-file-path': it.path,
          }, [
            el('div', { class: 'f-ico', text: icon }),
            el('div', { class: 'f-name', text: it.name }),
            el('div', { class: 'f-meta', text: it.kind === 'dir' ? '文件夹' : fmtBytes(it.size) }),
          ]);
          d.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.ctrlKey) {
              if (selected.has(it.path)) selected.delete(it.path);
              else selected.add(it.path);
            } else {
              selected.clear();
              selected.add(it.path);
            }
            render();
          });
          d.addEventListener('dblclick', () => {
            if (cwd === '/RecycleBin') {
              fs.restoreFromRecycle(it.path);
              shell.notify('已还原', it.name + ' 已还原到原位置', 'ok');
              render();
              return;
            }
            if (it.kind === 'dir') nav(it.path);
            else window.__openFileByExt(ctx, it.path);
          });
          d.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selected.clear();
            selected.add(it.path);
            render();
            showContextMenu(e.clientX, e.clientY, [
              { label: '打开', icon: '📂', action: () => {
                if (it.kind === 'dir') nav(it.path);
                else window.__openFileByExt(ctx, it.path);
              }, testid: 'files-open' },
              { label: '复制', icon: '⧉', action: () => { clipboard = { mode: 'copy', paths: [it.path] }; }, testid: 'files-copy' },
              { label: '剪切', icon: '✂', action: () => { clipboard = { mode: 'cut', paths: [it.path] }; } },
              '-',
              { label: '重命名', icon: '✎', action: () => renameItem(it), testid: 'files-rename' },
              { label: '删除', icon: '🗑', action: () => deleteItems([it.path]), testid: 'files-delete' },
            ]);
          });
          listEl.appendChild(d);
        }
        const n = items.length;
        statusEl.textContent = `${n} 个项目${selected.size ? ' · 已选中 ' + selected.size + ' 项' : ''} · 路径 ${cwd}`;
        body.querySelectorAll('.files-side .side-item').forEach(d =>
          d.classList.toggle('active', d.dataset.path === cwd));
      }

      function iconFor(it) {
        if (it.kind === 'dir') return '📁';
        const n = it.name.toLowerCase();
        if (n.endsWith('.sheet')) return '📊';
        if (n.endsWith('.scene')) return '🚁';
        if (n.endsWith('.prog') || n.endsWith('.sys')) return '💾';
        if (n.endsWith('.md') || n.endsWith('.txt')) return '📄';
        if (n.endsWith('.json')) return '🔧';
        return '📃';
      }

      function renameItem(it) {
        const name = prompt('新名称', it.name);
        if (!name || name === it.name) return;
        try {
          fs.rename(it.path, name);
          shell.notify('已重命名', it.name + ' → ' + name, 'ok');
        } catch (e) {
          shell.notify('重命名失败', e.message, 'err');
        }
        render();
      }

      function deleteItems(paths) {
        for (const p of paths) fs.delete(p);
        shell.notify('已删除', `已将 ${paths.length} 个项目移入回收站`, 'ok');
        selected.clear();
        render();
      }

      // 工具栏
      body.querySelector('[data-testid="files-up"]').addEventListener('click', () => {
        const parent = cwd.replace(/[^/]+\/?$/, '') || '/';
        nav(parent);
      });
      body.querySelector('[data-testid="files-back"]').addEventListener('click', () => {
        if (histIdx > 0) {
          histIdx--;
          nav(history[histIdx], false);
        }
      });
      pathEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nav(pathEl.value);
      });
      body.querySelector('[data-testid="files-new-file"]').addEventListener('click', () => {
        const name = prompt('文件名', '新建文件.txt');
        if (!name) return;
        fs.writeFile(cwd + (cwd.endsWith('/') ? '' : '/') + name, '');
        shell.notify('已创建文件', name, 'ok');
        render();
      });
      body.querySelector('[data-testid="files-new-folder"]').addEventListener('click', () => {
        const name = prompt('文件夹名', '新建文件夹');
        if (!name) return;
        fs.mkdir(cwd + (cwd.endsWith('/') ? '' : '/') + name + '/');
        render();
      });
      body.querySelector('[data-testid="files-copy"]').addEventListener('click', () => {
        if (!selected.size) return shell.notify('复制', '请先选择项目', 'err');
        clipboard = { mode: 'copy', paths: [...selected] };
        shell.notify('已复制', `${selected.size} 个项目`, 'ok');
      });
      body.querySelector('[data-testid="files-paste"]').addEventListener('click', () => {
        if (!clipboard) return shell.notify('粘贴', '剪贴板为空', 'err');
        for (const p of clipboard.paths) {
          if (clipboard.mode === 'cut') fs.move(p, cwd);
          else fs.copy(p, cwd);
        }
        if (clipboard.mode === 'cut') clipboard = null;
        shell.notify('已粘贴', '文件已复制到当前目录', 'ok');
        render();
      });
      body.querySelector('[data-testid="files-delete"]').addEventListener('click', () => {
        if (!selected.size) return shell.notify('删除', '请先选择项目', 'err');
        deleteItems([...selected]);
      });

      body.querySelectorAll('.files-side .side-item').forEach(d =>
        d.addEventListener('click', () => nav(d.dataset.path)));

      listEl.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.files-item')) return;
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [
          { label: '新建文件', icon: '📄', action: () => body.querySelector('[data-testid="files-new-file"]').click() },
          { label: '新建文件夹', icon: '📁', action: () => body.querySelector('[data-testid="files-new-folder"]').click() },
          '-',
          { label: '粘贴', icon: '📋', action: () => body.querySelector('[data-testid="files-paste"]').click() },
          { label: '刷新', icon: '⟳', action: render },
        ]);
      });

      nav(cwd);
    },
  });
  return win;
}
