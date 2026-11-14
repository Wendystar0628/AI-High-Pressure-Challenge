(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  // -------------------------------------------------------
  // 1. 宽阔的舰桥（130 x 130 x 60 格）
  //    X: [-65..+65], Y: [-8..+54], Z: [-65..+65], +Z 朝向宽阔观景窗
  // -------------------------------------------------------
  function buildBridge() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const vol = new VoxelVolume();

    // 主地板与下层凹槽（Z = -65..+65）
    vol.fillBox(-65, -8, -65, 65, -4, 65, Mat.FRAME_DEEP);
    vol.fillBox(-65, -3, -65, 65, -1, 65, Mat.HULL_SECONDARY);
    // 中央通道光带与阶梯中枢台基座
    vol.fillBox(-5, -1, -60, 5, -1, 56, Mat.FRAME_DARK);
    vol.fillBoxSymX(4, 5, -1, -1, -58, 56, Mat.GLOW_CYAN);

    // 侧层退让控制平台（两层挑台 + 侧廊）
    // 中层平台 y = 8 (X = ±26 .. ±64)
    vol.fillBoxSymX(28, 64, 5, 8, -58, 52, Mat.HULL_PRIMARY);
    vol.fillBoxSymX(27, 29, 8, 10, -56, 50, Mat.FRAME_DARK);
    vol.fillBoxSymX(27, 27, 10, 10, -56, 50, Mat.GLOW_CYAN); // 扶手微亮边缘
    // 高层侧廊 y = 22 (X = ±44 .. ±64)
    vol.fillBoxSymX(44, 64, 19, 22, -58, 44, Mat.HULL_SECONDARY);
    vol.fillBoxSymX(43, 45, 22, 24, -56, 42, Mat.FRAME_DARK);
    vol.fillBoxSymX(43, 43, 24, 24, -56, 42, Mat.GLOW_AMBER);

    // 后墙与两侧封闭围壁（Z = -65 封闭；X = ±65 封闭）
    vol.fillBox(-65, -4, -65, 65, 54, -62, Mat.FRAME_DARK);
    vol.fillBoxSymX(62, 65, -4, 54, -64, 64, Mat.FRAME_DARK);
    // 两侧壁纵向加强肋柱（每 24 格一根）
    for (let z = -54; z <= 48; z += 24) {
      vol.fillBoxSymX(58, 62, -1, 52, z, z + 5, Mat.HULL_SECONDARY);
      vol.fillBoxSymX(57, 58, 12, 36, z + 2, z + 3, Mat.GLOW_CYAN);
    }

    // 顶棚及 4 道跨空双叉梁架（Y = 48..54）
    vol.fillBox(-65, 51, -65, 65, 54, 65, Mat.FRAME_DEEP);
    for (let z = -44; z <= 46; z += 30) {
      vol.fillBox(-64, 44, z, 64, 51, z + 7, Mat.HULL_SECONDARY);
      vol.fillBox(-32, 41, z + 1, 32, 44, z + 6, Mat.FRAME_DARK);
      vol.fillBox(-26, 40, z + 3, 26, 41, z + 4, Mat.GLOW_CYAN);
      vol.fillBoxSymX(40, 56, 42, 44, z + 2, z + 5, Mat.TRIM_BRONZE);
    }

    // 前方宏伟“双叉环抱观景开口”（Z = +62..+65）
    // 保持中间 X=[-52..+52], Y=[4..43] 完全敞开直接看窗外宇宙舰队！
    vol.fillBox(-65, -1, 61, 65, 4, 65, Mat.HULL_PRIMARY);       // 下窗台护框
    vol.fillBox(-52, 4, 62, 52, 5, 64, Mat.TRIM_BRONZE);
    vol.fillBox(-65, 43, 61, 65, 52, 65, Mat.HULL_PRIMARY);      // 上窗檐
    vol.fillBoxSymX(52, 65, 4, 43, 61, 65, Mat.HULL_PRIMARY);    // 左右立框
    // 两根斜向分叉前景结构柱（靠近角落不挡中央视野，增强景深层次）
    vol.fillBoxSymX(42, 48, 4, 44, 58, 63, Mat.FRAME_DARK);
    vol.fillBoxSymX(46, 52, 16, 30, 59, 64, Mat.TRIM_BRONZE);

    // 两侧和底层成组控制台与悬置显示板（沿纵深排开多组）
    function placeConsole(cx, cy, cz, side) {
      vol.fillBox(cx - 4, cy, cz - 7, cx + 4, cy + 4, cz + 7, Mat.FRAME_DARK);
      vol.fillBox(cx - 3, cy + 4, cz - 6, cx + 3, cy + 5, cz + 6, Mat.HULL_SECONDARY);
      // 发光操作界面
      const screenX = cx - side * 2;
      vol.fillBox(screenX - 1, cy + 5, cz - 4, screenX + 1, cy + 5, cz + 4, Mat.GLOW_CYAN);
      // 上方悬置透明体素显示板（保留空隙，体素构建）
      vol.fillBox(cx - 1, cy + 8, cz - 6, cx, cy + 14, cz + 6, Mat.GLASS_TRANS);
      vol.fillBox(cx - 1, cy + 11, cz - 4, cx, cy + 12, cz + 4, Mat.GLASS_AMBER);
    }

    for (let z = -42; z <= 36; z += 26) {
      // 主层两排靠前操作台
      placeConsole(18, 0, z, 1);
      placeConsole(-18, 0, z, -1);
      // 中层平台操作台
      placeConsole(36, 9, z - 6, 1);
      placeConsole(-36, 9, z - 6, -1);
      // 高层侧廊操作台
      if (z <= 16) {
        placeConsole(52, 23, z, 1);
        placeConsole(-52, 23, z, -1);
      }
    }

    // 中央指挥中枢基座（Z = +4 .. +26, X = -14..+14）—— 暗色基座衬托上方立体投影！
    vol.fillHollowBox(-13, 0, 2, 13, 4, 24, 2, Mat.FRAME_DARK);
    vol.fillBox(-10, 4, 5, 10, 6, 21, Mat.FRAME_DEEP);
    vol.fillBox(-7, 6, 8, 7, 7, 18, Mat.TRIM_BRONZE);
    vol.fillBox(-5, 7, 10, 5, 7, 16, Mat.FRAME_DARK);
    vol.fillBox(-5, 7, 10, 5, 7, 10, Mat.GLOW_CYAN);
    vol.fillBox(-5, 7, 16, 5, 7, 16, Mat.GLOW_CYAN);

    // 独立悬浮体素全息沙盘（旗舰轮廓+护卫光点+轨道环）
    const holoVol = new VoxelVolume();
    // 微缩体素旗舰剪影（约 20 格长）
    holoVol.fillBox(-1, -1, -9, 1, 1, 9, Mat.GLOW_BRIDGE_HOLO);
    holoVol.fillBoxSymX(2, 3, 0, 1, -5, 5, Mat.GLOW_BRIDGE_HOLO);
    holoVol.fillBoxSymX(1, 2, 0, 1, 7, 11, Mat.GLASS_AMBER); // 双叉舰首微缩
    // 外围微缩护卫光点体素与前方小行星威胁集群标记
    holoVol.set(-9, 2, 4, Mat.GLASS_AMBER);
    holoVol.set(9, -2, 3, Mat.GLASS_AMBER);
    holoVol.set(-7, -1, -7, Mat.GLOW_BRIDGE_HOLO);
    holoVol.set(7, 2, -6, Mat.GLOW_BRIDGE_HOLO);
    holoVol.set(0, 4, 14, Mat.GLASS_AMBER);
    holoVol.fillBox(-1, 3, 14, 0, 4, 15, Mat.GLASS_AMBER);
    holoVol.set(-5, 3, 13, Mat.GLASS_AMBER);
    holoVol.set(6, 2, 16, Mat.GLASS_AMBER);
    holoVol.set(-4, -2, 15, Mat.GLOW_BRIDGE_HOLO);
    holoVol.set(4, 5, 14, Mat.GLOW_BRIDGE_HOLO);
    // 环形投影标尺体素圈（保持1格颗粒）
    for (let a = 0; a < 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      const hx = Math.round(Math.cos(ang) * 12);
      const hz = Math.round(Math.sin(ang) * 12);
      holoVol.set(hx, -4, hz, a % 4 === 0 ? Mat.GLASS_AMBER : Mat.GLOW_BRIDGE_HOLO);
    }

    return {
      hallMeshData: buildGreedyMesh(vol, { freeAfter: true }),
      holoMeshData: buildGreedyMesh(holoVol, { freeAfter: true }),
      holoPos: [0, 14, 13]
    };
  }

  // -------------------------------------------------------
  // 2. 动力核心中庭（250 x 250 x 250 格）
  //    X, Y, Z: [-125 .. +125]
  // -------------------------------------------------------
  function buildReactorAtrium() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const { lerp } = SF.Math;
    const hallVol = new VoxelVolume();

    // 外围巨大八边形垂直井壁（半径 ~120 格，高 250 格）
    for (let y = -124; y <= 124; y += 8) {
      const yEnd = Math.min(124, y + 7);
      // 上下端面收束封闭，中间 120 格半径
      const r = Math.abs(y) > 96 ? Math.round(lerp(120, 74, (Math.abs(y) - 96) / 28)) : 120;
      // 用 4 面墙 + 4 斜角围合八角筒壁
      hallVol.fillBox(-r, y, -r, r, yEnd, -r + 4, Mat.FRAME_DEEP);
      hallVol.fillBox(-r, y, r - 4, r, yEnd, r, Mat.FRAME_DEEP);
      hallVol.fillBox(-r, y, -r, -r + 4, yEnd, r, Mat.FRAME_DEEP);
      hallVol.fillBox(r - 4, y, -r, r, yEnd, r, Mat.FRAME_DEEP);

      // 井壁每隔 40 格设一道粗大竖向承重柱 + 微亮导光带
      for (const p of [-60, 0, 60]) {
        hallVol.fillBox(p - 6, y, -r + 4, p + 6, yEnd, r > 100 ? -r + 12 : -r + 8, Mat.HULL_SECONDARY);
        hallVol.fillBox(p - 6, y, r - (r > 100 ? 12 : 8), p + 6, yEnd, r - 4, Mat.HULL_SECONDARY);
        hallVol.fillBox(-r + 4, y, p - 6, r > 100 ? -r + 12 : -r + 8, yEnd, p + 6, Mat.HULL_SECONDARY);
        hallVol.fillBox(r - (r > 100 ? 12 : 8), y, p - 6, r - 4, yEnd, p + 6, Mat.HULL_SECONDARY);
      }
      if ((y + 4) % 24 === 0 && Math.abs(y) < 100) {
        hallVol.fillBox(-r + 6, y + 3, -r + 5, r - 6, y + 6, -r + 6, Mat.GLOW_CYAN);
        hallVol.fillBox(-r + 6, y + 3, r - 6, r - 6, y + 6, r - 5, Mat.GLOW_CYAN);
        hallVol.fillBox(-r + 5, y + 3, -r + 6, -r + 6, y + 6, r - 6, Mat.GLOW_CYAN);
        hallVol.fillBox(r - 6, y + 3, -r + 6, r - 5, y + 6, r - 6, Mat.GLOW_CYAN);
      }
    }

    // 北侧上层（X=+30, Y=+51, Z=+114）通往导能走廊的能量传输导口（衔接 33.9->34.0s 转场）
    hallVol.fillBox(16, 43, 113, 44, 59, 117, Mat.FRAME_DARK);
    hallVol.fillBox(19, 45, 113, 41, 57, 116, Mat.TRIM_BRONZE);
    hallVol.fillBox(20, 46, 113, 40, 56, 115, Mat.AIR); // 掏空前表面门洞以显露内凹发光腔体
    hallVol.fillBox(20, 46, 115, 40, 56, 116, Mat.GLOW_CYAN);
    hallVol.fillBox(24, 49, 114, 36, 53, 115, Mat.GLOW_CYAN_HOT);

    // 顶盖与底盘（Y = ±122），中央留聚能口
    hallVol.fillBox(-80, -125, -80, 80, -120, 80, Mat.FRAME_DARK);
    hallVol.fillBox(-80, 120, -80, 80, 125, 80, Mat.FRAME_DARK);
    hallVol.fillBox(-26, -120, -26, 26, -108, 26, Mat.HULL_PRIMARY);
    hallVol.fillBox(-26, 108, -26, 26, 120, 26, Mat.HULL_PRIMARY);
    hallVol.fillBox(-16, -110, -16, 16, -102, 16, Mat.GLOW_CORE);
    hallVol.fillBox(-16, 102, -16, 16, 110, 16, Mat.GLOW_CORE);

    // 5 层环形/分叉悬挑平台（Y = -78, -39, 0, +39, +78）
    // 平台外接井壁 116，内圈 78，与半径 36 的中央核心保持 42 格极宽阔环空！
    const deckLevels = [-78, -39, 0, 39, 78];
    for (let li = 0; li < deckLevels.length; li++) {
      const py = deckLevels[li];
      const innerR = (li % 2 === 0) ? 78 : 84;
      const outerR = 116;
      // 四向环形悬挑楼板（每层有 4 处大平台及斜连廊）
      hallVol.fillBox(-outerR, py - 3, -outerR, outerR, py, -innerR, Mat.HULL_PRIMARY);
      hallVol.fillBox(-outerR, py - 3, innerR, outerR, py, outerR, Mat.HULL_PRIMARY);
      hallVol.fillBox(-outerR, py - 3, -innerR, -innerR, py, innerR, Mat.HULL_PRIMARY);
      hallVol.fillBox(innerR, py - 3, -innerR, outerR, py, innerR, Mat.HULL_PRIMARY);
      // 平台底部肋架与发光边沿
      hallVol.fillBox(-innerR, py, -innerR, innerR, py + 2, -innerR + 2, Mat.TRIM_BRONZE);
      hallVol.fillBox(-innerR, py, innerR - 2, innerR, py + 2, innerR, Mat.TRIM_BRONZE);
      hallVol.fillBox(-innerR, py, -innerR, -innerR + 2, py + 2, innerR, Mat.TRIM_BRONZE);
      hallVol.fillBox(innerR - 2, py, -innerR, innerR, py + 2, innerR, Mat.TRIM_BRONZE);
      // 4 处向中央核心探出的导能桥舌（止步于半径 68，彻底避开 r=59 螺旋运镜通道）
      for (const s of [-1, 1]) {
        hallVol.fillBox(-10, py - 4, s * 68, 10, py, s * innerR, Mat.HULL_SECONDARY);
        hallVol.fillBox(-2, py, s * 68, 2, py + 1, s * innerR, Mat.GLOW_CYAN);
        hallVol.fillBox(s * 68, py - 4, -10, s * innerR, py, 10, Mat.HULL_SECONDARY);
        hallVol.fillBox(s * 68, py, -2, s * innerR, py + 1, 2, Mat.GLOW_CYAN);
      }
    }

    // 8 根巨大“斜向抱合支撑臂”（从外井壁上下斜跨向核心上下两极）
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const sy of [-1, 1]) {
          // 沿参数路径用体素块步进生成粗大斜梁
          for (let step = 0; step <= 26; step++) {
            const u = step / 26;
            const bx = Math.round(sx * lerp(112, 24, u));
            const by = Math.round(sy * lerp(92, 54, u));
            const bz = Math.round(sz * lerp(112, 24, u));
            hallVol.fillBox(bx - 4, by - 4, bz - 4, bx + 4, by + 4, bz + 4, step % 4 === 0 ? Mat.TRIM_BRONZE : Mat.FRAME_DARK);
            if (step % 3 === 0) {
              hallVol.set(bx, by - sy * 4, bz, Mat.GLOW_CYAN);
            }
          }
        }
      }
    }

    // 中央核心静态柱体（包含发光内核 + 透明包裹晶体体素 + 十字约束构架）
    const coreStaticVol = new VoxelVolume();
    coreStaticVol.fillBox(-14, -102, -14, 14, 102, 14, Mat.GLOW_CORE);
    // 半透明玻璃晶体套层（体现统一体素尺寸）
    coreStaticVol.fillHollowBox(-18, -66, -18, 18, 66, 18, 2, Mat.GLASS_TRANS);
    // 上下极冠暗构架
    coreStaticVol.fillHollowBox(-24, 52, -24, 24, 72, 24, 4, Mat.HULL_PRIMARY);
    coreStaticVol.fillHollowBox(-24, -72, -24, 24, -52, 24, 4, Mat.HULL_PRIMARY);
    // 4 根纵向竖直约束肋框
    coreStaticVol.fillBoxSymX(18, 23, -64, 64, -4, 4, Mat.FRAME_DARK);
    coreStaticVol.fillBox(-4, -64, 18, 4, 64, 23, Mat.FRAME_DARK);
    coreStaticVol.fillBox(-4, -64, -23, 4, 64, -18, Mat.FRAME_DARK);

    // 3 组围绕核心旋转错位的体素环带（小/中/大，延续双瓣层片语言）
    function buildCoreRing(radius, thickness, height, matShell, matGlow, gapCount) {
      const rVol = new VoxelVolume();
      const rOut = radius;
      const rIn = radius - thickness;
      for (let z = -rOut; z <= rOut; z++) {
        for (let x = -rOut; x <= rOut; x++) {
          const d = Math.hypot(x, z);
          if (d >= rIn && d <= rOut) {
            const ang = Math.atan2(z, x);
            const seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * gapCount * 2);
            if (seg % 2 === 0) {
              // 主弧段（内外表面加嵌发光带与上下铜金收边，近看层次分明）
              rVol.fillBox(x, -height, z, x, height, z, matShell);
              if (d < rIn + 2) {
                rVol.fillBox(x, -1, z, x, 1, z, matGlow);
              } else if (d > rOut - 1.5) {
                rVol.set(x, -height, z, Mat.TRIM_BRONZE);
                rVol.set(x, height, z, Mat.TRIM_BRONZE);
                rVol.set(x, 0, z, matGlow);
              }
            } else if (d > (rIn + rOut) * 0.45 && d < (rIn + rOut) * 0.55) {
              // 空隙间连细肋环
              rVol.fillBox(x, -1, z, x, 1, z, Mat.FRAME_DARK);
            }
          }
        }
      }
      return buildGreedyMesh(rVol, { freeAfter: true });
    }

    const ringInner = buildCoreRing(29, 5, 6, Mat.HULL_LIGHT, Mat.GLOW_AMBER, 4);
    const ringMid = buildCoreRing(39, 6, 7, Mat.HULL_PRIMARY, Mat.GLOW_CYAN_HOT, 6);
    const ringOuter = buildCoreRing(48, 6, 7, Mat.HULL_SECONDARY, Mat.GLOW_CYAN, 4);

    return {
      hallMeshData: buildGreedyMesh(hallVol, { freeAfter: true }),
      coreStaticMeshData: buildGreedyMesh(coreStaticVol, { freeAfter: true }),
      ringInner,
      ringMid,
      ringOuter
    };
  }

  // -------------------------------------------------------
  // 3. 贯通式机库（长 370 格、宽 104 格、高 66 格）
  //    Z: [-185..+185], X: [-52..+52], Y: [-12..+54]
  //    Z = -185 为对外巨大开口，Z = +185 为远端发光检修腔
  // -------------------------------------------------------
  function buildHangar() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const vol = new VoxelVolume();

    // 地板（Y = -12..-8）与中心导引停机坪
    vol.fillBox(-52, -12, -185, 52, -8, 185, Mat.HULL_SECONDARY);
    // 跑道中心高亮导引线与两侧停泊界线
    for (let z = -175; z <= 175; z += 18) {
      vol.fillBox(-2, -8, z, 2, -8, z + 10, Mat.GLOW_CYAN);
      vol.fillBoxSymX(22, 23, -8, -8, z, z + 12, Mat.GLOW_AMBER);
    }

    // 顶部框架（Y = 48..54）与贯通照明灯槽
    vol.fillBox(-52, 48, -185, 52, 54, 185, Mat.FRAME_DEEP);
    for (let z = -165; z <= 165; z += 28) {
      vol.fillBox(-24, 46, z, 24, 48, z + 6, Mat.GLOW_CYAN);
    }

    // 两侧墙与各 6 个停泊凹位（z = -150 .. +150，间距 52 格）
    vol.fillBoxSymX(50, 54, -12, 54, -185, 185, Mat.FRAME_DEEP);
    const parkedShuttleSlots = [];
    for (let z = -140; z <= 130; z += 54) {
      // 凹位之间粗大承重立柱
      vol.fillBoxSymX(40, 50, -8, 48, z - 26, z - 16, Mat.HULL_PRIMARY);
      vol.fillBoxSymX(39, 41, 0, 38, z - 24, z - 18, Mat.TRIM_BRONZE);
      // 停泊凹位背景暗板与克制上下引导微光条（绝不刺眼过曝）
      vol.fillBoxSymX(49, 50, 20, 21, z - 12, z + 12, Mat.GLOW_AMBER);
      vol.fillBoxSymX(49, 50, 2, 3, z - 12, z + 12, Mat.GLOW_CYAN);
      // 凹位内停泊小艇锚点（略往通道靠近更易从主通道读出体量对比）
      parkedShuttleSlots.push({ pos: [33, -2, z], rotY: -Math.PI * 0.5 });
      parkedShuttleSlots.push({ pos: [-33, -2, z], rotY: Math.PI * 0.5 });

      // 上方横跨的“倒楔形跨舱天车桥架”（X = -50..+50, Y = 33..48）
      vol.fillBox(-50, 36, z - 24, 50, 46, z - 16, Mat.FRAME_DARK);
      vol.fillBox(-34, 33, z - 23, 34, 36, z - 17, Mat.HULL_SECONDARY);
      vol.fillBoxSymX(16, 28, 30, 33, z - 22, z - 18, Mat.TRIM_BRONZE);
      // 从侧边伸出的抽象维修吊臂构架（无任何人形）
      vol.fillBoxSymX(34, 46, 14, 18, z - 22, z - 18, Mat.HULL_PRIMARY);
      vol.fillBoxSymX(34, 37, 6, 14, z - 21, z - 19, Mat.FRAME_DARK);
      vol.set(35, 5, z - 20, Mat.GLOW_AMBER);
      vol.set(-35, 5, z - 20, Mat.GLOW_AMBER);
    }

    // 第二重退让内舱门框（Z = +48 .. +62，大幅缩窄再展开远端段）
    vol.fillBoxSymX(28, 52, -8, 48, 48, 62, Mat.HULL_PRIMARY);
    vol.fillBox(-28, 32, 48, 28, 48, 62, Mat.HULL_PRIMARY);
    vol.fillBoxSymX(26, 29, -8, 33, 50, 60, Mat.TRIM_BRONZE);
    vol.fillBox(-26, 30, 50, 26, 32, 60, Mat.GLOW_AMBER);

    // 远端尽头封墙与高对比退让远端反应堆对接闸门（Z = +175..+185）
    vol.fillBox(-52, -12, 181, 52, 54, 185, Mat.FRAME_DARK);
    vol.fillHollowBox(-28, -4, 175, 28, 30, 180, 3, Mat.HULL_PRIMARY);
    vol.fillBox(-21, 1, 175, 21, 25, 180, Mat.AIR); // 掏空外框门洞，避免实心封死内凹闸门
    vol.fillBox(-21, 1, 180, 21, 25, 182, Mat.FRAME_DEEP);
    vol.fillBoxSymX(19, 21, 1, 25, 176, 179, Mat.TRIM_BRONZE);
    vol.fillBox(-18, 10, 178, 18, 15, 179, Mat.GLOW_CYAN);
    vol.fillBox(-2, 2, 178, 2, 24, 179, Mat.GLOW_AMBER);
    vol.fillBoxSymX(9, 11, 2, 24, 178, 179, Mat.FRAME_DARK);

    // 外入口门框加强双叉缘与对接青/琥珀导引灯条（Z = -185..-175）
    vol.fillBoxSymX(40, 54, -12, 54, -185, -175, Mat.HULL_PRIMARY);
    vol.fillBox(-54, 42, -185, 54, 54, -175, Mat.HULL_PRIMARY);
    vol.fillBoxSymX(39, 41, -6, 38, -184, -176, Mat.GLOW_AMBER);
    vol.fillBox(-38, 40, -184, 38, 42, -178, Mat.GLOW_CYAN);

    return {
      meshData: buildGreedyMesh(vol, { freeAfter: true }),
      parkedShuttleSlots
    };
  }

  // -------------------------------------------------------
  // 4. 能量装填与导能长廊（长 340、宽 104、高 74）
  //    Z: [-170..+170], X: [-52..+52], Y: [-14..+60]
  // -------------------------------------------------------
  function buildEnergyCorridor() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const vol = new VoxelVolume();

    // 底层中央导轨（输送发光能量光块）与深色夹层底座
    vol.fillBox(-52, -14, -170, 52, -8, 170, Mat.FRAME_DEEP);
    vol.fillBox(-14, -8, -170, 14, -3, 170, Mat.FRAME_DARK);
    vol.fillBoxSymX(9, 12, -3, 0, -168, 168, Mat.HULL_SECONDARY);
    vol.fillBox(-3, -4, -168, 3, -3, 168, Mat.GLOW_CORE); // 导轨底 +Z 流动能量脉络
    vol.fillBoxSymX(7, 8, -2, -1, -168, 168, Mat.GLOW_CORE);

    // 顶棚结构与上层流光主干
    vol.fillBox(-52, 54, -170, 52, 60, 170, Mat.FRAME_DEEP);
    vol.fillBox(-16, 48, -168, 16, 54, 168, Mat.FRAME_DARK);
    vol.fillBox(-4, 46, -168, 4, 48, 168, Mat.GLOW_CORE);
    vol.fillBoxSymX(11, 12, 47, 48, -168, 168, Mat.GLOW_CYAN);

    // 两侧外墙
    vol.fillBoxSymX(49, 53, -14, 60, -170, 170, Mat.FRAME_DEEP);

    // 7 跨粗大“双叉门形承重框架” + 两侧高大装填装置柱（间距 48 格）
    for (let z = -144; z <= 144; z += 48) {
      // 巨型跨框架
      vol.fillBoxSymX(30, 50, -8, 54, z - 6, z + 6, Mat.HULL_PRIMARY);
      vol.fillBox(-50, 38, z - 6, 50, 54, z + 6, Mat.HULL_PRIMARY);
      // 框内层嵌铜金转折和深层骨架
      vol.fillBoxSymX(27, 30, 4, 34, z - 4, z + 4, Mat.FRAME_DARK);
      vol.fillBoxSymX(26, 28, 12, 26, z - 2, z + 2, Mat.TRIM_BRONZE);

        // 跨间之间的高大竖立装填槽列装置（位于 z+24）
      if (z < 140) {
        const az = z + 24;
        vol.fillBoxSymX(34, 48, -8, 46, az - 10, az + 10, Mat.HULL_SECONDARY);
        vol.fillBoxSymX(32, 35, 0, 38, az - 4, az + 4, Mat.FRAME_DARK);
        vol.fillBoxSymX(31, 32, 6, 32, az - 1, az + 1, Mat.GLOW_CORE);
        // 上方悬置导能斜块
        vol.fillBoxSymX(20, 30, 34, 44, az - 6, az + 6, Mat.HULL_PRIMARY);
        vol.fillBoxSymX(19, 21, 36, 38, az - 2, az + 2, Mat.GLOW_AMBER);
      }
    }

    // 远端（Z = +154..+170）逐层阶梯收束、宽阔透深的主炮供能发光腔口
    vol.fillBox(-52, -14, 166, 52, 60, 170, Mat.FRAME_DEEP);
    // 外层主装甲框（先建后掏空内腔）
    vol.fillBox(-36, 2, 158, 36, 42, 165, Mat.HULL_PRIMARY);
    vol.fillBox(-26, 8, 158, 26, 36, 166, Mat.AIR);
    // 中层铜金内嵌阶梯框（先建后掏空内腔）
    vol.fillBox(-26, 8, 154, 26, 36, 158, Mat.TRIM_BRONZE);
    vol.fillBox(-18, 12, 154, 18, 32, 166, Mat.AIR);
    // 腔口内壁导能亮框与纵深交错导流格栅（避免 39.9s 贴近时大片白场过曝，保留清晰体素与色彩过渡）
    vol.fillBoxSymX(18, 20, 12, 32, 156, 165, Mat.GLOW_CYAN);
    vol.fillBox(-18, 11, 156, 18, 12, 165, Mat.GLOW_CYAN);
    vol.fillBox(-18, 32, 156, 18, 33, 165, Mat.GLOW_CYAN);
    vol.fillBox(-16, 13, 164, 16, 31, 166, Mat.GLOW_CYAN);
    vol.fillBox(-5, 14, 163, 5, 30, 165, Mat.GLOW_CYAN_HOT);
    // 前置纵深结构格栅：垂直铜金/深铁约束肋与水平暗铁分流梁
    vol.fillBoxSymX(7, 10, 12, 32, 161, 164, Mat.FRAME_DARK);
    vol.fillBoxSymX(8, 9, 13, 31, 160, 162, Mat.TRIM_BRONZE);
    vol.fillBox(-16, 21, 161, 16, 23, 163, Mat.FRAME_DARK);
    vol.fillBox(-15, 21, 160, 15, 22, 161, Mat.TRIM_BRONZE);
    vol.fillBox(-3, 20, 160, 3, 24, 163, Mat.HULL_SECONDARY);
    // 后端封堵墙（Z = -170）
    vol.fillBox(-52, -14, -170, 52, 60, -166, Mat.FRAME_DARK);

    // 动态分批前进的能量光块单元（厚重深框+清晰青光内芯+顶部窄流光窗，避免大面积过曝泛白）
    const podVol = new VoxelVolume();
    podVol.fillBox(-6, -3, -8, 6, 3, 8, Mat.GLOW_CYAN);
    podVol.fillBox(-3, -2, -5, 3, 3, 5, Mat.GLOW_CYAN_HOT);
    podVol.fillHollowBox(-8, -5, -10, 8, 5, 10, 2, Mat.FRAME_DARK);
    // 顶部钢蓝护轨 + 中心青白流光狭槽 + 两侧铜金抱夹
    podVol.fillBox(-2, 4, -6, 2, 5, 6, Mat.GLOW_CYAN);
    podVol.fillBox(-1, 5, -4, 1, 5, 4, Mat.GLOW_CYAN_HOT);
    podVol.fillBoxSymX(3, 6, 4, 5, -8, 8, Mat.HULL_SECONDARY);
    podVol.fillBoxSymX(7, 9, -2, 2, -6, 6, Mat.TRIM_BRONZE);
    podVol.fillBoxSymX(7, 8, -1, 1, -4, 4, Mat.GLOW_CYAN);

    // 动态抽象合拢/分开的夹取机械臂（双叉细长镂空骨架，绝不形成实心阻塞块）
    const armVol = new VoxelVolume();
    armVol.fillBox(-18, 2, -2, 0, 5, 2, Mat.HULL_PRIMARY);
    armVol.fillBox(-18, -5, -2, 0, -2, 2, Mat.HULL_PRIMARY);
    armVol.fillBox(-22, -7, -3, -17, 7, 3, Mat.FRAME_DARK);
    armVol.fillBox(-24, -4, -1, -21, 4, 1, Mat.TRIM_BRONZE);
    armVol.fillBox(-24, -1, 0, -23, 1, 0, Mat.GLOW_AMBER);

    return {
      hallMeshData: buildGreedyMesh(vol, { freeAfter: true }),
      podMeshData: buildGreedyMesh(podVol, { freeAfter: true }),
      armMeshData: buildGreedyMesh(armVol, { freeAfter: true })
    };
  }

  SF.buildInteriors = function () {
    return {
      bridge: buildBridge(),
      reactor: buildReactorAtrium(),
      hangar: buildHangar(),
      corridor: buildEnergyCorridor()
    };
  };
})(window);
