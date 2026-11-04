// Shared drawing for the tasks-design-* figures: each design task's 100 points split into scoring directions.
// Each figure sets window.FIG before loading this file:
//   { cat, catName, partner, title, desc, facts: [...],
//     groups: [{ head?, facts?, dirs: [[name, points, [subitem points...]], ...] }, ...] }
// One row per direction on a 0-100 scale; each bar starts where the previous one ends, so the rows step down to 100.
// Cells are subitems. Directions alternate the category colour (--cat-<cat>) and FIG.partner, another violet step.
// The largest direction in the figure gets an ink tag with a lime star; its bar keeps its colour.
// Everything is placed from fixed geometry, nothing is measured.
(function () {
  const F = window.FIG;
  const P = 5.74;                                      // px per point: 100 points = 574 px
  const X_NO = 0, X_NAME = 30, X_CNT = 228, X0 = 248, X1 = X0 + 100 * P;
  const AXIS_H = 30, GROUP_H = 40, ROW_H = 30, BAR_H = 14, CELL_GAP = 1.5;
  const FILLS = [`var(--cat-${F.cat})`, `var(--${F.partner})`];
  const facts = list => `<span class="field facts">${list.map(t => `<span>${t}</span>`).join('')}</span>`;

  const frame = document.querySelector('.frame');
  frame.innerHTML = `
    <header class="head">
      <div class="pair"><span class="eyebrow slash">Scoring Directions</span><h2 class="title">${F.title}</h2></div>
      <i class="lead"></i>
    </header>
    <p class="desc">${F.desc}</p>
    <div class="plot" id="plot"></div>
    <div class="foot">
      <span class="cat"><img class="icon" src="../../icon-${F.cat}.svg" alt="">${F.catName}${facts(F.facts)}</span>
      <span class="legend"><span><i class="cells" style="--c:${FILLS[0]}"></i>每格是一个分项</span><span><span class="best"><span class="star"></span></span>分值最大的方向</span></span>
    </div>`;
  const plot = document.getElementById('plot');
  const put = (cls, css, html = '') => {
    const d = document.createElement('div');
    d.className = cls;
    d.style.cssText = css;
    d.innerHTML = html;
    plot.appendChild(d);
    return d;
  };

  // Checks: directions sum to 100, subitems to their direction; find the one largest direction.
  const all = F.groups.flatMap(g => g.dirs);
  F.groups.forEach(g => {
    const total = g.dirs.reduce((s, d) => s + d[1], 0);
    if (Math.abs(total - 100) > 1e-9) throw new Error(`directions sum to ${total}, not 100`);
    g.dirs.forEach(([name, pts, subs]) => {
      const sum = subs.reduce((s, v) => s + v, 0);
      if (Math.abs(sum - pts) > 1e-9) throw new Error(`${name}: subitems sum to ${sum}, not ${pts}`);
    });
  });
  const max = Math.max(...all.map(d => d[1]));
  const best = all.filter(d => d[1] === max).length === 1 ? all.find(d => d[1] === max) : null;

  // Column heads and the point scale.
  put('colh', `left:${X_NAME}px;top:0`, '评分方向');
  put('colh', `left:${X_CNT}px;top:0;transform:translateX(-100%)`, '分项');
  for (let p = 0; p <= 100; p += 5) {
    const x = X0 + p * P, major = p % 25 === 0, h = major ? 7 : 4;
    put('tick', `left:${Math.min(x, X1 - 1)}px;top:${24 - h}px;height:${h}px`);
    if (major) put('tl num', `left:${x}px;top:0;transform:translateX(${p === 0 ? '0' : p === 100 ? '-100%' : '-50%'})`, p);
  }
  put('colh', `left:${X1 + 10}px;top:0`, '分');
  put('axis', `left:${X0}px;top:24px;width:${100 * P}px`);

  let y = AXIS_H;
  const top = y;
  F.groups.forEach(g => {
    put('hr ink', `top:${y}px`);
    if (g.head) {
      put('ghead', `left:${X_NO}px;top:${y + 9}px`, `<h3>${g.head}</h3>${facts(g.facts)}`);
      y += GROUP_H;
    }
    let at = 0;
    g.dirs.forEach((d, i) => {
      const [name, pts, subs] = d;
      if (i) put('hr', `top:${y}px`);
      const fill = FILLS[i % 2];
      put('no field', `left:${X_NO}px;top:${y + 5}px`, String(i + 1).padStart(2, '0'));
      put('name', `left:${X_NAME}px;top:${y + 5}px`, name);
      put('cnt field', `left:${X_CNT}px;top:${y + 5}px`, `${subs.length} 项`);
      // Subitem cells, laid end to end from this direction's start.
      let s = at;
      subs.forEach((v, j) => {
        const a = X0 + s * P + (j ? CELL_GAP / 2 : 0), b = X0 + (s + v) * P - (j < subs.length - 1 ? CELL_GAP / 2 : 0);
        put('cell', `left:${a}px;top:${y + (ROW_H - BAR_H) / 2}px;width:${b - a}px;background:${fill}`);
        s += v;
      });
      const end = X0 + (at + pts) * P;
      if (d === best) put('best num', `left:${end + 8}px;top:${y + 4}px`, `<span class="star"></span>${pts}`);
      else put('pts num', `left:${end + 8}px;top:${y + 5}px`, pts);
      at += pts;
      y += ROW_H;
    });
  });
  put('hr ink', `top:${y}px`);
  // Faint guides at 25, 50 and 75 points behind the bars.
  for (const p of [25, 50, 75]) plot.insertBefore(Object.assign(document.createElement('div'),
    { className: 'guide', style: `left:${X0 + p * P}px;top:${top}px;height:${y - top}px` }), plot.firstChild);
  plot.style.height = `${y + 1}px`;
})();
