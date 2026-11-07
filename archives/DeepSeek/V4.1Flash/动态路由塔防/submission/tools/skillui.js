const fs=require('fs');
let p='js/ui.js'; let s=fs.readFileSync(p,'utf8');
const old=`          <button class="skill-btn ${enc ? 'encrypted' : ''}" data-act="skill">${enc ? '加密中 · 无法释放技能' : sk.name + ' · ' + sk.desc}
            ${cd > 0 && !enc ? `<span class="cd">冷却 ${cd}s</span>` : ''}
          </button>`;
const neu=`          <button class="skill-btn ${enc ? 'encrypted' : ''} ${cd > 0 && !enc ? 'cooling' : ''}" data-act="skill" ${enc || cd > 0 ? 'disabled' : ''}>${enc ? '加密中 · 无法释放技能' : sk.name + ' · ' + sk.desc}
            ${cd > 0 && !enc ? `<span class="cd">冷却 ${cd}s</span>` : ''}
          </button>`;
if(!s.includes(old)) console.log('skill block not found'); else s=s.replace(old,neu);
fs.writeFileSync(p,s);
let h=fs.readFileSync('index.html','utf8');
h=h.replace(".skill-btn.encrypted { border-color: rgba(200,110,255,.5); color: #d29bff; }", ".skill-btn.encrypted { border-color: rgba(200,110,255,.5); color: #d29bff; }\n  .skill-btn.cooling { color: transparent; }\n  .skill-btn.cooling .cd { color: #d8c2ff; }");
fs.writeFileSync('index.html',h);
