/* ============================================================
   audio.js — 内置音色合成（配乐 + 锻打音效）
   首次点击/按键后建立 AudioContext；播放时声画同步。
   导出模式不推进音频时钟；电平由确定性函数给出，供界面显示。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util;
  const A=AE.audio={};

  let ctx=null,master=null,droneGain=null,droneOsc=[],noiseSrc=null,noiseGain=null,started=false;
  A.params={tone:1,baseFreq:74,decay:0.65,noise:0.55,volume:0.55};
  A.impacts=[];A.duration=15;A.droneBase=0.10;

  A.ensure=function(){
    if(ctx){if(ctx.state==='suspended')ctx.resume();return ctx;}
    try{
      ctx=new (window.AudioContext||window.webkitAudioContext)();
      master=ctx.createGain();master.gain.value=A.params.volume;master.connect(ctx.destination);
    }catch(e){console.warn('音频不可用',e);return null;}
    return ctx;
  };
  A.configure=function(o){
    o=o||{};
    A.impacts=(o.impacts||[]).map(i=>({t:i.t||i.time||0,strength:i.strength==null?1:i.strength}));
    A.duration=o.duration||15;A.droneBase=o.droneBase==null?.1:o.droneBase;
    if(o.params)A.params=Object.assign(A.params,o.params);
  };

  /* 确定性电平（与渲染同为 t 的纯函数） */
  A.level=function(t){
    let v=A.droneBase+0.035*(1+Math.sin(t*0.9))+0.02*Math.sin(t*3.1);
    for(const im of A.impacts){
      const d=t-im.t;
      if(d>=0&&d<0.5){
        const env=Math.exp(-d*9)*(1-Math.exp(-d*90));
        v+=im.strength*env*0.95;
      }else if(d<0&&d>-0.12){
        v+=im.strength*0.18*(1+d/0.12);
      }
    }
    return U.clamp(v,0,1);
  };
  /* 确定性波形（供面板绘制） */
  A.waveSample=function(t,i,n){
    const l=A.level(t);
    const s=Math.sin(t*U.TAU*2.1)*0.5+Math.sin(t*U.TAU*5.3)*0.25+U.noise(t*40,i)*0.25;
    return U.clamp(s*l, -1, 1);
  };

  /* 连续炉底音色 */
  A.startBed=function(heat){
    A.ensure();if(!ctx||started)return;
    started=true;
    droneGain=ctx.createGain();droneGain.gain.value=0.0001;droneGain.connect(master);
    const freqs=[A.params.baseFreq,A.params.baseFreq*1.5,A.params.baseFreq*2.02];
    freqs.forEach((f,i)=>{
      const o=ctx.createOscillator();o.type=i===0?'sine':(i===1?'triangle':'sine');o.frequency.value=f;
      const g=ctx.createGain();g.gain.value=[0.5,0.16,0.08][i];
      o.connect(g);g.connect(droneGain);o.start();droneOsc.push(o);
    });
    // 低频噪声（炉火）
    const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
    let last=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+0.02*w)/1.02;d[i]=last*3;}
    noiseSrc=ctx.createBufferSource();noiseSrc.buffer=buf;noiseSrc.loop=true;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=340;
    noiseGain=ctx.createGain();noiseGain.gain.value=0.0001;
    noiseSrc.connect(lp);lp.connect(noiseGain);noiseGain.connect(master);noiseSrc.start();
    A.setBedHeat(heat==null?.5:heat);
  };
  A.setBedHeat=function(heat){
    if(!ctx||!started)return;
    const now=ctx.currentTime;
    droneGain.gain.setTargetAtTime(0.10+heat*0.14,now,0.15);
    noiseGain.gain.setTargetAtTime(0.012+heat*0.05,now,0.2);
  };
  A.stopBed=function(){
    if(!ctx||!started)return;
    const now=ctx.currentTime;
    droneGain.gain.setTargetAtTime(0.0001,now,0.08);
    noiseGain.gain.setTargetAtTime(0.0001,now,0.08);
    droneOsc.forEach(o=>{try{o.stop(now+0.4);}catch(e){}});
    try{noiseSrc.stop(now+0.4);}catch(e){}
    droneOsc=[];noiseSrc=null;started=false;
  };

  /* 一次锤击：低频冲击 + 金属泛音 + 噪声瞬态 */
  A.hit=function(strength){
    A.ensure();if(!ctx)return;
    const now=ctx.currentTime,s=U.clamp(strength||1,0.2,1.6);
    // 低频锤击
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type='sine';o.frequency.setValueAtTime(150*s,now);o.frequency.exponentialRampToValueAtTime(46,now+0.16);
    g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(0.9*s,now+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,now+A.params.decay*0.5);
    o.connect(g);g.connect(master);o.start(now);o.stop(now+A.params.decay+0.1);
    // 金属泛音
    [1,2.76,5.4].forEach((m,i)=>{
      const oo=ctx.createOscillator(),gg=ctx.createGain();
      oo.type='triangle';oo.frequency.value=A.params.baseFreq*6*m*(0.9+s*0.15);
      gg.gain.setValueAtTime(0.0001,now);
      gg.gain.exponentialRampToValueAtTime(0.16*s/(i+1),now+0.004);
      gg.gain.exponentialRampToValueAtTime(0.0001,now+0.35+i*0.08);
      oo.connect(gg);gg.connect(master);oo.start(now);oo.stop(now+0.6);
    });
    // 噪声瞬态
    const len=Math.floor(ctx.sampleRate*0.25),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/len*8);
    const ns=ctx.createBufferSource();ns.buffer=buf;
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1800*A.params.tone;bp.Q.value=0.8;
    const ng=ctx.createGain();ng.gain.value=0.5*s*A.params.noise;
    ns.connect(bp);bp.connect(ng);ng.connect(master);ns.start(now);
  };

  /* 播放循环里按时间推进：跨越锤击点触发音效 */
  A.tick=function(t,editor){
    if(editor&&editor.exportMode)return;
    const heat=editor&&editor.demo?editor.demo.heatAt(t):0.5;
    A.setBedHeat(heat);
    if(!ctx||!started)return;
    for(const im of A.impacts){
      const key='hit'+im.t.toFixed(3);
      if(t>=im.t&&t<im.t+0.12&&!A._fired[key]){A._fired[key]=true;A.hit(im.strength);}
    }
  };
  A.resetFired=function(){A._fired={};};
  A._fired={};

  console.log('[forge] audio ready');
})();
