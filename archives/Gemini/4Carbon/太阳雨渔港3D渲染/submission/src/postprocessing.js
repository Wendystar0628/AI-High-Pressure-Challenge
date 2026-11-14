import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { SHARED_ANIME_UNIFORMS } from './materials.js';

/**
 * Builds the Sunshower Anime Sky Dome (8.1 天空明亮，呈浅青白色；云层很薄，阳光依旧充足).
 */
export function buildSkyDome(scene) {
  const skyGeo = new THREE.SphereGeometry(185, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: SHARED_ANIME_UNIFORMS.uTime,
      uSunDir: SHARED_ANIME_UNIFORMS.uSunDir,
      uSkyDimming: SHARED_ANIME_UNIFORMS.uSkyDimming,
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uSkyDimming;
      varying vec3 vDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float fbm(vec2 p) {
        return vnoise(p) * 0.55 + vnoise(p * 2.1 + 3.7) * 0.30 + vnoise(p * 4.3 - 1.9) * 0.15;
      }

      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);

        // Linear-space high-key pale cyan-white sky gradient (outputs sRGB ~#e2f6f9 -> #bfe6ef -> #a9dbe8)
        vec3 horizon = vec3(0.72, 0.90, 0.93);
        vec3 midSky  = vec3(0.50, 0.77, 0.85);
        vec3 zenith  = vec3(0.38, 0.68, 0.79);
        vec3 col = mix(horizon, midSky, smoothstep(0.0, 0.34, up));
        col = mix(col, zenith, smoothstep(0.34, 0.90, up));

        // Thin translucent anime clouds drifting slowly
        if (d.y > 0.03) {
          vec2 cloudUv = d.xz / (d.y + 0.28) * 1.45 + vec2(uTime * 0.012, -uTime * 0.008);
          float cVal = fbm(cloudUv);
          float thinCloud = smoothstep(0.48, 0.71, cVal);
          vec3 cloudCol = mix(vec3(0.89, 0.95, 0.96), vec3(0.96, 0.93, 0.82), 0.42);
          col = mix(col, cloudCol, thinCloud * 0.56 * smoothstep(0.03, 0.22, d.y));
        }

        // Warm diffused sun halo
        float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
        col += vec3(0.95, 0.86, 0.58) * (pow(sunDot, 12.0) * 0.20 + pow(sunDot, 52.0) * 0.28) * (1.0 - 0.55 * uSkyDimming);

        // Gentle atmospheric dimming during the rare passing cloud
        col *= (1.0 - 0.22 * uSkyDimming);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);
  return skyMesh;
}

/**
 * Manages Planar Reflection RenderTargets & Screen-Space Anime Cel-Ink Outline + Watercolor Post-Pass.
 */
export function createRenderPipeline(renderer, scene, mainCamera) {
  const reflectionRT = new THREE.WebGLRenderTarget(1024, 1024, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType,
    depthBuffer: true,
  });

  const puddleRT = new THREE.WebGLRenderTarget(512, 512, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType,
    depthBuffer: true,
  });

  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const beautyRT = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType,
    depthBuffer: true,
  });
  beautyRT.depthTexture = new THREE.DepthTexture(Math.max(1, size.x), Math.max(1, size.y));
  beautyRT.depthTexture.type = THREE.UnsignedIntType;

  // Full-screen post-processing quad (Anime Depth+Color Ink Outlines + Soft Sunshower Bloom + sRGB Output)
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const postUniforms = {
    tColor: { value: beautyRT.texture },
    tDepth: { value: beautyRT.depthTexture },
    uResolution: { value: new THREE.Vector2(size.x, size.y) },
    uNear: { value: mainCamera.near },
    uFar: { value: mainCamera.far },
    uInkColor: { value: new THREE.Color(PALETTE.inkOutline) },
  };

  const postMat = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: postUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      #include <packing>
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 uResolution;
      uniform float uNear;
      uniform float uFar;
      uniform vec3 uInkColor;
      varying vec2 vUv;

      float getLinearDepth(vec2 uv) {
        float fragCoordZ = texture2D(tDepth, clamp(uv, 0.001, 0.999)).x;
        float viewZ = perspectiveDepthToViewZ(fragCoordZ, uNear, uFar);
        return viewZToOrthographicDepth(viewZ, uNear, uFar);
      }

      void main() {
        // Resolution-adaptive step so 1080p and 4K (3840x2160) keep crisp, delicate outlines!
        float scale = clamp(uResolution.y / 1080.0, 0.85, 3.5);
        vec2 texel = (1.0 / uResolution) * scale * 0.92;

        vec3 center = texture2D(tColor, vUv).rgb;

        // 4-neighbor + diagonal depth & color sampling for crisp 1px anime ink outlines
        float dC  = getLinearDepth(vUv);
        float dL  = getLinearDepth(vUv + vec2(-texel.x, 0.0));
        float dR  = getLinearDepth(vUv + vec2( texel.x, 0.0));
        float dU  = getLinearDepth(vUv + vec2(0.0,  texel.y));
        float dD  = getLinearDepth(vUv + vec2(0.0, -texel.y));
        float dUL = getLinearDepth(vUv + vec2(-texel.x,  texel.y));
        float dDR = getLinearDepth(vUv + vec2( texel.x, -texel.y));

        // Second-derivative Laplacian depth discontinuity (ignores flat sloped planes like ground/water!)
        float lapDepth = abs((dL + dR - 2.0 * dC)) + abs((dU + dD - 2.0 * dC))
                       + 0.5 * abs(dUL + dDR - 2.0 * dC);
        float depthEdge = smoothstep(0.0016, 0.0048, lapDepth / max(0.08 + dC * 2.4, 0.08));

        // Fade out depth outlines near sky far plane
        if (dC > 0.985) depthEdge = 0.0;

        // Subtle watercolor glow / bloom from wider neighborhood on sunlit highlights
        vec2 bloomStep = (1.0 / uResolution) * scale * 3.2;
        vec3 b1 = texture2D(tColor, vUv + vec2( bloomStep.x,  bloomStep.y)).rgb;
        vec3 b2 = texture2D(tColor, vUv + vec2(-bloomStep.x,  bloomStep.y)).rgb;
        vec3 b3 = texture2D(tColor, vUv + vec2( bloomStep.x, -bloomStep.y)).rgb;
        vec3 b4 = texture2D(tColor, vUv + vec2(-bloomStep.x, -bloomStep.y)).rgb;
        vec3 avgGlow = 0.25 * (b1 + b2 + b3 + b4);
        float glowLum = dot(avgGlow, vec3(0.299, 0.587, 0.114));
        vec3 softBloom = max(avgGlow - vec3(0.76), vec3(0.0)) * smoothstep(0.72, 1.15, glowLum) * 0.24;

        vec3 col = center + softBloom;

        // Apply delicate anime blue-teal ink outline (清晰而纤细的轮廓线)
        vec3 darkInk = mix(uInkColor * 0.54, col * 0.44, 0.36);
        col = mix(col, darkInk, depthEdge * 0.66);

        // Gentle high-key filmic watercolor roll-off + sRGB conversion
        col = col / (1.0 + col * 0.10) * 1.08;
        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
  postQuad.frustumCulled = false;
  postScene.add(postQuad);

  // Planar reflection helper camera & clip planes
  const reflCam = new THREE.PerspectiveCamera();
  const waterClipPlane = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.06)];
  const puddleClipPlane = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.662)];
  const tmpTarget = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function resize() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, size.x);
    const h = Math.max(1, size.y);
    beautyRT.setSize(w, h);
    postUniforms.uResolution.value.set(w, h);
  }

  const prevClearColor = new THREE.Color();

  function renderFrame(waterMeshToHide, puddleMeshesToHide, skyMesh) {
    mainCamera.updateMatrixWorld();
    mainCamera.getWorldDirection(tmpDir);
    tmpTarget.copy(mainCamera.position).addScaledVector(tmpDir, 20.0);

    // 1. Render Harbor Water Planar Reflection (mirrored across y = 0.0)
    // Hide skyDome & clear with alpha=0 so reflectionRT.a == 1 ONLY on real 3D harbor objects (boats, lighthouse, quay, hillside, gulls)!
    if (mainCamera.position.y > 0.08) {
      reflCam.fov = mainCamera.fov;
      reflCam.aspect = mainCamera.aspect;
      reflCam.near = mainCamera.near;
      reflCam.far = mainCamera.far;
      reflCam.position.set(mainCamera.position.x, -mainCamera.position.y, mainCamera.position.z);
      reflCam.up.set(0, 1, 0);
      reflCam.lookAt(tmpTarget.x, -tmpTarget.y, tmpTarget.z);
      reflCam.updateProjectionMatrix();

      const prevBg = scene.background;
      const prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(prevClearColor);

      if (waterMeshToHide) waterMeshToHide.visible = false;
      if (skyMesh) skyMesh.visible = false;
      scene.background = null;
      renderer.setClearColor(0x000000, 0.0);
      renderer.clippingPlanes = waterClipPlane;
      renderer.setRenderTarget(reflectionRT);
      renderer.clear();
      renderer.render(scene, reflCam);

      scene.background = prevBg;
      renderer.setClearColor(prevClearColor, prevAlpha);
      if (skyMesh) skyMesh.visible = true;
      if (waterMeshToHide) waterMeshToHide.visible = true;
    }

    // 2. Render Quay Puddle Planar Reflection (mirrored across y = 1.656)
    if (mainCamera.position.y > 1.70) {
      const H2 = 1.656 * 2.0;
      reflCam.fov = mainCamera.fov;
      reflCam.aspect = mainCamera.aspect;
      reflCam.near = mainCamera.near;
      reflCam.far = mainCamera.far;
      reflCam.position.set(mainCamera.position.x, H2 - mainCamera.position.y, mainCamera.position.z);
      reflCam.up.set(0, 1, 0);
      reflCam.lookAt(tmpTarget.x, H2 - tmpTarget.y, tmpTarget.z);
      reflCam.updateProjectionMatrix();

      if (puddleMeshesToHide) puddleMeshesToHide.forEach((m) => { m.visible = false; });
      renderer.clippingPlanes = puddleClipPlane;
      renderer.setRenderTarget(puddleRT);
      renderer.clear();
      renderer.render(scene, reflCam);
      if (puddleMeshesToHide) puddleMeshesToHide.forEach((m) => { m.visible = true; });
    }

    // 3. Render Main Beauty Pass with DepthTexture
    renderer.clippingPlanes = [];
    postUniforms.uNear.value = mainCamera.near;
    postUniforms.uFar.value = mainCamera.far;
    renderer.setRenderTarget(beautyRT);
    renderer.clear();
    renderer.render(scene, mainCamera);

    // 4. Render Screen-Space Anime Cel-Ink Outline + Bloom Pass to Canvas
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  return {
    reflectionRT,
    puddleRT,
    beautyRT,
    resize,
    renderFrame,
  };
}
