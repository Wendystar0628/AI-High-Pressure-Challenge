(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  // ---------------------------------------------------------
  // 1. 通用粒子/光条/光环 Billboard & Ribbon 着色器
  // ---------------------------------------------------------
  const SPRITE_VS = `#version 300 es
  precision highp float;
  layout(location = 0) in vec2 aQuad;     // [-1..1] quad corners
  layout(location = 1) in vec4 aPosSize;  // xyz = world center, w = size
  layout(location = 2) in vec4 aVelStretch; // xyz = axis/dir, w = lengthStretch
  layout(location = 3) in vec4 aColor;    // rgba HDR color

  uniform mat4 uViewProj;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
  uniform vec3 uCamPos;

  out vec2 vUv;
  out vec4 vColor;

  void main() {
    vUv = aQuad * 0.5 + 0.5;
    vColor = aColor;

    vec3 center = aPosSize.xyz;
    float radius = aPosSize.w;
    float stretch = aVelStretch.w;

    vec3 worldPos;
    if (stretch > 0.001) {
      // 定向光束段 / 弹迹 / 速度丝线（沿 axis 拉伸，垂直方向朝向相机）
      vec3 axis = normalize(aVelStretch.xyz);
      vec3 toCam = normalize(uCamPos - center);
      vec3 side = normalize(cross(axis, toCam));
      if (length(cross(axis, toCam)) < 0.01) side = uCamRight;
      worldPos = center + axis * (aQuad.y * stretch * 0.5) + side * (aQuad.x * radius);
    } else if (stretch < -0.5) {
      // 定向 3D 冲击波光环（法线沿 axis，例如套在光束柱外面的起射光环）
      vec3 axis = normalize(aVelStretch.xyz);
      vec3 refUp = abs(axis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 r1 = normalize(cross(refUp, axis));
      vec3 r2 = cross(axis, r1);
      worldPos = center + (r1 * aQuad.x + r2 * aQuad.y) * radius;
    } else {
      // 面向相机的球形光晕 / 闪光 / 尘屑粒子
      worldPos = center + (uCamRight * aQuad.x + uCamUp * aQuad.y) * radius;
    }
    gl_Position = uViewProj * vec4(worldPos, 1.0);
  }`;

  const SPRITE_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  in vec4 vColor;
  uniform int uMode; // 0 = soft radial glow, 1 = streak/bolt, 2 = shock ring
  out vec4 fragColor;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float intensity = 0.0;

    if (uMode == 0) {
      float r = length(p);
      if (r > 1.0) discard;
      float core = exp(-r * r * 7.5);
      float halo = pow(max(1.0 - r, 0.0), 2.5) * 0.55;
      intensity = core + halo;
    } else if (uMode == 1) {
      // 沿 y 方向细长光弹/轨迹，中间亮两端渐变柔收
      float rx = abs(p.x);
      float ry = abs(p.y);
      if (rx > 1.0 || ry > 1.0) discard;
      float xFade = pow(max(1.0 - rx, 0.0), 1.8);
      float yFade = smoothstep(1.0, 0.25, ry);
      float hot = exp(-rx * rx * 10.0) * smoothstep(1.0, 0.1, ry);
      intensity = xFade * yFade * 0.65 + hot * 0.85;
    } else {
      // 2 = 扩张冲击波光环
      float r = length(p);
      if (r > 1.0) discard;
      float ring = exp(-pow((r - 0.72) * 7.5, 2.0));
      float inner = pow(max(1.0 - r, 0.0), 3.0) * 0.18;
      intensity = ring + inner;
    }

    vec3 col = vColor.rgb * intensity;
    float a = clamp(vColor.a * intensity, 0.0, 1.0);
    fragColor = vec4(col, a);
  }`;

  // ---------------------------------------------------------
  // 2. 体积推进尾焰 & 光束主炮 3D 圆柱/圆锥着色器
  // ---------------------------------------------------------
  const PLUME_VS = `#version 300 es
  precision highp float;
  layout(location = 0) in vec3 aPos; // 单位圆锥柱: xy 半径[-1..1], z [0..1] (0=喷口, 1=远端)
  layout(location = 1) in vec3 aNormal;

  uniform mat4 uViewProj;
  uniform mat4 uModel;

  out vec3 vLocal;
  out vec3 vWorldPos;
  out vec3 vWorldNormal;

  void main() {
    vLocal = aPos;
    vec4 wp = uModel * vec4(aPos, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(uModel) * aNormal);
    gl_Position = uViewProj * wp;
  }`;

  const PLUME_FS = `#version 300 es
  precision highp float;
  in vec3 vLocal;
  in vec3 vWorldPos;
  in vec3 vWorldNormal;

  uniform vec3 uCamPos;
  uniform float uTime;
  uniform int uPlumeType; // 0 = thruster plume, 1 = main beam cannon
  uniform float uIntensity;
  uniform float uPulse;
  uniform vec3 uCoreColor;
  uniform vec3 uOuterColor;

  out vec4 fragColor;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 N = normalize(vWorldNormal);
    // 视角软边缘（增强正切与始端软化，同时避免正对尾轴线直视时产生圆形环边）
    float ndv = abs(dot(N, V));
    float softEdge = pow(ndv, 2.15);

    float z = clamp(vLocal.z, 0.0, 1.0);
    float ang = atan(vLocal.y, vLocal.x);

    if (uPlumeType == 0) {
      // 推进尾焰：z=0 喷口凝聚明亮并柔顺起势，z=1 渐透明拉长；直向高速气流纹避免后视旋转风车感
      float flow = noise2(vec2(ang * 3.0, z * 7.5 - uTime * 15.0));
      float streak = 0.80 + 0.20 * sin(ang * 8.0 - uTime * 5.0);
      float axialFade = pow(1.0 - z, 1.75) * smoothstep(0.0, 0.14, z);
      // 喷口热核段 (z < 0.32) 更白炽
      float coreMask = exp(-z * 4.5) * pow(ndv, 0.75);
      vec3 col = mix(uOuterColor, uCoreColor, clamp(coreMask * 1.4 + 0.25 * (1.0 - z), 0.0, 1.0));
      float alpha = softEdge * axialFade * (0.65 + 0.45 * flow) * streak * uIntensity;
      // 微弱激波菱形节（马赫环：仅侧视可见，正对尾轴平滑隐藏）
      float shock = pow(max(sin(z * 26.0 - uTime * 12.0), 0.0), 4.0) * (1.0 - z) * 0.45 * smoothstep(0.28, 0.65, ndv);
      col += uCoreColor * shock * softEdge;
      fragColor = vec4(col * alpha * 1.6, clamp(alpha, 0.0, 1.0));
    } else {
      // 旗舰光束主炮：沿 +Z 射向高速流动细纹 + 内核与外层辉光分离 + 粗细脉动
      float flow1 = noise2(vec2(ang * 3.0, z * 28.0 - uTime * 34.0));
      float flow2 = sin(z * 42.0 - uTime * 48.0 + ang * 2.0) * 0.5 + 0.5;
      float endsFade = smoothstep(0.0, 0.03, z) * smoothstep(1.0, 0.96, z);
      // 核心极亮且中心收紧，外层更柔和透亮
      float coreLine = pow(ndv, 3.2) * (1.2 + 0.4 * uPulse);
      float outerSheath = pow(ndv, 1.1) * (0.45 + 0.55 * flow1) * (0.75 + 0.25 * flow2);
      vec3 col = uCoreColor * coreLine * 2.8 + uOuterColor * outerSheath * 1.35;
      float alpha = clamp((coreLine + outerSheath * 0.7) * endsFade * uIntensity, 0.0, 1.0);
      fragColor = vec4(col * endsFade * uIntensity, alpha);
    }
  }`;

  // ---------------------------------------------------------
  // 3. 全队能量护盾着色器（流纹、展开扫波、Fresnel 浓亮轮廓、正面轻薄）
  // ---------------------------------------------------------
  const SHIELD_VS = `#version 300 es
  precision highp float;
  layout(location = 0) in vec3 aPos;
  layout(location = 1) in vec3 aNormal;

  uniform mat4 uViewProj;
  uniform mat4 uModel;
  uniform float uExpand; // 护盾向外撑开幅度

  out vec3 vLocalPos;
  out vec3 vWorldPos;
  out vec3 vWorldNormal;

  void main() {
    vLocalPos = aPos;
    float expScale = mix(0.92, 1.02, clamp(uExpand / 0.55, 0.0, 1.0));
    vec3 displaced = aPos * expScale;
    vec4 wp = uModel * vec4(displaced, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(uModel) * aNormal);
    gl_Position = uViewProj * wp;
  }`;

  const SHIELD_FS = `#version 300 es
  precision highp float;
  in vec3 vLocalPos;
  in vec3 vWorldPos;
  in vec3 vWorldNormal;

  uniform vec3 uCamPos;
  uniform float uTime;
  uniform float uReveal;   // 0..1 展开进度（沿局部Z由舰首向舰尾扫过）
  uniform float uOpacity;  // 整体强度（开启峰值 -> 稳定态 -> 循环开头自然变薄）
  uniform vec3 uShieldColor;

  out vec4 fragColor;

  // 六角蜂窝/菱形能量网格纹样
  float hexGrid(vec2 p) {
    p *= vec2(1.0, 1.73205);
    vec2 r = vec2(1.0, 1.73205);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h;
    vec2 b = mod(p - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    float d = max(abs(gv.x), dot(abs(gv), normalize(vec2(1.0, 1.73205))));
    return smoothstep(0.42, 0.50, d);
  }

  void main() {
    if (uOpacity <= 0.002) discard;

    // 局部归一化 Z: +1 = 舰首, -1 = 舰尾
    float zNorm = clamp(vLocalPos.z, -1.0, 1.0);
    // 展开扫波前沿（自 +1 向 -1 推进）
    float frontZ = mix(1.22, -1.25, uReveal);
    float distBehindFront = zNorm - frontZ; // >0 为已扫过区域
    if (distBehindFront < -0.14) discard;

    // 展开亮波前沿线（清晰青蓝蜂窝扫描环而非漫散白带）
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 N = normalize(vWorldNormal);
    float ndv = abs(dot(N, V));
    // 正面极轻薄通透，轮廓边缘高亮
    float fresnel = pow(clamp(1.0 - ndv, 0.0, 1.0), 2.55);

    // 曲面能量流纹（斜向滑动的网格+干涉波纹）
    float ang = atan(vLocalPos.y, vLocalPos.x);
    vec2 surfUv = vec2(zNorm * 14.0 - uTime * 1.4, ang * 5.0 + uTime * 0.35);
    float grid = hexGrid(surfUv);
    float waveFront = exp(-pow(distBehindFront * 22.0, 2.0)) * smoothstep(1.0, 0.72, uReveal);
    float behindMask = smoothstep(-0.08, 0.14, distBehindFront);
    float ripple = 0.5 + 0.5 * sin(zNorm * 22.0 + uTime * 4.5 + sin(ang * 4.0) * 1.5);
    float fineBand = exp(-pow(sin(zNorm * 9.0 + uTime * 2.2) * 3.0, 2.0)) * 0.4;

    // 组合亮度与透明度：正面靠流纹薄薄可见，边缘和展开亮波清晰锐利
    float rimIntensity = fresnel * (1.25 + 0.55 * ripple + 0.45 * grid) + fineBand * (0.2 + 0.8 * fresnel);
    float centerSheen = (0.045 + 0.09 * grid + 0.05 * ripple) * (1.0 - fresnel);
    float frontBand = waveFront * (0.45 + 0.75 * grid + 0.65 * fresnel);

    vec3 colHot = mix(uShieldColor, vec3(0.55, 0.96, 1.0), clamp(waveFront * 0.65 + fresnel * 0.45, 0.0, 1.0));
    float totalAlpha = (rimIntensity * 0.78 + centerSheen + frontBand) * behindMask * uOpacity;

    fragColor = vec4(colHot * totalAlpha * 2.2, clamp(totalAlpha, 0.0, 0.92));
  }`;

  // ---------------------------------------------------------
  // 4. 导弹尾迹 Ribbon 着色器
  // ---------------------------------------------------------
  const TRAIL_VS = `#version 300 es
  precision highp float;
  layout(location = 0) in vec3 aPos;
  layout(location = 1) in vec2 aUv;      // x: 0..1 along trail (0=head, 1=tail), y: -1..1 across width
  layout(location = 2) in vec4 aColor;

  uniform mat4 uViewProj;
  out vec2 vUv;
  out vec4 vColor;

  void main() {
    vUv = aUv;
    vColor = aColor;
    gl_Position = uViewProj * vec4(aPos, 1.0);
  }`;

  const TRAIL_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  in vec4 vColor;
  out vec4 fragColor;

  void main() {
    float across = abs(vUv.y);
    float edge = pow(max(1.0 - across, 0.0), 1.7);
    float headFade = smoothstep(0.0, 0.06, vUv.x);
    float tailFade = pow(max(1.0 - vUv.x, 0.0), 1.3);
    float a = edge * headFade * tailFade * vColor.a;
    fragColor = vec4(vColor.rgb * a, a);
  }`;

  // ---------------------------------------------------------
  // 几何体构建辅助（高细分圆锥柱体 & 流线护盾包络椭球）
  // ---------------------------------------------------------
  function createPlumeGeometry(gl, segs = 24, rings = 16, taperEnd = 0.25) {
    const verts = [];
    const idx = [];
    for (let r = 0; r <= rings; r++) {
      const z = r / rings;
      const rad = SF.Math.lerp(1.0, taperEnd, Math.pow(z, 0.75));
      for (let s = 0; s <= segs; s++) {
        const th = (s / segs) * Math.PI * 2;
        const c = Math.cos(th), sn = Math.sin(th);
        verts.push(c * rad, sn * rad, z, c, sn, 0.2);
      }
    }
    const stride = segs + 1;
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * stride + s;
        const b = a + 1;
        const c = (r + 1) * stride + s;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, indexCount: idx.length };
  }

  // 生成贴合战舰「楔形流线」的护盾几何体（单位化坐标：x,y,z 在 [-1..+1]，外加略微楔形拉长）
  function createShieldEllipsoid(gl, stacks = 28, slices = 48) {
    const verts = [];
    const idx = [];
    for (let i = 0; i <= stacks; i++) {
      const v = i / stacks;
      const phi = v * Math.PI; // 0 (+Z) .. PI (-Z)
      const cosP = Math.cos(phi); // +1 -> -1
      const sinP = Math.sin(phi);
      // 前端(+Z)略微收尖成楔形流线，后端较饱满，吻合旗舰与护卫舰轮廓
      const wedgeTaper = cosP > 0 ? (1.0 - 0.34 * Math.pow(cosP, 1.4)) : (1.0 - 0.14 * Math.pow(-cosP, 2.0));
      for (let j = 0; j <= slices; j++) {
        const u = j / slices;
        const th = u * Math.PI * 2;
        const x = sinP * Math.cos(th) * wedgeTaper;
        const y = sinP * Math.sin(th) * (0.88 + 0.12 * wedgeTaper);
        const z = cosP;
        const nl = Math.hypot(x, y, z) || 1;
        verts.push(x, y, z, x / nl, y / nl, z / nl);
      }
    }
    const stride = slices + 1;
    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < slices; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = (i + 1) * stride + j;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, indexCount: idx.length };
  }

  // ---------------------------------------------------------
  // VFX Manager Class
  // ---------------------------------------------------------
  class VFXSystem {
    constructor(renderer) {
      const gl = renderer.gl;
      this.gl = gl;
      this.renderer = renderer;

      this.spriteProg = SF.createProgram(gl, SPRITE_VS, SPRITE_FS);
      this.plumeProg = SF.createProgram(gl, PLUME_VS, PLUME_FS);
      this.shieldProg = SF.createProgram(gl, SHIELD_VS, SHIELD_FS);
      this.trailProg = SF.createProgram(gl, TRAIL_VS, TRAIL_FS);

      this.thrusterGeo = createPlumeGeometry(gl, 32, 20, 0.14);
      this.beamGeo = createPlumeGeometry(gl, 24, 20, 1.0);
      this.shieldGeo = createShieldEllipsoid(gl, 28, 48);

      // 实例化 Sprite 缓冲区（最大 8192 个）
      this.maxSprites = 8192;
      // 每个实例 12 floats: posSize(4), velStretch(4), color(4)
      this.spriteData = new Float32Array(this.maxSprites * 12);
      this.modeBuckets = [[], [], []]; // mode 0: glow/dust, mode 1: streak/bolt, mode 2: shock ring

      this.spriteVao = gl.createVertexArray();
      gl.bindVertexArray(this.spriteVao);

      const quadVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.spriteInstVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteInstVbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.spriteData.byteLength, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 48, 0);
      gl.vertexAttribDivisor(1, 1);

      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 48, 16);
      gl.vertexAttribDivisor(2, 1);

      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 48, 32);
      gl.vertexAttribDivisor(3, 1);
      gl.bindVertexArray(null);

      // 动态尾迹 Ribbon 缓冲
      this.maxTrailVerts = 24000;
      this.trailVerts = new Float32Array(this.maxTrailVerts * 9); // xyz(3) + uv(2) + rgba(4)
      this.trailVertCount = 0;
      this.trailVao = gl.createVertexArray();
      gl.bindVertexArray(this.trailVao);
      this.trailVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.trailVbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.trailVerts.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
      gl.bindVertexArray(null);

      // 预生成固定种子的太空漂浮微粒网格 (1600x1000x1600 周期平铺盒内 2400 颗)
      const rng = SF.Math.mulberry32(99173);
      this.dustParticles = [];
      for (let i = 0; i < 2400; i++) {
        this.dustParticles.push({
          x: (rng() - 0.5) * 1800,
          y: (rng() - 0.5) * 900,
          z: rng() * 1600,
          size: 0.35 + rng() * 1.15,
          bright: 0.25 + rng() * 0.75,
          tint: rng()
        });
      }

      this.plumeDraws = [];
      this.beamDraws = [];
      this.shieldDraws = [];
      this.tempMat = SF.Math.Mat4.create();
    }

    beginFrame() {
      this.modeBuckets[0].length = 0;
      this.modeBuckets[1].length = 0;
      this.modeBuckets[2].length = 0;
      this.trailVertCount = 0;
      this.plumeDraws.length = 0;
      this.beamDraws.length = 0;
      this.shieldDraws.length = 0;
    }

    addGlow(pos, size, r, g, b, a = 1.0) {
      this.modeBuckets[0].push(pos[0], pos[1], pos[2], size, 0, 0, 1, 0, r, g, b, a);
    }

    addStreak(pos, dir, width, length, r, g, b, a = 1.0) {
      this.modeBuckets[1].push(pos[0], pos[1], pos[2], width, dir[0], dir[1], dir[2], length, r, g, b, a);
    }

    addShockRing(pos, axisDir, radius, r, g, b, a = 1.0, oriented = true) {
      this.modeBuckets[2].push(pos[0], pos[1], pos[2], radius, axisDir[0], axisDir[1], axisDir[2], oriented ? -1.0 : 0.0, r, g, b, a);
    }

    // 添加一条三维尾迹丝带点列 points: [{pos, width, r, g, b, a}]
    addTrail(points, camPos) {
      const n = points.length;
      if (n < 2) return;
      // 转成 Triangle Strip 退化/独立三角形 (n-1)*6 顶点
      if (this.trailVertCount + (n - 1) * 6 > this.maxTrailVerts) return;

      const lefts = [];
      const rights = [];
      for (let i = 0; i < n; i++) {
        const prev = points[Math.max(0, i - 1)].pos;
        const next = points[Math.min(n - 1, i + 1)].pos;
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        const tz = next[2] - prev[2];
        const vx = camPos[0] - points[i].pos[0];
        const vy = camPos[1] - points[i].pos[1];
        const vz = camPos[2] - points[i].pos[2];
        // side = cross(tangent, toCam)
        let sx = ty * vz - tz * vy;
        let sy = tz * vx - tx * vz;
        let sz = tx * vy - ty * vx;
        const sl = Math.hypot(sx, sy, sz) || 1;
        const hw = points[i].width * 0.5;
        sx = (sx / sl) * hw;
        sy = (sy / sl) * hw;
        sz = (sz / sl) * hw;
        lefts.push([points[i].pos[0] - sx, points[i].pos[1] - sy, points[i].pos[2] - sz]);
        rights.push([points[i].pos[0] + sx, points[i].pos[1] + sy, points[i].pos[2] + sz]);
      }

      const pushV = (p, u, v, pt) => {
        const base = this.trailVertCount * 9;
        this.trailVerts[base] = p[0];
        this.trailVerts[base + 1] = p[1];
        this.trailVerts[base + 2] = p[2];
        this.trailVerts[base + 3] = u;
        this.trailVerts[base + 4] = v;
        this.trailVerts[base + 5] = pt.r;
        this.trailVerts[base + 6] = pt.g;
        this.trailVerts[base + 7] = pt.b;
        this.trailVerts[base + 8] = pt.a;
        this.trailVertCount++;
      };

      for (let i = 0; i < n - 1; i++) {
        const u0 = i / (n - 1);
        const u1 = (i + 1) / (n - 1);
        const p0 = points[i];
        const p1 = points[i + 1];
        pushV(lefts[i], u0, -1, p0);
        pushV(rights[i], u0, 1, p0);
        pushV(lefts[i + 1], u1, -1, p1);
        pushV(rights[i], u0, 1, p0);
        pushV(rights[i + 1], u1, 1, p1);
        pushV(lefts[i + 1], u1, -1, p1);
      }
    }

    addThrusterPlume(worldPos, backDir, radius, length, intensity, coreCol, outerCol) {
      this.plumeDraws.push({
        pos: worldPos,
        dir: backDir,
        radius,
        length,
        intensity,
        coreCol,
        outerCol
      });
    }

    addBeamSegment(startPos, endPos, radius, intensity, pulse, coreCol, outerCol) {
      const dx = endPos[0] - startPos[0];
      const dy = endPos[1] - startPos[1];
      const dz = endPos[2] - startPos[2];
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-3) return;
      this.beamDraws.push({
        pos: startPos,
        dir: [dx / len, dy / len, dz / len],
        radius,
        length: len,
        intensity,
        pulse,
        coreCol,
        outerCol
      });
    }

    addShield(shipModelMat, halfExtents, reveal, opacity, expand, color) {
      if (opacity <= 0.002) return;
      this.shieldDraws.push({
        shipModelMat,
        halfExtents,
        reveal,
        opacity,
        expand,
        color
      });
    }

    // 填充循环同步宇宙高速漂浮尘屑粒子
    populateSpaceDust(camPos, travelDist, fleetSpeed, interiorMix, beamLight, thrusterCenters) {
      if (interiorMix > 0.85) return;
      const visScale = 1.0 - interiorMix;
      const boxZ = 1600;
      const speedNorm = SF.Math.clamp((fleetSpeed - 0.8) / 1.6, 0.0, 1.0);
      const streakLen = 2.0 + speedNorm * 22.0;

      for (let i = 0; i < this.dustParticles.length; i++) {
        const p = this.dustParticles[i];
        // Z 向 -Z 流动，按 travelDist 平移后相对相机视区环绕取模
        let pz = (p.z - travelDist) % boxZ;
        if (pz < 0) pz += boxZ;
        // 映射到围绕相机前后 [-600 .. +1000] 区间
        const relZ = ((pz - camPos[2] + 600) % boxZ + boxZ) % boxZ - 600;
        const wz = camPos[2] + relZ;

        // X/Y 同样环绕相机附近，避免偏航离开粒子盒
        const relX = ((p.x - camPos[0] + 900) % 1800 + 1800) % 1800 - 900;
        const relY = ((p.y - camPos[1] + 450) % 900 + 900) % 900 - 450;
        const wx = camPos[0] + relX;
        const wy = camPos[1] + relY;

        // 太靠近相机或太远淡出
        const dist = Math.hypot(relX, relY, relZ);
        if (dist < 14 || dist > 950) continue;

        let boost = 0.0;
        // 被附近推进器和光束点亮
        if (beamLight && beamLight.intensity > 0.1) {
          const dBeam = Math.hypot(wx - beamLight.end[0], wy - beamLight.end[1], wz - beamLight.end[2]);
          if (dBeam < 350) boost += (1.0 - dBeam / 350) * 1.4;
        }
        if (thrusterCenters) {
          for (let k = 0; k < thrusterCenters.length; k++) {
            const tc = thrusterCenters[k];
            const dt = Math.hypot(wx - tc[0], wy - tc[1], wz - tc[2]);
            if (dt < 260) boost += (1.0 - dt / 260) * 1.2;
          }
        }

        const bVal = (0.32 + 0.55 * p.bright + boost) * visScale;
        const r = SF.Math.lerp(0.65, 1.0, p.tint) * bVal;
        const g = SF.Math.lerp(0.85, 0.92, p.tint) * bVal;
        const bl = SF.Math.lerp(1.0, 0.78, p.tint) * bVal;
        this.addStreak([wx, wy, wz], [0, 0, -1], p.size * 0.45, streakLen * (0.7 + p.bright * 0.6), r, g, bl, 0.75 * visScale);
      }
    }

    _buildOrientedMatrix(pos, dir, radius, length) {
      const f = dir;
      const refUp = Math.abs(f[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const r = SF.Math.Vec3.normalize([], SF.Math.Vec3.cross([], refUp, f));
      const u = SF.Math.Vec3.cross([], f, r);
      const m = this.tempMat;
      m[0] = r[0] * radius; m[1] = r[1] * radius; m[2] = r[2] * radius; m[3] = 0;
      m[4] = u[0] * radius; m[5] = u[1] * radius; m[6] = u[2] * radius; m[7] = 0;
      m[8] = f[0] * length; m[9] = f[1] * length; m[10] = f[2] * length; m[11] = 0;
      m[12] = pos[0]; m[13] = pos[1]; m[14] = pos[2]; m[15] = 1;
      return m;
    }

    render(renderer, cam) {
      const gl = this.gl;
      const view = renderer.viewMat;
      const camRight = [view[0], view[4], view[8]];
      const camUp = [view[1], view[5], view[9]];

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);

      // 1. Additive 渲染推进尾焰与光束主炮
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      if (this.plumeDraws.length > 0 || this.beamDraws.length > 0) {
        const pp = this.plumeProg;
        gl.useProgram(pp.program);
        gl.uniformMatrix4fv(pp.u.uViewProj, false, renderer.viewProjMat);
        gl.uniform3fv(pp.u.uCamPos, cam.pos);
        gl.uniform1f(pp.u.uTime, renderer.currentTime || 0);

        // 推进尾焰
        if (this.plumeDraws.length > 0) {
          gl.bindVertexArray(this.thrusterGeo.vao);
          gl.uniform1i(pp.u.uPlumeType, 0);
          for (let i = 0; i < this.plumeDraws.length; i++) {
            const d = this.plumeDraws[i];
            const m = this._buildOrientedMatrix(d.pos, d.dir, d.radius, d.length);
            gl.uniformMatrix4fv(pp.u.uModel, false, m);
            gl.uniform1f(pp.u.uIntensity, d.intensity);
            gl.uniform1f(pp.u.uPulse, 0.0);
            gl.uniform3fv(pp.u.uCoreColor, d.coreCol);
            gl.uniform3fv(pp.u.uOuterColor, d.outerCol);
            gl.drawElements(gl.TRIANGLES, this.thrusterGeo.indexCount, gl.UNSIGNED_SHORT, 0);
          }
        }

        // 光束主炮
        if (this.beamDraws.length > 0) {
          gl.bindVertexArray(this.beamGeo.vao);
          gl.uniform1i(pp.u.uPlumeType, 1);
          for (let i = 0; i < this.beamDraws.length; i++) {
            const b = this.beamDraws[i];
            const m = this._buildOrientedMatrix(b.pos, b.dir, b.radius, b.length);
            gl.uniformMatrix4fv(pp.u.uModel, false, m);
            gl.uniform1f(pp.u.uIntensity, b.intensity);
            gl.uniform1f(pp.u.uPulse, b.pulse);
            gl.uniform3fv(pp.u.uCoreColor, b.coreCol);
            gl.uniform3fv(pp.u.uOuterColor, b.outerCol);
            gl.drawElements(gl.TRIANGLES, this.beamGeo.indexCount, gl.UNSIGNED_SHORT, 0);
          }
        }
      }

      // 2. 导弹尾迹 Ribbon (Additive)
      if (this.trailVertCount > 0) {
        const tp = this.trailProg;
        gl.useProgram(tp.program);
        gl.uniformMatrix4fv(tp.u.uViewProj, false, renderer.viewProjMat);
        gl.bindVertexArray(this.trailVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.trailVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.trailVerts.subarray(0, this.trailVertCount * 9));
        gl.drawArrays(gl.TRIANGLES, 0, this.trailVertCount);
      }

      // 3. Instanced Sprites (辉光、弹丸、脉冲、近防弹迹、光环)
      const sp = this.spriteProg;
      gl.useProgram(sp.program);
      gl.uniformMatrix4fv(sp.u.uViewProj, false, renderer.viewProjMat);
      gl.uniform3fv(sp.u.uCamRight, camRight);
      gl.uniform3fv(sp.u.uCamUp, camUp);
      gl.uniform3fv(sp.u.uCamPos, cam.pos);
      gl.bindVertexArray(this.spriteVao);

      for (let mode = 0; mode < 3; mode++) {
        const arr = this.modeBuckets[mode];
        if (arr.length === 0) continue;
        const count = Math.min(this.maxSprites, (arr.length / 12) | 0);
        this.spriteData.set(arr.slice(0, count * 12));
        gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteInstVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.spriteData.subarray(0, count * 12));
        gl.uniform1i(sp.u.uMode, mode);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      }

      // 4. 全队通透能量护盾（使用标准 Alpha/Additive 混合，先画背面再画正面或单画正面，保证透明清晰）
      if (this.shieldDraws.length > 0) {
        const shp = this.shieldProg;
        gl.useProgram(shp.program);
        gl.uniformMatrix4fv(shp.u.uViewProj, false, renderer.viewProjMat);
        gl.uniform3fv(shp.u.uCamPos, cam.pos);
        gl.uniform1f(shp.u.uTime, renderer.currentTime || 0);
        gl.bindVertexArray(this.shieldGeo.vao);

        gl.enable(gl.CULL_FACE);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        const scaleMat = SF.Math.Mat4.create();
        const finalMat = SF.Math.Mat4.create();

        for (let i = 0; i < this.shieldDraws.length; i++) {
          const s = this.shieldDraws[i];
          SF.Math.Mat4.identity(scaleMat);
          scaleMat[0] = s.halfExtents[0];
          scaleMat[5] = s.halfExtents[1];
          scaleMat[10] = s.halfExtents[2];
          SF.Math.Mat4.multiply(finalMat, s.shipModelMat, scaleMat);
          gl.uniformMatrix4fv(shp.u.uModel, false, finalMat);
          gl.uniform1f(shp.u.uReveal, s.reveal);
          gl.uniform1f(shp.u.uOpacity, s.opacity);
          gl.uniform1f(shp.u.uExpand, s.expand);
          gl.uniform3fv(shp.u.uShieldColor, s.color);

          // 只渲染护盾正面壳层或背+正面：若只渲染正面(BACK culling)，不会因为背面与正面双重叠加导致中间浑浊，更清晰看见后方战舰实体！
          gl.cullFace(gl.BACK);
          gl.drawElements(gl.TRIANGLES, this.shieldGeo.indexCount, gl.UNSIGNED_SHORT, 0);
        }
      }

      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }

  SF.VFXSystem = VFXSystem;
})(window);
