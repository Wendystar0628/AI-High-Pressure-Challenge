/* 动态路由塔防 · 静态数据
 * 塔 / 敌人 / Boss / 道具 / 状态 / 地形 / 波次 / 图鉴文案 */
(function () {
  'use strict';
  var TD = window.TD = window.TD || {};

  var DT = 1 / 60;

  var COLORS = {
    ally: '#39d0e6', ally2: '#7dff9b', enemy: '#ff5a4f', enemy2: '#ffb14f',
    compute: '#ffd27f', intel: '#8fe3ff', core: '#ff6b6b', warn: '#ff3b6b',
    neutral: '#9fb6c8', encrypt: '#b06bff', shield: '#6fe8ff', heal: '#7dff9b'
  };

  // ---------------- 塔 ----------------
  var TOWERS = {
    firewall: {
      id: 'firewall', name: '防火墙', glyph: '▤', color: '#4fd0ff', role: '阻挡 · 链路/节点',
      place: ['=', 'o', 'N'], cost: 60, lvl2cost: 80, branchIntel: 0,
      hp: [240, 400], dmg: [16, 27], range: [1.15, 1.15], rate: [1.1, 1.35], cap: [2, 3],
      blocks: true, melee: true, attacksAir: false, targeting: 'single',
      skill: { name: '强制会话', cd: 16, dur: 6, desc: '短时阻挡容量翻倍并反弹近战伤害。' },
      desc: '在链路上拦住有限数量的地面敌人并还击；超过容量的敌人继续前进。部署在交换节点上会隔离该节点，并拦截相邻链路上的敌人。',
      detail: '承受近战攻击的前线壁垒。节点部署会截断道路，是主动改道的核心手段，但也会成为洪泛团与蠕虫的重点冲击目标。'
    },
    honeypot: {
      id: 'honeypot', name: '蜜罐', glyph: '◎', color: '#ffb14f', role: '诱敌阻挡 · 仅链路',
      place: ['=', 'o'], cost: 45, lvl2cost: 62, branchIntel: 25,
      hp: [110, 185], dmg: [9, 15], range: [1.05, 1.05], rate: [1.0, 1.2], cap: [2, 2],
      blocks: true, melee: true, taunt: true, immuneEncrypt: true, targeting: 'single',
      branches: {
        a: { name: '广域诱答', desc: '诱敌范围大幅扩大，替更多友塔承担攻击。', tauntRange: 3.4, dmg: 15, hp: 185 },
        b: { name: '深度滞留', desc: '诱捕时间延长并缓慢自愈，耐久更高。', trapDur: 7, hp: 240, dmg: 12 }
      },
      skill: { name: '诱捕', cd: 14, dur: 3.2, desc: '困住被诱来的敌人，使其暂时无法移动。' },
      desc: '以伪造应答吸引附近会攻击塔的地面敌人，替其他塔承担攻击；耐久较低，但不会被加密。主动技能「诱捕」困住被诱来的敌人。',
      detail: '升到 2 级需在「广域诱答」与「深度滞留」中二选一：前者扩大诱敌范围，后者强化滞留与生存。'
    },
    gateway: {
      id: 'gateway', name: '网闸', glyph: '⊟', color: '#7f8cff', role: '隔离 · 仅节点',
      place: ['N'], cost: 30, lvl2cost: 40, branchIntel: 0,
      hp: [300, 480], dmg: [0, 0], range: [0, 0], rate: [0, 0], cap: [0, 0],
      isolates: true, targeting: 'none',
      skill: { name: '固件锁定', cd: 18, dur: 5, desc: '短时大幅减伤，稳住关键隔离点。' },
      desc: '低成本隔离交换节点，耐久较高，不攻击。用途是控制道路，仍会受到敌人的攻击和破坏。被摧毁或撤下后节点恢复直通。',
      detail: '改道的主要工具。持续守住被隔离的节点会持续产出情报，但敌人会集中冲击它，需配合修复进程或拦截火力。'
    },
    interceptor: {
      id: 'interceptor', name: '拦截器', glyph: '⌖', color: '#6fe8c8', role: '远程 · 平台 · 有朝向',
      place: ['P'], cost: 90, lvl2cost: 115, branchIntel: 25,
      hp: [130, 205], dmg: [22, 34], range: [3.6, 4.0], rate: [1.35, 1.5], cap: [0, 0],
      ranged: true, attacksAir: true, facing: true, targeting: 'single',
      branches: {
        a: { name: '贯穿弹道', desc: '弹道穿透多个敌人，适合密集队列。', pierce: 3, dmg: 34, rate: 1.25 },
        b: { name: '压制火力', desc: '高射速并施加减速，适合压制洪峰。', slow: 0.45, rate: 2.4, dmg: 26 }
      },
      skill: { name: '火控校准', cd: 15, dur: 6, desc: '短时射程与伤害提升，优先锁定最近出口的目标。' },
      desc: '部署在设备平台上，在朝向决定的扇形攻击区域内进行远程单体攻击，地面与飞行敌人都能打。',
      detail: '部署时由玩家设定朝向，确认前可取消。升到 2 级在「贯穿弹道」与「压制火力」中二选一，分别改变清群与压制能力。'
    },
    sandbox: {
      id: 'sandbox', name: '沙箱', glyph: '⬡', color: '#c08bff', role: '检测 · 范围攻击 · 平台',
      place: ['P'], cost: 80, lvl2cost: 105, branchIntel: 0,
      hp: [145, 220], dmg: [14, 22], range: [2.7, 3.1], rate: [0.8, 0.95], cap: [0, 0],
      detect: true, aoe: true, targetsGround: true, targeting: 'aoe',
      skill: { name: '全域扫描', cd: 17, dur: 3, desc: '立即显形大范围内潜伏目标并释放一次强范围攻击。' },
      desc: '检测范围内伪装或潜伏的目标使其显形，并对地面敌人进行范围攻击，适合处理汇聚的流量。',
      detail: '木马与蛰影潜伏阶段只有经检测显形后，才能被远程单体攻击主动选中；范围攻击可波及未显形目标。'
    },
    repair: {
      id: 'repair', name: '修复进程', glyph: '✚', color: '#7dff9b', role: '专职治疗 · 平台',
      place: ['P'], cost: 70, lvl2cost: 92, branchIntel: 0,
      hp: [125, 195], dmg: [0, 0], range: [3.0, 3.5], rate: [1.0, 1.2], cap: [0, 0],
      heal: true, targeting: 'none',
      skill: { name: '冗余切换', cd: 16, dur: 8, desc: '为附近友塔提供护盾并解除加密，维持关键节点防守。' },
      desc: '不攻击敌人，持续恢复范围内其他受损塔的生命。主动技能「冗余切换」为附近友塔提供护盾并解除加密。',
      detail: '对抗勒索者加密与节点冲击的维持手段；升级扩大治疗范围与治疗量。'
    }
  };

  // ---------------- 敌人 ----------------
  var ENEMIES = {
    worm: {
      id: 'worm', name: '蠕虫', glyph: '≋', color: '#ff5a4f', hp: 62, speed: 1.55, dmg: 13, block: 1,
      rewardC: 9, rewardI: 2, coreDmg: 4, melee: true, copiesAtNode: true,
      desc: '被阻挡时持续攻击挡住它的塔；首次经过直通的交换节点时复制出同伴，复制出的不再复制。',
      detail: '数量压迫型近战单位。放任其通过直通节点会不断增殖，隔离节点或尽快清除可抑制扩散。'
    },
    flood: {
      id: 'flood', name: '洪泛团', glyph: '◉', color: '#ff7a2f', hp: 165, speed: 0.92, dmg: 24, block: 3,
      rewardC: 17, rewardI: 4, coreDmg: 8, melee: true, siege: true,
      desc: '占用较多阻挡容量。会离开当前行进路线，向附近被隔离节点的可通行一侧移动，重击节点上的塔或隔离器；打通后沿重新开放的道路前进。',
      detail: '专门破坏隔离点的攻坚单位。节点上的网闸或防火墙一旦被冲毁，隔离解除、道路重新开放，场上流量随之改回。'
    },
    trojan: {
      id: 'trojan', name: '木马', glyph: '◈', color: '#d24fd0', hp: 74, speed: 1.4, dmg: 0, block: 1,
      rewardC: 12, rewardI: 6, coreDmg: 5, disguise: true, payload: 42,
      desc: '伪装成正常封装数据包，显形前不能被远程单体攻击主动选中；沙箱检测、旧链路和阻挡会使其显形。未显形就被攻击波及消灭时释放载荷，伤害附近的塔。',
      detail: '重点威胁，消灭可获较多情报。用沙箱或旧链路显形后再集中火力，比范围攻击硬清更安全。'
    },
    ransomware: {
      id: 'ransomware', name: '勒索者', glyph: '⨂', color: '#ff3b6b', hp: 96, speed: 1.08, dmg: 12, block: 1,
      rewardC: 15, rewardI: 5, coreDmg: 6, ranged: true, range: 3.2, encrypt: true, rate: 0.7,
      desc: '边移动边从远处攻击射程内的塔（包括平台上的塔），造成伤害并施加加密；会优先攻击射程内的蜜罐。',
      detail: '加密使塔暂时停止攻击、治疗与释放技能，但不解除阻挡或节点隔离。用修复进程的「冗余切换」或备份还原解除。'
    },
    hotspot: {
      id: 'hotspot', name: '伪热点', glyph: '✦', color: '#ffd23b', hp: 58, speed: 1.75, dmg: 0, block: 0,
      rewardC: 11, rewardI: 3, coreDmg: 5, flying: true,
      desc: '沿无线层从入口直飞出口，不受地面道路和阻挡影响，由拦截器对付。',
      detail: '无视改道与阻挡，必须靠能攻击飞行单位的拦截器（及沙箱范围）拦截。'
    },
    packer: {
      id: 'packer', name: '加壳器', glyph: '⬢', color: '#b06bff', hp: 120, speed: 1.0, dmg: 6, block: 1,
      rewardC: 19, rewardI: 7, coreDmg: 7, shieldAura: 55, auraRange: 2.4,
      desc: '为附近同伴提供可被打破的护盾，保护成群敌人推进，迫使玩家考虑先处理支援者还是集中攻击前排。',
      detail: '护盾会吸收伤害。优先击杀加壳器或将其引出队列，能显著提高清群效率。'
    }
  };

  // ---------------- Boss ----------------
  var BOSSES = {
    wankui: {
      id: 'wankui', name: '万傀', glyph: '⟁', color: '#ff3b3b', hp: 780, speed: 0.62, dmg: 30, block: 4,
      rewardC: 120, rewardI: 40, coreDmg: 26, mapId: 'intranet',
      phases: [{ at: 1.0, name: '洪峰' }, { at: 0.5, name: '傀群' }],
      desc: '僵尸网络群体控制。「洪峰」冲击被隔离节点，重创塔并冲毁隔离器；生命降低后释放成群蠕虫，增加节点与阻挡塔的压力。',
      detail: '第 14 波。登场与换阶段前会预警冲击位置。'
    },
    mirage: {
      id: 'mirage', name: '蜃楼', glyph: '◈', color: '#b04fff', hp: 880, speed: 0.66, dmg: 24, block: 4,
      rewardC: 130, rewardI: 45, coreDmg: 26, mapId: 'backbone',
      phases: [{ at: 1.0, name: '伪路由' }, { at: 0.5, name: '路由风暴' }],
      desc: '路由欺骗。「伪路由」在前方链路制造临时路由黑洞，截断通行、迫使各入口改道；生命降低后发动「路由风暴」，削弱附近塔的护盾。',
      detail: '第 15 波。黑洞位置会避开会封死入口的格子，出现前有明显预警。'
    },
    zheying: {
      id: 'zheying', name: '蛰影', glyph: '⬣', color: '#ff2060', hp: 980, speed: 0.6, dmg: 34, block: 5,
      rewardC: 160, rewardI: 60, coreDmg: 30, mapId: 'airgap',
      phases: [{ at: 1.0, name: '潜伏' }, { at: 0.66, name: '提权' }, { at: 0.33, name: '破坏' }],
      desc: '攻击组织核心威胁，按「潜伏—提权—破坏」改变阶段：潜伏时需检测才能被远程单体攻击选中；提权后强化护甲并放出木马；破坏阶段锁死前方一段运维环、改变道路。',
      detail: '第 16 波。潜伏阶段用沙箱显形，破坏阶段前会预警将被锁死的路段。'
    }
  };

  // ---------------- 道具 ----------------
  var ITEMS = {
    isolator: {
      id: 'isolator', name: '应急隔离器', glyph: '⊘', color: '#8fe3ff', res: 'intel', cost: 22, cd: 26, dur: 13,
      place: 'node', hp: 90, radius: 0,
      desc: '临时隔离一个直通节点，有耐久和有效期，会被敌人冲毁，不产生情报。',
      detail: '情报道具。用于快速试探改道或应急封路，失效或被冲毁后节点恢复直通。'
    },
    downgrade: {
      id: 'downgrade', name: '协议降级', glyph: '⇊', color: '#ffd27f', res: 'intel', cost: 18, cd: 24, dur: 11,
      place: 'link', radius: 1.6,
      desc: '让一片链路暂时使用旧协议，产生旧链路的减速和显形效果，敌人的路线随通行速度变化重新选择。',
      detail: '情报道具。可改变局部通行速度、迫使敌人重新寻路，并让经过的木马显形。'
    },
    restore: {
      id: 'restore', name: '备份还原', glyph: '⟳', color: '#7dff9b', res: 'compute', cost: 55, cd: 22, dur: 0,
      place: 'tower', radius: 0,
      desc: '恢复一座塔的部分生命并解除加密。',
      detail: '算力道具。用于抢救关键隔离点或恢复被加密的火力。'
    }
  };

  // ---------------- 说明文案 ----------------
  var STATUS_INFO = [
    { name: '检测 / 显形', color: '#c08bff', text: '沙箱检测、旧链路或阻挡会使伪装的木马、潜伏的蛰影显形。显形前不能被远程单体攻击主动选中。' },
    { name: '护盾', color: '#6fe8ff', text: '吸收伤害。加壳器为同伴提供可被打破的护盾，修复进程「冗余切换」为友塔提供护盾；蜃楼「路由风暴」会削弱护盾。' },
    { name: '加密', color: '#b06bff', text: '勒索者施加。塔暂时停止攻击、治疗与释放技能，但不解除阻挡或节点隔离。由「冗余切换」或「备份还原」解除。' },
    { name: '阻挡', color: '#4fd0ff', text: '使敌人停下交战，不改变道路的通行状态。塔优先攻击沿路线离出口最近的有效目标。' },
    { name: '隔离 / 旁路直通', color: '#8fe3ff', text: '节点被隔离后这一格不能通行；节点上的塔被摧毁或撤下、隔离器失效后设备旁路直通，道路重新打开，各入口路线同步收敛。' },
    { name: '旧链路', color: '#ffb14f', text: '经过的地面敌人减速，木马显形。敌人选择路线时也会考虑其较慢的通行速度。' }
  ];
  var TERRAIN_INFO = [
    { name: '链路', color: '#1b4a63', text: '恶意程序与业务流量经过的道路。防火墙与蜜罐可部署在链路上，阻挡敌人但不截断道路。' },
    { name: '设备平台', color: '#0d3346', text: '部署远程、检测与修复支援塔的位置，与链路有高低区别，敌人不能通行。' },
    { name: '障碍 / 公网流 / 气隙', color: '#9fb6c8', text: '数据设施、公网流与气隙，不能通行，也不能部署。' },
    { name: '交换节点', color: '#39d0e6', text: '链路交汇处的网络设备。部署防火墙、网闸或插入应急隔离器会隔离节点；解除隔离后恢复直通。' },
    { name: '旧链路', color: '#7a5a2a', text: '保留旧协议的道路，减速并显形，敌人路线会考虑其较慢的通行速度。' }
  ];
  var SYSTEM_INFO = [
    { name: '算力', text: '随游戏进程增长、消灭敌人回收，用于部署塔与「备份还原」。撤下塔退还部分算力，塔被摧毁不退款。' },
    { name: '情报', text: '通过波次、消灭重点威胁和在交战中持续守住隔离节点获得，用于隔离节点、选择升级分支与情报道具。与算力不能互换。' },
    { name: '路线收敛', text: '通行或通行速度变化时，各入口的路线同步更新，场上受地形约束的敌人从当前位置重新寻路；任何变化都不能让入口或地面敌人无路可走。' },
    { name: '再次隔离间隔', text: '节点恢复直通后有短暂的再次隔离间隔，配合隔离消耗、撤下返还与敌人攻塔的威胁，约束反复改道。' },
    { name: '中枢完整度', text: '敌人进入出口时下降，归零即失败；撑过全部波次即胜利。' }
  ];

  // ---------------- 波次生成 ----------------
  // 逐步引入敌人；骨干/气隙各有一波三入口洪峰；最后一波 Boss
  var INTRO = {
    intranet: ['worm', 'trojan', 'ransomware', 'flood', 'hotspot', 'packer'],
    backbone: ['worm', 'ransomware', 'trojan', 'flood', 'packer', 'hotspot'],
    airgap: ['worm', 'flood', 'trojan', 'ransomware', 'packer', 'hotspot']
  };
  var FLOOD_WAVE = { backbone: 9, airgap: 10 };
  var BOSS_OF = { intranet: 'wankui', backbone: 'mirage', airgap: 'zheying' };

  function genWaves(mapId) {
    var total = mapId === 'intranet' ? 14 : mapId === 'backbone' ? 15 : 16;
    var intro = INTRO[mapId], entries = mapId === 'intranet' ? ['A', 'B'] : ['A', 'C', 'B'];
    var waves = [];
    for (var w = 1; w <= total; w++) {
      var isBoss = w === total, isFlood = w === FLOOD_WAVE[mapId];
      var pool = intro.slice(0, Math.min(intro.length, 1 + Math.floor((w - 1) / 2)));
      if (w >= 5 && intro.indexOf('hotspot') >= 0 && pool.indexOf('hotspot') < 0) pool.push('hotspot');
      var groups = [], base = 2 + Math.floor(w * 0.55);
      if (isBoss) {
        groups.push({ entry: entries[1], type: BOSS_OF[mapId], count: 1, gap: 0, boss: true });
        groups.push({ entry: entries[0], type: 'worm', count: 6, gap: 1.1 });
        groups.push({ entry: entries[entries.length - 1], type: 'packer', count: 2, gap: 2 });
      } else if (isFlood) {
        for (var e = 0; e < entries.length; e++) {
          groups.push({ entry: entries[e], type: pool[(e + w) % pool.length], count: base + 1, gap: 0.82 });
          groups.push({ entry: entries[e], type: 'flood', count: 1, gap: 2.6 });
        }
      } else {
        var useEntries = w <= 2 ? [entries[0]] : (w <= 4 ? entries.slice(0, 2) : entries);
        for (var g = 0; g < useEntries.length; g++) {
          var t = pool[(g + w) % pool.length];
          groups.push({ entry: useEntries[g], type: t, count: Math.max(2, Math.floor(base / useEntries.length) + (g % 2)), gap: Math.max(0.55, 1.15 - w * 0.03) });
          if (w >= 4 && g === 0) groups.push({ entry: useEntries[g], type: pool[0], count: 2, gap: 0.9 });
        }
      }
      waves.push({
        n: w, groups: groups, flood: isFlood, boss: isBoss,
        rewardIntel: 8 + w * 2, computeBonus: 18 + w * 2,
        hint: isBoss ? '检测到高危核心威胁逼近' : (isFlood ? '三入口洪峰预警' : (w === 1 ? '检测到异常流量' : '威胁组合升级'))
      });
    }
    return waves;
  }

  TD.Data = {
    DT: DT, COLORS: COLORS,
    TOWERS: TOWERS, ENEMIES: ENEMIES, BOSSES: BOSSES, ITEMS: ITEMS,
    STATUS_INFO: STATUS_INFO, TERRAIN_INFO: TERRAIN_INFO, SYSTEM_INFO: SYSTEM_INFO,
    towerList: function () { return Object.keys(TOWERS).map(function (k) { return TOWERS[k]; }); },
    enemyList: function () { return Object.keys(ENEMIES).map(function (k) { return ENEMIES[k]; }); },
    itemList: function () { return Object.keys(ITEMS).map(function (k) { return ITEMS[k]; }); },
    waves: function (mapId) { return genWaves(mapId); },
    bossOf: function (mapId) { return BOSSES[BOSS_OF[mapId]]; },
    // 生成带 tick 的出场计划（确定性）
    buildWavePlan: function (waves, entries, DT) {
      var plan = [], t = 0, prep = 6;
      for (var i = 0; i < waves.length; i++) {
        var w = waves[i]; t += (i === 0 ? prep : 7.5);
        var waveStart = t;
        for (var g = 0; g < w.groups.length; g++) {
          var gr = w.groups[g];
          for (var c = 0; c < gr.count; c++) {
            plan.push({ tick: Math.round(t / DT), type: gr.type, entry: gr.entry, boss: !!gr.boss, wave: w.n });
            t += gr.gap;
          }
        }
        plan.push({ tick: Math.round((t + 0.4) / DT), waveEnd: w.n, rewardIntel: w.rewardIntel, computeBonus: w.computeBonus });
      }
      return { plan: plan, endTick: Math.round((t + 10) / DT), waveStarts: null };
    }
  };
})();
