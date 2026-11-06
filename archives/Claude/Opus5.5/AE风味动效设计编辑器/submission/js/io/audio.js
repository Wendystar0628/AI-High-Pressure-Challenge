// 声音：音色图层（内置合成器）、本地音频、播放同步、离线渲染（导出）、钢琴卷帘编辑
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, E = AE.Eval;
  const AU = AE.Audio = { ctx: null, master: null, session: null, buffers: new Map() };
  AU.PRESETS = { pad: '氛围铺底', pluck: '拨弦', bass: '贝斯', lead: '主旋律', bell: '钟琴', sparkle: '闪烁', kick: '底鼓', snare: '军鼓', hat: '踩镲', clap: '拍手', impact: '冲击音效', whoosh: '呼啸音效', riser: '上升音效', sub: '低频脉冲' };
  AU.DRUMS = new Set(['kick', 'snare', 'hat', 'clap', 'impact', 'whoosh', 'riser', 'sub']);
  AU.ensure = () => {
    if (!AU.ctx) { try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 }); } catch (e) { return null; } }
    if (AU.ctx.state === 'suspended') AU.ctx.resume();
    return AU.ctx;
  };
  // 浏览器首次点击或按键后允许出声
  const unlock = () => { AU.ensure(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

  const noiseCache = new WeakMap();
  function noiseBuf(ac) {
    let b = noiseCache.get(ac); if (b) return b;
    b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = b.getChannelData(0), r = U.rng(99); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    noiseCache.set(ac, b); return b;
  }
  const irCache = new WeakMap();
  function impulse(ac) {
    let b = irCache.get(ac); if (b) return b;
    const len = ac.sampleRate * 2.2; b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c), r = U.rng(7 + c); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    irCache.set(ac, b); return b;
  }
  // 总线：压缩 + 混响送出
  function makeBus(ac, dest) {
    const input = ac.createGain(), comp = ac.createDynamicsCompressor(), out = ac.createGain();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    const verb = ac.createConvolver(); verb.buffer = impulse(ac); const send = ac.createGain(); send.gain.value = 0.22;
    input.connect(comp); input.connect(send); send.connect(verb); verb.connect(comp);
    comp.connect(out); out.gain.value = 0.9; out.connect(dest);
    return { input, out };
  }
  const hz = (p) => 440 * Math.pow(2, (p - 69) / 12);
  function env(g, when, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + Math.max(0.002, a));
    g.gain.setValueAtTime(Math.max(0.0002, peak), when + Math.max(a, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(a, dur) + Math.max(0.01, rel));
  }
  // 单个音符
  function voice(ac, out, preset, n, when, prm) {
    const vel = n.v, dur = Math.max(0.02, n.d), f = hz(n.p);
    const stopAt = when + dur + prm.release + 0.6;
    const g = ac.createGain(); g.connect(out);
    const osc = (type, fr, det = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(fr, when); o.detune.value = det; o.start(when); o.stop(stopAt); return o; };
    const noise = () => { const s = ac.createBufferSource(); s.buffer = noiseBuf(ac); s.loop = true; s.start(when, (n.p * 0.137) % 1.5); s.stop(stopAt); return s; };
    const filt = (type, fr, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(fr, when); b.Q.value = q; return b; };
    switch (preset) {
      case 'pad': {
        const lp = filt('lowpass', prm.cutoff, 0.5); lp.connect(g);
        for (const d of [-prm.detune, 0, prm.detune]) osc(prm.wave, f, d).connect(lp);
        osc('sine', f / 2).connect(lp);
        env(g, when, Math.max(0.25, prm.attack), 0.11 * vel, dur, Math.max(0.8, prm.release));
        break;
      }
      case 'pluck': case 'lead': {
        const lp = filt('lowpass', prm.cutoff * 2.5, 2); lp.frequency.exponentialRampToValueAtTime(Math.max(200, prm.cutoff * 0.4), when + 0.25); lp.connect(g);
        osc(prm.wave, f, -prm.detune / 2).connect(lp); osc(prm.wave, f, prm.detune / 2).connect(lp);
        env(g, when, prm.attack, (preset === 'lead' ? 0.16 : 0.2) * vel, preset === 'lead' ? dur : Math.min(dur, 0.12), preset === 'lead' ? prm.release : 0.35);
        break;
      }
      case 'bass': {
        const lp = filt('lowpass', prm.cutoff * 0.6, 1.2); lp.connect(g);
        osc('sine', f).connect(lp); osc('sawtooth', f, 4).connect(lp);
        env(g, when, 0.008, 0.3 * vel, dur, 0.12);
        break;
      }
      case 'bell': case 'sparkle': {
        const k = preset === 'sparkle' ? 2 : 1;
        osc('sine', f * k).connect(g); const g2 = ac.createGain(); g2.gain.value = 0.35; osc('sine', f * k * 2.76).connect(g2); g2.connect(g);
        const g3 = ac.createGain(); g3.gain.value = 0.15; osc('triangle', f * k * 5.4).connect(g3); g3.connect(g);
        env(g, when, 0.003, (preset === 'sparkle' ? 0.07 : 0.12) * vel, 0.02, preset === 'sparkle' ? 0.6 : 1.6);
        break;
      }
      case 'kick': {
        const o = osc('sine', 150); o.frequency.exponentialRampToValueAtTime(42, when + 0.14); o.connect(g);
        const c = noise(), hp = filt('highpass', 3000); c.connect(hp); const cg = ac.createGain(); env(cg, when, 0.001, 0.12 * vel, 0.005, 0.02); hp.connect(cg); cg.connect(out);
        env(g, when, 0.002, 0.9 * vel, 0.04, 0.42);
        break;
      }
      case 'sub': { const o = osc('sine', f > 100 ? 55 : f); o.connect(g); env(g, when, 0.01, 0.5 * vel, dur, 0.3); break; }
      case 'snare': case 'clap': {
        const s = noise(), bp = filt('bandpass', preset === 'clap' ? 1300 : 2000, 0.8); s.connect(bp); bp.connect(g);
        if (preset === 'snare') { const t = osc('triangle', 190); t.frequency.exponentialRampToValueAtTime(120, when + 0.08); const tg = ac.createGain(); env(tg, when, 0.001, 0.3 * vel, 0.01, 0.1); t.connect(tg); tg.connect(out); }
        env(g, when, 0.001, 0.35 * vel, 0.01, preset === 'clap' ? 0.18 : 0.2);
        break;
      }
      case 'hat': { const s = noise(), hp = filt('highpass', 7500, 0.5); s.connect(hp); hp.connect(g); env(g, when, 0.001, 0.12 * vel, 0.005, n.d > 0.2 ? 0.25 : 0.05); break; }
      case 'impact': {
        const o = osc('sine', 70); o.frequency.exponentialRampToValueAtTime(32, when + 1.2); o.connect(g);
        const s = noise(), lp = filt('lowpass', 4000, 0.4); lp.frequency.exponentialRampToValueAtTime(120, when + 1.4); s.connect(lp); const ng = ac.createGain(); env(ng, when, 0.002, 0.35 * vel, 0.03, 1.4); lp.connect(ng); ng.connect(out);
        env(g, when, 0.002, 0.8 * vel, 0.1, 1.8);
        break;
      }
      case 'whoosh': {
        const s = noise(), bp = filt('bandpass', 300, 1.6); bp.frequency.exponentialRampToValueAtTime(3500, when + dur * 0.7); bp.frequency.exponentialRampToValueAtTime(600, when + dur);
        s.connect(bp); bp.connect(g);
        g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.4 * vel, when + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.2);
        break;
      }
      case 'riser': {
        const o = osc('sawtooth', f); o.frequency.exponentialRampToValueAtTime(f * 4, when + dur); const lp = filt('lowpass', 400, 4); lp.frequency.exponentialRampToValueAtTime(6000, when + dur); o.connect(lp); lp.connect(g);
        const s = noise(), hp = filt('highpass', 800); hp.frequency.exponentialRampToValueAtTime(9000, when + dur); s.connect(hp); hp.connect(g);
        g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.13 * vel, when + dur); g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.08);
        break;
      }
      default: { osc(prm.wave, f).connect(g); env(g, when, prm.attack, 0.15 * vel, dur, prm.release); }
    }
  }
  const dbToGain = db => Math.pow(10, db / 20);
  // 收集一个合成（含嵌套预合成）中的声音事件：[{layer, ctx, absT, note|buffer}]
  function collect(comp, ctx, t0, t1, out, mapT = (x) => x, depth = 0) {
    if (depth > 6) return;
    for (const l of comp.layers) {
      if (!l.visible) continue;
      if (l.type === 'synth') {
        for (const n of l.synth.notes) {
          const at = l.inPoint + n.t;
          if (at < l.inPoint - 1e-6 || at >= l.outPoint) continue;
          const T = mapT(at); if (T === null || T < t0 - 1e-6 || T >= t1) continue;
          out.push({ kind: 'note', layer: l, ctx, T, n, local: at });
        }
      } else if (l.type === 'audio' && l.audio.asset) {
        const T = mapT(l.inPoint); if (T === null) continue;
        out.push({ kind: 'buf', layer: l, ctx, T, local: l.inPoint });
      } else if (l.type === 'precomp' && !l.precomp.remapOn) {
        const src = E.comp(l.precomp.source); if (!src) continue;
        const sp = (l.precomp.speed || 100) / 100; if (sp <= 0) continue;
        const cctx = E.child(ctx, l, l.inPoint);
        collect(src, cctx, t0, t1, out, (inner) => { const outer = l.startTime + inner / sp; if (outer < l.inPoint || outer >= l.outPoint) return null; return mapT(outer); }, depth + 1);
      }
    }
  }
  function prmOf(ev) {
    const l = ev.layer, s = l.synth, V = (p) => E.prop(p, ev.local, ev.ctx, l);
    return { wave: s.wave === 'saw' ? 'sawtooth' : s.wave, attack: V(s.attack), release: V(s.release), cutoff: V(s.cutoff), detune: V(s.detune), vol: dbToGain(V(s.volume)), pan: U.clamp(V(s.pan), -1, 1) };
  }
  function scheduleAll(ac, dest, proj, comp, from, to, when0) {
    E.index(proj);
    const evs = []; collect(comp, E.root(comp), from, to, evs);
    const bus = makeBus(ac, dest);
    for (const ev of evs) {
      if (ev.kind === 'note') {
        const prm = prmOf(ev); const when = when0 + (ev.T - from);
        const g = ac.createGain(); g.gain.value = prm.vol; const pn = ac.createStereoPanner(); pn.pan.value = prm.pan; g.connect(pn); pn.connect(bus.input);
        voice(ac, g, ev.layer.synth.preset, ev.n, Math.max(when, ac.currentTime || 0), prm);
      } else {
        const asset = proj.assets.find(a => a.id === ev.layer.audio.asset); const buf = asset && AU.buffers.get(asset.id); if (!buf) continue;
        const l = ev.layer, V = (p) => E.prop(p, l.inPoint, ev.ctx, l);
        const offset = Math.max(0, from - ev.T), when = when0 + Math.max(0, ev.T - from);
        const len = Math.min(buf.duration - offset, l.outPoint - Math.max(l.inPoint, from)); if (len <= 0) continue;
        const src = ac.createBufferSource(); src.buffer = buf; const g = ac.createGain(); g.gain.value = dbToGain(V(l.audio.volume)); const pn = ac.createStereoPanner(); pn.pan.value = U.clamp(V(l.audio.pan), -1, 1);
        src.connect(g); g.connect(pn); pn.connect(bus.input); src.start(when, offset, len);
      }
    }
    return bus;
  }
  AU.start = (proj, comp, t) => {
    const ac = AU.ensure(); if (!ac) return;
    AU.stop();
    const out = ac.createGain(); out.connect(ac.destination);
    const when0 = ac.currentTime + 0.03;
    scheduleAll(ac, out, proj, comp, t, comp.duration, when0);
    AU.session = { out };
  };
  AU.stop = () => { if (AU.session) { try { AU.session.out.disconnect(); } catch (e) { } AU.session = null; } };
  AU.preview = (layer) => {
    const ac = AU.ensure(); if (!ac) return;
    const out = ac.createGain(); out.connect(ac.destination);
    const bus = makeBus(ac, out); const ctx = AE.App.ctx();
    for (const n of layer.synth.notes) { const ev = { layer, ctx, local: layer.inPoint + n.t }; const prm = prmOf(ev); const g = ac.createGain(); g.gain.value = prm.vol; g.connect(bus.input); voice(ac, g, layer.synth.preset, n, ac.currentTime + 0.05 + n.t, prm); }
    setTimeout(() => out.disconnect(), 12000);
  };
  // 离线渲染工作区 → AudioBuffer
  AU.renderOffline = async (proj, comp, from, to, rate = 48000) => {
    const len = Math.max(1, Math.ceil((to - from) * rate));
    const oc = new OfflineAudioContext(2, len, rate);
    for (const a of proj.assets) if (a.type === 'audio' && !AU.buffers.has(a.id)) await AU.decodeAsset(a);
    scheduleAll(oc, oc.destination, proj, comp, from, to, 0);
    return oc.startRendering();
  };
  AU.decodeAsset = async (a) => {
    const ac = AU.ensure() || new OfflineAudioContext(2, 48000, 48000);
    const bin = Uint8Array.from(atob(a.data), c => c.charCodeAt(0));
    const buf = await ac.decodeAudioData(bin.buffer.slice(0));
    AU.buffers.set(a.id, buf); a.duration = buf.duration; return buf;
  };

  // ---------- 钢琴卷帘 ----------
  AU.pianoRoll = (layer) => {
    const W = AE.W;
    const box = W.el('div', { class: 'pianoroll' }), cv = W.el('canvas'); box.append(cv);
    const s = layer.synth, drum = AU.DRUMS.has(s.preset);
    const view = () => {
      const ps = s.notes.map(n => n.p); let lo = ps.length ? Math.min(...ps) - 3 : 48, hi = ps.length ? Math.max(...ps) + 3 : 72;
      if (hi - lo < 14) { const m = (lo + hi) / 2; lo = Math.floor(m - 7); hi = Math.ceil(m + 7); }
      const end = Math.max(4, ...s.notes.map(n => n.t + n.d)) + 0.5;
      return { lo, hi, end };
    };
    let vw = view();
    const draw = () => {
      const f = W.fitCanvas(cv), x = cv.getContext('2d'); x.setTransform(f.d, 0, 0, f.d, 0, 0);
      x.fillStyle = '#0f1217'; x.fillRect(0, 0, f.w, f.h);
      const rows = vw.hi - vw.lo + 1, rh = f.h / rows;
      for (let p = vw.lo; p <= vw.hi; p++) { const y = f.h - (p - vw.lo + 1) * rh; if ([1, 3, 6, 8, 10].includes(p % 12)) { x.fillStyle = '#13171e'; x.fillRect(0, y, f.w, rh); } if (p % 12 === 0) { x.fillStyle = '#5a6170'; x.font = '9px sans-serif'; x.fillText('C' + (p / 12 - 1), 2, y + rh - 1); } }
      const X = (t) => 18 + t / vw.end * (f.w - 20);
      for (let b = 0; b <= vw.end; b += 0.25) { x.strokeStyle = b % 1 === 0 ? '#2b313d' : '#1a1e26'; x.beginPath(); x.moveTo(X(b), 0); x.lineTo(X(b), f.h); x.stroke(); }
      for (const n of s.notes) { const y = f.h - (n.p - vw.lo + 1) * rh; x.fillStyle = 'rgba(255,159,67,' + (0.45 + n.v * 0.5) + ')'; x.fillRect(X(n.t), y + 1, Math.max(3, X(n.t + n.d) - X(n.t)), Math.max(2, rh - 2)); }
      const lt = AE.App.t() - layer.inPoint; if (lt >= 0 && lt <= vw.end) { x.strokeStyle = '#ff9f43'; x.beginPath(); x.moveTo(X(lt), 0); x.lineTo(X(lt), f.h); x.stroke(); }
    };
    const hit = (e) => { const r = cv.getBoundingClientRect(), rows = vw.hi - vw.lo + 1; const t = (e.clientX - r.left - 18) / (r.width - 20) * vw.end; const p = vw.lo + Math.floor((r.height - (e.clientY - r.top)) / (r.height / rows)); return { t, p }; };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mousedown', (e) => {
      const h = hit(e); const snap = 0.125;
      const n = s.notes.find(n => h.t >= n.t && h.t <= n.t + n.d && n.p === h.p);
      AE.App.begin();
      if (e.button === 2) { if (n) s.notes.splice(s.notes.indexOf(n), 1); AE.App.commit('删除音符'); draw(); return; }
      let note = n;
      if (!note) { note = AE.Model.note(Math.max(0, Math.round(h.t / snap) * snap), drum ? 0.12 : 0.25, h.p, 0.8); s.notes.push(note); }
      const t0 = note.t, p0 = note.p, x0 = e.clientX, y0 = e.clientY, r = cv.getBoundingClientRect(), rows = vw.hi - vw.lo + 1;
      const mm = (ev) => { note.t = Math.max(0, Math.round((t0 + (ev.clientX - x0) / (r.width - 20) * vw.end) / snap) * snap); note.p = p0 - Math.round((ev.clientY - y0) / (r.height / rows)); draw(); };
      const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); s.notes.sort((a, b) => a.t - b.t); AE.App.commit(n ? '移动音符' : '添加音符'); vw = view(); draw(); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
      draw();
    });
    setTimeout(draw, 0);
    return box;
  };
})(typeof window !== 'undefined' ? window : globalThis);
