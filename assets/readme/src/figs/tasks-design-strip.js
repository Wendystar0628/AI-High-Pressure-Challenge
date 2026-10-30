// Shared drawing for the tasks-design-* figures: each design task's 100 points split into scoring directions.
// Each figure sets window.FIG before loading this file:
//   { cat, title, sub, legend: [[kind, text], ...],
//     rows: [{ head?, dirs: [[label, points, [subitem points...], 'perf'?], ...] }, ...] }
// Bar widths are exact: 896 px = 100 points. Directions are blocks; the thin strip under each block has one cell per subitem.
(function () {
  const F = window.FIG;
  const W = 896, P = W / 100, GAP = 3, CELL_GAP = 2;
  const HEAD_H = 30, NUM_H = 36, BAR_H = 50, SUB_GAP = 6, SUB_H = 8, ROW_GAP = 26;

  document.querySelector('.head h2').textContent = F.title;
  document.querySelector('.head p').innerHTML = F.sub;
  const plot = document.getElementById('plot');
  const c = `--c:var(--${F.cat});--t:var(--${F.cat}-tint)`;
  const put = (cls, css, html = '') => {
    const d = document.createElement('div');
    d.className = cls;
    d.style.cssText = css + ';' + c;
    d.innerHTML = html;
    plot.appendChild(d);
    return d;
  };

  let y = 0;
  F.rows.forEach((row, ri) => {
    if (ri) y += ROW_GAP;
    if (row.head) { put('rowhead', `left:0;top:${y}px`, row.head); y += HEAD_H; }
    const total = row.dirs.reduce((s, d) => s + d[1], 0);
    if (Math.abs(total - 100) > 1e-9) throw new Error(`directions sum to ${total}, not 100`);
    const NUM_Y = y, BAR_Y = y + NUM_H, SUB_Y = BAR_Y + BAR_H + SUB_GAP;
    let at = 0;
    row.dirs.forEach(([label, pts, subs, kind], i) => {
      const sum = subs.reduce((s, v) => s + v, 0);
      if (Math.abs(sum - pts) > 1e-9) throw new Error(`${label}: subitems sum to ${sum}, not ${pts}`);
      const x0 = at * P, x1 = (at + pts) * P;
      const l = x0 + (i ? GAP / 2 : 0), r = x1 - (i < row.dirs.length - 1 ? GAP / 2 : 0);
      const perf = kind === 'perf' ? ' perf' : '', narrow = r - l < 64 ? ' narrow' : '';
      put('pts num', `left:${l + 5}px;top:${NUM_Y}px`, String(pts));
      put('blk' + perf + narrow, `left:${l}px;top:${BAR_Y}px;width:${r - l}px;height:${BAR_H}px`,
          `<span class="lab">${label}</span>`);
      // Subitem cells: proportional widths inside the block, separated by small gaps.
      let s0 = 0;
      subs.forEach((v, j) => {
        const a = l + (r - l) * s0 / pts + (j ? CELL_GAP / 2 : 0);
        const b = l + (r - l) * (s0 + v) / pts - (j < subs.length - 1 ? CELL_GAP / 2 : 0);
        put('cell' + perf, `left:${a}px;top:${SUB_Y}px;width:${b - a}px;height:${SUB_H}px`);
        s0 += v;
      });
      at += pts;
    });
    y = SUB_Y + SUB_H;
  });

  const legend = document.getElementById('legend');
  for (const [kind, text] of F.legend) {
    const item = document.createElement('span');
    item.className = 'item';
    item.style.cssText = c;
    item.innerHTML = `<i class="sw ${kind}"></i>${text}`;
    legend.appendChild(item);
  }
})();
