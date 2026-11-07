/* =========================================================
   婵鍔橀々鏉款煶娴ｇ鍘?闁?renderer, sky, lights, camera, post, loop
   ========================================================= */
(function (H) {
  'use strict';

  var scene, camera, renderer, sky, sun, hemi, fill, ambient;
  var sceneRT, brightRT, blurA, blurB, reflectRT, postScene, postCam, postQuad;
  var mirrorCam;
  var clipPlane;
  var W, HGT = 0, clock;

  var state = {
    theta: 0.82,
    phi: 1.03,
    radius: 90,
    target: new THREE.Vector3(0, -0.2, -1.0),
    tTheta: 0.82,
    tPhi: 1.03,
    tRadius: 90,
    tTarget: new THREE.Vector3(0, -0.2, -1.0),
    dragging: false,
    panning: false,
    lastX: 0,
    lastY: 0,
    idle: 0
  };
  H.camState = state;

  var POST = {
    bright: null, blur: null, comp: null
  };
  var fsGeom, fsMesh;
  var postUniforms;

  // ---------------------------------------------------------------
  function init() {
    var container = document.getElementById('app');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xeaf6f4, 1);
    container.appendChild(renderer.domElement);
    H.renderer = renderer;

    scene = new THREE.Scene();
    H.scene = scene;
    scene.fog = new THREE.Fog(0xdff0ef, 58, 185);

    camera = new THREE.PerspectiveCamera(31, window.innerWidth / window.innerHeight, 0.5, 700);
    camera.position.set(40, 33, 52);
    camera.layers.enable(1); camera.layers.enable(2);
    H.camera = camera;

    mirrorCam = new THREE.PerspectiveCamera(31, window.innerWidth / window.innerHeight, 0.5, 700);
    mirrorCam.layers.set(0);

    // lighting
    hemi = new THREE.HemisphereLight(0xe6f8f6, 0x2f5f66, 0.20);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffeccb, 0.82);
    sun.position.set(34, 50, 28);
    sun.target.position.set(2, 0, -2);
    scene.add(sun);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    H.sun = sun;
    fill = new THREE.DirectionalLight(0x95d9d6, 0.07);
    fill.position.set(30, 18, -26);
    scene.add(fill);
    ambient = new THREE.AmbientLight(0xc8e8e6, 0.05);
    scene.add(ambient);
    H.hemi = hemi; H.fill = fill; H.ambient = ambient;

    // sky
    sky = makeSky();
    scene.add(sky);

    // clipping plane used by the reflection pass (always allocated -> no recompile)
    clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1000);
    renderer.clippingPlanes = [];

    buildWorldContent();

    setupPost();
    setupControls();
    window.addEventListener('resize', onResize);

    H.time = 0;
    if (H.onResizeExtra) H.onResizeExtra();
    clock = new THREE.Clock();
    onResize();
    // first frame
    updateCamera(1);
    animate();
  }

  function buildWorldContent() {
    H.buildWorld(scene);
    if (H.buildProps) H.buildProps(scene);
    if (H.buildBoats) H.buildBoats(scene);
    if (H.buildBuildings) H.buildBuildings(scene);
    if (H.buildLife) H.buildLife(scene);
  }

  function makeSky() {
    var geo = new THREE.SphereGeometry(300, 48, 24);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: H.SU.uTime,
        uCloud: H.SU.uCloud,
        uTop: { value: new THREE.Color(0x86cede) },
        uHorizon: { value: new THREE.Color(0xebf8f6) },
        uSunColor: { value: new THREE.Color(0xffe9bd) },
        uSunDir: H.SU.uSunDir
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){',
        '  vDir = normalize(position);',
        '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',
        'uniform float uTime, uCloud;',
        'uniform vec3 uTop, uHorizon, uSunColor, uSunDir;',
        'varying vec3 vDir;',
        'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
        'float noise(vec2 p){',
        '  vec2 i=floor(p), f=fract(p);',
        '  vec2 u=f*f*(3.0-2.0*f);',
        '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);',
        '}',
        'float fbm(vec2 p){',
        '  float v=0.0, a=0.5;',
        '  for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; }',
        '  return v;',
        '}',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float h = clamp(d.y, 0.0, 1.0);',
        '  vec3 col = mix(uHorizon, uTop, pow(h, 0.62));',
        '  float sd = max(dot(d, normalize(uSunDir)), 0.0);',
        '  col += uSunColor * pow(sd, 5.0) * 0.10;',
        '  col += uSunColor * pow(sd, 64.0) * 0.30;',
        '  col += uSunColor * smoothstep(0.9994,0.9999,sd) * 0.8;',
        '  // thin high clouds',
        '  if (d.y > 0.02) {',
        '    vec2 cp = d.xz / (d.y + 0.22) * 1.35 + vec2(uTime*0.0035, uTime*0.0012);',
        '    float f = fbm(cp*1.7);',
        '    float f2 = fbm(cp*3.9 + 7.0);',
        '    float band = smoothstep(0.52,0.72,f) * smoothstep(0.15,0.5,d.y);',
        '    band *= 0.55 + 0.45*smoothstep(0.35,0.7,f2);',
        '    col = mix(col, vec3(1.0,1.0,0.995), band*0.5*(1.0-uCloud*0.35));',
        '    float dark = smoothstep(0.62,0.86,f2) * smoothstep(0.1,0.4,d.y);',
        '    col = mix(col, vec3(0.80,0.87,0.88), dark*0.22);',
        '  }',
        '  // horizon haze',
        '  col = mix(col, vec3(0.95,0.985,0.975), smoothstep(0.14,0.0,abs(d.y-0.02))*0.5);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var m = new THREE.Mesh(geo, mat);
    m.renderOrder = -10;
    return m;
  }

  // ---------------------------------------------------------------
  // reflection pass
  // ---------------------------------------------------------------
  var lookTmp = new THREE.Vector3();
  var upTmp = new THREE.Vector3();
  var obPlane = new THREE.Plane();
  var obClip = new THREE.Vector4();
  var obQ = new THREE.Vector4();
  function renderReflection() {
    if (!reflectRT) return;
    camera.updateMatrixWorld();
    mirrorCam.copy(camera);
    mirrorCam.layers.set(0);
    var wy = H.L.waterY;
    mirrorCam.position.set(camera.position.x, 2 * wy - camera.position.y, camera.position.z);
    lookTmp.set(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    lookTmp.y = 2 * wy - lookTmp.y;
    upTmp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    upTmp.y = -upTmp.y;
    mirrorCam.up.copy(upTmp);
    mirrorCam.lookAt(lookTmp);
    mirrorCam.updateMatrixWorld();
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

    // oblique near plane clipped at the water surface
    obPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, wy, 0));
    obPlane.applyMatrix4(mirrorCam.matrixWorldInverse);
    obClip.set(obPlane.normal.x, obPlane.normal.y, obPlane.normal.z, obPlane.constant);
    var pm = mirrorCam.projectionMatrix;
    obQ.x = (Math.sign(obClip.x) + pm.elements[8]) / pm.elements[0];
    obQ.y = (Math.sign(obClip.y) + pm.elements[9]) / pm.elements[5];
    obQ.z = -1.0;
    obQ.w = (1.0 + pm.elements[10]) / pm.elements[14];
    var dot = obClip.x * obQ.x + obClip.y * obQ.y + obClip.z * obQ.z + obClip.w * obQ.w;
    obClip.multiplyScalar(2.0 / dot);
    pm.elements[2] = obClip.x;
    pm.elements[6] = obClip.y;
    pm.elements[10] = obClip.z + 1.0 - 0.003;
    pm.elements[14] = obClip.w;
    mirrorCam.projectionMatrixInverse.copy(pm).invert();

    var prevAutoClear = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(reflectRT);
    renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(null);
    renderer.autoClear = prevAutoClear;
  }

  // ---------------------------------------------------------------
  // post
  // ---------------------------------------------------------------
  function setupPost() {
    var w = window.innerWidth, h = window.innerHeight;
    var dpr = renderer.getPixelRatio();
    var pw = Math.floor(w * dpr), ph = Math.floor(h * dpr);
    var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
    sceneRT = new THREE.WebGLRenderTarget(pw, ph, Object.assign({ depthBuffer: true, stencilBuffer: false }, rtOpts));
    sceneRT.texture.encoding = THREE.LinearEncoding;
    reflectRT = new THREE.WebGLRenderTarget(Math.max(256, Math.floor(pw * 0.5)), Math.max(256, Math.floor(ph * 0.5)), Object.assign({ depthBuffer: true }, rtOpts));
    H.SU.tReflect.value = reflectRT.texture;
    H.debugRT = { reflectRT: reflectRT, sceneRT: sceneRT };

    var bw = Math.max(128, Math.floor(pw / 4)), bh = Math.max(128, Math.floor(ph / 4));
    brightRT = new THREE.WebGLRenderTarget(bw, bh, rtOpts);
    blurA = new THREE.WebGLRenderTarget(bw, bh, rtOpts);
    blurB = new THREE.WebGLRenderTarget(bw, bh, rtOpts);

    postScene = new THREE.Scene();
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postUniforms = {
      tDiffuse: { value: null },
      tBloom: { value: null },
      tScene: { value: null },
      uResolution: { value: new THREE.Vector2(pw, ph) },
      uBloomTexel: { value: new THREE.Vector2(1 / bw, 1 / bh) },
      uTime: H.SU.uTime,
      uCloud: H.SU.uCloud
    };

    POST.bright = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: postUniforms.tDiffuse, uThreshold: { value: 0.94 } },
      depthTest: false, depthWrite: false,
      vertexShader: FS_VERT,
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform float uThreshold;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
        '  float m = max(max(c.r,c.g),c.b);',
        '  float k = smoothstep(uThreshold, uThreshold+0.22, m);',
        '  gl_FragColor = vec4(c*k, 1.0);',
        '}'
      ].join('\n')
    });
    POST.blur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: postUniforms.tDiffuse, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: postUniforms.uBloomTexel },
      depthTest: false, depthWrite: false,
      vertexShader: FS_VERT,
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform vec2 uDir;',
        'uniform vec2 uTexel;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec2 stepv = uDir * uTexel;',
        '  vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;',
        '  sum += texture2D(tDiffuse, vUv + stepv*1.3846).rgb * 0.316216;',
        '  sum += texture2D(tDiffuse, vUv - stepv*1.3846).rgb * 0.316216;',
        '  sum += texture2D(tDiffuse, vUv + stepv*3.2308).rgb * 0.070270;',
        '  sum += texture2D(tDiffuse, vUv - stepv*3.2308).rgb * 0.070270;',
        '  gl_FragColor = vec4(sum, 1.0);',
        '}'
      ].join('\n')
    });
    POST.comp = new THREE.ShaderMaterial({
      uniforms: postUniforms,
      depthTest: false, depthWrite: false,
      vertexShader: FS_VERT,
      fragmentShader: [
        'uniform sampler2D tScene, tBloom;',
        'uniform vec2 uResolution;',
        'uniform float uTime, uCloud;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec3 c = texture2D(tScene, vUv).rgb;',
        '  vec3 b = texture2D(tBloom, vUv).rgb;',
        '  float bl = max(max(b.r,b.g),b.b);',
        '  c += b * 0.34;',
        '  c *= 0.90;',
        '  c *= 1.02;',
        '  // split-tone: cool shadows, warm highlights',
        '  float l = dot(c, vec3(0.299,0.587,0.114));',
        '  c *= mix(vec3(0.82,0.985,1.05), vec3(1.085,1.02,0.90), smoothstep(0.14,0.86,l));',
        '  c = mix(vec3(l), c, 1.28);',
        '  c = (c - 0.5) * 1.13 + 0.5 + 0.008;',
        '  c = clamp(c, 0.0, 1.0);',
        '  // gentle shoulder',
        '  c = c * (1.0 - 0.08*smoothstep(0.86,1.0,c));',
        '  // vignette',
        '  vec2 q = vUv - 0.5;',
        '  float vig = 1.0 - dot(q,q)*0.36;',
        '  c *= vig;',
        '  // tiny grain to keep gradients alive',
        '  float g = fract(sin(dot(vUv*uResolution + uTime*17.0, vec2(12.9898,78.233)))*43758.5453);',
        '  c += (g-0.5)*0.008;',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n')
    });

    fsGeom = new THREE.PlaneGeometry(2, 2);
    fsMesh = new THREE.Mesh(fsGeom, POST.comp);
    fsMesh.frustumCulled = false;
    postScene.add(fsMesh);
  }
  var FS_VERT = [
    'varying vec2 vUv;',
    'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
  ].join('\n');

  function renderPost() {
    // bright pass
    postUniforms.tDiffuse.value = sceneRT.texture;
    fsMesh.material = POST.bright;
    renderer.setRenderTarget(brightRT);
    renderer.render(postScene, postCam);
    // two blur iterations
    var bm = POST.blur;
    for (var i = 0; i < 2; i++) {
      bm.uniforms.tDiffuse.value = brightRT.texture;
      bm.uniforms.uDir.value.set(1, 0);
      fsMesh.material = bm;
      renderer.setRenderTarget(blurA);
      renderer.render(postScene, postCam);
      bm.uniforms.tDiffuse.value = blurA.texture;
      bm.uniforms.uDir.value.set(0, 1);
      renderer.setRenderTarget(blurB);
      renderer.render(postScene, postCam);
      // swap back to brightRT for next iteration input
      bm.uniforms.tDiffuse.value = blurB.texture;
      bm.uniforms.uDir.value.set(1, 0);
      fsMesh.material = bm;
      renderer.setRenderTarget(brightRT);
      renderer.render(postScene, postCam);
    }
    postUniforms.tScene.value = sceneRT.texture;
    postUniforms.tBloom.value = brightRT.texture;
    fsMesh.material = POST.comp;
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    mirrorCam.aspect = camera.aspect;
    mirrorCam.updateProjectionMatrix();
    var dpr = renderer.getPixelRatio();
    var pw = Math.floor(w * dpr), ph = Math.floor(h * dpr);
    sceneRT.setSize(pw, ph);
    reflectRT.setSize(Math.max(256, Math.floor(pw * 0.5)), Math.max(256, Math.floor(ph * 0.5)));
    var bw = Math.max(128, Math.floor(pw / 4)), bh = Math.max(128, Math.floor(ph / 4));
    brightRT.setSize(bw, bh); blurA.setSize(bw, bh); blurB.setSize(bw, bh);
    H.SU.uResolution.value.set(pw, ph);
    postUniforms.uResolution.value.set(pw, ph);
    postUniforms.uBloomTexel.value.set(1 / bw, 1 / bh);
    if (H.onResizeExtra) H.onResizeExtra();
  }

  // ---------------------------------------------------------------
  // controls
  // ---------------------------------------------------------------
  function setupControls() {
    var el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) {
      state.dragging = true;
      state.panning = (e.button === 2 || e.button === 1 || e.shiftKey);
      state.lastX = e.clientX; state.lastY = e.clientY;
      state.idle = 0;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = state.panning ? 'move' : 'grabbing';
    });
    el.addEventListener('pointermove', function (e) {
      if (!state.dragging) return;
      var dx = e.clientX - state.lastX, dy = e.clientY - state.lastY;
      state.lastX = e.clientX; state.lastY = e.clientY;
      if (state.panning) {
        var scale = state.radius * 0.0016;
        var right = new THREE.Vector3(Math.cos(state.theta), 0, -Math.sin(state.theta));
        var fwd = new THREE.Vector3(Math.sin(state.theta), 0, Math.cos(state.theta));
        state.tTarget.addScaledVector(right, -dx * scale);
        state.tTarget.addScaledVector(fwd, -dy * scale * 0.8);
        state.tTarget.x = H.clamp(state.tTarget.x, -17, 17);
        state.tTarget.z = H.clamp(state.tTarget.z, -17, 17);
        state.tTarget.y = H.clamp(state.tTarget.y, -3.5, 4);
      } else {
        state.tTheta -= dx * 0.0052;
        state.tPhi -= dy * 0.0044;
        state.tPhi = H.clamp(state.tPhi, 0.16, 1.50);
      }
      state.idle = 0;
    });
    function up(e) {
      state.dragging = false;
      el.style.cursor = 'grab';
      if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      state.tRadius *= Math.exp(e.deltaY * 0.0012);
      state.tRadius = H.clamp(state.tRadius, 7, 135);
      state.idle = 0;
    }, { passive: false });
    el.addEventListener('dblclick', function () {
      state.tTheta = 0.82; state.tPhi = 1.03; state.tRadius = 90;
      state.tTarget.set(0, -0.2, -1.0);
    });
    el.style.cursor = 'grab';
  }

  function updateCamera(dt) {
    // idle drift
    if (!state.dragging && H.time > 12) {
      state.idle += dt;
      if (state.idle > 5) state.tTheta += dt * 0.006;
    }
    var k = 1 - Math.pow(0.001, dt);
    state.theta = H.lerp(state.theta, state.tTheta, k);
    state.phi = H.lerp(state.phi, state.tPhi, k);
    state.radius = H.lerp(state.radius, state.tRadius, k);
    state.target.lerp(state.tTarget, k);
    var sp = Math.sin(state.phi);
    camera.position.set(
      state.target.x + state.radius * sp * Math.sin(state.theta),
      state.target.y + state.radius * Math.cos(state.phi),
      state.target.z + state.radius * sp * Math.cos(state.theta)
    );
    camera.lookAt(state.target);
  }

  // ---------------------------------------------------------------
  // loop
  // ---------------------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);
    if (H.videoActive) return;
    var dt = Math.min(clock.getDelta(), 0.05);
    H.time += dt;
    H.SU.uTime.value = H.time;
    updateCamera(dt);
    updateWorld();
    renderFrame();
  }

  function updateWorld() {
    if (H.updateLife) H.updateLife(H.time);
  }

  function renderFrame() {
    var cloud = H.SU.uCloud.value;
    if (H.skyEnv) H.skyEnv(cloud);
    renderReflection();
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderPost();
  }

  H.getRenderInfo = function () {
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };

  // video export normal render entry (used by tour.js)
  H.renderNow = function (t) {
    H.time = t;
    H.SU.uTime.value = t;
    if (H.updateCameraTour) H.updateCameraTour(t);
    if (H.updateLife) H.updateLife(t);
    renderFrame();
  };

  H.ensureSize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    var w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    if (renderer.domElement.width !== w || renderer.domElement.height !== h) onResize();
  };
  H.resumeNormal = function () {
    H.videoActive = false;
    if (clock) clock.getDelta();
  };
  H.setCameraFov = function (f) {
    camera.fov = f;
    camera.updateProjectionMatrix();
  };
  H.videoActive = false;

  H.init = init;
  H.updateCamera = updateCamera;

  window.addEventListener('DOMContentLoaded', init);
})(window.H);





