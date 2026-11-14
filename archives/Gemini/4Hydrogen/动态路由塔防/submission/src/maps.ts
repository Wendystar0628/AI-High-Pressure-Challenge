import type { MapDef, MapId, WaveDef } from './types';

function createEmptyGrid(cols: number, rows: number, fill = 'O'): string[][] {
  const g: string[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: string[] = [];
    for (let x = 0; x < cols; x++) {
      if (x === 0 || x === cols - 1 || y === rows - 1) {
        row.push('.');
      } else {
        row.push(fill);
      }
    }
    g.push(row);
  }
  return g;
}

function carvePolyline(
  g: string[][],
  pts: Array<[number, number]>,
  ch: string
): void {
  for (let i = 0; i < pts.length - 1; i++) {
    let [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    g[y0][x0] = ch;
    while (x0 !== x1 || y0 !== y1) {
      if (x0 < x1) x0++;
      else if (x0 > x1) x0--;
      else if (y0 < y1) y0++;
      else if (y0 > y1) y0--;
      g[y0][x0] = ch;
    }
  }
}

function setTiles(
  g: string[][],
  coords: Array<[number, number]>,
  ch: string
): void {
  for (const [x, y] of coords) {
    if (g[y] && x >= 0 && x < g[y].length) {
      g[y][x] = ch;
    }
  }
}

function finalizeGrid(g: string[][]): string[] {
  return g.map((r) => r.join(''));
}

function buildIntranetGrid(): string[] {
  const g = createEmptyGrid(15, 11, 'O');
  // Top border row 0 needs void edges around DMZ link
  for (let x = 0; x < 15; x++) g[0][x] = '.';

  // West Office Main Corridor: A(4,1) -> (4,7) -> (7,7) -> M(7,9)
  carvePolyline(g, [[4, 1], [4, 7], [7, 7], [7, 9]], '=');
  // East Business Main Corridor: B(10,1) -> (10,7) -> (7,7)
  carvePolyline(g, [[10, 1], [10, 7], [7, 7]], '=');

  // DMZ 互联 (top bypass along y=0): (4,1) -> (4,0) -> (10,0) -> (10,1)
  carvePolyline(g, [[4, 1], [4, 0], [10, 0], [10, 1]], '=');

  // Mid Legacy Cross-Bridge along y=4: (4,4) -> (10,4) with legacy middle
  carvePolyline(g, [[4, 4], [10, 4]], '=');
  setTiles(g, [[7, 4]], '~');

  // West Outer Ring (旧系统网段)
  carvePolyline(g, [[4, 1], [1, 1], [1, 9], [7, 9]], '=');
  carvePolyline(g, [[4, 7], [1, 7]], '~');
  setTiles(g, [
    [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7],
  ], '~');

  // East Outer Ring (灾备环)
  carvePolyline(g, [[10, 1], [13, 1], [13, 9], [7, 9]], '=');
  carvePolyline(g, [[10, 7], [13, 7]], '~');
  setTiles(g, [
    [11, 1], [12, 1], [13, 1], [13, 2], [13, 3], [13, 4], [13, 5], [13, 6], [13, 7],
  ], '~');

  // Elevated Device Platforms
  setTiles(g, [
    [3, 2], [5, 2], [9, 2], [11, 2],
    [2, 3], [12, 3],
    [3, 5], [5, 5], [9, 5], [11, 5],
    [2, 6], [6, 6], [8, 6], [12, 6],
    [3, 8], [5, 8], [9, 8], [11, 8],
  ], 'P');

  // Exchange Nodes
  setTiles(g, [
    [4, 3],   // 西边界节点
    [10, 3],  // 业务接入节点
    [4, 6],   // 办公中继节点
    [7, 7],   // 核心前总闸
  ], 'N');

  // Entries & Exit
  setTiles(g, [[4, 1]], 'A');
  setTiles(g, [[10, 1]], 'B');
  setTiles(g, [[7, 9]], 'M');

  return finalizeGrid(g);
}

function buildBackboneGrid(): string[] {
  const g = createEmptyGrid(15, 11, 'O');
  for (let x = 0; x < 15; x++) g[0][x] = '.';

  // Entry A West Tunnel -> N1(2,6) -> X(4,9)
  carvePolyline(g, [[2, 1], [2, 9], [4, 9]], '=');

  // Mid-West Alternate Tunnel across public stream
  carvePolyline(g, [[2, 2], [4, 2], [4, 8], [5, 8]], '=');
  setTiles(g, [[4, 3], [4, 4], [4, 5], [4, 6]], '~');

  // Entry B(10,1) -> N3(9,1) -> C(7,1) -> 旧专线(7,2..7,4) -> N2(7,5) -> N4(6,7) -> X(4,9)
  carvePolyline(g, [[10, 1], [7, 1], [7, 7], [5, 7], [5, 9], [4, 9]], '=');
  setTiles(g, [[7, 2], [7, 3], [7, 4]], '~');

  // South Backbone East branch from (7,7) to Y(11,9)
  carvePolyline(g, [[7, 7], [11, 7], [11, 9]], '=');

  // East Tunnel (东专线隧道): B(10,1) -> (13,1) -> (13,9) -> Y(11,9)
  carvePolyline(g, [[10, 1], [13, 1], [13, 9], [11, 9]], '=');
  setTiles(g, [
    [13, 2], [13, 3], [13, 4], [13, 5], [13, 6], [13, 7],
  ], '~');

  // Elevated Device Platforms
  setTiles(g, [
    [1, 3], [3, 3], [5, 3], [8, 3], [10, 3], [12, 3],
    [1, 5], [3, 5], [5, 5], [9, 5], [11, 5],
    [3, 6], [6, 6], [8, 6], [12, 6],
    [3, 8], [6, 8], [8, 8], [10, 8], [12, 8],
  ], 'P');

  // Exchange Nodes
  setTiles(g, [
    [9, 1],  // 北岸分流节点
    [7, 5],  // 汇聚节点
    [2, 6],  // 西干线节点
    [6, 7],  // 双活南枢纽
  ], 'N');

  // Entries & Exits
  setTiles(g, [[2, 1]], 'A');
  setTiles(g, [[7, 1]], 'C');
  setTiles(g, [[10, 1]], 'B');
  setTiles(g, [[4, 9]], 'X');
  setTiles(g, [[11, 9]], 'Y');

  return finalizeGrid(g);
}

function buildAirgapGrid(): string[] {
  const g = createEmptyGrid(15, 11, 'O');
  for (let x = 0; x < 15; x++) g[0][x] = '.';

  // Inner Ops Maintenance Ring wrapping Central Air-Gap (x=5..8, y=4..6)
  // West: x=3, East: x=10, North: y=2, South: y=8
  carvePolyline(g, [[3, 2], [10, 2], [10, 8], [3, 8], [3, 2]], '=');

  // Entries A(6,0)->(6,2), B(10,0)->(10,2), C(11,6)->(10,6)
  carvePolyline(g, [[6, 0], [6, 2]], '=');
  carvePolyline(g, [[10, 0], [10, 2]], '=');
  carvePolyline(g, [[11, 6], [10, 6]], '=');

  // Exits X(3,10) & Y(10,10)
  carvePolyline(g, [[3, 8], [3, 10]], '=');
  carvePolyline(g, [[10, 8], [10, 10]], '=');

  // West Legacy ICS Bus (老工控总线): (3,2) -> (1,2) -> (1,8) -> (3,8)
  carvePolyline(g, [[3, 2], [1, 2], [1, 8], [3, 8]], '~');
  setTiles(g, [[3, 2], [3, 8]], '=');

  // East Legacy ICS Bus (老工控总线): (10,2) -> (13,2) -> (13,8) -> (10,8)
  carvePolyline(g, [[10, 2], [13, 2], [13, 8], [10, 8]], '~');
  setTiles(g, [[10, 2], [10, 8]], '=');
  // Restore Entry C separator around (11,6)
  setTiles(g, [[11, 5], [11, 7], [12, 6]], 'O');

  // Elevated Device Platforms (around ring & flanking air-gap!)
  setTiles(g, [
    [4, 3], [6, 3], [8, 3], [9, 3],
    [2, 4], [2, 6],
    [4, 5], [9, 5],
    [12, 4], [12, 7],
    [4, 7], [6, 7], [8, 7], [9, 7],
    [2, 9], [4, 9], [9, 9], [11, 9],
  ], 'P');

  // Exchange Nodes
  setTiles(g, [
    [4, 2],   // 北运维节点
    [3, 5],   // 西走廊节点
    [10, 5],  // 东走廊节点
    [10, 9],  // 联锁前总闸
  ], 'N');

  // Entries & Exits
  setTiles(g, [[6, 0]], 'A');
  setTiles(g, [[10, 0]], 'B');
  setTiles(g, [[11, 6]], 'C');
  setTiles(g, [[3, 10]], 'X');
  setTiles(g, [[10, 10]], 'Y');

  return finalizeGrid(g);
}

function makeIntranetWaves(): WaveDef[] {
  return [
    {
      index: 1,
      title: '端口试探',
      intelBonus: 8,
      groups: [
        { enemy: 'worm', count: 5, entryId: 'A', delay: 0.5, interval: 1.45 },
        { enemy: 'worm', count: 4, entryId: 'B', delay: 2.0, interval: 1.55 },
      ],
    },
    {
      index: 2,
      title: '双路渗透',
      intelBonus: 9,
      groups: [
        { enemy: 'worm', count: 6, entryId: 'A', delay: 0.4, interval: 1.25 },
        { enemy: 'worm', count: 6, entryId: 'B', delay: 1.2, interval: 1.25 },
      ],
    },
    {
      index: 3,
      title: '伪装报文',
      intelBonus: 10,
      groups: [
        { enemy: 'worm', count: 5, entryId: 'A', delay: 0.4, interval: 1.3 },
        { enemy: 'trojan', count: 4, entryId: 'B', delay: 1.5, interval: 1.8 },
        { enemy: 'trojan', count: 3, entryId: 'A', delay: 5.0, interval: 2.0 },
      ],
    },
    {
      index: 4,
      title: '节点破壁',
      intelBonus: 11,
      groups: [
        { enemy: 'flood', count: 2, entryId: 'A', delay: 0.5, interval: 3.4 },
        { enemy: 'worm', count: 6, entryId: 'A', delay: 1.8, interval: 1.1 },
        { enemy: 'trojan', count: 4, entryId: 'B', delay: 1.0, interval: 1.65 },
      ],
    },
    {
      index: 5,
      title: '勒索试压',
      intelBonus: 12,
      groups: [
        { enemy: 'worm', count: 6, entryId: 'B', delay: 0.4, interval: 1.15 },
        { enemy: 'ransomware', count: 2, entryId: 'A', delay: 1.8, interval: 3.2 },
        { enemy: 'flood', count: 2, entryId: 'B', delay: 3.0, interval: 3.4 },
      ],
    },
    {
      index: 6,
      title: '无线侧漏',
      intelBonus: 12,
      groups: [
        { enemy: 'hotspot', count: 4, entryId: 'A', delay: 0.8, interval: 2.1 },
        { enemy: 'hotspot', count: 3, entryId: 'B', delay: 2.2, interval: 2.2 },
        { enemy: 'worm', count: 7, entryId: 'A', delay: 1.0, interval: 1.1 },
        { enemy: 'trojan', count: 4, entryId: 'B', delay: 2.0, interval: 1.6 },
      ],
    },
    {
      index: 7,
      title: '加密压制',
      intelBonus: 14,
      groups: [
        { enemy: 'flood', count: 3, entryId: 'A', delay: 0.6, interval: 2.8 },
        { enemy: 'ransomware', count: 3, entryId: 'B', delay: 1.4, interval: 2.6 },
        { enemy: 'trojan', count: 5, entryId: 'A', delay: 2.5, interval: 1.5 },
      ],
    },
    {
      index: 8,
      title: '加壳方阵',
      intelBonus: 14,
      groups: [
        { enemy: 'packer', count: 2, entryId: 'A', delay: 0.6, interval: 3.6 },
        { enemy: 'worm', count: 8, entryId: 'A', delay: 1.0, interval: 0.95 },
        { enemy: 'packer', count: 2, entryId: 'B', delay: 1.5, interval: 3.8 },
        { enemy: 'trojan', count: 5, entryId: 'B', delay: 2.0, interval: 1.35 },
      ],
    },
    {
      index: 9,
      title: '立体强袭',
      intelBonus: 15,
      groups: [
        { enemy: 'hotspot', count: 5, entryId: 'A', delay: 0.5, interval: 1.75 },
        { enemy: 'hotspot', count: 5, entryId: 'B', delay: 1.2, interval: 1.75 },
        { enemy: 'ransomware', count: 3, entryId: 'A', delay: 1.8, interval: 2.4 },
        { enemy: 'flood', count: 3, entryId: 'B', delay: 2.0, interval: 2.7 },
      ],
    },
    {
      index: 10,
      title: '混合洪流',
      intelBonus: 16,
      groups: [
        { enemy: 'packer', count: 3, entryId: 'B', delay: 0.6, interval: 3.0 },
        { enemy: 'flood', count: 4, entryId: 'B', delay: 1.4, interval: 2.5 },
        { enemy: 'trojan', count: 6, entryId: 'A', delay: 0.8, interval: 1.25 },
        { enemy: 'ransomware', count: 3, entryId: 'A', delay: 3.0, interval: 2.5 },
      ],
    },
    {
      index: 11,
      title: '内外夹击',
      intelBonus: 17,
      groups: [
        { enemy: 'worm', count: 10, entryId: 'A', delay: 0.3, interval: 0.8 },
        { enemy: 'packer', count: 3, entryId: 'A', delay: 1.5, interval: 2.8 },
        { enemy: 'ransomware', count: 4, entryId: 'B', delay: 1.0, interval: 2.2 },
        { enemy: 'hotspot', count: 5, entryId: 'B', delay: 2.0, interval: 1.7 },
      ],
    },
    {
      index: 12,
      title: '超载破闸',
      intelBonus: 18,
      groups: [
        { enemy: 'flood', count: 5, entryId: 'A', delay: 0.5, interval: 2.2 },
        { enemy: 'flood', count: 4, entryId: 'B', delay: 1.5, interval: 2.4 },
        { enemy: 'ransomware', count: 4, entryId: 'A', delay: 2.0, interval: 2.2 },
        { enemy: 'trojan', count: 7, entryId: 'B', delay: 1.2, interval: 1.2 },
      ],
    },
    {
      index: 13,
      title: '总攻前夜',
      intelBonus: 20,
      groups: [
        { enemy: 'packer', count: 4, entryId: 'A', delay: 0.4, interval: 2.6 },
        { enemy: 'packer', count: 3, entryId: 'B', delay: 1.0, interval: 2.8 },
        { enemy: 'worm', count: 12, entryId: 'A', delay: 0.8, interval: 0.75 },
        { enemy: 'ransomware', count: 4, entryId: 'B', delay: 2.0, interval: 2.0 },
        { enemy: 'hotspot', count: 6, entryId: 'A', delay: 2.5, interval: 1.5 },
      ],
    },
    {
      index: 14,
      title: '万傀降临',
      intelBonus: 25,
      isBossWave: true,
      groups: [
        { enemy: 'boss_wankui', count: 1, entryId: 'A', delay: 1.0, interval: 1.0 },
        { enemy: 'packer', count: 3, entryId: 'A', delay: 3.0, interval: 3.5 },
        { enemy: 'flood', count: 4, entryId: 'B', delay: 2.5, interval: 2.8 },
        { enemy: 'ransomware', count: 3, entryId: 'B', delay: 4.5, interval: 3.0 },
        { enemy: 'hotspot', count: 5, entryId: 'A', delay: 5.5, interval: 2.2 },
      ],
    },
  ];
}

function makeBackboneWaves(): WaveDef[] {
  return [
    {
      index: 1,
      title: '专线侦测',
      intelBonus: 9,
      groups: [
        { enemy: 'worm', count: 5, entryId: 'A', delay: 0.4, interval: 1.35 },
        { enemy: 'worm', count: 4, entryId: 'C', delay: 1.5, interval: 1.5 },
      ],
    },
    {
      index: 2,
      title: '三网并发',
      intelBonus: 10,
      groups: [
        { enemy: 'worm', count: 5, entryId: 'A', delay: 0.4, interval: 1.2 },
        { enemy: 'worm', count: 5, entryId: 'C', delay: 1.0, interval: 1.2 },
        { enemy: 'trojan', count: 3, entryId: 'B', delay: 1.8, interval: 1.9 },
      ],
    },
    {
      index: 3,
      title: '隐匿走私',
      intelBonus: 11,
      groups: [
        { enemy: 'trojan', count: 5, entryId: 'A', delay: 0.5, interval: 1.5 },
        { enemy: 'worm', count: 6, entryId: 'B', delay: 1.0, interval: 1.15 },
        { enemy: 'flood', count: 2, entryId: 'C', delay: 2.5, interval: 3.0 },
      ],
    },
    {
      index: 4,
      title: '无线跨流',
      intelBonus: 12,
      groups: [
        { enemy: 'hotspot', count: 4, entryId: 'A', delay: 0.6, interval: 1.9 },
        { enemy: 'hotspot', count: 4, entryId: 'B', delay: 1.4, interval: 1.9 },
        { enemy: 'flood', count: 3, entryId: 'C', delay: 1.2, interval: 2.7 },
      ],
    },
    {
      index: 5,
      title: '加密压境',
      intelBonus: 13,
      groups: [
        { enemy: 'ransomware', count: 3, entryId: 'A', delay: 0.8, interval: 2.6 },
        { enemy: 'worm', count: 8, entryId: 'C', delay: 0.5, interval: 1.0 },
        { enemy: 'trojan', count: 4, entryId: 'B', delay: 2.0, interval: 1.6 },
      ],
    },
    {
      index: 6,
      title: '护壳推进',
      intelBonus: 14,
      groups: [
        { enemy: 'packer', count: 2, entryId: 'C', delay: 0.6, interval: 3.4 },
        { enemy: 'worm', count: 8, entryId: 'C', delay: 1.0, interval: 0.9 },
        { enemy: 'flood', count: 3, entryId: 'B', delay: 1.5, interval: 2.6 },
        { enemy: 'ransomware', count: 2, entryId: 'A', delay: 2.5, interval: 3.0 },
      ],
    },
    {
      index: 7,
      title: '公网洪峰',
      intelBonus: 18,
      isSurgeWave: true,
      groups: [
        { enemy: 'worm', count: 10, entryId: 'A', delay: 0.3, interval: 0.72, isSurge: true },
        { enemy: 'trojan', count: 6, entryId: 'A', delay: 2.2, interval: 1.15, isSurge: true },
        { enemy: 'flood', count: 5, entryId: 'C', delay: 0.5, interval: 1.85, isSurge: true },
        { enemy: 'packer', count: 3, entryId: 'C', delay: 1.5, interval: 2.6, isSurge: true },
        { enemy: 'ransomware', count: 4, entryId: 'B', delay: 0.8, interval: 1.9, isSurge: true },
        { enemy: 'hotspot', count: 6, entryId: 'B', delay: 1.5, interval: 1.4, isSurge: true },
      ],
    },
    {
      index: 8,
      title: '双活拉锯',
      intelBonus: 15,
      groups: [
        { enemy: 'packer', count: 3, entryId: 'A', delay: 0.6, interval: 2.9 },
        { enemy: 'ransomware', count: 3, entryId: 'C', delay: 1.0, interval: 2.5 },
        { enemy: 'flood', count: 3, entryId: 'B', delay: 1.8, interval: 2.5 },
      ],
    },
    {
      index: 9,
      title: '高频突袭',
      intelBonus: 16,
      groups: [
        { enemy: 'hotspot', count: 6, entryId: 'A', delay: 0.5, interval: 1.5 },
        { enemy: 'hotspot', count: 5, entryId: 'C', delay: 1.2, interval: 1.6 },
        { enemy: 'worm', count: 10, entryId: 'B', delay: 0.6, interval: 0.85 },
        { enemy: 'trojan', count: 5, entryId: 'B', delay: 2.5, interval: 1.4 },
      ],
    },
    {
      index: 10,
      title: '重装拆桥',
      intelBonus: 17,
      groups: [
        { enemy: 'flood', count: 5, entryId: 'C', delay: 0.5, interval: 2.1 },
        { enemy: 'flood', count: 4, entryId: 'A', delay: 1.5, interval: 2.3 },
        { enemy: 'ransomware', count: 4, entryId: 'B', delay: 1.8, interval: 2.2 },
      ],
    },
    {
      index: 11,
      title: '暗流并发',
      intelBonus: 18,
      groups: [
        { enemy: 'trojan', count: 7, entryId: 'A', delay: 0.4, interval: 1.15 },
        { enemy: 'packer', count: 3, entryId: 'B', delay: 0.8, interval: 2.7 },
        { enemy: 'ransomware', count: 4, entryId: 'C', delay: 1.4, interval: 2.1 },
        { enemy: 'hotspot', count: 5, entryId: 'A', delay: 3.0, interval: 1.7 },
      ],
    },
    {
      index: 12,
      title: '专线失压',
      intelBonus: 19,
      groups: [
        { enemy: 'packer', count: 4, entryId: 'C', delay: 0.4, interval: 2.4 },
        { enemy: 'worm', count: 12, entryId: 'B', delay: 0.8, interval: 0.72 },
        { enemy: 'flood', count: 4, entryId: 'A', delay: 1.5, interval: 2.2 },
        { enemy: 'ransomware', count: 4, entryId: 'B', delay: 2.5, interval: 2.1 },
      ],
    },
    {
      index: 13,
      title: '全网压迫',
      intelBonus: 20,
      groups: [
        { enemy: 'flood', count: 5, entryId: 'A', delay: 0.4, interval: 2.0 },
        { enemy: 'packer', count: 4, entryId: 'B', delay: 0.8, interval: 2.5 },
        { enemy: 'ransomware', count: 5, entryId: 'C', delay: 1.2, interval: 1.9 },
        { enemy: 'hotspot', count: 7, entryId: 'B', delay: 2.0, interval: 1.35 },
      ],
    },
    {
      index: 14,
      title: '枢纽死战',
      intelBonus: 22,
      groups: [
        { enemy: 'packer', count: 4, entryId: 'A', delay: 0.4, interval: 2.3 },
        { enemy: 'trojan', count: 8, entryId: 'C', delay: 0.8, interval: 1.05 },
        { enemy: 'flood', count: 5, entryId: 'B', delay: 1.2, interval: 2.0 },
        { enemy: 'ransomware', count: 4, entryId: 'A', delay: 2.5, interval: 2.0 },
      ],
    },
    {
      index: 15,
      title: '蜃楼幻象',
      intelBonus: 28,
      isBossWave: true,
      groups: [
        { enemy: 'boss_shenlou', count: 1, entryId: 'C', delay: 1.0, interval: 1.0 },
        { enemy: 'packer', count: 3, entryId: 'A', delay: 2.5, interval: 3.0 },
        { enemy: 'flood', count: 4, entryId: 'B', delay: 2.0, interval: 2.5 },
        { enemy: 'ransomware', count: 4, entryId: 'C', delay: 4.5, interval: 2.6 },
        { enemy: 'hotspot', count: 6, entryId: 'A', delay: 5.0, interval: 1.9 },
      ],
    },
  ];
}

function makeAirgapWaves(): WaveDef[] {
  return [
    {
      index: 1,
      title: '气隙渗透',
      intelBonus: 10,
      groups: [
        { enemy: 'worm', count: 6, entryId: 'A', delay: 0.4, interval: 1.25 },
        { enemy: 'worm', count: 5, entryId: 'B', delay: 1.4, interval: 1.35 },
      ],
    },
    {
      index: 2,
      title: '三端接入',
      intelBonus: 11,
      groups: [
        { enemy: 'worm', count: 6, entryId: 'A', delay: 0.4, interval: 1.15 },
        { enemy: 'trojan', count: 4, entryId: 'B', delay: 1.0, interval: 1.6 },
        { enemy: 'worm', count: 5, entryId: 'C', delay: 1.6, interval: 1.25 },
      ],
    },
    {
      index: 3,
      title: '总线劫持',
      intelBonus: 12,
      groups: [
        { enemy: 'flood', count: 3, entryId: 'A', delay: 0.5, interval: 2.7 },
        { enemy: 'trojan', count: 5, entryId: 'C', delay: 1.2, interval: 1.4 },
        { enemy: 'worm', count: 6, entryId: 'B', delay: 1.8, interval: 1.1 },
      ],
    },
    {
      index: 4,
      title: '侧翼空降',
      intelBonus: 13,
      groups: [
        { enemy: 'hotspot', count: 5, entryId: 'A', delay: 0.6, interval: 1.7 },
        { enemy: 'hotspot', count: 4, entryId: 'C', delay: 1.6, interval: 1.8 },
        { enemy: 'ransomware', count: 2, entryId: 'B', delay: 1.5, interval: 2.8 },
      ],
    },
    {
      index: 5,
      title: '联锁告警',
      intelBonus: 14,
      groups: [
        { enemy: 'ransomware', count: 3, entryId: 'A', delay: 0.5, interval: 2.4 },
        { enemy: 'flood', count: 3, entryId: 'B', delay: 1.2, interval: 2.5 },
        { enemy: 'trojan', count: 5, entryId: 'C', delay: 1.8, interval: 1.35 },
      ],
    },
    {
      index: 6,
      title: '硬壳纵队',
      intelBonus: 15,
      groups: [
        { enemy: 'packer', count: 3, entryId: 'A', delay: 0.5, interval: 2.9 },
        { enemy: 'worm', count: 9, entryId: 'A', delay: 1.0, interval: 0.85 },
        { enemy: 'ransomware', count: 3, entryId: 'C', delay: 1.8, interval: 2.3 },
      ],
    },
    {
      index: 7,
      title: '运维环围剿',
      intelBonus: 16,
      groups: [
        { enemy: 'flood', count: 4, entryId: 'B', delay: 0.5, interval: 2.2 },
        { enemy: 'packer', count: 3, entryId: 'C', delay: 1.0, interval: 2.7 },
        { enemy: 'hotspot', count: 6, entryId: 'A', delay: 1.5, interval: 1.5 },
        { enemy: 'trojan', count: 6, entryId: 'B', delay: 2.2, interval: 1.3 },
      ],
    },
    {
      index: 8,
      title: '深层洪峰',
      intelBonus: 20,
      isSurgeWave: true,
      groups: [
        { enemy: 'worm', count: 11, entryId: 'A', delay: 0.3, interval: 0.68, isSurge: true },
        { enemy: 'packer', count: 3, entryId: 'A', delay: 1.5, interval: 2.5, isSurge: true },
        { enemy: 'flood', count: 5, entryId: 'B', delay: 0.4, interval: 1.8, isSurge: true },
        { enemy: 'ransomware', count: 4, entryId: 'B', delay: 1.6, interval: 2.0, isSurge: true },
        { enemy: 'trojan', count: 7, entryId: 'C', delay: 0.5, interval: 1.1, isSurge: true },
        { enemy: 'hotspot', count: 6, entryId: 'C', delay: 1.4, interval: 1.4, isSurge: true },
      ],
    },
    {
      index: 9,
      title: '双核牵制',
      intelBonus: 17,
      groups: [
        { enemy: 'packer', count: 3, entryId: 'B', delay: 0.5, interval: 2.6 },
        { enemy: 'ransomware', count: 4, entryId: 'A', delay: 1.0, interval: 2.1 },
        { enemy: 'flood', count: 4, entryId: 'C', delay: 1.5, interval: 2.2 },
      ],
    },
    {
      index: 10,
      title: '无线饱和',
      intelBonus: 18,
      groups: [
        { enemy: 'hotspot', count: 7, entryId: 'A', delay: 0.4, interval: 1.35 },
        { enemy: 'hotspot', count: 6, entryId: 'B', delay: 1.0, interval: 1.45 },
        { enemy: 'trojan', count: 7, entryId: 'C', delay: 1.2, interval: 1.15 },
        { enemy: 'ransomware', count: 3, entryId: 'B', delay: 2.5, interval: 2.2 },
      ],
    },
    {
      index: 11,
      title: '老总线渗漏',
      intelBonus: 19,
      groups: [
        { enemy: 'flood', count: 5, entryId: 'A', delay: 0.4, interval: 2.0 },
        { enemy: 'packer', count: 4, entryId: 'C', delay: 1.0, interval: 2.4 },
        { enemy: 'worm', count: 12, entryId: 'B', delay: 0.8, interval: 0.72 },
      ],
    },
    {
      index: 12,
      title: '密钥风暴',
      intelBonus: 20,
      groups: [
        { enemy: 'ransomware', count: 5, entryId: 'A', delay: 0.4, interval: 1.85 },
        { enemy: 'ransomware', count: 4, entryId: 'C', delay: 1.2, interval: 2.0 },
        { enemy: 'packer', count: 4, entryId: 'B', delay: 1.5, interval: 2.3 },
        { enemy: 'flood', count: 4, entryId: 'A', delay: 2.5, interval: 2.1 },
      ],
    },
    {
      index: 13,
      title: '气隙撕裂',
      intelBonus: 21,
      groups: [
        { enemy: 'packer', count: 4, entryId: 'A', delay: 0.4, interval: 2.3 },
        { enemy: 'trojan', count: 8, entryId: 'B', delay: 0.8, interval: 1.0 },
        { enemy: 'hotspot', count: 7, entryId: 'C', delay: 1.2, interval: 1.35 },
        { enemy: 'flood', count: 5, entryId: 'B', delay: 2.0, interval: 2.0 },
      ],
    },
    {
      index: 14,
      title: '重装甲群',
      intelBonus: 22,
      groups: [
        { enemy: 'flood', count: 6, entryId: 'B', delay: 0.4, interval: 1.85 },
        { enemy: 'packer', count: 4, entryId: 'C', delay: 0.8, interval: 2.2 },
        { enemy: 'ransomware', count: 5, entryId: 'A', delay: 1.2, interval: 1.85 },
        { enemy: 'worm', count: 12, entryId: 'A', delay: 2.0, interval: 0.7 },
      ],
    },
    {
      index: 15,
      title: '临战警报',
      intelBonus: 24,
      groups: [
        { enemy: 'packer', count: 5, entryId: 'A', delay: 0.4, interval: 2.1 },
        { enemy: 'flood', count: 5, entryId: 'C', delay: 0.8, interval: 1.95 },
        { enemy: 'ransomware', count: 5, entryId: 'B', delay: 1.0, interval: 1.85 },
        { enemy: 'hotspot', count: 8, entryId: 'A', delay: 2.0, interval: 1.25 },
      ],
    },
    {
      index: 16,
      title: '蛰影现身',
      intelBonus: 35,
      isBossWave: true,
      groups: [
        { enemy: 'boss_zheying', count: 1, entryId: 'A', delay: 1.0, interval: 1.0 },
        { enemy: 'packer', count: 3, entryId: 'B', delay: 2.5, interval: 3.0 },
        { enemy: 'ransomware', count: 4, entryId: 'C', delay: 3.0, interval: 2.4 },
        { enemy: 'flood', count: 4, entryId: 'B', delay: 4.5, interval: 2.6 },
        { enemy: 'hotspot', count: 6, entryId: 'C', delay: 5.5, interval: 1.8 },
      ],
    },
  ];
}

export const MAP_DEFS: Record<MapId, MapDef> = {
  intranet: {
    id: 'intranet',
    name: '分段内网',
    subtitle: '企业核心网段 · DMZ 与灾备环',
    networkTag: 'AS-4108 // CORP-DMZ',
    difficulty: '标准架构 · 14 波',
    description:
      '入口 A“门户网站”与入口 B“邮件网关”直连 DMZ，南端为企业“核心数据库”。隔离西边界节点可逼迫 A 改走 DMZ 互联与 B 汇流；隔离核心前总闸则令双路流量分流至外围旧系统网段与灾备环。',
    tacticalTip:
      '善用 DMZ 互联与中段旧链路把敌军集中进东侧平台火力网；关键时刻隔离核心前总闸可为中枢换取绕行外环的缓冲时间。',
    cols: 15,
    rows: 11,
    startCompute: 250,
    startIntel: 30,
    maxIntegrity: 20,
    grid: buildIntranetGrid(),
    entries: [
      { id: 'A', name: '门户网站', x: 4, y: 1, color: '#38bdf8', hex: 0x38bdf8 },
      { id: 'B', name: '邮件网关', x: 10, y: 1, color: '#fb923c', hex: 0xfb923c },
    ],
    exits: [{ id: 'M', name: '核心数据库', x: 7, y: 9 }],
    nodeNames: {
      '4,3': '西边界节点',
      '10,3': '业务接入节点',
      '4,6': '办公中继节点',
      '7,7': '核心前总闸',
    },
    waves: makeIntranetWaves(),
  },

  backbone: {
    id: 'backbone',
    name: '骨干流域',
    subtitle: '跨网专线 · 双活数据中心',
    networkTag: 'AS-8820 // BACKBONE-IX',
    difficulty: '进阶拓扑 · 15 波',
    description:
      '公网流横贯战场中央。入口 A“互联网”经西专线隧道直指数据中心 X；C“分支专线”与 B“云端互联”平时经旧专线汇流于汇聚节点。隔离汇聚节点可将其整股导向数据中心 Y，彻底重构全图交战分布。',
    tacticalTip:
      '第 7 波将爆发三路齐发的「公网洪峰」。密切留意洪泛团对汇聚节点的重击——一旦网闸失守，旁路直通将瞬间反转东西两翼防线压力。',
    cols: 15,
    rows: 11,
    startCompute: 270,
    startIntel: 34,
    maxIntegrity: 20,
    grid: buildBackboneGrid(),
    entries: [
      { id: 'A', name: '互联网', x: 2, y: 1, color: '#38bdf8', hex: 0x38bdf8 },
      { id: 'C', name: '分支专线', x: 7, y: 1, color: '#c084fc', hex: 0xc084fc },
      { id: 'B', name: '云端互联', x: 10, y: 1, color: '#fb923c', hex: 0xfb923c },
    ],
    exits: [
      { id: 'X', name: '数据中心 X', x: 4, y: 9 },
      { id: 'Y', name: '数据中心 Y', x: 11, y: 9 },
    ],
    nodeNames: {
      '9,1': '北岸分流节点',
      '7,5': '汇聚节点',
      '2,6': '西干线节点',
      '6,7': '双活南枢纽',
    },
    waves: makeBackboneWaves(),
  },

  airgap: {
    id: 'airgap',
    name: '气隙深层',
    subtitle: '工控核心 · 中央物理气隙',
    networkTag: 'AS-9901 // ICS-AIRGAP',
    difficulty: '高危攻坚 · 16 波',
    description:
      '三处入口环绕中央物理气隙接入，守护南端的“过程控制核心 X”与“安全联锁核心 Y”。运维环贴气隙连通南北，外侧老工控总线构成低速支路。隔离运维环节点将在两侧狭窄通道间转移流量，令双核心防守相互牵制。',
    tacticalTip:
      '第 16 波最终首领「蛰影」会锁死一段运维环。请提前在老工控总线外侧预留拦截扇区，并配好沙箱与冗余切换应对潜伏与加密。',
    cols: 15,
    rows: 11,
    startCompute: 295,
    startIntel: 38,
    maxIntegrity: 20,
    grid: buildAirgapGrid(),
    entries: [
      { id: 'A', name: '运维跳板机', x: 6, y: 0, color: '#38bdf8', hex: 0x38bdf8 },
      { id: 'B', name: '办公网下行', x: 10, y: 0, color: '#fb923c', hex: 0xfb923c },
      { id: 'C', name: '供应商远程维护', x: 11, y: 6, color: '#c084fc', hex: 0xc084fc },
    ],
    exits: [
      { id: 'X', name: '过程控制核心 X', x: 3, y: 10 },
      { id: 'Y', name: '安全联锁核心 Y', x: 10, y: 10 },
    ],
    nodeNames: {
      '4,2': '北运维节点',
      '3,5': '西走廊节点',
      '10,5': '东走廊节点',
      '10,9': '联锁前总闸',
    },
    waves: makeAirgapWaves(),
  },
};

export const MAP_ORDER: MapId[] = ['intranet', 'backbone', 'airgap'];
