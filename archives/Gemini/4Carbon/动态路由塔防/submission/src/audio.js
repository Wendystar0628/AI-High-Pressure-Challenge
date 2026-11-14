// 自制程序化 Web Audio 合成器：三图专属环境声与音乐 + 全套塔/敌/首领/道具/系统/界面音效

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.volume = 0.65;
    this.muted = false;
    this.unlocked = false;
    this.currentTheme = null;
    this.seqTimer = null;
    this.ambientNodes = [];
    this.stepIndex = 0;
    this.lastPlayTime = new Map();
    this.suppressSfx = false; // 视频导出帧步进时静音避免爆音
    this._bindUnlock();
  }

  _bindUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx && this.ctx.state === 'running') {
        this.unlocked = true;
        if (this.pendingTheme && !this.currentTheme) {
          this.setTheme(this.pendingTheme);
        }
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  ensureContext() {
    if (this.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.gain.value = 0.34;
      this.sfxGain.gain.value = 0.78;
      this.masterGain.gain.value = this.muted ? 0 : this.volume;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // 预生成白噪声缓冲用于冲击、气流和爆炸音效
      const sr = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, sr * 1.5, sr);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } catch (_) {
      this.ctx = null;
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  stopTheme() {
    if (this.seqTimer) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
    for (const n of this.ambientNodes) {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch (_) {}
    }
    this.ambientNodes = [];
    this.currentTheme = null;
  }

  setTheme(theme) {
    this.pendingTheme = theme;
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.currentTheme === theme) return;
    this.stopTheme();
    this.currentTheme = theme;
    this.stepIndex = 0;
    if (!theme || theme === 'none') return;

    const now = this.ctx.currentTime;

    // 1. 构建各图专属持续环境声底噪 (Ambient Bed)
    if (theme === 'menu') {
      this._createDrone(110, 'sine', 0.12);
      this._createDrone(164.81, 'triangle', 0.06);
      this.seqTimer = setInterval(() => this._tickMenu(), 650);
    } else if (theme === 'enterprise') {
      // 企业机房低频风冷嗡鸣 + 高频交换微脉冲
      this._createDrone(73.42, 'sine', 0.14); // D2
      this._createFilteredNoise('bandpass', 420, 3.0, 0.035);
      this.seqTimer = setInterval(() => this._tickEnterprise(), 275); // ~109 BPM 16th/8th
    } else if (theme === 'backbone') {
      // 跨网公网洪流宽频流动声 + 双活谐振低音
      this._createDrone(92.5, 'sawtooth', 0.06, 260); // F#2 filtered
      this._createFilteredNoise('bandpass', 780, 1.8, 0.05, 0.22); // 带 LFO 扫频的数据河流声
      this.seqTimer = setInterval(() => this._tickBackbone(), 240); // ~125 BPM
    } else if (theme === 'industrial') {
      // 工控气隙深井电磁变压器低频轰鸣
      this._createDrone(65.41, 'sawtooth', 0.08, 190); // C2
      this._createDrone(98.0, 'sine', 0.07);
      this._createFilteredNoise('lowpass', 240, 4.0, 0.055);
      this.seqTimer = setInterval(() => this._tickIndustrial(), 265); // ~113 BPM
    }
  }

  _createDrone(freq, type, gainVal, filterFreq = 0) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gainVal;
    if (filterFreq > 0) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      osc.connect(f);
      f.connect(g);
      this.ambientNodes.push(f);
    } else {
      osc.connect(g);
    }
    g.connect(this.musicGain);
    osc.start();
    this.ambientNodes.push(osc, g);
  }

  _createFilteredNoise(filterType, freq, q, gainVal, lfoRate = 0) {
    if (!this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gainVal;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    src.start();
    this.ambientNodes.push(src, filter, g);

    if (lfoRate > 0) {
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = lfoRate;
      lfoGain.gain.value = freq * 0.45;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.ambientNodes.push(lfo, lfoGain);
    }
  }

  _playMusicNote(freq, dur, type = 'triangle', vol = 0.12, cutoff = 1800) {
    if (!this.ctx || this.muted || this.suppressSfx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(cutoff, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.25), t + dur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(flt);
    flt.connect(g);
    g.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _tickMenu() {
    const notes = [220, 261.63, 329.63, 392.0, 329.63, 293.66, 246.94, 196.0];
    const f = notes[this.stepIndex++ % notes.length];
    this._playMusicNote(f, 0.55, 'sine', 0.09, 1200);
  }

  _tickEnterprise() {
    // D Dorian 科技感琶音: D3 F3 A3 C4 E4 A3 F3 G3
    const arp = [146.83, 174.61, 220.0, 261.63, 329.63, 220.0, 174.61, 196.0, 146.83, 220.0, 293.66, 261.63, 220.0, 174.61, 164.81, 130.81];
    const i = this.stepIndex++;
    const f = arp[i % arp.length];
    this._playMusicNote(f, 0.22, 'triangle', 0.11, 1900);
    if (i % 4 === 0) {
      this._playMusicNote(73.42, 0.32, 'sawtooth', 0.09, 420);
    }
  }

  _tickBackbone() {
    // F# Minor 高速骨干脉冲
    const arp = [185.0, 220.0, 277.18, 369.99, 329.63, 277.18, 246.94, 220.0, 164.81, 220.0, 277.18, 440.0, 369.99, 277.18, 246.94, 185.0];
    const i = this.stepIndex++;
    this._playMusicNote(arp[i % arp.length], 0.19, 'sawtooth', 0.085, 2200);
    if (i % 2 === 0) {
      this._playMusicNote(i % 8 < 4 ? 92.5 : 82.41, 0.18, 'square', 0.06, 380);
    }
  }

  _tickIndustrial() {
    // C Phrygian 工控压迫感律动: C Db G Ab C
    const bass = [65.41, 65.41, 69.3, 65.41, 98.0, 65.41, 103.83, 77.78];
    const lead = [261.63, 0, 277.18, 392.0, 0, 311.13, 261.63, 0];
    const i = this.stepIndex++;
    this._playMusicNote(bass[i % bass.length], 0.24, 'sawtooth', 0.11, 480);
    const lf = lead[i % lead.length];
    if (lf > 0) {
      this._playMusicNote(lf, 0.28, 'triangle', 0.075, 1600);
    }
  }

  _canPlay(id, minGapMs = 45) {
    if (this.suppressSfx || this.muted) return false;
    this.ensureContext();
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const now = performance.now();
    const prev = this.lastPlayTime.get(id) || 0;
    if (now - prev < minGapMs) return false;
    this.lastPlayTime.set(id, now);
    return true;
  }

  play(id) {
    if (!this._canPlay(id, id.startsWith('hit') || id.startsWith('shot') ? 55 : 35)) return;
    const t = this.ctx.currentTime;

    switch (id) {
      case 'ui_hover':
        this._tone(980, 1180, 0.035, 'sine', 0.06);
        break;
      case 'ui_click':
        this._tone(620, 920, 0.06, 'triangle', 0.14);
        break;
      case 'deploy':
        this._tone(240, 520, 0.11, 'triangle', 0.22);
        this._tone(520, 780, 0.14, 'sine', 0.16, 0.05);
        break;
      case 'isolate_lock':
        // 沉重机械闸门锁闭声
        this._tone(180, 72, 0.18, 'sawtooth', 0.26);
        this._noiseBurst(0.12, 650, 0.18);
        this._tone(660, 440, 0.12, 'square', 0.12, 0.06);
        break;
      case 'bypass_open':
        // 节点旁路直通告警
        this._noiseBurst(0.24, 900, 0.28);
        this._tone(540, 210, 0.26, 'sawtooth', 0.24);
        this._tone(420, 180, 0.22, 'square', 0.18, 0.12);
        break;
      case 'upgrade':
        this._tone(440, 660, 0.12, 'triangle', 0.2);
        this._tone(660, 880, 0.14, 'triangle', 0.2, 0.08);
        this._tone(880, 1174, 0.22, 'sine', 0.22, 0.16);
        break;
      case 'sell':
        this._tone(580, 240, 0.16, 'triangle', 0.18);
        break;
      case 'error':
        this._tone(190, 145, 0.14, 'sawtooth', 0.24);
        this._tone(165, 130, 0.16, 'sawtooth', 0.24, 0.11);
        break;
      case 'shot_interceptor':
        this._tone(1350, 480, 0.075, 'sawtooth', 0.13);
        break;
      case 'shot_rail':
        this._tone(1850, 260, 0.16, 'sawtooth', 0.22);
        this._noiseBurst(0.09, 2200, 0.16);
        break;
      case 'shot_suppress':
        this._tone(1120, 680, 0.055, 'square', 0.1);
        break;
      case 'shot_firewall':
        this._tone(240, 95, 0.1, 'triangle', 0.17);
        this._noiseBurst(0.06, 700, 0.1);
        break;
      case 'shot_sandbox':
        this._tone(680, 320, 0.14, 'sine', 0.16);
        this._tone(1020, 510, 0.12, 'triangle', 0.11, 0.03);
        break;
      case 'heal':
        this._tone(523.25, 783.99, 0.13, 'sine', 0.11);
        break;
      case 'skill_failover':
        // 冗余切换：清脆净化和弦
        this._tone(523.25, 523.25, 0.32, 'triangle', 0.2);
        this._tone(659.25, 659.25, 0.32, 'triangle', 0.18, 0.05);
        this._tone(783.99, 1046.5, 0.38, 'sine', 0.22, 0.1);
        break;
      case 'skill_entrap':
        this._tone(880, 440, 0.2, 'square', 0.16);
        this._tone(660, 990, 0.18, 'sine', 0.16, 0.06);
        break;
      case 'skill_scan':
        this._tone(420, 1480, 0.28, 'sine', 0.2);
        break;
      case 'item_downgrade':
        this._tone(920, 230, 0.34, 'sawtooth', 0.22);
        break;
      case 'item_restore':
        this._tone(440, 880, 0.26, 'sine', 0.22);
        break;
      case 'enemy_split':
        this._tone(360, 740, 0.09, 'sine', 0.14);
        break;
      case 'enemy_slam':
        this._tone(130, 48, 0.18, 'sawtooth', 0.25);
        this._noiseBurst(0.12, 400, 0.2);
        break;
      case 'trojan_reveal':
        this._tone(960, 1420, 0.09, 'triangle', 0.14);
        break;
      case 'trojan_explode':
        this._noiseBurst(0.25, 650, 0.28);
        this._tone(220, 65, 0.24, 'sawtooth', 0.24);
        break;
      case 'encrypt_lock':
        this._tone(740, 370, 0.13, 'square', 0.16);
        this._tone(510, 255, 0.13, 'square', 0.16, 0.07);
        break;
      case 'core_leak':
        this._tone(320, 110, 0.32, 'sawtooth', 0.3);
        this._tone(240, 90, 0.32, 'square', 0.24, 0.08);
        break;
      case 'boss_warn':
        this._tone(440, 620, 0.24, 'sawtooth', 0.24);
        this._tone(440, 620, 0.24, 'sawtooth', 0.24, 0.28);
        break;
      case 'boss_spawn':
        this._tone(110, 55, 0.65, 'sawtooth', 0.32);
        this._noiseBurst(0.4, 350, 0.24);
        break;
      case 'route_shift':
        this._tone(480, 720, 0.12, 'sine', 0.15);
        this._tone(720, 600, 0.12, 'sine', 0.12, 0.07);
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          this._tone(f, f, 0.3, 'triangle', 0.2, idx * 0.1);
        });
        break;
      case 'defeat':
        [349.23, 311.13, 277.18, 207.65].forEach((f, idx) => {
          this._tone(f, f * 0.96, 0.35, 'sawtooth', 0.2, idx * 0.14);
        });
        break;
      default:
        this._tone(500, 650, 0.06, 'sine', 0.1);
    }
  }

  _tone(fStart, fEnd, dur, type = 'sine', vol = 0.15, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, fStart), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noiseBurst(dur, cutoff = 1000, vol = 0.2) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(cutoff, t);
    flt.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const sound = new SoundEngine();
