// /faq/ 猜你想问: a reading page of questions and answers (website/docs/faq.md).
// Text: content/<lang>/faq.json (format in ./model.js); the weights bar reads the
// site data. The same content exports as 1920×1080 images (./sheet.js).
import '../../reading/reading.css';
import './style.css';
import { boot } from '../../shell/index.js';
import { h, t, lang, links, fmtDate, fmtPct, categoryIcon } from '../../core/index.js';
import { contentVars } from '../../reading/content.js';
import { plainText } from '../../reading/rich.js';
import { aside, wireToc, wireAnchors, jumpToHash, pairTitle, sweep } from '../../reading/reading.js';
import { loadFaq, rich } from './model.js';
import { exportPanel } from './export-panel.js';

const no2 = (i) => String(i).padStart(2, '0');

boot(async ({ data }) => {
  const paper = document.querySelector('[data-slot="page"]');
  const side = document.querySelector('[data-slot="aside"]');
  const faq = await loadFaq(data, lang);
  const vars = contentVars(data);
  const ctx = { data, vars };

  // ---- page head ----
  const head = paper.querySelector('.rd-head');
  sweep(head.querySelector('.st-tri'));
  head.prepend(h('span.rd-banner.faq-banner', { 'aria-hidden': 'true', style: { '--decor': `url("${links.asset('decor/star/star-cluster.svg')}")` } }));
  head.append(
    faq.lede ? rich('p.rd-lede.st-read', faq.lede, vars) : null,
    h('ul.st-facts.st-field', h('li', t('faq.fields.questions', { n: faq.questions })), h('li', t('faq.fields.sections', { n: faq.sections.length }))),
    exportPanel(faq, ctx),
  );

  // ---- sections ----
  faq.sections.forEach((sec, i) => {
    paper.append(
      h(
        'section.rd-sec.faq-sec',
        { id: sec.id },
        i ? h('div.rd-divider', { 'aria-hidden': 'true' }) : null,
        pairTitle('h2', { eyebrow: lang === 'en' || !sec.titleEn ? no2(i + 1) : `${no2(i + 1)} / ${sec.titleEn}`, title: sec.title }),
        h(
          'div.faq-list',
          sec.items.map((it) => (it.type === 'qa' ? qaEl(it, ctx) : noteEl(it, ctx))),
        ),
      ),
    );
  });
  paper.append(
    h(
      'footer.rd-end',
      h('p.st-actions', h('a.st-btn.go', { href: links.leaderboard() }, t('faq.end.leaderboard')), h('a.st-btn', { href: links.about() }, t('faq.end.about'))),
    ),
  );

  // ---- left column ----
  const toc = faq.sections.map((sec, i) => ({
    id: sec.id,
    no: no2(i + 1),
    label: sec.title,
    children: sec.items.filter((it) => it.type === 'qa').map((it) => ({ id: it.id, no: t('faq.qa.no', { n: it.no }), label: plainText(it.q, vars) })),
  }));
  const ledger = [
    [t('faq.ledger.questions'), t('faq.ledger.questionsN', { n: faq.questions })],
    [t('faq.ledger.sections'), t('faq.ledger.sectionsN', { n: faq.sections.length })],
  ];
  if (data?.updated) ledger.push([t('faq.ledger.updated'), fmtDate(data.updated)]);
  const a = aside({
    tocLabel: t('faq.aside.toc'),
    tocEyebrow: t('faq.aside.tocEn'),
    toc,
    ledgerLabel: t('faq.aside.ledger'),
    ledgerEyebrow: t('faq.aside.ledgerEn'),
    ledger,
  });
  side.append(a.el);

  wireAnchors(paper);
  wireToc(a.nav);
  jumpToHash();
});

/** One question: number (a link to itself) │ tag, question, answer. */
function qaEl(it, ctx) {
  const no = t('faq.qa.no', { n: it.no });
  return h(
    'article.faq-qa',
    { id: it.id },
    h('a.st-tag.faq-no', { href: `#${it.id}`, 'aria-label': t('faq.qa.link', { n: it.no }) }, no),
    h('div.faq-body', it.tag ? tagEl(it.tag) : null, rich('h3.faq-q', it.q, ctx.vars), h('div.faq-a', blockEls(it.a, ctx))),
  );
}

/** A note without a question: one large sentence, then its text and side blocks. */
function noteEl(it, ctx) {
  return h(
    'article.faq-note',
    { id: it.id },
    it.tag ? tagEl(it.tag) : null,
    it.lead ? rich('p.faq-lead', it.lead, ctx.vars) : null,
    h('div.faq-a', blockEls(it.a, ctx), blockEls(it.side, ctx)),
  );
}

/** Category tag: a chip with the category's colour and icon, linked to its board. */
function tagEl(tag) {
  const kids = [h('span.faq-swatch', { class: tag.lime ? 'is-lime' : null, style: { '--fill': tag.fill }, 'aria-hidden': 'true' }), tag.category ? categoryIcon(tag.category) : null, h('span', tag.label)];
  return tag.href ? h('a.st-chip.faq-tag', { href: tag.href, title: t('faq.qa.board', { name: tag.label }) }, kids) : h('span.st-chip.faq-tag', kids);
}

function blockEls(list, ctx) {
  return list.map((b) => {
    if (b.p) return rich('p.rd-p.st-read', b.p, ctx.vars);
    if (b.source) {
      return h(
        'p.rd-p.faq-src',
        h('span.st-field.faq-src-k', b.source.label),
        h('a', { href: b.source.url, target: '_blank', rel: 'noopener' }, b.source.text),
      );
    }
    if (b.ratios) {
      return h(
        'div.st-figs.faq-ratios',
        { style: { '--n': Math.min(3, b.ratios.length) } },
        b.ratios.map((r) => h('div', h('b', r.pre ? h('small', r.pre) : null, r.value, r.unit ? h('small', r.unit) : null), h('span', r.label))),
      );
    }
    if (b.weights) return weightsEl(b.weights, ctx);
    return null;
  });
}

/** 标准评判题 / 主动设计题 weights from the data, with a way to the weight sandbox. */
function weightsEl(w, ctx) {
  const [a, b] = w.parts;
  const sandbox = ctx.data ? links.leaderboard({ w: ctx.data.categories.map((c) => c.weight) }) : links.leaderboard();
  return h(
    'div.faq-weights',
    w.caption ? rich('p.rd-p.st-read.faq-wcap', w.caption, ctx.vars) : null,
    h(
      'div.faq-wbar',
      { role: 'img', 'aria-label': a && b ? t('faq.weights.aria', { a: a.label, wa: fmtPct(a.weight), b: b.label, wb: fmtPct(b.weight) }) : null },
      w.parts.map((p) => h('span', { class: `is-${p.kind}`, style: { flexGrow: p.weight } }, h('b', p.label), h('span.num', fmtPct(p.weight)))),
    ),
    h('p.faq-wgo', h('a.st-btn.small', { href: sandbox, title: t('faq.weights.openTitle') }, t('faq.weights.open'))),
  );
}
