(function () {
  const App = (window.App = window.App || {});
  const M = App.Math;

  // Kuhn 6-tetrahedra decomposition of a unit cube [v000, v100, v010, v110, v001, v101, v011, v111]
  // All 6 tets share main diagonal v000 -> v111; alternating reflection by parity removes directional bias!
  const KUHN_TETS = [
    [0, 1, 3, 7],
    [0, 1, 7, 5],
    [0, 4, 5, 7],
    [0, 4, 7, 6],
    [0, 2, 6, 7],
    [0, 2, 7, 3]
  ];

  // Local 4 faces of a positive-volume tet (i0, i1, i2, i3) where (x1-x0)x(x2-x0).(x3-x0) > 0
  // Outward-pointing winding (CCW from outside) + opposite vertex index:
  // Face 0 (opp 0): (1, 2, 3) -> Check: (x2-x1)x(x3-x1) . (x1-x0) > 0 -> (1, 2, 3) is outward!
  // Face 1 (opp 1): (0, 3, 2) -> Check: (x3-x0)x(x2-x0) = -(x2-x0)x(x3-x0), dotted with -(x1-x0) -> wait:
  // Let e1=(1,0,0), e2=(0,1,0), e3=(0,0,1), det = +1:
  // opp 0 (1,2,3): (e2-e1)x(e3-e1) = (-1,1,0)x(-1,0,1) = (1,1,1) outward (+)!
  // opp 1 (0,3,2): e3 x e2 = (-1, 0, 0) outward (-x)!
  // opp 2 (0,1,3): e1 x e3 = (0, -1, 0) outward (-y)!
  // opp 3 (0,2,1): e2 x e1 = (0, 0, -1) outward (-z)!
  const TET_FACES = [
    [1, 2, 3, 0],
    [0, 3, 2, 1],
    [0, 1, 3, 2],
    [0, 2, 1, 3]
  ];

  const TET_EDGES = [
    [0, 1], [0, 2], [0, 3],
    [1, 2], [1, 3], [2, 3]
  ];

  function mapShapePoint(shape, u, v, w, params) {
    // u, w in [-1, 1], v in [0, 1]
    // Elliptical disc mapping: maps [-1, 1]^2 smoothly to unit disc
    const discX = u * Math.sqrt(Math.max(0, 1.0 - 0.5 * w * w));
    const discZ = w * Math.sqrt(Math.max(0, 1.0 - 0.5 * u * u));
    const r = Math.hypot(discX, discZ);
    const theta = Math.atan2(discZ, discX);

    if (shape === 'pudding') {
      // Fluted caramel-peach pudding dome
      const R0 = params.radius || 0.34;
      const H0 = params.height || 0.40;
      const taper = 1.0 - 0.19 * Math.pow(v, 1.15);
      const fluteAmp = 0.036 * (1.0 - 0.65 * v * v) * M.smoothstep(0.25, 0.95, r);
      const flute = 1.0 + fluteAmp * Math.cos(10.0 * theta);
      const bevelTop = 1.0 - 0.06 * Math.pow(v, 5.0) * r * r;
      const radScale = R0 * taper * flute * bevelTop;
      const crown = H0 * (v + 0.065 * Math.sin(v * Math.PI) * (1.0 - r * r));
      return [
        params.cx + discX * radScale,
        params.cy + crown,
        params.cz + discZ * radScale
      ];
    } else if (shape === 'cube') {
      // Rounded elastic beveled prism / block
      const R0 = params.radius || 0.23;
      const H0 = params.height || 0.34;
      const bx = M.lerp(u, discX, 0.32);
      const bz = M.lerp(w, discZ, 0.32);
      const edgeBulge = 1.0 + 0.04 * Math.sin(v * Math.PI);
      const topRound = 1.0 - 0.05 * Math.pow(v, 4.0) * (u * u + w * w) * 0.5;
      return [
        params.cx + bx * R0 * edgeBulge * topRound,
        params.cy + H0 * v * (1.0 - 0.03 * v * v * (u * u + w * w) * 0.5),
        params.cz + bz * R0 * edgeBulge * topRound
      ];
    } else {
      // Soft pillowy berry jelly cushion
      const R0 = params.radius || 0.29;
      const H0 = params.height || 0.24;
      const belly = 1.0 + 0.10 * Math.sin(v * Math.PI) - 0.14 * Math.pow(v, 2.2);
      const domeY = H0 * v * (1.0 + 0.14 * (1.0 - r * r) * v);
      return [
        params.cx + discX * R0 * belly,
        params.cy + domeY,
        params.cz + discZ * R0 * belly
      ];
    }
  }

  class JellyBody {
    constructor(opts) {
      this.id = opts.id || 0;
      this.name = opts.name || 'Jelly';
      this.shape = opts.shape || 'pudding';
      this.color = opts.color || [1.0, 0.42, 0.32];
      this.absorb = opts.absorb || [1.1, 3.4, 5.2];
      this.stiffnessScale = opts.stiffnessScale ?? 1.0;
      this.toughnessScale = opts.toughnessScale ?? 1.0;
      this.density = opts.density || 1080.0; // kg/m^3

      const nx = opts.nx || 9;
      const ny = opts.ny || 8;
      const nz = opts.nz || 9;

      // Extra capacity for vertex cloning during fracture (up to 3.5x initial vertices)
      const initVerts = nx * ny * nz;
      this.maxVerts = initVerts * 4;
      this.numVerts = initVerts;

      this.pos = new Float32Array(this.maxVerts * 3);
      this.prevRenderPos = new Float32Array(this.maxVerts * 3);
      this.prevPos = new Float32Array(this.maxVerts * 3);
      this.vel = new Float32Array(this.maxVerts * 3);
      this.invMass = new Float32Array(this.maxVerts);
      this.compId = new Int32Array(this.maxVerts); // connected fragment id per vertex
      this.normals = new Float32Array(this.maxVerts * 3);

      const vidOf = (ix, iy, iz) => (iy * nz + iz) * nx + ix;
      for (let iy = 0; iy < ny; iy++) {
        const v = iy / (ny - 1);
        for (let iz = 0; iz < nz; iz++) {
          const w = (iz / (nz - 1)) * 2.0 - 1.0;
          for (let ix = 0; ix < nx; ix++) {
            const u = (ix / (nx - 1)) * 2.0 - 1.0;
            const p = mapShapePoint(this.shape, u, v, w, opts);
            const id3 = vidOf(ix, iy, iz) * 3;
            this.pos[id3] = p[0];
            this.pos[id3 + 1] = p[1];
            this.pos[id3 + 2] = p[2];
            this.prevPos[id3] = p[0];
            this.prevPos[id3 + 1] = p[1];
            this.prevPos[id3 + 2] = p[2];
            this.prevRenderPos[id3] = p[0];
            this.prevRenderPos[id3 + 1] = p[1];
            this.prevRenderPos[id3 + 2] = p[2];
          }
        }
      }

      // Build tetrahedra
      const numCells = (nx - 1) * (ny - 1) * (nz - 1);
      this.numTets = numCells * 6;
      this.tetIds = new Int32Array(this.numTets * 4);
      this.tetRestVol = new Float32Array(this.numTets);
      this.tetEdgeRestLen = new Float32Array(this.numTets * 6);
      this.tetComp = new Int32Array(this.numTets);

      let tPtr = 0;
      for (let iy = 0; iy < ny - 1; iy++) {
        for (let iz = 0; iz < nz - 1; iz++) {
          for (let ix = 0; ix < nx - 1; ix++) {
            // Mirror cell corners per axis parity so shared X, Y, Z faces have 100% matching diagonals!
            const x0 = (ix & 1) ? ix + 1 : ix;
            const x1 = (ix & 1) ? ix : ix + 1;
            const y0 = (iy & 1) ? iy + 1 : iy;
            const y1 = (iy & 1) ? iy : iy + 1;
            const z0 = (iz & 1) ? iz + 1 : iz;
            const z1 = (iz & 1) ? iz : iz + 1;
            const c = [
              vidOf(x0, y0, z0),
              vidOf(x1, y0, z0),
              vidOf(x0, y1, z0),
              vidOf(x1, y1, z0),
              vidOf(x0, y0, z1),
              vidOf(x1, y0, z1),
              vidOf(x0, y1, z1),
              vidOf(x1, y1, z1)
            ];

            for (let k = 0; k < 6; k++) {
              const kt = KUHN_TETS[k];
              let i0 = c[kt[0]], i1 = c[kt[1]], i2 = c[kt[2]], i3 = c[kt[3]];
              let vol = this._computeSignedVol(i0, i1, i2, i3);
              if (vol < 0) {
                const tmp = i2; i2 = i3; i3 = tmp;
                vol = -vol;
              }
              const base4 = tPtr * 4;
              this.tetIds[base4] = i0;
              this.tetIds[base4 + 1] = i1;
              this.tetIds[base4 + 2] = i2;
              this.tetIds[base4 + 3] = i3;
              this.tetRestVol[tPtr] = Math.max(1e-8, vol);

              const tv = [i0, i1, i2, i3];
              for (let e = 0; e < 6; e++) {
                const va = tv[TET_EDGES[e][0]] * 3;
                const vb = tv[TET_EDGES[e][1]] * 3;
                this.tetEdgeRestLen[tPtr * 6 + e] = Math.hypot(
                  this.pos[va] - this.pos[vb],
                  this.pos[va + 1] - this.pos[vb + 1],
                  this.pos[va + 2] - this.pos[vb + 2]
                );
              }
              tPtr++;
            }
          }
        }
      }

      // Build face adjacency table: distinguish outer skin faces from interior cleavable faces!
      this._buildFaceTopology();
      this._recomputeMassesAndEdges();
      this._rebuildSurfaceBuffers();
      this.numFragments = 1;
      this.cleavedTotal = 0;
    }

    _computeSignedVol(i0, i1, i2, i3) {
      const p = this.pos;
      const a0 = i0 * 3, a1 = i1 * 3, a2 = i2 * 3, a3 = i3 * 3;
      const x1 = p[a1] - p[a0], y1 = p[a1 + 1] - p[a0 + 1], z1 = p[a1 + 2] - p[a0 + 2];
      const x2 = p[a2] - p[a0], y2 = p[a2 + 1] - p[a0 + 1], z2 = p[a2 + 2] - p[a0 + 2];
      const x3 = p[a3] - p[a0], y3 = p[a3 + 1] - p[a0 + 1], z3 = p[a3 + 2] - p[a0 + 2];
      const cx = y1 * z2 - z1 * y2;
      const cy = z1 * x2 - x1 * z2;
      const cz = x1 * y2 - y1 * x2;
      return (cx * x3 + cy * y3 + cz * z3) / 6.0;
    }

    _buildFaceTopology() {
      // Map sorted vertex triple -> first seen { tet, localFace }
      const map = new Map();
      this.outerFaces = []; // [{ tet, lf }]
      this.innerFaces = []; // [{ tA, lfA, tB, lfB, restApexDist, restHorizFactor, damage, cleaved }]

      for (let t = 0; t < this.numTets; t++) {
        const b4 = t * 4;
        for (let lf = 0; lf < 4; lf++) {
          const tf = TET_FACES[lf];
          const v0 = this.tetIds[b4 + tf[0]];
          const v1 = this.tetIds[b4 + tf[1]];
          const v2 = this.tetIds[b4 + tf[2]];
          // Sort 3 ints
          let s0 = v0, s1 = v1, s2 = v2;
          if (s0 > s1) { const q = s0; s0 = s1; s1 = q; }
          if (s1 > s2) { const q = s1; s1 = s2; s2 = q; }
          if (s0 > s1) { const q = s0; s0 = s1; s1 = q; }
          const key = `${s0}_${s1}_${s2}`;
          const prev = map.get(key);
          if (!prev) {
            map.set(key, { tet: t, lf });
          } else {
            map.delete(key);
            // Interior shared face between prev.tet and t!
            const oppA = this.tetIds[prev.tet * 4 + TET_FACES[prev.lf][3]] * 3;
            const oppB = this.tetIds[t * 4 + tf[3]] * 3;
            const dx = this.pos[oppB] - this.pos[oppA];
            const dy = this.pos[oppB + 1] - this.pos[oppA + 1];
            const dz = this.pos[oppB + 2] - this.pos[oppA + 2];
            const restDist = Math.max(1e-5, Math.hypot(dx, dy, dz));

            // Rest face normal to know vertical vs horizontal orientation
            const p0 = v0 * 3, p1 = v1 * 3, p2 = v2 * 3;
            const e1x = this.pos[p1] - this.pos[p0], e1y = this.pos[p1 + 1] - this.pos[p0 + 1], e1z = this.pos[p1 + 2] - this.pos[p0 + 2];
            const e2x = this.pos[p2] - this.pos[p0], e2y = this.pos[p2 + 1] - this.pos[p0 + 1], e2z = this.pos[p2 + 2] - this.pos[p0 + 2];
            const nx = e1y * e2z - e1z * e2y;
            const ny = e1z * e2x - e1x * e2z;
            const nz = e1x * e2y - e1y * e2x;
            const nLen = Math.hypot(nx, ny, nz) || 1.0;
            const horizFactor = 1.0 - 0.35 * Math.abs(ny / nLen);

            this.innerFaces.push({
              tA: prev.tet,
              lfA: prev.lf,
              tB: t,
              lfB: lf,
              restApexDist: restDist,
              horizFactor,
              damage: 0.0,
              cleaved: false
            });
          }
        }
      }

      for (const entry of map.values()) {
        this.outerFaces.push(entry);
      }

      // Per-tet neighbor table across its 4 local faces (-1 if boundary or cleaved!)
      this.tetNeighbor = new Int32Array(this.numTets * 4);
      this.tetNeighbor.fill(-1);
      for (let i = 0; i < this.innerFaces.length; i++) {
        const f = this.innerFaces[i];
        this.tetNeighbor[f.tA * 4 + f.lfA] = f.tB;
        this.tetNeighbor[f.tB * 4 + f.lfB] = f.tA;
      }
    }

    _recomputeMassesAndEdges() {
      this.invMass.fill(0, 0, this.numVerts);
      for (let t = 0; t < this.numTets; t++) {
        const m4 = 0.25 * this.density * this.tetRestVol[t];
        const b4 = t * 4;
        this.invMass[this.tetIds[b4]] += m4;
        this.invMass[this.tetIds[b4 + 1]] += m4;
        this.invMass[this.tetIds[b4 + 2]] += m4;
        this.invMass[this.tetIds[b4 + 3]] += m4;
      }
      for (let v = 0; v < this.numVerts; v++) {
        this.invMass[v] = this.invMass[v] > 1e-9 ? 1.0 / this.invMass[v] : 0.0;
      }

      // Deduplicate active edges across intact tetrahedra
      const edgeMap = new Map();
      const eIds = [];
      const eLens = [];
      for (let t = 0; t < this.numTets; t++) {
        const b4 = t * 4;
        for (let e = 0; e < 6; e++) {
          let u = this.tetIds[b4 + TET_EDGES[e][0]];
          let v = this.tetIds[b4 + TET_EDGES[e][1]];
          if (u > v) { const tmp = u; u = v; v = tmp; }
          const key = u * 65536 + v;
          if (!edgeMap.has(key)) {
            edgeMap.set(key, 1);
            eIds.push(u, v);
            eLens.push(this.tetEdgeRestLen[t * 6 + e]);
          }
        }
      }
      this.numEdges = eLens.length;
      this.edgeIds = new Int32Array(eIds);
      this.edgeRestLen = new Float32Array(eLens);
    }

    _recomputeConnectedFragments() {
      this.tetComp.fill(-1);
      let comp = 0;
      const queue = new Int32Array(this.numTets);
      for (let start = 0; start < this.numTets; start++) {
        if (this.tetComp[start] !== -1) continue;
        this.tetComp[start] = comp;
        let head = 0, tail = 0;
        queue[tail++] = start;
        while (head < tail) {
          const cur = queue[head++];
          const nbBase = cur * 4;
          for (let lf = 0; lf < 4; lf++) {
            const nb = this.tetNeighbor[nbBase + lf];
            if (nb >= 0 && this.tetComp[nb] === -1) {
              this.tetComp[nb] = comp;
              queue[tail++] = nb;
            }
          }
        }
        comp++;
      }
      this.numFragments = comp;
      for (let t = 0; t < this.numTets; t++) {
        const c = this.tetComp[t];
        const b4 = t * 4;
        this.compId[this.tetIds[b4]] = c;
        this.compId[this.tetIds[b4 + 1]] = c;
        this.compId[this.tetIds[b4 + 2]] = c;
        this.compId[this.tetIds[b4 + 3]] = c;
      }
    }

    _rebuildSurfaceBuffers() {
      // Outer smooth skin triangles + cleaved sharp internal fracture triangles!
      const tris = [];
      const isCleavedTri = [];

      for (let i = 0; i < this.outerFaces.length; i++) {
        const f = this.outerFaces[i];
        const tf = TET_FACES[f.lf];
        const b4 = f.tet * 4;
        tris.push(this.tetIds[b4 + tf[0]], this.tetIds[b4 + tf[1]], this.tetIds[b4 + tf[2]]);
        isCleavedTri.push(0);
      }

      for (let i = 0; i < this.innerFaces.length; i++) {
        const f = this.innerFaces[i];
        if (!f.cleaved) continue;
        const tfA = TET_FACES[f.lfA];
        const bA = f.tA * 4;
        tris.push(this.tetIds[bA + tfA[0]], this.tetIds[bA + tfA[1]], this.tetIds[bA + tfA[2]]);
        isCleavedTri.push(1);

        const tfB = TET_FACES[f.lfB];
        const bB = f.tB * 4;
        tris.push(this.tetIds[bB + tfB[0]], this.tetIds[bB + tfB[1]], this.tetIds[bB + tfB[2]]);
        isCleavedTri.push(1);
      }

      this.surfaceTris = new Uint32Array(tris);
      this.surfaceTriIsFracture = new Uint8Array(isCleavedTri);
      this.numSurfaceTris = isCleavedTri.length;

      // Unique boundary vertices for fast collision checks
      const vSet = new Uint8Array(this.numVerts);
      for (let i = 0; i < tris.length; i++) vSet[tris[i]] = 1;
      const bVerts = [];
      for (let v = 0; v < this.numVerts; v++) {
        if (vSet[v]) bVerts.push(v);
      }
      this.boundaryVerts = new Int32Array(bVerts);
      this._recomputeConnectedFragments();
    }

    evaluateFracture(stiffnessNorm, toughnessNorm, balls, dt) {
      // Toughness maps continuously:
      // toughnessNorm = 0.0 -> fragile (~0.24 crit stretch), 0.55 -> standard (~0.56), 1.0 -> unbreakable (~1.65)
      const baseCrit = (0.20 + 0.56 * toughnessNorm + 0.88 * Math.pow(toughnessNorm, 2.8)) * this.toughnessScale;
      const stiffBoost = 0.72 + 0.42 * Math.pow(stiffnessNorm, 0.45);
      const pos = this.pos;

      const newlyCleavedVerts = new Set();
      let newlyCleavedCount = 0;
      const maxCleavesPerStep = 128; // progressive propagation from impact zone

      for (let i = 0; i < this.innerFaces.length; i++) {
        const f = this.innerFaces[i];
        if (f.cleaved) continue;

        const bA = f.tA * 4;
        const bB = f.tB * 4;
        const tfA = TET_FACES[f.lfA];
        const v0 = this.tetIds[bA + tfA[0]] * 3;
        const v1 = this.tetIds[bA + tfA[1]] * 3;
        const v2 = this.tetIds[bA + tfA[2]] * 3;
        const oppA = this.tetIds[bA + tfA[3]] * 3;
        const oppB = this.tetIds[bB + TET_FACES[f.lfB][3]] * 3;

        // Current face outward normal from tA toward tB
        const e1x = pos[v1] - pos[v0], e1y = pos[v1 + 1] - pos[v0 + 1], e1z = pos[v1 + 2] - pos[v0 + 2];
        const e2x = pos[v2] - pos[v0], e2y = pos[v2 + 1] - pos[v0 + 1], e2z = pos[v2 + 2] - pos[v0 + 2];
        let nx = e1y * e2z - e1z * e2y;
        let ny = e1z * e2x - e1x * e2z;
        let nz = e1x * e2y - e1y * e2x;
        const nLen = Math.hypot(nx, ny, nz);
        if (nLen < 1e-8) continue;
        nx /= nLen; ny /= nLen; nz /= nLen;

        // Normal opening distance between opposite apices across face f
        const ax = pos[oppB] - pos[oppA];
        const ay = pos[oppB + 1] - pos[oppA + 1];
        const az = pos[oppB + 2] - pos[oppA + 2];
        const normalSpan = ax * nx + ay * ny + az * nz;
        const fullDist = Math.hypot(ax, ay, az);
        // Only cleave in genuine tension (normalSpan > 0 and stretched beyond restApexDist!)
        if (normalSpan <= 0.0) continue;

        const tensileStrain = (fullDist - f.restApexDist) / f.restApexDist;
        if (tensileStrain <= 0.08) {
          f.damage = Math.max(0, f.damage - dt * 0.35);
          continue;
        }

        // Proximity to any active impacting ball concentrates wedge fracture right at contact zone!
        const cx = (pos[v0] + pos[v1] + pos[v2]) / 3.0;
        const cy = (pos[v0 + 1] + pos[v1 + 1] + pos[v2 + 1]) / 3.0;
        const cz = (pos[v0 + 2] + pos[v1 + 2] + pos[v2 + 2]) / 3.0;
        let impactBoost = 1.0;
        for (let b = 0; b < balls.length; b++) {
          const ball = balls[b];
          const d = Math.hypot(cx - ball.x, cy - ball.y, cz - ball.z) - ball.r;
          if (d < 0.16) {
            const prox = 1.0 - Math.max(0, d) / 0.16;
            const massFactor = Math.min(1.65, Math.pow(ball.mass / 2.2, 0.35));
            impactBoost = Math.max(impactBoost, 1.0 + 0.42 * prox * massFactor);
          }
        }

        // Crack-tip stress concentration if an adjacent face of tA or tB already cleaved!
        let tipBoost = 1.0;
        for (let lf = 0; lf < 4; lf++) {
          if (
            (lf !== f.lfA && this.tetNeighbor[bA + lf] === -2) ||
            (lf !== f.lfB && this.tetNeighbor[bB + lf] === -2)
          ) {
            tipBoost = 1.26;
            break;
          }
        }

        const effLoad = tensileStrain * stiffBoost * f.horizFactor * impactBoost * tipBoost;
        if (effLoad > baseCrit * 0.76) {
          f.damage += ((effLoad / baseCrit) - 0.72) * dt * 26.0;
        }

        if (effLoad >= baseCrit || f.damage >= 1.0) {
          f.cleaved = true;
          this.tetNeighbor[bA + f.lfA] = -2; // -2 marks cleaved face!
          this.tetNeighbor[bB + f.lfB] = -2;
          newlyCleavedVerts.add(this.tetIds[bA + tfA[0]]);
          newlyCleavedVerts.add(this.tetIds[bA + tfA[1]]);
          newlyCleavedVerts.add(this.tetIds[bA + tfA[2]]);
          newlyCleavedCount++;
          this.cleavedTotal++;
          if (newlyCleavedCount >= maxCleavesPerStep) break;
        }
      }

      if (newlyCleavedCount > 0) {
        this._splitDisconnectedVertices(newlyCleavedVerts);
        this._recomputeMassesAndEdges();
        this._rebuildSurfaceBuffers();
      }

      return newlyCleavedCount;
    }

    _splitDisconnectedVertices(candidateVerts) {
      // Build incident tet lists for candidate vertices
      const incident = new Map();
      for (const v of candidateVerts) incident.set(v, []);

      for (let t = 0; t < this.numTets; t++) {
        const b4 = t * 4;
        for (let k = 0; k < 4; k++) {
          const v = this.tetIds[b4 + k];
          const arr = incident.get(v);
          if (arr) arr.push(t);
        }
      }

      for (const [v, tets] of incident.entries()) {
        if (tets.length <= 1) continue;
        // Partition `tets` into connected components via intact tetNeighbor links!
        const visited = new Int8Array(tets.length);
        const groups = [];
        for (let i = 0; i < tets.length; i++) {
          if (visited[i]) continue;
          const grp = [tets[i]];
          visited[i] = 1;
          let head = 0;
          while (head < grp.length) {
            const curT = grp[head++];
            for (let lf = 0; lf < 4; lf++) {
              const nb = this.tetNeighbor[curT * 4 + lf];
              if (nb < 0) continue;
              const idxInList = tets.indexOf(nb);
              if (idxInList >= 0 && !visited[idxInList]) {
                visited[idxInList] = 1;
                grp.push(nb);
              }
            }
          }
          groups.push(grp);
        }

        if (groups.length > 1) {
          // Compute tet-group centroids so newly split crack lips gently release elastic tension outward
          const grpCentroids = groups.map((grp) => {
            let gx = 0, gy = 0, gz = 0;
            for (let m = 0; m < grp.length; m++) {
              const tb = grp[m] * 4;
              for (let c = 0; c < 4; c++) {
                const cv3 = this.tetIds[tb + c] * 3;
                gx += this.pos[cv3];
                gy += this.pos[cv3 + 1];
                gz += this.pos[cv3 + 2];
              }
            }
            const inv = 1.0 / (grp.length * 4);
            return [gx * inv, gy * inv, gz * inv];
          });

          const c0 = grpCentroids[0];
          // Group 0 keeps vertex `v`; Groups 1..k-1 get freshly cloned vertices!
          for (let g = 1; g < groups.length; g++) {
            if (this.numVerts >= this.maxVerts) break;
            const nv = this.numVerts++;
            const v3 = v * 3, nv3 = nv * 3;
            const cg = grpCentroids[g];
            let sx = cg[0] - c0[0], sy = cg[1] - c0[1], sz = cg[2] - c0[2];
            const sLen = Math.hypot(sx, sy, sz) || 1.0;
            sx /= sLen; sy /= sLen; sz /= sLen;

            // Subtle elastic crack-lip release (prevents zero-gap visual overlap)
            const lipSep = 0.0012;
            const lipVel = 0.14;

            this.pos[nv3] = this.pos[v3] + sx * lipSep;
            this.pos[nv3 + 1] = this.pos[v3 + 1] + sy * lipSep;
            this.pos[nv3 + 2] = this.pos[v3 + 2] + sz * lipSep;
            this.prevPos[nv3] = this.prevPos[v3];
            this.prevPos[nv3 + 1] = this.prevPos[v3 + 1];
            this.prevPos[nv3 + 2] = this.prevPos[v3 + 2];
            this.prevRenderPos[nv3] = this.prevRenderPos[v3];
            this.prevRenderPos[nv3 + 1] = this.prevRenderPos[v3 + 1];
            this.prevRenderPos[nv3 + 2] = this.prevRenderPos[v3 + 2];
            this.vel[nv3] = this.vel[v3] + sx * lipVel;
            this.vel[nv3 + 1] = this.vel[v3 + 1] + sy * lipVel;
            this.vel[nv3 + 2] = this.vel[v3 + 2] + sz * lipVel;

            this.pos[v3] -= sx * lipSep * 0.5;
            this.pos[v3 + 1] -= sy * lipSep * 0.5;
            this.pos[v3 + 2] -= sz * lipSep * 0.5;
            this.vel[v3] -= sx * lipVel * 0.5;
            this.vel[v3 + 1] -= sy * lipVel * 0.5;
            this.vel[v3 + 2] -= sz * lipVel * 0.5;

            const grp = groups[g];
            for (let m = 0; m < grp.length; m++) {
              const tb = grp[m] * 4;
              for (let c = 0; c < 4; c++) {
                if (this.tetIds[tb + c] === v) this.tetIds[tb + c] = nv;
              }
            }
          }
        }
      }
    }

    computeBoundsAndCentroid() {
      let cx = 0, cy = 0, cz = 0;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
      const p = this.pos;
      for (let v = 0; v < this.numVerts; v++) {
        const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
        cx += x; cy += y; cz += z;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const inv = 1.0 / Math.max(1, this.numVerts);
      return {
        cx: cx * inv,
        cy: cy * inv,
        cz: cz * inv,
        minX, maxX, minY, maxY, minZ, maxZ,
        radXZ: 0.5 * Math.max(maxX - minX, maxZ - minZ)
      };
    }
  }

  class JellySceneSim {
    constructor(sound) {
      this.sound = sound;
      this.gravity = -9.81;
      this.plinthHalfX = 1.55;
      this.plinthHalfZ = 1.08;
      this.floorY = 0.0;

      // User tunable parameters
      this.params = {
        stiffness: 0.50,  // [0.05 .. 1.0]
        toughness: 0.56,  // [0.05 .. 1.0]
        ballMass: 2.8,    // [0.4 .. 9.0] kg
        dropHeight: 1.15  // [0.35 .. 2.2] m
      };

      this.jellies = [];
      this.balls = [];
      this.scheduledDrops = [];
      this.simTime = 0;
      this._substepParity = 0;

      this.resetStage();
    }

    resetStage(layoutPreset = 'standard') {
      this.simTime = 0;
      this.balls = [];
      this.scheduledDrops = [];
      this._substepParity = 0;

      if (layoutPreset === 'single-hero') {
        // Still keep companion stage jellies slightly further out so stage has rich multi-jelly depth!
        this.jellies = [
          new JellyBody({
            id: 0,
            name: '蜜桃琥珀主冻',
            shape: 'pudding',
            cx: 0.0, cy: 0.001, cz: 0.02,
            radius: 0.35, height: 0.42,
            nx: 11, ny: 10, nz: 11,
            color: [1.0, 0.38, 0.28],
            absorb: [0.85, 2.95, 4.85],
            stiffnessScale: 1.0,
            toughnessScale: 1.0
          }),
          new JellyBody({
            id: 1,
            name: '青柠弹力方墩',
            shape: 'cube',
            cx: -0.82, cy: 0.001, cz: -0.22,
            radius: 0.21, height: 0.33,
            nx: 8, ny: 7, nz: 8,
            color: [0.22, 0.92, 0.55],
            absorb: [3.2, 0.72, 2.35],
            stiffnessScale: 1.95,
            toughnessScale: 1.55
          }),
          new JellyBody({
            id: 2,
            name: '浆果柔嫩软垫',
            shape: 'cushion',
            cx: 0.76, cy: 0.001, cz: -0.14,
            radius: 0.27, height: 0.23,
            nx: 8, ny: 7, nz: 8,
            color: [0.86, 0.28, 0.96],
            absorb: [1.55, 4.10, 1.05],
            stiffnessScale: 0.52,
            toughnessScale: 1.15
          })
        ];
      } else {
        this.jellies = [
          new JellyBody({
            id: 0,
            name: '蜜桃琥珀主冻',
            shape: 'pudding',
            cx: -0.04, cy: 0.001, cz: 0.04,
            radius: 0.35, height: 0.42,
            nx: 11, ny: 10, nz: 11,
            color: [1.0, 0.38, 0.28],
            absorb: [0.85, 2.95, 4.85],
            stiffnessScale: 1.0,
            toughnessScale: 1.0
          }),
          new JellyBody({
            id: 1,
            name: '青柠弹力方墩',
            shape: 'cube',
            cx: -0.78, cy: 0.001, cz: -0.14,
            radius: 0.21, height: 0.34,
            nx: 8, ny: 7, nz: 8,
            color: [0.22, 0.92, 0.55],
            absorb: [3.2, 0.72, 2.35],
            stiffnessScale: 1.95,
            toughnessScale: 1.55
          }),
          new JellyBody({
            id: 2,
            name: '浆果柔嫩软垫',
            shape: 'cushion',
            cx: 0.68, cy: 0.001, cz: 0.06,
            radius: 0.27, height: 0.23,
            nx: 8, ny: 7, nz: 8,
            color: [0.86, 0.28, 0.96],
            absorb: [1.55, 4.10, 1.05],
            stiffnessScale: 0.50,
            toughnessScale: 1.25
          })
        ];

        // Place a resting granite stone sphere between hero pudding and soft berry cushion for collision interactions!
        this.spawnBall({
          x: 0.38,
          y: 0.095,
          z: 0.14,
          vx: 0, vy: 0, vz: 0,
          r: 0.095,
          mass: 1.45,
          material: 'stone'
        });
      }
    }

    spawnBall(cfg) {
      const mass = cfg.mass ?? this.params.ballMass;
      // Radius scales gently with mass if not explicitly given, while reflecting material density
      const mat = cfg.material || (mass >= 4.2 ? 'tungsten' : mass >= 1.9 ? 'steel' : 'stone');
      const r = cfg.r ?? M.clamp(0.082 + 0.015 * Math.cbrt(mass), 0.075, 0.148);

      let color = [0.68, 0.72, 0.78];
      let rough = 0.20;
      let metallic = 0.90;
      if (mat === 'tungsten') {
        color = [0.28, 0.31, 0.36];
        rough = 0.16;
        metallic = 0.94;
      } else if (mat === 'bronze') {
        color = [0.84, 0.58, 0.34];
        rough = 0.22;
        metallic = 0.88;
      } else if (mat === 'aluminum') {
        color = [0.85, 0.88, 0.92];
        rough = 0.25;
        metallic = 0.86;
      } else if (mat === 'stone') {
        color = [0.48, 0.46, 0.43];
        rough = 0.62;
        metallic = 0.06;
      }

      const b = {
        x: cfg.x ?? 0,
        y: cfg.y ?? (0.42 + this.params.dropHeight),
        z: cfg.z ?? 0,
        prevX: cfg.x ?? 0,
        prevY: cfg.y ?? (0.42 + this.params.dropHeight),
        prevZ: cfg.z ?? 0,
        vx: cfg.vx ?? 0,
        vy: cfg.vy ?? 0,
        vz: cfg.vz ?? 0,
        wx: cfg.wx ?? 0,
        wy: cfg.wy ?? 0,
        wz: cfg.wz ?? 0,
        quat: [0, 0, 0, 1],
        prevQuat: [0, 0, 0, 1],
        r,
        mass,
        invMass: 1.0 / mass,
        material: mat,
        color,
        rough,
        metallic,
        inJellyContact: false,
        wasGoingDownInJelly: false
      };
      this.balls.push(b);
      return b;
    }

    triggerCenterImpact() {
      const hero = this.jellies[0].computeBoundsAndCentroid();
      const h = this.params.dropHeight;
      this.spawnBall({
        x: hero.cx,
        y: Math.max(hero.maxY + 0.16, 0.42 + h),
        z: hero.cz,
        vx: 0,
        vy: -0.35,
        vz: 0,
        mass: this.params.ballMass
      });
    }

    triggerOffsetImpact() {
      const hero = this.jellies[0].computeBoundsAndCentroid();
      const h = this.params.dropHeight;
      // Strike off-center on right-front shoulder with slight oblique velocity toward companion ball & soft jelly
      this.spawnBall({
        x: hero.cx + 0.14,
        y: Math.max(hero.maxY + 0.16, 0.40 + h * 0.92),
        z: hero.cz + 0.04,
        vx: 0.48,
        vy: -0.45,
        vz: 0.08,
        mass: this.params.ballMass
      });
    }

    triggerMultiImpact() {
      const hero = this.jellies[0].computeBoundsAndCentroid();
      const baseM = this.params.ballMass;
      const baseH = this.params.dropHeight;
      this.scheduledDrops = [];

      // Ball 1: immediate light-medium drop
      this.spawnBall({
        x: hero.cx - 0.02,
        y: Math.max(hero.maxY + 0.18, 0.42 + baseH * 0.62),
        z: hero.cz + 0.01,
        vx: 0.04,
        vy: -0.5,
        vz: 0,
        mass: Math.max(0.65, baseM * 0.48),
        material: 'aluminum'
      });

      // Ball 2: lands onto rebounding unsubsided oscillation (~0.88s later)
      this.scheduledDrops.push({
        triggerTime: this.simTime + 0.88,
        cfg: {
          x: hero.cx + 0.025,
          y: 0.42 + baseH * 0.88,
          z: hero.cz - 0.015,
          vx: -0.05,
          vy: -0.8,
          vz: 0.02,
          mass: baseM * 0.92,
          material: 'bronze'
        }
      });

      // Ball 3: heavy strike onto amplified oscillation (~1.82s later)
      this.scheduledDrops.push({
        triggerTime: this.simTime + 1.82,
        cfg: {
          x: hero.cx,
          y: 0.42 + baseH * 1.18,
          z: hero.cz,
          vx: 0.0,
          vy: -1.25,
          vz: 0.0,
          mass: baseM * 1.65,
          material: 'tungsten'
        }
      });
    }

    triggerCompareAllThree() {
      // Drop identical balls simultaneously onto all 3 jellies (plus bounce bridge!)
      const m = this.params.ballMass;
      const h = this.params.dropHeight;
      for (let j = 0; j < this.jellies.length; j++) {
        const b = this.jellies[j].computeBoundsAndCentroid();
        // On left firm cube, give slight rightward angle so it bounces right onto the center pudding!
        const vx = j === 1 ? 0.58 : 0.0;
        this.spawnBall({
          x: b.cx - (j === 1 ? 0.04 : 0),
          y: b.maxY + 0.12 + h * 0.78,
          z: b.cz,
          vx,
          vy: -0.4,
          vz: 0,
          r: 0.095,
          mass: m,
          material: 'steel'
        });
      }
    }

    snapshotPrevForInterp() {
      for (let j = 0; j < this.jellies.length; j++) {
        const jb = this.jellies[j];
        jb.prevRenderPos.set(jb.pos.subarray(0, jb.numVerts * 3));
      }
      for (let b = 0; b < this.balls.length; b++) {
        const ball = this.balls[b];
        ball.prevX = ball.x;
        ball.prevY = ball.y;
        ball.prevZ = ball.z;
        ball.prevQuat[0] = ball.quat[0];
        ball.prevQuat[1] = ball.quat[1];
        ball.prevQuat[2] = ball.quat[2];
        ball.prevQuat[3] = ball.quat[3];
      }
    }

    step(dt) {
      if (dt <= 0) return;
      this.snapshotPrevForInterp();
      this.simTime += dt;

      // Check scheduled sequential drops
      for (let i = this.scheduledDrops.length - 1; i >= 0; i--) {
        if (this.simTime >= this.scheduledDrops[i].triggerTime) {
          this.spawnBall(this.scheduledDrops[i].cfg);
          this.scheduledDrops.splice(i, 1);
        }
      }

      const substeps = 14;
      const sdt = dt / substeps;
      const stiffNorm = M.clamp(this.params.stiffness, 0.04, 1.0);
      const toughNorm = M.clamp(this.params.toughness, 0.04, 1.0);

      // Map stiffness [0.04..1.0] exponentially to shear modulus E: ~8 kPa (wobbly pudding) to ~240 kPa (bouncy firm gel)
      const baseModulus = 7500.0 * Math.pow(34.0, stiffNorm);
      // Viscoelastic velocity damping per substep: softer jellies have slightly richer internal damping
      const velDamp = Math.exp(-sdt * (0.65 + (1.0 - stiffNorm) * 0.85));

      let totalNewCleaves = 0;

      for (let stepIdx = 0; stepIdx < substeps; stepIdx++) {
        this._substepParity ^= 1;

        // 1. Predict jelly vertex positions under gravity
        for (let j = 0; j < this.jellies.length; j++) {
          const jb = this.jellies[j];
          const p = jb.pos, pp = jb.prevPos, v = jb.vel, invM = jb.invMass;
          const n3 = jb.numVerts * 3;
          for (let i = 0; i < jb.numVerts; i++) {
            if (invM[i] <= 0) continue;
            const i3 = i * 3;
            pp[i3] = p[i3];
            pp[i3 + 1] = p[i3 + 1];
            pp[i3 + 2] = p[i3 + 2];
            v[i3 + 1] += this.gravity * sdt;
            p[i3] += v[i3] * sdt;
            p[i3 + 1] += v[i3 + 1] * sdt;
            p[i3 + 2] += v[i3 + 2] * sdt;
          }
        }

        // 2. Integrate rigid spheres under gravity
        for (let b = 0; b < this.balls.length; b++) {
          const ball = this.balls[b];
          ball.vy += this.gravity * sdt;
          ball.x += ball.vx * sdt;
          ball.y += ball.vy * sdt;
          ball.z += ball.vz * sdt;
          M.quatIntegrate(ball.quat, ball.wx, ball.wy, ball.wz, sdt);
        }

        // 3. Solve Jelly XPBD Edge Stretch + Exact Signed-Volume Constraints
        for (let j = 0; j < this.jellies.length; j++) {
          const jb = this.jellies[j];
          const alphaEdge = 1.0 / (baseModulus * jb.stiffnessScale * sdt * sdt);
          this._solveJellyEdges(jb, alphaEdge, this._substepParity === 1);
          this._solveJellyVolumes(jb, 0.0, this._substepParity === 1);
        }

        // 4. Two-Way Ball <-> Jelly Surface Triangle Contact + Friction + Spin
        this._solveBallJellyContacts(sdt, stiffNorm);

        // 5. Re-enforce strict Jelly Volume + Tabletop Contact & Sliding Friction
        for (let j = 0; j < this.jellies.length; j++) {
          const jb = this.jellies[j];
          this._solveJellyVolumes(jb, 0.0, this._substepParity === 0);
          this._solveJellyFloorAndRim(jb, sdt);
        }

        // 6. Jelly-to-Jelly & Fragment-to-Fragment Boundary Collision
        if (stepIdx % 2 === 0) {
          this._solveInterJellyAndFragmentCollisions();
        }

        // 7. Rigid Ball <-> Ball & Ball <-> Plinth Collisions
        this._solveRigidBallCollisions(sdt);

        // 8. Update Jelly XPBD Velocities + Rayleigh Strain-Rate Damping
        const invSdt = 1.0 / sdt;
        for (let j = 0; j < this.jellies.length; j++) {
          const jb = this.jellies[j];
          const p = jb.pos, pp = jb.prevPos, v = jb.vel;
          for (let i = 0; i < jb.numVerts; i++) {
            const i3 = i * 3;
            let vx = (p[i3] - pp[i3]) * invSdt * velDamp;
            let vy = (p[i3 + 1] - pp[i3 + 1]) * invSdt * velDamp;
            let vz = (p[i3 + 2] - pp[i3 + 2]) * invSdt * velDamp;
            // Safety clamp against extreme numerical spikes
            const sp2 = vx * vx + vy * vy + vz * vz;
            if (sp2 > 484.0) {
              const s = 22.0 / Math.sqrt(sp2);
              vx *= s; vy *= s; vz *= s;
            }
            v[i3] = vx; v[i3 + 1] = vy; v[i3 + 2] = vz;
          }
        }

        // 9. Evaluate Material Fracture Criterion every 2 substeps
        if (stepIdx % 2 === 1) {
          for (let j = 0; j < this.jellies.length; j++) {
            totalNewCleaves += this.jellies[j].evaluateFracture(stiffNorm, toughNorm, this.balls, sdt * 2.0);
          }
        }
      }

      if (totalNewCleaves > 0 && this.sound) {
        this.sound.playJellyCrack(totalNewCleaves);
      }
    }

    _solveJellyEdges(jb, alpha, reverse) {
      const p = jb.pos;
      const invM = jb.invMass;
      const eIds = jb.edgeIds;
      const restL = jb.edgeRestLen;
      const n = jb.numEdges;

      for (let k = 0; k < n; k++) {
        const idx = reverse ? (n - 1 - k) : k;
        const i0 = eIds[idx * 2];
        const i1 = eIds[idx * 2 + 1];
        const w0 = invM[i0];
        const w1 = invM[i1];
        const wSum = w0 + w1;
        if (wSum <= 0) continue;

        const a0 = i0 * 3, a1 = i1 * 3;
        const dx = p[a0] - p[a1];
        const dy = p[a0 + 1] - p[a1 + 1];
        const dz = p[a0 + 2] - p[a1 + 2];
        const len = Math.hypot(dx, dy, dz);
        if (len < 1e-7) continue;

        const C = len - restL[idx];
        const s = -C / (wSum + alpha);
        const nx = dx / len, ny = dy / len, nz = dz / len;

        p[a0] += nx * s * w0;
        p[a0 + 1] += ny * s * w0;
        p[a0 + 2] += nz * s * w0;
        p[a1] -= nx * s * w1;
        p[a1 + 1] -= ny * s * w1;
        p[a1 + 2] -= nz * s * w1;
      }
    }

    _solveJellyVolumes(jb, alphaVol, reverse) {
      const p = jb.pos;
      const invM = jb.invMass;
      const tIds = jb.tetIds;
      const restV = jb.tetRestVol;
      const n = jb.numTets;

      for (let k = 0; k < n; k++) {
        const t = reverse ? (n - 1 - k) : k;
        const b4 = t * 4;
        const i0 = tIds[b4], i1 = tIds[b4 + 1], i2 = tIds[b4 + 2], i3 = tIds[b4 + 3];
        const a0 = i0 * 3, a1 = i1 * 3, a2 = i2 * 3, a3 = i3 * 3;

        const x0 = p[a0], y0 = p[a0 + 1], z0 = p[a0 + 2];
        const x1 = p[a1], y1 = p[a1 + 1], z1 = p[a1 + 2];
        const x2 = p[a2], y2 = p[a2 + 1], z2 = p[a2 + 2];
        const x3 = p[a3], y3 = p[a3 + 1], z3 = p[a3 + 2];

        // Gradients of 6*V wrt x1, x2, x3, x0 (divide by 6 via factor 1/6)
        const e1x = x1 - x0, e1y = y1 - y0, e1z = z1 - z0;
        const e2x = x2 - x0, e2y = y2 - y0, e2z = z2 - z0;
        const e3x = x3 - x0, e3y = y3 - y0, e3z = z3 - z0;

        // g1 = (e2 x e3) / 6
        const g1x = (e2y * e3z - e2z * e3y) / 6.0;
        const g1y = (e2z * e3x - e2x * e3z) / 6.0;
        const g1z = (e2x * e3y - e2y * e3x) / 6.0;

        // g2 = (e3 x e1) / 6
        const g2x = (e3y * e1z - e3z * e1y) / 6.0;
        const g2y = (e3z * e1x - e3x * e1z) / 6.0;
        const g2z = (e3x * e1y - e3y * e1x) / 6.0;

        // g3 = (e1 x e2) / 6
        const g3x = (e1y * e2z - e1z * e2y) / 6.0;
        const g3y = (e1z * e2x - e1x * e2z) / 6.0;
        const g3z = (e1x * e2y - e1y * e2x) / 6.0;

        const g0x = -(g1x + g2x + g3x);
        const g0y = -(g1y + g2y + g3y);
        const g0z = -(g1z + g2z + g3z);

        const vol = e1x * g1x + e1y * g1y + e1z * g1z;
        const C = vol - restV[t];

        const w0 = invM[i0], w1 = invM[i1], w2 = invM[i2], w3 = invM[i3];
        const denom =
          w0 * (g0x * g0x + g0y * g0y + g0z * g0z) +
          w1 * (g1x * g1x + g1y * g1y + g1z * g1z) +
          w2 * (g2x * g2x + g2y * g2y + g2z * g2z) +
          w3 * (g3x * g3x + g3y * g3y + g3z * g3z) +
          alphaVol;

        if (denom < 1e-14) continue;
        const s = -C / denom;

        p[a0] += g0x * s * w0; p[a0 + 1] += g0y * s * w0; p[a0 + 2] += g0z * s * w0;
        p[a1] += g1x * s * w1; p[a1 + 1] += g1y * s * w1; p[a1 + 2] += g1z * s * w1;
        p[a2] += g2x * s * w2; p[a2 + 1] += g2y * s * w2; p[a2 + 2] += g2z * s * w2;
        p[a3] += g3x * s * w3; p[a3 + 1] += g3y * s * w3; p[a3 + 2] += g3z * s * w3;
      }
    }

    _solveBallJellyContacts(sdt, stiffNorm) {
      if (this.balls.length === 0) return;

      for (let b = 0; b < this.balls.length; b++) {
        const ball = this.balls[b];
        let hadContact = false;
        let maxImpactRelSpeed = 0;

        for (let j = 0; j < this.jellies.length; j++) {
          const jb = this.jellies[j];
          const p = jb.pos;
          const pp = jb.prevPos;
          const invM = jb.invMass;
          const tris = jb.surfaceTris;
          const numT = jb.numSurfaceTris;

          // Quick AABB cull against ball
          let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
          const bVerts = jb.boundaryVerts;
          for (let k = 0; k < bVerts.length; k++) {
            const v3 = bVerts[k] * 3;
            const x = p[v3], y = p[v3 + 1], z = p[v3 + 2];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          }
          const pad = ball.r + 0.03;
          if (
            ball.x < minX - pad || ball.x > maxX + pad ||
            ball.y < minY - pad || ball.y > maxY + pad ||
            ball.z < minZ - pad || ball.z > maxZ + pad
          ) {
            continue;
          }

          // Check closest point on every surface triangle to ball center (prevents tunneling!)
          for (let t = 0; t < numT; t++) {
            const i0 = tris[t * 3], i1 = tris[t * 3 + 1], i2 = tris[t * 3 + 2];
            const a0 = i0 * 3, a1 = i1 * 3, a2 = i2 * 3;
            const ax = p[a0], ay = p[a0 + 1], az = p[a0 + 2];
            const bx = p[a1], by = p[a1 + 1], bz = p[a1 + 2];
            const cx = p[a2], cy = p[a2 + 1], cz = p[a2 + 2];

            // Triangle AABB quick check
            if (
              ball.x + ball.r < Math.min(ax, bx, cx) || ball.x - ball.r > Math.max(ax, bx, cx) ||
              ball.y + ball.r < Math.min(ay, by, cy) || ball.y - ball.r > Math.max(ay, by, cy) ||
              ball.z + ball.r < Math.min(az, bz, cz) || ball.z - ball.r > Math.max(az, bz, cz)
            ) {
              continue;
            }

            // Closest point on triangle ABC to ball center P (Ericson barycentric regions)
            const abx = bx - ax, aby = by - ay, abz = bz - az;
            const acx = cx - ax, acy = cy - ay, acz = cz - az;
            const apx = ball.x - ax, apy = ball.y - ay, apz = ball.z - az;

            const d1 = abx * apx + aby * apy + abz * apz;
            const d2 = acx * apx + acy * apy + acz * apz;
            let bw0 = 1, bw1 = 0, bw2 = 0;

            if (d1 <= 0 && d2 <= 0) {
              bw0 = 1; bw1 = 0; bw2 = 0;
            } else {
              const bpx = ball.x - bx, bpy = ball.y - by, bpz = ball.z - bz;
              const d3 = abx * bpx + aby * bpy + abz * bpz;
              const d4 = acx * bpx + acy * bpy + acz * bpz;
              if (d3 >= 0 && d4 <= d3) {
                bw0 = 0; bw1 = 1; bw2 = 0;
              } else {
                const vc = d1 * d4 - d3 * d2;
                if (vc <= 0 && d1 >= 0 && d3 <= 0) {
                  bw1 = d1 / (d1 - d3 || 1e-8);
                  bw0 = 1 - bw1; bw2 = 0;
                } else {
                  const cpx = ball.x - cx, cpy = ball.y - cy, cpz = ball.z - cz;
                  const d5 = abx * cpx + aby * cpy + abz * cpz;
                  const d6 = acx * cpx + acy * cpy + acz * cpz;
                  if (d6 >= 0 && d5 <= d6) {
                    bw0 = 0; bw1 = 0; bw2 = 1;
                  } else {
                    const vb = d5 * d2 - d1 * d6;
                    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
                      bw2 = d2 / (d2 - d6 || 1e-8);
                      bw0 = 1 - bw2; bw1 = 0;
                    } else {
                      const va = d3 * d6 - d5 * d4;
                      if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
                        const w = (d4 - d3) / ((d4 - d3) + (d5 - d6) || 1e-8);
                        bw0 = 0; bw1 = 1 - w; bw2 = w;
                      } else {
                        const denom = 1.0 / (va + vb + vc || 1e-8);
                        bw1 = vb * denom;
                        bw2 = vc * denom;
                        bw0 = 1.0 - bw1 - bw2;
                      }
                    }
                  }
                }
              }
            }

            const qx = bw0 * ax + bw1 * bx + bw2 * cx;
            const qy = bw0 * ay + bw1 * by + bw2 * cy;
            const qz = bw0 * az + bw1 * bz + bw2 * cz;

            let dx = ball.x - qx;
            let dy = ball.y - qy;
            let dz = ball.z - qz;

            // Outward triangle normal
            let fnx = aby * acz - abz * acy;
            let fny = abz * acx - abx * acz;
            let fnz = abx * acy - aby * acx;
            const fnLen = Math.hypot(fnx, fny, fnz) || 1.0;
            fnx /= fnLen; fny /= fnLen; fnz /= fnLen;

            let dist = Math.hypot(dx, dy, dz);
            const signedSide = dx * fnx + dy * fny + dz * fnz;

            // Only collide from exterior / shallow penetration so internal backfaces don't trap ball
            if (dist >= ball.r || signedSide < -ball.r * 0.65) continue;

            hadContact = true;
            let nx, ny, nz, pen;
            if (dist > 1e-6 && signedSide >= 0) {
              nx = dx / dist; ny = dy / dist; nz = dz / dist;
              pen = ball.r - dist;
            } else {
              nx = fnx; ny = fny; nz = fnz;
              pen = ball.r - signedSide;
            }
            if (pen <= 0) continue;

            // Effective XPBD inverse mass of barycentric point + ball
            const wTri = bw0 * bw0 * invM[i0] + bw1 * bw1 * invM[i1] + bw2 * bw2 * invM[i2];
            const wBall = ball.invMass;
            const wTot = wTri + wBall;
            if (wTot <= 1e-10) continue;

            // Relative velocity along contact normal before impulse
            const triVx = (bw0 * (ax - pp[a0]) + bw1 * (bx - pp[a1]) + bw2 * (cx - pp[a2])) / sdt;
            const triVy = (bw0 * (ay - pp[a0 + 1]) + bw1 * (by - pp[a1 + 1]) + bw2 * (cy - pp[a2 + 1])) / sdt;
            const triVz = (bw0 * (az - pp[a0 + 2]) + bw1 * (bz - pp[a1 + 2]) + bw2 * (cz - pp[a2 + 2])) / sdt;

            const rvx = ball.vx - triVx;
            const rvy = ball.vy - triVy;
            const rvz = ball.vz - triVz;
            const vn = rvx * nx + rvy * ny + rvz * nz;
            if (-vn > maxImpactRelSpeed) maxImpactRelSpeed = -vn;

            const impulsePos = pen / wTot;
            // Displace ball outward & jelly triangle vertices inward (Newton's 3rd Law!)
            ball.x += nx * impulsePos * wBall;
            ball.y += ny * impulsePos * wBall;
            ball.z += nz * impulsePos * wBall;

            p[a0] -= nx * impulsePos * bw0 * invM[i0];
            p[a0 + 1] -= ny * impulsePos * bw0 * invM[i0];
            p[a0 + 2] -= nz * impulsePos * bw0 * invM[i0];

            p[a1] -= nx * impulsePos * bw1 * invM[i1];
            p[a1 + 1] -= ny * impulsePos * bw1 * invM[i1];
            p[a1 + 2] -= nz * impulsePos * bw1 * invM[i1];

            p[a2] -= nx * impulsePos * bw2 * invM[i2];
            p[a2 + 1] -= ny * impulsePos * bw2 * invM[i2];
            p[a2 + 2] -= nz * impulsePos * bw2 * invM[i2];

            // Update ball velocity along normal + elastic restitution from stiff jelly membrane
            if (vn < 0) {
              const restit = 0.08 + 0.22 * stiffNorm;
              const dvBall = -(1.0 + restit) * vn * (wBall / wTot);
              ball.vx += nx * dvBall;
              ball.vy += ny * dvBall;
              ball.vz += nz * dvBall;
            } else {
              // Jelly rebounding upward pushing the ball!
              const pushUp = (impulsePos / sdt) * wBall * 0.88;
              ball.vx += nx * pushUp;
              ball.vy += ny * pushUp;
              ball.vz += nz * pushUp;
            }

            // Tangential friction + rolling spin torque on ball AND shear drag on jelly (drives tilt/slide on oblique hits!)
            // Contact point on ball relative to ball center is -r * n
            const surfVx = rvx + (ball.wy * (-nz * ball.r) - ball.wz * (-ny * ball.r));
            const surfVy = rvy + (ball.wz * (-nx * ball.r) - ball.wx * (-nz * ball.r));
            const surfVz = rvz + (ball.wx * (-ny * ball.r) - ball.wy * (-nx * ball.r));
            const vDotN = surfVx * nx + surfVy * ny + surfVz * nz;
            const tx = surfVx - vDotN * nx;
            const ty = surfVy - vDotN * ny;
            const tz = surfVz - vDotN * nz;
            const tSpd = Math.hypot(tx, ty, tz);
            if (tSpd > 1e-5) {
              const mu = 0.26;
              const maxTang = mu * (impulsePos / sdt);
              const jt = Math.min(maxTang, tSpd / (wTot + 2.5 * wBall));
              const tnx = tx / tSpd, tny = ty / tSpd, tnz = tz / tSpd;

              ball.vx -= tnx * jt * wBall;
              ball.vy -= tny * jt * wBall;
              ball.vz -= tnz * jt * wBall;

              // Spin torque: r_vec x (-jt * t_hat), I_sphere = (2/5) m r^2 -> invI = 2.5 * wBall / r^2
              const invI_r = (2.5 * wBall) / Math.max(0.02, ball.r);
              // (-n) x (-t) = n x t
              ball.wx += (ny * tnz - nz * tny) * jt * invI_r;
              ball.wy += (nz * tnx - nx * tnz) * jt * invI_r;
              ball.wz += (nx * tny - ny * tnx) * jt * invI_r;

              // Equal-and-opposite tangential displacement on jelly vertices (makes jelly tilt, wobble & slide!)
              const jDisp = jt * sdt * 0.55;
              p[a0] += tnx * jDisp * bw0 * invM[i0];
              p[a0 + 1] += tny * jDisp * bw0 * invM[i0];
              p[a0 + 2] += tnz * jDisp * bw0 * invM[i0];
              p[a1] += tnx * jDisp * bw1 * invM[i1];
              p[a1 + 1] += tny * jDisp * bw1 * invM[i1];
              p[a1 + 2] += tnz * jDisp * bw1 * invM[i1];
              p[a2] += tnx * jDisp * bw2 * invM[i2];
              p[a2 + 1] += tny * jDisp * bw2 * invM[i2];
              p[a2 + 2] += tnz * jDisp * bw2 * invM[i2];
            }
          }
        }

        // Audio event detection for ball-jelly entry & elastic launch rebound
        if (hadContact && !ball.inJellyContact && maxImpactRelSpeed > 0.55) {
          if (this.sound) this.sound.playJellyImpact(maxImpactRelSpeed, stiffNorm, ball.mass);
        }
        if (hadContact && ball.vy < -0.3) {
          ball.wasGoingDownInJelly = true;
        }
        if (hadContact && ball.wasGoingDownInJelly && ball.vy > 0.55) {
          ball.wasGoingDownInJelly = false;
          if (this.sound) this.sound.playJellyRebound(ball.vy, stiffNorm);
        }
        if (!hadContact) {
          ball.wasGoingDownInJelly = false;
        }
        ball.inJellyContact = hadContact;
      }
    }

    _solveJellyFloorAndRim(jb, sdt) {
      const p = jb.pos;
      const pp = jb.prevPos;
      const hx = this.plinthHalfX - 0.04;
      const hz = this.plinthHalfZ - 0.04;
      // Satin laboratory bench friction: allows oblique impacts to visibly slide the jelly, then brake smoothly!
      const friction = 0.24;

      for (let v = 0; v < jb.numVerts; v++) {
        const v3 = v * 3;
        if (p[v3 + 1] < this.floorY) {
          const pen = this.floorY - p[v3 + 1];
          p[v3 + 1] = this.floorY;
          const dx = p[v3] - pp[v3];
          const dz = p[v3 + 2] - pp[v3 + 2];
          const dTang = Math.hypot(dx, dz);
          if (dTang > 1e-7) {
            const damp = Math.min(1.0, (friction * (pen + 0.0025)) / dTang + 0.08);
            p[v3] -= dx * damp;
            p[v3 + 2] -= dz * damp;
          }
        }
        // Keep on stage bench
        if (p[v3] < -hx) p[v3] = -hx;
        if (p[v3] > hx) p[v3] = hx;
        if (p[v3 + 2] < -hz) p[v3 + 2] = -hz;
        if (p[v3 + 2] > hz) p[v3 + 2] = hz;
      }
    }

    _solveInterJellyAndFragmentCollisions() {
      // Repel boundary vertices of different jellies OR different disconnected fragments of the same jelly!
      const minSep = 0.026;
      const minSep2 = minSep * minSep;

      // Gather all boundary vertices with global tag = jellyIdx * 1024 + compId
      // Total boundary verts across 3 jellies ~ 1,100 -> spatial hash grid cell = 0.06m
      const cellMap = new Map();
      const entries = []; // [jbIdx, vIdx, tag, x, y, z]

      for (let j = 0; j < this.jellies.length; j++) {
        const jb = this.jellies[j];
        const bVerts = jb.boundaryVerts;
        const p = jb.pos;
        const comp = jb.compId;
        for (let k = 0; k < bVerts.length; k++) {
          const v = bVerts[k];
          const v3 = v * 3;
          const x = p[v3], y = p[v3 + 1], z = p[v3 + 2];
          const idx = entries.length;
          entries.push(j, v, j * 1024 + comp[v], x, y, z);

          const gx = Math.floor(x * 18.0);
          const gy = Math.floor(y * 18.0);
          const gz = Math.floor(z * 18.0);
          const key = (gx * 73856093) ^ (gy * 19349663) ^ (gz * 83492791);
          let bucket = cellMap.get(key);
          if (!bucket) {
            bucket = [];
            cellMap.set(key, bucket);
          }
          bucket.push(idx);
        }
      }

      const nEnt = entries.length / 6;
      for (let a = 0; a < nEnt; a++) {
        const baseA = a * 6;
        const jA = entries[baseA], vA = entries[baseA + 1], tagA = entries[baseA + 2];
        const ax = entries[baseA + 3], ay = entries[baseA + 4], az = entries[baseA + 5];
        const gx0 = Math.floor(ax * 18.0), gy0 = Math.floor(ay * 18.0), gz0 = Math.floor(az * 18.0);

        for (let dz = -1; dz <= 1; dz++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const key = ((gx0 + dx) * 73856093) ^ ((gy0 + dy) * 19349663) ^ ((gz0 + dz) * 83492791);
              const bucket = cellMap.get(key);
              if (!bucket) continue;
              for (let m = 0; m < bucket.length; m++) {
                const baseB = bucket[m];
                if (baseB <= baseA) continue;
                if (entries[baseB + 2] === tagA) continue; // same intact component

                const jB = entries[baseB], vB = entries[baseB + 1];
                const pA = this.jellies[jA].pos, pB = this.jellies[jB].pos;
                const rx = pA[vA * 3] - pB[vB * 3];
                const ry = pA[vA * 3 + 1] - pB[vB * 3 + 1];
                const rz = pA[vA * 3 + 2] - pB[vB * 3 + 2];
                const d2 = rx * rx + ry * ry + rz * rz;
                if (d2 < minSep2 && d2 > 1e-10) {
                  const d = Math.sqrt(d2);
                  const push = 0.45 * (minSep - d) / d;
                  pA[vA * 3] += rx * push;
                  pA[vA * 3 + 1] += ry * push;
                  pA[vA * 3 + 2] += rz * push;
                  pB[vB * 3] -= rx * push;
                  pB[vB * 3 + 1] -= ry * push;
                  pB[vB * 3 + 2] -= rz * push;
                }
              }
            }
          }
        }
      }
    }

    _solveRigidBallCollisions(sdt) {
      const hx = this.plinthHalfX - 0.04;
      const hz = this.plinthHalfZ - 0.04;

      // Ball <-> Stage floor & low curb
      for (let i = 0; i < this.balls.length; i++) {
        const b = this.balls[i];
        if (b.y - b.r < this.floorY) {
          const impactV = -b.vy;
          b.y = this.floorY + b.r;
          if (b.vy < 0) {
            b.vy = -b.vy * (b.material === 'stone' ? 0.28 : 0.42);
            if (impactV > 0.55 && this.sound) {
              this.sound.playRigidCollision(impactV, b.material);
            }
          }
          // Rolling friction & spin sync on tabletop
          const slipX = b.vx - b.wz * b.r;
          const slipZ = b.vz + b.wx * b.r;
          b.vx -= slipX * Math.min(1.0, 9.0 * sdt);
          b.vz -= slipZ * Math.min(1.0, 9.0 * sdt);
          b.wz = b.vx / b.r;
          b.wx = -b.vz / b.r;
          // Gentle rolling resistance so balls settle smoothly
          const rollDamp = Math.exp(-1.15 * sdt);
          b.vx *= rollDamp;
          b.vz *= rollDamp;
          b.wy *= rollDamp;
        }

        // Low studio bench rim bounce
        if (b.x - b.r < -hx) { b.x = -hx + b.r; b.vx = Math.abs(b.vx) * 0.55; }
        if (b.x + b.r > hx)  { b.x = hx - b.r;  b.vx = -Math.abs(b.vx) * 0.55; }
        if (b.z - b.r < -hz) { b.z = -hz + b.r; b.vz = Math.abs(b.vz) * 0.55; }
        if (b.z + b.r > hz)  { b.z = hz - b.r;  b.vz = -Math.abs(b.vz) * 0.55; }
      }

      // Ball <-> Ball collisions
      for (let i = 0; i < this.balls.length; i++) {
        for (let j = i + 1; j < this.balls.length; j++) {
          const a = this.balls[i];
          const b = this.balls[j];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const dist = Math.hypot(dx, dy, dz);
          const minDist = a.r + b.r;
          if (dist < minDist && dist > 1e-7) {
            const nx = dx / dist, ny = dy / dist, nz = dz / dist;
            const pen = minDist - dist;
            const wSum = a.invMass + b.invMass;
            a.x -= nx * pen * (a.invMass / wSum);
            a.y -= ny * pen * (a.invMass / wSum);
            a.z -= nz * pen * (a.invMass / wSum);
            b.x += nx * pen * (b.invMass / wSum);
            b.y += ny * pen * (b.invMass / wSum);
            b.z += nz * pen * (b.invMass / wSum);

            const rvx = b.vx - a.vx, rvy = b.vy - a.vy, rvz = b.vz - a.vz;
            const vn = rvx * nx + rvy * ny + rvz * nz;
            if (vn < 0) {
              const e = 0.72;
              const jImp = -(1.0 + e) * vn / wSum;
              a.vx -= nx * jImp * a.invMass;
              a.vy -= ny * jImp * a.invMass;
              a.vz -= nz * jImp * a.invMass;
              b.vx += nx * jImp * b.invMass;
              b.vy += ny * jImp * b.invMass;
              b.vz += nz * jImp * b.invMass;
              if (-vn > 0.3 && this.sound) {
                this.sound.playRigidCollision(-vn, a.material === 'stone' || b.material === 'stone' ? 'stone' : 'metal');
              }
            }
          }
        }
      }
    }
  }

  App.JellyBody = JellyBody;
  App.JellySceneSim = JellySceneSim;
})();
