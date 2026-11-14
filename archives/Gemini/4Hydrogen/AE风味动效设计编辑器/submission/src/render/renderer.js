// WebGL 2 多通道合成与三维 PBR/阴影/景深/粒子/运动模糊渲染引擎

import * as THREE from 'three';
import {
  clamp,
  lerp,
  mat4Identity,
  mat4Multiply,
  mat4TransformPoint,
  DEG2RAD,
  evalCubicBezier,
} from '../core/math.js';
import { evalProperty } from '../core/expressions.js';
import {
  getCompById,
  getLayerById,
  getLayerWorldMatrix,
  isLayerActiveAtTime,
} from '../core/project.js';
import {
  evaluateShapeLayerGeometry,
  pathShapeToMultiPolygon,
  flattenContour,
} from '../geometry/shapes.js';
import {
  layoutText,
  computeAnimatorWeight,
  transformCharItemContours,
  textToGeometry,
} from '../geometry/fonts.js';
import { triangulateMultiPolygon, deformMesh2DWithPins } from '../geometry/mesh2d.js';
import {
  evaluateParticleSystemAtTime,
  evaluateMesh3DLayerLocal,
} from '../sim/particles.js';
import {
  FULLSCREEN_VERT,
  COMPOSITE_BLEND_FRAG,
  GAUSSIAN_BLUR_FRAG,
  GLOW_EXTRACT_FRAG,
  GLOW_COMBINE_FRAG,
  DROP_SHADOW_FRAG,
  HSL_FRAG,
  MASK_MATTE_FRAG,
  ADJUSTMENT_MERGE_FRAG,
  DOF_BOKEH_FRAG,
  ACCUMULATE_FRAG,
  FINAL_OUTPUT_FRAG,
} from './shaders.js';
import { createProceduralForgeEnvironment } from './envmap.js';

const BLEND_MODE_INT = {
  normal: 0,
  add: 1,
  screen: 2,
  multiply: 3,
  overlay: 4,
};

const MATTE_MODE_INT = {
  alpha: 0,
  alphaInverted: 1,
  luma: 2,
  lumaInverted: 3,
};

function aeVecToThree(p, compW, compH) {
  return new THREE.Vector3(p[0] - compW * 0.5, -(p[1] - compH * 0.5), -(p[2] || 0));
}

// 将 AE 世界矩阵转换为 Three.js 世界矩阵（输入几何已做 S(1,-1,-1) 映射，保持右手系 det=+1）
function aeWorldMatrixToThree(aeM, compW, compH) {
  // M_three = T(-W/2, H/2, 0) * S(1, -1, -1) * M_ae * S(1, -1, -1)
  // 简化直接构造：S_inv = diag(1, -1, -1)
  const m = aeM;
  const out = new THREE.Matrix4();
  out.set(
    m[0], -m[4], -m[8], m[12] - compW * 0.5,
    -m[1], m[5], m[9], -m[13] + compH * 0.5,
    -m[2], m[6], m[10], -m[14],
    m[3], -m[7], -m[11], m[15]
  );
  return out;
}

function drawContoursToCtx(ctx, contours, doClose = true) {
  for (const c of contours) {
    const pts = c.points;
    if (!pts || pts.length === 0) continue;
    ctx.moveTo(pts[0].x, pts[0].y);
    const segs = c.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const isLine =
        Math.abs(a.outX || 0) < 1e-3 &&
        Math.abs(a.outY || 0) < 1e-3 &&
        Math.abs(b.inX || 0) < 1e-3 &&
        Math.abs(b.inY || 0) < 1e-3;
      if (isLine) {
        ctx.lineTo(b.x, b.y);
      } else {
        ctx.bezierCurveTo(
          a.x + (a.outX || 0),
          a.y + (a.outY || 0),
          b.x + (b.inX || 0),
          b.y + (b.inY || 0),
          b.x,
          b.y
        );
      }
    }
    if (c.closed && doClose) ctx.closePath();
  }
}

function colorArrToCss(c, multAlpha = 1) {
  const r = clamp(Math.round((c[0] ?? 1) * 255), 0, 255);
  const g = clamp(Math.round((c[1] ?? 1) * 255), 0, 255);
  const b = clamp(Math.round((c[2] ?? 1) * 255), 0, 255);
  const a = clamp((c[3] ?? 1) * multAlpha, 0, 1);
  return `rgba(${r},${g},${b},${a})`;
}

export class WebGL2AECompositor {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = false;

    this.isWebGL2 = !!this.renderer.capabilities.isWebGL2;
    this.envRT = createProceduralForgeEnvironment(this.renderer);

    // 全屏四边形 Pass 场景
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);

    this.materials = {
      compositeBlend: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: COMPOSITE_BLEND_FRAG,
        uniforms: { tDst: { value: null }, tSrc: { value: null }, uBlendMode: { value: 0 }, uOpacity: { value: 1 } },
        depthTest: false,
        depthWrite: false,
      }),
      gaussianBlur: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: GAUSSIAN_BLUR_FRAG,
        uniforms: { tDiffuse: { value: null }, uDirection: { value: new THREE.Vector2() }, uRadius: { value: 0 } },
        depthTest: false,
        depthWrite: false,
      }),
      glowExtract: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: GLOW_EXTRACT_FRAG,
        uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.45 }, uTint: { value: new THREE.Vector3(1, 0.7, 0.3) } },
        depthTest: false,
        depthWrite: false,
      }),
      glowCombine: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: GLOW_COMBINE_FRAG,
        uniforms: { tBase: { value: null }, tBloom: { value: null }, uIntensity: { value: 1.2 } },
        depthTest: false,
        depthWrite: false,
      }),
      dropShadow: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: DROP_SHADOW_FRAG,
        uniforms: {
          tBase: { value: null },
          tBlurred: { value: null },
          uOffsetUv: { value: new THREE.Vector2() },
          uShadowColor: { value: new THREE.Vector4(0, 0, 0, 1) },
          uShadowOpacity: { value: 0.75 },
        },
        depthTest: false,
        depthWrite: false,
      }),
      hsl: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: HSL_FRAG,
        uniforms: { tDiffuse: { value: null }, uHue: { value: 0 }, uSaturation: { value: 0 }, uLightness: { value: 0 } },
        depthTest: false,
        depthWrite: false,
      }),
      maskMatte: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: MASK_MATTE_FRAG,
        uniforms: { tLayer: { value: null }, tMatte: { value: null }, uMode: { value: 0 } },
        depthTest: false,
        depthWrite: false,
      }),
      adjustmentMerge: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: ADJUSTMENT_MERGE_FRAG,
        uniforms: { tBelow: { value: null }, tAdjusted: { value: null }, tMaskAlpha: { value: null }, uOpacity: { value: 1 } },
        depthTest: false,
        depthWrite: false,
      }),
      dofBokeh: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: DOF_BOKEH_FRAG,
        uniforms: {
          tColor: { value: null },
          tDepth: { value: null },
          uResolution: { value: new THREE.Vector2(1280, 720) },
          uNear: { value: 10 },
          uFar: { value: 8000 },
          uFocusDistance: { value: 950 },
          uAperture: { value: 0 },
        },
        depthTest: false,
        depthWrite: false,
      }),
      accumulate: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: ACCUMULATE_FRAG,
        uniforms: { tAccum: { value: null }, tSample: { value: null }, uWeight: { value: 1 } },
        depthTest: false,
        depthWrite: false,
      }),
      finalOutput: new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: FINAL_OUTPUT_FRAG,
        uniforms: { tComp: { value: null }, uBgColor: { value: new THREE.Vector4(0, 0, 0, 1) }, uTransparentBg: { value: 0 } },
        depthTest: false,
        depthWrite: false,
      }),
      copyPremul: new THREE.MeshBasicMaterial({ map: null, transparent: false, depthTest: false, depthWrite: false }),
    };

    // 2D 画布上传纹理复用
    this._2dCanvas = document.createElement('canvas');
    this._2dCtx = this._2dCanvas.getContext('2d');
    this._maskCanvas = document.createElement('canvas');
    this._maskCtx = this._maskCanvas.getContext('2d');

    this._rtPool = new Map();
    this._lastCamera = null;
    this._lastPickables = [];
    this._lastCompSize = { width: 1280, height: 720 };
  }

  getRT(key, w, h, opts = {}) {
    const k = `${key}_${w}x${h}_${opts.depth ? 'D' : ''}_${opts.halfFloat ? 'HF' : 'U8'}`;
    let rt = this._rtPool.get(k);
    if (!rt) {
      const params = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: opts.halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
        depthBuffer: !!opts.depth,
        stencilBuffer: false,
      };
      if (opts.depth) {
        const dt = new THREE.DepthTexture(w, h);
        dt.format = THREE.DepthFormat;
        dt.type = THREE.UnsignedIntType;
        params.depthTexture = dt;
      }
      rt = new THREE.WebGLRenderTarget(w, h, params);
      this._rtPool.set(k, rt);
    }
    return rt;
  }

  runFullscreenPass(material, targetRT) {
    this.quadMesh.material = material;
    this.renderer.setRenderTarget(targetRT);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, true, false);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  copyTextureToRT(tex, targetRT) {
    this.materials.compositeBlend.uniforms.tDst.value = null;
    this.materials.copyPremul.map = tex;
    this.materials.copyPremul.needsUpdate = true;
    this.runFullscreenPass(this.materials.copyPremul, targetRT);
  }

  uploadCanvasTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.premultiplyAlpha = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  // 对 FBO 执行可分离高斯模糊
  applyGaussianBlurRT(srcRT, dstRT, tempKey, w, h, radius) {
    const r = Math.max(0, radius);
    if (r <= 0.1) {
      this.copyTextureToRT(srcRT.texture, dstRT);
      return;
    }
    const tmp = this.getRT(tempKey, w, h);
    const mat = this.materials.gaussianBlur;
    mat.uniforms.tDiffuse.value = srcRT.texture;
    mat.uniforms.uDirection.value.set(1 / w, 0);
    mat.uniforms.uRadius.value = r;
    this.runFullscreenPass(mat, tmp);

    mat.uniforms.tDiffuse.value = tmp.texture;
    mat.uniforms.uDirection.value.set(0, 1 / h);
    mat.uniforms.uRadius.value = r;
    this.runFullscreenPass(mat, dstRT);
  }

  // 执行图层效果栈（模糊、发光、投影、色相/饱和度/亮度），支持任意排序与动画
  applyEffectsStack(project, comp, layer, srcRT, outRT, w, h, time, prefix = 'effects') {
    const effects = (layer.effects || []).filter((e) => e.enabled);
    if (effects.length === 0) {
      this.copyTextureToRT(srcRT.texture, outRT);
      return;
    }

    let ping = this.getRT(`${prefix}_ping`, w, h);
    let pong = this.getRT(`${prefix}_pong`, w, h);
    this.copyTextureToRT(srcRT.texture, ping);

    for (let i = 0; i < layer.effects.length; i++) {
      const fx = layer.effects[i];
      if (!fx.enabled) continue;
      const pPrefix = `effects.${i}.params`;

      if (fx.type === 'gaussianBlur') {
        const radius = evalProperty(project, comp, layer, `${pPrefix}.radius`, time);
        this.applyGaussianBlurRT(ping, pong, `${prefix}_gblur`, w, h, radius);
        [ping, pong] = [pong, ping];
      } else if (fx.type === 'glow') {
        const threshold = evalProperty(project, comp, layer, `${pPrefix}.threshold`, time);
        const radius = evalProperty(project, comp, layer, `${pPrefix}.radius`, time);
        const intensity = evalProperty(project, comp, layer, `${pPrefix}.intensity`, time);
        const tint = evalProperty(project, comp, layer, `${pPrefix}.color`, time);

        const extRT = this.getRT(`${prefix}_glowExt`, w, h);
        const blurRT = this.getRT(`${prefix}_glowBlur`, w, h);

        this.materials.glowExtract.uniforms.tDiffuse.value = ping.texture;
        this.materials.glowExtract.uniforms.uThreshold.value = threshold;
        this.materials.glowExtract.uniforms.uTint.value.set(tint[0] ?? 1, tint[1] ?? 0.6, tint[2] ?? 0.2);
        this.runFullscreenPass(this.materials.glowExtract, extRT);

        this.applyGaussianBlurRT(extRT, blurRT, `${prefix}_glowB`, w, h, radius);

        this.materials.glowCombine.uniforms.tBase.value = ping.texture;
        this.materials.glowCombine.uniforms.tBloom.value = blurRT.texture;
        this.materials.glowCombine.uniforms.uIntensity.value = intensity;
        this.runFullscreenPass(this.materials.glowCombine, pong);
        [ping, pong] = [pong, ping];
      } else if (fx.type === 'dropShadow') {
        const color = evalProperty(project, comp, layer, `${pPrefix}.color`, time);
        const opacity = evalProperty(project, comp, layer, `${pPrefix}.opacity`, time) / 100;
        const angle = evalProperty(project, comp, layer, `${pPrefix}.angle`, time);
        const distance = evalProperty(project, comp, layer, `${pPrefix}.distance`, time);
        const softness = evalProperty(project, comp, layer, `${pPrefix}.softness`, time);

        const blurRT = this.getRT(`${prefix}_shBlur`, w, h);
        this.applyGaussianBlurRT(ping, blurRT, `${prefix}_shB`, w, h, softness);

        const rad = angle * DEG2RAD;
        const offX = (Math.cos(rad) * distance) / w;
        const offY = (-Math.sin(rad) * distance) / h;

        this.materials.dropShadow.uniforms.tBase.value = ping.texture;
        this.materials.dropShadow.uniforms.tBlurred.value = blurRT.texture;
        this.materials.dropShadow.uniforms.uOffsetUv.value.set(offX, offY);
        this.materials.dropShadow.uniforms.uShadowColor.value.set(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 1);
        this.materials.dropShadow.uniforms.uShadowOpacity.value = opacity;
        this.runFullscreenPass(this.materials.dropShadow, pong);
        [ping, pong] = [pong, ping];
      } else if (fx.type === 'hsl') {
        const hue = evalProperty(project, comp, layer, `${pPrefix}.hue`, time);
        const sat = evalProperty(project, comp, layer, `${pPrefix}.saturation`, time);
        const light = evalProperty(project, comp, layer, `${pPrefix}.lightness`, time);

        this.materials.hsl.uniforms.tDiffuse.value = ping.texture;
        this.materials.hsl.uniforms.uHue.value = hue;
        this.materials.hsl.uniforms.uSaturation.value = sat;
        this.materials.hsl.uniforms.uLightness.value = light;
        this.runFullscreenPass(this.materials.hsl, pong);
        [ping, pong] = [pong, ping];
      }
    }

    this.copyTextureToRT(ping.texture, outRT);
  }

  // 光栅化图层蒙版（支持矩形/椭圆/自由路径、反转、羽化、加减交）
  rasterizeLayerMasks(project, comp, layer, worldM, w, h, time, tempKey = 'mask') {
    const masks = (layer.masks || []).filter((m) => m.enabled);
    if (masks.length === 0) return null;

    const accumRT = this.getRT(`${tempKey}_accum`, w, h);
    const singleRT = this.getRT(`${tempKey}_single`, w, h);
    const blurRT = this.getRT(`${tempKey}_blur`, w, h);
    const nextRT = this.getRT(`${tempKey}_next`, w, h);

    // 若首个蒙版为相减或全部反转，底色初始化策略与 AE 一致
    let initialized = false;

    for (let i = 0; i < layer.masks.length; i++) {
      const m = layer.masks[i];
      if (!m.enabled) continue;
      const path = evalProperty(project, comp, layer, `masks.${i}.path`, time);
      const feather = evalProperty(project, comp, layer, `masks.${i}.feather`, time);
      const opacity = evalProperty(project, comp, layer, `masks.${i}.opacity`, time) / 100;

      this._maskCanvas.width = w;
      this._maskCanvas.height = h;
      const ctx = this._maskCtx;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.setTransform(worldM[0], worldM[1], worldM[4], worldM[5], worldM[12], worldM[13]);
      ctx.beginPath();
      drawContoursToCtx(ctx, path.contours || [], true);
      ctx.fillStyle = `rgba(255,255,255,${clamp(opacity, 0, 1)})`;
      ctx.fill(path.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
      ctx.restore();

      const tex = this.uploadCanvasTexture(this._maskCanvas);
      this.copyTextureToRT(tex, singleRT);
      tex.dispose();

      if (feather > 0.1) {
        this.applyGaussianBlurRT(singleRT, blurRT, `${tempKey}_fb`, w, h, feather);
      } else {
        this.copyTextureToRT(singleRT.texture, blurRT);
      }

      if (m.inverted) {
        this.materials.maskMatte.uniforms.tLayer.value = this.getWhiteTex();
        this.materials.maskMatte.uniforms.tMatte.value = blurRT.texture;
        this.materials.maskMatte.uniforms.uMode.value = 1; // alphaInverted
        this.runFullscreenPass(this.materials.maskMatte, singleRT);
        this.copyTextureToRT(singleRT.texture, blurRT);
      }

      if (!initialized) {
        if (m.mode === 'subtract') {
          this.renderer.setRenderTarget(accumRT);
          this.renderer.setClearColor(0xffffff, 1);
          this.renderer.clear(true, false, false);
        } else {
          this.copyTextureToRT(blurRT.texture, accumRT);
          initialized = true;
          continue;
        }
        initialized = true;
      }

      if (m.mode === 'subtract') {
        this.materials.maskMatte.uniforms.tLayer.value = accumRT.texture;
        this.materials.maskMatte.uniforms.tMatte.value = blurRT.texture;
        this.materials.maskMatte.uniforms.uMode.value = 1; // 1 - mask
        this.runFullscreenPass(this.materials.maskMatte, nextRT);
      } else if (m.mode === 'intersect') {
        this.materials.maskMatte.uniforms.tLayer.value = accumRT.texture;
        this.materials.maskMatte.uniforms.tMatte.value = blurRT.texture;
        this.materials.maskMatte.uniforms.uMode.value = 0; // accum * mask
        this.runFullscreenPass(this.materials.maskMatte, nextRT);
      } else {
        // add
        this.materials.compositeBlend.uniforms.tDst.value = accumRT.texture;
        this.materials.compositeBlend.uniforms.tSrc.value = blurRT.texture;
        this.materials.compositeBlend.uniforms.uBlendMode.value = 2; // screen/add union feel
        this.materials.compositeBlend.uniforms.uOpacity.value = 1;
        this.runFullscreenPass(this.materials.compositeBlend, nextRT);
      }
      this.copyTextureToRT(nextRT.texture, accumRT);
    }

    return accumRT;
  }

  getWhiteTex() {
    if (!this._whiteTex) {
      const data = new Uint8Array([255, 255, 255, 255]);
      this._whiteTex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
      this._whiteTex.needsUpdate = true;
    }
    return this._whiteTex;
  }

  // 绘制 2D 图层内容到 Canvas（形状/文字/图钉变形）
  draw2DLayerContentToCanvas(project, comp, layer, ctx, w, h, worldM, time, isLocalOnly = false) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (!isLocalOnly) {
      ctx.setTransform(worldM[0], worldM[1], worldM[4], worldM[5], worldM[12], worldM[13]);
    } else {
      ctx.setTransform(1, 0, 0, 1, w * 0.5, h * 0.5);
    }

    if (layer.type === 'shape') {
      const geom = evaluateShapeLayerGeometry(
        project,
        comp,
        layer,
        time,
        (pr, cm, gid, nid, t) => this._evalNodeGraphFn?.(pr, cm, gid, nid, t)
      );
      const fillOn = layer.shape.fill?.enabled;
      const strokeOn = layer.shape.stroke?.enabled;
      const fillCol = fillOn ? evalProperty(project, comp, layer, 'shape.fill.color', time) : [1, 1, 1, 1];
      const fillOp = fillOn ? evalProperty(project, comp, layer, 'shape.fill.opacity', time) / 100 : 1;
      const strokeCol = strokeOn ? evalProperty(project, comp, layer, 'shape.stroke.color', time) : [1, 1, 1, 1];
      const strokeW = strokeOn ? evalProperty(project, comp, layer, 'shape.stroke.width', time) : 2;
      const strokeOp = strokeOn ? evalProperty(project, comp, layer, 'shape.stroke.opacity', time) / 100 : 1;

      // 若包含图钉变形，使用剖分后的 2D 三角网格变形绘制
      if (layer.shape.puppetPins && layer.shape.puppetPins.length > 0 && fillOn) {
        const mp = pathShapeToMultiPolygon({ fillRule: geom.fillRule, contours: geom.contours }, 8);
        const baseMesh = triangulateMultiPolygon(mp, 26, 2);
        const evalPins = layer.shape.puppetPins.map((pin, idx) => ({
          ...pin,
          evalPos: evalProperty(project, comp, layer, `shape.puppetPins.${idx}.pos`, time),
          evalRotation: evalProperty(project, comp, layer, `shape.puppetPins.${idx}.rotation`, time),
          evalScale: evalProperty(project, comp, layer, `shape.puppetPins.${idx}.scale`, time),
        }));
        const defMesh = deformMesh2DWithPins(baseMesh, evalPins);
        const css = colorArrToCss(fillCol, fillOp);
        ctx.fillStyle = css;
        ctx.strokeStyle = css;
        ctx.lineWidth = 0.6;
        const pos = defMesh.positions;
        const idx = defMesh.indices;
        for (let t = 0; t < idx.length; t += 3) {
          const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
          ctx.beginPath();
          ctx.moveTo(pos[i0 * 2], pos[i0 * 2 + 1]);
          ctx.lineTo(pos[i1 * 2], pos[i1 * 2 + 1]);
          ctx.lineTo(pos[i2 * 2], pos[i2 * 2 + 1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else {
        const instances = geom.instances || [{ contours: geom.contours, opacity: 1 }];
        for (const inst of instances) {
          if (!inst.contours || inst.contours.length === 0) continue;
          ctx.beginPath();
          drawContoursToCtx(ctx, inst.contours, true);
          if (fillOn) {
            ctx.fillStyle = colorArrToCss(fillCol, fillOp * inst.opacity);
            ctx.fill(geom.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
          }
          if (strokeOn && strokeW > 0) {
            ctx.strokeStyle = colorArrToCss(strokeCol, strokeOp * inst.opacity);
            ctx.lineWidth = strokeW;
            ctx.lineCap = layer.shape.stroke.lineCap || 'round';
            ctx.lineJoin = layer.shape.stroke.lineJoin || 'round';
            ctx.stroke();
          }
        }
      }
    } else if (layer.type === 'text') {
      const tCfg = layer.text;
      const fontSize = evalProperty(project, comp, layer, 'text.fontSize', time);
      const lineHeight = evalProperty(project, comp, layer, 'text.lineHeight', time);
      const tracking = evalProperty(project, comp, layer, 'text.tracking', time);
      const fillCol = evalProperty(project, comp, layer, 'text.fillColor', time);
      const strokeCol = evalProperty(project, comp, layer, 'text.strokeColor', time);
      const strokeW = evalProperty(project, comp, layer, 'text.strokeWidth', time);

      const layout = layoutText(tCfg.content, {
        fontId: tCfg.fontId,
        fontSize,
        lineHeight,
        tracking,
        align: tCfg.align,
      });

      // 若文字启用图钉，先合并字形并三角剖分变形
      if (tCfg.puppetPins && tCfg.puppetPins.length > 0 && tCfg.fillEnabled) {
        const geo = textToGeometry(tCfg.content, {
          fontId: tCfg.fontId,
          fontSize,
          lineHeight,
          tracking,
          align: tCfg.align,
        });
        const baseMesh = triangulateMultiPolygon(geo.cleanMultiPolygon, 24, 2);
        const evalPins = tCfg.puppetPins.map((pin, idx) => ({
          ...pin,
          evalPos: evalProperty(project, comp, layer, `text.puppetPins.${idx}.pos`, time),
          evalRotation: evalProperty(project, comp, layer, `text.puppetPins.${idx}.rotation`, time),
          evalScale: evalProperty(project, comp, layer, `text.puppetPins.${idx}.scale`, time),
        }));
        const defMesh = deformMesh2DWithPins(baseMesh, evalPins);
        const css = colorArrToCss(fillCol, 1);
        ctx.fillStyle = css;
        ctx.strokeStyle = css;
        ctx.lineWidth = 0.6;
        const pos = defMesh.positions;
        const idx = defMesh.indices;
        for (let t = 0; t < idx.length; t += 3) {
          const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
          ctx.beginPath();
          ctx.moveTo(pos[i0 * 2], pos[i0 * 2 + 1]);
          ctx.lineTo(pos[i1 * 2], pos[i1 * 2 + 1]);
          ctx.lineTo(pos[i2 * 2], pos[i2 * 2 + 1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else {
        const anim = tCfg.animator;
        let animState = null;
        if (anim && anim.enabled) {
          animState = {
            unit: anim.unit,
            shape: anim.shape,
            start: evalProperty(project, comp, layer, 'text.animator.start', time),
            end: evalProperty(project, comp, layer, 'text.animator.end', time),
            offset: evalProperty(project, comp, layer, 'text.animator.offset', time),
            smoothness: evalProperty(project, comp, layer, 'text.animator.smoothness', time),
            position: evalProperty(project, comp, layer, 'text.animator.position', time),
            rotation: evalProperty(project, comp, layer, 'text.animator.rotation', time),
            scale: evalProperty(project, comp, layer, 'text.animator.scale', time),
            opacity: evalProperty(project, comp, layer, 'text.animator.opacity', time),
          };
        }

        for (const item of layout.items) {
          let contours = item.contours;
          let charOp = 1;
          if (animState) {
            const wgt = computeAnimatorWeight(item, layout, animState);
            if (wgt > 1e-4) {
              const dx = (animState.position[0] || 0) * wgt;
              const dy = (animState.position[1] || 0) * wgt;
              const rot = (animState.rotation || 0) * wgt;
              const sx = lerp(1, (animState.scale[0] ?? 100) / 100, wgt);
              const sy = lerp(1, (animState.scale[1] ?? 100) / 100, wgt);
              charOp = lerp(1, clamp((animState.opacity ?? 100) / 100, 0, 1), wgt);
              contours = transformCharItemContours(item, dx, dy, rot, sx, sy);
            }
          }
          if (charOp <= 1e-4 || contours.length === 0) continue;
          ctx.beginPath();
          drawContoursToCtx(ctx, contours, true);
          if (tCfg.fillEnabled) {
            ctx.fillStyle = colorArrToCss(fillCol, charOp);
            ctx.fill('nonzero');
          }
          if (tCfg.strokeEnabled && strokeW > 0) {
            ctx.strokeStyle = colorArrToCss(strokeCol, charOp);
            ctx.lineWidth = strokeW;
            ctx.lineJoin = 'round';
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();
  }

  // 渲染单个 2D 图层（含预合成、蒙版与效果栈）返回 RGBA RT
  renderLayer2DFBO(project, comp, layer, evalTime, w, h, keyPrefix, compDepthSet, evalNodeGraphFn) {
    const layerRT = this.getRT(`${keyPrefix}_raw`, w, h);
    const fxRT = this.getRT(`${keyPrefix}_fx`, w, h);
    const worldM = getLayerWorldMatrix(project, comp, layer, evalTime);

    if (layer.type === 'precomp') {
      const childComp = getCompById(project, layer.precomp?.compId);
      if (childComp && !compDepthSet.has(childComp.id)) {
        const localTime = layer.precomp.timeRemapEnabled
          ? evalProperty(project, comp, layer, 'precomp.timeRemap', evalTime)
          : evalTime - (layer.startTime || 0);
        const childRT = this.renderCompToRT(project, childComp, localTime, {
          keyPrefix: `${keyPrefix}_sub`,
          compDepthSet,
          evalNodeGraphFn,
          skipMotionBlur: true,
          forcedW: childComp.width,
          forcedH: childComp.height,
        });
        // 使用与 3D 平面相同的标准 Y-up 正交相机与 aeWorldMatrixToThree，确保预合成坐标与纹理方向完全一致
        const preScene = new THREE.Scene();
        const preCam = new THREE.OrthographicCamera(-w * 0.5, w * 0.5, h * 0.5, -h * 0.5, -1000, 1000);
        const quadGeo = new THREE.PlaneGeometry(childComp.width, childComp.height);
        quadGeo.translate(childComp.width * 0.5, -childComp.height * 0.5, 0);
        const mat = new THREE.MeshBasicMaterial({
          map: childRT.texture,
          transparent: false,
          blending: THREE.NoBlending,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(quadGeo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(aeWorldMatrixToThree(worldM, w, h));
        preScene.add(mesh);
        this.renderer.setRenderTarget(layerRT);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear(true, false, false);
        this.renderer.render(preScene, preCam);
        quadGeo.dispose();
        mat.dispose();
      } else {
        this.renderer.setRenderTarget(layerRT);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear(true, false, false);
      }
    } else {
      this._2dCanvas.width = w;
      this._2dCanvas.height = h;
      this.draw2DLayerContentToCanvas(project, comp, layer, this._2dCtx, w, h, worldM, evalTime, false);
      const tex = this.uploadCanvasTexture(this._2dCanvas);
      this.copyTextureToRT(tex, layerRT);
      tex.dispose();
    }

    // 应用本图层蒙版
    const maskRT = this.rasterizeLayerMasks(project, comp, layer, worldM, w, h, evalTime, `${keyPrefix}_m`);
    if (maskRT) {
      const maskedRT = this.getRT(`${keyPrefix}_masked`, w, h);
      this.materials.maskMatte.uniforms.tLayer.value = layerRT.texture;
      this.materials.maskMatte.uniforms.tMatte.value = maskRT.texture;
      this.materials.maskMatte.uniforms.uMode.value = 0;
      this.runFullscreenPass(this.materials.maskMatte, maskedRT);
      this.copyTextureToRT(maskedRT.texture, layerRT);
    }

    // 应用效果栈（可伸出图层原边界）
    this.applyEffectsStack(project, comp, layer, layerRT, fxRT, w, h, evalTime, `${keyPrefix}_fx`);
    return fxRT;
  }

  // 构建粒子亮核柔光纹理
  getSparkTexture() {
    if (this._sparkTex) return this._sparkTex;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.28, 'rgba(255,245,210,0.92)');
    grad.addColorStop(0.65, 'rgba(255,160,40,0.4)');
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    this._sparkTex = new THREE.CanvasTexture(c);
    return this._sparkTex;
  }

  // 渲染统一 3D 空间（实体的凹凸/孔洞/PBR/反射/真实阴影、3D平面、粒子与拖尾同深度遮挡、物理景深）
  render3DBin(project, comp, layers3D, frozenTime, subTime, w, h, keyPrefix, compDepthSet, evalNodeGraphFn) {
    const scene = new THREE.Scene();
    scene.environment = this.envRT.texture;

    const getLayerEvalTime = (lyr) => (lyr.motionBlur ? subTime : frozenTime);

    // 1. 解析主摄像机（或默认 AE 摄像机）
    const activeCamLayer = comp.layers.find((l) => l.type === 'camera' && isLayerActiveAtTime(l, frozenTime));
    let camFov = 40;
    let focusDist = 950;
    let aperture = 0;
    let threeCam;

    if (activeCamLayer) {
      const camT = getLayerEvalTime(activeCamLayer);
      camFov = evalProperty(project, comp, activeCamLayer, 'camera.fov', camT);
      focusDist = evalProperty(project, comp, activeCamLayer, 'camera.focusDistance', camT);
      aperture = activeCamLayer.camera.dofEnabled ? evalProperty(project, comp, activeCamLayer, 'camera.aperture', camT) : 0;

      threeCam = new THREE.PerspectiveCamera(camFov, w / h, 10, 9000);
      const camWorldM = getLayerWorldMatrix(project, comp, activeCamLayer, camT);
      const camWorldPosAE = mat4TransformPoint(camWorldM, [0, 0, 0]);
      const camPosGL = aeVecToThree(camWorldPosAE, comp.width, comp.height);
      threeCam.position.copy(camPosGL);

      if (activeCamLayer.camera.useTarget) {
        const tgtAE = evalProperty(project, comp, activeCamLayer, 'camera.target', camT);
        const tgtGL = aeVecToThree(tgtAE, comp.width, comp.height);
        threeCam.lookAt(tgtGL);
        const roll = evalProperty(project, comp, activeCamLayer, 'transform.rotationZ', camT);
        if (Math.abs(roll) > 1e-3) threeCam.rotateZ(-roll * DEG2RAD);
      } else {
        const camMat = aeWorldMatrixToThree(camWorldM, comp.width, comp.height);
        threeCam.matrixAutoUpdate = false;
        threeCam.matrix.copy(camMat);
        threeCam.matrixWorldNeedsUpdate = true;
      }
      threeCam.updateMatrixWorld(true);
    } else {
      const dist = (comp.height * 0.5) / Math.tan((camFov * 0.5) * DEG2RAD);
      threeCam = new THREE.PerspectiveCamera(camFov, w / h, 10, 9000);
      threeCam.position.set(0, 0, dist);
      threeCam.lookAt(0, 0, 0);
      threeCam.updateMatrixWorld(true);
      focusDist = dist;
    }

    this._lastCamera = threeCam;

    // 2. 设置灯光（用户灯光层全权生效，仅当合成里完全没有启用灯光时提供柔和默认摄影光）
    const activeLights = comp.layers.filter((l) => l.type === 'light' && isLayerActiveAtTime(l, frozenTime));
    const disposables = [];

    if (activeLights.length === 0) {
      const amb = new THREE.AmbientLight(0xdbeafe, 0.55);
      const key = new THREE.DirectionalLight(0xfff1dc, 1.85);
      key.position.set(-380, 460, 620);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 50;
      key.shadow.camera.far = 2500;
      key.shadow.camera.left = -750;
      key.shadow.camera.right = 750;
      key.shadow.camera.top = 750;
      key.shadow.camera.bottom = -750;
      scene.add(amb, key);
    } else {
      // 微弱环境底光避免纯黑背光面死黑
      scene.add(new THREE.HemisphereLight(0x9fb8db, 0x2b170b, 0.32));
      for (const lLyr of activeLights) {
        const lt = getLayerEvalTime(lLyr);
        const lCol = evalProperty(project, comp, lLyr, 'light.color', lt);
        const lInt = evalProperty(project, comp, lLyr, 'light.intensity', lt);
        const lWorldM = getLayerWorldMatrix(project, comp, lLyr, lt);
        const lPosAE = mat4TransformPoint(lWorldM, [0, 0, 0]);
        const lPosGL = aeVecToThree(lPosAE, comp.width, comp.height);
        const col = new THREE.Color(lCol[0] ?? 1, lCol[1] ?? 1, lCol[2] ?? 1);
        const kind = lLyr.light.lightType || 'point';

        if (kind === 'ambient') {
          scene.add(new THREE.AmbientLight(col, lInt));
        } else if (kind === 'directional') {
          const dl = new THREE.DirectionalLight(col, lInt);
          dl.position.copy(lPosGL);
          const tgtAE = evalProperty(project, comp, lLyr, 'light.target', lt);
          dl.target.position.copy(aeVecToThree(tgtAE, comp.width, comp.height));
          scene.add(dl.target);
          if (lLyr.light.castShadow) {
            dl.castShadow = true;
            dl.shadow.mapSize.set(2048, 2048);
            dl.shadow.bias = -(lLyr.light.shadowBias ?? 0.0008);
            dl.shadow.normalBias = 2.0;
            dl.shadow.camera.near = 40;
            dl.shadow.camera.far = 3200;
            dl.shadow.camera.left = -820;
            dl.shadow.camera.right = 820;
            dl.shadow.camera.top = 820;
            dl.shadow.camera.bottom = -820;
          }
          scene.add(dl);
        } else {
          // PointLight: decay=0 使 AE 像素空间距离下强度直觉可控
          const pl = new THREE.PointLight(col, lInt, 3600, 0);
          pl.position.copy(lPosGL);
          if (lLyr.light.castShadow) {
            pl.castShadow = true;
            pl.shadow.mapSize.set(1024, 1024);
            pl.shadow.bias = -(lLyr.light.shadowBias ?? 0.0008);
            pl.shadow.normalBias = 2.2;
            pl.shadow.camera.near = 25;
            pl.shadow.camera.far = 2600;
          }
          scene.add(pl);
        }
      }
    }

    const pickables = [];

    // 3. 添加 3D 实体、3D 平面图层与粒子系统
    for (const lyr of layers3D) {
      const lt = getLayerEvalTime(lyr);
      const op = clamp(evalProperty(project, comp, lyr, 'transform.opacity', lt) / 100, 0, 1);
      if (op <= 1e-4) continue;
      const worldM = getLayerWorldMatrix(project, comp, lyr, lt);
      const threeM = aeWorldMatrixToThree(worldM, comp.width, comp.height);

      if (lyr.type === 'mesh3d') {
        const localMesh = evaluateMesh3DLayerLocal(project, comp, lyr, lt);
        if (!localMesh || localMesh.triangleCount === 0) continue;

        // 缓存 GPU BufferGeometry（motion blur 多次子采样与静止帧零拷贝复用）
        if (!this._glMeshGeoCache) this._glMeshGeoCache = new Map();
        let geo = this._glMeshGeoCache.get(localMesh);
        if (!geo) {
          // 将局部 AE 坐标 (x,y,z) 转换到 Three.js 局部坐标 (x,-y,-z)
          const vCount = localMesh.vertexCount;
          const posGL = new Float32Array(vCount * 3);
          const normGL = new Float32Array(vCount * 3);
          for (let i = 0; i < vCount; i++) {
            posGL[i * 3] = localMesh.positions[i * 3];
            posGL[i * 3 + 1] = -localMesh.positions[i * 3 + 1];
            posGL[i * 3 + 2] = -localMesh.positions[i * 3 + 2];
            normGL[i * 3] = localMesh.normals[i * 3];
            normGL[i * 3 + 1] = -localMesh.normals[i * 3 + 1];
            normGL[i * 3 + 2] = -localMesh.normals[i * 3 + 2];
          }
          geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(posGL, 3));
          geo.setAttribute('normal', new THREE.BufferAttribute(normGL, 3));
          geo.setAttribute('uv', new THREE.BufferAttribute(localMesh.uvs, 2));
          geo.setIndex(new THREE.BufferAttribute(localMesh.indices, 1));
          this._glMeshGeoCache.set(localMesh, geo);
          if (this._glMeshGeoCache.size > 48) {
            const oldKey = this._glMeshGeoCache.keys().next().value;
            const oldGeo = this._glMeshGeoCache.get(oldKey);
            this._glMeshGeoCache.delete(oldKey);
            oldGeo?.dispose();
          }
        } else {
          this._glMeshGeoCache.delete(localMesh);
          this._glMeshGeoCache.set(localMesh, geo);
        }

        const baseCol = evalProperty(project, comp, lyr, 'mesh3d.material.baseColor', lt);
        const metalness = clamp(evalProperty(project, comp, lyr, 'mesh3d.material.metalness', lt), 0, 1);
        const roughness = clamp(evalProperty(project, comp, lyr, 'mesh3d.material.roughness', lt), 0.02, 1);
        const emCol = evalProperty(project, comp, lyr, 'mesh3d.material.emissiveColor', lt);
        const emInt = Math.max(0, evalProperty(project, comp, lyr, 'mesh3d.material.emissiveIntensity', lt));
        const matOp = clamp(evalProperty(project, comp, lyr, 'mesh3d.material.opacity', lt) / 100, 0, 1);
        const finalOp = op * matOp;

        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(baseCol[0] ?? 0.7, baseCol[1] ?? 0.7, baseCol[2] ?? 0.7),
          metalness,
          roughness,
          emissive: new THREE.Color(emCol[0] ?? 1, emCol[1] ?? 0.3, emCol[2] ?? 0.05),
          emissiveIntensity: emInt,
          envMapIntensity: 1.35,
          transparent: finalOp < 0.995,
          opacity: finalOp,
          depthWrite: finalOp >= 0.995,
          side: THREE.FrontSide,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(threeM);
        mesh.castShadow = !!lyr.mesh3d.castShadow;
        mesh.receiveShadow = !!lyr.mesh3d.receiveShadow;
        mesh.userData = { layerId: lyr.id };
        scene.add(mesh);
        pickables.push(mesh);
        disposables.push(mat);
      } else if (lyr.type === 'shape' || lyr.type === 'text' || lyr.type === 'precomp') {
        // 3D 空间中的 2D 矢量/文字/预合成平面（透明部分 alphaTest 丢弃，绝不整块挡住后方）
        const planeW = comp.width;
        const planeH = comp.height;
        const texRT = this.getRT(`${keyPrefix}_3dplane_${lyr.id}`, planeW, planeH);

        if (lyr.type === 'precomp') {
          const childComp = getCompById(project, lyr.precomp?.compId);
          if (childComp && !compDepthSet.has(childComp.id)) {
            const localTime = lyr.precomp.timeRemapEnabled
              ? evalProperty(project, comp, lyr, 'precomp.timeRemap', lt)
              : lt - (lyr.startTime || 0);
            const cRT = this.renderCompToRT(project, childComp, localTime, {
              keyPrefix: `${keyPrefix}_3dpre_${lyr.id}`,
              compDepthSet,
              evalNodeGraphFn,
              skipMotionBlur: true,
              forcedW: planeW,
              forcedH: planeH,
            });
            this.applyEffectsStack(project, comp, lyr, cRT, texRT, planeW, planeH, lt, `${keyPrefix}_3dfx_${lyr.id}`);
          }
        } else {
          this._2dCanvas.width = planeW;
          this._2dCanvas.height = planeH;
          this.draw2DLayerContentToCanvas(project, comp, lyr, this._2dCtx, planeW, planeH, mat4Identity(), lt, true);
          const rawTex = this.uploadCanvasTexture(this._2dCanvas);
          const rawRT = this.getRT(`${keyPrefix}_3dpraw_${lyr.id}`, planeW, planeH);
          this.copyTextureToRT(rawTex, rawRT);
          rawTex.dispose();
          this.applyEffectsStack(project, comp, lyr, rawRT, texRT, planeW, planeH, lt, `${keyPrefix}_3dfx_${lyr.id}`);
        }

        const geo = new THREE.PlaneGeometry(planeW, planeH);
        if (lyr.type === 'precomp') {
          geo.translate(planeW * 0.5, -planeH * 0.5, 0);
        }
        const mat = new THREE.MeshStandardMaterial({
          map: texRT.texture,
          transparent: true,
          premultipliedAlpha: true,
          opacity: op,
          alphaTest: 0.03,
          roughness: 0.5,
          metalness: 0.05,
          emissive: new THREE.Color(1, 1, 1),
          emissiveMap: texRT.texture,
          emissiveIntensity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: op >= 0.99,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(threeM);
        mesh.userData = { layerId: lyr.id, isPlane: true, rt: texRT };
        scene.add(mesh);
        pickables.push(mesh);
        disposables.push(geo, mat);
      } else if (lyr.type === 'particle') {
        const sim = evaluateParticleSystemAtTime(project, comp, lyr, lt);

        // 粒子拖尾带（相机朝向三维丝带，参与三维遮挡）
        if (sim.trailEnabled && sim.particles.length > 0) {
          const camDir = new THREE.Vector3();
          threeCam.getWorldDirection(camDir);
          const tPos = [];
          const tCol = [];
          const tIdx = [];
          let vBase = 0;
          const baseWidth = Math.max(0.5, sim.trailWidth || 3);
          const tColBase = sim.trailColor || [1, 0.6, 0.15, 1];
          const fadePow = clamp(sim.trailFade ?? 0.85, 0.05, 1);

          for (const pt of sim.particles) {
            const tr = pt.trail;
            if (!tr || tr.length < 2) continue;
            const nPts = tr.length;
            const pColor = pt.color;
            for (let j = 0; j < nPts; j++) {
              const u = j / (nPts - 1); // 0 尾端 -> 1 头端
              const cur = aeVecToThree([tr[j][1], tr[j][2], tr[j][3]], comp.width, comp.height);
              const prev = j > 0 ? aeVecToThree([tr[j - 1][1], tr[j - 1][2], tr[j - 1][3]], comp.width, comp.height) : cur;
              const next = j < nPts - 1 ? aeVecToThree([tr[j + 1][1], tr[j + 1][2], tr[j + 1][3]], comp.width, comp.height) : cur;
              const tang = next.clone().sub(prev);
              if (tang.lengthSq() < 1e-6) tang.set(0, 1, 0);
              tang.normalize();
              const side = new THREE.Vector3().crossVectors(tang, camDir).normalize();
              const hw = baseWidth * 0.5 * lerp(0.15, 1.0, u);
              const alpha = Math.pow(u, 1 + fadePow * 1.5) * (pColor[3] ?? 1) * (tColBase[3] ?? 1) * op;

              const pL = cur.clone().addScaledVector(side, hw);
              const pR = cur.clone().addScaledVector(side, -hw);
              tPos.push(pL.x, pL.y, pL.z, pR.x, pR.y, pR.z);
              const cr = lerp(tColBase[0], pColor[0], u) * alpha;
              const cg = lerp(tColBase[1], pColor[1], u) * alpha;
              const cb = lerp(tColBase[2], pColor[2], u) * alpha;
              tCol.push(cr, cg, cb, alpha, cr, cg, cb, alpha);

              if (j < nPts - 1) {
                const a = vBase + j * 2;
                tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
              }
            }
            vBase += nPts * 2;
          }

          if (tIdx.length > 0) {
            const tGeo = new THREE.BufferGeometry();
            tGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
            tGeo.setAttribute('color', new THREE.Float32BufferAttribute(tCol, 4));
            tGeo.setIndex(tIdx);
            const tMat = new THREE.MeshBasicMaterial({
              vertexColors: true,
              transparent: true,
              depthTest: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
              side: THREE.DoubleSide,
            });
            const tMesh = new THREE.Mesh(tGeo, tMat);
            scene.add(tMesh);
            disposables.push(tGeo, tMat);
          }
        }

        // 粒子高亮火花公告板（参与真实 3D 深度缓冲遮挡）
        if (sim.particles.length > 0) {
          const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(threeCam.quaternion);
          const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(threeCam.quaternion);
          const pCount = sim.particles.length;
          const pPos = new Float32Array(pCount * 12);
          const pUv = new Float32Array(pCount * 8);
          const pCol = new Float32Array(pCount * 16);
          const pIdx = new Uint32Array(pCount * 6);

          for (let i = 0; i < pCount; i++) {
            const pt = sim.particles[i];
            const c = aeVecToThree([pt.x, pt.y, pt.z], comp.width, comp.height);
            const hs = Math.max(0.5, pt.size * 0.65);
            const rx = camRight.x * hs, ry = camRight.y * hs, rz = camRight.z * hs;
            const ux = camUp.x * hs, uy = camUp.y * hs, uz = camUp.z * hs;

            const vOff = i * 4;
            // 0: BL, 1: BR, 2: TR, 3: TL
            pPos.set(
              [
                c.x - rx - ux, c.y - ry - uy, c.z - rz - uz,
                c.x + rx - ux, c.y + ry - uy, c.z + rz - uz,
                c.x + rx + ux, c.y + ry + uy, c.z + rz + uz,
                c.x - rx + ux, c.y - ry + uy, c.z - rz + uz,
              ],
              i * 12
            );
            pUv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
            const a = clamp((pt.color[3] ?? 1) * op, 0, 1);
            const r = (pt.color[0] ?? 1) * 1.35 * a;
            const g = (pt.color[1] ?? 0.8) * 1.25 * a;
            const b = (pt.color[2] ?? 0.4) * 1.15 * a;
            for (let k = 0; k < 4; k++) {
              pCol[i * 16 + k * 4] = r;
              pCol[i * 16 + k * 4 + 1] = g;
              pCol[i * 16 + k * 4 + 2] = b;
              pCol[i * 16 + k * 4 + 3] = a;
            }
            pIdx.set([vOff, vOff + 1, vOff + 2, vOff, vOff + 2, vOff + 3], i * 6);
          }

          const pGeo = new THREE.BufferGeometry();
          pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
          pGeo.setAttribute('uv', new THREE.BufferAttribute(pUv, 2));
          pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 4));
          pGeo.setIndex(new THREE.BufferAttribute(pIdx, 1));

          const pMat = new THREE.MeshBasicMaterial({
            map: this.getSparkTexture(),
            vertexColors: true,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          });
          const pMesh = new THREE.Mesh(pGeo, pMat);
          scene.add(pMesh);
          disposables.push(pGeo, pMat);
        }
      }
    }

    this._lastPickables = pickables;

    // 渲染 3D 场景到带 DepthTexture 的 RT，并应用景深散景 Pass
    const rt3d = this.getRT(`${keyPrefix}_3d`, w, h, { depth: true, halfFloat: true });
    this.renderer.setRenderTarget(rt3d);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, true, false);
    this.renderer.render(scene, threeCam);

    const out3dRT = this.getRT(`${keyPrefix}_3ddof`, w, h);
    const dof = this.materials.dofBokeh;
    dof.uniforms.tColor.value = rt3d.texture;
    dof.uniforms.tDepth.value = rt3d.depthTexture;
    dof.uniforms.uResolution.value.set(w, h);
    dof.uniforms.uNear.value = threeCam.near;
    dof.uniforms.uFar.value = threeCam.far;
    dof.uniforms.uFocusDistance.value = focusDist;
    dof.uniforms.uAperture.value = aperture;
    this.runFullscreenPass(dof, out3dRT);

    // 清理本帧瞬态几何，防止内存泄漏
    for (const d of disposables) d.dispose();

    return out3dRT;
  }

  // 合成完整求值（含预合成、轨道遮罩、调整层、混合模式）
  renderCompPass(project, comp, frozenTime, subTime, w, h, keyPrefix, compDepthSet, evalNodeGraphFn, frozenLayerCache = null, frozenPrefix = keyPrefix) {
    const compA = this.getRT(`${keyPrefix}_compA`, w, h);
    const compB = this.getRT(`${keyPrefix}_compB`, w, h);
    let curRT = compA;
    let nextRT = compB;

    this.renderer.setRenderTarget(curRT);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, true, false);

    // 图层栈由底向上渲染（layers[0] 在最上层，layers[len-1] 在最底层，与 AE 时间轴顺序完全一致）
    const ordered = [];
    for (let i = comp.layers.length - 1; i >= 0; i--) {
      ordered.push(comp.layers[i]);
    }

    // 记录作为其他图层轨道遮罩的源图层
    const matteSources = new Set();
    for (const l of comp.layers) {
      if (l.trackMatte?.mode && l.trackMatte.mode !== 'none' && l.trackMatte.sourceLayerId) {
        matteSources.add(l.trackMatte.sourceLayerId);
      }
    }

    const getLayerT = (l) => (l.motionBlur ? subTime : frozenTime);

    let i = 0;
    while (i < ordered.length) {
      const lyr = ordered[i];
      const lt = getLayerT(lyr);

      if (!isLayerActiveAtTime(lyr, lt)) {
        i++;
        continue;
      }
      if (lyr.type === 'null' || lyr.type === 'camera' || lyr.type === 'light' || lyr.type === 'audio') {
        i++;
        continue;
      }

      // 连续的 3D 图层合并入同一 3D 深度空间（3D Bin）
      if (lyr.is3D || lyr.type === 'mesh3d' || lyr.type === 'particle') {
        const bin = [];
        while (i < ordered.length) {
          const cand = ordered[i];
          const ct = getLayerT(cand);
          if (cand.type === 'null' || cand.type === 'camera' || cand.type === 'light' || cand.type === 'audio') {
            i++;
            continue;
          }
          if (cand.is3D || cand.type === 'mesh3d' || cand.type === 'particle') {
            if (isLayerActiveAtTime(cand, ct)) bin.push(cand);
            i++;
          } else {
            break;
          }
        }
        if (bin.length > 0) {
          const binRT = this.render3DBin(
            project,
            comp,
            bin,
            frozenTime,
            subTime,
            w,
            h,
            `${keyPrefix}_bin_${i}`,
            compDepthSet,
            evalNodeGraphFn
          );
          this.materials.compositeBlend.uniforms.tDst.value = curRT.texture;
          this.materials.compositeBlend.uniforms.tSrc.value = binRT.texture;
          this.materials.compositeBlend.uniforms.uBlendMode.value = 0;
          this.materials.compositeBlend.uniforms.uOpacity.value = 1;
          this.runFullscreenPass(this.materials.compositeBlend, nextRT);
          [curRT, nextRT] = [nextRT, curRT];
        }
        continue;
      }

      i++;

      // 调整图层：处理下方当前合成图像，受自身蒙版、不透明度与入出点限制
      if (lyr.type === 'adjustment') {
        const op = clamp(evalProperty(project, comp, lyr, 'transform.opacity', lt) / 100, 0, 1);
        if (op <= 1e-4) continue;
        const adjRT = this.getRT(`${keyPrefix}_adj_${lyr.id}`, w, h);
        this.applyEffectsStack(project, comp, lyr, curRT, adjRT, w, h, lt, `${keyPrefix}_adjfx_${lyr.id}`);

        const worldM = getLayerWorldMatrix(project, comp, lyr, lt);
        let maskRT;
        const maskCacheKey = `adjm_${lyr.id}`;
        if (frozenLayerCache && !lyr.motionBlur && frozenLayerCache.has(maskCacheKey)) {
          maskRT = frozenLayerCache.get(maskCacheKey);
        } else {
          const mPrefix = !lyr.motionBlur && frozenLayerCache ? `${frozenPrefix}_adjm_${lyr.id}` : `${keyPrefix}_adjm_${lyr.id}`;
          maskRT = this.rasterizeLayerMasks(project, comp, lyr, worldM, w, h, lt, mPrefix);
          if (frozenLayerCache && !lyr.motionBlur) frozenLayerCache.set(maskCacheKey, maskRT);
        }
        this.materials.adjustmentMerge.uniforms.tBelow.value = curRT.texture;
        this.materials.adjustmentMerge.uniforms.tAdjusted.value = adjRT.texture;
        this.materials.adjustmentMerge.uniforms.tMaskAlpha.value = maskRT ? maskRT.texture : this.getWhiteTex();
        this.materials.adjustmentMerge.uniforms.uOpacity.value = op;
        this.runFullscreenPass(this.materials.adjustmentMerge, nextRT);
        [curRT, nextRT] = [nextRT, curRT];
        continue;
      }

      // 独立充当轨道遮罩的隐身源图层，不直接作为可见层混入底图（除非它自己被显示，常规 AE 作为遮罩源后隐藏）
      if (matteSources.has(lyr.id) && !lyr.visible) {
        continue;
      }

      // 2D 图层（形状 / 文字 / 预合成）
      const op = clamp(evalProperty(project, comp, lyr, 'transform.opacity', lt) / 100, 0, 1);
      if (op <= 1e-4) continue;

      let layerRT;
      const layerCacheKey = `l2d_${lyr.id}`;
      if (frozenLayerCache && !lyr.motionBlur && frozenLayerCache.has(layerCacheKey)) {
        layerRT = frozenLayerCache.get(layerCacheKey);
      } else {
        const layerKeyPfx = !lyr.motionBlur && frozenLayerCache ? `${frozenPrefix}_frz_${lyr.id}` : `${keyPrefix}_2d_${lyr.id}`;
        layerRT = this.renderLayer2DFBO(
          project,
          comp,
          lyr,
          lt,
          w,
          h,
          layerKeyPfx,
          compDepthSet,
          evalNodeGraphFn
        );

        // 轨道遮罩（Alpha / Luma 及其反转）
        if (lyr.trackMatte?.mode && lyr.trackMatte.mode !== 'none' && lyr.trackMatte.sourceLayerId) {
          const srcM = getLayerById(comp, lyr.trackMatte.sourceLayerId);
          if (srcM && srcM !== lyr) {
            const mt = getLayerT(srcM);
            const matteRT = this.renderLayer2DFBO(
              project,
              comp,
              srcM,
              mt,
              w,
              h,
              `${layerKeyPfx}_tm`,
              compDepthSet,
              evalNodeGraphFn
            );
            const maskedOut = this.getRT(`${layerKeyPfx}_tmout`, w, h);
            this.materials.maskMatte.uniforms.tLayer.value = layerRT.texture;
            this.materials.maskMatte.uniforms.tMatte.value = matteRT.texture;
            this.materials.maskMatte.uniforms.uMode.value = MATTE_MODE_INT[lyr.trackMatte.mode] ?? 0;
            this.runFullscreenPass(this.materials.maskMatte, maskedOut);
            layerRT = maskedOut;
          }
        }
        if (frozenLayerCache && !lyr.motionBlur) frozenLayerCache.set(layerCacheKey, layerRT);
      }

      // 若该层仅作别人轨道遮罩且处于传统隐藏遮罩习惯，不直接绘出
      // 若用户同时点亮了眼睛且它是其它层遮罩源：AE 中设置轨道遮罩通常自动关闭源层眼睛，这里尊重 visible 开关；若不想重复绘制可由用户点眼睛控制
      this.materials.compositeBlend.uniforms.tDst.value = curRT.texture;
      this.materials.compositeBlend.uniforms.tSrc.value = layerRT.texture;
      this.materials.compositeBlend.uniforms.uBlendMode.value = BLEND_MODE_INT[lyr.blendMode || 'normal'] ?? 0;
      this.materials.compositeBlend.uniforms.uOpacity.value = op;
      this.runFullscreenPass(this.materials.compositeBlend, nextRT);
      [curRT, nextRT] = [nextRT, curRT];
    }

    return curRT;
  }

  // 渲染合成到离屏 RT（含快门区间内的真实运动模糊多次取样）
  renderCompToRT(project, comp, time, opts = {}) {
    const w = opts.forcedW || comp.width;
    const h = opts.forcedH || comp.height;
    const keyPrefix = opts.keyPrefix || `comp_${comp.id}`;
    const compDepthSet = new Set(opts.compDepthSet || []);
    compDepthSet.add(comp.id);
    this._evalNodeGraphFn = opts.evalNodeGraphFn || null;

    const hasMotionLayer = comp.layers.some((l) => l.motionBlur && isLayerActiveAtTime(l, time));
    const useMotionBlur = !opts.skipMotionBlur && comp.motionBlur && hasMotionLayer;

    if (!useMotionBlur) {
      return this.renderCompPass(project, comp, time, time, w, h, keyPrefix, compDepthSet, opts.evalNodeGraphFn);
    }

    const samples = opts.quality === 'export' ? 7 : opts.quality === 'scrub' ? 2 : 5;
    const frameDur = 1 / (comp.fps || 30);
    const shutterDur = frameDur * clamp((comp.shutterAngle ?? 180) / 360, 0.01, 2);
    const phaseStart = time + ((comp.shutterPhase ?? -90) / 360) * frameDur;

    let accA = this.getRT(`${keyPrefix}_mbA`, w, h, { halfFloat: true });
    let accB = this.getRT(`${keyPrefix}_mbB`, w, h, { halfFloat: true });
    this.renderer.setRenderTarget(accA);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear(true, false, false);

    const frozenLayerCache = new Map();
    const weight = 1 / samples;
    for (let s = 0; s < samples; s++) {
      const frac = samples > 1 ? s / (samples - 1) : 0.5;
      const tSub = Math.max(0, Math.min(comp.duration, phaseStart + frac * shutterDur));
      const passRT = this.renderCompPass(project, comp, time, tSub, w, h, `${keyPrefix}_mb`, compDepthSet, opts.evalNodeGraphFn, frozenLayerCache, keyPrefix);
      this.materials.accumulate.uniforms.tAccum.value = accA.texture;
      this.materials.accumulate.uniforms.tSample.value = passRT.texture;
      this.materials.accumulate.uniforms.uWeight.value = weight;
      this.runFullscreenPass(this.materials.accumulate, accB);
      [accA, accB] = [accB, accA];
    }

    return accA;
  }

  // 主渲染入口：绘制到屏幕 Canvas
  renderToCanvas(project, comp, time, opts = {}) {
    if (!comp) return;
    const renderW = opts.renderW || comp.width;
    const renderH = opts.renderH || comp.height;
    this._lastCompSize = { width: comp.width, height: comp.height };

    if (this.canvas.width !== renderW || this.canvas.height !== renderH) {
      this.renderer.setSize(renderW, renderH, false);
    }

    const finalRT = this.renderCompToRT(project, comp, time, {
      ...opts,
      forcedW: renderW,
      forcedH: renderH,
    });

    const bg = comp.backgroundColor || [0.03, 0.035, 0.045, 1];
    this.materials.finalOutput.uniforms.tComp.value = finalRT.texture;
    this.materials.finalOutput.uniforms.uBgColor.value.set(bg[0], bg[1], bg[2], bg[3] ?? 1);
    this.materials.finalOutput.uniforms.uTransparentBg.value = comp.transparentBg ? 1 : 0;
    this.runFullscreenPass(this.materials.finalOutput, null);
  }

  // 使用与三维渲染完全相同的摄像机投影将 AE 3D 点映射到归一化屏幕坐标 [0..1, 0..1]
  projectAEPointToNormalized(aePoint, comp) {
    const cam = this._lastCamera;
    if (!cam || !comp) {
      return {
        x: (aePoint[0] || 0) / (comp?.width || 1280),
        y: (aePoint[1] || 0) / (comp?.height || 720),
        visible: true,
      };
    }
    const v = aeVecToThree(aePoint, comp.width, comp.height);
    v.project(cam);
    return {
      x: (v.x + 1) * 0.5,
      y: (1 - v.y) * 0.5,
      ndcZ: v.z,
      visible: v.z >= -1 && v.z <= 1,
    };
  }

  // 返回当前活动 3D 摄像机用于控制轴逆向投影拖动
  getActiveThreeCamera() {
    return this._lastCamera;
  }

  // 在当前视图点击测试：精确命中可见三维几何表面或 2D 图层上最近的可选图层
  pickLayerAtNormalized(normX, normY, project, comp, time) {
    if (!comp) return null;
    const ndc = new THREE.Vector2(normX * 2 - 1, -(normY * 2 - 1));

    // 1. 先用 Raycaster 命中可见 3D 几何表面（最近深度胜出）
    let best3DLayerId = null;
    let bestDist = Infinity;
    if (this._lastCamera && this._lastPickables.length > 0) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, this._lastCamera);
      for (const obj of this._lastPickables) {
        const lyr = getLayerById(comp, obj.userData?.layerId);
        if (!lyr || lyr.locked || !lyr.visible) continue;
        // 确保更新逆矩阵供射线求交
        obj.updateMatrixWorld(true);
        const hits = raycaster.intersectObject(obj, false);
        if (hits.length > 0 && hits[0].distance < bestDist) {
          // 对 3D 平面检查命中点透明像素，确保透空区不遮挡后方可选几何
          if (obj.userData?.isPlane && obj.userData?.rt && hits[0].uv) {
            const rt = obj.userData.rt;
            const px = Math.max(0, Math.min(rt.width - 1, Math.floor(hits[0].uv.x * rt.width)));
            const py = Math.max(0, Math.min(rt.height - 1, Math.floor(hits[0].uv.y * rt.height)));
            const pixel = new Uint8Array(4);
            this.renderer.readRenderTargetPixels(rt, px, py, 1, 1, pixel);
            if (pixel[3] < 12) continue;
          }
          bestDist = hits[0].distance;
          best3DLayerId = lyr.id;
        }
      }
    }
    if (best3DLayerId) return best3DLayerId;

    // 2. 再检测 2D 图层（由顶到底按世界矩阵逆映射测试包围盒/路径）
    const compX = normX * comp.width;
    const compY = normY * comp.height;
    for (const lyr of comp.layers) {
      if (!isLayerActiveAtTime(lyr, time) || lyr.locked || lyr.is3D) continue;
      if (lyr.type === 'camera' || lyr.type === 'light' || lyr.type === 'audio' || lyr.type === 'adjustment') continue;
      const m = getLayerWorldMatrix(project, comp, lyr, time);
      const det = m[0] * m[5] - m[1] * m[4];
      if (Math.abs(det) < 1e-6) continue;
      const dx = compX - m[12];
      const dy = compY - m[13];
      const lx = (dx * m[5] - dy * m[4]) / det;
      const ly = (m[0] * dy - m[1] * dx) / det;

      if (lyr.type === 'null') {
        if (Math.hypot(lx, ly) < 36) return lyr.id;
      } else if (lyr.type === 'precomp') {
        const cc = getCompById(project, lyr.precomp?.compId);
        const cw = cc?.width || 400, ch = cc?.height || 400;
        if (lx >= 0 && lx <= cw && ly >= 0 && ly <= ch) return lyr.id;
      } else if (lyr.type === 'text') {
        const fs = evalProperty(project, comp, lyr, 'text.fontSize', time);
        const lines = String(lyr.text.content || '').split('\n');
        const maxLen = Math.max(1, ...lines.map((s) => s.length));
        const hw = maxLen * fs * 0.58 + 30;
        const hh = lines.length * fs * 0.7 + 30;
        if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return lyr.id;
      } else if (lyr.type === 'shape') {
        const geom = evaluateShapeLayerGeometry(project, comp, lyr, time, this._evalNodeGraphFn);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const c of geom.contours || []) {
          for (const p of flattenContour(c, 4)) {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
          }
        }
        if (lx >= minX - 18 && lx <= maxX + 18 && ly >= minY - 18 && ly <= maxY + 18) {
          return lyr.id;
        }
      }
    }

    return null;
  }
}
