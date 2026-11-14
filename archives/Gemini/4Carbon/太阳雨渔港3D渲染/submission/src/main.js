import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PALETTE, evaluateWeather } from './palette.js';
import { SHARED_ANIME_UNIFORMS } from './materials.js';
import { buildAllTextures } from './textures.js';
import { buildBaseAndWater } from './baseAndWater.js';
import { buildBuildingsAndBackground } from './buildings.js';
import { buildHarborBoats } from './boats.js';
import { buildPropsAndLife } from './propsAndLife.js';
import { buildSkyDome, createRenderPipeline } from './postprocessing.js';
import { setupVideoExport } from './tourAndExport.js';

function init() {
  // 1. WebGL Renderer (no UI elements; supports up to 3840x2160+ and direct file:// opening)
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  document.body.appendChild(renderer.domElement);

  // 2. Scene & Atmospheric Fog (subtle sea-glass mist for background depth)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyHorizon);
  scene.fog = new THREE.FogExp2(PALETTE.fogColor, 0.0052);

  // 3. Camera & OrbitControls (free drag/pan, rotate, and zoom on PC)
  const camera = new THREE.PerspectiveCamera(
    39,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.2,
    360
  );
  const defaultCamPos = new THREE.Vector3(35.2, 22.4, 36.2);
  const defaultTarget = new THREE.Vector3(-0.4, -0.3, 0.2);
  camera.position.copy(defaultCamPos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(defaultTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.screenSpacePanning = true;
  controls.minDistance = 2.0;
  controls.maxDistance = 68.0;
  controls.maxPolarAngle = Math.PI * 0.62; // Allows dropping below waterline to view underwater cross-section!
  controls.update();

  // 4. Sunshower High-Key Lighting (bright sky hemisphere + warm golden sunlight)
  const hemiLight = new THREE.HemisphereLight(
    PALETTE.skyAmbient,
    PALETTE.groundBounce,
    1.15
  );
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(PALETTE.sunLight, 1.85);
  const sunDir = new THREE.Vector3(22, 27, 18.5);
  sunLight.position.copy(sunDir);
  SHARED_ANIME_UNIFORMS.uSunDir.value.copy(sunDir).normalize();
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 4;
  sunLight.shadow.camera.far = 75;
  const sBound = 24;
  sunLight.shadow.camera.left = -sBound;
  sunLight.shadow.camera.right = sBound;
  sunLight.shadow.camera.top = sBound;
  sunLight.shadow.camera.bottom = -sBound;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);

  // 5. Render Pipeline (Planar Reflections + Depth/Ink Post-Processing)
  const pipeline = createRenderPipeline(renderer, scene, camera);

  // 6. Build Procedural Textures & Miniature Harbor World
  const textures = buildAllTextures();
  const skyMesh = buildSkyDome(scene);
  const baseWater = buildBaseAndWater(scene, textures, pipeline.reflectionRT, pipeline.puddleRT);
  const buildings = buildBuildingsAndBackground(scene, textures);
  const boats = buildHarborBoats(scene, textures);
  const propsLife = buildPropsAndLife(scene, textures, boats, baseWater);

  // Find water surface mesh reference so we can hide it during water reflection pass
  let waterSurfaceMesh = null;
  baseWater.root.traverse((obj) => {
    if (obj.isMesh && obj.material === baseWater.waterSurfaceMat) {
      waterSurfaceMesh = obj;
    }
  });

  // 7. Deterministic World Step & Render Function
  let isExportMode = false;

  function stepAndRenderAtTime(t, fromExport = false) {
    SHARED_ANIME_UNIFORMS.uTime.value = t;

    const weather = evaluateWeather(t);
    SHARED_ANIME_UNIFORMS.uCloudCenter.value = weather.cloudCenter;
    SHARED_ANIME_UNIFORMS.uCloudStrength.value = weather.cloudEvent;
    SHARED_ANIME_UNIFORMS.uSkyDimming.value = weather.skyDimming;

    // Modulate global sun & sky light smoothly during thin cloud passes
    sunLight.intensity = 1.85 * (1.0 - 0.38 * weather.skyDimming);
    hemiLight.intensity = 1.15 * (1.0 - 0.16 * weather.skyDimming);

    const boatWakeInfo = boats.update(t, weather);
    buildings.update(t, weather);
    propsLife.update(t, weather, camera.position, fromExport);
    baseWater.update(t, weather, camera.position, fromExport, boatWakeInfo);

    pipeline.renderFrame(waterSurfaceMesh, baseWater.puddleMeshes, skyMesh);
  }

  // 8. Install window.videoExport Fixed Interface
  setupVideoExport({
    camera,
    controls,
    renderer,
    stepAndRenderAtTime,
    setExportActive: (val) => {
      isExportMode = val;
    },
    restoreInteractiveView: () => {
      camera.fov = 39;
      camera.position.copy(defaultCamPos);
      controls.target.copy(defaultTarget);
      camera.updateProjectionMatrix();
      controls.update();
    },
  });

  // 9. Responsive Window Resize (supports up to 3840x2160+)
  function onResize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    pipeline.resize();
  }
  window.addEventListener('resize', onResize);

  // 10. Real-Time Loop (paused cleanly whenever videoExport is active!)
  let lastPerf = performance.now();
  let worldTime = 0.0;

  function animate(now) {
    requestAnimationFrame(animate);
    if (isExportMode) {
      lastPerf = now;
      return;
    }
    const dt = Math.min((now - lastPerf) * 0.001, 0.1);
    lastPerf = now;
    worldTime += dt;

    controls.update();
    stepAndRenderAtTime(worldTime, false);
  }

  // Initial synchronous frame render
  stepAndRenderAtTime(0, false);
  requestAnimationFrame(animate);
}

init();
