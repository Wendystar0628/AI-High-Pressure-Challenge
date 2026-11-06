/* Deterministic, fixed-step simulations. All values use metres, seconds and kilograms.
   Jelly: elastic top and coupled lateral shell, two-way dissipative contact.
   Tank: staggered-grid linear shallow-water solver + spherical-cap buoyancy and rigid contacts. */
(() => {
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const DT=1/240;
  const defaults={
    jelly:{mass:2.6,radius:.39,drop:2.8,count:3,interval:.67,size:1.9,stiffness:1,damping:1.6,density:1,fix:'fixed',gravity:9.81,friction:.48,restitution:.28,repeat:true},
    tank:{level:2.15,gravity:9.81,viscosity:.48,radius:.245,drop:1.2,length:8.6,width:3.1,height:3.15,n0:3,n1:3,n2:3,n3:3,rho0:.42,rho1:.78,rho2:1,rho3:1.72,amplitude:.19,frequency:.85,delay:1,duration:5,device:'piston'}
  };
  function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
  function clearReleaseHeight(x,y,z,r,waiting){
    // A compact release queue may need more than one vertical tier at large radii.
    for(const b of waiting){const rr=r+b.r+.025,d2=(x-b.x)**2+(z-b.z)**2;if(d2<rr*rr)y=Math.max(y,b.y+Math.sqrt(rr*rr-d2));}
    return y;
  }
  function rigidPairs(balls,dt,onHit){
    for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
      const a=balls[i],b=balls[j];if(!a.released||!b.released)continue;
      let x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,rr=a.r+b.r,d2=x*x+y*y+z*z;
      if(d2>=rr*rr)continue;
      const d=Math.sqrt(d2)||.0001; x/=d;y/=d;z/=d;
      if(d<.0002){x=1;y=0;z=0;}
      const ia=1/a.mass,ib=1/b.mass,sum=ia+ib,pen=(rr-d)*.74;
      a.x-=x*pen*ia/sum;a.y-=y*pen*ia/sum;a.z-=z*pen*ia/sum;
      b.x+=x*pen*ib/sum;b.y+=y*pen*ib/sum;b.z+=z*pen*ib/sum;
      const v=(b.vx-a.vx)*x+(b.vy-a.vy)*y+(b.vz-a.vz)*z;
      if(v<0){const q=-(1.38)*v/sum;a.vx-=q*x*ia;a.vy-=q*y*ia;a.vz-=q*z*ia;b.vx+=q*x*ib;b.vy+=q*y*ib;b.vz+=q*z*ib;if(v<-.32&&onHit)onHit(-v,a);}
    }
  }
  class JellySim{
    constructor(p,mode='center',onEvent=()=>{}){
      this.p={...p};this.mode=mode;this.onEvent=onEvent;this.t=0;this.started=false;this.contacts=0;this.R=p.size;this.H=1.55;this.base=.22;this.n=49;this.dx=2*this.R/(this.n-1);
      const nn=this.n*this.n;this.u=new Float64Array(nn);this.v=new Float64Array(nn);this.force=new Float64Array(nn);this.mask=new Uint8Array(nn);this.nodes=[];
      for(let j=0;j<this.n;j++)for(let i=0;i<this.n;i++){let x=-this.R+i*this.dx,z=-this.R+j*this.dx,k=j*this.n+i;if(x*x+z*z<=this.R*this.R*1.015){this.mask[k]=1;this.nodes.push(k);}}
      this.nodeMass=25*p.density*(this.R/1.9)**2/this.nodes.length;this.mean=0;this.meanV=0;this.maxDef=0;this.energy=0;this.sway=0;this.swayV=0;this.shift=0;this.shiftV=0;this.slopeMoment=0;this.balls=[];this.impactEvents=[];
      // Lateral elastic degrees of freedom retain inertia: side expansion follows
      // the pressure change with a finite delay, then sends waves down the wall.
      this.sideN=64;this.sideH=13;this.side=new Float64Array(this.sideN*this.sideH);this.sideV=new Float64Array(this.side.length);this.sideLoad=new Float64Array(this.sideN);this.sideEnergy=0;
      const spots=[[-.77,-.25],[.8,.13],[.05,.69],[-.91,.48],[.64,-.65],[0,-.63]];
      const count=mode==='multi'?p.count:1;
      for(let i=0;i<count;i++){
        const pos=mode==='multi'?spots[i%spots.length]:mode==='offset'?[this.R*.74,.12]:[0,0];
        const r=p.radius*(mode==='multi'?.93:1),x=pos[0]*(mode==='multi'?this.R/1.9:1),z=pos[1];
        const y=clearReleaseHeight(x,this.base+this.H+p.drop+r,z,r,this.balls);
        this.balls.push({id:i,x,z,y,vx:mode==='offset'?.24:0,vy:0,vz:0,r,mass:p.mass,released:false,releaseAt:.65+i*p.interval,contact:false,lastHit:-10,rollX:0,rollZ:0});
      }
    }
    sample(arr,x,z){
      const radius=Math.hypot(x,z),edge=this.R-this.dx*1.5;
      if(radius>edge){x*=edge/radius;z*=edge/radius;}
      let gx=clamp((x+this.R)/this.dx,0,this.n-1.001),gz=clamp((z+this.R)/this.dx,0,this.n-1.001),i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j,k=j*this.n+i;
      return lerp(lerp(arr[k],arr[k+1],fx),lerp(arr[k+this.n],arr[k+this.n+1],fx),fz);
    }
    top(x,z){let rr=Math.hypot(x-this.shift,z)/this.R;return this.base+this.H+this.sample(this.u,x-this.shift,z)-.13*clamp((rr-.89)/.11,0,1)**2+this.sway*(x/this.R);}
    sideSample(arr,h,angle){
      const a=(angle/(Math.PI*2)+1)%1*this.sideN,i=Math.floor(a),f=a-i,y=clamp(h,0,.99999)*(this.sideH-1),j=Math.floor(y),v=y-j;
      const k=j*this.sideN+i,kn=j*this.sideN+(i+1)%this.sideN;
      return lerp(lerp(arr[k],arr[kn],f),lerp(arr[k+this.sideN],arr[kn+this.sideN],f),v);
    }
    deform(x,y,z,delta=0){
      let h=clamp(y/this.H,0,1),u=this.sample(this.u,x,z)+(delta?this.sample(this.v,x,z)*delta:0),a=Math.atan2(z,x),bulge=this.sideSample(this.side,h,a)+(delta?this.sideSample(this.sideV,h,a)*delta:0);
      const free=this.p.fix==='free'?1:this.p.fix==='edge'?.36:0;
      const sway=this.sway+this.swayV*delta;
      return [x*(1+bulge/this.R)+this.shift+this.shiftV*delta+sway*h*.3,y+this.base+u*Math.pow(h,1.4)+sway*x/this.R*h,z*(1+bulge/this.R)+free*sway*.1];
    }
    step(dt=DT){
      if(!this.started)return;this.t+=dt;const p=this.p,n=this.n,dx=this.dx;this.force.fill(0);
      for(const b of this.balls){
        if(this.t<b.releaseAt)continue;b.released=true;const previousVy=b.vy;b.vy-=p.gravity*dt;
        const localx=b.x-this.shift,dist=Math.hypot(localx,b.z);
        let F=0,contact=false;
        if(dist<this.R+.04&&b.y>this.base+.16){
          const sy=this.top(b.x,b.z),pen=sy+b.r-b.y;
          if(pen>0){
            const sv=this.sample(this.v,localx,b.z),spring=820*p.stiffness,damp=p.repeat?11:37;
            F=clamp(spring*pen-damp*(b.vy-sv),0,1300);contact=F>0;
            const e=dx*1.1,gx=(this.top(b.x+e,b.z)-this.top(b.x-e,b.z))/(2*e),gz=(this.top(b.x,b.z+e)-this.top(b.x,b.z-e))/(2*e);
            b.vy+=F/b.mass*dt;b.vx-=clamp(gx,-1.4,1.4)*F/b.mass*dt*.78;b.vz-=clamp(gz,-1.4,1.4)*F/b.mass*dt*.78;
        const dampH=Math.exp(-(p.friction*2+1.7)*dt);b.vx*=dampH;b.vz*=dampH;
            const sigma=b.r*.6+dx*.6,range=sigma*2.8;let weights=[],sum=0;
            let ia=Math.max(0,Math.floor((localx-range+this.R)/dx)),ib=Math.min(n-1,Math.ceil((localx+range+this.R)/dx));
            let ja=Math.max(0,Math.floor((b.z-range+this.R)/dx)),jb=Math.min(n-1,Math.ceil((b.z+range+this.R)/dx));
            for(let j=ja;j<=jb;j++)for(let i=ia;i<=ib;i++){let k=j*n+i;if(!this.mask[k])continue;let dd=(-this.R+i*dx-localx)**2+(-this.R+j*dx-b.z)**2,w=Math.exp(-dd/(2*sigma*sigma));weights.push(k,w);sum+=w;}
            for(let a=0;a<weights.length;a+=2)this.force[weights[a]]-=F*weights[a+1]/(sum*this.nodeMass);
            this.swayV-=F*localx*.013*dt/p.density;
            if(p.fix!=='fixed')this.shiftV+=gx*F*.006*dt;
            if(!b.contact&&this.t-b.lastHit>.14&&Math.abs(b.vy-sv)>.45){this.contacts++;b.lastHit=this.t;this.onEvent('impact',Math.abs(b.vy-sv),b);this.impactEvents.push({t:this.t,x:b.x,z:b.z});}
          }
        }
        // In the non-repeating setting the unloading stroke dissipates its
        // upward kinetic energy at contact, preventing a second ballistic hop.
        if(!p.repeat&&contact&&b.vy>0)b.vy*=Math.exp(-25*dt);
        if(contact&&previousVy<0&&b.vy>=0&&this.t-b.lastHit>.12&&this.energy>.035)this.onEvent('rebound',Math.min(4,this.energy*4),b);
        b.contact=contact;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
        const floor=Math.hypot(b.x,b.z)<3.43?this.base:-.195;
        if(b.y-b.r<floor){b.y=floor+b.r;if(b.vy<-.3)this.onEvent('metal',Math.abs(b.vy),b);b.vy=Math.abs(b.vy)*p.restitution;if(b.vy<.07)b.vy=0;let friction=Math.max(0,1-p.friction*7*dt);b.vx*=friction;b.vz*=friction;}
        if(Math.hypot(b.x,b.z)>4.8){let r=Math.hypot(b.x,b.z);b.x*=4.8/r;b.z*=4.8/r;b.vx*=-.3;b.vz*=-.3;}
        b.rollX+=b.vz*dt/b.r;b.rollZ-=b.vx*dt/b.r;
      }
      rigidPairs(this.balls,dt,(v,b)=>this.onEvent('metal',v,b));
      const c2=3.5*p.stiffness/p.density,foundation=38*p.stiffness/p.density,damp=p.damping+1.15;
      let sum=0,sumV=0,max=0,energy=0,moment=0;
      for(const k of this.nodes){let u=this.u[k],i=k%n,j=(k/n)|0;
        const l=i>0&&this.mask[k-1]?this.u[k-1]:u,r=i<n-1&&this.mask[k+1]?this.u[k+1]:u;
        const f=j>0&&this.mask[k-n]?this.u[k-n]:u,b=j<n-1&&this.mask[k+n]?this.u[k+n]:u;
        this.v[k]+=(c2*(l+r+f+b-4*u)/(dx*dx)-foundation*u-damp*this.v[k]+this.force[k])*dt;
      }
      for(const k of this.nodes){this.u[k]+=this.v[k]*dt;if(this.u[k]<-this.H*.8){this.u[k]=-this.H*.8;this.v[k]=Math.max(0,this.v[k])*.3;}if(this.u[k]>.8){this.u[k]=.8;this.v[k]*=.5;}sum+=this.u[k];sumV+=this.v[k];max=Math.max(max,Math.abs(this.u[k]));energy+=this.v[k]**2;moment+=this.u[k]*(k%n-(n-1)/2)/(n/2);}
      this.mean=sum/this.nodes.length;this.meanV=sumV/this.nodes.length;this.maxDef=max;this.energy=Math.sqrt(energy/this.nodes.length);this.slopeMoment=moment/this.nodes.length;
      const sn=this.sideN,sh=this.sideH,sideK=85*p.stiffness/p.density,sideC=.45*p.stiffness/p.density,dh=this.H/(sh-1),da=this.R*Math.PI*2/sn;
      for(let i=0;i<sn;i++){const a=i/sn*Math.PI*2;this.sideLoad[i]=-this.mean*1.55-this.sample(this.u,Math.cos(a)*this.R*.83,Math.sin(a)*this.R*.83)*.36;}
      let sideEnergy=0;
      for(let j=0;j<sh;j++)for(let i=0;i<sn;i++){
        const k=j*sn+i,h=j/(sh-1),u=this.side[k];
        if(j===sh-1||(j===0&&p.fix!=='free')){this.side[k]=0;this.sideV[k]=0;continue;}
        const profile=Math.sin(Math.PI*(p.fix==='free'?.08+.92*h:h)),target=this.sideLoad[i]*profile;
        const left=this.side[j*sn+(i+sn-1)%sn],right=this.side[j*sn+(i+1)%sn],down=j?this.side[k-sn]:u,up=this.side[k+sn];
        this.sideV[k]+=(sideK*(target-u)+sideC*((left+right-2*u)/(da*da)+(down+up-2*u)/(dh*dh))-(p.damping+3.5)*this.sideV[k])*dt;
      }
      for(let k=0;k<this.side.length;k++){this.side[k]+=this.sideV[k]*dt;sideEnergy+=this.sideV[k]**2;}
      this.sideEnergy=Math.sqrt(sideEnergy/this.side.length);this.energy=Math.max(this.energy,this.sideEnergy*.7);
      this.swayV+=(-26*p.stiffness*this.sway-(p.damping+1)*this.swayV)*dt;this.sway+=this.swayV*dt;
      this.shiftV+=(-(p.fix==='edge'?13:0)*this.shift-p.friction*3*this.shiftV)*dt;this.shift+=this.shiftV*dt;
      this.impactEvents=this.impactEvents.filter(e=>this.t-e.t<2);
    }
    get phase(){
      if(!this.started||this.t<.65)return ['准备就绪','释放重球，观察形变传播'];
      if(!this.contacts)return ['自由下落','重力势能正在转化为动能'];
      if(this.mode==='multi'&&this.t<this.balls[this.balls.length-1].releaseAt+1.3)return ['连续冲击','后一次冲击与前一轮弹性波叠加'];
      if(this.energy>.1)return ['形变与回弹','局部凹陷、侧向鼓出与弹性波传播'];
      if(this.balls.some(b=>Math.hypot(b.x,b.z)>this.R&&Math.hypot(b.vx,b.vy,b.vz)>.18))return ['滚落与接触','偏心作用改变轨迹，平台摩擦逐渐耗散动能'];
      if(this.settled)return ['趋于稳定','振荡已衰减，保留最终接触状态'];
      return ['余波衰减','重球与软体继续交换动量'];
    }
    get settled(){return this.t>9&&this.energy<.018&&this.balls.every(b=>b.released&&Math.hypot(b.vx,b.vy,b.vz)<.08);}
  }
  class TankSim{
    constructor(p,onEvent=()=>{}){
      this.p={...p};this.onEvent=onEvent;this.t=0;this.started=false;this.nx=89;this.nz=31;this.L=p.length;this.W=p.width;this.H=p.level;this.dx=this.L/(this.nx-1);this.dz=this.W/(this.nz-1);
      this.eta=new Float64Array(this.nx*this.nz);this.etaV=new Float64Array(this.eta.length);this.ux=new Float64Array((this.nx+1)*this.nz);this.uz=new Float64Array(this.nx*(this.nz+1));
      this.random=rng(94021);this.balls=[];this.drops=[];this.rings=[];this.lastEntry=null;this.waveStart=null;this.waveStop=null;this.waveActive=false;this.waveOverride=null;this.manualStart=0;this.paddle=0;this.paddleVel=0;this.waveHeight=0;this.waveEnergy=0;this.circulation=0;this.collisions=0;this.ballCollisions=0;this.batch=0;this.releaseArmed=false;this.addBatch(false);
      this.paddlePhase=0;this.driveAge=0;this.causticTime=0;
    }
    sample(arr,x,z){const gx=clamp((x+this.L/2)/this.dx,0,this.nx-1.001),gz=clamp((z+this.W/2)/this.dz,0,this.nz-1.001),i=gx|0,j=gz|0,fx=gx-i,fz=gz-j,k=j*this.nx+i;return lerp(lerp(arr[k],arr[k+1],fx),lerp(arr[k+this.nx],arr[k+this.nx+1],fx),fz);}
    surface(x,z,delta=0){return this.H+this.sample(this.eta,x,z)+(delta?this.sample(this.etaV,x,z)*delta:0);}
    flow(x,y,z){
      const ix=clamp(Math.round((x+this.L/2)/this.dx),1,this.nx-2),iz=clamp(Math.round((z+this.W/2)/this.dz),1,this.nz-2),idx=iz*this.nx+ix;
      const depth=clamp(y/this.H,0,1),atten=.55+.45*depth;
      // A divergence-free return-current cell, driven by the measured wave energy.
      // This approximates wave-induced streaming without prescribing ball trajectories.
      const phaseX=Math.PI*clamp((x+this.L/2)/this.L,0,1),phaseY=Math.PI*depth;
      const currentX=this.circulation*Math.cos(phaseY)*Math.sin(phaseX),currentY=-this.circulation*this.H/this.L*Math.sin(phaseY)*Math.cos(phaseX);
      return [(this.ux[iz*(this.nx+1)+ix]+this.ux[iz*(this.nx+1)+ix+1])*.5*atten+currentX,this.etaV[idx]*depth+currentY,(this.uz[iz*this.nx+ix]+this.uz[(iz+1)*this.nx+ix])*.5*atten];
    }
    armRelease(){if(this.releaseArmed)return;this.releaseArmed=true;this.waveOverride=null;for(const b of this.balls)b.releaseAt+=this.t;}
    addBatch(arm=true){
      this.batch++;this.lastEntry=null;this.waveStart=null;this.waveStop=null;this.waveOverride=null;
      if(arm)this.releaseArmed=true;
      const p=this.p,start=this.t+.65,counts=[p.n0,p.n1,p.n2,p.n3];
      for(let g=0;g<4;g++)for(let j=0;j<counts[g];j++){
        let x=(-.31+g*.205)*this.L+(j%2?-.22:.16);if(j===1&&g===0)x=-this.L*.18;if(j===1&&g===1)x=-this.L*.105;
        const z=counts[g]===1?0:((j%3)-1)*this.W*.27+(j>=3?.16:0),r=p.radius;
        const y=clearReleaseHeight(x,this.H+p.drop+r+(j>=3?.7:0),z,r,this.balls.filter(b=>b.batch===this.batch));
        this.balls.push({id:this.balls.length,group:g,batch:this.batch,x,y,z,vx:.12*(g%2?1:-1),vy:0,vz:.025*(j-1),r,mass:p['rho'+g]*4/3*Math.PI*r**3,rho:p['rho'+g],releaseAt:start+g*.22+j*.11,released:false,entered:false,rollX:0,rollZ:0});
      }
    }
    disturb(x,z,strength){
      const radius=.62,ia=Math.max(0,Math.floor((x-radius+this.L/2)/this.dx)),ib=Math.min(this.nx-1,Math.ceil((x+radius+this.L/2)/this.dx)),ja=Math.max(0,Math.floor((z-radius+this.W/2)/this.dz)),jb=Math.min(this.nz-1,Math.ceil((z+radius+this.W/2)/this.dz));
      for(let j=ja;j<=jb;j++)for(let i=ia;i<=ib;i++){const d2=(-this.L/2+i*this.dx-x)**2+(-this.W/2+j*this.dz-z)**2;this.eta[j*this.nx+i]+=strength*(Math.exp(-d2/.16)*.38-Math.exp(-d2/.026));}
    }
    splash(b,speed){
      this.disturb(b.x,b.z,clamp(speed*.035,.04,.22));this.rings.push({x:b.x,z:b.z,t:this.t,power:clamp(speed/4,.4,1.3),radius:b.r,crown:true});
      for(let i=0;i<28;i++){
        const a=this.random()*Math.PI*2,v=.4+this.random()*1.25,x=b.x+Math.cos(a)*b.r,z=b.z+Math.sin(a)*b.r;
        this.drops.push({x,y:this.surface(x,z)+.035,z,vx:Math.cos(a)*v,vy:(.23+this.random()*.38)*speed,vz:Math.sin(a)*v,age:0,r:.019+this.random()*.025});
      }
      this.onEvent('splash',speed,b);
    }
    setWave(active){this.waveOverride=active;this.manualStart=this.t;if(active&&!this.started)this.started=true;}
    step(dt=DT){
      if(!this.started)return;this.t+=dt;const p=this.p,nx=this.nx,nz=this.nz;
      const auto=this.waveStart!==null&&this.t+1e-8>=this.waveStart&&this.t<this.waveStop-1e-8;
      const active=this.waveOverride===null?auto:this.waveOverride;
      if(active!==this.waveActive){this.waveActive=active;this.driveAge=0;this.onEvent(active?'wave-start':'wave-stop',1);}
      if(active){
        this.driveAge+=dt;const a=clamp(this.driveAge/.3,0,1),ramp=a*a*(3-2*a),old=this.paddle;
        this.paddlePhase+=2*Math.PI*p.frequency*ramp*dt;this.paddle=p.amplitude*Math.sin(this.paddlePhase);this.paddleVel=(this.paddle-old)/dt;
      }else this.paddleVel=0;
      const damp=Math.exp(-p.viscosity*dt),g=p.gravity,depth=Math.min(this.H,1.7);
      for(let j=0;j<nz;j++){
        const off=j*(nx+1),offE=j*nx;this.ux[off]=this.paddleVel*(p.device==='flap'?.73:1);this.ux[off+nx]=0;
        for(let i=1;i<nx;i++)this.ux[off+i]=(this.ux[off+i]-g*dt*(this.eta[offE+i]-this.eta[offE+i-1])/this.dx)*damp;
      }
      for(let i=0;i<nx;i++){this.uz[i]=0;this.uz[nz*nx+i]=0;for(let j=1;j<nz;j++){let k=j*nx+i;this.uz[k]=(this.uz[k]-g*dt*(this.eta[k]-this.eta[k-nx])/this.dz)*damp;}}
      let hi=-1e9,lo=1e9,energy=0;
      for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
        const k=j*nx+i,fx=j*(nx+1)+i;this.etaV[k]=-depth*((this.ux[fx+1]-this.ux[fx])/this.dx+(this.uz[k+nx]-this.uz[k])/this.dz);
        this.eta[k]=clamp((this.eta[k]+this.etaV[k]*dt)*Math.exp(-p.viscosity*.25*dt),-this.H*.45,Math.min(.8,p.height-this.H-.05));hi=Math.max(hi,this.eta[k]);lo=Math.min(lo,this.eta[k]);energy+=this.eta[k]**2;
      }
      this.waveHeight=hi-lo;this.waveEnergy=Math.sqrt(energy/this.eta.length);this.circulation+=(this.waveEnergy*2.5-this.circulation)*Math.min(1,dt*.85);
      this.causticTime+=Math.min(1.6,this.waveEnergy*10)*dt;
      for(const b of this.balls){
        if(!this.releaseArmed||this.t<b.releaseAt)continue;b.released=true;
        const water=this.surface(b.x,b.z),h=clamp(water-(b.y-b.r),0,b.r*2),sub=(h*h*(3*b.r-h))/(4*b.r**3),flow=this.flow(b.x,b.y,b.z);
        if(h>0&&!b.entered){b.entered=true;b.entryTime=this.t;this.splash(b,Math.abs(b.vy));const batchBalls=this.balls.filter(a=>a.batch===this.batch);if(b.batch===this.batch&&batchBalls.every(a=>a.entered)){this.lastEntry=this.t;this.waveStart=this.lastEntry+p.delay;this.waveStop=this.waveStart+p.duration;}}
        const dvx=flow[0]-b.vx,dvy=flow[1]-b.vy,dvz=flow[2]-b.vz,drag=(1.75+p.viscosity*1.2)/b.rho;
        b.vx+=sub*drag*dvx*(1+.28*Math.abs(dvx))*dt;b.vz+=sub*drag*dvz*(1+.28*Math.abs(dvz))*dt;
        b.vy+=(-g+g*sub/b.rho+sub*drag*1.8*dvy*(1+.22*Math.abs(dvy)))*dt;
        if(b.y-b.r<.06&&sub>.99)b.vy+=Math.min(7,flow[0]**2*8)*dt;
        b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
        const wallL=this.paddleFace(b.y)+b.r,wallR=this.L/2-b.r-.025;
        if(b.x<wallL){b.x=wallL;b.vx=Math.abs(b.vx)*.45+Math.max(0,this.paddleVel)*.7;}
        if(b.x>wallR){b.x=wallR;b.vx=-Math.abs(b.vx)*.42;}
        const zMax=this.W/2-b.r-.02;if(Math.abs(b.z)>zMax){b.z=Math.sign(b.z)*zMax;b.vz*=-.45;}
        if(b.y<b.r+.035){b.y=b.r+.035;if(b.vy<-.4){this.collisions++;this.onEvent('sub-hit',Math.abs(b.vy),b);}b.vy=Math.abs(b.vy)*.16;if(b.vy<.08)b.vy=0;const friction=dt*.19;b.vx=Math.sign(b.vx)*Math.max(0,Math.abs(b.vx)-friction);b.vz=Math.sign(b.vz)*Math.max(0,Math.abs(b.vz)-friction);}
        if(b.entered&&sub>0&&sub<1&&Math.abs(b.vy)>.12){
          const ix=clamp(Math.round((b.x+this.L/2)/this.dx),1,nx-2),iz=clamp(Math.round((b.z+this.W/2)/this.dz),1,nz-2),push=clamp(-b.vy*dt*.08,-.006,.006);
          for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++)this.eta[(iz+z)*nx+ix+x]+=push*(x===0?2:1)*(z===0?2:1)/16;
        }
        b.rollX+=b.vz*dt/b.r;b.rollZ-=b.vx*dt/b.r;
      }
      rigidPairs(this.balls,dt,(v,b)=>{this.collisions++;this.ballCollisions++;this.onEvent('sub-hit',v,b);});
      // Pair separation must not leave a sphere below the floor or through glass.
      for(const b of this.balls)if(b.released){b.x=clamp(b.x,this.paddleFace(b.y)+b.r,this.L/2-b.r-.025);b.z=clamp(b.z,-this.W/2+b.r+.02,this.W/2-b.r-.02);b.y=Math.max(b.y,b.r+.035);}
      for(const d of this.drops){
        d.age+=dt;d.vy-=g*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;
        if(Math.abs(d.x)>=this.L/2||Math.abs(d.z)>=this.W/2){d.dead=true;continue;}
        if(d.y<=this.surface(d.x,d.z)&&d.vy<0){
          d.dead=true;this.disturb(d.x,d.z,Math.min(.008,d.r*Math.abs(d.vy)*.035));
          if(d.r>.032)this.rings.push({x:d.x,z:d.z,t:this.t,power:.13,radius:.035,crown:false});
        }
      }
      this.drops=this.drops.filter(d=>!d.dead&&d.age<1.5);
      this.rings=this.rings.filter(r=>this.t-r.t<1.45);
    }
    get paddleRest(){return -this.L/2+.12+this.p.amplitude*Math.max(1,this.p.height*.87*.4);}
    paddleFace(y){return this.paddleRest+(this.p.device==='flap'?Math.sin(this.paddle*.4)*clamp(y-.03,0,this.p.height*.87):this.paddle)+.07;}
    get phase(){
      if(this.waveOverride===true)return ['手动造浪','推板持续运行，可随时停止或投放球体'];
      if(this.waveOverride===false)return ['造浪已停止',this.waveEnergy<.008?'水面已平静，可再次造浪或投放球体':'手动控制已接管，残余波浪逐渐衰减'];
      if(!this.started||this.t<.65)return ['准备就绪','四组等尺寸球体，从水面上方释放'];
      if(this.lastEntry===null)return ['释放与入水','入水冲击激起水面扰动'];
      if(this.waveActive)return ['持续造浪',`剩余 ${Math.max(0,this.waveStop-this.t).toFixed(1)} 秒 · 表面起伏、中层漂移、底部滚动`];
      if(this.t<this.waveStart)return ['浮沉分化',`全部入水，${Math.max(0,this.waveStart-this.t).toFixed(2)} 秒后启动推板`];
      if(this.settled)return ['分层稳定','密度决定浮沉，水体回归平静'];
      return ['余波衰减','推板已停止，波浪与水流逐渐消退'];
    }
    get settled(){return this.waveStop!==null&&this.t>this.waveStop+8&&!this.waveActive&&this.waveEnergy<.014&&this.balls.every(b=>Math.hypot(b.vx,b.vy,b.vz)<.075);}
  }
  window.Physics={JellySim,TankSim,defaults,DT,clamp,lerp,rng};
})();
