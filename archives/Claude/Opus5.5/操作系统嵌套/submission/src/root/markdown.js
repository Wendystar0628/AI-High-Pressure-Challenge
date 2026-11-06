// 操作说明用的小型 Markdown 转换：标题、列表、表格、代码块、行内代码、粗体。
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

export function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  let out = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) {
      let code = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code += lines[i++] + '\n';
      i++;
      out += `<pre><code>${esc(code)}</code></pre>`;
      continue;
    }
    const m = l.match(/^(#{1,4})\s+(.*)$/);
    if (m) { out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue; }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      out += '<table>';
      rows.forEach((r, n) => {
        if (n === 1 && /^[\s|:-]+$/.test(r)) return;
        const tag = n === 0 ? 'th' : 'td';
        out += '<tr>' + cells(r).map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
      });
      out += '</table>';
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      out += ordered ? '<ol>' : '<ul>';
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        out += `<li>${inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`;
        i++;
      }
      out += ordered ? '</ol>' : '</ul>';
      continue;
    }
    if (!l.trim()) { i++; continue; }
    out += `<p>${inline(l)}</p>`;
    i++;
  }
  return out;
}
