import * as T from "three";
const renderer = new T.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.setPixelRatio(1);
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
let cache = new Map();
function build(resource) {
  let scene = new T.Scene();
  scene.background = new T.Color(resource.background || "#b9cec0");
  if (resource.fog)
    scene.fog = new T.Fog(
      resource.background,
      resource.fog.near,
      resource.fog.far,
    );
  let nodes = {};
  for (let l of resource.lights || []) {
    let obj =
      l.type === "hemisphere"
        ? new T.HemisphereLight(l.sky, l.ground, l.intensity)
        : new T.DirectionalLight(l.color, l.intensity);
    if (l.position) obj.position.fromArray(l.position);
    if (l.type === "directional") {
      obj.castShadow = true;
      obj.shadow.mapSize.set(2048, 2048);
      Object.assign(obj.shadow.camera, {
        left: -30,
        right: 30,
        top: 30,
        bottom: -30,
        near: 0.1,
        far: 100,
      });
      obj.shadow.bias = -0.0004;
      obj.shadow.normalBias = 0.035;
    }
    scene.add(obj);
  }
  for (let n of resource.nodes || []) {
    let obj;
    if (n.type === "group") obj = new T.Group();
    else {
      let geometry = {
        box: () => new T.BoxGeometry(1, 1, 1),
        sphere: () => new T.SphereGeometry(1, 40, 24),
        cylinder: () => new T.CylinderGeometry(1, 1, 1, 20),
        cone: () => new T.ConeGeometry(1, 1, 10),
        plane: () => new T.PlaneGeometry(1, 1),
        disc: () => new T.CircleGeometry(1, 64),
        torus: () => new T.TorusGeometry(1, 0.012, 8, 72),
      }[n.type]?.();
      if (!geometry) continue;
      let mat = new T.MeshStandardMaterial({
        color: n.color || "#ffffff",
        roughness: n.roughness ?? 0.65,
        metalness: n.metalness ?? 0.12,
        side: T.DoubleSide,
        transparent: n.opacity !== undefined && n.opacity < 1,
        opacity: n.opacity ?? 1,
      });
      if (n.text) {
        let c = document.createElement("canvas");
        c.width = 512;
        c.height = 256;
        let x = c.getContext("2d");
        if (!n.transparent) {
          x.fillStyle = n.color;
          x.fillRect(0, 0, 512, 256);
        }
        x.font = "bold 190px Arial";
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillStyle = n.textColor || "#fff";
        x.fillText(n.text, 256, 135);
        mat.map = new T.CanvasTexture(c);
        mat.color.set("#ffffff");
        mat.transparent = !!n.transparent;
        mat.alphaTest = 0.1;
      }
      obj = new T.Mesh(geometry, mat);
      obj.castShadow = n.castShadow !== false;
      obj.receiveShadow = true;
    }
    obj.name = n.id;
    obj.userData.definition = n;
    obj.position.fromArray(n.position || [0, 0, 0]);
    obj.scale.fromArray(n.scale || [1, 1, 1]);
    obj.rotation.fromArray([...(n.rotation || [0, 0, 0]), "XYZ"]);
    nodes[n.id] = obj;
    (nodes[n.parent] || scene).add(obj);
  }
  let particles = [];
  for (let e of resource.emitters || []) {
    let group = new T.Group();
    for (let i = 0; i < e.count; i++) {
      let mesh = new T.Mesh(
        new T.IcosahedronGeometry(e.size, 1),
        new T.MeshStandardMaterial({
          color: e.color,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          emissive: e.kind === "fire" ? e.color : "#000000",
          emissiveIntensity: 1,
        }),
      );
      group.add(mesh);
    }
    scene.add(group);
    particles.push({ e, group });
  }
  return {
    scene,
    nodes,
    particles,
    camera: new T.PerspectiveCamera(43, 1, 0.1, 200),
    resource,
  };
}
function interpolate(tracks, time, key, fallback) {
  if (!tracks?.length) return fallback;
  let a = tracks[0],
    b = tracks.at(-1);
  for (let i = 0; i < tracks.length - 1; i++)
    if (time >= tracks[i].t && time < tracks[i + 1].t) {
      a = tracks[i];
      b = tracks[i + 1];
      break;
    }
  if (time >= tracks.at(-1).t) a = b;
  if (time < tracks[0].t) b = a;
  let f = a === b ? 0 : Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t)));
  f = f * f * (3 - 2 * f);
  return (a[key] || fallback).map(
    (v, i) => v + ((b[key] || fallback)[i] - v) * f,
  );
}
export function drawScene(canvas, data) {
  if (!canvas.isConnected || canvas.clientWidth < 1) return;
  let key = JSON.stringify(data.resource);
  let item = cache.get(key);
  if (!item) {
    item = build(data.resource);
    cache.set(key, item);
  }
  let { scene, nodes, particles, camera, resource } = item,
    t = data.frameTime ?? data.position ?? 0;
  const flight = Object.hasOwn(data, "sceneFlight")
    ? data.sceneFlight
    : data.flight;
  const effectsFlight = Object.hasOwn(data, "effectsFlight")
    ? data.effectsFlight
    : flight;
  for (let obj of Object.values(nodes)) {
    let n = obj.userData.definition;
    let renderTime = flight
      ? flight.crashed
        ? Math.min(
            resource.duration || 15,
            (resource.impact?.time || 11.8) +
              Math.max(0, t - (flight.crashTime ?? t)),
          )
        : Math.min(t, 8)
      : t;
    obj.visible =
      (n.visibleAfter === undefined || renderTime >= n.visibleAfter) &&
      (n.visibleUntil === undefined || renderTime < n.visibleUntil);
    const sampleTime = flight && n.visibleAfter !== undefined ? renderTime : t;
    obj.position.fromArray(
      interpolate(n.tracks, sampleTime, "position", n.position || [0, 0, 0]),
    );
    if (
      flight?.crashed &&
      n.visibleAfter !== undefined &&
      !n.parent &&
      resource.impact
    ) {
      const origin = resource.impact.position;
      obj.position.x += flight.x - origin[0];
      obj.position.z += flight.z - origin[2];
      obj.position.y += Math.max(0, flight.y - 0.8);
    }
    let r = interpolate(
      n.tracks,
      sampleTime,
      "rotation",
      n.rotation || [0, 0, 0],
    );
    obj.rotation.set(...r);
    if (n.spin) {
      let st = Math.max(
        0,
        Math.min(
          t,
          flight
            ? flight.crashed
              ? (flight.crashTime ?? n.spin.end)
              : 1e9
            : n.spin.end,
        ) - n.spin.start,
      );
      obj.rotation[n.spin.axis] += ((st * st) / (st + 1)) * n.spin.speed;
    }
  }
  let actor = nodes[resource.actor];

  if (actor && flight) {
    actor.position.set(flight.x, flight.y, flight.z);
    actor.rotation.set(flight.roll, flight.heading, flight.pitch);
  }
  for (let { e, group } of particles) {
    let fxTime = effectsFlight
      ? effectsFlight.crashed
        ? Math.min(
            resource.duration || 15,
            (resource.impact?.time || 11.8) +
              Math.max(
                0,
                (data.effectsTime ?? t) - (effectsFlight.crashTime ?? t),
              ),
          )
        : Math.min(data.effectsTime ?? t, 8)
      : (data.effectsTime ?? t);
    group.visible = fxTime >= e.start && fxTime <= e.end;
    if (!group.visible) continue;
    let effectTime = fxTime;
    let age = effectTime - e.start;
    group.position.fromArray(e.position);
    if (e.attach && actor) {
      const point = effectsFlight
        ? [effectsFlight.x, effectsFlight.y, effectsFlight.z]
        : interpolate(
            actor.userData.definition.tracks,
            fxTime,
            "position",
            actor.userData.definition.position,
          );
      group.position.set(
        point[0],
        e.attach === "ground" ? 0.16 : point[1],
        point[2],
      );
    }
    if (effectsFlight && e.start > 8)
      group.position.set(effectsFlight.x, effectsFlight.y, effectsFlight.z);
    for (let i = 0; i < group.children.length; i++) {
      let p = group.children[i],
        seed = i * 2.399,
        life = (age + i * 0.071) % 2.8,
        f = life / 2.8,
        rad = e.kind === "dust" ? life * 1.9 : life * 0.5;
      p.position.set(
        Math.sin(seed) * rad,
        e.kind === "dust" ? 0.1 + Math.sin(f * Math.PI) * 0.5 : life * 1.6,
        Math.cos(seed) * rad,
      );
      p.scale.setScalar(0.4 + life * (e.kind === "fire" ? 0.2 : 0.8));
      p.material.opacity = (1 - f) * 0.5 * Math.min(1, age * 2);
    }
  }
  let target = actor
    ? actor.position.clone().add(new T.Vector3(0, 0.5, 0))
    : new T.Vector3(...(resource.camera?.target || [0, 0, 0]));
  let angle = data.orbit ?? 0.75,
    dist = data.distance ?? 17;
  if (data.camera === "自由环绕") {
    camera.position.set(
      target.x + Math.sin(angle) * dist,
      target.y + dist * 0.45,
      target.z + Math.cos(angle) * dist,
    );
  } else if (data.camera === "跟随镜头") {
    camera.position.copy(target).add(new T.Vector3(10, 5, 12));
  } else {
    camera.position
      .copy(target)
      .add(new T.Vector3(...(resource.camera?.offset || [9, 5, 12])));
    if (!actor && resource.camera?.position)
      camera.position.fromArray(resource.camera.position);
  }
  camera.lookAt(target);
  const resolution = Math.min(
    devicePixelRatio,
    1800 / canvas.clientWidth,
    1200 / canvas.clientHeight,
  );
  let w = Math.max(1, Math.round(canvas.clientWidth * resolution)),
    h = Math.max(1, Math.round(canvas.clientHeight * resolution));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  canvas.getContext("2d").drawImage(renderer.domElement, 0, 0, w, h);
  canvas._scene = item;
  canvas._sceneData = data;
}
export function pickScene(canvas, event) {
  if (canvas._sceneData) drawScene(canvas, canvas._sceneData);
  let item = canvas._scene;
  if (!item) return "";
  let rect = canvas.getBoundingClientRect(),
    ray = new T.Raycaster();
  ray.setFromCamera(
    new T.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    ),
    item.camera,
  );
  const hit = ray
    .intersectObjects(item.scene.children, true)
    .find((x) => x.object.name);
  if (!hit) return { name: "未命中物体" };
  const def = hit.object.userData.definition;
  return {
    name: hit.object.name,
    point: hit.point.toArray(),
    ground: !!def && !def.parent && def.type !== "group",
  };
}
