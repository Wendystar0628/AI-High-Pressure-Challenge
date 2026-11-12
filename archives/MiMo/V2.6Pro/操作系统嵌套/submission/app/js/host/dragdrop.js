/* dragdrop.js — cross-layer file drag & drop between file managers */
import { el } from '../utils.js';

export function enableFileDragDrop(root) {
  // Track drag operations originating from file items
  let dragData = null;

  document.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.files-item, .desktop-icon[data-file-path]');
    if (!item) return;
    const path = item.getAttribute('data-file-path');
    if (!path) return;
    // potential drag start
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    let ghost = null;

    const onMove = (ev) => {
      if (!dragging && (Math.abs(ev.clientX - startX) > 6 || Math.abs(ev.clientY - startY) > 6)) {
        dragging = true;
        dragData = { path, fromSystem: item.getAttribute('data-system-id') || 'outer' };
        ghost = el('div', {
          style: `position:fixed;z-index:999999;pointer-events:none;background:var(--panel-2);
                  padding:6px 12px;border-radius:6px;font-size:11px;border:1px solid var(--accent);
                  box-shadow:var(--window-shadow)`
        }, [document.createTextNode('📄 ' + path.split('/').pop())]);
        document.body.appendChild(ghost);
      }
      if (dragging && ghost) {
        ghost.style.left = (ev.clientX + 12) + 'px';
        ghost.style.top = (ev.clientY + 12) + 'px';
        // highlight drop targets
        document.querySelectorAll('.files-list, .display-host').forEach(t => {
          const r = t.getBoundingClientRect();
          const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
          t.style.outline = inside ? '2px dashed var(--accent)' : '';
        });
      }
    };

    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (ghost) ghost.remove();
      document.querySelectorAll('.files-list, .display-host').forEach(t => t.style.outline = '');
      if (!dragging || !dragData) return;

      // find drop target
      const dropList = ev.target.closest('.files-list');
      const dropSys = ev.target.closest('[data-system-id]');
      if (dropList && dragData) {
        // get target path from the file manager state (via DOM breadcrumb)
        const win = ev.target.closest('.app-window');
        if (win) {
          const crumb = win.querySelector('.files-crumb:last-child');
          const targetDir = crumb ? (crumb.getAttribute('data-file-path') || '/') : '/';
          const fileName = dragData.path.split('/').pop();
          const dest = (targetDir === '/' ? '' : targetDir) + '/' + fileName;
          if (dest !== dragData.path) {
            performTransfer(root, dragData.path, dest, dragData.fromSystem, 'outer');
          }
        }
      } else if (dropSys) {
        const targetSysId = dropSys.getAttribute('data-system-id');
        if (targetSysId && targetSysId !== dragData.fromSystem && dragData) {
          // dropping onto a subsystem window
          const fileName = dragData.path.split('/').pop();
          performTransfer(root, dragData.path, '/Documents/' + fileName, dragData.fromSystem, targetSysId);
        }
      }
      dragData = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function performTransfer(root, srcPath, destPath, fromSysId, toSysId) {
  try {
    let content;
    if (fromSysId === 'outer') {
      content = root.vfs.read(srcPath);
    } else {
      const sub = root.subsystems.get(fromSysId);
      if (!sub) throw new Error('源系统不存在');
      content = sub.vfs.read(srcPath);
    }

    if (toSysId === 'outer') {
      if (root.vfs.exists(destPath)) {
        root.dialog({
          title: '文件已存在',
          message: `${destPath} 已存在，是否覆盖？`,
          buttons: [{ label: '取消', value: false }, { label: '覆盖', value: true, danger: true }]
        }).then(ok => {
          if (ok) {
            root.vfs.write(destPath, content);
            root.notify('文件已传入', destPath);
            root._refreshIcons();
          }
        });
      } else {
        root.vfs.write(destPath, content);
        root.notify('文件已传入', destPath);
        root._refreshIcons();
      }
    } else {
      const sub = root.subsystems.get(toSysId);
      if (!sub) throw new Error('目标系统不存在');
      if (sub.vfs.exists(destPath)) {
        root.dialog({
          title: '文件已存在',
          message: `${toSysId}:${destPath} 已存在，是否覆盖？`,
          buttons: [{ label: '取消', value: false }, { label: '覆盖', value: true, danger: true }]
        }).then(ok => {
          if (ok) {
            sub.vfs.write(destPath, content);
            root.notify('文件已传入子系统', `${toSysId} → ${destPath}`);
          }
        });
      } else {
        sub.vfs.write(destPath, content);
        root.notify('文件已传入子系统', `${toSysId} → ${destPath}`);
      }
    }
  } catch (e) {
    root.toast('传输失败', e.message, 'bad');
  }
}
