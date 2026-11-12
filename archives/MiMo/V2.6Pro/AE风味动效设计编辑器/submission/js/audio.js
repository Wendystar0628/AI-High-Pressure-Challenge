/* audio.js — 内置音色合成：配乐与音效，声画同步 */
(function(global) {
'use strict';

const A = {};
let ctx = null;
let master = null;
let started = false;
let scheduledUntil = 0;

A.init = function() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  // 简单混响（延迟网络）
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.22;
  const fb = ctx.createGain();
  fb.gain.value = 0.28;
  const wet = ctx.createGain();
  wet.gain.value = 0.18;
  delay.connect(fb); fb.connect(delay);
  delay.connect(wet); wet.connect(master);
  A.reverbSend = ctx.createGain();
  A.reverbSend.gain.value = 0.4;
  A.reverbSend.connect(delay);
  return ctx;
};

A.resume = function() {
  A.init();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  started = true;
};

A.isStarted = () => started && ctx && ctx.state === 'running';
A.now = () => (ctx ? ctx.currentTime : 0);

// 噪声缓冲（共享）
function noiseBuffer(dur = 1) {
  if (A._noise && A._noiseDur >= dur) return A._noise;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rng = U.rng(12345);
  for (let i = 0; i < len; i++) d[i] = rng() * 2 - 1;
  A._noise = buf; A._noiseDur = dur;
  return buf;
}

// 单音
A.playTone = function(opts) {
  A.init();
  if (!ctx) return;
  const t0 = ctx.currentTime + (opts.when || 0);
  const dur = opts.dur || 0.3;
  const osc = ctx.createOscillator();
  osc.type = opts.type || 'sine';
  osc.frequency.setValueAtTime(opts.freq || 220, t0);
  if (opts.freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.gain != null ? opts.gain : 0.25, t0 + (opts.attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  let node = osc;
  if (opts.filter) {
    const f = ctx.createBiquadFilter();
    f.type = opts.filter.type || 'lowpass';
    f.frequency.value = opts.filter.freq || 1200;
    f.Q.value = opts.filter.q || 1;
    osc.connect(f); node = f;
  }
  node.connect(g);
  g.connect(master);
  if (A.reverbSend && opts.reverb !== false) g.connect(A.reverbSend);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
};

// 噪声爆发
A.playNoise = function(opts) {
  A.init();
  if (!ctx) return;
  const t0 = ctx.currentTime + (opts.when || 0);
  const dur = opts.dur || 0.2;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(Math.max(dur, 0.5));
  const f = ctx.createBiquadFilter();
  f.type = opts.filterType || 'bandpass';
  f.frequency.setValueAtTime(opts.freq || 1800, t0);
  if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(60, opts.freqEnd), t0 + dur);
  f.Q.value = opts.q || 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.gain != null ? opts.gain : 0.2, t0 + (opts.attack || 0.003));
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  if (A.reverbSend && opts.reverb !== false) g.connect(A.reverbSend);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
};

// 复合音效
A.sfx = function(type, params = {}) {
  const when = params.when || 0;
  switch (type) {
    case 'hammer':
      // 金属锤击：低频冲击 + 噪声 + 高频泛音
      A.playNoise({ when, dur: 0.18, freq: 900, freqEnd: 300, gain: 0.42, q: 0.8, filterType: 'bandpass' });
      A.playTone({ when, dur: 0.35, freq: 120, freqEnd: 55, gain: 0.5, type: 'triangle' });
      A.playTone({ when: when + 0.005, dur: 0.6, freq: 2200, freqEnd: 1400, gain: 0.12, type: 'sine' });
      A.playTone({ when: when + 0.01, dur: 0.4, freq: 520, freqEnd: 380, gain: 0.1, type: 'square' });
      break;
    case 'spark':
      A.playNoise({ when, dur: 0.12, freq: 4200, freqEnd: 2200, gain: 0.12, q: 2, filterType: 'highpass' });
      break;
    case 'whoosh':
      A.playNoise({ when, dur: 0.5, freq: 200, freqEnd: 900, gain: 0.14, attack: 0.12, filterType: 'bandpass' });
      break;
    case 'write':
      A.playNoise({ when, dur: 0.15, freq: 2600, freqEnd: 1800, gain: 0.07, q: 3 });
      A.playTone({ when, dur: 0.12, freq: 600 + Math.random() * 200, gain: 0.04, type: 'triangle' });
      break;
    case 'heat':
      A.playNoise({ when, dur: 1.2, freq: 140, freqEnd: 220, gain: 0.1, attack: 0.4, filterType: 'lowpass' });
      A.playTone({ when, dur: 1.5, freq: 65, gain: 0.12, type: 'sine' });
      break;
    case 'cool':
      A.playNoise({ when, dur: 1.8, freq: 800, freqEnd: 120, gain: 0.1, attack: 0.5, filterType: 'lowpass' });
      A.playTone({ when, dur: 2.0, freq: 220, freqEnd: 90, gain: 0.08, type: 'triangle' });
      break;
    case 'click':
      A.playTone({ when, dur: 0.06, freq: 1200, gain: 0.12, type: 'square' });
      break;
    case 'ambient':
      A.playTone({ when, dur: params.dur || 3, freq: params.freq || 55, gain: 0.1, type: 'sine' });
      A.playTone({ when, dur: params.dur || 3, freq: (params.freq || 55) * 1.5, gain: 0.05, type: 'triangle' });
      break;
  }
};

// 预排整段配乐（demo 用）：events = [{t, type, ...}]
A.scheduleScore = function(events) {
  A.init();
  if (!ctx) return;
  // 清空旧节点不易：调用方在 seek 时 cancel
  events.forEach(ev => {
    A.sfx(ev.type, Object.assign({}, ev, { when: Math.max(0, ev.t - (A.scoreAnchor || 0)) }));
  });
};

// 与视频导出/播放同步：按工程时间调度
A.playFrom = function(events, tNow, speed = 1) {
  A.init();
  if (!ctx || ctx.state !== 'running') return;
  // 调度 tNow 之后的事件（相对 audio clock）
  const base = ctx.currentTime + 0.08;
  events.forEach(ev => {
    if (ev.t < tNow - 0.02) return;
    A.sfx(ev.type, Object.assign({}, ev, { when: base + (ev.t - tNow) / (speed || 1) }));
  });
};

A.setVolume = function(v) {
  if (master) master.gain.value = U.clamp(v, 0, 1);
};

A.stopAll = function() {
  // WebAudio 无法批量停；通过断开重建 master
  if (ctx && master) {
    try {
      master.disconnect();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    } catch (e) {}
  }
};

global.AudioSynth = A;
})(window);
