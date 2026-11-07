/* grid.js — 瓦片网格与地形 */
(function(){
'use strict';
const G = window.G;
const TILE = G.TILE;

class Grid {
  constructor(w, h){
    this.w = w; this.h = h;
    this.tiles = new Uint8Array(w*h);
    this.heights = new Float32Array(w*h);     // 视觉高度
    this.blocked = new Uint8Array(w*h);       // 动态阻断（黑洞/锁死）
    this.oldOverlay = new Float32Array(w*h);  // 协议降级剩余时间
    this.props = new Map();                    // 格子附加对象
  }
  idx(x,z){ return z*this.w + x; }
  inBounds(x,z){ return x>=0 && z>=0 && x<this.w && z<this.h; }
  get(x,z){ return this.inBounds(x,z) ? this.tiles[this.idx(x,z)] : TILE.VOID; }
  set(x,z,t){ if(this.inBounds(x,z)) this.tiles[this.idx(x,z)] = t; }
  height(x,z){ return this.inBounds(x,z) ? this.heights[this.idx(x,z)] : 0; }
  setHeight(x,z,v){ if(this.inBounds(x,z)) this.heights[this.idx(x,z)] = v; }

  isWalkable(x,z){
    if(!this.inBounds(x,z)) return false;
    const i = this.idx(x,z);
    const t = this.tiles[i];
    if(t===TILE.VOID || t===TILE.PLATFORM || t===TILE.OBSTACLE || t===TILE.DECOR) return false;
    if(this.blocked[i]) return false;
    return true;
  }
  isLinkish(x,z){
    const t = this.get(x,z);
    return t===TILE.LINK || t===TILE.NODE || t===TILE.OLDLINK || t===TILE.ENTRY || t===TILE.EXIT;
  }
  isNode(x,z){ return this.get(x,z)===TILE.NODE; }
  isPlatform(x,z){ return this.get(x,z)===TILE.PLATFORM; }
  isOldLink(x,z){ return this.get(x,z)===TILE.OLDLINK || this.oldOverlay[this.idx(x,z)]>0; }
  isBlocked(x,z){ return !this.inBounds(x,z) || this.blocked[this.idx(x,z)]>0; }
  setBlocked(x,z,v){
    if(this.inBounds(x,z)){
      const i=this.idx(x,z);
      if(v) this.blocked[i]=1; else this.blocked[i]=0;
    }
  }

  // 通行代价（用于加权寻路）
  cost(x,z){
    const t = this.get(x,z);
    if(t===TILE.OLDLINK) return 1.55;
    if(this.oldOverlay[this.idx(x,z)]>0) return 1.55;
    return 1.0;
  }

  // 世界坐标 <-> 网格坐标（格心）
  toWorld(x,z, out){
    const s = G.CFG.tileSize;
    const ox = -(this.w*s)/2 + s/2;
    const oz = -(this.h*s)/2 + s/2;
    if(out){ out.set(ox + x*s, 0, oz + z*s); return out; }
    return {x: ox + x*s, y:0, z: oz + z*s};
  }
  toGrid(wx, wz){
    const s = G.CFG.tileSize;
    const ox = -(this.w*s)/2 + s/2;
    const oz = -(this.h*s)/2 + s/2;
    return { x: Math.round((wx-ox)/s), z: Math.round((wz-oz)/s) };
  }

  forEach(fn){
    for(let z=0;z<this.h;z++) for(let x=0;x<this.w;x++) fn(x,z,this.tiles[this.idx(x,z)]);
  }
}

// 解析字符地图
// 图例: .  void   #  link   N  node   P  platform   O  oldlink
//       A/B/C entry  X/Y exit   * obstacle   ~ decor
function parseAscii(rows, meta){
  const h = rows.length, w = rows[0].length;
  const g = new Grid(w,h);
  const entries = [], exits = [], namedNodes = [];
  for(let z=0;z<h;z++){
    const line = rows[z];
    for(let x=0;x<w;x++){
      const c = line[x];
      let t = TILE.VOID, hh = 0;
      if(c>='1' && c<='9'){ t=TILE.NODE; hh=0.28; namedNodes.push({x,z,id:'N'+c}); }
      else switch(c){
        case '.': t=TILE.VOID; break;
        case '#': t=TILE.LINK; hh=0.12; break;
        case 'N': t=TILE.NODE; hh=0.28; break;
        case 'P': t=TILE.PLATFORM; hh=0.42; break;
        case 'O': t=TILE.OLDLINK; hh=0.10; break;
        case 'A': t=TILE.ENTRY; hh=0.18; entries.push({x,z,id:'A'}); break;
        case 'B': t=TILE.ENTRY; hh=0.18; entries.push({x,z,id:'B'}); break;
        case 'C': t=TILE.ENTRY; hh=0.18; entries.push({x,z,id:'C'}); break;
        case 'X': t=TILE.EXIT; hh=0.22; exits.push({x,z,id:'X'}); break;
        case 'Y': t=TILE.EXIT; hh=0.22; exits.push({x,z,id:'Y'}); break;
        case '*': t=TILE.OBSTACLE; hh=0.55; break;
        case '~': t=TILE.DECOR; hh=0.35; break;
        default: t=TILE.VOID;
      }
      g.tiles[g.idx(x,z)] = t;
      g.heights[g.idx(x,z)] = hh;
    }
  }
  g.meta = meta || {};
  g.entries = entries;
  g.exits = exits;
  g.namedNodes = namedNodes;
  return g;
}

G.Grid = Grid;
G.parseAscii = parseAscii;

})();
