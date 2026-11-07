/* util.js — 数学工具、随机数、通用助手 */
(function(){
'use strict';
const G = window.G = window.G || {};

// ---------- 随机（可播种，保证 videoExport 确定性） ----------
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
G.RNG = {
  _fn: mulberry32(123456789),
  seed(s){ this._fn = mulberry32(s); },
  next(){ return this._fn(); },
  range(a,b){ return a + (b-a) * this._fn(); },
  int(a,b){ return Math.floor(this.range(a, b+1)); },
  pick(arr){ return arr[Math.floor(this._fn()*arr.length) % arr.length]; },
  chance(p){ return this._fn() < p; },
  shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(this._fn()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
};

// ---------- 数学 ----------
const M = G.M = {
  clamp(v,a,b){ return v<a?a:(v>b?b:v); },
  lerp(a,b,t){ return a+(b-a)*t; },
  damp(a,b,lambda,dt){ return M.lerp(a,b,1-Math.exp(-lambda*dt)); },
  dist2(ax,az,bx,bz){ const dx=ax-bx,dz=az-bz; return dx*dx+dz*dz; },
  dist(ax,az,bx,bz){ return Math.sqrt(M.dist2(ax,az,bx,bz)); },
  dist3(ax,ay,az,bx,by,bz){ const dx=ax-bx,dy=ay-by,dz=az-bz; return Math.sqrt(dx*dx+dy*dy+dz*dz); },
  angleLerp(a,b,t){
    let d = b-a;
    while(d>Math.PI) d-=Math.PI*2;
    while(d<-Math.PI) d+=Math.PI*2;
    return a+d*t;
  },
  easeOutCubic(t){ return 1-Math.pow(1-t,3); },
  easeInOutCubic(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; },
  easeOutBack(t){ const c1=1.70158,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); },
  easeOutElastic(t){
    if(t===0||t===1) return t;
    return Math.pow(2,-10*t)*Math.sin((t*10-0.75)*(2*Math.PI/3))+1;
  }
};

// ---------- 网格方向 ----------
G.DIR4 = [[1,0],[-1,0],[0,1],[0,-1]];
G.DIR8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

// ---------- 瓦片类型 ----------
G.TILE = {
  VOID: 0,      // 虚空/障碍
  LINK: 1,      // 链路
  NODE: 2,      // 交换节点
  PLATFORM: 3,  // 设备平台
  OLDLINK: 4,   // 旧链路
  ENTRY: 5,     // 入口
  EXIT: 6,      // 出口（中枢）
  OBSTACLE: 7,  // 障碍（数据设施/公网流/气隙）
  DECOR: 8      // 装饰（不可通行不可部署）
};

// ---------- 塔类型 ----------
G.TOWER = {
  FIREWALL:'firewall',   // 防火墙
  HONEYPOT:'honeypot',   // 蜜罐
  GATE:'gate',           // 网闸
  INTERCEPTOR:'interceptor', // 拦截器
  SANDBOX:'sandbox',     // 沙箱
  REPAIR:'repair'        // 修复进程
};

// ---------- 敌人类型 ----------
G.ENEMY = {
  WORM:'worm', FLOOD:'flood', TROJAN:'trojan',
  RANSOM:'ransom', HOTSPOT:'hotspot', PACKER:'packer',
  BOSS_KUI:'boss_kui', BOSS_LOU:'boss_lou', BOSS_YING:'boss_ying'
};

// ---------- 资源/状态 ----------
G.STATUS = { DETECT:'detect', SHIELD:'shield', ENCRYPT:'encrypt', SLOW:'slow', REVEAL:'reveal', TRAP:'trap' };

// ---------- 工具 ----------
G.util = {
  fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec/60), s = sec%60;
    return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
  },
  fmtNum(n){ return Math.floor(n).toLocaleString('zh-CN'); },
  el(id){ return document.getElementById(id); },
  show(id, on){ const e=typeof id==='string'?G.util.el(id):id; if(e) e.classList.toggle('hidden', !on); },
  on(el, ev, fn){ if(el) el.addEventListener(ev, fn); },
  qsa(sel){ return Array.from(document.querySelectorAll(sel)); },
  // 颜色
  hex(h){ return new THREE.Color(h); },
  // 简单事件总线
  _bus:{},
  emit(ev, data){ (this._bus[ev]||[]).forEach(f=>f(data)); },
  onBus(ev, fn){ (this._bus[ev]=this._bus[ev]||[]).push(fn); return ()=>{ this._bus[ev]=(this._bus[ev]||[]).filter(x=>x!==fn); }; }
};

// ---------- 配置 ----------
G.CFG = {
  simHz: 60,                 // 逻辑帧率
  tileSize: 2.0,             // 每格世界尺寸
  integrityMax: 120,
  startComp: 350,
  startIntel: 50,
  compPerSecond: 3.5,
  towerSellRatio: 0.6,
  nodeReisolateDelay: 4.0,   // 恢复直通后再次隔离间隔（秒）
  version: '1.0.0'
};

// ---------- 塔数据 ----------
G.TOWER_DATA = {
  firewall: {
    name:'防火墙', role:'阻挡 · 链路/节点', icon:'墙',
    color:0xff7744, accent:0xffaa55,
    cost:60, hp:380, dmg:22, range:2.5, attackRate:1.1, block:4,
    desc:'承受近战攻击，在链路上拦住有限数量的敌人并还击。在节点上部署时隔离节点，并拦截相邻链路上的敌人。',
    upCost:70, upIntel:2,
    levels:[
      {hp:380,dmg:22,block:4,range:2.5,attackRate:1.1},
      {hp:620,dmg:38,block:6,range:3.0,attackRate:1.25}
    ],
    branches: null
  },
  honeypot: {
    name:'蜜罐', role:'诱敌阻挡 · 仅链路', icon:'蜜',
    color:0xb06cff, accent:0xd8a0ff,
    cost:50, hp:220, dmg:8, range:3.2, attackRate:0.8, block:2, lureRange:5.0,
    desc:'以伪造应答吸引附近会攻击塔的地面敌人，替其他塔承担攻击；耐久较低，但不会被加密。主动技能「诱捕」能困住被诱来的敌人。',
    upCost:55, upIntel:2,
    levels:[
      {hp:220,dmg:8,block:2,range:3.2,attackRate:0.8,lureRange:5.0},
      {hp:340,dmg:14,block:3,range:3.6,attackRate:0.9,lureRange:6.2}
    ],
    branches:[
      {id:'deep', name:'深度诱捕', desc:'诱捕持续更久并造成伤害，诱捕范围+25%'},
      {id:'reflect', name:'镜像反射', desc:'被攻击时反弹部分伤害，护盾吸收一次致命伤'}
    ]
  },
  gate: {
    name:'网闸', role:'隔离 · 仅节点', icon:'闸',
    color:0x3aa0ff, accent:0x80c8ff,
    cost:35, hp:420, dmg:0, range:0, attackRate:0, block:0,
    desc:'低成本隔离节点，耐久较高，不攻击。它的用途是控制道路，仍会受到敌人的攻击和破坏。',
    upCost:40, upIntel:1,
    levels:[
      {hp:420},
      {hp:680}
    ],
    branches: null
  },
  interceptor: {
    name:'拦截器', role:'远程 · 平台 · 有朝向', icon:'拦',
    color:0x37d8ff, accent:0x7fe9ff,
    cost:80, hp:280, dmg:38, range:8, attackRate:1.3, block:0,
    desc:'在朝向决定的攻击区域内进行远程单体攻击，地面与飞行敌人都能打。两个升级分支分别围绕贯穿攻击和压制减速展开。',
    upCost:90, upIntel:3,
    levels:[
      {hp:280,dmg:38,range:8,attackRate:1.3,arc:Math.PI*0.85},
      {hp:420,dmg:58,range:10,attackRate:1.5,arc:Math.PI*0.95}
    ],
    branches:[
      {id:'pierce', name:'贯穿弹头', desc:'弹头贯穿直线上的后续目标，伤害递减'},
      {id:'suppress', name:'压制弹幕', desc:'命中减速目标，叠加压制层数并扩大扇形'}
    ]
  },
  sandbox: {
    name:'沙箱', role:'检测与范围攻击 · 平台', icon:'箱',
    color:0x4dff9a, accent:0xa0ffc0,
    cost:75, hp:320, dmg:24, range:5, attackRate:0.85, block:0,
    desc:'检测范围内伪装或潜伏的目标，使其显形，并对地面敌人进行范围攻击，适合处理汇聚的流量。',
    upCost:85, upIntel:2,
    levels:[
      {hp:320,dmg:24,range:5,attackRate:0.85,detectRange:6},
      {hp:480,dmg:42,range:6,attackRate:1.0,detectRange:8}
    ],
    branches: null
  },
  repair: {
    name:'修复进程', role:'专职治疗 · 平台', icon:'修',
    color:0xffe066, accent:0xfff0a0,
    cost:70, hp:300, dmg:0, range:6, attackRate:0, healRate:28, block:0,
    desc:'不攻击敌人，持续恢复范围内其他受损塔的生命。主动技能「冗余切换」为附近友塔提供护盾并解除加密，使关键节点的防守能够维持。',
    upCost:80, upIntel:2,
    levels:[
      {hp:300,healRate:28,range:6},
      {hp:460,healRate:50,range:8}
    ],
    branches: null
  }
};

// ---------- 敌人数据 ----------
G.ENEMY_DATA = {
  worm: {
    name:'蠕虫', icon:'虫', color:0x66ee44, accent:0xaaff66,
    hp:55, speed:1.8, bounty:15, intel:1, dmg:12, attackRate:1.0,
    radius:0.35, flying:false, camo:false, blockCost:1,
    desc:'被阻挡时持续攻击挡住它的塔；首次经过直通的交换节点时复制出同伴，复制出的不再复制。'
  },
  flood: {
    name:'洪泛团', icon:'洪', color:0xff4455, accent:0xff8866,
    hp:220, speed:1.3, bounty:30, intel:2, dmg:28, attackRate:0.7,
    radius:0.55, flying:false, camo:false, blockCost:3,
    desc:'占用较多阻挡容量。会离开当前行进路线，向附近被隔离节点的可通行一侧移动，重击节点上的塔或隔离器；打通后沿重新开放的道路前进。'
  },
  trojan: {
    name:'木马', icon:'木', color:0x88aacc, accent:0xccddee,
    hp:95, speed:2.3, bounty:20, intel:2, dmg:12, attackRate:1.2,
    radius:0.38, flying:false, camo:true, blockCost:1,
    desc:'伪装成正常封装数据包，显形前不能被远程单体攻击主动选中；沙箱检测、旧链路和阻挡会使其显形。未显形就被攻击波及消灭时释放载荷，伤害附近的塔。'
  },
  ransom: {
    name:'勒索者', icon:'勒', color:0xcc2244, accent:0xff6688,
    hp:170, speed:1.7, bounty:35, intel:3, dmg:18, attackRate:0.6, attackRange:4.5,
    radius:0.42, flying:false, camo:false, blockCost:2,
    desc:'边移动边从远处攻击射程内的塔，包括平台上的塔，造成伤害并施加加密；会优先攻击射程内的蜜罐。'
  },
  hotspot: {
    name:'伪热点', icon:'伪', color:0xffcc33, accent:0xffee88,
    hp:80, speed:2.8, bounty:18, intel:2, dmg:0, attackRate:0,
    radius:0.4, flying:true, camo:false, blockCost:0,
    desc:'沿无线层从入口直飞出口，不受地面道路和阻挡影响，由拦截器对付。'
  },
  packer: {
    name:'加壳器', icon:'壳', color:0x7788aa, accent:0xaabbdd,
    hp:150, speed:1.5, bounty:28, intel:2, dmg:12, attackRate:1.0, shieldRange:3.5, shieldAmt:60,
    radius:0.48, flying:false, camo:false, blockCost:2,
    desc:'为附近同伴提供可被打破的护盾，保护成群敌人推进，迫使玩家考虑先处理支援者还是集中攻击前排。'
  },
  boss_kui: {
    name:'万傀', icon:'傀', color:0xff6622, accent:0xffaa44,
    hp:4200, speed:1.15, bounty:200, intel:12, dmg:70, attackRate:0.8,
    radius:1.1, flying:false, camo:false, blockCost:8,
    desc:'僵尸网络的群体控制者。「洪峰」冲击被隔离节点，重创塔并冲毁隔离器；生命降低后释放成群蠕虫。'
  },
  boss_lou: {
    name:'蜃楼', icon:'蜃', color:0x66ddff, accent:0xaaeeff,
    hp:4800, speed:1.25, bounty:220, intel:12, dmg:55, attackRate:0.7, attackRange:5.5,
    radius:1.15, flying:false, camo:false, blockCost:8,
    desc:'路由欺骗者。「伪路由」在前方链路制造临时路由黑洞，截断通行、迫使改道；生命降低后发动「路由风暴」，削弱附近塔的护盾。'
  },
  boss_ying: {
    name:'蛰影', icon:'蛰', color:0x9944ff, accent:0xcc88ff,
    hp:5200, speed:1.35, bounty:250, intel:14, dmg:60, attackRate:0.75,
    radius:1.2, flying:false, camo:true, blockCost:8,
    desc:'攻击组织核心威胁。按「潜伏—提权—破坏」改变阶段：潜伏时需检测才能被远程单体攻击选中，提权后强化护甲并放出木马，破坏阶段锁死前方一段运维环。'
  }
};

// ---------- 道具数据 ----------
G.ITEM_DATA = {
  isolator: {
    name:'应急隔离器', icon:'隔', costType:'intel', cost:8, cooldown:12,
    desc:'临时隔离一个直通节点，有耐久和有效期，会被敌人冲毁，不产生情报。'
  },
  downgrade: {
    name:'协议降级', icon:'降', costType:'intel', cost:10, cooldown:16,
    desc:'让一片链路暂时使用旧协议，产生旧链路的减速和显形效果，敌人的路线随通行速度变化重新选择。'
  },
  restore: {
    name:'备份还原', icon:'备', costType:'comp', cost:45, cooldown:10,
    desc:'恢复一座塔的部分生命并解除加密。'
  }
};

})();
