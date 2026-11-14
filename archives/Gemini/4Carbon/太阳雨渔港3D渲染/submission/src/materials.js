import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Shared global uniforms updated once per frame for all anime materials
export const SHARED_ANIME_UNIFORMS = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.56, 0.68, 0.47).normalize() },
  uShadowTeal: { value: new THREE.Color(PALETTE.shadowTeal) },
  uSkyReflect: { value: new THREE.Color(0xd2f1f6) },
  uSunGold: { value: new THREE.Color(0xffe99e) },
  uCloudCenter: { value: -40.0 },
  uCloudStrength: { value: 0.0 },
  uSkyDimming: { value: 0.0 },
};

// 4-step soft-crisp anime toon gradient map
let cachedGradientMap = null;
function getToonGradientMap() {
  if (cachedGradientMap) return cachedGradientMap;
  const data = new Uint8Array([
    68,  // deep shadow band
    138, // soft transition mid-shadow
    208, // clean lit band
    255, // bright rim/highlight band
  ]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  cachedGradientMap = tex;
  return tex;
}

let matCounter = 0;

/**
 * Creates a Three.js MeshToonMaterial enhanced with authentic Japanese anime
 * background-art shading: sea-teal shadows, high-key low-contrast palette,
 * wet sky-cyan reflections, warm-gold speculars, and passing cloud shadows.
 */
export function createAnimeMaterial(options = {}) {
  const {
    color = 0xffffff,
    map = null,
    emissive = 0x000000,
    emissiveMap = null,
    emissiveIntensity = 1.0,
    wetness = 0.0,
    roughPatch = 0.0,
    shadowTintStrength = 0.34,
    transparent = false,
    opacity = 1.0,
    alphaTest = 0.0,
    side = THREE.FrontSide,
    vertexColors = false,
    depthWrite = !transparent,
    polygonOffset = false,
    polygonOffsetFactor = 0,
    polygonOffsetUnits = 0,
  } = options;

  const mat = new THREE.MeshToonMaterial({
    color,
    map,
    gradientMap: getToonGradientMap(),
    emissive,
    emissiveMap,
    emissiveIntensity,
    transparent,
    opacity,
    alphaTest,
    side,
    vertexColors,
    depthWrite,
    polygonOffset,
    polygonOffsetFactor,
    polygonOffsetUnits,
  });

  const matKey = `anime_${wetness.toFixed(2)}_${roughPatch.toFixed(2)}_${shadowTintStrength.toFixed(2)}_${++matCounter}`;
  mat.customProgramCacheKey = () => matKey;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_ANIME_UNIFORMS.uTime;
    shader.uniforms.uSunDir = SHARED_ANIME_UNIFORMS.uSunDir;
    shader.uniforms.uShadowTeal = SHARED_ANIME_UNIFORMS.uShadowTeal;
    shader.uniforms.uSkyReflect = SHARED_ANIME_UNIFORMS.uSkyReflect;
    shader.uniforms.uSunGold = SHARED_ANIME_UNIFORMS.uSunGold;
    shader.uniforms.uCloudCenter = SHARED_ANIME_UNIFORMS.uCloudCenter;
    shader.uniforms.uCloudStrength = SHARED_ANIME_UNIFORMS.uCloudStrength;
    shader.uniforms.uSkyDimming = SHARED_ANIME_UNIFORMS.uSkyDimming;
    shader.uniforms.uWetness = { value: wetness };
    shader.uniforms.uRoughPatch = { value: roughPatch };
    shader.uniforms.uShadowTintStrength = { value: shadowTintStrength };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAnimeWorldPos;
        varying vec3 vAnimeWorldNormal;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 animeWP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          animeWP = instanceMatrix * animeWP;
        #endif
        animeWP = modelMatrix * animeWP;
        vAnimeWorldPos = animeWP.xyz;
        vec3 animeWN = objectNormal;
        #ifdef USE_INSTANCING
          animeWN = mat3(instanceMatrix) * animeWN;
        #endif
        vAnimeWorldNormal = normalize(mat3(modelMatrix) * animeWN);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAnimeWorldPos;
        varying vec3 vAnimeWorldNormal;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uShadowTeal;
        uniform vec3 uSkyReflect;
        uniform vec3 uSunGold;
        uniform float uCloudCenter;
        uniform float uCloudStrength;
        uniform float uSkyDimming;
        uniform float uWetness;
        uniform float uRoughPatch;
        uniform float uShadowTintStrength;

        float animeHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float animeNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(animeHash(i), animeHash(i + vec2(1.0, 0.0)), f.x),
            mix(animeHash(i + vec2(0.0, 1.0)), animeHash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }`
      )
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        `// World-space passing cloud modulation
        float cloudAxis = -0.75 * vAnimeWorldPos.x + 0.66 * vAnimeWorldPos.z;
        float cloudBand = (1.0 - smoothstep(4.0, 15.0, abs(cloudAxis - uCloudCenter))) * uCloudStrength * 0.62;
        float sunCloudFactor = clamp(1.0 - cloudBand - uSkyDimming * 0.45, 0.34, 1.0);

        // Extract how much direct light + shadow reached this pixel
        float baseLum = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.02);
        float directLum = dot(reflectedLight.directDiffuse, vec3(0.299, 0.587, 0.114));
        float rawLit = clamp(directLum / (baseLum * 1.15), 0.0, 1.0) * sunCloudFactor;

        // Soft 3-step anime cel ramp (high-key watercolor feel)
        float celBand = smoothstep(0.08, 0.18, rawLit) * 0.58 + smoothstep(0.46, 0.58, rawLit) * 0.42;

        // Cool sea-teal shadow color (low contrast, luminous watercolor shadows)
        vec3 coolShadowBase = mix(
          diffuseColor.rgb * vec3(0.56, 0.73, 0.80),
          uShadowTeal * (0.45 + 0.65 * diffuseColor.rgb),
          uShadowTintStrength
        );
        // Warm high-key sunlit color
        vec3 warmLitBase = diffuseColor.rgb * vec3(1.05, 1.03, 0.97) + vec3(0.025, 0.022, 0.012) * celBand;

        vec3 animeSurface = mix(coolShadowBase, warmLitBase, celBand);

        // Subtle upward sky-light bounce (high-key outdoor atmosphere)
        vec3 wN = normalize(vAnimeWorldNormal);
        float skyUp = clamp(wN.y * 0.5 + 0.5, 0.0, 1.0);
        animeSurface += uSkyReflect * (0.045 * skyUp * (1.0 - 0.3 * uSkyDimming));

        // Wet surface stains, sky reflection, and stepped warm-gold sun specular
        if (uWetness > 0.01) {
          float patchN = animeNoise(vAnimeWorldPos.xz * 0.55) * 0.65 + animeNoise(vAnimeWorldPos.xz * 1.9) * 0.35;
          float dampMask = smoothstep(0.36, 0.72, patchN) * uWetness;
          // Slightly darker wet patches on concrete/wood
          animeSurface *= mix(1.0, 0.90 - 0.05 * uRoughPatch, dampMask * clamp(wN.y, 0.0, 1.0));

          vec3 viewDirW = normalize(cameraPosition - vAnimeWorldPos);
          float fresnel = pow(1.0 - clamp(dot(viewDirW, wN), 0.0, 1.0), 3.0);
          float wetReflect = uWetness * (0.25 + 0.75 * dampMask) * clamp(wN.y, 0.0, 1.0);
          animeSurface = mix(animeSurface, uSkyReflect * (0.92 - 0.18 * uSkyDimming), clamp(wetReflect * (0.16 + 0.36 * fresnel), 0.0, 0.42));

          // Crisp anime stepped warm brass-gold specular on curved hulls/edges + wet concrete aggregate glints (9.2)
          vec3 halfW = normalize(uSunDir + viewDirW);
          float specRaw = max(dot(wN, halfW), 0.0);
          float specStep = smoothstep(0.925, 0.968, specRaw) * celBand * sunCloudFactor * uWetness;
          float rimBrass = pow(1.0 - clamp(dot(viewDirW, wN), 0.0, 1.0), 3.4)
                         * smoothstep(0.15, 0.65, dot(wN, uSunDir))
                         * (1.0 - clamp(abs(wN.y), 0.0, 0.85))
                         * celBand * sunCloudFactor * uWetness;
          float wetAggGlint = 0.0;
          if (uRoughPatch > 0.25 && wN.y > 0.85) {
            float gNoise = animeNoise(vAnimeWorldPos.xz * 12.0 + viewDirW.xz * 1.6);
            wetAggGlint = smoothstep(0.84, 0.89, gNoise) * dampMask * celBand * sunCloudFactor * uRoughPatch;
          }
          animeSurface += uSunGold * (specStep * 0.48 + rimBrass * 0.34 + wetAggGlint * 0.28);
        }

        vec3 outgoingLight = animeSurface + totalEmissiveRadiance;`
      );
  };

  return mat;
}

// Shared ink edge material for crisp architectural / boat crease lines
const sharedInkLineMat = new THREE.LineBasicMaterial({
  color: PALETTE.inkOutline,
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
});

/**
 * Attaches delicate anime ink crease lines (EdgesGeometry) to a mesh.
 */
export function addInkEdges(mesh, thresholdAngle = 28, opacity = 0.34) {
  if (!mesh || !mesh.geometry) return mesh;
  const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
  const mat = opacity === 0.34
    ? sharedInkLineMat
    : new THREE.LineBasicMaterial({
        color: PALETTE.inkOutline,
        transparent: true,
        opacity,
        depthWrite: false,
      });
  const lines = new THREE.LineSegments(edgesGeo, mat);
  lines.raycast = () => {};
  mesh.add(lines);
  return lines;
}

/**
 * Clear anime glass material (windows, transparent umbrella) that keeps interior props
 * 100% readable behind it while rendering crisp diagonal sky/glare highlights.
 */
export function createGlassMaterial(options = {}) {
  const {
    tint = 0xdaf4f7,
    opacity = 0.22,
    glareStrength = 0.36,
    doubleSide = true,
  } = options;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      uTint: { value: new THREE.Color(tint) },
      uOpacity: { value: opacity },
      uGlare: { value: glareStrength },
      uSunGold: SHARED_ANIME_UNIFORMS.uSunGold,
      uSkyDimming: SHARED_ANIME_UNIFORMS.uSkyDimming,
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTint;
      uniform float uOpacity;
      uniform float uGlare;
      uniform vec3 uSunGold;
      uniform float uSkyDimming;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vWorldNormal);
        float fresnel = pow(1.0 - abs(dot(V, N)), 2.6);

        // Classic anime diagonal window reflection bands
        float diag = fract((vWorldPos.x + vWorldPos.y * 1.35 + vWorldPos.z) * 0.28);
        float streak1 = smoothstep(0.42, 0.45, diag) * (1.0 - smoothstep(0.51, 0.54, diag));
        float streak2 = smoothstep(0.58, 0.60, diag) * (1.0 - smoothstep(0.62, 0.64, diag));
        float streaks = (streak1 + streak2 * 0.7) * uGlare * (1.0 - 0.4 * uSkyDimming);

        vec3 col = mix(uTint, vec3(0.98, 1.0, 0.99), clamp(fresnel * 0.65 + streaks, 0.0, 1.0));
        col += uSunGold * streaks * 0.25;
        float alpha = clamp(uOpacity + fresnel * 0.26 + streaks * 0.28, 0.08, 0.62);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/**
 * Soft pale-golden volumetric sunbeam shader with glinting diagonal sunshower streaks inside!
 */
export function createSunbeamMaterial(baseOpacity = 0.16) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: SHARED_ANIME_UNIFORMS.uTime,
      uCloudCenter: SHARED_ANIME_UNIFORMS.uCloudCenter,
      uCloudStrength: SHARED_ANIME_UNIFORMS.uCloudStrength,
      uSkyDimming: SHARED_ANIME_UNIFORMS.uSkyDimming,
      uBaseOpacity: { value: baseOpacity },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uCloudCenter;
      uniform float uCloudStrength;
      uniform float uSkyDimming;
      uniform float uBaseOpacity;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        // Soft edge fade horizontally and vertically along the shaft
        float edgeX = smoothstep(0.0, 0.25, vUv.x) * (1.0 - smoothstep(0.75, 1.0, vUv.x));
        float edgeY = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.65, 1.0, vUv.y));
        vec3 V = normalize(cameraPosition - vWorldPos);
        float viewFade = pow(abs(dot(V, normalize(vWorldNormal))), 0.65);

        // Cloud shadow attenuation at sunbeam position
        float cloudAxis = -0.75 * vWorldPos.x + 0.66 * vWorldPos.z;
        float cloudDim = (1.0 - smoothstep(4.0, 15.0, abs(cloudAxis - uCloudCenter))) * uCloudStrength * 0.78;
        float sunVis = clamp(1.0 - cloudDim - uSkyDimming * 0.7, 0.08, 1.0);

        // Sparkling diagonal rain streaks catching sunlight inside the shaft
        vec2 rainCoord = vec2(vUv.x * 26.0 - vUv.y * 4.5, vUv.y * 7.0 + uTime * 4.8);
        vec2 cell = floor(rainCoord);
        vec2 f = fract(rainCoord);
        float rnd = hash(cell);
        float spark = 0.0;
        if (rnd > 0.76) {
          float lineX = 1.0 - smoothstep(0.0, 0.14, abs(f.x - 0.5));
          float lineY = smoothstep(0.1, 0.4, f.y) * (1.0 - smoothstep(0.6, 0.92, f.y));
          spark = lineX * lineY * 0.85;
        }

        vec3 col = mix(vec3(1.0, 0.93, 0.70), vec3(1.0, 0.98, 0.86), spark);
        float alpha = (uBaseOpacity + spark * 0.22) * edgeX * edgeY * viewFade * sunVis;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/**
 * Animated swaying water caustics projected onto warehouse ceiling & boat cabin roofs.
 */
export function createCausticsMaterial(opacity = 0.24) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: SHARED_ANIME_UNIFORMS.uTime,
      uCloudCenter: SHARED_ANIME_UNIFORMS.uCloudCenter,
      uCloudStrength: SHARED_ANIME_UNIFORMS.uCloudStrength,
      uSkyDimming: SHARED_ANIME_UNIFORMS.uSkyDimming,
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uCloudCenter;
      uniform float uCloudStrength;
      uniform float uSkyDimming;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      float causticPattern(vec2 p, float t) {
        vec2 p1 = p + vec2(sin(p.y * 2.4 + t * 0.85), cos(p.x * 2.1 - t * 0.72)) * 0.35;
        vec2 p2 = p * 1.25 + vec2(cos(p.y * 2.8 - t * 0.65), sin(p.x * 2.6 + t * 0.9)) * 0.3;
        float v = sin(p1.x * 4.2 + p2.y * 3.8) * cos(p1.y * 4.0 - p2.x * 3.6);
        // Cel-stepped bright caustic rings
        return smoothstep(0.32, 0.55, abs(v));
      }

      void main() {
        float c = causticPattern(vWorldPos.xz * 0.65, uTime);
        float fade = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x))
                   * smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
        float cloudAxis = -0.75 * vWorldPos.x + 0.66 * vWorldPos.z;
        float cloudDim = (1.0 - smoothstep(4.0, 15.0, abs(cloudAxis - uCloudCenter))) * uCloudStrength * 0.7;
        float sunVis = clamp(1.0 - cloudDim - uSkyDimming * 0.6, 0.15, 1.0);

        vec3 col = mix(vec3(0.55, 0.92, 0.90), vec3(1.0, 0.95, 0.76), 0.52);
        gl_FragColor = vec4(col, c * fade * uOpacity * sunVis);
      }
    `,
  });
}
