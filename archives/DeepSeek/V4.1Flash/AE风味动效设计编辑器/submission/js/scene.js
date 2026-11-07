/* PRISM scene building: world meshes, emitters, colliders */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, G = AE.G, T = AE.Text, Mesh = AE.Mesh, E = AE.Eval, P = AE.P;
  const B = (AE.Build = {});
  const BASE_CACHE = new Map();
  function cachedMesh(key, fn) {
    if (BASE_CACHE.has(key)) { const v = BASE_CACHE.get(key); BASE_CACHE.delete(key); BASE_CACHE.set(key, v); return v; }
    const v = fn();
    BASE_CACHE.set(key, v);
    if (BASE_CACHE.size > 90) BASE_CACHE.delete(BASE_CACHE.keys().next().value);
    return v;
  }
  B.clearCache = () => BASE_CACHE.clear();

  function meshCacheFor(opts) { return (opts && opts.cache) || new Map(); }

  B.layerWorldMesh = function (comp, layer, time, ctx, opts = {}) {
    const cache = meshCacheFor(opts);
    const key = layer.id + '|' + time.toFixed(4) + '|' + (ctx.project._rev || 0);
    if (cache.has(key)) return cache.get(key);
    let result = null;
    try { result = buildLayer(comp, layer, time, ctx, opts); } catch (e) { console.warn('mesh build', layer.name, e); result = null; }
    cache.set(key, result);
    if (cache.size > 64) cache.delete(cache.keys().next().value);
    return result;
  };

  function buildLayer(comp, layer, time, ctx, opts) {
    if (!layer) return null;
    const type = layer.type;
    if (type === 'geo') return buildGeo(comp, layer, time, ctx, opts);
    if (type === 'text') {
      const extrude = E.num(E.propValue(layer, 'text.extrude', ctx, time));
      if (layer.threeD || extrude > 0) return buildTextMesh(comp, layer, time, ctx, opts);
      return null;
    }
    if (type === 'shape') {
      if (layer.threeD) return buildShapeMesh(comp, layer, time, ctx, opts);
      return null;
    }
    if (type === 'nodes') {
      return buildNodes(comp, layer, time, ctx, opts);
    }
    if (type === 'precomp' && layer.precomp.mode === 'preserve3d') {
      return buildPrecomp3D(comp, layer, time, ctx, opts);
    }
    return null;
  }

  function getFields(comp, layer, ctx, time) {
    const list = [];
    for (const fid of ((layer.geo && layer.geo.fields) || [])) {
      const fl = comp.layers.find(l => l.id === fid && l.type === 'field');
      if (fl) list.push(E.fieldState(comp, fl, ctx, time));
    }
    return list;
  }
  function getPins(layer, ctx, time) {
    return ((layer.geo && layer.geo.pins) || []).map(pin => ({
      ...pin,
      offset: E.vec(E.propValue(layer, `pin.${pin.id}.offset`, ctx, time) || [0, 0, 0], 3).map(E.num),
      rot: E.vec(E.propValue(layer, `pin.${pin.id}.rot`, ctx, time) || [0, 0, 0], 3).map(E.num),
      radius: E.num(E.propValue(layer, `pin.${pin.id}.radius`, ctx, time)),
      rigidity: E.num(E.propValue(layer, `pin.${pin.id}.rigidity`, ctx, time))
    }));
  }
  function deformLocal(layer, mesh, comp, ctx, time) {
    let m = mesh;
    const spin = E.num(E.propValue(layer, 'geo.spin', ctx, time));
    if (spin) m = Mesh.transform(m, M.rotateZ(U.rad(spin)));
    const bend = E.num(E.propValue(layer, 'geo.bend', ctx, time));
    const twist = E.num(E.propValue(layer, 'geo.twist', ctx, time));
    const axis = E.propValue(layer, 'geo.bendAxis', ctx, time) || 'y';
    if (bend) m = Mesh.applyBend(m, bend, axis);
    if (twist) m = Mesh.applyTwist(m, twist, axis === 'x' ? 'y' : axis === 'z' ? 'z' : 'y');
    const pins = getPins(layer, ctx, time);
    if (pins.length) m = Mesh.applyPins(m, pins, {});
    return m;
  }
  function toWorldDeform(comp, layer, mesh, ctx, time) {
    const matrix = E.worldMatrix(comp, layer, ctx, time);
    let m = Mesh.transform(mesh, matrix);
    const fields = getFields(comp, layer, ctx, time);
    if (fields.length) m = Mesh.applyField(m, fields, time);
    return { mesh: m, matrix: M.identity(), worldMatrix: matrix, fields };
  }

  function buildShapeMesh(comp, layer, time, ctx, opts) {
    const content = E.evalContents(layer, ctx, time);
    const contours = [];
    for (const it of content.items) for (const c of it.shape.contours) contours.push(c);
    if (!contours.length) return null;
    const extrude = Math.max(1, E.num(E.propValue(layer, 'shape.extrude', ctx, time)));
    const bevel = E.num(E.propValue(layer, 'shape.bevel', ctx, time));
    let mesh = Mesh.extrudeShape({ contours }, { depth: extrude, bevel });
    mesh = deformLocal(layer, mesh, comp, ctx, time);
    const w = toWorldDeform(comp, layer, mesh, ctx, time);
    return { objects: [{ mesh: w.mesh, matrix: M.identity(), material: E.material(layer, ctx, time), castShadow: true, receiveShadow: true, layer, worldMatrix: w.worldMatrix }], worldMatrix: w.worldMatrix, sourceLayer: layer };
  }

  function buildTextMesh(comp, layer, time, ctx, opts) {
    const layout = E.textLayout(layer, ctx, time);
    const extrude = Math.max(1, E.num(E.propValue(layer, 'text.extrude', ctx, time)));
    const bevel = E.num(E.propValue(layer, 'text.bevel', ctx, time));
    const animated = (layer.text.animators || []).length > 0 || layer.text.onPath;
    const key = 'text|' + (layer.text.content || '') + '|' + layer.text.font + '|' + layer.text.weight + '|' + Math.round(layout.style.fontSize * 10) + '|' + Math.round(layout.style.tracking * 10) + '|' + Math.round(extrude * 10) + '|' + Math.round(bevel * 10) + '|' + (animated ? time.toFixed(2) : '');
    let mesh = cachedMesh(key, () => {
      const shape = T.outlineShape(layout, {});
      if (!shape.contours.length) return null;
      return Mesh.extrudeShape(shape, { depth: extrude, bevel });
    });
    if (!mesh) return null;
    mesh = cloneMesh(mesh);
    mesh = deformLocal(layer, mesh, comp, ctx, time);
    const w = toWorldDeform(comp, layer, mesh, ctx, time);
    const mat = E.material(layer, ctx, time);
    if (layer.type === 'text' && (layer.threeD || extrude > 0)) {
      mat.slots.front.baseColor = U.lerpColor(U.colorArr(E.propValue(layer, 'text.fillColor', ctx, time)), mat.slots.front.baseColor, .5);
    }
    return { objects: [{ mesh: w.mesh, matrix: M.identity(), material: mat, castShadow: true, receiveShadow: true, layer, worldMatrix: w.worldMatrix, text: true }], worldMatrix: w.worldMatrix, sourceLayer: layer, layout };
  }
  function cloneMesh(m) {
    return { pos: new Float32Array(m.pos), nrm: new Float32Array(m.nrm), uv: new Float32Array(m.uv), region: new Float32Array(m.region), idx: new Uint32Array(m.idx), bbox: m.bbox };
  }

  function buildGeo(comp, layer, time, ctx, opts) {
    const kind = layer.geo.kind;
    let mesh = null;
    const width = E.num(E.propValue(layer, 'geo.width', ctx, time));
    const height = E.num(E.propValue(layer, 'geo.height', ctx, time));
    const depth = E.num(E.propValue(layer, 'geo.depth', ctx, time));
    const radius = E.num(E.propValue(layer, 'geo.radius', ctx, time));
    const tube = E.num(E.propValue(layer, 'geo.tube', ctx, time));
    const seg = Math.max(6, Math.round(E.num(E.propValue(layer, 'geo.segments', ctx, time))));
    const rings = Math.max(4, Math.round(E.num(E.propValue(layer, 'geo.rings', ctx, time))));
    const bevel = E.num(E.propValue(layer, 'geo.bevel', ctx, time));
    if (kind === 'box') mesh = Mesh.box(width, height, depth);
    else if (kind === 'sphere') mesh = Mesh.sphere(radius, seg, rings);
    else if (kind === 'torus') mesh = Mesh.torus(radius, tube, seg * 2, rings);
    else if (kind === 'cylinder') mesh = Mesh.cylinder(radius, height, seg);
    else if (kind === 'plane') mesh = Mesh.plane(width, height, Math.max(1, Math.round(seg / 2)), Math.max(1, Math.round(rings / 2)));
    else if (kind === 'text') return buildTextMesh(comp, layer, time, ctx, opts);
    else if (kind === 'nodes') return buildNodes(comp, layer, time, ctx, opts);
    else if (kind === 'extrude' || kind === 'pathSolid') {
      let shape = null;
      if (layer.geo.sourceLayerId) {
        const src = comp.layers.find(l => l.id === layer.geo.sourceLayerId);
        if (src && (src.type === 'shape' || src.type === 'text')) {
          if (src.type === 'shape') {
            const c = E.evalContents(src, ctx, time);
            shape = { contours: c.items.flatMap(it => it.shape.contours) };
          } else {
            const layout = E.textLayout(src, ctx, time);
            shape = T.outlineShape(layout, {});
          }
        }
      }
      if (!shape) {
        const prop = E.propValue(layer, 'geo.path', ctx, time);
        if (prop && prop.contours) shape = prop;
      }
      if (!shape || !shape.contours.length) mesh = Mesh.box(width, height, Math.max(2, depth));
      else mesh = Mesh.extrudeShape(shape, { depth: Math.max(.5, depth), bevel });
    }
    if (!mesh) mesh = Mesh.box(width, height, depth);
    const instances = Math.round(E.num(E.propValue(layer, 'geo.instances', ctx, time)) || 0);
    if (instances > 0) {
      const instRadius = E.num(E.propValue(layer, 'geo.instRadius', ctx, time));
      const instSize = E.num(E.propValue(layer, 'geo.instSize', ctx, time));
      const wave = E.num(E.propValue(layer, 'geo.instWave', ctx, time));
      const bbox = Mesh.computeBBox(mesh);
      const baseSize = Math.max(.001, Math.max(bbox.size[0], bbox.size[1], bbox.size[2]));
      const placements = [];
      for (let i = 0; i < instances; i++) {
        const a = i / instances * Math.PI * 2;
        const r = instRadius + Math.sin(i * 2.1) * wave;
        placements.push({
          pos: [Math.cos(a) * r, Math.sin(a) * r, 0],
          rot: [0, 0, a + Math.PI / 2],
          scale: instSize / baseSize * (1 + Math.sin(i * 1.3) * wave * .002)
        });
      }
      mesh = Mesh.instances(mesh, placements, {});
    }
    mesh = deformLocal(layer, mesh, comp, ctx, time);
    const w = toWorldDeform(comp, layer, mesh, ctx, time);
    const mat = E.material(layer, ctx, time);
    return { objects: [{ mesh: w.mesh, matrix: M.identity(), material: mat, castShadow: true, receiveShadow: true, layer, worldMatrix: w.worldMatrix }], worldMatrix: w.worldMatrix, sourceLayer: layer };
  }

  function buildNodes(comp, layer, time, ctx, opts) {
    const graph = P.findGraph(ctx.project, layer.nodeGraphId);
    if (!graph) return null;
    const res = AE.Nodes.evalGraph(ctx.project, graph, ctx);
    if (!res.mesh) return { objects: [], graph: res, worldMatrix: E.worldMatrix(comp, layer, ctx, time), sourceLayer: layer, error: res.error };
    let mesh = deformLocal(layer, res.mesh, comp, ctx, time);
    const w = toWorldDeform(comp, layer, mesh, ctx, time);
    return { objects: [{ mesh: w.mesh, matrix: M.identity(), material: E.material(layer, ctx, time), castShadow: true, receiveShadow: true, layer, worldMatrix: w.worldMatrix }], worldMatrix: w.worldMatrix, sourceLayer: layer, graph: res };
  }

  function buildPrecomp3D(comp, outerLayer, time, ctx, opts) {
    const inner = P.findComp(ctx.project, outerLayer.precomp.compId);
    if (!inner) return null;
    const innerTime = E.innerTime(comp, outerLayer, time, ctx);
    const overrides = buildOverrides(ctx.project, inner, outerLayer);
    const ictx = E.makeCtx(ctx.project, inner, innerTime, { overrides, depth: (ctx.depth || 0) + 1 });
    const outerMatrix = E.worldMatrix(comp, outerLayer, ctx, time);
    const objects = [];
    for (const il of inner.layers) {
      if (!il.visible || il.type === 'camera' || il.type === 'light' || il.type === 'field') continue;
      if (innerTime < il.inPoint - 1e-6 || innerTime > il.outPoint + 1e-6) continue;
      if (!(il.type === 'geo' || il.type === 'nodes' || (il.type === 'shape' && il.threeD) || (il.type === 'text' && il.threeD) || (il.type === 'precomp' && il.precomp.mode === 'preserve3d'))) continue;
      const sub = B.layerWorldMesh(inner, il, innerTime, ictx, { cache: opts.cache });
      if (!sub || !sub.objects) continue;
      for (const obj of sub.objects) {
        objects.push({ ...obj, mesh: Mesh.transform(obj.mesh, outerMatrix), worldMatrix: M.mult(outerMatrix, obj.worldMatrix || M.identity()), innerLayer: il, precompLayer: outerLayer });
      }
    }
    return { objects, worldMatrix: outerMatrix, sourceLayer: outerLayer, inner, innerTime };
  }

  function buildOverrides(project, inner, outerLayer) {
    const ov = {};
    const params = inner.params || [];
    for (const p of params) {
      const val = outerLayer.precomp && outerLayer.precomp.overrides ? outerLayer.precomp.overrides[p.id] : undefined;
      if (val === undefined || val === null) continue;
      if (!ov[p.layerId]) ov[p.layerId] = {};
      ov[p.layerId][p.key] = val;
    }
    return Object.keys(ov).length ? ov : null;
  }
  B.buildOverrides = buildOverrides;

  // flatten all meshes for a layer/comp into world space
  B.collectWorld = function (comp, time, ctx, opts = {}) {
    const objects = [], particles = [];
    for (const layer of comp.layers) {
      if (!E.isActive(comp, layer, time)) continue;
      if (layer.type === 'geo' || layer.type === 'nodes' || ((layer.type === 'shape' || layer.type === 'text') && layer.threeD)) {
        const r = B.layerWorldMesh(comp, layer, time, ctx, opts);
        if (r && r.objects) for (const o of r.objects) objects.push(o);
      } else if (layer.type === 'precomp' && layer.precomp.mode === 'preserve3d') {
        const r = B.layerWorldMesh(comp, layer, time, ctx, opts);
        if (r && r.objects) for (const o of r.objects) objects.push(o);
      }
    }
    return objects;
  };

  // source for particles
  B.sourceCache = new Map();
  B.getParticleSource = function (comp, layerId, time, ctx) {
    const q = Math.round(time * 15) / 15;
    const key = comp.id + '|' + layerId + '|' + q + '|' + (ctx.project._rev || 0);
    if (B.sourceCache.has(key)) {
      const v = B.sourceCache.get(key); B.sourceCache.delete(key); B.sourceCache.set(key, v); return v;
    }
    const layer = comp.layers.find(l => l.id === layerId);
    const qctx = E.makeCtx(ctx.project, comp, q, { overrides: ctx.overrides, depth: ctx.depth });
    let out = null;
    if (layer) {
      try {
        if (layer.type === 'geo' || layer.type === 'nodes' || (layer.type === 'text' && layer.threeD) || (layer.type === 'shape' && layer.threeD)) {
          const r = B.layerWorldMesh(comp, layer, q, qctx, { cache: new Map() });
          if (r && r.objects) {
            const meshes = r.objects.map(o => o.mesh);
            if (layer.type === 'shape' && !layer.threeD) {
              const c = E.evalContents(layer, qctx, q);
              const aff = E.worldAffine(comp, layer, qctx, q);
              const paths = c.items.flatMap(it => G.flattenShape(it.shape, 8)).map(poly => poly.map(p => { const q2 = U.affine.apply(aff, p[0], p[1]); return [q2[0], q2[1], 0]; }));
              out = { paths };
            } else {
              out = { mesh: meshes.length > 1 ? Mesh.merge(meshes) : meshes[0], paths: [] };
            }
          }
        } else if (layer.type === 'shape') {
          const c = E.evalContents(layer, qctx, q);
          const aff = E.worldAffine(comp, layer, qctx, q);
          const paths = c.items.flatMap(it => G.flattenShape(it.shape, 8)).map(poly => poly.map(p => { const q2 = U.affine.apply(aff, p[0], p[1]); return [q2[0], q2[1], 0]; }));
          out = { paths };
        } else if (layer.type === 'text') {
          const layout = E.textLayout(layer, qctx, q);
          const aff = E.worldAffine(comp, layer, qctx, q);
          const pts = [];
          for (const gl of layout.glyphs) if (gl.g) pts.push(U.affine.apply(aff, gl.cx, gl.cy).concat([0]));
          out = { points: pts };
        } else if (layer.type === 'precomp') {
          const inner = P.findComp(ctx.project, layer.precomp.compId);
          if (inner) {
            const overrides = buildOverrides(ctx.project, inner, layer);
            const it = E.innerTime(comp, layer, q, qctx);
            const ictx = E.makeCtx(ctx.project, inner, it, { overrides, depth: 2 });
            const outer = E.worldMatrix(comp, layer, qctx, q);
            const meshes = [];
            for (const il of inner.layers) {
              if (il.type === 'geo' || il.type === 'nodes') {
                const r = B.layerWorldMesh(inner, il, it, ictx, { cache: new Map() });
                if (r) for (const o of r.objects) meshes.push(Mesh.transform(o.mesh, outer));
              }
            }
            if (meshes.length) out = { mesh: Mesh.merge(meshes) };
          }
        }
      } catch (e) { console.warn('source build', e); }
    }
    B.sourceCache.set(key, out);
    if (B.sourceCache.size > 80) B.sourceCache.delete(B.sourceCache.keys().next().value);
    return out;
  };

  B.particleSources = (comp, ctx) => ({
    getSource: (layerId, t) => B.getParticleSource(comp, layerId, t, ctx)
  });

  B.layerPinWorld = (comp, layer, pin, ctx, time) => {
    const m = E.worldMatrix(comp, layer, ctx, time);
    const p = M.transformPoint(m, pin.rest || [0, 0, 0]);
    const off = E.vec(E.propValue(layer, `pin.${pin.id}.offset`, ctx, time) || [0, 0, 0], 3).map(E.num);
    return { world: M.add(p, off), local: pin.rest, offset: off, radius: E.num(E.propValue(layer, `pin.${pin.id}.radius`, ctx, time)), rigidity: E.num(E.propValue(layer, `pin.${pin.id}.rigidity`, ctx, time)) };
  };
  AE.Build = B;
})();
