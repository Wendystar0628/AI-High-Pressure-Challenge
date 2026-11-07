// App bootstrap: renderer, scenes, UI wiring, main loop
import * as THREE from 'three';
import { createStage } from './env.js';
import { Scene1 } from './scene1.js';
import { Scene2 } from './scene2.js';
import { AudioEngine } from './audio.js';
import { installVideoExport } from './videoExport.js';

const canvas = document.getElementById('gl');
const stage = createStage(canvas);
const audio = new AudioEngine();

const app = {
  stage,
  audio,
  scene1: null,
  scene2: null,
  active: 1,
  exportMode: false,
  slow: 1,
  paused: false,
  renderNow() {
    stage.renderer.render(stage.scene, stage.camera);
  },
  setActiveScene(n, opts = {}) {
    this.active = n;
    // toggle root visibility
    this.scene1.root.visible = (n === 1);
    this.scene2.root.visible = (n === 2);
    document.getElementById('panel-1').classList.toggle('hidden', n !== 1);
    document.getElementById('panel-2').classList.toggle('hidden', n !== 2);
    document.querySelectorAll('#scene-tabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.scene === String(n));
    });
    if (n === 1) {
      this.scene1.setCamera(this.scene1.simTime);
      status('场景一 · 果冻冲击 — 点击「开始冲击」触发模拟');
    } else {
      this.scene2.setCamera(this.scene2.simTime);
      status('场景二 · 造浪水槽 — 点击「释放小球」开始实验');
    }
    if (!opts.silent) this.renderNow();
  },
};

app.scene1 = new Scene1(stage);
app.scene2 = new Scene2(stage);
app.scene2.root.visible = false;

function status(msg) {
  const el = document.getElementById('status-text');
  if (el) el.textContent = msg;
}

// ---------- UI wiring ----------
function bindSlider(id, valId, fn, fmt = v => v.toFixed(2)) {
  const el = document.getElementById(id);
  const val = document.getElementById(valId);
  if (!el) return;
  const apply = () => {
    const v = parseFloat(el.value);
    if (val) val.textContent = fmt(v);
    fn(v);
  };
  el.addEventListener('input', apply);
  apply();
}

// scene 1
const s1 = app.scene1;
bindSlider('ball-mass', 'v-ball-mass', v => s1.setParams({ ballMass: v }), v => v.toFixed(1));
bindSlider('ball-radius', 'v-ball-radius', v => s1.setParams({ ballRadius: v }), v => v.toFixed(2));
bindSlider('ball-height', 'v-ball-height', v => s1.setParams({ ballHeight: v }), v => v.toFixed(1));
bindSlider('ball-count', 'v-ball-count', v => s1.setParams({ ballCount: v | 0 }), v => String(v | 0));
bindSlider('ball-interval', 'v-ball-interval', v => s1.setParams({ ballInterval: v }));
bindSlider('jelly-stiff', 'v-jelly-stiff', v => s1.setParams({ jellyStiff: v }));
bindSlider('jelly-damp', 'v-jelly-damp', v => s1.setParams({ jellyDamp: v }));
bindSlider('jelly-density', 'v-jelly-density', v => s1.setParams({ jellyDensity: v }));
bindSlider('jelly-size', 'v-jelly-size', v => s1.setParams({ jellySize: v }));
bindSlider('gravity', 'v-gravity', v => s1.setParams({ gravity: v }), v => v.toFixed(1));
bindSlider('friction', 'v-friction', v => s1.setParams({ friction: v }));
bindSlider('bounce', 'v-bounce', v => s1.setParams({ bounce: v }));

document.getElementById('jelly-fix').addEventListener('change', e => {
  s1.setParams({ jellyFix: e.target.value });
});

document.querySelectorAll('#mode-row .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#mode-row .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    s1.setMode(btn.dataset.mode);
    document.getElementById('multi-extra').classList.toggle('hidden', btn.dataset.mode !== 'multi');
    status(`模式切换：${btn.textContent} — 点击「开始冲击」`);
    app.renderNow();
  });
});

document.getElementById('j-trigger').addEventListener('click', () => {
  audio.ensure();
  audio.trigger();
  s1.trigger();
  status('冲击模拟进行中…');
});
document.getElementById('j-pause').addEventListener('click', () => {
  if (s1.paused) {
    s1.resume();
    status('继续模拟');
    document.getElementById('j-pause').textContent = '暂停';
  } else {
    s1.pause();
    status('已暂停');
    document.getElementById('j-pause').textContent = '继续';
  }
});
document.getElementById('j-reset').addEventListener('click', () => {
  s1.reset();
  status('已重置 — 点击「开始冲击」重新触发');
  app.renderNow();
});

// scene 2
const s2 = app.scene2;
bindSlider('water-level', 'v-water-level', v => s2.setParams({ waterLevel: v }));
bindSlider('t-gravity', 'v-t-gravity', v => s2.setParams({ gravity: v }), v => v.toFixed(1));
bindSlider('viscosity', 'v-viscosity', v => s2.setParams({ viscosity: v }));
bindSlider('t-ball-r', 'v-t-ball-r', v => s2.setParams({ ballR: v }));
bindSlider('t-per-group', 'v-t-per-group', v => s2.setParams({ perGroup: v | 0 }), v => String(v | 0));
bindSlider('t-drop-h', 'v-t-drop-h', v => s2.setParams({ dropH: v }), v => v.toFixed(1));
bindSlider('tank-l', 'v-tank-l', v => s2.setParams({ tankL: v }), v => v.toFixed(1));
bindSlider('tank-w', 'v-tank-w', v => s2.setParams({ tankW: v }), v => v.toFixed(1));
bindSlider('tank-h', 'v-tank-h', v => s2.setParams({ tankH: v }), v => v.toFixed(1));
bindSlider('wave-delay', 'v-wave-delay', v => s2.setParams({ waveDelay: v }), v => v.toFixed(1));
bindSlider('wave-amp', 'v-wave-amp', v => s2.setParams({ waveAmp: v }), v => v.toFixed(2));
bindSlider('wave-freq', 'v-wave-freq', v => s2.setParams({ waveFreq: v }), v => v.toFixed(2));
bindSlider('wave-dur', 'v-wave-dur', v => s2.setParams({ waveDur: v }), v => v.toFixed(1));

document.getElementById('wave-type').addEventListener('change', e => {
  s2.setParams({ waveType: e.target.value });
});

document.getElementById('t-release').addEventListener('click', () => {
  audio.ensure();
  audio.release();
  s2.trigger();
  status('小球释放 — 全部入水后将自动造浪');
});
document.getElementById('t-wave').addEventListener('click', () => {
  audio.ensure();
  s2.startWave();
  status('造浪启动');
});
document.getElementById('t-stopwave').addEventListener('click', () => {
  s2.stopWave();
  status('造浪停止 — 波动将逐渐衰减');
});
document.getElementById('t-pause').addEventListener('click', () => {
  if (s2.paused) {
    s2.resume();
    status('继续模拟');
    document.getElementById('t-pause').textContent = '暂停';
  } else {
    s2.pause();
    status('已暂停');
    document.getElementById('t-pause').textContent = '继续';
  }
});
document.getElementById('t-reset').addEventListener('click', () => {
  s2.reset();
  status('已重置 — 点击「释放小球」重新实验');
  app.renderNow();
});

// slow motion
function bindSlow(id, valId) {
  const el = document.getElementById(id);
  const val = document.getElementById(valId);
  if (!el) return;
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    app.slow = v;
    if (val) val.textContent = v.toFixed(2) + '×';
    const o1 = document.getElementById('slow-slider');
    const o2 = document.getElementById('slow-slider2');
    const v1 = document.getElementById('slow-val');
    const v2 = document.getElementById('slow-val2');
    if (o1 && o1 !== el) { o1.value = el.value; if (v1) v1.textContent = v.toFixed(2) + '×'; }
    if (o2 && o2 !== el) { o2.value = el.value; if (v2) v2.textContent = v.toFixed(2) + '×'; }
  });
}
bindSlow('slow-slider', 'slow-val');
bindSlow('slow-slider2', 'slow-val2');

// scene tabs
document.querySelectorAll('#scene-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    app.setActiveScene(parseInt(tab.dataset.scene, 10));
  });
});

// sound toggle
const btnSound = document.getElementById('btn-sound');
btnSound.addEventListener('click', () => {
  audio.ensure();
  const on = !audio.enabled;
  audio.setEnabled(on);
  btnSound.textContent = on ? '声音：开' : '声音：关';
  btnSound.classList.toggle('off', !on);
});

document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

// unlock audio on first gesture
const unlock = () => { audio.ensure(); };
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

// ---------- keyboard shortcuts ----------
window.addEventListener('keydown', e => {
  if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (app.active === 1) {
      if (s1.running && !s1.paused) s1.pause();
      else s1.trigger();
    } else {
      if (s2.running && !s2.paused) s2.pause();
      else s2.trigger();
    }
  } else if (e.code === 'KeyR') {
    if (app.active === 1) s1.reset();
    else s2.reset();
    app.renderNow();
  } else if (e.code === 'Digit1') {
    app.setActiveScene(1);
  } else if (e.code === 'Digit2') {
    app.setActiveScene(2);
  }
});

// ---------- event → audio bridge ----------
function pumpEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'jellyImpact': audio.jellyImpact(ev.speed || 3); break;
      case 'jellyRelease': audio.jellyWobble(0.8); break;
      case 'platformHit': audio.platformHit(); break;
      case 'ballClack': audio.ballClack(ev.speed || 1); break;
      case 'splash': audio.splash(ev.speed || 2); break;
      case 'bottomHit': audio.bottomHit(); break;
      case 'waveStart': audio.waveStart(); break;
      case 'waveStop': audio.waveStop(); break;
      case 'trigger': audio.trigger(); break;
      case 'release': audio.release(); break;
    }
  }
}

// ---------- main loop ----------
let lastT = performance.now();
let acc = 0;
const FIXED = 1 / 120;

function loop(now) {
  requestAnimationFrame(loop);
  const realDt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (app.exportMode) {
    // export mode: frame() drives the sim; just keep rendering available
    return;
  }

  const dt = realDt * app.slow;
  acc += dt;
  let stepped = 0;
  while (acc >= FIXED && stepped < 8) {
    app.scene1.step(FIXED);
    app.scene2.step(FIXED);
    acc -= FIXED;
    stepped++;
  }
  if (stepped === 8) acc = 0;

  pumpEvents(app.scene1.drainEvents());
  pumpEvents(app.scene2.drainEvents());

  // camera drift
  if (app.active === 1) app.scene1.setCamera(app.scene1.simTime);
  else app.scene2.setCamera(app.scene2.simTime);

  // status text updates
  if (app.active === 1 && s1.running && !s1.paused) {
    status(`场景一 · ${s1.mode === 'center' ? '单球正中' : s1.mode === 'offset' ? '偏心撞击' : '多球连续'} — t = ${s1.simTime.toFixed(2)}s`);
  } else if (app.active === 2 && s2.running && !s2.paused) {
    const w = s2.waveOn ? '造浪中' : (s2.tLast !== null ? '波动衰减' : '入水中');
    status(`场景二 · ${w} — t = ${s2.simTime.toFixed(2)}s`);
  }

  app.renderNow();
}

// initial render
app.setActiveScene(1, { silent: true });
app.renderNow();
requestAnimationFrame(loop);

// install export API
installVideoExport(app);

// expose for debugging / external harness
window.__app = app;
