'use strict';
// ============ 音色图层：内置合成器（WebAudio） ============
const Synth = {
  PRESETS: {
    hammer: { label: '锻锤重击', decay: 1.6, kind: 'hit' },
    anvil: { label: '铁砧鸣响', decay: 3.5, kind: 'hit' },
    drum: { label: '低频大鼓', decay: 1.2, kind: 'hit' },
    drone: { label: '炉火低鸣（持续）', decay: 1, kind: 'pad' },
    spark: { label: '火星噼啪', decay: 0.8, kind: 'texture' },
    bell: { label: '清钟（书写）', decay: 2.4, kind: 'hit' },
    pluck: { label: '拨弦', decay: 1.4, kind: 'hit' },
    hiss: { label: '淬火嘶声', decay: 1, kind: 'texture' },
    whoosh: { label: '挥动风声', decay: 0.6, kind: 'texture' },
  },
  ctx: null, master: null, session: null, unlocked: false,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      this.out = this.ctx.createDynamicsCompressor(); this.out.threshold.value = -10; this.out.ratio.value = 4; this.out.connect(this.ctx.destination);
      // 混响（程序生成脉冲响应）
      const len = this.ctx.sampleRate * 2.2; const ir = this.ctx.createBuffer(2, len, this.ctx.sampleRate); const r = U.rng(99);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      this.verb = this.ctx.createConvolver(); this.verb.buffer = ir; this.verbGain = this.ctx.createGain(); this.verbGain.gain.value = 0.22; this.verb.connect(this.verbGain); this.verbGain.connect(this.out);
      const nl = this.ctx.sampleRate * 2; this.noise = this.ctx.createBuffer(1, nl, this.ctx.sampleRate); const nd = this.noise.getChannelData(0); const r2 = U.rng(7); for (let i = 0; i < nl; i++) nd[i] = r2() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  unlock() { if (!this.unlocked) { this.unlocked = true; this.ensure(); } },
  // ---- 播放会话 ----
  start(comp, from, endT) {
    if (!this.unlocked) return; const ctx = this.ensure(); if (!ctx) return;
    this.stop();
    const g = ctx.createGain(); g.gain.value = 0.9; g.connect(this.out); g.connect(this.verb);
    const s = { g, t0: ctx.currentTime + 0.06, from, comp };
    this.session = s;
    for (const L of comp.layers) {
      if (L.type !== 'synth' || !L.visible) continue;
      if (comp.layers.some(l => l.solo) && !L.solo) continue;
      for (const nt of L.synth.notes) {
        const T = L.startTime + nt.t; if (T < L.inPoint || T >= L.outPoint) continue;
        const d = nt.d || 0.5;
        if (T + d < from || T >= endT) continue;
        const when = s.t0 + (T - from); const off = Math.max(0, from - T);
        this.note(L, comp, nt, when + off, off, g, Math.min(d - off, endT - Math.max(T, from)));
      }
    }
    return s;
  },
  stop() { if (this.session) { const g = this.session.g; try { g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015); setTimeout(() => g.disconnect(), 200); } catch (e) { } this.session = null; } },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  params(L, comp, T) { const e = p => Anim.evalProp(p, comp, L, T); return { vol: Math.pow(10, e(L.synth.vol) / 20), pitch: e(L.synth.pitch), decay: Math.max(0.05, e(L.synth.decay)), bright: e(L.synth.bright) / 100 }; },
  note(L, comp, nt, when, off, dest, dur) {
    const ctx = this.ctx; const T = L.startTime + nt.t; const P = this.params(L, comp, T);
    const v = (nt.v ?? 1) * P.vol; const f0 = 440 * Math.pow(2, (nt.n - 69 + P.pitch) / 12);
    const out = ctx.createGain(); out.gain.value = v; out.connect(dest);
    const env = (node, a, peak, dec, t = when) => { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.setTargetAtTime(0, t + a, dec / 3); };
    const osc = (type, f, g) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const gg = ctx.createGain(); o.connect(gg); return { o, g: gg }; };
    const noise = (t = when) => { const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = (nt.t * 0.37) % 1.5; return s; };
    const stopAt = when + Math.max(0.1, (dur || 1)) + P.decay * 4 + 0.2;
    if (off > 0.05 && L.synth.preset !== 'drone') return; // 播放头已越过的短音不再触发
    switch (L.synth.preset) {
      case 'hammer': case 'drum': case 'anvil': {
        const isH = L.synth.preset === 'hammer', isA = L.synth.preset === 'anvil';
        if (!isA) { // 低频冲击
          const b = osc('sine', f0 * (isH ? 1 : 0.8), 1); b.o.frequency.setValueAtTime(f0 * 3.2, when); b.o.frequency.exponentialRampToValueAtTime(f0 * 0.9, when + 0.12);
          env(b.g, 0.003, 1.0, 0.45 * P.decay); b.g.connect(out); b.o.start(when); b.o.stop(stopAt);
          const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + P.bright * 2500; bp.Q.value = 0.8; const ng = ctx.createGain(); env(ng, 0.001, isH ? 0.9 : 0.4, 0.06); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(when); n.stop(when + 0.4);
        }
        if (isH || isA) { // 金属泛音
          const ratios = [1, 2.76, 5.4, 8.93, 13.34]; const base = isA ? f0 : f0 * 4.1;
          ratios.forEach((r, i) => { const m = osc('sine', base * r, 1); env(m.g, 0.002, (isA ? 0.35 : 0.16) / (i + 1) * (0.6 + P.bright), (isA ? 3.2 : 1.4) * P.decay / (1 + i * 0.5)); m.g.connect(out); m.o.start(when); m.o.stop(stopAt); });
        }
        break;
      }
      case 'bell': {
        const car = osc('sine', f0, 1), mod = ctx.createOscillator(); mod.frequency.value = f0 * 3.5; const mg = ctx.createGain(); mg.gain.setValueAtTime(f0 * 2.4 * (0.4 + P.bright), when); mg.gain.exponentialRampToValueAtTime(1, when + 1.5 * P.decay); mod.connect(mg); mg.connect(car.o.frequency);
        env(car.g, 0.004, 0.5, 2.2 * P.decay); car.g.connect(out); car.o.start(when); mod.start(when); car.o.stop(stopAt); mod.stop(stopAt); break;
      }
      case 'pluck': {
        const s = osc('sawtooth', f0, 1); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(800 + P.bright * 5000, when); lp.frequency.exponentialRampToValueAtTime(300, when + 0.6 * P.decay); s.o.disconnect(); s.o.connect(lp); lp.connect(s.g);
        env(s.g, 0.003, 0.4, 1.1 * P.decay); s.g.connect(out); s.o.start(when); s.o.stop(stopAt); break;
      }
      case 'drone': {
        const d = Math.max(0.2, dur || nt.d || 2);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.32, when + Math.min(1.5, d * 0.3)); g.gain.setValueAtTime(0.32, when + d * 0.75); g.gain.linearRampToValueAtTime(0, when + d);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220 + P.bright * 1400; lp.Q.value = 2; lp.connect(g); g.connect(out);
        for (const det of [-7, 0, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0; o.detune.value = det; o.connect(lp); o.start(when); o.stop(when + d + 0.1); }
        const sub = ctx.createOscillator(); sub.frequency.value = f0 / 2; const sg = ctx.createGain(); sg.gain.value = 0.6; sub.connect(sg); sg.connect(g); sub.start(when); sub.stop(when + d + 0.1);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18; const lg = ctx.createGain(); lg.gain.value = 120 + P.bright * 300; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(when); lfo.stop(when + d + 0.1);
        break;
      }
      case 'spark': case 'hiss': case 'whoosh': {
        const d = Math.max(0.1, dur || nt.d || 0.6); const n = noise(); const f = ctx.createBiquadFilter();
        const g = ctx.createGain(); n.connect(f); f.connect(g); g.connect(out);
        if (L.synth.preset === 'spark') {
          f.type = 'highpass'; f.frequency.value = 2500 + P.bright * 4000; g.gain.setValueAtTime(0, when);
          const r = U.rng(Math.round(nt.t * 1000) + 3); const N = Math.round(d * 38);
          for (let i = 0; i < N; i++) { const tt = when + r() * d * (0.4 + 0.6 * (i / N)); const a = (1 - (tt - when) / d) * (0.3 + r() * 0.7) * 0.7; g.gain.setValueAtTime(a, tt); g.gain.setTargetAtTime(0, tt + 0.002, 0.008); }
        } else if (L.synth.preset === 'hiss') {
          f.type = 'highpass'; f.frequency.value = 1500 + P.bright * 3000; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.35, when + 0.08); g.gain.setTargetAtTime(0, when + 0.1, d * P.decay / 2.5);
        } else {
          f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(300, when); f.frequency.exponentialRampToValueAtTime(1800 + P.bright * 2000, when + d * 0.8); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.5, when + d * 0.85); g.gain.linearRampToValueAtTime(0, when + d);
        }
        n.start(when); n.stop(when + d * Math.max(1, P.decay) + 0.5); break;
      }
    }
  },
  // ---- 解析包络（用于界面电平、波形与导出取样） ----
  envAt(L, comp, t) {
    if (!L.visible) return 0; let s = 0; const pr = this.PRESETS[L.synth.preset] || {}; const P = { vol: Math.pow(10, Anim.evalProp(L.synth.vol, comp, L, t) / 20), decay: Math.max(0.05, Anim.evalProp(L.synth.decay, comp, L, t)) };
    for (const nt of L.synth.notes) {
      const T = L.startTime + nt.t; if (t < T || T < L.inPoint || T >= L.outPoint) continue; const dt = t - T; const v = (nt.v ?? 1) * P.vol;
      if (pr.kind === 'pad') { const d = nt.d || 2; if (dt > d) continue; s += v * 0.45 * Math.min(1, dt / Math.min(1.5, d * 0.3)) * (dt > d * 0.75 ? 1 - (dt - d * 0.75) / (d * 0.25) : 1); }
      else if (pr.kind === 'texture') { const d = nt.d || 0.6; if (dt > d * 1.5) continue; s += v * 0.5 * (1 - dt / (d * 1.5)) * (0.6 + 0.4 * Math.abs(Noise.n3(t * 40, nt.t, 0.3)) * 2); }
      else { const dec = (pr.decay || 1) * P.decay; if (dt > dec * 4) continue; s += v * Math.exp(-dt / (dec * 0.35)); }
    }
    return Math.min(1.5, s);
  },
  levelAt(comp, t) { let s = 0; for (const L of comp.layers) if (L.type === 'synth') s += this.envAt(L, comp, t); return Math.min(1, s); },
};
