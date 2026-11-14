(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  function buildFlagship() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const { clamp, lerp } = SF.Math;
    const vol = new VoxelVolume();

    // 辅助函数：填充对称空心截面框（只填厚度 thick 的外壳壁，不填内部空心）
    function fillShellBoxSymX(xMin, xMax, yMin, yMax, z0, z1, thick, mat) {
      const x0 = xMin | 0, x1 = xMax | 0;
      const y0 = yMin | 0, y1 = yMax | 0;
      const za = z0 | 0, zb = z1 | 0;
      if (x1 < x0 || y1 < y0 || zb < za) return;
      // 如果 xMin == 0 表示跨中轴合并整体
      if (x0 <= 0 && x1 >= 0) {
        vol.fillHollowBox(-x1, y0, za, x1, y1, zb, thick, mat);
      } else {
        vol.fillHollowBox(x0, y0, za, x1, y1, zb, thick, mat);
        vol.fillHollowBox(-x1, y0, za, -x0, y1, zb, thick, mat);
      }
    }

    // 辅助函数：雕刻一个向 -Z 或 +Z 退让深腔喷口
    function carveThruster(cx, cy, zTip, depth, radiusX, radiusY) {
      const zBack = zTip + depth;
      // 外口沿斜阶梯环
      for (let d = 0; d < depth; d++) {
        const z = zTip + d;
        const t = d / depth;
        // 阶梯收口：口沿略厚，深处收窄
        const stepOut = d < 5 ? 3 : d < 12 ? 1 : 0;
        const rx = Math.max(4, (radiusX + stepOut - t * 3) | 0);
        const ry = Math.max(4, (radiusY + stepOut - t * 3) | 0);

        // 先挖空中心喷口通道
        vol.fillBox(cx - rx + 3, cy - ry + 3, z, cx + rx - 3, cy + ry - 3, z, Mat.AIR);

        // 喷口外壁（切角八边形外形）
        const wallMat = d < 3 ? Mat.TRIM_BRONZE : d % 5 === 0 ? Mat.FRAME_DARK : Mat.ENGINE_INTERIOR;
        for (let dy = -ry; dy <= ry; dy++) {
          for (let dx = -rx; dx <= rx; dx++) {
            // 倒角矩形距离
            const nx = Math.abs(dx) / rx;
            const ny = Math.abs(dy) / ry;
            if (nx + ny > 1.48) continue;
            const innerX = Math.abs(dx) < rx - 3;
            const innerY = Math.abs(dy) < ry - 3;
            const innerCorner = nx + ny < 1.18;
            if (innerX && innerY && innerCorner) continue;
            vol.set(cx + dx, cy + dy, z, wallMat);
          }
        }
      }
      // 喷口最深处亮核与导流十字叶片
      const coreZ = zBack - 2;
      const crx = Math.max(3, radiusX - 5);
      const cry = Math.max(3, radiusY - 5);
      vol.fillBox(cx - crx, cy - cry, coreZ - 2, cx + crx, cy + cry, coreZ, Mat.GLOW_THRUSTER_CORE);
      // 内部十字阻流结构遮挡形成细节
      vol.fillBox(cx - crx, cy - 1, coreZ - 6, cx + crx, cy + 1, coreZ - 4, Mat.ENGINE_INTERIOR);
      vol.fillBox(cx - 1, cy - cry, coreZ - 6, cx + 1, cy + cry, coreZ - 4, Mat.ENGINE_INTERIOR);
      // 口沿外圈微亮导环
      vol.fillBox(cx - radiusX + 2, cy - radiusY + 2, zTip + 4, cx + radiusX - 2, cy - radiusY + 2, zTip + 4, Mat.GLOW_CYAN);
      vol.fillBox(cx - radiusX + 2, cy + radiusY - 2, zTip + 4, cx + radiusX - 2, cy + radiusY - 2, zTip + 4, Mat.GLOW_CYAN);
    }

    // -------------------------------------------------------
    // 1. 旗舰中央龙骨与主体轮廓（z: -560 .. +560，全长 1120 格）
    // -------------------------------------------------------
    // 先沿 Z 切片构造分段主壳与深槽分隔
    for (let z = -540; z <= 560; z += 4) {
      const zEnd = Math.min(560, z + 3);

      // 判定当前处于哪个主区段（每段之间留出深槽带）
      const isDeepSlot =
        (z >= 246 && z <= 262) ||
        (z >= 122 && z <= 138) ||
        (z >= -8 && z <= 8) ||
        (z >= -138 && z <= -122) ||
        (z >= -268 && z <= -252) ||
        (z >= -378 && z <= -364);

      // 舰身主包络宽/高函数（沿舰长高低宽窄起伏）
      let halfW, halfTop, halfBot;
      if (z > 260) {
        // 舰首双叉段：z=260..560，逐渐收尖并前分叉
        const u = (z - 260) / 300; // 0 -> 1
        halfW = Math.round(lerp(74, 24, Math.pow(u, 0.85)));
        halfTop = Math.round(lerp(36, 18, u));
        halfBot = Math.round(lerp(34, 15, u));
      } else if (z > -340) {
        // 中段厚重主体：在中部隆起并带缓和梯度
        const u = (z + 340) / 600; // 0 -> 1
        const swell = Math.sin(u * Math.PI);
        halfW = Math.round(74 + 14 * swell);
        halfTop = Math.round(36 + 10 * swell);
        halfBot = Math.round(34 + 12 * swell);
      } else {
        // 舰尾逐层退让收束段：z=-540..-340
        const u = (z + 540) / 200; // 0(stern) -> 1
        halfW = Math.round(lerp(56, 74, u));
        halfTop = Math.round(lerp(28, 36, u));
        halfBot = Math.round(lerp(26, 34, u));
      }

      if (isDeepSlot) {
        // 深槽段：大幅内缩为深层暗构架和连接梁 + 发光缝隙
        const slotW = Math.max(12, halfW - 14);
        const slotTop = Math.max(10, halfTop - 9);
        const slotBot = Math.max(10, halfBot - 9);
        vol.fillHollowBox(-slotW, -slotBot, z, slotW, slotTop, zEnd, 3, Mat.FRAME_DARK);
        // 深槽内部细光带
        if (z % 8 === 0) {
          vol.fillBox(-slotW - 1, -1, z + 1, -slotW, 1, z + 2, Mat.GLOW_CYAN);
          vol.fillBox(slotW, -1, z + 1, slotW + 1, 1, z + 2, Mat.GLOW_CYAN);
        }
        // 外跨连接肋梁
        fillShellBoxSymX(slotW - 2, halfW - 4, -slotBot + 4, -slotBot + 10, z, zEnd, 2, Mat.FRAME_DARK);
        fillShellBoxSymX(slotW - 2, halfW - 4, slotTop - 10, slotTop - 4, z, zEnd, 2, Mat.FRAME_DARK);
      } else if (z <= 260) {
        // 常规舰体主装甲：阶梯折角外甲板
        vol.fillHollowBox(-halfW, -halfBot, z, halfW, halfTop, zEnd, 3, Mat.HULL_PRIMARY);
        // 顶甲板与侧斜折面层次
        const topStepW = halfW - 12;
        vol.fillHollowBox(-topStepW, halfTop - 2, z, topStepW, halfTop + 4, zEnd, 2, Mat.HULL_SECONDARY);
        // 侧边横向装甲接缝暗线
        if ((z & 31) === 0) {
          vol.fillBox(-halfW, -halfBot + 6, z, -halfW, halfTop - 6, z, Mat.FRAME_DARK);
          vol.fillBox(halfW, -halfBot + 6, z, halfW, halfTop - 6, z, Mat.FRAME_DARK);
        }
        // 装甲顶缘高亮钛白折线
        vol.fillBox(-halfW, halfTop - 1, z, -halfW + 3, halfTop, zEnd, Mat.HULL_LIGHT);
        vol.fillBox(halfW - 3, halfTop - 1, z, halfW, halfTop, zEnd, Mat.HULL_LIGHT);
      } else {
        // -------------------------------------------------------
        // 2. 舰首双叉分裂楔翼 + 中央光束主炮巨膛（z = 264..560）
        // -------------------------------------------------------
        const u = (z - 260) / 300;
        // 中央炮膛空隙宽度随前方稍微打开，形成强烈的“双钳前指”姿态
        const gapX = Math.round(lerp(16, 22, u));
        // 上下分裂缝隙（形成四叶分叉长刃！）
        const splitY = Math.round(lerp(8, 13, u));
        const wingOuterX = gapX + Math.round(lerp(56, 22, u));
        const wingTop = splitY + Math.round(lerp(28, 12, Math.pow(u, 0.7)));
        const wingBot = -splitY - Math.round(lerp(26, 11, Math.pow(u, 0.7)));

        // 阶梯错位外缘：每 24 格形成阶面退缩
        const stepIdx = ((z - 260) / 24) | 0;
        const stepInset = (stepIdx % 2 === 0) ? 0 : 3;

        // 上左右双叉主刃
        fillShellBoxSymX(gapX, wingOuterX - stepInset, splitY, wingTop, z, zEnd, 3, Mat.HULL_PRIMARY);
        // 上刃内侧深层阶片与铜金锁边
        fillShellBoxSymX(gapX - 2, gapX + 5, splitY - 2, splitY + 5, z, zEnd, 2, Mat.FRAME_DARK);
        vol.fillBoxSymX(gapX - 1, gapX + 1, splitY, splitY + 1, z, zEnd, Mat.TRIM_BRONZE);

        // 下左右双叉龙骨刃
        fillShellBoxSymX(gapX + 2, wingOuterX - 4 - stepInset, wingBot, -splitY, z, zEnd, 3, Mat.HULL_SECONDARY);
        fillShellBoxSymX(gapX, gapX + 5, -splitY - 4, -splitY + 1, z, zEnd, 2, Mat.FRAME_DARK);

        // 每 48 格用粗大斜跨肋框连接上下叉刃与炮身外鞘，营造“围绕空腔的层片”母题
        if ((z - 260) % 48 < 12) {
          fillShellBoxSymX(gapX - 6, wingOuterX - 8, -splitY - 2, splitY + 2, z, zEnd, 2, Mat.FRAME_DARK);
          vol.fillBoxSymX(wingOuterX - 7, wingOuterX - 5, -splitY + 2, splitY - 2, z, zEnd, Mat.HULL_LIGHT);
        } else {
          // 跨间开放槽隙：上下叉刃内外缘布置“逐段蓄能点亮槽”，主炮蓄能时从后向前依次亮起！
          const ox = wingOuterX - stepInset;
          vol.fillBoxSymX(ox - 1, ox, splitY + 2, splitY + 4, z + 1, zEnd - 1, Mat.GLOW_WEAPON_CHARGE);
          vol.fillBoxSymX(gapX + 2, ox - 6, splitY - 1, splitY, z + 1, zEnd - 1, Mat.GLOW_WEAPON_CHARGE);
        }
      }
    }

    // 舰首四叶最前端尖刺延长（z = 540..560 的阶梯利刃收尖）
    for (let z = 540; z <= 560; z += 4) {
      const k = (z - 540) / 20;
      const xIn = Math.round(lerp(22, 26, k));
      const xOut = Math.round(lerp(42, 31, k));
      const yLo = Math.round(lerp(13, 16, k));
      const yHi = Math.round(lerp(24, 19, k));
      fillShellBoxSymX(xIn, xOut, yLo, yHi, z, z + 3, 2, Mat.HULL_LIGHT);
      fillShellBoxSymX(xIn + 1, xOut - 2, -yHi + 2, -yLo, z, z + 3, 2, Mat.HULL_SECONDARY);
    }

    // -------------------------------------------------------
    // 3. 旗舰光束主炮巨型实体（z = 100 .. 524）
    // -------------------------------------------------------
    // 3a. 厚重基部炮座与能量导向舱（z = 100 .. 220）
    vol.fillHollowBox(-20, -18, 100, 20, 18, 220, 4, Mat.FRAME_DARK);
    vol.fillHollowBox(-24, -14, 120, 24, 14, 195, 3, Mat.HULL_SECONDARY);
    vol.fillBoxSymX(20, 25, -8, 8, 130, 190, Mat.TRIM_BRONZE);

    // 3b. 沿射向延伸的双叉夹持炮身（z = 220 .. 520）
    // 上下主导轨炮管 + 两侧蓄能光槽
    vol.fillHollowBox(-11, 4, 220, 11, 13, 518, 3, Mat.HULL_SECONDARY);
    vol.fillHollowBox(-11, -13, 220, 11, -4, 518, 3, Mat.HULL_SECONDARY);
    // 左右夹持导轨
    fillShellBoxSymX(7, 13, -6, 6, 220, 505, 2, Mat.FRAME_DARK);
    // 6 道抱合束能环框（沿炮身均匀分布）
    for (let bz = 240; bz <= 490; bz += 50) {
      vol.fillHollowBox(-15, -16, bz, 15, 16, bz + 12, 3, Mat.FRAME_DARK);
      vol.fillBoxSymX(13, 16, -12, 12, bz + 2, bz + 10, Mat.HULL_LIGHT);
      vol.fillBox(-12, 15, bz + 3, 12, 17, bz + 9, Mat.TRIM_BRONZE);
    }
    // 炮身两侧和中间的“逐段动态蓄能槽”（Mat.GLOW_WEAPON_CHARGE）
    vol.fillBoxSymX(11, 12, -2, 2, 165, 512, Mat.GLOW_WEAPON_CHARGE);
    vol.fillBox(-3, 13, 170, 3, 14, 514, Mat.GLOW_WEAPON_CHARGE);
    vol.fillBox(-3, -14, 170, 3, -13, 514, Mat.GLOW_WEAPON_CHARGE);
    // 炮口发射深腔（z = 495 .. 524）
    vol.fillBox(-7, -5, 495, 7, 5, 526, Mat.AIR);
    vol.fillHollowBox(-13, -13, 505, 13, 13, 524, 3, Mat.ENGINE_INTERIOR);
    vol.fillBox(-5, -4, 492, 5, 4, 498, Mat.GLOW_CYAN_HOT); // 炮膛最深处核心发光发射口

    // -------------------------------------------------------
    // 4. 向外伸展的双层斜楔侧翼（Outrigger Wing Mantles, z = -340..+320）
    // -------------------------------------------------------
    for (let z = -340; z <= 320; z += 8) {
      const zEnd = Math.min(320, z + 7);
      // 侧翼轮廓随 z 优美展翼：中后最宽达到 x = ±158，前部收束
      const u = (z + 340) / 660;
      const arch = Math.sin(Math.pow(u, 0.78) * Math.PI);
      const innerX = Math.round(lerp(82, 102, arch));
      const outerX = Math.round(lerp(110, 158, arch));
      const thickTop = Math.round(11 + 8 * arch);
      const thickBot = Math.round(10 + 6 * arch);

      // 机库留空段（右舷与左舷 z = -205 .. -35 让侧翼高高拱起避让机库进出通道！）
      const isHangarBayZ = z >= -208 && z <= -32;
      if (isHangarBayZ) {
        // 上护翼拱起形成机库巨型顶部遮蔽护檐
        fillShellBoxSymX(innerX - 10, outerX, 16, 16 + thickTop + 4, z, zEnd, 3, Mat.HULL_PRIMARY);
        // 底部导引护栏分段留出点阵导引灯，中间大幅敞开便于小艇与镜头直入
        fillShellBoxSymX(innerX + 12, outerX - 10, -34, -27, z, zEnd, 2, Mat.HULL_SECONDARY);
        if ((z & 15) === 0) {
          vol.fillBoxSymX(outerX - 11, outerX - 9, -27, -26, z, z + 3, Mat.GLOW_AMBER);
        }
      } else {
        // 完整双层楔翼：上片较宽为主甲板，下片略内缩为深灰翼骨
        fillShellBoxSymX(innerX, outerX, 2, thickTop, z, zEnd, 3, Mat.HULL_PRIMARY);
        fillShellBoxSymX(innerX + 6, outerX - 12, -thickBot, -2, z, zEnd, 2, Mat.HULL_SECONDARY);
        // 外翼斜切缘与高亮边条
        vol.fillBoxSymX(outerX - 2, outerX, 0, 3, z, zEnd, Mat.HULL_LIGHT);
        // 上下翼片之间的夹层发光暗槽
        if (z % 16 === 0) {
          vol.fillBoxSymX(innerX + 4, outerX - 14, -1, 1, z + 2, z + 5, Mat.FRAME_DARK);
        }
        if (z % 48 === 0) {
          vol.fillBoxSymX(outerX - 10, outerX - 4, 2, thickTop + 1, z, z + 6, Mat.TRIM_BRONZE);
        }
      }

      // 每 48 格布置一根厚重的横向跨空连接梁，把侧翼与主壳体咬合
      if ((z + 340) % 48 === 0 && !isHangarBayZ) {
        fillShellBoxSymX(66, innerX + 6, -8, 8, z, z + 11, 3, Mat.FRAME_DARK);
        vol.fillBoxSymX(70, innerX + 2, 9, 11, z + 2, z + 9, Mat.HULL_SECONDARY);
        vol.fillBoxSymX(74, innerX - 2, -10, -9, z + 3, z + 8, Mat.TRIM_BRONZE);
      }
    }

    // -------------------------------------------------------
    // 5. 背脊上层建筑、舰桥堡垒与动力环塔（Dorsal Citadel）
    // -------------------------------------------------------
    // 5a. 长背脊通道隆起（z = -310 .. +115）
    vol.fillHollowBox(-34, 34, -310, 34, 52, 115, 3, Mat.HULL_SECONDARY);
    vol.fillHollowBox(-24, 52, -260, 24, 62, 60, 3, Mat.HULL_PRIMARY);

    // 5b. 宏伟舰桥堡垒（z = -165 .. -10, y = 52 .. 98）
    // 逐层向后退缩的阶梯上层建筑
    vol.fillHollowBox(-38, 52, -160, 38, 74, -20, 3, Mat.HULL_PRIMARY);
    vol.fillHollowBox(-28, 74, -145, 28, 88, -36, 3, Mat.HULL_SECONDARY);
    vol.fillHollowBox(-18, 88, -135, 18, 98, -56, 2, Mat.HULL_PRIMARY);
    // 舰桥前方退缩的巨大透明观察窗带（面向 +Z 航向）
    vol.fillBox(-24, 78, -36, 24, 84, -35, Mat.GLASS_TRANS);
    vol.fillBox(-22, 79, -40, 22, 83, -38, Mat.GLOW_CYAN); // 内部泛出的冷光
    // 两侧倾斜肋框抱住舰桥堡垒
    for (let bz = -150; bz <= -40; bz += 26) {
      fillShellBoxSymX(26, 42, 48, 82, bz, bz + 8, 2, Mat.FRAME_DARK);
      vol.fillBoxSymX(38, 43, 54, 76, bz + 2, bz + 6, Mat.TRIM_BRONZE);
    }
    // 舰桥顶部对称双叉指挥天线翼
    fillShellBoxSymX(10, 15, 96, 112, -125, -80, 2, Mat.HULL_LIGHT);
    vol.fillBoxSymX(11, 13, 112, 116, -120, -110, Mat.GLOW_AMBER);

    // 5c. 动力核心背脊散热高塔与尾部散热栅（z = -320 .. -195, y = 42 .. 76）
    vol.fillHollowBox(-30, 42, -320, 30, 68, -195, 3, Mat.FRAME_DARK);
    for (let rz = -316; rz <= -204; rz += 18) {
      fillShellBoxSymX(18, 34, 46, 74, rz, rz + 6, 2, Mat.HULL_PRIMARY);
      vol.fillBox(-16, 68, rz + 2, 16, 70, rz + 4, Mat.GLOW_CYAN);
    }
    // 散热高塔后壁（面向 -Z 镜头）阶梯钛金护翼、铜金肋柱与水平散热光栅
    vol.fillBoxSymX(16, 26, 46, 65, -322, -319, Mat.HULL_PRIMARY);
    vol.fillBoxSymX(11, 14, 45, 67, -322, -319, Mat.TRIM_BRONZE);
    for (const ly of [49, 55, 61]) {
      vol.fillBox(-9, ly, -321, 9, ly + 1, -319, Mat.GLOW_CYAN);
    }

    // -------------------------------------------------------
    // 6. 腹部龙骨肋架与深度凹入结构（Ventral Ribs, z = -340 .. +250）
    // -------------------------------------------------------
    // 双叉下龙骨
    fillShellBoxSymX(14, 30, -58, -34, -330, 230, 3, Mat.FRAME_DARK);
    fillShellBoxSymX(16, 26, -64, -54, -270, 170, 2, Mat.HULL_SECONDARY);
    // 11 组宽大腹部横向肋架拱框（从下腹抱起主壳）
    for (let az = -310; az <= 190; az += 50) {
      vol.fillHollowBox(-56, -72, az, 56, -34, az + 14, 3, Mat.FRAME_DARK);
      vol.fillBox(-44, -74, az + 3, 44, -71, az + 11, Mat.HULL_PRIMARY);
      vol.fillBox(-8, -73, az + 5, 8, -72, az + 9, Mat.GLOW_AMBER);
    }

    // -------------------------------------------------------
    // 7. 旗舰外侧机库凹入口（实际刻进舰体，供小艇进出与相机过渡！）
    // -------------------------------------------------------
    // 右舷与左舷巨大退让机库入口（z = -185 .. -45, y = -28 .. +10）
    // 挖空主壳体侧壁一直深入到 x = ±24
    vol.fillBox(34, -26, -182, 92, 8, -48, Mat.AIR);
    vol.fillBox(-92, -26, -182, -34, 8, -48, Mat.AIR);
    // 机库内壁、地板与天花板横梁（左右对称）
    for (const side of [1, -1]) {
      const xa = side > 0 ? 34 : -84;
      const xb = side > 0 ? 84 : -34;
      // 地板与天花
      vol.fillBox(xa, -28, -184, xb, -26, -46, Mat.FRAME_DARK);
      vol.fillBox(xa, 8, -184, xb, 11, -46, Mat.FRAME_DARK);
      // 最深处背墙与发光远端引导闸门（克制发光条框，内部仍深邃）
      const wallX = side > 0 ? 34 : -36;
      vol.fillBox(wallX, -26, -182, wallX + 2, 8, -48, Mat.FRAME_DEEP);
      const glowX = side > 0 ? 36 : -37;
      vol.fillBox(glowX, 4, -155, glowX + 1, 6, -75, Mat.GLOW_CYAN);
      vol.fillBox(glowX, -24, -155, glowX + 1, -22, -75, Mat.GLOW_AMBER);
      vol.fillBox(glowX, -18, -148, glowX + 1, 0, -146, Mat.GLOW_AMBER);
      vol.fillBox(glowX, -18, -84, glowX + 1, 0, -82, Mat.GLOW_AMBER);
      // 地板导引线带与机库内纵深肋拱、停泊小艇剪影（增强外部进港过渡层次）
      const gX0 = side > 0 ? 38 : -82;
      const gX1 = side > 0 ? 82 : -38;
      vol.fillBox(gX0, -26, -120, gX1, -26, -116, Mat.GLOW_CYAN);
      for (const rz of [-166, -138, -94, -66]) {
        const rx0 = side > 0 ? 36 : -46;
        const rx1 = side > 0 ? 46 : -36;
        vol.fillBox(rx0, -26, rz, rx1, 8, rz + 3, Mat.HULL_SECONDARY);
        vol.fillBox(xa + 4, 5, rz - 1, xb - 4, 8, rz + 4, Mat.FRAME_DARK);
      }
      // 凹位内停泊两艘简化同尺度体素小艇剪影（与内部机库一致）
      for (const sz of [-152, -78]) {
        const sx = side > 0 ? 48 : -54;
        vol.fillBox(sx, -25, sz - 4, sx + 6, -22, sz + 4, Mat.HULL_PRIMARY);
        vol.fillBox(sx + (side > 0 ? 5 : 0), -24, sz - 2, sx + (side > 0 ? 7 : 1), -23, sz + 2, Mat.GLOW_CYAN);
      }
      // 机库入口两侧粗大阶梯门框（仅两端做重门柱，中间 110 格完全畅通！）
      for (const hz of [-182, -52]) {
        const edgeX = side > 0 ? 80 : -84;
        vol.fillBox(edgeX, -26, hz, edgeX + 4, 10, hz + 6, Mat.HULL_SECONDARY);
        vol.fillBox(edgeX + (side > 0 ? 2 : 0), 4, hz + 2, edgeX + (side > 0 ? 4 : 2), 8, hz + 4, Mat.GLOW_AMBER);
      }
    }

    // -------------------------------------------------------
    // 8. 舰尾退让六联+翼根八联深腔推进喷口阵列（z = -560 .. -380）
    // -------------------------------------------------------
    // 先把舰尾端面用暗构架闭合层片包裹
    vol.fillHollowBox(-56, -26, -544, 56, 28, -500, 3, Mat.FRAME_DARK);
    // 2 座超巨型主喷口（zTip = -560）
    carveThruster(-30, 0, -560, 34, 22, 18);
    carveThruster(30, 0, -560, 34, 22, 18);
    // 4 座中型副喷口（上下分列在两旁，逐层退让于 z = -526）
    carveThruster(-68, 18, -526, 26, 13, 11);
    carveThruster(68, 18, -526, 26, 13, 11);
    carveThruster(-68, -18, -526, 26, 13, 11);
    carveThruster(68, -18, -526, 26, 13, 11);
    // 2 座外侧翼尾辅助推进喷口（z = -388）
    carveThruster(-112, 8, -388, 20, 11, 8);
    carveThruster(112, 8, -388, 20, 11, 8);

    // -------------------------------------------------------
    // 9. 脉冲炮台基座托台（14 座舰体表面 + 6 座悬空定位参考）
    // -------------------------------------------------------
    const pulseTurretMounts = [
      // 前背脊两侧（4座）
      { pos: [-26, 46, 220], floating: false, dir: 1 },
      { pos: [26, 46, 220], floating: false, dir: 1 },
      { pos: [-30, 48, 110], floating: false, dir: 1 },
      { pos: [30, 48, 110], floating: false, dir: 1 },
      // 外翼上表面中前段与中后段（6座）
      { pos: [-122, 20, 155], floating: false, dir: 1 },
      { pos: [122, 20, 155], floating: false, dir: 1 },
      { pos: [-138, 22, 20], floating: false, dir: 1 },
      { pos: [138, 22, 20], floating: false, dir: 1 },
      { pos: [-120, 18, -245], floating: false, dir: 1 },
      { pos: [120, 18, -245], floating: false, dir: 1 },
      // 后背脊与下腹（4座）
      { pos: [-28, 70, -210], floating: false, dir: 1 },
      { pos: [28, 70, -210], floating: false, dir: 1 },
      { pos: [-28, -56, 145], floating: false, dir: -1 },
      { pos: [28, -56, 145], floating: false, dir: -1 },
      // 6 座伴飞悬浮脉冲炮台（围绕旗舰两侧外空间，构成另一层结构）
      { pos: [-185, 42, 240], floating: true, dir: 1 },
      { pos: [185, 42, 240], floating: true, dir: 1 },
      { pos: [-198, -18, 65], floating: true, dir: 1 },
      { pos: [198, -18, 65], floating: true, dir: 1 },
      { pos: [-176, 52, -160], floating: true, dir: 1 },
      { pos: [176, 52, -160], floating: true, dir: 1 }
    ];

    for (const m of pulseTurretMounts) {
      if (m.floating) continue;
      const px = m.pos[0] | 0;
      const py = m.pos[1] | 0;
      const pz = m.pos[2] | 0;
      const yBase = m.dir > 0 ? py - 6 : py;
      const yTop = m.dir > 0 ? py : py + 6;
      vol.fillBox(px - 10, yBase, pz - 10, px + 10, yTop, pz + 10, Mat.FRAME_DARK);
      vol.fillBox(px - 8, yBase + (m.dir > 0 ? 4 : 0), pz - 8, px + 8, yTop - (m.dir > 0 ? 0 : 4), pz + 8, Mat.TRIM_BRONZE);
    }

    const meshData = buildGreedyMesh(vol, { freeAfter: true });

    const thrusterNozzles = [
      { pos: [-30, 0, -560], radius: 20, power: 1.4 },
      { pos: [30, 0, -560], radius: 20, power: 1.4 },
      { pos: [-68, 18, -526], radius: 11, power: 0.9 },
      { pos: [68, 18, -526], radius: 11, power: 0.9 },
      { pos: [-68, -18, -526], radius: 11, power: 0.9 },
      { pos: [68, -18, -526], radius: 11, power: 0.9 },
      { pos: [-112, 8, -388], radius: 9, power: 0.75 },
      { pos: [112, 8, -388], radius: 9, power: 0.75 }
    ];

    return {
      meshData,
      length: 1120,
      width: 316,
      height: 180,
      mainBeamMuzzle: [0, 0, 524],
      hangarEntryRight: [88, -10, -115],
      hangarEntryLeft: [-88, -10, -115],
      pulseTurretMounts,
      thrusterNozzles
    };
  }

  SF.buildFlagship = buildFlagship;
})(window);
