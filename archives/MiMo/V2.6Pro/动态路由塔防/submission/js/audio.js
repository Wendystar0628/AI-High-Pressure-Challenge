/* audio.js — WebAudio 合成音效与音乐（无外部音频文件） */
(function(){
'use strict';
const G = window.G;

class AudioSys {
  constructor(){
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.volumes = { master:0.7, music:0.5, sfx:0.8 };
    this._musicNodes = [];
    this._musicTimer = 0;
    this._currentMusic = null;
    this._started = false;
  }
  init(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volumes.master * (this.enabled?1:0);
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.volumes.music;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.volumes.sfx;
    this.sfxGain.connect(this.master);
  }
  resume(){
    this.init();
    if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this._started = true;
  }
  setVolume(kind, v){
    this.volumes[kind] = v;
    if(kind==='master' && this.master) this.master.gain.value = v * (this.enabled?1:0);
    if(kind==='music' && this.musicGain) this.musicGain.gain.value = v;
    if(kind==='sfx' && this.sfxGain) this.sfxGain.gain.value = v;
  }
  setMute(m){
    this.enabled = !m;
    if(this.master) this.master.gain.value = this.volumes.master * (this.enabled?1:0);
  }

  // ---- 基础合成 ----
  _osc(type, freq, t0, dur, gain, dest, detune){
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if(detune) o.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(dest||this.sfxGain);
    o.start(t0); o.stop(t0+dur+0.02);
    return o;
  }
  _noise(t0, dur, gain, filterFreq, dest){
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type='lowpass'; f.frequency.value = filterFreq||2000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    src.connect(f); f.connect(g); g.connect(dest||this.sfxGain);
    src.start(t0); src.stop(t0+dur);
  }

  // ---- 音效 ----
  sfx(name, opts){
    if(!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const v = (opts&&opts.vol) || 1;
    switch(name){
      case 'click':
        this._osc('square', 880, t, 0.06, 0.12*v);
        this._osc('square', 1320, t, 0.04, 0.08*v);
        break;
      case 'deploy':
        this._osc('sine', 220, t, 0.18, 0.18*v);
        this._osc('sine', 330, t+0.06, 0.18, 0.15*v);
        this._osc('triangle', 440, t+0.12, 0.22, 0.12*v);
        break;
      case 'upgrade':
        this._osc('triangle', 440, t, 0.12, 0.15*v);
        this._osc('triangle', 554, t+0.08, 0.12, 0.15*v);
        this._osc('triangle', 659, t+0.16, 0.25, 0.16*v);
        break;
      case 'sell':
        this._osc('sawtooth', 300, t, 0.15, 0.12*v);
        this._osc('sawtooth', 180, t+0.08, 0.2, 0.12*v);
        break;
      case 'shoot':
        this._osc('square', 680, t, 0.07, 0.07*v);
        this._noise(t, 0.05, 0.05*v, 3000);
        break;
      case 'shoot_heavy':
        this._osc('sawtooth', 180, t, 0.14, 0.12*v);
        this._noise(t, 0.1, 0.08*v, 1800);
        break;
      case 'hit':
        this._noise(t, 0.06, 0.09*v, 2400);
        break;
      case 'explode':
        this._noise(t, 0.35, 0.16*v, 900);
        this._osc('sine', 90, t, 0.3, 0.12*v);
        break;
      case 'enemy_die':
        this._noise(t, 0.18, 0.11*v, 1400);
        this._osc('triangle', 240, t, 0.16, 0.1*v);
        this._osc('triangle', 140, t+0.06, 0.18, 0.09*v);
        break;
      case 'tower_hit':
        this._noise(t, 0.08, 0.1*v, 800);
        this._osc('square', 160, t, 0.1, 0.08*v);
        break;
      case 'tower_down':
        this._noise(t, 0.4, 0.15*v, 600);
        this._osc('sawtooth', 120, t, 0.35, 0.12*v);
        this._osc('sawtooth', 70, t+0.1, 0.4, 0.1*v);
        break;
      case 'leak':
        this._osc('sawtooth', 200, t, 0.25, 0.13*v);
        this._osc('sawtooth', 150, t+0.12, 0.3, 0.12*v);
        this._noise(t, 0.25, 0.08*v, 700);
        break;
      case 'heal':
        this._osc('sine', 520, t, 0.15, 0.1*v);
        this._osc('sine', 660, t+0.08, 0.15, 0.1*v);
        this._osc('sine', 780, t+0.16, 0.2, 0.09*v);
        break;
      case 'shield':
        this._osc('sine', 700, t, 0.18, 0.11*v);
        this._osc('sine', 900, t+0.05, 0.2, 0.08*v);
        break;
      case 'encrypt':
        this._osc('square', 220, t, 0.16, 0.1*v);
        this._osc('square', 165, t+0.08, 0.2, 0.1*v);
        break;
      case 'isolate':
        this._osc('triangle', 300, t, 0.16, 0.13*v);
        this._osc('triangle', 220, t+0.08, 0.2, 0.12*v);
        this._noise(t, 0.15, 0.06*v, 1000);
        break;
      case 'release':
        this._osc('triangle', 220, t, 0.16, 0.12*v);
        this._osc('triangle', 330, t+0.08, 0.2, 0.12*v);
        break;
      case 'skill':
        this._osc('triangle', 400, t, 0.12, 0.13*v);
        this._osc('triangle', 500, t+0.07, 0.12, 0.13*v);
        this._osc('triangle', 640, t+0.14, 0.22, 0.13*v);
        this._noise(t, 0.2, 0.05*v, 2000);
        break;
      case 'item':
        this._osc('square', 520, t, 0.1, 0.1*v);
        this._osc('square', 780, t+0.07, 0.14, 0.1*v);
        break;
      case 'wave':
        this._osc('sawtooth', 180, t, 0.3, 0.11*v);
        this._osc('sawtooth', 240, t+0.15, 0.35, 0.11*v);
        break;
      case 'warn':
        this._osc('square', 440, t, 0.12, 0.12*v);
        this._osc('square', 330, t+0.14, 0.12, 0.12*v);
        this._osc('square', 440, t+0.28, 0.14, 0.12*v);
        break;
      case 'boss':
        this._osc('sawtooth', 80, t, 0.6, 0.14*v);
        this._osc('sawtooth', 60, t+0.2, 0.8, 0.13*v);
        this._noise(t, 0.5, 0.1*v, 400);
        break;
      case 'error':
        this._osc('square', 200, t, 0.1, 0.1*v);
        this._osc('square', 150, t+0.1, 0.14, 0.1*v);
        break;
      case 'ui_open':
        this._osc('sine', 600, t, 0.08, 0.08*v);
        break;
      case 'ui_close':
        this._osc('sine', 400, t, 0.08, 0.08*v);
        break;
      case 'victory':
        [440,554,659,880].forEach((f,i)=>this._osc('triangle', f, t+i*0.14, 0.4, 0.13*v));
        break;
      case 'defeat':
        [330,262,220,165].forEach((f,i)=>this._osc('sawtooth', f, t+i*0.18, 0.5, 0.12*v));
        break;
      case 'ping':
        this._osc('sine', 1200, t, 0.12, 0.06*v);
        break;
    }
  }

  // ---- 音乐 ----
  playMusic(style){
    this.init();
    if(!this.ctx) return;
    this.stopMusic();
    this._currentMusic = style || 'menu';
    const t = this.ctx.currentTime;
    // 基础氛围垫
    const pad = this.ctx.createGain(); pad.gain.value = 0.0;
    pad.connect(this.musicGain);
    pad.gain.linearRampToValueAtTime(0.16, t+1.2);
    this._musicNodes.push(pad);
    const freqs = style==='map3' ? [55,82.4,110] : style==='map2' ? [65.4,98,130.8] : [61.7,92.5,123.5];
    freqs.forEach((f,i)=>{
      const o = this.ctx.createOscillator();
      o.type = i===0?'sine':'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain(); g.gain.value = 0.1/(i+1);
      o.connect(g); g.connect(pad); o.start(t);
      this._musicNodes.push(o,g);
    });
    // 缓慢脉冲
    this._musicTimer = setInterval(()=>{
      if(!this.ctx || !this.enabled) return;
      const tt = this.ctx.currentTime;
      const base = style==='map3'?110:style==='map2'?98:92.5;
      const notes = style==='map3'?[1,1.2,1.5,1.8]:style==='map2'?[1,1.25,1.5,2]:[1,1.2,1.5,1.8];
      const n = notes[Math.floor(Math.random()*notes.length)];
      this._osc('triangle', base*n, tt, 1.6, 0.035, this.musicGain);
      if(Math.random()<0.4) this._osc('sine', base*n*2, tt+0.8, 1.2, 0.02, this.musicGain);
    }, style==='map2'?2200:2800);
    this._musicNodes.push({stop:()=>clearInterval(this._musicTimer)});
  }
  stopMusic(){
    this._musicNodes.forEach(n=>{ try{ if(n.stop) n.stop(); else if(n.disconnect) n.disconnect(); }catch(e){} });
    this._musicNodes = [];
    if(this._musicTimer){ clearInterval(this._musicTimer); this._musicTimer=0; }
    this._currentMusic = null;
  }
}

G.audio = new AudioSys();

// 首次交互解锁
function unlock(){ G.audio.resume(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); }
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

})();
