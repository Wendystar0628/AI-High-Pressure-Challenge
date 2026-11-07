const fs=require('fs'); let p='js/engine.js'; let s=fs.readFileSync(p,'utf8');
const old = `      this.routeViews = {};
      routes.forEach((r, idx) => {
        if (!r.cells || r.cells.length < 2) return;
        const pts = r.cells.map(c => this.cellPos(c, 0.56));
        const mesh = this._routeStrip(pts, r.color, { offset: (idx - (routes.length - 1) / 2) * 0.38, opacity: 0.68, width: 0.78 });
        this.mapGroup.add(mesh);
        this.routeViews[r.id] = { mesh, mat: mesh.material, color: r.color, cells: r.cells, entrance: r.id, exit: r.exitId };
      });
      this._routeIndex = {};`;
const neu = `      this.routeViews = {};
      routes.forEach((r, idx) => {
        if (!r.cells || r.cells.length < 2) return;
        const off = (idx - (routes.length - 1) / 2) * 0.4;
        const raw = r.cells.map(c => this.cellPos(c, 0.58));
        const pts = raw.map((p, i) => {
          let dir;
          if (i === 0) dir = new THREE.Vector3().subVectors(raw[1], p);
          else if (i === raw.length - 1) dir = new THREE.Vector3().subVectors(p, raw[i - 1]);
          else dir = new THREE.Vector3().subVectors(raw[i + 1], raw[i - 1]);
          dir.y = 0; dir.normalize();
          return p.clone().add(new THREE.Vector3(-dir.z * off, 0, dir.x * off));
        });
        const mesh = this._routeStrip(pts, r.color, { opacity: 0.46, width: 0.62 });
        this.mapGroup.add(mesh);
        // crisp colored line for route identity
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().setY(p.y + 0.03))),
          new THREE.LineBasicMaterial({ color: r.color, transparent: true, opacity: 0.7, depthWrite: false }));
        this.mapGroup.add(line);
        // moving chevrons
        const mkGroup = new THREE.Group();
        const mks = [];
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Group();
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 3), new THREE.MeshBasicMaterial({
            color: r.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
          }));
          cone.rotation.x = Math.PI / 2; cone.position.z = 0.2; m.add(cone);
          const glow = M.glowSprite(r.color, 1.6, 0.5); m.add(glow);
          this.mapGroup.add(m); mks.push(m);
        }
        // cumulative lengths
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
        this.routeViews[r.id] = { mesh, line, mat: mesh.material, color: r.color, cells: r.cells, entrance: r.id, exit: r.exitId, pts, cum, len: cum[cum.length - 1], mks };
      });
      this._routeIndex = {};`;
if(!s.includes(old)) { console.log('route block not found'); } else { s=s.replace(old,neu); }
// update marker positions and line pulse
const old2 = `      for (const k in this.routeViews) {
        const rv = this.routeViews[k];
        rv.mat.uniforms.uTime.value = t;
        rv.mat.uniforms.uOpacity.value = 0.55 + Math.sin(t * 1.3 + k.charCodeAt(0)) * 0.15;
      }`;
const neu2 = `      for (const k in this.routeViews) {
        const rv = this.routeViews[k];
        rv.mat.uniforms.uTime.value = t;
        rv.mat.uniforms.uOpacity.value = 0.4 + Math.sin(t * 1.3 + k.charCodeAt(0)) * 0.08;
        if (rv.mks && rv.len > 1) {
          rv.mks.forEach((m, i) => {
            const d = ((t * 5.2 + i * rv.len / 3) % rv.len);
            let seg = 0;
            while (seg < rv.cum.length - 2 && rv.cum[seg + 1] < d) seg++;
            const f = (d - rv.cum[seg]) / Math.max(0.001, rv.cum[seg + 1] - rv.cum[seg]);
            const a = rv.pts[seg], b = rv.pts[seg + 1];
            m.position.set(lerp(a.x, b.x, f), 0.86 + Math.sin(t * 4 + i) * 0.05, lerp(a.z, b.z, f));
            m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
            m.visible = true;
          });
        }
      }`;
if(!s.includes(old2)) console.log('anim block not found'); else s=s.replace(old2,neu2);
// dispose line/mks on rebuild: replace removal block
const old3 = `      for (const k in this.routeViews) {
        this.mapGroup.remove(this.routeViews[k].mesh);
        disposeMesh(this.routeViews[k].mesh);
      }`;
const neu3 = `      for (const k in this.routeViews) {
        const rv = this.routeViews[k];
        this.mapGroup.remove(rv.mesh); disposeMesh(rv.mesh);
        if (rv.line) { this.mapGroup.remove(rv.line); rv.line.geometry.dispose(); rv.line.material.dispose(); }
        if (rv.mks) rv.mks.forEach(m => { this.mapGroup.remove(m); disposeGroup(m); });
      }`;
if(!s.includes(old3)) console.log('remove block not found'); else s=s.replace(old3,neu3);
fs.writeFileSync(p,s);
