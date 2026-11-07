/* 天空、光照、雾 */
(function () {
  'use strict';
  const H = window.H;
  const P = H.PAL;

  H.buildSky = function (scene, renderer) {
    const g = {};

    // 雾（淡青白，制造远景层次）
    scene.fog = new THREE.Fog(0xd6eef0, 26, 62);

    // 天穹（渐变 + 薄云 + 太阳光晕）
    const skyGeo = new THREE.SphereGeometry(55, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uTop: { value: new THREE.Color(0xa6d8e6) },
        uMid: { value: new THREE.Color(0xc6e8ee) },
        uLow: { value: new THREE.Color(0xe4f2f2) },
        uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
        uCloudShadow: { value: 1 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_Position.z = gl_Position.w; // 最远
        }`,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform vec3 uTop, uMid, uLow;
        uniform vec3 uSunDir;
        uniform float uCloudShadow;
        varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.1; a *= 0.5; }
          return v;
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uLow, uMid, smoothstep(0.32, 0.58, h));
          col = mix(col, uTop, smoothstep(0.55, 0.95, h));
          // 薄云
          vec2 cuv = d.xz / max(d.y + 0.28, 0.12);
          float cl = fbm(cuv * 1.1 + vec2(uTime * 0.008, uTime * 0.004));
          float cloud = smoothstep(0.48, 0.78, cl) * 0.62;
          col = mix(col, vec3(0.985, 1.0, 1.0), cloud);
          // 太阳光晕
          float sunAmt = pow(max(dot(d, uSunDir), 0.0), 26.0);
          float sunGlow = pow(max(dot(d, uSunDir), 0.0), 5.0);
          col += vec3(1.0, 0.93, 0.75) * sunGlow * 0.34 * uCloudShadow;
          col += vec3(1.0, 0.97, 0.88) * sunAmt * 0.85 * uCloudShadow;
          // 明亮高调
          col = mix(col, vec3(0.94, 0.985, 1.0), 0.12);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    scene.add(sky);
    g.sky = sky;
    g.skyMat = skyMat;

    // ---------- 灯光 ----------
    const hemi = new THREE.HemisphereLight(0xb0dce8, 0x4e8290, 0.42);
    scene.add(hemi);
    g.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xfff0d8, 0.78);
    sun.position.set(14, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 2;
    sc.far = 60;
    sun.shadow.bias = -0.0012;
    scene.add(sun);
    scene.add(sun.target);
    sun.target.position.set(0, 0, 0);
    g.sun = sun;

    // 暖色补光（水面反射上来的天光）
    const fill = new THREE.DirectionalLight(0x88c4d4, 0.15);
    fill.position.set(-10, 8, -6);
    scene.add(fill);
    g.fill = fill;

    // 金色点光（仓库光柱附近微暖）
    const warm = new THREE.PointLight(0xffe0a8, 0.25, 18, 2);
    warm.position.set(-6, 4, 0);
    scene.add(warm);
    g.warm = warm;

    // 环境光保证高调
    const amb = new THREE.AmbientLight(0xa8d0d4, 0.11);
    scene.add(amb);
    g.amb = amb;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    return g;
  };
})();
