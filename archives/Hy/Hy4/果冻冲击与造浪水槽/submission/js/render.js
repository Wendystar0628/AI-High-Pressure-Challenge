/* 渲染器：统一光线步进渲染 + 粒子密度场构建（经典脚本，window.Renderer） */
(function () {
  'use strict';

  const GX = 80, GY = 40, GZ = 28;
  const NCELLS = GX * GY * GZ;
  const MAX_BALLS = 96;
  const MAX_PARTS = 70000;
  const BALL_STRIDE = 12;   // 3 vec4
  const PART_STRIDE = 8;    // 2 vec4

  const DEFAULTS = {
    sceneMode: 1, volumeActive: true, ballCount: 0,
    iso: 0.55, stepWorld: 0.075, foamStr: 1.0, reflStr: 1.0,
    exposure: 1.15, fog: 0.0, groundRefl: 0.9,
    lightDir: [0.45, 0.82, 0.55], lightCol: [1.0, 0.96, 0.88],
    volMin: [-3.2, -0.15, -1.7], volMax: [3.2, 3.3, 1.7],
    jellyTint: [1.0, 0.4, 0.5], waterTint: [0.55, 0.22, 0.12],
    tankP: [-2.6, 0.14, 1.55, 1.0],
    p4: [2.4, 1.0, 0.0, 0.0],
  };

  class Renderer {
    constructor() {
      const d = window.GPU.device;
      this.dev = d;
      this.uBuf = window.GPU.emptyBuffer(64 * 4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
      this.ballBuf = window.GPU.emptyBuffer(MAX_BALLS * BALL_STRIDE * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      this.ballCPU = new Float32Array(MAX_BALLS * BALL_STRIDE);
      this.duBuf = window.GPU.emptyBuffer(16 * 4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
      this.accBuf = window.GPU.emptyBuffer(4 * NCELLS * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      this.partBuf = window.GPU.emptyBuffer(MAX_PARTS * PART_STRIDE * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      this.duCPU = new Float32Array(16);
      this.uniform = new Float32Array(64);

      this.volA = window.GPU.tex3D(GX, GY, GZ);
      this.volB = window.GPU.tex3D(GX, GY, GZ);
      this.viewA = this.volA.createView({ dimension: '3d' });
      this.viewB = this.volB.createView({ dimension: '3d' });
      this.sampler = d.createSampler({ magFilter: 'linear', minFilter: 'linear',
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge' });

      this.renderPipe = window.GPU.render(window.SH.VS, window.SH.FS);
      this.clearPipe = window.GPU.compute(window.SH.DENS_CLEAR);
      this.scatterPipe = window.GPU.compute(window.SH.DENS_SCATTER);
      this.convertPipe = window.GPU.compute(window.SH.DENS_CONVERT);
      this.blurPipe = window.GPU.compute(window.SH.DENS_BLUR);

      this.renderBind = window.GPU.bind(this.renderPipe, [this.uBuf, this.ballBuf, this.viewA, this.sampler]);
      this.clearBind = window.GPU.bind(this.clearPipe, [this.accBuf]);
      this.scatterBind = window.GPU.bind(this.scatterPipe, [this.duBuf, this.accBuf, this.partBuf]);
      this.convertBind = window.GPU.bind(this.convertPipe, [this.duBuf, this.accBuf, this.viewA]);
      this.blurAB = window.GPU.bind(this.blurPipe, [this.viewA, this.viewB, this.sampler, this.duBuf]);
      this.blurBA = window.GPU.bind(this.blurPipe, [this.viewB, this.viewA, this.sampler, this.duBuf]);

      this.min = DEFAULTS.volMin.slice();
      this.max = DEFAULTS.volMax.slice();
      this.refCount = 3.0;
      this.count = 0;
      this._writeDU();
    }

    _writeDU() {
      const a = this.duCPU;
      a.set([this.min[0], this.min[1], this.min[2], 256.0], 0);
      a.set([this.max[0], this.max[1], this.max[2], this.count], 4);
      a.set([GX, GY, GZ, 0], 8);
      a.set([this.refCount, 0, 0, 0], 12);
      window.GPU.queue.writeBuffer(this.duBuf, 0, a);
    }

    configureVolume(min, max, refCount) {
      this.min = min.slice(); this.max = max.slice(); this.refCount = refCount;
      this._writeDU();
    }

    /** list: [{p:[x,y,z], r, col:[r,g,b], metal, rough}] */
    setBalls(list) {
      const n = Math.min(list.length, MAX_BALLS);
      const a = this.ballCPU;
      for (let i = 0; i < n; i++) {
        const b = list[i], o = i * BALL_STRIDE;
        a[o] = b.p[0]; a[o + 1] = b.p[1]; a[o + 2] = b.p[2]; a[o + 3] = b.r;
        a[o + 4] = b.col[0]; a[o + 5] = b.col[1]; a[o + 6] = b.col[2]; a[o + 7] = b.type || 0;
        a[o + 8] = b.metal; a[o + 9] = b.rough; a[o + 10] = 0; a[o + 11] = 0;
      }
      this.ballCount = n;
      window.GPU.queue.writeBuffer(this.ballBuf, 0, a.subarray(0, n * BALL_STRIDE));
    }

    /** f32: 每粒子 8 float = (pos.xyz,1, aux.xyz,0) */
    setDensityParticles(f32, count) {
      const n = Math.min(count, MAX_PARTS);
      this.count = n;
      window.GPU.queue.writeBuffer(this.partBuf, 0, f32, 0, n * PART_STRIDE);
      this._writeDU();
    }

    buildDensity(encoder) {
      const G = window.GPU;
      G.dispatch(encoder, this.clearPipe, this.clearBind, 4 * NCELLS, 128);
      G.dispatch(encoder, this.scatterPipe, this.scatterBind, Math.max(1, this.count), 64);
      const N3 = [GX, GY, GZ];
      const wx = Math.ceil(GX / 4), wy = Math.ceil(GY / 4), wz = Math.ceil(GZ / 4);
      const conv = encoder.beginComputePass();
      conv.setPipeline(this.convertPipe); conv.setBindGroup(0, this.convertBind);
      conv.dispatchWorkgroups(wx, wy, wz); conv.end();
      for (let k = 0; k < 4; k++) {
        const b = encoder.beginComputePass();
        b.setPipeline(this.blurPipe);
        b.setBindGroup(0, k % 2 === 0 ? this.blurAB : this.blurBA);
        b.dispatchWorkgroups(wx, wy, wz); b.end();
      }
    }

    fillUniform(camera, P) {
      const u = this.uniform, V = window.M.V;
      const p = Object.assign({}, DEFAULTS, P || {});
      u.set([camera.pos[0], camera.pos[1], camera.pos[2], 0], 0);
      u.set([camera.right[0], camera.right[1], camera.right[2], 0], 4);
      u.set([camera.up[0], camera.up[1], camera.up[2], 0], 8);
      u.set([camera.fwd[0], camera.fwd[1], camera.fwd[2], 0], 12);
      u.set([camera.tanHalf, window.GPU.canvas.width / window.GPU.canvas.height, p.time || 0, this.ballCount], 16);
      u.set([window.GPU.canvas.width, window.GPU.canvas.height, p.sceneMode, p.volumeActive ? 1 : 0], 20);
      u.set([p.iso, p.stepWorld, p.foamStr, p.reflStr], 24);
      u.set([p.exposure, p.fog, p.groundRefl, 0], 28);
      u.set([p.lightDir[0], p.lightDir[1], p.lightDir[2], 1], 32);
      u.set([p.lightCol[0], p.lightCol[1], p.lightCol[2], 1], 36);
      u.set([this.min[0], this.min[1], this.min[2], 0], 40);
      u.set([this.max[0], this.max[1], this.max[2], 0], 44);
      u.set([p.jellyTint[0], p.jellyTint[1], p.jellyTint[2], 0], 48);
      u.set([p.waterTint[0], p.waterTint[1], p.waterTint[2], 0], 52);
      u.set([p.tankP[0], p.tankP[1], p.tankP[2], p.tankP[3]], 56);
      u.set([p.p4[0], p.p4[1], p.p4[2], p.p4[3]], 60);
      window.GPU.queue.writeBuffer(this.uBuf, 0, u);
    }

    present(encoder, camera, P) {
      this.fillUniform(camera, P);
      const view = window.GPU.context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      });
      pass.setPipeline(this.renderPipe);
      pass.setBindGroup(0, this.renderBind);
      pass.draw(3);
      pass.end();
    }
  }

  Renderer.GX = GX; Renderer.GY = GY; Renderer.GZ = GZ;
  Renderer.BALL_STRIDE = BALL_STRIDE;
  window.Renderer = Renderer;
})();
