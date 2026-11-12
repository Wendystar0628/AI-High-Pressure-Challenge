// 导出图片: a small panel in the page head. "生成图片" lays the FAQ out on
// 1920×1080 sheets (./sheet.js), turns each into a PNG in the browser and
// shows them; each image saves on its own, or all of them in a row.
import { h, t, lang } from '../../core/index.js';
import { flashDone, toast } from '../../vendor/stellar/fx.js';

const fileName = (n) => `ai-decathlon-faq-${lang}-${n}.png`;

function save(url, name) {
  const a = h('a', { href: url, download: name, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
}

export function exportPanel(faq, ctx) {
  const make = h('button.st-btn.small.faq-ex-make', { type: 'button' }, t('faq.export.button'));
  const status = h('span.st-field.faq-ex-status', { role: 'status' }, t('faq.export.hint'));
  const list = h('ol.faq-ex-list');
  const saveAll = h('button.st-btn.small.go.faq-ex-all', { type: 'button' }, t('faq.export.saveAll'));
  const out = h('div.faq-ex-out', { hidden: true }, list, h('p.faq-ex-foot', saveAll));
  let urls = [];

  saveAll.addEventListener('click', async () => {
    saveAll.setAttribute('aria-busy', 'true');
    for (let i = 0; i < urls.length; i++) {
      save(urls[i], fileName(i + 1));
      if (i < urls.length - 1) await new Promise((r) => setTimeout(r, 350));
    }
    flashDone(saveAll, t('faq.export.saved'));
  });

  make.addEventListener('click', async () => {
    make.setAttribute('aria-busy', 'true');
    status.textContent = t('faq.export.busy');
    try {
      const { renderSheets } = await import('./sheet.js');
      const blobs = await renderSheets(faq, ctx);
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls = blobs.map((b) => URL.createObjectURL(b));
      list.replaceChildren(
        ...urls.map((url, i) => {
          const name = fileName(i + 1);
          return h(
            'li',
            h('a.faq-ex-thumb', { href: url, download: name }, h('img', { src: url, width: 1920, height: 1080, alt: t('faq.export.alt', { n: i + 1, of: urls.length }) })),
            h('p.faq-ex-cap', h('span.st-field', t('faq.export.page', { n: i + 1 })), h('a.st-btn.small', { href: url, download: name }, t('faq.export.save'))),
          );
        }),
      );
      saveAll.hidden = urls.length < 2;
      out.hidden = false;
      status.textContent = t('faq.export.ready', { n: urls.length });
      make.textContent = t('faq.export.again');
      flashDone(make);
    } catch (e) {
      console.error(e);
      make.removeAttribute('aria-busy');
      status.textContent = t('faq.export.hint');
      toast(t('faq.export.failed'));
    }
  });

  return h(
    'section.faq-export',
    { 'aria-label': t('faq.export.title') },
    h('p.faq-ex-head', h('span.st-pair', h('span.st-eyebrow', t('faq.export.eyebrow')), h('span', t('faq.export.title')))),
    h('div.faq-ex-row', make, status),
    out,
  );
}
