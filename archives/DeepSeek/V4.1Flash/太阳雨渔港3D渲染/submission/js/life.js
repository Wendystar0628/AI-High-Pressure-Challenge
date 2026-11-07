/* =========================================================
   汐見漁港 — weather, wildlife, movement, export timeline
   ========================================================= */
(function (H) {
  'use strict';
  var T = H.TEX, M, W, S = {};

  // -----------------------------------------------------------------
  // timeline helpers
  // -----------------------------------------------------------------
  function keyAt(keys, t, period) {
    var x = ((t % period) + period) % period;
    for (var i = 0; i < keys.length - 1; i++) {
      if (x <= keys[i + 1][0]) {
        var k = (x - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
        k = k * k * (3 - 2 * k);
        return H.lerp(keys[i][1], keys[i + 1][1], k);
      }
    }
    return keys[keys.length - 1][1];
  }
  var RAIN_KEYS = [
    [0, 0.55], [8, 0.42], [18, 0.55], [24, 0.33], [30, 0.50], [36, 0.70],
    [43, 0.44], [47, 0.24], [55, 0.19], [59, 0.31], [64, 0.44], [72, 0.62],
    [82, 0.40], [90, 0.82], [100, 0.55]
  ];
  function rainAt(t) { return H.clamp(keyAt(RAIN_KEYS, t, 100), 0.05, 1); }

  function bump(x, a, b, soft) {
    return H.smoothstep(a, a + soft, x) * (1 - H.smoothstep(b - soft, b, x));
  }
  function cloudAt(t) {
    var x = ((t % 100) + 100) % 100;
    var c = 0.34 * bump(x, 44.5, 50.0, 1.6);
    var c2 = 0.96 * bump(x, 52.4, 56.6, 1.0);
    return Math.max(c, c2);
  }

  function gustEnv(local, dur) {
    return H.smoothstep(0, 1.1, local) * (1 - H.smoothstep(dur - 2.2, dur, local));
  }
  function windAt(t, delay) {
    delay = delay || 0;
    var tt = t - delay;
    var period = 37.0;
    var x = ((tt % period) + period) % period;
    var local = x - 28; if (local < 0) local += period;
    var g = local < 9 ? gustEnv(local, 9) : 0;
    return 0.16 + 0.85 * g + 0.10 * Math.sin(tt * 0.53 + 1.3);
  }
  function localWind(x, z, t) {
    var delay = (z + 21) * 0.022 + (x + 21) * 0.006;
    return windAt(t, delay);
  }

  // -----------------------------------------------------------------
  // rain
  // -----------------------------------------------------------------
  function buildRain(scene) {
    var N = 3000;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 2 * 3);
    var seed = new Float32Array(N * 2);
    var end = new Float32Array(N * 2);
    var rr = new Float32Array(N * 2);
    for (var i = 0; i < N; i++) {
      var x = H.rr(-28, 28);
      var z = H.rr(-30, 30);
      var y = H.rr(0, 34);
      var s = H.rnd();
      var randv = H.rnd();
      for (var k = 0; k < 2; k++) {
        var o = (i * 2 + k) * 3;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        seed[i * 2 + k] = s;
        end[i * 2 + k] = k;
        rr[i * 2 + k] = randv;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rr, 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uTime: H.SU.uTime, uRain: H.SU.uRain, uWind: H.SU.uWind },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: [
        'uniform float uTime, uRain, uWind;',
        'attribute float aSeed; attribute float aEnd; attribute float aRand;',
        'varying float vA; varying float vWarm;',
        'void main(){',
        '  float ht = 34.0;',
        '  float speed = 13.0 + aRand*11.0;',
        '  float yy = mod(position.y - uTime*speed + aSeed*137.0, ht);',
        '  vec3 p = vec3(position.x + (ht-yy)*uWind*0.075, yy - 2.0, position.z + (ht-yy)*uWind*0.018);',
        '  p.y += aEnd * (0.42 + aRand*0.55);',
        '  p.x += aEnd * uWind * 0.16;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  float dist = -mv.z;',
        '  gl_Position = projectionMatrix * mv;',
        '  float fade = smoothstep(0.0, 2.4, p.y+1.0) * (1.0 - smoothstep(60.0, 95.0, dist));',
        '  fade *= smoothstep(0.6, 4.0, dist);',
        '  vA = fade * (0.35 + 0.65*(1.0-aEnd)) * (0.4 + 0.6*uRain);',
        '  vWarm = aRand;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying float vA; varying float vWarm;',
        'void main(){',
        '  vec3 col = mix(vec3(0.92,0.96,0.90), vec3(1.0,0.86,0.58), 0.35 + vWarm*0.65);',
        '  gl_FragColor = vec4(col, vA * 0.6);',
        '}'
      ].join('\n')
    });
    var rain = new THREE.LineSegments(geo, mat);
    rain.frustumCulled = false;
    rain.renderOrder = 31;
    rain.layers.set(1);
    scene.add(rain);
    S.rain = rain;
  }

  // -----------------------------------------------------------------
  // foam along quay / rocks
  // -----------------------------------------------------------------
  function buildFoam(scene) {
    var mat0 = new THREE.MeshBasicMaterial({
      map: T.foam, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide
    });
    var anchors = [];
    for (var z = -18; z < 8; z += 2.1) anchors.push({ x: -7.34, z: z, s: 1.1 + H.rnd() * 1.3 });
    for (var x = -2; x < 20; x += 2.3) anchors.push({ x: x, z: 8.34, s: 0.9 + H.rnd() * 1.2 });
    for (var i = 0; i < W.tetrapods.length; i++) {
      var tp = W.tetrapods[i];
      anchors.push({ x: tp.position.x + H.rr(-0.4, 0.4), z: tp.position.z + 0.8, s: 1.4 + H.rnd() * 1.1 });
    }
    for (var bx = -6; bx < 8; bx += 2.4) anchors.push({ x: bx, z: -14.6, s: 1.2 + H.rnd() * 0.8 });
    anchors.push({ x: -5.7, z: 6.4, s: 1.6 });
    anchors.push({ x: 12, z: -14.2, s: 2.0 });
    W.foam = [];
    var geo = new THREE.PlaneGeometry(1, 1);
    anchors.forEach(function (a) {
      var m = new THREE.Mesh(geo, mat0.clone());
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = H.rnd() * 6.28;
      m.position.set(a.x, H.L.waterY + 0.035 + H.rnd() * 0.01, a.z);
      m.scale.setScalar(a.s);
      m.renderOrder = 13;
      m.layers.set(1);
      m.userData = { base: a.s, phase: H.rnd() * 6.28, speed: 0.6 + H.rnd() * 0.7, x: a.x, z: a.z };
      scene.add(m);
      W.foam.push(m);
    });
  }

  // -----------------------------------------------------------------
  // rainbow
  // -----------------------------------------------------------------
  function buildRainbow(scene) {
    var g = new THREE.Group();
    g.position.set(2, -13, -55);
    g.scale.set(1.45, 1.0, 1.0);
    scene.add(g);
    S.rainbow = g;
    var cols = [0xf28d7a, 0xf1c27a, 0xf3eaa0, 0xa9dfae, 0x8fd0dd, 0x9fb6e6, 0xc7a8dd];
    S.rainbowMats = [];
    for (var i = 0; i < 7; i++) {
      var mat = new THREE.MeshBasicMaterial({
        color: cols[i], transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false
      });
      var ring = new THREE.Mesh(new THREE.TorusGeometry(27 - i * 0.62, 0.26, 3, 80, Math.PI), mat);
      ring.renderOrder = 2;
      g.add(ring);
      S.rainbowMats.push(mat);
    }
    g.visible = false;
  }

  // -----------------------------------------------------------------
  // gulls
  // -----------------------------------------------------------------
  function wingGeometry(side) {
    var g = new THREE.BufferGeometry();
    var v = new Float32Array([
      0.18, 0, 0,
      -0.18, 0, 0,
      -0.32, 0.03, side * 0.92,
      0.34, 0.03, side * 0.92
    ]);
    var idx = side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  var GULL_WING_MAT = null;
  function makeGull() {
    var g = new THREE.Group();
    var white = H.toon(0xf6f7ef);
    var body = H.sphere(0.17, white, g, 0, 0.1, 0, 10, 8);
    body.scale.set(1.1, 0.85, 0.72);
    H.outline(body, 0.004, 0x4a5a5c);
    var back = H.sphere(0.145, H.toon(0xc7d3cf), g, 0.0, 0.17, 0, 8, 6);
    back.scale.set(1.15, 0.5, 0.68);
    var head = H.sphere(0.095, white, g, 0.22, 0.21, 0, 8, 6);
    H.sphere(0.022, H.basic(0x1d2a2c), g, 0.29, 0.235, 0.062, 5, 4);
    H.sphere(0.022, H.basic(0x1d2a2c), g, 0.29, 0.235, -0.062, 5, 4);
    var beak = H.mesh(new THREE.ConeGeometry(0.035, 0.14, 5), H.toon(0xe0a33b), g, 0.33, 0.19, 0);
    beak.rotation.z = -Math.PI / 2;
    var tail = H.mesh(new THREE.ConeGeometry(0.09, 0.26, 3), white, g, -0.27, 0.06, 0);
    tail.rotation.z = Math.PI / 2;
    tail.scale.z = 1.3;
    if (!GULL_WING_MAT) GULL_WING_MAT = new THREE.MeshToonMaterial({ color: 0xf0f3eb, side: THREE.DoubleSide });
    var wingL = new THREE.Group();
    wingL.position.set(0.02, 0.14, 0.07);
    g.add(wingL);
    var wl = new THREE.Mesh(wingGeometry(1), GULL_WING_MAT);
    wingL.add(wl);
    var tipL = H.mesh(new THREE.BoxGeometry(0.24, 0.012, 0.16), H.toon(0x44585c), wingL, 0.01, 0.02, 0.86);
    tipL.rotation.y = -0.12;
    var wingR = new THREE.Group();
    wingR.position.set(0.02, 0.14, -0.07);
    g.add(wingR);
    var wr = new THREE.Mesh(wingGeometry(-1), GULL_WING_MAT);
    wingR.add(wr);
    var tipR = H.mesh(new THREE.BoxGeometry(0.24, 0.012, 0.16), H.toon(0x44585c), wingR, 0.01, 0.02, -0.86);
    tipR.rotation.y = 0.12;
    // folded wings for perching
    var foldL = H.sphere(0.18, H.toon(0xe9efea), g, -0.03, 0.17, 0.12, 8, 6);
    foldL.scale.set(1.7, 0.45, 0.5);
    foldL.rotation.y = 0.16;
    var foldR = H.sphere(0.18, H.toon(0xe3eae5), g, -0.03, 0.17, -0.12, 8, 6);
    foldR.scale.set(1.7, 0.45, 0.5);
    foldR.rotation.y = -0.16;
    var foldTipL = H.sphere(0.1, H.toon(0xa3b4b1), g, -0.25, 0.18, 0.1, 6, 4);
    foldTipL.scale.set(1.6, 0.35, 0.4);
    var foldTipR = H.sphere(0.1, H.toon(0xa3b4b1), g, -0.25, 0.18, -0.1, 6, 4);
    foldTipR.scale.set(1.6, 0.35, 0.4);
    var legs = new THREE.Group();
    g.add(legs);
    [-0.07, 0.07].forEach(function (lz) {
      H.cyl(0.012, 0.012, 0.16, 4, H.toon(0xd9b36c), legs, 0.04, -0.08, lz);
      H.box(0.08, 0.012, 0.035, H.toon(0xd9b36c), legs, 0.08, -0.16, lz);
    });
    g.userData = { wingL: wingL, wingR: wingR, legs: legs, head: head, body: body, tail: tail, foldL: foldL, foldR: foldR, foldTipL: foldTipL, foldTipR: foldTipR };
    g.scale.setScalar(0.92);
    return g;
  }

  function posePerched(gull) {
    var u = gull.userData;
    u.legs.visible = true;
    u.wingL.visible = false;
    u.wingR.visible = false;
    u.foldL.visible = true;
    u.foldR.visible = true;
    u.foldTipL.visible = true;
    u.foldTipR.visible = true;
  }

  function setFlap(gull, t, phase, amp) {
    var u = gull.userData;
    var f = Math.sin(t * 11 + phase) * amp;
    u.wingL.rotation.set(-f, 0, 0);
    u.wingR.rotation.set(f, 0, 0);
    u.wingL.visible = true;
    u.wingR.visible = true;
    u.foldL.visible = false;
    u.foldR.visible = false;
    u.foldTipL.visible = false;
    u.foldTipR.visible = false;
    u.legs.visible = false;
  }

  function buildGulls(scene) {
    W.gulls = [];
    var specs = [
      { cx: 0, cz: -4, rx: 15, rz: 11, h: 13, sp: 0.22, ph: 0.4, sc: 1.0 },
      { cx: 3, cz: -2, rx: 11, rz: 9, h: 10.5, sp: -0.27, ph: 2.2, sc: 0.9 },
      { cx: -3, cz: -6, rx: 18, rz: 8, h: 16, sp: 0.18, ph: 3.9, sc: 0.85 },
      { cx: 17, cz: -10, rx: 3.2, rz: 5, h: 9, sp: 0.33, ph: 5.1, sc: 0.8 },
      { cx: 8, cz: -8, rx: 13, rz: 7, h: 9, sp: -0.21, ph: 1.2, sc: 0.95 }
    ];
    specs.forEach(function (sp, i) {
      var gull = makeGull();
      gull.scale.setScalar(0.92 * sp.sc);
      scene.add(gull);
      W.gulls.push({ model: gull, spec: sp, phase: sp.ph, x: 0, y: sp.h, z: 0 });
    });

    var perched = makeGull();
    perched.position.set(11.2, 0.97, 7.55);
    perched.rotation.y = -2.0;
    scene.add(perched);
    posePerched(perched);
    S.perchA = {
      model: perched, x: 11.2, y: 0.97, z: 7.55, mode: 'perch', start: -1, resetAt: -1,
      baseRot: -2.0, sched: true, triggerCycle: -1
    };

    var perched2 = makeGull();
    perched2.position.set(7.35, 1.37, 4.95);
    perched2.rotation.y = 2.5;
    scene.add(perched2);
    posePerched(perched2);
    S.perchB = {
      model: perched2, x: 7.35, y: 1.37, z: 4.95, mode: 'perch', start: -1, resetAt: -1,
      baseRot: 2.5, sched: false, triggerCycle: -1
    };

    var floating = makeGull();
    floating.position.set(18.6, H.L.waterY + 0.1, -5.4);
    floating.rotation.y = 1.9;
    scene.add(floating);
    posePerched(floating);
    floating.userData.legs.visible = false;
    S.floatingGull = floating;
  }

  function updatePerched(p, t, camera) {
    var g = p.model;
    var cycle = Math.floor(t / 100);
    var x = ((t % 100) + 100) % 100;
    if (p.sched) {
      // scheduled, purely time-based take-off for deterministic export
      if (x >= 14.0 && x < 31.0) {
        var e = x - 14.0;
        if (e < 4.2) {
          g.visible = true;
          var k = H.easeOut(Math.min(e / 1.7, 1));
          var up = H.easeInOut(Math.min(e / 2.4, 1));
          g.position.set(p.x + k * 4.2, p.y + up * 3.2 + e * 0.35, p.z - k * 4.0 - e * 0.8);
          g.rotation.y = -0.5 - e * 0.15;
          setFlap(g, t, p.x * 2.1, 0.95);
          g.userData.body.rotation.z = 0.25;
        } else {
          g.visible = false;
        }
      } else {
        g.visible = true;
        posePerched(g);
        g.rotation.set(0, p.baseRot + Math.sin(t * 0.8 + p.x) * 0.06, 0);
        g.position.set(p.x, p.y, p.z);
        g.userData.body.rotation.z = 0;
      }
      return;
    }
    if (p.mode === 'perch') {
      var dist = camera.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z));
      var trigger = false;
      if (dist < 4.6 && t > 4 && p.triggerCycle !== cycle) trigger = true;
      if (trigger) {
        p.mode = 'fly'; p.start = t; p.triggerCycle = cycle;
        g.rotation.y = p.baseRot;
        g.userData.body.rotation.z = 0;
      } else {
        g.visible = true;
        posePerched(g);
        g.rotation.y = p.baseRot + Math.sin(t * 0.8 + p.x) * 0.06;
        g.position.y = p.y + Math.sin(t * 1.2) * 0.003;
        return;
      }
    }
    var e2 = t - p.start;
    if (e2 < 4.2) {
      g.visible = true;
      var k2 = H.easeOut(Math.min(e2 / 1.7, 1));
      var up2 = H.easeInOut(Math.min(e2 / 2.4, 1));
      g.position.set(p.x + k2 * 4.2, p.y + up2 * 3.2 + e2 * 0.35, p.z - k2 * 4.0 - e2 * 0.8);
      g.rotation.y = -0.5 - e2 * 0.15;
      setFlap(g, t, p.x * 2.1, 0.95);
      g.userData.body.rotation.z = 0.25;
    } else {
      g.visible = false;
      if (p.resetAt < 0) p.resetAt = t + 15.0;
      if (t > p.resetAt) {
        p.mode = 'perch';
        p.resetAt = -1;
        g.visible = true;
        g.position.set(p.x, p.y, p.z);
        g.rotation.set(0, p.baseRot, 0);
        g.userData.body.rotation.z = 0;
        posePerched(g);
      }
    }
  }

  // -----------------------------------------------------------------
  // cat
  // -----------------------------------------------------------------
  function makeCat(scene) {
    var g = new THREE.Group();
    var ginger = H.toon(0xd19a5f);
    var cream = H.toon(0xefdcbc);
    var dark = H.toon(0xa9753f);
    var body = H.sphere(0.2, ginger, g, 0, 0.32, 0, 12, 8);
    body.scale.set(1.65, 0.9, 0.85);
    var belly = H.sphere(0.16, cream, g, 0.02, 0.27, 0, 10, 6);
    belly.scale.set(1.5, 0.6, 0.7);
    var headG = new THREE.Group();
    headG.position.set(0.3, 0.39, 0);
    g.add(headG);
    var head = H.sphere(0.145, ginger, headG, 0, 0, 0, 10, 8);
    var muzzle = H.sphere(0.09, cream, headG, 0.08, -0.04, 0, 8, 6);
    muzzle.scale.set(0.9, 0.6, 1.0);
    var earGeo = new THREE.ConeGeometry(0.06, 0.12, 4);
    var earL = H.mesh(earGeo, ginger, headG, -0.02, 0.13, 0.08);
    earL.rotation.z = -0.2;
    var earR = H.mesh(earGeo, ginger, headG, -0.02, 0.13, -0.08);
    earR.rotation.z = -0.2;
    H.sphere(0.022, H.basic(0x243234), headG, 0.115, 0.02, 0.07, 6, 5);
    H.sphere(0.022, H.basic(0x243234), headG, 0.115, 0.02, -0.07, 6, 5);
    H.sphere(0.007, H.basic(0xffffff), headG, 0.127, 0.03, 0.082, 3, 3);
    H.sphere(0.007, H.basic(0xffffff), headG, 0.127, 0.03, -0.082, 3, 3);
    var nose = H.sphere(0.022, H.basic(0xc98077), headG, 0.155, -0.018, 0, 5, 4);
    nose.scale.set(0.8, 0.6, 0.9);
    H.box(0.012, 0.006, 0.04, H.basic(0x5d4030), headG, 0.158, -0.055, 0);
    [-1, 1].forEach(function (s) {
      for (var wi = 0; wi < 2; wi++) {
        var wh = H.cyl(0.0035, 0.0035, 0.15, 3, H.toon(0xf4ead2), headG, 0.14, -0.03 + wi * 0.012, s * (0.12 + wi * 0.02));
        wh.rotation.x = Math.PI / 2 + s * 0.05;
        wh.rotation.z = s * 0.08;
      }
    });
    // tabby stripes
    for (var s2 = 0; s2 < 3; s2++) {
      var stripe = H.box(0.035, 0.016, 0.21, dark, g, -0.16 + s2 * 0.16, 0.475, 0);
      stripe.rotation.z = s2 * 0.02;
    }
    var legs = [];
    [[0.2, 0.1], [0.2, -0.1], [-0.22, 0.1], [-0.22, -0.1]].forEach(function (p) {
      var lg = new THREE.Group();
      lg.position.set(p[0], 0.22, p[1]);
      g.add(lg);
      H.cyl(0.028, 0.032, 0.24, 5, ginger, lg, 0, -0.1, 0);
      H.sphere(0.04, cream, lg, 0.02, -0.22, 0, 6, 4);
      legs.push(lg);
    });
    var tail = new THREE.Group();
    tail.position.set(-0.3, 0.35, 0);
    g.add(tail);
    for (var i = 0; i < 4; i++) {
      var seg = H.cyl(0.035 - i * 0.004, 0.04 - i * 0.004, 0.18, 6, i % 2 ? dark : ginger, tail, 0, 0, 0);
      seg.position.set(-i * 0.05, -i * 0.06, 0);
      seg.rotation.z = 0.9 + i * 0.25;
    }
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({
      map: T.shadow, transparent: true, opacity: 0.4, depthWrite: false
    }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    g.add(shadow);
    g.traverse(function (o) { if (o.isMesh && o.material && o.material.type === 'MeshToonMaterial') H.outline(o, 0.0019, 0x5b4027); });
    scene.add(g);
    W.cat = g;
    S.cat = {
      group: g, legs: legs, headG: headG, tail: tail,
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4.5, 0.02, 9.7),
        new THREE.Vector3(-3.6, 0.02, 10.4),
        new THREE.Vector3(-1.6, 0.02, 10.8),
        new THREE.Vector3(0.6, 0.02, 10.4),
        new THREE.Vector3(2.4, 0.02, 10.2),
        new THREE.Vector3(4.1, 0.02, 12.2),
        new THREE.Vector3(3.9, 0.02, 13.1),
        new THREE.Vector3(1.6, 0.02, 12.3),
        new THREE.Vector3(-1.2, 0.02, 11.6),
        new THREE.Vector3(-3.4, 0.02, 10.9),
        new THREE.Vector3(-4.5, 0.02, 9.7)
      ], true),
      curve2: new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4.5, 0.02, 9.7),
        new THREE.Vector3(-5.4, 0.02, 11.6),
        new THREE.Vector3(-2.8, 0.02, 12.8),
        new THREE.Vector3(0.2, 0.02, 13.6),
        new THREE.Vector3(3.2, 0.02, 14.6),
        new THREE.Vector3(5.6, 0.02, 13.8),
        new THREE.Vector3(4.4, 0.02, 12.2),
        new THREE.Vector3(1.8, 0.02, 12.4),
        new THREE.Vector3(-1.4, 0.02, 10.9),
        new THREE.Vector3(-3.8, 0.02, 10.2),
        new THREE.Vector3(-4.5, 0.02, 9.7)
      ], true),
      sit: new THREE.Vector3(-3.9, 0.02, 10.35),
      hide: new THREE.Vector3(-4.5, 0.02, 9.7)
    };
  }

  function updateCat(t, camera) {
    var c = S.cat, g = c.group;
    var x = ((t % 100) + 100) % 100;
    if (x < 19.5 || x > 38.5) {
      g.visible = true;
      g.position.set(c.hide.x + 0.55, c.hide.y - 0.02 + Math.sin(t * 0.8) * 0.004, c.hide.z + 0.45);
      g.rotation.y = 1.15;
      c.legs.forEach(function (l) { l.scale.y = 0.85; l.rotation.z = 0; });
      c.headG.rotation.set(0.1, -0.15, 0.3);
      c.tail.rotation.z = 0.85 + Math.sin(t * 1.1) * 0.06;
      return;
    }
    g.visible = true;
    c.legs.forEach(function (l) { l.scale.y = 1; });
    var walking = false;
    var pos = new THREE.Vector3();
    var yaw = 0;
    if (x < 23.0) {
      var k = H.easeInOut((x - 19.5) / 3.5);
      pos.lerpVectors(c.hide, c.sit, k);
      yaw = -0.65;
      walking = true;
    } else if (x < 28.2) {
      pos.copy(c.sit);
      yaw = -0.72;
      var d = new THREE.Vector3().subVectors(camera.position, c.sit);
      var lookYaw = Math.atan2(-d.z, d.x) - yaw;
      lookYaw = H.clamp(lookYaw, -0.8, 0.8);
      c.headG.rotation.y = lookYaw;
      c.headG.rotation.z = 0.48;
      c.legs.forEach(function (l) { l.rotation.z = 0; });
      c.tail.rotation.z = 0.3 + Math.sin(t * 1.6) * 0.2;
    } else if (x < 38.5) {
      var u = (x - 28.2) / 10.3;
      var route = (Math.floor(t / 100) % 2 === 0) ? c.curve : c.curve2;
      pos.copy(route.getPointAt(H.clamp(u, 0, 1)));
      var tang = route.getTangentAt(H.clamp(u, 0.001, 0.999));
      yaw = Math.atan2(-tang.z, tang.x);
      walking = true;
      c.headG.rotation.y = Math.sin(t * 0.7) * 0.06;
      c.headG.rotation.z = 0;
    } else {
      g.visible = false;
      return;
    }
    g.position.copy(pos);
    g.position.y += walking ? Math.abs(Math.sin(t * 9.5)) * 0.025 : 0.005;
    g.rotation.y = yaw;
    c.legs.forEach(function (l, i) {
      l.rotation.z = walking ? Math.sin(t * 9.5 + (i % 2 ? Math.PI : 0)) * 0.5 : 0;
    });
    c.tail.rotation.z = 0.25 + Math.sin(t * 1.9) * 0.18;
    if (camera.position.distanceTo(g.position) < 3.4) {
      var cd = new THREE.Vector3().subVectors(camera.position, g.position);
      var ly2 = H.clamp(Math.atan2(-cd.z, cd.x) - g.rotation.y, -0.9, 0.9);
      c.headG.rotation.y = ly2;
      c.headG.rotation.z = 0.4;
    }
  }

  // -----------------------------------------------------------------
  // wake + departing boat
  // -----------------------------------------------------------------
  function buildWake(scene) {
    var mat = new THREE.MeshBasicMaterial({
      map: T.foam, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide
    });
    W.wake = [];
    var geo = new THREE.PlaneGeometry(1, 1);
    for (var i = 0; i < 54; i++) {
      var m = new THREE.Mesh(geo, mat.clone());
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 14;
      m.layers.set(1);
      m.visible = false;
      scene.add(m);
      W.wake.push(m);
    }
    var pts = [
      new THREE.Vector3(11.6, 0, -4.8),
      new THREE.Vector3(13.6, 0, -5.4),
      new THREE.Vector3(14.7, 0, -7.8),
      new THREE.Vector3(15.4, 0, -10.4),
      new THREE.Vector3(16.2, 0, -13.0),
      new THREE.Vector3(17.6, 0, -15.4),
      new THREE.Vector3(15.5, 0, -17.6),
      new THREE.Vector3(11.0, 0, -18.3),
      new THREE.Vector3(7.0, 0, -18.0),
      new THREE.Vector3(4.6, 0, -16.4),
      new THREE.Vector3(7.6, 0, -14.7),
      new THREE.Vector3(11.8, 0, -14.2),
      new THREE.Vector3(14.4, 0, -12.4),
      new THREE.Vector3(14.2, 0, -9.4),
      new THREE.Vector3(12.8, 0, -6.8),
      new THREE.Vector3(9.6, 0, -4.9),
      new THREE.Vector3(11.6, 0, -4.8)
    ];
    S.boatCurve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  }

  function updateDepartingBoat(t, camera, wind) {
    var rec = W.boatE;
    if (!rec) return;
    var start = 44.0, end = 90.0;
    if (!S.berth) {
      S.berth = { x: rec.group.position.x, y: rec.group.position.y, z: rec.group.position.z, ry: rec.group.rotation.y };
    }
    var traveling = t >= start && t <= end;
    var p = H.clamp((t - start) / (end - start), 0, 1);
    var u = H.easeInOut(p);
    if (traveling) {
      var point = S.boatCurve.getPointAt(H.clamp(u, 0.0001, 0.9999));
      var tan = S.boatCurve.getTangentAt(H.clamp(u, 0.003, 0.997));
      var heading = Math.atan2(-tan.z, tan.x);
      rec.group.position.x = point.x;
      rec.group.position.z = point.z;
      rec.group.position.y = S.berth.y + Math.sin(t * 1.7) * 0.035;
      rec.group.rotation.y = heading;
      rec.group.rotation.z = Math.sin(t * 1.3) * 0.015;
      rec.group.rotation.x = Math.cos(t * 1.1) * 0.012;
      rec.traveling = true;
    } else {
      rec.group.position.set(S.berth.x, S.berth.y + Math.sin(t * 1.1 + 1.2) * 0.04, S.berth.z);
      rec.group.rotation.y = S.berth.ry;
      rec.group.rotation.z = Math.sin(t * 0.9 + 1.2) * 0.009;
      rec.group.rotation.x = Math.cos(t * 0.8 + 0.5) * 0.008;
      rec.traveling = false;
    }
    var idx = 0;
    for (var k = 0; k < 18; k++) {
      var d = (k + 1) * 0.0065;
      var ok = traveling && u > d;
      for (var side = -1; side <= 1; side += 2) {
        var m = W.wake[idx++];
        if (!ok) { m.visible = false; continue; }
        var uu = H.clamp(u - d, 0, 0.9999);
        var pp = S.boatCurve.getPointAt(uu);
        var tt = S.boatCurve.getTangentAt(uu);
        var nx = -tt.z, nz = tt.x;
        var spread = 0.35 + k * 0.09;
        m.position.set(pp.x + nx * spread * side, H.L.waterY + 0.03, pp.z + nz * spread * side);
        m.rotation.z = Math.atan2(nx, nz) + Math.sin(k * 2.3 + side * 1.7) * 0.08;
        m.scale.set(0.8 + k * 0.12, 0.4 + k * 0.07, 1);
        m.material.opacity = 0.62 * (1 - k / 19) * (0.6 + 0.4 * wind);
        m.visible = true;
      }
      var center = W.wake[idx++];
      if (ok) {
        var pc = S.boatCurve.getPointAt(H.clamp(u - d, 0, 0.9999));
        center.position.set(pc.x, H.L.waterY + 0.028, pc.z);
        center.scale.set(0.7 + k * 0.14, 0.45, 1);
        center.material.opacity = 0.3 * (1 - k / 19);
        center.visible = true;
      } else center.visible = false;
    }
  }

  // -----------------------------------------------------------------
  // water drips
  // -----------------------------------------------------------------
  function buildDrips(scene) {
    var anchors = [];
    if (W.umbrella) {
      for (var i = 0; i < 7; i++) {
        var a = i / 7 * Math.PI * 2;
        anchors.push([0.55 + Math.cos(a) * 0.88, 2.85, 9.15 + Math.sin(a) * 0.88, 0.02]);
      }
    }
    anchors.push([11.0, 1.05, 5.55, -0.85]);
    anchors.push([5.6, 1.05, 5.55, -0.85]);
    anchors.push([9.6, 4.9, 11.5, 0.02]);
    anchors.push([-9.3, 4.9, 11.3, 0.02]);
    anchors.push([12.6, 3.0, 18.9, 0.02]);
    var n = anchors.length;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3);
    var info = new Float32Array(n * 3);
    for (var j = 0; j < n; j++) {
      pos[j * 3] = anchors[j][0]; pos[j * 3 + 1] = anchors[j][1]; pos[j * 3 + 2] = anchors[j][2];
      info[j * 3] = anchors[j][3];
      info[j * 3 + 1] = H.rnd();
      info[j * 3 + 2] = 0.8 + H.rnd() * 1.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uTime: H.SU.uTime },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: [
        'uniform float uTime;',
        'attribute vec3 aInfo;',
        'varying float vA;',
        'void main(){',
        '  float cycle = mod(uTime*aInfo.z + aInfo.y*8.0, 3.0);',
        '  float fall = clamp(cycle/1.3, 0.0, 1.0);',
        '  vec3 p = position;',
        '  p.y = mix(position.y, aInfo.x, fall);',
        '  p.x += sin(uTime*2.0 + aInfo.y*9.0)*0.02*fall;',
        '  vec4 mv = modelViewMatrix * vec4(p,1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = 120.0 / max(1.0,-mv.z);',
        '  vA = (1.0 - smoothstep(0.9, 1.0, fall)) * step(cycle, 1.55);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying float vA;',
        'void main(){',
        '  vec2 d = gl_PointCoord - 0.5;',
        '  float r = length(d);',
        '  if (r > 0.5) discard;',
        '  float a = smoothstep(0.5, 0.12, r) * vA * 0.7;',
        '  gl_FragColor = vec4(0.88,0.98,0.96, a);',
        '}'
      ].join('\n')
    });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 32;
    pts.layers.set(1);
    scene.add(pts);
    S.drips = pts;
  }

  function buildHarborShafts(scene) {
    if (!H.lightShaft) return;
    H.lightShaft(scene, {
      x: 1, y: 29, z: 2, width: 16, height: 42,
      rx: 0.35, rz: -0.55, opacity: 0.11, color: 0xffecc6
    });
    H.lightShaft(scene, {
      x: -4, y: 26, z: 5, width: 20, height: 34,
      rx: 0.26, rz: -0.5, opacity: 0.085, color: 0xffe7b8
    });
    H.lightShaft(scene, {
      x: 12, y: 21, z: -4, width: 13, height: 26,
      rx: 0.1, rz: -0.35, opacity: 0.06, color: 0xfff0cd
    });
    // drifting sea mist over the distant water
    S.mist = [];
    for (var i = 0; i < 3; i++) {
      var mat = new THREE.MeshBasicMaterial({
        map: T.foam, color: 0xe9f7f4, transparent: true, opacity: 0.10,
        depthWrite: false, side: THREE.DoubleSide, fog: true
      });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(11 + i * 3, 4.2 + i * 0.8, 1);
      m.rotation.z = H.rr(0, 3.14);
      m.position.set(3 + i * 4.5, -0.1 + i * 0.04, -18.4 + i * 0.7);
      m.renderOrder = 4;
      m.layers.set(1);
      m.userData = { bx: m.position.x, ph: i * 2.1, rz: m.rotation.z };
      scene.add(m);
      S.mist.push(m);
    }
    // soft cloud shadow drifting across the harbour
    var csMat = new THREE.MeshBasicMaterial({
      map: T.cloudShadow, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0
    });
    var cs = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), csMat);
    cs.rotation.x = -Math.PI / 2;
    cs.position.set(0, 0.045, -5);
    cs.renderOrder = 5;
    cs.layers.set(1);
    cs.visible = false;
    scene.add(cs);
    S.cloudShadow = cs;
  }

  // larger, clearly visible fish near the cutaway face
  function buildFishSchool(scene) {
    var bodyMat = H.toon(0xa9cdd2, { transparent: true, opacity: 0.95 });
    var backMat = H.toon(0x4d8089, { transparent: true, opacity: 0.95 });
    var bodyGeo = new THREE.SphereGeometry(0.16, 10, 7);
    bodyGeo.scale(2.6, 0.85, 0.6);
    var tailGeo = new THREE.ConeGeometry(0.13, 0.3, 4);
    tailGeo.rotateZ(Math.PI / 2);
    for (var i = 0; i < 16; i++) {
      var g = new THREE.Group();
      var b = new THREE.Mesh(bodyGeo, i % 3 === 0 ? backMat : bodyMat);
      b.layers.set(1); g.add(b);
      var tl = new THREE.Mesh(tailGeo, bodyMat);
      tl.position.x = -0.38; tl.rotation.z = 0.2;
      tl.layers.set(1); g.add(tl);
      g.scale.setScalar(H.rr(1.1, 1.6));
      g.layers.set(1);
      var center = new THREE.Vector3(H.rr(16.5, 20.2), H.rr(-4.4, -2.2), H.rr(-13, 4.5));
      g.position.copy(center);
      g.userData = {
        center: center, radius: H.rr(0.8, 2.2), speed: H.rr(0.18, 0.42) * (H.rnd() < 0.5 ? -1 : 1),
        phase: H.rr(0, 6.28), bob: H.rr(0.05, 0.2), school: 2
      };
      scene.add(g);
      W.fish.push(g);
    }
  }
  // -----------------------------------------------------------------
  H.buildLife = function (scene) {
    M = H.M; W = H.W;
    T.caustic.wrapS = T.caustic.wrapT = THREE.RepeatWrapping;
    buildRain(scene);
    buildFoam(scene);
    buildRainbow(scene);
    buildGulls(scene);
    makeCat(scene);
    buildWake(scene);
    buildDrips(scene);
    buildFishSchool(scene);
    buildHarborShafts(scene);
    if (W.boatE) {
      S.berth = {
        x: W.boatE.group.position.x, y: W.boatE.group.position.y,
        z: W.boatE.group.position.z, ry: W.boatE.group.rotation.y
      };
    }
    if (W.distantBoats) {
      W.distantBoats.forEach(function (b, i) { b.userData.baseX = b.position.x; b.userData.ph = i * 2.3; });
    }
  };

  H.boatPose = function (t) {
    if (!W.boatE || !S.berth) return { x: 11.6, y: -0.32, z: -4.8, traveling: false };
    var start = 44.0, end = 90.0;
    if (t < start || t > end) return { x: S.berth.x, y: S.berth.y, z: S.berth.z, traveling: false };
    var p = H.clamp((t - start) / (end - start), 0, 1);
    var u = H.easeInOut(p);
    var pt = S.boatCurve.getPointAt(H.clamp(u, 0.0001, 0.9999));
    return { x: pt.x, y: S.berth.y, z: pt.z, traveling: true, u: u };
  };

  H.resetLife = function () {
    [S.perchA, S.perchB].forEach(function (p) {
      if (!p) return;
      p.mode = 'perch'; p.start = -1; p.resetAt = -1; p.triggerCycle = -1;
      p.model.visible = true;
      p.model.position.set(p.x, p.y, p.z);
      p.model.rotation.set(0, p.baseRot, 0);
      p.model.userData.body.rotation.z = 0;
      posePerched(p.model);
    });
    if (W.boatE && S.berth) {
      W.boatE.group.position.set(S.berth.x, S.berth.y, S.berth.z);
      W.boatE.group.rotation.set(0, S.berth.ry, 0);
      W.boatE.traveling = false;
    }
    if (W.wake) W.wake.forEach(function (m) { m.visible = false; });
    if (W.cat) W.cat.visible = false;
  };

  // -----------------------------------------------------------------
  var tmpV = new THREE.Vector3();
  H.updateLife = function (t) {
    var camera = H.camera;
    var win = windAt(t);
    H.SU.uTime.value = t;
    H.SU.uWind.value = win;

    var rain = rainAt(t);
    var cloud = cloudAt(t);
    H.SU.uRain.value = rain;
    H.SU.uCloud.value = cloud;

    if (H.sun) H.sun.intensity = 0.82 * (1.0 - 0.34 * cloud);
    if (H.hemi) H.hemi.intensity = 0.20 * (1.0 - 0.12 * cloud);
    if (H.fill) H.fill.intensity = 0.10 * (1.0 + 0.2 * rain);

    var lamp = H.smoothstep(0.55, 0.85, cloud);
    if (W.lighthouseLight) W.lighthouseLight.intensity = lamp * (1.8 + 0.4 * Math.sin(t * 5.0));
    if (W.lighthouseHalo) {
      W.lighthouseHalo.material.opacity = lamp * (0.55 + 0.15 * Math.sin(t * 4.0));
      W.lighthouseHalo.scale.setScalar(4.0 + 1.2 * Math.sin(t * 1.7) + lamp * 3.0);
    }
    if (W.lampGlow) W.lampGlow.material.opacity = lamp * 0.5;

    if (S.rainbow) {
      var rv = H.smoothstep(0.30, 0.18, rain) * (1.0 - cloud) * 0.95;
      S.rainbow.visible = rv > 0.02;
      if (S.rainbow.visible) {
        for (var rb = 0; rb < S.rainbowMats.length; rb++) {
          S.rainbowMats[rb].opacity = rv * (0.14 - Math.abs(rb - 3) * 0.011);
        }
      }
    }

    T.caustic.offset.x = (t * 0.013) % 1;
    T.caustic.offset.y = (Math.sin(t * 0.11) * 0.15 + t * 0.006) % 1;
    if (W.warehouseCaustic) W.warehouseCaustic.material.opacity = (0.13 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.8))) * (1.0 - cloud * 0.4);
    if (W.cabinCaustics) {
      for (var cc = 0; cc < W.cabinCaustics.length; cc++) {
        W.cabinCaustics[cc].mesh.material.opacity = (0.15 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.6 + W.cabinCaustics[cc].phase))) * (1.0 - cloud * 0.35);
      }
    }

    if (W.boatList) {
      for (var b = 0; b < W.boatList.length; b++) {
        var rec = W.boatList[b];
        if (rec === W.boatE) continue;
        var wnear = 0;
        if (W.boatE && W.boatE.traveling) {
          var wd = rec.group.position.distanceTo(W.boatE.group.position);
          if (wd < 11) wnear = 1 - wd / 11;
        }
        rec.group.position.y = rec.baseY + Math.sin(t * 1.05 + rec.phase) * 0.04 + Math.sin(t * 2.2 + rec.phase) * 0.06 * wnear;
        rec.group.rotation.z = Math.sin(t * 0.92 + rec.phase) * 0.010 + Math.sin(t * 1.8 + rec.phase) * 0.028 * wnear;
        rec.group.rotation.x = Math.cos(t * 0.77 + rec.rollPhase) * 0.008;
      }
    }
    updateDepartingBoat(t, camera, win);

    if (W.buoys) {
      var boatPos = W.boatE ? W.boatE.group.position : null;
      for (var u = 0; u < W.buoys.length; u++) {
        var bu = W.buoys[u];
        var boost = 0;
        if (boatPos && W.boatE.traveling) {
          var dxb = bu.group.position.x - boatPos.x, dzb = bu.group.position.z - boatPos.z;
          var dd = Math.sqrt(dxb * dxb + dzb * dzb);
          if (dd < 8) boost = (1 - dd / 8) * 0.10;
        }
        bu.group.position.y = bu.baseY + Math.sin(t * 1.3 + bu.phase) * 0.05 + Math.sin(t * 2.7 + bu.phase) * boost;
        bu.group.rotation.z = Math.sin(t * 0.9 + bu.phase) * 0.05;
        bu.group.rotation.x = Math.cos(t * 0.7 + bu.phase) * 0.04;
      }
    }

    if (W.nets) {
      for (var n = 0; n < W.nets.length; n++) {
        var nn = W.nets[n];
        var w = localWind(nn.group.position.x, nn.group.position.z, t);
        nn.group.rotation.z = Math.sin(t * 1.6 + nn.phase) * 0.012 * w;
        nn.group.rotation.x = Math.cos(t * 1.2 + nn.phase) * 0.008 * w;
      }
    }
    if (W.floatLine) {
      var fw = localWind(W.floatLine.group.position.x, W.floatLine.group.position.z, t);
      W.floatLine.group.rotation.z = Math.sin(t * 1.5 + W.floatLine.phase) * 0.02 * fw;
    }
    if (W.treeSway) {
      for (var ts = 0; ts < W.treeSway.length; ts++) {
        var tr = W.treeSway[ts];
        var tw = localWind(tr.group.position.x, tr.group.position.z, t);
        tr.group.rotation.z = Math.sin(t * 0.9 + tr.phase) * 0.014 * tw;
        tr.group.rotation.x = Math.cos(t * 0.75 + tr.phase * 1.4) * 0.010 * tw;
      }
    }
    if (W.windsock) {
      var ws = W.windsock;
      var www = localWind(-12, 6, t);
      ws.group.rotation.y = Math.PI;
      ws.group.rotation.x = -0.15 - www * 0.25;
      for (var si = 0; si < ws.segs.length; si++) {
        ws.segs[si].rotation.x = Math.sin(t * 3.2 + si * 0.9) * 0.12 * www;
        ws.segs[si].rotation.y = Math.sin(t * 2.1 + si * 0.6) * 0.08 * www;
      }
    }

    if (W.foam) {
      for (var fm = 0; fm < W.foam.length; fm++) {
        var f = W.foam[fm];
        var uw = localWind(f.userData.x, f.userData.z, t);
        var pulse = 0.5 + 0.5 * Math.sin(t * f.userData.speed + f.userData.phase);
        var wboost = 0;
        if (W.boatE && W.boatE.traveling) {
          var fdx = f.userData.x - W.boatE.group.position.x;
          var fdz = f.userData.z - W.boatE.group.position.z;
          var fdist = Math.sqrt(fdx * fdx + fdz * fdz);
          if (fdist < 10) wboost = (1 - fdist / 10) * (0.45 + 0.55 * Math.sin(t * 2.6 + f.userData.phase));
        }
        f.scale.setScalar(f.userData.base * (0.75 + 0.4 * pulse + 0.3 * Math.max(0, wboost)));
        f.material.opacity = (0.14 + 0.22 * pulse) * (0.55 + 0.55 * uw) + Math.max(0, wboost) * 0.22;
        f.rotation.z = t * 0.002 + f.userData.phase;
      }
    }

    if (W.gulls) {
      for (var gi = 0; gi < W.gulls.length; gi++) {
        var gg = W.gulls[gi], sp = gg.spec;
        var ang = sp.ph + t * sp.sp;
        var gx = sp.cx + Math.cos(ang) * sp.rx;
        var gz = sp.cz + Math.sin(ang) * sp.rz;
        var gy = sp.h + Math.sin(t * 0.5 + sp.ph) * 1.4;
        if (gi === 3) gy = 1.2 + Math.abs(Math.sin(t * 0.37 + 1.0)) * 3.2;
        gg.model.position.set(gx, gy, gz);
        var tx = -Math.sin(ang) * sp.rx * Math.sign(sp.sp);
        var tz = Math.cos(ang) * sp.rz * Math.sign(sp.sp);
        gg.model.rotation.y = Math.atan2(-tz, tx);
        gg.model.rotation.z = -0.16 * Math.sign(sp.sp);
        var wingAmp = 0.32 + 0.4 * H.sat(0.5 + 0.5 * Math.sin(t * 0.33 + sp.ph));
        setFlap(gg.model, t, sp.ph, wingAmp);
      }
    }
    updatePerched(S.perchA, t, camera);
    updatePerched(S.perchB, t, camera);
    if (S.floatingGull) {
      S.floatingGull.position.y = H.L.waterY + 0.1 + Math.sin(t * 1.1) * 0.035;
      S.floatingGull.rotation.z = Math.sin(t * 0.9) * 0.03;
    }

    updateCat(t, camera);

    if (W.fish) {
      for (var fi = 0; fi < W.fish.length; fi++) {
        var fish = W.fish[fi];
        var fd = fish.userData;
        var distCam = camera.position.distanceTo(fish.position);
        fd.scatter = 1 - H.smoothstep(4.0, 8.0, distCam);
        var sc = fd.scatter;
        var rad = fd.radius * (1 + sc * 0.9);
        var a2 = fd.phase + t * fd.speed * (1 + sc * 0.8);
        var px = fd.center.x + Math.cos(a2) * rad;
        var pz = fd.center.z + Math.sin(a2) * rad * 0.65;
        var py = fd.center.y + Math.sin(t * 0.9 + fd.phase) * fd.bob + sc * 0.5;
        fish.position.set(px, py, pz);
        var vx = -Math.sin(a2) * rad;
        var vz = Math.cos(a2) * rad * 0.65 * Math.sign(fd.speed);
        fish.rotation.y = Math.atan2(-vz, vx);
        fish.rotation.z = Math.sin(t * 6 + fd.phase) * 0.06;
        fish.children[1].rotation.y = Math.sin(t * 12 + fd.phase) * 0.4;
      }
    }

    if (S.cloudShadow) {
      var csh = cloud;
      S.cloudShadow.visible = csh > 0.02;
      if (S.cloudShadow.visible) {
        S.cloudShadow.material.opacity = csh * 0.28;
        S.cloudShadow.position.x = -6 + Math.sin(t * 0.035) * 9;
        S.cloudShadow.position.z = -7 + Math.cos(t * 0.028) * 6;
      }
    }

    if (S.mist) {
      for (var mi = 0; mi < S.mist.length; mi++) {
        var mm = S.mist[mi];
        mm.position.x = mm.userData.bx + Math.sin(t * 0.035 + mm.userData.ph) * 3.2;
        mm.material.opacity = 0.07 + 0.045 * (0.5 + 0.5 * Math.sin(t * 0.07 + mm.userData.ph));
        mm.rotation.z = mm.userData.rz + t * 0.0006;
      }
    }

    if (W.distantBoats) {
      for (var di = 0; di < W.distantBoats.length; di++) {
        var db = W.distantBoats[di];
        db.position.x = db.userData.baseX + Math.sin(t * 0.03 + db.userData.ph) * 8;
        db.position.y = -0.35 + Math.sin(t * 0.9 + di) * 0.05;
      }
    }
  };

})(window.H);
