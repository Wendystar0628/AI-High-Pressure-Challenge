// ============================================================================
// 03_voxel_core.js
// Unified 1x1x1 Sparse Chunked Voxel Grid & Bitmask-Accelerated Greedy Mesher
// Every physical entity uses voxelSize = 1.0 (no local mesh scaling!).
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});
  const isTrans = SF.Palette.isTranslucent;

  const CS = 32;
  const SHIFT = 5;
  const MASK = 31;

  function chunkKey(cx, cy, cz) {
    // Supports cx, cy, cz in [-512, +511] -> [-16384, +16383] voxels!
    return ((cx + 512) & 1023) | (((cy + 512) & 1023) << 10) | (((cz + 512) & 1023) << 20);
  }

  class VoxelChunk {
    constructor(cx, cy, cz) {
      this.cx = cx;
      this.cy = cy;
      this.cz = cz;
      this.voxels = new Uint8Array(32768);     // [lz*1024 + ly*32 + lx]
      this.opaqueMask = new Uint32Array(1024); // [lz*32 + ly], bit lx
      this.transMask = new Uint32Array(1024);  // [lz*32 + ly], bit lx
    }
  }

  class ChunkVoxelGrid {
    constructor() {
      this.chunks = new Map();
      this.minX = Infinity; this.minY = Infinity; this.minZ = Infinity;
      this.maxX = -Infinity; this.maxY = -Infinity; this.maxZ = -Infinity;
    }

    _getOrCreateChunk(cx, cy, cz) {
      const k = chunkKey(cx, cy, cz);
      let ch = this.chunks.get(k);
      if (!ch) {
        ch = new VoxelChunk(cx, cy, cz);
        this.chunks.set(k, ch);
        const bx = cx << SHIFT, by = cy << SHIFT, bz = cz << SHIFT;
        if (bx < this.minX) this.minX = bx;
        if (by < this.minY) this.minY = by;
        if (bz < this.minZ) this.minZ = bz;
        if (bx + 31 > this.maxX) this.maxX = bx + 31;
        if (by + 31 > this.maxY) this.maxY = by + 31;
        if (bz + 31 > this.maxZ) this.maxZ = bz + 31;
      }
      return ch;
    }

    get(x, y, z) {
      const ch = this.chunks.get(chunkKey(x >> SHIFT, y >> SHIFT, z >> SHIFT));
      if (!ch) return 0;
      return ch.voxels[((z & MASK) << 10) | ((y & MASK) << 5) | (x & MASK)];
    }

    set(x, y, z, mat) {
      x |= 0; y |= 0; z |= 0; mat |= 0;
      const cx = x >> SHIFT, cy = y >> SHIFT, cz = z >> SHIFT;
      if (mat === 0) {
        const ch = this.chunks.get(chunkKey(cx, cy, cz));
        if (!ch) return;
        const lx = x & MASK, ly = y & MASK, lz = z & MASK;
        const yz = (lz << 5) | ly;
        const idx = (yz << 5) | lx;
        if (ch.voxels[idx] === 0) return;
        ch.voxels[idx] = 0;
        const bit = ~(1 << lx);
        ch.opaqueMask[yz] &= bit;
        ch.transMask[yz] &= bit;
        return;
      }
      const ch = this._getOrCreateChunk(cx, cy, cz);
      const lx = x & MASK, ly = y & MASK, lz = z & MASK;
      const yz = (lz << 5) | ly;
      const idx = (yz << 5) | lx;
      ch.voxels[idx] = mat;
      const bit = 1 << lx;
      if (isTrans[mat]) {
        ch.transMask[yz] |= bit;
        ch.opaqueMask[yz] &= ~bit;
      } else {
        ch.opaqueMask[yz] |= bit;
        ch.transMask[yz] &= ~bit;
      }
    }

    // Fast inclusive integer box fill [x0..x1] x [y0..y1] x [z0..z1]
    fillBox(x0, y0, z0, x1, y1, z1, mat) {
      x0 = Math.round(x0); y0 = Math.round(y0); z0 = Math.round(z0);
      x1 = Math.round(x1); y1 = Math.round(y1); z1 = Math.round(z1);
      if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
      if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
      if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
      mat |= 0;

      const cx0 = x0 >> SHIFT, cx1 = x1 >> SHIFT;
      const cy0 = y0 >> SHIFT, cy1 = y1 >> SHIFT;
      const cz0 = z0 >> SHIFT, cz1 = z1 >> SHIFT;
      const trans = mat !== 0 && isTrans[mat] === 1;

      for (let cz = cz0; cz <= cz1; cz++) {
        const bz = cz << SHIFT;
        const lz0 = Math.max(0, z0 - bz);
        const lz1 = Math.min(31, z1 - bz);
        for (let cy = cy0; cy <= cy1; cy++) {
          const by = cy << SHIFT;
          const ly0 = Math.max(0, y0 - by);
          const ly1 = Math.min(31, y1 - by);
          for (let cx = cx0; cx <= cx1; cx++) {
            let ch;
            if (mat === 0) {
              ch = this.chunks.get(chunkKey(cx, cy, cz));
              if (!ch) continue;
            } else {
              ch = this._getOrCreateChunk(cx, cy, cz);
            }
            const bx = cx << SHIFT;
            const lx0 = Math.max(0, x0 - bx);
            const lx1 = Math.min(31, x1 - bx);
            const spanLen = lx1 - lx0 + 1;
            const rowMask = spanLen === 32 ? 0xFFFFFFFF : (((1 << spanLen) - 1) << lx0);
            const invMask = ~rowMask;

            const vox = ch.voxels;
            const opM = ch.opaqueMask;
            const trM = ch.transMask;

            for (let lz = lz0; lz <= lz1; lz++) {
              const zBase = lz << 5;
              for (let ly = ly0; ly <= ly1; ly++) {
                const yz = zBase + ly;
                const vBase = yz << 5;
                vox.fill(mat, vBase + lx0, vBase + lx1 + 1);
                if (mat === 0) {
                  opM[yz] &= invMask;
                  trM[yz] &= invMask;
                } else if (trans) {
                  trM[yz] |= rowMask;
                  opM[yz] &= invMask;
                } else {
                  opM[yz] |= rowMask;
                  trM[yz] &= invMask;
                }
              }
            }
          }
        }
      }
    }

    carveBox(x0, y0, z0, x1, y1, z1) {
      this.fillBox(x0, y0, z0, x1, y1, z1, 0);
    }

    // Hollow rectangular shell of wall thickness `w` (avoids filling unseen deep interiors!)
    shellBox(x0, y0, z0, x1, y1, z1, w, mat) {
      x0 = Math.round(x0); y0 = Math.round(y0); z0 = Math.round(z0);
      x1 = Math.round(x1); y1 = Math.round(y1); z1 = Math.round(z1);
      if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
      if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
      if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
      w = Math.max(1, Math.round(w));
      if ((x1 - x0 + 1) <= w * 2 || (y1 - y0 + 1) <= w * 2 || (z1 - z0 + 1) <= w * 2) {
        this.fillBox(x0, y0, z0, x1, y1, z1, mat);
        return;
      }
      // Top & bottom slabs
      this.fillBox(x0, y1 - w + 1, z0, x1, y1, z1, mat);
      this.fillBox(x0, y0, z0, x1, y0 + w - 1, z1, mat);
      // Left & right walls
      this.fillBox(x0, y0 + w, z0, x0 + w - 1, y1 - w, z1, mat);
      this.fillBox(x1 - w + 1, y0 + w, z0, x1, y1 - w, z1, mat);
      // Front & back walls
      this.fillBox(x0 + w, y0 + w, z1 - w + 1, x1 - w, y1 - w, z1, mat);
      this.fillBox(x0 + w, y0 + w, z0, x1 - w, y1 - w, z0 + w - 1, mat);
    }

    // Stepped loft along Z axis: creates crisp tectonic voxel terraces!
    fillSteppedLoftZ(z0, z1, stepZ, x0a, y0a, x1a, y1a, x0b, y0b, x1b, y1b, mat, shellThick) {
      z0 = Math.round(z0); z1 = Math.round(z1);
      stepZ = Math.max(1, Math.round(stepZ));
      const span = Math.max(1, z1 - z0);
      for (let z = z0; z <= z1; z += stepZ) {
        const ze = Math.min(z1, z + stepZ - 1);
        const t = ((z + ze) * 0.5 - z0) / span;
        const bx0 = Math.round(x0a + (x0b - x0a) * t);
        const by0 = Math.round(y0a + (y0a !== y0b ? (y0b - y0a) * t : 0));
        const bx1 = Math.round(x1a + (x1b - x1a) * t);
        const by1 = Math.round(y1a + (y1b - y1a) * t);
        if (shellThick && shellThick > 0) {
          this.shellBox(bx0, by0, z, bx1, by1, ze, shellThick, mat);
        } else {
          this.fillBox(bx0, by0, z, bx1, by1, ze, mat);
        }
      }
    }

    // Symmetric bilateral fill (+X and -X simultaneously!)
    fillSymX(x0, y0, z0, x1, y1, z1, mat, shellThick) {
      if (shellThick && shellThick > 0) {
        this.shellBox(x0, y0, z0, x1, y1, z1, shellThick, mat);
        this.shellBox(-x1, y0, z0, -x0, y1, z1, shellThick, mat);
      } else {
        this.fillBox(x0, y0, z0, x1, y1, z1, mat);
        this.fillBox(-x1, y0, z0, -x0, y1, z1, mat);
      }
    }

    carveSymX(x0, y0, z0, x1, y1, z1) {
      this.carveBox(x0, y0, z0, x1, y1, z1);
      this.carveBox(-x1, y0, z0, -x0, y1, z1);
    }

    fillSymSteppedLoftZ(z0, z1, stepZ, x0a, y0a, x1a, y1a, x0b, y0b, x1b, y1b, mat, shellThick) {
      this.fillSteppedLoftZ(z0, z1, stepZ, x0a, y0a, x1a, y1a, x0b, y0b, x1b, y1b, mat, shellThick);
      this.fillSteppedLoftZ(z0, z1, stepZ, -x1a, y0a, -x0a, y1a, -x1b, y0b, -x0b, y1b, mat, shellThick);
    }

    // Axis-aligned integer voxel cylinder / hollow pipe ('x', 'y', or 'z')
    fillCylinder(axis, a0, a1, uCenter, vCenter, rOuter, rInner, mat) {
      a0 = Math.round(a0); a1 = Math.round(a1);
      if (a0 > a1) { const t = a0; a0 = a1; a1 = t; }
      const ro2 = rOuter * rOuter;
      const ri2 = rInner > 0 ? rInner * rInner : -1;
      const uMin = Math.floor(uCenter - rOuter);
      const uMax = Math.ceil(uCenter + rOuter);
      const vMin = Math.floor(vCenter - rOuter);
      const vMax = Math.ceil(vCenter + rOuter);

      if (axis === 'z') {
        for (let v = vMin; v <= vMax; v++) {
          const dv = v - vCenter;
          const dv2 = dv * dv;
          if (dv2 > ro2) continue;
          let runStart = null;
          for (let u = uMin; u <= uMax + 1; u++) {
            const du = u - uCenter;
            const d2 = du * du + dv2;
            const inside = u <= uMax && d2 <= ro2 && d2 >= ri2;
            if (inside && runStart === null) {
              runStart = u;
            } else if (!inside && runStart !== null) {
              this.fillBox(runStart, v, a0, u - 1, v, a1, mat);
              runStart = null;
            }
          }
        }
      } else if (axis === 'y') {
        for (let v = vMin; v <= vMax; v++) {
          const dv = v - vCenter;
          const dv2 = dv * dv;
          if (dv2 > ro2) continue;
          let runStart = null;
          for (let u = uMin; u <= uMax + 1; u++) {
            const du = u - uCenter;
            const d2 = du * du + dv2;
            const inside = u <= uMax && d2 <= ro2 && d2 >= ri2;
            if (inside && runStart === null) {
              runStart = u;
            } else if (!inside && runStart !== null) {
              this.fillBox(runStart, a0, v, u - 1, a1, v, mat);
              runStart = null;
            }
          }
        }
      } else {
        for (let v = vMin; v <= vMax; v++) {
          const dv = v - vCenter;
          const dv2 = dv * dv;
          if (dv2 > ro2) continue;
          let runStart = null;
          for (let u = uMin; u <= uMax + 1; u++) {
            const du = u - uCenter;
            const d2 = du * du + dv2;
            const inside = u <= uMax && d2 <= ro2 && d2 >= ri2;
            if (inside && runStart === null) {
              runStart = u;
            } else if (!inside && runStart !== null) {
              this.fillBox(a0, runStart, v, a1, u - 1, v, mat);
              runStart = null;
            }
          }
        }
      }
    }
  }

  // --- Dynamic Growable Typed Mesh Builder (16 bytes/vertex + Uint32 indices) ---
  class MeshAccumulator {
    constructor(initialQuads = 4096) {
      this.vertCap = initialQuads * 4;
      this.idxCap = initialQuads * 6;
      this.buf = new ArrayBuffer(this.vertCap * 16);
      this.f32 = new Float32Array(this.buf);
      this.u32 = new Uint32Array(this.buf);
      this.indices = new Uint32Array(this.idxCap);
      this.vCount = 0;
      this.iCount = 0;
    }

    _ensureQuad() {
      if (this.vCount + 4 > this.vertCap) {
        this.vertCap *= 2;
        const nb = new ArrayBuffer(this.vertCap * 16);
        new Uint32Array(nb).set(this.u32);
        this.buf = nb;
        this.f32 = new Float32Array(nb);
        this.u32 = new Uint32Array(nb);
      }
      if (this.iCount + 6 > this.idxCap) {
        this.idxCap *= 2;
        const ni = new Uint32Array(this.idxCap);
        ni.set(this.indices);
        this.indices = ni;
      }
    }

    pushQuad(
      x0, y0, z0, ao0,
      x1, y1, z1, ao1,
      x2, y2, z2, ao2,
      x3, y3, z3, ao3,
      dir, matId, ccwStandard
    ) {
      this._ensureQuad();
      const baseV = this.vCount;
      const baseP = dir | (matId << 3);

      let o = baseV * 4;
      this.f32[o] = x0; this.f32[o + 1] = y0; this.f32[o + 2] = z0; this.u32[o + 3] = baseP | (ao0 << 11);
      o += 4;
      this.f32[o] = x1; this.f32[o + 1] = y1; this.f32[o + 2] = z1; this.u32[o + 3] = baseP | (ao1 << 11);
      o += 4;
      this.f32[o] = x2; this.f32[o + 1] = y2; this.f32[o + 2] = z2; this.u32[o + 3] = baseP | (ao2 << 11);
      o += 4;
      this.f32[o] = x3; this.f32[o + 1] = y3; this.f32[o + 2] = z3; this.u32[o + 3] = baseP | (ao3 << 11);

      this.vCount += 4;

      const idx = this.indices;
      let ic = this.iCount;
      // Flip quad diagonal when needed so vertex AO interpolates without anisotropy!
      const flipDiag = (ao0 + ao2) < (ao1 + ao3);
      if (ccwStandard) {
        if (!flipDiag) {
          idx[ic] = baseV; idx[ic + 1] = baseV + 1; idx[ic + 2] = baseV + 2;
          idx[ic + 3] = baseV; idx[ic + 4] = baseV + 2; idx[ic + 5] = baseV + 3;
        } else {
          idx[ic] = baseV + 1; idx[ic + 1] = baseV + 2; idx[ic + 2] = baseV + 3;
          idx[ic + 3] = baseV + 1; idx[ic + 4] = baseV + 3; idx[ic + 5] = baseV;
        }
      } else {
        if (!flipDiag) {
          idx[ic] = baseV; idx[ic + 1] = baseV + 3; idx[ic + 2] = baseV + 2;
          idx[ic + 3] = baseV; idx[ic + 4] = baseV + 2; idx[ic + 5] = baseV + 1;
        } else {
          idx[ic] = baseV + 1; idx[ic + 1] = baseV; idx[ic + 2] = baseV + 3;
          idx[ic + 3] = baseV + 1; idx[ic + 4] = baseV + 3; idx[ic + 5] = baseV + 2;
        }
      }
      this.iCount += 6;
    }

    toMeshData() {
      return {
        vertexBuffer: this.buf.slice(0, this.vCount * 16),
        indices: this.indices.slice(0, this.iCount),
        vertexCount: this.vCount,
        indexCount: this.iCount
      };
    }
  }

  // Shared scratch buffers for greedy slice merging (32x32 = 1024)
  const sliceKey = new Int32Array(1024);

  // --- Bitmask-Accelerated Chunked Greedy Mesher with 4-Corner Voxel AO ---
  function meshVoxelGrid(grid, opts) {
    const computeAO = (!opts || opts.ao !== false);
    const opaqueAcc = new MeshAccumulator(Math.max(512, grid.chunks.size * 64));
    const transAcc = new MeshAccumulator(256);

    const nb = new Array(27); // 3x3x3 chunk neighborhood cache

    // Helper to query opaque status in [-1 .. 32]^3 relative to current chunk
    function nbOpaque(lx, ly, lz) {
      const ncx = (lx >> 5) + 1;
      const ncy = (ly >> 5) + 1;
      const ncz = (lz >> 5) + 1;
      const c = nb[ncz * 9 + ncy * 3 + ncx];
      if (!c) return 0;
      const yz = ((lz & 31) << 5) | (ly & 31);
      return (c.opaqueMask[yz] >>> (lx & 31)) & 1;
    }

    function nbVoxel(lx, ly, lz) {
      const ncx = (lx >> 5) + 1;
      const ncy = (ly >> 5) + 1;
      const ncz = (lz >> 5) + 1;
      const c = nb[ncz * 9 + ncy * 3 + ncx];
      if (!c) return 0;
      return c.voxels[((lz & 31) << 10) | ((ly & 31) << 5) | (lx & 31)];
    }

    function calcCornerAO(s1, s2, cr) {
      return (s1 & s2) ? 0 : (3 - (s1 + s2 + cr));
    }

    for (const ch of grid.chunks.values()) {
      const { cx, cy, cz, voxels, opaqueMask, transMask } = ch;

      // Quick skip if chunk is completely empty
      let anyBits = 0;
      for (let i = 0; i < 1024; i++) {
        anyBits |= (opaqueMask[i] | transMask[i]);
        if (anyBits !== 0) break;
      }
      if (anyBits === 0) continue;

      // Populate 3x3x3 neighbor chunks once!
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            nb[(dz + 1) * 9 + (dy + 1) * 3 + (dx + 1)] =
              (dx === 0 && dy === 0 && dz === 0) ? ch : (grid.chunks.get(chunkKey(cx + dx, cy + dy, cz + dz)) || null);
          }
        }
      }

      const wx = cx << 5, wy = cy << 5, wz = cz << 5;

      // Mesh both Pass 0 (Opaque) and Pass 1 (Translucent)
      for (let pass = 0; pass < 2; pass++) {
        const maskArr = pass === 0 ? opaqueMask : transMask;
        let hasPass = 0;
        for (let i = 0; i < 1024; i++) {
          if (maskArr[i] !== 0) { hasPass = 1; break; }
        }
        if (!hasPass) continue;
        const acc = pass === 0 ? opaqueAcc : transAcc;

        // ------------------------------------------------------------------
        // Directions 0 (+X) and 1 (-X): plane at x, u = ly [0..31], v = lz [0..31]
        // ------------------------------------------------------------------
        for (let side = 0; side < 2; side++) {
          const dir = side; // 0 = +X, 1 = -X
          const nx = side === 0 ? 1 : -1;
          const xShift = side === 0 ? 1 : 0;
          const ccw = side === 0;
          const adjChunk = nb[1 * 9 + 1 * 3 + (1 + nx)];

          for (let lx = 0; lx < 32; lx++) {
            const bit = 1 << lx;
            let count = 0;
            sliceKey.fill(0);

            for (let lz = 0; lz < 32; lz++) {
              const zOff = lz << 5;
              for (let ly = 0; ly < 32; ly++) {
                const yz = zOff + ly;
                if ((maskArr[yz] & bit) === 0) continue;

                // Check neighbor at lx + nx
                let exposed = true;
                const nlx = lx + nx;
                if (pass === 0) {
                  if (nlx >= 0 && nlx < 32) {
                    exposed = (opaqueMask[yz] & (1 << nlx)) === 0;
                  } else if (adjChunk) {
                    exposed = (adjChunk.opaqueMask[yz] & (1 << (nlx & 31))) === 0;
                  }
                } else {
                  const selfMat = voxels[(yz << 5) | lx];
                  const nMat = nbVoxel(nlx, ly, lz);
                  exposed = (nMat === 0) || (nMat !== selfMat && isTrans[nMat] === 0 ? false : nMat !== selfMat);
                  if (nMat !== 0 && !isTrans[nMat]) exposed = false;
                }
                if (!exposed) continue;

                const mat = voxels[(yz << 5) | lx];
                let ao00 = 3, ao10 = 3, ao11 = 3, ao01 = 3;
                if (computeAO && pass === 0) {
                  const m0m = nbOpaque(nlx, ly - 1, lz);
                  const m0p = nbOpaque(nlx, ly + 1, lz);
                  const mm0 = nbOpaque(nlx, ly, lz - 1);
                  const mp0 = nbOpaque(nlx, ly, lz + 1);
                  ao00 = calcCornerAO(m0m, mm0, nbOpaque(nlx, ly - 1, lz - 1));
                  ao10 = calcCornerAO(m0p, mm0, nbOpaque(nlx, ly + 1, lz - 1));
                  ao11 = calcCornerAO(m0p, mp0, nbOpaque(nlx, ly + 1, lz + 1));
                  ao01 = calcCornerAO(m0m, mp0, nbOpaque(nlx, ly - 1, lz + 1));
                }
                sliceKey[yz] = mat | (ao00 << 8) | (ao10 << 10) | (ao11 << 12) | (ao01 << 14);
                count++;
              }
            }

            if (count === 0) continue;
            const px = wx + lx + xShift;

            for (let v = 0; v < 32; v++) {
              for (let u = 0; u < 32; ) {
                const k = sliceKey[(v << 5) + u];
                if (k === 0) { u++; continue; }
                let w = 1;
                while (u + w < 32 && sliceKey[(v << 5) + u + w] === k) w++;
                let h = 1;
                outerH_X: while (v + h < 32) {
                  const row = (v + h) << 5;
                  for (let du = 0; du < w; du++) {
                    if (sliceKey[row + u + du] !== k) break outerH_X;
                  }
                  h++;
                }
                for (let dv = 0; dv < h; dv++) {
                  const row = (v + dv) << 5;
                  for (let du = 0; du < w; du++) sliceKey[row + u + du] = 0;
                }
                const mat = k & 255;
                const ao00 = (k >>> 8) & 3, ao10 = (k >>> 10) & 3, ao11 = (k >>> 12) & 3, ao01 = (k >>> 14) & 3;
                const y0 = wy + u, y1 = y0 + w;
                const z0 = wz + v, z1 = z0 + h;
                acc.pushQuad(
                  px, y0, z0, ao00,
                  px, y1, z0, ao10,
                  px, y1, z1, ao11,
                  px, y0, z1, ao01,
                  dir, mat, ccw
                );
                u += w;
              }
            }
          }
        }

        // ------------------------------------------------------------------
        // Directions 2 (+Y) and 3 (-Y): plane at y, u = lx [0..31], v = lz [0..31]
        // Fast bitwise row culling along lx!
        // ------------------------------------------------------------------
        for (let side = 0; side < 2; side++) {
          const dir = 2 + side; // 2 = +Y, 3 = -Y
          const ny = side === 0 ? 1 : -1;
          const yShift = side === 0 ? 1 : 0;
          const ccw = side === 1; // -Y is standard CCW for u=X, v=Z; +Y flips!
          const adjChunk = nb[1 * 9 + (1 + ny) * 3 + 1];

          for (let ly = 0; ly < 32; ly++) {
            const nly = ly + ny;
            let count = 0;
            sliceKey.fill(0);

            for (let lz = 0; lz < 32; lz++) {
              const yz = (lz << 5) | ly;
              const rowBits = maskArr[yz];
              if (rowBits === 0) continue;

              let occNeighbor = 0;
              if (pass === 0) {
                if (nly >= 0 && nly < 32) {
                  occNeighbor = opaqueMask[(lz << 5) | nly];
                } else if (adjChunk) {
                  occNeighbor = adjChunk.opaqueMask[(lz << 5) | (nly & 31)];
                }
              }

              let exposedMask = pass === 0 ? (rowBits & ~occNeighbor) : rowBits;
              while (exposedMask !== 0) {
                const lsb = exposedMask & -exposedMask;
                const lx = 31 - Math.clz32(lsb);
                exposedMask ^= lsb;

                const mat = voxels[(yz << 5) | lx];
                if (pass === 1) {
                  const nMat = nbVoxel(lx, nly, lz);
                  if (nMat === mat || (nMat !== 0 && !isTrans[nMat])) continue;
                }

                let ao00 = 3, ao10 = 3, ao11 = 3, ao01 = 3;
                if (computeAO && pass === 0) {
                  const mm0 = nbOpaque(lx - 1, nly, lz);
                  const mp0 = nbOpaque(lx + 1, nly, lz);
                  const m0m = nbOpaque(lx, nly, lz - 1);
                  const m0p = nbOpaque(lx, nly, lz + 1);
                  ao00 = calcCornerAO(mm0, m0m, nbOpaque(lx - 1, nly, lz - 1));
                  ao10 = calcCornerAO(mp0, m0m, nbOpaque(lx + 1, nly, lz - 1));
                  ao11 = calcCornerAO(mp0, m0p, nbOpaque(lx + 1, nly, lz + 1));
                  ao01 = calcCornerAO(mm0, m0p, nbOpaque(lx - 1, nly, lz + 1));
                }
                sliceKey[(lz << 5) | lx] = mat | (ao00 << 8) | (ao10 << 10) | (ao11 << 12) | (ao01 << 14);
                count++;
              }
            }

            if (count === 0) continue;
            const py = wy + ly + yShift;

            for (let v = 0; v < 32; v++) {
              for (let u = 0; u < 32; ) {
                const k = sliceKey[(v << 5) + u];
                if (k === 0) { u++; continue; }
                let w = 1;
                while (u + w < 32 && sliceKey[(v << 5) + u + w] === k) w++;
                let h = 1;
                outerH_Y: while (v + h < 32) {
                  const row = (v + h) << 5;
                  for (let du = 0; du < w; du++) {
                    if (sliceKey[row + u + du] !== k) break outerH_Y;
                  }
                  h++;
                }
                for (let dv = 0; dv < h; dv++) {
                  const row = (v + dv) << 5;
                  for (let du = 0; du < w; du++) sliceKey[row + u + du] = 0;
                }
                const mat = k & 255;
                const ao00 = (k >>> 8) & 3, ao10 = (k >>> 10) & 3, ao11 = (k >>> 12) & 3, ao01 = (k >>> 14) & 3;
                const x0 = wx + u, x1 = x0 + w;
                const z0 = wz + v, z1 = z0 + h;
                acc.pushQuad(
                  x0, py, z0, ao00,
                  x1, py, z0, ao10,
                  x1, py, z1, ao11,
                  x0, py, z1, ao01,
                  dir, mat, ccw
                );
                u += w;
              }
            }
          }
        }

        // ------------------------------------------------------------------
        // Directions 4 (+Z) and 5 (-Z): plane at z, u = lx [0..31], v = ly [0..31]
        // Fast bitwise row culling along lx!
        // ------------------------------------------------------------------
        for (let side = 0; side < 2; side++) {
          const dir = 4 + side; // 4 = +Z, 5 = -Z
          const nz = side === 0 ? 1 : -1;
          const zShift = side === 0 ? 1 : 0;
          const ccw = side === 0; // +Z is standard CCW for u=X, v=Y; -Z flips!
          const adjChunk = nb[(1 + nz) * 9 + 1 * 3 + 1];

          for (let lz = 0; lz < 32; lz++) {
            const nlz = lz + nz;
            let count = 0;
            sliceKey.fill(0);

            for (let ly = 0; ly < 32; ly++) {
              const yz = (lz << 5) | ly;
              const rowBits = maskArr[yz];
              if (rowBits === 0) continue;

              let occNeighbor = 0;
              if (pass === 0) {
                if (nlz >= 0 && nlz < 32) {
                  occNeighbor = opaqueMask[(nlz << 5) | ly];
                } else if (adjChunk) {
                  occNeighbor = adjChunk.opaqueMask[((nlz & 31) << 5) | ly];
                }
              }

              let exposedMask = pass === 0 ? (rowBits & ~occNeighbor) : rowBits;
              while (exposedMask !== 0) {
                const lsb = exposedMask & -exposedMask;
                const lx = 31 - Math.clz32(lsb);
                exposedMask ^= lsb;

                const mat = voxels[(yz << 5) | lx];
                if (pass === 1) {
                  const nMat = nbVoxel(lx, ly, nlz);
                  if (nMat === mat || (nMat !== 0 && !isTrans[nMat])) continue;
                }

                let ao00 = 3, ao10 = 3, ao11 = 3, ao01 = 3;
                if (computeAO && pass === 0) {
                  const mm0 = nbOpaque(lx - 1, ly, nlz);
                  const mp0 = nbOpaque(lx + 1, ly, nlz);
                  const m0m = nbOpaque(lx, ly - 1, nlz);
                  const m0p = nbOpaque(lx, ly + 1, nlz);
                  ao00 = calcCornerAO(mm0, m0m, nbOpaque(lx - 1, ly - 1, nlz));
                  ao10 = calcCornerAO(mp0, m0m, nbOpaque(lx + 1, ly - 1, nlz));
                  ao11 = calcCornerAO(mp0, m0p, nbOpaque(lx + 1, ly + 1, nlz));
                  ao01 = calcCornerAO(mm0, m0p, nbOpaque(lx - 1, ly + 1, nlz));
                }
                sliceKey[(ly << 5) | lx] = mat | (ao00 << 8) | (ao10 << 10) | (ao11 << 12) | (ao01 << 14);
                count++;
              }
            }

            if (count === 0) continue;
            const pz = wz + lz + zShift;

            for (let v = 0; v < 32; v++) {
              for (let u = 0; u < 32; ) {
                const k = sliceKey[(v << 5) + u];
                if (k === 0) { u++; continue; }
                let w = 1;
                while (u + w < 32 && sliceKey[(v << 5) + u + w] === k) w++;
                let h = 1;
                outerH_Z: while (v + h < 32) {
                  const row = (v + h) << 5;
                  for (let du = 0; du < w; du++) {
                    if (sliceKey[row + u + du] !== k) break outerH_Z;
                  }
                  h++;
                }
                for (let dv = 0; dv < h; dv++) {
                  const row = (v + dv) << 5;
                  for (let du = 0; du < w; du++) sliceKey[row + u + du] = 0;
                }
                const mat = k & 255;
                const ao00 = (k >>> 8) & 3, ao10 = (k >>> 10) & 3, ao11 = (k >>> 12) & 3, ao01 = (k >>> 14) & 3;
                const x0 = wx + u, x1 = x0 + w;
                const y0 = wy + v, y1 = y0 + h;
                acc.pushQuad(
                  x0, y0, pz, ao00,
                  x1, y0, pz, ao10,
                  x1, y1, pz, ao11,
                  x0, y1, pz, ao01,
                  dir, mat, ccw
                );
                u += w;
              }
            }
          }
        }
      }
    }

    return {
      opaque: opaqueAcc.toMeshData(),
      translucent: transAcc.toMeshData(),
      bounds: {
        minX: grid.minX, minY: grid.minY, minZ: grid.minZ,
        maxX: grid.maxX, maxY: grid.maxY, maxZ: grid.maxZ
      }
    };
  }

  SF.Voxel = {
    ChunkVoxelGrid,
    meshVoxelGrid
  };
})(window);
