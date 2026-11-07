/* waves.js — 波次定义 */
(function(){
'use strict';
const G = window.G;

function makeWave(num, total){
  const waves = [];
  const bossWave = total;
  const isFloodWave = Math.floor(total * 0.6);

  for(let w=1; w<=total; w++){
    const groups = [];
    const isBoss = (w === bossWave);
    const isFlood = (w === isFloodWave);

    if(w === 1){
      groups.push({type:'worm', count:4, entryId:'A', interval:2, delay:0});
    }
    else if(w === 2){
      groups.push({type:'worm', count:5, entryId:'A', interval:1.8, delay:0});
      groups.push({type:'worm', count:3, entryId:'B', interval:2, delay:3});
    }
    else if(w === 3){
      groups.push({type:'worm', count:6, entryId:'A', interval:1.5, delay:0});
      groups.push({type:'trojan', count:2, entryId:'B', interval:2.5, delay:2});
    }
    else if(w === 4){
      groups.push({type:'worm', count:5, entryId:'A', interval:1.5, delay:0});
      groups.push({type:'worm', count:4, entryId:'B', interval:1.5, delay:1});
      groups.push({type:'trojan', count:2, entryId:'A', interval:2.5, delay:3});
    }
    else if(w === 5){
      groups.push({type:'flood', count:1, entryId:'A', interval:3, delay:0});
      groups.push({type:'worm', count:6, entryId:'B', interval:1.2, delay:1});
      groups.push({type:'trojan', count:2, entryId:'B', interval:2.5, delay:4});
    }
    else if(w === 6){
      groups.push({type:'hotspot', count:3, entryId:'A', interval:2, delay:0});
      groups.push({type:'worm', count:6, entryId:'A', interval:1.2, delay:2});
      groups.push({type:'worm', count:4, entryId:'B', interval:1.5, delay:1});
    }
    else if(w === 7){
      groups.push({type:'ransom', count:2, entryId:'A', interval:3, delay:0});
      groups.push({type:'worm', count:6, entryId:'B', interval:1.5, delay:1});
      groups.push({type:'packer', count:1, entryId:'A', interval:3, delay:3});
    }
    else if(w === 8){
      groups.push({type:'flood', count:2, entryId:'B', interval:3, delay:0});
      groups.push({type:'trojan', count:3, entryId:'A', interval:2, delay:2});
      groups.push({type:'hotspot', count:3, entryId:'B', interval:1.5, delay:4});
    }
    else if(w === 9){
      groups.push({type:'worm', count:6, entryId:'A', interval:1.2, delay:0});
      groups.push({type:'worm', count:5, entryId:'B', interval:1.5, delay:1});
      groups.push({type:'ransom', count:2, entryId:'A', interval:2.5, delay:3});
      groups.push({type:'packer', count:1, entryId:'B', interval:3, delay:5});
    }
    else if(isFlood){
      // 洪峰：多入口同时大量出兵
      groups.push({type:'worm', count:8, entryId:'A', interval:1, delay:0});
      groups.push({type:'flood', count:2, entryId:'A', interval:2.5, delay:1});
      groups.push({type:'worm', count:8, entryId:'B', interval:1, delay:0.5});
      groups.push({type:'trojan', count:3, entryId:'B', interval:2, delay:2});
      groups.push({type:'hotspot', count:4, entryId:'A', interval:1.2, delay:3});
      groups.push({type:'ransom', count:2, entryId:'B', interval:2.5, delay:4});
    }
    else if(w === total-1){
      groups.push({type:'worm', count:8, entryId:'A', interval:1, delay:0});
      groups.push({type:'flood', count:2, entryId:'A', interval:2.5, delay:1});
      groups.push({type:'ransom', count:3, entryId:'B', interval:2, delay:2});
      groups.push({type:'packer', count:2, entryId:'A', interval:2.5, delay:3});
      groups.push({type:'hotspot', count:4, entryId:'B', interval:1.2, delay:4});
      groups.push({type:'trojan', count:3, entryId:'B', interval:2, delay:5});
    }
    else if(isBoss){
      // Boss 波
      const bossType = total===14 ? 'boss_kui' : total===15 ? 'boss_lou' : 'boss_ying';
      groups.push({type:'worm', count:6, entryId:'A', interval:1.2, delay:0});
      groups.push({type:'flood', count:1, entryId:'A', interval:3, delay:2});
      groups.push({type:bossType, count:1, entryId:'A', interval:1, delay:4});
      groups.push({type:'trojan', count:3, entryId:'B', interval:2.5, delay:6});
      groups.push({type:'ransom', count:2, entryId:'B', interval:3, delay:8});
    }
    else {
      // 中后段混合
      const pool = ['worm','trojan','flood','ransom','hotspot','packer'];
      const nGroups = Math.min(2 + Math.floor(w/4), 4);
      for(let i=0;i<nGroups;i++){
        const type = G.RNG.pick(pool);
        const count = Math.floor(3 + w*0.4 + G.RNG.range(0,2));
        const entry = G.RNG.pick(['A','B','C']);
        groups.push({type, count, entryId:entry, interval:Math.max(1, 2.2-w*0.05), delay:i*2});
      }
    }

    // 多入口地图加入 C 入口
    if(total >= 15 && w > 4 && w % 3 === 0){
      groups.push({type:'worm', count:Math.floor(3+w*0.3), entryId:'C', interval:1.5, delay:2});
    }

    waves.push({num:w, groups, isBoss, isFlood});
  }
  return waves;
}

G.makeWaves = makeWave;

})();
