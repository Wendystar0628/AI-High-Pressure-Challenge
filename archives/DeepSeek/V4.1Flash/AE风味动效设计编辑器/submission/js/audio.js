/* ============================================================
   audio.js — 内置音色合成与声画同步（无外部音频资源）
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const S = AE.audio = {};

  let actx = null, master = null, comp = null, noiseBuf = null, reverb = null, wet = null, dry = null;
  let active = [];
  let enabled = true;

  S.isReady = () => !!actx;
  S.setEnabled = (v) => { enabled = !!v; if (master) master.gain.value = v ? 0.6 : 0; };
  S.toggle = () => { S.setEnabled(!enabled); return enabled; };

  function ensure() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return true; }
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = enabled ? 0.6 : 0;
      const compr = actx.createDynamicsCompressor();
      compr.threshold.value = -18; compr.knee.value = 24; compr.ratio.value = 4;
      compr.attack.value = 0.003; compr.release.value = 0.25;
      master.connect(compr); compr.connect(actx.destination);
      // 噪声
      noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < d.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        d[i] = (seed / 4294967296) * 2 - 1;
      }
      // 锻造厅混响
      const len = Math.floor(actx.sampleRate * 1.7);
      const ir = actx.createBuffer(2, len, actx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const id = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const tt = i / len;
          id[i] = (Math.random() * 2 - 1) * Math.pow(1 - tt, 2.4) * 0.55;
        }
      }
      reverb = actx.createConvolver(); reverb.buffer = ir;
      wet = actx.createGain(); wet.gain.value = 0.32;
      dry = actx.createGain(); dry.gain.value = 0.8;
      dry.connect(master);
      wet.connect(reverb); reverb.connect(master);
      return true;
    } catch (e) { console.warn('音频初始化失败', e); return false; }
  }
  S.ensure = ensure;
  S.ctx = () => actx;

  function now() { return actx ? actx.currentTime : 0; }

  function connectNode(node, gainVal, pan) {
    const g = actx.createGain();
    g.gain.value = gainVal === undefined ? 0.3 : gainVal;
    let out = g;
    if (pan && actx.createStereoPanner) {
      const p = actx.createStereoPanner();
      p.pan.value = U.clamp(pan, -1, 1);
      g.connect(p); out = p;
    }
    out.connect(dry);
    out.connect(wet);
    if (node) node.connect(g);
    return g;
  }

  function noiseSrc() {
    const src = actx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  function track(nodes) { active.push(...nodes); }

  // ---------------- 音色 ----------------
  function impact(when, gain, pitch, metal) {
    const t = when;
    const out = actx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(Math.max(0.02, gain), t + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    out.connect(dry); out.connect(wet);
    // 低频锤心
    const osc = actx.createOscillator();
    osc.type = 'sine';
    const base = 55 * Math.pow(2, pitch / 1200);
    osc.frequency.setValueAtTime(base * 1.8, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.6, t + 0.4);
    const og = actx.createGain();
    og.gain.setValueAtTime(0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(og); og.connect(out);
    osc.start(t); osc.stop(t + 1.5);
    // 击打噪声
    const ns = noiseSrc();
    const nf = actx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 1500 * Math.pow(2, pitch / 2400); nf.Q.value = 0.8;
    const ng = actx.createGain();
    ng.gain.setValueAtTime(0.8, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    ns.connect(nf); nf.connect(ng); ng.connect(out);
    ns.start(t); ns.stop(t + 0.2);
    // 金属泛音
    const partials = [2.42, 3.91, 5.83, 8.4, 11.7];
    for (let i = 0; i < partials.length; i++) {
      const f = base * partials[i] * (1 + (pitch % 100) * 0.0004);
      const o = actx.createOscillator();
      o.type = i < 2 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(f, t);
      const g = actx.createGain();
      const amp = (0.25 / (i + 1)) * (metal === undefined ? 1 : metal);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, amp), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7 + i * 0.22);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 1.6);
    }
    track([osc, ns]);
  }

  function spark(when, gain, pitch) {
    const t = when;
    const dur = 0.045 + Math.random() * 0.07;
    const ns = noiseSrc();
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500 + Math.random() * 5000;
    bp.Q.value = 3.2;
    const g = actx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    ns.connect(bp); bp.connect(g);
    const st = actx.createStereoPanner();
    st.pan.value = (Math.random() * 2 - 1) * .8;
    g.connect(st); st.connect(dry); st.connect(wet);
    ns.start(t); ns.stop(t + dur + 0.02);
    track([ns]);
  }

  function chime(when, gain, pitch) {
    const base = 220 * Math.pow(2, pitch / 1200);
    const out = actx.createGain();
    out.gain.value = gain;
    out.connect(dry); out.connect(wet);
    const parts = [1, 2.01, 3.03, 4.21, 5.4];
    for (let i = 0; i < parts.length; i++) {
      const o = actx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * parts[i];
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime((0.22 / (i + 1)) * gain, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 1.8 + i * .4);
      o.connect(g); g.connect(out);
      o.start(when); o.stop(when + 3.2);
      track([o]);
    }
  }

  function whoosh(when, gain, pitch) {
    const t = when;
    const ns = noiseSrc();
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(220, t);
    bp.frequency.exponentialRampToValueAtTime(2600 * Math.pow(2, pitch / 1200), t + 0.5);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    ns.connect(bp); bp.connect(g); g.connect(dry); g.connect(wet);
    ns.start(t); ns.stop(t + 0.8);
    track([ns]);
  }

  function drone(when, gain, pitch, duration, startOffset) {
    const base = 55 * Math.pow(2, pitch / 1200);
    const out = actx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.exponentialRampToValueAtTime(Math.max(0.008, gain), when + 1.6);
    out.gain.setValueAtTime(Math.max(0.008, gain), when + Math.max(1.7, duration - 1.2));
    out.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = .6;
    lp.connect(out); out.connect(dry); out.connect(wet);
    const freqs = [base, base * 1.5, base * 2.005, base * 2.66];
    const nodes = [];
    for (let i = 0; i < freqs.length; i++) {
      const o = actx.createOscillator();
      o.type = i === 0 ? 'sawtooth' : 'sine';
      o.frequency.value = freqs[i] * (1 + (i - 1.5) * 0.0015);
      const g = actx.createGain(); g.gain.value = 0.16 / (i + 1);
      o.connect(g); g.connect(lp);
      o.start(when); o.stop(when + duration + 0.1);
      nodes.push(o);
    }
    // 缓慢呼吸
    const lfo = actx.createOscillator(); lfo.frequency.value = 0.12;
    const lg = actx.createGain(); lg.gain.value = 90;
    lfo.connect(lg); lg.connect(lp.frequency);
    lfo.start(when); lfo.stop(when + duration);
    nodes.push(lfo);
    track(nodes);
  }

  function lowPulse(when, gain, pitch) {
    const o = actx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(48 * Math.pow(2, pitch / 1200), when);
    o.frequency.exponentialRampToValueAtTime(32, when + 0.35);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.55);
    o.connect(g); g.connect(dry); g.connect(wet);
    o.start(when); o.stop(when + 0.6);
    track([o]);
  }

  function pad(when, gain, freq, duration) {
    const out = actx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.exponentialRampToValueAtTime(Math.max(0.003, gain), when + 0.9);
    out.gain.setValueAtTime(Math.max(0.003, gain), when + Math.max(1, duration - 0.8));
    out.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = .4;
    out.connect(dry); out.connect(wet);
    lp.connect(out);
    const ratios = [1, 1.5, 2, 2.997, 4.5];
    const nodes = [];
    for (let i = 0; i < ratios.length; i++) {
      const o = actx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = freq * ratios[i];
      o.detune.value = (i - 2) * 4;
      const g = actx.createGain(); g.gain.value = 0.11 / (i * .7 + 1);
      o.connect(g); g.connect(lp);
      o.start(when); o.stop(when + duration + 0.1);
      nodes.push(o);
    }
    track(nodes);
  }

  // ---------------- 图层调度 ----------------
  function sampleSound(layer, time, prop) {
    if (!prop) return undefined;
    const ctx = A.newCtx(comp, layer, time);
    return A.sample(prop, time, layer, ctx);
  }

  function scheduleLayer(layer, fromTime, latency) {
    const snd = layer.sound;
    if (!snd || layer.enabled === false) return;
    const inP = layer.inPoint === undefined ? 0 : layer.inPoint;
    const outP = layer.outPoint === undefined ? comp.duration : layer.outPoint;
    if (outP <= fromTime && snd.type !== 'drone' && snd.type !== 'score') return;
    const gainPct = snd.gain ? A.n(sampleSound(layer, Math.max(inP, fromTime), snd.gain)) / 100 : 0.6;
    const pitch = snd.pitch ? A.n(sampleSound(layer, Math.max(inP, fromTime), snd.pitch)) : 0;
    const base = now() + latency;
    const off = (t) => base + Math.max(0, t - fromTime);
    if (snd.type === 'impact' || snd.type === 'chime' || snd.type === 'whoosh') {
      const repeat = snd.repeat ? A.n(sampleSound(layer, Math.max(inP, fromTime), snd.repeat)) : 0;
      const startT = Math.max(inP, fromTime);
      let times = [];
      if (inP >= fromTime && inP <= outP) times.push(inP);
      if (repeat > 0.01) {
        for (let tt = Math.max(inP, fromTime) + (inP >= fromTime ? repeat : ((fromTime - inP) % repeat === 0 ? 0 : repeat - ((fromTime - inP) % repeat))) ; tt < outP; tt += repeat) {
          if (tt > fromTime + 1e-3) times.push(tt);
        }
      }
      for (const tt of times.slice(0, 200)) {
        if (tt < fromTime - 1e-3) continue;
        const when = off(tt);
        if (when - now() > 20) continue;
        if (snd.type === 'impact') impact(when, 0.5 * gainPct, pitch, snd.metal ? A.n(sampleSound(layer, Math.max(inP, fromTime), snd.metal)) / 100 : 1);
        else if (snd.type === 'chime') chime(when, 0.24 * gainPct, pitch);
        else whoosh(when, 0.35 * gainPct, pitch);
      }
    } else if (snd.type === 'spark') {
      const count = snd.density ? Math.round(A.n(sampleSound(layer, fromTime, snd.density))) : 26;
      const startT = Math.max(inP, fromTime);
      if (inP >= fromTime) {
        for (let i = 0; i < count; i++) {
          const tt = inP + Math.random() * (outP - inP) * 0.7;
          spark(off(tt), 0.16 * gainPct * (0.4 + Math.random()), pitch);
        }
      }
    } else if (snd.type === 'drone') {
      if (outP <= fromTime) return;
      const dur = Math.min(outP, comp.duration) - Math.max(fromTime, inP);
      if (dur > 0.1) drone(base, 0.22 * gainPct, pitch, dur);
    } else if (snd.type === 'score') {
      // 锻字配乐：D 小调工业氛围
      const start = Math.max(fromTime, inP);
      const end = Math.min(outP, comp.duration);
      const chordRoot = 73.42 * Math.pow(2, pitch / 1200);
      const prog = [[1, 1.189, 1.498], [1.189, 1.498, 1.782], [0.891, 1.122, 1.335], [1, 1.189, 1.498]];
      const seg = 3.6;
      for (let tt = Math.floor(start / seg) * seg; tt < end; tt += seg) {
        const p = prog[Math.floor(tt / seg) % prog.length];
        for (let i = 0; i < 3; i++) {
          const when = off(Math.max(tt, start));
          const dur = Math.min(end, tt + seg) - Math.max(tt, start) + (tt === 0 ? 0 : 0.8);
          if (dur > 0.2 && when >= now() - 0.05) pad(when, 0.07 * gainPct, chordRoot * p[i], dur + 0.6);
        }
      }
      // 低频脉冲与金属点缀
      const beat = 0.8;
      for (let tt = Math.ceil(start / beat) * beat; tt < end; tt += beat) {
        const when = off(tt);
        if (when < now()) continue;
        const strong = Math.abs((tt / beat) % 4) < 0.01;
        if (strong || Math.abs((tt / beat) % 2) < 0.01) lowPulse(when, (strong ? 0.14 : 0.08) * gainPct, pitch);
        if (Math.abs((tt / beat) % 8) < 0.01) spark(when + 0.12, 0.06 * gainPct, pitch + 600);
      }
    }
  }

  S.start = function (compRef, time, workStart, workEnd) {
    comp = compRef;
    if (!ensure()) return;
    S.stop(true);
    if (!enabled) return;
    try {
      const lat = 0.05;
      const sorted = comp.layers.filter(l => l.type === 'sound' && l.enabled);
      for (const l of sorted) scheduleLayer(l, time, lat);
    } catch (e) { console.warn('音频调度错误', e); }
  };

  S.stop = function (soft) {
    for (const n of active) {
      try {
        if (n && typeof n.stop === 'function') n.stop((actx ? actx.currentTime : 0) + (soft ? 0.05 : 0));
      } catch (e) { /* 已停止 */ }
    }
    active = [];
  };

  S.preview = function (type, opts) {
    if (!ensure()) return;
    const t = now() + 0.03;
    const gain = (opts && opts.gain) || 0.5;
    if (type === 'impact') impact(t, gain, 0, 1);
    else if (type === 'chime') chime(t, gain, 0);
    else if (type === 'whoosh') whoosh(t, gain, 0);
    else if (type === 'spark') { for (let i = 0; i < 8; i++) spark(t + i * 0.035, 0.15, 0); }
    else if (type === 'drone') drone(t, 0.2, 0, 3);
  };

  // 可用的内置音色
  S.TYPES = [
    ['impact', '锤击 / 重击'], ['spark', '火星噼啪'], ['chime', '金属余韵'],
    ['whoosh', '挥动风声'], ['drone', '炉膛低鸣'], ['score', '配乐（工业氛围）']
  ];

})(window);
