import { NestedOSRuntime } from '../engine/system-tree.js';
import { SharedDisplayDevice } from '../graphics/display-device.js';
import { RootDesktopController } from './root-desktop.js';

let runtime = null;
let displayDevice = null;
let rootDesktop = null;
let isReady = false;
let readyResolvers = [];

function resolveReady() {
  isReady = true;
  for (const r of readyResolvers.splice(0, readyResolvers.length)) {
    r(true);
  }
}

// Mount window.bench immediately so early automation callers can await window.bench.ready()
window.bench = {
  version: 1,
  async ready() {
    if (isReady) return true;
    return new Promise((resolve) => {
      readyResolvers.push(resolve);
    });
  },
  async reset() {
    await window.bench.ready();
    rootDesktop.closeAllWindowsForReset();
    displayDevice.disposeSceneCache();
    await runtime.resetAll();
    rootDesktop.applyRootSettings();
    rootDesktop.renderDesktopIcons();
    rootDesktop.tickFrame(0.016);
    await new Promise((r) => setTimeout(r, 30));
    return true;
  },
  async inspect() {
    await window.bench.ready();
    return rootDesktop.buildBenchInspection();
  },
  // Diagnostic helper to test WebGL context loss & restoration without breaking state
  async __simulateWebglContextLoss() {
    displayDevice.simulateContextLossAndRestore();
    await new Promise((r) => setTimeout(r, 250));
    return true;
  }
};

async function initApp() {
  const bootData = await window.hostBridge.bootstrap();
  displayDevice = new SharedDisplayDevice();

  runtime = new NestedOSRuntime(bootData, (ev) => {
    if (!rootDesktop) return;
    if (ev.type === 'notification' && ev.item && !ev.suppressedByDnd) {
      rootDesktop.showToast(ev.item.title, ev.item.body);
    } else if (ev.type === 'projection_focus' && ev.projection) {
      if (ev.projection.targetSysId === 'outer') {
        const w = rootDesktop.windows.find((x) => x.id === ev.projection.projWinId);
        if (w) {
          if (w.state === 'minimized') w.state = 'normal';
          rootDesktop.focusWindow(w.id);
        }
      }
    }
  });

  const mountEl = document.getElementById('root-mount');
  rootDesktop = new RootDesktopController({
    mountEl,
    runtime,
    displayDevice
  });

  // Hybrid rAF + Main-Process IPC Heartbeat Loop (immune to Windows native window occlusion!)
  let lastTickMs = performance.now();
  const driveStep = () => {
    const now = performance.now();
    const elapsedSec = (now - lastTickMs) / 1000;
    if (elapsedSec < 0.014) return; // Cap to ~65 Hz max even when both rAF & heartbeat fire
    lastTickMs = now;
    const clampedDt = Math.min(0.08, Math.max(0.015, elapsedSec));
    runtime.tickStep(clampedDt);
    rootDesktop.tickFrame(clampedDt);
  };

  const rafLoop = () => {
    driveStep();
    requestAnimationFrame(rafLoop);
  };
  requestAnimationFrame(rafLoop);

  window.hostBridge.onHeartbeat(() => {
    driveStep();
  });

  // Perform initial frame render before signaling bench.ready()
  runtime.tickStep(0.02);
  rootDesktop.tickFrame(0.02);
  resolveReady();
}

initApp().catch((err) => {
  console.error('Nested OS Bootstrap Error:', err);
});
