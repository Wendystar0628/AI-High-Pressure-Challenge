const fs = require('fs');
let p = __dirname + '/../js/engine.js';
let s = fs.readFileSync(p, 'utf8');
const oldAdd = `      g.userData.game = t;
      this.towerViews.set(t.id, g);
      if (t.cell.slotMarker) t.cell.slotMarker.visible = false;
      return g;`;
const newAdd = `      g.userData.game = t;
      this._attachTowerBar(g);
      this.towerViews.set(t.id, g);
      if (t.cell.slotMarker) t.cell.slotMarker.visible = false;
      return g;`;
if (!s.includes(oldAdd)) console.log('add block missing'); else s = s.replace(oldAdd, newAdd);
s = s.replace("      this.mapGroup.add(g); t.view = g;\n      t.viewData.level = t.level;\n      this.towerViews.set(t.id, g);", "      this.mapGroup.add(g); t.view = g;\n      t.viewData.level = t.level;\n      this._attachTowerBar(g);\n      this.towerViews.set(t.id, g);");
const helper = `    _attachTowerBar(g) {
      const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x04080c, transparent: true, opacity: 0.62, depthWrite: false, depthTest: true }));
      const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x63f0d0, transparent: true, opacity: 0.95, depthWrite: false, depthTest: true }));
      const wrap = new THREE.Group();
      wrap.position.y = 3.35;
      bg.scale.set(2.35, 0.14, 1); fill.scale.set(2.35, 0.1, 1);
      bg.position.y = 0.06; fill.position.y = 0.06;
      wrap.add(bg); wrap.add(fill); wrap.visible = false;
      g.add(wrap);
      g.userData.hpBar = { bg, fill, wrap };
    }

    removeTower(t) {`;
if (!s.includes('    removeTower(t) {')) console.log('removeTower missing'); else s = s.replace('    removeTower(t) {', helper);
const tick = `          M.tickTower(tw.view, vd, dt, t);
          const hb = tw.view.userData.hpBar;
          if (hb) {
            const ratio = Math.max(0, Math.min(1, tw.hp / tw.maxHp));
            hb.wrap.visible = ratio < 0.999 || tw.shield > 0 || tw.encryptedUntil > game.time;
            if (hb.wrap.visible) {
              hb.fill.scale.set(2.35 * ratio, 0.1, 1);
              hb.fill.center.set(0, 0.5); hb.fill.position.x = -1.175;
              hb.fill.material.color.setHex(tw.encryptedUntil > game.time ? 0xc46bff : ratio < 0.35 ? 0xff5f7e : ratio < 0.65 ? 0xffcf6e : 0x63f0d0);
              hb.wrap.position.y = tw.cell.platform ? 3.8 : 3.35;
            }
          }`;
if (!s.includes('          M.tickTower(tw.view, vd, dt, t);')) console.log('tick missing'); else s = s.replace('          M.tickTower(tw.view, vd, dt, t);', tick);
fs.writeFileSync(p, s);

let q = __dirname + '/../js/game.js';
let g = fs.readFileSync(q, 'utf8');
const spawnOld = "      this.enemies.push(e);\n      if (this.world) this.world.addEnemy(e);";
const spawnNew = "      this.enemies.push(e);\n      if (!this.seenTypes) this.seenTypes = new Set();\n      if (!this.seenTypes.has(typeId)) {\n        this.seenTypes.add(typeId);\n        this.log('首次发现威胁实体 · ' + def.name, 'warn');\n        this.emit('newThreat', { enemy: e, def });\n      }\n      if (this.world) this.world.addEnemy(e);";
if (!g.includes(spawnOld)) console.log('spawn block missing'); else g = g.replace(spawnOld, spawnNew);
fs.writeFileSync(q, g);

let uf = __dirname + '/../js/ui.js';
let u = fs.readFileSync(uf, 'utf8');
const toast = "      } else if (type === 'newThreat') {\n        this.toast('【新威胁】' + data.def.name + ' · ' + (data.def.tags || []).slice(0, 2).join(' / '), 'warn');\n      } else if (type === 'bossSpawn') {";
if (!u.includes("      } else if (type === 'bossSpawn') {")) console.log('toast anchor missing'); else u = u.replace("      } else if (type === 'bossSpawn') {", toast);
fs.writeFileSync(uf, u);
console.log('hp bars and threat notices patched');
