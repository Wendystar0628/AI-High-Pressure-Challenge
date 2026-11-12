// 操作说明查看器：渲染根系统文件 /System/操作说明.md
import { h } from '../ui/dom.js';

function md(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const lines = src.split('\n');
  let out = '', inCode = false, inList = false, inTable = false, toc = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { if (inCode) { out += '</code></pre>'; inCode = false; } else { if (inList) { out += '</ul>'; inList = false; } out += '<pre><code>'; inCode = true; } continue; }
    if (inCode) { out += esc(l) + '\n'; continue; }
    if (/^\|/.test(l)) {
      const cells = l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      if (!inTable) { out += '<table>'; inTable = true; out += '<tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr>'; continue; }
      out += '<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
      continue;
    } else if (inTable) { out += '</table>'; inTable = false; }
    const m = l.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      if (inList) { out += '</ul>'; inList = false; }
      const id = 'h' + i;
      if (m[1].length <= 2) toc.push([m[1].length, m[2], id]);
      out += `<h${m[1].length} id="${id}">${inline(m[2])}</h${m[1].length}>`;
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`; continue; }
    if (inList && l.trim() === '') { out += '</ul>'; inList = false; continue; }
    if (l.trim() === '') continue;
    out += `<p>${inline(l)}</p>`;
  }
  if (inList) out += '</ul>';
  if (inTable) out += '</table>';
  return { html: out, toc };
}

export default {
  id: 'help', name: '操作说明', icon: 'help', single: true, w: 980, h: 680, keywords: 'help 帮助 说明',
  create({ fs, args }) {
    const src = fs.read('/System/操作说明.md') || '# 操作说明\n\n找不到 /System/操作说明.md';
    const { html, toc } = md(src);
    const body = h('div', { class: 'help-body scroll', html, tid: 'help-content' });
    const nav = h('div', { class: 'help-nav scroll' }, toc.map(([lv, t, id]) => {
      const a = h('div', { class: 'help-link lv' + lv, text: t });
      a.addEventListener('click', () => { const el = body.querySelector('#' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      return a;
    }));
    const el = h('div', { class: 'help-app' }, nav, body);
    return { el, onArgs() {} };
  },
};
