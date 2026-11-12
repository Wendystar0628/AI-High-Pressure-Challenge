// 攻城略地回放的数据与时间线：读一局逐回合日志（siege-replay-v1），整理每回合的局面、部队、到达结算，
// 认出三类高光，按节奏参数排出整段回放的时间线。不画图，浏览器和 Node 都能用；画面在 player.js。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SiegePlan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 节奏：整段回放的快慢只由这几个数决定（秒） ----------
  var PACE = {
    turn: 0.085,     // 平常回合（没有易主、没有双方交战）每回合的秒数
    busy: 1.8,       // 有易主或双方交战的回合，是平常回合的几倍
    flowMax: 18,     // 高光以外的回合合计最多几秒；超出时这些回合按同一比例压快
    slow: 0.6,       // 高光回合（慢放）每回合的秒数
    ramp: 3,         // 高光前后各用几个回合从常速渐变到慢放、再渐变回来
    hold: 1.4,       // 高光结算后定格读字的秒数（截胡在先占下的那一刻另停 0.35 倍）
    highlights: 4,   // 一局最多点出几个高光
    gap: 8,          // 两个高光至少相隔几个回合（不小于 2×ramp+1，慢放窗口才不重叠）
    intro: 1.2,      // 开场：节点和面板出场
    outro: 3.2       // 结尾：结果停留
  };

  // ---------- 高光判定 ----------
  var DETECT = {
    snipeWithin: 3,    // 截胡：中立节点被一方占下后，对方在这么多回合内到达并夺走
    snipeMin: 10,      // 截胡：先占的一方为占下这个中立点至少投入的兵力
    clashMin: 30,      // 大对撞：双方在同一节点同回合投入的兵力（节点守军加到达部队）都不少于这个数
    clashShare: 0.06,  // 大对撞：且都不少于此时双方平均总兵力的这个比例
    leadMin: 8,        // 领先易主：新领先方至少领先这么多兵
    leadShare: 0.03    // 领先易主：且至少领先双方总兵力之和的这个比例（平手附近来回不算）
  };

  // 一回合里的分段（回合时长的比例）：部队全程匀速；要到达的部队在 ARRIVE 处到达，之后是交战和易主
  var ARRIVE = 0.68;

  var SIDE = ['中立', '甲方', '乙方'];
  var FAILURE = {
    three_cpu_timeouts: '连续 3 回合 CPU 超时', cpu_timeout: 'CPU 超时', wall_timeout: '单回合超过 5 秒没交命令',
    process_exit: '程序退出', memory_limit: '内存超限', protocol_error: '通信出错'
  };

  // 路程：d² ≥ dx² + dy² 的最小非负整数（整数运算，和裁判一致）
  function route(a, b) {
    var q = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y), d = Math.floor(Math.sqrt(q));
    while (d * d < q) d++;
    while (d > 0 && (d - 1) * (d - 1) >= q) d--;
    return d;
  }

  // ---------- 读日志：jsonl 文本或已解析的行数组 ----------
  function parse(src) {
    var rows = [];
    if (Array.isArray(src)) rows = src.slice();
    else {
      var lines = String(src).replace(/^﻿/, '').split(/\r?\n/), last = -1;
      for (var k = lines.length - 1; k >= 0; k--) if (lines[k].trim()) { last = k; break; }
      for (var i = 0; i <= last; i++) {
        var s = lines[i].trim();
        if (!s) continue;
        try { rows.push(JSON.parse(s)); }
        catch (e) { if (i === last) break; throw new Error('第 ' + (i + 1) + ' 行不是完整的 JSON'); }   // 中断的日志最后一行可能不完整，丢掉
      }
    }
    var header = rows[0];
    if (!header || header.type !== 'header') throw new Error('第一行不是 header');
    if (header.schema !== 'siege-replay-v1') throw new Error('日志版本是 ' + header.schema + '，播放器只认 siege-replay-v1');
    return { header: header, turns: rows.filter(function (r) { return r.type === 'turn'; }), result: rows.filter(function (r) { return r.type === 'result'; })[0] || null };
  }

  function tally(state) {
    var t = { troops: [0, 0, 0], nodes: [0, 0, 0], growth: [0, 0, 0], fleets: [0, 0, 0] };
    state.nodes.forEach(function (n) { t.troops[n.owner] += n.troops; t.nodes[n.owner]++; t.growth[n.owner] += n.growth; });
    state.fleets.forEach(function (f) { t.troops[f.owner] += f.troops; t.fleets[f.owner] += f.troops; });
    return t;
  }

  // ---------- 整理一局 ----------
  function build(src, opts) {
    opts = opts || {};
    var L = parse(src), h = L.header, init = h.initial_state, N = init.nodes.length;
    var nodes = init.nodes.map(function (n, i) { return { id: i, x: n.x, y: n.y, growth: n.growth }; });
    var dist = nodes.map(function (a) { return nodes.map(function (b) { return route(a, b); }); });
    var fleetInfo = {}, turns = [], before = init, stats = [tally(init)];

    L.turns.forEach(function (r, i) {
      var after = r.state, deps = r.departures || [], arrs = r.arrivals || [];
      deps.forEach(function (f) { fleetInfo[f.id] = { d: f.turns_left, t0: r.turn }; });
      // 这一回合里画的部队：回合开始时在途的，加本回合出发的；p0/p1 是回合开始/结束时走过的路程比例
      var fleets = [];
      before.fleets.concat(r.settled ? deps : []).forEach(function (f) {
        var d = (fleetInfo[f.id] && fleetInfo[f.id].d) || dist[f.from][f.to] || 1, k = f.turns_left;
        fleets.push({ id: f.id, owner: f.owner, troops: f.troops, from: f.from, to: f.to, d: d,
          p0: (d - k) / d, p1: r.settled ? (d - k + 1) / d : (d - k) / d, arrive: r.settled && k === 1, fresh: k === d && deps.indexOf(f) >= 0 });
      });
      // 每个节点：开头兵力、出发扣兵、增长、到达结算
      var sent = new Array(N).fill(0), grow = new Array(N).fill(0), arrival = new Array(N).fill(null);
      deps.forEach(function (f) { sent[f.from] += f.troops; });
      (r.growth || []).forEach(function (g) { grow[g.node] += g.troops_added; });
      var captures = [], clashes = [];
      arrs.forEach(function (a) {
        var att = [0, 0, 0];
        a.fleets.forEach(function (f) { att[f.owner] += f.troops; });
        var ev = { node: a.node, oldOwner: a.old_owner, oldTroops: a.old_troops, sums: a.sums, owner: a.owner, troops: a.troops, tie: a.tie, arriving: att,
          capture: a.owner !== a.old_owner, clash: a.sums[1] > 0 && a.sums[2] > 0 };
        arrival[a.node] = ev;
        if (ev.capture) captures.push(ev);
        if (ev.clash) clashes.push(ev);
      });
      var timeout = (r.players || []).map(function (p) { return p.discard_all === 'cpu_timeout'; });
      var st = tally(after);
      stats.push(st);
      turns.push({ i: i, turn: r.turn, settled: !!r.settled, before: before, after: after, fleets: fleets, sent: sent, grow: grow, arrival: arrival,
        captures: captures, clashes: clashes, busy: captures.length > 0 || clashes.length > 0, timeout: timeout, players: r.players || [] });
      before = after;
    });

    var game = { header: h, result: L.result, nodes: nodes, dist: dist, turns: turns, stats: stats, N: N,
      maxTurns: (h.rules && h.rules.max_turns) || init.max_turns || 200,
      labels: h.players.map(function (p) { return p.label; }), names: (opts.names || []).slice(0, 2), title: opts.title || '' };
    game.names = [0, 1].map(function (k) { return game.names[k] || game.labels[k] || SIDE[k + 1]; });
    game.ending = ending(game);
    game.candidates = detect(game);
    game.highlights = select(game.candidates, game);
    game.timeline = schedule(game, opts.pace || PACE);
    return game;
  }

  // ---------- 结局 ----------
  function ending(g) {
    var r = g.result, last = g.stats[g.stats.length - 1];
    if (!r) return { winner: 0, reason: 'unfinished', title: '日志未完', line: '没有结果行，只播放已有的 ' + g.turns.length + ' 个回合', totals: [last.troops[1], last.troops[2]] };
    var who = r.winner === 3 ? '平局' : SIDE[r.winner] + '胜', line;
    if (r.reason === 'elimination') line = (r.winner === 3 ? '双方同时被消灭' : '消灭' + SIDE[3 - r.winner]) + ' · 第 ' + r.turns + ' 回合';
    else if (r.reason === 'turn_limit') line = r.turns + ' 回合打满，比总兵力';
    else {
      var why = (r.forfeits || []).map(function (f, k) { return f ? SIDE[k + 1] + '判负：' + (FAILURE[f] || f) : null; }).filter(Boolean);
      line = (why.join('；') || '判负') + (r.failure_turn ? ' · 第 ' + r.failure_turn + ' 回合' : '');
    }
    return { winner: r.winner, reason: r.reason, title: who, line: line, totals: r.totals || [last.troops[1], last.troops[2]] };
  }

  // ---------- 高光候选 ----------
  // 每个候选：type、turn（结算这一刻的回合下标）、from（慢放起点回合下标）、node（地图焦点，领先易主为 null）、score（同类和跨类比较用，约 0–1）
  function detect(g) {
    var out = [], last = {};
    g.turns.forEach(function (T, i) {
      var s0 = g.stats[i], avg = Math.max(1, (s0.troops[1] + s0.troops[2]) / 2);
      T.arrival.forEach(function (a) {
        if (!a) return;
        // 截胡：上一次易主是 0→A（中立被 A 占下），snipeWithin 回合内 A→B
        var prev = last[a.node];
        if (a.capture && a.oldOwner > 0 && a.owner === 3 - a.oldOwner && prev && prev.from === 0 && prev.to === a.oldOwner &&
            T.turn - prev.turn <= DETECT.snipeWithin && prev.invest >= DETECT.snipeMin) {
          var A = a.oldOwner, B = a.owner, dt = T.turn - prev.turn;
          out.push({ type: 'snipe', turn: i, from: prev.i, node: a.node, side: B, victim: A, dt: dt, invest: prev.invest, force: a.sums[B], left: a.troops,
            score: Math.min(1.2, prev.invest / avg) * (dt === 1 ? 1.25 : 1) + 0.15 });
        }
        if (a.capture) last[a.node] = { i: i, turn: T.turn, from: a.oldOwner, to: a.owner, invest: a.sums[a.owner] };
        // 大对撞：双方兵力都大
        var m = Math.min(a.sums[1], a.sums[2]);
        if (a.clash && m >= Math.max(DETECT.clashMin, DETECT.clashShare * avg)) {
          out.push({ type: 'clash', turn: i, from: i, node: a.node, side: a.owner, sums: [a.sums[1], a.sums[2]], left: a.troops, tie: a.tie, capture: a.capture,
            score: Math.min(1.5, m / avg) * (a.arriving[1] > 0 && a.arriving[2] > 0 ? 1.2 : 1) });
        }
      });
    });
    // 领先易主：总兵力（节点加在途）领先的一方换人。领先幅度要过门槛才算“确立”；易主记在新领先方开始领先的那个回合
    var held = 0, since = 0;
    for (var k = 1; k < g.stats.length; k++) {
      var t1 = g.stats[k].troops[1], t2 = g.stats[k].troops[2], diff = t1 - t2, sign = diff > 0 ? 1 : diff < 0 ? 2 : 0;
      var prevSign = (function () { var p = g.stats[k - 1].troops; return p[1] > p[2] ? 1 : p[2] > p[1] ? 2 : 0; })();
      if (sign !== prevSign) since = k;                       // 本回合起是现在的领先方（或平）
      var margin = Math.max(DETECT.leadMin, DETECT.leadShare * (t1 + t2));
      if (sign && Math.abs(diff) >= margin && sign !== held) {
        if (held) {
          var at = since - 1;                                  // stats[k] 是第 k 个回合（下标 k-1）结算后的局面
          var sa = g.stats[since].troops;
          out.push({ type: 'lead', turn: at, from: at, node: null, side: sign, totals: [sa[1], sa[2]], score: 0.9 });
        }
        held = sign;
      }
    }
    return out.sort(function (a, b) { return a.turn - b.turn || b.score - a.score; });
  }

  // ---------- 挑高光：先保证每类最好的一个，再按分数补满；彼此相隔至少 gap 回合 ----------
  function select(cands, g) {
    var P = PACE, picked = [];
    var free = function (c) {
      return picked.every(function (p) { return Math.min(Math.abs(c.turn - p.turn), Math.abs(c.from - p.turn), Math.abs(c.turn - p.from)) >= P.gap; }) &&
        g.turns.length - 1 - c.turn >= 2;   // 太靠近终局的留给结尾
    };
    var byScore = cands.slice().sort(function (a, b) { return b.score - a.score || a.turn - b.turn; });
    var heads = ['lead', 'clash', 'snipe'].map(function (type) { return byScore.filter(function (c) { return c.type === type; })[0]; }).filter(Boolean);
    heads.sort(function (a, b) { return b.score - a.score; }).forEach(function (c) { if (picked.length < P.highlights && free(c)) picked.push(c); });
    byScore.forEach(function (c) { if (picked.length < P.highlights && picked.indexOf(c) < 0 && free(c)) picked.push(c); });
    picked.sort(function (a, b) { return a.turn - b.turn; });
    picked.forEach(function (c, k) {
      c.k = k;
      // 同一回合同类、规模相当的（对称地图上常成对出现）一起圈出来，各自标字
      c.group = [c];
      if (c.node != null) cands.forEach(function (o) {
        if (o !== c && o.type === c.type && o.turn === c.turn && o.node != null && o.score >= 0.8 * c.score &&
            c.group.every(function (x) { return x.node !== o.node; })) c.group.push(o);
      });
      c.group.forEach(function (o) { o.text = describe(o, g); });
      c.nodes = c.group.map(function (o) { return o.node; }).filter(function (x) { return x != null; });
    });
    return picked;
  }

  function describe(c, g) {
    var S = SIDE;
    if (c.type === 'snipe') return { tag: '截胡', line: S[c.victim] + '用 ' + c.invest + ' 兵刚占下，' + S[c.side] + (c.dt === 1 ? '下一回合' : ' ' + c.dt + ' 回合后') + '夺走',
      short: S[c.side] + '截胡', pre: S[c.victim] + '占下' };
    if (c.type === 'clash') return { tag: '大对撞', line: '甲 ' + c.sums[0] + ' : ' + c.sums[1] + ' 乙 · ' + (c.tie ? '同归于尽' : (c.capture ? S[c.side] + '夺下' : S[c.side] + '守住') + '，剩 ' + c.left),
      short: '大对撞' };
    return { tag: '领先易主', line: S[c.side] + '总兵力反超 ' + (c.side === 1 ? c.totals[0] + ' : ' + c.totals[1] : c.totals[1] + ' : ' + c.totals[0]), short: S[c.side] + '反超' };
  }

  // ---------- 时间线 ----------
  // 段：intro、turn（第 i 回合，u 0→1）、hold（停在第 i 回合末）、outro。每个回合的时长 dur[i]，高光回合慢放，前后 ramp 回合按几何插值渐变。
  function schedule(g, P) {
    var n = g.turns.length, base = [], dur = [], i;
    for (i = 0; i < n; i++) base.push(P.turn * (g.turns[i].busy ? P.busy : 1) * (g.turns[i].settled ? 1 : 0.5));
    var sm = base.map(function (b, k) { return (base[Math.max(0, k - 1)] + 2 * b + base[Math.min(n - 1, k + 1)]) / 4; });   // 相邻回合抹平，不忽快忽慢
    var sum = sm.reduce(function (s, x) { return s + x; }, 0), scale = sum > P.flowMax ? P.flowMax / sum : 1;
    for (i = 0; i < n; i++) dur.push(sm[i] * scale);
    // 慢放窗口：各高光的 [from, turn]；终局是消灭时，最后两回合也慢放（不写字，结果卡接上）
    var windows = g.highlights.map(function (c) { return [c.from, c.turn]; });
    if (g.result && g.result.reason === 'elimination' && n > 0) windows.push([Math.max(0, n - 2), n - 1]);
    var slowAt = new Array(n).fill(0);
    windows.forEach(function (w) {
      for (var k = w[0] - P.ramp; k <= w[1] + P.ramp; k++) {
        if (k < 0 || k >= n) continue;
        var off = k < w[0] ? w[0] - k : k > w[1] ? k - w[1] : 0, f = 1 - off / (P.ramp + 1);
        slowAt[k] = Math.max(slowAt[k], f);
      }
    });
    for (i = 0; i < n; i++) if (slowAt[i] > 0 && P.slow > dur[i]) dur[i] = Math.exp(Math.log(dur[i]) * (1 - slowAt[i]) + Math.log(P.slow) * slowAt[i]);

    // 定格：高光结算后 hold；截胡在先占下的回合末另停一小段
    var holdAfter = new Array(n).fill(0);
    g.highlights.forEach(function (c) {
      holdAfter[c.turn] += P.hold;
      if (c.type === 'snipe' && c.from < c.turn) holdAfter[c.from] += P.hold * 0.35;
    });

    var segs = [], t = 0;
    segs.push({ kind: 'intro', i: -1, t0: 0, t1: P.intro }); t = P.intro;
    var start = [], end = [];
    for (i = 0; i < n; i++) {
      start.push(t); segs.push({ kind: 'turn', i: i, t0: t, t1: t + dur[i] }); t += dur[i]; end.push(t);
      if (holdAfter[i] > 0) { segs.push({ kind: 'hold', i: i, t0: t, t1: t + holdAfter[i] }); t += holdAfter[i]; }
    }
    var outroAt = t;
    segs.push({ kind: 'outro', i: n - 1, t0: t, t1: t + P.outro }); t += P.outro;
    return { segs: segs, dur: dur, start: start, end: end, holdAfter: holdAfter, outroAt: outroAt, seconds: t, flowScale: scale, pace: P,
      // 第 i 回合的到达（交战、易主）从这一刻开始
      arriveAt: function (k) { return start[k] + ARRIVE * dur[k]; } };
  }

  // t → { kind, i, u }：intro 时 i=-1；hold、outro 时 u=1
  function locate(tl, t) {
    var s = tl.segs, lo = 0, hi = s.length - 1;
    if (t <= 0) return { kind: 'intro', i: -1, u: 0, lt: 0, seg: s[0] };
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (s[m].t0 <= t) lo = m; else hi = m - 1; }
    var g = s[lo], lt = Math.min(t, g.t1) - g.t0;
    if (g.kind === 'turn') return { kind: 'turn', i: g.i, u: Math.min(1, lt / (g.t1 - g.t0)), lt: lt, seg: g };
    return { kind: g.kind, i: g.i, u: g.kind === 'intro' ? 0 : 1, lt: lt, seg: g };
  }

  return { PACE: PACE, DETECT: DETECT, ARRIVE: ARRIVE, SIDE: SIDE, FAILURE: FAILURE, parse: parse, build: build, locate: locate, route: route };
});
