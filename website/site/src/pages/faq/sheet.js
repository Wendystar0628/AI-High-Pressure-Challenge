// 导出图片：把猜你想问排到 1920×1080 的画布上，内容多了自动分页，每页一张 PNG。
// 版式照 videos/faq/faq.html（sheet.css）；排版交给浏览器，在屏幕外的画布上逐块放、逐块量：
//
//   - 板块按内容文件的顺序放。半宽的板块（默认）在两栏里依次往下流：先左栏，再右栏，再下一页；
//     整个板块能放进当前栏就整块放；放不下时，整块放得进下一栏（空栏）就挪过去，否则从当前栏起
//     按问答拆开，接着放的那一栏重写板块头，标「（续）」。段落最后一行只剩一个字时和前面几个字一起换行。
//   - 整宽的板块（wide: true）排在两栏下面，问答三张一行、同一行等高；说明块独占一行。
//     一行放不下就换页，板块头同样重写。
//   - 任何一块的下沿都不越过 BOTTOM（页脚在它下面）。一张问答卡比整栏还高时照放并在控制台警告。
//
//   const { sheets, report, destroy } = await layoutSheets(faq, ctx)   排好的画布（调试、检查用）
//   const blobs = await renderSheets(faq, ctx)                       每页一张 PNG Blob
import './sheet.css';
import { h, svg, t, fmtPct } from '../../core/index.js';
import { starPath } from '../../charts/star.js';
import { svgToPNG } from '../../charts/export.js';
import { sheetToSVG, lines } from './sheet-svg.js';
import { rich } from './model.js';

export const SHEET_W = 1920;
export const SHEET_H = 1080;
const BOTTOM = 1000;
// 页眉右侧空白处的四角星点缀（同 faq.html）：[x, y, 尖长, 颜色]
const STARS = [
  [1500, 92, 30, '--v-300'],
  [1580, 150, 16, '--v-500'],
  [1420, 160, 13, '--v-600'],
  [1236, 70, 14, '--v-300'],
];
const no2 = (n) => String(n).padStart(2, '0');

// ---------- pieces ----------

function blocks(list, vars) {
  return list.map((b) => {
    if (b.p) return rich('p.fs-p', b.p, vars);
    if (b.source) return h('div.fs-src', h('span', b.source.label), h('code', b.source.text));
    if (b.ratios) {
      return h(
        'div.fs-ratios',
        { style: { '--n': Math.min(3, b.ratios.length) } },
        b.ratios.map((r) => h('div.fs-ratio', h('span.k', r.label), h('span.v', r.pre ? h('small', r.pre) : null, r.value, r.unit ? h('small', r.unit) : null))),
      );
    }
    if (b.weights) {
      return h(
        'div.fs-w',
        b.weights.caption ? rich('div.fs-sub', b.weights.caption, vars) : null,
        h(
          'div.fs-bar',
          b.weights.parts.map((p) => h('div', { class: `is-${p.kind}`, style: { flexGrow: p.weight } }, h('span.nm', p.label), h('span.pct', fmtPct(p.weight)))),
        ),
      );
    }
    return null;
  });
}

const tagEl = (tag) => (tag ? h('span.fs-tag', { style: { '--tag': tag.fill, '--tag-ink': tag.ink } }, tag.label) : null);

function qaCard(it, vars) {
  return h(
    'article.fs-qa',
    tagEl(it.tag),
    h('div.fs-q', h('span.fs-no', t('faq.qa.no', { n: it.no })), rich('h3', it.q, vars)),
    it.a.length ? h('div.fs-a', blocks(it.a, vars)) : null,
  );
}

function noteCard(it, vars, wide) {
  const side = it.side.length ? h('div.fs-band-side', blocks(it.side, vars)) : null;
  return h(
    'div.fs-band',
    { class: wide && side ? 'has-side' : null },
    h('div.fs-band-main', tagEl(it.tag), it.lead ? rich('div.fs-lead', it.lead, vars) : null, it.a.length ? h('div.fs-ask', blocks(it.a, vars)) : null),
    side,
  );
}

const card = (it, vars, wide = false) => (it.type === 'qa' ? qaCard(it, vars) : noteCard(it, vars, wide));

const secHead = (sec, cont) => h('div.fs-sh', h('h2', cont ? `${sec.title}${t('faq.sheet.cont')}` : sec.title), h('i', { 'aria-hidden': 'true' }));

/** A half-width section (or the part of one that goes into one column). */
function halfSec(sec, items, vars, cont = false) {
  const stack = h('div.fs-stack', items.map((it) => card(it, vars)));
  const el = h('div.fs-sec', secHead(sec, cont), stack);
  return { el, stack };
}

/** Rows of a wide section: up to three questions side by side; a note takes a row of its own. */
function rowsOf(items) {
  const rows = [];
  let run = [];
  for (const it of items) {
    if (it.type === 'qa') {
      run.push(it);
      if (run.length === 3) rows.push(run.splice(0));
    } else {
      if (run.length) rows.push(run.splice(0));
      rows.push([it]);
    }
  }
  if (run.length) rows.push(run);
  return rows;
}

const rowEl = (row, vars) => (row[0].type === 'qa' ? h('div.fs-row', row.map((it) => card(it, vars, true))) : h('div.fs-row.is-band', card(row[0], vars, true)));

function sheetEl() {
  const stars = svg('svg', { class: 'fs-stars', viewBox: `0 0 ${SHEET_W} ${SHEET_H}`, width: SHEET_W, height: SHEET_H, 'aria-hidden': 'true' });
  for (const [x, y, r, c] of STARS) stars.append(svg('path', { d: starPath(x, y, r), style: `fill: var(${c})` }));
  const pager = h('div.fs-pager');
  const footR = h('span.fs-foot-r');
  const body = h('div.fs-body');
  const el = h(
    'section.faq-sheet',
    stars,
    h('header.fs-head', h('div', h('div.fs-eb', h('span.fs-faq', 'FAQ'), h('span.fs-ebt', t('faq.sheet.eyebrow'))), rich('h1.fs-title', t('faq.sheet.title'))), pager),
    body,
    h('footer.fs-foot', h('span', t('faq.sheet.foot')), footR),
  );
  return { el, body, pager, footR };
}

// ---------- a lone last character ----------
// 段落最后一行只剩一个字（或一个英文词）时，把它和前面几个字粘在一起换行（同 faq.html 手排的「也出现过。」）。
const HAN = /\p{Script=Han}/u;
const units = (s) => (s.match(/\p{Script=Han}/gu)?.length ?? 0) + (s.replace(/\p{Script=Han}/gu, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0);

function lastText(el) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last = null;
  while (walk.nextNode()) if (walk.currentNode.data.trim()) last = walk.currentNode;
  return last;
}

function settle(root) {
  // ratio blocks that do not fit on one line stack their label over the figure
  for (const r of root.querySelectorAll('.fs-ratios')) {
    const tops = new Set([...r.children].map((c) => c.offsetTop));
    const wide = [...r.children].some((c) => c.scrollWidth > c.clientWidth + 1);
    if (tops.size > 1 || wide) r.classList.add('is-stacked');
  }
  for (const p of root.querySelectorAll('.fs-p, .fs-lead, .fs-sub')) {
    const node = lastText(p);
    if (!node || node.parentElement.closest('.nb')) continue;
    const last = lines(node).at(-1);
    if (!last) continue;
    const box = p.getBoundingClientRect();
    const left = box.left + parseFloat(getComputedStyle(p).paddingLeft);
    // only when this text starts the last line, below the first line, and the line holds one character or word
    if (last.left > left + 1 || last.top - box.top < 2 || units(last.text) > 1) continue;
    const cps = Array.from(node.data);
    let keep;
    if (HAN.test(last.text)) keep = Array.from(last.text).length + 3;
    else {
      const m = /\S+\s+\S+\s*$/.exec(node.data);
      keep = m ? Array.from(m[0]).length : cps.length;
    }
    if (keep >= cps.length) continue;
    const tail = node.splitText(cps.slice(0, cps.length - keep).join('').length);
    tail.data = tail.data.replace(/ +(?=\S)/g, '\xa0');
    const span = h('span.nb');
    tail.replaceWith(span);
    span.append(tail);
  }
}

async function fontsReady() {
  try {
    await Promise.all(['500 27px Saira', '800 32px Saira', '900 74px Saira'].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch {}
}

// ---------- layout ----------

export async function layoutSheets(faq, { vars } = {}) {
  await fontsReady();
  const stage = h('div.faq-stage', { 'aria-hidden': 'true', inert: true });
  document.body.append(stage);
  const sheets = [];
  const warnings = [];
  let sheet = null;
  let cols = null;
  let col = 0;

  const newSheet = () => {
    sheet = sheetEl();
    stage.append(sheet.el);
    sheets.push(sheet);
    cols = null;
    col = 0;
  };
  const bottomOf = (el) => el.getBoundingClientRect().bottom - sheet.el.getBoundingClientRect().top;
  const fits = (el) => bottomOf(el) <= BOTTOM + 0.5;
  const openCols = () => {
    cols = h('div.fs-block.fs-cols', h('div.fs-col'), h('div.fs-col'));
    sheet.body.append(cols);
    col = 0;
  };
  const column = () => cols.children[col];
  const colEmpty = () => !column().childElementCount;
  // the column starts at the top of the sheet and holds nothing: there is nowhere better to go
  const freshColumn = () => colEmpty() && sheet.body.firstElementChild === cols;
  const nextCol = () => {
    if (col === 0) col = 1;
    else {
      newSheet();
      openCols();
    }
  };
  const warn = (what) => {
    warnings.push(what);
    console.warn(`[faq sheet] ${what}`);
  };

  // the whole section in the current column: true when it fits; otherwise its height
  function tryWhole(sec) {
    const s = halfSec(sec, sec.items, vars);
    column().append(s.el);
    settle(s.el);
    if (fits(s.el)) return true;
    const height = s.el.getBoundingClientRect().height;
    s.el.remove();
    return height;
  }
  const topOf = (el) => el.getBoundingClientRect().top - sheet.el.getBoundingClientRect().top;

  function placeHalf(sec) {
    if (!cols) openCols();
    const height = tryWhole(sec);
    if (height === true) return;
    // the next column is empty: move there when the whole section fits in it, else start splitting here
    if (!colEmpty()) {
      const room = BOTTOM - (col === 0 ? topOf(cols) : topOf(sheet.body));
      if (height <= room) {
        nextCol();
        if (tryWhole(sec) === true) return;
      }
    }
    // card by card, the section head again in every column it continues into
    let placed = 0;
    let cur = null;
    for (const it of sec.items) {
      for (;;) {
        if (!cur) {
          cur = halfSec(sec, [], vars, placed > 0);
          column().append(cur.el);
        }
        const c = card(it, vars);
        cur.stack.append(c);
        settle(c);
        if (fits(c)) break;
        c.remove();
        const alone = !cur.stack.childElementCount;
        if (alone) cur.el.remove();
        if (alone && freshColumn()) {
          column().append(cur.el);
          cur.stack.append(c);
          warn(`「${sec.title}」的 ${it.id} 比一整栏还高`);
          break;
        }
        cur = null;
        nextCol();
      }
      placed++;
    }
  }

  function placeWide(sec) {
    cols = null;
    let blk = null;
    let placed = 0;
    for (const row of rowsOf(sec.items)) {
      for (;;) {
        if (!blk) {
          blk = h('div.fs-block.fs-wide', secHead(sec, placed > 0));
          sheet.body.append(blk);
        }
        const r = rowEl(row, vars);
        blk.append(r);
        settle(r);
        if (fits(r)) break;
        r.remove();
        const alone = blk.childElementCount === 1;
        if (alone) blk.remove();
        if (alone && !sheet.body.childElementCount) {
          sheet.body.append(blk);
          blk.append(r);
          warn(`「${sec.title}」的 ${row.map((x) => x.id).join('、')} 比一整页还高`);
          break;
        }
        blk = null;
        newSheet();
      }
      placed += row.length;
    }
  }

  newSheet();
  for (const sec of faq.sections) {
    if (!sec.items.length) continue;
    if (sec.wide) placeWide(sec);
    else placeHalf(sec);
  }

  // page numbers; what each sheet looks like at the edges (for checks)
  const n = sheets.length;
  const report = sheets.map((s, i) => {
    s.pager.replaceChildren(no2(i + 1), h('span', `/ ${no2(n)}`));
    s.footR.textContent = t('faq.sheet.page', { n: i + 1, of: n });
    const top = s.el.getBoundingClientRect();
    const boxes = [...s.el.querySelectorAll('.fs-qa, .fs-band, .fs-sh')];
    const lowest = Math.max(0, ...boxes.map((b) => b.getBoundingClientRect().bottom - top.top));
    const right = Math.max(0, ...boxes.map((b) => b.getBoundingClientRect().right - top.left));
    // any element whose content is wider or taller than its box
    const spill = [...s.el.querySelectorAll('.fs-body *, .fs-head *')]
      .filter((e) => !(e instanceof SVGElement) && getComputedStyle(e).display !== 'inline' && e.scrollWidth > e.clientWidth + 1)
      .map((e) => e.className || e.tagName);
    const foot = s.el.querySelector('.fs-foot').getBoundingClientRect().top - top.top;
    return { sheet: i + 1, lowest: Math.round(lowest), right: Math.round(right), footTop: Math.round(foot), spill, cards: s.el.querySelectorAll('.fs-qa, .fs-band').length };
  });
  for (const r of report) {
    if (r.lowest > BOTTOM + 0.5 || r.right > SHEET_W - 96 + 0.5) warn(`第 ${r.sheet} 张越界：下沿 ${r.lowest}，右沿 ${r.right}`);
    if (r.spill.length) warn(`第 ${r.sheet} 张有内容溢出：${r.spill.join(', ')}`);
  }
  return { stage, sheets: sheets.map((s) => s.el), report, warnings, destroy: () => stage.remove() };
}

/** The FAQ as PNG blobs, one per sheet (1920×1080, light). */
export async function renderSheets(faq, ctx) {
  const lay = await layoutSheets(faq, ctx);
  try {
    const out = [];
    for (const el of lay.sheets) {
      const { svg: s, width, height } = await sheetToSVG(el);
      out.push(await svgToPNG(s, width, height, { scale: 1 }));
    }
    return out;
  } finally {
    lay.destroy();
  }
}
