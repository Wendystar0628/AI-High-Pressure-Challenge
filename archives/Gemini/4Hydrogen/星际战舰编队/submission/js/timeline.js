(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});
  const { clamp, lerp, smoothstep, smootherstep, Vec3, Mat4, evalSplineKeyframes, mulberry32 } = SF.Math;

  const TOTAL_DURATION = 76.0;
  const TOTAL_TRAVEL = 8000.0; // 5 * 1600 (精准等于宇宙漂浮粒子周期盒的 5 倍，且保证所有碎块甩出斜视锥背面)

  // 视频导出分块定义（严格整数秒，完美适配 3fps 与 60fps，边界无缝）
  const RUNS = [
    { id: 'fleet_overview', start: 0, duration: 19 },
    { id: 'interior_hangar_core', start: 19, duration: 15 },
    { id: 'interior_corridor_bridge', start: 34, duration: 12 },
    { id: 'combat_salvo', start: 46, duration: 17 },
    { id: 'shields_accelerate', start: 63, duration: 13 }
  ];

  // ---------------------------------------------------------
  // 全局周期性速度曲线与无漂移行程积分 LUT
  // ---------------------------------------------------------
  function rawBoostFactor(t) {
    // 0..5.5s 延续片尾加速后缓慢恢复巡航；68.0..76.0s 推进器增强加速
    let b = 0.0;
    if (t <= 5.5) {
      b = 1.0 - smootherstep(0.0, 5.5, t);
    } else if (t >= 68.0) {
      b = smootherstep(68.0, 75.5, t);
    }
    return b;
  }

  function rawSpeed(t) {
    return 1.0 + 1.35 * rawBoostFactor(t);
  }

  // 构建 2048 点精确积分查找表使得 travelDist(76) === 6400.0
  const LUT_N = 2048;
  const travelLUT = new Float64Array(LUT_N + 1);
  (function initTravelLUT() {
    let acc = 0;
    const dt = TOTAL_DURATION / LUT_N;
    for (let i = 0; i < LUT_N; i++) {
      const s0 = rawSpeed(i * dt);
      const s1 = rawSpeed((i + 1) * dt);
      acc += 0.5 * (s0 + s1) * dt;
      travelLUT[i + 1] = acc;
    }
    const scale = TOTAL_TRAVEL / acc;
    for (let i = 0; i <= LUT_N; i++) {
      travelLUT[i] *= scale;
    }
  })();

  function getTravelDist(t) {
    const u = clamp(t / TOTAL_DURATION, 0, 1) * LUT_N;
    const idx = Math.min(LUT_N - 1, Math.floor(u));
    const f = u - idx;
    return lerp(travelLUT[idx], travelLUT[idx + 1], f);
  }

  // ---------------------------------------------------------
  // 舰队编组数据生成（1 旗舰 + 16 近卫 + 22 前卫 = 39 艘战舰）
  // ---------------------------------------------------------
  function buildFleetLayout() {
    const rng = mulberry32(42107);
    const guardians = [];
    const vanguards = [];

    // 16 艘近卫舰：其中 2 艘位于前景/侧近旁，其余环绕旗舰两侧、上下错层与后方舰列
    const gPresets = [
      [255, 22, -160],    // #0 右侧近旁主镜护卫（开火参与近防）
      [-265, 68, 80],     // #1 左前高侧近卫（开火参与近防）
      [285, -75, 220],    // #2 右前下侧近卫（开火参与近防）
      [-280, -88, -80],   // #3 左翼中后下（避让片首片尾前景镜头）
      [340, 115, -360],   // #4 右后上
      [-490, -45, -560],  // #5 左尾护卫（移远避免开头左上贴镜）
      [385, -24, -640],   // #6 右尾护卫
      [-120, 180, -140],  // #7 中段高顶护卫（避让片首左上近景遮挡）
      [185, -135, -480],  // #8 中后低护卫
      [-540, 110, -140],  // #9 远左高
      [485, 60, -240],    // #10 远右高
      [-510, -85, -720],  // #11 远左后
      [530, -90, -860],   // #12 远右后
      [-220, 48, -940],   // #13 远程尾阵左
      [230, -35, -1040],  // #14 远程尾阵右
      [0, 165, -780]      // #15 中央高顶卫
    ];

    for (let i = 0; i < gPresets.length; i++) {
      const p = gPresets[i];
      guardians.push({
        id: i,
        basePos: p,
        phase: rng() * Math.PI * 2,
        bobAmp: 4 + rng() * 5,
        spreadDir: [Math.sign(p[0] || 1) * (0.6 + rng() * 0.4), (rng() - 0.5) * 0.4, 0],
        shieldDelay: 0.4 + rng() * 1.8,
        firesCIWS: i <= 2
      });
    }

    // 22 艘前卫舰：在编队前方和外围铺展，含高低错层和开火前外展
    const vPresets = [
      [330, 52, 640],     // #0 右前方领队导弹舰（重点发射）
      [-310, 44, 620],    // #1 左前方领队导弹舰（重点发射）
      [460, -55, 520],    // #2 右翼外前卫（发射）
      [-450, -48, 540],   // #3 左翼外前卫
      [210, 130, 820],    // #4 前高右（发射）
      [-220, 120, 840],   // #5 前高左
      [0, -145, 760],     // #6 前下中锋
      [580, 95, 360],     // #7 右外高层
      [-570, 85, 380],    // #8 左外高层
      [620, -110, 140],   // #9 右翼中层外延
      [-610, -105, 160],  // #10 左翼中层外延
      [390, 185, 1020],   // #11 远前高右
      [-380, 175, 1040],  // #12 远前高左
      [520, 18, 980],     // #13 远前右翼
      [-510, -15, 960],   // #14 远前左翼
      [740, 42, -80],     // #15 极外侧右翼
      [-730, 50, -60],    // #16 极外侧左翼
      [180, -180, 1140],  // #17 前锋下翼右
      [-175, -175, 1160], // #18 前锋下翼左
      [690, -140, 680],   // #19 远外下右
      [-680, -135, 700],  // #20 远外下左
      [0, 210, 1280]      // #21 最前高侦察先锋
    ];

    for (let i = 0; i < vPresets.length; i++) {
      const p = vPresets[i];
      vanguards.push({
        id: i,
        basePos: p,
        phase: rng() * Math.PI * 2,
        bobAmp: 5 + rng() * 6,
        spreadDir: [Math.sign(p[0] || 1) * (0.8 + rng() * 0.5), Math.sign(p[1] || 1) * 0.35, 0],
        shieldDelay: rng() * 1.4,
        firesMissiles: i === 0 || i === 1 || i === 2 || i === 4
      });
    }

    return { guardians, vanguards };
  }

  // ---------------------------------------------------------
  // 导弹飞行轨迹纯确定性求值（0..16s 任意时刻完全由发射时间算出）
  // ---------------------------------------------------------
  function buildMissileEvents(vanguards) {
    const events = [];
    const firingShips = vanguards.filter(v => v.firesMissiles);
    let idx = 0;
    for (let s = 0; s < firingShips.length; s++) {
      const ship = firingShips[s];
      // 每艘发射 5 枚导弹，间隔 0.28s 依次离槽
      for (let k = 0; k < 5; k++) {
        const launchT = 54.4 + s * 0.35 + k * 0.24;
        const flightDur = 3.2 + (idx % 3) * 0.25;
        const hitT = launchT + flightDur;
        const portX = (k % 2 === 0 ? 1 : -1) * (32 - (k % 3) * 4);
        const portZ = -48 + k * 14;
        // 弧线中段外扩高度与侧偏
        const arcOffset = [
          Math.sign(ship.basePos[0] || 1) * (70 + (idx % 4) * 28),
          55 + (idx % 3) * 32,
          (idx % 2 === 0 ? 40 : -30)
        ];
        // 目标陨石 C 上略有散落的命中点
        const hitOffset = [
          ((idx % 5) - 2) * 14,
          (((idx * 3) % 5) - 2) * 12,
          (((idx * 7) % 5) - 2) * 14
        ];
        events.push({
          id: idx,
          shipId: ship.id,
          portLocal: [portX, 8, portZ],
          launchT,
          hitT,
          arcOffset,
          hitOffset
        });
        idx++;
      }
    }
    return events;
  }

  // ---------------------------------------------------------
  // 陨石群布置（TargetCluster 与 NextCluster 周期无缝衔接）
  // ---------------------------------------------------------
  function buildAsteroidClusterLayout() {
    // 3 颗大型主要目标陨石 + 9 颗中小型背景体素岩块
    // 位置定义为在 t=0 时 Z 的基准（随 travelDist 向 -Z 推进）
    return {
      // 目标 A: 主炮靶标 (t=50.4s 时 travelDist≈4680 -> Z≈+1050; t=76s -> Z=-2270 彻底在相机背后)
      targetA: { basePos: [-110, 12, 5730], rot: [0.2, 0.4, 0.1], shatterT: 50.4, beamHitStart: 48.8, beamHitEnd: 52.5 },
      // 目标 B: 脉冲与近防靶标 (t=54.0s 时 travelDist≈5015 -> Z≈+920; t=76s -> Z=-2065)
      targetB: { basePos: [250, -18, 5935], rot: [0.5, -0.3, 0.2], shatterT: 54.4, pulseHitStart: 51.4, pulseHitEnd: 56.2 },
      // 目标 C: 导弹延迟爆裂巨岩 (避让旗舰右侧上翼航道)
      targetC: { basePos: [248, 128, 6415], rot: [-0.3, 0.7, 0.25], shatterT: 59.3, missileHitStart: 57.6 },
      // 9 颗中小型伴随岩块（t=76s 全部 <= -1350，且严格避让旗舰包络与战斗相机走廊）
      companions: [
        { rockIdx: 0, basePos: [295, -58, 5820], scale: 1.15, spinMult: 1, ciwsTarget: true },
        { rockIdx: 1, basePos: [185, -92, 5880], scale: 1.0, spinMult: -1, ciwsTarget: true },
        { rockIdx: 2, basePos: [-260, 88, 6080], scale: 1.3, spinMult: 1 },
        { rockIdx: 0, basePos: [420, -145, 6280], scale: 1.25, spinMult: 2 },
        { rockIdx: 3, basePos: [-390, -75, 5660], scale: 1.4, spinMult: 1 },
        { rockIdx: 1, basePos: [245, -155, 6160], scale: 1.2, spinMult: -2 },
        { rockIdx: 2, basePos: [-245, 165, 6540], scale: 1.5, spinMult: 1 },
        { rockIdx: 0, basePos: [560, -65, 6480], scale: 1.35, spinMult: -1 },
        { rockIdx: 3, basePos: [380, -120, 5600], scale: 1.1, spinMult: 2 }
      ]
    };
  }

  // ---------------------------------------------------------
  // Timeline Controller
  // ---------------------------------------------------------
  class TimelineDirector {
    constructor(gpuAssets) {
      this.assets = gpuAssets;
      this.fleet = buildFleetLayout();
      this.missileEvents = buildMissileEvents(this.fleet.vanguards);
      this.asteroids = buildAsteroidClusterLayout();
      this.tempMat = Mat4.create();

      // 预生成飞散体素小碎块爆发粒子参数（含碎裂崩落与脉冲/近防边缘削片）
      const rng = mulberry32(77315);
      this.debrisBurstSeeds = [];
      for (let i = 0; i < 84; i++) {
        const th = rng() * Math.PI * 2;
        const ph = (rng() - 0.5) * Math.PI;
        const sp = 35 + rng() * 95;
        this.debrisBurstSeeds.push({
          dir: [Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)],
          speed: sp,
          spinAxis: [rng() - 0.5, rng() - 0.5, rng() - 0.5],
          spinRate: 1.5 + rng() * 4.0,
          chunkIdx: i % 6,
          scale: 0.9 + rng() * 1.4
        });
      }
    }

    getShipMatrix(out, basePos, phase, bobAmp, t, spreadVec, spreadAmt) {
      // 全队细微偏航起伏，使用周期为 TOTAL_DURATION 的整数倍谐波保证 t=0 与 t=76 完全无缝！
      const w = (Math.PI * 2) / TOTAL_DURATION;
      const dx = Math.sin(t * w * 2 + phase) * bobAmp * 0.6 + spreadVec[0] * spreadAmt;
      const dy = Math.cos(t * w * 3 + phase * 1.3) * bobAmp + spreadVec[1] * spreadAmt;
      const dz = Math.sin(t * w * 1 + phase * 0.7) * 6.0;
      const yaw = Math.sin(t * w * 2 + phase) * 0.025 + Math.sign(spreadVec[0]) * spreadAmt * 0.0005;
      const roll = Math.cos(t * w * 2 + phase) * 0.03;
      const pos = [basePos[0] + dx, basePos[1] + dy, basePos[2] + dz];
      Mat4.fromTranslationRotationScale(out, pos, [0, yaw, roll]);
      return pos;
    }

    // 计算小艇飞出、伴飞、穿过旗舰、返回机库的确定性位置与朝向
    evalShuttleTransform(out, shuttleIdx, t) {
      const w = (Math.PI * 2) / TOTAL_DURATION;
      if (shuttleIdx === 0) {
        // 关键领航小艇 #0：13..19s 滑近右舷机库并在 19.0s 飞入机库入口！
        const kf = [
          { t: 0, val: [135, 32, 310] },
          { t: 7, val: [170, 12, 120] },
          { t: 13, val: [185, -16, -20] },
          { t: 16.5, val: [160, -8, -115] },
          { t: 19.0, val: [78, -8, -115] },
          { t: 23.0, val: [40, -8, -115] },
          { t: 45.0, val: [185, 42, -260] },
          { t: 58.0, val: [215, 65, 180] },
          { t: 69.0, val: [165, 48, 410] },
          { t: 76.0, val: [135, 32, 310] }
        ];
        const p = evalSplineKeyframes([], kf, t, true);
        const pNext = evalSplineKeyframes([], kf, (t + 0.15) % TOTAL_DURATION, true);
        const fwd = Vec3.normalize([], Vec3.sub([], pNext, p));
        if (Vec3.len(fwd) < 0.01) fwd[2] = 1;
        const right = Vec3.normalize([], Vec3.cross([], [0, 1, 0], fwd));
        const up = Vec3.cross([], fwd, right);
        Mat4.fromBasisTranslation(out, right, up, fwd, p);
        return p;
      } else {
        // 其余 5 艘小艇沿旗舰上下壳层与炮台之间伴飞穿梭（完全周期闭合）
        const phase = shuttleIdx * 1.25;
        const side = shuttleIdx % 2 === 0 ? 1 : -1;
        const x = side * (95 + 55 * Math.sin(t * w * 2 + phase));
        const y = (shuttleIdx === 2 ? -55 : 42) + 26 * Math.cos(t * w * 3 + phase);
        const z = 440 * Math.sin(t * w * 1 + phase);
        const dt = 0.1;
        const tn = t + dt;
        const xn = side * (95 + 55 * Math.sin(tn * w * 2 + phase));
        const yn = (shuttleIdx === 2 ? -55 : 42) + 26 * Math.cos(tn * w * 3 + phase);
        const zn = 440 * Math.sin(tn * w * 1 + phase);
        const fwd = Vec3.normalize([], [xn - x, yn - y, zn - z]);
        const right = Vec3.normalize([], Vec3.cross([], [0, 1, 0], fwd));
        const up = Vec3.cross([], fwd, right);
        Mat4.fromBasisTranslation(out, right, up, fwd, [x, y, z]);
        return [x, y, z];
      }
    }

    // 判断并求值当前时间的运镜模式与场景内容
    evaluate(t, vfx) {
      t = ((t % TOTAL_DURATION) + TOTAL_DURATION) % TOTAL_DURATION;
      vfx.beginFrame();

      const travelDist = getTravelDist(t);
      const boostFactor = rawBoostFactor(t);
      const fleetSpeed = rawSpeed(t);

      // 计算护卫舰开火前外展幅度（t=44..49展开，t=62..68收拢）
      const spreadAmt = (smootherstep(44.0, 49.0, t) - smootherstep(62.5, 68.5, t)) * 95.0;

      // 确定当前所处内/外景阶段：
      // 0..19s: 舰外总览与掠行
      // 19..26.5s: 贯通式机库（内部场景，开口可直视外面星空与擦身护卫）
      // 26.5..34.0s: 动力核心中庭（全封闭宏伟内景）
      // 34.0..40.0s: 能量装填长廊（全封闭内景）
      // 40.0..46.0s: 宽阔舰桥（观景窗直面外部舰队与前方陨石！）
      // 46.0..76.0s: 舰外开火、碎裂、全队护盾、加速衔接
      let sceneMode = 'exterior';
      if (t >= 19.0 && t < 26.5) sceneMode = 'hangar';
      else if (t >= 26.5 && t < 34.0) sceneMode = 'reactor';
      else if (t >= 34.0 && t < 40.0) sceneMode = 'corridor';
      else if (t >= 40.0 && t < 46.0) sceneMode = 'bridge';

      const drawItems = [];
      const lights = [];

      // -------------------------------------------------------
      // 1. 运镜相机轨迹设计
      // -------------------------------------------------------
      let camPos, camTarget, camFov = 48;
      let interiorMix = 0.0;
      let interiorSkyMix = 0.0;
      let shadowCenter = [0, 0, 120];
      let shadowExtent = 950;
      let enableShadow = true;

      // 预计算当前轮目标陨石即时坐标，用于战斗段精准追踪运镜
      const posA_t = [
        this.asteroids.targetA.basePos[0],
        this.asteroids.targetA.basePos[1],
        this.asteroids.targetA.basePos[2] - travelDist
      ];
      const posB_t = [
        this.asteroids.targetB.basePos[0],
        this.asteroids.targetB.basePos[1],
        this.asteroids.targetB.basePos[2] - travelDist
      ];
      const posC_t = [
        this.asteroids.targetC.basePos[0],
        this.asteroids.targetC.basePos[1],
        this.asteroids.targetC.basePos[2] - travelDist
      ];
      const muzzleApprox = [0, 0, 524];

      if (sceneMode === 'exterior') {
        if (t < 19.0) {
          // 段 1 (0..19s): 舰阵延续加速 -> 绕尾掠过近卫与喷口 -> 沿旗舰腹侧舰首扫过小艇 -> 对正敞开机库直入！
          const posKF = [
            { t: 0.0, val: [-360, 125, -480] },
            { t: 4.0, val: [-120, 92, -640] },
            { t: 8.5, val: [335, 62, -320] },
            { t: 12.2, val: [310, -52, 210] },
            { t: 14.8, val: [260, 26, 610] },
            { t: 17.2, val: [235, -8, -115] },
            { t: 19.0, val: [108, -8, -115] }
          ];
          const tgtKF = [
            { t: 0.0, val: [40, 10, 320] },
            { t: 4.0, val: [10, 8, 40] },
            { t: 8.5, val: [35, 6, -120] },
            { t: 12.2, val: [0, -10, 120] },
            { t: 14.8, val: [0, 6, 360] },
            { t: 17.2, val: [45, -8, -115] },
            { t: 19.0, val: [15, -8, -115] }
          ];
          camPos = evalSplineKeyframes([], posKF, t);
          camTarget = evalSplineKeyframes([], tgtKF, t);
        } else if (t < 63.0) {
          // 段 4 (46..63s): 从舰桥正前上方无切缝滑出，动态锁定武器与三颗靶标陨石
          const midBeamTgt = [
            lerp(muzzleApprox[0], posA_t[0], 0.68),
            lerp(muzzleApprox[1], posA_t[1], 0.68),
            lerp(muzzleApprox[2], posA_t[2], 0.68)
          ];
          const midPulseTgt = [
            lerp(180, posB_t[0], 0.62),
            lerp(0, posB_t[1], 0.62),
            lerp(280, posB_t[2], 0.62)
          ];
          const midMissileTgt = [
            lerp(330, posC_t[0], 0.6),
            lerp(40, posC_t[1], 0.6),
            lerp(660, posC_t[2], 0.6)
          ];

          if (t < 48.2) {
            const posSpline = [
              { t: 44.2, val: [8, 126, -24] },
              { t: 46.0, val: [14, 128, 10] },
              { t: 47.1, val: [165, 116, 360] },
              { t: 48.2, val: [305, 92, 640] }
            ];
            const tgtSpline = [
              { t: 44.2, val: [10, 104, 172] },
              { t: 46.0, val: [20, 70, 572] },
              { t: 47.1, val: [-5, 35, 645] },
              { t: 48.2, val: [muzzleApprox[0] - 40, 12, 690] }
            ];
            camPos = evalSplineKeyframes([], posSpline, t);
            camTarget = evalSplineKeyframes([], tgtSpline, t);
          } else if (t < 52.0) {
            // 光束主炮蓄能 + 击穿陨石 A 全过程追踪（完整框住光束+完整陨石 A）
            const u = smootherstep(48.2, 52.0, t);
            camPos = [lerp(305, 365, u), lerp(92, 98, u), lerp(640, 740, u)];
            const bLook = [lerp(muzzleApprox[0] - 40, midBeamTgt[0], smoothstep(0.0, 0.35, u)),
                           lerp(12, midBeamTgt[1], smoothstep(0.0, 0.35, u)),
                           lerp(690, midBeamTgt[2], smoothstep(0.0, 0.35, u))];
            camTarget = bLook;
          } else if (t < 55.8) {
            // 脉冲炮台 + 近防炮双线交叉打击陨石 B
            const u = smootherstep(52.0, 55.8, t);
            camPos = [lerp(365, 480, u), lerp(98, 114, u), lerp(740, 480, u)];
            camTarget = [
              lerp(midBeamTgt[0], midPulseTgt[0], smoothstep(0.0, 0.35, u)),
              lerp(midBeamTgt[1], midPulseTgt[1], smoothstep(0.0, 0.35, u)),
              lerp(midBeamTgt[2], midPulseTgt[2], smoothstep(0.0, 0.35, u))
            ];
          } else if (t < 58.3) {
            // 前卫导弹离槽跃起与弧线追击
            const u = smootherstep(55.8, 58.3, t);
            camPos = [lerp(480, 495, u), lerp(112, 148, u), lerp(480, 660, u)];
            camTarget = [
              lerp(midPulseTgt[0], midMissileTgt[0], smoothstep(0.0, 0.45, u)),
              lerp(midPulseTgt[1], midMissileTgt[1], smoothstep(0.0, 0.45, u)),
              lerp(midPulseTgt[2], midMissileTgt[2], smoothstep(0.0, 0.45, u))
            ];
          } else {
            // 锁定陨石 C 延迟大爆裂 -> 平滑过渡到全队护盾全景机位 [420, 150, 720]
            const u = smootherstep(58.3, 63.0, t);
            camPos = [lerp(495, 420, u), lerp(148, 150, u), lerp(660, 720, u)];
            const panBack = smoothstep(0.72, 1.0, u);
            const focusC = [posC_t[0] - 15, posC_t[1] - 5, posC_t[2]];
            camTarget = [
              lerp(lerp(midMissileTgt[0], focusC[0], smoothstep(0.0, 0.25, u)), 0, panBack),
              lerp(lerp(midMissileTgt[1], focusC[1], smoothstep(0.0, 0.25, u)), 10, panBack),
              lerp(lerp(midMissileTgt[2], focusC[2], smoothstep(0.0, 0.25, u)), 220, panBack)
            ];
          }
        } else {
          // 段 5 (63..76s): 全队开盾后拉全览 -> 随全队加速冲刺无缝回到 t=0 机位！
          const posKF = [
            { t: 63.0, val: [420, 150, 720] },
            { t: 66.5, val: [510, 185, 420] },
            { t: 70.0, val: [260, 175, -240] },
            { t: 73.2, val: [-190, 148, -560] },
            { t: 76.0, val: [-360, 125, -480] }
          ];
          const tgtKF = [
            { t: 63.0, val: [0, 10, 220] },
            { t: 66.5, val: [0, 10, 120] },
            { t: 70.0, val: [0, 12, 140] },
            { t: 73.2, val: [25, 10, 260] },
            { t: 76.0, val: [40, 10, 320] }
          ];
          camPos = evalSplineKeyframes([], posKF, t);
          camTarget = evalSplineKeyframes([], tgtKF, t);
        }
      } else if (sceneMode === 'hangar') {
        // 贯通式机库 [19..26.5s]：贴近入门小艇承接青橙门框入场 -> 抬头展露宏伟跑道 -> 贴近远端供能闸门擦镜转核心！
        interiorMix = 0.85;
        interiorSkyMix = 0.0; // 外端口面向深空！
        enableShadow = false;
        camFov = 54;
        const posKF = [
          { t: 19.0, val: [6, 5, -162] },
          { t: 21.3, val: [14, 18, -80] },
          { t: 24.4, val: [-8, 14, 40] },
          { t: 26.5, val: [0, 12, 152] }
        ];
        const tgtKF = [
          { t: 19.0, val: [0, 3, -30] },
          { t: 21.3, val: [-6, 10, 80] },
          { t: 24.4, val: [0, 12, 178] },
          { t: 26.5, val: [0, 12, 182] }
        ];
        camPos = evalSplineKeyframes([], posKF, t);
        camTarget = evalSplineKeyframes([], tgtKF, t);
      } else if (sceneMode === 'reactor') {
        // 动力核心中庭 [26.5..34.0s]：沿半径 59 纯净环空 [-48..+48] 螺旋攀升，末段对准导能腔门衔接长廊！
        interiorMix = 0.95;
        interiorSkyMix = 1.0;
        enableShadow = false;
        camFov = 58;
        const u = (t - 26.5) / 7.5;
        const ang = -0.35 + u * 2.15;
        const rad = lerp(63, 66, Math.sin(u * Math.PI));
        const cy = lerp(-48, 48, smootherstep(0, 1, u));
        const spinPos = [Math.cos(ang) * rad, cy, Math.sin(ang) * rad];
        const spinTgt = [0, cy * 0.25, 0];
        const exitMix = smootherstep(33.1, 34.0, t);
        camPos = [
          lerp(spinPos[0], 30, exitMix),
          lerp(spinPos[1], 51, exitMix),
          lerp(spinPos[2], 98, exitMix)
        ];
        camTarget = [
          lerp(spinTgt[0], 30, exitMix),
          lerp(spinTgt[1], 51, exitMix),
          lerp(spinTgt[2], 122, exitMix)
        ];
      } else if (sceneMode === 'corridor') {
        // 能量装填与导能长廊 [34.0..40.0s]：穿行中央通道，双叉机械臂从两侧合拢擦过
        interiorMix = 0.95;
        interiorSkyMix = 1.0;
        enableShadow = false;
        camFov = 55;
        const posKF = [
          { t: 34.0, val: [4, 24, -152] },
          { t: 36.2, val: [-4, 20, -45] },
          { t: 38.4, val: [4, 18, 65] },
          { t: 40.0, val: [0, 23, 138] }
        ];
        const tgtKF = [
          { t: 34.0, val: [0, 18, 120] },
          { t: 36.2, val: [0, 18, 155] },
          { t: 38.4, val: [0, 20, 165] },
          { t: 40.0, val: [0, 22, 175] }
        ];
        camPos = evalSplineKeyframes([], posKF, t);
        camTarget = evalSplineKeyframes([], tgtKF, t);
      } else {
        // 宽阔舰桥 [40.0..46.0s]：掠过控制台与全息沙盘 -> 穿出正前方全景巨窗直衔室外 46.0s 旗舰舰首！
        const outBlend = smoothstep(44.2, 46.0, t);
        interiorMix = lerp(0.72, 0.0, outBlend);
        interiorSkyMix = 0.0; // 正前方超大观景开口直通真实宇宙与战舰群！
        enableShadow = true;
        shadowCenter = [0, lerp(15, 0, outBlend), lerp(25, 120, outBlend)];
        shadowExtent = lerp(160, 950, outBlend);
        camFov = lerp(54, 48, smoothstep(44.5, 46.0, t));
        const posKF = [
          { t: 40.0, val: [34, 21, -46] },
          { t: 42.2, val: [16, 19, -12] },
          { t: 44.2, val: [8, 22, 24] },
          { t: 46.0, val: [14, 24, 58] } // 穿出 z=+54 窗框，以旗舰基准相对 [14, 128, 10] 无缝衔接 46.0s！
        ];
        const tgtKF = [
          { t: 40.0, val: [0, 14, 15] },
          { t: 42.2, val: [0, 14, 28] },
          { t: 44.2, val: [10, 0, 220] },
          { t: 46.0, val: [20, -34, 620] } // 对应室外目标 [20, 70, 572]
        ];
        camPos = evalSplineKeyframes([], posKF, t);
        camTarget = evalSplineKeyframes([], tgtKF, t);
      }

      // -------------------------------------------------------
      // 2. 分场景装配体素模型、运动构件、光源与特效
      // -------------------------------------------------------
      let beamLight = { start: [0, 0, 0], end: [0, 0, 1], color: [0.3, 0.9, 1], intensity: 0 };
      let weaponCharge = 0.0;
      let corePulse = 0.7 + 0.3 * Math.sin(t * 2.1);

      // 计算护盾时序：t=63.5..69 开启；t=0..5.2 延续片尾并渐渐变薄
      function evalShieldParams(delay) {
        if (t <= 5.5) {
          // 循环开头延续稳定护盾包络与余辉，保持完整外扩度同时自然变薄退散
          const fadeOut = 1.0 - smootherstep(0.2, 5.2, t + delay * 0.25);
          return { reveal: 1.0, opacity: 0.30 * fadeOut, expand: 0.55 };
        }
        if (t >= 62.9 + delay * 0.9) {
          const dt = t - (62.9 + delay * 0.9);
          const reveal = clamp(dt / 2.2, 0, 1);
          const wavePeak = Math.sin(clamp(dt / 2.6, 0, 1) * Math.PI) * 0.28;
          const baseOp = lerp(0.08, 0.30, smoothstep(0.0, 2.5, dt));
          return {
            reveal,
            opacity: baseOp + wavePeak,
            expand: smoothstep(0.15, 2.1, dt) * 0.55
          };
        }
        return { reveal: 0, opacity: 0, expand: 0 };
      }

      // -----------------------------------
      // 场景 A：室外舰队、战斗与巡航 (含舰桥窗外实时前景)
      // -----------------------------------
      if (sceneMode === 'exterior' || sceneMode === 'bridge') {
        // 在舰桥模式中，外部编队严格对齐物理舰桥底座坐标 (-104 Y, +48 Z)，既不穿入舰桥室内，又能从观景窗真切望见前方舰首与编队并实现 46.0s 零跳切飞出！
        const extZOffset = sceneMode === 'bridge' ? 48 : 0;
        const extYOffset = sceneMode === 'bridge' ? -104 : 0;
        const thrusterCenters = [];

        // 2a. 旗舰本体（处于中心或舰桥窗外前方）
        const flagW = (Math.PI * 2) / TOTAL_DURATION;
        const flagPos = [
          Math.sin(t * flagW) * 4.0,
          Math.cos(t * flagW * 2) * 3.0 + extYOffset,
          extZOffset
        ];
        const flagMat = Mat4.fromTranslationRotationScale(Mat4.create(), flagPos, [0, 0, Math.sin(t * flagW) * 0.008]);
        const flagShield = evalShieldParams(1.6); // 旗舰最后压轴亮起最大护盾！

        if (sceneMode === 'exterior' || sceneMode === 'bridge') {
          drawItems.push({ mesh: this.assets.flagship, model: flagMat, shieldRim: flagShield.opacity });

          // 旗舰 8 座尾喷口尾焰（加速段额外喷洒外缘高速光屑与细流）
          const thrustScale = 1.0 + boostFactor * 2.2;
          const thrustInt = 0.72 + boostFactor * 1.15;
          for (let ni = 0; ni < this.assets.flagshipInfo.thrusterNozzles.length; ni++) {
            const noz = this.assets.flagshipInfo.thrusterNozzles[ni];
            const wp = Mat4.transformPoint([], flagMat, noz.pos);
            const flicker = 0.94 + 0.06 * Math.sin(t * 24.0 + noz.pos[0]);
            const len = noz.radius * 4.8 * thrustScale * flicker;
            vfx.addThrusterPlume(
              wp, [0, 0, -1], noz.radius * 1.05, len, thrustInt,
              [0.85, 0.98, 1.0], [0.12, 0.68, 1.0]
            );
            vfx.addGlow(wp, noz.radius * (1.8 + boostFactor), 0.35, 0.88, 1.0, 0.75 * thrustInt);
            if (boostFactor > 0.08) {
              for (let sp = 0; sp < 4; sp++) {
                const ph = ((t * 2.4 + ni * 0.37 + sp * 0.25) % 1.0);
                const sPos = [
                  wp[0] + Math.sin(ni * 5.1 + sp * 2.3) * noz.radius * (0.65 + ph * 0.8),
                  wp[1] + Math.cos(ni * 3.7 + sp * 1.9) * noz.radius * (0.65 + ph * 0.8),
                  wp[2] - len * (0.25 + ph * 0.95)
                ];
                vfx.addStreak(sPos, [0, 0, -1], 1.1, 14 + boostFactor * 16, 0.45, 0.92, 1.0, (1.0 - ph) * boostFactor * 0.85);
              }
            }
            thrusterCenters.push(wp);
          }

          // 旗舰护盾（适当外扩以完整包裹舰尾外缘辅助引擎舱与脊台天线）
          vfx.addShield(flagMat, [178, 108, 594], flagShield.reveal, flagShield.opacity, flagShield.expand, [0.22, 0.85, 1.0]);

          // 旗舰 20 座脉冲炮台（底座与旋转炮头，开火时段瞄准陨石 B 并错开半拍发射！）
          const bPosNow = [
            this.asteroids.targetB.basePos[0],
            this.asteroids.targetB.basePos[1] + extYOffset,
            this.asteroids.targetB.basePos[2] - travelDist + extZOffset
          ];
          const pulseActive = t >= 50.8 && t <= 56.2;

          for (let ti = 0; ti < this.assets.flagshipInfo.pulseTurretMounts.length; ti++) {
            const m = this.assets.flagshipInfo.pulseTurretMounts[ti];
            const hoverBob = m.floating ? Math.sin(t * flagW * 3 + ti) * 4.5 : 0;
            const mountLocal = [m.pos[0], m.pos[1] + hoverBob, m.pos[2]];
            const mountWorld = Mat4.transformPoint([], flagMat, mountLocal);

            // 底座
            const baseMat = Mat4.fromTranslationRotationScale(Mat4.create(), mountWorld, [0, 0, 0]);
            drawItems.push({ mesh: this.assets.pulseBase, model: baseMat });

            // 炮塔朝向：平放向前，脉冲开火期对准陨石 B
            let aimYaw = 0;
            let aimPitch = 0;
            if (pulseActive) {
              const dx = bPosNow[0] - mountWorld[0];
              const dy = bPosNow[1] - mountWorld[1];
              const dz = bPosNow[2] - mountWorld[2];
              aimYaw = Math.atan2(dx, dz);
              aimPitch = -Math.atan2(dy, Math.hypot(dx, dz));
            } else {
              aimYaw = Math.sin(t * flagW * 2 + ti) * 0.14;
            }
            const headMat = Mat4.fromTranslationRotationScale(Mat4.create(), mountWorld, [aimPitch, aimYaw, 0]);
            drawItems.push({ mesh: this.assets.pulseHead, model: headMat });

            // 脉冲炮发射：51.0..55.8s 相邻炮台错开 0.18s 发射 3 轮！
            if (pulseActive && m.pos[0] >= -40) { // 右侧及中轴炮台朝右前陨石 B 集火（看得最清楚）
              for (let burst = 0; burst < 3; burst++) {
                const fireT = 51.0 + (ti % 8) * 0.18 + burst * 1.35;
                const age = t - fireT;
                if (age >= 0 && age < 1.15) {
                  for (let mi = 0; mi < 2; mi++) {
                    const muzLocal = this.assets.pulseMuzzles[mi];
                    const muzWorld = Mat4.transformPoint([], headMat, muzLocal);
                    const targetPt = [
                      bPosNow[0] + ((ti * 7 + burst * 11) % 5 - 2) * 10,
                      bPosNow[1] + ((ti * 3 + burst * 5) % 5 - 2) * 8,
                      bPosNow[2]
                    ];
                    const dir = Vec3.normalize([], Vec3.sub([], targetPt, muzWorld));
                    const totalD = Vec3.dist(muzWorld, targetPt);
                    const boltSpeed = 1050;
                    const travel = age * boltSpeed;

                    if (age < 0.16) {
                      // 炮口短促聚光闪光与外壳照明
                      const fGlow = (1.0 - age / 0.16);
                      vfx.addGlow(muzWorld, 18 * fGlow + 4, 0.45, 0.92, 1.0, fGlow);
                      if (lights.length < 14 && burst === 1) {
                        lights.push({ pos: muzWorld, radius: 130, color: [0.35, 0.88, 1.0], intensity: 2.8 * fGlow });
                      }
                    }
                    if (travel < totalD) {
                      const bPos = Vec3.addScaled([], muzWorld, dir, travel);
                      vfx.addStreak(bPos, dir, 6.2, 54, 0.55, 0.96, 1.0, 0.98);
                      vfx.addGlow(bPos, 15, 0.25, 0.78, 1.0, 0.72);
                    } else {
                      const hitAge = (travel - totalD) / boltSpeed;
                      if (hitAge < 0.42) {
                        const hf = 1.0 - hitAge / 0.42;
                        vfx.addGlow(targetPt, 32 * hf + 8, 0.7, 0.95, 1.0, hf);
                        vfx.addShockRing(targetPt, dir, 14 + hitAge * 85, 0.35, 0.85, 1.0, hf * 0.85);
                        if (lights.length < 15) {
                          lights.push({ pos: targetPt, radius: 160, color: [0.45, 0.92, 1.0], intensity: 3.5 * hf });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // 2b. 16 艘近卫舰（紧凑厚实、近防炮座、推进、护盾）
        const aTargetBPos = [
          this.asteroids.targetB.basePos[0],
          this.asteroids.targetB.basePos[1] + extYOffset,
          this.asteroids.targetB.basePos[2] - travelDist + extZOffset
        ];

        for (let i = 0; i < this.fleet.guardians.length; i++) {
          const g = this.fleet.guardians[i];
          const gMat = Mat4.create();
          const gBase = [g.basePos[0], g.basePos[1] + extYOffset, g.basePos[2] + extZOffset];
          const gPos = this.getShipMatrix(gMat, gBase, g.phase, g.bobAmp, t, g.spreadDir, spreadAmt);
          const gShield = evalShieldParams(g.shieldDelay);

          drawItems.push({ mesh: this.assets.guardian, model: gMat, shieldRim: gShield.opacity });

          // 近卫舰尾焰与护盾
          const tScale = 1.0 + boostFactor * 2.0;
          const tInt = 0.7 + boostFactor * 1.1;
          for (const noz of this.assets.guardianInfo.thrusterNozzles) {
            const wp = Mat4.transformPoint([], gMat, noz.pos);
            vfx.addThrusterPlume(wp, [0, 0, -1], noz.radius, noz.radius * 4.5 * tScale, tInt, [0.85, 0.98, 1.0], [0.15, 0.72, 1.0]);
            if (i < 4) thrusterCenters.push(wp);
          }
          vfx.addShield(gMat, [46, 29, 103], gShield.reveal, gShield.opacity, gShield.expand, [0.22, 0.85, 1.0]);

          // 近卫舰 5 座速射近防炮台及高频短点射（52.2..56.8s）
          if (sceneMode === 'exterior') {
            const ciwsActive = g.firesCIWS && t >= 52.0 && t <= 57.0;
            for (let ci = 0; ci < this.assets.guardianInfo.ciwsMounts.length; ci++) {
              const cm = this.assets.guardianInfo.ciwsMounts[ci];
              const mPos = Mat4.transformPoint([], gMat, cm.pos);
              let cyaw = 0, cpitch = 0;
              // 瞄准脉冲靶标 B 及其附近小岩块
              const comp = this.asteroids.companions[0];
              const tgtPos = (ci % 2 === 0)
                ? [aTargetBPos[0], aTargetBPos[1] + 10, aTargetBPos[2]]
                : [comp.basePos[0], comp.basePos[1] + extYOffset, comp.basePos[2] - travelDist + extZOffset];
              if (ciwsActive && cm.dir > 0) {
                const dx = tgtPos[0] - mPos[0];
                const dy = tgtPos[1] - mPos[1];
                const dz = tgtPos[2] - mPos[2];
                cyaw = Math.atan2(dx, dz);
                cpitch = -Math.atan2(dy, Math.hypot(dx, dz));
              }
              const cMat = Mat4.fromTranslationRotationScale(Mat4.create(), mPos, [cpitch, cyaw, 0]);
              drawItems.push({ mesh: this.assets.ciwsTurret, model: cMat });

              // 短点射弹流（每个循环连射多发密集炽金短线带！）
              if (ciwsActive && cm.dir > 0 && ci < 4) {
                const burstWin = (t - 52.2) % 1.25;
                if (burstWin < 1.05 && t < 56.6) {
                  const dir = Vec3.normalize([], Vec3.sub([], tgtPos, mPos));
                  const totD = Vec3.dist(mPos, tgtPos);
                  // 每 0.08s 一发交替左右炮管
                  for (let shot = 0; shot < 12; shot++) {
                    const shotT = 52.2 + Math.floor((t - 52.2) / 1.25) * 1.25 + shot * 0.08 + i * 0.03;
                    const age = t - shotT;
                    if (age >= 0 && age < 0.88) {
                      const muz = Mat4.transformPoint([], cMat, this.assets.ciwsMuzzles[shot % 2]);
                      const tr = age * 1450;
                      if (age < 0.09) {
                        vfx.addGlow(muz, 16, 1.0, 0.85, 0.35, 1.0);
                      }
                      if (tr < totD) {
                        const p = Vec3.addScaled([], muz, dir, tr);
                        vfx.addStreak(p, dir, 4.0, 52, 1.0, 0.84, 0.36, 1.0);
                      } else if (tr - totD < 190) {
                        const impPos = [
                          tgtPos[0] + Math.sin(shot * 3.1) * 14,
                          tgtPos[1] + Math.cos(shot * 2.7) * 14,
                          tgtPos[2]
                        ];
                        vfx.addGlow(impPos, 24, 1.0, 0.72, 0.25, 0.95);
                        vfx.addStreak(impPos, [Math.sin(shot * 5.7), Math.cos(shot * 4.3), -0.6], 2.2, 22, 1.0, 0.78, 0.32, 0.9);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // 2c. 22 艘前卫舰（修长舒展、外翼导弹槽、三联扁喷口、护盾）
        const vangPositions = [];
        for (let i = 0; i < this.fleet.vanguards.length; i++) {
          const v = this.fleet.vanguards[i];
          const vMat = Mat4.create();
          const vBase = [v.basePos[0], v.basePos[1] + extYOffset, v.basePos[2] + extZOffset];
          const vPos = this.getShipMatrix(vMat, vBase, v.phase, v.bobAmp, t, v.spreadDir, spreadAmt);
          vangPositions[v.id] = { mat: vMat, pos: vPos };
          const vShield = evalShieldParams(v.shieldDelay);

          drawItems.push({ mesh: this.assets.vanguard, model: vMat, shieldRim: vShield.opacity });

          const tScale = 1.0 + boostFactor * 2.0;
          const tInt = 0.68 + boostFactor * 1.1;
          for (const noz of this.assets.vanguardInfo.thrusterNozzles) {
            const wp = Mat4.transformPoint([], vMat, noz.pos);
            vfx.addThrusterPlume(wp, [0, 0, -1], noz.radius, noz.radius * 4.5 * tScale, tInt, [0.85, 0.98, 1.0], [0.14, 0.7, 1.0]);
          }
          vfx.addShield(vMat, [56, 20, 94], vShield.reveal, vShield.opacity, vShield.expand, [0.22, 0.85, 1.0]);
        }

        // 2d. 旗舰舰外伴飞小艇 (6 艘)
        if (sceneMode === 'exterior' || sceneMode === 'bridge') {
          for (let s = 0; s < 6; s++) {
            const shMat = Mat4.create();
            this.evalShuttleTransform(shMat, s, t);
            shMat[13] += extYOffset;
            shMat[14] += extZOffset;
            drawItems.push({ mesh: this.assets.shuttle, model: shMat });
            const shTail = Mat4.transformPoint([], shMat, [0, 0, -13]);
            const shFwd = Mat4.transformPoint([], shMat, [0, 0, -14]);
            const backDir = Vec3.normalize([], Vec3.sub([], shFwd, shTail));
            vfx.addThrusterPlume(shTail, backDir, 1.8, 12 + boostFactor * 10, 0.85, [0.9, 1.0, 1.0], [0.2, 0.85, 1.0]);
          }
        }

        // -----------------------------------
        // 2e. 陨石群（双周期无缝接力）与受击碎裂
        // -----------------------------------
        // 陨石/碎块沿旗舰船首航道平顺避让（含最大裂块半径余量），彻底杜绝穿模或擦碰旗舰壳体与护盾
        const wakeBypass = (wp, tgtBase) => {
          const lz = wp[2] - extZOffset;
          if (lz >= 560) return wp;
          const rx = 232, ry = 158;
          const lx = wp[0] - flagPos[0];
          const ly = wp[1] - flagPos[1];
          const eDist = Math.hypot(lx / rx, ly / ry);
          if (eDist >= 1.06) return wp;
          const zMask = smoothstep(560, 320, lz);
          if (zMask <= 0.0) return wp;
          let ux = lx / rx;
          let uy = ly / ry;
          if (eDist < 0.08) {
            ux = tgtBase[0] !== 0 ? Math.sign(tgtBase[0]) : 1.0;
            uy = tgtBase[1] !== 0 ? Math.sign(tgtBase[1]) * 0.45 : 0.35;
          }
          const uLen = Math.hypot(ux, uy) || 1;
          const targetLx = (ux / uLen) * rx * 1.06;
          const targetLy = (uy / uLen) * ry * 1.06;
          return [flagPos[0] + lerp(lx, targetLx, zMask), flagPos[1] + lerp(ly, targetLy, zMask), wp[2]];
        };

        const renderCluster = (zCycleOffset, allowCombat) => {
          // 目标 A（旗舰主炮靶标）
          const renderTarget = (tgtInfo, asset, hitFactor, shatterAge) => {
            const baseWorld = [tgtInfo.basePos[0], tgtInfo.basePos[1] + extYOffset, tgtInfo.basePos[2] - travelDist + zCycleOffset + extZOffset];
            // 仅渲染在相机前或合理距离内的陨石
            if (baseWorld[2] < -2400 || baseWorld[2] > 9000) return baseWorld;

            const wCycle = (Math.PI * 2) / TOTAL_DURATION;
            if (shatterAge <= 0) {
              const m = Mat4.fromTranslationRotationScale(Mat4.create(), baseWorld, [
                tgtInfo.rot[0] + t * wCycle,
                tgtInfo.rot[1] + t * wCycle,
                tgtInfo.rot[2]
              ]);
              drawItems.push({ mesh: asset.wholeMesh, model: m, heatLevel: hitFactor });
            } else {
              // 碎裂后：各大型/中型 Voronoi 裂块沿裂面法线分离、翻滚，露出真实内部裂隙！
              const rotBase = Mat4.fromTranslationRotationScale(Mat4.create(), baseWorld, [
                tgtInfo.rot[0] + t * wCycle,
                tgtInfo.rot[1] + t * wCycle,
                tgtInfo.rot[2]
              ]);
              const coolDown = clamp(1.0 - shatterAge / 3.8, 0.0, 1.0);
              for (let p = 0; p < asset.pieces.length; p++) {
                const pc = asset.pieces[p];
                const sep = pc.sepSpeed * Math.pow(shatterAge, 0.88);
                const loc = [
                  pc.localOffset[0] + pc.dir[0] * sep,
                  pc.localOffset[1] + pc.dir[1] * sep,
                  pc.localOffset[2] + pc.dir[2] * sep
                ];
                const worldP = wakeBypass(Mat4.transformPoint([], rotBase, loc), tgtInfo.basePos);
                const pm = Mat4.fromAxisAngleTranslation(Mat4.create(), worldP, pc.spinAxis, pc.spinSpeed * shatterAge);
                drawItems.push({ mesh: pc.mesh, model: pm, heatLevel: coolDown * 0.90 });
              }
              // 爆裂伴随喷散的体素小碎块群
              if (shatterAge < 12.0) {
                for (let d = 0; d < 36; d++) {
                  const sb = this.debrisBurstSeeds[d];
                  const dist = (15 + sb.speed * shatterAge) * 0.9;
                  const dp = wakeBypass([
                    baseWorld[0] + sb.dir[0] * dist,
                    baseWorld[1] + sb.dir[1] * dist,
                    baseWorld[2] + sb.dir[2] * dist
                  ], tgtInfo.basePos);
                  const dm = Mat4.fromAxisAngleTranslation(Mat4.create(), dp, sb.spinAxis, sb.spinRate * shatterAge, sb.scale);
                  drawItems.push({ mesh: this.assets.debrisChunks[sb.chunkIdx], model: dm, heatLevel: coolDown });
                }
              }
            }
            return baseWorld;
          };

          // A. 光束主炮目标
          let heatA = 0, shatterAgeA = -1;
          if (allowCombat && t >= this.asteroids.targetA.beamHitStart) {
            heatA = smoothstep(this.asteroids.targetA.beamHitStart, this.asteroids.targetA.shatterT, t);
            shatterAgeA = t - this.asteroids.targetA.shatterT;
          }
          const posA = renderTarget(this.asteroids.targetA, this.assets.largeTargets[0], heatA, shatterAgeA);

          // B. 脉冲与近防目标（51.8..54.4s 遭受集火时先从外缘分批崩落中小型体素碎岩，54.4s 全岩裂解）
          let heatB = 0, shatterAgeB = -1;
          if (allowCombat && t >= this.asteroids.targetB.pulseHitStart) {
            heatB = smoothstep(this.asteroids.targetB.pulseHitStart, this.asteroids.targetB.shatterT, t);
            shatterAgeB = t - this.asteroids.targetB.shatterT;
          }
          const posB = renderTarget(this.asteroids.targetB, this.assets.largeTargets[1], heatB, shatterAgeB);
          if (allowCombat && t >= 51.8 && t <= 57.2) {
            for (let k = 0; k < 6; k++) {
              const chipStart = 51.8 + k * 0.40;
              const chipAge = t - chipStart;
              if (chipAge >= 0 && chipAge < 3.0) {
                const chipCool = clamp(1.0 - chipAge / 1.4, 0.0, 1.0);
                for (let j = 0; j < 4; j++) {
                  const sb = this.debrisBurstSeeds[38 + k * 4 + j];
                  const sx = (sb.dir[0] >= 0 ? 1 : -1) * (24 + Math.abs(sb.dir[0]) * 12);
                  const sy = (sb.dir[1] >= 0 ? 1 : -1) * (16 + Math.abs(sb.dir[1]) * 10);
                  const drift = sb.speed * 0.48 * chipAge;
                  const cp = [
                    posB[0] + sx + sb.dir[0] * drift,
                    posB[1] + sy + sb.dir[1] * drift,
                    posB[2] - 18 + sb.dir[2] * drift * 0.7
                  ];
                  const cm = Mat4.fromAxisAngleTranslation(Mat4.create(), cp, sb.spinAxis, sb.spinRate * chipAge, sb.scale * 1.15);
                  drawItems.push({ mesh: this.assets.debrisChunks[sb.chunkIdx], model: cm, heatLevel: chipCool * 0.85 });
                }
              }
            }
          }

          // C. 导弹延迟爆裂巨岩
          let heatC = 0, shatterAgeC = -1;
          if (allowCombat && t >= this.asteroids.targetC.missileHitStart) {
            heatC = smoothstep(this.asteroids.targetC.missileHitStart, this.asteroids.targetC.shatterT, t);
            shatterAgeC = t - this.asteroids.targetC.shatterT;
          }
          const posC = renderTarget(this.asteroids.targetC, this.assets.largeTargets[2], heatC, shatterAgeC);

          // 伴随普通岩块
          const wCmp = (Math.PI * 2) / TOTAL_DURATION;
          for (let c = 0; c < this.asteroids.companions.length; c++) {
            const cmp = this.asteroids.companions[c];
            const cpRaw = [cmp.basePos[0], cmp.basePos[1] + extYOffset, cmp.basePos[2] - travelDist + zCycleOffset + extZOffset];
            if (cpRaw[2] < -2400 || cpRaw[2] > 9000) continue;
            const cp = wakeBypass(cpRaw, cmp.basePos);
            const ang = cmp.spinMult * wCmp * t;
            const cm = Mat4.fromTranslationRotationScale(
              Mat4.create(),
              cp,
              [ang, ang * 1.0, cmp.spinMult * 0.3],
              [cmp.scale, cmp.scale, cmp.scale]
            );
            drawItems.push({ mesh: this.assets.mediumRocks[cmp.rockIdx], model: cm });
          }

          return { posA, posC };
        };

        // 当前轮靶标群 (zOffset=0) 与下一轮刚从极远前方进入视野的新陨石群 (zOffset=+TOTAL_TRAVEL)
        const tgtWorld = renderCluster(0, sceneMode === 'exterior');
        renderCluster(TOTAL_TRAVEL, false);

        // -----------------------------------
        // 2f. 旗舰光束主炮 & 前卫导弹群特效
        // -----------------------------------
        if (sceneMode === 'exterior') {
          // 1) 旗舰光束主炮 (47.2s ~ 52.8s)
          const muzzleW = Mat4.transformPoint([], flagMat, this.assets.flagshipInfo.mainBeamMuzzle);
          if (t >= 47.0 && t <= 53.2) {
            if (t < 48.8) {
              weaponCharge = smootherstep(47.0, 48.7, t);
              // 炮口聚集浓亮光团 & 向内收缩聚焦环
              const gSize = 18 + weaponCharge * 38;
              vfx.addGlow(muzzleW, gSize, 0.55, 0.96, 1.0, weaponCharge);
              for (let r = 0; r < 3; r++) {
                const ph = ((t - 47.0) * 1.8 + r * 0.33) % 1.0;
                const ringPos = Vec3.addScaled([], muzzleW, [0, 0, 1], (1.0 - ph) * 32);
                vfx.addShockRing(ringPos, [0, 0, 1], lerp(42, 8, ph), 0.35, 0.9, 1.0, weaponCharge * Math.sin(ph * Math.PI));
              }
              lights.push({ pos: muzzleW, radius: 340, color: [0.35, 0.9, 1.0], intensity: 4.5 * weaponCharge });
            } else if (t <= 52.8) {
              weaponCharge = 1.0 - smoothstep(52.1, 52.8, t);
              const hitPt = tgtWorld.posA;
              const beamDir = Vec3.normalize([], Vec3.sub([], hitPt, muzzleW));
              const totalLen = Vec3.dist(muzzleW, hitPt);

              // 光束生长与尾部断开收束
              const startFrac = t > 52.2 ? smoothstep(52.2, 52.8, t) : 0.0;
              const endFrac = t < 49.0 ? smoothstep(48.8, 49.0, t) : 1.0;
              const bStart = Vec3.addScaled([], muzzleW, beamDir, totalLen * startFrac);
              const bEnd = Vec3.addScaled([], muzzleW, beamDir, totalLen * endFrac);
              const fade = 1.0 - smoothstep(52.2, 52.8, t);
              const pulse = 0.5 + 0.5 * Math.sin(t * 28.0);

              // 外层宽辉光鞘 + 内层炽白光核
              vfx.addBeamSegment(bStart, bEnd, 18 * (0.85 + 0.15 * fade), 0.9 * fade, pulse, [0.95, 1.0, 1.0], [0.18, 0.78, 1.0]);
              vfx.addBeamSegment(bStart, bEnd, 7.5 * fade, 1.6 * fade, pulse, [1.0, 1.0, 1.0], [0.55, 0.96, 1.0]);

              // 起射光环沿射向套出高速前掠
              for (let r = 0; r < 4; r++) {
                const ringFrac = ((t - 48.8) * 1.45 + r * 0.25) % 1.0;
                const rPos = Vec3.addScaled([], muzzleW, beamDir, ringFrac * totalLen * 0.85);
                vfx.addShockRing(rPos, beamDir, 22 + ringFrac * 18, 0.45, 0.94, 1.0, (1.0 - ringFrac) * fade * 0.85);
              }
              vfx.addGlow(muzzleW, 48 * fade, 0.7, 0.98, 1.0, fade);

              // 受击处亮光与裂口冲击
              if (endFrac > 0.95) {
                vfx.addGlow(hitPt, 72 * fade + 16, 1.0, 0.78, 0.45, fade);
                vfx.addShockRing(hitPt, beamDir, 35 + Math.sin(t * 14) * 12, 1.0, 0.65, 0.25, fade * 0.85);
              }
              beamLight = { start: bStart, end: bEnd, color: [0.38, 0.92, 1.0], intensity: 5.5 * fade };
            }
          }

          // 2) 前卫导弹齐射 (54.4s ~ 62.5s)
          if (t >= 54.4 && t <= 62.5) {
            const evalMissilePos = (ev, mt) => {
              const ship = vangPositions[ev.shipId];
              const p0 = Mat4.transformPoint([], ship.mat, ev.portLocal);
              const u = clamp((mt - ev.launchT) / (ev.hitT - ev.launchT), 0, 1);
              // 离槽初段先垂直上跃拉出距离再平滑弯弧加速俯冲向陨石 C！
              const pEnd = [
                tgtWorld.posC[0] + ev.hitOffset[0],
                tgtWorld.posC[1] + ev.hitOffset[1],
                tgtWorld.posC[2] + ev.hitOffset[2]
              ];
              const pMid = [
                lerp(p0[0], pEnd[0], 0.45) + ev.arcOffset[0],
                lerp(p0[1], pEnd[1], 0.45) + ev.arcOffset[1],
                lerp(p0[2], pEnd[2], 0.45) + ev.arcOffset[2]
              ];
              // 加速弯曲插值（初段0..0.15慢，后段急加速）
              const easeU = u * u * (2.2 - 1.2 * u);
              const a = lerp(p0[0], pMid[0], easeU), ay = lerp(p0[1], pMid[1], easeU), az = lerp(p0[2], pMid[2], easeU);
              const b = lerp(pMid[0], pEnd[0], easeU), by = lerp(pMid[1], pEnd[1], easeU), bz = lerp(pMid[2], pEnd[2], easeU);
              return [lerp(a, b, easeU), lerp(ay, by, easeU), lerp(az, bz, easeU)];
            };

            for (let m = 0; m < this.missileEvents.length; m++) {
              const ev = this.missileEvents[m];
              if (t < ev.launchT) continue;
              const ageAfterHit = t - ev.hitT;

              // 绘制实体导弹与头部推力火球
              if (ageAfterHit < 0) {
                const posNow = evalMissilePos(ev, t);
                const posNext = evalMissilePos(ev, Math.min(ev.hitT, t + 0.05));
                const fwd = Vec3.normalize([], Vec3.sub([], posNext, posNow));
                if (Vec3.len(fwd) < 0.01) fwd[2] = 1;
                const right = Vec3.normalize([], Vec3.cross([], [0, 1, 0], fwd));
                const up = Vec3.cross([], fwd, right);
                const mMat = Mat4.create();
                Mat4.fromBasisTranslation(mMat, right, up, fwd, posNow);
                drawItems.push({ mesh: this.assets.missile, model: mMat });

                // 离舰 0.35s 拉开间距后尾部亮起清晰适度的推进光核（保留体素弹体轮廓可读性）
                const ignition = smoothstep(ev.launchT + 0.28, ev.launchT + 0.55, t);
                if (ignition > 0.01) {
                  vfx.addGlow(Vec3.addScaled([], posNow, fwd, -7), 6.2 * ignition, 1.0, 0.72, 0.25, ignition);
                }
              } else if (ageAfterHit < 1.2) {
                // 命中爆闪从表层渗透入裂纹（延迟爆裂感）
                const hitPt = evalMissilePos(ev, ev.hitT);
                const hf = 1.0 - ageAfterHit / 1.2;
                vfx.addGlow(hitPt, 16 * hf + 4, 1.0, 0.65, 0.2, hf);
              }

              // 确定性回溯尾迹 Ribbon（爆闪后短暂保留于空间并逐渐消淡）
              const trailPts = [];
              const maxTrailSpan = 1.65;
              const steps = 14;
              for (let s = 0; s <= steps; s++) {
                const frac = s / steps; // 0 = head, 1 = tail
                const sampleT = Math.min(ev.hitT, t) - frac * maxTrailSpan;
                if (sampleT < ev.launchT + 0.25) break;
                // 已经爆炸多久 -> 尾迹整体淡出散开
                const postFade = ageAfterHit > 0 ? clamp(1.0 - ageAfterHit / 2.2, 0, 1) : 1.0;
                if (postFade <= 0.01) break;
                const pt = evalMissilePos(ev, sampleT);
                const wSpread = 2.8 + frac * 7.5 + Math.max(0, ageAfterHit) * 4.0;
                const heatCol = 1.0 - frac;
                trailPts.push({
                  pos: pt,
                  width: wSpread,
                  r: lerp(0.45, 1.0, heatCol),
                  g: lerp(0.50, 0.74, heatCol),
                  b: lerp(0.62, 0.28, heatCol),
                  a: 0.75 * postFade * (1.0 - frac * 0.75)
                });
              }
              if (trailPts.length >= 2) {
                vfx.addTrail(trailPts, camPos);
              }
            }

            // 陨石 C 延迟总大爆裂冲击波（t=59.3s，保留碎块体积感避免强光盖死）
            if (t >= 59.1 && t <= 62.6) {
              const bAge = t - 59.1;
              const bf = clamp(1.0 - bAge / 3.2, 0, 1);
              vfx.addGlow(tgtWorld.posC, 92 * Math.sin(clamp(bAge / 0.5, 0, 1) * Math.PI * 0.5) * bf + 16, 1.0, 0.58, 0.20, bf * 0.92);
              vfx.addShockRing(tgtWorld.posC, [0.3, 0.8, 0.5], 25 + bAge * 95, 1.0, 0.72, 0.34, bf * 0.85, false);
              if (lights.length < 15) {
                lights.push({ pos: tgtWorld.posC, radius: 520, color: [1.0, 0.62, 0.22], intensity: 7.2 * bf });
              }
            }
          }
        }

        // 填充随航速变化的宇宙高速漂浮尘屑粒子
        vfx.populateSpaceDust(camPos, travelDist, fleetSpeed, interiorMix, beamLight, thrusterCenters);
      }

      // -----------------------------------
      // 场景 B：贯通式机库 (19..26.5s)
      // -----------------------------------
      if (sceneMode === 'hangar') {
        const hMat = Mat4.create();
        drawItems.push({ mesh: this.assets.hangarHall, model: hMat });

        // 停泊位两侧停满 12 艘小艇（突显 370 格巨大跨度）
        for (const sl of this.assets.hangarSlots) {
          const sm = Mat4.fromTranslationRotationScale(Mat4.create(), sl.pos, [0, sl.rotY, 0]);
          drawItems.push({ mesh: this.assets.shuttle, model: sm });
        }

        // 两艘动态穿梭的小艇：一艘从镜头前方安全距领航滑入（远离相机防尾焰穿模），另一艘沿左通道掠过飞出！
        const u = (t - 19.0) / 7.5;
        const inPos = [lerp(-2, -16, u), lerp(3, -1, u), lerp(-108, 42, u)];
        const inMat = Mat4.fromTranslationRotationScale(Mat4.create(), inPos, [0, -0.22 * u, 0]);
        drawItems.push({ mesh: this.assets.shuttle, model: inMat });
        vfx.addThrusterPlume([inPos[0], inPos[1], inPos[2] - 13], [0, 0, -1], 1.7, 11, 0.82, [0.9, 1.0, 1.0], [0.2, 0.85, 1.0]);

        const outPos = [lerp(-18, -14, u), lerp(10, 15, u), lerp(115, -195, u)];
        const outMat = Mat4.fromTranslationRotationScale(Mat4.create(), outPos, [0, Math.PI, 0]);
        drawItems.push({ mesh: this.assets.shuttle, model: outMat });
        vfx.addThrusterPlume([outPos[0], outPos[1], outPos[2] + 13], [0, 0, 1], 1.7, 13, 0.88, [0.9, 1.0, 1.0], [0.2, 0.85, 1.0]);

        // 机库开口外方一艘掠过的护卫舰，强化内外连通空间感
        const extEscortMat = Mat4.fromTranslationRotationScale(Mat4.create(), [lerp(-280, 120, u), -45, -360], [0, 0, 0.05]);
        drawItems.push({ mesh: this.assets.guardian, model: extEscortMat });

        // 机库内部纵深引导点光（由近到远渐隐）
        lights.push({ pos: [0, 32, -120], radius: 190, color: [0.4, 0.88, 1.0], intensity: 2.2 });
        lights.push({ pos: [0, 32, -10], radius: 190, color: [1.0, 0.72, 0.35], intensity: 1.9 });
        lights.push({ pos: [0, 26, 110], radius: 220, color: [0.45, 0.92, 1.0], intensity: 2.8 });
        lights.push({ pos: [0, 16, 172], radius: 180, color: [0.65, 0.96, 1.0], intensity: 3.5 });
      }

      // -----------------------------------
      // 场景 C：动力核心中庭 (26.5..34.0s)
      // -----------------------------------
      if (sceneMode === 'reactor') {
        const idMat = Mat4.create();
        drawItems.push({ mesh: this.assets.reactorHall, model: idMat });
        drawItems.push({ mesh: this.assets.reactorCoreStatic, model: idMat });

        // 三组围绕核心缓缓旋转错位的环带
        const r1Mat = Mat4.fromTranslationRotationScale(Mat4.create(), [0, 0, 0], [0.24, t * 0.45, 0.12]);
        const r2Mat = Mat4.fromTranslationRotationScale(Mat4.create(), [0, 0, 0], [-0.36, -t * 0.32 + 1.0, 0.28]);
        const r3Mat = Mat4.fromTranslationRotationScale(Mat4.create(), [0, 0, 0], [0.18 * Math.sin(t * 0.4), t * 0.22 + 2.1, -0.32]);
        drawItems.push({ mesh: this.assets.reactorRingInner, model: r1Mat });
        drawItems.push({ mesh: this.assets.reactorRingMid, model: r2Mat });
        drawItems.push({ mesh: this.assets.reactorRingOuter, model: r3Mat });

        // 核心呼吸照明染亮多层平台底部、支持架和井壁！
        const cInt = 3.2 + 1.8 * Math.sin(t * 2.1);
        lights.push({ pos: [0, 0, 0], radius: 220, color: [0.32, 0.88, 1.0], intensity: cInt });
        lights.push({ pos: [0, 68, 0], radius: 190, color: [0.25, 0.78, 1.0], intensity: cInt * 0.75 });
        lights.push({ pos: [0, -68, 0], radius: 190, color: [0.25, 0.78, 1.0], intensity: cInt * 0.75 });
        // 核心上下流光高光粒子
        vfx.addGlow([0, 0, 0], 42, 0.38, 0.92, 1.0, 0.35 + 0.15 * Math.sin(t * 2.1));
      }

      // -----------------------------------
      // 场景 D：能量装填与导能长廊 (34.0..40.0s)
      // -----------------------------------
      if (sceneMode === 'corridor') {
        const idMat = Mat4.create();
        drawItems.push({ mesh: this.assets.corridorHall, model: idMat });

        // 分批向尽头 (+Z) 推进的 7 个发光体素能量光块（带动态移动点光源！）
        const spacing = 48;
        const speed = 28;
        for (let p = 0; p < 7; p++) {
          const zRaw = ((p * spacing + t * speed) % (7 * spacing)) - 165;
          const pm = Mat4.fromTranslationRotationScale(Mat4.create(), [0, 3, zRaw], [0, 0, 0]);
          drawItems.push({ mesh: this.assets.corridorPod, model: pm });
          if (lights.length < 14) {
            lights.push({ pos: [0, 10, zRaw], radius: 95, color: [0.35, 0.92, 1.0], intensity: 2.2 });
          }
        }

        // 两侧 6 组抽象机械臂：规律性合拢、顿位、再分开
        for (let a = 0; a < 6; a++) {
          const az = -120 + a * 48;
          // 每个站位错开相位：周期内合拢到 x=±17、退开到 x=±30，保持中央通道完全通透
          const cycle = 0.5 + 0.5 * Math.sin(t * 1.9 + a * 1.1);
          const reachX = lerp(30, 17, smoothstep(0.2, 0.8, cycle));
          // 右臂（原点在外侧，向 -X 伸展）
          const rm = Mat4.fromTranslationRotationScale(Mat4.create(), [reachX + 20, 14, az], [0, 0, 0]);
          drawItems.push({ mesh: this.assets.corridorArm, model: rm });
          // 左臂（绕 Y 旋转 180 度镜像伸向 +X）
          const lm = Mat4.fromTranslationRotationScale(Mat4.create(), [-(reachX + 20), 14, az], [0, Math.PI, 0]);
          drawItems.push({ mesh: this.assets.corridorArm, model: lm });
        }

        // 尽头发光腔口主照明（克制光晕范围以衬托栅格体素剪影）
        lights.push({ pos: [0, 22, 152], radius: 180, color: [0.45, 0.95, 1.0], intensity: 3.4 });
        vfx.addGlow([0, 22, 160], 18, 0.35, 0.92, 1.0, 0.42);
      }

      // -----------------------------------
      // 场景 E：宽阔的舰桥 (40.0..46.0s)
      // -----------------------------------
      if (sceneMode === 'bridge') {
        const idMat = Mat4.create();
        drawItems.push({ mesh: this.assets.bridgeHall, model: idMat });
        // 缓缓自转的中央全息立体体素舰队投影
        const holoMat = Mat4.fromTranslationRotationScale(
          Mat4.create(),
          this.assets.bridgeHoloPos,
          [0, (t - 40.0) * 0.35, 0]
        );
        drawItems.push({ mesh: this.assets.bridgeHolo, model: holoMat });

        // 舰桥局部发光：投影仪青光 + 两侧控制台冷蓝/琥珀光
        lights.push({ pos: [0, 16, 13], radius: 95, color: [0.35, 0.92, 1.0], intensity: 3.2 });
        lights.push({ pos: [28, 18, -10], radius: 75, color: [0.25, 0.78, 1.0], intensity: 1.5 });
        lights.push({ pos: [-28, 18, -10], radius: 75, color: [0.95, 0.65, 0.25], intensity: 1.4 });
        lights.push({ pos: [0, 32, 42], radius: 110, color: [0.4, 0.85, 1.0], intensity: 1.8 });
      }

      return {
        time: t,
        camera: {
          pos: camPos,
          target: camTarget,
          up: [0, 1, 0],
          fovDeg: camFov,
          near: 1.8,
          far: 15000
        },
        drawItems,
        lights,
        beamLight,
        thrustBoost: boostFactor,
        weaponCharge,
        corePulse,
        interiorMix,
        interiorSkyMix,
        enableShadow,
        shadowCenter,
        shadowExtent,
        bloomStrength: sceneMode === 'reactor' ? 0.44 : 0.38,
        exposure: 1.08,
        renderVFX: (renderer) => {
          renderer.currentTime = t;
          vfx.render(renderer, { pos: camPos });
        }
      };
    }
  }

  SF.Timeline = {
    TOTAL_DURATION,
    RUNS,
    TimelineDirector
  };
})(window);
