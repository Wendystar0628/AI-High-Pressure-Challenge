// 内置音色合成器与声画同步播放引擎（Web Audio API 程序化生成配乐与锻打音效）

import { clamp } from '../core/math.js';
import { evalProperty } from '../core/expressions.js';
import { isLayerActiveAtTime } from '../core/project.js';

export const AUDIO_PRESETS = {
  anvilStrike: '铁砧重击 (金属锻打)',
  forgeDrone: '熔炉低鸣 (氛围配乐)',
  sparkBurst: '火星迸溅 (高频碎裂)',
  bell: '古钟清鸣 (金属泛音)',
  pad: '深沉铺底 (暖色和弦)',
  synthLead: '脉冲主音 (旋律音色)',
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.drones = new Map(); // layerId -> { osc1, osc2, filter, gain }
    this._prevTriggers = new Map(); // layerId -> prevValue
    this.muted = false;
  }

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.78;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this._createNoiseBuffer(2.0);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.78, this.ctx.currentTime, 0.02);
    }
  }

  _createNoiseBuffer(seconds) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // 确定性伪随机白噪声
    let s = 1234567;
    for (let i = 0; i < len; i++) {
      s = (s * 16807) % 2147483647;
      data[i] = (s / 1073741823.5) - 1;
    }
    return buf;
  }

  stopAll() {
    for (const [, d] of this.drones) {
      try {
        d.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
        d.osc1.stop(this.ctx.currentTime + 0.08);
        d.osc2.stop(this.ctx.currentTime + 0.08);
      } catch {}
    }
    this.drones.clear();
    this._prevTriggers.clear();
  }

  triggerPreview(layer, project, comp, time) {
    this.unlock();
    if (!this.ctx || !layer?.audio) return;
    const gain = clamp(evalProperty(project, comp, layer, 'audio.gain', time), 0, 1);
    const pitch = clamp(evalProperty(project, comp, layer, 'audio.pitch', time), 30, 4000);
    const cutoff = clamp(evalProperty(project, comp, layer, 'audio.cutoff', time), 60, 14000);
    this._fireVoice(layer.audio, gain, pitch, cutoff);
  }

  _fireVoice(cfg, gainVal, pitchHz, cutoffHz) {
    if (!this.ctx || !this.masterGain || gainVal <= 0.005) return;
    const now = this.ctx.currentTime;
    const preset = cfg.preset || 'anvilStrike';
    const atk = clamp(cfg.attack ?? 0.004, 0.001, 2);
    const dec = clamp(cfg.decay ?? 0.45, 0.02, 5);

    if (preset === 'anvilStrike' || preset === 'bell') {
      // 金属非谐泛音 FM + 低频冲击体 + 瞬态撞击噪声
      const ratios = preset === 'anvilStrike' ? [1.0, 2.76, 4.18, 5.92] : [1.0, 2.0, 3.01, 4.4];
      const amps = preset === 'anvilStrike' ? [0.55, 0.42, 0.28, 0.16] : [0.5, 0.35, 0.2, 0.1];
      const ringDur = preset === 'anvilStrike' ? 1.35 : 2.1;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(14000, cutoffHz * 1.8), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoffHz * 0.35), now + ringDur);
      filter.connect(this.masterGain);

      ratios.forEach((r, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = idx === 0 ? (cfg.waveform || 'triangle') : 'sine';
        osc.frequency.setValueAtTime(pitchHz * r, now);
        if (preset === 'anvilStrike' && idx === 0) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(40, pitchHz * 0.72), now + 0.09);
        }
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(gainVal * amps[idx], now + atk);
        g.gain.exponentialRampToValueAtTime(0.0001, now + ringDur / (1 + idx * 0.45));
        osc.connect(g);
        g.connect(filter);
        osc.start(now);
        osc.stop(now + ringDur + 0.05);
      });

      if (preset === 'anvilStrike' && this.noiseBuffer) {
        // 锤面瞬态金属撞击声
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(Math.min(6000, cutoffHz), now);
        bp.Q.value = 1.6;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(gainVal * 0.75, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
        noise.connect(bp);
        bp.connect(ng);
        ng.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.09);

        // 重锤低频冲击共振
        const sub = this.ctx.createOscillator();
        const sg = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(115, now);
        sub.frequency.exponentialRampToValueAtTime(38, now + 0.22);
        sg.gain.setValueAtTime(gainVal * 0.85, now);
        sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        sub.connect(sg);
        sg.connect(this.masterGain);
        sub.start(now);
        sub.stop(now + 0.3);
      }
      return;
    }

    if (preset === 'sparkBurst') {
      if (!this.noiseBuffer) return;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(clamp(cutoffHz, 800, 10000), now);
      hp.Q.value = 2.4;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.linearRampToValueAtTime(gainVal * 0.45, now + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.45);
      return;
    }

    // 通用合成器声音（synthLead / pad / forgeDrone 单音触发）
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = cfg.waveform || 'sawtooth';
    osc.frequency.setValueAtTime(pitchHz, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gainVal * 0.5, now + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, now + atk + dec);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + atk + dec + 0.05);
  }

  // 播放循环每帧同步声音状态（导出模式下不调用）
  syncPlayback(project, comp, prevTime, curTime, isPlaying) {
    if (!isPlaying) {
      if (this.drones.size > 0) this.stopAll();
      return;
    }
    if (!this.ctx || this.ctx.state !== 'running' || !comp) return;

    const now = this.ctx.currentTime;
    const activeDroneIds = new Set();

    for (const lyr of comp.layers) {
      if (lyr.type !== 'audio' || !lyr.audio) continue;
      const active = isLayerActiveAtTime(lyr, curTime);
      if (!active) {
        this._prevTriggers.set(lyr.id, 0);
        continue;
      }

      const gain = clamp(evalProperty(project, comp, lyr, 'audio.gain', curTime), 0, 1);
      const pitch = clamp(evalProperty(project, comp, lyr, 'audio.pitch', curTime), 30, 4000);
      const cutoff = clamp(evalProperty(project, comp, lyr, 'audio.cutoff', curTime), 60, 14000);
      const trig = evalProperty(project, comp, lyr, 'audio.trigger', curTime);

      // 持续型音色（如熔炉低鸣 / 铺底氛围）
      if (lyr.audio.droneEnabled || lyr.audio.preset === 'forgeDrone' || lyr.audio.preset === 'pad') {
        activeDroneIds.add(lyr.id);
        let d = this.drones.get(lyr.id);
        if (!d) {
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();
          osc1.type = lyr.audio.waveform || 'sawtooth';
          osc2.type = 'triangle';
          osc1.frequency.setValueAtTime(pitch, now);
          osc2.frequency.setValueAtTime(pitch * 1.498, now); // 五度泛音厚度
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(cutoff, now);
          filter.Q.value = 1.4;
          g.gain.setValueAtTime(0.0001, now);
          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(g);
          g.connect(this.masterGain);
          osc1.start(now);
          osc2.start(now);
          d = { osc1, osc2, filter, gain: g };
          this.drones.set(lyr.id, d);
        }
        d.osc1.frequency.setTargetAtTime(pitch, now, 0.04);
        d.osc2.frequency.setTargetAtTime(pitch * 1.498, now, 0.04);
        d.filter.frequency.setTargetAtTime(cutoff, now, 0.04);
        d.gain.gain.setTargetAtTime(gain * 0.24, now, 0.05);
      }

      // 脉冲打击触发检测（支持顺播及循环重播边界）
      const prevT = this._prevTriggers.get(lyr.id) ?? 0;
      const looped = curTime < prevTime;
      const prevSample = looped ? 0 : prevT;
      if (trig >= 0.5 && prevSample < 0.5) {
        this._fireVoice(lyr.audio, gain, pitch, cutoff);
      }
      this._prevTriggers.set(lyr.id, trig);
    }

    // 停止已超出出入点或被静音的持续音色
    for (const [lid, d] of this.drones.entries()) {
      if (!activeDroneIds.has(lid)) {
        try {
          d.gain.gain.setTargetAtTime(0.0001, now, 0.03);
          d.osc1.stop(now + 0.08);
          d.osc2.stop(now + 0.08);
        } catch {}
        this.drones.delete(lid);
      }
    }
  }
}
