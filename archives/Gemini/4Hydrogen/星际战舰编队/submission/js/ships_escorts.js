(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  // -------------------------------------------------------
  // 1. 近卫舰（196 格长：z = -98 .. +98）
  //    紧凑厚实、双颚楔刃、短翼咬合、突出的速射近防炮座
  // -------------------------------------------------------
  function buildGuardianEscort() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const { lerp } = SF.Math;
    const vol = new VoxelVolume();

    for (let z = -96; z <= 98; z += 2) {
      const zEnd = Math.min(98, z + 1);
      let hw, ht, hb;
      if (z > 40) {
        // 舰首双颚厚重收束段
        const u = (z - 40) / 58;
        hw = Math.round(lerp(26, 12, u));
        ht = Math.round(lerp(20, 10, u));
        hb = Math.round(lerp(18, 9, u));
        const gap = Math.round(lerp(5, 7, u));
        // 左右双叉重甲颚
        vol.fillHollowBox(gap, -hb, z, hw, ht, zEnd, 2, Mat.HULL_PRIMARY);
        vol.fillHollowBox(-hw, -hb, z, -gap, ht, zEnd, 2, Mat.HULL_PRIMARY);
        // 颚间深槽内架与微光
        vol.fillBox(-gap, -4, z, gap, 4, zEnd, Mat.FRAME_DARK);
        if (z % 12 === 0) {
          vol.fillBoxSymX(gap - 1, gap, -2, 2, z, zEnd, Mat.GLOW_CYAN);
        }
      } else if (z > -60) {
        // 紧凑厚实主躯干
        const u = (z + 60) / 100;
        const swell = Math.sin(u * Math.PI);
        hw = Math.round(26 + 4 * swell);
        ht = Math.round(20 + 6 * swell);
        hb = Math.round(18 + 4 * swell);
        const isSlot = (z >= 10 && z <= 16) || (z >= -32 && z <= -26);
        if (isSlot) {
          vol.fillHollowBox(-hw + 4, -hb + 3, z, hw - 4, ht - 3, zEnd, 2, Mat.FRAME_DARK);
          vol.fillBoxSymX(hw - 4, hw - 3, -1, 1, z, zEnd, Mat.GLOW_CYAN);
        } else {
          vol.fillHollowBox(-hw, -hb, z, hw, ht, zEnd, 2, Mat.HULL_PRIMARY);
          // 顶部厚脊装甲块
          vol.fillHollowBox(-hw + 9, ht - 1, z, hw - 9, ht + 4, zEnd, 2, Mat.HULL_SECONDARY);
          vol.fillBoxSymX(hw - 2, hw, ht - 1, ht, z, zEnd, Mat.HULL_LIGHT);
          if (z % 22 === 0) {
            vol.fillBoxSymX(hw - 1, hw + 1, -hb + 5, ht - 4, z, z + 2, Mat.TRIM_BRONZE);
          }
        }
      } else {
        // 舰尾收束段
        const u = (z + 96) / 36;
        hw = Math.round(lerp(20, 26, u));
        ht = Math.round(lerp(14, 20, u));
        hb = Math.round(lerp(13, 18, u));
        vol.fillHollowBox(-hw, -hb, z, hw, ht, zEnd, 2, Mat.HULL_SECONDARY);
      }

      // 两侧紧咬短翼（z = -62 .. +44）
      if (z >= -62 && z <= 44) {
        const wu = (z + 62) / 106;
        const wingOut = Math.round(lerp(34, 44, Math.sin(wu * Math.PI)));
        const wingIn = hw - 2;
        if (wingOut > wingIn + 3) {
          vol.fillHollowBox(wingIn, -6, z, wingOut, 8, zEnd, 2, Mat.HULL_SECONDARY);
          vol.fillHollowBox(-wingOut, -6, z, -wingIn, 8, zEnd, 2, Mat.HULL_SECONDARY);
          vol.fillBoxSymX(wingOut - 1, wingOut, 2, 7, z, zEnd, Mat.HULL_LIGHT);
          if (z % 18 === 0) {
            vol.fillBoxSymX(wingIn + 2, wingOut - 3, -7, -5, z, zEnd, Mat.FRAME_DARK);
          }
        }
      }
    }

    // 上层紧凑舰桥脊台（z = -38 .. -4）
    vol.fillHollowBox(-13, 22, -38, 13, 32, -4, 2, Mat.HULL_PRIMARY);
    vol.fillBox(-9, 25, -4, 9, 28, -3, Mat.GLASS_TRANS);
    vol.fillBoxSymX(11, 14, 23, 30, -34, -12, Mat.TRIM_BRONZE);
    vol.fillBoxSymX(4, 5, 32, 36, -34, -22, Mat.HULL_LIGHT);
    vol.fillBox(-4, 32, -30, 4, 34, -20, Mat.TRIM_BRONZE);

    // 4 处突出速射近防炮座（炮台基座在舰体上，炮管可独立模型或一体/旋转）
    const ciwsMounts = [
      { pos: [-26, 20, 26], dir: 1 },
      { pos: [26, 20, 26], dir: 1 },
      { pos: [-24, 21, -46], dir: 1 },
      { pos: [24, 21, -46], dir: 1 },
      { pos: [0, -21, 18], dir: -1 }
    ];
    for (const m of ciwsMounts) {
      const x = m.pos[0], y = m.pos[1], z = m.pos[2];
      const y0 = m.dir > 0 ? y - 4 : y;
      const y1 = m.dir > 0 ? y : y + 4;
      vol.fillBox(x - 5, y0, z - 5, x + 5, y1, z + 5, Mat.FRAME_DARK);
      vol.fillBox(x - 4, y0 + (m.dir > 0 ? 2 : 0), z - 4, x + 4, y1 - (m.dir > 0 ? 0 : 2), z + 4, Mat.TRIM_BRONZE);
    }

    // 舰尾双联装深腔推进喷口
    for (const sx of [-11, 11]) {
      for (let d = 0; d < 14; d++) {
        const z = -98 + d;
        const rx = d < 3 ? 9 : 8;
        const ry = d < 3 ? 9 : 8;
        vol.fillBox(sx - rx + 2, -ry + 2, z, sx + rx - 2, ry - 2, z, Mat.AIR);
        const wMat = d < 2 ? Mat.TRIM_BRONZE : Mat.ENGINE_INTERIOR;
        vol.fillHollowBox(sx - rx, -ry, z, sx + rx, ry, z, 2, wMat);
      }
      vol.fillBox(sx - 5, -5, -86, sx + 5, 5, -84, Mat.GLOW_THRUSTER_CORE);
    }

    return {
      meshData: buildGreedyMesh(vol, { freeAfter: true }),
      length: 196,
      ciwsMounts,
      thrusterNozzles: [
        { pos: [-11, 0, -98], radius: 7.5, power: 0.72 },
        { pos: [11, 0, -98], radius: 7.5, power: 0.72 }
      ]
    };
  }

  // -------------------------------------------------------
  // 2. 前卫舰（176 格长：z = -88 .. +88）
  //    修长舒展、远伸双叉长剑翼、外伸成排导弹发射槽列
  // -------------------------------------------------------
  function buildVanguardFrigate() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const { lerp } = SF.Math;
    const vol = new VoxelVolume();

    for (let z = -86; z <= 88; z += 2) {
      const zEnd = Math.min(88, z + 1);
      if (z > 24) {
        // 极修长前伸双叉导尖（z = 24 .. 88）
        const u = (z - 24) / 64;
        const gap = Math.round(lerp(5, 9, u));
        const outer = Math.round(lerp(18, 13, u));
        const ht = Math.round(lerp(11, 5, u));
        const hb = Math.round(lerp(9, 4, u));
        vol.fillHollowBox(gap, -hb, z, outer, ht, zEnd, 2, Mat.HULL_PRIMARY);
        vol.fillHollowBox(-outer, -hb, z, -gap, ht, zEnd, 2, Mat.HULL_PRIMARY);
        vol.fillBoxSymX(outer - 1, outer, ht - 1, ht, z, zEnd, Mat.HULL_LIGHT);
        if (z < 52 && z % 12 === 0) {
          vol.fillBox(-gap, -2, z, gap, 2, zEnd, Mat.FRAME_DARK);
        }
        if (z % 16 === 0) {
          vol.fillBoxSymX(gap - 1, gap, 0, 1, z, zEnd, Mat.GLOW_CYAN);
        }
      } else {
        // 修长主体核心（z = -86 .. +24）
        const u = (z + 86) / 110;
        const hw = Math.round(lerp(15, 19, Math.sin(u * Math.PI)));
        const ht = Math.round(lerp(9, 13, Math.sin(u * Math.PI)));
        const hb = Math.round(lerp(8, 11, Math.sin(u * Math.PI)));
        vol.fillHollowBox(-hw, -hb, z, hw, ht, zEnd, 2, Mat.HULL_PRIMARY);
        vol.fillBox(-hw + 4, ht, z, hw - 4, ht + 2, zEnd, Mat.HULL_SECONDARY);
        if (z % 20 === 0) {
          vol.fillBoxSymX(hw - 1, hw + 1, -3, 5, z, z + 2, Mat.TRIM_BRONZE);
        }
      }

      // 外展舒展长翼 + 成排导弹发射槽列（z = -66 .. +18）
      if (z >= -66 && z <= 18) {
        const wu = (z + 66) / 84; // 0(stern) -> 1(front)
        const wingOut = Math.round(lerp(52, 24, wu)); // 前掠收束后展大翼
        const wingIn = 18;
        if (wingOut > wingIn + 4) {
          // 留出翼根镂空槽缝（延续母题！）
          vol.fillHollowBox(wingIn + 4, -3, z, wingOut, 4, zEnd, 2, Mat.HULL_SECONDARY);
          vol.fillHollowBox(-wingOut, -3, z, -(wingIn + 4), 4, zEnd, 2, Mat.HULL_SECONDARY);
          vol.fillBoxSymX(wingOut - 2, wingOut, -2, 4, z, zEnd, Mat.HULL_LIGHT);
          // 翼根肋条连接
          if (z % 16 === 0) {
            vol.fillBoxSymX(16, wingIn + 6, -2, 2, z, z + 3, Mat.FRAME_DARK);
          }
        }
      }
    }

    // 修长背脊传感塔
    vol.fillHollowBox(-8, 12, -52, 8, 20, -18, 2, Mat.HULL_PRIMARY);
    vol.fillBox(-5, 14, -18, 5, 17, -17, Mat.GLASS_TRANS);
    vol.fillBoxSymX(7, 9, 13, 18, -46, -24, Mat.TRIM_BRONZE);
    vol.fillBoxSymX(3, 4, 20, 26, -48, -32, Mat.HULL_LIGHT);

    // 外翼成排导弹发射槽列（每侧 6 座凹陷斜置发射槽 + 内嵌可见导弹头！）
    const missilePorts = [];
    for (let k = 0; k < 6; k++) {
      const pz = -54 + k * 11;
      const px = 42 - k * 3;
      for (const side of [-1, 1]) {
        const sx = side * px;
        // 发射槽围框
        vol.fillHollowBox(sx - 4, 2, pz - 4, sx + 4, 7, pz + 4, 1, Mat.FRAME_DARK);
        vol.fillBox(sx - 2, 4, pz - 2, sx + 2, 7, pz + 2, Mat.AIR);
        // 槽内露出准备发射的导弹体素弹头与导引光
        vol.fillBox(sx - 1, 3, pz - 1, sx + 1, 5, pz + 1, Mat.TRIM_BRONZE);
        vol.set(sx, 6, pz, Mat.GLOW_AMBER);
        missilePorts.push([sx, 7, pz]);
      }
    }

    // 舰尾横向三联扁平斜切喷口
    const sternNozzles = [-12, 0, 12];
    for (const sx of sternNozzles) {
      for (let d = 0; d < 12; d++) {
        const z = -88 + d;
        vol.fillBox(sx - 4, -4, z, sx + 4, 4, z, Mat.AIR);
        vol.fillHollowBox(sx - 5, -6, z, sx + 5, 6, z, 1, d < 2 ? Mat.TRIM_BRONZE : Mat.ENGINE_INTERIOR);
      }
      vol.fillBox(sx - 3, -3, -78, sx + 3, 3, -76, Mat.GLOW_THRUSTER_CORE);
    }

    return {
      meshData: buildGreedyMesh(vol, { freeAfter: true }),
      length: 176,
      missilePorts,
      thrusterNozzles: [
        { pos: [-12, 0, -88], radius: 5.5, power: 0.62 },
        { pos: [0, 0, -88], radius: 6.2, power: 0.68 },
        { pos: [12, 0, -88], radius: 5.5, power: 0.62 }
      ]
    };
  }

  // -------------------------------------------------------
  // 3. 舰载小艇（26 格长：z = -13 .. +13，约旗舰 1/43）
  // -------------------------------------------------------
  function buildShuttle() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const vol = new VoxelVolume();

    // 主舱体
    vol.fillBox(-3, -2, -10, 3, 2, 4, Mat.HULL_PRIMARY);
    vol.fillBox(-2, 2, -8, 2, 3, 2, Mat.HULL_LIGHT);
    // 驾驶观测透明条带
    vol.fillBox(-2, 1, 2, 2, 2, 5, Mat.GLASS_TRANS);
    // 前伸双叉导尖（浓缩舰队母题）
    vol.fillBoxSymX(2, 3, -1, 1, 4, 13, Mat.HULL_LIGHT);
    vol.fillBoxSymX(2, 2, -1, 0, 8, 13, Mat.TRIM_BRONZE);
    // 两侧微折翼
    vol.fillBoxSymX(4, 8, -1, 0, -9, -1, Mat.HULL_SECONDARY);
    vol.fillBoxSymX(7, 8, 0, 2, -9, -3, Mat.HULL_LIGHT);
    // 顶部青蓝识别微光
    vol.fillBox(0, 3, -5, 0, 3, -2, Mat.GLOW_CYAN);
    // 尾喷口
    vol.fillBox(-2, -1, -13, 2, 1, -10, Mat.ENGINE_INTERIOR);
    vol.fillBox(-1, 0, -13, 1, 0, -12, Mat.GLOW_THRUSTER_CORE);

    return {
      meshData: buildGreedyMesh(vol, { freeAfter: true }),
      length: 26,
      thrusterNozzles: [{ pos: [0, 0, -13], radius: 1.8, power: 0.35 }]
    };
  }

  // -------------------------------------------------------
  // 4. 脉冲炮台独立组件（基座 + 可旋转双管炮塔，约 28 格长）
  // -------------------------------------------------------
  function buildPulseTurret() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;

    // 4a. 双瓣抱合底座（用于悬浮炮台及船体旋转基座）
    const baseVol = new VoxelVolume();
    baseVol.fillHollowBox(-9, -4, -9, 9, 2, 9, 2, Mat.FRAME_DARK);
    baseVol.fillBoxSymX(8, 12, -3, 3, -7, 7, Mat.HULL_PRIMARY);
    baseVol.fillBoxSymX(9, 11, 3, 5, -5, 5, Mat.TRIM_BRONZE);
    baseVol.fillBox(-6, 2, -6, 6, 3, 6, Mat.GLOW_CYAN);
    // 悬浮炮台底部稳定下翼片
    baseVol.fillBoxSymX(4, 6, -9, -4, -5, 5, Mat.HULL_SECONDARY);
    baseVol.fillBox(-2, -7, -2, 2, -4, 2, Mat.GLOW_CYAN);

    // 4b. 可旋转炮塔+双联脉冲炮管（长 28 格：z = -8 .. +20）
    const headVol = new VoxelVolume();
    // 炮塔壳体
    headVol.fillHollowBox(-7, 0, -8, 7, 7, 6, 2, Mat.HULL_PRIMARY);
    headVol.fillBox(-5, 7, -6, 5, 8, 3, Mat.HULL_LIGHT);
    headVol.fillBoxSymX(6, 8, 1, 5, -5, 4, Mat.FRAME_DARK);
    // 双管阶梯炮身
    headVol.fillBoxSymX(2, 4, 2, 5, 5, 20, Mat.HULL_SECONDARY);
    headVol.fillBoxSymX(2, 4, 3, 4, 10, 18, Mat.FRAME_DARK);
    // 炮身两侧脉冲发光导轨与高亮炮口
    headVol.fillBoxSymX(4, 4, 3, 4, 7, 17, Mat.GLOW_CYAN);
    headVol.fillBoxSymX(3, 3, 3, 4, 20, 21, Mat.GLOW_CYAN_HOT);

    return {
      baseMeshData: buildGreedyMesh(baseVol, { freeAfter: true }),
      headMeshData: buildGreedyMesh(headVol, { freeAfter: true }),
      muzzleOffsets: [
        [-3, 3.5, 21],
        [3, 3.5, 21]
      ]
    };
  }

  // -------------------------------------------------------
  // 5. 速射近防炮炮塔实体（装于近卫舰炮座上）
  // -------------------------------------------------------
  function buildCIWSTurret() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const vol = new VoxelVolume();
    vol.fillBox(-4, 0, -4, 4, 4, 4, Mat.HULL_SECONDARY);
    vol.fillBox(-2, 4, -3, 2, 5, 2, Mat.FRAME_DARK);
    // 密集双联细长炮管
    vol.fillBoxSymX(1, 2, 2, 3, 3, 13, Mat.HULL_LIGHT);
    vol.set(-1, 2, 13, Mat.GLOW_AMBER);
    vol.set(1, 2, 13, Mat.GLOW_AMBER);
    return {
      meshData: buildGreedyMesh(vol, { freeAfter: true }),
      muzzleOffsets: [
        [-1.5, 2.5, 13.5],
        [1.5, 2.5, 13.5]
      ]
    };
  }

  // -------------------------------------------------------
  // 6. 体素导弹实体（12 格长，用于前卫舰齐射空中飞行）
  // -------------------------------------------------------
  function buildMissileEntity() {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const vol = new VoxelVolume();
    vol.fillBox(-1, -1, -5, 1, 1, 4, Mat.HULL_PRIMARY);
    vol.fillBox(0, 0, 5, 0, 0, 7, Mat.HULL_LIGHT); // 尖头
    vol.fillBox(-2, 0, -4, 2, 0, -2, Mat.TRIM_BRONZE); // 横小翼
    vol.fillBox(0, -2, -4, 0, 2, -2, Mat.TRIM_BRONZE); // 竖小翼
    vol.fillBox(0, 0, -6, 0, 0, -5, Mat.GLOW_AMBER_HOT); // 尾焰火芯
    return {
      meshData: buildGreedyMesh(vol, { freeAfter: true })
    };
  }

  SF.buildShipAssets = function () {
    return {
      flagship: SF.buildFlagship(),
      guardian: buildGuardianEscort(),
      vanguard: buildVanguardFrigate(),
      shuttle: buildShuttle(),
      pulseTurret: buildPulseTurret(),
      ciwsTurret: buildCIWSTurret(),
      missile: buildMissileEntity()
    };
  };
})(window);
