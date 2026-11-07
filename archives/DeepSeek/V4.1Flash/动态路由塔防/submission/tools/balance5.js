const fs=require('fs');let p='js/game.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("      w.groups.forEach(g => {\n        for (let i = 0; i < g.n; i++) {\n          const t = (g.delay || 0) + i * (g.gap || 1);", "      const late = this.waveIndex >= 4;\n      const nerf = late ? 0.82 : 1;\n      const gapScale = this.waveIndex >= 8 ? 1.15 : 1;\n      w.groups.forEach(g => {\n        const cnt = Math.max(1, Math.round(g.n * nerf));\n        for (let i = 0; i < cnt; i++) {\n          const t = (g.delay || 0) + i * (g.gap || 1) * gapScale;");
fs.writeFileSync(p,s);
