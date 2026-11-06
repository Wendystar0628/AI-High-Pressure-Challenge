// 三张地图：用折线 / 矩形描述，运行时栅格化。每张图的网络结构不同，详见 tools/test_routes.js 的校验。
(function (root) {
  const TD = root.TD = root.TD || {};

  // 波次写法：[敌人, 数量, 入口, 开始秒, 间隔秒]
  const W = (label, groups, extra) => Object.assign({ label, groups }, extra || {});

  const MAPS = {};

  MAPS.intranet = {
    id: 'intranet', index: 1, name: '分段内网', en: 'SEGMENTED INTRANET', kind: '企业网',
    theme: 'intranet', w: 28, h: 18, startCompute: 280, startIntel: 18,
    summary: '两条入侵流穿过 DMZ 进入办公网段和业务网段，在核心前汇流。一个隔离点可以把两路并成一路，也可以把它们赶到外环。',
    doctrine: '布防思路：并流。用隔离把两路流量压到同一条干道集中火力，但干道一旦被冲开，火力就落空。',
    entrances: [
      { id: 'A', x: 5, y: 0, name: '门户网站' },
      { id: 'B', x: 21, y: 0, name: '邮件网关' },
    ],
    exits: [{ id: 'X', x: 11, y: 16, name: '核心数据库' }],
    roads: [
      [[5, 0], [5, 11]],            // A 西边界干道
      [[21, 0], [21, 11]],          // B 东边界干道
      [[5, 2], [21, 2]],            // DMZ 互联
      [[5, 7], [11, 7]],            // 办公网段
      [[11, 7], [11, 16]],          // 核心干道
      [[21, 6], [15, 6]],           // 业务网段
      [[15, 6], [15, 9]],
      [[15, 9], [11, 9]],
      [[5, 11], [2, 11]],           // 旧系统网段
      [[2, 11], [2, 16]],
      [[2, 16], [25, 16]],          // 外环汇入核心
      [[21, 11], [25, 11]],         // 灾备环
      [[25, 11], [25, 16]],
    ],
    legacy: [
      [[6, 11], [10, 11]],
      [[12, 11], [20, 11]],
    ],
    nodes: [
      { id: 'W', x: 5, y: 6, name: '西边界节点' },
      { id: 'E', x: 21, y: 4, name: '东边界节点' },
      { id: 'O', x: 9, y: 7, name: '办公汇聚节点' },
      { id: 'S', x: 17, y: 6, name: '业务汇聚节点' },
      { id: 'T', x: 11, y: 10, name: '干道节点' },
      { id: 'K', x: 11, y: 13, name: '核心前节点' },
    ],
    platforms: [
      [6, 3, 9, 5], [16, 3, 19, 4], [6, 8, 10, 8], [6, 10, 10, 10], [6, 9, 6, 9], [9, 9, 10, 9],
      [12, 7, 14, 8], [12, 10, 15, 10], [16, 8, 18, 9], [16, 7, 18, 7], [16, 10, 20, 10],
      [8, 12, 10, 15], [3, 12, 7, 12], [12, 12, 15, 14], [21, 12, 24, 13],
      [2, 4, 4, 6], [22, 4, 24, 6], [0, 10, 1, 13], [26, 12, 27, 15], [3, 14, 4, 15],
    ],
    obstacles: [
      [7, 9, 8, 9, 'desk'], [11, 3, 14, 5, 'dmz'], [19, 8, 20, 9, 'rack'],
      [5, 13, 7, 15, 'legacyrack'], [16, 13, 20, 15, 'drsite'], [21, 14, 24, 15, 'drsite2'],
      [8, 0, 11, 1, 'portal'], [15, 0, 18, 1, 'mail'], [22, 7, 24, 10, 'tower'], [1, 7, 3, 9, 'tower2'],
      [13, 17, 17, 17, 'cable'], [5, 17, 9, 17, 'cable'],
      [10, 17, 12, 17, 'vault'],
    ],
    regions: [
      { x: 13, y: 2, text: 'DMZ 互联' }, { x: 7.5, y: 4, text: '办公网段' }, { x: 17, y: 8, text: '业务网段' },
      { x: 3.5, y: 14.5, text: '旧系统网段' }, { x: 22.5, y: 12.5, text: '灾备环' }, { x: 15.5, y: 11, text: '旧链路' },
    ],
    waves: [
      W('常规探测', [['worm', 6, 'A', 0, 1.6]]),
      W('双路扫描', [['worm', 5, 'A', 0, 1.5], ['worm', 5, 'B', 3, 1.5]]),
      W('洪泛试探', [['worm', 6, 'B', 0, 1.2], ['flood', 1, 'A', 3, 1]], { intro: 'flood' }),
      W('封装异常', [['trojan', 4, 'A', 0, 2.2], ['worm', 6, 'B', 2, 1.2]], { intro: 'trojan' }),
      W('横向移动', [['worm', 8, 'A', 0, 1], ['trojan', 3, 'B', 1, 2], ['flood', 1, 'B', 6, 1]]),
      W('加密告警', [['ransom', 2, 'B', 0, 4], ['worm', 8, 'A', 1, 1], ['trojan', 2, 'A', 6, 2]], { intro: 'ransom' }),
      W('无线旁路', [['hotspot', 4, 'A', 0, 2.2], ['hotspot', 2, 'B', 2, 3], ['flood', 2, 'A', 4, 4], ['worm', 6, 'B', 3, 1.1]], { intro: 'hotspot' }),
      W('加壳投递', [['packer', 1, 'A', 2, 1], ['worm', 10, 'A', 0, 0.9], ['ransom', 2, 'B', 2, 3.5], ['trojan', 3, 'B', 6, 1.8]], { intro: 'packer' }),
      W('双线施压', [['flood', 2, 'B', 0, 4], ['flood', 2, 'A', 2, 4], ['hotspot', 4, 'B', 3, 2], ['worm', 10, 'A', 5, 0.8]]),
      W('定向勒索', [['ransom', 4, 'A', 0, 3], ['packer', 1, 'A', 3, 1], ['trojan', 5, 'B', 1, 1.5], ['worm', 8, 'B', 5, 0.9]]),
      W('僵尸集结', [['worm', 20, 'A', 0, 0.5], ['worm', 20, 'B', 2, 0.5], ['flood', 3, 'B', 6, 3], ['packer', 3, 'A', 3, 3], ['ransom', 2, 'A', 7, 3]]),
      W('全面渗透', [['flood', 4, 'A', 0, 3], ['ransom', 4, 'B', 1, 2.6], ['trojan', 8, 'A', 4, 1], ['hotspot', 7, 'A', 6, 1.4], ['packer', 2, 'B', 4, 4]]),
      W('控制通道建立', [['flood', 5, 'B', 0, 2.6], ['ransom', 5, 'B', 3, 2.4], ['packer', 3, 'A', 2, 4], ['worm', 20, 'A', 2, 0.6], ['hotspot', 6, 'B', 8, 1.6]]),
      W('万傀', [['wankui', 1, 'A', 2, 1], ['worm', 14, 'B', 0, 0.8], ['flood', 3, 'B', 8, 5], ['packer', 2, 'B', 6, 5], ['ransom', 2, 'A', 10, 5]], { boss: 'wankui' }),
    ],
  };

  MAPS.backbone = {
    id: 'backbone', index: 2, name: '骨干流域', en: 'BACKBONE BASIN', kind: '跨网专线 · 双活数据中心',
    theme: 'backbone', w: 30, h: 18, startCompute: 400, startIntel: 22,
    summary: '公网流把战场切成南北两岸，只有专线隧道和旧专线能过河。C、B 平时走旧专线汇流去 Y，隔离汇聚节点会把它们全部赶去 X，与 A 挤在一起。',
    doctrine: '布防思路：调度。两座数据中心互为备份，每一次改道都在挪动压力，要选把压力放在哪一岸。',
    entrances: [
      { id: 'A', x: 5, y: 0, name: '互联网' },
      { id: 'C', x: 17, y: 0, name: '分支专线' },
      { id: 'B', x: 26, y: 0, name: '云端互联' },
    ],
    exits: [
      { id: 'X', x: 5, y: 16, name: '数据中心 X' },
      { id: 'Y', x: 24, y: 16, name: '数据中心 Y' },
    ],
    roads: [
      [[5, 0], [5, 16]],            // A 干线 + 西隧道
      [[17, 0], [17, 5]],           // C 专线
      [[26, 0], [26, 5]],           // 云端互联
      [[10, 2], [26, 2]],           // 北部骨干环东段
      [[5, 2], [7, 2]],
      [[5, 5], [26, 5]],            // 北岸汇聚干线
      [[10, 5], [10, 12]],          // 中央隧道
      [[20, 5], [20, 6]],           // 旧专线北引桥
      [[20, 12], [20, 12]],
      [[5, 12], [24, 12]],          // 南岸环
      [[24, 12], [24, 16]],
    ],
    legacy: [
      [[8, 2], [9, 2]],
      [[20, 7], [20, 11]],          // 旧专线
    ],
    tunnels: [
      { x: 5, y0: 7, y1: 11, name: '西专线隧道' },
      { x: 10, y0: 7, y1: 11, name: '中央隧道' },
    ],
    nodes: [
      { id: 'T', x: 5, y: 6, name: '西隧道节点' },
      { id: 'H', x: 20, y: 5, name: '汇聚节点' },
      { id: 'C1', x: 17, y: 3, name: '分支接入节点' },
      { id: 'B1', x: 26, y: 4, name: '云端接入节点' },
      { id: 'X1', x: 5, y: 14, name: 'X 前置节点' },
      { id: 'Y1', x: 24, y: 14, name: 'Y 前置节点' },
    ],
    platforms: [
      [7, 3, 9, 4], [11, 3, 15, 4], [18, 3, 24, 4], [6, 6, 9, 7], [11, 6, 13, 7], [16, 6, 19, 7], [21, 6, 25, 7],
      [6, 11, 9, 11], [11, 11, 19, 11], [21, 11, 27, 11], [6, 13, 9, 14], [11, 13, 15, 14], [17, 13, 23, 13],
      [25, 13, 27, 14], [1, 4, 4, 6], [27, 3, 29, 6],
    ],
    obstacles: [
      [0, 8, 29, 10, 'flow'],
      [14, 6, 15, 7, 'router'], [26, 6, 28, 7, 'router'], [0, 0, 3, 2, 'dish'], [19, 0, 24, 1, 'cloud'], [8, 0, 14, 1, 'isp'],
      [1, 11, 3, 14, 'dish2'], [6, 15, 12, 17, 'dcx'], [3, 15, 4, 17, 'dcx'], [14, 15, 22, 17, 'dcm'], [25, 15, 29, 17, 'dcy'], [17, 14, 23, 14, 'fiber'], [16, 13, 16, 14, 'fiber'],
      [28, 11, 29, 14, 'dish2'],
    ],
    regions: [
      { x: 14, y: 9, text: '公 网 流' }, { x: 8, y: 13.6, text: 'X 机房区' }, { x: 21, y: 13, text: 'Y 机房区' }, { x: 7.5, y: 6.6, text: '西专线隧道' }, { x: 12, y: 6.6, text: '中央隧道' },
      { x: 20, y: 9, text: '旧专线' },
    ],
    waves: [
      W('骨干巡检', [['worm', 3, 'A', 0, 2], ['worm', 2, 'C', 4, 2.2]]),
      W('专线扫描', [['worm', 3, 'B', 0, 1.6], ['worm', 3, 'C', 1, 1.6], ['trojan', 2, 'A', 4, 2.4]], { intro: 'trojan' }),
      W('热点外溢', [['hotspot', 3, 'A', 0, 2.4], ['worm', 4, 'C', 2, 1.4], ['worm', 3, 'A', 5, 1.4]], { intro: 'hotspot' }),
      W('汇聚冲击', [['flood', 1, 'C', 0, 4], ['worm', 5, 'B', 1, 1.2], ['trojan', 3, 'A', 3, 2]], { intro: 'flood' }),
      W('隧道勒索', [['ransom', 1, 'A', 0, 4], ['worm', 6, 'A', 1, 1.1], ['flood', 1, 'B', 5, 1], ['worm', 3, 'C', 3, 1.4]], { intro: 'ransom' }),
      W('多云回灌', [['packer', 1, 'B', 2, 1], ['worm', 7, 'B', 0, 1], ['hotspot', 3, 'C', 2, 2.2], ['trojan', 3, 'C', 4, 1.8]], { intro: 'packer' }),
      W('东西错峰', [['flood', 2, 'A', 0, 5], ['ransom', 2, 'C', 2, 4], ['worm', 10, 'B', 1, 0.8], ['packer', 1, 'C', 5, 1]]),
      W('旁路试探', [['trojan', 6, 'B', 0, 1.3], ['trojan', 4, 'A', 3, 1.5], ['hotspot', 5, 'B', 4, 1.6], ['ransom', 2, 'B', 6, 3]]),
      W('洪峰', [
        ['flood', 2, 'A', 0, 3], ['worm', 8, 'A', 0, 0.8],
        ['flood', 2, 'C', 0, 3], ['worm', 8, 'C', 0, 0.8],
        ['flood', 2, 'B', 0, 3], ['worm', 8, 'B', 0, 0.8],
      ], { surge: true }),
      W('南岸渗透', [['ransom', 3, 'A', 0, 2.8], ['packer', 1, 'A', 2, 1], ['trojan', 5, 'C', 0, 1.3], ['hotspot', 3, 'A', 6, 2.2]]),
      W('双活压测', [['flood', 3, 'C', 0, 3], ['flood', 2, 'B', 2, 3], ['packer', 2, 'C', 3, 4], ['worm', 12, 'A', 0, 0.7], ['ransom', 3, 'B', 5, 3]]),
      W('公网放大', [['hotspot', 6, 'A', 0, 1.3], ['hotspot', 4, 'B', 3, 1.5], ['flood', 2, 'A', 2, 4], ['trojan', 5, 'B', 5, 1.1]]),
      W('专线劫持', [['ransom', 4, 'C', 0, 2.6], ['packer', 2, 'B', 1, 4], ['flood', 2, 'B', 3, 3.4], ['worm', 11, 'C', 2, 0.8]]),
      W('收敛风暴', [['flood', 4, 'A', 0, 3], ['ransom', 4, 'B', 1, 2.6], ['trojan', 8, 'C', 2, 1], ['hotspot', 6, 'C', 6, 1.5], ['packer', 2, 'A', 4, 4]]),
      W('蜃楼', [['shenlou', 1, 'C', 2, 1], ['worm', 12, 'A', 0, 0.9], ['flood', 2, 'B', 6, 6], ['packer', 2, 'C', 5, 5], ['hotspot', 4, 'B', 12, 2]], { boss: 'shenlou' }),
    ],
  };

  MAPS.airgap = {
    id: 'airgap', index: 3, name: '气隙深层', en: 'AIR-GAP DEEP', kind: '工控网',
    theme: 'airgap', w: 30, h: 18, startCompute: 430, startIntel: 24,
    summary: '三个入口围着中央气隙接入运维环，两侧通道狭窄、平台稀少。隔离环上不同的节点，会把流量在东西通道之间来回转移，两个核心互相牵制。',
    doctrine: '布防思路：牵制。平台少、核心有两个，守一边就要接受另一边变重，老总线是最后的减速带。',
    entrances: [
      { id: 'A', x: 8, y: 0, name: '运维跳板机' },
      { id: 'B', x: 15, y: 0, name: '办公网下行' },
      { id: 'C', x: 29, y: 8, name: '供应商远程维护' },
    ],
    exits: [
      { id: 'X', x: 11, y: 16, name: '过程控制核心' },
      { id: 'Y', x: 18, y: 16, name: '安全联锁核心' },
    ],
    roads: [
      [[8, 0], [8, 13]],            // A 与西通道
      [[15, 0], [15, 4]],           // B 下行
      [[8, 4], [21, 4]],            // 运维环北段
      [[21, 4], [21, 13]],          // 东通道
      [[8, 13], [21, 13]],          // 运维环南段
      [[29, 8], [22, 8]],           // C 接入
      [[8, 9], [7, 9]],             // 西总线引线
      [[11, 13], [11, 16]],         // X 引线
      [[18, 13], [18, 16]],         // Y 引线
    ],
    legacy: [
      [[6, 9], [6, 15]],             // 西侧老工控总线
      [[6, 15], [10, 15]],
      [[25, 9], [25, 16]],          // 东侧老工控总线
      [[25, 16], [19, 16]],
    ],
    nodes: [
      { id: 'W1', x: 8, y: 6, name: '运维环西北节点' },
      { id: 'W2', x: 8, y: 11, name: '运维环西南节点' },
      { id: 'E1', x: 21, y: 6, name: '运维环东北节点' },
      { id: 'E2', x: 21, y: 10, name: '运维环东南节点' },
      { id: 'CN', x: 23, y: 8, name: '供应商接入节点' },
      { id: 'XF', x: 11, y: 14, name: '过程控制前置' },
      { id: 'YF', x: 18, y: 14, name: '安全联锁前置' },
    ],
    platforms: [
      [5, 3, 7, 7], [9, 1, 11, 3], [17, 1, 20, 3], [9, 5, 12, 5], [17, 5, 20, 5], [9, 12, 12, 12], [17, 12, 20, 12],
      [7, 10, 7, 14], [22, 3, 24, 5], [22, 10, 24, 12], [13, 14, 16, 15], [26, 9, 27, 12], [3, 10, 5, 13],
      [8, 14, 9, 14],
    ],
    obstacles: [
      [10, 6, 19, 11, 'gap'],
      [9, 6, 9, 11, 'gapfence'], [20, 6, 20, 11, 'gapfence'], [13, 5, 16, 5, 'gapfence'], [13, 12, 16, 12, 'gapfence'],
      [12, 1, 14, 2, 'tank'], [16, 1, 16, 2, 'pipe'], [0, 2, 4, 5, 'cooling'], [22, 0, 28, 2, 'turbine'], [25, 3, 28, 6, 'tank'],
      [0, 8, 2, 14, 'plc'], [3, 15, 5, 17, 'cooling'], [27, 13, 29, 17, 'cooling'], [12, 16, 17, 17, 'reactor'],
      [22, 13, 24, 15, 'plc'], [7, 16, 10, 17, 'pipe'], [20, 17, 24, 17, 'pipe'], [28, 9, 29, 12, 'pipe'],
    ],
    regions: [
      { x: 14.5, y: 8.5, text: '气 隙' }, { x: 6, y: 12, text: '老工控总线' }, { x: 25, y: 12.5, text: '老工控总线' },
      { x: 14.5, y: 3.2, text: '运维环' },
    ],
    waves: [
      W('运维窗口', [['worm', 3, 'A', 0, 2], ['worm', 2, 'B', 4, 2]]),
      W('跳板扫描', [['trojan', 2, 'A', 0, 2.4], ['worm', 4, 'B', 1, 1.5]], { intro: 'trojan' }),
      W('供应商通道', [['worm', 5, 'C', 0, 1.3], ['flood', 1, 'B', 3, 1]], { intro: 'flood' }),
      W('工单勒索', [['ransom', 1, 'C', 0, 4], ['worm', 5, 'A', 1, 1.2], ['trojan', 2, 'B', 4, 2]], { intro: 'ransom' }),
      W('无线桥接', [['hotspot', 3, 'B', 0, 2.2], ['flood', 1, 'A', 2, 4], ['worm', 5, 'C', 2, 1.2]], { intro: 'hotspot' }),
      W('固件加壳', [['packer', 1, 'A', 2, 1], ['worm', 8, 'A', 0, 1], ['trojan', 3, 'C', 2, 1.8], ['ransom', 1, 'B', 4, 1]], { intro: 'packer' }),
      W('东西牵制', [['flood', 2, 'A', 0, 4], ['flood', 2, 'C', 1, 4], ['ransom', 2, 'B', 3, 3], ['hotspot', 3, 'A', 6, 2]]),
      W('总线探测', [['trojan', 8, 'C', 0, 1], ['packer', 2, 'B', 2, 4], ['worm', 10, 'B', 1, 0.8]]),
      W('控制逻辑篡改', [['ransom', 4, 'A', 0, 2.5], ['packer', 1, 'A', 3, 1], ['flood', 3, 'C', 2, 3], ['hotspot', 5, 'C', 4, 1.6]]),
      W('蠕虫回潮', [['worm', 18, 'B', 0, 0.5], ['worm', 12, 'C', 3, 0.6], ['trojan', 6, 'A', 2, 1.2], ['flood', 2, 'B', 7, 3]]),
      W('洪峰', [
        ['flood', 3, 'A', 0, 2.4], ['worm', 11, 'A', 0, 0.7], ['packer', 1, 'A', 3, 1],
        ['flood', 3, 'B', 0, 2.4], ['worm', 11, 'B', 0, 0.7], ['packer', 1, 'B', 3, 1],
        ['flood', 3, 'C', 0, 2.4], ['worm', 11, 'C', 0, 0.7], ['packer', 1, 'C', 3, 1],
      ], { surge: true }),
      W('安全联锁告警', [['ransom', 5, 'C', 0, 2.2], ['trojan', 8, 'B', 1, 1], ['hotspot', 6, 'B', 4, 1.3]]),
      W('过程偏移', [['flood', 4, 'A', 0, 3], ['packer', 2, 'A', 2, 4], ['ransom', 3, 'A', 4, 3], ['worm', 16, 'C', 1, 0.6]]),
      W('双核夹击', [['flood', 3, 'B', 0, 3], ['flood', 3, 'C', 1, 3], ['ransom', 4, 'B', 3, 2.5], ['trojan', 8, 'A', 2, 1], ['packer', 2, 'C', 5, 4], ['hotspot', 6, 'A', 8, 1.2]]),
      W('权限收割', [['ransom', 6, 'A', 0, 2], ['flood', 4, 'C', 2, 2.6], ['trojan', 10, 'B', 0, 0.9], ['packer', 3, 'B', 4, 3], ['hotspot', 6, 'C', 6, 1.2]]),
      W('蛰影', [['zheying', 1, 'B', 3, 1], ['trojan', 8, 'A', 0, 1.2], ['worm', 12, 'C', 1, 0.7], ['flood', 3, 'A', 8, 5], ['packer', 2, 'C', 6, 5]], { boss: 'zheying' }),
    ],
  };

  TD.MAPS = MAPS;
  TD.MAP_ORDER = ['intranet', 'backbone', 'airgap'];

  // 地块类型
  const TT = TD.TT = { VOID: 0, LINK: 1, LEGACY: 2, NODE: 3, PLATFORM: 4, OBSTACLE: 5, ENTRANCE: 6, EXIT: 7 };

  // 栅格化
  TD.compileMap = function (id) {
    const def = MAPS[id];
    const w = def.w, h = def.h;
    const tiles = new Uint8Array(w * h);
    const kinds = new Array(w * h).fill(null);
    const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[x + y * w] = t; };
    const line = (a, b, t) => {
      let [x, y] = a; const [x2, y2] = b;
      const dx = Math.sign(x2 - x), dy = Math.sign(y2 - y);
      set(x, y, t);
      while (x !== x2 || y !== y2) { x += dx; y += dy; set(x, y, t); }
    };
    const platZone = new Int16Array(w * h).fill(-1);
    def.platforms.forEach((r, k) => { for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) { set(x, y, TT.PLATFORM); platZone[x + y * w] = k; } });
    for (const r of def.obstacles) for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) { set(x, y, TT.OBSTACLE); kinds[x + y * w] = r[4]; }
    for (const r of def.roads) line(r[0], r[1], TT.LINK);
    for (const r of def.legacy) line(r[0], r[1], TT.LEGACY);
    const nodeAt = new Int16Array(w * h).fill(-1);
    const nodes = def.nodes.map((n, i) => { set(n.x, n.y, TT.NODE); nodeAt[n.x + n.y * w] = i; return Object.assign({ index: i, idx: n.x + n.y * w }, n); });
    const entrances = def.entrances.map(e => { set(e.x, e.y, TT.ENTRANCE); return Object.assign({ idx: e.x + e.y * w }, e); });
    const exits = def.exits.map(e => { set(e.x, e.y, TT.EXIT); return Object.assign({ idx: e.x + e.y * w }, e); });
    const tunnelAt = new Uint8Array(w * h);
    if (def.tunnels) for (const t of def.tunnels) for (let y = t.y0; y <= t.y1; y++) tunnelAt[t.x + y * w] = 1;
    return { def, id, w, h, tiles, kinds, nodes, nodeAt, entrances, exits, tunnelAt, platZone, name: def.name };
  };

  TD.ascii = function (m) {
    const out = [];
    for (let y = 0; y < m.h; y++) {
      let s = '';
      for (let x = 0; x < m.w; x++) {
        const i = x + y * m.w, t = m.tiles[i];
        if (t === TT.NODE) s += String.fromCharCode(97 + m.nodeAt[i]);
        else if (t === TT.ENTRANCE) s += m.entrances.find(e => e.idx === i).id;
        else if (t === TT.EXIT) s += m.exits.find(e => e.idx === i).id;
        else s += ['.', '#', '=', '?', 'P', 'o'][t];
      }
      out.push(String(y).padStart(2, ' ') + ' ' + s);
    }
    return out.join('\n');
  };
})(typeof window !== 'undefined' ? window : globalThis);
