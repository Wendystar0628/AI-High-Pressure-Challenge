// Procedural WebAudio SFX — no external files (file:// safe)
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.waveNoise = null;
    this.waveGain = null;
    this._lastPlay = {};
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) {
      this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
    }
    if (!on) this.stopWaveNoise();
  }

  _now() { return this.ctx.currentTime; }

  _throttle(key, minInterval) {
    const t = performance.now();
    if (this._lastPlay[key] && t - this._lastPlay[key] < minInterval) return false;
    this._lastPlay[key] = t;
    return true;
  }

  // --- primitives ---
  _noiseBuffer(dur = 0.5) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _tone(freq, dur, type, gain, slideTo = null, slideTime = null) {
    const t = this._now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + (slideTime ?? dur));
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise(dur, filterFreq, gain, filterType = 'lowpass', sweepTo = null) {
    const t = this._now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.05);
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // --- events ---
  jellyImpact(speed = 3) {
    if (!this.enabled || !this.ensure() || !this._throttle('jImpact', 60)) return;
    const s = Math.min(3, Math.max(0.3, speed / 5));
    this._tone(90 * s + 55, 0.28, 'sine', 0.5 * s, 45, 0.24);
    this._noise(0.18, 900, 0.16 * s, 'lowpass', 180);
    this._tone(220, 0.12, 'triangle', 0.12 * s, 140, 0.1);
  }

  jellyWobble(intensity = 1) {
    if (!this.enabled || !this.ensure() || !this._throttle('jWobble', 150)) return;
    this._tone(160, 0.22, 'sine', 0.10 * intensity, 110, 0.2);
  }

  platformHit() {
    if (!this.enabled || !this.ensure() || !this._throttle('pHit', 80)) return;
    this._tone(70, 0.16, 'sine', 0.32, 50, 0.14);
    this._noise(0.1, 500, 0.12);
  }

  ballClack(speed = 1) {
    if (!this.enabled || !this.ensure() || !this._throttle('clack', 70)) return;
    const s = Math.min(1.6, Math.max(0.25, speed / 3));
    this._tone(720 + 380 * s, 0.09, 'triangle', 0.18 * s, 420, 0.08);
    this._noise(0.05, 2600, 0.10 * s, 'bandpass');
  }

  splash(speed = 2) {
    if (!this.enabled || !this.ensure() || !this._throttle('splash', 90)) return;
    const s = Math.min(2, Math.max(0.3, speed / 4));
    this._noise(0.32, 2400, 0.22 * s, 'lowpass', 400);
    this._tone(280, 0.18, 'sine', 0.12 * s, 120, 0.16);
    this._noise(0.5, 900, 0.07 * s, 'bandpass', 300);
  }

  bottomHit() {
    if (!this.enabled || !this.ensure() || !this._throttle('bHit', 100)) return;
    this._tone(95, 0.12, 'sine', 0.2, 60, 0.1);
    this._noise(0.07, 700, 0.08);
  }

  waveStart() {
    if (!this.enabled || !this.ensure()) return;
    this._tone(180, 0.4, 'sine', 0.12, 320, 0.35);
    this._noise(0.45, 600, 0.1, 'lowpass', 1400);
    this.startWaveNoise();
  }

  waveStop() {
    if (!this.enabled || !this.ensure()) return;
    this._tone(220, 0.35, 'sine', 0.1, 90, 0.3);
    this.stopWaveNoise();
  }

  startWaveNoise() {
    if (!this.ctx || this.waveNoise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2.5);
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 480;
    f.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    g.gain.setTargetAtTime(0.12, this._now(), 0.4);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.waveNoise = src;
    this.waveGain = g;
  }

  stopWaveNoise() {
    if (this.waveNoise) {
      try {
        this.waveGain.gain.setTargetAtTime(0.0001, this._now(), 0.25);
        this.waveNoise.stop(this._now() + 1.0);
      } catch (e) { /* ignore */ }
      this.waveNoise = null;
      this.waveGain = null;
    }
  }

  trigger() {
    if (!this.enabled || !this.ensure()) return;
    this._tone(140, 0.2, 'triangle', 0.16, 220, 0.16);
  }

  release() {
    if (!this.enabled || !this.ensure()) return;
    this._tone(240, 0.14, 'sine', 0.1, 180, 0.12);
  }
}
