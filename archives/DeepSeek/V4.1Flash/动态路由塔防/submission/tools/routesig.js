const fs=require('fs');let p='js/engine.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("      this.routesGroup = new THREE.Group(); this.mapGroup.add(this.routesGroup);\n      this.routeViews = {};", "      this.routesGroup = new THREE.Group(); this.mapGroup.add(this.routesGroup);\n      this.routeViews = {};\n      this._routeSig = null;");
s=s.replace("      this.routeViews = {};\n      this._routeSig = null;", "      this.routeViews = {};\n      this._routeSig = null;");
s=s.replace("      this.map = null; this.routesGroup = null; this.previewGroup = null;", "      this.map = null; this.routesGroup = null; this.previewGroup = null; this._routeSig = null;");
fs.writeFileSync(p,s);
