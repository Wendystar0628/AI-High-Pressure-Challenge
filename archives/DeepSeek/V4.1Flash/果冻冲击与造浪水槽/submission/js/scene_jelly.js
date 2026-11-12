/* scene_jelly.js — stage, jelly material, balls, scene management (global SceneJelly) */
(function () {
  'use strict';

  const VS_JELLY = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in float aBruise;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNormal;
out float vBruise;
void main(){
  vWorld = aPos;
  vNormal = aNormal;
  vBruise = aBruise;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

  const FS_JELLY = `#version 300 es
precision highp float;
${GLSL_COMMON}
in vec3 vWorld;
in vec3 vNormal;
in float vBruise;
out vec4 oColor;
uniform sampler2D uSceneTex;
uniform vec2 uRes;
uniform vec3 uColor;
uniform vec3 uDeep;
uniform float uAlpha;
uniform float uRefract;
uniform float uTime;

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float sh = shadowFactor(vWorld, N);
  vec2 suv = gl_FragCoord.xy / uRes;
  float distort = uRefract * (0.55 + 0.45 * (1.0 - abs(dot(N,V))));
  vec2 off = vec2(N.x, -N.y) * distort / (1.0 + 2.6 * abs(N.z));
  vec3 bg = texture(uSceneTex, clamp(suv + off, vec2(0.004), vec2(0.996))).rgb;
  // internal chromatic dispersion
  vec3 bg2 = texture(uSceneTex, clamp(suv + off * 1.13, vec2(0.004), vec2(0.996))).rgb;
  bg = mix(bg, bg2.gbr, 0.10);

  vec3 transmit = mix(uDeep, uColor, 0.35 + 0.38 * max(N.y, 0.0));
  float inner = fbm(vWorld * 9.0 + vec3(0.0, uTime * 0.03, 0.0));
  vec3 col = bg * transmit * 1.42;
  col += uColor * uColor * 0.22;
  col += uColor * (inner - 0.5) * 0.16;
  float ndl = max(dot(N, uSunDir), 0.0);
  col += uColor * uSunColor * ndl * 0.30 * (0.35 + 0.65 * sh);
  // back scatter through the body
  float back = pow(max(dot(-N, uSunDir), 0.0), 2.0);
  col += uColor * uSunColor * back * 0.22;
  // wet double highlight: softbox + harsh point light
  vec3 H = normalize(V + uSunDir);
  float spec = pow(max(dot(N, H), 0.0), 190.0);
  col += uSunColor * spec * 2.9 * sh;
  vec3 lp = vec3(-2.1, 2.6, 2.2);
  vec3 Lp = normalize(lp - vWorld);
  float atten = 1.0 / (1.0 + 0.18 * dot(lp - vWorld, lp - vWorld));
  vec3 Hp = normalize(V + Lp);
  float spec2 = pow(max(dot(N, Hp), 0.0), 420.0) * 4.2 * atten;
  col += vec3(1.0, 0.93, 0.82) * spec2;
  vec3 H2 = normalize(V + normalize(uRimDir));
  col += uRimColor * pow(max(dot(N, H2), 0.0), 90.0) * 1.2 * fres;
  vec3 R = reflect(-V, N);
  vec3 refl = envMap(R, 1.0).rgb;
  col += refl * fres * 1.55;
  // thin bright rim
  col += uColor * pow(fres, 0.55) * 0.45;
  // strain / bruise
  col = mix(col, uDeep * 0.55, vBruise * 0.45);
  col += uColor * 0.04;
  float alpha = clamp(uAlpha + fres * 0.30 + vBruise * 0.20, 0.10, 0.96);
  oColor = vec4(col, alpha);
}`;

  const VS_BALL = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uRot;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vBody;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(uRot * aNormal);
  vBody = normalize(transpose(uRot) * aNormal);
  gl_Position = uViewProj * wp;
}`;

  const FS_BALL = `#version 300 es
precision highp float;
${GLSL_COMMON}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vBody;
out vec4 oColor;
uniform vec3 uColor;
uniform float uMetal;
uniform float uRough;
uniform float uRing;

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  float sh = shadowFactor(vWorld, N);
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 base = uColor;
  // subtle brushed microstructure and a fine equator inlay
  float streak = fbm(vBody * 48.0 + 2.0) * 0.06;
  base *= 0.94 + streak;
  float band = smoothstep(0.012, 0.004, abs(abs(vBody.y) - 0.58));
  float ring2 = smoothstep(0.004, 0.000, abs(abs(vBody.y) - 0.615));
  vec3 col = vec3(0.0);
  col += base * (uSkyColor * (0.55 + 0.45*N.y) + uGroundColor * (0.45-0.45*N.y)) * 0.75;
  col += shadePBR(N, V, uSunDir, base, uSunColor, uRough, uMetal, ndl) * (0.25 + 0.75*sh);
  vec3 R = reflect(-V, N);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N,V),0.0), 5.0);
  vec3 env = envMap(R, uRough * 6.0 + 0.2);
  col += env * mix(vec3(0.25), base, uMetal) * mix(0.4, 1.25, fres) * mix(0.75, 1.6, uMetal);
  vec3 H = normalize(V + uSunDir);
  col += uSunColor * pow(max(dot(N,H),0.0), mix(30.0, 900.0, 1.0-uRough)) * mix(0.25, 1.4, uMetal) * sh;
  col += uRimColor * pow(max(dot(N, normalize(uRimDir)), 0.0), 8.0) * fres * 0.6;
  col = mix(col, col * 0.25 + vec3(0.02), band * uRing * 0.85);
  col += vec3(0.55, 0.40, 0.20) * ring2 * uRing * 0.22;
  float edge = length(vWorld - uCamPos);
  col *= 1.0;
  oColor = vec4(col, 1.0);
}`;

  function makeTorus(gl, R, r, seg, tube) {
    const pos = [], nor = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg * Math.PI * 2;
      for (let j = 0; j <= tube; j++) {
        const v = j / tube * Math.PI * 2;
        const cx = Math.cos(u) * R, cz = Math.sin(u) * R;
        const nx = Math.cos(v) * Math.cos(u), nz = Math.cos(v) * Math.sin(u), ny = Math.sin(v);
        pos.push(cx + nx * r, ny * r, cz + nz * r);
        nor.push(nx, ny, nz);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
      const a = i * (tube + 1) + j, b = a + tube + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return GLU.createMesh(gl, { pos: new Float32Array(pos), normal: new Float32Array(nor), indices: new Uint32Array(idx) });
  }

  class SceneJelly {
    constructor(renderer, opts = {}) {
      this.renderer = renderer;
      this.gl = renderer.gl;
      this.isDemo = false;
      this.demoTime = 0;
      this.params = { softness: 0.62, toughness: 0.58, mass: 12, height: 1.2, selected: 0 };
      this.targets = [
        { tag: 0, name: '青柠 A', spec: '软 · 高块', color: '#9dffd8' },
        { tag: 1, name: '蜜桃 B', spec: '韧 · 宽块', color: '#ff9f8f' },
        { tag: 2, name: '蓝莓 C', spec: '硬 · 小块', color: '#aeb8ff' }
      ];
      this.audio = null;
      this.onFracture = null;
      this.initShaders();
      this.initGeometry();
      this.reset();
    }

    initShaders() {
      const gl = this.gl;
      this.progJelly = new GLU.Program(gl, VS_JELLY, FS_JELLY, 'jelly');
      this.progBall = new GLU.Program(gl, VS_BALL, FS_BALL, 'ball');
    }

    initGeometry() {
      const gl = this.gl;
      this.sphere = GLU.makeSphere(gl, 36, 24);
      this.tableMesh = GLU.makeRoundedBox(gl, 2.92, 0.18, 1.82, 0.025, 3);
      this.plinthMesh = GLU.makeRoundedBox(gl, 1.62, 0.74, 0.96, 0.02, 2);
      this.trimLong = GLU.makeSilkBox(gl, 1, 1, 1);
      this.ringMesh = makeTorus(gl, 0.32, 0.0055, 96, 8);
      this.ringMeshB = makeTorus(gl, 0.40, 0.0045, 96, 8);
      this.tableModel = M4.translation(0, -0.09, 0);
      this.plinthModel = M4.translation(0, -0.56, 0);
      this.floorY = -0.93;
      this.spotPos = [0, 0.2, 0];
    }

    setAudio(a) { this.audio = a; }

    makeBodies() {
      const s = new JellySim(this.gl);
      s.softness = this.params.softness;
      s.toughness = this.params.toughness;
      const defs = [
        { tag: 0, sx: 0.46, sy: 0.60, sz: 0.46, nx: 7, ny: 8, nz: 7, center: [-0.38, 0.301, 0.02], color: [0.55, 1.0, 0.72], deepColor: [0.04, 0.30, 0.21], density: 138, softMul: 0.95, toughMul: 0.90 },
        { tag: 1, sx: 0.70, sy: 0.38, sz: 0.54, nx: 9, ny: 5, nz: 7, center: [0.50, 0.191, 0.02], color: [1.0, 0.60, 0.47], deepColor: [0.40, 0.09, 0.07], density: 150, softMul: 0.68, toughMul: 1.25 },
        { tag: 2, sx: 0.38, sy: 0.36, sz: 0.38, nx: 5, ny: 5, nz: 5, center: [-0.16, 0.181, -0.60], color: [0.60, 0.66, 1.0], deepColor: [0.09, 0.11, 0.40], density: 160, softMul: 0.5, toughMul: 1.55 }
      ];
      for (const d of defs) {
        const b = s.addBody(d, d.tag);
        b.spawn = { center: d.center.slice(), sx: d.sx, sy: d.sy, sz: d.sz };
      }
      s.addBall({ pos: [1.14, 0.105, 0.04], r: 0.105, mass: 6.5, color: [0.52, 0.34, 0.15], metal: 1, rough: 0.28, name: 'brass' }).static = true;
      s.addBall({ pos: [-1.02, 0.09, -0.32], r: 0.09, mass: 3.8, color: [0.12, 0.13, 0.14], metal: 0.25, rough: 0.52, name: 'stone' }).static = true;
      s.addBall({ pos: [0.12, 0.078, 0.66], r: 0.078, mass: 2.4, color: [0.52, 0.55, 0.59], metal: 1, rough: 0.12, name: 'steel' }).static = true;
      return s;
    }

    reset(keepParams = true) {
      this.sim = this.makeBodies();
      this.selected = this.params.selected;
      this.jellyMeshes = new Map();
      this.sim.selected = this.selected;
      this.lastBodies = this.sim.bodies;
      this.fractureCount = 0;
    }

    setParams(p) {
      Object.assign(this.params, p);
      this.sim.softness = this.params.softness;
      this.sim.toughness = this.params.toughness;
      this.selected = this.params.selected;
      this.sim.selected = this.selected;
    }

    trigger(mode) {
      if (!this.sim.bodies.some(b => b.tag === this.params.selected)) {
        this.selected = 0; this.params.selected = 0; this.sim.selected = 0;
      }
      this.sim.trigger(mode, {
        tag: this.params.selected,
        mass: this.params.mass,
        height: this.params.height
      });
    }

    getTargetCenter(i) {
      const b = this.sim.findTag(i);
      return b ? this.sim.bodyCenter(b) : [0, 0.2, 0];
    }

    pick(origin, dir) {
      let best = -1, bestT = 1e9;
      for (const t of this.targets) {
        const b = this.sim.findTag(t.tag);
        if (!b) continue;
        const c = this.sim.bodyCenter(b);
        const oc = [origin[0]-c[0], origin[1]-c[1], origin[2]-c[2]];
        const tca = oc[0]*dir[0]+oc[1]*dir[1]+oc[2]*dir[2];
        const d2 = oc[0]*oc[0]+oc[1]*oc[1]+oc[2]*oc[2] - tca*tca;
        const rad = 0.36;
        if (d2 < rad*rad && tca < bestT) { bestT = tca; best = t.tag; }
      }
      return best;
    }

    update(dt) {
      this.sim.step(dt);
      // process events
      if (this.audio && this.sim.events.length) {
        let crack = 0, hit = 0, ball = 0;
        for (const e of this.sim.events) {
          if (e.type === 'crack') crack++;
          else if (e.type === 'jelly-hit') hit = Math.max(hit, e.strength);
          else if (e.type === 'ball-ball') ball++;
          else if (e.type === 'ball-floor') this.audio.play('floor', e.strength * 0.5);
          else if (e.type === 'whoosh') this.audio.play('whoosh', 0.3);
        }
        if (crack > 0) {
          this.audio.play('crack', Math.min(1, 0.35 + crack * 0.02));
          if (this.onFracture) this.onFracture(crack);
        }
        if (hit > 0) this.audio.play('jelly', hit);
        if (ball > 0) this.audio.play('click', Math.min(1, ball * 0.3));
      }
      this.sim.events.length = 0;
      // remove stale meshes
      const live = new Set(this.sim.bodies);
      for (const [body, mesh] of this.jellyMeshes) if (!live.has(body)) this.jellyMeshes.delete(body);
    }

    prepare(renderer) {
      // camera framing defaults only on first use
      if (!this._framed) {
        renderer.camera.setOrbit([0, 0.30, -0.06], 0.28, 0.30, 2.75);
        this._framed = true;
      }
      renderer.shadowTargetPos = [0, 0.1, -0.05];
      renderer.shadowRadius = 2.9;
    }

    drawShadow(r, prog) {
      const gl = this.gl;
      prog.use();
      r.drawShadowMesh(prog, this.tableMesh, this.tableModel);
      r.drawShadowMesh(prog, this.plinthMesh, this.plinthModel);
      for (const b of this.sim.balls) {
        const model = M4.mul(M4.translation(b.pos[0], b.pos[1], b.pos[2]), M4.scaling(b.r, b.r, b.r));
        r.drawShadowMesh(prog, this.sphere, model);
      }
      for (const body of this.sim.bodies) {
        if (!body.faceCount) continue;
        const cnt = body.buildRenderData();
        if (cnt > 0) r.drawShadowMesh(prog, body.mesh.mesh, M4.identity(), cnt);
      }
    }

    drawTable(r) {
      r.drawSurface(this.tableMesh, this.tableModel, [0.072, 0.083, 0.086], { metal: 0.22, rough: 0.30, noise: 0.65, accent: [0.10, 0.095, 0.07] });
      r.drawSurface(this.plinthMesh, this.plinthModel, [0.032, 0.038, 0.042], { metal: 0.15, rough: 0.48, noise: 0.5 });
      // brass trim bands
      const trimY = -0.065;
      const mats = [
        [M4.mul(M4.translation(0, trimY, 0.912), M4.scaling(2.94, 0.026, 0.012)), [0.70, 0.53, 0.27]],
        [M4.mul(M4.translation(0, trimY, -0.912), M4.scaling(2.94, 0.026, 0.012)), [0.70, 0.53, 0.27]],
        [M4.mul(M4.translation(1.462, trimY, 0), M4.scaling(0.012, 0.026, 1.83)), [0.70, 0.53, 0.27]],
        [M4.mul(M4.translation(-1.462, trimY, 0), M4.scaling(0.012, 0.026, 1.83)), [0.70, 0.53, 0.27]]
      ];
      for (const [m, c] of mats) r.drawSurface(this.trimLong, m, c, { metal: 0.92, rough: 0.26, emissive: 0.02 });
    }

    drawBalls(r) {
      const gl = this.gl;
      const p = this.progBall.use();
      r.setCommon(p);
      p.m4('uViewProj', r.camera.vp);
      for (const b of this.sim.balls) {
        const model = M4.mul(M4.translation(b.pos[0], b.pos[1], b.pos[2]), M4.scaling(b.r, b.r, b.r));
        p.use();
        p.m4('uModel', model);
        p.m4('uViewProj', r.camera.vp);
        p.m3('uRot', b.rotMat);
        p.v3('uColor', b.color);
        p.f('uMetal', b.metal);
        p.f('uRough', b.rough);
        p.f('uRing', b.metal > 0.6 ? 1 : 0);
        this.sphere.draw();
      }
    }

    renderOpaque(r) {
      r.drawFloor(this.floorY, { color: [0.033, 0.039, 0.044] });
      this.drawTable(r);
      // engine-turned selector rings
      const sel = this.params.selected;
      const ringY = 0.003;
      const t = this.targets.find(t => t.tag === sel);
      if (t) {
        const b = this.sim.findTag(sel);
        if (b) {
          const c = b.spawn ? b.spawn.center : [0, 0, 0];
          const rz = b.spawn ? Math.min(b.spawn.sx, b.spawn.sz) * 0.72 : 0.30;
          const m = M4.mul(M4.translation(c[0], ringY, c[2]), M4.scaling(rz / 0.4, 1, rz / 0.4));
          r.drawSurface(this.ringMeshB, m, [0.30, 0.88, 0.74], { metal: 0.8, rough: 0.32, emissive: 0.36 });
          const m2 = M4.mul(M4.translation(c[0], ringY, c[2]), M4.scaling(rz / 0.4 * 1.12, 1, rz / 0.4 * 1.12));
          r.drawSurface(this.ringMesh, m2, [0.72, 0.57, 0.30], { metal: 0.95, rough: 0.26, emissive: 0.02 });
        }
      }
      this.drawBalls(r);
    }

    renderTransparent(r) {
      const gl = this.gl;
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      const camPos = r.camera.eye;
      const bodies = this.sim.bodies.slice().sort((a, b) => {
        const ca = this.sim.bodyCenter(a), cb = this.sim.bodyCenter(b);
        return V3.dist(cb, camPos) - V3.dist(ca, camPos);
      });
      for (const body of bodies) {
        if (!body.faceCount) continue;
        const cnt = body.buildRenderData();
        if (!cnt) continue;
        const p = this.progJelly.use();
        r.setCommon(p);
        p.m4('uViewProj', r.camera.vp);
        p.v3('uColor', body.color);
        p.v3('uDeep', body.deepColor);
        p.f('uAlpha', body.alpha + 0.02);
        p.f('uRefract', 0.062);
        p.v2('uRes', r.w, r.h);
        p.f('uTime', r.time);
        p.i('uSceneTex', 2);
        GLU.bindTexture(gl, r.refractTarget.color, 2);
        body.mesh.draw(cnt);
      }
    }

    renderAdditive(r) {
      // reserved for future impact glints
    }

    onFractureEvent() {}
  }

  window.SceneJelly = SceneJelly;
})();
