/**
 * Forge Studio — Procedural Web Audio Synthesizer & Sound Layer Engine (Section 2.15 & 4.1)
 * Built-in Instruments/Foley, Sample-Accurate Sync, Deterministic Waveform & VU Envelope Sampler
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, mulberry32 } = Forge.Math;
  const Anim = Forge.Anim;

  const SYNTH_PATCHES = [
    { id: 'anvil_strike', name: '铁砧重锤 (Anvil Strike)', desc: '金属泛音共振 + 锤击瞬态 + 低频重击' },
    { id: 'forge_drone',  name: '熔炉低鸣配乐 (Forge Pad)', desc: '双振荡器温暖和弦氛围铺底 + 滤波推进' },
    { id: 'brush_pluck',  name: '笔锋金石拨弦 (Ink & Chime)', desc: '清脆泛音拨弦 + 笔锋气声擦音' },
    { id: 'quench_sizzle', name: '火星爆裂与淬火 (Sparks & Quench)', desc: '带通滤波火星噼啪与冷却蒸汽声' },
    { id: 'taiko_drum',   name: '锻造律动重鼓 (War Drum)', desc: '低频膜鼓蓄势重音' }
  ];

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.noiseBuffer = null;
      this.unlocked = false;
      this.activeNodes = [];
      this.lastScheduledTime = -1;
      this.muted = false;
      this._setupUnlockListeners();
    }

    _setupUnlockListeners() {
      const unlock = () => {
        if (!this.unlocked) {
          this.ensureContext();
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }

    ensureContext() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.82;
        this.masterGain.connect(this.ctx.destination);
        this._buildNoiseBuffer();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.unlocked = this.ctx.state === 'running';
      return this.ctx;
    }

    _buildNoiseBuffer() {
      if (!this.ctx) return;
      const sr = this.ctx.sampleRate;
      const len = sr * 2;
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      const rng = mulberry32(987654);
      for (let i = 0; i < len; i++) {
        data[i] = rng() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }

    stopAll() {
      for (const n of this.activeNodes) {
        try { n.stop(); } catch (_) {}
        try { n.disconnect(); } catch (_) {}
      }
      this.activeNodes = [];
      this.lastScheduledTime = -1;
    }

    _trackNode(node) {
      this.activeNodes.push(node);
      node.onended = () => {
        const i = this.activeNodes.indexOf(node);
        if (i >= 0) this.activeNodes.splice(i, 1);
      };
    }

    triggerSynthEvent(patchId, params, ev, delaySec = 0) {
      if (this.muted) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;

      const t0 = ctx.currentTime + Math.max(0, delaySec);
      const vol = clamp((params.volume ?? 80) / 100, 0, 1.5) * clamp(ev.velocity ?? 0.9, 0.05, 1.5);
      if (vol <= 0.001) return;

      const pitchRatio = Math.pow(2, ((params.pitchShift ?? 0) + (ev.pitch ?? 0)) / 12);
      const decayScale = clamp(params.decay ?? 1.0, 0.15, 4.0);
      const tone = clamp((params.tone ?? 65) / 100, 0.05, 1.0);
      const dur = Math.max(0.08, (ev.duration ?? 0.6) * decayScale);

      if (patchId === 'anvil_strike') {
        // Metallic modal partials + low sub hammer thud + crisp metallic noise click
        const baseF = 390 * pitchRatio;
        const ratios = [1.0, 2.31, 3.86, 5.17];
        const weights = [0.55, 0.35, 0.24 * tone, 0.16 * tone];
        ratios.forEach((r, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = idx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(baseF * r, t0);
          osc.frequency.exponentialRampToValueAtTime(baseF * r * 0.985, t0 + dur);
          const d = dur * (1 / (1 + idx * 0.48));
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(vol * weights[idx], t0 + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
          osc.connect(g);
          g.connect(this.masterGain);
          osc.start(t0);
          osc.stop(t0 + d + 0.02);
          this._trackNode(osc);
        });

        // Sub thump
        const sub = ctx.createOscillator();
        const subG = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(145 * pitchRatio, t0);
        sub.frequency.exponentialRampToValueAtTime(42, t0 + 0.22);
        subG.gain.setValueAtTime(vol * 0.65, t0);
        subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
        sub.connect(subG);
        subG.connect(this.masterGain);
        sub.start(t0);
        sub.stop(t0 + 0.28);
        this._trackNode(sub);

        // Impact transient noise
        if (this.noiseBuffer) {
          const ns = ctx.createBufferSource();
          ns.buffer = this.noiseBuffer;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 2600 * (0.6 + tone);
          bp.Q.value = 2.2;
          const ng = ctx.createGain();
          ng.gain.setValueAtTime(vol * 0.45, t0);
          ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
          ns.connect(bp);
          bp.connect(ng);
          ng.connect(this.masterGain);
          ns.start(t0);
          ns.stop(t0 + 0.11);
          this._trackNode(ns);
        }
        return;
      }

      if (patchId === 'brush_pluck') {
        const baseF = 330 * pitchRatio;
        [1.0, 2.0, 3.01].forEach((r, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = idx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(baseF * r, t0);
          const d = dur * (idx === 0 ? 1.0 : 0.45);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(vol * (idx === 0 ? 0.34 : 0.12 * tone), t0 + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
          osc.connect(g);
          g.connect(this.masterGain);
          osc.start(t0);
          osc.stop(t0 + d + 0.02);
          this._trackNode(osc);
        });
        return;
      }

      if (patchId === 'taiko_drum') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(118 * pitchRatio, t0);
        osc.frequency.exponentialRampToValueAtTime(46 * pitchRatio, t0 + Math.min(0.35, dur));
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol * 0.62, t0 + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
        this._trackNode(osc);
        return;
      }

      if (patchId === 'quench_sizzle' && this.noiseBuffer) {
        const ns = ctx.createBufferSource();
        ns.buffer = this.noiseBuffer;
        ns.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.setValueAtTime(3400 * (0.5 + tone), t0);
        hp.frequency.exponentialRampToValueAtTime(1200, t0 + dur);
        hp.Q.value = 1.4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol * 0.32, t0 + Math.min(0.06, dur * 0.2));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        ns.connect(hp);
        hp.connect(g);
        g.connect(this.masterGain);
        ns.start(t0);
        ns.stop(t0 + dur + 0.03);
        this._trackNode(ns);
        return;
      }

      // Default: 'forge_drone' warm atmospheric chord pad
      const baseF = 110 * pitchRatio;
      [1.0, 1.498, 2.003].forEach((r, idx) => {
        const osc = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = idx === 1 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(baseF * r, t0);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(240 + 1400 * tone, t0);
        const atk = Math.min(0.45, dur * 0.3);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol * (idx === 1 ? 0.14 : 0.2), t0 + atk);
        g.gain.setValueAtTime(vol * (idx === 1 ? 0.14 : 0.2), Math.max(t0 + atk, t0 + dur - 0.35));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(lp);
        lp.connect(g);
        g.connect(this.masterGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
        this._trackNode(osc);
      });
    }

    // Called during interactive real-time playback ONLY (never in videoExport mode!)
    stepPlaybackWindow(comp, prevTime, currTime, project) {
      if (!comp || !comp.layers || this.muted) return;
      if (currTime < prevTime || currTime - prevTime > 0.35) {
        this.lastScheduledTime = currTime;
        return;
      }

      for (const layer of comp.layers) {
        if (layer.type !== 'audio' || layer.visible === false || layer.audioMuted) continue;
        const inPt = layer.inPoint ?? 0;
        const outPt = layer.outPoint ?? comp.duration;
        if (currTime < inPt || prevTime > outPt) continue;

        const ad = layer.audioData || {};
        const ctx = { project, comp, layer };
        const params = {
          volume: ad.volume ? Anim.evalProp(ad.volume, currTime, { ...ctx, propKey: 'audio.vol' }) : 80,
          pitchShift: ad.pitchShift ? Anim.evalProp(ad.pitchShift, currTime, { ...ctx, propKey: 'audio.pitch' }) : 0,
          tone: ad.tone ? Anim.evalProp(ad.tone, currTime, { ...ctx, propKey: 'audio.tone' }) : 65,
          decay: ad.decay ? Anim.evalProp(ad.decay, currTime, { ...ctx, propKey: 'audio.decay' }) : 1.0
        };

        for (const ev of (ad.events || [])) {
          if (ev.time >= prevTime && ev.time < currTime && ev.time >= inPt && ev.time <= outPt) {
            this.triggerSynthEvent(ad.patch || 'anvil_strike', params, ev, ev.time - prevTime);
          }
        }
      }
      this.lastScheduledTime = currTime;
    }

    // Pure deterministic visual amplitude readout at arbitrary timestamp `t` (for Timeline Waveform & VU Meter!)
    sampleVisualAudioLevel(comp, t, project) {
      if (!comp || !comp.layers) return { peakL: 0, peakR: 0, layerLevels: {} };
      let sumL = 0, sumR = 0;
      const layerLevels = {};

      for (const layer of comp.layers) {
        if (layer.type !== 'audio' || layer.visible === false || layer.audioMuted) {
          layerLevels[layer.id] = 0;
          continue;
        }
        const inPt = layer.inPoint ?? 0;
        const outPt = layer.outPoint ?? comp.duration;
        if (t < inPt || t > outPt) {
          layerLevels[layer.id] = 0;
          continue;
        }
        const ad = layer.audioData || {};
        const ctx = { project, comp, layer };
        const vol = clamp((ad.volume ? Anim.evalProp(ad.volume, t, { ...ctx, propKey: 'audio.vol' }) : 80) / 100, 0, 1.5);
        const decayScale = clamp(ad.decay ? Anim.evalProp(ad.decay, t, { ...ctx, propKey: 'audio.decay' }) : 1.0, 0.15, 4.0);
        const patch = ad.patch || 'anvil_strike';

        let lvl = 0;
        for (const ev of (ad.events || [])) {
          const dt = t - ev.time;
          const dur = Math.max(0.08, (ev.duration ?? 0.6) * decayScale);
          if (dt < 0 || dt > dur) continue;
          const vel = ev.velocity ?? 0.9;
          let env;
          if (patch === 'forge_drone') {
            const atk = Math.min(0.4, dur * 0.25);
            const rel = Math.min(0.35, dur * 0.25);
            if (dt < atk) env = dt / atk;
            else if (dt > dur - rel) env = (dur - dt) / rel;
            else env = 0.85 + 0.15 * Math.sin(dt * 9);
          } else {
            env = Math.exp((-dt * 4.2) / dur);
          }
          lvl = Math.max(lvl, env * vel * vol);
        }

        layerLevels[layer.id] = clamp(lvl, 0, 1);
        sumL += lvl * (0.9 + 0.1 * Math.sin(t * 17 + 1));
        sumR += lvl * (0.9 + 0.1 * Math.cos(t * 19 + 2));
      }

      return {
        peakL: clamp(sumL, 0, 1),
        peakR: clamp(sumR, 0, 1),
        layerLevels
      };
    }
  }

  Forge.Audio = {
    SYNTH_PATCHES,
    engine: new AudioEngine()
  };
})();
