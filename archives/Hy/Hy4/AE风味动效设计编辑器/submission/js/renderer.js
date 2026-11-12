/* ============================================================
   renderer.js — 原生 WebGL2 渲染器
   阴影贴图 / 金属 PBR + 程序环境反射 / 发光 / 粒子与拖尾 /
   多快门取样运动模糊 / Bloom / 由实际深度决定的景深 / ACES 色调映射
   渲染是时间 t 的纯函数，可任意取样、倒放、多次取样而不推进状态。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,S=AE.shaders;
  const R=AE.renderer={};

  function createProg(gl,vs,fs){
    const c=(type,src)=>{
      const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
        console.error('shader error:',gl.getShaderInfoLog(s),'\n',src.slice(0,400));
      }
      return s;
    };
    const p=gl.createProgram();
    gl.attachShader(p,c(gl.VERTEX_SHADER,vs));gl.attachShader(p,c(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))console.error('link error:',gl.getProgramInfoLog(p));
    p._u={};return p;
  }
  function loc(gl,p,name){
    if(!(name in p._u))p._u[name]=gl.getUniformLocation(p,name);
    return p._u[name];
  }
  function set(gl,p,name,v){
    const l=loc(gl,p,name);if(l===null||l===undefined)return;
    if(typeof v==='number')gl.uniform1f(l,v);
    else if(v.length===16)gl.uniformMatrix4fv(l,false,v);
    else if(v.length===9)gl.uniformMatrix3fv(l,false,v);
    else if(v.length===4)gl.uniform4fv(l,v);
    else if(v.length===3)gl.uniform3fv(l,v);
    else if(v.length===2)gl.uniform2fv(l,v);
  }
  function setI(gl,p,name,v){const l=loc(gl,p,name);if(l)gl.uniform1i(l,v);}

  R.create=function(canvas){
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,premultipliedAlpha:false,
      preserveDrawingBuffer:true,powerPreference:'high-performance'});
    if(!gl){console.error('WebGL2 不可用');return null;}
    const ext=gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const HDR=!!ext;
    const Rr={
      gl:gl,canvas:canvas,HDR:HDR,W:0,H:0,dpr:1,
      progs:{},meshGPU:{},ready:false,
      mbSamples:1,
    };

    Rr.progs.bg=createProg(gl,S.quadVS,S.bgFS);
    Rr.progs.depth=createProg(gl,S.depthVS,S.depthFS);
    Rr.progs.mesh=createProg(gl,S.meshVS,S.meshFS);
    Rr.progs.point=createProg(gl,S.pointVS,S.pointFS);
    Rr.progs.line=createProg(gl,S.lineVS,S.lineFS);
    Rr.progs.bright=createProg(gl,S.quadVS,S.brightFS);
    Rr.progs.blur=createProg(gl,S.quadVS,S.blurFS);
    Rr.progs.comp=createProg(gl,S.quadVS,S.compositeFS);
    Rr.emptyVAO=gl.createVertexArray();

    const cif=HDR?gl.RGBA16F:gl.RGBA8, ctf=HDR?gl.HALF_FLOAT:gl.UNSIGNED_BYTE;
    Rr.cif=cif;Rr.ctf=ctf;

    function mkTex(w,h,internal,fmt,type,filter){
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,internal,w,h,0,fmt,type,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter||gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter||gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      return t;
    }
    function mkFBO(colorTex,depthTex){
      const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,colorTex,0);
      if(depthTex)gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depthTex,0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      return f;
    }
    function del(o){if(!o)return;if(o.tex)gl.deleteTexture(o.tex);if(o.depth)gl.deleteTexture(o.depth);if(o.fbo)gl.deleteFramebuffer(o.fbo);}
    function unbindTex(){
      for(let u=0;u<3;u++){gl.activeTexture(gl.TEXTURE0+u);gl.bindTexture(gl.TEXTURE_2D,null);}
      gl.activeTexture(gl.TEXTURE0);
    }

    Rr.resize=function(w,h){
      w=Math.max(2,Math.floor(w));h=Math.max(2,Math.floor(h));
      if(Rr.W===w&&Rr.H===h&&Rr.ready)return;
      Rr.W=w;Rr.H=h;
      // 清理旧目标
      del(Rr.scene);del(Rr.accum);del(Rr.h1);del(Rr.h2);
      const color=mkTex(w,h,cif,gl.RGBA,ctf,gl.LINEAR);
      const depth=mkTex(w,h,gl.DEPTH_COMPONENT24,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.NEAREST);
      Rr.scene={tex:color,depth:depth,fbo:mkFBO(color,depth)};
      // 累积缓冲（运动模糊）
      const ac=mkTex(w,h,cif,gl.RGBA,ctf,gl.LINEAR);
      const ad=mkTex(w,h,gl.DEPTH_COMPONENT24,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.NEAREST);
      Rr.accum={tex:ac,depth:ad,fbo:mkFBO(ac,ad)};
      // bloom 半分辨率
      const hw=Math.max(2,w>>1),hh=Math.max(2,h>>1);
      const t1=mkTex(hw,hh,cif,gl.RGBA,ctf,gl.LINEAR);
      const t2=mkTex(hw,hh,cif,gl.RGBA,ctf,gl.LINEAR);
      Rr.h1={tex:t1,w:hw,h:hh,fbo:mkFBO(t1,null)};
      Rr.h2={tex:t2,w:hw,h:hh,fbo:mkFBO(t2,null)};
      // 阴影贴图
      if(Rr.shadow){gl.deleteTexture(Rr.shadow.tex);gl.deleteTexture(Rr.shadow.color);gl.deleteFramebuffer(Rr.shadow.fbo);}
      const SHADOW=1024;
      const sd=mkTex(SHADOW,SHADOW,gl.DEPTH_COMPONENT24,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.NEAREST);
      const sc=mkTex(SHADOW,SHADOW,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,gl.NEAREST);
      const sf=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,sf);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sc,0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,sd,0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      Rr.shadow={tex:sd,color:sc,fbo:sf,size:SHADOW};
      // 清理纹理单元绑定，避免「纹理同时绑定到单元与帧缓冲」的反馈循环
      for(let u=0;u<4;u++){gl.activeTexture(gl.TEXTURE0+u);gl.bindTexture(gl.TEXTURE_2D,null);}
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      Rr.ready=true;
    };

    /* ---------- 网格上传 ---------- */
    function gpuMesh(key,mesh){
      let e=Rr.meshGPU[key];
      const pos=new Float32Array(mesh.pos),nrm=new Float32Array(mesh.nrm),idx=new Uint32Array(mesh.idx);
      if(!e){
        e={vao:gl.createVertexArray(),pos:gl.createBuffer(),nrm:gl.createBuffer(),idx:gl.createBuffer()};
        gl.bindVertexArray(e.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER,e.pos);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,e.nrm);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,e.idx);
        gl.bindVertexArray(null);
        Rr.meshGPU[key]=e;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER,e.pos);gl.bufferData(gl.ARRAY_BUFFER,pos,gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER,e.nrm);gl.bufferData(gl.ARRAY_BUFFER,nrm,gl.DYNAMIC_DRAW);
      Rr._lastIdxBuf=e.idx;
      e.count=idx.length;
      // 稍后在绑定 VAO 时上传索引
      e._idx=idx;
      return e;
    }
    function bindMesh(e){
      gl.bindVertexArray(e.vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,e.idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,e._idx,gl.DYNAMIC_DRAW);
    }
    function normalMat(m){
      const inv=U.mat4.invert(m),tr=U.mat4.transpose(inv);
      return new Float32Array([tr[0],tr[1],tr[2],tr[4],tr[5],tr[6],tr[8],tr[9],tr[10]]);
    }

    /* ---------- 粒子缓冲 ---------- */
    function makeDynVAO(spec){
      const vao=gl.createVertexArray(),bufs={};
      gl.bindVertexArray(vao);
      for(const s of spec){
        const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
        gl.enableVertexAttribArray(s.loc);gl.vertexAttribPointer(s.loc,s.size,gl.FLOAT,false,0,0);
        bufs[s.name]=b;
      }
      gl.bindVertexArray(null);
      return {vao:vao,bufs:bufs};
    }
    const pointVAO=makeDynVAO([
      {name:'pos',loc:0,size:3},{name:'col',loc:1,size:3},{name:'size',loc:2,size:1},{name:'alpha',loc:3,size:1}]);
    const lineVAO=makeDynVAO([
      {name:'pos',loc:0,size:3},{name:'col',loc:1,size:3},{name:'alpha',loc:2,size:1}]);
    function uploadBuf(buf,arr){
      gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);
    }

    /* ---------- 单次场景渲染 ---------- */
    function drawFullscreen(prog,setup,texUnit){
      gl.useProgram(prog);
      if(setup)setup(prog);
      gl.bindVertexArray(Rr.emptyVAO);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }

    function renderSample(scene,t){
      const W=Rr.W,H=Rr.H;
      gl.bindFramebuffer(gl.FRAMEBUFFER,Rr.scene.fbo);
      gl.viewport(0,0,W,H);
      gl.clearColor(0,0,0,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      // 背景
      const bg=Rr.progs.bg;
      gl.useProgram(bg);
      set(gl,bg,'uTime',t);set(gl,bg,'uWeight',1);set(gl,bg,'uRes',[W,H]);
      gl.bindVertexArray(Rr.emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);
      // 网格
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      const cam=scene.camera;
      const proj=U.mat4.perspective(U.rad(cam.fov||38),W/H,cam.near||0.1,cam.far||60);
      const view=U.mat4.lookAt(cam.pos,cam.target,cam.up||[0,1,0]);
      const VP=U.mat4.mul(proj,view);
      const pr=Rr.progs.mesh;gl.useProgram(pr);
      set(gl,pr,'uVP',VP);
      set(gl,pr,'uCamPos',scene.camera.pos);
      set(gl,pr,'uLightVP',scene.shadowVP);
      set(gl,pr,'uLightDir',scene.lights.dir.dir);
      set(gl,pr,'uLightColor',scene.lights.dir.color);
      set(gl,pr,'uLightInt',scene.lights.dir.intensity);
      set(gl,pr,'uPointPos',scene.lights.point.pos);
      set(gl,pr,'uPointColor',scene.lights.point.color);
      set(gl,pr,'uPointInt',scene.lights.point.intensity);
      set(gl,pr,'uTime',t);
      set(gl,pr,'uHasShadow',scene.lights.dir.shadow?1:0);
      set(gl,pr,'uWeight',1);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,Rr.shadow.tex);setI(gl,pr,'uShadow',1);
      for(const o of scene.meshes){
        if(!o.mesh||o.mesh.idx.length===0)continue;
        const e=gpuMesh(o.key,o.mesh);bindMesh(e);
        set(gl,pr,'uModel',o.model);
        set(gl,pr,'uNormalMat',normalMat(o.model));
        const M=o.material||{};
        set(gl,pr,'uBaseColor',M.baseColor||[.6,.6,.6]);
        set(gl,pr,'uMetalness',M.metalness==null?.9:M.metalness);
        set(gl,pr,'uRoughness',M.roughness==null?.3:M.roughness);
        set(gl,pr,'uEmissive',M.emissive||[0,0,0]);
        set(gl,pr,'uEmissiveInt',M.emissiveInt||0);
        const opacity=M.opacity==null?1:M.opacity;
        set(gl,pr,'uOpacity',opacity);
        const transparent=opacity<0.985;
        if(transparent){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}
        else gl.disable(gl.BLEND);
        gl.depthMask(!transparent);
        gl.drawElements(gl.TRIANGLES,e.count,gl.UNSIGNED_INT,0);
      }
      gl.depthMask(false);
      // 粒子（叠加混合）
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
      const P=scene.particles;
      if(P&&P.pos&&P.pos.length){
        const pp=Rr.progs.point;gl.useProgram(pp);
        set(gl,pp,'uVP',VP);
        set(gl,pp,'uPointScale',(H/(2*Math.tan(U.rad((scene.camera.fov||38))/2)))*(scene.sparkScale||1.4));
        set(gl,pp,'uWeight',1);
        const pcol=P.col||new Array(P.pos.length).fill(1);
        uploadBuf(pointVAO.bufs.pos,P.pos);uploadBuf(pointVAO.bufs.col,pcol);
        uploadBuf(pointVAO.bufs.size,P.size);uploadBuf(pointVAO.bufs.alpha,P.alpha);
        gl.bindVertexArray(pointVAO.vao);
        gl.drawArrays(gl.POINTS,0,P.pos.length/3);
      }
      // 拖尾
      if(P&&P.trails&&P.trails.length){
        const TT=P.trails,segs=TT.length/8,lp=[],lc=[],la=[];
        for(let i=0;i<segs;i++){
          const b=i*8;
          lp.push(TT[b],TT[b+1],TT[b+2],TT[b+3],TT[b+4],TT[b+5]);
          const c0=[1.0,0.5,0.16],c1=[1.0,0.68,0.3];
          lc.push(c0[0],c0[1],c0[2],c1[0],c1[1],c1[2]);
          la.push(TT[b+6],TT[b+7]);
        }
        const lp2=Rr.progs.line;gl.useProgram(lp2);
        set(gl,lp2,'uVP',VP);set(gl,lp2,'uWeight',1);
        uploadBuf(lineVAO.bufs.pos,lp);uploadBuf(lineVAO.bufs.col,lc);uploadBuf(lineVAO.bufs.alpha,la);
        gl.bindVertexArray(lineVAO.vao);
        gl.drawArrays(gl.LINES,0,segs*2);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }

    /* ---------- 阴影 ---------- */
    function shadowPass(scene){
      const sh=Rr.shadow;
      // 阴影贴图即将作为深度附件，先从所有纹理单元解绑，消除反馈循环
      unbindTex();
      gl.bindFramebuffer(gl.FRAMEBUFFER,sh.fbo);
      gl.viewport(0,0,sh.size,sh.size);
      gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
      gl.disable(gl.BLEND);
      const pr=Rr.progs.depth;gl.useProgram(pr);
      set(gl,pr,'uLightVP',scene.shadowVP);
      for(const o of scene.meshes){
        if(!o.castShadow||!o.mesh||o.mesh.idx.length===0)continue;
        const e=gpuMesh(o.key,o.mesh);bindMesh(e);
        set(gl,pr,'uModel',o.model);
        gl.drawElements(gl.TRIANGLES,e.count,gl.UNSIGNED_INT,0);
      }
      gl.bindVertexArray(null);
      gl.depthMask(true);
    }

    /* ---------- Bloom ---------- */
    function bloomPass(hdrTex,threshold){
      const W=Rr.W,H=Rr.H,hw=Rr.h1.w,hh=Rr.h1.h;
      unbindTex();
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
      // 亮部
      gl.bindFramebuffer(gl.FRAMEBUFFER,Rr.h1.fbo);gl.viewport(0,0,hw,hh);
      const bp=Rr.progs.bright;gl.useProgram(bp);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,hdrTex);setI(gl,bp,'uTex',0);
      set(gl,bp,'uThreshold',threshold==null?.85:threshold);
      gl.bindVertexArray(Rr.emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);
      // 多向高斯
      const bl=Rr.progs.blur;gl.useProgram(bl);
      const passes=[[1.0,0],[0,1.0],[2.3,0],[0,2.3]];
      for(let i=0;i<passes.length;i++){
        const src=i%2===0?Rr.h1:Rr.h2,dst=i%2===0?Rr.h2:Rr.h1;
        gl.bindFramebuffer(gl.FRAMEBUFFER,dst.fbo);gl.viewport(0,0,hw,hh);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,src.tex);setI(gl,bl,'uTex',0);
        set(gl,bl,'uDir',[passes[i][0]/hw,passes[i][1]/hh]);
        gl.bindVertexArray(Rr.emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);
      }
      // 结果在 h2（i=3 是奇数 → dst=h1? 检查：i=0 src h1 dst h2; i=1 src h2 dst h1; i=2 src h1 dst h2; i=3 src h2 dst h1）
      return Rr.h1.tex;
    }

    /* ---------- 合成 ---------- */
    function composite(hdrTex,depthTex,scene,bloomTex,t){
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.viewport(0,0,Rr.W,Rr.H);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
      const pr=Rr.progs.comp;gl.useProgram(pr);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,hdrTex);setI(gl,pr,'uScene',0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,bloomTex);setI(gl,pr,'uBloom',1);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,depthTex);setI(gl,pr,'uDepth',2);
      set(gl,pr,'uTexel',[1/Rr.W,1/Rr.H]);
      set(gl,pr,'uNear',scene.camera.near||0.1);set(gl,pr,'uFar',scene.camera.far||60);
      set(gl,pr,'uFocus',scene.camera.focus||8);
      set(gl,pr,'uAperture',scene.camera.aperture==null?.15:scene.camera.aperture);
      set(gl,pr,'uMaxCoC',scene.camera.maxCoC||7);
      set(gl,pr,'uBloomStrength',scene.bloom?scene.bloom.strength:.9);
      set(gl,pr,'uExposure',scene.bloom?scene.bloom.exposure:1.0);
      set(gl,pr,'uTime',t);
      gl.bindVertexArray(Rr.emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindVertexArray(null);
    }

    /* ---------- 主入口 ----------
       sceneAt(t) 返回时间 t 的场景（纯函数）；opts: {time,mbSamples,shutter}
    -------------------------------- */
    Rr.render=function(sceneAt,opts){
      opts=opts||{};
      const t=opts.time||0;
      Rr.resize(Rr.canvas.width,Rr.canvas.height);
      if(!Rr.ready)return;
      const center=sceneAt(t);
      if(!center)return;
      // 阴影（中心时刻）
      if(center.lights.dir.shadow)shadowPass(center);
      else{
        gl.bindFramebuffer(gl.FRAMEBUFFER,Rr.shadow.fbo);gl.viewport(0,0,Rr.shadow.size,Rr.shadow.size);
        gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      }
      let N=Math.max(1,Math.min(5,opts.mbSamples||1));
      const shutter=opts.shutter||0;
      let hdrTex=Rr.scene.tex;
      if(N>1){
        unbindTex();
        // 多次取样累积（正确遮挡：每次完整渲染后累加）
        const times=[];
        for(let k=0;k<N-1;k++)times.push(t+((k/(N-2||1))-0.5)*shutter);
        times.push(t); // 中心时刻最后渲染，深度对应焦点
        gl.bindFramebuffer(gl.FRAMEBUFFER,Rr.accum.fbo);
        gl.viewport(0,0,Rr.W,Rr.H);
        gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        for(let k=0;k<times.length;k++){
          const sc=k===times.length-1?center:sceneAt(times[k]);
          renderSample(sc,times[k]);
          // 累加
          gl.bindFramebuffer(gl.FRAMEBUFFER,Rr.accum.fbo);
          gl.viewport(0,0,Rr.W,Rr.H);
          gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
          gl.useProgram(Rr.progs.accum||(Rr.progs.accum=createProg(gl,S.quadVS,ACCUM_FS)));
          const ap=Rr.progs.accum;
          gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,Rr.scene.tex);setI(gl,ap,'uTex',0);
          set(gl,ap,'uW',1/times.length);
          gl.bindVertexArray(Rr.emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);
          gl.disable(gl.BLEND);
        }
        hdrTex=Rr.accum.tex;
        // 中心深度已在最后一次 renderSample 写入 scene.depth
      }else{
        renderSample(center,t);
      }
      const bloom=bloomPass(hdrTex,center.bloom?center.bloom.threshold:.8);
      composite(hdrTex,Rr.scene.depth,center,bloom,t);
    };

    const ACCUM_FS=`#version 300 es
    precision highp float; in vec2 vUV; out vec4 o;
    uniform sampler2D uTex; uniform float uW;
    void main(){ o=vec4(texture(uTex,vUV).rgb*uW,uW); }`;

    Rr.dispose=function(){};
    Rr.resize(2,2); // 初始化阴影/FBO，供界面在首帧渲染前读取
    return Rr;
  };

  console.log('[forge] renderer ready');
})();
