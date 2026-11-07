// 操作说明
import { el, esc } from '../../util.js';
import { GUIDE_MD } from '../../seed.js';

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let out = '', inCode = false, code = '', inTable = false, tableRows = [];
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  const flushTable = () => {
    if (!tableRows.length) return;
    const rows = tableRows.filter(r => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r));
    let html = '<table>';
    rows.forEach((r, i) => {
      const cells = r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => inline(c.trim()));
      html += '<tr>' + cells.map(c => i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`).join('') + '</tr>';
    });
    html += '</table>';
    out += html; tableRows = [];
  };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushTable();
      if (!inCode) { inCode = true; code = ''; }
      else { out += '<pre>' + esc(code) + '</pre>'; inCode = false; }
      continue;
    }
    if (inCode) { code += line + '\n'; continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) { tableRows.push(line); inTable = true; continue; }
    else if (inTable) { flushTable(); inTable = false; }
    if (!line.trim()) { out += ''; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) { out += `<ul><li>${inline(li[1])}</li></ul>`; continue; }
    const num = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (num) { out += `<ul><li>${inline(num[1])}</li></ul>`; continue; }
    out += `<p>${inline(line)}</p>`;
  }
  if (inCode) out += '<pre>' + esc(code) + '</pre>';
  flushTable();
  return out;
}

export function mount(ctx) {
  const { sys, body, win } = ctx;
  const root = el('div', { class: 'guide' });
  const bar = el('div', { class: 'app-toolbar' },
    el('span', { style: { fontWeight: 600, fontSize: '12.5px' }, text: '操作说明' }),
    el('span', { class: 'files-toolbar-path', text: sys.isRoot ? '/Documents/操作说明.md' : '/Documents/操作说明.md' }),
    el('span', { class: 'spacer' }),
    el('span', { class: 'pill info', text: '简体中文' })
  );
  const content = el('div', { class: 'guide-body' });
  const raw = (sys.files['/Documents/操作说明.md'] || {}).content || GUIDE_MD;
  content.innerHTML = mdToHtml(raw);
  root.append(bar, content);
  body.append(root);
  return { destroy() { } };
}
