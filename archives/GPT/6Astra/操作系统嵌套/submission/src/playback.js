import { copy } from "./runtime.js";
export function sampleTrack(tracks, time, key, fallback) {
  if (!tracks?.length) return [...fallback];
  let a = tracks[0],
    b = a;
  if (time >= tracks.at(-1).t) a = b = tracks.at(-1);
  else
    for (let i = 0; i < tracks.length - 1; i++)
      if (time >= tracks[i].t && time < tracks[i + 1].t) {
        a = tracks[i];
        b = tracks[i + 1];
        break;
      }
  let f = a === b ? 0 : Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t)));
  f = f * f * (3 - 2 * f);
  return (a[key] || fallback).map(
    (v, i) => v + ((b[key] || fallback)[i] - v) * f,
  );
}
export function sampleRecord(record, time) {
  if (!record?.length) return null;
  let low = 0,
    high = record.length - 1;
  while (low < high) {
    let middle = Math.ceil((low + high) / 2);
    if (record[middle].t <= time) low = middle;
    else high = middle - 1;
  }
  let a = record[low],
    b = record[low + 1],
    result = copy(a.flight);
  if (b && time > a.t) {
    let fraction = Math.min(1, (time - a.t) / (b.t - a.t));
    for (let key of ["x", "y", "z", "vy", "roll", "pitch", "heading"])
      if (Number.isFinite(a.flight[key]) && Number.isFinite(b.flight[key]))
        result[key] =
          a.flight[key] + (b.flight[key] - a.flight[key]) * fraction;
  }
  return result;
}
export function demoFlight(resource, time) {
  let actor = resource.nodes?.find((n) => n.id === resource.actor);
  if (!actor) throw Error("场景没有可排演的飞行主体");
  let pos = sampleTrack(
      actor.tracks,
      time,
      "position",
      actor.position || [0, 0, 0],
    ),
    rot = sampleTrack(
      actor.tracks,
      time,
      "rotation",
      actor.rotation || [0, 0, 0],
    ),
    previous = sampleTrack(
      actor.tracks,
      Math.max(0, time - 1 / 30),
      "position",
      actor.position || [0, 0, 0],
    );
  return {
    x: pos[0],
    y: pos[1],
    z: pos[2],
    roll: rot[0],
    heading: rot[1],
    pitch: rot[2],
    vy: (pos[1] - previous[1]) * 30,
    control: 9.81,
    wind: 0,
    target: rot[1],
    controlTime: 0,
    fault: false,
    crashed: false,
    landed: false,
  };
}
export function seekPlayer(d, time) {
  d.position = Math.max(0, Math.min(d.duration, +time || 0));
  d.physicsBacklog = 0;
  d.sampleEpoch = (d.sampleEpoch || 0) + 1;
  d._sampleKey = null;
  d._sampleParts = {};
  if (d.record?.length && (d.recordPlayback || d.flight)) {
    d.recordPlayback = true;
    d.flight = sampleRecord(d.record, d.position);
  } else {
    delete d.flight;
    delete d.sceneFlight;
    delete d.effectsFlight;
  }
}
export function decodePlayer(file, path, clock) {
  let d;
  if (file.record) {
    d = copy(file.player);
    d.record = (d.record || []).sort((a, b) => a.t - b.t);
    d.duration = d.record.at(-1)?.t || d.duration || 0.1;
    d.recordPlayback = true;
    d.scene = path;
  } else {
    if (!Array.isArray(file.nodes) || !file.camera)
      throw Error("场景需包含 nodes 与 camera");
    d = {
      scene: path,
      resource: copy(file),
      duration: file.duration || 15,
      rate: 1,
      loop: false,
      camera: "演出镜头",
      selection: "点击机体查看部件",
      record: [],
    };
  }
  Object.assign(d, {
    state: "paused",
    position: 0,
    frameTime: 0,
    sceneTime: 0,
    effectsTime: 0,
    lastClock: clock,
    physicsBacklog: 0,
    _sampleParts: {},
    _sampleKey: null,
  });
  d.flight = d.recordPlayback ? sampleRecord(d.record, 0) : undefined;
  d.sceneFlight = d.flight ? copy(d.flight) : null;
  d.effectsFlight = d.flight ? copy(d.flight) : null;
  return d;
}
export function beginRehearsal(d, clock) {
  let f = d.recordPlayback
    ? sampleRecord(d.record, d.position)
    : d.sceneFlight
      ? copy(d.sceneFlight)
      : demoFlight(d.resource, d.position);
  if (!f) f = demoFlight(d.resource, d.position);
  if (!d.record?.length) {
    d.record = [];
    for (let t = 0; t < d.position; t += 1 / 30)
      d.record.push({ t, flight: demoFlight(d.resource, t) });
  }
  d.record = d.record.filter((frame) => frame.t < d.position);
  d.record.push({ t: d.position, flight: copy(f) });
  f.controlTime = clock;
  d.flight = f;
  d.initialFlight = copy(f);
  d.sceneFlight = copy(f);
  d.effectsFlight = copy(f);
  d.controls = [{ time: clock, value: f.control || 9.81 }];
  d.inputHistory = (d.inputHistory || []).filter(
    (e) => e.position <= d.position,
  );
  d.inputHistory.push({ type: "resume", position: d.position, time: clock });
  Object.assign(d, {
    physicsBacklog: 0,
    recordPlayback: false,
    state: "playing",
    duration: Math.max(60, d.position + 45),
    lastClock: clock,
    _sampleKey: null,
  });
}
export function encodeRecord(d) {
  if (!d.record?.length) throw Error("请先进行飞行排演");
  let end = d.record.at(-1).t,
    player = copy(d);
  Object.assign(player, {
    duration: end,
    position: 0,
    frameTime: 0,
    sceneTime: 0,
    effectsTime: 0,
    state: "paused",
    recordPlayback: true,
    physicsBacklog: 0,
    _sampleKey: null,
    _sampleParts: {},
  });
  player.flight = sampleRecord(player.record, 0);
  player.sceneFlight = copy(player.flight);
  player.effectsFlight = copy(player.flight);
  return { version: 2, record: true, player };
}
// Source timeline sends value messages. Device submissions appear only after paid workers finish.
export function queueSample(s, w) {
  let d = w.data,
    time =
      d.flight && !d.recordPlayback
        ? d.position - (d.physicsBacklog || 0)
        : d.position,
    key = (d.sampleEpoch || 0) + ":" + time;
  if (d._sampleKey === key) return;
  d._sampleKey = key;
  let frame = { key, time, flight: d.flight ? copy(d.flight) : null };
  for (let p of s.processes.filter(
    (p) =>
      p.windowId === w.id &&
      ["scene", "effects"].includes(p.kind) &&
      !["ended", "error"].includes(p.state),
  )) {
    p.queue = p.queue.filter((q) => !q.sample);
    p.queue.push({ sample: copy(frame) });
  }
}
export function finishSample(s, w, p) {
  let index = p.queue.findIndex((q) => q.sample);
  if (index < 0) return;
  let sample = p.queue.splice(index, 1)[0].sample,
    d = w.data;
  d._sampleParts ??= {};
  d._sampleParts[p.kind] = sample;
  const otherKind = p.kind === "scene" ? "effects" : "scene",
    other = s.processes.find(
      (q) => q.windowId === w.id && q.kind === otherKind,
    ),
    partial = !other || ["suspended", "ended", "error"].includes(other.state);
  function submit(kind, part) {
    if (kind === "scene") {
      d.frameTime = part.time;
      d.sceneTime = part.time;
      d.sceneFlight = part.flight;
    } else {
      d.effectsTime = part.time;
      d.effectsFlight = part.flight;
    }
  }
  if (partial) submit(p.kind, sample);
  else if (d._sampleParts[otherKind]?.key === sample.key) {
    submit("scene", d._sampleParts.scene);
    submit("effects", d._sampleParts.effects);
  }
}
