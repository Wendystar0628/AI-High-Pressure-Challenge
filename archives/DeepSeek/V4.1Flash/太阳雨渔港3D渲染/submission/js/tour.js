/* =========================================================
   汐見漁港 — cinematic tour + fixed video export API
   ========================================================= */
(function (H) {
  'use strict';
  var DURATION = 62.0;
  var SHOTS = [
    { // 0 — far establishing push-in over the sea
      t0: 0, t1: 6, fov: 30,
      from: { p: [57, 40, 62], t: [-1, 0.5, -3] },
      to: { p: [39, 25.5, 45], t: [0, 0.8, -2] }
    },
    { // 1 — low glide along the quay toward the moored boats
      t0: 6, t1: 12, fov: 34,
      from: { p: [-8.0, 4.6, 16.5], t: [8.0, 1.2, 5.5] },
      to: { p: [5.0, 3.8, 14.5], t: [6.0, 1.2, 4.5] }
    },
    { // 2 — bollard gull close-up, it takes off
      t0: 12, t1: 17, fov: 30,
      from: { p: [7.6, 3.2, 12.0], t: [11.2, 1.2, 7.6] },
      to: { p: [9.4, 2.0, 9.6], t: [11.2, 1.05, 7.6] }
    },
    { // 3 — instrument cases, umbrella, puddle
      t0: 17, t1: 23, fov: 33,
      from: { p: [7.2, 3.0, 17.0], t: [1.5, 0.45, 10.3] },
      to: { p: [5.2, 2.0, 14.5], t: [1.4, 0.35, 10.2] }
    },
    { // 4 — cat by the overturned dinghy
      t0: 23, t1: 28, fov: 29,
      from: { p: [-0.8, 1.9, 13.6], t: [-3.9, 0.6, 10.2] },
      to: { p: [-2.35, 0.85, 11.9], t: [-3.9, 0.4, 10.25] }
    },
    { // 5 — the gust: nets, float rope, wind sock
      t0: 28, t1: 33, fov: 39,
      from: { p: [2.5, 4.4, 15.2], t: [-9.5, 2.3, 7.8] },
      to: { p: [-1.0, 3.7, 12.5], t: [-9.0, 2.0, 7.4] }
    },
    { // 6 — inside the wheelhouse
      t0: 33, t1: 39, fov: 32,
      from: { p: [9.2, 2.1, 11.4], t: [7.9, 1.25, 5.7] },
      to: { p: [8.7, 1.4, 8.5], t: [7.9, 1.0, 5.6] }
    },
    { // 7 — co-op warehouse interior through the shutter
      t0: 39, t1: 44, fov: 42,
      from: { p: [-5.6, 3.3, 3.0], t: [-18.5, 1.9, 3.0] },
      to: { p: [-7.2, 2.6, 3.0], t: [-18.0, 1.8, 3.0] }
    },
    { // 8 — waiting room through the glass
      t0: 44, t1: 48.5, fov: 34,
      from: { p: [12.2, 2.8, 21.0], t: [12.0, 1.45, 14.0] },
      to: { p: [9.0, 2.35, 20.0], t: [11.8, 1.35, 14.0] }
    },
    { // 9 — descend the base side into the water cutaway
      t0: 48.5, t1: 53, fov: 33,
      from: { p: [33.5, 0.4, 6.5], t: [19.5, -3.0, -6.0] },
      to: { p: [31.0, -1.8, 1.0], t: [19.5, -3.4, -6.0] }
    },
    { // 10 — lighthouse in the dark cloud, waves around tetrapods
      t0: 53, t1: 57, fov: 42,
      from: { p: [20.0, 9.0, -19.5], t: [8.6, 4.2, -13.3] },
      to: { p: [16.5, 7.5, -18.0], t: [8.6, 4.3, -13.3] }
    },
    { // 11 — follow the departing boat, then pull up over the harbour
      t0: 57, t1: 62, fov: 32,
      custom: 'boat'
    }
  ];

  var cam = null;

  function shotCamera(s, t) {
    var u = H.clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
    var e = H.easeInOut(u);
    var pos, target;
    if (s.custom === 'boat') {
      var bp = H.boatPose ? H.boatPose(t) : { x: 11.6, y: -0.3, z: -4.8 };
      var k = H.easeInOut(H.clamp(u * 1.08, 0, 1));
      var startPos = new THREE.Vector3(bp.x + 7.6, 5.4, bp.z + 6.2);
      var endPos = new THREE.Vector3(45, 27, 20);
      var startT = new THREE.Vector3(bp.x, bp.y + 1.0, bp.z);
      var endT = new THREE.Vector3(4, 0.5, -5);
      pos = startPos.lerp(endPos, k);
      var tk = H.easeInOut(H.clamp(u * 0.85, 0, 1));
      target = startT.lerp(endT, tk);
      var fov = H.lerp(30, 33, k);
      return { pos: pos, target: target, fov: fov };
    }
    var a = new THREE.Vector3(s.from.p[0], s.from.p[1], s.from.p[2]);
    var b = new THREE.Vector3(s.to.p[0], s.to.p[1], s.to.p[2]);
    pos = a.lerp(b, e);
    var ta = new THREE.Vector3(s.from.t[0], s.from.t[1], s.from.t[2]);
    var tb = new THREE.Vector3(s.to.t[0], s.to.t[1], s.to.t[2]);
    target = ta.lerp(tb, e);
    return { pos: pos, target: target, fov: s.fov };
  }

  function cameraAt(t) {
    if (!cam) cam = H.camera;
    t = H.clamp(t, 0, DURATION - 0.0001);
    var s = SHOTS[SHOTS.length - 1];
    for (var i = 0; i < SHOTS.length; i++) {
      if (t >= SHOTS[i].t0 && t < SHOTS[i].t1) { s = SHOTS[i]; break; }
    }
    var r = shotCamera(s, t);
    cam.position.copy(r.pos);
    cam.lookAt(r.target);
    cam.fov = r.fov;
    cam.updateProjectionMatrix();
  }
  H.updateCameraTour = cameraAt;
  H.TOUR_DURATION = DURATION;

  // -----------------------------------------------------------------
  // video export API
  // -----------------------------------------------------------------
  var active = false;
  var fps = 60;

  var api = {
    runs: ['tour'],
    begin: async function (runId, opts) {
      if (runId !== 'tour') throw new Error('unknown run: ' + runId);
      if (H.ensureSize) H.ensureSize();
      fps = Math.max(1, Math.round((opts && opts.fps) || 60));
      active = true;
      H.videoActive = true;
      H.resetLife();
      H.time = 0;
      H.SU.uTime.value = 0;
      cameraAt(0);
      H.renderNow(0);
      return { frames: Math.max(1, Math.round(DURATION * fps)) };
    },
    frame: async function (i) {
      if (!active) return;
      if (H.ensureSize) H.ensureSize();
      H.renderNow(i / fps);
    },
    end: function () {
      active = false;
      H.videoActive = false;
      if (H.resumeNormal) H.resumeNormal();
      if (H.setCameraFov) H.setCameraFov(31);
      H.resetLife();
      H.time = 0;
      H.SU.uTime.value = 0;
    }
  };
  window.videoExport = api;

})(window.H);
