/* ============================================================
   通用工具：数学、纹理、环境、镜头控制
   ============================================================ */
(function () {
  'use strict';

  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smoothstep = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.damp = (a, b, lambda, dt) => U.lerp(a, b, 1 - Math.exp(-lambda * dt));
  U.fmt = (v, n) => Number(v).toFixed(n === undefined ? 2 : n);

  /** 确定性伪随机（禁止 Math.random 参与模拟） */
  U.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- 运行时生成纹理（不读取本地图片，file:// 安全） ---------- */

  U.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  /** 演播室环境反射贴图（等距柱状投影） */
  U.makeEnvTexture = function () {
    const c = U.canvas(1024, 512);
    const x = c.getContext('2d');

    const sky = x.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0.0, '#2d5a63');
    sky.addColorStop(0.32, '#1a3942');
    sky.addColorStop(0.52, '#142a31');
    sky.addColorStop(0.72, '#0a171c');
    sky.addColorStop(1.0, '#030a09');
    x.fillStyle = sky;
    x.fillRect(0, 0, 1024, 512);

    // 顶部柔光灯带
    const top = x.createRadialGradient(520, 88, 10, 520, 88, 420);
    top.addColorStop(0, 'rgba(255,255,255,0.95)');
    top.addColorStop(0.18, 'rgba(214,255,250,0.6)');
    top.addColorStop(0.5, 'rgba(120,220,220,0.16)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = top;
    x.fillRect(0, 0, 1024, 512);

    // 左侧青色冷光
    let g = x.createRadialGradient(140, 260, 5, 140, 260, 250);
    g.addColorStop(0, 'rgba(90,250,235,0.8)');
    g.addColorStop(0.28, 'rgba(35,170,175,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);

    // 右侧洋红辅助光
    g = x.createRadialGradient(880, 300, 5, 880, 300, 240);
    g.addColorStop(0, 'rgba(255,120,180,0.55)');
    g.addColorStop(0.32, 'rgba(160,50,110,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);

    // 暖色反光板
    g = x.createRadialGradient(690, 330, 5, 690, 330, 210);
    g.addColorStop(0, 'rgba(255,216,170,0.32)');
    g.addColorStop(0.4, 'rgba(140,95,60,0.1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);

    // 底部微光
    g = x.createLinearGradient(0, 380, 0, 512);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(24,74,76,0.32)');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);

    // 细灯条，给透明材质制造可读反射
    x.globalAlpha = 0.5;
    x.fillStyle = '#d9fff9';
    x.fillRect(80, 120, 240, 3);
    x.fillRect(620, 150, 190, 2);
    x.globalAlpha = 1;

    // 大面积柔光板：金属球与环境反射的主要来源
    if (x.filter !== undefined) x.filter = 'blur(26px)';
    x.fillStyle = 'rgba(225,255,250,0.9)';
    x.fillRect(210, 62, 450, 48);
    x.fillRect(820, 235, 120, 26);
    x.fillStyle = 'rgba(110,255,240,0.55)';
    x.fillRect(40, 150, 34, 240);
    x.fillStyle = 'rgba(255,135,190,0.42)';
    x.fillRect(865, 150, 55, 190);
    x.fillStyle = 'rgba(255,210,165,0.4)';
    x.fillRect(560, 300, 250, 20);
    if (x.filter !== undefined) x.filter = 'none';
    x.fillStyle = 'rgba(240,255,253,0.95)';
    x.fillRect(290, 72, 130, 12);
    x.fillStyle = 'rgba(190,255,250,0.55)';
    x.fillRect(95, 190, 8, 130);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    return tex;
  };

  /** 场景背景：竖向渐变 + 中央柔光 */
  U.makeBackdropTexture = function (warm) {
    const c = U.canvas(1024, 1024);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 1024);
    g.addColorStop(0.0, warm ? '#14262a' : '#10242c');
    g.addColorStop(0.35, warm ? '#0a171b' : '#08141a');
    g.addColorStop(0.7, '#040b0f');
    g.addColorStop(1.0, '#020608');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 1024);

    const glow = x.createRadialGradient(512, 460, 40, 512, 460, 560);
    glow.addColorStop(0, warm ? 'rgba(64,112,100,0.42)' : 'rgba(40,104,108,0.45)');
    glow.addColorStop(0.55, warm ? 'rgba(30,66,62,0.16)' : 'rgba(22,66,72,0.16)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = glow;
    x.fillRect(0, 0, 1024, 1024);

    const vin = x.createRadialGradient(512, 512, 300, 512, 512, 800);
    vin.addColorStop(0, 'rgba(0,0,0,0)');
    vin.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = vin;
    x.fillRect(0, 0, 1024, 1024);

    const tex = new THREE.CanvasTexture(c);
    if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    return tex;
  };

  /** 柔和的圆形光斑（用于阴影、光晕、粒子） */
  U.makeRadialTexture = function (stops, size) {
    const s = size || 256;
    const c = U.canvas(s, s);
    const x = c.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const st of stops) g.addColorStop(st[0], st[1]);
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    return tex;
  };

  U.shadowTexture = function () {
    return U.makeRadialTexture([
      [0, 'rgba(0,0,0,0.9)'],
      [0.32, 'rgba(0,0,0,0.55)'],
      [0.68, 'rgba(0,0,0,0.13)'],
      [1, 'rgba(0,0,0,0)']
    ]);
  };

  U.glowTexture = function () {
    return U.makeRadialTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.18, 'rgba(220,255,250,0.8)'],
      [0.5, 'rgba(120,255,235,0.22)'],
      [1, 'rgba(0,0,0,0)']
    ]);
  };

  U.sprayTexture = function () {
    const s = 64;
    const c = U.canvas(s, s);
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(220,255,253,0.7)');
    g.addColorStop(1, 'rgba(180,255,250,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  };

  U.bubbleTexture = function () {
    const s = 64;
    const c = U.canvas(s, s);
    const x = c.getContext('2d');
    x.clearRect(0, 0, s, s);
    const g = x.createRadialGradient(26, 22, 2, 32, 32, 28);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.45, 'rgba(180,255,250,0.12)');
    g.addColorStop(0.8, 'rgba(160,255,250,0.35)');
    g.addColorStop(1, 'rgba(160,255,250,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(32, 32, 30, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = 'rgba(235,255,252,0.6)';
    x.lineWidth = 1.4;
    x.beginPath();
    x.arc(32, 32, 26, 0.4, 2.4);
    x.stroke();
    return new THREE.CanvasTexture(c);
  };

  /** 创建一个柔和的接触阴影平面 */
  U.contactShadow = function (w, h, opacity) {
    const tex = U.shadowTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: opacity === undefined ? 0.55 : opacity,
      depthWrite: false,
      color: 0x000000,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    return mesh;
  };

  /** 单文件内简易轨道镜头：拖拽旋转、滚轮缩放、阻尼 */
  U.OrbitCam = class {
    constructor(camera, dom, opts) {
      this.camera = camera;
      this.dom = dom;
      this.enabled = true;
      this.target = new THREE.Vector3().copy((opts && opts.target) || new THREE.Vector3());
      this.home = {
        yaw: (opts && opts.yaw) || 0,
        pitch: (opts && opts.pitch) || 0.18,
        dist: (opts && opts.dist) || 6.5,
        target: this.target.clone()
      };
      this.cur = { yaw: this.home.yaw, pitch: this.home.pitch, dist: this.home.dist };
      this.goal = { yaw: this.home.yaw, pitch: this.home.pitch, dist: this.home.dist };
      this.minPitch = (opts && opts.minPitch) || 0.02;
      this.maxPitch = (opts && opts.maxPitch) || 1.05;
      this.minDist = (opts && opts.minDist) || 3.2;
      this.maxDist = (opts && opts.maxDist) || 13;
      this.damping = 9;
      this._drag = null;
      this._bind();
    }

    _bind() {
      const el = this.dom;
      el.addEventListener('pointerdown', (e) => {
        if (!this.enabled || e.button !== 0) return;
        this._drag = { x: e.clientX, y: e.clientY, yaw: this.goal.yaw, pitch: this.goal.pitch };
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', (e) => {
        if (!this._drag || !this.enabled) return;
        const dx = e.clientX - this._drag.x;
        const dy = e.clientY - this._drag.y;
        this.goal.yaw = this._drag.yaw - dx * 0.0042;
        this.goal.pitch = U.clamp(this._drag.pitch + dy * 0.0032, this.minPitch, this.maxPitch);
      });
      const end = (e) => {
        if (this._drag) {
          this._drag = null;
          if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('wheel', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.goal.dist = U.clamp(this.goal.dist * (1 + Math.sign(e.deltaY) * 0.09), this.minDist, this.maxDist);
      }, { passive: false });
    }

    setView(v, immediate) {
      if (v.yaw !== undefined) this.goal.yaw = v.yaw;
      if (v.pitch !== undefined) this.goal.pitch = v.pitch;
      if (v.dist !== undefined) this.goal.dist = v.dist;
      if (v.target) {
        this.target.copy(v.target);
        this.home.target.copy(v.target);
      }
      if (immediate) {
        this.cur.yaw = this.goal.yaw;
        this.cur.pitch = this.goal.pitch;
        this.cur.dist = this.goal.dist;
      }
    }

    reset() {
      this.goal.yaw = this.home.yaw;
      this.goal.pitch = this.home.pitch;
      this.goal.dist = this.home.dist;
      this.target.copy(this.home.target);
    }

    update(dt) {
      const k = 1 - Math.exp(-this.damping * dt);
      this.cur.yaw += (this.goal.yaw - this.cur.yaw) * k;
      this.cur.pitch += (this.goal.pitch - this.cur.pitch) * k;
      this.cur.dist += (this.goal.dist - this.cur.dist) * k;
      const p = this.cur.pitch;
      const d = this.cur.dist;
      const yaw = this.cur.yaw;
      this.camera.position.set(
        this.target.x + Math.sin(yaw) * Math.cos(p) * d,
        this.target.y + Math.sin(p) * d,
        this.target.z + Math.cos(yaw) * Math.cos(p) * d
      );
      this.camera.lookAt(this.target);
    }
  };

  /** 生成圆角盒几何（用于控制台/器材细节） */
  U.roundedBox = function (w, h, d, r, seg) {
    const g = new THREE.BoxGeometry(w, h, d, seg || 1, seg || 1, seg || 1);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    const half = new THREE.Vector3(w / 2, h / 2, d / 2);
    const inner = new THREE.Vector3(Math.max(0.001, w / 2 - r), Math.max(0.001, h / 2 - r), Math.max(0.001, d / 2 - r));
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const c = new THREE.Vector3(
        U.clamp(v.x, -inner.x, inner.x),
        U.clamp(v.y, -inner.y, inner.y),
        U.clamp(v.z, -inner.z, inner.z)
      );
      const n = new THREE.Vector3().subVectors(v, c);
      const len = n.length();
      if (len > 1e-5) {
        n.multiplyScalar(1 / len);
        v.copy(c).addScaledVector(n, r);
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  };

  window.U = U;
})();
