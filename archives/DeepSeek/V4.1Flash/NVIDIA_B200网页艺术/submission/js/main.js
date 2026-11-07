/* ==========================================================================
   B200 / DIE STUDY — scroll engine, interaction and video export
   ========================================================================== */
(function () {
  'use strict';
  const B = window.B200;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = B.clamp, lerp = B.lerp, smooth = B.smooth, ramp = B.ramp;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.__b200Errors = [];
  window.addEventListener('error', e => {
    window.__b200Errors.push(String(e.message || e.error));
    console.error('[B200]', e.message, e.error);
  });

  let world = null;
  let ui = null;
  let readyResolve;
  const ready = new Promise(res => { readyResolve = res; });
  let exportMode = false;
  let savedExportState = null;
  let savedScroll = 0;
  let bootDone = false;

  const orbit = { theta: 0, phi: 0, zoom: 1 };
  let pVisual = 0;
  let pTarget = 0;
  let elapsed = 0;
  let lastTs = 0;
  let lastVisualP = 0;
  let scrollSpeed = 0;
  let firstFrame = true;
  let hoverThrottle = 0;
  let lastPointer = null;

  function scrollMax() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }
  function progressForChapter(i, u) {
    const c = B.CHAPTERS[clamp(i, 0, 7)];
    return c.start + c.span * u;
  }
  function scrollToProgress(p, behavior) {
    p = clamp(p, 0, 1);
    const top = p * scrollMax();
    if (behavior === 'auto' || reduceMotion) window.scrollTo(0, top);
    else window.scrollTo({ top, behavior: 'smooth' });
  }
  function isOrbitChapter(p) {
    return p < .43 || p > .925;
  }
  function motionAt(p) {
    const bands = [[.09, .145], [.285, .335], [.405, .452], [.545, .602], [.700, .762], [.845, .900], [.918, .962]];
    for (const [a, b] of bands) if (p > a && p < b) return .62;
    return .14;
  }

  function init() {
    const canvas = $('#gl');
    const lensCanvas = $('#gl-lens');
    const boot = $('#boot');
    const bootNote = $('#boot-note');
    try {
      world = new B.World(canvas, lensCanvas);
      window.__world = world;
      world.resize(window.innerWidth, window.innerHeight);
    } catch (err) {
      console.error(err);
      bootNote.textContent = '无法初始化 WebGL：' + err.message;
      $('#gl-fallback').hidden = false;
      return;
    }
    // restore the state of the visit
    ui = new B.UI(world, {
      getOrbit: () => orbit,
      setOrbit: (o) => { orbit.theta = o.theta; orbit.phi = o.phi; orbit.zoom = o.zoom; },
      resetOrbit: () => { orbit.theta = 0; orbit.phi = 0; orbit.zoom = 1; },
      onNavigate: (target, i) => { scrollToProgress(target, 'smooth'); ui.closeDetailPanel(); },
      onPlatformStage: (stage) => {
        const c = B.CH.scale;
        const u = stage === 0 ? .14 : stage === 1 ? .36 : stage === 2 ? .54 : .82;
        scrollToProgress(c.start + c.span * u, 'smooth');
      },
      onSelectSystem: () => {},
      onRunToggle: () => {},
      onPrecision: () => {}
    });
    window.__ui = ui;
    ui.s.commPhase = 0;
    ui.s.shardPhase = 0;
    initPointer(canvas);
    initKeyboard(canvas);
    initResize();
    initScaleTabs();
    initMemoryScrub();
    initScrollRestore();
    // export API
    initExport(canvas);
    bootNote.textContent = '正在装配 2,088,000,000,000 个晶体管';
    // first frame then reveal
    requestAnimationFrame(loop);
    let first = true;
    const reveal = () => {
      if (first) {
        first = false;
        requestAnimationFrame(() => {
          world.resize(window.innerWidth, window.innerHeight);
          if (!bootDone) {
            bootDone = true;
            boot.classList.add('done');
            setTimeout(() => { boot.style.display = 'none'; }, 900);
            readyResolve && readyResolve();
            $('#gl').focus({ preventScroll: true });
          }
        });
      }
    };
    const readyCheck = setInterval(() => {
      if (world && ui && document.fonts && document.fonts.status) { clearInterval(readyCheck); reveal(); }
    }, 120);
    document.fonts && document.fonts.ready && document.fonts.ready.then(() => { clearInterval(readyCheck); reveal(); });
    setTimeout(reveal, 2200);
  }

  /* mouse interaction ------------------------------------------------------ */
  function initPointer(canvas) {
    let drag = null;
    canvas.addEventListener('pointerdown', e => {
      if (exportMode) return;
      canvas.focus({ preventScroll: true });
      const canOrbit = isOrbitChapter(pVisual);
      drag = {
        id: e.pointerId, x: e.clientX, y: e.clientY,
        moved: 0, canOrbit,
        theta: orbit.theta, phi: orbit.phi
      };
      try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (err) {}
      canvas.style.cursor = canOrbit ? 'grabbing' : 'default';
      e.preventDefault();
    });    canvas.addEventListener('pointermove', e => {
      if (exportMode) return;
      lastPointer = { x: e.clientX, y: e.clientY };
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
        if (drag.canOrbit) {
          orbit.theta = clamp(drag.theta - dx * .006, -1.3, 1.3);
          orbit.phi = clamp(drag.phi + dy * .004, -.5, .5);
        }
      } else if (e.target === canvas) {
        const now = performance.now();
        if (now - hoverThrottle > 90 && isOrbitChapter(pVisual)) {
          hoverThrottle = now;
          const hit = world.pick(e.clientX, e.clientY);
          canvas.style.cursor = hit ? 'pointer' : 'grab';
        }
      }
    });
    canvas.addEventListener('pointerup', e => {
      if (exportMode) return;
      if (drag && drag.moved < 6) {
        handlePick(e.clientX, e.clientY);
      }
      drag = null;
      canvas.style.cursor = isOrbitChapter(pVisual) ? 'grab' : 'default';
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointercancel', () => { drag = null; canvas.style.cursor = 'grab'; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('dblclick', e => {
      // double click brings the user closer to a selected part via the same camera detail state
      const hit = world.pick(e.clientX, e.clientY);
      if (hit && hit.data && hit.data.part === 'hbm') selectPackageHit(hit);
    });
  }

  function selectPackageHit(hit) {
    const part = hit.data.part;
    if (part === 'hbm') {
      ui.s.selectedStack = hit.data.stack == null ? 0 : hit.data.stack;
      ui.s.selectedDie = ui.s.selectedStack < 4 ? 0 : 1;
      $$('.stack-btn').forEach((x, j) => x.classList.toggle('on', j === ui.s.selectedStack));
      ui.selectPart('hbm');
      ui.toast('已选择 HBM3e 堆栈 ' + String(ui.s.selectedStack + 1).padStart(2, '0'));
    } else if (part === 'die') {
      ui.s.selectedDie = hit.data.dieIndex ? 1 : 0;
      ui.selectPart('die');
      ui.toast('已选择计算晶粒 ' + (ui.s.selectedDie ? 'B' : 'A'));
    } else if (part === 'interposer' || part === 'substrate' || part === 'balls') {
      ui.selectPart(part);
    } else {
      ui.selectPart('overview');
    }
  }

  function handlePick(x, y) {
    if (exportMode) return;
    const hit = world.pick(x, y);
    if (!hit) return;
    if (hit.type === 'package') {
      selectPackageHit(hit);
    } else if (hit.type === 'board') {
      if (hit.data.gpu != null) {
        ui.s.selectedGpu = hit.data.gpu;
        ui.s.selectedTray = null;
        ui.renderTopology();
        ui.renderShard();
        ui.toast('GPU ' + (hit.data.gpu + 1) + ' · B200');
      } else if (hit.data.switch != null) {
        ui.toast('NVSwitch ' + (hit.data.switch + 1) + ' · 14.4 TB/s 全互连');
        ui.s.selectedGpu = null;
        ui.s.selectedTray = null;
        ui.renderTopology();
      }
    } else if (hit.type === 'rack') {
      if (hit.data.tray != null) {
        ui.s.selectedTray = hit.data.tray;
        ui.s.selectedGpu = hit.data.tray < 18 ? hit.data.tray * 4 : null;
        ui.renderTopology();
        ui.renderShard();
        const name = hit.data.trayType === 'switch' ? '交换托盘' : '计算托盘';
        ui.toast(name + ' · ' + (hit.data.trayType === 'switch' ? '2 × NVSwitch' : '4 × B200 + 2 × Grace'));
      }
    } else if (hit.type === 'gb200') {
      const idx = hit.data.gbIndex == null ? 0 : hit.data.gbIndex;
      ui.s.selectedGpu = idx;
      ui.s.selectedTray = null;
      ui.renderTopology();
      ui.toast('GB200 · B200 ' + (idx + 1) + ' / 2');
    } else if (hit.type === 'spec') {
      // choose the nearest line-up slot from the hit point
      let best = 0, bd = 1e9;
      (world.specSlots || []).forEach((slot, i) => {
        const d = Math.abs(hit.point.x - slot.group.position.x);
        if (d < bd) { bd = d; best = i; }
      });
      const keys = ['b200', 'hgx', 'dgx', 'gb200', 'nvl72'];
      ui.s.selectedProduct = keys[best] || 'b200';
      ui._syncProductCards();
      ui.renderSpecTable(); ui.renderSpecBars();
      ui.toast('产品对照 → ' + B.PRODUCT_BY_KEY[ui.s.selectedProduct].name);
    }
  }

  /* keyboard --------------------------------------------------------------- */
  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
  function initKeyboard(canvas) {
    window.addEventListener('keydown', e => {
      if (exportMode) return;
      if (e.defaultPrevented) return;
      const info = B.chapterAt(pVisual);
      if (e.key === 'Escape') return;
      if (isTyping(e)) return;
      if (/^[1-8]$/.test(e.key)) {
        e.preventDefault();
        const c = B.CHAPTERS[+e.key - 1];
        scrollToProgress(c.start + Math.min(.02, c.span * .1), 'smooth');
        ui.closeDetailPanel();
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        ui.s.lensOn = !ui.s.lensOn;
        ui._syncLens();
        ui._updateLensVisual({ chapter: info.chapter });
        ui.toast(ui.s.lensOn ? '局部观察窗：开' : '局部观察窗：关');
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        ui.resetOrbit();
        return;
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); ui.zoom(1.16); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); ui.zoom(1 / 1.16); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (info.chapter.id === 'memory') {
          e.preventDefault();
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          scrollToProgress(clamp(pVisual + dir * .025, .43, .57), 'auto');
        }
      }
    });
    canvas.addEventListener('keydown', e => {
      if (exportMode) return;
      if (e.target !== canvas) return;
      const step = .055;
      if (e.key === 'ArrowLeft') { orbit.theta = clamp(orbit.theta + step, -1.3, 1.3); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { orbit.theta = clamp(orbit.theta - step, -1.3, 1.3); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { orbit.phi = clamp(orbit.phi - .035, -.5, .5); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { orbit.phi = clamp(orbit.phi + .035, -.5, .5); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { ui.zoom(1.16); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { ui.zoom(1 / 1.16); e.preventDefault(); }
      else if (e.key === 'r' || e.key === 'R') { ui.resetOrbit(); e.preventDefault(); }
    });
  }

  /* resize, stage tabs, scroll restore ------------------------------------ */
  function initResize() {
    let t = 0;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (world) world.resize(window.innerWidth, window.innerHeight);
        if (ui) ui._syncLens();
      }, 100);
    });
  }
  function initScaleTabs() {
    // clicking a platform tab scrolls to the matching zone (handled in ui via callback)
    // expose it for the UI by refreshing the callback
    if (ui) ui.opts.onPlatformStage = (stage) => {
      const c = B.CH.scale;
      const u = stage === 0 ? .14 : stage === 1 ? .36 : stage === 2 ? .54 : .82;
      scrollToProgress(c.start + c.span * u, 'smooth');
    };
  }
  function initMemoryScrub() {
    const track = document.querySelector('.ch4-track');
    if (track) {
      track.style.pointerEvents = 'auto';
      track.style.cursor = 'ew-resize';
      let dragging = false;
      const scrub = (clientX) => {
        const main = track.querySelector('.track');
        const r = main ? main.getBoundingClientRect() : track.getBoundingClientRect();
        const f = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
        scrollToProgress(B.CH.memory.start + B.CH.memory.span * (.03 + f * .94), 'auto');
      };
      track.addEventListener('pointerdown', e => {
        if (exportMode) return;
        dragging = true;
        track.setPointerCapture && track.setPointerCapture(e.pointerId);
        scrub(e.clientX);
      });
      window.addEventListener('pointermove', e => { if (dragging) scrub(e.clientX); });
      window.addEventListener('pointerup', () => { dragging = false; });
      track.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          scrollToProgress(clamp(pVisual + (e.key === 'ArrowRight' ? .022 : -.022), B.CH.memory.start, B.CH.memory.end), 'auto');
        }
      });
    }
    window.addEventListener('wheel', e => {
      if (exportMode) return;
      const info = B.chapterAt(pVisual);
      if (info.chapter.id !== 'memory') return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
        e.preventDefault();
        scrollToProgress(clamp(pVisual + e.deltaX * .00022, B.CH.memory.start, B.CH.memory.end), 'auto');
      }
    }, { passive: false });
  }
  function initScrollRestore() {    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    let saved = null;
    try { saved = parseFloat(sessionStorage.getItem('b200-progress')); } catch (e) {}
    if (isFinite(saved) && saved > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, saved * scrollMax());
        pVisual = pTarget = lastVisualP = saved;
      });
    } else {
      pVisual = pTarget = lastVisualP = 0;
    }
    let saveT = 0;
    window.addEventListener('scroll', () => {
      pTarget = scrollMax() > 0 ? window.scrollY / scrollMax() : 0;
      if (!exportMode) {
        clearTimeout(saveT);
        saveT = setTimeout(() => {
          try { sessionStorage.setItem('b200-progress', pTarget.toFixed(5)); } catch (e) {}
        }, 120);
      }
    }, { passive: true });
    pTarget = scrollMax() > 0 ? window.scrollY / scrollMax() : 0;
    pVisual = pTarget; lastVisualP = pTarget;
  }

  /* main loop -------------------------------------------------------------- */
  function loop(ts) {
    requestAnimationFrame(loop);
    if (exportMode) { lastTs = ts; return; }
    if (!world || !ui) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(.06, Math.max(.001, (ts - lastTs) / 1000));
    lastTs = ts;
    elapsed += dt;
    if (!firstFrame) {
      const k = 1 - Math.exp(-dt * 26);
      pVisual += (pTarget - pVisual) * k;
      if (Math.abs(pTarget - pVisual) > .16) pVisual = pTarget;
    } else {
      pVisual = pTarget;
      firstFrame = false;
    }
    scrollSpeed = Math.abs(pVisual - lastVisualP) / Math.max(.001, dt);
    lastVisualP = pVisual;
    if (ui.s.running) ui.s.opsTotal += dt * 12e12;
    const info = B.chapterAt(pVisual);
    const view = {
      p: pVisual, u: info.u, chapter: info.chapter, chapterIndex: info.index,
      time: elapsed, state: ui.s, detail: ui.s.detail,
      selectedStack: ui.s.selectedStack, selectedDie: ui.s.selectedDie,
      orbit: orbit, motion: clamp(scrollSpeed * 4.2, 0, 1),
      lensOn: ui.s.lensOn, export: false, snap: false
    };
    try {
      ui.update(view);
      view.commPhase = ui.s.commPhase;
      view.shardPhase = ui.s.shardPhase;
      world.update(view);
      ui.updateLabels(world, view);
    } catch (err) {
      console.error(err);
      window.__b200Errors.push(String(err && err.stack || err));
      if (window.__b200Errors.length < 4) ui.toast('渲染异常：' + err.message);
    }
  }

  /* video export ----------------------------------------------------------- */
  function chaptersPayload() {
    return B.CHAPTERS.map(c => ({
      id: c.id,
      start: c.start,
      end: c.end,
      name: c.cn,
      zones: [
        { id: c.id + '-enter', start: c.start, end: c.start + c.span * .18, weight: .35 },
        { id: c.id + '-body', start: c.start + c.span * .18, end: c.start + c.span * .82, weight: 1 },
        { id: c.id + '-exit', start: c.start + c.span * .82, end: c.end, weight: .35 }
      ]
    }));
  }
  function deepClone(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; }
  }
  function applyExportFrame(progress, time) {
    const p = clamp(Number(progress) || 0, 0, 1);
    const t = Math.max(0, Number(time) || 0);
    const info = B.chapterAt(p);
    if (ui.s.running) ui.s.opsTotal = t * 12e12;
    const view = {
      p: p, u: info.u, chapter: info.chapter, chapterIndex: info.index,
      time: t, state: ui.s, detail: null,
      selectedStack: ui.s.selectedStack, selectedDie: ui.s.selectedDie,
      orbit: { theta: 0, phi: 0, zoom: 1 },
      motion: motionAt(p), lensOn: ui.s.lensOn, export: true, snap: true
    };
    ui.update(view);
    view.commPhase = ui.s.commPhase;
    view.shardPhase = ui.s.shardPhase;
    world.update(view);
    ui.updateLabels(world, view);
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }
  function initExport(canvas) {
    window.videoExport = {
      runs: ['page'],
      async begin(page, options) {
        if (page && page !== 'page') throw new Error('Only the page run is available');
        await ready;
        exportMode = true;
        savedExportState = deepClone(ui.s);
        savedScroll = window.scrollY;
        document.body.classList.add('export-mode');
        // reset to the default opening state
        ui.resetForExport();
        elapsed = 0;
        orbit.theta = 0; orbit.phi = 0; orbit.zoom = 1;
        window.scrollTo(0, 0);
        lastVisualP = 0; pVisual = 0; pTarget = 0;
        world.resize(window.innerWidth, window.innerHeight);
        await document.fonts.ready.catch(() => {});
        await applyExportFrame(0, 0);
        return { chapters: chaptersPayload() };
      },
      async frame(progress, time) {
        if (!exportMode) {
          // allow frame() use without begin, entering export mode implicitly
          await window.videoExport.begin('page', {});
        }
        if (world.width !== window.innerWidth || world.height !== window.innerHeight) {
          world.resize(window.innerWidth, window.innerHeight);
        }
        await applyExportFrame(progress, time);
      },
      end() {
        exportMode = false;
        document.body.classList.remove('export-mode');
        if (ui && savedExportState) {
          ui.restoreState(savedExportState);
        }
        savedExportState = null;
        lastTs = 0;
        requestAnimationFrame(() => {
          window.scrollTo(0, savedScroll);
          pTarget = scrollMax() > 0 ? window.scrollY / scrollMax() : 0;
          pVisual = pTarget;
          lastVisualP = pTarget;
          elapsed = Math.max(0, elapsed);
          if (world) world.resize(window.innerWidth, window.innerHeight);
        });
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
