// 三张核心关卡地图定义（企业分段内网 14 波、跨网骨干流域 15 波、工控气隙深层 16 波）

import { TILE } from './constants.js';

// 字符图例解析器：
// '.' VOID 空隙
// '#' OBSTACLE 障碍设施（机柜/公网流/中央气隙）
// 'P' PLATFORM 设备平台（高台）
// 'L' LINK 标准链路
// 'G' LEGACY 旧链路
// 'N' NODE 交换节点
// 'E' ENTRY 入口（坐标在 entries 中附加元数据）
// 'X' EXIT 中枢出口（坐标在 exits 中附加元数据）

const CHAR_TO_TILE = {
  '.': TILE.VOID,
  '#': TILE.OBSTACLE,
  'P': TILE.PLATFORM,
  'L': TILE.LINK,
  'G': TILE.LEGACY,
  'N': TILE.NODE,
  'E': TILE.ENTRY,
  'X': TILE.EXIT
};

function parseGrid(rows) {
  return rows.map((row) =>
    row
      .trim()
      .split(/\s+/)
      .map((ch) => {
        if (!(ch in CHAR_TO_TILE)) {
          throw new Error(`Unknown map tile char: ${ch}`);
        }
        return CHAR_TO_TILE[ch];
      })
  );
}

// ============================================================================
// 地图 1：分段内网（企业网，14 波）
// 布局验证：
// - Entry A(4,0)「门户网站」, Entry B(10,0)「邮件网关」接入北侧 DMZ (z=1)
// - DMZ 互联: (4,1)-(10,1)
// - 西侧办公网段: (4,2)-(4,4) -> N1(4,5)「西边界节点」 -> (4,6)
// - 东侧业务网段: (10,2) -> N2(10,3)「东边界节点」 -> (10,4)-(10,6)
// - 旧链路互联: (5,4)-(9,4) 连接办公网段与业务网段
// - 内网核心汇聚: (4,6)-(7,6) 与 (10,6)-(9,6)-N4(8,6)「业务汇聚节点」-(7,6)
// - 核心前节点: N3(7,7) -> (7,8) -> Exit X(7,9)「核心数据库」
// - 西侧外环（旧系统网段）: (4,6)-(2,6)-(1,6..8 旧链路)-(1,9)-(6,9)-(7,9)
// - 东侧外环（灾备环）: (10,6)-(12,6)-(12,7..9)-(8,9)-(7,9)
// ============================================================================
const MAP1_ASCII = [
  //0 1 2 3 4 5 6 7 8 9 10 11 12 13 14
  '. . # # E # P # P # E  #  #  .  .', // z=0
  '. # P # L L L L L L L  #  P  #  .', // z=1 (DMZ 互联)
  '. # # P L P # P # P L  P  #  #  .', // z=2
  '. . # P L P # # # P N  P  #  .  .', // z=3 (N2 at 10,3)
  '. # P . L G G G G G L  .  P  #  .', // z=4 (旧链路互联 5..9,4)
  '. # . P N P # P # P L  P  .  #  .', // z=5 (N1 at 4,5)
  '. G L L L L L L N L L  L  L  .  .', // z=6 (N4 at 8,6; 西外环起点 1,6; 东灾备环 12,6)
  '. G P # P # P N P # P  #  L  P  .', // z=7 (N3 at 7,7)
  '. G P # # P . L . P #  P  L  #  .', // z=8
  '. L L L L L L X L L L  L  L  .  .', // z=9 (Exit X at 7,9)
  '. . # P # # P # P # #  P  #  .  .'  // z=10
];

// ============================================================================
// 地图 2：骨干流域（跨网专线与双活数据中心，15 波）
// 布局验证：
// - Entry A(2,0)「互联网」, Entry C(8,0)「分支专线」, Entry B(12,0)「云端互联」
// - 北侧骨干网 (z=2): (2,2)-(8,2)-N4(9,2)「分支路由节点」-(10,2)-(12,2)
// - 公网流横贯战场 (z=5): 全部为 '#' OBSTACLE，仅三处跨越点：
//   1) 西专线隧道 (x=2): N1(2,3)「西接入节点」 -> (2,4)-(2,6) -> (2,7)
//   2) 主干隧道 (x=5): (5,3)-(5,6) -> (5,7)
//   3) 旧专线跨越点 (x=10): (10,3)-(10,4 G)-(10,5 G)-(10,6) -> N2(10,7)「专线汇聚节点」
// - 南侧双活数据中心：
//   - 数据中心 X(4,9): 经 N3(4,8)「西中心网关」接入
//   - 数据中心 Y(10,9): 经 (10,8) 接入
//   - 双活同步备份总线: (5,7)-(6,7 G)-(7,7 G)-(8,7 G)-(9,7)-(9,8)-(10,8)
// ============================================================================
const MAP2_ASCII = [
  //0 1 2 3 4 5 6 7 8 9 10 11 12 13 14
  '. # E # . # . # E # .  #  E  #  .', // z=0
  '. P L P # P # P L P #  P  L  P  .', // z=1
  '. # L L L L L L L N L  L  L  #  .', // z=2 (N4 at 9,2)
  '. P N P L L P # P . L  P  #  P  .', // z=3 (N1 at 2,3; 注意 4,3 改为 P 保持纯正主干隧道 x=5!)
  '. . L P . L P . P P G  P  .  #  .', // z=4
  '# # L # # L # # # # G  #  #  #  #', // z=5 (横贯战场的公网流!)
  '. P L P . L P . P P L  P  .  #  .', // z=6
  '. # L L L L G G G L N  P  #  .  .', // z=7 (N2 at 10,7; 双活同步线 6..8,7 G -> 9,7)
  '. P # P N P # P # L L  P  .  #  .', // z=8 (N3 at 4,8; 9,8 -> 10,8)
  '. . # P X P # . # P X  #  .  .  .', // z=9 (DC X at 4,9; DC Y at 10,9)
  '. . . # # # . . . # #  #  .  .  .'  // z=10
];
// 注意检查 z=3: 列4若为 'L' 则 (4,2)->(4,3)->(5,3) 会绕一格，把 z=3,x=4 设为 'P' 保证整洁！

const MAP2_ASCII_CLEAN = [
  //0 1 2 3 4 5 6 7 8 9 10 11 12 13 14
  '. # E # . # . # E # .  #  E  #  .', // z=0
  '. P L P # P # P L P #  P  L  P  .', // z=1
  '. # L L L L L L L N L  L  L  #  .', // z=2 (N4 at 9,2)
  '. P N P P L P # P . L  P  #  P  .', // z=3 (N1 at 2,3; 主干隧道 5,3; 旧专线 10,3)
  '. . L P . L P . P P G  P  .  #  .', // z=4
  '# # L # # L # # # # G  #  #  #  #', // z=5 (公网流横贯战场)
  '. P L P . L P . P P L  P  .  #  .', // z=6
  '. # L L L L L G L L N  P  #  .  .', // z=7 (N2 at 10,7; 双活同步备份总线 6..9,7 含旧协议校验段 7,7)
  '. P # P N P # P # L L  P  .  #  .', // z=8 (N3 at 4,8)
  '. . # P X P # . # P X  #  .  .  .', // z=9 (DC X at 4,9; DC Y at 10,9)
  '. . . # # # . . . # #  #  .  .  .'  // z=10
];

// ============================================================================
// 地图 3：气隙深层（工控网，16 波）
// 布局验证：
// - 中央气隙 ('#'): x=5..9, z=4..6
// - Entry B(2,0)「办公网下行」, Entry A(6,0)「运维跳板机」, Entry C(12,0)「供应商远程维护」
// - 运维环: 北 z=3 (4..10), 西通道 x=4 (3..7, 含 N1(4,5)「西运维节点」),
//           东通道 x=10 (3..7, 含 N2(10,5)「东运维节点」), 南 z=7 (4..10)
// - 老工控总线（两侧慢速支路）:
//   - 西老总线: (1,3)-(1,4..6 G)-(1,7) 接 (4,3) 与 (4,7)
//   - 东老总线: (13,3)-(13,4..6 G)-(13,7) 接 (10,3) 与 (10,7)
// - 双工控核心:
//   - N3(5,8)「过程联锁节点」 -> Exit X(5,9)「过程控制核心」
//   - N4(9,8)「安全联锁节点」 -> Exit Y(9,9)「安全联锁核心」
// ============================================================================
const MAP3_ASCII = [
  //0 1 2 3 4 5 6 7 8 9 10 11 12 13 14
  '. # E # . # E # . # .  #  E  #  .', // z=0 (B at 2,0; A at 6,0; C at 12,0)
  '. P L L L P L P # P L  L  L  P  .', // z=1
  '. # . P L P L P # P L  P  .  #  .', // z=2
  '. L L L L L L L L L L  L  L  L  .', // z=3 (北运维环 + 两侧老工控总线接入)
  '. G P P L # # # # # L  P  P  G  .', // z=4 (中央气隙 5..9,4..6)
  '. G P P N # # # # # N  P  P  G  .', // z=5 (N1 at 4,5; N2 at 10,5)
  '. G P P L # # # # # L  P  P  G  .', // z=6
  '. L L L L L L L L L L  L  L  L  .', // z=7 (南运维环 + 两侧老工控总线汇回)
  '. # P # P N P # P N P  #  P  #  .', // z=8 (N3 at 5,8; N4 at 9,8)
  '. . # P . X . # . X .  P  #  .  .', // z=9 (Core X at 5,9; Core Y at 9,9)
  '. . . # # # . . . # #  #  .  .  .'  // z=10
];

// 波次生成辅助函数：groups = [{ entry: 'A', type: 'worm', count: 5, interval: 1.1, delay: 0 }]
export const MAPS = [
  {
    id: 'intranet',
    index: 1,
    name: '分段内网',
    subtitle: '企业园区网 · DMZ 与核心数据库防卫',
    theme: 'enterprise',
    waveCount: 14,
    startCompute: 260,
    startIntel: 32,
    coreIntegrity: 20,
    ambientDesc: '双入口经 DMZ 接入办公与业务双网段，外围保留旧系统网段与灾备环。合理隔离西边界或核心前节点，引导流量进入沙箱火力网。',
    bossId: 'wankuai',
    cols: 15,
    rows: 11,
    grid: parseGrid(MAP1_ASCII),
    entries: [
      { id: 'A', name: '门户网站', x: 4, z: 0 },
      { id: 'B', name: '邮件网关', x: 10, z: 0 }
    ],
    exits: [
      { id: 'X', name: '核心数据库', x: 7, z: 9 }
    ],
    nodes: [
      { id: 'N1', name: '西边界节点', x: 4, z: 5, desc: '控制办公网段南下通道；隔离后门户网站流量折向 DMZ 互联与邮件网关汇流。' },
      { id: 'N2', name: '东边界节点', x: 10, z: 3, desc: '控制业务网段北口；隔离后邮件网关流量经 DMZ 互联转入西侧办公网段。' },
      { id: 'N4', name: '业务汇聚节点', x: 8, z: 6, desc: '控制业务网段并入核心内环；隔离后东侧流量绕行外围灾备环。' },
      { id: 'N3', name: '核心前节点', x: 7, z: 7, desc: '核心数据库正门咽喉；隔离后东西两路流量分别转向旧系统网段与灾备外环。' }
    ],
    waves: [
      {
        wave: 1, title: '异常探测流', bonusIntel: 6,
        groups: [
          { entry: 'A', type: 'worm', count: 5, interval: 1.25, delay: 0.5 }
        ]
      },
      {
        wave: 2, title: '双口蠕虫扩散', bonusIntel: 6,
        groups: [
          { entry: 'A', type: 'worm', count: 5, interval: 1.15, delay: 0.3 },
          { entry: 'B', type: 'worm', count: 5, interval: 1.2, delay: 2.0 }
        ]
      },
      {
        wave: 3, title: '伪装邮件附件', bonusIntel: 8, alert: '侦测到「木马」：伪装成正常数据包，需沙箱、旧链路或近战阻挡显形！',
        groups: [
          { entry: 'B', type: 'trojan', count: 4, interval: 1.5, delay: 0.5 },
          { entry: 'A', type: 'worm', count: 6, interval: 1.1, delay: 1.5 }
        ]
      },
      {
        wave: 4, title: '边界洪泛试探', bonusIntel: 8, alert: '侦测到「洪泛团」：占用 2 阻挡，会主动偏离路线重击附近被隔离节点！',
        groups: [
          { entry: 'A', type: 'flood', count: 2, interval: 2.8, delay: 0.5 },
          { entry: 'A', type: 'worm', count: 5, interval: 1.0, delay: 1.2 },
          { entry: 'B', type: 'trojan', count: 4, interval: 1.35, delay: 2.0 }
        ]
      },
      {
        wave: 5, title: '加密勒索渗透', bonusIntel: 9, alert: '侦测到「勒索者」：远程攻击守方塔并施加加密停火，优先攻击蜜罐！',
        groups: [
          { entry: 'B', type: 'ransom', count: 3, interval: 2.4, delay: 0.5 },
          { entry: 'A', type: 'trojan', count: 4, interval: 1.3, delay: 1.0 },
          { entry: 'B', type: 'worm', count: 6, interval: 0.95, delay: 2.5 }
        ]
      },
      {
        wave: 6, title: '无线伪基站掠袭', bonusIntel: 9, alert: '侦测到「伪热点」：沿上方无线层直飞出口，请部署拦截器防空！',
        groups: [
          { entry: 'A', type: 'rogue_ap', count: 4, interval: 1.8, delay: 0.5 },
          { entry: 'A', type: 'worm', count: 6, interval: 0.95, delay: 1.0 },
          { entry: 'B', type: 'flood', count: 2, interval: 2.6, delay: 2.0 },
          { entry: 'B', type: 'ransom', count: 2, interval: 2.4, delay: 3.5 }
        ]
      },
      {
        wave: 7, title: '加壳保护编队', bonusIntel: 10, alert: '侦测到「加壳器」：周期性为周围同伴编译吸收护盾！',
        groups: [
          { entry: 'A', type: 'packer', count: 2, interval: 3.2, delay: 0.8 },
          { entry: 'A', type: 'worm', count: 7, interval: 0.9, delay: 0.4 },
          { entry: 'B', type: 'trojan', count: 5, interval: 1.2, delay: 1.5 },
          { entry: 'B', type: 'rogue_ap', count: 3, interval: 1.8, delay: 3.0 }
        ]
      },
      {
        wave: 8, title: '南北合围施压', bonusIntel: 10,
        groups: [
          { entry: 'A', type: 'flood', count: 3, interval: 2.4, delay: 0.5 },
          { entry: 'A', type: 'ransom', count: 3, interval: 2.1, delay: 1.8 },
          { entry: 'B', type: 'packer', count: 2, interval: 3.0, delay: 1.0 },
          { entry: 'B', type: 'trojan', count: 6, interval: 1.1, delay: 1.2 }
        ]
      },
      {
        wave: 9, title: '立体混合渗透', bonusIntel: 11,
        groups: [
          { entry: 'A', type: 'rogue_ap', count: 5, interval: 1.5, delay: 0.4 },
          { entry: 'B', type: 'rogue_ap', count: 4, interval: 1.6, delay: 1.6 },
          { entry: 'A', type: 'trojan', count: 6, interval: 1.1, delay: 1.0 },
          { entry: 'B', type: 'flood', count: 3, interval: 2.3, delay: 2.2 }
        ]
      },
      {
        wave: 10, title: '内网横向风暴', bonusIntel: 12,
        groups: [
          { entry: 'A', type: 'packer', count: 2, interval: 2.8, delay: 0.5 },
          { entry: 'A', type: 'worm', count: 9, interval: 0.78, delay: 0.5 },
          { entry: 'B', type: 'ransom', count: 4, interval: 1.9, delay: 1.2 },
          { entry: 'B', type: 'flood', count: 3, interval: 2.2, delay: 2.5 }
        ]
      },
      {
        wave: 11, title: '暗道木马潮', bonusIntel: 12,
        groups: [
          { entry: 'A', type: 'trojan', count: 7, interval: 0.95, delay: 0.4 },
          { entry: 'B', type: 'trojan', count: 7, interval: 0.95, delay: 1.0 },
          { entry: 'A', type: 'packer', count: 2, interval: 3.0, delay: 1.5 },
          { entry: 'B', type: 'rogue_ap', count: 5, interval: 1.4, delay: 2.5 }
        ]
      },
      {
        wave: 12, title: '勒索与破点集群', bonusIntel: 13,
        groups: [
          { entry: 'A', type: 'flood', count: 4, interval: 2.0, delay: 0.4 },
          { entry: 'A', type: 'ransom', count: 4, interval: 1.8, delay: 1.2 },
          { entry: 'B', type: 'packer', count: 3, interval: 2.5, delay: 0.8 },
          { entry: 'B', type: 'worm', count: 10, interval: 0.75, delay: 1.0 }
        ]
      },
      {
        wave: 13, title: '总攻前奏高压流', bonusIntel: 15,
        groups: [
          { entry: 'A', type: 'flood', count: 4, interval: 1.9, delay: 0.3 },
          { entry: 'A', type: 'rogue_ap', count: 6, interval: 1.3, delay: 1.0 },
          { entry: 'B', type: 'ransom', count: 4, interval: 1.7, delay: 0.8 },
          { entry: 'B', type: 'trojan', count: 8, interval: 0.9, delay: 1.5 },
          { entry: 'B', type: 'packer', count: 2, interval: 2.8, delay: 2.0 }
        ]
      },
      {
        wave: 14, title: '首领降临：万傀', bonusIntel: 0, isBossWave: true,
        alert: '【高危告警】僵尸网络主控母巢「万傀」已从门户网站侵入！注意防范节点洪峰冲击！',
        groups: [
          { entry: 'A', type: 'wankuai', count: 1, interval: 1.0, delay: 0.8 },
          { entry: 'A', type: 'packer', count: 2, interval: 3.5, delay: 2.2 },
          { entry: 'B', type: 'ransom', count: 4, interval: 2.0, delay: 1.5 },
          { entry: 'B', type: 'trojan', count: 6, interval: 1.1, delay: 3.0 },
          { entry: 'A', type: 'rogue_ap', count: 5, interval: 1.6, delay: 5.0 }
        ]
      }
    ]
  },

  {
    id: 'backbone',
    index: 2,
    name: '骨干流域',
    subtitle: '跨网专线与双活数据中心 · 15 波',
    theme: 'backbone',
    waveCount: 15,
    startCompute: 290,
    startIntel: 36,
    coreIntegrity: 22,
    ambientDesc: '公网流横贯战场，互联网、分支专线与云端互联跨河奔向双活数据中心 X、Y。控制汇聚节点可切换数据中心负载并重塑三路交战格局。',
    bossId: 'shenlou',
    cols: 15,
    rows: 11,
    grid: parseGrid(MAP2_ASCII_CLEAN),
    entries: [
      { id: 'A', name: '互联网', x: 2, z: 0 },
      { id: 'C', name: '分支专线', x: 8, z: 0 },
      { id: 'B', name: '云端互联', x: 12, z: 0 }
    ],
    exits: [
      { id: 'X', name: '数据中心 X', x: 4, z: 9 },
      { id: 'Y', name: '数据中心 Y', x: 10, z: 9 }
    ],
    nodes: [
      { id: 'N1', name: '西接入节点', x: 2, z: 3, desc: '控制互联网西专线隧道入口；隔离后互联网流量东移改走中央主干隧道。' },
      { id: 'N4', name: '分支路由节点', x: 9, z: 2, desc: '位于北骨干汇流口；隔离后分支专线脱离旧专线单独改走主干隧道前往数据中心 X。' },
      { id: 'N2', name: '专线汇聚节点', x: 10, z: 7, desc: '旧专线通往数据中心 Y 的总闸；隔离后将分支专线与云端互联一并导向数据中心 X。' },
      { id: 'N3', name: '西中心网关', x: 4, z: 8, desc: '数据中心 X 门户节点；隔离后西侧流量经双活同步备份总线热切换至数据中心 Y。' }
    ],
    waves: [
      {
        wave: 1, title: '公网边界扫描', bonusIntel: 6,
        groups: [
          { entry: 'A', type: 'worm', count: 6, interval: 1.2, delay: 0.4 }
        ]
      },
      {
        wave: 2, title: '专线汇流异常', bonusIntel: 7,
        groups: [
          { entry: 'C', type: 'worm', count: 5, interval: 1.15, delay: 0.4 },
          { entry: 'B', type: 'trojan', count: 4, interval: 1.4, delay: 1.5 }
        ]
      },
      {
        wave: 3, title: '三口并发渗透', bonusIntel: 8,
        groups: [
          { entry: 'A', type: 'trojan', count: 4, interval: 1.35, delay: 0.4 },
          { entry: 'C', type: 'worm', count: 5, interval: 1.1, delay: 1.2 },
          { entry: 'B', type: 'worm', count: 5, interval: 1.1, delay: 2.0 }
        ]
      },
      {
        wave: 4, title: '跨网洪泛冲击', bonusIntel: 8,
        groups: [
          { entry: 'C', type: 'flood', count: 2, interval: 2.6, delay: 0.5 },
          { entry: 'A', type: 'worm', count: 6, interval: 1.0, delay: 1.0 },
          { entry: 'B', type: 'trojan', count: 4, interval: 1.3, delay: 2.0 }
        ]
      },
      {
        wave: 5, title: '云端加密劫持', bonusIntel: 9,
        groups: [
          { entry: 'B', type: 'ransom', count: 3, interval: 2.2, delay: 0.5 },
          { entry: 'A', type: 'flood', count: 2, interval: 2.6, delay: 1.2 },
          { entry: 'C', type: 'trojan', count: 5, interval: 1.2, delay: 1.8 }
        ]
      },
      {
        wave: 6, title: '跨河无线伪热点', bonusIntel: 9,
        groups: [
          { entry: 'A', type: 'rogue_ap', count: 4, interval: 1.7, delay: 0.5 },
          { entry: 'B', type: 'rogue_ap', count: 4, interval: 1.7, delay: 1.4 },
          { entry: 'C', type: 'ransom', count: 3, interval: 2.1, delay: 1.5 }
        ]
      },
      {
        wave: 7, title: '加壳隧道突击', bonusIntel: 10,
        groups: [
          { entry: 'A', type: 'packer', count: 2, interval: 3.0, delay: 0.6 },
          { entry: 'A', type: 'trojan', count: 6, interval: 1.1, delay: 0.8 },
          { entry: 'C', type: 'flood', count: 3, interval: 2.4, delay: 1.8 },
          { entry: 'B', type: 'worm', count: 7, interval: 0.9, delay: 2.2 }
        ]
      },
      {
        wave: 8, title: '双活切换压力测试', bonusIntel: 10,
        groups: [
          { entry: 'B', type: 'flood', count: 3, interval: 2.2, delay: 0.4 },
          { entry: 'B', type: 'ransom', count: 3, interval: 2.0, delay: 1.5 },
          { entry: 'A', type: 'packer', count: 2, interval: 2.8, delay: 1.0 },
          { entry: 'C', type: 'rogue_ap', count: 5, interval: 1.5, delay: 2.2 }
        ]
      },
      {
        wave: 9, title: '隐匿暗流', bonusIntel: 11,
        groups: [
          { entry: 'A', type: 'trojan', count: 7, interval: 1.0, delay: 0.4 },
          { entry: 'C', type: 'trojan', count: 6, interval: 1.05, delay: 1.2 },
          { entry: 'B', type: 'packer', count: 2, interval: 2.8, delay: 1.4 },
          { entry: 'A', type: 'ransom', count: 3, interval: 2.0, delay: 2.4 }
        ]
      },
      {
        wave: 10, title: '【洪峰】三口全域洪峰', bonusIntel: 15, isFloodPeak: true,
        alert: '【流量洪峰告警】互联网、分支专线、云端互联三处入口同时爆发大规模混合入侵洪峰！',
        groups: [
          { entry: 'A', type: 'worm', count: 9, interval: 0.68, delay: 0.2 },
          { entry: 'A', type: 'trojan', count: 6, interval: 0.85, delay: 1.0 },
          { entry: 'C', type: 'flood', count: 4, interval: 1.7, delay: 0.3 },
          { entry: 'C', type: 'worm', count: 8, interval: 0.72, delay: 0.8 },
          { entry: 'B', type: 'ransom', count: 4, interval: 1.6, delay: 0.4 },
          { entry: 'B', type: 'packer', count: 3, interval: 2.2, delay: 1.0 },
          { entry: 'B', type: 'rogue_ap', count: 5, interval: 1.3, delay: 2.0 }
        ]
      },
      {
        wave: 11, title: '余波防空压制', bonusIntel: 12,
        groups: [
          { entry: 'A', type: 'rogue_ap', count: 6, interval: 1.35, delay: 0.4 },
          { entry: 'C', type: 'rogue_ap', count: 5, interval: 1.4, delay: 1.2 },
          { entry: 'B', type: 'flood', count: 3, interval: 2.1, delay: 1.5 },
          { entry: 'A', type: 'ransom', count: 3, interval: 1.9, delay: 2.2 }
        ]
      },
      {
        wave: 12, title: '重装破闸编队', bonusIntel: 13,
        groups: [
          { entry: 'C', type: 'flood', count: 4, interval: 1.9, delay: 0.4 },
          { entry: 'B', type: 'flood', count: 3, interval: 2.1, delay: 1.0 },
          { entry: 'A', type: 'packer', count: 3, interval: 2.5, delay: 0.8 },
          { entry: 'A', type: 'trojan', count: 8, interval: 0.9, delay: 1.2 }
        ]
      },
      {
        wave: 13, title: '多维勒索锁链', bonusIntel: 13,
        groups: [
          { entry: 'A', type: 'ransom', count: 4, interval: 1.7, delay: 0.4 },
          { entry: 'C', type: 'ransom', count: 4, interval: 1.7, delay: 1.0 },
          { entry: 'B', type: 'packer', count: 3, interval: 2.4, delay: 0.8 },
          { entry: 'B', type: 'worm', count: 10, interval: 0.72, delay: 1.2 }
        ]
      },
      {
        wave: 14, title: '风暴前夜合击', bonusIntel: 15,
        groups: [
          { entry: 'A', type: 'flood', count: 4, interval: 1.8, delay: 0.4 },
          { entry: 'C', type: 'trojan', count: 8, interval: 0.85, delay: 0.8 },
          { entry: 'B', type: 'rogue_ap', count: 6, interval: 1.25, delay: 1.0 },
          { entry: 'C', type: 'packer', count: 3, interval: 2.3, delay: 1.5 }
        ]
      },
      {
        wave: 15, title: '首领降临：蜃楼', bonusIntel: 0, isBossWave: true,
        alert: '【高危告警】BGP 路由劫持首领「蜃楼」现身骨干网！警惕前方伪路由黑洞与护盾风暴！',
        groups: [
          { entry: 'C', type: 'shenlou', count: 1, interval: 1.0, delay: 0.8 },
          { entry: 'A', type: 'trojan', count: 7, interval: 1.0, delay: 1.5 },
          { entry: 'B', type: 'ransom', count: 4, interval: 1.9, delay: 2.0 },
          { entry: 'C', type: 'packer', count: 3, interval: 2.8, delay: 2.5 },
          { entry: 'A', type: 'rogue_ap', count: 5, interval: 1.5, delay: 4.5 }
        ]
      }
    ]
  },

  {
    id: 'airgap_ics',
    index: 3,
    name: '气隙深层',
    subtitle: '工业控制核心与中央气隙 · 16 波',
    theme: 'industrial',
    waveCount: 16,
    startCompute: 310,
    startIntel: 40,
    coreIntegrity: 22,
    ambientDesc: '三路跳板围绕中央物理气隙接入，运维环连通南北双核，两侧老工控总线构成低速支路。两个工控核心的布防相互牵制。',
    bossId: 'zheying',
    cols: 15,
    rows: 11,
    grid: parseGrid(MAP3_ASCII),
    entries: [
      { id: 'A', name: '运维跳板机', x: 6, z: 0 },
      { id: 'B', name: '办公网下行', x: 2, z: 0 },
      { id: 'C', name: '供应商远程维护', x: 12, z: 0 }
    ],
    exits: [
      { id: 'X', name: '过程控制核心', x: 5, z: 9 },
      { id: 'Y', name: '安全联锁核心', x: 9, z: 9 }
    ],
    nodes: [
      { id: 'N1', name: '西运维节点', x: 4, z: 5, desc: '控制西侧运维环狭长通道；隔离后跳板机与办公网流量转移至东侧通道或西老工控总线。' },
      { id: 'N2', name: '东运维节点', x: 10, z: 5, desc: '控制东侧运维环狭长通道；隔离后供应商维护流量横穿北环并入西侧防区。' },
      { id: 'N3', name: '过程联锁节点', x: 5, z: 8, desc: '过程控制核心 X 正门闸口；隔离后西路流量沿南运维环转向安全联锁核心 Y。' },
      { id: 'N4', name: '安全联锁节点', x: 9, z: 8, desc: '安全联锁核心 Y 正门闸口；隔离后东路流量沿南运维环转向过程控制核心 X。' }
    ],
    waves: [
      {
        wave: 1, title: '跳板异常指令', bonusIntel: 6,
        groups: [
          { entry: 'A', type: 'worm', count: 6, interval: 1.15, delay: 0.4 }
        ]
      },
      {
        wave: 2, title: '下行与远维夹击', bonusIntel: 7,
        groups: [
          { entry: 'B', type: 'worm', count: 5, interval: 1.15, delay: 0.4 },
          { entry: 'C', type: 'worm', count: 5, interval: 1.15, delay: 1.4 }
        ]
      },
      {
        wave: 3, title: '固件伪装包', bonusIntel: 8,
        groups: [
          { entry: 'C', type: 'trojan', count: 5, interval: 1.3, delay: 0.4 },
          { entry: 'A', type: 'worm', count: 6, interval: 1.05, delay: 1.5 }
        ]
      },
      {
        wave: 4, title: '运维环破闸冲击', bonusIntel: 8,
        groups: [
          { entry: 'A', type: 'flood', count: 2, interval: 2.5, delay: 0.5 },
          { entry: 'B', type: 'trojan', count: 4, interval: 1.3, delay: 1.2 },
          { entry: 'C', type: 'worm', count: 6, interval: 1.0, delay: 2.0 }
        ]
      },
      {
        wave: 5, title: '上位机勒索攻击', bonusIntel: 9,
        groups: [
          { entry: 'B', type: 'ransom', count: 3, interval: 2.1, delay: 0.5 },
          { entry: 'C', type: 'ransom', count: 2, interval: 2.3, delay: 1.5 },
          { entry: 'A', type: 'trojan', count: 5, interval: 1.2, delay: 1.8 }
        ]
      },
      {
        wave: 6, title: '飞越气隙的信号', bonusIntel: 9,
        groups: [
          { entry: 'A', type: 'rogue_ap', count: 5, interval: 1.6, delay: 0.5 },
          { entry: 'C', type: 'rogue_ap', count: 4, interval: 1.7, delay: 1.5 },
          { entry: 'B', type: 'flood', count: 3, interval: 2.3, delay: 1.8 }
        ]
      },
      {
        wave: 7, title: '加壳工控载荷', bonusIntel: 10,
        groups: [
          { entry: 'A', type: 'packer', count: 2, interval: 2.9, delay: 0.5 },
          { entry: 'A', type: 'worm', count: 8, interval: 0.85, delay: 0.7 },
          { entry: 'C', type: 'trojan', count: 6, interval: 1.1, delay: 1.6 }
        ]
      },
      {
        wave: 8, title: '两侧通道拉锯', bonusIntel: 10,
        groups: [
          { entry: 'B', type: 'flood', count: 3, interval: 2.1, delay: 0.4 },
          { entry: 'C', type: 'flood', count: 3, interval: 2.1, delay: 1.0 },
          { entry: 'A', type: 'ransom', count: 4, interval: 1.85, delay: 1.4 }
        ]
      },
      {
        wave: 9, title: '气隙上空蜂群', bonusIntel: 11,
        groups: [
          { entry: 'A', type: 'rogue_ap', count: 5, interval: 1.4, delay: 0.3 },
          { entry: 'B', type: 'rogue_ap', count: 4, interval: 1.5, delay: 1.2 },
          { entry: 'C', type: 'packer', count: 2, interval: 2.8, delay: 1.0 },
          { entry: 'C', type: 'trojan', count: 7, interval: 0.95, delay: 1.4 }
        ]
      },
      {
        wave: 10, title: '双核定向爆破', bonusIntel: 12,
        groups: [
          { entry: 'B', type: 'packer', count: 3, interval: 2.5, delay: 0.5 },
          { entry: 'B', type: 'ransom', count: 4, interval: 1.8, delay: 1.0 },
          { entry: 'C', type: 'flood', count: 4, interval: 1.9, delay: 1.2 },
          { entry: 'A', type: 'trojan', count: 7, interval: 0.95, delay: 1.8 }
        ]
      },
      {
        wave: 11, title: '蠕虫裂变狂潮', bonusIntel: 12,
        groups: [
          { entry: 'A', type: 'worm', count: 10, interval: 0.7, delay: 0.3 },
          { entry: 'B', type: 'worm', count: 8, interval: 0.75, delay: 1.0 },
          { entry: 'C', type: 'packer', count: 3, interval: 2.4, delay: 0.8 },
          { entry: 'C', type: 'ransom', count: 4, interval: 1.75, delay: 1.5 }
        ]
      },
      {
        wave: 12, title: '【洪峰】气隙三路总洪峰', bonusIntel: 16, isFloodPeak: true,
        alert: '【流量洪峰告警】跳板机、办公网下行与供应商远维三端同时倾泻高危工控洪峰！',
        groups: [
          { entry: 'A', type: 'flood', count: 4, interval: 1.65, delay: 0.2 },
          { entry: 'A', type: 'trojan', count: 8, interval: 0.8, delay: 0.8 },
          { entry: 'B', type: 'worm', count: 10, interval: 0.65, delay: 0.3 },
          { entry: 'B', type: 'ransom', count: 4, interval: 1.6, delay: 0.9 },
          { entry: 'C', type: 'packer', count: 3, interval: 2.1, delay: 0.4 },
          { entry: 'C', type: 'flood', count: 3, interval: 1.8, delay: 1.0 },
          { entry: 'C', type: 'rogue_ap', count: 6, interval: 1.25, delay: 1.8 }
        ]
      },
      {
        wave: 13, title: '总线暗影渗透', bonusIntel: 13,
        groups: [
          { entry: 'B', type: 'trojan', count: 8, interval: 0.85, delay: 0.4 },
          { entry: 'C', type: 'trojan', count: 8, interval: 0.85, delay: 0.9 },
          { entry: 'A', type: 'packer', count: 3, interval: 2.4, delay: 1.0 },
          { entry: 'A', type: 'rogue_ap', count: 6, interval: 1.3, delay: 2.0 }
        ]
      },
      {
        wave: 14, title: '高压联锁冲击', bonusIntel: 14,
        groups: [
          { entry: 'A', type: 'flood', count: 5, interval: 1.75, delay: 0.4 },
          { entry: 'B', type: 'ransom', count: 5, interval: 1.65, delay: 0.8 },
          { entry: 'C', type: 'packer', count: 3, interval: 2.3, delay: 1.0 },
          { entry: 'C', type: 'worm', count: 10, interval: 0.68, delay: 1.2 }
        ]
      },
      {
        wave: 15, title: '蛰影先遣近卫', bonusIntel: 15,
        groups: [
          { entry: 'A', type: 'packer', count: 3, interval: 2.2, delay: 0.4 },
          { entry: 'B', type: 'flood', count: 4, interval: 1.8, delay: 0.6 },
          { entry: 'C', type: 'ransom', count: 5, interval: 1.6, delay: 0.8 },
          { entry: 'A', type: 'rogue_ap', count: 7, interval: 1.2, delay: 1.5 },
          { entry: 'C', type: 'trojan', count: 8, interval: 0.85, delay: 2.0 }
        ]
      },
      {
        wave: 16, title: '终局首领：蛰影', bonusIntel: 0, isBossWave: true,
        alert: '【最高级别告警】攻击组织核心首领「蛰影」潜入运维跳板机！经历潜伏、提权与破坏三阶段！',
        groups: [
          { entry: 'A', type: 'zheying', count: 1, interval: 1.0, delay: 0.8 },
          { entry: 'B', type: 'ransom', count: 4, interval: 1.85, delay: 1.6 },
          { entry: 'C', type: 'packer', count: 3, interval: 2.6, delay: 2.2 },
          { entry: 'B', type: 'flood', count: 3, interval: 2.3, delay: 3.5 },
          { entry: 'C', type: 'rogue_ap', count: 6, interval: 1.4, delay: 5.0 }
        ]
      }
    ]
  }
];

export function getMapById(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}
