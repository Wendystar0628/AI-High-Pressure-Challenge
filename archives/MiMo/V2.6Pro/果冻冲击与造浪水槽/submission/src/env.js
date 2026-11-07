// Shared renderer / lights / environment / background
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // Gradient background via canvas texture (procedural, file:// safe)
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 4; bgCanvas.height = 256;
  const g = bgCanvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a2436');
  grad.addColorStop(0.45, '#243247');
  grad.addColorStop(1, '#3a4a62');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const bgTex = new THREE.CanvasTexture(bgCanvas);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;

  // Environment for PBR reflections / transmission
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  // Lights — studio 3-point
  const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x2a3040, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.65);
  key.position.set(6, 11, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  const s = 12;
  key.shadow.camera.left = -s; key.shadow.camera.right = s;
  key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x88b4ff, 0.55);
  fill.position.set(-8, 5, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe2c4, 0.7);
  rim.position.set(-3, 6, -9);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(6.2, 4.4, 8.4);
  camera.lookAt(0, 1.2, 0);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, key, fill, rim, hemi, resize };
}

// Soft studio floor shared by both scenes
export function makeFloor(size = 40) {
  const geo = new THREE.CircleGeometry(size, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2c3544,
    roughness: 0.82,
    metalness: 0.08,
    envMapIntensity: 0.35,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

// Thin glowing ring used to stage the jelly platform
export function makePlatform(radius = 2.6) {
  const group = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.02, 0.28, 64),
    new THREE.MeshStandardMaterial({
      color: 0x8d99a8,
      roughness: 0.42,
      metalness: 0.55,
      envMapIntensity: 0.8,
    })
  );
  top.position.y = 0.14;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, 0.035, 12, 96),
    new THREE.MeshStandardMaterial({
      color: 0x66c4ff,
      emissive: 0x2277cc,
      emissiveIntensity: 0.85,
      roughness: 0.3,
      metalness: 0.2,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.285;
  group.add(ring);
  return group;
}
