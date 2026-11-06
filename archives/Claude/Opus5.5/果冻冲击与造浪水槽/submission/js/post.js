// 后处理：泛光 + 色调映射 + 抗锯齿 + 抖动（避免暗部渐变色带）
'use strict';

class PostFX {
  constructor() {
    const d = GX.device;
    const code = WGSL_COMMON + /* wgsl */`
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
struct BP { texel: vec2f, knee: f32, mode: f32 };
@group(0) @binding(2) var<uniform> B: BP;

fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

// 13 点降采样（抑制闪烁），首级带软阈值
@fragment fn fsDown(in: FsTri) -> @location(0) vec4f {
  let t = B.texel; let uv = in.uv;
  let a = textureSampleLevel(src, samp, uv + t * vec2f(-2, -2), 0.0).rgb;
  let b = textureSampleLevel(src, samp, uv + t * vec2f(0, -2), 0.0).rgb;
  let c = textureSampleLevel(src, samp, uv + t * vec2f(2, -2), 0.0).rgb;
  let d = textureSampleLevel(src, samp, uv + t * vec2f(-2, 0), 0.0).rgb;
  let e = textureSampleLevel(src, samp, uv, 0.0).rgb;
  let f = textureSampleLevel(src, samp, uv + t * vec2f(2, 0), 0.0).rgb;
  let g = textureSampleLevel(src, samp, uv + t * vec2f(-2, 2), 0.0).rgb;
  let h = textureSampleLevel(src, samp, uv + t * vec2f(0, 2), 0.0).rgb;
  let i = textureSampleLevel(src, samp, uv + t * vec2f(2, 2), 0.0).rgb;
  let j = textureSampleLevel(src, samp, uv + t * vec2f(-1, -1), 0.0).rgb;
  let k = textureSampleLevel(src, samp, uv + t * vec2f(1, -1), 0.0).rgb;
  let l = textureSampleLevel(src, samp, uv + t * vec2f(-1, 1), 0.0).rgb;
  let m = textureSampleLevel(src, samp, uv + t * vec2f(1, 1), 0.0).rgb;
  var o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (B.mode > 0.5) {
    o = min(o, vec3f(40.0));
    let br = lum(o);
    let soft = sat((br - B.knee * 0.5) / max(B.knee, 1e-3));
    o *= soft * soft;
  }
  return vec4f(o, 1.0);
}

@fragment fn fsUp(in: FsTri) -> @location(0) vec4f {
  let t = B.texel * 1.5; let uv = in.uv;
  var o = textureSampleLevel(src, samp, uv, 0.0).rgb * 4.0;
  o += (textureSampleLevel(src, samp, uv + vec2f(t.x, 0.0), 0.0).rgb + textureSampleLevel(src, samp, uv - vec2f(t.x, 0.0), 0.0).rgb
      + textureSampleLevel(src, samp, uv + vec2f(0.0, t.y), 0.0).rgb + textureSampleLevel(src, samp, uv - vec2f(0.0, t.y), 0.0).rgb) * 2.0;
  o += textureSampleLevel(src, samp, uv + t, 0.0).rgb + textureSampleLevel(src, samp, uv - t, 0.0).rgb
     + textureSampleLevel(src, samp, uv + vec2f(t.x, -t.y), 0.0).rgb + textureSampleLevel(src, samp, uv + vec2f(-t.x, t.y), 0.0).rgb;
  return vec4f(o / 16.0, 1.0);
}
`;
    const compCode = WGSL_COMMON + /* wgsl */`
@group(0) @binding(0) var hdr: texture_2d<f32>;
@group(0) @binding(1) var bloomT: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
struct CP { exposure: f32, bloom: f32, vig: f32, fxaa: f32, texel: vec2f, ssaa: f32, pad: f32 };
@group(0) @binding(3) var<uniform> C: CP;

// ACES 拟合（Narkowicz），略微提高中间调
fn aces(x: vec3f) -> vec3f {
  let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}
fn toSRGB(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c < vec3f(0.0031308));
}
fn tone(uv: vec2f) -> vec3f {
  var c = textureSampleLevel(hdr, samp, uv, 0.0).rgb;
  // 超采样：4 点盒式滤波
  if (C.ssaa > 1.2) {
    let t = C.texel * 0.25;
    c = (textureSampleLevel(hdr, samp, uv + vec2f(t.x, t.y), 0.0).rgb + textureSampleLevel(hdr, samp, uv + vec2f(-t.x, t.y), 0.0).rgb
       + textureSampleLevel(hdr, samp, uv + vec2f(t.x, -t.y), 0.0).rgb + textureSampleLevel(hdr, samp, uv + vec2f(-t.x, -t.y), 0.0).rgb) * 0.25;
  }
  let bl = textureSampleLevel(bloomT, samp, uv, 0.0).rgb;
  c = c + bl * C.bloom;
  let v = uv - 0.5;
  let vg = 1.0 - C.vig * smoothstep(0.25, 0.95, length(v * vec2f(1.05, 1.15)));
  return aces(c * C.exposure * vg);
}
fn luma(c: vec3f) -> f32 { return dot(sqrt(c), vec3f(0.299, 0.587, 0.114)); }

@fragment fn fsComposite(in: FsTri) -> @location(0) vec4f {
  var col = tone(in.uv);
  if (C.fxaa > 0.5) {
    // 轻量 FXAA：只沿高对比边缘混合
    let t = C.texel;
    let nw = tone(in.uv + t * vec2f(-1.0, -1.0));
    let ne = tone(in.uv + t * vec2f(1.0, -1.0));
    let sw = tone(in.uv + t * vec2f(-1.0, 1.0));
    let se = tone(in.uv + t * vec2f(1.0, 1.0));
    let lM = luma(col); let lNW = luma(nw); let lNE = luma(ne); let lSW = luma(sw); let lSE = luma(se);
    let lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    let lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    if (lMax - lMin > max(0.03, lMax * 0.1)) {
      var dir = vec2f(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
      let dr = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078);
      let rc = 1.0 / (min(abs(dir.x), abs(dir.y)) + dr);
      dir = clamp(dir * rc, vec2f(-6.0), vec2f(6.0)) * t;
      let a = 0.5 * (tone(in.uv + dir * (1.0 / 3.0 - 0.5)) + tone(in.uv + dir * (2.0 / 3.0 - 0.5)));
      let b = a * 0.5 + 0.25 * (tone(in.uv - dir * 0.5) + tone(in.uv + dir * 0.5));
      let lb = luma(b);
      col = select(b, a, lb < lMin || lb > lMax);
    }
  }
  var o = toSRGB(col);
  // 三角分布抖动，消除暗背景上的色带
  let n = hash12(in.pos.xy) + hash12(in.pos.xy + vec2f(17.3, 41.7)) - 1.0;
  o += n / 255.0;
  return vec4f(o, 1.0);
}
`;
    const mod = GX.module(code, 'post');
    const fm = GX.module(compCode, 'composite');
    const hdrT = { format: 'rgba16float' };
    this.pDown = d.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: 'vsFull' }, fragment: { module: mod, entryPoint: 'fsDown', targets: [hdrT] }, primitive: { topology: 'triangle-list' } });
    this.pUp = d.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: 'vsFull' },
      fragment: { module: mod, entryPoint: 'fsUp', targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }] }, primitive: { topology: 'triangle-list' } });
    this.pComp = d.createRenderPipeline({ layout: 'auto', vertex: { module: fm, entryPoint: 'vsFull' }, fragment: { module: fm, entryPoint: 'fsComposite', targets: [{ format: GX.format }] }, primitive: { topology: 'triangle-list' } });
    this.levels = 6;
    this.compU = GX.uniform(32, 'compU');
    this.w = 0; this.h = 0;
    this.exposure = 1.0;
    this.bloom = 0.05;
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const d = GX.device;
    if (this.tex) this.tex.destroy();
    let bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1);
    this.levels = Math.min(6, Math.floor(Math.log2(Math.min(bw, bh))) - 1);
    this.tex = d.createTexture({ size: [bw, bh], mipLevelCount: this.levels, format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    this.views = [];
    for (let i = 0; i < this.levels; i++) this.views.push(this.tex.createView({ baseMipLevel: i, mipLevelCount: 1 }));
    this.ubufs = [];
    for (let i = 0; i < this.levels; i++) {
      const u = GX.uniform(16, 'bloomU');
      this.ubufs.push(u);
    }
    this.upU = [];
    for (let i = 0; i < this.levels; i++) this.upU.push(GX.uniform(16, 'bloomUp'));
    this.hdrView = null;
    this.bgComp = null;
  }

  bind(hdrTex) {
    if (this.boundHdr === hdrTex && this.bgComp) return;
    const d = GX.device;
    this.boundHdr = hdrTex;
    this.hdrView = hdrTex.createView();
    this.bgDown = [];
    const w = this.w >> 1, h = this.h >> 1;
    for (let i = 0; i < this.levels; i++) {
      const srcView = i === 0 ? this.hdrView : this.views[i - 1];
      const sw = i === 0 ? this.w : Math.max(1, w >> (i - 1)), sh = i === 0 ? this.h : Math.max(1, h >> (i - 1));
      GX.queue.writeBuffer(this.ubufs[i], 0, new Float32Array([1 / sw, 1 / sh, 1.6, i === 0 ? 1 : 0]));
      this.bgDown.push(d.createBindGroup({ layout: this.pDown.getBindGroupLayout(0), entries: [
        { binding: 0, resource: srcView }, { binding: 1, resource: GX.linear }, { binding: 2, resource: { buffer: this.ubufs[i] } }] }));
    }
    this.bgUp = [];
    for (let i = this.levels - 1; i > 0; i--) {
      const sw = Math.max(1, w >> i), sh = Math.max(1, h >> i);
      GX.queue.writeBuffer(this.upU[i], 0, new Float32Array([1 / sw, 1 / sh, 0, 0]));
      this.bgUp[i] = d.createBindGroup({ layout: this.pUp.getBindGroupLayout(0), entries: [
        { binding: 0, resource: this.views[i] }, { binding: 1, resource: GX.linear }, { binding: 2, resource: { buffer: this.upU[i] } }] });
    }
    this.bgComp = d.createBindGroup({ layout: this.pComp.getBindGroupLayout(0), entries: [
      { binding: 0, resource: this.hdrView }, { binding: 1, resource: this.views[0] }, { binding: 2, resource: GX.linear }, { binding: 3, resource: { buffer: this.compU } }] });
  }

  run(enc, hdrTex, canvasW, canvasH, ssaa) {
    this.bind(hdrTex);
    for (let i = 0; i < this.levels; i++) {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: this.views[i], loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
      p.setPipeline(this.pDown); p.setBindGroup(0, this.bgDown[i]); p.draw(3); p.end();
    }
    for (let i = this.levels - 1; i > 0; i--) {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: this.views[i - 1], loadOp: 'load', storeOp: 'store' }] });
      p.setPipeline(this.pUp); p.setBindGroup(0, this.bgUp[i]); p.draw(3); p.end();
    }
    GX.queue.writeBuffer(this.compU, 0, new Float32Array([this.exposure, this.bloom, 0.34, ssaa < 1.3 ? 1 : 0, 1 / canvasW, 1 / canvasH, ssaa, 0]));
    const p = enc.beginRenderPass({ colorAttachments: [{ view: GX.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    p.setPipeline(this.pComp); p.setBindGroup(0, this.bgComp); p.draw(3); p.end();
  }
}
