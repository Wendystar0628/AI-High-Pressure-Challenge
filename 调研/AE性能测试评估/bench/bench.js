/* 独立微基准，不是完整编辑器。无外部依赖，file:// 可运行。 */
'use strict';
const tick=()=>new Promise(r=>setTimeout(r,0));
const now=()=>performance.now();
const cat=(...a)=>{a=a.flat();let b=new Uint8Array(a.reduce((n,x)=>n+x.length,0)),p=0;for(const x of a){b.set(x,p);p+=x.length}return b};
const bytes=s=>new TextEncoder().encode(s);
const u32=n=>new Uint8Array([n>>>24,(n>>>16)&255,(n>>>8)&255,n&255]);
const u16=n=>new Uint8Array([n>>>8,n&255]);
const box=(s,...a)=>{const d=cat(...a);return cat(u32(d.length+8),bytes(s),d)};
const full=(s,ver,flags,...a)=>box(s,new Uint8Array([ver,flags>>>16,flags>>>8,flags]),...a);
// 单轨 AVC MP4：每个样本单独一个 chunk，固定帧率，无 B 帧。
function mp4(chunks,desc,w,h){
 const N=chunks.length,ts=60000,dt=1000,dur=N*dt;
 const matrix=cat(u32(65536),u32(0),u32(0),u32(0),u32(65536),u32(0),u32(0),u32(0),u32(0x40000000));
 const ftyp=box('ftyp',bytes('isom'),u32(512),bytes('isomiso2avc1mp41'));
 const mdat=box('mdat',...chunks.map(c=>c.data));let off=ftyp.length+8;
 const offsets=chunks.map(c=>{const v=off;off+=c.data.length;return u32(v)});
 const avc1=box('avc1',new Uint8Array(6),u16(1),new Uint8Array(16),u16(w),u16(h),u32(0x480000),u32(0x480000),u32(0),u16(1),new Uint8Array(32),u16(24),u16(65535),box('avcC',new Uint8Array(desc)));
 const stbl=box('stbl',full('stsd',0,0,u32(1),avc1),full('stts',0,0,u32(1),u32(N),u32(dt)),full('stsc',0,0,u32(1),u32(1),u32(1),u32(1)),full('stsz',0,0,u32(0),u32(N),...chunks.map(c=>u32(c.data.length))),full('stco',0,0,u32(N),...offsets),full('stss',0,0,u32(chunks.filter(c=>c.key).length),...chunks.map((c,i)=>c.key?u32(i+1):null).filter(Boolean)));
 const dinf=box('dinf',full('dref',0,0,u32(1),full('url ',0,1)));
 const minf=box('minf',full('vmhd',0,1,new Uint8Array(8)),dinf,stbl);
 const mdia=box('mdia',full('mdhd',0,0,u32(0),u32(0),u32(ts),u32(dur),u16(0x55c4),u16(0)),full('hdlr',0,0,u32(0),bytes('vide'),new Uint8Array(12),bytes('Video\0')),minf);
 const tkhd=full('tkhd',0,7,u32(0),u32(0),u32(1),u32(0),u32(dur),new Uint8Array(8),new Uint8Array(8),matrix,u32(w*65536),u32(h*65536));
 const mvhd=full('mvhd',0,0,u32(0),u32(0),u32(ts),u32(dur),u32(65536),u16(256),new Uint8Array(10),matrix,new Uint8Array(24),u32(2));
 return new Blob([ftyp,mdat,box('moov',mvhd,box('trak',tkhd,mdia))],{type:'video/mp4'});
}
function ivf(chunks,w,h){const h1=new Uint8Array(32),v=new DataView(h1.buffer);h1.set(bytes('DKIF'));v.setUint16(6,32,true);h1.set(bytes('VP90'),8);v.setUint16(12,w,true);v.setUint16(14,h,true);v.setUint32(16,60,true);v.setUint32(20,1,true);v.setUint32(24,chunks.length,true);return new Blob([h1,...chunks.flatMap((c,i)=>{let b=new Uint8Array(12),d=new DataView(b.buffer);d.setUint32(0,c.data.length,true);d.setUint32(4,i,true);return[b,c.data]})],{type:'video/x-ivf'})}

function createBench(w=1920,h=1080){
 const canvas=document.getElementById('c');canvas.width=w;canvas.height=h;
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('无 WebGL2');
 if(!gl.getExtension('EXT_color_buffer_float'))throw Error('无 float FBO');
 const dbg=gl.getExtension('WEBGL_debug_renderer_info');
 const info={renderer:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),userAgent:navigator.userAgent,w,h,webcodecs:!!window.VideoEncoder};
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 function prog(v,f){function shader(type,s){let x=gl.createShader(type);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x}let p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'#version 300 es\n'+v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;\n'+f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
 const rect=prog(`layout(location=0) in vec4 a;layout(location=1) in vec4 b;out vec2 local;out float op;uniform vec2 res;void main(){vec2 q=vec2((gl_VertexID==1||gl_VertexID==2||gl_VertexID==4)?1.:-1.,(gl_VertexID>=2&&gl_VertexID<=4)?1.:-1.);local=q*100.;op=b.z;vec2 p=vec2(a.z*local.x+a.w*local.y,b.x*local.x+b.y*local.y)+a.xy;gl_Position=vec4(p.x/res.x*2.-1.,1.-p.y/res.y*2.,0,1);}`,`in vec2 local;in float op;uniform bool mask;out vec4 col;void main(){float alpha=op;vec2 d=100.-abs(local);alpha*=smoothstep(0.,max(fwidth(local.x),fwidth(local.y)),min(d.x,d.y));if(mask){float z=(100.-length(local))/10.;float v=clamp(z*.70710678,-5.,5.);float signv=sign(v);v=abs(v);float t=1./(1.+.3275911*v);float erf=1.-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-v*v);alpha*=.5*(1.+signv*erf);}col=vec4(vec3(38.,166.,255.)/255.*alpha,alpha);}`);
 const tex=prog(`out vec2 uv;uniform vec2 transform;void main(){vec2 q=vec2((gl_VertexID==1||gl_VertexID==2||gl_VertexID==4)?1.:-1.,(gl_VertexID>=2&&gl_VertexID<=4)?1.:-1.);uv=q*.5+.5;vec2 p=q*vec2(${w}.0,${h}.0)*.5*transform.y;float c=cos(-transform.x),s=sin(-transform.x);p=mat2(c,s,-s,c)*p;gl_Position=vec4(p/vec2(${w}.0,${h}.0)*2.,0,1);}`,`in vec2 uv;uniform sampler2D image;uniform float weight;out vec4 col;void main(){col=texture(image,uv)*weight;}`);
 const loc=(p,n)=>gl.getUniformLocation(p,n);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,131072*8*4,gl.DYNAMIC_DRAW);
 for(let i=0;i<2;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,4,gl.FLOAT,false,32,i*16);gl.vertexAttribDivisor(i,1)}
 const data=new Float32Array(131072*8);
 function fbo(float=false){let t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,float?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,float?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);let f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('FBO 不完整');return{f,t}}
 const out=fbo(),sample=fbo(),acc=fbo(true),child=fbo();
 function clear(f,bg=true){gl.bindFramebuffer(gl.FRAMEBUFFER,f.f);gl.clearColor(bg?4/255:0,bg?5/255:0,bg?9/255:0,bg?1:0);gl.clear(gl.COLOR_BUFFER_BIT)}
 function copy(src,dst,weight=1,rot=0,scale=1,add=false){gl.bindFramebuffer(gl.FRAMEBUFFER,dst.f);gl.useProgram(tex);gl.uniform2f(loc(tex,'transform'),rot,scale);gl.uniform1f(loc(tex,'weight'),weight);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,src.t);gl.uniform1i(loc(tex,'image'),0);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,add?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,6)}
 let source=null,activeScene='A',groupSource=null;
 function draw(n,t,target,masked=false,bg=true){clear(target,bg);let count=0;
  if(source)count=source(activeScene,t,data);else for(let id=0;id<n;id++){let shift=0,x=160,y=160;for(let j=0;j<Math.log2(n);j++)if(id&(1<<j)){shift+=j+1;if(j<6)x+=24*(1<<j);else y+=13*(1<<(j-6))}let ft=t-shift;if(ft<0||ft>=600)continue;let u=Math.min(ft/240,2),k=Math.floor(Math.min(u,1)),v=u-k;let scale=k===0?1-.4*v:.6+.4*v,opacity=k===0?1-.5*v:.5+.5*v;let p=count++*8,c=Math.cos(u*Math.PI)*scale,s=Math.sin(u*Math.PI)*scale;data[p]=x;data[p+1]=y;data[p+2]=c;data[p+3]=-s;data[p+4]=s;data[p+5]=c;data[p+6]=opacity;}
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,count*8));gl.useProgram(rect);gl.uniform2f(loc(rect,'res'),w,h);gl.uniform1i(loc(rect,'mask'),masked);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArraysInstanced(gl.TRIANGLES,0,6,count);return count;
 }
 let evaluations=0;
 function render(scene,frame,angle=180,nOverride=0){activeScene=scene;gl.viewport(0,0,w,h);if(scene==='A'){evaluations+=draw(nOverride||4096,frame,out)}else if(scene==='B'){clear(out);for(let i=7;i>=0;i--){let t=frame-i*60;if(t<0)continue;let g=groupSource?groupSource(i,t):null;if(g)t=g.time;else if(i<4)t=t<=300?t:600-t;evaluations+=draw(1024,t,child,false,false);copy(child,out,1,g?g.rotation:11*i*Math.PI/180,g?g.scale:1-.025*i)}}else{clear(acc,false);for(let s=0;s<8;s++){let t=frame-90/360+(s+.5)/8*angle/360;evaluations+=draw(nOverride||1024,t,sample,true);copy(sample,acc,1/8,0,1,true)}clear(out,false);copy(acc,out)}gl.bindFramebuffer(gl.READ_FRAMEBUFFER,out.f);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,w,h,0,0,w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
 function pixels(p=new Uint8Array(w*h*4)){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return p}
 async function timing(scene,{frames=60,angle=180,read=false,n=0}={}){for(let i=0;i<6;i++)render(scene,150+i,angle,n);gl.finish();evaluations=0;let t=now(),first=0;for(let i=0;i<frames;i++){render(scene,(i*599/(frames-1))|0,angle,n);if(read)pixels();if(i===0){gl.finish();first=now()-t}}gl.finish();let ms=now()-t;return{scene,frames,angle,n,read,ms,msPerFrame:ms/frames,firstMs:first,evaluations,error:gl.getError()}}
 async function encode(scene,{frames=600,codec='avc1.420033',hardware='prefer-hardware',read=false,angle=180,bitrate=80000000,latency='quality'}={}){
  const triggerTime=now();
  const cfg={codec,width:w,height:h,bitrate,framerate:60,hardwareAcceleration:hardware,latencyMode:latency};if(codec.startsWith('avc'))cfg.avc={format:'avc'};let support=await VideoEncoder.isConfigSupported(cfg);if(!support.supported)return{scene,cfg,supported:false};
  evaluations=0;let chunks=[],desc,fail;let encoder=new VideoEncoder({output:(c,m)=>{let d=new Uint8Array(c.byteLength);c.copyTo(d);chunks.push({data:d,timestamp:c.timestamp,duration:c.duration,key:c.type==='key'});if(m?.decoderConfig)desc=m.decoderConfig.description},error:e=>fail=String(e)});
  let t0=now(),submitMs=0;encoder.configure(cfg);let refs=new Map();
  const raw=read?new Uint8Array(w*h*4):null,flipped=read?new Uint8ClampedArray(w*h*4):null;
  const cpuCanvas=read?new OffscreenCanvas(w,h):null,cpuCtx=read?cpuCanvas.getContext('2d'):null,cpuImage=read?new ImageData(flipped,w,h):null;
  for(let i=0;i<frames;i++){if(fail)throw Error(fail);render(scene,i,angle);if(read){pixels(raw);for(let y=0;y<h;y++)flipped.set(raw.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);cpuCtx.putImageData(cpuImage,0,0)}if([0,150,450].includes(i))refs.set(Math.round(i*1e6/60),pixels());let opt={timestamp:Math.round(i*1e6/60),duration:Math.round(1e6/60)};let f=new VideoFrame(read?cpuCanvas:canvas,opt);encoder.encode(f,{keyFrame:i%120===0});f.close();if(encoder.encodeQueueSize>4)await new Promise(r=>{let cb=()=>{if(encoder.encodeQueueSize<=2){encoder.removeEventListener('dequeue',cb);r()}};encoder.addEventListener('dequeue',cb);cb()});if(i%60===0){document.getElementById('status').textContent=`${scene} ${codec} ${i}/${frames}`;await tick()}}
  submitMs=now()-t0;await encoder.flush();encoder.close();gl.finish();let encodedMs=now()-t0;
  let blob=codec.startsWith('avc')?mp4(chunks,desc,w,h):ivf(chunks,w,h);await blob.arrayBuffer();let totalMs=now()-triggerTime;
  let psnr={};const c2=document.createElement('canvas');c2.width=w;c2.height=h;const cx=c2.getContext('2d',{willReadFrequently:true});
  const decoder=new VideoDecoder({output:f=>{let ref=refs.get(f.timestamp);if(ref){cx.drawImage(f,0,0);let dec=cx.getImageData(0,0,w,h).data;let e=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let k=0;k<3;k++){let d=dec[(y*w+x)*4+k]-ref[((h-1-y)*w+x)*4+k];e+=d*d}psnr[f.timestamp]=(e===0?999:10*Math.log10(255*255/(e/(w*h*3))))}f.close()},error:e=>fail=String(e)});
  let dc={codec,codedWidth:w,codedHeight:h};if(desc)dc.description=desc;decoder.configure(dc);for(let i=0;i<chunks.length;i++){let c=chunks[i];decoder.decode(new EncodedVideoChunk({type:c.key?'key':'delta',timestamp:c.timestamp,duration:c.duration,data:c.data}));while(decoder.decodeQueueSize>16)await tick()}await decoder.flush();decoder.close();
  const name=`${scene}-${w}x${h}-${angle}-${codec.startsWith('avc')?'h264.mp4':'vp9.ivf'}`;window.lastBlob=blob;window.lastName=name;
  return{scene,w,h,frames,angle,cfg,preparationMs:t0-triggerTime,submitMs,encodedMs,totalMs,bytes:blob.size,chunks:chunks.length,psnr,evaluations,error:gl.getError(),fail:fail||null,name};
 }
 return{info,render,timing,encode,pixels,sync:()=>{gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))},setSource:(f,g)=>{source=f;groupSource=g}};
}
window.createBench=createBench;

// 普通对象 + 每属性关键帧数组；差量撤销，图层复制时深拷贝可变对象。
window.editBench=async function(N=65536){
 const heap=()=>performance.memory?.usedJSHeapSize||0;const startHeap=heap();
 const make=i=>({id:i,name:'图层 '+i,x:160+(i%64)*24,y:160+((i>>6)%64)*13,start:i%79,props:Array.from({length:3},(_,p)=>({name:['rot','scale','opacity'][p],keys:[0,4,8].map((t,k)=>({t,value:p===0?k*180:p===1?[k===1?60:100,k===1?60:100]:k===1?50:100,ii:'linear',oi:'linear',ih:null,oh:null}))}))});
 let t0=now(),layers=Array.from({length:N},(_,i)=>make(i));const buildMs=now()-t0,baseHeap=heap();const baseline=JSON.stringify(layers[17]);
 let steps=[],maxHeap=baseHeap;for(let repeat=0;repeat<5;repeat++){let before,after;
  for(let op of ['F9','undo','redo','undo']){let t=now();if(op==='F9'){before=layers.map(l=>l.props);after=layers.map(l=>l.props.map(p=>({...p,keys:p.keys.map(k=>({...k,ii:'bezier',oi:'bezier',ih:[1/3,0],oh:[1/3,0]}))})));layers.forEach((l,i)=>l.props=after[i]);}else layers.forEach((l,i)=>l.props=op==='redo'?after[i]:before[i]);steps.push({op,ms:now()-t});maxHeap=Math.max(maxHeap,heap());await tick()}
 }
 const validEase=JSON.stringify(layers[17])===baseline;
 let duplicates=[];for(let rep=0;rep<8;rep++){let t=now();let orig=layers;let clones=layers.map((l,i)=>({...l,id:N+i,props:l.props.map(p=>({...p,keys:p.keys.map(k=>({...k,value:Array.isArray(k.value)?k.value.slice():k.value,ih:k.ih?.slice()||null,oh:k.oh?.slice()||null}))}))}));layers=orig.concat(clones);let copyMs=now()-t;maxHeap=Math.max(maxHeap,heap());const valid=layers.length===N*2&&layers[N+17].props[0].keys[1]!==orig[17].props[0].keys[1];t=now();layers=orig;duplicates.push({copyMs,undoMs:now()-t,valid});await tick()}
 return{N,keys:N*9,buildMs,steps,task4Ms:steps.reduce((s,x)=>s+x.ms,0),duplicates,task5Ms:duplicates.reduce((s,x)=>s+x.copyMs+x.undoMs,0),startHeap,baseHeap,maxHeap,validEase,validFinal:layers.length===N&&JSON.stringify(layers[17])===baseline,note:'只测数据层，未含四视图重绘；峰值是采样值，不是操作系统 RSS'};
};
