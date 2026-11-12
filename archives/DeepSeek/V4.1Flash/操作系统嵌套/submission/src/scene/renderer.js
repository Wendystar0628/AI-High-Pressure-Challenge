// 共享的 WebGL 显示设备：一个 WebGL 上下文渲染到离屏画布，再拷入各视图的 2D canvas。
// 这样嵌套/投送任意数量的三维视图也不会超出 Chromium 的 WebGL 上下文上限。
import * as THREE from 'three';

class SharedGL {
  constructor() {
    this.lost = false;
    this.create();
  }
  create() {
    try { this.renderer?.dispose(); } catch { /* ignore */ }
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, powerPreference: 'high-performance',
      preserveDrawingBuffer: true, stencil: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0a0e18, 1);
    const canvas = this.renderer.domElement;
    this.canvas = canvas;
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      console.warn('[display] WebGL 上下文丢失，等待恢复');
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[display] WebGL 上下文恢复');
      this.lost = false;
    }, false);
  }
  resize(w, h) {
    this.renderer.setSize(w, h, false);
  }
  render(scene, camera) {
    if (this.lost) return false;
    try {
      this.renderer.render(scene, camera);
      return true;
    } catch (err) {
      console.warn('[display] render failed', err);
      return false;
    }
  }
}

let shared = null;
export function getSharedGL() {
  if (!shared) shared = new SharedGL();
  return shared;
}

const dprCache = new Map();

/**
 * 把 scene 以给定相机渲染到二维 canvas；每个视图的尺寸/宽高比独立。
 */
export function renderSceneToCanvas(canvas2d, scene, camera, width, height) {
  if (!canvas2d || width < 4 || height < 4) return false;
  const gl = getSharedGL();
  if (gl.lost) return false;
  const dpr = Math.min(1.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const pw = Math.max(2, Math.round(width * dpr));
  const ph = Math.max(2, Math.round(height * dpr));
  if (canvas2d.width !== pw || canvas2d.height !== ph) {
    canvas2d.width = pw; canvas2d.height = ph;
  }
  camera.aspect = pw / ph;
  camera.updateProjectionMatrix();
  gl.resize(pw, ph);
  if (!gl.render(scene, camera)) return false;
  const ctx = canvas2d.getContext('2d', { alpha: false });
  if (!ctx) return false;
  try {
    ctx.drawImage(gl.canvas, 0, 0, pw, ph);
    return true;
  } catch { return false; }
}

export function disposeScene(scene) {
  scene.traverse((obj) => {
    if (obj.geometry) { try { obj.geometry.dispose(); } catch { /* ignore */ } }
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        for (const key of ['map', 'alphaMap', 'emissiveMap', 'bumpMap', 'normalMap']) {
          if (m[key]) { try { m[key].dispose(); } catch { /* ignore */ } }
        }
        try { m.dispose(); } catch { /* ignore */ }
      }
    }
  });
}
