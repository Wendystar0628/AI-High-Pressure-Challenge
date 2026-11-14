(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  // 构造单颗不规则多断面、有裂隙和贯通空洞的体素陨石体素采样场
  function generateAsteroidVolumeData(radius, seed) {
    const { Mat } = SF.Voxel;
    const { fbm3D, mulberry32 } = SF.Math;
    const rng = mulberry32(seed);

    const R = Math.ceil(radius * 1.35);
    // 生成 4 个随机斜切断面平面，营造硬朗阶梯岩块感
    const planes = [];
    for (let i = 0; i < 4; i++) {
      const th = rng() * Math.PI * 2;
      const ph = (rng() - 0.5) * Math.PI;
      const nx = Math.cos(ph) * Math.cos(th);
      const ny = Math.sin(ph);
      const nz = Math.cos(ph) * Math.sin(th);
      planes.push({ nx, ny, nz, d: radius * (0.62 + rng() * 0.35) });
    }

    // 1 条贯通孔洞方向
    const holeDir = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
    const hLen = Math.hypot(holeDir[0], holeDir[1], holeDir[2]) || 1;
    holeDir[0] /= hLen; holeDir[1] /= hLen; holeDir[2] /= hLen;
    const holeOffset = [(rng() - 0.5) * radius * 0.35, (rng() - 0.5) * radius * 0.35, (rng() - 0.5) * radius * 0.35];
    const holeRad = radius * (0.16 + rng() * 0.10);

    // 拉伸比例（长条不规则岩石）
    const sx = 0.85 + rng() * 0.45;
    const sy = 0.72 + rng() * 0.45;
    const sz = 0.85 + rng() * 0.50;

    // 3D Voronoi 裂块种子（2~3 个主大块 + 5~6 个中块）
    const numPieces = 8;
    const seeds = [];
    for (let i = 0; i < numPieces; i++) {
      // 前 3 个大块种子分布较对称宽阔，后 5 个靠边缘制造中等崩落块
      const spread = i < 3 ? 0.38 : 0.68;
      seeds.push({
        x: (rng() - 0.5) * 2 * radius * spread,
        y: (rng() - 0.5) * 2 * radius * spread,
        z: (rng() - 0.5) * 2 * radius * spread,
        bias: i < 3 ? 0.85 : 1.15 // 让大块自然占更大体积
      });
    }

    const voxels = []; // [{x, y, z, mat, pieceId}]
    const maxR = radius * 1.20;
    const minR = radius * 0.50;
    for (let y = -R; y <= R; y++) {
      const ey = y / sy;
      if (Math.abs(ey) > maxR) continue;
      for (let z = -R; z <= R; z++) {
        const ez = z / sz;
        const yzSq = ey * ey + ez * ez;
        if (yzSq > maxR * maxR) continue;
        for (let x = -R; x <= R; x++) {
          const ex = x / sx;
          const distSq = ex * ex + yzSq;
          if (distSq > maxR * maxR) continue;

          // 先做粗平面裁剪与贯通洞裁剪，大幅跳过空点
          let clipped = false;
          for (let p = 0; p < planes.length; p++) {
            const pl = planes[p];
            if (x * pl.nx + y * pl.ny + z * pl.nz > pl.d + 4.5) {
              clipped = true;
              break;
            }
          }
          if (clipped) continue;

          const rx = x - holeOffset[0], ry = y - holeOffset[1], rz = z - holeOffset[2];
          const proj = rx * holeDir[0] + ry * holeDir[1] + rz * holeDir[2];
          const perpSq = (rx * rx + ry * ry + rz * rz) - proj * proj;
          if (perpSq < holeRad * holeRad * 0.85) continue;

          const dist = Math.sqrt(distSq);
          const n = fbm3D(x * 0.048 + seed * 0.13, y * 0.048, z * 0.048, 3);
          const crater = fbm3D(x * 0.11 + 7.1, y * 0.11, z * 0.11, 2);

          let surfR = radius * (0.62 + 0.55 * n);
          if (crater < 0.32) surfR -= (0.32 - crater) * radius * 0.65;
          if (dist > minR && dist > surfR) continue;

          // 精平面斜切断面
          let fineClipped = false;
          for (let p = 0; p < planes.length; p++) {
            const pl = planes[p];
            if (x * pl.nx + y * pl.ny + z * pl.nz > pl.d + n * 4.5) {
              fineClipped = true;
              break;
            }
          }
          if (fineClipped) continue;

          if (perpSq < holeRad * holeRad * (0.85 + 0.35 * crater)) continue;

          // 决定属于哪一个 Voronoi 裂块（加入噪声扭曲形成凹凸齿状裂面！）
          const jx = x + (n - 0.5) * 14.0;
          const jy = y + (crater - 0.5) * 14.0;
          const jz = z + (n - crater) * 12.0;

          let bestId = 0;
          let bestD = 1e12;
          let secondD = 1e12;
          for (let s = 0; s < seeds.length; s++) {
            const sd = seeds[s];
            const dd = Math.hypot(jx - sd.x, jy - sd.y, jz - sd.z) * sd.bias;
            if (dd < bestD) {
              secondD = bestD;
              bestD = dd;
              bestId = s;
            } else if (dd < secondD) {
              secondD = dd;
            }
          }

          const isSeam = (secondD - bestD) < 2.2;
          let mat;
          if (isSeam) {
            mat = Mat.ROCK_GLOW_SEAM;
          } else if (dist > surfR - 2.6 || crater < 0.36) {
            mat = Mat.ROCK_DARK;
          } else if (crater > 0.62) {
            mat = Mat.ROCK_MINERAL;
          } else {
            mat = Mat.ROCK_MID;
          }

          voxels.push(x, y, z, mat, bestId);
        }
      }
    }

    // 计算每个裂块的质心与分离方向向量
    const sumsX = new Float64Array(numPieces);
    const sumsY = new Float64Array(numPieces);
    const sumsZ = new Float64Array(numPieces);
    const counts = new Int32Array(numPieces);

    for (let i = 0; i < voxels.length; i += 5) {
      const pid = voxels[i + 4];
      sumsX[pid] += voxels[i];
      sumsY[pid] += voxels[i + 1];
      sumsZ[pid] += voxels[i + 2];
      counts[pid]++;
    }

    const pieceInfos = [];
    for (let p = 0; p < numPieces; p++) {
      const c = counts[p] || 1;
      const cx = sumsX[p] / c;
      const cy = sumsY[p] / c;
      const cz = sumsZ[p] / c;
      const len = Math.hypot(cx, cy, cz) || 1;
      pieceInfos.push({
        id: p,
        centroid: [cx, cy, cz],
        dir: [cx / len, cy / len, cz / len],
        spinAxis: [rng() - 0.5, rng() - 0.5, rng() - 0.5],
        spinSpeed: (p < 3 ? 0.35 : 1.1) * (0.7 + rng() * 0.9),
        sepSpeed: (p < 3 ? 14 : 32) * (0.8 + rng() * 0.6)
      });
    }

    return { voxels, pieceInfos, numPieces };
  }

  // 构建可碎裂大型陨石资产（含完整体 Mesh + 各裂块局部原点居中 Mesh）
  function buildFracturableAsteroid(radius, seed) {
    const { VoxelVolume, buildGreedyMesh } = SF.Voxel;
    const data = generateAsteroidVolumeData(radius, seed);
    const { voxels, pieceInfos, numPieces } = data;

    // 1. 完整未断裂态 Mesh（未开火前无内缝）
    const wholeVol = new VoxelVolume();
    for (let i = 0; i < voxels.length; i += 5) {
      wholeVol.set(voxels[i], voxels[i + 1], voxels[i + 2], voxels[i + 3]);
    }
    const wholeMeshData = buildGreedyMesh(wholeVol, { freeAfter: true });

    // 2. 各裂块单独 Mesh（局部偏移保留质心旋转中心！）
    const pieceVols = [];
    for (let p = 0; p < numPieces; p++) pieceVols.push(new VoxelVolume());

    for (let i = 0; i < voxels.length; i += 5) {
      const pid = voxels[i + 4];
      const info = pieceInfos[pid];
      // 以裂块自身整数化质心为局部旋转中心，这样翻滚时不偏心！
      const ox = Math.round(info.centroid[0]);
      const oy = Math.round(info.centroid[1]);
      const oz = Math.round(info.centroid[2]);
      pieceVols[pid].set(voxels[i] - ox, voxels[i + 1] - oy, voxels[i + 2] - oz, voxels[i + 3]);
    }

    const pieces = [];
    for (let p = 0; p < numPieces; p++) {
      const info = pieceInfos[p];
      const ox = Math.round(info.centroid[0]);
      const oy = Math.round(info.centroid[1]);
      const oz = Math.round(info.centroid[2]);
      const meshData = buildGreedyMesh(pieceVols[p], { freeAfter: true });
      if (meshData.opaque.indexCount > 0) {
        pieces.push({
          meshData,
          localOffset: [ox, oy, oz],
          dir: info.dir,
          spinAxis: info.spinAxis,
          spinSpeed: info.spinSpeed,
          sepSpeed: info.sepSpeed
        });
      }
    }

    return {
      radius,
      wholeMeshData,
      pieces
    };
  }

  // 构建普通中小型原始体素岩块与飞散小碎块（共享统一 1x1x1 网格）
  function buildSimpleAsteroid(radius, seed) {
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const { fbm3D, mulberry32 } = SF.Math;
    const rng = mulberry32(seed);
    const vol = new VoxelVolume();
    const R = Math.ceil(radius * 1.3);
    const sx = 0.8 + rng() * 0.5;
    const sy = 0.75 + rng() * 0.5;
    const sz = 0.8 + rng() * 0.5;
    const hasCavity = radius >= 12;
    const ox = (rng() - 0.5) * radius * 0.3;
    const oy = (rng() - 0.5) * radius * 0.3;
    const holeR = radius * 0.24;

    for (let y = -R; y <= R; y++) {
      for (let z = -R; z <= R; z++) {
        for (let x = -R; x <= R; x++) {
          const d = Math.hypot(x / sx, y / sy, z / sz);
          const n = fbm3D(x * 0.08 + seed * 0.21, y * 0.08, z * 0.08, 3);
          // 硬朗斜切断面 + 局部贯通空隙（体现未受击原始陨石的不规则与多孔洞构造）
          if (x * 0.58 + y * 0.64 - z * 0.45 > radius * (0.68 + 0.22 * n)) continue;
          if (hasCavity && Math.hypot(x - ox, y - oy - z * 0.25) < holeR * (0.75 + 0.45 * n)) continue;
          if (d <= radius * (0.58 + 0.62 * n)) {
            const mat = d > radius * 0.75 ? Mat.ROCK_DARK : n > 0.68 ? Mat.ROCK_MINERAL : Mat.ROCK_MID;
            vol.set(x, y, z, mat);
          }
        }
      }
    }
    return {
      radius,
      meshData: buildGreedyMesh(vol, { freeAfter: true })
    };
  }

  SF.buildAsteroidAssets = function () {
    // 3 颗大型可多阶段裂解目标陨石（分别给主炮、脉冲+近防、导弹群展现）
    const largeTargets = [
      buildFracturableAsteroid(44, 101), // 目标A：主炮正面贯穿裂解
      buildFracturableAsteroid(36, 202), // 目标B：脉冲炮台+近防点射崩落
      buildFracturableAsteroid(40, 303)  // 目标C：前卫导弹群延迟爆裂
    ];
    // 4 种中小型不可变背景/碎屑伴飞体素岩块
    const mediumRocks = [
      buildSimpleAsteroid(18, 404),
      buildSimpleAsteroid(14, 505),
      buildSimpleAsteroid(11, 606),
      buildSimpleAsteroid(8, 707)
    ];
    // 6 种棱角分明、非规则锯齿状飞散体素碎块（仍严格同尺寸 1x1x1 体素网格）
    const { VoxelVolume, Mat, buildGreedyMesh } = SF.Voxel;
    const debrisChunks = [];
    const shapes = [
      // 0: 扁平尖楔玄武碎块
      [[-1, 0, -1, 1, 1, 1, Mat.ROCK_DARK], [2, 0, 0, 2, 0, 1, Mat.ROCK_MID], [-2, 1, -1, -2, 1, 0, Mat.ROCK_GLOW_SEAM]],
      // 1: 梯形矿脉折角块
      [[-1, -1, -1, 1, 1, 1, Mat.ROCK_MID], [0, 2, -1, 1, 2, 0, Mat.ROCK_MINERAL], [1, 0, 2, 2, 1, 2, Mat.ROCK_DARK], [-2, -1, 0, -2, 0, 1, Mat.ROCK_GLOW_SEAM]],
      // 2: 长条尖锐断裂片（带熔裂缘）
      [[-2, 0, -1, 2, 1, 0, Mat.ROCK_DARK], [-1, 1, 1, 1, 1, 2, Mat.ROCK_GLOW_SEAM], [2, -1, 0, 3, 0, 1, Mat.ROCK_MID]],
      // 3: 双台阶角岩块
      [[-2, -1, -1, 0, 1, 1, Mat.ROCK_MID], [1, -1, 0, 2, 0, 2, Mat.ROCK_DARK], [0, 1, -2, 1, 2, -1, Mat.ROCK_MINERAL]],
      // 4: 灼热边缘小碎块
      [[-1, -1, 0, 1, 0, 2, Mat.ROCK_GLOW_SEAM], [0, 1, -1, 1, 1, 1, Mat.ROCK_DARK], [-2, 0, 1, -2, 0, 1, Mat.ROCK_MID]],
      // 5: 偏斜三角晶簇块
      [[-1, -1, -2, 1, 0, 1, Mat.ROCK_DARK], [1, 0, -1, 2, 2, 0, Mat.ROCK_MINERAL], [-1, 1, 1, 0, 1, 2, Mat.ROCK_MID]]
    ];
    for (let k = 0; k < shapes.length; k++) {
      const dv = new VoxelVolume();
      for (const b of shapes[k]) {
        dv.fillBox(b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
      }
      debrisChunks.push(buildGreedyMesh(dv, { freeAfter: true }));
    }

    return { largeTargets, mediumRocks, debrisChunks };
  };
})(window);
