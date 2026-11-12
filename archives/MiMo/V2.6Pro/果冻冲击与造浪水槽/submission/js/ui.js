// ui.js — 界面绑定
(function (global) {
  'use strict';

  function bindUI(scene, player, audio) {
    const $ = (id) => document.getElementById(id);

    // 场景切换
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sc = btn.dataset.scene;
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.classList.remove('scene-jelly', 'scene-tank');
        document.body.classList.add('scene-' + sc);
        scene.setMode(sc);
        $('status-scene').textContent = sc === 'jelly' ? '场景一 · 重球冲击果冻' : '场景二 · 造浪水槽';
      });
    });
    document.body.classList.add('scene-jelly');

    // 播放控制
    $('btn-pause').addEventListener('click', () => {
      scene.paused = !scene.paused;
      $('btn-pause').textContent = scene.paused ? '继续' : '暂停';
      $('btn-pause').classList.toggle('on', scene.paused);
      $('status-state').textContent = scene.paused ? '已暂停' : '运行中';
    });
    $('btn-slow').addEventListener('click', () => {
      scene.slowmo = !scene.slowmo;
      $('btn-slow').classList.toggle('on', scene.slowmo);
      $('btn-slow').textContent = scene.slowmo ? '慢放中' : '慢放';
    });
    $('btn-reset').addEventListener('click', () => {
      scene.reset();
      $('status-state').textContent = '已重置';
    });

    // 演示
    const demoBtns = {
      'btn-demo-jelly-center': 'jelly-center',
      'btn-demo-jelly-multi': 'jelly-multi',
      'btn-demo-jelly-offset': 'jelly-offset',
      'btn-demo-tank-full': 'tank-full',
    };
    for (const [id, runId] of Object.entries(demoBtns)) {
      $(id).addEventListener('click', () => {
        audio.unlock();
        player.start(runId);
      });
    }
    $('btn-demo-stop').addEventListener('click', () => {
      player.stop();
    });
    player.onStateChange = (playing, name) => {
      $('demo-banner').classList.toggle('hidden', !playing);
      $('demo-name').textContent = playing ? '演示中 · ' + name : '';
      if (!playing) $('demo-progress-fill').style.width = '0%';
    };
    player.onProgress = (p) => {
      $('demo-progress-fill').style.width = (p * 100).toFixed(1) + '%';
    };

    // 果冻参数
    const bindSlider = (id, valId, fmt, apply) => {
      const el = $(id), val = $(valId);
      const update = () => {
        const v = parseFloat(el.value);
        val.textContent = fmt(v);
        apply(v);
      };
      el.addEventListener('input', update);
      update();
    };
    bindSlider('param-jelly-stiff', 'val-jelly-stiff', (v) => String(v), (v) => {
      scene.params.jellyStiff = v / 100;
    });
    bindSlider('param-jelly-tough', 'val-jelly-tough', (v) => String(v), (v) => {
      scene.params.jellyTough = v / 100;
    });
    bindSlider('param-ball-mass', 'val-ball-mass', (v) => String(v), (v) => {
      scene.params.ballMass = v;
    });
    bindSlider('param-drop-height', 'val-drop-height', (v) => v.toFixed(1), (v) => {
      scene.params.dropHeight = v;
    });

    // 三种冲击
    $('btn-hit-center').addEventListener('click', () => {
      audio.unlock();
      scene.spawnImpactBall('center');
    });
    $('btn-hit-offset').addEventListener('click', () => {
      audio.unlock();
      scene.spawnImpactBall('offset');
    });
    $('btn-hit-multi').addEventListener('click', () => {
      audio.unlock();
      scene.spawnImpactBall('multi');
    });

    // 水槽密度
    for (let i = 0; i < 4; i++) {
      const id = 'param-den-' + i;
      bindSlider(id, 'val-den-' + i, (v) => (v / 100).toFixed(2), (v) => {
        scene.params.densities[i] = v / 100;
        if (scene.water) scene.water.setDensity(i, v / 100);
      });
    }
    bindSlider('param-wave-amp', 'val-wave-amp', (v) => String(v), (v) => {
      scene.params.waveAmp = v / 100;
    });
    bindSlider('param-wave-freq', 'val-wave-freq', (v) => (v / 100).toFixed(2), (v) => {
      scene.params.waveFreq = v / 100;
    });

    $('btn-release-balls').addEventListener('click', () => {
      audio.unlock();
      scene.releaseBalls();
    });
    $('btn-wave-toggle').addEventListener('click', () => {
      audio.unlock();
      const on = !scene.water.waveEnabled;
      scene.setWaveEnabled(on);
      $('btn-wave-toggle').textContent = on ? '停止造浪' : '开始造浪';
      $('btn-wave-toggle').classList.toggle('on', on);
    });

    // 视角
    $('btn-view-reset').addEventListener('click', () => {
      scene.setMode(scene.mode);
    });
    $('btn-view-top').addEventListener('click', () => {
      scene.camera.setPose(
        scene.mode === 'jelly' ? { x: -0.2, y: 0.4, z: 0 } : { x: 0.2, y: 0.5, z: 0 },
        scene.mode === 'jelly' ? 13 : 14, 0.001, 1.18, 42
      );
    });

    // 音效
    $('btn-audio').addEventListener('click', () => {
      audio.unlock();
      const on = !audio.enabled;
      audio.setEnabled(on);
      $('btn-audio').textContent = '音效: ' + (on ? '开' : '关');
      $('btn-audio').classList.toggle('on', on);
    });

    // 帮助
    $('btn-help').addEventListener('click', () => {
      $('help-overlay').classList.remove('hidden');
    });
    $('btn-help-close').addEventListener('click', () => {
      $('help-overlay').classList.add('hidden');
    });

    // 相机交互
    const canvas = $('gpu-canvas');
    let dragging = false, button = 0, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      button = e.button;
      lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (button === 0) scene.camera.orbit(dx, dy);
      else scene.camera.pan(dx, dy);
    });
    canvas.addEventListener('pointerup', (e) => {
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      scene.camera.zoom(e.deltaY);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 快捷键
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          $('btn-pause').click();
          break;
        case 'KeyR':
          $('btn-reset').click();
          break;
        case 'KeyS':
          $('btn-slow').click();
          break;
        case 'Digit1':
          document.querySelector('[data-scene="jelly"]').click();
          break;
        case 'Digit2':
          document.querySelector('[data-scene="tank"]').click();
          break;
        case 'KeyH':
          $('btn-help').click();
          break;
      }
    });

    // 首次交互解锁音频
    const unlock = () => {
      audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  global.bindUI = bindUI;
})(window);
