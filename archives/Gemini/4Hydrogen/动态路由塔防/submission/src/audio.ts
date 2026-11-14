import type { MapId } from './types';

export type SfxId =
  | 'ui_click'
  | 'ui_hover'
  | 'deploy'
  | 'reject'
  | 'isolate'
  | 'node_break'
  | 'upgrade'
  | 'undeploy'
  | 'laser_rail'
  | 'laser_pierce'
  | 'suppress_shot'
  | 'firewall_hit'
  | 'sandbox_pulse'
  | 'snare_cast'
  | 'failover_cast'
  | 'item_downgrade'
  | 'item_restore'
  | 'encrypt_zap'
  | 'trojan_reveal'
  | 'payload_blast'
  | 'enemy_die'
  | 'boss_warn'
  | 'boss_phase'
  | 'core_hit'
  | 'wave_start'
  | 'victory'
  | 'defeat';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private unlocked = false;
  private muted = false;
  private masterVol = 0.7;
  private musicVol = 0.45;
  private sfxVol = 0.75;
  public exportMode = false;

  private activeTrack: MapId | 'menu' | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private ambientSource: AudioNode | null = null;
  private ambientGain: GainNode | null = null;

  private sfxThrottle: Record<string, number> = {};

  public initGestureListeners(): void {
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.unlocked = true;
      if (this.activeTrack && !this.musicTimer) {
        this.startMusicLoop(this.activeTrack);
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  private ensureContext(): AudioContext | null {
    if (this.exportMode) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.applyVolumes();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended' && this.unlocked) {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.musicVol, now, 0.04);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.04);
  }

  public setSettings(opts: {
    muted?: boolean;
    master?: number;
    music?: number;
    sfx?: number;
  }): void {
    if (opts.muted !== undefined) this.muted = opts.muted;
    if (opts.master !== undefined) this.masterVol = opts.master;
    if (opts.music !== undefined) this.musicVol = opts.music;
    if (opts.sfx !== undefined) this.sfxVol = opts.sfx;
    this.applyVolumes();
  }

  public getSettings() {
    return {
      muted: this.muted,
      master: this.masterVol,
      music: this.musicVol,
      sfx: this.sfxVol,
    };
  }

  public setTrack(track: MapId | 'menu' | null): void {
    if (this.activeTrack === track && this.musicTimer !== null) return;
    this.stopMusic();
    this.activeTrack = track;
    if (track && this.unlocked && !this.exportMode) {
      this.startMusicLoop(track);
    }
  }

  public stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ambientSource) {
      try {
        (this.ambientSource as AudioScheduledSourceNode).stop?.();
      } catch {
        // ignore
      }
      this.ambientSource.disconnect();
      this.ambientSource = null;
    }
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
  }

  private startMusicLoop(track: MapId | 'menu'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;
    this.stopMusic();
    this.musicStep = 0;

    // Continuous ambient bed tailored to map
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      if (track === 'backbone') {
        filter.type = 'bandpass';
        filter.frequency.value = 340;
        filter.Q.value = 1.4;
        gain.gain.value = 0.085;
      } else if (track === 'airgap') {
        filter.type = 'lowpass';
        filter.frequency.value = 190;
        filter.Q.value = 3.0;
        gain.gain.value = 0.11;
      } else if (track === 'intranet') {
        filter.type = 'bandpass';
        filter.frequency.value = 520;
        filter.Q.value = 2.5;
        gain.gain.value = 0.045;
      } else {
        filter.type = 'lowpass';
        filter.frequency.value = 240;
        gain.gain.value = 0.04;
      }

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      src.start();
      this.ambientSource = src;
      this.ambientGain = gain;
    }

    const stepMs =
      track === 'intranet'
        ? 275
        : track === 'backbone'
        ? 310
        : track === 'airgap'
        ? 245
        : 420;

    const scales: Record<MapId | 'menu', number[]> = {
      menu: [110, 130.81, 164.81, 196, 220],
      intranet: [130.81, 155.56, 174.61, 196.0, 233.08, 261.63], // C minor pentatonic
      backbone: [110.0, 130.81, 146.83, 164.81, 196.0, 246.94],  // A minor/dorian expansive
      airgap: [98.0, 103.83, 130.81, 146.83, 155.56, 196.0],     // G phrygian industrial
    };

    const tick = () => {
      if (this.exportMode || !this.ctx || !this.musicGain || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const sc = scales[track];
      const step = this.musicStep++;

      // Bass pulse every 2 or 4 steps
      if (step % 2 === 0) {
        const bassFreq = sc[0] * (step % 8 === 6 ? 1.122 : 1.0) * 0.5;
        this.playSynthNote(bassFreq, 'triangle', 0.22, 0.14, this.musicGain, now, 320);
      }

      // Distinctive 3-map soundscapes & rhythmic ambience
      if (track === 'intranet') {
        // Clean corporate cyber-pulse: crisp digital hi-hat ticks + bright pentatonic arps
        if (step % 2 === 1) {
          this.playNoise(0.035, 5200, 0.016, this.musicGain, now);
        }
        if (step % 2 === 1 || step % 4 === 0) {
          const note = sc[(step * 3 + (step >> 2)) % sc.length] * 2;
          this.playSynthNote(note, 'sine', 0.16, 0.06, this.musicGain, now, 1800);
        }
        if (step % 8 === 0) {
          this.playSynthNote(sc[0] * 2, 'sawtooth', 0.52, 0.032, this.musicGain, now, 720);
        }
        if (step % 16 === 12) {
          this.playSynthNote(sc[4] * 2, 'triangle', 0.42, 0.035, this.musicGain, now, 1100);
        }
      } else if (track === 'backbone') {
        // Expansive inter-city fiber backbone: warm fifth pads + stereo-sweep fiber pings
        if (step % 8 === 0) {
          this.playSynthNote(sc[0] * 1.5, 'sine', 0.95, 0.055, this.musicGain, now, 650);
          this.playSynthNote(sc[3] * 1.5, 'triangle', 0.95, 0.038, this.musicGain, now, 850);
        }
        if (step % 3 === 0) {
          const note = sc[(step * 2) % sc.length] * 1.5;
          this.playSynthNote(note, 'sine', 0.45, 0.055, this.musicGain, now, 1350);
        }
        if (step % 8 === 5) {
          this.playSynthNote(sc[5] * 2, 'sine', 0.28, 0.036, this.musicGain, now, 2200);
        }
      } else if (track === 'airgap') {
        // Tense physical airgap facility: sub-industrial ostinato + chamber turbine + dual sonar
        if (step % 4 === 0) {
          this.playSynthNote(sc[step % 3] * 0.75, 'sawtooth', 0.21, 0.06, this.musicGain, now, 440);
        }
        if (step % 4 === 2) {
          this.playNoise(0.055, 2100, 0.022, this.musicGain, now);
        }
        if (step % 8 === 5) {
          // primary sonar ping
          this.playSynthNote(sc[4] * 3, 'sine', 0.36, 0.048, this.musicGain, now, 2400);
        }
        if (step % 16 === 13) {
          // secondary deep harmonic echo
          this.playSynthNote(sc[2] * 3, 'sine', 0.44, 0.036, this.musicGain, now, 1800);
        }
      } else {
        if (step % 4 === 0) {
          const note = sc[(step / 4) % sc.length] * 2;
          this.playSynthNote(note, 'sine', 0.65, 0.045, this.musicGain, now, 1000);
        }
      }
    };

    this.musicTimer = window.setInterval(tick, stepMs);
  }

  private playSynthNote(
    freq: number,
    type: OscillatorType,
    dur: number,
    vol: number,
    dest: AudioNode,
    startTime: number,
    cutoff = 2000
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  public play(id: SfxId): void {
    if (this.exportMode || !this.unlocked || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;

    const nowMs = performance.now();
    const minGap =
      id === 'laser_rail' || id === 'firewall_hit' || id === 'suppress_shot'
        ? 75
        : id === 'ui_hover'
        ? 95
        : id === 'enemy_die'
        ? 60
        : 25;
    if (nowMs - (this.sfxThrottle[id] ?? 0) < minGap) return;
    this.sfxThrottle[id] = nowMs;

    const t = ctx.currentTime;
    const out = this.sfxGain;

    switch (id) {
      case 'ui_hover':
        this.playTone(960, 1180, 0.035, 'sine', 0.036, out, t);
        break;
      case 'ui_click':
        this.playTone(620, 880, 0.07, 'triangle', 0.12, out, t);
        break;
      case 'deploy':
        this.playTone(320, 640, 0.12, 'triangle', 0.18, out, t);
        this.playTone(640, 960, 0.14, 'sine', 0.14, out, t + 0.06);
        break;
      case 'reject':
        this.playTone(210, 135, 0.16, 'sawtooth', 0.18, out, t);
        this.playTone(175, 110, 0.16, 'sawtooth', 0.16, out, t + 0.08);
        break;
      case 'isolate':
        this.playTone(160, 58, 0.25, 'sawtooth', 0.26, out, t);
        this.playTone(540, 270, 0.18, 'square', 0.12, out, t + 0.02);
        this.playNoise(0.14, 700, 0.16, out, t);
        break;
      case 'node_break':
        this.playNoise(0.32, 1600, 0.28, out, t);
        this.playTone(460, 95, 0.34, 'sawtooth', 0.24, out, t);
        break;
      case 'upgrade':
        this.playTone(440, 660, 0.12, 'triangle', 0.16, out, t);
        this.playTone(660, 880, 0.15, 'triangle', 0.16, out, t + 0.08);
        this.playTone(880, 1320, 0.22, 'sine', 0.14, out, t + 0.16);
        break;
      case 'undeploy':
        this.playTone(580, 260, 0.15, 'sine', 0.14, out, t);
        break;
      case 'laser_rail':
        this.playTone(1350, 420, 0.09, 'sawtooth', 0.09, out, t);
        break;
      case 'laser_pierce':
        this.playTone(1900, 320, 0.15, 'sawtooth', 0.13, out, t);
        this.playTone(950, 1450, 0.12, 'sine', 0.08, out, t);
        break;
      case 'suppress_shot':
        this.playTone(480, 180, 0.08, 'square', 0.08, out, t);
        break;
      case 'firewall_hit':
        this.playTone(220, 110, 0.08, 'triangle', 0.1, out, t);
        break;
      case 'sandbox_pulse':
        this.playTone(380, 760, 0.22, 'sine', 0.11, out, t);
        this.playNoise(0.12, 2400, 0.06, out, t);
        break;
      case 'snare_cast':
        this.playTone(820, 280, 0.28, 'sawtooth', 0.16, out, t);
        this.playTone(1240, 620, 0.22, 'sine', 0.12, out, t + 0.05);
        break;
      case 'failover_cast':
        this.playTone(523.25, 783.99, 0.22, 'sine', 0.18, out, t);
        this.playTone(659.25, 1046.5, 0.3, 'triangle', 0.16, out, t + 0.07);
        break;
      case 'item_downgrade':
        this.playNoise(0.28, 1200, 0.18, out, t);
        this.playTone(640, 220, 0.3, 'sawtooth', 0.14, out, t);
        break;
      case 'item_restore':
        this.playTone(440, 880, 0.18, 'sine', 0.16, out, t);
        this.playTone(660, 1320, 0.25, 'sine', 0.15, out, t + 0.07);
        break;
      case 'encrypt_zap':
        this.playTone(720, 240, 0.14, 'square', 0.11, out, t);
        break;
      case 'trojan_reveal':
        this.playTone(900, 1480, 0.11, 'triangle', 0.12, out, t);
        break;
      case 'payload_blast':
        this.playNoise(0.25, 900, 0.26, out, t);
        this.playTone(180, 52, 0.26, 'sawtooth', 0.24, out, t);
        break;
      case 'enemy_die':
        this.playTone(340, 120, 0.1, 'triangle', 0.09, out, t);
        break;
      case 'boss_warn':
        this.playTone(280, 520, 0.28, 'sawtooth', 0.2, out, t);
        this.playTone(280, 520, 0.28, 'sawtooth', 0.2, out, t + 0.32);
        break;
      case 'boss_phase':
        this.playTone(140, 420, 0.45, 'sawtooth', 0.24, out, t);
        this.playNoise(0.35, 1400, 0.18, out, t);
        break;
      case 'core_hit':
        this.playTone(240, 110, 0.22, 'square', 0.22, out, t);
        this.playTone(480, 220, 0.18, 'sawtooth', 0.14, out, t + 0.05);
        break;
      case 'wave_start':
        this.playTone(330, 495, 0.14, 'triangle', 0.16, out, t);
        this.playTone(495, 660, 0.22, 'triangle', 0.16, out, t + 0.1);
        break;
      case 'victory':
        this.playTone(523.25, 523.25, 0.14, 'triangle', 0.18, out, t);
        this.playTone(659.25, 659.25, 0.14, 'triangle', 0.18, out, t + 0.12);
        this.playTone(783.99, 783.99, 0.18, 'triangle', 0.18, out, t + 0.24);
        this.playTone(1046.5, 1046.5, 0.45, 'sine', 0.22, out, t + 0.38);
        break;
      case 'defeat':
        this.playTone(320, 220, 0.22, 'sawtooth', 0.18, out, t);
        this.playTone(220, 140, 0.28, 'sawtooth', 0.18, out, t + 0.22);
        this.playTone(140, 75, 0.45, 'sawtooth', 0.2, out, t + 0.48);
        break;
    }
  }

  private playTone(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode,
    t: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private playNoise(
    dur: number,
    cutoff: number,
    vol: number,
    dest: AudioNode,
    t: number
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoff, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const audio = new AudioEngine();
