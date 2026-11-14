// Scene 1: 3D Tetrahedral Neo-Hookean XPBD Soft-Body Jelly + Dynamic Fracture + PN-Triangle Translucent Renderer
window.SceneJelly = (() => {
  'use strict';

  const M = window.AppMath;

  const JELLY_THICKNESS_WGSL = window.GpuCore.SHADER_COMMON + /* wgsl */`
    @group(0) @binding(0) var<uniform> u: FrameUniforms;
    @group(0) @binding(1) var opaqueDepthTex: texture_depth_2d;

    struct VIn {
      @location(0) pos: vec3<f32>,
      @location(1) norm: vec3<f32>,
      @location(2) color: vec3<f32>,
      @location(3) jMeta: vec2<f32>, // x = isCrack, y = stressGlow
    };

    struct VOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) wPos: vec3<f32>,
      @location(1) viewZ: f32,
    };

    @vertex
    fn vs(in: VIn) -> VOut {
      var out: VOut;
      out.pos = u.viewProj * vec4<f32>(in.pos, 1.0);
      out.wPos = in.pos;
      let vp = u.view * vec4<f32>(in.pos, 1.0);
      out.viewZ = -vp.z;
      return out;
    }

    @fragment
    fn fs(in: VOut, @builtin(front_facing) isFront: bool) -> @location(0) vec4<f32> {
      let pix = vec2<i32>(in.pos.xy);
      let opDepth = textureLoad(opaqueDepthTex, pix, 0);
      if (in.pos.z >= opDepth) {
        discard;
      }
      // Parity sum: front subtracts linearZ, back adds linearZ
      let sign = select(1.0, -1.0, isFront);
      return vec4<f32>(sign * in.viewZ, -sign, 0.0, 1.0);
    }
  `;

  const JELLY_SURFACE_WGSL = window.GpuCore.SHADER_COMMON + /* wgsl */`
    @group(0) @binding(0) var<uniform> u: FrameUniforms;
    @group(0) @binding(1) var shadowTex: texture_depth_2d;
    @group(0) @binding(2) var shadowSamp: sampler_comparison;
    @group(0) @binding(3) var opaqueColorTex: texture_2d<f32>;
    @group(0) @binding(4) var opaqueDepthTex: texture_depth_2d;
    @group(0) @binding(5) var thicknessTex: texture_2d<f32>;
    @group(0) @binding(6) var linearSamp: sampler;

    struct VIn {
      @location(0) pos: vec3<f32>,
      @location(1) norm: vec3<f32>,
      @location(2) color: vec3<f32>,
      @location(3) jMeta: vec2<f32>, // x = isCrack (0 or 1), y = strain
    };

    struct VOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) wPos: vec3<f32>,
      @location(1) wNorm: vec3<f32>,
      @location(2) absorbCol: vec3<f32>,
      @location(3) jMeta: vec2<f32>,
      @location(4) viewZ: f32,
    };

    @vertex
    fn vs(in: VIn) -> VOut {
      var out: VOut;
      out.pos = u.viewProj * vec4<f32>(in.pos, 1.0);
      out.wPos = in.pos;
      out.wNorm = in.norm;
      out.absorbCol = in.color;
      out.jMeta = in.jMeta;
      let vp = u.view * vec4<f32>(in.pos, 1.0);
      out.viewZ = -vp.z;
      return out;
    }

    @vertex
    fn vsShadow(in: VIn) -> @builtin(position) vec4<f32> {
      return u.lightViewProj * vec4<f32>(in.pos, 1.0);
    }

    fn reconstructOpaqueLinearZ(uv: vec2<f32>, depthSample: f32) -> f32 {
      let ndc = vec4<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, depthSample, 1.0);
      let wp = u.invViewProj * ndc;
      let world = wp.xyz / wp.w;
      let vp = u.view * vec4<f32>(world, 1.0);
      return -vp.z;
    }

    @fragment
    fn fs(in: VOut) -> @location(0) vec4<f32> {
      var N = normalize(in.wNorm);
      let V = normalize(u.eyePos.xyz - in.wPos);
      if (dot(N, V) < 0.0) {
        N = -N;
      }
      let L = normalize(u.lightDir.xyz);
      let isCrack = in.jMeta.x;

      let screenUV = in.pos.xy * u.screenSize.zw;
      let pix = vec2<i32>(in.pos.xy);
      let thickData = textureLoad(thicknessTex, pix, 0);
      let opDepth = textureLoad(opaqueDepthTex, pix, 0);
      let opZ = reconstructOpaqueLinearZ(screenUV, opDepth);

      var thickness = thickData.r;
      if (thickData.g > 0.5) {
        thickness += opZ * thickData.g;
      }
      thickness = clamp(thickness, mix(0.10, 0.34, isCrack), 1.85);

      // View-space soft multi-tap refraction offset (mimics translucent gelatin SSS blur + thickness lensing)
      let viewN = (u.view * vec4<f32>(N, 0.0)).xyz;
      let refractStrength = mix(0.030, 0.052, clamp(thickness * 0.85, 0.0, 1.0));
      let refrUV = clamp(screenUV - viewN.xy * refractStrength * vec2<f32>(1.0, -1.0), vec2<f32>(0.003), vec2<f32>(0.997));
      let blurR = vec2<f32>(u.screenSize.z, u.screenSize.w) * (3.5 + thickness * 5.0);
      var refrColor = textureSampleLevel(opaqueColorTex, linearSamp, refrUV, 0.0).rgb * 0.40;
      refrColor += textureSampleLevel(opaqueColorTex, linearSamp, clamp(refrUV + vec2<f32>(blurR.x, blurR.y), vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).rgb * 0.15;
      refrColor += textureSampleLevel(opaqueColorTex, linearSamp, clamp(refrUV + vec2<f32>(-blurR.x, blurR.y), vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).rgb * 0.15;
      refrColor += textureSampleLevel(opaqueColorTex, linearSamp, clamp(refrUV + vec2<f32>(blurR.x, -blurR.y), vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).rgb * 0.15;
      refrColor += textureSampleLevel(opaqueColorTex, linearSamp, clamp(refrUV + vec2<f32>(-blurR.x, -blurR.y), vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).rgb * 0.15;

      // Rich gemstone Beer-Lambert volumetric absorption + internal subsurface scatter
      let sigma = (vec3<f32>(1.0) - in.absorbCol) * 4.35 + vec3<f32>(0.26);
      let transmittance = exp(-sigma * thickness);

      // Forward-scattering / internal glow through translucent volume
      let shadow = sampleShadowPCF(shadowTex, shadowSamp, in.wPos, N, u.lightViewProj, L);
      let backScatter = pow(clamp(dot(V, -L + N * 0.45), 0.0, 1.0), 2.4);
      let ndl = max(dot(N, L), 0.0);
      let sss = in.absorbCol * (0.28 + 0.56 * backScatter + 0.36 * ndl * (0.3 + 0.7 * shadow)) * (1.0 - exp(-thickness * 2.0));

      var baseColor = refrColor * transmittance + sss * 0.72;

      // Glossy freshly-cleaved wet gelatin facet tint along internal fracture planes
      if (isCrack > 0.5) {
        let crackTint = in.absorbCol * 0.85 + vec3<f32>(0.02);
        baseColor = mix(baseColor, crackTint * (0.35 + 0.60 * ndl), 0.16);
      }

      // Glossy wet gelatin Fresnel & Studio reflections
      let ndv = max(dot(N, V), 0.001);
      let F = 0.028 + 0.972 * pow(1.0 - ndv, 4.5);
      let R = reflect(-V, N);
      let roughness = mix(0.035, 0.065, isCrack);
      let env = studioEnv(R, roughness);

      let H = normalize(L + V);
      let specPow = mix(260.0, 145.0, isCrack);
      let spec = pow(max(dot(N, H), 0.0), specPow) * mix(1.35, 0.95, isCrack) * (0.25 + 0.75 * shadow);

      // Clean bright rim light to define silhouette during rapid deformation
      let rimDir = normalize(vec3<f32>(0.55, 0.45, -0.7));
      let rim = pow(1.0 - ndv, 3.2) * (0.45 + 0.55 * max(dot(N, rimDir), 0.0));
      let rimCol = mix(in.absorbCol, vec3<f32>(1.0), 0.55) * rim * 0.62;

      let finalCol = mix(baseColor, env, clamp(F * 0.88, 0.0, 0.92)) + vec3<f32>(1.0, 0.98, 0.95) * spec + rimCol;
      return vec4<f32>(finalCol, 1.0);
    }
  `;

  // Helper: build a smooth-warped tetrahedral mesh from an nx*ny*nz grid
  function createJellyBody(opts) {
    const {
      id,
      shape,        // 'dome', 'cushion', 'pillar'
      nx, ny, nz,
      sizeX, sizeY, sizeZ,
      center,       // [x, 0, z]
      color,        // RGB transmission tint
      stiffnessMul,
      toughnessMul
    } = opts;

    const strideX = 1;
    const strideY = nx + 1;
    const strideZ = (nx + 1) * (ny + 1);
    const numVerts = (nx + 1) * (ny + 1) * (nz + 1);

    const restPos = [];
    for (let k = 0; k <= nz; k++) {
      const wz = (k / nz) * 2 - 1;
      for (let j = 0; j <= ny; j++) {
        const vy = j / ny; // [0, 1]
        for (let i = 0; i <= nx; i++) {
          const ux = (i / nx) * 2 - 1;
          let x = ux, y = vy, z = wz;

          if (shape === 'dome') {
            // Smooth elliptic-disk conformal mapping (Shirley-Chiu/Fong) -> zero corner sliver tets!
            const diskX = ux * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * wz * wz));
            const diskZ = wz * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * ux * ux));
            x = M.lerp(ux, diskX, 0.88);
            z = M.lerp(wz, diskZ, 0.88);
            const taper = 1.0 - 0.15 * vy - 0.22 * Math.pow(vy, 4.0);
            x *= taper;
            z *= taper;
            const r2 = Math.min(1.0, x * x + z * z);
            const crown = Math.max(0.0, 1.0 - r2 * 0.72) * 0.13 * Math.pow(vy, 2.0);
            y = vy + crown;
          } else if (shape === 'cushion') {
            const diskX = ux * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * wz * wz));
            const diskZ = wz * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * ux * ux));
            x = M.lerp(ux, diskX, 0.45);
            z = M.lerp(wz, diskZ, 0.45);
            const bevel = 1.0 - 0.10 * Math.pow(Math.abs(vy * 2 - 1), 3.0);
            x *= bevel;
            z *= bevel;
            const r2 = Math.min(1.0, (ux * ux + wz * wz) * 0.5);
            y = vy * (1.0 - 0.08 * r2 * Math.pow(vy, 2.0));
          } else if (shape === 'pillar') {
            const diskX = ux * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * wz * wz));
            const diskZ = wz * Math.sqrt(Math.max(0.0, 1.0 - 0.5 * ux * ux));
            x = M.lerp(ux, diskX, 0.92);
            z = M.lerp(wz, diskZ, 0.92);
            const taper = 1.0 - 0.12 * vy - 0.08 * Math.pow(vy, 3.0);
            x *= taper;
            z *= taper;
            const r2 = Math.min(1.0, x * x + z * z);
            y = vy + Math.max(0.0, 1.0 - r2 * 0.65) * 0.08 * vy * vy;
          }

          restPos.push(
            center[0] + x * sizeX * 0.5,
            center[1] + y * sizeY,
            center[2] + z * sizeZ * 0.5
          );
        }
      }
    }

    const vid = (i, j, k) => i * strideX + j * strideY + k * strideZ;
    const tets = [];
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const c000 = vid(i, j, k);
          const c100 = vid(i + 1, j, k);
          const c010 = vid(i, j + 1, k);
          const c110 = vid(i + 1, j + 1, k);
          const c001 = vid(i, j, k + 1);
          const c101 = vid(i + 1, j, k + 1);
          const c011 = vid(i, j + 1, k + 1);
          const c111 = vid(i + 1, j + 1, k + 1);
          const parity = (i + j + k) & 1;
          if (parity === 0) {
            tets.push(
              [c000, c100, c010, c001],
              [c110, c010, c100, c111],
              [c101, c100, c001, c111],
              [c011, c010, c001, c111],
              [c100, c010, c001, c111]
            );
          } else {
            tets.push(
              [c100, c110, c000, c101],
              [c010, c000, c110, c011],
              [c001, c000, c101, c011],
              [c111, c110, c101, c011],
              [c000, c110, c101, c011]
            );
          }
        }
      }
    }

    // Reserve extra room for dynamic vertex splits during fracture
    const maxVerts = numVerts + 900;
    const numTets = tets.length;

    const pos = new Float32Array(maxVerts * 3);
    const prevPos = new Float32Array(maxVerts * 3);
    const vel = new Float32Array(maxVerts * 3);
    const rest = new Float32Array(maxVerts * 3);
    const invMass = new Float32Array(maxVerts);
    const mass = new Float32Array(maxVerts);
    const vertSplitCooldown = new Int32Array(maxVerts);
    const vertRootId = new Int32Array(maxVerts); // original vertex id for grace against immediate split self-collision

    for (let i = 0; i < numVerts; i++) {
      const rx = restPos[i * 3];
      const ry = restPos[i * 3 + 1];
      const rz = restPos[i * 3 + 2];
      pos[i * 3] = prevPos[i * 3] = rest[i * 3] = rx;
      pos[i * 3 + 1] = prevPos[i * 3 + 1] = rest[i * 3 + 1] = ry;
      pos[i * 3 + 2] = prevPos[i * 3 + 2] = rest[i * 3 + 2] = rz;
      vertRootId[i] = i;
    }

    const tetIds = new Int32Array(numTets * 4);
    const tetBm = new Float32Array(numTets * 9);
    const tetVol = new Float32Array(numTets);
    const tetRestCenter = new Float32Array(numTets * 3);
    const tetStress = new Float32Array(numTets);
    const tetMaxVec = new Float32Array(numTets * 3);
    const tetFractured = new Uint8Array(numTets);

    // Ensure positive rest volume and compute Dm^-1 = Bm
    const density = 1.05;
    for (let t = 0; t < numTets; t++) {
      let [a, b, c, d] = tets[t];
      const ax = rest[a * 3], ay = rest[a * 3 + 1], az = rest[a * 3 + 2];
      let bx = rest[b * 3] - ax, by = rest[b * 3 + 1] - ay, bz = rest[b * 3 + 2] - az;
      let cx = rest[c * 3] - ax, cy = rest[c * 3 + 1] - ay, cz = rest[c * 3 + 2] - az;
      let dx = rest[d * 3] - ax, dy = rest[d * 3 + 1] - ay, dz = rest[d * 3 + 2] - az;

      // det([b, c, d])
      let det = bx * (cy * dz - cz * dy) - cx * (by * dz - bz * dy) + dx * (by * cz - bz * cy);
      if (det < 0) {
        const tmp = c; c = d; d = tmp;
        cx = rest[c * 3] - ax; cy = rest[c * 3 + 1] - ay; cz = rest[c * 3 + 2] - az;
        dx = rest[d * 3] - ax; dy = rest[d * 3 + 1] - ay; dz = rest[d * 3 + 2] - az;
        det = -det;
      }
      const vol = det / 6.0;
      tetVol[t] = Math.max(vol, 1e-7);

      tetIds[t * 4] = a;
      tetIds[t * 4 + 1] = b;
      tetIds[t * 4 + 2] = c;
      tetIds[t * 4 + 3] = d;

      // Invert 3x3 column matrix Dm = [b, c, d]
      const invDet = 1.0 / (det + 1e-12);
      // Row-major of Bm (columns are Dm^-1 columns? Store row-major Bm[row*3 + col] so F = Ds * Bm)
      // Co-factors of Dm = [[bx, cx, dx], [by, cy, dy], [bz, cz, dz]]
      const m00 = (cy * dz - cz * dy) * invDet;
      const m01 = (cz * dx - cx * dz) * invDet;
      const m02 = (cx * dy - cy * dx) * invDet;
      const m10 = (bz * dy - by * dz) * invDet;
      const m11 = (bx * dz - bz * dx) * invDet;
      const m12 = (by * dx - bx * dy) * invDet;
      const m20 = (by * cz - bz * cy) * invDet;
      const m21 = (bz * cx - bx * cz) * invDet;
      const m22 = (bx * cy - by * cx) * invDet;

      const bo = t * 9;
      tetBm[bo + 0] = m00; tetBm[bo + 1] = m01; tetBm[bo + 2] = m02;
      tetBm[bo + 3] = m10; tetBm[bo + 4] = m11; tetBm[bo + 5] = m12;
      tetBm[bo + 6] = m20; tetBm[bo + 7] = m21; tetBm[bo + 8] = m22;

      tetRestCenter[t * 3] = (rest[a * 3] + rest[b * 3] + rest[c * 3] + rest[d * 3]) * 0.25;
      tetRestCenter[t * 3 + 1] = (rest[a * 3 + 1] + rest[b * 3 + 1] + rest[c * 3 + 1] + rest[d * 3 + 1]) * 0.25;
      tetRestCenter[t * 3 + 2] = (rest[a * 3 + 2] + rest[b * 3 + 2] + rest[c * 3 + 2] + rest[d * 3 + 2]) * 0.25;

      const qm = vol * density * 0.25;
      mass[a] += qm; mass[b] += qm; mass[c] += qm; mass[d] += qm;
    }

    for (let i = 0; i < numVerts; i++) {
      invMass[i] = mass[i] > 1e-8 ? 1.0 / mass[i] : 0.0;
    }

    // Build face adjacency (4 faces per tet, outward winding:
    // Local face indices with positive orientation relative to opposite vertex:
    // Tet (0,1,2,3) has positive volume (x1-x0) x (x2-x0) . (x3-x0) > 0:
    // Opposite 3: (0, 2, 1) -> outward normal away from 3!
    // Opposite 2: (0, 1, 3) -> outward normal away from 2!
    // Opposite 1: (0, 3, 2) -> outward normal away from 1!
    // Opposite 0: (1, 2, 3) -> outward normal away from 0!
    const LOCAL_FACES = [
      [1, 2, 3],
      [0, 3, 2],
      [0, 1, 3],
      [0, 2, 1]
    ];

    const facePartner = new Int32Array(numTets * 4).fill(-1);
    const faceIsCrack = new Uint8Array(numTets * 4);
    const faceMap = new Map();

    for (let t = 0; t < numTets; t++) {
      for (let f = 0; f < 4; f++) {
        const lf = LOCAL_FACES[f];
        const a = tetIds[t * 4 + lf[0]];
        const b = tetIds[t * 4 + lf[1]];
        const c = tetIds[t * 4 + lf[2]];
        // Canonical sorted key
        let x = a, y = b, z = c;
        if (x > y) { const s = x; x = y; y = s; }
        if (y > z) { const s = y; y = z; z = s; }
        if (x > y) { const s = x; x = y; y = s; }
        const key = `${x}_${y}_${z}`;
        const existing = faceMap.get(key);
        const fi = t * 4 + f;
        if (existing !== undefined) {
          facePartner[fi] = existing;
          facePartner[existing] = fi;
          faceMap.delete(key);
        } else {
          faceMap.set(key, fi);
        }
      }
    }

    // Build initial incident tet list per vertex & unique edge list for strain-rate damping
    const vertTets = Array.from({ length: maxVerts }, () => []);
    const edgeSet = new Set();
    const edges = [];
    for (let t = 0; t < numTets; t++) {
      const a = tetIds[t * 4], b = tetIds[t * 4 + 1], c = tetIds[t * 4 + 2], d = tetIds[t * 4 + 3];
      vertTets[a].push(t); vertTets[b].push(t); vertTets[c].push(t); vertTets[d].push(t);
      const pairs = [[a, b], [a, c], [a, d], [b, c], [b, d], [c, d]];
      for (let p = 0; p < 6; p++) {
        const u = Math.min(pairs[p][0], pairs[p][1]);
        const v = Math.max(pairs[p][0], pairs[p][1]);
        const key = (u << 16) | v;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push(u, v);
        }
      }
    }

    return {
      id,
      shape,
      color,
      stiffnessMul,
      toughnessMul,
      numVerts,
      maxVerts,
      numTets,
      pos,
      prevPos,
      vel,
      rest,
      mass,
      invMass,
      vertSplitCooldown,
      vertRootId,
      tetIds,
      tetBm,
      tetVol,
      tetRestCenter,
      tetStress,
      tetMaxVec,
      tetFractured,
      facePartner,
      faceIsCrack,
      LOCAL_FACES,
      vertTets,
      edges: new Int32Array(edges),
      numEdges: edges.length >> 1,
      exteriorFaces: [],     // cached list of { tet, f, a, b, c, isCrack }
      facesDirty: true,
      crackCount: 0,
      crackPlanes: [],       // coherent propagating cleavage planes
      vertComp: new Int32Array(maxVerts), // connected component id per vertex
      splitPairs: []         // recently split [vA, vB, timer] to avoid explosive instant self-collision
    };
  }

  class SceneJelly {
    constructor(sharedGpu) {
      this.gpu = sharedGpu;
      this.device = sharedGpu.device;

      this.jellies = [];
      this.balls = [];
      this.params = {
        stiffness: 1.0,    // 0.35 .. 2.4
        toughness: 1.0,    // 0.35 .. 2.4
        ballMass: 1.0,     // 0.35 .. 2.8
        dropHeight: 1.85   // 0.70 .. 3.4 m
      };

      this.time = 0;
      this.stepCounter = 0;
      this.simAccumulator = 0;
      this.audioCooldown = 0;
      this.lastBallDropMode = 'center';

      // Render resources
      this.maxRenderVerts = 80000;
      this.renderVertData = new Float32Array(this.maxRenderVerts * 11); // pos(3), norm(3), col(3), meta(2) = 11 floats
      this.renderVertCount = 0;

      this._initPipelines();
      this.resetScene('default');
    }

    _initPipelines() {
      const d = this.device;
      this.jellyVertBuf = d.createBuffer({
        size: this.renderVertData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });

      this.thicknessTex = null;
      this.thicknessView = null;

      const vLayout = [{
        arrayStride: 44, // 11 * 4
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'float32x3' },
          { shaderLocation: 3, offset: 36, format: 'float32x2' },
        ]
      }];

      const thickMod = d.createShaderModule({ code: JELLY_THICKNESS_WGSL });
      this.thickPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: thickMod, entryPoint: 'vs', buffers: vLayout },
        fragment: {
          module: thickMod,
          entryPoint: 'fs',
          targets: [{
            format: 'rgba16float',
            blend: {
              color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
              alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' }
            }
          }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' }
      });

      const surfMod = d.createShaderModule({ code: JELLY_SURFACE_WGSL });
      this.jellyShadowPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: surfMod, entryPoint: 'vsShadow', buffers: vLayout },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });
      this.jellySurfPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: surfMod, entryPoint: 'vs', buffers: vLayout },
        fragment: { module: surfMod, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });

      this.jellyShadowBG = d.createBindGroup({
        layout: this.jellyShadowPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.gpu.frameUniformBuf } }]
      });

      this._rebuildSizeDependentBindGroups();
    }

    _rebuildSizeDependentBindGroups() {
      const d = this.device;
      const w = this.gpu.width;
      const h = this.gpu.height;
      if (this.thicknessTex && this.thicknessTex.width === w && this.thicknessTex.height === h) return;

      if (this.thicknessTex) this.thicknessTex.destroy();
      this.thicknessTex = d.createTexture({
        size: [w, h],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      this.thicknessView = this.thicknessTex.createView();

      this.thickBG = d.createBindGroup({
        layout: this.thickPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 1, resource: this.gpu.opaqueDepthView }
        ]
      });

      this.jellySurfBG = d.createBindGroup({
        layout: this.jellySurfPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 1, resource: this.gpu.shadowView },
          { binding: 2, resource: this.gpu.shadowSampler },
          { binding: 3, resource: this.gpu.opaqueColorView },
          { binding: 4, resource: this.gpu.opaqueDepthView },
          { binding: 5, resource: this.thicknessView },
          { binding: 6, resource: this.gpu.linearSampler }
        ]
      });
    }

    setParam(key, value) {
      if (key in this.params) {
        this.params[key] = value;
      }
    }

    resetScene(preset = 'default') {
      this.time = 0;
      this.stepCounter = 0;
      this.simAccumulator = 0;
      this.balls = [];
      this.jellies = [];
      this.gpu._stageTag = 'jelly';
      this.gpu.setStageTransform([14.0, 0.14, 14.0], [0, -0.14, -2.5], 4.5);

      if (preset === 'jelly-offset') {
        // Tall plum/blueberry pillar front-center-left, lime cushion to the right, resting steel ball in path
        this.jellies.push(createJellyBody({
          id: 'pillar-hero', shape: 'pillar',
          nx: 6, ny: 9, nz: 6,
          sizeX: 0.72, sizeY: 0.94, sizeZ: 0.72,
          center: [-0.35, 0.0, 0.0],
          color: [0.68, 0.38, 0.95], // amethyst plum
          stiffnessMul: 0.92,
          toughnessMul: 2.2
        }));
        this.jellies.push(createJellyBody({
          id: 'cushion-right', shape: 'cushion',
          nx: 7, ny: 5, nz: 7,
          sizeX: 0.96, sizeY: 0.50, sizeZ: 0.88,
          center: [1.18, 0.0, 0.12],
          color: [0.35, 0.92, 0.52], // lime mint
          stiffnessMul: 1.55,
          toughnessMul: 2.2
        }));
        this.jellies.push(createJellyBody({
          id: 'dome-left', shape: 'dome',
          nx: 7, ny: 6, nz: 7,
          sizeX: 0.88, sizeY: 0.62, sizeZ: 0.88,
          center: [-1.75, 0.0, -0.25],
          color: [0.98, 0.34, 0.42], // cherry
          stiffnessMul: 1.15,
          toughnessMul: 2.2
        }));
        // Resting ball on tabletop to get knocked by rolling sphere
        this.balls.push({
          pos: [0.46, 0.15, 0.24],
          prevPos: [0.46, 0.15, 0.24],
          vel: [0, 0, 0],
          angVel: [0, 0, 0],
          quat: [0, 0, 0, 1],
          radius: 0.15,
          mass: 0.48,
          invMass: 1 / 0.48,
          color: [0.78, 0.81, 0.86],
          matType: 0, // brushed steel
          roughness: 0.22,
          metallic: 0.92,
          wasInJelly: false,
          soundCooldown: 0
        });
      } else {
        // Standard 3-jelly studio stage: Center Hero Cherry Dome + Right Lime Cushion + Left Plum Pillar
        this.jellies.push(createJellyBody({
          id: 'dome-hero', shape: 'dome',
          nx: 8, ny: 7, nz: 8,
          sizeX: 1.06, sizeY: 0.72, sizeZ: 1.06,
          center: [0.0, 0.0, 0.0],
          color: [0.98, 0.32, 0.38], // translucent cherry ruby
          stiffnessMul: 1.0,
          toughnessMul: preset === 'jelly-multi' ? 0.92 : 1.75
        }));
        this.jellies.push(createJellyBody({
          id: 'cushion-right', shape: 'cushion',
          nx: 7, ny: 5, nz: 7,
          sizeX: 0.90, sizeY: 0.48, sizeZ: 0.88,
          center: [1.30, 0.0, 0.10],
          color: [0.32, 0.90, 0.50], // crisp lime jelly
          stiffnessMul: 1.80,
          toughnessMul: 2.0
        }));
        this.jellies.push(createJellyBody({
          id: 'pillar-left', shape: 'pillar',
          nx: 6, ny: 8, nz: 6,
          sizeX: 0.68, sizeY: 0.84, sizeZ: 0.68,
          center: [-1.28, 0.0, -0.08],
          color: [0.64, 0.36, 0.95], // grape/plum jelly
          stiffnessMul: 0.78,
          toughnessMul: 1.25
        }));
      }

      // Let's do 2 tiny static settle ticks so rest contact is seated on table
      for (let i = 0; i < 4; i++) {
        this._substep(1 / 240);
      }
    }

    spawnBall(opts = {}) {
      const mScale = this.params.ballMass;
      const radius = opts.radius ?? M.clamp(0.17 + 0.045 * Math.sqrt(mScale), 0.15, 0.27);
      const mass = opts.mass ?? (0.58 * mScale);
      const pos = opts.pos ? [...opts.pos] : [0, this.params.dropHeight, 0];
      const vel = opts.vel ? [...opts.vel] : [0, 0, 0];
      const matType = opts.matType ?? (mScale > 1.45 ? 1 : mScale < 0.75 ? 2 : 0);
      const colors = [
        [0.82, 0.85, 0.90], // 0: brushed steel
        [0.24, 0.26, 0.30], // 1: dark cast iron
        [0.62, 0.60, 0.57]  // 2: granite stone
      ];
      this.balls.push({
        pos,
        prevPos: [...pos],
        vel,
        angVel: opts.angVel ? [...opts.angVel] : [0, 0, 0],
        quat: [0, 0, 0, 1],
        radius,
        mass,
        invMass: 1 / Math.max(0.05, mass),
        color: opts.color || colors[matType],
        matType,
        roughness: matType === 0 ? 0.22 : matType === 1 ? 0.48 : 0.62,
        metallic: matType === 0 ? 0.92 : matType === 1 ? 0.82 : 0.04,
        wasInJelly: false,
        soundCooldown: 0
      });
      if (this.balls.length > 14) {
        this.balls.shift();
      }
    }

    triggerImpact(mode) {
      this.lastBallDropMode = mode;
      const h = this.params.dropHeight;
      const targetJ = this.jellies[0];
      if (!targetJ) return;

      // Estimate current center of primary jelly
      let cx = 0, cz = 0, maxY = 0;
      for (let i = 0; i < targetJ.numVerts; i++) {
        cx += targetJ.pos[i * 3];
        cz += targetJ.pos[i * 3 + 2];
        if (targetJ.pos[i * 3 + 1] > maxY) maxY = targetJ.pos[i * 3 + 1];
      }
      cx /= targetJ.numVerts;
      cz /= targetJ.numVerts;

      if (mode === 'center') {
        this.spawnBall({
          pos: [cx, maxY + h * 0.65, cz],
          vel: [0, -0.4, 0],
          matType: 0
        });
      } else if (mode === 'offset') {
        // Strike off-center shoulder obliquely so jelly tilts/wobbles and ball ricochets cleanly
        this.spawnBall({
          pos: [cx - 0.58, maxY + h * 0.24, cz + 0.14],
          vel: [1.95, -0.75, -0.22],
          radius: 0.20,
          mass: 0.60 * this.params.ballMass,
          matType: 2
        });
      } else if (mode === 'multi') {
        // Queue 3 progressive hits in interactive mode using scheduled spawn timers
        this.pendingDrops = [
          { delay: 0.00, pos: [cx - 0.04, maxY + h * 0.50, cz + 0.02], vel: [0, -0.6, 0], massMul: 0.72, radius: 0.17, matType: 2 },
          { delay: 0.52, pos: [cx + 0.05, maxY + h * 0.62, cz - 0.03], vel: [-0.15, -1.2, 0.05], massMul: 1.25, radius: 0.20, matType: 0 },
          { delay: 1.05, pos: [cx, maxY + h * 0.78, cz], vel: [0, -2.2, 0], massMul: 2.15, radius: 0.24, matType: 1 }
        ];
      }
    }

    step(dt) {
      if (this.pendingDrops && this.pendingDrops.length > 0) {
        for (let i = this.pendingDrops.length - 1; i >= 0; i--) {
          this.pendingDrops[i].delay -= dt;
          if (this.pendingDrops[i].delay <= 0) {
            const d = this.pendingDrops[i];
            this.spawnBall({
              pos: d.pos,
              vel: d.vel,
              radius: d.radius,
              mass: 0.62 * this.params.ballMass * d.massMul,
              matType: d.matType
            });
            this.pendingDrops.splice(i, 1);
          }
        }
      }

      const substeps = 10;
      const subDt = dt / substeps;
      for (let s = 0; s < substeps; s++) {
        this._substep(subDt);
      }

      // Evaluate fracture criterion once per frame (or every 2 substeps) so cracks propagate organically
      this._evaluateFracture(dt);
      this.time += dt;
      this.stepCounter++;
    }

    _substep(h) {
      const g = -11.5;
      const stiffness = this.params.stiffness;

      // 1. Predict jelly vertices
      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        const nV = J.numVerts;
        for (let i = 0; i < nV; i++) {
          if (J.invMass[i] === 0) continue;
          const o = i * 3;
          J.prevPos[o] = J.pos[o];
          J.prevPos[o + 1] = J.pos[o + 1];
          J.prevPos[o + 2] = J.pos[o + 2];
          J.vel[o + 1] += g * h;
          J.pos[o] += J.vel[o] * h;
          J.pos[o + 1] += J.vel[o + 1] * h;
          J.pos[o + 2] += J.vel[o + 2] * h;
          if (J.vertSplitCooldown[i] > 0) J.vertSplitCooldown[i]--;
        }
      }

      // 2. Predict rigid balls
      for (let bIdx = 0; bIdx < this.balls.length; bIdx++) {
        const B = this.balls[bIdx];
        B.prevPos[0] = B.pos[0]; B.prevPos[1] = B.pos[1]; B.prevPos[2] = B.pos[2];
        B.vel[1] += g * h;
        B.pos[0] += B.vel[0] * h;
        B.pos[1] += B.vel[1] * h;
        B.pos[2] += B.vel[2] * h;
        if (B.soundCooldown > 0) B.soundCooldown -= h;
      }

      // 3. Solve Neo-Hookean XPBD constraints for each jelly
      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        const mu = 84.0 * stiffness * J.stiffnessMul;
        const lambda = 44.0 * mu; // High bulk modulus preserves volume tightly while allowing juicy squash!
        const gamma = 1.0 + mu / lambda;
        const invH2 = 1.0 / (h * h);

        const pos = J.pos;
        const invM = J.invMass;
        const ids = J.tetIds;
        const bm = J.tetBm;
        const vols = J.tetVol;

        for (let t = 0; t < J.numTets; t++) {
          const i0 = ids[t * 4], i1 = ids[t * 4 + 1], i2 = ids[t * 4 + 2], i3 = ids[t * 4 + 3];
          const w0 = invM[i0], w1 = invM[i1], w2 = invM[i2], w3 = invM[i3];
          if (w0 + w1 + w2 + w3 === 0) continue;

          const p0x = pos[i0 * 3], p0y = pos[i0 * 3 + 1], p0z = pos[i0 * 3 + 2];
          const d1x = pos[i1 * 3] - p0x, d1y = pos[i1 * 3 + 1] - p0y, d1z = pos[i1 * 3 + 2] - p0z;
          const d2x = pos[i2 * 3] - p0x, d2y = pos[i2 * 3 + 1] - p0y, d2z = pos[i2 * 3 + 2] - p0z;
          const d3x = pos[i3 * 3] - p0x, d3y = pos[i3 * 3 + 1] - p0y, d3z = pos[i3 * 3 + 2] - p0z;

          const bo = t * 9;
          const b00 = bm[bo], b01 = bm[bo + 1], b02 = bm[bo + 2];
          const b10 = bm[bo + 3], b11 = bm[bo + 4], b12 = bm[bo + 5];
          const b20 = bm[bo + 6], b21 = bm[bo + 7], b22 = bm[bo + 8];

          // F = Ds * Bm (columns f0, f1, f2)
          const f0x = d1x * b00 + d2x * b10 + d3x * b20;
          const f0y = d1y * b00 + d2y * b10 + d3y * b20;
          const f0z = d1z * b00 + d2z * b10 + d3z * b20;

          const f1x = d1x * b01 + d2x * b11 + d3x * b21;
          const f1y = d1y * b01 + d2y * b11 + d3y * b21;
          const f1z = d1z * b01 + d2z * b11 + d3z * b21;

          const f2x = d1x * b02 + d2x * b12 + d3x * b22;
          const f2y = d1y * b02 + d2y * b12 + d3y * b22;
          const f2z = d1z * b02 + d2z * b12 + d3z * b22;

          const vol = vols[t];

          // --- Deviatoric constraint C_D = sqrt(||F||^2) ---
          const frob2 = f0x * f0x + f0y * f0y + f0z * f0z +
                        f1x * f1x + f1y * f1y + f1z * f1z +
                        f2x * f2x + f2y * f2y + f2z * f2z;
          const CD = Math.sqrt(frob2 + 1e-10);
          const invCD = 1.0 / CD;

          const gd1x = (f0x * b00 + f1x * b01 + f2x * b02) * invCD;
          const gd1y = (f0y * b00 + f1y * b01 + f2y * b02) * invCD;
          const gd1z = (f0z * b00 + f1z * b01 + f2z * b02) * invCD;

          const gd2x = (f0x * b10 + f1x * b11 + f2x * b12) * invCD;
          const gd2y = (f0y * b10 + f1y * b11 + f2y * b12) * invCD;
          const gd2z = (f0z * b10 + f1z * b11 + f2z * b12) * invCD;

          const gd3x = (f0x * b20 + f1x * b21 + f2x * b22) * invCD;
          const gd3y = (f0y * b20 + f1y * b21 + f2y * b22) * invCD;
          const gd3z = (f0z * b20 + f1z * b21 + f2z * b22) * invCD;

          const gd0x = -(gd1x + gd2x + gd3x);
          const gd0y = -(gd1y + gd2y + gd3y);
          const gd0z = -(gd1z + gd2z + gd3z);

          const wSumD = w0 * (gd0x * gd0x + gd0y * gd0y + gd0z * gd0z) +
                        w1 * (gd1x * gd1x + gd1y * gd1y + gd1z * gd1z) +
                        w2 * (gd2x * gd2x + gd2y * gd2y + gd2z * gd2z) +
                        w3 * (gd3x * gd3x + gd3y * gd3y + gd3z * gd3z);

          const alphaD = invH2 / (mu * vol);
          const lamD = -CD / (wSumD + alphaD + 1e-12);

          pos[i0 * 3] += w0 * lamD * gd0x; pos[i0 * 3 + 1] += w0 * lamD * gd0y; pos[i0 * 3 + 2] += w0 * lamD * gd0z;
          pos[i1 * 3] += w1 * lamD * gd1x; pos[i1 * 3 + 1] += w1 * lamD * gd1y; pos[i1 * 3 + 2] += w1 * lamD * gd1z;
          pos[i2 * 3] += w2 * lamD * gd2x; pos[i2 * 3 + 1] += w2 * lamD * gd2y; pos[i2 * 3 + 2] += w2 * lamD * gd2z;
          pos[i3 * 3] += w3 * lamD * gd3x; pos[i3 * 3 + 1] += w3 * lamD * gd3y; pos[i3 * 3 + 2] += w3 * lamD * gd3z;

          // Recompute Ds & F after deviatoric update before solving hydrostatic volume constraint
          const rp0x = pos[i0 * 3], rp0y = pos[i0 * 3 + 1], rp0z = pos[i0 * 3 + 2];
          const rd1x = pos[i1 * 3] - rp0x, rd1y = pos[i1 * 3 + 1] - rp0y, rd1z = pos[i1 * 3 + 2] - rp0z;
          const rd2x = pos[i2 * 3] - rp0x, rd2y = pos[i2 * 3 + 1] - rp0y, rd2z = pos[i2 * 3 + 2] - rp0z;
          const rd3x = pos[i3 * 3] - rp0x, rd3y = pos[i3 * 3 + 1] - rp0y, rd3z = pos[i3 * 3 + 2] - rp0z;

          const rf0x = rd1x * b00 + rd2x * b10 + rd3x * b20, rf0y = rd1y * b00 + rd2y * b10 + rd3y * b20, rf0z = rd1z * b00 + rd2z * b10 + rd3z * b20;
          const rf1x = rd1x * b01 + rd2x * b11 + rd3x * b21, rf1y = rd1y * b01 + rd2y * b11 + rd3y * b21, rf1z = rd1z * b01 + rd2z * b11 + rd3z * b21;
          const rf2x = rd1x * b02 + rd2x * b12 + rd3x * b22, rf2y = rd1y * b02 + rd2y * b12 + rd3y * b22, rf2z = rd1z * b02 + rd2z * b12 + rd3z * b22;

          // --- Hydrostatic volume constraint C_H = det(F) - gamma ---
          const cx0x = rf1y * rf2z - rf1z * rf2y, cx0y = rf1z * rf2x - rf1x * rf2z, cx0z = rf1x * rf2y - rf1y * rf2x;
          const detF = rf0x * cx0x + rf0y * cx0y + rf0z * cx0z;
          const CH = detF - gamma;

          const cx1x = rf2y * rf0z - rf2z * rf0y, cx1y = rf2z * rf0x - rf2x * rf0z, cx1z = rf2x * rf0y - rf2y * rf0x;
          const cx2x = rf0y * rf1z - rf0z * rf1y, cx2y = rf0z * rf1x - rf0x * rf1z, cx2z = rf0x * rf1y - rf0y * rf1x;

          const gh1x = cx0x * b00 + cx1x * b01 + cx2x * b02;
          const gh1y = cx0y * b00 + cx1y * b01 + cx2y * b02;
          const gh1z = cx0z * b00 + cx1z * b01 + cx2z * b02;

          const gh2x = cx0x * b10 + cx1x * b11 + cx2x * b12;
          const gh2y = cx0y * b10 + cx1y * b11 + cx2y * b12;
          const gh2z = cx0z * b10 + cx1z * b11 + cx2z * b12;

          const gh3x = cx0x * b20 + cx1x * b21 + cx2x * b22;
          const gh3y = cx0y * b20 + cx1y * b21 + cx2y * b22;
          const gh3z = cx0z * b20 + cx1z * b21 + cx2z * b22;

          const gh0x = -(gh1x + gh2x + gh3x);
          const gh0y = -(gh1y + gh2y + gh3y);
          const gh0z = -(gh1z + gh2z + gh3z);

          const wSumH = w0 * (gh0x * gh0x + gh0y * gh0y + gh0z * gh0z) +
                        w1 * (gh1x * gh1x + gh1y * gh1y + gh1z * gh1z) +
                        w2 * (gh2x * gh2x + gh2y * gh2y + gh2z * gh2z) +
                        w3 * (gh3x * gh3x + gh3y * gh3y + gh3z * gh3z);

          const alphaH = invH2 / (lambda * vol);
          const lamH = -CH / (wSumH + alphaH + 1e-12);

          pos[i0 * 3] += w0 * lamH * gh0x; pos[i0 * 3 + 1] += w0 * lamH * gh0y; pos[i0 * 3 + 2] += w0 * lamH * gh0z;
          pos[i1 * 3] += w1 * lamH * gh1x; pos[i1 * 3 + 1] += w1 * lamH * gh1y; pos[i1 * 3 + 2] += w1 * lamH * gh1z;
          pos[i2 * 3] += w2 * lamH * gh2x; pos[i2 * 3 + 1] += w2 * lamH * gh2y; pos[i2 * 3 + 2] += w2 * lamH * gh2z;
          pos[i3 * 3] += w3 * lamH * gh3x; pos[i3 * 3 + 1] += w3 * lamH * gh3y; pos[i3 * 3 + 2] += w3 * lamH * gh3z;
        }
      }

      // 4. Rebuild cached exterior face lists when dirty
      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        if (J.facesDirty) this._rebuildExteriorFaces(J);
      }

      // 5. Solve exact Triangle-Sphere contact (smooth wrap-around + ball impulse + rolling torque!)
      this._solveBallJellyContacts(h);

      // 6. Solve Ball-Ball & Ball-Table contacts
      this._solveBallCollisions(h);

      // 7. Solve Jelly-Jelly & Fragment-Fragment contacts (via vertex-vs-surface spatial hash)
      this._solveJellySelfAndPairCollisions(h);

      // 8. Solve Jelly-Table contacts (with realistic slide friction so off-center impacts slide/tilt/topple!)
      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        const pos = J.pos, prev = J.prevPos;
        for (let i = 0; i < J.numVerts; i++) {
          const o = i * 3;
          if (pos[o + 1] < 0.001) {
            const pen = 0.001 - pos[o + 1];
            pos[o + 1] = 0.001;
            const dx = pos[o] - prev[o];
            const dz = pos[o + 2] - prev[o + 2];
            const slideLen = Math.hypot(dx, dz);
            const friction = 0.36; // allows visible sliding on strong oblique strikes while supporting tipping!
            if (slideLen > 1e-6) {
              const maxCorr = Math.min(slideLen, pen * friction * 3.5);
              const scale = (slideLen - maxCorr) / slideLen;
              pos[o] = prev[o] + dx * scale;
              pos[o + 2] = prev[o + 2] + dz * scale;
            }
          }
          // Soft stage rim containment (stay on bench)
          pos[o] = M.clamp(pos[o], -5.2, 5.2);
          pos[o + 2] = M.clamp(pos[o + 2], -4.5, 4.5);
        }
      }

      // 9. Update velocities + edge-wise relative strain-rate damping (preserves rigid tumbling & sliding!)
      const invH = 1.0 / h;
      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        const pos = J.pos, prev = J.prevPos, vel = J.vel;
        for (let i = 0; i < J.numVerts * 3; i++) {
          vel[i] = (pos[i] - prev[i]) * invH;
        }

        // Internal edge strain-rate damping (zero drag on rigid translation/rotation!)
        const damp = 0.045;
        const edges = J.edges;
        for (let e = 0; e < J.numEdges; e++) {
          const a = edges[e * 2], b = edges[e * 2 + 1];
          const ao = a * 3, bo = b * 3;
          let ex = pos[bo] - pos[ao], ey = pos[bo + 1] - pos[ao + 1], ez = pos[bo + 2] - pos[ao + 2];
          const len = Math.hypot(ex, ey, ez);
          if (len < 1e-6) continue;
          ex /= len; ey /= len; ez /= len;
          const vrel = (vel[bo] - vel[ao]) * ex + (vel[bo + 1] - vel[ao + 1]) * ey + (vel[bo + 2] - vel[ao + 2]) * ez;
          const imp = vrel * damp;
          vel[ao] += imp * ex; vel[ao + 1] += imp * ey; vel[ao + 2] += imp * ez;
          vel[bo] -= imp * ex; vel[bo + 1] -= imp * ey; vel[bo + 2] -= imp * ez;
        }

        // Tick split-pair grace timers
        for (let s = J.splitPairs.length - 1; s >= 0; s--) {
          J.splitPairs[s][2] -= h;
          if (J.splitPairs[s][2] <= 0) J.splitPairs.splice(s, 1);
        }
      }

      for (let bIdx = 0; bIdx < this.balls.length; bIdx++) {
        const B = this.balls[bIdx];
        B.vel[0] = (B.pos[0] - B.prevPos[0]) * invH;
        B.vel[1] = (B.pos[1] - B.prevPos[1]) * invH;
        B.vel[2] = (B.pos[2] - B.prevPos[2]) * invH;
        // Integrate visual rotation quaternion from angVel
        const wx = B.angVel[0], wy = B.angVel[1], wz = B.angVel[2];
        const wLen = Math.hypot(wx, wy, wz);
        if (wLen > 1e-5) {
          const halfAng = 0.5 * wLen * h;
          const s = Math.sin(halfAng) / wLen;
          const dq = [wx * s, wy * s, wz * s, Math.cos(halfAng)];
          const q = B.quat;
          const nx = dq[3] * q[0] + dq[0] * q[3] + dq[1] * q[2] - dq[2] * q[1];
          const ny = dq[3] * q[1] - dq[0] * q[2] + dq[1] * q[3] + dq[2] * q[0];
          const nz = dq[3] * q[2] + dq[0] * q[1] - dq[1] * q[0] + dq[2] * q[3];
          const nw = dq[3] * q[3] - dq[0] * q[0] - dq[1] * q[1] - dq[2] * q[2];
          const qLen = Math.hypot(nx, ny, nz, nw) || 1;
          B.quat[0] = nx / qLen; B.quat[1] = ny / qLen; B.quat[2] = nz / qLen; B.quat[3] = nw / qLen;
        }
      }
    }

    _rebuildExteriorFaces(J) {
      J.exteriorFaces.length = 0;
      const ids = J.tetIds;
      const fp = J.facePartner;
      const fc = J.faceIsCrack;
      const LF = J.LOCAL_FACES;
      for (let t = 0; t < J.numTets; t++) {
        for (let f = 0; f < 4; f++) {
          const fi = t * 4 + f;
          if (fp[fi] === -1) {
            const lf = LF[f];
            J.exteriorFaces.push({
              tet: t,
              f,
              a: ids[t * 4 + lf[0]],
              b: ids[t * 4 + lf[1]],
              c: ids[t * 4 + lf[2]],
              isCrack: fc[fi]
            });
          }
        }
      }

      // Rebuild edges & connected vertex components so velocity damping and self-collision stay exact across open cuts
      const adj = Array.from({ length: J.numVerts }, () => []);
      const edgeSet = new Set();
      const newEdges = [];
      for (let t = 0; t < J.numTets; t++) {
        const v0 = ids[t * 4], v1 = ids[t * 4 + 1], v2 = ids[t * 4 + 2], v3 = ids[t * 4 + 3];
        const pairs = [[v0,v1],[v0,v2],[v0,v3],[v1,v2],[v1,v3],[v2,v3]];
        for (let p = 0; p < 6; p++) {
          let a = pairs[p][0], b = pairs[p][1];
          if (a > b) { const tmp = a; a = b; b = tmp; }
          const key = a * 8192 + b;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            newEdges.push(a, b);
            adj[a].push(b);
            adj[b].push(a);
          }
        }
      }
      J.edges = new Int32Array(newEdges);
      J.numEdges = newEdges.length >> 1;

      const comp = J.vertComp;
      comp.fill(-1, 0, J.numVerts);
      let cid = 0;
      const queue = [];
      for (let i = 0; i < J.numVerts; i++) {
        if (comp[i] !== -1) continue;
        comp[i] = cid;
        queue.push(i);
        while (queue.length > 0) {
          const u = queue.pop();
          const nb = adj[u];
          for (let k = 0; k < nb.length; k++) {
            const w = nb[k];
            if (comp[w] === -1) {
              comp[w] = cid;
              queue.push(w);
            }
          }
        }
        cid++;
      }
      J.numComponents = cid;
      J.facesDirty = false;
    }

    _solveBallJellyContacts(h) {
      for (let bIdx = 0; bIdx < this.balls.length; bIdx++) {
        const B = this.balls[bIdx];
        const cx = B.pos[0], cy = B.pos[1], cz = B.pos[2];
        const R = B.radius;
        const wBall = B.invMass;
        let maxImpactImpulse = 0;
        let hitThisStep = false;
        let avgStiffness = 1.0;

        for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
          const J = this.jellies[jIdx];
          const pos = J.pos, prev = J.prevPos, invM = J.invMass;
          const faces = J.exteriorFaces;

          for (let fi = 0; fi < faces.length; fi++) {
            const face = faces[fi];
            const ia = face.a * 3, ib = face.b * 3, ic = face.c * 3;
            const ax = pos[ia], ay = pos[ia + 1], az = pos[ia + 2];
            const bx = pos[ib], by = pos[ib + 1], bz = pos[ib + 2];
            const kx = pos[ic], ky = pos[ic + 1], kz = pos[ic + 2];

            // Fast AABB cull
            const minX = Math.min(ax, bx, kx) - R, maxX = Math.max(ax, bx, kx) + R;
            if (cx < minX || cx > maxX) continue;
            const minY = Math.min(ay, by, ky) - R, maxY = Math.max(ay, by, ky) + R;
            if (cy < minY || cy > maxY) continue;
            const minZ = Math.min(az, bz, kz) - R, maxZ = Math.max(az, bz, kz) + R;
            if (cz < minZ || cz > maxZ) continue;

            // Outward face normal
            const abx = bx - ax, aby = by - ay, abz = bz - az;
            const acx = kx - ax, acy = ky - ay, acz = kz - az;
            let fnx = aby * acz - abz * acy;
            let fny = abz * acx - abx * acz;
            let fnz = abx * acy - aby * acx;
            const fnLen = Math.hypot(fnx, fny, fnz);
            if (fnLen < 1e-8) continue;
            fnx /= fnLen; fny /= fnLen; fnz /= fnLen;

            // Closest point on triangle (Ericson barycentric)
            const apx = cx - ax, apy = cy - ay, apz = cz - az;
            const d1 = abx * apx + aby * apy + abz * apz;
            const d2 = acx * apx + acy * apy + acz * apz;
            let u = 1, v = 0, w = 0;

            if (d1 <= 0 && d2 <= 0) {
              u = 1; v = 0; w = 0;
            } else {
              const bpx = cx - bx, bpy = cy - by, bpz = cz - bz;
              const d3 = abx * bpx + aby * bpy + abz * bpz;
              const d4 = acx * bpx + acy * bpy + acz * bpz;
              if (d3 >= 0 && d4 <= d3) {
                u = 0; v = 1; w = 0;
              } else {
                const vc = d1 * d4 - d3 * d2;
                if (vc <= 0 && d1 >= 0 && d3 <= 0) {
                  v = d1 / (d1 - d3);
                  u = 1 - v; w = 0;
                } else {
                  const cpx = cx - kx, cpy = cy - ky, cpz = cz - kz;
                  const d5 = abx * cpx + aby * cpy + abz * cpz;
                  const d6 = acx * cpx + acy * cpy + acz * cpz;
                  if (d6 >= 0 && d5 <= d6) {
                    u = 0; v = 0; w = 1;
                  } else {
                    const vb = d5 * d2 - d1 * d6;
                    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
                      w = d2 / (d2 - d6);
                      u = 1 - w; v = 0;
                    } else {
                      const va = d3 * d6 - d5 * d4;
                      if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
                        w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
                        u = 0; v = 1 - w;
                      } else {
                        const denom = 1.0 / (va + vb + vc);
                        v = vb * denom;
                        w = vc * denom;
                        u = 1.0 - v - w;
                      }
                    }
                  }
                }
              }
            }

            const qx = u * ax + v * bx + w * kx;
            const qy = u * ay + v * by + w * ky;
            const qz = u * az + v * bz + w * kz;
            const dx = cx - qx, dy = cy - qy, dz = cz - qz;
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq >= R * R) continue;

            // Signed plane check so we push outward along face normal when ball penetrates past surface
            const signedDist = apx * fnx + apy * fny + apz * fnz;
            if (signedDist < -0.35 * R) continue;

            const dist = Math.sqrt(distSq);
            let nx, ny, nz, pen;
            if (dist > 1e-5 && signedDist >= 0) {
              nx = dx / dist; ny = dy / dist; nz = dz / dist;
              pen = R - dist;
            } else {
              nx = fnx; ny = fny; nz = fnz;
              pen = R - signedDist;
            }
            if (pen <= 0) continue;

            const wa = invM[face.a], wb = invM[face.b], wc = invM[face.c];
            const wTri = wa * u * u + wb * v * v + wc * w * w;
            const wTot = wTri + wBall;
            if (wTot < 1e-10) continue;

            const corr = (pen * 0.88) / wTot;
            // Push ball along +n, triangle along -n
            B.pos[0] += nx * corr * wBall;
            B.pos[1] += ny * corr * wBall;
            B.pos[2] += nz * corr * wBall;

            pos[ia] -= nx * corr * wa * u; pos[ia + 1] -= ny * corr * wa * u; pos[ia + 2] -= nz * corr * wa * u;
            pos[ib] -= nx * corr * wb * v; pos[ib + 1] -= ny * corr * wb * v; pos[ib + 2] -= nz * corr * wb * v;
            pos[ic] -= nx * corr * wc * w; pos[ic + 1] -= ny * corr * wc * w; pos[ic + 2] -= nz * corr * wc * w;

            // Tangential rolling coupling: relative displacement tangent to contact drives angular spin!
            const triDx = u * (pos[ia] - prev[ia]) + v * (pos[ib] - prev[ib]) + w * (pos[ic] - prev[ic]);
            const triDy = u * (pos[ia + 1] - prev[ia + 1]) + v * (pos[ib + 1] - prev[ib + 1]) + w * (pos[ic + 1] - prev[ic + 1]);
            const triDz = u * (pos[ia + 2] - prev[ia + 2]) + v * (pos[ib + 2] - prev[ib + 2]) + w * (pos[ic + 2] - prev[ic + 2]);
            const rvx = (B.pos[0] - B.prevPos[0]) - triDx;
            const rvy = (B.pos[1] - B.prevPos[1]) - triDy;
            const rvz = (B.pos[2] - B.prevPos[2]) - triDz;
            const rvn = rvx * nx + rvy * ny + rvz * nz;
            const tx = rvx - rvn * nx, ty = rvy - rvn * ny, tz = rvz - rvn * nz;
            const tLen = Math.hypot(tx, ty, tz);
            if (tLen > 1e-6) {
              const slip = Math.min(tLen, pen * 0.16);
              const sF = slip / tLen;
              const dampT = sF * 0.35;
              B.pos[0] -= tx * dampT * (wBall / wTot);
              B.pos[1] -= ty * dampT * (wBall / wTot);
              B.pos[2] -= tz * dampT * (wBall / wTot);
              // Angular impulse n x (-t/h) / R
              const rollScale = 0.55 / (R * h);
              B.angVel[0] += (ny * tz - nz * ty) * rollScale * dampT;
              B.angVel[1] += (nz * tx - nx * tz) * rollScale * dampT;
              B.angVel[2] += (nx * ty - ny * tx) * rollScale * dampT;
            }

            hitThisStep = true;
            avgStiffness = J.stiffnessMul * this.params.stiffness;
            const relApproach = Math.abs(B.vel[0] * nx + B.vel[1] * ny + B.vel[2] * nz);
            if (relApproach > maxImpactImpulse) maxImpactImpulse = relApproach;
          }
        }

        if (hitThisStep && !B.wasInJelly && B.soundCooldown <= 0 && maxImpactImpulse > 0.65) {
          window.AppAudio.playJellyImpact(M.clamp(maxImpactImpulse * 0.22 * B.mass, 0.15, 1.0), M.clamp(avgStiffness * 0.45, 0.1, 1.0));
          B.soundCooldown = 0.14;
        } else if (!hitThisStep && B.wasInJelly && B.vel[1] > 1.05 && B.soundCooldown <= 0) {
          window.AppAudio.playJellyRebound(M.clamp(B.vel[1] * 0.28, 0.15, 0.8), M.clamp(avgStiffness * 0.45, 0.1, 1.0));
          B.soundCooldown = 0.18;
        }
        B.wasInJelly = hitThisStep;
      }
    }

    _solveBallCollisions(h) {
      const n = this.balls.length;
      // Ball vs Ball
      for (let i = 0; i < n; i++) {
        const A = this.balls[i];
        for (let j = i + 1; j < n; j++) {
          const B = this.balls[j];
          const dx = B.pos[0] - A.pos[0];
          const dy = B.pos[1] - A.pos[1];
          const dz = B.pos[2] - A.pos[2];
          const rSum = A.radius + B.radius;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rSum * rSum || d2 < 1e-10) continue;
          const dist = Math.sqrt(d2);
          const nx = dx / dist, ny = dy / dist, nz = dz / dist;
          const pen = rSum - dist;
          const wTot = A.invMass + B.invMass;
          const corr = pen / wTot;
          A.pos[0] -= nx * corr * A.invMass; A.pos[1] -= ny * corr * A.invMass; A.pos[2] -= nz * corr * A.invMass;
          B.pos[0] += nx * corr * B.invMass; B.pos[1] += ny * corr * B.invMass; B.pos[2] += nz * corr * B.invMass;

          // Restitution bounce
          const rvx = (B.pos[0] - B.prevPos[0] - (A.pos[0] - A.prevPos[0])) / h;
          const rvy = (B.pos[1] - B.prevPos[1] - (A.pos[1] - A.prevPos[1])) / h;
          const rvz = (B.pos[2] - B.prevPos[2] - (A.pos[2] - A.prevPos[2])) / h;
          const vn = rvx * nx + rvy * ny + rvz * nz;
          if (vn < -0.05) {
            const jImp = -(1 + 0.55) * vn / wTot;
            A.prevPos[0] += nx * jImp * A.invMass * h; A.prevPos[1] += ny * jImp * A.invMass * h; A.prevPos[2] += nz * jImp * A.invMass * h;
            B.prevPos[0] -= nx * jImp * B.invMass * h; B.prevPos[1] -= ny * jImp * B.invMass * h; B.prevPos[2] -= nz * jImp * B.invMass * h;
            if (Math.abs(vn) > 0.6 && A.soundCooldown <= 0) {
              window.AppAudio.playSphereCollision(M.clamp(Math.abs(vn) * 0.25, 0.1, 0.9), A.matType === 2 ? 'stone' : 'metal', false);
              A.soundCooldown = 0.08;
            }
          }
        }
      }

      // Ball vs Tabletop (y = 0) & stage rolling
      for (let i = 0; i < n; i++) {
        const B = this.balls[i];
        if (B.pos[1] < B.radius) {
          const pen = B.radius - B.pos[1];
          B.pos[1] = B.radius;
          const vy = (B.pos[1] - B.prevPos[1]) / h;
          if (vy < -0.55) {
            B.prevPos[1] = B.pos[1] + vy * 0.38 * h;
            if (B.soundCooldown <= 0) {
              window.AppAudio.playSphereCollision(M.clamp(Math.abs(vy) * 0.2, 0.08, 0.75), B.matType === 2 ? 'stone' : 'metal', false);
              B.soundCooldown = 0.09;
            }
          }
          // Rolling friction on table
          const dx = B.pos[0] - B.prevPos[0];
          const dz = B.pos[2] - B.prevPos[2];
          B.angVel[2] = -(dx / h) / B.radius;
          B.angVel[0] = (dz / h) / B.radius;
          B.angVel[1] *= 0.992;
          // Mild rolling resistance
          B.prevPos[0] += dx * 0.004;
          B.prevPos[2] += dz * 0.004;
        }
      }
    }

    _solveJellySelfAndPairCollisions(h) {
      // Fast uniform spatial hash of exterior vertices for inter-jelly and split-chunk repulsion
      const cellSize = 0.13;
      const invCell = 1.0 / cellSize;
      const grid = new Map();

      const vertRadius = 0.055;
      const minDist = vertRadius * 2.0;
      const minDist2 = minDist * minDist;

      // Insert exterior vertices
      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        const ext = new Set();
        const faces = J.exteriorFaces;
        for (let f = 0; f < faces.length; f++) {
          ext.add(faces[f].a); ext.add(faces[f].b); ext.add(faces[f].c);
        }
        J._extVerts = Array.from(ext);
        for (let k = 0; k < J._extVerts.length; k++) {
          const vi = J._extVerts[k];
          const gx = Math.floor(J.pos[vi * 3] * invCell);
          const gy = Math.floor(J.pos[vi * 3 + 1] * invCell);
          const gz = Math.floor(J.pos[vi * 3 + 2] * invCell);
          const key = `${gx},${gy},${gz}`;
          let bucket = grid.get(key);
          if (!bucket) { bucket = []; grid.set(key, bucket); }
          bucket.push(jIdx, vi);
        }
      }

      // Check neighbors
      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        const ext = J._extVerts;
        for (let k = 0; k < ext.length; k++) {
          const vi = ext[k];
          const x = J.pos[vi * 3], y = J.pos[vi * 3 + 1], z = J.pos[vi * 3 + 2];
          const gx = Math.floor(x * invCell), gy = Math.floor(y * invCell), gz = Math.floor(z * invCell);
          const wi = J.invMass[vi];

          for (let dz = -1; dz <= 1; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const bucket = grid.get(`${gx + dx},${gy + dy},${gz + dz}`);
                if (!bucket) continue;
                for (let b = 0; b < bucket.length; b += 2) {
                  const j2 = bucket[b], vj = bucket[b + 1];
                  if (j2 < jIdx || (j2 === jIdx && vj <= vi)) continue;
                  const J2 = this.jellies[j2];

                  // Skip same-component close neighbors unless separated fragments or deep folding
                  if (j2 === jIdx && J.vertComp[vi] === J.vertComp[vj]) {
                    const rdx = J.rest[vj * 3] - J.rest[vi * 3];
                    const rdy = J.rest[vj * 3 + 1] - J.rest[vi * 3 + 1];
                    const rdz = J.rest[vj * 3 + 2] - J.rest[vi * 3 + 2];
                    if (rdx * rdx + rdy * rdy + rdz * rdz < 0.14) continue;
                  }
                  if (j2 === jIdx && J.vertRootId[vi] === J.vertRootId[vj]) {
                    let inGrace = false;
                    for (let sp = 0; sp < J.splitPairs.length; sp++) {
                      const pair = J.splitPairs[sp];
                      if ((pair[0] === vi && pair[1] === vj) || (pair[0] === vj && pair[1] === vi)) {
                        inGrace = true; break;
                      }
                    }
                    if (inGrace) continue;
                  }

                  const px = J2.pos[vj * 3] - x;
                  const py = J2.pos[vj * 3 + 1] - y;
                  const pz = J2.pos[vj * 3 + 2] - z;
                  const d2 = px * px + py * py + pz * pz;
                  if (d2 >= minDist2 || d2 < 1e-10) continue;

                  const dist = Math.sqrt(d2);
                  const pen = (minDist - dist) * 0.45;
                  const wj = J2.invMass[vj];
                  const wSum = wi + wj;
                  if (wSum < 1e-10) continue;
                  const nx = px / dist, ny = py / dist, nz = pz / dist;
                  const c = pen / wSum;
                  J.pos[vi * 3] -= nx * c * wi; J.pos[vi * 3 + 1] -= ny * c * wi; J.pos[vi * 3 + 2] -= nz * c * wi;
                  J2.pos[vj * 3] += nx * c * wj; J2.pos[vj * 3 + 1] += ny * c * wj; J2.pos[vj * 3 + 2] += nz * c * wj;
                }
              }
            }
          }
        }
      }
    }

    _evaluateFracture(dt) {
      const stiffness = this.params.stiffness;
      const toughness = this.params.toughness;

      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        if (J.numVerts >= J.maxVerts - 20) continue;

        const mu = 84.0 * stiffness * J.stiffnessMul;
        const pos = J.pos, ids = J.tetIds, bm = J.tetBm;
        const critStress = 16.5 * toughness * J.toughnessMul;

        let bestT = -1;
        let bestLoad = 0;
        let activeHighCount = 0;

        for (let t = 0; t < J.numTets; t++) {
          const i0 = ids[t * 4], i1 = ids[t * 4 + 1], i2 = ids[t * 4 + 2], i3 = ids[t * 4 + 3];
          const p0x = pos[i0 * 3], p0y = pos[i0 * 3 + 1], p0z = pos[i0 * 3 + 2];
          const d1x = pos[i1 * 3] - p0x, d1y = pos[i1 * 3 + 1] - p0y, d1z = pos[i1 * 3 + 2] - p0z;
          const d2x = pos[i2 * 3] - p0x, d2y = pos[i2 * 3 + 1] - p0y, d2z = pos[i2 * 3 + 2] - p0z;
          const d3x = pos[i3 * 3] - p0x, d3y = pos[i3 * 3 + 1] - p0y, d3z = pos[i3 * 3 + 2] - p0z;

          const bo = t * 9;
          const b00 = bm[bo], b01 = bm[bo + 1], b02 = bm[bo + 2];
          const b10 = bm[bo + 3], b11 = bm[bo + 4], b12 = bm[bo + 5];
          const b20 = bm[bo + 6], b21 = bm[bo + 7], b22 = bm[bo + 8];

          const f0x = d1x * b00 + d2x * b10 + d3x * b20, f0y = d1y * b00 + d2y * b10 + d3y * b20, f0z = d1z * b00 + d2z * b10 + d3z * b20;
          const f1x = d1x * b01 + d2x * b11 + d3x * b21, f1y = d1y * b01 + d2y * b11 + d3y * b21, f1z = d1z * b01 + d2z * b11 + d3z * b21;
          const f2x = d1x * b02 + d2x * b12 + d3x * b22, f2y = d1y * b02 + d2y * b12 + d3y * b22, f2z = d1z * b02 + d2z * b12 + d3z * b22;

          // C = F^T * F
          const c00 = f0x * f0x + f0y * f0y + f0z * f0z;
          const c11 = f1x * f1x + f1y * f1y + f1z * f1z;
          const c22 = f2x * f2x + f2y * f2y + f2z * f2z;
          const c01 = f0x * f1x + f0y * f1y + f0z * f1z;
          const c02 = f0x * f2x + f0y * f2y + f0z * f2z;
          const c12 = f1x * f2x + f1y * f2y + f1z * f2z;

          const eig = M.symmetricEigen3x3Max(c00, c11, c22, c01, c02, c12);
          const s1 = Math.sqrt(Math.max(eig.maxVal, 0));
          const s3 = Math.sqrt(Math.max(eig.minVal, 0));

          const eTensile = Math.max(0, s1 - 1.0);
          const eShear = Math.max(0, s1 - s3);
          const energyRoot = Math.sqrt(mu * (0.42 * eTensile * eTensile + 0.24 * eShear * eShear));
          const load = 0.50 * energyRoot + 10.5 * eTensile + 4.4 * Math.max(0, eShear - 0.36);

          J.tetStress[t] = load;
          J.tetMaxVec[t * 3] = eig.vx;
          J.tetMaxVec[t * 3 + 1] = eig.vy;
          J.tetMaxVec[t * 3 + 2] = eig.vz;

          if (load > critStress) {
            activeHighCount++;
            if (load > bestLoad) {
              bestLoad = load;
              bestT = t;
            }
          }
        }

        // Nucleate coherent crack plane when a real stress cluster exceeds material toughness threshold
        if (bestT >= 0 && (activeHighCount >= 4 || bestLoad > critStress * 1.35) && J.crackPlanes.length < 2) {
          let sx = J.tetRestCenter[bestT * 3];
          let sy = J.tetRestCenter[bestT * 3 + 1];
          let sz = J.tetRestCenter[bestT * 3 + 2];
          let nx = J.tetMaxVec[bestT * 3];
          let ny = J.tetMaxVec[bestT * 3 + 1];
          let nz = J.tetMaxVec[bestT * 3 + 2];
          // Stabilize very flat horizontal normals slightly so vertical cleavage dominates nicely
          if (Math.abs(ny) > 0.85) {
            nx += 0.42;
            ny *= 0.40;
          }
          const nLen = Math.hypot(nx, ny, nz) || 1;
          nx /= nLen; ny /= nLen; nz /= nLen;

          // Pull shallow surface-grazing seeds inward toward jelly rest centroid so cleavage yields thick solid chunks (>= 14% volume)
          let cxR = 0, cyR = 0, czR = 0;
          for (let t = 0; t < J.numTets; t++) {
            cxR += J.tetRestCenter[t * 3];
            cyR += J.tetRestCenter[t * 3 + 1];
            czR += J.tetRestCenter[t * 3 + 2];
          }
          cxR /= J.numTets; cyR /= J.numTets; czR /= J.numTets;
          for (let adjIter = 0; adjIter < 2; adjIter++) {
            let posC = 0;
            for (let t = 0; t < J.numTets; t++) {
              const d = (J.tetRestCenter[t * 3] - sx) * nx + (J.tetRestCenter[t * 3 + 1] - sy) * ny + (J.tetRestCenter[t * 3 + 2] - sz) * nz;
              if (d >= 0) posC++;
            }
            const minFrac = Math.min(posC, J.numTets - posC) / J.numTets;
            if (minFrac >= 0.14) break;
            sx = sx * 0.45 + cxR * 0.55;
            sy = sy * 0.45 + cyR * 0.55;
            sz = sz * 0.45 + czR * 0.55;
          }

          let tooClose = false;
          for (let p = 0; p < J.crackPlanes.length; p++) {
            const P = J.crackPlanes[p];
            const dist = Math.hypot(sx - P.seed[0], sy - P.seed[1], sz - P.seed[2]);
            const aligned = Math.abs(nx * P.normal[0] + ny * P.normal[1] + nz * P.normal[2]);
            const perpDist = Math.abs((sx - P.seed[0]) * P.normal[0] + (sy - P.seed[1]) * P.normal[1] + (sz - P.seed[2]) * P.normal[2]);
            // Prevent parallel/near-parallel wafer slices anywhere in the jelly; require distinct cross-cutting angle for 2nd plane!
            if (aligned > 0.52 || (dist < 0.34 && aligned > 0.35) || perpDist < 0.24 && aligned > 0.35) {
              tooClose = true;
              P.maxRadius = 1.95;
              P.growthSpeed = Math.max(P.growthSpeed, 4.2);
              P.stallTimer = 0;
              break;
            }
          }
          if (!tooClose) {
            // Check quadrant / chunk thickness against existing planes so we don't cleave off tiny <8% slivers
            let minChunkRatio = 1.0;
            if (J.crackPlanes.length === 1) {
              const P0 = J.crackPlanes[0];
              let c00 = 0, c01 = 0, c10 = 0, c11 = 0;
              for (let t = 0; t < J.numTets; t++) {
                const tx = J.tetRestCenter[t * 3], ty = J.tetRestCenter[t * 3 + 1], tz = J.tetRestCenter[t * 3 + 2];
                const s0 = (tx - P0.seed[0]) * P0.normal[0] + (ty - P0.seed[1]) * P0.normal[1] + (tz - P0.seed[2]) * P0.normal[2] >= 0;
                const s1 = (tx - sx) * nx + (ty - sy) * ny + (tz - sz) * nz >= 0;
                if (s0 && s1) c00++; else if (s0) c01++; else if (s1) c10++; else c11++;
              }
              const counts = [c00, c01, c10, c11].filter(c => c > 0);
              if (counts.length > 0) minChunkRatio = Math.min(...counts) / J.numTets;
            }
            if (minChunkRatio >= 0.09) {
              J.crackPlanes.push({
                seed: [sx, sy, sz],
                normal: [nx, ny, nz],
                radius: 0.24,
                maxRadius: 1.95,
                growthSpeed: 4.2,
                splitVerts: new Set(),
                stallTimer: 0
              });
            }
          }
        }

        // Propagate active coherent crack planes smoothly across mesh
        let splitsThisFrame = 0;
        for (let p = 0; p < J.crackPlanes.length; p++) {
          const P = J.crackPlanes[p];
          if (P.radius >= P.maxRadius && P.stallTimer > 0.15) continue;
          P.radius = Math.min(P.maxRadius, P.radius + P.growthSpeed * dt);
          if (P.radius >= P.maxRadius) P.stallTimer += dt;

          const rLimitSq = P.radius * P.radius;
          const snx = P.normal[0], sny = P.normal[1], snz = P.normal[2];
          const px0 = P.seed[0], py0 = P.seed[1], pz0 = P.seed[2];

          const candidates = [];
          for (let v = 0; v < J.numVerts; v++) {
            if (P.splitVerts.has(v)) continue;
            if (J.vertTets[v].length < 2) continue;
            const dx = J.rest[v * 3] - px0;
            const dy = J.rest[v * 3 + 1] - py0;
            const dz = J.rest[v * 3 + 2] - pz0;
            const planeDist = Math.abs(dx * snx + dy * sny + dz * snz);
            if (planeDist > 0.115) continue;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > rLimitSq) continue;
            candidates.push({ v, d2 });
          }

          if (candidates.length === 0) continue;
          candidates.sort((a, b) => a.d2 - b.d2);

          for (let ci = 0; ci < candidates.length && splitsThisFrame < 26; ci++) {
            if (J.numVerts >= J.maxVerts - 4) break;
            const v = candidates[ci].v;
            const vNew = this._trySplitVertex(J, v, P.seed, P.normal);
            P.splitVerts.add(v);
            if (vNew >= 0) {
              P.splitVerts.add(vNew);
              splitsThisFrame++;
              J.crackCount++;
            }
          }
        }

        if (splitsThisFrame > 0) {
          J.facesDirty = true;
          window.AppAudio.playJellyCrack(M.clamp(splitsThisFrame * 0.18, 0.35, 1.0));
        }
      }
    }

    _trySplitVertex(J, v, seed, normal) {
      const incident = J.vertTets[v];
      if (incident.length < 2) return -1;

      const nx = normal[0], ny = normal[1], nz = normal[2];
      const sx = seed[0], sy = seed[1], sz = seed[2];
      const posSide = [];
      const negSide = [];

      for (let i = 0; i < incident.length; i++) {
        const t = incident[i];
        const dx = J.tetRestCenter[t * 3] - sx;
        const dy = J.tetRestCenter[t * 3 + 1] - sy;
        const dz = J.tetRestCenter[t * 3 + 2] - sz;
        if (dx * nx + dy * ny + dz * nz >= 0) posSide.push(t);
        else negSide.push(t);
      }

      if (posSide.length < 1 || negSide.length < 1) return -1;

      // Allocate duplicate vertex vNew
      const vNew = J.numVerts++;
      const vo = v * 3, no = vNew * 3;
      J.pos[no] = J.pos[vo]; J.pos[no + 1] = J.pos[vo + 1]; J.pos[no + 2] = J.pos[vo + 2];
      J.prevPos[no] = J.prevPos[vo]; J.prevPos[no + 1] = J.prevPos[vo + 1]; J.prevPos[no + 2] = J.prevPos[vo + 2];
      J.vel[no] = J.vel[vo]; J.vel[no + 1] = J.vel[vo + 1]; J.vel[no + 2] = J.vel[vo + 2];
      J.rest[no] = J.rest[vo]; J.rest[no + 1] = J.rest[vo + 1]; J.rest[no + 2] = J.rest[vo + 2];
      J.vertRootId[vNew] = J.vertRootId[v];
      J.vertSplitCooldown[v] = 12;
      J.vertSplitCooldown[vNew] = 12;
      J.splitPairs.push([v, vNew, 0.08]);

      // Reassign negSide tets from v to vNew
      const negSet = new Set(negSide);
      J.vertTets[v] = posSide;
      J.vertTets[vNew] = negSide;

      for (let i = 0; i < negSide.length; i++) {
        const t = negSide[i];
        for (let k = 0; k < 4; k++) {
          if (J.tetIds[t * 4 + k] === v) {
            J.tetIds[t * 4 + k] = vNew;
          }
        }
      }

      // Disconnect any shared faces between posSide and negSide tets and flag as internal crack faces!
      const LF = J.LOCAL_FACES;
      for (let i = 0; i < negSide.length; i++) {
        const t = negSide[i];
        for (let f = 0; f < 4; f++) {
          const fi = t * 4 + f;
          const partnerFi = J.facePartner[fi];
          if (partnerFi === -1) continue;
          const pTet = partnerFi >> 2;
          if (!negSet.has(pTet)) {
            const lf = LF[f];
            const usesSplit =
              J.tetIds[t * 4 + lf[0]] === vNew ||
              J.tetIds[t * 4 + lf[1]] === vNew ||
              J.tetIds[t * 4 + lf[2]] === vNew;
            if (usesSplit) {
              J.facePartner[fi] = -1;
              J.facePartner[partnerFi] = -1;
              J.faceIsCrack[fi] = 1;
              J.faceIsCrack[partnerFi] = 1;
            }
          }
        }
      }

      // Recompute mass of v and vNew accurately from incident tet volumes
      let mPos = 0, mNeg = 0;
      for (let i = 0; i < posSide.length; i++) mPos += J.tetVol[posSide[i]] * 1.05 * 0.25;
      for (let i = 0; i < negSide.length; i++) mNeg += J.tetVol[negSide[i]] * 1.05 * 0.25;
      J.mass[v] = Math.max(mPos, 1e-6);
      J.invMass[v] = 1.0 / J.mass[v];
      J.mass[vNew] = Math.max(mNeg, 1e-6);
      J.invMass[vNew] = 1.0 / J.mass[vNew];

      // Gentle cleavage opening nudge + velocity relief along fracture normal
      const nudge = 0.0035;
      J.pos[no] -= nx * nudge; J.pos[no + 1] -= ny * nudge; J.pos[no + 2] -= nz * nudge;
      J.pos[vo] += nx * nudge; J.pos[vo + 1] += ny * nudge; J.pos[vo + 2] += nz * nudge;
      const vKick = 0.0022;
      J.prevPos[no] += nx * vKick; J.prevPos[no + 1] += ny * vKick; J.prevPos[no + 2] += nz * vKick;
      J.prevPos[vo] -= nx * vKick; J.prevPos[vo + 1] -= ny * vKick; J.prevPos[vo + 2] -= nz * vKick;

      return vNew;
    }

    _buildRenderMesh() {
      const out = this.renderVertData;
      let vCursor = 0;

      const pushVert = (px, py, pz, nx, ny, nz, cr, cg, cb, isCrack, strain) => {
        if (vCursor >= this.maxRenderVerts) return;
        const o = vCursor * 11;
        out[o + 0] = px; out[o + 1] = py; out[o + 2] = pz;
        out[o + 3] = nx; out[o + 4] = ny; out[o + 5] = nz;
        out[o + 6] = cr; out[o + 7] = cg; out[o + 8] = cb;
        out[o + 9] = isCrack; out[o + 10] = strain;
        vCursor++;
      };

      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        if (J.facesDirty) this._rebuildExteriorFaces(J);
        const pos = J.pos;
        const faces = J.exteriorFaces;

        // Compute smooth vertex normals separately for outer skin vs interior cleavage faces
        if (!J._smoothNormals || J._smoothNormals.length < J.numVerts * 3) {
          J._smoothNormals = new Float32Array(J.maxVerts * 3);
        }
        if (!J._crackNormals || J._crackNormals.length < J.numVerts * 3) {
          J._crackNormals = new Float32Array(J.maxVerts * 3);
        }
        if (!J._vertOnCrack || J._vertOnCrack.length < J.numVerts) {
          J._vertOnCrack = new Uint8Array(J.maxVerts);
        }
        const sn = J._smoothNormals;
        const cn = J._crackNormals;
        const vc = J._vertOnCrack;
        sn.fill(0, 0, J.numVerts * 3);
        cn.fill(0, 0, J.numVerts * 3);
        vc.fill(0, 0, J.numVerts);

        for (let fi = 0; fi < faces.length; fi++) {
          const face = faces[fi];
          const ia = face.a * 3, ib = face.b * 3, ic = face.c * 3;
          const abx = pos[ib] - pos[ia], aby = pos[ib + 1] - pos[ia + 1], abz = pos[ib + 2] - pos[ia + 2];
          const acx = pos[ic] - pos[ia], acy = pos[ic + 1] - pos[ia + 1], acz = pos[ic + 2] - pos[ia + 2];
          const fnx = aby * acz - abz * acy;
          const fny = abz * acx - abx * acz;
          const fnz = abx * acy - aby * acx;
          face._nx = fnx; face._ny = fny; face._nz = fnz;
          if (!face.isCrack) {
            sn[ia] += fnx; sn[ia + 1] += fny; sn[ia + 2] += fnz;
            sn[ib] += fnx; sn[ib + 1] += fny; sn[ib + 2] += fnz;
            sn[ic] += fnx; sn[ic + 1] += fny; sn[ic + 2] += fnz;
          } else {
            vc[face.a] = 1; vc[face.b] = 1; vc[face.c] = 1;
            cn[ia] += fnx; cn[ia + 1] += fny; cn[ia + 2] += fnz;
            cn[ib] += fnx; cn[ib + 1] += fny; cn[ib + 2] += fnz;
            cn[ic] += fnx; cn[ic + 1] += fny; cn[ic + 2] += fnz;
          }
        }

        for (let i = 0; i < J.numVerts; i++) {
          const o = i * 3;
          const len = Math.hypot(sn[o], sn[o + 1], sn[o + 2]);
          if (len > 1e-8) {
            sn[o] /= len; sn[o + 1] /= len; sn[o + 2] /= len;
          } else {
            sn[o] = 0; sn[o + 1] = 1; sn[o + 2] = 0;
          }
          const clen = Math.hypot(cn[o], cn[o + 1], cn[o + 2]);
          if (clen > 1e-8) {
            cn[o] /= clen; cn[o + 1] /= clen; cn[o + 2] /= clen;
          } else {
            cn[o] = sn[o]; cn[o + 1] = sn[o + 1]; cn[o + 2] = sn[o + 2];
          }
        }

        const cr = J.color[0], cg = J.color[1], cb = J.color[2];

        // Emit PN-triangle curved 1->4 subdivided skin for smooth outer silhouette, and glossy blended cleavage facets!
        for (let fi = 0; fi < faces.length; fi++) {
          const face = faces[fi];
          const ia = face.a * 3, ib = face.b * 3, ic = face.c * 3;
          const stress = J.tetStress[face.tet] || 0;

          if (face.isCrack) {
            const len = Math.hypot(face._nx, face._ny, face._nz) || 1;
            const fnx = face._nx / len, fny = face._ny / len, fnz = face._nz / len;
            const blendN = (vo) => {
              let bx = cn[vo] * 0.68 + fnx * 0.32;
              let by = cn[vo + 1] * 0.68 + fny * 0.32;
              let bz = cn[vo + 2] * 0.68 + fnz * 0.32;
              const bl = Math.hypot(bx, by, bz) || 1;
              return [bx / bl, by / bl, bz / bl];
            };
            const na = blendN(ia), nb = blendN(ib), nc = blendN(ic);
            pushVert(pos[ia], pos[ia + 1], pos[ia + 2], na[0], na[1], na[2], cr, cg, cb, 1.0, stress);
            pushVert(pos[ib], pos[ib + 1], pos[ib + 2], nb[0], nb[1], nb[2], cr, cg, cb, 1.0, stress);
            pushVert(pos[ic], pos[ic + 1], pos[ic + 2], nc[0], nc[1], nc[2], cr, cg, cb, 1.0, stress);
          } else {
            // 1 -> 4 curved PN-triangle subdivision along edges (seamless across shared vertices!)
            const p0x = pos[ia], p0y = pos[ia + 1], p0z = pos[ia + 2];
            const p1x = pos[ib], p1y = pos[ib + 1], p1z = pos[ib + 2];
            const p2x = pos[ic], p2y = pos[ic + 1], p2z = pos[ic + 2];

            const n0x = sn[ia], n0y = sn[ia + 1], n0z = sn[ia + 2];
            const n1x = sn[ib], n1y = sn[ib + 1], n1z = sn[ib + 2];
            const n2x = sn[ic], n2y = sn[ic + 1], n2z = sn[ic + 2];

            // Quadratic Bezier edge midpoints with normal tangent projection (flat along crack rims so meshes stay 100% watertight!)
            const edgeMid = (va, ax, ay, az, nax, nay, naz, vb, bx, by, bz, nbx, nby, nbz) => {
              const ex = bx - ax, ey = by - ay, ez = bz - az;
              const seamKeep = (vc[va] && vc[vb]) ? 0.0 : 1.0;
              const dA = ex * nax + ey * nay + ez * naz;
              const dB = -ex * nbx - ey * nby - ez * nbz;
              const mx = 0.5 * (ax + bx) - 0.14 * seamKeep * (dA * nax + dB * nbx);
              const my = 0.5 * (ay + by) - 0.14 * seamKeep * (dA * nay + dB * nby);
              const mz = 0.5 * (az + bz) - 0.14 * seamKeep * (dA * naz + dB * nbz);
              let nmx = nax + nbx, nmy = nay + nby, nmz = naz + nbz;
              const nl = Math.hypot(nmx, nmy, nmz) || 1;
              return [mx, my, mz, nmx / nl, nmy / nl, nmz / nl];
            };

            const m01 = edgeMid(face.a, p0x, p0y, p0z, n0x, n0y, n0z, face.b, p1x, p1y, p1z, n1x, n1y, n1z);
            const m12 = edgeMid(face.b, p1x, p1y, p1z, n1x, n1y, n1z, face.c, p2x, p2y, p2z, n2x, n2y, n2z);
            const m20 = edgeMid(face.c, p2x, p2y, p2z, n2x, n2y, n2z, face.a, p0x, p0y, p0z, n0x, n0y, n0z);

            // 4 sub-triangles
            pushVert(p0x, p0y, p0z, n0x, n0y, n0z, cr, cg, cb, 0.0, stress);
            pushVert(m01[0], m01[1], m01[2], m01[3], m01[4], m01[5], cr, cg, cb, 0.0, stress);
            pushVert(m20[0], m20[1], m20[2], m20[3], m20[4], m20[5], cr, cg, cb, 0.0, stress);

            pushVert(m01[0], m01[1], m01[2], m01[3], m01[4], m01[5], cr, cg, cb, 0.0, stress);
            pushVert(p1x, p1y, p1z, n1x, n1y, n1z, cr, cg, cb, 0.0, stress);
            pushVert(m12[0], m12[1], m12[2], m12[3], m12[4], m12[5], cr, cg, cb, 0.0, stress);

            pushVert(m20[0], m20[1], m20[2], m20[3], m20[4], m20[5], cr, cg, cb, 0.0, stress);
            pushVert(m12[0], m12[1], m12[2], m12[3], m12[4], m12[5], cr, cg, cb, 0.0, stress);
            pushVert(p2x, p2y, p2z, n2x, n2y, n2z, cr, cg, cb, 0.0, stress);

            pushVert(m01[0], m01[1], m01[2], m01[3], m01[4], m01[5], cr, cg, cb, 0.0, stress);
            pushVert(m12[0], m12[1], m12[2], m12[3], m12[4], m12[5], cr, cg, cb, 0.0, stress);
            pushVert(m20[0], m20[1], m20[2], m20[3], m20[4], m20[5], cr, cg, cb, 0.0, stress);
          }
        }
      }

      this.renderVertCount = vCursor;
      if (vCursor > 0) {
        this.device.queue.writeBuffer(this.jellyVertBuf, 0, out.subarray(0, vCursor * 11));
      }
    }

    getStats() {
      let volRatioSum = 0;
      let totalCracks = 0;
      for (let jIdx = 0; jIdx < this.jellies.length; jIdx++) {
        const J = this.jellies[jIdx];
        totalCracks += J.crackCount;
        let curV = 0, restV = 0;
        for (let t = 0; t < J.numTets; t++) {
          const i0 = J.tetIds[t * 4], i1 = J.tetIds[t * 4 + 1], i2 = J.tetIds[t * 4 + 2], i3 = J.tetIds[t * 4 + 3];
          const p0x = J.pos[i0 * 3], p0y = J.pos[i0 * 3 + 1], p0z = J.pos[i0 * 3 + 2];
          const d1x = J.pos[i1 * 3] - p0x, d1y = J.pos[i1 * 3 + 1] - p0y, d1z = J.pos[i1 * 3 + 2] - p0z;
          const d2x = J.pos[i2 * 3] - p0x, d2y = J.pos[i2 * 3 + 1] - p0y, d2z = J.pos[i2 * 3 + 2] - p0z;
          const d3x = J.pos[i3 * 3] - p0x, d3y = J.pos[i3 * 3 + 1] - p0y, d3z = J.pos[i3 * 3 + 2] - p0z;
          const det = d1x * (d2y * d3z - d2z * d3y) - d2x * (d1y * d3z - d1z * d3y) + d3x * (d1y * d2z - d1z * d2y);
          curV += det / 6.0;
          restV += J.tetVol[t];
        }
        volRatioSum += curV / restV;
      }
      return {
        avgVolumeRatio: volRatioSum / Math.max(1, this.jellies.length),
        crackCount: totalCracks,
        ballCount: this.balls.length
      };
    }

    render(encoder, cam) {
      if (this.gpu._stageTag !== 'jelly') {
        this.gpu._stageTag = 'jelly';
        this.gpu.setStageTransform([14.0, 0.14, 14.0], [0, -0.14, -2.5], 4.5);
      }
      this._rebuildSizeDependentBindGroups();
      this.gpu.updateFrameUniforms(cam, [0, 0.25, 0], 3.8, this.time, [1.08, 0, 0, 0]);
      this._buildRenderMesh();
      const sphereCount = this.gpu.uploadSpheres(this.balls);

      // 1. Shadow Pass
      {
        const sPass = encoder.beginRenderPass({
          colorAttachments: [],
          depthStencilAttachment: {
            view: this.gpu.shadowView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });
        sPass.setPipeline(this.gpu.stageShadowPipeline);
        sPass.setBindGroup(0, this.gpu.stageShadowBG);
        sPass.setVertexBuffer(0, this.gpu.boxGeom.vertexBuffer);
        sPass.draw(this.gpu.boxGeom.vertexCount);

        if (sphereCount > 0) {
          sPass.setPipeline(this.gpu.sphereShadowPipeline);
          sPass.setBindGroup(0, this.gpu.sphereShadowBG);
          sPass.setVertexBuffer(0, this.gpu.sphereGeom.vertexBuffer);
          sPass.setIndexBuffer(this.gpu.sphereGeom.indexBuffer, 'uint16');
          sPass.drawIndexed(this.gpu.sphereGeom.indexCount, sphereCount);
        }

        if (this.renderVertCount > 0) {
          sPass.setPipeline(this.jellyShadowPipeline);
          sPass.setBindGroup(0, this.jellyShadowBG);
          sPass.setVertexBuffer(0, this.jellyVertBuf);
          sPass.draw(this.renderVertCount);
        }
        sPass.end();
      }

      // 2. Opaque Pass (backdrop + bench + rigid balls) -> opaqueColorTex + opaqueDepthTex
      {
        const oPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.gpu.opaqueColorView,
            clearValue: { r: 0.08, g: 0.1, b: 0.13, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }],
          depthStencilAttachment: {
            view: this.gpu.opaqueDepthView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });
        oPass.setPipeline(this.gpu.backdropPipeline);
        oPass.setBindGroup(0, this.gpu.backdropBG);
        oPass.draw(3);

        oPass.setPipeline(this.gpu.stagePipeline);
        oPass.setBindGroup(0, this.gpu.stageBG);
        oPass.setVertexBuffer(0, this.gpu.boxGeom.vertexBuffer);
        oPass.draw(this.gpu.boxGeom.vertexCount);

        if (sphereCount > 0) {
          oPass.setPipeline(this.gpu.spherePipeline);
          oPass.setBindGroup(0, this.gpu.sphereBG);
          oPass.setVertexBuffer(0, this.gpu.sphereGeom.vertexBuffer);
          oPass.setIndexBuffer(this.gpu.sphereGeom.indexBuffer, 'uint16');
          oPass.drawIndexed(this.gpu.sphereGeom.indexCount, sphereCount);
        }
        oPass.end();
      }

      // Copy opaqueColorTex -> hdrColorTex and opaqueDepthTex -> sceneDepthTex
      encoder.copyTextureToTexture(
        { texture: this.gpu.opaqueColorTex },
        { texture: this.gpu.hdrColorTex },
        [this.gpu.width, this.gpu.height]
      );
      encoder.copyTextureToTexture(
        { texture: this.gpu.opaqueDepthTex },
        { texture: this.gpu.sceneDepthTex },
        [this.gpu.width, this.gpu.height]
      );

      // 3. Jelly Optical Thickness Parity Pass
      if (this.renderVertCount > 0) {
        const tPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.thicknessView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });
        tPass.setPipeline(this.thickPipeline);
        tPass.setBindGroup(0, this.thickBG);
        tPass.setVertexBuffer(0, this.jellyVertBuf);
        tPass.draw(this.renderVertCount);
        tPass.end();

        // 4. Translucent Jelly Surface Pass (load hdrColorTex + sceneDepthTex; read opaqueDepthTex safely)
        const jPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.gpu.hdrColorView,
            loadOp: 'load',
            storeOp: 'store'
          }],
          depthStencilAttachment: {
            view: this.gpu.sceneDepthView,
            depthLoadOp: 'load',
            depthStoreOp: 'store'
          }
        });
        jPass.setPipeline(this.jellySurfPipeline);
        jPass.setBindGroup(0, this.jellySurfBG);
        jPass.setVertexBuffer(0, this.jellyVertBuf);
        jPass.draw(this.renderVertCount);
        jPass.end();
      }

      // 5. Tonemap -> Swapchain
      this.gpu.renderToneMap(encoder);
    }
  }

  return { SceneJelly };
})();
