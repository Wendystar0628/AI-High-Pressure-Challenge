'use strict';
// ---------------------------------------------------------------------------
// 程序合成音效（WebAudio）：撞击、回弹、开裂、球体碰撞、入水、造浪
// ---------------------------------------------------------------------------
const Sound = {
  ctx: null, enabled: true, master: null, noiseBuf: null, last: {}, started: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 4; this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    // 混响（短房间）
    this.verb = c.createConvolver();
    const len = c.sampleRate * 1.4, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.verb.buffer = ir;
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.22;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    const nl = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, nl, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    this.setupLoops();
    this.started = true;
  },
  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  },
  out(g) { g.connect(this.master); g.connect(this.verb); },
  _throttle(key, ms) {
    const now = performance.now();
    if (this.last[key] && now - this.last[key] < ms) return false;
    this.last[key] = now; return true;
  },
  noise(t, dur, filtType, f0, f1, q, gain, attack) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = filtType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); this.out(g);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  tone(t, dur, type, f0, f1, gain, attack) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.out(g);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  },
  // 软体果冻的“噗嘟”回弹：带颤音的低频
  wobble(t, f, dur, gain) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.7, t); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.08); o.frequency.exponentialRampToValueAtTime(f * 0.9, t + dur);
    const lfo = c.createOscillator(); lfo.frequency.value = 9 + Math.random() * 4;
    const lg = c.createGain(); lg.gain.value = f * 0.12; lfo.connect(lg); lg.connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.out(g);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  },
  play(type, p, rate) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    rate = rate || 1;
    const t = this.ctx.currentTime + 0.005;
    const slow = rate < 0.9 ? 0.6 + 0.4 * rate : 1; // 慢放时音高略降
    switch (type) {
      case 'impact': {
        if (!this._throttle('impact' + (p.ball || 0), 120)) return;
        const e = U.clamp(p.speed * Math.sqrt(p.mass) / 40, 0.05, 1.2);
        this.tone(t, 0.32 / slow, 'sine', 140 * slow, 45, 0.55 * e);
        this.noise(t, 0.16 / slow, 'bandpass', 900 * slow, 260, 1.2, 0.35 * e);
        this.wobble(t + 0.03, (190 + 60 * Math.random()) * slow, 0.55 / slow, 0.16 * e);
        break;
      }
      case 'rebound': {
        if (!this._throttle('rebound', 200)) return;
        const e = U.clamp(p.speed / 4, 0.05, 1);
        this.wobble(t, 260 * slow, 0.4 / slow, 0.14 * e);
        break;
      }
      case 'crack': {
        if (!this._throttle('crack', 45)) return;
        const e = U.clamp(p.n / 40, 0.15, 1);
        const k = 2 + Math.min(6, Math.floor(p.n / 8));
        for (let i = 0; i < k; i++) {
          const tt = t + (i * 0.018 + Math.random() * 0.012) / slow;
          this.noise(tt, 0.05 / slow, 'highpass', 2600 * slow, 1200, 0.7, 0.32 * e);
          this.noise(tt, 0.09 / slow, 'bandpass', 700 * slow, 300, 2, 0.25 * e);
        }
        if (p.newPiece) this.tone(t, 0.45 / slow, 'triangle', 90 * slow, 40, 0.35);
        break;
      }
      case 'clack': {
        if (!this._throttle('clack', 40)) return;
        const e = U.clamp(p.speed / 5, 0.05, 1);
        if (p.mat === 1) {
          this.noise(t, 0.08, 'bandpass', 1300 * slow, 700, 3, 0.5 * e);
          this.tone(t, 0.1, 'sine', 420 * slow, 300, 0.25 * e);
        } else {
          for (const [f, g] of [[2150, 0.25], [3480, 0.16], [5230, 0.1], [910, 0.12]]) this.tone(t, 0.45 / slow, 'sine', f * slow, f * 0.995 * slow, g * e, 0.001);
        }
        break;
      }
      case 'thud': {
        if (!this._throttle('thud', 60)) return;
        const e = U.clamp(p.speed * Math.sqrt(p.mass) / 50, 0.04, 1);
        this.tone(t, 0.22 / slow, 'sine', 110 * slow, 50, 0.5 * e);
        this.noise(t, 0.08, 'lowpass', 1500 * slow, 300, 0.7, 0.35 * e);
        if (p.mat === 0 || p.mat === 2) this.tone(t, 0.25, 'sine', 1800 * slow, 1790, 0.05 * e, 0.001);
        break;
      }
      case 'splash': {
        if (!this._throttle('splash', 35)) return;
        const e = U.clamp(p.speed / 4.5, 0.08, 1) * (0.6 + 0.4 * Math.min(p.mass || 1, 2));
        this.noise(t, 0.35 / slow, 'bandpass', 3200 * slow, 500, 0.9, 0.42 * e);
        this.noise(t + 0.02, 0.6 / slow, 'lowpass', 1800 * slow, 300, 0.5, 0.18 * e, 0.02);
        this.tone(t + 0.04, 0.09 / slow, 'sine', 350 * slow, 1100 * slow, 0.22 * e);
        if (Math.random() < 0.6) this.tone(t + 0.12 + Math.random() * 0.1, 0.06, 'sine', 600 * slow, 1500 * slow, 0.1 * e);
        break;
      }
      case 'slam': {
        if (!this._throttle('slam', 300)) return;
        const e = U.clamp(p.strength, 0.1, 1);
        this.noise(t, 0.9 / slow, 'lowpass', 2400 * slow, 200, 0.6, 0.5 * e, 0.01);
        this.tone(t, 0.5 / slow, 'sine', 70 * slow, 38, 0.4 * e);
        break;
      }
      case 'click': {
        this.tone(t, 0.05, 'sine', 1400, 900, 0.06);
        break;
      }
    }
  },
  setupLoops() {
    const c = this.ctx;
    // 造浪电机
    this.motor = c.createOscillator(); this.motor.type = 'sawtooth'; this.motor.frequency.value = 48;
    const mf = c.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 300;
    this.motorGain = c.createGain(); this.motorGain.gain.value = 0;
    this.motor.connect(mf); mf.connect(this.motorGain); this.motorGain.connect(this.master);
    this.motor.start();
    // 水体哗哗声
    const ns = c.createBufferSource(); ns.buffer = this.noiseBuf; ns.loop = true;
    this.washFilter = c.createBiquadFilter(); this.washFilter.type = 'bandpass'; this.washFilter.frequency.value = 700; this.washFilter.Q.value = 0.5;
    this.washGain = c.createGain(); this.washGain.gain.value = 0;
    ns.connect(this.washFilter); this.washFilter.connect(this.washGain); this.washGain.connect(this.master); this.washGain.connect(this.verb);
    ns.start();
    // 低频涌动
    const ns2 = c.createBufferSource(); ns2.buffer = this.noiseBuf; ns2.loop = true; ns2.playbackRate.value = 0.5;
    this.surgeFilter = c.createBiquadFilter(); this.surgeFilter.type = 'lowpass'; this.surgeFilter.frequency.value = 260;
    this.surgeGain = c.createGain(); this.surgeGain.gain.value = 0;
    ns2.connect(this.surgeFilter); this.surgeFilter.connect(this.surgeGain); this.surgeGain.connect(this.master);
    ns2.start();
  },
  // 连续声：paddleSpeed(m/s), foam(0..1), surge(0..1)
  setLoops(paddleSpeed, foam, surge, active) {
    if (!this.ctx || !this.motor) return;
    const t = this.ctx.currentTime;
    const on = active && this.enabled ? 1 : 0;
    this.motorGain.gain.setTargetAtTime(on * U.clamp(Math.abs(paddleSpeed) * 0.12 + (paddleSpeed !== 0 ? 0.02 : 0), 0, 0.14), t, 0.05);
    this.motor.frequency.setTargetAtTime(42 + Math.abs(paddleSpeed) * 40, t, 0.05);
    this.washGain.gain.setTargetAtTime(on * U.clamp(foam * 0.5, 0, 0.35), t, 0.08);
    this.washFilter.frequency.setTargetAtTime(500 + foam * 1500, t, 0.1);
    this.surgeGain.gain.setTargetAtTime(on * U.clamp(surge * 0.6, 0, 0.4), t, 0.1);
  },
};
