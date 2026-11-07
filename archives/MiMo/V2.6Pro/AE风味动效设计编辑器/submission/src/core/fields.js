// 空间场：距离衰减、噪声、旋涡，可混合并影响顶点/实例/粒子/材质
import { noise3, clamp, lerp } from './math.js';

export class Field {
  constructor(opts = {}) {
    this.name = opts.name || '场';
    this.type = opts.type || 'falloff'; // falloff | noise | vortex | turbulence | attract
    this.position = opts.position || [0, 0, 0];
    this.radius = opts.radius ?? 300;
    this.falloff = opts.falloff ?? 1; // 0=硬 1=软
    this.strength = opts.strength ?? 1;
    this.direction = opts.direction || [0, 1, 0];
    this.frequency = opts.frequency ?? 0.02;
    this.amplitude = opts.amplitude ?? 40;
    this.axis = opts.axis || [0, 1, 0];
    this.seed = opts.seed ?? 1;
    this.enabled = opts.enabled !== false;
    this.blend = opts.blend || 'add'; // add | multiply | max | min | override
    this.target = opts.target || 'all'; // vertices | instances | particles | materials | all
  }

  // 权重：0-1，按到中心距离衰减
  weightAt(x, y, z) {
    const dx = x - this.position[0], dy = y - this.position[1], dz = z - this.position[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d >= this.radius) return 0;
    const u = d / this.radius;
    // 平滑衰减
    const f = this.falloff;
    return Math.pow(1 - u, 1 + f * 3);
  }

  // 返回对某点的位移/力
  sample(x, y, z, t = 0) {
    if (!this.enabled) return [0, 0, 0];
    const w = this.weightAt(x, y, z);
    if (w <= 0) return [0, 0, 0];
    switch (this.type) {
      case 'falloff': {
        const dx = x - this.position[0], dy = y - this.position[1], dz = z - this.position[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const s = this.strength * w;
        return [-dx / d * s, -dy / d * s, -dz / d * s];
      }
      case 'noise': {
        const nx = noise3(x * this.frequency, y * this.frequency, t * 0.7 + z * this.frequency, this.seed);
        const ny = noise3(x * this.frequency + 31.4, y * this.frequency + 17.2, t * 0.7 + z * this.frequency, this.seed + 1);
        const nz = noise3(x * this.frequency + 11.1, y * this.frequency + 53.7, t * 0.7 + z * this.frequency, this.seed + 2);
        return [nx * this.amplitude * w, ny * this.amplitude * w, nz * this.amplitude * w];
      }
      case 'turbulence': {
        const n1 = Math.abs(noise3(x * this.frequency, y * this.frequency, t + z * this.frequency, this.seed));
        const n2 = noise3(x * this.frequency * 2.1, y * this.frequency * 2.1, t * 1.3, this.seed + 5);
        return [n2 * this.amplitude * w, n1 * this.amplitude * w * (this.direction[1] || 1), n2 * this.amplitude * w * 0.5];
      }
      case 'vortex': {
        const dx = x - this.position[0], dy = y - this.position[1], dz = z - this.position[2];
        const ax = this.axis;
        // 绕轴切向
        const rx = dy * ax[2] - dz * ax[1];
        const ry = dz * ax[0] - dx * ax[2];
        const rz = dx * ax[1] - dy * ax[0];
        const l = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
        const s = this.strength * w;
        return [(rx / l) * s, (ry / l) * s, (rz / l) * s];
      }
      case 'attract': {
        const dx = this.position[0] - x, dy = this.position[1] - y, dz = this.position[2] - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const s = (this.strength * w) / Math.max(50, d);
        return [dx * s, dy * s, dz * s];
      }
      default:
        return [0, 0, 0];
    }
  }

  // 叠加多个场
  static combine(fields, x, y, z, t, target) {
    const out = [0, 0, 0];
    for (const f of fields) {
      if (!f.enabled) continue;
      if (target && f.target !== 'all' && f.target !== target) continue;
      const d = f.sample(x, y, z, t);
      if (f.blend === 'multiply') {
        out[0] *= 1 + d[0] * 0.01;
        out[1] *= 1 + d[1] * 0.01;
        out[2] *= 1 + d[2] * 0.01;
      } else if (f.blend === 'max') {
        out[0] = Math.abs(d[0]) > Math.abs(out[0]) ? d[0] : out[0];
        out[1] = Math.abs(d[1]) > Math.abs(out[1]) ? d[1] : out[1];
        out[2] = Math.abs(d[2]) > Math.abs(out[2]) ? d[2] : out[2];
      } else {
        out[0] += d[0];
        out[1] += d[1];
        out[2] += d[2];
      }
    }
    return out;
  }

  // 影响材质参数（如粗糙度/发光）
  sampleMaterial(x, y, z, t) {
    const w = this.weightAt(x, y, z);
    return {
      weight: w,
      roughnessDelta: w * this.strength * 0.3 * noise3(x * 0.01, y * 0.01, t, this.seed),
      emissiveDelta: w * this.strength * 0.5,
    };
  }
}

// 场对网格顶点变形
export function deformMeshWithFields(mesh, fields, t) {
  const positions = new Float32Array(mesh.positions.length);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const d = Field.combine(fields, mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2], t, 'vertices');
    positions[i] = mesh.positions[i] + d[0];
    positions[i + 1] = mesh.positions[i + 1] + d[1];
    positions[i + 2] = mesh.positions[i + 2] + d[2];
  }
  return { ...mesh, positions: Array.from(positions) };
}
