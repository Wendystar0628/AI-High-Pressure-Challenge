// 地图设施建模：每种障碍对应现实用途，三张地图的环境设施互不相同。
(function (root) {
  const TD = root.TD = root.TD || {};
  const THREE = root.THREE;
  const { Mesher, C } = TD.Gfx;

  const addAnimMesh = (w, geo, mat, x, y, z, fn, shadow) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    w.group.add(m);
    if (fn) w.anims.push((t, dt) => fn(m, t, dt));
    return m;
  };

  const fanGeo = (() => { let g; return () => { if (g) return g; const m = new Mesher(); m.cyl(0, 0, 0, 0.1, 0.1, 0.08, 8, 0x30343c, {}); for (let i = 0; i < 5; i++) { const a = i * 1.2566; m.box(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42, 0.62, 0.02, 0.2, 0xb6bcc6, { ry: -a + 0.3, rz: 0.2 }); } g = m.geometry(); return g; }; })();

  const F = TD.Facilities = {
    // ───────── 分段内网 ─────────
    dmz(w, r) {
      const B = w.B, { cx, cz } = r, W = r.w - 0.5, D = r.d - 0.5, th = w.th;
      B.metal.box(cx, 0.15, cz, W + 0.2, 0.5, D + 0.2, C(th.steel, 1.3), { bevel: 0.08, uv: 0.3 });
      B.glow.box(cx, 0.42, cz - D / 2 - 0.08, W, 0.04, 0.04, C(th.plateEdge, 1.5), {});
      B.glow.box(cx, 0.42, cz + D / 2 + 0.08, W, 0.04, 0.04, C(th.plateEdge, 1.5), {});
      // 三列防火区机柜
      for (let k = -1; k <= 1; k++) {
        B.rack.box(cx + k * W / 3.4, 1.3, cz, 1.0, 1.8, D - 1.4, C(0xe2ecf5), { uv: 0.42 });
        B.metal.box(cx + k * W / 3.4, 2.26, cz, 1.05, 0.12, D - 1.2, C(0x8796a5), { bevel: 0.03 });
      }
      B.glass.box(cx, 1.5, cz, W - 0.1, 2.5, D - 0.1, C(0xB6D8D0), {});
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.metal.box(cx + sx * (W / 2 - 0.06), 1.5, cz + sz * (D / 2 - 0.06), 0.14, 2.6, 0.14, C(0xd9d2bd), {});
      B.metal.box(cx, 2.85, cz, W + 0.1, 0.16, D + 0.1, C(0x7D8A8A), { bevel: 0.05 });
      F._roof(w, cx, 2.93, cz, W + 0.1, D + 0.1, 'none');
      B.vent.box(cx - W / 4, 3.1, cz, 1.6, 0.4, 1.6, C(0x8fa0ac), { bevel: 0.04 });
      B.metal.cyl(cx + W / 4, 3.25, cz + 0.6, 0.5, 0.55, 0.7, 12, C(0xa9b4bf), {});
      B.glow.cyl(cx + W / 4, 3.62, cz + 0.6, 0.42, 0.42, 0.04, 12, C(th.plateEdge, 1.8), {});
    },
    desk(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.plate.box(cx, 0.55, cz, r.w - 0.2, 0.4, r.d - 0.2, C(0xc9b89a), { uv: 0.5, bevel: 0.04 });
      B.metal.box(cx, 0.0, cz, r.w - 0.4, 0.8, r.d - 0.4, C(th.plateSide), {});
      for (let i = 0; i < 4; i++) {
        const x = cx - r.w / 2 + 0.72 + i * ((r.w - 1.44) / 3), z = cz;
        B.paint.box(x, 1.05, z, 0.72, 0.05, 0.6, C(0xf0e8d8), {});
        B.metal.box(x, 0.88, z, 0.06, 0.34, 0.5, C(0x7a8086), {});
        B.paint.box(x, 1.32, z - 0.18, 0.5, 0.32, 0.03, C(0x12161c), {});
        B.glow.box(x, 1.32, z - 0.16, 0.44, 0.26, 0.01, C(i % 2 ? 0x8FD8D0 : 0xF0CF94, 1.6), {});
        B.paint.box(x + 0.42, 1.16, z, 0.06, 0.56, 0.86, C(0xC8683E), {});
      }
    },
    rack(w, r) {
      const B = w.B, { cx, cz } = r;
      for (let i = 0; i < r.nx * 2; i++) {
        const x = cx - r.w / 2 + 0.5 + i * ((r.w - 1) / Math.max(1, r.nx * 2 - 1));
        B.rack.box(x, 1.2, cz, 0.72, 2.4, r.d - 0.5, C(0xE8EEE8), { uv: 0.36 });
        B.metal.box(x, 2.44, cz, 0.78, 0.1, r.d - 0.4, C(0x5f6f7d), {});
      }
      B.metal.box(cx, 2.75, cz, r.w - 0.3, 0.08, 0.32, C(0xC9964A), {});
    },
    legacyrack(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.metal.box(cx, 0.1, cz, r.w - 0.3, 0.6, r.d - 0.3, C(th.steel, 1.1), { bevel: 0.08, uv: 0.3 });
      for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) {
        const x = cx + (i - 1) * (r.w - 1.2) / 3, z = cz + (j - 0.5) * (r.d - 1.6) / 1.4;
        B.paint.box(x, 1.25, z, 1.3, 1.8, 1.0, C(0xd0c6a6), { bevel: 0.06 });
        B.paint.box(x, 1.8, z + 0.51, 1.1, 0.5, 0.02, C(0x38403e), {});
        B.glow.box(x - 0.3, 1.82, z + 0.525, 0.4, 0.28, 0.01, C(0x8FD89A, 1.2), {});
        for (let k = 0; k < 2; k++) {
          const rx = x - 0.28 + k * 0.56, rz = z + 0.53;
          B.metal.cyl(rx, 1.0, rz, 0.2, 0.2, 0.03, 16, C(0x2a2a2a), { rx: Math.PI / 2 });
          addAnimMesh(w, reelGeo(), w.M.paint, rx, 1.0, rz + 0.02, (m, t) => { m.rotation.z = t * (k ? 1.8 : 1.1); });
        }
      }
    },
    drsite(w, r) {
      const B = w.B, { cx, cz } = r, W = r.w - 0.4, D = r.d - 0.4;
      B.concrete.box(cx, 0.2, cz, W + 0.2, 0.7, D + 0.2, C(0x9aa3a8), { uv: 0.2, bevel: 0.08 });
      B.window.box(cx, 2, cz, W, 3, D, C(0xCADBD6), { uv: 0.14 });
      B.plate.box(cx, 3.6, cz, W + 0.25, 0.22, D + 0.25, C(0x707C7C), { bevel: 0.06, uv: 0.3 });
      for (const s of [-1, 1]) { B.metal.box(cx + s * (W / 2 + 0.05), 3.8, cz, 0.12, 0.2, D + 0.2, C(0xc0b8a4), {}); B.metal.box(cx, 3.8, cz + s * (D / 2 + 0.05), W + 0.2, 0.2, 0.12, C(0xc0b8a4), {}); }
      for (let i = 0; i < r.nx; i++) {
        const x = cx - W / 2 + (i + 0.5) * W / r.nx, z = cz - D / 4;
        B.metal.cyl(x, 4.0, z, 0.7, 0.75, 0.6, 16, C(0x9aa6ad), { open: true });
        B.paint.cyl(x, 3.75, z, 0.68, 0.68, 0.04, 16, C(0x1d2124), {});
        addAnimMesh(w, fanGeo(), w.M.paint, x, 4.02, z, (m, t) => { m.rotation.y = t * 7 + i; }).scale.setScalar(1.25);
      }
      B.vent.box(cx, 4.0, cz + D / 4, W - 1, 0.5, 1.4, C(0xa7b2b8), { bevel: 0.05 });
      B.glow.box(cx, 3.47, cz + D / 2 + 0.02, W - 0.3, 0.05, 0.03, C(0x8FD8AE, 1.6), {});
    },
    drsite2(w, r) {
      const B = w.B, { cx, cz } = r;
      B.metal.box(cx, 0.05, cz, r.w - 0.3, 0.5, r.d - 0.3, C(w.th.steel, 1.1), { bevel: 0.06, uv: 0.3 });
      const n = Math.max(2, r.nx);
      for (let i = 0; i < n; i++) {
        const x = cx - r.w / 2 + (i + 0.5) * r.w / n;
        const c = i % 2 ? 0xe9e4d3 : 0xC8683E;
        B.paint.box(x, 1.05, cz - 0.6, r.w / n - 0.5, 1.5, 1.5, C(c), { bevel: 0.07 });
        B.vent.box(x, 1.05, cz + 0.15, r.w / n - 0.8, 1.1, 0.05, C(0x8d8f90), {});
        B.glow.box(x - 0.3, 1.65, cz + 0.17, 0.2, 0.08, 0.01, C(0x86D8AE, 2), {});
      }
      B.metal.cyl(cx, 0.55, cz + 1.0, 0.2, 0.2, r.w - 1, 10, C(0xa18663), { rz: Math.PI / 2 });
    },
    portal(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.metal.box(cx, 0.2, cz, r.w - 0.3, 0.8, r.d - 0.3, C(th.steel, 1.2), { bevel: 0.1, uv: 0.3 });
      B.window.box(cx - 1.6, 3.0, cz, 2.8, 5, 2.6, C(0xD5E6E0), { uv: 0.14, bevel: 0.05 });
      B.window.box(cx + 1.4, 2.2, cz, 3.0, 3.4, 2.4, C(0xD5E6E0), { uv: 0.14, bevel: 0.05 });
      B.plate.box(cx + 1.4, 4.0, cz, 3.2, 0.18, 2.6, C(0x8A9490), { bevel: 0.05 });
      B.plate.box(cx - 1.6, 5.6, cz, 3.0, 0.2, 2.8, C(0x8A9490), { bevel: 0.05 });
      F._roof(w, cx - 1.6, 5.7, cz, 3.0, 2.8, 'solar');
      F._roof(w, cx + 1.4, 4.09, cz, 3.2, 2.6, 'none');
      B.metal.cyl(cx + 1.4, 4.6, cz, 0.08, 0.14, 1.0, 8, C(0xb9c2cb), {});
      // 全息地球（门户网站）
      const m = new Mesher();
      for (let i = 0; i < 3; i++) m.torus(0, 0, 0, 0.82, 0.018, C(th.linkEdge), { glow: 2.2, ry: i * 1.05, seg: 32 });
      m.torus(0, 0, 0, 0.82, 0.018, C(th.linkEdge), { glow: 2.2, rx: Math.PI / 2, seg: 32 });
      for (const y of [-0.42, 0.42]) m.torus(0, y, 0, 0.7, 0.014, C(th.linkEdge), { glow: 1.6, rx: Math.PI / 2, seg: 28 });
      addAnimMesh(w, m.geometry(), w.M.glow, cx + 1.4, 5.8, cz, (o, t) => { o.rotation.y = t * 0.6; });
    },
    mail(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.metal.box(cx, 0.2, cz, r.w - 0.3, 0.8, r.d - 0.3, C(th.steel, 1.2), { bevel: 0.1, uv: 0.3 });
      B.rack.box(cx - 1.8, 1.8, cz, 2.0, 2.4, 2.4, C(0xf2f2ea), { uv: 0.3, bevel: 0.05 });
      B.plate.box(cx + 1.0, 1.5, cz, 3.0, 1.9, 2.5, C(0xD9C08E), { bevel: 0.08, uv: 0.3 });
      B.plate.box(cx + 1.0, 2.6, cz, 3.2, 0.2, 2.7, C(0x96867a), { bevel: 0.05, uv: 0.3 });
      F._roof(w, cx + 1.0, 2.7, cz, 3.2, 2.7, 'none');
      B.metal.box(cx + 1.0, 1.2, cz + 1.28, 2.2, 0.8, 0.05, C(0x2c3640), {});
      B.glow.box(cx + 1.0, 1.65, cz + 1.28, 2.2, 0.06, 0.04, C(0xE8C47A, 2), {});
      // 飘过的邮件（全息信封）
      const env = new Mesher();
      env.box(0, 0, 0, 0.62, 0.02, 0.42, C(0xF2E6C8), { glow: 1.5 });
      env.box(-0.15, 0.015, 0, 0.36, 0.01, 0.03, C(0xD29A4A), { glow: 1.5, ry: 0.5 });
      env.box(0.15, 0.015, 0, 0.36, 0.01, 0.03, C(0xD29A4A), { glow: 1.5, ry: -0.5 });
      const eg = env.geometry();
      for (let i = 0; i < 4; i++) {
        addAnimMesh(w, eg, w.M.glow, cx, 3.2, cz, (o, t) => {
          const u = (t * 0.22 + i * 0.25) % 1;
          o.position.set(cx - 2.5 + u * 5, 2.9 + Math.sin(u * 6.28) * 0.5 + i * 0.2, cz + Math.cos(i * 2) * 0.8);
          o.rotation.y = u * 3; o.rotation.x = Math.sin(u * 6.28) * 0.4;
          o.scale.setScalar(Math.sin(u * 3.14) * 1.1 + 0.05);
        });
      }
    },
    // 屋顶设备：空调机组、光伏板、停机坪、女儿墙
    _roof(w, cx, y, cz, W, D, kind) {
      const B = w.B, th = w.th;
      for (const s of [-1, 1]) {
        B.metal.box(cx + s * (W / 2 - 0.05), y + 0.09, cz, 0.1, 0.18, D, C(th.steel, 1.35), {});
        B.metal.box(cx, y + 0.09, cz + s * (D / 2 - 0.05), W, 0.18, 0.1, C(th.steel, 1.35), {});
      }
      if (kind === 'heli') {
        B.paint.cyl(cx, y + 0.02, cz, Math.min(W, D) * 0.38, Math.min(W, D) * 0.38, 0.03, 24, C(0x39424c), {});
        B.glow.torus(cx, y + 0.045, cz, Math.min(W, D) * 0.36, 0.018, C(th.plateEdge, 1.6), { rx: Math.PI / 2, seg: 32 });
        const k = Math.min(W, D) * 0.14;
        B.paint.box(cx - k * 0.6, y + 0.04, cz, k * 0.22, 0.01, k * 1.5, C(0xf2f2ea), {});
        B.paint.box(cx + k * 0.6, y + 0.04, cz, k * 0.22, 0.01, k * 1.5, C(0xf2f2ea), {});
        B.paint.box(cx, y + 0.04, cz, k * 1.2, 0.01, k * 0.22, C(0xf2f2ea), {});
      } else if (kind === 'solar') {
        const nx = Math.max(2, Math.floor((W - 0.5) / 0.7)), nz = Math.max(1, Math.floor((D - 0.5) / 0.9));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          const x = cx - (nx - 1) * 0.35 + i * 0.7, z = cz - (nz - 1) * 0.45 + j * 0.9;
          B.paint.box(x, y + 0.13, z, 0.62, 0.03, 0.72, C(0x1b2f58), { rx: 0.3 });
          B.glow.box(x, y + 0.155, z, 0.58, 0.004, 0.02, C(0x7FAFD8, 0.8), { rx: 0.3 });
          B.metal.box(x, y + 0.05, z, 0.05, 0.12, 0.05, C(th.steel), {});
        }
      } else {
        const n = Math.max(1, Math.floor(W / 1.3));
        for (let i = 0; i < n; i++) {
          const x = cx - W / 2 + (i + 0.5) * W / n;
          B.vent.box(x, y + 0.2, cz - D * 0.2, Math.min(0.9, W / n - 0.2), 0.34, 0.7, C(0x9aa4ac), { bevel: 0.02 });
          B.metal.cyl(x, y + 0.12, cz + D * 0.22, 0.17, 0.2, 0.2, 10, C(0xb4bcc4), {});
        }
        B.metal.box(cx, y + 0.06, cz + D * 0.05, W - 0.5, 0.05, 0.08, C(th.plateEdge, 0.75), {});
      }
    },
    tower(w, r) { F._office(w, r, 8.5, 0xCBDDD8); },
    tower2(w, r) { F._office(w, r, 6.2, 0xD8E2D4); },
    _office(w, r, h, tint) {
      const B = w.B, { cx, cz } = r, th = w.th, W = r.w - 0.8, D = r.d - 0.8;
      B.metal.box(cx, 0.1, cz, r.w - 0.3, 0.6, r.d - 0.3, C(th.steel, 1.2), { bevel: 0.08, uv: 0.3 });
      B.window.box(cx, 0.4 + h * 0.3, cz, W, h * 0.6, D, C(tint), { uv: 0.16, bevel: 0.03 });
      B.plate.box(cx, 0.4 + h * 0.61, cz, W + 0.15, 0.14, D + 0.15, C(0x7D8A8A), { bevel: 0.04 });
      B.window.box(cx - 0.2, 0.4 + h * 0.82, cz + 0.1, W * 0.68, h * 0.38, D * 0.7, C(tint), { uv: 0.16, bevel: 0.03 });
      B.plate.box(cx - 0.2, 0.4 + h * 1.02, cz + 0.1, W * 0.72, 0.14, D * 0.74, C(0x8A9490), { bevel: 0.04 });
      F._roof(w, cx - 0.2, 0.4 + h * 1.02 + 0.07, cz + 0.1, W * 0.72, D * 0.74, 'heli');
      F._roof(w, cx, 0.4 + h * 0.61 + 0.07, cz, W + 0.15, D + 0.15, 'none');
      B.metal.cyl(cx - 0.2, 0.4 + h * 1.02 + 0.7, cz + 0.1, 0.03, 0.06, 1.4, 6, C(0xc0c6cc), {});
      B.glow.sph(cx - 0.2, 0.4 + h * 1.02 + 1.45, cz + 0.1, 0.08, C(th.plateEdge, 3), { seg: 8 });
      B.glow.box(cx, 0.72, cz + D / 2 + 0.01, W - 0.5, 0.05, 0.02, C(th.plateEdge, 1.5), {});
    },
    cable(w, r) {
      const B = w.B, { cx, cz } = r;
      for (let i = 0; i < 3; i++) {
        const c = [0x3F9F92, 0xC8683E, 0x4F7FB8][i];
        B.paint.cyl(cx, -0.1 + i * 0.03, cz - 0.28 + i * 0.28, 0.1, 0.1, r.w, 8, C(c), { rz: Math.PI / 2 });
      }
      B.metal.box(cx, -0.3, cz, r.w, 0.14, 1.1, C(w.th.under, 1.6), { uv: 0.3, world: true });
    },
    vault() {},

    // ───────── 骨干流域 ─────────
    flow(w, r) {
      const W = 520, th = w.th;
      const geo = new THREE.PlaneGeometry(W, r.d - 0.3, 160, 12);
      const mat = new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
        uniforms: { uTime: w.uTime, a: { value: new THREE.Color(th.nebula2) }, b: { value: new THREE.Color(th.nebula) }, c: { value: new THREE.Color(0xF2F5FF) } },
        vertexShader: `varying vec2 vU; varying float vH; uniform float uTime; void main(){ vU=uv; vec3 p=position; float s=sin(p.x*.18+uTime*1.6)*.12+sin(p.x*.05-uTime*.7+p.y*.8)*.2; p.z+=s; vH=s; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);} `,
        fragmentShader: `varying vec2 vU; varying float vH; uniform float uTime; uniform vec3 a,b,c;
          float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
          void main(){ vec2 uv=vec2(vU.x*260.-uTime*1.6,vU.y*14.);
            float lane=floor(uv.y); float spd=1.+h(vec2(lane,1.))*3.2; float x=uv.x*.4+uTime*(-spd*.8)+h(vec2(lane,2.))*50.;
            float cell=floor(x); float f=fract(x);
            float on=step(.42,h(vec2(cell,lane)));
            float dash=on*smoothstep(.0,.04,f)*smoothstep(1.,.5,f);
            float thin=smoothstep(.5,.12,abs(fract(uv.y)-.5));
            vec3 col=mix(a,b,smoothstep(.2,.9,vU.y+sin(vU.x*40.+uTime*.4)*.14));
            float edge=smoothstep(0.,.1,vU.y)*smoothstep(1.,.9,vU.y);
            vec3 outc=col*.3*edge+col*dash*thin*1.0+c*dash*thin*thin*.16+vec3(vH*.4)*col;
            gl_FragColor=vec4(outc,.86*edge+.06);
}`,
      });
      const river = new THREE.Mesh(geo, mat);
      river.rotation.x = -Math.PI / 2;
      river.position.set(0, -1.15, r.cz);
      river.renderOrder = 1;
      w.group.add(river);
      // 河床与堤岸
      const B = w.B;
      B.metal.box(0, -2.1, r.cz, 300, 0.4, r.d + 0.6, C(0x0C1530), { uv: 0.1, world: true });
      for (const s of [-1, 1]) {
        const z = r.cz + s * (r.d / 2 + 0.05);
        for (let i = 0; i < w.w + 22; i++) {
          const x = (i - (w.w + 22) / 2) * 2 + 1;
          const tx = Math.round((x / 2) + (w.w - 1) / 2);
          if (w.isRoad(tx, s < 0 ? r.y0 - 1 : r.y1 + 1) && w.isRoad(tx, s < 0 ? r.y0 : r.y1)) continue;
          B.metal.box(x, -0.55, z, 1.98, 1.3, 0.34, C(th.steel, 1.25), { uv: 0.4, world: true, bevel: 0.03 });
          if (i % 2) B.glow.box(x, -0.2, z - s * 0.18, 1.5, 0.05, 0.02, C(th.nebula2, 1.5), {});
        }
      }
      // 公网流中奔涌的数据包
      const cnt = w.quality === 'low' ? 60 : 170;
      const g = new THREE.BoxGeometry(1, 0.16, 0.26);
      const pk = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }), cnt);
      pk.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cnt * 3), 3);
      const ph = [];
      const co = new THREE.Color();
      for (let i = 0; i < cnt; i++) {
        ph.push({ u: Math.random(), z: (Math.random() - 0.5) * (r.d - 1), sp: 8 + Math.random() * 18, y: -1.05 + Math.random() * 0.25, l: 0.8 + Math.random() * 1.8 });
        co.set(i % 3 ? th.nebula2 : th.nebula).multiplyScalar(0.9 + Math.random() * 0.5);
        pk.setColorAt(i, co);
      }
      pk.frustumCulled = false;
      w.group.add(pk);
      const d = new THREE.Object3D();
      w.anims.push((t) => {
        for (let i = 0; i < cnt; i++) {
          const p = ph[i];
          d.position.set((((p.u * 260 + t * p.sp) % 260) - 130), p.y, r.cz + p.z);
          d.scale.set(p.l, 1, 1);
          d.updateMatrix();
          pk.setMatrixAt(i, d.matrix);
        }
        pk.instanceMatrix.needsUpdate = true;
      });
    },
    router(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th, W = r.w - 0.4, D = r.d - 0.4;
      B.metal.box(cx, 0.1, cz, W + 0.2, 0.6, D + 0.2, C(th.steel, 1.2), { bevel: 0.06, uv: 0.3 });
      B.rack.box(cx, 1.4, cz, W, 2, D, C(0xC2CBE6), { uv: 0.28, bevel: 0.04 });
      B.metal.box(cx, 2.48, cz, W + 0.1, 0.16, D + 0.1, C(0x5F6F96), { bevel: 0.05 });
      const n = Math.max(2, r.nx);
      for (let i = 0; i < n; i++) {
        const x = cx - W / 2 + (i + 0.5) * W / n;
        B.metal.cyl(x, 2.7, cz, 0.45, 0.48, 0.3, 14, C(0x7587A8), { open: true });
        B.glow.cyl(x, 2.57, cz, 0.42, 0.42, 0.03, 14, C(th.nebula, 1.2), {});
        addAnimMesh(w, fanGeo(), w.M.paint, x, 2.72, cz, (m, t) => { m.rotation.y = -t * 8 + i; }).scale.setScalar(0.9);
      }
    },
    dish(w, r) { F._dish(w, r, 1); },
    dish2(w, r) { F._dish(w, r, 0.8); },
    _dish(w, r, sc) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.metal.box(cx, 0.05, cz, r.w - 0.5, 0.5, r.d - 0.5, C(th.steel, 1.15), { bevel: 0.1, uv: 0.3 });
      const n = r.nx >= 4 || r.ny >= 4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const ox = n === 2 ? (r.nx >= r.ny ? (i - 0.5) * r.w * 0.5 : 0) : 0, oz = n === 2 ? (r.nx >= r.ny ? 0 : (i - 0.5) * r.d * 0.5) : 0;
        const px = cx + ox, pz = cz + oz;
        B.metal.cyl(px, 1.3, pz, 0.26, 0.5, 2.3, 8, C(0xC4CCD8), {});
        const m = new Mesher();
        const pts = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([t * 1.8 * sc, t * t * 0.7 * sc]); }
        m.lathe(0, 0, 0, pts, 28, C(0xE8ECF2), {});
        m.cyl(0, 0.75 * sc, 0, 0.02, 0.03, 1.5 * sc, 6, C(0x76829A), {});
        m.sph(0, 1.5 * sc, 0, 0.11, C(th.nebula), { glow: 3, seg: 8 });
        m.torus(0, 0.7 * sc, 0, 1.8 * sc, 0.03, C(th.nebula2), { rx: Math.PI / 2, glow: 1.6, seg: 32 });
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide });
        TD.Gfx.patchMaterial(mat);
        const dish = addAnimMesh(w, m.geometry(), mat, px, 2.6, pz, (o, t) => { o.rotation.y = t * 0.11 + i; o.rotation.z = 0.7 + Math.sin(t * 0.2 + i) * 0.1; }, true);
        dish.rotation.order = 'YXZ';
      }
    },
    cloud(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.metal.box(cx, 0.1, cz, r.w - 0.3, 0.6, r.d - 0.3, C(th.steel, 1.2), { bevel: 0.08, uv: 0.3 });
      const n = r.nx;
      for (let i = 0; i < n; i++) {
        const x = cx - r.w / 2 + (i + 0.5) * r.w / n;
        const hh = 1.6 + (i % 3) * 0.6;
        B.rack.box(x, 0.4 + hh / 2, cz, 1.3, hh, 2.4, C(0xCBD3EA), { uv: 0.28, bevel: 0.03 });
        B.metal.box(x, 0.46 + hh, cz, 1.36, 0.1, 2.46, C(th.steel, 1.3), { bevel: 0.02 });
        B.vent.box(x, 0.53 + hh, cz - 0.55, 0.9, 0.06, 0.9, C(0x8B97B4), {});
        for (const s of [-0.34, 0.34]) B.glow.box(x + s, 0.53 + hh, cz + 0.55, 0.05, 0.02, 0.9, C(th.nebula2, 1.2), {});
      }
      // 体素云团：云端互联的全息标识，由一个个小方块组成
      const m = new Mesher();
      const puffs = [[-3, 0, 0, 1.2], [-1.5, 0.35, 0.2, 1.5], [0.3, 0.6, -0.1, 1.8], [2.1, 0.25, 0.1, 1.4], [3.5, 0, 0, 1.0]];
      let sd = 17;
      const rd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      for (const p of puffs) {
        const n = Math.floor(p[3] * 22);
        for (let i = 0; i < n; i++) {
          const a = rd() * 6.283, b = Math.acos(rd() * 2 - 1), rr = p[3] * (0.72 + rd() * 0.3);
          const x = p[0] + Math.sin(b) * Math.cos(a) * rr, y = p[1] + Math.abs(Math.cos(b)) * rr * 0.72, z = p[2] + Math.sin(b) * Math.sin(a) * rr * 0.7;
          const q = 0.16 + rd() * 0.16;
          m.box(Math.round(x * 3) / 3, Math.round(y * 3) / 3, Math.round(z * 3) / 3, q, q, q, C(rd() < 0.2 ? th.nebula : th.nebula2, 0.65 + rd() * 0.45), {});
        }
      }
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
      addAnimMesh(w, m.geometry(), mat, cx, 4.6, cz, (o, t) => { o.position.y = 4.6 + Math.sin(t * 0.6) * 0.2; o.rotation.y = Math.sin(t * 0.2) * 0.12; });
      // 上行数据流
      for (let i = 0; i < 5; i++) {
        const lx = cx - 3.2 + i * 1.6;
        B.glowAdd.box(lx, 3.2, cz, 0.05, 2.4, 0.05, C(th.nebula2, 0.5), {});
        const pulse = new Mesher();
        pulse.box(0, 0, 0, 0.1, 0.42, 0.1, C(th.nebula2, 1.5), {});
        addAnimMesh(w, pulse.geometry(), w.M.glow, lx, 2, cz, (o, t) => { o.position.y = 2.0 + ((t * 1.1 + i * 0.37) % 1) * 2.6; });
      }
    },
    isp(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.metal.box(cx, 0.1, cz, r.w - 0.3, 0.6, r.d - 0.3, C(th.steel, 1.2), { bevel: 0.08, uv: 0.3 });
      const n = r.nx;
      const cols = [0x7FC8E8, 0xB89AE0, 0xE8C66E, 0x8FD8A8, 0xA99BE8];
      for (let i = 0; i < n; i++) {
        const x = cx - r.w / 2 + (i + 0.5) * r.w / n;
        B.rack.box(x, 1.5, cz - 0.4, 1.4, 2.2, 1.5, C(0xC4CCE4), { uv: 0.3, bevel: 0.03 });
        B.paint.box(x, 2.68, cz - 0.4, 1.46, 0.14, 1.56, C(0x3E4C6C), {});
        B.vent.box(x, 2.78, cz - 0.4, 1.0, 0.06, 1.0, C(0x8B97B4), {});
        // 光纤跳线束
        const m = cols[i % cols.length];
        B.glow.torus(x, 2.1, cz + 0.42, 0.42, 0.018, C(m, 1.6), { arc: Math.PI, seg: 14 });
        B.glow.torus(x + 0.08, 2.1, cz + 0.46, 0.34, 0.018, C(cols[(i + 2) % 5], 1.6), { arc: Math.PI, seg: 14 });
      }
      B.metal.cyl(cx, 4.2, cz + 0.8, 0.06, 0.22, 6, 8, C(0xB8C0D0), {});
      for (let k = 0; k < 3; k++) B.metal.box(cx, 2.6 + k * 1.2, cz + 0.8, 1.6 - k * 0.32, 0.05, 0.05, C(0xB8C0D0), {});
      B.glow.sph(cx, 7.3, cz + 0.8, 0.13, C(th.nebula, 3), { seg: 8 });
    },
    dcx(w, r) { F._dc(w, r, 0x8FC8F0); },
    dcm(w, r) {
      // 骨干汇聚机房：长条机架 + 液冷管 + 天窗
      const B = w.B, { cx, cz } = r, th = w.th, W = r.w - 0.5, D = r.d - 0.5;
      B.metal.box(cx, 0.1, cz, W + 0.2, 0.7, D + 0.2, C(th.steel, 1.25), { bevel: 0.08, uv: 0.3 });
      const nrow = 3;
      for (let k = 0; k < nrow; k++) {
        const z = cz - D / 2 + (k + 0.5) * D / nrow;
        B.rack.box(cx, 1.45, z, W - 0.6, 2.0, D / nrow - 0.55, C(0xCCD4EA), { uv: 0.24, bevel: 0.04 });
        B.metal.box(cx, 2.52, z, W - 0.4, 0.14, D / nrow - 0.4, C(0x6A7CA6), { bevel: 0.03 });
        B.glow.box(cx, 2.6, z, W - 1, 0.03, 0.08, C(k % 2 ? th.nebula : th.nebula2, 1.4), {});
      }
      for (const s of [-1, 1]) {
        B.metal.cyl(cx + s * (W / 2 - 0.2), 2.0, cz, 0.28, 0.32, 3.2, 12, C(0xBCC6E0), {});
        B.glow.torus(cx + s * (W / 2 - 0.2), 3.6, cz, 0.3, 0.03, C(th.nebula2, 2), { rx: Math.PI / 2, seg: 14 });
      }
      B.metal.cyl(cx, 3.0, cz, 0.12, 0.12, W - 0.6, 10, C(0xC08A3A), { rz: Math.PI / 2 });
      B.metal.cyl(cx, 3.0, cz - 0.3, 0.12, 0.12, W - 0.6, 10, C(0x4F8FC8), { rz: Math.PI / 2 });
    },
    dcy(w, r) { F._dc(w, r, 0xB8A8E8); },
    _dc(w, r, accent) {
      const B = w.B, { cx, cz } = r, th = w.th, W = r.w - 0.4, D = r.d - 0.4;
      B.metal.box(cx, 0.1, cz, W + 0.2, 0.7, D + 0.2, C(th.steel, 1.2), { bevel: 0.08, uv: 0.3 });
      B.rack.box(cx, 1.7, cz, W, 2.5, D, C(0xD2D8EA), { uv: 0.2, bevel: 0.04 });
      B.plate.box(cx, 3.05, cz, W + 0.2, 0.2, D + 0.2, C(0x5A6A8E), { bevel: 0.06, uv: 0.25 });
      B.glow.box(cx, 2.9, cz - D / 2 - 0.02, W - 0.3, 0.06, 0.03, C(accent, 2), {});
      const nx = Math.max(1, Math.floor(W / 2.2));
      for (let i = 0; i < nx; i++) {
        const x = cx - W / 2 + (i + 0.5) * W / nx;
        B.metal.cyl(x, 3.42, cz, 0.72, 0.76, 0.56, 16, C(0x7E8CA8), { open: true });
        B.paint.cyl(x, 3.2, cz, 0.7, 0.7, 0.03, 16, C(0x0E1528), {});
        addAnimMesh(w, fanGeo(), w.M.paint, x, 3.42, cz, (m, t) => { m.rotation.y = t * 6 + i * 2; }).scale.setScalar(1.3);
        B.glow.torus(x, 3.72, cz, 0.74, 0.015, C(accent, 1.8), { rx: Math.PI / 2, seg: 20 });
      }
    },
    fiber(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.metal.box(cx, -0.2, cz, r.w - 0.3, 0.3, r.d - 0.3, C(th.under, 1.8), { uv: 0.25, world: true });
      const cols = [th.nebula, th.nebula2, 0xE8C66E];
      const n = Math.max(2, Math.floor(r.d / 1.1));
      for (let i = 0; i < n; i++) {
        const z = cz - r.d / 2 + (i + 0.5) * r.d / n;
        B.paint.cyl(cx, 0.08, z, 0.16, 0.16, r.w - 0.6, 8, C(0x1E2A44), { rz: Math.PI / 2 });
        B.glow.box(cx, 0.26, z, r.w - 0.7, 0.03, 0.05, C(cols[i % 3], 1.4), {});
      }
      for (let i = 0; i < Math.floor(r.w / 3); i++) {
        const x = cx - r.w / 2 + 1.4 + i * 3;
        B.metal.box(x, 0.3, cz, 0.3, 0.7, r.d - 0.5, C(th.steel, 1.3), { bevel: 0.04 });
        B.glow.box(x, 0.68, cz, 0.12, 0.03, r.d - 0.9, C(th.pad, 1.2), {});
      }
    },

    // ───────── 气隙深层 ─────────
    gap(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th, W = r.w, D = r.d;
      // 竖井四壁：黑到底的物理隔离
      const walls = [[0, -D / 2, W, 0.3], [0, D / 2, W, 0.3], [-W / 2, 0, 0.3, D], [W / 2, 0, 0.3, D]];
      for (const q of walls) {
        B.metal.box(cx + q[0], -9, cz + q[1], q[2], 18, q[3], C(0x24251c), { uv: 0.2, world: true });
        B.hazard.box(cx + q[0], -0.12, cz + q[1], q[2] + 0.1, 0.24, q[3] + 0.1, C(0xffffff), { uv: 0.5, world: true });
      }
      for (let k = 1; k < 6; k++) {
        for (const q of walls) {
          const off = 0.17 * Math.sign(q[0] || q[1]);
          B.glow.box(cx + q[0] - (q[0] ? off : 0), -k * 2.8, cz + q[1] - (q[1] ? off : 0), q[2] ? q[2] * 0.98 : 0.02, 0.07, q[3] > 1 ? q[3] * 0.98 : 0.02, C(0xE2492F, 2.2 - k * 0.28), {});
        }
      }
      // 竖井底部的红色余烬
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.ShaderMaterial({
        uniforms: { uTime: w.uTime },
        vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
        fragmentShader: `varying vec2 vU; uniform float uTime; float h(vec2 p){ return fract(sin(dot(p,vec2(12.1,91.7)))*43758.5); }
          void main(){ vec2 p=vU*vec2(10.,6.); vec2 i=floor(p); float n=h(i); float g=smoothstep(.45,.5,max(abs(fract(p.x)-.5),abs(fract(p.y)-.5)));
          float b=step(.8,n)*(.5+.5*sin(uTime*2.+n*30.)); vec3 c=vec3(.2,.04,.015)*(1.0-length(vU-.5))+vec3(.92,.3,.1)*(g*.14+b*.42);
          gl_FragColor=vec4(c,1.);
}`,
      }));
      pit.rotation.x = -Math.PI / 2; pit.position.set(cx, -17.5, cz);
      w.group.add(pit);
      // 被隔离的孤岛：与任何链路都不相连
      const m = new Mesher();
      m.hex(0, 0, 0, 3.2, 0.4, C(0x7E7E70), { bevel: 0.05 });
      m.hex(0, -0.9, 0, 2.2, 1.4, C(0x4a4c38), {});
      m.cone(0, -2.5, 0, 2.0, 2.0, 6, C(0x34362a), { rx: Math.PI });
      m.box(-1.2, 0.9, 0, 1.0, 1.4, 1.6, C(0xCFCDB8), { bevel: 0.05 });
      m.box(1.1, 0.7, 0.3, 1.2, 1.0, 1.1, C(0xB6B3A0), { bevel: 0.05 });
      m.cyl(0, 1.0, -1.0, 0.45, 0.5, 1.6, 12, C(0xDDD9C8), {});
      m.torus(0, 0.26, 0, 3.15, 0.03, C(0xE2583A), { rx: Math.PI / 2, glow: 2.4, seg: 6 });
      m.box(-1.2, 1.1, 0.81, 0.7, 0.3, 0.02, C(0xA8D88A), { glow: 2 });
      const mat = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.55 }));
      addAnimMesh(w, m.geometry(), mat, cx, -0.6, cz, (o, t) => { o.position.y = -0.3 + Math.sin(t * 0.5) * 0.3; o.rotation.y = t * 0.08; }, true);
      // 悬浮警示环与激光幕
      const ring = new Mesher();
      ring.torus(0, 0, 0, 4.4, 0.03, C(0xE2583A), { rx: Math.PI / 2, glow: 2.4, seg: 48 });
      for (let i = 0; i < 6; i++) { const a = i * 1.047; ring.box(Math.cos(a) * 4.4, 0, Math.sin(a) * 4.4, 0.5, 0.06, 0.14, C(0xD29A3E), { glow: 2.4, ry: -a }); }
      addAnimMesh(w, ring.geometry(), w.M.glow, cx, 2.2, cz, (o, t) => { o.rotation.y = -t * 0.3; o.position.y = 2.2 + Math.sin(t * 0.8) * 0.1; });
      for (let k = 0; k < 3; k++) {
        const y = 0.6 + k * 0.5;
        for (const q of walls) {
          B.glow.box(cx + q[0] * 0.98, y, cz + q[1] * 0.98, q[2] > 1 ? q[2] * 0.96 : 0.018, 0.014, q[3] > 1 ? q[3] * 0.96 : 0.018, C(0xE2492F, 2.4), {});
        }
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.metal.box(cx + sx * W / 2, 1.1, cz + sz * D / 2, 0.22, 2.2, 0.22, C(0xC9A84A), { bevel: 0.03 });
        B.glow.sph(cx + sx * W / 2, 2.3, cz + sz * D / 2, 0.16, C(0xE2492F, 4), { seg: 8 });
      }
      B.glow.box(cx, 0.0, cz, 0.0001, 0.0001, 0.0001, C(th.pad), {});
    },
    gapfence(w, r) {
      const B = w.B, { cx, cz } = r;
      B.metal.box(cx, -0.1, cz, r.w - 0.1, 0.4, r.d - 0.1, C(w.th.steel, 1.05), { uv: 0.3, world: true, bevel: 0.04 });
      B.hazard.box(cx, 0.12, cz, r.w - 0.25, 0.06, r.d - 0.25, C(0xffffff), { uv: 0.5, world: true });
      const horizontal = r.nx > r.ny;
      const n = horizontal ? r.nx : r.ny;
      for (let i = 0; i <= n; i++) {
        const t = -1 + 2 * i / n;
        const x = cx + (horizontal ? t * (r.w / 2 - 0.2) : 0), z = cz + (horizontal ? 0 : t * (r.d / 2 - 0.2));
        B.metal.box(x, 0.8, z, 0.12, 1.4, 0.12, C(0xC9A84A), {});
      }
      for (const yy of [0.7, 1.1, 1.45]) {
        B.metal.box(cx, yy, cz, horizontal ? r.w - 0.4 : 0.04, 0.04, horizontal ? 0.04 : r.d - 0.4, C(0xB8A45A), {});
      }
      B.glow.box(cx, 1.52, cz, horizontal ? r.w - 0.4 : 0.03, 0.03, horizontal ? 0.03 : r.d - 0.4, C(0xE2492F, 1.8), {});
    },
    tank(w, r) {
      const B = w.B, { cx, cz } = r;
      B.concrete.box(cx, 0.1, cz, r.w - 0.3, 0.6, r.d - 0.3, C(0x8a8a78), { uv: 0.25, bevel: 0.06 });
      const n = Math.max(1, Math.floor(Math.max(r.nx, r.ny) / 1.5));
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : -1 + 2 * i / (n - 1);
        const horizontal = r.nx >= r.ny;
        const x = cx + (horizontal ? t * (r.w / 2 - 1.3) : 0), z = cz + (horizontal ? 0 : t * (r.d / 2 - 1.3));
        const R = Math.min(1.25, Math.min(r.w, r.d) / 2 - 0.25);
        B.metal.cyl(x, 2.0, z, R, R, 3.2, 20, C(0xcfcdb4), {});
        B.metal.sph(x, 3.6, z, R, C(0xcfcdb4), { seg: 20, s: [1, 0.4, 1] });
        for (const yy of [1.0, 2.0, 3.0]) B.metal.torus(x, yy, z, R + 0.02, 0.04, C(0x7a7760), { rx: Math.PI / 2, seg: 24 });
        B.paint.box(x + R + 0.02, 2.0, z, 0.1, 3.0, 0.3, C(0x383828), {});
        B.glow.box(x + R + 0.07, 1.6, z, 0.02, 1.8, 0.14, C(0xA8D88A, 1.8), {});
        B.paint.cyl(x, 2.0, z, R + 0.012, R + 0.012, 0.4, 20, C(0xC08A3A), { open: true });
        // 爬梯
        for (const s of [-0.13, 0.13]) B.metal.box(x - R - 0.08, 2.0, z + s, 0.03, 3.2, 0.03, C(0xb8b48c), {});
        for (let k = 0; k < 9; k++) B.metal.box(x - R - 0.08, 0.7 + k * 0.33, z, 0.03, 0.03, 0.26, C(0xb8b48c), {});
        // 顶部检修口与排气
        B.metal.cyl(x, 3.98, z, 0.2, 0.24, 0.14, 12, C(0x7a7760), {});
        B.metal.cyl(x + 0.35, 4.0, z + 0.2, 0.05, 0.05, 0.4, 8, C(0x7a7760), {});
        B.metal.cyl(x + 0.35, 4.22, z + 0.2, 0.09, 0.05, 0.06, 8, C(0xB8452E), {});
        // 液位计
        B.paint.cyl(x + R * 0.72, 1.5, z + R * 0.72, 0.11, 0.11, 0.05, 12, C(0xe8e6d8), { rx: Math.PI / 2, ry: Math.PI / 4 });
        // 罐间连接管
        if (i < n - 1) {
          const nx2 = cx + (horizontal ? (n === 1 ? 0 : -1 + 2 * (i + 1) / (n - 1)) * (r.w / 2 - 1.3) : 0), nz2 = cz + (horizontal ? 0 : (n === 1 ? 0 : -1 + 2 * (i + 1) / (n - 1)) * (r.d / 2 - 1.3));
          const midx = (x + nx2) / 2, midz = (z + nz2) / 2, L = Math.hypot(nx2 - x, nz2 - z);
          B.metal.cyl(midx, 0.75, midz, 0.1, 0.1, L, 10, C(0xB8452E), horizontal ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 });
          B.metal.cyl(midx, 0.75, midz, 0.16, 0.16, 0.14, 10, C(0x8f8a70), horizontal ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 });
          B.paint.torus(midx, 1.05, midz, 0.14, 0.03, C(0xCFA23A), { rx: Math.PI / 2, seg: 12 });
          B.metal.cyl(midx, 0.92, midz, 0.02, 0.02, 0.3, 6, C(0x8f8a70), {});
        }
      }
      // 地基上的警示角标
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.hazard.box(cx + sx * (r.w / 2 - 0.5), 0.41, cz + sz * (r.d / 2 - 0.5), 0.5, 0.02, 0.5, C(0xffffff), { uv: 1 });
    },
    pipe(w, r) {
      const B = w.B, { cx, cz } = r;
      const horizontal = r.nx >= r.ny;
      const L = (horizontal ? r.w : r.d) - 0.2;
      const cols = [0xB8452E, 0xCFA23A, 0x5E8A6E];
      const n = Math.max(2, Math.min(3, Math.floor((horizontal ? r.d : r.w) / 0.8)));
      B.metal.box(cx, -0.25, cz, r.w - 0.2, 0.2, r.d - 0.2, C(w.th.under, 2), { uv: 0.3, world: true });
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.62;
        const y = 0.55 + (i % 2) * 0.32;
        const col = C(cols[i % 3]);
        const px = cx + (horizontal ? 0 : off), pz = cz + (horizontal ? off : 0);
        B.metal.cyl(px, y, pz, 0.22, 0.22, L, 10, col, horizontal ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 });
        const steps = Math.floor(L / 2);
        for (let k = 0; k <= steps; k++) {
          const t = -L / 2 + k * (L / Math.max(steps, 1));
          const qx = px + (horizontal ? t : 0), qz = pz + (horizontal ? 0 : t);
          B.metal.box(qx, y / 2 - 0.1, qz, 0.1, y, 0.1, C(0x565642), {});
          B.metal.cyl(qx, y, qz, 0.27, 0.27, 0.08, 10, C(0x8f8a70), horizontal ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 });
        }
        if (i === 0) {
          B.metal.cyl(px, y + 0.42, pz, 0.05, 0.05, 0.45, 6, C(0x8f8a70), {});
          B.paint.torus(px, y + 0.66, pz, 0.2, 0.05, C(0xC23A2A), { rx: Math.PI / 2, seg: 12 });
        }
      }
    },
    cooling(w, r) {
      const B = w.B, { cx, cz } = r;
      B.concrete.box(cx, -0.1, cz, r.w - 0.3, 0.5, r.d - 0.3, C(0x77735f), { uv: 0.25, bevel: 0.06 });
      const R = Math.min(r.w, r.d) / 2 - 0.3;
      const h = 8.5 * Math.min(1.1, R / 2.6);
      const pts = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; const rr = R * (0.68 + 0.42 * Math.pow(2 * Math.abs(t - 0.62), 2)); pts.push([rr, t * h]); }
      B.concrete.lathe(cx, 0.15, cz, pts, 28, C(0xb0aa94), { uv: 3 });
      B.glow.torus(cx, 0.15 + h - 0.05, cz, pts[14][0], 0.05, C(w.th.nebula, 1.8), { rx: Math.PI / 2, seg: 28 });
      B.paint.cyl(cx, 0.35, cz, R * 1.04, R * 1.1, 0.4, 28, C(0xB85A2E), {});
      // 蒸汽
      const n = w.quality === 'low' ? 10 : 22;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) { seed[i] = Math.random(); pos[i * 3] = (Math.random() - 0.5) * R; pos[i * 3 + 2] = (Math.random() - 0.5) * R; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aS', new THREE.BufferAttribute(seed, 1));
      const steam = new THREE.Points(geo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: w.uTime, uPx: { value: w.renderer.getPixelRatio() } },
        vertexShader: `attribute float aS; uniform float uTime,uPx; varying float vA; void main(){ float t=fract(uTime*.09+aS); vec3 p=position; p.y+=t*10.; p.x+=t*t*3.5+sin(uTime*.5+aS*20.)*.3; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(60.+t*190.)*uPx*(20./-mv.z); vA=(1.-t)*smoothstep(0.,.1,t)*.2; }`,
        fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d)*vA; gl_FragColor=vec4(vec3(1.,.93,.82),a);
}`,
      }));
      steam.position.set(cx, 0.15 + h, cz);
      steam.frustumCulled = false;
      w.group.add(steam);
    },
    turbine(w, r) {
      const B = w.B, { cx, cz } = r;
      B.concrete.box(cx, 0.1, cz, r.w - 0.3, 0.6, r.d - 0.3, C(0x8a8a78), { uv: 0.25, bevel: 0.08 });
      B.paint.cyl(cx - 1.4, 2.0, cz, 1.8, 1.8, 7, 24, C(0x4A6A5E), { rz: Math.PI / 2 });
      B.metal.cyl(cx + 3.2, 2.0, cz, 1.2, 1.6, 1.6, 20, C(0x7c7f62), { rz: Math.PI / 2 });
      for (let k = 0; k < 6; k++) B.metal.torus(cx - 4.2 + k * 1.2, 2.0, cz, 1.82, 0.07, C(0xBFA04E), { ry: Math.PI / 2, seg: 28 });
      B.metal.box(cx - 1.4, 0.75, cz, 7, 0.6, 3.6, C(0x565642), {});
      const m = new Mesher();
      m.cyl(0, 0, 0, 0.3, 0.3, 0.3, 12, C(0x888672), { rz: Math.PI / 2 });
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; m.box(0, Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.08, 1.4, 0.3, C(0xdddcc4), { rx: a }); }
      const mat = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.3 }));
      addAnimMesh(w, m.geometry(), mat, cx + 4.1, 2.0, cz, (o, t) => { o.rotation.x = t * 4; }, true);
      B.glow.box(cx - 1.4, 3.85, cz, 5, 0.05, 0.05, C(w.th.pad, 1.6), {});
      B.metal.cyl(cx + 5.2, 1.5, cz, 0.6, 0.6, 1.4, 12, C(0xB85A2E), {});
    },
    plc(w, r) {
      const B = w.B, { cx, cz } = r;
      B.concrete.box(cx, 0.0, cz, r.w - 0.3, 0.5, r.d - 0.3, C(0x77735f), { uv: 0.25, bevel: 0.06 });
      const n = Math.max(r.nx, r.ny);
      const horizontal = r.nx >= r.ny;
      for (let i = 0; i < n * 2; i++) {
        const t = (i + 0.5) / (n * 2) - 0.5;
        const x = cx + (horizontal ? t * (r.w - 0.6) : 0), z = cz + (horizontal ? 0 : t * (r.d - 0.6));
        const c = i % 3 === 0 ? 0xd4d0b0 : 0xbdba9c;
        B.rack.box(x, 1.2, z, horizontal ? 0.7 : Math.min(r.w - 0.8, 1.6), 1.9, horizontal ? Math.min(r.d - 0.8, 1.6) : 0.7, C(c), { uv: 0.3, bevel: 0.03 });
        B.glow.sph(x, 2.32, z, 0.09, C(i % 3 === 1 ? 0xE2492F : 0xA8D88A, 3), { seg: 8 });
      }
    },
    reactor(w, r) {
      const B = w.B, { cx, cz } = r, th = w.th;
      B.concrete.box(cx, 0.0, cz, r.w - 0.3, 0.6, r.d - 0.3, C(0x77735f), { uv: 0.25, bevel: 0.08 });
      B.metal.cyl(cx, 1.5, cz, 1.6, 1.9, 2.4, 24, C(0x8A8A72), {});
      B.metal.sph(cx, 2.7, cz, 1.6, C(0x8A8A72), { seg: 24, s: [1, 0.55, 1] });
      for (const sx of [-1, 1]) {
        B.metal.cyl(cx + sx * 3.2, 1.2, cz, 0.75, 0.85, 1.8, 16, C(0xbdbfa0), {});
        B.metal.cyl(cx + sx * 1.9, 1.5, cz, 0.13, 0.13, 1.5, 8, C(0xB8452E), { rz: Math.PI / 2 });
        B.glow.torus(cx + sx * 3.2, 2.15, cz, 0.75, 0.03, C(th.pad, 2), { rx: Math.PI / 2, seg: 18 });
      }
      B.glow.torus(cx, 1.0, cz, 1.95, 0.05, C(0xEE7A36, 2.4), { rx: Math.PI / 2, seg: 32 });
      const m = new Mesher();
      for (let i = 0; i < 3; i++) m.torus(0, 0, 0, 0.55, 0.02, C(0xE8A24A), { glow: 3, ry: i * 1.05, seg: 24 });
      m.sph(0, 0, 0, 0.22, C(0xffe0a0), { glow: 4, seg: 12 });
      addAnimMesh(w, m.geometry(), w.M.glow, cx, 4.0, cz, (o, t) => { o.rotation.y = t * 1.2; o.rotation.x = t * 0.5; o.position.y = 4.1 + Math.sin(t) * 0.1; });
    },

    // ───────── 入口专属设备 ─────────
    entranceProp(w, en, g, dirIn) {
      const id = `${w.def.id}:${en.id}`;
      const m = new Mesher();
      const c = C(TD.ENTRANCE_COLORS[en.id]);
      const dark = C(0x2a2e38);
      const out = [-dirIn[0], -dirIn[1]];
      const bx = out[0] * 2.2, bz = out[1] * 2.2;
      m.box(bx, -0.4, bz, 3, 0.8, 2.2, dark, { bevel: 0.06 });
      const add = {
        'intranet:A': () => { m.box(bx, 1, bz, 2.4, 2.2, 1.5, C(0xd8e6ec), { bevel: 0.05 }); m.box(bx, 1.2, bz + out[1] * 0.78, 1.8, 1.2, 0.03, c, { glow: 1.4 }); },
        'intranet:B': () => { m.box(bx, 0.9, bz, 2.4, 1.8, 1.5, C(0xD9C08E), { bevel: 0.05 }); m.box(bx, 1.2, bz + out[1] * 0.78, 1.6, 0.9, 0.03, c, { glow: 1.4 }); },
        'backbone:A': () => { m.torus(bx, 1.5, bz, 1.0, 0.05, c, { glow: 2, seg: 28 }); m.torus(bx, 1.5, bz, 1.0, 0.05, c, { glow: 2, seg: 28, ry: 1.57 }); m.sph(bx, 1.5, bz, 0.4, C(0xE8ECF4), { seg: 12 }); m.cyl(bx, 0.2, bz, 0.2, 0.45, 1, 8, dark, {}); },
        'backbone:C': () => { for (let i = 0; i < 3; i++) m.cyl(bx - 0.8 + i * 0.8, 0.9, bz, 0.2, 0.3, 1.8, 8, C(0xC0C8E0), {}); m.box(bx, 1.8, bz, 2.4, 0.1, 0.2, c, { glow: 2 }); },
        'backbone:B': () => { m.sph(bx - 0.6, 1.2, bz, 0.7, C(0xE6EAF5), { seg: 14 }); m.sph(bx + 0.5, 1.4, bz, 0.9, C(0xE6EAF5), { seg: 14 }); m.box(bx, 0.3, bz, 2, 0.6, 1, dark, {}); },
        'airgap:A': () => { m.box(bx, 1.1, bz, 1.8, 2.2, 1.4, C(0xA09E86), { bevel: 0.05 }); m.box(bx, 1.5, bz + out[1] * 0.72, 1.2, 0.6, 0.03, c, { glow: 1.6 }); },
        'airgap:B': () => { m.cyl(bx, 1.1, bz, 0.9, 1.1, 2.2, 8, C(0x8A8A72), {}); m.torus(bx, 2.2, bz, 0.95, 0.04, c, { rx: 1.57, glow: 2, seg: 8 }); },
        'airgap:C': () => { m.box(bx, 1.0, bz, 1.2, 2.0, 2.2, C(0xB85A2E), { bevel: 0.05 }); m.box(bx + out[0] * 0.62, 1.5, bz, 0.03, 0.6, 1.2, c, { glow: 1.6 }); },
      }[id];
      if (add) add();
      const mat = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.45 }));
      const mesh = new THREE.Mesh(m.geometry(), mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
    },

    // ───────── 出口核心：中枢的可见化身，三张图造型不同 ─────────
    core(w, ex) {
      const colHex = TD.EXIT_COLORS[ex.id];
      const g = new THREE.Group();
      const cx = w.X(ex.x), cz = w.Z(ex.y);
      const gold = C(colHex), m = new Mesher(), ivory = C(0xeee6d2), dark = C(0x2a2c33);
      m.cyl(0, -0.15, 0, 1.75, 1.95, 0.5, 8, dark, {});
      m.cyl(0, 0.13, 0, 1.6, 1.7, 0.08, 8, gold, { glow: 0.7 });
      const type = w.def.theme;
      const anim = new Mesher();
      if (type === 'intranet') {
        // 数据库：堆叠圆柱
        m.box(0, 0.4, 1.3, 3.4, 0.7, 1.4, dark, { bevel: 0.05 });
        for (let i = 0; i < 4; i++) {
          m.cyl(0, 0.85 + i * 0.95, 0.9, 1.3, 1.3, 0.72, 28, ivory, {});
          m.torus(0, 0.85 + i * 0.95 + 0.4, 0.9, 1.3, 0.05, gold, { rx: Math.PI / 2, glow: 2.4, seg: 32 });
          m.torus(0, 0.85 + i * 0.95 - 0.4, 0.9, 1.3, 0.03, gold, { rx: Math.PI / 2, glow: 1.2, seg: 32 });
        }
        anim.torus(0, 0, 0, 1.9, 0.05, gold, { rx: Math.PI / 2, glow: 2.6, seg: 40 });
        for (let i = 0; i < 3; i++) { const a = i * 2.094; anim.box(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9, 0.34, 0.14, 0.34, gold, { glow: 3 }); }
      } else if (type === 'backbone') {
        // 数据中心塔：双层环 + 主机舱
        m.box(0, 1.8, 1.1, 2.6, 3.2, 2.2, C(ex.id === 'X' ? 0xdce8f8 : 0xD8DCEE), { bevel: 0.08 });
        m.box(0, 1.8, -0.02, 2.2, 2.8, 0.05, dark, {});
        for (let i = 0; i < 5; i++) m.box(0, 0.7 + i * 0.56, -0.05, 1.9, 0.08, 0.02, gold, { glow: 2.2 });
        m.cyl(0, 4.0, 1.1, 0.9, 1.3, 1.1, 8, ivory, {});
        m.cone(0, 5.1, 1.1, 0.9, 1.1, 8, gold, { glow: 0.8 });
        anim.torus(0, 0, 0, 2.1, 0.06, gold, { rx: Math.PI / 2, glow: 2.4, seg: 48 });
        anim.torus(0, 0, 0, 1.65, 0.03, gold, { rx: 1.2, glow: 2, seg: 40 });
      } else {
        // 工控核心：球形容器 + 爪式支架
        for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.78; m.box(Math.cos(a) * 1.2, 1.1, 0.8 + Math.sin(a) * 1.2, 0.36, 2.2, 0.36, dark, { ry: -a, rz: 0.2, bevel: 0.04 }); }
        m.sph(0, 2.5, 0.8, 1.45, ivory, { seg: 24 });
        m.torus(0, 2.5, 0.8, 1.48, 0.06, gold, { rx: Math.PI / 2, glow: 2.6, seg: 36 });
        m.torus(0, 2.5, 0.8, 1.48, 0.03, gold, { glow: 1.8, seg: 36 });
        m.cyl(0, 4.2, 0.8, 0.26, 0.42, 0.7, 10, dark, {});
        m.sph(0, 4.7, 0.8, 0.28, gold, { glow: 3.4, seg: 12 });
        anim.torus(0, 0, 0, 2.1, 0.05, gold, { rx: Math.PI / 2, glow: 2.4, seg: 6 });
      }
      const mat = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.32 }));
      const mesh = new THREE.Mesh(m.geometry(), mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      const am = new THREE.Mesh(anim.geometry(), w.M.glow);
      am.position.set(0, 1.0, type === 'intranet' ? 0.9 : type === 'backbone' ? 1.1 : 0.8);
      g.add(am);
      g.position.set(cx, 0, cz);
      w.group.add(g);
      // 冲顶光柱
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.26, 44, 12, 1, true), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { c: { value: new THREE.Color(colHex) }, uTime: w.uTime, uFlash: { value: 0 } },
        vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
        fragmentShader: `varying vec2 vU; uniform vec3 c; uniform float uTime,uFlash; void main(){ float a=pow(1.-vU.y,2.)*(.12+uFlash*2.2)*(.8+.2*sin(vU.y*50.-uTime*5.)); gl_FragColor=vec4(c*a*1.2,1.);
}`,
      }));
      beam.position.set(cx, 20, cz + 0.8);
      w.group.add(beam);
      w.exitViews = w.exitViews || {};
      const v = { group: g, beam, mesh: am, flash: 0, label: { x: cx, y: 6.4, z: cz + 0.8 } };
      w.exitViews[ex.id] = v;
      w.anims.push((t, dt) => {
        am.rotation.y = t * 0.8;
        am.position.y = 1.0 + Math.sin(t * 1.1) * 0.5;
        if (v.flash > 0) { v.flash = Math.max(0, v.flash - dt * 1.5); }
        beam.material.uniforms.uFlash.value = v.flash;
      });
    },

    // ───────── 交换节点 ─────────
    nodeView(w, nd) {
      const g = new THREE.Group();
      const cx = w.X(nd.x), cz = w.Z(nd.y);
      g.position.set(cx, 0, cz);
      const m = new Mesher();
      const dark = C(0x20242c), steel = C(0x5b6470);
      // 八角基座 + 四向接驳口
      m.cyl(0, 0.035, 0, 1.02, 1.08, 0.1, 8, dark, { ry: Math.PI / 8 });
      m.cyl(0, 0.1, 0, 0.92, 0.98, 0.05, 8, steel, { ry: Math.PI / 8 });
      for (const D of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if (w.isRoad(nd.x + D[0], nd.y + D[1])) {
          m.box(D[0] * 0.92, 0.04, D[1] * 0.92, D[0] ? 0.3 : 0.86, 0.08, D[1] ? 0.3 : 0.86, C(0x323844), { bevel: 0.02 });
        }
      }
      // 外围的设备插槽
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.PI / 8;
        m.box(Math.cos(a) * 0.8, 0.14, Math.sin(a) * 0.8, 0.2, 0.03, 0.1, C(0x14181f), { ry: -a });
      }
      // 接驳口：每个连通方向一个端口模块
      for (const D of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if (!w.isRoad(nd.x + D[0], nd.y + D[1])) {
          // 不通的方向是封板
          m.box(D[0] * 0.78, 0.2, D[1] * 0.78, D[0] ? 0.14 : 0.7, 0.22, D[1] ? 0.14 : 0.7, C(0x3a424e), { bevel: 0.02 });
          continue;
        }
        const px = -D[1], pz = D[0];
        for (const s of [-1, 1]) {
          m.box(D[0] * 0.66 + px * s * 0.46, 0.2, D[1] * 0.66 + pz * s * 0.46, D[0] ? 0.3 : 0.16, 0.22, D[1] ? 0.3 : 0.16, C(0x5b6470), { bevel: 0.02 });
          m.box(D[0] * 0.66 + px * s * 0.46, 0.315, D[1] * 0.66 + pz * s * 0.46, 0.06, 0.012, 0.06, C(0xA8B4BC), { glow: 1.6 });
        }
      }
      // 四根短天线，让节点在路面上有高度
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        m.cyl(Math.cos(a) * 0.72, 0.34, Math.sin(a) * 0.72, 0.018, 0.03, 0.42, 6, C(0xaab4c0), {});
      }
      const mat = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.35 }));
      const base = new THREE.Mesh(m.geometry(), mat);
      base.receiveShadow = true; base.castShadow = true;
      g.add(base);
      const stateMat = new THREE.MeshBasicMaterial({ color: 0x6FDFAE });
      // 旋转状态环
      const ringM = new Mesher();
      ringM.torus(0, 0, 0, 0.74, 0.04, C(0xffffff), { rx: Math.PI / 2, seg: 32, arc: Math.PI * 0.8 });
      ringM.torus(0, 0, 0, 0.74, 0.04, C(0xffffff), { rx: Math.PI / 2, ry: Math.PI, seg: 32, arc: Math.PI * 0.8 });
      const ring = new THREE.Mesh(ringM.geometry(), stateMat);
      ring.position.y = 0.2;
      g.add(ring);
      // 直通时：沿连通方向流动的光脉冲；隔离时关闭并亮起红色叉
      const flowP = [], flowU = [], flowI = [];
      let fv = 0;
      for (const D of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if (!w.isRoad(nd.x + D[0], nd.y + D[1])) continue;
        const px = -D[1], pz = D[0], hw = 0.13;
        const a0 = 0.34, a1 = 0.98;
        flowP.push(D[0] * a0 + px * hw, 0.135, D[1] * a0 + pz * hw, D[0] * a0 - px * hw, 0.135, D[1] * a0 - pz * hw, D[0] * a1 - px * hw, 0.135, D[1] * a1 - pz * hw, D[0] * a1 + px * hw, 0.135, D[1] * a1 + pz * hw);
        flowU.push(0, 0, 0, 1, 1, 1, 1, 0);
        flowI.push(fv, fv + 1, fv + 2, fv, fv + 2, fv + 3);
        fv += 4;
      }
      const flowG = new THREE.BufferGeometry();
      flowG.setAttribute('position', new THREE.Float32BufferAttribute(flowP, 3));
      flowG.setAttribute('uv', new THREE.Float32BufferAttribute(flowU, 2));
      flowG.setIndex(flowI);
      const flow = new THREE.Mesh(flowG, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: w.uTime, uOn: { value: 1 }, uPhase: { value: nd.x * 0.37 + nd.y * 0.71 } },
        vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
        fragmentShader: `varying vec2 vU; uniform float uTime,uOn,uPhase; void main(){ float s=fract(vU.x*2.2-uTime*1.3+uPhase-abs(vU.y-.5)*.8); float c=smoothstep(.0,.08,s)*smoothstep(.42,.32,s); gl_FragColor=vec4(vec3(.3,1.05,.7)*c*uOn,1.); }`,
      }));
      flow.renderOrder = 5;
      g.add(flow);
      const crossM = new Mesher();
      crossM.box(0, 0.145, 0, 1.5, 0.02, 0.14, C(0xEC4E3A), { ry: Math.PI / 4 });
      crossM.box(0, 0.145, 0, 1.5, 0.02, 0.14, C(0xEC4E3A), { ry: -Math.PI / 4 });
      const cross = new THREE.Mesh(crossM.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.4, 1.4, 1.4) }));
      cross.visible = false;
      g.add(cross);
      // 中央状态灯：直通时显示穿行的箭头光，隔离时变成红色叉
      const coreM = new Mesher();
      coreM.hex(0, 0, 0, 0.38, 0.1, C(0xffffff), {});
      const core = new THREE.Mesh(coreM.geometry(), stateMat);
      core.position.y = 0.18;
      g.add(core);
      // 隔离闸片：隔离时升起
      const bladeM = new Mesher();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + Math.PI / 6;
        bladeM.box(Math.cos(a) * 0.82, 0.32, Math.sin(a) * 0.82, 0.68, 0.72, 0.08, C(0x8e2a26), { ry: -a + Math.PI / 2, bevel: 0.02, glow: 0.4 });
        bladeM.box(Math.cos(a) * 0.87, 0.62, Math.sin(a) * 0.87, 0.5, 0.05, 0.02, C(0xE2492F), { ry: -a + Math.PI / 2, glow: 3 });
      }
      const bladeMat = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.35 }));
      const blades = new THREE.Mesh(bladeM.geometry(), bladeMat);
      blades.position.y = -0.7;
      blades.castShadow = true;
      blades.visible = false;
      g.add(blades);
      // 隔离力场：半透明红幕
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.7, 6, 1, true), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: w.uTime, a: { value: 0 }, c: { value: new THREE.Color(0xE2492F) } },
        vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
        fragmentShader: `varying vec2 vU; uniform float uTime,a; uniform vec3 c; void main(){ float f=pow(1.-vU.y,1.6)*.55; float l=step(.72,fract(vU.y*12.-uTime*1.5))*.3*(1.-vU.y); float v=step(.92,fract(vU.x*18.))*.35*(1.-vU.y); gl_FragColor=vec4(c*(f+l+v)*a*1.6,1.);
}`,
      }));
      shell.position.y = 0.85;
      shell.rotation.y = Math.PI / 6;
      shell.visible = false;
      g.add(shell);
      const colD = new THREE.Color(0x6FDFAE), colI = new THREE.Color(0xEC4E3A), colL = new THREE.Color(0xE9A83E), colB = new THREE.Color(0x9B6BE0);
      const v = {
        group: g, nd, iso: 0, target: 0, state: 'direct', pulse: 0, shell, blades, ring, core,
        setState(s) { this.state = s; this.target = s === 'isolated' || s === 'blocked' ? 1 : 0; },
        update(dt, t) {
          this.iso += (this.target - this.iso) * Math.min(1, dt * 6);
          const k = this.iso;
          ring.rotation.y = t * (this.state === 'direct' ? 1.1 : this.state === 'lockout' ? 0.5 : -2.4);
          const color = this.state === 'direct' ? colD : this.state === 'lockout' ? colL : this.state === 'blocked' ? colB : colI;
          stateMat.color.lerp(color, Math.min(1, dt * 7));
          core.scale.setScalar(this.state === 'direct' ? 0.85 + Math.sin(t * 3 + nd.x) * 0.15 : 1.0);
          blades.visible = k > 0.02;
          blades.position.y = -0.72 + k * 0.72;
          shell.visible = k > 0.02;
          shell.material.uniforms.a.value = k;
          shell.scale.y = k;
          shell.position.y = 0.85 * k;
          const direct = this.state === 'direct';
          flow.material.uniforms.uOn.value += ((direct ? 1 : this.state === 'lockout' ? 0.35 : 0) - flow.material.uniforms.uOn.value) * Math.min(1, dt * 6);
          flow.visible = flow.material.uniforms.uOn.value > 0.02;
          cross.visible = k > 0.3;
        },
      };
      return v;
    },
  };

  function reelGeo() {
    if (reelGeo.g) return reelGeo.g;
    const m = new Mesher();
    m.cyl(0, 0, 0, 0.17, 0.17, 0.02, 16, C(0xcfcfc8), { rx: Math.PI / 2 });
    for (let i = 0; i < 3; i++) { const a = i * 2.094; m.box(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.016, 0.1, 0.04, 0.01, C(0x222222), { rz: a }); }
    reelGeo.g = m.geometry();
    return reelGeo.g;
  }
})(typeof window !== 'undefined' ? window : globalThis);
