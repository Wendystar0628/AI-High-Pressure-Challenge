const fs=require('fs');
for(const f of ['js/data.js','js/models.js','js/engine.js','js/game.js','js/audio.js','js/ui.js','js/demo.js','js/main.js']){
  try { new Function(fs.readFileSync(f,'utf8')); console.log('OK',f); }
  catch(e){ console.log('FAIL',f,e.message); }
}
require(__dirname + '/../js/data.js');
const D=globalThis.GAME_DATA;
for(const m of D.MAPS){
  let road=0, old=0, plat=0;
  m.rows.forEach(r=>{ for(const ch of r){ if('.oABCXY'.includes(ch)) road++; if(ch==='o') old++; if(ch==='P') plat++; }});
  console.log(m.id, 'waves', D.WAVES[m.id].length, 'meta', m.waves, 'rows', m.rows[0].length+'x'+m.rows.length, 'road',road,'old',old,'plat',plat);
  // verify switches on walkable cells
  m.switches.forEach(s=>{ const ch=m.rows[s.y][s.x]; if(!'.oABCXY'.includes(ch)) console.log(' BAD SWITCH', s.id, ch); });
  // verify entrances/exits markers
  m.entrances.forEach(e=>{ const ch=m.rows[e.y][e.x]; if(!'ABC'.includes(ch)) console.log(' BAD ENT', e.id, ch); });
  m.exits.forEach(e=>{ const ch=m.rows[e.y][e.x]; if(!'XY'.includes(ch)) console.log(' BAD EXIT', e.id, ch); });
}
