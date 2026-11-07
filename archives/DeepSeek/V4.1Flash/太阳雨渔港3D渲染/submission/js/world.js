/* =========================================================
   姹愯婕佹腐 鈥?   汐見漁港 — base, quay, water, breakwater, hillside
   ========================================================= */
(function (H) {
  'use strict';
  var L = H.L = {
    base: 21,
    waterY: -0.9,
    seabedY: -6.15,
    bottom: -7.0,
    wMinX: -7.5, wMaxX: 21,
    wMinZ: -21, wMaxZ: 8.5
  };
  var T = H.TEX;
  var W = H.W = {};

  // shared shader uniforms (single objects, updated by main loop)
  H.SU = {
    uTime: { value: 0 },
    uRain: { value: 0.55 },
    uCloud: { value: 0 },
    uWind: { value: 0.3 },
    tReflect: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uSunDir: { value: new THREE.Vector3(0.52, 0.76, 0.42).normalize() }
  };

  var M = H.M = {};

  function buildMaterials() {
    var t = T.concreteTop.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5.5, 1.7); t.needsUpdate = true;
    M.quayTopFront = H.toon(0xffffff, { map: t });
    var t2 = T.concreteTop.clone(); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(1.8, 3.8); t2.needsUpdate = true;
    M.quayTopLeft = H.toon(0xffffff, { map: t2 });
    var tw = T.concreteWall.clone(); tw.wrapS = tw.wrapT = THREE.RepeatWrapping; tw.repeat.set(7, 1); tw.needsUpdate = true;
    M.wall = H.toon(0xe8eeea, { map: tw });
    var tw2 = T.concreteWall.clone(); tw2.wrapS = tw2.wrapT = THREE.RepeatWrapping; tw2.repeat.set(5, 1); tw2.needsUpdate = true;
    M.wallShort = H.toon(0xe8eeea, { map: tw2 });
    var tc = T.cutConcrete.clone(); tc.wrapS = tc.wrapT = THREE.RepeatWrapping; tc.repeat.set(5, 1.2); tc.needsUpdate = true;
    M.cut = H.toon(0xe2e9e3, { map: tc });
    M.concrete = H.toon(0xc7cfca);
    M.concreteLight = H.toon(0xe0e6e0);
    M.concreteDark = H.toon(0x9faeaa);
    M.white = H.toon(0xf4f8f3);
    M.cream = H.toon(0xefe8d4);
    M.tealDark = H.toon(0x17454f);
    M.teal = H.toon(0x2c7a80);
    M.iron = H.toon(0x262c2e);
    M.ironLight = H.toon(0x3c4547);
    M.rust = H.toon(0x9a5a3c);
    M.rustLight = H.toon(0xb9794f);
    M.brass = H.toon(0xb69a6d);
    M.wood = H.toon(0xffffff, { map: T.wood });
    M.woodDark = H.toon(0x8a6646);
    M.rubber = H.toon(0x232b2c);
    M.orange = H.toon(0xe8763d);
    M.yellow = H.toon(0xf0c64c);
    M.red = H.toon(0xc7503f);
    M.green = H.toon(0x4d8b58);
    M.rope = H.toon(0xa06e45);
    M.ropeWet = H.toon(0x6f4a30);
    M.steel = H.toon(0xb9c6c2);
    M.glass = H.glass(0xd7f1ed, 0.16);
    M.warmGlow = H.emissive(0xffd692);
    M.coolGlow = H.emissive(0x9fe8dd);
  }

  // ------------------------------------------------------------------
  // plinth + studio floor
  // ------------------------------------------------------------------
  function buildPlinth(scene) {
    var root = new THREE.Group(); scene.add(root); root.layers.set(2);
    var plinthMat = H.toon(0xffffff, { map: T.plinth });
    var p = H.box(45.8, 1.05, 45.8, plinthMat, root, 0, -7.58, 0);
    p.receiveShadow = true; p.castShadow = true;
    H.outline(p, 0.0011, 0x3a3a36);
    // brass trim line
    H.box(46.0, 0.055, 46.0, M.brass, root, 0, -7.04, 0);
    // inset lower tier
    H.box(45.2, 0.35, 45.2, H.toon(0x6d6357), root, 0, -8.22, 0);
    // brass plaque
    var pt = H.textTexture([
      { text: '太陽雨の小漁港', size: 62, color: '#40372a', y: 74 },
      { text: 'S H I O M I   H A R B O U R', size: 22, color: '#5d5040', y: 124 }
    ], { w: 640, h: 160, bg: '#d8c08b', border: '#8e7749', borderWidth: 6 });
    var plaque = H.signPlane(6.6, 1.65, pt, root, 0, -7.5, 22.92);
    plaque.material.color.set(0xd9d2c2);
    plaque.material.opacity = 0.92;

    // studio floor
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshBasicMaterial({
      map: T.studio, depthWrite: true, fog: true
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -8.56;
    floor.layers.set(2);
    scene.add(floor);
    root.traverse(function (o) { o.layers.set(2); });
  }

  // ------------------------------------------------------------------
  // quay, walls, curbs, steps
  // ------------------------------------------------------------------
  function buildQuay(scene) {
    var g = new THREE.Group(); scene.add(g);
    W.quayGroup = g;

    // top surfaces
    H.floorPlane(42, 12.5, M.quayTopFront, g, 0, 0.002, 14.75);
    H.floorPlane(13.5, 29.5, M.quayTopLeft, g, -14.25, 0.004, -6.25);

    // fill volumes
    var fillMat = H.toon(0x9ca9a4);
    var fillA = H.box(41.8, 6.9, 12.4, fillMat, g, 0, -3.46, 14.75); fillA.layers.set(2);
    var fillB = H.box(13.4, 6.9, 29.4, fillMat, g, -14.25, -3.46, -6.25); fillB.layers.set(2);

    // outer walls
    var front = H.plane(42, 7, M.cut, g, 0, -3.5, 21.001);
    front.receiveShadow = true;
    var left = H.plane(42, 7, M.cut, g, -21.001, -3.5, 0);
    left.rotation.y = -Math.PI / 2;
    var right = H.plane(12.5, 7, M.cut, g, 21.001, -3.5, 14.75);
    right.rotation.y = Math.PI / 2;
    var back = H.plane(13.5, 7, M.cut, g, -14.25, -3.5, -21.001);
    back.rotation.y = Math.PI;

    // quay walls facing the water
    var wallA = H.plane(29.5, 7, M.wall, g, -7.499, -3.5, -6.25);
    wallA.rotation.y = Math.PI / 2;
    var wallB = H.plane(28.5, 7, M.wall, g, 6.75, -3.5, 8.499);
    wallB.rotation.y = Math.PI;

    // wet tide bands
    var tideMat = new THREE.MeshBasicMaterial({ map: T.tide, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 });
    var ta = H.plane(29.5, 1.9, tideMat, g, -7.49, -1.3, -6.25);
    ta.rotation.y = Math.PI / 2; ta.renderOrder = 1;
    var tb = H.plane(28.5, 1.9, tideMat, g, 6.75, -1.3, 8.49);
    tb.rotation.y = Math.PI; tb.renderOrder = 1;

    // barnacle / oyster bands at the waterline
    function barnacleMat(rep) {
      var mm = new THREE.MeshBasicMaterial({ map: T.barnacle.clone(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.92 });
      mm.map.wrapS = mm.map.wrapT = THREE.RepeatWrapping;
      mm.map.repeat.set(rep, 1);
      mm.map.needsUpdate = true;
      return mm;
    }
    var bl = H.plane(29.5, 0.8, barnacleMat(11), g, -7.47, -0.92, -6.25);
    bl.rotation.y = Math.PI / 2; bl.renderOrder = 3;
    var bf = H.plane(28.5, 0.8, barnacleMat(11), g, 6.75, -0.92, 8.47);
    bf.rotation.y = Math.PI; bf.renderOrder = 3;
    var bbw = H.plane(16.4, 0.7, barnacleMat(6), g, 0.3, 0.0, -10.82);
    bbw.renderOrder = 3;
    var bbw2 = H.plane(16.4, 0.7, barnacleMat(6), g, 0.3, -0.05, -14.03);
    bbw2.rotation.y = Math.PI; bbw2.renderOrder = 3;
    // a few proud shells along the breakwater and quay wall
    for (var bs = 0; bs < 18; bs++) {
      var sh = H.sphere(0.055, H.toon(bs % 3 ? 0xd9d5c5 : 0xb9c4ba), g, H.rr(-5.8, 7.4), H.rr(-0.3, 0.32), -10.81, 5, 4);
      sh.scale.set(1.3, 0.7, 0.5);
      if (bs < 8) {
        var sh2 = H.sphere(0.045, H.toon(0xd9d5c5), g, -7.46, H.rr(-1.15, -0.55), H.rr(0.5, 6.8), 5, 4);
        sh2.scale.set(0.5, 0.7, 1.3);
        var sh3 = H.sphere(0.05, H.toon(0xd9d5c5), g, H.rr(-5.8, 7.4), H.rr(-0.3, 0.3), -14.0, 5, 4);
        sh3.scale.set(1.2, 0.65, 0.45);
      }
    }
    // outer wall decoration: painted harbour name, tide gauge, drainpipe
    var nameTex = H.textTexture([
      { text: '汐見漁港', size: 100, color: 'rgba(226,238,230,1)', y: 96 },
      { text: 'S H I O M I   H A R B O U R', size: 30, color: 'rgba(214,230,222,1)', y: 160 }
    ], { w: 1024, h: 200 });
    var nameMat = new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, opacity: 0.55, depthWrite: false });
    var namePl = H.plane(9.6, 1.9, nameMat, g, -2.0, -2.9, 21.025);
    namePl.renderOrder = 2;
    var gaugeTex = H.tex(256, 1024, function (ctx, w, h) {
      ctx.fillStyle = 'rgba(225,231,221,0.92)'; ctx.fillRect(24, 0, w - 48, h);
      ctx.fillStyle = 'rgba(62,80,77,0.85)';
      ctx.font = 'bold 26px "Yu Gothic",sans-serif'; ctx.textAlign = 'center';
      for (var i = 0; i <= 12; i++) {
        var y = 30 + i * 78;
        ctx.fillRect(i % 2 ? 62 : 34, y, i % 2 ? 40 : 74, 7);
        ctx.fillRect(24, y, w - 48, 2);
        if (i % 2 === 0 && i > 0) ctx.fillText(String(i / 2), w / 2, y - 12);
      }
      ctx.strokeStyle = 'rgba(176,74,58,0.85)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(20, 190); ctx.lineTo(w - 20, 190); ctx.stroke();
      ctx.strokeStyle = 'rgba(110,90,60,0.3)'; ctx.lineWidth = 3;
      ctx.strokeRect(24, 0, w - 48, h);
      for (var k = 0; k < 80; k++) { ctx.fillStyle = 'rgba(90,80,60,' + Math.random() * 0.12 + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2 + Math.random() * 14); }
    }, { clamp: true });
    var gaugeMat = new THREE.MeshBasicMaterial({ map: gaugeTex, transparent: true, opacity: 0.95, depthWrite: false });
    var gauge = H.plane(0.72, 3.2, gaugeMat, g, 11.2, -2.55, 21.03);
    gauge.renderOrder = 2;
    var numTex = H.textTexture([
      { text: '7', size: 300, color: 'rgba(226,238,230,1)', y: 190 },
      { text: 'B E R T H', size: 34, color: 'rgba(214,230,222,1)', y: 330 }
    ], { w: 256, h: 384 });
    var numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, opacity: 0.46, depthWrite: false });
    var numPl = H.plane(1.75, 2.6, numMat, g, 8.7, -3.4, 21.026);
    numPl.renderOrder = 2;
    H.cyl(0.11, 0.13, 6.8, 8, H.toon(0x7e8d86), g, 16.0, -3.45, 21.16);
    for (var br = 0; br < 4; br++) {
      H.box(0.42, 0.1, 0.22, M.iron, g, 16.0, -0.9 - br * 1.6, 21.1);
      H.box(0.05, 0.35, 0.2, M.rust, g, 15.8, -0.5 - br * 1.6, 21.05);
    }
    H.cyl(0.13, 0.13, 0.18, 8, M.iron, g, 16.0, -0.12, 21.16);
    var rustWall = H.plane(0.9, 3.2, T.rust, g, 16.0, -4.6, 21.022);
    rustWall.material = new THREE.MeshBasicMaterial({ map: T.rust, transparent: true, opacity: 0.28, depthWrite: false });
    H.box(42.05, 0.1, 0.05, H.toon(0xdde5dc), g, 0, -0.06, 21.03);
    H.box(42.05, 0.08, 0.06, H.toon(0x8c9a90), g, 0, -6.9, 21.03);
    H.plane(42, 0.9, new THREE.MeshBasicMaterial({ color: 0x55706b, transparent: true, opacity: 0.16, depthWrite: false }), g, 0, -6.45, 21.025);

    // pale rim along top of the water cut
    H.box(0.42, 0.1, 29.6, M.concreteLight, g, 20.85, -0.04, -6.25);
    H.box(28.6, 0.1, 0.42, M.concreteLight, g, 6.8, -0.04, -20.85);

    // curbs with hazard stripes
    buildCurbX(g, -7.5, -3.65, 8.32);
    buildCurbX(g, 2.55, 5.95, 8.32);
    buildCurbX(g, 10.05, 20.7, 8.32);
    buildCurbZ(g, -7.38, -20.7, -14.6);
    buildCurbZ(g, -7.38, -10.7, 8.2);

    // concrete steps down into the water
    buildSteps(g);

    // boarding platform
    buildBoardingPlatform(g);

    // drain channel + grates along quay
    var drain = H.box(15, 0.045, 0.26, H.toon(0x6c7d78), g, 2.0, 0.03, 10.05);
    for (var i = 0; i < 5; i++) {
      var gr = H.plane(0.9, 0.34, new THREE.MeshBasicMaterial({ map: T.grate }), g, -4 + i * 4.2, 0.056, 10.05);
      gr.rotation.x = -Math.PI / 2;
    }
    // painted faded parking marks near warehouse
    var paint = new THREE.MeshBasicMaterial({ color: 0xe7e2c9, transparent: true, opacity: 0.36, depthWrite: false });
    for (var k = 0; k < 4; k++) {
      var ln = H.plane(0.12, 3.4, paint, g, -10.5 + k * 1.5, 0.02, 12.6);
      ln.rotation.x = -Math.PI / 2;
    }

    // wet sheen: broad low-opacity puddle-like planes handled by puddle shader
    makePuddle(g, 2.4, 0.03, 11.0, 2.35, 1.15, -0.2, 2.1);
    makePuddle(g, 6.6, 0.032, 12.3, 1.7, 0.85, 0.8, 4.2);
    makePuddle(g, -4.6, 0.032, 12.2, 2.1, 1.0, -0.5, 1.4);
    makePuddle(g, -7.0, 0.032, 0.9, 2.6, 1.2, 0.1, 3.3);
    makePuddle(g, 12.8, 0.032, 10.2, 1.5, 0.8, 0.4, 2.8);

    // scattered wet discolouration
    var discMat = new THREE.MeshBasicMaterial({ color: 0x7d9691, transparent: true, opacity: 0.13, depthWrite: false });
    for (var d = 0; d < 12; d++) {
      var dm = H.plane(H.rr(1.5, 4.5), H.rr(1.2, 3.4), discMat, g, H.rr(-6, 19), 0.012, H.rr(9.4, 20));
      dm.rotation.x = -Math.PI / 2;
      dm.rotation.z = H.rr(0, 3.14);
    }
  }

  function curbPart(len, topMat, sideMat) {
    var cg = new THREE.Group();
    H.box(len, 0.26, 0.42, M.concreteLight, cg, 0, 0.13, 0);
    var top = H.plane(len - 0.02, 0.36, topMat, cg, 0, 0.262, 0);
    top.rotation.x = -Math.PI / 2;
    var side = H.plane(len - 0.02, 0.2, sideMat, cg, 0, 0.145, 0.213);
    side.material.side = THREE.DoubleSide;
    return cg;
  }

  function buildCurbX(parent, x1, x2, z) {
    var len = x2 - x1;
    if (len < 0.2) return;
    var hz1 = T.hazard.clone(); hz1.wrapS = hz1.wrapT = THREE.RepeatWrapping; hz1.repeat.set(len / 2.6, 1); hz1.needsUpdate = true;
    var hz2 = hz1.clone(); hz2.needsUpdate = true;
    var cg = curbPart(len, new THREE.MeshBasicMaterial({ map: hz1, color: 0xd9d6c8 }),
      new THREE.MeshBasicMaterial({ map: hz2, color: 0xd0cdbf }));
    cg.position.set((x1 + x2) / 2, 0, z);
    parent.add(cg);
  }

  function buildCurbZ(parent, x, z1, z2) {
    var len = z2 - z1;
    if (len < 0.2) return;
    var hz1 = T.hazard.clone(); hz1.wrapS = hz1.wrapT = THREE.RepeatWrapping; hz1.repeat.set(len / 2.6, 1); hz1.needsUpdate = true;
    var hz2 = hz1.clone(); hz2.needsUpdate = true;
    var cg = curbPart(len, new THREE.MeshBasicMaterial({ map: hz1, color: 0xd9d6c8 }),
      new THREE.MeshBasicMaterial({ map: hz2, color: 0xd0cdbf }));
    cg.rotation.y = Math.PI / 2;
    cg.position.set(x, 0, (z1 + z2) / 2);
    parent.add(cg);
  }

  function buildSteps(parent) {
    var g = new THREE.Group(); parent.add(g);
    var x = -0.5;
    for (var i = 0; i < 4; i++) {
      var topY = -0.11 - i * 0.23;
      var zEdge = 8.5 - (i + 1) * 0.5;
      var depth = 8.5 - zEdge;
      var b = H.box(6.2, 1.4, depth, M.concrete, g, x, topY - 0.7, 8.5 - depth / 2);
      b.receiveShadow = true;
      // nosing highlight
      H.box(6.2, 0.04, 0.08, M.concreteLight, g, x, topY + 0.01, zEdge + 0.04);
    }
    // wet dark strip on the lowest step
    var wet = H.plane(6.0, 0.4, new THREE.MeshBasicMaterial({ color: 0x4f7d7a, transparent: true, opacity: 0.35, depthWrite: false }), g, x, -0.9, 6.9);
    wet.rotation.x = -Math.PI / 2;
    // small mooring ring on the top step side
    var ring = H.mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 14), M.rust, g, 2.4, -0.2, 8.2);
    ring.rotation.y = Math.PI / 2;
  }

  function buildBoardingPlatform(parent) {
    var g = new THREE.Group(); parent.add(g);
    g.position.set(7.8, 0, 7.5);
    H.box(3.8, 0.28, 1.7, M.wood, g, 0, -0.36, 0.0);
    // float barrels underneath
    for (var i = 0; i < 3; i++) {
      var b = H.cyl(0.28, 0.28, 0.85, 10, M.white, g, -1.4 + i * 1.4, -0.72, 0);
      b.rotation.z = Math.PI / 2;
    }
    // ramp from the quay
    var ramp = H.box(1.4, 0.1, 2.2, M.wood, g, 0, -0.12, -1.7);
    ramp.rotation.x = -0.17;
    // small posts
    for (var p = 0; p < 4; p++) {
      H.cyl(0.05, 0.05, 0.9, 6, M.steel, g, p < 2 ? -1.75 : 1.75, 0.05, p % 2 ? 0.7 : -0.7);
    }
    // rope rail
    H.tube([
      new THREE.Vector3(-1.75, 0.5, -0.7), new THREE.Vector3(-1.75, 0.35, 0.2), new THREE.Vector3(-1.75, 0.5, 0.7)
    ], 0.025, M.rope, g, 10);
    // tyre fenders
    var t1 = H.mesh(new THREE.TorusGeometry(0.24, 0.11, 6, 12), M.rubber, g, 1.82, -0.42, 0.5);
    t1.rotation.y = Math.PI / 2;
    var t2 = H.mesh(new THREE.TorusGeometry(0.24, 0.11, 6, 12), M.rubber, g, 1.82, -0.42, -0.5);
    t2.rotation.y = Math.PI / 2;
  }

  // ------------------------------------------------------------------
  // puddles (screen-space planar reflection, posterised)
  // ------------------------------------------------------------------
  function makePuddle(parent, x, y, z, rx, rz, rot, seed) {
    var geo = new THREE.CircleGeometry(1, 48);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: H.SU.uTime,
        uRain: H.SU.uRain,
        uCloud: H.SU.uCloud,
        tReflect: H.SU.tReflect,
        uResolution: H.SU.uResolution,
        uSeed: { value: seed },
        uScale: { value: new THREE.Vector2(rx, rz) },
        uCenter: { value: new THREE.Vector2(x, z) }
      },
      transparent: true,
      depthWrite: false,
      vertexShader: [
        'varying vec3 vW;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vW = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime, uRain, uCloud, uSeed;',
        'uniform vec2 uResolution, uCenter, uScale;',
        'uniform sampler2D tReflect;',
        'varying vec3 vW;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
        'void main(){',
        '  vec2 d = vW.xz - uCenter;',
        '  float ang = atan(d.y, d.x);',
        '  float wob = 0.80 + 0.10*sin(ang*3.0+uSeed) + 0.07*sin(ang*7.0-uSeed*2.0) + 0.05*sin(ang*13.0+uSeed*4.0);',
        '  vec2 q = d / uScale;',
        '  float r = length(q);',
        '  float edge = smoothstep(wob, wob-0.16, r);',
        '  if (edge <= 0.01) discard;',
        '  vec2 uv = gl_FragCoord.xy / uResolution;',
        '  vec2 ripple = vec2(sin(vW.x*3.1+uTime*1.7), sin(vW.z*2.7-uTime*1.3))*0.008;',
        '  vec2 ruv = uv + q*0.018 + ripple;',
        '  vec3 refl = texture2D(tReflect, ruv).rgb;',
        '  float lum = dot(refl, vec3(0.3,0.55,0.15));',
        '  vec3 pal = mix(vec3(0.24,0.35,0.37), vec3(0.82,0.93,0.90), smoothstep(0.2,0.8,lum));',
        '  refl = mix(refl, pal, 0.5);',
        '  refl = mix(refl, vec3(0.60,0.79,0.80), 0.24);',
        '  vec3 base = vec3(0.33,0.41,0.42);',
        '  vec3 col = mix(base, refl*1.02, 0.56);',
        '  col = mix(col, vec3(0.78,0.90,0.90), smoothstep(0.9,0.2,r)*0.16);',
        '  float rim = smoothstep(wob-0.16, wob-0.02, r);',
        '  col = mix(col, vec3(0.21,0.32,0.33), rim*0.4);',
        '  // rain rings',
        '  vec2 cell = floor(vW.xz*1.6);',
        '  vec2 f = fract(vW.xz*1.6)-0.5;',
        '  float h = hash(cell);',
        '  float ph = fract(uTime*0.55 + h);',
        '  float rr = length(f - (vec2(hash(cell+2.3), hash(cell+7.1))-0.5)*0.6);',
        '  float ring = smoothstep(0.035,0.0,abs(rr - ph*0.36)) * (1.0-ph);',
        '  col += vec3(0.8,0.95,0.92)*ring*uRain*0.28*(1.0-uCloud*0.6);',
        '  col *= 1.0 - uCloud*0.22;',
        '  float alpha = edge * (0.45 + 0.30*lum);',
        '  gl_FragColor = vec4(col, alpha);',
        '}'
      ].join('\n')
    });
    mat.layer = 1;
    var m = new THREE.Mesh(geo, mat);
    m.scale.set(rx, 1, rz);
    m.rotation.y = rot;
    m.position.set(x, y, z);
    m.renderOrder = 11;
    m.layers.set(1);
    parent.add(m);
    (W.puddles = W.puddles || []).push(m);
    return m;
  }
  W.makePuddle = makePuddle;

  // ------------------------------------------------------------------
  // water surface + underwater world
  // ------------------------------------------------------------------
  function buildWater(scene) {
    var g = new THREE.Group(); scene.add(g); W.waterGroup = g;
    var geo = new THREE.PlaneGeometry(L.wMaxX - L.wMinX, L.wMaxZ - L.wMinZ, 96, 96);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: H.SU.uTime,
        uRain: H.SU.uRain,
        uCloud: H.SU.uCloud,
        uWind: H.SU.uWind,
        tReflect: H.SU.tReflect,
        uResolution: H.SU.uResolution,
        uSunDir: H.SU.uSunDir
      },
      transparent: true,
      depthWrite: false,
      vertexShader: [
        'uniform float uTime;',
        'varying vec3 vW;',
        'float wav(vec2 p, float t){',
        '  return sin(p.x*0.52 + t*0.85)*0.05 + sin(p.y*0.73 - t*0.62)*0.04',
        '       + sin((p.x+p.y)*1.8 + t*1.65)*0.013 + sin(p.x*2.6 - p.y*1.4 + t*2.3)*0.007;',
        '}',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  wp.y += wav(wp.xz, uTime);',
        '  vW = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform float uTime, uRain, uCloud, uWind;',
        'uniform vec2 uResolution;',
        'uniform sampler2D tReflect;',
        'uniform vec3 uSunDir;',
        'varying vec3 vW;',
        'float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
        'float wav(vec2 p, float t){',
        '  return sin(p.x*0.52 + t*0.85)*0.05 + sin(p.y*0.73 - t*0.62)*0.04',
        '       + sin((p.x+p.y)*1.8 + t*1.65)*0.013 + sin(p.x*2.6 - p.y*1.4 + t*2.3)*0.007;',
        '}',
        'void main(){',
        '  float e = 0.24;',
        '  float hx = (wav(vW.xz+vec2(e,0.0), uTime) - wav(vW.xz-vec2(e,0.0), uTime))/(2.0*e);',
        '  float hz = (wav(vW.xz+vec2(0.0,e), uTime) - wav(vW.xz-vec2(0.0,e), uTime))/(2.0*e);',
        '  float fine = sin(vW.x*9.3 + vW.z*4.1 + uTime*2.7)*0.5 + sin(vW.x*3.7 - vW.z*8.2 - uTime*1.9)*0.5;',
        '  vec3 N = normalize(vec3(-hx*1.7 + fine*0.02, 1.0, -hz*1.7 + fine*0.015));',
        '  vec3 V = normalize(cameraPosition - vW);',
        '  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);',
        '  vec2 suv = gl_FragCoord.xy / uResolution;',
        '  vec2 duv = suv + N.xz * (0.006 + 0.013*fres);',
        '  vec3 refl = texture2D(tReflect, clamp(duv, 0.002, 0.998)).rgb;',
        '  float lum = dot(refl, vec3(0.32,0.55,0.13));',
        '  float fl = floor(lum*5.0)/5.0 + 0.1;',
        '  vec3 pal = mix(vec3(0.045,0.185,0.225), vec3(0.075,0.335,0.365), smoothstep(0.08,0.42,fl));',
        '  pal = mix(pal, vec3(0.36,0.63,0.62), smoothstep(0.45,0.72,fl));',
        '  pal = mix(pal, vec3(0.90,0.975,0.945), smoothstep(0.80,1.0,fl));',
        '  refl = mix(refl, pal, 0.56);',
        '  float shore = smoothstep(-21.0, 8.5, vW.z);',
        '  vec3 deep = vec3(0.028,0.215,0.280);',
        '  vec3 shallow = vec3(0.125,0.475,0.465);',
        '  vec3 base = mix(deep, shallow, clamp(shore*0.75 + 0.18, 0.0, 1.0));',
        '  base *= 0.94 + 0.06*sin(vW.x*0.35 + uTime*0.3);',
        '  vec3 col = mix(base, refl, 0.38 + 0.28*fres);',
        '  col *= 1.0 - uCloud*0.16;',
        '  // wave crest light',
        '  float crest = smoothstep(0.075, 0.13, wav(vW.xz, uTime)*0.5+0.06);',
        '  col += vec3(0.16,0.26,0.23)*crest*0.35;',
        '  // sun glints',
        '  vec3 H = normalize(uSunDir + V);',
        '  float spec = pow(max(dot(N,H),0.0), 240.0);',
        '  float spec2 = pow(max(dot(N, normalize(uSunDir + vec3(0.12,0.2,0.0) + V)),0.0), 460.0);',
        '  col += vec3(1.0,0.94,0.78) * (spec*2.3 + spec2*1.1) * (1.0-uCloud*0.55);',
        '  // rain glints (irregular, very sparse)',
        '  float rn = fract(sin(dot(floor(vW.xz*3.0 + uTime*0.7), vec2(12.9898,78.233)))*43758.5453);',
        '  col += vec3(0.72,0.90,0.88)*smoothstep(0.965,0.999,rn)*uRain*0.22*(1.0-uCloud*0.5);',
        '  // sparse expanding rain rings',
        '  vec2 rc = floor(vW.xz*2.1);',
        '  vec2 rf = fract(vW.xz*2.1)-0.5;',
        '  float rh = hash(rc);',
        '  float rp = fract(uTime*0.42 + rh*1.7);',
        '  vec2 rj = (vec2(hash(rc+2.3), hash(rc+7.1))-0.5)*0.55;',
        '  float rr = length(rf-rj);',
        '  float ring = smoothstep(0.04,0.0,abs(rr-rp*0.42))*(1.0-rp)*step(0.52,rh);',
        '  col += vec3(0.72,0.92,0.88)*ring*uRain*0.10*(1.0-uCloud*0.5);',
        '  // wind ripple bands',
        '  float wr = sin(vW.x*1.5 + vW.z*0.55 - uTime*2.2 + sin(vW.z*0.4)*2.0);',
        '  col += vec3(0.12,0.26,0.25)*smoothstep(0.82,1.0,wr)*uWind*0.12;',
        '  // advancing gust front from the sea',
        '  float gT = mod(uTime - 28.0, 37.0);',
        '  float gEnv = smoothstep(0.0,0.7,gT)*(1.0-smoothstep(6.8,9.0,gT));',
        '  float frontZ = -21.0 + gT*3.35;',
        '  float band = exp(-pow((vW.z-frontZ)*0.55,2.0))*gEnv;',
        '  float fRip = sin(vW.x*8.0 + vW.z*15.0 + uTime*5.0)*0.5+0.5;',
        '  col += vec3(0.18,0.32,0.30)*band*(0.16+0.20*fRip);',
        '  col = mix(col, vec3(0.84,0.95,0.92), band*smoothstep(0.78,0.96,fRip)*0.2);',
        '  // foam along quay walls',
        '  float edge = min(vW.x - (-7.5), 8.5 - vW.z);',
        '  float foamN = 0.55 + 0.45*sin(vW.x*3.2 + vW.z*2.6 + uTime*1.4);',
        '  float foam = smoothstep(1.0, 0.0, edge) * smoothstep(0.25,0.85,foamN);',
        '  col = mix(col, vec3(0.94,0.99,0.96), foam*0.35);',
        '  float alpha = mix(0.87, 0.965, fres);',
        '  alpha = max(alpha, foam*0.7);',
        '  gl_FragColor = vec4(col, alpha);',
        '}'
      ].join('\n')
    });
    mat.layer = 1;
    var water = new THREE.Mesh(geo, mat);
    water.position.set((L.wMinX + L.wMaxX) / 2, L.waterY, (L.wMinZ + L.wMaxZ) / 2);
    water.renderOrder = 10;
    water.layers.set(1);
    water.receiveShadow = false;
    g.add(water);
    W.water = water;
    W.waterMat = mat;

    buildUnderwater(g);
    buildWaterCut(g);
  }

  function buildWaterCut(g) {
    // glassy cut panes at the two open sides of the water block
    var paneMat = new THREE.MeshBasicMaterial({
      color: 0x7fcfc6, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide
    });
    var p1 = new THREE.Mesh(new THREE.PlaneGeometry(29.5, 5.3), paneMat);
    p1.rotation.y = Math.PI / 2;
    p1.position.set(21.002, -3.55, -6.25);
    p1.renderOrder = 6; p1.layers.set(1);
    g.add(p1);
    var p2 = new THREE.Mesh(new THREE.PlaneGeometry(28.5, 5.3), paneMat);
    p2.rotation.y = Math.PI;
    p2.position.set(6.75, -3.55, -21.002);
    p2.renderOrder = 6; p2.layers.set(1);
    g.add(p2);

    // frame
    var fm = M.concreteLight;
    H.box(0.34, 0.34, 29.7, fm, g, 20.94, -0.92, -6.25);
    H.box(0.34, 0.34, 29.7, fm, g, 20.94, -6.16, -6.25);
    H.box(0.34, 5.4, 0.34, fm, g, 20.94, -3.55, 8.49);
    H.box(0.34, 5.4, 0.34, fm, g, 20.94, -3.55, -20.99);
    H.box(28.7, 0.34, 0.34, fm, g, 6.75, -0.92, -20.94);
    H.box(28.7, 0.34, 0.34, fm, g, 6.75, -6.16, -20.94);

    // little reflection of the rim on the glass
    var rimMat = new THREE.MeshBasicMaterial({ color: 0xdff8f2, transparent: true, opacity: 0.25, depthWrite: false });
    var r1 = new THREE.Mesh(new THREE.PlaneGeometry(29.5, 0.12), rimMat);
    r1.rotation.y = Math.PI / 2;
    r1.position.set(21.004, -1.9, -6.25);
    r1.layers.set(1); r1.renderOrder = 7;
    g.add(r1);

    // translucent water body tint at the two cut faces
    var tintMat = new THREE.ShaderMaterial({
      uniforms: { uTime: H.SU.uTime, uRain: H.SU.uRain },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime, uRain;',
        'varying vec2 vUv;',
        'void main(){',
        '  float depth = 1.0 - vUv.y;',
        '  vec3 col = mix(vec3(0.30,0.72,0.69), vec3(0.04,0.28,0.33), depth);',
        '  float streak = sin(vUv.y*28.0 + sin(vUv.x*9.0+uTime*0.5)*1.7 + uTime*0.35);',
        '  col += vec3(0.10,0.18,0.16) * smoothstep(0.75,1.0,streak) * (1.0-depth*0.7);',
        '  float a = 0.10 + 0.22*depth + 0.04*smoothstep(0.2,0.9,streak);',
        '  gl_FragColor = vec4(col, a);',
        '}'
      ].join('\n')
    });
    var t1 = new THREE.Mesh(new THREE.PlaneGeometry(29.5, 5.2), tintMat);
    t1.rotation.y = Math.PI / 2;
    t1.position.set(20.96, -3.55, -6.25);
    t1.renderOrder = 8; t1.layers.set(1);
    g.add(t1);
    var t2 = new THREE.Mesh(new THREE.PlaneGeometry(28.5, 5.2), tintMat);
    t2.rotation.y = Math.PI;
    t2.position.set(6.75, -3.55, -20.96);
    t2.renderOrder = 8; t2.layers.set(1);
    g.add(t2);
  }

  function buildUnderwater(g) {
    var ug = new THREE.Group(); g.add(ug); ug.layers.set(1);
    // seabed
    var sg = new THREE.PlaneGeometry(L.wMaxX - L.wMinX, L.wMaxZ - L.wMinZ, 48, 48);
    sg.rotateX(-Math.PI / 2);
    var pos = sg.attributes.position;
    var n = H.makeNoise(303);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, n.fbm(x * 0.2, z * 0.2, 3, 0.55) * 0.22 - 0.05);
    }
    sg.computeVertexNormals();
    var seabedMat = H.toon(0xaec2bb, { map: T.seabed });
    var seabed = new THREE.Mesh(sg, seabedMat);
    seabed.position.set((L.wMinX + L.wMaxX) / 2, L.seabedY, (L.wMinZ + L.wMaxZ) / 2);
    seabed.receiveShadow = true;
    seabed.layers.set(1);
    ug.add(seabed);

    // rocks
    var rockMats = [H.toon(0x7e9188), H.toon(0x93a49a), H.toon(0x697e78)];
    for (var r = 0; r < 26; r++) {
      var geo = new THREE.DodecahedronGeometry(H.rr(0.16, 0.55), 0);
      var rock = new THREE.Mesh(geo, rockMats[r % 3]);
      rock.position.set(H.rr(-6.5, 20), L.seabedY + H.rr(0.02, 0.2), H.rr(-20.2, 7.8));
      rock.rotation.set(H.rr(0, 3), H.rr(0, 3), H.rr(0, 3));
      rock.scale.y = H.rr(0.5, 0.9);
      rock.layers.set(1);
      ug.add(rock);
    }
    // old tyre on the seabed
    var tyre = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.24, 8, 18), M.rubber);
    tyre.rotation.x = -Math.PI / 2;
    tyre.rotation.z = 0.4;
    tyre.position.set(2.6, L.seabedY + 0.2, -3.4);
    tyre.layers.set(1); ug.add(tyre);
    // tyre half buried
    var tyre2 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.17, 8, 16), H.toon(0x4a5354));
    tyre2.rotation.set(0.4, 0.6, 1.2);
    tyre2.position.set(9.8, L.seabedY + 0.3, -8.5);
    tyre2.layers.set(1); ug.add(tyre2);

    // anchor + chain
    var ax = 5.2, az = 1.5;
    var anchorMat = H.toon(0x6b6557);
    var shank = H.cyl(0.06, 0.07, 1.4, 6, anchorMat, ug, ax, L.seabedY + 0.3, az);
    shank.rotation.z = 0.5;
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12), anchorMat);
    ring.position.set(ax - 0.33, L.seabedY + 0.95, az); ring.rotation.y = 0.6; ring.layers.set(1); ug.add(ring);
    var arm1 = H.box(0.7, 0.08, 0.08, anchorMat, ug, ax + 0.2, L.seabedY + 0.16, az - 0.28);
    arm1.rotation.y = 0.7;
    arm1.layers.set(1);
    var fl1 = H.box(0.26, 0.1, 0.06, anchorMat, ug, ax + 0.46, L.seabedY + 0.24, az - 0.55);
    fl1.rotation.z = 0.5; fl1.layers.set(1);
    // chain links
    for (var c = 0; c < 14; c++) {
      var t = c / 13;
      var cx = H.lerp(ax - 0.3, -6.6, t);
      var cz = H.lerp(az, 3.6, t) + Math.sin(t * 5) * 0.25;
      var link = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 5, 9), H.toon(0x8a7b62));
      link.position.set(cx, L.seabedY + 0.06, cz);
      link.rotation.x = Math.PI / 2;
      link.rotation.z = c % 2 ? 0 : Math.PI / 2;
      link.layers.set(1); ug.add(link);
    }

    // sunken crate
    var crate = H.box(0.8, 0.55, 0.6, H.toon(0x8b7b60), ug, 13.4, L.seabedY + 0.25, 3.4);
    crate.rotation.set(0.2, 0.7, 0.1);
    crate.layers.set(1);

    // sea grass / kelp
    W.seaweed = [];
    var kelpMat = new THREE.ShaderMaterial({
      uniforms: { uTime: H.SU.uTime },
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      vertexShader: [
        'uniform float uTime;',
        'varying float vY;',
        'void main(){',
        '  vY = uv.y;',
        '  vec3 p = position;',
        '  float sway = sin(uTime*0.9 + uv.y*3.0 + modelMatrix[3].x*1.7 + modelMatrix[3].z*1.3);',
        '  p.x += sway * 0.18 * uv.y * uv.y;',
        '  p.z += cos(uTime*0.7 + uv.y*2.4 + modelMatrix[3].z)*0.13 * uv.y*uv.y;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying float vY;',
        'void main(){',
        '  vec3 top = vec3(0.30,0.66,0.44);',
        '  vec3 bot = vec3(0.10,0.34,0.26);',
        '  gl_FragColor = vec4(mix(bot, top, vY), 0.82 - vY*0.16);',
        '}'
      ].join('\n')
    });
    var ribbon = new THREE.PlaneGeometry(0.16, 1.3, 1, 7);
    ribbon.translate(0, 0.65, 0);
    for (var s = 0; s < 22; s++) {
      var m = new THREE.Mesh(ribbon, kelpMat);
      var px = 0, pz = 0;
      if (s < 10) { px = H.rr(-7.2, -4.5); pz = H.rr(-19.5, 7.5); }
      else if (s < 17) { px = H.rr(-4.5, 19.5); pz = H.rr(-20.0, -17.0); }
      else { px = H.rr(0, 19); pz = H.rr(-12, 6.5); }
      m.position.set(px, L.seabedY + 0.02, pz);
      m.rotation.y = H.rr(0, 6.28);
      m.scale.set(1, H.rr(0.5, 1.25), 1);
      m.layers.set(1);
      ug.add(m);
      W.seaweed.push(m);
    }
    // seaweed clinging to the quay and breakwater walls
    function wallKelp(px, py, pz, ry, sc) {
      var k = new THREE.Mesh(ribbon, kelpMat);
      k.position.set(px, py, pz);
      k.rotation.y = ry;
      k.scale.set(1.2, sc, 1);
      k.layers.set(1);
      ug.add(k);
      W.seaweed.push(k);
    }
    for (var wk = 0; wk < 5; wk++) wallKelp(-7.36, -1.15, -16.5 + wk * 4.4, Math.PI / 2, H.rr(0.55, 0.9));
    for (var wk2 = 0; wk2 < 4; wk2++) wallKelp(-2.5 + wk2 * 2.6, -0.95, -10.78, 0, H.rr(0.5, 0.85));
    for (var wk3 = 0; wk3 < 4; wk3++) wallKelp(1.0 + wk3 * 3.6, -1.1, 8.45, Math.PI, H.rr(0.55, 0.95));

    // caustics overlay
    var cm = new THREE.MeshBasicMaterial({
      map: T.caustic, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.4
    });
    var caustic = new THREE.Mesh(new THREE.PlaneGeometry(L.wMaxX - L.wMinX, L.wMaxZ - L.wMinZ), cm);
    caustic.rotation.x = -Math.PI / 2;
    caustic.position.set((L.wMinX + L.wMaxX) / 2, L.seabedY + 0.22, (L.wMinZ + L.wMaxZ) / 2);
    caustic.layers.set(1); caustic.renderOrder = 2;
    ug.add(caustic);
    W.caustic = caustic;

    // fish
    W.fish = [];
    var fishBodyMat = H.toon(0xc7dfe0, { transparent: true, opacity: 0.9 });
    var fishBackMat = H.toon(0x5a9199, { transparent: true, opacity: 0.9 });
    var bodyGeo = new THREE.SphereGeometry(0.15, 8, 6);
    bodyGeo.scale(1.9, 0.75, 0.55);
    var tailGeo = new THREE.ConeGeometry(0.12, 0.26, 4);
    tailGeo.rotateZ(Math.PI / 2);
    for (var f = 0; f < 24; f++) {
      var fg = new THREE.Group();
      var bm = new THREE.Mesh(bodyGeo, f % 3 === 0 ? fishBackMat : fishBodyMat);
      bm.layers.set(1); fg.add(bm);
      var tl = new THREE.Mesh(tailGeo, fishBodyMat);
      tl.position.x = -0.3; tl.layers.set(1); fg.add(tl);
      fg.layers.set(1);
      var center = new THREE.Vector3(H.rr(-5, 19), H.rr(-4.6, -2.2), H.rr(-19, 6.5));
      fg.position.copy(center);
      fg.userData = {
        center: center, radius: H.rr(1.2, 3.8), speed: H.rr(0.15, 0.4) * (H.rnd() < 0.5 ? -1 : 1),
        phase: H.rr(0, 6.28), bob: H.rr(0.05, 0.25), school: f < 12 ? 0 : 1
      };
      ug.add(fg);
      W.fish.push(fg);
    }
    W.underwater = ug;
  }

  // ------------------------------------------------------------------
  // breakwater + lighthouse + distant breakwater
  // ------------------------------------------------------------------
  function buildBreakwater(scene) {
    var g = new THREE.Group(); scene.add(g); W.breakwater = g;
    var start = new THREE.Vector3(-8.0, 0, -12.4);
    var end = new THREE.Vector3(8.6, 0, -13.3);
    var segs = 8;
    var dir = new THREE.Vector3().subVectors(end, start);
    var len = dir.length(); dir.normalize();
    var ang = Math.atan2(dir.x, dir.z);
    for (var i = 0; i < segs; i++) {
      var t = (i + 0.5) / segs;
      var px = H.lerp(start.x, end.x, t);
      var pz = H.lerp(start.z, end.z, t);
      var sg = new THREE.Group();
      sg.position.set(px, 0, pz);
      sg.rotation.y = ang;
      g.add(sg);
      var segLen = len / segs + 0.12;
      var bw = H.box(3.2, 2.75, segLen, M.concrete, sg, 0, -0.15, 0);
      H.outline(bw, 0.0022, 0x3b4c48);
      // top surface
      var tm = H.plane(3.05, segLen - 0.05, H.toon(0xffffff, { map: T.stone }), sg, 0, 1.23, 0);
      tm.rotation.x = -Math.PI / 2;
      // seaward parapet
      H.box(0.34, 0.6, segLen, M.concreteLight, sg, 0, 1.52, 1.35);
      H.box(0.46, 0.1, segLen, M.concreteLight, sg, 0, 1.82, 1.35);
      // walkway hazard edge
      var hz = T.hazard.clone(); hz.wrapS = hz.wrapT = THREE.RepeatWrapping; hz.repeat.set(2, 1); hz.needsUpdate = true;
      var hp = H.plane(0.3, segLen, new THREE.MeshBasicMaterial({ map: hz, color: 0xd9d6c8 }), sg, -1.28, 1.235, 0);
      hp.rotation.x = -Math.PI / 2;
      // moss patches
      if (i % 2 === 0) {
        var moss = H.plane(1.4, 0.9, new THREE.MeshBasicMaterial({ color: 0x5b7d56, transparent: true, opacity: 0.35 }), sg, 0.4, 1.238, -0.3);
        moss.rotation.x = -Math.PI / 2;
      }
    }
    // tetrapods
    var tetraGeo = makeTetrapodGeometry();
    var tetraMat = H.toon(0xcfd3c7);
    W.tetrapods = [];
    for (var t2 = 0; t2 < 11; t2++) {
      var tg = new THREE.Mesh(tetraGeo, tetraMat);
      tg.position.set(H.rr(-6.5, 7.8), H.rr(-1.0, 0.4), H.rr(-16.2, -14.2));
      tg.rotation.set(H.rr(0, 3), H.rr(0, 3), H.rr(0, 3));
      tg.scale.setScalar(H.rr(0.85, 1.25));
      tg.castShadow = true; tg.receiveShadow = true;
      g.add(tg);
      H.outline(tg, 0.0022, 0x46534d);
      W.tetrapods.push(tg);
    }
    // a few at the quay corner
    for (var t3 = 0; t3 < 4; t3++) {
      var tg2 = new THREE.Mesh(tetraGeo, tetraMat);
      tg2.position.set(H.rr(18.2, 20.6), H.rr(-1.2, -0.4), H.rr(2.2, 7.2));
      tg2.rotation.set(H.rr(0, 3), H.rr(0, 3), H.rr(0, 3));
      tg2.scale.setScalar(H.rr(0.9, 1.2));
      tg2.castShadow = true; tg2.receiveShadow = true;
      g.add(tg2);
      H.outline(tg2, 0.0022, 0x46534d);
      W.tetrapods.push(tg2);
    }
    // railing on breakwater
    for (var rp = 0; rp < 9; rp++) {
      var tt = rp / 8;
      var px2 = H.lerp(-7.0, 7.6, tt), pz2 = H.lerp(-12.4, -13.1, tt) - 0.9;
      H.cyl(0.035, 0.045, 0.9, 6, M.steel, g, px2, 1.68, pz2);
      H.outline(g.children[g.children.length - 1], 0.0025);
    }
    H.tube([
      new THREE.Vector3(-7.0, 2.05, -13.3), new THREE.Vector3(0, 1.95, -13.7), new THREE.Vector3(7.6, 2.0, -14.0)
    ], 0.028, M.steel, g, 20);

    buildLighthouse(g);
    buildDistantBreakwater(scene);
  }

  function makeTetrapodGeometry() {
    var geos = [];
    var dirs = [
      new THREE.Vector3(0.577, 0.577, 0.577),
      new THREE.Vector3(-0.577, -0.577, 0.577),
      new THREE.Vector3(-0.577, 0.577, -0.577),
      new THREE.Vector3(0.577, -0.577, -0.577)
    ];
    dirs.forEach(function (d) {
      var g = new THREE.CylinderGeometry(0.16, 0.46, 1.55, 7);
      g.translate(0, 0.77, 0);
      var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      var m = new THREE.Matrix4().makeRotationFromQuaternion(q);
      g.applyMatrix4(m);
      geos.push(g);
    });
    return H.mergeGeometries(geos);
  }

  function buildLighthouse(parent) {
    var g = new THREE.Group();
    g.position.set(8.6, 1.25, -13.3);
    parent.add(g);
    W.lighthouse = g;
    // base platform
    H.cyl(1.25, 1.4, 0.55, 8, M.concreteLight, g, 0, 0.25, 0);
    // tapered tower with bands
    var bands = 6;
    for (var i = 0; i < bands; i++) {
      var rBottom = 0.9 - i * 0.055;
      var rTop = 0.9 - (i + 1) * 0.055;
      var col = i % 2 === 0 ? 0xd94a3f : 0xf2f3ea;
      var m = H.cyl(rTop, rBottom, 0.78, 14, H.toon(col), g, 0, 0.5 + 0.39 + i * 0.78, 0);
      m.castShadow = true;
      H.outline(m, 0.0017, 0x3a3030);
    }
    // gallery
    H.cyl(1.05, 1.05, 0.16, 16, M.iron, g, 0, 5.32, 0);
    for (var r = 0; r < 12; r++) {
      var a = r / 12 * Math.PI * 2;
      H.cyl(0.022, 0.022, 0.42, 4, M.iron, g, Math.cos(a) * 0.93, 5.6, Math.sin(a) * 0.93);
    }
    var rail = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.028, 4, 20), M.iron);
    rail.rotation.x = Math.PI / 2; rail.position.y = 5.82; g.add(rail);
    // lantern room
    H.cyl(0.62, 0.62, 0.72, 12, H.glass(0xfff6da, 0.28), g, 0, 5.82, 0);
    var lantern = H.cyl(0.3, 0.38, 0.45, 10, H.emissive(0xffe2a0), g, 0, 5.72, 0);
    lantern.material.toneMapped = false;
    // lamp roof
    var lroof = H.cyl(0.04, 0.8, 0.5, 12, H.toon(0xc7443a), g, 0, 6.43, 0);
    H.outline(lroof, 0.002, 0x3a3030);
    H.sphere(0.07, M.brass, g, 0, 6.7, 0);
    // door + tiny window
    var door = H.box(0.42, 0.8, 0.08, H.toon(0x315b60), g, 0, 1.0, 0.88);
    door.rotation.x = 0.02;
    for (var w = 0; w < 3; w++) {
      H.box(0.12, 0.2, 0.05, H.emissive(0xffe6ae), g, 0, 2.2 + w * 1.5, 0.83 - w * 0.05);
    }
    // small light + halo
    var light = new THREE.PointLight(0xffd58a, 0.0, 14, 2);
    light.position.set(0, 5.9, 0);
    g.add(light);
    W.lighthouseLight = light;
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T.foam, color: 0xffe1a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.0
    }));
    halo.scale.set(5, 5, 1);
    halo.position.set(0, 5.9, 0);
    g.add(halo);
    W.lighthouseHalo = halo;
    // faint lamp glass outline glow
    var lampGlow = H.plane(0.9, 0.9, new THREE.MeshBasicMaterial({
      map: T.caustic, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.0
    }), g, 0, 5.85, 0.65);
    W.lampGlow = lampGlow;
  }

  function buildDistantBreakwater(scene) {
    var g = new THREE.Group(); scene.add(g); W.distant = g;
    var mat = H.toon(0xa9bdb8);
    H.box(19, 1.4, 2.4, mat, g, 11.5, 0.1, -19.4);
    H.box(19.2, 0.24, 2.55, H.toon(0xbcc9c2), g, 11.5, 0.86, -19.4);
    for (var i = 0; i < 5; i++) {
      H.cyl(0.04, 0.04, 1.6, 4, H.toon(0x6f8583), g, 4 + i * 3.6, 1.4, -20.4);
    }
    // tiny beacon
    var b = H.cyl(0.18, 0.24, 1.2, 8, H.toon(0xc7503f), g, 19.5, 1.6, -19.4);
    var bl = H.sphere(0.12, H.emissive(0xffdd9a), g, 19.5, 2.28, -19.4);
    // distant boats
    W.distantBoats = [];
    for (var k = 0; k < 2; k++) {
      var bg = new THREE.Group();
      bg.position.set(1 + k * 9, -0.35, -17.4 + k * 1.4);
      g.add(bg);
      H.box(3.2, 0.55, 0.9, H.toon(0xe9efe9), bg, 0, 0, 0);
      H.box(1.2, 0.6, 0.7, H.toon(0xdde7e2), bg, -0.5, 0.45, 0);
      H.cyl(0.03, 0.03, 1.1, 4, M.iron, bg, 0.4, 1.0, 0);
      W.distantBoats.push(bg);
    }
    // sea haze band far away
    var haze = H.plane(42, 2.2, new THREE.MeshBasicMaterial({
      color: 0xeaf6f4, transparent: true, opacity: 0.35, depthWrite: false
    }), g, 0, 0.1, -20.6);
    haze.rotation.x = -Math.PI / 2;
  }

  // ------------------------------------------------------------------
  // hillside, trees, houses
  // ------------------------------------------------------------------
  function hillY(x, z) {
    var dx = (x + 15.6) / 9.3;
    var dz = (z + 14.0) / 8.2;
    var q = 1 - dx * dx - dz * dz;
    if (q <= 0) return 0;
    return Math.sqrt(q) * 4.3 - 0.15;
  }
  W.hillY = hillY;

  function buildHill(scene) {
    var g = new THREE.Group(); scene.add(g); W.hill = g;
    var geo = new THREE.SphereGeometry(1, 44, 22, 0, Math.PI * 2, 0, Math.PI / 2);
    var pos = geo.attributes.position;
    var n = H.makeNoise(707);
    for (var i = 0; i < pos.count; i++) {
      var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      var noise = n.fbm(px * 2.2 + 5, pz * 2.2 + 1, 3, 0.5) - 0.5;
      pos.setY(i, py * (1 + noise * 0.25));
    }
    geo.computeVertexNormals();
    var hillMat = H.toon(0xd3e4c9, { map: T.grass });
    var hill = new THREE.Mesh(geo, hillMat);
    hill.scale.set(9.3, 4.5, 8.2);
    hill.position.set(-15.6, -0.2, -14.0);
    hill.castShadow = true; hill.receiveShadow = true;
    g.add(hill);

    // retaining wall along the quay side
    var wallPts = [
      [-20.6, -6.0], [-18.6, -6.9], [-16.4, -7.1], [-14.0, -6.9], [-11.8, -6.5], [-9.8, -7.4]
    ];
    for (var w = 0; w < wallPts.length - 1; w++) {
      var x1 = wallPts[w][0], z1 = wallPts[w][1];
      var x2 = wallPts[w + 1][0], z2 = wallPts[w + 1][1];
      var dx = x2 - x1, dz = z2 - z1;
      var len = Math.sqrt(dx * dx + dz * dz);
      var wm = H.box(len, 1.0, 0.5, H.toon(0xffffff, { map: T.stone }), g, (x1 + x2) / 2, 0.25, (z1 + z2) / 2);
      wm.rotation.y = -Math.atan2(dz, dx);
    }

    // stone path up the hill
    for (var s = 0; s < 7; s++) {
      var sz = -7.0 - s * 0.85;
      var sx = -10.6 - s * 0.25;
      var sy = Math.max(0.05, hillY(sx, sz));
      var st = H.box(1.25, 0.16, 0.7, H.toon(0xcfcbbb), g, sx, sy + 0.06, sz);
      st.rotation.y = 0.25;
    }

    // trees
    var trunkMat = H.toon(0x6b523c);
    var leafMats = [H.toon(0x2f6b46), H.toon(0x408a52), H.toon(0x24543a), H.toon(0x5d9b5f)];
    var treeSpots = [
      [-19.6, -11.4, 1.5], [-17.8, -9.7, 1.1], [-19.0, -16.8, 1.3], [-16.6, -18.3, 1.0],
      [-14.0, -17.2, 1.35], [-12.4, -18.6, 0.9], [-12.2, -11.6, 0.85], [-9.7, -12.8, 0.8],
      [-18.4, -13.8, 1.0], [-13.0, -9.6, 0.75], [-11.4, -15.5, 1.0], [-16.0, -20.0, 1.1],
      [-19.8, -19.3, 1.2], [-9.2, -17.7, 0.8]
    ];
    treeSpots.forEach(function (ts, idx) {
      var tx = ts[0], tz = ts[1], scl = ts[2];
      var ty = hillY(tx, tz) + 0.1;
      var tg = new THREE.Group();
      tg.position.set(tx, ty, tz);
      tg.scale.setScalar(scl);
      g.add(tg);
      W.treeSway = W.treeSway || [];
      W.treeSway.push({ group: tg, phase: idx * 0.9, baseX: 0, baseZ: 0 });
      var trunk = H.cyl(0.13, 0.22, 1.9, 6, trunkMat, tg, 0, 0.95, 0);
      trunk.castShadow = true;
      // layered pine-ish canopies
      var layers = idx % 3 === 0 ? 3 : 2;
      for (var ly = 0; ly < layers; ly++) {
        var radius = (1.25 - ly * 0.28) * (0.9 + (idx % 4) * 0.08);
        var canopy = H.sphere(radius, leafMats[(idx + ly) % leafMats.length], tg, 0, 1.9 + ly * 0.55, 0, 10, 8);
        canopy.scale.y = 0.62;
        canopy.rotation.y = idx * 0.7 + ly;
        canopy.castShadow = true;
      }
      if (scl > 1.0) {
        tg.traverse(function (o) { if (o.isMesh && o.material !== trunkMat && o.material.type === 'MeshToonMaterial') H.outline(o, 0.0022); });
      }
    });

    // little bushes
    for (var b = 0; b < 26; b++) {
      var bx = H.rr(-20.5, -8.5), bz = H.rr(-20.5, -6.2);
      var by = hillY(bx, bz);
      if (by < 0.15) continue;
      var bush = H.sphere(H.rr(0.22, 0.5), leafMats[b % 4], g, bx, by + 0.1, bz, 7, 5);
      bush.scale.y = 0.7;
      bush.castShadow = true;
    }

    // houses
    var houseDefs = [
      { x: -17.4, z: -11.5, ry: 0.45, w: 2.6, h: 1.7, d: 2.0 },
      { x: -12.3, z: -15.2, ry: -0.35, w: 2.2, h: 1.5, d: 1.8 },
      { x: -18.6, z: -17.6, ry: 0.15, w: 2.0, h: 1.4, d: 1.7 }
    ];
    houseDefs.forEach(function (hd, i) {
      var hg = new THREE.Group();
      hg.position.set(hd.x, hillY(hd.x, hd.z) + 0.02, hd.z);
      hg.rotation.y = hd.ry;
      g.add(hg);
      var wallMat = i === 1 ? H.toon(0xe7ddc7) : H.toon(0xf0eadc);
      H.box(hd.w, hd.h, hd.d, wallMat, hg, 0, hd.h / 2, 0);
      // timber frame
      H.box(hd.w + 0.04, 0.09, hd.d + 0.04, M.woodDark, hg, 0, hd.h - 0.16, 0);
      H.box(0.09, hd.h, 0.09, M.woodDark, hg, -hd.w / 2 + 0.06, hd.h / 2, hd.d / 2);
      H.box(0.09, hd.h, 0.09, M.woodDark, hg, hd.w / 2 - 0.06, hd.h / 2, hd.d / 2);
      // gable roof
      var roofMat = H.toon(0xffffff, { map: T.roofTile });
      var rw = hd.w + 0.55, rd = hd.d * 0.72;
      var r1 = H.box(rw, 0.1, rd, roofMat, hg, 0, hd.h + 0.32, -hd.d * 0.21);
      r1.rotation.x = 0.5;
      var r2 = H.box(rw, 0.1, rd, roofMat, hg, 0, hd.h + 0.32, hd.d * 0.21);
      r2.rotation.x = -0.5;
      // ridge
      H.box(rw + 0.1, 0.09, 0.09, H.toon(0x40555a), hg, 0, hd.h + 0.66, 0);
      // windows
      var winMat = H.emissive(0xffdda2, 0.0);
      winMat.color.set(0xffd99a);
      var win1 = H.box(0.55, 0.45, 0.05, winMat, hg, -hd.w * 0.22, hd.h * 0.55, hd.d / 2 + 0.012);
      var win2 = H.box(0.38, 0.38, 0.05, winMat, hg, hd.w * 0.26, hd.h * 0.5, hd.d / 2 + 0.012);
      // door
      H.box(0.44, 0.9, 0.06, H.toon(0x7b5a3e), hg, hd.w * 0.28, 0.45, hd.d / 2 + 0.02);
      // chimney
      H.box(0.24, 0.7, 0.24, M.concreteDark, hg, -hd.w * 0.28, hd.h + 0.55, -0.2);
      hg.traverse(function (o) {
        if (o.isMesh && o.material && o.material.type === 'MeshToonMaterial') H.outline(o, 0.0022);
      });
    });

    // a few stone steps at the base of the path and a lantern
    var stoneLantern = new THREE.Group();
    stoneLantern.position.set(-9.9, hillY(-9.9, -8.6), -8.6);
    g.add(stoneLantern);
    H.box(0.5, 0.2, 0.5, H.toon(0xbfbaab), stoneLantern, 0, 0.1, 0);
    H.cyl(0.1, 0.14, 0.5, 6, H.toon(0xbfbaab), stoneLantern, 0, 0.4, 0);
    H.box(0.42, 0.28, 0.42, H.toon(0xb5b0a2), stoneLantern, 0, 0.72, 0);
    H.cyl(0.06, 0.36, 0.3, 4, H.toon(0xa9a496), stoneLantern, 0, 0.98, 0);
    var warm = H.plane(0.22, 0.18, H.emissive(0xffdca0), stoneLantern, 0, 0.72, 0.22);
  }

  // ------------------------------------------------------------------
  H.buildWorld = function (scene) {
    buildMaterials();
    buildPlinth(scene);
    buildQuay(scene);
    buildWater(scene);
    buildBreakwater(scene);
    buildHill(scene);
  };

})(window.H);


