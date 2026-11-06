/* All textures are generated in memory. No image requests, modules, or local fetches. */
(() => {
  'use strict';
  const T=THREE, {clamp,rng}=Physics,TAU=Math.PI*2;
  const colors=[0xf58e86,0xf2c46c,0x84dcc4,0xa8a0ee];
  const mat=(c,rough=.4,metal=0)=>new T.MeshStandardMaterial({color:c,roughness:rough,metalness:metal});
  function mesh(geo,material,parent,x=0,y=0,z=0){const o=new T.Mesh(geo,material);o.position.set(x,y,z);parent.add(o);return o;}
  function line(points,color,parent,opacity=1){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const o=new T.Line(g,new T.LineBasicMaterial({color,transparent:opacity<1,opacity}));parent.add(o);return o;}
  function cylinder(r,h,parent,material,y=0){let o=mesh(new T.CylinderGeometry(r,r,h,128),material,parent,0,y,0);o.receiveShadow=true;o.castShadow=true;return o;}
  function box(x,y,z,material,parent,px=0,py=0,pz=0){let o=mesh(new T.BoxGeometry(x,y,z),material,parent,px,py,pz);o.receiveShadow=true;o.castShadow=true;return o;}
  function textPlane(text,width,height,color='#b5cacf',bg=null){let c=document.createElement('canvas');c.width=1024;c.height=128;let ctx=c.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);}ctx.fillStyle=color;ctx.font='42px Consolas, monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,64);let tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;let o=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,side:T.DoubleSide}));return o;}
  function clipToTank(material,sim){
    material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 vSplashPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSplashPosition=position;');
      shader.fragmentShader='varying vec3 vSplashPosition;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nif(abs(vSplashPosition.x)>${(sim.L/2-.035).toFixed(4)}||abs(vSplashPosition.z)>${(sim.W/2-.035).toFixed(4)})discard;`);
    };
  }
  function environment(renderer){
    const c=document.createElement('canvas');c.width=2048;c.height=1024;const x=c.getContext('2d');let g=x.createLinearGradient(0,0,0,1024);g.addColorStop(0,'#8b9b9f');g.addColorStop(.43,'#283a44');g.addColorStop(.52,'#a8b8bd');g.addColorStop(.6,'#354951');g.addColorStop(1,'#0c151b');x.fillStyle=g;x.fillRect(0,0,2048,1024);
    x.filter='blur(16px)';x.fillStyle='#ffffff';x.fillRect(250,170,210,340);x.fillRect(1200,120,460,130);x.fillStyle='#bddce0';x.fillRect(1800,300,80,260);x.fillStyle='#e3ecce';x.fillRect(790,340,55,230);x.filter='none';
    const tx=new T.CanvasTexture(c);tx.mapping=T.EquirectangularReflectionMapping;tx.colorSpace=T.SRGBColorSpace;const pm=new T.PMREMGenerator(renderer),rt=pm.fromEquirectangular(tx);tx.dispose();pm.dispose();return rt.texture;
  }
  class VisualEngine{
    constructor(canvas){
      this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
      this.environment=environment(this.renderer);this.camera=new T.PerspectiveCamera(34,1,.1,100);this.target=new T.Vector3();this.azimuth=.54;this.elevation=.38;this.distance=13;this.zoom=1;this.scene=null;this.balls=[];this.ballMeshes=[];this.type='jelly';this.width=1;this.height=1;
    }
    resize(w,h,exporting=false){this.width=w;this.height=h;this.renderer.setPixelRatio(exporting?1:Math.min(window.devicePixelRatio||1,2));this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.updateCamera();}
    setView(view=0){this.view=view;if(view===0){this.azimuth=this.type==='jelly'?.53:.22;this.elevation=this.type==='jelly'?.48:.25;}else if(view===1){this.azimuth=0;this.elevation=.075;}else{this.azimuth=.18;this.elevation=1.08;}this.zoom=1;this.updateCamera();}
    updateCamera(){if(!this.scene)return;const aspect=this.width/this.height,fit=this.type==='tank'?Math.max(1,1.43/aspect):Math.max(1,1.03/aspect),d=this.distance*fit*this.zoom;this.camera.position.set(this.target.x+d*Math.sin(this.azimuth)*Math.cos(this.elevation),this.target.y+d*Math.sin(this.elevation),this.target.z+d*Math.cos(this.azimuth)*Math.cos(this.elevation));this.camera.lookAt(this.target);this.camera.updateProjectionMatrix();}
    clear(){if(!this.scene)return;const gs=new Set(),ms=new Set(),ts=new Set();this.scene.traverse(o=>{if(o.shadow&&o.shadow.map)o.shadow.map.dispose();if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){ms.add(m);if(m.map)ts.add(m.map);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
    build(type,sim){
      this.clear();this.type=type;this.sim=sim;this.scene=new T.Scene();this.scene.background=new T.Color(0x142128);this.scene.fog=new T.FogExp2(0x142128,.028);this.scene.environment=this.environment;this.ballMeshes=[];
      const hemi=new T.HemisphereLight(0xdce9e8,0x1e333b,1.35);this.scene.add(hemi);
      const key=new T.DirectionalLight(0xfff3dc,3.3);key.position.set(-3.5,9,6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=9;key.shadow.camera.bottom=-6;key.shadow.normalBias=.025;key.shadow.bias=-.0003;key.shadow.radius=4;this.scene.add(key);
      const rim=new T.DirectionalLight(0x9dd9ec,3.2);rim.position.set(5,5,-6);this.scene.add(rim);const fill=new T.DirectionalLight(0xd7efc2,1.2);fill.position.set(-6,2,-1);this.scene.add(fill);
      let floor=mesh(new T.PlaneGeometry(200,200),mat(0x0c191f,.83,.1),this.scene,0,-.2,0);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
      const grid=new T.GridHelper(44,44,0x385059,0x2b414a);grid.position.y=-.195;grid.material.transparent=true;grid.material.opacity=.42;grid.visible=type==='jelly';this.scene.add(grid);
      const top=Math.max(...sim.balls.map(b=>b.y+b.r));
      if(type==='jelly'){
        const extra=Math.max(0,top-5.35);this.target.set(0,1.42+extra*.28,0);this.distance=15.4+extra*2.2+Math.max(0,sim.R-1.9)*.6;this.buildJelly(sim);
      }else{
        const extra=Math.max(0,top-3.84);this.target.set(0,1.65+extra*.25,0);this.distance=14.8*Math.max(1,sim.L/8.6,1+extra*.3,1+Math.max(0,sim.W-3.1)*.12);this.buildTank(sim);
      }
      this.setView(0);this.sync(sim);
    }
    buildJelly(sim){
      const s=this.scene,R=sim.R,H=sim.H;
      cylinder(3.48,.27,s,mat(0x101c23,.36,.65),-.015);cylinder(3.4,.085,s,mat(0x253b44,.29,.62),.17);
      const rim=mesh(new T.TorusGeometry(3.42,.018,8,160),new T.MeshStandardMaterial({color:0x8ba8a8,metalness:.5,roughness:.3,emissive:0x8da6a0,emissiveIntensity:.1}),s,0,.219,0);rim.rotation.x=Math.PI/2;
      for(let i=0;i<72;i++){const a=i/72*TAU,r=3.25,len=i%6===0?.13:.055;line([[Math.cos(a)*r,.222,Math.sin(a)*r],[Math.cos(a)*(r-len),.222,Math.sin(a)*(r-len)]],0x8babae,s,i%6===0?.6:.25);}
      const label=textPlane('01  /  ELASTIC RESPONSE',2.0,.25,'#9bb1b3');label.rotation.x=-Math.PI/2;label.position.set(0,.225,2.85);s.add(label);
      for(const x of [-2.25,2.25])for(const z of [-1.7,1.7]){let screw=mesh(new T.CylinderGeometry(.045,.045,.012,16),mat(0x81999b,.22,.9),s,x,.226,z);line([[x-.025,.235,z],[x+.025,.235,z]],0x243c43,s);}
      const profile=[[0,0],[R*.91,0],[R*.97,.035],[R,.11]];
      for(let j=1;j<=15;j++)profile.push([R, .11+(H-.25)*j/15]);
      for(let j=1;j<=6;j++){const a=j/6*Math.PI/2;profile.push([R-.13+.13*Math.cos(a),H-.14+.14*Math.sin(a)]);}
      for(let j=1;j<=32;j++)profile.push([(R-.13)*(1-j/32),H]);
      const ns=120,pos=[],idx=[];this.jellyRest=[];
      for(let j=0;j<profile.length;j++)for(let i=0;i<=ns;i++){let a=i/ns*TAU,x=profile[j][0]*Math.cos(a),y=profile[j][1],z=profile[j][0]*Math.sin(a);pos.push(x,y+sim.base,z);this.jellyRest.push(x,y,z);}
      for(let j=0;j<profile.length-1;j++)for(let i=0;i<ns;i++){let a=j*(ns+1)+i,b=a+ns+1;idx.push(a,b,a+1,b,b+1,a+1);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
      const jellyMat=new T.MeshPhysicalMaterial({color:0x75e3be,metalness:0,roughness:.12,transmission:.84,thickness:1.45,ior:1.37,attenuationColor:0x40bd94,attenuationDistance:2.9,clearcoat:.65,clearcoatRoughness:.14,envMapIntensity:.85});
      this.jelly=mesh(geo,jellyMat,s);this.jelly.castShadow=true;this.jelly.receiveShadow=true;
      this.bubbleRest=[];const random=rng(981);const bubbleMat=new T.MeshStandardMaterial({color:0x6aa792,roughness:.16,metalness:.12});
      this.bubbles=new T.InstancedMesh(new T.SphereGeometry(1,10,8),bubbleMat,55);this.bubbles.instanceMatrix.setUsage(T.DynamicDrawUsage);s.add(this.bubbles);
      for(let i=0;i<55;i++){let a=random()*TAU,r=Math.sqrt(random())*(R-.12);this.bubbleRest.push([Math.cos(a)*r,.12+random()*(H-.24),Math.sin(a)*r,.008+random()*.015]);}
      // A fine physical registration ring makes lateral expansion readable.
      const contactRing=mesh(new T.RingGeometry(R+.04,R+.047,160),new T.MeshBasicMaterial({color:0x98c7b4,transparent:true,opacity:.18,side:T.DoubleSide}),s,0,.224,0);contactRing.rotation.x=-Math.PI/2;
      this.createBalls(sim);
    }
    createBalls(sim){
      while(this.ballMeshes.length<sim.balls.length){const b=sim.balls[this.ballMeshes.length],g=new T.Group();this.scene.add(g);
        let material=this.type==='jelly'?new T.MeshPhysicalMaterial({color:0xabb9bd,metalness:1,roughness:.145,clearcoat:.7,clearcoatRoughness:.13}):new T.MeshPhysicalMaterial({color:colors[b.group],metalness:.16,roughness:.24,clearcoat:1,clearcoatRoughness:.17});
        const ball=mesh(new T.SphereGeometry(b.r,48,32),material,g);ball.castShadow=true;ball.receiveShadow=true;
        // A restrained equatorial inlay reveals rigid-body rotation.
        const ring=mesh(new T.TorusGeometry(b.r*1.001,this.type==='jelly'?.006:.006,6,80),mat(this.type==='jelly'?0x3b515a:colors[b.group],.35,.5),g);ring.rotation.x=Math.PI/2;
        if(this.type==='tank'){const pole=mesh(new T.CircleGeometry(b.r*.16,20),new T.MeshStandardMaterial({color:0xffffff,roughness:.5,transparent:true,opacity:.65}),g,0,0,b.r*1.002);}
        this.ballMeshes.push(g);
      }
    }
    buildTank(sim){
      const s=this.scene,p=sim.p,L=sim.L,W=sim.W,H=p.height;
      const base=box(L+.55,.26,W+.55,mat(0x263d46,.29,.68),s,0,-.13,0);base.receiveShadow=true;
      const footMat=mat(0x111c22,.5,.5);for(const x of [-L/2+.35,L/2-.35])for(const z of [-W/2+.3,W/2-.3])box(.3,.16,.3,footMat,s,x,-.27,z);
      // Subtle animated caustics on the visible tank floor, driven by water energy.
      const causticMat=new T.MeshStandardMaterial({color:0x668a8c,roughness:.48,metalness:.1});
      causticMat.onBeforeCompile=shader=>{shader.uniforms.waveTime={value:0};shader.uniforms.wavePower={value:0};shader.vertexShader='varying vec3 vLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLocal = position;');shader.fragmentShader='varying vec3 vLocal;\nuniform float waveTime;\nuniform float wavePower;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 q=vLocal.xy*3.8;
        float a=sin(q.x*1.8+sin(q.y*1.4+waveTime*.55))+sin(q.y*2.2-sin(q.x+waveTime*.34));
        float b=sin(q.x*1.7+q.y*1.2-waveTime*.32)+cos(q.y*2.3-q.x*.4+waveTime*.4);
        float caustic=pow(max(0.0,1.0-abs(a+b)*.9),9.0);
        diffuseColor.rgb+=vec3(.2,.38,.34)*caustic*(.3+wavePower);
      `);this.causticShader=shader;};
      this.tankBottom=mesh(new T.PlaneGeometry(L,W),causticMat,s,0,.013,0);this.tankBottom.rotation.x=-Math.PI/2;this.tankBottom.receiveShadow=true;
      const edgeMat=new T.MeshPhysicalMaterial({color:0xb9dce4,metalness:.6,roughness:.16,clearcoat:1});
      for(const z of [-W/2,W/2]){box(L+.08,.045,.045,edgeMat,s,0,H,z);box(L+.08,.06,.065,edgeMat,s,0,.035,z);}
      for(const x of [-L/2,L/2]){box(.045,.045,W,edgeMat,s,x,H,0);box(.06,.06,W,edgeMat,s,x,.035,0);for(const z of [-W/2,W/2])box(.034,H,.034,edgeMat,s,x,H/2,z);}
      const glassMat=new T.MeshPhysicalMaterial({color:0xafdce2,transparent:true,opacity:.065,roughness:.12,metalness:.2,side:T.DoubleSide,depthWrite:false,clearcoat:1});
      for(const z of [-W/2,W/2]){let pane=mesh(new T.PlaneGeometry(L,H),glassMat,s,0,H/2,z);pane.renderOrder=5;}
      for(const x of [-L/2,L/2]){let pane=mesh(new T.PlaneGeometry(W,H),glassMat,s,x,H/2,0);pane.rotation.y=Math.PI/2;pane.renderOrder=5;}
      // Water surface and side sheets share the same solved height field.
      const geo=new T.PlaneGeometry(L,W,sim.nx-1,sim.nz-1);geo.rotateX(-Math.PI/2);
      const waterMat=new T.MeshPhysicalMaterial({color:0x23879f,roughness:.16,metalness:.08,transmission:.24,thickness:.22,ior:1.333,transparent:true,opacity:.66,depthWrite:false,side:T.DoubleSide,clearcoat:1,clearcoatRoughness:.15,envMapIntensity:1.1});
      waterMat.onBeforeCompile=shader=>{
        shader.uniforms.rippleTime={value:0};shader.uniforms.rippleEnergy={value:0};
        shader.vertexShader='varying vec3 vWaterPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterPosition = position;');
        shader.fragmentShader='varying vec3 vWaterPosition;\nuniform float rippleTime;\nuniform float rippleEnergy;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec2 q=vWaterPosition.xz;
          float rippleX=sin(q.x*16.0+q.y*11.0-rippleTime*3.0)+sin(q.x*24.0-q.y*19.0+rippleTime*2.0)*.4;
          float rippleZ=cos(q.x*13.0-q.y*17.0-rippleTime*2.7);
          normal=normalize(normal+vec3(rippleX,rippleZ,0.0)*rippleEnergy*.055);
        `);this.waterShader=shader;
      };
      this.water=mesh(geo,waterMat,s);this.water.renderOrder=3;
      this.waterSides=[];
      const sideMat=new T.MeshPhysicalMaterial({color:0x3299ad,metalness:0,roughness:.3,transparent:true,opacity:.14,depthWrite:false,side:T.DoubleSide});
      for(let side=0;side<4;side++){
        let segments=side<2?sim.nx-1:sim.nz-1,positions=[],indices=[];
        for(let i=0;i<=segments;i++){let x=side<2?-L/2+i/segments*L:(side===2?-L/2:L/2),z=side<2?(side===0?-W/2:W/2):-W/2+i/segments*W;positions.push(x,0,z,x,sim.H,z);if(i<segments){let a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
        const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(positions,3));sg.setIndex(indices);sg.computeVertexNormals();const sm=mesh(sg,sideMat,s);sm.renderOrder=4;this.waterSides.push(sm);
      }
      this.waterLines=[];
      for(const z of [-W/2+.01,W/2-.01]){let pts=[];for(let i=0;i<sim.nx;i++)pts.push([-L/2+i*sim.dx,sim.H,z]);let ln=line(pts,0x9ddce2,s,.72);ln.renderOrder=6;this.waterLines.push(ln);}
      this.waveStreaks=[];
      // Visible sliding wave paddle, guide rails, motor housing and face ribs.
      this.paddleGroup=new T.Group();s.add(this.paddleGroup);this.paddleGroup.position.set(sim.paddleRest,0,0);
      this.platePivot=new T.Group();this.platePivot.position.y=.03;this.paddleGroup.add(this.platePivot);
      const plateMat=mat(0x8aa6ad,.27,.8);this.plate=box(.13,H*.87,W-.15,plateMat,this.platePivot,0,H*.435,0);
      for(let z=-W/2+.25;z<W/2;z+=.28)box(.017,H*.65,.027,mat(0x435e69,.4,.7),this.platePivot,.074,H*.47,z);
      box(.055,.5,.055,mat(0xa4bcc2,.18,.95),this.paddleGroup,0,H-.12,0);
      const device=box(.62,.32,.66,mat(0x273e49,.24,.7),s,-L/2-.16,H+.17,0);let cap=box(.64,.027,.68,mat(0xbec8bc,.3,.8),s,-L/2-.16,H+.34,0);
      for(const z of [-.22,.22]){let rod=mesh(new T.CylinderGeometry(.025,.025,.87,12),mat(0xc1d2d5,.13,1),s,-L/2+.12,H+.08,z);rod.rotation.z=Math.PI/2;}
      this.actuator=box(.15,.38,.35,mat(0xd4ec91,.26,.5),this.paddleGroup,0,H+.05,0);
      const tiny=textPlane('WAVE / 01',.55,.09,'#2d424b');tiny.rotation.x=-Math.PI/2;tiny.position.set(-L/2-.16,H+.356,0);s.add(tiny);
      // Physical depth gauge on the rear pane.
      for(let y=.25;y<H;y+=.25){const major=Math.round(y*4)%4===0;line([[L/2-.32,y,-W/2+.012],[L/2-(major?.14:.21),y,-W/2+.012]],0xdaefed,s,major?.7:.35);if(major){let label=textPlane(y.toFixed(0),.13,.09,'#adc8ce');label.position.set(L/2-.42,y,-W/2+.02);s.add(label);}}
      const title=textPlane('DENSITY  /  WAVE INTERACTION',3,.22,'#b6cdd0');title.position.set(.5,-.11,W/2+.288);s.add(title);
      this.droplets=new T.InstancedMesh(new T.SphereGeometry(1,12,8),new T.MeshPhysicalMaterial({color:0xb9edf1,metalness:.12,roughness:.09,clearcoat:1,transparent:true,opacity:.85,depthWrite:false}),600);this.droplets.instanceMatrix.setUsage(T.DynamicDrawUsage);this.droplets.count=0;this.droplets.frustumCulled=false;this.droplets.renderOrder=6;s.add(this.droplets);
      this.rippleMeshes=[];for(let i=0;i<100;i++){
        const material=new T.MeshBasicMaterial({color:0xb6e7e9,transparent:true,opacity:.3,side:T.DoubleSide,depthWrite:false});clipToTank(material,sim);
        const r=mesh(new T.RingGeometry(.98,1,96),material,s);r.visible=false;r.frustumCulled=false;r.renderOrder=6;this.rippleMeshes.push(r);
      }
      this.crownMeshes=[];
      for(let i=0;i<20;i++){
        const positions=new Float32Array(5*65*3),indices=[];for(let j=0;j<4;j++)for(let a=0;a<64;a++){const k=j*65+a;indices.push(k,k+65,k+1,k+65,k+66,k+1);}
        const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setIndex(indices);
        const material=new T.MeshPhysicalMaterial({color:0xafe8ec,roughness:.08,metalness:0,transmission:.4,thickness:.025,transparent:true,opacity:.44,side:T.DoubleSide,depthWrite:false,clearcoat:1});clipToTank(material,sim);
        const o=mesh(geo,material,s);o.visible=false;o.frustumCulled=false;o.renderOrder=6;this.crownMeshes.push(o);
      }
      this.createBalls(sim);
    }
    sync(sim,delta=0){
      this.sim=sim;this.createBalls(sim);
      for(let i=0;i<sim.balls.length;i++){let b=sim.balls[i],o=this.ballMeshes[i],d=b.released?delta:0;o.position.set(b.x+b.vx*d,b.y+b.vy*d,b.z+b.vz*d);o.rotation.set(b.rollX+b.vz*d/b.r,0,b.rollZ-b.vx*d/b.r);}
      const dummy=new T.Object3D();
      if(this.type==='jelly'){
        let arr=this.jelly.geometry.attributes.position.array;for(let i=0;i<this.jellyRest.length;i+=3){let v=sim.deform(this.jellyRest[i],this.jellyRest[i+1],this.jellyRest[i+2],delta);arr[i]=v[0];arr[i+1]=v[1];arr[i+2]=v[2];}this.jelly.geometry.attributes.position.needsUpdate=true;this.jelly.geometry.computeVertexNormals();this.jelly.geometry.computeBoundingSphere();
        for(let i=0;i<this.bubbleRest.length;i++){let b=this.bubbleRest[i],v=sim.deform(b[0],b[1],b[2],delta);dummy.position.set(...v);dummy.scale.setScalar(b[3]);dummy.updateMatrix();this.bubbles.setMatrixAt(i,dummy.matrix);}this.bubbles.instanceMatrix.needsUpdate=true;
      }else{
        const pos=this.water.geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,sim.surface(x,z,delta));}pos.needsUpdate=true;this.water.geometry.computeVertexNormals();
        for(const o of this.waterSides){const a=o.geometry.attributes.position;for(let i=1;i<a.count;i+=2)a.setY(i,sim.surface(a.getX(i),a.getZ(i),delta));a.needsUpdate=true;}
        for(const o of [...this.waterLines,...this.waveStreaks]){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,sim.surface(a.getX(i),a.getZ(i),delta)+.009);a.needsUpdate=true;}
        for(const o of this.waveStreaks)o.material.opacity=.03+Math.min(.18,sim.waveEnergy*.45);
        this.paddleGroup.position.x=sim.paddleRest+(sim.p.device==='piston'?sim.paddle+sim.paddleVel*delta:0);this.platePivot.rotation.z=sim.p.device==='flap'?-(sim.paddle+sim.paddleVel*delta)*.4:0;
        if(this.causticShader){this.causticShader.uniforms.waveTime.value=sim.causticTime+Math.min(1.6,sim.waveEnergy*10)*delta;this.causticShader.uniforms.wavePower.value=Math.min(1,sim.waveEnergy*2);}
        if(this.waterShader){this.waterShader.uniforms.rippleTime.value=sim.t+delta;this.waterShader.uniforms.rippleEnergy.value=sim.waveEnergy;}
        let count=Math.min(600,sim.drops.length);this.droplets.count=count;for(let i=0;i<count;i++){const d=sim.drops[i];dummy.position.set(d.x+d.vx*delta,d.y+d.vy*delta,d.z+d.vz*delta);dummy.scale.set(d.r,d.r*(1+Math.abs(d.vy)*.13),d.r);dummy.updateMatrix();this.droplets.setMatrixAt(i,dummy.matrix);}this.droplets.instanceMatrix.needsUpdate=true;
        const rings=sim.rings.filter(r=>r.crown).concat(sim.rings.filter(r=>!r.crown));
        for(let i=0;i<this.rippleMeshes.length;i++){
          const o=this.rippleMeshes[i],r=rings[i];o.visible=!!r;if(!r)continue;
          const age=sim.t+delta-r.t,rad=r.radius+age*Math.sqrt(sim.p.gravity*.16),a=o.geometry.attributes.position;
          for(let row=0;row<2;row++)for(let j=0;j<=96;j++){
            const angle=j/96*TAU,rr=rad-(row===0?.014:0),x=r.x+Math.cos(angle)*rr,z=r.z+Math.sin(angle)*rr;
            a.setXYZ(row*97+j,x,sim.surface(x,z,delta)+.016,z);
          }
          a.needsUpdate=true;o.material.opacity=Math.max(0,(1-age/1.45)*.28*r.power);
        }
        const crowns=rings.filter(r=>r.crown&&sim.t+delta-r.t<Math.min(.7,2*r.power*1.9/sim.p.gravity));
        for(let i=0;i<this.crownMeshes.length;i++){
          const o=this.crownMeshes[i],r=crowns[i];o.visible=!!r;if(!r)continue;
          const age=sim.t+delta-r.t,lift=Math.max(0,r.power*1.9*age-.5*sim.p.gravity*age*age),base=r.radius+age*.45,a=o.geometry.attributes.position;
          for(let row=0;row<5;row++)for(let j=0;j<=64;j++){
            const angle=j/64*TAU,h=row/4,crest=.77+.17*Math.cos(angle*11+r.x)+.06*Math.sin(angle*17+r.z);
            const rad=base+h*h*(.04+age*.42),x=r.x+Math.cos(angle)*rad,z=r.z+Math.sin(angle)*rad;
            a.setXYZ(row*65+j,x,sim.surface(x,z,delta)+.01+lift*h*crest,z);
          }
          a.needsUpdate=true;o.geometry.computeVertexNormals();o.material.opacity=Math.min(.44,lift*4.2);
        }
      }
    }
    render(){this.renderer.render(this.scene,this.camera);}
  }
  window.VisualEngine=VisualEngine;
})();
