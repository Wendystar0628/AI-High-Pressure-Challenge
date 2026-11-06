import {THREE,PI,M,mat,mesh,box,cyl,rod,label,dynamics} from './core.js';

// Both displays are actual surfaces inside each wheelhouse, driven by scene
// time so a random-access export frame shows exactly the same instrument scan.
export function navigationInstruments(parent){
 const vertexShader='varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
 for(let kind=0;kind<2;kind++){
  const x=.07+kind*.34;
  box(.29,.29,.045,M.dark,parent,x,1.275,-.80);box(.08,.055,.07,M.iron,parent,x,1.105,-.82);
  const fragmentShader=kind===0?`uniform float time;varying vec2 p;
   void main(){vec2 q=(p-.5)*2.;float r=length(q),a=atan(q.y,q.x);float grid=1.-smoothstep(.012,.027,abs(fract(r*3.)-.5));grid=max(grid,(1.-smoothstep(.008,.018,min(abs(q.x),abs(q.y))))*.5);
    float angle=mod(a-time*.8+6.283185,6.283185);float sweep=exp(-angle*4.5)*step(r,.95);float blips=0.;
    for(int i=0;i<6;i++){float f=float(i);vec2 b=vec2(sin(f*3.4+.6),cos(f*2.7+2.))*(.18+f*.10);blips+=1.-smoothstep(.025,.048,distance(q,b));}
    vec3 col=vec3(.018,.085,.084)+vec3(.08,.25,.16)*grid+vec3(.16,.35,.18)*sweep+vec3(.42,.65,.31)*blips;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`:`uniform float time;varying vec2 p;
   void main(){float ground=.18+sin(p.x*8.+time*.12)*.04+sin(p.x*17.-time*.08)*.015;
    vec3 col=vec3(.018,.09,.14);col+=vec3(.03,.08,.1)*(1.-smoothstep(.01,.025,abs(fract(p.y*5.)-.5)));
    col=mix(col,vec3(.58,.32,.12),1.-smoothstep(ground-.04,ground,p.y));float echo=0.;
    for(int i=0;i<5;i++){float f=float(i),x=fract(f*.213-time*.022),dx=(p.x-x)*10.;float y=.43+sin(f*2.1)*.16+.05*max(0.,1.-dx*dx);echo+=step(abs(dx),1.)*(1.-smoothstep(.008,.02,abs(p.y-y)));}
    col+=vec3(.6,.44,.18)*echo;gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`;
  const material=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader,fragmentShader});
  mesh(new THREE.PlaneGeometry(.24,.225),material,parent,[x,1.29,-.774]);
  label(kind?'12.8 m':'RADAR',.205,.041,parent,x,1.15,-.773,{bg:'#294b50',ink:'#b8d0ad',border:false});
  for(let i=0;i<3;i++)cyl(.009,.009,.012,i===1?M.orange:M.ivory,parent,x-.075+i*.075,1.125,-.77,8).rotation.x=PI/2;
  dynamics.displays.push(material);
 }
 // The chart has a backing board, a metal clip, and a pencil within reach.
 box(.45,.014,.43,M.wood,parent,-.35,1.18,-.96);
 box(.13,.014,.045,M.silver,parent,-.35,1.204,-1.133);
 rod([-.57,1.199,-1.08],[-.54,1.199,-.85],.007,M.yellow,parent);
 for(let i=0;i<4;i++)box(.12,.009,.008,M.edge,parent,-.04,.99+i*.027,-.782,false);
 rod([.58,1.16,-1.06],[.58,1.31,-1.08],.013,M.silver,parent);
 cyl(.025,.025,.07,M.orange,parent,.58,1.32,-1.08).rotation.z=PI/2;
 for(const x of [-.35,.35])rod([x,1.09,-1.315],[x+.13,1.60,-1.33],.009,M.iron,parent);
}

export function reflectedCaustics(parent,w,d,y,z=0){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{time:{value:0},alpha:{value:.24},size:{value:new THREE.Vector2(w,d)}},
  vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float time;uniform float alpha;uniform vec2 size;varying vec2 p;
   void main(){vec2 q=p*size*3.;float a=sin(q.x*2.3+sin(q.y*1.9+time*.6)+time*.4);float b=sin(q.y*2.7+sin(q.x*1.3-time*.5)-time*.3);float web=1.-smoothstep(.035,.11,abs(a+b*.7));float edge=smoothstep(0.,.12,min(min(p.x,1.-p.x),min(p.y,1.-p.y)));gl_FragColor=vec4(.62,.88,.73,web*alpha*edge);
    #include <colorspace_fragment>
   }`});
 const m=mesh(new THREE.PlaneGeometry(w,d),material,parent,[0,y,z]);m.rotation.x=PI/2;m.castShadow=false;dynamics.caustics.push(m);
}
