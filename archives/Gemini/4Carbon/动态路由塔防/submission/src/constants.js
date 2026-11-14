// 游戏核心常量、单位定义、道具、状态与图鉴说明（单一数据源，确保说明与实际机制完全一致）

export const TILE = {
  VOID: 0,
  LINK: 1,        // 标准链路：地面单位通行，可部署防火墙、蜜罐
  LEGACY: 2,      // 旧链路：保留旧协议，地面敌人减速(0.55x)且伪装显形，寻路代价更高
  PLATFORM: 3,    // 设备平台：高台，敌人不可通行，部署拦截器、沙箱、修复进程
  NODE: 4,        // 交换节点：链路交汇处，可部署防火墙、网闸或投放应急隔离器进行隔离
  OBSTACLE: 5,    // 障碍：数据设施、公网流、物理气隙等，不可通行不可部署
  ENTRY: 6,       // 流量入口
  EXIT: 7         // 中枢出口
};

export const TILE_SIZE = 2.0; // 每格三维世界尺寸

export const ROUTE_COSTS = {
  LINK: 1.0,
  NODE: 1.0,
  ENTRY: 1.0,
  EXIT: 1.0,
  LEGACY: 1.85     // 较低通行速度对应较高路由开销，敌人寻路会综合评估通行时间
};

export const LEGACY_SPEED_MULT = 0.55;
export const NODE_REISOLATE_COOLDOWN = 10.0; // 节点恢复直通后的再次隔离冷却（秒）
export const SELL_REFUND_RATIO = 0.65;       // 撤下塔退还算力比例

export const ENTRY_COLORS = {
  A: { hex: 0x00e5ff, css: '#00e5ff', name: '青域流' },
  B: { hex: 0xff4dd8, css: '#ff4dd8', name: '品红流' },
  C: { hex: 0xffb703, css: '#ffb703', name: '琥珀流' }
};

export const TERRAIN_DOCS = [
  {
    id: 'link',
    name: '标准链路',
    badge: '通行道路 / 近战部署',
    color: '#29b6f6',
    desc: '承载正常业务流量与恶意程序的标准高速传输链路。可在入口、出口之外的链路上部署「防火墙」与「蜜罐」：它们阻挡规定容量的地面敌人交战，但不会截断道路通行，超出容量的敌人继续前进。'
  },
  {
    id: 'legacy',
    name: '旧链路',
    badge: '减速 45% / 强制显形',
    color: '#ff9800',
    desc: '保留老旧明文协议的低速网段。经过的地面敌人移动速度降至 55%，且处于伪装态的「木马」或潜伏态目标踏上后立即显形。敌人在计算最短到达时间路线时，会将旧链路较慢的通行速度纳入开销。'
  },
  {
    id: 'node',
    name: '交换节点',
    badge: '路由枢纽 / 可隔离改道',
    color: '#00e676',
    desc: '多条链路交汇的核心交换设备。直通时允许流量通过（蠕虫首次经过直通节点会复制同伴）；部署「防火墙」「网闸」或插入「应急隔离器」后闭合闸门隔离节点，截断该格通行并触发全域路由重收敛。节点恢复直通后有 10 秒再次隔离冷却。'
  },
  {
    id: 'platform',
    name: '设备平台',
    badge: '高台支援 / 不可通行',
    color: '#7c4dff',
    desc: '高于链路的悬浮硬件基座，地面敌人无法通行。专用于部署「拦截器」「沙箱」和「修复进程」三类远程、检测与支援守护单元。'
  },
  {
    id: 'obstacle',
    name: '网络障碍与气隙',
    badge: '不可通行 / 不可部署',
    color: '#78909c',
    desc: '包括机柜设施、横贯战场的湍急公网数据流及工控物理气隙隔离井。地面单位与守方设备均无法占用，但无线层的飞行单位「伪热点」可直接飞越。'
  }
];

export const STATUS_DOCS = [
  {
    id: 'disguise',
    name: '伪装 / 潜伏与显形',
    color: '#b388ff',
    desc: '「木马」与潜伏阶段的「蛰影」伪装在正常数据包中，显形前无法被「拦截器」等远程单体火力主动选中。进入「沙箱」检测范围、踏上「旧链路」（含协议降级区域）或被近战塔阻挡时永久显形。注意：木马若在未显形时被范围或贯穿伤害波及消灭，会释放恶意载荷炸伤附近守方设备。'
  },
  {
    id: 'shield',
    name: '能量护盾',
    color: '#40c4ff',
    desc: '可吸收伤害的临时防护层。守方由「修复进程」的冗余切换、网闸硬锁死等提供；敌方由「加壳器」或首领阶段技能赋予。护盾存在时优先抵扣护盾值。「拦截器」的穿透轨道炮分支与「沙箱」全域扫描对敌方护盾有克制效果，「蜃楼」的路由风暴则会削弱守方护盾。'
  },
  {
    id: 'encrypted',
    name: '勒索加密',
    color: '#ea80fc',
    desc: '由「勒索者」远程攻击或首领脉冲施加。被加密的塔缠绕数字锁链，暂时停止攻击、停止治疗且无法释放主动技能，但不会解除已有的地面阻挡，也不会解除交换节点的隔离状态。可通过「修复进程」的冗余切换（及 2 级自动净化）或道具「备份还原」立即解除；「蜜罐」天生免疫加密。'
  },
  {
    id: 'isolated',
    name: '节点隔离与旁路冷却',
    color: '#ff6e40',
    desc: '交换节点部署设备或隔离器后进入隔离态，截断通行并在交战防守期间持续产出少量「情报」。若节点设备被摧毁、撤下或隔离器失效，触发「设备旁路直通」重新开放道路，且在 10 秒硬件保护期内不可再次隔离，防止无代价反复切换节点。'
  }
];

export const TOWERS = {
  firewall: {
    id: 'firewall',
    name: '防火墙',
    role: '阻挡 / 节点拦截',
    category: '链路 / 节点',
    placeOn: [TILE.LINK, TILE.LEGACY, TILE.NODE],
    costCompute: 90,
    nodeIntelCost: 15, // 部署在节点上触发隔离时额外消耗的情报
    color: 0x29b6f6,
    accent: '#29b6f6',
    oriented: false,
    shortDesc: '高耐久近战防线；置入链路阻挡并反击，置入节点则隔离道路并跨格拦截邻路敌人。',
    lv1: {
      maxHp: 1000,
      blockCap: 3,
      nodeBlockCap: 2,
      atk: 46,
      atkInterval: 1.05,
      range: 1.25,
      armor: 0.12,
      desc: '链路部署阻挡 3 容量地面敌人并脉冲还击；节点部署闭合闸门隔离道路，伸出力场臂拦截相邻链路最多 2 容量敌人。'
    },
    lv2: {
      name: '深度包检防火墙',
      costCompute: 110,
      costIntel: 0,
      maxHp: 1600,
      blockCap: 4,
      nodeBlockCap: 3,
      atk: 68,
      atkInterval: 0.95,
      range: 1.45,
      armor: 0.22,
      cleave: true,
      selfCleanseEvery: 3,
      desc: '升级后阻挡容量 +1，近战还击变为扇形电弧顺劈（同时打击同格多名被挡敌人），且每 3 次攻击触发规则自愈（回复 45 生命并剥离目标一层护盾）。'
    },
    skill: {
      id: 'packet_scrub',
      name: '数据包清洗',
      cooldown: 18,
      desc: '释放高压清洗脉冲，对周围 1.7 格地面敌人造成 150 点范围伤害、短暂击退并获得 6 秒 45% 减伤加固。'
    }
  },

  honeypot: {
    id: 'honeypot',
    name: '蜜罐',
    role: '诱敌阻挡 / 免加密',
    category: '仅链路',
    placeOn: [TILE.LINK, TILE.LEGACY],
    costCompute: 75,
    nodeIntelCost: 0,
    color: 0xffca28,
    accent: '#ffca28',
    oriented: false,
    immuneEncrypt: true,
    shortDesc: '伪造高价值服务吸引敌方攻塔火力，天生免疫勒索加密；主动技能可定身困住周围敌人。',
    lv1: {
      maxHp: 720,
      blockCap: 3,
      atk: 18,
      atkInterval: 1.2,
      range: 1.15,
      tauntRange: 2.9,
      armor: 0.08,
      desc: '耐久中等但免疫加密。持续吸引 2.9 格内勒索者与攻塔敌人优先攻击自身，保护脆弱平台与节点设备。'
    },
    branches: {
      A: {
        id: 'A',
        name: '高交互蜜网',
        costCompute: 95,
        costIntel: 14,
        maxHp: 1120,
        blockCap: 4,
        atk: 34,
        atkInterval: 1.0,
        range: 1.25,
        tauntRange: 3.1,
        armor: 0.15,
        reflectRatio: 0.45,
        intelOnKill: 2,
        desc: '【逆向溯源分支】阻挡升至 4，对攻击自身的敌人反弹伤害并使其显形；每当被其阻挡或诱捕的敌人被消灭时，额外汲取 +2 情报。'
      },
      B: {
        id: 'B',
        name: '镜像诱饵阵',
        costCompute: 95,
        costIntel: 14,
        maxHp: 960,
        blockCap: 3,
        atk: 22,
        atkInterval: 1.15,
        range: 1.2,
        tauntRange: 4.0,
        armor: 0.18,
        decoyShield: 320,
        decoyPeriod: 8.0,
        interceptProjectiles: true,
        desc: '【偏转护卫分支】嘲讽半径扩至 4.0 格，周期性生成 320 点全息诱饵护盾，并强制偏转射向范围内友方塔的敌方远程攻击由自身承受。'
      }
    },
    skill: {
      id: 'entrap',
      name: '诱捕',
      cooldown: 19,
      desc: '展开虚拟沙盒牢笼，将周围 2.3 格内地面敌人定身困住 4.5 秒、强制显形，并使其期间受到的伤害提高 30%。'
    }
  },

  airgap: {
    id: 'airgap',
    name: '网闸',
    role: '节点隔离',
    category: '仅节点',
    placeOn: [TILE.NODE],
    costCompute: 45,
    nodeIntelCost: 12,
    color: 0xff7043,
    accent: '#ff7043',
    oriented: false,
    shortDesc: '低成本高耐久的专职节点隔离闸门，不进行攻击，用于重塑入侵路由。',
    lv1: {
      maxHp: 1450,
      blockCap: 0,
      atk: 0,
      atkInterval: 0,
      range: 0,
      armor: 0.18,
      desc: '低算力封闭交换节点控制道路。不攻击敌人，但具备高结构耐久以抵御洪泛团冲击与远程破坏。'
    },
    lv2: {
      name: '单向物理光闸',
      costCompute: 75,
      costIntel: 0,
      maxHp: 2450,
      blockCap: 0,
      atk: 0,
      atkInterval: 0,
      range: 1.5,
      armor: 0.34,
      auraSlow: 0.30,
      desc: '大幅强化钨钢闸体与冲击减伤，并展开电磁阻尼场使相邻链路上的地面敌人减速 30%；若被摧毁触发熔断震波击退周围敌人。'
    },
    skill: {
      id: 'hard_lock',
      name: '紧急物理锁死',
      cooldown: 20,
      desc: '闭合超导电磁锁，立即获得 520 点护盾并恢复 260 点结构耐久。'
    }
  },

  interceptor: {
    id: 'interceptor',
    name: '拦截器',
    role: '定向远程 / 对空',
    category: '设备平台（需定朝向）',
    placeOn: [TILE.PLATFORM],
    costCompute: 100,
    nodeIntelCost: 0,
    color: 0x00e5ff,
    accent: '#00e5ff',
    oriented: true,
    canHitAir: true,
    shortDesc: '部署时设定朝向，对前方射界内的地面或无线层飞行目标进行精准远程打击。',
    lv1: {
      maxHp: 640,
      atk: 62,
      atkInterval: 0.72,
      forwardLen: 4.3,
      halfWidth: 1.55,
      armor: 0.05,
      desc: '在朝向决定的前向矩形扇区内高速单点射击，可同时对付地面与飞行敌人「伪热点」（无法主动选中未显形的伪装目标）。'
    },
    branches: {
      A: {
        id: 'A',
        name: '穿透轨道炮',
        costCompute: 120,
        costIntel: 16,
        maxHp: 880,
        atk: 138,
        atkInterval: 1.18,
        forwardLen: 5.6,
        halfWidth: 1.55,
        armor: 0.10,
        pierceLine: true,
        shieldMult: 2.3,
        desc: '【直线贯穿破盾】射程延伸至 5.6 格，发射电磁束贯穿直线上所有目标，并对护盾与重甲造成 2.3 倍伤害（注意贯穿波及未显形木马会触发载荷）。'
      },
      B: {
        id: 'B',
        name: '压制防空阵',
        costCompute: 120,
        costIntel: 16,
        maxHp: 900,
        atk: 54,
        atkInterval: 0.52,
        forwardLen: 4.5,
        halfWidth: 2.15,
        armor: 0.10,
        multiTargets: 2,
        slowPct: 0.42,
        slowDur: 2.3,
        preferAir: true,
        desc: '【多目标压制减速】射界加宽，每次齐射锁定最多 2 个目标（优先锁定飞行伪热点），命中施加 42% 带宽限流减速 2.3 秒。'
      }
    },
    skill: {
      id: 'overclock',
      name: '超频齐射',
      cooldown: 18,
      desc: '超频武器总线 5.5 秒：攻击速度提升 80%、伤害提升 25%（压制分支额外增加 1 个同时锁定目标）。'
    }
  },

  sandbox: {
    id: 'sandbox',
    name: '沙箱',
    role: '检测显形 / 地面群攻',
    category: '设备平台',
    placeOn: [TILE.PLATFORM],
    costCompute: 115,
    nodeIntelCost: 0,
    color: 0x00e676,
    accent: '#00e676',
    oriented: false,
    shortDesc: '实时剥离范围内木马与潜伏目标的伪装，并对汇聚的地面流量投射范围解析爆破。',
    lv1: {
      maxHp: 660,
      atk: 55,
      atkInterval: 1.35,
      range: 2.85,
      splashRadius: 1.35,
      armor: 0.06,
      desc: '半径 2.85 格扫描域内所有伪装/潜伏敌人立即显形；周期性对地面目标群发动半径 1.35 格范围解析伤害。'
    },
    lv2: {
      name: '启发式深度沙箱',
      costCompute: 130,
      costIntel: 0,
      maxHp: 960,
      atk: 82,
      atkInterval: 1.22,
      range: 3.35,
      splashRadius: 1.6,
      armor: 0.12,
      leaveZone: true,
      zoneDps: 28,
      zoneDur: 3.0,
      desc: '扫描半径扩至 3.35 格；每次范围爆破在地面留下 3 秒特征码隔离区，持续灼烧经过的敌人、维持显形并阻止其获得新护盾。'
    },
    skill: {
      id: 'deep_scan',
      name: '全域特征扫描',
      cooldown: 20,
      desc: '释放半径 4.6 格脉冲，瞬间使范围内所有伪装目标永久显形、击碎敌方 60% 护盾并造成 135 点范围伤害。'
    }
  },

  repair: {
    id: 'repair',
    name: '修复进程',
    role: '专职治疗 / 净除加密',
    category: '设备平台',
    placeOn: [TILE.PLATFORM],
    costCompute: 85,
    nodeIntelCost: 0,
    color: 0x69f0ae,
    accent: '#69f0ae',
    oriented: false,
    shortDesc: '持续恢复受损友塔与节点设备生命；主动技能「冗余切换」群体套盾并解除勒索加密。',
    lv1: {
      maxHp: 680,
      heal: 58,
      atkInterval: 1.0,
      range: 3.3,
      targets: 1,
      armor: 0.08,
      desc: '不攻击敌人，持续修复 3.3 格内生命比例最低的友方塔（含节点上的防火墙与网闸）。'
    },
    lv2: {
      name: '分布式守护集群',
      costCompute: 105,
      costIntel: 0,
      maxHp: 1020,
      heal: 76,
      atkInterval: 0.9,
      range: 3.85,
      targets: 2,
      autoCleanseInterval: 7.5,
      overhealShield: 140,
      armor: 0.14,
      desc: '范围扩至 3.85 格，派出双无人机同时治疗 2 座友塔（溢出治疗转化为最多 140 护盾），且每 7.5 秒自动解除 1 座友塔的加密状态。'
    },
    skill: {
      id: 'failover',
      name: '冗余切换',
      cooldown: 20,
      desc: '立即解除范围内所有友方塔的「加密」状态，恢复 180 点生命并赋予持续 10 秒的 360 点高强吸收护盾。'
    }
  }
};

export const ITEMS = {
  isolator: {
    id: 'isolator',
    name: '应急隔离器',
    costType: 'intel',
    cost: 14,
    cooldown: 20,
    targetLabel: '直通交换节点',
    duration: 16.0,
    maxHp: 560,
    color: '#ffab40',
    desc: '在直通且未处于冷却的交换节点插入临时激光隔离器（耐久 560，持续 16 秒），截断通行改变路线。会被敌人冲毁，不产出守点情报。'
  },
  downgrade: {
    id: 'downgrade',
    name: '协议降级',
    costType: 'intel',
    cost: 16,
    cooldown: 18,
    targetLabel: '链路区域 (半径 1.7 格)',
    radius: 1.75,
    duration: 12.0,
    color: '#ffd740',
    desc: '令目标区域内的标准链路在 12 秒内降级运行旧协议：经过的地面敌人减速至 55%、伪装木马立即显形，且敌人的路线会随通行速度变化重新选择。'
  },
  restore: {
    id: 'restore',
    name: '备份还原',
    costType: 'compute',
    cost: 55,
    cooldown: 15,
    targetLabel: '受损或被加密友塔',
    healRatio: 0.48,
    minHeal: 360,
    shieldBonus: 150,
    color: '#69f0ae',
    desc: '调取干净快照还原一座友方塔：立即恢复其 48% 最大生命（至少 360 点）、解除「加密」状态并附加 150 点临时护盾。'
  }
};

export const ENEMIES = {
  worm: {
    id: 'worm',
    name: '蠕虫',
    badge: '近战噬塔 / 节点复制',
    color: 0xff5252,
    cssColor: '#ff5252',
    maxHp: 230,
    speed: 1.32,
    blockCost: 1,
    towerAtk: 28,
    atkInterval: 0.95,
    rewardCompute: 12,
    rewardIntel: 0,
    coreDamage: 1,
    flying: false,
    desc: '高繁殖恶意程序。被阻挡时持续撕咬挡住它的塔；首次经过处于直通状态的交换节点时分裂复制出 1 只次生蠕虫（复制体不再复制）。'
  },
  flood: {
    id: 'flood',
    name: '洪泛团',
    badge: '重型占阻 / 冲击隔离点',
    color: 0xff6d00,
    cssColor: '#ff6d00',
    maxHp: 680,
    speed: 0.88,
    blockCost: 2,
    towerAtk: 65,
    nodeStrikeMult: 1.85,
    atkInterval: 1.25,
    nodeSenseDist: 6,
    rewardCompute: 26,
    rewardIntel: 3,
    coreDamage: 2,
    flying: false,
    desc: '高压流量聚合体，占用 2 点阻挡容量。感知到附近有被隔离节点时会主动脱离原路线，前往节点可通行侧重击塔或隔离器；打通后沿新开放道路推进。'
  },
  trojan: {
    id: 'trojan',
    name: '木马',
    badge: '流量伪装 / 隐匿载荷',
    color: 0xce93d8,
    cssColor: '#ce93d8',
    maxHp: 280,
    speed: 1.22,
    blockCost: 1,
    towerAtk: 24,
    atkInterval: 1.05,
    payloadDamage: 165,
    payloadRadius: 2.25,
    rewardCompute: 16,
    rewardIntel: 1,
    coreDamage: 1,
    flying: false,
    startsDisguised: true,
    desc: '伪装成正常数据包，显形前无法被远程单体火力主动选中。经沙箱检测、踏上旧链路或被近战阻挡后显形；若未显形就被范围/贯穿攻击波及消灭，会释放载荷炸伤附近守方塔。'
  },
  ransom: {
    id: 'ransom',
    name: '勒索者',
    badge: '移动远攻 / 施加加密',
    color: 0xe040fb,
    cssColor: '#e040fb',
    maxHp: 370,
    speed: 0.96,
    blockCost: 1,
    towerAtk: 34,
    rangedRange: 3.25,
    atkInterval: 1.45,
    encryptHits: 2,
    encryptDur: 5.2,
    rewardCompute: 22,
    rewardIntel: 2,
    coreDamage: 1,
    flying: false,
    desc: '边移动边从远处射击 3.25 格内的守方塔（包括平台塔与节点塔），造成伤害并施加「加密」使其停火；射程内有蜜罐时必定优先攻击蜜罐。'
  },
  rogue_ap: {
    id: 'rogue_ap',
    name: '伪热点',
    badge: '无线飞行 / 无视地形',
    color: 0x18ffff,
    cssColor: '#18ffff',
    maxHp: 250,
    speed: 1.18,
    blockCost: 0,
    towerAtk: 0,
    atkInterval: 0,
    rewardCompute: 18,
    rewardIntel: 1,
    coreDamage: 1,
    flying: true,
    desc: '沿上方无线层从入口直飞最近中枢出口，不受地面道路、交换节点隔离与近战阻挡影响，需依靠平台上的「拦截器」对空清除。'
  },
  packer: {
    id: 'packer',
    name: '加壳器',
    badge: '群体护盾支援',
    color: 0xffd54f,
    cssColor: '#ffd54f',
    maxHp: 430,
    speed: 0.94,
    blockCost: 1,
    towerAtk: 20,
    atkInterval: 1.2,
    shieldAmount: 190,
    shieldRadius: 2.65,
    shieldPeriod: 4.5,
    rewardCompute: 24,
    rewardIntel: 2,
    coreDamage: 1,
    flying: false,
    desc: '周期性为周围 2.65 格内同伴编译附加 190 点可破除护盾，保护集群强突防线，迫使守方权衡破盾手段与目标优先级。'
  }
};

export const BOSSES = {
  wankuai: {
    id: 'wankuai',
    name: '万傀',
    title: '僵尸网络主控母巢',
    mapName: '分段内网 · 第 14 波',
    color: 0xff1744,
    cssColor: '#ff1744',
    maxHp: 4600,
    speed: 0.56,
    blockCost: 4,
    towerAtk: 95,
    atkInterval: 1.3,
    rewardCompute: 120,
    rewardIntel: 15,
    coreDamage: 8,
    flying: false,
    isBoss: true,
    desc: '僵尸网络群体控制首领。阶段一周期性预警并发动「洪峰」远程重创被隔离节点上的塔、直接冲毁应急隔离器；生命降至 55% 进入阶段二「傀儡裂变」，持续向周围释放成群次生蠕虫冲击防线。'
  },
  shenlou: {
    id: 'shenlou',
    name: '蜃楼',
    title: 'BGP 路由欺骗利维坦',
    mapName: '骨干流域 · 第 15 波',
    color: 0xff9100,
    cssColor: '#ff9100',
    maxHp: 5400,
    speed: 0.54,
    blockCost: 4,
    towerAtk: 88,
    atkInterval: 1.25,
    rewardCompute: 140,
    rewardIntel: 18,
    coreDamage: 8,
    flying: false,
    isBoss: true,
    desc: '路由劫持首领。预警后在前方链路制造临时「伪路由黑洞」（自动避开会彻底封死通路的位置），截断道路迫使各入口实时改道；生命降至 55% 发动「路由风暴」，大范围击碎并削弱附近守方塔的护盾。'
  },
  zheying: {
    id: 'zheying',
    name: '蛰影',
    title: 'APT 核心潜伏执政官',
    mapName: '气隙深层 · 第 16 波',
    color: 0xd500f9,
    cssColor: '#d500f9',
    maxHp: 6400,
    speed: 0.52,
    blockCost: 4,
    towerAtk: 105,
    atkInterval: 1.2,
    rewardCompute: 160,
    rewardIntel: 20,
    coreDamage: 10,
    flying: false,
    isBoss: true,
    startsDisguised: true,
    desc: '攻击组织终极首领，按三阶段演进：【潜伏】(100%-70%) 处于隐匿态，需沙箱检测/旧链路/阻挡显形后方可被远程单体选中；【提权】(70%-38%) 展开重甲减伤并释放伪装木马护卫；【破坏】(<38%) 预警后锁死前方一段运维环改变全域路由，并释放高压加密脉冲。'
  }
};
