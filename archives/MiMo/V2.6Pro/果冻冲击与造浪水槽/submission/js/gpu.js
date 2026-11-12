// gpu.js — WebGPU 设备与渲染管线（阴影 / 不透明 PBR / 屏幕空间元球 / 白水 / 玻璃 / 调色）
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  // ============================== 几何构建 ==============================
  function buildBox(w, h, d) {
    const x = w / 2, y = h / 2, z = d / 2;
    const faces = [
      [[x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z], [1, 0, 0]],
      [[-x, -y, z], [-x, y, z], [-x, y, -z], [-x, -y, -z], [-1, 0, 0]],
      [[-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z], [0, 1, 0]],
      [[-x, -y, z], [-x, -y, -z], [x, -y, -z], [x, -y, z], [0, -1, 0]],
      [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
      [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
    ];
    const pos = [], nrm = [], uv = [], idx = [];
    let base = 0;
    for (const f of faces) {
      const n = f[4];
      const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (let i = 0; i < 4; i++) {
        pos.push(f[i][0], f[i][1], f[i][2]);
        nrm.push(n[0], n[1], n[2]);
        uv.push(uvs[i][0], uvs[i][1]);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      base += 4;
    }
    return packGeo(pos, nrm, uv, idx);
  }

  function buildSphere(radius, segs, rings) {
    const pos = [], nrm = [], uv = [], idx = [];
    for (let r = 0; r <= rings; r++) {
      const v = r / rings;
      const phi = v * Math.PI;
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const theta = u * TAU;
        const nx = Math.sin(phi) * Math.cos(theta);
        const ny = Math.cos(phi);
        const nz = Math.sin(phi) * Math.sin(theta);
        pos.push(nx * radius, ny * radius, nz * radius);
        nrm.push(nx, ny, nz);
        uv.push(u, v);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * (segs + 1) + s;
        const b = a + segs + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return packGeo(pos, nrm, uv, idx);
  }

  function buildCylinder(radius, height, segs, caps = true) {
    const pos = [], nrm = [], uv = [], idx = [];
    const y = height / 2;
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const th = u * TAU;
      const nx = Math.cos(th), nz = Math.sin(th);
      pos.push(nx * radius, -y, nz * radius); nrm.push(nx, 0, nz); uv.push(u, 0);
      pos.push(nx * radius, y, nz * radius); nrm.push(nx, 0, nz); uv.push(u, 1);
    }
    for (let s = 0; s < segs; s++) {
      const a = s * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    if (caps) {
      for (const side of [-1, 1]) {
        const base = pos.length / 3;
        pos.push(0, side * y, 0); nrm.push(0, side, 0); uv.push(0.5, 0.5);
        for (let s = 0; s <= segs; s++) {
          const th = (s / segs) * TAU;
          const nx = Math.cos(th), nz = Math.sin(th);
          pos.push(nx * radius, side * y, nz * radius);
          nrm.push(0, side, 0);
          uv.push(0.5 + nx * 0.5, 0.5 + nz * 0.5);
        }
        for (let s = 0; s < segs; s++) {
          if (side > 0) idx.push(base, base + 1 + s, base + 2 + s);
          else idx.push(base, base + 2 + s, base + 1 + s);
        }
      }
    }
    return packGeo(pos, nrm, uv, idx);
  }

  function packGeo(pos, nrm, uv, idx) {
    return {
      positions: new Float32Array(pos),
      normals: new Float32Array(nrm),
      uvs: new Float32Array(uv),
      indices: new Uint32Array(idx),
    };
  }

  // ============================== WGSL 公共 ==============================
  const WGSL_COMMON = /* wgsl */`
    struct SceneUniforms {
      viewProj : mat4x4<f32>,
      view : mat4x4<f32>,
      proj : mat4x4<f32>,
      lightViewProj : mat4x4<f32>,
      lightView : mat4x4<f32>,
      lightProj : mat4x4<f32>,
      camPos : vec4<f32>,
      lightDir : vec4<f32>,
      lightColor : vec4<f32>,
      ambient : vec4<f32>,
      fog : vec4<f32>,
      params : vec4<f32>,
      shadowParams : vec4<f32>,
    };
    @group(0) @binding(0) var<uniform> U : SceneUniforms;
    @group(0) @binding(1) var shadowMap : texture_depth_2d;
    @group(0) @binding(2) var shadowSampler : sampler_comparison;

    fn shadowSample(worldPos : vec3<f32>, nrm : vec3<f32>) -> f32 {
      let bias = 0.0016 + 0.0032 * (1.0 - abs(dot(nrm, -U.lightDir.xyz)));
      let lp = U.lightViewProj * vec4<f32>(worldPos, 1.0);
      let uvz = lp.xyz / lp.w;
      let uv = vec2<f32>(uvz.x, -uvz.y) * 0.5 + vec2<f32>(0.5, 0.5);
      let z = uvz.z * 0.5 + 0.5;
      var valid = 1.0;
      if (uvz.z > 1.0 || uv.x < 0.01 || uv.x > 0.99 || uv.y < 0.01 || uv.y > 0.99) {
        valid = 0.0;
      }
      let cuv = clamp(uv, vec2<f32>(0.01), vec2<f32>(0.99));
      var sum = 0.0;
      let texel = 1.0 / 2048.0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          let s = textureSampleCompareLevel(shadowMap, shadowSampler, cuv + vec2<f32>(f32(dx), f32(dy)) * texel * 1.35, z - bias);
          sum += s;
        }
      }
      return mix(1.0, sum / 9.0, valid);
    }

    fn ggxSpec(n : vec3<f32>, v : vec3<f32>, l : vec3<f32>, rough : f32) -> f32 {
      let h = normalize(v + l);
      let ndh = max(dot(n, h), 0.0);
      let a = max(rough * rough, 0.002);
      let a2 = a * a;
      let d = ndh * ndh * (a2 - 1.0) + 1.0;
      let D = a2 / (3.14159265 * d * d + 1e-5);
      let ndv = max(dot(n, v), 0.0);
      let ndl = max(dot(n, l), 0.0);
      let k = a * 0.5;
      let G = (ndv / (ndv * (1.0 - k) + k)) * (ndl / (ndl * (1.0 - k) + k));
      return D * G / (4.0 * max(ndv * ndl, 1e-4) + 1e-5);
    }

    fn envColor(dir : vec3<f32>) -> vec3<f32> {
      let t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
      let sky = mix(vec3<f32>(0.17, 0.21, 0.30), vec3<f32>(0.42, 0.56, 0.84), pow(t, 0.85));
      let horizon = vec3<f32>(0.66, 0.63, 0.58);
      let ground = vec3<f32>(0.10, 0.11, 0.14);
      var col = mix(ground, sky, smoothstep(-0.10, 0.28, dir.y));
      col = mix(col, horizon, exp(-abs(dir.y) * 8.0) * 0.5);
      let sun = pow(max(dot(dir, -U.lightDir.xyz), 0.0), 42.0);
      col += U.lightColor.rgb * sun * 1.5;
      return col * U.ambient.w;
    }
  `;

  const WGSL_DRAW_UNIFORMS = /* wgsl */`
    struct DrawUniforms {
      model : mat4x4<f32>,
      color : vec4<f32>,
      params : vec4<f32>,
    };
    @group(1) @binding(0) var<uniform> D : DrawUniforms;
  `;

  const WGSL_BLOB_DECL = /* wgsl */`
    struct BlobP {
      posr : vec4<f32>,
      extra : vec4<f32>,
    };
    @group(1) @binding(0) var<storage, read> blobs : array<BlobP>;
  `;

  const WGSL_MESH_VIN = /* wgsl */`
    struct VSIn {
      @location(0) pos : vec3<f32>,
      @location(1) nrm : vec3<f32>,
      @location(2) uv : vec2<f32>,
    };
  `;

  // ---------- 阴影：网格 ----------
  const WGSL_SHADOW_MESH = WGSL_COMMON + WGSL_DRAW_UNIFORMS + WGSL_MESH_VIN + /* wgsl */`
    struct VSO { @builtin(position) pos : vec4<f32> };
    @vertex fn vs(in : VSIn) -> VSO {
      var o : VSO;
      o.pos = U.lightViewProj * (D.model * vec4<f32>(in.pos, 1.0));
      return o;
    }
    @fragment fn fs(in : VSO) { }
  `;

  // ---------- 阴影：元球（正交光下球体印刻） ----------
  const WGSL_SHADOW_BLOB = WGSL_COMMON + WGSL_BLOB_DECL + /* wgsl */`
    struct VSO {
      @builtin(position) pos : vec4<f32>,
      @location(0) centerL : vec3<f32>,
      @location(1) corner : vec2<f32>,
      @location(2) radius : f32,
    };
    @vertex fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VSO {
      var corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0));
      let c = corners[vi];
      let p = blobs[ii];
      let r = p.posr.w;
      let cv = (U.lightView * vec4<f32>(p.posr.xyz, 1.0)).xyz;
      var o : VSO;
      o.centerL = cv;
      o.corner = c;
      o.radius = r;
      // 正交投影：xy 缩放 = proj[0][0], proj[1][1]
      let sc = vec2<f32>(U.lightProj[0][0], U.lightProj[1][1]);
      let clip = U.lightProj * vec4<f32>(cv.xy + c * r * 1.12, cv.z, 1.0);
      o.pos = clip;
      return o;
    }
    @fragment fn fs(in : VSO) -> @builtin(frag_depth) f32 {
      let d2 = dot(in.corner, in.corner);
      if (d2 > 1.0) { discard; }
      let dz = sqrt(max(1.0 - d2, 0.0)) * in.radius * 1.12;
      // 光视空间：相机沿 -z 看，离光最近的球面点 z 更大
      let hitZ = in.centerL.z + dz * 0.89; // 1/1.12 抵消公告板放大
      let clip = U.lightProj * vec4<f32>(0.0, 0.0, hitZ, 1.0);
      return clip.z / clip.w;
    }
  `;

  // ---------- 不透明 PBR ----------
  const WGSL_OPAQUE = WGSL_COMMON + WGSL_DRAW_UNIFORMS + WGSL_MESH_VIN + /* wgsl */`
    struct VSO {
      @builtin(position) pos : vec4<f32>,
      @location(0) worldPos : vec3<f32>,
      @location(1) nrm : vec3<f32>,
      @location(2) uv : vec2<f32>,
    };
    @vertex fn vs(in : VSIn) -> VSO {
      var o : VSO;
      let wp = D.model * vec4<f32>(in.pos, 1.0);
      o.worldPos = wp.xyz;
      o.nrm = normalize((D.model * vec4<f32>(in.nrm, 0.0)).xyz);
      o.uv = in.uv;
      o.pos = U.viewProj * wp;
      return o;
    }
    @fragment fn fs(in : VSO) -> @location(0) vec4<f32> {
      let n = normalize(in.nrm);
      let v = normalize(U.camPos.xyz - in.worldPos);
      let l = -U.lightDir.xyz;
      let ndl = max(dot(n, l), 0.0);
      let shadow = shadowSample(in.worldPos, n);
      let rough = clamp(D.params.x, 0.04, 1.0);
      let metal = clamp(D.params.y, 0.0, 1.0);
      let emiss = D.params.z;
      let uvScale = D.params.w;

      var albedo = D.color.rgb;
      if (uvScale > 0.0) {
        let grid = abs(fract(in.uv * uvScale) - 0.5);
        let line = smoothstep(0.44, 0.5, max(grid.x, grid.y));
        albedo *= 1.0 - line * 0.13;
      }

      let f0 = mix(vec3<f32>(0.04), albedo, metal);
      let diffColor = albedo * (1.0 - metal);
      let h = normalize(v + l);
      let ndv = max(dot(n, v), 1e-4);
      let vdh = max(dot(v, h), 0.0);
      let fres = f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - vdh, 5.0);
      let spec = ggxSpec(n, v, l, rough) * fres * ndl;
      let diff = diffColor * ndl;

      var col = (diff + spec) * U.lightColor.rgb * shadow * U.lightColor.w;
      col += albedo * U.ambient.rgb * envColor(n) * 0.85;
      let rim = pow(1.0 - ndv, 3.0);
      col += U.lightColor.rgb * rim * 0.05;

      let dist = length(U.camPos.xyz - in.worldPos);
      let fogA = 1.0 - exp(-dist * U.fog.w);
      col = mix(col, U.fog.rgb, fogA);
      col += albedo * emiss;
      return vec4<f32>(col, D.color.a);
    }
  `;

  // ---------- 元球：视深度 + 厚度 ----------
  const WGSL_BLOB_DEPTH = WGSL_COMMON + WGSL_BLOB_DECL + /* wgsl */`
    struct VSO {
      @builtin(position) pos : vec4<f32>,
      @location(0) centerView : vec3<f32>,
      @location(1) corner : vec2<f32>,
      @location(2) radius : f32,
      @location(3) tint : vec3<f32>,
      @location(4) alpha : f32,
    };
    @vertex fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VSO {
      var corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0));
      let c = corners[vi];
      let p = blobs[ii];
      let r = p.posr.w;
      let cv = (U.view * vec4<f32>(p.posr.xyz, 1.0)).xyz;
      var o : VSO;
      o.centerView = cv;
      o.corner = c;
      o.radius = r;
      o.tint = p.extra.rgb;
      o.alpha = p.extra.w;
      o.pos = U.proj * vec4<f32>(cv.xy + c * r * 1.12, cv.z, 1.0);
      return o;
    }
    struct FSO {
      @location(0) viewDist : f32,
      @location(1) thick : f32,
      @location(2) viewNrm : vec4<f32>,
      @builtin(frag_depth) depth : f32,
    };
    @fragment fn fs(in : VSO) -> FSO {
      let r = in.radius;
      let cv = in.centerView;
      let fragView = vec3<f32>(cv.xy + in.corner * r * 1.12, cv.z);
      let rd = normalize(fragView);
      let b = dot(rd, cv);
      let c2 = dot(cv, cv) - r * r;
      let h = b * b - c2;
      if (h < 0.0) { discard; }
      let sh = sqrt(h);
      var t = b - sh;
      if (t < 0.0) { t = b + sh; }
      if (t < 0.0) { discard; }
      let hit = rd * t;
      let viewDist = -hit.z;
      if (viewDist <= 0.0) { discard; }
      var o : FSO;
      o.viewDist = viewDist;
      o.thick = 2.0 * sh * abs(rd.z) * in.alpha;
      // 解析球面法线
      let n = normalize(hit - cv);
      o.viewNrm = vec4<f32>(n, 1.0);
      let viewZ = -viewDist;
      let ndcZ = (U.proj[2][2] * viewZ + U.proj[3][2]) / (-viewZ);
      o.depth = ndcZ;
      return o;
    }
  `;

  // ---------- 元球表面着色（全屏） ----------
  const WGSL_BLOB_SHADE = WGSL_COMMON + /* wgsl */`
    @group(1) @binding(0) var blobDepth : texture_2d<f32>;
    @group(1) @binding(1) var thicknessTex : texture_2d<f32>;
    @group(1) @binding(2) var sceneCopy : texture_2d<f32>;
    @group(1) @binding(3) var blobSampler : sampler;
    @group(1) @binding(4) var blobNrm : texture_2d<f32>;

    struct VSO {
      @builtin(position) pos : vec4<f32>,
      @location(0) uv : vec2<f32>,
    };
    @vertex fn vs(@builtin(vertex_index) vi : u32) -> VSO {
      var corners = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
      var o : VSO;
      let c = corners[vi];
      o.pos = vec4<f32>(c, 0.0, 1.0);
      o.uv = vec2<f32>(c.x, -c.y) * 0.5 + vec2<f32>(0.5, 0.5);
      return o;
    }

    fn loadDepth(uv : vec2<f32>) -> f32 {
      let dim = vec2<i32>(textureDimensions(blobDepth));
      let p = vec2<i32>(clamp(uv * vec2<f32>(dim), vec2<f32>(0.0), vec2<f32>(dim) - 1.0));
      return textureLoad(blobDepth, p, 0).r;
    }

    fn viewPosFromDepth(uv : vec2<f32>, viewDist : f32) -> vec3<f32> {
      let ndc = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
      let tanF = vec2<f32>(1.0 / U.proj[0][0], 1.0 / U.proj[1][1]);
      let ray = vec3<f32>(ndc.x * tanF.x, ndc.y * tanF.y, -1.0);
      return ray * viewDist;
    }

    struct FSO {
      @location(0) color : vec4<f32>,
      @builtin(frag_depth) depth : f32,
    };

    @fragment fn fs(in : VSO) -> FSO {
      let dim = vec2<i32>(textureDimensions(blobDepth));
      let texel = 1.0 / vec2<f32>(dim);
      let d0 = loadDepth(in.uv);
      if (d0 <= 0.0) { discard; }

      let ip0 = vec2<i32>(clamp(in.uv * vec2<f32>(dim), vec2<f32>(0.0), vec2<f32>(dim) - 1.0));
      let thick0 = textureLoad(thicknessTex, ip0, 0).r;
      // 元球等值面：只有累积厚度超过阈值才着色
      if (thick0 < 0.18) { discard; }

      var sum = d0;
      var wsum = 1.0;
      var offs = array<vec2<f32>, 8>(
        vec2<f32>(1.0, 0.0), vec2<f32>(-1.0, 0.0), vec2<f32>(0.0, 1.0), vec2<f32>(0.0, -1.0),
        vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, -1.0));
      for (var i = 0; i < 8; i++) {
        let dn = loadDepth(in.uv + offs[i] * texel * 1.5);
        if (dn > 0.0 && abs(dn - d0) < 0.35) {
          sum += dn;
          wsum += 1.0;
        }
      }
      let depth = sum / wsum;

      // 对解析法线做宽域模糊，使相邻粒子法线平滑过渡
      var nAcc = vec3<f32>(0.0);
      var nW = 0.0;
      for (var dy = -5; dy <= 5; dy++) {
        for (var dx = -5; dx <= 5; dx++) {
          let sp = ip0 + vec2<i32>(dx, dy);
          if (sp.x < 0 || sp.y < 0 || sp.x >= dim.x || sp.y >= dim.y) { continue; }
          let sd = textureLoad(blobDepth, sp, 0).r;
          if (sd > 0.0 && abs(sd - d0) < 0.7) {
            let sn = textureLoad(blobNrm, sp, 0).xyz;
            let w2 = exp(-f32(dx * dx + dy * dy) * 0.06);
            nAcc += sn * w2;
            nW += w2;
          }
        }
      }
      var nView = normalize(select(nAcc / max(nW, 0.001), textureLoad(blobNrm, ip0, 0).xyz, nW < 0.01));

      let viewPos = viewPosFromDepth(in.uv, depth);
      let worldPos = U.camPos.xyz + (inverse4x4(U.view) * vec4<f32>(viewPos, 0.0)).xyz;
      let nWorld = normalize((inverse4x4(U.view) * vec4<f32>(nView, 0.0)).xyz);

      let thick = thick0;

      let mode = U.params.x;
      var baseColor = U.params.yzw;
      if (mode > 0.5) {
        baseColor = vec3<f32>(0.08, 0.34, 0.50);
      }

      let l = -U.lightDir.xyz;
      let v = normalize(U.camPos.xyz - worldPos);
      let ndl = max(dot(nWorld, l), 0.0);
      let shadow = shadowSample(worldPos, nWorld);
      let ndv = max(dot(nWorld, v), 1e-4);
      let fres = pow(1.0 - ndv, 4.0);
      let refl = envColor(reflect(-v, nWorld));
      let rough = mix(0.10, 0.16, mode);
      let spec = ggxSpec(nWorld, v, l, rough) * U.lightColor.rgb * shadow * U.lightColor.w * (0.55 + 0.45 * fres);

      let refrStrength = mix(0.035, 0.048, mode);
      var ruv = in.uv + nView.xy * refrStrength * (0.6 + min(thick, 2.5) * 0.35);
      ruv = clamp(ruv, vec2<f32>(0.002), vec2<f32>(0.998));
      let refrColor = textureSampleLevel(sceneCopy, blobSampler, ruv, 0.0).rgb;

      let absorbK = mix(vec3<f32>(0.9, 1.6, 2.2), vec3<f32>(0.42, 0.18, 0.08), mode);
      let absorb = exp(-thick * absorbK * mix(1.4, 3.8, mode));
      var trans = refrColor * absorb;

      let sss = pow(max(dot(v, -l), 0.0), 2.0) * mix(0.72, 0.16, mode);
      trans += baseColor * sss * shadow * (0.5 + min(thick, 2.0) * 0.30);
      trans += baseColor * ndl * shadow * U.lightColor.rgb * mix(0.52, 0.16, mode);
      // 环境漫射
      trans += baseColor * U.ambient.rgb * envColor(nWorld) * mix(0.45, 0.18, mode);

      let reflAmt = mix(0.06 + fres * 0.55, 0.03 + fres * 0.92, mode);
      var col = mix(trans, refl, reflAmt);
      col += spec;

      let glow = exp(-thick * 1.6) * mix(0.38, 0.05, mode);
      col += baseColor * glow;

      let dist = length(U.camPos.xyz - worldPos);
      let fogA = 1.0 - exp(-dist * U.fog.w);
      col = mix(col, U.fog.rgb, fogA);

      var o : FSO;
      o.color = vec4<f32>(col, 1.0);
      let viewZ = -depth;
      o.depth = (U.proj[2][2] * viewZ + U.proj[3][2]) / (-viewZ);
      return o;
    }
  `;

  // ---------- 白水 / 气泡 ----------
  const WGSL_FOAM = WGSL_COMMON + WGSL_BLOB_DECL + /* wgsl */`
    struct VSO {
      @builtin(position) pos : vec4<f32>,
      @location(0) uv : vec2<f32>,
      @location(1) color : vec3<f32>,
      @location(2) alpha : f32,
    };
    @vertex fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VSO {
      var corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0));
      let c = corners[vi];
      let p = blobs[ii];
      let r = p.posr.w;
      let cv = (U.view * vec4<f32>(p.posr.xyz, 1.0)).xyz;
      var o : VSO;
      o.uv = c;
      o.color = p.extra.rgb;
      o.alpha = p.extra.w;
      o.pos = U.proj * vec4<f32>(cv.xy + c * r, cv.z, 1.0);
      return o;
    }
    @fragment fn fs(in : VSO) -> @location(0) vec4<f32> {
      let d = length(in.uv);
      if (d > 1.0) { discard; }
      let a = pow(1.0 - d, 1.5) * in.alpha;
      return vec4<f32>(in.color * (0.9 + 0.25 * (1.0 - d)), a);
    }
  `;

  // ---------- 玻璃 ----------
  const WGSL_GLASS = WGSL_COMMON + WGSL_DRAW_UNIFORMS + WGSL_MESH_VIN + /* wgsl */`
    struct VSO {
      @builtin(position) pos : vec4<f32>,
      @location(0) worldPos : vec3<f32>,
      @location(1) nrm : vec3<f32>,
    };
    @vertex fn vs(in : VSIn) -> VSO {
      var o : VSO;
      let wp = D.model * vec4<f32>(in.pos, 1.0);
      o.worldPos = wp.xyz;
      o.nrm = normalize((D.model * vec4<f32>(in.nrm, 0.0)).xyz);
      o.pos = U.viewProj * wp;
      return o;
    }
    @fragment fn fs(in : VSO) -> @location(0) vec4<f32> {
      let n = normalize(in.nrm);
      let v = normalize(U.camPos.xyz - in.worldPos);
      let ndv = abs(dot(n, v));
      let fres = pow(1.0 - ndv, 3.0);
      let refl = envColor(reflect(-v, n));
      let edge = pow(1.0 - ndv, 7.0);
      var col = refl * (0.16 + fres * 0.5);
      col += vec3<f32>(0.78, 0.90, 1.0) * edge * 1.25;
      let a = clamp(0.045 + fres * 0.20 + edge * 0.5, 0.0, 0.75) * D.color.a;
      return vec4<f32>(col, a);
    }
  `;

  // ---------- 天空 ----------
  const WGSL_SKY = WGSL_COMMON + /* wgsl */`
    struct VSO {
      @builtin(position) pos : vec4<f32>,
      @location(0) dir : vec3<f32>,
    };
    @vertex fn vs(@builtin(vertex_index) vi : u32) -> VSO {
      var corners = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
      var o : VSO;
      let c = corners[vi];
      o.pos = vec4<f32>(c, 1.0, 1.0);
      let tanF = vec2<f32>(1.0 / U.proj[0][0], 1.0 / U.proj[1][1]);
      let vdir = vec3<f32>(c.x * tanF.x, c.y * tanF.y, -1.0);
      o.dir = normalize((inverse4x4(U.view) * vec4<f32>(vdir, 0.0)).xyz);
      return o;
    }
    @fragment fn fs(in : VSO) -> @location(0) vec4<f32> {
      return vec4<f32>(envColor(normalize(in.dir)) * 0.95, 1.0);
    }
  `;

  // ---------- 调色 ----------
  const WGSL_TONEMAP = /* wgsl */`
    @group(0) @binding(0) var srcTex : texture_2d<f32>;
    @group(0) @binding(1) var samp : sampler;
    struct VSO {
      @builtin(position) pos : vec4<f32>,
      @location(0) uv : vec2<f32>,
    };
    @vertex fn vs(@builtin(vertex_index) vi : u32) -> VSO {
      var corners = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
      var o : VSO;
      let c = corners[vi];
      o.pos = vec4<f32>(c, 0.0, 1.0);
      o.uv = vec2<f32>(c.x, -c.y) * 0.5 + vec2<f32>(0.5, 0.5);
      return o;
    }
    fn aces(x : vec3<f32>) -> vec3<f32> {
      let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
    }
    @fragment fn fs(in : VSO) -> @location(0) vec4<f32> {
      var col = textureSample(srcTex, samp, in.uv).rgb;
      col = aces(col * 1.06);
      let q = in.uv - 0.5;
      let vig = 1.0 - dot(q, q) * 0.5;
      col *= vig;
      col = mix(col, col * vec3<f32>(0.985, 1.0, 1.035), 0.3);
      return vec4<f32>(col, 1.0);
    }
  `;

  const WGSL_INVERSE = /* wgsl */`
    fn inverse4x4(m : mat4x4<f32>) -> mat4x4<f32> {
      let a00 = m[0][0]; let a01 = m[0][1]; let a02 = m[0][2]; let a03 = m[0][3];
      let a10 = m[1][0]; let a11 = m[1][1]; let a12 = m[1][2]; let a13 = m[1][3];
      let a20 = m[2][0]; let a21 = m[2][1]; let a22 = m[2][2]; let a23 = m[2][3];
      let a30 = m[3][0]; let a31 = m[3][1]; let a32 = m[3][2]; let a33 = m[3][3];
      let b00 = a00 * a11 - a01 * a10;
      let b01 = a00 * a12 - a02 * a10;
      let b02 = a00 * a13 - a03 * a10;
      let b03 = a01 * a12 - a02 * a11;
      let b04 = a01 * a13 - a03 * a11;
      let b05 = a02 * a13 - a03 * a12;
      let b06 = a20 * a31 - a21 * a30;
      let b07 = a20 * a32 - a22 * a30;
      let b08 = a20 * a33 - a23 * a30;
      let b09 = a21 * a32 - a22 * a31;
      let b10 = a21 * a33 - a23 * a31;
      let b11 = a22 * a33 - a23 * a32;
      var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (abs(det) < 1e-12) {
        return mat4x4<f32>(vec4<f32>(1,0,0,0), vec4<f32>(0,1,0,0), vec4<f32>(0,0,1,0), vec4<f32>(0,0,0,1));
      }
      det = 1.0 / det;
      var r : mat4x4<f32>;
      r[0][0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
      r[0][1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      r[0][2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
      r[0][3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      r[1][0] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
      r[1][1] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      r[1][2] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
      r[1][3] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      r[2][0] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
      r[2][1] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      r[2][2] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
      r[2][3] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      r[3][0] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
      r[3][1] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      r[3][2] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
      r[3][3] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return r;
    }
  `;

  // ============================== 渲染器 ==============================
  class Renderer {
    constructor() {
      this.device = null;
      this.context = null;
      this.format = 'bgra8unorm';
      this.width = 1280;
      this.height = 720;
      this.drawPool = [];
      this.drawPoolIndex = 0;
      this.meshes = {};
    }

    async init(canvas) {
      if (!navigator.gpu) throw new Error('此浏览器不支持 WebGPU');
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('无法获取 WebGPU 适配器');
      this.device = await adapter.requestDevice({ label: 'main-device' });
      this.context = canvas.getContext('webgpu');
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.canvas = canvas;
      this._resizeTargets(true);
      this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });

      const device = this.device;
      this._sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
      this._shadowSampler = device.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });

      this.sceneUniformBuf = device.createBuffer({ size: 768, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      for (let i = 0; i < 96; i++) {
        this.drawPool.push(device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
      }

      this.device.pushErrorScope('validation');
      this._buildPipelines();
      this._buildStaticMeshes();

      // 收集管线校验错误
      try {
        const err = await this.device.popErrorScope();
        if (err && window.__showErr) window.__showErr('管线: ' + err.message);
      } catch (_) {}
      return this;
    }

    _resizeTargets(force) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.floor(this.canvas.clientWidth * dpr) || 2);
      const h = Math.max(2, Math.floor(this.canvas.clientHeight * dpr) || 2);
      if (!force && w === this.width && h === this.height) return;
      this.width = w; this.height = h;
      this.canvas.width = w; this.canvas.height = h;
      const device = this.device;
      const destroy = (t) => { if (t) t.destroy(); };
      destroy(this._depthTex); destroy(this._colorTex); destroy(this._colorTex2);
      destroy(this._blobDepthTex); destroy(this._thickTex); destroy(this._shadowTex); destroy(this._blobNrmTex);
      this._depthTex = device.createTexture({ size: [w, h], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this._colorTex = device.createTexture({ size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
      this._colorTex2 = device.createTexture({ size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
      this._blobDepthTex = device.createTexture({ size: [w, h], format: 'r32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this._thickTex = device.createTexture({ size: [w, h], format: 'r16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this._blobNrmTex = device.createTexture({ size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this._colorView = this._colorTex.createView();
      this._colorView2 = this._colorTex2.createView();
      this._depthView = this._depthTex.createView();
      this._blobDepthView = this._blobDepthTex.createView();
      this._thickView = this._thickTex.createView();
      this._blobNrmView = this._blobNrmTex.createView();
      this._shadowTex = device.createTexture({ size: [2048, 2048], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this._shadowView = this._shadowTex.createView();
      // 阴影 pass 用占位深度图（避免同一 pass 内既写又采样）
      if (this._shadowDummy) this._shadowDummy.destroy();
      this._shadowDummy = device.createTexture({ size: [1, 1], format: 'depth24plus', usage: GPUTextureUsage.TEXTURE_BINDING });
      this._shadowDummyView = this._shadowDummy.createView();
    }

    resize() { this._resizeTargets(false); }

    _makePipeline(code, opts) {
      const device = this.device;
      const module = device.createShaderModule({ code: WGSL_INVERSE + '\n' + code });
      const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: opts.bindGroupLayouts });
      let depth = undefined;
      if (opts.depth) {
        depth = Object.assign({ format: 'depth24plus' }, opts.depth);
      }
      return device.createRenderPipeline({
        label: opts.label || 'pipe',
        layout: pipelineLayout,
        vertex: { module, entryPoint: 'vs', buffers: opts.vertexBuffers || [] },
        fragment: { module, entryPoint: 'fs', targets: opts.targets || [] },
        primitive: { topology: opts.topology || 'triangle-list', cullMode: opts.cullMode || 'back', frontFace: 'ccw' },
        depthStencil: depth,
        multisample: { count: 1 },
      });
    }

    _buildPipelines() {
      const device = this.device;
      const sceneLayout = device.createBindGroupLayout({
        label: 'scene',
        entries: [
          { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
        ],
      });
      const drawLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }],
      });
      const blobStorageLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }],
      });
      const blobShadeLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        ],
      });
      const tonemapLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
      });
      this._layouts = { sceneLayout, drawLayout, blobStorageLayout, blobShadeLayout, tonemapLayout };

      const vertBuf = [{
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'float32x2' },
        ],
      }];

      this.pipeShadowMesh = this._makePipeline(WGSL_SHADOW_MESH, {
        bindGroupLayouts: [sceneLayout, drawLayout],
        vertexBuffers: vertBuf,
        targets: [],
        depth: { depthWriteEnabled: true, depthCompare: 'less' },
      });
      this.pipeShadowBlob = this._makePipeline(WGSL_SHADOW_BLOB, {
        bindGroupLayouts: [sceneLayout, blobStorageLayout],
        targets: [],
        depth: { depthWriteEnabled: true, depthCompare: 'less' },
      });
      this.pipeOpaque = this._makePipeline(WGSL_OPAQUE, {
        bindGroupLayouts: [sceneLayout, drawLayout],
        vertexBuffers: vertBuf,
        targets: [{ format: 'rgba16float' }],
        depth: { depthWriteEnabled: true, depthCompare: 'less' },
      });
      this.pipeSky = this._makePipeline(WGSL_SKY, {
        bindGroupLayouts: [sceneLayout],
        targets: [{ format: 'rgba16float' }],
        depth: { depthWriteEnabled: true, depthCompare: 'less-equal' },
        cullMode: 'none',
      });
      this.pipeBlobDepth = this._makePipeline(WGSL_BLOB_DEPTH, {
        bindGroupLayouts: [sceneLayout, blobStorageLayout],
        targets: [
          { format: 'r32float' },
          {
            format: 'r16float',
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            },
          },
          { format: 'rgba16float' },
        ],
        depth: { depthWriteEnabled: true, depthCompare: 'less' },
      });
      this.pipeBlobShade = this._makePipeline(WGSL_BLOB_SHADE, {
        bindGroupLayouts: [sceneLayout, blobShadeLayout],
        targets: [{
          format: 'rgba16float',
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
        depth: { depthWriteEnabled: true, depthCompare: 'less-equal' },
        cullMode: 'none',
      });
      this.pipeFoam = this._makePipeline(WGSL_FOAM, {
        bindGroupLayouts: [sceneLayout, blobStorageLayout],
        targets: [{
          format: 'rgba16float',
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
        depth: { depthWriteEnabled: false, depthCompare: 'less-equal' },
        cullMode: 'none',
      });
      this.pipeGlass = this._makePipeline(WGSL_GLASS, {
        bindGroupLayouts: [sceneLayout, drawLayout],
        vertexBuffers: vertBuf,
        targets: [{
          format: 'rgba16float',
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
        depth: { depthWriteEnabled: false, depthCompare: 'less-equal' },
        cullMode: 'none',
      });
      this.pipeTonemap = this._makePipeline(WGSL_TONEMAP, {
        bindGroupLayouts: [tonemapLayout],
        targets: [{ format: this.format }],
        cullMode: 'none',
      });
    }

    _buildStaticMeshes() {
      this.meshes.box111 = this._uploadMesh(buildBox(1, 1, 1));
      this.meshes.sphere = this._uploadMesh(buildSphere(1, 28, 18));
      this.meshes.sphereHi = this._uploadMesh(buildSphere(1, 48, 32));
      this.meshes.cylinder = this._uploadMesh(buildCylinder(1, 1, 24, true));
    }

    _uploadMesh(g) {
      const device = this.device;
      const n = g.positions.length / 3;
      const vdata = new Float32Array(n * 8);
      for (let i = 0; i < n; i++) {
        vdata[i * 8 + 0] = g.positions[i * 3 + 0];
        vdata[i * 8 + 1] = g.positions[i * 3 + 1];
        vdata[i * 8 + 2] = g.positions[i * 3 + 2];
        vdata[i * 8 + 3] = g.normals[i * 3 + 0];
        vdata[i * 8 + 4] = g.normals[i * 3 + 1];
        vdata[i * 8 + 5] = g.normals[i * 3 + 2];
        vdata[i * 8 + 6] = g.uvs[i * 2 + 0];
        vdata[i * 8 + 7] = g.uvs[i * 2 + 1];
      }
      const vbuf = device.createBuffer({ size: vdata.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(vbuf, 0, vdata);
      const ibuf = device.createBuffer({ size: g.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(ibuf, 0, g.indices);
      return { vertex: vbuf, index: ibuf, count: g.indices.length };
    }

    createDynamicMesh(g) { return this._uploadMesh(g); }

    beginFrame(camera, opts = {}) {
      this.resize();
      const aspect = this.width / this.height;
      camera.update(aspect);
      this.camera = camera;

      const u = new Float32Array(192);
      u.set(camera.viewProj, 0);
      u.set(camera.view, 16);
      u.set(camera.proj, 32);
      u.set(opts.lightViewProj || camera.viewProj, 48);
      u.set(opts.lightView || camera.view, 64);
      u.set(opts.lightProj || camera.proj, 80);
      const e = camera.eye();
      u[96] = e.x; u[97] = e.y; u[98] = e.z; u[99] = opts.time || 0;
      const ld = opts.lightDir || { x: -0.42, y: -0.78, z: -0.46 };
      const ll = Math.sqrt(ld.x * ld.x + ld.y * ld.y + ld.z * ld.z) || 1;
      u[100] = ld.x / ll; u[101] = ld.y / ll; u[102] = ld.z / ll; u[103] = 1;
      const lc = opts.lightColor || { x: 1.16, y: 1.08, z: 0.96 };
      u[104] = lc.x; u[105] = lc.y; u[106] = lc.z;
      u[107] = opts.lightIntensity != null ? opts.lightIntensity : 1.25;
      const amb = opts.ambient || { x: 0.40, y: 0.46, z: 0.58 };
      u[108] = amb.x; u[109] = amb.y; u[110] = amb.z;
      u[111] = opts.envIntensity != null ? opts.envIntensity : 1.0;
      const fog = opts.fog || { x: 0.15, y: 0.18, z: 0.24 };
      u[112] = fog.x; u[113] = fog.y; u[114] = fog.z;
      u[115] = opts.fogDensity != null ? opts.fogDensity : 0.010;
      u[116] = opts.blobMode != null ? opts.blobMode : 0;
      u[117] = opts.blobColor ? opts.blobColor.x : 0.86;
      u[118] = opts.blobColor ? opts.blobColor.y : 0.33;
      u[119] = opts.blobColor ? opts.blobColor.z : 0.18;
      const sp = opts.shadowParams || { x: 20, y: 20, z: 0.5, w: 80 };
      u[120] = sp.x; u[121] = sp.y; u[122] = sp.z; u[123] = sp.w;
      this.device.queue.writeBuffer(this.sceneUniformBuf, 0, u);

      this.sceneBG = this.device.createBindGroup({
        layout: this._layouts.sceneLayout,
        entries: [
          { binding: 0, resource: { buffer: this.sceneUniformBuf } },
          { binding: 1, resource: this._shadowView },
          { binding: 2, resource: this._shadowSampler },
        ],
      });
      // 阴影 pass 专用绑定（用占位深度图）
      this.sceneBGShadow = this.device.createBindGroup({
        layout: this._layouts.sceneLayout,
        entries: [
          { binding: 0, resource: { buffer: this.sceneUniformBuf } },
          { binding: 1, resource: this._shadowDummyView },
          { binding: 2, resource: this._shadowSampler },
        ],
      });

      this._drawList = [];
      this._glassList = [];
      this._blobBuffers = [];
      this._foamBuffers = [];
      this._clearColor = opts.clearColor || { r: 0.07, g: 0.09, b: 0.13, a: 1 };
    }

    drawMesh(meshName, model, color, params) {
      this._drawList.push({
        mesh: typeof meshName === 'string' ? this.meshes[meshName] : meshName,
        model, color, params,
      });
    }

    drawGlass(meshName, model, color, params) {
      this._glassList.push({
        mesh: typeof meshName === 'string' ? this.meshes[meshName] : meshName,
        model, color, params,
      });
    }

    drawBlobs(buffer, count, opts = {}) {
      if (count <= 0) return;
      this._blobBuffers.push({ buffer, count, shadow: opts.shadow !== false });
    }

    drawFoam(buffer, count) {
      if (count <= 0) return;
      this._foamBuffers.push({ buffer, count });
    }

    _makeDrawBG(model, color, params) {
      const buf = this.drawPool[this.drawPoolIndex++ % this.drawPool.length];
      const d = new Float32Array(32);
      d.set(model, 0);
      d[16] = color.r; d[17] = color.g; d[18] = color.b; d[19] = color.a != null ? color.a : 1;
      d[20] = params[0]; d[21] = params[1]; d[22] = params[2]; d[23] = params[3];
      this.device.queue.writeBuffer(buf, 0, d);
      return this.device.createBindGroup({
        layout: this._layouts.drawLayout,
        entries: [{ binding: 0, resource: { buffer: buf } }],
      });
    }

    _makeBlobBG(buffer) {
      return this.device.createBindGroup({
        layout: this._layouts.blobStorageLayout,
        entries: [{ binding: 0, resource: { buffer } }],
      });
    }

    render() {
      const device = this.device;
      this.drawPoolIndex = 0;
      const encoder = device.createCommandEncoder();

      // 1. 阴影
      {
        const pass = encoder.beginRenderPass({
          colorAttachments: [],
          depthStencilAttachment: {
            view: this._shadowView,
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
        });
        pass.setBindGroup(0, this.sceneBGShadow);
        pass.setPipeline(this.pipeShadowMesh);
        for (const d of this._drawList) {
          if (d.color.a != null && d.color.a < 0.45) continue;
          pass.setBindGroup(1, this._makeDrawBG(d.model, d.color, d.params));
          pass.setVertexBuffer(0, d.mesh.vertex);
          pass.setIndexBuffer(d.mesh.index, 'uint32');
          pass.drawIndexed(d.mesh.count);
        }
        pass.setPipeline(this.pipeShadowBlob);
        for (const b of this._blobBuffers) {
          if (!b.shadow) continue;
          pass.setBindGroup(1, this._makeBlobBG(b.buffer));
          pass.draw(6, b.count);
        }
        pass.end();
      }

      // 2. 场景色 + 深度
      {
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this._colorView,
            clearValue: this._clearColor,
            loadOp: 'clear',
            storeOp: 'store',
          }],
          depthStencilAttachment: {
            view: this._depthView,
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
        });
        pass.setBindGroup(0, this.sceneBG);
        pass.setPipeline(this.pipeSky);
        pass.draw(3);
        pass.setPipeline(this.pipeOpaque);
        for (const d of this._drawList) {
          pass.setBindGroup(1, this._makeDrawBG(d.model, d.color, d.params));
          pass.setVertexBuffer(0, d.mesh.vertex);
          pass.setIndexBuffer(d.mesh.index, 'uint32');
          pass.drawIndexed(d.mesh.count);
        }
        pass.end();
      }

      // 3. 元球
      if (this._blobBuffers.length) {
        // 3a. 复制场景色，避免同纹理读写
        encoder.copyTextureToTexture({ texture: this._colorTex }, { texture: this._colorTex2 }, [this.width, this.height]);

        const pass = encoder.beginRenderPass({
          colorAttachments: [
            { view: this._blobDepthView, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
            { view: this._thickView, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
            { view: this._blobNrmView, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
          ],
          depthStencilAttachment: {
            view: this._depthView,
            depthLoadOp: 'load',
            depthStoreOp: 'store',
          },
        });
        pass.setBindGroup(0, this.sceneBG);
        pass.setPipeline(this.pipeBlobDepth);
        for (const b of this._blobBuffers) {
          pass.setBindGroup(1, this._makeBlobBG(b.buffer));
          pass.draw(6, b.count);
        }
        pass.end();

        const shadeBG = device.createBindGroup({
          layout: this._layouts.blobShadeLayout,
          entries: [
            { binding: 0, resource: this._blobDepthView },
            { binding: 1, resource: this._thickView },
            { binding: 2, resource: this._colorView2 },
            { binding: 3, resource: this._sampler },
            { binding: 4, resource: this._blobNrmView },
          ],
        });
        const pass2 = encoder.beginRenderPass({
          colorAttachments: [{
            view: this._colorView,
            loadOp: 'load',
            storeOp: 'store',
          }],
          depthStencilAttachment: {
            view: this._depthView,
            depthLoadOp: 'load',
            depthStoreOp: 'store',
          },
        });
        pass2.setBindGroup(0, this.sceneBG);
        pass2.setPipeline(this.pipeBlobShade);
        pass2.setBindGroup(1, shadeBG);
        pass2.draw(3);
        pass2.end();
      }

      // 4. 白水
      if (this._foamBuffers.length) {
        const pass = encoder.beginRenderPass({
          colorAttachments: [{ view: this._colorView, loadOp: 'load', storeOp: 'store' }],
          depthStencilAttachment: {
            view: this._depthView,
            depthLoadOp: 'load',
            depthStoreOp: 'store',
          },
        });
        pass.setBindGroup(0, this.sceneBG);
        pass.setPipeline(this.pipeFoam);
        for (const b of this._foamBuffers) {
          pass.setBindGroup(1, this._makeBlobBG(b.buffer));
          pass.draw(6, b.count);
        }
        pass.end();
      }

      // 5. 玻璃
      if (this._glassList.length) {
        const pass = encoder.beginRenderPass({
          colorAttachments: [{ view: this._colorView, loadOp: 'load', storeOp: 'store' }],
          depthStencilAttachment: {
            view: this._depthView,
            depthLoadOp: 'load',
            depthStoreOp: 'store',
          },
        });
        pass.setBindGroup(0, this.sceneBG);
        pass.setPipeline(this.pipeGlass);
        for (const d of this._glassList) {
          pass.setBindGroup(1, this._makeDrawBG(d.model, d.color, d.params));
          pass.setVertexBuffer(0, d.mesh.vertex);
          pass.setIndexBuffer(d.mesh.index, 'uint32');
          pass.drawIndexed(d.mesh.count);
        }
        pass.end();
      }

      // 6. 调色
      {
        const bg = device.createBindGroup({
          layout: this._layouts.tonemapLayout,
          entries: [
            { binding: 0, resource: this._colorView },
            { binding: 1, resource: this._sampler },
          ],
        });
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          }],
        });
        pass.setPipeline(this.pipeTonemap);
        pass.setBindGroup(0, bg);
        pass.draw(3);
        pass.end();
      }

      device.queue.submit([encoder.finish()]);
    }

    async finishFrame() {
      await this.device.queue.onSubmittedWorkDone();
    }

    makeStorageBuffer(data, usage) {
      const u = usage || (GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      const buf = this.device.createBuffer({ size: Math.max(16, ((data.byteLength + 15) >> 4) << 4), usage: u });
      this.device.queue.writeBuffer(buf, 0, data);
      return buf;
    }

    writeBuffer(buf, data) {
      this.device.queue.writeBuffer(buf, 0, data);
    }
  }

  global.GPURenderer = Renderer;
  global.GeoBuilder = { buildBox, buildSphere, buildCylinder };
})(window);
