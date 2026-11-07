/* environment.js — 协议层、远景网络、数据流、氛围 */
(function(){
'use strict';
const G = window.G;

class Environment {
  constructor(scene, theme){
    this.scene = scene;
    this.theme = theme || 'corp';
    this.group = new THREE.Group();
    scene.add(this.group);
    this.streams = [];
    this.distantClusters = [];
    this.protocolLayers = [];
    this.t = 0;
    this._build();
  }

  _build(){
    const th = this.theme;
    // 主题色
    const pal = {
      corp:  { fog:0x081224, layer:0x113355, accent:0x2288cc, distant:0x1a4466 },
      back:  { fog:0x060e20, layer:0x112244, accent:0x2277bb, distant:0x163655 },
      ics:   { fog:0x081418, layer:0x113328, accent:0x228866, distant:0x164438 }
    }[th] || { fog:0x081224, layer:0x113355, accent:0x2288cc, distant:0x1a4466 };

    // 雾
    this.scene.fog = new THREE.FogExp2(pal.fog, 0.012);

    // ---- 协议层（下方纵深）----
    for(let i=0;i<5;i++){
      const size = 90 + i*26;
      const geo = new THREE.PlaneGeometry(size, size, 18, 18);
      const mat = new THREE.MeshBasicMaterial({
        color: pal.layer, transparent:true,
        opacity: 0.10 + i*0.018,
        wireframe: i%2===0,
        side: THREE.DoubleSide,
        depthWrite:false
      });
      const plane = new THREE.Mesh(geo, mat);
      plane.rotation.x = -Math.PI/2;
      plane.position.y = -2.2 - i*1.65;
      this.group.add(plane);
      this.protocolLayers.push({mesh:plane, speed: 0.012+i*0.004});
    }

    // ---- 远景网络集群 ----
    for(let c=0;c<10;c++){
      const cluster = new THREE.Group();
      const cx = (Math.random()-0.5)*130;
      const cz = (Math.random()-0.5)*130;
      const cy = -6 + Math.random()*16;
      // 距离战场太近的跳过
      if(Math.abs(cx)<26 && Math.abs(cz)<26 && cy>-2) continue;
      const n = 5 + Math.floor(Math.random()*8);
      for(let i=0;i<n;i++){
        const s = 0.5 + Math.random()*1.8;
        const m = new THREE.Mesh(new THREE.BoxGeometry(s,s,s),
          new THREE.MeshBasicMaterial({
            color: pal.distant, transparent:true, opacity: 0.35+Math.random()*0.35
          }));
        m.position.set(
          cx + (Math.random()-0.5)*10,
          cy + (Math.random()-0.5)*6,
          cz + (Math.random()-0.5)*10
        );
        cluster.add(m);
      }
      // 连接线
      const pts = [];
      for(let i=0;i<n;i++) pts.push(cluster.children[i].position.clone());
      for(let i=0;i<n-1;i++){
        const geo = new THREE.BufferGeometry().setFromPoints([pts[i], pts[i+1]]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: pal.accent, transparent:true, opacity:0.18
        }));
        cluster.add(line);
      }
      this.group.add(cluster);
      this.distantClusters.push({group:cluster, baseY:cy, phase:Math.random()*Math.PI*2});
    }

    // ---- 星空/数据尘埃 ----
    const dustCount = 500;
    const pos = new Float32Array(dustCount*3);
    const col = new Float32Array(dustCount*3);
    for(let i=0;i<dustCount;i++){
      pos[i*3] = (Math.random()-0.5)*160;
      pos[i*3+1] = -12 + Math.random()*45;
      pos[i*3+2] = (Math.random()-0.5)*160;
      const c = new THREE.Color(pal.accent).lerp(new THREE.Color(0xffffff), Math.random()*0.6);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(col,3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size:0.18, vertexColors:true, transparent:true, opacity:0.55, depthWrite:false
    }));
    this.group.add(dust);
    this.dust = dust;

    // ---- 动态数据流（远处弧线）----
    for(let i=0;i<14;i++){
      const pts = [];
      const x0 = (Math.random()-0.5)*110;
      const z0 = (Math.random()-0.5)*110;
      const y0 = 2 + Math.random()*18;
      const x1 = (Math.random()-0.5)*110;
      const z1 = (Math.random()-0.5)*110;
      const y1 = 2 + Math.random()*18;
      for(let s=0;s<=16;s++){
        const t = s/16;
        pts.push(new THREE.Vector3(
          x0+(x1-x0)*t,
          y0+(y1-y0)*t + Math.sin(t*Math.PI)*6,
          z0+(z1-z0)*t
        ));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 24, 0.06, 5, false);
      const mat = new THREE.MeshBasicMaterial({
        color: pal.accent, transparent:true, opacity:0.16
      });
      const tube = new THREE.Mesh(geo, mat);
      this.group.add(tube);
      // 流动光点
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5),
        new THREE.MeshBasicMaterial({color:0x88ddff, transparent:true, opacity:0.75}));
      this.group.add(dot);
      this.streams.push({curve, dot, t: Math.random(), speed: 0.05+Math.random()*0.1});
    }

    // ---- 战场地面辉光 ----
    const glowGeo2 = new THREE.PlaneGeometry(60, 45);
    const glowMat2 = new THREE.MeshBasicMaterial({
      color: pal.accent, transparent:true, opacity:0.04,
      side: THREE.DoubleSide, depthWrite:false
    });
    const glow2 = new THREE.Mesh(glowGeo2, glowMat2);
    glow2.rotation.x = -Math.PI/2;
    glow2.position.y = -0.5;
    this.group.add(glow2);

    // ---- 悬浮装饰立方体 ----
    for(let i=0;i<25;i++){
      const size = 0.3 + Math.random()*1.2;
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshBasicMaterial({
          color: pal.distant, transparent:true, opacity: 0.12 + Math.random()*0.2
        })
      );
      const angle = Math.random()*Math.PI*2;
      const dist = 20 + Math.random()*40;
      cube.position.set(
        Math.cos(angle)*dist,
        -3 + Math.random()*18,
        Math.sin(angle)*dist
      );
      cube.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      cube.userData.floatSpeed = 0.15 + Math.random()*0.3;
      cube.userData.floatPhase = Math.random()*Math.PI*2;
      cube.userData.baseY = cube.position.y;
      this.group.add(cube);
      this.distantClusters.push({group:cube, baseY:cube.position.y, phase:cube.userData.floatPhase, isCube:true});
    }
  }

  update(dt, camera){
    this.t += dt;
    // 协议层缓动
    this.protocolLayers.forEach((l,i)=>{
      l.mesh.position.y += Math.sin(this.t*l.speed*8 + i)*0.0012;
      if(l.mesh.material.opacity !== undefined){
        // 微弱脉动
      }
    });
    // 远景集群漂浮
    this.distantClusters.forEach(c=>{
      if(c.isCube){
        c.group.position.y = c.baseY + Math.sin(this.t*0.3 + c.phase)*1.2;
        c.group.rotation.x += dt*0.08;
        c.group.rotation.y += dt*0.12;
      } else {
        c.group.position.y = Math.sin(this.t*0.25 + c.phase)*0.7;
        c.group.rotation.y += dt*0.015;
      }
    });
    // 数据流
    this.streams.forEach(s=>{
      s.t += dt * s.speed;
      if(s.t>1) s.t -= 1;
      const p = s.curve.getPointAt(s.t);
      s.dot.position.copy(p);
    });
    // 尘埃缓慢旋转
    if(this.dust) this.dust.rotation.y += dt*0.008;
  }
}

G.Environment = Environment;

})();
