global.window = globalThis;
for (const f of ['core/util','geom/path','geom/poly','core/model','core/anim','core/expr','core/eval']) require('../js/' + f + '.js');
const {U, Path: P, Poly, Model: M, Anim: A, Expr: X, Eval: E} = AE;
// earcut square with hole
const outer=[0,0,100,0,100,100,0,100], hole=[25,25,75,25,75,75,25,75];
console.log('earcut tris', Poly.earcut(outer.concat(hole),[4]).length/3);
// boolean
const sq = {c:true,p:[0,0,100,0,100,100,0,100]}, sq2={c:true,p:[50,50,150,50,150,150,50,150]};
for (const op of ['union','subtract','intersect','xor']) { const r = Poly.boolean([sq],[sq2],op); console.log(op, r.length, r.map(l=>Math.abs(P.area(l.p))));}
// circle minus circle
const c1 = P.flatten(P.ellipse(0,0,200,200),0.5), c2=P.flatten(P.ellipse(0,0,100,100),0.5);
const ring = Poly.boolean([c1],[c2],'subtract'); console.log('ring', ring.length, ring.map(l=>Math.abs(P.area(l.p)).toFixed(0)), 'expected', (Math.PI*1e4-Math.PI*2500).toFixed(0));
console.log('group', Poly.group(ring).map(g=>g.holes.length));
// trim
const line = {c:false,p:[0,0,100,0,100,100]};
console.log('trim', JSON.stringify(P.trim([line],25,75,0)));
console.log('trim closed', JSON.stringify(P.trim([sq],0,50,90)));
// anim
const pr = M.num(0); pr.anim=true; pr.keys=[M.key(0,0),M.key(1,100)];
console.log('lin', A.valueAt(pr,0.5)); A.applyEase(pr.keys[0],'easy'); A.applyEase(pr.keys[1],'easy'); console.log('ease', A.valueAt(pr,0.25).toFixed(2), A.valueAt(pr,0.5).toFixed(2));
pr.keys[0].oi='hold'; console.log('hold', A.valueAt(pr,0.9));
// spatial
const pos = M.v3([0,0,0],{spatial:true}); pos.anim=true; pos.keys=[M.key(0,[0,0,0]),M.key(1,[100,0,0]),M.key(2,[100,100,0])];
console.log('spatial', A.valueAt(pos,0.5).map(x=>x.toFixed(1)), A.valueAt(pos,1.5).map(x=>x.toFixed(1)));
// expressions
const proj = M.newProject(); const comp = M.newComp({name:'主合成'}); proj.comps.push(comp);
const ctrl = M.newNull(comp,'控制器'); ctrl.transform.rotation.value = 45; comp.layers.push(ctrl);
const s = M.newShapeLayer(comp,'形状'); comp.layers.push(s);
s.transform.rotation.exprOn=true; s.transform.rotation.expr='thisComp.layer("控制器").transform.rotation * 2 + time';
s.transform.position.exprOn=true; s.transform.position.expr='value + [10, 20, 0]';
s.transform.opacity.exprOn=true; s.transform.opacity.expr='var a = linear(time, 0, 2, 0, 100);\n a';
E.index(proj); const ctx = E.root(comp);
console.log('expr rot', E.prop(s.transform.rotation, 1, ctx), 'pos', E.prop(s.transform.position,1,ctx), 'op', E.prop(s.transform.opacity,1,ctx));
s.transform.scale.exprOn=true; s.transform.scale.expr='wiggle(2, 30)'; E.bump();
console.log('wiggle', E.prop(s.transform.scale,0.3,ctx).map(x=>x.toFixed(2)), E.prop(s.transform.scale,0.3,ctx).map(x=>x.toFixed(2)));
pr.keys[0].oi='linear'; pr.exprOn=true; pr.expr='loopOut("pingpong")'; s.transform.rotX=pr; E.bump(); E.index(proj);
console.log('pingpong', E.prop(pr,1.25,ctx), E.prop(pr,2.25,ctx));
// cycle
ctrl.transform.rotation.exprOn=true; ctrl.transform.rotation.expr='thisComp.layer("形状").transform.rotation + 1'; E.bump();
console.log('cycle', E.prop(s.transform.rotation,1,ctx), s.transform.rotation._err, '|', ctrl.transform.rotation._err);
ctrl.transform.rotation.exprOn=false; E.bump();
// valueAtTime and toWorld
ctrl.transform.position.anim=true; ctrl.transform.position.keys=[M.key(0,[0,0,0]),M.key(2,[200,0,0])];
s.transform.anchor.exprOn = true; s.transform.anchor.expr = 'thisComp.layer("控制器").transform.position.valueAtTime(time - 1)'; E.bump();
console.log('vat', E.prop(s.transform.anchor, 1.5, ctx));
s.transform.anchor.expr = 'fromWorld(thisComp.layer("控制器").toWorld([0,0,0]))'; E.bump();
console.log('fromWorld', E.prop(s.transform.anchor, 1, ctx).map(x=>x.toFixed(2)));
console.log('err', X.compile('1 +').error, X.compile('if (time > 1) 5 else 3').code);
