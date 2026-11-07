/* =========================================================================
   动态路由塔防 · 程序化音频（WebAudio，无外部素材）
   ========================================================================= */
(function (global) {
  'use strict';
  const AUDIO = {
    ctx: null, master: null, music: null, sfxBus: null, noiseBuf: null,
    volume: 0.7, muted: false, started: false, mapId: null,
    timer: null, step: 0, nextNote: 0, bpm: 78, _musicNodes: [],
    init() {
      if (this.ctx) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.music = ctx.createGain(); this.music.gain.value = 0.4; this.music.connect(this.master);
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.85; this.sfxBus.connect(this.master);
      // noise buffer
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    },
    unlock() {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.started = true;
      if (this.mapId && !this.timer) this.startMusic(this.mapId);
    },
    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
    },
    tone(freq, dur, opts) {
      if (!this.ctx || !this.started || this.muted) return;
      opts = opts || {};
      const ctx = this.ctx, t = ctx.currentTime + (opts.delay || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
      const peak = (opts.gain == null ? 0.15 : opts.gain);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (opts.filter) {
        const f = ctx.createBiquadFilter();
        f.type = opts.filter; f.frequency.setValueAtTime(opts.freq || 900, t);
        if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + dur);
        node.connect(f); node = f;
      }
      node.connect(g); g.connect(opts.bus || this.sfxBus);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, opts) {
      if (!this.ctx || !this.started || this.muted) return;
      opts = opts || {};
      const ctx = this.ctx, t = ctx.currentTime + (opts.delay || 0);
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = opts.filter || 'bandpass';
      f.frequency.setValueAtTime(opts.freq || 1200, t);
      if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + dur);
      f.Q.value = opts.q == null ? 0.8 : opts.q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(opts.gain == null ? 0.18 : opts.gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(opts.bus || this.sfxBus);
      src.start(t); src.stop(t + dur + 0.02);
    },
    sfx(name) {
      if (!this.ctx || !this.started || this.muted) return;
      switch (name) {
        case 'ui': this.tone(640, 0.05, { type: 'square', gain: 0.035, freq: 2000, filter: 'highpass' }); break;
        case 'select': this.tone(520, 0.08, { type: 'triangle', gain: 0.06, slide: 1.2 }); break;
        case 'error': this.tone(180, 0.18, { type: 'sawtooth', gain: 0.09, slide: 0.7 }); this.tone(150, 0.2, { type: 'square', gain: 0.04, delay: 0.05, slide: 0.6 }); break;
        case 'build': this.tone(280, 0.16, { type: 'triangle', gain: 0.12, slide: 2.0 }); this.tone(840, 0.25, { type: 'sine', gain: 0.07, delay: 0.08, slide: 1.5 }); this.noise(0.3, { freq: 1800, gain: 0.06 }); break;
        case 'upgrade': [523, 659, 880, 1174].forEach((f, i) => this.tone(f, 0.28, { type: 'sine', gain: 0.075, delay: i * 0.07 })); break;
        case 'sell': this.tone(420, 0.2, { type: 'triangle', gain: 0.08, slide: 0.55 }); this.noise(0.2, { freq: 800, gain: 0.05 }); break;
        case 'route': this.tone(320, 0.5, { type: 'sine', gain: 0.08, slide: 2.4 }); this.tone(480, 0.4, { type: 'triangle', gain: 0.05, delay: 0.1, slide: 1.8 }); break;
        case 'firewall': this.noise(0.12, { freq: 1400, freqEnd: 400, gain: 0.12, q: 1.2 }); this.tone(160, 0.15, { type: 'square', gain: 0.07, slide: 0.6 }); break;
        case 'interceptor': this.tone(1200, 0.09, { type: 'sawtooth', gain: 0.055, slide: 0.4, filter: 'lowpass', freq: 4000 }); this.noise(0.1, { freq: 2600, gain: 0.05 }); break;
        case 'sandbox': this.tone(300, 0.4, { type: 'sine', gain: 0.06, slide: 3 }); this.noise(0.35, { freq: 900, gain: 0.06, filter: 'lowpass' }); break;
        case 'meleeHit': this.noise(0.08, { freq: 500, gain: 0.1, q: 1 }); this.tone(110, 0.09, { type: 'square', gain: 0.05 }); break;
        case 'rangedHit': this.tone(700, 0.12, { type: 'sawtooth', gain: 0.045, slide: 0.5 }); break;
        case 'kill': this.noise(0.22, { freq: 1200, freqEnd: 180, gain: 0.11 }); this.tone(220, 0.18, { type: 'triangle', gain: 0.06, slide: 0.4 }); break;
        case 'explosion': this.noise(0.5, { freq: 500, freqEnd: 60, gain: 0.25, filter: 'lowpass' }); this.tone(80, 0.4, { type: 'sine', gain: 0.18, slide: 0.5 }); break;
        case 'explosionBig': this.noise(1.1, { freq: 800, freqEnd: 40, gain: 0.35, filter: 'lowpass' }); this.tone(55, 0.9, { type: 'sine', gain: 0.26, slide: 0.4 }); this.tone(120, 0.6, { type: 'sawtooth', gain: 0.1, slide: 0.4 }); break;
        case 'slam': this.tone(65, 0.35, { type: 'sine', gain: 0.22, slide: 0.5 }); this.noise(0.25, { freq: 320, gain: 0.18, filter: 'lowpass' }); break;
        case 'encrypt': this.tone(880, 0.18, { type: 'square', gain: 0.06, slide: 0.5 }); this.tone(660, 0.25, { type: 'sawtooth', gain: 0.04, delay: 0.06, slide: 0.4 }); break;
        case 'reveal': this.tone(1200, 0.18, { type: 'sine', gain: 0.06, slide: 2.2 }); this.noise(0.15, { freq: 3200, gain: 0.04 }); break;
        case 'payload': this.noise(0.4, { freq: 900, freqEnd: 100, gain: 0.2 }); this.tone(140, 0.3, { type: 'sawtooth', gain: 0.09, slide: 0.5 }); break;
        case 'skill': [392, 523, 784].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', gain: 0.06, delay: i * 0.05, slide: 1.02 })); this.noise(0.5, { freq: 2000, freqEnd: 400, gain: 0.05 }); break;
        case 'item': this.tone(660, 0.3, { type: 'triangle', gain: 0.07, slide: 1.6 }); this.noise(0.4, { freq: 1500, freqEnd: 300, gain: 0.05 }); break;
        case 'heal': this.tone(523, 0.35, { type: 'sine', gain: 0.06, slide: 1.5 }); this.tone(784, 0.4, { type: 'sine', gain: 0.04, delay: 0.08 }); break;
        case 'leak': this.tone(95, 0.8, { type: 'sawtooth', gain: 0.16, slide: 0.6, filter: 'lowpass', freq: 600 }); this.noise(0.7, { freq: 200, gain: 0.2, filter: 'lowpass' }); break;
        case 'boss': this.tone(52, 2.2, { type: 'sawtooth', gain: 0.16, filter: 'lowpass', freq: 240 }); this.tone(78, 2.0, { type: 'sine', gain: 0.12, delay: 0.2 }); this.noise(1.6, { freq: 300, gain: 0.1, filter: 'lowpass' }); break;
        case 'bossDown': [220, 174, 130, 98].forEach((f, i) => this.tone(f, 1.2, { type: 'sawtooth', gain: 0.1, delay: i * 0.2, filter: 'lowpass', freq: 600 })); this.noise(1.5, { freq: 400, freqEnd: 40, gain: 0.22, filter: 'lowpass' }); break;
        case 'wave': this.tone(196, 0.5, { type: 'sawtooth', gain: 0.07, filter: 'lowpass', freq: 800 }); this.tone(294, 0.5, { type: 'sine', gain: 0.06, delay: 0.12 }); break;
        case 'defeat': [220, 165, 123, 82].forEach((f, i) => this.tone(f, 0.9, { type: 'sawtooth', gain: 0.09, delay: i * 0.18, filter: 'lowpass', freq: 500 })); this.noise(1.2, { freq: 300, freqEnd: 50, gain: 0.16, filter: 'lowpass' }); break;
        case 'alert': this.tone(880, 0.12, { type: 'square', gain: 0.05 }); this.tone(660, 0.12, { type: 'square', gain: 0.05, delay: 0.16 }); break;
      }
    },
    startMusic(mapId) {
      this.mapId = mapId;
      if (!this.ctx || !this.started) return;
      this.stopMusic();
      const settings = {
        segment: { root: 55, scale: [0, 3, 5, 7, 10], bpm: 76, chord: [0, 7, 10], bright: 0.5 },
        backbone: { root: 49, scale: [0, 2, 3, 7, 10], bpm: 88, chord: [0, 5, 9], bright: 0.7 },
        airgap: { root: 41.2, scale: [0, 1, 5, 7, 8], bpm: 64, chord: [0, 5, 7], bright: 0.4 }
      };
      const s = settings[mapId] || settings.segment;
      this._musicSettings = s;
      this.step = 0; this.nextNote = this.ctx.currentTime + 0.2;
      // drone pad
      const ctx = this.ctx;
      const pad = ctx.createGain(); pad.gain.value = 0.0001; pad.connect(this.music);
      pad.gain.setTargetAtTime(0.16, ctx.currentTime, 1.5);
      const filters = [];
      s.chord.forEach((semi, i) => {
        const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = s.root * Math.pow(2, semi / 12) * 2;
        o.detune.value = (i - 1) * 5;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320 + i * 60; f.Q.value = 1;
        const g = ctx.createGain(); g.gain.value = 0.14;
        o.connect(f); f.connect(g); g.connect(pad); o.start();
        filters.push({ f, base: 320 + i * 60 });
        this._musicNodes.push(o);
      });
      // slow LFO on filter
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
      const lg = ctx.createGain(); lg.gain.value = 180;
      const lfoTarget = ctx.createGain(); lfoTarget.gain.value = 0;
      lfo.connect(lg); lg.connect(lfoTarget);
      filters.forEach(x => lfoTarget.connect(x.f.frequency));
      lfo.start(); this._musicNodes.push(lfo, pad, lg, lfoTarget);
      this._pad = pad;
      // wind noise
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 300; nf.Q.value = 0.6;
      const ng = ctx.createGain(); ng.gain.value = 0.012;
      n.connect(nf); nf.connect(ng); ng.connect(this.music); n.start();
      this._musicNodes.push(n, ng);
      this.bpm = s.bpm;
      this.timer = setInterval(() => this.schedule(), 180);
      this.schedule();
    },
    stopMusic() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (this._pad) { try { this._pad.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3); } catch (e) {} }
      this._musicNodes.forEach(n => { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
      this._musicNodes = []; this._pad = null;
    },
    schedule() {
      if (!this.ctx || this.muted) return;
      const s = this._musicSettings; if (!s) return;
      const spb = 60 / this.bpm / 2;
      while (this.nextNote < this.ctx.currentTime + 0.5) {
        const st = this.step % 32;
        const t = this.nextNote;
        // arpeggio
        if (st % 2 === 0 || st % 8 === 3) {
          const deg = s.scale[(st * 3) % s.scale.length];
          const oct = st % 8 === 0 ? 2 : (st % 16 === 6 ? 4 : 2);
          const freq = s.root * Math.pow(2, deg / 12) * oct;
          this.musicNote(freq, t, spb * 1.8, 0.035 + (st % 8 === 0 ? 0.02 : 0));
        }
        if (st % 8 === 0) {
          this.musicNote(s.root * 2, t, spb * 4, 0.05, 'triangle');
        }
        if (st === 14 || st === 30) {
          this.musicNote(s.root * 4 * Math.pow(2, s.scale[2] / 12), t, spb * 2, 0.018, 'sine');
        }
        this.step++;
        this.nextNote += spb;
      }
    },
    musicNote(freq, t, dur, gain, type) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600 + Math.random() * 1200;
      o.connect(f); f.connect(g); g.connect(this.music);
      o.start(t); o.stop(t + dur + 0.05);
    }
  };
  global.AUDIO = AUDIO;
})(window);
