/* Procedural, solid geometry. All component IDs are shared with the SVG overlay. */
window.BlackwellScene = (() => {
  const T=THREE, canvas=document.getElementById('world');
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.1,200);scene.fog=new T.FogExp2(0x101311,.008);
  const root=new T.Group();scene.add(root);
  const ambient=new T.HemisphereLight(0xddebd1,0x12170d,2);scene.add(ambient);
  const key=new T.DirectionalLight(0xe6f6dc,5);key.position.set(-9,16,7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:70});key.shadow.bias=-.0008;key.shadow.normalBias=.025;scene.add(key);
  const rim=new T.DirectionalLight(0xb6e3e3,3.5);rim.position.set(8,6,-12);scene.add(rim);const warm=new T.PointLight(0xc8ff79,35,35);warm.position.set(7,4,3);scene.add(warm);
  // Generated studio environment: emissive panels reflected in silicon and metal.
  const envScene=new T.Scene();envScene.background=new T.Color(0x384137);const envMat=new T.MeshBasicMaterial({color:0xeaf5d9,side:T.DoubleSide});[[0,8,0,18,8,-Math.PI/2,0],[-8,2,0,10,12,0,Math.PI/2],[8,3,-4,4,10,0,-Math.PI/2]].forEach(v=>{let p=new T.Mesh(new T.PlaneGeometry(v[3],v[4]),envMat);p.position.set(v[0],v[1],v[2]);p.rotation.set(v[5],v[6],0);envScene.add(p);});const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(envScene,.04).texture;pmrem.dispose();
  const mats={substrate:new T.MeshStandardMaterial({color:0x173e29,metalness:.45,roughness:.43}),substrate2:new T.MeshStandardMaterial({color:0x102a20,metalness:.3,roughness:.5}),copper:new T.MeshStandardMaterial({color:0x9e774c,metalness:.9,roughness:.27}),gold:new T.MeshStandardMaterial({color:0xc2b070,metalness:.8,roughness:.3}),metal:new T.MeshStandardMaterial({color:0x6c796e,metalness:.95,roughness:.25}),dark:new T.MeshStandardMaterial({color:0x182019,metalness:.75,roughness:.32}),silicon:new T.MeshPhysicalMaterial({color:0x335650,metalness:.8,roughness:.19,clearcoat:1,clearcoatRoughness:.1,iridescence:1,iridescenceIOR:1.35,iridescenceThicknessRange:[180,520]}),memory:new T.MeshPhysicalMaterial({color:0x52604e,metalness:.8,roughness:.24,clearcoat:.7,iridescence:.55,iridescenceThicknessRange:[180,350]}),lime:new T.MeshStandardMaterial({color:0xb8ec6c,emissive:0x87bb3f,emissiveIntensity:.75,metalness:.4,roughness:.25}),blue:new T.MeshStandardMaterial({color:0x669baa,emissive:0x1f4a56,emissiveIntensity:.5,metalness:.6,roughness:.3}),trace:new T.MeshStandardMaterial({color:0x687549,metalness:.85,roughness:.35})};
  const boxGeo=new T.BoxGeometry(1,1,1),sphereGeo=new T.SphereGeometry(1,7,5),cylGeo=new T.CylinderGeometry(1,1,1,6);
  const parts={},pickables=[],dieGroups=[],hbmGroups=[],layers=[],activeTiles=[],allBox=[];
  function box(parent,w,h,d,x,y,z,mat,id){const m=new T.Mesh(boxGeo,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);m.userData.size=[w,h,d];m.userData.origin=[x,y,z];allBox.push(m);if(id){m.userData.part=id;pickables.push(m);}return m;}
  function instanced(parent,geo,mat,items,id){const mesh=new T.InstancedMesh(geo,mat,items.length),dummy=new T.Object3D();items.forEach((it,i)=>{dummy.position.set(...it.slice(0,3));dummy.scale.set(...it.slice(3,6));dummy.rotation.set(0,0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;if(id){mesh.userData.part=id;pickables.push(mesh);}parent.add(mesh);return mesh;}
  function group(id,parent=root){const g=new T.Group();g.userData.part=id;parent.add(g);if(id)parts[id]=g;return g;}
  function lines(parent,points,color=0x6c8050,opacity=.5){const geo=new T.BufferGeometry().setFromPoints(points.map(v=>new T.Vector3(...v)));const line=new T.LineSegments(geo,new T.LineBasicMaterial({color,transparent:true,opacity}));parent.add(line);return line;}
  const pkg=group('package'),substrate=group('substrate',pkg);const substratePlates=[];
  for(let i=0;i<5;i++)substratePlates.push(box(substrate,11.2,.065,9.8,0,.02+i*.068,0,i%2?mats.copper:mats.substrate,'substrate'));
  const solder=group('solder',pkg),balls=[];for(let x=0;x<30;x++)for(let z=0;z<27;z++)balls.push([(x-14.5)*.35,-.19,(z-13)*.35,.094,.094,.094]);instanced(solder,sphereGeo,mats.metal,balls,'substrate');
  const boardTraces=[];for(let i=0;i<36;i++){const z=-4.5+i*.25;boardTraces.push([-5.25,.368,z],[-3.3,.368,z],[-3.3,.368,z],[-2.9,.368,z*.78],[-2.9,.368,z*.78],[2.9,.368,z*.78],[2.9,.368,z*.78],[3.3,.368,z],[3.3,.368,z],[5.25,.368,z]);}lines(substrate,boardTraces,0x7b945c,.7);
  const reinforcement=group('reinforcement',pkg);[[-5.35,0,.2,9.45],[5.35,0,.2,9.45],[0,-4.55,10.8,.22],[0,4.55,10.8,.22]].forEach(v=>box(reinforcement,v[2],.25,v[3],v[0],.5,v[1],mats.metal,'substrate'));
  const caps=[];for(let i=0;i<32;i++){let x=-4.8+i*.31;caps.push([x,.52,4.13,.13,.16,.21],[x,.52,-4.13,.13,.16,.21]);}for(let i=0;i<20;i++){let z=-3.7+i*.39;caps.push([-5,.52,z,.13,.16,.21],[5,.52,z,.13,.16,.21]);}instanced(substrate,boxGeo,mats.gold,caps,'substrate');
  const interposer=group('interposer',pkg);box(interposer,9.9,.17,8.2,0,.53,0,mats.dark,'interposer');const ipTraces=[];for(let side of [-1,1])for(let i=0;i<60;i++){let z=-3.8+i*.128;ipTraces.push([side*3.05,.62,z*.9],[side*3.5,.62,z],[side*3.5,.62,z],[side*4.7,.62,z]);}lines(interposer,ipTraces,0xb9a16b,.8);const iv=[];for(let i=0;i<25;i++)for(let j=0;j<20;j++)iv.push([(i-12)*.38,.53,(j-9.5)*.38,.018,.19,.018]);instanced(interposer,cylGeo,mats.copper,iv,'interposer');
  for(let side=0;side<2;side++){
    const dg=group('die'+side,pkg);dg.position.x=(side?1:-1)*1.72;dieGroups.push(dg);box(dg,3.25,.26,6.7,0,.83,0,mats.silicon,'die'+side);box(dg,3.29,.025,6.74,0,.682,0,mats.copper,'die'+side);
    const bumps=[];for(let x=0;x<16;x++)for(let z=0;z<30;z++)bumps.push([(x-7.5)*.19,.645,(z-14.5)*.21,.042,.043,.042]);instanced(dg,sphereGeo,mats.gold,bumps,'die'+side);
    for(let row=0;row<7;row++)for(let col=0;col<4;col++){
      const tm=mats.silicon.clone();tm.color.setHex((row+col)%3?0x3b5c4e:0x53654a);tm.emissive.setHex(0x79ad43);tm.emissiveIntensity=.03;
      const tile=box(dg,.55,.035,.62,(col-1.5)*.65,.983,(row-3)*.79,tm,'die'+side);tile.userData.region=0;tile.userData.side=side;tile.userData.index=row*4+col;activeTiles.push(tile);
      const micro=[];for(let a=0;a<4;a++)for(let b=0;b<5;b++)micro.push([tile.position.x+(a-1.5)*.11,1.008,tile.position.z+(b-2)*.105,.07,.012,.068]);instanced(dg,boxGeo,mats.trace,micro);
    }
    for(let i=0;i<4;i++){let tm=mats.copper.clone();const tile=box(dg,.56,.055,.25,(i-1.5)*.66,1.005,2.97,tm,'die'+side);tile.userData.region=1;tile.userData.side=side;tile.userData.index=i;activeTiles.push(tile);}
    let hbmInterface=box(dg,.15,.05,5.8,side?1.5:-1.5,1.015,0,mats.gold.clone(),'die'+side);Object.assign(hbmInterface.userData,{region:2,side,index:0});activeTiles.push(hbmInterface);
    let nv=box(dg,2.5,.06,.21,0,1.015,-3.18,mats.blue.clone(),'die'+side);Object.assign(nv.userData,{region:3,side,index:0});activeTiles.push(nv);
    box(dg,.14,.05,5.7,side?-1.51:1.51,1.02,0,mats.copper,'die'+side);
    const surface=[];for(let i=0;i<14;i++){let z=-2.75+i*.42;surface.push([-1.32,1.026,z],[1.32,1.026,z]);}lines(dg,surface,0xbac782,.25);
  }
  const bridge=group('bridge',pkg),bridgeTracks=[];for(let i=0;i<44;i++)bridgeTracks.push(box(bridge,.35,.025,.045,0,.77,-2.8+i*.13,mats.copper,'bridge'));
  for(let n=0;n<8;n++){
    const g=group('hbm'+n,pkg);g.position.set(n<4?-4.2:4.2,0,((n%4)-1.5)*1.85);hbmGroups.push(g);const stack=[];
    box(g,1.28,.12,1.5,0,.75,0,mats.dark,'hbm'+n);
    for(let l=0;l<8;l++){
      const lg=new T.Group();lg.position.y=.83+l*.078;g.add(lg);box(lg,1.22,.058,1.44,0,0,0,l===7?mats.memory:mats.silicon,'hbm'+n);
      const bump=[];for(let a=0;a<6;a++)for(let b=0;b<7;b++)bump.push([(a-2.5)*.18,-.039,(b-3)*.18,.025,.022,.025]);instanced(lg,sphereGeo,mats.gold,bump,'hbm'+n);
      stack.push(lg);
    }
    const vias=[];for(let a=0;a<4;a++)for(let b=0;b<5;b++)vias.push([(a-1.5)*.28,1.08,(b-2)*.26,.014,.64,.014]);let via=instanced(g,cylGeo,mats.copper,vias,'hbm'+n);g.userData.via=via;g.userData.layers=stack;layers.push(...stack);
    const logical=new T.InstancedMesh(boxGeo,mats.lime.clone(),128);logical.frustumCulled=false;logical.userData.part='hbm'+n;g.add(logical);g.userData.blocks=logical;
  }
  // Eight-GPU HGX baseboard: package 01 stays the same object through the transition.
  const system=group('system'),hgx=group('hgx',system);box(hgx,20,.25,13.4,0,-.9,0,mats.substrate,'platform');
  const gpuNodes=[];for(let n=0;n<8;n++){let g=group('gpu'+n,hgx);g.position.set((n%4-1.5)*4.6,0,(Math.floor(n/4)-.5)*8);gpuNodes.push(g);box(g,3.6,.4,3.5,0,-.4,0,mats.dark,'gpu'+n);box(g,3.3,.14,3.2,0,-.1,0,mats.metal,'gpu'+n);if(n>0){box(g,2.6,.12,2.5,0,.02,0,mats.substrate,'gpu'+n);box(g,.85,.14,1.8,-.48,.15,0,mats.silicon,'gpu'+n);box(g,.85,.14,1.8,.48,.15,0,mats.silicon,'gpu'+n);for(let j=0;j<4;j++){box(g,.35,.16,.7,-1.1,.18,(j-1.5)*.55,mats.memory,'gpu'+n);box(g,.35,.16,.7,1.1,.18,(j-1.5)*.55,mats.memory,'gpu'+n);}}
      for(let k=0;k<10;k++)box(g,3.2,.08,.035,0,-.02,(k-4.5)*.31,mats.gold);
  }
  const switches=[];for(let n=0;n<2;n++){let sw=box(hgx,2.1,.4,1.6,(n?1:-1)*3.8,-.45,0,mats.blue.clone(),'switch'+n);switches.push(sw);}let sysLines=[];gpuNodes.forEach((g,n)=>{let x=g.position.x,z=g.position.z,sw=(n%4<2?-1:1)*3.8;for(let k=0;k<6;k++)sysLines.push([x+k*.09,-.72,z],[x+k*.09,-.72,Math.sign(z)*1.3],[x+k*.09,-.72,Math.sign(z)*1.3],[sw+k*.09,-.72,0]);});lines(hgx,sysLines,0x8fb4b5,.65);const sysLinks=[],sysPulses=[],sysRoutes=[];gpuNodes.forEach((g,n)=>{const a=new T.Vector3(g.position.x,.33,g.position.z),b=new T.Vector3(g.position.x,-.3,Math.sign(g.position.z)*1.3),c=new T.Vector3((n%4<2?-1:1)*3.8,-.23,0);sysRoutes.push([a,b,c]);sysLinks.push(lines(hgx,[a.toArray(),b.toArray(),b.toArray(),c.toArray()],0x8cbcd0,.2));const pulse=new T.Mesh(new T.SphereGeometry(.11,8,6),mats.blue);hgx.add(pulse);sysPulses.push(pulse);});
  const exchangeLink=lines(hgx,[[-3.8,-.18,0],[3.8,-.18,0]],0x8cbcd0,.35),exchangePulses=[];
  for(let i=0;i<2;i++){const pulse=new T.Mesh(new T.SphereGeometry(.13,10,6),i?mats.lime:mats.blue);hgx.add(pulse);exchangePulses.push(pulse);}
  const gpuSignals=gpuNodes.map((g,i)=>box(g,1.8,.035,.08,0,.28,1.25,mats.lime.clone(),'gpu'+i));
  for(let x of [-9.5,9.5])for(let z=-6;z<=6;z+=1.2)box(hgx,.33,.35,.7,x,-.6,z,mats.metal);
  const server=group('server',system);box(server,22,.3,16,0,-1.2,0,mats.dark,'server');box(server,.22,3.1,16,-11,.3,0,mats.metal,'server');box(server,.22,3.1,16,11,.3,0,mats.metal,'server');box(server,22,3.1,.25,0,.3,-8,mats.dark,'server');box(server,22,2.7,.25,0,.1,8,mats.metal,'server');
  for(let i=0;i<9;i++){box(server,1.8,.85,.3,(i-4)*2.25,-.25,8.2,mats.dark,'server');for(let j=0;j<6;j++)box(server,.055,.55,.32,(i-4)*2.25+(j-2.5)*.24,-.25,8.23,mats.metal);box(server,.07,.07,.34,(i-4)*2.25+.65,.27,8.24,mats.lime);}
  for(let i=0;i<2;i++){box(server,2.4,.25,2.5,(i?1:-1)*5,.1,-6.3,mats.silicon,'cpu');for(let j=0;j<9;j++)box(server,2.2,.45,.08,(i?1:-1)*5,.4,-6.3+(j-4)*.24,mats.metal);}
  // Open-front NVL72: 18 compute trays (2 Grace + 4 GPU), 9 switch trays.
  const rack=group('rack',system),trays=[],rackGpu=[];box(rack,7.7,.25,7.2,0,-7.9,0,mats.dark,'rack');box(rack,7.7,.25,7.2,0,8.1,0,mats.metal,'rack');for(let x of [-3.7,3.7])for(let z of [-3.4,3.4])box(rack,.25,16,.25,x,0,z,mats.metal,'rack');box(rack,7.6,16,.13,0,0,-3.5,mats.dark,'rack');
  for(let i=0;i<27;i++){
    let g=group('tray'+i,rack);g.position.y=-7.5+i*.57;trays.push(g);const isSwitch=i>=9&&i<18;box(g,7.1,.09,6.5,0,0,0,mats.metal,'tray'+i);box(g,7.1,.41,.12,0,.25,3.2,isSwitch?mats.dark:mats.substrate2,'tray'+i);
    if(isSwitch){for(let j=0;j<2;j++)box(g,1.1,.14,1.3,(j?1:-1)*1.8,.16,0,mats.blue,'tray'+i);for(let j=0;j<18;j++)box(g,.22,.16,.18,(j-8.5)*.35,.25,3.32,mats.gold,'tray'+i);}else{for(let j=0;j<4;j++){let m=box(g,1.1,.15,1.65,(j-1.5)*1.7,.17,.1,mats.silicon,'tray'+i);rackGpu.push(m);}for(let j=0;j<2;j++)box(g,.8,.13,1.2,(j?1:-1)*1.8,.16,-2,mats.copper,'tray'+i);for(let j=0;j<12;j++)box(g,.42,.2,.15,(j-5.5)*.55,.24,3.32,mats.dark,'tray'+i);}
    box(g,.08,.08,.16,-3.25,.3,3.35,mats.lime,'tray'+i);box(g,.35,.14,.2,3.18,.25,3.38,mats.metal,'tray'+i);
  }
  for(let x of [-3.43,3.43])for(let k=0;k<4;k++)box(rack,.045,15.4,.06,x+k*.04,0,-3.15,mats.copper);
  const rack2=rack.clone(true),rack3=rack.clone(true);system.add(rack2,rack3);rack2.position.x=-9;rack3.position.x=9;
  // Thin, directional trails are world-space motion blur for moving data only.
  const pulseGeo=new T.SphereGeometry(.055,7,5),pulses=[],trails=[];for(let i=0;i<64;i++){let p=new T.Mesh(pulseGeo,mats.lime);pkg.add(p);pulses.push(p);let tr=box(pkg,.2,.018,.018,0,0,0,mats.lime);trails.push(tr);}
  const gb200=group('gb200',system);box(gb200,16,.3,8,0,-.7,0,mats.substrate,'gb200');
  for(let gpu=0;gpu<2;gpu++){let g=group('gbgpu'+gpu,gb200);g.position.x=(gpu?1:-1)*4.7;box(g,4.7,.18,5.4,0,-.43,0,mats.metal,'gb200');for(let die=0;die<2;die++){box(g,1.25,.2,3.8,(die?1:-1)*.7,-.2,0,mats.silicon,'gb200');for(let j=0;j<6;j++)box(g,1.08,.025,.42,(die?1:-1)*.7,-.08,(j-2.5)*.57,mats.trace);}for(let j=0;j<8;j++)box(g,.52,.3,.85,j<4?-1.8:1.8,-.15,(j%4-1.5)*1.1,mats.memory,'gb200');}
  box(gb200,2.9,.3,3.5,0,-.3,0,mats.copper,'grace');for(let j=0;j<14;j++)box(gb200,2.7,.12,.09,0,-.05,(j-6.5)*.23,mats.metal);lines(gb200,[[-3,.1,0],[-1.5,.1,0],[1.5,.1,0],[3,.1,0]],0xdba477,.8);
  const shadow=new T.Mesh(new T.PlaneGeometry(250,250),new T.ShadowMaterial({opacity:.2}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-8.2;shadow.receiveShadow=true;scene.add(shadow);
  const selection=new T.BoxHelper(pkg,0xc5fa72);selection.material.transparent=true;selection.material.opacity=.4;selection.visible=false;scene.add(selection);
  // Depth-dependent selective focus. Kept subtle so every readable surface stays crisp.
  const target=new T.WebGLRenderTarget(innerWidth,innerHeight,{samples:4});target.depthTexture=new T.DepthTexture(innerWidth,innerHeight);const postScene=new T.Scene(),postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const postMat=new T.ShaderMaterial({uniforms:{tColor:{value:target.texture},tDepth:{value:target.depthTexture},resolution:{value:new T.Vector2(innerWidth,innerHeight)},focus:{value:25},aperture:{value:0},near:{value:.1},far:{value:200}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D tColor,tDepth;uniform vec2 resolution;uniform float focus,aperture,near,far;varying vec2 vUv;float linearDepth(float z){return(2.*near*far)/(far+near-(z*2.-1.)*(far-near));}void main(){float depth=linearDepth(texture2D(tDepth,vUv).x);float radius=clamp(abs(depth-focus)*aperture,0.,2.2);vec3 c=texture2D(tColor,vUv).rgb;vec3 b=c*4.;for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 off=vec2(cos(a),sin(a))/resolution*radius;b+=texture2D(tColor,vUv+off).rgb;}c=b/12.;vec3 glow=vec3(0.);for(int i=0;i<4;i++){float a=float(i)*1.570796;vec3 s=texture2D(tColor,vUv+vec2(cos(a),sin(a))*3./resolution).rgb;glow+=max(s-.84,0.);}gl_FragColor=vec4(c+glow*.045,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),postMat));
  const memoryDummy=new T.Object3D();
  const tmp=new T.Vector3(),raycaster=new T.Raycaster(),clipPlane=new T.Plane(new T.Vector3(-1,0,0),6);let width=innerWidth,height=innerHeight;const view={orbitX:0,orbitY:0,zoom:1,auto:false};let current={};
  function project(obj,offset=[0,0,0]){if(!obj)return {x:0,y:0,visible:false};let shown=true,a=obj;while(a){if(!a.visible)shown=false;a=a.parent;}tmp.set(...offset);obj.localToWorld(tmp);if(current.ch===1&&current.cut>0&&isDescendant(obj,pkg)){const local=pkg.worldToLocal(tmp.clone());if(local.x>5.61-current.cut*11.22)shown=false;}tmp.project(camera);return{x:(tmp.x*.5+.5)*width,y:(-.5*tmp.y+.5)*height,z:tmp.z,visible:shown&&tmp.z<1&&tmp.z>-1};}
  function visibleHit(hit){let a=hit.object;while(a){if(!a.visible)return false;a=a.parent;}return !(current.cut>0&&pkg.worldToLocal(hit.point.clone()).x>5.61-current.cut*11.22);}
  function pick(x,y){raycaster.setFromCamera(new T.Vector2(x/width*2-1,1-y/height*2),camera);const hits=raycaster.intersectObjects(pickables,false).filter(visibleHit);return hits[0]?.object.userData;}
  function anchorVisible(obj,offset){const end=obj.localToWorld(new T.Vector3(...offset)),direction=end.clone().sub(camera.position),length=direction.length();raycaster.set(camera.position,direction.normalize());const hits=raycaster.intersectObject(pkg,true);for(const hit of hits){if(hit.distance>=length-.12)break;let o=hit.object,visible=true,inside=false;while(o){if(!o.visible)visible=false;if(o===obj)inside=true;o=o.parent;}if(visible&&!inside&&hit.object.isMesh)return false;}return true;}
  function setCut(amount){const at=5.61-amount*11.22;allBox.forEach(m=>{if(!m.userData.origin||!isDescendant(m,pkg))return;const [w,h,d]=m.userData.size,[x,y,z]=m.userData.origin;let parentX=0,a=m.parent;while(a&&a!==pkg){parentX+=a.position.x;a=a.parent;}const right=Math.min(x+w/2,at-parentX);const nw=Math.max(.0001,right-(x-w/2));m.scale.x=nw;m.position.x=x-w/2+nw/2;m.visible=right>x-w/2;});}
  function isDescendant(m,p){let a=m.parent;while(a){if(a===p)return true;a=a.parent;}return false;}
  const mix=T.MathUtils.lerp,smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
  const poses=[{cam:[13,16,21],look:[0,.6,0],scale:1,shift:.18},{cam:[13,13,20],look:[0,2,0],scale:.86,shift:.18},{cam:[5,17,12],look:[0,1,0],scale:1.12,shift:.18},{cam:[0,23,.08],look:[0,0,0],scale:.92,shift:.16},{cam:[8,13,19],look:[0,0,0],scale:.31,shift:.32},{cam:[15,19,25],look:[0,0,0],scale:1,shift:.18},{cam:[13,15,23],look:[0,0,0],scale:.5,shift:.34},{cam:[12,15,21],look:[0,0,0],scale:.94,shift:.18}];
  let lastCut=-1;
  const interactionObjects=[pkg,substrate,reinforcement,solder,interposer,...dieGroups,...hbmGroups,bridge,system,hgx,server,rack,rack2,rack3,gb200];
  let interactionTween=null,lastLook=new T.Vector3();
  function beginInteraction(time){interactionTween={time,ch:current.ch,camera:camera.position.clone(),look:lastLook.clone(),objects:interactionObjects.map(obj=>({obj,position:obj.position.clone(),scale:obj.scale.clone(),quaternion:obj.quaternion.clone(),visible:obj.visible}))};}
  function cancelInteraction(){interactionTween=null;}
  function update(ch,local,time,state,ui,transition=0){
    const p=poses[ch],next=poses[Math.min(ch+1,7)],blend=smooth(transition),entry=smooth(local/.15),s={};['cam','look'].forEach(k=>s[k]=p[k].map((v,i)=>mix(v,next[k][i],blend)));s.scale=mix(p.scale,next.scale,blend);s.shift=mix(p.shift,next.shift,blend);s.shiftY=mix([0,.035,.035,.02,.27,.09,.03,0][ch],[0,.035,.035,.02,.27,.09,.03,0][Math.min(ch+1,7)],blend);current={ch,local,time,state,ui};const dataPrecision=ch===7&&state.workload===2?'FP64':state.precision;
    root.position.set(0,0,0);root.rotation.set(0,0,0);pkg.visible=true;system.visible=ch===5||ch===6||ch===4&&blend>.01;
    let ex=ch===1?mix(.1,ui.explode??mix(.1,1,smooth(local*1.5)),entry):ch===0?blend*.1:ch===2?mix(.45,0,smooth(local*2)):0;
    if(ch===1&&blend)ex=mix(ex,.45,blend);
    const isolated=ch===1&&ui.isolate,deep=ch===1&&ui.deep?entry*(1-blend):0,seamEffective=ch===1?(ui.seam||0)*entry*(1-blend):0;
    pkg.position.set(0,0,0);pkg.rotation.set(0,0,0);pkg.scale.setScalar(s.scale);
    if(ch===0){pkg.rotation.y=(.12+Math.sin(time*.14)*.025)*(1-blend);pkg.rotation.z=.02*(1-blend);}
    if(ch===7||ch===6&&blend>0){const f=ch===7?1:blend;pkg.rotation.y=Math.sin(time*.16)*.17*f;pkg.rotation.z=Math.sin(time*.12)*.03*f;}
    if(view.auto)pkg.rotation.y+=time*.13;pkg.rotation.y+=view.orbitY;pkg.rotation.x+=view.orbitX;
    if(ch===3){s.look[0]=mix(-3.5,3.5,smooth(local));s.cam[0]=s.look[0];if(blend){s.look[0]=mix(s.look[0],0,blend);s.cam[0]=mix(s.cam[0],next.cam[0],blend);}s.cam[1]+=Math.sin(local*Math.PI)*1.3;}
    if(ch===2){let flat=Math.max((ui.planar||0)*entry,blend);s.cam=s.cam.map((v,i)=>mix(v,[0,23,.08][i],flat));if(blend>0){s.look[0]=-3.5*blend;s.cam[0]=-3.5*blend;}}
    let visiblePart=state.part;
    [substrate,reinforcement,solder,interposer,...dieGroups,...hbmGroups,bridge].forEach(g=>{const wanted=!isolated||visiblePart==='all'||g.userData.part===visiblePart||(visiblePart==='substrate'&&[reinforcement,solder].includes(g));const visibility=wanted?1:1-entry*(1-blend);g.visible=visibility>.0001;g.scale.setScalar(Math.max(.001,visibility));});
    substrate.position.y=-ex*1.8;solder.position.y=-ex*2.8;reinforcement.position.y=-ex*.8;interposer.position.y=ex*.6;
    dieGroups.forEach((d,i)=>{d.position.y=ex*2.9;d.position.x=(i?1:-1)*(1.72+seamEffective*1.4);});bridge.position.y=ex*1.5;bridge.visible=(!isolated||state.part==='all'||entry*(1-blend)<.999)&&seamEffective<.55;
    bridgeTracks.forEach(m=>m.scale.x=.35+seamEffective*2.8);
    hbmGroups.forEach((g,n)=>{g.position.y=ex*1.65;const open=ch===3?(n===state.stack?(ui.stackExpand??.6):.13)*smooth(local/.1)*(1-blend):ex*.65;g.userData.layers.forEach((layer,i)=>layer.position.y=.83+i*(.078+open*.18+deep*.075));const top=.83+7*(.078+open*.18+deep*.075)+.04,viaScale=(top-.78)/.64;g.userData.via.scale.y=viaScale;g.userData.via.position.y=(top+.78)/2-1.08*viaScale;const logical=g.userData.blocks,used=Math.ceil(16*AtlasMath.formats[dataPrecision].storage/8);for(let i=0;i<128;i++){const layer=7-Math.floor(i/16),cell=i%16;memoryDummy.position.set((cell%4-1.5)*.25,.83+layer*(.078+open*.18+deep*.075)+.038,(Math.floor(cell/4)-1.5)*.3);memoryDummy.scale.set(i<used?.18:0,.014,.22);memoryDummy.updateMatrix();logical.setMatrixAt(i,memoryDummy.matrix);}logical.instanceMatrix.needsUpdate=true;logical.computeBoundingBox();logical.material.emissiveIntensity=(.28+.15*Math.sin(time*2+n*.8))*(n===state.stack?1:.65);});

    if(isolated&&state.part!=='all'){const obj=parts[state.part];if(obj){const il=[obj.position.x,obj.position.y+(state.part.startsWith('hbm')?1.95:1),obj.position.z],ic=deep?[il[0]+3,il[1]+4,il[2]+6]:[il[0]+6,il[1]+7,il[2]+10];s.look=il.map((v,i)=>mix(s.look[i],v,entry*(1-blend)));s.cam=ic.map((v,i)=>mix(s.cam[i],v,entry*(1-blend)));pkg.scale.setScalar(mix(s.scale,1,entry*(1-blend)));}}
    const cut=ch===1?ui.cut*entry*(1-blend):0;current.cut=cut;if(cut!==lastCut||cut>0){setCut(cut);lastCut=cut;}
    if(ch===1&&cut>0){ // Hide arrays beyond the cut as solid box layers expose their closed end faces.
      hbmGroups.forEach(g=>{if(g.position.x-.64>5.61-cut*11.22)g.visible=false;});
    }
    mats.memory.emissive.setHex(0x779f48);mats.memory.emissiveIntensity=ch===6&&state.metric===1?.45:0;mats.blue.emissiveIntensity=ch===6&&state.metric===3?1.5:.5;mats.substrate.emissive.setHex(0x7a512b);mats.substrate.emissiveIntensity=ch===6&&state.metric===5?.12:0;
    const phase=((time-(ui.dieStart||0))%7+7)%7/7;
    activeTiles.forEach(tile=>{const region=tile.userData.region,side=tile.userData.side,idx=tile.userData.index,active=ch===6?(state.metric===3?region===3:state.metric===1?region===2:region===state.region):region===state.region;let wave=phase>(side?.52:.12)+idx*.006&&!(seamEffective>.55&&side===1);let intensity=active?(wave?.7:.06):.015;if(ch===7){const w=state.workload;intensity=active?(w===0?.35+.3*Math.sin(time*2+idx*.25):w===1?(idx%7===Math.floor(time*3)%7?1:.025):.2+.15*Math.sin(time+idx)):.015;}tile.material.emissive?.setHex(region===3?0x589ac1:region===1?0xad7742:0x91c74b);tile.material.emissiveIntensity=intensity;});
    pulses.forEach((m,i)=>{let lane=i%8,h=hbmGroups[lane],u=((time-(ui.memoryStart||0))*.18+(i>>3)*.13)%1;const trainingBack=ch===7&&state.workload===0&&time%8>3.6&&time%8<7.2;if(trainingBack)u=1-u;let y=.74+ex*1.5;let sx=h.position.x,sz=h.position.z,dx=dieGroups[lane<4?0:1].position.x;let x,z;
      if(u<.42){let f=u/.42;x=mix(sx,dx,f);z=sz;}else if(u<.72){x=dx;z=mix(sz,0,(u-.42)/.3);}else{let f=(u-.72)/.28;x=mix(dx,-dx,f);z=0;}
      if(ch===7&&state.workload===2){x=dieGroups[i%2].position.x+(Math.floor(i/2)%4-1.5)*.65;z=mix(-2.6,2.6,u);}m.material=ch===7&&state.workload===2?mats.blue:trainingBack?mats.copper:mats.lime;const gapEdge=.095+seamEffective*1.4,broken=seamEffective>.55&&u>.72&&Math.sign(dx)*x<gapEdge;if(broken)x=Math.sign(dx)*gapEdge;m.visible=ch!==4&&!isolated&&((ch===2||ch===3||ch===7||ch===6&&state.metric===2)||ex>.3);const originY=h.position.y+.83+(lane%8)*(.078+(ch===3?ui.stackExpand:ex*.65)*.18);m.position.set(x,u<.42?mix(originY,y+.4,u/.42):y+.4,z);if(ch===7&&state.workload===1&&i%3!==0)m.visible=false;m.scale.setScalar(dataPrecision==='FP4'?.8:dataPrecision==='FP64'?1.7:1);const trail=trails[i];trail.material=ch===7&&state.workload===2?mats.blue:trainingBack?mats.copper:mats.lime;trail.visible=m.visible&&!broken;trail.position.copy(m.position);const speed=u<.42?Math.abs(sx-dx)/.42:2.8/.28;trail.scale.set(.09+speed*.016,.018,.018);trail.rotation.y=ch===7&&state.workload===2||u>.42&&u<.72?Math.PI/2:0;
    });
    system.scale.setScalar(.66);system.rotation.set(view.orbitX*.25,view.orbitY*.4,0);system.position.set(0,0,0);
    let modeFloat=ui.system===null?(local<.42?0:local<.56?(local-.42)/.14:local<.70?1+(local-.56)/.14:Math.min(3,2+(local-.70)/.07)):mix(ui.systemFrom??ui.system,ui.system,smooth((time-(ui.systemStart??-10))/.8));
    if(ch===4)modeFloat=0;if(ch===5&&ui.system!==null)modeFloat*=entry;if(ch===5&&blend&&state.product!==0)modeFloat=mix(modeFloat,state.product===1?0:state.product===2?1:2,blend);let mode=Math.round(modeFloat);
    if(ch===6){mode=state.product===0?-1:state.product===1?0:state.product===2?1:2;modeFloat=mode;}
    const rackBuild=smooth((modeFloat-1.05)/.9),clusterBuild=smooth(modeFloat-2);
    hgx.visible=modeFloat<1.95&&modeFloat>=0;server.visible=modeFloat>.04&&modeFloat<1.95;rack.visible=modeFloat>1.05;rack2.visible=modeFloat>2;rack3.visible=modeFloat>2;gb200.visible=false;gb200.scale.setScalar(1);
    hgx.scale.setScalar(Math.max(.001,1-rackBuild));server.scale.setScalar(Math.max(.001,1-rackBuild));server.position.y=(1-smooth(modeFloat))*-4;
    rack.scale.setScalar(Math.max(.001,rackBuild));rack2.scale.setScalar(Math.max(.001,clusterBuild));rack3.scale.setScalar(Math.max(.001,clusterBuild));rack2.position.x=-9;rack3.position.x=9;
    if(ch===5||ch===4&&blend>.01){const build=ch===4?blend:1;system.scale.setScalar(.66*build);pkg.scale.setScalar(mix(s.scale,.165*(1-rackBuild),build));pkg.position.set(-4.554*build,.198*build,-2.64*build);pkg.visible=rackBuild<.999;
      const boardCam=[17,23,28],rackCam=[15,10,26],clusterCam=[22,14,33];let sysCam=boardCam.map((v,i)=>mix(mix(v,rackCam[i],rackBuild),clusterCam[i],clusterBuild));s.cam=sysCam;s.look=[0,0,0];
      if(ch===4){s.cam=p.cam.map((v,i)=>mix(v,sysCam[i],blend));s.shift=mix(p.shift,.18,blend);}
      if(ch===5&&blend){
        s.cam=sysCam.map((v,i)=>mix(v,next.cam[i],blend));s.shift=mix(.18,.34,blend);
        const product=state.product,previewScale=product===0?0:product===3?.4:.36;system.scale.setScalar(mix(.66,previewScale,blend));
        if(product===3){hgx.scale.multiplyScalar(1-blend);server.scale.multiplyScalar(1-blend);rack.scale.multiplyScalar(1-blend);gb200.visible=true;gb200.scale.setScalar(blend);}
        if(product===4)rack.scale.multiplyScalar(mix(1,.74,blend));
        const ps=product===0?.36:product<3?.09:0,px=product===1||product===2?-2.484:0,py=product===1||product===2?.108:0,pz=product===1||product===2?-1.44:0;
        pkg.visible=product<3||blend<.999;pkg.scale.setScalar(mix(.165*(1-rackBuild),ps,blend));pkg.position.set(mix(-4.554,px,blend),mix(.198,py,blend),mix(-2.64,pz,blend));
      }
    }
    if(ch===6){s.shift=.34;system.scale.setScalar(.36);hgx.scale.setScalar(1);server.scale.setScalar(1);rack.scale.setScalar(.74);pkg.visible=state.product<3;pkg.scale.setScalar(state.product===0?.36:.09);if(state.product===1||state.product===2)pkg.position.set(-2.484,.108,-1.44);rack2.visible=false;rack3.visible=false;
      if(state.product===3){rack.visible=false;hgx.visible=false;server.visible=false;gb200.visible=true;system.scale.setScalar(.4);}
      if(blend){system.scale.multiplyScalar(1-blend);pkg.visible=true;pkg.scale.setScalar(mix(state.product===0?.36:state.product<3?.09:.02,.94,blend));pkg.position.multiplyScalar(1-blend);s.shift=mix(.34,.18,blend);}
    }
    const reduction=ui.reduceStart===null?T.MathUtils.clamp(local/.38,0,1):T.MathUtils.clamp((time-ui.reduceStart)/10,0,1),flow=AtlasMath.reduction(reduction,state.gpu);
    sysLinks.forEach((line,n)=>{line.material.color.setHex(ui.link===n?0xc5fa72:0x8cbcd0);line.material.opacity=ui.link===n?.95:.24;const u=flow.stage===4?1-flow.broadcast[n]:flow.gather[n],route=sysRoutes[n];sysPulses[n].visible=ch===5&&((flow.stage===2&&flow.gather[n]>0&&flow.gather[n]<1)||(flow.stage===4&&flow.broadcast[n]>0&&flow.broadcast[n]<1));sysPulses[n].position.copy(u<.5?route[0].clone().lerp(route[1],u*2):route[1].clone().lerp(route[2],(u-.5)*2));});
    exchangePulses.forEach((p,i)=>{p.visible=ch===5&&flow.stage===3;p.position.set(mix(i?3.8:-3.8,i?-3.8:3.8,flow.exchange),-.14,i?.1:-.1);});exchangeLink.material.opacity=flow.stage>=3?.85:.2;
    switches.forEach((m,i)=>{m.material.emissive.setHex(ui.link>=0&&(ui.link%4<2?0:1)===i?0x90bf59:0x1f4a56);m.material.emissiveIntensity=flow.stage===3?1.1:(state.gpu%4<2?0:1)===i?.7:.2;});
    gpuSignals.forEach((m,i)=>{m.material.emissiveIntensity=flow.arrived[i]?1.2:flow.stage===1?.5+.4*Math.sin(time*3+i):i===state.gpu?.7:.1;});
    gpuNodes.forEach((g,n)=>{g.children.forEach(m=>{if(m.material===mats.dark)m.material=mats.dark;});g.position.y=n===state.gpu?.3:0;});trays.forEach((g,n)=>g.position.z=ui.tray===n?1.6:0);
    camera.position.set(...s.cam).multiplyScalar(1/view.zoom);lastLook.set(...s.look);
    if(interactionTween){
      const tr=interactionTween,u=smooth((time-tr.time)/.65);
      if(tr.ch!==ch||u>=1)interactionTween=null;
      else {camera.position.lerpVectors(tr.camera,camera.position,u);lastLook.lerpVectors(tr.look,lastLook,u);
        for(const from of tr.objects){const obj=from.obj,toVisible=obj.visible;obj.position.lerpVectors(from.position,obj.position,u);obj.quaternion.slerpQuaternions(from.quaternion,obj.quaternion,u);const start=from.visible?from.scale:new T.Vector3(.001,.001,.001),end=toVisible?obj.scale.clone():new T.Vector3(.001,.001,.001);obj.scale.lerpVectors(start,end,u);obj.visible=from.visible||toVisible;}
      }
    }
    camera.lookAt(lastLook);camera.updateProjectionMatrix();camera.setViewOffset(width,height,-width*s.shift,height*s.shiftY,width,height);camera.updateMatrixWorld();root.updateMatrixWorld(true);
    clipPlane.set(new T.Vector3(-1,0,0),5.61-cut*11.22).applyMatrix4(pkg.matrixWorld);
    const clipping=cut>0?[clipPlane]:[];scene.traverse(o=>{if(o.material){const list=Array.isArray(o.material)?o.material:[o.material];for(const mat of list)mat.clippingPlanes=clipping;}});
    if(state.part!=='all'&&ch===1&&!isolated&&parts[state.part]?.visible){selection.visible=true;selection.setFromObject(parts[state.part]);}else selection.visible=false;
    renderer.setClearColor(0x101311,1);postMat.uniforms.aperture.value=ch===1||ch===3?.12:0;postMat.uniforms.focus.value=camera.position.distanceTo(new T.Vector3(...s.look));renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
    return {ex,phase,mode,modeFloat,blend,cut,deep,stackOpen:ch===3?(ui.stackExpand??.6)*smooth(local/.1)*(1-blend):ex*.65,seam:seamEffective};
  }
  function resize(){width=innerWidth;height=innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();target.setSize(Math.round(width*renderer.getPixelRatio()),Math.round(height*renderer.getPixelRatio()));postMat.uniforms.resolution.value.set(width*renderer.getPixelRatio(),height*renderer.getPixelRatio());}
  const lensRenderer=new T.WebGLRenderer({canvas:document.getElementById('lens-canvas'),antialias:true,alpha:false});lensRenderer.setSize(260,260,false);lensRenderer.setPixelRatio(1);lensRenderer.outputColorSpace=T.SRGBColorSpace;lensRenderer.toneMapping=T.ACESFilmicToneMapping;lensRenderer.toneMappingExposure=1.25;lensRenderer.setClearColor(0x182015,1);const lensCamera=new T.PerspectiveCamera(27,1,.01,100);
  function renderLens(x,y){raycaster.setFromCamera(new T.Vector2(x/width*2-1,1-y/height*2),camera);const hits=raycaster.intersectObject(pkg,true).filter(h=>h.object.isMesh&&visibleHit(h)),hit=hits[0];if(!hit){lensRenderer.clear();return false;}const point=hit.point.clone(),direction=new T.Vector3(1.6,2.8,1.8);lensCamera.position.copy(point).add(direction);lensCamera.lookAt(point);const oldEnv=scene.environment;scene.environment=null;const hides=[];const part=hit.object.userData.part;if(part?.startsWith('hbm')){const n=+part.slice(3);hbmGroups[n]?.userData.layers.slice(5).forEach(g=>{hides.push([g,g.visible]);g.visible=false;});}lensRenderer.render(scene,lensCamera);hides.forEach(([g,v])=>g.visible=v);scene.environment=oldEnv;return true;}
  resize();
  return {update,resize,project,pick,parts,pkg,dieGroups,hbmGroups,activeTiles,gpuNodes,rack,trays,view,renderer,scene,camera,renderLens,anchorVisible,beginInteraction,cancelInteraction};
})();
