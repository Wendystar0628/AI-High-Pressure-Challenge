// ============================================================
// Three.js 渲染管线：渲染器 / 环境 / 灯光 / 后期（辉光·景深·运动模糊）
// ============================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';

// ---------- 后期着色器：方向性运动模糊 + 景深辅助暗角 ----------
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uBlurDir: { value: new THREE.Vector2(0, 0) },   // 运动模糊方向与强度
    uBlurAmount: { value: 0 },
    uVignette: { value: 0.32 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uBlurDir;
    uniform float uBlurAmount;
    uniform float uVignette;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      if (uBlurAmount > 0.001) {
        vec4 acc = color;
        float w = 1.0;
        for (int i = 1; i <= 6; i++) {
          float fi = float(i);
          vec2 off = uBlurDir * uBlurAmount * fi * 0.0022;
          acc += texture2D(tDiffuse, vUv + off) * (1.0 - fi * 0.12);
          acc += texture2D(tDiffuse, vUv - off) * (1.0 - fi * 0.12);
          w += 2.0 * (1.0 - fi * 0.12);
        }
        color = acc / w;
      }
      // 暗角
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * uVignette * 2.2;
      color.rgb *= clamp(v, 0.65, 1.0);
      // 极轻的胶片颗粒（静态 —— 由 time 驱动但幅度极小）
      float g = fract(sin(dot(vUv + fract(uTime * 0.01), vec2(12.9898, 78.233))) * 43758.5453);
      color.rgb += (g - 0.5) * 0.012;
      gl_FragColor = color;
    }
  `,
};

export class Pipeline {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a12);
    this.scene.fog = new THREE.FogExp2(0x060a12, 0.0032);

    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.set(13.5, 9.5, 15.5);

    // 环境：程序化房间环境（金属可映出环境）
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envRT.texture;
    this.envTexture = envRT.texture;
    pmrem.dispose();

    // 灯光
    this.keyLight = new THREE.DirectionalLight(0xdde8ff, 2.4);
    this.keyLight.position.set(14, 22, 12);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    const sc = this.keyLight.shadow.camera;
    sc.near = 1; sc.far = 90;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimCyan = new THREE.DirectionalLight(0x46d8ff, 1.15);
    this.rimCyan.position.set(-18, 8, -10);
    this.scene.add(this.rimCyan);

    this.rimAmber = new THREE.DirectionalLight(0xffa860, 0.85);
    this.rimAmber.position.set(10, 4, -16);
    this.scene.add(this.rimAmber);

    this.ambient = new THREE.AmbientLight(0x24344e, 0.55);
    this.scene.add(this.ambient);

    // 接触暗部
    this.hemi = new THREE.HemisphereLight(0x35507a, 0x0a0e16, 0.5);
    this.scene.add(this.hemi);

    // 后期
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // 景深：由场景深度决定的散景（近景章节加强）
    this.bokeh = new BokehPass(this.scene, this.camera, {
      focus: 16.0,
      aperture: 0.00012,
      maxblur: 0.008,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    this.composer.addPass(this.bokeh);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.38, 0.55, 0.82
    );
    this.composer.addPass(this.bloom);

    // 景深：以场景深度决定的柔焦（Bokeh 近似：利用深度纹理的简化散景）
    // 为控制开销与色带，这里用 FinalShader 的雾+暗角组合，并用 bloom 局部扩散表达浅景深；
    // 真实 DoF 由 BokehHelper 在近景章节启用。
    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.finalPass);
    this.composer.addPass(new OutputPass());

    this._vel = new THREE.Vector2();
    this._prevCam = this.camera.position.clone();
    this._prevLook = new THREE.Vector3();
    this.motionBlur = 0;
    this.blurDir = new THREE.Vector2(1, 0);

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    if (this.bokeh) this.bokeh.setSize(w, h);
  }

  /** 景深：焦点跟随观看中心，aperture 可按章节加强 */
  updateDof(focusDistance, aperture = 0.00012) {
    if (!this.bokeh) return;
    const u = this.bokeh.materialBokeh ? this.bokeh.materialBokeh.uniforms : null;
    if (u) {
      const k = this.instant ? 1 : 0.15;
      if (u.focus) u.focus.value += (focusDistance - u.focus.value) * k;
      if (u.aperture) u.aperture.value += (aperture - u.aperture.value) * k;
    }
  }

  /** 相机速度 → 运动模糊强度与方向 */
  updateMotionBlur(lookTarget) {
    const cur = this.camera.position;
    const dx = cur.x - this._prevCam.x;
    const dy = cur.y - this._prevCam.y;
    const dz = cur.z - this._prevCam.z;
    const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const lookDelta = this._prevLook.distanceTo(lookTarget);
    const amt = Math.min(1.2, (speed + lookDelta) * 0.55);
    this.motionBlur += (amt - this.motionBlur) * (this.instant ? 1 : 0.25);
    if (speed + lookDelta > 0.0008) {
      // 近似屏幕方向
      this.blurDir.set(dx + (lookTarget.x - this._prevLook.x), dy + (lookTarget.y - this._prevLook.y)).normalize();
    }
    this._prevCam.copy(cur);
    this._prevLook.copy(lookTarget);
    this.finalPass.uniforms.uBlurAmount.value = this.motionBlur;
    this.finalPass.uniforms.uBlurDir.value.copy(this.blurDir);
  }

  render(time) {
    this.finalPass.uniforms.uTime.value = time;
    this.composer.render();
  }
}
