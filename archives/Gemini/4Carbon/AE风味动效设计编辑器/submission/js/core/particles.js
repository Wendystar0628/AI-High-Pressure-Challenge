/**
 * Forge Studio — Deterministic Checkpoint-Cached 3D Particle, Force Field,
 * Moving/Deforming Surface Collision, Secondary Emission & Trajectory Trail Engine (2.13 & 2.14)
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const {
    clamp, lerp, DEG2RAD, hashString, hashCombine, mulberry32, Vec3, Mat4
  } = Forge.Math;
  const Geo2D = Forge.Geo2D;
  const Geo3D = Forge.Geo3D;
  const Anim = Forge.Anim;
  const Nodes = Forge.Nodes;

  const SIM_DT = 1 / 90;         // Fixed deterministic simulation step (90 Hz)
  const CHECKPOINT_STRIDE = 24;  // Save immutable snapshot every ~0.266s

  // Per-layer deterministic simulation cache (keyed by layer.id)
  const _simCaches = new Map();

  function cloneParticle(p) {
    return {
      id: p.id,
      gen: p.gen,
      age: p.age,
      life: p.life,
      pos: [p.pos[0], p.pos[1], p.pos[2]],
      vel: [p.vel[0], p.vel[1], p.vel[2]],
      sizeBase: p.sizeBase,
      seed: p.seed,
      hitCount: p.hitCount,
      tintOverride: p.tintOverride ? [...p.tintOverride] : null,
      emitterIdx: p.emitterIdx,
      trail: p.trail.map((pt) => [pt[0], pt[1], pt[2]])
    };
  }

  function cloneSimState(state) {
    return {
      step: state.step,
      nextPid: state.nextPid,
      emitAccum: state.emitAccum.slice(),
      particles: state.particles.map(cloneParticle)
    };
  }

  // Compute signature of everything upstream of this particle system so edits auto-invalidate cache!
  function computeParticleSignature(layer, comp, project) {
    // Fast JSON signature of particleData + referenced emitter/collider/field layers + node graph
    const pd = layer.particleData || {};
    const parts = [
      JSON.stringify(pd),
      JSON.stringify(layer.transform),
      String(layer.inPoint ?? 0)
    ];
    if (comp) {
      if (comp.nodeGraph) parts.push(JSON.stringify(comp.nodeGraph));
      for (const l of (comp.layers || [])) {
        if (
          l.type === 'field' ||
          l.type === 'text' ||
          l.type === 'shape' ||
          l.type === 'solid3d' ||
          l.type === 'nodeGeo'
        ) {
          parts.push(l.id, JSON.stringify(l.transform));
          if (l.textData) parts.push(l.textData.text, l.textData.fontFamily, JSON.stringify(l.textData.fontSize));
          if (l.shapeData) parts.push(JSON.stringify(l.shapeData));
          if (l.solidData) parts.push(JSON.stringify(l.solidData));
          if (l.field) parts.push(JSON.stringify(l.field));
          if (l.extrude) parts.push(JSON.stringify(l.extrude));
          if (l.deform) parts.push(JSON.stringify(l.deform));
        }
      }
    }
    return hashString(parts.join('|'));
  }

  function invalidateAllParticleCaches() {
    _simCaches.clear();
  }

  // Build world-space triangle emission table weighted by area (and optional field proximity)
  function buildSurfaceEmissionTable(worldMesh, focusFields = null) {
    const pos = worldMesh.positions;
    const nrm = worldMesh.normals;
    const idx = worldMesh.indices;
    const triCount = idx ? Math.floor(idx.length / 3) : 0;
    if (triCount === 0) return null;

    const cumWeight = new Float64Array(triCount);
    let total = 0;
    const hasFocus = focusFields && focusFields.length > 0;

    for (let t = 0; t < triCount; t++) {
      const i0 = idx[t * 3] * 3, i1 = idx[t * 3 + 1] * 3, i2 = idx[t * 3 + 2] * 3;
      const ax = pos[i0], ay = pos[i0 + 1], az = pos[i0 + 2];
      const bx = pos[i1] - ax, by = pos[i1 + 1] - ay, bz = pos[i1 + 2] - az;
      const cx = pos[i2] - ax, cy = pos[i2 + 1] - ay, cz = pos[i2 + 2] - az;
      const area = 0.5 * Math.hypot(
        by * cz - bz * cy,
        bz * cx - bx * cz,
        bx * cy - by * cx
      );
      let w = area;
      if (hasFocus && area > 1e-4) {
        const mx = (ax + pos[i1] + pos[i2]) / 3;
        const my = (ay + pos[i1 + 1] + pos[i2 + 1]) / 3;
        const mz = (az + pos[i2] + pos[i1 + 2]) / 3; // centroid approx
        const fVec = Geo3D.evaluateFieldsAtPoint(focusFields, [mx, my, (az + pos[i1 + 2] + pos[i2 + 2]) / 3], 0);
        const fMag = Vec3.len(fVec);
        w = area * (0.04 + fMag * 2.5);
      }
      total += w;
      cumWeight[t] = total;
    }
    if (total <= 1e-6) return null;
    return { pos, nrm, idx, triCount, cumWeight, total };
  }

  function sampleSurfacePoint(table, prevWorldMesh, dt, rng) {
    const target = rng() * table.total;
    let lo = 0, hi = table.triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (table.cumWeight[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const ti = lo * 3;
    const vi0 = table.idx[ti], vi1 = table.idx[ti + 1], vi2 = table.idx[ti + 2];
    const i0 = vi0 * 3, i1 = vi1 * 3, i2 = vi2 * 3;
    let u = rng(), v = rng();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;

    const p = [
      table.pos[i0] * w + table.pos[i1] * u + table.pos[i2] * v,
      table.pos[i0 + 1] * w + table.pos[i1 + 1] * u + table.pos[i2 + 1] * v,
      table.pos[i0 + 2] * w + table.pos[i1 + 2] * u + table.pos[i2 + 2] * v
    ];
    const n = Vec3.norm([
      table.nrm[i0] * w + table.nrm[i1] * u + table.nrm[i2] * v,
      table.nrm[i0 + 1] * w + table.nrm[i1 + 1] * u + table.nrm[i2 + 1] * v,
      table.nrm[i0 + 2] * w + table.nrm[i1 + 2] * u + table.nrm[i2 + 2] * v
    ]);

    let surfVel = [0, 0, 0];
    if (prevWorldMesh && prevWorldMesh.positions && prevWorldMesh.positions.length === table.pos.length && dt > 1e-6) {
      const pp = prevWorldMesh.positions;
      const pPrev = [
        pp[i0] * w + pp[i1] * u + pp[i2] * v,
        pp[i0 + 1] * w + pp[i1 + 1] * u + pp[i2 + 1] * v,
        pp[i0 + 2] * w + pp[i1 + 2] * u + pp[i2 + 2] * v
      ];
      surfVel = Vec3.scale(Vec3.sub(p, pPrev), 1 / dt);
    }

    return { pos: p, normal: n, surfVel };
  }

  // Random cone vector around axis N with half-angle spreadRad
  function sampleConeDirection(N, spreadDeg, rng) {
    const axis = Vec3.norm(N);
    const maxRad = clamp(spreadDeg, 0, 180) * DEG2RAD;
    if (maxRad <= 1e-4) return axis;
    const cosTheta = lerp(Math.cos(maxRad), 1.0, rng());
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = rng() * Math.PI * 2;

    let helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const tangent = Vec3.norm(Vec3.cross(helper, axis));
    const bitangent = Vec3.cross(axis, tangent);
    return Vec3.norm([
      tangent[0] * Math.cos(phi) * sinTheta + bitangent[0] * Math.sin(phi) * sinTheta + axis[0] * cosTheta,
      tangent[1] * Math.cos(phi) * sinTheta + bitangent[1] * Math.sin(phi) * sinTheta + axis[1] * cosTheta,
      tangent[2] * Math.cos(phi) * sinTheta + bitangent[2] * Math.sin(phi) * sinTheta + axis[2] * cosTheta
    ]);
  }

  // Resolve world-space mesh of any scene layer at time t (used by emitters & colliders!)
  function resolveLayerWorldMesh(targetLayer, t, comp, project, nodeEval = null) {
    if (!targetLayer) return null;
    const worldM = Anim.getLayerWorldMatrix(targetLayer, t, comp, project);

    if (targetLayer.type === 'nodeGeo') {
      const ne = nodeEval || (comp ? Nodes.evaluateNodeGraph(comp.nodeGraph, t, comp, project) : null);
      if (ne) {
        const disp = ne.displays.find((d) => d.targetLayerId === targetLayer.id || d.nodeId === targetLayer.nodeOutputId) || ne.displays[0];
        if (disp && disp.geo) {
          const localMesh = Nodes.ensureMesh3DFromGeo(disp.geo, 0);
          return Geo3D.transformMesh3D(localMesh, worldM);
        }
      }
    }

    if (Forge.SceneEval && Forge.SceneEval.getLayerLocalMesh3D) {
      const localMesh = Forge.SceneEval.getLayerLocalMesh3D(targetLayer, t, comp, project);
      if (localMesh && localMesh.positions.length > 0) {
        return Geo3D.transformMesh3D(localMesh, worldM);
      }
    }
    return null;
  }

  // Collect active Colliders at [t0, t1] (both Plane colliders and arbitrary Deforming Mesh colliders!)
  function collectCollidersForStep(layer, t0, t1, comp, project, nodeEval1) {
    const pd = layer.particleData || {};
    const colliders = [];
    const dt = Math.max(1e-5, t1 - t0);

    // 1. Layer-referenced colliders
    for (const cid of (pd.colliderLayerIds || [])) {
      const cl = comp.layers.find((l) => l.id === cid || l.name === cid);
      if (!cl || cl.visible === false) continue;
      if (t1 < (cl.inPoint ?? 0) || t1 > (cl.outPoint ?? comp.duration)) continue;

      const bounce = pd.bounce ? Anim.evalProp(pd.bounce, t1, { project, comp, layer }) : 0.45;
      const friction = pd.friction ? Anim.evalProp(pd.friction, t1, { project, comp, layer }) : 0.25;

      // Fast analytic bounded-plane collider if it's a flat 3D plane OR Anvil top deck + mesh!
      if (cl.type === 'solid3d' && cl.solidData && cl.solidData.primitive === 'plane') {
        const m0 = Anim.getLayerWorldMatrix(cl, t0, comp, project);
        const m1 = Anim.getLayerWorldMatrix(cl, t1, comp, project);
        const inv1 = Mat4.invert(m1);
        const sx = Anim.evalProp(cl.solidData.sizeX, t1, { project, comp, layer: cl });
        const sy = Anim.evalProp(cl.solidData.sizeY, t1, { project, comp, layer: cl });
        colliders.push({
          kind: 'plane',
          m0, m1, inv1,
          halfW: sx * 0.5,
          halfH: sy * 0.5,
          normal: Vec3.norm(Mat4.transformDir(m1, [0, 0, -1])),
          origin: Mat4.transformPoint(m1, [0, 0, 0]),
          dt,
          bounce,
          friction
        });
        continue;
      }

      const mesh1 = resolveLayerWorldMesh(cl, t1, comp, project, nodeEval1);
      if (mesh1 && mesh1.indices.length >= 3) {
        const mesh0 = resolveLayerWorldMesh(cl, t0, comp, project, null);
        colliders.push({
          kind: 'mesh',
          mesh0,
          mesh1,
          bounds: mesh1.bounds || Geo3D.computeMeshBounds(mesh1.positions),
          dt,
          bounce,
          friction
        });
      }
    }

    // 2. Node-Graph `consumer_collider` wires!
    if (nodeEval1 && nodeEval1.colliders) {
      for (const nc of nodeEval1.colliders) {
        if (nc.targetLayerId && nc.targetLayerId !== layer.id && nc.targetLayerId !== layer.name) continue;
        const localM = Nodes.ensureMesh3DFromGeo(nc.geo, 0);
        if (localM.indices.length >= 3) {
          // Place in comp world space (centered at comp center if unbound)
          const refLayer = comp.layers.find((l) => l.type === 'nodeGeo');
          const worldMat = refLayer
            ? Anim.getLayerWorldMatrix(refLayer, t1, comp, project)
            : Mat4.fromTranslation(comp.width * 0.5, comp.height * 0.5, 0);
          const worldM1 = Geo3D.transformMesh3D(localM, worldMat);
          colliders.push({
            kind: 'mesh',
            mesh0: null,
            mesh1: worldM1,
            bounds: worldM1.bounds,
            dt,
            bounce: nc.bounce ?? 0.48,
            friction: nc.friction ?? 0.22
          });
        }
      }
    }

    return colliders;
  }

  // Sweep segment p0 -> p1 against all active colliders; returns earliest hit!
  function collideSegment(p0, p1, colliders) {
    let bestHit = null;
    let bestFrac = 1.0001;
    const seg = Vec3.sub(p1, p0);
    const segLen = Vec3.len(seg);
    if (segLen < 1e-6) return null;
    const segDir = [seg[0] / segLen, seg[1] / segLen, seg[2] / segLen];

    for (const col of colliders) {
      if (col.kind === 'plane') {
        // Test in plane's local space at t1 (z = 0 plane!)
        const lp0 = Mat4.transformPoint(col.inv1, p0);
        const lp1 = Mat4.transformPoint(col.inv1, p1);
        // Crossing z = 0 (or within radius 2.0px)
        if ((lp0[2] >= -1.5 && lp1[2] <= 1.5) || (lp0[2] <= 1.5 && lp1[2] >= -1.5)) {
          const dz = lp1[2] - lp0[2];
          if (Math.abs(dz) > 1e-6) {
            const frac = clamp((0 - lp0[2]) / dz, 0, 1);
            if (frac < bestFrac) {
              const hx = lerp(lp0[0], lp1[0], frac);
              const hy = lerp(lp0[1], lp1[1], frac);
              if (Math.abs(hx) <= col.halfW && Math.abs(hy) <= col.halfH) {
                const hitWorld = Mat4.transformPoint(col.m1, [hx, hy, 0]);
                const prevWorld = Mat4.transformPoint(col.m0, [hx, hy, 0]);
                const surfVel = Vec3.scale(Vec3.sub(hitWorld, prevWorld), 1 / col.dt);
                const sign = lp0[2] >= lp1[2] ? 1 : -1;
                const nLocal = [0, 0, sign];
                const worldN = Vec3.norm(Mat4.transformDir(col.m1, nLocal));
                bestFrac = frac;
                bestHit = {
                  frac,
                  point: hitWorld,
                  normal: worldN,
                  surfVel,
                  bounce: col.bounce,
                  friction: col.friction
                };
              }
            }
          }
        }
        continue;
      }

      if (col.kind === 'mesh') {
        const b = col.bounds;
        const pad = 4.0;
        const minX = Math.min(p0[0], p1[0]) - pad, maxX = Math.max(p0[0], p1[0]) + pad;
        const minY = Math.min(p0[1], p1[1]) - pad, maxY = Math.max(p0[1], p1[1]) + pad;
        const minZ = Math.min(p0[2], p1[2]) - pad, maxZ = Math.max(p0[2], p1[2]) + pad;
        if (
          maxX < b.min[0] || minX > b.max[0] ||
          maxY < b.min[1] || minY > b.max[1] ||
          maxZ < b.min[2] || minZ > b.max[2]
        ) continue;

        const pos = col.mesh1.positions;
        const idx = col.mesh1.indices;
        const pos0 = col.mesh0 && col.mesh0.positions.length === pos.length ? col.mesh0.positions : null;

        // Back-up ray origin slightly by 1.5px along -segDir to prevent grazing slip-through
        const rayOrig = Vec3.addScaled(p0, segDir, -1.5);
        const maxDist = segLen + 2.5;

        for (let t = 0; t < idx.length; t += 3) {
          const vi0 = idx[t], vi1 = idx[t + 1], vi2 = idx[t + 2];
          const i0 = vi0 * 3, i1 = vi1 * 3, i2 = vi2 * 3;
          // Fast per-triangle AABB cull
          const ax = pos[i0], bx = pos[i1], cx = pos[i2];
          if (Math.max(ax, bx, cx) < minX || Math.min(ax, bx, cx) > maxX) continue;
          const ay = pos[i0 + 1], by = pos[i1 + 1], cy = pos[i2 + 1];
          if (Math.max(ay, by, cy) < minY || Math.min(ay, by, cy) > maxY) continue;
          const az = pos[i0 + 2], bz = pos[i1 + 2], cz = pos[i2 + 2];
          if (Math.max(az, bz, cz) < minZ || Math.min(az, bz, cz) > maxZ) continue;

          const hit = Geo3D.rayTriangleIntersect(
            rayOrig, segDir,
            [ax, ay, az], [bx, by, bz], [cx, cy, cz]
          );
          if (hit && hit.t <= maxDist) {
            const frac = clamp((hit.t - 1.5) / segLen, 0, 1);
            if (frac < bestFrac) {
              let triN = Vec3.norm(Vec3.cross([bx - ax, by - ay, bz - az], [cx - ax, cy - ay, cz - az]));
              if (Vec3.dot(triN, segDir) > 0) triN = Vec3.scale(triN, -1);
              let surfVel = [0, 0, 0];
              if (pos0) {
                const w = 1 - hit.u - hit.v;
                const curP = [
                  ax * w + bx * hit.u + cx * hit.v,
                  ay * w + by * hit.u + cy * hit.v,
                  az * w + bz * hit.u + cz * hit.v
                ];
                const prvP = [
                  pos0[i0] * w + pos0[i1] * hit.u + pos0[i2] * hit.v,
                  pos0[i0 + 1] * w + pos0[i1 + 1] * hit.u + pos0[i2 + 1] * hit.v,
                  pos0[i0 + 2] * w + pos0[i1 + 2] * hit.u + pos0[i2 + 2] * hit.v
                ];
                surfVel = Vec3.scale(Vec3.sub(curP, prvP), 1 / col.dt);
              }
              bestFrac = frac;
              bestHit = {
                frac,
                point: Vec3.addScaled(rayOrig, segDir, hit.t),
                normal: triN,
                surfVel,
                bounce: col.bounce,
                friction: col.friction
              };
            }
          }
        }
      }
    }
    return bestHit;
  }

  // Advance pure particle state by ONE fixed step `SIM_DT` from `stepIdx * SIM_DT` to `(stepIdx + 1) * SIM_DT`
  function advanceParticleStep(state, stepIdx, layer, comp, project) {
    const t0 = stepIdx * SIM_DT;
    const t1 = (stepIdx + 1) * SIM_DT;
    const pd = layer.particleData || {};
    const emitters = pd.emitters || [];
    const baseSeed = pd.seed ?? 12345;
    const ctx = { project, comp, layer };

    const inPt = layer.inPoint ?? 0;
    const outPt = layer.outPoint ?? comp.duration;
    if (t1 < inPt) return state;

    // Evaluate Node Graph & Scene Spatial Fields at t1
    const nodeEval1 = comp && comp.nodeGraph ? Nodes.evaluateNodeGraph(comp.nodeGraph, t1, comp, project) : null;
    const sceneFields = [];
    if (comp && comp.layers) {
      for (const fl of comp.layers) {
        if (fl.type === 'field') {
          const fo = Nodes.evalFieldLayerObject(fl, t1, comp, project);
          if (fo && fo.enabled) sceneFields.push(fo);
        }
      }
    }
    if (nodeEval1 && nodeEval1.emitters) {
      for (const ne of nodeEval1.emitters) {
        if (!ne.targetLayerId || ne.targetLayerId === layer.id || ne.targetLayerId === layer.name) {
          for (const nf of (ne.fields || [])) sceneFields.push(nf);
        }
      }
    }

    // 1. Spawn new particles from each emitter!
    if (t1 <= outPt) {
      while (state.emitAccum.length < emitters.length) state.emitAccum.push(0);
      const layerM0 = Anim.getLayerWorldMatrix(layer, t0, comp, project);
      const layerM1 = Anim.getLayerWorldMatrix(layer, t1, comp, project);

      for (let eIdx = 0; eIdx < emitters.length; eIdx++) {
        const em = emitters[eIdx];
        if (em.enabled === false) continue;
        const rate = Math.max(0, Anim.evalProp(em.rate, t1, { ...ctx, propKey: `em${eIdx}.rate` }) || 0);
        state.emitAccum[eIdx] += rate * SIM_DT;
        const spawnCount = Math.min(80, Math.floor(state.emitAccum[eIdx]));
        if (spawnCount <= 0) continue;
        state.emitAccum[eIdx] -= spawnCount;

        const rng = mulberry32(hashCombine(hashCombine(baseSeed, stepIdx + 1), eIdx * 7919 + 13));
        const initSpeed = Anim.evalProp(em.initialSpeed, t1, { ...ctx, propKey: `em${eIdx}.spd` }) ?? 220;
        const speedVar = em.speedVariance ?? 0.35;
        const spread = Anim.evalProp(em.spread, t1, { ...ctx, propKey: `em${eIdx}.spread` }) ?? 45;
        const lifeBase = Math.max(0.05, Anim.evalProp(em.lifetime, t1, { ...ctx, propKey: `em${eIdx}.life` }) ?? 1.2);
        const lifeVar = em.lifetimeVariance ?? 0.3;
        const inheritVel = em.inheritVelocity ?? 0.5;
        const sizeBase = Math.max(0.5, Anim.evalProp(em.size, t1, { ...ctx, propKey: `em${eIdx}.size` }) ?? 6);
        const localOff = em.offset ? Anim.evalProp(em.offset, t1, { ...ctx, propKey: `em${eIdx}.off` }) : [0, 0, 0];
        const emDirLocal = em.direction || [0, -1, -0.4];

        // Prepare geometric source if 'surface' or 'curve'
        let surfTable = null;
        let prevSurfMesh = null;
        let curveLuts = null;
        let curveTotal = 0;
        let curveLayerM1 = layerM1;

        if (em.sourceType === 'surface') {
          let worldMesh1 = null;
          // Check Node Graph `consumer_emitter` first!
          if (nodeEval1 && nodeEval1.emitters) {
            const bound = nodeEval1.emitters.find((ne) => ne.targetLayerId === layer.id || ne.targetLayerId === layer.name) ||
              (!em.sourceLayerId ? nodeEval1.emitters[0] : null);
            if (bound && bound.geo) {
              const refL = comp.layers.find((l) => l.type === 'nodeGeo');
              const refM1 = refL
                ? Anim.getLayerWorldMatrix(refL, t1, comp, project)
                : Mat4.fromTranslation(comp.width * 0.5, comp.height * 0.5, 0);
              worldMesh1 = Geo3D.transformMesh3D(Nodes.ensureMesh3DFromGeo(bound.geo, 0), refM1);
            }
          }
          if (!worldMesh1 && em.sourceLayerId) {
            const srcL = comp.layers.find((l) => l.id === em.sourceLayerId || l.name === em.sourceLayerId);
            worldMesh1 = resolveLayerWorldMesh(srcL, t1, comp, project, nodeEval1);
            prevSurfMesh = resolveLayerWorldMesh(srcL, t0, comp, project, null);
          }
          if (worldMesh1) {
            const focus = em.focusByField ? sceneFields.filter((f) => f.fieldType === 'radial') : null;
            surfTable = buildSurfaceEmissionTable(worldMesh1, focus);
          }
        } else if (em.sourceType === 'curve') {
          const srcL = em.sourceLayerId
            ? comp.layers.find((l) => l.id === em.sourceLayerId || l.name === em.sourceLayerId)
            : null;
          if (srcL) {
            curveLayerM1 = Anim.getLayerWorldMatrix(srcL, t1, comp, project);
            const geo = Nodes.extractLayerBaseGeometry(srcL, t1, comp, project, false);
            if (geo.contours && geo.contours.length > 0) {
              curveLuts = geo.contours.map((c) => Geo2D.buildContourArcLUT(c));
              curveTotal = curveLuts.reduce((a, l) => a + l.totalLength, 0);
            }
          }
        }

        for (let k = 0; k < spawnCount; k++) {
          if (state.particles.length >= 2400) break;
          let spawnPos, launchAxis, baseEmitterVel = [0, 0, 0];

          if (surfTable) {
            const smp = sampleSurfacePoint(surfTable, prevSurfMesh, SIM_DT, rng);
            spawnPos = Vec3.addScaled(smp.pos, smp.normal, 1.5);
            launchAxis = smp.normal;
            baseEmitterVel = Vec3.scale(smp.surfVel, inheritVel);
          } else if (curveLuts && curveTotal > 1e-3) {
            let d = rng() * curveTotal;
            let chosen = curveLuts[0];
            for (const l of curveLuts) {
              if (d <= l.totalLength) { chosen = l; break; }
              d -= l.totalLength;
            }
            const cs = Geo2D.sampleArcLUT(chosen, d);
            spawnPos = Mat4.transformPoint(curveLayerM1, [cs.p[0], cs.p[1], 0]);
            const n2 = [cs.tangent[1], -cs.tangent[0], -0.35];
            launchAxis = Vec3.norm(Mat4.transformDir(curveLayerM1, n2));
          } else {
            const p0W = Mat4.transformPoint(layerM0, localOff);
            const p1W = Mat4.transformPoint(layerM1, localOff);
            spawnPos = p1W;
            launchAxis = Vec3.norm(Mat4.transformDir(layerM1, emDirLocal));
            baseEmitterVel = Vec3.scale(Vec3.sub(p1W, p0W), inheritVel / SIM_DT);
          }

          const dir = sampleConeDirection(launchAxis, spread, rng);
          const spd = initSpeed * (1 + (rng() * 2 - 1) * speedVar);
          const life = Math.max(0.05, lifeBase * (1 + (rng() * 2 - 1) * lifeVar));

          state.particles.push({
            id: state.nextPid++,
            gen: 0,
            age: 0,
            life,
            pos: spawnPos,
            vel: Vec3.addScaled(baseEmitterVel, dir, spd),
            sizeBase: sizeBase * (0.75 + rng() * 0.55),
            seed: Math.floor(rng() * 1e9),
            hitCount: 0,
            tintOverride: null,
            emitterIdx: eIdx,
            trail: [[spawnPos[0], spawnPos[1], spawnPos[2]]]
          });
        }
      }
    }

    if (state.particles.length === 0) return state;

    // 2. Forces, Spatial Fields, Collisions & Secondary Sparks!
    const gravity = pd.gravity ? Anim.evalProp(pd.gravity, t1, { ...ctx, propKey: 'gravity' }) : [0, 520, 0];
    const dirForce = pd.directionalForce ? Anim.evalProp(pd.directionalForce, t1, { ...ctx, propKey: 'dirForce' }) : [0, 0, 0];
    const drag = clamp(pd.drag ? Anim.evalProp(pd.drag, t1, { ...ctx, propKey: 'drag' }) : 0.6, 0, 15);
    const fieldGain = pd.fieldInfluence !== undefined ? pd.fieldInfluence : 14.0;
    const attrEnabled = !!pd.attractorEnabled;
    const attrPos = pd.attractorPos ? Anim.evalProp(pd.attractorPos, t1, { ...ctx, propKey: 'attrPos' }) : [960, 540, 0];
    const attrStrength = pd.attractorStrength ? Anim.evalProp(pd.attractorStrength, t1, { ...ctx, propKey: 'attrStr' }) : 0;

    const maxTrailPts = pd.trailsEnabled !== false ? clamp(Math.round(pd.trailSteps ?? 12), 2, 36) : 1;
    const colliders = collectCollidersForStep(layer, t0, t1, comp, project, nodeEval1);

    const secondaryCount = clamp(Math.round(pd.secondaryOnHitCount ?? 2), 0, 6);
    const hitLifeMult = clamp(pd.hitLifeMultiplier ?? 0.78, 0.05, 1.5);
    const onHitColor = pd.onHitColor || null;

    const surviving = [];
    const spawnedSecondary = [];

    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      p.age += SIM_DT;
      if (p.age >= p.life) continue;

      // Sum accelerations: Gravity + Directional + Attractor/Repulsor + 2.8 Spatial Fields!
      let ax = gravity[0] + dirForce[0];
      let ay = gravity[1] + dirForce[1];
      let az = (gravity[2] || 0) + (dirForce[2] || 0);

      if (attrEnabled && Math.abs(attrStrength) > 1e-3) {
        const toA = Vec3.sub(attrPos, p.pos);
        const d = Math.max(25, Vec3.len(toA));
        const f = (attrStrength * 1200) / (d * 1.2);
        ax += (toA[0] / d) * f;
        ay += (toA[1] / d) * f;
        az += (toA[2] / d) * f;
      }

      if (sceneFields.length > 0) {
        const fv = Geo3D.evaluateFieldsAtPoint(sceneFields, p.pos, t1);
        ax += fv[0] * fieldGain;
        ay += fv[1] * fieldGain;
        az += fv[2] * fieldGain;
      }

      const damp = Math.exp(-drag * SIM_DT);
      p.vel[0] = (p.vel[0] + ax * SIM_DT) * damp;
      p.vel[1] = (p.vel[1] + ay * SIM_DT) * damp;
      p.vel[2] = (p.vel[2] + az * SIM_DT) * damp;

      const nextPos = [
        p.pos[0] + p.vel[0] * SIM_DT,
        p.pos[1] + p.vel[1] * SIM_DT,
        p.pos[2] + p.vel[2] * SIM_DT
      ];

      if (colliders.length > 0) {
        const hit = collideSegment(p.pos, nextPos, colliders);
        if (hit) {
          const N = hit.normal;
          const vRel = Vec3.sub(p.vel, hit.surfVel);
          const vnScalar = Vec3.dot(vRel, N);
          if (vnScalar < 0) {
            const vN = Vec3.scale(N, vnScalar);
            const vT = Vec3.sub(vRel, vN);
            const newRel = Vec3.add(
              Vec3.scale(vN, -hit.bounce),
              Vec3.scale(vT, Math.max(0, 1 - hit.friction))
            );
            p.vel = Vec3.add(hit.surfVel, newRel);
          }
          const remDt = (1 - hit.frac) * SIM_DT;
          p.pos = Vec3.addScaled(Vec3.addScaled(hit.point, N, 1.2), p.vel, remDt);

          // On-hit triggers: color shift, lifetime change & deterministic secondary spark burst!
          p.hitCount++;
          p.life = Math.max(p.age + 0.04, p.life * hitLifeMult);
          if (onHitColor) p.tintOverride = [...onHitColor];

          if (p.gen === 0 && p.hitCount === 1 && secondaryCount > 0 && Vec3.len(vRel) > 95 && state.particles.length + spawnedSecondary.length < 2400) {
            const hRng = mulberry32(hashCombine(p.seed, stepIdx + 91));
            const reflAxis = Vec3.norm(p.vel);
            for (let s = 0; s < secondaryCount; s++) {
              const sDir = sampleConeDirection(reflAxis, 42, hRng);
              const sSpd = Vec3.len(p.vel) * (0.45 + 0.45 * hRng());
              const sPos = Vec3.addScaled(hit.point, N, 2.0);
              spawnedSecondary.push({
                id: state.nextPid++,
                gen: 1,
                age: 0,
                life: Math.max(0.12, (p.life - p.age) * (0.45 + 0.35 * hRng())),
                pos: sPos,
                vel: Vec3.scale(sDir, sSpd),
                sizeBase: p.sizeBase * 0.55,
                seed: Math.floor(hRng() * 1e9),
                hitCount: 1,
                tintOverride: onHitColor ? [...onHitColor] : [1.0, 0.85, 0.4],
                emitterIdx: p.emitterIdx,
                trail: [[sPos[0], sPos[1], sPos[2]]]
              });
            }
          }
        } else {
          p.pos = nextPos;
        }
      } else {
        p.pos = nextPos;
      }

      // Record actual world-space trajectory for 3D Trails!
      p.trail.push([p.pos[0], p.pos[1], p.pos[2]]);
      if (p.trail.length > maxTrailPts) {
        p.trail.splice(0, p.trail.length - maxTrailPts);
      }

      surviving.push(p);
    }

    for (const sp of spawnedSecondary) surviving.push(sp);
    state.particles = surviving;
    state.step = stepIdx + 1;
    return state;
  }

  // Evaluate color/size/opacity over normalized particle age u in [0, 1]
  function evalParticleAppearance(p, pd) {
    const u = clamp(p.age / Math.max(1e-4, p.life), 0, 1);

    // Size over life (start -> mid -> end)
    const s0 = pd.sizeStart ?? 1.0;
    const s1 = pd.sizeMid ?? 0.85;
    const s2 = pd.sizeEnd ?? 0.1;
    const sizeScale = u < 0.5 ? lerp(s0, s1, u * 2) : lerp(s1, s2, (u - 0.5) * 2);
    const radius = Math.max(0.4, p.sizeBase * sizeScale);

    // Opacity over life
    const o0 = pd.opacityStart ?? 1.0;
    const o1 = pd.opacityMid ?? 0.9;
    const o2 = pd.opacityEnd ?? 0.0;
    const alpha = clamp(u < 0.5 ? lerp(o0, o1, u * 2) : lerp(o1, o2, (u - 0.5) * 2), 0, 1);

    // Multi-stop Color over life
    const stops = pd.colorStops || [
      { t: 0.0, color: [1.0, 0.96, 0.78] },
      { t: 0.28, color: [1.0, 0.55, 0.12] },
      { t: 0.72, color: [0.92, 0.2, 0.04] },
      { t: 1.0, color: [0.25, 0.06, 0.02] }
    ];
    let col = stops[stops.length - 1].color;
    for (let i = 0; i < stops.length - 1; i++) {
      if (u >= stops[i].t && u <= stops[i + 1].t) {
        const f = (u - stops[i].t) / Math.max(1e-5, stops[i + 1].t - stops[i].t);
        col = Vec3.lerp(stops[i].color, stops[i + 1].color, f);
        break;
      }
    }
    if (p.tintOverride) {
      col = Vec3.lerp(col, p.tintOverride, 0.45);
    }

    return { radius, alpha, color: col };
  }

  // PUBLIC ENTRY: Deterministic, pure read-only sampling at arbitrary timestamp `t`!
  function sampleParticleLayerAtTime(layer, t, comp, project) {
    if (!layer || !layer.particleData) return { particles: [], pd: {} };
    if (t < (layer.inPoint ?? 0) || t > (layer.outPoint ?? comp.duration)) {
      return { particles: [], pd: layer.particleData };
    }

    const sig = computeParticleSignature(layer, comp, project);
    let cache = _simCaches.get(layer.id);
    if (!cache || cache.sig !== sig) {
      const initState = { step: 0, nextPid: 1, emitAccum: [], particles: [] };
      cache = {
        sig,
        checkpoints: new Map([[0, cloneSimState(initState)]]),
        maxCheckpointStep: 0
      };
      _simCaches.set(layer.id, cache);
    }

    const clampedT = Math.max(0, t);
    const exactStep = clampedT / SIM_DT;
    const stepA = Math.floor(exactStep);
    const frac = exactStep - stepA;

    // Find highest cached checkpoint <= stepA
    let cpStep = Math.floor(stepA / CHECKPOINT_STRIDE) * CHECKPOINT_STRIDE;
    while (cpStep > 0 && !cache.checkpoints.has(cpStep)) {
      cpStep -= CHECKPOINT_STRIDE;
    }

    // Advance from cpStep to stepA (saving immutable checkpoints along the way!)
    let working = cloneSimState(cache.checkpoints.get(cpStep));
    while (working.step < stepA) {
      advanceParticleStep(working, working.step, layer, comp, project);
      if (working.step % CHECKPOINT_STRIDE === 0 && !cache.checkpoints.has(working.step)) {
        cache.checkpoints.set(working.step, cloneSimState(working));
      }
    }

    // For sub-step accuracy (crucial for smooth 60fps & Motion Blur sub-frame streaks!),
    // interpolate between stepA and stepA + 1 on a throwaway clone!
    const pd = layer.particleData;
    if (frac <= 1e-4) {
      const rendered = working.particles.map((p) => {
        const app = evalParticleAppearance(p, pd);
        return {
          id: p.id,
          pos: p.pos,
          vel: p.vel,
          radius: app.radius,
          color: app.color,
          alpha: app.alpha,
          trail: p.trail
        };
      });
      return { particles: rendered, pd };
    }

    const stateA = working;
    const stateB = cloneSimState(working);
    advanceParticleStep(stateB, stateB.step, layer, comp, project);

    const mapA = new Map();
    for (const pa of stateA.particles) mapA.set(pa.id, pa);

    const rendered = [];
    for (const pb of stateB.particles) {
      const pa = mapA.get(pb.id);
      const pos = pa ? Vec3.lerp(pa.pos, pb.pos, frac) : pb.pos;
      const age = pa ? lerp(pa.age, pb.age, frac) : pb.age * frac;
      const app = evalParticleAppearance({ ...pb, age }, pd);
      let trail = pb.trail;
      if (pa && pa.trail.length > 0) {
        trail = pa.trail.slice();
        trail.push(pos);
      }
      rendered.push({
        id: pb.id,
        pos,
        vel: pb.vel,
        radius: app.radius,
        color: app.color,
        alpha: app.alpha,
        trail
      });
    }

    return { particles: rendered, pd };
  }

  Forge.Particles = {
    SIM_DT,
    invalidateAllParticleCaches,
    sampleParticleLayerAtTime
  };
})();
