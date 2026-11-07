const fs=require('fs');
let p='js/engine.js'; let s=fs.readFileSync(p,'utf8');
s=s.replace("vertexShader: `attribute vec3 color; attribute float psize; varying vec3 vC;", "vertexShader: `attribute float psize; varying vec3 vC;");
s=s.replace("transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true", "transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true");
fs.writeFileSync(p,s);
