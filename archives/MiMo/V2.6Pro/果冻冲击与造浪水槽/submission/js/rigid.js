// rigid.js — 刚性球体（果冻场景 CPU 积分；水槽场景球在 water.js 内 GPU 积分）
(function (global) {
  'use strict';

  class RigidBall {
    constructor(opts) {
      this.x = opts.x || 0;
      this.y = opts.y || 2;
      this.z = opts.z || 0;
      this.vx = opts.vx || 0;
      this.vy = opts.vy || 0;
      this.vz = opts.vz || 0;
      this.radius = opts.radius || 0.28;
      this.mass = opts.mass || 12;
      this.restitution = opts.restitution != null ? opts.restitution : 0.42;
      this.friction = opts.friction != null ? opts.friction : 0.35;
      this.color = opts.color || { x: 0.75, y: 0.77, z: 0.8 };
      this.metallic = opts.metallic != null ? opts.metallic : 0.85;
      this.roughness = opts.roughness != null ? opts.roughness : 0.32;
      this.alive = true;
      this.sleeping = false;
      this.sleepTimer = 0;
      this.onImpact = opts.onImpact || null;
      this.kind = opts.kind || 0; // 0 金属 1 石质
    }
  }

  class RigidWorld {
    constructor() {
      this.balls = [];
      this.gravity = -9.81;
      this.tableY = 0;
      this.bounds = { minX: -8, maxX: 8, minZ: -5, maxZ: 5 };
    }

    add(ball) {
      this.balls.push(ball);
      return ball;
    }

    clear() {
      this.balls.length = 0;
    }

    step(dt) {
      const balls = this.balls;
      // 积分
      for (const b of balls) {
        if (!b.alive) continue;
        b.vy += this.gravity * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;

        // 台面
        if (b.y - b.radius < this.tableY) {
          b.y = this.tableY + b.radius;
          if (b.vy < 0) {
            const imp = -b.vy;
            b.vy = -b.vy * b.restitution;
            b.vx *= 1 - b.friction * 0.55;
            b.vz *= 1 - b.friction * 0.55;
            if (b.onImpact && imp > 1.1) b.onImpact(b, imp * 0.28, 'table');
          }
        }

        // 简单侧向边界（防止滚出台面外）
        const B = this.bounds;
        if (b.x < B.minX + b.radius) { b.x = B.minX + b.radius; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x > B.maxX - b.radius) { b.x = B.maxX - b.radius; b.vx = -Math.abs(b.vx) * 0.5; }
        if (b.z < B.minZ + b.radius) { b.z = B.minZ + b.radius; b.vz = Math.abs(b.vz) * 0.5; }
        if (b.z > B.maxZ - b.radius) { b.z = B.maxZ - b.radius; b.vz = -Math.abs(b.vz) * 0.5; }

        // 滚动摩擦
        const sp = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
        if (b.y <= this.tableY + b.radius + 0.01 && sp < 0.25) {
          b.vx *= 0.92;
          b.vz *= 0.92;
        }
      }

      // 球-球碰撞
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          if (!b.alive) continue;
          let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const rsum = a.radius + b.radius;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < rsum * rsum && d2 > 1e-12) {
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d, nz = dz / d;
            const pen = rsum - d;
            const totalInv = 1 / a.mass + 1 / b.mass;
            const corr = pen / totalInv;
            a.x -= nx * corr / a.mass; a.y -= ny * corr / a.mass; a.z -= nz * corr / a.mass;
            b.x += nx * corr / b.mass; b.y += ny * corr / b.mass; b.z += nz * corr / b.mass;
            const rvx = b.vx - a.vx, rvy = b.vy - a.vy, rvz = b.vz - a.vz;
            const vn = rvx * nx + rvy * ny + rvz * nz;
            if (vn < 0) {
              const e = Math.min(a.restitution, b.restitution);
              const jimp = -(1 + e) * vn / totalInv;
              a.vx -= jimp * nx / a.mass; a.vy -= jimp * ny / a.mass; a.vz -= jimp * nz / a.mass;
              b.vx += jimp * nx / b.mass; b.vy += jimp * ny / b.mass; b.vz += jimp * nz / b.mass;
              const imp = Math.abs(vn);
              if (a.onImpact && imp > 1.0) a.onImpact(a, imp * 0.3, 'ball');
              if (b.onImpact && imp > 1.0) b.onImpact(b, imp * 0.3, 'ball');
            }
          }
        }
      }
    }
  }

  global.RigidBall = RigidBall;
  global.RigidWorld = RigidWorld;
})(window);
