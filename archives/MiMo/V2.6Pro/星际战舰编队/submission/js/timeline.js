// Timeline: camera program, shot list, videoExport API
(function (global) {
  'use strict';
  const { V3, U, M4 } = global;
  const { lerp, clamp, smoothstep, smootherstep, catmullRom } = U;
  const DUR = global.WORLD.DUR;

  // ---- shots: each has t0,t1, keyframes [{pos, look, fov}] ----
  // cuts between shots are allowed; motion matches at boundaries
  const SHOTS = [
    {
      // 0-7.5  续接加速后的巡航：宽景沿编队向前滑行，护盾余辉变薄
      t0: 0, t1: 7.5,
      keys: [
        { pos: [600, 450, 1700], look: [300, 0, -100], fov: 50 },
        { pos: [720, 415, 1600], look: [420, 5, -110], fov: 50 },
        { pos: [850, 380, 1500], look: [560, 15, -130], fov: 49 }
      ]
    },
    {
      // 7.5-17  从近卫舰旁掠过，沿舰首阶面展开旗舰体量
      t0: 7.5, t1: 17,
      keys: [
        { pos: [300, 115, -680], look: [210, 55, -320], fov: 55 },
        { pos: [385, 95, -560], look: [310, 30, -220], fov: 53 },
        { pos: [465, 75, -450], look: [430, 10, -100], fov: 51 },
        { pos: [525, 58, -355], look: [510, -5, -20], fov: 49 },
        { pos: [555, 48, -285], look: [545, -18, 0], fov: 47 }
      ]
    },
    {
      // 17-26  沿旗舰侧腹掠行，经过炮塔/机库外口/小艇
      t0: 17, t1: 26,
      keys: [
        { pos: [500, 70, 430], look: [390, 0, 130], fov: 52 },
        { pos: [280, 15, 480], look: [160, -35, 150], fov: 53 },
        { pos: [30, -55, 470], look: [-70, -55, 130], fov: 54 },
        { pos: [-195, -40, 445], look: [-265, -25, 150], fov: 53 },
        { pos: [-315, 5, 405], look: [-330, -5, 165], fov: 52 },
        { pos: [-345, 15, 370], look: [-325, -5, 155], fov: 51 }
      ]
    },
    {
      // 26-35  穿过机库舱口，进入贯通机库纵深
      t0: 26, t1: 35,
      keys: [
        { pos: [-235, 10, 430], look: [-235, -5, 150], fov: 51 },
        { pos: [-235, 4, 350], look: [-235, -5, 145], fov: 52 },
        { pos: [-235, -2, 280], look: [-235, -6, 135], fov: 53 },
        { pos: [-236, -5, 215], look: [-232, -8, 118], fov: 54 },
        { pos: [-238, -7, 172], look: [-225, -10, 102], fov: 56 },
        { pos: [-248, -9, 138], look: [-195, -11, 92], fov: 56 },
        { pos: [-228, -11, 112], look: [-145, -12, 88], fov: 55 },
        { pos: [-172, -11, 100], look: [-85, -11, 90], fov: 54 },
        { pos: [-118, -10, 96], look: [-50, -10, 92], fov: 53 }
      ]
    },
    {
      // 35-42.5  舰桥：沿平台侧移，中枢、观景开口与窗外舰列
      t0: 35, t1: 42.5,
      keys: [
        { pos: [384, 80, 18], look: [448, 80, 0], fov: 58 },
        { pos: [408, 81, 14], look: [472, 79, 2], fov: 57 },
        { pos: [438, 82, 10], look: [502, 76, 5], fov: 56 },
        { pos: [468, 82, 5], look: [558, 70, 8], fov: 55 },
        { pos: [492, 80, 2], look: [680, 52, 12], fov: 54 }
      ]
    },
    {
      // 42.5-50  动力核心中庭：沿核心抬升，环带与多层平台
      t0: 42.5, t1: 50,
      keys: [
        { pos: [18, -88, 46], look: [70, -48, 0], fov: 60 },
        { pos: [13, -46, 52], look: [70, -2, 0], fov: 59 },
        { pos: [8, -2, 55], look: [70, 48, 0], fov: 58 },
        { pos: [4, 46, 50], look: [70, 96, 0], fov: 57 },
        { pos: [2, 92, 42], look: [70, 136, 0], fov: 56 }
      ]
    },
    {
      // 50-56  导能长廊：装置间穿行，层层后退至发光腔口
      t0: 50, t1: 56,
      keys: [
        { pos: [-112, -64, 24], look: [-210, -60, 0], fov: 56 },
        { pos: [-192, -66, -14], look: [-300, -60, 0], fov: 57 },
        { pos: [-272, -62, 16], look: [-368, -56, 0], fov: 58 },
        { pos: [-352, -64, -12], look: [-432, -52, 0], fov: 58 },
        { pos: [-412, -60, 3], look: [-455, -46, 0], fov: 56 }
      ]
    },
    {
      // 56-62.5  旗舰光束主炮：蓄势、开火、束身抵住陨石
      t0: 56, t1: 62.5,
      keys: [
        { pos: [880, 330, -700], look: [1080, 15, -180], fov: 50 },
        { pos: [1230, 285, -740], look: [1530, 55, -330], fov: 49 },
        { pos: [1580, 245, -720], look: [1930, 95, -460], fov: 48 },
        { pos: [1840, 215, -680], look: [2090, 112, -510], fov: 47 }
      ]
    },
    {
      // 62.5-68  脉冲炮台分组齐射 + 近卫近防弹流
      t0: 62.5, t1: 68,
      keys: [
        { pos: [340, 390, -780], look: [790, 55, -150], fov: 52 },
        { pos: [740, 335, -850], look: [1280, 65, -280], fov: 51 },
        { pos: [1140, 285, -860], look: [1880, 85, -390], fov: 50 }
      ]
    },
    {
      // 68-73  前卫导弹出射、弧线奔向岩体、命中延时爆裂
      t0: 68, t1: 73,
      keys: [
        { pos: [940, 195, 540], look: [1340, 15, 230], fov: 51 },
        { pos: [1340, 165, 435], look: [1790, -15, 185], fov: 50 },
        { pos: [1740, 135, 265], look: [2240, -45, 205], fov: 49 },
        { pos: [1990, 115, 85], look: [2400, -65, 245], fov: 48 }
      ]
    },
    {
      // 73-78  全队开盾、推进增强、加速前行 —— 接入循环开头（速度方向与开头一致）
      t0: 73, t1: 78,
      keys: [
        { pos: [2350, 520, 780], look: [500, 30, -120], fov: 48 },
        { pos: [1300, 530, 1250], look: [420, 20, -110], fov: 49 },
        { pos: [547, 465, 1745], look: [310, 5, -102], fov: 50 },
        { pos: [600, 450, 1700], look: [300, 0, -100], fov: 50 }
      ]
    }
  ];

  function evalShot(shot, t) {
    const u = clamp((t - shot.t0) / (shot.t1 - shot.t0), 0, 1);
    const posKeys = shot.keys.map(k => k.pos);
    const lookKeys = shot.keys.map(k => k.look);
    const fovs = shot.keys.map(k => k.fov);
    const pos = catmullRom(posKeys, u);
    const look = catmullRom(lookKeys, u);
    // fov: linear
    const ft = u * (fovs.length - 1);
    const fi = Math.min(Math.floor(ft), fovs.length - 2);
    const fov = lerp(fovs[fi], fovs[fi + 1], ft - fi);
    return { pos, look, fov };
  }

  function cameraAt(t) {
    t = ((t % DUR) + DUR) % DUR;
    let shot = SHOTS[0];
    for (let i = 0; i < SHOTS.length; i++) {
      if (t >= SHOTS[i].t0 && t < SHOTS[i].t1) { shot = SHOTS[i]; break; }
      if (i === SHOTS.length - 1) shot = SHOTS[i];
    }
    // blend across cut boundaries by 0.25s to keep motion feel (hard cut but velocity-matched)
    const r = evalShot(shot, t);
    // subtle handheld drift (deterministic)
    const dx = Math.sin(t * 0.7) * 2.2 + Math.sin(t * 1.9 + 1.3) * 1.1;
    const dy = Math.sin(t * 0.55 + 2.1) * 1.8 + Math.sin(t * 1.6) * 0.9;
    const dz = Math.sin(t * 0.62 + 4.2) * 2.0;
    r.pos = [r.pos[0] + dx, r.pos[1] + dy, r.pos[2] + dz];
    return r;
  }

  // ---- videoExport ----
  let exportMode = false;
  let exportFps = 60;
  let exportTime = 0;

  function installExport(renderAt, onEnd) {
    window.videoExport = {
      runs: ['tour'],
      async begin(runId, opts) {
        exportMode = true;
        exportFps = (opts && opts.fps) || 60;
        exportTime = 0;
        const frames = Math.round(DUR * exportFps);
        return { frames };
      },
      async frame(i) {
        exportTime = i / exportFps;
        renderAt(exportTime);
      },
      end() {
        exportMode = false;
        if (onEnd) onEnd();
      }
    };
  }

  global.TIMELINE = {
    DUR, SHOTS, cameraAt, installExport,
    isExporting: () => exportMode,
    exportTime: () => exportTime
  };
})(window);
