/* 动态路由塔防 · 程序化音频合成（Web Audio，无外部音频文件） */
(function () {
  'use strict';
  var TD = window.TD = window.TD || {};
  var ctx = null, master = null, pad = [], padGain = null, arpTimer = null, noiseBuf = null;
  var volume = 0.55, muted = false, ambience = 'corp', started = false;
  var scales = {
    corp: [110, 138.6, 164.8, 220, 261.6, 329.6],
    backbone: [98, 123.5, 146.8, 196, 246.9, 293.7],
    ics: [82.4, 110, 130.8, 164.8, 196, 261.6]
  };

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
      // 噪声缓冲
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { return false; }
  }
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    started = true;
  }
  function now() { return ctx ? ctx.currentTime : 0; }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!ctx || muted) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, when || now());
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), (when || now()) + dur);
    g.gain.setValueAtTime(0.0001, when || now());
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), (when || now()) + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, (when || now()) + dur);
    o.connect(g); g.connect(master); o.start(when || now()); o.stop((when || now()) + dur + 0.02);
  }
  function noise(dur, gain, freq, when, q) {
    if (!ctx || muted || !noiseBuf) return;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 900; bp.Q.value = q || 1.2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, when || now());
    g.gain.exponentialRampToValueAtTime(0.0001, (when || now()) + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(when || now()); src.stop((when || now()) + dur + 0.02);
  }

  function startAmbience(id) {
    if (!ensure()) return;
    ambience = id || ambience;
    var scale = scales[ambience] || scales.corp;
    stopAmbience();
    padGain = ctx.createGain(); padGain.gain.value = 0.0001; padGain.connect(master);
    padGain.gain.exponentialRampToValueAtTime(0.05, now() + 2.5);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = ambience === 'ics' ? 380 : 620; lp.connect(padGain);
    for (var i = 0; i < 3; i++) {
      var o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = scale[i] / (i === 0 ? 2 : 1);
      var g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.22;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.037;
      var lg = ctx.createGain(); lg.gain.value = 0.12;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(g); g.connect(lp); o.start();
      pad.push({ o: o, lfo: lfo });
    }
    var step = 0;
    arpTimer = setInterval(function () {
      if (!ctx || muted || ctx.state !== 'running') return;
      var sc = scales[ambience] || scales.corp;
      var f = sc[(step * 3 + Math.floor(step / 3)) % sc.length] * (step % 4 === 0 ? 2 : 1);
      tone(f, 0.5, 'sine', 0.018, now(), f * 1.005);
      if (step % 4 === 0) noise(0.18, 0.012, 180, now(), 0.7);
      step++;
    }, 760);
  }
  function stopAmbience() {
    if (arpTimer) { clearInterval(arpTimer); arpTimer = null; }
    for (var i = 0; i < pad.length; i++) { try { pad[i].o.stop(); pad[i].lfo.stop(); } catch (e) { } }
    pad = [];
    if (padGain) { try { padGain.gain.exponentialRampToValueAtTime(0.0001, now() + 0.4); } catch (e) { } padGain = null; }
  }

  function play(name, arg) {
    if (!ctx || muted || ctx.state !== 'running') return;
    var t = now();
    switch (name) {
      case 'click': tone(660, 0.06, 'square', 0.05, t); break;
      case 'build': tone(220, 0.18, 'triangle', 0.10, t, 440); tone(440, 0.12, 'sine', 0.05, t + 0.06); break;
      case 'upgrade': tone(392, 0.12, 'sine', 0.07, t); tone(523, 0.16, 'sine', 0.07, t + 0.08); tone(659, 0.2, 'sine', 0.06, t + 0.16); break;
      case 'skill': tone(180, 0.35, 'sawtooth', 0.05, t, 900); noise(0.3, 0.03, 1400, t); break;
      case 'item': tone(880, 0.1, 'sine', 0.06, t); tone(1174, 0.12, 'sine', 0.05, t + 0.07); break;
      case 'kill': noise(0.12, 0.045, 1200, t); tone(160, 0.1, 'square', 0.03, t, 80); break;
      case 'leak': tone(140, 0.5, 'sawtooth', 0.09, t, 70); noise(0.4, 0.04, 300, t); break;
      case 'isolate': tone(300, 0.3, 'sawtooth', 0.05, t, 120); tone(520, 0.2, 'sine', 0.04, t + 0.05); break;
      case 'bypass': tone(120, 0.3, 'sawtooth', 0.05, t, 320); break;
      case 'routeChange': tone(420, 0.14, 'sine', 0.04, t, 620); tone(620, 0.12, 'sine', 0.03, t + 0.1); break;
      case 'warning': case 'bossphase': tone(90, 0.7, 'sawtooth', 0.08, t, 60); noise(0.6, 0.05, 220, t); break;
      case 'bossarrive': tone(70, 1.2, 'sawtooth', 0.1, t, 45); noise(1.0, 0.06, 160, t); break;
      case 'spawn': tone(720, 0.05, 'sine', 0.018, t); break;
      case 'waveStart': tone(330, 0.2, 'triangle', 0.05, t, 440); break;
      case 'waveEnd': tone(440, 0.15, 'sine', 0.05, t); tone(554, 0.2, 'sine', 0.05, t + 0.12); break;
      case 'win': [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.5, 'sine', 0.08, t + i * 0.16); }); break;
      case 'lose': [330, 262, 196, 131].forEach(function (f, i) { tone(f, 0.6, 'triangle', 0.08, t + i * 0.22); }); break;
      case 'rejected': tone(200, 0.15, 'square', 0.05, t, 150); break;
      default: break;
    }
  }

  TD.Audio = {
    unlock: unlock, play: play, startAmbience: startAmbience, stopAmbience: stopAmbience,
    setVolume: function (v) { volume = Math.max(0, Math.min(1, v)); if (master && !muted) master.gain.value = volume; },
    getVolume: function () { return volume; },
    setMute: function (m) { muted = m; if (master) master.gain.value = m ? 0 : volume; },
    isMuted: function () { return muted; },
    isStarted: function () { return started; }
  };
})();
