const fs=require('fs');let p='js/engine.js';let s=fs.readFileSync(p,'utf8');
const old=`    _buildPickVolumes() {
      this.pickMeshes = [];
      const geo = new THREE.BoxGeometry(CELL * 0.94, 1, CELL * 0.94);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false });
      for (const c of this.map.cells) {
        if (!c.walk && !c.platform) continue;
        const top = this.cellTop(c);
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(this.cellPos(c, top));
        m.scale.y = 5;
        m.position.y = top - 2.5;
        m.userData.cell = c;
        m.renderOrder = -1;
        this.pickMeshes.push(m);
        this.mapGroup.add(m);
      }
    }`;
const neu=`    _buildPickVolumes() {
      this.pickMeshes = [];
      const geo = new THREE.BoxGeometry(CELL * 0.94, 0.26, CELL * 0.94);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      for (const c of this.map.cells) {
        if (!c.walk && !c.platform) continue;
        const top = this.cellTop(c);
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(this.cellPos(c, top + 0.1));
        m.userData.cell = c;
        this.pickMeshes.push(m);
        this.mapGroup.add(m);
      }
    }`;
if(!s.includes(old)) console.log('pickvol not found'); else s=s.replace(old,neu);
const old2=`      if (this.pickMeshes && this.pickMeshes.length) {
        const hits = this.raycaster.intersectObjects(this.pickMeshes, false);
        if (hits.length) return hits[0].object.userData.cell;
      }
      const hit = new THREE.Vector3();`;
const neu2=`      if (this.pickMeshes && this.pickMeshes.length) {
        const hits = this.raycaster.intersectObjects(this.pickMeshes, false);
        if (hits.length) return hits[0].object.userData.cell;
      }
      // screen-space fallback: catch clicks on raised nodes, towers and platforms
      let best = null, bd = 34;
      const rect2 = this.canvas.getBoundingClientRect();
      const sx = clientX - rect2.left, sy = clientY - rect2.top;
      for (const c of this.map.cells) {
        if (!c.walk && !c.platform) continue;
        const h = c.type === 'switch' ? 1.3 : c.platform ? 1.55 : 0.55;
        const sp = this.toScreen(this.cellPos(c, this.cellTop(c) + h));
        if (!sp) continue;
        const dd = Math.hypot(sp.x - sx, sp.y - sy);
        if (dd < bd) { bd = dd; best = c; }
      }
      if (best) return best;
      const hit = new THREE.Vector3();`;
if(!s.includes(old2)) console.log('pick fallback not found'); else s=s.replace(old2,neu2);
fs.writeFileSync(p,s);
