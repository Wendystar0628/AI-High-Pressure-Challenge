/* =========================================================================
   动态路由塔防 · 数据层
   地图 / 波次 / 塔 / 敌人 / 道具 / 图鉴文本
   ========================================================================= */
(function (global) {
  'use strict';

  const CELL = 4;              // 世界单位 / 格
  const FIXED_DT = 1 / 60;     // 固定逻辑步长
  const START_INTEGRITY = 100;

  /* ------------------------------------------------------------------ *
   *  地图
   * ------------------------------------------------------------------ */
  const MAPS = [
    {
      id: 'segment', code: 'SEG-01', name: '分段内网', short: '企业内网',
      subtitle: '企业内网 · 14 波 · DMZ 与旧系统网段',
      desc: '门户与邮件网关接入 DMZ，办公网段、业务网段和外围旧系统网段与灾备环共同连接南端的核心数据库。西边界节点与核心前节点是两条关键的改道杠杆。',
      difficulty: '标准', waves: 14,
      theme: {
        bg: 0x040811, fog: 0x061420, fogDensity: 0.0042,
        key: 0x9fdcff, fill: 0x1b3c58, rim: 0x32e6c0,
        road: 0x123044, roadEdge: 0x2bd8d0, plat: 0x14283c,
        zone: { dmz: 0x12364d, office: 0x23304b, business: 0x2a2340, core: 0x0e3136, dr: 0x1c2e26, old: 0x3a2620 },
        accent: '#3ee9d0', accent2: '#65a9ff', hazard: '#ff5f7e',
        grid: 0x1c6f78, glows: [0x2ee6cf, 0x4f9dff, 0xffd06a]
      },
      startCompute: 420, startIntel: 65,
      // 传送门在边缘，朝向向外
      entrances: [
        { id: 'A', x: 0, y: 3, name: '门户网站', code: 'GATE-A', color: '#4fe3ff', dir: [-1, 0] },
        { id: 'B', x: 9, y: 0, name: '邮件网关', code: 'GATE-B', color: '#ffca6a', dir: [0, -1] }
      ],
      exits: [
        { id: 'X', x: 9, y: 13, name: '核心数据库', code: 'CORE-X', color: '#a8ffe2' }
      ],
      switches: [
        { id: 'SW1', x: 5, y: 5, name: '西边界互联', code: 'SW-01', note: '隔离后门户流量折向 DMZ 互联' },
        { id: 'SW2', x: 9, y: 5, name: 'DMZ 汇聚', code: 'SW-02', note: 'DMZ 南北向汇聚点' },
        { id: 'SW3', x: 9, y: 8, name: '核心中继', code: 'SW-03', note: '核心前的主干中继' },
        { id: 'SW4', x: 9, y: 10, name: '核心前置', code: 'SW-04', note: '隔离后流量转向两侧外环' },
        { id: 'SW5', x: 9, y: 12, name: '中枢闸口', code: 'SW-05', note: '核心数据库最后一道交换闸口' }
      ],
      zones: [
        { x1: 5, y1: 2, x2: 14, y2: 5, id: 'dmz' },
        { x1: 1, y1: 5, x2: 8, y2: 9, id: 'office' },
        { x1: 10, y1: 5, x2: 16, y2: 9, id: 'business' },
        { x1: 2, y1: 10, x2: 16, y2: 14, id: 'core' }
      ],
      rows: [
        "#########B#########",
        "#########.#########",
        "#####..........####",
        "Ao....###.####.#..#",
        "#o.#P.#P#.#P#P.#.o#",
        "#o...............o#",
        "#o.#####...###.#.o#",
        "#o.#P##P...P##.#.o#",
        "#o.#####...###.#.o#",
        "#o.o..............#",
        "#o#o#..........##o#",
        "#o#ooo#P#.#P#.P##o#",
        "#ooooo.......ooooo#",
        "#####....X....#####",
        "###################"
      ]
    },
    {
      id: 'backbone', code: 'BB-02', name: '骨干流域', short: '跨网专线',
      subtitle: '跨网专线与双活数据中心 · 15 波',
      desc: '互联网、云端互联与分支专线三路流量跨过横贯战场的公网流，汇入互为备份的数据中心 X / Y。旧专线在下方穿过，双活汇流点一旦被隔离，B、C 会被导向另一座数据中心。',
      difficulty: '进阶', waves: 15,
      theme: {
        bg: 0x070612, fog: 0x130b24, fogDensity: 0.0040,
        key: 0xc6b4ff, fill: 0x2a1d4f, rim: 0x7e6bff,
        road: 0x1a1838, roadEdge: 0x8b7bff, plat: 0x1b1636,
        zone: { dmz: 0x201d44, office: 0x1c2440, business: 0x2b1f3d, core: 0x1a2f39, dr: 0x262035, old: 0x3b2b21 },
        accent: '#a88bff', accent2: '#ffd479', hazard: '#ff628c',
        grid: 0x4f3a8c, glows: [0x9b7bff, 0xffce7a, 0x54e6ff]
      },
      startCompute: 440, startIntel: 70,
      entrances: [
        { id: 'A', x: 0, y: 2, name: '互联网', code: 'GATE-A', color: '#5ad8ff', dir: [-1, 0] },
        { id: 'B', x: 17, y: 2, name: '云端互联', code: 'GATE-B', color: '#cf9bff', dir: [1, 0] },
        { id: 'C', x: 17, y: 11, name: '分支专线', code: 'GATE-C', color: '#ffb86b', dir: [1, 0] }
      ],
      exits: [
        { id: 'X', x: 4, y: 13, name: '数据中心 X', code: 'DC-X', color: '#74ffd8' },
        { id: 'Y', x: 13, y: 13, name: '数据中心 Y', code: 'DC-Y', color: '#ff9bd8' }
      ],
      switches: [
        { id: 'SW1', x: 4, y: 4, name: 'X 侧隧道口', code: 'SW-11', note: '公网流西侧跨越点' },
        { id: 'SW2', x: 4, y: 9, name: 'X 汇聚节点', code: 'SW-12', note: '北向流量汇入 X 的必经点' },
        { id: 'SW3', x: 4, y: 11, name: 'X 下联', code: 'SW-13', note: '隔离后 A 可被导向 Y' },
        { id: 'SW4', x: 13, y: 4, name: 'Y 侧隧道口', code: 'SW-14', note: '公网流东侧跨越点' },
        { id: 'SW5', x: 13, y: 9, name: 'Y 汇聚节点', code: 'SW-15', note: '旧专线在此并入 Y' },
        { id: 'SW6', x: 13, y: 11, name: '双活汇流点', code: 'SW-16', note: 'B、C 经旧专线在此汇流' }
      ],
      zones: [
        { x1: 0, y1: 2, x2: 17, y2: 4, id: 'dmz' },
        { x1: 0, y1: 5, x2: 17, y2: 8, id: 'business' },
        { x1: 0, y1: 9, x2: 17, y2: 14, id: 'core' }
      ],
      rows: [
        "##################",
        "##################",
        "A................B",
        "o###.#P#.##P#.###o",
        "o#P#..........#P#o",
        "o###.###.####.###o",
        "o###.###.####.###o",
        "o###.###.####.###o",
        "o#P#.#P#.##P#.#PPo",
        "o###.........o###o",
        "o###oooooooooo#P#o",
        "o....########o...C",
        "####..........####",
        "###.X.P####P.Y.###",
        "##################"
      ]
    },
    {
      id: 'airgap', code: 'AG-03', name: '气隙深层', short: '工控网络',
      subtitle: '工控网络与中央气隙 · 16 波',
      desc: '运维跳板机、办公网下行与供应商远程维护围绕中央气隙接入。运维环绕过气隙连通南北，老工控总线组成较慢的支路。隔离运维环不同节点，会让入侵流量在两侧狭窄通道间转移，两个核心的防守彼此牵制。',
      difficulty: '专家', waves: 16,
      theme: {
        bg: 0x070805, fog: 0x11130a, fogDensity: 0.0045,
        key: 0xffe2a0, fill: 0x3c3418, rim: 0x8dffb0,
        road: 0x20241a, roadEdge: 0xb9d76a, plat: 0x24251a,
        zone: { dmz: 0x28301c, office: 0x2c2918, business: 0x23301f, core: 0x332b16, dr: 0x28331f, old: 0x3c2b1a },
        accent: '#c7f56a', accent2: '#ffd27d', hazard: '#ff7059',
        grid: 0x5b6b2c, glows: [0xc9ff6a, 0xffc46a, 0x7bffb0]
      },
      startCompute: 460, startIntel: 75,
      entrances: [
        { id: 'A', x: 0, y: 2, name: '运维跳板机', code: 'GATE-A', color: '#8dffb4', dir: [-1, 0] },
        { id: 'B', x: 8, y: 0, name: '办公网下行', code: 'GATE-B', color: '#ffd166', dir: [0, -1] },
        { id: 'C', x: 16, y: 5, name: '供应商远程维护', code: 'GATE-C', color: '#ff9a70', dir: [1, 0] }
      ],
      exits: [
        { id: 'X', x: 5, y: 13, name: '过程控制核心', code: 'PLC-X', color: '#b6ffd0' },
        { id: 'Y', x: 11, y: 13, name: '安全联锁核心', code: 'SIS-Y', color: '#ffd68a' }
      ],
      switches: [
        { id: 'SW1', x: 4, y: 3, name: '运维环北闸', code: 'SW-21', note: '北侧狭窄通道总闸' },
        { id: 'SW2', x: 4, y: 7, name: '运维环中继', code: 'SW-22', note: '气隙西侧中段中继' },
        { id: 'SW3', x: 4, y: 11, name: '运维环南闸', code: 'SW-23', note: '南侧狭窄通道总闸' },
        { id: 'SW4', x: 14, y: 5, name: '供应链接入', code: 'SW-24', note: '供应商远程维护接入点' },
        { id: 'SW5', x: 14, y: 7, name: '东环中继', code: 'SW-25', note: '气隙东侧中段中继' },
        { id: 'SW6', x: 14, y: 11, name: '南环东闸', code: 'SW-26', note: '南环通往 Y 的旁路闸口' }
      ],
      zones: [
        { x1: 0, y1: 0, x2: 17, y2: 3, id: 'dmz' },
        { x1: 0, y1: 4, x2: 17, y2: 10, id: 'business' },
        { x1: 0, y1: 11, x2: 17, y2: 14, id: 'core' }
      ],
      rows: [
        "########B########",
        "########.########",
        "A..............##",
        "##.............##",
        "##.#.P##P##P.#.##",
        "##.P.#######.P..C",
        "##.P.#######.P.#o",
        "##.#.#######.#.#o",
        "##.#.#######.#.#o",
        "##.P.#######.P.#o",
        "##.#.###P###.#.#o",
        "##.............#o",
        "##o...........ooo",
        "##oooXoooooYooo##",
        "#################"
      ]
    }
  ];

  /* ------------------------------------------------------------------ *
   *  塔
   * ------------------------------------------------------------------ */
  const TOWER_DEFS = {
    firewall: {
      id: 'firewall', name: '防火墙', en: 'FIREWALL', role: '阻挡', layer: 'link',
      icon: 'shield', color: '#57e0ff', cost: { compute: 55, intel: 0 },
      desc: '部署在链路或交换节点。在链路上以有限容量阻挡敌人并还击；在节点上部署会隔离节点，并拦截相邻链路上的敌人。',
      hp: [420, 580], dmg: [14, 24], rate: [1.1, 1.25], range: [2.0, 2.2],
      block: [2, 3], armor: 0.12, skill: 'overload',
      tags: ['承受近战', '阻挡 2', '节点隔离'],
      levels: [
        { label: 'Lv.1 · 包过滤墙', hp: 420, dmg: 14, rate: 1.1, range: 2.0, block: 3 },
        { label: 'Lv.2 · 状态检测墙', hp: 580, dmg: 24, rate: 1.25, range: 2.2, block: 4, note: '装甲加厚，阻挡容量 +1' }
      ],
      costLv2: { compute: 90, intel: 18 }
    },
    honeypot: {
      id: 'honeypot', name: '蜜罐', en: 'HONEYPOT', role: '诱敌', layer: 'link',
      icon: 'honey', color: '#ff8ad8', cost: { compute: 45, intel: 0 },
      desc: '仅可部署在链路。以伪造应答吸引附近会攻击塔的地面敌人，替其他塔承担攻击；耐久较低，但不会被加密。',
      hp: [210, 300], lureRadius: [3.2, 4.2], lureCap: [3, 5], immuneEncrypt: true,
      skill: 'snare',
      tags: ['诱敌 3', '免疫加密', '主动·诱捕'],
      branches: [
        { id: 'matrix', name: '蜜罐矩阵', en: 'MATRIX', desc: '扩大诱敌范围与容量，被诱敌人受到的其他伤害 +12%。', hp: 310, lureRadius: 4.4, lureCap: 6, markBonus: 0.12 },
        { id: 'snare', name: '诱捕陷阱', en: 'SNARE', desc: '诱敌容量降低，但被诱敌人持续被缠绕并每秒受到 14 点伤害。', hp: 360, lureRadius: 3.6, lureCap: 2, dot: 14 }
      ],
      levels: [
        { label: 'Lv.1 · 伪装应答器', hp: 210, lureRadius: 3.2, lureCap: 3 },
        { label: 'Lv.2 · 二选一分支', hp: 300, lureRadius: 4.0, lureCap: 4, branch: true }
      ],
      costLv2: { compute: 80, intel: 25 }
    },
    netgap: {
      id: 'netgap', name: '网闸', en: 'GAP', role: '隔离', layer: 'switch',
      icon: 'gap', color: '#8df5b8', cost: { compute: 30, intel: 14 },
      desc: '仅可部署在交换节点。低成本隔离节点，耐久较高，不攻击。用途是控制道路，但仍会受到敌人攻击与破坏。',
      hp: [430, 600], armor: 0.2, isolate: true, skill: 'clamp', immuneEncrypt: true,
      tags: ['节点隔离', '高耐久', '主动·钳制'],
      levels: [
        { label: 'Lv.1 · 单向隔离闸', hp: 430 },
        { label: 'Lv.2 · 双环网闸', hp: 600, note: '获得周期性隔离护盾' }
      ],
      costLv2: { compute: 80, intel: 20 }
    },
    interceptor: {
      id: 'interceptor', name: '拦截器', en: 'INTERCEPTOR', role: '远程', layer: 'platform',
      icon: 'turret', color: '#7fb4ff', cost: { compute: 80, intel: 0 },
      desc: '部署在设备平台，朝向可在确认前设定。在朝向决定的攻击区域内进行远程单体攻击，地面与飞行敌人皆可命中。',
      hp: [210, 280], dmg: [34, 52], rate: [1.05, 1.15], range: [5.0, 5.3], cone: 50,
      skill: 'salvo', tags: ['远程·朝向', '对空', 'Lv.2 二选一'],
      levels: [
        { label: 'Lv.1 · 单装拦截炮', hp: 210, dmg: 34, rate: 1.05, range: 5.0 },
        { label: 'Lv.2 · 二选一分支', hp: 280, dmg: 52, rate: 1.15, range: 5.3, branch: true }
      ],
      branches: [
        { id: 'pierce', name: '贯穿弹', en: 'PIERCE', desc: '弹道贯穿一条直线上的最多 3 个敌人，射速略降低。', hp: 285, dmg: 58, rate: 0.86, pierce: 3 },
        { id: 'suppress', name: '压制弹', en: 'SUPPRESS', desc: '命中使敌人减速 35% 并降低其攻击 20%，持续 2.5 秒。', hp: 300, dmg: 40, rate: 1.4, slow: 0.35, slowTime: 2.5 }
      ],
      costLv2: { compute: 110, intel: 25 }
    },
    sandbox: {
      id: 'sandbox', name: '沙箱', en: 'SANDBOX', role: '检测', layer: 'platform',
      icon: 'sandbox', color: '#5ff0d2', cost: { compute: 76, intel: 0 },
      desc: '部署在设备平台。检测范围内的伪装或潜伏目标使其显形，并对地面敌人进行范围攻击，适合处理汇聚的流量。',
      hp: [250, 320], dmg: [20, 30], rate: [0.9, 1.0], range: [3.4, 3.7], aoe: [2.5, 2.8],
      detect: [3.6, 4.1], skill: 'forensics', tags: ['检测显形', '范围攻击', '反潜伏'],
      levels: [
        { label: 'Lv.1 · 行为沙箱', hp: 250, dmg: 20, rate: 0.9, range: 3.4, aoe: 2.5, detect: 3.8 },
        { label: 'Lv.2 · 深度沙箱', hp: 320, dmg: 30, rate: 1.0, range: 3.7, aoe: 2.8, detect: 4.3 }
      ],
      costLv2: { compute: 95, intel: 20 }
    },
    repair: {
      id: 'repair', name: '修复进程', en: 'REPAIR', role: '支援', layer: 'platform',
      icon: 'repair', color: '#9dff9d', cost: { compute: 70, intel: 0 },
      desc: '部署在设备平台，不攻击敌人。持续恢复范围内其他受损塔的生命；升级后可周期性解除加密。',
      hp: [215, 280], heal: [23, 34], healRange: [3.8, 4.2], cleanseEvery: [0, 5],
      skill: 'redundancy', tags: ['专职治疗', '解除加密', '主动·冗余切换'],
      levels: [
        { label: 'Lv.1 · 热备修复线程', hp: 215, heal: 23, healRange: 3.8 },
        { label: 'Lv.2 · 冗余修复线程', hp: 280, heal: 34, healRange: 4.2, cleanseEvery: 5, note: '每 5 秒解除一座友塔的加密' }
      ],
      costLv2: { compute: 90, intel: 22 }
    }
  };

  const TOWER_ORDER = ['firewall', 'honeypot', 'netgap', 'interceptor', 'sandbox', 'repair'];

  const SKILLS = {
    overload: { name: '熔断协议', cd: 24, dur: 5, desc: '5 秒内受到伤害 -60%，阻挡容量 +2，并反弹 25% 近战伤害。', color: '#57e0ff' },
    snare: { name: '诱捕', cd: 26, dur: 3, desc: '缠绕所有被诱敌的敌人 3 秒，并使其受到的伤害 +20%。', color: '#ff8ad8' },
    clamp: { name: '冷备钳制', cd: 30, dur: 6, desc: '6 秒内受到伤害 -65%；隔离状态不会被普通攻击打断。', color: '#8df5b8' },
    salvo: { name: '过载齐射', cd: 28, dur: 3, desc: '3 秒内射速提升至 3 倍，射程 +15%。', color: '#7fb4ff' },
    forensics: { name: '深度取证', cd: 28, dur: 5, desc: '5 秒内检测范围 +60%，范围内敌人受到的伤害 +25%。', color: '#5ff0d2' },
    redundancy: { name: '冗余切换', cd: 32, dur: 12, desc: '为附近 4 座友塔提供 130 点护盾，解除加密，并提升 50% 治疗量持续 10 秒。', color: '#9dff9d' }
  };

  /* ------------------------------------------------------------------ *
   *  敌人
   * ------------------------------------------------------------------ */
  const ENEMY_DEFS = {
    worm: {
      id: 'worm', name: '蠕虫', en: 'WORM', kind: 'ground', hp: 68, speed: 1.45, dmg: 8,
      attackInterval: 1.0, reach: 1.0, block: 1, reward: 7, integrity: 5,
      desc: '最常见的地面入侵体。被阻挡时持续撕咬挡住它的设备；首次经过直通的交换节点会复制出同伴，复制体不再复制。',
      tags: ['复制', '近战攻塔']
    },
    flood: {
      id: 'flood', name: '洪泛团', en: 'FLOOD', kind: 'ground', hp: 175, speed: 1.0, dmg: 22,
      attackInterval: 1.5, reach: 1.15, block: 2, reward: 12, integrity: 7, nodeRush: true,
      desc: '占用 2 点阻挡容量。会离开当前路线，扑向附近被隔离节点的可通行一侧，重击节点上的塔或隔离器；打通后沿重新开放的道路前进。',
      tags: ['阻挡 2', '冲击节点', '改道']
    },
    trojan: {
      id: 'trojan', name: '木马', en: 'TROJAN', kind: 'ground', hp: 100, speed: 1.35, dmg: 12,
      attackInterval: 0.9, reach: 1.0, block: 1, reward: 10, integrity: 6, disguise: true, payload: 42,
      desc: '伪装成正常封装数据包。显形前不能被远程单体攻击主动选中；沙箱检测、旧链路和阻挡会使其显形。未显形就被范围攻击消灭时释放载荷，伤害附近塔。',
      tags: ['伪装', '需检测', '死亡载荷']
    },
    ransomware: {
      id: 'ransomware', name: '勒索者', en: 'RANSOMWARE', kind: 'ground', hp: 125, speed: 1.1, dmg: 9,
      attackInterval: 1.2, reach: 3.3, block: 1, reward: 12, integrity: 6, ranged: true, encrypt: 4,
      desc: '边移动边从远处攻击射程内的塔，包括平台上的塔，造成伤害并施加加密；会优先攻击射程内的蜜罐。',
      tags: ['远程攻塔', '施加加密']
    },
    hotspot: {
      id: 'hotspot', name: '伪热点', en: 'HOTSPOT', kind: 'air', hp: 90, speed: 1.65, dmg: 0,
      reward: 9, integrity: 4, flying: true,
      desc: '沿无线层从入口直飞出口，不受地面道路和阻挡影响。只有拦截器能有效对付它。',
      tags: ['飞行', '无视地形', '仅拦截器']
    },
    packer: {
      id: 'packer', name: '加壳器', en: 'PACKER', kind: 'ground', hp: 220, speed: 0.95, dmg: 12,
      attackInterval: 1.2, reach: 1.1, block: 1, reward: 15, integrity: 8, shield: 90, shieldRadius: 3.5,
      desc: '为附近同伴提供可被打破的护盾，保护成群敌人推进，迫使玩家考虑先处理支援者还是集中攻击前排。',
      tags: ['群体护盾', '支援', '高价值']
    },
    boss_wankui: {
      id: 'boss_wankui', name: '万傀', en: 'MYRIAD', kind: 'ground', boss: true, hp: 3600, speed: 0.55,
      dmg: 48, attackInterval: 1.6, reach: 1.6, block: 2, reward: 90, integrity: 30, scale: 2.2,
      desc: '僵尸网络的群体控制核心。第一阶段以“洪峰”冲击被隔离节点，重创节点上的塔并冲毁隔离器；生命降低后释放成群蠕虫，增加节点与阻挡塔的压力。',
      tags: ['Boss', '冲毁隔离', '召唤蠕虫'], phases: [0.62, 0.3]
    },
    boss_mirage: {
      id: 'boss_mirage', name: '蜃楼', en: 'MIRAGE', kind: 'ground', boss: true, hp: 3800, speed: 0.6,
      dmg: 32, attackInterval: 1.3, reach: 1.6, block: 2, reward: 95, integrity: 30, scale: 2.1,
      desc: '路由欺骗的具象。以“伪路由”在前方链路制造临时路由黑洞，截断通行、迫使各入口改道；生命降低后发动“路由风暴”，削弱附近塔的护盾。',
      tags: ['Boss', '路由黑洞', '护盾风暴'], phases: [0.66, 0.33]
    },
    boss_zheying: {
      id: 'boss_zheying', name: '蛰影', en: 'ZHEYING', kind: 'ground', boss: true, hp: 2200, speed: 0.3,
      dmg: 42, attackInterval: 1.4, reach: 1.7, block: 2, reward: 120, integrity: 38, scale: 2.35,
      disguise: true, armor: 0.15,
      desc: '攻击组织“蛰影”的核心威胁。按“潜伏—提权—破坏”改变阶段：潜伏时需要检测才能被远程单体攻击选中；提权后强化护甲并放出木马；破坏阶段锁死前方一段运维环、改变道路。',
      tags: ['Boss', '阶段变化', '锁死道路'], phases: [0.7, 0.35]
    }
  };

  /* ------------------------------------------------------------------ *
   *  道具
   * ------------------------------------------------------------------ */
  const ITEM_DEFS = {
    isolator: {
      id: 'isolator', name: '应急隔离器', en: 'EMERGENCY ISOLATOR', cost: { compute: 0, intel: 28 },
      target: 'switch', cd: 26, duration: 22, hp: 220, icon: 'isolator', color: '#ffce6a',
      desc: '临时隔离一个直通交换节点，有耐久和有效期，会被敌人冲毁，不产生情报。',
      tags: ['临时隔离', '22 秒', '耐久 220']
    },
    downgrade: {
      id: 'downgrade', name: '协议降级', en: 'PROTOCOL DOWNGRADE', cost: { compute: 0, intel: 34 },
      target: 'area', cd: 34, radius: 2.4, duration: 18, icon: 'downgrade', color: '#ff9c6b',
      desc: '让一片链路暂时使用旧协议，产生旧链路的减速和显形效果；敌人的路线随通行速度变化重新选择。',
      tags: ['范围降级', '18 秒', '减速 + 显形']
    },
    backup: {
      id: 'backup', name: '备份还原', en: 'BACKUP RESTORE', cost: { compute: 55, intel: 0 },
      target: 'tower', cd: 18, heal: 0.55, icon: 'backup', color: '#9dffb4',
      desc: '恢复一座塔 55% 生命并解除加密。对节点上的隔离塔同样有效。',
      tags: ['治疗 55%', '解除加密', '算力道具']
    }
  };
  const ITEM_ORDER = ['isolator', 'downgrade', 'backup'];

  /* ------------------------------------------------------------------ *
   *  波次
   *  group: { e, n, ent, gap, delay }
   * ------------------------------------------------------------------ */
  function wave(groups, note, boss) { return { groups, note, boss: boss || null }; }
  const WAVES = {
    segment: [
      wave([{ e: 'worm', n: 6, ent: 'A', gap: 1.0 }], '门户网站的蠕虫试探'),
      wave([{ e: 'worm', n: 8, ent: 'B', gap: 0.85 }, { e: 'ransomware', n: 2, ent: 'A', gap: 2.2, delay: 2 }], '勒索软件首次出现'),
      wave([{ e: 'flood', n: 3, ent: 'A', gap: 2.4 }, { e: 'trojan', n: 2, ent: 'B', gap: 2.6, delay: 3 }, { e: 'worm', n: 6, ent: 'B', gap: 1.0, delay: 6 }], '木马混入邮件流量'),
      wave([{ e: 'hotspot', n: 4, ent: 'B', gap: 1.2 }, { e: 'worm', n: 8, ent: 'A', gap: 0.9 }], '无线层出现伪热点'),
      wave([{ e: 'flood', n: 4, ent: 'A', gap: 2.0 }, { e: 'ransomware', n: 3, ent: 'B', gap: 2.4 }, { e: 'packer', n: 1, ent: 'A', gap: 1, delay: 5 }], '加壳器掩护洪泛团'),
      wave([{ e: 'trojan', n: 3, ent: 'A', gap: 2.0 }, { e: 'worm', n: 10, ent: 'A', gap: 0.7 }, { e: 'hotspot', n: 4, ent: 'B', gap: 1.4 }], '双入口压力'),
      wave([{ e: 'flood', n: 5, ent: 'A', gap: 1.7 }, { e: 'ransomware', n: 4, ent: 'A', gap: 2.0 }, { e: 'packer', n: 1, ent: 'B', gap: 1 }, { e: 'worm', n: 8, ent: 'B', gap: 0.8 }], '办公网段告急'),
      wave([{ e: 'packer', n: 2, ent: 'B', gap: 3 }, { e: 'worm', n: 12, ent: 'B', gap: 0.65 }, { e: 'trojan', n: 4, ent: 'A', gap: 1.8 }], '加密流量激增'),
      wave([{ e: 'flood', n: 6, ent: 'A', gap: 1.5 }, { e: 'ransomware', n: 5, ent: 'B', gap: 1.9 }, { e: 'packer', n: 2, ent: 'A', gap: 2.5, delay: 4 }], '核心前置节点承压'),
      wave([{ e: 'hotspot', n: 8, ent: 'A', gap: 1.0 }, { e: 'trojan', n: 5, ent: 'B', gap: 1.6 }, { e: 'worm', n: 10, ent: 'B', gap: 0.7 }], '空天地一体进攻'),
      wave([{ e: 'ransomware', n: 8, ent: 'A', gap: 1.6 }, { e: 'flood', n: 5, ent: 'B', gap: 1.8 }, { e: 'packer', n: 2, ent: 'B', gap: 2.4 }], '勒索风暴'),
      wave([{ e: 'worm', n: 12, ent: 'A', gap: 0.6 }, { e: 'trojan', n: 5, ent: 'B', gap: 1.5 }, { e: 'hotspot', n: 5, ent: 'A', gap: 1.2 }, { e: 'ransomware', n: 4, ent: 'B', gap: 1.7 }], '全面入侵'),
      wave([{ e: 'flood', n: 7, ent: 'A', gap: 1.3 }, { e: 'packer', n: 3, ent: 'B', gap: 2.2 }, { e: 'worm', n: 10, ent: 'B', gap: 0.6 }, { e: 'ransomware', n: 6, ent: 'A', gap: 1.8 }], '中枢闸口告急'),
      wave([{ e: 'worm', n: 10, ent: 'A', gap: 0.7, delay: 6 }, { e: 'flood', n: 4, ent: 'B', gap: 1.8, delay: 4 }], '万傀的傀儡群正在汇聚', 'boss_wankui')
    ],
    backbone: [
      wave([{ e: 'worm', n: 6, ent: 'A', gap: 0.9 }, { e: 'worm', n: 4, ent: 'C', gap: 1.1 }], '互联网与分支专线同时探测'),
      wave([{ e: 'ransomware', n: 3, ent: 'C', gap: 2.0 }, { e: 'worm', n: 8, ent: 'B', gap: 0.8 }], '勒索者扫描骨干'),
      wave([{ e: 'flood', n: 3, ent: 'A', gap: 2.2 }, { e: 'trojan', n: 3, ent: 'C', gap: 2.0 }, { e: 'worm', n: 6, ent: 'B', gap: 1.0, delay: 4 }], '木马混入云端同步流'),
      wave([{ e: 'hotspot', n: 5, ent: 'B', gap: 1.1 }, { e: 'worm', n: 9, ent: 'A', gap: 0.8 }, { e: 'ransomware', n: 2, ent: 'C', gap: 2.4 }], '无线层横穿公网流'),
      wave([{ e: 'packer', n: 1, ent: 'C', gap: 1 }, { e: 'flood', n: 4, ent: 'C', gap: 1.8 }, { e: 'worm', n: 8, ent: 'A', gap: 0.8 }, { e: 'trojan', n: 2, ent: 'B', gap: 2.2 }], '加壳器护卫专线'),
      wave([{ e: 'ransomware', n: 4, ent: 'A', gap: 1.8 }, { e: 'hotspot', n: 6, ent: 'C', gap: 1.0 }, { e: 'worm', n: 10, ent: 'B', gap: 0.7 }], '三路压力上升'),
      wave([{ e: 'flood', n: 6, ent: 'B', gap: 1.6 }, { e: 'packer', n: 2, ent: 'A', gap: 2.4 }, { e: 'trojan', n: 4, ent: 'C', gap: 1.9 }], '汇聚节点成为目标'),
      wave([{ e: 'worm', n: 12, ent: 'A', gap: 0.6 }, { e: 'ransomware', n: 4, ent: 'C', gap: 1.7 }, { e: 'hotspot', n: 5, ent: 'B', gap: 1.1 }], '双活链路抖动'),
      wave([{ e: 'worm', n: 8, ent: 'A', gap: 0.6 }, { e: 'worm', n: 8, ent: 'B', gap: 0.6 }, { e: 'worm', n: 8, ent: 'C', gap: 0.6 }, { e: 'flood', n: 3, ent: 'A', gap: 1.4, delay: 3 }, { e: 'flood', n: 3, ent: 'B', gap: 1.4, delay: 5 }, { e: 'flood', n: 3, ent: 'C', gap: 1.4, delay: 7 }, { e: 'packer', n: 2, ent: 'B', gap: 2, delay: 9 }], '洪峰 · 三入口同时大量出兵'),
      wave([{ e: 'ransomware', n: 8, ent: 'A', gap: 1.5 }, { e: 'trojan', n: 6, ent: 'B', gap: 1.5 }, { e: 'flood', n: 5, ent: 'C', gap: 1.7 }], '勒索者压制平台'),
      wave([{ e: 'packer', n: 3, ent: 'C', gap: 2.0 }, { e: 'hotspot', n: 8, ent: 'B', gap: 0.9 }, { e: 'worm', n: 12, ent: 'A', gap: 0.6 }], '护盾推进'),
      wave([{ e: 'flood', n: 8, ent: 'B', gap: 1.3 }, { e: 'ransomware', n: 6, ent: 'C', gap: 1.6 }, { e: 'trojan', n: 5, ent: 'A', gap: 1.7 }], '双活汇流失守边缘'),
      wave([{ e: 'worm', n: 14, ent: 'A', gap: 0.55 }, { e: 'worm', n: 14, ent: 'B', gap: 0.55 }, { e: 'flood', n: 5, ent: 'C', gap: 1.4 }, { e: 'packer', n: 3, ent: 'A', gap: 2 }], '骨干流域满载'),
      wave([{ e: 'ransomware', n: 8, ent: 'B', gap: 1.35 }, { e: 'trojan', n: 6, ent: 'C', gap: 1.4 }, { e: 'flood', n: 5, ent: 'A', gap: 1.6 }, { e: 'packer', n: 2, ent: 'C', gap: 2.0 }], '双活数据中心濒临过载'),
      wave([{ e: 'trojan', n: 6, ent: 'C', gap: 1.4 }, { e: 'hotspot', n: 6, ent: 'A', gap: 1.0 }], '蜃楼正在改写路由表', 'boss_mirage')
    ],
    airgap: [
      wave([{ e: 'worm', n: 6, ent: 'A', gap: 0.95 }, { e: 'worm', n: 4, ent: 'B', gap: 1.1 }], '运维通道异常'),
      wave([{ e: 'trojan', n: 2, ent: 'B', gap: 2.2 }, { e: 'worm', n: 8, ent: 'A', gap: 0.8 }], '办公网下行混入伪装包'),
      wave([{ e: 'flood', n: 3, ent: 'A', gap: 2.0 }, { e: 'ransomware', n: 3, ent: 'C', gap: 2.2 }, { e: 'worm', n: 6, ent: 'B', gap: 1.0 }], '供应商链路被利用'),
      wave([{ e: 'hotspot', n: 5, ent: 'B', gap: 1.2 }, { e: 'worm', n: 9, ent: 'C', gap: 0.9 }], '无线热点穿透气隙'),
      wave([{ e: 'packer', n: 1, ent: 'A', gap: 1 }, { e: 'flood', n: 4, ent: 'B', gap: 1.8 }, { e: 'trojan', n: 3, ent: 'C', gap: 2.0 }], '加壳器进入工控段'),
      wave([{ e: 'ransomware', n: 5, ent: 'C', gap: 1.7 }, { e: 'worm', n: 10, ent: 'A', gap: 0.7 }, { e: 'flood', n: 3, ent: 'B', gap: 2.0 }], '勒索软件压制运维环'),
      wave([{ e: 'flood', n: 5, ent: 'A', gap: 1.5 }, { e: 'packer', n: 2, ent: 'B', gap: 2.2 }, { e: 'trojan', n: 4, ent: 'C', gap: 1.8 }], '两侧狭窄通道同时受压'),
      wave([{ e: 'hotspot', n: 7, ent: 'A', gap: 1.0 }, { e: 'worm', n: 10, ent: 'C', gap: 0.75 }, { e: 'ransomware', n: 4, ent: 'B', gap: 1.8 }], '气隙两侧流量上涨'),
      wave([{ e: 'flood', n: 6, ent: 'B', gap: 1.4 }, { e: 'packer', n: 2, ent: 'C', gap: 2.0 }, { e: 'worm', n: 10, ent: 'A', gap: 0.7 }], '老工控总线被挤占'),
      wave([{ e: 'worm', n: 9, ent: 'A', gap: 0.6 }, { e: 'worm', n: 9, ent: 'B', gap: 0.6 }, { e: 'worm', n: 9, ent: 'C', gap: 0.6 }, { e: 'flood', n: 4, ent: 'A', gap: 1.3, delay: 4 }, { e: 'flood', n: 4, ent: 'C', gap: 1.3, delay: 6 }, { e: 'packer', n: 2, ent: 'B', gap: 2.0, delay: 8 }], '洪峰 · 三入口同时大量出兵'),
      wave([{ e: 'ransomware', n: 8, ent: 'C', gap: 1.5 }, { e: 'trojan', n: 6, ent: 'A', gap: 1.6 }, { e: 'flood', n: 5, ent: 'B', gap: 1.8 }], '运维环中继告急'),
      wave([{ e: 'packer', n: 3, ent: 'A', gap: 2.0 }, { e: 'hotspot', n: 8, ent: 'B', gap: 0.9 }, { e: 'worm', n: 12, ent: 'C', gap: 0.65 }], '护盾与空袭协同'),
      wave([{ e: 'flood', n: 8, ent: 'A', gap: 1.2 }, { e: 'ransomware', n: 6, ent: 'B', gap: 1.5 }, { e: 'trojan', n: 5, ent: 'C', gap: 1.6 }], '双核心防守互相牵制'),
      wave([{ e: 'worm', n: 14, ent: 'C', gap: 0.55 }, { e: 'worm', n: 14, ent: 'B', gap: 0.55 }, { e: 'flood', n: 5, ent: 'A', gap: 1.3 }, { e: 'packer', n: 3, ent: 'B', gap: 1.9 }], '气隙深层全面告警'),
      wave([{ e: 'ransomware', n: 8, ent: 'B', gap: 1.3 }, { e: 'flood', n: 5, ent: 'C', gap: 1.45 }, { e: 'packer', n: 3, ent: 'A', gap: 1.9 }, { e: 'worm', n: 12, ent: 'A', gap: 0.6 }], '气隙两侧通道同时超载'),
      wave([{ e: 'trojan', n: 6, ent: 'A', gap: 1.4 }, { e: 'hotspot', n: 6, ent: 'C', gap: 1.0 }], '蛰影正在气隙中潜伏', 'boss_zheying')
    ]
  };

  /* ------------------------------------------------------------------ *
   *  图鉴
   * ------------------------------------------------------------------ */
  const CODEX = {
    towers: TOWER_ORDER.map(id => TOWER_DEFS[id]),
    enemies: Object.values(ENEMY_DEFS),
    items: ITEM_ORDER.map(id => ITEM_DEFS[id]),
    system: [
      { name: '链路', color: '#57e0ff', desc: '恶意程序与业务流量经过的道路。防火墙和蜜罐可以部署在入口、出口之外的链路上；它们阻挡敌人，但不截断这条道路。' },
      { name: '设备平台', color: '#7fb4ff', desc: '部署远程和修复支援塔的位置，与链路有高低区别，敌人不能通行。拦截器、沙箱与修复进程只能部署在平台上。' },
      { name: '障碍', color: '#6a7a8a', desc: '数据设施、公网流与气隙，不能通行，也不能部署。骨干流域的公网流横贯战场，气隙深层中央是物理隔离区。' },
      { name: '交换节点', color: '#8df5b8', desc: '链路交汇处的网络设备。部署防火墙、网闸或插入应急隔离器会隔离节点，使这一格不能通行；解除隔离后恢复直通。' },
      { name: '旧链路', color: '#d58b5c', desc: '保留旧协议的道路，经过的地面敌人减速，伪装的木马显形。敌人选择路线时也会考虑其较慢的通行速度。' },
      { name: '阻挡', color: '#ff8ad8', desc: '防火墙和蜜罐拥有阻挡容量。敌人停在设备前方交战，不改变道路的通行状态；容量占满后敌人会继续前进。' },
      { name: '加密', color: '#c46bff', desc: '勒索者施加的状态。被加密的塔暂时停止攻击、治疗和释放技能，但不解除阻挡或节点隔离。修复进程的冗余切换、备份还原可以解除。' },
      { name: '护盾', color: '#9dffb4', desc: '护盾优先吸收伤害，由加壳器提供，也可由修复进程技能赋予。护盾可以被打破，但不会阻止塔继续运作。' },
      { name: '检测', color: '#5ff0d2', desc: '沙箱的检测范围使伪装目标显形，旧链路和阻挡也会显形。显形前，木马与潜伏的蛰影不能被远程单体攻击主动选中。' },
      { name: '资源', color: '#ffd166', desc: '算力用于部署塔、升级和备份还原；情报用于隔离节点、选择升级分支与情报道具。两种资源不能互换，撤下塔退还 60% 算力。' }
    ]
  };

  global.GAME_DATA = {
    CELL, FIXED_DT, START_INTEGRITY,
    MAPS, WAVES, TOWER_DEFS, TOWER_ORDER, SKILLS,
    ENEMY_DEFS, ITEM_DEFS, ITEM_ORDER, CODEX
  };
})(typeof window !== 'undefined' ? window : globalThis);
