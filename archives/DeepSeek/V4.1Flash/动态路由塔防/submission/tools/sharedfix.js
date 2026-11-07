const fs=require('fs');
let m=fs.readFileSync('js/models.js','utf8');
m=m.replace("      _glowMats[key] = new THREE.SpriteMaterial({\n        map: glowTexture(), color: colorHex, transparent: true, opacity: opacity == null ? 0.8 : opacity,\n        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true\n      });", "      _glowMats[key] = new THREE.SpriteMaterial({\n        map: glowTexture(), color: colorHex, transparent: true, opacity: opacity == null ? 0.8 : opacity,\n        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true\n      });\n      _glowMats[key].__shared = true;");
fs.writeFileSync('js/models.js',m);
let e=fs.readFileSync('js/engine.js','utf8');
e=e.replace("        arr.forEach(m => { mats.add(m); });", "        arr.forEach(m => { if (!m.__shared) mats.add(m); });");
e=e.replace("    clearMap() {\n      this.towerViews.clear();", "    clearMap() {\n      if (this.effects) this.effects.reset();\n      this.towerViews.clear();");
fs.writeFileSync('js/engine.js',e);
