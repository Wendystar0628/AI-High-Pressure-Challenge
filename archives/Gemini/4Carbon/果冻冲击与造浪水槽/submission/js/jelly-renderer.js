(function () {
  const App = (window.App = window.App || {});
  const M = App.Math;

  class JellyRenderer {
    constructor(gpu) {
      this.gpu = gpu;
      this.device = gpu.device;

      // Dynamic vertex buffer for all jellies combined (expanded non-indexed or indexed triangles)
      // Up to 45,000 triangles * 3 vertices * 12 floats (48 bytes/vertex):
      // pos(3), normal(3), color(3), absorbAndFlags(3 -> absorbScale/fractureFlag) -> let's use 16 floats = 64 bytes/vertex!
      // [pos.xyz, fractureFlag, normal.xyz, jellyId, color.rgb, rough, absorb.rgb, pad]
      this.maxDrawVerts = 90000;
      this.vtxData = new Float32Array(this.maxDrawVerts * 16);
      this.vtxBuf = this.device.createBuffer({
        size: this.vtxData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.drawVertCount = 0;

      this._createPipelines();
      this.rebuildBindGroups();
    }

    _createPipelines() {
      const vtxLayout = [{
        arrayStride: 64,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x4' },  // xyz: worldPos, w: isFracture
          { shaderLocation: 1, offset: 16, format: 'float32x4' }, // xyz: normal, w: rimCrease
          { shaderLocation: 2, offset: 32, format: 'float32x4' }, // rgb: baseColor, w: roughness
          { shaderLocation: 3, offset: 48, format: 'float32x4' }  // rgb: absorbCoeff, w: unused
        ]
      }];

      // Pass A: Exact Signed Ray-Thickness Accumulation Pass
      const thickModule = this.device.createShaderModule({
        code: App.STUDIO_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var sceneDepthTex: texture_depth_2d;

struct VSIn {
  @location(0) posFrac: vec4<f32>,
  @location(1) normCrease: vec4<f32>,
  @location(2) colRough: vec4<f32>,
  @location(3) absorb: vec4<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
};

@vertex
fn vsThickness(in: VSIn) -> VSOut {
  var out: VSOut;
  out.worldPos = in.posFrac.xyz;
  out.clipPos = frame.viewProj * vec4<f32>(in.posFrac.xyz, 1.0);
  return out;
}

@fragment
fn fsThickness(in: VSOut, @builtin(front_facing) isFront: bool) -> @location(0) vec4<f32> {
  let px = clamp(vec2<i32>(in.clipPos.xy), vec2<i32>(0), vec2<i32>(frame.viewport.xy) - vec2<i32>(1));
  let sceneZ = textureLoad(sceneDepthTex, px, 0);

  // Reconstruct world position of opaque scene depth at this pixel to clamp ray exit at engulfed balls/floor!
  let uv = in.clipPos.xy * frame.viewport.zw;
  let ndc = vec4<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, sceneZ, 1.0);
  let sceneWorldH = frame.invViewProj * ndc;
  let sceneWorld = sceneWorldH.xyz / sceneWorldH.w;
  let maxRayDist = length(sceneWorld - frame.cameraPos.xyz);

  let fragDist = min(length(in.worldPos - frame.cameraPos.xyz), maxRayDist);
  let signedDist = select(fragDist, -fragDist, isFront);
  let faceCount = select(0.0, 1.0, isFront && in.clipPos.z <= sceneZ + 0.0002);
  return vec4<f32>(signedDist, faceCount, 0.0, 0.0);
}
`
      });

      this.thicknessPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: thickModule, entryPoint: 'vsThickness', buffers: vtxLayout },
        fragment: {
          module: thickModule,
          entryPoint: 'fsThickness',
          targets: [{
            format: 'rgba16float',
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
            }
          }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' }
      });

      // Pass B: Front-Surface Refractive + Beer-Lambert + Subsurface + Wet Specular Jelly Shader
      const surfaceModule = this.device.createShaderModule({
        code: App.STUDIO_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var backdropTex: texture_2d<f32>;
@group(0) @binding(2) var thicknessTex: texture_2d<f32>;
@group(0) @binding(3) var sceneDepthTex: texture_depth_2d;
@group(0) @binding(4) var shadowTex: texture_depth_2d;
@group(0) @binding(5) var shadowSampler: sampler_comparison;
@group(0) @binding(6) var linearSamp: sampler;

struct VSIn {
  @location(0) posFrac: vec4<f32>,
  @location(1) normCrease: vec4<f32>,
  @location(2) colRough: vec4<f32>,
  @location(3) absorb: vec4<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) worldNormal: vec3<f32>,
  @location(2) colRough: vec4<f32>,
  @location(3) absorbFrac: vec4<f32>,
};

@vertex
fn vsMain(in: VSIn) -> VSOut {
  var out: VSOut;
  out.clipPos = frame.viewProj * vec4<f32>(in.posFrac.xyz, 1.0);
  out.worldPos = in.posFrac.xyz;
  out.worldNormal = in.normCrease.xyz;
  out.colRough = in.colRough;
  out.absorbFrac = vec4<f32>(in.absorb.rgb, in.posFrac.w);
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(in.worldNormal);
  let V = normalize(frame.cameraPos.xyz - in.worldPos);
  let L = normalize(frame.keyLightDir.xyz);
  let isFracture = in.absorbFrac.w;

  let screenUV = in.clipPos.xy * frame.viewport.zw;
  let px = clamp(vec2<i32>(in.clipPos.xy), vec2<i32>(0), vec2<i32>(frame.viewport.xy) - vec2<i32>(1));
  let rawThick = textureLoad(thicknessTex, px, 0).r;
  let thickness = clamp(max(0.018, rawThick), 0.018, 0.72);

  // View-space normal for optical screen-space refraction (IOR ~ 1.38 for fruit gelatin)
  let viewN = (frame.view * vec4<f32>(N, 0.0)).xyz;
  let refractScale = (0.115 + 0.22 * min(0.45, thickness)) * vec2<f32>(frame.viewport.y * frame.viewport.z, 1.0);
  let offsetBase = viewN.xy * refractScale;

  // Validate refracted sample doesn't pull from foreground occluder in front of jelly
  let refUV_G = clamp(screenUV - offsetBase, vec2<f32>(0.002), vec2<f32>(0.998));
  let refPx = vec2<i32>(refUV_G * frame.viewport.xy);
  let refDepth = textureLoad(sceneDepthTex, clamp(refPx, vec2<i32>(0), vec2<i32>(frame.viewport.xy) - vec2<i32>(1)), 0);
  let validRefract = select(0.15, 1.0, refDepth >= in.clipPos.z - 0.002);
  let finalOffset = offsetBase * validRefract;

  // Subtle chromatic dispersion + internal gelatin turbidity micro-blur
  let uvR = clamp(screenUV - finalOffset * 0.94, vec2<f32>(0.002), vec2<f32>(0.998));
  let uvG = clamp(screenUV - finalOffset * 1.00, vec2<f32>(0.002), vec2<f32>(0.998));
  let uvB = clamp(screenUV - finalOffset * 1.06, vec2<f32>(0.002), vec2<f32>(0.998));
  let texel = frame.viewport.zw * (1.2 + thickness * 4.5);

  var bgCol: vec3<f32>;
  bgCol.r = 0.5 * textureSampleLevel(backdropTex, linearSamp, uvR, 0.0).r
          + 0.25 * textureSampleLevel(backdropTex, linearSamp, clamp(uvR + vec2<f32>(texel.x, 0.0), vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).r
          + 0.25 * textureSampleLevel(backdropTex, linearSamp, clamp(uvR - vec2<f32>(0.0, texel.y), vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).r;
  bgCol.g = 0.5 * textureSampleLevel(backdropTex, linearSamp, uvG, 0.0).g
          + 0.25 * textureSampleLevel(backdropTex, linearSamp, clamp(uvG - vec2<f32>(texel.x, 0.0), vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).g
          + 0.25 * textureSampleLevel(backdropTex, linearSamp, clamp(uvG + vec2<f32>(0.0, texel.y), vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).g;
  bgCol.b = textureSampleLevel(backdropTex, linearSamp, uvB, 0.0).b;

  // Beer-Lambert volumetric color absorption through gelatin thickness
  let absorbCoeff = in.absorbFrac.rgb * 3.85;
  let transmittance = exp(-absorbCoeff * thickness);
  let baseTint = in.colRough.rgb;

  // Shadow map check on outer surface
  let lp = frame.lightViewProj * vec4<f32>(in.worldPos, 1.0);
  let lndc = lp.xyz / lp.w;
  let suv = clamp(vec2<f32>(lndc.x * 0.5 + 0.5, 0.5 - lndc.y * 0.5), vec2<f32>(0.002), vec2<f32>(0.998));
  let inSB = lndc.z >= 0.0 && lndc.z <= 1.0;
  let shadow = select(1.0, textureSampleCompareLevel(shadowTex, shadowSampler, suv, clamp(lndc.z - 0.0025, 0.0, 1.0)), inSB);

  // Subsurface scattering (wrap diffuse + backlit translucent forward glow + rim silhouette contour!)
  let wrapNdotL = clamp((dot(N, L) + 0.55) / 1.55, 0.0, 1.0);
  let backScatterDir = normalize(L + N * 0.42);
  let forwardSSS = pow(clamp(dot(V, -backScatterDir), 0.0, 1.0), 3.2) * exp(-thickness * 2.1);
  // Rim light from rear-left studio softbox accentuates undulating deformed silhouette!
  let rimLightDir = normalize(vec3<f32>(-0.62, 0.44, -0.65));
  let rimTrans = pow(1.0 - max(0.0, dot(N, V)), 2.6) * (0.45 + 0.55 * max(0.0, dot(-V, rimLightDir)));

  let sssBody = baseTint * (
    vec3<f32>(0.18, 0.20, 0.24) +
    vec3<f32>(0.68, 0.64, 0.58) * wrapNdotL * (0.35 + 0.65 * shadow) +
    vec3<f32>(1.15, 1.05, 0.92) * forwardSSS +
    vec3<f32>(0.55, 0.68, 0.85) * rimTrans * exp(-thickness * 1.6)
  ) * (1.0 - exp(-thickness * 5.2));

  // Wet gelatin specular reflection (IOR 1.38 -> F0 = 0.025, ultra-glossy wet coat!)
  let ndotv = max(0.001, dot(N, V));
  let fresnel = 0.026 + (1.0 - 0.026) * pow(1.0 - ndotv, 4.8);
  let R = reflect(-V, N);
  let envReflect = sampleStudioEnv(R) * mix(0.95, 1.25, isFracture);

  let H = normalize(L + V);
  let ndoth = max(0.0, dot(N, H));
  let specTight = pow(ndoth, select(190.0, 280.0, isFracture > 0.5)) * 1.45 * shadow;
  let specBroad = pow(ndoth, 28.0) * 0.14 * shadow;

  // Freshly cleaved internal fracture faces get a subtle wet crystalline glint so cracks read clearly!
  let fractureHighlight = isFracture * baseTint * 0.14 * pow(1.0 - ndotv, 1.8)
                        + isFracture * vec3<f32>(0.18, 0.22, 0.28) * pow(max(0.0, dot(N, normalize(vec3<f32>(-0.4, 0.75, 0.5)))), 12.0);

  let transmitted = bgCol * transmittance;
  let interiorMix = transmitted + sssBody;
  let finalColor = mix(interiorMix, envReflect, clamp(fresnel * 0.92, 0.0, 0.88))
                 + vec3<f32>(specTight + specBroad)
                 + fractureHighlight;

  return vec4<f32>(finalColor, 1.0);
}
`
      });

      this.surfacePipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: surfaceModule, entryPoint: 'vsMain', buffers: vtxLayout },
        fragment: {
          module: surfaceModule,
          entryPoint: 'fsMain',
          targets: [{ format: 'rgba16float' }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: {
          format: 'depth32float',
          depthWriteEnabled: true,
          depthCompare: 'less'
        }
      });
    }

    rebuildBindGroups() {
      const gpu = this.gpu;
      this.thicknessBindGroup = this.device.createBindGroup({
        layout: this.thicknessPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: gpu.frameUniformBuffer } },
          { binding: 1, resource: gpu.depthCopyView }
        ]
      });

      this.surfaceBindGroup = this.device.createBindGroup({
        layout: this.surfacePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: gpu.frameUniformBuffer } },
          { binding: 1, resource: gpu.hdrCopyView },
          { binding: 2, resource: gpu.thicknessView },
          { binding: 3, resource: gpu.depthCopyView },
          { binding: 4, resource: gpu.shadowView },
          { binding: 5, resource: gpu.shadowSampler },
          { binding: 6, resource: gpu.linearSampler }
        ]
      });
    }

    uploadSceneState(sim, interpAlpha = 1.0) {
      const gpu = this.gpu;
      const alpha = M.clamp(interpAlpha, 0.0, 1.0);
      const oneMinusA = 1.0 - alpha;

      // 1. Upload rigid spheres + plinth shadow/caustic casters
      const balls = sim.balls;
      const sData = gpu.sphereInstanceData;
      const cData = gpu.casterData;
      cData.fill(0);
      let cPtr = 0;

      const ballCount = Math.min(balls.length, gpu.maxSpheres);
      const tmpQ = [0, 0, 0, 1];
      for (let i = 0; i < ballCount; i++) {
        const b = balls[i];
        const bx = b.prevX * oneMinusA + b.x * alpha;
        const by = b.prevY * oneMinusA + b.y * alpha;
        const bz = b.prevZ * oneMinusA + b.z * alpha;
        M.quatSlerp(tmpQ, b.prevQuat, b.quat, alpha);

        const o = i * 16;
        sData[o] = bx; sData[o + 1] = by; sData[o + 2] = bz; sData[o + 3] = b.r;
        sData[o + 4] = tmpQ[0]; sData[o + 5] = tmpQ[1]; sData[o + 6] = tmpQ[2]; sData[o + 7] = tmpQ[3];
        sData[o + 8] = b.color[0]; sData[o + 9] = b.color[1]; sData[o + 10] = b.color[2]; sData[o + 11] = b.rough;
        sData[o + 12] = b.metallic; sData[o + 13] = 1.0; sData[o + 14] = 0.0; sData[o + 15] = 0.0;

        if (cPtr < gpu.maxCasters) {
          const co = cPtr * 8;
          cData[co] = bx; cData[co + 1] = by - b.r; cData[co + 2] = bz; cData[co + 3] = b.r * 1.15;
          cData[co + 4] = 0; cData[co + 5] = 0; cData[co + 6] = 0; cData[co + 7] = 0.0; // opaque sphere contact AO
          cPtr++;
        }
      }
      if (ballCount > 0) {
        this.device.queue.writeBuffer(gpu.sphereInstanceBuffer, 0, sData, 0, ballCount * 16);
      }

      // 2. Build interpolated smooth-outer + sharp-fracture vertex stream for all jellies + per-fragment plinth casters!
      let outVert = 0;
      const vOut = this.vtxData;

      for (let j = 0; j < sim.jellies.length; j++) {
        const jb = sim.jellies[j];
        const nv = jb.numVerts;
        const pCur = jb.pos;
        const pPrev = jb.prevRenderPos;
        const norms = jb.normals;
        norms.fill(0, 0, nv * 3);

        // Interpolated vertex positions in temporary array or inline
        if (!this._interpPos || this._interpPos.length < nv * 3) {
          this._interpPos = new Float32Array(nv * 3 + 1024);
        }
        const ip = this._interpPos;
        for (let k = 0; k < nv * 3; k++) {
          ip[k] = pPrev[k] * oneMinusA + pCur[k] * alpha;
        }

        // Accumulate per-fragment centroids & radii for colored gummy caustic shadows on plinth!
        const nFrag = Math.min(8, jb.numFragments);
        const fCx = new Float32Array(nFrag);
        const fCy = new Float32Array(nFrag);
        const fCz = new Float32Array(nFrag);
        const fCnt = new Int32Array(nFrag);
        const fMinX = new Float32Array(nFrag).fill(1e9);
        const fMaxX = new Float32Array(nFrag).fill(-1e9);
        const fMinZ = new Float32Array(nFrag).fill(1e9);
        const fMaxZ = new Float32Array(nFrag).fill(-1e9);
        const fMinY = new Float32Array(nFrag).fill(1e9);

        for (let v = 0; v < nv; v++) {
          const cid = jb.compId[v];
          if (cid >= 0 && cid < nFrag) {
            const x = ip[v * 3], y = ip[v * 3 + 1], z = ip[v * 3 + 2];
            fCx[cid] += x; fCy[cid] += y; fCz[cid] += z; fCnt[cid]++;
            if (x < fMinX[cid]) fMinX[cid] = x; if (x > fMaxX[cid]) fMaxX[cid] = x;
            if (z < fMinZ[cid]) fMinZ[cid] = z; if (z > fMaxZ[cid]) fMaxZ[cid] = z;
            if (y < fMinY[cid]) fMinY[cid] = y;
          }
        }
        for (let cid = 0; cid < nFrag && cPtr < gpu.maxCasters; cid++) {
          if (fCnt[cid] < 4) continue;
          const inv = 1.0 / fCnt[cid];
          const rad = Math.max(0.08, 0.5 * Math.max(fMaxX[cid] - fMinX[cid], fMaxZ[cid] - fMinZ[cid]));
          const co = cPtr * 8;
          cData[co] = fCx[cid] * inv;
          cData[co + 1] = Math.max(0.0, fMinY[cid]);
          cData[co + 2] = fCz[cid] * inv;
          cData[co + 3] = rad;
          cData[co + 4] = jb.color[0];
          cData[co + 5] = jb.color[1];
          cData[co + 6] = jb.color[2];
          cData[co + 7] = 1.0; // jelly colored transmission caustic
          cPtr++;
        }

        // Accumulate smooth vertex normals ONLY across outer molded skin triangles (`isFrac == 0`)
        const tris = jb.surfaceTris;
        const fracFlags = jb.surfaceTriIsFracture;
        const nTris = jb.numSurfaceTris;

        for (let t = 0; t < nTris; t++) {
          if (fracFlags[t]) continue;
          const i0 = tris[t * 3] * 3, i1 = tris[t * 3 + 1] * 3, i2 = tris[t * 3 + 2] * 3;
          const e1x = ip[i1] - ip[i0], e1y = ip[i1 + 1] - ip[i0 + 1], e1z = ip[i1 + 2] - ip[i0 + 2];
          const e2x = ip[i2] - ip[i0], e2y = ip[i2 + 1] - ip[i0 + 1], e2z = ip[i2 + 2] - ip[i0 + 2];
          const nx = e1y * e2z - e1z * e2y;
          const ny = e1z * e2x - e1x * e2z;
          const nz = e1x * e2y - e1y * e2x;
          norms[i0] += nx; norms[i0 + 1] += ny; norms[i0 + 2] += nz;
          norms[i1] += nx; norms[i1 + 1] += ny; norms[i1 + 2] += nz;
          norms[i2] += nx; norms[i2 + 1] += ny; norms[i2 + 2] += nz;
        }
        for (let v = 0; v < nv; v++) {
          const v3 = v * 3;
          const len = Math.hypot(norms[v3], norms[v3 + 1], norms[v3 + 2]) || 1.0;
          norms[v3] /= len; norms[v3 + 1] /= len; norms[v3 + 2] /= len;
        }

        // Emit render triangles
        const col0 = jb.color[0], col1 = jb.color[1], col2 = jb.color[2];
        const abs0 = jb.absorb[0], abs1 = jb.absorb[1], abs2 = jb.absorb[2];

        for (let t = 0; t < nTris; t++) {
          if (outVert + 3 > this.maxDrawVerts) break;
          const isF = fracFlags[t];
          const vi0 = tris[t * 3], vi1 = tris[t * 3 + 1], vi2 = tris[t * 3 + 2];
          const a0 = vi0 * 3, a1 = vi1 * 3, a2 = vi2 * 3;

          let fnx = 0, fny = 1, fnz = 0;
          if (isF) {
            const e1x = ip[a1] - ip[a0], e1y = ip[a1 + 1] - ip[a0 + 1], e1z = ip[a1 + 2] - ip[a0 + 2];
            const e2x = ip[a2] - ip[a0], e2y = ip[a2 + 1] - ip[a0 + 1], e2z = ip[a2 + 2] - ip[a0 + 2];
            fnx = e1y * e2z - e1z * e2y;
            fny = e1z * e2x - e1x * e2z;
            fnz = e1x * e2y - e1y * e2x;
            const fl = Math.hypot(fnx, fny, fnz) || 1.0;
            fnx /= fl; fny /= fl; fnz /= fl;
          }

          const idxArr = [a0, a1, a2];
          for (let c = 0; c < 3; c++) {
            const ak = idxArr[c];
            const dst = outVert * 16;
            vOut[dst] = ip[ak];
            vOut[dst + 1] = ip[ak + 1];
            vOut[dst + 2] = ip[ak + 2];
            vOut[dst + 3] = isF ? 1.0 : 0.0;

            if (isF) {
              // Blend 75% crisp fracture plane normal + 25% smooth normal for wet organic crystalline face
              vOut[dst + 4] = fnx * 0.78 + norms[ak] * 0.22;
              vOut[dst + 5] = fny * 0.78 + norms[ak + 1] * 0.22;
              vOut[dst + 6] = fnz * 0.78 + norms[ak + 2] * 0.22;
            } else {
              vOut[dst + 4] = norms[ak];
              vOut[dst + 5] = norms[ak + 1];
              vOut[dst + 6] = norms[ak + 2];
            }
            vOut[dst + 7] = j;

            vOut[dst + 8] = col0;
            vOut[dst + 9] = col1;
            vOut[dst + 10] = col2;
            vOut[dst + 11] = 0.05;

            vOut[dst + 12] = abs0;
            vOut[dst + 13] = abs1;
            vOut[dst + 14] = abs2;
            vOut[dst + 15] = 0.0;
            outVert++;
          }
        }
      }

      this.drawVertCount = outVert;
      this.ballDrawCount = ballCount;
      this.device.queue.writeBuffer(gpu.casterBuffer, 0, cData);
      if (outVert > 0) {
        this.device.queue.writeBuffer(this.vtxBuf, 0, vOut, 0, outVert * 16);
      }
    }

    render(encoder, camera, sim, interpAlpha = 1.0) {
      const gpu = this.gpu;
      if (gpu.resizeToWindow()) {
        this.rebuildBindGroups();
      }

      camera.updateMatrices(gpu.width / gpu.height);
      gpu.updateFrameUniforms(camera, sim.simTime, 0, sim.plinthHalfX, sim.floorY, sim.plinthHalfZ, 1.06);
      this.uploadSceneState(sim, interpAlpha);

      // 1. Directional Shadow Pass (Rigid Spheres cast crisp shadows onto jellies & stage)
      {
        const spass = encoder.beginRenderPass({
          colorAttachments: [],
          depthStencilAttachment: {
            view: gpu.shadowView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });
        gpu.drawSpheresShadow(spass, this.ballDrawCount);
        spass.end();
      }

      // 2. Opaque Studio Backdrop + Optical Plinth (with jelly colored caustics & ball AO) + Rigid Spheres
      {
        const opass = encoder.beginRenderPass({
          colorAttachments: [{
            view: gpu.hdrView,
            clearValue: { r: 0.05, g: 0.07, b: 0.10, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }],
          depthStencilAttachment: {
            view: gpu.depthView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });
        gpu.drawBackgroundAndPlinth(opass);
        gpu.drawSpheres(opass, this.ballDrawCount);
        opass.end();
      }

      if (this.drawVertCount > 0) {
        // 3. Copy opaque HDR + Depth so translucent jellies refract actual background & engulfed balls!
        gpu.copySceneBackdrop(encoder);

        // 4. Jelly Volumetric Optical Thickness Pass
        {
          const tpass = encoder.beginRenderPass({
            colorAttachments: [{
              view: gpu.thicknessView,
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
              storeOp: 'store'
            }]
          });
          tpass.setPipeline(this.thicknessPipeline);
          tpass.setBindGroup(0, this.thicknessBindGroup);
          tpass.setVertexBuffer(0, this.vtxBuf);
          tpass.draw(this.drawVertCount);
          tpass.end();
        }

        // 5. Jelly Translucent Refractive + Beer-Lambert + SSS + Specular Pass
        {
          const jpass = encoder.beginRenderPass({
            colorAttachments: [{
              view: gpu.hdrView,
              loadOp: 'load',
              storeOp: 'store'
            }],
            depthStencilAttachment: {
              view: gpu.depthView,
              depthLoadOp: 'load',
              depthStoreOp: 'store'
            }
          });
          jpass.setPipeline(this.surfacePipeline);
          jpass.setBindGroup(0, this.surfaceBindGroup);
          jpass.setVertexBuffer(0, this.vtxBuf);
          jpass.draw(this.drawVertCount);
          jpass.end();
        }
      }

      // 6. ACES HDR Tone Mapping to Canvas
      gpu.runTonemapToCanvas(encoder);
    }
  }

  App.JellyRenderer = JellyRenderer;
})();
