// WebGL 2 自定义着色器：五种 Alpha 正确混合模式、可分离高斯模糊、发光、投影、HSL、蒙版/轨道遮罩、景深与运动模糊

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Porter-Duff Alpha 正确的五种混合模式（输入与输出均为 Premultiplied Alpha）
export const COMPOSITE_BLEND_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDst;
uniform sampler2D tSrc;
uniform int uBlendMode; // 0:normal, 1:add, 2:screen, 3:multiply, 4:overlay
uniform float uOpacity;
varying vec2 vUv;

vec3 blendFunc(vec3 cd, vec3 cs, int mode) {
  if (mode == 1) return min(cd + cs, vec3(4.0));
  if (mode == 2) return 1.0 - (1.0 - clamp(cd, 0.0, 1.0)) * (1.0 - clamp(cs, 0.0, 1.0));
  if (mode == 3) return cd * cs;
  if (mode == 4) {
    vec3 lo = 2.0 * cd * cs;
    vec3 hi = 1.0 - 2.0 * (1.0 - clamp(cd, 0.0, 1.0)) * (1.0 - clamp(cs, 0.0, 1.0));
    return mix(lo, hi, step(vec3(0.5), cd));
  }
  return cs;
}

void main() {
  vec4 dst = texture2D(tDst, vUv);
  vec4 src = texture2D(tSrc, vUv) * uOpacity;

  float as = clamp(src.a, 0.0, 1.0);
  float ad = clamp(dst.a, 0.0, 1.0);

  if (as <= 1e-5) {
    gl_FragColor = dst;
    return;
  }

  vec3 cs = src.rgb / as;
  vec3 cd = ad > 1e-5 ? dst.rgb / ad : vec3(0.0);

  vec3 b = blendFunc(cd, cs, uBlendMode);
  float outA = as + ad * (1.0 - as);
  vec3 outPremul = as * (1.0 - ad) * cs + ad * (1.0 - as) * cd + as * ad * b;

  gl_FragColor = vec4(outPremul, outA);
}
`;

// 可分离一维高斯模糊（用于高斯模糊效果、发光扩散、投影柔和度与蒙版羽化）
export const GAUSSIAN_BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uDirection; // (1/w, 0) 或 (0, 1/h)
uniform float uRadius;
varying vec2 vUv;

void main() {
  if (uRadius <= 0.1) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }
  float sigma = max(0.5, uRadius * 0.42);
  float twoSigma2 = 2.0 * sigma * sigma;
  vec4 sum = vec4(0.0);
  float wSum = 0.0;
  // 13-tap 步长自适应覆盖大半径模糊
  float stepScale = max(1.0, uRadius / 10.0);
  for (int i = -10; i <= 10; i++) {
    float x = float(i) * stepScale;
    float w = exp(-(x * x) / twoSigma2);
    vec2 uv = vUv + uDirection * x;
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      sum += texture2D(tDiffuse, uv) * w;
    }
    wSum += w;
  }
  gl_FragColor = sum / max(wSum, 1e-5);
}
`;

// 发光高光提取
export const GLOW_EXTRACT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform vec3 uTint;
varying vec2 vUv;

void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  if (c.a <= 1e-5) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec3 straight = c.rgb / c.a;
  float lum = dot(straight, vec3(0.2126, 0.7152, 0.0722));
  float knee = smoothstep(uThreshold * 0.65, uThreshold + 0.25, lum);
  vec3 bloom = straight * knee * uTint;
  gl_FragColor = vec4(bloom * c.a, c.a * knee);
}
`;

// 发光合成（与原图叠加，向外溢出）
export const GLOW_COMBINE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tBase;
uniform sampler2D tBloom;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  vec4 base = texture2D(tBase, vUv);
  vec4 bloom = texture2D(tBloom, vUv) * uIntensity;
  float outA = clamp(base.a + bloom.a * (1.0 - base.a), 0.0, 1.0);
  vec3 outRGB = base.rgb + bloom.rgb;
  gl_FragColor = vec4(outRGB, outA);
}
`;

// 投影偏移着色与合成
export const DROP_SHADOW_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tBase;
uniform sampler2D tBlurred;
uniform vec2 uOffsetUv;
uniform vec4 uShadowColor;
uniform float uShadowOpacity;
varying vec2 vUv;

void main() {
  vec4 base = texture2D(tBase, vUv);
  vec2 sUv = vUv - uOffsetUv;
  float shAlpha = 0.0;
  if (sUv.x >= 0.0 && sUv.x <= 1.0 && sUv.y >= 0.0 && sUv.y <= 1.0) {
    shAlpha = texture2D(tBlurred, sUv).a;
  }
  float sa = clamp(shAlpha * uShadowColor.a * uShadowOpacity, 0.0, 1.0);
  vec4 shadowPremul = vec4(uShadowColor.rgb * sa, sa);
  // Source-over: base 在上，shadow 在下
  gl_FragColor = base + shadowPremul * (1.0 - base.a);
}
`;

// 色相/饱和度/亮度调节（保留 Premultiplied Alpha）
export const HSL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform float uHue;        // -180 .. 180
uniform float uSaturation; // -100 .. 100
uniform float uLightness;  // -100 .. 100
varying vec2 vUv;

vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  float s = 0.0;
  float h = 0.0;
  if (mx != mn) {
    float d = mx - mn;
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  if (s <= 1e-5) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(hue2rgb(p, q, h + 1.0/3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0/3.0));
}

void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  if (c.a <= 1e-5) { gl_FragColor = vec4(0.0); return; }
  vec3 straight = clamp(c.rgb / c.a, 0.0, 1.0);
  vec3 hsl = rgb2hsl(straight);
  hsl.x = fract(hsl.x + uHue / 360.0);
  hsl.y = clamp(hsl.y * (1.0 + uSaturation / 100.0), 0.0, 1.0);
  float lShift = uLightness / 100.0;
  hsl.z = lShift >= 0.0 ? mix(hsl.z, 1.0, lShift) : mix(hsl.z, 0.0, -lShift);
  vec3 rgb = hsl2rgb(hsl);
  gl_FragColor = vec4(rgb * c.a, c.a);
}
`;

// 蒙版与轨道遮罩应用（支持 Alpha、Luma 及其反转）
export const MASK_MATTE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tLayer;
uniform sampler2D tMatte;
uniform int uMode; // 0:alpha, 1:alphaInv, 2:luma, 3:lumaInv
varying vec2 vUv;

void main() {
  vec4 c = texture2D(tLayer, vUv);
  vec4 m = texture2D(tMatte, vUv);
  float factor = 1.0;
  if (uMode == 0) {
    factor = m.a;
  } else if (uMode == 1) {
    factor = 1.0 - m.a;
  } else if (uMode == 2) {
    vec3 straightM = m.a > 1e-5 ? m.rgb / m.a : vec3(0.0);
    factor = dot(straightM, vec3(0.2126, 0.7152, 0.0722)) * m.a;
  } else if (uMode == 3) {
    vec3 straightM = m.a > 1e-5 ? m.rgb / m.a : vec3(0.0);
    factor = 1.0 - dot(straightM, vec3(0.2126, 0.7152, 0.0722)) * m.a;
  }
  factor = clamp(factor, 0.0, 1.0);
  gl_FragColor = c * factor;
}
`;

// 调整图层选区叠加：将调整后的图像按调整层自身 Alpha 混合回下方合成结果
export const ADJUSTMENT_MERGE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tBelow;
uniform sampler2D tAdjusted;
uniform sampler2D tMaskAlpha;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  vec4 below = texture2D(tBelow, vUv);
  vec4 adj = texture2D(tAdjusted, vUv);
  float maskA = texture2D(tMaskAlpha, vUv).a * uOpacity;
  gl_FragColor = mix(below, adj, clamp(maskA, 0.0, 1.0));
}
`;

// 基于真实 DepthTexture 的物理景深散景着色器
export const DOF_BOKEH_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uFocusDistance;
uniform float uAperture; // 0 = 关闭景深
varying vec2 vUv;

float linearizeDepth(float z) {
  float ndc = z * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / max(1e-4, uFar + uNear - ndc * (uFar - uNear));
}

float calcCoC(float depth) {
  if (depth >= uFar * 0.98) {
    // 远背景按无限远或最大模糊处理
    return clamp(uAperture * 0.65, 0.0, 18.0);
  }
  float diff = abs(depth - uFocusDistance);
  float norm = diff / max(20.0, depth * 0.5 + uFocusDistance * 0.5);
  return clamp(norm * uAperture, 0.0, 20.0);
}

void main() {
  vec4 center = texture2D(tColor, vUv);
  if (uAperture <= 0.05) {
    gl_FragColor = center;
    return;
  }

  float centerDepth = linearizeDepth(texture2D(tDepth, vUv).r);
  float centerCoC = calcCoC(centerDepth);
  if (centerCoC < 0.35) {
    // 检查周边前景大散景渗透
    centerCoC = 0.0;
  }

  vec2 texel = 1.0 / uResolution;
  vec4 acc = center;
  float wSum = 1.0;

  // 20 采样黄金角圆盘散景
  const float GOLDEN_ANGLE = 2.39996323;
  float maxR = max(centerCoC, min(14.0, uAperture * 0.45));
  for (int i = 1; i <= 20; i++) {
    float fi = float(i);
    float rFrac = sqrt(fi / 20.0);
    float ang = fi * GOLDEN_ANGLE;
    vec2 dir = vec2(cos(ang), sin(ang));
    float sampleRadius = max(centerCoC, 0.5) * rFrac;
    vec2 suv = clamp(vUv + dir * sampleRadius * texel, vec2(0.001), vec2(0.999));

    float sDepth = linearizeDepth(texture2D(tDepth, suv).r);
    float sCoC = calcCoC(sDepth);
    vec4 sCol = texture2D(tColor, suv);

    // 防止清晰背景渗入清晰前景，但允许近景焦外柔和覆盖
    float w = 0.0;
    if (sDepth < centerDepth) {
      w = smoothstep(0.0, 2.0, sCoC) * (1.0 - smoothstep(sampleRadius - 1.5, sampleRadius + 1.5, abs(sCoC - sampleRadius)));
      w = max(w, centerCoC > 0.5 ? 0.55 : 0.0);
    } else if (centerCoC > 0.35) {
      w = 1.0;
    }

    acc += sCol * w;
    wSum += w;
  }

  gl_FragColor = acc / max(wSum, 1e-5);
}
`;

// 运动模糊累加着色器 & 最终合成输出
export const ACCUMULATE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tAccum;
uniform sampler2D tSample;
uniform float uWeight;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(tAccum, vUv) + texture2D(tSample, vUv) * uWeight;
}
`;

export const FINAL_OUTPUT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tComp;
uniform vec4 uBgColor;
uniform int uTransparentBg;
varying vec2 vUv;

void main() {
  vec4 c = texture2D(tComp, vUv);
  if (uTransparentBg == 1) {
    // 导出直接输出直线/预乘由 canvas alpha 控制
    gl_FragColor = vec4(c.rgb, clamp(c.a, 0.0, 1.0));
  } else {
    vec3 bg = uBgColor.rgb * uBgColor.a;
    vec3 outRgb = c.rgb + bg * (1.0 - clamp(c.a, 0.0, 1.0));
    gl_FragColor = vec4(outRgb, 1.0);
  }
}
`;
