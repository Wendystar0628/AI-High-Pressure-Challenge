/* ========================================================================
   water.js — 半透明水体剖面、水下环境、色块化倒影水面、涟漪与浪花
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;
const tx = SR.tex;

/* 水体剖面渐变贴图 */
const sectionTex = tx.make(256, 512, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#bfe6d9');
  grd.addColorStop(0.14, '#9ed7cb');
  grd.addColorStop(0.5, '#77bcb4');
  grd.addColorStop(0.85, '#4e9595');
  grd.addColorStop(1, '#3d7d80');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  /* 层状水平带 */
  g.fillStyle = 'rgba(255,255,255,0.10)';
  for (let y = 0; y < h; y += 46) g.fillRect(0, y, w, 20);
  /* 悬浮微粒 */
  for (let i = 0; i < 260; i++) {
    g.fillStyle = 'rgba(255,255,255,' + SR.rnd(0.05, 0.30).toFixed(2) + ')';
    g.beginPath(); g.arc(SR.rand() * w, SR.rand() * h, SR.rnd(0.6, 2.4), 0, SR.TAU); g.fill();
  }
  /* 水下暗色渐变（底部） */
  const g2 = g.createLinearGradient(0, h * 0.7, 0, h);
  g2.addColorStop(0, 'rgba(35,80,82,0)'); g2.addColorStop(1, 'rgba(35,80,82,0.42)');
  g.fillStyle = g2; g.fillRect(0, h * 0.7, w, h * 0.3);
});

/* 倒影底图使用船只/灯塔位置生成 */
const reflectionItems = [
  { x: 2.9, z: 0.2, w: 1.4, h: 3.6, color: '#f2f6f0', shade: '#39777c' },
  { x: 4.5, z: 0.2, w: 1.4, h: 3.6, color: '#eef3ec', shade: '#3a7a7e' },
  { x: 6.1, z: 0.2, w: 1.4, h: 3.6, color: '#f4f6ef', shade: '#39777c' },
  { x: 7.6, z: 0.2, w: 1.4, h: 3.8, color: '#f6f7f1', shade: '#356f76' },
  { x: 7.5, z: -7.4, w: 0.9, h: 2.0, color: '#f0f1e8', shade: '#c05a4e' },
  { x: -1.4, z: 4.2, w: 0.4, h: 1.6, color: '#e8efe8', shade: '#4c7b78' },
];

SR.build.water = function () {
  const g = SR.group('water');
  const bottom = SR.BASE_BOTTOM, H = -bottom;

  /* ---------------- 底座四周的水体剖面侧壁 ---------------- */
  const secMat = SR.M.basic(0xffffff, {
    map: sectionTex, transparent: true, opacity: 0.52, side: T.DoubleSide, depthWrite: false,
  });

  function sideWall(x, z, w, h, rotY) {
    const m = new T.Mesh(SR.G.plane(w, h), secMat);
    m.position.set(x, bottom + H / 2, z);
    m.rotation.y = rotY;
    m.renderOrder = 5;
    g.add(m);
    /* 水线亮条 */
    const line = new T.Mesh(SR.G.plane(w, 0.035), SR.M.basic(0xd9f6ea, { transparent: true, opacity: 0.75, side: T.DoubleSide, depthWrite: false }));
    line.position.set(x, -0.015, z);
    line.rotation.set(-SR.PI / 2, 0, 0);
    line.rotation.y = rotY;
    line.renderOrder = 6;
    g.add(line);
    return m;
  }
  /* +x 整面为水；+z 的 x>2 为水；-x 的 z<2 为水；-z 除山坡外为水 */
  sideWall(10.01, 0, 20, H, SR.PI / 2);
  sideWall(6.0, 10.01, 8, H, 0);
  sideWall(-10.01, -4.0, 12, H, -SR.PI / 2);
  sideWall(2.0, -10.01, 16, H, SR.PI);

  /* ---------------- 海床 ---------------- */
  const bedMat = SR.M.toon(0xffffff, { map: tx.tiled(tx.seabed(), 4, 4) });
  const bed = SR.add(g, SR.G.plane(20, 20), bedMat, [0, bottom + 0.06, 0], [-SR.PI / 2, 0, 0], false);
  bed.receiveShadow = true;

  /* 水下碎石 */
  const stoneMats = [
    SR.M.toon(0xb9cbbb), SR.M.toon(0x8fae9d), SR.M.toon(0xc9d6c6),
    SR.M.toon(0x86a496), SR.M.toon(0xa8bbaa), SR.M.toon(0x6f9587),
  ];
  for (let i = 0; i < 190; i++) {
    const x = SR.rnd(-9.6, 9.6), z = SR.rnd(-9.6, 9.6);
    if (SR.isLand(x, z)) continue;
    const r = SR.rnd(0.06, 0.30);
    const s = SR.add(g, new T.IcosahedronGeometry(r, 0), SR.pick(stoneMats),
      [x, bottom + 0.08 + r * 0.4, z], [SR.rand() * 3, SR.rand() * 3, SR.rand() * 3], false);
    s.scale.set(1, SR.rnd(0.45, 0.8), SR.rnd(0.8, 1.4));
  }

  /* 沉底旧轮胎 */
  const tireMat = SR.M.toon(0x39474a);
  for (let i = 0; i < 3; i++) {
    const x = 6.2 + i * 1.35, z = 5.0 + (i % 2) * 1.9;
    const tire = SR.add(g, SR.G.torus(0.42, 0.16, 8, 18), tireMat,
      [x, bottom + 0.34, z], [SR.rnd(0.7, 1.25), SR.rnd(0, 3), SR.rnd(-0.3, 0.3)], false);
    tire.scale.set(1, 1, 0.55);
    /* 轮胎内圈 */
    SR.add(g, SR.G.torus(0.27, 0.07, 6, 14), SR.M.toon(0x2b383a),
      [x, bottom + 0.34, z], [tire.rotation.x, tire.rotation.y, tire.rotation.z], false);
  }

  /* 锚链（一串铁环） */
  const chainMat = SR.M.toon(0x556565);
  const chainPts = [];
  for (let i = 0; i < 26; i++) {
    const p = i / 25;
    const x = SR.lerp(4.0, 8.6, p);
    const z = 3.0 + Math.sin(p * 3.1) * 1.7;
    const y = bottom + 0.12 + Math.sin(p * SR.PI) * 0.65;
    const ring = SR.add(g, SR.G.torus(0.10, 0.032, 5, 9), chainMat, [x, y, z],
      [SR.PI / 2 + (i % 2) * 0.9, SR.rnd(0, 1), 0], false);
    chainPts.push([x, y, z]);
  }
  /* 旧锚 */
  const anchor = SR.group('anchor', g);
  anchor.position.set(8.6, bottom + 0.2, 4.2);
  SR.cyl(anchor, 0.05, 0.05, 0.9, SR.M.toon(0x5a6664), [0, 0.45, 0]);
  SR.box(anchor, 0.5, 0.06, 0.07, SR.M.toon(0x5a6664), [0, 0.14, 0]);
  for (const s of [-1, 1]) {
    SR.add(anchor, SR.G.torus(0.22, 0.045, 6, 12, SR.PI), SR.M.toon(0x5a6664), [s * 0.24, 0.14, 0], [0, 0, s * 0.5], false);
  }
  SR.add(anchor, SR.G.torus(0.10, 0.03, 5, 10), SR.M.toon(0x5a6664), [0, 0.96, 0], [0, SR.PI / 2, 0], false);

  /* 海草丛（可摆动） */
  const grassColors = [0x6d9f79, 0x84b47c, 0x5b9370, 0x9ac185];
  for (let k = 0; k < 16; k++) {
    const bx = SR.rnd(-9, 9), bz = SR.rnd(-9, 9);
    if (SR.isLand(bx, bz)) continue;
    const clump = new T.Group();
    clump.position.set(bx, bottom + 0.08, bz);
    g.add(clump);
    for (let b = 0; b < SR.rint(3, 6); b++) {
      const h = SR.rnd(0.5, 1.25), w = SR.rnd(0.05, 0.12);
      const blade = SR.add(clump, SR.G.plane(w, h, 1, 5),
        SR.M.toon(SR.pick(grassColors), { side: T.DoubleSide, transparent: true, opacity: 0.92 }),
        [SR.rnd(-0.18, 0.18), h / 2, SR.rnd(-0.18, 0.18)], [0, SR.rnd(0, 3), SR.rnd(-0.2, 0.2)], false);
      blade.userData.ph = SR.rnd(0, 10);
      blade.userData.h = h;
    }
    SR.obj.seagrass.push({ g: clump, ph: SR.rnd(0, 10), z: bz });
  }

  /* 水下小鱼（成群，anim.js 驱动） */
  const fishMat = SR.M.toon(0xb4d8c8);
  const fishDark = SR.M.toon(0x6c9c92);
  for (let s = 0; s < 4; s++) {
    const school = new T.Group();
    g.add(school);
    const members = [];
    for (let i = 0; i < 7; i++) {
      const f = new T.Group();
      const body = SR.add(f, SR.G.sph(0.115, 10, 8), fishMat, [0, 0, 0], null, false);
      body.scale.set(1.7, 0.7, 0.62);
      const tail = SR.add(f, SR.G.cone(0.08, 0.17, 5), fishDark, [-0.21, 0, 0], [0, 0, SR.PI / 2], false);
      f.position.set(SR.rnd(-0.8, 0.8), SR.rnd(-0.3, 0.3), SR.rnd(-0.8, 0.8));
      school.add(f);
      members.push(f);
    }
    school.position.set(SR.rnd(2.5, 8.5), SR.rnd(bottom + 0.7, -0.6), SR.rnd(2, 8));
    SR.obj.fish.push({ g: school, members: members, ph: SR.rnd(0, 20), spd: SR.rnd(0.35, 0.7), radius: SR.rnd(1.0, 2.0) });
  }

  /* ---------------- 水面（色块化倒影 shader） ---------------- */
  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0 },
    uGustFront: { value: -30 },
    uRain: { value: 0.5 },
    uCloud: { value: 1.0 },
    uMask: { value: SR.maskTexture },
    uRefl: { value: tx.reflection(reflectionItems) },
    uCaustic: { value: tx.caustic() },
    uSeaA: { value: new T.Color(0x8ed0c4) },
    uSeaB: { value: new T.Color(0x6ab4b2) },
    uSeaDeep: { value: new T.Color(0x3f8b8c) },
    uFoam: { value: new T.Color(0xf4fbf6) },
  };
  SR.obj.waterUniforms = uniforms;

  const waterMat = new T.ShaderMaterial({
    uniforms: uniforms,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    fog: false,
    vertexShader: `
      uniform float uTime; uniform float uWind; uniform float uGustFront;
      varying vec3 vWorld; varying vec2 vUvW;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float t = uTime;
        /* 阵风波前：一片细碎波纹沿海面由远及近推进 */
        float gd = wp.z - uGustFront;
        float gust = exp(-gd*gd/5.0) * uWind;
        float w = sin(wp.x*0.85 + t*0.85)*0.030
                + sin(wp.z*1.35 - t*0.62)*0.026
                + sin((wp.x+wp.z)*0.62 + t*0.48)*0.020
                + sin(wp.x*3.1 - wp.z*2.2 + t*1.7)*(0.010 + uWind*0.030)
                + sin(wp.x*8.0 + wp.z*5.0 + t*3.0) * gust * 0.030;
        wp.y += w;
        vWorld = wp.xyz;
        vUvW = (wp.xz + 10.0) / 20.0;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      precision highp float;
      uniform float uTime; uniform float uWind; uniform float uRain; uniform float uCloud; uniform float uGustFront;
      uniform sampler2D uMask; uniform sampler2D uRefl; uniform sampler2D uCaustic;
      uniform vec3 uSeaA; uniform vec3 uSeaB; uniform vec3 uSeaDeep; uniform vec3 uFoam;
      varying vec3 vWorld; varying vec2 vUvW;

      float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

      void main(){
        vec2 uv = vUvW;
        float mask = texture2D(uMask, uv).r;
        if(mask < 0.42) discard;

        float t = uTime;
        /* 波浪扰动倒影采样，形成碎裂与重组 */
        vec2 d = uv;
        d.x += sin(vWorld.z*2.1 + t*0.75)*0.0075 + sin(vWorld.z*5.3 - t*1.15)*0.0030;
        d.y += sin(vWorld.x*2.7 + t*0.92)*0.0090 + sin(vWorld.x*6.1 + t*1.4)*0.0025;
        d.x += uWind * sin(vWorld.z*3.0 + t*2.0)*0.010;
        float gdf = vWorld.z - uGustFront;
        float gustW = exp(-gdf*gdf/5.0) * uWind;
        d.x += gustW * sin(vWorld.z*4.0 + t*2.6)*0.012;
        vec3 refl = texture2D(uRefl, d).rgb;

        /* 基础水色：近岸浅、远处深，带水平条带 */
        float band = sin(vWorld.z*1.1 + t*0.35)*0.5+0.5;
        vec3 base = mix(uSeaA, uSeaB, band*0.55 + 0.18);
        float far = smoothstep(-9.0, -1.0, vWorld.z);
        base = mix(base, uSeaDeep, (1.0-far)*0.30);

        vec3 col = mix(base, refl, 0.74);

        /* 色块化 posterize */
        col = floor(col*5.0 + 0.5)/5.0;

        /* 细波纹亮线 */
        float rip = sin(vWorld.x*4.2 + vWorld.z*2.6 + t*1.6)*sin(vWorld.z*5.5 - t*1.1);
        col += vec3(0.030,0.040,0.036) * smoothstep(0.72, 0.98, rip);
        /* 阵风推进时海面泛起的一片细碎亮波纹 */
        col += vec3(0.055,0.072,0.066) * gustW
             * (0.5 + 0.5*sin(vWorld.x*9.0 + vWorld.z*7.0 + t*3.0));

        /* 粼光闪点（克制，保持色块平涂的干净感） */
        vec2 cuv = uv*5.0 + vec2(t*0.018, -t*0.026);
        float ca = texture2D(uCaustic, cuv).r;
        float spark = smoothstep(0.80, 0.96, ca) * (0.55 + 0.45*sin(t*2.4 + ca*24.0));
        float rnd = hash21(floor(vWorld.xz*4.0));
        float tw = step(0.992, rnd) * (0.5+0.5*sin(t*3.5 + rnd*40.0));
        col += vec3(1.0,0.97,0.84) * (spark*0.12 + tw*0.26) * uCloud;

        /* 云影压暗 */
        col *= mix(0.80, 1.0, uCloud);

        /* 岸边泡沫线 */
        float edge = 1.0 - smoothstep(0.42, 0.60, mask);
        float edgeWave = 0.5 + 0.5*sin(vWorld.x*7.0 + vWorld.z*6.0 + t*2.2);
        col = mix(col, uFoam, edge * (0.30 + 0.38*edgeWave));

        /* 雨点激起的水花 */
        float pd = hash21(floor(vWorld.xz*11.0 + floor(t*7.0)));
        col += vec3(0.9,0.98,0.95) * step(0.994, pd) * uRain * 0.35;

        float alpha = 0.70 + 0.10*band;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const waterGeo = SR.G.plane(20, 20, 80, 80);
  const water = new T.Mesh(waterGeo, waterMat);
  water.rotation.x = -SR.PI / 2;
  water.position.y = 0.018;
  water.renderOrder = 8;
  g.add(water);
  SR.obj.waterMesh = water;

  /* 水面上的一层极淡雾气（远处） */
  const haze = new T.Mesh(SR.G.plane(20, 8), SR.M.basic(0xe8f6ef, {
    map: tx.cloud(), transparent: true, opacity: 0.24, depthWrite: false, side: T.DoubleSide,
  }));
  haze.rotation.x = -SR.PI / 2;
  haze.position.set(4, 0.14, -8.6);
  haze.renderOrder = 9;
  g.add(haze);
  SR.obj.haze = haze;

  /* ---------------- 涟漪贴片 ---------------- */
  const rippleTex = tx.ripple();
  for (let i = 0; i < 10; i++) {
    const x = SR.rnd(-8, 9), z = SR.rnd(-8, 9);
    if (SR.isLand(x, z)) continue;
    const m = new T.Mesh(SR.G.plane(1.2, 1.0), SR.M.basic(0xffffff, {
      map: rippleTex, transparent: true, opacity: 0.0, depthWrite: false, side: T.DoubleSide,
    }));
    m.rotation.x = -SR.PI / 2;
    m.position.set(x, 0.035, z);
    m.renderOrder = 10;
    g.add(m);
    SR.obj.ripples.push({ m: m, ph: SR.rnd(0, 12), period: SR.rnd(3.4, 6.5), x: x, z: z });
  }

  /* ---------------- 消波块之间的浪花 ---------------- */
  const foamTex = tx.foam();
  const foamGroup = new T.Group(); g.add(foamGroup);
  for (let i = 0; i < 5; i++) {
    const x = 8.55 + SR.rnd(-0.5, 0.7), z = 8.3 + SR.rnd(-0.8, 0.8);
    const m = new T.Mesh(SR.G.plane(SR.rnd(0.45, 0.95), SR.rnd(0.28, 0.58)), SR.M.basic(0xffffff, {
      map: foamTex, transparent: true, opacity: 0.42, depthWrite: false, side: T.DoubleSide,
    }));
    m.rotation.x = -SR.PI / 2;
    m.position.set(x, 0.045, z);
    m.renderOrder = 11;
    foamGroup.add(m);
    SR.obj.foam.push({ m: m, ph: SR.rnd(0, 10), x: x, z: z });
  }

  /* ---------------- 水面反光的粼光贴片（供顶棚/天花板复用） ---------------- */
  SR.obj.causticTex = tx.caustic();

  /* 更新 */
  SR.onUpdate(t => {
    uniforms.uTime.value = t;
    haze.position.x = 4 + Math.sin(t * 0.07) * 1.6;
    haze.material.opacity = 0.18 + 0.08 * Math.sin(t * 0.11 + 1.2);
  });
};

})();
