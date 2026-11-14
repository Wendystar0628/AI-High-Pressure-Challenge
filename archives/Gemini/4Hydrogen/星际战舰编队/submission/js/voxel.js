(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  // 统一体素材质表（所有对象严格共享 1x1x1 体素格距）
  const Mat = {
    AIR: 0,
    HULL_PRIMARY: 1,       // 主装甲：冷灰银钛白
    HULL_SECONDARY: 2,     // 次级甲板：钢灰青
    HULL_LIGHT: 3,         // 高亮装甲边：亮钛银
    FRAME_DARK: 4,         // 深层暗构架：玄铁暗蓝灰
    FRAME_DEEP: 5,         // 最深槽底/内壁：深炭黑青
    TRIM_BRONZE: 6,        // 暖铜金转折构件
    ENGINE_INTERIOR: 7,    // 喷口耐热黑钛内腔
    GLOW_CYAN: 8,          // 青碧等离子导能发光槽
    GLOW_CYAN_HOT: 9,      // 白青高能核
    GLOW_AMBER: 10,        // 炽金琥珀引导/武器/警告光
    GLOW_AMBER_HOT: 11,    // 白金高温发光体
    GLASS_TRANS: 12,       // 透明冰蓝晶体/观察窗体素
    GLASS_AMBER: 13,       // 透明琥珀全息构件体素
    ROCK_DARK: 14,         // 陨石暗玄武岩
    ROCK_MID: 15,          // 陨石灰褐断面岩
    ROCK_MINERAL: 16,      // 陨石冷矿脉
    ROCK_GLOW_SEAM: 17,    // 陨石受击热熔裂隙
    GLOW_CORE: 18,         // 动力核心呼吸脉冲发光体素
    GLOW_BRIDGE_HOLO: 19,  // 舰桥立体投影透明发光体素
    GLOW_WEAPON_CHARGE: 20,// 旗舰主炮逐段蓄能槽体素
    GLOW_THRUSTER_CORE: 21 // 喷口内腔动态增强推进体素
  };

  function isTransparentMat(matId) {
    return matId === Mat.GLASS_TRANS || matId === Mat.GLASS_AMBER || matId === Mat.GLOW_BRIDGE_HOLO;
  }

  function isOpaqueMat(matId) {
    return matId !== Mat.AIR && !isTransparentMat(matId);
  }

  // 稀疏 32x32x32 体素块网格
  const CHUNK_SIZE = 32;
  const CHUNK_SHIFT = 5;
  const CHUNK_MASK = 31;
  const CHUNK_VOL = 32768;

  class VoxelVolume {
    constructor(originX = 0, originY = 0, originZ = 0) {
      this.originX = originX | 0;
      this.originY = originY | 0;
      this.originZ = originZ | 0;
      this.chunks = new Map();
      this.chunkCoords = [];
    }

    _chunkKey(cx, cy, cz) {
      // 假设 chunk 坐标在 [-512, 511] 范围内，足够支撑 ±16384 格体积
      return ((cx + 512) & 1023) | (((cy + 512) & 1023) << 10) | (((cz + 512) & 1023) << 20);
    }

    _getChunk(cx, cy, cz, create) {
      const key = this._chunkKey(cx, cy, cz);
      let chunk = this.chunks.get(key);
      if (!chunk && create) {
        chunk = new Uint8Array(CHUNK_VOL);
        this.chunks.set(key, chunk);
        this.chunkCoords.push(cx, cy, cz, key);
      }
      return chunk;
    }

    set(x, y, z, mat) {
      const ix = x | 0;
      const iy = y | 0;
      const iz = z | 0;
      const cx = ix >> CHUNK_SHIFT;
      const cy = iy >> CHUNK_SHIFT;
      const cz = iz >> CHUNK_SHIFT;
      const chunk = this._getChunk(cx, cy, cz, mat !== 0);
      if (!chunk) return;
      const lx = ix & CHUNK_MASK;
      const ly = iy & CHUNK_MASK;
      const lz = iz & CHUNK_MASK;
      chunk[lx + (lz << 5) + (ly << 10)] = mat;
    }

    get(x, y, z) {
      const ix = x | 0;
      const iy = y | 0;
      const iz = z | 0;
      const cx = ix >> CHUNK_SHIFT;
      const cy = iy >> CHUNK_SHIFT;
      const cz = iz >> CHUNK_SHIFT;
      const key = this._chunkKey(cx, cy, cz);
      const chunk = this.chunks.get(key);
      if (!chunk) return 0;
      const lx = ix & CHUNK_MASK;
      const ly = iy & CHUNK_MASK;
      const lz = iz & CHUNK_MASK;
      return chunk[lx + (lz << 5) + (ly << 10)];
    }

    // 快速填充轴对齐立方体区域 [x0..x1, y0..y1, z0..z1] (inclusive)
    fillBox(x0, y0, z0, x1, y1, z1, mat) {
      const ax = Math.min(x0, x1) | 0, bx = Math.max(x0, x1) | 0;
      const ay = Math.min(y0, y1) | 0, by = Math.max(y0, y1) | 0;
      const az = Math.min(z0, z1) | 0, bz = Math.max(z0, z1) | 0;

      const cx0 = ax >> CHUNK_SHIFT, cx1 = bx >> CHUNK_SHIFT;
      const cy0 = ay >> CHUNK_SHIFT, cy1 = by >> CHUNK_SHIFT;
      const cz0 = az >> CHUNK_SHIFT, cz1 = bz >> CHUNK_SHIFT;

      for (let cy = cy0; cy <= cy1; cy++) {
        const yMin = Math.max(ay, cy << CHUNK_SHIFT) & CHUNK_MASK;
        const yMax = Math.min(by, (cy << CHUNK_SHIFT) + CHUNK_MASK) & CHUNK_MASK;
        for (let cz = cz0; cz <= cz1; cz++) {
          const zMin = Math.max(az, cz << CHUNK_SHIFT) & CHUNK_MASK;
          const zMax = Math.min(bz, (cz << CHUNK_SHIFT) + CHUNK_MASK) & CHUNK_MASK;
          for (let cx = cx0; cx <= cx1; cx++) {
            const chunk = this._getChunk(cx, cy, cz, mat !== 0);
            if (!chunk) continue;
            const xMin = Math.max(ax, cx << CHUNK_SHIFT) & CHUNK_MASK;
            const xMax = Math.min(bx, (cx << CHUNK_SHIFT) + CHUNK_MASK) & CHUNK_MASK;
            for (let ly = yMin; ly <= yMax; ly++) {
              const yOff = ly << 10;
              for (let lz = zMin; lz <= zMax; lz++) {
                const rowOff = yOff + (lz << 5);
                chunk.fill(mat, rowOff + xMin, rowOff + xMax + 1);
              }
            }
          }
        }
      }
    }

    // 仅填充空心外壳盒（外层厚度 t），极大节约内存和生成速度
    fillHollowBox(x0, y0, z0, x1, y1, z1, t, mat) {
      const ax = Math.min(x0, x1) | 0, bx = Math.max(x0, x1) | 0;
      const ay = Math.min(y0, y1) | 0, by = Math.max(y0, y1) | 0;
      const az = Math.min(z0, z1) | 0, bz = Math.max(z0, z1) | 0;
      if (bx - ax < t * 2 || by - ay < t * 2 || bz - az < t * 2) {
        this.fillBox(ax, ay, az, bx, by, bz, mat);
        return;
      }
      this.fillBox(ax, ay, az, bx, ay + t - 1, bz, mat);
      this.fillBox(ax, by - t + 1, az, bx, by, bz, mat);
      this.fillBox(ax, ay, az, ax + t - 1, by, bz, mat);
      this.fillBox(bx - t + 1, ay, az, bx, by, bz, mat);
      this.fillBox(ax, ay, az, bx, by, az + t - 1, mat);
      this.fillBox(ax, ay, bz - t + 1, bx, by, bz, mat);
    }

    // 沿 X 轴对称写入（镜像 X -> -X，如果 mirrorX=true）
    setSymX(x, y, z, mat) {
      this.set(x, y, z, mat);
      if (x !== 0) this.set(-x, y, z, mat);
    }

    fillBoxSymX(x0, x1, y0, y1, z0, z1, mat) {
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      this.fillBox(xa, y0, z0, xb, y1, z1, mat);
      this.fillBox(-xb, y0, z0, -xa, y1, z1, mat);
    }

    clear() {
      this.chunks.clear();
      this.chunkCoords.length = 0;
    }
  }

  // Greedy Meshing 生成器
  // 顶点格式：每个顶点 4 个 uint32/float32 (16 bytes):
  //   float32 x, y, z
  //   uint8 faceDir (0:+X, 1:-X, 2:+Y, 3:-Y, 4:+Z, 5:-Z), matId, ao (0..3), flag
  function buildGreedyMesh(volume, options = {}) {
    const mirrorFlag = options.detailFlagFn || null;
    const freeVolumeAfter = !!options.freeAfter;

    // 使用动态扩容的缓冲
    function createBuilder() {
      let vCap = 65536;
      let iCap = 98304;
      let f32 = new Float32Array(vCap * 4);
      let u8 = new Uint8Array(f32.buffer);
      let idx = new Uint32Array(iCap);
      let vCount = 0;
      let iCount = 0;

      function ensureVerts(n) {
        if (vCount + n <= vCap) return;
        while (vCount + n > vCap) vCap *= 2;
        const nf = new Float32Array(vCap * 4);
        nf.set(f32);
        f32 = nf;
        u8 = new Uint8Array(f32.buffer);
      }

      function ensureIndices(n) {
        if (iCount + n <= iCap) return;
        while (iCount + n > iCap) iCap *= 2;
        const ni = new Uint32Array(iCap);
        ni.set(idx);
        idx = ni;
      }

      function pushQuad(
        x0, y0, z0,
        x1, y1, z1,
        x2, y2, z2,
        x3, y3, z3,
        faceDir, matId, ao0, ao1, ao2, ao3, flag
      ) {
        ensureVerts(4);
        ensureIndices(6);
        const base = vCount;

        const putV = (vi, x, y, z, ao) => {
          const fi = vi * 4;
          f32[fi] = x;
          f32[fi + 1] = y;
          f32[fi + 2] = z;
          const bi = fi * 4 + 12;
          u8[bi] = faceDir;
          u8[bi + 1] = matId;
          u8[bi + 2] = ao;
          u8[bi + 3] = flag;
        };

        putV(base, x0, y0, z0, ao0);
        putV(base + 1, x1, y1, z1, ao1);
        putV(base + 2, x2, y2, z2, ao2);
        putV(base + 3, x3, y3, z3, ao3);
        vCount += 4;

        // 对角线翻转防止 AO 插值失真
        if (ao0 + ao2 > ao1 + ao3) {
          idx[iCount++] = base;
          idx[iCount++] = base + 1;
          idx[iCount++] = base + 2;
          idx[iCount++] = base;
          idx[iCount++] = base + 2;
          idx[iCount++] = base + 3;
        } else {
          idx[iCount++] = base + 1;
          idx[iCount++] = base + 2;
          idx[iCount++] = base + 3;
          idx[iCount++] = base + 1;
          idx[iCount++] = base + 3;
          idx[iCount++] = base;
        }
      }

      function finalize() {
        return {
          vertexData: f32.subarray(0, vCount * 4),
          indices: idx.subarray(0, iCount),
          vertexCount: vCount,
          indexCount: iCount
        };
      }

      return { pushQuad, finalize };
    }

    const opaqueBuilder = createBuilder();
    const transBuilder = createBuilder();

    // 预复用切片缓冲区，避免在 Chunk 循环中产生 GC
    const mask = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    // 为快速邻居查找构建 3x3x3 chunk 邻域指针表
    const nbr = new Array(27);

    function getVoxelLocal(gx, gy, gz) {
      // gx, gy, gz 相对于当前 chunk origin 的局部坐标 [-1..32]
      const cxOff = gx < 0 ? 0 : gx >= 32 ? 2 : 1;
      const cyOff = gy < 0 ? 0 : gy >= 32 ? 2 : 1;
      const czOff = gz < 0 ? 0 : gz >= 32 ? 2 : 1;
      const ch = nbr[cxOff + czOff * 3 + cyOff * 9];
      if (!ch) return 0;
      const lx = gx & 31;
      const ly = gy & 31;
      const lz = gz & 31;
      return ch[lx + (lz << 5) + (ly << 10)];
    }

    function isOcc(gx, gy, gz) {
      return isOpaqueMat(getVoxelLocal(gx, gy, gz)) ? 1 : 0;
    }

    function calcAO(s1, s2, c) {
      if (s1 && s2) return 0;
      return 3 - (s1 + s2 + c);
    }

    const coords = volume.chunkCoords;
    const ox = volume.originX;
    const oy = volume.originY;
    const oz = volume.originZ;

    // 6 个面方向定义: axis (0:X, 1:Y, 2:Z), sign (+1 or -1), faceDir (0..5)
    // uAxis, vAxis 使得跨 (u, v) 为正旋转右手定则朝外！
    const faces = [
      // +X (faceDir 0): normal (+1,0,0), u = +Z, v = +Y -> (+Z x +Y = -X? Wait: Y x Z = +X! So u=+Y, v=+Z -> +Y x +Z = +X!)
      { dir: 0, axis: 0, step: 1, uAxis: 1, vAxis: 2 },
      // -X (faceDir 1): normal (-1,0,0), u = +Z, v = +Y -> +Z x +Y = -X!
      { dir: 1, axis: 0, step: -1, uAxis: 2, vAxis: 1 },
      // +Y (faceDir 2): normal (0,+1,0), u = +Z, v = +X -> +Z x +X = +Y!
      { dir: 2, axis: 1, step: 1, uAxis: 2, vAxis: 0 },
      // -Y (faceDir 3): normal (0,-1,0), u = +X, v = +Z -> +X x +Z = -Y!
      { dir: 3, axis: 1, step: -1, uAxis: 0, vAxis: 2 },
      // +Z (faceDir 4): normal (0,0,+1), u = +X, v = +Y -> +X x +Y = +Z!
      { dir: 4, axis: 2, step: 1, uAxis: 0, vAxis: 1 },
      // -Z (faceDir 5): normal (0,0,-1), u = +Y, v = +X -> +Y x +X = -Z!
      { dir: 5, axis: 2, step: -1, uAxis: 1, vAxis: 0 }
    ];

    const pos = [0, 0, 0];
    const nPos = [0, 0, 0];
    const pU = [0, 0, 0];
    const pV = [0, 0, 0];
    const sliceActive0 = new Uint8Array(CHUNK_SIZE);
    const sliceActive1 = new Uint8Array(CHUNK_SIZE);
    const sliceActive2 = new Uint8Array(CHUNK_SIZE);
    const sliceFlags = [sliceActive0, sliceActive1, sliceActive2];
    const strides = [1, 1024, 32]; // x:+1, y:+1024, z:+32

    for (let ci = 0; ci < coords.length; ci += 4) {
      const cx = coords[ci];
      const cy = coords[ci + 1];
      const cz = coords[ci + 2];
      const centerChunk = volume.chunks.get(coords[ci + 3]);

      // 快速统计 X/Y/Z 哪些切片有非空气体素，跳过全空切片！
      sliceActive0.fill(0);
      sliceActive1.fill(0);
      sliceActive2.fill(0);
      let anyNonZero = false;
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const yOff = ly << 10;
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const rowOff = yOff + (lz << 5);
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            if (centerChunk[rowOff + lx] !== 0) {
              sliceActive0[lx] = 1;
              sliceActive1[ly] = 1;
              sliceActive2[lz] = 1;
              anyNonZero = true;
            }
          }
        }
      }
      if (!anyNonZero) continue;

      // 填充 3x3x3 邻居块
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idxN = (dx + 1) + (dz + 1) * 3 + (dy + 1) * 9;
            if (dx === 0 && dy === 0 && dz === 0) {
              nbr[idxN] = centerChunk;
            } else {
              nbr[idxN] = volume.chunks.get(volume._chunkKey(cx + dx, cy + dy, cz + dz)) || null;
            }
          }
        }
      }

      const wx = (cx << CHUNK_SHIFT) + ox;
      const wy = (cy << CHUNK_SHIFT) + oy;
      const wz = (cz << CHUNK_SHIFT) + oz;

      for (let f = 0; f < 6; f++) {
        const fc = faces[f];
        const axis = fc.axis;
        const uAxis = fc.uAxis;
        const vAxis = fc.vAxis;
        const step = fc.step;
        const planeOffset = step > 0 ? 1 : 0;
        const activeArr = sliceFlags[axis];
        const sA = strides[axis];
        const sU = strides[uAxis];
        const sV = strides[vAxis];

        for (let d = 0; d < CHUNK_SIZE; d++) {
          if (activeArr[d] === 0) continue;
          let hasMask = false;
          mask.fill(0);

          const dBase = d * sA;
          const isInnerD = d > 0 && d < 31;

          for (let v = 0; v < CHUNK_SIZE; v++) {
            const dvBase = dBase + v * sV;
            const isInnerDV = isInnerD && v > 0 && v < 31;
            for (let u = 0; u < CHUNK_SIZE; u++) {
              const idxSelf = dvBase + u * sU;
              const mat = centerChunk[idxSelf];
              if (mat === 0) continue;

              const isInner = isInnerDV && u > 0 && u < 31;
              const nMat = isInner
                ? centerChunk[idxSelf + step * sA]
                : (() => {
                    pos[axis] = d; pos[uAxis] = u; pos[vAxis] = v;
                    nPos[0] = pos[0]; nPos[1] = pos[1]; nPos[2] = pos[2];
                    nPos[axis] += step;
                    return getVoxelLocal(nPos[0], nPos[1], nPos[2]);
                  })();

              const selfTrans = isTransparentMat(mat);

              let visible = false;
              if (!selfTrans) {
                visible = nMat === 0 || isTransparentMat(nMat);
              } else {
                visible = nMat === 0 || (isTransparentMat(nMat) && nMat !== mat);
              }
              if (!visible) continue;

              // 计算四个角的 AO（仅不透明面计算完整 AO，透明面设为 3）
              let ao0 = 3, ao1 = 3, ao2 = 3, ao3 = 3;
              if (!selfTrans) {
                const sliceN = d + step;
                let mU, pU1, mV, pV1, c00, c10, c11, c01;
                if (isInner) {
                  const nBase = idxSelf + step * sA;
                  mU = isOpaqueMat(centerChunk[nBase - sU]) ? 1 : 0;
                  pU1 = isOpaqueMat(centerChunk[nBase + sU]) ? 1 : 0;
                  mV = isOpaqueMat(centerChunk[nBase - sV]) ? 1 : 0;
                  pV1 = isOpaqueMat(centerChunk[nBase + sV]) ? 1 : 0;
                  c00 = isOpaqueMat(centerChunk[nBase - sU - sV]) ? 1 : 0;
                  c10 = isOpaqueMat(centerChunk[nBase + sU - sV]) ? 1 : 0;
                  c11 = isOpaqueMat(centerChunk[nBase + sU + sV]) ? 1 : 0;
                  c01 = isOpaqueMat(centerChunk[nBase - sU + sV]) ? 1 : 0;
                } else {
                  const sampleOcc = (du, dv) => {
                    pU[axis] = sliceN; pU[uAxis] = u + du; pU[vAxis] = v + dv;
                    return isOcc(pU[0], pU[1], pU[2]);
                  };
                  mU = sampleOcc(-1, 0);
                  pU1 = sampleOcc(1, 0);
                  mV = sampleOcc(0, -1);
                  pV1 = sampleOcc(0, 1);
                  c00 = sampleOcc(-1, -1);
                  c10 = sampleOcc(1, -1);
                  c11 = sampleOcc(1, 1);
                  c01 = sampleOcc(-1, 1);
                }

                ao0 = calcAO(mU, mV, c00);
                ao1 = calcAO(pU1, mV, c10);
                ao2 = calcAO(pU1, pV1, c11);
                ao3 = calcAO(mU, pV1, c01);
              }

              let flag = 0;
              if (mirrorFlag) {
                pos[axis] = d; pos[uAxis] = u; pos[vAxis] = v;
                flag = mirrorFlag(wx + pos[0], wy + pos[1], wz + pos[2], mat) & 255;
              }
              const packed =
                (mat & 255) |
                ((ao0 & 3) << 8) |
                ((ao1 & 3) << 10) |
                ((ao2 & 3) << 12) |
                ((ao3 & 3) << 14) |
                ((flag & 255) << 16) |
                ((selfTrans ? 1 : 0) << 24);
              mask[u + v * CHUNK_SIZE] = packed;
              hasMask = true;
            }
          }

          if (!hasMask) continue;

          // Greedy 合并二维矩形
          for (let v = 0; v < CHUNK_SIZE; v++) {
            for (let u = 0; u < CHUNK_SIZE;) {
              const key = mask[u + v * CHUNK_SIZE];
              if (key === 0) {
                u++;
                continue;
              }
              let w = 1;
              while (u + w < CHUNK_SIZE && mask[u + w + v * CHUNK_SIZE] === key) {
                w++;
              }
              let h = 1;
              let done = false;
              while (v + h < CHUNK_SIZE) {
                for (let k = 0; k < w; k++) {
                  if (mask[u + k + (v + h) * CHUNK_SIZE] !== key) {
                    done = true;
                    break;
                  }
                }
                if (done) break;
                h++;
              }

              // 清零已合并区域
              for (let l = 0; l < h; l++) {
                const row = u + (v + l) * CHUNK_SIZE;
                for (let k = 0; k < w; k++) {
                  mask[row + k] = 0;
                }
              }

              // 解包生成 Quad
              const matId = key & 255;
              const ao0 = (key >> 8) & 3;
              const ao1 = (key >> 10) & 3;
              const ao2 = (key >> 12) & 3;
              const ao3 = (key >> 14) & 3;
              const flag = (key >> 16) & 255;
              const selfTrans = ((key >> 24) & 1) === 1;

              const builder = selfTrans ? transBuilder : opaqueBuilder;

              // 计算 4 个角点世界体素位置
              pU[axis] = (axis === 0 ? wx : axis === 1 ? wy : wz) + d + planeOffset;
              const baseU = (uAxis === 0 ? wx : uAxis === 1 ? wy : wz) + u;
              const baseV = (vAxis === 0 ? wx : vAxis === 1 ? wy : wz) + v;

              const makeCorner = (cu, cv) => {
                pV[axis] = pU[axis];
                pV[uAxis] = cu;
                pV[vAxis] = cv;
                return [pV[0], pV[1], pV[2]];
              };

              const c0 = makeCorner(baseU, baseV);
              const c1 = makeCorner(baseU + w, baseV);
              const c2 = makeCorner(baseU + w, baseV + h);
              const c3 = makeCorner(baseU, baseV + h);

              builder.pushQuad(
                c0[0], c0[1], c0[2],
                c1[0], c1[1], c1[2],
                c2[0], c2[1], c2[2],
                c3[0], c3[1], c3[2],
                fc.dir, matId, ao0, ao1, ao2, ao3, flag
              );

              u += w;
            }
          }
        }
      }
    }

    if (freeVolumeAfter) {
      volume.clear();
    }

    return {
      opaque: opaqueBuilder.finalize(),
      transparent: transBuilder.finalize()
    };
  }

  // 把 Greedy Mesh 数据上传到 WebGL 2 VAO/VBO/IBO
  function uploadMeshToGPU(gl, meshData) {
    function makeBufferPair(part) {
      if (!part || part.indexCount === 0) return null;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, part.vertexData, gl.STATIC_DRAW);

      // location 0: vec3 aPos (float)
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);

      // location 1: uvec4 aAttr (faceDir, matId, ao, flag)
      gl.enableVertexAttribArray(1);
      gl.vertexAttribIPointer(1, 4, gl.UNSIGNED_BYTE, 16, 12);

      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, part.indices, gl.STATIC_DRAW);

      gl.bindVertexArray(null);
      return {
        vao,
        vbo,
        ibo,
        indexCount: part.indexCount
      };
    }

    return {
      opaque: makeBufferPair(meshData.opaque),
      transparent: makeBufferPair(meshData.transparent)
    };
  }

  SF.Voxel = {
    Mat,
    VoxelVolume,
    buildGreedyMesh,
    uploadMeshToGPU,
    isTransparentMat,
    isOpaqueMat
  };
})(window);
