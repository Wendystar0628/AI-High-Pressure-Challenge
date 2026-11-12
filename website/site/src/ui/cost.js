// 测试开销 (orchestrator/docs/测试开销.md 五、六; leaderboard.md「模型行」「测试开销」).
// scores.<id>.cost = { cny, basis, plan, tokens, fitted, method, api_usd }, top level cost_source
// = { name, url, fetched, usd_cny } (data.costSource). Pages only read it; nothing about a model is fixed here.
//
//   hasCosts(data)              does the data carry costs at all (no column without them)
//   costOf(data, id)            the cost object or null
//   costKey(cost)               'subscription' | 'api' | 'none'  (the tag under the amount)
//   fillCost(cell, cost)        a model row's cost cell, one line: the amount and a small basis mark (○ 按订阅折算,
//                               ◆ 按 API 标价折算; shapes, not colours); no amount: 数据暂缺
//   fillTokens(cell, cost)      a model row's token cell, one line: the 13-task total, * when some tasks are estimated
//   costLegend()                the marks explained once (○ 按订阅折算  ◆ 按 API 标价折算  * 含估算), for the board head
//   costMark(key)               the mark element of a basis ('subscription' | 'api')
//   costTip(data, id)           tooltip content: plan, tokens, estimated tasks, the api_price note
//   costSr(cost)                the sentence a screen reader hears after the row
//   costFacts(data, id)         [plan, tokens] lines (side panel)
//   costNotes(data, id)         [estimated tasks, api_price note] lines (side panel, tooltip)
//   costSourceNote(data, tag)   the foot note: how the amounts are converted (ModelDial, rate, date), the quota
//                               source written out in full and linked (cost_source.url), and how to re-test it yourself
//   fmtCNY(v) / fmtUSD(v) / fmtTokens(n)  (fmtTokens: "17.1 亿 Token" / "1.71B tokens")
//   isEstimated(cost)           cost.fitted is not empty: some tasks' usage is estimated (the 含估算 mark)
import { h } from '../core/dom.js';
import { t, lang, pick } from '../core/i18n.js';
import { fmtDate, fmtInt, DASH } from '../core/format.js';
import { modelLabel } from '../core/names.js';

/** The project repository (same as reading/rich.js REPO): tasks and their isolated environments, for re-testing. */
export const REPO = 'https://github.com/Wendystar0628/AI-High-Pressure-Challenge';

export const costOf = (data, id) => data.score(id)?.cost ?? null;

/** True when the export wrote costs (cost_source or any scores.<id>.cost). */
export const hasCosts = (data) => !!data.costSource || Object.values(data.scores ?? {}).some((s) => s && s.cost);

const locale = () => (lang === 'en' ? 'en-US' : 'zh-CN');
const one = (v) => Number(v).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 23.4 -> "¥23.4"; 1234.5 -> "¥1,234.5"; null -> "—" */
export const fmtCNY = (v) => (v == null || Number.isNaN(+v) ? DASH : `¥${one(v)}`);
/** 41.2 -> "$41.2" */
export const fmtUSD = (v) => (v == null || Number.isNaN(+v) ? DASH : `$${one(v)}`);

/** The number part: 1710000000 -> "17.1 亿" / "1.71B"; under 1 亿 in 万 ("9,877 万"), under 1B in M ("458M"); null -> "—" */
export function fmtTokenValue(n) {
  if (n == null) return DASH;
  if (lang === 'en') {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
    return fmtInt(n);
  }
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)} 亿`;
  if (n >= 1e4) return `${fmtInt(Math.round(n / 1e4))} 万`;
  return fmtInt(n);
}
/** With the unit: "17.1 亿 Token" / "1.71B tokens"; null -> "—" */
export const fmtTokens = (n) => (n == null ? DASH : t('common.cost.tokensUnit', { v: fmtTokenValue(n) }));

/** Some tasks had no usage record and were estimated (cost.fitted not empty). */
export const isEstimated = (cost) => !!cost?.fitted?.length;

/** The tag under the amount: 按订阅折算 / 按 API 标价折算 / 数据暂缺. */
export function costKey(cost) {
  if (!cost || cost.cny == null) return 'none';
  return cost.basis === 'api' ? 'api' : 'subscription';
}

export const costTag = (cost) => t(`common.cost.basis.${costKey(cost)}`);

/** "Claude Ultra（$200/月）", "CodeBuddy 140 元档（¥140/月，9,000 积分）", "DeepSeek API" */
export function planText(plan) {
  if (!plan?.name) return '';
  const name = pick(plan, 'name'); // an English page takes plan.name_en when the export writes one
  const terms = [];
  if (plan.price != null) {
    const price = `${plan.currency === 'CNY' ? '¥' : '$'}${fmtInt(plan.price)}`;
    terms.push(plan.period ? t(`common.cost.per.${plan.period}`, { price }) : price);
  }
  if (plan.credits != null) terms.push(t('common.cost.credits', { n: fmtInt(plan.credits) }));
  return terms.length ? t('common.cost.planTerms', { name, terms: terms.join(t('common.cost.sep')) }) : name;
}

/** Task names of the estimated tasks, in the page's language (the data writes the Chinese task names). */
function fittedNames(data, cost) {
  const list = cost?.fitted ?? [];
  return list.map((name) => {
    const task = data.tasks.find((k) => k.name === name || k.key === name);
    return task ? pick(task, 'name') : name;
  });
}

/** The basis mark: a ring for 按订阅折算, a solid diamond for 按 API 标价折算 (shape tells them apart, not colour). */
export const costMark = (key) => h('i.cost-mark', { class: `is-${key}`, 'aria-hidden': 'true' });
/** The 含估算 mark: an asterisk after the token total. */
export const estMark = () => h('i.cost-est', { 'aria-hidden': 'true' }, '*');

/**
 * A model row's cost cell (.mrow-cost), one line, vertically centred: the amount and a small basis mark after it
 * (the words 按订阅折算 / 按 API 标价折算 are written once, in the legend). No amount: 数据暂缺.
 */
export function fillCost(cell, cost) {
  const key = costKey(cost);
  cell.classList.toggle('is-none', key === 'none');
  cell.dataset.basis = key;
  cell.title = costTag(cost);
  if (key === 'none') cell.replaceChildren(h('span.mrow-cost-none', t('common.cost.basis.none')));
  else cell.replaceChildren(h('b.mrow-cost-v.num', fmtCNY(cost.cny)), costMark(key));
}

/**
 * A model row's token cell (.mrow-tok), one line: the 13-task total ("17.1 亿" / "1.71B"; the column head says
 * Token) and * when some tasks are estimated (explained once in the legend). No record: 数据暂缺.
 */
export function fillTokens(cell, cost) {
  const none = cost?.tokens == null;
  cell.classList.toggle('is-none', none);
  // the * slot is always there (hidden when nothing is estimated), so the totals line up on the right
  const est = estMark();
  est.classList.toggle('is-off', none || !isEstimated(cost));
  cell.replaceChildren(h('span.mrow-tok-v.num', none ? t('common.cost.basis.none') : fmtTokenValue(cost.tokens)), est);
}

/** The marks explained once: ○ 按订阅折算  ◆ 按 API 标价折算  * 含估算 (only the marks the data uses). */
export function costLegend(data, tag = 'p.cost-legend') {
  const costs = Object.values(data.scores ?? {}).map((s) => s?.cost).filter(Boolean);
  const keys = new Set(costs.map(costKey));
  const item = (mark, text) => h('span.cost-legend-item', mark, text);
  return h(
    tag,
    keys.has('subscription') || !costs.length ? item(costMark('subscription'), t('common.cost.basis.subscription')) : null,
    keys.has('api') ? item(costMark('api'), t('common.cost.basis.api')) : null,
    costs.some(isEstimated) ? item(estMark(), t('common.cost.legendEst')) : null,
  );
}

/** "测试开销 66.7 元，按订阅折算" — appended to the row's screen reader sentence. */
export function costSr(cost) {
  const key = costKey(cost);
  const money = key === 'none' ? t('common.cost.srNone') : t('common.cost.sr', { cost: one(cost.cny), basis: costTag(cost) });
  const tokens = cost?.tokens == null ? t('common.cost.tokensNoneShort') : fmtTokens(cost.tokens);
  return t('common.cost.srTokens', { money, tokens, est: isEstimated(cost) ? t('common.cost.srEst') : '' });
}

/** [plan line, tokens line] for the panel and the tooltip; empty strings dropped. */
export function costFacts(data, id) {
  const cost = costOf(data, id);
  const out = [];
  const key = costKey(cost);
  const plan = planText(cost?.plan);
  if (plan) out.push(t(`common.cost.plan.${key === 'api' ? 'api' : 'subscription'}`, { plan }));
  out.push(cost?.tokens == null ? t('common.cost.tokensNone') : t('common.cost.tokens', { n: data.tasks.length, v: fmtTokens(cost.tokens) }) + (isEstimated(cost) ? t('common.cost.estSuffix') : ''));
  return out;
}

/** Notes that qualify the amount: how it was estimated, which tasks are estimated. */
export function costNotes(data, id) {
  const cost = costOf(data, id);
  const out = [];
  // no amount: say why, unless the token line already does (no usage records at all)
  if (!cost || cost.cny == null) {
    if (cost?.tokens != null) out.push(t('common.cost.noteNone'));
  }
  else if (cost.method === 'api_price' && cost.basis === 'api') out.push(t('common.cost.noteApiDirect'));
  else if (cost.method === 'api_price') out.push(cost.api_usd == null ? t('common.cost.noteApiPrice') : t('common.cost.noteApiPriceUsd', { usd: fmtUSD(cost.api_usd) }));
  else if (cost.method === 'credits') out.push(t('common.cost.noteCredits'));
  else if (cost.method === 'quota') out.push(t('common.cost.noteQuota'));
  const fitted = fittedNames(data, cost);
  if (fitted.length >= data.tasks.length) out.push(t('common.cost.fittedAll', { n: data.tasks.length }));
  else if (fitted.length) out.push(t('common.cost.fitted', { list: fitted.join(t('common.cost.listSep')) }));
  return out;
}

/** Tooltip content for a row's cost cell. */
export function costTip(data, id) {
  const cost = costOf(data, id);
  const key = costKey(cost);
  const head = `${modelLabel(data.model(id))} │ ${t('common.cost.label')} ${key === 'none' ? t('common.cost.basis.none') : `${fmtCNY(cost.cny)} ${costTag(cost)}`}`;
  return h('span.cost-tip', h('b', head), ...costFacts(data, id).map((s) => h('span', s)), ...costNotes(data, id).map((s) => h('span.cost-tip-note', s)));
}

// a translated sentence with {key} placeholders filled by elements (links)
function fillNodes(text, nodes) {
  return text.split(/(\{\w+\})/).map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && nodes[m[1]] !== undefined ? nodes[m[1]] : part;
  });
}
const extLink = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

/**
 * The note under the board, three lines: the rule behind the amounts (source name, dollar rate, date);
 * the quota source written out in full as a link (cost_source.url, new window); and how to check the
 * measured usage yourself (download the tasks and their isolated environments from GitHub).
 * Returns null when the data has no cost_source.
 */
export function costSourceNote(data, tag = 'div.cost-note') {
  const src = data.costSource;
  if (!src) return null;
  const name = pick(src, 'name') || 'ModelDial';
  const rule = t('common.cost.source', { src: name, rate: src.usd_cny ?? DASH, date: fmtDate(src.fetched) });
  const lines = [h('span.cost-note-line', rule)];
  if (src.url) lines.push(h('span.cost-note-line', fillNodes(t('common.cost.sourceUrl'), { url: extLink(src.url, src.url) })));
  lines.push(h('span.cost-note-line', fillNodes(t('common.cost.retest'), { repo: extLink(REPO, REPO.replace(/^https:\/\//, '')) })));
  return h(tag, lines);
}
