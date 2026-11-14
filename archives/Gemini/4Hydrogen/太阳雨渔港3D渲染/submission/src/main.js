import * as THREE from 'three';
import {
  ENV_UNIFORMS,
  createSimulationState,
  updateEnvironmentAtTime,
} from './state.js';
import {
  createNormalDepthMaterial,
  createEdgeOverlayPass,
} from './toon.js';
import { buildBaseAndQuay } from './baseAndQuay.js';
import { buildBuildings } from './buildings.js';
import { buildBoats } from './boats.js';
import { buildProps } from './props.js';
import { buildWater } from './water.js';
import { buildAtmosphere } from './atmosphere.js';
import { buildCreatures } from './creatures.js';
import { setupCameraAndExport } from './cameraTour.js';

function init() {
  const canvas = document.getElementById('scene-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  renderer.setClearColor(0xdcf0f5, 1);
  scene.fog = new THREE.Fog(0xdff1f5, 58, 155);

  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.25,
    380
  );

  // High-key sunlit rain lighting (bright sky bounce + warm golden sun + cool coastal shadows)
  const hemiLight = new THREE.HemisphereLight(0xeef9fc, 0x457f90, 1.32);
  hemiLight.layers.enableAll();
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xd9eff4, 0.36);
  ambientLight.layers.enableAll();
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d4, 1.35);
  sunLight.position.set(28, 34, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -24;
  sunLight.shadow.camera.right = 24;
  sunLight.shadow.camera.top = 24;
  sunLight.shadow.camera.bottom = -24;
  sunLight.shadow.camera.near = 4;
  sunLight.shadow.camera.far = 92;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.022;
  sunLight.layers.enableAll();
  scene.add(sunLight);

  ENV_UNIFORMS.uSunDir.value.copy(sunLight.position).normalize();

  // Build world modules
  const baseSys = buildBaseAndQuay(scene);
  const buildingsSys = buildBuildings(scene);
  const boatsSys = buildBoats(scene);
  const propsSys = buildProps(scene);
  const waterSys = buildWater(scene);
  const atmosphereSys = buildAtmosphere(scene, propsSys.dripOrigins);
  const creaturesSys = buildCreatures(scene, boatsSys.boats);

  // G-Buffer & slender anime outline overlay
  const drawSize = new THREE.Vector2();
  renderer.getDrawingBufferSize(drawSize);
  const gbufferRT = new THREE.WebGLRenderTarget(
    Math.max(1, drawSize.x),
    Math.max(1, drawSize.y),
    {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    }
  );
  const normalDepthMat = createNormalDepthMaterial();
  const edgePass = createEdgeOverlayPass(gbufferRT.texture);
  edgePass.setResolution(drawSize.x, drawSize.y);

  const sim = createSimulationState();

  function stepScene(t) {
    const sunI = ENV_UNIFORMS.uSunIntensity.value;
    sunLight.intensity = 1.35 * sunI;
    hemiLight.intensity = 1.12 + 0.20 * sunI;

    baseSys.update(t, sunI);
    buildingsSys.update(t);
    boatsSys.update(t);
    propsSys.update(t, sunI);
    atmosphereSys.update(t);
    creaturesSys.update(t, sim);
  }

  const prevClearColor = new THREE.Color();

  function renderFrame() {
    // Ensure G-Buffer matches active drawing buffer (handles any window size up to 3840x2160)
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    renderer.getDrawingBufferSize(drawSize);
    if (gbufferRT.width !== drawSize.x || gbufferRT.height !== drawSize.y) {
      gbufferRT.setSize(Math.max(1, drawSize.x), Math.max(1, drawSize.y));
      edgePass.setResolution(drawSize.x, drawSize.y);
    }

    // 1. Update shadows once for Layer 0
    camera.layers.set(0);
    renderer.shadowMap.needsUpdate = true;

    // 2. Render Planar Reflections for water & foreground puddle
    waterSys.renderReflection(renderer, scene, camera, controls.target);

    // 3. Render Opaque G-Buffer (view normals + linear depth) for crisp slender outlines
    renderer.getClearColor(prevClearColor);
    const prevClearAlpha = renderer.getClearAlpha();
    scene.overrideMaterial = normalDepthMat;
    renderer.setRenderTarget(gbufferRT);
    renderer.setClearColor(0x8080ff, 1000.0);
    renderer.clear();
    camera.layers.set(0);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClearColor, prevClearAlpha);

    // 4. Render Opaque Diorama + Sky Dome + Distant Sea/Breakwater to screen
    renderer.autoClear = true;
    camera.layers.set(0);
    camera.layers.enable(2);
    renderer.render(scene, camera);

    // 5. Overlay slender deep-teal anime ink edges (leaves hardware depth buffer intact!)
    renderer.autoClear = false;
    renderer.render(edgePass.scene, edgePass.camera);

    // 6. Render Transparent Layer 1 (posterized water, water cutaway walls, puddle, glass, umbrella, beams, rain, rainbow, mist)
    camera.layers.set(1);
    renderer.render(scene, camera);

    renderer.autoClear = true;
    camera.layers.enableAll();
  }

  const { controls } = setupCameraAndExport({
    camera,
    domElement: renderer.domElement,
    sim,
    stepSceneFn: stepScene,
    renderFrameFn: renderFrame,
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(drawSize);
    gbufferRT.setSize(Math.max(1, drawSize.x), Math.max(1, drawSize.y));
    edgePass.setResolution(drawSize.x, drawSize.y);
  });

  // Initial pose at t=0
  updateEnvironmentAtTime(sim, 0, 0);
  stepScene(0);
  renderFrame();

  // Real-time interactive animation loop (paused cleanly during videoExport mode)
  let lastPerfMs = performance.now();
  let accumTime = 0;

  function animate(nowMs) {
    requestAnimationFrame(animate);
    const rawDt = Math.min(0.05, Math.max(0, (nowMs - lastPerfMs) * 0.001));
    lastPerfMs = nowMs;

    if (sim.exportMode) return;

    controls.update();
    sim.cameraPos.copy(camera.position);
    sim.cameraTarget.copy(controls.target);

    accumTime += rawDt;
    updateEnvironmentAtTime(sim, accumTime, rawDt);
    stepScene(accumTime);
    renderFrame();
  }

  requestAnimationFrame(animate);
}

init();
