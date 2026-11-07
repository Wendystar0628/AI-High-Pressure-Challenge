// Dev-only: generate + validate candidate maps.
const fs = require('fs');

function makeMap(W, H) {
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  return {
    g, W, H,
    line(x1, y1, x2, y2, ch = '.') {
      if (x1 !== x2) {
        const step = x2 > x1 ? 1 : -1;
        for (let x = x1; x !== x2 + step; x += step) if (x >= 0 && x < W) g[y1][x] = ch;
      } else {
        const step = y2 > y1 ? 1 : -1;
        for (let y = y1; y !== y2 + step; y += step) if (y >= 0 && y < H) g[y][x1] = ch;
      }
    },
    path(pts, ch = '.') { for (let i = 0; i < pts.length - 1; i++) this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ch); },
    set(x, y, ch) { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch; },
    rect(x1, y1, x2, y2) { this.line(x1, y1, x2, y1); this.line(x2, y1, x2, y2); this.line(x2, y2, x1, y2); this.line(x1, y2, x1, y1); },
    fill(x1, y1, x2, y2, ch) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, ch); },
    rows() { return g.map(r => r.join('')); }
  };
}

// ============ MAP 1 : segmented intranet ============
function map1() {
  const m = makeMap(19, 15);
  // --- DMZ ring
  m.rect(5, 2, 14, 5);
  // --- central DMZ trunk (shared shortest route)
  m.line(9, 2, 9, 5);
  m.line(9, 5, 9, 13);
  // B down to DMZ
  m.line(9, 0, 9, 2);
  // A approach: west edge then north-east
  m.line(0, 3, 5, 3);
  m.line(5, 3, 5, 5);
  m.line(5, 5, 9, 5);
  // --- office ring (west)
  m.rect(2, 5, 8, 9);
  m.line(2, 3, 2, 5);
  m.line(2, 9, 5, 9); m.line(5, 9, 5, 10);
  // --- business ring (east)
  m.rect(10, 5, 16, 9);
  m.line(14, 5, 14, 9);
  m.line(16, 3, 16, 5);
  m.line(14, 9, 14, 10); m.line(10, 9, 10, 10);
  // --- core ring
  m.rect(5, 10, 13, 12);
  // exit apron
  m.line(5, 13, 13, 13);
  m.line(8, 13, 8, 12); m.line(10, 13, 10, 12);
  // --- outer old systems (west) and DR (east), slower
  m.path([[1, 3], [1, 12], [4, 12], [5, 12]], 'o');
  m.path([[17, 3], [17, 12], [14, 12], [13, 12]], 'o');
  m.line(16, 3, 17, 3); m.line(16, 9, 17, 9);
  // old link between office & core
  m.path([[3, 9], [3, 11], [5, 11]], 'o');
  // A entrance & B entrance last
  m.set(0, 3, 'A'); m.set(9, 0, 'B');
  m.set(9, 13, 'X');
  // platforms (inside loops / shoulders)
  [[4, 4], [7, 4], [11, 4], [13, 4], [4, 7], [7, 7], [11, 7], [14, 7], [4, 11], [7, 11], [11, 11], [14, 11], [2, 7], [17, 7], [7, 13], [11, 13]].forEach(([x, y]) => {
    if (m.g[y][x] === '#') m.set(x, y, 'P');
  });
  return m.rows();
}

// ============ MAP 2 : backbone ============
function map2() {
  const m = makeMap(18, 15);
  // top backbone
  m.line(0, 2, 17, 2);
  // two DC trunks
  m.line(4, 2, 4, 12);
  m.line(13, 2, 13, 12);
  // mid aggregation rings
  m.line(4, 4, 13, 4);
  m.line(4, 9, 13, 9);
  m.line(8, 2, 8, 5);
  // public flow band crossing bridges
  m.line(4, 5, 4, 8);
  m.line(13, 5, 13, 8);
  m.line(8, 5, 8, 8);
  // south interconnect (both DCs)
  m.line(4, 12, 13, 12);
  m.line(0, 11, 4, 11);
  m.line(13, 11, 17, 11);
  // old dedicated line (slower) across the field, feeds aggregation node
  m.path([[4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [12, 10], [13, 10]], 'o');
  // merge corridor down to Y (old dedicated, shared by B and C)
  m.path([[13, 9], [13, 10]], 'o');
  m.path([[13, 10], [13, 11]], 'o');
  // DC exit aprons
  m.line(3, 13, 5, 13); m.line(12, 13, 14, 13);
  m.line(4, 12, 4, 13); m.line(13, 12, 13, 13);
  // edge old dedicated lines (slower alternatives)
  m.path([[0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11]], 'o');
  m.path([[17, 2], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11]], 'o');
  // platforms
  [[6, 3], [11, 3], [6, 8], [11, 8], [2, 4], [15, 4], [2, 8], [15, 8], [6, 12], [11, 12], [8, 6], [8, 7], [6, 13], [11, 13], [2, 11], [15, 11], [8, 3], [8, 8], [15, 10], [16, 8]].forEach(([x, y]) => {
    if (m.g[y][x] === '#') m.set(x, y, 'P');
  });
  m.set(0, 2, 'A'); m.set(17, 2, 'B'); m.set(17, 11, 'C');
  m.set(4, 13, 'X'); m.set(13, 13, 'Y');
  return m.rows();
}

// ============ MAP 3 : airgap deep ============
function map3() {
  const m = makeMap(17, 15);
  // outer ring
  m.rect(2, 2, 14, 12);
  // central airgap block (leave void)
  m.fill(5, 4, 11, 10, '#');
  // ops ring around airgap
  m.line(4, 3, 12, 3);
  m.line(4, 11, 12, 11);
  m.line(4, 3, 4, 11);
  m.line(12, 3, 12, 11);
  // four outer<->inner gates
  m.line(2, 3, 4, 3); m.line(2, 11, 4, 11);
  m.line(12, 3, 14, 3); m.line(12, 11, 14, 11);
  // entrances
  m.line(0, 2, 2, 2);
  m.line(8, 0, 8, 2);
  m.line(14, 5, 16, 5);
  // widen exits (two cells each)
  m.line(4, 11, 4, 13); m.line(12, 11, 12, 13);
  m.line(4, 13, 5, 13); m.line(11, 13, 12, 13);
  // old industrial bus at the south, slow
  m.path([[2, 12], [2, 13], [4, 13]], 'o');
  m.path([[4, 13], [8, 13], [12, 13]], 'o');
  m.path([[12, 13], [14, 13], [14, 12]], 'o');
  // supplier west side old path
  m.path([[16, 5], [16, 12], [14, 12]], 'o');
  // inspection platforms around airgap
  [[6, 2], [10, 2], [6, 12], [10, 12], [3, 6], [13, 6], [3, 9], [13, 9], [8, 4], [8, 10]].forEach(([x, y]) => {
    if (m.g[y][x] === '#') m.set(x, y, 'P');
  });
  m.set(0, 2, 'A'); m.set(8, 0, 'B'); m.set(16, 5, 'C');
  m.set(5, 13, 'X'); m.set(11, 13, 'Y');
  return m.rows();
}

const out = { m1: map1(), m2: map2(), m3: map3() };
fs.writeFileSync(__dirname + '/layouts.json', JSON.stringify(out, null, 1));
for (const [k, rows] of Object.entries(out)) console.log('\n== ' + k + ' ==\n' + rows.join('\n'));
