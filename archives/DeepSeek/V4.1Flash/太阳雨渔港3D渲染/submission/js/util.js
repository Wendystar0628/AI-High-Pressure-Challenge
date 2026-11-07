/* =========================================================
   汐見漁港 — utility library
   Classic script (no modules) so the page runs from file://
   ========================================================= */
window.H = window.H || {};
(function (H) {
  'use strict';

  H.TAU = Math.PI * 2;

  H.lerp = function (a, b, t) { return a + (b - a) * t; };
  H.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  H.smoothstep = function (a, b, x) {
    var t = H.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  H.sat = function (v) { return H.clamp(v, 0, 1); };
  H.easeInOut = function (t) { t = H.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  H.easeOut = function (t) { t = H.clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };

  // deterministic PRNG -------------------------------------------------
  H.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  H.rnd = H.mulberry32(20240607);
  H.rr = function (a, b) { return a + (b - a) * H.rnd(); };
  H.pick = function (arr) { return arr[(H.rnd() * arr.length) | 0]; };

  // simple 2d value noise ---------------------------------------------
  H.makeNoise = function (seed) {
    var rand = H.mulberry32(seed);
    var perm = new Uint8Array(512);
    var vals = new Float32Array(256);
    var i;
    for (i = 0; i < 256; i++) { perm[i] = i; vals[i] = rand(); }
    for (i = 255; i > 0; i--) {
      var j = (rand() * (i + 1)) | 0;
      var t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    function v(ix, iy) { return vals[perm[(ix & 255) + perm[iy & 255]]]; }
    function n2(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y);
      var fx = x - ix, fy = y - iy;
      var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      var a = v(ix, iy), b = v(ix + 1, iy), c = v(ix, iy + 1), d = v(ix + 1, iy + 1);
      return H.lerp(H.lerp(a, b, ux), H.lerp(c, d, ux), uy);
    }
    n2.fbm = function (x, y, oct, gain) {
      oct = oct || 4; gain = gain || 0.5;
      var sum = 0, amp = 1, norm = 0;
      for (var k = 0; k < oct; k++) {
        sum += n2(x, y) * amp; norm += amp;
        x *= 2.03; y *= 1.97; amp *= gain;
      }
      return sum / norm;
    };
    return n2;
  };

  // canvas texture helper ---------------------------------------------
  H.tex = function (w, h, draw, opts) {
    opts = opts || {};
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    draw(ctx, w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    if (opts.nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; }
    t.needsUpdate = true;
    return t;
  };

  // rounded box geometry ----------------------------------------------
  H.roundedBox = function (w, h, d, r, seg) {
    r = Math.min(r, w * 0.45, h * 0.45);
    seg = seg || 2;
    var s = new THREE.Shape();
    var x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return new THREE.ExtrudeGeometry(s, {
      depth: d, bevelEnabled: true, bevelSegments: 1,
      steps: 1, bevelSize: Math.min(0.02, r * 0.5),
      bevelThickness: Math.min(0.02, d * 0.25), curveSegments: seg
    }).translate(0, 0, -d / 2);
  };

  // mesh helpers -------------------------------------------------------
  H.group = function (parent, x, y, z) {
    var g = new THREE.Group();
    if (x) g.position.x = x;
    if (y) g.position.y = y;
    if (z) g.position.z = z;
    if (parent) parent.add(g);
    return g;
  };

  H.mesh = function (geo, mat, parent, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  };

  H.box = function (w, h, d, mat, parent, x, y, z) {
    return H.mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z);
  };
  H.cyl = function (rt, rb, h, seg, mat, parent, x, y, z) {
    return H.mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat, parent, x, y, z);
  };
  H.sphere = function (r, mat, parent, x, y, z, ws, hs) {
    return H.mesh(new THREE.SphereGeometry(r, ws || 16, hs || 12), mat, parent, x, y, z);
  };
  H.plane = function (w, h, mat, parent, x, y, z) {
    return H.mesh(new THREE.PlaneGeometry(w, h), mat, parent, x, y, z);
  };
  H.tube = function (pts, r, mat, parent, seg) {
    var curve = new THREE.CatmullRomCurve3(pts);
    var g = new THREE.TubeGeometry(curve, seg || 24, r, 5, false);
    return H.mesh(g, mat, parent);
  };

  // face a plane down +Y -------------------------------------------------
  H.floorPlane = function (w, d, mat, parent, x, y, z) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x || 0, y || 0, z || 0);
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  };

  // materials ------------------------------------------------------------
  var gradData = new Uint8Array([
    132, 132, 132, 255,
    170, 170, 170, 255,
    214, 214, 214, 255,
    255, 255, 255, 255
  ]);
  H.grad = new THREE.DataTexture(gradData, 4, 1, THREE.RGBAFormat);
  H.grad.minFilter = THREE.NearestFilter;
  H.grad.magFilter = THREE.NearestFilter;
  H.grad.needsUpdate = true;

  H.toon = function (color, opts) {
    var p = Object.assign({ color: color, gradientMap: H.grad }, opts || {});
    return new THREE.MeshToonMaterial(p);
  };
  H.basic = function (color, opts) {
    return new THREE.MeshBasicMaterial(Object.assign({ color: color }, opts || {}));
  };
  H.emissive = function (color, intensity, opts) {
    return new THREE.MeshBasicMaterial(Object.assign({ color: color, toneMapped: false }, opts || {}));
  };
  H.glass = function (color, opacity, opts) {
    return new THREE.MeshPhongMaterial(Object.assign({
      color: color || 0xd9f2ee, transparent: true, opacity: opacity === undefined ? 0.18 : opacity,
      shininess: 120, specular: 0xffffff, depthWrite: false,
      side: THREE.DoubleSide, flatShading: false
    }, opts || {}));
  };

  // outline --------------------------------------------------------------
  H.outlineMat = function (color, thick) {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uColor: { value: new THREE.Color(color || 0x1d3138) }, uThick: { value: thick === undefined ? 0.0016 : thick } }
      ]),
      vertexShader: [
        '#include <common>',
        '#include <fog_pars_vertex>',
        'uniform float uThick;',
        'void main() {',
        '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
        '  vec3 n = normalize(normalMatrix * normal);',
        '  mvPosition.xyz += n * uThick * max(1.0, -mvPosition.z);',
        '  gl_Position = projectionMatrix * mvPosition;',
        '  #include <fog_vertex>',
        '}'
      ].join('\n'),
      fragmentShader: [
        '#include <common>',
        '#include <fog_pars_fragment>',
        'uniform vec3 uColor;',
        'void main() {',
        '  gl_FragColor = vec4(uColor, 1.0);',
        '  #include <fog_fragment>',
        '}'
      ].join('\n'),
      side: THREE.BackSide,
      fog: true
    });
  };

  // add an inverted-hull outline as child of the given mesh
  H.outline = function (mesh, thick, color) {
    if (!mesh || !mesh.geometry) return null;
    if (mesh.userData.noOutline) return null;
    var o = new THREE.Mesh(mesh.geometry, H.outlineMat(color, (thick === undefined ? 0.0016 : thick) * 1.5));
    o.castShadow = false; o.receiveShadow = false;
    o.renderOrder = (mesh.renderOrder || 0) - 0.5;
    mesh.add(o);
    return o;
  };

  H.outlineAll = function (root, thick, filter) {
    var list = [];
    root.traverse(function (o) {
      if (o.isMesh && !o.userData.noOutline) list.push(o);
    });
    list.forEach(function (m) {
      if (m.material && (m.material.transparent || m.material.isShaderMaterial)) return;
      if (filter && !filter(m)) return;
      H.outline(m, thick);
    });
  };

  // text sign ------------------------------------------------------------
  H.textTexture = function (lines, opts) {
    opts = opts || {};
    var w = opts.w || 512, h = opts.h || 256;
    return H.tex(w, h, function (ctx) {
      if (opts.bg) {
        ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      if (opts.border) {
        ctx.strokeStyle = opts.border; ctx.lineWidth = opts.borderWidth || 8;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      }
      if (opts.draw) opts.draw(ctx, w, h);
      var fs = opts.fontSize || 64;
      ctx.textAlign = opts.align || 'center';
      ctx.textBaseline = 'middle';
      lines.forEach(function (line, i) {
        var size = line.size || fs;
        var y = line.y !== undefined ? line.y : (h / 2 + (i - (lines.length - 1) / 2) * (opts.lineHeight || fs * 1.25));
        ctx.font = (line.weight || opts.weight || 'bold') + ' ' + size + 'px ' + (opts.font || '"Yu Gothic","MS Gothic","Noto Sans JP",sans-serif');
        ctx.fillStyle = line.color || opts.color || '#2c3a3c';
        if (line.alpha !== undefined) { ctx.save(); ctx.globalAlpha = line.alpha; }
        if (line.stroke) { ctx.strokeStyle = line.stroke; ctx.lineWidth = line.strokeW || 3; ctx.strokeText(line.text, line.x !== undefined ? line.x : (opts.align === 'left' ? 24 : w / 2), y); }
        ctx.fillText(line.text, line.x !== undefined ? line.x : (opts.align === 'left' ? 24 : w / 2), y);
        if (line.alpha !== undefined) ctx.restore();
      });
    }, { clamp: true });
  };

  H.signPlane = function (w, h, tex, parent, x, y, z) {
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    mat.depthWrite = false;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.renderOrder = 2;
    if (parent) parent.add(m);
    return m;
  };

  // merge a set of (transformed) non-indexed geometries -------------------
  H.mergeGeometries = function (geos) {
    var pos = [], nor = [], uv = [];
    geos.forEach(function (g) {
      var ng = g.index ? g.toNonIndexed() : g;
      if (!ng.attributes.normal) ng.computeVertexNormals();
      var p = ng.attributes.position.array, n = ng.attributes.normal.array;
      for (var i = 0; i < p.length; i++) pos.push(p[i]);
      for (var j = 0; j < n.length; j++) nor.push(n[j]);
      if (ng.attributes.uv) {
        var u = ng.attributes.uv.array;
        for (var k = 0; k < u.length; k++) uv.push(u[k]);
      } else {
        for (var q = 0; q < p.length / 3; q++) { uv.push(0, 0); }
      }
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    return out;
  };

  // small helpers --------------------------------------------------------
  H.jitter = function (obj, amp) {
    obj.rotation.x += H.rr(-amp, amp);
    obj.rotation.y += H.rr(-amp, amp);
    obj.rotation.z += H.rr(-amp, amp);
    return obj;
  };

  H.disposeTree = function (root) {
    root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
        else o.material.dispose();
      }
    });
  };

})(window.H);
