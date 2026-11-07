const fs=require('fs');let p='js/ui.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("      } else if (type === 'newThreat') {\n        this.toast('【新威胁】' + data.def.name + ' · ' + (data.def.tags || []).slice(0, 2).join(' / '), 'warn');", "      } else if (type === 'newThreat') {\n        if (!this.demoMode && !(global.DEMO && DEMO.exporting)) this.toast('【新威胁】' + data.def.name + ' · ' + (data.def.tags || []).slice(0, 2).join(' / '), 'warn');");
s=s.replace("    toast(text, cls) {\n      const el = document.createElement('div');", "    toast(text, cls) {\n      while (this.dom.toasts.children.length >= 2) this.dom.toasts.firstChild.remove();\n      const el = document.createElement('div');");
fs.writeFileSync(p,s);
let h=fs.readFileSync('index.html','utf8');
h=h.replace("#toasts { position: absolute; left: 50%; transform: translateX(-50%); bottom: 18.5rem; z-index: 35; display: flex; flex-direction: column; gap: .4rem; align-items: center; pointer-events: none; }", "#toasts { position: absolute; left: 1.3rem; top: 27rem; z-index: 35; display: flex; flex-direction: column; gap: .4rem; align-items: flex-start; pointer-events: none; max-width: 30rem; }");
fs.writeFileSync('index.html',h);
