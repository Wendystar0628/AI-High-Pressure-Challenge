// 界面：参数面板、走带控制、阶段条与遥测曲线
'use strict';

const JELLY_PHASES = [['ready', '准备'], ['fall', '下落'], ['contact', '接触与形变'], ['rebound', '回弹振荡'], ['after', '余波衰减'], ['stable', '稳定']];
const TANK_PHASES = [['init', '初始状态'], ['release', '释放入水'], ['separate', '浮沉分化'], ['wave', '启动造浪'], ['persist', '持续扰动'], ['stop', '停止扰动'], ['stable', '稳定分层']];

const UI = {
  els: {},
  init(app) {
    this.app = app;
    const $ = (id) => document.getElementById(id);
    this.els = { params: $('params'), phases: $('phases'), ctrl: $('ctrl'), readout: $('readout'), title: $('sceneTitle'), sub: $('sceneSub'), keys: $('keys') };
    document.querySelectorAll('#sceneTabs .tab').forEach((b) => b.addEventListener('click', () => app.setScene(b.dataset.scene)));
    this.rebuild();
  },

  rebuild() {
    const app = this.app, sc = app.scene;
    document.body.dataset.scene = sc;
    document.querySelectorAll('#sceneTabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.scene === sc));
    this.els.title.textContent = sc === 'jelly' ? '重球冲击果冻台' : '同尺寸多密度球 · 透明造浪水槽';
    this.buildPhases();
    this.buildTransport();
    if (sc === 'jelly') this.buildJellyParams(); else this.buildTankParams();
    this.els.keys.innerHTML = sc === 'jelly'
      ? '<kbd>空格</kbd>触发 / 暂停　<kbd>R</kbd>重置　<kbd>S</kbd>慢动作　<kbd>1</kbd><kbd>2</kbd>切换场景　<kbd>M</kbd>声音<br>拖动旋转　滚轮缩放　<kbd>Shift</kbd>+拖动平移　双击复位镜头'
      : '<kbd>空格</kbd>开始 / 暂停　<kbd>R</kbd>重置　<kbd>B</kbd>再次释放　<kbd>W</kbd>造浪开关　<kbd>S</kbd>慢动作　<kbd>M</kbd>声音<br>拖动旋转　滚轮缩放　<kbd>Shift</kbd>+拖动平移　双击复位镜头';
  },

  buildPhases() {
    const list = this.app.scene === 'jelly' ? JELLY_PHASES : TANK_PHASES;
    this.els.phases.innerHTML = list.map(([k, n]) => `<div class="phase" data-k="${k}">${n}</div>`).join('');
    this.phaseKeys = list.map((x) => x[0]);
  },

  buildTransport() {
    const app = this.app, c = this.els.ctrl;
    c.innerHTML = '';
    const btn = (label, cls, fn, kbd, id) => {
      const b = document.createElement('button');
      b.className = cls || ''; b.textContent = label;
      if (kbd) { const k = document.createElement('kbd'); k.textContent = kbd; b.appendChild(k); }
      if (id) b.id = id;
      b.addEventListener('click', fn);
      c.appendChild(b);
      return b;
    };
    btn(app.scene === 'jelly' ? '触发' : '开始实验', 'primary', () => app.triggerOrRun(), null, 'btnTrig');
    this.btnPause = btn('暂停', '', () => app.togglePause(), null, 'btnPause');
    btn('重置', '', () => app.resetScene(), 'R');
    if (app.scene === 'tank') {
      const s = document.createElement('div'); s.className = 'sep'; c.appendChild(s);
      btn('再次释放', '', () => app.tank.rerelease(), 'B');
      this.btnWave = btn('开始造浪', '', () => app.toggleWave(), 'W', 'btnWave');
    }
    const s2 = document.createElement('div'); s2.className = 'sep'; c.appendChild(s2);
    const sp = document.createElement('div'); sp.className = 'speed';
    this.speedBtns = [];
    for (const v of [1, 0.5, 0.25, 0.1]) {
      const b = document.createElement('button');
      b.textContent = v === 1 ? '1×' : (v + '×');
      b.addEventListener('click', () => app.setSpeed(v));
      b.dataset.v = v;
      sp.appendChild(b);
      this.speedBtns.push(b);
    }
    c.appendChild(sp);
    const s3 = document.createElement('div'); s3.className = 'sep'; c.appendChild(s3);
    this.btnSound = btn('声音', '', () => AudioFX.toggle(), 'M', 'btnSound');
    this.syncTransport();
    this.syncSound();
  },

  syncTransport() {
    const app = this.app;
    if (this.btnPause) this.btnPause.textContent = app.paused ? '继续' : '暂停';
    (this.speedBtns || []).forEach((b) => b.classList.toggle('on', parseFloat(b.dataset.v) === app.speed));
    const trig = document.getElementById('btnTrig');
    if (trig) {
      const started = app.scene === 'jelly' ? app.jelly.triggerT >= 0 : app.tank.triggerT >= 0;
      trig.textContent = started ? '重新运行' : (app.scene === 'jelly' ? '触发' : '开始实验');
    }
    if (this.btnWave && app.tank) {
      const w = app.tank.isWaving();
      this.btnWave.firstChild.textContent = w ? '停止造浪' : '开始造浪';
      this.btnWave.classList.toggle('on', w);
    }
  },

  syncSound() {
    const b = this.btnSound;
    const on = AudioFX.enabled;
    if (b) {
      b.firstChild.textContent = on ? '声音 开' : '声音 关';
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? '关闭声音' : '打开声音';
    }
    const hint = document.getElementById('soundHint');
    if (hint) {
      hint.textContent = !on ? '声音已关闭。'
        : (AudioFX.isRunning() ? '音效由撞击、入水、波浪等实时状态合成。' : '浏览器要求先操作页面：点击或按键后开始发声。');
    }
  },
  buildSoundGroup() {
    const g = this.group('声音');
    this.slider(g, '音量', () => AudioFX.volume, (v) => AudioFX.setVolume(v), 0, 1, 0.01, (v) => Math.round(v * 100) + ' %');
    const p = document.createElement('p'); p.className = 'hint'; p.id = 'soundHint'; g.appendChild(p);
    this.syncSound();
  },

  // —— 通用控件 ——
  group(title, sub) {
    const g = document.createElement('section');
    g.className = 'group';
    g.innerHTML = `<h3>${title}${sub ? `<small>${sub}</small>` : ''}</h3>`;
    this.els.params.appendChild(g);
    return g;
  },
  slider(g, label, get, set, min, max, step, fmt) {
    const r = document.createElement('div'); r.className = 'row';
    const id = 'p' + Math.random().toString(36).slice(2, 8);
    r.innerHTML = `<label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const inp = r.children[1], out = r.children[2];
    inp.value = get();
    out.textContent = fmt(get());
    inp.addEventListener('input', () => { const v = parseFloat(inp.value); set(v); out.textContent = fmt(v); });
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    g.appendChild(r);
    return r;
  },
  seg(g, label, get, set, opts) {
    const r = document.createElement('div'); r.className = 'row wide';
    r.innerHTML = `<label>${label}</label><div class="seg"></div>`;
    const box = r.children[1];
    const btns = opts.map(([v, n]) => {
      const b = document.createElement('button');
      b.textContent = n; b.dataset.v = v;
      b.addEventListener('click', () => { set(v); btns.forEach((x) => x.classList.toggle('on', x.dataset.v === String(get()))); });
      box.appendChild(b);
      return b;
    });
    btns.forEach((x) => x.classList.toggle('on', x.dataset.v === String(get())));
    g.appendChild(r);
    return r;
  },
  select(g, label, get, set, opts) {
    const r = document.createElement('div'); r.className = 'row wide';
    const id = 'p' + Math.random().toString(36).slice(2, 8);
    r.innerHTML = `<label for="${id}">${label}</label><select id="${id}">${opts.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>`;
    const sel = r.children[1];
    sel.value = get();
    sel.addEventListener('change', () => { set(sel.value); sel.blur(); });
    g.appendChild(r);
  },
  check(g, label, get, set) {
    const l = document.createElement('label'); l.className = 'check';
    l.innerHTML = `<input type="checkbox"><span>${label}</span>`;
    const c = l.firstChild; c.checked = get();
    c.addEventListener('change', () => { set(c.checked); c.blur(); });
    g.appendChild(l);
  },

  buildJellyParams() {
    const app = this.app, s = app.jelly, p = s.p;
    this.els.params.innerHTML = '';
    const reset = () => app.scheduleReset();
    const setR = (k) => (v) => { p[k] = v; reset(); };

    let g = this.group('冲击模式', '可分别触发');
    this.seg(g, '模式', () => p.mode, (v) => { p.mode = v; app.resetScene(); this.buildJellyParams(); }, [['center', '正中'], ['offset', '偏心'], ['multi', '多球']]);

    g = this.group('重球');
    this.slider(g, '质量', () => p.ballMass, setR('ballMass'), 2, 120, 1, (v) => v.toFixed(0) + ' kg');
    this.slider(g, '半径', () => p.ballRadius, setR('ballRadius'), 0.08, 0.26, 0.005, (v) => (v * 100).toFixed(1) + ' cm');
    this.slider(g, '初始高度', () => p.dropHeight, setR('dropHeight'), 0.3, 2.4, 0.05, (v) => v.toFixed(2) + ' m');
    if (p.mode === 'offset') this.slider(g, '偏心距', () => p.offset, setR('offset'), 0.1, 1.05, 0.01, (v) => (v * 100).toFixed(0) + ' %');
    if (p.mode === 'multi') {
      this.slider(g, '球数', () => p.ballCount, setR('ballCount'), 2, 6, 1, (v) => v.toFixed(0) + ' 个');
      this.slider(g, '释放间隔', () => p.interval, setR('interval'), 0.12, 1.6, 0.01, (v) => v.toFixed(2) + ' s');
    }

    g = this.group('果冻');
    this.select(g, '初始形状', () => p.shape, (v) => { p.shape = v; reset(); }, [['block', '块状（圆角）'], ['frustum', '圆台']]);
    this.slider(g, '宽度', () => p.width, setR('width'), 0.6, 1.6, 0.01, (v) => v.toFixed(2) + ' m');
    this.slider(g, '纵深', () => p.depth, setR('depth'), 0.6, 1.6, 0.01, (v) => v.toFixed(2) + ' m');
    this.slider(g, '高度', () => p.height, setR('height'), 0.3, 0.95, 0.01, (v) => v.toFixed(2) + ' m');
    this.slider(g, '软硬', () => p.stiffness, setR('stiffness'), 4, 80, 1, (v) => v.toFixed(0) + ' kPa');
    this.slider(g, '阻尼', () => p.damping, (v) => { p.damping = v; s.updateMaterial(); }, 0.05, 1, 0.01, (v) => v.toFixed(2));
    this.slider(g, '密度', () => p.density, setR('density'), 600, 1600, 10, (v) => v.toFixed(0) + ' kg/m³');
    this.select(g, '底部固定', () => p.fixMode, (v) => { p.fixMode = v; reset(); }, [['free', '不固定（靠摩擦）'], ['glue', '整面粘接'], ['rim', '四周卡箍'], ['center', '中心钉住']]);

    g = this.group('碰撞与环境');
    this.slider(g, '重力', () => p.gravity, setR('gravity'), 1, 25, 0.01, (v) => v.toFixed(2) + ' m/s²');
    this.slider(g, '平台摩擦', () => p.friction, (v) => { p.friction = v; }, 0, 1.5, 0.01, (v) => v.toFixed(2));
    this.slider(g, '平台弹性', () => p.platformElastic, setR('platformElastic'), 0, 1, 0.01, (v) => v.toFixed(2));
    this.check(g, '允许重球连续多次撞击（关闭时首次反弹后由吸头接住）', () => p.multiHit, (v) => { p.multiHit = v; });

    g = this.group('显示');
    this.check(g, '形变位移着色（观察传播）', () => app.jellyView.showHeat, (v) => { app.jellyView.showHeat = v; });
    g = this.group('运动曲线');
    g.innerHTML += '<canvas id="chart"></canvas>';
    this.chart = g.querySelector('#chart');
    this.buildSoundGroup();
  },

  buildTankParams() {
    const app = this.app, s = app.tank, p = s.p;
    this.els.params.innerHTML = '';
    const reset = () => app.scheduleReset();
    const setR = (k) => (v) => { p[k] = v; reset(); };
    let g = this.group('流体');
    this.slider(g, '水位高度', () => p.level, setR('level'), 0.18, Math.min(0.8, p.height * 0.85), 0.01, (v) => v.toFixed(2) + ' m');
    this.slider(g, '重力', () => p.gravity, (v) => { p.gravity = v; }, 1, 25, 0.01, (v) => v.toFixed(2) + ' m/s²');
    this.slider(g, '粘性', () => p.viscosity, (v) => { p.viscosity = v; }, 0, 3, 0.01, (v) => (v * 1000).toFixed(0) + ' cSt');
    this.slider(g, '阻尼', () => p.damping, (v) => { p.damping = v; }, 0, 0.8, 0.01, (v) => v.toFixed(2) + ' /s');
    this.select(g, '模拟精度', () => String(p.quality), (v) => { p.quality = parseFloat(v); reset(); }, [['0.35', '流畅（约 110 万粒子）'], ['0.62', '标准（约 190 万粒子）'], ['1', '高（约 300 万粒子）']]);

    g = this.group('球体', '同一水槽内尺寸相同');
    this.slider(g, '统一半径', () => p.radius, setR('radius'), 0.025, 0.065, 0.001, (v) => (v * 100).toFixed(1) + ' cm');
    this.slider(g, '释放高度', () => p.releaseH, setR('releaseH'), 0.1, 0.34, 0.01, (v) => (v * 100).toFixed(0) + ' cm');
    this.slider(g, '总数量', () => p.counts.reduce((a, b) => a + b, 0), (v) => {
      // 按当前各组比例重新分配到每组
      const cur = p.counts.reduce((a, b) => a + b, 0) || 1;
      const raw = p.counts.map((c) => (cur > 0 ? c : 1) * v / cur);
      const next = raw.map(Math.floor);
      let rest = Math.round(v) - next.reduce((a, b) => a + b, 0);
      const order = raw.map((x, i) => [x - next[i], i]).sort((a, b) => b[0] - a[0]);
      for (let i = 0; i < rest; i++) next[order[i % 5][1]]++;
      p.counts = next;
      document.querySelectorAll('.dtable .stepper').forEach((el, i) => { el.value = next[i]; });
      this.updateTotal();
      reset();
    }, 5, TANK_MAX_BALLS, 1, (v) => v.toFixed(0) + ' 个');
    this.select(g, '初始布局', () => p.layout, (v) => { p.layout = v; reset(); }, [['mixed', '混合散布'], ['grouped', '按密度分块'], ['center', '居中集中']]);
    const tb = document.createElement('div'); tb.className = 'dtable';
    tb.innerHTML = '<div class="hd">分组</div><div class="hd">密度</div><div class="hd" style="text-align:right">kg/m³</div><div class="hd">数量</div>';
    TANK_GROUPS.forEach((G, i) => {
      const col = `rgb(${G.color.map((c) => Math.round(255 * Math.pow(c, 1 / 2.2))).join(',')})`;
      const nm = document.createElement('div'); nm.className = 'nm'; nm.innerHTML = `<span class="chip" style="background:${col}"></span>${G.name}`;
      const rng = document.createElement('input'); rng.type = 'range';
      const ranges = [[100, 800], [600, 950], [960, 1040], [1050, 1600], [1500, 8000]][i];
      rng.min = ranges[0]; rng.max = ranges[1]; rng.step = i === 2 ? 1 : 10; rng.value = p.dens[i];
      rng.setAttribute('aria-label', G.full + '密度');
      const out = document.createElement('output'); out.textContent = p.dens[i];
      rng.addEventListener('input', () => { p.dens[i] = parseFloat(rng.value); out.textContent = rng.value; reset(); });
      const cnt = document.createElement('input'); cnt.type = 'number'; cnt.className = 'stepper'; cnt.min = 0; cnt.max = 20; cnt.value = p.counts[i];
      cnt.setAttribute('aria-label', G.full + '数量');
      cnt.addEventListener('change', () => { p.counts[i] = clamp(parseInt(cnt.value) || 0, 0, 20); cnt.value = p.counts[i]; this.updateTotal(); reset(); });
      cnt.addEventListener('keydown', (e) => e.stopPropagation());
      tb.append(nm, rng, out, cnt);
    });
    g.appendChild(tb);
    const tot = document.createElement('p'); tot.className = 'hint'; tot.id = 'ballTotal'; g.appendChild(tot);
    this.updateTotal();

    g = this.group('水槽');
    this.slider(g, '长度', () => p.length, setR('length'), 1.4, 3.2, 0.02, (v) => v.toFixed(2) + ' m');
    this.slider(g, '宽度', () => p.width, setR('width'), 0.4, 1.1, 0.02, (v) => v.toFixed(2) + ' m');
    this.slider(g, '高度', () => p.height, setR('height'), 0.5, 1.1, 0.02, (v) => v.toFixed(2) + ' m');

    g = this.group('造浪装置');
    this.select(g, '装置类型', () => p.waveType, (v) => { p.waveType = v; }, [['piston', '活塞推板（整体平移）'], ['flap', '往复波板（底部铰接）'], ['top', '上铰摆板（顶部铰接）']]);
    // 标签较长，这一行放宽标签列
    this.slider(g, '入水后启动延迟', () => p.waveDelay, (v) => { p.waveDelay = v; s.retimeWave(); }, 0.5, 10, 0.1, (v) => v.toFixed(1) + ' s').style.gridTemplateColumns = '86px 1fr 52px';
    this.slider(g, '运动幅度', () => p.waveAmp, (v) => { p.waveAmp = v; }, 0.01, 0.16, 0.005, (v) => (v * 100).toFixed(1) + ' cm');
    this.slider(g, '运动频率', () => p.waveFreq, (v) => { p.waveFreq = v; }, 0.25, 1.8, 0.01, (v) => v.toFixed(2) + ' Hz');
    this.slider(g, '持续时长', () => p.waveDur, (v) => { p.waveDur = v; s.retimeWave(); }, 1, 60, 1, (v) => v.toFixed(0) + ' s');

    g = this.group('运动曲线', '各层球数');
    g.innerHTML += '<canvas id="chart"></canvas>';
    this.chart = g.querySelector('#chart');
    this.buildSoundGroup();
  },

  updateTotal() {
    const p = this.app.tank.p, el = document.getElementById('ballTotal');
    if (el) {
      const n = p.counts.reduce((a, b) => a + b, 0);
      el.textContent = `当前共 ${n} 个，同一水槽内半径相同，靠密度差异分层。`;
    }
  },

  setPhase(k) {
    if (this.curPhase === k) return;
    this.curPhase = k;
    const idx = this.phaseKeys.indexOf(k);
    this.els.phases.querySelectorAll('.phase').forEach((el, i) => {
      el.classList.toggle('on', i === idx);
      el.classList.toggle('done', i < idx);
    });
  },

  update() {
    const app = this.app;
    this.syncTransport();
    if (app.scene === 'jelly') {
      const s = app.jelly;
      this.setPhase(s.phase);
      const b = s.balls[0] || { vy: 0, vx: 0, vz: 0, y: 0 };
      const v = Math.hypot(b.vx, b.vy, b.vz);
      this.els.readout.innerHTML = `t <em>${s.t.toFixed(2)}</em> s   球速 <em>${v.toFixed(2)}</em> m/s   凹陷 <em>${((s.maxDent || 0) * 100).toFixed(1)}</em> cm   上隆 <em>${((s.maxUp || 0) * 100).toFixed(1)}</em> cm   侧鼓 <em>${(Math.abs(s.bulge || 0) * 100).toFixed(1)}</em> cm   接触节点 <em>${s.contactN || 0}</em>`;
      this.drawChartJelly(s);
      this.els.sub.textContent = { center: '单球正中撞击', offset: '偏心撞击', multi: '多球连续冲击' }[s.p.mode];
    } else {
      const s = app.tank;
      this.setPhase(s.currentPhase());
      const st = s.stats;
      const hasS = st && st.groups;
      const count = hasS ? `水面 <em>${st.surface}</em>   水中 <em>${st.midwater}</em>   水底 <em>${st.bottom}</em>   空中 <em>${st.air + st.held}</em>` : '';
      this.els.readout.innerHTML = `t <em>${s.t.toFixed(2)}</em> s   ${count}   平均球速 <em>${(hasS ? st.speed : 0).toFixed(2)}</em> m/s   造浪 <em>${s.isWaving() ? '运行中' : '静止'}</em>`;
      this.drawChartTank(s);
      this.els.sub.textContent = `${s.np ? (s.np / 1e6).toFixed(2) : 0} M 粒子 · 网格 ${s.nx}×${s.ny}×${s.nz}`;
    }
  },

  sizeChart() {
    const c = this.chart;
    if (!c) return null;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * 2) { c.width = w * 2; c.height = h * 2; }
    const g = c.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, w, h);
    g.font = '10.5px ' + getComputedStyle(document.body).fontFamily;
    return { g, w, h };
  },

  drawChartJelly(s) {
    const k = this.sizeChart();
    if (!k) return;
    const { g, w, h } = k;
    const H = s.history;
    if (H.length < 2) { g.fillStyle = '#5f6a7c'; g.fillText('触发后显示球底高度与凹陷深度', 4, 14); return; }
    const t1 = H[H.length - 1].t, t0 = Math.max(H[0].t, t1 - 12);
    const X = (t) => 2 + (t - t0) / Math.max(t1 - t0, 1) * (w - 4);
    const yMax = Math.max(0.5, s.p.dropHeight), Y = (v) => h - 13 - (v + 0.35) / (yMax + 0.35) * (h - 30);
    g.strokeStyle = '#2a3241'; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke();
    const line = (fn, col) => { g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); let st = false; for (const e of H) { if (e.t < t0) continue; const x = X(e.t), y = Y(fn(e)); if (!st) { g.moveTo(x, y); st = true; } else g.lineTo(x, y); } g.stroke(); };
    line((e) => e.y, '#d9dfe9');
    line((e) => -e.dent, '#f0566b');
    g.fillStyle = '#d9dfe9'; g.fillText('球底高度', 4, 12);
    g.fillStyle = '#f0566b'; g.fillText('顶面凹陷', 58, 12);
    g.fillStyle = '#5f6a7c'; g.fillText(t0.toFixed(1) + ' s', 2, h - 1);
    const lb = t1.toFixed(1) + ' s'; g.fillText(lb, w - g.measureText(lb).width - 2, h - 1);
  },

  drawChartTank(s) {
    const k = this.sizeChart();
    if (!k) return;
    const { g, w, h } = k;
    const H = s.history || [];
    if (H.length < 2) { g.fillStyle = '#5f6a7c'; g.fillText('开始后显示水面、水中、水底的球数', 4, 14); return; }
    const t1 = H[H.length - 1].t, t0 = Math.max(H[0].t, t1 - 60);
    const X = (t) => 2 + (t - t0) / Math.max(t1 - t0, 1) * (w - 4);
    const N = Math.max(1, s.nBalls);
    const Y = (v) => h - 13 - v / N * (h - 30);
    const line = (fn, col) => { g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); let st = false; for (const e of H) { if (e.t < t0) continue; const x = X(e.t), y = Y(fn(e)); if (!st) { g.moveTo(x, y); st = true; } else g.lineTo(x, y); } g.stroke(); };
    line((e) => e.surf, '#ffcc4d');
    line((e) => e.mid, '#4bd98a');
    line((e) => e.bot, '#ef5a78');
    g.fillStyle = '#ffcc4d'; g.fillText('水面', 4, 12);
    g.fillStyle = '#4bd98a'; g.fillText('水中', 34, 12);
    g.fillStyle = '#ef5a78'; g.fillText('水底', 64, 12);
    g.fillStyle = '#5f6a7c'; g.fillText(t0.toFixed(0) + ' s', 2, h - 1);
    const lb = t1.toFixed(0) + ' s'; g.fillText(lb, w - g.measureText(lb).width - 2, h - 1);
  },
};
