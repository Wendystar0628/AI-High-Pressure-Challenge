'use strict';
const U = require('./util');
const SCENE = require('./scene');
const { VFS } = require('./vfs');

// ---------------- 电子表格 ----------------
function colToNum(c) { let n = 0; for (const ch of String(c).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function numToCol(n) { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
function parseAddr(a) { const m = /^([A-Z]+)([0-9]+)$/.exec(String(a).toUpperCase()); return m ? { c: colToNum(m[1]), r: parseInt(m[2], 10) } : null; }
function addrOf(c, r) { return numToCol(c) + r; }
function rangeAddrs(range) {
  const parts = String(range).toUpperCase().split(':');
  const a = parseAddr(parts[0]); if (!a) return [];
  const b = parseAddr(parts[1] || parts[0]) || a;
  const out = [];
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++)
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) out.push(addrOf(c, r));
  return out;
}

class SheetDoc {
  constructor(name, data) {
    this.name = name || '未命名工作簿';
    this.cols = data.cols || 10; this.rows = data.rows || 24;
    this.cells = {}; this.values = {};
    for (const k in (data.cells || {})) this.cells[k] = Object.assign({ v: '', f: null, style: {} }, data.cells[k]);
    this.version = data.version || 1; this.dirty = false;
    this.undo = []; this.redo = []; this.path = null;
    this.recalc();
  }
  serialize() { return JSON.stringify({ cols: this.cols, rows: this.rows, cells: this.cells, version: this.version, name: this.name }); }
  cell(a) { return this.cells[a] || null; }
  raw(a) { const c = this.cells[a]; return c ? c.v : ''; }
  refs(formula) {
    const out = [];
    const re = /([A-Z]{1,3}[0-9]{1,4})(?::([A-Z]{1,3}[0-9]{1,4}))?/g;
    let m;
    while ((m = re.exec(formula))) out.push(m[2] ? m[1] + ':' + m[2] : m[1]);
    return out;
  }
  recalc() {
    this.values = {};
    const visiting = new Set();
    const self = this;
    function evalCell(a) {
      if (self.values[a] !== undefined) return self.values[a];
      if (visiting.has(a)) return '#CYCLE!';
      visiting.add(a);
      const c = self.cells[a];
      let v = c ? c.v : '';
      if (c && c.f && typeof c.f === 'string' && c.f[0] === '=') {
        try { v = evalFormula(c.f.slice(1), x => evalCell(x), self); }
        catch (e) { v = e.err || '#ERR!'; }
      }
      visiting.delete(a);
      self.values[a] = v;
      return v;
    }
    for (const a in this.cells) evalCell(a);
    // 未存储的引用单元格也计算一遍
    for (const a in this.cells) if (this.cells[a].f) for (const ref of this.refs(this.cells[a].f)) for (const x of rangeAddrs(ref)) evalCell(x);
    this.version++;
    return this;
  }
  snapshot() { return JSON.parse(JSON.stringify(this.cells)); }
  restore(cells) { this.cells = JSON.parse(JSON.stringify(cells)); this.recalc(); }
}

function evalFormula(expr, get, doc) {
  const tk = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      tk.push({ t: 'num', v: Number(expr.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i; while (j < expr.length && /[A-Za-z0-9:]/.test(expr[j])) j++;
      tk.push({ t: 'id', v: expr.slice(i, j).toUpperCase() }); i = j; continue;
    }
    if ('+-*/(),'.includes(c)) { tk.push({ t: c, v: c }); i++; continue; }
    throw { err: '#ERR!' };
  }
  let p = 0;
  const peek = () => tk[p];
  function numv(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v[0] === '#') throw { err: v };
    const n = Number(v); return Number.isFinite(n) ? n : 0;
  }
  function factor() {
    const t = peek(); if (!t) throw { err: '#ERR!' };
    if (t.t === 'num') { p++; return t.v; }
    if (t.t === '-') { p++; return -numv(factor()); }
    if (t.t === '(') { p++; const v = expression(); if (peek() && peek().t === ')') p++; return v; }
    if (t.t === 'id') {
      p++;
      if (peek() && peek().t === '(') {
        p++; const arg = tk[p]; p++; if (peek() && peek().t === ')') p++;
        if (t.v !== 'SUM' || !arg || arg.t !== 'id') throw { err: '#NAME?' };
        let sum = 0;
        for (const a of rangeAddrs(arg.v)) { const v = get(a); if (typeof v === 'number') sum += v; }
        return sum;
      }
      if (t.v.includes(':')) throw { err: '#REF!' };
      const v = get(t.v);
      if (typeof v === 'string' && v[0] === '#') throw { err: v };
      return v;
    }
    throw { err: '#ERR!' };
  }
  function term() {
    let v = numv(factor());
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = tk[p++].t; const b = numv(factor());
      if (op === '/' && b === 0) throw { err: '#DIV/0!' };
      v = op === '*' ? v * b : v / b;
    }
    return v;
  }
  function expression() {
    let v = numv(term());
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = tk[p++].t; const b = numv(term());
      v = op === '+' ? v + b : v - b;
    }
    return v;
  }
  const r = expression();
  if (typeof r === 'number' && !Number.isFinite(r)) return '#DIV/0!';
  return r;
}

class Runtime {
  constructor(engine) { this.engine = engine; this.docs = {}; this.sceneCache = {}; }

  defaultSheet() { return SCENE.defaultSheetRaw(); }
  charge(sys, work) { this.engine.budget.take(Math.max(1, Math.ceil(work))); }

  // ---------------- 应用状态初始化 ----------------
  initAppState(sys, appType, win, opts) {
    const base = { appType, winId: win.id, display: null };
    switch (appType) {
      case 'files': return Object.assign(base, { cwd: (opts.data && opts.data.cwd) || '/Documents', selected: [], clipboard: null,
        nav: ['/', '/Documents', '/Demo', '/Programs', '/System', '/Recycle Bin', '/Snapshots'], showOverwrite: null });
      case 'spreadsheet': {
        const docPath = (opts.data && opts.data.docPath) || '/Demo/sample.sheet';
        const doc = this.openDoc(sys, docPath);
        return Object.assign(base, { docPath, selection: 'A1', range: 'A1', formula: '', dirty: doc ? doc.dirty : false,
          prompt: null, editing: null });
      }
      case 'widgets': return Object.assign(base, { tab: 'clock' });
      case 'editor': return Object.assign(base, { filename: (opts.data && opts.data.path) || '/Documents/新建程序.prog',
        content: (opts.data && opts.data.path && sys.fs.read(opts.data.path)) || '', dirty: false, output: [] });
      case 'tasks': return Object.assign(base, { tab: 'processes' });
      case 'settings': return Object.assign(base, {});
      case 'browser': return Object.assign(base, { tabs: [{ id: U.uid('tab'), url: 'about:blank', title: '新标签页', loadState: 'idle', history: [], hi: -1 }], activeTab: null });
      case 'player': return Object.assign(base, {
        scenePath: (opts.data && opts.data.scenePath) || '/Demo/helicopter-24.scene', state: 'paused', position: 0,
        duration: 15, rate: 1, loop: false, cameraMode: 'show', free: { pos: [13, 7, 13], target: [0, 1.5, 0], fov: 48 },
        selection: null, frameTime: 0, mode: 'show', record: null, rehearsal: null, wind: [0.35, 0.1],
        heading: 0, faultAt: 8.6, controllerPath: '/System/controller.prog', showDefault: true });
      case 'charts': return Object.assign(base, {
        sourceTitle: '示例工作簿', range: 'A1:D4', labelCol: 'A', series: ['D'], chartType: 'bar',
        connectionState: 'disconnected', values: null, version: 0, cache: [], selectionLabel: null, hover: null });
      case 'projection': return Object.assign(base, {});
      case 'system': return Object.assign(base, {});
      case 'help': return Object.assign(base, {});
      default: return base;
    }
  }
  onWindowOpen(engine, sys, win, opts) {
    const st = sys.appState[win.id]; if (!st) return;
    if (win.appType === 'player') {
      this.loadScene(sys, st);
      const flightPid = engine.spawnInternal(sys, '/System/programs/player_flight.prog',
        { appId: win.id, kind: 'app', name: '飞行场景进程', fxPid: null }, { name: '飞行场景进程' });
      const fxPid = engine.spawnInternal(sys, '/System/programs/player_fx.prog',
        { appId: win.id, kind: 'app', name: '环境特效进程' }, { name: '环境特效进程' });
      if (flightPid && sys.cpu.procs[flightPid]) sys.cpu.procs[flightPid].args.fxPid = fxPid;
      const req = sys.spawnRequests.find(r => r.args && r.args.appId === win.id);
      if (req) { req.path = '/System/programs/player_driver.prog'; req.args.flightPid = flightPid; req.args.fxPid = fxPid; }
      st.flightPid = flightPid; st.fxPid = fxPid;
    }
    if (win.appType === 'charts') {
      const recvPid = engine.spawnInternal(sys, '/System/programs/chart_receiver.prog',
        { appId: win.id, kind: 'app', name: '图表数据接收进程', chartPid: null }, { name: '图表数据接收进程' });
      const drawPid = engine.spawnInternal(sys, '/System/programs/chart_draw.prog',
        { appId: win.id, kind: 'app', name: '图表绘制进程' }, { name: '图表绘制进程' });
      if (recvPid && sys.cpu.procs[recvPid]) sys.cpu.procs[recvPid].args.chartPid = drawPid;
      st.recvPid = recvPid; st.drawPid = drawPid;
    }
    if (win.appType === 'browser' && st.tabs.length && st.activeTab === null) st.activeTab = st.tabs[0].id;
    if (win.appType === 'editor' && st.content) st.dirty = false;
  }
  onRestart(engine, sys) {
    for (const wid in sys.appState) {
      const st = sys.appState[wid];
      if (st.appType === 'charts') { st.recvPid = null; st.drawPid = null; if (st.connectionState === 'connected') st.connectionState = 'restored'; }
      if (st.appType === 'player') { st.flightPid = null; st.fxPid = null; }
    }
  }
  onReset(engine) { this.docs = {}; this.sceneCache = {}; }
  onSnapshotRestore(engine, sys, win, fork) {
    const st = sys.appState[win.id]; if (!st) return;
    if (st.appType === 'charts') { st.connectionState = 'restored'; st.recvPid = null; st.drawPid = null; }
    if (st.appType === 'player') { st.flightPid = null; st.fxPid = null; }
  }

  // ---------------- 每步推进 ----------------
  onStep(engine) {
    const now = Date.now();
    // 任一层的倒计时到时都在根系统通知中心产生通知（通知中心以根系统为归宿）。
    for (const s of Object.values(engine.systems)) {
      const d = s.desktop;
      if (d.timer && d.timer.running && !d.timer.done) {
        d.timer.remaining = Math.max(0, (d.timer.endsAt - now) / 1000);
        if (d.timer.remaining <= 0) {
          d.timer.running = false; d.timer.done = true; d.timer.remaining = 0;
          engine.notify('倒计时', '倒计时 ' + d.timer.duration + ' 秒已结束', s.id);
          engine.markDirty();
        }
      }
      if (d.stopwatch && d.stopwatch.running) d.stopwatch.elapsed = (now - d.stopwatch.startedAt) / 1000;
    }
    for (const c of engine.connections) if (c.state === 'connected' && c.queue.length) this.deliver(c);
  }

  // ---------------- app_tick ----------------
  tick(sys, winId, ctx) {
    const st = sys.appState[winId]; if (!st) return { value: {}, work: 1 };
    let work = 2;
    const q = sys.appActions[winId] || [];
    sys.appActions[winId] = [];
    for (const item of q) {
      work += 2 + U.jsonSize(item.payload) / 20;
      try { this.handleAction(sys, winId, st, item.action, item.payload || {}, ctx); }
      catch (e) { sys.errors.unshift({ t: sys.virtualTime, pid: winId, msg: String(e.message || e) }); st.lastError = String(e.message || e); }
    }
    if (st.appType === 'player') {
      // 播放位置由所属系统的虚拟时间推进，不依赖本进程被调度的次数。
      if (st.state === 'playing') {
        const anchorT = st.playAnchorTime === undefined ? sys.virtualTime : st.playAnchorTime;
        const anchorP = st.playAnchorPos === undefined ? 0 : st.playAnchorPos;
        st.position = Math.min(st.duration, anchorP + Math.max(0, sys.virtualTime - anchorT) * st.rate);
        if (st.position >= st.duration) {
          if (st.loop) { st.position = 0; st.playAnchorTime = sys.virtualTime; st.playAnchorPos = 0; }
          else st.state = 'paused';
        }
      }
      st.frameTime = st.position;
      return { value: { frameTime: st.frameTime, state: st.state, position: st.position }, work };
    }
    return { value: { ok: 1 }, work };
  }

  handleAction(sys, winId, st, action, p, ctx) {
    switch (st.appType) {
      case 'files': return this.fileAction(sys, winId, st, action, p);
      case 'spreadsheet': return this.sheetAction(sys, winId, st, action, p);
      case 'widgets': return this.widgetAction(sys, winId, st, action, p);
      case 'editor': return this.editorAction(sys, winId, st, action, p);
      case 'tasks': return this.taskAction(sys, winId, st, action, p);
      case 'settings': return this.settingsAction(sys, winId, st, action, p);
      case 'browser': return this.browserAction(sys, winId, st, action, p);
      case 'player': return this.playerAction(sys, winId, st, action, p);
      case 'charts': return this.chartAction(sys, winId, st, action, p);
      case 'projection': return this.projectionAction(sys, winId, st, action, p);
      default: return;
    }
  }

  // ---------------- 系统调用（供子系统程序使用） ----------------
  syscall(sys, proc, name, args, pid) {
    const A = i => args[i];
    const appId = proc && proc.appId ? proc.appId : (sys.cpu.procs[pid] ? sys.cpu.procs[pid].appId : null);
    const st = appId ? sys.appState[appId] : null;
    switch (name) {
      case 'scene_sample': {
        const t = Number(A(0)) || 0;
        if (!st) return { __err: '场景取样失败：无应用状态' };
        const scene = this.getScene(sys, st);
        const frame = SCENE.sampleScene(scene, t, { record: this.recordFor(sys, st), cameraMode: st.cameraMode, free: st.free });
        const out = { type: 'scene', t, pose: frame.pose, camera: frame.camera, appId };
        // 场景状态演化按补算步数与资源规模计费，预算不足时保留到下一逻辑步继续。
        this.charge(sys, 6 + scene.model.parts.length * 0.4 + Math.floor(t * (scene.fps || 30)) * 0.12);
        return { value: out };
      }
      case 'fx_sample': {
        const t = Number(A(0)) || 0; const pose = A(1) || {};
        if (!st) return { __err: '特效取样失败：无应用状态' };
        const scene = this.getScene(sys, st);
        const fx = SCENE.sampleFx(scene, t, pose);
        this.charge(sys, 4 + (fx.dust.length + fx.smoke.length + fx.debris.length) * 0.6);
        return { value: fx };
      }
      case 'sensor': {
        if (!st || !st.rehearsal) return { value: { t: sys.virtualTime, alt: 0.4, vy: 0, pitch: 0, roll: 0, vx: 0, vz: 0 } };
        const rec = st.rehearsal.record;
        const s = SCENE.simulateTo(rec, sys.virtualTime - st.rehearsal.startTime, this.getScene(sys, st));
        return { value: { t: sys.virtualTime, alt: s.y, vy: s.vy, pitch: s.pitch, roll: s.roll, vx: s.vx, vz: s.vz, damage: s.damage } };
      }
      case 'control': {
        if (!st || !st.rehearsal) return { value: 1 };
        const rec = st.rehearsal.record;
        rec.controls.push({ t: Math.max(0, sys.virtualTime - st.rehearsal.startTime), collective: Number(A(0)) || 0, cyclic: Number(A(1)) || 0, pedal: Number(A(2)) || 0 });
        if (rec.controls.length > 2000) rec.controls.shift();
        return { value: 1 };
      }
      case 'get_app': return { value: st ? U.deepClone(st) : {} };
      case 'set_app': { if (st && A(0)) st[String(A(0))] = U.deepClone(A(1)); return { value: 1 }; }
      case 'player_action': { if (st) this.playerAction(sys, appId, st, String(A(0)), A(1) || {}); return { value: 1 }; }
      case 'chart_action': { if (st) this.chartAction(sys, appId, st, String(A(0)), A(1) || {}); return { value: 1 }; }
      default: return { __err: '未知系统调用: ' + name };
    }
  }

  // ---------------- 场景 / 播放器 ----------------
  getScene(sys, st) {
    const key = sys.id + ':' + st.scenePath;
    if (this.sceneCache[key]) return this.sceneCache[key];
    let scene;
    try { scene = JSON.parse(sys.fs.read(st.scenePath)); } catch (e) { scene = null; }
    if (!scene || scene.format !== 'scene/1') scene = SCENE.buildDefaultScene();
    this.sceneCache[key] = scene;
    return scene;
  }
  loadScene(sys, st) {
    const scene = this.getScene(sys, st);
    st.duration = scene.duration || 15;
    st.record = { controls: scene.timeline.controls, inputs: [{ t: 0, type: 'wind', value: [0.35, 0.1] }, { t: scene.timeline.faultAt || 8.6, type: 'fault', value: 1 }], initial: scene.timeline.initial };
    if (this.engine.gfx) this.engine.gfx.loadScene(sys.id, st.winId, scene);
    this.engine.submitDisplay(sys, st.winId, { type: 'sceneResource', scene: U.deepClone(scene) });
  }
  recordFor(sys, st) { return st.record || null; }
  playerAction(sys, winId, st, action, p) {
    switch (action) {
      case 'open': { st.scenePath = String(p.path || st.scenePath); this.sceneCache = {}; this.loadScene(sys, st); st.position = 0; st.frameTime = 0; break; }
      case 'play': {
        if (st.position >= st.duration) st.position = 0;
        st.state = 'playing'; st.playAnchorTime = sys.virtualTime; st.playAnchorPos = st.position; break;
      }
      case 'pause': { st.state = 'paused'; st.playAnchorPos = st.position; break; }
      case 'stop': { st.state = 'paused'; st.position = 0; st.frameTime = 0; st.playAnchorPos = 0; st.playAnchorTime = sys.virtualTime; break; }
      case 'seek': { const t = Math.max(0, Math.min(st.duration, Number(p.value) || 0)); st.position = t; st.frameTime = t; st.playAnchorPos = t; st.playAnchorTime = sys.virtualTime; break; }
      case 'rate': { st.rate = Math.max(0.1, Math.min(4, Number(p.value) || 1)); st.playAnchorPos = st.position; st.playAnchorTime = sys.virtualTime; break; }
      case 'step': { const t = Math.min(st.duration, st.position + 1 / 30); st.position = t; st.frameTime = t; st.state = 'paused'; st.playAnchorPos = t; st.playAnchorTime = sys.virtualTime; break; }
      case 'loop': st.loop = !!p.value; break;
      case 'camera': st.cameraMode = String(p.value || 'show'); break;
      case 'free-orbit': { if (st.free) { st.free.pos[0] += Number(p.dx || 0) * 0.05; st.free.pos[1] += Number(p.dy || 0) * 0.05; } break; }
      case 'free-zoom': { if (st.free) st.free.fov = Math.max(20, Math.min(85, st.free.fov + Number(p.delta || 0) * 0.03)); break; }
      case 'select': st.selection = p; break;
      case 'ground': if (st.rehearsal) st.rehearsal.record.inputs.push({ t: sys.virtualTime - st.rehearsal.startTime, type: 'heading', value: Number(p.heading || 0) }); break;
      case 'project': this.engine.projectWindow(sys, winId, String(p.target)); break;
      case 'rehearsal-start': {
        st.mode = 'rehearsal'; st.state = 'playing'; st.position = 0; st.frameTime = 0;
        st.playAnchorTime = sys.virtualTime; st.playAnchorPos = 0;
        const scene = this.getScene(sys, st);
        const rec = { format: 'record/1', scenePath: st.scenePath, initial: U.deepClone(scene.timeline.initial),
          controls: [], inputs: [{ t: 0, type: 'wind', value: st.wind.slice() }], duration: 60, hold: true };
        rec.initial.y = 1.56; rec.initial.x = 0; rec.initial.z = 0;
        st.duration = rec.duration;
        st.rehearsal = { record: rec, startTime: sys.virtualTime, startControls: 0 };
        st.record = rec;
        // 启动飞控进程（可在编辑器中修改后重新排演）
        const cp = this.engine.spawnInternal(sys, st.controllerPath,
          { appId: winId, kind: 'app', name: '飞控进程', targetAlt: 5 }, { name: '飞控进程' });
        st.controllerPid = cp;
        break;
      }
      case 'rehearsal-wind': { st.wind = [Number(p.x || 0), Number(p.z || 0)]; if (st.rehearsal) st.rehearsal.record.inputs.push({ t: sys.virtualTime - st.rehearsal.startTime, type: 'wind', value: st.wind.slice() }); break; }
      case 'rehearsal-heading': { st.heading = Number(p.value || 0); if (st.rehearsal) st.rehearsal.record.inputs.push({ t: sys.virtualTime - st.rehearsal.startTime, type: 'heading', value: st.heading }); break; }
      case 'rehearsal-fault': { st.faultAt = Number(p.value || 0); if (st.rehearsal) st.rehearsal.record.inputs.push({ t: Number(p.value || 0), type: 'fault', value: 1 }); break; }
      case 'rehearsal-controller': st.controllerPath = String(p.path || st.controllerPath); break;
      case 'save-record': {
        if (!st.rehearsal) break;
        const name = String(p.name || ('排演记录-' + this.engine.stepCount)).replace(/[^\w\u4e00-\u9fa5-]/g, '_');
        const path = '/Documents/' + name + '.record';
        sys.fs.write(path, JSON.stringify(st.rehearsal.record), 'record');
        this.engine.notify('记录已保存', path, sys.id); this.engine.markDirty(); break;
      }
      case 'open-record': {
        const t = sys.fs.read(String(p.path)); if (t == null) break;
        try {
          const rec = JSON.parse(t);
          st.record = rec; st.rehearsal = { record: rec, startTime: sys.virtualTime, startControls: rec.controls.length };
          st.mode = 'replay'; st.duration = rec.duration || 15; st.position = 0; st.frameTime = 0;
          st.state = 'playing'; st.playAnchorTime = sys.virtualTime; st.playAnchorPos = 0;
          this.engine.notify('记录已打开', String(p.path) + ' · 可跳转回放', sys.id);
        } catch (e) { this.engine.notify('记录打开失败', e.message, sys.id); }
        break;
      }
      case 'continue-record': {
        if (!st.rehearsal) break;
        st.mode = 'rehearsal'; st.rehearsal.startTime = sys.virtualTime - st.position;
        st.rehearsal.startControls = st.rehearsal.record.controls.length;
        st.state = 'playing'; st.playAnchorTime = sys.virtualTime; st.playAnchorPos = st.position;
        const cp = this.engine.spawnInternal(sys, st.controllerPath, { appId: winId, kind: 'app', name: '飞控进程', targetAlt: 5 }, { name: '飞控进程' });
        st.controllerPid = cp; break;
      }
    }
  }

  // ---------------- 图表 / 实时数据连接 ----------------
  resolveDocPath(sys, title) {
    if (!title) return null;
    if (title[0] === '/') return sys.id === 'outer' ? title : title;
    for (const k in this.docs) if (this.docs[k].name === title) return k;
    if (title === '示例工作簿') return '/Demo/sample.sheet';
    return '/Demo/sample.sheet';
  }
  chartAction(sys, winId, st, action, p) {
    switch (action) {
      case 'field': { if (p.key) st[p.key] = p.value; break; }
      case 'type': st.chartType = String(p.value || 'bar'); this.repaintChart(sys, winId, st); break;
      case 'connect': this.connect(sys, winId, st, p); break;
      case 'disconnect': this.disconnect(sys, winId, st); break;
      case 'reconnect': this.reconnect(sys, winId, st); break;
      case 'project': this.engine.projectWindow(sys, winId, String(p.target)); break;
      case 'select': st.selectionLabel = p.label !== undefined ? p.label : null; this.repaintChart(sys, winId, st); break;
      case 'hover': st.hover = p; break;
    }
  }
  connect(sys, winId, st, p) {
    const docPath = this.resolveDocPath(sys, p.sourceTitle || st.sourceTitle);
    let doc = this.docs[docPath];
    if (!doc) doc = this.openDoc(this.engine.root, docPath);
    if (!doc) { this.engine.notify('连接失败', '找不到工作簿 ' + docPath, sys.id); return; }
    st.sourceTitle = p.sourceTitle || st.sourceTitle; st.sourceDoc = docPath;
    st.range = String(p.range || st.range).toUpperCase();
    st.labelCol = String(p.labelCol || st.labelCol).toUpperCase();
    st.series = Array.isArray(p.series) ? p.series : (p.series ? String(p.series).split(',').map(x => x.trim().toUpperCase()) : st.series);
    for (const c of this.engine.connections) {
      if (c.targetSystemId === sys.id && c.targetWinId === winId) { c.state = 'disconnected'; c.queue = []; }
    }
    const conn = { id: U.uid('conn'), docPath, docTitle: doc.name, range: st.range, labelCol: st.labelCol,
      series: st.series.slice(), targetSystemId: sys.id, targetWinId: winId, state: 'connected',
      queue: [], lastVersion: 0, cache: [], recvPid: st.recvPid, drawPid: st.drawPid };
    this.engine.connections.push(conn);
    st.connectionId = conn.id; st.connectionState = 'connected';
    this.publishRange(docPath);
    this.engine.notify('数据连接已建立', doc.name + ' · ' + st.range, sys.id);
    this.engine.emit('structure');
  }
  disconnect(sys, winId, st) {
    const c = this.engine.connections.find(x => x.targetSystemId === sys.id && x.targetWinId === winId);
    if (c) { c.state = 'disconnected'; c.queue = []; }
    st.connectionState = 'disconnected';
    this.engine.emit('structure');
  }
  reconnect(sys, winId, st) {
    st.recvPid = this.engine.spawnInternal(sys, '/System/programs/chart_receiver.prog',
      { appId: winId, kind: 'app', name: '图表数据接收进程', chartPid: null }, { name: '图表数据接收进程' });
    st.drawPid = this.engine.spawnInternal(sys, '/System/programs/chart_draw.prog',
      { appId: winId, kind: 'app', name: '图表绘制进程' }, { name: '图表绘制进程' });
    if (st.recvPid && sys.cpu.procs[st.recvPid]) sys.cpu.procs[st.recvPid].args.chartPid = st.drawPid;
    this.connect(sys, winId, st, { sourceTitle: st.sourceTitle, range: st.range, labelCol: st.labelCol, series: st.series });
  }
  repaintChart(sys, winId, st) {
    if (!st.display || st.display.type !== 'chart') return;
    const d = Object.assign({}, st.display, { chartType: st.chartType, selectionLabel: st.selectionLabel });
    this.engine.submitDisplay(sys, winId, d);
  }
  publishRange(docPath) {
    const doc = this.docs[docPath]; if (!doc) return;
    const conns = this.engine.connections.filter(c => c.docPath === docPath && c.state === 'connected');
    if (!conns.length) return;
    const version = (this._pubVersion = (this._pubVersion || 0) + 1);
    for (const c of conns) {
      const rows = this.rangeRows(doc, c.range, c.labelCol, c.series);
      const ver = { version, docPath, docTitle: doc.name, range: c.range, labelCol: c.labelCol, series: c.series.slice(),
        rows, time: Date.now() };
      c.lastVersion = version;
      c.queue.push(ver);
      c.cache.push(U.deepClone(ver));
      if (c.cache.length > 40) c.cache.shift();
      this.deliver(c);
    }
  }
  rangeRows(doc, range, labelCol, series) {
    const addrs = rangeAddrs(range);
    const byRow = {};
    for (const a of addrs) {
      const pa = parseAddr(a); if (!pa) continue;
      byRow[pa.r] = byRow[pa.r] || {};
      byRow[pa.r][numToCol(pa.c)] = doc.values[a] !== undefined ? doc.values[a] : this.rawNum(doc, a);
    }
    const rows = [];
    for (const r of Object.keys(byRow).sort((a, b) => a - b)) {
      const cols = byRow[r];
      const label = cols[labelCol] !== undefined ? String(cols[labelCol]) : r;
      const vals = series.map(s => { const v = cols[s]; return typeof v === 'number' ? v : (Number(v) || 0); });
      rows.push({ label, values: vals, row: Number(r) });
    }
    return rows;
  }
  rawNum(doc, a) { const c = doc.cells[a]; return c ? c.v : ''; }
  deliver(c) {
    const sys = this.engine.systems[c.targetSystemId];
    if (!sys || sys.state !== 'running' || this.engine.ancestorPaused(c.targetSystemId)) return;
    if (c.state !== 'connected') return;
    if (!c.recvPid || !sys.cpu.procs[c.recvPid] || sys.cpu.procs[c.recvPid].status === 'ended') return;
    while (c.queue.length) {
      const ver = c.queue.shift();
      sys.cpu.procs[c.recvPid].inbox.push(U.deepClone(ver));
      this.charge(sys, 2 + U.jsonSize(ver) / 24);
    }
  }

  // ---------------- 工作簿 ----------------
  openDoc(sys, docPath) {
    let doc = this.docs[docPath];
    if (doc) return doc;
    const text = sys.fs.read(docPath);
    if (text == null) {
      doc = new SheetDoc(docPath.split('/').pop(), { cols: 10, rows: 24, cells: {} });
    } else {
      try { doc = new SheetDoc(JSON.parse(text).name || docPath.split('/').pop(), JSON.parse(text)); }
      catch (e) { doc = new SheetDoc(docPath.split('/').pop(), { cols: 10, rows: 24, cells: {} }); }
    }
    doc.path = docPath; this.docs[docPath] = doc; return doc;
  }
  newDoc(sys, docPath) {
    const doc = new SheetDoc(docPath.split('/').pop(), { cols: 10, rows: 24, cells: {} });
    doc.path = docPath; this.docs[docPath] = doc; return doc;
  }
  commitDoc(sys, doc, label) {
    doc.undo.push({ cells: doc.snapshot(), label }); if (doc.undo.length > 60) doc.undo.shift();
    doc.redo = []; doc.recalc(); doc.dirty = true;
    this.charge(sys, 4 + Object.keys(doc.cells).length * 0.3);
    if (doc.path) this.publishRange(doc.path);
    this.engine.markDirty();
  }
  sheetAction(sys, winId, st, action, p) {
    const doc = this.docs[st.docPath]; if (!doc) return;
    switch (action) {
      case 'select': st.selection = String(p.addr || 'A1'); st.range = String(p.range || p.addr || 'A1'); st.formula = doc.cells[st.selection] && doc.cells[st.selection].f ? doc.cells[st.selection].f : ''; break;
      case 'formula': st.formula = String(p.value || ''); break;
      case 'commit': {
        const a = String(p.addr || st.selection);
        doc.undo.push({ cells: doc.snapshot(), label: 'edit' }); doc.redo = [];
        const v = String(p.value == null ? '' : p.value);
        doc.cells[a] = Object.assign({}, doc.cells[a] || { style: {} }, { v: v[0] === '=' ? '' : (isNaN(Number(v)) || v === '' ? v : Number(v)), f: v[0] === '=' ? v : null });
        doc.recalc(); doc.dirty = true; st.formula = '';
        this.charge(sys, 3 + Object.keys(doc.cells).length * 0.25);
        if (doc.path) this.publishRange(doc.path);
        this.engine.markDirty(); break;
      }
      case 'paste': {
        const cells = p.cells || [];
        doc.undo.push({ cells: doc.snapshot(), label: 'paste' }); doc.redo = [];
        cells.forEach((row, ri) => row.forEach((v, ci) => {
          const a = addrOf(colToNum(p.startCol || 'A') + ci, (p.startRow || 1) + ri);
          doc.cells[a] = Object.assign({}, doc.cells[a] || { style: {} }, { v: String(v)[0] === '=' ? '' : v, f: String(v)[0] === '=' ? String(v) : null });
        }));
        doc.recalc(); doc.dirty = true; this.charge(sys, 4 + cells.length * 2);
        if (doc.path) this.publishRange(doc.path); break;
      }
      case 'undo': {
        if (!doc.undo.length) break;
        doc.redo.push({ cells: doc.snapshot(), label: 'redo' });
        const s = doc.undo.pop(); doc.restore(s.cells); doc.dirty = true;
        if (doc.path) this.publishRange(doc.path); break;
      }
      case 'redo': {
        if (!doc.redo.length) break;
        doc.undo.push({ cells: doc.snapshot(), label: 'undo' });
        const s = doc.redo.pop(); doc.restore(s.cells); doc.dirty = true;
        if (doc.path) this.publishRange(doc.path); break;
      }
      case 'copy': {
        const addrs = rangeAddrs(st.range);
        const grid = []; let r0 = 1e9, c0 = 1e9, r1 = 0, c1 = 0;
        for (const a of addrs) { const pa = parseAddr(a); r0 = Math.min(r0, pa.r); c0 = Math.min(c0, pa.c); r1 = Math.max(r1, pa.r); c1 = Math.max(c1, pa.c); }
        for (let r = r0; r <= r1; r++) { const row = []; for (let c = c0; c <= c1; c++) { const a = addrOf(c, r); row.push(doc.values[a] !== undefined ? doc.values[a] : (doc.cells[a] ? doc.cells[a].v : '')); } grid.push(row); }
        const text = grid.map(row => row.join('\t')).join('\n');
        sys.desktop.clipboard.unshift({ id: U.uid('clip'), kind: 'range', text, grid, time: Date.now() });
        this.engine.notify('已复制', st.range + ' · ' + addrs.length + ' 个单元格', sys.id);
        this.engine.markDirty(); break;
      }
      case 'save': this.saveDoc(sys, st, p.path); break;
      case 'new': this.promptNew(sys, st); break;
      case 'open': this.promptOpen(sys, st, p.path); break;
      case 'prompt': st.prompt = p; break;
      case 'prompt-resolve': { const choice = String(p.choice || 'cancel'); if (choice === 'save') this.saveDoc(sys, st, st.prompt && st.prompt.nextPath); if (choice !== 'cancel') this.applyOpen(sys, st, st.prompt); st.prompt = null; break; }
    }
  }
  saveDoc(sys, st, path) {
    const doc = this.docs[st.docPath]; if (!doc) return;
    const target = path || st.docPath;
    sys.fs.write(target, doc.serialize(), 'sheet');
    doc.path = target; st.docPath = target; doc.dirty = false; this.engine.markDirty();
    this.engine.notify('工作簿已保存', target, sys.id);
  }
  promptNew(sys, st) { st.prompt = { type: 'new', nextPath: '/Documents/新建工作簿.sheet', message: '当前工作簿有未保存修改，是否保存？' }; if (!this.docs[st.docPath].dirty) this.applyOpen(sys, st, { type: 'new', nextPath: '/Documents/新建工作簿.sheet' }); }
  promptOpen(sys, st, path) { st.prompt = { type: 'open', nextPath: path, message: '当前工作簿有未保存修改，是否保存？' }; if (!this.docs[st.docPath].dirty) this.applyOpen(sys, st, { type: 'open', nextPath: path }); }
  applyOpen(sys, st, pr) {
    if (!pr) return;
    if (pr.type === 'new') { const doc = this.newDoc(sys, pr.nextPath); st.docPath = pr.nextPath; st.selection = 'A1'; st.range = 'A1'; }
    else { const doc = this.openDoc(sys, pr.nextPath); st.docPath = pr.nextPath; st.selection = 'A1'; st.range = 'A1'; }
    st.dirty = false; st.formula = '';
  }

  // ---------------- 文件管理器 ----------------
  fileAction(sys, winId, st, action, p) {
    const f = sys.fs;
    const work = n => this.charge(sys, n);
    switch (action) {
      case 'navigate': st.cwd = String(p.path || '/'); st.selected = []; break;
      case 'select': st.selected = Array.isArray(p.paths) ? p.paths : [p.path]; break;
      case 'new-file': { let name = String(p.name || '新建文件.txt'); let path = VFS.join(st.cwd, name); let i = 1; while (f.exists(path)) path = VFS.join(st.cwd, name.replace(/(\.[^.]*)?$/, m => m) + '(' + i++ + ')'); f.write(path, '', f.guessFormat(path)); work(2); this.engine.markDirty(); break; }
      case 'new-folder': { f.mkdir(VFS.join(st.cwd, String(p.name || '新建文件夹'))); work(2); this.engine.markDirty(); break; }
      case 'rename': { f.rename(String(p.path), String(p.name)); work(2); this.engine.markDirty(); break; }
      case 'copy': st.clipboard = { mode: 'copy', paths: st.selected.slice() }; break;
      case 'cut': st.clipboard = { mode: 'cut', paths: st.selected.slice() }; break;
      case 'paste': {
        if (!st.clipboard) break;
        for (const src of st.clipboard.paths) {
          let dst = VFS.join(st.cwd, VFS.basename(src));
          if (f.exists(dst) && !p.overwrite) { st.showOverwrite = { src, dst }; break; }
          if (f.isFile(src)) f.write(dst, f.read(src), f.node(src).format);
          else f.ensureDir(dst);
          work(2 + (f.read(src) || '').length / 32);
          if (st.clipboard.mode === 'cut') f.remove(src);
        }
        st.clipboard = null; st.showOverwrite = null; this.engine.markDirty(); break;
      }
      case 'delete': { for (const path of st.selected) f.deleteToTrash(path); st.selected = []; this.engine.notify('文件已删除', '可在回收站恢复', sys.id); this.engine.markDirty(); break; }
      case 'restore': { for (const path of st.selected) f.restoreFromTrash(path); st.selected = []; this.engine.notify('文件已恢复', '', sys.id); this.engine.markDirty(); break; }
      case 'purge': { for (const path of st.selected) f.remove(path); st.selected = []; this.engine.markDirty(); break; }
      case 'transfer': this.engine.transferFile(String(p.srcSys), String(p.srcPath), sys.id, st.cwd, !!p.overwrite); break;
      case 'open': this.openFile(this.engine.systems[sys.id], String(p.path)); break;
      case 'export': this.engine.exportFile(sys.id, String(p.path)); break;
      case 'import': this.engine.importFile(sys.id, st.cwd); break;
    }
  }
  openFile(sys, path) {
    const node = sys.fs.node(path); if (!node || node.type !== 'file') return;
    const ext = node.format || 'txt';
    const opts = { data: {} };
    if (ext === 'sheet') { opts.data.docPath = path; this.engine.openWindow(sys, 'spreadsheet', Object.assign({ title: '电子表格 · ' + VFS.basename(path) }, opts)); return; }
    if (ext === 'scene') { opts.data.scenePath = path; this.engine.openWindow(sys, 'player', Object.assign({ title: '播放器 · ' + VFS.basename(path) }, opts)); return; }
    if (ext === 'record') {
      const w = this.engine.openWindow(sys, 'player', { title: '排演回放 · ' + VFS.basename(path) });
      this.engine.appAction(sys, w.id, 'open-record', { path }); return;
    }
    if (ext === 'image' || ext === 'png' || ext === 'jpg') { this.engine.notify('图片文件', VFS.basename(path), sys.id); return; }
    opts.data.path = path;
    this.engine.openWindow(sys, 'editor', Object.assign({ title: '编辑器 · ' + VFS.basename(path) }, opts));
  }

  // ---------------- 小组件 ----------------
  widgetAction(sys, winId, st, action, p) {
    const d = sys.desktop;
    switch (action) {
      case 'tab': st.tab = String(p.value || 'clock'); break;
      case 'timer-input': d.timer.duration = Math.max(1, Number(p.value) || 5); d.timer.remaining = d.timer.duration; d.timer.done = false; break;
      case 'timer-start': d.timer.running = true; d.timer.done = false; d.timer.endsAt = Date.now() + d.timer.remaining * 1000; break;
      case 'timer-pause': d.timer.running = false; break;
      case 'timer-reset': d.timer.running = false; d.timer.done = false; d.timer.remaining = d.timer.duration; break;
      case 'sw-start': if (!d.stopwatch.running) { d.stopwatch.running = true; d.stopwatch.startedAt = Date.now() - d.stopwatch.elapsed * 1000; } break;
      case 'sw-pause': if (d.stopwatch.running) { d.stopwatch.running = false; d.stopwatch.elapsed = (Date.now() - d.stopwatch.startedAt) / 1000; } break;
      case 'sw-lap': d.stopwatch.laps.push(d.stopwatch.elapsed); break;
      case 'sw-reset': d.stopwatch.running = false; d.stopwatch.elapsed = 0; d.stopwatch.laps = []; break;
      case 'note-save': { const t = String(p.text || ''); if (p.id) { const n = d.notes.find(x => x.id === p.id); if (n) n.text = t; } else d.notes.push({ id: U.uid('note'), text: t, color: p.color || '#ffd76a' }); this.engine.markDirty(); break; }
      case 'note-delete': d.notes = d.notes.filter(x => x.id !== p.id); this.engine.markDirty(); break;
      case 'calendar': {
        const base = d.calendarMonth ? new Date(d.calendarMonth) : new Date();
        base.setDate(1);
        base.setMonth(base.getMonth() + (Number(p.value) || 0));
        d.calendarMonth = base.toISOString();
        break;
      }
      case 'clip-copy': { const item = d.clipboard.find(x => x.id === p.id); if (item) { this.engine.notify('再次复制', item.text.slice(0, 40), sys.id); d.clipboard.unshift(Object.assign({}, item, { id: U.uid('clip'), time: Date.now() })); } break; }
      case 'clip-clear': d.clipboard = []; this.engine.markDirty(); break;
      case 'ntf-read': d.notifications.forEach(n => n.read = true); d.unread = 0; this.engine.markDirty(); break;
      case 'ntf-clear': d.notifications = []; d.unread = 0; this.engine.markDirty(); break;
      case 'dnd': d.dnd = !!p.value; this.engine.markDirty(); break;
      case 'theme': d.theme = String(p.value || 'light'); this.engine.markDirty(); break;
      case 'accent': d.accent = String(p.value || '#7c5cff'); this.engine.markDirty(); break;
      case 'scale': d.scale = Math.max(0.75, Math.min(1.5, Number(p.value) || 1)); this.engine.markDirty(); break;
    }
  }

  // ---------------- 编辑器 ----------------
  editorAction(sys, winId, st, action, p) {
    switch (action) {
      case 'text': st.content = String(p.value || ''); st.dirty = true; break;
      case 'filename': st.filename = String(p.value || st.filename); break;
      case 'save': { sys.fs.write(st.filename, st.content, sys.fs.guessFormat(st.filename)); st.dirty = false; this.engine.markDirty(); this.engine.notify('文件已保存', st.filename, sys.id); break; }
      case 'new': st.filename = '/Documents/新建程序.prog'; st.content = ''; st.dirty = false; break;
      case 'open': { const t = sys.fs.read(String(p.path)); if (t != null) { st.filename = String(p.path); st.content = t; st.dirty = false; } break; }
      case 'run': { sys.fs.write(st.filename, st.content, sys.fs.guessFormat(st.filename)); this.engine.launchProgram(sys, st.filename, {}, { name: st.filename }); st.output.push('已请求启动 ' + st.filename); break; }
      case 'compile': { sys.fs.write(st.filename, st.content, sys.fs.guessFormat(st.filename)); const c = this.engine.compileProgram(sys, st.filename, sys.cpu); st.output.push(Array.isArray(c) ? '编译成功：' + c.length + ' 条指令' : '编译失败：' + (c.__err || '')); break; }
    }
  }

  // ---------------- 任务管理器 / 设置 ----------------
  taskAction(sys, winId, st, action, p) {
    switch (action) {
      case 'tab': st.tab = String(p.value || 'processes'); break;
      case 'suspend': this.engine.suspendProc(sys, String(p.pid)); break;
      case 'resume': this.engine.resumeProc(sys, String(p.pid)); break;
      case 'kill': this.engine.killProc(sys, String(p.pid)); break;
      case 'budget': this.engine.setConfig(sys.id, 'budget', p.value); break;
      case 'memory': this.engine.setConfig(sys.id, 'memory', p.value); break;
      case 'storage': this.engine.setConfig(sys.id, 'storage', p.value); break;
      case 'grant': this.engine.setGrant(sys.id, String(p.target), p.value); break;
      case 'quota': { const pr = sys.cpu.procs[String(p.pid)]; if (pr) pr.quota = Number(p.value) || 0; break; }
    }
  }
  settingsAction(sys, winId, st, action, p) {
    switch (action) {
      case 'name': sys.name = String(p.value || sys.name); this.engine.markDirty(); break;
      case 'wallpaper': sys.desktop.wallpaper = String(p.value); this.engine.markDirty(); break;
      case 'accent': sys.desktop.accent = String(p.value); this.engine.markDirty(); break;
      case 'scale': sys.desktop.scale = Math.max(0.75, Math.min(1.5, Number(p.value) || 1)); this.engine.markDirty(); break;
      case 'theme': sys.desktop.theme = String(p.value); this.engine.markDirty(); break;
    }
  }

  // ---------------- 浏览器 ----------------
  browserAction(sys, winId, st, action, p) {
    const tab = st.tabs.find(t => t.id === st.activeTab) || st.tabs[0];
    switch (action) {
      case 'new-tab': { const t = { id: U.uid('tab'), url: 'about:blank', title: '新标签页', loadState: 'idle', history: [], hi: -1 }; st.tabs.push(t); st.activeTab = t.id; break; }
      case 'close-tab': { if (st.tabs.length <= 1) { st.tabs = [{ id: U.uid('tab'), url: 'about:blank', title: '新标签页', loadState: 'idle', history: [], hi: -1 }]; st.activeTab = st.tabs[0].id; } else { st.tabs = st.tabs.filter(t => t.id !== p.tabId); if (st.activeTab === p.tabId) st.activeTab = st.tabs[st.tabs.length - 1].id; } break; }
      case 'switch-tab': st.activeTab = String(p.tabId); break;
      case 'navigate': {
        if (!tab) break;
        let url = String(p.url || '').trim();
        if (url && !/^https?:\/\//i.test(url) && url !== 'about:blank') url = 'https://' + url;
        if (tab.hi < tab.history.length - 1) tab.history = tab.history.slice(0, tab.hi + 1);
        tab.history.push(url); tab.hi = tab.history.length - 1; tab.url = url; tab.loadState = 'loading'; tab.title = '加载中…';
        break;
      }
      case 'back': { if (tab && tab.hi > 0) { tab.hi--; tab.url = tab.history[tab.hi]; tab.loadState = 'loading'; } break; }
      case 'forward': { if (tab && tab.hi < tab.history.length - 1) { tab.hi++; tab.url = tab.history[tab.hi]; tab.loadState = 'loading'; } break; }
      case 'reload': if (tab) tab.loadState = 'loading'; break;
      case 'stop': if (tab) tab.loadState = 'loaded'; break;
      case 'url': if (tab) tab.url = String(p.url || tab.url); break;
      case 'title': if (tab) tab.title = String(p.title || tab.title); break;
      case 'load-state': if (tab) tab.loadState = String(p.value || 'loaded'); break;
      case 'open-in-tab': { const t = { id: U.uid('tab'), url: String(p.url || 'about:blank'), title: '新标签页', loadState: 'loading', history: [String(p.url)], hi: 0 }; st.tabs.push(t); st.activeTab = t.id; break; }
    }
  }

  projectionAction(sys, winId, st, action, p) {
    // 投送窗口的输入由 UI 直接转发到源系统；此处仅保留占位以便扩展。
  }
}

Runtime.SheetDoc = SheetDoc;
Runtime.rangeAddrs = rangeAddrs;
Runtime.parseAddr = parseAddr;
Runtime.addrOf = addrOf;
Runtime.colToNum = colToNum;
Runtime.numToCol = numToCol;
module.exports = Runtime;
