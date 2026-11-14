import * as THREE from 'three';
import { ENV_UNIFORMS } from './state.js';

let cachedGradientMap = null;

export function getToonGradientMap() {
  if (cachedGradientMap) return cachedGradientMap;
  // Soft 4-band anime watercolor ramp: luminous shadow -> midtone -> bright lit -> peak highlight
  const width = 64;
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    let v;
    if (t < 0.34) v = 0.62;
    else if (t < 0.39) v = 0.62 + ((t - 0.34) / 0.05) * 0.16;
    else if (t < 0.64) v = 0.78;
    else if (t < 0.69) v = 0.78 + ((t - 0.64) / 0.05) * 0.14;
    else if (t < 0.89) v = 0.92;
    else if (t < 0.93) v = 0.92 + ((t - 0.89) / 0.04) * 0.08;
    else v = 1.0;

    const c = Math.round(v * 255);
    data[i * 4] = c;
    data[i * 4 + 1] = c;
    data[i * 4 + 2] = c;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedGradientMap = tex;
  return tex;
}

/**
 * Creates a customized MeshToonMaterial tuned for high-key Japanese anime watercolor style:
 * - Deep coastal teal shadow tint (no dead muddy black shadows)
 * - Drifting cloud shadow modulation synchronized with sunbeams & sparkles
 * - Wetness rim/specular highlights in warm gold
 * - Optional ceiling water caustics for warehouse & boat cabin roofs
 * - Optional tidal wetting & darkening near/below water level (Y <= 0.6)
 */
export function createAnimeToonMaterial(opts = {}) {
  const {
    color = 0xffffff,
    map = null,
    emissive = 0x000000,
    emissiveMap = null,
    emissiveIntensity = 1.0,
    side = THREE.FrontSide,
    transparent = false,
    opacity = 1.0,
    alphaTest = 0,
    wetness = 0.18,
    rimStrength = 0.16,
    causticsStrength = 0.0,
    causticsScale = 0.8,
    tidalDarken = false,
    shadowTintStrength = 0.34,
    vertexColors = false,
  } = opts;

  const mat = new THREE.MeshToonMaterial({
    color,
    map,
    emissive,
    emissiveMap,
    emissiveIntensity,
    gradientMap: getToonGradientMap(),
    side,
    transparent,
    opacity,
    alphaTest,
    vertexColors,
  });

  mat.userData.animeOpts = {
    wetness,
    rimStrength,
    causticsStrength,
    causticsScale,
    tidalDarken,
    shadowTintStrength,
  };

  mat.customProgramCacheKey = () =>
    `anime_toon_${tidalDarken ? 1 : 0}_${causticsStrength > 0 ? 1 : 0}`;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = ENV_UNIFORMS.uTime;
    shader.uniforms.uSunDir = ENV_UNIFORMS.uSunDir;
    shader.uniforms.uSunIntensity = ENV_UNIFORMS.uSunIntensity;
    shader.uniforms.uCloudCenter = ENV_UNIFORMS.uCloudCenter;
    shader.uniforms.uCloudRadius = ENV_UNIFORMS.uCloudRadius;
    shader.uniforms.uWetness = { value: wetness };
    shader.uniforms.uRimStrength = { value: rimStrength };
    shader.uniforms.uCausticsStrength = { value: causticsStrength };
    shader.uniforms.uCausticsScale = { value: causticsScale };
    shader.uniforms.uShadowTintStrength = { value: shadowTintStrength };
    shader.uniforms.uTidalDarken = { value: tidalDarken ? 1.0 : 0.0 };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAnimeWorldPos;
        varying vec3 vAnimeWorldNormal;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 animeWPos = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          animeWPos = batchingMatrix * animeWPos;
        #endif
        #ifdef USE_INSTANCING
          animeWPos = instanceMatrix * animeWPos;
        #endif
        animeWPos = modelMatrix * animeWPos;
        vAnimeWorldPos = animeWPos.xyz;

        vec3 animeWNorm = objectNormal;
        #ifdef USE_INSTANCING
          animeWNorm = mat3( instanceMatrix ) * animeWNorm;
        #endif
        vAnimeWorldNormal = normalize( mat3( modelMatrix ) * animeWNorm );`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAnimeWorldPos;
        varying vec3 vAnimeWorldNormal;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform float uSunIntensity;
        uniform vec2 uCloudCenter;
        uniform vec2 uCloudRadius;
        uniform float uWetness;
        uniform float uRimStrength;
        uniform float uCausticsStrength;
        uniform float uCausticsScale;
        uniform float uShadowTintStrength;
        uniform float uTidalDarken;

        float animeCloudMask(vec2 xz) {
          vec2 d = (xz - uCloudCenter) / uCloudRadius;
          float r2 = dot(d, d);
          float wisp = 0.14 * sin(xz.x * 0.22 + uTime * 0.15) * cos(xz.y * 0.18 - uTime * 0.11);
          float cov = 1.0 - smoothstep(0.35, 1.15, r2 + wisp);
          return 1.0 - 0.36 * cov;
        }

        float animeCausticPattern(vec2 p, float t) {
          float c1 = sin(p.x * 2.7 + t * 1.45 + sin(p.y * 2.2 - t * 1.15));
          float c2 = cos(p.y * 2.9 - t * 1.35 + cos(p.x * 2.4 + t * 0.95));
          float c3 = sin((p.x - p.y) * 3.8 + t * 1.1);
          float v = abs(c1 + c2) * 0.5;
          float ridge = smoothstep(0.56, 0.88, 1.0 - v);
          float lace = smoothstep(0.62, 0.94, 1.0 - abs(c3));
          return clamp(ridge * 0.8 + lace * 0.35, 0.0, 1.0);
        }`
      )
      .replace(
        '#include <opaque_fragment>',
        `
        // Compute local sunlight & drifting cloud shadow modulation
        float cloudFactor = animeCloudMask(vAnimeWorldPos.xz) * uSunIntensity;
        float sunLitRatio = clamp(length(reflectedLight.directDiffuse) / max(0.001, length(diffuseColor.rgb)), 0.0, 1.0);

        // Apply drifting cloud shadow softly to direct diffuse while preserving sky bounce
        reflectedLight.directDiffuse *= mix(0.62, 1.08, cloudFactor);

        // Deep coastal teal shadow tint on shaded undersides / walls
        vec3 deepTealShadow = vec3(0.16, 0.38, 0.49);
        float shadowMix = (1.0 - smoothstep(0.08, 0.55, sunLitRatio)) * uShadowTintStrength;
        vec3 baseOut = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
        baseOut = mix(baseOut, baseOut * vec3(0.76, 0.92, 1.02) + deepTealShadow * diffuseColor.rgb * 0.26, shadowMix);

        // Tidal wet gradient along quay masonry & concrete near waterline
        if (uTidalDarken > 0.5) {
          float tideZone = 1.0 - smoothstep(-0.35, 0.85, vAnimeWorldPos.y);
          float subZone = 1.0 - smoothstep(-0.85, 0.12, vAnimeWorldPos.y);
          float dampNoise = 0.08 * sin(vAnimeWorldPos.x * 2.7 + vAnimeWorldPos.z * 2.3);
          float wetAmt = clamp(tideZone + dampNoise, 0.0, 1.0);
          baseOut = mix(baseOut, baseOut * vec3(0.70, 0.78, 0.80), wetAmt * 0.48);
          baseOut = mix(baseOut, baseOut * vec3(0.46, 0.62, 0.58), subZone * 0.52);
        }

        // Wet surface specular highlight & warm golden rim light in sun-rain
        vec3 wNorm = normalize(vAnimeWorldNormal);
        vec3 viewDirW = normalize(cameraPosition - vAnimeWorldPos);
        vec3 halfVec = normalize(normalize(uSunDir) + viewDirW);
        float ndh = max(dot(wNorm, halfVec), 0.0);
        float wetSpec = smoothstep(0.86, 0.94, ndh) * uWetness * cloudFactor * smoothstep(0.05, 0.4, sunLitRatio);
        baseOut += vec3(1.0, 0.94, 0.78) * wetSpec * 0.45;

        // Soft anime rim highlight on silhouettes facing sun/sky
        float fresnel = pow(1.0 - max(dot(wNorm, viewDirW), 0.0), 3.0);
        float sunRim = smoothstep(0.2, 0.85, dot(wNorm, normalize(uSunDir)) * 0.5 + 0.5);
        float rimBand = smoothstep(0.48, 0.62, fresnel * sunRim) * uRimStrength * cloudFactor;
        baseOut += vec3(1.0, 0.95, 0.82) * rimBand * 0.38;

        // Animated shimmering water reflection caustics on indoor ceilings & boat roofs (facing down -Y)
        if (uCausticsStrength > 0.001) {
          float caust = animeCausticPattern(vAnimeWorldPos.xz * uCausticsScale, uTime);
          float downward = 1.0 - smoothstep(-0.85, -0.05, wNorm.y);
          float wallEdge = 0.25 * (1.0 - abs(wNorm.y));
          float mask = cloudFactor * clamp(downward + wallEdge, 0.0, 1.0);
          baseOut = mix(baseOut, baseOut * vec3(0.76, 0.90, 0.94), mask * 0.32 * uCausticsStrength);
          baseOut += vec3(0.62, 0.96, 0.90) * caust * uCausticsStrength * mask * 0.42;
        }

        outgoingLight = baseOut;
        #include <opaque_fragment>
        `
      );
  };

  return mat;
}

// View-space Normal + Linear Depth material for screen-space slender anime outlines
export function createNormalDepthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      #include <common>
      #include <batching_pars_vertex>
      #include <normal_pars_vertex>
      #include <morphtarget_pars_vertex>
      #include <skinning_pars_vertex>
      varying vec3 vViewNorm;
      varying float vLinDepth;
      void main() {
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vViewNorm = normalize(transformedNormal);
        vLinDepth = -mvPosition.z;
      }
    `,
    fragmentShader: `
      varying vec3 vViewNorm;
      varying float vLinDepth;
      void main() {
        vec3 n = normalize(vViewNorm) * 0.5 + 0.5;
        gl_FragColor = vec4(n, vLinDepth);
      }
    `,
  });
}

// Fullscreen edge overlay scene (slender 1px deep coastal ink outlines on Layer 0)
export function createEdgeOverlayPass(gbufferTexture) {
  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    tGBuffer: { value: gbufferTexture },
    uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uInkColor: { value: new THREE.Color(0x214254) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tGBuffer;
      uniform vec2 uTexelSize;
      uniform vec3 uInkColor;
      varying vec2 vUv;

      void main() {
        vec4 c = texture2D(tGBuffer, vUv);
        float dC = c.a;
        vec3 nC = c.rgb * 2.0 - 1.0;

        vec2 dx = vec2(uTexelSize.x, 0.0);
        vec2 dy = vec2(0.0, uTexelSize.y);

        vec4 sL = texture2D(tGBuffer, vUv - dx);
        vec4 sR = texture2D(tGBuffer, vUv + dx);
        vec4 sU = texture2D(tGBuffer, vUv + dy);
        vec4 sD = texture2D(tGBuffer, vUv - dy);

        // Depth silhouette discontinuity (relative threshold scales naturally across zoom)
        float dDiff = max(
          max(abs(sL.a - dC), abs(sR.a - dC)),
          max(abs(sU.a - dC), abs(sD.a - dC))
        );
        float minD = min(min(dC, sL.a), min(sR.a, min(sU.a, sD.a)));
        float depthEdge = smoothstep(0.045 * max(minD, 1.0), 0.14 * max(minD, 1.0), dDiff);

        // Normal crease edge (suppress far horizon noise)
        float nDiff = max(
          max(length((sL.rgb * 2.0 - 1.0) - nC), length((sR.rgb * 2.0 - 1.0) - nC)),
          max(length((sU.rgb * 2.0 - 1.0) - nC), length((sD.rgb * 2.0 - 1.0) - nC))
        );
        float normalEdge = smoothstep(0.42, 0.78, nDiff);

        // Distance fade so distant objects stay dreamy & high-key
        float distFade = 1.0 - smoothstep(42.0, 88.0, minD);
        float edge = clamp(max(depthEdge * 0.95, normalEdge * 0.62), 0.0, 1.0) * distFade;

        if (edge < 0.02) discard;
        gl_FragColor = vec4(uInkColor, edge * 0.46);
      }
    `,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  return {
    scene: quadScene,
    camera: quadCamera,
    setResolution(w, h) {
      uniforms.uTexelSize.value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
    },
    setTexture(tex) {
      uniforms.tGBuffer.value = tex;
    },
  };
}
