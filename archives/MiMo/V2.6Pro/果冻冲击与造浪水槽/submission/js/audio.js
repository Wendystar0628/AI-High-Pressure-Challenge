// audio.js — WebAudio 合成音效（无外部音频文件）
(function (global) {
  'use strict';

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.master = null;
      this.unlocked = false;
      this._noiseBuf = null;
      this._waveNode = null;
      this._waveGain = null;
    }

    ensure() {
      if (this.ctx) return true;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this._noiseBuf = this._makeNoise(2);
      return true;
    }

    unlock() {
      if (!this.ensure()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = true;
    }

    setEnabled(on) {
      this.enabled = on;
      if (this.master) {
        this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.03);
      }
    }

    _makeNoise(seconds) {
      const len = Math.floor(this.ctx.sampleRate * seconds);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 22222;
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647;
        d[i] = (seed / 2147483647) * 2 - 1;
      }
      return buf;
    }

    _env(gain, t0, a, peak, d, sustain = 0) {
      const g = gain.gain;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(0.0001, t0);
      g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
      if (sustain > 0) {
        g.exponentialRampToValueAtTime(Math.max(sustain, 0.0002), t0 + a + d);
      } else {
        g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
      }
    }

    // 撞击：低频冲击 + 噪声瞬态
    impact(strength = 1) {
      if (!this.enabled || !this.ensure()) return;
      const t = this.ctx.currentTime;
      const s = M3 ? M3.clamp(strength, 0.15, 2.2) : strength;

      const o = this.ctx.createOscillator();
      o.type = 'sine';
      const og = this.ctx.createGain();
      o.frequency.setValueAtTime(120 * (1.1 - 0.25 * s), t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.16 + 0.08 * s);
      this._env(og, t, 0.004, 0.55 * s, 0.18 + 0.12 * s);
      o.connect(og).connect(this.master);
      o.start(t); o.stop(t + 0.55);

      const n = this.ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      const nf = this.ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.setValueAtTime(2200, t);
      nf.frequency.exponentialRampToValueAtTime(420, t + 0.14);
      const ng = this.ctx.createGain();
      this._env(ng, t, 0.003, 0.28 * s, 0.12 + 0.1 * s);
      n.connect(nf).connect(ng).connect(this.master);
      n.start(t); n.stop(t + 0.4);
    }

    // 回弹：短促中频弹跳
    bounce(strength = 1) {
      if (!this.enabled || !this.ensure()) return;
      const t = this.ctx.currentTime;
      const s = M3 ? M3.clamp(strength, 0.15, 1.6) : strength;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(280 + 120 * s, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.12);
      this._env(g, t, 0.003, 0.22 * s, 0.13);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.3);
    }

    // 开裂：噪声撕裂 + 细碎噼啪
    crack() {
      if (!this.enabled || !this.ensure()) return;
      const t = this.ctx.currentTime;
      const n = this.ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(1800, t);
      f.frequency.exponentialRampToValueAtTime(620, t + 0.28);
      f.Q.value = 1.4;
      const g = this.ctx.createGain();
      this._env(g, t, 0.004, 0.42, 0.3);
      n.connect(f).connect(g).connect(this.master);
      n.start(t); n.stop(t + 0.45);

      for (let i = 0; i < 7; i++) {
        const tt = t + 0.02 + i * 0.035 + Math.random() * 0.02;
        const o = this.ctx.createOscillator();
        o.type = 'square';
        const og = this.ctx.createGain();
        o.frequency.setValueAtTime(900 + Math.random() * 2400, tt);
        this._env(og, tt, 0.001, 0.06, 0.03);
        o.connect(og).connect(this.master);
        o.start(tt); o.stop(tt + 0.06);
      }
    }

    // 球体碰撞：清脆金属/石质叩击
    ballHit(kind = 0) {
      if (!this.enabled || !this.ensure()) return;
      const t = this.ctx.currentTime;
      const base = kind > 0 ? 520 : 760;
      const o = this.ctx.createOscillator();
      o.type = kind > 0 ? 'triangle' : 'sine';
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.08);
      this._env(g, t, 0.002, 0.2, 0.09);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.18);

      const n = this.ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      const nf = this.ctx.createBiquadFilter();
      nf.type = 'highpass';
      nf.frequency.value = 1800;
      const ng = this.ctx.createGain();
      this._env(ng, t, 0.001, 0.1, 0.05);
      n.connect(nf).connect(ng).connect(this.master);
      n.start(t); n.stop(t + 0.12);
    }

    // 入水：噪声下扫 + 气泡感
    splash(strength = 1) {
      if (!this.enabled || !this.ensure()) return;
      const t = this.ctx.currentTime;
      const s = M3 ? M3.clamp(strength, 0.2, 2) : strength;

      const n = this.ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 0.9;
      f.frequency.setValueAtTime(2600, t);
      f.frequency.exponentialRampToValueAtTime(420, t + 0.32 + 0.15 * s);
      const g = this.ctx.createGain();
      this._env(g, t, 0.006, 0.4 * s, 0.32 + 0.18 * s);
      n.connect(f).connect(g).connect(this.master);
      n.start(t); n.stop(t + 0.9);

      // 水滴回响
      for (let i = 0; i < 5; i++) {
        const tt = t + 0.12 + i * 0.07 + Math.random() * 0.05;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        const og = this.ctx.createGain();
        const f0 = 900 + Math.random() * 1600;
        o.frequency.setValueAtTime(f0, tt);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.7, tt + 0.05);
        this._env(og, tt, 0.002, 0.07 * s, 0.06);
        o.connect(og).connect(this.master);
        o.start(tt); o.stop(tt + 0.12);
      }
    }

    // 浪噪声循环（造浪时用）
    startWaveLoop(level = 0.35) {
      if (!this.enabled || !this.ensure()) return;
      this.stopWaveLoop();
      const t = this.ctx.currentTime;
      const n = this.ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      n.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16 * level, t + 0.6);
      n.connect(f).connect(g).connect(this.master);
      n.start(t);
      this._waveNode = n;
      this._waveGain = g;
      this._waveFilter = f;
    }

    setWaveLevel(level) {
      if (!this._waveGain || !this.ctx) return;
      const t = this.ctx.currentTime;
      this._waveGain.gain.setTargetAtTime(0.16 * M3.clamp(level, 0, 1.4), t, 0.25);
      if (this._waveFilter) this._waveFilter.frequency.setTargetAtTime(420 + 900 * level, t, 0.3);
    }

    stopWaveLoop() {
      if (this._waveNode) {
        try {
          const t = this.ctx.currentTime;
          this._waveGain.gain.cancelScheduledValues(t);
          this._waveGain.gain.setValueAtTime(this._waveGain.gain.value, t);
          this._waveGain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
          this._waveNode.stop(t + 0.5);
        } catch (e) { /* ignore */ }
        this._waveNode = null;
        this._waveGain = null;
        this._waveFilter = null;
      }
    }

    // 果冻晃动：轻微湿润颤动
    jellyWobble(intensity = 1) {
      if (!this.enabled || !this.ensure()) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      const g = this.ctx.createGain();
      const f0 = 160 + Math.random() * 60;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * 0.72, t + 0.22);
      this._env(g, t, 0.01, 0.06 * intensity, 0.22);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.35);
    }
  }

  global.AudioEngine = AudioEngine;
})(window);
