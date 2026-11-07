/* ============================================================
   声音引擎：全部由 WebAudio 实时合成，无外部音频文件
   ============================================================ */
(function () {
  'use strict';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = false;
      this.ready = false;
      this.lastAt = {};
      this.noiseBuf = null;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 22;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      this.master.connect(comp);
      comp.connect(ctx.destination);

      // 白噪声缓冲
      const len = ctx.sampleRate * 1.2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.ready = true;
      if (this.enabled) this._fade(0.55, 0.4);
    }

    setEnabled(on) {
      this.enabled = on;
      if (!this.ctx) {
        if (on) this.init();
        return;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._fade(on ? 0.55 : 0.0, 0.25);
    }

    _fade(v, t) {
      if (!this.master) return;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
      this.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), now + t);
    }

    _now() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    _gate(key, ms) {
      if (!this.enabled || !this.ready || !this.ctx) return false;
      const now = performance.now();
      if (this.lastAt[key] && now - this.lastAt[key] < ms) return false;
      this.lastAt[key] = now;
      return true;
    }

    _env(gain, t0, peak, attack, decay) {
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    }

    _noise(dur, filterType, freq, q, gainPeak, glideTo) {
      if (!this.noiseBuf) return;
      const c = this.ctx;
      const t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = filterType;
      f.frequency.setValueAtTime(freq, t);
      if (glideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), t + dur);
      f.Q.value = q;
      const g = c.createGain();
      this._env(g, t, gainPeak, 0.006, dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 0.2);
      src.stop(t + dur + 0.05);
    }

    _tone(freq, endFreq, dur, type, gainPeak, attack) {
      const c = this.ctx;
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
      const g = c.createGain();
      this._env(g, t, gainPeak, attack || 0.008, dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
      return o;
    }

    /* --------- 事件音色 --------- */

    impact(strength) {
      if (!this._gate('impact', 90)) return;
      const s = U.clamp(strength, 0.15, 1);
      this._tone(96 + 30 * s, 34, 0.42, 'sine', 0.5 * s, 0.004);
      this._tone(220, 70, 0.22, 'triangle', 0.08 * s, 0.002);
      this._noise(0.26, 'lowpass', 900 + 700 * s, 0.8, 0.26 * s, 180);
    }

    jelly(strength) {
      if (!this._gate('jelly', 130)) return;
      const s = U.clamp(strength, 0.1, 1);
      const c = this.ctx;
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(118 + 40 * s, t);
      o.frequency.linearRampToValueAtTime(210 + 80 * s, t + 0.11);
      o.frequency.exponentialRampToValueAtTime(96 + 20 * s, t + 0.8);
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 11;
      lg.gain.value = 16;
      lfo.connect(lg);
      lg.connect(o.frequency);
      const g = c.createGain();
      this._env(g, t, 0.11 * s, 0.03, 0.9);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 1.05);
      lfo.start(t); lfo.stop(t + 1.05);
    }

    ball(strength) {
      if (!this._gate('ball', 60)) return;
      const s = U.clamp(strength, 0.1, 1);
      this._tone(720 + 300 * s, 420, 0.09, 'triangle', 0.1 * s, 0.002);
      this._noise(0.06, 'highpass', 2600, 0.9, 0.08 * s, 1800);
    }

    entry(strength) {
      if (!this._gate('entry', 80)) return;
      const s = U.clamp(strength, 0.15, 1);
      this._noise(0.5, 'lowpass', 3200, 0.55, 0.3 * s, 240);
      this._tone(160, 58, 0.32, 'sine', 0.16 * s, 0.005);
      // 气泡
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (!this.enabled) return;
          this._tone(520 + Math.random() * 700, 1300 + Math.random() * 800, 0.07, 'sine', 0.032, 0.002);
        }, 60 + i * 55 + Math.random() * 40);
      }
    }

    splash(strength) {
      if (!this._gate('splash', 120)) return;
      const s = U.clamp(strength, 0.08, 1);
      this._noise(0.3, 'bandpass', 1500, 0.6, 0.11 * s, 700);
    }

    wave(on) {
      if (!this.ready) return;
      if (on) {
        this._noise(0.8, 'lowpass', 500, 0.8, 0.05, 220);
        this._tone(54, 43, 0.7, 'sine', 0.09, 0.08);
      } else {
        this._noise(1.2, 'lowpass', 700, 0.7, 0.05, 180);
        this._tone(70, 38, 0.9, 'sine', 0.07, 0.05);
      }
    }

    paddleTick() {
      if (!this._gate('paddle', 280)) return;
      this._tone(88 + Math.random() * 20, 62, 0.18, 'triangle', 0.04, 0.01);
      this._noise(0.12, 'lowpass', 340, 1.2, 0.035, 180);
    }

    ui() {
      if (!this._gate('ui', 50) || !this.enabled) return;
      this._tone(880, 1180, 0.05, 'sine', 0.028, 0.002);
    }
  }

  window.SoundEngine = SoundEngine;
})();
