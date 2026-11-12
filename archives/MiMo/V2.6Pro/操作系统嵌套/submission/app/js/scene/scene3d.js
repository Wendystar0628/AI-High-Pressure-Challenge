/* scene3d.js — host 3D display device.
   Renders submitted scene state via Three.js. The device never advances state:
   identical submissions produce identical pictures. */

const VENDOR = '../../../node_modules/three/build/three.module.js';
let THREE = null;
async function loadThree() {
  if (THREE) return THREE;
  THREE = await import(VENDOR);
  return THREE;
}

export class Scene3D {
  constructor(hostEl, instance) {
    this.hostEl = hostEl;
    this.instance = instance;
    this.views = new Map(); // viewId -> { canvas, renderer, scene, camera, parts:Map, animId }
    this.ready = false;
    this._initPromise = loadThree().then(() => { this.ready = true; });
  }

  resize(w, h) {
    this._size = { w, h };
    for (const v of this.views.values()) {
      this._resizeView(v, w, h);
    }
  }

  _resizeView(v, w, h) {
    v.w = w; v.h = h;
    if (v.renderer) {
      v.renderer.setSize(w, h, false);
      v.camera.aspect = w / Math.max(1, h);
      v.camera.updateProjectionMatrix();
    }
    v.canvas.style.width = w + 'px';
    v.canvas.style.height = h + 'px';
  }

  submit(viewId, sceneState) {
    if (!sceneState) return;
    this._initPromise.then(() => {
      try {
        this._render(viewId, sceneState);
      } catch (e) {
        console.error('scene3d render error', e);
      }
    });
  }

  _getView(viewId) {
    let v = this.views.get(viewId);
    if (v) return v;
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    this.hostEl.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    v = { canvas, renderer, scene, camera, parts: new Map(), lights: [], w: 100, h: 100, particles: [] };
    this.views.set(viewId, v);
    const size = this._size || { w: this.hostEl.clientWidth || 800, h: this.hostEl.clientHeight || 500 };
    this._resizeView(v, size.w, size.h);
    return v;
  }

  _render(viewId, state) {
    const v = this._getView(viewId);
    const scene = v.scene;

    // fog / background
    if (state.bg !== undefined) {
      scene.background = new THREE.Color(state.bg || '#0c1222');
    }
    if (state.fog) {
      scene.fog = new THREE.Fog(state.fog.color || '#8fb8d8', state.fog.near || 40, state.fog.far || 260);
    } else {
      scene.fog = null;
    }

    // lights
    if (state.lights) {
      // remove old dynamic lights
      for (const l of v.lights) scene.remove(l);
      v.lights = [];
      for (const L of state.lights) {
        let light;
        if (L.type === 'ambient') {
          light = new THREE.AmbientLight(L.color || 0x8899bb, L.intensity ?? 0.6);
        } else if (L.type === 'directional') {
          light = new THREE.DirectionalLight(L.color || 0xffffff, L.intensity ?? 1.2);
          light.position.set(...(L.position || [30, 50, 20]));
          if (L.castShadow) {
            light.castShadow = true;
            light.shadow.mapSize.set(1024, 1024);
            const d = L.shadowDist || 60;
            light.shadow.camera.left = -d;
            light.shadow.camera.right = d;
            light.shadow.camera.top = d;
            light.shadow.camera.bottom = -d;
            light.shadow.camera.far = 300;
          }
        } else if (L.type === 'point') {
          light = new THREE.PointLight(L.color || 0xffaa44, L.intensity ?? 1, L.distance || 100);
          light.position.set(...(L.position || [0, 10, 0]));
        } else if (L.type === 'hemisphere') {
          light = new THREE.HemisphereLight(L.sky || 0x87b5d9, L.ground || 0x2e3b28, L.intensity ?? 0.8);
        } else {
          light = new THREE.AmbientLight(0x6688aa, 0.5);
        }
        scene.add(light);
        v.lights.push(light);
      }
    }

    // parts
    const seen = new Set();
    if (state.parts) {
      for (const p of state.parts) {
        seen.add(p.id);
        let mesh = v.parts.get(p.id);
        if (!mesh || (p.type && mesh.userData.type !== p.type && p.type !== 'keep')) {
          if (mesh) { scene.remove(mesh); disposeMesh(mesh); }
          mesh = this._makeMesh(p);
          if (!mesh) continue;
          v.parts.set(p.id, mesh);
          scene.add(mesh);
        }
        this._applyTransform(mesh, p);
      }
    }
    // remove unseen
    for (const [id, mesh] of [...v.parts]) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        disposeMesh(mesh);
        v.parts.delete(id);
      }
    }

    // camera
    if (state.camera) {
      const c = state.camera;
      if (c.pos) v.camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
      if (c.lookAt) v.camera.lookAt(c.lookAt[0], c.lookAt[1], c.lookAt[2]);
      if (c.fov) { v.camera.fov = c.fov; v.camera.updateProjectionMatrix(); }
      if (c.up) v.camera.up.set(c.up[0], c.up[1], c.up[2]);
    }

    v.renderer.render(scene, v.camera);
  }

  _makeMesh(p) {
    const t = p.type || 'box';
    let geo;
    if (t === 'box') {
      const s = p.size || [1, 1, 1];
      geo = new THREE.BoxGeometry(s[0], s[1], s[2]);
    } else if (t === 'sphere') {
      geo = new THREE.SphereGeometry(p.radius || 1, p.seg || 16, p.seg || 16);
    } else if (t === 'cylinder') {
      geo = new THREE.CylinderGeometry(p.rTop ?? 1, p.rBottom ?? 1, p.height || 1, p.seg || 16);
    } else if (t === 'cone') {
      geo = new THREE.ConeGeometry(p.radius || 1, p.height || 1, p.seg || 16);
    } else if (t === 'plane') {
      const s = p.size || [10, 10];
      geo = new THREE.PlaneGeometry(s[0], s[1], p.segW || 1, p.segH || 1);
    } else if (t === 'torus') {
      geo = new THREE.TorusGeometry(p.radius || 1, p.tube || 0.3, 8, 24);
    } else if (t === 'lathe' && p.points) {
      const pts = p.points.map(q => new THREE.Vector2(q[0], q[1]));
      geo = new THREE.LatheGeometry(pts, p.seg || 16);
    } else if (t === 'custom' && p.vertices && p.indices) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(p.vertices, 3));
      if (p.normals) geo.setAttribute('normal', new THREE.Float32BufferAttribute(p.normals, 3));
      if (p.uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(p.uvs, 2));
      geo.setIndex(p.indices);
    } else if (t === 'group') {
      const g = new THREE.Group();
      g.userData.type = 'group';
      if (p.children) {
        for (const ch of p.children) {
          const m = this._makeMesh(ch);
          if (m) g.add(m);
        }
      }
      return g;
    } else {
      geo = new THREE.BoxGeometry(1, 1, 1);
    }
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.color || '#888888'),
      metalness: p.metalness ?? 0.3,
      roughness: p.roughness ?? 0.6,
      transparent: !!p.opacity && p.opacity < 1,
      opacity: p.opacity ?? 1,
      flatShading: !!p.flat,
      side: p.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      emissive: new THREE.Color(p.emissive || '#000000'),
      emissiveIntensity: p.emissiveIntensity ?? 1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = p.castShadow !== false;
    mesh.receiveShadow = p.receiveShadow !== false;
    mesh.userData.type = t;
    return mesh;
  }

  _applyTransform(mesh, p) {
    if (p.position) mesh.position.set(p.position[0], p.position[1], p.position[2]);
    if (p.rotation) mesh.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2]);
    if (p.scale !== undefined) {
      if (typeof p.scale === 'number') mesh.scale.setScalar(p.scale);
      else mesh.scale.set(p.scale[0], p.scale[1], p.scale[2]);
    }
    if (p.visible !== undefined) mesh.visible = !!p.visible;
    if (p.color && mesh.material && mesh.material.color) {
      mesh.material.color.set(p.color);
    }
    if (p.opacity !== undefined && mesh.material) {
      mesh.material.opacity = p.opacity;
      mesh.material.transparent = p.opacity < 1;
    }
  }
}

function disposeMesh(mesh) {
  if (!mesh) return;
  if (mesh.children) {
    for (const c of mesh.children) disposeMesh(c);
  }
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
    else mesh.material.dispose();
  }
}
