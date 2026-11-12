// 猜你想问的内容：content/zh/faq.json（结构和中文）+ content/en/faq.json（英文）。
// 加问答、加板块只改这两个文件，页面（main.js）和导出图片（sheet.js）都按它生成。
//
// content/zh/faq.json
// {
//   "lede": "页头导语一句（可省）",
//   "sections": [                                   板块，按顺序
//     {
//       "id": "cost",                               锚点 /faq/#cost，也用来和英文对齐
//       "title": "测试开销与 Token 消耗",
//       "wide": true,                               可省。导出图片里本板块占满整宽、问答三张一行；
//                                                   不写时占半宽，和相邻的板块左右并排（网页上都是一列）
//       "items": [
//         {                                         一条问答，编号 Q1、Q2… 按出现顺序自动生成
//           "id": "deepseek-cost",                  锚点，也用来和英文对齐
//           "tag": "reason",                        可省。题目类别标签：类别路径名（data/tasks.json 的 key），
//                                                   字和颜色取网站的类别名和类别色；
//                                                   或 { "kind": "design", "text": "其他主动设计类题目" }：
//                                                   按题型上色（standard 荧光绿 500 / design 紫 300），字自己写；
//                                                   { "category": "algo", "text": "…" } 用类别色、改写字
//           "q": "为什么 DeepSeek 的开销是最多的？",
//           "a": "回答，**重点**会高亮"            字符串，或块的数组（见下）
//         },
//         {                                         没有 q 的一条是说明块（不编号）：大号的一句 lead，
//           "id": "default-weights",                下接 a；side 里的块在导出图片里排在右侧
//           "lead": "如果你感觉什么题没必要测，\n在网页里把**权重拉到 0** 就行。",
//           "a": "如对题目本身有疑问，**欢迎提问**。",
//           "side": [{ "weights": "模型得分仅为**我本人给的默认权重**：" }]
//         }
//       ]
//     }
//   ]
// }
//
// 块（a、side 的数组元素）：
//   "一段文字"
//   { "source": { "label": "额度来源", "url": "https://…" } }               来源网址（显示时去掉 https://）
//   { "ratios": [{ "label": "GPT Sol", "pre": "约", "value": "20", "unit": "倍" }, …] }   倍数小块，一行至多三个
//   { "weights": "说明一句" }                                              权重条：标准评判题 / 主动设计题，
//                                                                          百分数读网站数据（data/tasks.json 的类别权重之和）
// 行内：**重点**（高亮）、[字](链接，同 reading/rich.js：lb:、about:#x、task:…、cat:… 或网址)、`代码`、
// \n 换行、~ 不断行的空格：用 ~ 连起来的一串不拆行（Opus~5.5、60~分钟；要写 ~ 本身用 \~）。
//
// 英文 content/en/faq.json 只写要翻译的字：板块和问答按 id 对上中文，逐项盖在中文上
// （对象逐键合并，字符串和数组整个替换，同 reading/content.js 的 merge）；
// 英文没写的板块、问答和字段显示中文。结构（顺序、tag 的类别、wide、网址、倍数）以中文文件为准。
import { h, t, pick, links } from '../../core/index.js';
import { merge } from '../../reading/content.js';
import { inlineHTML } from '../../reading/rich.js';

const files = import.meta.glob('../../../content/*/faq.json', { import: 'default' });

async function read(lang) {
  const f = files[`../../../content/${lang}/faq.json`];
  try {
    return (f ? await f() : null) ?? {};
  } catch (e) {
    console.error(e);
    return {};
  }
}

/** ~ -> no-break space; \~ -> ~ */
export const nb = (s) => (s == null ? s : String(s).replace(/(\\)?~/g, (m, esc) => (esc ? '~' : '\u00a0')));

// Words joined by ~ stay on one line as a whole ("60~分钟" keeps 分钟 with 60 too): .nb { word-break: keep-all }
const STOP = ' \t\r\n，。；：！？、（）“”‘’《》【】,;:!?()';
const RUN = new RegExp(`[^${STOP}\xa0]*(?:\xa0[^${STOP}\xa0]*)+`, 'g');

function keepRuns(root) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walk.nextNode()) if (walk.currentNode.data.includes('\xa0')) texts.push(walk.currentNode);
  for (const node of texts) {
    const s = node.data;
    const parts = [];
    let last = 0;
    for (const m of s.matchAll(RUN)) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      parts.push(h('span.nb', m[0]));
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    node.replaceWith(...parts);
  }
  return root;
}

/** Inline markup of the FAQ (reading/rich.js) into an element, the ~ runs kept whole: rich('p.x', text, vars) */
export function rich(tag, s, vars) {
  const el = h(tag);
  el.innerHTML = inlineHTML(s, vars);
  return keepRuns(el);
}

const omit = (o, key) => {
  const { [key]: _, ...rest } = o ?? {};
  return rest;
};

/** The English entry for a Chinese one: same id, or the same place when neither has an id. */
const counterpart = (list, x, i) => (x?.id != null ? (list ?? []).find((y) => y?.id === x.id) : (list ?? [])[i]) ?? null;

// ---------- colours of a tag: ink or white on the fill, whichever reads better ----------
function rgbOf(css) {
  const s = String(css).trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  m = /rgba?\(([^)]+)\)/.exec(s);
  return m ? m[1].split(/[ ,/]+/).slice(0, 3).map(Number) : null;
}
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const INK = '#1a1726'; // --st-on-flare: ink on a light fill, both themes
const WHITE = '#ffffff'; // --st-on-orbit
function inkOn(varName) {
  const rgb = rgbOf(getComputedStyle(document.documentElement).getPropertyValue(varName));
  if (!rgb) return 'var(--st-on-flare)';
  const l = luminance(rgb);
  const vsInk = (l + 0.05) / (luminance(rgbOf(INK)) + 0.05);
  const vsWhite = (luminance(rgbOf(WHITE)) + 0.05) / (l + 0.05);
  return vsInk >= vsWhite ? 'var(--st-on-flare)' : 'var(--st-on-orbit)';
}

/** tag in the content -> { label, fill, ink, href, lime } (null when there is none) */
function tagOf(raw, data) {
  if (!raw) return null;
  const o = typeof raw === 'string' ? { category: raw } : raw;
  const cat = o.category ? data?.category(o.category) : null;
  if (cat) {
    const name = `--cat-${cat.key}`;
    return { label: nb(o.text) || pick(cat, 'name'), fill: `var(${name})`, ink: inkOn(name), href: links.categories(cat.key), category: cat.key, lime: cat.kind === 'standard' };
  }
  if (o.kind === 'standard' || o.kind === 'design') {
    const name = `--kind-${o.kind}`;
    return { label: nb(o.text) || t(`common.kind.${o.kind}`), fill: `var(${name})`, ink: inkOn(name), href: null, kind: o.kind, lime: o.kind === 'standard' };
  }
  return o.text ? { label: nb(o.text), fill: 'var(--st-chip)', ink: 'var(--st-ink)', href: null, lime: false } : null;
}

/** a / side -> [{ p } | { source } | { ratios } | { weights }] */
function blocksOf(raw, data) {
  const list = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const b of list) {
    if (b == null || b === '') continue;
    if (typeof b === 'string') out.push({ p: nb(b) });
    else if (b.p) out.push({ p: nb(b.p) });
    else if (b.source?.url) {
      const url = String(b.source.url);
      out.push({ source: { label: nb(b.source.label ?? ''), url, text: url.replace(/^https?:\/\//, '').replace(/\/$/, '') } });
    } else if (Array.isArray(b.ratios) && b.ratios.length) {
      out.push({ ratios: b.ratios.map((r) => ({ label: nb(r.label ?? ''), pre: nb(r.pre ?? ''), value: String(r.value ?? ''), unit: nb(r.unit ?? '') })) });
    } else if (b.weights != null && data?.kinds) {
      const caption = typeof b.weights === 'string' ? b.weights : b.weights.caption ?? '';
      const parts = ['standard', 'design']
        .filter((k) => data.kinds[k])
        .map((k) => ({ kind: k, label: t(`common.kind.${k}`), weight: data.kinds[k].weight }));
      out.push({ weights: { caption: nb(caption), parts } });
    }
  }
  return out;
}

/**
 * The FAQ for this page's language:
 * { lede, sections: [{ id, title, titleEn, wide, items: [item] }], questions, data }
 * item: { id, type: 'qa' | 'note', no (qa: 1, 2…), q, lead, a: [block], side: [block], tag }
 */
export async function loadFaq(data, lang) {
  const [zh, en] = await Promise.all([read('zh'), read('en')]);
  const useEn = lang === 'en';
  let no = 0;
  const sections = (zh.sections ?? []).map((zs, si) => {
    const es = counterpart(en.sections, zs, si);
    const sec = useEn ? merge(omit(zs, 'items'), omit(es, 'items')) : omit(zs, 'items');
    const items = (zs.items ?? []).map((zi, ii) => {
      const it = useEn ? merge(zi, counterpart(es?.items, zi, ii) ?? {}) : zi;
      const qa = it.q != null && it.q !== '';
      return {
        id: it.id != null ? String(it.id) : `${zs.id ?? `s${si + 1}`}-${ii + 1}`,
        type: qa ? 'qa' : 'note',
        no: qa ? ++no : null,
        q: qa ? nb(it.q) : null,
        lead: nb(it.lead ?? ''),
        a: blocksOf(it.a, data),
        side: blocksOf(it.side, data),
        tag: tagOf(it.tag, data),
      };
    });
    return {
      id: zs.id != null ? String(zs.id) : `s${si + 1}`,
      title: nb(sec.title ?? ''),
      titleEn: nb(es?.title ?? ''),
      wide: !!zs.wide,
      items,
    };
  });
  return { lede: nb((useEn ? merge(zh.lede, en.lede) : zh.lede) ?? ''), sections, questions: no };
}
