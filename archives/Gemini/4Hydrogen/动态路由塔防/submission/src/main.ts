import { audio } from './audio';
import { DemoController, type DemoUIHooks } from './demos';
import { GameEngine } from './engine';
import { SceneManager } from './scene';
import { UIController } from './ui';

function getVisibleElementCenter(selector: string): { x: number; y: number } | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5,
  };
}

function bootstrap(): void {
  const viewport = document.getElementById('viewport');
  const overlayCanvas = document.getElementById('hud-overlay') as HTMLCanvasElement | null;
  if (!viewport || !overlayCanvas) {
    throw new Error('缺少关键渲染容器 (#viewport 或 #hud-overlay)');
  }

  audio.initGestureListeners();

  const engine = new GameEngine();
  const scene = new SceneManager(viewport, overlayCanvas);

  // Build an initial 3D board behind the frosted main menu so WebGL & textures warm up smoothly
  engine.startMap('intranet', false);
  engine.phase = 'menu';
  scene.buildMapScene(engine);

  let ui: UIController | null = null;

  engine.onRoutesUpdated = () => {
    scene.rebuildRouteSplines(engine);
  };
  engine.onWaveChanged = () => {
    ui?.refreshHud(true);
  };

  const demoHooks: DemoUIHooks = {
    onSelectTower: (tower) => {
      ui?.selectTower(tower);
    },
    onRefreshHud: () => {
      ui?.refreshHud(true);
    },
    onSetSubtitle: (title, text) => {
      ui?.setDemoSubtitle(title, text);
    },
    onSetCursor: (state) => {
      ui?.setDemoCursor(state);
    },
    getElementCenter: (selector) => getVisibleElementCenter(selector),
    onDemoStarted: () => {
      ui?.enterDemoView();
    },
    onDemoEnded: () => {
      ui?.showMenu();
      engine.startMap('intranet', false);
      engine.phase = 'menu';
      scene.buildMapScene(engine);
      scene.resetCamera();
    },
  };

  const demos = new DemoController(engine, scene, demoHooks);
  ui = new UIController(engine, scene, demos);

  demos.installVideoExport(() => {
    ui?.showMenu();
    engine.startMap('intranet', false);
    engine.phase = 'menu';
    scene.buildMapScene(engine);
    scene.resetCamera();
  });

  ui.showMenu();

  window.addEventListener('resize', () => {
    scene.resize();
  });

  let lastTime = performance.now();
  const tick = (now: number): void => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    if (demos.isExportMode) {
      return;
    }

    if (engine.phase === 'demo') {
      demos.stepLive(dt);
      return;
    }

    if (engine.phase === 'menu') {
      // Slow ambient orbit behind frosted menu
      scene.orbitBy(dt * 4.5, 0);
      scene.renderFrame(engine, dt, null, null);
      return;
    }

    if (engine.phase === 'playing') {
      engine.step(dt);
    }

    const sceneDt =
      engine.phase === 'paused' || engine.phase === 'victory' || engine.phase === 'defeat'
        ? 0
        : engine.phase === 'playing'
        ? dt * engine.speed
        : dt;

    ui?.refreshHud();
    scene.renderFrame(
      engine,
      sceneDt,
      ui?.getSelectedTowerId() ?? null,
      ui?.getSelectedEnemyId() ?? null
    );
  };

  requestAnimationFrame(tick);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
