const fs=require('fs');
let p='js/game.js'; let s=fs.readFileSync(p,'utf8');
s=s.replace("      s.name = def.name; s.defId = def.id; s.cost = def.cost; s.skill = def.skill;", "      s.name = def.name; s.defId = def.id; s.cost = def.cost; s.skill = def.skill; s.cone = def.cone;");
fs.writeFileSync(p,s);
let q='js/engine.js'; let e=fs.readFileSync(q,'utf8');
e=e.replace("        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,\n        uniforms: {\n          uTime: { value: 0 }, uColor: { value: new THREE.Color(color) },", "        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending,\n        uniforms: {\n          uTime: { value: 0 }, uColor: { value: new THREE.Color(color) },");
e=e.replace("            float base=(0.10+chev*0.9)*edge;\n            vec3 c=uColor*(1.2+chev*2.4);\n            float a=base*uOpacity;", "            float base=(0.16+chev*0.62)*edge;\n            vec3 c=uColor*(1.0+chev*0.9);\n            float a=base*uOpacity;");
e=e.replace("        const mesh = this._routeStrip(pts, r.color, { opacity: 0.46, width: 0.62 });", "        const mesh = this._routeStrip(pts, r.color, { opacity: 0.72, width: 0.82 });");
fs.writeFileSync(q,e);
