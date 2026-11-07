/* 动态路由塔防 · 零依赖 WebGL 引擎
 * 数学库 / 程序化几何 / 合并网格 / 渲染器 / 粒子 / 轨道相机
 * 全部内联，无外部模块、无 fetch、无纹理，file:// 可直接运行 */
(function () {
  'use strict';
  var TD = window.TD = window.TD || {};

  // ---------------- 4x4 矩阵（列主序） ----------------
  var M4 = {
    create: function () {
      return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    },
    identity: function (o) {
      o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
      o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
      return o;
    },
    multiply: function (o, a, b) {
      for (var c = 0; c < 4; c++) {
        var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      return o;
    },
    perspective: function (o, fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
      o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
      return o;
    },
    lookAt: function (o, eye, center, up) {
      var zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
      var zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
      var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      var xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
      var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
      o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
      o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
      o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      o[15] = 1;
      return o;
    },
    // T * Rz * Ry * Rx * S
    compose: function (o, px, py, pz, rx, ry, rz, sx, sy, sz) {
      var cx = Math.cos(rx), sx_ = Math.sin(rx), cy = Math.cos(ry), sy_ = Math.sin(ry), cz = Math.cos(rz), sz_ = Math.sin(rz);
      var r00 = cz * cy, r01 = -sz_ * cx + cz * sy_ * sx_, r02 = sz_ * sx_ + cz * sy_ * cx;
      var r10 = sz_ * cy, r11 = cz * cx + sz_ * sy_ * sx_, r12 = -cz * sx_ + sz_ * sy_ * cx;
      var r20 = -sy_, r21 = cy * sx_, r22 = cy * cx;
      o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
      o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
      o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
      o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
      return o;
    }
  };
  TD.M4 = M4;

  // ---------------- 程序化几何 ----------------
  function G() { return { p: [], n: [], i: [] }; }
  function Geo() { }

  Geo.box = function (w, h, d) {
    var g = G(), x = w / 2, y = h / 2, z = d / 2, p = g.p, n = g.n, i = g.i;
    function f(a, b, c, d2, nx, ny, nz) {
      var o = p.length / 3;
      p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d2[0], d2[1], d2[2]);
      for (var k = 0; k < 4; k++) n.push(nx, ny, nz);
      i.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    f([x, -y, -z], [x, -y, z], [x, y, z], [x, y, -z], 1, 0, 0);
    f([-x, -y, z], [-x, -y, -z], [-x, y, -z], [-x, y, z], -1, 0, 0);
    f([-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z], 0, 1, 0);
    f([-x, -y, z], [x, -y, z], [x, -y, -z], [-x, -y, -z], 0, -1, 0);
    f([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], 0, 0, 1);
    f([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], 0, 0, -1);
    return g;
  };

  Geo.plane = function (w, d) {
    var g = G(), x = w / 2, z = d / 2;
    g.p.push(-x, 0, z, x, 0, z, x, 0, -z, -x, 0, -z);
    for (var k = 0; k < 4; k++) g.n.push(0, 1, 0);
    g.i.push(0, 1, 2, 0, 2, 3);
    return g;
  };

  Geo.cylinder = function (rt, rb, h, seg, caps) {
    var g = G(), p = g.p, n = g.n, i = g.i, hh = h / 2, o = 0;
    var slope = (rb - rt) / h;
    for (var s = 0; s < seg; s++) {
      var a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var nx0 = c0, nz0 = s0, nx1 = c1, nz1 = s1;
      var nl = Math.hypot(1, slope);
      var v = p.length / 3;
      p.push(rb * c0, -hh, rb * s0, rb * c1, -hh, rb * s1, rt * c1, hh, rt * s1, rt * c0, hh, rt * s0);
      n.push(nx0 / nl, slope / nl, nz0 / nl, nx1 / nl, slope / nl, nz1 / nl,
        nx1 / nl, slope / nl, nz1 / nl, nx0 / nl, slope / nl, nz0 / nl);
      i.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    if (caps !== false) {
      if (rt > 0.0001) {
        var tv = p.length / 3; p.push(0, hh, 0); n.push(0, 1, 0);
        for (var s2 = 0; s2 < seg; s2++) {
          var a = s2 / seg * Math.PI * 2, b = (s2 + 1) / seg * Math.PI * 2;
          p.push(rt * Math.cos(a), hh, rt * Math.sin(a)); n.push(0, 1, 0);
          p.push(rt * Math.cos(b), hh, rt * Math.sin(b)); n.push(0, 1, 0);
          i.push(tv, tv + 1 + s2 * 2, tv + 2 + s2 * 2);
        }
      }
      if (rb > 0.0001) {
        var bv = p.length / 3; p.push(0, -hh, 0); n.push(0, -1, 0);
        for (var s3 = 0; s3 < seg; s3++) {
          var a2 = s3 / seg * Math.PI * 2, b2 = (s3 + 1) / seg * Math.PI * 2;
          p.push(rb * Math.cos(a2), -hh, rb * Math.sin(a2)); n.push(0, -1, 0);
          p.push(rb * Math.cos(b2), -hh, rb * Math.sin(b2)); n.push(0, -1, 0);
          i.push(bv, bv + 2 + s3 * 2, bv + 1 + s3 * 2);
        }
      }
    }
    return g;
  };
  Geo.cone = function (r, h, seg) { return Geo.cylinder(0.0001, r, h, seg, true); };

  Geo.sphere = function (r, su, sv) {
    var g = G(), p = g.p, n = g.n, i = g.i;
    su = su || 12; sv = sv || 8;
    for (var y = 0; y <= sv; y++) {
      var v = y / sv, ph = v * Math.PI, sp = Math.sin(ph), cp = Math.cos(ph);
      for (var x = 0; x <= su; x++) {
        var u = x / su, th = u * Math.PI * 2, st = Math.sin(th), ct = Math.cos(th);
        var nx = st * sp, ny = cp, nz = ct * sp;
        p.push(nx * r, ny * r, nz * r); n.push(nx, ny, nz);
      }
    }
    for (var yy = 0; yy < sv; yy++) for (var xx = 0; xx < su; xx++) {
      var a = yy * (su + 1) + xx, b = a + su + 1;
      i.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return g;
  };

  Geo.torus = function (R, r, su, sv) {
    var g = G(), p = g.p, n = g.n, i = g.i;
    su = su || 20; sv = sv || 8;
    for (var j = 0; j <= su; j++) {
      var u = j / su * Math.PI * 2, cu = Math.cos(u), su_ = Math.sin(u);
      for (var k = 0; k <= sv; k++) {
        var v = k / sv * Math.PI * 2, cv = Math.cos(v), sv_ = Math.sin(v);
        p.push((R + r * cv) * cu, r * sv_, (R + r * cv) * su_);
        n.push(cv * cu, sv_, cv * su_);
      }
    }
    for (var jj = 0; jj < su; jj++) for (var kk = 0; kk < sv; kk++) {
      var a = jj * (sv + 1) + kk, b = a + sv + 1;
      i.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return g;
  };

  // 八面体/晶体
  Geo.octa = function (r) {
    var g = G(), p = g.p, n = g.n, i = g.i;
    var v = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]];
    var faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]];
    for (var f = 0; f < faces.length; f++) {
      var a = v[faces[f][0]], b = v[faces[f][1]], c = v[faces[f][2]];
      var nx = (a[0] + b[0] + c[0]) / 3, ny = (a[1] + b[1] + c[1]) / 3, nz = (a[2] + b[2] + c[2]) / 3;
      var l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      var o = p.length / 3;
      p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      i.push(o, o + 1, o + 2);
    }
    return g;
  };
  TD.Geo = Geo;

  // ---------------- 合并网格构建器 ----------------
  function Builder() {
    this.p = []; this.n = []; this.c = []; this.e = []; this.i = [];
  }
  Builder.prototype.add = function (geo, mat, col, emi) {
    col = col || [1, 1, 1]; emi = emi || 0;
    var m = mat || M4.create(), p = geo.p, n = geo.n, idx = geo.i;
    var base = this.p.length / 3;
    for (var v = 0; v < p.length; v += 3) {
      var x = p[v], y = p[v + 1], z = p[v + 2];
      this.p.push(m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14]);
      var nx = n[v], ny = n[v + 1], nz = n[v + 2];
      this.n.push(m[0] * nx + m[4] * ny + m[8] * nz,
        m[1] * nx + m[5] * ny + m[9] * nz,
        m[2] * nx + m[6] * ny + m[10] * nz);
      this.c.push(col[0], col[1], col[2]); this.e.push(emi);
    }
    for (var k = 0; k < idx.length; k++) this.i.push(base + idx[k]);
    return this;
  };
  Builder.prototype.addBox = function (w, h, d, mat, col, emi) { return this.add(Geo.box(w, h, d), mat, col, emi); };
  Builder.prototype.count = function () { return this.p.length / 3; };
  TD.Builder = Builder;

  // 便捷：构造一个变换矩阵
  function trs(px, py, pz, rx, ry, rz, sx, sy, sz) {
    return M4.compose(M4.create(), px, py, pz, rx || 0, ry || 0, rz || 0,
      sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
  }
  TD.trs = trs;

  // ---------------- 着色器 ----------------
  var VS = [
    'attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute float aEmi;',
    'uniform mat4 uModel; uniform mat4 uVP;',
    'varying vec3 vWorld; varying vec3 vNor; varying vec3 vCol; varying float vEmi;',
    'void main(){ vec4 wp = uModel*vec4(aPos,1.0); vWorld=wp.xyz;',
    ' vNor = mat3(uModel)*aNor; vCol=aCol; vEmi=aEmi; gl_Position=uVP*wp; }'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'varying vec3 vWorld; varying vec3 vNor; varying vec3 vCol; varying float vEmi;',
    'uniform vec3 uCam; uniform vec3 uLight; uniform vec3 uTint; uniform float uAlpha;',
    'uniform float uGlow; uniform float uHit; uniform float uUnlit; uniform float uRim;',
    'uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;',
    'uniform float uTime; uniform float uEnc; uniform float uGrid; uniform float uGridScale;',
    'void main(){',
    ' vec3 N=normalize(vNor); vec3 V=normalize(uCam-vWorld); vec3 L=normalize(uLight);',
    ' vec3 base=vCol*uTint; vec3 col;',
    ' if(uUnlit>0.5){ col = base*(0.72+0.28*vEmi) + base*vEmi*uGlow*0.38; }',
    ' else {',
    '  float ndl=max(dot(N,L),0.0); float hemi=0.5+0.5*N.y;',
    '  vec3 amb=mix(vec3(0.05,0.08,0.14),vec3(0.17,0.23,0.33),hemi);',
    '  vec3 diff=vec3(0.85,0.90,1.00)*ndl*0.68;',
    '  float spec=pow(max(dot(reflect(-L,N),V),0.0),28.0)*0.35;',
    '  float fres=pow(1.0-max(dot(N,V),0.0),3.0);',
    '  col=base*(amb+diff)+vec3(0.7,0.85,1.0)*spec+base*fres*uRim;',
    '  col+=vCol*vEmi*uGlow;',
    ' }',
    ' if(uGrid>0.5){ vec2 f=abs(fract(vWorld.xz*uGridScale)-0.5);',
    '  float ln=1.0-smoothstep(0.0,0.045,min(f.x,f.y));',
    '  col+=vec3(0.10,0.55,0.75)*ln*0.32; }',
    ' if(uEnc>0.5){ float q=0.5+0.5*sin(uTime*13.0+vWorld.y*7.0); col=mix(col,vec3(0.62,0.20,0.92),0.30+q*0.22); }',
    ' col=mix(col,vec3(1.0),uHit);',
    ' float d=length(uCam-vWorld); float fog=clamp((d-uFogNear)/(uFogFar-uFogNear),0.0,1.0);',
    ' col=mix(col,uFog,fog*0.80);',
    ' gl_FragColor=vec4(col,uAlpha); }'
  ].join('\n');

  var PVS = [
    'attribute vec3 aPos; attribute vec3 aCol; attribute float aSize; attribute float aAlpha;',
    'uniform mat4 uVP; uniform float uDpr;',
    'varying vec3 vCol; varying float vAlpha;',
    'void main(){ vec4 p=uVP*vec4(aPos,1.0); gl_Position=p;',
    ' gl_PointSize=clamp(aSize*uDpr*(260.0/max(p.w,0.1)),1.0,120.0);',
    ' vCol=aCol; vAlpha=aAlpha; }'
  ].join('\n');
  var PFS = [
    'precision mediump float; varying vec3 vCol; varying float vAlpha;',
    'void main(){ float d=length(gl_PointCoord-vec2(0.5));',
    ' float a=smoothstep(0.5,0.04,d)*vAlpha; if(a<0.01) discard;',
    ' gl_FragColor=vec4(vCol,a); }'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader error:', gl.getShaderInfoLog(s), src);
    }
    return s;
  }
  function program(gl, vs, fs, attrs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    for (var k = 0; k < attrs.length; k++) gl.bindAttribLocation(p, k, attrs[k]);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error('link error:', gl.getProgramInfoLog(p));
    return p;
  }

  // ---------------- 渲染器 ----------------
  function Renderer(canvas) {
    var gl = canvas.getContext('webgl', { antialias: true, alpha: false, antialiasHint: true, powerPreference: 'high-performance' }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL 不可用');
    this.gl = gl; this.canvas = canvas;
    gl.getExtension('OES_element_index_uint');
    this.prog = program(gl, VS, FS, ['aPos', 'aNor', 'aCol', 'aEmi']);
    this.pProg = program(gl, PVS, PFS, ['aPos', 'aCol', 'aSize', 'aAlpha']);
    this.U = {};
    var names = ['uModel', 'uVP', 'uCam', 'uLight', 'uTint', 'uAlpha', 'uGlow', 'uHit', 'uUnlit',
      'uRim', 'uFog', 'uFogNear', 'uFogFar', 'uTime', 'uEnc', 'uGrid', 'uGridScale'];
    for (var i = 0; i < names.length; i++) this.U[names[i]] = gl.getUniformLocation(this.prog, names[i]);
    this.PU = {
      uVP: gl.getUniformLocation(this.pProg, 'uVP'), uDpr: gl.getUniformLocation(this.pProg, 'uDpr')
    };
    this.pBuf = gl.createBuffer();
    this.VP = M4.create(); this.cam = [0, 20, 30];
    this.light = [0.45, 1.0, 0.35]; this.fog = [0.02, 0.04, 0.09];
    this.fogNear = 34; this.fogFar = 105; this.time = 0;
    this.dpr = 1;
    this._blend = null; this._prog = null;
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }

  Renderer.prototype.createMesh = function (b) {
    var gl = this.gl, m = { count: b.i.length };
    function buf(data, Type) { var x = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, x); gl.bufferData(gl.ARRAY_BUFFER, new Type(data), gl.STATIC_DRAW); return x; }
    m.p = buf(b.p, Float32Array); m.n = buf(b.n, Float32Array);
    m.c = buf(b.c, Float32Array); m.e = buf(b.e, Float32Array);
    m.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(b.i), gl.STATIC_DRAW);
    return m;
  };

  Renderer.prototype.resize = function (w, h, dpr) {
    dpr = dpr || 1; this.dpr = dpr;
    var cw = Math.max(1, Math.floor(w * dpr)), ch = Math.max(1, Math.floor(h * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw; this.canvas.height = ch;
    }
    this.gl.viewport(0, 0, cw, ch);
  };

  Renderer.prototype.setCamera = function (eye, center, fovy, aspect, near, far) {
    this.cam = eye;
    var proj = M4.create(), view = M4.create();
    M4.perspective(proj, fovy, aspect, near || 0.1, far || 400);
    M4.lookAt(view, eye, center, [0, 1, 0]);
    M4.multiply(this.VP, proj, view);
  };

  Renderer.prototype.begin = function (opts) {
    opts = opts || {};
    var gl = this.gl, U = this.U;
    gl.clearColor(this.fog[0], this.fog[1], this.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.prog); this._prog = this.prog;
    gl.uniformMatrix4fv(U.uVP, false, this.VP);
    gl.uniform3fv(U.uCam, this.cam);
    gl.uniform3fv(U.uLight, this.light);
    gl.uniform3fv(U.uFog, this.fog);
    gl.uniform1f(U.uFogNear, opts.fogNear || this.fogNear);
    gl.uniform1f(U.uFogFar, opts.fogFar || this.fogFar);
    gl.uniform1f(U.uTime, this.time);
    this._blend = null;
  };

  Renderer.prototype.draw = function (mesh, model, o) {
    if (!mesh || !mesh.count) return;
    var gl = this.gl, U = this.U, o = o || {};
    var alpha = o.alpha === undefined ? 1 : o.alpha;
    var additive = !!o.additive;
    var bm = additive ? 'add' : (alpha < 0.999 ? 'alpha' : 'none');
    if (bm !== this._blend) {
      if (bm === 'add') { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false); }
      else if (bm === 'alpha') { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      else { gl.disable(gl.BLEND); gl.depthMask(true); }
      this._blend = bm;
    }
    if (o.depthTest === false) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(U.uModel, false, model);
    gl.uniform3fv(U.uTint, o.color || [1, 1, 1]);
    gl.uniform1f(U.uAlpha, alpha);
    gl.uniform1f(U.uGlow, o.glow === undefined ? 0.9 : o.glow);
    gl.uniform1f(U.uHit, o.hit || 0);
    gl.uniform1f(U.uUnlit, o.unlit ? 1 : 0);
    gl.uniform1f(U.uRim, o.rim === undefined ? 0.55 : o.rim);
    gl.uniform1f(U.uEnc, o.enc ? 1 : 0);
    gl.uniform1f(U.uGrid, o.grid ? 1 : 0);
    gl.uniform1f(U.uGridScale, o.gridScale || 0.5);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.p); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.n); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.c); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(2);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.e); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
  };

  // 粒子：arr 每项 {x,y,z,r,g,b,size,alpha}
  Renderer.prototype.particles = function (arr) {
    if (!arr.length) return;
    var gl = this.gl, n = arr.length, data = new Float32Array(n * 8);
    for (var i = 0; i < n; i++) {
      var p = arr[i], k = i * 8;
      data[k] = p.x; data[k + 1] = p.y; data[k + 2] = p.z;
      data[k + 3] = p.r; data[k + 4] = p.g; data[k + 5] = p.b;
      data[k + 6] = p.size; data[k + 7] = p.alpha === undefined ? 1 : p.alpha;
    }
    gl.useProgram(this.pProg); this._prog = this.pProg;
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
    gl.uniformMatrix4fv(this.PU.uVP, false, this.VP);
    gl.uniform1f(this.PU.uDpr, this.dpr);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 24); gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 32, 28); gl.enableVertexAttribArray(3);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
    gl.depthMask(true); gl.disable(gl.BLEND);
    this._blend = null;
    gl.useProgram(this.prog); this._prog = this.prog;
  };

  TD.Renderer = Renderer;

  // ---------------- 轨道相机 ----------------
  function Orbit() {
    this.yaw = 0.62; this.pitch = 0.78; this.dist = 46;
    this.target = [0, 0, 0]; this.fov = 0.82;
    this.minPitch = 0.18; this.maxPitch = 1.45; this.minDist = 12; this.maxDist = 90;
  }
  Orbit.prototype.eye = function () {
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    return [this.target[0] + this.dist * cp * Math.sin(this.yaw),
    this.target[1] + this.dist * sp,
    this.target[2] + this.dist * cp * Math.cos(this.yaw)];
  };
  Orbit.prototype.apply = function (r, aspect) {
    r.setCamera(this.eye(), this.target, this.fov, aspect, 0.1, 500);
  };
  Orbit.prototype.rotate = function (dx, dy) {
    this.yaw -= dx * 0.006; this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy * 0.005));
  };
  Orbit.prototype.pan = function (dx, dy) {
    var s = this.dist * 0.0016;
    var right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
    var fwd = [Math.sin(this.yaw), 0, Math.cos(this.yaw)];
    this.target[0] += (-dx * right[0] + dy * fwd[0]) * s;
    this.target[2] += (-dx * right[2] + dy * fwd[2]) * s;
  };
  Orbit.prototype.zoom = function (d) {
    this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist * (1 + d * 0.0012)));
  };
  TD.Orbit = Orbit;

  // 颜色工具
  TD.col = {
    hex: function (h) {
      h = h.replace('#', '');
      return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
    },
    scale: function (c, k) { return [c[0] * k, c[1] * k, c[2] * k]; },
    mix: function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  };
})();
