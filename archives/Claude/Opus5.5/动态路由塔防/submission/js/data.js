// 数据表：塔、敌人、Boss、道具、状态、地形。说明文字尽量由数值拼出，保证与实际一致。
(function (root) {
  const TD = root.TD = root.TD || {};

  TD.ROLE_COLORS = {
    block: '#EE8A4A', lure: '#EAC15A', gate: '#E8604A', ranged: '#5FB8E6', aoe: '#86C98A', heal: '#7FDBC0',
  };

  const T = TD.TOWERS = {
    firewall: {
      id: 'firewall', name: '防火墙', role: '阻挡', roleKey: 'block', place: ['link', 'node'], key: '1',
      cost: 70, nodeIntel: 8, hp: 520, block: 3, dmg: 18, rate: 1.0,
      brief: '链路上拦人并还击；节点上隔离节点并拦截相邻链路。',
      lv2: { cost: 80, hp: 780, block: 5, dmg: 22, title: '状态检测引擎', desc: '容量升到 5；还击从单体变为同时命中全部被挡敌人。' },
      skill: { name: '策略封锁', cd: 22, dur: 7, blockBonus: 3, dmgTaken: 0.6, desc: '7 秒内阻挡容量 +3，受到伤害 -40%，把重量级威胁也按在原地。' },
    },
    honeypot: {
      id: 'honeypot', name: '蜜罐', role: '诱敌阻挡', roleKey: 'lure', place: ['link'], key: '2',
      cost: 45, hp: 190, block: 3, lureR: 3.2, immuneEncrypt: true,
      brief: '伪造应答把近处的攻塔敌人引过来替别的塔挨打；不会被加密。',
      skill: { name: '诱捕', cd: 16, dur: 3.5, desc: '被诱来并挡住的敌人被困 3.5 秒，期间不能移动和攻击。' },
      branches: {
        trap: { key: 'trap', title: '高交互陷阱', cost: 50, intel: 12, hp: 240, trapDur: 5.5, exposed: 1.4, block: 3, lureR: 3.2,
          desc: '诱捕延长到 5.5 秒；被困者显形并“暴露”，受到伤害 +40%，被困时消灭每个回收 1 情报。把蜜罐变成火力点。' },
        net: { key: 'net', title: '影子蜜网', cost: 50, intel: 12, hp: 300, trapDur: 3.5, block: 5, lureR: 4.8, ghost: 8,
          desc: '诱敌半径升到 4.8 格，可诱来 5 个敌人；被摧毁后留下残影，继续诱敌 8 秒。把蜜罐变成长距离牵制。' },
      },
    },
    gate: {
      id: 'gate', name: '网闸', role: '隔离', roleKey: 'gate', place: ['node'], key: '3',
      cost: 35, nodeIntel: 6, hp: 700,
      brief: '低成本物理隔离节点，耐久高但不攻击；仍会被冲击与远程攻击破坏。',
      lv2: { cost: 60, hp: 1100, title: '单向导入', holdRate: 2, impactTaken: 0.7, desc: '耐久升到 1100，受节点冲击 -30%；交战守点产出的情报翻倍。' },
      skill: { name: '断链加固', cd: 24, dur: 8, dmgTaken: 0.3, desc: '8 秒内受到的伤害 -70%，用来顶住洪泛团的重击。' },
    },
    interceptor: {
      id: 'interceptor', name: '拦截器', role: '远程', roleKey: 'ranged', place: ['platform'], key: '4',
      cost: 85, hp: 200, range: 5.6, arc: 100, dmg: 26, rate: 0.8, air: true, aim: true,
      brief: '朝向决定攻击扇区，单体远程，地面与飞行都能打。',
      skill: { name: '超频连射', cd: 18, dur: 6, rateMul: 2.2, desc: '6 秒内射速 ×2.2。' },
      branches: {
        pierce: { key: 'pierce', title: '贯穿线膛', cost: 70, intel: 12, hp: 240, range: 8.2, arc: 60, dmg: 38, rate: 1.35,
          desc: '扇区收窄到 60°、射程 8.2 格；每发穿透一条直线上的所有敌人，优先瞄准同一直线上敌人最多的方向。适合沿长直路纵射。' },
        suppress: { key: 'suppress', title: '压制矩阵', cost: 70, intel: 12, hp: 300, range: 4.6, arc: 170, dmg: 15, rate: 0.5, slow: 0.55, atkMul: 0.5, sup: 2.5,
          desc: '扇区展开到 170°、射程 4.6 格；命中施加“压制”（移速 -45%、攻击 -50%，2.5 秒），优先选择正在攻塔且未被压制的敌人。' },
      },
    },
    sandbox: {
      id: 'sandbox', name: '沙箱', role: '检测/范围', roleKey: 'aoe', place: ['platform'], key: '5',
      cost: 110, hp: 220, range: 3.8, blast: 1.6, dmg: 30, rate: 1.7,
      brief: '检测范围内的伪装与潜伏目标并使其显形，对地面敌人范围爆破。',
      lv2: { cost: 90, hp: 320, range: 4.4, blast: 2.2, dmg: 38, residue: 3.5, title: '引爆隔离室', desc: '检测半径 4.4 格，爆破半径 2.2 格；落点留下 3.5 秒残留场，地面敌人减速 30% 并持续受损。' },
      skill: { name: '全量扫描', cd: 24, dur: 6, radius: 7, strip: 0.6, desc: '半径 7 格内所有目标显形 6 秒，并打破敌人 60% 的护盾。' },
    },
    repair: {
      id: 'repair', name: '修复进程', role: '治疗', roleKey: 'heal', place: ['platform'], key: '6',
      cost: 80, hp: 180, range: 3.4, heal: 26, targets: 1,
      brief: '不攻击敌人，持续治疗范围内其他受损的塔，包括节点上的塔。',
      lv2: { cost: 70, hp: 260, range: 4.0, heal: 18, targets: 3, purge: 10, shield: 190, title: '多路镜像', desc: '同时治疗 3 座塔（每座 18/秒），范围 4 格；每 10 秒自动解除一座塔的加密；冗余切换护盾升到 190。' },
      skill: { name: '冗余切换', cd: 20, dur: 8, shield: 120, desc: '范围内友塔获得护盾（1 级 120，2 级 190，持续 8 秒）并立即解除加密；修复进程自身获得一半护盾。' },
    },
  };
  TD.TOWER_ORDER = ['firewall', 'honeypot', 'gate', 'interceptor', 'sandbox', 'repair'];

  TD.ENEMIES = {
    worm: {
      id: 'worm', name: '蠕虫', hp: 72, speed: 1.28, atk: 9, atkRate: 0.8, block: 1, leak: 1, reward: 6, r: 0.3,
      lurable: true, attacksTowers: true,
      tag: '近战 · 自复制',
      desc: '被阻挡时持续撕咬挡住它的塔。首次经过直通的交换节点时复制出一个同伴（复制体不再复制），所以放任它穿过多个节点会越滚越多。',
      counter: '在节点之前的链路用防火墙拦截，或隔离节点让它拿不到复制机会。',
    },
    flood: {
      id: 'flood', name: '洪泛团', hp: 320, speed: 0.72, atk: 16, atkRate: 1.0, impact: 54, impactRate: 1.6, block: 2, leak: 2, reward: 18, intel: 1, r: 0.46,
      lurable: true, attacksTowers: true, siege: 6.5,
      tag: '节点冲击 · 占用阻挡',
      desc: '占用 2 点阻挡容量。发现 6.5 格路程内的被隔离节点时会离开当前路线，走到节点可通行的一侧重击节点上的塔或隔离器，打通后沿重新开放的道路前进。',
      counter: '修复进程保住隔离点、网闸开断链加固，或用蜜罐半路截走。',
    },
    trojan: {
      id: 'trojan', name: '木马', hp: 120, speed: 1.05, atk: 8, atkRate: 1.0, block: 1, leak: 1, reward: 10, r: 0.32, stealth: true,
      attacksTowers: true, payload: 70, payloadR: 1.8,
      tag: '伪装 · 载荷',
      desc: '伪装成正常封装数据包，显形前不能被远程单体攻击选中。沙箱检测、旧链路和阻挡都会让它显形。未显形就被攻击波及消灭时释放载荷，伤害 1.8 格内的塔。',
      counter: '让它走旧链路（可用协议降级制造），或在路线上布沙箱。',
    },
    ransom: {
      id: 'ransom', name: '勒索者', hp: 180, speed: 0.8, atk: 13, atkRate: 1.5, range: 3.6, encrypt: 3.5, block: 1, leak: 2, reward: 15, intel: 1, r: 0.38,
      attacksTowers: true, ranged: true,
      tag: '远程 · 加密',
      desc: '边移动边攻击 3.6 格内的塔，包括平台上的塔，每次命中造成伤害并加密 3.5 秒。射程内有蜜罐时优先打蜜罐（蜜罐不会被加密）。',
      counter: '蜜罐吸收火力；修复进程的冗余切换或备份还原解除加密。',
    },
    hotspot: {
      id: 'hotspot', name: '伪热点', hp: 92, speed: 1.55, block: 0, leak: 1, reward: 10, r: 0.34, fly: true,
      tag: '飞行 · 直线',
      desc: '沿无线层从入口直飞出口，不受地面道路、隔离与阻挡影响，只有拦截器能打到它。',
      counter: '把拦截器的扇区对准入口到出口的连线。',
    },
    packer: {
      id: 'packer', name: '加壳器', hp: 150, speed: 0.86, atk: 6, atkRate: 1.2, block: 1, leak: 1, reward: 15, intel: 1, r: 0.36,
      shieldR: 2.8, shieldAmt: 48, shieldCap: 96, shieldRate: 5.5, attacksTowers: true,
      tag: '支援 · 护盾',
      desc: '每 5.5 秒给 2.8 格内的同伴加 48 点可被打破的护盾（上限 96）。自身也走在队伍里，优先消灭它还是集中打前排需要取舍。',
      counter: '贯穿线膛可以越过前排打到它，全量扫描能直接打破护盾。',
    },
  };
  TD.ENEMY_ORDER = ['worm', 'flood', 'trojan', 'ransom', 'hotspot', 'packer'];

  TD.BOSSES = {
    wankui: {
      id: 'wankui', boss: true, name: '万傀', title: '僵尸网络操纵者', hp: 5200, speed: 0.46, atk: 42, atkRate: 1.3, block: 4, leak: 12, reward: 200, intel: 12, r: 0.8, attacksTowers: true,
      tag: 'Boss · 分段内网第 14 波',
      desc: '数千台肉鸡的群体控制端。「洪峰」冲击被隔离节点，重创节点上的塔并冲毁隔离器；生命低于 55% 后牵动傀儡丝，持续释放成群蠕虫，同时压迫节点与阻挡塔。',
      counter: '洪峰会先预警目标节点：提前开断链加固或冗余切换，或干脆撤塔放行。',
      phases: [
        { name: '群控', desc: '每 15 秒发动洪峰冲击一个被隔离节点。' },
        { name: '傀儡暴动', at: 0.55, desc: '洪峰间隔缩短到 11 秒，每 11 秒释放 6 只蠕虫。' },
      ],
    },
    shenlou: {
      id: 'shenlou', boss: true, ownBlocks: true, name: '蜃楼', title: '路由欺骗幻体', hp: 6200, speed: 0.48, atk: 36, atkRate: 1.4, block: 4, leak: 12, reward: 220, intel: 12, r: 0.85, attacksTowers: true,
      tag: 'Boss · 骨干流域第 15 波',
      desc: '伪造路由通告的幻体。「伪路由」在前方链路制造临时路由黑洞，截断通行、迫使各入口改道（它自己知道真实路由，不受黑洞影响）；生命低于 50% 后发动「路由风暴」，削弱附近塔的护盾。',
      counter: '黑洞位置先预警：保留第二条防线，并把冗余切换留到风暴之后。',
      phases: [
        { name: '伪路由', desc: '每 17 秒在前方链路预警后制造一处黑洞，持续 13 秒。' },
        { name: '路由风暴', at: 0.5, desc: '额外每 12 秒风暴一次，半径 6 格内的塔护盾减半并受到冲击。' },
      ],
    },
    zheying: {
      id: 'zheying', boss: true, ownBlocks: true, name: '蛰影', title: '攻击组织核心', hp: 7600, speed: 0.46, atk: 48, atkRate: 1.2, block: 4, leak: 14, reward: 260, intel: 14, r: 0.9, attacksTowers: true,
      tag: 'Boss · 气隙深层第 16 波',
      desc: '“蛰影”组织的核心威胁，按潜伏—提权—破坏改变阶段。潜伏时必须被沙箱或全量扫描检测才能被远程单体选中；提权后强化护甲并放出木马；破坏阶段锁死前方一段运维环、改变其他敌人的道路（它自己能穿过锁死段）。',
      counter: '沙箱盯住它的路线；破坏阶段前为两个核心都留下火力。',
      phases: [
        { name: '潜伏', desc: '未被检测时远程单体攻击无法选中。' },
        { name: '提权', at: 0.7, desc: '护甲减伤 35%，每 13 秒放出 3 只木马。' },
        { name: '破坏', at: 0.35, desc: '每 18 秒预警后锁死前方一段运维环，持续 14 秒。' },
      ],
    },
  };
  TD.BOSS_ORDER = ['wankui', 'shenlou', 'zheying'];

  TD.ITEMS = {
    isolator: {
      id: 'isolator', name: '应急隔离器', res: 'intel', cost: 12, cd: 32, key: 'Q', hp: 280, dur: 20, target: 'node',
      brief: '临时隔离一个直通节点。',
      desc: '投放到直通节点上，耐久 280、持续 20 秒，到期或被冲毁后恢复直通。它不是塔：不占算力，但也不产生守点情报。',
    },
    downgrade: {
      id: 'downgrade', name: '协议降级', res: 'intel', cost: 8, cd: 26, key: 'W', radius: 2.6, dur: 16, target: 'area',
      brief: '让一片链路暂时走旧协议。',
      desc: '半径 2.6 格内的链路和节点变成旧协议 16 秒：地面敌人减速、木马显形，路线代价上升，敌人可能因此改走别路。',
    },
    backup: {
      id: 'backup', name: '备份还原', res: 'compute', cost: 45, cd: 14, key: 'E', heal: 0.5, target: 'tower',
      brief: '恢复一座塔的部分生命并解除加密。',
      desc: '恢复目标塔 50% 最大生命，并立刻解除其加密。',
    },
  };
  TD.ITEM_ORDER = ['isolator', 'downgrade', 'backup'];

  TD.STATUSES = [
    { id: 'stealth', name: '伪装 / 潜伏', icon: '◌', color: '#A8B4BC', desc: '未显形的目标不能被远程单体主动选中。解除：沙箱检测、全量扫描、旧链路（木马）、被阻挡。' },
    { id: 'reveal', name: '显形', icon: '◉', color: '#F0D878', desc: '已被识别，可以被远程单体选中。木马显形后不再伪装；蛰影的潜伏只在被检测期间显形。' },
    { id: 'shield', name: '护盾', icon: '⬡', color: '#8FD6F0', desc: '先于生命吸收伤害。敌方护盾来自加壳器，可被打破；我方护盾来自冗余切换，8 秒后消失，路由风暴会使其减半。' },
    { id: 'encrypt', name: '加密', icon: '🔒', color: '#B08CF0', desc: '塔暂时停止攻击、治疗和释放技能，但阻挡和节点隔离不受影响。解除：等待到期、冗余切换、备份还原、多路镜像。蜜罐免疫。' },
    { id: 'suppress', name: '压制', icon: '≋', color: '#A99BE8', desc: '来自压制矩阵：敌人移速 -45%、攻击 -50%，持续 2.5 秒，可刷新。' },
    { id: 'trap', name: '被困', icon: '⛓', color: '#EAC15A', desc: '来自诱捕：敌人不能移动和攻击。高交互陷阱的被困目标还会暴露，受到伤害 +40%。' },
    { id: 'slow', name: '旧协议减速', icon: '⧖', color: '#E8A868', desc: '地面敌人在旧链路或协议降级区内速度 ×0.55。路线选择会把这段慢速算进代价。' },
    { id: 'lockout', name: '再隔离间隔', icon: '⟳', color: '#EE8A4A', desc: '节点恢复直通后要等待才能再次隔离。短时间内反复切换同一节点会触发路由抖动抑制，间隔逐次加长。' },
  ];

  TD.TERRAIN = [
    { id: 'link', name: '链路', color: '#5F8FA6', desc: '恶意程序与业务流量经过的道路。防火墙和蜜罐可以部署在这里（入口、出口除外）；它们阻挡敌人但不截断道路。' },
    { id: 'node', name: '交换节点', color: '#6FDFAE', desc: '链路交汇处的网络设备。绿灯表示直通。部署防火墙、网闸或投放应急隔离器会隔离节点，红灯表示这一格不能通行；解除后旁路直通。' },
    { id: 'legacy', name: '旧链路', color: '#C9964A', desc: '保留旧协议的道路。地面敌人经过时速度 ×0.55，木马在此显形；寻路会把较慢的通行速度计入代价。' },
    { id: 'platform', name: '设备平台', color: '#D8D0BC', desc: '比链路高一层的部署位，放拦截器、沙箱和修复进程。敌人不能通行。' },
    { id: 'obstacle', name: '障碍', color: '#6E7078', desc: '数据设施、公网流和气隙等。不能通行，也不能部署。' },
    { id: 'entrance', name: '入口', color: '#E8604A', desc: '恶意流量进入汐域的位置。路线颜色与入口一一对应。' },
    { id: 'exit', name: '出口', color: '#E8C66E', desc: '敌人到达时中枢完整度下降，归零即失败。敌人总是走代价最低的路通向最近的出口。' },
  ];

  TD.RULES = {
    startIntegrity: 20,
    tile: 2,
    legacySpeed: 0.55,
    computeRate: 2.4,
    sellRefund: 0.6,
    relockBase: 8,
    relockStep: 6,
    flapWindow: 45,
    holdEvery: 6,
    holdRadius: 5,
    prepFirst: 34,
    prepNext: 20,
  };

  TD.ENTRANCE_COLORS = { A: '#62C4E8', B: '#F0708E', C: '#C4E06A' };
  TD.EXIT_COLORS = { X: '#F2D9A0', Y: '#BBA8E8' };

  // 把塔当前的等级、分支折算成运行数值；UI 与逻辑共用同一个函数
  TD.towerStats = function (type, level, branch) {
    const b = T[type];
    const s = Object.assign({}, b);
    if (level >= 2) {
      if (b.branches && branch) Object.assign(s, b.branches[branch]);
      else if (b.lv2) Object.assign(s, b.lv2);
    }
    return s;
  };

  TD.towerDescribe = function (type, level, branch) {
    const s = TD.towerStats(type, level, branch);
    const rows = [];
    rows.push(['生命', Math.round(s.hp)]);
    if (s.block) rows.push(['阻挡容量', s.block]);
    if (type === 'firewall') rows.push(['还击', s.dmg + ' / ' + s.rate.toFixed(1) + ' 秒' + (level >= 2 ? '（全部被挡者）' : '（单体）')]);
    if (type === 'honeypot') rows.push(['诱敌半径', s.lureR + ' 格']);
    if (type === 'interceptor') {
      rows.push(['射程', s.range + ' 格']); rows.push(['扇区', s.arc + '°']); rows.push(['伤害', s.dmg + ' / ' + s.rate + ' 秒']);
      rows.push(['目标', branch === 'pierce' ? '敌人最多的直线（穿透）' : branch === 'suppress' ? '攻塔中未压制者优先' : '离出口最近的显形目标']);
    }
    if (type === 'sandbox') { rows.push(['检测半径', s.range + ' 格']); rows.push(['爆破半径', s.blast + ' 格']); rows.push(['伤害', s.dmg + ' / ' + s.rate + ' 秒']); }
    if (type === 'repair') { rows.push(['范围', s.range + ' 格']); rows.push(['治疗', s.heal + '/秒 × ' + s.targets + ' 座']); }
    return rows;
  };
})(typeof window !== 'undefined' ? window : globalThis);
