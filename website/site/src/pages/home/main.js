// 首页 (website/docs/home.md): first screen (top 5 + 八项星盘) → task ticker →
// how the total is made → how a task is run → where to next. Everything is
// drawn from site/data; the top 5 come from the scores, any number of models works.
import './style.css';
import { boot } from '../../shell/index.js';
import { h, t, rankBy } from '../../core/index.js';
import { createPageModel, divider } from './util.js';
import { renderHero } from './hero.js';
import { renderTicker } from './ticker.js';
import { renderScoring } from './scoring.js';
import { renderHow } from './how.js';
import { renderIndex } from './index-links.js';

const TOP = 5;

boot(({ data }) => {
  const main = document.querySelector('[data-slot="page"]');
  if (!data) {
    main.append(h('div.home-col', h('p.home-empty', t('home.top.empty'))));
    return;
  }
  // only ranked models (all tasks scored) are in the top 5; the page model starts at the top
  const top = rankBy(data, 'total').filter((e) => e.ranked).slice(0, TOP);
  const page = createPageModel(top[0]?.id ?? data.order[0]);

  const hero = renderHero(data, page, top);
  main.append(
    h('div.home-screen', hero.el, renderTicker(data)),
    renderScoring(data, page, top),
    divider(),
    renderHow(data),
    divider(),
    renderIndex(data),
  );
  hero.start(main);
});
