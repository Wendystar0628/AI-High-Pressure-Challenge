(function () {
  const App = (window.App = window.App || {});

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.compressor = null;
      this.noiseBuffer = null;
      this.enabled = true;
      this.mutedForExport = false;
      this.unlocked = false;

      this._waveGain = null;
      this._waveFilter = null;
      this._motorOsc = null;
      this._motorGain = null;

      this._lastJellyHitTime = 0;
      this._lastReboundTime = 0;
      this._lastCrackTime = 0;
      this._lastRigidTime = 0;
      this._lastSplashTime = 0;
      this._lastSlamTime = 0;
    }

    initFromGesture() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -14;
        this.compressor.knee.value = 18;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.16;

        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled && !this.mutedForExport ? 0.78 : 0.0;
        this.master.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        // Pre-build 2s white/pink noise buffer
        const sr = this.ctx.sampleRate;
        const len = sr * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
        const data = this.noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + w * 0.029;
          b1 = 0.985 * b1 + w * 0.032;
          b2 = 0.950 * b2 + w * 0.048;
          data[i] = (b0 + b1 + b2 + w * 0.18) * 0.9;
        }

        this._setupContinuousWaveLoop();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx && this.ctx.state === 'running') {
        this.unlocked = true;
      }
    }

    _setupContinuousWaveLoop() {
      if (!this.ctx || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.85;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.0;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();

      const motor = this.ctx.createOscillator();
      motor.type = 'triangle';
      motor.frequency.value = 58;
      const motorLP = this.ctx.createBiquadFilter();
      motorLP.type = 'lowpass';
      motorLP.frequency.value = 140;
      const motorGain = this.ctx.createGain();
      motorGain.gain.value = 0.0;

      motor.connect(motorLP);
      motorLP.connect(motorGain);
      motorGain.connect(this.master);
      motor.start();

      this._waveFilter = filter;
      this._waveGain = gain;
      this._motorOsc = motor;
      this._motorGain = motorGain;
    }

    setEnabled(flag) {
      this.enabled = !!flag;
      this._syncMasterGain();
    }

    setExportMute(flag) {
      this.mutedForExport = !!flag;
      this._syncMasterGain();
    }

    _syncMasterGain() {
      if (!this.ctx || !this.master) return;
      const target = this.enabled && !this.mutedForExport ? 0.78 : 0.0;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.025);
    }

    _ready() {
      if (!this.enabled || this.mutedForExport || !this.ctx) return false;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx.state === 'running';
    }

    playJellyImpact(speed, stiffnessNorm = 0.5, massKg = 2.0) {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      if (now - this._lastJellyHitTime < 0.045) return;
      this._lastJellyHitTime = now;

      const amp = Math.min(1.0, Math.max(0.06, (speed * 0.16) * Math.pow(massKg / 2.0, 0.35)));
      const baseFreq = 68 + stiffnessNorm * 72 - Math.min(24, massKg * 3.5);

      // 1. Wet viscoelastic body thud + FM wobble
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const g = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * 1.45, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(36, baseFreq * 0.72), now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.32);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(11 + stiffnessNorm * 16, now);
      lfoGain.gain.setValueAtTime(baseFreq * 0.22 * amp, now);
      lfoGain.gain.exponentialRampToValueAtTime(0.5, now + 0.42);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.48 * amp, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38 + (1 - stiffnessNorm) * 0.18);

      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + 0.6);
      lfo.stop(now + 0.6);

      // 2. Wet slap transient
      if (this.noiseBuffer) {
        const ns = this.ctx.createBufferSource();
        ns.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(650 + speed * 90, now);
        bp.Q.value = 2.2;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.24 * amp, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        ns.connect(bp);
        bp.connect(ng);
        ng.connect(this.master);
        ns.start(now, Math.random() * 0.8, 0.09);
      }
    }

    playJellyRebound(speed, stiffnessNorm = 0.5) {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      if (now - this._lastReboundTime < 0.12) return;
      this._lastReboundTime = now;

      const amp = Math.min(0.65, Math.max(0.05, speed * 0.14));
      const f0 = 78 + stiffnessNorm * 65;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f0 * 0.78, now);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.48, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.05, now + 0.28);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.28 * amp, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.32);
    }

    playJellyCrack(cleavedCount = 10) {
      if (!this._ready() || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      if (now - this._lastCrackTime < 0.07) return;
      this._lastCrackTime = now;

      const sev = Math.min(1.0, 0.28 + cleavedCount * 0.018);
      const bursts = Math.min(5, 2 + Math.floor(sev * 4));
      for (let k = 0; k < bursts; k++) {
        const t = now + k * (0.018 + Math.random() * 0.016);
        const ns = this.ctx.createBufferSource();
        ns.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(900 + Math.random() * 1100, t);
        bp.Q.value = 3.6;

        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.36 * sev, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
        ns.connect(bp);
        bp.connect(ng);
        ng.connect(this.master);
        ns.start(t, Math.random() * 1.1, 0.07);

        // Sticky pop sine drop
        const pop = this.ctx.createOscillator();
        const pg = this.ctx.createGain();
        pop.type = 'sine';
        pop.frequency.setValueAtTime(520 + Math.random() * 340, t);
        pop.frequency.exponentialRampToValueAtTime(110, t + 0.045);
        pg.gain.setValueAtTime(0.22 * sev, t);
        pg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        pop.connect(pg);
        pg.connect(this.master);
        pop.start(t);
        pop.stop(t + 0.055);
      }
    }

    playRigidCollision(relSpeed, kind = 'metal') {
      if (!this._ready()) return;
      if (relSpeed < 0.25) return;
      const now = this.ctx.currentTime;
      if (now - this._lastRigidTime < 0.032) return;
      this._lastRigidTime = now;

      const amp = Math.min(0.65, Math.max(0.03, (relSpeed - 0.2) * 0.16));
      const base = kind === 'glass' ? 1680 : kind === 'stone' ? 620 : 1080;
      const ratios = kind === 'stone' ? [1.0, 1.58] : [1.0, 2.31, 3.86];

      for (let i = 0; i < ratios.length; i++) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(base * ratios[i] * (0.97 + Math.random() * 0.06), now);
        const decay = kind === 'stone' ? 0.055 : kind === 'glass' ? 0.09 : 0.13;
        g.gain.setValueAtTime((0.25 * amp) / (i + 1), now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + decay / (1 + i * 0.4));
        osc.connect(g);
        g.connect(this.master);
        osc.start(now);
        osc.stop(now + decay + 0.02);
      }
    }

    playWaterSplash(entrySpeed, density = 1.0) {
      if (!this._ready()) return;
      if (entrySpeed < 0.35) return;
      const now = this.ctx.currentTime;
      if (now - this._lastSplashTime < 0.038) return;
      this._lastSplashTime = now;

      const massScale = Math.min(1.6, Math.max(0.45, Math.pow(density, 0.45)));
      const amp = Math.min(0.85, Math.max(0.05, entrySpeed * 0.13 * massScale));

      // Cavity Minnaert bubble bloop (pitch sweeps upward!)
      const bloop = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      const fStart = Math.max(120, 290 / massScale);
      bloop.type = 'sine';
      bloop.frequency.setValueAtTime(fStart, now);
      bloop.frequency.exponentialRampToValueAtTime(fStart * 2.35, now + 0.11);
      bg.gain.setValueAtTime(0.001, now);
      bg.gain.linearRampToValueAtTime(0.34 * amp, now + 0.012);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      bloop.connect(bg);
      bg.connect(this.master);
      bloop.start(now);
      bloop.stop(now + 0.16);

      // Splash spray hiss
      if (this.noiseBuffer) {
        const ns = this.ctx.createBufferSource();
        ns.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1100 + entrySpeed * 180, now);
        bp.frequency.exponentialRampToValueAtTime(520, now + 0.24);
        bp.Q.value = 1.1;

        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.001, now);
        ng.gain.linearRampToValueAtTime(0.32 * amp, now + 0.018);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        ns.connect(bp);
        bp.connect(ng);
        ng.connect(this.master);
        ns.start(now, Math.random() * 1.0, 0.30);
      }

      // Trailing secondary bubble pop for denser fast balls
      if (density > 0.85 && entrySpeed > 1.2) {
        const t2 = now + 0.09 + Math.random() * 0.06;
        const b2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        b2.type = 'sine';
        b2.frequency.setValueAtTime(420, t2);
        b2.frequency.exponentialRampToValueAtTime(880, t2 + 0.065);
        g2.gain.setValueAtTime(0.14 * amp, t2);
        g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.07);
        b2.connect(g2);
        g2.connect(this.master);
        b2.start(t2);
        b2.stop(t2 + 0.08);
      }
    }

    updateWaveAudio(activeSceneIsTank, paddleSpeed, foamIntensity, wallSlam) {
      if (!this.ctx || !this._waveGain || !this._motorGain) return;
      const now = this.ctx.currentTime;
      if (!activeSceneIsTank || !this.enabled || this.mutedForExport || this.ctx.state !== 'running') {
        this._waveGain.gain.setTargetAtTime(0.0, now, 0.06);
        this._motorGain.gain.setTargetAtTime(0.0, now, 0.06);
        return;
      }

      const surfLevel = Math.min(0.28, paddleSpeed * 0.06 + foamIntensity * 0.22);
      const filterFreq = 320 + foamIntensity * 1150 + paddleSpeed * 180;
      this._waveFilter.frequency.setTargetAtTime(filterFreq, now, 0.08);
      this._waveGain.gain.setTargetAtTime(surfLevel, now, 0.08);

      const mGain = Math.min(0.09, paddleSpeed * 0.055);
      this._motorOsc.frequency.setTargetAtTime(48 + paddleSpeed * 28, now, 0.06);
      this._motorGain.gain.setTargetAtTime(mGain, now, 0.06);

      if (wallSlam > 0.35 && now - this._lastSlamTime > 0.38 && this.noiseBuffer) {
        this._lastSlamTime = now;
        const amp = Math.min(0.55, wallSlam * 0.35);
        const ns = this.ctx.createBufferSource();
        ns.buffer = this.noiseBuffer;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(480, now);
        lp.frequency.exponentialRampToValueAtTime(160, now + 0.32);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(amp, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        ns.connect(lp);
        lp.connect(g);
        g.connect(this.master);
        ns.start(now, Math.random() * 0.7, 0.40);
      }
    }
  }

  App.SoundEngine = SoundEngine;
})();
