// 三维粒子系统：确定性模拟、生命周期、力场、碰撞、事件、拖尾
import { stableRandom, noise3, clamp, lerp, mulberry32, hashSeed } from './math.js';
import { Field } from './fields.js';

export class ParticleSystem {
  constructor(opts = {}) {
    this.seed = opts.seed ?? 1;
    this.emitters = (opts.emitters || []).map((e) => ({ ...defaultEmitter(), ...e }));
    this.forces = opts.forces || []; // Field[]
    this.colliders = opts.colliders || []; // {type:'plane'|'sphere'|'mesh', ...}
    this.events = opts.events || []; // {on:'collision'|'death', action:'color'|'impulse'|'spawn', params}
    this.maxParticles = opts.maxParticles || 3000;
    this.trailLength = opts.trailLength ?? 12;
    this.trailWidth = opts.trailWidth ?? 3;
    this.gravity = opts.gravity || [0, -200, 0];
    this.drag = opts.drag ?? 0.02;
    this.duration = opts.duration || 15;
    this.fps = opts.fps || 30;
    this._cache = new Map(); // time -> state
  }

  reset() {
    this._cache.clear();
  }

  // 确定性求值：从 0 模拟到 t（带检查点缓存）
  evaluate(t) {
    const step = 1 / this.fps;
    const frame = Math.round(t / step);
    if (this._cache.has(frame)) return this._cache.get(frame);
    // 找最近检查点
    let startFrame = 0;
    let state = null;
    for (let f = frame; f >= 0; f--) {
      if (this._cache.has(f)) {
        startFrame = f;
        state = cloneState(this._cache.get(f));
        break;
      }
    }
    if (!state) {
      state = this._initialState();
      this._cache.set(0, state);
    }
    for (let f = startFrame + 1; f <= frame; f++) {
      this._step(state, f * step, step);
      // 每 10 帧存检查点
      if (f % 10 === 0) this._cache.set(f, cloneState(state));
    }
    this._cache.set(frame, cloneState(state));
    // 缓存上限
    if (this._cache.size > 400) {
      const keys = [...this._cache.keys()].sort((a, b) => a - b);
      for (let i = 0; i < 100; i++) this._cache.delete(keys[i]);
    }
    return state;
  }

  _initialState() {
    return {
      particles: [],
      nextId: 1,
      trails: new Map(),
      events: [],
    };
  }

  _spawn(state, t) {
    for (const em of this.emitters) {
      if (!em.enabled) continue;
      if (t < em.startTime || t > em.endTime) continue;
      const rate = em.rate;
      const expected = (t - Math.max(em.startTime, 0)) * rate;
      const already = state.particles.filter((p) => p.emitterId === em.id).length + (em._spawned || 0);
      const toSpawn = Math.min(20, Math.floor(expected - (em._spawned || 0)));
      em._spawned = (em._spawned || 0) + Math.max(0, toSpawn);
      for (let i = 0; i < toSpawn; i++) {
        if (state.particles.length >= this.maxParticles) break;
        const id = state.nextId++;
        const rnd = mulberry32(hashSeed(this.seed, id, em.id));
        const pos = em.shape === 'point'
          ? [...em.position]
          : em.shape === 'sphere'
            ? randomInSphere(em.position, em.size, rnd)
            : em.shape === 'box'
              ? [em.position[0] + (rnd() - 0.5) * em.size[0], em.position[1] + (rnd() - 0.5) * em.size[1], em.position[2] + (rnd() - 0.5) * em.size[2]]
              : em.shape === 'mesh' && em.meshSampler
                ? em.meshSampler(rnd())
                : [...em.position];
        const vel = [
          em.velocity[0] + (rnd() - 0.5) * em.spread,
          em.velocity[1] + (rnd() - 0.5) * em.spread,
          em.velocity[2] + (rnd() - 0.5) * em.spread,
        ];
        state.particles.push({
          id,
          emitterId: em.id,
          birth: t,
          death: t + em.life * (0.6 + rnd() * 0.8),
          pos: pos.slice(),
          vel: vel.slice(),
          mass: em.mass,
          size: em.sizeBase,
          color: em.color.slice(),
          opacity: 1,
          rotation: rnd() * Math.PI * 2,
          rotSpeed: em.rotSpeed * (rnd() - 0.5) * 2,
          trail: [],
          alive: true,
          collided: 0,
        });
      }
    }
  }

  _step(state, t, dt) {
    this._spawn(state, t);
    const g = this.gravity;
    for (const p of state.particles) {
      if (!p.alive) continue;
      const age = t - p.birth;
      const lifeT = age / Math.max(0.01, p.death - p.birth);
      if (lifeT >= 1) {
        p.alive = false;
        continue;
      }
      // 生命周期：大小/透明度曲线
      p.opacity = lifeT < 0.12 ? lifeT / 0.12 : 1 - Math.pow(Math.max(0, lifeT - 0.12) / 0.88, 1.6);
      p.sizeCur = p.size * (1 + lifeT * 0.6);
      p.rotation += p.rotSpeed * dt;
      // 力
      let ax = g[0], ay = g[1], az = g[2];
      const f = Field.combine(this.forces, p.pos[0], p.pos[1], p.pos[2], t, 'particles');
      ax += f[0] / Math.max(0.2, p.mass);
      ay += f[1] / Math.max(0.2, p.mass);
      az += f[2] / Math.max(0.2, p.mass);
      // 阻力
      const dragK = Math.pow(1 - clamp(this.drag, 0, 0.5), dt * 60);
      p.vel[0] = (p.vel[0] + ax * dt) * dragK;
      p.vel[1] = (p.vel[1] + ay * dt) * dragK;
      p.vel[2] = (p.vel[2] + az * dt) * dragK;
      p.pos[0] += p.vel[0] * dt;
      p.pos[1] += p.vel[1] * dt;
      p.pos[2] += p.vel[2] * dt;
      // 碰撞
      for (const col of this.colliders) {
        this._collide(p, col, t);
      }
      // 拖尾
      if (this.trailLength > 0) {
        p.trail.push([p.pos[0], p.pos[1], p.pos[2]]);
        if (p.trail.length > this.trailLength) p.trail.shift();
      }
    }
    // 清理死亡粒子（保留少量历史用于回放）
    state.particles = state.particles.filter((p) => p.alive || t - p.death < 0.2);
  }

  _collide(p, col, t) {
    if (col.type === 'plane') {
      const n = col.normal || [0, 1, 0];
      const d = col.offset ?? 0;
      const dist = (p.pos[0] * n[0] + p.pos[1] * n[1] + p.pos[2] * n[2]) - d;
      const vn = p.vel[0] * n[0] + p.vel[1] * n[1] + p.vel[2] * n[2];
      if (dist < (col.thickness || 2) && vn < 0) {
        const bounce = col.bounce ?? 0.55;
        const friction = col.friction ?? 0.82;
        const dot = vn;
        p.vel[0] = (p.vel[0] - 2 * dot * n[0]) * bounce;
        p.vel[1] = (p.vel[1] - 2 * dot * n[1]) * bounce;
        p.vel[2] = (p.vel[2] - 2 * dot * n[2]) * bounce;
        p.vel[0] *= friction; p.vel[2] *= friction;
        p.pos[0] += n[0] * (col.thickness || 2 - dist);
        p.pos[1] += n[1] * ((col.thickness || 2) - dist);
        p.pos[2] += n[2] * ((col.thickness || 2) - dist);
        p.collided++;
        this._fireEvent(p, 'collision', t, col);
      }
    } else if (col.type === 'sphere') {
      const c = col.center || [0, 0, 0];
      const r = col.radius || 100;
      const dx = p.pos[0] - c[0], dy = p.pos[1] - c[1], dz = p.pos[2] - c[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < r + (col.thickness || 2)) {
        const nx = dx / (d || 1), ny = dy / (d || 1), nz = dz / (d || 1);
        const vn = p.vel[0] * nx + p.vel[1] * ny + p.vel[2] * nz;
        if (vn < 0) {
          const bounce = col.bounce ?? 0.6;
          p.vel[0] = (p.vel[0] - 2 * vn * nx) * bounce;
          p.vel[1] = (p.vel[1] - 2 * vn * ny) * bounce;
          p.vel[2] = (p.vel[2] - 2 * vn * nz) * bounce;
          p.pos[0] = c[0] + nx * (r + (col.thickness || 2));
          p.pos[1] = c[1] + ny * (r + (col.thickness || 2));
          p.pos[2] = c[2] + nz * (r + (col.thickness || 2));
          p.collided++;
          this._fireEvent(p, 'collision', t, col);
        }
      }
    } else if (col.type === 'mesh' && col.meshSampler) {
      // 网格碰撞：采样最近点（简化：高度场式）
      const hit = col.meshSampler(p.pos[0], p.pos[1], p.pos[2]);
      if (hit && hit.hit) {
        const n = hit.normal;
        const vn = p.vel[0] * n[0] + p.vel[1] * n[1] + p.vel[2] * n[2];
        if (vn < 0) {
          const bounce = col.bounce ?? 0.5;
          p.vel[0] = (p.vel[0] - 2 * vn * n[0]) * bounce;
          p.vel[1] = (p.vel[1] - 2 * vn * n[1]) * bounce;
          p.vel[2] = (p.vel[2] - 2 * vn * n[2]) * bounce;
          p.pos[0] = hit.point[0] + n[0] * 2;
          p.pos[1] = hit.point[1] + n[1] * 2;
          p.pos[2] = hit.point[2] + n[2] * 2;
          p.collided++;
          this._fireEvent(p, 'collision', t, col);
        }
      }
    }
  }

  _fireEvent(p, type, t, col) {
    for (const ev of this.events) {
      if (ev.on !== type) continue;
      if (ev.action === 'color') {
        p.color = (ev.params?.color || [1, 0.6, 0.2]).slice();
      } else if (ev.action === 'life') {
        p.death = Math.min(p.death, t + (ev.params?.extraLife ?? 0.3));
      } else if (ev.action === 'impulse') {
        const imp = ev.params?.impulse || [0, 120, 0];
        p.vel[0] += imp[0];
        p.vel[1] += imp[1];
        p.vel[2] += imp[2];
      } else if (ev.action === 'spawn' && this._secondaryCount < (ev.params?.max ?? 40)) {
        // 次级发射
        this._secondaryCount = (this._secondaryCount || 0) + 1;
        p.color = ev.params?.color || p.color;
      }
    }
    p.events = p.events || [];
    if (p.events.length < 6) p.events.push({ type, t, id: p.id });
  }
}

function defaultEmitter() {
  return {
    id: 'em1',
    enabled: true,
    shape: 'point', // point | sphere | box | mesh
    position: [0, 0, 0],
    size: 50,
    sizeBase: 6,
    velocity: [0, 80, 0],
    spread: 40,
    rate: 60,
    life: 2.2,
    mass: 1,
    color: [1, 0.75, 0.35],
    rotSpeed: 1.2,
    startTime: 0,
    endTime: 15,
    meshSampler: null,
    _spawned: 0,
  };
}

function randomInSphere(center, r, rnd) {
  const u = rnd(), v = rnd();
  const theta = u * Math.PI * 2;
  const phi = Math.acos(2 * v - 1);
  const rad = r * Math.cbrt(rnd());
  return [
    center[0] + rad * Math.sin(phi) * Math.cos(theta),
    center[1] + rad * Math.sin(phi) * Math.sin(theta),
    center[2] + rad * Math.cos(phi),
  ];
}

function cloneState(s) {
  return {
    particles: s.particles.map((p) => ({ ...p, pos: p.pos.slice(), vel: p.vel.slice(), trail: p.trail.map((t) => t.slice()), color: p.color.slice() })),
    nextId: s.nextId,
    trails: s.trails,
    events: [],
    _spawned: s._spawned,
  };
}

// 导出粒子为渲染数据（含拖尾）
export function particlesToRenderData(state) {
  const points = [];
  const trails = [];
  for (const p of state.particles) {
    if (!p.alive && p.opacity <= 0) continue;
    points.push({
      pos: p.pos,
      size: p.sizeCur || p.size,
      color: p.color,
      opacity: p.opacity,
      rotation: p.rotation,
      id: p.id,
    });
    if (p.trail && p.trail.length > 1) {
      trails.push({ points: p.trail.slice(), width: 2 + p.size * 0.25, color: p.color, opacity: p.opacity * 0.7 });
    }
  }
  return { points, trails };
}
