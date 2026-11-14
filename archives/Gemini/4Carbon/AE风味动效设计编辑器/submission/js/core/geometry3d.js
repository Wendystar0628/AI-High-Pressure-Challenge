/**
 * Forge Studio — 3D Beveled Extrusion, Parametric Meshes, Spatial Fields (2.8),
 * 3D Deformers (Bend, Twist, Field Displace), Normal Recomputation & Raycasting
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, lerp, smoothstep, DEG2RAD, fbm3DVec, Vec2, Vec3, Mat4 } = Forge.Math;
  const Geo2D = Forge.Geo2D;

  // Mesh3D format:
  // {
  //   positions: Float32Array (3 * V),
  //   normals:   Float32Array (3 * V),
  //   uvs:       Float32Array (2 * V),
  //   indices:   Uint32Array  (3 * T),
  //   bounds:    { min: [x,y,z], max: [x,y,z] }
  // }

  function cloneMesh3D(mesh) {
    return {
      positions: new Float32Array(mesh.positions),
      normals: new Float32Array(mesh.normals),
      uvs: new Float32Array(mesh.uvs),
      indices: new Uint32Array(mesh.indices),
      bounds: mesh.bounds
        ? { min: [...mesh.bounds.min], max: [...mesh.bounds.max] }
        : computeMeshBounds(mesh.positions)
    };
  }

  function computeMeshBounds(positions) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    if (!Number.isFinite(minX)) {
      return { min: [-1, -1, -1], max: [1, 1, 1] };
    }
    return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  }

  // Recompute vertex normals after vertex deformation (preserving hard creases via split vertices already in mesh!)
  function recomputeMeshNormals(mesh) {
    const pos = mesh.positions;
    const idx = mesh.indices;
    const nrm = mesh.normals && mesh.normals.length === pos.length
      ? mesh.normals
      : new Float32Array(pos.length);
    nrm.fill(0);

    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3;
      const ax = pos[i0], ay = pos[i0 + 1], az = pos[i0 + 2];
      const bx = pos[i1] - ax, by = pos[i1 + 1] - ay, bz = pos[i1 + 2] - az;
      const cx = pos[i2] - ax, cy = pos[i2 + 1] - ay, cz = pos[i2 + 2] - az;
      // Area-weighted face normal (B - A) x (C - A)
      const nx = by * cz - bz * cy;
      const ny = bz * cx - bx * cz;
      const nz = bx * cy - by * cx;

      nrm[i0] += nx; nrm[i0 + 1] += ny; nrm[i0 + 2] += nz;
      nrm[i1] += nx; nrm[i1 + 1] += ny; nrm[i1 + 2] += nz;
      nrm[i2] += nx; nrm[i2 + 1] += ny; nrm[i2 + 2] += nz;
    }

    for (let i = 0; i < nrm.length; i += 3) {
      const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]);
      if (l > 1e-8) {
        nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
      } else {
        nrm[i] = 0; nrm[i + 1] = 0; nrm[i + 2] = -1;
      }
    }
    mesh.normals = nrm;
    mesh.bounds = computeMeshBounds(pos);
    return mesh;
  }

  // Merge multiple Mesh3D objects into one
  function mergeMeshes3D(meshes) {
    const valid = (meshes || []).filter((m) => m && m.positions && m.positions.length > 0);
    if (valid.length === 0) {
      return {
        positions: new Float32Array(0),
        normals: new Float32Array(0),
        uvs: new Float32Array(0),
        indices: new Uint32Array(0),
        bounds: { min: [0, 0, 0], max: [0, 0, 0] }
      };
    }
    if (valid.length === 1) return cloneMesh3D(valid[0]);

    let totalV = 0, totalI = 0;
    for (const m of valid) {
      totalV += m.positions.length / 3;
      totalI += m.indices.length;
    }

    const positions = new Float32Array(totalV * 3);
    const normals = new Float32Array(totalV * 3);
    const uvs = new Float32Array(totalV * 2);
    const indices = new Uint32Array(totalI);

    let vOff = 0, iOff = 0;
    for (const m of valid) {
      const vc = m.positions.length / 3;
      positions.set(m.positions, vOff * 3);
      normals.set(m.normals, vOff * 3);
      if (m.uvs && m.uvs.length === vc * 2) uvs.set(m.uvs, vOff * 2);
      for (let k = 0; k < m.indices.length; k++) {
        indices[iOff + k] = m.indices[k] + vOff;
      }
      vOff += vc;
      iOff += m.indices.length;
    }
    return {
      positions,
      normals,
      uvs,
      indices,
      bounds: computeMeshBounds(positions)
    };
  }

  function transformMesh3D(mesh, mat4) {
    const out = cloneMesh3D(mesh);
    const invTrans = Mat4.transpose(Mat4.invert(mat4));
    const p = out.positions;
    const n = out.normals;
    for (let i = 0; i < p.length; i += 3) {
      const tp = Mat4.transformPoint(mat4, [p[i], p[i + 1], p[i + 2]]);
      p[i] = tp[0]; p[i + 1] = tp[1]; p[i + 2] = tp[2];
      const tn = Vec3.norm(Mat4.transformDir(invTrans, [n[i], n[i + 1], n[i + 2]]));
      n[i] = tn[0]; n[i + 1] = tn[1]; n[i + 2] = tn[2];
    }
    out.bounds = computeMeshBounds(p);
    return out;
  }

  // =========================================================================
  // WATERTIGHT 3D BEVELED EXTRUSION ENGINE (Section 2.11)
  // Preserves concavities & holes, builds front/back caps, multi-segment bevels,
  // side walls, smooth bevel normals & crisp crease normals, and interior tessellation!
  // =========================================================================
  function computeRingOutwardMiterNormals(pts) {
    const n = pts.length;
    const normals = new Array(n);
    const maxSafes = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const e0 = Vec2.sub(curr, prev);
      const e1 = Vec2.sub(next, curr);
      const l0 = Vec2.len(e0);
      const l1 = Vec2.len(e1);
      const d0 = l0 > 1e-5 ? [e0[0] / l0, e0[1] / l0] : [1, 0];
      const d1 = l1 > 1e-5 ? [e1[0] / l1, e1[1] / l1] : d0;
      // Outward normal for signedArea>0 outer & signedArea<0 hole is [dy, -dx]!
      const n0 = [d0[1], -d0[0]];
      const n1 = [d1[1], -d1[0]];
      const sum = Vec2.add(n0, n1);
      const sLen = Vec2.len(sum);
      if (sLen < 1e-4) {
        normals[i] = n0;
      } else {
        const unit = [sum[0] / sLen, sum[1] / sLen];
        const cosHalf = clamp(Vec2.dot(unit, n0), 0.42, 1.0); // miter clamp ~2.38x
        normals[i] = [unit[0] / cosHalf, unit[1] / cosHalf];
      }
      maxSafes[i] = Math.min(l0, l1) * 0.42;
    }
    return { normals, maxSafes };
  }

  function densifyClosedRing(pts, maxSegLen = 18) {
    if (pts.length < 3 || maxSegLen <= 0) return pts;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const d = Vec2.dist(a, b);
      const steps = Math.max(1, Math.min(16, Math.ceil(d / maxSegLen)));
      for (let k = 0; k < steps; k++) {
        out.push(Vec2.lerp(a, b, k / steps));
      }
    }
    return out;
  }

  function extrudeContours3D(rawContours, {
    extrudeDepth = 48,
    bevelDepth = 5,
    bevelWidth = 4.5,
    bevelSegments = 2,
    extrudeAlign = 'center', // 'center' -> [-D/2, +D/2], 'back' -> [-D, 0] (grows toward camera -Z from z=0!)
    tessMaxEdge = 20
  } = {}) {
    const normContours = Geo2D.normalizeContourWindings(rawContours || []);
    if (normContours.length === 0) {
      return mergeMeshes3D([]);
    }

    const totalDepth = Math.max(0.2, extrudeDepth);
    const bSegs = bevelDepth > 0.05 && bevelWidth > 0.05 ? clamp(Math.round(bevelSegments), 1, 5) : 0;
    const effBevelZ = bSegs > 0 ? Math.min(bevelDepth, totalDepth * 0.46) : 0;
    const effBevelW = bSegs > 0 ? Math.max(0, bevelWidth) : 0;

    const zFront = extrudeAlign === 'back' ? -totalDepth : -totalDepth * 0.5;
    const zBack = extrudeAlign === 'back' ? 0 : totalDepth * 0.5;

    //Flatten & densify contours so curved bevels and 3D deformations look super smooth
    const rings = [];
    for (const c of normContours) {
      let pts = Geo2D.flattenContour(c, 0.55);
      // Clean tiny duplicate segments
      const cleaned = [];
      for (let i = 0; i < pts.length; i++) {
        const prev = cleaned.length > 0 ? cleaned[cleaned.length - 1] : pts[pts.length - 1];
        if (Vec2.dist(pts[i], prev) > 0.25) cleaned.push(pts[i]);
      }
      if (cleaned.length < 3) continue;
      if (tessMaxEdge > 0) pts = densifyClosedRing(cleaned, tessMaxEdge);
      else pts = cleaned;
      const area = Geo2D.polygonSignedArea(pts);
      if (Math.abs(area) < 0.5) continue;
      const { normals, maxSafes } = computeRingOutwardMiterNormals(pts);
      rings.push({ pts, area, normals, maxSafes });
    }

    if (rings.length === 0) return mergeMeshes3D([]);

    // Compute inset cap contours (when beveled, cap shrinks slightly inward by clamped effBevelW so outer silhouette stays crisp, OR side wall expands slightly; shrinking inward capped by local stroke safety prevents self-intersection!)
    // Actually: expanding side-wall outward by +effBevelW (or half-in/half-out: cap at 0 offset, side wall at +effBevelW*0.65 & cap at -effBevelW*0.35) avoids collapsing thin strokes while giving bold luminous bevels!
    const insetFrac = 0.25;
    const outsetFrac = 0.75;

    const capContours = rings.map((r) => {
      const capPts = r.pts.map((p, i) => {
        const safeIn = Math.min(effBevelW * insetFrac, r.maxSafes[i] * 0.7);
        return [p[0] - r.normals[i][0] * safeIn, p[1] - r.normals[i][1] * safeIn];
      });
      return Geo2D.polylineToContour(capPts, true);
    });

    const bounds2D = Geo2D.computeContoursBounds(capContours);
    const bw = Math.max(1, bounds2D.width);
    const bh = Math.max(1, bounds2D.height);

    // Triangulate cap with holes & optional interior refinement
    const capMesh = Geo2D.triangulateContours(capContours, {
      flattenTol: 0.6,
      refineMaxEdge: tessMaxEdge
    });

    const posArr = [];
    const nrmArr = [];
    const uvArr = [];
    const idxArr = [];

    function pushVert(px, py, pz, nx, ny, nz, u, v) {
      const id = posArr.length / 3;
      posArr.push(px, py, pz);
      nrmArr.push(nx, ny, nz);
      uvArr.push(u, v);
      return id;
    }

    // 1. Front Cap (z = zFront, normal = [0, 0, -1], reversed winding (i0, i2, i1))
    const frontCapBase = posArr.length / 3;
    for (const v of capMesh.vertices) {
      pushVert(
        v[0], v[1], zFront,
        0, 0, -1,
        (v[0] - bounds2D.minX) / bw,
        (v[1] - bounds2D.minY) / bh
      );
    }
    for (let t = 0; t < capMesh.indices.length; t += 3) {
      idxArr.push(
        frontCapBase + capMesh.indices[t],
        frontCapBase + capMesh.indices[t + 2],
        frontCapBase + capMesh.indices[t + 1]
      );
    }

    // 2. Back Cap (z = zBack, normal = [0, 0, +1], winding (i0, i1, i2))
    const backCapBase = posArr.length / 3;
    for (const v of capMesh.vertices) {
      pushVert(
        v[0], v[1], zBack,
        0, 0, 1,
        (v[0] - bounds2D.minX) / bw,
        (v[1] - bounds2D.minY) / bh
      );
    }
    for (let t = 0; t < capMesh.indices.length; t += 3) {
      idxArr.push(
        backCapBase + capMesh.indices[t],
        backCapBase + capMesh.indices[t + 1],
        backCapBase + capMesh.indices[t + 2]
      );
    }

    // 3. Profile stations along Z from Front -> Front Bevel -> Side Wall subdivisions -> Back Bevel -> Back
    // Each station: { z, offsetScale (from -insetFrac to +outsetFrac), nz, nr }
    const stations = [];
    if (bSegs > 0) {
      for (let s = 0; s <= bSegs; s++) {
        const theta = (s / bSegs) * (Math.PI * 0.5); // 0 (front) -> pi/2 (side)
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        stations.push({
          z: zFront + (1 - cosT) * effBevelZ,
          off: lerp(-insetFrac, outsetFrac, sinT) * effBevelW,
          nr: sinT,
          nz: -cosT,
          creaseAfter: s === bSegs && bSegs === 1
        });
      }
    } else {
      stations.push({ z: zFront, off: 0, nr: 1, nz: 0, creaseAfter: false });
    }

    // Side wall intermediate subdivisions so deep extrusions bend/twist smoothly!
    const zSideStart = zFront + effBevelZ;
    const zSideEnd = zBack - effBevelZ;
    const sideSpan = Math.max(0, zSideEnd - zSideStart);
    const sideSteps = tessMaxEdge > 0 ? Math.max(1, Math.min(8, Math.ceil(sideSpan / tessMaxEdge))) : 1;

    // Ensure side wall has pure radial normal [nr=1, nz=0]
    stations.push({ z: zSideStart, off: outsetFrac * (bSegs > 0 ? effBevelW : 0), nr: 1, nz: 0 });
    for (let k = 1; k <= sideSteps; k++) {
      stations.push({
        z: lerp(zSideStart, zSideEnd, k / sideSteps),
        off: outsetFrac * (bSegs > 0 ? effBevelW : 0),
        nr: 1,
        nz: 0
      });
    }

    if (bSegs > 0) {
      for (let s = 0; s <= bSegs; s++) {
        const theta = (s / bSegs) * (Math.PI * 0.5); // 0 (side) -> pi/2 (back)
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        stations.push({
          z: zSideEnd + sinT * effBevelZ,
          off: lerp(outsetFrac, -insetFrac, sinT) * effBevelW,
          nr: cosT,
          nz: sinT
        });
      }
    }

    // Stitch stations around each contour ring
    for (const r of rings) {
      const n = r.pts.length;
      // Compute cumulative perimeter UVs
      const uPerim = new Float32Array(n + 1);
      let accP = 0;
      for (let i = 0; i < n; i++) {
        uPerim[i] = accP / 200;
        accP += Vec2.dist(r.pts[i], r.pts[(i + 1) % n]);
      }
      uPerim[n] = accP / 200;

      for (let st = 0; st < stations.length - 1; st++) {
        const sA = stations[st];
        const sB = stations[st + 1];
        if (Math.abs(sB.z - sA.z) < 1e-5 && Math.abs(sB.off - sA.off) < 1e-5) continue;

        // Check sharp corners along ring: split vertices at sharp 2D corners so side bevel facets stay crisp!
        const rowA = new Int32Array(n + 1);
        const rowB = new Int32Array(n + 1);

        for (let i = 0; i <= n; i++) {
          const idx = i % n;
          const p = r.pts[idx];
          const n2d = r.normals[idx];
          const uN2 = Vec2.norm(n2d);

          const offA = sA.off < 0 ? -Math.min(-sA.off, r.maxSafes[idx] * 0.7) : sA.off;
          const offB = sB.off < 0 ? -Math.min(-sB.off, r.maxSafes[idx] * 0.7) : sB.off;

          const nA = Vec3.norm([uN2[0] * sA.nr, uN2[1] * sA.nr, sA.nz]);
          const nB = Vec3.norm([uN2[0] * sB.nr, uN2[1] * sB.nr, sB.nz]);

          rowA[i] = pushVert(
            p[0] + n2d[0] * offA,
            p[1] + n2d[1] * offA,
            sA.z,
            nA[0], nA[1], nA[2],
            uPerim[i],
            (sA.z - zFront) / totalDepth
          );
          rowB[i] = pushVert(
            p[0] + n2d[0] * offB,
            p[1] + n2d[1] * offB,
            sB.z,
            nB[0], nB[1], nB[2],
            uPerim[i],
            (sB.z - zFront) / totalDepth
          );
        }

        for (let i = 0; i < n; i++) {
          const a0 = rowA[i], a1 = rowA[i + 1];
          const b0 = rowB[i], b1 = rowB[i + 1];
          idxArr.push(a0, a1, b1, a0, b1, b0);
        }
      }
    }

    const positions = new Float32Array(posArr);
    const normals = new Float32Array(nrmArr);
    const uvs = new Float32Array(uvArr);
    const indices = new Uint32Array(idxArr);
    return {
      positions,
      normals,
      uvs,
      indices,
      bounds: computeMeshBounds(positions)
    };
  }

  // =========================================================================
  // 3D PRIMITIVE MESHES (Plane, Box, Sphere, Forge Anvil, Forge Hammer)
  // =========================================================================
  function createPlaneMesh(width = 400, height = 400, segX = 16, segY = 16) {
    const sx = Math.max(1, Math.round(segX));
    const sy = Math.max(1, Math.round(segY));
    const vCount = (sx + 1) * (sy + 1);
    const positions = new Float32Array(vCount * 3);
    const normals = new Float32Array(vCount * 3);
    const uvs = new Float32Array(vCount * 2);
    const indices = new Uint32Array(sx * sy * 6);

    let vi = 0;
    for (let y = 0; y <= sy; y++) {
      const v = y / sy;
      const py = (v - 0.5) * height;
      for (let x = 0; x <= sx; x++) {
        const u = x / sx;
        const px = (u - 0.5) * width;
        positions[vi * 3] = px;
        positions[vi * 3 + 1] = py;
        positions[vi * 3 + 2] = 0;
        normals[vi * 3] = 0;
        normals[vi * 3 + 1] = 0;
        normals[vi * 3 + 2] = -1;
        uvs[vi * 2] = u;
        uvs[vi * 2 + 1] = v;
        vi++;
      }
    }

    let ii = 0;
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const a = y * (sx + 1) + x;
        const b = a + 1;
        const c = a + (sx + 1);
        const d = c + 1;
        indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
        indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
      }
    }
    return { positions, normals, uvs, indices, bounds: computeMeshBounds(positions) };
  }

  function createBoxMesh(wx = 120, wy = 120, wz = 120, bevel = 4) {
    const rect = Geo2D.rectContour(0, 0, wx, wy, bevel);
    return extrudeContours3D([rect], {
      extrudeDepth: wz,
      bevelDepth: bevel,
      bevelWidth: bevel,
      bevelSegments: bevel > 0.5 ? 2 : 0,
      extrudeAlign: 'center',
      tessMaxEdge: Math.max(16, Math.min(wx, wy) * 0.25)
    });
  }

  function createSphereMesh(radius = 60, segU = 28, segV = 18) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let y = 0; y <= segV; y++) {
      const v = y / segV;
      const phi = v * Math.PI;
      for (let x = 0; x <= segU; x++) {
        const u = x / segU;
        const theta = u * Math.PI * 2;
        const nx = -Math.cos(theta) * Math.sin(phi);
        const ny = -Math.cos(phi);
        const nz = Math.sin(theta) * Math.sin(phi);
        positions.push(nx * radius, ny * radius, nz * radius);
        normals.push(nx, ny, nz);
        uvs.push(u, v);
      }
    }
    for (let y = 0; y < segV; y++) {
      for (let x = 0; x < segU; x++) {
        const a = y * (segU + 1) + x;
        const b = a + 1;
        const c = a + (segU + 1);
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    const posF = new Float32Array(positions);
    return {
      positions: posF,
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
      bounds: computeMeshBounds(posF)
    };
  }

  // Blacksmith Forge Hammer 3D Mesh (Beveled striking head + collar + wooden/iron shaft)
  function createHammerMesh(headW = 92, headH = 62, headD = 68, handleLen = 230) {
    const head = createBoxMesh(headW, headH, headD, 6);
    const facePad = transformMesh3D(
      createBoxMesh(headW * 0.84, headH * 0.84, 10, 3),
      Mat4.fromTranslation(0, 0, headD * 0.5 + 3)
    );
    const handle = transformMesh3D(
      createBoxMesh(20, handleLen, 20, 6),
      Mat4.fromTranslation(0, -handleLen * 0.5 - headH * 0.32, 0)
    );
    return mergeMeshes3D([head, facePad, handle]);
  }

  // Blacksmith Iron Anvil 3D Mesh (Top working face at z = 0, body extending into +Z / +Y)
  function createAnvilMesh(topW = 560, topH = 420, thickness = 90) {
    const topDeck = transformMesh3D(
      createBoxMesh(topW, topH, thickness, 7),
      Mat4.fromTranslation(0, 0, thickness * 0.5)
    );
    const waist = transformMesh3D(
      createBoxMesh(topW * 0.72, topH * 0.72, thickness * 0.9, 5),
      Mat4.fromTranslation(0, 0, thickness * 1.35)
    );
    const base = transformMesh3D(
      createBoxMesh(topW * 1.08, topH * 1.05, thickness * 0.7, 6),
      Mat4.fromTranslation(0, 0, thickness * 2.05)
    );
    return mergeMeshes3D([topDeck, waist, base]);
  }

  // =========================================================================
  // SPATIAL FIELDS ENGINE (Section 2.8 & Section 2.13)
  // Identical field evaluator drives BOTH Mesh Vertex Deformation AND Particle Motion!
  // =========================================================================
  function evaluateSingleField(field, worldPos, time = 0) {
    if (!field || field.enabled === false) return [0, 0, 0];
    const center = field.center || [0, 0, 0];
    const rx = worldPos[0] - center[0];
    const ry = worldPos[1] - center[1];
    const rz = worldPos[2] - center[2];
    const dist = Math.hypot(rx, ry, rz);

    const innerR = Math.max(0, field.innerRadius ?? 30);
    const outerR = Math.max(innerR + 0.1, field.outerRadius ?? 220);
    // Smooth distance falloff (1 inside innerR, 0 outside outerR)
    const falloff = field.infinite ? 1.0 : 1.0 - smoothstep(innerR, outerR, dist);
    if (falloff <= 1e-6) return [0, 0, 0];

    const strength = field.strength ?? 1.0;
    const type = field.fieldType || 'radial';

    if (type === 'radial') {
      const subMode = field.radialMode || 'push'; // 'push' | 'directional' | 'dent'
      if (subMode === 'directional') {
        const dir = Vec3.norm(field.direction || [0, 0, 1]);
        const s = strength * falloff;
        return [dir[0] * s, dir[1] * s, dir[2] * s];
      }
      if (subMode === 'dent') {
        // Forge Hammer Impact Dent: axial compression along direction + subtle lateral Poisson forge bulge!
        const dir = Vec3.norm(field.direction || [0, 0, 1]);
        const axial = strength * falloff;
        const proj = rx * dir[0] + ry * dir[1] + rz * dir[2];
        const lat = [rx - dir[0] * proj, ry - dir[1] * proj, rz - dir[2] * proj];
        const latLen = Vec3.len(lat);
        const bulge = latLen > 1e-4 ? (strength * 0.28 * falloff * (1 - falloff * 0.4)) / latLen : 0;
        return [
          dir[0] * axial + lat[0] * bulge,
          dir[1] * axial + lat[1] * bulge,
          dir[2] * axial + lat[2] * bulge
        ];
      }
      // Radial outward/inward
      const dir = dist > 1e-4 ? [rx / dist, ry / dist, rz / dist] : [0, -1, 0];
      const s = strength * falloff;
      return [dir[0] * s, dir[1] * s, dir[2] * s];
    }

    if (type === 'noise') {
      const freq = Math.max(0.0005, field.frequency ?? 0.012);
      const speed = field.evolutionSpeed ?? 0.8;
      const seed = field.seed ?? 42;
      const octaves = field.octaves ?? 2;
      const tShift = time * speed;
      const n = fbm3DVec(
        worldPos[0] * freq + tShift * 0.7,
        worldPos[1] * freq - tShift * 0.9,
        worldPos[2] * freq + tShift * 0.5,
        octaves,
        seed
      );
      const s = strength * falloff;
      return [n[0] * s, n[1] * s, n[2] * s];
    }

    if (type === 'vortex') {
      const axis = Vec3.norm(field.axis || [0, 0, 1]);
      const rVec = [rx, ry, rz];
      // Tangential direction = axis x rVec
      const tang = Vec3.cross(axis, rVec);
      const tLen = Vec3.len(tang);
      const tUnit = tLen > 1e-4 ? [tang[0] / tLen, tang[1] / tLen, tang[2] / tLen] : [1, 0, 0];
      const pull = field.radialPull ?? 0;
      const rUnit = dist > 1e-4 ? [-rx / dist, -ry / dist, -rz / dist] : [0, 0, 0];
      return [
        (tUnit[0] * strength + rUnit[0] * pull) * falloff,
        (tUnit[1] * strength + rUnit[1] * pull) * falloff,
        (tUnit[2] * strength + rUnit[2] * pull) * falloff
      ];
    }

    return [0, 0, 0];
  }

  function evaluateFieldsAtPoint(fields, worldPos, time = 0) {
    if (!fields || fields.length === 0) return [0, 0, 0];
    let accX = 0, accY = 0, accZ = 0;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f || f.enabled === false) continue;
      const v = evaluateSingleField(f, worldPos, time);
      const mix = f.mixMode || 'add';
      const weight = f.weight ?? 1.0;
      if (mix === 'multiply') {
        const mag = clamp(Vec3.len(v) / Math.max(1e-4, Math.abs(f.strength || 1)), 0, 2);
        const factor = lerp(1, mag, weight);
        accX *= factor; accY *= factor; accZ *= factor;
      } else if (mix === 'subtract') {
        accX -= v[0] * weight; accY -= v[1] * weight; accZ -= v[2] * weight;
      } else {
        accX += v[0] * weight; accY += v[1] * weight; accZ += v[2] * weight;
      }
    }
    return [accX, accY, accZ];
  }

  // =========================================================================
  // 3D SOLID DEFORMERS: Bend, Twist & Spatial Field Vertex Deformation (2.8)
  // =========================================================================
  function applyBendTwistMesh3D(mesh, { bendAngle = 0, bendAxis = 'x', twistAngle = 0, twistAxis = 'y' } = {}) {
    if (Math.abs(bendAngle) < 1e-4 && Math.abs(twistAngle) < 1e-4) return mesh;
    const out = cloneMesh3D(mesh);
    const pos = out.positions;
    const b = out.bounds || computeMeshBounds(pos);
    const center = [
      0.5 * (b.min[0] + b.max[0]),
      0.5 * (b.min[1] + b.max[1]),
      0.5 * (b.min[2] + b.max[2])
    ];
    const span = [
      Math.max(10, b.max[0] - b.min[0]),
      Math.max(10, b.max[1] - b.min[1]),
      Math.max(10, b.max[2] - b.min[2])
    ];

    // 1. Twist along twistAxis
    if (Math.abs(twistAngle) >= 1e-4) {
      const totalRad = twistAngle * DEG2RAD;
      const axIdx = twistAxis === 'x' ? 0 : twistAxis === 'z' ? 2 : 1;
      const uIdx = (axIdx + 1) % 3;
      const vIdx = (axIdx + 2) % 3;
      for (let i = 0; i < pos.length; i += 3) {
        const t = (pos[i + axIdx] - center[axIdx]) / span[axIdx]; // [-0.5, 0.5]
        const ang = t * totalRad;
        const c = Math.cos(ang), s = Math.sin(ang);
        const du = pos[i + uIdx] - center[uIdx];
        const dv = pos[i + vIdx] - center[vIdx];
        pos[i + uIdx] = center[uIdx] + du * c - dv * s;
        pos[i + vIdx] = center[vIdx] + du * s + dv * c;
      }
    }

    // 2. Analytical circular-arc Bend along bendAxis (bending into Z)
    if (Math.abs(bendAngle) >= 1e-4) {
      const thetaTotal = clamp(bendAngle, -350, 350) * DEG2RAD;
      const axIdx = bendAxis === 'y' ? 1 : 0; // primary length axis ('x' or 'y')
      const L = span[axIdx];
      const R = L / thetaTotal; // signed bend radius
      for (let i = 0; i < pos.length; i += 3) {
        const sCoord = pos[i + axIdx] - center[axIdx];
        const zCoord = pos[i + 2] - center[2];
        const phi = sCoord / R;
        const rEff = R - zCoord;
        pos[i + axIdx] = center[axIdx] + Math.sin(phi) * rEff;
        pos[i + 2] = center[2] + R - Math.cos(phi) * rEff;
      }
    }

    return recomputeMeshNormals(out);
  }

  function applySpatialFieldsToMesh3D(mesh, fields, worldMatrix, time = 0, amount = 1.0) {
    if (!fields || fields.length === 0 || Math.abs(amount) < 1e-5) return mesh;
    const out = cloneMesh3D(mesh);
    const pos = out.positions;
    const hasWorld = !!worldMatrix;
    const invWorld = hasWorld ? Mat4.invert(worldMatrix) : null;

    for (let i = 0; i < pos.length; i += 3) {
      const lp = [pos[i], pos[i + 1], pos[i + 2]];
      const wp = hasWorld ? Mat4.transformPoint(worldMatrix, lp) : lp;
      const dispW = evaluateFieldsAtPoint(fields, wp, time);
      if (Math.abs(dispW[0]) + Math.abs(dispW[1]) + Math.abs(dispW[2]) > 1e-6) {
        const newW = [
          wp[0] + dispW[0] * amount,
          wp[1] + dispW[1] * amount,
          wp[2] + dispW[2] * amount
        ];
        const newL = hasWorld ? Mat4.transformPoint(invWorld, newW) : newW;
        pos[i] = newL[0];
        pos[i + 1] = newL[1];
        pos[i + 2] = newL[2];
      }
    }
    return recomputeMeshNormals(out);
  }

  // =========================================================================
  // MÖLLER–TRUMBORE 3D RAYCASTING (Section 2.12 & Collisions)
  // =========================================================================
  function rayTriangleIntersect(orig, dir, a, b, c) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
    const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    const px = dir[1] * e2z - dir[2] * e2y;
    const py = dir[2] * e2x - dir[0] * e2z;
    const pz = dir[0] * e2y - dir[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-8) return null;

    const invDet = 1.0 / det;
    const tx = orig[0] - a[0], ty = orig[1] - a[1], tz = orig[2] - a[2];
    const u = (tx * px + ty * py + tz * pz) * invDet;
    if (u < 0 || u > 1) return null;

    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const v = (dir[0] * qx + dir[1] * qy + dir[2] * qz) * invDet;
    if (v < 0 || u + v > 1) return null;

    const t = (e2x * qx + e2y * qy + e2z * qz) * invDet;
    if (t <= 1e-4) return null;
    return { t, u, v };
  }

  function rayAABBIntersect(orig, dir, minB, maxB) {
    let tmin = -Infinity, tmax = Infinity;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(dir[k]) < 1e-8) {
        if (orig[k] < minB[k] || orig[k] > maxB[k]) return false;
      } else {
        const inv = 1 / dir[k];
        let t1 = (minB[k] - orig[k]) * inv;
        let t2 = (maxB[k] - orig[k]) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
      }
    }
    return tmax >= 0;
  }

  function raycastMeshLocal(mesh, localOrig, localDir) {
    if (!mesh || !mesh.indices || mesh.indices.length === 0) return null;
    const b = mesh.bounds || computeMeshBounds(mesh.positions);
    if (!rayAABBIntersect(localOrig, localDir, b.min, b.max)) return null;

    const pos = mesh.positions;
    const idx = mesh.indices;
    let bestHit = null;
    let bestT = Infinity;

    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i] * 3, i1 = idx[i + 1] * 3, i2 = idx[i + 2] * 3;
      const p0 = [pos[i0], pos[i0 + 1], pos[i0 + 2]];
      const p1 = [pos[i1], pos[i1 + 1], pos[i1 + 2]];
      const p2 = [pos[i2], pos[i2 + 1], pos[i2 + 2]];
      const hit = rayTriangleIntersect(localOrig, localDir, p0, p1, p2);
      if (hit && hit.t < bestT) {
        bestT = hit.t;
        bestHit = {
          t: hit.t,
          point: Vec3.addScaled(localOrig, localDir, hit.t),
          normal: Vec3.norm(Vec3.cross(Vec3.sub(p1, p0), Vec3.sub(p2, p0))),
          triIndex: i / 3,
          u: hit.u,
          v: hit.v
        };
      }
    }
    return bestHit;
  }

  Forge.Geo3D = {
    cloneMesh3D,
    computeMeshBounds,
    recomputeMeshNormals,
    mergeMeshes3D,
    transformMesh3D,
    extrudeContours3D,
    createPlaneMesh,
    createBoxMesh,
    createSphereMesh,
    createHammerMesh,
    createAnvilMesh,
    evaluateSingleField,
    evaluateFieldsAtPoint,
    applyBendTwistMesh3D,
    applySpatialFieldsToMesh3D,
    rayTriangleIntersect,
    rayAABBIntersect,
    raycastMeshLocal
  };
})();
