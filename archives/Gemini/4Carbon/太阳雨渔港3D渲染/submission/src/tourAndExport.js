import * as THREE from 'three';
import { clamp, lerp, smootherstep } from './prng.js';

export const TOUR_DURATION = 60.0; // 60 seconds total for 'tour'

const TOUR_SHOTS = [
  // Shot 1 (0.0 - 5.5s): 远景 — High outer-harbor aerial push-in framing the full square diorama base, L-quay & lighthouse
  {
    t0: 0.0, t1: 5.5,
    pos0: [35.2, 22.4, 36.2], pos1: [24.2, 14.2, 25.2],
    look0: [-0.4, -0.3, 0.2], look1: [-1.0, 1.6, -2.2],
    fov0: 40, fov1: 39,
  },
  // Shot 2 (5.5 - 10.5s): 中景 — Lateral glide along the quay berths, moored fishing boats & floating buoys
  {
    t0: 5.5, t1: 10.5,
    pos0: [9.6, 4.5, 3.8], pos1: [8.8, 4.1, -8.4],
    look0: [-2.4, 1.2, 1.2], look1: [-2.2, 1.3, -8.2],
    fov0: 38, fov1: 38,
  },
  // Shot 3 (10.5 - 15.0s): 特写 — Bollard seagull close-up; pushes in, seagull flaps off into rainbow sky
  {
    t0: 10.5, t1: 15.0,
    pos0: [8.6, 3.05, 8.1], pos1: [6.4, 2.45, 6.1],
    look0: [4.95, 2.16, 4.32], look1: [5.25, 3.15, 2.8],
    fov0: 34, fov1: 34,
  },
  // Shot 4 (15.0 - 20.0s): 中景 — Instrument hard cases, beaded transparent umbrella on steps & puddle reflecting boats/lamp
  {
    t0: 15.0, t1: 20.0,
    pos0: [3.96, 2.74, 14.68], pos1: [3.64, 2.44, 13.58],
    look0: [2.28, 1.44, 7.88], look1: [2.35, 1.48, 7.68],
    fov0: 41, fov1: 39,
  },
  // Shot 5 (20.0 - 24.5s): 特写 — Harbor cat under the upside-down wooden sampan looking up at the lens
  {
    t0: 20.0, t1: 24.5,
    pos0: [1.18, 1.08, 5.55], pos1: [1.50, 0.96, 5.86],
    look0: [2.56, 0.90, 6.18], look1: [2.56, 0.91, 6.18],
    fov0: 34, fov1: 31,
  },
  // Shot 6 (24.5 - 29.5s): 中景 — Sea gust sweeping across water ripples, windsock, small flags, drying nets, floats & hillside
  {
    t0: 24.5, t1: 29.5,
    pos0: [2.2, 4.4, -3.6], pos1: [0.2, 4.0, -5.2],
    look0: [-5.2, 3.05, -11.4], look1: [-5.0, 3.15, -12.4],
    fov0: 42, fov1: 42,
  },
  // Shot 7 (29.5 - 34.5s): 特写 — Pushing toward wheelhouse glass to inspect radar, chart, wheel, thermos & raincoat
  {
    t0: 29.5, t1: 34.5,
    pos0: [0.65, 1.52, -0.58], pos1: [-0.82, 1.22, -1.18],
    look0: [-2.58, 0.92, -1.65], look1: [-2.68, 0.88, -1.72],
    fov0: 35, fov1: 33,
  },
  // Shot 8 (34.5 - 39.5s): 中景 — Street track past vending machine, net/bucket & half-raised shutter into Warehouse sunbeams & ceiling caustics
  {
    t0: 34.5, t1: 39.5,
    pos0: [-3.15, 2.52, 6.05], pos1: [-5.7, 2.32, 11.6],
    look0: [-10.6, 2.62, 8.6], look1: [-14.2, 3.36, 11.6],
    fov0: 42, fov1: 42,
  },
  // Shot 9 (39.5 - 44.0s): 中景 — Lateral glide outside Ferry Waiting Room floor-to-ceiling glass
  {
    t0: 39.5, t1: 44.0,
    pos0: [-5.6, 2.88, 2.0], pos1: [-5.6, 2.78, -3.8],
    look0: [-13.4, 2.82, 0.9], look1: [-13.6, 2.82, -1.8],
    fov0: 41, fov1: 41,
  },
  // Shot 10 (44.0 - 49.5s): 中景 — Descending diorama side cross-section: seawall, seabed, tires, anchor & fish
  {
    t0: 44.0, t1: 49.5,
    pos0: [12.4, 2.35, 27.6], pos1: [11.8, -1.45, 24.2],
    look0: [10.0, -0.75, 15.5], look1: [11.2, -2.25, 14.5],
    fov0: 38, fov1: 38,
  },
  // Shot 11 (49.5 - 54.5s): 中景 — Full breakwater lighthouse & tetrapod foam as passing cloud triggers daytime glow
  {
    t0: 49.5, t1: 54.5,
    pos0: [20.8, 5.2, -3.5], pos1: [18.8, 4.5, -6.2],
    look0: [8.6, 3.55, -14.3], look1: [8.5, 3.70, -14.3],
    fov0: 39, fov1: 38,
  },
  // Shot 12 (54.5 - 60.0s): 远景 — Rising high behind returning white fishing boat & its trailing white wake
  {
    t0: 54.5, t1: 60.0,
    pos0: [18.2, 8.6, 2.2], pos1: [35.2, 22.4, 36.2],
    look0: [7.2, 0.6, -8.8], look1: [-0.4, -0.3, 0.2],
    fov0: 41, fov1: 40,
  },
];

export function evaluateTourCamera(t, camera) {
  const tc = clamp(t, 0, TOUR_DURATION);
  let shot = TOUR_SHOTS[TOUR_SHOTS.length - 1];
  for (const s of TOUR_SHOTS) {
    if (tc >= s.t0 && tc < s.t1) {
      shot = s;
      break;
    }
  }
  const rawU = clamp((tc - shot.t0) / (shot.t1 - shot.t0 || 1), 0, 1);
  // Subtle ease-in-out while keeping gentle continuous motion through each cut
  const u = lerp(rawU, smootherstep(0, 1, rawU), 0.45);

  camera.position.set(
    lerp(shot.pos0[0], shot.pos1[0], u),
    lerp(shot.pos0[1], shot.pos1[1], u),
    lerp(shot.pos0[2], shot.pos1[2], u)
  );
  camera.up.set(0, 1, 0);
  camera.fov = lerp(shot.fov0, shot.fov1, u);
  camera.lookAt(
    lerp(shot.look0[0], shot.look1[0], u),
    lerp(shot.look0[1], shot.look1[1], u),
    lerp(shot.look0[2], shot.look1[2], u)
  );
  camera.updateProjectionMatrix();
}

/**
 * Installs the required window.videoExport fixed interface (Section 10.7).
 */
export function setupVideoExport({
  camera,
  controls,
  renderer,
  stepAndRenderAtTime,
  setExportActive,
  restoreInteractiveView,
}) {
  let activeRun = null;
  let activeFps = 30;
  let totalFrames = 0;

  window.videoExport = {
    runs: ['tour'],

    async begin(runId = 'tour', options = {}) {
      if (runId !== 'tour') {
        throw new Error(`Unknown runId: ${runId}`);
      }
      const fps = Number(options.fps) > 0 ? Number(options.fps) : 30;
      activeRun = runId;
      activeFps = fps;
      totalFrames = Math.round(TOUR_DURATION * fps);

      setExportActive(true);
      controls.enabled = false;

      // Reset to initial state of tour (frame 0 -> t = 0) and render cleanly
      evaluateTourCamera(0, camera);
      stepAndRenderAtTime(0, true);
      const gl = renderer.getContext();
      if (gl && gl.flush) gl.flush();

      return { frames: totalFrames };
    },

    async frame(i) {
      if (!activeRun) {
        await window.videoExport.begin('tour', { fps: activeFps });
      }
      const frameIndex = Math.max(0, Number(i) || 0);
      const exactTime = frameIndex / activeFps;

      evaluateTourCamera(exactTime, camera);
      stepAndRenderAtTime(exactTime, true);

      const gl = renderer.getContext();
      if (gl && gl.finish) gl.finish();
    },

    end() {
      activeRun = null;
      setExportActive(false);
      controls.enabled = true;
      restoreInteractiveView();
    },
  };
}
