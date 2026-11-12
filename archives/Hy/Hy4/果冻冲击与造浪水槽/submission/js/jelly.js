/* 场景一：体积软体果冻（XPBD 体积格 + 断裂判据） + 重球刚体
 * 接口：reset / setParams / trigger / step / balls / density / volume / renderP / drainEvents
 */
(function () {
  'use strict';
  const M = window.M, V = M.V, clamp = M.clamp;

  const DEFS = [
    { c: [-1.74, 0.58, 0.0], half: [0.56, 0.56, 0.54], round: 0.19, col: [0.36, 0.92, 0.76], soft: 0.42, tough: 0.92, name: '韧性青绿' },
    { c: [0.00, 0.56, 0.0], half: [0.62, 0.54, 0.58], round: 0.17, col: [1.00, 0.36, 0.52], soft: 0.85, tough: 0.30, name: '软质桃红' },
    { c: [1.76, 0.60, 0.0], half: [0.55, 0.58, 0.55], round: 0.21, col: [0.74, 0.54, 1.00], soft: 0.28, tough: 0.88, name: '高弹紫' },
  ];
  const BALL_COLS = [
    [0.87, 0.90, 0.95], [0.86, 0.70, 0.42], [0.55, 0.58, 0.63], [0.78, 0.83, 0.88],
  ];

  function rbox(p, b, r) {
    const qx = Math.abs(p[0]) - b[0] + r, qy = Math.abs(p[1]) - b[1] + r, qz = Math.abs(p[2]) - b[2] + r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
  }
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm3 = (a) => V.norm(a);

  class JellySim {
    constructor() {
      this.mode = 1;
      this.tune = {
        g: 11.5, iters: 8, springBase: 0.30, damp: 0.9,
        contactK: 46, contactC: 7.0, pushFrac: 0.72, particleR: 0.045,
        ballRest: 0.30, ballFric: 0.86, tableFric: 0.80,
        crackT: 3.4, breakT: 6.5, sepV: 2.2,
      };
      this.params = { soft: 0.55, tough: 0.6, mass: 0.62, height: 0.6 };
      this.events = [];
      this.reset();
    }

    reset() {
      this.time = 0; this.frame = 0; this.events.length = 0;
      this.ballList = []; this.ballId = 0;
      this._build();
      // 台上静置的装饰球（冲击由触发/演示时序加入）
      this._spawn({ x: -2.55, z: 0.95, y: 0.26, mass: 2.2, col: BALL_COLS[1], rest: true });
      this._spawn({ x: 2.62, z: 0.85, y: 0.22, mass: 1.8, col: BALL_COLS[2], rest: true });
    }

    setParams(p) { Object.assign(this.params, p); }

    /* ------------------------------------------------------------ 构建 */
    _build() {
      const N = 7;
      const pos = [], rest = [], ijk = [], jof = [];
      this.jellies = [];
      const defs = DEFS;
      for (let jd = 0; jd < defs.length; jd++) {
        const D = defs[jd];
        const map = new Int32Array(N * N * N).fill(-1);
        const start = pos.length / 3;
        for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const x = -D.half[0] + 2 * D.half[0] * i / (N - 1);
          const y = -D.half[1] + 2 * D.half[1] * j / (N - 1);
          const z = -D.half[2] + 2 * D.half[2] * k / (N - 1);
          if (rbox([x, y, z], D.half, D.round) > 0.012) continue;
          const idx = pos.length / 3;
          map[i * N * N + j * N + k] = idx;
          pos.push(D.c[0] + x, D.c[1] + y, D.c[2] + z);
          rest.push(D.c[0] + x, D.c[1] + y, D.c[2] + z);
          ijk.push(i, j, k); jof.push(jd);
        }
        const end = pos.length / 3;
        this.jellies.push({ def: D, N, map, start, end, fractured: false, planes: null, rStart: 0, rEnd: 0 });
      }
      const n = pos.length / 3; this.n = n;
      this.sp = new Float32Array(pos); this.sr = new Float32Array(rest);
      this.sv = new Float32Array(3 * n); this.sPrev = new Float32Array(3 * n);
      this.sIJK = new Int32Array(ijk); this.sJelly = new Int32Array(jof);
      this.sPiece = new Int32Array(n);

      // springs (26 邻域, 每对一次)
      const offsets = [];
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        if (dx > 0 || (dx === 0 && (dy > 0 || (dy === 0 && dz > 0)))) offsets.push([dx, dy, dz]);
      }
      const si = [], sj = [], sl = [], sk = [];
      for (const J of this.jellies) {
        const N2 = J.N, map = J.map;
        for (let pi = J.start; pi < J.end; pi++) {
          const i = this.sIJK[3 * pi], j = this.sIJK[3 * pi + 1], k = this.sIJK[3 * pi + 2];
          for (const o of offsets) {
            const ii = i + o[0], jj = j + o[1], kk = k + o[2];
            if (ii < 0 || jj < 0 || kk < 0 || ii >= N2 || jj >= N2 || kk >= N2) continue;
            const pj = map[ii * N2 * N2 + jj * N2 + kk];
            if (pj < 0) continue;
            const dx = this.sr[3 * pi] - this.sr[3 * pj];
            const dy = this.sr[3 * pi + 1] - this.sr[3 * pj + 1];
            const dz = this.sr[3 * pi + 2] - this.sr[3 * pj + 2];
            si.push(pi); sj.push(pj); sl.push(Math.hypot(dx, dy, dz));
            const dsum = Math.abs(o[0]) + Math.abs(o[1]) + Math.abs(o[2]);
            sk.push(dsum === 1 ? 1.0 : dsum === 2 ? 0.62 : 0.42);
          }
        }
      }
      this.sprI = new Int32Array(si); this.sprJ = new Int32Array(sj);
      this.sprL = new Float32Array(sl); this.sprK = new Float32Array(sk);
      this.sprBroken = new Uint8Array(si.length);

      // render particles (skinned to lattice)
      const rIdx = [], rW = [], rCol = [], rRest = [];
      const sp = 0.074;
      for (const J of this.jellies) {
        const D = J.def, N2 = J.N, map = J.map;
        J.rStart = rIdx.length / 8;
        for (let x = -D.half[0]; x <= D.half[0] + 1e-6; x += sp)
          for (let y = -D.half[1]; y <= D.half[1] + 1e-6; y += sp)
            for (let z = -D.half[2]; z <= D.half[2] + 1e-6; z += sp) {
              if (rbox([x, y, z], D.half, D.round) > 0.0) continue;
              const fi = clamp((x + D.half[0]) / (2 * D.half[0]) * (N2 - 1), 0, N2 - 1 - 1e-4);
              const fj = clamp((y + D.half[1]) / (2 * D.half[1]) * (N2 - 1), 0, N2 - 1 - 1e-4);
              const fk = clamp((z + D.half[2]) / (2 * D.half[2]) * (N2 - 1), 0, N2 - 1 - 1e-4);
              const i0 = Math.floor(fi), j0 = Math.floor(fj), k0 = Math.floor(fk);
              const tx = fi - i0, ty = fj - j0, tz = fk - k0;
              for (let dk = 0; dk < 2; dk++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
                const ii = i0 + di, jj = j0 + dj, kk = k0 + dk;
                let idx = -1;
                if (ii < N2 && jj < N2 && kk < N2) idx = map[ii * N2 * N2 + jj * N2 + kk];
                rIdx.push(idx < 0 ? -1 : idx);
                rW.push((di ? tx : 1 - tx) * (dj ? ty : 1 - ty) * (dk ? tz : 1 - tz));
              }
              rCol.push(D.col[0], D.col[1], D.col[2]);
              rRest.push(D.c[0] + x, D.c[1] + y, D.c[2] + z);
            }
        J.rEnd = rIdx.length / 8;
      }
      this.rIdx = new Int32Array(rIdx); this.rW = new Float32Array(rW);
      this.rCol = new Float32Array(rCol); this.rRest = new Float32Array(rRest);
      this.rPiece = new Int32Array(rIdx.length / 8);
      this.m = rIdx.length / 8;
      this.dens = new Float32Array(this.m * 8);
      this.tmp = new Float32Array(this.m * 8);
    }

    /* ------------------------------------------------------------ 球 */
    _spawn(o) {
      const p = this.params;
      const mass = o.mass !== undefined ? o.mass : (2.6 + p.mass * 7.5);
      const r = o.r !== undefined ? o.r : (0.205 + mass * 0.0165);
      const y = o.y !== undefined ? o.y : (2.15 + p.height * 1.9);
      const col = o.col || BALL_COLS[this.ballId % BALL_COLS.length];
      const b = {
        p: [o.x || 0, y, o.z || 0],
        v: [o.vx || 0, o.vy || 0, o.vz || 0],
        r, mass, col, metal: 0.93, rough: 0.14, type: 0,
        ang: [0, 0, 0], id: this.ballId++, active: true,
        contactStarted: false, hit: new Set(), resting: !!o.rest,
      };
      if (b.resting) { b.p[1] = r; b.v = [0, 0, 0]; }
      this.ballList.push(b);
      if (this.ballList.length > 12) this.ballList.shift();
      return b;
    }

    trigger(name) {
      const p = this.params;
      const h = 2.15 + p.height * 1.9;
      if (name === 'center') {
        this._spawn({ x: 0.0, z: 0.0, y: h, vy: -0.5 });
      } else if (name === 'offset') {
        this._spawn({ x: 0.46, z: -0.10, y: h * 0.95, vx: -1.9, vy: -0.4, vz: 0.5, mass: 3.5 + p.mass * 5 });
      } else if (name === 'multi') {
        this._spawn({ x: 0, z: 0, y: h, mass: 2.5 + p.mass * 2, vy: -0.5 });
      } else if (name === 'multi2') {
        this._spawn({ x: -0.12, z: 0.05, y: h, mass: 3.8 + p.mass * 1.6, vy: -0.6 });
      } else if (name === 'multi3') {
        this._spawn({ x: 0.06, z: -0.04, y: h * 1.05, mass: 10.5 + p.mass * 7, vy: -0.8 });
      } else if (name === 'drop') {
        this._spawn({});
      }
    }

    /* ------------------------------------------------------------ 物理一步 */
    step(dt) {
      const T = this.tune, n = this.n;
      this.time += dt; this.frame++;
      const sp = this.sp, sv = this.sv, sPrev = this.sPrev, sr = this.sr;

      // 1) 球积分
      for (const b of this.ballList) {
        if (!b.active) continue;
        if (!b.resting) b.v[1] -= T.g * dt;
        b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
        b.ang[0] += b.v[2] * dt / b.r; b.ang[2] -= b.v[0] * dt / b.r;
      }

      // 2) 果冻预测（重力）
      for (let i = 0; i < n; i++) {
        sPrev[3 * i] = sp[3 * i]; sPrev[3 * i + 1] = sp[3 * i + 1]; sPrev[3 * i + 2] = sp[3 * i + 2];
        sv[3 * i + 1] -= T.g * dt;
        sp[3 * i] += sv[3 * i] * dt; sp[3 * i + 1] += sv[3 * i + 1] * dt; sp[3 * i + 2] += sv[3 * i + 2] * dt;
      }

      // 3) XPBD 弹簧约束（Gauss-Seidel）
      const softGlobal = this.params.soft;
      const sI = this.sprI, sJ = this.sprJ, sL = this.sprL, sK = this.sprK, sB = this.sprBroken;
      for (let it = 0; it < T.iters; it++) {
        for (let s = 0; s < sI.length; s++) {
          if (sB[s]) continue;
          const i = sI[s], j = sJ[s];
          let dx = sp[3 * i] - sp[3 * j], dy = sp[3 * i + 1] - sp[3 * j + 1], dz = sp[3 * i + 2] - sp[3 * j + 2];
          const L = Math.hypot(dx, dy, dz) || 1e-6;
          const C = L - sL[s];
          const jd = this.sJelly[i];
          const soft = DEFS[jd].soft * (0.45 + 1.05 * softGlobal);
          const stiff = clamp(T.springBase * (1.15 - 0.85 * soft) * sK[s], 0.012, 0.6);
          const corr = -C * stiff / L;
          dx *= corr * 0.5; dy *= corr * 0.5; dz *= corr * 0.5;
          sp[3 * i] += dx; sp[3 * i + 1] += dy; sp[3 * i + 2] += dz;
          sp[3 * j] -= dx; sp[3 * j + 1] -= dy; sp[3 * j + 2] -= dz;
        }
      }

      // 4) 球—果冻双向接触：粒子推出球面（表面包球/形成凹坑），
      //    径向反作用给水平偏转，竖直方向用体积弹性和阻尼把球弹起或吞住
      for (const b of this.ballList) {
        if (!b.active) continue;
        let fx = 0, fz = 0, cnt = 0;
        const R = b.r + T.particleR;
        for (let i = 0; i < n; i++) {
          const dx = sp[3 * i] - b.p[0], dy = sp[3 * i + 1] - b.p[1], dz = sp[3 * i + 2] - b.p[2];
          const L = Math.hypot(dx, dy, dz);
          if (L >= R || L < 1e-6) continue;
          const pen = R - L, inv = 1 / L;
          const nx = dx * inv, ny = dy * inv, nz = dz * inv;
          const push = pen * T.pushFrac;
          sp[3 * i] += nx * push; sp[3 * i + 1] += ny * push; sp[3 * i + 2] += nz * push;
          fx -= nx * pen; fz -= nz * pen;
          cnt++;
        }
        // 竖直弹性：以果冻静止顶面为参考，越陷越往上推（软果冻更软 → 陷更深）
        const jd = this._nearestJelly(b.p);
        if (jd >= 0 && cnt > 0) {
          const D = this.jellies[jd].def;
          const inX = Math.abs(b.p[0] - D.c[0]) < D.half[0] + b.r * 0.9;
          const inZ = Math.abs(b.p[2] - D.c[2]) < D.half[2] + b.r * 0.9;
          if (inX && inZ) {
            const topY = D.c[1] + D.half[1];
            const pen = topY - (b.p[1] - b.r);
            if (pen > 0) {
              const soft = D.soft * (0.45 + 1.05 * softGlobal);
              const K = b.mass * (150 + 280 * (1 - soft));
              const C = b.mass * T.contactC * 1.6;
              b.v[1] += (K * pen - C * b.v[1]) * dt / b.mass;
            }
          }
        }
        if (cnt > 0) {
          const speed = Math.hypot(b.v[0], b.v[1], b.v[2]);
          b.v[0] += fx * T.contactK * dt / b.mass;
          b.v[2] += fz * T.contactK * dt / b.mass;
          const dc = 1 - Math.min(0.85, T.contactC * dt);
          b.v[0] *= dc; b.v[2] *= dc;
          b.v[0] *= 0.995; b.v[2] *= 0.995;
          if (!b.contactStarted && speed > 1.2) {
            b.contactStarted = true;
            this.events.push({ type: 'impact', strength: clamp(speed / 9, 0.2, 1) });
            this._tryFracture(b, speed);
          }
        } else {
          b.contactStarted = false;
        }
      }

      // 4b) 果冻之间分离，避免互相穿透
      for (let a = 0; a < this.jellies.length; a++) for (let c = a + 1; c < this.jellies.length; c++) {
        const A = this.jellies[a], B = this.jellies[c];
        let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
        for (let i = A.start; i < A.end; i++) { ax += sp[3 * i]; ay += sp[3 * i + 1]; az += sp[3 * i + 2]; }
        for (let i = B.start; i < B.end; i++) { bx += sp[3 * i]; by += sp[3 * i + 1]; bz += sp[3 * i + 2]; }
        const na = A.end - A.start, nb = B.end - B.start;
        ax /= na; ay /= na; az /= na; bx /= nb; by /= nb; bz /= nb;
        let dx = bx - ax, dy = by - ay, dz = bz - az;
        const dist = Math.hypot(dx, dy, dz) || 1e-6;
        const R = (A.def.half[0] + B.def.half[0]) * 1.02 + 0.12;
        if (dist < R && dy < R * 0.7) {
          const push = (R - dist) * 0.5 / dist;
          dx *= push; dz *= push;
          for (let i = A.start; i < A.end; i++) { sp[3 * i] -= dx * 0.5; sp[3 * i + 2] -= dz * 0.5; }
          for (let i = B.start; i < B.end; i++) { sp[3 * i] += dx * 0.5; sp[3 * i + 2] += dz * 0.5; }
        }
      }

      // 5) 球—台/地/球 碰撞
      for (const b of this.ballList) {
        if (!b.active) continue;
        const onTable = Math.abs(b.p[0]) < 4.15 && Math.abs(b.p[2]) < 2.35;
        const floor = onTable ? 0 : -0.62;
        if (b.p[1] - b.r < floor) {
          b.p[1] = floor + b.r;
          if (b.v[1] < 0) b.v[1] = -b.v[1] * T.ballRest;
          b.v[0] *= T.ballFric; b.v[2] *= T.ballFric;
          if (Math.abs(b.v[1]) < 0.35) b.v[1] = 0;
        }
        // 台边（软约束，允许滚落）
        if (b.p[0] > 4.25) b.p[0] = 4.25;
        if (b.p[0] < -4.25) b.p[0] = -4.25;
        if (b.p[2] > 2.45) b.p[2] = 2.45;
        if (b.p[2] < -2.45) b.p[2] = -2.45;
      }
      for (let a = 0; a < this.ballList.length; a++) for (let c = a + 1; c < this.ballList.length; c++) {
        const A = this.ballList[a], B = this.ballList[c];
        if (!A.active || !B.active) continue;
        const dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1], dz = B.p[2] - A.p[2];
        const L = Math.hypot(dx, dy, dz), R = A.r + B.r;
        if (L >= R || L < 1e-6) continue;
        const nx = dx / L, ny = dy / L, nz = dz / L, pen = R - L;
        const wa = 1 / A.mass, wb = 1 / B.mass, w = wa + wb;
        A.p[0] -= nx * pen * wa / w; A.p[1] -= ny * pen * wa / w; A.p[2] -= nz * pen * wa / w;
        B.p[0] += nx * pen * wb / w; B.p[1] += ny * pen * wb / w; B.p[2] += nz * pen * wb / w;
        const rvx = B.v[0] - A.v[0], rvy = B.v[1] - A.v[1], rvz = B.v[2] - A.v[2];
        const vn = rvx * nx + rvy * ny + rvz * nz;
        if (vn < 0) {
          const imp = -(1 + 0.45) * vn / w;
          A.v[0] -= nx * imp * wa; A.v[1] -= ny * imp * wa; A.v[2] -= nz * imp * wa;
          B.v[0] += nx * imp * wb; B.v[1] += ny * imp * wb; B.v[2] += nz * imp * wb;
          this.events.push({ type: 'ballhit', strength: clamp(-vn / 8, 0.1, 1) });
        }
      }

      // 6) 果冻—台面碰撞
      for (let i = 0; i < n; i++) {
        if (sp[3 * i + 1] < 0.0) {
          sp[3 * i + 1] = 0.0;
          sv[3 * i] *= T.tableFric; sv[3 * i + 2] *= T.tableFric;
        }
        if (sp[3 * i] > 4.1) sp[3 * i] = 4.1;
        if (sp[3 * i] < -4.1) sp[3 * i] = -4.1;
        if (sp[3 * i + 2] > 2.3) sp[3 * i + 2] = 2.3;
        if (sp[3 * i + 2] < -2.3) sp[3 * i + 2] = -2.3;
      }

      // 7) 速度更新 + 阻尼
      const damp = Math.max(0, 1 - T.damp * dt);
      for (let i = 0; i < n; i++) {
        sv[3 * i] = (sp[3 * i] - sPrev[3 * i]) / dt * damp;
        sv[3 * i + 1] = (sp[3 * i + 1] - sPrev[3 * i + 1]) / dt * damp;
        sv[3 * i + 2] = (sp[3 * i + 2] - sPrev[3 * i + 2]) / dt * damp;
      }

      // 8) 连续冲击：后球赶在余振上（由外部时序触发 multi2/multi3）
      this._skin();
    }

    /* ------------------------------------------------------------ 断裂 */
    _tryFracture(ball, speed) {
      const jd = this._nearestJelly(ball.p);
      if (jd < 0) return;
      const J = this.jellies[jd];
      if (J.fractured) return;
      const soft = J.def.soft, tough = this.params.tough;
      const sev = ball.mass * speed / (10 + 30 * tough) * (0.6 + 0.7 * soft);
      if (sev < this.tune.crackT) return;
      this._fracture(J, ball.p, sev);
      this.events.push({ type: 'crack', strength: clamp(sev / 4, 0.4, 1) });
    }

    _nearestJelly(p) {
      let best = -1, bd = 1e9;
      for (let jd = 0; jd < this.jellies.length; jd++) {
        const c = this.jellies[jd].def.c;
        const d = Math.abs(p[0] - c[0]) + Math.abs(p[2] - c[2]);
        if (d < bd) { bd = d; best = jd; }
      }
      return best;
    }

    _pieceOf(p, planes) {
      const jag = 0.05 * Math.sin(p[1] * 21 + p[2] * 13) + 0.038 * Math.sin(p[0] * 27 - p[1] * 11);
      let id = 0;
      for (let k = 0; k < planes.length; k++) {
        const v = dot3(planes[k].n, p) - planes[k].d + jag;
        if (v > 0) id |= (1 << k);
      }
      return id;
    }

    _fracture(J, impact, sev) {
      const ang = 0.55 + J.def.c[0] * 0.28;
      const planes = [];
      const n1 = norm3([Math.cos(ang), 0.14, Math.sin(ang)]);
      planes.push({ n: n1, d: dot3(n1, impact) });
      const n2 = norm3([-Math.sin(ang), 0.06, Math.cos(ang)]);
      planes.push({ n: n2, d: dot3(n2, impact) });
      if (sev > this.tune.breakT) {
        const n3 = norm3([0.06, 1, 0.09]);
        planes.push({ n: n3, d: dot3(n3, impact) - 0.10 });
      }
      J.planes = planes; J.fractured = true;
      for (let i = J.start; i < J.end; i++) {
        this.sPiece[i] = this._pieceOf([this.sr[3 * i], this.sr[3 * i + 1], this.sr[3 * i + 2]], planes);
      }
      for (let r = J.rStart; r < J.rEnd; r++) {
        this.rPiece[r] = this._pieceOf([this.rRest[3 * r], this.rRest[3 * r + 1], this.rRest[3 * r + 2]], planes);
      }
      for (let s = 0; s < this.sprI.length; s++) {
        const i = this.sprI[s], j = this.sprJ[s];
        if (i >= J.start && i < J.end && j >= J.start && j < J.end && this.sPiece[i] !== this.sPiece[j]) {
          this.sprBroken[s] = 1;
        }
      }
      // 分离冲量：每块沿其质心方向被推开
      const groups = new Map();
      for (let i = J.start; i < J.end; i++) {
        const id = this.sPiece[i];
        if (!groups.has(id)) groups.set(id, [0, 0, 0, 0]);
        const g = groups.get(id);
        g[0] += this.sr[3 * i]; g[1] += this.sr[3 * i + 1]; g[2] += this.sr[3 * i + 2]; g[3]++;
      }
      for (const [id, g] of groups) {
        let dir = [g[0] / g[3] - impact[0], 0.12, g[2] / g[3] - impact[2]];
        if (Math.hypot(dir[0], dir[2]) < 0.02) dir = [Math.cos(id * 2.3), 0.12, Math.sin(id * 2.3)];
        dir = norm3(dir);
        const s = this.tune.sepV * (0.65 + 0.35 * (sev / this.tune.breakT));
        for (let i = J.start; i < J.end; i++) if (this.sPiece[i] === id) {
          this.sv[3 * i] += dir[0] * s; this.sv[3 * i + 1] += dir[1] * s * 0.5; this.sv[3 * i + 2] += dir[2] * s;
        }
      }
    }

    /* ------------------------------------------------------------ 蒙皮 → 密度粒子 */
    _skin() {
      const sp = this.sp, out = this.dens, rIdx = this.rIdx, rW = this.rW;
      const rPiece = this.rPiece, sPiece = this.sPiece, rCol = this.rCol;
      const m = this.m;
      for (let r = 0; r < m; r++) {
        let x = 0, y = 0, z = 0, wsum = 0;
        const o = r * 8, ro = r * 3;
        for (let c = 0; c < 8; c++) {
          const idx = rIdx[o + c];
          if (idx < 0) continue;
          if (sPiece[idx] !== rPiece[r]) continue;
          const w = rW[o + c];
          if (w <= 0) continue;
          x += w * sp[3 * idx]; y += w * sp[3 * idx + 1]; z += w * sp[3 * idx + 2];
          wsum += w;
        }
        if (wsum < 0.03) {
          out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0;
          out[o + 4] = 0; out[o + 5] = 0; out[o + 6] = 0; out[o + 7] = 0;
        } else {
          const inv = 1 / wsum;
          out[o] = x * inv; out[o + 1] = y * inv; out[o + 2] = z * inv; out[o + 3] = 1;
          out[o + 4] = rCol[ro]; out[o + 5] = rCol[ro + 1]; out[o + 6] = rCol[ro + 2]; out[o + 7] = 0;
        }
      }
    }

    /* ------------------------------------------------------------ 接口 */
    balls() {
      return this.ballList.filter((b) => b.active).map((b) => ({
        p: b.p, r: b.r, col: b.col, metal: b.metal, rough: b.rough, type: 0,
      }));
    }
    density() { this._skin(); return { data: this.dens, count: this.m }; }
    volume() { return { min: [-3.2, -0.15, -1.7], max: [3.2, 3.3, 1.7], refCount: 0.36 }; }
    renderP() {
      return { sceneMode: 1, volumeActive: true, iso: 0.36, stepWorld: 0.075,
        foamStr: 1.0, exposure: 1.32, groundRefl: 0.85,
        lightDir: [0.42, 0.84, 0.52], lightCol: [1.0, 0.95, 0.86], waterTint: [0.5, 0.22, 0.12],
        tankP: [-2.55, 0.14, 1.55, 1.0] };
    }
    drainEvents() { const e = this.events.slice(); this.events.length = 0; return e; }
    status() {
      return '果冻 ' + this.n + ' 节点 · ' + this.sprI.length + ' 约束 · ' + this.m + ' 采样 · 球 ' + this.ballList.length;
    }
  }

  window.JellySim = JellySim;
})();
