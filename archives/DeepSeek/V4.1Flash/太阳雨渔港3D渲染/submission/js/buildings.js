/* =========================================================
   汐見漁港 — harbour buildings: co-op warehouse with open
   shutter, waiting room, small details
   ========================================================= */
(function (H) {
  'use strict';
  var T = H.TEX, M, W;
  function ready() { M = H.M; W = H.W; }

  // -----------------------------------------------------------------
  // light shaft helper
  // -----------------------------------------------------------------
  function lightShaft(parent, opts) {
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(opts.color || 0xffedc4) },
        uOpacity: { value: opts.opacity === undefined ? 0.18 : opts.opacity },
        uTime: H.SU.uTime,
        uCloud: H.SU.uCloud,
        uSeed: { value: H.rnd() * 10 }
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uOpacity, uTime, uCloud, uSeed;',
        'varying vec2 vUv;',
        'void main(){',
        '  float along = smoothstep(0.0,0.18,vUv.y) * smoothstep(1.0,0.6,vUv.y);',
        '  float across = sin(vUv.x*3.14159);',
        '  float dust = 0.75 + 0.25*sin(vUv.y*20.0 - uTime*0.4 + uSeed) * sin(vUv.x*13.0 + uTime*0.25);',
        '  float a = uOpacity * along * across * across * dust * (1.0-uCloud*0.55);',
        '  gl_FragColor = vec4(uColor * a, a);',
        '}'
      ].join('\n')
    });
    var h = opts.height || 6;
    var geo = new THREE.PlaneGeometry(opts.width || 1.4, h, 1, 8);
    var g = new THREE.Group();
    g.position.set(opts.x, opts.y, opts.z);
    g.rotation.set(opts.rx || 0, opts.ry || 0, opts.rz || 0);
    parent.add(g);
    var q1 = new THREE.Mesh(geo, mat);
    q1.position.y = -h / 2;
    q1.renderOrder = 26;
    g.add(q1);
    var q2 = q1.clone();
    q2.rotation.y = Math.PI / 2;
    g.add(q2);
    return { group: g, mat: mat };
  }

  // -----------------------------------------------------------------
  // co-op warehouse
  // -----------------------------------------------------------------
  function buildWarehouse(scene) {
    var g = new THREE.Group();
    g.position.set(-15.4, 0, 1.4);
    scene.add(g);
    W.warehouse = g;
    var Wd = 10.0, Dp = 6.6, Hh = 4.3;
    var wtex = T.corrugated.clone();
    wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping;
    wtex.repeat.set(4, 2.4); wtex.needsUpdate = true;
    var rtex = T.corrugated.clone();
    rtex.wrapS = rtex.wrapT = THREE.RepeatWrapping;
    rtex.repeat.set(3, 1.4); rtex.needsUpdate = true;
    var wallMat = H.toon(0xd6e0da, { map: wtex });
    var wallLow = H.toon(0x78948e);
    var roofMat = H.toon(0xa2b8b2, { map: rtex });

    var slab = H.box(Dp, 0.18, Wd, H.toon(0xffffff, { map: T.concreteTop }), g, 0, 0.09, 0);
    slab.receiveShadow = true;
    var wetFloor = H.plane(Dp - 0.3, Wd - 0.3, new THREE.MeshBasicMaterial({
      color: 0x6f8f8c, transparent: true, opacity: 0.28, depthWrite: false
    }), g, 0, 0.19, 0);
    wetFloor.rotation.x = -Math.PI / 2;

    var wallIn = H.toon(0x8aa39c, { map: wtex });
    H.outline(H.box(0.28, Hh, Wd, wallIn, g, -Dp / 2, Hh / 2, 0), 0.0022, 0x304742);
    H.outline(H.box(Dp, Hh, 0.28, wallIn, g, 0, Hh / 2, -Wd / 2), 0.0022, 0x304742);
    H.outline(H.box(Dp, Hh, 0.28, wallIn, g, 0, Hh / 2, Wd / 2), 0.0022, 0x304742);
    H.box(0.08, 0.9, Wd - 0.2, wallLow, g, -Dp / 2 + 0.16, 0.45, 0);
    H.box(Dp - 0.2, 0.9, 0.08, wallLow, g, 0, 0.45, -Wd / 2 + 0.16);
    H.box(Dp - 0.2, 0.9, 0.08, wallLow, g, 0, 0.45, Wd / 2 - 0.16);

    var doorW = 4.0, doorH = 3.0;
    H.outline(H.box(0.28, Hh, (Wd - doorW) / 2, wallMat, g, Dp / 2, Hh / 2, -(doorW / 2 + (Wd - doorW) / 4)), 0.0022, 0x3a4d47);
    H.outline(H.box(0.28, Hh, (Wd - doorW) / 2, wallMat, g, Dp / 2, Hh / 2, (doorW / 2 + (Wd - doorW) / 4)), 0.0022, 0x3a4d47);
    H.outline(H.box(0.28, Hh - doorH, doorW, wallMat, g, Dp / 2, doorH + (Hh - doorH) / 2, 0), 0.0022, 0x3a4d47);
    H.box(0.35, 3.35, 0.16, M.rust, g, Dp / 2 + 0.02, 1.55, -doorW / 2 - 0.08);
    H.box(0.35, 3.35, 0.16, M.rust, g, Dp / 2 + 0.02, 1.55, doorW / 2 + 0.08);
    var shutter = H.box(0.14, 0.72, doorW, H.toon(0xffffff, { map: T.corrugated }), g, Dp / 2 + 0.24, doorH - 0.4, 0);
    H.outline(shutter, 0.0018);
    var drum = H.cyl(0.22, 0.22, doorW + 0.2, 12, M.iron, g, Dp / 2 + 0.3, doorH + 0.08, 0);
    drum.rotation.x = Math.PI / 2;
    H.box(0.12, doorH, 0.12, M.iron, g, Dp / 2 + 0.22, doorH / 2, -doorW / 2);
    H.box(0.12, doorH, 0.12, M.iron, g, Dp / 2 + 0.22, doorH / 2, doorW / 2);
    var stripMat = new THREE.MeshPhongMaterial({
      color: 0xd8efe9, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false
    });
    [-1.55, 1.55].forEach(function (sz) {
      var strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.0, 1, 4), stripMat);
      strip.position.set(Dp / 2 + 0.32, 1.9, sz);
      strip.rotation.y = Math.PI / 2;
      strip.renderOrder = 24;
      g.add(strip);
    });

    var roof = new THREE.Group();
    roof.position.set(0, Hh, 0);
    g.add(roof);
    H.box(Dp + 0.9, 0.16, 0.5, M.woodDark, roof, 0, 0.02, 0);
    var r1 = H.box(Dp + 0.95, 0.12, Wd / 2 + 0.55, roofMat, roof, 0, 0.65, -Wd / 4 - 0.1);
    H.outline(r1, 0.0022, 0x354b46);
    r1.rotation.x = -0.24;
    var r2 = H.box(Dp + 0.95, 0.12, Wd / 2 + 0.55, roofMat, roof, 0, 0.65, Wd / 4 + 0.1);
    H.outline(r2, 0.0022, 0x354b46);
    r2.rotation.x = 0.24;
    H.box(Dp + 1.05, 0.12, 0.14, M.iron, roof, 0, 1.28, 0);
    for (var b = 0; b < 4; b++) {
      H.box(0.12, 0.18, Wd + 0.6, M.woodDark, roof, -Dp / 2 + 0.3 + b * 2, 0.5, 0);
    }
    // rooftop plant: AC, water tank, vents, hatch
    var acG = new THREE.Group();
    acG.position.set(-1.35, 5.08, 1.95);
    acG.rotation.x = 0.24;
    g.add(acG);
    H.box(1.6, 0.1, 1.25, H.toon(0x9aa9a2), acG, 0, 0.05, 0);
    H.box(0.86, 0.5, 0.68, H.toon(0xd4dcd2), acG, -0.15, 0.35, 0);
    H.outline(acG.children[1], 0.0018);
    var fan = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 5, 14), M.iron);
    fan.rotation.x = Math.PI / 2; fan.position.set(-0.15, 0.61, 0); acG.add(fan);
    H.cyl(0.21, 0.21, 0.02, 12, H.toon(0x3e4a48), acG, -0.15, 0.61, 0);
    for (var bf = 0; bf < 4; bf++) {
      var blade = H.box(0.17, 0.01, 0.05, H.toon(0x7b8b84), acG, -0.15, 0.62, 0);
      blade.rotation.y = bf * Math.PI / 2;
    }
    H.cyl(0.1, 0.13, 1.35, 8, H.toon(0xb7c3bb), g, 2.0, 5.65, 1.25);
    H.cyl(0.32, 0.1, 0.3, 8, H.toon(0xa9b8b0), g, 2.0, 6.4, 1.25);
    H.cyl(0.22, 0.22, 0.08, 10, M.iron, g, 2.0, 4.98, 1.25);
    var tank = new THREE.Group();
    tank.position.set(1.05, 5.6, 1.85);
    g.add(tank);
    H.cyl(0.46, 0.46, 0.85, 14, H.toon(0xc9d6d1), tank, 0, 0, 0);
    H.cyl(0.5, 0.5, 0.08, 14, H.toon(0x8fa6a1), tank, 0, 0.46, 0);
    H.sphere(0.1, M.brass, tank, 0, 0.52, 0, 6, 4);
    H.cyl(0.04, 0.04, 0.9, 5, M.iron, tank, 0.3, -0.85, 0);
    for (var lg = 0; lg < 4; lg++) {
      var a = lg / 4 * Math.PI * 2 + 0.5;
      H.cyl(0.03, 0.03, 0.8, 4, M.iron, tank, Math.cos(a) * 0.3, -0.82, Math.sin(a) * 0.3);
    }
    H.box(0.82, 0.16, 0.7, H.toon(0xbfcac2), g, 0.3, 5.05, -1.7).rotation.x = -0.24;
    H.box(0.7, 0.12, 0.58, H.toon(0x637b76), g, 0.3, 5.08, -1.7).rotation.x = -0.24;
    H.cyl(0.025, 0.035, 1.7, 5, M.iron, g, -2.4, 6.0, -1.9);
    H.cyl(0.008, 0.012, 0.9, 4, M.iron, g, -2.4, 6.0, -2.4).rotation.x = Math.PI / 2;
    var winMat = H.glass(0xe8f8f3, 0.25);
    [-2.6, 0.0, 2.6].forEach(function (wz) {
      var win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), winMat);
      win.position.set(-Dp / 2 + 0.02, 3.35, wz);
      win.rotation.y = Math.PI / 2;
      win.renderOrder = 23;
      g.add(win);
      H.box(0.06, 0.05, 1.2, M.iron, g, -Dp / 2 + 0.05, 3.76, wz);
      H.box(0.06, 0.05, 1.2, M.iron, g, -Dp / 2 + 0.05, 2.94, wz);
      H.box(0.06, 0.85, 0.05, M.iron, g, -Dp / 2 + 0.05, 3.35, wz - 0.58);
      H.box(0.06, 0.85, 0.05, M.iron, g, -Dp / 2 + 0.05, 3.35, wz + 0.58);
    });
    // sunny-side high windows on the south wall
    [-2.6, 0.0, 2.6].forEach(function (wx) {
      var win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), winMat);
      win.position.set(wx, 3.35, Wd / 2 - 0.02);
      win.rotation.y = 0;
      win.renderOrder = 23;
      g.add(win);
      H.box(1.2, 0.05, 0.06, M.iron, g, wx, 3.76, Wd / 2 - 0.05);
      H.box(1.2, 0.05, 0.06, M.iron, g, wx, 2.94, Wd / 2 - 0.05);
      H.box(0.05, 0.85, 0.06, M.iron, g, wx - 0.58, 3.35, Wd / 2 - 0.05);
      H.box(0.05, 0.85, 0.06, M.iron, g, wx + 0.58, 3.35, Wd / 2 - 0.05);
    });

    var signTex = H.textTexture([
      { text: '汐見漁業協同組合', size: 74, color: '#f0ead8', y: 90 },
      { text: 'SHIOMI  FISHERY  CO-OPERATIVE', size: 22, color: '#cfdcd2', y: 142 }
    ], { w: 900, h: 200, bg: '#2c5155', border: '#18383b', borderWidth: 8 });
    var sign = H.signPlane(3.6, 0.8, signTex, g, Dp / 2 + 0.3, 3.72, 0);
    sign.rotation.y = Math.PI / 2;
    var eave = H.box(1.1, 0.08, doorW + 1.2, H.toon(0xffffff, { map: T.corrugated }), g, Dp / 2 + 0.6, 3.15, 0);
    eave.rotation.z = 0.12;
    H.outline(eave, 0.0016);
    H.cyl(0.08, 0.08, 4.1, 8, M.iron, g, Dp / 2 + 0.32, 2.05, -Wd / 2 + 0.3);
    H.cyl(0.08, 0.08, 0.4, 8, M.iron, g, Dp / 2 + 0.2, 0.2, -Wd / 2 + 0.3).rotation.z = 1.1;
    H.box(0.12, 0.2, 0.16, H.emissive(0xffdaa0), g, Dp / 2 + 0.22, 3.3, -doorW / 2 - 0.5);
    var poster = H.signPlane(0.55, 0.78, T.poster, g, Dp / 2 + 0.22, 2.1, doorW / 2 + 0.7);
    poster.rotation.y = Math.PI / 2;
    H.box(0.9, 0.5, 0.62, H.toon(0xffffff, { map: T.crate }), g, Dp / 2 + 1.2, 0.26, doorW / 2 + 0.9);
    var rustDecal = H.signPlane(1.8, 2.2, T.rust, g, Dp / 2 + 0.17, 1.4, 2.6);
    rustDecal.rotation.y = Math.PI / 2;
    rustDecal.material.opacity = 0.26;

    buildWarehouseInterior(g, Dp, Wd, Hh);

    W.shafts = [];
    [-2.6, 0.0, 2.6].forEach(function (wx, i) {
      var sh = lightShaft(g, {
        x: wx, y: 3.28, z: Wd / 2 - 0.5, width: 1.5, height: 6.2,
        rx: 0.58, rz: -0.6, ry: 0,
        opacity: 0.27 + i * 0.015
      });
      W.shafts.push(sh);
    });
    var sh2 = lightShaft(g, {
      x: Dp / 2 - 0.3, y: 2.8, z: 0.4, width: 2.4, height: 5.2,
      rx: -0.6, rz: 0.75, opacity: 0.17
    });
    W.shafts.push(sh2);

    // big warm beam through the open shutter
    var beamDir = new THREE.Vector3(-3.0, -2.2, -1.0).normalize();
    var beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: H.SU.uTime, uCloud: H.SU.uCloud },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime, uCloud;',
        'varying vec2 vUv;',
        'void main(){',
        '  float top = smoothstep(0.05,0.35,vUv.y);',
        '  float fall = pow(vUv.y, 0.7);',
        '  float dust = 0.66 + 0.34*sin(vUv.x*17.0 + vUv.y*9.0 + uTime*0.8);',
        '  float a = 0.24 * fall * dust * top * (1.0 - uCloud*0.55);',
        '  gl_FragColor = vec4(vec3(1.0,0.94,0.78), a);',
        '}'
      ].join('\n')
    });
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 1.15, 4.2, 20, 1, true), beamMat);
    beam.position.set(1.25, 1.2, 0.4);
    var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir.clone().negate());
    beam.quaternion.copy(q);
    beam.renderOrder = 27;
    g.add(beam);
    W.warehouseBeam = beam;

    var pl = new THREE.PointLight(0xffd9a4, 0.78, 13, 2);
    pl.position.set(0.8, 3.2, 0.4);
    g.add(pl);
    W.warehouseLight = pl;
    var pl2 = new THREE.PointLight(0xbfe8df, 0.5, 10, 2);
    pl2.position.set(-2.2, 2.0, -2.0);
    g.add(pl2);
  }

  function buildWarehouseInterior(g, Dp, Wd, Hh) {
    var inG = new THREE.Group();
    g.add(inG);
    var ceiling = H.plane(Dp - 0.5, Wd - 0.5, H.toon(0x788f88), inG, 0, Hh - 0.12, 0);
    ceiling.rotation.x = Math.PI / 2;
    var caus = new THREE.Mesh(new THREE.PlaneGeometry(Dp * 0.7, Wd * 0.8), new THREE.MeshBasicMaterial({
      map: T.caustic, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    caus.rotation.x = Math.PI / 2;
    caus.position.set(-0.4, Hh - 0.18, 0);
    inG.add(caus);
    W.warehouseCaustic = caus;

    var crateMat = H.toon(0xffffff, { map: T.crate });
    var blueMat = H.toon(0xffffff, { map: T.crateBlue });
    for (var s = 0; s < 3; s++) {
      for (var h = 0; h < 3 - s; h++) {
        var cr = H.box(0.9, 0.52, 0.64, (s + h) % 4 === 0 ? blueMat : crateMat, inG, -1.7 + s * 0.98, 0.45 + h * 0.51, -3.2);
        cr.rotation.y = H.rr(-0.05, 0.05);
        H.outline(cr, 0.0016);
      }
    }
    for (var c2 = 0; c2 < 5; c2++) {
      var cr2 = H.box(0.9, 0.52, 0.64, c2 % 3 === 0 ? blueMat : crateMat, inG, 1.9, 0.45 + (c2 % 2) * 0.51, -3.6 + Math.floor(c2 / 2) * 0.7);
      cr2.rotation.y = H.rr(-0.08, 0.08);
      H.outline(cr2, 0.0016);
    }
    var freezer = H.box(1.6, 1.1, 0.85, H.toon(0xe9eee5), inG, -1.8, 0.55, 1.4);
    H.outline(freezer, 0.0018);
    H.box(1.62, 0.08, 0.87, H.toon(0xcbd8d1), inG, -1.8, 1.13, 1.4);
    H.box(0.16, 0.06, 0.4, M.iron, inG, -1.15, 0.75, 1.83);
    H.box(1.0, 0.06, 0.7, M.woodDark, inG, 0.4, 0.9, 0.9);
    H.cyl(0.06, 0.07, 0.9, 6, M.iron, inG, 0.05, 0.45, 0.9);
    H.cyl(0.06, 0.07, 0.9, 6, M.iron, inG, 0.75, 0.45, 0.9);
    H.cyl(0.3, 0.3, 0.08, 16, H.toon(0xd8dfd6), inG, 0.4, 0.97, 0.9);
    H.cyl(0.1, 0.14, 0.22, 10, H.toon(0xb7c2ba), inG, 0.4, 1.08, 0.9);
    var dialTex = H.tex(128, 128, function (ctx, w, h) {
      ctx.fillStyle = '#f2f0df'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 58, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#3f5350'; ctx.lineWidth = 3;
      for (var i = 0; i < 20; i++) {
        var a = i / 20 * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(a) * 44, h / 2 + Math.sin(a) * 44);
        ctx.lineTo(w / 2 + Math.cos(a) * 52, h / 2 + Math.sin(a) * 52); ctx.stroke();
      }
      ctx.strokeStyle = '#b24a3c'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + 22, h / 2 - 30); ctx.stroke();
      ctx.fillStyle = '#2f4443'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('kg', w / 2, h / 2 + 38);
    }, { clamp: true });
    var dial = H.plane(0.26, 0.26, new THREE.MeshBasicMaterial({ map: dialTex }), inG, 0.4, 1.15, 1.18);
    H.box(0.06, 0.06, 1.1, M.iron, inG, -Dp / 2 + 0.22, 2.2, -1.5);
    for (var bt = 0; bt < 3; bt++) {
      var boot = new THREE.Group();
      boot.position.set(-Dp / 2 + 0.27, 1.82, -2.0 + bt * 0.38);
      boot.rotation.y = Math.PI / 2;
      inG.add(boot);
      H.cyl(0.09, 0.1, 0.5, 8, H.toon(bt === 1 ? 0xd9d2b7 : 0x3e5d63), boot, 0, -0.22, 0);
      H.box(0.16, 0.12, 0.3, H.toon(bt === 1 ? 0xc9c2a7 : 0x355158), boot, 0, -0.5, 0.08);
      H.box(0.18, 0.05, 0.32, H.toon(0x2b2f2d), boot, 0, -0.57, 0.09);
      H.cyl(0.06, 0.06, 0.02, 8, M.iron, boot, 0, 0.1, 0);
    }
    var bb = H.signPlane(1.8, 1.35, T.blackboard, inG, -Dp / 2 + 0.19, 1.45, 0.6);
    bb.rotation.y = Math.PI / 2;
    H.box(0.06, 1.45, 1.9, M.woodDark, inG, -Dp / 2 + 0.13, 1.45, 0.6);
    H.box(0.12, 0.05, 1.2, M.woodDark, inG, -Dp / 2 + 0.26, 0.72, 0.6);
    for (var l = 0; l < 2; l++) {
      H.box(0.1, 0.02, 1.5, H.toon(0xd9dfd5), inG, -1.0 + l * 2.4, Hh - 0.35, 0);
      H.box(0.04, 0.25, 0.04, M.iron, inG, -1.0 + l * 2.4, Hh - 0.22, 0);
      var tube = H.box(0.14, 0.05, 1.35, H.emissive(0xf6ffe9), inG, -1.0 + l * 2.4, Hh - 0.4, 0);
    }
    // warm pendant lamps
    for (var pd = 0; pd < 2; pd++) {
      var px = -1.2 + pd * 2.6;
      H.cyl(0.012, 0.012, 0.95, 4, M.iron, inG, px, 2.55, -0.5);
      H.cyl(0.3, 0.17, 0.2, 10, H.toon(0x4b5d58), inG, px, 2.15, -0.5);
      H.sphere(0.085, H.emissive(0xffe7b2), inG, px, 2.04, -0.5);
    }
    var iceMat = new THREE.MeshBasicMaterial({ color: 0xd7efea, transparent: true, opacity: 0.85 });
    for (var i = 0; i < 14; i++) {
      var ice = H.box(H.rr(0.07, 0.2), H.rr(0.04, 0.1), H.rr(0.07, 0.2), iceMat, inG, H.rr(-2.6, 2.4), 0.23, H.rr(-3.9, 3.4));
      ice.rotation.y = H.rr(0, 3);
    }
    var wet = H.plane(4.6, 5.4, new THREE.MeshBasicMaterial({ color: 0x7da29d, transparent: true, opacity: 0.2, depthWrite: false }), inG, 0.2, 0.215, 0.2);
    wet.rotation.x = -Math.PI / 2;
    var sack = H.sphere(0.4, H.toon(0xc9c0a2), inG, 1.9, 0.45, 1.8, 8, 6);
    sack.scale.set(0.9, 1.1, 0.7);
    var sack2 = H.sphere(0.34, H.toon(0xb7ad8f), inG, 2.3, 0.36, 2.3, 8, 6);
    sack2.scale.set(0.8, 1, 0.7);
    H.cyl(0.03, 0.03, 1.7, 5, M.wood, inG, -2.9, 0.95, 1.2).rotation.z = 0.12;
    H.box(0.28, 0.4, 0.08, H.toon(0xc3ab74), inG, -3.0, 0.22, 1.2);
    H.cyl(0.01, 0.01, 0.9, 4, M.iron, inG, 1.4, 2.9, -1.2);
    var hook = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 8, Math.PI * 1.4), M.iron);
    hook.position.set(1.4, 2.4, -1.2); inG.add(hook);
  }

  // -----------------------------------------------------------------
  // waiting room (glass front)
  // -----------------------------------------------------------------
  function buildWaitingRoom(scene) {
    var g = new THREE.Group();
    g.position.set(12.6, 0, 14.4);
    scene.add(g);
    W.waitingRoom = g;
    var Wd = 5.4, Dp = 4.4, Hh = 3.3;
    var wallMat = H.toon(0xf1efe2);
    var gm = H.glass(0xd8f2ed, 0.14);

    var floor = H.box(Wd, 0.25, Dp, H.toon(0xffffff, { map: T.wood }), g, 0, 0.125, 0);
    floor.receiveShadow = true;
    H.box(2.0, 0.13, 0.55, M.concreteLight, g, 0.6, 0.065, Dp / 2 + 0.28);
    H.box(0.18, Hh, Dp, wallMat, g, -Wd / 2, Hh / 2, 0);
    H.box(Wd, Hh, 0.18, wallMat, g, 0, Hh / 2, -Dp / 2);
    var frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 0.3, Hh - 0.55), gm);
    frontGlass.position.set(0, 0.5 + (Hh - 0.55) / 2, Dp / 2 + 0.01);
    frontGlass.renderOrder = 23;
    g.add(frontGlass);
    var eastGlass = new THREE.Mesh(new THREE.PlaneGeometry(Dp - 0.3, Hh - 0.55), gm);
    eastGlass.rotation.y = Math.PI / 2;
    eastGlass.position.set(Wd / 2 - 0.01, 0.5 + (Hh - 0.55) / 2, 0);
    eastGlass.renderOrder = 23;
    g.add(eastGlass);
    var frameMat = M.ironLight;
    H.box(Wd, 0.12, 0.12, frameMat, g, 0, 0.44, Dp / 2);
    H.box(Wd, 0.12, 0.12, frameMat, g, 0, Hh - 0.06, Dp / 2);
    H.box(0.1, Hh, 0.1, frameMat, g, -Wd / 2 + 0.1, Hh / 2, Dp / 2);
    H.box(0.1, Hh, 0.1, frameMat, g, Wd / 2 - 0.1, Hh / 2, Dp / 2);
    for (var m = 1; m < 3; m++) {
      H.box(0.07, Hh, 0.07, frameMat, g, -Wd / 2 + m * Wd / 3, Hh / 2, Dp / 2);
    }
    H.box(0.12, 0.12, Dp, frameMat, g, Wd / 2, 0.44, 0);
    H.box(0.12, 0.12, Dp, frameMat, g, Wd / 2, Hh - 0.06, 0);
    H.box(0.12, Hh, 0.12, frameMat, g, Wd / 2, Hh / 2, -Dp / 2 + 0.1);
    H.box(0.12, Hh, 0.12, frameMat, g, Wd / 2, Hh / 2, Dp / 2 - 0.1);
    H.box(0.08, Hh - 0.6, 0.08, frameMat, g, Wd / 2, 0.5 + (Hh - 0.6) / 2, 0);
    H.box(1.1, 2.4, 0.08, frameMat, g, 1.3, 1.2, Dp / 2 + 0.02);
    var doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.2), H.glass(0xe4f8f4, 0.18));
    doorGlass.position.set(1.3, 1.2, Dp / 2 + 0.05);
    doorGlass.renderOrder = 24;
    g.add(doorGlass);
    H.box(0.03, 2.1, 0.05, M.iron, g, 0.86, 1.18, Dp / 2 + 0.09);
    var roof = H.box(Wd + 0.5, 0.18, Dp + 0.5, H.toon(0x7e9c98), g, 0, Hh + 0.09, 0);
    H.outline(roof, 0.0018);
    H.box(Wd + 0.6, 0.06, Dp + 0.6, H.toon(0x8faaa5), g, 0, Hh + 0.2, 0);
    H.box(Wd + 0.5, 0.3, 0.12, H.toon(0xa9bdb7), g, 0, Hh + 0.35, Dp / 2 + 0.25);
    // rooftop services
    var hr = Hh + 0.18;
    H.box(0.9, 0.42, 0.62, H.toon(0xd5ddd2), g, 1.35, hr + 0.21, -0.95);
    var hfan = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 4, 12), M.iron);
    hfan.rotation.x = Math.PI / 2; hfan.position.set(1.35, hr + 0.43, -0.95); g.add(hfan);
    H.cyl(0.17, 0.17, 0.02, 10, H.toon(0x3e4a48), g, 1.35, hr + 0.43, -0.95);
    H.cyl(0.09, 0.11, 1.15, 6, H.toon(0xbdc9c0), g, -1.8, hr + 0.58, -1.0);
    H.cyl(0.24, 0.08, 0.22, 6, H.toon(0xaebdb4), g, -1.8, hr + 1.18, -1.0);
    H.cyl(0.02, 0.03, 1.5, 4, M.iron, g, -0.4, hr + 0.75, -1.5);
    H.cyl(0.008, 0.01, 0.7, 4, M.iron, g, -0.4, hr + 1.35, -1.8).rotation.x = Math.PI / 2;
    var eave = H.box(2.3, 0.08, 1.1, H.toon(0xffffff, { map: T.corrugated }), g, 1.3, 2.95, Dp / 2 + 0.5);
    eave.rotation.x = 0.1;
    var st = H.textTexture([
      { text: '待 合 室', size: 96, color: '#f1ecdc', y: 96 },
      { text: 'WAITING  ROOM', size: 26, color: '#cfdad0', y: 160 }
    ], { w: 640, h: 200, bg: '#325f62', border: '#1f4448', borderWidth: 6 });
    H.signPlane(2.1, 0.66, st, g, 1.3, 2.62, Dp / 2 + 1.07);
    var bench = new THREE.Group();
    bench.position.set(-3.8, 0, 1.0);
    g.add(bench);
    for (var bl = 0; bl < 3; bl++) H.box(1.7, 0.06, 0.16, M.wood, bench, 0, 0.45 - bl * 0.14, -0.2 + bl * 0.02);
    H.box(0.08, 0.45, 0.5, M.iron, bench, -0.7, 0.22, 0);
    H.box(0.08, 0.45, 0.5, M.iron, bench, 0.7, 0.22, 0);
    var li = new THREE.PointLight(0xffe0b0, 0.8, 8, 2);
    li.position.set(0, 2.6, 0.4);
    g.add(li);
    buildWaitingInterior(g, Wd, Dp, Hh);
    lightShaft(g, {
      x: -1.0, y: 2.6, z: Dp / 2 + 0.3, width: 2.2, height: 3.8,
      rx: -0.75, rz: 0.4, opacity: 0.06
    });
  }

  function woodMatProp() { return H.toon(0xffffff, { map: T.wood }); }

  function buildWaitingInterior(g, Wd, Dp, Hh) {
    var inG = new THREE.Group();
    g.add(inG);
    H.plane(Wd - 0.4, Hh - 0.4, H.toon(0xe9e4d2), inG, 0, Hh / 2, -Dp / 2 + 0.11);
    var bench = new THREE.Group();
    bench.position.set(-0.9, 0, -Dp / 2 + 0.65);
    inG.add(bench);
    H.box(3.0, 0.08, 0.55, woodMatProp(), bench, 0, 0.55, 0);
    H.box(3.0, 0.5, 0.08, woodMatProp(), bench, 0, 0.9, -0.24);
    for (var i = 0; i < 3; i++) {
      H.box(2.9, 0.05, 0.14, woodMatProp(), bench, 0, 0.62 + i * 0.02, -0.16 + i * 0.15);
    }
    [-1.25, 1.25].forEach(function (lx) {
      H.box(0.08, 0.55, 0.5, M.iron, bench, lx, 0.27, 0);
    });
    H.signPlane(1.15, 1.55, T.timetable, inG, 1.5, 1.85, -Dp / 2 + 0.13);
    H.box(1.25, 1.65, 0.04, M.woodDark, inG, 1.5, 1.85, -Dp / 2 + 0.09);
    H.box(0.85, 0.06, 0.3, woodMatProp(), inG, -2.2, 1.2, -Dp / 2 + 0.28);
    var radioTex = H.tex(256, 160, function (ctx, w, h) {
      ctx.fillStyle = '#594a39'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9b486'; ctx.fillRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#3a3129'; ctx.fillRect(24, 24, 100, 90);
      ctx.strokeStyle = '#8b7355'; ctx.lineWidth = 2;
      for (var i2 = 0; i2 < 8; i2++) { ctx.beginPath(); ctx.moveTo(28, 32 + i2 * 10); ctx.lineTo(120, 32 + i2 * 10); ctx.stroke(); }
      ctx.fillStyle = '#e8ddbb'; ctx.beginPath(); ctx.arc(176, 64, 36, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#7d6a4d'; ctx.lineWidth = 2;
      for (var a2 = 0; a2 < 12; a2++) {
        var aa = a2 / 12 * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(176 + Math.cos(aa) * 26, 64 + Math.sin(aa) * 26);
        ctx.lineTo(176 + Math.cos(aa) * 31, 64 + Math.sin(aa) * 31); ctx.stroke();
      }
      ctx.strokeStyle = '#b5533d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(176, 64); ctx.lineTo(192, 44); ctx.stroke();
      ctx.fillStyle = '#4a3b2b'; ctx.fillRect(24, 124, 70, 12);
      ctx.fillStyle = '#cbbd97'; ctx.fillRect(108, 124, 110, 12);
    }, { clamp: true });
    var radio = H.mesh(new THREE.BoxGeometry(0.52, 0.3, 0.24), H.toon(0xffffff, { map: radioTex }), inG, -2.2, 1.39, -Dp / 2 + 0.28);
    H.outline(radio, 0.002, 0x2f2a21);
    H.box(0.7, 0.05, 0.45, woodMatProp(), inG, -2.2, 0.8, 1.8);
    H.cyl(0.03, 0.04, 0.75, 5, M.iron, inG, -2.2, 0.4, 1.8);
    var kettle = new THREE.Group();
    kettle.position.set(-2.15, 0.9, 1.8);
    inG.add(kettle);
    H.cyl(0.14, 0.16, 0.25, 12, H.toon(0xd8d3c2), kettle, 0, 0.12, 0);
    H.cyl(0.05, 0.06, 0.15, 8, H.toon(0xc9c3b0), kettle, 0, 0.3, 0);
    var spout = H.cyl(0.02, 0.035, 0.24, 6, H.toon(0xd8d3c2), kettle, 0.14, 0.2, 0);
    spout.rotation.z = -0.8;
    var handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 4, 10, Math.PI), M.iron);
    handle.position.set(0, 0.3, 0); handle.rotation.y = Math.PI / 2; kettle.add(handle);
    H.cyl(0.05, 0.045, 0.1, 10, H.toon(0xf0ecdf), inG, -1.8, 0.87, 1.6);
    var plant = new THREE.Group();
    plant.position.set(-2.3, 0, 0.75);
    inG.add(plant);
    H.cyl(0.2, 0.16, 0.3, 10, H.toon(0xb8755a), plant, 0, 0.15, 0);
    H.cyl(0.18, 0.18, 0.02, 10, H.toon(0x4a3b2b), plant, 0, 0.31, 0);
    for (var l = 0; l < 12; l++) {
      var a = l * 2.4;
      var leaf = H.sphere(0.13, H.toon(l % 2 ? 0x4d8a57 : 0x65a267), plant, Math.cos(a) * 0.22, 0.45 + (l % 4) * 0.1, Math.sin(a) * 0.22, 7, 5);
      leaf.scale.set(1.0, 0.22, 1.6);
      leaf.rotation.y = a;
      leaf.rotation.z = 0.4;
    }
    H.tube([new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0.1, 0.9, 0.1), new THREE.Vector3(0.3, 1.3, 0.2)], 0.015, H.toon(0x3f7250), plant, 8);
    var clockTex = H.tex(256, 256, function (ctx, w, h) {
      ctx.fillStyle = '#f4f0df'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 118, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#3d514f'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w / 2, h / 2, 114, 0, 6.283); ctx.stroke();
      ctx.fillStyle = '#3d514f'; ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif';
      for (var i2 = 0; i2 < 12; i2++) {
        var a2 = i2 / 12 * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a2) * 92, h / 2 + Math.sin(a2) * 92, 4, 0, 6.283); ctx.fill();
      }
      ctx.strokeStyle = '#2f4241'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + 38, h / 2 - 30); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 - 12, h / 2 - 68); ctx.stroke();
      ctx.fillStyle = '#b1463c'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 8, 0, 6.283); ctx.fill();
    }, { clamp: true });
    var clock = new THREE.Group();
    clock.position.set(-1.2, 2.45, -Dp / 2 + 0.18);
    clock.rotation.z = 0.10;
    inG.add(clock);
    var ck = H.cyl(0.34, 0.34, 0.07, 22, H.toon(0xffffff, { map: clockTex }), clock, 0, 0, 0);
    ck.rotation.x = Math.PI / 2;
    H.cyl(0.37, 0.37, 0.06, 22, H.toon(0x6c5844), clock, 0, 0, -0.02).rotation.x = Math.PI / 2;
    H.cyl(0.14, 0.16, 0.5, 10, H.toon(0x899a95), inG, 2.2, 0.25, 1.55);
    H.cyl(0.02, 0.02, 0.3, 4, M.iron, inG, 0, Hh - 0.15, 0);
    H.cyl(0.22, 0.28, 0.15, 10, H.toon(0xe6e1cf), inG, 0, Hh - 0.35, 0);
    H.sphere(0.11, H.emissive(0xffe6b0), inG, 0, Hh - 0.44, 0, 8, 6);
    H.signPlane(0.5, 0.7, T.poster, inG, 2.4, 2.1, -Dp / 2 + 0.13);
  }

  // -----------------------------------------------------------------
  // small storage shed near the hill
  // -----------------------------------------------------------------
  function buildShed(scene) {
    var g = new THREE.Group();
    g.position.set(-9.6, 0, -15.8);
    g.rotation.y = -0.12;
    scene.add(g);
    var Wd = 3.0, Dp = 2.4, Hh = 2.4;
    H.box(Wd, Hh, Dp, H.toon(0xdde3d8), g, 0, Hh / 2, 0);
    H.box(Wd + 0.3, 0.12, Dp + 0.3, H.toon(0xffffff, { map: T.corrugated }), g, 0, Hh + 0.06, 0);
    H.box(Wd + 0.4, 0.5, Dp + 0.4, H.toon(0xcbd5c9), g, 0, Hh + 0.25, 0);
    H.box(0.05, 1.7, 0.8, H.toon(0x6b7d78), g, Wd / 2 + 0.01, 0.85, 0.2);
    var rust = H.signPlane(Dp, Hh, T.rust, g, Wd / 2 + 0.03, Hh / 2, 0);
    rust.rotation.y = Math.PI / 2;
    rust.material.opacity = 0.3;
    H.outline(g.children[0], 0.002);
    return g;
  }

  // -----------------------------------------------------------------
  H.buildBuildings = function (scene) {
    ready();
    buildWarehouse(scene);
    buildWaitingRoom(scene);
    buildShed(scene);
  };
  H.lightShaft = lightShaft;

})(window.H);
