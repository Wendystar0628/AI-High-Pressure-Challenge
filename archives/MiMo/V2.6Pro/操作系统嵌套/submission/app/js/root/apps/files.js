/* files.js — file manager application */
import { el, fmtBytes } from '../../utils.js';
import { getIcon, iconKindForFile } from '../../host/wallpaper.js';

export class FilesApp {
  constructor(root) {
    this.root = root;
    this.windows = new Set();
  }

  open(params = {}) {
    const startPath = params.path || '/';
    const state = {
      path: startPath,
      selected: new Set(),
      multi: false
    };
    const win = this.root.createWindow({
      appId: 'files',
      title: '文件管理器',
      icon: 'files',
      w: 780, h: 520,
      onClose: () => { this.windows.delete(body); return true; }
    });
    const body = win.body;
    this.windows.add(body);
    this._render(body, state, win);
    return win;
  }

  _render(body, state, win) {
    body.innerHTML = '';
    const app = el('div', { class: 'app-root', 'data-app-id': 'files', 'data-system-id': this.root.id, 'data-window-id': win.id });

    // toolbar
    const toolbar = el('div', { class: 'app-toolbar' });
    const upBtn = el('button', { class: 'btn', text: '↑ 上级', onclick: () => this._nav(state, parentOf(state.path), body, win) });
    const newFileBtn = el('button', {
      class: 'btn', 'data-testid': 'files-new-file', text: '新建文件',
      onclick: () => this._newFile(state, body, win)
    });
    const newFolderBtn = el('button', {
      class: 'btn', 'data-testid': 'files-new-folder', text: '新建文件夹',
      onclick: () => this._newFolder(state, body, win)
    });
    const openBtn = el('button', {
      class: 'btn', 'data-testid': 'files-open', text: '打开',
      onclick: () => this._openSelected(state, body, win)
    });
    const copyBtn = el('button', {
      class: 'btn', 'data-testid': 'files-copy', text: '复制',
      onclick: () => this._copySelected(state)
    });
    const pasteBtn = el('button', {
      class: 'btn', 'data-testid': 'files-paste', text: '粘贴',
      onclick: () => this._paste(state, body, win)
    });
    const delBtn = el('button', {
      class: 'btn danger', text: '删除',
      onclick: () => this._deleteSelected(state, body, win)
    });
    const breadcrumb = el('div', { class: 'files-breadcrumb', 'data-testid': 'files-path' });
    toolbar.appendChild(upBtn);
    toolbar.appendChild(breadcrumb);
    toolbar.appendChild(el('div', { class: 'sep' }));
    toolbar.appendChild(newFileBtn);
    toolbar.appendChild(newFolderBtn);
    toolbar.appendChild(el('div', { class: 'sep' }));
    toolbar.appendChild(openBtn);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(pasteBtn);
    toolbar.appendChild(delBtn);

    const content = el('div', { class: 'app-content' });
    const list = el('div', { class: 'files-list', 'data-testid': 'files-list' });
    content.appendChild(list);

    const statusbar = el('div', { class: 'app-statusbar' });

    app.appendChild(toolbar);
    app.appendChild(content);
    app.appendChild(statusbar);
    body.appendChild(app);

    state._els = { breadcrumb, list, statusbar, body, win };
    this._refresh(state);
  }

  _refresh(state) {
    const { breadcrumb, list, statusbar } = state._els;
    // breadcrumb
    breadcrumb.innerHTML = '';
    const parts = state.path === '/' ? [] : state.path.split('/').filter(Boolean);
    const rootCrumb = el('div', { class: 'files-crumb', text: '根目录', 'data-file-path': '/', 'data-testid': 'files-nav' });
    rootCrumb.addEventListener('click', () => this._nav(state, '/', state._els.body, state._els.win));
    breadcrumb.appendChild(rootCrumb);
    let acc = '';
    for (const p of parts) {
      acc += '/' + p;
      breadcrumb.appendChild(el('div', { class: 'files-crumb-sep', text: '›' }));
      const c = el('div', { class: 'files-crumb', text: p, 'data-file-path': acc, 'data-testid': 'files-nav' });
      const target = acc;
      c.addEventListener('click', () => this._nav(state, target, state._els.body, state._els.win));
      breadcrumb.appendChild(c);
    }

    // list
    list.innerHTML = '';
    let items = [];
    try { items = this.root.vfs.list(state.path); } catch (e) {
      list.appendChild(el('div', { class: 'files-empty', text: '无法打开目录: ' + e.message }));
      return;
    }
    // recycle bin special
    if (state.path === '/' || state.path === '/Documents' || state.path === '/Demo') {
      // nothing extra
    }
    if (!items.length) {
      list.appendChild(el('div', { class: 'files-empty', text: '此文件夹为空' }));
    }
    for (const f of items) {
      const fullPath = (state.path === '/' ? '' : state.path) + '/' + f.name;
      const row = el('div', {
        class: 'files-item' + (state.selected.has(fullPath) ? ' selected' : ''),
        'data-testid': 'files-item',
        'data-file-path': fullPath
      }, [
        el('div', { class: 'f-icon' }),
        el('div', { class: 'f-name', text: f.name }),
        el('div', { class: 'f-size', text: f.type === 'dir' ? '' : fmtBytes(f.size) }),
        el('div', { class: 'f-type', text: f.type === 'dir' ? '文件夹' : '文件' })
      ]);
      row.querySelector('.f-icon').style.backgroundImage = `url(${getIcon(iconKindForFile(f.name, f.type), 26)})`;
      row.querySelector('.f-icon').style.backgroundSize = 'cover';
      row.addEventListener('click', (e) => {
        if (e.ctrlKey) {
          if (state.selected.has(fullPath)) state.selected.delete(fullPath);
          else state.selected.add(fullPath);
        } else {
          state.selected.clear();
          state.selected.add(fullPath);
        }
        this._refresh(state);
      });
      row.addEventListener('dblclick', () => {
        if (f.type === 'dir') this._nav(state, fullPath, state._els.body, state._els.win);
        else this.root.openFile(fullPath);
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.selected.clear();
        state.selected.add(fullPath);
        this._refresh(state);
        this._showContextMenu(e.clientX, e.clientY, state, fullPath, f);
      });
      list.appendChild(row);
    }

    statusbar.innerHTML = '';
    statusbar.appendChild(el('span', { text: `${items.length} 个项目` }));
    statusbar.appendChild(el('span', { text: `已选 ${state.selected.size} 个` }));
    statusbar.appendChild(el('span', { text: '拖拽文件到子系统窗口可跨层传递' }));
  }

  _nav(state, path, body, win) {
    state.path = path;
    state.selected.clear();
    this._refresh(state);
  }

  _newFile(state, body, win) {
    const name = prompt('文件名', '新建文件.txt');
    if (!name) return;
    const p = (state.path === '/' ? '' : state.path) + '/' + name;
    try {
      this.root.vfs.write(p, '');
      this.root.notify('已创建文件', p);
      this._refresh(state);
    } catch (e) { this.root.toast('创建失败', e.message, 'bad'); }
  }
  _newFolder(state, body, win) {
    const name = prompt('文件夹名', '新建文件夹');
    if (!name) return;
    const p = (state.path === '/' ? '' : state.path) + '/' + name;
    try {
      this.root.vfs.mkdir(p);
      this.root.notify('已创建文件夹', p);
      this._refresh(state);
    } catch (e) { this.root.toast('创建失败', e.message, 'bad'); }
  }
  _openSelected(state, body, win) {
    for (const p of state.selected) this.root.openFile(p);
  }
  _copySelected(state) {
    this.root._fileClipboard = [...state.selected];
    this.root.toast('已复制', `${state.selected.size} 个项目到剪贴板`);
  }
  _paste(state, body, win) {
    if (!this.root._fileClipboard || !this.root._fileClipboard.length) return;
    for (const src of this.root._fileClipboard) {
      const name = src.split('/').pop();
      const dest = (state.path === '/' ? '' : state.path) + '/' + name;
      try {
        if (this.root.vfs.exists(dest)) {
          this.root.dialog({
            title: '文件已存在',
            message: `${name} 已存在，是否覆盖？`,
            buttons: [{ label: '取消', value: false }, { label: '覆盖', value: true, danger: true }]
          }).then(ok => {
            if (ok) {
              this.root.vfs.copy(src, dest);
              this._refresh(state);
            }
          });
        } else {
          this.root.vfs.copy(src, dest);
        }
      } catch (e) { this.root.toast('粘贴失败', e.message, 'bad'); }
    }
    this.root.notify('已粘贴', `${this.root._fileClipboard.length} 个项目`);
    this._refresh(state);
  }
  async _deleteSelected(state, body, win) {
    for (const p of state.selected) {
      try {
        const node = this.root.vfs.delete(p);
        const name = p.split('/').pop();
        this.root.vfs.write('/RecycleBin/' + name, node.type === 'file' ? node.content : undefined, node.type);
        if (node.type === 'dir') {
          // copy children
          for (const k in node.children) {
            this.root.vfs.copy(p + '/' + k, '/RecycleBin/' + name + '/' + k);
          }
        }
      } catch (e) { this.root.toast('删除失败', e.message, 'bad'); }
    }
    this.root.notify('已删除', `${state.selected.size} 个项目移入回收站`);
    state.selected.clear();
    this._refresh(state);
  }

  _showContextMenu(x, y, state, path, file) {
    const menu = el('div', { class: 'menu' });
    const items = [
      { label: '打开', fn: () => file.type === 'dir' ? this._nav(state, path, state._els.body, state._els.win) : this.root.openFile(path) },
      { label: '重命名', fn: () => this._rename(state, path) },
      { label: '复制', fn: () => this._copySelected(state) },
      { sep: true },
      { label: '删除', fn: () => this._deleteSelected(state, state._els.body, state._els.win) }
    ];
    for (const it of items) {
      if (it.sep) { menu.appendChild(el('div', { class: 'menu-sep' })); continue; }
      const mi = el('div', { class: 'menu-item', text: it.label });
      mi.addEventListener('click', () => {
        document.body.querySelectorAll('.menu').forEach(m => m.remove());
        it.fn();
      });
      menu.appendChild(mi);
    }
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.position = 'fixed';
    document.body.appendChild(menu);
    const close = () => { if (menu.parentElement) menu.remove(); };
    setTimeout(() => {
      window.addEventListener('mousedown', close, { once: true });
    }, 10);
  }

  _rename(state, path) {
    const old = path.split('/').pop();
    const name = prompt('新名称', old);
    if (!name || name === old) return;
    const dir = path.slice(0, path.length - old.length - 1) || '/';
    try {
      this.root.vfs.rename(path, (dir === '/' ? '' : dir) + '/' + name);
      this._refresh(state);
    } catch (e) { this.root.toast('重命名失败', e.message, 'bad'); }
  }
}

function parentOf(p) {
  if (p === '/' || !p) return '/';
  const parts = p.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? '/' + parts.join('/') : '/';
}
