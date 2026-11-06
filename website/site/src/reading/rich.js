// Rich text for the reading pages: inline markup, formulas (TeX to MathML in
// tex.js), and the block renderer (format: content.js).
import { h, esc, links, fromHTML } from '../core/index.js';
import { tex, texSymbol } from './tex.js';

export const REPO = 'https://github.com/Wendystar0628/AI-High-Pressure-Challenge';
const repoPath = (path) => String(path).split('/').map(encodeURIComponent).join('/');
/** A file of the repository on GitHub (path as in tasks.json `statement`). */
export const repoFile = (path) => `${REPO}/blob/main/${repoPath(path)}`;
/** A folder of the repository on GitHub. */
export const repoDir = (path) => `${REPO}/tree/main/${repoPath(path)}`;

/** "about:#format-8", "task:reason/luban", "cat:reason", "gh:path", "#x", URL -> { href, ext } */
export function resolveHref(raw) {
  const s = String(raw);
  if (/^https?:/.test(s)) return { href: s, ext: true };
  const i = s.indexOf(':');
  const kind = i > 0 ? s.slice(0, i) : '';
  const rest = i > 0 ? s.slice(i + 1) : s;
  switch (kind) {
    case 'about':
      return { href: links.about(rest.replace(/^#/, '')) };
    case 'task':
      return { href: links.task(rest) };
    case 'cat':
      return { href: links.categories(rest) };
    case 'tasks':
      return { href: links.tasks(rest.replace(/^#/, '')) };
    case 'lb':
      return { href: links.leaderboard() };
    case 'gh':
      return { href: rest ? repoFile(rest) : REPO, ext: true };
    default:
      return { href: s };
  }
}

// ---------- inline ----------

const RE = /\$([^$]+)\$|`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
const plain = (s) => esc(s).replace(/\n/g, '<br>');

function parse(s) {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(RE)) {
    out += plain(s.slice(last, m.index));
    if (m[1] != null) out += tex(m[1]);
    else if (m[2] != null) out += `<code>${esc(m[2])}</code>`;
    else if (m[3] != null) out += `<strong>${parse(m[3])}</strong>`;
    else {
      const { href, ext } = resolveHref(m[5]);
      out += `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${parse(m[4])}</a>`;
    }
    last = m.index + m[0].length;
  }
  return out + plain(s.slice(last));
}

/** Fill {name} placeholders that vars knows; others stay. */
export function fill(s, vars) {
  if (!vars) return String(s ?? '');
  return String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Inline markup to an HTML string. */
export function inlineHTML(s, vars) {
  return parse(fill(s, vars));
}

/** Inline markup into an element: inline('p.x', '**a**：b', vars) */
export function inline(tag, s, vars) {
  const el = h(tag);
  el.innerHTML = inlineHTML(s, vars);
  return el;
}

/** Plain text of inline markup (for aria labels and readouts). */
export function plainText(s, vars) {
  return fill(s, vars)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\$([^$]+)\$/g, (m, x) => x.replace(/\\[a-zA-Z]+/g, (c) => texSymbol(c.slice(1))).replace(/[{}_^]/g, ''));
}

/** A deliverable with its file names set in code type: "answer.md：30 个点的坐标". */
export function deliverableHTML(s) {
  const src = String(s ?? '');
  const re = /[^\s，：,；;（(]+\.(?:lean|md|json|cu|cpp|html|py)(?:–[^\s，：,；;]+\.(?:lean|md|json|cu|cpp|html|py))?/g;
  let out = '';
  let last = 0;
  for (const m of src.matchAll(re)) {
    out += esc(src.slice(last, m.index)) + `<code>${esc(m[0])}</code>`;
    last = m.index + m[0].length;
  }
  return out + esc(src.slice(last));
}

/** A display formula block: centred in the reading column. */
export function mathBlock(src, vars) {
  const box = h('div.rd-math', { role: 'math' });
  box.innerHTML = tex(fill(src, vars), true);
  return box;
}

// ---------- blocks ----------

function cell(tag, v, vars, cls) {
  const el = h(tag, { class: cls || null });
  const parts = Array.isArray(v) ? v : [v];
  for (const p of parts) {
    const s = String(p ?? '');
    if (s.startsWith('> ')) el.append(inline('span.rd-cellquote.st-read', s.slice(2), vars));
    else if (parts.length > 1) el.append(inline('span.rd-cellline', s, vars));
    else el.innerHTML = inlineHTML(s, vars);
  }
  return el;
}

/** A data table (.st-table). spec: { head, rows, num: [col] | 'rest', bold0, rowhead, cls, colgroup } */
export function table(spec, vars) {
  const numSet = new Set(spec.num === 'rest' ? (spec.head ?? spec.rows[0]).map((_, i) => i).slice(1) : spec.num ?? []);
  const t = h('table.st-table.rd-table', { class: spec.cls || null });
  if (spec.head) {
    t.append(h('thead', h('tr', spec.head.map((x, i) => cell('th', x, vars, numSet.has(i) ? 'num' : null)))));
  }
  t.append(
    h(
      'tbody',
      spec.rows.map((r) =>
        h(
          'tr',
          r.map((x, i) => {
            const cls = [numSet.has(i) ? 'num' : '', i === 0 && spec.bold0 ? 'rd-b' : ''].filter(Boolean).join(' ');
            return cell(i === 0 && spec.rowhead ? 'th' : 'td', x, vars, cls);
          }),
        ),
      ),
    ),
  );
  return h('div.st-table-wrap.rd-wide', t);
}

/**
 * A list: items are inline strings, or { text, blocks } for an item with more
 * blocks under its first line (ctx renders those). start: an ordered list's first number.
 */
export function list(items, vars, { ordered = false, cls = '', start = null, ctx = { vars } } = {}) {
  const item = (x) => {
    if (typeof x === 'string' || x == null) return inline('li', x, vars);
    const li = inline('li', x.text ?? '', vars);
    li.append(...blocks(x.blocks, ctx));
    return li;
  };
  return h(`${ordered ? 'ol' : 'ul'}.rd-list.st-read`, { class: cls || null, start: ordered && start > 1 ? start : null }, items.map(item));
}

/** A code block as written (the Lean, C++ and JSON of the statements); lang shows as a small label. */
export function codeBlock(text, lang) {
  return h(
    'figure.rd-code',
    lang ? h('figcaption.rd-code-lang', lang) : null,
    h('pre', { tabindex: '0' }, h('code', { 'data-lang': lang || null }, String(text ?? ''))),
  );
}

/** Definition rows: bold short label on the left, one sentence on the right. */
export function defs(rows, vars) {
  return h(
    'dl.rd-defs',
    rows.map(([k, v]) => h('div.rd-def', inline('dt', k, vars), inline('dd.st-read', v, vars))),
  );
}

/**
 * A fold: <details> with a ruled summary line and a small "展开 / 收起" block.
 * Opening steps the content in row by row.
 */
export function fold(title, content, { open = false, labels = ['展开', '收起'], vars } = {}) {
  const btn = h('span.st-btn.small.rd-fold-btn', { 'aria-hidden': 'true' }, h('span.rd-fold-open', labels[0]), h('span.rd-fold-close', labels[1]));
  const sum = h('summary.rd-fold-sum', inline('span.rd-fold-title', title, vars), btn);
  const body = h('div.rd-fold-body', content);
  const d = h('details.rd-fold', { open }, sum, body);
  d.addEventListener('toggle', () => {
    if (!d.open) return;
    [...body.children].forEach((el, i) => {
      el.classList.remove('st-in-come');
      void el.offsetWidth;
      el.style.setProperty('--i', Math.min(i, 8));
      el.classList.add('st-in-come');
      el.addEventListener('animationend', () => el.classList.remove('st-in-come'), { once: true });
    });
  });
  return d;
}

/**
 * Render a list of blocks to nodes.
 * ctx: { vars, fig(key) -> node, slot(name) -> node, labels: [open, close] }
 */
export function blocks(list_, ctx = {}) {
  const { vars } = ctx;
  const out = [];
  for (const b of list_ ?? []) {
    if (b == null) continue;
    if (typeof b === 'string') {
      out.push(inline('p.rd-p.st-read', b, vars));
      continue;
    }
    if (b.p) out.push(inline('p.rd-p.st-read', b.p, vars));
    else if (b.ul) out.push(list(b.ul, vars, { ctx }));
    else if (b.ol) out.push(list(b.ol, vars, { ordered: true, start: b.start, ctx }));
    else if (b.code != null) out.push(codeBlock(b.code, b.lang));
    else if (b.table) out.push(table(b.table, vars));
    else if (b.quote) out.push(inline('blockquote.rd-quote.st-read', b.quote, vars));
    else if (b.math) out.push(mathBlock(b.math, vars));
    else if (b.defs) out.push(defs(b.defs, vars));
    else if (b.details) out.push(fold(b.details.title, blocks(b.details.blocks, ctx), { labels: ctx.labels, vars }));
    else if (b.fig) {
      const f = ctx.fig?.(b.fig);
      if (f) out.push(f);
    } else if (b.slot) {
      const s = ctx.slot?.(b.slot);
      if (s) out.push(s);
    } else if (b.html) out.push(fromHTML(b.html));
  }
  return out;
}
