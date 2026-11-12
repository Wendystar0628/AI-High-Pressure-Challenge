import { appIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc } from '../ui/common.js';
import * as FS from '../core/fs.js';
import { HELP_MD } from '../core/seed.js';

export const meta = {
  title: '操作说明', desc: '程序格式、内核、预算与投送', width: 980, height: 700,
  minW: 620, minH: 420,
};

function renderMarkdown(md) {
  const lines = String(md).split(/\r?\n/);
  let html = '';
  let inCode = false, code = [], inList = false;
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { html += `<pre class="help-code">${esc(code.join('\n'))}</pre>`; code = []; inCode = false; }
      else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (!line.trim()) { closeList(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lv = h[1].length;
      html += `<h${lv} class="help-h help-h${lv}" id="h-${encodeURIComponent(h[2]).replace(/%/g, '')}">${inline(h[2])}</h${lv}>`;
      continue;
    }
    if (/^-\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.replace(/^-\s+/, ''))}</li>`;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (!inList) { html += '<ul class="numbered">'; inList = true; }
      html += `<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  if (inCode) html += `<pre class="help-code">${esc(code.join('\n'))}</pre>`;
  closeList();
  return html;
}

export function mount(ctx) {
  const { sys, os, body } = ctx;
  let md = HELP_MD;
  const node = FS.resolveNode(sys.fs, '/Documents/操作说明.md');
  if (node && node.type === 'file') md = node.content;
  const html = renderMarkdown(md);
  const headings = [...html.matchAll(/<h2[^>]*id="([^"]+)"[^>]*>(.*?)<\/h2>/g)].map((m) => ({ id: m[1], label: m[2].replace(/<[^>]+>/g, '') }));
  body.innerHTML = `<div class="help-app">
    <aside class="help-side">
      <div class="help-brand">${appIcon('help', { size: 40 })}<div><b>操作说明</b><span>NESTED OS 1.0</span></div></div>
      <div class="help-search"><label>${uiIcon('search')}<input type="text" placeholder="筛选说明…" data-help-search></label></div>
      <nav class="help-toc">${headings.map((h) => `<a href="#${h.id}" data-help-toc="${h.id}">${esc(h.label)}</a>`).join('')}</nav>
      <div class="help-side-foot"><span>程序格式 NPL/1</span><span>逻辑步 0.05 s</span><span>根预算 18,000</span></div>
    </aside>
    <main class="help-main">
      <div class="help-top">
        <div class="help-title"><h1>NESTED OS 操作说明</h1><p>系统内容、程序与内核、预算、三维播放器、数据连接和投送边界。</p></div>
        <div class="help-actions">
          <button type="button" class="small-button" data-open-kernel>${uiIcon('program')} 内核位置</button>
          <button type="button" class="small-button" data-open-systems>${uiIcon('systems')} 系统管理</button>
        </div>
      </div>
      <div class="help-quick">
        <div class="help-quick-card">${uiIcon('shield')}<div><b>内核即程序</b><span>子系统由父系统文件中的 kernel.prog 运行；修改后重启生效。</span></div></div>
        <div class="help-quick-card">${uiIcon('cpu')}<div><b>预算逐级拨付</b><span>每个逻辑步 0.05s；时间速率不增加预算。</span></div></div>
        <div class="help-quick-card">${uiIcon('projection')}<div><b>投送只转发</b><span>应用计算归源系统；外框与窗口操作归目标桌面。</span></div></div>
      </div>
      <article class="help-article">${html}</article>
    </main>
  </div>`;
  const article = $s(body, '.help-article');
  $s(body, '[data-help-search]')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const h of $all(article, '.help-h, p, li, pre')) {
      h.style.display = !q || h.textContent.toLowerCase().includes(q) ? '' : 'none';
    }
  });
  for (const a of $all(body, '[data-help-toc]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = $s(article, '#' + CSS.escape(a.dataset.helpToc));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      for (const x of $all(body, '[data-help-toc]')) x.classList.toggle('active', x === a);
    });
  }
  $s(body, '[data-open-kernel]')?.addEventListener('click', () => {
    if (!sys.isRoot) ctx.openApp('editor');
    else ctx.toast('内核文件位于各子系统的父系统中，打开系统管理后可定位。', 'info');
  });
  $s(body, '[data-open-systems]')?.addEventListener('click', () => ctx.openApp('systems'));
  return { inspect() { return { topic: 'help' }; } };
}
