/* tour 运镜 + window.videoExport 接口 */
(function () {
  'use strict';
  const H = window.H;

  // 镜头列表：{t0, t1, pos0, pos1, look0, look1, ease, overrides}
  function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

  const SHOTS = [
    {
      // 1 远景：从港外高处推向 L 形码头
      t0: 0, t1: 6,
      pos0: v3(17.5, 13.5, 18.5), pos1: v3(12.5, 8.6, 13.2),
      look0: v3(0.5, 0.2, 0.5), look1: v3(-1.2, 0.5, -1.0),
    },
    {
      // 2 中景：沿堤岸横移，掠过泊位渔船与浮标
      t0: 6, t1: 11,
      pos0: v3(1.45, 2.45, -8.2), pos1: v3(1.75, 2.15, 2.9),
      look0: v3(-2.3, 0.55, -6.6), look1: v3(-2.3, 0.5, 1.7),
    },
    {
      // 3 特写：系船柱上的海鸥，推近后扑翅飞走
      t0: 11, t1: 15,
      pos0: v3(-3.3, 1.75, -4.1), pos1: v3(-2.55, 1.32, -4.75),
      look0: v3(-1.12, 0.78, -5.6), look1: v3(-1.12, 0.72, -5.6),
      overrides: { watchLevel: 0 },
      startleAfter: 0.42,
    },
    {
      // 4 中景：乐器硬箱与透明雨伞、水洼倒影
      t0: 15, t1: 20,
      pos0: v3(-6.4, 2.35, 10.2), pos1: v3(-5.35, 1.85, 8.7),
      look0: v3(-3.0, 0.55, 6.9), look1: v3(-2.75, 0.5, 6.6),
    },
    {
      // 5 特写：舢板下的港猫抬头
      t0: 20, t1: 24,
      pos0: v3(1.05, 1.15, 9.45), pos1: v3(1.62, 0.82, 8.85),
      look0: v3(3.22, 0.32, 7.28), look1: v3(3.22, 0.3, 7.28),
      overrides: { watchLevel: 0.9, rainAmount: 0.62 },
    },
    {
      // 6 中景：阵风吹过晒网、浮球绳串、风向袋与小旗
      t0: 24, t1: 29,
      pos0: v3(9.2, 3.6, 8.6), pos1: v3(8.2, 3.1, 4.8),
      look0: v3(-1.5, 1.35, -1.2), look1: v3(-3.2, 1.1, -2.6),
      overrides: { wind: 1 },
    },
    {
      // 7 特写：透过驾驶舱玻璃推近雷达屏、海图与保温壶
      t0: 29, t1: 34,
      pos0: v3(-5.3, 1.42, -1.55), pos1: v3(-4.42, 1.1, -2.12),
      look0: v3(-2.78, 0.92, -2.95), look1: v3(-2.72, 0.88, -3.1),
    },
    {
      // 8 中景：沿街巷经过半开卷帘门，看仓库光柱与鱼箱
      t0: 34, t1: 39,
      pos0: v3(-1.85, 2.05, 2.85), pos1: v3(-2.75, 1.72, -0.95),
      look0: v3(-6.15, 1.15, 0.65), look1: v3(-6.3, 1.02, -1.05),
    },
    {
      // 9 中景：隔候船室落地玻璃横移
      t0: 39, t1: 44,
      pos0: v3(-2.35, 1.85, 2.95), pos1: v3(-2.35, 1.72, 6.85),
      look0: v3(-6.35, 1.15, 4.25), look1: v3(-6.35, 1.15, 5.35),
    },
    {
      // 10 中景：沿底座侧壁下沉，看岸壁剖面与水下
      t0: 44, t1: 49,
      pos0: v3(11.9, 1.7, 1.6), pos1: v3(12.1, -0.1, -1.2),
      look0: v3(8.6, -0.5, 0.6), look1: v3(8.2, -0.9, -0.8),
      overrides: { watchLevel: 0.72 },
    },
    {
      // 11 中景：防波堤灯塔与消波块浪花
      t0: 49, t1: 54,
      pos0: v3(11.2, 3.6, -0.2), pos1: v3(9.8, 2.9, -2.6),
      look0: v3(5.5, 1.85, -4.75), look1: v3(5.65, 1.35, -5.05),
    },
    {
      // 12 远景：跟着出港渔船拉高，带上航迹
      t0: 54, t1: 60,
      pos0: v3(1.8, 2.6, -5.8), pos1: v3(10.5, 9.2, -11.5),
      look0: v3(7.2, 0.2, -1.2), look1: v3(7.8, 0.0, 0.2),
    },
  ];

  const DURATION = 60;

  function applyShot(t, camera) {
    let shot = SHOTS[0];
    for (let i = 0; i < SHOTS.length; i++) {
      if (t >= SHOTS[i].t0) shot = SHOTS[i];
    }
    const span = shot.t1 - shot.t0;
    const k = H.clamp((t - shot.t0) / span, 0, 1);
    const e = H.easeInOut(k);
    const pos = shot.pos0.clone().lerp(shot.pos1, e);
    const look = shot.look0.clone().lerp(shot.look1, e);
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    return shot;
  }

  H.tourReset = function () {
    H.sim.t = 0;
  };

  H.tourApply = function (t) {
    const s = H.sim;
    s.t = t;

    // 基础天气参数（与实时循环同公式）
    s.rainAmount = 0.45 + 0.35 * Math.sin(t * 0.06 + 1.2) + 0.12 * Math.sin(t * 0.17);
    s.rainAmount = H.clamp(s.rainAmount, 0.12, 1);
    const gustWave = Math.sin(t * 0.045) * 0.5 + 0.5;
    const gustPulse = Math.pow(Math.max(0, Math.sin(t * 0.11 - 0.6)), 6);
    s.wind = H.clamp(gustWave * 0.22 + gustPulse * 0.95, 0, 1);
    s.cloudShadow = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t * 0.021 + 0.8));
    const lp = (t % 97) / 97;
    s.lighthouseOn = lp > 0.93 ? Math.sin(((lp - 0.93) / 0.07) * Math.PI) : 0;
    s.watchLevel = 0;

    const shot = applyShot(t, H.camera);
    if (shot.startleAfter !== undefined) {
      const span = shot.t1 - shot.t0;
      const k = H.clamp((t - shot.t0) / span, 0, 1);
      s.watchLevel = k > shot.startleAfter ? 0.85 : 0;
    }

    // 镜头专属氛围覆盖
    if (shot.overrides) {
      const ov = shot.overrides;
      if (ov.wind !== undefined) s.wind = ov.wind;
      if (ov.rainAmount !== undefined) s.rainAmount = ov.rainAmount;
      if (ov.watchLevel !== undefined) s.watchLevel = ov.watchLevel;
    }

    // 推进环境动态
    if (H.updateAnim) H.updateAnim(1 / 60, t);
    H.syncOutlines();
    // 跟随天空
    if (H.sky && H.sky.sky) H.sky.sky.position.copy(H.camera.position);
  };

  H.TOUR_DURATION = DURATION;
})();
