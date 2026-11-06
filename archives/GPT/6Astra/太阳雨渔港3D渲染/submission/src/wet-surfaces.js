import {Reflector} from 'three/addons/objects/Reflector.js';
import {THREE,PI,root,dynamics} from './core.js';
import {cloudGLSL} from './weather.js';

// All disconnected pools share one planar capture. The shallow warehouse pools
// use the same water level; their 12 cm raised floor only offsets the geometry.
export function wetSurfaces(water){
 const vertices=[],uvs=[],indices=[];
 for(const {x,z,sx,sz,y=.632} of dynamics.puddles){
  const start=vertices.length/3;
  vertices.push(x,-z,y-.632);uvs.push(.5,.5);
  for(let i=0;i<=56;i++){
   const a=i/56*PI*2,k=1+Math.sin(a*5+z)*.075+Math.cos(a*9+x)*.035;
   vertices.push(x+Math.cos(a)*sx*k,-z-Math.sin(a)*sz*k,y-.632);
   uvs.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);
   if(i<56)indices.push(start,start+i+2,start+i+1);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const shader={uniforms:{color:{value:new THREE.Color('#8ba99c')},tDiffuse:{value:null},textureMatrix:{value:null},time:{value:0}},
  vertexShader:`uniform mat4 textureMatrix;varying vec4 reflected;varying vec2 puddleUV;varying vec3 world;
   void main(){puddleUV=uv;reflected=textureMatrix*vec4(position,1.);world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float time;varying vec4 reflected;varying vec2 puddleUV;varying vec3 world;
   ${cloudGLSL}
   void main(){vec4 uv=reflected;float rip=sin(world.x*38.+world.z*17.-time*2.7)*sin(world.z*32.+time*1.5);
    uv.xy+=vec2(rip*.00045,sin(world.z*35.+time*2.)*.0007)*uv.w;
    vec3 ref=texture2DProj(tDiffuse,uv).rgb;ref=floor(ref*12.+.5)/12.;
    float edge=1.-smoothstep(.88,1.,length(puddleUV-.5)*2.);
    vec3 color=mix(vec3(.24,.38,.32),ref,.76);float glint=step(.97,sin(world.z*36.+world.x*5.))*step(.7,sin(world.x*8.));
    color+=glint*.025*(1.-cloudCover(world.xz,time)*.8);gl_FragColor=vec4(color,edge*.69);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`};
 const puddles=new Reflector(geometry,{textureWidth:1536,textureHeight:1536,clipBias:.002,shader});
 puddles.position.y=.632;puddles.rotation.x=-PI/2;
 puddles.material.transparent=true;puddles.material.depthWrite=false;puddles.renderOrder=3;
 puddles.castShadow=false;puddles.receiveShadow=false;root.add(puddles);dynamics.wetMirror=puddles;
 // Do not recursively capture another mirror. This also prevents the water's
 // camera from changing the puddles' projection halfway through a frame.
 for(const mirror of [water,puddles]){
  const capture=mirror.onBeforeRender;
  mirror.onBeforeRender=function(...args){
   const other=mirror===water?puddles:water,visible=other.visible;
   other.visible=false;
   try{capture.apply(this,args);}finally{other.visible=visible;}
  };
 }
}
