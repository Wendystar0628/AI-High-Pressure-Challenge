/* =========================================================
   汐見漁港 — quay props: bollards, lamps, crates, nets,
   winch, vending machine, slipway, umbrella, cases, sign...
   ========================================================= */
(function (H) {
  'use strict';
  var T = H.TEX, M, W;
  function ready() { M = H.M; W = H.W; }

  // -----------------------------------------------------------------
  // cast iron bollard + ropes
  // -----------------------------------------------------------------
  function makeBollard(parent, x, z, ry, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    var pts = [
      new THREE.Vector2(0.30, 0.0), new THREE.Vector2(0.32, 0.05),
      new THREE.Vector2(0.27, 0.10), new THREE.Vector2(0.22, 0.16),
      new THREE.Vector2(0.185, 0.26), new THREE.Vector2(0.165, 0.52),
      new THREE.Vector2(0.185, 0.60), new THREE.Vector2(0.21, 0.64),
      new THREE.Vector2(0.18, 0.69), new THREE.Vector2(0.20, 0.73),
      new THREE.Vector2(0.12, 0.78), new THREE.Vector2(0.0, 0.80)
    ];
    var geo = new THREE.LatheGeometry(pts, 16);
    var b = new THREE.Mesh(geo, M.iron);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
    H.outline(b, 0.0024, 0x1a2326);
    H.cyl(0.34, 0.36, 0.04, 16, M.ironLight, g, 0, 0.02, 0);
    for (var i = 0; i < 4; i++) {
      var a = i / 4 * Math.PI * 2 + 0.4;
      H.cyl(0.035, 0.04, 0.05, 6, M.ironLight, g, Math.cos(a) * 0.28, 0.05, Math.sin(a) * 0.28);
    }
    if (opts.rope !== false) {
      for (var c = 0; c < 3; c++) {
        var coil = new THREE.Mesh(new THREE.TorusGeometry(0.24 + c * 0.008, 0.033, 6, 18), M.rope);
        coil.rotation.x = Math.PI / 2;
        coil.rotation.z = c * 0.7;
        coil.position.y = 0.15 + c * 0.07;
        coil.castShadow = true;
        g.add(coil);
      }
    }
    if (opts.drop) {
      var dir = new THREE.Vector3(opts.drop[0] - x, 0, opts.drop[1] - z).normalize();
      var start = new THREE.Vector3(0.18 * dir.x, 0.3, 0.18 * dir.z);
      var pts2 = [
        start.clone(),
        new THREE.Vector3(start.x * 2.5, 0.18, start.z * 2.5),
        new THREE.Vector3(start.x * 6, -0.25, start.z * 6),
        new THREE.Vector3(start.x * 9, -0.7, start.z * 9),
        new THREE.Vector3(start.x * 10, -1.25, start.z * 10)
      ];
      var curve = new THREE.CatmullRomCurve3(pts2);
      var rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.045, 5, false), M.rope);
      rope.castShadow = true; g.add(rope);
      var wetCurve = new THREE.CatmullRomCurve3([pts2[3], pts2[4]]);
      var wet = new THREE.Mesh(new THREE.TubeGeometry(wetCurve, 8, 0.047, 5, false), M.ropeWet);
      g.add(wet);
    }
    return g;
  }

  // -----------------------------------------------------------------
  // wall details: hanging tyres, ladder, rings
  // -----------------------------------------------------------------
  function makeTyres(parent) {
    var spots = [
      { x: -7.44, z: 3.0, ry: Math.PI / 2 },
      { x: -7.44, z: -3.4, ry: Math.PI / 2 },
      { x: 5.0, z: 8.46, ry: 0 },
      { x: 13.2, z: 8.46, ry: 0 }
    ];
    spots.forEach(function (s) {
      var g = new THREE.Group();
      g.position.set(s.x, -0.25, s.z);
      g.rotation.y = s.ry;
      parent.add(g);
      var tyre = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.16, 8, 16), M.rubber);
      tyre.rotation.x = Math.PI / 2;
      tyre.castShadow = true;
      g.add(tyre);
      H.cyl(0.025, 0.025, 1.1, 5, M.rope, g, 0, 0.75, 0);
      H.sphere(0.06, M.ropeWet, g, 0, 1.28, 0);
      for (var b = 0; b < 4; b++) {
        H.sphere(0.035, H.toon(0xd9dcc8), g, H.rr(-0.35, 0.35), H.rr(-0.1, 0.1), H.rr(-0.2, 0.2), 5, 4);
      }
    });
  }

  function makeLadder(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    parent.add(g);
    var railGeo = new THREE.CylinderGeometry(0.035, 0.035, 4.2, 6);
    [-0.32, 0.32].forEach(function (ox) {
      var r = new THREE.Mesh(railGeo, H.toon(0x7a5a42));
      r.position.set(ox, -2.1, 0.06);
      g.add(r);
    });
    for (var i = 0; i < 11; i++) {
      var rung = H.cyl(0.028, 0.028, 0.7, 6, H.toon(0x8a674b), g, 0, -0.2 - i * 0.38, 0.06);
      rung.rotation.z = Math.PI / 2;
    }
    [-0.1, -1.6, -3.4].forEach(function (y) {
      H.box(0.1, 0.08, 0.16, M.rust, g, -0.32, y, 0.14);
    });
    return g;
  }

  function makeWallRings(parent) {
    var spots = [
      { x: -7.44, z: 5.6, ry: Math.PI / 2 },
      { x: -7.44, z: -1.0, ry: Math.PI / 2 },
      { x: 7.6, z: 8.45, ry: 0 },
      { x: 1.5, z: 8.45, ry: 0 }
    ];
    spots.forEach(function (s) {
      var g = new THREE.Group();
      g.position.set(s.x, -0.38, s.z);
      g.rotation.y = s.ry;
      parent.add(g);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 6, 14), M.rust);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = 0.3;
      g.add(ring);
      H.box(0.16, 0.12, 0.06, M.rust, g, 0, 0.19, -0.01);
    });
  }

  // -----------------------------------------------------------------
  // lamp post with ring shade
  // -----------------------------------------------------------------
  function makeLampPost(parent, x, z, h) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    H.cyl(0.28, 0.34, 0.35, 10, M.concrete, g, 0, 0.17, 0);
    H.cyl(0.075, 0.13, h, 10, M.iron, g, 0, 0.35 + h / 2, 0);
    H.outline(g.children[1], 0.0022);
    H.cyl(0.16, 0.16, 0.08, 10, M.iron, g, 0, 0.6, 0);
    H.cyl(0.14, 0.17, 0.12, 10, M.iron, g, 0, h * 0.72, 0);
    var armPts = [
      new THREE.Vector3(0, h * 0.78, 0),
      new THREE.Vector3(0.12, h * 0.9, 0),
      new THREE.Vector3(0.3, h * 0.95, 0),
      new THREE.Vector3(0.42, h * 0.93, 0)
    ];
    H.tube(armPts, 0.055, M.iron, g, 16);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.13, 8, 24), M.ironLight);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0.42, h * 0.9, 0);
    g.add(ring);
    var glow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xffe3ad, transparent: true, opacity: 0.85 }));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0.42, h * 0.885, 0);
    g.add(glow);
    var bulb = H.sphere(0.16, H.emissive(0xffe9b5), g, 0.42, h * 0.9, 0, 10, 8);
    bulb.scale.y = 0.45;
    var pl = new THREE.PointLight(0xffdc9a, 0.5, 9, 2);
    pl.position.set(0.42, h * 0.85, 0);
    g.add(pl);
    H.cyl(0.008, 0.008, 0.5, 4, M.iron, g, 0.42, h * 0.84, 0);
    for (var ldi = 0; ldi < 6; ldi++) {
      var la = ldi / 6 * Math.PI * 2;
      var ld = H.sphere(0.028, H.basic(0xeafffa), g, 0.42 + Math.cos(la) * 0.5, h * 0.885 - 0.05, Math.sin(la) * 0.5, 5, 4);
      ld.scale.y = 1.4;
    }
    return g;
  }

  // -----------------------------------------------------------------
  // crates and baskets
  // -----------------------------------------------------------------
  function makeCrateStack(parent, x, z, n, ry, blue) {
    var mat = blue ? H.toon(0xffffff, { map: T.crateBlue }) : H.toon(0xffffff, { map: T.crate });
    var geo = new THREE.BoxGeometry(0.9, 0.52, 0.62);
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    for (var i = 0; i < n; i++) {
      var c = new THREE.Mesh(geo, mat);
      c.position.set(H.rr(-0.04, 0.04), 0.26 + i * 0.5, H.rr(-0.03, 0.03));
      c.rotation.y = H.rr(-0.1, 0.1);
      c.castShadow = true; c.receiveShadow = true;
      g.add(c);
      H.outline(c, 0.0019);
      if (i === n - 1) {
        var top = H.plane(0.8, 0.5, new THREE.MeshBasicMaterial({ color: 0x2b4244 }), g, 0, 0.525 + i * 0.5, 0);
        top.rotation.x = -Math.PI / 2;
      }
    }
    return g;
  }

  function makeFishCrates(parent) {
    makeCrateStack(parent, -10.3, 6.2, 3, 0.18, false);
    makeCrateStack(parent, -9.4, 5.55, 2, -0.1, false);
    makeCrateStack(parent, -10.0, 5.0, 2, 0.3, true);
    makeCrateStack(parent, 16.7, 13.1, 3, 0.1, false);
    makeCrateStack(parent, 17.55, 12.4, 2, -0.2, true);
    makeCrateStack(parent, 13.6, 11.1, 2, 0.35, true);
    makeCrateStack(parent, -8.6, -7.9, 2, 0.2, false);
    var g = new THREE.Group();
    g.position.set(-9.0, 0, 6.8);
    g.rotation.y = 0.4;
    parent.add(g);
    H.box(0.9, 0.5, 0.62, H.toon(0xffffff, { map: T.crate }), g, 0, 0.25, 0);
    var inner = H.plane(0.78, 0.5, new THREE.MeshBasicMaterial({ color: 0x416162 }), g, 0, 0.48, 0);
    inner.rotation.x = -Math.PI / 2;
    for (var f = 0; f < 4; f++) {
      var fish = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 5), H.toon(0xb7cdd0));
      fish.scale.set(2.1, 0.55, 0.7);
      fish.position.set(-0.25 + f * 0.18, 0.5, -0.12 + (f % 2) * 0.2);
      fish.rotation.y = 0.7;
      g.add(fish);
    }
    for (var i = 0; i < 6; i++) {
      var ice = H.box(0.1, 0.06, 0.1, H.basic(0xd9f2ef), g, H.rr(-0.35, 0.35), 0.53, H.rr(-0.2, 0.2));
      ice.rotation.y = H.rr(0, 3);
    }
  }

  // -----------------------------------------------------------------
  // nets, float line
  // -----------------------------------------------------------------
  function makeNetRack(parent, x, z, ry, scale) {
    scale = scale || 1;
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    g.scale.setScalar(scale);
    parent.add(g);
    var frameMat = H.toon(0x5d6b66);
    [-1.6, 1.6].forEach(function (px) {
      var p1 = H.cyl(0.04, 0.05, 2.7, 6, frameMat, g, px, 1.35, 0);
      p1.rotation.x = 0.22;
      var p2 = H.cyl(0.04, 0.05, 2.7, 6, frameMat, g, px, 1.35, 0);
      p2.rotation.x = -0.22;
      H.cyl(0.03, 0.03, 1.2, 5, frameMat, g, px, 0.55, 0);
      H.cyl(0.1, 0.14, 0.08, 8, M.concreteDark, g, px, 0.04, 0);
    });
    H.cyl(0.035, 0.035, 3.3, 6, frameMat, g, 0, 2.62, 0).rotation.z = Math.PI / 2;
    var netMat = new THREE.MeshBasicMaterial({
      map: T.net.clone(), transparent: true, opacity: 0.92, alphaTest: 0.25,
      side: THREE.DoubleSide, depthWrite: false, color: 0x89a79e
    });
    netMat.map.wrapS = netMat.map.wrapT = THREE.RepeatWrapping;
    netMat.map.repeat.set(4, 2.4);
    netMat.map.needsUpdate = true;
    var net = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.5, 12, 8), netMat);
    net.position.set(0, 1.52, 0.02);
    net.rotation.x = -0.1;
    g.add(net);
    var net2 = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.9, 8, 3), netMat);
    net2.position.set(-0.1, 0.42, 0.45);
    net2.rotation.x = -1.35;
    g.add(net2);
    var ropePts = [];
    for (var i = 0; i < 10; i++) {
      var t = i / 9;
      ropePts.push(new THREE.Vector3(-1.6 + t * 3.2, 0.25 + Math.sin(t * Math.PI) * 0.1, 0.75));
      if (i % 2 === 0) {
        H.sphere(0.12, i % 4 === 0 ? M.orange : H.toon(0xe7e3ce), g, -1.6 + t * 3.2, 0.25, 0.8, 8, 6);
      }
    }
    H.tube(ropePts, 0.022, M.rope, g, 16);
    H.cyl(0.1, 0.12, 0.2, 8, M.iron, g, -1.55, 0.1, -0.2);
    W.nets = W.nets || [];
    W.nets.push({ group: g, baseRotY: ry || 0, phase: H.rnd() * 6.28 });
    return g;
  }

  function makeFloatLine(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    H.cyl(0.05, 0.07, 2.4, 6, M.woodDark, g, -1.7, 1.2, 0);
    H.cyl(0.05, 0.07, 2.4, 6, M.woodDark, g, 1.7, 1.2, 0);
    var pts = [];
    for (var i = 0; i <= 12; i++) {
      var t = i / 12;
      pts.push(new THREE.Vector3(-1.7 + t * 3.4, 2.2 - Math.sin(t * Math.PI) * 0.4, 0));
      if (i > 0 && i < 12 && i % 2 === 0) {
        H.sphere(0.15, i % 4 === 0 ? M.orange : H.toon(0xeae6d4), g, pts[i].x, pts[i].y - 0.13, 0, 8, 6);
      }
    }
    H.tube(pts, 0.02, M.rope, g, 20);
    W.floatLine = { group: g, phase: H.rnd() * 6.28 };
    return g;
  }

  // -----------------------------------------------------------------
  // winch + davit
  // -----------------------------------------------------------------
  function makeWinch(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    var rustM = H.toon(0x8b6347);
    H.box(1.3, 0.18, 0.8, rustM, g, 0, 0.09, 0);
    [-0.5, 0.5].forEach(function (px) {
      var sh = new THREE.Shape();
      sh.moveTo(-0.28, 0);
      sh.lineTo(0.28, 0);
      sh.lineTo(0.28, 0.55);
      sh.lineTo(0.1, 0.8);
      sh.lineTo(-0.15, 0.8);
      sh.lineTo(-0.28, 0.5);
      sh.lineTo(-0.28, 0);
      var geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
      var pl = new THREE.Mesh(geo, rustM);
      pl.rotation.y = Math.PI / 2;
      pl.position.set(px, 0.16, 0.03);
      pl.castShadow = true;
      g.add(pl);
    });
    var drum = H.cyl(0.32, 0.32, 0.85, 14, H.toon(0x565f5b), g, 0, 0.62, 0);
    drum.rotation.z = Math.PI / 2;
    for (var i = 0; i < 9; i++) {
      var coil = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 4, 14), M.rope);
      coil.position.set(-0.35 + i * 0.085, 0.62, 0);
      coil.rotation.y = Math.PI / 2;
      g.add(coil);
    }
    H.cyl(0.035, 0.035, 0.9, 6, rustM, g, 0.58, 0.55, 0).rotation.x = Math.PI / 2;
    H.cyl(0.035, 0.035, 0.6, 6, rustM, g, 0.82, 0.32, 0);
    H.cyl(0.06, 0.06, 0.22, 8, M.woodDark, g, 0.58, 0.55, 0.5).rotation.x = Math.PI / 2;
    H.tube([
      new THREE.Vector3(0, 0.62, 0.3), new THREE.Vector3(-0.1, 0.2, 1.2),
      new THREE.Vector3(-0.3, -0.3, 2.0), new THREE.Vector3(-0.4, -1.0, 2.4)
    ], 0.035, M.rope, g, 12);
    return g;
  }

  function makeDavit(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    H.cyl(0.4, 0.5, 0.4, 8, M.concreteDark, g, 0, 0.2, 0);
    H.cyl(0.1, 0.14, 4.4, 8, M.rustLight, g, 0, 2.2, 0);
    H.cyl(0.06, 0.06, 2.4, 6, M.rustLight, g, 0, 4.3, 1.15).rotation.x = Math.PI / 2;
    H.cyl(0.05, 0.05, 1.9, 6, M.rustLight, g, 0, 3.55, 0.65).rotation.x = -0.75;
    var pul = H.mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 12), M.iron, g, 0, 4.2, 2.3);
    pul.rotation.y = Math.PI / 2;
    H.tube([
      new THREE.Vector3(0, 4.2, 2.3), new THREE.Vector3(0.05, 2.5, 2.4), new THREE.Vector3(0, 1.2, 2.3)
    ], 0.022, M.rope, g, 12);
    var hook = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 5, 10, Math.PI * 1.5), M.rust);
    hook.position.set(0, 1.05, 2.3);
    hook.rotation.z = 1.2;
    g.add(hook);
    return g;
  }

  // -----------------------------------------------------------------
  // vending machine
  // -----------------------------------------------------------------
  function makeVendingMachine(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    var body = H.box(1.35, 2.35, 0.95, H.toon(0xdfe7e0), g, 0, 1.175, 0);
    H.outline(body, 0.0022);
    var face = H.plane(1.15, 2.0, new THREE.MeshBasicMaterial({ map: T.vending }), g, 0, 1.2, 0.482);
    face.material.color.set(0xd6dcd4);
    var sideT = H.textTexture([
      { text: '汐見', size: 54, color: '#a5473d', y: 60 },
      { text: 'サイダー', size: 32, color: '#3e625f', y: 108 }
    ], { w: 256, h: 160 });
    var side = H.signPlane(0.8, 0.5, sideT, g, 0.681, 1.55, 0);
    side.rotation.y = Math.PI / 2;
    var aw = H.box(1.7, 0.08, 1.3, M.rust, g, 0, 2.55, 0.15);
    aw.rotation.x = -0.12;
    for (var i = 0; i < 6; i++) {
      H.box(0.02, 0.2, 1.25, M.rust, g, -0.75 + i * 0.3, 2.42, 0.15).rotation.x = -0.12;
    }
    H.box(1.4, 0.12, 1.0, M.iron, g, 0, 0.06, 0);
    var glow = H.plane(1.1, 0.34, new THREE.MeshBasicMaterial({
      color: 0xffe7b8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false
    }), g, 0, 2.18, 0.55);
    H.box(0.6, 0.8, 0.5, H.toon(0x3f7681), g, -1.0, 0.4, 0.15);
    H.cyl(0.2, 0.2, 0.07, 8, H.toon(0x2e5d66), g, -1.0, 0.82, 0.15);
    H.cyl(0.06, 0.06, 0.18, 8, M.steel, g, 0.9, 0.09, 0.55).rotation.z = 1.4;
    return g;
  }

  // -----------------------------------------------------------------
  // harbor sign
  // -----------------------------------------------------------------
  function makeSign(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    H.cyl(0.07, 0.09, 2.6, 8, M.woodDark, g, -1.15, 1.3, 0);
    H.cyl(0.07, 0.09, 2.6, 8, M.woodDark, g, 1.15, 1.3, 0);
    var tex = H.tex(768, 420, function (ctx, w, h) {
      ctx.fillStyle = '#e9e5d5'; ctx.fillRect(0, 0, w, h);
      var grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(255,255,245,0.3)');
      grd.addColorStop(1, 'rgba(150,140,115,0.25)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(90,80,60,0.35)'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#2d4a4b';
      ctx.textAlign = 'center';
      ctx.font = 'bold 118px "Yu Gothic","MS Gothic",sans-serif';
      ctx.fillText('汐見漁港', w / 2, 150);
      ctx.font = 'bold 34px sans-serif';
      ctx.fillStyle = '#4b6563';
      ctx.fillText('S H I O M I   F I S H I N G   P O R T', w / 2, 205);
      ctx.fillStyle = '#b0443a';
      ctx.font = 'bold 76px "Yu Gothic","MS Gothic",sans-serif';
      ctx.fillText('注意落水', w / 2, 310);
      ctx.fillStyle = '#526664';
      ctx.font = '26px "Yu Gothic",sans-serif';
      ctx.fillText('足元注意 ・ 立入りは自己責任で', w / 2, 365);
      for (var i = 0; i < 300; i++) {
        ctx.fillStyle = 'rgba(110,100,80,' + Math.random() * 0.08 + ')';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 8, 1 + Math.random() * 6);
      }
    }, { clamp: true });
    var board = H.box(2.55, 1.45, 0.1, H.toon(0xffffff, { map: tex }), g, 0, 2.0, 0);
    board.castShadow = true;
    H.outline(board, 0.0022);
    H.box(2.62, 0.06, 0.14, M.rust, g, 0, 2.72, 0);
    H.box(2.62, 0.06, 0.14, M.rust, g, 0, 1.28, 0);
    var buoy = H.sphere(0.14, M.orange, g, 1.05, 1.05, 0.08, 8, 6);
    buoy.scale.y = 1.3;
    H.tube([
      new THREE.Vector3(1.05, 1.28, 0.05), new THREE.Vector3(1.05, 1.4, 0.05),
      new THREE.Vector3(1.2, 1.45, 0.03)
    ], 0.012, M.rope, g, 8);
    var rust = H.signPlane(2.4, 1.35, T.rust, g, 0, 2.0, 0.056);
    rust.material.opacity = 0.3;
    rust.material.color.set(0xb27a50);
    return g;
  }

  // -----------------------------------------------------------------
  // slipway + overturned dinghy
  // -----------------------------------------------------------------
  function makeSlipway(parent, x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    var ramp = H.box(3.6, 0.35, 3.6, H.toon(0xffffff, { map: T.concreteTop }), g, 0, -0.35, -1.2);
    ramp.rotation.x = 0.26;
    H.box(0.3, 0.5, 3.6, M.concrete, g, -1.75, -0.12, -1.2).rotation.x = 0.26;
    H.box(0.3, 0.5, 3.6, M.concrete, g, 1.75, -0.12, -1.2).rotation.x = 0.26;
    var wet = H.plane(3.2, 1.2, new THREE.MeshBasicMaterial({ color: 0x3d6d6b, transparent: true, opacity: 0.35, depthWrite: false }), g, 0, -0.58, -1.9);
    wet.rotation.x = -Math.PI / 2 + 0.26;
    var alg = H.plane(3.4, 0.35, new THREE.MeshBasicMaterial({ color: 0x5d7f47, transparent: true, opacity: 0.55, depthWrite: false }), g, 0, -0.82, -2.6);
    alg.rotation.x = -Math.PI / 2 + 0.26;
    return g;
  }

  function makeDinghy(parent, x, y, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(0.23, ry || 0, 0.05);
    parent.add(g);
    var hull = H.makeHull(3.0, 1.15, 0.55, { transom: true });
    var boat = new THREE.Mesh(hull, H.toon(0x9ebdb7, { map: T.wood, side: THREE.DoubleSide }));
    boat.rotation.z = Math.PI;
    boat.rotation.y = Math.PI / 2;
    boat.castShadow = true; boat.receiveShadow = true;
    g.add(boat);
    H.outline(boat, 0.0026, 0x3e4b45);
    // keel and bilge strakes on the upturned bottom
    var keel = H.box(0.11, 0.09, 3.0, M.woodDark, g, 0, 0.58, 0);
    keel.rotation.x = Math.PI / 2;
    H.outline(keel, 0.0022, 0x3a2c1e);
    [-0.42, 0.42].forEach(function (bz) {
      var strake = H.box(0.07, 0.05, 2.5, M.woodDark, g, 0, 0.6, bz);
      strake.rotation.x = Math.PI / 2;
    });
    // faded stencilled number
    var num = H.textTexture([{ text: '7', size: 120, color: '#3e5a58', alpha: 0.55 }], { w: 128, h: 128 });
    var numPlane = H.signPlane(0.34, 0.34, num, g, 0.25, 0.61, 0.55);
    numPlane.rotation.x = -Math.PI / 2;
    numPlane.material.opacity = 0.6;
    W.dinghy = g;
    return g;
  }

  // -----------------------------------------------------------------
  // instrument cases
  // -----------------------------------------------------------------
  function makeInstrumentCases(parent) {
    var silver = H.toon(0xaebbb8, { map: T.metal });
    var black = H.toon(0x262e2e);
    var g = new THREE.Group();
    g.position.set(2.3, 0, 11.2);
    g.rotation.y = -0.18;
    parent.add(g);
    function one(w, h, d, x, z, ry, seed) {
      var c = new THREE.Group();
      c.position.set(x, 0, z); c.rotation.y = ry;
      g.add(c);
      var body = H.mesh(H.roundedBox(w, h, d, 0.055, 2), silver, c, 0, h / 2 + 0.02, 0);
      body.castShadow = true;
      H.outline(body, 0.0022, 0x2b393c);
      // lid seam / protective bands
      [-1, 1].forEach(function (s) {
        H.box(w * 1.006, 0.038, 0.024, black, c, 0, h * 0.53, s * d / 2);
        H.box(0.024, 0.038, d * 1.006, black, c, s * w / 2, h * 0.53, 0);
      });
      // corner protectors
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (k) {
        H.box(0.08, 0.055, 0.08, black, c, k[0] * (w / 2 - 0.025), h * 0.92, k[1] * (d / 2 - 0.025));
        H.box(0.08, 0.055, 0.08, black, c, k[0] * (w / 2 - 0.025), h * 0.12, k[1] * (d / 2 - 0.025));
      });
      // latches
      H.box(0.1, 0.06, 0.035, M.brass, c, -w * 0.22, h * 0.55, d / 2 + 0.012);
      H.box(0.1, 0.06, 0.035, M.brass, c, w * 0.22, h * 0.55, d / 2 + 0.012);
      H.box(0.05, 0.03, 0.03, M.iron, c, 0, h * 0.55, d / 2 + 0.012);
      // carry handle
      H.box(0.22, 0.045, 0.06, black, c, 0, h + 0.06, 0);
      H.box(0.05, 0.06, 0.06, M.iron, c, -0.12, h + 0.02, 0);
      H.box(0.05, 0.06, 0.06, M.iron, c, 0.12, h + 0.02, 0);
      // luggage tag
      var tag = H.plane(0.11, 0.07, new THREE.MeshBasicMaterial({ color: seed % 2 ? 0xc9b370 : 0x7f9fa3 }), c, 0.18, h + 0.03, 0.12);
      tag.rotation.x = -Math.PI / 2;
      // tape strip
      H.box(0.9 * w, 0.004, 0.09, H.toon(0xe4dcc4), c, 0.02, h + 0.021, -d * 0.22);
      // music sticker
      var sticker = H.plane(0.2, 0.2, new THREE.MeshBasicMaterial({ color: 0xdcc46f }), c, -w * 0.22, h + 0.021, d * 0.16);
      sticker.rotation.x = -Math.PI / 2;
      var note = H.group(c, -w * 0.26, h + 0.03, d * 0.13);
      H.cyl(0.026, 0.026, 0.006, 8, black, note, 0, 0, 0).rotation.x = Math.PI / 2;
      H.box(0.012, 0.004, 0.07, black, note, 0.026, 0, 0.035);
      H.box(0.05, 0.004, 0.012, black, note, 0.004, 0, 0.07);
      // scuffs
      for (var k = 0; k < 4; k++) {
        H.box(H.rr(0.08, 0.3), 0.002, 0.015, H.toon(0x7b8a88), c, H.rr(-w * 0.35, w * 0.35), h + 0.023, H.rr(-d * 0.3, d * 0.3));
      }
      return c;
    }
    one(1.4, 0.38, 0.54, 0, 0, 0.1, 0);
    one(0.98, 0.3, 0.44, 0.12, 0.76, -0.32, 1);
    // soft cloth bag beside the cases
    var bag = H.sphere(0.35, H.toon(0xd7d2bf), g, -0.95, 0.2, 0.5, 8, 6);
    bag.scale.set(0.8, 0.6, 1.2);
    bag.rotation.y = 0.4;
    H.tube([
      new THREE.Vector3(-0.95, 0.42, 0.5), new THREE.Vector3(-0.82, 0.55, 0.7), new THREE.Vector3(-0.7, 0.5, 0.9)
    ], 0.012, M.rope, g, 8);
    return g;
  }

  // -----------------------------------------------------------------
  // transparent umbrella
  // -----------------------------------------------------------------
  function makeUmbrella(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0.02, z);
    g.rotation.set(0.03, ry || 0, 0.26);
    parent.add(g);
    var canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff7f3, transparent: true, opacity: 0.64, roughness: 0.16,
      metalness: 0, side: THREE.DoubleSide, depthWrite: false,
      clearcoat: 1.0, clearcoatRoughness: 0.08, emissive: 0x183a3c, emissiveIntensity: 0.12
    });
    var profile = [];
    for (var i = 0; i <= 10; i++) {
      var t = i / 10;
      profile.push(new THREE.Vector2(Math.sin(t * Math.PI / 2) * 0.95, -0.02 - Math.pow(t, 1.5) * 0.42));
    }
    var canopy = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), canopyMat);
    canopy.position.y = 1.7;
    canopy.renderOrder = 21;
    g.add(canopy);
    // inner frosted layer for a soft "plastic" body
    var innerMat = new THREE.MeshBasicMaterial({
      color: 0xd7f1ee, transparent: true, opacity: 0.10, side: THREE.BackSide, depthWrite: false
    });
    var inner = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), innerMat);
    inner.position.y = 1.695;
    inner.renderOrder = 20;
    g.add(inner);
    // ribs
    for (var r = 0; r < 8; r++) {
      var a = r / 8 * Math.PI * 2;
      var pts = [];
      for (var k = 0; k <= 4; k++) {
        var tt = k / 4;
        pts.push(new THREE.Vector3(
          Math.sin(tt * Math.PI / 2) * 0.97 * Math.cos(a),
          1.7 - Math.pow(tt, 1.5) * 0.44,
          Math.sin(tt * Math.PI / 2) * 0.97 * Math.sin(a)
        ));
      }
      var rib = H.tube(pts, 0.006, H.toon(0x94a9a5), g, 8);
      rib.renderOrder = 22;
    }
    // a few scalloped panel folds
    for (var f = 0; f < 8; f++) {
      var aa = (f + 0.5) / 8 * Math.PI * 2;
      var fold = H.tube([
        new THREE.Vector3(Math.cos(aa) * 0.6, 1.57, Math.sin(aa) * 0.6),
        new THREE.Vector3(Math.cos(aa) * 0.95, 1.28, Math.sin(aa) * 0.95)
      ], 0.006, H.toon(0xa9c2bd), g, 5);
      fold.renderOrder = 22;
    }
    // rim
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.016, 4, 48), H.toon(0xc4d6d2));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.29;
    g.add(rim);
    // top cap / vent
    H.cyl(0.035, 0.05, 0.08, 8, M.steel, g, 0, 1.72, 0);
    H.sphere(0.045, H.toon(0xbfd1cc), g, 0, 1.78, 0, 8, 6);
    // shaft
    H.cyl(0.022, 0.022, 2.4, 8, M.steel, g, 0, 1.15, 0);
    var hp = [
      new THREE.Vector3(0, -0.03, 0), new THREE.Vector3(0, -0.2, 0),
      new THREE.Vector3(0.18, -0.28, 0), new THREE.Vector3(0.3, -0.16, 0)
    ];
    H.tube(hp, 0.035, M.woodDark, g, 10);
    // droplets on the canopy
    for (var d = 0; d < 16; d++) {
      var ang = H.rr(0, 6.28), rad = H.rr(0.15, 0.9);
      var drop = H.sphere(H.rr(0.012, 0.028), H.basic(0xf7fffc), g, Math.cos(ang) * rad, 1.7 - Math.pow(rad / 0.97, 1.5) * 0.44 + 0.012, Math.sin(ang) * rad, 5, 4);
      drop.scale.y = 1.5;
      drop.renderOrder = 25;
    }
    W.umbrella = { group: g, edgeY: 1.27 };
    return g;
  }

  // -----------------------------------------------------------------
  // bucket, net, broom, paint cans, tarp
  // -----------------------------------------------------------------
  function makeBucket(parent, x, z) {
    var g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    H.cyl(0.21, 0.17, 0.36, 12, H.toon(0x7c9794), g, 0, 0.18, 0);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 4, 14), H.toon(0xb9c6c2));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.36; g.add(rim);
    var handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 12, Math.PI), H.toon(0xa8b9b5));
    handle.position.y = 0.36; handle.rotation.z = 0.2; g.add(handle);
    H.cyl(0.185, 0.185, 0.02, 12, new THREE.MeshBasicMaterial({ color: 0x487c7c, transparent: true, opacity: 0.6 }), g, 0, 0.33, 0);
    var fish = H.sphere(0.1, H.toon(0xb9cfd2), g, 0.05, 0.4, 0.02, 8, 5);
    fish.scale.set(2.0, 0.5, 0.7);
    fish.rotation.z = 0.6;
    return g;
  }

  function makeLongNet(parent, x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
    var pole = H.cyl(0.035, 0.04, 4.0, 6, M.woodDark, g, 0, 2.0, 0);
    pole.rotation.z = 0.16;
    var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 4, 16), H.toon(0x8a9b96));
    hoop.position.set(0.42, 4.0, 0);
    hoop.rotation.x = 0.1;
    g.add(hoop);
    var netMat = new THREE.MeshBasicMaterial({
      map: T.net.clone(), transparent: true, opacity: 0.8, alphaTest: 0.3,
      side: THREE.DoubleSide, depthWrite: false, color: 0x9fb8ae
    });
    netMat.map.repeat.set(1, 1);
    var nc = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10, 3, true), netMat);
    nc.position.set(0.42, 3.5, 0);
    nc.rotation.x = Math.PI;
    g.add(nc);
    return g;
  }

  function makeOutboard(parent, x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
    H.box(0.8, 0.1, 0.6, M.woodDark, g, 0, 0.55, 0);
    H.box(0.1, 0.6, 0.5, M.iron, g, -0.3, 0.25, 0);
    H.box(0.1, 0.6, 0.5, M.iron, g, 0.3, 0.25, 0);
    var body = H.box(0.45, 0.65, 0.55, H.toon(0xd8ddd5), g, 0, 0.95, -0.1);
    H.outline(body, 0.0022);
    H.box(0.4, 0.25, 0.3, H.toon(0x3f4a4c), g, 0, 1.0, 0.25);
    H.cyl(0.06, 0.07, 1.2, 8, M.iron, g, 0, 0.15, -0.1);
    H.box(0.35, 0.08, 0.5, M.iron, g, 0, -0.42, -0.1);
    var prop = H.mesh(new THREE.TorusGeometry(0.1, 0.018, 4, 8), M.brass, g, 0, -0.45, 0.3);
    prop.rotation.y = Math.PI / 2;
    H.box(0.46, 0.08, 0.56, H.toon(0x4a7c83), g, 0, 1.2, -0.1);
    return g;
  }

  // -----------------------------------------------------------------
  // floats / buoys in the water
  // -----------------------------------------------------------------
  function makeBuoy(parent, x, z, num, color, ropeTo) {
    var g = new THREE.Group();
    g.position.set(x, H.L.waterY + 0.1, z);
    parent.add(g);
    var body = H.sphere(0.36, H.toon(color || 0xe8663c), g, 0, 0.14, 0, 14, 10);
    body.scale.y = 1.2;
    H.cyl(0.08, 0.12, 0.3, 8, H.toon(0xe3e0cc), g, 0, 0.55, 0);
    var band = new THREE.Mesh(new THREE.TorusGeometry(0.355, 0.045, 5, 18), H.toon(0xece8d6));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.1; g.add(band);
    var tex = H.textTexture([{ text: String(num), size: 90, color: '#f2ecda' }], { w: 128, h: 128 });
    H.signPlane(0.3, 0.3, tex, g, 0, 0.18, 0.35);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 4, 10), M.rust);
    ring.position.y = 0.72; ring.rotation.x = 0.3; g.add(ring);
    if (ropeTo) {
      H.tube([
        new THREE.Vector3(0, 0.7, 0),
        new THREE.Vector3((ropeTo[0] - x) * 0.3, 0.25, (ropeTo[1] - z) * 0.3),
        new THREE.Vector3(ropeTo[0] - x, -0.7, ropeTo[1] - z)
      ], 0.02, M.rope, g, 12);
    }
    W.buoys = W.buoys || [];
    W.buoys.push({ group: g, phase: H.rnd() * 6.28, baseY: g.position.y, x: x, z: z });
    return g;
  }

  // -----------------------------------------------------------------
  // small clutter
  // -----------------------------------------------------------------
  function makeClutter(parent) {
    var pal = new THREE.Group();
    pal.position.set(-11.4, 0, 7.4); pal.rotation.y = 0.3; parent.add(pal);
    for (var i = 0; i < 5; i++) H.box(1.1, 0.06, 0.14, M.wood, pal, 0, 0.13, -0.4 + i * 0.2);
    H.box(1.0, 0.1, 0.9, M.woodDark, pal, 0, 0.05, 0);
    var tarp = H.sphere(0.5, H.toon(0x7d9a8e), parent, -11.8, 0.3, 8.2, 8, 6);
    tarp.scale.set(1.4, 0.55, 1.2);
    tarp.rotation.y = 0.4;
    for (var c = 0; c < 2; c++) {
      H.cyl(0.22, 0.24, 0.9, 10, H.toon(0x9aa8a2), parent, -12.4, 0.45, 9.6 + c * 0.55);
      H.cyl(0.1, 0.1, 0.14, 8, M.iron, parent, -12.4, 0.95, 9.6 + c * 0.55);
      var cap = H.sphere(0.23, H.toon(0x85948f), parent, -12.4, 0.9, 9.6 + c * 0.55, 10, 6);
      cap.scale.y = 0.25;
    }
    for (var r = 0; r < 4; r++) {
      var coil = new THREE.Mesh(new THREE.TorusGeometry(0.42 - r * 0.05, 0.04, 5, 16), M.rope);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(-9.4, 0.045 + r * 0.005, 11.6);
      parent.add(coil);
    }
    H.cyl(0.18, 0.18, 0.32, 10, H.toon(0x5f7d7e), parent, 9.8, 0.16, 15.8);
    H.cyl(0.185, 0.185, 0.03, 10, M.rust, parent, 9.8, 0.33, 15.8);
    var brush = H.cyl(0.025, 0.025, 0.5, 5, M.wood, parent, 10.05, 0.36, 16.0);
    brush.rotation.z = 1.1;
    var broom = new THREE.Group(); broom.position.set(-12.15, 0, 7.7); broom.rotation.z = 0.12; parent.add(broom);
    H.cyl(0.03, 0.03, 2.0, 5, M.wood, broom, 0, 1.0, 0);
    H.box(0.3, 0.45, 0.1, H.toon(0xc3ab74), broom, 0, 0.22, 0);
    var stool = H.group(parent, 13.6, 0, 15.0);
    H.box(0.45, 0.06, 0.45, H.toon(0xd8dfd4), stool, 0, 0.45, 0);
    [-0.17, 0.17].forEach(function (sx) {
      [-0.17, 0.17].forEach(function (sz) {
        H.cyl(0.025, 0.03, 0.45, 5, H.toon(0xaab8b2), stool, sx, 0.225, sz);
      });
    });
    for (var fr = 0; fr < 3; fr++) {
      var rod = H.cyl(0.012, 0.03, 4.2, 4, H.toon(0x4b5654), parent, 14.0 + fr * 0.12, 0.16, 15.9);
      rod.rotation.z = 1.5; rod.rotation.y = 0.15 * fr;
    }
  }

  // -----------------------------------------------------------------
  // windsock + flags
  // -----------------------------------------------------------------
  function makeWindsock(parent, x, y, z) {
    var g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    H.cyl(0.035, 0.05, 2.2, 6, M.steel, g, 0, 1.1, 0);
    var sock = new THREE.Group();
    sock.position.set(0, 2.1, 0);
    g.add(sock);
    var segs = [];
    for (var i = 0; i < 3; i++) {
      var r1 = 0.17 - i * 0.045, r2 = 0.17 - (i + 1) * 0.045;
      var c = H.toon(i % 2 === 0 ? 0xe4652f : 0xefe9d8);
      var seg = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, 0.45, 8, 1, true), c);
      seg.rotation.x = Math.PI / 2;
      seg.position.set(0, 0, -0.3 - i * 0.45);
      seg.material.side = THREE.DoubleSide;
      seg.castShadow = true;
      sock.add(seg);
      segs.push(seg);
    }
    var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 4, 12), M.steel);
    hoop.position.z = -0.02; sock.add(hoop);
    sock.rotation.x = -0.2;
    W.windsock = { group: sock, segs: segs, base: sock.rotation.clone() };
    return g;
  }

  function flagMaterial(color, seed) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: H.SU.uTime, uWind: H.SU.uWind, uColor: { value: new THREE.Color(color) }, uSeed: { value: seed } },
      side: THREE.DoubleSide,
      vertexShader: [
        'uniform float uTime; uniform float uWind; uniform float uSeed;',
        'varying vec2 vUv;',
        'void main(){',
        '  vUv = uv;',
        '  vec3 p = position;',
        '  float w = uv.x;',
        '  p.z += sin(uWind*4.0 + uv.x*4.5 - uTime*4.0 + uSeed)*0.16*w;',
        '  p.y += sin(uWind*3.0 + uv.x*3.0 - uTime*3.2 + uSeed)*0.06*w;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec3 c = uColor;',
        '  c *= 0.9 + 0.12*vUv.y;',
        '  gl_FragColor = vec4(c, 0.95);',
        '}'
      ].join('\n'),
      transparent: true
    });
  }

  function makeFlag(parent, x, z, h, color, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; parent.add(g);
    H.cyl(0.045, 0.06, h, 6, M.steel, g, 0, h / 2, 0);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.75, 16, 8), flagMaterial(color, H.rnd() * 6));
    flag.position.set(0.65, h - 0.42, 0);
    g.add(flag);
    var pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22, 8, 3), flagMaterial(0x4f8fa0, H.rnd() * 6));
    pennant.position.set(0.3, h - 1.0, 0);
    g.add(pennant);
    return g;
  }

  function makeWallLifeRing(parent, x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0.6, z); g.rotation.y = ry; parent.add(g);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 6, 16), H.toon(0xe9e8da));
    ring.castShadow = true; g.add(ring);
    for (var i = 0; i < 4; i++) {
      var seg = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.102, 6, 3, 0.5), H.toon(0xe06a3d));
      seg.rotation.z = i * Math.PI / 2;
      g.add(seg);
    }
    H.box(0.06, 0.28, 0.05, M.rope, g, 0, 0.38, 0);
    return g;
  }

  // -----------------------------------------------------------------
  // kei truck full of crates
  // -----------------------------------------------------------------
  function makeKeiTruck(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    var bodyMat = H.toon(0xe6ebe0);
    var trimMat = H.toon(0x4d7c80);
    var glassMat = new THREE.MeshPhongMaterial({
      color: 0x6d9aa0, transparent: true, opacity: 0.55, shininess: 90, depthWrite: false
    });
    // wheels
    [[-1.1, 0.8], [1.12, 0.8], [-1.1, -0.8], [1.12, -0.8]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), M.rubber);
      w.rotation.x = Math.PI / 2;
      w.position.set(p[0], 0.34, p[1]);
      w.castShadow = true;
      g.add(w);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 10), M.steel);
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(w.position);
      g.add(hub);
    });
    H.box(3.25, 0.22, 1.4, M.iron, g, 0, 0.5, 0);
    // cab + lower body
    H.box(1.55, 1.3, 1.55, bodyMat, g, 0.82, 1.25, 0);
    H.outline(g.children[g.children.length - 1], 0.0022, 0x2c3f41);
    H.box(3.35, 0.5, 1.5, bodyMat, g, 0, 0.78, 0);
    H.box(3.36, 0.1, 1.51, trimMat, g, 0, 0.6, 0);
    // bed
    H.box(1.95, 0.12, 1.5, H.toon(0x8a9991), g, -0.72, 0.96, 0);
    H.box(0.08, 0.4, 1.5, bodyMat, g, -1.68, 1.12, 0);
    H.box(1.95, 0.4, 0.07, bodyMat, g, -0.72, 1.12, 0.75);
    H.box(1.95, 0.4, 0.07, bodyMat, g, -0.72, 1.12, -0.75);
    H.outline(g.children[g.children.length - 2], 0.002, 0x2c3f41);
    // windows
    var ws = H.plane(1.32, 0.7, glassMat, g, 1.6, 1.42, 0);
    ws.rotation.y = Math.PI / 2;
    ws.renderOrder = 24;
    H.box(0.05, 0.72, 1.36, M.iron, g, 1.59, 1.42, 0);
    [-1, 1].forEach(function (s) {
      var sw = H.plane(1.0, 0.55, glassMat, g, 0.82, 1.42, s * 0.781);
      if (s < 0) sw.rotation.y = Math.PI;
      sw.renderOrder = 24;
      H.box(1.02, 0.05, 0.04, M.iron, g, 0.82, 1.72, s * 0.79);
      H.box(1.02, 0.05, 0.04, M.iron, g, 0.82, 1.12, s * 0.79);
    });
    // grille, lights, bumper
    H.box(0.08, 0.35, 1.1, H.toon(0xc5cdc2), g, 1.63, 0.95, 0);
    H.box(0.12, 0.18, 1.4, M.steel, g, 1.66, 0.55, 0);
    H.sphere(0.1, H.emissive(0xfff3cf), g, 1.63, 1.02, 0.52, 8, 6);
    H.sphere(0.1, H.emissive(0xfff3cf), g, 1.63, 1.02, -0.52, 8, 6);
    H.box(0.05, 0.12, 0.2, H.emissive(0xd25a45), g, -1.73, 1.0, 0.55);
    H.box(0.05, 0.12, 0.2, H.emissive(0xd25a45), g, -1.73, 1.0, -0.55);
    // mirrors
    [-1, 1].forEach(function (s) {
      H.cyl(0.015, 0.015, 0.35, 4, M.iron, g, 1.42, 1.55, s * 0.86);
      H.box(0.06, 0.18, 0.12, M.iron, g, 1.46, 1.68, s * 0.9);
    });
    // crates in the back
    H.box(0.75, 0.44, 0.55, H.toon(0xffffff, { map: T.crateBlue }), g, -0.8, 1.24, 0.2);
    H.box(0.75, 0.44, 0.55, H.toon(0xffffff, { map: T.crateBlue }), g, -1.2, 1.24, -0.35);
    H.box(0.75, 0.44, 0.55, H.toon(0xffffff, { map: T.crate }), g, -1.1, 1.68, 0.1);
    // rust spots
    for (var r = 0; r < 4; r++) {
      H.sphere(H.rr(0.04, 0.09), M.rust, g, H.rr(-1.5, 1.4), H.rr(0.55, 0.9), H.rr(-0.76, 0.76), 5, 4);
    }
    // strap
    H.box(0.1, 0.02, 1.4, H.toon(0x7f6a4b), g, -0.4, 1.75, 0);
    return g;
  }

  // -----------------------------------------------------------------
  // fish auction table
  // -----------------------------------------------------------------
  function makeAuction(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    parent.add(g);
    // table
    H.box(3.2, 0.08, 1.1, H.toon(0xd7ded8), g, 0, 0.98, 0);
    H.box(3.2, 0.06, 1.1, M.steel, g, 0, 0.88, 0);
    [-1.4, 1.4].forEach(function (sx) {
      H.box(0.08, 0.9, 0.08, M.steel, g, sx, 0.45, -0.42);
      H.box(0.08, 0.9, 0.08, M.steel, g, sx, 0.45, 0.42);
    });
    // trays and fish
    for (var t = 0; t < 3; t++) {
      var tx = -1.05 + t * 1.0;
      H.box(0.85, 0.16, 0.65, H.toon(0x4a7f8c), g, tx, 1.1, 0.05);
      var inner = H.plane(0.76, 0.56, new THREE.MeshBasicMaterial({ color: 0x375b63 }), g, tx, 1.185, 0.05);
      inner.rotation.x = -Math.PI / 2;
      for (var f = 0; f < 3; f++) {
        var fish = H.sphere(0.095, H.toon(0xc4d8da), g, tx - 0.2 + f * 0.18, 1.22, -0.08 + (f % 2) * 0.2, 8, 5);
        fish.scale.set(2.1, 0.5, 0.65);
        fish.rotation.y = 0.6;
      }
      for (var ice = 0; ice < 3; ice++) {
        H.box(0.08, 0.05, 0.08, H.basic(0xdaf4f0), g, tx + H.rr(-0.3, 0.3), 1.22, H.rr(-0.2, 0.2)).rotation.y = H.rr(0, 3);
      }
    }
    // bench scale
    H.box(0.45, 0.08, 0.5, M.iron, g, 1.28, 1.08, 0);
    H.cyl(0.18, 0.18, 0.06, 12, H.toon(0xe3e8df), g, 1.28, 1.15, 0);
    H.box(0.32, 0.28, 0.18, H.toon(0xc2cbc2), g, 1.28, 1.25, 0.12);
    // clipboard
    H.box(0.3, 0.02, 0.22, M.woodDark, g, 0.7, 1.05, -0.32);
    // blackboard on an easel
    var easel = new THREE.Group();
    easel.position.set(-2.5, 0, -0.4);
    easel.rotation.y = 0.2;
    g.add(easel);
    H.box(0.08, 1.7, 0.08, M.woodDark, easel, -0.5, 0.85, 0);
    H.box(0.08, 1.7, 0.08, M.woodDark, easel, 0.5, 0.85, 0);
    H.box(1.1, 0.06, 0.3, M.woodDark, easel, 0, 0.03, 0.15);
    var bb = H.signPlane(1.0, 0.75, T.blackboard, easel, 0, 1.32, 0.04);
    var bb2 = H.box(1.1, 0.85, 0.05, M.woodDark, easel, 0, 1.32, 0);
    bb2.material = M.woodDark;
    // crate stack beside
    H.box(0.9, 0.52, 0.62, H.toon(0xffffff, { map: T.crate }), g, 1.75, 0.26, -0.4);
    H.box(0.9, 0.52, 0.62, H.toon(0xffffff, { map: T.crateBlue }), g, 1.75, 0.78, -0.4);
    return g;
  }

  // -----------------------------------------------------------------
  // blue barrels
  // -----------------------------------------------------------------
  function makeBarrels(parent, x, z) {
    var g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    var mat = H.toon(0x3e727f);
    var mat2 = H.toon(0x558a8e);
    function drum(dx, dz, ry, tilt) {
      var d = H.cyl(0.34, 0.36, 1.0, 14, mat, g, dx, 0.5, dz);
      if (tilt) { d.rotation.z = Math.PI / 2; d.position.y = 0.34; }
      d.rotation.y = ry || 0;
      H.cyl(0.36, 0.36, 0.05, 14, M.iron, g, dx, 0.25, dz);
      H.cyl(0.36, 0.36, 0.05, 14, M.iron, g, dx, 0.75, dz);
      H.cyl(0.12, 0.12, 0.04, 8, M.iron, g, dx, 1.01, dz);
      return d;
    }
    drum(0, 0, 0.2);
    drum(0.78, 0.12, 0.6);
    drum(0.36, 0.78, 1.0).scale.set(1, 0.9, 1);
    // rope coil on top / crate
    var coil = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 5, 14), M.rope);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0.78, 1.04, 0.12);
    g.add(coil);
    // fish crate
    H.box(0.82, 0.48, 0.58, H.toon(0xffffff, { map: T.crate }), g, -0.5, 0.24, 0.62).rotation.y = 0.4;
    return g;
  }

  // -----------------------------------------------------------------
  // bicycle
  // -----------------------------------------------------------------
  function makeBicycle(parent, x, z, ry) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.set(0, ry || 0, 0.08);
    parent.add(g);
    var frameMat = H.toon(0x3f6f78);
    var tireMat = H.toon(0x2b3030);
    [-0.62, 0.62].forEach(function (wx) {
      var tire = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 6, 20), tireMat);
      tire.position.set(wx, 0.38, 0);
      g.add(tire);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.014, 4, 18), M.steel);
      rim.position.set(wx, 0.38, 0);
      g.add(rim);
      for (var s = 0; s < 6; s++) {
        var sp = H.cyl(0.006, 0.006, 0.6, 3, M.steel, g, wx, 0.38, 0);
        sp.rotation.z = s * Math.PI / 6;
      }
    });
    H.tube([
      new THREE.Vector3(-0.62, 0.38, 0), new THREE.Vector3(-0.2, 0.78, 0),
      new THREE.Vector3(0.25, 0.78, 0), new THREE.Vector3(0.62, 0.38, 0)
    ], 0.022, frameMat, g, 16);
    H.tube([
      new THREE.Vector3(-0.62, 0.38, 0), new THREE.Vector3(-0.35, 0.78, 0),
      new THREE.Vector3(0.25, 0.78, 0)
    ], 0.02, frameMat, g, 12);
    H.cyl(0.02, 0.02, 0.7, 4, frameMat, g, 0.25, 0.78, 0).rotation.z = 0.15;
    H.tube([
      new THREE.Vector3(0.62, 0.38, 0), new THREE.Vector3(0.46, 0.85, 0),
      new THREE.Vector3(0.55, 1.05, 0), new THREE.Vector3(0.75, 1.05, 0)
    ], 0.02, M.steel, g, 10);
    H.box(0.26, 0.06, 0.12, H.toon(0x4b3b30), g, 0.28, 1.06, 0);
    H.cyl(0.024, 0.024, 0.36, 4, M.steel, g, 0.6, 1.18, 0).rotation.z = 1.57;
    H.box(0.32, 0.26, 0.3, H.toon(0x8c7a5b), g, 0.48, 0.88, 0);
    // basket with a fish
    var fish = H.sphere(0.08, H.toon(0xc0d6d8), g, 0.5, 0.95, 0, 7, 5);
    fish.scale.set(2.2, 0.6, 0.7);
    // kickstand
    H.cyl(0.012, 0.012, 0.4, 4, M.iron, g, -0.1, 0.2, 0.12).rotation.z = 0.3;
    return g;
  }

  // -----------------------------------------------------------------
  H.buildProps = function (scene) {
    ready();
    var g = new THREE.Group(); scene.add(g);
    W.props = g;

    makeBollard(g, 3.6, 7.45, 0.2, { drop: [3.8, 1.6] });
    makeBollard(g, 11.2, 7.5, -0.1, { drop: [11.4, 2.2] });
    makeBollard(g, 16.5, 7.55, 0.1, { drop: [16.6, 2.6] });
    makeBollard(g, -8.35, 1.0, 0.4, { drop: [-6.2, -1.8] });
    makeBollard(g, -8.35, -4.6, 0.1, { drop: [-6.0, -7.2] });
    makeBollard(g, -8.35, -9.6, -0.2, { drop: [-6.4, -12.9] });

    makeTyres(g);
    makeLadder(g, -7.44, 0.4, Math.PI / 2);
    makeLadder(g, 9.2, 8.44, 0);
    makeWallRings(g);
    makeWallLifeRing(g, 14.0, 8.44, 0);

    makeLampPost(g, -9.3, 11.3, 5.6);
    makeLampPost(g, 9.6, 11.5, 5.2);
    makeLampPost(g, -14.0, -2.0, 5.4);
    var wirePts = [
      new THREE.Vector3(-9.3, 5.42, 11.3),
      new THREE.Vector3(-4.5, 5.1, 11.7),
      new THREE.Vector3(0.8, 5.25, 11.6),
      new THREE.Vector3(5.0, 5.0, 11.6),
      new THREE.Vector3(9.6, 5.02, 11.5)
    ];
    H.tube(wirePts, 0.013, M.iron, g, 40);
    var wire2 = [
      new THREE.Vector3(-9.3, 5.42, 11.3),
      new THREE.Vector3(-11.8, 4.9, 7.4),
      new THREE.Vector3(-14.0, 5.2, -2.0)
    ];
    H.tube(wire2, 0.012, M.iron, g, 20);
    var wire3 = [
      new THREE.Vector3(-14.0, 5.2, -2.0),
      new THREE.Vector3(-18.0, 4.6, -3.2),
      new THREE.Vector3(-20.6, 4.0, -6.5)
    ];
    H.tube(wire3, 0.012, M.iron, g, 20);

    makeFishCrates(g);
    makeNetRack(g, -10.4, -7.6, -0.2, 0.94);
    makeNetRack(g, -16.4, 9.2, -0.35, 0.82);
    makeFloatLine(g, -10.5, 11.0, 0.12);
    makeFloatLine(g, 15.1, 10.2, Math.PI * 0.5);

    makeWinch(g, -9.4, -5.6, 0.15);
    makeDavit(g, -8.8, -12.0, 0.3);

    makeVendingMachine(g, -11.25, 6.5, Math.PI / 2);

    makeSign(g, -7.1, 11.3, 0.18);

    makeSlipway(g, -5.7, 8.4);
    makeDinghy(g, -4.8, 0.46, 9.8, 0.5);
    // blocks under the overturned dinghy
    H.box(0.22, 0.44, 0.22, M.woodDark, g, -5.35, 0.22, 8.7);
    H.box(0.22, 0.44, 0.22, M.woodDark, g, -4.2, 0.22, 10.9);

    makeInstrumentCases(g);
    makeUmbrella(g, 0.55, 9.15, -0.2);

    makeBucket(g, 5.6, 12.6);
    makeLongNet(g, -12.15, 12.0, 0.4);
    makeOutboard(g, -10.9, 9.3, -0.6);
    makeClutter(g);

    makeWindsock(g, -12.3, 4.35, 6.0);
    makeFlag(g, 16.9, 10.3, 4.6, 0xdfe9e1, 0.3);
    makeFlag(g, -10.2, 14.8, 3.9, 0xdca15a, -0.4);
    makeFlag(g, -8.6, 9.6, 2.7, 0xe6d3a4, 0.2);

    makeBuoy(g, -2.6, 2.1, 7, 0xe8663c, [-8.35, 1.0]);
    makeBuoy(g, 12.4, 0.2, 12, 0xe9e4d0, [11.2, 7.5]);
    makeBuoy(g, 17.0, 4.2, 3, 0xe8663c, null);
    makeBuoy(g, -3.8, -7.5, 9, 0xf0ede0, [-8.35, -9.6]);
    makeBuoy(g, 4.5, -10.2, 21, 0xe8663c, null);

    // foreground working life
    makeKeiTruck(g, -18.2, 16.6, 0.36);
    makeAuction(g, -2.4, 16.8, 0.06);
    makeBarrels(g, 18.6, 17.5);
    makeBicycle(g, 9.15, 17.3, 1.15);
    // rope and hose coils by the auction table
    for (var rc = 0; rc < 3; rc++) {
      var coil = new THREE.Mesh(new THREE.TorusGeometry(0.4 - rc * 0.05, 0.04, 5, 16), M.rope);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(-4.9, 0.05 + rc * 0.006, 18.0);
      g.add(coil);
    }
    var hose = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 5, 18), H.toon(0x4b6e68));
    hose.rotation.x = Math.PI / 2;
    hose.position.set(0.9, 0.045, 18.2);
    g.add(hose);
  };

})(window.H);
