/* 水面：平面反射 + 色块化倒影 + 波光涟漪 */
(function () {
  'use strict';
  const H = window.H;
  const L = H.L;

  const WATER_Y = L.WATER;

  H.buildWater = function (scene, renderer, camera) {
    const g = {};

    // 反射渲染目标
    const rtSize = 512;
    const reflectRT = new THREE.WebGLRenderTarget(rtSize, rtSize, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    const virtualCam = new THREE.PerspectiveCamera();
    const textureMatrix = new THREE.Matrix4();
    g.reflectRT = reflectRT;
    g.virtualCam = virtualCam;

    // 水面几何：由 WATER_RECTS 拼出 Shape
    const shape = new THREE.Shape();
    const rects = L.WATER_RECTS;
    // 逐矩形独立面片（避免复杂布尔），世界坐标 uv
    const positions = [];
    const uvs = [];
    const norms = [];
    const indices = [];
    let vi = 0;
    rects.forEach(function (r) {
      const x0 = r[0], z0 = r[1], x1 = r[2], z1 = r[3];
      // 细分网格，便于顶点波动
      const nx = Math.max(2, Math.round((x1 - x0) / 1.2));
      const nz = Math.max(2, Math.round((z1 - z0) / 1.2));
      const base = vi;
      for (let j = 0; j <= nz; j++) {
        for (let i = 0; i <= nx; i++) {
          const x = x0 + ((x1 - x0) * i) / nx;
          const z = z0 + ((z1 - z0) * j) / nz;
          positions.push(x, WATER_Y, z);
          uvs.push(x, z);
          norms.push(0, 1, 0);
          vi++;
        }
      }
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const a = base + j * (nx + 1) + i;
          const b = a + 1;
          const c = a + nx + 1;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
    geo.setIndex(indices);

    const uniforms = {
      uTime: { value: 0 },
      uReflect: { value: reflectRT.texture },
      uTexMatrix: { value: textureMatrix },
      uCamPos: { value: new THREE.Vector3() },
      uWaterColor: { value: new THREE.Color(0x6fc0c2) },
      uDeepColor: { value: new THREE.Color(0x2f7c88) },
      uSkyColor: { value: new THREE.Color(0xcfeef2) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
      uCloudShadow: { value: 1 },
      uWind: { value: 0 },
      uPosterize: { value: 5.0 },
      uFoamPoints: { value: [] },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying vec4 vReflUv;
        uniform mat4 uTexMatrix;
        // 多向正弦波
        float wave(vec2 p, float t) {
          float w = 0.0;
          w += sin(p.x * 0.9 + t * 1.1) * 0.018;
          w += sin(p.y * 1.15 - t * 0.9) * 0.015;
          w += sin((p.x + p.y) * 0.55 + t * 0.7) * 0.022;
          w += sin(p.x * 2.1 - t * 1.4) * 0.007;
          w += sin(p.y * 2.4 + t * 1.2) * 0.006;
          return w;
        }
        void main() {
          vec3 pos = position;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          wp.y += wave(wp.xz, uTime);
          vWorld = wp.xyz;
          float e = 0.25;
          float hL = wave(wp.xz + vec2(-e, 0.0), uTime);
          float hR = wave(wp.xz + vec2(e, 0.0), uTime);
          float hD = wave(wp.xz + vec2(0.0, -e), uTime);
          float hU = wave(wp.xz + vec2(0.0, e), uTime);
          vNormal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
          vReflUv = uTexMatrix * wp;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform sampler2D uReflect;
        uniform vec3 uCamPos;
        uniform vec3 uWaterColor;
        uniform vec3 uDeepColor;
        uniform vec3 uSkyColor;
        uniform vec3 uSunDir;
        uniform float uCloudShadow;
        uniform float uPosterize;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying vec4 vReflUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(uCamPos - vWorld);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
          fres = clamp(fres * 1.15, 0.0, 1.0);

          // 反射采样（波纹扭曲）
          vec2 ruv = vReflUv.xy / max(vReflUv.w, 0.0001);
          float windK = 1.0 + uWind * 2.2;
          vec2 dist = vec2(
            (sin(vWorld.x * 1.7 + uTime * 1.1) * 0.012 + sin(vWorld.z * 2.3 - uTime * 0.8) * 0.008) * windK,
            (cos(vWorld.z * 1.9 - uTime * 1.0) * 0.012 + cos(vWorld.x * 2.6 + uTime * 0.7) * 0.007) * windK
          );
          vec2 ruvB = ruv + dist;
          vec2 gridN = vec2(42.0);
          ruvB = (floor(ruvB * gridN) + 0.5) / gridN;
          vec3 refl = texture2D(uReflect, clamp(ruvB, 0.001, 0.999)).rgb;

          // 色块化（posterize）：量化亮度与色相块
          float Nq = uPosterize;
          vec3 post = floor(refl * Nq + 0.5) / Nq;
          // 向青绿/深蓝/白三色系归纳
          float lum = dot(post, vec3(0.299, 0.587, 0.114));
          vec3 tint = mix(uDeepColor, uSkyColor, smoothstep(0.15, 0.85, lum));
          tint = mix(tint, vec3(0.93, 0.97, 0.97), smoothstep(0.72, 0.98, lum));
          post = mix(post, tint, 0.36);

          // 基础水色：近深远浅
          float depth = smoothstep(-10.0, 4.0, vWorld.z) * 0.35 + smoothstep(10.0, -0.5, vWorld.x) * 0.25;
          vec3 base = mix(uDeepColor, uWaterColor, 0.45 + depth * 0.5);

          vec3 col = mix(base, post, clamp(0.56 + fres * 0.44, 0.0, 1.0));

          // 阳光高光（金白）
          vec3 R = reflect(-V, N);
          float spec = pow(max(dot(R, uSunDir), 0.0), 60.0);
          float spec2 = pow(max(dot(R, uSunDir), 0.0), 12.0);
          vec3 sunCol = mix(vec3(1.0, 0.92, 0.72), vec3(1.0), 0.4);
          col += sunCol * (spec * 0.55 + spec2 * 0.12) * uCloudShadow;

          // 细碎粼光（间歇闪烁）
          float sp = hash(floor(vWorld.xz * 9.0) + floor(uTime * 2.5));
          float glint = smoothstep(0.965, 1.0, sp) * (0.5 + 0.5 * sin(uTime * 3.0 + vWorld.x * 3.0 + vWorld.z * 2.0));
          col += vec3(1.0, 0.95, 0.8) * glint * 0.35 * uCloudShadow;

          // 雨点涟漪（细小同心圈）
          vec2 cell = floor(vWorld.xz * 1.6);
          float rc = hash(cell + 7.0);
          float ringPhase = fract(uTime * 0.55 + rc);
          vec2 cellC = cell + vec2(hash(cell + 1.3), hash(cell + 2.7));
          float d = length(vWorld.xz - cellC / 1.6);
          float ring = smoothstep(0.035, 0.0, abs(d - ringPhase * 0.42)) * (1.0 - ringPhase) * 0.24;
          col += vec3(0.95, 1.0, 0.98) * ring;

          // 远处淡雾
          float fog = smoothstep(6.0, 22.0, length(vWorld.xz - vec2(0.0, 0.0))) * 0.18;
          col = mix(col, uSkyColor, fog);

          float alpha = 0.82 + fres * 0.18;
          gl_FragColor = vec4(col, alpha);
        }`,
    });

    const surface = new THREE.Mesh(geo, mat);
    surface.renderOrder = 5;
    scene.add(surface);
    g.surface = surface;
    g.uniforms = uniforms;

    // ---- 水下色块化倒影补充：船体倒影色块（额外几何色块，贴水面） ----
    // （由 posterize 反射承担主要效果，此处加少量静态色块增强“平涂”感）
    const blockGeo = new THREE.PlaneGeometry(1, 1);
    g.reflBlocks = [];
    // 船体倒影色块（白/橙/青）
    const boatBlockColors = [0xeef2ee, 0xe8763a, 0x2e6e78, 0xdfe4de, 0x3e6e9e];
    [[-1.35, -6.6], [-1.3, -2.5], [-1.3, 1.7], [-1.35, -9.2]].forEach(function (bp, bi) {
      for (let k = 0; k < 4; k++) {
        const bm = new THREE.Mesh(blockGeo, new THREE.MeshBasicMaterial({
          color: boatBlockColors[(bi + k) % boatBlockColors.length],
          transparent: true, opacity: 0.12 + (k % 2) * 0.06, depthWrite: false,
        }));
        bm.rotation.x = -Math.PI / 2;
        bm.rotation.z = (k * 0.6 + bi) % Math.PI;
        bm.position.set(bp[0] + 0.35 + k * 0.22, WATER_Y + 0.013, bp[1] - 1.1 + k * 0.62);
        bm.scale.set(0.22 + k * 0.1, 0.9 + k * 0.35, 1);
        bm.renderOrder = 6;
        bm.userData.phase = bi + k * 0.8;
        scene.add(bm);
        g.reflBlocks.push(bm);
      }
    });
    const blockColors = [0x3e8e96, 0x2a6c78, 0x8fd0cc, 0xe8f4f2, 0x4fa3a8];
    const rng = H.makeRng(4242);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(
        blockGeo,
        new THREE.MeshBasicMaterial({
          color: blockColors[i % blockColors.length],
          transparent: true,
          opacity: 0.16 + rng() * 0.12,
          depthWrite: false,
        })
      );
      const x = -0.4 + rng() * 5.2;
      const z = -7 + rng() * 10;
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rng() * Math.PI;
      m.position.set(x, WATER_Y + 0.012, z);
      const s = 0.5 + rng() * 1.6;
      m.scale.set(s, s * (0.5 + rng() * 1.2), 1);
      m.renderOrder = 6;
      m.userData.phase = rng() * Math.PI * 2;
      scene.add(m);
      g.reflBlocks.push(m);
    }

    // ---- 泡沫（消波块之间） ----
    g.foams = [];
    const foamTex = makeFoamTex();
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.1),
        new THREE.MeshBasicMaterial({
          map: foamTex,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          color: 0xf2fbfa,
        })
      );
      const ang = (i / 10) * Math.PI * 2;
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = ang;
      m.position.set(8.1 + Math.cos(ang) * 1.3, WATER_Y + 0.02, 8.4 + Math.sin(ang) * 1.15);
      if (i >= 5) { m.position.set(6.6 + Math.cos(ang * 1.3) * 1.0, WATER_Y + 0.02, -5.8 + Math.sin(ang * 1.3) * 0.95); }
      m.userData.phase = i * 0.7;
      m.renderOrder = 7;
      scene.add(m);
      g.foams.push(m);
    }

    // ---- 反射更新 ----
    const reflNormal = new THREE.Vector3(0, 1, 0);
    const reflectorWorldPosition = new THREE.Vector3(0, WATER_Y, 0);
    const cameraWorldPosition = new THREE.Vector3();
    const rotationMatrix = new THREE.Matrix4();
    const lookAtPosition = new THREE.Vector3();
    const view = new THREE.Vector3();
    const target = new THREE.Vector3();
    const up = new THREE.Vector3();

    g.updateReflection = function (camera, hideList) {
      cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
      rotationMatrix.extractRotation(camera.matrixWorld);
      lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);
      // 镜像相机位置
      view.subVectors(reflectorWorldPosition, cameraWorldPosition);
      view.reflect(reflNormal).negate();
      view.add(reflectorWorldPosition);
      // 镜像注视点
      target.subVectors(reflectorWorldPosition, lookAtPosition);
      target.reflect(reflNormal).negate();
      target.add(reflectorWorldPosition);
      up.set(0, 1, 0).applyMatrix4(rotationMatrix);
      up.reflect(reflNormal);

      virtualCam.position.copy(view);
      virtualCam.up.copy(up);
      virtualCam.lookAt(target);
      virtualCam.near = camera.near;
      virtualCam.far = camera.far;
      virtualCam.updateMatrixWorld();
      virtualCam.projectionMatrix.copy(camera.projectionMatrix);

      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(virtualCam.projectionMatrix);
      textureMatrix.multiply(virtualCam.matrixWorldInverse);

      uniforms.uCamPos.value.copy(cameraWorldPosition);

      // 渲染反射
      surface.visible = false;
      const vis = [];
      if (hideList) {
        for (let i = 0; i < hideList.length; i++) {
          vis.push(hideList[i].visible);
          hideList[i].visible = false;
        }
      }
      const oldBg = null;
      renderer.setRenderTarget(reflectRT);
      renderer.clear();
      renderer.render(scene, virtualCam);
      renderer.setRenderTarget(null);
      surface.visible = true;
      if (hideList) {
        for (let i = 0; i < hideList.length; i++) hideList[i].visible = vis[i];
      }
      void oldBg;
    };

    g.uniforms.uTime.value = 0;
    return g;
  };

  function makeFoamTex() {
    return H.canvasTex(128, function (ctx, s) {
      ctx.clearRect(0, 0, s, s);
      const rng = H.makeRng(999);
      for (let i = 0; i < 60; i++) {
        const x = rng() * s, y = rng() * s, r = 3 + rng() * 14;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
})();
