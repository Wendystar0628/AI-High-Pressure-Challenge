import type { BranchId, EnemyType, ItemId, TowerType } from './types';

export const GAME_CONSTANTS = {
  TILE_SIZE: 2.0,
  PLATFORM_HEIGHT: 0.56,
  NODE_HEIGHT: 0.08,
  FLY_HEIGHT: 2.25,
  LEGACY_SPEED_MULT: 0.55,
  LEGACY_PATH_COST: 1.85,
  NODE_REISOLATE_COOLDOWN: 4.5,
  REFUND_RATIO: 0.65,
  PASSIVE_COMPUTE_PER_SEC: 4.2,
  NODE_HOLD_INTEL_INTERVAL: 4.0,
  ISOLATOR_DURATION: 15.0,
  ISOLATOR_HP: 380,
  DOWNGRADE_DURATION: 10.0,
  DOWNGRADE_RADIUS: 1.6,
  RESTORE_HEAL_AMOUNT: 360,
  RESTORE_HEAL_RATIO: 0.55,
  TROJAN_PAYLOAD_DMG: 145,
  TROJAN_PAYLOAD_RADIUS: 1.95,
  RANSOM_ENCRYPT_DURATION: 4.5,
  PACKER_SHIELD_RADIUS: 2.35,
  PACKER_SHIELD_MAX: 110,
  PACKER_SHIELD_RATE: 38,
};

export interface TowerBranchConfig {
  id: BranchId;
  name: string;
  tag: string;
  computeCost: number;
  intelCost: number;
  maxHpBonus: number;
  blockBonus?: number;
  rangeBonus?: number;
  damageMult?: number;
  rateMult?: number;
  skillCdMult?: number;
  summary: string;
  behaviorBullet: string[];
}

export interface TowerConfig {
  type: TowerType;
  category: 'defense' | 'support';
  name: string;
  role: string;
  shortDesc: string;
  allowedTiles: Array<'link' | 'legacy' | 'node' | 'platform'>;
  hasDirection: boolean;
  computeCost: number;
  nodeIntelCost: number; // extra intel required if placed on a node
  maxHp: number;
  lv2Hp: number;
  lv2ComputeCost: number;
  lv2Name: string;
  lv2Summary: string;
  blockCap: number;
  lv2BlockCap: number;
  attackDamage: number;
  lv2Damage: number;
  attackInterval: number;
  range: number; // grid tiles
  lv2Range: number;
  healPerSec: number;
  lv2HealPerSec: number;
  skillName?: string;
  skillCooldown?: number;
  skillDesc?: string;
  branches?: [TowerBranchConfig, TowerBranchConfig];
  traits: string[];
  colorHex: string;
  accentHex: number;
}

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  firewall: {
    type: 'firewall',
    category: 'defense',
    name: '防火墙',
    role: '阻挡 / 节点护卫',
    shortDesc: '部署于链路或交换节点，阻挡近战敌人并反击；置于节点时隔离道路并拦截相邻链路目标。',
    allowedTiles: ['link', 'legacy', 'node'],
    hasDirection: false,
    computeCost: 65,
    nodeIntelCost: 14,
    maxHp: 560,
    lv2Hp: 900,
    lv2ComputeCost: 75,
    lv2Name: '深度包检测矩阵',
    lv2Summary: '阻挡容量提升至 3，生命大幅强化，并可同时横扫反击最多 2 个被阻挡目标。',
    blockCap: 2,
    lv2BlockCap: 3,
    attackDamage: 38,
    lv2Damage: 56,
    attackInterval: 0.95,
    range: 1.25,
    lv2Range: 1.35,
    healPerSec: 0,
    lv2HealPerSec: 0,
    traits: [
      '链路部署：拦截最多 2 名地面敌人（2级为 3 名），超出阻挡上限的敌人可继续通过',
      '节点部署：消耗额外情报隔离节点，向四邻链路投射拦截栅栏并持续守卫产出情报',
      '可揭示被自身阻挡的伪装木马',
    ],
    colorHex: '#38bdf8',
    accentHex: 0x38bdf8,
  },
  honeypot: {
    type: 'honeypot',
    category: 'defense',
    name: '蜜罐',
    role: '诱敌阻挡 / 免疫加密',
    shortDesc: '仅部署于链路，释放伪造服务应答吸引附近攻塔敌人火力，免疫加密；主动技“诱捕”定身来犯目标。',
    allowedTiles: ['link', 'legacy'],
    hasDirection: false,
    computeCost: 55,
    nodeIntelCost: 0,
    maxHp: 320,
    lv2Hp: 460,
    lv2ComputeCost: 70,
    lv2Name: '分支专精',
    lv2Summary: '2 级需在【拟态深井】与【强磁捕网】中选择一项专精改造。',
    blockCap: 1,
    lv2BlockCap: 1,
    attackDamage: 18,
    lv2Damage: 24,
    attackInterval: 1.1,
    range: 2.6, // lure radius
    lv2Range: 3.3,
    healPerSec: 0,
    lv2HealPerSec: 0,
    skillName: '诱捕',
    skillCooldown: 15,
    skillDesc: '释放全向电磁诱捕力场，将周围 2.5 格内被吸引的地面敌人定身 3.6 秒并造成干扰伤害。',
    branches: [
      {
        id: 'honeypot_mimic',
        name: '拟态深井',
        tag: '广域反伤诱饵',
        computeCost: 75,
        intelCost: 16,
        maxHpBonus: 190,
        rangeBonus: 1.1,
        damageMult: 1.25,
        summary: '大幅扩展诱敌吸引半径（+1.1 格）与耐久，并对攻击自身的敌人反弹 35% 伤害；诱捕定身延至 4.5 秒。',
        behaviorBullet: [
          '诱敌半径大幅提升，能将更远处的勒索者与洪泛团拉离关键节点',
          '内置反馈震荡器：反弹 35% 所受攻击伤害',
          '「诱捕」覆盖范围提升 30%，定身延至 4.5 秒',
        ],
      },
      {
        id: 'honeypot_snare',
        name: '强磁捕网',
        tag: '双阻停滞控制',
        computeCost: 75,
        intelCost: 16,
        maxHpBonus: 120,
        blockBonus: 1,
        damageMult: 1.45,
        skillCdMult: 0.7,
        summary: '阻挡容量提升至 2，持续对被诱敌目标施加 35% 减速脉冲；“诱捕”冷却缩短 30% 且附带 25% 易伤。',
        behaviorBullet: [
          '阻挡容量 +1（共 2 名），可同时卡住重装或成群敌人',
          '对诱敌范围内的敌人施加持续 35% 磁力减速与电击干扰',
          '「诱捕」冷却缩短 30%，被诱捕目标受到伤害提高 25%',
        ],
      },
    ],
    traits: [
      '免疫「加密」状态：勒索者优先以蜜罐为目标，但无法瘫痪其诱敌与技能',
      '吸引附近洪泛团与勒索者的攻击仇恨，替防线核心分担伤害',
      '耐久相对较低，适合配合修复进程维持防线',
    ],
    colorHex: '#f472b6',
    accentHex: 0xf472b6,
  },
  gate: {
    type: 'gate',
    category: 'defense',
    name: '网闸',
    role: '低费高耐节点隔离',
    shortDesc: '仅部署于交换节点，以较低算力稳固隔离节点并持续产出情报；自身不攻击但耐久极高。',
    allowedTiles: ['node'],
    hasDirection: false,
    computeCost: 35,
    nodeIntelCost: 12,
    maxHp: 760,
    lv2Hp: 1220,
    lv2ComputeCost: 60,
    lv2Name: '双极光耦隔离闸',
    lv2Summary: '耐久跃升至 1220，获得可缓慢再生的 200 点光学护盾，并提高交战期间的情报产出速率。',
    blockCap: 0,
    lv2BlockCap: 0,
    attackDamage: 0,
    lv2Damage: 0,
    attackInterval: 99,
    range: 0,
    lv2Range: 0,
    healPerSec: 0,
    lv2HealPerSec: 0,
    traits: [
      '只占用极少算力即可切断交换节点通行，是动态改道的战术核心',
      '交战中持续守住网闸时周期性获得额外「情报」',
      '无法还击敌人，仍会被洪泛团冲撞、勒索者远程打击和 Boss 破坏',
    ],
    colorHex: '#10b981',
    accentHex: 0x10b981,
  },
  interceptor: {
    type: 'interceptor',
    category: 'support',
    name: '拦截器',
    role: '定向远程 / 对空对地',
    shortDesc: '部署于设备平台并设定朝向，对扇区内的已显形地面及飞行目标进行高精度单体打击。',
    allowedTiles: ['platform'],
    hasDirection: true,
    computeCost: 75,
    nodeIntelCost: 0,
    maxHp: 340,
    lv2Hp: 490,
    lv2ComputeCost: 85,
    lv2Name: '武器分支专精',
    lv2Summary: '2 级需在【穿甲光矛】与【脉冲压制炮】中选择一种火力构型。',
    blockCap: 0,
    lv2BlockCap: 0,
    attackDamage: 62,
    lv2Damage: 88,
    attackInterval: 0.88,
    range: 4.5, // forward sector reach
    lv2Range: 5.2,
    healPerSec: 0,
    lv2HealPerSec: 0,
    branches: [
      {
        id: 'interceptor_pierce',
        name: '穿甲光矛',
        tag: '直线贯穿破甲',
        computeCost: 85,
        intelCost: 18,
        maxHpBonus: 140,
        rangeBonus: 0.8,
        damageMult: 1.55,
        rateMult: 1.15,
        summary: '改为高能电磁贯穿光束：命中主目标后沿射向继续贯穿最多 2 名后续敌人，并无视 65% 护甲与加速击破护盾。',
        behaviorBullet: [
          '贯穿攻击：单次射击可沿直线穿透击中最多 3 个敌方目标',
          '高能穿甲：无视 65% 护甲并额外对护盾造成 45% 撕裂伤害',
          '对单排密集队列与重甲 Boss 蛰影极具威慑',
        ],
      },
      {
        id: 'interceptor_suppress',
        name: '脉冲压制炮',
        tag: '高频减速压制',
        computeCost: 85,
        intelCost: 18,
        maxHpBonus: 160,
        rangeBonus: 0.4,
        damageMult: 1.12,
        rateMult: 0.72, // faster fire!
        summary: '改为高速三管脉冲压制炮：射速提升 28%，每发使目标减速 45%（含飞行伪热点）持续 2.2 秒。',
        behaviorBullet: [
          '射速大幅提升（间隔缩短 28%），压制优先接近出口的目标',
          '命中后附带 45% 移动/飞行减速持续 2.2 秒，可克制伪热点与高速蠕虫',
          '延缓加壳器与勒索者推进节奏，为阻挡防线争取输出窗口',
        ],
      },
    ],
    traits: [
      '朝向决定攻击覆盖矩形扇区（前方延伸 4.5 格，两侧各 1 格）',
      '全图唯一能稳定打击空中「伪热点」的主力防空火力',
      '无法主动锁定未显形的木马或潜伏阶段的 Boss 蛰影',
    ],
    colorHex: '#22d3ee',
    accentHex: 0x22d3ee,
  },
  sandbox: {
    type: 'sandbox',
    category: 'support',
    name: '沙箱',
    role: '隐匿检测 / 范围清剿',
    shortDesc: '部署于设备平台，持续检测并显形周围伪装与潜伏目标，同时对地面敌人发动全向范围杀伤。',
    allowedTiles: ['platform'],
    hasDirection: false,
    computeCost: 85,
    nodeIntelCost: 0,
    maxHp: 380,
    lv2Hp: 560,
    lv2ComputeCost: 90,
    lv2Name: '深度沙箱矩阵',
    lv2Summary: '检测与攻击半径扩至 3.45 格，范围打击附带持续数据解构灼烧（每秒额外伤害并减速 15%）。',
    blockCap: 0,
    lv2BlockCap: 0,
    attackDamage: 32,
    lv2Damage: 48,
    attackInterval: 1.35,
    range: 2.75,
    lv2Range: 3.45,
    healPerSec: 0,
    lv2HealPerSec: 0,
    traits: [
      '扫描半径内的伪装木马与潜伏态「蛰影」会立即被检测显形',
      '无死角打击范围内所有地面敌人，但无法攻击飞行单位',
      '及时显形木马可避免其未显形死亡时引爆载荷炸伤友塔',
    ],
    colorHex: '#a855f7',
    accentHex: 0xa855f7,
  },
  repair: {
    type: 'repair',
    category: 'support',
    name: '修复进程',
    role: '持续治疗 / 护盾解加密',
    shortDesc: '部署于设备平台，持续恢复受损友塔生命；主动技“冗余切换”赋予群体护盾并立即解除加密。',
    allowedTiles: ['platform'],
    hasDirection: false,
    computeCost: 70,
    nodeIntelCost: 0,
    maxHp: 330,
    lv2Hp: 490,
    lv2ComputeCost: 80,
    lv2Name: '高可用集群守卫',
    lv2Summary: '可同时治疗最多 2 座受损友塔（治疗速率 +45%），辐射范围扩至 3.9 格，并缩短范围内友塔所受加密时间。',
    blockCap: 0,
    lv2BlockCap: 0,
    attackDamage: 0,
    lv2Damage: 0,
    attackInterval: 0.5,
    range: 3.25,
    lv2Range: 3.9,
    healPerSec: 42,
    lv2HealPerSec: 62,
    skillName: '冗余切换',
    skillCooldown: 17,
    skillDesc: '向范围内所有友塔部署 240 点能量护盾并立即清除「加密」锁定，确保关键节点与拦截位持续运转。',
    traits: [
      '不攻击敌人，优先治疗节点上的守卫塔与受损最重的防线单位',
      '「冗余切换」是应对勒索者大规模加密与 Boss 洪峰冲击的核心手段',
      '注意自身也可能成为勒索者远程攻击目标，建议配合蜜罐分担火力',
    ],
    colorHex: '#34d399',
    accentHex: 0x34d399,
  },
};

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  category: 'normal' | 'elite' | 'boss';
  role: string;
  isFlying: boolean;
  maxHp: number;
  armor: number;
  speed: number; // grid tiles per sec
  blockWeight: number;
  attackDamage: number; // damage to towers/isolators
  attackInterval: number;
  attackRange: number;
  computeReward: number;
  intelReward: number;
  coreLeakDamage: number;
  summary: string;
  mechanics: string[];
  colorHex: string;
  accentHex: number;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  worm: {
    type: 'worm',
    name: '蠕虫',
    category: 'normal',
    role: '快速近战 / 节点复制',
    isFlying: false,
    maxHp: 135,
    armor: 2,
    speed: 1.55,
    blockWeight: 1,
    attackDamage: 24,
    attackInterval: 0.9,
    attackRange: 0.7,
    computeReward: 10,
    intelReward: 0,
    coreLeakDamage: 1,
    summary: '高速推进的近战恶意代码，首次穿过直通的交换节点时会复制出一个同型副本。',
    mechanics: [
      '被阻挡时持续撕咬攻击阻挡它的防火墙或蜜罐',
      '本体首次经过直通交换节点会分裂复制 1 只克隆蠕虫（克隆体不再复制）',
      '在节点前提前阻挡或隔离节点可有效遏制其增殖',
    ],
    colorHex: '#fb7185',
    accentHex: 0xfb7185,
  },
  flood: {
    type: 'flood',
    name: '洪泛团',
    category: 'elite',
    role: '重装冲击 / 节点拆解',
    isFlying: false,
    maxHp: 460,
    armor: 14,
    speed: 0.95,
    blockWeight: 2,
    attackDamage: 68,
    attackInterval: 1.25,
    attackRange: 0.95,
    computeReward: 22,
    intelReward: 3,
    coreLeakDamage: 2,
    summary: '占用 2 点阻挡容量的重型冲击团。会主动脱离当前路线，向附近已隔离节点的可通行一侧发起重击，击毁防御后沿新路直通前进。',
    mechanics: [
      '重型体格占用 2 点阻挡容量，单名 1 级防火墙只能拦住 1 只',
      '发现附近存在被隔离的交换节点时，会转向可通行侧猛烈撞击节点上的塔或应急隔离器',
      '冲垮节点隔离后，道路立即重新连通（旁路直通），全图路由随之收敛',
    ],
    colorHex: '#f97316',
    accentHex: 0xf97316,
  },
  trojan: {
    type: 'trojan',
    name: '木马',
    category: 'normal',
    role: '伪装隐匿 / 载荷自爆',
    isFlying: false,
    maxHp: 175,
    armor: 4,
    speed: 1.32,
    blockWeight: 1,
    attackDamage: 26,
    attackInterval: 1.0,
    attackRange: 0.7,
    computeReward: 14,
    intelReward: 1,
    coreLeakDamage: 1,
    summary: '伪装成正常封装数据包潜行。显形前无法被拦截器单体锁定；若未显形即被波及消灭，会引爆载荷重创附近友塔。',
    mechanics: [
      '进入沙箱扫描范围、经过旧链路/协议降级区或被阻挡后会立即显形',
      '未显形前对拦截器普通单体瞄准免疫；但可能被贯穿光束等波及击杀',
      '未显形死亡时触发载荷爆破，对周围友塔造成 145 点病毒溅射伤害',
    ],
    colorHex: '#e2e8f0',
    accentHex: 0x38bdf8,
  },
  ransomware: {
    type: 'ransomware',
    name: '勒索者',
    category: 'elite',
    role: '远程攻塔 / 施加加密',
    isFlying: false,
    maxHp: 290,
    armor: 8,
    speed: 1.08,
    blockWeight: 1,
    attackDamage: 34,
    attackInterval: 1.85,
    attackRange: 3.35,
    computeReward: 18,
    intelReward: 2,
    coreLeakDamage: 1,
    summary: '可在移动中远程攻击射程内任意友塔（含高台上的平台塔），造成伤害并施加「加密」，使其短暂停止输出与治疗。',
    mechanics: [
      '射程内存在蜜罐时必然优先攻击蜜罐，且蜜罐免疫加密',
      '施加「加密」不会解除防火墙阻挡或节点隔离，但会冻结攻击、治疗和技能',
      '可用修复进程「冗余切换」或「备份还原」道具立即解除加密',
    ],
    colorHex: '#c084fc',
    accentHex: 0xc084fc,
  },
  hotspot: {
    type: 'hotspot',
    name: '伪热点',
    category: 'normal',
    role: '无线层飞行突防',
    isFlying: true,
    maxHp: 165,
    armor: 2,
    speed: 1.65,
    blockWeight: 0,
    attackDamage: 0,
    attackInterval: 99,
    attackRange: 0,
    computeReward: 14,
    intelReward: 1,
    coreLeakDamage: 1,
    summary: '沿无线层从入口直飞出口，完全无视地面道路布局、障碍、阻挡塔、沙箱地面攻击与改道效果。',
    mechanics: [
      '处于高层无线空间，不受旧链路减速影响',
      '必须依靠「拦截器」对空火力拦截；脉冲压制炮分支可有效减速拖延',
    ],
    colorHex: '#facc15',
    accentHex: 0xfacc15,
  },
  packer: {
    type: 'packer',
    name: '加壳器',
    category: 'elite',
    role: '群体护盾支援',
    isFlying: false,
    maxHp: 350,
    armor: 12,
    speed: 1.0,
    blockWeight: 1,
    attackDamage: 22,
    attackInterval: 1.2,
    attackRange: 0.75,
    computeReward: 20,
    intelReward: 2,
    coreLeakDamage: 2,
    summary: '持续为自身与周围友军套上可被击破的能量加壳护盾，保护成群恶意程序强冲防线。',
    mechanics: [
      '周期性为 2.35 格内同伴充能护盾（最高 110 点），大幅提升突破韧性',
      '迫使守方选择用穿甲光矛强破、或通过改道拉长交战距离先行点杀',
    ],
    colorHex: '#2dd4bf',
    accentHex: 0x2dd4bf,
  },
  boss_wankui: {
    type: 'boss_wankui',
    name: '万傀',
    category: 'boss',
    role: '分段内网首领 · 僵尸网络集群',
    isFlying: false,
    maxHp: 4400,
    armor: 24,
    speed: 0.56,
    blockWeight: 4,
    attackDamage: 135,
    attackInterval: 1.5,
    attackRange: 1.2,
    computeReward: 120,
    intelReward: 25,
    coreLeakDamage: 12,
    summary: '僵尸网络主控核心。擅长以“洪峰”重创隔离节点并直接震毁应急隔离器；生命降至 60% 以下时释放成群蠕虫冲击防线。',
    mechanics: [
      '技能「洪峰」：预警后对附近被隔离节点发动超载撞击，重创守卫塔并秒毁应急隔离器',
      '二阶段（<60% 生命）：开启背部虫巢舱，周期性释放成群蠕虫增援',
    ],
    colorHex: '#ef4444',
    accentHex: 0xef4444,
  },
  boss_shenlou: {
    type: 'boss_shenlou',
    name: '蜃楼',
    category: 'boss',
    role: '骨干流域首领 · 路由欺骗核心',
    isFlying: false,
    maxHp: 4900,
    armor: 22,
    speed: 0.62,
    blockWeight: 4,
    attackDamage: 115,
    attackInterval: 1.45,
    attackRange: 2.2,
    computeReward: 140,
    intelReward: 28,
    coreLeakDamage: 12,
    summary: 'BGP 路由欺骗体。预警后可在前方链路生成临时“路由黑洞”截断通行；生命降低后释放“路由风暴”削弱附近友塔护盾。',
    mechanics: [
      '技能「伪路由」：预警 2.6 秒后在不封死连通性的前方链路制造 9 秒路由黑洞，迫使各入口改道',
      '二阶段（<55% 生命）「路由风暴」：爆发干扰波削弱周围友塔护盾并震荡防线',
    ],
    colorHex: '#ec4899',
    accentHex: 0xec4899,
  },
  boss_zheying: {
    type: 'boss_zheying',
    name: '蛰影',
    category: 'boss',
    role: '气隙深层终极威胁 · 潜伏/提权/破坏',
    isFlying: false,
    maxHp: 5800,
    armor: 20,
    speed: 0.58,
    blockWeight: 4,
    attackDamage: 140,
    attackInterval: 1.35,
    attackRange: 2.0,
    computeReward: 180,
    intelReward: 35,
    coreLeakDamage: 15,
    summary: '攻击组织蛰影核心实体，随生命下降依次切换「潜伏」「提权」「破坏」三阶段，隐匿推进并强行锁死运维环路段。',
    mechanics: [
      '阶段一「潜伏」（100%-70%）：隐匿态，需沙箱/旧链路/协议降级检测或阻挡显形后方能被拦截器锁定',
      '阶段二「提权」（70%-35%）：展开重型护甲（护甲大幅提升）并不断释放伪装木马随行',
      '阶段三「破坏」（<35%）：预警后锁死前方一段运维环（维持全图连通前提），强迫多路流量重新收敛',
    ],
    colorHex: '#f43f5e',
    accentHex: 0xf43f5e,
  },
};

export interface ItemConfig {
  id: ItemId;
  name: string;
  resource: 'intel' | 'compute';
  cost: number;
  cooldown: number;
  targetType: 'node' | 'link_area' | 'tower';
  targetLabel: string;
  shortDesc: string;
  detailDesc: string;
  colorHex: string;
  accentHex: number;
}

export const ITEM_CONFIGS: Record<ItemId, ItemConfig> = {
  isolator: {
    id: 'isolator',
    name: '应急隔离器',
    resource: 'intel',
    cost: 14,
    cooldown: 18,
    targetType: 'node',
    targetLabel: '直通交换节点',
    shortDesc: '临时隔离一个直通节点（15 秒），具备耐久且会被洪泛团或万傀冲毁；不产出情报。',
    detailDesc:
      '投放于任意未冷却的直通交换节点，立刻截断节点通行并触发动态改道（受连通性保护限制）。持续 15 秒或 380 点耐久耗尽后失效并触发节点重启冷却。',
    colorHex: '#fbbf24',
    accentHex: 0xfbbf24,
  },
  downgrade: {
    id: 'downgrade',
    name: '协议降级',
    resource: 'intel',
    cost: 16,
    cooldown: 20,
    targetType: 'link_area',
    targetLabel: '链路区域（1.6 格半径）',
    shortDesc: '令一片链路区域暂退回旧协议（10 秒）：经过地面敌人减速 45%、木马显形，并使敌人重新评估最优路线。',
    detailDesc:
      '投放前可同时预览受影响格子与各入口路由变化！降级区域对地面寻路施加旧链路通行代价，可诱导敌军避开此路或延缓高速冲锋。',
    colorHex: '#f59e0b',
    accentHex: 0xf59e0b,
  },
  restore: {
    id: 'restore',
    name: '备份还原',
    resource: 'compute',
    cost: 45,
    cooldown: 14,
    targetType: 'tower',
    targetLabel: '任意已部署友塔',
    shortDesc: '立即为指定友塔恢复大幅生命（360 点或 55% 最大生命上限，取高值）并瞬间解除「加密」状态。',
    detailDesc:
      '快速急救指令：恢复目标友塔大量生命并清理勒索者施加的加密封锁，适合抢救即将崩盘的节点网闸或核心防火墙。',
    colorHex: '#34d399',
    accentHex: 0x34d399,
  },
};

export interface StatusDoc {
  id: string;
  name: string;
  color: string;
  summary: string;
  counter: string;
}

export const STATUS_DOCS: StatusDoc[] = [
  {
    id: 'detect',
    name: '检测显形',
    color: '#22d3ee',
    summary: '破除木马伪装与蛰影「潜伏」态，使原本免疫远程单体瞄准的目标暴露在拦截器火力之下，并阻止木马死亡引爆载荷。',
    counter: '来源：沙箱扫描圈、旧链路、协议降级区域、近战阻挡。',
  },
  {
    id: 'shield',
    name: '能量护盾',
    color: '#34d399',
    summary: '友方护盾（冗余切换 / 2级网闸）优先吸收所受伤害；敌方加壳护盾（加壳器）吸收伤害，可用穿甲光矛高效击破。',
    counter: '注意：蜃楼「路由风暴」可削弱附近友塔护盾。',
  },
  {
    id: 'encrypt',
    name: '加密锁定',
    color: '#c084fc',
    summary: '由勒索者施加。被加密的友塔暂时停止攻击、治疗和释放主动技能，但仍保留原有阻挡数量与节点隔离状态。',
    counter: '解除：修复进程「冗余切换」、道具「备份还原」或等待时效结束（蜜罐完全免疫）。',
  },
  {
    id: 'reroute',
    name: '隔离与连通性',
    color: '#f59e0b',
    summary: '在交换节点部署防火墙、网闸或应急隔离器会阻断通行并使各入口与地面敌人从当前位置重新寻路；节点解除隔离后存在 4.5 秒冷却。',
    counter: '任何操作若导致任一入口或地面敌军无路可达出口，系统将自动拒绝并标红阻塞点。',
  },
];
