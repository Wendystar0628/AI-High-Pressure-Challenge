/* 动态路由塔防 · 3D 场景渲染
 * 程序化几何搭建网络空间；单位模型带可动部件；弹道/状态/路线/预警特效。 */
(function () {
  'use strict';
  var TD = window.TD = window.TD || {};
  var Geo = TD.Geo, B = TD.Builder, M4 = TD.M4, trs = TD.trs, C = TD.col;
  function hx(s) { return C.hex(s); }
  function add(b, geo, m, col, emi) { b.add(geo, m, col, emi || 0); }
  function bx(b, w, h, d, x, y, z, col, emi, rx, ry, rz) { add(b, Geo.box(w, h, d), trs(x, y, z, rx || 0, ry || 0, rz || 0), col, emi); }
  function cy(b, rt, rb, hh, x, y, z, col, emi, rx, ry, rz) { add(b, Geo.cylinder(rt, rb, hh, 10), trs(x, y, z, rx || 0, ry || 0, rz || 0), col, emi); }
  function sp(b, r, x, y, z, col, emi) { add(b, Geo.sphere(r, 10, 7), trs(x, y, z, 0, 0, 0), col, emi); }
  function to(b, R, r, x, y, z, col, emi, rx, ry, rz) { add(b, Geo.torus(R, r, 18, 6), trs(x, y, z, rx || 0, ry || 0, rz || 0), col, emi); }
  function oc(b, r, x, y, z, col, emi) { add(b, Geo.octa(r), trs(x, y, z, 0, 0, 0), col, emi); }
  function co(b, r, hh, x, y, z, col, emi, rx, ry, rz) { add(b, Geo.cylinder(0.001, r, hh, 8), trs(x, y, z, rx || 0, ry || 0, rz || 0), col, emi); }

  var METAL = hx('#16323e'), DARK = hx('#0a1a24'), EDGE = hx('#2ea7c8'), GRID = hx('#0e3448');
  var WHITE = [1, 1, 1], GLOW = [1, 1, 1];

  // ---------------- 单位模型 ----------------
  function towerModel(type) {
    var b = new B(), a = new B(), def = TD.Data.TOWERS[type], c = hx(def.color);
    var metal = hx('#12303c'), light = C.scale(c, 1.05);
    if (type === 'firewall') {
      bx(b, 0.92, 0.18, 0.92, 0, 0.09, 0, metal);
      bx(b, 0.78, 0.62, 0.26, 0, 0.5, 0, C.scale(c, 0.55));
      for (var i = -1; i <= 1; i++) bx(b, 0.5, 0.07, 0.06, 0, 0.34 + i * 0.18, 0.15, light, 1);
      bx(b, 0.9, 0.08, 0.1, 0, 0.84, 0, c, 0.6);
      oc(a, 0.2, 0, 1.0, 0, light, 0.9);
      to(a, 0.24, 0.035, 0, 1.0, 0, c, 0.8, 1.57, 0, 0);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0.02 * Math.sin(t * 3), 0, 0, t * 1.2, 0); } };
    }
    if (type === 'honeypot') {
      cy(b, 0.34, 0.38, 0.55, 0, 0.34, 0, C.scale(c, 0.5));
      to(b, 0.36, 0.05, 0, 0.62, 0, c, 0.9);
      bx(b, 0.08, 0.3, 0.08, 0, 0.78, 0, metal);
      sp(a, 0.13, 0, 0.98, 0, light, 1);
      to(a, 0.2, 0.03, 0, 0.98, 0, c, 0.9, 0.4, 0, 0);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, 0, t * 2.2, 0); } };
    }
    if (type === 'gateway') {
      bx(b, 0.95, 0.14, 0.95, 0, 0.07, 0, metal);
      for (var k = 0; k < 4; k++) bx(b, 0.1, 0.7, 0.1, (k % 2 ? 0.38 : -0.38), 0.42, (k < 2 ? 0.38 : -0.38), C.scale(c, 0.6));
      bx(b, 0.86, 0.06, 0.1, 0, 0.8, 0, c, 0.7);
      bx(a, 0.34, 0.5, 0.12, -0.19, 0.42, 0, c, 0.8);
      bx(a, 0.34, 0.5, 0.12, 0.19, 0.42, 0, c, 0.8);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, 0, 0, 0); } };
    }
    if (type === 'interceptor') {
      cy(b, 0.42, 0.46, 0.16, 0, 0.08, 0, metal);
      cy(b, 0.12, 0.14, 0.34, 0, 0.3, 0, C.scale(c, 0.5));
      bx(a, 0.5, 0.26, 0.5, 0, 0.55, 0, C.scale(c, 0.6));
      cy(a, 0.07, 0.07, 0.5, -0.16, 0.55, 0.34, light, 0.8, 1.57, 0, 0);
      cy(a, 0.07, 0.07, 0.5, 0.16, 0.55, 0.34, light, 0.8, 1.57, 0, 0);
      bx(a, 0.14, 0.1, 0.14, 0, 0.7, 0, c, 0.9);
      return { body: b, anim: a, afn: function (u, t) { var rec = u.fireRecoil || 0; return trs(0, 0, -rec * 0.12, 0, (u.facing || 0), 0); }, y: 0.0 };
    }
    if (type === 'sandbox') {
      bx(b, 0.8, 0.1, 0.8, 0, 0.05, 0, metal);
      for (var e = 0; e < 12; e++) {
        var ax = e < 4 ? (e % 2 ? 0.36 : -0.36) : 0, az = e < 4 ? (e < 2 ? 0.36 : -0.36) : 0;
        if (e < 4) bx(b, 0.05, 0.7, 0.05, ax, 0.42, az, c, 0.5);
        else if (e < 8) bx(b, 0.7, 0.05, 0.05, 0, e < 6 ? 0.15 : 0.78, az, c, 0.5);
        else bx(b, 0.05, 0.7, 0.05, e % 2 ? 0.36 : -0.36, 0.42, e < 10 ? 0.36 : -0.36, c, 0.5);
      }
      oc(a, 0.26, 0, 0.45, 0, light, 0.9);
      to(a, 0.34, 0.03, 0, 0.45, 0, c, 0.7, 1.2, 0, 0);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0.05 * Math.sin(t * 2), 0, t * 0.7, t * 1.5, 0); } };
    }
    // repair
    cy(b, 0.44, 0.44, 0.14, 0, 0.07, 0, metal);
    bx(b, 0.7, 0.1, 0.14, 0, 0.3, 0, C.scale(c, 0.6));
    bx(b, 0.14, 0.1, 0.7, 0, 0.3, 0, C.scale(c, 0.6));
    bx(a, 0.66, 0.09, 0.12, 0, 0.42, 0, c, 0.8);
    bx(a, 0.12, 0.09, 0.66, 0, 0.42, 0, c, 0.8);
    sp(a, 0.16, 0, 0.5, 0, light, 1);
    return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, 0, t * 1.0, 0); } };
  }

  function enemyModel(type) {
    var b = new B(), a = new B(), def = TD.Data.ENEMIES[type] || TD.Data.BOSSES[type];
    var c = hx(def.color), light = C.scale(c, 1.15), dark = C.scale(c, 0.45);
    if (type === 'worm') {
      sp(b, 0.22, 0, 0.22, -0.34, dark); sp(b, 0.26, 0, 0.24, 0, c);
      co(b, 0.16, 0.3, 0, 0.22, -0.5, dark);
      sp(a, 0.24, 0, 0.26, 0.36, light, 0.6);
      sp(a, 0.06, -0.1, 0.3, 0.52, hx('#fff2b0'), 1);
      sp(a, 0.06, 0.1, 0.3, 0.52, hx('#fff2b0'), 1);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0.05 * Math.sin(t * 9 + u.id), 0, 0, 0, 0); } };
    }
    if (type === 'flood') {
      bx(b, 0.5, 0.42, 0.5, 0, 0.3, 0, dark);
      bx(b, 0.34, 0.34, 0.34, 0.2, 0.5, 0.1, c, 0.4);
      bx(b, 0.3, 0.3, 0.3, -0.22, 0.45, -0.1, c, 0.4);
      co(a, 0.24, 0.4, 0, 0.3, 0.42, light, 0.7, 1.57, 0, 0);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0.05 * Math.sin(t * 5), 0, 0, 0); } };
    }
    if (type === 'trojan') {
      bx(b, 0.42, 0.42, 0.42, 0, 0.3, 0, C.scale(c, 0.6));
      bx(b, 0.46, 0.08, 0.46, 0, 0.3, 0, c, 0.7);
      bx(b, 0.08, 0.46, 0.46, 0, 0.3, 0, c, 0.7);
      oc(a, 0.16, 0, 0.3, 0, hx('#ff4b6b'), 1);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, t * 1.4, t * 2, 0); } };
    }
    if (type === 'ransomware') {
      cy(b, 0.16, 0.2, 0.6, 0, 0.34, 0, dark);
      to(b, 0.24, 0.05, 0, 0.6, 0, c, 0.8, 1.57, 0, 0);
      bx(b, 0.24, 0.16, 0.12, 0, 0.68, 0, c, 0.7);
      to(a, 0.34, 0.035, 0, 0.4, 0, light, 0.9, 0.3, 0, 0);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, 0, t * 2.5, t * 0.8); } };
    }
    if (type === 'hotspot') {
      co(b, 0.26, 0.3, 0, 0.3, 0, c, 0.6);
      co(b, 0.26, 0.3, 0, 0.3, 0, c, 0.6, 0, 0, 3.14159);
      sp(b, 0.12, 0, 0.3, 0, light, 1);
      to(a, 0.36, 0.04, 0, 0.3, 0, light, 0.9, 1.2, 0, 0);
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, 0, t * 3, t * 1.5); } };
    }
    if (type === 'packer') {
      sp(b, 0.28, 0, 0.32, 0, dark);
      for (var i = 0; i < 6; i++) { var ang = i / 6 * 6.283; bx(a, 0.16, 0.16, 0.1, Math.cos(ang) * 0.36, 0.32, Math.sin(ang) * 0.36, c, 0.6, 0, ang, 0); }
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, 0, t * 1.3, 0); } };
    }
    return enemyModel('worm');
  }

  function bossModel(id) {
    var b = new B(), a = new B(), def = TD.Data.BOSSES[id], c = hx(def.color), light = C.scale(c, 1.2), dark = C.scale(c, 0.4);
    if (id === 'wankui') {
      bx(b, 1.0, 0.9, 1.0, 0, 0.7, 0, dark);
      bx(b, 0.6, 0.6, 1.2, 0, 0.8, 0, c, 0.3);
      sp(b, 0.42, 0, 0.8, 0.52, hx('#ffdd55'), 0.9);
      for (var i = 0; i < 5; i++) { var ang = i / 5 * 6.283; oc(a, 0.22, Math.cos(ang) * 0.95, 0.85 + (i % 2) * 0.2, Math.sin(ang) * 0.95, light, 0.7); }
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, 0, t * 0.8, 0); }, scale: 1.5 };
    }
    if (id === 'mirage') {
      oc(b, 0.95, 0, 1.0, 0, dark);
      oc(b, 0.55, 0, 1.0, 0, c, 0.5);
      for (var j = 0; j < 8; j++) { var a2 = j / 8 * 6.283; bx(a, 0.5, 0.06, 0.16, Math.cos(a2) * 1.1, 1.0 + (j % 3) * 0.18, Math.sin(a2) * 1.1, light, 0.7, 0, a2, 0.3); }
      return { body: b, anim: a, afn: function (u, t) { return trs(0, 0, 0, 0, -t * 1.1, 0); }, scale: 1.5 };
    }
    // zheying
    for (var k = 0; k < 9; k++) { var a3 = k / 9 * 6.283; co(b, 0.24, 0.8, Math.cos(a3) * 0.6, 0.85, Math.sin(a3) * 0.6, c, 0.4, 0, a3, 0.5); }
    oc(b, 0.9, 0, 0.95, 0, dark);
    sp(a, 0.5, 0, 0.95, 0, light, 1);
    to(a, 1.15, 0.06, 0, 0.95, 0, c, 0.8, 1.3, 0, 0);
    return { body: b, anim: a, afn: function (u, t) { return trs(0, 0.06 * Math.sin(t * 2), 0, 0, t * 1.6, 0); }, scale: 1.6 };
  }

  // ---------------- Scene ----------------
  function Scene(renderer) {
    this.r = renderer;
    this.base = {};
    var self = this;
    function glow(geo) { var b = new B(); b.add(geo, M4.create(), WHITE, 1); return renderer.createMesh(b); }
    this.base.box = glow(Geo.box(1, 1, 1));
    this.base.sphere = glow(Geo.sphere(0.5, 10, 7));
    this.base.cyl = glow(Geo.cylinder(0.5, 0.5, 1, 12));
    this.base.torus = glow(Geo.torus(0.5, 0.035, 20, 6));
    this.base.torusThin = glow(Geo.torus(0.5, 0.012, 24, 6));
    this.base.octa = glow(Geo.octa(0.5));
    this.base.cone = glow(Geo.cylinder(0.001, 0.5, 1, 10));
    this.base.plane = glow(Geo.plane(1, 1));
    this.models = {};
    for (var t2 in TD.Data.TOWERS) { var m = towerModel(t2); this.models['t_' + t2] = { afn: m.afn, body: renderer.createMesh(m.body), anim: renderer.createMesh(m.anim) }; }
    for (var e in TD.Data.ENEMIES) { var me = enemyModel(e); this.models['e_' + e] = { afn: me.afn, body: renderer.createMesh(me.body), anim: renderer.createMesh(me.anim), scale: me.scale || 1 }; }
    for (var bo in TD.Data.BOSSES) { var mb = bossModel(bo); this.models['b_' + bo] = { afn: mb.afn, body: renderer.createMesh(mb.body), anim: renderer.createMesh(mb.anim), scale: mb.scale || 1.5 }; }
    this._m = M4.create(); this._m2 = M4.create();
    this.map = null; this.solid = null; this.decor = null;
    this.parts = [];
  }

  Scene.prototype.buildStatic = function (map) {
    this.map = map;
    var S = new B(), D = new B(), env = map.env;
    var link = hx(env.link), old = hx(env.old), node = hx(env.node), plat = hx(env.platform), edge = hx(env.edge), grid = hx(env.grid);
    var CELL = map.CELL, W = map.W, H = map.H;
    function wx(x) { return (x - (W - 1) / 2) * CELL; }
    function wz(z) { return (z - (H - 1) / 2) * CELL; }
    // 悬浮底板（整块），带网格由 shader 提供
    add(S, Geo.box(W * CELL + 1.2, 0.5, H * CELL + 1.2), trs(0, -0.55, 0, 0, 0, 0), C.scale(hx(env.bg), 1.4));
    add(S, Geo.box(W * CELL + 1.4, 0.12, H * CELL + 1.4), trs(0, -0.28, 0, 0, 0, 0), C.scale(edge, 0.25), 0.3);
    for (var z = 0; z < H; z++) for (var x = 0; x < W; x++) {
      var tile = map.grid[z][x], t = tile.t, X = wx(x), Z = wz(z);
      if (t === '.') continue;
      if (t === '#' || t === '~') {
        if (t === '~') {
          // 公网流：发光带
          add(S, Geo.box(CELL * 0.96, 0.08, CELL * 0.96), trs(X, 0.02, Z, 0, 0, 0), C.scale(hx('#ff5fa8'), 0.25));
          for (var q = -1; q <= 1; q++) add(D, Geo.box(CELL * 0.9, 0.02, 0.06), trs(X, 0.09 + q * 0.001, Z + q * 0.28, 0, 0, 0), hx('#ff5fa8'), 1);
        } else {
          // 数据设施 / 气隙
          add(S, Geo.box(CELL * 0.82, 0.55, CELL * 0.82), trs(X, 0.3, Z, 0, 0, 0), C.scale(METAL, 0.8));
          bx(S, 0.16, 0.5, 0.16, X - 0.22, 0.32, Z - 0.22, C.scale(edge, 0.5), 0.5);
          bx(S, 0.16, 0.5, 0.16, X + 0.22, 0.32, Z + 0.22, C.scale(edge, 0.5), 0.5);
          add(D, Geo.box(CELL * 0.6, 0.03, 0.05), trs(X, 0.6, Z, 0, 0, 0), hx('#ff9a3c'), 1);
        }
        continue;
      }
      var isLink = (t === '=' || t === 'o' || t === 'N' || t === 'A' || t === 'B' || t === 'C' || t === 'S' || t === 'X' || t === 'Y');
      var isPlat = (t === 'P');
      var h = isPlat ? 0.42 : 0.12;
      var baseCol = isPlat ? C.scale(plat, 1.05) : (t === 'o' ? C.scale(old, 0.95) : C.scale(link, 0.62));
      add(S, Geo.box(CELL * 0.94, h, CELL * 0.94), trs(X, h / 2, Z, 0, 0, 0), baseCol);
      // 发光边框
      var ec = t === 'o' ? C.scale(old, 1.35) : (t === 'N' ? node : edge);
      var el = CELL * 0.94, th = 0.055;
      add(D, Geo.box(el, 0.02, th), trs(X, h + 0.012, Z - el / 2, 0, 0, 0), ec, 1);
      add(D, Geo.box(el, 0.02, th), trs(X, h + 0.012, Z + el / 2, 0, 0, 0), ec, 1);
      add(D, Geo.box(th, 0.02, el), trs(X - el / 2, h + 0.012, Z, 0, 0, 0), ec, 1);
      add(D, Geo.box(th, 0.02, el), trs(X + el / 2, h + 0.012, Z, 0, 0, 0), ec, 1);
      if (isPlat) {
        add(S, Geo.box(CELL * 0.7, 0.06, CELL * 0.7), trs(X, h + 0.03, Z, 0, 0, 0), C.scale(edge, 0.4));
        bx(S, 0.1, 0.5, 0.1, X, h + 0.25, Z, C.scale(edge, 0.6), 0.4);
      }
      // 链路护栏：四角短柱与中心数据节点（推近可见的细节）
      if (t === '=' || t === 'o') {
        for (var gx = -1; gx <= 1; gx += 2) for (var gz = -1; gz <= 1; gz += 2)
          add(D, Geo.box(0.045, 0.2, 0.045), trs(X + gx * el * 0.46, h + 0.1, Z + gz * el * 0.46, 0, 0, 0), ec, 0.55);
        add(D, Geo.box(0.1, 0.02, 0.1), trs(X, h + 0.025, Z, 0, 0.785, 0), ec, 0.7);
      }
      if (t === 'o') for (var s = -2; s <= 2; s++) add(D, Geo.box(CELL * 0.7, 0.02, 0.04), trs(X, h + 0.02, Z + s * 0.2, 0, 0, 0), C.scale(old, 1.4), 0.8);
      if (t === 'N') {
        cy(S, 0.42, 0.46, 0.22, X, h + 0.11, Z, C.scale(node, 0.5));
        for (var c = 0; c < 4; c++) bx(S, 0.07, 0.5, 0.07, X + (c % 2 ? 0.34 : -0.34), h + 0.35, Z + (c < 2 ? 0.34 : -0.34), C.scale(node, 0.6), 0.5);
      }
      if (t === 'A' || t === 'B' || t === 'C') {
        // 入口门框
        bx(S, 0.12, 0.9, 0.12, X - 0.42, 0.55, Z, C.scale(edge, 0.8), 0.5);
        bx(S, 0.12, 0.9, 0.12, X + 0.42, 0.55, Z, C.scale(edge, 0.8), 0.5);
        bx(S, 0.96, 0.12, 0.12, X, 1.0, Z, hx('#ff8a4c'), 0.8);
        add(D, Geo.box(CELL * 0.6, 0.02, 0.1), trs(X, h + 0.02, Z - 0.3, 0, 0, 0), hx('#ff8a4c'), 1);
      }
      if (t === 'S' || t === 'X' || t === 'Y') {
        co(S, 0.5, 1.2, X, 0.75, Z, C.scale(node, 0.55));
        oc(S, 0.42, X, 1.35, Z, hx('#9ff0ff'), 0.7);
        to(S, 0.62, 0.06, X, 0.9, Z, node, 0.9, 1.57, 0, 0);
      }
    }
    // 协议层（下方大网格 + 光带）
    add(S, Geo.plane(W * CELL * 1.85, H * CELL * 1.85), trs(0, -3.2, 0, 0, 0, 0), C.scale(hx(env.bg), 1.1));
    // 远景网络集群
    var rng = 1234567;
    function rr() { rng = (Math.imul(rng, 1103515245) + 12345) & 0x7fffffff; return rng / 0x7fffffff; }
    for (var i = 0; i < 46; i++) {
      var fx = (rr() - 0.5) * W * CELL * 3.4, fz = (rr() - 0.5) * H * CELL * 3.4;
      if (Math.abs(fx) < W * CELL * 0.62 && Math.abs(fz) < H * CELL * 0.62) continue;
      var hh = 0.5 + rr() * 3.5, ww = 0.3 + rr() * 0.7;
      add(S, Geo.box(ww, hh, ww), trs(fx, -2.6 + hh / 2, fz, 0, rr() * 0.5, 0), C.scale(hx(env.link), 0.55));
      add(D, Geo.box(ww * 0.8, 0.04, ww * 0.8), trs(fx, -2.6 + hh, fz, 0, 0, 0), C.scale(hx(env.edge), 0.8), 1);
    }
    this.solid = this.r.createMesh(S);
    this.decor = this.r.createMesh(D);
    this.env = env;
    this.fogColor = hx(env.fog);
  };

  Scene.prototype.project = function (x, y, z, w, h) {
    var m = this.r.VP, cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    var cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    if (cw <= 0.0001) return null;
    return { x: (cx / cw * 0.5 + 0.5) * w, y: (1 - (cy / cw * 0.5 + 0.5)) * h, depth: cw };
  };

  function ring(r, mesh, x, y, z, radius, color, alpha, additive, tilt) {
    var m = trs(x, y, z, tilt || 0, 0, 0, radius * 2, 1, radius * 2);
    // 收敛颜色增益，避免加法混合过曝成白、遮挡战场信息
    r.draw(mesh, m, { color: C.scale(color, 0.62), alpha: alpha === undefined ? 0.8 : alpha, unlit: true, additive: !!additive, glow: 0.85, depthTest: true });
  }
  function bar(r, mesh, x, y, z, sx, sy, sz, color, alpha, additive) {
    r.draw(mesh, trs(x, y, z, 0, 0, 0, sx, sy, sz), { color: color, alpha: alpha === undefined ? 0.9 : alpha, unlit: true, additive: !!additive, glow: 1.1 });
  }
  // 两点之间的细连线：用于标注阻挡关系与攻击 / 治疗目标
  function drawLink(r, mesh, ax, ay, az, bx, by, bz, color, alpha) {
    var dx = bx - ax, dy = by - ay, dz = bz - az, flat = Math.hypot(dx, dz) || 0.001, len = Math.hypot(flat, dy) || 0.001;
    var mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
    var yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, flat);
    r.draw(mesh, trs(mx, my, mz, pitch, yaw, 0, 0.035, 0.035, len),
      { color: color, alpha: alpha, unlit: true, additive: true, glow: 0.5, depthTest: true });
  }

  // ---------------- 每帧渲染 ----------------
  Scene.prototype.frame = function (s, orbit, view) {
    var r = this.r, map = s.map, t = s.time, CELL = map.CELL, parts = [];
    view = view || {};
    var W = r.canvas.clientWidth || r.canvas.width, H = r.canvas.clientHeight || r.canvas.height;
    r.time = t;
    r.fog = this.fogColor || r.fog;
    r.fogNear = 46; r.fogFar = 150;
    orbit.apply(r, W / H);
    r.begin();

    // 静态场景
    r.draw(this.solid, M4.create(), { color: [1, 1, 1], glow: 0.85, grid: 0 });
    r.draw(this.decor, M4.create(), { color: [1, 1, 1], glow: 1.45, rim: 0.2, alpha: 0.98 });

    // 协议层网格（shader grid）——只作为下方纵深，不抢战场
    r.draw(this.base.plane, trs(0, -3.18, 0, 0, 0, 0, map.W * CELL * 1.85, 1, map.H * CELL * 1.85),
      { color: C.scale(hx(this.env.grid), 0.5), grid: 1, gridScale: 0.3, glow: 0.35, unlit: true, alpha: 0.3, additive: true, rim: 0, depthTest: true });

    // 远景数据流粒子（确定性，随时间流动）
    for (var pi = 0; pi < 90; pi++) {
      var seed = pi * 2.399963;
      var px = Math.sin(seed) * map.W * CELL * 1.25, pz = Math.cos(seed * 1.7) * map.H * CELL * 1.25;
      var py = -2.2 + ((t * 0.6 + pi * 0.37) % 4.5);
      parts.push({ x: px, y: py, z: pz, r: 0.25, g: 0.7, b: 0.95, size: 2.2, alpha: 0.35 });
    }

    // ---- 路线标记 ----
    if (s.routes && view.showRoutes !== false) {
      var entryColors = { A: hx('#ff8a4c'), B: hx('#5ad0ff'), C: hx('#c08bff') };
      for (var ei = 0; ei < map.entries.length; ei++) {
        var en = map.entries[ei], rt = s.routes[en.id], cc = entryColors[en.id] || hx('#8fe3ff');
        if (!rt) continue;
        var changed = s.routeChangedEntries && s.routeChangedEntries.indexOf(en.id) >= 0 && (s.tick - s.lastRouteChange) < Math.round(2.2 / TD.Data.DT);
        for (var q = 0; q < rt.path.length - 1; q++) {
          var a = rt.path[q], b = rt.path[q + 1];
          var ax = TD.Maps.wx(map, a.x), az = TD.Maps.wz(map, a.z), bx2 = TD.Maps.wx(map, b.x), bz2 = TD.Maps.wz(map, b.z);
          var mx = (ax + bx2) / 2, mz = (az + bz2) / 2, dx = bx2 - ax, dz = bz2 - az;
          var len = Math.hypot(dx, dz) || 1;
          var pulse = 0.5 + 0.5 * Math.sin(t * 3 - q * 0.5);
          var alpha = changed ? 0.82 + 0.18 * pulse : 0.52 + 0.24 * pulse;
          var col2 = changed ? hx('#ffe27f') : cc;
          // 实色（非加法混合）保证不同入口的路线颜色可区分；改道时统一高亮为琥珀色
          r.draw(this.base.box, trs(mx, 0.16, mz, 0, Math.atan2(dx, dz), 0, 0.2, 0.02, len * 0.82),
            { color: col2, alpha: alpha, unlit: true, additive: false, glow: 0, depthTest: true });
          if (q % 3 === 0) r.draw(this.base.cone, trs(ax + dx * 0.62, 0.18, az + dz * 0.62, Math.PI / 2, Math.atan2(dx, dz), 0, 0.16, 0.32, 0.16),
            { color: col2, alpha: alpha * 0.95, unlit: true, additive: false, glow: 0 });
        }
      }
    }
    // 改道预览路线
    if (view.previewRoutes) for (var pr in view.previewRoutes) {
      var prt = view.previewRoutes[pr]; if (!prt) continue;
      for (var pq = 0; pq < prt.path.length - 1; pq += 1) {
        var pa = prt.path[pq], pb = prt.path[pq + 1];
        var pax = TD.Maps.wx(map, pa.x), paz = TD.Maps.wz(map, pa.z), pbx = TD.Maps.wx(map, pb.x), pbz = TD.Maps.wz(map, pb.z);
        var pmx = (pax + pbx) / 2, pmz = (paz + pbz) / 2;
        var pdx = pbx - pax, pdz = pbz - paz, plen = Math.hypot(pdx, pdz) || 1;
        if (pq % 2 === 0) r.draw(this.base.box, trs(pmx, 0.2, pmz, 0, Math.atan2(pdx, pdz), 0, 0.16, 0.02, plen * 0.5),
          { color: hx('#ffffff'), alpha: 0.55 + 0.3 * Math.sin(t * 6), unlit: true, additive: true, glow: 1.4 });
      }
    }

    // ---- 节点状态 ----
    for (var ni = 0; ni < map.nodes.length; ni++) {
      var n = map.nodes[ni], nx = TD.Maps.wx(map, n.x), nz = TD.Maps.wz(map, n.z);
      var iso = s.isolated[n.id] && s.isolated[n.id].active;
      var nc = iso ? hx('#ff3b6b') : hx('#39d0e6');
      r.draw(this.base.torus, trs(nx, 0.3, nz, 0, t * (iso ? 1.6 : 0.5), 0, 1.15, 1, 1.15),
        { color: nc, alpha: 0.85, unlit: true, additive: true, glow: 1.3 });
      // 节点上方悬浮的全息晶体（缓慢旋转，表示设备在线）
      r.draw(this.base.octa, trs(nx, 1.05 + 0.08 * Math.sin(t * 2 + n.x), nz, 0, t * 1.4, 0, 0.3, 0.3, 0.3),
        { color: nc, alpha: 0.6, unlit: true, additive: true, glow: 1.2 });
      if (iso) {
        // 隔离屏障：四面发光墙
        for (var w4 = 0; w4 < 4; w4++) {
          var ang = w4 / 4 * 6.283;
          r.draw(this.base.box, trs(nx + Math.cos(ang) * 0.5, 0.65, nz + Math.sin(ang) * 0.5, 0, ang, 0, 0.06, 1.1, 0.6),
            { color: hx('#ff3b6b'), alpha: 0.32, unlit: true, additive: true, glow: 1.0 });
        }
        r.draw(this.base.cyl, trs(nx, 0.9, nz, 0, 0, 0, 0.9, 1.4, 0.9),
          { color: hx('#ff3b6b'), alpha: 0.12, unlit: true, additive: true, glow: 0.8 });
      }
      // 再次隔离间隔提示
      if (s.reIsoUntil[n.id] && s.reIsoUntil[n.id] > s.tick && !iso) ring(r, this.base.torus, nx, 0.28, nz, 0.5, hx('#ffd27f'), 0.35, true);
    }

    // ---- Boss 黑洞 / 锁死段 + 预警 ----
    for (var bk in s.blocks) {
      var pp = bk.split(','), bxx = TD.Maps.wx(map, +pp[0]), bzz = TD.Maps.wz(map, +pp[1]);
      r.draw(this.base.box, trs(bxx, 0.35, bzz, 0, t, 0, 0.85, 0.7, 0.85), { color: hx('#b06bff'), alpha: 0.3, unlit: true, additive: true, glow: 1.1 });
      ring(r, this.base.torus, bxx, 0.2, bzz, 0.5, hx('#ff3b6b'), 0.7, true);
    }
    for (var wi = 0; wi < s.warnings.length; wi++) {
      var wn = s.warnings[wi], blink = 0.4 + 0.6 * Math.abs(Math.sin(t * 5));
      ring(r, this.base.torus, wn.wx, 0.22, wn.wz, 0.55, hx('#ff3b6b'), blink, true);
      r.draw(this.base.cyl, trs(wn.wx, 1.0, wn.wz, 0, 0, 0, 0.85, 2.0, 0.85), { color: hx('#ff3b6b'), alpha: 0.12 * blink, unlit: true, additive: true, glow: 1 });
    }

    // ---- 范围预览（部署 / 道具 / 选中塔）----
    if (view.range) {
      var vr = view.range;
      // 细环 + 低透明度：范围可读但不遮挡路线、节点与战斗信息
      ring(r, this.base.torusThin, vr.x, 0.16, vr.z, vr.r, vr.color || hx('#8fe3ff'), 0.45, true);
      r.draw(this.base.plane, trs(vr.x, 0.14, vr.z, 0, 0, 0, vr.r * 2, 1, vr.r * 2), { color: vr.color || hx('#8fe3ff'), alpha: 0.05, unlit: true, additive: true, glow: 0.5 });
    }
    if (view.hoverCell) {
      var hc = view.hoverCell;
      r.draw(this.base.box, trs(hc.wx, 0.2, hc.wz, 0, 0, 0, CELL * 0.94, 0.03, CELL * 0.94),
        { color: view.hoverValid ? hx('#7dff9b') : hx('#ff3b6b'), alpha: 0.35, unlit: true, additive: true, glow: 1 });
      if (view.deploy && view.deploy.facing !== undefined) {
        var fa = view.deploy.facing;
        r.draw(this.base.box, trs(hc.wx + Math.sin(fa) * 1.2, 0.22, hc.wz + Math.cos(fa) * 1.2, 0, fa, 0, 0.1, 0.03, 1.6),
          { color: hx('#7dff9b'), alpha: 0.7, unlit: true, additive: true, glow: 1.2 });
      }
    }

    // ---- 塔 ----
    for (var ti = 0; ti < s.towers.length; ti++) {
      var tw = s.towers[ti], def = tw.def, mdl = this.models['t_' + tw.type];
      if (!mdl) continue;
      var tx = TD.Maps.wx(map, tw.x), tz = TD.Maps.wz(map, tw.z);
      var tileH = (tileType(s, tw.x, tw.z) === 'P') ? 0.5 : 0.14;
      var sc = 1.12 + (tw.lvl === 2 ? 0.14 : 0);
      var hurtTilt = tw.hitFlash > 0 ? Math.min(0.3, tw.hitFlash * 0.8) : 0;
      var base = trs(tx, tileH, tz, hurtTilt, 0, 0, sc, sc, sc);
      var opts = { color: [1, 1, 1], glow: 1.0, hit: tw.hitFlash > 0 ? Math.min(0.8, tw.hitFlash * 2) : 0, enc: tw.encryptedUntil > s.tick ? 1 : 0 };
      r.draw(mdl.body, base, opts);
      var recoil = (tw.fireFlash && s.tick - tw.fireFlash < 8) ? (1 - (s.tick - tw.fireFlash) / 8) : 0;
      var local = mdl.afn({ id: tw.id, facing: tw.facing, fireRecoil: recoil }, t);
      M4.multiply(this._m, base, local);
      r.draw(mdl.anim, this._m, opts);
      if (recoil > 0.12 && (tw.type === 'interceptor' || tw.type === 'sandbox' || tw.type === 'firewall' || tw.type === 'repair')) {
        var fa = tw.facing || 0;
        r.draw(this.base.sphere, trs(tx + Math.sin(fa) * 0.55 * sc, tileH + 0.7 * sc, tz + Math.cos(fa) * 0.55 * sc, 0, 0, 0, 0.3 * recoil, 0.3 * recoil, 0.3 * recoil),
          { color: hx(tw.def.color), alpha: recoil, unlit: true, additive: true, glow: 1.6 });
      }
      // 2 级 / 分支标识：顶部光环
      if (tw.lvl === 2) {
        var bc = tw.branch === 'a' ? hx('#ffd27f') : (tw.branch === 'b' ? hx('#7dff9b') : hx('#8fe3ff'));
        r.draw(this.base.torus, trs(tx, tileH + 1.15 * sc, tz, 0, t * 0.8, 0, 0.55, 1, 0.55), { color: bc, alpha: 0.9, unlit: true, additive: true, glow: 1.3 });
      }
      if (tw.shield > 0) r.draw(this.base.sphere, trs(tx, tileH + 0.55, tz, 0, 0, 0, 1.6, 1.4, 1.6), { color: hx('#6fe8ff'), alpha: 0.16, unlit: true, additive: true, glow: 1 });
      if (tw.encryptedUntil > s.tick) ring(r, this.base.torus, tx, tileH + 0.05, tz, 0.55, hx('#b06bff'), 0.7, true);
      if (view.selected && view.selected.towerId === tw.id) ring(r, this.base.torus, tx, 0.18, tz, 0.62, hx('#ffffff'), 0.9, true);
      // 阻挡关系 / 攻击目标 / 治疗目标在场上的连线标注
      for (var bl = 0; bl < tw.blocking.length; bl++) {
        var be = TD.Game.findEnemy(s, tw.blocking[bl]);
        if (be && !be.dying) { var bp = TD.Game.enemyPos(s, be); drawLink(r, this.base.box, tx, tileH + 0.5, tz, bp.x, bp.y + 0.3, bp.z, hx('#ffb14f'), 0.42); }
      }
      if (tw.targetId) {
        var te = TD.Game.findEnemy(s, tw.targetId);
        if (te && !te.dying) { var tp3 = TD.Game.enemyPos(s, te); drawLink(r, this.base.box, tx, tileH + 0.7, tz, tp3.x, tp3.y + 0.3, tp3.z, hx(tw.def.color), 0.3); }
      }
      if (tw.type === 'repair') {
        var hc = 0;
        for (var oi = 0; oi < s.towers.length && hc < 3; oi++) {
          var ot = s.towers[oi];
          if (ot.dying || ot.id === tw.id || ot.hp >= ot.maxHp) continue;
          var ddx = ot.x - tw.x, ddz = ot.z - tw.z;
          if (ddx * ddx + ddz * ddz <= tw.rangeNow * tw.rangeNow) {
            drawLink(r, this.base.box, tx, tileH + 0.5, tz, TD.Maps.wx(s.map, ot.x), 0.5, TD.Maps.wz(s.map, ot.z), hx('#7dff9b'), 0.3);
            hc++;
          }
        }
      }
      // 部署预览模型
    }
    // 拖拽部署的半透明预览
    if (view.deploy && view.deploy.model) {
      var dp = view.deploy, dm = this.models['t_' + dp.model];
      if (dm) r.draw(dm.body, trs(dp.wx, 0.2, dp.wz, 0, dp.facing || 0, 0, 0.9, 0.9, 0.9), { color: [1, 1, 1], alpha: 0.45, glow: 1.0 });
    }

    // ---- 敌人 ----
    for (var ii = 0; ii < s.enemies.length; ii++) {
      var e = s.enemies[ii];
      var mkey = e.boss ? 'b_' + e.def.id : 'e_' + e.type;
      var em = this.models[mkey]; if (!em) continue;
      var ep = TD.Game.enemyPos(s, e), esc = (em.scale || 1) * (e.boss ? 1 : 1.0);
      var dying = e.dying > 0;
      var dscale = dying ? Math.max(0.1, 1 - e.dying / 0.65) : 1;
      var ehurt = e.hitFlash > 0 ? e.hitFlash * 0.7 : 0;
      var eb = trs(ep.x, ep.y + 0.16 + (dying ? -dscale * 0.3 : 0), ep.z, ehurt, e.dir || 0, dying ? e.dying * 3 : 0, esc * dscale, esc * dscale, esc * dscale);
      var eopts = { color: e.revealed === false ? [0.7, 0.75, 0.8] : [1, 1, 1], glow: 1.0, hit: e.hitFlash > 0 ? 0.8 : 0, enc: (e.latent && !e.revealed) ? 1 : 0 };
      r.draw(em.body, eb, eopts);
      var elocal = em.afn({ id: e.id }, t);
      M4.multiply(this._m2, eb, elocal);
      r.draw(em.anim, this._m2, eopts);
      if (e.shield > 0) r.draw(this.base.sphere, trs(ep.x, ep.y + 0.4, ep.z, 0, 0, 0, 1.4 * esc, 1.4 * esc, 1.4 * esc), { color: hx('#b06bff'), alpha: 0.22, unlit: true, additive: true, glow: 1 });
      if ((e.disguised || e.latent) && !e.revealed) ring(r, this.base.torus, ep.x, ep.y + 0.02, ep.z, 0.4, hx('#9fb6c8'), 0.5, true);
      if (e.trappedUntil > s.tick) ring(r, this.base.torus, ep.x, ep.y + 0.05, ep.z, 0.42, hx('#b06bff'), 0.7, true);
      if (e.boss) r.draw(this.base.torus, trs(ep.x, ep.y + 0.05, ep.z, 0, -t * 0.6, 0, 2.4, 1, 2.4), { color: hx(e.def.color), alpha: 0.55, unlit: true, additive: true, glow: 1.2 });
    }

    // ---- 特效 ----
    for (var fi = 0; fi < s.fx.length; fi++) drawFx(this, r, s, s.fx[fi], parts, t);

    // 环境数据流（沿链路）
    if (map.links && map.links.length) for (var li = 0; li < 34; li++) {
      var lk = map.links[(li * 7 + Math.floor(t * 2)) % map.links.length];
      if (!lk) continue;
      var lx = TD.Maps.wx(map, lk.x), lz = TD.Maps.wz(map, lk.z);
      var ph = (t * 1.4 + li * 0.53) % 1;
      parts.push({ x: lx + Math.sin(li) * 0.25, y: 0.3 + ph * 0.35, z: lz + Math.cos(li) * 0.25, r: 0.3, g: 0.85, b: 1.0, size: 2.6, alpha: 0.5 * (1 - ph) });
    }

    r.particles(parts);
    return parts;
  };

  function tileType(s, x, z) { var t = TD.Game.tileAt(s, x, z); return t ? t.t : '.'; }

  // ---------------- 单个特效 ----------------
  function drawFx(sc, r, s, f, parts, t) {
    var prog = 1 - f.ttl / (f.maxTtl || 1), col = f.color || [1, 1, 1];
    var B = sc.base;
    function P(x, y, z, rr, gg, bb, sz, a) { parts.push({ x: x, y: y, z: z, r: rr, g: gg, b: bb, size: sz, alpha: a }); }
    var spark = function (x, y, z, n, c) {
      for (var i = 0; i < n; i++) {
        var a = (f.id || 1) * 0.7 + i * 2.399, rad = (0.15 + (i % 4) * 0.12) * prog;
        P(x + Math.cos(a) * rad, y + Math.sin(a * 1.3) * rad + prog * 0.35, z + Math.sin(a) * rad,
          c[0], c[1], c[2], 3.5, 0.85 * (1 - prog));
      }
    };
    if (f.kind === 'bolt') {
      var bx = f.x + (f.tx - f.x) * prog, bz = f.z + (f.tz - f.z) * prog, by = (f.y || 0.4) + ((f.ty || 0.4) - (f.y || 0.4)) * prog;
      r.draw(B.sphere, trs(bx, by, bz, 0, 0, 0, 0.2, 0.2, 0.2), { color: col, alpha: 1, unlit: true, additive: true, glow: 1.5 });
      for (var q = 0; q < 4; q++) {
        var tq = prog - q * 0.06; if (tq < 0) continue;
        var qx = f.x + (f.tx - f.x) * tq, qz = f.z + (f.tz - f.z) * tq, qy = (f.y || 0.4) + ((f.ty || 0.4) - (f.y || 0.4)) * tq;
        P(qx, qy, qz, col[0], col[1], col[2], 3.2, 0.6 * (1 - q / 4));
      }
    } else if (f.kind === 'hit' || f.kind === 'towhit') {
      r.draw(B.sphere, trs(f.x, (f.y || 0.5), f.z, 0, 0, 0, 0.35 * (1 + prog), 0.35 * (1 + prog), 0.35 * (1 + prog)), { color: col, alpha: 0.7 * (1 - prog), unlit: true, additive: true, glow: 1.4 });
      spark(f.x, f.y || 0.5, f.z, 3, col);
    } else if (f.kind === 'aoe' || f.kind === 'scan' || f.kind === 'ring' || f.kind === 'healring' || f.kind === 'downgrade' || f.kind === 'payload' || f.kind === 'isolate' || f.kind === 'bypass' || f.kind === 'restore') {
      var rad = (f.r || 1) * (0.35 + prog * 0.65);
      ring(r, B.torus, f.x || 0, 0.2, f.z || 0, rad, col, (1 - prog) * 0.55, true);
      if (f.kind === 'heal' || f.kind === 'restore' || f.kind === 'healring') for (var hp = 0; hp < 5; hp++) P((f.x || 0) + Math.sin(hp + t) * 0.4, 0.2 + prog * 1.2 + hp * 0.1, (f.z || 0) + Math.cos(hp + t) * 0.4, 0.4, 1, 0.55, 3, 0.8 * (1 - prog));
    } else if (f.kind === 'heal') {
      for (var h2 = 0; h2 < 4; h2++) P(f.x + Math.sin(h2 * 2 + t * 3) * 0.3, 0.3 + prog * 1.3, f.z + Math.cos(h2 * 2 + t * 3) * 0.3, 0.4, 1, 0.55, 3.2, 0.85 * (1 - prog));
    } else if (f.kind === 'encrypt' || f.kind === 'storm' || f.kind === 'bossphase' || f.kind === 'bossarrive' || f.kind === 'routepulse') {
      var cx = f.x || 0, cz = f.z || 0;
      ring(r, B.torus, cx, 0.25, cz, 0.5 + prog * 1.4, col, (1 - prog) * 0.7, true);
      if (f.kind === 'bossarrive') r.draw(B.cyl, trs(cx, 2.2, cz, 0, 0, 0, 1.2, 4.4, 1.2), { color: col, alpha: 0.18 * (1 - prog), unlit: true, additive: true, glow: 1.2 });
    } else if (f.kind === 'spawn' || f.kind === 'build' || f.kind === 'upgrade' || f.kind === 'skill' || f.kind === 'towerdown' || f.kind === 'death' || f.kind === 'copy' || f.kind === 'leak' || f.kind === 'siege') {
      var sx = f.x || 0, sz = f.z || 0, sy = (f.y || 0.4);
      ring(r, B.torus, sx, 0.2, sz, 0.2 + prog * (f.boss ? 3 : 1.1), col, (1 - prog) * 0.75, true);
      spark(sx, sy, sz, f.boss ? 8 : 4, col);
    }
  }

  TD.Scene = Scene;
})();
