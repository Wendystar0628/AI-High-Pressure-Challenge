/* =========================================================================
   ui_props.js — properties / effects / info panel
   ========================================================================= */
(function(AE){
'use strict';
let app=null,container=null,fieldMap=[],currentTab='props';
const TRANSFORM=['anchor','position','scale','rotation','opacity'];
const TRANSFORM3D=['xRot','yRot','zRot','zPos'];
const PROP_LABEL={
  anchor:'锚点',position:'位置',scale:'缩放',rotation:'旋转',opacity:'不透明度',
  xRot:'X 轴旋转',yRot:'Y 轴旋转',zRot:'Z 轴旋转',zPos:'Z 位置',
  camDist:'镜头距离',camYaw:'水平环绕',camPitch:'垂直俯仰',camFocus:'对焦距离',camAperture:'光圈',
  trimStart:'修剪起点',trimEnd:'修剪终点',repeats:'重复数量',strokeW:'描边宽度',
  fontSize:'字号',animOffset:'范围偏移',depth:'挤出深度',bevel:'倒角',bend:'弯曲',twist:'扭转',
  fieldRadius:'场半径',fieldStrength:'场强度',lightInt:'灯光强度',echo:'回声',bloom:'发光',mbBoost:'运动模糊'
};
const UNITS={rotation:'°',xRot:'°',yRot:'°',zRot:'°',opacity:'%',scale:'%',camPitch:'°',camYaw:'°',camDist:'px',camFocus:'px',camAperture:'',depth:'px',bevel:'px'};
function pl(k){return PROP_LABEL[k]||k.replace(/([A-Z])/g,' $1');}
function fmt(v){if(typeof v==='number')return (Math.round(v*100)/100).toString();if(Array.isArray(v))return v.map(fmt).join(', ');return String(v);}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function comp(){return app.activeComp();}
function selLayers(){const c=comp();return c.layers.filter(l=>AE.state.selection.indexOf(l.id)>=0);}
function primary(){return selLayers()[0]||null;}

AE.Props={
  init(a){app=a;},
  setTab(t){currentTab=t;this.refresh();},
  mount(c){container=c;this.refresh();},
  refresh(){
    if(!container)return;
    fieldMap=[];
    if(currentTab==='fx'){this.renderEffects();return;}
    if(currentTab==='info'){this.renderInfo();return;}
    const L=primary();
    if(!L){
      container.innerHTML='<div class="empty-state"><span class="big">◈</span>未选择图层<br><span style="font-size:10px">在时间轴或画布中选择图层以编辑变换、关键帧与表达式</span></div>';
      return;
    }
    const c=comp(),t=AE.state.t;
    let h='';
    // header
    h+='<div class="pg-head"><span class="pg-swatch" style="background:'+(L.color||'#4fd1c5')+'"></span>'+
       '<span class="pg-name">'+esc(L.name)+'</span><span class="pg-type">'+typeName(L.type)+'</span></div>';
    // transform group
    h+=this.groupStart('变换','grpTransform');
    const keys=TRANSFORM.concat(L.threeD?TRANSFORM3D:[]);
    for(const k of keys)if(L.props[k])h+=this.propRow(L,k,t);
    h+=this.groupEnd();
    // type-specific animatable props
    const custom=Object.keys(L.props).filter(k=>keys.indexOf(k)<0&&k[0]!=='_');
    if(custom.length){
      h+=this.groupStart(typeName(L.type)+' 参数','grpCustom');
      for(const k of custom){
        const p=L.props[k];
        if(!p)continue;
        h+=this.propRow(L,k,t);
      }
      h+=this.groupEnd();
    }
    // layer settings
    h+=this.groupStart('图层设置','grpSettings',true);
    h+='<div class="pg-row"><span class="pg-label">名称</span><div class="pg-field" style="flex:1"><input class="pg-txt" id="pgName" value="'+esc(L.name)+'"></div></div>';
    h+='<div class="pg-row"><span class="pg-label">混合模式</span><div class="pg-field" style="flex:1"><select class="pg-txt" id="pgBlend">'+
      ['normal','add','screen','multiply','overlay'].map(b=>'<option value="'+b+'"'+(L.blend===b?' selected':'')+'>'+({normal:'正常',add:'相加',screen:'滤色',multiply:'正片叠底',overlay:'叠加'})[b]+'</option>').join('')+'</select></div></div>';
    h+='<div class="pg-row"><span class="pg-label">父级</span><div class="pg-field" style="flex:1"><select class="pg-txt" id="pgParent"><option value="">无</option>'+
      c.layers.filter(x=>x.id!==L.id).map(x=>'<option value="'+x.id+'"'+(L.parentId===x.id?' selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div></div>';
    h+='<div class="pg-row"><span class="pg-label">入 / 出点</span><div class="pg-field"><input class="pg-num" id="pgIn" value="'+L.inPoint.toFixed(2)+'"></div><div class="pg-field"><input class="pg-num" id="pgOut" value="'+L.outPoint.toFixed(2)+'"></div></div>';
    h+='<div class="pg-row"><span class="pg-label">选项</span>'+
      '<label class="chk mini"><input type="checkbox" id="pg3D"'+(L.threeD?' checked':'')+'>三维图层</label>'+
      '<label class="chk mini"><input type="checkbox" id="pgMB"'+(L.motionBlur?' checked':'')+'>运动模糊</label></div>';
    h+='<div class="pg-row"><span class="pg-label">轨道遮罩</span><div class="pg-field" style="flex:1"><select class="pg-txt" id="pgMatte">'+
      [['none','无'],['alpha','Alpha'],['alphaInv','Alpha 反转'],['luma','亮度'],['lumaInv','亮度 反转']].map(m=>'<option value="'+m[0]+'"'+((L.matte&&L.matte.mode)===m[0]?' selected':'')+'>'+m[1]+'</option>').join('')+'</select></div></div>';
    h+=this.groupEnd();
    // masks summary
    h+=this.groupStart('蒙版 ('+(L.masks||[]).length+')','grpMask',true);
    (L.masks||[]).forEach((m,i)=>{
      h+='<div class="pg-row"><span class="pg-label">'+(i+1)+' · '+(m.mode||'add')+'</span><span style="flex:1;color:#9aa4b2;font-size:10px">羽化 '+(m.feather||0)+' px · 不透明度 '+(m.opacity===undefined?100:m.opacity)+'%'+(m.invert?' · 反转':'')+'</span><span class="pg-expr-btn" data-delmask="'+i+'" title="删除">×</span></div>';
    });
    h+='<div class="pg-row"><span class="pg-label"></span><span class="pg-expr-btn" id="pgAddMask" style="width:auto;padding:2px 8px;background:#222732;border:1px solid #2c323d;border-radius:4px;color:#9aa4b2">+ 添加矩形蒙版</span></div>';
    h+=this.groupEnd();
    // effects summary
    h+=this.groupStart('效果 ('+(L.effects||[]).length+')','grpFx',true);
    (L.effects||[]).forEach((fx,i)=>{
      h+='<div class="pg-row"><span class="pg-label">✦ '+(i+1)+'</span><span style="flex:1;color:#9aa4b2;font-size:10px">'+esc(fx.name||fx.type)+'</span><span class="pg-expr-btn" data-upfx="'+i+'" title="上移">↑</span><span class="pg-expr-btn" data-downfx="'+i+'" title="下移">↓</span><span class="pg-expr-btn" data-delfx="'+i+'" title="删除">×</span></div>';
    });
    h+='<div class="pg-row"><span class="pg-label"></span><select class="pg-txt" id="pgAddFx" style="flex:1"><option value="">+ 添加效果…</option>'+
      ['glow','blur','dropShadow','hueSat'].map(f=>'<option value="'+f+'">'+({glow:'发光',blur:'高斯模糊',dropShadow:'投影',hueSat:'色相 / 饱和度'})[f]+'</option>').join('')+'</select></div>';
    h+=this.groupEnd();
    container.innerHTML=h;
    this.bind(L);
  },
  groupStart(title,id,closed){
    const st=AE.state['grp_'+id]===undefined?!!closed:AE.state['grp_'+id];
    return '<div class="pg-group"><div class="pg-group-title'+(!st?' closed':'')+'" data-grp="'+id+'"><span class="caret">▾</span>'+title+'</div><div class="pg-group-body" data-body="'+id+'" style="'+(st?'':'display:none')+'">';
  },
  groupEnd(){return '</div></div>';},
  propRow(L,k,t){
    const p=L.props[k];
    const v=AE.evalPropAt(p,t,app.project,comp(),L,{});
    const isVec=Array.isArray(v);
    const animated=AE.isAnimated(p)||!!p.e;
    let h='<div class="pg-row" data-prop="'+k+'">';
    h+='<span class="pg-label" title="'+pl(k)+'">'+pl(k)+'</span>';
    h+='<span class="pg-stopwatch'+(animated?' on':'')+'" data-sw="'+k+'" title="动画开关">◷</span>';
    h+='<span class="pg-nav" data-prev="'+k+'" title="上一关键帧">◀</span><span class="pg-nav" data-next="'+k+'" title="下一关键帧">▶</span>';
    if(isVec){
      const n=Math.min(3,v.length);
      for(let i=0;i<n;i++){
        h+='<div class="pg-field"><input class="pg-num" data-vec="'+k+'" data-i="'+i+'" value="'+(typeof v[i]==='number'?(Math.round(v[i]*100)/100):v[i])+'"><span class="pg-unit">'+(UNITS[k]||'')+'</span></div>';
        fieldMap.push({el:null,key:k,i});
      }
    } else {
      h+='<div class="pg-field"><input class="pg-num" data-scalar="'+k+'" value="'+(typeof v==='number'?(Math.round(v*100)/100):v)+'"><span class="pg-unit">'+(UNITS[k]||'')+'</span></div>';
      fieldMap.push({el:null,key:k,i:-1});
    }
    h+='<span class="pg-expr-btn'+(p.e?' on':'')+'" data-expr="'+k+'" title="表达式">ƒx</span>';
    h+='</div>';
    if(p.e||AE.state['expr_'+k]){
      const err=AE.state.exprErrors&&AE.state.exprErrors.get(L.name+'.expr');
      h+='<div class="expr-box"><textarea data-exprtext="'+k+'" spellcheck="false">'+esc(p.e||'')+'</textarea>'+
        '<div class="expr-help">value · time · wiggle(f,a) · loopOut("cycle"/"pingpong") · linear/ease(t,a,b,c,d) · thisComp.layer("名称").transform.rotation · valueAtTime(t) · toWorld / fromWorld · clamp · Math</div>'+
        (err?'<div class="expr-err">⚠ '+esc(err)+' → 已退回关键帧值</div>':'')+
        '<div class="pg-row" style="padding-left:0"><span class="pg-label">模式</span><select class="pg-txt" data-exprmode="'+k+'" style="flex:1"><option value="replace"'+(p.em!=='add'?' selected':'')+'>替换关键帧</option><option value="add"'+(p.em==='add'?' selected':'')+'>叠加到关键帧</option></select><span class="pg-expr-btn" data-clearexpr="'+k+'" title="清除表达式">×</span></div></div>';
    }
    return h;
  },
  bind(L){
    const c=comp(),t=AE.state.t;
    container.querySelectorAll('[data-grp]').forEach(el=>el.onclick=()=>{
      const id=el.dataset.grp,body=container.querySelector('[data-body="'+id+'"]');
      const open=body.style.display!=='none';body.style.display=open?'none':'';
      el.classList.toggle('closed',open);AE.state['grp_'+id]=!open;
    });
    container.querySelectorAll('.pg-num').forEach(inp=>{
      const k=inp.dataset.vec||inp.dataset.scalar;
      inp.onkeydown=(e)=>e.stopPropagation();
      inp.onchange=()=>this.setValue(L,k,inp);
      inp.onfocus=()=>inp.select();
    });
    container.querySelectorAll('[data-sw]').forEach(el=>el.onclick=()=>{
      const k=el.dataset.sw,p=L.props[k];
      if(AE.isAnimated(p)||p.e){p.k=null;p.e=null;this.showToast('已关闭 '+pl(k)+' 的动画');}
      else{const v=AE.evalPropAt(p,t,app.project,c,L,{});AE.setKey(p,t,AE.clone(v));this.showToast('已在当前时刻为 '+pl(k)+' 创建关键帧');}
      app.commit('切换动画开关');if(AE.UI)AE.UI.refresh();app.render();
    });
    container.querySelectorAll('[data-prev],[data-next]').forEach(el=>el.onclick=()=>{
      const k=el.dataset.prev||el.dataset.next,dir=el.dataset.prev?-1:1;
      const p=L.props[k];if(!p||!p.k)return;
      const ts=p.k.map(x=>x.t).filter(x=>dir>0?x>t+1e-4:x<t-1e-4).sort((a,b)=>a-b);
      const target=dir>0?ts[0]:ts[ts.length-1];if(target!==undefined)app.setTime(target);
    });
    container.querySelectorAll('[data-expr]').forEach(el=>el.onclick=()=>{
      const k=el.dataset.expr;AE.state['expr_'+k]=!AE.state['expr_'+k];
      if(AE.state['expr_'+k]&&!L.props[k].e)AE.state['expr_'+k]=true;
      this.refresh();
    });
    container.querySelectorAll('[data-exprtext]').forEach(ta=>{
      ta.onkeydown=(e)=>e.stopPropagation();
      ta.onchange=()=>{const k=ta.dataset.exprtext;L.props[k].e=ta.value.trim()||null;app.commit('编辑表达式');app.render();if(AE.UI)AE.UI.refresh();};
    });
    container.querySelectorAll('[data-exprmode]').forEach(s=>s.onchange=()=>{L.props[s.dataset.exprmode].em=s.value;app.commit('表达式模式');app.render();});
    container.querySelectorAll('[data-clearexpr]').forEach(el=>el.onclick=()=>{const k=el.dataset.clearexpr;L.props[k].e=null;AE.state['expr_'+k]=false;app.commit('清除表达式');this.refresh();app.render();});
    const n=container.querySelector('#pgName');if(n){n.onkeydown=e=>e.stopPropagation();n.onchange=()=>{L.name=n.value.trim()||L.name;app.commit('重命名');if(AE.UI)AE.UI.refresh();};}
    const b=container.querySelector('#pgBlend');if(b)b.onchange=()=>{L.blend=b.value;app.commit('混合模式');app.render();};
    const par=container.querySelector('#pgParent');if(par)par.onchange=()=>{L.parentId=par.value||null;app.commit('设置父级');app.render();};
    const pin=container.querySelector('#pgIn');if(pin){pin.onkeydown=e=>e.stopPropagation();pin.onchange=()=>{L.inPoint=clamp(parseFloat(pin.value)||0,0,c.duration);app.commit('入点');if(AE.UI)AE.UI.refresh();app.render();};}
    const pout=container.querySelector('#pout')||container.querySelector('#pgOut');if(pout){pout.onkeydown=e=>e.stopPropagation();pout.onchange=()=>{L.outPoint=clamp(parseFloat(pout.value)||c.duration,0,c.duration);app.commit('出点');if(AE.UI)AE.UI.refresh();app.render();};}
    const d3=container.querySelector('#pg3D');if(d3)d3.onchange=()=>{L.threeD=d3.checked;app.commit('三维图层');app.render();};
    const mb=container.querySelector('#pgMB');if(mb)mb.onchange=()=>{L.motionBlur=mb.checked;app.commit('运动模糊');};
    const mat=container.querySelector('#pgMatte');if(mat)mat.onchange=()=>{L.matte=L.matte||{};L.matte.mode=mat.value;app.commit('轨道遮罩');};
    const am=container.querySelector('#pgAddMask');if(am)am.onclick=()=>{L.masks=L.masks||[];L.masks.push({path:null,invert:false,feather:40,opacity:100,mode:'add'});app.commit('添加蒙版');this.refresh();};
    container.querySelectorAll('[data-delmask]').forEach(el=>el.onclick=()=>{L.masks.splice(parseInt(el.dataset.delmask,10),1);app.commit('删除蒙版');this.refresh();});
    const af=container.querySelector('#pgAddFx');if(af)af.onchange=()=>{if(!af.value)return;L.effects=L.effects||[];L.effects.push({type:af.value,name:({glow:'发光',blur:'高斯模糊',dropShadow:'投影',hueSat:'色相 / 饱和度'})[af.value],params:{amount:20,radius:12}});app.commit('添加效果');this.refresh();};
    container.querySelectorAll('[data-delfx]').forEach(el=>el.onclick=()=>{L.effects.splice(parseInt(el.dataset.delfx,10),1);app.commit('删除效果');this.refresh();});
    container.querySelectorAll('[data-upfx],[data-downfx]').forEach(el=>el.onclick=()=>{const i=parseInt(el.dataset.upfx!==undefined?el.dataset.upfx:el.dataset.downfx,10);const j=el.dataset.upfx!==undefined?i-1:i+1;if(j<0||j>=L.effects.length)return;[L.effects[i],L.effects[j]]=[L.effects[j],L.effects[i]];app.commit('效果排序');this.refresh();});
    // cache field elements
    fieldMap.forEach(f=>{f.el=container.querySelector('[data-vec="'+f.key+'"][data-i="'+f.i+'"]')||container.querySelector('[data-scalar="'+f.key+'"]');});
  },
  setValue(L,k,inp){
    const p=L.props[k],t=AE.state.t;
    const cur=AE.evalPropAt(p,t,app.project,comp(),L,{});
    let v;
    if(inp.dataset.scalar){
      const n=parseFloat(inp.value);if(!isFinite(n)){this.refreshTime();return;}
      v=n;
    } else {
      const i=parseInt(inp.dataset.i,10);
      const arr=Array.isArray(cur)?cur.slice():[0,0,0];
      const n=parseFloat(inp.value);if(isFinite(n))arr[i]=n;
      v=arr;
    }
    if(AE.isAnimated(p)||p.e)AE.setKey(p,t,AE.clone(v));else p.n=v;
    app.commit('修改 '+pl(k));app.render();this.refreshTime();
    if(AE.Timeline)AE.Timeline.build();
  },
  refreshTime(){
    if(!container||currentTab!=='props')return;
    for(const f of fieldMap){
      if(!f.el||document.activeElement===f.el)continue;
      const L=primary();if(!L)return;
      const p=L.props[f.key];if(!p)continue;
      const v=AE.evalPropAt(p,AE.state.t,app.project,comp(),L,{});
      const x=f.i<0?v:(Array.isArray(v)?v[f.i]:v);
      f.el.value=(typeof x==='number')?(Math.round(x*100)/100):x;
    }
    // expression errors
    const L=primary();if(L){
      const err=AE.state.exprErrors&&(AE.state.exprErrors.get(L.name+'.expr')||[...AE.state.exprErrors.entries()].find(e=>e[0].indexOf(L.name)===0));
      let box=container.querySelector('.expr-err');
      const msg=err?(Array.isArray(err)?err[1]:err):null;
      if(msg&&!box){const ta=container.querySelector('[data-exprtext]');if(ta){const d=document.createElement('div');d.className='expr-err';d.textContent='⚠ '+msg+' → 已退回关键帧值';ta.parentNode.appendChild(d);}}
    }
  },
  updateFrame(){},
  renderEffects(){
    const L=primary();
    if(!L){container.innerHTML='<div class="empty-state"><span class="big">✦</span>未选择图层</div>';return;}
    let h='<div class="pg-head"><span class="pg-swatch" style="background:'+(L.color||'#4fd1c5')+'"></span><span class="pg-name">效果 · '+esc(L.name)+'</span></div>';
    const defs={glow:[['半径','radius',24],['强度','intensity',1.4]],blur:[['模糊量','amount',16]],dropShadow:[['距离','distance',24],['柔和','softness',20],['方向','direction',135]],hueSat:[['色相','hue',0],['饱和度','saturation',100],['亮度','lightness',100]]};
    (L.effects||[]).forEach((fx,i)=>{
      h+='<div class="pg-group"><div class="pg-group-title"><span class="caret">▾</span>✦ '+esc(fx.name||fx.type)+'</div><div class="pg-group-body">';
      for(const [lab,key,def] of (defs[fx.type]||[])){
        const v=fx.params&&fx.params[key]!==undefined?fx.params[key]:def;
        h+='<div class="pg-row"><span class="pg-label">'+lab+'</span><div class="pg-field"><input class="pg-num" data-fx="'+i+'" data-fxkey="'+key+'" value="'+v+'"></div></div>';
      }
      h+='<div class="pg-row"><span class="pg-label"></span><span style="font-size:9.5px;color:#646e7d">参数可动画 · 可排序 · 发光与投影可伸出边界</span></div></div></div>';
    });
    if(!(L.effects||[]).length)h+='<div class="empty-state" style="padding:20px">此图层暂无效果<br><span style="font-size:10px">在「属性」面板底部添加</span></div>';
    container.innerHTML=h;
    container.querySelectorAll('[data-fx]').forEach(inp=>{inp.onkeydown=e=>e.stopPropagation();inp.onchange=()=>{const fx=L.effects[parseInt(inp.dataset.fx,10)];fx.params=fx.params||{};fx.params[inp.dataset.fxkey]=parseFloat(inp.value)||0;app.commit('效果参数');};});
  },
  renderInfo(){
    const c=comp();
    let h='<div class="pg-head"><span class="pg-swatch" style="background:#7c8cff"></span><span class="pg-name">合成信息</span></div>';
    const rows=[['名称',c.name],['尺寸',c.W+' × '+c.H],['帧率',c.fps+' fps'],['时长',c.duration.toFixed(2)+' s'],['工作区',c.workIn.toFixed(2)+' – '+c.workOut.toFixed(2)+' s'],['图层数',c.layers.length],['标记',(c.markers||[]).length],['活动相机',(c.layers.find(l=>l.type==='camera'&&l.enabled)||{}).name||'默认'],['选中',AE.state.selection.length+' 个图层'],['当前时间',AE.state.t.toFixed(3)+' s']];
    for(const [k,v] of rows)h+='<div class="info-line"><span>'+k+'</span><b>'+esc(v)+'</b></div>';
    h+='<div class="info-sec">快捷键</div>';
    [['播放 / 暂停','空格'],['缓入缓出','F9'],['全选关键帧','Ctrl+Alt+A'],['复制图层','Ctrl+D'],['预合成','Ctrl+Shift+C'],['撤销 / 重做','Ctrl+Z / Y'],['逐帧','← →'],['跳关键帧','J / K'],['帮助','?']].forEach(([a,b])=>h+='<div class="info-line"><span>'+a+'</span><b>'+b+'</b></div>');
    h+='<div class="info-sec">工程</div>';
    h+='<div class="pg-row"><span class="pg-label"></span><span class="pg-expr-btn" id="infoSave" style="width:auto;padding:3px 10px;background:#222732;border:1px solid #2c323d;border-radius:4px;color:#4fd1c5">保存工程</span><span class="pg-expr-btn" id="infoOpen" style="width:auto;padding:3px 10px;background:#222732;border:1px solid #2c323d;border-radius:4px;color:#7c8cff">打开工程</span></div>';
    container.innerHTML=h;
    const s=container.querySelector('#infoSave');if(s)s.onclick=()=>AE.UI.saveProject();
    const o=container.querySelector('#infoOpen');if(o)o.onclick=()=>AE.UI.openProject();
  },
  showToast(m){AE.toast&&AE.toast(m);}
};
function typeName(t){return ({shape:'形状图层',text:'文字图层',extrude:'三维实体',parametric:'参数实体',grid:'网格',field:'空间场',particles:'粒子',camera:'摄像机',light:'灯光',precomp:'预合成',null:'空对象',bg:'背景',tone:'音色',adjustment:'调整层'})[t]||t;}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
})(window.AE);
