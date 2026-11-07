/* =========================================================================
   audio.js — WebAudio synth driven by 音色 (tone) layers + visual level meter
   ========================================================================= */
(function(AE){
'use strict';
let lastT=-1,meterCanvas=null,meterCtx=null;

AE.Audio={
  ctx:null,master:null,lastT:-1,level:0,
  init(){
    this.lastT=-1;
    const tr=document.querySelector('#transport .tr-right');
    if(tr&&!meterCanvas){
      meterCanvas=document.createElement('canvas');
      meterCanvas.id='audioMeter';meterCanvas.width=120;meterCanvas.height=22;
      meterCanvas.style.cssText='width:120px;height:22px;border-radius:4px;background:var(--bg0);border:1px solid var(--line)';
      meterCtx=meterCanvas.getContext('2d');
      tr.insertBefore(meterCanvas,tr.querySelector('.fps-badge'));
    }
    const wake=()=>this.ensure();
    window.addEventListener('pointerdown',wake,{once:true});
    window.addEventListener('keydown',wake,{once:true});
  },
  ensure(){
    if(!this.ctx){
      try{
        this.ctx=new (window.AudioContext||window.webkitAudioContext)();
        this.master=this.ctx.createGain();this.master.gain.value=0.32;
        const comp=this.ctx.createDynamicsCompressor();
        this.master.connect(comp);comp.connect(this.ctx.destination);
      }catch(e){return;}
    }
    if(this.ctx.state==='suspended')this.ctx.resume();
  },
  tone(freq,dur,wave,gain,when,pan){
    if(!this.ctx)return;
    const c=this.ctx,t0=when===undefined?c.currentTime:when;
    const o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner?c.createStereoPanner():null;
    o.type=wave||'sine';o.frequency.setValueAtTime(freq,t0);
    if(wave==='pluck')o.frequency.exponentialRampToValueAtTime(freq*0.995,t0+dur);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,gain),t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g);
    if(p){p.pan.value=pan||0;g.connect(p);p.connect(this.master);}else g.connect(this.master);
    o.start(t0);o.stop(t0+dur+0.02);
  },
  noiseHit(dur,gain,when){
    if(!this.ctx)return;const c=this.ctx,t0=when===undefined?c.currentTime:when;
    const n=Math.floor(c.sampleRate*dur),buf=c.createBuffer(1,n,c.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
    const s=c.createBufferSource();s.buffer=buf;
    const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=2600;f.Q.value=0.9;
    const g=c.createGain();g.gain.value=gain;
    s.connect(f);f.connect(g);g.connect(this.master);s.start(t0);
  },
  /* deterministic visual level for a given time (no audio clock needed) */
  levelAt(t,toneLayers){
    let v=0;
    for(const L of (toneLayers||[])){
      const d=L.data||{};
      for(const n of (d.notes||[])){
        if(t>=n.t&&t<=n.t+(n.dur||1)*0.6)v+=Math.sin(Math.PI*(t-n.t)/Math.max(0.01,(n.dur||1)*0.6))*0.5;
      }
      for(const s of (d.seq||[])){
        const dt=t-s;if(dt>=0&&dt<0.18)v+=(1-dt/0.18)*0.35;
      }
    }
    return AE.clamp(v,0,1);
  },
  update(t,frame){
    this.level=this.levelAt(t,frame&&frame.audio?frame.audio.toneLayers:null);
    this.drawMeter(t);
    if(!AE.state.audioOn||AE.state.exportMode||!AE.state.playing){lastT=t;return;}
    if(t-lastT>0.16||t<lastT){lastT=t;return;} // scrub / jump: no note burst
    const dt=t-lastT;lastT=t;
    if(dt<=0)return;
    for(const ev of (frame&&frame.audio?frame.audio.events:[])||[]){
      const d=ev.data||{};
      for(const n of (d.notes||[]))if(n.t>lastT-dt&&n.t<=t)this.tone(n.f,n.dur||1,d.wave==='pluck'?'triangle':'sine',(d.gain||0.15)/(d.notes.length>3?2.2:1),0,(AE.hash1(n.f)*2-1)*0.35);
      for(const s of (d.seq||[]))if(s>lastT-dt&&s<=t){this.tone(d.f*(1+(s%3)*0.25),0.16,'triangle',(d.gain||0.1),0,(s%2?0.3:-0.3));}
    }
  },
  drawMeter(t){
    if(!meterCtx)return;
    const w=meterCanvas.width,h=meterCanvas.height,c=meterCtx;
    c.clearRect(0,0,w,h);
    const tones=[];const comp=AE.app&&AE.app.project?AE.activeComp(AE.app.project):null;
    if(comp)for(const l of comp.layers)if(l.type==='tone')tones.push(l);
    c.strokeStyle='rgba(79,209,197,0.85)';c.lineWidth=1.4;c.beginPath();
    for(let x=0;x<w;x++){
      const tt=t+(x-w)/w*0.5;
      const v=this.levelAt(tt,tones);
      const yy=h/2-Math.sin(tt*22+x*0.4)*v*(h/2-2)*0.9;
      if(x===0)c.moveTo(x,yy);else c.lineTo(x,yy);
    }
    c.stroke();
    c.fillStyle='rgba(124,140,255,0.5)';
    c.fillRect(0,h/2-0.5,w,1);
  }
};
})(window.AE);
