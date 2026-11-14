import * as THREE from 'three';
import {
  BASE_HALF,
  WATER_Y,
  QUAY_Y,
  ENV_UNIFORMS,
  getSeabedY,
  isLandXZ,
} from './state.js';

export function buildWater(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // Planar reflection render targets: main harbor (Y=0) & quay puddle reflection (Y=QUAY_Y)
  const reflectionRT = new THREE.WebGLRenderTarget(1024, 1024, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });
  const puddleRT = new THREE.WebGLRenderTarget(512, 512, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });
  const reflectionCamera = new THREE.PerspectiveCamera(42, 1, 0.2, 350);
  const reflMatrixUniform = new THREE.Matrix4();
  const puddleMatrixUniform = new THREE.Matrix4();

  // Shared GLSL wave + quay SDF + wake helpers
  const WATER_COMMON_GLSL = `
    uniform float uTime;
    uniform float uSunIntensity;
    uniform vec2 uCloudCenter;
    uniform vec2 uCloudRadius;
    uniform vec2 uWindVec;
    uniform float uGustFrontPos;
    uniform float uGustStrength;
    uniform float uRainDensity;
    uniform vec2 uBoat4Pos;
    uniform vec2 uBoat4Dir;
    uniform float uBoat4Speed;

    float waterWaveH(vec2 xz, float t) {
      float w1 = 0.032 * sin(xz.x * 0.68 + xz.y * 0.42 + t * 1.35);
      float w2 = 0.022 * cos(xz.x * 0.51 - xz.y * 0.82 + t * 1.05);
      float w3 = 0.014 * sin(xz.x * 1.35 + xz.y * 1.15 - t * 2.15);
      float gust = uGustStrength * 0.024 * sin((xz.x * 0.9 - xz.y * 0.55) * 1.8 + t * 4.5);
      return w1 + w2 + w3 + gust;
    }

    float sdBox2D(vec2 p, vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }

    // Signed distance to land/quay/breakwater structures (negative inside land, positive in water)
    float quayWaterSDF(vec2 xz) {
      float dWest = sdBox2D(xz - vec2(-12.0, -6.75), vec2(7.0, 12.25));
      float dSouth = sdBox2D(xz - vec2(-7.75, 12.25), vec2(11.25, 6.75));
      float dLand = sdBox2D(xz - vec2(4.45, 9.9), vec2(0.95, 2.3));
      float dSlip = sdBox2D(xz - vec2(4.1, 14.3), vec2(0.85, 1.7)); // slipway waterline around x=4.95
      float dBw = sdBox2D(xz - vec2(-0.65, -11.2), vec2(4.85, 1.4));
      float dPier = length(xz - vec2(4.2, -11.2)) - 2.1;
      return min(min(min(dWest, dSouth), min(dLand, dSlip)), min(dBw, dPier));
    }

    float cloudShadowAt(vec2 xz) {
      vec2 d = (xz - uCloudCenter) / uCloudRadius;
      float r2 = dot(d, d);
      float wisp = 0.14 * sin(xz.x * 0.22 + uTime * 0.15) * cos(xz.y * 0.18 - uTime * 0.11);
      float cov = 1.0 - smoothstep(0.35, 1.15, r2 + wisp);
      return (1.0 - 0.36 * cov) * uSunIntensity;
    }
  `;

  // ---------------------------------------------------------
  // 1. Harbor Water Surface Mesh (Posterized Cel-Shaded Reflections + Foam + Ripples!)
  // ---------------------------------------------------------
  const waterGeo = new THREE.PlaneGeometry(BASE_HALF * 2, BASE_HALF * 2, 132, 132);
  waterGeo.rotateX(-Math.PI / 2);

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: ENV_UNIFORMS.uTime,
      uSunIntensity: ENV_UNIFORMS.uSunIntensity,
      uCloudCenter: ENV_UNIFORMS.uCloudCenter,
      uCloudRadius: ENV_UNIFORMS.uCloudRadius,
      uWindVec: ENV_UNIFORMS.uWindVec,
      uGustFrontPos: ENV_UNIFORMS.uGustFrontPos,
      uGustStrength: ENV_UNIFORMS.uGustStrength,
      uRainDensity: ENV_UNIFORMS.uRainDensity,
      uBoat4Pos: ENV_UNIFORMS.uBoat4Pos,
      uBoat4Dir: ENV_UNIFORMS.uBoat4Dir,
      uBoat4Speed: ENV_UNIFORMS.uBoat4Speed,
      tReflection: { value: reflectionRT.texture },
      uReflVP: { value: reflMatrixUniform },
      uSunDir: ENV_UNIFORMS.uSunDir,
    },
    vertexShader: `
      ${WATER_COMMON_GLSL}
      uniform mat4 uReflVP;
      varying vec3 vWorldPos;
      varying vec4 vReflClip;
      varying vec3 vWaveNorm;

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = waterWaveH(wp.xz, uTime);
        wp.y += h;

        float eps = 0.15;
        float hx = waterWaveH(wp.xz + vec2(eps, 0.0), uTime);
        float hz = waterWaveH(wp.xz + vec2(0.0, eps), uTime);
        vWaveNorm = normalize(vec3(h - hx, eps, h - hz));

        vWorldPos = wp.xyz;
        vReflClip = uReflVP * vec4(wp.x, 0.0, wp.z, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      ${WATER_COMMON_GLSL}
      uniform sampler2D tReflection;
      uniform vec3 uSunDir;
      varying vec3 vWorldPos;
      varying vec4 vReflClip;
      varying vec3 vWaveNorm;

      // Concentric raindrop ripple pattern
      float rainRipples(vec2 xz, float t) {
        float ringSum = 0.0;
        vec2 cell = floor(xz * 0.85);
        vec2 frac = fract(xz * 0.85) - 0.5;
        for (int ox = -1; ox <= 1; ox++) {
          for (int oz = -1; oz <= 1; oz++) {
            vec2 c = cell + vec2(float(ox), float(oz));
            float rnd = fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
            if (rnd > uRainDensity * 0.92) continue;
            float phase = fract(t * (0.42 + rnd * 0.25) + rnd * 6.28);
            vec2 center = vec2(ox, oz) + (vec2(fract(rnd * 19.3), fract(rnd * 41.7)) - 0.5) * 0.7;
            float d = length(frac - center);
            float r = phase * 0.55;
            float band = smoothstep(0.035, 0.0, abs(d - r)) * (1.0 - phase);
            ringSum += band;
          }
        }
        return clamp(ringSum, 0.0, 1.0);
      }

      void main() {
        vec2 xz = vWorldPos.xz;
        float qDist = quayWaterSDF(xz);
        if (qDist < -0.02) discard;

        // Multi-scale crisp wave distortion for fractured anime reflection blocks
        float gustDot = dot(xz, uWindVec);
        float localGust = uGustStrength * exp(-pow((gustDot - uGustFrontPos) * 0.14, 2.0));
        float gustRipple = localGust * sin(gustDot * 5.2 - uTime * 7.5);

        float ripple1 = sin(xz.x * 2.8 + uTime * 1.9 + cos(xz.y * 2.2 - uTime * 1.4));
        float ripple2 = cos(xz.y * 3.4 - uTime * 1.6 + sin(xz.x * 2.5 + uTime * 1.2));
        vec2 distort = vec2(ripple1, ripple2) * 0.022 + vWaveNorm.xz * 0.055 + vec2(gustRipple * 0.015);

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        bool underwaterView = cameraPosition.y < 0.0;

        // Planar reflection UV & posterized color-block quantization (Section 9.4!)
        vec2 reflUv = (vReflClip.xy / max(0.0001, vReflClip.w)) * 0.5 + 0.5 + distort;
        reflUv = clamp(reflUv, 0.004, 0.996);
        vec3 reflCol = texture2D(tReflection, reflUv).rgb;
        float reflLum = dot(reflCol, vec3(0.299, 0.587, 0.114));

        // Posterize reflection into crisp sea-blue, cyan-green, and bright white cel blocks!
        vec3 deepIndigo = vec3(0.11, 0.36, 0.48);
        vec3 cyanBlock  = vec3(0.32, 0.68, 0.72);
        vec3 paleShard  = vec3(0.90, 0.97, 0.98);

        float b1 = smoothstep(0.34, 0.38, reflLum);
        float b2 = smoothstep(0.68, 0.72, reflLum);
        vec3 posterRefl = mix(deepIndigo, cyanBlock, b1);
        posterRefl = mix(posterRefl, paleShard, b2);
        // Subtle hint of reflected object hue while preserving clean flat blocks
        posterRefl = mix(posterRefl, reflCol * 0.85 + vec3(0.12, 0.22, 0.24), 0.22);

        // Base clear sea-glass water body color
        vec3 shallowGlass = vec3(0.36, 0.78, 0.79);
        vec3 midHarbor    = vec3(0.22, 0.60, 0.67);
        float depthMix = smoothstep(0.5, 9.0, qDist);
        vec3 waterBase = mix(shallowGlass, midHarbor, depthMix);

        // Fresnel blend (looking steep down shows seabed clearly; grazing angles show vivid posterized reflections!)
        float fresnel = pow(1.0 - max(abs(dot(vWaveNorm, viewDir)), 0.0), 2.3);
        float reflWeight = underwaterView ? 0.18 : mix(0.32, 0.82, fresnel);
        vec3 col = mix(waterBase, posterRefl, reflWeight);

        // Boat 4 traveling white cel-shaded Kelvin V-wake & scalloped foam chevrons
        float wakeFoam = 0.0;
        if (uBoat4Speed > 0.02) {
          vec2 rel = xz - uBoat4Pos;
          float along = dot(rel, -uBoat4Dir);
          float across = abs(dot(rel, vec2(-uBoat4Dir.y, uBoat4Dir.x)));
          if (along > -0.2 && along < 12.2) {
            float armWiggle = 0.14 * sin(along * 1.9 - uTime * 3.8) + 0.08 * cos(along * 3.4 + across * 2.1);
            float vCone = max(0.25, along * 0.35 + 0.58 + armWiggle);
            float armBreak = 0.55 + 0.45 * smoothstep(-0.25, 0.45, sin(along * 2.2 - uTime * 3.1));
            float outerArm = smoothstep(0.42, 0.12, abs(across - vCone)) * armBreak;
            float innerChev = smoothstep(0.32, 0.08, abs(across - vCone * 0.58)) * smoothstep(0.15, 0.65, sin(along * 2.8 - uTime * 4.2 - across * 1.8));
            float sternWash = smoothstep(0.68, 0.10, across) * smoothstep(0.0, 0.55, sin(along * 3.2 - uTime * 4.5 + across * 2.0));
            float fade = smoothstep(-0.1, 0.6, along) * (1.0 - smoothstep(2.2, 12.2, along)) * uBoat4Speed;
            wakeFoam = clamp((outerArm * 0.92 + innerChev * 0.65 + sternWash * 0.72) * fade, 0.0, 1.0);
          }
        }

        // Crisp anime cel-shaded shore foam along quay walls & tetrapods
        float waveOsc = 0.06 * sin(xz.x * 1.9 + xz.y * 1.5 - uTime * 2.2);
        float shoreBand = smoothstep(0.26, 0.14, qDist + waveOsc);

        // Tetrapod foam surges gently between blocks at SE corner & breakwater tip
        float dPodSE = length(xz - vec2(5.6, 17.5));
        float dPodBW = length(xz - vec2(5.8, -11.8));
        float podRingSE = smoothstep(0.32, 0.10, abs(dPodSE - (1.75 + 0.25 * sin(uTime * 1.8)))) * step(dPodSE, 2.8);
        float podRingBW = smoothstep(0.32, 0.10, abs(dPodBW - (1.85 + 0.25 * cos(uTime * 1.65)))) * step(dPodBW, 3.0);

        // Boat hull waterline foam (elliptical hulls of moored boats 1,2,3 + moving boat 4!)
        float b1d = length((xz - vec2(-1.65, 4.18)) / vec2(2.45, 0.92)) - 1.0;
        float b2d = length((xz - vec2(-3.52, -0.65)) / vec2(1.06, 3.05)) - 1.0;
        float b3d = length((xz - vec2(-3.48, -6.95)) / vec2(1.04, 2.95)) - 1.0;
        // Boat 4 rotated frame
        vec2 b4rel = xz - uBoat4Pos;
        vec2 b4fwd = normalize(uBoat4Dir + vec2(0.0001, 0.0));
        vec2 b4side = vec2(-b4fwd.y, b4fwd.x);
        float b4d = length(vec2(dot(b4rel, b4side) / 1.05, dot(b4rel, b4fwd) / 2.90)) - 1.0;
        float boatEdge = min(min(b1d, b2d), min(b3d, b4d));
        float hullFoam = smoothstep(0.16, 0.02, abs(boatEdge) + waveOsc * 0.25) * step(-0.12, boatEdge);

        // Concentric raindrop ripples
        float rRip = rainRipples(xz, uTime);

        // Organic non-grid jittered sunlight sparkles modulated by drifting cloud shadows!
        float sunMod = cloudShadowAt(xz);
        vec2 spCell = floor(xz * 1.45);
        vec2 spFrac = fract(xz * 1.45) - 0.5;
        vec2 spHash = vec2(
          fract(sin(dot(spCell, vec2(127.1, 311.7))) * 43758.5453),
          fract(sin(dot(spCell, vec2(269.5, 183.3))) * 43758.5453)
        );
        vec2 spCenter = (spHash - 0.5) * 0.72;
        float spDist = length(spFrac - spCenter);
        float spTwinkle = sin(uTime * (3.0 + spHash.x * 3.5) + spHash.y * 24.0);
        float spThreshold = step(0.62, spHash.x) * step(0.45, spTwinkle + localGust * 0.4);
        float sparkle = smoothstep(0.11, 0.02, spDist) * spThreshold * sunMod;

        float totalFoam = clamp(shoreBand * 0.72 + hullFoam * 0.65 + (podRingSE + podRingBW) * 0.8 + wakeFoam * 0.95 + rRip * 0.35, 0.0, 1.0);
        col = mix(col, vec3(0.95, 0.99, 1.0), totalFoam);
        col += vec3(1.0, 0.96, 0.82) * sparkle * 0.85;

        // Subtle cloud shadow dimming on water body
        col *= mix(0.84, 1.04, sunMod);

        float alpha = underwaterView
          ? 0.42
          : clamp(mix(0.44, 0.82, fresnel) + totalFoam * 0.28 + sparkle * 0.15, 0.42, 0.94);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_Y;
  waterMesh.layers.set(1);
  root.add(waterMesh);

  // ---------------------------------------------------------
  // 2. Foreground Concrete Quay Rain Puddle (倒映船只、灯柱和海鸥! — Shot 4!)
  // ---------------------------------------------------------
  const puddleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: ENV_UNIFORMS.uTime,
      uSunIntensity: ENV_UNIFORMS.uSunIntensity,
      uRainDensity: ENV_UNIFORMS.uRainDensity,
      tReflection: { value: puddleRT.texture },
      uReflVP: { value: puddleMatrixUniform },
    },
    vertexShader: `
      uniform mat4 uReflVP;
      varying vec3 vWorldPos;
      varying vec2 vLocalUv;
      varying vec4 vReflClip;
      void main() {
        vLocalUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vReflClip = uReflVP * vec4(wp.xyz, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uSunIntensity;
      uniform float uRainDensity;
      uniform sampler2D tReflection;
      varying vec3 vWorldPos;
      varying vec2 vLocalUv;
      varying vec4 vReflClip;

      void main() {
        vec2 p = vLocalUv * 2.0 - 1.0;
        float wobble = 0.14 * sin(atan(p.y, p.x) * 3.0 + 1.2) + 0.08 * cos(atan(p.y, p.x) * 5.0 - 0.4);
        float d = length(p) + wobble;
        if (d > 0.92) discard;

        // Concentric raindrop ripple rings in puddle (contrast trough + crisp white crest)
        float r1 = fract(uTime * 0.58);
        float r2 = fract(uTime * 0.58 + 0.36);
        float r3 = fract(uTime * 0.58 + 0.71);
        float dr1 = abs(length(p - vec2(0.18, -0.10)) - r1 * 0.68);
        float dr2 = abs(length(p - vec2(-0.26, 0.22)) - r2 * 0.64);
        float dr3 = abs(length(p - vec2(0.02, 0.28)) - r3 * 0.56);
        float ring1 = smoothstep(0.048, 0.0, dr1) * (1.0 - r1);
        float ring2 = smoothstep(0.048, 0.0, dr2) * (1.0 - r2);
        float ring3 = smoothstep(0.045, 0.0, dr3) * (1.0 - r3);
        float trough = (smoothstep(0.085, 0.032, dr1) * (1.0 - r1) + smoothstep(0.085, 0.032, dr2) * (1.0 - r2)) * 0.38;
        vec2 ripOffset = normalize(p + 0.001) * (ring1 + ring2 + ring3) * 0.024;

        vec2 rUv = (vReflClip.xy / max(0.0001, vReflClip.w)) * 0.5 + 0.5 + ripOffset;
        rUv = clamp(rUv, 0.01, 0.99);
        vec3 refl = texture2D(tReflection, rUv).rgb;
        float lum = dot(refl, vec3(0.299, 0.587, 0.114));
        vec3 shadowSil = vec3(0.16, 0.42, 0.54);
        vec3 midRefl   = vec3(0.42, 0.72, 0.78);
        vec3 skyRefl   = vec3(0.86, 0.95, 0.97);
        vec3 postRefl = mix(shadowSil, midRefl, smoothstep(0.32, 0.56, lum));
        postRefl = mix(postRefl, skyRefl, smoothstep(0.68, 0.85, lum));
        postRefl = mix(postRefl, refl * 0.82 + vec3(0.12, 0.22, 0.26), 0.35);
        postRefl = mix(postRefl, vec3(0.30, 0.58, 0.68), clamp(trough, 0.0, 0.65));

        float rim = smoothstep(0.92, 0.76, d);
        float ringBright = clamp((ring1 + ring2 + ring3) * 0.78, 0.0, 0.95);
        vec3 col = mix(postRefl, vec3(0.97, 0.99, 1.0), ringBright);
        col *= mix(0.88, 1.04, uSunIntensity);

        gl_FragColor = vec4(col, rim * 0.82);
      }
    `,
  });

  // Main puddle right beside instrument cases & clear umbrella in Shot 4!
  const puddle1 = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.3), puddleMat);
  puddle1.rotation.x = -Math.PI / 2;
  puddle1.rotation.z = 0.22;
  puddle1.position.set(0.55, QUAY_Y + 0.014, 9.2);
  puddle1.layers.set(1);
  root.add(puddle1);

  const puddle2 = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.35), puddleMat);
  puddle2.rotation.x = -Math.PI / 2;
  puddle2.rotation.z = -0.35;
  puddle2.position.set(-2.4, QUAY_Y + 0.014, 10.6);
  puddle2.layers.set(1);
  root.add(puddle2);

  // ---------------------------------------------------------
  // 3. Translucent Sea-Green Water Cross-Section Side Walls (半透明水体剖面)
  // ---------------------------------------------------------
  const crossSectionMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: ENV_UNIFORMS.uTime,
      uSunIntensity: ENV_UNIFORMS.uSunIntensity,
      uCloudCenter: ENV_UNIFORMS.uCloudCenter,
      uCloudRadius: ENV_UNIFORMS.uCloudRadius,
      uWindVec: ENV_UNIFORMS.uWindVec,
      uGustFrontPos: ENV_UNIFORMS.uGustFrontPos,
      uGustStrength: ENV_UNIFORMS.uGustStrength,
      uRainDensity: ENV_UNIFORMS.uRainDensity,
      uBoat4Pos: ENV_UNIFORMS.uBoat4Pos,
      uBoat4Dir: ENV_UNIFORMS.uBoat4Dir,
      uBoat4Speed: ENV_UNIFORMS.uBoat4Speed,
    },
    vertexShader: `
      ${WATER_COMMON_GLSL}
      attribute float aIsTop;
      varying vec3 vWorldPos;
      varying float vIsTop;
      varying float vDepthFrac;

      void main() {
        vIsTop = aIsTop;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        if (aIsTop > 0.5) {
          wp.y += waterWaveH(wp.xz, uTime);
        }
        vWorldPos = wp.xyz;
        vDepthFrac = clamp(-wp.y / 3.8, 0.0, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      ${WATER_COMMON_GLSL}
      varying vec3 vWorldPos;
      varying float vIsTop;
      varying float vDepthFrac;

      void main() {
        vec3 topCol = vec3(0.46, 0.87, 0.86);
        vec3 botCol = vec3(0.18, 0.56, 0.65);
        vec3 col = mix(topCol, botCol, vDepthFrac);

        // Soft vertical underwater sunbeams / caustic curtains inside cutaway slab
        float coord = vWorldPos.x * 0.7 + vWorldPos.z * 0.7;
        float shaft = 0.5 + 0.5 * sin(coord * 1.4 + uTime * 0.7 + vWorldPos.y * 0.5);
        float sunMod = cloudShadowAt(vWorldPos.xz);
        col += vec3(0.24, 0.34, 0.28) * pow(shaft, 3.0) * (1.0 - vDepthFrac) * sunMod;

        // Crisp bright meniscus rim right along the animated wave top line!
        float topEdge = smoothstep(0.95, 1.0, vIsTop);
        col = mix(col, vec3(0.92, 0.99, 1.0), topEdge * 0.85);

        float alpha = mix(0.40, 0.56, vDepthFrac) + topEdge * 0.28;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  function buildWaterWall(axis, fixedVal, startCoord, endCoord, flipNormal) {
    const segs = 56;
    const positions = [];
    const isTopAttr = [];
    const indices = [];

    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const c = startCoord + (endCoord - startCoord) * u;
      const x = axis === 'x' ? fixedVal : c;
      const z = axis === 'x' ? c : fixedVal;
      const bedY = isLandXZ(x, z) ? WATER_Y - 0.02 : getSeabedY(x, z);

      // Bottom vertex (seabed) & Top vertex (wave Y=0 + shader wave)
      positions.push(x, bedY, z);
      isTopAttr.push(0.0);

      positions.push(x, WATER_Y, z);
      isTopAttr.push(1.0);
    }

    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (flipNormal) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('aIsTop', new THREE.Float32BufferAttribute(isTopAttr, 1));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, crossSectionMat);
    m.layers.set(1);
    root.add(m);
  }

  // East face (X = +19, Z from -19 to +19)
  buildWaterWall('x', BASE_HALF, -BASE_HALF, BASE_HALF, false);
  // South-East face (Z = +19, X from +3.5 to +19)
  buildWaterWall('z', BASE_HALF, 3.5, BASE_HALF, true);
  // North-East face (Z = -19, X from -5.5 to +19)
  buildWaterWall('z', -BASE_HALF, -5.5, BASE_HALF, false);

  const tmpPos = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();
  const clipPlaneWater = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.04); // Keep objects above Y = -0.04
  const clipPlaneQuay = new THREE.Plane(new THREE.Vector3(0, 1, 0), -QUAY_Y + 0.06); // Keep objects above quay slab Y=1.4

  return {
    root,
    reflectionRT,
    renderReflection(renderer, scene, mainCamera, orbitTarget) {
      if (mainCamera.position.y <= 0.05) return; // Skip when camera is submerged below water surface

      reflectionCamera.fov = mainCamera.fov;
      reflectionCamera.aspect = mainCamera.aspect;
      reflectionCamera.near = mainCamera.near;
      reflectionCamera.far = mainCamera.far;
      reflectionCamera.updateProjectionMatrix();

      const tgtSrc = orbitTarget || tmpTarget;
      if (!orbitTarget) {
        mainCamera.getWorldDirection(tmpTarget);
        tmpTarget.add(mainCamera.position);
      }

      // 1) Main harbor reflection mirrored across Y = 0
      tmpPos.copy(mainCamera.position);
      tmpPos.y = -tmpPos.y;
      reflectionCamera.position.copy(tmpPos);

      tmpTarget.copy(tgtSrc);
      tmpTarget.y = -tmpTarget.y;
      reflectionCamera.up.set(0, 1, 0);
      reflectionCamera.lookAt(tmpTarget);
      reflectionCamera.updateMatrixWorld(true);

      reflMatrixUniform.multiplyMatrices(
        reflectionCamera.projectionMatrix,
        reflectionCamera.matrixWorldInverse
      );

      reflectionCamera.layers.set(0);
      reflectionCamera.layers.enable(2);

      const prevTarget = renderer.getRenderTarget();
      const prevClip = renderer.clippingPlanes;
      renderer.clippingPlanes = [clipPlaneWater];
      renderer.setRenderTarget(reflectionRT);
      renderer.clear();
      renderer.render(scene, reflectionCamera);

      // 2) Quay rain puddle reflection mirrored accurately across Y = QUAY_Y (1.40)
      if (mainCamera.position.y > QUAY_Y + 0.02) {
        tmpPos.copy(mainCamera.position);
        tmpPos.y = 2.0 * QUAY_Y - tmpPos.y;
        reflectionCamera.position.copy(tmpPos);

        tmpTarget.copy(tgtSrc);
        tmpTarget.y = 2.0 * QUAY_Y - tmpTarget.y;
        reflectionCamera.up.set(0, 1, 0);
        reflectionCamera.lookAt(tmpTarget);
        reflectionCamera.updateMatrixWorld(true);

        puddleMatrixUniform.multiplyMatrices(
          reflectionCamera.projectionMatrix,
          reflectionCamera.matrixWorldInverse
        );

        renderer.clippingPlanes = [clipPlaneQuay];
        renderer.setRenderTarget(puddleRT);
        renderer.clear();
        renderer.render(scene, reflectionCamera);
      }

      renderer.setRenderTarget(prevTarget);
      renderer.clippingPlanes = prevClip;
    },
  };
}
