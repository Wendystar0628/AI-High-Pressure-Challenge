/* ============================================================
   particles.js — 确定性粒子系统
   以固定步长预模拟整段，保存每步快照；任意时刻 t 可随机取样、
   倒放、跳到后段或重开文件结果一致。运动模糊多次取样不重推进模拟。
   发射源来自当前几何；重力 / 方向力 / 空间场 / 碰撞 / 次级发射均真实作用。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,G=AE.geom;
  const PS=AE.particles={};

  const STRIDE=12; // x,y,z,vx,vy,vz,age,life,alpha,size,temp,kind
  const SIM_FPS=60;
  PS.SIM_FPS=SIM_FPS;

  class Sim{
    constructor(opts){
      this.opts=Object.assign({
        duration:15,max:1000,seed:20240607,gravity:[0,-6.2,0],
        drag:.55,planeY:-1.32,charFrontZ:.3,charBox:[-1.5,1.5,-1.4,1.4],
        impacts:[],embers:{from:3,to:12.2,rate:26},glyphPoints:[],
        fields:[],emitRings:[],cool:1.15
      },opts||{});
      this.snapshots=[];this.count=0;this.free=[];this.cursor=0;
      this.active=new Uint8Array(this.opts.max);
      this.rng=U.mulberry32(this.opts.seed);
      this.p=[];
      for(let i=0;i<this.opts.max;i++)this.p.push({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:1,alpha:0,size:0,temp:1,kind:0,hit:0});
    }
    reset(){
      this.snapshots.length=0;this.active.fill(0);this.count=0;this.cursor=0;this.free.length=0;
      this.rng=U.mulberry32(this.opts.seed);
      for(const q of this.p)q.alpha=0;
    }
    spawn(o){
      let id=-1;
      for(let k=0;k<this.opts.max;k++){
        const c=(this.cursor+k)%this.opts.max;
        if(!this.active[c]){id=c;break;}
      }
      if(id<0)return null;
      this.cursor=(id+1)%this.opts.max;
      this.active[id]=1;
      const q=this.p[id];
      q.x=o.x;q.y=o.y;q.z=o.z;q.vx=o.vx;q.vy=o.vy;q.vz=o.vz;
      q.age=0;q.life=o.life;q.alpha=1;q.size=o.size;q.temp=o.temp==null?1:o.temp;q.kind=o.kind||0;q.hit=0;
      return q;
    }
    burst(im){
      const r=this.rng,n=Math.round(70*im.strength);
      for(let i=0;i<n;i++){
        const a=r()*U.TAU,up=.35+r()*.95,sp=(2.2+r()*4.6)*(0.6+im.strength*.6);
        const lateral=Math.sqrt(Math.max(0,1-up*up));
        this.spawn({x:im.x+(r()-.5)*.18,y:im.y+.06+r()*.1,z:im.z+(r()-.5)*.16,
          vx:Math.cos(a)*lateral*sp,vy:up*sp,vz:Math.sin(a)*lateral*sp*.7,
          life:.45+r()*1.0,size:.018+r()*.038,temp:1,kind:0});
      }
    }
    ember(){
      const r=this.rng,pts=this.opts.glyphPoints;
      let x=(r()-.5)*2.2,y=-.3+r()*1.1,z=this.opts.charHalfZ;
      if(pts&&pts.length){const q=pts[Math.floor(r()*pts.length)];x=q[0]+(r()-.5)*.2;y=q[1]+(r()-.5)*.2;}
      this.spawn({x:x,y:y,z:z,vx:(r()-.5)*.5,vy:.5+r()*1.3,vz:(r()-.5)*.5,
        life:1.4+r()*2.2,size:.012+r()*.02,temp:.55+r()*.35,kind:1});
    }
    secondary(q,y){
      const r=this.rng,n=2+Math.floor(r()*3);
      for(let i=0;i<n;i++){
        const a=r()*U.TAU;
        this.spawn({x:q.x,y:y,z:q.z,
          vx:Math.cos(a)*1.4,vy:.6+r()*1.6,vz:Math.sin(a)*1.4,
          life:.3+r()*.5,size:.012+r()*.018,temp:q.temp*.7,kind:2});
      }
    }
    build(){
      this.reset();
      const o=this.opts,dt=1/SIM_FPS,N=Math.ceil(o.duration*SIM_FPS)+2;
      const imp=o.impacts.slice().sort((a,b)=>a.t-b.t);
      let ii=0,emberAcc=0;
      for(let s=0;s<=N;s++){
        const t=s*dt;
        // 发射事件
        while(ii<imp.length&&imp[ii].t<=t+dt*.5){this.burst(imp[ii]);ii++;}
        // 连续余烬
        if(t>=o.embers.from&&t<=o.embers.to&&o.embers.rate>0){
          emberAcc+=o.embers.rate*dt;
          while(emberAcc>=1){this.ember();emberAcc-=1;}
        }
        // 积分
        const F=o.fields;
        for(let id=0;id<o.max;id++){
          const q=this.p[id];if(!this.active[id])continue;
          q.age+=dt;
          if(q.age>=q.life){this.active[id]=0;q.alpha=0;continue;}
          let fx=o.gravity[0],fy=o.gravity[1],fz=o.gravity[2];
          if(F&&F.length){const ff=G.fieldForce([q.x,q.y,q.z],F,t);fx+=ff[0];fy+=ff[1];fz+=ff[2];}
          // 阻力
          fx-=q.vx*o.drag;fy-=q.vy*o.drag;fz-=q.vz*o.drag;
          q.vx+=fx*dt;q.vy+=fy*dt;q.vz+=fz*dt;
          q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
          // 与砧面碰撞（按法线反弹 + 摩擦）
          if(q.y<o.planeY&&q.vy<0){
            q.y=o.planeY;q.vy=-q.vy*.42;q.vx*=.72;q.vz*=.72;
            q.temp*=.72;q.age+=.12;q.hit++;
            if(q.hit===1&&q.kind===0&&this.active[id])this.secondary(q,o.planeY+.02);
          }
          // 与正在变形的字块正面碰撞（按当前表面、法线与相对运动反弹）
          const cb=o.charBox;
          if(o.charFrontZ!=null&&q.z<o.charFrontZ&&q.vz<0&&q.x>cb[0]&&q.x<cb[1]&&q.y>cb[2]&&q.y<cb[3]){
            q.z=o.charFrontZ;q.vz=-q.vz*.38;q.vx*=.78;q.vy*=.78;q.temp*=.82;q.hit++;
            if(q.hit===1&&q.kind===0&&this.active[id])this.secondary(q,o.planeY+.02);
          }
          q.temp=Math.max(0,q.temp-dt*o.cool*(q.kind===1?.55:1));
          const a=q.age/q.life;
          q.alpha=U.clamp(a<.1?a/.1:(1-a)/.72,0,1)*(q.kind===1?.5:1);
        }
        // 快照
        const snap=new Float32Array(o.max*STRIDE);
        for(let id=0;id<o.max;id++){
          const q=this.p[id],b=id*STRIDE;
          if(this.active[id]){
            snap[b]=q.x;snap[b+1]=q.y;snap[b+2]=q.z;snap[b+3]=q.vx;snap[b+4]=q.vy;snap[b+5]=q.vz;
            snap[b+6]=q.age;snap[b+7]=q.life;snap[b+8]=q.alpha;snap[b+9]=q.size;snap[b+10]=q.temp;snap[b+11]=q.kind;
          }
        }
        this.snapshots.push(snap);
        this.count=0;for(let id=0;id<o.max;id++)if(this.active[id])this.count=Math.max(this.count,id+1);
      }
      this.ready=true;return this;
    }
    /* 在任意时刻取样：线性插值 + 拖尾，纯函数，不推进模拟 */
    sample(t,trailLen){
      const res={pos:[],col:[],size:[],alpha:[],trails:[],heat:[]};
      if(!this.snapshots.length)return res;
      const o=this.opts,dt=1/SIM_FPS;
      const s=U.clamp(t*SIM_FPS,0,this.snapshots.length-1.001);
      const s0=Math.floor(s),f=s-s0;
      const A=this.snapshots[s0],B=this.snapshots[Math.min(s0+1,this.snapshots.length-1)];
      const K=trailLen==null?6:trailLen;
      const alive=[];
      for(let id=0;id<o.max;id++){
        const b=id*STRIDE;
        const aa=A[b+8],bb=B[b+8];
        if(aa<=0.001&&bb<=0.001)continue;
        const x=U.lerp(A[b],B[b],f),y=U.lerp(A[b+1],B[b+1],f),z=U.lerp(A[b+2],B[b+2],f);
        const alpha=U.lerp(aa,bb,f);const size=U.lerp(A[b+9],B[b+9],f);
        const temp=U.lerp(A[b+10],B[b+10],f);const kind=A[b+11];
        res.pos.push(x,y,z);res.size.push(size);res.alpha.push(alpha);res.heat.push(temp);
        // 温度 → 颜色（炽白 → 橙 → 暗红）
        const c=temp>.75?[1,.95,.72]:temp>.45?[1,.62,.22]:temp>.2?[1,.3,.08]:[.5,.1,.03];
        const glow=0.6+temp*1.1;
        res.col.push(c[0]*glow,c[1]*glow,c[2]*glow);
        alive.push({id:id,x:x,y:y,z:z,alpha:alpha,temp:temp,kind:kind});
      }
      // 拖尾：沿真实轨迹回溯 K 步
      for(const a of alive){
        if(a.kind===1&&a.temp<.4)continue;
        let px=a.x,py=a.y,pz=a.z,pa=a.alpha;
        for(let k=1;k<=K;k++){
          const si=s0-k;if(si<0)break;
          const S=this.snapshots[si],bb=a.id*STRIDE;
          if(S[bb+8]<=0.001)break;
          const qx=S[bb],qy=S[bb+1],qz=S[bb+2],qa=S[bb+8]*(1-k/(K+1));
          if(qa<=0.01)continue;
          res.trails.push(qx,qy,qz,px,py,pz,qa*a.temp,pa*a.temp);
          px=qx;py=qy;pz=qz;pa=qa;
        }
      }
      return res;
    }
  }
  PS.Sim=Sim;
  PS.create=opts=>new Sim(opts);

  console.log('[forge] particles ready');
})();
