const fs=require('fs');
let p='js/engine.js'; let s=fs.readFileSync(p,'utf8');
// brighter road material
s=s.replace("const mat = new THREE.MeshStandardMaterial({\n        color: 0xffffff, map: roadTex, roughness: 0.5, metalness: 0.55,\n        emissive: this.theme.roadEdge, emissiveIntensity: 0.06, vertexColors: false\n      });", "const mat = new THREE.MeshStandardMaterial({\n        color: 0xffffff, map: roadTex, roughness: 0.42, metalness: 0.45,\n        emissive: 0xffffff, emissiveMap: roadTex, emissiveIntensity: 0.55, vertexColors: false\n      });");
// lighter zone instance colors
s=s.replace("col.setHex(base);\n          if (!old && (c.type === 'entrance' || c.type === 'exit' || c.type === 'switch')) col.setHex(this.theme.road).lerp(new THREE.Color(this.theme.roadEdge), 0.18);", "col.setHex(base).lerp(new THREE.Color(0xffffff), old ? 0.02 : 0.16);\n          if (!old && (c.type === 'entrance' || c.type === 'exit' || c.type === 'switch')) col.setHex(this.theme.road).lerp(new THREE.Color(this.theme.roadEdge), 0.35);");
// camera default farther
s=s.replace("const d = Math.max(w, h) * 1.22;", "const d = Math.max(w, h) * 1.62;");
s=s.replace("this.camGoal.pitch = 0.95;", "this.camGoal.pitch = 1.03;");
s=s.replace("this.renderer.toneMappingExposure = 1.12;", "this.renderer.toneMappingExposure = 1.22;");
s=s.replace("const hemi = new THREE.HemisphereLight(0x8fd8ff, 0x1a1020, 0.55);", "const hemi = new THREE.HemisphereLight(0x9fe6ff, 0x1a1020, 0.8);");
s=s.replace("const key = new THREE.DirectionalLight(0xdfefff, 1.55);", "const key = new THREE.DirectionalLight(0xdfefff, 1.9);");
// route strip width/opacity defaults & shader brightness
s=s.replace("const width = opts.width || 0.9;", "const width = opts.width || 0.72;");
s=s.replace("uniforms: {\n          uTime: { value: 0 }, uColor: { value: new THREE.Color(color) },\n          uOpacity: { value: opts.opacity == null ? 0.85 : opts.opacity },", "uniforms: {\n          uTime: { value: 0 }, uColor: { value: new THREE.Color(color) },\n          uOpacity: { value: opts.opacity == null ? 0.62 : opts.opacity },");
s=s.replace("vec3 c=uColor*(1.2+chev*2.4);", "vec3 c=uColor*(0.7+chev*1.1);");
s=s.replace("const mesh = this._routeStrip(pts, r.color, { offset: (idx - (routes.length - 1) / 2) * 0.16, opacity: 0.8, width: 1.05 });", "const mesh = this._routeStrip(pts, r.color, { offset: (idx - (routes.length - 1) / 2) * 0.38, opacity: 0.68, width: 0.78 });");
// brighter road texture
s=s.replace("g.fillStyle = '#0b1a24'; g.fillRect(0, 0, 256, 256);", "g.fillStyle = '#1b3b4b'; g.fillRect(0, 0, 256, 256);");
s=s.replace("g.strokeStyle = 'rgba(70,210,220,.20)'; g.lineWidth = 2;", "g.strokeStyle = 'rgba(120,245,235,.34)'; g.lineWidth = 2;");
fs.writeFileSync(p,s);
