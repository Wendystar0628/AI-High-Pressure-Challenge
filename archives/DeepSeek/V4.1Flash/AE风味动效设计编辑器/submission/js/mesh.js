/* PRISM mesh: extrusion, parametric solids, instances, deformers, pins, fields, collisions */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, G = AE.G, T = AE.T;
  const Mesh = (AE.Mesh = {});

  Mesh.empty = () => ({ pos: new Float32Array(0), nrm: new Float32Array(0), uv: new Float32Array(0), region: new Float32Array(0), idx: new Uint32Array(0), bbox: { min: [0, 0, 0], max: [0, 0, 0] } });
  Mesh.computeBBox = (m) => {
    if (!m.pos.length) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0] };
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], m.pos[i + k]); max[k] = Math.max(max[k], m.pos[i + k]); }
    return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
  };
  Mesh.computeNormals = (m) => {
    const nrm = new Float32Array(m.pos.length);
    for (let i = 0; i < m.idx.length; i += 3) {
      const ia = m.idx[i] * 3, ib = m.idx[i + 1] * 3, ic = m.idx[i + 2] * 3;
      const ax = m.pos[ia], ay = m.pos[ia + 1], az = m.pos[ia + 2];
      const bx = m.pos[ib], by = m.pos[ib + 1], bz = m.pos[ib + 2];
      const cx = m.pos[ic], cy = m.pos[ic + 1], cz = m.pos[ic + 2];
      const e1 = [bx - ax, by - ay, bz - az], e2 = [cx - ax, cy - ay, cz - az];
      const n = M.cross(e1, e2);
      for (const off of [ia, ib, ic]) { nrm[off] += n[0]; nrm[off + 1] += n[1]; nrm[off + 2] += n[2]; }
    }
    for (let i = 0; i < nrm.length; i += 3) {
      const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
      nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
    }
    m.nrm = nrm;
    return m;
  };
  Mesh.transform = (m, matrix) => {
    const nm = M.invertRotScale(matrix);
    const pos = new Float32Array(m.pos.length), nrm = new Float32Array(m.nrm.length);
    for (let i = 0; i < pos.length; i += 3) {
      const p = M.transformPoint(matrix, [m.pos[i], m.pos[i + 1], m.pos[i + 2]]);
      pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2];
      const n = M.transformDir(nm, [m.nrm[i], m.nrm[i + 1], m.nrm[i + 2]]);
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      nrm[i] = n[0] / l; nrm[i + 1] = n[1] / l; nrm[i + 2] = n[2] / l;
    }
    return { ...m, pos, nrm, bbox: Mesh.computeBBox({ pos }) };
  };
  Mesh.merge = (list) => {
    const valid = list.filter(m => m && m.pos && m.pos.length);
    if (!valid.length) return Mesh.empty();
    let vcount = 0, icount = 0;
    for (const m of valid) { vcount += m.pos.length / 3; icount += m.idx.length; }
    const pos = new Float32Array(vcount * 3), nrm = new Float32Array(vcount * 3), uv = new Float32Array(vcount * 2), region = new Float32Array(vcount);
    const idx = new Uint32Array(icount);
    let vo = 0, io = 0;
    for (const m of valid) {
      pos.set(m.pos, vo * 3); nrm.set(m.nrm, vo * 3); uv.set(m.uv, vo * 2); region.set(m.region, vo);
      for (let i = 0; i < m.idx.length; i++) idx[io + i] = m.idx[i] + vo;
      vo += m.pos.length / 3; io += m.idx.length;
    }
    return { pos, nrm, uv, region, idx, bbox: Mesh.computeBBox({ pos }) };
  };
  function meshFrom(pos, nrm, uv, region, idx) {
    const m = { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), region: new Float32Array(region), idx: new Uint32Array(idx) };
    m.bbox = Mesh.computeBBox(m);
    return m;
  }
  Mesh.fromData = meshFrom;

  // ---------- planes / basic solids ----------
  Mesh.plane = (w, h, nx = 1, ny = 1) => {
    const pos = [], nrm = [], uv = [], reg = [], idx = [];
    for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
      const u = x / nx, v = y / ny;
      pos.push((u - .5) * w, (v - .5) * h, 0); nrm.push(0, 0, 1); uv.push(u, 1 - v); reg.push(0);
    }
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const a = y * (nx + 1) + x, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    return meshFrom(pos, nrm, uv, reg, idx);
  };
  Mesh.box = (w, h, d, sep = 1) => {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const faces = [
      { n: [0, 0, 1], v: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
      { n: [0, 0, -1], v: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] },
      { n: [1, 0, 0], v: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
      { n: [-1, 0, 0], v: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] },
      { n: [0, 1, 0], v: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
      { n: [0, -1, 0], v: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] }
    ];
    const pos = [], nrm = [], uv = [], reg = [], idx = [];
    for (const f of faces) {
      const base = pos.length / 3;
      for (const v of f.v) { pos.push(v[0], v[1], v[2]); nrm.push(f.n[0], f.n[1], f.n[2]); uv.push((v[0] + hw) / w, (v[1] + hh) / h); reg.push(0); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return meshFrom(pos, nrm, uv, reg, idx);
  };
  Mesh.sphere = (r, seg = 24, rings = 16) => {
    const pos = [], nrm = [], uv = [], reg = [], idx = [];
    for (let y = 0; y <= rings; y++) for (let x = 0; x <= seg; x++) {
      const u = x / seg, v = y / rings;
      const phi = v * Math.PI, theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta), ny = -Math.cos(phi), nz = Math.sin(phi) * Math.sin(theta);
      pos.push(nx * r, ny * r, nz * r); nrm.push(nx, ny, nz); uv.push(u, v); reg.push(0);
    }
    for (let y = 0; y < rings; y++) for (let x = 0; x < seg; x++) {
      const a = y * (seg + 1) + x, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    return meshFrom(pos, nrm, uv, reg, idx);
  };
  Mesh.torus = (R, r, seg = 48, ring = 18) => {
    const pos = [], nrm = [], uv = [], reg = [], idx = [];
    for (let i = 0; i <= seg; i++) for (let j = 0; j <= ring; j++) {
      const u = i / seg * Math.PI * 2, v = j / ring * Math.PI * 2;
      const cx = Math.cos(u), cy = Math.sin(u);
      const nx = Math.cos(v) * cx, ny = Math.cos(v) * cy, nz = Math.sin(v);
      pos.push((R + r * Math.cos(v)) * cx, (R + r * Math.cos(v)) * cy, r * Math.sin(v));
      nrm.push(nx, ny, nz); uv.push(i / seg, j / ring); reg.push(0);
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < ring; j++) {
      const a = i * (ring + 1) + j, b = a + 1, c = a + ring + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    return meshFrom(pos, nrm, uv, reg, idx);
  };
  Mesh.cylinder = (r, h, seg = 20, caps = true) => {
    const pos = [], nrm = [], uv = [], reg = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
      pos.push(x, -h / 2, y); nrm.push(Math.cos(a), 0, Math.sin(a)); uv.push(i / seg, 0); reg.push(2);
      pos.push(x, h / 2, y); nrm.push(Math.cos(a), 0, Math.sin(a)); uv.push(i / seg, 1); reg.push(2);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    if (caps) {
      for (const sign of [-1, 1]) {
        const base = pos.length / 3;
        pos.push(0, sign * h / 2, 0); nrm.push(0, sign, 0); uv.push(.5, .5); reg.push(sign > 0 ? 0 : 1);
        for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pos.push(Math.cos(a) * r, sign * h / 2, Math.sin(a) * r); nrm.push(0, sign, 0); uv.push(.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5); reg.push(sign > 0 ? 0 : 1); }
        for (let i = 0; i < seg; i++) { if (sign > 0) idx.push(base, base + 1 + i, base + 2 + i); else idx.push(base, base + 2 + i, base + 1 + i); }
      }
    }
    return meshFrom(pos, nrm, uv, reg, idx);
  };
  Mesh.ringPath = (R, tube, seg = 64, sides = 8) => Mesh.torus(R, tube, seg, sides);

  // ---------- extrusion ----------
  Mesh.extrudeShape = (shape, opts = {}) => {
    const depth = Math.max(.01, opts.depth == null ? 40 : opts.depth);
    const bevel = Math.min(opts.bevel || 0, depth / 2.2);
    const bevelSteps = bevel > .5 ? 2 : 0;
    const contours = shape.contours.filter(c => c.verts && c.verts.length > 2);
    if (!contours.length) return Mesh.empty();
    const flat = contours.map(c => G.sampleContour(c, 12));
    const zf = depth / 2, zb = -depth / 2;
    const pos = [], nrm = [], uv = [], reg = [], idx = [];
    const b = G.bounds(shape);
    const uvf = (x, y) => [(x - b.x) / (b.w || 1), 1 - (y - b.y) / (b.h || 1)];
    // inset silhouette for the actual cap rim
    const capContours = bevel > .5 ? flat.map((pts) => {
      const area = G.polyArea(pts);
      if (area < 0) return pts.slice();
      return pts.map((p, i) => insetPoint(pts, i, bevel, -1));
    }) : flat;
    // caps
    const cap = G.triangulate2D(capContours);
    function addCap(z, flip, region) {
      const base = pos.length / 3;
      for (let i = 0; i < cap.positions.length; i += 2) {
        const x = cap.positions[i], y = cap.positions[i + 1];
        pos.push(x, y, z); nrm.push(0, 0, flip ? -1 : 1);
        const u = uvf(x, y); uv.push(u[0], u[1]); reg.push(region);
      }
      for (let i = 0; i < cap.indices.length; i += 3) {
        const a = cap.indices[i], bb = cap.indices[i + 1], c = cap.indices[i + 2];
        if (flip) idx.push(base + a, base + c, base + bb); else idx.push(base + a, base + bb, base + c);
      }
    }
    addCap(zf, false, 0);
    addCap(zb, true, 1);
    // side walls and bevel
    for (let ci = 0; ci < contours.length; ci++) {
      const pts = flat[ci];
      const n = pts.length;
      const area = G.polyArea(pts);
      const dir = area > 0 ? 1 : -1; // outward normal sign
      const hasBevel = bevel > .5 && area > 0;
      const rim = hasBevel ? capContours[ci] : null;
      for (let i = 0; i < n; i++) {
        const a = pts[i], c2 = pts[(i + 1) % n];
        if (Math.hypot(c2[0] - a[0], c2[1] - a[1]) < .001) continue;
        const dx = c2[0] - a[0], dy = c2[1] - a[1], l = Math.hypot(dx, dy);
        let nx = dy / l * dir, ny = -dx / l * dir;
        // side wall, between the two bevel roots
        const z0 = zb + (hasBevel ? bevel : 0), z1 = zf - (hasBevel ? bevel : 0);
        const base = pos.length / 3;
        pos.push(a[0], a[1], z0, c2[0], c2[1], z0, c2[0], c2[1], z1, a[0], a[1], z1);
        for (let k = 0; k < 4; k++) { nrm.push(nx, ny, 0); }
        uv.push(0, 0, 1, 0, 1, 1, 0, 1); reg.push(2);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        if (hasBevel) {
          for (const end of [0, 1]) {
            const zA = end ? z1 : z0, zB = end ? zf : zb;
            const dirZ = end ? 1 : -1;
            const insetA = rim[i], insetB = rim[(i + 1) % n];
            const base2 = pos.length / 3;
            pos.push(a[0], a[1], zA, c2[0], c2[1], zA, insetB[0], insetB[1], zB, insetA[0], insetA[1], zB);
            for (let k = 0; k < 4; k++) nrm.push(nx * .7, ny * .7, dirZ * .7);
            uv.push(0, end ? 1 : 0, 1, end ? 1 : 0, 1, end ? 1 : 0, 0, end ? 1 : 0); reg.push(3);
            if (end) idx.push(base2, base2 + 1, base2 + 2, base2, base2 + 2, base2 + 3);
            else idx.push(base2, base2 + 2, base2 + 1, base2, base2 + 3, base2 + 2);
          }
        }
      }
    }
    return meshFrom(pos, nrm, uv, reg, idx);
  };
  function insetPoint(pts, i, amount, sign) {
    const n = pts.length, p = pts[i], a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n];
    const d1 = [p[0] - a[0], p[1] - a[1]], d2 = [c[0] - p[0], c[1] - p[1]];
    const l1 = Math.hypot(d1[0], d1[1]) || 1, l2 = Math.hypot(d2[0], d2[1]) || 1;
    let n1 = [d1[1] / l1, -d1[0] / l1], n2 = [d2[1] / l2, -d2[0] / l2];
    let nx = (n1[0] + n2[0]) / 2, ny = (n1[1] + n2[1]) / 2;
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    return [p[0] + nx * amount * sign, p[1] + ny * amount * sign];
  }
  Mesh.insetPoint = insetPoint;

  // extruded text
  Mesh.extrudeText = (layout, opts = {}) => {
    if (opts.useOutline !== false) {
      const shape = T.outlineShape(layout, {});
      if (!shape.contours.length) return Mesh.empty();
      return Mesh.extrudeShape(shape, opts);
    }
    const shape = T.outlineShape(layout, {});
    return Mesh.extrudeShape(shape, opts);
  };

  // ---------- instances ----------
  Mesh.instances = (base, placements, opts = {}) => {
    const list = [];
    for (const p of placements) {
      const s = p.scale == null ? (opts.scale || 1) : p.scale;
      let m = M.fromTRS(p.pos || [0, 0, 0], p.rot || [0, 0, 0], [s * 100, s * 100, s * 100]);
      if (p.matrix) m = p.matrix;
      list.push(Mesh.transform(base, m));
    }
    return Mesh.merge(list);
  };
  Mesh.placeAlongPath = (points, opts = {}) => {
    const out = [];
    const closed = opts.closed !== false;
    const total = points.length;
    const count = opts.count || total;
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / count : 0;
      const idx = U.clamp(Math.floor(t * total), 0, total - 1);
      const a = points[idx], b = points[(idx + 1) % total];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      out.push({ pos: [a[0], a[1], opts.z || 0], rot: [opts.rotX || 0, opts.rotY || 0, ang] });
    }
    return out;
  };

  // ---------- deformation ----------
  Mesh.applyBend = (m, amount = 45, axis = 'y') => {
    const b = Mesh.computeBBox(m);
    const pos = new Float32Array(m.pos);
    const ang = U.rad(amount);
    if (axis === 'y') {
      for (let i = 0; i < pos.length; i += 3) {
        const t = (pos[i + 1] - b.min[1]) / (b.size[1] || 1);
        const a = (t - .5) * ang;
        const x = pos[i] - b.center[0], y = pos[i + 1] - b.center[1], z = pos[i + 2] - b.center[2];
        pos[i] = b.center[0] + x * Math.cos(a) - z * Math.sin(a);
        pos[i + 2] = b.center[2] + x * Math.sin(a) + z * Math.cos(a);
      }
    } else if (axis === 'x') {
      for (let i = 0; i < pos.length; i += 3) {
        const t = (pos[i] - b.min[0]) / (b.size[0] || 1);
        const a = (t - .5) * ang;
        const x = pos[i] - b.center[0], y = pos[i + 1] - b.center[1], z = pos[i + 2] - b.center[2];
        pos[i + 1] = b.center[1] + y * Math.cos(a) - z * Math.sin(a);
        pos[i + 2] = b.center[2] + y * Math.sin(a) + z * Math.cos(a);
      }
    } else {
      for (let i = 0; i < pos.length; i += 3) {
        const t = (pos[i + 2] - b.min[2]) / (b.size[2] || 1);
        const a = (t - .5) * ang;
        const x = pos[i] - b.center[0], y = pos[i + 1] - b.center[1];
        pos[i] = b.center[0] + x * Math.cos(a) - y * Math.sin(a);
        pos[i + 1] = b.center[1] + x * Math.sin(a) + y * Math.cos(a);
      }
    }
    const nm = { ...m, pos };
    Mesh.computeNormals(nm);
    nm.bbox = Mesh.computeBBox(nm);
    return nm;
  };
  Mesh.applyTwist = (m, amount = 90, axis = 'y') => {
    const b = Mesh.computeBBox(m);
    const pos = new Float32Array(m.pos);
    const ang = U.rad(amount);
    for (let i = 0; i < pos.length; i += 3) {
      const t = axis === 'y' ? (pos[i + 1] - b.min[1]) / (b.size[1] || 1) : (pos[i + 2] - b.min[2]) / (b.size[2] || 1);
      const a = (t - .5) * ang;
      const x = pos[i] - b.center[0], z = pos[i + 2] - b.center[2];
      if (axis === 'y') {
        pos[i] = b.center[0] + x * Math.cos(a) - z * Math.sin(a);
        pos[i + 2] = b.center[2] + x * Math.sin(a) + z * Math.cos(a);
      } else {
        const y = pos[i + 1] - b.center[1];
        pos[i] = b.center[0] + x * Math.cos(a) - y * Math.sin(a);
        pos[i + 1] = b.center[1] + x * Math.sin(a) + y * Math.cos(a);
      }
    }
    const nm = { ...m, pos };
    Mesh.computeNormals(nm);
    nm.bbox = Mesh.computeBBox(nm);
    return nm;
  };
  Mesh.applyField = (m, fields, time) => {
    if (!fields || !fields.length) return m;
    const pos = new Float32Array(m.pos);
    for (let i = 0; i < pos.length; i += 3) {
      const p = [pos[i], pos[i + 1], pos[i + 2]];
      for (const f of fields) {
        const d = Mesh.fieldAt(f, p, time);
        pos[i] += d[0]; pos[i + 1] += d[1]; pos[i + 2] += d[2];
      }
    }
    const nm = { ...m, pos };
    Mesh.computeNormals(nm);
    nm.bbox = Mesh.computeBBox(nm);
    return nm;
  };
  Mesh.fieldAt = (f, p, time) => {
    const strength = f.strength == null ? 50 : f.strength;
    const radius = f.radius || 300;
    const timeScale = f.speed == null ? 1 : f.speed;
    const t = time * timeScale;
    let dx = 0, dy = 0, dz = 0;
    const c = f.position || [0, 0, 0];
    const v = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    const dist = Math.hypot(v[0], v[1], v[2]);
    const falloff = f.falloff || 'smooth';
    let w = 1 - U.clamp(dist / radius);
    if (falloff === 'linear') w = Math.max(0, 1 - dist / radius);
    else if (falloff === 'constant') w = dist < radius ? 1 : 0;
    else if (falloff === 'sharp') w = Math.pow(Math.max(0, 1 - dist / radius), 3);
    else w = U.smoothstep(0, 1, 1 - dist / radius);
    w *= f.weight == null ? 1 : f.weight;
    if (f.type === 'vortex') {
      const axis = f.axis || 'z';
      if (axis === 'z') { dx += -v[1] * 0.02 * strength * w; dy += v[0] * 0.02 * strength * w; }
      else if (axis === 'y') { dx += -v[2] * 0.02 * strength * w; dz += v[0] * 0.02 * strength * w; }
      else { dy += -v[2] * 0.02 * strength * w; dz += v[1] * 0.02 * strength * w; }
    } else if (f.type === 'noise') {
      const sc = (f.scale || 1) * 0.004;
      const n1 = U.noise3(p[0] * sc + t * .4, p[1] * sc, p[2] * sc);
      const n2 = U.noise3(p[0] * sc + 17, p[1] * sc + t * .35, p[2] * sc + 5);
      const n3 = U.noise3(p[0] * sc + 5, p[1] * sc + 9, p[2] * sc + t * .3);
      dx += n1 * strength * w; dy += n2 * strength * w; dz += n3 * strength * w;
    } else if (f.type === 'distance') {
      const l = dist || 1;
      const push = strength * w * (f.invert ? -1 : 1);
      dx += v[0] / l * push; dy += v[1] / l * push; dz += v[2] / l * push;
    } else if (f.type === 'direction') {
      const dir = f.direction || [1, 0, 0];
      dx += dir[0] * strength * w; dy += dir[1] * strength * w; dz += dir[2] * strength * w;
    } else if (f.type === 'wave') {
      const phase = dist * .03 - t * 3;
      dx += Math.sin(phase) * strength * w * .002 * (p[0] - c[0]);
      dy += Math.sin(phase) * strength * w * .002 * (p[1] - c[1]);
    }
    return [dx, dy, dz];
  };
  Mesh.fieldMagnitude = (f, p, time) => M.len(Mesh.fieldAt(f, p, time));

  // pins: rest points with per-vertex influence; maintains rigid interior
  Mesh.applyPins = (m, pins, opts = {}) => {
    if (!pins || !pins.length) return m;
    const pos = new Float32Array(m.pos);
    const rest = m.pos.slice(0);
    for (let i = 0; i < pos.length; i += 3) {
      const p = [rest[i], rest[i + 1], rest[i + 2]];
      let wx = 0, wy = 0, wz = 0, wsum = 0;
      for (const pin of pins) {
        const r = pin.radius == null ? 220 : pin.radius;
        const d = Math.hypot(p[0] - pin.rest[0], p[1] - pin.rest[1], p[2] - pin.rest[2]);
        let w = 1 - U.smoothstep(0, r, d);
        if (w <= 0) continue;
        const rigidity = pin.rigidity == null ? .55 : pin.rigidity;
        w = Math.pow(w, 1 + rigidity * 2.5);
        const off = pin.offset || [0, 0, 0];
        const rot = pin.rot || [0, 0, 0];
        const s = pin.scale == null ? 1 : pin.scale;
        let q = [p[0] - pin.rest[0], p[1] - pin.rest[1], p[2] - pin.rest[2]];
        q = M.transformDir(M.fromTRS([0, 0, 0], rot, [s * 100, s * 100, s * 100]), q);
        const tx = pin.rest[0] + q[0] + off[0], ty = pin.rest[1] + q[1] + off[1], tz = pin.rest[2] + q[2] + off[2];
        wx += (tx - p[0]) * w; wy += (ty - p[1]) * w; wz += (tz - p[2]) * w; wsum += w;
      }
      if (wsum > 0) {
        const norm = Math.min(1, wsum) / wsum;
        pos[i] += wx * norm; pos[i + 1] += wy * norm; pos[i + 2] += wz * norm;
      }
    }
    const nm = { ...m, pos };
    Mesh.computeNormals(nm);
    nm.bbox = Mesh.computeBBox(nm);
    return nm;
  };

  // ---------- collision ----------
  Mesh.triangles = (m, matrix) => {
    const tris = [];
    const pos = m.pos, idx = m.idx;
    for (let i = 0; i < idx.length; i += 3) {
      let a = [pos[idx[i] * 3], pos[idx[i] * 3 + 1], pos[idx[i] * 3 + 2]];
      let b = [pos[idx[i + 1] * 3], pos[idx[i + 1] * 3 + 1], pos[idx[i + 1] * 3 + 2]];
      let c = [pos[idx[i + 2] * 3], pos[idx[i + 2] * 3 + 1], pos[idx[i + 2] * 3 + 2]];
      if (matrix) { a = M.transformPoint(matrix, a); b = M.transformPoint(matrix, b); c = M.transformPoint(matrix, c); }
      tris.push([a, b, c]);
    }
    return tris;
  };
  Mesh.closestPointOnTri = (p, a, b, c) => {
    const ab = M.sub(b, a), ac = M.sub(c, a), ap = M.sub(p, a);
    const d1 = M.dot(ab, ap), d2 = M.dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return { point: a, bary: [1, 0, 0] };
    const bp = M.sub(p, b), d3 = M.dot(ab, bp), d4 = M.dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return { point: b, bary: [0, 1, 0] };
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return { point: M.add(a, M.mul(ab, v)), bary: [1 - v, v, 0] }; }
    const cp = M.sub(p, c), d5 = M.dot(ab, cp), d6 = M.dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return { point: c, bary: [0, 0, 1] };
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return { point: M.add(a, M.mul(ac, w)), bary: [1 - w, 0, w] }; }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return { point: M.add(b, M.mul(M.sub(c, b), w)), bary: [0, 1 - w, w] }; }
    const denom = 1 / (va + vb + vc);
    const v = vb * denom, w = vc * denom;
    return { point: M.add(a, M.add(M.mul(ab, v), M.mul(ac, w))), bary: [1 - v - w, v, w] };
  };
  Mesh.collideSphere = (center, radius, tris, vel) => {
    let best = null;
    for (const [a, b, c] of tris) {
      const cp = Mesh.closestPointOnTri(center, a, b, c);
      const d = M.dist(cp.point, center);
      if (d < radius) {
        if (!best || d < best.d) {
          let n = M.norm(M.sub(center, cp.point));
          if (M.len(n) < 1e-5) n = M.norm(M.cross(M.sub(b, a), M.sub(c, a)));
          best = { d, point: cp.point, normal: n, tri: [a, b, c] };
        }
      }
    }
    return best;
  };

  // node output geometry: bars along circle etc.
  Mesh.barsAround = (radius, count, len, thick, height, opts = {}) => {
    const list = [];
    const base = Mesh.box(thick, len, height);
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + (opts.rotation || 0);
      const r = radius + (opts.radiusWave ? Math.sin(i * .7) * opts.radiusWave : 0);
      const p = [Math.cos(a) * r, Math.sin(a) * r, 0];
      const rot = [0, 0, a + Math.PI / 2];
      const sc = opts.scaleFn ? opts.scaleFn(i) : 1;
      list.push(Mesh.transform(base, M.fromTRS(p, rot, [100 * sc, 100 * sc, 100 * sc])));
    }
    return Mesh.merge(list);
  };

  Mesh.Length = (m) => m && m.pos ? m.pos.length / 3 : 0;
  Mesh.TriangleCount = (m) => m && m.idx ? m.idx.length / 3 : 0;
  AE.Mesh = Mesh;
})();
