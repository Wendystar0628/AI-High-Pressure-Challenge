"use strict";
const ICONS = {
  worm: '<path d="M12 40L17 26L29 21L42 27L49 38L43 48L30 50L20 46Z" fill="#583b35"/><path d="M17 26L20 46M29 21L30 50M42 27L43 48M14 36L8 31M17 44L10 49M45 30L54 26M49 40L57 44"/><circle cx="21" cy="32" r="2"/><circle cx="24" cy="40" r="2"/>',
  flood:
    '<path d="M10 20L32 11L54 20V43L32 54L10 43Z" fill="#523534"/><path d="M10 20L32 30L54 20M32 30V54M16 29L25 33V42L16 38ZM39 33L48 29V38L39 42ZM19 16L43 47M43 16L19 47"/>',
  trojan:
    '<path d="M12 21L32 11L52 21V44L32 55L12 44Z" fill="#324b44"/><path d="M12 21L32 31L52 21M32 31V55M24 15L44 25V36L36 40V29L16 19"/><path d="M20 35L25 38M39 43L46 39"/>',
  ransom:
    '<path d="M18 30H46V52H18ZM24 30V21A8 8 0 0 1 40 21V30M32 38V45M18 36L8 31M46 36L56 31M18 47L8 54M46 47L56 54"/><circle cx="32" cy="38" r="2"/><path d="M7 18L13 12M51 12L57 18"/>',
  flyer:
    '<path d="M32 17L42 29L32 42L22 29ZM22 29L6 22L12 39L27 36M42 29L58 22L52 39L37 36M32 42V54M21 12Q32 3 43 12M25 17Q32 11 39 17" fill="#413955"/>',
  shell:
    '<path d="M32 8L53 20V39L32 56L11 39V20Z" fill="#3e3655"/><path d="M32 15L45 23V36L32 46L19 36V23ZM19 23L32 31L45 23M32 31V46M11 20L5 16M53 20L59 16"/><circle cx="32" cy="31" r="5"/>',
  boss0:
    '<circle cx="32" cy="32" r="13"/><path d="M32 4V18M32 46V60M4 32H18M46 32H60M12 12L23 23M41 41L52 52M12 52L23 41M41 23L52 12"/><circle cx="32" cy="8" r="5"/><circle cx="8" cy="32" r="5"/><circle cx="56" cy="32" r="5"/><circle cx="32" cy="56" r="5"/><path d="M25 29L32 24L39 29L32 40Z" fill="#6a3d42"/>',
  boss1:
    '<path d="M32 5L48 29L32 56L16 29ZM32 5V56M16 29H48" fill="#493455"/><ellipse cx="32" cy="31" rx="28" ry="10" transform="rotate(-25 32 31)"/><ellipse cx="32" cy="31" rx="28" ry="10" transform="rotate(25 32 31)"/>',
  boss2:
    '<path d="M24 19L32 10L40 19L44 38L32 49L20 38ZM24 24L12 15L5 25M22 32L8 30L3 43M23 39L14 47L12 59M40 24L52 15L59 25M42 32L56 30L61 43M41 39L50 47L52 59" fill="#51363f"/><path d="M27 25L32 29L37 25M32 29V41"/>',
  firewall:
    '<path d="M12 18L32 8L52 18V45L32 57L12 45Z" fill="#153e38"/><path d="M12 18L32 29L52 18M32 29V57M20 22V41L27 45M44 22V41L37 45"/><path d="M23 15L32 20L41 15M23 32L27 34M37 34L41 32"/>',
  honey:
    '<path d="M16 23L32 14L48 23V44L32 54L16 44Z" fill="#3d3423"/><path d="M16 23L32 33L48 23M32 33V54M23 19V12L32 7L41 12V19M23 12L32 17L41 12M32 17V25"/><path d="M23 34V41M41 34V41"/>',
  gate: '<path d="M10 46L32 58L54 46L32 34Z" fill="#234139"/><path d="M16 44V15L23 11L23 46M41 46V11L48 15V44M23 17L41 17M23 25L41 25M23 33L41 33"/><path d="M29 12V42M35 12V42" stroke-dasharray="2 3"/>',
  interceptor:
    '<path d="M13 46L32 57L51 46L32 35Z" fill="#1c443a"/><path d="M23 44V34L32 28L41 34V44M23 34L32 40L41 34M32 40V50"/><path d="M21 28L39 8L48 13L30 34Z" fill="#285b4d"/><path d="M39 8L39 17L48 13M39 17L25 32M22 24L15 20L29 8L36 12"/>',
  sandbox:
    '<path d="M11 43L32 56L53 43L32 31Z" fill="#23463f"/><path d="M17 23L32 14L47 23V41L32 50L17 41Z" fill="#16423b"/><path d="M17 23L32 32L47 23M32 32V50M24 19V11L32 6L40 11V19M24 11L32 16L40 11"/><circle cx="32" cy="34" r="6"/>',
  repair:
    '<path d="M13 45L32 57L51 45L32 34Z" fill="#23463d"/><path d="M24 45V28L32 23L40 28V45M24 28L32 34L40 28M32 34V50"/><path d="M28 8H36V16H44V24H36V32H28V24H20V16H28Z" fill="#1d5845"/>',
  isolate:
    '<path d="M13 12H21V52H13ZM43 12H51V52H43ZM21 20H43M21 32H43M21 44H43"/>',
  downgrade:
    '<path d="M14 13H50V29H14ZM20 21H24M30 21H44M32 30V51M22 42L32 52L42 42"/>',
  restore:
    '<path d="M15 24A20 20 0 1 1 13 39M14 12V25H27M27 24H37V31H44V40H37V47H27V40H20V31H27Z"/>',
};
function icon(k, cl = "") {
  return (
    '<svg class="' +
    cl +
    '" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">' +
    (ICONS[k] || ICONS.sandbox) +
    "</svg>"
  );
}
const TOWERS = {
  firewall: {
    name: "防火墙",
    role: "阻挡 / 近战",
    place: "链路 · 节点",
    cost: 75,
    intel: 0,
    hp: 320,
    range: 1.5,
    damage: 19,
    rate: 0.7,
    capacity: 3,
    color: 0x82ecd0,
    skill: "过载防御",
    desc: "拦住 3 单位容量并还击；部署于交换节点会隔离道路，消耗 6 情报。加密期间仍能阻挡。",
    upgrade: "强化屏障：阻挡容量增至 5，反击产生溅射。",
    active: "获得 90 护盾，冲击周围地面目标。",
    cd: 24,
  },
  honey: {
    name: "蜜罐",
    role: "诱敌 / 阻挡",
    place: "仅链路",
    cost: 65,
    intel: 0,
    hp: 190,
    range: 3.2,
    damage: 7,
    rate: 1,
    capacity: 2,
    color: 0xffbe73,
    skill: "诱捕",
    desc: "吸引附近会攻塔的地面敌人。免疫加密，替关键设备承担火力。",
    branches: ["深度诱捕", "反制载荷"],
    branchDetails: [
      "深度诱捕：阻挡容量 4，诱敌半径扩大至 4.5 格，诱捕延长至 7 秒。",
      "反制载荷：阻挡容量 4，每次受攻击对 2 格内敌人造成 10 点反伤。",
    ],
    upgrade:
      "深度诱捕：扩大诱敌范围并延长定身。反制载荷：受攻击时对周围敌人反伤。",
    active: "困住诱敌范围内的地面敌人 4 秒。",
    cd: 22,
  },
  gate: {
    name: "网闸",
    role: "隔离 / 路由",
    place: "仅交换节点",
    cost: 45,
    intel: 8,
    hp: 380,
    range: 0,
    damage: 0,
    rate: 1,
    color: 0x7ff1ca,
    skill: "链路加固",
    desc: "关闭交换节点，重算所有入口与在场敌人的路线。不攻击；持续承受节点冲击。",
    upgrade: "自愈旁路：更高耐久，脱离攻击后持续自修复。",
    active: "获得 150 护盾，保护隔离状态。",
    cd: 28,
  },
  interceptor: {
    name: "拦截器",
    role: "远程 / 对空",
    place: "设备平台 · 有朝向",
    cost: 105,
    intel: 0,
    hp: 170,
    range: 4.4,
    damage: 27,
    rate: 0.75,
    color: 0x7fdff1,
    skill: "高频拦截",
    desc: "在朝向前方 160° 扇区攻击地面与飞行目标。不会主动锁定伪装木马。按 R 设置朝向。",
    branches: ["贯穿协议", "压制协议"],
    branchDetails: [
      "贯穿协议：火力范围扩展，同一直线的其他目标受到 75% 贯穿伤害。",
      "压制协议：优先打击飞行目标，每次命中造成持续 2.6 秒的 50% 减速。",
    ],
    upgrade:
      "贯穿协议：弹道穿透一条直线上的目标。压制协议：命中减速并优先压制飞行目标。",
    active: "6 秒内攻击频率翻倍。",
    cd: 25,
  },
  sandbox: {
    name: "沙箱",
    role: "检测 / 群攻",
    place: "设备平台",
    cost: 120,
    intel: 0,
    hp: 185,
    range: 3.3,
    damage: 23,
    rate: 1.7,
    color: 0xb6a0ff,
    skill: "深度扫描",
    desc: "持续揭露范围内伪装和潜伏目标；对地面目标发动范围攻击。",
    upgrade: "扩展分析：检测范围扩大，爆炸半径增加。",
    active: "扩大检测范围，立即对地面敌人发动扫描冲击。",
    cd: 26,
  },
  repair: {
    name: "修复进程",
    role: "治疗 / 支援",
    place: "设备平台",
    cost: 90,
    intel: 0,
    hp: 160,
    range: 3.5,
    damage: 0,
    rate: 0.5,
    color: 0x98f9bc,
    skill: "冗余切换",
    desc: "每秒恢复附近其他友塔 14 点生命；不会攻击敌人。加密时停止治疗。",
    upgrade: "并行修复：同时修复范围内所有受损友塔。",
    active: "为附近友塔提供 100 护盾，并解除加密。",
    cd: 24,
  },
};
const ENEMIES = {
  worm: {
    name: "蠕虫",
    hp: 60,
    speed: 1.25,
    damage: 12,
    rate: 1.1,
    reward: 10,
    weight: 1,
    color: 0xf87968,
    desc: "被阻挡时近战攻击；首次通过直通节点会复制一个不会再次复制的同伴。",
  },
  flood: {
    name: "洪泛团",
    hp: 195,
    speed: 0.78,
    damage: 40,
    rate: 1.4,
    reward: 24,
    weight: 2,
    color: 0xffa16a,
    desc: "占用 2 阻挡容量。离开路线逼近被隔离节点，重击网闸、防火墙和隔离器，击穿后重新寻路。",
  },
  trojan: {
    name: "木马",
    hp: 84,
    speed: 1.15,
    damage: 14,
    rate: 1.3,
    reward: 15,
    weight: 1,
    color: 0xf0aece,
    desc: "伪装时不能被远程单体选中；检测、旧链路与阻挡使其显形。未显形被范围攻击消灭会释放载荷，伤害附近塔。",
  },
  ransom: {
    name: "勒索者",
    hp: 110,
    speed: 0.88,
    damage: 19,
    rate: 2.6,
    reward: 22,
    weight: 1,
    color: 0xd48aff,
    desc: "移动中远程攻击 4.3 格内设备并加密 3 秒，优先攻击蜜罐；平台也会受攻击。",
  },
  flyer: {
    name: "伪热点",
    hp: 65,
    speed: 1.45,
    damage: 0,
    rate: 1,
    reward: 16,
    weight: 0,
    color: 0xff89b5,
    desc: "飞行单位，沿无线层直飞中枢，无视地形与阻挡；只能由拦截器攻击。",
  },
  shell: {
    name: "加壳器",
    hp: 145,
    speed: 0.82,
    damage: 11,
    rate: 1.5,
    reward: 24,
    weight: 1,
    color: 0xc1a0ff,
    desc: "接入 5 秒后首次提供护盾，此后每 4 秒为 2.8 格内同伴补充 32 点护盾；护盾先于生命承伤。",
  },
  boss0: {
    name: "万傀",
    hp: 2400,
    speed: 0.5,
    damage: 62,
    rate: 1.5,
    reward: 220,
    weight: 3,
    color: 0xff866b,
    boss: true,
    desc: "洪峰冲击隔离节点并冲毁隔离器；生命降至 68% 与 35% 以下时释放成群蠕虫，强化节点攻势。",
  },
  boss1: {
    name: "蜃楼",
    hp: 2800,
    speed: 0.48,
    damage: 48,
    rate: 1.8,
    reward: 250,
    weight: 3,
    color: 0xbc8fff,
    boss: true,
    desc: "预警后在链路制造临时路由黑洞；低生命时发动风暴削弱友塔护盾。始终保留业务通路。",
  },
  boss2: {
    name: "蛰影",
    hp: 3400,
    speed: 0.5,
    damage: 60,
    rate: 1.7,
    reward: 300,
    weight: 3,
    color: 0xff7895,
    boss: true,
    desc: "潜伏时需要检测。提权时增加护甲并释放木马，破坏阶段预警后锁死一段运维环，迫使流量收敛。",
  },
};
const ITEMS = {
  isolate: {
    name: "应急隔离器",
    cost: 12,
    resource: "intel",
    cd: 22,
    range: 0,
    place: "直通交换节点",
    desc: "隔离 18 秒，220 耐久；可被冲毁，不产生情报。",
  },
  downgrade: {
    name: "协议降级",
    cost: 10,
    resource: "intel",
    cd: 20,
    range: 2.6,
    place: "链路区域",
    desc: "半径 2.6 格内降级协议 14 秒：减速 45% 并显形，路线重新收敛。",
  },
  restore: {
    name: "备份还原",
    cost: 50,
    resource: "compute",
    cd: 16,
    range: 0.8,
    place: "受损设备",
    desc: "恢复 160 生命并解除加密。",
  },
};
const MAPS = [
  {
    name: "分段内网",
    code: "SECTOR 01 / ENTERPRISE",
    type: "企业网 · 分段与汇流",
    waves: 14,
    color: 0x7beac7,
    desc: "双入口接入 DMZ，沿办公网段与业务网段通往核心数据库。",
    strategy:
      "隔离西边界，让门户流量转入 DMZ。守住核心前节点，把两股流量导向外围灾备环。",
    w: 15,
    h: 14,
    entries: [
      { id: "A", name: "门户网站", x: 1, y: 2, color: 0x55e4c5 },
      { id: "B", name: "邮件网关", x: 13, y: 2, color: 0xffbe73 },
    ],
    exits: [{ id: "X", name: "核心数据库", x: 7, y: 12 }],
    segments: [
      [1, 2, 13, 2],
      [3, 2, 3, 10],
      [11, 2, 11, 10],
      [3, 4, 11, 4],
      [7, 4, 7, 12],
      [1, 10, 13, 10],
      [1, 2, 1, 12],
      [13, 2, 13, 12],
      [1, 12, 13, 12],
    ],
    nodes: [
      [3, 6, "西边界"],
      [11, 3, "东边界"],
      [7, 11, "核心汇聚"],
    ],
    old: [
      [1, 3, 1, 11],
      [13, 3, 13, 11],
      [5, 4, 9, 4],
      [11, 5, 11, 9],
    ],
    zones: [
      [5, 6, "办公网段"],
      [9, 6, "业务网段"],
      [7, 2, "DMZ"],
      [3, 12, "灾备环"],
    ],
  },
  {
    name: "骨干流域",
    code: "SECTOR 02 / BACKBONE",
    type: "跨网专线 · 双活中枢",
    waves: 15,
    color: 0x79c9ed,
    desc: "三路跨网流量穿过公网，双活数据中心共享一条旧专线。",
    strategy:
      "汇聚节点控制分支与云端的目的地。公网两侧的火力必须兼顾对空与网闸生存。",
    w: 17,
    h: 13,
    entries: [
      { id: "A", name: "互联网", x: 1, y: 1, color: 0x55e4c5 },
      { id: "B", name: "云端互联", x: 15, y: 1, color: 0xffbe73 },
      { id: "C", name: "分支专线", x: 8, y: 1, color: 0xb8a0ff },
    ],
    exits: [
      { id: "X", name: "数据中心 X", x: 2, y: 11 },
      { id: "Y", name: "数据中心 Y", x: 12, y: 11 },
    ],
    segments: [
      [1, 1, 15, 1],
      [2, 1, 2, 11],
      [8, 1, 8, 8],
      [14, 1, 14, 8],
      [2, 5, 8, 5],
      [2, 8, 14, 8],
      [12, 8, 12, 11],
      [2, 11, 12, 11],
    ],
    nodes: [
      [2, 6, "专线隧道"],
      [8, 3, "分支交换"],
      [12, 9, "双活汇聚"],
    ],
    old: [
      [8, 8, 12, 8],
      [3, 8, 7, 8],
      [3, 5, 7, 5],
      [3, 1, 7, 1],
    ],
    zones: [
      [5, 3, "跨网专线"],
      [10, 7, "旧专线"],
      [6, 10, "双活集群"],
    ],
  },
  {
    name: "气隙深层",
    code: "SECTOR 03 / INDUSTRIAL",
    type: "工控网 · 运维环路",
    waves: 16,
    color: 0xf0b071,
    desc: "绕行中央气隙的狭窄运维环，同时连接过程控制与安全联锁。",
    strategy:
      "两侧运维环相互牵制；提前留好备用火力。沙箱检测蛰影，修复进程维持关键隔离点。",
    w: 18,
    h: 14,
    entries: [
      { id: "A", name: "运维跳板机", x: 3, y: 0, color: 0x55e4c5 },
      { id: "B", name: "办公网下行", x: 13, y: 0, color: 0xffbe73 },
      { id: "C", name: "供应商维护", x: 16, y: 6, color: 0xb8a0ff },
    ],
    exits: [
      { id: "X", name: "过程控制核心", x: 5, y: 12 },
      { id: "Y", name: "安全联锁核心", x: 11, y: 12 },
    ],
    segments: [
      [3, 0, 3, 10],
      [13, 0, 13, 10],
      [1, 2, 15, 2],
      [3, 10, 13, 10],
      [13, 6, 16, 6],
      [5, 10, 5, 12],
      [11, 10, 11, 12],
      [1, 2, 1, 12],
      [15, 2, 15, 12],
      [1, 12, 5, 12],
      [11, 12, 15, 12],
    ],
    nodes: [
      [3, 6, "西运维环"],
      [13, 8, "东运维环"],
      [5, 11, "过程隔离"],
      [11, 11, "联锁隔离"],
    ],
    old: [
      [1, 3, 1, 11],
      [15, 3, 15, 11],
    ],
    zones: [
      [8, 6, "AIR GAP / 中央气隙"],
      [5, 3, "运维环"],
      [11, 9, "老工控总线"],
    ],
  },
];
function makeMap(index) {
  const m = MAPS[index],
    cells = new Map();
  function line(a, fn) {
    const [x, y, u, v] = a,
      dx = Math.sign(u - x),
      dy = Math.sign(v - y);
    for (let t = 0; t <= Math.abs(u - x) + Math.abs(v - y); t++)
      fn(x + dx * t, y + dy * t);
  }
  m.segments.forEach((s) =>
    line(s, (x, y) =>
      cells.set(x + "," + y, {
        id: x + "," + y,
        x,
        y,
        type: "road",
        old: false,
      }),
    ),
  );
  m.old.forEach((s) =>
    line(s, (x, y) => {
      let c = cells.get(x + "," + y);
      if (c) {
        c.old = true;
        c.cost = index === 1 && x < 8 ? 1.9 : 1.65;
      }
    }),
  );
  m.entries.forEach((e) =>
    Object.assign(cells.get(e.x + "," + e.y), { type: "entry", entry: e }),
  );
  m.exits.forEach((e) =>
    Object.assign(cells.get(e.x + "," + e.y), { type: "exit", exit: e }),
  );
  m.nodes.forEach(([x, y, name], i) =>
    Object.assign(cells.get(x + "," + y), {
      type: "node",
      name,
      number: i + 1,
    }),
  );
  let platforms = [];
  for (let y = 1; y < m.h - 1; y++)
    for (let x = 1; x < m.w - 1; x++) {
      if (cells.has(x + "," + y)) continue;
      if (index === 2 && x >= 5 && x <= 11 && y >= 4 && y <= 8) continue;
      const n = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => cells.has(x + dx + "," + (y + dy)));
      if (n.length && ((x + y) % 3 === 0 || n.length >= 3)) {
        const c = { id: x + "," + y, x, y, type: "platform" };
        platforms.push(c);
      }
    }
  platforms.forEach((c) => cells.set(c.id, c));
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++)
      if (!cells.has(x + "," + y))
        cells.set(x + "," + y, {
          id: x + "," + y,
          x,
          y,
          type: "obstacle",
          name:
            index === 2 && x >= 5 && x <= 11 && y >= 4 && y <= 8
              ? "中央气隙"
              : index === 1 && (y === 6 || y === 7)
                ? "公网流"
                : "网络设施",
        });
  return { ...m, index, cells, platforms };
}
function wavePlan(map, wave) {
  const keys = ["worm", "flood", "trojan", "ransom", "flyer", "shell"],
    flood = map.index > 0 && wave === 8;
  let entries = map.entries.filter(
    (e, i) => wave > 2 || i === (wave - 1) % map.entries.length,
  );
  let plan = [];
  entries.forEach((entry, j) => {
    let count = flood ? 12 : 3 + Math.floor(wave * 0.65);
    for (let i = 0; i < count; i++) {
      let unlocked = Math.min(6, Math.ceil(wave / 2));
      let type = keys[(i + wave + j) % unlocked];
      if (flood && i % 3 === 0) type = "flood";
      plan.push({
        entry: entry.id,
        type,
        time: i * (flood ? 0.65 : 1.12) + j * 0.35,
      });
    }
  });
  if (wave === map.waves)
    plan.push({ entry: map.entries[0].id, type: "boss" + map.index, time: 3 });
  return plan.sort((a, b) => a.time - b.time);
}
