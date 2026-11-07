// 音色合成与音频播放（Web Audio），支持音色图层与节拍
import { clamp, stableRandom } from './math.js';

export class ToneSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this._voices = [];
    this._scheduled = [];
    this.muted = false;
    this.volume = 0.75;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 8;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.enabled = true;
    return this.ctx;
  }

  resume() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  stopAll() {
    for (const v of this._voices) {
      try { v.stop(); } catch (e) { /* ok */ }
    }
    this._voices = [];
    this._scheduled = [];
  }

  /**
   * 播放音色音符
   * tone: {wave:'sine'|'square'|'saw'|'triangle'|'noise', freq, duration, gain, pan, detune, attack, decay, sustain, release}
   */
  playNote(tone, when = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = (when || ctx.currentTime);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const wave = tone.wave || 'sine';
    if (wave !== 'noise') {
      osc.type = wave;
      osc.frequency.value = tone.freq || 440;
      if (tone.detune) osc.detune.value = tone.detune;
    } else {
      // 噪声
      const bufferSize = ctx.sampleRate * Math.max(0.05, tone.duration || 0.3);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = tone.seed ?? 1;
      for (let i = 0; i < bufferSize; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      if (pan) {
        gain.connect(pan);
        pan.pan.value = tone.pan || 0;
        pan.connect(this.master);
      } else {
        gain.connect(this.master);
      }
      const a = tone.attack ?? 0.005;
      const d = tone.duration || 0.3;
      const r = tone.release ?? 0.05;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(tone.gain ?? 0.3, t0 + a);
      gain.gain.setValueAtTime(tone.gain ?? 0.3, t0 + d - r);
      gain.gain.linearRampToValueAtTime(0, t0 + d);
      src.start(t0);
      src.stop(t0 + d + 0.05);
      this._voices.push(src);
      return;
    }

    const a = tone.attack ?? 0.008;
    const dur = tone.duration ?? 0.35;
    const s = tone.sustain ?? 0.65;
    const r = tone.release ?? 0.12;
    const peak = tone.gain ?? 0.25;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + a);
    gain.gain.linearRampToValueAtTime(peak * s, t0 + Math.max(a + 0.01, dur * 0.35));
    gain.gain.linearRampToValueAtTime(peak * s, t0 + Math.max(0.02, dur - r));
    gain.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(gain);
    if (pan) {
      gain.connect(pan);
      pan.pan.value = tone.pan || 0;
      pan.connect(this.master);
    } else {
      gain.connect(this.master);
    }
    if (tone.filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = tone.filterType || 'lowpass';
      f.frequency.value = tone.filterFreq;
      osc.disconnect();
      osc.connect(f);
      f.connect(gain);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    this._voices.push(osc);
  }

  // 按秒调度音符（工程时间 -> audioContext 时间）
  scheduleAt(noteTime, offsetCtxTime, tone) {
    const ctx = this.ensure();
    if (!ctx) return;
    const when = offsetCtxTime + Math.max(0, noteTime);
    this.playNote(tone, when);
  }
}

// 音色图层音符数据
export function tonePattern(patternName, opts = {}) {
  const root = opts.root || 220;
  const t = opts.start || 0;
  const dur = opts.dur || 0.4;
  const notes = [];
  const scale = opts.scale || [0, 2, 3, 5, 7, 9, 10];
  const seed = opts.seed ?? 7;
  switch (patternName) {
    case 'arp': {
      for (let i = 0; i < (opts.count || 16); i++) {
        const deg = scale[i % scale.length];
        const oct = Math.floor(i / scale.length) * 12;
        notes.push({
          time: t + i * dur * 0.5,
          tone: {
            wave: 'triangle', freq: root * Math.pow(2, (deg + oct) / 12),
            duration: dur * 0.55, gain: 0.16, pan: ((i % 4) - 1.5) * 0.35,
            attack: 0.004, release: 0.08,
          },
        });
      }
      break;
    }
    case 'bass': {
      for (let i = 0; i < (opts.count || 8); i++) {
        const deg = scale[(i * 2) % scale.length] - 12;
        notes.push({
          time: t + i * dur * 2,
          tone: {
            wave: 'sawtooth', freq: root * Math.pow(2, deg / 12),
            duration: dur * 1.6, gain: 0.2, filterFreq: 320, filterType: 'lowpass',
            attack: 0.01, release: 0.18,
          },
        });
      }
      break;
    }
    case 'pad': {
      for (let i = 0; i < (opts.count || 4); i++) {
        const deg = scale[(i * 3) % scale.length];
        notes.push({
          time: t + i * dur * 3,
          tone: {
            wave: 'sine', freq: root * Math.pow(2, deg / 12) * 0.5,
            duration: dur * 4, gain: 0.1, attack: 0.6, release: 1.2, sustain: 0.8,
          },
        });
      }
      break;
    }
    case 'kick': {
      for (let i = 0; i < (opts.count || 16); i++) {
        notes.push({
          time: t + i * dur,
          tone: { wave: 'sine', freq: 55, duration: 0.22, gain: 0.55, attack: 0.001, release: 0.12, sustain: 0.2 },
        });
      }
      break;
    }
    case 'hat': {
      for (let i = 0; i < (opts.count || 16); i++) {
        notes.push({
          time: t + i * dur + dur * 0.5,
          tone: { wave: 'noise', duration: 0.06, gain: 0.1, filterFreq: 6000, filterType: 'highpass', seed: seed + i },
        });
      }
      break;
    }
    case 'fx': {
      // 上升音效
      notes.push({
        time: t,
        tone: { wave: 'sawtooth', freq: opts.from || 180, duration: opts.duration || 1.2, gain: 0.18, attack: 0.25, release: 0.3, filterFreq: 900 },
      });
      break;
    }
    case 'hit': {
      notes.push({
        time: t,
        tone: { wave: 'triangle', freq: opts.freq || 660, duration: opts.duration || 0.5, gain: opts.gain || 0.35, attack: 0.002, release: 0.25 },
      });
      notes.push({
        time: t,
        tone: { wave: 'noise', duration: 0.18, gain: 0.16, filterFreq: 2200, seed: seed },
      });
      break;
    }
    default:
      break;
  }
  return notes;
}
