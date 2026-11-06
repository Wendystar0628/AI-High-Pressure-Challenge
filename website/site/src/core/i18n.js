// i18n: src/i18n/<lang>/<namespace>.json. "common" belongs to the skeleton,
// each page has its own namespace named after its page type. English falls
// back to Chinese key by key; a missing key shows the key itself.
//
//   await loadNamespaces('common', 'leaderboard');   // boot() does this for you
//   t('common.nav.home')                              // "首页"
//   t('common.unit.models', { n: 7 })                 // "7 个模型"
//   pick(task, 'name')                                // task.name / task.name_en
//
// 单复数：英文值可以写成 { "one": "{n} model", "other": "{n} models" }，
// t() 按 vars.count（没有时用 vars.n）选形式（Intl.PluralRules）；中文照旧写字符串。
//   t('common.unit.models', { n: 1 })                 // en: "1 model"
//   plural('home.hero.models', 1)                     // 只取选好的原文（不填占位），给 tn() 一类用
import { route } from './route.js';

const loaders = import.meta.glob('../i18n/*/*.json', { import: 'default' });
const dict = { zh: {}, en: {} };
const pending = new Map();

export const lang = route.lang;

async function loadOne(l, ns) {
  if (dict[l][ns]) return;
  const key = `../i18n/${l}/${ns}.json`;
  const loader = loaders[key];
  if (!loader) {
    dict[l][ns] = {};
    return;
  }
  if (!pending.has(key)) pending.set(key, loader().then((v) => (dict[l][ns] = v ?? {})));
  await pending.get(key);
}

/** Load namespaces for the current language (and zh as the fallback). */
export async function loadNamespaces(...names) {
  const list = names.flat().filter(Boolean);
  await Promise.all(list.flatMap((ns) => (lang === 'zh' ? [loadOne('zh', ns)] : [loadOne('zh', ns), loadOne(lang, ns)])));
}

const dig = (obj, path) => path.reduce((o, p) => (o == null ? undefined : o[p]), obj);

let rules = null;
/** 单复数对象 { one, other, … } 按数量取一种形式；别的值原样返回。 */
function form(v, n) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.other !== 'string') return v;
  const c = Number(n);
  if (!Number.isFinite(c)) return v.other;
  rules ??= new Intl.PluralRules(lang === 'en' ? 'en' : 'zh-CN');
  return v[rules.select(c)] ?? v.other;
}
const countOf = (vars) => (vars ? vars.count ?? vars.n : undefined);

function lookup(l, key) {
  const [ns, ...path] = key.split('.');
  return dig(dict[l][ns], path);
}

/** Does the key exist (in the current language or zh)? */
export function has(key) {
  return lookup(lang, key) != null || lookup('zh', key) != null;
}

/** Raw value (string, object or array) for a key, with zh fallback. */
export function tv(key) {
  const v = lookup(lang, key);
  return v != null ? v : lookup('zh', key);
}

/** The string of a key for count n (plural form picked, placeholders not filled); the key itself when missing. */
export function plural(key, n) {
  let v = form(lookup(lang, key), n);
  if (typeof v !== 'string') v = form(lookup('zh', key), n);
  return typeof v === 'string' ? v : key;
}

/** Translate a key; {name} placeholders are filled from vars; plural forms by vars.count / vars.n. */
export function t(key, vars) {
  const v = plural(key, countOf(vars));
  return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)) : v;
}

/**
 * Fill elements that carry data-i18n="ns.key" (text) and
 * data-i18n-attr="title:ns.key;aria-label:ns.key" (attributes).
 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
}

/**
 * A bilingual field of a data object: in English, obj[field + '_en'] (or obj.en
 * for a category name), else the Chinese field.
 *   pick(task, 'name'), pick(task, 'short'), pick(category, 'name'), pick(task, 'deliverable')
 */
export function pick(obj, field) {
  if (!obj) return '';
  if (lang === 'en') {
    const v = obj[`${field}_en`] ?? (field === 'name' ? obj.en : undefined);
    if (v != null && v !== '') return v;
  }
  return obj[field] ?? '';
}
