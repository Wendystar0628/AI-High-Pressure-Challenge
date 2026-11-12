/* projection.js — cross-layer window projection (2.15).
   Source app keeps computing in its own system; the target desktop hosts
   a projection window that renders submitted data and forwards input. */
import { el } from '../utils.js';

export class ProjectionManager {
  constructor(root) {
    this.root = root;
    this.active = new Map(); // key: sourceWindowId -> { win, sourceSystemId, sourceWindowId, sourceAppId, subs }
  }

  /* project a source window (from any system) onto the root desktop */
  project(sourceSystemId, sourceWindowId, sourceAppId, sourceLabel) {
    const key = sourceSystemId + ':' + sourceWindowId;
    if (this.active.has(key)) {
      const existing = this.active.get(key);
      existing.win.restore();
      existing.win.focus();
      return existing.win;
    }

    const state = {
      sourceSystemId, sourceWindowId, sourceAppId,
      sourceLabel: sourceLabel || sourceAppId
    };

    const win = this.root.createWindow({
      appId: 'projection',
      title: `投送 — ${sourceLabel || sourceAppId}（来自 ${sourceSystemId}）`,
      icon: sourceAppId === 'player' ? 'player' : 'charts',
      w: 960, h: 640,
      isProjection: true,
      projInfo: { sourceSystemId, sourceWindowId, sourceAppId },
      onClose: () => {
        this.active.delete(key);
        if (state.onClose) state.onClose();
        return true;
      },
      onResize: (w, h) => {
        if (state.resize) state.resize(w, h);
      }
    });

    const body = win.body;
    body.innerHTML = '';

    // info bar
    const infoBar = el('div', {
      style: 'padding:6px 12px;background:rgba(245,184,61,0.10);border-bottom:1px solid rgba(245,184,61,0.25);font-size:11px;color:var(--text-dim);display:flex;gap:12px;align-items:center'
    }, [
      el('span', { text: `来源: ${sourceSystemId} · ${sourceLabel || sourceAppId}` }),
      el('span', { text: '投送外框归目标桌面，应用内容归源系统' }),
      el('button', {
        class: 'btn', 'data-testid': 'project-target', 'data-target-system-id': sourceSystemId,
        text: '取消投送', style: 'margin-left:auto;padding:3px 10px;font-size:11px',
        onclick: () => win.close()
      })
    ]);
    body.appendChild(infoBar);

    const contentHost = el('div', {
      style: 'flex:1;position:relative;overflow:hidden;background:#0c1222',
      'data-app-id': 'projection',
      'data-system-id': 'outer',
      'data-window-id': win.id,
      'data-source-system-id': sourceSystemId,
      'data-source-window-id': sourceWindowId,
      'data-source-app-id': sourceAppId
    });
    body.appendChild(contentHost);
    body.style.display = 'flex';
    body.style.flexDirection = 'column';

    state.contentHost = contentHost;
    state.win = win;
    this.active.set(key, state);
    return win;
  }

  /* attach a renderer (e.g. Scene3D) to the projection content host */
  getContentHost(sourceSystemId, sourceWindowId) {
    const key = sourceSystemId + ':' + sourceWindowId;
    const s = this.active.get(key);
    return s ? s.contentHost : null;
  }

  setResize(sourceSystemId, sourceWindowId, fn) {
    const key = sourceSystemId + ':' + sourceWindowId;
    const s = this.active.get(key);
    if (s) s.resize = fn;
  }

  endProjection(sourceSystemId, sourceWindowId) {
    const key = sourceSystemId + ':' + sourceWindowId;
    const s = this.active.get(key);
    if (s) {
      s.win.onClose = null;
      s.win.close();
      this.active.delete(key);
    }
  }

  endAllFromSystem(sourceSystemId) {
    for (const [key, s] of [...this.active]) {
      if (s.sourceSystemId === sourceSystemId) {
        s.win.onClose = null;
        s.win.destroy();
        this.active.delete(key);
      }
    }
  }

  list() {
    return [...this.active.values()].map(s => ({
      windowId: s.win.id,
      systemId: 'outer',
      sourceSystemId: s.sourceSystemId,
      sourceWindowId: s.sourceWindowId,
      sourceAppId: s.sourceAppId,
      state: s.win.state
    }));
  }
}
