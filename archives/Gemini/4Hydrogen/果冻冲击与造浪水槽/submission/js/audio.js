// Procedural Web Audio synthesizer for Scene 1 (Jelly) and Scene 2 (Wave Tank)
window.AppAudio = (() => {
  'use strict';

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.unlocked = false;
      this.suppressed = false; // True during headless videoExport
      this.masterGain = null;
      this.noiseBuffer = null;

      // Continuous wave ambience nodes
      this.surfGain = null;
      this.surfFilter = null;
      this.surfStarted = false;

      // Rate-limiting timestamps
      this.lastImpactTime = 0;
      this.lastSplashTime = 0;
      this.lastClackTime = 0;
      this.lastCrackTime = 0;
      this.lastReboundTime = 0;
    }

    unlock() {
      if (this.suppressed) return;
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.enabled ? 0.65 : 0.0;
        this.masterGain.connect(this.ctx.destination);
        this.noiseBuffer = this._createNoiseBuffer(2.0);
        this._setupSurfLoop();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.unlocked = true;
    }

    setEnabled(val) {
      this.enabled = !!val;
      if (this.masterGain && this.ctx) {
        const target = this.enabled && !this.suppressed ? 0.65 : 0.0;
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
      }
      if (!this.enabled) this.updateSurf(0, 0);
    }

    setSuppressed(val) {
      this.suppressed = !!val;
      if (this.masterGain && this.ctx) {
        const target = this.enabled && !this.suppressed ? 0.65 : 0.0;
        this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
      }
      if (this.suppressed) this.updateSurf(0, 0);
    }

    _canPlay() {
      return this.enabled && !this.suppressed && this.ctx && this.ctx.state === 'running';
    }

    _createNoiseBuffer(seconds) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * seconds);
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.18) * 1.4;
      }
      return buf;
    }

    _setupSurfLoop() {
      if (!this.ctx || !this.noiseBuffer || this.surfStarted) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 340;
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.0;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start();

      this.surfFilter = filter;
      this.surfGain = gain;
      this.surfStarted = true;
    }

    // Jelly impact: elastic thump + wobble pitch dip
    playJellyImpact(intensity = 0.6, stiffnessNorm = 0.5) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastImpactTime < 0.06) return;
      this.lastImpactTime = now;

      const amp = Math.min(1.0, Math.max(0.08, intensity));
      const baseFreq = 52 + stiffnessNorm * 58;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * 1.6, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.52, now + 0.22);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(amp * 0.55, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.36);

      // Soft slap transient
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(520 + stiffnessNorm * 650, now);
      lpf.frequency.exponentialRampToValueAtTime(160, now + 0.14);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(amp * 0.25, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      nSrc.connect(lpf);
      lpf.connect(ng);
      ng.connect(this.masterGain);
      nSrc.start(now);
      nSrc.stop(now + 0.17);
    }

    // Elastic jelly rebound / ball pop-off
    playJellyRebound(intensity = 0.5, stiffnessNorm = 0.5) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastReboundTime < 0.12) return;
      this.lastReboundTime = now;

      const amp = Math.min(0.6, Math.max(0.05, intensity * 0.45));
      const f0 = 95 + stiffnessNorm * 75;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.85, now + 0.14);

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 500;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(amp, now + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.connect(lpf);
      lpf.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.21);
    }

    // Wet tearing & crisp snap for jelly fracture
    playJellyCrack(severity = 0.8) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastCrackTime < 0.07) return;
      this.lastCrackTime = now;

      const amp = Math.min(1.0, Math.max(0.2, severity));

      // Wet tear noise burst
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.frequency.exponentialRampToValueAtTime(480, now + 0.24);
      bp.Q.value = 1.6;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(amp * 0.6, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(now);
      src.stop(now + 0.28);

      // Sharp snap transient
      const snap = this.ctx.createOscillator();
      snap.type = 'sawtooth';
      snap.frequency.setValueAtTime(760, now);
      snap.frequency.exponentialRampToValueAtTime(140, now + 0.07);
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(amp * 0.28, now);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      snap.connect(sg);
      sg.connect(this.masterGain);
      snap.start(now);
      snap.stop(now + 0.09);
    }

    // Rigid sphere collision (metal clang / stone clack / underwater muffled clack)
    playSphereCollision(intensity = 0.5, material = 'metal', underwater = false) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastClackTime < 0.04) return;
      this.lastClackTime = now;

      const amp = Math.min(0.75, Math.max(0.04, intensity * 0.5));
      const base = material === 'metal' ? 620 : 390;
      const ratios = material === 'metal' ? [1.0, 2.38, 3.85] : [1.0, 1.72];
      const decay = underwater ? 0.08 : material === 'metal' ? 0.26 : 0.11;

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(amp, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + decay);

      if (underwater) {
        const lpf = this.ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 550;
        master.connect(lpf);
        lpf.connect(this.masterGain);
      } else {
        master.connect(this.masterGain);
      }

      for (let i = 0; i < ratios.length; i++) {
        const osc = this.ctx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(base * ratios[i] * (0.95 + Math.random() * 0.1), now);
        const og = this.ctx.createGain();
        og.gain.value = 1.0 / (i + 1);
        osc.connect(og);
        og.connect(master);
        osc.start(now);
        osc.stop(now + decay + 0.02);
      }
    }

    // Sphere water splash entry: bubble plop + spray burst
    playWaterSplash(intensity = 0.6) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastSplashTime < 0.045) return;
      this.lastSplashTime = now;

      const amp = Math.min(0.85, Math.max(0.08, intensity));

      // Upward bubble chirp
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const fStart = 120 + (1 - amp) * 90;
      osc.frequency.setValueAtTime(fStart, now);
      osc.frequency.exponentialRampToValueAtTime(fStart * 3.1, now + 0.11);
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(amp * 0.35, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(bg);
      bg.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);

      // Filtered water splash burst
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(750 + amp * 900, now);
      bp.frequency.exponentialRampToValueAtTime(340, now + 0.32);
      bp.Q.value = 0.85;

      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(amp * 0.48, now + 0.015);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.masterGain);
      src.start(now);
      src.stop(now + 0.36);
    }

    // Continuous surf & breaking wave wash modulated by wave energy & foam
    updateSurf(waveEnergy, foamIntensity) {
      if (!this.surfStarted || !this.ctx) return;
      const now = this.ctx.currentTime;
      if (!this._canPlay()) {
        this.surfGain.gain.setTargetAtTime(0.0, now, 0.06);
        return;
      }
      const level = Math.min(0.32, Math.max(0.0, waveEnergy * 0.16 + foamIntensity * 0.20));
      const freq = 260 + Math.min(1.0, waveEnergy + foamIntensity) * 780;
      this.surfGain.gain.setTargetAtTime(level, now, 0.08);
      this.surfFilter.frequency.setTargetAtTime(freq, now, 0.08);
    }
  }

  return new AudioEngine();
})();
