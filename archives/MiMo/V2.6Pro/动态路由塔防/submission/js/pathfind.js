/* pathfind.js — 动态路由 / 寻路 / 连通性 */
(function(){
'use strict';
const G = window.G;

class Router {
  constructor(grid){
    this.grid = grid;
    this.routes = {};       // entryId -> [{x,z}...] 路径点
    this.routeVersion = 0;
    // 邻接缓存
    this._dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  }

  // 从起点到任一出口的最短路径（加权）
  findPath(sx, sz, targets){
    const g = this.grid;
    const W = g.w, H = g.h;
    const n = W*H;
    const dist = new Float32Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const visited = new Uint8Array(n);
    const start = g.idx(sx,sz);
    dist[start] = 0;
    // 目标集合
    const targetSet = new Set();
    if(targets && targets.length){
      targets.forEach(t=>targetSet.add(g.idx(t.x,t.z)));
    } else {
      g.exits.forEach(t=>targetSet.add(g.idx(t.x,t.z)));
    }
    // 简单二叉堆
    const heap = [];
    const push = (d,i)=>{ heap.push([d,i]); let c=heap.length-1; while(c>0){ const p=(c-1)>>1; if(heap[p][0]<=heap[c][0]) break; [heap[p],heap[c]]=[heap[c],heap[p]]; c=p; } };
    const pop = ()=>{ const top=heap[0]; const last=heap.pop(); if(heap.length){ heap[0]=last; let c=0; for(;;){ const l=c*2+1,r=l+1; let s=c; if(l<heap.length&&heap[l][0]<heap[s][0]) s=l; if(r<heap.length&&heap[r][0]<heap[s][0]) s=r; if(s===c) break; [heap[s],heap[c]]=[heap[c],heap[s]]; c=s; } } return top; };
    push(0,start);
    let found = -1;
    while(heap.length){
      const [d,u] = pop();
      if(visited[u]) continue;
      visited[u] = 1;
      if(targetSet.has(u)){ found=u; break; }
      const ux = u%W, uz = (u/W)|0;
      for(let k=0;k<4;k++){
        const nx = ux+this._dirs[k][0], nz = uz+this._dirs[k][1];
        if(!g.isWalkable(nx,nz)) continue;
        const v = g.idx(nx,nz);
        if(visited[v]) continue;
        const nd = d + g.cost(nx,nz);
        if(nd < dist[v]){
          dist[v] = nd;
          prev[v] = u;
          push(nd, v);
        }
      }
    }
    if(found<0) return null;
    const path = [];
    let cur = found;
    while(cur>=0){
      path.push({x: cur%W, z: (cur/W)|0});
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }

  // 刷新所有入口路线
  refreshRoutes(){
    const g = this.grid;
    this.routes = {};
    let ok = true;
    for(const e of g.entries){
      const p = this.findPath(e.x, e.z);
      if(p){ this.routes[e.id] = p; }
      else { this.routes[e.id] = null; ok = false; }
    }
    this.routeVersion++;
    return ok;
  }

  // 检查连通性：所有入口有路，且给定位置（场上地面敌人）有路
  checkConnectivity(extraPositions){
    const g = this.grid;
    for(const e of g.entries){
      const p = this.findPath(e.x, e.z);
      if(!p || p.length<2) return {ok:false, entry:e.id};
    }
    if(extraPositions){
      for(const pos of extraPositions){
        const gx = Math.round(pos.x), gz = Math.round(pos.z);
        const p = this.findPath(gx, gz);
        if(!p || p.length<2) return {ok:false, pos:{x:gx,z:gz}};
      }
    }
    return {ok:true};
  }

  // 从某格到出口
  pathFrom(x,z){ return this.findPath(x,z); }

  // 世界坐标路径（用于敌人移动）
  worldPath(gridPath){
    const g = this.grid;
    return gridPath.map(p=>{
      const w = g.toWorld(p.x,p.z);
      return {x:w.x, y:0, z:w.z, gx:p.x, gz:p.z};
    });
  }

  // 路线预览：模拟隔离某格后的新路线
  previewIsolate(x, z){
    const g = this.grid;
    const i = g.idx(x,z);
    const oldBlocked = g.blocked[i];
    g.blocked[i] = 1;
    const result = {};
    for(const e of g.entries){
      result[e.id] = this.findPath(e.x, e.z);
    }
    // 检查场上敌人
    let enemiesOk = true;
    if(G.game && G.game.enemies){
      for(const en of G.game.enemies){
        if(en.flying) continue;
        const gx = en.gx, gz = en.gz;
        const p = this.findPath(gx,gz);
        if(!p){ enemiesOk = false; break; }
      }
    }
    g.blocked[i] = oldBlocked;
    let anyChanged = false;
    for(const id in result){
      const oldP = this.routes[id];
      const newP = result[id];
      if(!newP){ return {ok:false, reason:'entry_cut', entry:id, routes:result}; }
      if(!oldP || !newP || oldP.length!==newP.length || (oldP.length>1 && (oldP[1].x!==newP[1].x || oldP[1].z!==newP[1].z))){
        // 深比较前几步
        const diff = !oldP || !newP || oldP.length!==newP.length || oldP.some((p,i)=>!newP[i]||p.x!==newP[i].x||p.z!==newP[i].z);
        if(diff) anyChanged = true;
      }
    }
    if(!enemiesOk) return {ok:false, reason:'enemy_cut', routes:result};
    return {ok:true, routes:result, changed:anyChanged};
  }
}

G.Router = Router;

})();
