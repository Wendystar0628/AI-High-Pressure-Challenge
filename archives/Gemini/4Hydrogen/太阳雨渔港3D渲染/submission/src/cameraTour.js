import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  TOUR_DURATION,
  resetSimulationState,
  updateEnvironmentAtTime,
  evalBoat4Trajectory,
} from './state.js';

function easeInOutCubic(u) {
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function easeOutCubic(u) {
  return 1 - Math.pow(1 - u, 3);
}

// 12-Shot 60-second cinematic storyboard covering every diorama highlight in Section 10.7
const TOUR_SHOTS = [
  {
    // 1. Long shot: Harbor overview pushing in from offshore
    t0: 0.0,
    t1: 6.5,
    p0: [26.5, 15.5, 27.5],
    p1: [19.0, 11.2, 20.5],
    l0: [-1.2, 1.8, -1.2],
    l1: [-1.5, 1.7, -1.0],
    ease: easeInOutCubic,
  },
  {
    // 2. Medium shot: Lateral glide along moored fishing boats & numbered buoys
    t0: 6.5,
    t1: 11.5,
    p0: [6.4, 3.85, 5.6],
    p1: [6.2, 3.65, -2.5],
    l0: [-1.0, 1.45, 0.8],
    l1: [-0.8, 1.35, -5.8],
    ease: easeInOutCubic,
  },
  {
    // 3. Close-up: Bollard-perched seagull -> pushes in cleanly down open quay -> gull flaps & flies off!
    t0: 11.5,
    t1: 16.0,
    p0: [-3.55, 2.75, 11.4],
    p1: [-3.95, 2.32, 7.6],
    l0: [-4.2, 1.95, 5.85],
    l1: [-3.5, 2.65, 4.6],
    ease: easeOutCubic,
  },
  {
    // 4. Medium shot: Contoured silver instrument cases, full clear umbrella & reflecting puddle
    t0: 16.0,
    t1: 21.0,
    p0: [3.95, 2.75, 15.0],
    p1: [1.75, 2.45, 13.7],
    l0: [0.90, 1.62, 10.1],
    l1: [0.70, 1.58, 9.2],
    ease: easeInOutCubic,
  },
  {
    // 5. Close-up: Harbor cat sheltering under overturned wooden skiff looking up at lens
    t0: 21.0,
    t1: 25.5,
    p0: [3.95, 1.25, 16.6],
    p1: [2.85, 1.12, 15.3],
    l0: [2.45, 1.00, 14.05],
    l1: [2.45, 1.02, 14.05],
    ease: easeInOutCubic,
  },
  {
    // 6. Medium shot: Sea gust sweeps from windsock & awning buoy strings -> billowing woven drying net!
    t0: 25.5,
    t1: 31.0,
    p0: [-1.2, 4.2, 2.5],
    p1: [-2.6, 3.6, 13.8],
    l0: [-6.5, 3.3, -5.8],
    l1: [-7.5, 2.65, 10.4],
    ease: easeInOutCubic,
  },
  {
    // 7. Close-up: Through Boat 2 cabin glass & open door onto wheel, glowing screens, chart, thermos & raincoat
    t0: 31.0,
    t1: 36.5,
    p0: [0.2, 2.15, 0.75],
    p1: [-1.62, 1.50, -0.32],
    l0: [-3.52, 1.25, -1.25],
    l1: [-3.52, 1.15, -1.42],
    ease: easeInOutCubic,
  },
  {
    // 8. Medium shot: Dock alley & half-open Co-op Warehouse roller shutter (sunbeams, caustics, crates, blackboard)
    t0: 36.5,
    t1: 41.5,
    p0: [-7.6, 2.85, 2.2],
    p1: [-8.2, 2.42, -3.55],
    l0: [-14.2, 2.70, -3.5],
    l1: [-14.8, 2.90, -3.5],
    ease: easeInOutCubic,
  },
  {
    // 9. Medium shot: Gliding past Waiting Room floor-to-ceiling glass (benches, radio, clock, timetable)
    t0: 41.5,
    t1: 46.5,
    p0: [-8.6, 2.85, 10.6],
    p1: [-9.4, 2.75, 4.0],
    l0: [-14.8, 2.65, 5.6],
    l1: [-15.0, 2.65, 5.4],
    ease: easeInOutCubic,
  },
  {
    // 10. Medium shot: Descending along cutaway water cross-section (tide wall, seabed, tires, anchor, fish scatter)
    t0: 46.5,
    t1: 51.5,
    p0: [19.8, 0.9, 22.8],
    p1: [23.6, -1.15, 11.2],
    l0: [11.5, -1.1, 8.0],
    l1: [10.4, -1.35, 3.6],
    ease: easeInOutCubic,
  },
  {
    // 11. Medium shot: Breakwater pierhead lighthouse, tetrapod surf & faint pastel rainbow
    t0: 51.5,
    t1: 55.5,
    p0: [16.5, 3.45, -1.8],
    p1: [14.2, 4.05, -0.2],
    l0: [4.5, 2.55, -10.8],
    l1: [3.9, 2.75, -11.6],
    ease: easeInOutCubic,
  },
  {
    // 12. Long shot: Following departing Boat 4 & white wake pulling up to overview
    t0: 55.5,
    t1: 60.0,
    p0: [15.0, 5.4, 7.8],
    p1: [24.0, 14.5, 25.0],
    l0: [8.4, 0.9, -0.5],
    l1: [-1.2, 1.8, -1.2],
    ease: easeInOutCubic,
  },
];

export function evaluateTourCamera(t, outPos, outTarget) {
  const clamped = Math.max(0, Math.min(TOUR_DURATION, t));
  let shot = TOUR_SHOTS[TOUR_SHOTS.length - 1];
  for (let i = 0; i < TOUR_SHOTS.length; i++) {
    if (clamped <= TOUR_SHOTS[i].t1 || i === TOUR_SHOTS.length - 1) {
      shot = TOUR_SHOTS[i];
      break;
    }
  }
  const u = Math.max(0, Math.min(1, (clamped - shot.t0) / Math.max(0.001, shot.t1 - shot.t0)));
  const e = shot.ease(u);

  outPos.set(
    shot.p0[0] + (shot.p1[0] - shot.p0[0]) * e,
    shot.p0[1] + (shot.p1[1] - shot.p0[1]) * e,
    shot.p0[2] + (shot.p1[2] - shot.p0[2]) * e
  );
  outTarget.set(
    shot.l0[0] + (shot.l1[0] - shot.l0[0]) * e,
    shot.l0[1] + (shot.l1[1] - shot.l0[1]) * e,
    shot.l0[2] + (shot.l1[2] - shot.l0[2]) * e
  );

  // During Shot 12 start, track departing Boat 4's actual moving position and wake cleanly
  if (clamped >= 55.5 && clamped < 58.6) {
    const b4 = evalBoat4Trajectory(clamped);
    const blend = 1 - (clamped - 55.5) / 3.1;
    outTarget.x += (b4.pos.x - outTarget.x) * blend * 0.85;
    outTarget.y += (0.85 - outTarget.y) * blend * 0.65;
    outTarget.z += (b4.pos.z - outTarget.z) * blend * 0.85;
  }
}

export function setupCameraAndExport({
  camera,
  domElement,
  sim,
  stepSceneFn,
  renderFrameFn,
}) {
  // Default hero miniature overview
  camera.position.set(24.0, 14.0, 25.0);
  const controls = new OrbitControls(camera, domElement);
  controls.target.set(-1.2, 1.8, -1.0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.4;
  controls.maxDistance = 68.0;
  controls.maxPolarAngle = Math.PI * 0.62; // Allows orbiting below water surface to view seabed & cutaway!
  controls.minPolarAngle = 0.08;
  controls.update();

  // Save user free-orbit view before tour starts so end() restores it cleanly
  let savedPos = camera.position.clone();
  let savedTarget = controls.target.clone();
  let exportFps = 60;
  let exportTotalFrames = 3600;
  let currentExportSimTime = 0;

  const FIXED_DT = 1 / 60;

  // Expose fixed videoExport interface required by Section 10.7
  window.videoExport = {
    runs: ['tour'],

    async begin(runId, opts = {}) {
      if (runId !== 'tour') {
        throw new Error(`Unsupported runId: ${runId}`);
      }
      const fps = Number(opts.fps) || 60;
      exportFps = fps;
      exportTotalFrames = Math.max(1, Math.round(TOUR_DURATION * fps));

      if (!sim.exportMode) {
        savedPos.copy(camera.position);
        savedTarget.copy(controls.target);
      }

      sim.exportMode = true;
      controls.enabled = false;
      currentExportSimTime = 0;

      resetSimulationState(sim);
      evaluateTourCamera(0, sim.cameraPos, sim.cameraTarget);
      camera.position.copy(sim.cameraPos);
      camera.lookAt(sim.cameraTarget);
      controls.target.copy(sim.cameraTarget);

      updateEnvironmentAtTime(sim, 0, 0);
      stepSceneFn(0);
      renderFrameFn();

      return { frames: exportTotalFrames };
    },

    async frame(i) {
      if (!sim.exportMode) return;
      const targetTime = i / exportFps;

      // Support backward seek / frame 0 cleanly, then step forward in deterministic 60Hz substeps
      if (targetTime < currentExportSimTime - 1e-6 || i === 0) {
        resetSimulationState(sim);
        currentExportSimTime = 0;
      }

      while (currentExportSimTime + FIXED_DT * 0.5 < targetTime) {
        const nextT = Math.min(targetTime, currentExportSimTime + FIXED_DT);
        const dt = nextT - currentExportSimTime;
        currentExportSimTime = nextT;

        evaluateTourCamera(currentExportSimTime, sim.cameraPos, sim.cameraTarget);
        updateEnvironmentAtTime(sim, currentExportSimTime, dt);
      }

      // Snap exact time & camera at frame i
      currentExportSimTime = targetTime;
      evaluateTourCamera(targetTime, sim.cameraPos, sim.cameraTarget);
      camera.position.copy(sim.cameraPos);
      camera.lookAt(sim.cameraTarget);
      controls.target.copy(sim.cameraTarget);

      updateEnvironmentAtTime(sim, targetTime, 0);
      stepSceneFn(targetTime);
      renderFrameFn();

      // Wait one browser animation frame so frame i is visibly composited on canvas before resolving
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    },

    end() {
      sim.exportMode = false;
      camera.position.copy(savedPos);
      controls.target.copy(savedTarget);
      controls.enabled = true;
      controls.update();
    },
  };

  return { controls };
}
