/* 动态路由塔防 · 三张地图
 * 路网用程序化绘制生成，避免手写字符串错位。
 * 字符：. 深渊 / = 链路 / o 旧链路 / P 设备平台 / # 障碍 / ~ 公网流 / N 交换节点
 *       A B C 入口 / S X Y 出口（中枢） */
(function () {
  'use strict';
  var TD = window.TD = window.TD || {};

  function makeRows(W, H) {
    var r = []; for (var z = 0; z < H; z++) { var a = []; for (var x = 0; x < W; x++) a.push('.'); r.push(a); } return r;
  }
  function hline(r, x0, x1, z, ch) { for (var x = x0; x <= x1; x++) r[z][x] = ch; }
  function vline(r, z0, z1, x, ch) { for (var z = z0; z <= z1; z++) r[z][x] = ch; }
  function put(r, x, z, ch) { r[z][x] = ch; }

  // ---------------- 地图1 分段内网 ----------------
  function map1() {
    var W = 17, H = 13, r = makeRows(W, H);
    // 三条纵向走廊：办公网段 / DMZ互联（旧协议段）/ 业务网段
    vline(r, 1, 9, 4, '='); vline(r, 1, 9, 12, '=');
    vline(r, 1, 9, 8, 'o');    // DMZ 互联为旧协议走廊，通行较慢
    // 外围旧系统网段（灾备环两侧，贯通到底部）
    vline(r, 1, 10, 2, '='); vline(r, 1, 10, 14, '=');
    // 横向连接
    hline(r, 2, 14, 1, '=');   // 顶部 DMZ 横连
    hline(r, 4, 12, 5, '=');   // 中部旧链路横连
    hline(r, 2, 14, 9, '=');   // 灾备环上沿
    // 底部外环仅 2 / 8 / 14 三处接入点，核心前节点成为瓶颈
    hline(r, 2, 14, 11, '=');  // 核心接入总线
    // 旧链路：办公网段与 DMZ 互联之间的一段旧协议
    for (var x = 4; x <= 7; x++) put(r, x, 5, 'o');
    // 入口 / 出口
    put(r, 5, 0, 'A'); put(r, 11, 0, 'B');
    put(r, 8, 12, 'S');
    // 交换节点（均位于 A / B 主路或汇流瓶颈上）
    var nodes = [
      [4, 1, '西边界节点', 'border'], [4, 5, '办公网段节点', 'seg'], [4, 9, '灾备环·西', 'ring'],
      [12, 1, '东边界节点', 'border'], [12, 5, '业务网段节点', 'seg'], [12, 9, '灾备环·东', 'ring'],
      [8, 10, '核心前节点', 'core']
    ];
    nodes.forEach(function (n) { put(r, n[0], n[1], 'N'); });
    // 平台与障碍点缀（内区空地，不影响路网）
    [[3, 3, 'P'], [6, 3, 'P'], [10, 3, 'P'], [13, 3, 'P'],
    [3, 7, 'P'], [6, 7, 'P'], [10, 7, 'P'], [13, 7, 'P']].forEach(function (p) { put(r, p[0], p[1], p[2]); });
    [[6, 2, '#'], [10, 2, '#'], [3, 5, '#'], [13, 5, '#'], [6, 8, '#'], [10, 8, '#'],
    [3, 2, '#'], [13, 2, '#'], [3, 8, '#'], [13, 8, '#']].forEach(function (p) { put(r, p[0], p[1], p[2]); });
    return build({
      id: 'intranet', name: '分段内网', sub: '企业网 · 14 波', waves: 14, W: W, H: H, rows: r,
      oldCost: 2.4, coreName: '核心数据库',
      entries: [{ id: 'A', x: 5, z: 0, name: '门户网站' }, { id: 'B', x: 11, z: 0, name: '邮件网关' }],
      exits: [{ id: 'S', x: 8, z: 12, name: '核心数据库' }],
      nodeDefs: nodes,
      lore: '办公网段与业务网段经 DMZ 互联及一段旧链路相连，外围旧系统网段与灾备环亦可绕行至核心。',
      env: { bg: '#040913', fog: '#050d1a', link: '#1b4a63', old: '#7a5a2a', node: '#39d0e6', platform: '#0d3346', edge: '#2ea7c8', accent: '#ffb35c', grid: '#0e5a72', ambience: 'corp' }
    });
  }

  // ---------------- 地图2 骨干流域 ----------------
  function map2() {
    var W = 17, H = 13, r = makeRows(W, H);
    // 公网流横贯战场（不可通行/不可部署），仅三个跨越点贯通南北
    hline(r, 0, 16, 6, '~');
    // 北半区：入口汇流
    hline(r, 3, 13, 1, '='); hline(r, 3, 13, 3, '=');
    vline(r, 1, 5, 4, '='); vline(r, 1, 5, 8, '='); vline(r, 1, 5, 12, '=');
    // 南半区：双活数据中心
    hline(r, 3, 13, 9, '='); hline(r, 3, 13, 11, '=');
    vline(r, 7, 11, 4, '='); vline(r, 7, 11, 8, '='); vline(r, 7, 11, 12, '=');
    // 跨越点：专线隧道 / 旧专线 / 云端隧道
    put(r, 4, 6, '='); put(r, 8, 6, 'o'); put(r, 12, 6, '=');
    // 旧专线段（云端与分支平时经旧专线汇流）
    for (var z = 1; z <= 5; z++) put(r, 8, z, 'o');
    // 入口 / 出口
    put(r, 4, 0, 'A'); put(r, 8, 0, 'C'); put(r, 12, 0, 'B');
    put(r, 4, 12, 'X'); put(r, 12, 12, 'Y');
    var nodes = [
      [4, 3, '互联网汇聚', 'hub'], [12, 3, '云端汇聚', 'hub'],
      [4, 6, '专线隧道', 'cross'], [12, 6, '云端隧道', 'cross'],
      [4, 9, '数据中心X·前', 'dc'], [12, 9, '数据中心Y·前', 'dc']
    ];
    nodes.forEach(function (n) { put(r, n[0], n[1], 'N'); });
    [[5, 2, 'P'], [11, 2, 'P'], [5, 4, 'P'], [11, 4, 'P'],
    [5, 8, 'P'], [11, 8, 'P'], [5, 10, 'P'], [11, 10, 'P']].forEach(function (p) { put(r, p[0], p[1], p[2]); });
    [[3, 2, '#'], [13, 2, '#'], [3, 4, '#'], [13, 4, '#'],
    [3, 8, '#'], [13, 8, '#'], [3, 10, '#'], [13, 10, '#']].forEach(function (p) { put(r, p[0], p[1], p[2]); });
    return build({
      id: 'backbone', name: '骨干流域', sub: '跨网专线与双活数据中心 · 15 波', waves: 15, W: W, H: H, rows: r,
      oldCost: 2.2, coreName: '双活数据中心',
      entries: [{ id: 'A', x: 4, z: 0, name: '互联网' }, { id: 'C', x: 8, z: 0, name: '分支专线' }, { id: 'B', x: 12, z: 0, name: '云端互联' }],
      exits: [{ id: 'X', x: 4, z: 12, name: '数据中心 X' }, { id: 'Y', x: 12, z: 12, name: '数据中心 Y' }],
      nodeDefs: nodes,
      lore: '公网流横贯战场，专线隧道与旧专线构成不同跨越点；隔离汇聚节点可把分支与云端流量导向另一座数据中心。',
      env: { bg: '#080512', fog: '#0d081c', link: '#3a2f6b', old: '#7a4a1f', node: '#d070ff', platform: '#241a45', edge: '#8a5cff', accent: '#ff5fa8', grid: '#4a2f8a', ambience: 'backbone' }
    });
  }

  // ---------------- 地图3 气隙深层 ----------------
  function map3() {
    var W = 17, H = 13, r = makeRows(W, H);
    // 顶部接入
    hline(r, 3, 13, 1, '=');
    vline(r, 1, 3, 4, '='); vline(r, 1, 3, 8, '='); vline(r, 1, 3, 12, '=');
    // 运维环：上沿 / 下沿 / 左右狭窄通道
    hline(r, 4, 12, 3, '='); hline(r, 4, 12, 9, '=');
    vline(r, 3, 9, 4, '='); vline(r, 3, 9, 12, '=');
    // 中央气隙
    for (var z = 4; z <= 8; z++) for (var x = 6; x <= 10; x++) put(r, x, z, '#');
    // 老工控总线（较慢的旧链路支路）
    vline(r, 3, 9, 2, 'o'); put(r, 3, 3, 'o'); put(r, 3, 9, 'o');
    // 底部：两座核心
    vline(r, 9, 11, 4, '='); vline(r, 9, 11, 12, '=');
    hline(r, 4, 12, 10, '='); hline(r, 4, 12, 11, '=');
    // 入口 / 出口
    put(r, 4, 0, 'A'); put(r, 8, 0, 'B'); put(r, 12, 0, 'C');
    put(r, 6, 12, 'X'); put(r, 10, 12, 'Y');
    var nodes = [
      [4, 3, '运维环·西北', 'ring'], [12, 3, '运维环·东北', 'ring'],
      [4, 6, '西侧狭窄通道', 'lane'], [12, 6, '东侧狭窄通道', 'lane'],
      [4, 9, '运维环·西南', 'ring'], [12, 9, '运维环·东南', 'ring'],
      [6, 11, '过程控制·前', 'core'], [10, 11, '安全联锁·前', 'core']
    ];
    nodes.forEach(function (n) { put(r, n[0], n[1], 'N'); });
    [[5, 2, 'P'], [11, 2, 'P'], [5, 5, 'P'], [11, 5, 'P'], [5, 7, 'P'], [11, 7, 'P'],
    [5, 10, 'P'], [11, 10, 'P']].forEach(function (p) { put(r, p[0], p[1], p[2]); });
    [[3, 5, '#'], [13, 5, '#'], [3, 7, '#'], [13, 7, '#'], [3, 10, '#'], [13, 10, '#']].forEach(function (p) { put(r, p[0], p[1], p[2]); });
    return build({
      id: 'airgap', name: '气隙深层', sub: '工控网 · 16 波', waves: 16, W: W, H: H, rows: r,
      oldCost: 2.6, coreName: '过程控制与安全联锁核心',
      entries: [{ id: 'A', x: 4, z: 0, name: '运维跳板机' }, { id: 'B', x: 8, z: 0, name: '办公网下行' }, { id: 'C', x: 12, z: 0, name: '供应商远程维护' }],
      exits: [{ id: 'X', x: 6, z: 12, name: '过程控制核心 X' }, { id: 'Y', x: 10, z: 12, name: '安全联锁核心 Y' }],
      nodeDefs: nodes,
      lore: '运维环绕过中央气隙连通南北，老工控总线组成较慢支路；隔离不同节点会让入侵流量在两侧狭窄通道间转移。',
      env: { bg: '#050906', fog: '#080e0a', link: '#2c5233', old: '#7a6320', node: '#7fe08a', platform: '#16351f', edge: '#4fbf72', accent: '#ffc241', grid: '#1f6a35', ambience: 'ics' }
    });
  }

  // ---------------- 通用构建 ----------------
  function build(def) {
    var W = def.W, H = def.H, rows = def.rows;
    var grid = [], nodeAt = {}, platforms = [], obstacles = [], links = [];
    for (var z = 0; z < H; z++) {
      var line = [];
      for (var x = 0; x < W; x++) line.push({ t: rows[z][x], x: x, z: z });
      grid.push(line);
    }
    var nodes = [];
    for (var i = 0; i < def.nodeDefs.length; i++) {
      var n = def.nodeDefs[i], id = def.id + '-n' + i;
      nodeAt[n[0] + ',' + n[1]] = id;
      nodes.push({ id: id, x: n[0], z: n[1], name: n[2], kind: n[3] });
    }
    for (var zz = 0; zz < H; zz++) for (var xx = 0; xx < W; xx++) {
      var t = grid[zz][xx].t;
      if (t === 'P') platforms.push({ x: xx, z: zz });
      else if (t === '#' || t === '~') obstacles.push({ x: xx, z: zz, kind: t });
      else if (t === '=' || t === 'o' || t === 'N' || t === 'A' || t === 'B' || t === 'C' || t === 'S' || t === 'X' || t === 'Y') links.push({ x: xx, z: zz });
    }
    return {
      id: def.id, name: def.name, sub: def.sub, waves: def.waves, W: W, H: H, oldCost: def.oldCost,
      coreName: def.coreName, lore: def.lore, env: def.env,
      grid: grid, nodeAt: nodeAt, nodes: nodes, platforms: platforms, obstacles: obstacles, links: links,
      entries: def.entries, exits: def.exits,
      CELL: 1.45
    };
  }

  TD.Maps = {
    list: [map1(), map2(), map3()],
    byId: function (id) { for (var i = 0; i < this.list.length; i++) if (this.list[i].id === id) return this.list[i]; return this.list[0]; },
    // 世界坐标（地图中心为原点）
    wx: function (map, x) { return (x - (map.W - 1) / 2) * map.CELL; },
    wz: function (map, z) { return (z - (map.H - 1) / 2) * map.CELL; }
  };
})();
