// Main Renderer Entry Point for Nested OS
// Boots HostKernel, DisplayDevice, RootDesktop, window.bench, persistent dataDir sync, and 33ms tick loop

import { HostKernel } from './core/host_kernel.js';
import { DisplayDevice } from './core/display_device.js';
import { mountRootDesktop } from './apps/root_desktop.js';
import { installBenchApi } from './core/bench.js';

async function bootstrap() {
  const mountEl = document.getElementById('os-root-shell');
  const hostKernel = new HostKernel();
  const displayDevice = new DisplayDevice(hostKernel);

  // Restore saved session state if present in current --data-dir
  let restoredOpenSubsystems = [];
  if (window.hostBridge?.loadState) {
    try {
      const saved = await window.hostBridge.loadState();
      if (saved && saved.length > 0) {
        hostKernel.importPersistentState(saved);
        // Reopen root host windows for previously active root child subsystems
        restoredOpenSubsystems = Array.from(hostKernel.subsystems.values())
          .filter((s) => s.parentId === 'outer' && s.state !== 'stopped')
          .map((s) => s.id);
      }
    } catch (err) {
      console.warn('Failed to restore persisted state:', err);
    }
  }

  let desktopCtrl = null;
  const saveNow = async () => {
    if (!window.hostBridge?.saveState) return;
    try {
      const json = hostKernel.exportPersistentState();
      await window.hostBridge.saveState(json);
    } catch (err) {
      console.warn('Failed to save state:', err);
    }
  };

  const { markReady } = installBenchApi({
    hostKernel,
    displayDevice,
    getDesktopCtrl: () => desktopCtrl,
    saveNow
  });

  desktopCtrl = mountRootDesktop({ mountEl, hostKernel, displayDevice });

  for (const cid of restoredOpenSubsystems) {
    desktopCtrl.openSubsystemWindow(cid);
  }

  // Fixed setInterval tick loop (unaffected by occlusion throttling alongside CalculateNativeWinOcclusion=off)
  const TICK_MS = 33.333;
  setInterval(() => {
    hostKernel.tick(TICK_MS);
    displayDevice.renderAll();
  }, 33);

  // Periodic background persistence & clean unload save
  setInterval(() => {
    saveNow();
  }, 2500);

  window.addEventListener('beforeunload', () => {
    try {
      if (window.hostBridge?.saveState) {
        window.hostBridge.saveState(hostKernel.exportPersistentState());
      }
    } catch {}
  });

  displayDevice.renderAll();
  markReady();
}

bootstrap();
