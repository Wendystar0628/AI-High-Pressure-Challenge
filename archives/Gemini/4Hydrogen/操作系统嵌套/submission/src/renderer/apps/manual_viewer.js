// Root System Built-in Chinese User Manual Viewer
import { MANUAL_SECTIONS } from '../../shared/fixtures/manual_content.js';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(md) {
  const lines = String(md || '').split(/\r?\n/);
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    const fmt = (t) => esc(t)
      .replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:1px 5px;border-radius:4px;color:#7dd3fc;">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2 style="margin:0 0 10px 0;color:#bae6fd;">${fmt(line.slice(3))}</h2>`;
    } else if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 style="margin:14px 0 6px 0;color:#7dd3fc;">${fmt(line.slice(4))}</h3>`;
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul style="margin:6px 0;padding-left:20px;">'; inList = true; }
      html += `<li style="margin:4px 0;">${fmt(line.slice(2))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p style="margin:6px 0;">${fmt(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

export function mountManualViewer({ container }) {
  let activeId = MANUAL_SECTIONS[0]?.id;
  container.innerHTML = `
    <div class="manual-layout">
      <div class="manual-sidebar"></div>
      <div class="manual-content"></div>
    </div>
  `;
  const sideEl = container.querySelector('.manual-sidebar');
  const contentEl = container.querySelector('.manual-content');

  const render = () => {
    sideEl.innerHTML = MANUAL_SECTIONS.map((s) => `
      <button class="manual-nav-btn ${s.id === activeId ? 'active' : ''}" data-sid="${s.id}">${esc(s.title)}</button>
    `).join('');
    const cur = MANUAL_SECTIONS.find((s) => s.id === activeId) || MANUAL_SECTIONS[0];
    contentEl.innerHTML = renderMarkdown(cur.body);
  };

  sideEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.manual-nav-btn');
    if (btn) {
      activeId = btn.dataset.sid;
      render();
    }
  });

  render();
  return { destroy: () => {} };
}
