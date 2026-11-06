import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { U, WL, windAt, randomState } from './core/G.js';
import { initMaterials, MAT } from './core/materials.js';
import { Pipeline, PlanarReflection } from './core/pipeline.js';
import { initSpecial } from './core/special.js';
import { makeTextures } from './core/textures.js';
import { buildBase } from './world/base.js';
import { buildWater } from './world/water.js';
import { buildSky, buildFarSea, buildRainbow } from './world/env.js';
import { Ctx } from './world/ctx.js';
import { buildWarehouse, buildWaitingRoom, buildVending } from './world/buildings.js';
import { buildHill, buildLighthouse } from './world/nature.js';
import { buildProps, buildPuddles, PROPS } from './world/props.js';
import { buildHarbor } from './world/harbor.js';
import { buildRain, buildDrips, buildSkyBeams, buildLighthouseGlow, buildMist } from './world/fx.js';
import { buildGulls, buildCat, buildFish, buildDistantBoat } from './world/life.js';
import { Director } from './director.js';

THREE.ColorManagement.enabled = false;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.3, 1400);
camera.position.set(43, 27.5, 49.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-1.5, 0.5, -1.5);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 2.5;
controls.maxDistance = 150;
controls.maxPolarAngle = Math.PI * 0.54;
controls.zoomToCursor = true;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 1.1;
controls.panSpeed = 0.8;
controls.screenSpacePanning = true;
controls.update();
const DEFAULT_TARGET = controls.target.clone();
const DEFAULT_OFFSET = camera.position.clone().sub(controls.target);

initMaterials();
initSpecial();
const TX = makeTextures();
const pipeline = new Pipeline(renderer, scene, camera);
const waterRefl = pipeline.addReflection(new PlanarReflection(WL, 0.6));
const puddleRefl = pipeline.addReflection(new PlanarReflection(0.012, 0.4));
U.tPud.value = puddleRefl.rt.texture;
puddleRefl.texMat = U.uPudMat;
U.uPudOn.value = 1;

buildSky(scene);
buildFarSea(scene, MAT);
const rainbow = buildRainbow(scene);
buildBase(scene, MAT);
buildWater(scene, pipeline, waterRefl);
const ctx = new Ctx(scene, TX);
buildWarehouse(ctx);
buildWaitingRoom(ctx);
buildVending(ctx, -19.2, 15.6, Math.PI / 2);
buildHill(ctx);
const lighthouseLamp = buildLighthouse(ctx);
buildProps(ctx);
// brass nameplate on the display plinth
ctx.main.rbox(3.5, 0.62, 0.05, 0.02, { c: [0.55, 0.42, 0.2], w: 0.8, l: 1 }, 4.5, -5.85, 20.715);
ctx.decal(TX.plaque, 3.3, 0.55, new THREE.Matrix4().makeTranslation(4.5, -5.85, 20.745), { w: 0.9, l: 0.3 });
buildPuddles(scene, puddleRefl);
ctx.finish();
const harbor = buildHarbor(scene, TX);

// effects & life
const rain = buildRain(scene, camera);
const dripEmitters = [...PROPS.drips];
for (const bt of harbor.boats) {
  for (const d of bt.drips) dripEmitters.push({ getPos: () => d.local.clone().applyMatrix4(bt.group.matrixWorld), pos: new THREE.Vector3(), ground: WL, period: d.period });
}
const drips = buildDrips(scene, dripEmitters);
const beams = buildSkyBeams(scene);
const lhGlow = buildLighthouseGlow(scene, lighthouseLamp);
const mist = buildMist(scene);
const gulls = buildGulls(scene);
const cat = buildCat(scene);
const fish = buildFish(scene);
const distant = buildDistantBoat(scene);
const director = new Director({ harbor, gulls, cat, distant });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pipeline.setSize(w, h, dpr);
  // until the viewer takes control, keep the whole diorama framed for any window shape
  if (!userMoved && !window.__harborVideo?.active) {
    const k = Math.max(1, 1.72 / camera.aspect);
    camera.position.copy(DEFAULT_TARGET).addScaledVector(DEFAULT_OFFSET, k);
    controls.target.copy(DEFAULT_TARGET);
    controls.update();
  }
}
let userMoved = false;
renderer.domElement.addEventListener('pointerdown', () => { userMoved = true; });
renderer.domElement.addEventListener('wheel', () => { userMoved = true; }, { passive: true });
window.addEventListener('resize', resize);
resize();

const WIND_ANGLE = Math.atan2(-0.69, -0.72);
function animateProps(now) {
  const ws = PROPS.windsock;
  if (ws) {
    const w = windAt(ws.x, ws.z, now);
    const k = Math.min(1, w / 0.95);
    ws.group.rotation.y = WIND_ANGLE + Math.sin(now * 0.9) * 0.25 * (1 - k * 0.6) + Math.sin(now * 2.7) * 0.05;
    ws.segs.forEach((s, i) => {
      s.rotation.z = -(1 - k) * 0.28 + Math.sin(now * (3 + k * 5) - i * 0.9) * 0.05 * (0.4 + k);
      s.rotation.y = Math.sin(now * (2.5 + k * 4) - i * 1.1) * 0.06 * (0.3 + k);
    });
  }
  for (const f of PROPS.flags || []) {
    const w = windAt(f.x, f.z, now);
    f.mesh.rotation.y = WIND_ANGLE + Math.sin(now * 0.8 + f.x) * 0.3 * (1 - Math.min(1, w));
    f.mesh.rotation.z = -(1 - Math.min(1, w * 1.4)) * 0.9;
  }
}

const clock = new THREE.Clock();
let time = 0;
const tmp = new THREE.Vector3();
let animationFrame = 0;
function updateScene(now, dt) {
  time = now;
  U.uTime.value = time;
  director.update(time, dt);
  harbor.update(time, dt);
  gulls.update(time, dt, camera);
  cat.update(time, dt, camera);
  fish.update(time, dt, camera);
  distant.update(time);
  drips.update(time);
  beams.update(time);
  lhGlow.update();
  mist.update(time, camera);
  rain.update();
  animateProps(time);
}
function drawScene() {
  // rainbow: a faint arc hanging in the distance behind the diorama (direction follows the viewer)
  {
    const D = 320, th = Math.tan((camera.fov * Math.PI) / 360);
    const R = 1.0 * D * th;
    const W = (2 * R) / 0.78;
    const fwd = camera.getWorldDirection(tmp);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    rainbow.position.copy(camera.position).addScaledVector(fwd, D).addScaledVector(up, -0.28 * D * th).addScaledVector(right, 0.22 * D * th * camera.aspect);
    rainbow.quaternion.copy(camera.quaternion);
    rainbow.rotateZ(-0.06);
    rainbow.scale.setScalar(W / 120);
    rainbow.visible = U.uRainbow.value > 0.01;
  }
  pipeline.render();
}
function frame() {
  if (window.__harborVideo.active) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update();
  // keep the orbit target inside the diorama
  const t = controls.target;
  t.x = THREE.MathUtils.clamp(t.x, -21, 21);
  t.z = THREE.MathUtils.clamp(t.z, -21, 21);
  t.y = THREE.MathUtils.clamp(t.y, -6, 9);
  updateScene(time + dt, dt);
  drawScene();
  animationFrame = requestAnimationFrame(frame);
}
// pre-compile all shader programs in parallel (KHR_parallel_shader_compile) before the first frame
let started = false;
const start = () => { if (!started) { started = true; clock.getDelta(); if (!window.__harborVideo.active) animationFrame = requestAnimationFrame(frame); } };
const ready = renderer.compileAsync(scene, camera);
ready.then(start, start);
setTimeout(start, 25000);

window.__dbg = { scene, camera, controls, U, renderer, pipeline, harbor, director, cat, gulls, fish, get time() { return time; }, hold() { userMoved = true; } };

// 仅供独立视频导出脚本调用；正常浏览仍由上面的原始循环驱动。
window.__harborVideo = {
  THREE: { Vector3: THREE.Vector3 }, scene, camera, controls, U, renderer, ready, randomState,
  state: { director, harbor, gulls, cat, fish, distant, props: PROPS },
  active: false,
  get time() { return time; },
  set time(t) { time = t; },
  get userMoved() { return userMoved; },
  set userMoved(v) { userMoved = v; },
  update: updateScene,
  draw: drawScene,
  pause() { this.active = true; cancelAnimationFrame(animationFrame); },
  resume() {
    this.active = false;
    clock.getDelta();
    if (started) animationFrame = requestAnimationFrame(frame);
  },
};
