// ============================================================================
// 07_shaders.js
// Complete GLSL ES 3.00 Shader Suite for StarFleet WebGL 2 Engine
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});

  // --------------------------------------------------------------------------
  // 1. DIRECTIONAL SHADOW MAP PASS
  // --------------------------------------------------------------------------
  const SHADOW_VS = `#version 300 es
  layout(location = 0) in vec3 a_pos;
  layout(location = 1) in uint a_packed;
  uniform mat4 u_lightVP;
  uniform mat4 u_model;
  void main() {
    gl_Position = u_lightVP * (u_model * vec4(a_pos, 1.0));
  }`;

  const SHADOW_FS = `#version 300 es
  precision highp float;
  void main() {}`;

  // --------------------------------------------------------------------------
  // 2. PROCEDURAL COSMIC SKYBOX, NEBULA & LIT CELESTIAL PLANET ARC
  // --------------------------------------------------------------------------
  const FULLSCREEN_VS = `#version 300 es
  out vec2 v_uv;
  void main() {
    vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    v_uv = pos;
    gl_Position = vec4(pos * 2.0 - 1.0, 0.99999, 1.0);
  }`;

  const SKY_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 fragColor;

  uniform mat4 u_invViewProj;
  uniform vec3 u_sunDir;
  uniform float u_time;

  float hash31(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise3(p);
      p = p * 2.04 + vec3(13.7, -7.3, 5.1);
      a *= 0.5;
    }
    return v;
  }

  // Smooth anti-aliased spherical grid star layer
  vec3 starLayer(vec3 dir, float scale, float density) {
    vec3 p = dir * scale;
    vec3 id = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash31(id);
    if (h < density) return vec3(0.0);
    vec3 jitter = (vec3(hash31(id + 1.7), hash31(id + 3.1), hash31(id + 5.9)) - 0.5) * 0.62;
    float d = length(f - jitter);
    // Clamp minimum star radius using derivative so single-pixel stars never shimmer!
    float pxSize = max(0.045, length(fwidth(p)) * 0.85);
    float core = smoothstep(pxSize * 2.2, 0.0, d);
    float bright = pow((h - density) / (1.0 - density), 2.2);
    vec3 tint = mix(vec3(0.68, 0.84, 1.0), vec3(1.0, 0.88, 0.72), hash31(id + 9.3));
    return tint * core * bright * 1.9;
  }

  void main() {
    vec4 clip = vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
    vec4 worldH = u_invViewProj * clip;
    vec3 dir = normalize(worldH.xyz / worldH.w);

    // Base deep cosmic void gradient
    vec3 col = mix(vec3(0.006, 0.010, 0.022), vec3(0.014, 0.024, 0.046), clamp(dir.y * 0.5 + 0.5, 0.0, 1.0));

    // Sweeping galactic / nebula band tilted diagonally across the sky
    float bandCoord = dot(dir, normalize(vec3(0.38, 0.78, -0.49)));
    float bandMask = exp(-bandCoord * bandCoord * 5.2);
    float n1 = fbm(dir * 2.6 + vec3(1.2, -0.4, 2.8));
    float n2 = fbm(dir * 5.4 - vec3(2.1, 1.5, -1.0));
    float darkDust = smoothstep(0.36, 0.68, fbm(dir * 3.8 + vec3(8.2, 3.1, -4.4)));

    // Cool glacial azure-teal nebula + warm dusty amber-ochre rim near key sun!
    float sunAlign = max(0.0, dot(dir, u_sunDir));
    vec3 nebCool = vec3(0.022, 0.075, 0.145) * smoothstep(0.28, 0.82, n1) * (0.45 + 0.85 * bandMask);
    vec3 nebWarm = vec3(0.16, 0.085, 0.038) * smoothstep(0.38, 0.85, n2) * pow(sunAlign, 1.8) * 1.35;
    col += (nebCool + nebWarm) * (1.0 - 0.62 * darkDust);

    // Multi-density starfield (denser inside nebula band, sparser in deep dark voids)
    float starBoost = 0.55 + 0.75 * bandMask;
    vec3 stars = starLayer(dir, 130.0, 0.968) * 1.4
               + starLayer(dir, 260.0, 0.955) * 0.85 * starBoost
               + starLayer(dir, 440.0, 0.945) * 0.45 * starBoost;
    col += stars * (1.0 - 0.55 * darkDust);

    // Colossal Celestial Planet Crescent & Key-Light Solar Corona on Starboard-Forward Side!
    vec3 planetDir = normalize(u_sunDir * vec3(0.86, 0.62, 1.06));
    float cosP = dot(dir, planetDir);
    float planetCosR = 0.935; // Large majestic celestial arc (~20.7 deg radius)
    if (cosP > planetCosR - 0.015) {
      // Ray-sphere intersection on unit sphere of angular radius acos(planetCosR)
      float sinR = sqrt(1.0 - planetCosR * planetCosR);
      // Tangent plane coordinates around planetDir
      vec3 pRight = normalize(cross(vec3(0.0, 1.0, 0.0), planetDir));
      vec3 pUp = cross(planetDir, pRight);
      vec2 diskUV = vec2(dot(dir, pRight), dot(dir, pUp)) / sinR;
      float r2 = dot(diskUV, diskUV);

      // Atmospheric halo around planet limb
      float atmo = exp(-max(0.0, sqrt(r2) - 0.98) * 22.0) * smoothstep(1.32, 0.92, sqrt(r2));
      vec3 limbSunDir = normalize(vec3(0.65, 0.58, -0.48));
      if (r2 < 1.0) {
        vec3 sNorm = vec3(diskUV.x, diskUV.y, sqrt(max(0.0, 1.0 - r2)));
        float ndl = clamp(dot(sNorm, limbSunDir), 0.0, 1.0);
        float bands = fbm(vec3(sNorm.x * 3.0, sNorm.y * 11.0, sNorm.z * 3.0));
        vec3 surfAlb = mix(vec3(0.09, 0.13, 0.20), vec3(0.28, 0.20, 0.14), bands);
        float limb = pow(1.0 - sNorm.z, 3.0);
        vec3 pCol = surfAlb * (pow(ndl, 1.25) * 2.1 + 0.015)
                  + vec3(0.35, 0.62, 0.95) * limb * (0.25 + 1.15 * ndl);
        float edgeAA = smoothstep(1.0, 0.992, sqrt(r2));
        col = mix(col, pCol, edgeAA);
      }
      col += vec3(0.30, 0.56, 0.92) * atmo * 0.42;
    }

    // Key Celestial Sun Glow casting directional light across the fleet
    float sunGlow = pow(sunAlign, 64.0) * 1.4 + pow(sunAlign, 8.0) * 0.14;
    col += vec3(1.0, 0.86, 0.66) * sunGlow;

    fragColor = vec4(col, 1.0);
  }`;

  // --------------------------------------------------------------------------
  // 3. UNIFIED 1x1x1 VOXEL SURFACE SHADER (Opaque & Translucent Solid Voxels)
  // --------------------------------------------------------------------------
  const VOXEL_VS = `#version 300 es
  layout(location = 0) in vec3 a_pos;
  layout(location = 1) in uint a_packed;

  uniform mat4 u_viewProj;
  uniform mat4 u_lightVP;
  uniform mat4 u_model;

  out vec3 v_worldPos;
  out vec3 v_localPos;
  out vec3 v_worldNormal;
  out vec4 v_shadowCoord;
  out float v_ao;
  flat out uint v_matId;
  flat out uint v_dir;

  const vec3 NORMALS[6] = vec3[6](
    vec3( 1.0,  0.0,  0.0),
    vec3(-1.0,  0.0,  0.0),
    vec3( 0.0,  1.0,  0.0),
    vec3( 0.0, -1.0,  0.0),
    vec3( 0.0,  0.0,  1.0),
    vec3( 0.0,  0.0, -1.0)
  );

  void main() {
    uint dir = a_packed & 7u;
    uint matId = (a_packed >> 3u) & 255u;
    uint aoInt = (a_packed >> 11u) & 3u;

    vec3 localN = NORMALS[dir];
    vec4 wp = u_model * vec4(a_pos, 1.0);
    v_worldPos = wp.xyz;
    v_localPos = a_pos;
    v_worldNormal = normalize(mat3(u_model) * localN);
    v_shadowCoord = u_lightVP * vec4(wp.xyz + v_worldNormal * 0.65, 1.0);
    v_ao = float(aoInt) / 3.0;
    v_matId = matId;
    v_dir = dir;

    gl_Position = u_viewProj * wp;
  }`;

  const VOXEL_FS = `#version 300 es
  precision highp float;
  precision highp sampler2DShadow;

  in vec3 v_worldPos;
  in vec3 v_localPos;
  in vec3 v_worldNormal;
  in vec4 v_shadowCoord;
  in float v_ao;
  flat in uint v_matId;
  flat in uint v_dir;

  out vec4 fragColor;

  uniform vec4 u_matA[64]; // [r, g, b, roughness]
  uniform vec4 u_matB[64]; // [emiR, emiG, emiB, emiIntensity]
  uniform vec4 u_matC[64]; // [metallic, edgeHighlight, alpha, flags]

  uniform vec3 u_camPos;
  uniform vec3 u_sunDir;
  uniform vec3 u_sunColor;
  uniform vec3 u_ambTop;
  uniform vec3 u_ambBot;
  uniform float u_shadowStrength;
  uniform sampler2DShadow u_shadowMap;

  // Dynamic Scene Point Lights (thrusters, muzzle flashes, impacts, core, interior lights)
  uniform int u_numPointLights;
  uniform vec4 u_pointLightPosRad[20]; // xyz = pos, w = invRadius
  uniform vec4 u_pointLightCol[20];    // rgb = linear color * intensity

  // Dynamic Main Beam Capsule Light
  uniform vec3 u_beamStart;
  uniform vec3 u_beamEnd;
  uniform vec4 u_beamLightCol; // rgb = color, w = intensity (0 when inactive)

  // Per-Object Special Effects (1=Flagship Cannon Charge, 2=Core Pulse, 3=Corridor Flow, 4=Asteroid Fracture Heat)
  uniform int u_specialMode;
  uniform vec4 u_specialParams; // x=param1, y=param2, z=shieldWaveZ, w=shieldReflectStrength
  uniform float u_time;

  float sampleShadowPCF(vec4 sc) {
    if (u_shadowStrength <= 0.001) return 1.0;
    vec3 proj = sc.xyz / sc.w * 0.5 + 0.5;
    if (proj.x < 0.002 || proj.x > 0.998 || proj.y < 0.002 || proj.y > 0.998 || proj.z > 0.999) {
      return 1.0;
    }
    float bias = 0.00055;
    vec2 texel = vec2(1.0 / 4096.0);
    float sum = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        sum += texture(u_shadowMap, vec3(proj.xy + vec2(float(x), float(y)) * texel, proj.z - bias));
      }
    }
    return mix(1.0, sum / 9.0, u_shadowStrength);
  }

  void main() {
    vec4 mA = u_matA[v_matId];
    vec4 mB = u_matB[v_matId];
    vec4 mC = u_matC[v_matId];

    vec3 albedo = mA.rgb;
    float roughness = mA.w;
    vec3 emissive = mB.rgb;
    float metallic = mC.x;
    float edgeStrength = mC.y;
    float alpha = mC.z;
    float flags = mC.w;

    // 1. Exact 1x1x1 Voxel Cell Coordinates on Merged Greedy Quads!
    vec2 faceUV;
    vec3 localU, localV;
    if (v_dir < 2u) {
      faceUV = v_localPos.yz;
      localU = vec3(0.0, 1.0, 0.0);
      localV = vec3(0.0, 0.0, 1.0);
    } else if (v_dir < 4u) {
      faceUV = v_localPos.xz;
      localU = vec3(1.0, 0.0, 0.0);
      localV = vec3(0.0, 0.0, 1.0);
    } else {
      faceUV = v_localPos.xy;
      localU = vec3(1.0, 0.0, 0.0);
      localV = vec3(0.0, 1.0, 0.0);
    }

    // Screen-space derivative fade prevents ANY sub-pixel aliasing or moire on distant ships!
    vec2 fw = fwidth(faceUV);
    float pxSpan = max(fw.x, fw.y);
    float microFade = 1.0 - smoothstep(0.10, 0.36, pxSpan);

    vec2 cellF = fract(faceUV);
    vec2 edgeDist2 = min(cellF, 1.0 - cellF);
    float cellEdgeDist = min(edgeDist2.x, edgeDist2.y);

    // Subtle 1x1 voxel cell bevel & discrete block granularity up close!
    vec3 N = normalize(v_worldNormal);
    float voxelSeam = (1.0 - smoothstep(0.0, 0.09, cellEdgeDist)) * microFade;

    if (microFade > 0.005) {
      vec2 bevelSlope = (smoothstep(0.88, 1.0, cellF) - smoothstep(0.12, 0.0, cellF)) * (0.09 * edgeStrength * microFade);
      // Convert local tangent bevel softly toward world normal
      N = normalize(N + (localU * bevelSlope.x + localV * bevelSlope.y) * 0.55);
      // Subtle 1x1 voxel panel seam darkening on opaque armor
      if (alpha > 0.99 && mB.w < 0.1) {
        albedo *= (1.0 - 0.075 * voxelSeam);
      }
    }

    // Translucent & Emissive Solid Voxels: preserve crisp 1x1x1 crystalline block structure!
    if (alpha < 0.99 || mB.w > 0.5) {
      float crystalBorder = 1.0 - smoothstep(0.0, 0.13, cellEdgeDist);
      float crystalFade = 1.0 - smoothstep(0.16, 0.55, pxSpan);
      emissive *= mix(1.0, mix(1.18, 0.42, crystalBorder), crystalFade * 0.85);
      if (alpha < 0.99) {
        alpha = clamp(alpha + crystalBorder * crystalFade * 0.24, 0.1, 0.92);
      }
    }

    // 2. Per-Object Dynamic Emissive & Clipping Effects
    if (u_specialMode == 5) {
      // Command Bridge Exterior Pass: cleanly discard Flagship rear/citadel voxels behind the panoramic window plane!
      if (v_worldPos.z < u_specialParams.x) discard;
      if (mB.w > 0.5 && v_localPos.z > 255.0 && abs(v_localPos.x) < 25.0 && abs(v_localPos.y) < 22.0) {
        emissive *= 0.14;
      }
    }
    if (u_specialMode == 1 && mB.w > 0.5) {
      // Flagship Main Beam Cannon sequential capacitor slot ignition along Z = [258 .. 462]
      if (v_localPos.z > 255.0 && abs(v_localPos.x) < 25.0 && abs(v_localPos.y) < 22.0) {
        float slotNorm = clamp((v_localPos.z - 260.0) / 205.0, 0.0, 1.0);
        float chargeP = u_specialParams.x; // 0..1 charge progress, >1 during active beam
        float lit = smoothstep(slotNorm - 0.08, slotNorm + 0.02, chargeP);
        float pulse = 1.0 + 0.35 * sin(u_time * 18.0 - slotNorm * 10.0) * step(1.0, chargeP);
        emissive *= mix(0.14, 2.25 * pulse, lit);
      }
    } else if (u_specialMode == 2 && mB.w > 0.4) {
      // Power Core Atrium: breathing core & outward radial strut energy waves!
      float radXZ = length(v_localPos.xz);
      if (radXZ < 24.0) {
        float converge = sin(abs(v_localPos.y) * 0.075 - u_time * 3.4) * 0.5 + 0.5;
        float breath = 0.78 + 0.45 * sin(u_time * 2.1);
        emissive *= breath * (0.75 + 0.65 * converge);
      } else {
        float wave = sin(radXZ * 0.085 - u_time * 4.2) * 0.5 + 0.5;
        emissive *= (0.45 + 1.35 * wave * wave);
      }
    } else if (u_specialMode == 3 && mB.w > 0.4) {
      // Energy Loading Corridor: longitudinal energy flow toward +Z convergence cavity!
      float flow = sin(v_localPos.z * 0.07 - u_time * 5.0) * 0.5 + 0.5;
      emissive *= (0.55 + 1.15 * flow * flow);
    } else if (u_specialMode == 4 && flags >= 1.5) {
      // Asteroid Internal Fracture Plane Incandescence (heats up during beam/missile cleave, then cools!)
      float heat = max(0.0, u_specialParams.x);
      float vein = (flags > 2.5) ? 1.35 : 0.65;
      vec3 hotCol = mix(vec3(0.95, 0.22, 0.03), vec3(1.0, 0.62, 0.20), clamp(heat * 0.42 * vein, 0.0, 1.0));
      emissive += hotCol * heat * vein * 1.45;
    }

    // 3. PBR-Inspired Dual-Lobe Lighting (Broad Soft Armor Sheen + Sharp Metallic Edge Catchlight!)
    vec3 V = normalize(u_camPos - v_worldPos);
    float ao = mix(0.20, 1.0, pow(clamp(v_ao, 0.0, 1.0), 1.2));

    // Specular anti-aliasing: slightly widen roughness on rapid normal changes
    float nVar = length(fwidth(N));
    float effRough = clamp(roughness + nVar * 0.35, 0.12, 0.96);

    vec3 F0 = mix(vec3(0.04), albedo, metallic);
    vec3 diffAlb = albedo * (1.0 - metallic * 0.78);

    // Hemisphere ambient fill (lit side vs cosmic shadow side)
    float hemi = N.y * 0.5 + 0.5;
    vec3 ambient = mix(u_ambBot, u_ambTop, hemi) * ao;
    // Slight cosmic rim bounce on dark side so hulls stay legible against space
    float backFill = max(0.0, dot(N, normalize(vec3(-u_sunDir.x, 0.25, -u_sunDir.z))));
    ambient += u_ambTop * backFill * 0.28 * ao;

    vec3 color = diffAlb * ambient;

    // Primary Celestial Key Light + Shadow Map
    float NdotL = max(0.0, dot(N, u_sunDir));
    if (NdotL > 0.0) {
      float shadow = sampleShadowPCF(v_shadowCoord);
      vec3 H = normalize(u_sunDir + V);
      float NdotH = max(0.0, dot(N, H));

      // Broad soft specular lobe on primary hull terraces
      float shininessBroad = mix(96.0, 7.0, effRough);
      float specBroad = pow(NdotH, shininessBroad) * (shininessBroad * 0.035 + 0.12);

      // Crisp metallic edge catchlight on exposed ridge bevels (high v_ao + voxel edge)
      float ridgeMask = smoothstep(0.75, 1.0, v_ao) * edgeStrength * (0.35 + 0.65 * voxelSeam);
      float specEdge = pow(NdotH, 90.0) * ridgeMask * 0.85;

      vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(0.0, dot(H, V)), 5.0);
      color += (diffAlb + F * specBroad + vec3(0.85, 0.92, 1.0) * specEdge) * u_sunColor * NdotL * shadow;
    }

    // 4. Dynamic Point Lights (Thrusters, Muzzles, Explosions, Core, Interior Consoles)
    for (int i = 0; i < 20; i++) {
      if (i >= u_numPointLights) break;
      vec4 lp = u_pointLightPosRad[i];
      vec3 toL = lp.xyz - v_worldPos;
      float dist2 = dot(toL, toL);
      float normD = sqrt(dist2) * lp.w;
      if (normD >= 1.0) continue;
      float atten = (1.0 - normD);
      atten = atten * atten / (1.0 + normD * normD * 3.5);

      vec3 L = toL * inversesqrt(max(dist2, 1e-4));
      float nl = max(0.0, dot(N, L)) * 0.82 + 0.18 * ao; // subtle wrap for volumetric feel
      vec3 H = normalize(L + V);
      float spec = pow(max(0.0, dot(N, H)), mix(64.0, 10.0, effRough)) * 0.45;
      color += (diffAlb * nl + F0 * spec) * u_pointLightCol[i].rgb * atten;
    }

    // 5. Dynamic Main Energy Beam Capsule Light
    if (u_beamLightCol.w > 0.001) {
      vec3 ba = u_beamEnd - u_beamStart;
      float h = clamp(dot(v_worldPos - u_beamStart, ba) / max(dot(ba, ba), 1.0), 0.0, 1.0);
      vec3 closest = u_beamStart + ba * h;
      vec3 toB = closest - v_worldPos;
      float d = length(toB);
      float bAtten = u_beamLightCol.w / (1.0 + d * 0.018 + d * d * 0.00022);
      vec3 Lb = toB / max(d, 0.001);
      float nl = max(0.0, dot(N, Lb)) * 0.85 + 0.15 * ao;
      color += diffAlb * nl * u_beamLightCol.rgb * bAtten;
    }

    // 6. Shield Expansion Wave Soft Hull Reflection!
    if (u_specialParams.w > 0.001) {
      float dz = abs(v_localPos.z - u_specialParams.z);
      float waveBand = exp(-dz * dz * 0.00045) * u_specialParams.w;
      float fres = pow(1.0 - max(0.0, dot(N, V)), 2.0) * 0.65 + 0.35;
      color += vec3(0.14, 0.72, 1.0) * (waveBand + u_specialParams.y * 0.12) * fres * ao;
    }

    color += emissive;
    // Smooth stochastic dither dissolve for ultra-far trailing rocks (> 1.5km behind fleet)
    if (u_specialMode == 4 && u_specialParams.y > 0.001) {
      float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (ign < u_specialParams.y) discard;
    }

    fragColor = vec4(max(vec3(0.0), color), alpha);
  }`;

  // --------------------------------------------------------------------------
  // 4. CONTINUOUS VOLUMETRIC-STYLE THRUSTER PLUME SHADER
  // --------------------------------------------------------------------------
  const PLUME_VS = `#version 300 es
  layout(location = 0) in vec3 a_pos; // x in [-1..1], y in [0..1] (0=nozzle, 1=tip), z = finAngleFlag
  uniform mat4 u_viewProj;
  uniform mat4 u_model;
  out vec2 v_uv;
  out vec3 v_worldPos;
  void main() {
    v_uv = vec2(a_pos.x, a_pos.y);
    vec4 wp = u_model * vec4(a_pos.x, a_pos.z, -a_pos.y, 1.0);
    v_worldPos = wp.xyz;
    gl_Position = u_viewProj * wp;
  }`;

  const PLUME_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  in vec3 v_worldPos;
  out vec4 fragColor;

  uniform float u_time;
  uniform vec4 u_plumeParams; // x = surgeIntensity (1=cruise, 2.2=surge), y = seed, z = radialFade, w = opacity

  float hash12(vec2 p) {
    p = mod(p, 78.0);
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1,0)), f.x),
               mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), f.x), f.y);
  }

  void main() {
    float u = abs(v_uv.x);     // 0 = center axis, 1 = outer edge
    float t = v_uv.y;          // 0 = nozzle throat, 1 = far tip
    float surge = u_plumeParams.x;
    float seed = u_plumeParams.y;

    // Plume tapers cleanly toward tip while undulating gently
    float wave = (vnoise(vec2(t * 4.5 - u_time * (5.5 + surge * 3.5), seed * 7.1)) - 0.5) * 0.16 * t;
    float widthEnv = mix(0.72, 0.18, pow(t, 0.78)) * (1.0 + 0.12 * surge * (1.0 - t));
    float r = (u + wave * 0.5) / max(0.08, widthEnv);

    if (r > 1.35) discard;

    // Dense incandescent inner throat core + translucent streaming outer sheath + fine filaments!
    float innerCore = exp(-r * r * 5.8) * pow(max(0.0, 1.0 - t * 0.92), 1.85);
    float midSheath = exp(-r * r * 2.0) * pow(max(0.0, 1.0 - t), 1.15);

    // Fine longitudinal plasma filaments & outer light motes
    float streakNoise = vnoise(vec2(v_uv.x * 9.0 + seed * 3.3, t * 8.0 - u_time * (9.0 + surge * 5.0)));
    float outerStreaks = smoothstep(0.45, 0.88, streakNoise) * exp(-pow(r - 0.65, 2.0) * 6.0) * (1.0 - t) * t * 2.6;

    // Nozzle lip shock-diamonds (exact 150 cycles per 78.0s loop)
    float shock = (0.82 + 0.18 * cos(t * 26.0 - u_time * 12.0830486)) * smoothstep(0.75, 0.0, t);

    vec3 cCore = vec3(0.86, 0.98, 1.00) * innerCore * (2.6 + surge * 1.4) * shock;
    vec3 cMid  = vec3(0.09, 0.66, 1.00) * midSheath * (1.45 + surge * 0.75);
    vec3 cOut  = vec3(0.18, 0.84, 1.00) * outerStreaks * (0.9 + surge * 0.5);

    float entrySmooth = smoothstep(0.0, 0.035, t);
    vec3 col = (cCore + cMid + cOut) * entrySmooth * u_plumeParams.w;
    fragColor = vec4(col, 1.0);
  }`;

  // --------------------------------------------------------------------------
  // 5. CAMERA-BILLBOARDED RIBBON / BEAM / BOLT / MISSILE TRAIL SHADER
  // --------------------------------------------------------------------------
  const RIBBON_VS = `#version 300 es
  layout(location = 0) in vec3 a_p0;
  layout(location = 1) in vec3 a_p1;
  layout(location = 2) in vec4 a_uvWidth; // x=uAlong(0..1), y=side(-1..+1), z=halfWidth, w=styleParam

  uniform mat4 u_viewProj;
  uniform vec3 u_camPos;

  out vec2 v_uv;
  out float v_style;

  void main() {
    vec3 tang = a_p1 - a_p0;
    float tl = length(tang);
    tang = tl > 1e-4 ? (tang / tl) : vec3(0.0, 0.0, 1.0);
    vec3 viewDir = normalize(u_camPos - a_p0);
    vec3 sideDir = cross(tang, viewDir);
    float sl = length(sideDir);
    sideDir = sl > 1e-4 ? (sideDir / sl) : vec3(1.0, 0.0, 0.0);

    vec3 worldPos = a_p0 + sideDir * (a_uvWidth.y * a_uvWidth.z);
    v_uv = vec2(a_uvWidth.x, a_uvWidth.y);
    v_style = a_uvWidth.w;
    gl_Position = u_viewProj * vec4(worldPos, 1.0);
  }`;

  const RIBBON_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;      // x in [0..1] along length, y in [-1..+1] across width
  in float v_style;  // encodes weapon/trail type & local fade
  out vec4 fragColor;

  uniform float u_time;
  uniform int u_ribbonKind; // 0 = Main Beam, 1 = Pulse Bolt, 2 = CIWS Tracer, 3 = Missile Trail
  uniform vec4 u_ribbonParams; // x=intensity, y=detachHeadU, z=pulsePhase, w=extra

  float hash12(vec2 p) {
    p = mod(p, 78.0);
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1,0)), f.x),
               mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), f.x), f.y);
  }

  void main() {
    // Clamp u & r against MSAA off-center sample extrapolation so pow() NEVER produces NaN!
    float u = clamp(v_uv.x, 0.0, 1.0);
    float r = clamp(abs(v_uv.y), 0.0, 1.5);

    if (u_ribbonKind == 0) {
      // FLAGSHIP MAIN ENERGY BEAM:
      // Focused blazing inner plasma core + translucent helical outer sheath + pulsing energy rings!
      float detachStart = u_ribbonParams.y;
      if (u < detachStart) discard;
      float startFade = smoothstep(detachStart, detachStart + 0.05, u);
      float endFade = smoothstep(1.0, 0.96, u);

      float pulseW = 1.0 + 0.10 * sin(u * 32.0 - u_time * 28.0) + 0.06 * sin(u_time * 19.0);
      float rr = r / pulseW;

      float core = exp(-rr * rr * 24.0);
      float midGlow = exp(-rr * rr * 4.8);
      float helical = vnoise(vec2(u * 38.0 - u_time * 24.0, v_uv.y * 5.0 + sin(u * 20.0 - u_time * 15.0)));
      float outerFilaments = smoothstep(0.42, 0.86, helical) * exp(-pow(max(0.0, abs(rr - 0.42)), 2.0) * 10.0);

      vec3 col = vec3(0.92, 0.99, 1.00) * core * 4.5
               + vec3(0.10, 0.74, 1.00) * midGlow * 1.65
               + vec3(0.28, 0.90, 1.00) * outerFilaments * 1.25;
      col *= startFade * endFade * u_ribbonParams.x;
      fragColor = vec4(max(vec3(0.0), col), 1.0);
    } else if (u_ribbonKind == 1) {
      // PULSE TURRET ENERGY BOLT: bright condensed head (u->1) + thin halo + short comet tail (u->0)
      float headShape = smoothstep(0.0, 0.78, u) * smoothstep(1.0, 0.82, u);
      float core = exp(-r * r * 12.0) * pow(max(0.0, u), 1.6);
      float halo = exp(-r * r * 2.8) * pow(max(0.0, u), 0.95);
      vec3 col = vec3(0.88, 0.98, 1.0) * core * 3.6
               + vec3(0.10, 0.74, 1.0) * halo * 1.55
               + vec3(0.16, 0.52, 1.0) * headShape * exp(-r * r * 5.0) * 0.85;
      fragColor = vec4(max(vec3(0.0), col * max(0.0, v_style)), 1.0);
    } else if (u_ribbonKind == 2) {
      // GUARD CIWS RAPID POINT-DEFENSE TRACER: crisp staccato cyan-amber bolt!
      float core = exp(-r * r * 14.0) * smoothstep(0.0, 0.38, u) * smoothstep(1.0, 0.86, u);
      float sheath = exp(-r * r * 3.4) * smoothstep(0.0, 0.25, u);
      vec3 col = mix(vec3(0.18, 0.86, 1.0), vec3(1.0, 0.88, 0.58), pow(max(0.0, u), 2.0)) * core * 3.8
               + vec3(0.08, 0.62, 1.0) * sheath * 1.25;
      fragColor = vec4(max(vec3(0.0), col * max(0.0, v_style)), 1.0);
    } else {
      // VANGUARD MISSILE MODULATED VAPOR & PLASMA TRAIL:
      // Sleek curved cyan-smoke ribbon with hot amber-white motor head!
      float turb = vnoise(vec2(u * 26.0 - u_time * 3.0, v_uv.y * 2.5 + v_style * 7.3));
      float densityMod = 0.42 + 0.58 * turb;
      float hotHead = pow(max(0.0, u), 7.0) * exp(-r * r * 12.0);
      float wakeBody = exp(-r * r * mix(3.2, 8.5, u)) * smoothstep(0.0, 0.32, u) * densityMod;

      vec3 col = vec3(1.0, 0.68, 0.24) * hotHead * 2.8
               + mix(vec3(0.09, 0.24, 0.42), vec3(0.18, 0.74, 1.0), pow(max(0.0, u), 1.5)) * wakeBody * 0.68;
      fragColor = vec4(max(vec3(0.0), col * clamp(v_style, 0.0, 1.2)), 1.0);
    }
  }`;

  // --------------------------------------------------------------------------
  // 6. SCULPTED CONFORMAL FLEET ENERGY SHIELD SHADER
  // --------------------------------------------------------------------------
  const SHIELD_VS = `#version 300 es
  layout(location = 0) in vec3 a_pos;    // Conformal unit-normalized local coordinates [-1..1]
  layout(location = 1) in vec3 a_normal;

  uniform mat4 u_viewProj;
  uniform mat4 u_model;
  uniform vec3 u_halfExtents;            // Tailored hull envelope half-extents (X, Y, Z)
  uniform vec4 u_shieldState;            // x=inflate(0.76..1.0), y=waveNormZ(1.2..-1.2), z=intensity, w=seed

  out vec3 v_localNormPos;
  out vec3 v_worldPos;
  out vec3 v_worldNormal;

  void main() {
    // Stage 1 -> Stage 2: shield arcs appear close to hull (0.76) then expand outward to full conformal envelope (1.0)!
    vec3 scaledLocal = a_pos * u_halfExtents * u_shieldState.x;
    vec4 wp = u_model * vec4(scaledLocal, 1.0);
    v_localNormPos = a_pos;
    v_worldPos = wp.xyz;
    v_worldNormal = normalize(mat3(u_model) * normalize(a_normal / max(u_halfExtents, vec3(1.0))));
    gl_Position = u_viewProj * wp;
  }`;

  const SHIELD_FS = `#version 300 es
  precision highp float;
  in vec3 v_localNormPos;
  in vec3 v_worldPos;
  in vec3 v_worldNormal;
  out vec4 fragColor;

  uniform vec3 u_camPos;
  uniform float u_time;
  uniform vec4 u_shieldState; // x=inflate, y=waveNormZ(bow=+1 -> stern=-1), z=intensity, w=seed

  void main() {
    float intensity = u_shieldState.z;
    if (intensity <= 0.001) discard;

    vec3 N = normalize(v_worldNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(u_camPos - v_worldPos);

    // Sheer Fresnel transparency: ultra-clear center so voxel ship hull stays 100% crisp behind it,
    // concentrated luminous rim along contours and overlapping folds!
    float ndv = abs(dot(N, V));
    float fresnel = pow(1.0 - ndv, 2.85);
    float frontFactor = gl_FrontFacing ? 1.0 : 0.36;

    // Expansion wave sweeping from Bow (+Z = +1.0) across flanks to Stern (-Z = -1.0)
    float zNorm = v_localNormPos.z;
    float waveFront = u_shieldState.y; // sweeps from +1.25 down to -1.35 during activation!
    float covered = smoothstep(waveFront - 0.18, waveFront + 0.08, zNorm);
    if (covered <= 0.002) discard;

    // Luminous leading expansion arc & trailing concentric ripples!
    float waveDist = abs(zNorm - waveFront);
    float leadingCrest = exp(-waveDist * waveDist * 42.0) * step(-1.25, waveFront);
    float trailingRipples = sin((zNorm - waveFront) * 34.0) * 0.5 + 0.5;
    trailingRipples *= exp(-max(0.0, zNorm - waveFront) * 4.5) * step(waveFront, zNorm) * step(-1.25, waveFront);

    // Fleet Design Motif: Stepped-Chevron / Cantilevered Lamina Surface Flow Lines! (exact 78.0s loop period)
    float chevronCoord = zNorm * 9.0 - abs(v_localNormPos.x) * 4.5 - abs(v_localNormPos.y) * 2.5;
    float laminaRibs = pow(max(0.0, 0.5 + 0.5 * cos(chevronCoord * 6.2831853 - u_time * 1.772183)), 8.0);
    float fineGrid = pow(max(0.0, 0.5 + 0.5 * cos((v_localNormPos.x * 14.0 + v_localNormPos.y * 10.0) * 3.1415926)), 10.0);

    // Gliding specular sheen band sliding smoothly along the curved shield! (exact 22 cycles per 78.0s)
    float glideSheen = exp(-pow(fract(zNorm * 0.5 - u_time * 0.28205128 + u_shieldState.w) - 0.5, 2.0) * 26.0);

    // Early stage (inflate < 0.92): crisp segmented lamina arcs stand out before merging into continuous surface!
    float earlyArcBoost = smoothstep(0.98, 0.78, u_shieldState.x);
    float pattern = laminaRibs * (0.28 + 1.35 * earlyArcBoost) + fineGrid * 0.14 + glideSheen * 0.24;

    float baseFilm = 0.024 + fresnel * 0.68 + pattern * (0.14 + fresnel * 0.55);
    float totalE = (baseFilm * covered + leadingCrest * 1.85 + trailingRipples * 0.42) * intensity * frontFactor;

    vec3 col = mix(vec3(0.08, 0.64, 1.00), vec3(0.58, 0.96, 1.00), clamp(fresnel * 0.7 + leadingCrest + laminaRibs * 0.35, 0.0, 1.0));
    fragColor = vec4(col * totalE, 1.0);
  }`;

  // --------------------------------------------------------------------------
  // 7. INSTANCED BILLBOARD PARTICLES (Flashes, Shock Rings, Dust & Space Motes)
  // --------------------------------------------------------------------------
  const PARTICLE_VS = `#version 300 es
  layout(location = 0) in vec2 a_quad;       // [-1..1]^2
  layout(location = 1) in vec4 a_instPosRad; // xyz = worldPos, w = radius
  layout(location = 2) in vec4 a_instColKind;// rgb = linear color, w = kind (0=glowOrb, 1=shockRing, 2=smokeDust, 3=mote)

  uniform mat4 u_viewProj;
  uniform vec3 u_camRight;
  uniform vec3 u_camUp;

  out vec2 v_uv;
  out vec4 v_colKind;

  void main() {
    v_uv = a_quad;
    v_colKind = a_instColKind;
    vec3 wp = a_instPosRad.xyz + (u_camRight * a_quad.x + u_camUp * a_quad.y) * a_instPosRad.w;
    gl_Position = u_viewProj * vec4(wp, 1.0);
  }`;

  const PARTICLE_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  in vec4 v_colKind;
  out vec4 fragColor;

  void main() {
    float r2 = dot(v_uv, v_uv);
    if (r2 >= 1.0) discard;
    float r = sqrt(max(0.0, r2));
    float omr = max(0.0, 1.0 - r);
    float omr2 = max(0.0, 1.0 - r2);
    float kind = v_colKind.w;

    if (kind < 0.5) {
      // 0: Soft HDR Energy / Muzzle / Fracture Flash Orb (core + saturated outer halo)
      float core = exp(-r2 * 9.5);
      float halo = pow(omr, 2.4) * 0.65;
      vec3 c = max(vec3(0.0), v_colKind.rgb * halo + mix(v_colKind.rgb, vec3(1.0), 0.55) * core * 1.35);
      fragColor = vec4(c, 0.0);
    } else if (kind < 1.5) {
      // 1: Expanding Energy Shock Ring
      float ring = exp(-pow(abs(r - 0.72), 2.0) * 48.0) * smoothstep(1.0, 0.78, r);
      fragColor = vec4(max(vec3(0.0), v_colKind.rgb * ring * 1.5), 0.0);
    } else if (kind < 2.5) {
      // 2: Semi-opaque Lit Asteroid Dust / Debris Cloud (premultiplied alpha!)
      float puff = pow(omr2, 1.8) * 0.40;
      fragColor = vec4(max(vec3(0.0), v_colKind.rgb * puff), puff);
    } else {
      // 3: Crisp Space Parallax Dust / Energy Spark Mote
      float mote = exp(-r2 * 7.5) * omr2;
      fragColor = vec4(max(vec3(0.0), v_colKind.rgb * mote), 0.0);
    }
  }`;

  // --------------------------------------------------------------------------
  // 8. HDR MULTI-MIP BLOOM & CHROMA-PRESERVING FILMIC COMPOSITE
  // --------------------------------------------------------------------------
  const BLOOM_PREFILTER_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 fragColor;
  uniform sampler2D u_tex;
  uniform vec2 u_texelSize;

  void main() {
    // 4-tap box filter with Karis-style firefly suppression & soft threshold
    vec3 c0 = max(vec3(0.0), texture(u_tex, v_uv + vec2(-0.5, -0.5) * u_texelSize).rgb);
    vec3 c1 = max(vec3(0.0), texture(u_tex, v_uv + vec2( 0.5, -0.5) * u_texelSize).rgb);
    vec3 c2 = max(vec3(0.0), texture(u_tex, v_uv + vec2(-0.5,  0.5) * u_texelSize).rgb);
    vec3 c3 = max(vec3(0.0), texture(u_tex, v_uv + vec2( 0.5,  0.5) * u_texelSize).rgb);
    vec3 c = (c0 + c1 + c2 + c3) * 0.25;

    float br = max(c.r, max(c.g, c.b));
    float threshold = 1.05;
    float knee = 0.65;
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = (soft * soft) / (4.0 * knee + 1e-4);
    float contrib = max(soft, br - threshold) / max(br, 1e-4);
    fragColor = vec4(min(c * contrib, vec3(18.0)), 1.0);
  }`;

  const BLOOM_DOWN_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 fragColor;
  uniform sampler2D u_tex;
  uniform vec2 u_texelSize;

  void main() {
    vec2 d = u_texelSize;
    vec3 a = texture(u_tex, v_uv).rgb * 0.25;
    a += texture(u_tex, v_uv + vec2(-d.x, -d.y)).rgb * 0.125;
    a += texture(u_tex, v_uv + vec2( d.x, -d.y)).rgb * 0.125;
    a += texture(u_tex, v_uv + vec2(-d.x,  d.y)).rgb * 0.125;
    a += texture(u_tex, v_uv + vec2( d.x,  d.y)).rgb * 0.125;
    a += texture(u_tex, v_uv + vec2(-2.0*d.x, 0.0)).rgb * 0.0625;
    a += texture(u_tex, v_uv + vec2( 2.0*d.x, 0.0)).rgb * 0.0625;
    a += texture(u_tex, v_uv + vec2(0.0, -2.0*d.y)).rgb * 0.0625;
    a += texture(u_tex, v_uv + vec2(0.0,  2.0*d.y)).rgb * 0.0625;
    fragColor = vec4(a, 1.0);
  }`;

  const BLOOM_UP_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 fragColor;
  uniform sampler2D u_tex;
  uniform vec2 u_texelSize;
  uniform float u_weight;

  void main() {
    vec2 d = u_texelSize * 1.25;
    vec3 s = texture(u_tex, v_uv).rgb * 4.0;
    s += texture(u_tex, v_uv + vec2(-d.x, 0.0)).rgb * 2.0;
    s += texture(u_tex, v_uv + vec2( d.x, 0.0)).rgb * 2.0;
    s += texture(u_tex, v_uv + vec2(0.0, -d.y)).rgb * 2.0;
    s += texture(u_tex, v_uv + vec2(0.0,  d.y)).rgb * 2.0;
    s += texture(u_tex, v_uv + vec2(-d.x, -d.y)).rgb;
    s += texture(u_tex, v_uv + vec2( d.x, -d.y)).rgb;
    s += texture(u_tex, v_uv + vec2(-d.x,  d.y)).rgb;
    s += texture(u_tex, v_uv + vec2( d.x,  d.y)).rgb;
    fragColor = vec4((s / 16.0) * u_weight, 1.0);
  }`;

  // Chroma-Preserving Filmic Tonemapper: retains colorful transition halos around bright
  // beams/thrusters/shields while keeping underlying voxel silhouettes crisp and readable!
  const COMPOSITE_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 fragColor;
  uniform sampler2D u_sceneTex;
  uniform sampler2D u_bloomTex;
  uniform float u_bloomStrength;
  uniform float u_exposure;

  vec3 agxChromaTonemap(vec3 hdr) {
    vec3 x = max(vec3(0.0), hdr);
    float peak = max(x.r, max(x.g, x.b));
    if (peak < 1e-6) return vec3(0.0);

    // Compress luminance smoothly while preserving chromaticity in mid-highs,
    // gracefully desaturating only at extreme plasma cores!
    vec3 ratio = x / peak;
    float mappedPeak = (peak * (2.45 * peak + 0.08)) / (peak * (2.40 * peak + 1.32) + 0.16);
    mappedPeak = clamp(mappedPeak, 0.0, 1.0);

    vec3 chroma = pow(ratio, vec3(0.88)) * mappedPeak;
    float whiteMix = smoothstep(1.35, 6.5, peak) * 0.72;
    return mix(chroma, vec3(mappedPeak), whiteMix);
  }

  void main() {
    vec3 scene = texture(u_sceneTex, v_uv).rgb;
    vec3 bloom = texture(u_bloomTex, v_uv).rgb;
    vec3 hdr = (scene + bloom * u_bloomStrength) * u_exposure;

    vec3 ldr = agxChromaTonemap(hdr);
    // Linear -> sRGB
    vec3 srgb = pow(clamp(ldr, 0.0, 1.0), vec3(1.0 / 2.2));
    fragColor = vec4(srgb, 1.0);
  }`;

  SF.Shaders = {
    SHADOW_VS,
    SHADOW_FS,
    FULLSCREEN_VS,
    SKY_FS,
    VOXEL_VS,
    VOXEL_FS,
    PLUME_VS,
    PLUME_FS,
    RIBBON_VS,
    RIBBON_FS,
    SHIELD_VS,
    SHIELD_FS,
    PARTICLE_VS,
    PARTICLE_FS,
    BLOOM_PREFILTER_FS,
    BLOOM_DOWN_FS,
    BLOOM_UP_FS,
    COMPOSITE_FS
  };
})(window);
