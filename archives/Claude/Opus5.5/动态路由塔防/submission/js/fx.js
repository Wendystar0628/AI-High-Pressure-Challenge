// 特效：粒子、光束、冲击环、护盾泡等。全部用对象池，避免战斗中频繁分配。
(function (root) {
  const TD = root.TD = root.TD || {};
  const THREE = root.THREE;

  class FX {
    constructor(scene, quality) {
      this.scene = scene;
      this.group = new THREE.Group();
      scene.add(this.group);
      this.maxP = quality === 'low' ? 1400 : 3600;
      this.initParticles();
      this.beams = []; this.beamPool = [];
      this.frameBeams = []; this.frameBeamUsed = 0;
      this.rings = []; this.ringPool = [];
      this.flares = []; this.flarePool = [];
      this.misc = [];
      this.time = 0;
      this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
      this.beamGeo.rotateX(Math.PI / 2);
      this.beamGeo.translate(0, 0, 0.5);
    }

    initParticles() {
      const n = this.maxP;
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      this.pPos = new Float32Array(n * 4);
      this.pCol = new Float32Array(n * 4);
      g.setAttribute('iP', new THREE.InstancedBufferAttribute(this.pPos, 4).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('iC', new THREE.InstancedBufferAttribute(this.pCol, 4).setUsage(THREE.DynamicDrawUsage));
      g.instanceCount = 0;
      this.pGeo = g;
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute vec4 iP; attribute vec4 iC; varying vec4 vC; varying vec2 vU;
          void main(){ vU=position.xy+.5; vC=iC; vec4 mv=viewMatrix*vec4(iP.xyz,1.); mv.xy+=position.xy*iP.w; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `varying vec4 vC; varying vec2 vU; void main(){ float d=length(vU-.5)*2.; float a=smoothstep(1.,.15,d); gl_FragColor=vec4(vC.rgb*a*vC.a*.58,1.);
}`,
      });
      this.pMesh = new THREE.Mesh(g, m);
      this.pMesh.frustumCulled = false;
      this.pMesh.renderOrder = 10;
      this.group.add(this.pMesh);
      this.ps = [];
      for (let i = 0; i < n; i++) this.ps.push(null);
      this.pCount = 0;
    }

    p(x, y, z, vx, vy, vz, life, size, r, g, b, opt) {
      if (this.pCount >= this.maxP) return;
      opt = opt || {};
      this.ps[this.pCount++] = { x, y, z, vx, vy, vz, life, max: life, size, size2: opt.size2 != null ? opt.size2 : size * 0.2, r, g, b, grav: opt.grav || 0, drag: opt.drag || 0, floor: opt.floor != null ? opt.floor : -99 };
    }

    color(c) { return c.isColor ? c : new THREE.Color(c); }

    burst(x, y, z, color, n, speed, size, life, opt) {
      const c = this.color(color);
      opt = opt || {};
      const hdr = opt.hdr || 1.25;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, b = (opt.flat ? 0.06 : (Math.random() - 0.3)) * 1.57;
        const s = speed * (0.35 + Math.random() * 0.8);
        this.p(x, y, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + (opt.up || 0), Math.sin(a) * Math.cos(b) * s,
          life * (0.6 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), c.r * hdr, c.g * hdr, c.b * hdr, { grav: opt.grav != null ? opt.grav : 5, drag: opt.drag != null ? opt.drag : 1.6 });
      }
    }

    // 限时光束
    beam(ax, ay, az, bx, by, bz, color, dur, width) {
      let o = this.beamPool.pop();
      if (!o) {
        o = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        o.frustumCulled = false;
        this.group.add(o);
      }
      o.visible = true;
      o.position.set(ax, ay, az);
      o.lookAt(bx, by, bz);
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      o.scale.set(width, width, len);
      o.material.color.copy(this.color(color)).multiplyScalar(1.5);
      o.material.opacity = 1;
      this.beams.push({ o, t: dur, dur, w: width, len });
      return o;
    }

    // 只存在当前帧的光束：治疗、阻挡连线等
    frameBeam(ax, ay, az, bx, by, bz, color, width, opacity) {
      let o = this.frameBeams[this.frameBeamUsed];
      if (!o) {
        o = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        o.frustumCulled = false;
        this.group.add(o);
        this.frameBeams.push(o);
      }
      this.frameBeamUsed++;
      o.visible = true;
      o.position.set(ax, ay, az);
      o.lookAt(bx, by, bz);
      o.scale.set(width, width, Math.hypot(bx - ax, by - ay, bz - az));
      o.material.color.set(color);
      o.material.opacity = opacity == null ? 1 : opacity;
    }

    // 扩散环（贴地）
    ring(x, y, z, r, color, dur, opt) {
      opt = opt || {};
      let o = this.ringPool.pop();
      if (!o) {
        o = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          uniforms: { c: { value: new THREE.Color() }, k: { value: 0 }, w: { value: 0.1 }, fill: { value: 0 } },
          vertexShader: `varying vec2 vU; void main(){ vU=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
          fragmentShader: `varying vec2 vU; uniform vec3 c; uniform float k,w,fill; void main(){ float d=length(vU); if(d>1.) discard; float e=smoothstep(1.,1.-w,d)*smoothstep(1.-w*2.5,1.-w,d); float f=fill*(1.-d)*(1.-k); float a=(e*(1.-k*k)+f*.55); gl_FragColor=vec4(c*a*1.3,1.);
}`,
        }));
        o.rotation.x = -Math.PI / 2;
        o.frustumCulled = false;
        o.renderOrder = 8;
        this.group.add(o);
      }
      o.visible = true;
      o.position.set(x, y, z);
      o.material.uniforms.c.value.copy(this.color(color));
      o.material.uniforms.w.value = opt.w || 0.12;
      o.material.uniforms.fill.value = opt.fill || 0;
      o.material.uniforms.k.value = 0;
      o.scale.setScalar(0.01);
      this.rings.push({ o, r, r0: opt.r0 || 0, t: dur, dur });
    }

    // 上升的光柱（闪现）
    pillar(x, y, z, r, h, color, dur) {
      let o = this.flarePool.pop();
      if (!o) {
        o = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          uniforms: { c: { value: new THREE.Color() }, k: { value: 0 } },
          vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
          fragmentShader: `varying vec2 vU; uniform vec3 c; uniform float k; void main(){ float a=pow(1.-vU.y,1.5)*(1.-k); gl_FragColor=vec4(c*a*1.2,1.);
}`,
        }));
        o.frustumCulled = false;
        this.group.add(o);
      }
      o.visible = true;
      o.position.set(x, y + h / 2, z);
      o.scale.set(r, h, r);
      o.material.uniforms.c.value.copy(this.color(color));
      this.flares.push({ o, t: dur, dur, r, h, y });
    }

    // 可编程的小型瞬时物件（击飞碎块等）
    addMisc(obj, life, fn) { this.group.add(obj); this.misc.push({ obj, t: life, life, fn }); }

    update(dt) {
      this.time += dt;
      // 粒子
      let w = 0;
      const pos = this.pPos, cl = this.pCol, ps = this.ps;
      for (let i = 0; i < this.pCount; i++) {
        const q = ps[i];
        q.life -= dt;
        if (q.life <= 0) continue;
        q.vy -= q.grav * dt;
        if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; q.vz *= k; }
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        if (q.y < q.floor) { q.y = q.floor; q.vy *= -0.4; }
        const k = q.life / q.max;
        pos[w * 4] = q.x; pos[w * 4 + 1] = q.y; pos[w * 4 + 2] = q.z; pos[w * 4 + 3] = q.size2 + (q.size - q.size2) * k;
        cl[w * 4] = q.r; cl[w * 4 + 1] = q.g; cl[w * 4 + 2] = q.b; cl[w * 4 + 3] = Math.min(1, k * 1.6);
        ps[w++] = q;
      }
      this.pCount = w;
      this.pGeo.instanceCount = w;
      if (w) { this.pGeo.attributes.iP.needsUpdate = true; this.pGeo.attributes.iC.needsUpdate = true; }
      // 光束
      for (let i = this.beams.length - 1; i >= 0; i--) {
        const b = this.beams[i];
        b.t -= dt;
        const k = Math.max(0, b.t / b.dur);
        b.o.material.opacity = k;
        b.o.scale.x = b.o.scale.y = b.w * (0.3 + k * 0.7);
        if (b.t <= 0) { b.o.visible = false; this.beamPool.push(b.o); this.beams.splice(i, 1); }
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.t -= dt;
        const k = 1 - Math.max(0, r.t / r.dur);
        r.o.material.uniforms.k.value = k;
        r.o.scale.setScalar(Math.max(0.01, r.r0 + (r.r - r.r0) * (1 - Math.pow(1 - k, 2.4))));
        if (r.t <= 0) { r.o.visible = false; this.ringPool.push(r.o); this.rings.splice(i, 1); }
      }
      for (let i = this.flares.length - 1; i >= 0; i--) {
        const f = this.flares[i];
        f.t -= dt;
        const k = 1 - Math.max(0, f.t / f.dur);
        f.o.material.uniforms.k.value = k;
        f.o.scale.x = f.o.scale.z = f.r * (1 - k * 0.5);
        if (f.t <= 0) { f.o.visible = false; this.flarePool.push(f.o); this.flares.splice(i, 1); }
      }
      for (let i = this.misc.length - 1; i >= 0; i--) {
        const m = this.misc[i];
        m.t -= dt;
        if (m.fn) m.fn(m.obj, dt, 1 - Math.max(0, m.t / m.life));
        if (m.t <= 0) { m.obj.removeFromParent(); this.misc.splice(i, 1); }
      }
    }

    beginFrame() {
      for (let i = 0; i < this.frameBeamUsed; i++) this.frameBeams[i].visible = false;
      this.frameBeamUsed = 0;
    }

    clear() {
      this.pCount = 0; this.pGeo.instanceCount = 0;
      for (const b of this.beams) { b.o.visible = false; this.beamPool.push(b.o); } this.beams = [];
      for (const r of this.rings) { r.o.visible = false; this.ringPool.push(r.o); } this.rings = [];
      for (const f of this.flares) { f.o.visible = false; this.flarePool.push(f.o); } this.flares = [];
      for (const m of this.misc) m.obj.removeFromParent(); this.misc = [];
      this.beginFrame();
    }

    dispose() { this.group.removeFromParent(); }
  }
  TD.FX = FX;
})(typeof window !== 'undefined' ? window : globalThis);
