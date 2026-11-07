/* effects.js — 弹道、粒子、特效 */
(function(){
'use strict';
const G = window.G;

class Effects {
  constructor(scene){
    this.scene = scene;
    this.projectiles = [];
    this.particles = [];
    this.rings = [];
    this.beams = [];
    this.floaters = [];
    this._poolProj = [];
    this._poolPart = [];
  }

  // ---- 弹道 ----
  spawnProjectile(from, to, opts){
    opts = opts||{};
    const color = opts.color||0x66ccff;
    const speed = opts.speed||22;
    const size = opts.size||0.12;
    const type = opts.kind||'bolt';
    let mesh;
    if(type==='bolt'){
      mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9}));
    } else if(type==='laser'){
      const len = 0.65;
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(size*0.35, size*0.35, len, 6),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.85}));
      mesh.lookAt(to.x, to.y, to.z);
      mesh.rotateX(Math.PI/2);
    } else if(type==='missile'){
      mesh = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(size*0.5,size*0.7,0.38,6),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9}));
      b.rotation.x=Math.PI/2;
      mesh.add(b);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(size*0.55, 0.3, 6),
        new THREE.MeshBasicMaterial({color:0xffaa33, transparent:true, opacity:0.7}));
      flame.rotation.x=-Math.PI/2; flame.position.z=-0.28;
      mesh.add(flame);
    } else if(type==='orb'){
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(size*1.6, 1),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.75, wireframe:true}));
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.85}));
    }
    mesh.position.copy(from);
    this.scene.add(mesh);
    const p = {
      mesh, from: from.clone(), to: to.clone(),
      speed, t: 0,
      total: from.distanceTo(to),
      color, size,
      trail: opts.trail!==false,
      damage: opts.damage||0,
      pierce: opts.pierce||0,
      hitIds: new Set(),
      onHit: opts.onHit||null,
      aoe: opts.aoe||0,
      kind: type,
      target: opts.target||null,   // 追踪目标
      alive: true
    };
    this.projectiles.push(p);
    return p;
  }

  // ---- 粒子爆发 ----
  burst(pos, color, count, opts){
    opts = opts||{};
    const n = count||10;
    for(let i=0;i<n;i++){
      const size = (opts.size||0.08) * (0.6+Math.random()*0.9);
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 5),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9}));
      m.position.copy(pos);
      this.scene.add(m);
      const a = Math.random()*Math.PI*2;
      const up = Math.random()*(opts.up||2.5);
      const sp = (opts.speed||3)*(0.5+Math.random());
      this.particles.push({
        mesh:m, vx:Math.cos(a)*sp, vy:up, vz:Math.sin(a)*sp,
        life: 0, maxLife: (opts.life||0.55)*(0.7+Math.random()*0.6),
        grav: opts.grav!==undefined?opts.grav:6,
        fade: true, alive:true
      });
    }
  }

  // ---- 范围环 ----
  ring(pos, radius, color, opts){
    opts = opts||{};
    const m = new THREE.Mesh(new THREE.RingGeometry(radius*0.72, radius, 28),
      new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.65, side:THREE.DoubleSide, depthWrite:false}));
    m.rotation.x = -Math.PI/2;
    m.position.copy(pos); m.position.y += 0.12;
    this.scene.add(m);
    this.rings.push({
      mesh:m, life:0, maxLife: opts.life||0.45,
      fromR: radius*0.72, toR: opts.expand? radius*1.5 : radius,
      alive:true
    });
    return m;
  }

  // ---- 光束 ----
  beam(from, to, color, opts){
    opts = opts||{};
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(opts.width||0.05, opts.width||0.05, len, 6);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent:true, opacity: opts.opacity||0.7
    }));
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    m.rotateX(Math.PI/2);
    this.scene.add(m);
    this.beams.push({mesh:m, life:0, maxLife: opts.life||0.18, alive:true});
    return m;
  }

  // ---- 飘字 ----
  floatText(pos, text, color, opts){
    opts = opts||{};
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const c = canvas.getContext('2d');
    c.font = 'bold 32px "Microsoft YaHei", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#'+(color||0xffffff).toString(16).padStart(6,'0');
    c.shadowColor = '#000'; c.shadowBlur = 6;
    c.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
    spr.scale.set(1.1, 0.55, 1);
    spr.position.copy(pos);
    spr.position.y += 1.0;
    this.scene.add(spr);
    this.floaters.push({
      mesh:spr, life:0, maxLife: opts.life||1.0,
      vy: 1.2, alive:true
    });
  }

  // ---- 闪电/链路 ----
  lightning(from, to, color, segs){
    segs = segs||6;
    const pts = [];
    for(let i=0;i<=segs;i++){
      const t = i/segs;
      const p = new THREE.Vector3().lerpVectors(from, to, t);
      if(i>0 && i<segs){
        p.x += (Math.random()-0.5)*0.55;
        p.y += (Math.random()-0.5)*0.45;
        p.z += (Math.random()-0.5)*0.55;
      }
      pts.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color, transparent:true, opacity:0.85}));
    this.scene.add(line);
    this.beams.push({mesh:line, life:0, maxLife:0.22, alive:true});
  }

  // ---- 状态光环（附加到实体）----
  statusHalo(color, radius, y){
    const m = new THREE.Mesh(new THREE.RingGeometry(radius*0.85, radius, 18),
      new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false}));
    m.rotation.x = -Math.PI/2;
    m.position.y = y||0.12;
    return m;
  }

  // ---- 更新 ----
  update(dt, camera){
    // 弹道
    for(let i=this.projectiles.length-1;i>=0;i--){
      const p = this.projectiles[i];
      if(!p.alive){ this.scene.remove(p.mesh); this.projectiles.splice(i,1); continue; }
      let targetPos = p.to;
      if(p.target && p.target.alive !== false && p.target.mesh){
        targetPos = p.target.mesh.position;
        if(p.target.meshY!==undefined) targetPos = {x:p.target.mesh.position.x, y:p.target.mesh.position.y+p.target.meshY, z:p.target.mesh.position.z};
        targetPos = new THREE.Vector3(targetPos.x, targetPos.y+(p.target.tipY||0.8), targetPos.z);
      }
      const seg = new THREE.Vector3().subVectors(targetPos, p.mesh.position);
      const dist = seg.length();
      const step = p.speed * dt;
      if(dist <= step + 0.15){
        // 命中
        p.mesh.position.copy(targetPos);
        if(p.onHit) p.onHit(targetPos, p);
        if(p.aoe>0){
          this.ring(targetPos, p.aoe, p.color, {life:0.35, expand:true});
          this.burst(targetPos, p.color, 12, {speed:5, life:0.5});
        } else {
          this.burst(targetPos, p.color, 5, {speed:3, life:0.3, size:0.06});
        }
        this.scene.remove(p.mesh);
        this.projectiles.splice(i,1);
      } else {
        seg.normalize();
        p.mesh.position.addScaledVector(seg, step);
        if(p.kind==='laser' || p.kind==='missile'){
          const look = p.mesh.position.clone().add(seg);
          p.mesh.lookAt(look);
          if(p.kind==='laser') p.mesh.rotateX(Math.PI/2);
        }
        if(p.trail && Math.random()<0.35){
          const tm = new THREE.Mesh(new THREE.SphereGeometry(p.size*0.45,5,4),
            new THREE.MeshBasicMaterial({color:p.color, transparent:true, opacity:0.5}));
          tm.position.copy(p.mesh.position);
          this.scene.add(tm);
          this.particles.push({mesh:tm, vx:0,vy:0,vz:0, life:0, maxLife:0.22, grav:0, alive:true});
        }
      }
    }
    // 粒子
    for(let i=this.particles.length-1;i>=0;i--){
      const p = this.particles[i];
      p.life += dt;
      if(p.life>=p.maxLife){
        this.scene.remove(p.mesh);
        this.particles.splice(i,1);
        continue;
      }
      p.mesh.position.x += p.vx*dt;
      p.mesh.position.y += p.vy*dt;
      p.mesh.position.z += p.vz*dt;
      p.vy -= (p.grav||6)*dt;
      if(p.mesh.position.y<0.05){ p.mesh.position.y=0.05; p.vy*=-0.35; }
      const k = 1 - p.life/p.maxLife;
      if(p.mesh.material) p.mesh.material.opacity = 0.9*k;
    }
    // 环
    for(let i=this.rings.length-1;i>=0;i--){
      const r = this.rings[i];
      r.life += dt;
      const t = r.life/r.maxLife;
      if(t>=1){ this.scene.remove(r.mesh); this.rings.splice(i,1); continue; }
      const scale = G.M.lerp(r.fromR, r.toR, G.M.easeOutCubic(t)) / (r.fromR||1);
      r.mesh.scale.set(scale, scale, scale);
      r.mesh.material.opacity = 0.65*(1-t);
    }
    // 光束
    for(let i=this.beams.length-1;i>=0;i--){
      const b = this.beams[i];
      b.life += dt;
      const t = b.life/b.maxLife;
      if(t>=1){ this.scene.remove(b.mesh); this.beams.splice(i,1); continue; }
      if(b.mesh.material) b.mesh.material.opacity = 0.8*(1-t);
    }
    // 飘字
    for(let i=this.floaters.length-1;i>=0;i--){
      const f = this.floaters[i];
      f.life += dt;
      const t = f.life/f.maxLife;
      if(t>=1){ this.scene.remove(f.mesh); this.floaters.splice(i,1); continue; }
      f.mesh.position.y += f.vy*dt;
      f.vy *= 0.96;
      f.mesh.material.opacity = 1-t*t;
    }
  }

  clear(){
    [...this.projectiles, ...this.particles, ...this.rings, ...this.beams, ...this.floaters].forEach(o=>{
      try{ this.scene.remove(o.mesh); }catch(e){}
    });
    this.projectiles=[]; this.particles=[]; this.rings=[]; this.beams=[]; this.floaters=[];
  }
}

G.Effects = Effects;

})();
