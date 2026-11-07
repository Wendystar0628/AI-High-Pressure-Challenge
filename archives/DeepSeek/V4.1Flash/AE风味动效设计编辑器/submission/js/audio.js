/* PRISM audio: synthesized tone layers, imported audio, meters, export stream */
(function () {
  const AE = window.AE, U = AE.U, E = AE.Eval, P = AE.P;
  const A = (AE.Audio = {});
  const INSTRUMENTS = {
    pad: { wave: 'sawtooth', filter: 1200, attack: 1.2, release: 2.2, gain: .12, detune: 8 },
    pluck: { wave: 'triangle', filter: 4200, attack: .005, release: .42, gain: .16, detune: 3 },
    bass: { wave: 'sine', filter: 400, attack: .02, release: .5, gain: .22, detune: 0 },
    shimmer: { wave: 'sine', filter: 9000, attack: .08, release: 1.4, gain: .08, detune: 12 },
    impact: { wave: 'sine', filter: 900, attack: .004, release: 1.8, gain: .5, detune: 0 },
    whoosh: { wave: 'noise', filter: 2400, attack: .35, release: 1.3, gain: .22, detune: 0 },
    tick: { wave: 'square', filter: 7000, attack: .002, release: .09, gain: .05, detune: 0 }
  };
  A.INSTRUMENTS = INSTRUMENTS;

  class AudioEngine {
    constructor() {
      this.ctx = null; this.master = null; this.musicBus = null; this.sfxBus = null; this.analyser = null;
      this.sources = []; this.scheduled = []; this.buffers = new Map(); this.ready = false;
      this.exportDest = null; this.playing = false; this.startTime = 0; this.startCompTime = 0;
      this.meterData = new Uint8Array(256);
    }
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this.ctx = new Ctx({ latencyHint: 'interactive' });
      this.master = ctx.createGain(); this.master.gain.value = .9;
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = .78;
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = .9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .22;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512;
      this.musicBus.connect(comp); this.sfxBus.connect(comp); comp.connect(this.master);
      this.master.connect(this.analyser); this.analyser.connect(ctx.destination);
      this.reverb = ctx.createConvolver(); this.reverb.buffer = this._impulse(2.6, 2.8); this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = .35;
      this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
      this.delay = ctx.createDelay(.8); this.delay.delayTime.value = .36;
      this.delayFb = ctx.createGain(); this.delayFb.gain.value = .32;
      this.delay.connect(this.delayFb); this.delayFb.connect(this.delay);
      this.delayWet = ctx.createGain(); this.delayWet.gain.value = .18; this.delay.connect(this.delayWet); this.delayWet.connect(this.master);
      this.ready = true;
    }
    _impulse(duration, decay) {
      const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * duration);
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 60 ? i / 60 : 1);
        }
      }
      return buf;
    }
    setProject(project) { this.project = project; }
    level() {
      if (!this.analyser || !this.ctx) return 0;
      this.analyser.getByteTimeDomainData(this.meterData);
      let sum = 0;
      for (let i = 0; i < this.meterData.length; i++) { const v = (this.meterData[i] - 128) / 128; sum += v * v; }
      return Math.min(1, Math.sqrt(sum / this.meterData.length) * 2.6);
    }
    stopAll() {
      for (const s of this.sources) { try { s.stop(); } catch (e) { } }
      this.sources = []; this.scheduled = [];
      this.playing = false;
    }
    schedule(project, comp, fromTime) {
      this.init();
      if (!this.ready) return;
      this.stopAll();
      this.project = project; this.comp = comp;
      this.playing = true;
      const now = this.ctx.currentTime + .035;
      this.startTime = now; this.startCompTime = fromTime;
      // tone layers
      for (const layer of comp.layers) {
        if (layer.type !== 'tone' || !layer.visible) continue;
        if (fromTime > layer.outPoint + .01) continue;
        const vol = (layer.props['tone.volume'] ? E.num(layer.props['tone.volume'].value) : 80) / 100;
        const pan = (layer.props['tone.pan'] ? E.num(layer.props['tone.pan'].value) : 0) / 100;
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (panner) panner.pan.value = U.clamp(pan, -1, 1);
        const layerGain = this.ctx.createGain(); layerGain.gain.value = vol;
        if (panner) { layerGain.connect(panner); panner.connect(this.musicBus); } else layerGain.connect(this.musicBus);
        const notes = this._notesFor(layer);
        for (const note of notes) {
          if (note.t + (note.dur || 0) < fromTime) continue;
          const when = now + Math.max(0, note.t - fromTime);
          this._scheduleNote(layer, note, when, layerGain, note.t < fromTime);
        }
        if (layer.type === 'tone') {
          // imported audio layers handled separately
        }
      }
      // audio layers
      for (const layer of comp.layers) {
        if (layer.type !== 'audio' || !layer.visible) continue;
        const asset = project.assets.find(a => a.id === (layer.audio && layer.audio.assetId));
        if (!asset) continue;
        const buf = this.buffers.get(asset.id);
        if (!buf) continue;
        const when = now + Math.max(0, layer.inPoint - fromTime);
        if (layer.outPoint < fromTime) continue;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const gain = this.ctx.createGain(); gain.gain.value = (layer.props['audio.volume'] ? E.num(layer.props['audio.volume'].value) : 100) / 100;
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (panner) { panner.pan.value = U.clamp((layer.props['audio.pan'] ? E.num(layer.props['audio.pan'].value) : 0) / 100, -1, 1); src.connect(gain); gain.connect(panner); panner.connect(this.musicBus); }
        else { src.connect(gain); gain.connect(this.musicBus); }
        src.start(when, Math.max(0, fromTime - layer.inPoint));
        this.sources.push(src);
      }
    }
    _notesFor(layer) {
      if (layer.tone.notes && layer.tone.notes.length) return layer.tone.notes;
      if (layer.tone.pattern) return this._patternNotes(layer.tone.pattern, layer.tone.seed, layer.tone.instrument);
      return [];
    }
    _patternNotes(pattern, seed, instrument) {
      const notes = [];
      const rnd = U.seedRand(seed || 7);
      if (pattern === 'arp') {
        const scale = [0, 3, 5, 7, 10, 12, 15, 19];
        for (let i = 0; i < 64; i++) notes.push({ t: .18 + i * .2875, dur: .18, midi: 48 + scale[Math.floor(rnd() * scale.length)] + 12, vel: .5 + rnd() * .3 });
      } else if (pattern === 'pulse') {
        for (let i = 0; i < 64; i++) if (i % 2 === 0) notes.push({ t: i * .234, dur: .1, midi: 36 + (i % 8 === 0 ? 0 : -5), vel: .7 });
      }
      return notes;
    }
    _midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    _scheduleNote(layer, note, when, dest, midOffset) {
      const ctx = this.ctx, inst = INSTRUMENTS[layer.tone.instrument] || INSTRUMENTS.pluck;
      const dur = Math.max(.05, note.dur || .4), vel = note.vel == null ? .7 : note.vel;
      const midi = note.midi + (layer.props['tone.octave'] ? E.num(layer.props['tone.octave'].value) : 0) * 12;
      const freq = this._midiHz(midi);
      const out = ctx.createGain();
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(inst.filter, when); filter.Q.value = .8;
      filter.connect(out); out.connect(dest);
      const attack = Math.min(inst.attack, dur * .7), release = Math.min(inst.release, dur * .8);
      out.gain.setValueAtTime(0, when);
      out.gain.linearRampToValueAtTime(vel * inst.gain, when + attack + .005);
      out.gain.setTargetAtTime(vel * inst.gain * .52, when + attack + .01, Math.max(.05, dur * .5));
      out.gain.setTargetAtTime(0, when + dur, Math.max(.03, release * .35));
      const sources = [];
      if (inst.wave === 'noise') {
        const len = Math.floor(ctx.sampleRate * Math.max(dur, .5)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = false;
        filter.frequency.setValueAtTime(120, when); filter.frequency.exponentialRampToValueAtTime(4200 + (note.midi || 0) * 30, when + .3); filter.frequency.exponentialRampToValueAtTime(300, when + Math.min(dur, 1.6));
        ns.connect(filter); ns.start(when); sources.push(ns);
      } else {
        const detunes = inst.detune ? [-inst.detune, inst.detune] : [0];
        for (const dt of detunes) {
          const o = ctx.createOscillator(); o.type = inst.wave; o.frequency.setValueAtTime(freq, when); o.detune.value = dt;
          (o.frequency).setValueAtTime(freq, when);
          if (layer.tone.instrument === 'impact') { o.frequency.setValueAtTime(freq * 2.1, when); o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * .35), when + .6); }
          o.connect(filter); o.start(when); o.stop(when + dur + release + .2); sources.push(o);
        }
      }
      this.sources.push(...sources);
      if (layer.tone.instrument === 'pluck' || layer.tone.instrument === 'shimmer') {
        const send = ctx.createGain(); send.gain.value = .22; out.connect(send); send.connect(this.reverb);
      }
      if (layer.tone.instrument === 'impact') {
        const send = ctx.createGain(); send.gain.value = .3; out.connect(send); send.connect(this.reverb);
      }
    }
    async importAudio(file, project) {
      this.init();
      if (!this.ctx) throw new Error('音频不可用');
      const data = await U.readFileAsArrayBuffer(file);
      const buf = await this.ctx.decodeAudioData(data.slice(0));
      const id = U.uid('asset');
      project.assets.push({ id, name: file.name, type: 'audio', mime: file.type, duration: buf.duration, size: file.size, dataUrl: await U.blobToBase64(new Blob([data], { type: file.type })), });
      this.buffers.set(id, buf);
      return id;
    }
    async ensureBuffer(project, asset) {
      if (this.buffers.has(asset.id)) return this.buffers.get(asset.id);
      if (!this.ctx) this.init();
      if (!this.ctx || !asset.dataUrl) return null;
      const res = await fetch(asset.dataUrl); const ab = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(ab);
      this.buffers.set(asset.id, buf);
      return buf;
    }
    connectExport() {
      this.init();
      if (!this.ready) return null;
      if (!this.exportDest) {
        this.exportDest = this.ctx.createMediaStreamDestination();
        this.master.connect(this.exportDest);
      }
      return this.exportDest.stream;
    }
    disconnectExport() {
      if (this.exportDest) { try { this.exportDest.stream.getTracks().forEach(t => t.stop()); } catch (e) { } this.exportDest = null; }
    }
  }

  A.engine = new AudioEngine();
  AE.AudioEngine = AudioEngine;
})();
