// Topic cards from data/topics.json (format: website/hub/README.md). Static text and settings
// come from the page (<script id="hub-data">, written from site.config.mjs).
const html = document.documentElement;
const root = html.dataset.root || './';
const { lang, text: T, accents, colorLogos } = JSON.parse(document.getElementById('hub-data').textContent);
const en = lang === 'en';
const colour = new Set(colorLogos);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const dots = (d) => (d ? String(d).slice(0, 10).replace(/-/g, '.') : '');
const score = (v) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(1));
const int = (v) => (Number.isFinite(+v) ? String(+v) : '—');
const safeUrl = (u) => (/^(\/|\.{0,2}\/|https?:)/.test(String(u ?? '')) ? String(u) : '#');

// the language switch remembers the choice (the topic sites read the same key)
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('[data-lang-switch]');
  if (!a) return;
  try {
    localStorage.setItem('octa.lang', a.dataset.langSwitch);
  } catch {}
});

function logo(m) {
  const name = String(m.logo || '').replace(/[^\w-]/g, '');
  if (!name) return '<span class="logo" aria-hidden="true"></span>';
  const c = colour.has(name);
  return `<span class="logo${c ? ' is-color' : ''}" style="--icon:url(&quot;${root}logos/${name}${c ? '-color' : ''}.svg&quot;)" aria-hidden="true"></span>`;
}

function topRow(m, i) {
  const label = `${m.name ?? ''}${m.effort ? ` (${m.effort})` : ''}`;
  const v = Number.isFinite(+m.total) ? Math.max(0, Math.min(100, +m.total)) : 0;
  const sr = [fill(T.rank, { n: i + 1 }), label, fill(T.score, { score: score(m.total) })].join(en ? ', ' : '，');
  return `<li class="top-row" style="--v:${v / 100}">
    <span class="top-rank" aria-hidden="true">${i + 1}</span>
    ${logo(m)}
    <span class="mname" title="${esc(label)}" aria-hidden="true"><span class="mname-text">${esc(m.name)}</span>${m.effort ? `<span class="mname-effort">(${esc(m.effort)})</span>` : ''}</span>
    <span class="top-score" aria-hidden="true">${score(m.total)}</span>
    <span class="top-bar" aria-hidden="true"><i></i></span>
    <span class="sr-only">${esc(sr)}</span>
  </li>`;
}

function card(t) {
  const draft = t.status !== 'online';
  const name = en ? t.name_en || t.name : t.name;
  const other = en ? t.name : t.name_en;
  const href = en ? t.url_en || `${String(t.url ?? '').replace(/\/?$/, '/')}en/` : t.url;
  const accent = accents?.[t.id];
  const top = Array.isArray(t.top) ? t.top.slice(0, 3) : [];
  const stat = (n, label) => `<div><dt>${esc(label)}</dt><dd>${int(n)}</dd></div>`;
  return `<li class="topic${draft ? ' is-draft' : ''}"${accent ? ` style="--topic:${esc(accent)}"` : ''}>
    <div class="topic-id">
      <h3 class="topic-name"><a class="topic-link" href="${esc(safeUrl(href))}">${esc(name)}</a></h3>
      ${other ? `<p class="topic-other" lang="${en ? 'zh-CN' : 'en'}">${esc(other)}</p>` : ''}
      ${draft ? `<p class="topic-draft"><b>${esc(T.draft)}</b>${esc(T.draftNote)}</p>` : ''}
      <dl class="topic-stats">${stat(t.tasks, T.tasks)}${stat(t.categories, T.categories)}${stat(t.ranked, T.ranked)}</dl>
    </div>
    <div class="topic-top">
      <h4 class="topic-top-head">${esc(T.top)}</h4>
      ${top.length ? `<ol class="top-list">${top.map(topRow).join('')}</ol>` : `<p class="topic-none">${esc(T.noTop)}</p>`}
    </div>
    <p class="topic-foot"><span>${esc(fill(T.updated, { date: dots(t.updated) }))}</span><span class="topic-go" aria-hidden="true">${esc(T.open)}</span></p>
  </li>`;
}

const slot = document.querySelector('[data-slot="topics"]');
const note = (s) => `<li class="topics-note">${esc(s)}</li>`;

async function main() {
  try {
    const r = await fetch(`${root}data/topics.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const topics = Array.isArray(data.topics) ? data.topics : [];
    slot.innerHTML = topics.length ? topics.map(card).join('') : note(T.empty);
    const up = document.querySelector('[data-slot="updated"]');
    if (up && data.updated) up.textContent = fill(T.dataUpdated, { date: dots(data.updated) });
  } catch (e) {
    console.error(e);
    slot.innerHTML = note(T.failed);
  }
  slot.removeAttribute('aria-busy');
  // the score bars grow once, after the first frame
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('is-ready')));
}

main();
