// Dev-only: validate map topology + find good switch-node candidates.
const fs = require('fs');
const LAYOUTS = JSON.parse(fs.readFileSync(__dirname + '/layouts.json', 'utf8'));

function parse(rows) {
  const H = rows.length, W = Math.max(...rows.map(r => r.length));
  const g = rows.map(r => r.padEnd(W, '#'));
  const cells = [];
  const entrances = [], exits = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = g[y][x];
    const walk = '.oABCXY'.includes(ch);
    const c = { x, y, ch, walk, cost: ch === 'o' ? 1.8 : 1 };
    cells.push(c);
    if ('ABC'.includes(ch)) entrances.push(c);
    if ('XY'.includes(ch)) exits.push(c);
  }
  return { rows: g, W, H, cells, entrances, exits };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => x + ',' + y;

function neighbors(m, c, blocked, costFn) {
  const out = [];
  for (const [dx, dy] of DIRS) {
    const x = c.x + dx, y = c.y + dy;
    if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
    if (!m.rows[y][x].match(/[.oABCXY]/)) continue;
    if (blocked && blocked.has(key(x, y))) continue;
    out.push(m.cells[y * m.W + x]);
  }
  return out;
}

function cellCost(c, costFn) {
  if (costFn) return costFn(c);
  return c.cost;
}

function dijkstra(m, start, blocked, costFn) {
  const dist = new Map(), prev = new Map();
  dist.set(key(start.x, start.y), 0);
  const pq = [[0, start.x, start.y]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, x, y] = pq.shift();
    if (d > (dist.get(key(x, y)) ?? Infinity) + 1e-9) continue;
    const c = m.cells[y * m.W + x];
    for (const n of neighbors(m, c, blocked, costFn)) {
      const nd = d + cellCost(n, costFn);
      if (nd < (dist.get(key(n.x, n.y)) ?? Infinity) - 1e-9) {
        dist.set(key(n.x, n.y), nd);
        prev.set(key(n.x, n.y), c);
        pq.push([nd, n.x, n.y]);
      }
    }
  }
  return { dist, prev };
}

function bestExit(m, dist) {
  let best = null;
  for (const e of m.exits) {
    const d = dist.get(key(e.x, e.y));
    if (d == null) continue;
    if (!best || d < best.dist - 1e-9) best = { exit: e, dist: d };
  }
  return best;
}

function route(m, start, blocked, costFn) {
  const { dist, prev } = dijkstra(m, start, blocked, costFn);
  const best = bestExit(m, dist);
  if (!best) return null;
  const path = [];
  let cur = best.exit;
  while (cur) {
    path.push(cur);
    if (cur === start) break;
    cur = prev.get(key(cur.x, cur.y));
  }
  path.reverse();
  return { path, dist: best.dist, exit: best.exit };
}

function fmt(path) { return path.map(c => `(${c.x},${c.y})`).join('>'); }

function run(name, rows, costFn) {
  const m = parse(rows);
  console.log('\n===== ' + name + ' =====');
  console.log(rows.join('\n'));
  console.log('size', m.W + 'x' + m.H, '| entrances', m.entrances.map(c => c.ch + '(' + c.x + ',' + c.y + ')').join(' '), '| exits', m.exits.map(c => c.ch + '(' + c.x + ',' + c.y + ')').join(' '));
  const base = {};
  for (const a of m.entrances) {
    const r = route(m, a, new Set(), costFn);
    base[a.ch] = r;
    console.log('BASE', a.ch, r ? `dist=${r.dist.toFixed(1)} exit=${r.exit.ch} len=${r.path.length}` : '!! NO ROUTE', r ? fmt(r.path) : '');
  }
  if (Object.values(base).some(r => !r)) return;

  const results = [];
  for (const c of m.cells) {
    if (!c.walk || 'ABCXY'.includes(c.ch)) continue;
    const blocked = new Set([key(c.x, c.y)]);
    const rs = {};
    let ok = true;
    for (const a of m.entrances) { rs[a.ch] = route(m, a, blocked, costFn); if (!rs[a.ch]) ok = false; }
    if (!ok) { results.push({ cell: c, guard: 'DISCONNECT', deg: neighbors(m, c).length }); continue; }
    const changed = [], detours = [];
    for (const a of m.entrances) {
      const oldPath = base[a.ch].path.map(p => key(p.x, p.y));
      const newPath = rs[a.ch].path.map(p => key(p.x, p.y));
      if (oldPath.join('>') !== newPath.join('>')) {
        const set = new Set(oldPath);
        const newOnly = newPath.filter(k => !set.has(k));
        if (newOnly.length >= 3) { changed.push(a.ch); detours.push(`${a.ch}:${newOnly.length}`); }
      }
    }
    if (changed.length) results.push({ cell: c, changed, detours, deg: neighbors(m, c).length });
  }
  results.sort((a, b) => (b.changed?.length || 0) - (a.changed?.length || 0) || (b.deg || 0) - (a.deg || 0));
  console.log('--- switch candidates ---');
  for (const r of results.filter(r => !r.guard).slice(0, 25)) {
    console.log(`(${r.cell.x},${r.cell.y}) deg=${r.deg} chg=${r.changed.join(',')} ${r.detours.join(' ')}`);
  }
  console.log('disconnecting:', results.filter(r => r.guard).map(r => `(${r.cell.x},${r.cell.y})`).join(' '));
  return m;
}

for (const [k, rows] of Object.entries(LAYOUTS)) {
  run(k, rows, c => c.ch === 'o' ? 1.85 : 1);
}
