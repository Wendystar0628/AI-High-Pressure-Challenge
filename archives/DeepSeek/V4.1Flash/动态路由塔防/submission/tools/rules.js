const fs=require('fs');let p='js/game.js';let s=fs.readFileSync(p,'utf8');
// blocking capacity uses block cost
s=s.replace("        const st = this.towerStats(tower);\n        if (tower.blockedSet.size < (st.block || 0)) {", "        const st = this.towerStats(tower);\n        let usedCap = 0;\n        tower.blockedSet.forEach(o => { usedCap += (o.def.block || 1); });\n        if (usedCap + (e.def.block || 1) <= (st.block || 0)) {");
// salvo range
s=s.replace("      if (t.defId === 'interceptor' && t.skillUntil > this.time) s.rate *= 3;", "      if (t.defId === 'interceptor' && t.skillUntil > this.time) { s.rate *= 3; s.range *= 1.15; }");
// suppress weaken
s=s.replace("        if (t.branch === 'suppress' && !target.dead) {\n          target.slowUntil = this.time + (st.slowTime || 2.5); target.slowFactor = st.slow || 0.35;\n        }", "        if (t.branch === 'suppress' && !target.dead) {\n          target.slowUntil = this.time + (st.slowTime || 2.5); target.slowFactor = st.slow || 0.35;\n          target.weakenUntil = this.time + (st.slowTime || 2.5); target.weakenFactor = 0.2;\n        }");
// apply weaken in enemy attacks
s=s.replace("      this.damageTower(best, e.def.dmg, e, {});", "      this.damageTower(best, e.def.dmg * (e.weakenUntil > this.time ? 0.8 : 1), e, {});");
s=s.replace("      this.damageTower(t, e.def.dmg * (e.markedUntil > this.time ? 1.2 : 1), e, {});", "      this.damageTower(t, e.def.dmg * (e.markedUntil > this.time ? 1.2 : 1) * (e.weakenUntil > this.time ? 0.8 : 1), e, {});");
// firewall reflect
s=s.replace("      t.hp -= dmg; t.hitFlash = 0.1;", "      if (t.defId === 'firewall' && t.skillUntil > this.time && source && source.def && !source.dead) {\n        this.damageEnemy(source, amount * 0.25, t, { showText: false });\n      }\n      t.hp -= dmg; t.hitFlash = 0.1;");
// UI blocked display
let q='js/ui.js';let u=fs.readFileSync(q,'utf8');
u=u.replace("stats = `<div class=\"stat\"><span>伤害</span><b>${st.dmg}</b></div><div class=\"stat\"><span>射速</span><b>${st.rate.toFixed(2)}/s</b></div><div class=\"stat\"><span>射程</span><b>${st.range} 格</b></div><div class=\"stat\"><span>阻挡</span><b>${t.isNodeTower ? '隔离' : (t.blockedSet.size + ' / ' + st.block)}</b></div>`;", "stats = `<div class=\"stat\"><span>伤害</span><b>${st.dmg}</b></div><div class=\"stat\"><span>射速</span><b>${st.rate.toFixed(2)}/s</b></div><div class=\"stat\"><span>射程</span><b>${st.range} 格</b></div><div class=\"stat\"><span>阻挡</span><b>${t.isNodeTower ? '隔离' : ([...t.blockedSet].reduce((a,e)=>a+(e.def.block||1),0) + ' / ' + st.block)}</b></div>`;");
fs.writeFileSync(q,u);
fs.writeFileSync(p,s);
