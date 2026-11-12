/* player.js — 3D scene player with flight rehearsal.
   Used by root system and subsystems. Renders via Scene3D device.
   Playback position advances with the owning system's virtual time. */
import { el, fmtTime, uid } from '../utils.js';
import { Scene3D } from '../scene/scene3d.js';
import { buildHelicopterScene, evalPerformance, buildSceneSubmission } from '../scene/heli-scene.js';
import { FlightModel } from '../scene/flight.js';
import { parse, Interp } from '../vm/ks.js';

export class PlayerApp {
  constructor(context) {
    this.context = context;   // { root | sub, systemId, vfs, now(), createWindow, notify, ... }
    this.instances = new Map();
  }

  open(params = {}) {
    const scenePath = params.path || '/Demo/helicopter-24.scene';
    let sceneData;
    try {
      const raw = this.context.vfs.read(scenePath);
      sceneData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      sceneData = null;
    }
    if (!sceneData || !sceneData.helicopter) {
      // fall back to built-in resource
      sceneData = buildHelicopterScene();
    }

    const state = {
      scene: sceneData,
      scenePath,
      mode: params.mode || 'performance', // performance | rehearsal | replay
      playing: false,
      position: 0,
      rate: 1,
      loop: false,
      frameTime: sceneData.performance ? sceneData.performance.frameTime : 1 / 30,
      duration: sceneData.performance ? sceneData.performance.duration : 15000,
      selection: null,
      cameraMode: 'auto',
      freeCam: { theta: 0.9, phi: 0.45, dist: 22, target: [0, 2, 0] },
      rehearsal: {
        wind: { x: 0, y: 0, z: 0 },
        heading: 0,
        fault: 'none',
        running: false
      },
      flight: null,
      controller: null,
      recorder: null
    };

    const win = this.context.createWindow({
      appId: 'player',
      title: '三维播放器 — ' + (sceneData.name || '场景'),
      icon: 'player',
      w: 920, h: 640,
      onResize: (w, h) => this._onResize(state, w, h),
      onClose: () => {
        this._stopAll(state);
        return true;
      }
    });
    state.win = win;
    this._render(win.body, state, win);
    this.instances.set(win.id, state);

    // expose for bench
    this.context.playerInfo = {
      windowId: win.id,
      systemId: this.context.systemId || 'outer',
      state: 'paused',
      position: 0,
      duration: state.duration,
      rate: 1,
      scene: scenePath,
      frameTime: 0
    };
    return win;
  }

  _render(body, state, win) {
    body.innerHTML = '';
    const app = el('div', {
      class: 'app-root player-wrap',
      'data-app-id': 'player', 'data-system-id': this.context.systemId || 'outer',
      'data-window-id': win.id
    });

    const viewport = el('div', { class: 'player-viewport', 'data-testid': 'player-view' });
    const canvasHost = el('div', { style: 'position:absolute;inset:0' });
    viewport.appendChild(canvasHost);

    const info = el('div', { class: 'player-info' });
    viewport.appendChild(info);

    const selection = el('div', {
      class: 'player-selection', 'data-testid': 'player-selection',
      style: 'display:none'
    });
    viewport.appendChild(selection);

    // controls
    const controls = el('div', { class: 'player-controls' });
    const progressRow = el('div', { class: 'player-progress-row' });
    const progress = el('div', { class: 'player-progress' });
    const fill = el('div', { class: 'fill' });
    const thumb = el('div', { class: 'thumb' });
    progress.appendChild(fill);
    progress.appendChild(thumb);
    const timeLabel = el('div', { class: 'player-time', 'data-testid': 'player-time', text: '0:00.0 / 0:15.0' });
    progressRow.appendChild(progress);
    progressRow.appendChild(timeLabel);

    const btnRow = el('div', { class: 'player-btn-row' });
    const playBtn = el('div', { class: 'player-btn primary', 'data-testid': 'player-play', title: '播放', text: '▶' });
    const pauseBtn = el('div', { class: 'player-btn', 'data-testid': 'player-pause', title: '暂停', text: '⏸' });
    const stopBtn = el('div', { class: 'player-btn', 'data-testid': 'player-stop', title: '停止', text: '⏹' });
    const stepBtn = el('div', { class: 'player-btn', 'data-testid': 'player-step', title: '下一帧', text: '⏭' });
    const loopBtn = el('div', { class: 'player-btn', 'data-testid': 'player-loop', title: '循环', text: '🔁' });
    const rateSel = el('select', { class: 'player-select', 'data-testid': 'player-rate' });
    for (const r of [0.25, 0.5, 1, 1.5, 2, 4]) {
      rateSel.appendChild(el('option', { value: String(r), text: r + '×', 'data-value': String(r) }));
    }
    const camSel = el('select', { class: 'player-select', 'data-testid': 'player-camera' });
    for (const c of [
      { v: 'auto', t: '演出镜头' },
      { v: 'chase', t: '跟随镜头' },
      { v: 'free', t: '自由环绕' },
      { v: 'showcase', t: '展示机位' }
    ]) {
      camSel.appendChild(el('option', { value: c.v, text: c.t, 'data-value': c.v }));
    }
    const seekInput = el('input', {
      type: 'text', 'data-testid': 'player-seek', placeholder: '跳转秒数',
      style: 'width:80px', class: 'input'
    });
    const openBtn = el('div', { class: 'player-btn', 'data-testid': 'player-open', title: '打开场景', text: '📂' });
    const projectBtn = el('div', {
      class: 'player-btn', 'data-testid': 'window-project', title: '投送到桌面', text: '📤'
    });

    btnRow.appendChild(playBtn);
    btnRow.appendChild(pauseBtn);
    btnRow.appendChild(stopBtn);
    btnRow.appendChild(stepBtn);
    btnRow.appendChild(loopBtn);
    btnRow.appendChild(el('span', { text: '速率', style: 'font-size:11px;color:var(--text-dim)' }));
    btnRow.appendChild(rateSel);
    btnRow.appendChild(el('span', { text: '镜头', style: 'font-size:11px;color:var(--text-dim)' }));
    btnRow.appendChild(camSel);
    btnRow.appendChild(seekInput);
    btnRow.appendChild(openBtn);
    btnRow.appendChild(projectBtn);

    controls.appendChild(progressRow);
    controls.appendChild(btnRow);

    // rehearsal panel
    const rehearsal = el('div', { class: 'rehearsal-panel', style: 'display:none' });
    const rh1 = el('div', { class: 'rehearsal-row' }, [
      el('label', { text: '风向 X' }),
      el('input', {
        type: 'range', min: '-20', max: '20', value: '0', 'data-testid': 'rehearsal-wind',
        oninput: (e) => {
          state.rehearsal.wind.x = parseFloat(e.target.value);
          if (state.flight) state.flight.setWind(state.rehearsal.wind);
        }
      }),
      el('label', { text: '目标航向' }),
      el('input', {
        type: 'range', min: '-180', max: '180', value: '0', 'data-testid': 'rehearsal-heading',
        oninput: (e) => {
          state.rehearsal.heading = parseFloat(e.target.value);
          if (state.controller && state.controller.setGlobal) {
            state.controller.setGlobal('targetHeading', state.rehearsal.heading);
          }
        }
      })
    ]);
    const rh2 = el('div', { class: 'rehearsal-row' }, [
      el('label', { text: '故障' }),
      (() => {
        const sel = el('select', { 'data-testid': 'rehearsal-fault' });
        for (const f of state.scene.rehearsal.faultPresets) {
          sel.appendChild(el('option', { value: f.id, text: f.name, 'data-value': f.id }));
        }
        sel.addEventListener('change', () => {
          state.rehearsal.fault = sel.value;
          if (state.flight) {
            const fp = state.scene.rehearsal.faultPresets.find(x => x.id === sel.value);
            state.flight.setFault(fp && fp.effect ? fp.effect : {});
          }
        });
        return sel;
      })(),
      el('button', {
        class: 'btn primary', 'data-testid': 'rehearsal-start', text: '开始排演',
        onclick: () => this._startRehearsal(state)
      }),
      el('button', {
        class: 'btn', 'data-testid': 'rehearsal-controller', text: '查看飞控程序',
        onclick: () => {
          if (this.context.openEditor) {
            this.context.openEditor('/System/Programs/flightctl.ks');
          }
        }
      }),
      el('button', {
        class: 'btn', text: '保存记录',
        onclick: () => this._saveRecording(state)
      }),
      el('button', {
        class: 'btn', text: '转为演出回放',
        onclick: () => this._toReplay(state)
      })
    ]);
    rehearsal.appendChild(rh1);
    rehearsal.appendChild(rh2);

    const modeRow = el('div', { class: 'player-btn-row', style: 'padding:0 14px 10px' }, [
      el('button', {
        class: 'btn primary', text: '默认演出',
        onclick: () => this._setMode(state, 'performance')
      }),
      el('button', {
        class: 'btn', text: '飞行排演',
        onclick: () => this._setMode(state, 'rehearsal')
      })
    ]);

    app.appendChild(viewport);
    app.appendChild(controls);
    app.appendChild(modeRow);
    app.appendChild(rehearsal);
    body.appendChild(app);

    state._els = { viewport, canvasHost, info, selection, fill, thumb, timeLabel, rehearsal, playBtn, pauseBtn, loopBtn, camSel, rateSel };

    // 3D device
    state.scene3d = new Scene3D(canvasHost, this.context);
    setTimeout(() => {
      const w = viewport.clientWidth || 800;
      const h = viewport.clientHeight || 400;
      state.scene3d.resize(w, h);
      this._renderFrame(state);
    }, 30);

    // controls
    playBtn.addEventListener('click', () => {
      if (state.mode === 'rehearsal') this._startRehearsal(state);
      else {
        state.playing = true;
        this._syncControls(state);
      }
    });
    pauseBtn.addEventListener('click', () => {
      state.playing = false;
      if (state.rehearsal) state.rehearsal.running = false;
      this._syncControls(state);
    });
    stopBtn.addEventListener('click', () => {
      state.playing = false;
      state.position = 0;
      if (state.flight) {
        state.flight = null;
      }
      state.rehearsal.running = false;
      this._renderFrame(state);
      this._syncControls(state);
    });
    stepBtn.addEventListener('click', () => {
      state.playing = false;
      state.position = Math.min(state.duration, state.position + state.frameTime * 1000);
      this._renderFrame(state);
      this._syncControls(state);
    });
    loopBtn.addEventListener('click', () => {
      state.loop = !state.loop;
      loopBtn.style.background = state.loop ? 'var(--accent)' : 'rgba(255,255,255,0.08)';
    });
    rateSel.addEventListener('change', () => {
      state.rate = parseFloat(rateSel.value);
      this._syncControls(state);
    });
    camSel.addEventListener('change', () => {
      state.cameraMode = camSel.value;
      this._renderFrame(state);
    });
    seekInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = parseFloat(seekInput.value);
        if (!isNaN(v)) {
          state.position = Math.max(0, Math.min(state.duration, v * 1000));
          this._renderFrame(state);
          this._syncControls(state);
        }
      }
    });
    progress.addEventListener('click', (e) => {
      const r = progress.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width;
      state.position = u * state.duration;
      this._renderFrame(state);
      this._syncControls(state);
    });
    openBtn.addEventListener('click', () => {
      // open another scene from vfs
      const path = prompt('场景文件路径', '/Demo/helicopter-24.scene');
      if (!path) return;
      try {
        const raw = this.context.vfs.read(path);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        state.scene = data;
        state.scenePath = path;
        state.duration = data.performance ? data.performance.duration : 15000;
        state.position = 0;
        this._renderFrame(state);
        this.context.notify('已打开场景', path);
      } catch (e) {
        this.context.toast('打开失败', e.message, 'bad');
      }
    });
    projectBtn.addEventListener('click', () => {
      if (this.context.requestProjection) {
        this.context.requestProjection(win.id, 'player');
      } else {
        this.context.toast('投送', '请选择目标桌面', 'warn');
      }
    });

    // free camera drag
    viewport.addEventListener('mousedown', (e) => {
      if (state.cameraMode !== 'free') return;
      const sx = e.clientX, sy = e.clientY;
      const st = { ...state.freeCam };
      const mv = (ev) => {
        state.freeCam.theta = st.theta + (ev.clientX - sx) * 0.008;
        state.freeCam.phi = Math.max(0.1, Math.min(1.4, st.phi + (ev.clientY - sy) * 0.006));
        this._renderFrame(state);
      };
      const mu = () => {
        window.removeEventListener('mousemove', mv);
        window.removeEventListener('mouseup', mu);
      };
      window.addEventListener('mousemove', mv);
      window.addEventListener('mouseup', mu);
    });
    viewport.addEventListener('wheel', (e) => {
      if (state.cameraMode !== 'free') return;
      state.freeCam.dist = Math.max(6, Math.min(80, state.freeCam.dist + e.deltaY * 0.02));
      this._renderFrame(state);
      e.preventDefault();
    }, { passive: false });

    // click to select part / set heading
    viewport.addEventListener('click', (e) => {
      const r = viewport.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (state.mode === 'rehearsal' && state.flight) {
        // map screen to ground plane heading
        const heading = Math.atan2(x - 0.5, y - 0.3) * 180 / Math.PI;
        state.rehearsal.heading = heading;
        if (state.controller && state.controller.setGlobal) state.controller.setGlobal('targetHeading', heading);
        state.selection.style.display = 'block';
        state.selection.innerHTML = `目标航向: ${heading.toFixed(1)}°`;
      } else {
        // part selection (simple: pick by proximity)
        const names = ['fuselage', 'rotor', 'tail-rotor', 'skid-l', 'cockpit', 'engine'];
        const name = names[Math.floor(x * names.length)] || 'fuselage';
        const dmg = state._lastState && state._lastState.damage ? (state._lastState.damage[name] || 0) : 0;
        state.selection.style.display = 'block';
        state.selection.innerHTML = `<b>${partName(name)}</b><br>损坏: ${(dmg * 100).toFixed(0)}%`;
      }
    });

    this._startLoop(state);
    this._syncControls(state);
  }

  _setMode(state, mode) {
    state.mode = mode;
    state.playing = false;
    if (mode === 'rehearsal') {
      state._els.rehearsal.style.display = 'flex';
      if (!state.flight) {
        state.flight = new FlightModel(state.scene);
      }
    } else {
      state._els.rehearsal.style.display = 'none';
      state.flight = null;
      state.position = 0;
    }
    this._renderFrame(state);
    this._syncControls(state);
  }

  _startRehearsal(state) {
    if (state.mode !== 'rehearsal') this._setMode(state, 'rehearsal');
    if (!state.flight) state.flight = new FlightModel(state.scene);
    state.flight.setWind(state.rehearsal.wind);
    const fp = state.scene.rehearsal.faultPresets.find(x => x.id === state.rehearsal.fault);
    state.flight.setFault(fp && fp.effect ? fp.effect : {});
    state.rehearsal.running = true;
    state.playing = true;
    // start flight controller program
    this._startController(state);
    this._syncControls(state);
    this.context.notify('排演已开始', '飞控程序已启动');
  }

  _startController(state) {
    if (state.controller) {
      try { state.controller.running = false; } catch (e) { }
    }
    let src;
    try {
      src = this.context.vfs.readText('/System/Programs/flightctl.ks');
    } catch (e) {
      src = null;
    }
    if (!src) {
      // minimal inline controller
      src = `
        while (true) {
          let s = sys.sensor();
          let altErr = 30 - s.alt;
          let collective = 0.55 + altErr * 0.02 - s.vy * 0.06;
          if (collective > 1) { collective = 1; }
          if (collective < 0.15) { collective = 0.15; }
          let pitchCmd = (0 - s.pitch) * 0.6 - s.vx * 0.02;
          let rollCmd = (0 - s.roll) * 0.6;
          let yawCmd = (0 - s.yaw) * 0.02;
          sys.control(collective, pitchCmd, rollCmd, yawCmd);
          sys.wait(50);
        }
      `;
    }
    const flight = state.flight;
    const interp = new Interp({
      sys: {
        sensor: () => {
          const s = flight.state;
          return {
            pitch: s.rot[0], roll: s.rot[2], yaw: s.rot[1],
            alt: s.pos[1], vx: s.vel[0], vy: s.vel[1], vz: s.vel[2],
            time: flight.time
          };
        },
        control: (collective, pitch, roll, yaw) => {
          flight.applyControl({ collective, pitch, roll, yaw });
          return true;
        },
        wait: (ms) => ({ ksSuspend: true, type: 'wait', ms }),
        time: () => (flight ? flight.time * 1000 : 0),
        log: (...a) => console.log('[flightctl]', ...a)
      }
    });
    let ast;
    try { ast = parse(src); } catch (e) {
      this.context.toast('飞控程序编译错误', e.message, 'bad');
      return;
    }
    interp.start(ast);
    state.controller = { interp, running: true };
  }

  _saveRecording(state) {
    if (!state.flight) {
      this.context.toast('无排演数据', '请先进行飞行排演', 'warn');
      return;
    }
    const rec = state.flight.exportRecording(state.scene.name);
    const name = '/Documents/排演记录-' + Date.now().toString(36) + '.rec';
    try {
      this.context.vfs.write(name, rec);
      this.context.notify('排演记录已保存', name);
    } catch (e) {
      this.context.toast('保存失败', e.message, 'bad');
    }
  }

  _toReplay(state) {
    if (!state.flight || !state.flight.history.length) {
      this.context.toast('无排演数据', '请先进行飞行排演', 'warn');
      return;
    }
    const rec = state.flight.exportRecording(state.scene.name);
    state.mode = 'replay';
    state.replayData = rec;
    state.duration = rec.duration;
    state.position = 0;
    state.playing = true;
    state.flight = null;
    state.rehearsal.running = false;
    this._syncControls(state);
    this.context.notify('已转为回放', '可拖动进度查看任意时刻');
  }

  _startLoop(state) {
    let last = performance.now();
    const tick = () => {
      if (!state._els || !document.body.contains(state._els.viewport)) {
        state.dead = true;
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      // advance based on owning system time rate
      const sysRate = this.context.rate ? this.context.rate() : 1;
      const sysRunning = this.context.state ? this.context.state() === 'running' : true;

      if (state.mode === 'performance' && state.playing && sysRunning) {
        state.position += dt * 1000 * state.rate * sysRate;
        if (state.position >= state.duration) {
          if (state.loop) state.position = 0;
          else { state.position = state.duration; state.playing = false; }
        }
        this._renderFrame(state);
        this._syncControls(state);
      } else if (state.mode === 'rehearsal' && state.rehearsal.running && sysRunning) {
        // step flight physics
        const steps = Math.max(1, Math.floor(dt * 60 * state.rate));
        for (let i = 0; i < steps; i++) {
          state.flight.step(1 / 60);
        }
        // drive controller (budget-limited)
        if (state.controller && state.controller.running) {
          const r = state.controller.interp.run(2000);
          if (r.status === 'suspend' && r.suspend && r.suspend.type === 'wait') {
            // schedule next run after virtual wait
            const waitMs = r.suspend.ms || 50;
            setTimeout(() => {
              if (state.controller && state.controller.running) {
                const r2 = state.controller.interp.run(2000);
                this._handleCtlResult(state, r2);
              }
            }, Math.min(200, waitMs * (1 / Math.max(0.1, state.rate))));
          } else {
            this._handleCtlResult(state, r);
          }
        }
        state.position = state.flight.time * 1000;
        this._renderFrame(state);
        this._syncControls(state);
      } else if (state.mode === 'replay' && state.playing && sysRunning) {
        state.position += dt * 1000 * state.rate;
        if (state.position >= state.duration) {
          if (state.loop) state.position = 0;
          else { state.position = state.duration; state.playing = false; }
        }
        this._renderFrame(state);
        this._syncControls(state);
      }

      // update bench info
      if (this.context.playerInfo) {
        this.context.playerInfo.state = state.playing ? 'playing' : 'paused';
        this.context.playerInfo.position = +(state.position / 1000).toFixed(2);
        this.context.playerInfo.duration = +(state.duration / 1000).toFixed(2);
        this.context.playerInfo.rate = state.rate;
        this.context.playerInfo.frameTime = +(state.position / 1000).toFixed(3);
        this.context.playerInfo.scene = state.scenePath;
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _handleCtlResult(state, r) {
    if (r.status === 'error' && state.controller) {
      state.controller.running = false;
      this.context.toast('飞控程序错误', r.error, 'bad');
    }
  }

  _renderFrame(state) {
    if (!state.scene3d) return;
    let st;
    if (state.mode === 'performance') {
      st = evalPerformance(state.scene, state.position);
    } else if (state.mode === 'rehearsal' && state.flight) {
      st = state.flight.displayState();
      // camera follows actual flight
      st.camera = 'chase';
    } else if (state.mode === 'replay' && state.replayData) {
      st = FlightModel.sampleRecording(state.replayData, state.position);
      if (!st) return;
    } else {
      st = evalPerformance(state.scene, state.position);
    }
    state._lastState = st;

    // camera override
    if (state.cameraMode === 'free') {
      const fc = state.freeCam;
      const t = fc.target;
      const cam = {
        pos: [
          t[0] + fc.dist * Math.sin(fc.theta) * Math.cos(fc.phi),
          t[1] + fc.dist * Math.sin(fc.phi),
          t[2] + fc.dist * Math.cos(fc.theta) * Math.cos(fc.phi)
        ],
        lookAt: t,
        fov: 48
      };
      const sub = buildSceneSubmission(state.scene, st);
      sub.camera = cam;
      state.scene3d.submit('main', sub);
    } else if (state.cameraMode === 'showcase') {
      const sub = buildSceneSubmission(state.scene, st);
      sub.camera = { pos: [7, 3.2, 9], lookAt: [st.pos[0], st.pos[1] + 1.5, st.pos[2]], fov: 42 };
      state.scene3d.submit('main', sub);
    } else if (state.cameraMode === 'chase') {
      const sub = buildSceneSubmission(state.scene, st);
      const cy = Math.cos(st.rot[1]), sy = Math.sin(st.rot[1]);
      const off = [-6, 3.5, -9];
      sub.camera = {
        pos: [
          st.pos[0] + off[0] * cy + off[2] * sy,
          st.pos[1] + off[1],
          st.pos[2] - off[0] * sy + off[2] * cy
        ],
        lookAt: [st.pos[0], st.pos[1] + 0.8, st.pos[2]],
        fov: 50
      };
      state.scene3d.submit('main', sub);
    } else {
      const sub = buildSceneSubmission(state.scene, st);
      state.scene3d.submit('main', sub);
    }

    // info text
    const els = state._els;
    if (els && els.info) {
      els.info.innerHTML =
        `场景: ${state.scene.name || '未知'}<br>` +
        `时刻: ${(state.position / 1000).toFixed(2)}s / ${(state.duration / 1000).toFixed(2)}s<br>` +
        `状态: ${state.playing ? '播放中' : '已暂停'} · 速率 ${state.rate}×`;
    }
  }

  _syncControls(state) {
    const els = state._els;
    if (!els) return;
    const u = state.duration ? state.position / state.duration : 0;
    els.fill.style.width = (u * 100) + '%';
    els.thumb.style.left = (u * 100) + '%';
    els.timeLabel.textContent = `${fmtTime(state.position)} / ${fmtTime(state.duration)}`;
    els.playBtn.classList.toggle('primary', !state.playing);
    els.pauseBtn.classList.toggle('primary', state.playing);
  }

  _onResize(state, w, h) {
    if (state.scene3d && state._els) {
      const vw = state._els.viewport.clientWidth;
      const vh = state._els.viewport.clientHeight;
      state.scene3d.resize(vw, vh);
      this._renderFrame(state);
    }
  }

  _stopAll(state) {
    state.playing = false;
    state.rehearsal.running = false;
    if (state.controller) state.controller.running = false;
    state.dead = true;
  }
}

function partName(id) {
  const map = {
    fuselage: '机身', rotor: '主旋翼', 'tail-rotor': '尾桨',
    'skid-l': '起落撬', cockpit: '座舱', engine: '发动机',
    boom: '尾梁', nose: '机头'
  };
  return map[id] || id;
}
