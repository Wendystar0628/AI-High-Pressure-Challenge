// 声音：全部用 WebAudio 实时合成。三张图各有一套环境声与音乐，Boss 战会叠加压迫层。
(function (root) {
  const TD = root.TD = root.TD || {};

  const A = TD.Audio = {
    ctx: null, master: null, musicBus: null, ambBus: null, sfxBus: null, noiseBuf: null, reverb: null,
    volume: { master: 0.8, music: 0.6, sfx: 0.8 }, muted: false, started: false,
    scene: null, bossMode: false, last: {}, step: 0, nextT: 0, timer: null, ambNodes: [], ambTimer: null,
  };

  try {
    const sv = JSON.parse(localStorage.getItem('td_audio') || 'null');
    if (sv) { A.volume = Object.assign(A.volume, sv.volume); A.muted = !!sv.muted; }
  } catch (e) { /* 本地存储不可用时使用默认值 */ }

  A.save = function () { try { localStorage.setItem('td_audio', JSON.stringify({ volume: A.volume, muted: A.muted })); } catch (e) {} };

  // 视频导出期间挂起声音，也不让音频定时器消耗随机数
  A.setHold = function (on) {
    A.hold = on;
    if (on) {
      if (A.timer) { clearInterval(A.timer); A.timer = null; }
      if (A.ambTimer) { clearInterval(A.ambTimer); A.ambTimer = null; }
      if (A.ctx && A.ctx.state === 'running') A.ctx.suspend();
    } else if (A.ctx && A.started) {
      A.ctx.resume().then(() => { if (!A.hold && A.scene) A.setScene(A.scene, true); }).catch(() => {});
    }
  };

  A.unlock = function () {
    if (A.hold) return;
    if (!A.ctx) A.init();
    if (!A.ctx) return;
    const begin = () => { if (!A.started) { A.started = true; if (A.scene) A.setScene(A.scene, true); } };
    if (A.ctx.state === 'running') begin();
    else A.ctx.resume().then(begin).catch(() => {});
  };

  A.init = function () {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const c = A.ctx = new Ctx();
    A.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
    A.master.connect(comp); comp.connect(c.destination);
    A.musicBus = c.createGain(); A.ambBus = c.createGain(); A.sfxBus = c.createGain();
    A.musicBus.connect(A.master); A.ambBus.connect(A.master); A.sfxBus.connect(A.master);
    const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    A.noiseBuf = buf;
    // 简易混响：指数衰减噪声脉冲
    const len = c.sampleRate * 1.8, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const v = ir.getChannelData(ch); for (let i = 0; i < len; i++) v[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    A.reverb = c.createConvolver(); A.reverb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.22;
    A.reverb.connect(wet); wet.connect(A.master);
    A.applyVolume();
  };

  A.applyVolume = function () {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    A.master.gain.setTargetAtTime(A.muted ? 0 : A.volume.master, t, 0.03);
    A.musicBus.gain.setTargetAtTime(A.volume.music * 0.55, t, 0.05);
    A.ambBus.gain.setTargetAtTime(A.volume.music * 0.6, t, 0.05);
    A.sfxBus.gain.setTargetAtTime(A.volume.sfx * 0.85, t, 0.03);
  };
  A.setVolume = function (k, v) { A.volume[k] = v; A.applyVolume(); A.save(); };
  A.setMuted = function (m) { A.muted = m; A.applyVolume(); A.save(); };

  // ─── 合成积木 ───
  function env(g, t, a, peak, d, sus, r, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + Math.max(a + d, dur));
    g.gain.linearRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
  }
  function tone(bus, freq, dur, o) {
    if (!A.ctx) return;
    o = o || {};
    const c = A.ctx, t = o.at != null ? o.at : c.currentTime;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slide || dur));
    if (o.detune) osc.detune.value = o.detune;
    env(g, t, o.a != null ? o.a : 0.004, o.v != null ? o.v : 0.2, o.d != null ? o.d : dur * 0.4, o.s != null ? o.s : 0.3, o.r != null ? o.r : dur * 0.5, dur);
    let out = g;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; if (o.q) f.Q.value = o.q; g.connect(f); out = f; }
    osc.connect(g);
    out.connect(bus);
    if (o.wet) out.connect(A.reverb);
    osc.start(t);
    osc.stop(t + dur + (o.r != null ? o.r : dur * 0.5) + 0.05);
  }
  function noise(bus, dur, o) {
    if (!A.ctx) return;
    o = o || {};
    const c = A.ctx, t = o.at != null ? o.at : c.currentTime;
    const s = c.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true;
    s.loopStart = Math.random(); s.loopEnd = 1.9;
    const f = c.createBiquadFilter(); f.type = o.ft || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + (o.slide || dur));
    f.Q.value = o.q != null ? o.q : 1;
    const g = c.createGain();
    env(g, t, o.a != null ? o.a : 0.003, o.v != null ? o.v : 0.25, o.d != null ? o.d : dur * 0.3, o.s != null ? o.s : 0.2, o.r != null ? o.r : dur * 0.6, dur);
    s.connect(f); f.connect(g); g.connect(bus);
    if (o.wet) g.connect(A.reverb);
    s.start(t, Math.random());
    s.stop(t + dur + (o.r != null ? o.r : dur * 0.6) + 0.05);
  }

  // ─── 音效表 ───
  const fx = {
    uiClick: () => { tone(A.sfxBus, 1500, 0.04, { type: 'square', v: 0.05, lp: 4000 }); tone(A.sfxBus, 2200, 0.03, { type: 'sine', v: 0.06, at: A.ctx.currentTime + 0.02 }); },
    uiHover: () => tone(A.sfxBus, 2600, 0.02, { type: 'sine', v: 0.022 }),
    uiOpen: () => { tone(A.sfxBus, 520, 0.12, { to: 1040, type: 'triangle', v: 0.1 }); noise(A.sfxBus, 0.1, { f: 3000, v: 0.04 }); },
    uiClose: () => tone(A.sfxBus, 900, 0.1, { to: 420, type: 'triangle', v: 0.09 }),
    uiDeny: () => { tone(A.sfxBus, 180, 0.09, { type: 'square', v: 0.09, lp: 900 }); tone(A.sfxBus, 140, 0.12, { type: 'square', v: 0.09, lp: 700, at: A.ctx.currentTime + 0.1 }); },
    pick: () => tone(A.sfxBus, 720, 0.06, { to: 980, type: 'triangle', v: 0.08 }),
    place: () => { tone(A.sfxBus, 180, 0.16, { to: 70, type: 'sine', v: 0.35 }); noise(A.sfxBus, 0.08, { f: 2600, v: 0.1 }); tone(A.sfxBus, 660, 0.1, { type: 'triangle', v: 0.09, at: A.ctx.currentTime + 0.08, wet: 1 }); },
    sell: () => { tone(A.sfxBus, 620, 0.12, { to: 240, type: 'triangle', v: 0.12 }); tone(A.sfxBus, 1200, 0.06, { type: 'sine', v: 0.06, at: A.ctx.currentTime + 0.1 }); },
    upgrade: () => { [523, 659, 784, 1046].forEach((f, i) => tone(A.sfxBus, f, 0.14, { type: 'triangle', v: 0.11, at: A.ctx.currentTime + i * 0.06, wet: 1 })); noise(A.sfxBus, 0.35, { f: 1800, to: 6000, v: 0.05 }); },
    // 塔
    fwStrike: () => { noise(A.sfxBus, 0.1, { f: 900, to: 300, v: 0.16 }); tone(A.sfxBus, 170, 0.1, { to: 80, type: 'sawtooth', v: 0.1, lp: 800 }); },
    fwSkill: () => { noise(A.sfxBus, 0.4, { f: 500, to: 1500, v: 0.2, wet: 1 }); tone(A.sfxBus, 110, 0.4, { type: 'sawtooth', v: 0.14, lp: 700 }); },
    honey: () => { tone(A.sfxBus, 980, 0.1, { to: 1250, type: 'sine', v: 0.05 }); tone(A.sfxBus, 1250, 0.1, { to: 980, type: 'sine', v: 0.04, at: A.ctx.currentTime + 0.09 }); },
    trap: () => { noise(A.sfxBus, 0.06, { f: 4200, v: 0.12 }); tone(A.sfxBus, 300, 0.2, { to: 90, type: 'square', v: 0.13, lp: 1400 }); tone(A.sfxBus, 1400, 0.25, { to: 700, type: 'sine', v: 0.06, wet: 1, at: A.ctx.currentTime + 0.04 }); },
    gateSkill: () => { tone(A.sfxBus, 90, 0.3, { type: 'square', v: 0.16, lp: 450 }); noise(A.sfxBus, 0.1, { f: 1400, v: 0.14, at: A.ctx.currentTime + 0.18 }); },
    bolt: () => { tone(A.sfxBus, 1500, 0.05, { to: 360, type: 'square', v: 0.05, lp: 3000 }); noise(A.sfxBus, 0.03, { f: 5000, v: 0.05 }); },
    rail: () => { tone(A.sfxBus, 2400, 0.18, { to: 90, type: 'sawtooth', v: 0.12, lp: 5000 }); noise(A.sfxBus, 0.2, { f: 3000, to: 500, v: 0.14, wet: 1 }); },
    sup: () => tone(A.sfxBus, 640, 0.08, { to: 300, type: 'triangle', v: 0.06 }),
    icSkill: () => { [800, 1000, 1300].forEach((f, i) => tone(A.sfxBus, f, 0.05, { type: 'square', v: 0.05, lp: 3200, at: A.ctx.currentTime + i * 0.04 })); },
    orb: () => { tone(A.sfxBus, 220, 0.14, { to: 460, type: 'sine', v: 0.1 }); noise(A.sfxBus, 0.05, { f: 800, v: 0.06 }); },
    blast: () => { noise(A.sfxBus, 0.22, { f: 1100, to: 180, v: 0.2, ft: 'lowpass' }); tone(A.sfxBus, 130, 0.18, { to: 50, type: 'sine', v: 0.24 }); },
    scan: () => { tone(A.sfxBus, 800, 0.5, { to: 2000, type: 'sine', v: 0.08, wet: 1 }); tone(A.sfxBus, 1600, 0.2, { type: 'sine', v: 0.05, at: A.ctx.currentTime + 0.5, wet: 1 }); },
    heal: () => tone(A.sfxBus, 880, 0.18, { to: 1320, type: 'sine', v: 0.03, wet: 1 }),
    shieldUp: () => { [392, 587, 784].forEach((f, i) => tone(A.sfxBus, f, 0.3, { type: 'sine', v: 0.1, at: A.ctx.currentTime + i * 0.05, wet: 1 })); noise(A.sfxBus, 0.5, { f: 2500, v: 0.04 }); },
    shieldHit: () => tone(A.sfxBus, 1700, 0.06, { to: 1100, type: 'sine', v: 0.05 }),
    decrypt: () => { tone(A.sfxBus, 660, 0.08, { type: 'triangle', v: 0.09 }); tone(A.sfxBus, 990, 0.14, { type: 'triangle', v: 0.09, at: A.ctx.currentTime + 0.07, wet: 1 }); },
    encrypt: () => { tone(A.sfxBus, 420, 0.1, { to: 210, type: 'square', v: 0.09, lp: 1100 }); noise(A.sfxBus, 0.06, { f: 3400, v: 0.09, at: A.ctx.currentTime + 0.1 }); },
    towerHit: () => { noise(A.sfxBus, 0.05, { f: 2100, v: 0.08 }); tone(A.sfxBus, 240, 0.05, { to: 150, type: 'square', v: 0.05, lp: 1000 }); },
    towerDown: () => { noise(A.sfxBus, 0.55, { f: 900, to: 90, v: 0.32, ft: 'lowpass', wet: 1 }); tone(A.sfxBus, 90, 0.5, { to: 30, type: 'sawtooth', v: 0.2, lp: 500 }); },
    // 敌人
    worm: () => noise(A.sfxBus, 0.04, { f: 3200, v: 0.05, q: 6 }),
    wormCopy: () => { tone(A.sfxBus, 420, 0.1, { to: 840, type: 'sawtooth', v: 0.05, lp: 1800 }); tone(A.sfxBus, 840, 0.1, { to: 420, type: 'sawtooth', v: 0.04, lp: 1800, at: A.ctx.currentTime + 0.08 }); },
    floodImpact: () => { tone(A.sfxBus, 110, 0.28, { to: 36, type: 'sine', v: 0.42 }); noise(A.sfxBus, 0.2, { f: 700, to: 140, v: 0.26, ft: 'lowpass' }); },
    siege: () => { noise(A.sfxBus, 0.4, { f: 300, to: 900, v: 0.12 }); tone(A.sfxBus, 70, 0.4, { to: 120, type: 'sawtooth', v: 0.1, lp: 400 }); },
    reveal: () => { tone(A.sfxBus, 1100, 0.07, { type: 'square', v: 0.05, lp: 3000 }); noise(A.sfxBus, 0.1, { f: 4400, v: 0.08 }); tone(A.sfxBus, 300, 0.12, { type: 'sawtooth', v: 0.06, lp: 900, at: A.ctx.currentTime + 0.05 }); },
    payload: () => { noise(A.sfxBus, 0.42, { f: 1400, to: 160, v: 0.34, ft: 'lowpass', wet: 1 }); tone(A.sfxBus, 120, 0.35, { to: 40, type: 'sawtooth', v: 0.2, lp: 700 }); },
    ransomShot: () => { tone(A.sfxBus, 540, 0.12, { to: 260, type: 'sawtooth', v: 0.06, lp: 1500 }); noise(A.sfxBus, 0.03, { f: 5200, v: 0.05 }); },
    hotspot: () => { tone(A.sfxBus, 1400, 0.3, { to: 1800, type: 'sine', v: 0.018 }); },
    packer: () => { tone(A.sfxBus, 300, 0.25, { to: 600, type: 'triangle', v: 0.07, wet: 1 }); noise(A.sfxBus, 0.25, { f: 1800, v: 0.04 }); },
    die: () => { tone(A.sfxBus, 720, 0.09, { to: 150, type: 'square', v: 0.05, lp: 2200 }); noise(A.sfxBus, 0.05, { f: 2600, v: 0.05 }); },
    dieBig: () => { noise(A.sfxBus, 0.3, { f: 900, to: 180, v: 0.2, ft: 'lowpass' }); tone(A.sfxBus, 180, 0.28, { to: 50, type: 'sawtooth', v: 0.14, lp: 700 }); },
    leak: () => { tone(A.sfxBus, 520, 0.22, { to: 390, type: 'square', v: 0.13, lp: 1800 }); tone(A.sfxBus, 390, 0.3, { to: 260, type: 'square', v: 0.13, lp: 1800, at: A.ctx.currentTime + 0.2 }); },
    // 路由 / 节点
    isolate: () => { tone(A.sfxBus, 70, 0.3, { type: 'sawtooth', v: 0.22, lp: 400 }); noise(A.sfxBus, 0.08, { f: 1600, v: 0.2, at: A.ctx.currentTime + 0.14 }); tone(A.sfxBus, 980, 0.2, { to: 700, type: 'square', v: 0.06, lp: 2400, at: A.ctx.currentTime + 0.16, wet: 1 }); },
    bypass: () => { tone(A.sfxBus, 300, 0.32, { to: 1200, type: 'sawtooth', v: 0.1, lp: 3000, wet: 1 }); noise(A.sfxBus, 0.35, { f: 800, to: 4000, v: 0.12 }); },
    route: () => { [880, 1175, 880, 1318].forEach((f, i) => tone(A.sfxBus, f, 0.06, { type: 'square', v: 0.045, lp: 3400, at: A.ctx.currentTime + i * 0.07 })); },
    preview: () => tone(A.sfxBus, 1040, 0.05, { type: 'sine', v: 0.05 }),
    intel: () => { tone(A.sfxBus, 1320, 0.05, { type: 'triangle', v: 0.05 }); tone(A.sfxBus, 1760, 0.08, { type: 'triangle', v: 0.05, at: A.ctx.currentTime + 0.05 }); },
    // 道具
    itemIso: () => { tone(A.sfxBus, 260, 0.14, { to: 90, type: 'square', v: 0.14, lp: 1000 }); noise(A.sfxBus, 0.08, { f: 2000, v: 0.12, at: A.ctx.currentTime + 0.1 }); },
    itemDown: () => { tone(A.sfxBus, 900, 0.6, { to: 160, type: 'sawtooth', v: 0.07, lp: 1400, wet: 1 }); noise(A.sfxBus, 0.5, { f: 1200, to: 300, v: 0.05 }); },
    itemBack: () => { [440, 554, 659, 880].forEach((f, i) => tone(A.sfxBus, f, 0.2, { type: 'sine', v: 0.1, at: A.ctx.currentTime + i * 0.05, wet: 1 })); },
    // 系统
    wave: () => { tone(A.sfxBus, 330, 0.18, { type: 'sawtooth', v: 0.08, lp: 1500 }); tone(A.sfxBus, 440, 0.26, { type: 'sawtooth', v: 0.08, lp: 1700, at: A.ctx.currentTime + 0.16, wet: 1 }); },
    surge: () => { for (let i = 0; i < 3; i++) { tone(A.sfxBus, 620, 0.26, { to: 300, type: 'sawtooth', v: 0.13, lp: 2000, at: A.ctx.currentTime + i * 0.42 }); } noise(A.sfxBus, 1.3, { f: 300, to: 1200, v: 0.15 }); },
    threat: () => { tone(A.sfxBus, 740, 0.1, { type: 'square', v: 0.07, lp: 2400 }); tone(A.sfxBus, 554, 0.2, { type: 'square', v: 0.07, lp: 2400, at: A.ctx.currentTime + 0.12, wet: 1 }); },
    bossIn: () => { tone(A.sfxBus, 44, 2.2, { to: 88, type: 'sawtooth', v: 0.4, lp: 340 }); noise(A.sfxBus, 2.2, { f: 150, to: 900, v: 0.22, wet: 1 }); [220, 233].forEach(f => tone(A.sfxBus, f, 1.6, { type: 'sawtooth', v: 0.1, lp: 900, a: 0.4, wet: 1 })); },
    bossPhase: () => { tone(A.sfxBus, 60, 1.1, { to: 30, type: 'sawtooth', v: 0.35, lp: 400 }); noise(A.sfxBus, 0.8, { f: 2000, to: 200, v: 0.2, wet: 1 }); },
    bossWarn: () => { for (let i = 0; i < 3; i++) tone(A.sfxBus, 980, 0.1, { to: 760, type: 'square', v: 0.09, lp: 3000, at: A.ctx.currentTime + i * 0.2 }); },
    bossSurge: () => { tone(A.sfxBus, 55, 0.6, { to: 28, type: 'sine', v: 0.55 }); noise(A.sfxBus, 0.6, { f: 800, to: 110, v: 0.42, ft: 'lowpass', wet: 1 }); },
    hole: () => { tone(A.sfxBus, 800, 1.0, { to: 50, type: 'sine', v: 0.2, wet: 1 }); noise(A.sfxBus, 0.9, { f: 2400, to: 120, v: 0.12 }); },
    lock: () => { for (let i = 0; i < 4; i++) noise(A.sfxBus, 0.04, { f: 3800 - i * 500, v: 0.18, at: A.ctx.currentTime + i * 0.07 }); tone(A.sfxBus, 70, 0.45, { type: 'square', v: 0.24, lp: 420, at: A.ctx.currentTime + 0.28 }); },
    storm: () => { noise(A.sfxBus, 1.0, { f: 500, to: 4000, q: 4, v: 0.22, wet: 1 }); tone(A.sfxBus, 220, 0.9, { to: 660, type: 'sawtooth', v: 0.08, lp: 1600 }); },
    swarm: () => { for (let i = 0; i < 6; i++) tone(A.sfxBus, 300 + i * 90, 0.08, { type: 'sawtooth', v: 0.05, lp: 1800, at: A.ctx.currentTime + i * 0.05 }); },
    victory: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(A.sfxBus, f, 0.5, { type: 'triangle', v: 0.14, at: A.ctx.currentTime + i * 0.13, wet: 1 })); },
    defeat: () => { [392, 349, 311, 233].forEach((f, i) => tone(A.sfxBus, f, 0.7, { type: 'sawtooth', v: 0.1, lp: 900, at: A.ctx.currentTime + i * 0.28, wet: 1 })); noise(A.sfxBus, 1.5, { f: 300, to: 60, v: 0.18, ft: 'lowpass' }); },
    type: () => tone(A.sfxBus, 3000 + Math.random() * 900, 0.012, { type: 'square', v: 0.016, lp: 6000 }),
  };
  const THROTTLE = { worm: 0.09, die: 0.05, bolt: 0.05, towerHit: 0.07, heal: 0.35, sup: 0.06, blast: 0.08, orb: 0.1, uiHover: 0.04, ransomShot: 0.1, hotspot: 1.2, shieldHit: 0.08, fwStrike: 0.09, floodImpact: 0.14, honey: 0.2, intel: 0.1, encrypt: 0.2, dieBig: 0.1 };

  A.play = function (name) {
    if (A.hold) return;
    if (!A.ctx || A.ctx.state !== 'running' || !fx[name]) return;
    const now = A.ctx.currentTime, lim = THROTTLE[name] != null ? THROTTLE[name] : 0.03;
    if (A.last[name] != null && now - A.last[name] < lim) return;
    A.last[name] = now;
    fx[name]();
  };

  // ─── 音乐：步进式音序器 ───
  const SCENES = {
    menu: { bpm: 74, root: 146.83, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 5], [-2, 2, 5, 9]], arp: [0, 2, 1, 3, 2, 1], arpEvery: 4, pad: 'sine', padLp: 800, kick: [], hat: [], bass: [0], lead: 'triangle', amb: 'menu', leadV: 0.06 },
    intranet: { bpm: 94, root: 110, chords: [[0, 3, 7, 12], [-4, 0, 3, 8], [3, 7, 10, 15], [-2, 2, 5, 10]], arp: [0, 1, 2, 3, 2, 1, 3, 0], arpEvery: 2, pad: 'triangle', padLp: 1300, kick: [0, 8], hat: [4, 12], bass: [0, 6, 10], lead: 'triangle', amb: 'intranet', leadV: 0.075 },
    backbone: { bpm: 124, root: 92.5, chords: [[0, 3, 7, 10], [-3, 0, 4, 9], [-5, -2, 2, 7], [-7, -3, 0, 5]], arp: [0, 2, 3, 1, 3, 2, 1, 3], arpEvery: 1, pad: 'sawtooth', padLp: 1000, kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], bass: [0, 3, 6, 8, 11, 14], lead: 'sawtooth', amb: 'backbone', leadV: 0.05, leadLp: 2400 },
    airgap: { bpm: 78, root: 65.41, chords: [[0, 1, 7, 12], [1, 5, 8, 13], [-2, 3, 7, 10], [0, 1, 7, 8]], arp: [0, 3, 1, 3], arpEvery: 4, pad: 'sawtooth', padLp: 520, kick: [0, 7, 10], hat: [], metal: [4, 12, 15], bass: [0, 10], lead: 'square', amb: 'airgap', leadV: 0.04, leadLp: 1100 },
  };

  A.setScene = function (name, force) {
    if (A.scene === name && !force) return;
    A.scene = name;
    A.bossMode = false;
    if (A.hold) return;
    if (!A.ctx || A.ctx.state !== 'running') return;
    A.startAmb(name);
    if (A.timer) clearInterval(A.timer);
    A.timer = null;
    if (!name) return;
    A.step = 0; A.nextT = A.ctx.currentTime + 0.1;
    A.timer = setInterval(A.tick, 60);
  };
  A.setBoss = function (on) { A.bossMode = on; };

  A.tick = function () {
    if (!A.ctx || !A.scene) return;
    const sc = SCENES[A.scene];
    if (!sc) return;
    const stepDur = 60 / sc.bpm / 4;
    if (A.nextT < A.ctx.currentTime - 0.5) A.nextT = A.ctx.currentTime + 0.05;
    while (A.nextT < A.ctx.currentTime + 0.25) {
      A.playStep(sc, A.step, A.nextT, stepDur);
      A.step++;
      A.nextT += stepDur;
    }
  };

  const f2 = (root, semi) => root * Math.pow(2, semi / 12);

  A.playStep = function (sc, step, t, sd) {
    const bar = Math.floor(step / 16), s = step % 16;
    const ch = sc.chords[bar % sc.chords.length];
    const m = A.musicBus;
    const boss = A.bossMode;
    if (s === 0) {
      const dur = sd * 16;
      for (let i = 0; i < ch.length; i++) {
        tone(m, f2(sc.root * 2, ch[i]), dur, { type: sc.pad, v: 0.045 / (sc.pad === 'sawtooth' ? 1.6 : 1), a: dur * 0.3, d: 0.1, s: 0.9, r: dur * 0.3, lp: sc.padLp, at: t, detune: (i % 2 ? 6 : -6), wet: 1 });
      }
    }
    if (sc.bass.indexOf(s) >= 0) tone(m, f2(sc.root, ch[0]), sd * 2.2, { type: boss ? 'sawtooth' : 'triangle', v: 0.17, lp: boss ? 500 : 340, at: t, d: sd, s: 0.5 });
    if (sc.kick.indexOf(s) >= 0 || (boss && s % 4 === 0)) {
      tone(m, 130, 0.14, { to: 42, slide: 0.1, type: 'sine', v: 0.32, at: t });
    }
    if (sc.hat.indexOf(s) >= 0 || (boss && s % 2 === 1)) noise(m, 0.03, { f: 7500, ft: 'highpass', v: 0.04, at: t });
    if (sc.metal && sc.metal.indexOf(s) >= 0) {
      noise(m, 0.14, { f: 1900, q: 14, v: 0.13, at: t, wet: 1 });
      tone(m, 311, 0.16, { type: 'square', v: 0.018, lp: 2600, at: t, wet: 1 });
    }
    if (s % sc.arpEvery === 0) {
      const idx = Math.floor(s / sc.arpEvery) % sc.arp.length;
      const n = ch[sc.arp[idx]];
      const rest = sc.arpEvery >= 4 ? (bar + s) % 3 === 2 : (s + bar) % 7 === 5;
      if (!rest) tone(m, f2(sc.root * 4, n), sd * 1.6, { type: sc.lead, v: sc.leadV, lp: sc.leadLp || 2600, at: t, d: sd * 0.5, s: 0.25, wet: 1 });
    }
    if (boss && (s === 0 || s === 8)) {
      tone(m, f2(sc.root * 2, ch[0] + 1), sd * 6, { type: 'sawtooth', v: 0.05, lp: 1100, at: t, wet: 1 });
      tone(m, f2(sc.root * 2, ch[0]), sd * 6, { type: 'sawtooth', v: 0.05, lp: 1100, at: t, wet: 1 });
    }
  };

  // ─── 环境声 ───
  A.startAmb = function (name) {
    for (const n of A.ambNodes) { try { n.gain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.4); n.src.stop(A.ctx.currentTime + 2); } catch (e) {} }
    A.ambNodes = [];
    if (A.ambTimer) { clearInterval(A.ambTimer); A.ambTimer = null; }
    if (!name || !SCENES[name]) return;
    const c = A.ctx;
    const bed = (freq, q, vol, type, lfoRate, lfoDepth) => {
      const s = c.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      g.gain.setTargetAtTime(vol, c.currentTime, 1.0);
      s.connect(f); f.connect(g); g.connect(A.ambBus);
      if (lfoRate) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = lfoRate; lg.gain.value = lfoDepth; l.connect(lg); lg.connect(f.frequency); l.start(); }
      s.start();
      A.ambNodes.push({ src: s, gain: g });
    };
    if (name === 'intranet') {
      bed(220, 0.6, 0.15, 'lowpass');            // 机房空调
      bed(1500, 3, 0.012, 'bandpass', 0.2, 500);
    } else if (name === 'backbone') {
      bed(480, 1.2, 0.14, 'bandpass', 0.07, 280); // 公网流的呼啸
      bed(3200, 2, 0.02, 'bandpass', 0.31, 1400);
    } else if (name === 'airgap') {
      bed(90, 1, 0.3, 'lowpass');                // 机械低频
      bed(700, 6, 0.018, 'bandpass', 0.12, 300); // 管道
    } else {
      bed(320, 0.8, 0.07, 'lowpass', 0.05, 120);
    }
    A.ambTimer = setInterval(() => {
      if (!A.ctx || A.ctx.state !== 'running') return;
      const r = Math.random();
      const b = A.ambBus;
      if (name === 'intranet') {
        if (r < 0.3) { for (let i = 0, n = 2 + (Math.random() * 3 | 0); i < n; i++) tone(b, 1800 + Math.random() * 500, 0.03, { type: 'square', v: 0.012, lp: 4000, at: c.currentTime + i * 0.09 }); } // 交换机提示音
        else if (r < 0.42) noise(b, 0.05, { f: 5000, v: 0.012 });                                                                                                    // 键盘
      } else if (name === 'backbone') {
        if (r < 0.3) tone(b, 300 + Math.random() * 900, 1.6, { to: 1500, type: 'sine', v: 0.012, wet: 1 });
        else if (r < 0.45) noise(b, 1.2, { f: 500, to: 3000, q: 3, v: 0.03 });
      } else if (name === 'airgap') {
        if (r < 0.22) noise(b, 1.4, { f: 3600, ft: 'highpass', v: 0.014, a: 0.3 });                     // 泄压
        else if (r < 0.34) { for (let i = 0; i < 2; i++) tone(b, 560, 0.5, { to: 430, type: 'sawtooth', v: 0.012, lp: 900, at: c.currentTime + i * 0.7, wet: 1 }); } // 远处警报
        else if (r < 0.5) noise(b, 0.15, { f: 1100, q: 12, v: 0.05, wet: 1 });                           // 金属碰撞
      } else if (r < 0.2) tone(b, 900 + Math.random() * 400, 0.3, { type: 'sine', v: 0.012, wet: 1 });
    }, 1400);
  };

  // 把游戏事件映射到音效
  A.onEvent = function (ev) {
    switch (ev.type) {
      case 'towerPlaced': A.play('place'); break;
      case 'towerUpgraded': A.play('upgrade'); break;
      case 'towerSold': A.play('sell'); break;
      case 'towerDestroyed': A.play('towerDown'); break;
      case 'towerHit': if (ev.amount > 0.5) A.play('towerHit'); break;
      case 'shieldHit': A.play('shieldHit'); break;
      case 'firewallStrike': A.play('fwStrike'); break;
      case 'railShot': A.play('rail'); break;
      case 'shot': { const k = ev.shot.kind; A.play(k === 'bolt' ? 'bolt' : k === 'suppress' ? 'sup' : k === 'orb' ? 'orb' : 'ransomShot'); break; }
      case 'blast': A.play('blast'); break;
      case 'towerSkill': {
        const n = ev.tower.type;
        A.play({ firewall: 'fwSkill', honeypot: 'trap', gate: 'gateSkill', interceptor: 'icSkill', sandbox: 'scan', repair: 'shieldUp' }[n]);
        break;
      }
      case 'decrypt': if (!ev.natural) A.play('decrypt'); break;
      case 'encrypted': A.play('encrypt'); break;
      case 'lured': A.play('honey'); break;
      case 'enemyAttack': A.play('worm'); break;
      case 'wormCopy': A.play('wormCopy'); break;
      case 'nodeImpact': A.play('floodImpact'); break;
      case 'siegeBegin': A.play('siege'); break;
      case 'reveal': A.play('reveal'); break;
      case 'payload': A.play('payload'); break;
      case 'packerPulse': A.play('packer'); break;
      case 'enemySpawn': if (ev.enemy.type === 'hotspot') A.play('hotspot'); break;
      case 'enemyDie': A.play(ev.enemy.type === 'flood' || ev.enemy.def.boss ? 'dieBig' : 'die'); break;
      case 'enemyLeak': A.play('leak'); break;
      case 'nodeIsolated': A.play('isolate'); break;
      case 'nodeOpen': A.play('bypass'); break;
      case 'routeChange': A.play('route'); break;
      case 'intelGain': A.play('intel'); break;
      case 'itemUsed': A.play({ isolator: 'itemIso', downgrade: 'itemDown', backup: 'itemBack' }[ev.item]); break;
      case 'waveStart': A.play('wave'); break;
      case 'surge': A.play('surge'); break;
      case 'newThreat': if (ev.first) A.play('threat'); break;
      case 'bossSpawn': A.play('bossIn'); A.setBoss(true); break;
      case 'bossPhase': A.play('bossPhase'); break;
      case 'bossWarn': A.play('bossWarn'); break;
      case 'bossSurge': A.play('bossSurge'); break;
      case 'bossSwarm': A.play('swarm'); break;
      case 'bossStorm': A.play('storm'); break;
      case 'holeOpen': A.play(ev.hole.kind === 'hole' ? 'hole' : 'lock'); break;
      case 'victory': A.setBoss(false); A.play('victory'); break;
      case 'defeat': A.setBoss(false); A.play('defeat'); break;
      case 'reject': A.play('uiDeny'); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
