/* maps.js — 三张地图定义（程序化构建） */
(function(){
'use strict';
const G = window.G;
const TILE = G.TILE;

function buildMap(w, h, spec){
  const grid = new G.Grid(w, h);
  const entries = [], exits = [], namedNodes = [];
  const typeMap = {
    link:TILE.LINK, node:TILE.NODE, plat:TILE.PLATFORM, old:TILE.OLDLINK,
    entry:TILE.ENTRY, exit:TILE.EXIT, obs:TILE.OBSTACLE, decor:TILE.DECOR
  };
  const hMap = { link:0.12, node:0.28, plat:0.42, old:0.10, entry:0.18, exit:0.22, obs:0.55, decor:0.35 };
  // 允许后面覆盖前面（命名节点在线段之后 push）
  (spec.walk||[]).forEach(t=>{
    const ty = typeMap[t.t];
    if(ty===undefined) return;
    grid.set(t.x, t.z, ty);
    grid.setHeight(t.x, t.z, hMap[t.t]||0);
    if(t.t==='entry') entries.push({x:t.x, z:t.z, id:t.id});
    if(t.t==='exit') exits.push({x:t.x, z:t.z, id:t.id});
    if(t.t==='node' && t.id) namedNodes.push({x:t.x, z:t.z, id:t.id, name:t.name||t.id});
  });
  // 去重 entries/exits
  const entryMap = new Map();
  entries.forEach(e=>{ if(!entryMap.has(e.id)) entryMap.set(e.id, e); });
  entries.length = 0;
  entryMap.forEach(e=>entries.push(e));
  const exitMap = new Map();
  exits.forEach(e=>{ if(!exitMap.has(e.id)) exitMap.set(e.id, e); });
  exits.length = 0;
  exitMap.forEach(e=>exits.push(e));

  grid.entries = entries;
  grid.exits = exits;
  grid.namedNodes = namedNodes;
  grid.meta = {theme: spec.theme, id: spec.id};
  return { grid, id: spec.id, theme: spec.theme };
}

function hLine(arr, x1, x2, z, t){
  for(let x=Math.min(x1,x2); x<=Math.max(x1,x2); x++) arr.push({x, z, t});
}
function vLine(arr, x, z1, z2, t){
  for(let z=Math.min(z1,z2); z<=Math.max(z1,z2); z++) arr.push({x, z, t});
}

// =====================================================
// 地图 1：分段内网
// A(2,1)→N1(7,1)→N2(12,1)→N5(17,1)→N4(17,6)→X(18,6)  [A 默认路]
// B(2,11)→N3(5,6)→DMZ→N4(17,6)→X(18,6)               [B 默认路]
// 左环 col0→row12→col19→X  右环 row1→col19→X          [N4 隔离时]
// =====================================================
function buildMap1(){
  const w = [];
  // 入口/出口
  w.push({x:2, z:1, t:'entry', id:'A'});
  w.push({x:2, z:11, t:'entry', id:'B'});
  w.push({x:18, z:6, t:'exit', id:'X'});

  // 办公走廊 row 1: A→N1→N2→N5
  for(let x=3; x<=19; x++){
    if(x===7) w.push({x,z:1,t:'node',id:'N1',name:'西边界节点'});
    else if(x===12) w.push({x,z:1,t:'node',id:'N2',name:'办公汇聚节点'});
    else if(x===17) w.push({x,z:1,t:'node',id:'N5',name:'灾备环节点'});
    else w.push({x,z:1,t:'link'});
  }

  // N1 竖线 col 7 → DMZ
  vLine(w, 7, 2, 6, 'link');
  // N2 竖线 col 12 → DMZ
  vLine(w, 12, 2, 6, 'link');

  // A 南下竖线 col 3 (A 改道时走)
  vLine(w, 3, 2, 11, 'link');

  // DMZ 走廊 row 6: col3→col17, 含 N3 和旧链路
  for(let x=4; x<=17; x++){
    if(x===5) w.push({x,z:6,t:'node',id:'N3',name:'DMZ互联节点'});
    else if(x===17) w.push({x,z:6,t:'node',id:'N4',name:'核心前置节点'});
    else if(x>=13 && x<=14) w.push({x,z:6,t:'old'});
    else w.push({x,z:6,t:'link'});
  }

  // 业务走廊 row 11: B→东（含旧链路使 DMZ 路线更优）
  for(let x=3; x<=19; x++){
    if(x>=8 && x<=13) w.push({x, z:11, t:'old'});
    else w.push({x, z:11, t:'link'});
  }
  // 业务→DMZ 竖线 col 5
  vLine(w, 5, 7, 10, 'link');
  // 旧链路竖线 col 10 (连接办公与业务)
  vLine(w, 10, 2, 5, 'old');
  vLine(w, 10, 7, 10, 'old');

  // 左环 col 0
  w.push({x:0, z:1, t:'link'});
  vLine(w, 0, 2, 12, 'link');
  // 左环底 row 12
  hLine(w, 1, 19, 12, 'link');
  // 右环 col 19
  vLine(w, 19, 2, 10, 'link');

  // N5 竖线 col 17 → N4
  vLine(w, 17, 2, 5, 'link');
  // col 17 row 7-10 (N4 下方，到 row 11)
  vLine(w, 17, 7, 11, 'link');

  // X 仅从 N4(17,6) 直连或从右环 (19,6) 进入
  w.push({x:19, z:6, t:'link'});

  // 平台
  [[5,2],[5,4],[9,2],[9,4],[15,2],[15,4],[2,7],[2,9],[16,8],[16,10],[4,8],[4,10]]
    .forEach(([x,z])=>w.push({x,z,t:'plat'}));

  // 障碍
  [[4,3],[14,3],[1,5],[1,8],[20,3],[20,8],[6,9],[16,4]].forEach(([x,z])=>w.push({x,z,t:'obs'}));

  return buildMap(22, 15, {id:'map1', theme:'corp', walk:w});
}

// =====================================================
// 地图 2：骨干流域
// A(2,1)→N1(8,1)→N3(8,4)→N5(17,5)→X(19,5)   [A 默认]
// C(2,7)→N2(7,7)→N5(17,5)→X(19,5)            [C 默认]
// B(2,13)→N4(8,13)→N6(17,11)→Y(19,11)        [B 默认]
// 隔离 N2 → C、B 改走另一 DC
// =====================================================
function buildMap2(){
  const w = [];
  w.push({x:2, z:1, t:'entry', id:'A'});
  w.push({x:2, z:7, t:'entry', id:'C'});
  w.push({x:2, z:13, t:'entry', id:'B'});
  w.push({x:19, z:5, t:'exit', id:'X'});
  w.push({x:19, z:11, t:'exit', id:'Y'});

  // 上走廊 row 1: A→N1→右
  for(let x=3; x<=18; x++){
    if(x===8) w.push({x,z:1,t:'node',id:'N1',name:'互联网汇聚节点'});
    else w.push({x,z:1,t:'link'});
  }
  // 中走廊 row 7: C→N2→右 (含旧链路)
  for(let x=3; x<=18; x++){
    if(x===7) w.push({x,z:7,t:'node',id:'N2',name:'专线汇流节点'});
    else if(x>=12 && x<=13) w.push({x,z:7,t:'old'});
    else w.push({x,z:7,t:'link'});
  }
  // 下走廊 row 13: B→N4→右（含旧链路使 N6 路线更优）
  for(let x=3; x<=18; x++){
    if(x===8) w.push({x,z:13,t:'node',id:'N4',name:'旧专线节点'});
    else if(x>=11 && x<=15) w.push({x,z:13,t:'old'});
    else w.push({x,z:13,t:'link'});
  }

  // col 3 入口区竖线（旧链路使 N1 路线更优）
  for(let z=2; z<=6; z++) w.push({x:3, z, t:'old'});
  vLine(w, 3, 8, 12, 'link');

  // col 8: N1→N3(公网跨越)→中走廊（主竖线）
  vLine(w, 8, 2, 6, 'link');
  w.push({x:8, z:4, t:'node', id:'N3', name:'公网跨越节点'});
  // col 8 中→下 (N4 上方)
  vLine(w, 8, 8, 12, 'link');

  // col 7: N2 竖线仅下段（上段移除使 N3 必经）
  vLine(w, 7, 8, 12, 'link');

  // 右侧到 DC: col 17  vLine(w, 17, 2, 4, 'link');
  w.push({x:17, z:5, t:'node', id:'N5', name:'DC-X前置节点'});
  vLine(w, 17, 6, 10, 'link');
  w.push({x:17, z:11, t:'node', id:'N6', name:'DC-Y前置节点'});
  vLine(w, 17, 12, 13, 'link');

  // DC 连接
  w.push({x:18, z:5, t:'link'});
  w.push({x:18, z:11, t:'link'});
  w.push({x:19, z:4, t:'link'});
  w.push({x:19, z:6, t:'link'});
  w.push({x:19, z:10, t:'link'});
  // Y 只从 N6(17,11)→(18,11)→(19,11) 进入
  w.push({x:19, z:11, t:'exit', id:'Y'});

  // 旧专线竖线 col 7 下段（C、B 汇流旧链路）
  w.push({x:7, z:10, t:'old'});
  w.push({x:7, z:11, t:'old'});

  // 公网流障碍（横贯战场中部）
  for(let x=10; x<=15; x++){
    w.push({x, z:4, t:'obs'});
    w.push({x, z:10, t:'obs'});
  }

  // 左环 col 0 → row 14 → 右
  w.push({x:0, z:1, t:'link'});
  vLine(w, 0, 2, 14, 'link');
  hLine(w, 1, 19, 14, 'link');
  vLine(w, 19, 13, 14, 'link');

  // 右环 col 19
  vLine(w, 19, 2, 3, 'link');
  vLine(w, 19, 7, 9, 'link');
  vLine(w, 19, 13, 13, 'link');

  // 平台
  [[5,2],[5,6],[5,8],[5,12],[10,2],[10,6],[10,8],[10,12],[14,2],[14,6],[14,8],[14,12],[18,3],[18,13]]
    .forEach(([x,z])=>w.push({x,z,t:'plat'}));

  return buildMap(22, 15, {id:'map2', theme:'back', walk:w});
}

// =====================================================
// 地图 3：气隙深层
// 运维环：上弧 row1 / 下弧 row13 / 左 col2 / 右 col17
// 内环：col5 / col14 / row7(旧总线)
// A(2,1)→N1(8,1)→N5(17,4)→X(18,4)  [A 默认]
// C(2,7)→N4(5,7)→N7(10,7)→N2(14,4)→N5→X  [C 默认 经总线]
// B(2,13)→N3(8,13)→N6(17,10)→Y(18,10)  [B 默认]
// =====================================================
function buildMap3(){
  const w = [];
  w.push({x:2, z:1, t:'entry', id:'A'});
  w.push({x:2, z:7, t:'entry', id:'C'});
  w.push({x:2, z:13, t:'entry', id:'B'});
  w.push({x:18, z:4, t:'exit', id:'X'});
  w.push({x:18, z:10, t:'exit', id:'Y'});

  // 上弧 row 1: A→N1→右
  for(let x=3; x<=17; x++){
    if(x===8) w.push({x,z:1,t:'node',id:'N1',name:'北环节点'});
    else w.push({x,z:1,t:'link'});
  }
  // 下弧 row 13: B→N3→右
  for(let x=3; x<=17; x++){
    if(x===8) w.push({x,z:13,t:'node',id:'N3',name:'南环节点'});
    else w.push({x,z:13,t:'link'});
  }
  // 左环 col 2
  vLine(w, 2, 2, 12, 'link');
  // 右环 col 17
  vLine(w, 17, 2, 12, 'link');

  // 左内通道 col 5: row1→row13
  vLine(w, 5, 2, 12, 'link');
  w.push({x:5, z:7, t:'node', id:'N4', name:'西环节点'});

  // 右内通道 col 14: row1→row13
  vLine(w, 14, 2, 12, 'link');
  w.push({x:14, z:4, t:'node', id:'N2', name:'东环节点'});

  // 老工控总线 row 7: col3→col14 (慢速支路，连接 C 入口)
  w.push({x:3, z:7, t:'link'});
  w.push({x:4, z:7, t:'link'});
  for(let x=5; x<=14; x++){
    if(x===5) w.push({x,z:7,t:'node',id:'N4',name:'西环节点'});
    else if(x===10) w.push({x,z:7,t:'node',id:'N7',name:'总线节点'});
    else if(x===14) w.push({x,z:7,t:'link'});
    else w.push({x,z:7,t:'old'});
  }

  // N5 at (17,4) X前置, N6 at (17,10) Y前置
  w.push({x:17, z:4, t:'node', id:'N5', name:'X前置节点'});
  w.push({x:17, z:10, t:'node', id:'N6', name:'Y前置节点'});

  // 连接 N2→N5 和 N6 侧通道
  w.push({x:15, z:4, t:'link'});
  w.push({x:16, z:4, t:'link'});
  w.push({x:15, z:10, t:'link'});
  w.push({x:16, z:10, t:'link'});

  // X/Y 连接（旁路设为旧链路使 N5/N6 必经）
  w.push({x:18, z:3, t:'old'});
  w.push({x:18, z:5, t:'link'});
  w.push({x:18, z:9, t:'link'});
  w.push({x:18, z:11, t:'old'});

  // 中央气隙（不可通行）
  for(let x=8; x<=11; x++){
    for(let z=3; z<=5; z++) w.push({x,z,t:'obs'});
  }
  for(let x=8; x<=11; x++){
    for(let z=9; z<=11; z++) w.push({x,z,t:'obs'});
  }

  // 平台
  [[4,3],[4,11],[6,3],[6,11],[12,3],[12,11],[15,3],[15,11],[16,7],[2,4],[7,2],[7,12]]
    .forEach(([x,z])=>w.push({x,z,t:'plat'}));

  return buildMap(22, 15, {id:'map3', theme:'ics', walk:w});
}

// 构建
const MAPS = {};
MAPS.map1 = buildMap1();
MAPS.map2 = buildMap2();
MAPS.map3 = buildMap3();

// 元数据
const META = {
  map1: {
    name:'分段内网', subtitle:'企业网 · DMZ 与灾备环', waves:14,
    desc:'入口 A「门户网站」和 B「邮件网关」接入 DMZ，南端是出口「核心数据库」。办公网段与业务网段通过 DMZ 互联和一段旧链路相连，外围的旧系统网段与灾备环也能绕到核心。隔离西边界节点，A 改走 DMZ 互联与 B 汇流；隔离核心前置节点，流量转向两侧外环。',
    entryNames:{A:'门户网站', B:'邮件网关'},
    exitNames:{X:'核心数据库'},
    entryColors:{A:0x33aaff, B:0x33ffaa},
    exitColors:{X:0x44ffcc}
  },
  map2: {
    name:'骨干流域', subtitle:'跨网专线 · 双活数据中心', waves:15,
    desc:'入口 A「互联网」、C「分支专线」、B「云端互联」通向互为备份的数据中心 X、Y。公网流横贯战场，专线隧道与旧专线构成不同的跨越点。C、B 平时经旧专线汇流，隔离汇聚节点能把它们导向另一座数据中心，也会改变与 A 的交战分布。',
    entryNames:{A:'互联网', B:'云端互联', C:'分支专线'},
    exitNames:{X:'数据中心 X', Y:'数据中心 Y'},
    entryColors:{A:0x33aaff, B:0x33ffaa, C:0xffaa33},
    exitColors:{X:0x44ffcc, Y:0x88ffaa}
  },
  map3: {
    name:'气隙深层', subtitle:'工控网 · 气隙与运维环', waves:16,
    desc:'入口 A「运维跳板机」、B「办公网下行」、C「供应商远程维护」围绕中央气隙接入，出口是「过程控制核心」X 和「安全联锁核心」Y。运维环绕过气隙连通南北，老工控总线组成较慢的支路。隔离运维环上的不同节点，会让入侵流量在两侧狭窄通道间转移，两个核心的防守相互牵制。',
    entryNames:{A:'运维跳板机', B:'办公网下行', C:'供应商远程维护'},
    exitNames:{X:'过程控制核心', Y:'安全联锁核心'},
    entryColors:{A:0x33aaff, B:0x33ffaa, C:0xffaa33},
    exitColors:{X:0x44ffcc, Y:0x88ffaa}
  }
};

for(const k in MAPS){
  const m = MAPS[k];
  Object.assign(m, META[k]);
  m.nodeByName = {};
  (m.grid.namedNodes||[]).forEach(n=>{
    m.nodeByName[n.id] = n;
  });
}

G.MAPS = MAPS;
G.MAP_LIST = [MAPS.map1, MAPS.map2, MAPS.map3];

})();
