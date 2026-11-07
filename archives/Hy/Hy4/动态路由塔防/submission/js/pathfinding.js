/* 动态路由塔防 · 寻路与改道
 * 核心：反向 Dijkstra 距离场（每格到最近出口的代价），敌人沿梯度前进。
 * 通行变化只需重建距离场，各入口路线与场上敌人自动收敛。 */
(function () {
  'use strict';
  var TD = window.TD = window.TD || {};
  var INF = 1e9;
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 北 东 南 西（固定顺序，保证确定性）

  function Heap() { this.a = []; }
  Heap.prototype.push = function (d, idx) {
    var a = this.a, n = { d: d, i: idx }; a.push(n);
    var c = a.length - 1;
    while (c > 0) {
      var p = (c - 1) >> 1;
      if (a[p].d < a[c].d || (a[p].d === a[c].d && a[p].i <= a[c].i)) break;
      var t = a[p]; a[p] = a[c]; a[c] = t; c = p;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; var c = 0;
      while (true) {
        var l = c * 2 + 1, r = l + 1, m = c;
        if (l < a.length && (a[l].d < a[m].d || (a[l].d === a[m].d && a[l].i < a[m].i))) m = l;
        if (r < a.length && (a[r].d < a[m].d || (a[r].d === a[m].d && a[r].i < a[m].i))) m = r;
        if (m === c) break;
        var t = a[m]; a[m] = a[c]; a[c] = t; c = m;
      }
    }
    return top;
  };

  function key(x, z) { return x + ',' + z; }

  // 构造通行/代价访问器
  function makeAccess(map, state) {
    var g = map.grid, iso = state.isolated || {}, blocks = state.blocks || {}, down = state.downgraded || {};
    return {
      passable: function (x, z) {
        if (x < 0 || z < 0 || x >= map.W || z >= map.H) return false;
        var t = g[z][x].t;
        if (t === 'P' || t === '#' || t === '.') return false;
        if (t === 'N') { var id = map.nodeAt[key(x, z)]; if (id && iso[id] && iso[id].active) return false; }
        if (blocks[key(x, z)]) return false;
        return true;
      },
      cost: function (x, z) {
        var t = g[z][x].t, k = key(x, z);
        if (t === 'o' || (down[k] && down[k].expireTick > state.tick)) return map.oldCost;
        return 1;
      }
    };
  }

  // 反向距离场：从所有出口向外扩展
  function rebuild(map, access) {
    var W = map.W, H = map.H, dist = new Float32Array(W * H);
    for (var i = 0; i < dist.length; i++) dist[i] = INF;
    var heap = new Heap();
    for (var e = 0; e < map.exits.length; e++) {
      var ex = map.exits[e], id = ex.z * W + ex.x;
      dist[id] = 0; heap.push(0, id);
    }
    while (heap.a.length) {
      var u = heap.pop(), d = u.d, idx = u.i;
      if (d > dist[idx] + 1e-6) continue;
      var x = idx % W, z = (idx / W) | 0;
      for (var k = 0; k < 4; k++) {
        var nx = x + DIRS[k][0], nz = z + DIRS[k][1];
        if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        if (!access.passable(nx, nz)) continue;
        var ni = nz * W + nx, nd = d + access.cost(nx, nz);
        if (nd < dist[ni] - 1e-6) { dist[ni] = nd; heap.push(nd, ni); }
      }
    }
    return { dist: dist, W: W, H: H };
  }

  // 从 (sx,sz) 沿梯度追踪到出口
  function trace(map, field, access, sx, sz) {
    var W = map.W, dist = field.dist;
    var start = sz * W + sx;
    if (!isFinite(dist[start])) return null;
    var path = [{ x: sx, z: sz }], cur = start, guard = 0;
    var x = sx, z = sz;
    while (guard++ < map.W * map.H * 3) {
      if (dist[cur] <= 1e-6) return { path: path, exit: { x: x, z: z }, ok: true };
      var best = -1, bd = dist[cur], bx = 0, bz = 0;
      for (var k = 0; k < 4; k++) {
        var nx = x + DIRS[k][0], nz = z + DIRS[k][1];
        if (nx < 0 || nz < 0 || nx >= map.W || nz >= map.H) continue;
        if (!access.passable(nx, nz)) continue;
        var ni = nz * W + nx;
        if (dist[ni] < bd - 1e-6 && (best < 0 || dist[ni] < bd)) { best = ni; bd = dist[ni]; bx = nx; bz = nz; }
      }
      if (best < 0) return null;
      cur = best; x = bx; z = bz; path.push({ x: x, z: z });
    }
    return null;
  }

  function routes(map, field, access) {
    var r = {};
    for (var i = 0; i < map.entries.length; i++) {
      var en = map.entries[i];
      r[en.id] = trace(map, field, access, en.x, en.z);
    }
    return r;
  }

  function pathKey(p) { return p ? p.path.map(function (c) { return c.x + ',' + c.z; }).join('|') : 'NONE'; }

  // 连通性校验：所有入口 + 所有地面敌人当前格都要有路
  function connectivity(map, field, access, groundCells) {
    var bad = [];
    for (var i = 0; i < map.entries.length; i++) {
      var en = map.entries[i];
      if (!isFinite(field.dist[en.z * map.W + en.x])) bad.push({ x: en.x, z: en.z, who: '入口 ' + en.id });
    }
    if (groundCells) for (var j = 0; j < groundCells.length; j++) {
      var c = groundCells[j];
      if (!isFinite(field.dist[c.z * map.W + c.x])) bad.push({ x: c.x, z: c.z, who: '场上单位' });
    }
    return bad;
  }

  // 预览：临时隔离/取消隔离某节点（或叠加临时 blocks）后的新路线与校验
  function previewIsolate(map, state, nodeId, extraBlocks) {
    var st = {
      tick: state.tick,
      isolated: Object.assign({}, state.isolated),
      blocks: Object.assign({}, state.blocks),
      downgraded: state.downgraded
    };
    st.isolated[nodeId] = { active: true };
    if (extraBlocks) for (var k in extraBlocks) st.blocks[k] = extraBlocks[k];
    var access = makeAccess(map, st);
    var field = rebuild(map, access);
    var r = routes(map, field, access);
    var ground = [];
    if (state.enemies) for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (!e.flying && e.cell) ground.push({ x: e.cell.x, z: e.cell.z });
    }
    var bad = connectivity(map, field, access, ground);
    var changed = [];
    for (var e2 = 0; e2 < map.entries.length; e2++) {
      var id = map.entries[e2].id;
      if (pathKey(r[id]) !== pathKey(state.routes ? state.routes[id] : null)) changed.push(id);
    }
    return { ok: bad.length === 0, bad: bad, routes: r, field: field, changed: changed, access: access };
  }

  TD.Path = {
    key: key, makeAccess: makeAccess, rebuild: rebuild, trace: trace,
    routes: routes, connectivity: connectivity, previewIsolate: previewIsolate,
    pathKey: pathKey, INF: INF, DIRS: DIRS
  };
})();
