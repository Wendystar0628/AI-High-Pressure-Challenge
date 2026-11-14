import { render2DChartCanvas } from '../graphics/display-device.js';

export function localCoords(el, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  const cw = el.clientWidth || el.offsetWidth || rect.width || 1;
  const ch = el.clientHeight || el.offsetHeight || rect.height || 1;
  const rw = rect.width || cw || 1;
  const rh = rect.height || ch || 1;
  return {
    x: (clientX - rect.left) * (cw / rw),
    y: (clientY - rect.top) * (ch / rh),
    normX: Math.max(0, Math.min(1, (clientX - rect.left) / rw)),
    normY: Math.max(0, Math.min(1, (clientY - rect.top) / rh))
  };
}

function setAttrs(el, sysId, winId, testId, ariaLabel) {
  if (testId) el.dataset.testid = testId;
  if (sysId) el.dataset.systemId = sysId;
  if (winId) el.dataset.windowId = winId;
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  return el;
}

// ============================================================================
// Reusable 3D Scene Player Surface View (Source Window & Projection Window)
// ============================================================================

export class PlayerSurfaceView {
  constructor({ sysId, winId, viewKey, displayDevice, sendEvent, compact = false }) {
    this.sysId = sysId;
    this.winId = winId;
    this.viewKey = viewKey;
    this.displayDevice = displayDevice;
    this.sendEvent = sendEvent;
    this.compact = compact;
    this.isScrubbing = false;
    this.lastSceneOptSig = '';
    this.lastCtrlOptSig = '';

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();
  }

  buildDom() {
    // 1. 3D Viewport Area
    const vpWrap = document.createElement('div');
    vpWrap.className = 'player-viewport-wrap';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'player-canvas';
    setAttrs(this.canvas, this.sysId, this.winId, 'player-view', '三维场景视图');
    vpWrap.appendChild(this.canvas);

    const hudTop = document.createElement('div');
    hudTop.className = 'player-hud-top';
    this.statusPill = document.createElement('div');
    this.statusPill.className = 'player-hud-pill';
    this.statusPill.textContent = '就绪';
    this.telemetryPill = document.createElement('div');
    this.telemetryPill.className = 'player-hud-pill';
    this.telemetryPill.style.fontFamily = 'var(--font-mono)';
    this.telemetryPill.textContent = 'H1 待命';
    hudTop.append(this.statusPill, this.telemetryPill);
    vpWrap.appendChild(hudTop);

    this.selectionBar = document.createElement('div');
    this.selectionBar.className = 'player-selection-bar';
    setAttrs(this.selectionBar, this.sysId, this.winId, 'player-selection', '三维点选结果');
    this.selectionBar.textContent = '点击机体部件查看状态；排演中点击地面设定航向';
    vpWrap.appendChild(this.selectionBar);

    this.bindViewportPointerEvents();
    this.el.appendChild(vpWrap);

    // 2. Controls Panel
    const panel = document.createElement('div');
    panel.className = 'player-controls-panel';

    // Row 1: Scene open + Playback transport + Seek + Time + Rate + Camera
    const r1 = document.createElement('div');
    r1.className = 'player-row';

    this.sceneSelect = document.createElement('select');
    this.sceneSelect.className = 'sel sel-sm';
    this.sceneSelect.style.maxWidth = '152px';
    setAttrs(this.sceneSelect, this.sysId, this.winId, 'player-open', '选择并打开场景资源');
    this.sceneSelect.addEventListener('change', () => {
      this.sendEvent({ action: 'open_scene', path: this.sceneSelect.value });
    });

    this.btnPlay = this.makeBtn('▶ 播放', 'player-play', '播放场景', 'btn btn-sm btn-primary', () => {
      this.sendEvent({ action: 'play' });
    });
    this.btnPause = this.makeBtn('⏸ 暂停', 'player-pause', '暂停播放', 'btn btn-sm', () => {
      this.sendEvent({ action: 'pause' });
    });
    this.btnStop = this.makeBtn('⏹ 停止', 'player-stop', '停止并回到第0帧', 'btn btn-sm', () => {
      this.sendEvent({ action: 'stop' });
    });
    this.btnStep = this.makeBtn('⏭ 单步', 'player-step', '单步推进一帧', 'btn btn-sm', () => {
      this.sendEvent({ action: 'step' });
    });
    this.btnLoop = this.makeBtn('🔁 循环', 'player-loop', '切换循环播放', 'btn btn-sm', () => {
      this.sendEvent({ action: 'toggle_loop' });
    });

    this.seekSlider = document.createElement('input');
    this.seekSlider.type = 'range';
    this.seekSlider.className = 'player-seek-slider';
    this.seekSlider.min = '0';
    this.seekSlider.max = '15';
    this.seekSlider.step = '0.05';
    this.seekSlider.value = '0';
    setAttrs(this.seekSlider, this.sysId, this.winId, 'player-seek', '播放进度跳转');
    this.seekSlider.addEventListener('pointerdown', () => {
      this.isScrubbing = true;
    });
    const finishScrub = () => {
      if (this.isScrubbing) {
        this.isScrubbing = false;
        this.sendEvent({ action: 'seek', time: Number(this.seekSlider.value) });
      }
    };
    this.seekSlider.addEventListener('pointerup', finishScrub);
    this.seekSlider.addEventListener('change', () => {
      this.isScrubbing = false;
      this.sendEvent({ action: 'seek', time: Number(this.seekSlider.value) });
    });
    this.seekSlider.addEventListener('input', () => {
      this.sendEvent({ action: 'seek', time: Number(this.seekSlider.value) });
    });

    this.timeLabel = document.createElement('span');
    this.timeLabel.style.cssText = 'font-family:var(--font-mono);font-size:11px;color:#fde047;min-width:86px;text-align:right;';
    setAttrs(this.timeLabel, this.sysId, this.winId, 'player-time', '当前播放时间');
    this.timeLabel.textContent = '0.00 / 15.00s';

    this.rateSelect = document.createElement('select');
    this.rateSelect.className = 'sel sel-sm';
    setAttrs(this.rateSelect, this.sysId, this.winId, 'player-rate', '播放倍速');
    for (const r of [0.25, 0.5, 1, 1.5, 2, 4]) {
      const opt = document.createElement('option');
      opt.value = String(r);
      opt.textContent = `${r}x`;
      if (r === 1) opt.selected = true;
      this.rateSelect.appendChild(opt);
    }
    this.rateSelect.addEventListener('change', () => {
      this.sendEvent({ action: 'set_rate', rate: Number(this.rateSelect.value) });
    });

    this.camSelect = document.createElement('select');
    this.camSelect.className = 'sel sel-sm';
    setAttrs(this.camSelect, this.sysId, this.winId, 'player-camera', '切换机位镜头');
    for (const [val, lbl] of [
      ['show', '演出机位'],
      ['follow', '尾随跟拍'],
      ['orbit', '自由环绕']
    ]) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = lbl;
      this.camSelect.appendChild(opt);
    }
    this.camSelect.addEventListener('change', () => {
      this.sendEvent({ action: 'set_camera', mode: this.camSelect.value });
    });

    r1.append(
      this.sceneSelect,
      this.btnPlay,
      this.btnPause,
      this.btnStop,
      this.btnStep,
      this.btnLoop,
      this.seekSlider,
      this.timeLabel,
      this.rateSelect,
      this.camSelect
    );
    panel.appendChild(r1);

    // Row 2: Closed-Loop Flight Rehearsal Controls
    this.rehRow = document.createElement('div');
    this.rehRow.className = 'player-row';

    this.btnRehearsal = this.makeBtn('🚁 闭环排演', 'rehearsal-start', '启动闭环飞行排演', 'btn btn-sm btn-gold', () => {
      this.sendEvent({ action: 'rehearsal_start' });
    });

    this.btnLandH2 = this.makeBtn('🎯 飞往H2降落', null, '自动驾驶前往第二停机坪H2悬停降落', 'btn btn-sm', () => {
      this.sendEvent({ action: 'rehearsal_land_h2' });
    });

    const windLbl = document.createElement('span');
    windLbl.style.cssText = 'font-size:11px;color:#94a3b8;';
    windLbl.textContent = '风速:';
    this.inpWind = document.createElement('input');
    this.inpWind.type = 'number';
    this.inpWind.step = '1';
    this.inpWind.value = '0';
    this.inpWind.className = 'inp inp-sm';
    this.inpWind.style.width = '50px';
    setAttrs(this.inpWind, this.sysId, this.winId, 'rehearsal-wind', '环境风速输入');
    this.inpWind.addEventListener('change', () => {
      this.sendEvent({ action: 'rehearsal_set_wind', windX: Number(this.inpWind.value || 0) });
    });

    const hdgLbl = document.createElement('span');
    hdgLbl.style.cssText = 'font-size:11px;color:#94a3b8;';
    hdgLbl.textContent = '航向°:';
    this.inpHeading = document.createElement('input');
    this.inpHeading.type = 'number';
    this.inpHeading.step = '15';
    this.inpHeading.value = '45';
    this.inpHeading.className = 'inp inp-sm';
    this.inpHeading.style.width = '54px';
    setAttrs(this.inpHeading, this.sysId, this.winId, 'rehearsal-heading', '目标航向角');
    this.inpHeading.addEventListener('change', () => {
      this.sendEvent({ action: 'rehearsal_set_heading', heading: Number(this.inpHeading.value || 0) });
    });

    this.btnFault = this.makeBtn('⚡ 尾桨故障', 'rehearsal-fault', '立即触发尾桨失效故障', 'btn btn-sm btn-danger', () => {
      this.sendEvent({ action: 'rehearsal_set_fault', immediate: true });
    });

    this.ctrlSelect = document.createElement('select');
    this.ctrlSelect.className = 'sel sel-sm';
    this.ctrlSelect.style.maxWidth = '132px';
    setAttrs(this.ctrlSelect, this.sysId, this.winId, 'rehearsal-controller', '选择飞控程序');
    this.ctrlSelect.addEventListener('change', () => {
      this.sendEvent({ action: 'rehearsal_set_controller', path: this.ctrlSelect.value });
    });

    this.btnSaveRec = this.makeBtn('💾 保存记录', null, '保存排演记录文件', 'btn btn-sm', () => {
      const ts = Math.floor((this.lastPosition || 0) * 10);
      this.sendEvent({ action: 'save_record', path: `/Documents/rehearsal-${ts}.rec` });
    });

    this.rehRow.append(
      this.btnRehearsal,
      this.btnLandH2,
      windLbl,
      this.inpWind,
      hdgLbl,
      this.inpHeading,
      this.btnFault,
      this.ctrlSelect,
      this.btnSaveRec
    );
    panel.appendChild(this.rehRow);

    this.el.appendChild(panel);

    this.interactiveControls = [
      this.sceneSelect,
      this.btnPlay,
      this.btnPause,
      this.btnStop,
      this.btnStep,
      this.btnLoop,
      this.seekSlider,
      this.rateSelect,
      this.camSelect,
      this.btnRehearsal,
      this.btnLandH2,
      this.inpWind,
      this.inpHeading,
      this.btnFault,
      this.ctrlSelect,
      this.btnSaveRec
    ];
  }

  makeBtn(label, testId, ariaLabel, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    setAttrs(b, this.sysId, this.winId, testId, ariaLabel);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  bindViewportPointerEvents() {
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.disabled) return;
      dragging = true;
      moved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!dragging || this.disabled) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.hypot(dx, dy) > 3) {
        moved = true;
        lastX = e.clientX;
        lastY = e.clientY;
        this.sendEvent({ action: 'orbit_drag', dx, dy });
      }
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
      if (!moved && !this.disabled) {
        const pt = localCoords(this.canvas, e.clientX, e.clientY);
        const hit = this.displayDevice.pick3DViewport(this.viewKey, pt.normX, pt.normY);
        if (hit) {
          this.sendEvent({
            action: 'pick_object',
            kind: hit.kind,
            partId: hit.partId,
            label: hit.label,
            point: hit.point
          });
        }
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.disabled) return;
        e.preventDefault();
        this.sendEvent({ action: 'orbit_zoom', delta: e.deltaY });
      },
      { passive: false }
    );
  }

  update(surface, { disabled = false } = {}) {
    this.disabled = disabled;
    for (const c of this.interactiveControls) {
      if (c.disabled !== disabled) c.disabled = disabled;
    }
    if (!surface) return;

    this.lastPosition = Number(surface.position || 0);
    const dur = Math.max(0.1, Number(surface.duration || 15));
    const timeStr = `${this.lastPosition.toFixed(2)} / ${dur.toFixed(2)}s`;
    if (this.timeLabel.textContent !== timeStr) {
      this.timeLabel.textContent = timeStr;
    }

    if (!this.isScrubbing && document.activeElement !== this.seekSlider) {
      this.seekSlider.max = String(dur);
      this.seekSlider.value = String(this.lastPosition);
    }

    const stLabel =
      surface.state === 'playing'
        ? '▶ 播放中'
        : surface.state === 'rehearsal'
          ? '🚁 闭环排演'
          : surface.state === 'stopped'
            ? '⏹ 已停止'
            : '⏸ 已暂停';
    const statusText = `${stLabel} · ${surface.statusText || ''}`;
    if (this.statusPill.textContent !== statusText) {
      this.statusPill.textContent = statusText;
    }

    if (surface.pose && surface.pose.craftSummary) {
      const cs = surface.pose.craftSummary;
      const alt = Number(cs.pos?.[1] || 0).toFixed(1);
      const rpm = Math.round(Number(cs.rotorRpm || 0) * 100);
      const tel = `高度 ${alt}m · 旋翼 ${rpm}% · 帧时刻 ${Number(surface.frameTime || 0).toFixed(2)}s`;
      if (this.telemetryPill.textContent !== tel) this.telemetryPill.textContent = tel;
    }

    if (surface.selectionText && this.selectionBar.textContent !== surface.selectionText) {
      this.selectionBar.textContent = surface.selectionText;
    }

    this.btnLoop.classList.toggle('btn-gold', Boolean(surface.loop));

    // Scene options
    const candidates = Array.isArray(surface.sceneCandidates) ? [...surface.sceneCandidates] : [];
    if (surface.scenePath && !candidates.includes(surface.scenePath)) {
      candidates.unshift(surface.scenePath);
    }
    const sceneSig = candidates.join('|');
    if (sceneSig !== this.lastSceneOptSig) {
      this.lastSceneOptSig = sceneSig;
      this.sceneSelect.innerHTML = '';
      for (const p of candidates) {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p.split('/').pop() + ` (${p})`;
        this.sceneSelect.appendChild(opt);
      }
    }
    if (document.activeElement !== this.sceneSelect && surface.scenePath) {
      this.sceneSelect.value = surface.scenePath;
    }

    // Controller options
    const ctrls = Array.isArray(surface.controllerCandidates) ? surface.controllerCandidates : ['/Apps/flight_ctrl.nos'];
    const ctrlSig = ctrls.join('|');
    if (ctrlSig !== this.lastCtrlOptSig) {
      this.lastCtrlOptSig = ctrlSig;
      this.ctrlSelect.innerHTML = '';
      for (const p of ctrls) {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p.split('/').pop();
        this.ctrlSelect.appendChild(opt);
      }
    }
    if (document.activeElement !== this.ctrlSelect && surface.controllerPath) {
      this.ctrlSelect.value = surface.controllerPath;
    }

    if (document.activeElement !== this.rateSelect && surface.rate !== undefined) {
      this.rateSelect.value = String(surface.rate);
    }
    if (document.activeElement !== this.camSelect && surface.cameraMode) {
      this.camSelect.value = surface.cameraMode;
    }
    if (surface.rehInputs) {
      if (document.activeElement !== this.inpWind) {
        this.inpWind.value = String(surface.rehInputs.windX ?? 0);
      }
      if (document.activeElement !== this.inpHeading) {
        this.inpHeading.value = String(surface.rehInputs.targetHeading ?? 45);
      }
    }

    this.displayDevice.render3DViewport(this.viewKey, this.canvas, surface);
  }

  destroy() {
    this.displayDevice.unregisterView(this.viewKey);
  }
}

// ============================================================================
// Reusable Live Chart Workbench Surface View (Source & Projection Window)
// ============================================================================

export class ChartSurfaceView {
  constructor({ sysId, winId, sendEvent }) {
    this.sysId = sysId;
    this.winId = winId;
    this.sendEvent = sendEvent;
    this.lastWbSig = '';

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();
  }

  buildDom() {
    const toolbar = document.createElement('div');
    toolbar.className = 'app-toolbar';

    this.srcSelect = document.createElement('select');
    this.srcSelect.className = 'sel sel-sm';
    this.srcSelect.style.minWidth = '126px';
    setAttrs(this.srcSelect, this.sysId, this.winId, 'chart-source', '选择根系统工作簿');
    this.srcSelect.addEventListener('focus', () => {
      this.sendEvent({ action: 'refresh_sources' });
    });
    this.srcSelect.addEventListener('change', () => {
      this.sendEvent({ action: 'set_source', docId: this.srcSelect.value });
    });

    this.inpRange = document.createElement('input');
    this.inpRange.type = 'text';
    this.inpRange.className = 'inp inp-sm';
    this.inpRange.style.width = '68px';
    this.inpRange.value = 'A1:D4';
    this.inpRange.placeholder = 'A1:D4';
    setAttrs(this.inpRange, this.sysId, this.winId, 'chart-range', '数据区域');
    this.inpRange.addEventListener('change', () => {
      this.sendEvent({ action: 'set_range', range: this.inpRange.value });
    });

    const lblTag = document.createElement('span');
    lblTag.style.cssText = 'font-size:11px;color:#94a3b8;';
    lblTag.textContent = '标签列:';
    this.inpLabelCol = document.createElement('input');
    this.inpLabelCol.type = 'text';
    this.inpLabelCol.className = 'inp inp-sm';
    this.inpLabelCol.style.width = '36px';
    this.inpLabelCol.value = 'A';
    setAttrs(this.inpLabelCol, this.sysId, this.winId, 'chart-label-column', '标签列');
    this.inpLabelCol.addEventListener('change', () => {
      this.sendEvent({ action: 'set_label_col', col: this.inpLabelCol.value });
    });

    const serTag = document.createElement('span');
    serTag.style.cssText = 'font-size:11px;color:#94a3b8;';
    serTag.textContent = '数值列:';
    this.inpSeries = document.createElement('input');
    this.inpSeries.type = 'text';
    this.inpSeries.className = 'inp inp-sm';
    this.inpSeries.style.width = '52px';
    this.inpSeries.value = 'D';
    setAttrs(this.inpSeries, this.sysId, this.winId, 'chart-series', '数值列');
    this.inpSeries.addEventListener('change', () => {
      this.sendEvent({ action: 'set_series_cols', cols: this.inpSeries.value });
    });

    this.btnConnect = document.createElement('button');
    this.btnConnect.type = 'button';
    this.btnConnect.className = 'btn btn-sm btn-primary';
    this.btnConnect.textContent = '连接';
    setAttrs(this.btnConnect, this.sysId, this.winId, 'chart-connect', '建立实时连接');
    this.btnConnect.addEventListener('click', () => {
      if (this.srcSelect.value) {
        this.sendEvent({ action: 'set_source', docId: this.srcSelect.value });
      }
      this.sendEvent({ action: 'set_range', range: this.inpRange.value });
      this.sendEvent({ action: 'set_label_col', col: this.inpLabelCol.value });
      this.sendEvent({ action: 'set_series_cols', cols: this.inpSeries.value });
      this.sendEvent({ action: 'connect' });
    });

    this.btnDisconnect = document.createElement('button');
    this.btnDisconnect.type = 'button';
    this.btnDisconnect.className = 'btn btn-sm';
    this.btnDisconnect.textContent = '断开';
    setAttrs(this.btnDisconnect, this.sysId, this.winId, 'chart-disconnect', '断开数据连接');
    this.btnDisconnect.addEventListener('click', () => {
      this.sendEvent({ action: 'disconnect' });
    });

    this.btnType = document.createElement('button');
    this.btnType.type = 'button';
    this.btnType.className = 'btn btn-sm btn-gold';
    this.btnType.textContent = '切换折线图';
    setAttrs(this.btnType, this.sysId, this.winId, 'chart-type', '切换柱状图与折线图');
    this.btnType.addEventListener('click', () => {
      this.sendEvent({ action: 'toggle_type' });
    });

    toolbar.append(
      this.srcSelect,
      this.inpRange,
      lblTag,
      this.inpLabelCol,
      serTag,
      this.inpSeries,
      this.btnConnect,
      this.btnDisconnect,
      this.btnType
    );
    this.el.appendChild(toolbar);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'chart-canvas-wrap';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'chart-canvas';
    canvasWrap.appendChild(this.canvas);
    this.el.appendChild(canvasWrap);

    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-statusbar';
    this.statusLeft = document.createElement('span');
    this.statusRight = document.createElement('span');
    this.statusRight.style.color = '#fde047';
    this.statusBar.append(this.statusLeft, this.statusRight);
    this.el.appendChild(this.statusBar);

    this.bindCanvasEvents();

    this.interactiveControls = [
      this.srcSelect,
      this.inpRange,
      this.inpLabelCol,
      this.inpSeries,
      this.btnConnect,
      this.btnDisconnect,
      this.btnType
    ];
  }

  bindCanvasEvents() {
    const hitPoint = (e) => {
      const meta = this.canvas.__chartHitRegions;
      if (!meta || !meta.regions) return null;
      const pt = localCoords(this.canvas, e.clientX, e.clientY);
      const vx = pt.normX * meta.viewW;
      const vy = pt.normY * meta.viewH;
      for (const r of meta.regions) {
        if (vx >= r.x && vx <= r.x + r.w && vy >= r.y && vy <= r.y + r.h) {
          return r.point;
        }
      }
      return null;
    };

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.disabled) return;
      const hp = hitPoint(e);
      const catIdx = hp ? hp.catIdx : -1;
      if (catIdx !== this.lastHoverIdx) {
        this.lastHoverIdx = catIdx;
        this.sendEvent({ action: 'hover_point', catIdx });
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.disabled) return;
      const hp = hitPoint(e);
      this.sendEvent({ action: 'select_point', point: hp });
    });
  }

  update(surface, { disabled = false, openWorkbooks = [] } = {}) {
    this.disabled = disabled;
    for (const c of this.interactiveControls) {
      if (c.disabled !== disabled) c.disabled = disabled;
    }
    if (!surface) return;

    // Merge live Root openWorkbooks with surface.workbooks so newly opened sheets are always selectable immediately
    const wbMap = new Map();
    for (const w of surface.workbooks || []) wbMap.set(w.docId, w);
    for (const w of openWorkbooks) wbMap.set(w.docId, w);
    const wbList = Array.from(wbMap.values());

    const wbSig = JSON.stringify(wbList);
    if (wbSig !== this.lastWbSig) {
      this.lastWbSig = wbSig;
      this.srcSelect.innerHTML = '';
      if (wbList.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(无已打开工作簿)';
        this.srcSelect.appendChild(opt);
      } else {
        for (const w of wbList) {
          const opt = document.createElement('option');
          opt.value = w.docId;
          opt.textContent = `${w.title} (${w.filePath})`;
          this.srcSelect.appendChild(opt);
        }
      }
    }

    if (document.activeElement !== this.srcSelect) {
      if (surface.selectedDocId && wbMap.has(surface.selectedDocId)) {
        this.srcSelect.value = surface.selectedDocId;
      } else if (wbList.length > 0 && !this.srcSelect.value) {
        this.srcSelect.value = wbList[0].docId;
      }
    }

    if (document.activeElement !== this.inpRange && surface.range) {
      this.inpRange.value = surface.range;
    }
    if (document.activeElement !== this.inpLabelCol && surface.labelCol) {
      this.inpLabelCol.value = surface.labelCol;
    }
    if (document.activeElement !== this.inpSeries && surface.seriesCols) {
      this.inpSeries.value = surface.seriesCols;
    }

    const typeLabel = surface.chartType === 'bar' ? '📊 柱状图 (切换折线)' : '📈 折线图 (切换柱状)';
    if (this.btnType.textContent !== typeLabel) {
      this.btnType.textContent = typeLabel;
    }

    if (this.statusLeft.textContent !== (surface.statusText || '')) {
      this.statusLeft.textContent = surface.statusText || '';
    }
    const selTxt = surface.selectedPoint
      ? `选中: ${surface.selectedPoint.label} · ${surface.selectedPoint.seriesName} = ${surface.selectedPoint.value}`
      : `连接状态: ${surface.connectionState}`;
    if (this.statusRight.textContent !== selTxt) {
      this.statusRight.textContent = selTxt;
    }

    render2DChartCanvas(this.canvas, surface);
  }

  destroy() {}
}

// ============================================================================
// Cross-Layer Projection Window Body Wrapper
// ============================================================================

export class ProjectionClientView {
  constructor({ projection, targetSysId, runtime, displayDevice }) {
    this.projKey = projection.projKey;
    this.targetSysId = targetSysId;
    this.winId = projection.projWinId;
    this.sourceSystemId = projection.sourceSystemId;
    this.sourceAppId = projection.sourceAppId;
    this.runtime = runtime;
    this.displayDevice = displayDevice;

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';

    this.pausedBanner = document.createElement('div');
    this.pausedBanner.className = 'paused-banner hidden';
    this.pausedBanner.textContent = '⏸ 源子系统或其祖先已暂停：投送画面已冻结，输入控件暂时禁用（恢复源系统后继续）';
    this.el.appendChild(this.pausedBanner);

    const forwardInput = (payload) => {
      this.runtime.sendProjectionInput(this.projKey, payload);
    };

    if (this.sourceAppId === 'player') {
      this.innerView = new PlayerSurfaceView({
        sysId: this.targetSysId,
        winId: this.winId,
        viewKey: `proj::${this.projKey}::${this.targetSysId}`,
        displayDevice: this.displayDevice,
        sendEvent: forwardInput
      });
    } else {
      this.innerView = new ChartSurfaceView({
        sysId: this.targetSysId,
        winId: this.winId,
        sendEvent: forwardInput
      });
    }
    this.el.appendChild(this.innerView.el);
  }

  update(projection) {
    const paused = this.runtime.isEffectivelyPaused(this.sourceSystemId);
    this.pausedBanner.classList.toggle('hidden', !paused);
    const openWbs = Array.from(this.runtime.openWorkbooks.values()).map((w) => ({
      docId: w.docId,
      title: w.title,
      filePath: w.filePath
    }));
    this.innerView.update(projection.surface, { disabled: paused, openWorkbooks: openWbs });
  }

  destroy() {
    if (this.innerView) this.innerView.destroy();
  }
}
