// Shared WebGPU context, studio lighting, shadow map, sky backdrop, stage bench, instanced spheres, and ACES tonemapper
window.GpuCore = (() => {
  'use strict';

  const SHADER_COMMON = /* wgsl */`
    struct FrameUniforms {
      viewProj: mat4x4<f32>,
      invViewProj: mat4x4<f32>,
      view: mat4x4<f32>,
      proj: mat4x4<f32>,
      lightViewProj: mat4x4<f32>,
      eyePos: vec4<f32>,        // xyz, w = time
      lightDir: vec4<f32>,      // xyz normalized to light, w = sunIntensity
      screenSize: vec4<f32>,    // width, height, invW, invH
      sceneParams: vec4<f32>,   // x = exposure, y = waterLevel, z = tankFlag, w = causticsStrength
    };

    fn studioEnv(R: vec3<f32>, roughness: f32) -> vec3<f32> {
      let up = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
      var col = mix(vec3<f32>(0.07, 0.09, 0.12), vec3<f32>(0.18, 0.22, 0.28), pow(up, 0.85));

      // Overhead softbox #1 (main warm-white key panel)
      let sb1Dir = normalize(vec3<f32>(-0.35, 0.88, 0.32));
      let d1 = max(dot(R, sb1Dir), 0.0);
      let box1 = smoothstep(0.86 - roughness * 0.35, 0.96, d1);
      col += vec3<f32>(1.65, 1.60, 1.52) * box1 * (1.0 - roughness * 0.55);

      // Back-right cool rim strip softbox
      let sb2Dir = normalize(vec3<f32>(0.55, 0.42, -0.72));
      let d2 = max(dot(R, sb2Dir), 0.0);
      let box2 = smoothstep(0.84 - roughness * 0.3, 0.955, d2);
      col += vec3<f32>(0.75, 1.05, 1.45) * box2 * (1.0 - roughness * 0.45);

      // Front-left subtle fill softbox
      let sb3Dir = normalize(vec3<f32>(-0.72, 0.30, 0.62));
      let d3 = max(dot(R, sb3Dir), 0.0);
      let box3 = smoothstep(0.75 - roughness * 0.35, 0.94, d3);
      col += vec3<f32>(0.45, 0.50, 0.58) * box3 * (1.0 - roughness * 0.5);

      // Horizon studio bounce band
      let horiz = exp(-abs(R.y) * 5.0);
      col += vec3<f32>(0.14, 0.16, 0.20) * horiz;
      return col;
    }

    fn sampleShadowPCF(
      shadowTex: texture_depth_2d,
      shadowSamp: sampler_comparison,
      worldPos: vec3<f32>,
      worldNormal: vec3<f32>,
      lightViewProj: mat4x4<f32>,
      lightDir: vec3<f32>
    ) -> f32 {
      let ndl = max(dot(worldNormal, lightDir), 0.0);
      let biasPos = worldPos + worldNormal * (0.008 + 0.018 * (1.0 - ndl));
      let lp = lightViewProj * vec4<f32>(biasPos, 1.0);
      let proj = lp.xyz / lp.w;
      let uv = vec2<f32>(proj.x * 0.5 + 0.5, 0.5 - proj.y * 0.5);
      if (uv.x < 0.002 || uv.x > 0.998 || uv.y < 0.002 || uv.y > 0.998 || proj.z < 0.0 || proj.z > 1.0) {
        return 1.0;
      }
      let texel = 1.0 / 2048.0;
      let depthRef = proj.z - 0.00055;
      var sum = 0.0;
      for (var oy = -1; oy <= 1; oy++) {
        for (var ox = -1; ox <= 1; ox++) {
          sum += textureSampleCompareLevel(shadowTex, shadowSamp, uv + vec2<f32>(f32(ox), f32(oy)) * texel * 1.4, depthRef);
        }
      }
      return sum / 9.0;
    }

    fn hash31(p: vec3<f32>) -> f32 {
      var q = fract(p * 0.1031);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }

    fn valueNoise3(p: vec3<f32>) -> f32 {
      let i = floor(p);
      let f = fract(p);
      let u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash31(i + vec3<f32>(0.0,0.0,0.0)), hash31(i + vec3<f32>(1.0,0.0,0.0)), u.x),
            mix(hash31(i + vec3<f32>(0.0,1.0,0.0)), hash31(i + vec3<f32>(1.0,1.0,0.0)), u.x), u.y),
        mix(mix(hash31(i + vec3<f32>(0.0,0.0,1.0)), hash31(i + vec3<f32>(1.0,0.0,1.0)), u.x),
            mix(hash31(i + vec3<f32>(0.0,1.0,1.0)), hash31(i + vec3<f32>(1.0,1.0,1.0)), u.x), u.y),
        u.z
      );
    }
  `;

  const BACKDROP_WGSL = SHADER_COMMON + /* wgsl */`
    @group(0) @binding(0) var<uniform> u: FrameUniforms;

    struct VSOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) uv: vec2<f32>,
    };

    @vertex
    fn vs(@builtin(vertex_index) vid: u32) -> VSOut {
      var pts = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
      );
      var out: VSOut;
      let p = pts[vid];
      out.pos = vec4<f32>(p, 0.99999, 1.0);
      out.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
      return out;
    }

    @fragment
    fn fs(in: VSOut) -> @location(0) vec4<f32> {
      let ndc = vec4<f32>(in.uv.x * 2.0 - 1.0, 1.0 - in.uv.y * 2.0, 1.0, 1.0);
      let wp = u.invViewProj * ndc;
      let dir = normalize(wp.xyz / wp.w - u.eyePos.xyz);

      // Smooth architectural cyclorama gradient
      let y = clamp(dir.y * 0.55 + 0.42, 0.0, 1.0);
      var bg = mix(vec3<f32>(0.085, 0.105, 0.135), vec3<f32>(0.185, 0.225, 0.285), smoothstep(0.05, 0.85, y));
      // Subtle radial studio cyclorama spotlight behind center stage
      let spot = exp(-length(in.uv - vec2<f32>(0.5, 0.44)) * 2.1);
      bg += vec3<f32>(0.085, 0.105, 0.135) * spot;
      return vec4<f32>(bg, 1.0);
    }
  `;

  // Stage lab bench / pedestal + subtle calibrated grid + bevel trim
  const STAGE_WGSL = SHADER_COMMON + /* wgsl */`
    @group(0) @binding(0) var<uniform> u: FrameUniforms;
    @group(0) @binding(1) var shadowTex: texture_depth_2d;
    @group(0) @binding(2) var shadowSamp: sampler_comparison;
    @group(0) @binding(3) var<uniform> stageBox: vec4<f32>; // xyz = halfExtents (x, thickness, z), w = gridScale
    @group(0) @binding(4) var<uniform> stageOffset: vec4<f32>; // xyz = center offset, w = unused

    struct VIn {
      @location(0) pos: vec3<f32>,
      @location(1) norm: vec3<f32>,
    };

    struct VOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) wPos: vec3<f32>,
      @location(1) wNorm: vec3<f32>,
    };

    @vertex
    fn vs(in: VIn) -> VOut {
      var out: VOut;
      let world = in.pos * stageBox.xyz + stageOffset.xyz;
      out.wPos = world;
      out.wNorm = normalize(in.norm);
      out.pos = u.viewProj * vec4<f32>(world, 1.0);
      return out;
    }

    @vertex
    fn vsShadow(in: VIn) -> @builtin(position) vec4<f32> {
      let world = in.pos * stageBox.xyz + stageOffset.xyz;
      return u.lightViewProj * vec4<f32>(world, 1.0);
    }

    @fragment
    fn fs(in: VOut) -> @location(0) vec4<f32> {
      let N = normalize(in.wNorm);
      let V = normalize(u.eyePos.xyz - in.wPos);
      let L = normalize(u.lightDir.xyz);

      // Top face: neutral mineral slate lab slab with calibrated grid lines
      let isTop = N.y > 0.7;
      let grain = valueNoise3(in.wPos * 14.0) * 0.03 + valueNoise3(in.wPos * 42.0) * 0.015;
      var albedo = select(vec3<f32>(0.15, 0.17, 0.21), vec3<f32>(0.42, 0.45, 0.50) + grain, isTop);
      var roughness = select(0.45, 0.54 - grain * 1.4, isTop);

      let g = in.wPos.xz * stageBox.w;
      let majorG = in.wPos.xz * (stageBox.w * 0.2);
      let fwG = max(fwidth(g.x), 0.001);
      let fwMajor = max(fwidth(majorG.x), 0.001);
      let radialDist = length((in.wPos.xz - stageOffset.xz) / max(stageBox.xz, vec2<f32>(1.0)));
      let gridDistFade = 1.0 - smoothstep(0.65, 1.05, radialDist);

      if (isTop) {
        let lineDist = min(abs(fract(g.x - 0.5) - 0.5), abs(fract(g.y - 0.5) - 0.5)) / fwG;
        let gridMask = (1.0 - smoothstep(0.0, 1.35, lineDist)) * gridDistFade;
        let majorDist = min(abs(fract(majorG.x - 0.5) - 0.5), abs(fract(majorG.y - 0.5) - 0.5)) / fwMajor;
        let majorMask = (1.0 - smoothstep(0.0, 1.5, majorDist)) * gridDistFade;
        albedo = mix(albedo, vec3<f32>(0.30, 0.34, 0.40), gridMask * 0.38);
        albedo = mix(albedo, vec3<f32>(0.22, 0.26, 0.32), majorMask * 0.55);

        // Subtle outer edge metal trim
        let edgeX = abs(in.wPos.x - stageOffset.x) / stageBox.x;
        let edgeZ = abs(in.wPos.z - stageOffset.z) / stageBox.z;
        let rim = smoothstep(0.96, 0.992, max(edgeX, edgeZ));
        albedo = mix(albedo, vec3<f32>(0.20, 0.23, 0.28), rim);
        roughness = mix(roughness, 0.32, rim);
      }

      let shadow = sampleShadowPCF(shadowTex, shadowSamp, in.wPos, N, u.lightViewProj, L);
      let ndl = max(dot(N, L), 0.0);
      let H = normalize(L + V);
      let ndh = max(dot(N, H), 0.0);
      let specPow = mix(96.0, 14.0, roughness);
      let spec = pow(ndh, specPow) * mix(0.28, 0.04, roughness);

      let R = reflect(-V, N);
      let env = studioEnv(R, roughness);
      let F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);

      // Soft studio skylight fill + directional key with shadow
      let hemi = mix(vec3<f32>(0.18, 0.20, 0.24), vec3<f32>(0.44, 0.48, 0.54), N.y * 0.5 + 0.5);
      let direct = vec3<f32>(1.35, 1.32, 1.26) * ndl * (0.14 + 0.86 * shadow);
      let color = albedo * (hemi * 0.65 + direct) + (spec * shadow + env * F * 0.38);
      return vec4<f32>(color, 1.0);
    }
  `;

  // Instanced Rigid Sphere shader (steel, cast-iron, granite, or smooth glossy colored spheres + optional underwater caustics!)
  const SPHERE_WGSL = SHADER_COMMON + /* wgsl */`
    struct SphereInstance {
      posRadius: vec4<f32>,    // xyz = center, w = radius
      colorMat: vec4<f32>,     // rgb = base color, w = materialType (0=steel, 1=iron, 2=granite, 3=glossy-ceramic)
      rotQuat: vec4<f32>,      // rotation quaternion for rolling texture cues
      extra: vec4<f32>,        // x = roughness, y = metallic, z = underwaterCausticsFactor, w = unused
    };

    @group(0) @binding(0) var<uniform> u: FrameUniforms;
    @group(0) @binding(1) var shadowTex: texture_depth_2d;
    @group(0) @binding(2) var shadowSamp: sampler_comparison;
    @group(0) @binding(3) var<storage, read> spheres: array<SphereInstance>;
    @group(0) @binding(4) var causticTex: texture_2d<f32>;
    @group(0) @binding(5) var causticSamp: sampler;

    struct VIn {
      @location(0) pos: vec3<f32>,
      @location(1) norm: vec3<f32>,
    };

    struct VOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) wPos: vec3<f32>,
      @location(1) wNorm: vec3<f32>,
      @location(2) localPos: vec3<f32>,
      @location(3) @interpolate(flat) idx: u32,
    };

    fn rotateQuat(v: vec3<f32>, q: vec4<f32>) -> vec3<f32> {
      let t = 2.0 * cross(q.xyz, v);
      return v + q.w * t + cross(q.xyz, t);
    }

    @vertex
    fn vs(in: VIn, @builtin(instance_index) inst: u32) -> VOut {
      let s = spheres[inst];
      let r = s.posRadius.w;
      let rotated = rotateQuat(in.pos, s.rotQuat);
      let rotatedN = normalize(rotateQuat(in.norm, s.rotQuat));
      let world = s.posRadius.xyz + rotated * r;

      var out: VOut;
      out.pos = u.viewProj * vec4<f32>(world, 1.0);
      out.wPos = world;
      out.wNorm = rotatedN;
      out.localPos = in.pos;
      out.idx = inst;
      return out;
    }

    @vertex
    fn vsShadow(in: VIn, @builtin(instance_index) inst: u32) -> @builtin(position) vec4<f32> {
      let s = spheres[inst];
      let rotated = rotateQuat(in.pos, s.rotQuat);
      let world = s.posRadius.xyz + rotated * s.posRadius.w;
      return u.lightViewProj * vec4<f32>(world, 1.0);
    }

    @fragment
    fn fs(in: VOut) -> @location(0) vec4<f32> {
      let s = spheres[in.idx];
      let N = normalize(in.wNorm);
      let V = normalize(u.eyePos.xyz - in.wPos);
      let L = normalize(u.lightDir.xyz);

      var albedo = s.colorMat.rgb;
      var rough = s.extra.x;
      var metallic = s.extra.y;
      let matType = s.colorMat.w;

      // Subtle procedural surface micro-detail so rolling & rotation are visually unmistakable!
      if (matType < 0.5) {
        // Brushed steel with equatorial machined ring
        let brush = valueNoise3(vec3<f32>(in.localPos.x * 6.0, in.localPos.y * 44.0, in.localPos.z * 6.0));
        rough = clamp(rough + (brush - 0.5) * 0.08, 0.08, 0.5);
        let seam = smoothstep(0.06, 0.015, abs(in.localPos.y));
        albedo = mix(albedo, albedo * 0.72, seam * 0.45);
      } else if (matType < 1.5) {
        // Dark cast iron with subtle dimpled texture
        let pit = valueNoise3(in.localPos * 16.0);
        albedo *= 0.85 + 0.30 * pit;
        rough = clamp(rough + (0.5 - pit) * 0.14, 0.25, 0.75);
      } else if (matType < 2.5) {
        // Speckled granite stone
        let n1 = valueNoise3(in.localPos * 9.0);
        let n2 = valueNoise3(in.localPos * 28.0);
        let fleck = step(0.68, n2);
        let darkFleck = step(0.72, valueNoise3(in.localPos * 23.0 + 7.1));
        albedo = mix(albedo * (0.8 + 0.4 * n1), vec3<f32>(0.85, 0.83, 0.80), fleck * 0.65);
        albedo = mix(albedo, vec3<f32>(0.15, 0.16, 0.18), darkFleck * 0.75);
      } else {
        // Scene 2 density sphere: vibrant glossy-ceramic finish with crisp white meridian ring so rolling spin reads cleanly!
        let band = smoothstep(0.085, 0.032, abs(in.localPos.y));
        albedo = mix(albedo, mix(albedo * 0.42, vec3<f32>(0.96), 0.55), band * 0.65);
        metallic = 0.02;
        rough = 0.16;
      }

      let shadow = sampleShadowPCF(shadowTex, shadowSamp, in.wPos, N, u.lightViewProj, L);
      let ndl = max(dot(N, L), 0.0);
      let ndv = max(dot(N, V), 0.001);
      let H = normalize(L + V);
      let ndh = max(dot(N, H), 0.0);

      let F0 = mix(vec3<f32>(0.045), albedo, metallic);
      let F = F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - ndv, 5.0);
      let specExp = mix(220.0, 14.0, rough * rough);
      let specNorm = (specExp + 8.0) / 25.13;
      let spec = pow(ndh, specExp) * specNorm * 0.18;

      let R = reflect(-V, N);
      let env = studioEnv(R, rough);

      // Rim light for crisp separation
      let rimDir = normalize(vec3<f32>(0.55, 0.45, -0.7));
      let rim = pow(1.0 - ndv, 3.0) * max(dot(N, rimDir), 0.0) * 0.45;

      // Caustics when inside Scene 2 tank
      var causticBoost = vec3<f32>(0.0);
      if (u.sceneParams.z > 0.5 && in.wPos.y < u.sceneParams.y + 0.25) {
        let cuv = vec2<f32>(in.wPos.x / 5.6, in.wPos.z / 1.4);
        if (cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0) {
          let c = textureSampleLevel(causticTex, causticSamp, cuv, 0.0).r;
          let subMask = smoothstep(u.sceneParams.y + 0.06, u.sceneParams.y - 0.05, in.wPos.y);
          causticBoost = vec3<f32>(0.65, 0.92, 1.0) * c * subMask * max(N.y * 0.7 + 0.3, 0.1) * u.sceneParams.w;
        }
      }

      let hemi = mix(vec3<f32>(0.18, 0.21, 0.26), vec3<f32>(0.55, 0.58, 0.64), N.y * 0.5 + 0.5);
      let kD = (1.0 - metallic) * (vec3<f32>(1.0) - F);
      let directLight = vec3<f32>(1.45, 1.40, 1.32) * ndl * (0.14 + 0.86 * shadow) + causticBoost;
      let col = kD * albedo * (hemi * 0.62 + directLight) + F * env * mix(0.65, 1.25, metallic) + F * spec * (0.2 + 0.8 * shadow) * 2.2 + vec3<f32>(0.55, 0.72, 0.95) * rim;
      return vec4<f32>(col, 1.0);
    }
  `;

  const TONEMAP_WGSL = /* wgsl */`
    @group(0) @binding(0) var hdrTex: texture_2d<f32>;
    @group(0) @binding(1) var samp: sampler;
    @group(0) @binding(2) var<uniform> params: vec4<f32>; // x = exposure

    struct VSOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) uv: vec2<f32>,
    };

    @vertex
    fn vs(@builtin(vertex_index) vid: u32) -> VSOut {
      var pts = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
      );
      var out: VSOut;
      let p = pts[vid];
      out.pos = vec4<f32>(p, 0.0, 1.0);
      out.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
      return out;
    }

    fn acesFilmic(x: vec3<f32>) -> vec3<f32> {
      let a = 2.51;
      let b = 0.03;
      let c = 2.43;
      let d = 0.59;
      let e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
    }

    @fragment
    fn fs(in: VSOut) -> @location(0) vec4<f32> {
      var col = textureSample(hdrTex, samp, in.uv).rgb * params.x;
      // Subtle studio vignette
      let d = length(in.uv - vec2<f32>(0.5, 0.5));
      col *= 1.0 - smoothstep(0.45, 0.95, d) * 0.16;
      col = acesFilmic(col);
      col = pow(col, vec3<f32>(1.0 / 2.2));
      return vec4<f32>(col, 1.0);
    }
  `;

  function createUnitBoxGeometry(device) {
    // [-1, 1] x [-1, 1] x [-1, 1] cube with normals
    const v = [
      // +Y top
      -1, 1, -1, 0, 1, 0,  -1, 1,  1, 0, 1, 0,   1, 1,  1, 0, 1, 0,
      -1, 1, -1, 0, 1, 0,   1, 1,  1, 0, 1, 0,   1, 1, -1, 0, 1, 0,
      // -Y bottom
      -1,-1,  1, 0,-1, 0,  -1,-1, -1, 0,-1, 0,   1,-1, -1, 0,-1, 0,
      -1,-1,  1, 0,-1, 0,   1,-1, -1, 0,-1, 0,   1,-1,  1, 0,-1, 0,
      // +X
       1,-1,  1, 1, 0, 0,   1,-1, -1, 1, 0, 0,   1, 1, -1, 1, 0, 0,
       1,-1,  1, 1, 0, 0,   1, 1, -1, 1, 0, 0,   1, 1,  1, 1, 0, 0,
      // -X
      -1,-1, -1,-1, 0, 0,  -1,-1,  1,-1, 0, 0,  -1, 1,  1,-1, 0, 0,
      -1,-1, -1,-1, 0, 0,  -1, 1,  1,-1, 0, 0,  -1, 1, -1,-1, 0, 0,
      // +Z
      -1,-1,  1, 0, 0, 1,   1,-1,  1, 0, 0, 1,   1, 1,  1, 0, 0, 1,
      -1,-1,  1, 0, 0, 1,   1, 1,  1, 0, 0, 1,  -1, 1,  1, 0, 0, 1,
      // -Z
       1,-1, -1, 0, 0,-1,  -1,-1, -1, 0, 0,-1,  -1, 1, -1, 0, 0,-1,
       1,-1, -1, 0, 0,-1,  -1, 1, -1, 0, 0,-1,   1, 1, -1, 0, 0,-1,
    ];
    const data = new Float32Array(v);
    const buf = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(buf, 0, data);
    return { vertexBuffer: buf, vertexCount: 36 };
  }

  function createUnitSphereGeometry(device, latSegments = 24, lonSegments = 36) {
    const verts = [];
    const indices = [];
    for (let y = 0; y <= latSegments; y++) {
      const v = y / latSegments;
      const phi = v * Math.PI;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      for (let x = 0; x <= lonSegments; x++) {
        const u = x / lonSegments;
        const theta = u * Math.PI * 2;
        const nx = sinP * Math.cos(theta);
        const ny = cosP;
        const nz = sinP * Math.sin(theta);
        verts.push(nx, ny, nz, nx, ny, nz);
      }
    }
    const stride = lonSegments + 1;
    for (let y = 0; y < latSegments; y++) {
      for (let x = 0; x < lonSegments; x++) {
        const a = y * stride + x;
        const b = a + stride;
        const c = a + 1;
        const d = b + 1;
        if (y !== 0) indices.push(a, c, b);
        if (y !== latSegments - 1) indices.push(c, d, b);
      }
    }
    const vData = new Float32Array(verts);
    const iData = new Uint16Array(indices);
    const vBuf = device.createBuffer({ size: vData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const iBuf = device.createBuffer({ size: Math.ceil(iData.byteLength / 4) * 4, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vBuf, 0, vData);
    device.queue.writeBuffer(iBuf, 0, iData);
    return { vertexBuffer: vBuf, indexBuffer: iBuf, indexCount: indices.length };
  }

  class SharedGPU {
    constructor() {
      this.device = null;
      this.context = null;
      this.format = 'bgra8unorm';
      this.canvas = null;
      this.width = 1280;
      this.height = 720;

      // Render targets
      this.opaqueColorTex = null;
      this.opaqueDepthTex = null;
      this.sceneDepthTex = null;
      this.hdrColorTex = null;
      this.shadowTex = null;
      this.dummyCausticTex = null;
    }

    async init(canvas) {
      this.canvas = canvas;
      if (!navigator.gpu) {
        throw new Error('浏览器未启用 WebGPU');
      }
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('未能获取到 WebGPU 显卡适配器');
      this.device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage),
          maxStorageBufferBindingSize: Math.min(268435456, adapter.limits.maxStorageBufferBindingSize),
          maxComputeInvocationsPerWorkgroup: Math.min(512, adapter.limits.maxComputeInvocationsPerWorkgroup),
        }
      });
      this.device.lost.then((info) => {
        console.error('WebGPU device lost:', info);
      });

      this.context = canvas.getContext('webgpu');
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'opaque'
      });

      this._createCommonResources();
      this.resize(window.innerWidth, window.innerHeight);
    }

    _createCommonResources() {
      const d = this.device;
      this.frameUniformBuf = d.createBuffer({ size: 512, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.tonemapParamBuf = d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      d.queue.writeBuffer(this.tonemapParamBuf, 0, new Float32Array([1.08, 0, 0, 0]));

      this.stageBoxBuf = d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.stageOffsetBuf = d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

      this.linearSampler = d.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
      this.shadowSampler = d.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });

      this.shadowTex = d.createTexture({
        size: [2048, 2048],
        format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      this.shadowView = this.shadowTex.createView();

      this.dummyCausticTex = d.createTexture({
        size: [4, 4],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      d.queue.writeTexture({ texture: this.dummyCausticTex }, new Uint16Array(16 * 4), { bytesPerRow: 32 }, [4, 4]);
      this.dummyCausticView = this.dummyCausticTex.createView();
      this.causticSampler = d.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
      this.nearestSampler = d.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });

      this.boxGeom = createUnitBoxGeometry(d);
      this.sphereGeom = createUnitSphereGeometry(d, 24, 36);

      // Sphere storage buffer (up to 64 spheres shared by Scene 1 & Scene 2)
      this.maxSpheres = 64;
      this.sphereData = new Float32Array(this.maxSpheres * 16);
      this.sphereStorageBuf = d.createBuffer({
        size: this.sphereData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      this._createPipelines();
    }

    _createPipelines() {
      const d = this.device;

      // Backdrop pipeline
      const bgMod = d.createShaderModule({ code: BACKDROP_WGSL });
      this.backdropPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: bgMod, entryPoint: 'vs' },
        fragment: { module: bgMod, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'always' }
      });
      this.backdropBG = d.createBindGroup({
        layout: this.backdropPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.frameUniformBuf } }]
      });

      // Stage bench pipeline + shadow pipeline
      const stageMod = d.createShaderModule({ code: STAGE_WGSL });
      const stageVLayout = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] }];
      this.stagePipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: stageMod, entryPoint: 'vs', buffers: stageVLayout },
        fragment: { module: stageMod, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });
      this.stageShadowPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: stageMod, entryPoint: 'vsShadow', buffers: stageVLayout },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });
      this.stageBG = d.createBindGroup({
        layout: this.stagePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.frameUniformBuf } },
          { binding: 1, resource: this.shadowView },
          { binding: 2, resource: this.shadowSampler },
          { binding: 3, resource: { buffer: this.stageBoxBuf } },
          { binding: 4, resource: { buffer: this.stageOffsetBuf } },
        ]
      });
      this.stageShadowBG = d.createBindGroup({
        layout: this.stageShadowPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.frameUniformBuf } },
          { binding: 3, resource: { buffer: this.stageBoxBuf } },
          { binding: 4, resource: { buffer: this.stageOffsetBuf } },
        ]
      });

      // Sphere pipeline + shadow pipeline
      const sphMod = d.createShaderModule({ code: SPHERE_WGSL });
      const sphVLayout = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] }];
      this.spherePipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: sphMod, entryPoint: 'vs', buffers: sphVLayout },
        fragment: { module: sphMod, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });
      this.sphereShadowPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: sphMod, entryPoint: 'vsShadow', buffers: sphVLayout },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });
      this.sphereShadowBG = d.createBindGroup({
        layout: this.sphereShadowPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.frameUniformBuf } },
          { binding: 3, resource: { buffer: this.sphereStorageBuf } },
        ]
      });
      this.sphereBG = this.createSphereBindGroup(this.dummyCausticView, this.sphereStorageBuf);

      // Tonemap pipeline
      const tmMod = d.createShaderModule({ code: TONEMAP_WGSL });
      this.tonemapPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: tmMod, entryPoint: 'vs' },
        fragment: { module: tmMod, entryPoint: 'fs', targets: [{ format: this.format }] },
        primitive: { topology: 'triangle-list' }
      });
    }

    createSphereBindGroup(causticView, customSphereBuf) {
      return this.device.createBindGroup({
        layout: this.spherePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.frameUniformBuf } },
          { binding: 1, resource: this.shadowView },
          { binding: 2, resource: this.shadowSampler },
          { binding: 3, resource: { buffer: customSphereBuf || this.sphereStorageBuf } },
          { binding: 4, resource: causticView || this.dummyCausticView },
          { binding: 5, resource: this.causticSampler },
        ]
      });
    }

    resize(cssWidth, cssHeight, forceExact = false) {
      const dpr = forceExact ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.min(3840, Math.round(cssWidth * dpr)));
      const h = Math.max(2, Math.min(2160, Math.round(cssHeight * dpr)));
      if (this.width === w && this.height === h && this.opaqueColorTex) return false;

      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;

      if (this.opaqueColorTex) this.opaqueColorTex.destroy();
      if (this.opaqueDepthTex) this.opaqueDepthTex.destroy();
      if (this.sceneDepthTex) this.sceneDepthTex.destroy();
      if (this.hdrColorTex) this.hdrColorTex.destroy();

      const d = this.device;
      this.opaqueColorTex = d.createTexture({
        size: [w, h],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
      });
      this.opaqueColorView = this.opaqueColorTex.createView();

      this.hdrColorTex = d.createTexture({
        size: [w, h],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      this.hdrColorView = this.hdrColorTex.createView();

      this.opaqueDepthTex = d.createTexture({
        size: [w, h],
        format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
      });
      this.opaqueDepthView = this.opaqueDepthTex.createView();

      this.sceneDepthTex = d.createTexture({
        size: [w, h],
        format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
      });
      this.sceneDepthView = this.sceneDepthTex.createView();

      this.tonemapBG = d.createBindGroup({
        layout: this.tonemapPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.hdrColorView },
          { binding: 1, resource: this.linearSampler },
          { binding: 2, resource: { buffer: this.tonemapParamBuf } }
        ]
      });
      return true;
    }

    updateFrameUniforms(cam, lightTarget, lightHalfExtent, time, sceneParams) {
      const M = window.AppMath;
      const aspect = this.width / this.height;
      const proj = new Float32Array(16);
      const view = new Float32Array(16);
      const vp = new Float32Array(16);
      const invVp = new Float32Array(16);
      M.mat4PerspectiveZO(proj, cam.fovRad || (42 * Math.PI / 180), aspect, 0.05, 80.0);
      M.mat4LookAt(view, cam.eye, cam.target, [0, 1, 0]);
      M.mat4Multiply(vp, proj, view);
      M.mat4Invert(invVp, vp);

      // Directional key light
      const ld = [-0.42, 0.84, 0.34];
      const ldLen = Math.hypot(ld[0], ld[1], ld[2]);
      ld[0] /= ldLen; ld[1] /= ldLen; ld[2] /= ldLen;

      const lightEye = [
        lightTarget[0] + ld[0] * 14.0,
        lightTarget[1] + ld[1] * 14.0,
        lightTarget[2] + ld[2] * 14.0
      ];
      const lView = new Float32Array(16);
      const lProj = new Float32Array(16);
      const lVp = new Float32Array(16);
      M.mat4LookAt(lView, lightEye, lightTarget, [0, 1, 0]);
      M.mat4OrthoZO(lProj, -lightHalfExtent, lightHalfExtent, -lightHalfExtent * 0.85, lightHalfExtent * 0.85, 1.0, 28.0);
      M.mat4Multiply(lVp, lProj, lView);

      // Pack FrameUniforms (24 * 16 bytes = 384 bytes)
      const buf = new Float32Array(96);
      buf.set(vp, 0);
      buf.set(invVp, 16);
      buf.set(view, 32);
      buf.set(proj, 48);
      buf.set(lVp, 64);
      buf.set([cam.eye[0], cam.eye[1], cam.eye[2], time], 80);
      buf.set([ld[0], ld[1], ld[2], 1.0], 84);
      buf.set([this.width, this.height, 1 / this.width, 1 / this.height], 88);
      buf.set(sceneParams || [1.08, 0, 0, 0], 92);
      this.device.queue.writeBuffer(this.frameUniformBuf, 0, buf);
    }

    setStageTransform(halfExtents, centerOffset, gridScale = 2.0) {
      this.device.queue.writeBuffer(this.stageBoxBuf, 0, new Float32Array([halfExtents[0], halfExtents[1], halfExtents[2], gridScale]));
      this.device.queue.writeBuffer(this.stageOffsetBuf, 0, new Float32Array([centerOffset[0], centerOffset[1], centerOffset[2], 0]));
    }

    uploadSpheres(sphereList) {
      const count = Math.min(this.maxSpheres, sphereList.length);
      for (let i = 0; i < count; i++) {
        const s = sphereList[i];
        const o = i * 16;
        this.sphereData[o + 0] = s.pos[0];
        this.sphereData[o + 1] = s.pos[1];
        this.sphereData[o + 2] = s.pos[2];
        this.sphereData[o + 3] = s.radius;
        this.sphereData[o + 4] = s.color[0];
        this.sphereData[o + 5] = s.color[1];
        this.sphereData[o + 6] = s.color[2];
        this.sphereData[o + 7] = s.matType ?? 0;
        this.sphereData[o + 8] = s.quat ? s.quat[0] : 0;
        this.sphereData[o + 9] = s.quat ? s.quat[1] : 0;
        this.sphereData[o + 10] = s.quat ? s.quat[2] : 0;
        this.sphereData[o + 11] = s.quat ? s.quat[3] : 1;
        this.sphereData[o + 12] = s.roughness ?? 0.25;
        this.sphereData[o + 13] = s.metallic ?? 0.85;
        this.sphereData[o + 14] = 0;
        this.sphereData[o + 15] = 0;
      }
      if (count > 0) {
        this.device.queue.writeBuffer(this.sphereStorageBuf, 0, this.sphereData.subarray(0, count * 16));
      }
      return count;
    }

    renderToneMap(encoder) {
      const view = this.context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 }
        }]
      });
      pass.setPipeline(this.tonemapPipeline);
      pass.setBindGroup(0, this.tonemapBG);
      pass.draw(3);
      pass.end();
    }
  }

  return { SharedGPU, SHADER_COMMON };
})();
