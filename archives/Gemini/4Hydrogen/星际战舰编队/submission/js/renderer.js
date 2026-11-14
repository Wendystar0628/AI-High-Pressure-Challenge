(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  // ---------------------------------------------------------
  // Shader 工具函数
  // ---------------------------------------------------------
  function compileShader(gl, type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      console.error('Shader compile error:', log, '\nSource:\n', source);
      gl.deleteShader(sh);
      throw new Error('Shader compile failed: ' + log);
    }
    return sh;
  }

  function createProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      console.error('Program link error:', log);
      throw new Error('Program link failed: ' + log);
    }
    const uniforms = {};
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (!info) continue;
      const baseName = info.name.replace(/\[0\]$/, '');
      uniforms[baseName] = gl.getUniformLocation(prog, baseName);
      if (info.size > 1) {
        for (let k = 0; k < info.size; k++) {
          const elemName = baseName + '[' + k + ']';
          uniforms[elemName] = gl.getUniformLocation(prog, elemName);
        }
      }
    }
    return { program: prog, u: uniforms };
  }

  // ---------------------------------------------------------
  // Shaders
  // ---------------------------------------------------------
  const FULLSCREEN_VS = `#version 300 es
  precision highp float;
  const vec2 POS[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2( 3.0, -1.0),
    vec2(-1.0,  3.0)
  );
  out vec2 vUv;
  void main() {
    vec2 p = POS[gl_VertexID];
    vUv = p * 0.5 + 0.5;
    gl_Position = vec4(p, 0.99999, 1.0);
  }`;

  const SKY_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform mat4 uInvViewProj;
  uniform vec3 uCamPos;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform float uInteriorMode; // 0 = 太空外景, 1 = 完全封闭舱内暗底
  out vec4 fragColor;

  float hash31(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.xxy + p.yxx) * p.zyx);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(i);
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise3(p);
      p = p * 2.05 + vec3(13.1, 7.7, 5.3);
      a *= 0.5;
    }
    return v;
  }

  vec3 starLayer(vec3 dir, float scale, float density, float brightness) {
    vec3 p = dir * scale;
    vec3 id = floor(p);
    vec3 f = fract(p) - 0.5;
    vec3 rnd = hash33(id);
    if (rnd.x < density) return vec3(0.0);
    vec3 offset = (rnd - 0.5) * 0.65;
    float d = length(f - offset);
    float size = mix(0.035, 0.095, rnd.y);
    float core = smoothstep(size, size * 0.15, d);
    float twinkle = 0.88 + 0.12 * sin(uTime * 1.5 + rnd.z * 62.8);
    // 色温变化：冰蓝 -> 纯白 -> 暖琥珀
    vec3 cCold = vec3(0.55, 0.80, 1.0);
    vec3 cWarm = vec3(1.0, 0.82, 0.60);
    vec3 tint = mix(cCold, cWarm, rnd.z);
    return tint * core * brightness * twinkle * (0.4 + 0.6 * rnd.y);
  }

  void main() {
    if (uInteriorMode > 0.99) {
      fragColor = vec4(0.008, 0.013, 0.022, 1.0);
      return;
    }

    vec4 clip = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec4 world = uInvViewProj * clip;
    vec3 worldPos = world.xyz / world.w;
    vec3 dir = normalize(worldPos - uCamPos);

    // 倾斜星云主带坐标
    vec3 nebDir = normalize(vec3(
      dir.x * 0.88 - dir.y * 0.35,
      dir.y * 0.85 + dir.x * 0.30 + dir.z * 0.20,
      dir.z * 0.90 - dir.y * 0.18
    ));

    float band = exp(-pow((nebDir.y + 0.18 * sin(nebDir.x * 2.6 + nebDir.z * 1.9)) * 3.1, 2.0));
    float f1 = fbm(nebDir * 2.6 + vec3(1.2, 3.4, 0.5));
    float f2 = fbm(nebDir * 5.8 + f1 * 1.8);
    float rift = smoothstep(0.42, 0.72, fbm(nebDir * 4.2 + vec3(5.0)));

    vec3 col = vec3(0.007, 0.011, 0.022); // 深空基色
    // 大尺度星云层次：靛紫与青碧交错，尘埃暗裂分隔开
    vec3 nebBlue = vec3(0.04, 0.14, 0.28);
    vec3 nebCyan = vec3(0.06, 0.26, 0.38);
    vec3 nebWarm = vec3(0.28, 0.14, 0.08);
    vec3 nebCol = mix(nebBlue, nebCyan, smoothstep(0.35, 0.78, f2));
    nebCol = mix(nebCol, nebWarm, smoothstep(0.58, 0.88, f1) * 0.55);

    float nebMask = band * smoothstep(0.25, 0.82, f1) * (1.0 - 0.65 * rift);
    col += nebCol * nebMask * 0.75;

    // 远景巨行星弧面（右下方暗处边缘接主太阳光）
    vec3 planetDir = normalize(vec3(0.62, -0.26, 0.74));
    float pCos = dot(dir, planetDir);
    float pRadius = 0.945; // 视角弧面很大且在极远处
    if (pCos > pRadius - 0.015) {
      float tPlanet = smoothstep(pRadius - 0.002, pRadius + 0.002, pCos);
      vec3 pNormal = normalize(dir - planetDir * pCos);
      // 从太阳照出的弯月亮弧边
      vec3 surfNormal = normalize(mix(pNormal, -planetDir, 0.55));
      float pNdotL = max(dot(surfNormal, uSunDir), 0.0);
      float rim = pow(clamp(1.0 - max(dot(dir, -surfNormal), 0.0), 0.0, 1.0), 3.0);
      float cloudBand = fbm(vec3(dir.x * 16.0, dir.y * 42.0, dir.z * 16.0));
      vec3 planetCol = mix(vec3(0.05, 0.08, 0.14), vec3(0.24, 0.34, 0.48), cloudBand);
      vec3 litPlanet = planetCol * (0.04 + 0.95 * pow(pNdotL, 1.3));
      // 大气层边缘青蓝亮弧
      vec3 atmo = vec3(0.28, 0.62, 0.95) * rim * (0.12 + 1.15 * pow(max(dot(pNormal, uSunDir) * 0.5 + 0.5, 0.0), 2.2));
      col = mix(col, litPlanet + atmo, tPlanet);
    }

    // 恒星点（多层疏密与亮度变化）
    col += starLayer(dir, 95.0, 0.82, 1.6);
    col += starLayer(dir, 185.0, 0.72, 0.85);
    col += starLayer(dir, 320.0, 0.68, 0.38);

    // 主光恒星天体与日冕
    float sunDot = max(dot(dir, uSunDir), 0.0);
    float sunCore = smoothstep(0.99945, 0.99985, sunDot);
    float sunHalo1 = pow(sunDot, 220.0) * 1.4;
    float sunHalo2 = pow(sunDot, 18.0) * 0.22;
    col += vec3(1.0, 0.92, 0.78) * sunCore * 8.0;
    col += vec3(1.0, 0.78, 0.52) * sunHalo1;
    col += vec3(0.45, 0.55, 0.75) * sunHalo2;

    col = mix(col, vec3(0.008, 0.013, 0.022), uInteriorMode);
    fragColor = vec4(col, 1.0);
  }`;

  const SHADOW_VS = `#version 300 es
  precision highp float;
  layout(location = 0) in vec3 aPos;
  uniform mat4 uLightViewProj;
  uniform mat4 uModel;
  void main() {
    gl_Position = uLightViewProj * uModel * vec4(aPos, 1.0);
  }`;

  const SHADOW_FS = `#version 300 es
  precision highp float;
  void main() {}`;

  const VOXEL_VS = `#version 300 es
  precision highp float;
  layout(location = 0) in vec3 aPos;
  layout(location = 1) in uvec4 aAttr;

  uniform mat4 uViewProj;
  uniform mat4 uModel;
  uniform mat4 uLightViewProj;

  out vec3 vWorldPos;
  out vec3 vLocalPos;
  out vec4 vShadowCoord;
  flat out uint vFaceDir;
  flat out uint vMatId;
  out float vAO;
  flat out uint vFlag;

  void main() {
    vec4 wp = uModel * vec4(aPos, 1.0);
    vWorldPos = wp.xyz;
    vLocalPos = aPos;
    vShadowCoord = uLightViewProj * wp;
    vFaceDir = aAttr.x;
    vMatId = aAttr.y;
    vAO = float(aAttr.z) / 3.0;
    vFlag = aAttr.w;
    gl_Position = uViewProj * wp;
  }`;

  const VOXEL_FS = `#version 300 es
  precision highp float;
  precision highp sampler2DShadow;

  in vec3 vWorldPos;
  in vec3 vLocalPos;
  in vec4 vShadowCoord;
  flat in uint vFaceDir;
  flat in uint vMatId;
  in float vAO;
  flat in uint vFlag;

  uniform mat4 uModel;
  uniform vec3 uCamPos;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform sampler2DShadow uShadowMap;
  uniform float uShadowEnable;
  uniform float uTime;
  uniform float uThrustBoost;
  uniform float uWeaponCharge;
  uniform float uCorePulse;
  uniform float uHeatLevel;
  uniform float uShieldRim;
  uniform vec3 uBeamStart;
  uniform vec3 uBeamEnd;
  uniform vec3 uBeamColor;
  uniform float uBeamIntensity;
  uniform float uInteriorMix;

  uniform int uNumLights;
  uniform vec4 uLightPosRad[16]; // xyz = pos, w = radius
  uniform vec4 uLightColInt[16]; // rgb = color, w = intensity

  out vec4 fragColor;

  const vec3 LOCAL_NORMALS[6] = vec3[6](
    vec3( 1.0,  0.0,  0.0),
    vec3(-1.0,  0.0,  0.0),
    vec3( 0.0,  1.0,  0.0),
    vec3( 0.0, -1.0,  0.0),
    vec3( 0.0,  0.0,  1.0),
    vec3( 0.0,  0.0, -1.0)
  );

  const float PI = 3.14159265;

  float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    return a2 / (PI * denom * denom + 1e-5);
  }

  float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k + 1e-5);
  }

  float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    return GeometrySchlickGGX(max(dot(N, V), 0.0), roughness) *
           GeometrySchlickGGX(max(dot(N, L), 0.0), roughness);
  }

  vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }

  float sampleShadow(vec4 sc, float NdotL) {
    if (uShadowEnable < 0.5) return 1.0;
    vec3 proj = sc.xyz / sc.w;
    proj = proj * 0.5 + 0.5;
    if (proj.x < 0.01 || proj.x > 0.99 || proj.y < 0.01 || proj.y > 0.99 || proj.z > 0.999) {
      return 1.0;
    }
    float bias = max(0.0018 * (1.0 - NdotL), 0.0006);
    float texel = 1.0 / 2048.0;
    float sum = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        sum += texture(uShadowMap, vec3(proj.xy + vec2(x, y) * texel * 1.35, proj.z - bias));
      }
    }
    return sum / 9.0;
  }

  void getMaterial(
    uint matId, vec3 lpos,
    out vec3 albedo, out float metallic, out float roughness, out vec3 emissive, out float alpha
  ) {
    albedo = vec3(0.65);
    metallic = 0.4;
    roughness = 0.45;
    emissive = vec3(0.0);
    alpha = 1.0;

    if (matId == 1u) { // HULL_PRIMARY 主装甲苍穹银灰
      albedo = vec3(0.53, 0.59, 0.68);
      metallic = 0.40;
      roughness = 0.48;
    } else if (matId == 2u) { // HULL_SECONDARY 次级钢蓝灰
      albedo = vec3(0.30, 0.36, 0.44);
      metallic = 0.48;
      roughness = 0.46;
    } else if (matId == 3u) { // HULL_LIGHT 高亮钛白边
      albedo = vec3(0.72, 0.77, 0.84);
      metallic = 0.36;
      roughness = 0.40;
    } else if (matId == 4u) { // FRAME_DARK 深层玄铁构架
      albedo = vec3(0.085, 0.105, 0.138);
      metallic = 0.25;
      roughness = 0.74;
    } else if (matId == 5u) { // FRAME_DEEP 极深暗槽底
      albedo = vec3(0.035, 0.045, 0.065);
      metallic = 0.15;
      roughness = 0.86;
    } else if (matId == 6u) { // TRIM_BRONZE 铜金转折棱边
      albedo = vec3(0.76, 0.53, 0.27);
      metallic = 0.88;
      roughness = 0.22;
    } else if (matId == 7u) { // ENGINE_INTERIOR 喷口耐热黑钛
      albedo = vec3(0.06, 0.075, 0.10);
      metallic = 0.78;
      roughness = 0.28;
    } else if (matId == 8u) { // GLOW_CYAN 青碧导能发光槽
      albedo = vec3(0.15, 0.85, 1.0);
      metallic = 0.1;
      roughness = 0.3;
      emissive = vec3(0.16, 1.25, 1.75);
    } else if (matId == 9u) { // GLOW_CYAN_HOT 高亮白青核
      albedo = vec3(0.7, 0.98, 1.0);
      emissive = vec3(1.1, 2.8, 3.5);
    } else if (matId == 10u) { // GLOW_AMBER 炽金琥珀灯/弹道引导
      albedo = vec3(1.0, 0.65, 0.22);
      emissive = vec3(1.9, 0.95, 0.20);
    } else if (matId == 11u) { // GLOW_AMBER_HOT 白金高温亮块
      albedo = vec3(1.0, 0.90, 0.65);
      emissive = vec3(3.2, 2.2, 0.85);
    } else if (matId == 12u) { // GLASS_TRANS 透明青蓝晶体体素
      albedo = vec3(0.28, 0.75, 0.96);
      metallic = 0.12;
      roughness = 0.14;
      emissive = vec3(0.08, 0.32, 0.52);
      alpha = 0.32;
    } else if (matId == 13u) { // GLASS_AMBER 透明琥珀全息体素
      albedo = vec3(0.95, 0.62, 0.22);
      metallic = 0.12;
      roughness = 0.16;
      emissive = vec3(0.45, 0.24, 0.06);
      alpha = 0.40;
    } else if (matId == 14u) { // ROCK_DARK 陨石暗玄武岩
      albedo = vec3(0.13, 0.14, 0.165);
      metallic = 0.04;
      roughness = 0.92;
    } else if (matId == 15u) { // ROCK_MID 陨石灰褐断面
      albedo = vec3(0.25, 0.24, 0.23);
      metallic = 0.05;
      roughness = 0.85;
    } else if (matId == 16u) { // ROCK_MINERAL 陨石冷矿脉
      albedo = vec3(0.26, 0.34, 0.42);
      metallic = 0.35;
      roughness = 0.50;
    } else if (matId == 17u) { // ROCK_GLOW_SEAM 陨石热熔裂隙（按个体素抖动色阶保留破碎体素颗粒）
      float seamCell = fract(sin(dot(floor(lpos + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      albedo = mix(vec3(0.18, 0.19, 0.21), vec3(1.0, 0.44, 0.10), uHeatLevel);
      metallic = 0.08;
      roughness = mix(0.85, 0.38, uHeatLevel);
      emissive = vec3(3.0, 0.88, 0.14) * uHeatLevel * (0.68 + 0.55 * seamCell);
    } else if (matId == 18u) { // GLOW_CORE 动力核心呼吸脉冲体素（兼支持堆芯上升波与导能走廊 +Z 流光）
      float wave = 0.5 + 0.5 * sin(uTime * 3.0 - lpos.y * 0.11 - lpos.z * 0.085);
      float pulse = mix(0.62, 1.38, uCorePulse) * (0.76 + 0.38 * wave);
      albedo = vec3(0.45, 0.95, 1.0);
      emissive = mix(vec3(0.24, 1.40, 2.00), vec3(0.95, 2.65, 3.25), wave * uCorePulse) * pulse;
    } else if (matId == 19u) { // GLOW_BRIDGE_HOLO 舰桥立体投影体素（克制自发光保留 1x1 体素颗粒轮廓）
      float scan = 0.80 + 0.20 * sin(lpos.y * 2.1 - uTime * 4.5);
      albedo = vec3(0.18, 0.78, 0.98);
      emissive = vec3(0.14, 0.66, 0.98) * scan;
      alpha = 0.44;
    } else if (matId == 20u) { // GLOW_WEAPON_CHARGE 主炮逐段蓄能槽
      // 沿旗舰局部 Z 从 +180 到 +530 方向逐段冲激点亮
      float zNorm = clamp((lpos.z - 180.0) / 345.0, 0.0, 1.0);
      float waveFront = smoothstep(zNorm - 0.07, zNorm, uWeaponCharge * 1.08);
      float baseGlow = 0.14 + 0.86 * waveFront;
      albedo = vec3(0.25, 0.84, 1.0);
      emissive = mix(vec3(0.08, 0.55, 0.85), vec3(1.5, 4.6, 5.8), waveFront) * baseGlow;
    } else if (matId == 21u) { // GLOW_THRUSTER_CORE 喷口内腔推进增强
      float boost = 1.0 + uThrustBoost * 2.8;
      albedo = vec3(0.45, 0.92, 1.0);
      emissive = mix(vec3(0.25, 1.8, 2.8), vec3(1.6, 4.2, 5.2), clamp(uThrustBoost, 0.0, 1.0)) * boost;
    }
  }

  void main() {
    uint fDir = min(vFaceDir, 5u);
    vec3 localN = LOCAL_NORMALS[fDir];

    // 算出表面2D局部坐标，用于体素统一格距微倒角与接缝
    vec2 cellUV;
    vec3 tangentU, tangentV;
    if (fDir == 0u || fDir == 1u) {
      cellUV = vLocalPos.yz;
      tangentU = vec3(0.0, 1.0, 0.0);
      tangentV = vec3(0.0, 0.0, 1.0);
    } else if (fDir == 2u || fDir == 3u) {
      cellUV = vLocalPos.xz;
      tangentU = vec3(1.0, 0.0, 0.0);
      tangentV = vec3(0.0, 0.0, 1.0);
    } else {
      cellUV = vLocalPos.xy;
      tangentU = vec3(1.0, 0.0, 0.0);
      tangentV = vec3(0.0, 1.0, 0.0);
    }

    vec2 f = fract(cellUV);
    vec2 fw = max(fwidth(cellUV), vec2(1e-4));
    float maxFw = max(fw.x, fw.y);
    // 随屏幕像素尺度平滑收敛微倒角与格缝宽度，杜绝中景斜壁莫尔波纹
    float detailFade = 1.0 - smoothstep(0.08, 0.26, maxFw);
    float toneFade = 1.0 - smoothstep(0.12, 0.36, maxFw);

    // 体素微倒角法线扰动（在每格边缘 0.085 范围内偏转法线）
    float bevel = 0.085;
    float bx = smoothstep(bevel, 0.0, f.x) - smoothstep(1.0 - bevel, 1.0, f.x);
    float by = smoothstep(bevel, 0.0, f.y) - smoothstep(1.0 - bevel, 1.0, f.y);
    vec3 perturbedLocalN = normalize(localN - (tangentU * bx + tangentV * by) * 0.24 * detailFade);

    // 把局部法线转到世界空间（Model矩阵只包含均匀缩放和正交旋转平移，取左上3x3即可）
    mat3 normalMat = mat3(uModel);
    vec3 N = normalize(normalMat * perturbedLocalN);
    vec3 flatN = normalize(normalMat * localN);

    vec3 albedo;
    float metallic, roughness, alpha;
    vec3 emissive;
    getMaterial(vMatId, vLocalPos, albedo, metallic, roughness, emissive, alpha);

    // 抗锯齿格缝微暗槽（过滤核随 fwidth 自适应放大）与体素轻微色调微变
    float edgeAA = max(0.075, maxFw * 1.15);
    float distEdge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float seam = mix(1.0, smoothstep(0.0, edgeAA, distEdge) * 0.20 + 0.80, detailFade);
    vec3 cellId = floor(vLocalPos - localN * 0.1);
    float cellTone = fract(sin(dot(cellId, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    albedo *= mix(1.0, 0.96 + 0.08 * cellTone, toneFade * (vMatId >= 14u && vMatId <= 16u ? 1.5 : 0.65));
    albedo *= seam;

    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 F0 = mix(vec3(0.04), albedo, metallic);

    // 1. 主恒星方向光 + 2048 PCF 实时阴影
    vec3 L = normalize(uSunDir);
    vec3 H = normalize(V + L);
    float NdotL = max(dot(N, L), 0.0);
    float flatNdotL = max(dot(flatN, L), 0.0);
    float shadow = sampleShadow(vShadowCoord, flatNdotL);
    // 室内场景降低太阳主直射权重（由局部光源主导），室外兼顾装甲明暗台阶层次
    float sunScale = mix(2.45, 0.95, uInteriorMix);

    float D = DistributionGGX(N, H, roughness);
    float G = GeometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    vec3 spec = (D * G * F) / (4.0 * max(dot(N, V), 0.0) * NdotL + 0.001);
    vec3 kD = (1.0 - F) * (1.0 - metallic);
    vec3 directSun = (kD * albedo / PI + spec) * uSunColor * sunScale * NdotL * shadow;

    // 2. 太空冷青背光/侧边缘环境光（塑形暗面轮廓）
    vec3 rimDir = normalize(-uSunDir + vec3(0.15, 0.45, -0.3));
    float rimNdotL = max(dot(N, rimDir), 0.0);
    vec3 H2 = normalize(V + rimDir);
    float spec2 = DistributionGGX(N, H2, roughness) * 0.25;
    vec3 rimLight = (albedo * 0.42 + F0 * spec2) * vec3(0.16, 0.34, 0.58) * rimNdotL * mix(1.0, 0.35, uInteriorMix);

    // 3. 动态事件点光源累加（最多16盏：火光、推进、沙盘、核心、能量块）
    vec3 pointAccum = vec3(0.0);
    for (int i = 0; i < 16; i++) {
      if (i >= uNumLights) break;
      vec3 lPos = uLightPosRad[i].xyz;
      float lRad = uLightPosRad[i].w;
      vec3 toL = lPos - vWorldPos;
      float distSq = dot(toL, toL);
      if (distSq < lRad * lRad) {
        float dist = sqrt(distSq) + 1e-4;
        vec3 pL = toL / dist;
        float pNdotL = max(dot(N, pL), 0.0);
        if (pNdotL > 0.0) {
          float falloff = clamp(1.0 - dist / lRad, 0.0, 1.0);
          falloff = falloff * falloff / (1.0 + 0.0008 * distSq);
          vec3 pH = normalize(V + pL);
          float pD = DistributionGGX(N, pH, max(roughness, 0.18));
          vec3 pF = fresnelSchlick(max(dot(pH, V), 0.0), F0);
          vec3 pSpec = pD * pF * 0.4;
          vec3 pKd = (1.0 - pF) * (1.0 - metallic);
          pointAccum += (pKd * albedo / PI + pSpec) * uLightColInt[i].rgb * uLightColInt[i].w * pNdotL * falloff;
        }
      }
    }

    // 4. 光束主炮连续线段光源（照亮炮身周围壳层和受击陨石截面）
    if (uBeamIntensity > 0.01) {
      vec3 ab = uBeamEnd - uBeamStart;
      float abLen2 = dot(ab, ab) + 1e-4;
      float tProj = clamp(dot(vWorldPos - uBeamStart, ab) / abLen2, 0.0, 1.0);
      vec3 closest = uBeamStart + ab * tProj;
      vec3 toB = closest - vWorldPos;
      float distB = length(toB) + 1e-4;
      if (distB < 520.0) {
        vec3 bL = toB / distB;
        float bNdotL = max(dot(N, bL), 0.0);
        float att = pow(clamp(1.0 - distB / 520.0, 0.0, 1.0), 2.0);
        pointAccum += albedo * uBeamColor * uBeamIntensity * bNdotL * att * 0.9;
      }
    }

    // 5. 半球环境光 + 精确体素顶点 AO
    float ao = mix(0.24, 1.0, vAO);
    // 如果是内部槽，再略强化对比度
    float hemi = 0.5 + 0.5 * N.y;
    vec3 skyEnv = mix(vec3(0.032, 0.045, 0.072), vec3(0.068, 0.095, 0.145), hemi);
    vec3 ambient = albedo * skyEnv * ao * (1.0 - 0.5 * metallic);
    // 金属边缘环境 Fresnel 高光轮廓
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    ambient += F0 * fres * vec3(0.18, 0.28, 0.42) * ao * 0.65;

    // 6. 护盾开启时对下方壳面的柔和反光
    vec3 shieldBounce = vec3(0.0);
    if (uShieldRim > 0.005) {
      float upWrap = 0.35 + 0.65 * max(dot(N, V), 0.0);
      shieldBounce = albedo * vec3(0.18, 0.68, 0.95) * uShieldRim * upWrap * 0.45;
    }

    vec3 color = directSun + rimLight * ao + pointAccum + ambient + shieldBounce + emissive;

    // 7. 极远距离星尘雾（仅用于远景陨石极远处融入深空，不遮挡战舰）
    float camDist = length(uCamPos - vWorldPos);
    float farFade = smoothstep(3200.0, 7400.0, camDist) * (1.0 - uInteriorMix);
    color = mix(color, vec3(0.009, 0.014, 0.026), farFade * 0.96);

    // 透明体素在玻璃边框稍增不透明度以保留体素格边界
    if (alpha < 0.99) {
      float edgeGlass = mix(0.0, (1.0 - smoothstep(0.0, 0.09, distEdge)) * 0.35, detailFade);
      alpha = clamp(alpha + edgeGlass + fres * 0.28, 0.0, 0.92);
    }

    fragColor = vec4(color, alpha);
  }`;

  // Bloom & Tonemap Shaders
  const BLOOM_PREFILTER_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uTex;
  uniform float uThreshold;
  out vec4 fragColor;
  void main() {
    vec3 c = texture(uTex, vUv).rgb;
    float br = max(c.r, max(c.g, c.b));
    float knee = 0.5;
    float soft = br - uThreshold + knee;
    soft = clamp(soft, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-5);
    float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
    fragColor = vec4(c * max(contrib, 0.0), 1.0);
  }`;

  const BLUR_DOWNSAMPLE_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2 uTexelSize;
  out vec4 fragColor;
  void main() {
    vec2 d = uTexelSize;
    vec3 c = texture(uTex, vUv).rgb * 4.0;
    c += texture(uTex, vUv - d).rgb;
    c += texture(uTex, vUv + d).rgb;
    c += texture(uTex, vUv + vec2(d.x, -d.y)).rgb;
    c += texture(uTex, vUv + vec2(-d.x, d.y)).rgb;
    fragColor = vec4(c / 8.0, 1.0);
  }`;

  const BLUR_UPSAMPLE_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2 uTexelSize;
  out vec4 fragColor;
  void main() {
    vec2 d = uTexelSize * 1.35;
    vec3 c = texture(uTex, vUv).rgb * 4.0;
    c += texture(uTex, vUv + vec2( d.x,  0.0)).rgb * 2.0;
    c += texture(uTex, vUv + vec2(-d.x,  0.0)).rgb * 2.0;
    c += texture(uTex, vUv + vec2( 0.0,  d.y)).rgb * 2.0;
    c += texture(uTex, vUv + vec2( 0.0, -d.y)).rgb * 2.0;
    c += texture(uTex, vUv + vec2( d.x,  d.y)).rgb;
    c += texture(uTex, vUv + vec2(-d.x,  d.y)).rgb;
    c += texture(uTex, vUv + vec2( d.x, -d.y)).rgb;
    c += texture(uTex, vUv + vec2(-d.x, -d.y)).rgb;
    fragColor = vec4(c / 16.0, 1.0);
  }`;

  const COMPOSITE_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  uniform sampler2D uSceneTex;
  uniform sampler2D uBloomTex;
  uniform float uBloomStrength;
  uniform float uExposure;
  out vec4 fragColor;

  vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec3 hdr = texture(uSceneTex, vUv).rgb;
    vec3 bloom = texture(uBloomTex, vUv).rgb;
    vec3 col = hdr + bloom * uBloomStrength;
    col *= uExposure;
    col = ACESFilm(col);

    // 极轻度电影感暗角
    vec2 q = vUv - 0.5;
    float vig = 1.0 - dot(q, q) * 0.22;
    col *= vig;

    col = pow(col, vec3(1.0 / 2.2));
    fragColor = vec4(col, 1.0);
  }`;

  // ---------------------------------------------------------
  // Renderer Class
  // ---------------------------------------------------------
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: true,
        stencil: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
      if (!gl) throw new Error('WebGL 2 is not supported.');
      this.gl = gl;

      this.extColorFloat = gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');
      this.maxSamples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 1);
      this.hdrInternalFormat = this.extColorFloat ? gl.RGBA16F : gl.RGBA8;
      this.hdrType = this.extColorFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

      this.width = 0;
      this.height = 0;

      // Programs
      this.skyProg = createProgram(gl, FULLSCREEN_VS, SKY_FS);
      this.shadowProg = createProgram(gl, SHADOW_VS, SHADOW_FS);
      this.voxelProg = createProgram(gl, VOXEL_VS, VOXEL_FS);
      this.prefilterProg = createProgram(gl, FULLSCREEN_VS, BLOOM_PREFILTER_FS);
      this.downProg = createProgram(gl, FULLSCREEN_VS, BLUR_DOWNSAMPLE_FS);
      this.upProg = createProgram(gl, FULLSCREEN_VS, BLUR_UPSAMPLE_FS);
      this.compProg = createProgram(gl, FULLSCREEN_VS, COMPOSITE_FS);

      this.emptyVao = gl.createVertexArray();

      this._initShadowMap();
      this.msaaFbo = null;
      this.hdrFbo = null;
      this.bloomLevels = [];

      // Uniform temp matrices
      this.viewMat = SF.Math.Mat4.create();
      this.projMat = SF.Math.Mat4.create();
      this.viewProjMat = SF.Math.Mat4.create();
      this.invViewProjMat = SF.Math.Mat4.create();
      this.lightViewMat = SF.Math.Mat4.create();
      this.lightProjMat = SF.Math.Mat4.create();
      this.lightViewProjMat = SF.Math.Mat4.create();

      // 主光太阳方向
      this.sunDir = SF.Math.Vec3.normalize([], [-0.62, 0.44, 0.65]);
      this.sunColor = [1.0, 0.93, 0.84];
    }

    _initShadowMap() {
      const gl = this.gl;
      this.shadowSize = 2048;
      this.shadowTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24,
        this.shadowSize, this.shadowSize, 0,
        gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

      this.shadowFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _destroyTargets() {
      const gl = this.gl;
      if (this.msaaFbo) {
        gl.deleteFramebuffer(this.msaaFbo.fbo);
        gl.deleteRenderbuffer(this.msaaFbo.colorRb);
        gl.deleteRenderbuffer(this.msaaFbo.depthRb);
        this.msaaFbo = null;
      }
      if (this.hdrFbo) {
        gl.deleteFramebuffer(this.hdrFbo.fbo);
        gl.deleteTexture(this.hdrFbo.tex);
        this.hdrFbo = null;
      }
      for (const lvl of this.bloomLevels) {
        gl.deleteFramebuffer(lvl.fbo);
        gl.deleteTexture(lvl.tex);
      }
      this.bloomLevels.length = 0;
    }

    resize(w, h) {
      w = Math.max(1, Math.min(3840, w | 0));
      h = Math.max(1, Math.min(2160, h | 0));
      if (this.width === w && this.height === h && this.msaaFbo) return;

      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;

      const gl = this.gl;
      this._destroyTargets();

      // 1. MSAA Renderbuffer FBO
      const msFbo = gl.createFramebuffer();
      const colorRb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, colorRb);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.maxSamples, this.hdrInternalFormat, w, h);

      const depthRb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.maxSamples, gl.DEPTH24_STENCIL8, w, h);

      gl.bindFramebuffer(gl.FRAMEBUFFER, msFbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorRb);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, depthRb);
      this.msaaFbo = { fbo: msFbo, colorRb, depthRb };

      // 2. Single-sample HDR Resolve Texture FBO
      const hdrTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, hdrTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, this.hdrInternalFormat, w, h, 0, gl.RGBA, this.hdrType, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const hFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, hFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hdrTex, 0);
      this.hdrFbo = { fbo: hFbo, tex: hdrTex };

      // 3. 5-Level Bloom Pyramid
      let bw = Math.max(2, w >> 1);
      let bh = Math.max(2, h >> 1);
      for (let i = 0; i < 5; i++) {
        const bTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, bTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.hdrInternalFormat, bw, bh, 0, gl.RGBA, this.hdrType, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const bFbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, bFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bTex, 0);
        this.bloomLevels.push({ fbo: bFbo, tex: bTex, w: bw, h: bh });
        bw = Math.max(2, bw >> 1);
        bh = Math.max(2, bh >> 1);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    setupCamera(cam) {
      const aspect = this.width / Math.max(1, this.height);
      const fovRad = (cam.fovDeg || 48) * Math.PI / 180;
      const near = cam.near || 1.5;
      const far = cam.far || 12000;
      SF.Math.Mat4.perspective(this.projMat, fovRad, aspect, near, far);
      SF.Math.Mat4.lookAt(this.viewMat, cam.pos, cam.target, cam.up || [0, 1, 0]);
      SF.Math.Mat4.multiply(this.viewProjMat, this.projMat, this.viewMat);
      SF.Math.Mat4.invert(this.invViewProjMat, this.viewProjMat);
    }

    setupShadowBounds(center, halfExtent) {
      const eye = [
        center[0] + this.sunDir[0] * halfExtent * 2.2,
        center[1] + this.sunDir[1] * halfExtent * 2.2,
        center[2] + this.sunDir[2] * halfExtent * 2.2
      ];
      SF.Math.Mat4.lookAt(this.lightViewMat, eye, center, [0, 1, 0]);
      SF.Math.Mat4.ortho(
        this.lightProjMat,
        -halfExtent, halfExtent,
        -halfExtent, halfExtent,
        10, halfExtent * 4.5
      );
      SF.Math.Mat4.multiply(this.lightViewProjMat, this.lightProjMat, this.lightViewMat);
    }

    // 执行完整多 Pass 渲染
    renderFrame(sceneState) {
      const gl = this.gl;
      if (!this.msaaFbo) return;

      const cam = sceneState.camera;
      this.setupCamera(cam);
      const shadowCenter = sceneState.shadowCenter || [0, 0, 0];
      const shadowExtent = sceneState.shadowExtent || 880;
      this.setupShadowBounds(shadowCenter, shadowExtent);

      // -----------------------------------
      // Pass 1: Shadow Map
      // -----------------------------------
      const shadowEnable = sceneState.enableShadow !== false;
      if (shadowEnable) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
        gl.viewport(0, 0, this.shadowSize, this.shadowSize);
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1.8, 2.5);

        gl.useProgram(this.shadowProg.program);
        gl.uniformMatrix4fv(this.shadowProg.u.uLightViewProj, false, this.lightViewProjMat);

        for (let i = 0; i < sceneState.drawItems.length; i++) {
          const item = sceneState.drawItems[i];
          if (!item.mesh || !item.mesh.opaque || item.castShadow === false) continue;
          gl.uniformMatrix4fv(this.shadowProg.u.uModel, false, item.model);
          gl.bindVertexArray(item.mesh.opaque.vao);
          gl.drawElements(gl.TRIANGLES, item.mesh.opaque.indexCount, gl.UNSIGNED_INT, 0);
        }
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }

      // -----------------------------------
      // Pass 2: Main MSAA HDR Scene
      // -----------------------------------
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFbo.fbo);
      gl.viewport(0, 0, this.width, this.height);
      gl.clearColor(0.007, 0.011, 0.022, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // 2a. Space Sky Dome
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.useProgram(this.skyProg.program);
      gl.uniformMatrix4fv(this.skyProg.u.uInvViewProj, false, this.invViewProjMat);
      gl.uniform3fv(this.skyProg.u.uCamPos, cam.pos);
      gl.uniform3fv(this.skyProg.u.uSunDir, this.sunDir);
      gl.uniform1f(this.skyProg.u.uTime, sceneState.time);
      gl.uniform1f(this.skyProg.u.uInteriorMode, sceneState.interiorSkyMix || 0.0);
      gl.bindVertexArray(this.emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 2b. Opaque Voxel Geometry
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      const vp = this.voxelProg;
      gl.useProgram(vp.program);
      gl.uniformMatrix4fv(vp.u.uViewProj, false, this.viewProjMat);
      gl.uniformMatrix4fv(vp.u.uLightViewProj, false, this.lightViewProjMat);
      gl.uniform3fv(vp.u.uCamPos, cam.pos);
      gl.uniform3fv(vp.u.uSunDir, this.sunDir);
      gl.uniform3fv(vp.u.uSunColor, this.sunColor);
      gl.uniform1f(vp.u.uShadowEnable, shadowEnable ? 1.0 : 0.0);
      gl.uniform1f(vp.u.uTime, sceneState.time);
      gl.uniform1f(vp.u.uThrustBoost, sceneState.thrustBoost || 0.0);
      gl.uniform1f(vp.u.uWeaponCharge, sceneState.weaponCharge || 0.0);
      gl.uniform1f(vp.u.uCorePulse, sceneState.corePulse || 1.0);
      gl.uniform1f(vp.u.uInteriorMix, sceneState.interiorMix || 0.0);

      const beam = sceneState.beamLight || { start: [0, 0, 0], end: [0, 0, 1], color: [0.3, 0.9, 1], intensity: 0 };
      gl.uniform3fv(vp.u.uBeamStart, beam.start);
      gl.uniform3fv(vp.u.uBeamEnd, beam.end);
      gl.uniform3fv(vp.u.uBeamColor, beam.color);
      gl.uniform1f(vp.u.uBeamIntensity, beam.intensity);

      const lights = sceneState.lights || [];
      const nLights = Math.min(16, lights.length);
      gl.uniform1i(vp.u.uNumLights, nLights);
      for (let i = 0; i < nLights; i++) {
        const l = lights[i];
        gl.uniform4f(vp.u['uLightPosRad[' + i + ']'], l.pos[0], l.pos[1], l.pos[2], l.radius);
        gl.uniform4f(vp.u['uLightColInt[' + i + ']'], l.color[0], l.color[1], l.color[2], l.intensity);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.uniform1i(vp.u.uShadowMap, 0);

      for (let i = 0; i < sceneState.drawItems.length; i++) {
        const item = sceneState.drawItems[i];
        if (!item.mesh || !item.mesh.opaque) continue;
        gl.uniformMatrix4fv(vp.u.uModel, false, item.model);
        gl.uniform1f(vp.u.uHeatLevel, item.heatLevel || 0.0);
        gl.uniform1f(vp.u.uShieldRim, item.shieldRim || 0.0);
        gl.bindVertexArray(item.mesh.opaque.vao);
        gl.drawElements(gl.TRIANGLES, item.mesh.opaque.indexCount, gl.UNSIGNED_INT, 0);
      }

      // 2c. Transparent Voxel Geometry (玻璃、透明能量体、全息沙盘)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);

      for (let i = 0; i < sceneState.drawItems.length; i++) {
        const item = sceneState.drawItems[i];
        if (!item.mesh || !item.mesh.transparent) continue;
        gl.uniformMatrix4fv(vp.u.uModel, false, item.model);
        gl.uniform1f(vp.u.uHeatLevel, item.heatLevel || 0.0);
        gl.uniform1f(vp.u.uShieldRim, item.shieldRim || 0.0);
        gl.bindVertexArray(item.mesh.transparent.vao);
        gl.drawElements(gl.TRIANGLES, item.mesh.transparent.indexCount, gl.UNSIGNED_INT, 0);
      }

      // 2d. Volumetric VFX (光束、脉冲弹、近防弹迹、导弹尾迹、推进尾焰、全队护盾、爆闪尘屑、漂浮光屑)
      if (sceneState.renderVFX) {
        sceneState.renderVFX(this);
      }

      // -----------------------------------
      // Pass 3: Resolve MSAA -> HDR Texture
      // -----------------------------------
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaaFbo.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.hdrFbo.fbo);
      gl.blitFramebuffer(
        0, 0, this.width, this.height,
        0, 0, this.width, this.height,
        gl.COLOR_BUFFER_BIT, gl.NEAREST
      );

      // -----------------------------------
      // Pass 4: 5-Level Bloom Pyramid
      // -----------------------------------
      gl.bindVertexArray(this.emptyVao);

      // 4a. Prefilter -> level 0
      const lvl0 = this.bloomLevels[0];
      gl.bindFramebuffer(gl.FRAMEBUFFER, lvl0.fbo);
      gl.viewport(0, 0, lvl0.w, lvl0.h);
      gl.useProgram(this.prefilterProg.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.hdrFbo.tex);
      gl.uniform1i(this.prefilterProg.u.uTex, 0);
      gl.uniform1f(this.prefilterProg.u.uThreshold, 1.38);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 4b. Downsample chain
      gl.useProgram(this.downProg.program);
      for (let i = 1; i < this.bloomLevels.length; i++) {
        const src = this.bloomLevels[i - 1];
        const dst = this.bloomLevels[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
        gl.viewport(0, 0, dst.w, dst.h);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(this.downProg.u.uTex, 0);
        gl.uniform2f(this.downProg.u.uTexelSize, 1.0 / src.w, 1.0 / src.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      // 4c. Upsample additive tent filter
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.upProg.program);
      for (let i = this.bloomLevels.length - 1; i >= 1; i--) {
        const src = this.bloomLevels[i];
        const dst = this.bloomLevels[i - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
        gl.viewport(0, 0, dst.w, dst.h);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(this.upProg.u.uTex, 0);
        gl.uniform2f(this.upProg.u.uTexelSize, 1.0 / src.w, 1.0 / src.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.disable(gl.BLEND);

      // -----------------------------------
      // Pass 5: Composite + ACES Tone Mapping -> Default Framebuffer
      // -----------------------------------
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      gl.useProgram(this.compProg.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.hdrFbo.tex);
      gl.uniform1i(this.compProg.u.uSceneTex, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, lvl0.tex);
      gl.uniform1i(this.compProg.u.uBloomTex, 1);
      gl.uniform1f(this.compProg.u.uBloomStrength, sceneState.bloomStrength !== undefined ? sceneState.bloomStrength : 0.34);
      gl.uniform1f(this.compProg.u.uExposure, sceneState.exposure !== undefined ? sceneState.exposure : 1.05);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindVertexArray(null);
    }
  }

  SF.Renderer = Renderer;
  SF.createProgram = createProgram;
})(window);
