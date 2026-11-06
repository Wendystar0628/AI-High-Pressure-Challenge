// 音效：全部由 Web Audio 实时合成，不加载任何音频文件，本地文件方式和离线都可用。
// 只读取仿真状态（果冻场景的接触事件、水槽场景的独立回读），不改变任何物理量。
'use strict';

const AudioFX = {
  ctx: null,
  enabled: true,
  volume: 0.8,
  rate: 1,
  voices: 0,
  counts: {},
  _last: {},
  _pair: new Float64Array(64 * 64),
  _prevBalls: null,
  _prevT: -1,
  _ballBusy: false,
  _hBusy: false,
  _hNext: 0,
  _prevH: null,
  _wasWaving: false,
  _rollPhase: 0,

  init() {
    try {
      const saved = JSON.parse(localStorage.getItem('jelly-tank-sound') || 'null');
      if (saved) { this.enabled = !!saved.enabled; this.volume = clamp(+saved.volume || 0, 0, 1); }
    } catch (e) { /* 本地存储不可用时使用默认值 */ }
    // 浏览器要求用户操作后才能发声：任何点击或按键都尝试解锁
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (this.enabled) this.ctx.resume();
    });
  },

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this._buildGraph();
    }
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
    if (typeof UI !== 'undefined' && UI.syncSound) UI.syncSound();
  },

  isRunning() { return !!this.ctx && this.ctx.state === 'running'; },

  setEnabled(v) {
    this.enabled = !!v;
    this._save();
    this._applyMaster();
    if (this.enabled) { this.unlock(); this._uiTick(); }
    if (typeof UI !== 'undefined' && UI.syncSound) UI.syncSound();
  },
  toggle() { this.setEnabled(!this.enabled); },
  setVolume(v) { this.volume = clamp(v, 0, 1); this._save(); this._applyMaster(); },
  _save() {
    try { localStorage.setItem('jelly-tank-sound', JSON.stringify({ enabled: this.enabled, volume: this.volume })); } catch (e) { /* 忽略 */ }
  },
  _applyMaster(tc = 0.03) {
    if (!this.ctx) return;
    const on = this.enabled && !(typeof App !== 'undefined' && App.exporting);
    this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, tc);
  },
  // 导出只管画面：静音并停止产生事件
  silence() {
    if (!this.ctx) return;
    this._applyMaster(0.01);
    this._prevBalls = null; this._prevH = null;
  },
  _live() {
    return this.isRunning() && this.enabled && !App.exporting && !document.hidden;
  },

  // 主混音、程序生成的小房间混响和各持续声层
  _buildGraph() {
    const c = this.ctx;
    const sr = c.sampleRate;
    const mk = (len, fn) => { const b = c.createBuffer(1, len, sr); fn(b.getChannelData(0), len); return b; };
    this.white = mk(sr * 3, (d, n) => { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; });
    this.pink = mk(sr * 3, (d, n) => {
      let a = 0, b = 0, e = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        a = 0.99765 * a + w * 0.099046; b = 0.963 * b + w * 0.2965164; e = 0.57 * e + w * 1.0526913;
        d[i] = (a + b + e + w * 0.1848) * 0.2;
      }
    });
    this.brown = mk(sr * 3, (d, n) => {
      let l = 0;
      for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.2; }
    });

    this.master = c.createGain();
    this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(comp); comp.connect(this.analyser); this.analyser.connect(c.destination);
    this.dry = c.createGain();
    this.dry.connect(this.master);
    // 混响脉冲：指数衰减的立体声噪声，越往后越暗
    const irLen = Math.floor(sr * 1.15);
    const ir = c.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        const k = 0.5 - 0.42 * t;
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - t, 3.4);
      }
    }
    this.reverb = c.createConvolver();
    this.reverb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet); wet.connect(this.master);

    // 持续声层：增益与滤波每帧跟随仿真状态
    const noiseLayer = (buf, type, f, q, pan = 0) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      const p = c.createStereoPanner(); p.pan.value = pan;
      s.connect(fl); fl.connect(g); g.connect(p); p.connect(this.dry);
      s.start();
      return { g, fl, p };
    };
    const oscLayer = (type, f, lp) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 0.7;
      const g = c.createGain(); g.gain.value = 0;
      const p = c.createStereoPanner();
      o.connect(fl); fl.connect(g); g.connect(p); p.connect(this.dry);
      o.start();
      return { o, g, fl, p };
    };
    this.L = {
      wobble: oscLayer('triangle', 90, 420),     // 果冻整体振荡的低频颤音
      squish: noiseLayer(this.pink, 'bandpass', 520, 1.1),   // 果冻内部的湿滑摩擦
      roll: noiseLayer(this.brown, 'lowpass', 400, 0.7),     // 球在台面/槽底滚动
      air: noiseLayer(this.white, 'bandpass', 1200, 0.8),    // 球下落的风声
      plat: oscLayer('sine', 54, 200),           // 弹性平台的振动
      motor: oscLayer('sawtooth', 55, 260),      // 造浪电机
      paddle: noiseLayer(this.brown, 'lowpass', 500, 0.5),   // 推板推水
      wash: noiseLayer(this.pink, 'bandpass', 800, 0.6),     // 水面波动的哗哗声
      swell: noiseLayer(this.brown, 'lowpass', 170, 0.5),    // 涌浪的低频
      tray: noiseLayer(this.white, 'bandpass', 3400, 1.4),   // 托板抽出的摩擦
    };
    this._applyMaster();
  },

  _set(layer, gain, tc = 0.05) { layer.g.gain.setTargetAtTime(gain, this.ctx.currentTime, tc); },
  _quietAll(tc = 0.06) { for (const k in this.L) this._set(this.L[k], 0, tc); },

  // —— 合成单元 ——
  _play(kind, gap, opts, len, build) {
    if (!this._live()) return;
    const c = this.ctx, now = c.currentTime;
    if (now - (this._last[kind] === undefined ? -1 : this._last[kind]) < gap) return;
    if (this.voices >= 56) return;
    this._last[kind] = now;
    this.counts[kind] = (this.counts[kind] || 0) + 1;
    const input = c.createGain();
    let tail = input;
    const extra = [];
    if (opts.muffle > 0) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 16000 * Math.pow(600 / 16000, opts.muffle);
      lp.Q.value = 0.5;
      input.connect(lp); tail = lp; extra.push(lp);
    }
    const p = c.createStereoPanner();
    p.pan.value = clamp(opts.pan || 0, -0.9, 0.9);
    tail.connect(p); p.connect(this.dry);
    let send = null;
    if (opts.wet > 0) {
      send = c.createGain(); send.gain.value = opts.wet;
      p.connect(send); send.connect(this.reverb);
    }
    const r = this.rate;
    build(input, now + 0.001, r);
    this.voices++;
    setTimeout(() => {
      this.voices--;
      input.disconnect(); extra.forEach((n) => n.disconnect()); p.disconnect();
      if (send) send.disconnect();
    }, (len / r + 0.25) * 1000);
  },
  _tone(out, t, f0, f1, dur, gain, type = 'sine', attack = 0.002) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  },
  _noise(out, t, buf, type, f0, f1, q, dur, gain, attack = 0.002) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf;
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out);
    s.start(t, Math.random() * 2.5, dur + 0.05);
  },
  // 模态合成：若干带独立衰减的分音，近似固体被敲击后的振铃
  _modal(out, t, r, base, ratios, gains, decays, gain) {
    for (let i = 0; i < ratios.length; i++) {
      const f = base * ratios[i] * r * (1 + (Math.random() - 0.5) * 0.012);
      if (f > 17000) continue;
      this._tone(out, t, f, f, decays[i] / r, gain * gains[i], 'sine', 0.0007);
    }
  },
  // 重球材质：钢清亮、花岗岩短促、黄铜温暖；半径越大音高越低
  _ballRing(out, t, r, mat, radius, gain) {
    const k = 0.15 / radius;
    if (mat === 1) {
      this._modal(out, t, r, 950 * k, [1, 2.13, 3.4], [1, 0.55, 0.3], [0.05, 0.03, 0.018], gain * 0.9);
      this._noise(out, t, this.white, 'bandpass', 2800, 1800, 0.8, 0.03, gain * 0.5);
    } else if (mat === 2) {
      this._modal(out, t, r, 1320 * k, [1, 2.76, 5.4, 8.93], [1, 0.62, 0.3, 0.14], [0.34, 0.2, 0.11, 0.06], gain * 0.62);
    } else {
      this._modal(out, t, r, 2150 * k, [1, 2.76, 5.4, 8.93], [1, 0.7, 0.42, 0.22], [0.26, 0.15, 0.08, 0.045], gain * 0.55);
    }
  },
  _pan(wx, wz) {
    const cam = App.activeCam();
    const rel = (wx - cam.target[0]) * Math.cos(cam.yaw) - (wz - cam.target[2]) * Math.sin(cam.yaw);
    return clamp(rel / (cam.dist * 0.42), -0.85, 0.85);
  },
  _uiTick() {
    this._play('ui', 0.05, { pan: 0, wet: 0.05 }, 0.08, (o, t, r) => this._tone(o, t, 1250 * r, 900 * r, 0.05, 0.1));
  },

  // —— 场景一：由物理子步直接上报的事件 ——
  jellyEvent(kind, B, v, other) {
    if (!this._live()) return;
    const s = App.jelly, pan = this._pan(B.x, B.z);
    const E = 0.5 * B.mass * v * v;
    const id = s.balls.indexOf(B);
    if (kind === 'jellyHit') {
      if (v < 0.28) return;
      const g = clamp(Math.sqrt(E / 240), 0.05, 1.15);
      // 果冻越硬、球越轻，闷响的音高越高
      const pf = clamp(Math.sqrt(s.p.stiffness / 18) * Math.pow(22 / B.mass, 0.14), 0.55, 2.2);
      this._play('jellyHit' + id, 0.14, { pan, wet: 0.3 }, 0.6, (o, t, r) => {
        this._tone(o, t, 165 * pf * r, 40 * pf * r, 0.42, 0.95 * g);
        this._noise(o, t, this.pink, 'bandpass', 1200 * r, 320 * r, 0.9, 0.2, 0.75 * g, 0.004);
        this._tone(o, t + 0.012, 320 * pf * r, 92 * pf * r, 0.2, 0.2 * g, 'sawtooth', 0.006);
        this._ballRing(o, t, r, B.mat, B.r, 0.16 * g);
      });
      this._tally('jellyHit');
    } else if (kind === 'jellyLeave') {
      if (v < 0.3) return;
      const g = clamp(v / 3.2, 0.1, 1);
      // 脱离时的湿润“啵”声，反弹越快越响、音高越高
      this._play('jellyLeave' + id, 0.18, { pan, wet: 0.22 }, 0.2, (o, t, r) => {
        this._tone(o, t, 170 * r, (420 + 220 * g) * r, 0.11, 0.5 * g, 'sine', 0.008);
        this._noise(o, t, this.pink, 'bandpass', 1500 * r, 2400 * r, 1.4, 0.07, 0.24 * g, 0.004);
      });
      this._tally('jellyLeave');
    } else if (kind === 'plateHit' || kind === 'floorHit') {
      const g = clamp(Math.sqrt(E / 110), 0.04, 1.1);
      const floor = kind === 'floorHit';
      const el = s.p.platformElastic;
      this._play(kind + id, 0.09, { pan, wet: floor ? 0.2 : 0.3, muffle: floor ? 0.35 : 0 }, 0.8, (o, t, r) => {
        this._ballRing(o, t, r, B.mat, B.r, 0.75 * g);
        this._tone(o, t, 135 * r, 54 * r, 0.24 + 0.3 * el, 0.8 * g);
        this._noise(o, t, this.white, 'bandpass', 2600 * r, 1100 * r, 0.8, 0.035, 0.34 * g);
      });
      this._tally(kind);
    } else if (kind === 'lipHit') {
      const g = clamp(v / 2.4, 0.06, 1) * clamp(Math.sqrt(B.mass / 22), 0.5, 1.4);
      this._play('lipHit' + id, 0.1, { pan, wet: 0.38 }, 0.7, (o, t, r) => {
        this._ballRing(o, t, r, B.mat, B.r, 0.5 * g);
        this._modal(o, t, r, 760, [1, 2.31, 4.1], [1, 0.5, 0.24], [0.42, 0.22, 0.1], 0.3 * g);
      });
      this._tally('lipHit');
    } else if (kind === 'ballHit') {
      const mu = B.mass * other.mass / (B.mass + other.mass);
      const g = clamp(Math.sqrt(0.5 * mu * v * v / 55), 0.04, 1.1);
      const mid = this._pan((B.x + other.x) / 2, (B.z + other.z) / 2);
      this._play('ballHit', 0.035, { pan: mid, wet: 0.34 }, 0.5, (o, t, r) => {
        this._ballRing(o, t, r, B.mat, B.r, 0.72 * g);
        this._ballRing(o, t, r, other.mat, other.r, 0.62 * g);
        this._noise(o, t, this.white, 'highpass', 3600 * r, 3000 * r, 0.7, 0.012, 0.3 * g, 0.0007);
      });
      this._tally('ballHit');
    } else if (kind === 'release') {
      this._play('release', 0.04, { pan, wet: 0.2 }, 0.14, (o, t, r) => {
        this._noise(o, t, this.white, 'bandpass', 3200 * r, 2200 * r, 1.2, 0.022, 0.3, 0.0007);
        this._tone(o, t, 220 * r, 86 * r, 0.075, 0.28);
      });
      this._tally('release');
    } else if (kind === 'catch') {
      this._play('catch', 0.1, { pan, wet: 0.26 }, 0.45, (o, t, r) => {
        this._ballRing(o, t, r, B.mat, B.r, 0.3);
        this._tone(o, t, 180 * r, 72 * r, 0.1, 0.42);
      });
      this._tally('catch');
    }
  },
  _tally(k) { this.counts[k + '#'] = (this.counts[k + '#'] || 0) + 1; },

  // 果冻场景的持续声层：振幅直接取自果冻的实时动能与重球运动
  _updateJelly() {
    const s = App.jelly, L = this.L, r = this.rate;
    const vRms = Math.sqrt(2 * (s.kinE || 0) / Math.max(s.totalMass || 800, 1));
    const f0 = clamp(88 * Math.sqrt(s.p.stiffness / 18) * Math.sqrt(0.62 / s.p.height), 40, 240);
    const disp = clamp((s.dentCenter || 0) / s.p.height, -0.4, 0.6);
    const now = this.ctx.currentTime;
    L.wobble.o.frequency.setTargetAtTime(f0 * (1 + 1.1 * disp) * r, now, 0.03);
    this._set(L.wobble, clamp((vRms - 0.004) * 3.2, 0, 1) * 0.36, 0.03);
    let squish = clamp(vRms * 2.2, 0, 1) * 0.1;

    let rollAmt = 0, rollW = 0, rollPan = 0, airAmt = 0, airV = 0, airPan = 0;
    const top = PLATFORM.top + s.platY;
    for (const B of s.balls) {
      if (B.held || B.caught) continue;
      const sp = Math.hypot(B.vx, B.vz);
      const speed = Math.hypot(B.vx, B.vy, B.vz);
      const onSurface = B.y - B.r <= top + 0.012 || B.y - B.r <= 0.012;
      if (onSurface && sp > 0.03) {
        const a = clamp(sp / 2, 0, 1) * clamp(Math.pow(B.mass / 22, 0.3), 0.5, 1.5);
        if (a > rollAmt) { rollAmt = a; rollW = sp / B.r; rollPan = this._pan(B.x, B.z); }
      }
      if (B.contact > 0 && sp > 0.05) squish += clamp(sp / 2.5, 0, 1) * 0.1;
      if (B.contact === 0 && !onSurface) {
        const a = clamp(speed / 6, 0, 1);
        if (a > airAmt) { airAmt = a; airV = speed; airPan = this._pan(B.x, B.z); }
      }
    }
    this._set(L.squish, Math.min(squish, 0.24), 0.04);
    L.squish.fl.frequency.setTargetAtTime((380 + 900 * clamp(vRms, 0, 1)) * r, now, 0.05);
    // 滚动声带有随转速变化的周期起伏（球面凹槽压过台面）
    this._rollPhase += rollW * (this._dtReal || 0.016);
    const ripple = 1 + 0.32 * Math.sin(this._rollPhase);
    this._set(L.roll, rollAmt * 0.5 * ripple, 0.03);
    L.roll.fl.frequency.setTargetAtTime((240 + 620 * rollAmt) * r, now, 0.05);
    L.roll.p.pan.setTargetAtTime(rollPan, now, 0.05);
    this._set(L.air, airAmt * airAmt * 0.13, 0.04);
    L.air.fl.frequency.setTargetAtTime((550 + airV * 420) * r, now, 0.05);
    L.air.p.pan.setTargetAtTime(airPan, now, 0.05);
    this._set(L.plat, s.platK > 0 ? clamp(Math.abs(s.platV) / 0.3, 0, 1) * 0.24 * s.p.platformElastic : 0, 0.03);
  },

  // —— 场景二：入水、碰撞与波浪 ——
  _splash(speed, mass, pan) {
    const s = clamp(speed / 3, 0.15, 1.2) * clamp(0.62 + 0.45 * Math.sqrt(mass / 0.45), 0.6, 1.2);
    const heavy = clamp(mass / 0.85, 0, 1);
    this._play('splash', 0.018, { pan, wet: 0.3 }, 1.0, (o, t, r) => {
      // 拍水 + 空腔闭合的“扑通” + 低频水体 + 溅起的水滴
      this._noise(o, t, this.white, 'bandpass', 2000 * r, 700 * r, 0.75, 0.13, 0.62 * s);
      this._tone(o, t, 150 * r, 66 * r, 0.22, 0.5 * s);
      const pf = (1 - 0.26 * heavy) * (0.92 + Math.random() * 0.16);
      this._tone(o, t + 0.05 / r, 300 * pf * r, 720 * pf * r, 0.15 / r, 0.42 * s, 'sine', 0.012);
      this._noise(o, t + 0.015, this.white, 'highpass', 3000 * r, 5200 * r, 0.7, 0.32, 0.15 * s, 0.015);
      // 气泡上升的咕嘟声
      const n = Math.round(2 + 6 * s);
      for (let i = 0; i < n; i++) {
        const dt = (0.09 + Math.random() * 0.62) / r;
        const f = (480 + Math.random() * 950) * r;
        this._tone(o, t + dt, f, f * 1.55, 0.05 + Math.random() * 0.05, (0.06 + Math.random() * 0.1) * s, 'sine', 0.006);
      }
    });
    this._tally('splash');
  },
  // 水槽小球：同尺寸不同密度，密度越大敲击音越亮、越结实
  _tankClack(dv, rho, muffle, pan) {
    const g = clamp(dv / 1.5, 0.05, 1);
    const f = 980 + clamp(rho / 2800, 0, 1) * 1700;
    this._play('tankClack', 0.02, { pan, wet: 0.2, muffle }, 0.2, (o, t, r) => {
      this._modal(o, t, r, f, [1, 2.3, 3.9], [1, 0.5, 0.22], [0.055, 0.03, 0.016], 0.6 * g);
      this._noise(o, t, this.white, 'bandpass', 3400 * r, 2400 * r, 0.8, 0.012, 0.22 * g, 0.0007);
    });
    this._tally('tankClack');
  },
  _floorKnock(dv, mass, pan, under) {
    const g = clamp(dv * Math.sqrt(mass / 0.5) * 0.7, 0.05, 1);
    this._play('floorKnock', 0.025, { pan, wet: 0.18, muffle: under ? 0.58 : 0.2 }, 0.25, (o, t, r) => {
      this._modal(o, t, r, 410, [1, 2.7, 5.2], [1, 0.45, 0.2], [0.1, 0.055, 0.022], 0.72 * g);
      this._tone(o, t, 120 * r, 62 * r, 0.09, 0.45 * g);
    });
    this._tally('floorKnock');
  },
  _glassKnock(dv, pan, under) {
    const g = clamp(dv / 1.2, 0.05, 1);
    this._play('glassKnock', 0.03, { pan, wet: 0.3, muffle: under ? 0.5 : 0 }, 0.3, (o, t, r) => {
      this._modal(o, t, r, 1850, [1, 1.93, 3.31], [1, 0.55, 0.28], [0.14, 0.08, 0.04], 0.42 * g);
    });
    this._tally('glassKnock');
  },

  // 球在 GPU 上：另开一个回读缓冲，只复制不写入，不影响仿真与界面统计
  _pollBalls() {
    const s = App.tank;
    if (this._ballBusy || !s.bBalls) return;
    if (!this._ballStage) this._ballStage = GX.buffer(TANK_MAX_BALLS * 96, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'audio balls');
    this._ballBusy = true;
    const enc = GX.device.createCommandEncoder();
    enc.copyBufferToBuffer(s.bBalls, 0, this._ballStage, 0, TANK_MAX_BALLS * 96);
    GX.queue.submit([enc.finish()]);
    const t = s.t, n = s.nBalls;
    this._ballStage.mapAsync(GPUMapMode.READ).then(() => {
      const f = new Float32Array(this._ballStage.getMappedRange().slice(0));
      this._ballStage.unmap();
      this._ballBusy = false;
      this._analyzeBalls(f, t, n);
    }).catch(() => { this._ballBusy = false; });
  },

  _analyzeBalls(f, t, n) {
    if (!this._live() || App.scene !== 'tank') { this._prevBalls = null; return; }
    const pv = this._prevBalls, pt = this._prevT;
    if (t === pt) return;                 // 暂停时没有新状态
    this._prevBalls = f; this._prevT = t;
    let bottomSpeed = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 24;
      if (f[o + 11] > 0.5 && f[o + 1] < f[o + 3] * 1.1) bottomSpeed += Math.hypot(f[o + 4], f[o + 6]);
    }
    this._bottomRoll = bottomSpeed;
    if (!pv || t < pt) return;            // 刚重置或首次
    const s = App.tank, lx = s.lx, lz = s.lz;
    let fired = 0;
    for (let i = 0; i < n && fired < 8; i++) {
      const o = i * 24;
      const st = f[o + 11], pst = pv[o + 11];
      if (st < 0.5) continue;
      const x = f[o], y = f[o + 1], z = f[o + 2], r = f[o + 3], m = f[o + 7];
      const px = pv[o], py = pv[o + 1], pz = pv[o + 2];
      if (Math.hypot(x - px, y - py, z - pz) > 0.4) continue;   // 重新摆放造成的跳变
      const vx = f[o + 4], vy = f[o + 5], vz = f[o + 6];
      const pvx = pv[o + 4], pvy = pv[o + 5], pvz = pv[o + 6];
      const frac = f[o + 20], pfrac = pv[o + 20];
      const pan = this._pan(x - lx / 2, z - lz / 2);
      const under = frac > 0.6;
      if (pst < 0.5) {
        // 托板抽走，球开始下落
        this._play('drop', 0.05, { pan, wet: 0.14 }, 0.08, (o2, t2, r2) => this._tone(o2, t2, 980 * r2, 640 * r2, 0.03, 0.05));
        continue;
      }
      // 入水：由空气进入水面的瞬间，响度由当时的速度和质量决定
      if (pfrac < 0.03 && frac >= 0.03 && pvy < -0.35) { this._splash(Math.hypot(pvx, pvy, pvz), m, pan); fired++; continue; }
      // 轻球冲出水面
      if (pfrac > 0.9 && frac <= 0.9 && vy > 0.35) {
        const g = clamp(vy / 1.6, 0.1, 1);
        this._play('breach', 0.05, { pan, wet: 0.24 }, 0.25, (o2, t2, r2) => {
          this._noise(o2, t2, this.white, 'bandpass', 1500 * r2, 2600 * r2, 0.9, 0.11, 0.26 * g, 0.006);
          this._tone(o2, t2, 340 * r2, 650 * r2, 0.09, 0.2 * g, 'sine', 0.006);
        });
        this._tally('breach');
        fired++;
      }
      // 触底
      if (y < r * 1.04 && pvy < -0.1 && vy > pvy + 0.09) { this._floorKnock(vy - pvy, m, pan, under); fired++; }
      // 玻璃壁与造浪板
      if (x > lx - r * 1.04 && pvx > 0.1 && vx < pvx - 0.09) { this._glassKnock(pvx - vx, pan, under); fired++; }
      if (z < r * 1.04 && pvz < -0.1 && vz > pvz + 0.09) { this._glassKnock(vz - pvz, pan, under); fired++; }
      if (z > lz - r * 1.04 && pvz > 0.1 && vz < pvz - 0.09) { this._glassKnock(pvz - vz, pan, under); fired++; }
      if (x < s.padX0 + s.padS + r * 1.06 && vx > pvx + 0.12) { this._floorKnock(vx - pvx, m, pan, under); fired++; }
      // 球-球：相邻且法向相对速度发生跳变才算一次碰撞
      for (let j = i + 1; j < n && fired < 8; j++) {
        const q = j * 24;
        if (f[q + 11] < 0.5 || pv[q + 11] < 0.5) continue;
        const dx = f[q] - x, dy = f[q + 1] - y, dz = f[q + 2] - z;
        const rr = r + f[q + 3] + 0.006;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > rr * rr || d2 < 1e-8) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
        const before = (pv[q + 4] - pvx) * nx + (pv[q + 5] - pvy) * ny + (pv[q + 6] - pvz) * nz;
        const after = (f[q + 4] - vx) * nx + (f[q + 5] - vy) * ny + (f[q + 6] - vz) * nz;
        if (before > -0.05 || after - before < 0.09) continue;
        const key = i * 64 + j, now = this.ctx.currentTime;
        if (now - this._pair[key] < 0.12) continue;
        this._pair[key] = now;
        const g0 = s.p.dens[Math.round(f[o + 19])], g1 = s.p.dens[Math.round(f[q + 19])];
        this._tankClack(after - before, Math.max(g0, g1), under ? 0.62 : 0.06, pan);
        fired++;
      }
    }
  },

  // 读取水面高度场：得到波幅、水面运动速度，并在波峰拍到远端玻璃时发声
  _pollHeights() {
    const s = App.tank;
    if (this._hBusy || !s.bHeights) return;
    const size = s.nx * s.nz * 4;
    if (!this._hStage || this._hSize !== size) {
      if (this._hStage) this._hStage.destroy();
      this._hStage = GX.buffer(size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'audio heights');
      this._hSize = size;
      this._prevH = null;
    }
    this._hBusy = true;
    const enc = GX.device.createCommandEncoder();
    enc.copyBufferToBuffer(s.bHeights, 0, this._hStage, 0, size);
    GX.queue.submit([enc.finish()]);
    const t = s.t, nx = s.nx, nz = s.nz, stage = this._hStage;
    stage.mapAsync(GPUMapMode.READ, 0, size).then(() => {
      const h = new Float32Array(stage.getMappedRange(0, size).slice(0));
      stage.unmap();
      this._hBusy = false;
      this._analyzeHeights(h, t, nx, nz);
    }).catch(() => { this._hBusy = false; });
  },

  _analyzeHeights(h, t, nx, nz) {
    if (!this._live() || App.scene !== 'tank') { this._prevH = null; return; }
    const prev = this._prevH;
    if (prev && prev.t === t) return;
    let sum = 0, cnt = 0, wall = 0, wallN = 0;
    for (let k = 0; k < nz; k += 2) for (let i = 0; i < nx; i += 2) {
      const v = h[i + nx * k];
      if (v > 0) { sum += v; cnt++; }
      if (i >= nx - 5 && v > 0) { wall += v; wallN++; }
    }
    if (!cnt) return;
    const mean = sum / cnt;
    wall = wallN ? wall / wallN : mean;
    let var2 = 0, rate = 0, rn = 0;
    const dt = prev ? t - prev.t : 0;
    for (let k = 0; k < nz; k += 2) for (let i = 0; i < nx; i += 2) {
      const v = h[i + nx * k];
      if (v <= 0) continue;
      var2 += (v - mean) * (v - mean);
      if (prev && dt > 0 && prev.h.length === h.length) {
        const w = prev.h[i + nx * k];
        if (w > 0) { rate += Math.abs(v - w); rn++; }
      }
    }
    this._waveRms = Math.sqrt(var2 / cnt);
    this._waveRate = rn && dt > 0 ? rate / rn / dt : 0;
    // 远端壁水位由升转降：波峰拍在玻璃上
    if (prev && dt > 0) {
      const wr = (wall - prev.wall) / dt;
      const wasRising = prev.wr > 0.1;
      if (wasRising && wr <= 0 && wall - mean > 0.025) {
        const g = clamp((wall - mean) / 0.14, 0.12, 1);
        const pan = this._pan(App.tank.lx / 2, 0);
        this._play('slap', 0.45, { pan, wet: 0.34 }, 0.8, (o, t2, r) => {
          this._noise(o, t2, this.pink, 'bandpass', 1300 * r, 480 * r, 0.7, 0.55, 0.42 * g, 0.03);
          this._noise(o, t2, this.brown, 'lowpass', 300 * r, 120 * r, 0.6, 0.5, 0.55 * g, 0.03);
          this._noise(o, t2 + 0.04, this.white, 'highpass', 3600 * r, 5000 * r, 0.7, 0.3, 0.08 * g, 0.02);
        });
        this._tally('slap');
      }
      this._prevH = { h, t, wall, wr };
    } else {
      this._prevH = { h, t, wall, wr: 0 };
    }
  },

  _updateTank() {
    const s = App.tank, L = this.L, r = this.rate, now = this.ctx.currentTime;
    this._pollBalls();
    if (now >= this._hNext) { this._hNext = now + 0.07; this._pollHeights(); }

    // 造浪装置：启停继电器 + 电机 + 推板推水，推水声的起伏与板速同步
    const waving = s.isWaving();
    if (waving !== this._wasWaving) {
      this._wasWaving = waving;
      const pan = this._pan(-s.lx / 2 - 0.3, 0);
      this._play('relay', 0.1, { pan, wet: 0.16 }, 0.2, (o, t, rr) => {
        this._noise(o, t, this.white, 'bandpass', 2300 * rr, 1200 * rr, 1.1, 0.025, 0.34, 0.0007);
        this._tone(o, t, waving ? 90 * rr : 130 * rr, waving ? 150 * rr : 70 * rr, 0.12, 0.36, 'square', 0.002);
      });
      this._tally('relay');
    }
    const u = Math.abs(s.padU || 0);
    const uNorm = clamp(u / 0.45, 0, 1);
    const running = waving || u > 0.008;
    const padPan = this._pan(-s.lx / 2 + s.padRest(), 0);
    L.motor.o.frequency.setTargetAtTime((46 + 34 * uNorm) * r, now, 0.05);
    this._set(L.motor, running ? 0.03 + 0.05 * uNorm : 0, running ? 0.15 : 0.3);
    L.motor.p.pan.setTargetAtTime(this._pan(-s.lx / 2 - 0.38, 0), now, 0.1);
    this._set(L.paddle, uNorm * 0.42, 0.03);
    L.paddle.fl.frequency.setTargetAtTime((220 + 1000 * uNorm) * r, now, 0.03);
    L.paddle.p.pan.setTargetAtTime(padPan, now, 0.1);

    // 水面：波动越快哗哗声越亮，波幅越大低频越厚
    const wr = Math.max((this._waveRate || 0) - 0.012, 0);
    this._set(L.wash, clamp(wr / 0.28, 0, 1) * 0.3, 0.08);
    L.wash.fl.frequency.setTargetAtTime((560 + 1300 * clamp(wr / 0.4, 0, 1)) * r, now, 0.1);
    this._set(L.swell, clamp(((this._waveRms || 0) - 0.003) / 0.07, 0, 1) * 0.5, 0.12);

    // 槽底滚动（隔水发闷）
    const roll = clamp((this._bottomRoll || 0) / 2.4, 0, 1);
    this._set(L.roll, roll * 0.26, 0.06);
    L.roll.fl.frequency.setTargetAtTime((170 + 340 * roll) * r, now, 0.08);
    L.roll.p.pan.setTargetAtTime(0, now, 0.1);

    // 托板抽出
    const sliding = s.trayT >= 0 && (s.t - s.trayT) * 1.15 < s.lx;
    this._set(L.tray, sliding ? 0.05 : 0, 0.03);
  },

  // 每帧调用；dtReal 为真实帧间隔，用于滚动起伏的相位
  update(paused, dtReal) {
    if (!this.isRunning()) return;
    this._dtReal = dtReal;
    // 慢动作：音高和时长随之拉伸，但比画面拉伸得少，保持可辨认
    this.rate = Math.pow(App.speed, 0.4);
    this._applyMaster();
    const L = this.L;
    const quiet = paused || !this.enabled;
    if (quiet) { this._quietAll(); return; }
    if (App.scene === 'jelly') {
      for (const k of ['motor', 'paddle', 'wash', 'swell', 'tray']) this._set(L[k], 0, 0.1);
      this._wasWaving = false;
      this._updateJelly();
    } else {
      for (const k of ['wobble', 'squish', 'air', 'plat']) this._set(L[k], 0, 0.1);
      this._updateTank();
    }
  },

  // 测试与界面用：当前输出电平
  level() {
    if (!this.analyser) return 0;
    const d = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(d);
    let s = 0;
    for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    return Math.sqrt(s / d.length);
  },
};
