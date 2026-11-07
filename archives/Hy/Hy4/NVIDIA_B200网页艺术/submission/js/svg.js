/* ============================================================
   svg.js — true vector overlay: eight chapters of animated
            structure / data / typography, aligned to the 3D
   ============================================================ */
(function () {
'use strict';
const A=window.APP,T=window.THREE,U=A.util;
const S=A.SVG={};
const NS='http://www.w3.org/2000/svg';
const C={green:'#8bd44e',cyan:'#54d3e8',amber:'#e8a83d',violet:'#a98bff',
         txt:'#e9eef3',dim:'#8a97a5',faint:'#46525e',line:'rgba(150,178,198,.22)',
         coral:'#ff7a6b'};

function E(tag,attrs,parent){
  const e=document.createElementNS(NS,tag);
  if(attrs)for(const k in attrs)e.setAttribute(k,attrs[k]);
  if(parent)parent.appendChild(e);
  return e;
}
function AT(e,o){for(const k in o)e.setAttribute(k,o[k]);return e;}
function TX(parent,x,y,s,cls,extra){
  const e=E('text',Object.assign({x,y,class:cls||'svg-mono'},extra||{}),parent);
  e.textContent=s;return e;
}
function ln(parent,x1,y1,x2,y2,cls,extra){
  return E('line',Object.assign({x1,y1,x2,y2,class:cls||'hair'},extra||{}),parent);
}
function poly(parent,pts,cls,extra){
  return E('polygon',Object.assign({points:pts.map(p=>p.x+','+p.y).join(' '),class:cls||'thin'},extra||{}),parent);
}
function V(x,y,z){return new T.Vector3(x,y,z);}
function proj(v){return U.project(v);}
function partWorld(name){
  const pt=A.World.PARTS.find(q=>q.name===name);
  if(!pt)return V(0,0,0);
  const v=new T.Vector3();pt.obj.getWorldPosition(v);return v;
}
function bilerp(c,u,v){
  const top={x:U.lerp(c[0].x,c[1].x,u),y:U.lerp(c[0].y,c[1].y,u)};
  const bot={x:U.lerp(c[3].x,c[2].x,u),y:U.lerp(c[3].y,c[2].y,u)};
  return {x:U.lerp(top.x,bot.x,v),y:U.lerp(top.y,bot.y,v)};
}

S.init=()=>{
  const svg=document.getElementById('overlay');
  svg.setAttribute('viewBox',`0 0 ${A.W} ${A.H}`);
  svg.innerHTML='';
  S.svg=svg;S.ch=[];
  const W=A.W,H=A.H;

  /* ---------------- persistent frame ---------------- */
  const pg=E('g',{id:'persist'},svg);
  const pad=18;
  const corner=(x,y,sx,sy)=>{
    E('path',{d:`M ${x} ${y+sy*18} L ${x} ${y} L ${x+sx*18} ${y}`,
      fill:'none',stroke:C.green,'stroke-width':1,opacity:.5},pg);
  };
  corner(pad,pad+2,1,1);corner(W-pad,pad+2,-1,1);
  corner(pad,H-pad-2,1,-1);corner(W-pad,H-pad-2,-1,-1);
  ln(pg,0,84,W,84,'hair',{opacity:.18});
  ln(pg,0,H-64,W,H-64,'hair',{opacity:.18});
  // right ruler
  const rx=W-30,ry0=130,ry1=H-100;
  ln(pg,rx,ry0,rx,ry1,'hair',{opacity:.4});
  const rulerTicks=[],rulerLabels=[];
  A.chapters.forEach((c,i)=>{
    const y=U.lerp(ry0,ry1,(c.start+c.end)/2);
    ln(pg,rx-5,y,rx+5,y,'hair',{opacity:.5});
    const t=TX(pg,rx-12,y+3,c.id,'svg-mono',{fill:C.faint,'font-size':8,'text-anchor':'end'});
    rulerLabels.push(t);rulerTicks.push({y,i});
  });
  const rulerDot=E('circle',{cx:rx,cy:ry0,r:3.5,fill:C.green},pg);
  const rulerGlow=E('circle',{cx:rx,cy:ry0,r:9,fill:'none',stroke:C.green,'stroke-width':1,opacity:.35},pg);
  TX(pg,rx,ry0-18,'PROGRESS','svg-mono',{fill:C.faint,'font-size':7,'text-anchor':'end','letter-spacing':2});

  // identity glyph (the same B200, tracked across the whole page)
  const ig=E('g',{opacity:.55},pg);
  const igx=W*.5-52, igy=95;
  TX(ig,igx,igy-6,'SAME OBJECT / 同一颗 B200','svg-mono',{fill:C.faint,'font-size':7,'letter-spacing':1.5});
  const igRects=[];
  for(let i=0;i<2;i++)igRects.push(E('rect',{x:igx+i*30,y:igy,w:24,h:24,fill:'none',stroke:C.green,'stroke-width':1},ig));
  const igHbm=[];
  for(let i=0;i<8;i++)igHbm.push(E('rect',{x:igx-10+(i%2)*72,y:igy+(i>>1)*6,w:6,h:4,fill:C.cyan,opacity:.75},ig));
  const igFrame=E('rect',{x:igx-14,y:igy-5,w:104,h:34,fill:'none',stroke:C.faint,'stroke-width':1},ig);
  const igLabel=TX(ig,igx,igy+42,'PACKAGE','svg-mono',{fill:C.dim,'font-size':7});

  S.persist={up:(p,t,st,dd)=>{
    const y=U.lerp(ry0,ry1,p);
    AT(rulerDot,{cy:y});AT(rulerGlow,{cy:y});
    const ci=dd.ci;
    const shapes=['PACKAGE','TWO DIES','FLOORPLAN','DATA BLOCK','BIT CELL','GPU NODE','PRODUCT','PACKAGE'];
    igLabel.textContent=shapes[ci];
    // morph the identity glyph per chapter
    const mode=ci;
    igRects.forEach((r,i)=>{
      const merge=mode>=2?1:0;
      AT(r,{x:igx+i*30+(i===0?merge*8:-merge*8),
            y:igy+(mode===4?6:0),
            width:mode===4?18:24,height:mode===4?18:24,
            stroke:mode===5?C.violet:(mode===4?C.amber:C.green)});
    });
    igHbm.forEach((r,i)=>AT(r,{opacity:(mode===3||mode===6)?1:.35,
       fill:mode===4?C.amber:C.cyan}));
    AT(igFrame,{stroke:mode===7?C.green:C.faint});
  }};

  /* ================================================================
     CHAPTER 01 — scale information & transistor-cell regrouping
     ================================================================ */
  {
    const g=E('g',{'data-ch':0},svg);
    const cells=[],cellInfo=[];
    for(let i=0;i<160;i++){
      const r=E('rect',{width:3,height:3,fill:C.green,opacity:0},g);
      cells.push(r);
      cellInfo.push({h1:U.hash(i),h2:U.hash(i+41),h3:U.hash(i+91),col:i%10,row:(i/10)|0});
    }
    const dieA=E('rect',{fill:'none',stroke:C.green,'stroke-width':1.2,opacity:0},g);
    const dieB=E('rect',{fill:'none',stroke:C.green,'stroke-width':1.2,opacity:0},g);
    const bridge=ln(g,0,0,0,0,'hair',{stroke:C.green,'stroke-dasharray':'4 4',opacity:0});
    E('text',{id:'c1merge'},g);
    const mergeTx=TX(g,0,0,'2 DIES  ·  1 GPU','svg-disp',{fill:C.txt,'font-size':22,'text-anchor':'middle','letter-spacing':3,opacity:0});
    const segBar=[];
    for(let i=0;i<40;i++)segBar.push(E('rect',{width:5,height:8,fill:C.green,opacity:.12},g));
    const barLabel=TX(g,0,0,'208 × 10⁹  TRANSISTORS  /  4NP','svg-mono',{fill:C.dim,'font-size':8,'letter-spacing':1.5,opacity:0});
    // leaders from 3D parts
    const defs=[['substrate','SUBSTRATE 基板',C.green],['dies','DIE A / B',C.amber],
                ['hbm','HBM3e × 8',C.cyan],['solder','BGA 焊球',C.dim]];
    const leaders=defs.map(d=>{
      const line=E('polyline',{fill:'none',stroke:d[2],'stroke-width':1,opacity:.7},g);
      const dot=E('circle',{r:3,fill:d[2]},g);
      const tx=TX(g,0,0,d[1],'svg-mono',{fill:d[2],'font-size':9,'letter-spacing':1});
      const box=E('rect',{fill:'rgba(6,9,13,.7)',stroke:d[2],'stroke-width':.6,opacity:.7},g);
      return {line,dot,tx,box,def:d};
    });
    S.ch.push({g,up:(p,t,st,dd)=>{
      const L=dd.locals[0],s=U.sstep(.03,.88,L);
      const bx=W*.50,bw=W*.40;
      cells.forEach((r,i)=>{
        const q=cellInfo[i];
        const sc={x:bx+q.h1*bw,y:H*.16+q.h2*H*.68};
        const die=q.h3>.5?0:1;
        const cx=(die===0?W*.585:W*.775),cy=H*.46;
        const cl={x:cx+(q.col-4.5)*11,y:cy+(q.row-7.5)*15};
        AT(r,{x:U.lerp(sc.x,cl.x,s),y:U.lerp(sc.y,cl.y,s),
              opacity:(.30+.62*s)*(.62+.38*Math.sin(t*1.2+q.h1*9)),
              fill:die===0?C.green:C.amber,width:2+2*s,height:2+2*s});
      });
      const dw=W*.115,dh=H*.27;
      [[dieA,W*.585],[dieB,W*.775]].forEach(([r,cx])=>AT(r,{x:cx-dw/2,y:H*.46-dh/2,width:dw,height:dh,opacity:.14+.72*s}));
      AT(bridge,{x1:W*.585+dw/2,y1:H*.46,x2:W*.775-dw/2,y2:H*.46,opacity:.12+.62*s});
      AT(mergeTx,{x:W*.68,y:H*.79,opacity:.28+.68*s});
      segBar.forEach((r,i)=>AT(r,{x:bx+i*(bw/40),y:H*.855,
        opacity:.20+.72*U.sstep(i/40,(i+1)/40,s),height:6+4*U.sstep(0,1,s)}));
      AT(barLabel,{x:bx,y:H*.835,opacity:.4+.55*s});
      leaders.forEach((o,k)=>{
        const wp=partWorld(o.def[0]);const q=proj(wp);
        const lx=q.x+(k%2?120:-190),ly=q.y+(k<2?-70:70);
        const vis=q.visible?1:.0;
        AT(o.line,{points:`${q.x},${q.y} ${(q.x+lx)/2},${q.y} ${lx},${ly}`,opacity:.65*vis});
        AT(o.dot,{cx:q.x,cy:q.y,opacity:vis});
        const tw=o.def[1].length*6.2+14;
        AT(o.tx,{x:lx+8,y:ly+3,opacity:.9*vis});
        AT(o.box,{x:lx,y:ly-11,width:tw,height:18,opacity:.55*vis});
      });
    }});
  }

  /* ================================================================
     CHAPTER 02 — layered line-art, growing leaders, 2D section
     ================================================================ */
  {
    const g=E('g',{'data-ch':1},svg);
    const layerDefs=[
      {n:'LID 加固盖框',part:'lid',col:C.dim},
      {n:'NV-HBI 片间互连',part:'bridge',col:C.green},
      {n:'DIE A / B 计算晶粒',part:'dies',col:C.amber},
      {n:'HBM3e × 8 堆栈',part:'hbm',col:C.cyan},
      {n:'μBUMP 微凸点',part:'bumps',col:C.amber},
      {n:'INTERPOSER 中介层',part:'interposer',col:C.green},
      {n:'SUBSTRATE 基板',part:'substrate',col:C.green},
      {n:'BGA 焊球',part:'solder',col:C.dim}
    ];
    const SX=W*.605,SW=W*.32,CY=H*.46;
    const slabs=layerDefs.map((d,i)=>{
      const rect=E('rect',{fill:'rgba(10,16,22,.55)',stroke:d.col,'stroke-width':1,opacity:.85},g);
      const hline=E('line',{stroke:d.col,'stroke-width':1,opacity:.35},g);
      const tx=TX(g,0,0,d.n,'svg-mono',{fill:d.col,'font-size':8.5,'letter-spacing':.6});
      const idx=TX(g,0,0,'L'+String(8-i).padStart(2,'0'),'svg-mono',{fill:C.faint,'font-size':7});
      const leader=E('polyline',{fill:'none',stroke:d.col,'stroke-width':.9,opacity:.5},g);
      const anchor=E('circle',{r:2.5,fill:d.col},g);
      return {rect,hline,tx,idx,leader,anchor,d,i};
    });
    // 2D section: solid hatched cap left of moving cut line
    const secTitle=TX(g,SX,H*.13,'2D SECTION / 剖面 · 与三维剖切同步','svg-mono',{fill:C.dim,'font-size':8,'letter-spacing':1.2});
    const secBg=E('rect',{x:SX-6,y:H*.17,width:SW+12,height:H*.66,fill:'none',stroke:C.line,'stroke-width':1},g);
    const hatch=E('g',{},g);
    const hatchLines=[];
    for(let i=0;i<44;i++)hatchLines.push(E('line',{stroke:C.amber,'stroke-width':.8,opacity:.22},hatch));
    const cutLine=ln(g,0,0,0,0,'hair',{stroke:C.coral,'stroke-width':1.4,'stroke-dasharray':'6 4'});
    const cutTag=TX(g,0,0,'SECTION','svg-mono',{fill:C.coral,'font-size':8});
    const secClip=E('clipPath',{id:'secClip'},g);
    const secClipRect=E('rect',{x:SX,y:H*.17,width:0,height:H*.66},secClip);
    S.ch.push({g,up:(p,t,st,dd)=>{
      const ex=dd.explode,L=dd.locals[1],on=dd.sectionOn;
      const gap=.30+ex*1.05;
      slabs.forEach((o,i)=>{
        const y=CY+(i-3.5)*H*.055*gap-H*.055*3.5*(gap-.3)*.0;
        const yy=CY+(i-3.5)*H*.052*gap;
        AT(o.rect,{x:SX,y:yy-9,width:SW,height:18});
        AT(o.hline,{x1:SX,y1:yy,x2:SX+SW,y2:yy});
        AT(o.tx,{x:SX+8,y:yy-13});
        AT(o.idx,{x:SX+SW-24,y:yy+4});
        // highlight selected part
        const sel=st.selectedPart===o.d.part;
        AT(o.rect,{stroke:sel?C.txt:o.d.col,'stroke-width':sel?1.8:1,
                   fill:sel?'rgba(139,212,78,.12)':'rgba(10,16,22,.55)'});
        // leader to projected 3D part center
        const wp=partWorld(o.d.part),q=proj(wp);
        const vis=q.visible?1:0;
        const grow=U.sstep(0,.6,ex);
        const mx=U.lerp(SX,q.x,grow);
        AT(o.leader,{points:`${SX},${yy} ${mx},${q.y} ${q.x},${q.y}`,opacity:.5*vis*grow});
        AT(o.anchor,{cx:q.x,cy:q.y,opacity:vis*grow});
      });
      const cx=SX+st.section*SW;
      AT(secClipRect,{width:Math.max(0,cx-SX)});
      hatchLines.forEach((l,i)=>{
        const yy=H*.17+i*(H*.66/44);
        AT(l,{x1:SX,y1:yy,x2:SX+SW*.45,y2:yy+H*.02});
      });
      AT(hatch,{'clip-path':'url(#secClip)'});
      AT(cutLine,{x1:cx,y1:H*.17,x2:cx,y2:H*.83,opacity:on});
      AT(cutTag,{x:cx+6,y:H*.155,opacity:on});
      AT(secTitle,{opacity:.5+on*.5});
    }});
  }

  /* ================================================================
     CHAPTER 03 — 3D→2D floorplan conversion, activation, seam
     ================================================================ */
  {
    const g=E('g',{'data-ch':2},svg);
    const dies=[A.World.G.dieA,A.World.G.dieB];
    const plans=dies.map(()=>{
      const outline=E('polygon',{fill:'rgba(20,30,40,.35)',stroke:C.green,'stroke-width':1.4},g);
      const grid=[];
      for(let r=0;r<8;r++){const row=[];for(let c=0;c<6;c++)
        row.push(E('rect',{fill:C.green,opacity:0},g));grid.push(row);}
      const label=TX(g,0,0,'','svg-mono',{fill:C.dim,'font-size':9});
      return {outline,grid,label};
    });
    const seamLine=ln(g,0,0,0,0,'hair',{stroke:C.green,'stroke-width':2,'stroke-dasharray':'7 5'});
    const seamLabel=TX(g,0,0,'10 TB/s  NV-HBI','svg-mono',{fill:C.green,'font-size':10,'letter-spacing':1.5});
    const brokenTx=TX(g,0,0,'LINK BROKEN','svg-mono',{fill:C.coral,'font-size':9,opacity:0});
    const pulses=[];
    for(let i=0;i<22;i++)pulses.push(E('circle',{r:3,fill:C.green},g));
    const thumbTitle=TX(g,0,0,'ACTIVATION MAP / 二维激活缩略图','svg-mono',{fill:C.dim,'font-size':8,'letter-spacing':1});
    const thumb=[];
    const TX0=26,TY0=H*.30,TW=150,TH=150;
    for(let r=0;r<4;r++){const row=[];for(let c=0;c<4;c++){
      row.push(E('rect',{x:TX0+c*(TW/4),y:TY0+r*(TH/4),width:TW/4-2,height:TH/4-2,
        fill:C.dim,opacity:.2,stroke:C.line,'stroke-width':.5,'data-hit':1,cursor:'pointer'},g));
    }thumb.push(row);}
    const thumbLabels=['SM / TC','L2','HBM PHY','NVLink'].map((s,i)=>
      TX(g,TX0+TW+8,TY0+i*(TH/4)+TH/8+3,s,'svg-mono',{fill:C.dim,'font-size':8}));
    S.ch.push({g,up:(p,t,st,dd)=>{
      const flat=dd.flatten,L=dd.locals[2],seam=dd.seam;
      const t3=Math.max(0,t-st.replay3);
      dies.forEach((d,di)=>{
        const DW=3.25,DD=5.3,top=.12;
        const corners=[[-DW/2,top,-DD/2],[DW/2,top,-DD/2],[DW/2,top,DD/2],[-DW/2,top,DD/2]]
          .map(c=>proj(d.g.localToWorld(V(c[0],c[1],c[2]))));
        AT(plans[di].outline,{points:corners.map(c=>c.x+','+c.y).join(' '),
          opacity:.25+.55*flat,stroke:di===0?C.green:C.amber});
        for(let r=0;r<8;r++)for(let c=0;c<6;c++){
          const a=bilerp(corners,c/6,r/8),b=bilerp(corners,(c+1)/6,(r+1)/8);
          const region=(c<3&&r<4)?0:((r>=4)?1:((c>=4)?2:3));
          const active=(region===st.region)||((Math.sin(t*2+r*.6+c*.4)>0.2)&&flat>.2);
          const q=plans[di].grid[r][c];
          AT(q,{x:Math.min(a.x,b.x)+1,y:Math.min(a.y,b.y)+1,
                width:Math.max(.5,Math.abs(b.x-a.x)-2),
                height:Math.max(.5,Math.abs(b.y-a.y)-2),
                opacity:(active?.15+.5*flat:.05)*(.6+.4*Math.sin(t*1.5+r+c)),
                fill:active?A.Director.regions[region].color:C.dim});
        }
        const ctr=bilerp(corners,.5,.5);
        AT(plans[di].label,{x:ctr.x,y:ctr.y-2,'text-anchor':'middle',
          opacity:flat*.9});
        plans[di].label.textContent=di===0?'DIE A':'DIE B';
      });
      // seam line at the gap between the two projected inner die edges
      const ca=proj(dies[0].g.localToWorld(V(3.25/2,.12,0)));
      const cb=proj(dies[1].g.localToWorld(V(-3.25/2,.12,0)));
      const mx=(ca.x+cb.x)/2,my=(ca.y+cb.y)/2;
      AT(seamLine,{x1:mx,y1:my-H*.20,x2:mx,y2:my+H*.20,
        opacity:.85,'stroke-dashoffset':-t3*40,stroke:seam>.25?C.coral:C.green});
      AT(seamLabel,{x:mx,y:H*.17,'text-anchor':'middle'});
      AT(brokenTx,{x:mx,y:H*.215,'text-anchor':'middle',opacity:U.sstep(.25,.5,seam)});
      pulses.forEach((o,i)=>{
        let u=(i/22+t3*.35)%1;
        const broken=seam>.25;
        if(broken)u=Math.min(u,.46);
        const q={x:U.lerp(ca.x,cb.x,u),y:my-Math.sin(u*Math.PI)*34};
        AT(o,{cx:q.x,cy:q.y,opacity:broken&&u>=.46?0:(.35+.65*Math.sin(u*Math.PI))*(1-seam*.3),
          fill:seam>.25?C.coral:C.green,r:2.5+1.5*Math.sin(u*Math.PI)});
      });
      AT(thumbTitle,{x:TX0,y:TY0-12});
      for(let r=0;r<4;r++)for(let c=0;c<4;c++){
        const idx=r*4+c,on=idx===st.region;
        AT(thumb[r][c],{opacity:on?.75:.12+.25*Math.sin(t*1.5+idx),
          fill:on?A.Director.regions[(idx%4)].color:C.dim,stroke:on?C.txt:C.line});
      }
      thumbLabels.forEach((l,i)=>AT(l,{opacity:i===st.region?1:.45,fill:i===st.region?C.green:C.dim}));
    }});
    // click hit on thumbnail
    thumb.forEach((row,r)=>row.forEach((cell,c)=>cell.addEventListener('click',()=>{
      A.set({region:r*4+c});
    })));
  }

  /* ================================================================
     CHAPTER 04 — horizontal: HBM side view, 8 streams, lens, glyph
     ================================================================ */
  {
    const g=E('g',{'data-ch':3},svg);
    const scroll=E('g',{},g);
    const CX=W*.5,CY=H*.48;
    // die block in the middle
    const dieBlock=E('rect',{x:CX-90,y:CY-95,width:180,height:190,
      fill:'rgba(20,32,42,.5)',stroke:C.amber,'stroke-width':1.4},scroll);
    const dieLabel=TX(scroll,CX,CY-104,'TWO DIES · 10 TB/s','svg-mono',{fill:C.amber,'font-size':9,'text-anchor':'middle'});
    const seamV=ln(scroll,CX,CY-95,CX,CY+95,'hair',{stroke:C.green,'stroke-width':1.5,'stroke-dasharray':'5 4'});
    // 8 HBM stacks (4 left, 4 right) as layered side views
    const stacks=[];
    for(let s=0;s<8;s++){
      const side=s<4?-1:1,idx=s%4;
      const x=CX+side*(230+idx*0)+side*((idx-1.5)*118);
      const y=CY-70;
      const grp=E('g',{},scroll);
      const base=E('rect',{x:x-34,y:y+72,width:68,height:12,fill:'rgba(20,32,44,.8)',stroke:C.cyan,'stroke-width':1},grp);
      const layers=[],tsvs=[];
      for(let i=0;i<8;i++)layers.push(E('rect',{x:x-34,y:0,width:68,height:7,
        fill:i%2?'rgba(84,211,232,.16)':'rgba(84,211,232,.3)',stroke:C.cyan,'stroke-width':.6},grp));
      for(let k=0;k<5;k++)tsvs.push(E('line',{stroke:C.amber,'stroke-width':1,opacity:.6},grp));
      const cap=TX(grp,x,y-16,'HBM '+s,'svg-mono',{fill:C.cyan,'font-size':8,'text-anchor':'middle'});
      stacks.push({x,y,layers,tsvs,base,grp,side,idx});
    }
    // 8 flowing data paths
    const streams=[],resultPaths=[];
    for(let s=0;s<8;s++){
      const st=stacks[s];
      const x1=st.x,y1=st.y+35,x2=CX,y2=CY;
      const d=`M ${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}`;
      streams.push(E('path',{d,fill:'none',stroke:C.cyan,'stroke-width':1.6,opacity:.7,
        'stroke-dasharray':'6 10'},scroll));
    }
    for(let s=0;s<4;s++){
      const y=CY-60+s*40;
      resultPaths.push(E('path',{d:`M ${CX} ${CY} C ${CX+90} ${CY}, ${CX+150} ${y}, ${CX+320} ${y}`,
        fill:'none',stroke:C.amber,'stroke-width':1.4,opacity:.6,'stroke-dasharray':'5 9'},scroll));
    }
    // data-driven glyph deformation
    const glyph=[];
    const gtxt='DATA';
    for(let i=0;i<gtxt.length;i++)glyph.push(TX(scroll,0,0,gtxt[i],'svg-disp',{fill:C.cyan,'font-size':54,'text-anchor':'middle'}));
    const densityTx=TX(scroll,0,0,'BITS / VALUE','svg-mono',{fill:C.dim,'font-size':8,'text-anchor':'middle'});
    // lens
    const lens=E('g',{},g);
    const lensClip=E('clipPath',{id:'lensClip'},lens);
    const lensCircle=E('circle',{cx:0,cy:0,r:78},lensClip);
    const lensUse=E('use',{href:'#ch4Side','clip-path':'url(#lensClip)'},lens);
    const lensRing=E('circle',{cx:0,cy:0,r:78,fill:'none',stroke:C.cyan,'stroke-width':1.6},lens);
    const lensRing2=E('circle',{cx:0,cy:0,r:84,fill:'none',stroke:C.cyan,'stroke-width':.7,opacity:.4},lens);
    const lensCross=E('path',{d:'',stroke:C.cyan,'stroke-width':.7,opacity:.6,fill:'none'},lens);
    const lensLabel=TX(lens,0,0,'× 2.3','svg-mono',{fill:C.cyan,'font-size':8,'text-anchor':'middle'});
    AT(scroll,{id:'ch4Side'});
    // horizontal ruler
    const hr=ln(g,W*.08,H*.90,W*.92,H*.90,'hair',{stroke:C.cyan,opacity:.5});
    const hrFill=ln(g,W*.08,H*.90,W*.08,H*.90,'hair',{stroke:C.cyan,'stroke-width':2});
    const hrTag=TX(g,0,H*.885,'HBM','svg-mono',{fill:C.dim,'font-size':8});
    const hrTag2=TX(g,W*.92,H*.885,'HBM','svg-mono',{fill:C.dim,'font-size':8,'text-anchor':'end'});
    const hrMid=TX(g,W*.5,H*.885,'DIES','svg-mono',{fill:C.dim,'font-size':8,'text-anchor':'middle'});

    S.ch.push({g,up:(p,t,st,dd)=>{
      const L=dd.locals[3],ex=dd.hbmSpread;
      const t4=Math.max(0,t-st.replay4);
      const tx=(.5-L)*W*1.05;
      AT(scroll,{transform:`translate(${tx},0)`});
      const fmt=A.FORMATS[st.precision];
      stacks.forEach((o,s)=>{
        o.layers.forEach((layer,i)=>{
          AT(layer,{y:o.y+66-i*(8+ex*5),height:6+ex*1.5,
            fill:i%2?'rgba(84,211,232,.16)':'rgba(84,211,232,.32)'});
        });
        o.tsvs.forEach((l,k)=>{
          const xx=o.x-26+k*13;
          AT(l,{x1:xx,y1:o.y+70,x2:xx,y2:o.y+66-7*(8+ex*5)});
        });
        AT(o.base,{y:o.y+72});
        AT(o.grp,{opacity:.55+.45*Math.sin(t*1.1+s*.7)*.3+.3});
      });
      // streams: dashes travel; bitwidth changes dash density & batch count
      const batches=Math.max(1,Math.round(16/fmt.bits));
      streams.forEach((path,i)=>AT(path,{'stroke-dashoffset':-t4*55*(1+i*.05),
        'stroke-dasharray':`${4+batches} ${12-Math.min(8,batches)}`,
        opacity:.45+.45*Math.sin(t*1.6+i*.5)}));
      resultPaths.forEach((path,i)=>AT(path,{'stroke-dashoffset':-t4*45-i*8,
        opacity:.35+.4*Math.sin(t*1.4+i)}));
      AT(dieBlock,{stroke:dd.seam>.2?C.coral:C.amber});
      // glyph deformation: per-character transforms driven by data density
      const density=fmt.bits/64;
      glyph.forEach((ch,i)=>{
        const bx=CX+(i-(gtxt.length-1)/2)*46,by=CY+150;
        const wob=Math.sin(t*1.8+i*.9)*6*density;
        AT(ch,{x:bx,y:by+wob,
          transform:`translate(${bx} ${by+wob}) scale(${1-density*.18} ${1+density*.35}) rotate(${wob*.8}) translate(${-bx} ${-(by+wob)})`,
          opacity:.35+.5*density,fill:i%2?C.cyan:C.green});
      });
      AT(densityTx,{x:CX,y:CY+180});
      densityTx.textContent=st.precision+'  ·  '+fmt.bits+' bit / value  ·  '+batches+' batches';
      // lens (pointer-driven observation window, real magnification)
      const lx=st.lens.x*W,ly=st.lens.y*H;
      AT(lensCircle,{cx:lx,cy:ly});AT(lensRing,{cx:lx,cy:ly});AT(lensRing2,{cx:lx,cy:ly});
      AT(lensUse,{transform:`translate(${(lx)*(1-2.3)+tx*.0} ${ly*(1-2.3)}) scale(2.3)`,opacity:dd.w[3]});
      AT(lensCross,{d:`M ${lx-14} ${ly} L ${lx+14} ${ly} M ${lx} ${ly-14} L ${lx} ${ly+14}`});
      AT(lensLabel,{x:lx,y:ly-92});
      // horizontal progress
      const hx=U.lerp(W*.08,W*.92,L);
      AT(hrFill,{x2:hx});
      AT(hrTag,{opacity:.8});AT(hrTag2,{opacity:.8});AT(hrMid,{opacity:.8});
      // position the lens tag in DOM
      A.UI.lensTag(lx,ly,dd.w[3]);
    }});
  }

  /* ================================================================
     CHAPTER 05 — bit cells, number line, accumulation, zoom-out
     ================================================================ */
  {
    const g=E('g',{'data-ch':4},svg);
    // instrument plate behind the number line / accumulation so it reads over the 3D
    E('rect',{x:W*.55,y:H*.375,width:W*.425,height:H*.44,
      fill:'rgba(6,10,15,.60)',stroke:C.line,'stroke-width':1},g);
    TX(g,W*.558,H*.395,'SIGN → QUANTIZE → MAC → SCALE','svg-mono',
      {fill:C.faint,'font-size':7,'letter-spacing':1.2});
    const BX=W*.57,BW=W*.375,BY=H*.14;
    const titleWalk=TX(g,BX,BY-14,'格式讲解 / 随滚动 · 不改动全页精度','svg-mono',{fill:C.dim,'font-size':8,'letter-spacing':1});
    const titleGlobal=TX(g,BX,BY+92,'全页精度 / 用户选定 · GLOBAL','svg-mono',{fill:C.green,'font-size':8,'letter-spacing':1});
    function bitRow(y){
      const cells=[],labels=[];
      for(let i=0;i<64;i++)cells.push(E('rect',{width:6,height:20,fill:C.cyan,opacity:.2},g));
      const sL=TX(g,0,0,'S','svg-mono',{fill:C.amber,'font-size':9,'text-anchor':'middle'});
      const eL=TX(g,0,0,'EXPONENT 指数','svg-mono',{fill:C.cyan,'font-size':8,'text-anchor':'middle'});
      const mL=TX(g,0,0,'MANTISSA 尾数','svg-mono',{fill:C.green,'font-size':8,'text-anchor':'middle'});
      const nL=TX(g,0,0,'','svg-mono',{fill:C.txt,'font-size':11});
      return {cells,sL,eL,mL,nL,y};
    }
    const rowWalk=bitRow(BY),rowGlobal=bitRow(BY+106);
    function updRow(row,f,alpha){
      const total=f.bits,step=BW/total;
      let n=0;
      const push=(cnt,col)=>{
        for(let k=0;k<cnt&&n<64;k++){
          const c=row.cells[n];
          AT(c,{x:BX+n*step,y:row.y,width:Math.max(2,step-1.4),height:20,
            fill:col,opacity:alpha*(.55+.45*Math.sin(n*.7+A.T*1.2))});n++;
        }
        return n;
      };
      const sEnd=push(f.s,C.amber);
      const eEnd=push(f.e,C.cyan);
      const mEnd=push(f.m,C.green);
      for(let i=n;i<64;i++)AT(row.cells[i],{opacity:0});
      AT(row.sL,{x:BX+sEnd*step/2,y:row.y+34,opacity:alpha});
      AT(row.eL,{x:BX+(sEnd+eEnd/2)*step,y:row.y+34,opacity:alpha});
      AT(row.mL,{x:BX+(eEnd+(mEnd-eEnd)/2)*step,y:row.y+34,opacity:alpha});
      AT(row.nL,{x:BX+BW+14,y:row.y+15,opacity:alpha});
      row.nL.textContent=f.key+' · '+f.bits+'b';
    }
    // interpolated walkthrough format (continuous cell rearrangement)
    function interpFmt(x){
      const i=U.clamp(Math.floor(x),0,5),j=U.clamp(i+1,0,5),k=U.smooth(x-i);
      const a=A.FORMATS[A.FORMAT_ORDER[i]],b=A.FORMATS[A.FORMAT_ORDER[j]];
      return {key:k<.5?a.key:b.key,bits:Math.round(U.lerp(a.bits,b.bits,k)),
        s:Math.round(U.lerp(a.s,b.s,k)),e:Math.round(U.lerp(a.e,b.e,k)),
        m:Math.round(U.lerp(a.m,b.m,k))};
    }
    // number line
    const NLX=BX,NLY=H*.43,NLW=BW;
    const nlTitle=TX(g,NLX,NLY-24,'NUMBER LINE / 可表示值 · 舍入与误差','svg-mono',{fill:C.dim,'font-size':8});
    const nlAxis=ln(g,NLX,NLY,NLX+NLW,NLY,'hair',{stroke:C.line});
    const ticks=[];
    for(let i=0;i<60;i++)ticks.push(E('line',{stroke:C.cyan,'stroke-width':1,opacity:.3},g));
    const orig=E('circle',{r:5,fill:'none',stroke:C.txt,'stroke-width':1.5},g);
    const quant=E('circle',{r:5,fill:C.amber},g);
    const errLine=ln(g,0,0,0,0,'hair',{stroke:C.coral,'stroke-width':1.4});
    const errTx=TX(g,0,0,'','svg-mono',{fill:C.coral,'font-size':9});
    const oTx=TX(g,0,0,'原值','svg-mono',{fill:C.dim,'font-size':8,'text-anchor':'middle'});
    const qTx=TX(g,0,0,'量化值','svg-mono',{fill:C.amber,'font-size':8,'text-anchor':'middle'});
    // accumulation + zoom rings
    const accTitle=TX(g,W*.57,H*.53,'乘加累加 → 张量核心 → 晶粒 → GPU','svg-mono',{fill:C.dim,'font-size':8});
    const accCells=[];
    for(let r=0;r<4;r++){const row=[];for(let c=0;c<4;c++)
      row.push(E('rect',{width:26,height:26,fill:C.green,opacity:.15,stroke:C.line,'stroke-width':.5},g));
      accCells.push(row);}
    const accPath=E('path',{d:'',fill:'none',stroke:C.amber,'stroke-width':1.6,'stroke-dasharray':'4 4'},g);
    const rings=[];
    for(let i=0;i<4;i++)rings.push(E('rect',{fill:'none',stroke:C.violet,'stroke-width':1,opacity:0},g));
    const ringLabels=['TENSOR CORE','SM','DIE','GPU'].map((s,i)=>
      TX(g,0,0,s,'svg-mono',{fill:C.violet,'font-size':8}));
    S.ch.push({g,up:(p,t,st,dd)=>{
      const L=dd.locals[4];
      const wf=interpFmt(L*5);
      updRow(rowWalk,wf,.85);
      updRow(rowGlobal,A.FORMATS[st.precision],1);
      // number line ticks: FP4 has few values, wider formats many
      const f=A.FORMATS[st.precision];
      const count=st.precision==='FP4'?8:Math.min(60,6+Math.round(f.m*2.2));
      const val=2.37; // sample original value
      const qv=A.UI.quantize(val,st.precision);
      const map=(x)=>NLX+U.clamp((x+7)/14,0,1)*NLW;
      ticks.forEach((tk,i)=>{
        const on=i<count;
        const x=NLX+(i/(count-1))*NLW;
        AT(tk,{x1:x,y1:NLY-8,x2:x,y2:NLY+8,opacity:on?.55:0});
      });
      const qx=map(qv),ox=map(val);
      AT(orig,{cx:ox,cy:NLY});AT(quant,{cx:qx,cy:NLY});
      AT(errLine,{x1:ox,y1:NLY+14,x2:qx,y2:NLY+14,opacity:Math.abs(qx-ox)>1?1:0});
      AT(errTx,{x:(ox+qx)/2,y:NLY+30,opacity:1});
      errTx.textContent='误差 '+Math.abs(val-qv).toFixed(3)+'   →   '+qv.toFixed(3);
      AT(oTx,{x:ox,y:NLY-16});AT(qTx,{x:qx,y:NLY-16});
      // accumulation
      const AX=W*.575,AY=H*.565,CS=26;
      accCells.forEach((row,r)=>row.forEach((cell,c)=>{
        AT(cell,{x:AX+c*CS,y:AY+r*CS,
          opacity:.12+.5*Math.max(0,Math.sin(t*2-r*.5-c*.4)),
          fill:(r===1&&c===2)?C.amber:C.green});
      }));
      AT(accPath,{d:`M ${AX} ${AY+13} L ${AX+4*CS} ${AY+13} M ${AX+2*CS+13} ${AY} L ${AX+2*CS+13} ${AY+4*CS}`,
        'stroke-dashoffset':-t*30});
      // zoom out rings (bottom-right, compact)
      const z=U.sstep(.35,1,L),RCX=W*.84,RCY=H*.79,RS=17;
      rings.forEach((rg,i)=>{
        const s=(1+i*.4)*(1+z*.65),R=RS*s;
        AT(rg,{x:RCX-R,y:RCY-R,width:R*2,height:R*2,
          opacity:.12+.28*Math.sin(t*.8+i)*.4+.18*z,
          'stroke-dasharray':`${6+i*3} ${4+i}`});
        AT(ringLabels[i],{x:RCX-R,y:RCY+R+11,opacity:.35+z*.5,
          fill:i===3?C.green:C.violet});
      });
    }});
  }

  /* ================================================================
     CHAPTER 06 — topology growth, sharding, reduction
     ================================================================ */
  {
    const g=E('g',{'data-ch':5},svg);
    const TX0=W*.60,TY0=H*.15,GW=W*.34,GH=H*.44;
    const nodes=[],edges=[],nodeLabels=[];
    for(let i=0;i<8;i++){
      const c=i%4,r=(i/4)|0;
      const x=TX0+c*(GW/3),y=TY0+r*GH;
      nodes.push(E('rect',{x:x-20,y:y-15,width:40,height:30,fill:'rgba(12,18,26,.8)',
        stroke:C.violet,'stroke-width':1.2},g));
      nodeLabels.push(TX(g,x,y+4,'G'+i,'svg-mono',{fill:C.violet,'font-size':9,'text-anchor':'middle'}));
    }
    const swx=TX0+GW/2,swy=TY0+GH/2;
    const sw=E('rect',{x:swx-34,y:swy-18,width:68,height:36,fill:'rgba(20,16,34,.85)',
      stroke:C.violet,'stroke-width':1.4},g);
    const swTx=TX(g,swx,swy+4,'NVSWITCH','svg-mono',{fill:C.violet,'font-size':8,'text-anchor':'middle'});
    nodes.forEach((n,i)=>{
      const a={x:+(n.getAttribute('x'))+20,y:+(n.getAttribute('y'))+15};
      edges.push(E('path',{d:`M ${a.x} ${a.y} Q ${(a.x+swx)/2} ${(a.y+swy)/2-30} ${swx} ${swy}`,
        fill:'none',stroke:C.violet,'stroke-width':1.2,opacity:.5,'stroke-dasharray':'5 7'},g));
    });
    const topoTitle=TX(g,TX0,TY0-22,'NVLink TOPOLOGY / 八 GPU 全互联','svg-mono',{fill:C.dim,'font-size':8,'letter-spacing':1});
    const pulses=[];
    for(let i=0;i<24;i++)pulses.push(E('circle',{r:3,fill:C.violet},g));
    // sharding bars
    const SBX=W*.48,SBY=H*.68,SBW=W*.34;
    const bars=[],barLabels=[],barVals=[];
    for(let i=0;i<8;i++){
      bars.push(E('rect',{x:SBX+i*(SBW/8),y:SBY,width:SBW/8-6,height:8,fill:C.cyan,opacity:.3},g));
      barLabels.push(TX(g,SBX+i*(SBW/8)+SBW/16,SBY+26,'G'+i,'svg-mono',{fill:C.dim,'font-size':8,'text-anchor':'middle'}));
      barVals.push(TX(g,SBX+i*(SBW/8)+SBW/16,SBY-8,'','svg-mono',{fill:C.txt,'font-size':9,'text-anchor':'middle'}));
    }
    const shardTitle=TX(g,SBX,SBY-30,'SHARD 分片局部计算 → ALL-REDUCE 归约','svg-mono',{fill:C.dim,'font-size':8});
    const sumTx=TX(g,SBX+SBW/2,SBY+48,'','svg-disp',{fill:C.green,'font-size':18,'text-anchor':'middle'});
    // rack structure morph glyph
    const rkTitle=TX(g,W*.60,H*.80,'STRUCTURE / 板级 → 整机 → 机柜','svg-mono',{fill:C.dim,'font-size':8});
    const rkParts=[];
    for(let i=0;i<18;i++)rkParts.push(E('rect',{fill:C.violet,opacity:.2},g));
    S.ch.push({g,up:(p,t,st,dd)=>{
      const L=dd.locals[5],prod=dd.product,grow=U.sstep(.05,.75,L);
      edges.forEach((e,i)=>AT(e,{'stroke-dashoffset':-t*30,opacity:(.15+.5*grow)*(.6+.4*Math.sin(t+i)),
        'stroke-width':i===st.shardSel?2.2:1.2}));
      const task=A.UI.shardTask(st);
      nodes.forEach((n,i)=>{
        const sel=i===st.shardSel;
        AT(n,{stroke:sel?C.txt:(task.done?C.green:C.violet),
          'stroke-width':sel?2:1.2,
          fill:sel?'rgba(139,212,78,.16)':'rgba(12,18,26,.8)'});
        AT(nodeLabels[i],{fill:sel?C.txt:C.violet});
      });
      AT(sw,{stroke:task.done?C.green:C.violet});
      pulses.forEach((o,i)=>{
        const gi=i%8;
        const u=(i/24+t*.3)%1;
        const a={x:TX0+(gi%4)*(GW/3),y:TY0+((gi/4)|0)*GH};
        const x=U.lerp(a.x,swx,u),y=U.lerp(a.y,swy,u)-Math.sin(u*Math.PI)*26;
        AT(o,{cx:x,cy:y,opacity:task.active?(.3+.7*Math.sin(u*Math.PI)):.1,fill:task.done?C.green:C.violet});
      });
      bars.forEach((b,i)=>{
        const v=task.partials[i]||0;
        const h=U.clamp(Math.abs(v)*6,4,70);
        AT(b,{y:SBY-h,height:h,opacity:.35+.5*task.active,fill:i===st.shardSel?C.green:C.cyan});
        AT(barVals[i],{y:SBY-h-6});
        barVals[i].textContent=v.toFixed(1);
      });
      sumTx.textContent='∑ = '+task.total.toFixed(1)+'   → 每颗 GPU 得到一致结果';
      AT(sumTx,{opacity:.7+.3*task.done});
      // rack glyph: board (8 chips) -> server (chassis) -> rack (trays)
      const mode=prod; // 0..4
      rkParts.forEach((r,i)=>{
        let x,y,w,h;
        if(mode<=1){x=W*.60+(i%8)*(GW/8),y=H*.83+((i/8)|0)*10,w=GW/8-4,h=7;}
        else if(mode===2){x=W*.60,y=H*.82+i*4,w=GW,h=3;}
        else {x=W*.60+(i%3)*(GW/3),y=H*.82+((i/3)|0)*8,w=GW/3-4,h=6;}
        AT(r,{x,y,width:w,height:h,opacity:.2+.5*grow*(.6+.4*Math.sin(t+i))});
      });
      AT(topoTitle,{opacity:.9});AT(shardTitle,{opacity:.9});AT(rkTitle,{opacity:.9});
    }});
  }

  /* ================================================================
     CHAPTER 07 — product structure glyphs, metric feedback
     ================================================================ */
  {
    const g=E('g',{'data-ch':6},svg);
    const GX0=W*.18,GW=W*.66,GY=H*.17,GH=H*.16;
    const title=TX(g,W*.5,GY-16,'STRUCTURE / 五种产品 · 选择指标时对应部位反馈','svg-mono',
      {fill:C.dim,'font-size':8,'text-anchor':'middle','letter-spacing':1});
    const names=['B200','HGX B200','DGX B200','GB200','NVL72'];
    const glyphs=names.map((nm,i)=>{
      const cx=GX0+i*(GW/5)+GW/10;
      const grp=E('g',{},g);
      const frame=E('rect',{x:cx-52,y:GY,width:104,height:GH,
        fill:'rgba(10,14,20,.5)',stroke:C.line,'stroke-width':1},grp);
      const dies=[];
      const nd=(i===0)?2:(i===1||i===2)?8:(i===3)?2:4;
      for(let k=0;k<nd;k++)dies.push(E('rect',{fill:C.green,opacity:.55},grp));
      const mem=[];
      for(let k=0;k<(i===4?9:4);k++)mem.push(E('rect',{fill:C.cyan,opacity:.5},grp));
      const links=[];
      for(let k=0;k<4;k++)links.push(E('line',{stroke:C.violet,'stroke-width':1.5,opacity:.5},grp));
      const cap=TX(grp,cx,GY+GH+16,nm,'svg-mono',{fill:C.txt,'font-size':9,'text-anchor':'middle'});
      return {grp,frame,dies,mem,links,cap,cx,i};
    });
    const metricTx=TX(g,W*.5,GY+GH+42,'','svg-mono',{fill:C.amber,'font-size':9,'text-anchor':'middle'});
    S.ch.push({g,up:(p,t,st,dd)=>{
      const L=dd.locals[6],enter=U.sstep(0,.5,L);
      const metric=st.specMetric;
      const hi=(kind)=>{
        if(metric==='mem'||metric==='bw')return kind==='mem';
        if(metric==='nvlink'||metric==='interconnect')return kind==='link';
        if(metric==='fp4'||metric==='fp8'||metric==='fp16'||metric==='tf32'||metric==='fp64'||metric==='compute')return kind==='die';
        if(metric==='power')return kind==='frame';
        return kind==='die';
      };
      glyphs.forEach((o,i)=>{
        const yy=GY+(1-enter)*40;
        AT(o.frame,{y:yy,opacity:.4+.5*enter,stroke:hi('frame')?C.amber:C.line,'stroke-width':hi('frame')?2:1});
        o.dies.forEach((d,k)=>{
          const cols=i===0?2:Math.min(4,o.dies.length),c=k%cols,r=(k/cols)|0;
          AT(d,{x:o.cx-38+c*20,y:yy+12+r*22,width:16,height:16,
            opacity:(hi('die')?.9:.35)*(.7+.3*Math.sin(t*1.4+k+i)),
            fill:hi('die')?C.amber:C.green});
        });
        o.mem.forEach((m,k)=>AT(m,{x:o.cx-42+k*12,y:yy+GH-22,width:9,height:9,
          opacity:hi('mem')?.95:.35,fill:hi('mem')?C.cyan:C.green}));
        o.links.forEach((l,k)=>AT(l,{x1:o.cx-42,y1:yy+8+k*8,x2:o.cx+42,y2:yy+8+k*8,
          opacity:hi('link')?.9:.25,stroke:hi('link')?C.violet:C.line}));
        AT(o.cap,{y:yy+GH+16,opacity:enter});
        AT(o.grp,{opacity:enter});
      });
      metricTx.textContent='当前指标 HIGHLIGHT：'+A.UI.metricName(metric);
    }});
  }

  /* ================================================================
     CHAPTER 08 — tracking 3D annotations, workloads, convergence
     ================================================================ */
  {
    const g=E('g',{'data-ch':7},svg);
    const annDefs=[
      {n:'Transformer Engine',s:'2nd GEN · FP4 / FP8',part:'dies',off:[0,1.3,-1.2],nor:[0,1,0],col:C.green},
      {n:'片间互连 NV-HBI',s:'10 TB/s · 2 dies → 1 GPU',part:'bridge',off:[0,1.35,.4],nor:[0,1,0],col:C.green},
      {n:'解压缩引擎',s:'DECOMPRESSION ENGINE',part:'dies',off:[1.2,1.25,1.6],nor:[0,1,0],col:C.amber},
      {n:'HBM3e',s:'192 GB · 8 TB/s',part:'hbm',off:[-.8,1.4,-1.5],nor:[0,1,0],col:C.cyan},
      {n:'NVLink 5',s:'1.8 TB/s 双向 / GPU',part:'dies',off:[.2,1.25,2.5],nor:[0,1,0],col:C.violet},
      {n:'RAS 与机密计算',s:'RELIABILITY · CONFIDENTIAL',part:'substrate',off:[1.5,.35,-1.7],nor:[0,1,0],col:C.dim},
      {n:'功耗',s:'1000 W · SXM',part:'solder',off:[0,-.45,0],nor:[0,-1,0],col:C.coral}
    ];
    const anns=annDefs.map((d,i)=>{
      const line=E('polyline',{fill:'none',stroke:d.col,'stroke-width':1,opacity:.7},g);
      const dot=E('circle',{r:3,fill:d.col},g);
      const box=E('rect',{fill:'rgba(6,9,13,.82)',stroke:d.col,'stroke-width':.7},g);
      const tx=TX(g,0,0,d.n,'svg-cjk',{fill:d.col,'font-size':10});
      const sub=TX(g,0,0,d.s,'svg-mono',{fill:C.dim,'font-size':7.5});
      const num=TX(g,0,0,String(i+1).padStart(2,'0'),'svg-mono',{fill:d.col,'font-size':8});
      return {line,dot,box,tx,sub,num,d,i};
    });
    // three workload glyphs
    const WY=H*.84,WX=W*.5;
    const workTitle=TX(g,WX,WY-92,'WORKLOADS / 三类负载 · 数据运动与读数各异','svg-mono',
      {fill:C.dim,'font-size':8,'text-anchor':'middle'});
    const trainRings=[],inferPipes=[],hpcGrid=[];
    for(let i=0;i<5;i++)trainRings.push(E('circle',{fill:'none',stroke:C.green,'stroke-width':1.2,opacity:0},g));
    for(let i=0;i<6;i++)inferPipes.push(E('rect',{fill:C.cyan,opacity:0},g));
    for(let i=0;i<36;i++)hpcGrid.push(E('rect',{fill:C.violet,opacity:0},g));
    const workLabel=TX(g,WX,WY+34,'','svg-disp',{fill:C.green,'font-size':18,'text-anchor':'middle'});
    const workSub=TX(g,WX,WY+50,'','svg-mono',{fill:C.dim,'font-size':8,'text-anchor':'middle'});
    // ending convergence particles
    const conv=[];
    for(let i=0;i<48;i++)conv.push(E('rect',{width:3,height:3,fill:C.green,opacity:0},g));
    const convOutline=E('rect',{fill:'none',stroke:C.green,'stroke-width':1.4,opacity:0},g);
    const convTx=TX(g,WX,H*.5,'','svg-disp',{fill:C.green,'font-size':30,'text-anchor':'middle',opacity:0,'letter-spacing':4});
    S.ch.push({g,up:(p,t,st,dd)=>{
      const L=dd.locals[7];
      anns.forEach((o,i)=>{
        const wp=partWorld(o.d.part).add(V(o.d.off[0],o.d.off[1],o.d.off[2]));
        const q=proj(wp);
        // occlusion: dot(normal, camera-anchor) < 0 -> back facing
        const cam=A.World.camera.position;
        const n=V(o.d.nor[0],o.d.nor[1],o.d.nor[2]);
        const facing=n.dot(cam.clone().sub(wp).normalize());
        const occl=U.clamp((facing+.25)/.9,0,1);
        const vis=(q.visible?1:0)*(.25+.75*occl);
        const ang=(i/7)*Math.PI*2-Math.PI/2;
        const lx=W*.5+Math.cos(ang)*Math.min(W*.34,420);
        const ly=H*.5+Math.sin(ang)*Math.min(H*.32,270);
        const elbowX=(q.x+lx)/2;
        AT(o.line,{points:`${q.x},${q.y} ${elbowX},${q.y} ${lx},${ly}`,opacity:.65*vis});
        AT(o.dot,{cx:q.x,cy:q.y,opacity:vis});
        const bw=Math.max(96,o.d.n.length*11+22);
        AT(o.box,{x:lx-8,y:ly-16,width:bw,height:32,opacity:.7*vis});
        AT(o.tx,{x:lx,y:ly-2,opacity:vis});
        AT(o.sub,{x:lx,y:ly+10,opacity:.7*vis});
        AT(o.num,{x:lx-8,y:ly-20,opacity:.8*vis});
      });
      // workloads (three distinct dynamic processes)
      const wt=st.workloadType;
      trainRings.forEach((r,i)=>{
        const rad=20+i*18+t*22%(90);
        AT(r,{cx:WX,cy:WY-30,r:rad,stroke:wt===0?C.green:C.faint,
          opacity:wt===0?U.clamp(1-rad/130,0,1)*.8:0});
      });
      inferPipes.forEach((r,i)=>{
        const x=WX-90+i*32;
        AT(r,{x,y:WY-48,width:22,height:44,
          opacity:wt===1?(.25+.7*Math.max(0,Math.sin(t*3-i*.7))):0,
          fill:C.cyan});
      });
      hpcGrid.forEach((r,i)=>{
        const c=i%6,rw=(i/6)|0;
        AT(r,{x:WX-66+c*24,y:WY-62+rw*16,width:18,height:10,
          opacity:wt===2?(.2+.6*Math.max(0,Math.sin(t*2+c*.5+rw*.4))):0,
          fill:C.violet});
      });
      const wn=['TRAINING 训练','INFERENCE 推理','HPC 科学计算'];
      const ws=[st.precision+' · 大规模梯度与激活流动',st.precision+' · 低延迟逐 token 流水','FP64 · 高精度迭代求解'];
      workLabel.textContent=wn[wt];workSub.textContent=ws[wt];
      AT(workLabel,{fill:wt===0?C.green:(wt===1?C.cyan:C.violet)});
      AT(workTitle,{opacity:.9});
      // ending convergence: earlier motifs re-merge into the package outline
      const cz=U.sstep(.55,1,L);
      if(cz>0){
        const ox=W*.5-140,oy=H*.5-90,ow=280,oh=180;
        AT(convOutline,{x:ox,y:oy,width:ow,height:oh,opacity:cz*.8,
          'stroke-dasharray':`${10+cz*0} 6`});
        conv.forEach((r,i)=>{
          const ang2=i*2.39996,r0=300*(1-cz)+40;
          const sx=W*.5+Math.cos(ang2)*r0,sy=H*.5+Math.sin(ang2)*r0*.6;
          const side=i%4;
          const ex=ox+(side===0?0:(side===1?ow:(i/4%1)*ow));
          const ey=oy+(side===2?oh:(side===3?0:(U.hash(i)*oh)));
          AT(r,{x:U.lerp(sx,ex,cz),y:U.lerp(sy,ey,cz),opacity:cz*.75,
            fill:i%3===0?C.cyan:(i%3===1?C.amber:C.green)});
        });
        AT(convTx,{y:H*.5,opacity:cz});
        convTx.textContent='ONE GPU';
      }else{
        conv.forEach(r=>AT(r,{opacity:0}));
        AT(convOutline,{opacity:0});AT(convTx,{opacity:0});
      }
    }});
  }
};

S.update=(p,t,st)=>{
  if(!S.ch)return;
  A.World.scene.updateMatrixWorld(true);
  const dd=A.Director.derived;
  S.persist.up(p,t,st,dd);
  for(let i=0;i<S.ch.length;i++){
    const c=S.ch[i],w=dd.w[i];
    AT(c.g,{opacity:w.toFixed(3),'pointer-events':w>.5?'auto':'none'});
    c.g.style.display=w>.012?'':'none';
    if(w>.012)c.up(p,t,st,dd);
  }
};
S.resize=()=>{S.init();};

})();
