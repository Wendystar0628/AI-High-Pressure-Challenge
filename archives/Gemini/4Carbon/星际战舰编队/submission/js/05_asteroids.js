// ============================================================================
// 05_asteroids.js
// Procedural 1x1x1 Voxel Asteroids (irregular stepped strata, fissures, arches)
// & Authentic Jigsaw-Partitioned Multi-Scale Voxel Fracture Pieces.
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});
  const { ChunkVoxelGrid, meshVoxelGrid } = SF.Voxel;
  const { createRNG, noise3D, fbm3D, clamp } = SF.Math;
  const M = SF.MAT;

  // Sculpt an irregular, terraced, fissured voxel asteroid with optional through-arch
  function sculptAsteroidVoxels(rx, ry, rz, seed, withThroughHole) {
    const rng = createRNG(seed);
    const g = new ChunkVoxelGrid();
    const ox = (rng() - 0.5) * 200;
    const oy = (rng() - 0.5) * 200;
    const oz = (rng() - 0.5) * 200;

    // 3 Offset lobes for non-spherical silhouette
    const lobes = [
      { cx: -rx * 0.18, cy:  ry * 0.08, cz:  rz * 0.10, sx: rx * 0.86, sy: ry * 0.88, sz: rz * 0.88 },
      { cx:  rx * 0.26, cy: -ry * 0.12, cz: -rz * 0.14, sx: rx * 0.72, sy: ry * 0.76, sz: rz * 0.74 },
      { cx:  rx * 0.04, cy:  ry * 0.24, cz:  rz * 0.22, sx: rx * 0.62, sy: ry * 0.60, sz: rz * 0.66 }
    ];

    // Through-cavity tunnel axis (if enabled)
    const holeX = (rng() - 0.5) * rx * 0.28;
    const holeY = (rng() - 0.5) * ry * 0.24;
    const holeR = Math.max(4.5, Math.min(rx, ry) * 0.21);

    // Canyon fault plane normal
    const fx = 0.62 + (rng() - 0.5) * 0.3;
    const fy = 0.55 + (rng() - 0.5) * 0.3;
    const fz = 0.45 + (rng() - 0.5) * 0.3;

    const minX = -Math.ceil(rx * 1.08), maxX = Math.ceil(rx * 1.08);
    const minY = -Math.ceil(ry * 1.08), maxY = Math.ceil(ry * 1.08);
    const minZ = -Math.ceil(rz * 1.08), maxZ = Math.ceil(rz * 1.08);

    // Quantize Y/strata in 3..4 voxel ledges for geological stepped look
    const strataStep = rx > 35 ? 4 : 3;

    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        // Quantized geological shelf offset
        const strataBand = Math.floor((y + z * 0.22) / strataStep);
        const shelfJitter = ((strataBand * 2654435761) & 7) * 0.028;

        for (let x = minX; x <= maxX; x++) {
          // Minimum normalized distance across lobes
          let dMin = 99.0;
          for (let i = 0; i < 3; i++) {
            const L = lobes[i];
            const dx = (x - L.cx) / L.sx;
            const dy = (y - L.cy) / L.sy;
            const dz = (z - L.cz) / L.sz;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < dMin) dMin = d;
          }
          if (dMin > 1.38) continue;

          const nCoarse = fbm3D(x * 0.045 + ox, y * 0.045 + oy, z * 0.045 + oz, 3);
          const nDetail = noise3D(x * 0.12 - ox, y * 0.12 + oy, z * 0.12 - oz);
          const field = Math.sqrt(dMin) - (nCoarse - 0.5) * 0.46 - (nDetail - 0.5) * 0.16 + shelfJitter;
          if (field > 0.96) continue;

          // Deep surface fault canyon carving
          const canyonDist = Math.abs(x * fx + y * fy + z * fz + (nCoarse - 0.5) * rx * 0.38);
          const radial = Math.sqrt(dMin);
          if (radial > 0.52 && canyonDist < rx * 0.11) continue;

          // Optional through-arch / cavity right through the rock!
          if (withThroughHole) {
            const hdx = x - holeX + (nDetail - 0.5) * 5.5;
            const hdy = y - holeY + (nCoarse - 0.5) * 6.5;
            if (hdx * hdx + hdy * hdy < holeR * holeR) continue;
          }

          // Choose geological stratum material
          let mat = M.ROCK_MID;
          if (canyonDist < rx * 0.19 || field < 0.58) {
            mat = M.ROCK_DARK;
          } else if (((strataBand + Math.floor(nCoarse * 5)) % 5) === 0) {
            mat = M.ROCK_OCHRE;
          } else if (field > 0.80 && (x * 0.5 + y * 0.7 + z * 0.3) > 0) {
            mat = M.ROCK_LIGHT;
          }
          g.set(x, y, z, mat);
        }
      }
    }
    return g;
  }

  // Partition an existing sculpted asteroid voxel grid into exact jigsaw slabs & tumbling boulders!
  // Every single piece keeps voxelSize = 1.0, fits seamlessly at t < impact, and reveals
  // genuine heated-then-cooling stepped fracture faces when separated!
  function buildDestructibleAsteroid(rx, ry, rz, seed, mode) {
    const baseGrid = sculptAsteroidVoxels(rx, ry, rz, seed, true);
    const rng = createRNG(seed + 991);
    const ox = (rng() - 0.5) * 100, oy = (rng() - 0.5) * 100, oz = (rng() - 0.5) * 100;

    // Define Voronoi / Tectonic region seeds depending on weapon mode
    // Region 0..S-1: Major Slabs; Region S..S+B-1: Medium Tumbling Boulders
    const seeds = [];
    if (mode === 'beam_pulse') {
      // 3 Major Tectonic Slabs split across the Main Beam axis
      seeds.push(
        { pos: [-rx * 0.44, -ry * 0.12,  0], weight: 1.0, kind: 'slab', dir: [-0.92, -0.22,  0.14], spin: [ 0.25, -0.35,  0.42], delay: 0.35 },
        { pos: [ rx * 0.44,  ry * 0.10, -rz * 0.16], weight: 1.0, kind: 'slab', dir: [ 0.88,  0.18, -0.24], spin: [-0.30,  0.28, -0.38], delay: 0.35 },
        { pos: [ rx * 0.08, -ry * 0.42,  rz * 0.36], weight: 1.05, kind: 'slab', dir: [ 0.16, -0.82,  0.45], spin: [ 0.40,  0.18, -0.25], delay: 0.48 }
      );
      // 5 Upper/Starboard Edge Boulders knocked off early by Pulse Turrets
      for (let i = 0; i < 5; i++) {
        const ang = -0.5 + i * 0.48;
        const px = Math.cos(ang) * rx * 0.62;
        const py = ry * (0.38 + (i % 2) * 0.22);
        const pz = Math.sin(ang) * rz * 0.55;
        seeds.push({
          pos: [px, py, pz],
          weight: 0.62,
          kind: 'pulse_chunk',
          dir: [px / rx + 0.25, 0.72 + (i % 3) * 0.18, pz / rz],
          spin: [(rng() - 0.5) * 2.8, (rng() - 0.5) * 2.8, (rng() - 0.5) * 2.8],
          delay: i * 0.26
        });
      }
      // 6 Core Fault-Zone Medium Boulders tumbling out of the widening beam chasm
      for (let i = 0; i < 6; i++) {
        const py = (i / 5 - 0.5) * ry * 0.9;
        const pz = ((i % 3) - 1) * rz * 0.38;
        seeds.push({
          pos: [(rng() - 0.5) * rx * 0.22, py, pz],
          weight: 0.66,
          kind: 'beam_chunk',
          dir: [(rng() - 0.5) * 1.4, py / ry * 0.9 + (rng() - 0.5) * 0.5, pz / rz + 0.35],
          spin: [(rng() - 0.5) * 2.4, (rng() - 0.5) * 2.4, (rng() - 0.5) * 2.4],
          delay: 0.25 + i * 0.12
        });
      }
    } else if (mode === 'pulse_barrage') {
      // 1 Heavy Cratered Core + 8 Stepped Edge Chunks blasted off sequentially
      seeds.push(
        { pos: [-rx * 0.15, -ry * 0.15, -rz * 0.12], weight: 1.15, kind: 'core', dir: [-0.25, -0.18, -0.20], spin: [0.14, -0.18, 0.12], delay: 0.15 }
      );
      for (let i = 0; i < 8; i++) {
        const theta = (i / 8) * Math.PI * 1.65 - 0.6;
        const px = Math.cos(theta) * rx * 0.58;
        const py = Math.sin(theta) * ry * 0.56 + ry * 0.12;
        const pz = ((i % 3) - 1) * rz * 0.36 + rz * 0.18;
        seeds.push({
          pos: [px, py, pz],
          weight: 0.65,
          kind: 'pulse_chunk',
          dir: [px / rx * 1.1, py / ry * 1.1 + 0.2, pz / rz * 0.9 + 0.3],
          spin: [(rng() - 0.5) * 3.0, (rng() - 0.5) * 3.0, (rng() - 0.5) * 3.0],
          delay: i * 0.24
        });
      }
    } else if (mode === 'missile_shatter') {
      // 4 Major Slabs + 9 Medium Tumbling Boulders (delayed internal fissure expansion -> heavy split!)
      const slabCoords = [
        [-rx * 0.38,  ry * 0.30,  rz * 0.25],
        [ rx * 0.38,  ry * 0.26, -rz * 0.25],
        [-rx * 0.32, -ry * 0.34, -rz * 0.28],
        [ rx * 0.34, -ry * 0.30,  rz * 0.30]
      ];
      for (let i = 0; i < 4; i++) {
        const [sx, sy, sz] = slabCoords[i];
        seeds.push({
          pos: [sx, sy, sz],
          weight: 1.0,
          kind: 'slab',
          dir: [sx / rx, sy / ry, sz / rz],
          spin: [(rng() - 0.5) * 1.1, (rng() - 0.5) * 1.1, (rng() - 0.5) * 1.1],
          delay: 0.42 + i * 0.06
        });
      }
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2.0;
        const px = Math.cos(ang) * rx * 0.45;
        const py = ((i % 3) - 1) * ry * 0.42;
        const pz = Math.sin(ang) * rz * 0.45;
        seeds.push({
          pos: [px, py, pz],
          weight: 0.68,
          kind: 'missile_chunk',
          dir: [px / rx * 1.3 + (rng() - 0.5) * 0.4, py / ry * 1.2 + (rng() - 0.5) * 0.4, pz / rz * 1.3],
          spin: [(rng() - 0.5) * 2.8, (rng() - 0.5) * 2.8, (rng() - 0.5) * 2.8],
          delay: 0.38 + (i % 4) * 0.08
        });
      }
    } else {
      // 'ciws_shred': 1 Scarred Core + 10 Crisp Outer Chunks chewed off by rapid fire
      seeds.push(
        { pos: [0, -ry * 0.1, -rz * 0.15], weight: 1.05, kind: 'core', dir: [0.1, -0.25, -0.35], spin: [0.35, -0.45, 0.28], delay: 0.2 }
      );
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2.0;
        const px = Math.cos(ang) * rx * 0.58;
        const py = Math.sin(ang) * ry * 0.58;
        const pz = ((i % 2) ? 0.35 : -0.15) * rz;
        seeds.push({
          pos: [px, py, pz],
          weight: 0.66,
          kind: 'ciws_chunk',
          dir: [px / rx * 1.4, py / ry * 1.4, pz / rz + 0.45],
          spin: [(rng() - 0.5) * 4.2, (rng() - 0.5) * 4.2, (rng() - 0.5) * 4.2],
          delay: i * 0.22
        });
      }
    }

    const partCount = seeds.length;
    const partGrids = new Array(partCount);
    const sumPos = new Array(partCount);
    const voxCounts = new Int32Array(partCount);
    for (let i = 0; i < partCount; i++) {
      partGrids[i] = new ChunkVoxelGrid();
      sumPos[i] = [0, 0, 0];
    }

    // First pass: assign each solid voxel (x,y,z) in baseGrid to its jagged Voronoi region!
    const regionGrid = new ChunkVoxelGrid(); // stores regionIndex + 1

    for (const ch of baseGrid.chunks.values()) {
      const wx = ch.cx << 5, wy = ch.cy << 5, wz = ch.cz << 5;
      const vox = ch.voxels;
      for (let lz = 0; lz < 32; lz++) {
        for (let ly = 0; ly < 32; ly++) {
          const yz = (lz << 5) | ly;
          if (ch.opaqueMask[yz] === 0) continue;
          const vBase = yz << 5;
          for (let lx = 0; lx < 32; lx++) {
            const mat = vox[vBase + lx];
            if (mat === 0) continue;
            const x = wx + lx, y = wy + ly, z = wz + lz;
            // Jagged 3D stepped fault warp
            const warp = (noise3D(x * 0.09 + ox, y * 0.09 + oy, z * 0.09 + oz) - 0.5) * (rx * 0.34);

            let bestIdx = 0;
            let bestScore = 1e18;
            for (let s = 0; s < partCount; s++) {
              const sp = seeds[s].pos;
              const dx = x - sp[0], dy = y - sp[1], dz = z - sp[2];
              // Quantize slightly for stepped voxel fault planes
              const dist = (Math.sqrt(dx * dx + dy * dy + dz * dz) + warp * ((s & 1) ? 1 : -1)) * seeds[s].weight;
              if (dist < bestScore) {
                bestScore = dist;
                bestIdx = s;
              }
            }
            regionGrid.set(x, y, z, bestIdx + 1);
          }
        }
      }
    }

    // Second pass: populate each piece grid centered around its own centroid (integer-snapped so voxel grid stays exact!)
    // First compute centroids
    for (const ch of baseGrid.chunks.values()) {
      const wx = ch.cx << 5, wy = ch.cy << 5, wz = ch.cz << 5;
      const vox = ch.voxels;
      for (let lz = 0; lz < 32; lz++) {
        for (let ly = 0; ly < 32; ly++) {
          const yz = (lz << 5) | ly;
          if (ch.opaqueMask[yz] === 0) continue;
          const vBase = yz << 5;
          for (let lx = 0; lx < 32; lx++) {
            if (vox[vBase + lx] === 0) continue;
            const x = wx + lx, y = wy + ly, z = wz + lz;
            const rIdx = regionGrid.get(x, y, z) - 1;
            if (rIdx >= 0) {
              sumPos[rIdx][0] += x;
              sumPos[rIdx][1] += y;
              sumPos[rIdx][2] += z;
              voxCounts[rIdx]++;
            }
          }
        }
      }
    }

    const pivots = new Array(partCount);
    for (let i = 0; i < partCount; i++) {
      const cnt = Math.max(1, voxCounts[i]);
      // Integer pivot guarantees exact 1x1x1 grid alignment before separation!
      pivots[i] = [
        Math.round(sumPos[i][0] / cnt),
        Math.round(sumPos[i][1] / cnt),
        Math.round(sumPos[i][2] / cnt)
      ];
    }

    // Populate each piece's local voxel grid & detect internal fracture boundary faces!
    for (const ch of baseGrid.chunks.values()) {
      const wx = ch.cx << 5, wy = ch.cy << 5, wz = ch.cz << 5;
      const vox = ch.voxels;
      for (let lz = 0; lz < 32; lz++) {
        for (let ly = 0; ly < 32; ly++) {
          const yz = (lz << 5) | ly;
          if (ch.opaqueMask[yz] === 0) continue;
          const vBase = yz << 5;
          for (let lx = 0; lx < 32; lx++) {
            let mat = vox[vBase + lx];
            if (mat === 0) continue;
            const x = wx + lx, y = wy + ly, z = wz + lz;
            const rVal = regionGrid.get(x, y, z);
            const rIdx = rVal - 1;
            if (rIdx < 0) continue;

            // Check 6 neighbors: if any solid neighbor belongs to a DIFFERENT region, this voxel sits on an internal cleavage plane!
            const n1 = regionGrid.get(x + 1, y, z);
            const n2 = regionGrid.get(x - 1, y, z);
            const n3 = regionGrid.get(x, y + 1, z);
            const n4 = regionGrid.get(x, y - 1, z);
            const n5 = regionGrid.get(x, y, z + 1);
            const n6 = regionGrid.get(x, y, z - 1);

            const onFracture =
              (n1 !== 0 && n1 !== rVal) ||
              (n2 !== 0 && n2 !== rVal) ||
              (n3 !== 0 && n3 !== rVal) ||
              (n4 !== 0 && n4 !== rVal) ||
              (n5 !== 0 && n5 !== rVal) ||
              (n6 !== 0 && n6 !== rVal);

            if (onFracture) {
              const vNoise = noise3D(x * 0.23, y * 0.23, z * 0.23);
              mat = vNoise > 0.56 ? M.ROCK_FRACTURE_VEIN : M.ROCK_FRACTURE_COOL;
            }

            const pv = pivots[rIdx];
            partGrids[rIdx].set(x - pv[0], y - pv[1], z - pv[2], mat);
          }
        }
      }
    }

    const pieces = [];
    for (let i = 0; i < partCount; i++) {
      if (voxCounts[i] === 0) continue;
      const d = seeds[i].dir;
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      pieces.push({
        mesh: meshVoxelGrid(partGrids[i]),
        pivot: pivots[i],
        kind: seeds[i].kind,
        dir: [d[0] / dl, d[1] / dl, d[2] / dl],
        spin: seeds[i].spin,
        delay: seeds[i].delay,
        voxelCount: voxCounts[i]
      });
    }

    return {
      mode,
      radius: Math.max(rx, ry, rz),
      pieces
    };
  }

  // Build reusable Small Voxel Shard / Fragment Archetypes (1x1x1 up to 6x5x4 voxels, voxelSize = 1.0!)
  function buildSmallShardArchetypes() {
    const specs = [
      // Archetype 0: Single 1x1x1 unit voxel block!
      (g) => { g.set(0, 0, 0, M.ROCK_FRACTURE_COOL); },
      // Archetype 1: 2x2x1 stepped L-chip
      (g) => {
        g.fillBox(0, 0, 0, 1, 0, 0, M.ROCK_MID);
        g.set(0, 1, 0, M.ROCK_FRACTURE_VEIN);
      },
      // Archetype 2: 3x2x2 jagged shard
      (g) => {
        g.fillBox(-1, -1, -1, 1, 0, 0, M.ROCK_DARK);
        g.fillBox(0, 0, -1, 1, 1, 0, M.ROCK_FRACTURE_COOL);
        g.set(-1, 0, 1, M.ROCK_LIGHT);
      },
      // Archetype 3: 5x4x3 stepped fragment
      (g) => {
        g.fillBox(-2, -1, -1, 2, 1, 1, M.ROCK_MID);
        g.fillBox(-1, 1, -1, 1, 2, 0, M.ROCK_LIGHT);
        g.fillBox(-2, -1, 1, 0, 0, 1, M.ROCK_FRACTURE_VEIN);
      },
      // Archetype 4: 7x5x5 craggy mini-boulder
      (g) => {
        g.fillBox(-3, -2, -2, 3, 1, 2, M.ROCK_DARK);
        g.fillBox(-2, 1, -1, 2, 2, 1, M.ROCK_OCHRE);
        g.fillBox(1, -2, -2, 3, 0, 1, M.ROCK_FRACTURE_COOL);
      }
    ];
    return specs.map((fn) => {
      const g = new ChunkVoxelGrid();
      fn(g);
      return meshVoxelGrid(g, { ao: false });
    });
  }

  // Build 6 distinct Intact Voxel Asteroid Archetypes of varied real voxel sizes (22 to 118 voxels!)
  function buildIntactAsteroidArchetypes() {
    const defs = [
      { rx: 58, ry: 44, rz: 52, seed: 101, hole: true },
      { rx: 44, ry: 38, rz: 42, seed: 202, hole: true },
      { rx: 34, ry: 26, rz: 30, seed: 303, hole: false },
      { rx: 24, ry: 20, rz: 22, seed: 404, hole: false },
      { rx: 15, ry: 12, rz: 14, seed: 505, hole: false },
      { rx: 10, ry:  8, rz:  9, seed: 606, hole: false }
    ];
    return defs.map((d) => {
      const g = sculptAsteroidVoxels(d.rx, d.ry, d.rz, d.seed, d.hole);
      return {
        mesh: meshVoxelGrid(g),
        radius: Math.max(d.rx, d.ry, d.rz)
      };
    });
  }

  SF.Asteroids = {
    buildDestructibleAsteroid,
    buildSmallShardArchetypes,
    buildIntactAsteroidArchetypes
  };
})(window);
