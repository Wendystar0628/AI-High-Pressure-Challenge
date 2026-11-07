/* =========================================================
   汐見漁港 — boats, cabins, interiors, harbour life
   ========================================================= */
(function (H) {
  'use strict';
  var T = H.TEX, M, W;
  function ready() { M = H.M; W = H.W; }

  // -----------------------------------------------------------------
  // lofted wooden / GRP hull
  // -----------------------------------------------------------------
  var WPROF = [
    [0.00, 0.84], [0.10, 0.95], [0.28, 1.00], [0.48, 0.995],
    [0.64, 0.94], [0.78, 0.82], [0.90, 0.58], [0.97, 0.28], [1.00, 0.035]
  ];
  function profAt(t) {
    for (var i = 0; i < WPROF.length - 1; i++) {
      if (t <= WPROF[i + 1][0]) {
        var a = WPROF[i], b = WPROF[i + 1];
        var k = (t - a[0]) / (b[0] - a[0]);
        k = k * k * (3 - 2 * k);
        return H.lerp(a[1], b[1], k);
      }
    }
    return WPROF[WPROF.length - 1][1];
  }

  H.makeHull = function (len, beam, depth) {
    var N = 22;
    var sections = 7;
    var fracs = [0.0, 0.12, 0.28, 0.44, 0.58, 0.75, 1.0];
    var verts = [], colors = [], idx = [];
    var half = beam / 2;
    var cWhite = new THREE.Color(0xe7eee7);
    var cTeal = new THREE.Color(0x1f4f56);
    var cRust = new THREE.Color(0xb56a4c);
    var rowCount = sections * 2 - 1;
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      var x = -len / 2 + t * len;
      var w = half * profAt(t);
      var d = depth * (0.82 + 0.18 * Math.sin(Math.PI * t));
      var deckY = 0.10 * t * t;
      for (var s = 0; s < sections; s++) {
        var f = fracs[s];
        var z = w * (1 - f * 0.995);
        var y = deckY - d * Math.pow(f, 0.92);
        verts.push(x, y, z);
        var col = cWhite;
        if (y < -d * 0.55) col = cTeal;
        else if (y < -d * 0.47) col = cRust;
        colors.push(col.r, col.g, col.b);
      }
      for (var s2 = sections - 2; s2 >= 0; s2--) {
        var f2 = fracs[s2];
        var z2 = -w * (1 - f2 * 0.995);
        var y2 = deckY - d * Math.pow(f2, 0.92);
        verts.push(x, y2, z2);
        var col2 = cWhite;
        if (y2 < -d * 0.55) col2 = cTeal;
        else if (y2 < -d * 0.47) col2 = cRust;
        colors.push(col2.r, col2.g, col2.b);
      }
    }
    for (var i2 = 0; i2 < N; i2++) {
      for (var j = 0; j < rowCount - 1; j++) {
        var a = i2 * rowCount + j;
        var b = a + rowCount;
        idx.push(a, b, a + 1);
        idx.push(b, b + 1, a + 1);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };

  function deckShape(len, beam, inset) {
    var pts = [];
    var N = 24;
    var half = beam / 2 * (inset || 0.9);
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      pts.push(new THREE.Vector2(-len / 2 + t * len, half * profAt(t)));
    }
    for (var i2 = N; i2 >= 0; i2--) {
      var t2 = i2 / N;
      pts.push(new THREE.Vector2(-len / 2 + t2 * len, -half * profAt(t2)));
    }
    return pts;
  }

  function deckGeometry(len, beam, inset) {
    var sh = new THREE.Shape();
    var pts = deckShape(len, beam, inset);
    sh.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) sh.lineTo(pts[i].x, pts[i].y);
    sh.closePath();
    var g = new THREE.ShapeGeometry(sh);
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // -----------------------------------------------------------------
  // generic boat hull assembly
  // -----------------------------------------------------------------
  function buildHullBase(opts) {
    var g = new THREE.Group();
    var hullMat = H.toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
    var hull = new THREE.Mesh(opts.hull, hullMat);
    hull.castShadow = true; hull.receiveShadow = true;
    g.add(hull);
    // rub rail
    var railPts = [];
    for (var i = 0; i <= 24; i++) {
      var t = i / 24;
      railPts.push(new THREE.Vector3(-opts.len / 2 + t * opts.len, 0.06 + 0.10 * t * t, (opts.beam / 2 * profAt(t)) + 0.02));
    }
    for (var i2 = 24; i2 >= 0; i2--) {
      var t2 = i2 / 24;
      railPts.push(new THREE.Vector3(-opts.len / 2 + t2 * opts.len, 0.06 + 0.10 * t2 * t2, -(opts.beam / 2 * profAt(t2)) - 0.02));
    }
    railPts.push(railPts[0].clone());
    var railCurve = new THREE.CatmullRomCurve3(railPts, true);
    var rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 90, 0.045, 5, true), H.toon(0x3a6a70));
    rail.castShadow = true;
    g.add(rail);
    // boot stripe
    var stripePts = [];
    for (var s = 0; s <= 24; s++) {
      var ts = s / 24;
      var w = opts.beam / 2 * profAt(ts) * 0.78;
      var sx = -opts.len / 2 + ts * opts.len;
      stripePts.push(new THREE.Vector3(sx, -opts.depth * 0.47 + 0.03, w));
    }
    for (var s2 = 24; s2 >= 0; s2--) {
      var ts2 = s2 / 24;
      var w2 = opts.beam / 2 * profAt(ts2) * 0.78;
      stripePts.push(new THREE.Vector3(-opts.len / 2 + ts2 * opts.len, -opts.depth * 0.47 + 0.03, -w2));
    }
    var stripe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripePts, true), 80, 0.035, 4, true), H.toon(0xb56a4c));
    g.add(stripe);
    // deck
    if (!opts.open) {
      var deckMat = H.toon(0xffffff, { map: T.wood, side: THREE.DoubleSide });
      var deck = new THREE.Mesh(deckGeometry(opts.len, opts.beam, 0.92), deckMat);
      deck.position.y = 0.035;
      deck.receiveShadow = true;
      g.add(deck);
    }
    if (opts.innerFloor) {
      var inner = new THREE.Mesh(deckGeometry(opts.len * 0.94, opts.beam * 0.9, 0.8), H.toon(0x7f8d82));
      inner.position.y = opts.innerFloor;
      g.add(inner);
    }
    // transom board
    var transom = new THREE.Mesh(new THREE.BoxGeometry(0.08, opts.depth * 0.8, opts.beam * 0.82), H.toon(0xe5ece5));
    transom.position.set(-opts.len / 2 + 0.04, -opts.depth * 0.36, 0);
    transom.castShadow = true;
    g.add(transom);
    // bow name plates
    if (opts.name) {
      var nameTex = H.tex(512, 160, function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#2d4446';
        ctx.textAlign = 'center';
        ctx.font = 'bold 92px "Yu Gothic","MS Gothic",sans-serif';
        ctx.fillText(opts.name, w / 2, 112);
        ctx.strokeStyle = 'rgba(45,68,70,0.7)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(44, 76, 24, 0, 6.283); ctx.stroke();
        ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#4c6766';
        ctx.fillText('SHIOMI', w / 2, 146);
      }, { clamp: true });
      [-1, 1].forEach(function (side) {
        var pl = H.signPlane(1.15, 0.36, nameTex, g, opts.len * 0.29, 0.4, side * (opts.beam * 0.34));
        pl.rotation.y = side > 0 ? 0 : Math.PI;
      });
    }
    var stem = H.cyl(0.06, 0.10, opts.depth * 1.15, 6, H.toon(0xe8eeea), g, opts.len / 2 - 0.02, -opts.depth * 0.42, 0);
    stem.rotation.z = 0.08;
    return { group: g, hull: hull, rail: rail };
  }

  // -----------------------------------------------------------------
  // cabin with visible interior
  // -----------------------------------------------------------------
  function makeCabin(parent, opts) {
    var L = opts.len, Wd = opts.width, Hh = opts.height;
    var g = new THREE.Group();
    g.position.set(opts.x, 0.04, 0);
    parent.add(g);
    var wall = H.toon(0xe9efe7);
    var wood = H.toon(0xffffff, { map: T.wood });
    var roofMat = H.toon(0xe0e8df);

    var fl = H.box(L, 0.08, Wd, wood, g, 0, 0.04, 0);
    H.box(L, 0.42, 0.06, wall, g, 0, 0.22, Wd / 2);
    H.box(L, 0.42, 0.06, wall, g, 0, 0.22, -Wd / 2);
    H.box(0.06, 0.42, Wd, wall, g, L / 2, 0.22, 0);
    H.box(0.06, 0.42, Wd, wall, g, -L / 2, 0.22, 0);
    [[-L / 2, -Wd / 2], [-L / 2, Wd / 2], [L / 2, -Wd / 2], [L / 2, Wd / 2]].forEach(function (p) {
      H.box(0.09, Hh, 0.09, wall, g, p[0], Hh / 2, p[1]);
    });
    [-L / 6, L / 3].forEach(function (mxx) {
      H.box(0.055, Hh - 0.5, 0.055, wall, g, mxx, 0.42 + (Hh - 0.5) / 2, -Wd / 2);
      H.box(0.055, Hh - 0.5, 0.055, wall, g, mxx, 0.42 + (Hh - 0.5) / 2, Wd / 2);
    });
    var roof = H.box(L + 0.16, 0.1, Wd + 0.16, roofMat, g, 0, Hh, 0);
    roof.castShadow = true;
    H.box(L + 0.1, 0.04, Wd + 0.1, H.toon(0xdfe8e0), g, 0, Hh - 0.06, 0);
    H.outline(roof, 0.0018);
    H.box(0.06, Hh - 0.4, Wd - 0.1, wall, g, -L / 2, 0.42 + (Hh - 0.4) / 2, 0);
    var rw = H.plane(0.8, 0.4, M.glass, g, -L / 2 - 0.035, Hh * 0.7, 0);
    rw.rotation.y = -Math.PI / 2;
    rw.renderOrder = 23;
    var fw = H.plane(Wd - 0.16, Hh - 0.52, M.glass, g, L / 2 + 0.035, 0.42 + (Hh - 0.5) / 2, 0);
    fw.rotation.y = Math.PI / 2;
    fw.renderOrder = 23;
    H.box(0.07, Hh - 0.45, 0.06, wall, g, L / 2, 0.45 + (Hh - 0.45) / 2, 0);
    var sideGlassA = H.plane(L - 0.35, Hh - 0.55, M.glass, g, 0, 0.42 + (Hh - 0.55) / 2, -Wd / 2 - 0.04);
    sideGlassA.renderOrder = 23;
    var sideGlassB = H.plane(L * 0.52, Hh - 0.55, M.glass, g, L * 0.18, 0.42 + (Hh - 0.55) / 2, Wd / 2 + 0.04);
    sideGlassB.renderOrder = 23;
    // chart board and tide table taped to the starboard window
    H.box(0.68, 0.5, 0.018, M.woodDark, g, 0.86, 1.05, Wd / 2 - 0.025);
    H.plane(0.62, 0.44, new THREE.MeshBasicMaterial({ map: T.chart }), g, 0.86, 1.05, Wd / 2 - 0.012);
    H.box(0.16, 0.035, 0.04, M.iron, g, 0.86, 1.31, Wd / 2 - 0.01);
    H.box(0.06, 0.06, 0.004, H.toon(0xd9c27a), g, 0.56, 1.28, Wd / 2 - 0.006);
    H.box(0.06, 0.06, 0.004, H.toon(0xd9c27a), g, 1.16, 1.28, Wd / 2 - 0.006);
    var tideTex2 = H.tex(192, 256, function (ctx, w, h) {
      ctx.fillStyle = '#f0e9d6'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3d5d5b'; ctx.textAlign = 'center'; ctx.font = 'bold 22px "Yu Gothic",sans-serif';
      ctx.fillText('潮汐', w / 2, 34);
      ctx.font = '15px "Yu Gothic",sans-serif'; ctx.fillStyle = '#516d68';
      var rs = [['満', '05:12'], ['干', '11:26'], ['満', '17:48'], ['干', '23:55']];
      rs.forEach(function (r, i) { ctx.textAlign = 'left'; ctx.fillText(r[0], 18, 70 + i * 38); ctx.textAlign = 'right'; ctx.fillText(r[1], w - 18, 70 + i * 38); });
      ctx.strokeStyle = 'rgba(90,110,100,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(6, 6, w - 12, h - 12);
    }, { clamp: true });
    H.signPlane(0.2, 0.28, tideTex2, g, 1.33, 1.02, Wd / 2 - 0.006);
    H.box(L - 0.3, 0.045, 0.05, wall, g, 0, 0.42 + (Hh - 0.5) * 0.52, -Wd / 2);
    H.box(L * 0.52, 0.045, 0.05, wall, g, L * 0.18, 0.42 + (Hh - 0.5) * 0.52, Wd / 2);
    var door = new THREE.Group();
    door.position.set(-L * 0.18, 0, Wd / 2 + 0.06);
    g.add(door);
    var dp = H.box(0.95, Hh - 0.4, 0.05, wall, door, 0, 0.42 + (Hh - 0.4) / 2, 0);
    H.outline(dp, 0.0018);
    var dw = H.plane(0.55, Hh * 0.42, M.glass, door, 0, Hh * 0.68, 0.035);
    dw.renderOrder = 24;
    H.box(0.94, 0.05, 0.06, wall, door, 0, 0.42 + (Hh - 0.4) * 0.62, 0.01);
    H.box(0.06, Hh - 0.42, 0.07, wall, g, L * 0.28, 0.42 + (Hh - 0.42) / 2, Wd / 2);
    H.box(0.06, Hh - 0.42, 0.07, wall, g, -L * 0.02, 0.42 + (Hh - 0.42) / 2, Wd / 2);

    // console
    var consoleG = new THREE.Group();
    consoleG.position.set(L / 2 - 0.42, 0.42, 0);
    g.add(consoleG);
    H.box(0.62, 0.72, Wd - 0.34, H.toon(0xc9d5cd), consoleG, -0.05, 0.4, 0);
    var dash = H.box(0.5, 0.32, Wd - 0.4, H.toon(0x566a6b), consoleG, -0.02, 0.86, 0);
    dash.rotation.z = -0.35;
    var radarTex = H.tex(256, 192, function (ctx, w, h) {
      ctx.fillStyle = '#0c2f2d'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(140,240,200,0.5)'; ctx.lineWidth = 1;
      for (var r = 20; r < 120; r += 22) { ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, 6.283); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + 80, h / 2 - 30); ctx.stroke();
      ctx.fillStyle = 'rgba(130,255,190,0.8)';
      for (var i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.arc(w / 2 + H.rr(-60, 60), h / 2 + H.rr(-40, 40), 2.2, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = 'rgba(160,255,210,0.85)';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('RANGE 2.0', 14, h - 14);
      var gl = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 110);
      gl.addColorStop(0, 'rgba(80,255,180,0.16)');
      gl.addColorStop(1, 'rgba(20,60,60,0)');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    }, { clamp: true });
    var radar = H.plane(0.31, 0.24, new THREE.MeshBasicMaterial({ map: radarTex }), consoleG, 0.13, 0.99, -0.3);
    radar.rotation.y = 0.1;
    radar.rotation.x = -0.2;
    var ffTex = H.tex(160, 220, function (ctx, w, h) {
      ctx.fillStyle = '#0d2b2a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(140,240,200,0.25)'; ctx.fillRect(8, 30, w - 16, h - 46);
      ctx.strokeStyle = 'rgba(160,255,220,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var x = 8; x < w - 8; x += 4) {
        var y = 130 + Math.sin(x * 0.12) * 22 + Math.sin(x * 0.31) * 10;
        if (x === 8) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(250,230,140,0.9)';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('18.4m', 12, 22); ctx.fillText('14:26', w - 58, 22);
      ctx.fillStyle = 'rgba(140,255,190,0.8)';
      for (var i = 0; i < 6; i++) ctx.fillRect(20 + i * 20, 176 + (i % 3) * 8, 10, 14);
    }, { clamp: true });
    var ff = H.plane(0.22, 0.3, new THREE.MeshBasicMaterial({ map: ffTex }), consoleG, 0.21, 1.0, 0.25);
    ff.rotation.y = -0.2;
    ff.rotation.x = -0.2;
    var wheel = new THREE.Group();
    wheel.position.set(-0.12, 0.88, 0.02);
    wheel.rotation.z = -0.35;
    consoleG.add(wheel);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.028, 6, 18), M.iron);
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    for (var sp = 0; sp < 3; sp++) {
      var spoke = H.box(0.02, 0.4, 0.02, M.iron, wheel, 0, 0, 0);
      spoke.rotation.x = sp * Math.PI / 3;
    }
    H.cyl(0.05, 0.05, 0.16, 8, M.iron, wheel, 0, 0, 0).rotation.z = Math.PI / 2;
    H.cyl(0.03, 0.04, 0.3, 6, M.iron, consoleG, 0.1, 0.86, 0.52).rotation.x = -0.4;
    // seat
    H.box(0.55, 0.12, Wd * 0.55, H.toon(0x4e7a7c), g, -L * 0.22, 0.48, -0.1);
    H.box(0.55, 0.5, 0.1, H.toon(0x547f80), g, -L * 0.22 - 0.28, 0.66, -0.1);
    for (var leg = 0; leg < 4; leg++) {
      H.cyl(0.025, 0.03, 0.34, 5, M.iron, g, -L * 0.22 + (leg < 2 ? -0.2 : 0.2), 0.22, -0.1 + (leg % 2 ? 0.35 : -0.35));
    }
    // chart table + charts
    var table = H.box(0.72, 0.04, 0.5, wood, g, -L * 0.46, 0.72, -Wd * 0.24);
    table.rotation.z = -0.1;
    var chart = H.plane(0.6, 0.4, new THREE.MeshBasicMaterial({ map: T.chart }), g, -L * 0.46, 0.75, -Wd * 0.24);
    chart.rotation.x = -Math.PI / 2 + 0.1;
    chart.rotation.z = 0.08;
    H.box(0.3, 0.02, 0.22, M.woodDark, g, -L * 0.34, 0.77, -Wd * 0.05);
    H.cyl(0.075, 0.08, 0.3, 10, H.toon(0xe6e0c9), g, -L * 0.12, 0.85, -Wd * 0.3);
    H.cyl(0.078, 0.078, 0.06, 10, H.toon(0x9d4e44), g, -L * 0.12, 1.01, -Wd * 0.3);
    H.cyl(0.06, 0.05, 0.11, 10, H.toon(0xf2efe2), g, -L * 0.04, 0.77, -Wd * 0.28);
    H.cyl(0.05, 0.05, 0.012, 10, H.toon(0x7a4a2f), g, -L * 0.04, 0.77, -Wd * 0.28);
    H.box(0.45, 0.05, 0.18, wood, g, -L * 0.5 + 0.28, 1.02, -Wd / 2 + 0.1);
    H.box(0.24, 0.16, 0.1, H.toon(0x374b4d), g, -L * 0.5 + 0.28, 1.13, -Wd / 2 + 0.1);
    // port-side nav station (faces the open cabin door)
    var nav = new THREE.Group();
    nav.position.set(-L * 0.12, 0.0, -Wd / 2 + 0.18);
    g.add(nav);
    H.box(1.2, 0.7, 0.32, H.toon(0x728a86), nav, 0, 0.35, 0);
    H.box(1.26, 0.05, 0.42, H.toon(0xb8b198), nav, 0, 0.71, 0.04);
    // radar screen
    H.box(0.46, 0.36, 0.06, H.toon(0x2d3939), nav, 0.28, 0.94, 0.12);
    var radar2 = H.plane(0.4, 0.3, new THREE.MeshBasicMaterial({ map: radarTex }), nav, 0.28, 0.94, 0.156);
    // fish finder
    H.box(0.3, 0.4, 0.06, H.toon(0x2d3939), nav, -0.16, 0.96, 0.12);
    var ff2 = H.plane(0.24, 0.33, new THREE.MeshBasicMaterial({ map: ffTex }), nav, -0.16, 0.96, 0.156);
    // screens glow
    H.plane(0.62, 0.5, new THREE.MeshBasicMaterial({
      color: 0x7df0cd, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false
    }), nav, 0.08, 0.95, 0.19);
    // radio & switches
    H.box(0.28, 0.13, 0.12, H.toon(0x394b4c), nav, -0.5, 0.8, 0.14);
    H.sphere(0.026, H.emissive(0xffb46a), nav, -0.57, 0.8, 0.212, 6, 4);
    H.cyl(0.012, 0.012, 0.13, 4, M.iron, nav, -0.38, 0.85, 0.14).rotation.z = 0.5;
    // chart on the desk
    var chartPlane = H.plane(0.62, 0.36, new THREE.MeshBasicMaterial({ map: T.chart }), nav, -0.08, 0.745, -0.02);
    chartPlane.rotation.x = -Math.PI / 2;
    // mug + thermos on the desk end
    H.cyl(0.075, 0.08, 0.28, 10, H.toon(0xe6e0c9), g, -L * 0.12 + 0.66, 0.88, -Wd / 2 + 0.42);
    H.cyl(0.078, 0.078, 0.06, 10, H.toon(0x9d4e44), g, -L * 0.12 + 0.66, 1.04, -Wd / 2 + 0.42);
    H.cyl(0.06, 0.05, 0.12, 10, H.toon(0xf2efe2), g, -L * 0.12 + 0.53, 0.78, -Wd / 2 + 0.4);
    H.cyl(0.052, 0.052, 0.012, 10, H.toon(0x7a4a2f), g, -L * 0.12 + 0.53, 0.78, -Wd / 2 + 0.4);
    // wall clock + barometer
    H.cyl(0.08, 0.08, 0.03, 12, H.toon(0xdfd7bc), g, L * 0.12, 1.18, -Wd / 2 + 0.07).rotation.x = Math.PI / 2;
    H.cyl(0.05, 0.05, 0.03, 12, H.toon(0xcfc6a9), g, L * 0.3, 1.1, -Wd / 2 + 0.07).rotation.x = Math.PI / 2;
    // chart and tide table on the port wall
    H.box(0.84, 0.58, 0.02, M.woodDark, g, -1.05, 1.15, -Wd / 2 + 0.055);
    var wallChart = H.signPlane(0.78, 0.52, T.chart, g, -1.05, 1.15, -Wd / 2 + 0.07);
    var tideTex = H.tex(256, 320, function (ctx, w, h) {
      ctx.fillStyle = '#efe8d5'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(70,95,95,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#365858'; ctx.textAlign = 'center'; ctx.font = 'bold 26px "Yu Gothic",sans-serif';
      ctx.fillText('潮汐表', w / 2, 46);
      ctx.font = '18px "Yu Gothic",sans-serif'; ctx.fillStyle = '#4d6b67';
      var rows = [['満潮', '05:12'], ['干潮', '11:26'], ['満潮', '17:48'], ['干潮', '23:55']];
      rows.forEach(function (r, i) {
        var y = 96 + i * 48;
        ctx.textAlign = 'left'; ctx.fillStyle = '#3f5f5b'; ctx.fillText(r[0], 24, y);
        ctx.textAlign = 'right'; ctx.fillStyle = '#7a5e43'; ctx.fillText(r[1], w - 24, y);
        ctx.strokeStyle = 'rgba(90,110,100,0.18)'; ctx.beginPath(); ctx.moveTo(16, y + 14); ctx.lineTo(w - 16, y + 14); ctx.stroke();
      });
      ctx.fillStyle = 'rgba(150,70,55,0.7)'; ctx.font = '16px "Yu Gothic",sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('汐見港 ・ 7/18', w / 2, h - 24);
    }, { clamp: true });
    H.signPlane(0.26, 0.32, tideTex, g, -0.35, 1.38, -Wd / 2 + 0.07);
    H.box(0.31, 0.025, 0.03, M.woodDark, g, -0.35, 1.55, -Wd / 2 + 0.08);
    H.cyl(0.22, 0.22, 0.018, 16, H.toon(0xdfd7bc), g, L * 0.35, 1.3, -Wd / 2 + 0.045).rotation.x = Math.PI / 2;
    // wood beams on the ceiling
    [-L * 0.28, 0, L * 0.28].forEach(function (bx) {
      H.box(0.06, 0.05, Wd - 0.2, M.woodDark, g, bx, Hh - 0.09, 0);
    });
    // yellow raincoat
    var coat = new THREE.Group();
    coat.position.set(-L * 0.02 + 0.2, 0.42, Wd / 2 - 0.09);
    coat.rotation.y = Math.PI;
    g.add(coat);
    var coatMat = H.toon(0xe8c33f);
    var body = H.box(0.42, 0.72, 0.09, coatMat, coat, 0, -0.36, 0);
    body.rotation.z = 0.03;
    H.box(0.16, 0.18, 0.1, coatMat, coat, 0, 0.03, 0);
    var hood = H.sphere(0.14, coatMat, coat, 0, 0.09, 0, 8, 6);
    hood.scale.y = 0.8;
    var sl1 = H.box(0.1, 0.5, 0.08, coatMat, coat, -0.24, -0.36, 0);
    sl1.rotation.z = 0.22;
    var sl2 = H.box(0.1, 0.45, 0.08, coatMat, coat, 0.24, -0.34, 0);
    sl2.rotation.z = -0.2;
    H.cyl(0.01, 0.01, 0.08, 4, M.iron, coat, 0, 0.2, 0);
    // amulet by the port window (visible from the cabin)
    var amulet = new THREE.Group();
    amulet.position.set(L * 0.2, Hh * 0.55, -Wd / 2 + 0.16);
    g.add(amulet);
    H.box(0.16, 0.22, 0.02, H.toon(0xe7e0ca), amulet, 0, 0, 0);
    H.box(0.12, 0.18, 0.025, H.toon(0xb33f38), amulet, 0, 0, 0.005);
    H.box(0.04, 0.1, 0.028, H.toon(0xd6b45e), amulet, 0, 0.02, 0.01);
    H.tube([new THREE.Vector3(0, 0.11, 0), new THREE.Vector3(0.05, 0.22, 0), new THREE.Vector3(-0.02, 0.3, 0)], 0.007, M.rope, amulet, 6);
    // catch photo on the port wall
    var phFrame = H.box(0.29, 0.23, 0.012, M.woodDark, g, L * 0.35, 1.02, -Wd / 2 + 0.08);
    var ph = H.signPlane(0.26, 0.2, T.photo, g, L * 0.35, 1.02, -Wd / 2 + 0.09);
    // sticker on the outside of the starboard glass
    var stk = H.signPlane(0.18, 0.18, T.photo, g, L * 0.36, 1.12, Wd / 2 + 0.055);
    stk.material.opacity = 0.55;
    // ceiling lamp + caustic
    H.cyl(0.11, 0.06, 0.09, 10, H.toon(0xd8dbc8), g, 0, Hh - 0.13, 0);
    H.sphere(0.055, H.emissive(0xffe6b0), g, 0, Hh - 0.2, 0, 8, 6);
    var ceilCaus = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.8, Wd * 0.8), new THREE.MeshBasicMaterial({
      map: T.caustic, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    ceilCaus.rotation.x = Math.PI / 2;
    ceilCaus.position.set(0, Hh - 0.02, 0);
    g.add(ceilCaus);
    W.cabinCaustics = W.cabinCaustics || [];
    W.cabinCaustics.push({ mesh: ceilCaus, phase: H.rnd() * 6.28 });
    var light = new THREE.PointLight(0xffd9a0, 0.85, 6.5, 2);
    light.position.set(-0.1, Hh * 0.78, 0.1);
    g.add(light);
    H.plane(0.3, 0.18, new THREE.MeshBasicMaterial({
      color: 0xffe0a0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false
    }), g, -0.02, Hh - 0.22, 0.2);
    return g;
  }

  // -----------------------------------------------------------------
  // cabin boat
  // -----------------------------------------------------------------
  function makeCabinBoat(opts, scene) {
    var len = opts.len, beam = opts.beam, depth = opts.depth;
    var hull = H.makeHull(len, beam, depth);
    var base = buildHullBase({ hull: hull, len: len, beam: beam, depth: depth, name: opts.name });
    var g = base.group;

    makeCabin(g, {
      len: opts.cabinLen, width: opts.cabinWidth, height: opts.cabinHeight,
      x: opts.cabinX
    });

    // roof gear
    var rg = new THREE.Group();
    rg.position.set(opts.cabinX, opts.cabinHeight + 0.06, 0);
    g.add(rg);
    H.box(1.25, 0.16, 0.5, H.toon(0xd6dfd6), rg, -0.2, 0.17, 0);
    var radarDome = H.sphere(0.22, H.toon(0xe9eee6), rg, -0.2, 0.38, 0, 12, 8);
    radarDome.scale.y = 0.55;
    H.cyl(0.19, 0.22, 0.06, 12, M.iron, rg, -0.2, 0.26, 0);
    H.cyl(0.035, 0.05, 2.9, 8, H.toon(0xcfd9d2), rg, 0.22, 1.45, 0);
    H.box(1.5, 0.04, 0.04, H.toon(0xcfd9d2), rg, 0.22, 2.2, 0);
    H.cyl(0.008, 0.014, 1.3, 4, M.iron, rg, 0.22, 2.9, 0);
    H.cyl(0.006, 0.008, 0.9, 4, M.iron, rg, -0.25, 2.9, 0);
    H.sphere(0.035, M.orange, rg, 0.22, 3.56, 0, 6, 4);
    var shadeMat = new THREE.MeshPhongMaterial({
      color: 0xeef4ec, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false
    });
    var shade = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5), shadeMat);
    shade.rotation.x = -Math.PI / 2;
    shade.position.set(-1.4, 2.35, 0);
    g.add(shade);
    [[-2.35, -0.7], [-2.35, 0.7], [-0.45, -0.7], [-0.45, 0.7]].forEach(function (p) {
      H.cyl(0.024, 0.03, 2.3, 5, M.steel, g, p[0], 1.2, p[1]);
    });
    H.sphere(0.06, H.emissive(0xd9483a), g, len / 2 - 0.3, 0.6, 0.0, 6, 4);
    H.sphere(0.05, H.emissive(0x7fd08a), g, len / 2 - 0.5, 0.5, 0.9, 6, 4);
    // life ring on the cabin side
    var lr = new THREE.Group();
    lr.position.set(opts.cabinX - opts.cabinLen * 0.42, 1.0, opts.cabinWidth / 2 + 0.08);
    g.add(lr);
    lr.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 16), H.toon(0xf0eee0)));
    for (var i = 0; i < 4; i++) {
      var seg = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.092, 6, 3, 0.5), H.toon(0xe06a3d));
      seg.rotation.z = i * Math.PI / 2;
      lr.add(seg);
    }
    // roof life ring
    var lr2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 16), H.toon(0xf0eee0));
    lr2.position.set(-2.2, 2.35, 0.3);
    lr2.rotation.y = 1.1;
    g.add(lr2);
    // fenders on starboard
    for (var f = 0; f < 3; f++) {
      var fx = opts.cabinX - 1.9 + f * 1.7;
      var tire = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.11, 6, 12), M.rubber);
      tire.position.set(fx, -0.15, beam / 2 + 0.22);
      tire.rotation.x = Math.PI / 2;
      tire.rotation.z = 0.2;
      g.add(tire);
      H.tube([new THREE.Vector3(fx, 0.2, beam / 2 + 0.1), new THREE.Vector3(fx, -0.05, beam / 2 + 0.22)], 0.015, M.rope, g, 5);
    }
    H.box(0.8, 0.45, 0.7, H.toon(0xdbe4db), g, -len / 2 + 0.9, 0.25, -0.3);
    H.box(0.55, 0.4, 0.45, H.toon(0xffffff, { map: T.crate }), g, -len / 2 + 1.9, 0.23, 0.55);
    H.cyl(0.19, 0.16, 0.34, 10, H.toon(0x8faaa5), g, -len / 2 + 1.5, 0.2, -0.9);
    for (var r = 0; r < 2; r++) {
      var rod = H.cyl(0.012, 0.03, 3.2, 4, H.toon(0x4b5654), g, -len / 2 + 0.7 + r * 0.2, 1.6, beam / 2 - 0.1);
      rod.rotation.x = 0.18 - r * 0.1;
      rod.rotation.z = 0.25;
    }
    var bowRailPts = [];
    for (var br = 0; br < 12; br++) {
      var t = br / 11;
      var bx = len * 0.22 + t * (len * 0.3);
      bowRailPts.push(new THREE.Vector3(bx, 0.65, 0.12));
      H.cyl(0.018, 0.02, 0.55, 4, H.toon(0xd5dfd6), g, bx, 0.36, 0.12);
    }
    H.tube(bowRailPts, 0.02, H.toon(0xd5dfd6), g, 16);
    var anchor = new THREE.Group();
    anchor.position.set(len / 2 - 0.3, 0.28, -beam / 2 + 0.1);
    g.add(anchor);
    H.box(0.08, 0.5, 0.06, M.iron, anchor, 0, 0, 0);
    H.box(0.34, 0.06, 0.05, M.iron, anchor, 0, -0.18, 0);
    H.sphere(0.05, M.rust, anchor, 0, 0.3, 0);
    H.box(0.5, 0.32, 0.6, H.toon(0x6d7d78), g, -len / 2 + 1.2, 0.2, 1.1);
    H.outline(base.hull, 0.0016, 0x244045);
    // weathered rust streaks and rainwater beads
    var rustMat = new THREE.MeshBasicMaterial({ map: T.rust, transparent: true, opacity: 0.42, depthWrite: false });
    for (var rsi = 0; rsi < 3; rsi++) {
      var rp = H.plane(0.12, 0.3, rustMat, g, opts.cabinX - 0.9 + rsi * 0.75, 0.29, opts.cabinWidth / 2 + 0.048);
      rp.rotation.z = H.rr(-0.12, 0.12);
    }
    var rp2 = H.plane(0.1, 0.3, rustMat, g, opts.cabinX + 0.7, 0.28, -opts.cabinWidth / 2 - 0.09);
    rp2.rotation.y = Math.PI;
    for (var bdi = 0; bdi < 4; bdi++) {
      var bd = H.sphere(0.026, H.basic(0xeafffa), g, -1.15 + bdi * 0.72, 0.14, 1.12, 5, 4);
      bd.scale.y = 1.3;
    }
    for (var hsi = 0; hsi < 2; hsi++) {
      var hs = H.plane(0.1, 0.36, rustMat, g, opts.len * 0.3, -0.05, (hsi ? 1 : -1) * opts.beam * 0.41);
      if (!hsi) hs.rotation.y = Math.PI;
    }

    var numTex = H.textTexture([{ text: opts.reg || 'SH-12', size: 74, color: '#3e5f5e' }], { w: 512, h: 128 });
    var num = H.signPlane(0.85, 0.22, numTex, g, opts.cabinX + 0.35, 0.95, opts.cabinWidth / 2 + 0.075);
    num.rotation.y = 0;

    var group = new THREE.Group();
    group.add(g);
    group.position.set(opts.x, H.L.waterY + 0.58, opts.z);
    group.rotation.y = opts.ry || 0;
    scene.add(group);
    var rec = {
      group: group, baseY: group.position.y, phase: H.rnd() * 6.28,
      rollPhase: H.rnd() * 6.28, kind: opts.kind || 'cabin', opts: opts
    };
    (W.boatList = W.boatList || []).push(rec);
    return rec;
  }

  // -----------------------------------------------------------------
  // open fishing boat
  // -----------------------------------------------------------------
  function makeOpenBoat(opts, scene) {
    var hull = H.makeHull(opts.len, opts.beam, opts.depth);
    var base = buildHullBase({
      hull: hull, len: opts.len, beam: opts.beam, depth: opts.depth,
      name: opts.name, innerFloor: -0.32, open: true
    });
    var g = base.group;
    H.box(opts.beam * 0.8, 0.07, 0.3, M.wood, g, -0.4, 0.03, 0);
    H.box(opts.beam * 0.8, 0.07, 0.3, M.wood, g, 0.9, 0.03, 0);
    H.box(0.3, 0.07, opts.beam * 0.62, M.wood, g, -1.25, 0.03, 0);
    [-0.4, 0.9].forEach(function (bx) {
      [-1, 1].forEach(function (s) {
        H.box(0.05, 0.5, 0.05, M.woodDark, g, bx, -0.2, s * opts.beam * 0.36);
      });
    });
    H.box(0.55, 0.7, 0.5, H.toon(0xdde6dd), g, 0.65, 0.28, 0.15);
    var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 5, 12), M.iron);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0.45, 0.5, 0.15);
    g.add(wheel);
    var ob = new THREE.Group();
    ob.position.set(-opts.len / 2 - 0.1, 0.05, 0);
    g.add(ob);
    H.box(0.32, 0.55, 0.4, H.toon(0xe4e9e1), ob, 0, 0.2, 0);
    H.box(0.26, 0.2, 0.28, H.toon(0x3b4a4c), ob, 0, 0.5, 0);
    H.cyl(0.06, 0.07, 1.2, 8, M.iron, ob, 0, -0.5, 0);
    H.box(0.26, 0.06, 0.4, M.iron, ob, 0, -1.08, 0);
    H.outline(ob.children[0], 0.0022);
    var netMound = H.sphere(0.6, H.toon(0x6d8c7f), g, -0.9, 0.0, 0.3, 8, 6);
    netMound.scale.set(1.3, 0.5, 1.1);
    H.cyl(0.16, 0.14, 0.3, 8, H.toon(0x8ea6a0), g, 1.4, 0.02, -0.4);
    for (var i = 0; i < 4; i++) {
      H.sphere(0.12, i % 2 ? M.orange : H.toon(0xeee9d6), g, -1.6 + i * 0.25, 0.1, -0.5, 7, 5);
    }
    H.box(0.3, 0.08, 0.1, M.iron, g, opts.len / 2 - 0.3, 0.2, 0);
    H.outline(base.hull, 0.0016, 0x244045);
    // weathered rust streaks and rainwater beads
    var rustMat = new THREE.MeshBasicMaterial({ map: T.rust, transparent: true, opacity: 0.42, depthWrite: false });
    for (var rsi = 0; rsi < 3; rsi++) {
      var rp = H.plane(0.12, 0.3, rustMat, g, opts.cabinX - 0.9 + rsi * 0.75, 0.29, opts.cabinWidth / 2 + 0.048);
      rp.rotation.z = H.rr(-0.12, 0.12);
    }
    var rp2 = H.plane(0.1, 0.3, rustMat, g, opts.cabinX + 0.7, 0.28, -opts.cabinWidth / 2 - 0.09);
    rp2.rotation.y = Math.PI;
    for (var bdi = 0; bdi < 4; bdi++) {
      var bd = H.sphere(0.026, H.basic(0xeafffa), g, -1.15 + bdi * 0.72, 0.14, 1.12, 5, 4);
      bd.scale.y = 1.3;
    }
    for (var hsi = 0; hsi < 2; hsi++) {
      var hs = H.plane(0.1, 0.36, rustMat, g, opts.len * 0.3, -0.05, (hsi ? 1 : -1) * opts.beam * 0.41);
      if (!hsi) hs.rotation.y = Math.PI;
    }

    g.position.set(opts.x, H.L.waterY + opts.freeboard, opts.z);
    g.rotation.y = opts.ry || 0;
    scene.add(g);
    var rec = {
      group: g, baseY: g.position.y, phase: H.rnd() * 6.28,
      rollPhase: H.rnd() * 6.28, kind: 'open', opts: opts
    };
    (W.boatList = W.boatList || []).push(rec);
    return rec;
  }

  function mooring(scene, ax, az, bx, bz, sag) {
    var mid = new THREE.Vector3((ax + bx) / 2, 0.02 - (sag === undefined ? 0.5 : sag), (az + bz) / 2);
    H.tube([
      new THREE.Vector3(ax, H.L.waterY + 0.65, az),
      new THREE.Vector3(ax * 0.7 + bx * 0.3, -0.15, az * 0.7 + bz * 0.3),
      mid,
      new THREE.Vector3(ax * 0.2 + bx * 0.8, 0.1, az * 0.2 + bz * 0.8),
      new THREE.Vector3(bx, 0.35, bz)
    ], 0.035, M.rope, scene, 24);
  }

  // -----------------------------------------------------------------
  H.buildBoats = function (scene) {
    ready();
    var g = new THREE.Group(); scene.add(g);
    W.boats = g;

    var A = makeCabinBoat({
      x: 8.2, z: 5.2, ry: 0.02, len: 6.6, beam: 2.35, depth: 1.15,
      cabinX: -0.25, cabinLen: 3.2, cabinWidth: 1.85, cabinHeight: 1.5,
      name: '汐見丸', reg: 'SH-127', kind: 'cabinA'
    }, g);
    W.boatA = A;
    mooring(g, 4.95, 5.4, 3.6, 7.45, 0.6);
    mooring(g, 11.3, 5.4, 11.2, 7.5, 0.4);

    var B = makeOpenBoat({
      x: 15.0, z: 4.6, ry: 0.06, len: 4.8, beam: 1.85, depth: 0.9,
      freeboard: 0.5, name: '汐見'
    }, g);
    mooring(g, 13.0, 4.9, 11.2, 7.5, 0.35);
    mooring(g, 16.8, 4.8, 16.5, 7.55, 0.35);

    var C = makeCabinBoat({
      x: -5.5, z: -4.1, ry: Math.PI / 2 - 0.03, len: 6.8, beam: 2.3, depth: 1.12,
      cabinX: -0.4, cabinLen: 3.0, cabinWidth: 1.75, cabinHeight: 1.35,
      name: '第三汐見', reg: 'SH-08', kind: 'cabinB'
    }, g);
    W.boatC = C;
    mooring(g, -5.5, -0.8, -8.35, 1.0, 0.4);
    mooring(g, -5.5, -7.4, -8.35, -9.6, 0.4);

    makeOpenBoat({
      x: -4.4, z: 2.3, ry: Math.PI / 2 + 0.08, len: 4.2, beam: 1.65, depth: 0.8,
      freeboard: 0.45
    }, g);

    var E = makeCabinBoat({
      x: 11.6, z: -4.8, ry: 0.12, len: 6.2, beam: 2.2, depth: 1.1,
      cabinX: -0.5, cabinLen: 2.9, cabinWidth: 1.7, cabinHeight: 1.4,
      name: '汐風', reg: 'SH-21', kind: 'departing'
    }, g);
    W.boatE = E;

    var punt = new THREE.Group();
    punt.position.set(-6.8, H.L.waterY + 0.35, -10.2);
    punt.rotation.y = 0.5;
    g.add(punt);
    var phull = new THREE.Mesh(H.makeHull(2.6, 1.0, 0.45), H.toon(0xffffff, { map: T.wood, side: THREE.DoubleSide }));
    punt.add(phull);
    H.outline(phull, 0.0022, 0x4a3a2a);
    W.punt = punt;
  };

})(window.H);
