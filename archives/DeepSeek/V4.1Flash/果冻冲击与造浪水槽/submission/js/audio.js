/* audio.js — procedural WebAudio sound design for impacts, cracks, splashes and waves */
(function () {
  'use strict';
  class AudioLab {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.master = null;
      this.noise = null;
      this.last = {};
      this.wave = null;
    }
    ensure() {
      if (!this.enabled) return false;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.65;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = buf;
        this.makeWaveBed();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    setEnabled(v) {
      this.enabled = v;
      if (this.master) this.master.gain.setTargetAtTime(v ? 0.65 : 0, this.ctx.currentTime, 0.05);
      if (v) this.ensure();
      return v;
    }
    play(name, strength = 0.5, pan = 0) {
      if (!this.enabled) return;
      if (!this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const key = name;
      if (this.last[key] && t - this.last[key] < 0.035) return;
      this.last[key] = t;
      const s = Math.max(0.02, Math.min(1, strength));
      const out = ctx.createGain();
      out.gain.value = 0.8;
      let p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p); p.connect(this.master); }
      else out.connect(this.master);
      if (name === 'jelly' || name === 'floor' || name === 'ball-floor') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        const f0 = name === 'jelly' ? 150 + s * 40 : name === 'ball-floor' ? 220 : 95;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(name === 'jelly' ? 58 : 42, t + 0.22);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5 * s + 0.05, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.34);
        const n = ctx.createBufferSource(), ng = ctx.createGain(), bp = ctx.createBiquadFilter();
        n.buffer = this.noise; bp.type = 'lowpass'; bp.frequency.value = 550;
        ng.gain.setValueAtTime(0.18 * s, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.18);
        if (name === 'jelly') {
          const b = ctx.createOscillator(), bg = ctx.createGain();
          b.type = 'sine';
          b.frequency.setValueAtTime(110, t + 0.02);
          b.frequency.linearRampToValueAtTime(165, t + 0.12);
          b.frequency.linearRampToValueAtTime(95, t + 0.35);
          bg.gain.setValueAtTime(0.0001, t + 0.02);
          bg.gain.exponentialRampToValueAtTime(0.16 * s + 0.02, t + 0.05);
          bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
          b.connect(bg); bg.connect(out); b.start(t + 0.02); b.stop(t + 0.48);
        }
      } else if (name === 'crack') {
        const n = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
        n.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
        g.gain.setValueAtTime(0.35 * s, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.24);
        for (let i = 0; i < 4; i++) {
          const o = ctx.createOscillator(), og = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = 900 + Math.random() * 2400;
          const tt = t + 0.01 + i * 0.026;
          og.gain.setValueAtTime(0.0001, tt);
          og.gain.exponentialRampToValueAtTime(0.06 * s, tt + 0.004);
          og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
          o.connect(og); og.connect(out); o.start(tt); o.stop(tt + 0.1);
        }
      } else if (name === 'click' || name === 'ball-ball') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(1200 + Math.random() * 900, t);
        o.frequency.exponentialRampToValueAtTime(700, t + 0.08);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.14 * s + 0.02, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.18);
      } else if (name === 'whoosh') {
        const n = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
        n.buffer = this.noise; bp.type = 'bandpass'; bp.Q.value = 1.1;
        bp.frequency.setValueAtTime(500, t);
        bp.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.06 * s, t + 0.16);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.52);
      } else if (name === 'splash') {
        const n = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
        n.buffer = this.noise;
        bp.type = 'bandpass'; bp.frequency.setValueAtTime(1800, t);
        bp.frequency.exponentialRampToValueAtTime(420, t + 0.5);
        bp.Q.value = 0.55;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.42 * s + 0.03, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.72);
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(420, t);
        o.frequency.exponentialRampToValueAtTime(95, t + 0.35);
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.18 * s, t + 0.02);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.42);
        for (let i = 0; i < 5; i++) {
          const b = ctx.createOscillator(), bg = ctx.createGain();
          const tt = t + 0.1 + Math.random() * 0.5;
          b.type = 'sine';
          b.frequency.setValueAtTime(700 + Math.random() * 900, tt);
          b.frequency.exponentialRampToValueAtTime(1300 + Math.random() * 700, tt + 0.06);
          bg.gain.setValueAtTime(0.0001, tt);
          bg.gain.exponentialRampToValueAtTime(0.025 * s, tt + 0.004);
          bg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
          b.connect(bg); bg.connect(out); b.start(tt); b.stop(tt + 0.08);
        }
      }
    }
    makeWaveBed() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 0.23; lfoG.gain.value = 120;
      lfo.connect(lfoG); lfoG.connect(lp.frequency);
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start(); lfo.start();
      this.wave = { gain: g, filter: lp, src };
    }
    setWave(active, intensity = 0) {
      if (!this.ctx || !this.wave) return;
      const t = this.ctx.currentTime;
      const target = this.enabled && active ? 0.04 + intensity * 0.12 : 0.0001;
      this.wave.gain.gain.setTargetAtTime(target, t, 0.35);
      this.wave.filter.frequency.setTargetAtTime(280 + intensity * 700, t, 0.4);
    }
    setSurge(intensity = 0) {
      if (!this.ctx || !this.wave) return;
      this.wave.gain.gain.setTargetAtTime(this.enabled ? 0.02 + intensity * 0.13 : 0.0001, this.ctx.currentTime, 0.08);
    }
  }
  window.AudioLab = AudioLab;
})();
