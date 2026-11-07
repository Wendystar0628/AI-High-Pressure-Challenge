// Height-field water + coarse velocity field for ball advection (scene 2)
import * as THREE from 'three';

export class WaterSim {
  constructor(opts = {}) {
    this.lx = opts.lx ?? 9;       // tank length (x)
    this.lz = opts.lz ?? 3.6;     // tank depth (z)
    this.level = opts.level ?? 2.1; // still water height
    this.gravity = opts.gravity ?? 9.8;
    this.viscosity = opts.viscosity ?? 0.35;

    this.nx = 72;
    this.nz = 30;
    const n = this.nx * this.nz;
    this.h = new Float32Array(n);       // height above 0
    this.hPrev = new Float32Array(n);
    this.vel = new Float32Array(n * 2); // horizontal velocity (u,v) at cells
    this.reset();
  }

  reset() {
    this.h.fill(this.level);
    this.hPrev.fill(this.level);
    this.vel.fill(0);
    this.waveActive = false;
    this.wavePhase = 0;
    this.waveAmp = 0.45;
    this.waveFreq = 1.1;
  }

  setLevel(v) { this.level = v; this.reset(); }
  setGravity(g) { this.gravity = g; }
  setViscosity(v) { this.viscosity = v; }

  // add a splash impulse at world (x,z)
  splash(wx, wz, radius = 0.55, strength = 0.12) {
    const { nx, nz, lx, lz, h, hPrev } = this;
    const ci = ((wx + lx * 0.5) / lx) * (nx - 1);
    const cj = ((wz + lz * 0.5) / lz) * (nz - 1);
    const ri = radius / lx * nx;
    const rj = radius / lz * nz;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const d2 = (i - ci) * (i - ci) / (ri * ri) + (j - cj) * (j - cj) / (rj * rj);
        if (d2 < 1) {
          const f = (1 - d2);
          const id = j * nx + i;
          h[id] -= strength * f * f;
          hPrev[id] -= strength * f * f * 0.65;
        }
      }
    }
  }

  // wave maker drive: paddle position in [-1,1]
  step(dt) {
    const { nx, nz, lx, lz, h, hPrev, vel, level } = this;
    const c2 = 3.6 * this.gravity / 2.2; // wave speed² (tuned)
    const damp = Math.min(0.995, 0.9992 - this.viscosity * 0.004);
    const idx = (i, j) => j * nx + i;

    // boundary drive from wave maker (left edge = i=0)
    if (this.waveActive) {
      const drive = this.waveAmp * Math.sin(this.wavePhase);
      for (let j = 0; j < nz; j++) {
        const id = idx(0, j);
        h[id] = level + drive * 0.42;
        // inject rightward velocity at boundary
        vel[id * 2] += drive * 1.7 * dt * 60;
      }
      this.wavePhase += dt * this.waveFreq * Math.PI * 2;
    }

    // wave equation update (explicit)
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const id = idx(i, j);
        const l = idx(Math.max(0, i - 1), j);
        const r = idx(Math.min(nx - 1, i + 1), j);
        const u = idx(i, Math.max(0, j - 1));
        const d = idx(i, Math.min(nz - 1, j + 1));
        const lap = h[l] + h[r] + h[u] + h[d] - 4 * h[id];
        let acc = c2 * lap;
        // restore toward level (weak spring so tank doesn't overflow visually)
        acc += (level - h[id]) * 1.6;
        const velH = h[id] - hPrev[id];
        hPrev[id] = h[id];
        h[id] = h[id] + velH * damp + acc * dt * dt;
        // clamp
        if (h[id] < 0.15) h[id] = 0.15;
        if (h[id] > level + 2.2) h[id] = level + 2.2;
      }
    }

    // reflect boundaries (walls)
    for (let j = 0; j < nz; j++) {
      h[idx(0, j)] = h[idx(1, j)];
      h[idx(nx - 1, j)] = h[idx(nx - 2, j)];
    }
    for (let i = 0; i < nx; i++) {
      h[idx(i, 0)] = h[idx(i, 1)];
      h[idx(i, nz - 1)] = h[idx(i, nz - 2)];
    }
    if (this.waveActive) {
      const drive = this.waveAmp * Math.sin(this.wavePhase);
      for (let j = 0; j < nz; j++) h[idx(0, j)] = level + drive * 0.42;
    }

    // horizontal velocity field from height gradient (shallow-water-ish)
    const cs = Math.sqrt(c2);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const id = idx(i, j);
        const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1);
        const j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
        const dhdx = (h[idx(i1, j)] - h[idx(i0, j)]) / (lx / nx * 2);
        const dhdz = (h[idx(i, j1)] - h[idx(i, j0)]) / (lz / nz * 2);
        const tu = vel[id * 2] * 0.90 - dhdx * cs * 0.10;
        const tv = vel[id * 2 + 1] * 0.90 - dhdz * cs * 0.10;
        vel[id * 2] = tu;
        vel[id * 2 + 1] = tv;
      }
    }
    // wave-maker pushes water to the right near left wall
    if (this.waveActive) {
      const drive = this.waveAmp * Math.sin(this.wavePhase);
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < Math.min(10, nx); i++) {
          const id = idx(i, j);
          const fall = 1 - i / 10;
          vel[id * 2] += drive * 5.2 * fall * dt;
        }
      }
    }
    // mild viscosity diffusion on velocity
    const visc = this.viscosity;
    for (let j = 1; j < nz - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const id = idx(i, j);
        const uU = vel[idx(i, j - 1) * 2], uD = vel[idx(i, j + 1) * 2];
        const uL = vel[idx(i - 1, j) * 2], uR = vel[idx(i + 1, j) * 2];
        const vU = vel[idx(i, j - 1) * 2 + 1], vD = vel[idx(i, j + 1) * 2 + 1];
        const vL = vel[idx(i - 1, j) * 2 + 1], vR = vel[idx(i + 1, j) * 2 + 1];
        vel[id * 2] += (uL + uR + uU + uD - 4 * vel[id * 2]) * visc * 0.22;
        vel[id * 2 + 1] += (vL + vR + vU + vD - 4 * vel[id * 2 + 1]) * visc * 0.22;
      }
    }
  }

  heightAt(wx, wz) {
    const { nx, nz, lx, lz, h } = this;
    const fx = Math.min(nx - 1.001, Math.max(0, ((wx + lx * 0.5) / lx) * (nx - 1)));
    const fz = Math.min(nz - 1.001, Math.max(0, ((wz + lz * 0.5) / lz) * (nz - 1)));
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    const i1 = Math.min(nx - 1, i0 + 1), j1 = Math.min(nz - 1, j0 + 1);
    const tx = fx - i0, tz = fz - j0;
    const idx = (i, j) => j * nx + i;
    const a = h[idx(i0, j0)], b = h[idx(i1, j0)], c = h[idx(i0, j1)], d = h[idx(i1, j1)];
    return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
  }

  // sample velocity at world (x,y,z). y used for depth-decay factor.
  velAt(wx, wy, wz, out) {
    const { nx, nz, lx, lz, vel, h } = this;
    const fx = Math.min(nx - 1.001, Math.max(0, ((wx + lx * 0.5) / lx) * (nx - 1)));
    const fz = Math.min(nz - 1.001, Math.max(0, ((wz + lz * 0.5) / lz) * (nz - 1)));
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    const i1 = Math.min(nx - 1, i0 + 1), j1 = Math.min(nz - 1, j0 + 1);
    const tx = fx - i0, tz = fz - j0;
    const idx = (i, j) => j * nx + i;
    const bil = (arr, ch) => {
      const a = arr[idx(i0, j0) * 2 + ch], b = arr[idx(i1, j0) * 2 + ch];
      const c = arr[idx(i0, j1) * 2 + ch], d = arr[idx(i1, j1) * 2 + ch];
      return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
    };
    const u = bil(vel, 0), v = bil(vel, 1);
    const surf = this.heightAt(wx, wz);
    const depth = Math.max(0, surf - wy);
    const decay = Math.exp(-depth * 0.55);
    out.set(u * decay, 0, v * decay);
    return out;
  }
}

// ---------- Water visual mesh ----------
export class WaterMesh {
  constructor(sim, tankH) {
    this.sim = sim;
    this.tankH = tankH;
    const segX = 96, segZ = 40;
    // top surface
    const topGeo = new THREE.PlaneGeometry(sim.lx, sim.lz, segX, segZ);
    topGeo.rotateX(-Math.PI / 2);
    this.topGeo = topGeo;
    const topMat = new THREE.MeshPhysicalMaterial({
      color: 0x2f8fd6,
      roughness: 0.12,
      metalness: 0.02,
      transmission: 0.55,
      thickness: 0.6,
      ior: 1.33,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 1.15,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
    });
    this.top = new THREE.Mesh(topGeo, topMat);
    this.top.receiveShadow = true;
    this.top.castShadow = false;

    // side volume (translucent box under the surface, updated roughly)
    const bodyGeo = new THREE.BoxGeometry(sim.lx, 1, sim.lz, segX, 6, segZ);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x1f6fae,
      roughness: 0.28,
      metalness: 0.0,
      transmission: 0.72,
      thickness: 1.8,
      ior: 1.33,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.y = 1;
    this.body.castShadow = false;
    this.body.receiveShadow = false;
    this.body.renderOrder = -1;

    this.group = new THREE.Group();
    this.group.add(this.body);
    this.group.add(this.top);
  }

  update() {
    const sim = this.sim;
    const topPos = this.topGeo.attributes.position;
    const n = topPos.count;
    for (let i = 0; i < n; i++) {
      const x = topPos.getX(i), z = topPos.getZ(i);
      topPos.setY(i, sim.heightAt(x, z));
    }
    topPos.needsUpdate = true;
    this.topGeo.computeVertexNormals();

    // body: stretch to average height, position under surface
    let avg = 0;
    for (let i = 0; i < sim.h.length; i++) avg += sim.h[i];
    avg /= sim.h.length;
    const hgt = Math.max(0.2, avg);
    this.body.scale.y = hgt;
    this.body.position.y = hgt * 0.5;
  }
}
