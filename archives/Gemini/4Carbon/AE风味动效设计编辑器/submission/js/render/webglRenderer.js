/**
 * Forge Studio — Complete WebGL 2 Rendering & Compositing Pipeline
 * - Procedural HDR Forge/Studio Cubemap IBL with Roughness Mipmaps (2.11)
 * - 2048x2048 PCF Shadow Mapping with Hole/Alpha Cutout Support (2.11)
 * - Cook-Torrance GGX PBR + Unified 3D Depth Occlusion + Sorted Particles & Trails (2.11, 2.12, 2.13)
 * - Per-Pixel Depth-Based Depth of Field Bokeh Pass (2.12)
 * - Layer Masks, Track Mattes, Reorderable Effects (Blur, Glow, Drop Shadow, HSL),
 *   Adjustment Layers & 5 W3C Premultiplied Blend Modes (2.9)
 * - Recursive Pre-composition & Shutter-Interval Multi-Sample Motion Blur (2.10)
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, lerp, DEG2RAD, Vec3, Mat4, rgbToCss } = Forge.Math;
  const Geo2D = Forge.Geo2D;
  const Geo3D = Forge.Geo3D;
  const Anim = Forge.Anim;
  const Nodes = Forge.Nodes;
  const Particles = Forge.Particles;
  const SceneEval = Forge.SceneEval;

  // =========================================================================
  // GLSL ES 3.00 SHADERS
  // =========================================================================
  const QUAD_VS = `#version 300 es
  layout(location = 0) in vec2 a_pos;
  out vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  // Shadow Map Depth Pass (supports both 3D solid meshes and alpha-cutout 3D planes so holes pass light!)
  const SHADOW_VS = `#version 300 es
  layout(location = 0) in vec3 a_pos;
  layout(location = 2) in vec2 a_uv;
  uniform mat4 u_lightMVP;
  out vec2 v_uv;
  void main() {
    v_uv = a_uv;
    gl_Position = u_lightMVP * vec4(a_pos, 1.0);
  }`;

  const SHADOW_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  uniform int u_useAlphaTex;
  uniform sampler2D u_alphaTex;
  void main() {
    if (u_useAlphaTex == 1) {
      float a = texture(u_alphaTex, vec2(v_uv.x, 1.0 - v_uv.y)).a;
      if (a < 0.18) discard;
    }
  }`;

  // Main 3D PBR + Shadow + IBL + Linear Depth MRT Shader
  const PBR_VS = `#version 300 es
  layout(location = 0) in vec3 a_pos;
  layout(location = 1) in vec3 a_normal;
  layout(location = 2) in vec2 a_uv;

  uniform mat4 u_model;
  uniform mat4 u_view;
  uniform mat4 u_proj;
  uniform mat4 u_normalMat;
  uniform mat4 u_lightVP;

  out vec3 v_worldPos;
  out vec3 v_normal;
  out vec2 v_uv;
  out float v_linearDepth;
  out vec4 v_shadowCoord;

  void main() {
    vec4 wp = u_model * vec4(a_pos, 1.0);
    v_worldPos = wp.xyz;
    v_normal = normalize((u_normalMat * vec4(a_normal, 0.0)).xyz);
    v_uv = a_uv;
    vec4 vp = u_view * wp;
    v_linearDepth = -vp.z;
    v_shadowCoord = u_lightVP * wp;
    gl_Position = u_proj * vp;
  }`;

  const PBR_FS = `#version 300 es
  precision highp float;

  in vec3 v_worldPos;
  in vec3 v_normal;
  in vec2 v_uv;
  in float v_linearDepth;
  in vec4 v_shadowCoord;

  layout(location = 0) out vec4 outColor;
  layout(location = 1) out vec4 outDepth;

  uniform vec3 u_camPos;
  uniform vec3 u_baseColor;
  uniform float u_metallic;
  uniform float u_roughness;
  uniform vec3 u_emission;
  uniform float u_opacity;
  uniform int u_receiveShadows;
  uniform int u_useTex;
  uniform int u_unlitTex;
  uniform sampler2D u_albedoTex;

  // Up to 6 simultaneous scene lights
  uniform int u_numLights;
  uniform int u_lightTypes[6];     // 0 = directional, 1 = point
  uniform vec3 u_lightPosDir[6];   // dir (towards light) for directional, worldPos for point
  uniform vec3 u_lightColors[6];   // color * intensity
  uniform float u_lightRanges[6];
  uniform int u_shadowLightIndex;

  uniform sampler2D u_shadowMap;
  uniform samplerCube u_envMap;

  const float PI = 3.14159265359;

  float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / max(PI * denom * denom, 1e-6);
  }

  float geometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return NdotV / max(NdotV * (1.0 - k) + k, 1e-6);
  }

  float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    return geometrySchlickGGX(max(dot(N, V), 0.0), roughness) *
           geometrySchlickGGX(max(dot(N, L), 0.0), roughness);
  }

  vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }

  vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }

  float sampleShadowPCF(vec4 sc, vec3 N, vec3 L) {
    vec3 proj = sc.xyz / max(sc.w, 1e-5);
    proj = proj * 0.5 + 0.5;
    if (proj.x < 0.002 || proj.x > 0.998 || proj.y < 0.002 || proj.y > 0.998 || proj.z > 0.999 || proj.z < 0.0) {
      return 1.0;
    }
    float bias = max(0.0026 * (1.0 - max(dot(N, L), 0.0)), 0.00065);
    vec2 texel = 1.0 / vec2(textureSize(u_shadowMap, 0));
    float vis = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        float closest = texture(u_shadowMap, proj.xy + vec2(float(x), float(y)) * texel * 1.35).r;
        vis += (proj.z - bias <= closest) ? 1.0 : 0.0;
      }
    }
    return vis / 9.0;
  }

  void main() {
    vec3 albedo = u_baseColor;
    float alpha = u_opacity;

    if (u_useTex == 1) {
      vec4 tex = texture(u_albedoTex, vec2(v_uv.x, 1.0 - v_uv.y));
      if (tex.a < 0.015) discard;
      // Unpremultiply texture RGB
      vec3 texRgb = tex.rgb / max(tex.a, 1e-4);
      alpha *= tex.a;
      if (u_unlitTex == 1) {
        outColor = vec4(texRgb * alpha, alpha);
        outDepth = vec4(v_linearDepth, 0.0, 0.0, 1.0);
        return;
      }
      albedo *= texRgb;
    }

    if (alpha < 0.005) discard;

    vec3 N = normalize(gl_FrontFacing ? v_normal : -v_normal);
    vec3 V = normalize(u_camPos - v_worldPos);
    float NdotV = max(dot(N, V), 0.001);

    float rough = clamp(u_roughness, 0.045, 1.0);
    float metal = clamp(u_metallic, 0.0, 1.0);
    vec3 F0 = mix(vec3(0.04), albedo, metal);

    vec3 Lo = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      if (i >= u_numLights) break;
      vec3 L;
      float atten = 1.0;
      if (u_lightTypes[i] == 0) {
        L = normalize(u_lightPosDir[i]);
      } else {
        vec3 toL = u_lightPosDir[i] - v_worldPos;
        float dist = length(toL);
        L = toL / max(dist, 1e-4);
        float rng = max(u_lightRanges[i], 50.0);
        float normD = clamp(dist / rng, 0.0, 1.0);
        atten = (1.0 - normD * normD) * (1.0 / (1.0 + 0.0008 * dist + 0.0000025 * dist * dist));
      }

      float NdotL = max(dot(N, L), 0.0);
      if (NdotL > 0.0) {
        vec3 H = normalize(V + L);
        float NDF = distributionGGX(N, H, rough);
        float G = geometrySmith(N, V, L, rough);
        vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

        vec3 numerator = NDF * G * F;
        float denom = 4.0 * NdotV * NdotL + 0.0001;
        vec3 specular = numerator / denom;

        vec3 kS = F;
        vec3 kD = (vec3(1.0) - kS) * (1.0 - metal);

        float shadow = 1.0;
        if (u_receiveShadows == 1 && i == u_shadowLightIndex) {
          shadow = mix(0.14, 1.0, sampleShadowPCF(v_shadowCoord, N, L));
        }
        Lo += (kD * albedo / PI + specular) * u_lightColors[i] * atten * NdotL * shadow;
      }
    }

    // Procedural Cubemap Environment IBL (View- & Normal-dependent Specular + Diffuse!)
    vec3 R = reflect(-V, N);
    // Flip Y for cubemap sampling since world +Y is down
    vec3 envR = vec3(R.x, -R.y, R.z);
    vec3 envN = vec3(N.x, -N.y, N.z);
    vec3 prefilteredEnv = textureLod(u_envMap, envR, rough * 5.0).rgb;
    vec3 irradiance = textureLod(u_envMap, envN, 4.8).rgb;

    vec3 kS_ibl = fresnelSchlickRoughness(NdotV, F0, rough);
    vec3 kD_ibl = (1.0 - kS_ibl) * (1.0 - metal);
    // Analytical split-sum env BRDF approximation (Lazarov)
    vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
    vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
    vec4 rVec = rough * c0 + c1;
    float a004 = min(rVec.x * rVec.x, exp2(-9.28 * NdotV)) * rVec.x + rVec.y;
    vec2 envAB = vec2(-1.04, 1.04) * a004 + rVec.zw;
    vec3 envSpecular = prefilteredEnv * (kS_ibl * envAB.x + envAB.y);
    vec3 ambient = kD_ibl * irradiance * albedo * 0.65 + envSpecular * 0.92;

    vec3 color = ambient + Lo + u_emission;
    // Soft ACES-inspired highlight roll-off while keeping bright hot metal luminous
    color = color / (vec3(1.0) + color * 0.22);

    outColor = vec4(color * alpha, alpha);
    outDepth = vec4(v_linearDepth, 0.0, 0.0, 1.0);
  }`;

  // 3D Particle & Trail Shader (participates in 3D depth occlusion + soft additive/alpha glow!)
  const PARTICLE_VS = `#version 300 es
  layout(location = 0) in vec3 a_pos;
  layout(location = 1) in vec4 a_color;
  layout(location = 2) in vec2 a_uv;

  uniform mat4 u_view;
  uniform mat4 u_proj;

  out vec4 v_color;
  out vec2 v_uv;
  out float v_linearDepth;

  void main() {
    vec4 vp = u_view * vec4(a_pos, 1.0);
    v_linearDepth = -vp.z;
    v_color = a_color;
    v_uv = a_uv;
    gl_Position = u_proj * vp;
  }`;

  const PARTICLE_FS = `#version 300 es
  precision highp float;
  in vec4 v_color;
  in vec2 v_uv;
  in float v_linearDepth;

  layout(location = 0) out vec4 outColor;
  layout(location = 1) out vec4 outDepth;

  uniform int u_isRibbon;

  void main() {
    float mask = 1.0;
    if (u_isRibbon == 0) {
      float d = length(v_uv * 2.0 - 1.0);
      if (d > 1.0) discard;
      // Hot white-gold spark core + soft outer corona
      mask = pow(1.0 - d, 1.65);
    } else {
      float edge = abs(v_uv.y * 2.0 - 1.0);
      mask = smoothstep(1.0, 0.15, edge);
    }
    float a = v_color.a * mask;
    if (a < 0.004) discard;
    vec3 rgb = v_color.rgb * (1.0 + 0.65 * mask);
    outColor = vec4(rgb * a, a);
    outDepth = vec4(v_linearDepth, 0.0, 0.0, 1.0);
  }`;

  // True Per-Pixel Depth-Based Depth of Field Shader (24-tap Vogel Golden-Angle Bokeh Disc)
  const DOF_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_colorTex;
  uniform sampler2D u_depthTex;
  uniform float u_focusDist;
  uniform float u_aperture;
  uniform vec2 u_texelSize;

  float calcCoC(float depth) {
    if (depth <= 0.01) return 0.0;
    return clamp(u_aperture * abs(depth - u_focusDist) / max(depth, 60.0), 0.0, 22.0);
  }

  void main() {
    vec4 centerCol = texture(u_colorTex, v_uv);
    float centerDepth = texture(u_depthTex, v_uv).r;
    float centerCoC = calcCoC(centerDepth);

    if (u_aperture <= 0.05) {
      outColor = centerCol;
      return;
    }

    vec4 acc = centerCol;
    float totalW = 1.0;
    const int SAMPLES = 24;
    const float GOLDEN_ANGLE = 2.39996323;

    for (int i = 1; i <= SAMPLES; i++) {
      float r = sqrt(float(i) / float(SAMPLES));
      float theta = float(i) * GOLDEN_ANGLE;
      // Search max CoC radius so foreground out-of-focus edges also blur smoothly
      float searchR = max(centerCoC, min(u_aperture * 0.45, 16.0));
      vec2 offset = vec2(cos(theta), sin(theta)) * r * searchR * u_texelSize;
      vec2 suv = clamp(v_uv + offset, vec2(0.001), vec2(0.999));

      vec4 sCol = texture(u_colorTex, suv);
      float sDepth = texture(u_depthTex, suv).r;
      float sCoC = sDepth > 0.01 ? calcCoC(sDepth) : centerCoC;

      // Prevent sharp foreground from bleeding background into itself, while allowing foreground bokeh
      float w = (sDepth < centerDepth && centerDepth > 0.01)
        ? smoothstep(0.0, 2.0, sCoC - r * searchR + 1.5)
        : smoothstep(0.0, 2.0, max(centerCoC, sCoC) - r * searchR + 1.5);
      w = max(w, centerCoC > 0.8 && r * searchR <= centerCoC ? 0.85 : 0.0);

      acc += sCol * w;
      totalW += w;
    }

    outColor = acc / max(totalW, 1e-4);
  }`;

  // Effects Shaders: Separable Gaussian Blur, Glow Bright-Pass + Combine, Drop Shadow, HSL
  const BLUR_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_tex;
  uniform vec2 u_dir; // (dx, 0) or (0, dy) in UV units
  uniform float u_radius;
  uniform int u_repeatEdge;

  void main() {
    if (u_radius <= 0.2) {
      outColor = texture(u_tex, v_uv);
      return;
    }
    vec4 sum = vec4(0.0);
    float norm = 0.0;
    int taps = int(clamp(ceil(u_radius), 2.0, 28.0));
    float sigma = max(u_radius * 0.45, 0.5);
    float twoSigmaSq = 2.0 * sigma * sigma;

    for (int i = -28; i <= 28; i++) {
      if (i < -taps || i > taps) continue;
      float fi = float(i) * (u_radius / float(taps));
      float w = exp(-(fi * fi) / twoSigmaSq);
      vec2 uv = v_uv + u_dir * fi;
      vec4 s;
      if (u_repeatEdge == 1) {
        s = texture(u_tex, clamp(uv, vec2(0.001), vec2(0.999)));
      } else {
        s = (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? vec4(0.0) : texture(u_tex, uv);
      }
      sum += s * w;
      norm += w;
    }
    outColor = sum / max(norm, 1e-5);
  }`;

  const GLOW_EXTRACT_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_tex;
  uniform float u_threshold;
  void main() {
    vec4 c = texture(u_tex, v_uv);
    vec3 straight = c.a > 1e-4 ? c.rgb / c.a : vec3(0.0);
    float lum = max(max(straight.r, straight.g), straight.b);
    float knee = smoothstep(u_threshold * 0.75, u_threshold + 0.15, lum);
    outColor = vec4(c.rgb * knee, c.a * knee);
  }`;

  const GLOW_COMBINE_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_baseTex;
  uniform sampler2D u_blurTex;
  uniform vec3 u_glowColor;
  uniform float u_intensity;
  void main() {
    vec4 base = texture(u_baseTex, v_uv);
    vec4 glow = texture(u_blurTex, v_uv);
    vec3 addGlow = glow.rgb * u_glowColor * u_intensity;
    float glowA = clamp(max(glow.a * u_intensity * 0.65, max(addGlow.r, max(addGlow.g, addGlow.b)) * 0.55), 0.0, 1.0);
    float outA = clamp(base.a + glowA * (1.0 - base.a), 0.0, 1.0);
    outColor = vec4(base.rgb + addGlow, outA);
  }`;

  const DROPSHADOW_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_baseTex;
  uniform sampler2D u_blurTex;
  uniform vec2 u_offsetUv;
  uniform vec3 u_shadowColor;
  uniform float u_shadowOpacity;
  void main() {
    vec4 fg = texture(u_baseTex, v_uv);
    vec2 suv = v_uv - u_offsetUv;
    float sa = (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0)
      ? 0.0
      : texture(u_blurTex, suv).a * u_shadowOpacity;
    sa = clamp(sa, 0.0, 1.0);
    vec4 sh = vec4(u_shadowColor * sa, sa);
    // Porter-Duff fg OVER shadow!
    outColor = fg + sh * (1.0 - fg.a);
  }`;

  const HSL_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_tex;
  uniform float u_hueDeg;
  uniform float u_sat;
  uniform float u_light;

  vec3 rgb2hsl(vec3 c) {
    float maxC = max(max(c.r, c.g), c.b);
    float minC = min(min(c.r, c.g), c.b);
    float l = (maxC + minC) * 0.5;
    float d = maxC - minC;
    if (d < 1e-5) return vec3(0.0, 0.0, l);
    float s = l > 0.5 ? d / max(2.0 - maxC - minC, 1e-5) : d / max(maxC + minC, 1e-5);
    float h;
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    return vec3(h / 6.0, s, l);
  }

  float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0 / 2.0) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 hsl) {
    if (hsl.y < 1e-5) return vec3(hsl.z);
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    return vec3(
      hue2rgb(p, q, hsl.x + 1.0 / 3.0),
      hue2rgb(p, q, hsl.x),
      hue2rgb(p, q, hsl.x - 1.0 / 3.0)
    );
  }

  void main() {
    vec4 src = texture(u_tex, v_uv);
    if (src.a <= 1e-5) { outColor = vec4(0.0); return; }
    vec3 rgb = clamp(src.rgb / src.a, 0.0, 1.0);
    vec3 hsl = rgb2hsl(rgb);
    hsl.x = fract(hsl.x + u_hueDeg / 360.0 + 1.0);
    hsl.y = clamp(hsl.y * (1.0 + u_sat), 0.0, 1.0);
    hsl.z = clamp(hsl.z + u_light * 0.5, 0.0, 1.0);
    vec3 outRgb = hsl2rgb(hsl);
    outColor = vec4(outRgb * src.a, src.a);
  }`;

  // W3C / Adobe Premultiplied Blend + Mask + Track Matte Compositor Shader (Section 2.9)
  const COMPOSITE_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_bgTex;
  uniform sampler2D u_fgTex;
  uniform sampler2D u_maskTex;
  uniform sampler2D u_matteTex;

  uniform float u_layerOpacity;
  uniform int u_useMask;
  uniform int u_matteMode;  // 0=none, 1=alpha, 2=alpha_inv, 3=luma, 4=luma_inv
  uniform int u_blendMode;  // 0=normal, 1=add, 2=screen, 3=multiply, 4=overlay
  uniform int u_flipFgY;

  float overlayCh(float b, float f) {
    return b < 0.5 ? (2.0 * b * f) : (1.0 - 2.0 * (1.0 - b) * (1.0 - f));
  }

  void main() {
    vec4 bg = texture(u_bgTex, v_uv);
    vec2 fgUv = u_flipFgY == 1 ? vec2(v_uv.x, 1.0 - v_uv.y) : v_uv;
    vec4 fg = texture(u_fgTex, fgUv);

    float factor = u_layerOpacity;
    if (u_useMask == 1) {
      factor *= texture(u_maskTex, vec2(v_uv.x, 1.0 - v_uv.y)).a;
    }
    if (u_matteMode != 0) {
      vec4 m = texture(u_matteTex, v_uv);
      float mv = 1.0;
      if (u_matteMode == 1) mv = clamp(m.a, 0.0, 1.0);
      else if (u_matteMode == 2) mv = clamp(1.0 - m.a, 0.0, 1.0);
      else {
        vec3 mRgb = m.a > 1e-4 ? m.rgb / m.a : vec3(0.0);
        float lum = dot(clamp(mRgb, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722)) * clamp(m.a, 0.0, 1.0);
        mv = u_matteMode == 3 ? lum : (1.0 - lum);
      }
      factor *= mv;
    }

    fg *= clamp(factor, 0.0, 1.0);
    float af = clamp(fg.a, 0.0, 1.0);
    float ab = clamp(bg.a, 0.0, 1.0);
    if (af <= 1e-6) {
      outColor = bg;
      return;
    }

    vec3 Cf = af > 1e-5 ? fg.rgb / af : vec3(0.0);
    vec3 Cb = ab > 1e-5 ? bg.rgb / ab : vec3(0.0);
    vec3 CbClamped = clamp(Cb, 0.0, 1.0);
    vec3 CfClamped = clamp(Cf, 0.0, 1.0);

    vec3 B = Cf;
    if (u_blendMode == 1) {
      // Add (Linear Dodge — preserves bright HDR glow/sparks!)
      B = Cb + Cf;
    } else if (u_blendMode == 2) {
      // Screen
      B = vec3(1.0) - (vec3(1.0) - CbClamped) * (vec3(1.0) - CfClamped);
    } else if (u_blendMode == 3) {
      // Multiply
      B = CbClamped * CfClamped;
    } else if (u_blendMode == 4) {
      // Overlay
      B = vec3(
        overlayCh(CbClamped.r, CfClamped.r),
        overlayCh(CbClamped.g, CfClamped.g),
        overlayCh(CbClamped.b, CfClamped.b)
      );
    }

    float aOut = af + ab * (1.0 - af);
    vec3 cOutPre = (1.0 - ab) * fg.rgb + (1.0 - af) * bg.rgb + ab * af * B;
    outColor = vec4(cOutPre, aOut);
  }`;

  // Accumulation & Final Display Shader (for Motion Blur averaging + optional checkerboard / comp background)
  const ACCUM_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_tex;
  uniform float u_weight;
  void main() {
    outColor = texture(u_tex, v_uv) * u_weight;
  }`;

  const PRESENT_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  out vec4 outColor;
  uniform sampler2D u_compTex;
  uniform vec3 u_bgColor;
  uniform int u_showChecker;
  uniform vec2 u_compSize;

  void main() {
    vec4 fg = texture(u_compTex, v_uv);
    vec3 bg = u_bgColor;
    if (u_showChecker == 1) {
      vec2 cell = floor(v_uv * u_compSize / 16.0);
      float chk = mod(cell.x + cell.y, 2.0);
      bg = mix(vec3(0.14, 0.15, 0.18), vec3(0.20, 0.21, 0.25), chk);
    }
    vec3 finalRgb = fg.rgb + bg * (1.0 - clamp(fg.a, 0.0, 1.0));
    outColor = vec4(clamp(finalRgb, 0.0, 1.0), 1.0);
  }`;

  // =========================================================================
  // WEBGL 2 RENDERER CLASS
  // =========================================================================
  class WebGLRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
      if (!gl) throw new Error('当前浏览器不支持 WebGL 2');
      this.gl = gl;

      this.hasColorFloat = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');

      this.showCheckerboard = false;
      this.wireframeOverlay = false;

      this._initPrograms();
      this._initQuadAndDynamicBuffers();
      this._initProceduralEnvCubemap();
      this._initShadowMap(2048);

      // Offscreen Canvas2D for rasterizing crisp 2D Bezier Shapes, Text, and Masks
      this.canvas2d = document.createElement('canvas');
      this.ctx2d = this.canvas2d.getContext('2d');
      this.maskCanvas2d = document.createElement('canvas');
      this.maskCtx2d = this.maskCanvas2d.getContext('2d');

      this.uploadTexA = this._createTex2D(4, 4, false);
      this.uploadTexB = this._createTex2D(4, 4, false);

      // Pooled FBOs by key `"w_h_key"`
      this.fboPool = new Map();
      this.mrt3dPool = new Map();
    }

    _compile(type, src) {
      const gl = this.gl;
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error(`Shader compile error: ${log}`);
      }
      return sh;
    }

    _link(vsSrc, fsSrc) {
      const gl = this.gl;
      const prog = gl.createProgram();
      const vs = this._compile(gl.VERTEX_SHADER, vsSrc);
      const fs = this._compile(gl.FRAGMENT_SHADER, fsSrc);
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
      }
      const uniforms = {};
      const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(prog, i);
        const baseName = info.name.replace(/\[0\]$/, '');
        uniforms[baseName] = gl.getUniformLocation(prog, baseName);
        if (info.size > 1) {
          for (let k = 0; k < info.size; k++) {
            uniforms[`${baseName}[${k}]`] = gl.getUniformLocation(prog, `${baseName}[${k}]`);
          }
        }
      }
      return { prog, u: uniforms };
    }

    _initPrograms() {
      this.progShadow = this._link(SHADOW_VS, SHADOW_FS);
      this.progPbr = this._link(PBR_VS, PBR_FS);
      this.progParticle = this._link(PARTICLE_VS, PARTICLE_FS);
      this.progDof = this._link(QUAD_VS, DOF_FS);
      this.progBlur = this._link(QUAD_VS, BLUR_FS);
      this.progGlowExtract = this._link(QUAD_VS, GLOW_EXTRACT_FS);
      this.progGlowCombine = this._link(QUAD_VS, GLOW_COMBINE_FS);
      this.progDropShadow = this._link(QUAD_VS, DROPSHADOW_FS);
      this.progHsl = this._link(QUAD_VS, HSL_FS);
      this.progComposite = this._link(QUAD_VS, COMPOSITE_FS);
      this.progAccum = this._link(QUAD_VS, ACCUM_FS);
      this.progPresent = this._link(QUAD_VS, PRESENT_FS);
    }

    _initQuadAndDynamicBuffers() {
      const gl = this.gl;
      this.quadVao = gl.createVertexArray();
      gl.bindVertexArray(this.quadVao);
      const qBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, qBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      // Dynamic 3D mesh VAO
      this.meshVao = gl.createVertexArray();
      gl.bindVertexArray(this.meshVao);
      this.meshPosBuf = gl.createBuffer();
      this.meshNrmBuf = gl.createBuffer();
      this.meshUvBuf = gl.createBuffer();
      this.meshIdxBuf = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPosBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshNrmBuf);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUvBuf);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIdxBuf);

      // Dynamic Particle / Trail VAO (pos vec3 + color vec4 + uv vec2 = 9 floats/vertex)
      this.partVao = gl.createVertexArray();
      gl.bindVertexArray(this.partVao);
      this.partBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
      const stride = 9 * 4;
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 28);

      gl.bindVertexArray(null);

      // Reusable plane mesh for 3D flat Shape/Text layers (subdivided 16x16 for accurate intersection & DoF!)
      this.unitPlane16 = Geo3D.createPlaneMesh(1, 1, 16, 16);
    }

    // Generate 6-face Procedural HDR Forge/Studio Cubemap with 6 Roughness Mip Levels!
    _initProceduralEnvCubemap() {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
      const baseSize = 128;
      const mipCount = 6;

      const faceDirs = [
        (u, v) => [1, -v, -u],   // +X
        (u, v) => [-1, -v, u],   // -X
        (u, v) => [u, 1, v],     // +Y (sky up)
        (u, v) => [u, -1, -v],   // -Y (forge floor)
        (u, v) => [u, -v, 1],    // +Z
        (u, v) => [-u, -v, -1]   // -Z
      ];

      for (let mip = 0; mip < mipCount; mip++) {
        const sz = Math.max(4, baseSize >> mip);
        const blur = mip / (mipCount - 1);
        for (let f = 0; f < 6; f++) {
          const data = new Uint8Array(sz * sz * 4);
          for (let y = 0; y < sz; y++) {
            const v = ((y + 0.5) / sz) * 2 - 1;
            for (let x = 0; x < sz; x++) {
              const u = ((x + 0.5) / sz) * 2 - 1;
              const d = Vec3.norm(faceDirs[f](u, v));

              // Cool workshop skylight dome + crisp studio specular panels + warm forge hearth glow below!
              const skyT = clamp(d[1] * 0.5 + 0.5, 0, 1);
              let r = lerp(0.24, 0.34, skyT);
              let g = lerp(0.14, 0.44, skyT);
              let b = lerp(0.10, 0.66, skyT);

              // Studio overhead softbox & rim panel highlights (blurred smoothly on higher roughness mips!)
              const sharpExp = lerp(42.0, 2.2, blur);
              const keyPanel = Math.pow(Math.max(0, Vec3.dot(d, Vec3.norm([0.48, 0.72, -0.5]))), sharpExp);
              const rimPanel = Math.pow(Math.max(0, Vec3.dot(d, Vec3.norm([-0.68, 0.42, 0.6]))), sharpExp * 0.7);
              const hearthGlow = Math.pow(Math.max(0, Vec3.dot(d, Vec3.norm([0.1, -0.78, -0.45]))), lerp(8.0, 1.8, blur));

              const specAtten = lerp(1.0, 0.32, blur);
              r += keyPanel * 1.45 * specAtten + rimPanel * 0.65 * specAtten + hearthGlow * 0.92;
              g += keyPanel * 1.42 * specAtten + rimPanel * 0.85 * specAtten + hearthGlow * 0.38;
              b += keyPanel * 1.38 * specAtten + rimPanel * 1.15 * specAtten + hearthGlow * 0.10;

              // Horizon contrast band for unmistakable metallic reflection curvature!
              const horiz = Math.exp(-Math.abs(d[1] - 0.06) * lerp(14.0, 2.0, blur));
              r *= 1 - 0.38 * horiz * (1 - blur * 0.7);
              g *= 1 - 0.38 * horiz * (1 - blur * 0.7);
              b *= 1 - 0.34 * horiz * (1 - blur * 0.7);

              const idx = (y * sz + x) * 4;
              data[idx]     = clamp(Math.round((r / (1 + r * 0.35)) * 255), 0, 255);
              data[idx + 1] = clamp(Math.round((g / (1 + g * 0.35)) * 255), 0, 255);
              data[idx + 2] = clamp(Math.round((b / (1 + b * 0.35)) * 255), 0, 255);
              data[idx + 3] = 255;
            }
          }
          gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, mip, gl.RGBA8, sz, sz, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        }
      }

      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
      this.envCubeTex = tex;
    }

    _initShadowMap(size = 2048) {
      const gl = this.gl;
      this.shadowSize = size;
      this.shadowTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.shadowFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    _createTex2D(w, h, hdr = false) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (hdr && this.hasColorFloat) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }

    _getFBO(slotName, w, h, hdr = true) {
      const key = `${slotName}_${w}_${h}_${hdr ? 1 : 0}`;
      if (this.fboPool.has(key)) return this.fboPool.get(key);

      const gl = this.gl;
      const tex = this._createTex2D(w, h, hdr);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const entry = { fbo, tex, w, h };
      this.fboPool.set(key, entry);
      return entry;
    }

    _get3DMRT(slotName, w, h) {
      const key = `${slotName}_${w}_${h}`;
      if (this.mrt3dPool.has(key)) return this.mrt3dPool.get(key);

      const gl = this.gl;
      const colorTex = this._createTex2D(w, h, true);

      const depthValTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, depthValTex);
      if (this.hasColorFloat) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const depthRb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, depthValTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const entry = { fbo, colorTex, depthValTex, w, h };
      this.mrt3dPool.set(key, entry);
      return entry;
    }

    _drawFullscreenQuad() {
      const gl = this.gl;
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    _uploadCanvasToTex(tex, canvasElem) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasElem);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    }

    _uploadAndDrawMesh(mesh) {
      const gl = this.gl;
      gl.bindVertexArray(this.meshVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPosBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STREAM_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshNrmBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STREAM_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STREAM_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIdxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STREAM_DRAW);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_INT, 0);
    }

    // =========================================================================
    // RASTERIZE 2D SHAPE / TEXT CONTOURS & PUPPET MESHES ON OFFSCREEN CANVAS2D
    // =========================================================================
    _drawContourPathToCtx(ctx, contour) {
      const verts = contour.vertices;
      if (!verts || verts.length === 0) return;
      ctx.moveTo(verts[0].p[0], verts[0].p[1]);
      const segCount = contour.closed ? verts.length : verts.length - 1;
      for (let i = 0; i < segCount; i++) {
        const v0 = verts[i];
        const v1 = verts[(i + 1) % verts.length];
        const ox = v0.out ? v0.out[0] : 0, oy = v0.out ? v0.out[1] : 0;
        const ix = v1.in ? v1.in[0] : 0, iy = v1.in ? v1.in[1] : 0;
        if (Math.abs(ox) < 1e-3 && Math.abs(oy) < 1e-3 && Math.abs(ix) < 1e-3 && Math.abs(iy) < 1e-3) {
          ctx.lineTo(v1.p[0], v1.p[1]);
        } else {
          ctx.bezierCurveTo(v0.p[0] + ox, v0.p[1] + oy, v1.p[0] + ix, v1.p[1] + iy, v1.p[0], v1.p[1]);
        }
      }
      if (contour.closed) ctx.closePath();
    }

    _rasterize2DShapeOrTextToCanvas(layer, t, comp, project, targetCanvas, targetCtx, w, h, localSpaceFor3DPlane = false) {
      if (targetCanvas.width !== w || targetCanvas.height !== h) {
        targetCanvas.width = w;
        targetCanvas.height = h;
      }
      targetCtx.setTransform(1, 0, 0, 1, 0, 0);
      targetCtx.clearRect(0, 0, w, h);

      const ctxObj = { project, comp, layer };

      if (localSpaceFor3DPlane) {
        // Center at (w/2, h/2) so 3D plane of size (w, h) maps local (0, 0) to center!
        targetCtx.translate(w * 0.5, h * 0.5);
      } else {
        const m = Anim.getLayerWorldMatrix(layer, t, comp, project);
        // Apply 2D affine columns of m: x' = m[0]*x + m[4]*y + m[12], y' = m[1]*x + m[5]*y + m[13]
        targetCtx.setTransform(m[0], m[1], m[4], m[5], m[12], m[13]);
      }

      if (layer.type === 'shape' && layer.shapeData) {
        const sd = layer.shapeData;
        const { contours, mesh2d } = SceneEval.evalShapeLayerContours(layer, t, comp, project);
        if (contours.length === 0) return false;

        if (sd.fillEnabled !== false) {
          const fc = Anim.evalProp(sd.fillColor, t, { ...ctxObj, propKey: 'fillColor' });
          const fo = clamp((Anim.evalProp(sd.fillOpacity, t, { ...ctxObj, propKey: 'fillOpacity' }) ?? 100) / 100, 0, 1);
          targetCtx.fillStyle = rgbToCss(fc, fo);
          targetCtx.beginPath();
          for (const c of contours) {
            if (c.closed) this._drawContourPathToCtx(targetCtx, c);
          }
          targetCtx.fill(sd.fillRule || 'evenodd');

          // Optional visible triangulated mesh wireframe when layer.shapeData.triangulateMesh is enabled & wireframe toggle on
          if (mesh2d && (sd.showMeshWire || this.wireframeOverlay)) {
            targetCtx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
            targetCtx.lineWidth = 1;
            targetCtx.beginPath();
            for (let i = 0; i < mesh2d.indices.length; i += 3) {
              const a = mesh2d.vertices[mesh2d.indices[i]];
              const b = mesh2d.vertices[mesh2d.indices[i + 1]];
              const c = mesh2d.vertices[mesh2d.indices[i + 2]];
              targetCtx.moveTo(a[0], a[1]);
              targetCtx.lineTo(b[0], b[1]);
              targetCtx.lineTo(c[0], c[1]);
              targetCtx.closePath();
            }
            targetCtx.stroke();
          }
        }

        if (sd.strokeEnabled) {
          const sc = Anim.evalProp(sd.strokeColor, t, { ...ctxObj, propKey: 'strokeColor' });
          const sw = Anim.evalProp(sd.strokeWidth, t, { ...ctxObj, propKey: 'strokeWidth' });
          const so = clamp((Anim.evalProp(sd.strokeOpacity, t, { ...ctxObj, propKey: 'strokeOpacity' }) ?? 100) / 100, 0, 1);
          if (sw > 0.05 && so > 0.002) {
            targetCtx.strokeStyle = rgbToCss(sc, so);
            targetCtx.lineWidth = sw;
            targetCtx.lineCap = sd.lineCap || 'round';
            targetCtx.lineJoin = sd.lineJoin || 'round';
            targetCtx.beginPath();
            for (const c of contours) this._drawContourPathToCtx(targetCtx, c);
            targetCtx.stroke();
          }
        }
        return true;
      }

      if (layer.type === 'text' && layer.textData) {
        const td = layer.textData;
        const evalRes = SceneEval.evalTextLayerContours(layer, t, comp, project);
        const fc = Anim.evalProp(td.fillColor, t, { ...ctxObj, propKey: 'text.fillColor' });
        const sc = Anim.evalProp(td.strokeColor, t, { ...ctxObj, propKey: 'text.strokeColor' });
        const sw = Anim.evalProp(td.strokeWidth, t, { ...ctxObj, propKey: 'text.strokeWidth' });

        if (td.strokeMode) {
          // Calligraphic stroke-by-stroke writing mode!
          const widthPx = td.strokeEnabled && sw > 0.5 ? sw : evalRes.strokeWidthPx;
          targetCtx.strokeStyle = rgbToCss(fc, 1);
          targetCtx.lineWidth = widthPx;
          targetCtx.lineCap = 'round';
          targetCtx.lineJoin = 'round';
          targetCtx.beginPath();
          for (const c of evalRes.contours) this._drawContourPathToCtx(targetCtx, c);
          targetCtx.stroke();
          return evalRes.contours.length > 0;
        }

        // Render per-glyph so per-character Text Animator opacity works seamlessly!
        const glyphs = evalRes.glyphs || [];
        if (glyphs.length > 0 && (!layer.puppetPins || layer.puppetPins.length === 0)) {
          for (const g of glyphs) {
            if (g.opacity <= 0.003 || g.contours.length === 0) continue;
            targetCtx.beginPath();
            for (const c of g.contours) this._drawContourPathToCtx(targetCtx, c);
            if (td.fillEnabled !== false) {
              targetCtx.fillStyle = rgbToCss(fc, g.opacity);
              targetCtx.fill('evenodd');
            }
            if (td.strokeEnabled && sw > 0.05) {
              targetCtx.strokeStyle = rgbToCss(sc, g.opacity);
              targetCtx.lineWidth = sw;
              targetCtx.lineJoin = 'round';
              targetCtx.stroke();
            }
          }
          return true;
        }

        if (evalRes.contours.length > 0) {
          targetCtx.beginPath();
          for (const c of evalRes.contours) this._drawContourPathToCtx(targetCtx, c);
          if (td.fillEnabled !== false) {
            targetCtx.fillStyle = rgbToCss(fc, 1);
            targetCtx.fill('evenodd');
          }
          if (td.strokeEnabled && sw > 0.05) {
            targetCtx.strokeStyle = rgbToCss(sc, 1);
            targetCtx.lineWidth = sw;
            targetCtx.stroke();
          }
          return true;
        }
      }

      return false;
    }

    // Rasterize Layer Masks (with Add / Subtract / Intersect, Inverted, Opacity & GPU Feather!)
    _renderLayerMaskTex(layer, t, comp, project, w, h, depthTag) {
      const masks = (layer.masks || []).filter((m) => m && m.enabled !== false);
      if (masks.length === 0) return null;

      if (this.maskCanvas2d.width !== w || this.maskCanvas2d.height !== h) {
        this.maskCanvas2d.width = w;
        this.maskCanvas2d.height = h;
      }
      const ctx = this.maskCtx2d;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const mMat = Anim.getLayerWorldMatrix(layer, t, comp, project);
      const ctxObj = { project, comp, layer };
      let maxFeather = 0;

      for (let i = 0; i < masks.length; i++) {
        const mk = masks[i];
        const contours = Anim.evalProp(mk.path, t, { ...ctxObj, propKey: `mask${i}.path` }) || [];
        const mop = clamp((Anim.evalProp(mk.opacity, t, { ...ctxObj, propKey: `mask${i}.op` }) ?? 100) / 100, 0, 1);
        const fth = Math.max(0, Anim.evalProp(mk.feather, t, { ...ctxObj, propKey: `mask${i}.fth` }) || 0);
        if (fth > maxFeather) maxFeather = fth;

        // Render single mask to temp composite on maskCanvas2d
        ctx.save();
        const mode = mk.mode || 'add';
        if (i === 0 && mk.inverted) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgba(255,255,255,${mop})`;
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'destination-out';
        } else if (mode === 'subtract') {
          ctx.globalCompositeOperation = mk.inverted ? 'source-over' : 'destination-out';
        } else if (mode === 'intersect') {
          ctx.globalCompositeOperation = mk.inverted ? 'destination-out' : 'destination-in';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }

        ctx.setTransform(mMat[0], mMat[1], mMat[4], mMat[5], mMat[12], mMat[13]);
        ctx.fillStyle = `rgba(255,255,255,${mop})`;
        ctx.beginPath();
        for (const c of contours) this._drawContourPathToCtx(ctx, c);
        ctx.fill('evenodd');
        ctx.restore();
      }

      this._uploadCanvasToTex(this.uploadTexB, this.maskCanvas2d);
      if (maxFeather <= 0.4) {
        return { tex: this.uploadTexB, flipped: false };
      }

      // Apply GPU separable Gaussian blur for smooth Mask Feather!
      const gl = this.gl;
      const blurA = this._getFBO(`mskA_${depthTag}`, w, h, false);
      const blurB = this._getFBO(`mskB_${depthTag}`, w, h, false);

      // Flip Y into blurA first so mask matches FBO space, or blur directly and keep orientation consistent:
      // Note: COMPOSITE_FS reads mask with `vec2(v_uv.x, 1.0 - v_uv.y)`. Canvas upload is top-down, and blurring preserves top-down!
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.progBlur.prog);
      gl.uniform1i(this.progBlur.u.u_tex, 0);
      gl.uniform1f(this.progBlur.u.u_radius, maxFeather);
      gl.uniform1i(this.progBlur.u.u_repeatEdge, 0);

      gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fbo);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.uploadTexB);
      gl.uniform2f(this.progBlur.u.u_dir, 1 / w, 0);
      this._drawFullscreenQuad();

      gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fbo);
      gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
      gl.uniform2f(this.progBlur.u.u_dir, 0, 1 / h);
      this._drawFullscreenQuad();

      return { tex: blurB.tex, flipped: false };
    }

    // Run Reorderable Effects Stack on `srcTex` (already in FBO bottom-up UV orientation) -> returns `{ tex }`
    _applyLayerEffectsStack(effects, srcTex, t, layer, comp, project, w, h, depthTag) {
      const active = (effects || []).filter((e) => e && e.enabled !== false);
      if (active.length === 0) return srcTex;

      const gl = this.gl;
      gl.viewport(0, 0, w, h);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);

      const pingA = this._getFBO(`fxP0_${depthTag}`, w, h, true);
      const pingB = this._getFBO(`fxP1_${depthTag}`, w, h, true);
      const aux1 = this._getFBO(`fxAux1_${depthTag}`, w, h, true);
      const aux2 = this._getFBO(`fxAux2_${depthTag}`, w, h, true);

      let curTex = srcTex;
      let toggle = 0;
      const ctxObj = { project, comp, layer };

      for (let i = 0; i < active.length; i++) {
        const fx = active[i];
        const dst = toggle === 0 ? pingA : pingB;
        toggle = 1 - toggle;
        const p = fx.params || {};

        if (fx.type === 'gaussianBlur') {
          const rad = Math.max(0, Anim.evalProp(p.radius, t, { ...ctxObj, propKey: `fx${i}.rad` }) || 0);
          gl.useProgram(this.progBlur.prog);
          gl.uniform1i(this.progBlur.u.u_tex, 0);
          gl.uniform1f(this.progBlur.u.u_radius, rad);
          gl.uniform1i(this.progBlur.u.u_repeatEdge, p.repeatEdge ? 1 : 0);

          gl.bindFramebuffer(gl.FRAMEBUFFER, aux1.fbo);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, curTex);
          gl.uniform2f(this.progBlur.u.u_dir, 1 / w, 0);
          this._drawFullscreenQuad();

          gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
          gl.bindTexture(gl.TEXTURE_2D, aux1.tex);
          gl.uniform2f(this.progBlur.u.u_dir, 0, 1 / h);
          this._drawFullscreenQuad();
          curTex = dst.tex;
        } else if (fx.type === 'glow') {
          const thresh = clamp(Anim.evalProp(p.threshold, t, { ...ctxObj, propKey: `fx${i}.thr` }) ?? 0.45, 0, 1);
          const rad = Math.max(1, Anim.evalProp(p.radius, t, { ...ctxObj, propKey: `fx${i}.rad` }) ?? 22);
          const inten = Math.max(0, Anim.evalProp(p.intensity, t, { ...ctxObj, propKey: `fx${i}.int` }) ?? 1.1);
          const gCol = Anim.evalProp(p.color, t, { ...ctxObj, propKey: `fx${i}.col` }) || [1, 0.65, 0.25];

          // 1. Extract bright pixels -> aux1
          gl.bindFramebuffer(gl.FRAMEBUFFER, aux1.fbo);
          gl.useProgram(this.progGlowExtract.prog);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, curTex);
          gl.uniform1i(this.progGlowExtract.u.u_tex, 0);
          gl.uniform1f(this.progGlowExtract.u.u_threshold, thresh);
          this._drawFullscreenQuad();

          // 2. Blur H (aux1 -> aux2) & Blur V (aux2 -> aux1)
          gl.useProgram(this.progBlur.prog);
          gl.uniform1i(this.progBlur.u.u_tex, 0);
          gl.uniform1f(this.progBlur.u.u_radius, rad);
          gl.uniform1i(this.progBlur.u.u_repeatEdge, 0);

          gl.bindFramebuffer(gl.FRAMEBUFFER, aux2.fbo);
          gl.bindTexture(gl.TEXTURE_2D, aux1.tex);
          gl.uniform2f(this.progBlur.u.u_dir, 1 / w, 0);
          this._drawFullscreenQuad();

          gl.bindFramebuffer(gl.FRAMEBUFFER, aux1.fbo);
          gl.bindTexture(gl.TEXTURE_2D, aux2.tex);
          gl.uniform2f(this.progBlur.u.u_dir, 0, 1 / h);
          this._drawFullscreenQuad();

          // 3. Combine -> dst
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
          gl.useProgram(this.progGlowCombine.prog);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, curTex);
          gl.uniform1i(this.progGlowCombine.u.u_baseTex, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, aux1.tex);
          gl.uniform1i(this.progGlowCombine.u.u_blurTex, 1);
          gl.uniform3fv(this.progGlowCombine.u.u_glowColor, gCol);
          gl.uniform1f(this.progGlowCombine.u.u_intensity, inten);
          this._drawFullscreenQuad();
          curTex = dst.tex;
        } else if (fx.type === 'dropShadow') {
          const sCol = Anim.evalProp(p.color, t, { ...ctxObj, propKey: `fx${i}.col` }) || [0, 0, 0];
          const sOp = clamp((Anim.evalProp(p.opacity, t, { ...ctxObj, propKey: `fx${i}.op` }) ?? 75) / 100, 0, 1);
          const ang = (Anim.evalProp(p.angle, t, { ...ctxObj, propKey: `fx${i}.ang` }) ?? 135) * DEG2RAD;
          const dist = Anim.evalProp(p.distance, t, { ...ctxObj, propKey: `fx${i}.dst` }) ?? 16;
          const soft = Math.max(0, Anim.evalProp(p.softness, t, { ...ctxObj, propKey: `fx${i}.sft` }) ?? 16);

          // Blur curTex -> aux2
          gl.useProgram(this.progBlur.prog);
          gl.uniform1i(this.progBlur.u.u_tex, 0);
          gl.uniform1f(this.progBlur.u.u_radius, soft);
          gl.uniform1i(this.progBlur.u.u_repeatEdge, 0);

          gl.bindFramebuffer(gl.FRAMEBUFFER, aux1.fbo);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, curTex);
          gl.uniform2f(this.progBlur.u.u_dir, 1 / w, 0);
          this._drawFullscreenQuad();

          gl.bindFramebuffer(gl.FRAMEBUFFER, aux2.fbo);
          gl.bindTexture(gl.TEXTURE_2D, aux1.tex);
          gl.uniform2f(this.progBlur.u.u_dir, 0, 1 / h);
          this._drawFullscreenQuad();

          // Offset in FBO UV space (+X right, -Y down in FBO UV!)
          const dxUv = (Math.cos(ang - Math.PI * 0.5) * dist) / w;
          const dyUv = (-Math.sin(ang - Math.PI * 0.5) * dist) / h;

          gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
          gl.useProgram(this.progDropShadow.prog);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, curTex);
          gl.uniform1i(this.progDropShadow.u.u_baseTex, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, aux2.tex);
          gl.uniform1i(this.progDropShadow.u.u_blurTex, 1);
          gl.uniform2f(this.progDropShadow.u.u_offsetUv, dxUv, dyUv);
          gl.uniform3fv(this.progDropShadow.u.u_shadowColor, sCol);
          gl.uniform1f(this.progDropShadow.u.u_shadowOpacity, sOp);
          this._drawFullscreenQuad();
          curTex = dst.tex;
        } else if (fx.type === 'hsl') {
          const hue = Anim.evalProp(p.hue, t, { ...ctxObj, propKey: `fx${i}.hue` }) || 0;
          const sat = clamp((Anim.evalProp(p.saturation, t, { ...ctxObj, propKey: `fx${i}.sat` }) || 0) / 100, -1, 2);
          const lgt = clamp((Anim.evalProp(p.lightness, t, { ...ctxObj, propKey: `fx${i}.lgt` }) || 0) / 100, -1, 1);

          gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
          gl.useProgram(this.progHsl.prog);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, curTex);
          gl.uniform1i(this.progHsl.u.u_tex, 0);
          gl.uniform1f(this.progHsl.u.u_hueDeg, hue);
          gl.uniform1f(this.progHsl.u.u_sat, sat);
          gl.uniform1f(this.progHsl.u.u_light, lgt);
          this._drawFullscreenQuad();
          curTex = dst.tex;
        }
      }

      return curTex;
    }

    // =========================================================================
    // 3D BIN RENDERER (PBR Meshes, 3D Cutout Planes, Real Shadows, Particles, Trails & DoF)
    // =========================================================================
    _render3DBin(binLayers, comp, tCenter, tSub, project, w, h, depthTag, customView = null) {
      const gl = this.gl;

      // Determine camera time: if active camera has motionBlur ON, use tSub, else tCenter!
      let camprobe = SceneEval.getActiveCameraState(comp, tCenter, project, customView);
      const camT = (!customView?.enabled && camprobe.cameraLayer && camprobe.cameraLayer.motionBlur) ? tSub : tCenter;
      const cam = camT === tCenter ? camprobe : SceneEval.getActiveCameraState(comp, camT, project, customView);

      // Gather active scene lights across the whole composition
      const lights = [];
      let shadowLightIdx = -1;
      for (const l of (comp.layers || [])) {
        if (l.type !== 'light' || l.visible === false || !l.light) continue;
        const lt = l.motionBlur ? tSub : tCenter;
        if (lt < (l.inPoint ?? 0) || lt > (l.outPoint ?? comp.duration)) continue;
        const lCtx = { project, comp, layer: l };
        const wMat = Anim.getLayerWorldMatrix(l, lt, comp, project);
        const lPos = Mat4.transformPoint(wMat, [0, 0, 0]);
        const col = Anim.evalProp(l.light.color, lt, { ...lCtx, propKey: 'lgt.col' }) || [1, 1, 1];
        const inten = Math.max(0, Anim.evalProp(l.light.intensity, lt, { ...lCtx, propKey: 'lgt.int' }) ?? 1);
        const isDir = l.light.lightType === 'directional';
        const target = l.light.target ? Anim.evalProp(l.light.target, lt, { ...lCtx, propKey: 'lgt.tgt' }) : [w * 0.5, h * 0.5, 0];
        const dirToLight = Vec3.norm(Vec3.sub(lPos, target));
        const range = l.light.range ? Anim.evalProp(l.light.range, lt, { ...lCtx, propKey: 'lgt.rng' }) : 1600;

        const idx = lights.length;
        lights.push({
          type: isDir ? 0 : 1,
          posDir: isDir ? dirToLight : lPos,
          pos: lPos,
          target,
          color: Vec3.scale(col, inten),
          range,
          castShadows: l.light.castShadows !== false
        });
        if (shadowLightIdx < 0 && l.light.castShadows !== false) shadowLightIdx = idx;
        if (lights.length >= 6) break;
      }

      // Provide a balanced default studio key + rim light if the comp has zero Light layers!
      if (lights.length === 0) {
        lights.push(
          {
            type: 0,
            posDir: Vec3.norm([0.45, -0.65, -0.72]),
            pos: [w * 0.5 + 400, h * 0.5 - 500, -650],
            target: [w * 0.5, h * 0.5, 0],
            color: [1.35, 1.30, 1.24],
            range: 2000,
            castShadows: true
          },
          {
            type: 0,
            posDir: Vec3.norm([-0.65, -0.2, 0.55]),
            pos: [w * 0.5 - 500, h * 0.5 - 150, 450],
            target: [w * 0.5, h * 0.5, 0],
            color: [0.42, 0.55, 0.78],
            range: 2000,
            castShadows: false
          }
        );
        shadowLightIdx = 0;
      }

      // Prepare renderables in this 3D bin
      const meshItems = [];
      const particleSystems = [];

      for (const l of binLayers) {
        const lt = l.motionBlur ? tSub : tCenter;
        if (lt < (l.inPoint ?? 0) || lt > (l.outPoint ?? comp.duration)) continue;

        if (l.type === 'particle') {
          const sampled = Particles.sampleParticleLayerAtTime(l, lt, comp, project);
          const lOp = clamp((Anim.evalProp(l.transform.opacity, lt, { project, comp, layer: l, propKey: 'op' }) ?? 100) / 100, 0, 1);
          if (sampled.particles.length > 0 && lOp > 0.002) {
            particleSystems.push({ layer: l, sampled, layerOpacity: lOp });
          }
          continue;
        }

        const mesh = SceneEval.getLayerLocalMesh3D(l, lt, comp, project);
        const worldM = Anim.getLayerWorldMatrix(l, lt, comp, project);
        const ctxObj = { project, comp, layer: l };
        const layerOp = clamp((Anim.evalProp(l.transform.opacity, lt, { ...ctxObj, propKey: 'op' }) ?? 100) / 100, 0, 1);
        if (layerOp <= 0.002) continue;

        if (mesh && mesh.indices.length >= 3) {
          const mat = l.material || SceneEval.createDefaultMaterial();
          let baseCol = Anim.evalProp(mat.baseColor, lt, { ...ctxObj, propKey: 'mat.col' }) || [0.75, 0.78, 0.84];
          // Check if Node Graph display node overrides color!
          if (l.type === 'nodeGeo' && comp._lastNodeEval) {
            const disp = comp._lastNodeEval.displays.find((d) => d.targetLayerId === l.id || d.nodeId === l.nodeOutputId) || comp._lastNodeEval.displays[0];
            if (disp && disp.color) baseCol = disp.color;
          }
          const metal = Anim.evalProp(mat.metallic, lt, { ...ctxObj, propKey: 'mat.met' }) ?? 0.85;
          const rough = Anim.evalProp(mat.roughness, lt, { ...ctxObj, propKey: 'mat.rgh' }) ?? 0.3;
          const emCol = Anim.evalProp(mat.emissionColor, lt, { ...ctxObj, propKey: 'mat.emc' }) || [1, 0.4, 0.08];
          const emInt = Anim.evalProp(mat.emissionIntensity, lt, { ...ctxObj, propKey: 'mat.emi' }) ?? 0;
          const matOp = Anim.evalProp(mat.opacity, lt, { ...ctxObj, propKey: 'mat.op' }) ?? 1;

          meshItems.push({
            layer: l,
            mesh,
            worldM,
            normalM: Mat4.transpose(Mat4.invert(worldM)),
            baseColor: baseCol,
            metallic: metal,
            roughness: rough,
            emission: Vec3.scale(emCol, emInt),
            opacity: clamp(layerOp * matOp, 0, 1),
            castShadows: l.castShadows !== false,
            receiveShadows: l.receiveShadows !== false,
            planeTex: null,
            unlitTex: false
          });
        } else if (l.type === 'shape' || l.type === 'text') {
          // Non-extruded 3D Shape / Text Plane! Rasterize in local space onto plane texture so holes & masks pass through!
          const planeTex = this._createOrGetPlaneTex(l.id, w, h);
          const ok = this._rasterize2DShapeOrTextToCanvas(l, lt, comp, project, this.canvas2d, this.ctx2d, w, h, true);
          if (!ok) continue;
          this._uploadCanvasToTex(planeTex, this.canvas2d);

          const scalePlane = Mat4.fromScale(w, h, 1);
          const planeModel = Mat4.multiply(worldM, scalePlane);
          const mat = l.material || SceneEval.createDefaultMaterial();
          meshItems.push({
            layer: l,
            mesh: this.unitPlane16,
            worldM: planeModel,
            normalM: Mat4.transpose(Mat4.invert(worldM)),
            baseColor: [1, 1, 1],
            metallic: Anim.evalProp(mat.metallic, lt, { ...ctxObj, propKey: 'mat.met' }) ?? 0.15,
            roughness: Anim.evalProp(mat.roughness, lt, { ...ctxObj, propKey: 'mat.rgh' }) ?? 0.55,
            emission: [0, 0, 0],
            opacity: layerOp,
            castShadows: l.castShadows !== false,
            receiveShadows: l.receiveShadows !== false,
            planeTex,
            unlitTex: false
          });
        }
      }

      // 1. SHADOW MAP PASS (`2048x2048`)
      let lightVP = Mat4.identity();
      if (shadowLightIdx >= 0 && meshItems.some((m) => m.castShadows)) {
        const sl = lights[shadowLightIdx];
        if (sl.type === 0) {
          // Directional ortho frustum centered on scene
          const eye = Vec3.addScaled(sl.target, sl.posDir, 1100);
          const lView = Mat4.lookAtAE(eye, sl.target, [0, -1, 0]);
          const extent = Math.max(w, h) * 0.62;
          const lProj = Mat4.ortho(-extent, extent, -extent, extent, 80, 2800);
          lightVP = Mat4.multiply(lProj, lView);
        } else {
          // Point light perspective shadow frustum toward scene center!
          const lView = Mat4.lookAtAE(sl.pos, sl.target, [0, -1, 0]);
          const lProj = Mat4.perspective(78, 1.0, 25, Math.max(400, sl.range * 1.5));
          lightVP = Mat4.multiply(lProj, lView);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
        gl.viewport(0, 0, this.shadowSize, this.shadowSize);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.depthFunc(gl.LESS);
        gl.disable(gl.BLEND);
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        gl.useProgram(this.progShadow.prog);
        for (const item of meshItems) {
          if (!item.castShadows || item.opacity < 0.08) continue;
          const mvp = Mat4.multiply(lightVP, item.worldM);
          gl.uniformMatrix4fv(this.progShadow.u.u_lightMVP, false, mvp);
          if (item.planeTex) {
            gl.uniform1i(this.progShadow.u.u_useAlphaTex, 1);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, item.planeTex);
            gl.uniform1i(this.progShadow.u.u_alphaTex, 0);
          } else {
            gl.uniform1i(this.progShadow.u.u_useAlphaTex, 0);
          }
          this._uploadAndDrawMesh(item.mesh);
        }
      }

      // 2. MAIN 3D MRT PASS (Color + Linear Depth)
      const mrt = this._get3DMRT(`mrt3d_${depthTag}`, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mrt.fbo);
      gl.viewport(0, 0, w, h);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const bindPbrCommon = () => {
        gl.useProgram(this.progPbr.prog);
        gl.uniformMatrix4fv(this.progPbr.u.u_view, false, cam.view);
        gl.uniformMatrix4fv(this.progPbr.u.u_proj, false, cam.proj);
        gl.uniformMatrix4fv(this.progPbr.u.u_lightVP, false, lightVP);
        gl.uniform3fv(this.progPbr.u.u_camPos, cam.eye);
        gl.uniform1i(this.progPbr.u.u_numLights, lights.length);
        gl.uniform1i(this.progPbr.u.u_shadowLightIndex, shadowLightIdx);

        for (let i = 0; i < lights.length; i++) {
          gl.uniform1i(this.progPbr.u[`u_lightTypes[${i}]`], lights[i].type);
          gl.uniform3fv(this.progPbr.u[`u_lightPosDir[${i}]`], lights[i].posDir);
          gl.uniform3fv(this.progPbr.u[`u_lightColors[${i}]`], lights[i].color);
          gl.uniform1f(this.progPbr.u[`u_lightRanges[${i}]`], lights[i].range);
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
        gl.uniform1i(this.progPbr.u.u_shadowMap, 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envCubeTex);
        gl.uniform1i(this.progPbr.u.u_envMap, 2);
      };

      bindPbrCommon();

      const opaqueItems = meshItems.filter((it) => it.opacity >= 0.995);
      const transItems = meshItems.filter((it) => it.opacity < 0.995);

      const drawMeshItem = (item) => {
        gl.uniformMatrix4fv(this.progPbr.u.u_model, false, item.worldM);
        gl.uniformMatrix4fv(this.progPbr.u.u_normalMat, false, item.normalM);
        gl.uniform3fv(this.progPbr.u.u_baseColor, item.baseColor);
        gl.uniform1f(this.progPbr.u.u_metallic, item.metallic);
        gl.uniform1f(this.progPbr.u.u_roughness, item.roughness);
        gl.uniform3fv(this.progPbr.u.u_emission, item.emission);
        gl.uniform1f(this.progPbr.u.u_opacity, item.opacity);
        gl.uniform1i(this.progPbr.u.u_receiveShadows, item.receiveShadows ? 1 : 0);
        if (item.planeTex) {
          gl.uniform1i(this.progPbr.u.u_useTex, 1);
          gl.uniform1i(this.progPbr.u.u_unlitTex, item.unlitTex ? 1 : 0);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, item.planeTex);
          gl.uniform1i(this.progPbr.u.u_albedoTex, 0);
        } else {
          gl.uniform1i(this.progPbr.u.u_useTex, 0);
          gl.uniform1i(this.progPbr.u.u_unlitTex, 0);
        }
        this._uploadAndDrawMesh(item.mesh);
      };

      for (const item of opaqueItems) drawMeshItem(item);

      // 3. TRANSPARENT MESHES + DEPTH-SORTED 3D PARTICLES & TRAILS (against opaque Z-buffer!)
      if (transItems.length > 0 || particleSystems.length > 0) {
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        // Only blend COLOR_ATTACHMENT0 (keep depth attachment unblended!)
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // Sort semi-transparent mesh items back-to-front by center view-Z
        transItems.sort((a, b) => {
          const za = Mat4.transformPoint(cam.view, Mat4.transformPoint(a.worldM, [0, 0, 0]))[2];
          const zb = Mat4.transformPoint(cam.view, Mat4.transformPoint(b.worldM, [0, 0, 0]))[2];
          return za - zb; // More negative z is farther away -> draw first!
        });
        for (const item of transItems) drawMeshItem(item);

        // Render 3D Particle Trails & Billboards!
        if (particleSystems.length > 0) {
          this._renderParticleSystems3D(particleSystems, cam);
        }
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      // 4. PER-PIXEL DEPTH-OF-FIELD PASS (if camera.aperture > 0.05)
      if (cam.aperture > 0.05) {
        const dofOut = this._getFBO(`dof_${depthTag}`, w, h, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, dofOut.fbo);
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(this.progDof.prog);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mrt.colorTex);
        gl.uniform1i(this.progDof.u.u_colorTex, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, mrt.depthValTex);
        gl.uniform1i(this.progDof.u.u_depthTex, 1);
        gl.uniform1f(this.progDof.u.u_focusDist, cam.focusDistance);
        gl.uniform1f(this.progDof.u.u_aperture, cam.aperture);
        gl.uniform2f(this.progDof.u.u_texelSize, 1 / w, 1 / h);
        this._drawFullscreenQuad();
        return dofOut.tex;
      }

      return mrt.colorTex;
    }

    _createOrGetPlaneTex(id, w, h) {
      if (!this._planeTexMap) this._planeTexMap = new Map();
      const key = `${id}`;
      let tex = this._planeTexMap.get(key);
      if (!tex) {
        tex = this._createTex2D(w, h, false);
        this._planeTexMap.set(key, tex);
      }
      return tex;
    }

    _renderParticleSystems3D(particleSystems, cam) {
      const gl = this.gl;
      gl.useProgram(this.progParticle.prog);
      gl.uniformMatrix4fv(this.progParticle.u.u_view, false, cam.view);
      gl.uniformMatrix4fv(this.progParticle.u.u_proj, false, cam.proj);

      // Camera right & up vectors in world space for billboards:
      const camRight = [cam.view[0], cam.view[4], cam.view[8]];
      const camUp = [cam.view[1], cam.view[5], cam.view[9]];

      for (const sys of particleSystems) {
        const { particles, pd } = sys.sampled;
        const lOp = sys.layerOpacity;
        const isAdd = sys.layer.blendMode === 'add' || sys.layer.blendMode === 'screen' || pd.additiveGlow !== false;
        if (isAdd) {
          // Additive luminous sparks while preserving alpha for 2D compositing!
          gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        } else {
          gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }

        // Depth-sort particles back-to-front in camera view space
        const sorted = particles.slice().sort((a, b) => {
          const za = cam.view[2] * a.pos[0] + cam.view[6] * a.pos[1] + cam.view[10] * a.pos[2] + cam.view[14];
          const zb = cam.view[2] * b.pos[0] + cam.view[6] * b.pos[1] + cam.view[10] * b.pos[2] + cam.view[14];
          return za - zb;
        });

        // A. Render 3D Trajectory Trails first!
        if (pd.trailsEnabled !== false) {
          const trailFloats = [];
          const wScale = pd.trailWidth ?? 0.68;
          const fadePow = pd.trailFade ?? 0.85;

          for (const p of sorted) {
            const tr = p.trail;
            if (!tr || tr.length < 2) continue;
            for (let k = 0; k < tr.length - 1; k++) {
              const p0 = tr[k], p1 = tr[k + 1];
              const seg = Vec3.sub(p1, p0);
              const sLen = Vec3.len(seg);
              if (sLen < 0.05) continue;
              const toCam = Vec3.sub(cam.eye, p0);
              const side = Vec3.norm(Vec3.cross(seg, toCam));
              const f0 = Math.pow((k) / (tr.length - 1), 1 + fadePow);
              const f1 = Math.pow((k + 1) / (tr.length - 1), 1 + fadePow);
              const r0 = p.radius * wScale * (0.25 + 0.75 * f0);
              const r1 = p.radius * wScale * (0.25 + 0.75 * f1);
              const a0 = p.alpha * lOp * f0 * 0.78;
              const a1 = p.alpha * lOp * f1 * 0.78;
              const c = p.color;

              const v00 = Vec3.addScaled(p0, side, -r0);
              const v01 = Vec3.addScaled(p0, side, r0);
              const v10 = Vec3.addScaled(p1, side, -r1);
              const v11 = Vec3.addScaled(p1, side, r1);

              // Tri 1 & Tri 2 (9 floats per vertex)
              trailFloats.push(
                v00[0], v00[1], v00[2], c[0], c[1], c[2], a0, 0, 0,
                v01[0], v01[1], v01[2], c[0], c[1], c[2], a0, 0, 1,
                v11[0], v11[1], v11[2], c[0], c[1], c[2], a1, 1, 1,
                v00[0], v00[1], v00[2], c[0], c[1], c[2], a0, 0, 0,
                v11[0], v11[1], v11[2], c[0], c[1], c[2], a1, 1, 1,
                v10[0], v10[1], v10[2], c[0], c[1], c[2], a1, 1, 0
              );
            }
          }

          if (trailFloats.length > 0) {
            gl.uniform1i(this.progParticle.u.u_isRibbon, 1);
            gl.bindVertexArray(this.partVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(trailFloats), gl.STREAM_DRAW);
            gl.drawArrays(gl.TRIANGLES, 0, trailFloats.length / 9);
          }
        }

        // B. Render 3D Particle Billboards!
        const partFloats = new Float32Array(sorted.length * 6 * 9);
        let ptr = 0;
        for (const p of sorted) {
          const r = p.radius;
          const rx = camRight[0] * r, ry = camRight[1] * r, rz = camRight[2] * r;
          const ux = camUp[0] * r, uy = camUp[1] * r, uz = camUp[2] * r;
          const px = p.pos[0], py = p.pos[1], pz = p.pos[2];
          const c0 = p.color[0], c1 = p.color[1], c2 = p.color[2];
          const a = p.alpha * lOp;

          const pBL = [px - rx - ux, py - ry - uy, pz - rz - uz];
          const pBR = [px + rx - ux, py + ry - uy, pz + rz - uz];
          const pTR = [px + rx + ux, py + ry + uy, pz + rz + uz];
          const pTL = [px - rx + ux, py - ry + uy, pz - rz + uz];

          const pushV = (pt, u, v) => {
            partFloats[ptr++] = pt[0]; partFloats[ptr++] = pt[1]; partFloats[ptr++] = pt[2];
            partFloats[ptr++] = c0; partFloats[ptr++] = c1; partFloats[ptr++] = c2; partFloats[ptr++] = a;
            partFloats[ptr++] = u; partFloats[ptr++] = v;
          };
          pushV(pBL, 0, 0); pushV(pBR, 1, 0); pushV(pTR, 1, 1);
          pushV(pBL, 0, 0); pushV(pTR, 1, 1); pushV(pTL, 0, 1);
        }

        if (ptr > 0) {
          gl.uniform1i(this.progParticle.u.u_isRibbon, 0);
          gl.bindVertexArray(this.partVao);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
          gl.bufferData(gl.ARRAY_BUFFER, partFloats.subarray(0, ptr), gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, ptr / 9);
        }
      }
    }

    // =========================================================================
    // RENDER A SINGLE 2D LAYER INTO AN FBO TEXTURE (for Track Matte or Compositing)
    // =========================================================================
    _renderSingle2DLayerRaw(layer, comp, t, project, w, h, depthTag, recursionDepth) {
      const gl = this.gl;

      if (layer.type === 'precomp') {
        const subComp = project.compositions.find((c) => c.id === layer.compId);
        if (!subComp || recursionDepth >= 5) return null;
        const innerT = SceneEval.evalPrecompInnerTime(layer, t, comp, subComp, project);
        const subTex = this._renderCompositionToFBO(subComp, innerT, project, recursionDepth + 1, null);

        // Apply Pre-comp layer's own 2D transform if non-identity!
        const worldM = Anim.getLayerWorldMatrix(layer, t, comp, project);
        // Check if identity centered at [w/2, h/2] with anchor [w/2, h/2]:
        const isIdentity =
          Math.abs(worldM[0] - 1) < 1e-4 && Math.abs(worldM[5] - 1) < 1e-4 &&
          Math.abs(worldM[1]) < 1e-4 && Math.abs(worldM[4]) < 1e-4 &&
          Math.abs(worldM[12]) < 0.5 && Math.abs(worldM[13]) < 0.5;
        if (isIdentity && subComp.width === w && subComp.height === h) {
          return { tex: subTex, flipY: false };
        }

        // Transform precomp quad into FBO using 2D ortho matrix!
        const xformFbo = this._getFBO(`preXf_${layer.id}_${depthTag}`, w, h, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, xformFbo.fbo);
        gl.viewport(0, 0, w, h);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use PBR unlit plane pass in ortho comp space!
        const orthoProj = Mat4.ortho(0, w, h, 0, -1000, 1000);
        const quadModel = Mat4.multiply(
          worldM,
          Mat4.multiply(Mat4.fromTranslation(subComp.width * 0.5, subComp.height * 0.5, 0), Mat4.fromScale(subComp.width, subComp.height, 1))
        );
        gl.useProgram(this.progPbr.prog);
        gl.uniformMatrix4fv(this.progPbr.u.u_view, false, Mat4.identity());
        gl.uniformMatrix4fv(this.progPbr.u.u_proj, false, orthoProj);
        gl.uniformMatrix4fv(this.progPbr.u.u_model, false, quadModel);
        gl.uniformMatrix4fv(this.progPbr.u.u_normalMat, false, Mat4.identity());
        gl.uniform1f(this.progPbr.u.u_opacity, 1.0);
        gl.uniform1i(this.progPbr.u.u_useTex, 1);
        gl.uniform1i(this.progPbr.u.u_unlitTex, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, subTex);
        // Wait: subTex is already bottom-up FBO, whereas PBR_FS flips v_uv.y (`1.0 - v_uv.y`); scale Y by -1 so it stays right-side up!
        const fixedModel = Mat4.multiply(
          worldM,
          Mat4.multiply(Mat4.fromTranslation(subComp.width * 0.5, subComp.height * 0.5, 0), Mat4.fromScale(subComp.width, -subComp.height, 1))
        );
        gl.uniformMatrix4fv(this.progPbr.u.u_model, false, fixedModel);
        gl.uniform1i(this.progPbr.u.u_albedoTex, 0);
        this._uploadAndDrawMesh(this.unitPlane16);
        return { tex: xformFbo.tex, flipY: false };
      }

      if (layer.type === 'shape' || layer.type === 'text') {
        const hasContent = this._rasterize2DShapeOrTextToCanvas(layer, t, comp, project, this.canvas2d, this.ctx2d, w, h, false);
        if (!hasContent) return null;
        this._uploadCanvasToTex(this.uploadTexA, this.canvas2d);

        // Copy flipped into an FBO so Effects Stack runs in standard bottom-up FBO UV space!
        const lFbo = this._getFBO(`raw2d_${depthTag}`, w, h, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, lFbo.fbo);
        gl.viewport(0, 0, w, h);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.progComposite.prog);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, lFbo.tex); // empty bg
        const zeroBg = this._getFBO(`zero_${depthTag}`, w, h, false);
        gl.bindFramebuffer(gl.FRAMEBUFFER, zeroBg.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindFramebuffer(gl.FRAMEBUFFER, lFbo.fbo);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, zeroBg.tex);
        gl.uniform1i(this.progComposite.u.u_bgTex, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.uploadTexA);
        gl.uniform1i(this.progComposite.u.u_fgTex, 1);
        gl.uniform1f(this.progComposite.u.u_layerOpacity, 1.0);
        gl.uniform1i(this.progComposite.u.u_useMask, 0);
        gl.uniform1i(this.progComposite.u.u_matteMode, 0);
        gl.uniform1i(this.progComposite.u.u_blendMode, 0);
        gl.uniform1i(this.progComposite.u.u_flipFgY, 1);
        this._drawFullscreenQuad();
        return { tex: lFbo.tex, flipY: false };
      }

      return null;
    }

    _blendModeToInt(mode) {
      switch (mode) {
        case 'add': return 1;
        case 'screen': return 2;
        case 'multiply': return 3;
        case 'overlay': return 4;
        default: return 0;
      }
    }

    _matteModeToInt(mode) {
      switch (mode) {
        case 'alpha': return 1;
        case 'alpha_inv': return 2;
        case 'luma': return 3;
        case 'luma_inv': return 4;
        default: return 0;
      }
    }

    // Composite one sub-frame sample of `comp` at `(tCenter, tSub)` into an FBO texture!
    _renderCompSingleSample(comp, tCenter, tSub, project, recursionDepth, customView = null) {
      const gl = this.gl;
      const w = comp.width;
      const h = comp.height;
      const depthTag = `d${recursionDepth}`;

      // Pre-evaluate Node Graph at tSub (or tCenter) so nodeGeo/emitters/colliders are up to date
      if (comp.nodeGraph && comp.nodeGraph.nodes && comp.nodeGraph.nodes.length > 0) {
        Nodes.evaluateNodeGraph(comp.nodeGraph, tSub, comp, project);
      }

      const accumA = this._getFBO(`compA_${depthTag}`, w, h, true);
      const accumB = this._getFBO(`compB_${depthTag}`, w, h, true);
      let curAccum = accumA;
      let nextAccum = accumB;

      gl.bindFramebuffer(gl.FRAMEBUFFER, curAccum.fbo);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const layers = comp.layers || [];
      const hasSolo = layers.some((l) => l.solo && l.visible !== false);

      // Identify layers implicitly used ONLY as Track Matte sources (layer immediately above a track-matted layer)
      const matteSourceIds = new Set();
      for (let i = 0; i < layers.length; i++) {
        const tm = layers[i].trackMatte;
        if (tm && tm.mode && tm.mode !== 'none') {
          if (tm.sourceLayerId) matteSourceIds.add(tm.sourceLayerId);
          else if (i > 0) matteSourceIds.add(layers[i - 1].id);
        }
      }

      // Traverse bottom-to-top (`i = layers.length - 1` down to `0`)!
      // Group consecutive 3D layers into unified 3D bins so solids, planes, particles & trails occlude in shared 3D space!
      let i = layers.length - 1;
      while (i >= 0) {
        const l = layers[i];
        if (
          l.visible === false ||
          l.isGuideParent ||
          (hasSolo && !l.solo) ||
          l.type === 'audio' ||
          l.type === 'null' ||
          l.type === 'camera' ||
          l.type === 'light' ||
          l.type === 'field' ||
          (matteSourceIds.has(l.id) && l.autoHideAsMatte !== false && !l.keepVisibleAsMatte)
        ) {
          i--;
          continue;
        }

        const lt = l.motionBlur ? tSub : tCenter;
        if (lt < (l.inPoint ?? 0) || lt > (l.outPoint ?? comp.duration)) {
          i--;
          continue;
        }

        // Case 1: 3D Bin (gather consecutive visible 3D layers going upward!)
        if (l.threeD && l.type !== 'adjustment') {
          const bin = [l];
          let j = i - 1;
          while (j >= 0) {
            const cand = layers[j];
            if (cand.type === 'camera' || cand.type === 'light' || cand.type === 'field' || cand.type === 'null' || cand.type === 'audio') {
              j--;
              continue;
            }
            if (!cand.threeD || cand.type === 'adjustment') break;
            if (cand.visible !== false && (!hasSolo || cand.solo) && !matteSourceIds.has(cand.id)) {
              bin.push(cand);
            }
            j--;
          }
          i = j;

          let binTex = this._render3DBin(bin, comp, tCenter, tSub, project, w, h, `${depthTag}_b${i}`, customView);
          // If the single/top 3D layer has 2D Effects or Masks, apply them too!
          if (bin.length === 1) {
            const only3D = bin[0];
            const onlyT = only3D.motionBlur ? tSub : tCenter;
            if (only3D.effects && only3D.effects.length > 0) {
              binTex = this._applyLayerEffectsStack(only3D.effects, binTex, onlyT, only3D, comp, project, w, h, `${depthTag}_3dfx`);
            }
            const maskRes = this._renderLayerMaskTex(only3D, onlyT, comp, project, w, h, `${depthTag}_3dm`);
            this._compositeForeground(curAccum, nextAccum, binTex, 1.0, only3D.blendMode, maskRes, null, 0, w, h);
          } else {
            this._compositeForeground(curAccum, nextAccum, binTex, 1.0, 'normal', null, null, 0, w, h);
          }
          const swap = curAccum; curAccum = nextAccum; nextAccum = swap;
          continue;
        }

        // Case 2: Adjustment Layer (`调整层` — processes composited result below, bounded by own Masks, Matte & Opacity!)
        if (l.type === 'adjustment') {
          const op = clamp((Anim.evalProp(l.transform.opacity, lt, { project, comp, layer: l, propKey: 'op' }) ?? 100) / 100, 0, 1);
          if (op > 0.002 && l.effects && l.effects.length > 0) {
            const effectedTex = this._applyLayerEffectsStack(l.effects, curAccum.tex, lt, l, comp, project, w, h, `${depthTag}_adj`);
            const maskRes = this._renderLayerMaskTex(l, lt, comp, project, w, h, `${depthTag}_adjm`);
            const matteInfo = this._resolveTrackMatte(l, i, layers, comp, lt, project, w, h, `${depthTag}_adjmt`, recursionDepth);
            this._compositeForeground(
              curAccum, nextAccum, effectedTex, op, l.blendMode || 'normal',
              maskRes, matteInfo ? matteInfo.tex : null, matteInfo ? matteInfo.modeInt : 0, w, h
            );
            const swap = curAccum; curAccum = nextAccum; nextAccum = swap;
          }
          i--;
          continue;
        }

        // Case 3: Standard 2D Layer (`shape`, `text`, `precomp`)
        const raw = this._renderSingle2DLayerRaw(l, comp, lt, project, w, h, `${depthTag}_l${i}`, recursionDepth);
        if (raw) {
          const op = clamp((Anim.evalProp(l.transform.opacity, lt, { project, comp, layer: l, propKey: 'op' }) ?? 100) / 100, 0, 1);
          let fgTex = this._applyLayerEffectsStack(l.effects, raw.tex, lt, l, comp, project, w, h, `${depthTag}_fx${i}`);
          const maskRes = this._renderLayerMaskTex(l, lt, comp, project, w, h, `${depthTag}_mk${i}`);
          const matteInfo = this._resolveTrackMatte(l, i, layers, comp, lt, project, w, h, `${depthTag}_tm${i}`, recursionDepth);

          this._compositeForeground(
            curAccum, nextAccum, fgTex, op, l.blendMode || 'normal',
            maskRes, matteInfo ? matteInfo.tex : null, matteInfo ? matteInfo.modeInt : 0, w, h
          );
          const swap = curAccum; curAccum = nextAccum; nextAccum = swap;
        }
        i--;
      }

      return curAccum.tex;
    }

    _resolveTrackMatte(layer, layerIdx, layers, comp, t, project, w, h, tag, recursionDepth) {
      const tm = layer.trackMatte;
      if (!tm || !tm.mode || tm.mode === 'none') return null;
      const modeInt = this._matteModeToInt(tm.mode);
      if (modeInt === 0) return null;

      let matteLayer = null;
      if (tm.sourceLayerId) {
        matteLayer = layers.find((x) => x.id === tm.sourceLayerId);
      } else if (layerIdx > 0) {
        matteLayer = layers[layerIdx - 1];
      }
      if (!matteLayer) return null;

      if (t < (matteLayer.inPoint ?? 0) || t > (matteLayer.outPoint ?? comp.duration)) {
        // Outside matte layer's duration -> matte is transparent (0)!
        const emptyM = this._getFBO(`emptyMat_${tag}`, w, h, false);
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, emptyM.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return { tex: emptyM.tex, modeInt };
      }

      const raw = this._renderSingle2DLayerRaw(matteLayer, comp, t, project, w, h, `mat_${tag}`, recursionDepth);
      if (!raw) return null;
      const fxTex = this._applyLayerEffectsStack(matteLayer.effects, raw.tex, t, matteLayer, comp, project, w, h, `matfx_${tag}`);
      return { tex: fxTex, modeInt };
    }

    _compositeForeground(bgFbo, dstFbo, fgTex, opacity, blendModeStr, maskRes, matteTex, matteModeInt, w, h) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo.fbo);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      gl.useProgram(this.progComposite.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bgFbo.tex);
      gl.uniform1i(this.progComposite.u.u_bgTex, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fgTex);
      gl.uniform1i(this.progComposite.u.u_fgTex, 1);

      if (maskRes) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, maskRes.tex);
        gl.uniform1i(this.progComposite.u.u_maskTex, 2);
        gl.uniform1i(this.progComposite.u.u_useMask, 1);
      } else {
        gl.uniform1i(this.progComposite.u.u_useMask, 0);
      }

      if (matteTex && matteModeInt !== 0) {
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, matteTex);
        gl.uniform1i(this.progComposite.u.u_matteTex, 3);
        gl.uniform1i(this.progComposite.u.u_matteMode, matteModeInt);
      } else {
        gl.uniform1i(this.progComposite.u.u_matteMode, 0);
      }

      gl.uniform1f(this.progComposite.u.u_layerOpacity, opacity);
      gl.uniform1i(this.progComposite.u.u_blendMode, this._blendModeToInt(blendModeStr));
      gl.uniform1i(this.progComposite.u.u_flipFgY, 0);
      this._drawFullscreenQuad();
    }

    // Render Composition into FBO with true Shutter-Interval Motion Blur (Section 2.10)!
    _renderCompositionToFBO(comp, t, project, recursionDepth = 0, customView = null) {
      const w = comp.width;
      const h = comp.height;
      const mb = comp.motionBlur || { enabled: false, shutterAngle: 180, shutterPhase: -90, samples: 7 };
      const anyLayerMB = mb.enabled && (comp.layers || []).some((l) => l.visible !== false && l.motionBlur);

      if (!anyLayerMB || (mb.shutterAngle ?? 180) <= 1) {
        return this._renderCompSingleSample(comp, t, t, project, recursionDepth, customView);
      }

      const gl = this.gl;
      const nSamples = clamp(Math.round(mb.samples || 7), 3, 13);
      const dtFrame = 1 / Math.max(1, comp.fps || 30);
      const tStart = t + ((mb.shutterPhase ?? -90) / 360) * dtFrame;
      const tSpan = ((mb.shutterAngle ?? 180) / 360) * dtFrame;

      const mbAccum = this._getFBO(`mbAccum_d${recursionDepth}`, w, h, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mbAccum.fbo);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const weight = 1 / nSamples;
      for (let s = 0; s < nSamples; s++) {
        const frac = nSamples > 1 ? s / (nSamples - 1) : 0.5;
        const tSub = Math.max(0, tStart + frac * tSpan);
        const sampleTex = this._renderCompSingleSample(comp, t, tSub, project, recursionDepth, customView);

        gl.bindFramebuffer(gl.FRAMEBUFFER, mbAccum.fbo);
        gl.viewport(0, 0, w, h);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(this.progAccum.prog);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sampleTex);
        gl.uniform1i(this.progAccum.u.u_tex, 0);
        gl.uniform1f(this.progAccum.u.u_weight, weight);
        this._drawFullscreenQuad();
        gl.disable(gl.BLEND);
      }

      return mbAccum.tex;
    }

    // PUBLIC ENTRY: Render Composition onto `#gl-canvas`!
    renderComposition(comp, t, project, customView = null) {
      const gl = this.gl;
      if (!comp) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.055, 0.062, 0.082, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }

      if (this.canvas.width !== comp.width || this.canvas.height !== comp.height) {
        this.canvas.width = comp.width;
        this.canvas.height = comp.height;
      }

      const finalTex = this._renderCompositionToFBO(comp, t, project, 0, customView);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      gl.useProgram(this.progPresent.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, finalTex);
      gl.uniform1i(this.progPresent.u.u_compTex, 0);
      gl.uniform3fv(this.progPresent.u.u_bgColor, comp.bgColor || [0.055, 0.062, 0.082]);
      gl.uniform1i(this.progPresent.u.u_showChecker, this.showCheckerboard ? 1 : 0);
      gl.uniform2f(this.progPresent.u.u_compSize, comp.width, comp.height);
      this._drawFullscreenQuad();
    }

    finishFrame() {
      this.gl.flush();
      this.gl.finish();
    }
  }

  Forge.Renderer = {
    WebGLRenderer
  };
})();
