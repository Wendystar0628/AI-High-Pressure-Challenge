/* =========================================================
   汐見漁港 — procedural textures (canvas only, works on file://)
   ========================================================= */
(function (H) {
  'use strict';
  H.TEX = {};
  var T = H.TEX;

  function cloneRepeat(tex, rx, ry) {
    var t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    return t;
  }
  H.texRepeat = cloneRepeat;

  function grain(ctx, w, h, n, alpha, dark) {
    for (var i = 0; i < n; i++) {
      var x = Math.random() * w, y = Math.random() * h;
      var r = Math.random() * 1.6 + 0.3;
      var a = Math.random() * alpha;
      ctx.fillStyle = dark ? 'rgba(70,86,82,' + a + ')' : 'rgba(255,255,255,' + a + ')';
      ctx.fillRect(x, y, r, r);
    }
  }

  // ---- wet concrete, horizontal surface --------------------------------
  T.concreteTop = H.tex(512, 512, function (ctx, w, h) {
    var n = H.makeNoise(11);
    var img = ctx.createImageData(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var f = n.fbm(x * 0.012, y * 0.012, 4, 0.55);
        var f2 = n.fbm(x * 0.06 + 11, y * 0.06 + 5, 2, 0.5);
        var v = 158 + f * 44 - f2 * 14;
        var wet = H.smoothstep(0.56, 0.72, n.fbm(x * 0.006 + 7, y * 0.006 + 3, 3, 0.6));
        v -= wet * 22;
        var i = (y * w + x) * 4;
        img.data[i] = v * 1.0;
        img.data[i + 1] = v * 1.035;
        img.data[i + 2] = v * 1.015;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // speckles / aggregate
    for (var k = 0; k < 2600; k++) {
      var sx = Math.random() * w, sy = Math.random() * h;
      var sr = Math.random() * 2.2 + 0.4;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(90,104,100,0.22)' : 'rgba(245,248,244,0.28)';
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.283); ctx.fill();
    }
    // hairline cracks
    ctx.strokeStyle = 'rgba(90,104,100,0.28)'; ctx.lineWidth = 1.2;
    for (var c = 0; c < 5; c++) {
      ctx.beginPath();
      var px = Math.random() * w, py = Math.random() * h;
      ctx.moveTo(px, py);
      for (var s = 0; s < 8; s++) {
        px += (Math.random() - 0.5) * 70; py += Math.random() * 40;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // faint paint / worn marks
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#eef3ec';
    ctx.fillRect(60, 320, 220, 16);
    ctx.fillRect(300, 90, 110, 10);
    ctx.globalAlpha = 1;
    grain(ctx, w, h, 900, 0.18, true);
  });

  // ---- concrete sea wall with tide line --------------------------------
  T.concreteWall = H.tex(1024, 512, function (ctx, w, h) {
    var n = H.makeNoise(23);
    ctx.fillStyle = '#aeb8b1'; ctx.fillRect(0, 0, w, h);
    var rowH = 76;
    var rows = Math.ceil(h / rowH) + 1;
    for (var r = 0; r < rows; r++) {
      var off = (r % 2) * 120;
      for (var bx = -1; bx < 5; bx++) {
        var x0 = bx * 244 + off, y0 = r * rowH;
        var shade = 152 + Math.floor(Math.random() * 28);
        ctx.fillStyle = 'rgb(' + shade + ',' + (shade + 6) + ',' + (shade + 1) + ')';
        ctx.fillRect(x0 + 3, y0 + 3, 238, rowH - 6);
        // subtle mottling inside each block
        ctx.globalAlpha = 0.12;
        for (var q = 0; q < 7; q++) {
          ctx.fillStyle = Math.random() < 0.5 ? '#7c8d87' : '#e8eee7';
          ctx.beginPath();
          ctx.arc(x0 + 20 + Math.random() * 200, y0 + 12 + Math.random() * (rowH - 24), 8 + Math.random() * 26, 0, 6.283);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    // wet/algae band near water line (top 14% of the wall)
    var g = ctx.createLinearGradient(0, 0, 0, h * 0.20);
    g.addColorStop(0, 'rgba(50,86,78,0.55)');
    g.addColorStop(0.55, 'rgba(74,108,94,0.34)');
    g.addColorStop(1, 'rgba(74,108,94,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.2);
    // dark wet streaks running down
    for (var s = 0; s < 34; s++) {
      var sx = Math.random() * w, sy = Math.random() * h * 0.3;
      var len = 30 + Math.random() * 220;
      var gr = ctx.createLinearGradient(sx, sy, sx, sy + len);
      gr.addColorStop(0, 'rgba(58,82,76,0.28)');
      gr.addColorStop(1, 'rgba(58,82,76,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(sx, sy, 2 + Math.random() * 7, len);
    }
    // barnacle dots along the band
    for (var b = 0; b < 420; b++) {
      var by = Math.pow(Math.random(), 2) * h * 0.16;
      var bxx = Math.random() * w;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(226,226,206,0.8)' : 'rgba(156,168,150,0.7)';
      ctx.beginPath(); ctx.arc(bxx, by, 1 + Math.random() * 3.5, 0, 6.283); ctx.fill();
    }
    grain(ctx, w, h, 1800, 0.2, true);
  });

  // ---- cut concrete (side of the diorama base) -------------------------
  T.cutConcrete = H.tex(512, 512, function (ctx, w, h) {
    var n = H.makeNoise(17);
    var img = ctx.createImageData(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var f = n.fbm(x * 0.02, y * 0.02, 4, 0.55);
        var band = Math.sin(y * 0.16) * 2;
        var v = 150 + f * 40 + band;
        var i = (y * w + x) * 4;
        img.data[i] = v; img.data[i + 1] = v * 1.02; img.data[i + 2] = v * 1.005; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // formwork board seams
    ctx.fillStyle = 'rgba(72,86,82,0.30)';
    for (var yy = 0; yy < h; yy += 86) ctx.fillRect(0, yy, w, 2.2);
    ctx.fillStyle = 'rgba(92,104,99,0.16)';
    for (var vx = 0; vx < w; vx += 170) ctx.fillRect(vx, 0, 2, h);
    // formwork tie holes
    for (var ty = 40; ty < h; ty += 172) {
      for (var tx = 52; tx < w; tx += 168) {
        ctx.fillStyle = 'rgba(70,82,78,0.32)'; ctx.beginPath(); ctx.arc(tx, ty, 3.2, 0, 6.28); ctx.fill();
        ctx.fillStyle = 'rgba(238,242,235,0.25)'; ctx.beginPath(); ctx.arc(tx, ty, 4.4, 0, 6.28); ctx.stroke();
      }
    }
    for (var i2 = 0; i2 < 2200; i2++) {
      var sx = Math.random() * w, sy = Math.random() * h;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(80,94,90,0.2)' : 'rgba(240,245,238,0.25)';
      ctx.fillRect(sx, sy, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // damp streaks and lime bloom
    for (var s = 0; s < 18; s++) {
      var gx = Math.random() * w;
      var gr = ctx.createLinearGradient(gx, 0, gx, h);
      gr.addColorStop(0, 'rgba(64,90,84,0.30)');
      gr.addColorStop(0.45, 'rgba(64,90,84,0.10)');
      gr.addColorStop(1, 'rgba(64,90,84,0.02)');
      ctx.fillStyle = gr;
      ctx.fillRect(gx, 0, 3 + Math.random() * 24, h);
    }
    for (var ls = 0; ls < 7; ls++) {
      var lx = Math.random() * w;
      var lg = ctx.createLinearGradient(lx, h * 0.2, lx, h * 0.95);
      lg.addColorStop(0, 'rgba(232,238,228,0.16)');
      lg.addColorStop(1, 'rgba(232,238,228,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(lx, h * 0.2, 2 + Math.random() * 5, h * 0.75);
    }
    // grime at the base
    var gb = ctx.createLinearGradient(0, h - 54, 0, h);
    gb.addColorStop(0, 'rgba(52,72,68,0)'); gb.addColorStop(1, 'rgba(52,72,68,0.22)');
    ctx.fillStyle = gb; ctx.fillRect(0, h - 54, w, 54);
  });

  // ---- tide / algae band (transparent overlay) --------------------------
  T.tide = H.tex(512, 128, function (ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(46,76,68,0.0)');
    g.addColorStop(0.3, 'rgba(52,82,70,0.62)');
    g.addColorStop(0.55, 'rgba(70,100,80,0.5)');
    g.addColorStop(0.8, 'rgba(90,110,80,0.22)');
    g.addColorStop(1, 'rgba(110,120,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 70; i++) {
      ctx.fillStyle = 'rgba(120,145,105,' + (0.08 + Math.random() * 0.3) + ')';
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, h * 0.28 + Math.random() * h * 0.5, 3 + Math.random() * 22, 2 + Math.random() * 7, 0, 0, 6.283);
      ctx.fill();
    }
    for (var b = 0; b < 130; b++) {
      ctx.fillStyle = 'rgba(222,224,202,' + (0.3 + Math.random() * 0.5) + ')';
      ctx.beginPath(); ctx.arc(Math.random() * w, h * 0.15 + Math.random() * h * 0.4, 1 + Math.random() * 2.5, 0, 6.283); ctx.fill();
    }
  });

  // ---- wood -------------------------------------------------------------
  T.wood = H.tex(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#b08962'; ctx.fillRect(0, 0, w, h);
    var n = H.makeNoise(41);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var v = n.fbm(x * 0.02, y * 0.09, 3, 0.55);
        var g = n.fbm(x * 0.006, y * 0.3, 2, 0.5);
        var c = 150 + v * 55 + Math.sin(y * 0.4 + g * 8) * 9;
        var i = (y * w + x) * 4;
        // draw per pixel is too slow here; instead stroke below
        if (i < 0) break;
      }
    }
    for (var k = 0; k < 160; k++) {
      ctx.strokeStyle = 'rgba(100,70,45,' + (0.03 + Math.random() * 0.08) + ')';
      ctx.lineWidth = 0.6 + Math.random() * 2;
      ctx.beginPath();
      var yy = Math.random() * h;
      ctx.moveTo(0, yy);
      for (var xx = 0; xx < w; xx += 32) {
        ctx.lineTo(xx, yy + Math.sin(xx * 0.02 + k) * 3 + (Math.random() - 0.5) * 2);
      }
      ctx.stroke();
    }
    for (var p = 0; p < 5; p++) {
      ctx.fillStyle = 'rgba(80,55,36,0.5)';
      ctx.fillRect(0, p * 102 + 100, w, 3);
      ctx.fillStyle = 'rgba(238,225,200,0.18)';
      ctx.fillRect(0, p * 102 + 104, w, 2);
    }
  });

  // ---- hazard stripe ----------------------------------------------------
  T.hazard = H.tex(512, 96, function (ctx, w, h) {
    ctx.fillStyle = '#d8a520'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#25282a'; ctx.lineWidth = 34;
    for (var x = -h; x < w + h; x += 68) {
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke();
    }
    // wear
    for (var i = 0; i < 260; i++) {
      ctx.fillStyle = 'rgba(214,214,200,' + (0.15 + Math.random() * 0.5) + ')';
      var ww = Math.random() * 14;
      ctx.fillRect(Math.random() * w, Math.random() * h, ww, 1 + Math.random() * 4);
    }
    for (var j = 0; j < 60; j++) {
      ctx.fillStyle = 'rgba(120,80,40,0.3)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 1 + Math.random() * 2);
    }
  });

  // ---- corrugated metal -------------------------------------------------
  T.corrugated = H.tex(512, 512, function (ctx, w, h) {
    for (var x = 0; x < w; x += 32) {
      var g = ctx.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, '#aab6b2');
      g.addColorStop(0.45, '#e2e9e4');
      g.addColorStop(0.55, '#eef3ee');
      g.addColorStop(1, '#9aa8a4');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 32, h);
    }
    var n = H.makeNoise(55);
    for (var i = 0; i < 200; i++) {
      var rx = Math.random() * w, ry = Math.random() * h;
      ctx.fillStyle = 'rgba(150,90,55,' + (0.04 + Math.random() * 0.14) + ')';
      ctx.beginPath(); ctx.ellipse(rx, ry, 2 + Math.random() * 10, 4 + Math.random() * 26, 0, 0, 6.283); ctx.fill();
    }
    for (var k = 0; k < 30; k++) {
      ctx.fillStyle = 'rgba(160,110,70,0.22)';
      ctx.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, h * (0.2 + Math.random() * 0.6));
    }
    // horizontal panel seams and fasteners
    for (var sy = 0; sy < h; sy += 128) {
      ctx.fillStyle = 'rgba(55,72,70,0.42)';
      ctx.fillRect(0, sy, w, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(0, sy + 3, w, 2);
      for (var sx = 12; sx < w; sx += 32) {
        ctx.fillStyle = 'rgba(62,80,78,0.55)';
        ctx.beginPath(); ctx.arc(sx, sy + 12, 2.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(242,248,240,0.35)';
        ctx.beginPath(); ctx.arc(sx - 1, sy + 11, 1, 0, 6.283); ctx.fill();
      }
    }
    // darker lower edge / splash line
    var eg = ctx.createLinearGradient(0, h * 0.8, 0, h);
    eg.addColorStop(0, 'rgba(55,82,76,0)');
    eg.addColorStop(1, 'rgba(55,82,76,0.28)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 600, 0.15, true);
  });

  // ---- roof tiles -------------------------------------------------------
  T.roofTile = H.tex(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#546f78'; ctx.fillRect(0, 0, w, h);
    var rowH = 46;
    for (var y = 0; y < h; y += rowH) {
      for (var x = -40; x < w; x += 64) {
        var off = ((y / rowH) % 2) * 32;
        var g = ctx.createLinearGradient(x + off, 0, x + off + 64, 0);
        g.addColorStop(0, '#3f5a63');
        g.addColorStop(0.5, '#6d8991');
        g.addColorStop(1, '#405b64');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + off + 32, y + rowH / 2, 31, rowH * 0.56, 0, 0, 6.283);
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,50,58,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x + off + 32, y + rowH / 2, 31, rowH * 0.56, 0, 0, 6.283); ctx.stroke();
      }
    }
    for (var i = 0; i < 160; i++) {
      ctx.fillStyle = 'rgba(195,200,190,' + (0.04 + Math.random() * 0.12) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 2 + Math.random() * 8);
    }
  });

  // ---- fishing net (transparent) ---------------------------------------
  T.net = H.tex(512, 512, function (ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(50,83,82,0.9)';
    ctx.lineWidth = 3;
    var step = 42;
    for (var x = -h; x < w + h; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + h, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,190,180,0.35)'; ctx.lineWidth = 1;
    for (var x2 = -h; x2 < w + h; x2 += step) {
      ctx.beginPath(); ctx.moveTo(x2 + 1, 0); ctx.lineTo(x2 + h + 1, h); ctx.stroke();
    }
  });

  // ---- foam sprite ------------------------------------------------------
  T.foam = H.tex(128, 128, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(245,255,252,0.7)');
    g.addColorStop(0.7, 'rgba(230,250,246,0.2)');
    g.addColorStop(1, 'rgba(220,250,245,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 24; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + Math.random() * 0.5) + ')';
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 6.283); ctx.fill();
    }
  }, { clamp: true });

  // ---- soft shadow blob -------------------------------------------------
  T.shadow = H.tex(256, 256, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(30,48,52,0.55)');
    g.addColorStop(0.45, 'rgba(30,48,52,0.28)');
    g.addColorStop(1, 'rgba(30,48,52,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { clamp: true });

  // ---- seabed -----------------------------------------------------------
  T.seabed = H.tex(512, 512, function (ctx, w, h) {
    var n = H.makeNoise(77);
    var img = ctx.createImageData(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var f = n.fbm(x * 0.03, y * 0.03, 4, 0.55);
        var r = 140 + f * 60, g = 152 + f * 55, b = 130 + f * 45;
        var i = (y * w + x) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (var k = 0; k < 900; k++) {
      var sx = Math.random() * w, sy = Math.random() * h;
      var rr = 1 + Math.random() * 5;
      ctx.fillStyle = Math.random() < 0.6 ? 'rgba(90,106,92,0.55)' : 'rgba(205,206,180,0.5)';
      ctx.beginPath(); ctx.ellipse(sx, sy, rr, rr * (0.6 + Math.random() * 0.5), Math.random() * 3, 0, 6.283); ctx.fill();
    }
  });

  // ---- stone / breakwater block ----------------------------------------
  T.stone = H.tex(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#b3b8ae'; ctx.fillRect(0, 0, w, h);
    var n = H.makeNoise(99);
    for (var i = 0; i < 120; i++) {
      var x = Math.random() * w, y = Math.random() * h;
      ctx.fillStyle = 'rgba(' + (110 + Math.random() * 60) + ',' + (115 + Math.random() * 60) + ',' + (105 + Math.random() * 55) + ',0.18)';
      ctx.beginPath(); ctx.ellipse(x, y, 6 + Math.random() * 30, 4 + Math.random() * 20, Math.random() * 3, 0, 6.283); ctx.fill();
    }
    // green algae stain at lower part
    var g = ctx.createLinearGradient(0, h * 0.55, 0, h);
    g.addColorStop(0, 'rgba(70,100,68,0)');
    g.addColorStop(1, 'rgba(58,92,60,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var k = 0; k < 250; k++) {
      ctx.fillStyle = 'rgba(70,92,74,' + (0.1 + Math.random() * 0.35) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    grain(ctx, w, h, 900, 0.16, true);
  });

  // ---- rust decal -------------------------------------------------------
  T.rust = H.tex(256, 256, function (ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < 90; i++) {
      ctx.fillStyle = 'rgba(' + (120 + Math.random() * 60) + ',' + (60 + Math.random() * 40) + ',' + (30 + Math.random() * 25) + ',' + (0.1 + Math.random() * 0.4) + ')';
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 4 + Math.random() * 35, 2 + Math.random() * 16, Math.random() * 3, 0, 6.283);
      ctx.fill();
    }
  }, { clamp: true });

  // ---- stainless / painted metal ---------------------------------------
  T.metal = H.tex(512, 512, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#cfd8d6'); g.addColorStop(0.5, '#eef2ef'); g.addColorStop(1, '#b7c2c0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 130; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.05 + Math.random() * 0.22) + ')';
      ctx.lineWidth = 0.5 + Math.random() * 1.2;
      ctx.beginPath(); ctx.moveTo(Math.random() * w, 0); ctx.lineTo(Math.random() * w, h); ctx.stroke();
    }
    for (var j = 0; j < 40; j++) {
      ctx.fillStyle = 'rgba(90,105,102,' + (0.02 + Math.random() * 0.09) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 10 + Math.random() * 60);
    }
  });

  // ---- fish crate -------------------------------------------------------
  T.crate = H.tex(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#eef3ee'; ctx.fillRect(0, 0, w, h);
    // molded horizontal slots
    for (var y = 40; y < h - 30; y += 46) {
      ctx.fillStyle = 'rgba(120,140,136,0.5)'; ctx.fillRect(24, y, w - 48, 15);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(24, y + 2, w - 48, 5);
    }
    ctx.strokeStyle = 'rgba(90,110,106,0.4)'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = 'rgba(45,80,86,0.55)';
    ctx.font = 'bold 44px "Yu Gothic","MS Gothic",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('汐見漁協', w / 2, 62);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('SHIOMI', w / 2, h - 22);
    for (var j = 0; j < 220; j++) {
      ctx.fillStyle = 'rgba(120,140,130,' + Math.random() * 0.12 + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 16, 1 + Math.random() * 4);
    }
  });

  T.crateBlue = H.tex(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#3d7f91'; ctx.fillRect(0, 0, w, h);
    for (var x = 34; x < w - 30; x += 46) {
      ctx.fillStyle = 'rgba(20,55,68,0.35)'; ctx.fillRect(x, 30, 18, h - 60);
    }
    ctx.fillStyle = 'rgba(238,244,236,0.65)';
    ctx.font = 'bold 36px "Yu Gothic",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('鮮魚', w / 2, h / 2 + 12);
    for (var j = 0; j < 180; j++) {
      ctx.fillStyle = 'rgba(210,230,225,' + Math.random() * 0.12 + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 10, 1 + Math.random() * 3);
    }
  });

  // ---- radial caustic-ish light texture --------------------------------
  T.caustic = H.tex(512, 512, function (ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 40; i++) {
      var x = Math.random() * w, y = Math.random() * h;
      var r = 10 + Math.random() * 70;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,250,225,0.35)');
      g.addColorStop(1, 'rgba(255,250,225,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, Math.random() * 3, 0, 6.283); ctx.fill();
    }
  }, { clamp: true });

  // ---- studio floor radial ---------------------------------------------
  T.studio = H.tex(512, 512, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(180,204,203,1)');
    g.addColorStop(0.35, 'rgba(201,222,220,1)');
    g.addColorStop(0.7, 'rgba(225,240,238,1)');
    g.addColorStop(1, 'rgba(238,248,246,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // soft baked contact shadow around the diorama plinth
    ctx.save();
    ctx.shadowColor = 'rgba(28,52,55,0.42)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = 'rgba(32,58,60,0.42)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(w / 2 - 37, h / 2 - 37, 74, 74, 5);
    else ctx.rect(w / 2 - 37, h / 2 - 37, 74, 74);
    ctx.fill();
    ctx.restore();
    // denser contact right at the base rim
    ctx.strokeStyle = 'rgba(24,45,47,0.24)';
    ctx.lineWidth = 10;
    ctx.shadowColor = 'rgba(24,45,47,0.45)';
    ctx.shadowBlur = 24;
    ctx.strokeRect(w / 2 - 38, h / 2 - 38, 76, 76);
    for (var i = 0; i < 2200; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.025 + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }, { clamp: true });

  // ---- plinth wood ------------------------------------------------------
  T.plinth = H.tex(512, 512, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e7ddcd'); g.addColorStop(0.5, '#ddcfbb'); g.addColorStop(1, '#e9dfce');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 60; i++) {
      ctx.strokeStyle = 'rgba(150,130,105,' + (0.03 + Math.random() * 0.06) + ')';
      ctx.lineWidth = 0.6 + Math.random() * 1.5;
      ctx.beginPath();
      var y = Math.random() * h;
      ctx.moveTo(0, y);
      for (var x = 0; x < w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 4);
      ctx.stroke();
    }
  });

  // ---- blackboard -------------------------------------------------------
  T.blackboard = H.tex(512, 384, function (ctx, w, h) {
    ctx.fillStyle = '#2f4242'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 400; i++) {
      ctx.fillStyle = 'rgba(220,230,220,' + Math.random() * 0.035 + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 40, 2 + Math.random() * 20);
    }
    ctx.fillStyle = 'rgba(240,244,234,0.88)';
    ctx.font = 'bold 38px "Yu Gothic","MS Gothic",sans-serif';
    ctx.fillText('本日の水揚げ', 26, 56);
    ctx.strokeStyle = 'rgba(240,244,234,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(26, 76); ctx.lineTo(480, 76); ctx.stroke();
    ctx.font = '30px "Yu Gothic",sans-serif';
    var rows = [['アジ', '380', 'kg'], ['サバ', '260', 'kg'], ['タイ', '120', 'kg'], ['イカ', '95', 'kg'], ['カニ', '18', '箱']];
    rows.forEach(function (r, i) {
      var y = 126 + i * 46;
      ctx.fillStyle = 'rgba(240,244,234,0.82)';
      ctx.fillText(r[0], 34, y);
      ctx.fillStyle = 'rgba(250,220,150,0.9)';
      ctx.fillText(r[1], 250, y);
      ctx.fillStyle = 'rgba(220,235,225,0.6)';
      ctx.fillText(r[2], 380, y);
    });
    ctx.fillStyle = 'rgba(255,210,130,0.7)';
    ctx.font = '24px "Yu Gothic",sans-serif';
    ctx.fillText('※ 入札 7:00', 330, 350);
  });

  // ---- timetable --------------------------------------------------------
  T.timetable = H.tex(384, 512, function (ctx, w, h) {
    ctx.fillStyle = '#eef0e4'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(120,140,128,0.15)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#345b5c';
    ctx.font = 'bold 34px "Yu Gothic",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('汐見 旅客船', w / 2, 52);
    ctx.fillStyle = '#d08a3a';
    ctx.fillRect(26, 70, w - 52, 4);
    ctx.textAlign = 'left';
    ctx.font = '23px "Yu Gothic",sans-serif';
    var times = [['07:20', '島 行'], ['09:10', '島 行'], ['11:40', '岬 行'], ['13:20', '島 行'], ['15:10', '岬 行'], ['17:30', '島 行']];
    times.forEach(function (t, i) {
      var y = 125 + i * 58;
      ctx.fillStyle = i === 2 ? 'rgba(190,80,60,0.8)' : 'rgba(60,82,80,0.82)';
      ctx.fillText(t[0], 34, y);
      ctx.fillStyle = 'rgba(60,82,80,0.6)';
      ctx.fillText(t[1], 190, y);
      ctx.strokeStyle = 'rgba(80,100,95,0.18)';
      ctx.beginPath(); ctx.moveTo(26, y + 16); ctx.lineTo(w - 26, y + 16); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(90,80,60,0.5)';
    ctx.font = '18px "Yu Gothic",sans-serif';
    ctx.fillText('※ 荒天時は欠航の場合があります', 26, h - 30);
    for (var i = 0; i < 140; i++) {
      ctx.fillStyle = 'rgba(140,150,135,' + Math.random() * 0.1 + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 1 + Math.random() * 5);
    }
  });

  // ---- nautical chart ---------------------------------------------------
  T.chart = H.tex(512, 384, function (ctx, w, h) {
    ctx.fillStyle = '#e9e2cf'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(90,120,130,0.5)'; ctx.lineWidth = 1.5;
    for (var x = 0; x < w; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (var y = 0; y < h; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // coast outlines
    ctx.strokeStyle = 'rgba(60,90,80,0.7)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 320);
    ctx.bezierCurveTo(120, 250, 160, 300, 250, 220);
    ctx.bezierCurveTo(320, 160, 300, 90, 420, 60);
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,200,170,0.35)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, 50);
    ctx.bezierCurveTo(300, 90, 280, 160, 240, 210);
    ctx.bezierCurveTo(160, 290, 100, 260, 0, 340);
    ctx.closePath(); ctx.fill();
    // depth marks
    ctx.fillStyle = 'rgba(70,100,110,0.7)';
    ctx.font = '14px monospace';
    for (var i = 0; i < 30; i++) {
      ctx.fillText(String(4 + (i * 7) % 24), 40 + (i * 79) % 440, 70 + (i * 53) % 280);
    }
    ctx.fillStyle = 'rgba(170,70,55,0.7)';
    ctx.font = 'bold 20px "Yu Gothic",sans-serif';
    ctx.fillText('汐見港 泊地', 300, 300);
    ctx.strokeStyle = 'rgba(170,70,55,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(360, 250, 16, 0, 6.283); ctx.stroke();
    for (var k = 0; k < 80; k++) {
      ctx.fillStyle = 'rgba(120,110,80,' + Math.random() * 0.06 + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 8, 1 + Math.random() * 8);
    }
  });

  // ---- catch photo ------------------------------------------------------
  T.photo = H.tex(256, 200, function (ctx, w, h) {
    ctx.fillStyle = '#e8e4d6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9ec9c0'; ctx.fillRect(18, 16, w - 36, h - 58);
    ctx.fillStyle = '#5c7d7e';
    ctx.beginPath(); ctx.moveTo(18, h - 42); ctx.lineTo(110, 70); ctx.lineTo(w - 18, h - 42); ctx.closePath(); ctx.fill();
    // fisherman silhouette + big fish
    ctx.fillStyle = 'rgba(40,60,62,0.85)';
    ctx.beginPath(); ctx.arc(100, 92, 14, 0, 6.283); ctx.fill();
    ctx.fillRect(86, 100, 28, 46);
    ctx.beginPath(); ctx.ellipse(160, 132, 48, 20, -0.2, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(206, 128); ctx.lineTo(232, 112); ctx.lineTo(232, 148); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(250,245,220,0.85)';
    ctx.font = '16px "Yu Gothic",sans-serif';
    ctx.fillText('大物!!', 20, h - 16);
    ctx.strokeStyle = 'rgba(60,50,40,0.3)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4);
  });

  // ---- vending machine face --------------------------------------------
  T.vending = H.tex(512, 1024, function (ctx, w, h) {
    ctx.fillStyle = '#e8eee9'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c94f44'; ctx.fillRect(0, 0, w, 170);
    ctx.fillStyle = '#f3e6d4';
    ctx.font = 'bold 54px "Yu Gothic",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('汐見サイダー', w / 2, 76);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('SHIOMI  SODA', w / 2, 124);
    // drink window
    ctx.fillStyle = 'rgba(70,120,125,0.25)'; ctx.fillRect(26, 196, w - 52, 430);
    var colors = ['#e37b64', '#6fb2a6', '#e8c25f', '#709fc9', '#d9e3dc', '#96c97d'];
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 5; c++) {
        var x = 44 + c * 88, y = 216 + r * 140;
        ctx.fillStyle = colors[(r * 5 + c) % colors.length];
        ctx.fillRect(x, y, 62, 104);
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + 6, y + 10, 12, 84);
        ctx.fillStyle = 'rgba(40,50,50,0.6)'; ctx.fillRect(x, y + 104, 62, 18);
      }
    }
    // buttons
    ctx.fillStyle = '#d9e2dd'; ctx.fillRect(26, 656, w - 52, 70);
    for (var b = 0; b < 5; b++) {
      ctx.fillStyle = b === 2 ? '#e8b45c' : '#8caaa5';
      ctx.beginPath(); ctx.arc(80 + b * 88, 692, 18, 0, 6.283); ctx.fill();
    }
    // slot and text
    ctx.fillStyle = '#445a5a'; ctx.fillRect(60, 780, w - 120, 46);
    ctx.fillStyle = '#3d4f4e'; ctx.fillRect(60, 866, w - 120, 96);
    ctx.fillStyle = '#e9efe8';
    ctx.font = '22px "Yu Gothic",sans-serif';
    ctx.fillText('つめた〜い', w / 2, 842);
    ctx.fillStyle = 'rgba(60,70,65,0.25)';
    for (var i = 0; i < 80; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 8, 1 + Math.random() * 8);
  }, { clamp: true });

  // ---- manhole / grate -------------------------------------------------
  T.grate = H.tex(256, 256, function (ctx, w, h) {
    ctx.fillStyle = '#3a4a48'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7d918c';
    for (var y = 14; y < h - 14; y += 22) ctx.fillRect(20, y, w - 40, 9);
    ctx.strokeStyle = '#9db0aa'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
  });

  // ---- small paper poster ---------------------------------------------
  T.poster = H.tex(256, 360, function (ctx, w, h) {
    ctx.fillStyle = '#f1ead8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#497e7c';
    ctx.fillRect(0, 0, w, 96);
    ctx.fillStyle = '#fdf8e8';
    ctx.font = 'bold 32px "Yu Gothic",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('安全操業', w / 2, 48);
    ctx.fillText('徹底', w / 2, 84);
    ctx.fillStyle = '#c56a4c';
    ctx.beginPath(); ctx.arc(w / 2, 172, 42, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fdf8e8';
    ctx.font = 'bold 24px "Yu Gothic",sans-serif';
    ctx.fillText('汐見', w / 2, 180);
    ctx.fillStyle = '#4b5c5a';
    ctx.font = '18px "Yu Gothic",sans-serif';
    ctx.fillText('漁業協同組合', w / 2, 246);
    ctx.fillStyle = 'rgba(90,80,60,0.45)';
    ctx.fillRect(24, 286, w - 48, 2);
    ctx.font = '14px "Yu Gothic",sans-serif';
    ctx.fillText('第七十一回 海難防止運動', w / 2, 318);
  }, { clamp: true });

  // ---- thin striped awning --------------------------------------------
  T.stripe = H.tex(256, 256, function (ctx, w, h) {
    for (var i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#e8e1cf' : '#c16a4f';
      ctx.fillRect(i * 32, 0, 32, h);
    }
    for (var j = 0; j < 60; j++) {
      ctx.fillStyle = 'rgba(210,205,185,' + Math.random() * 0.25 + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 20, 1 + Math.random() * 8);
    }
  });

  // ---- cloth / umbrella fabric ---------------------------------------
  T.fabric = H.tex(256, 256, function (ctx, w, h) {
    ctx.fillStyle = 'rgba(235,246,244,0.55)'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 90; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + Math.random() * 0.1 + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.random() * w, 0); ctx.lineTo(Math.random() * w, h); ctx.stroke();
    }
  });

  // ---- grass / foliage noise -----------------------------------------
  T.grass = H.tex(256, 256, function (ctx, w, h) {
    var n = H.makeNoise(31);
    var img = ctx.createImageData(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var f = n.fbm(x * 0.05, y * 0.05, 4, 0.55);
        var i = (y * w + x) * 4;
        img.data[i] = 70 + f * 70;
        img.data[i + 1] = 120 + f * 80;
        img.data[i + 2] = 72 + f * 55;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // ---- rice paper / shoji ----------------------------------------------
  T.shoji = H.tex(256, 256, function (ctx, w, h) {
    ctx.fillStyle = '#f0ead9'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,105,80,0.5)'; ctx.lineWidth = 4;
    for (var x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (var y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });

  // ---- soft cloud shadow ---------------------------------------------
  T.cloudShadow = H.tex(256, 256, function (ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w * 0.48);
    g.addColorStop(0, 'rgba(20,42,48,0.62)');
    g.addColorStop(0.55, 'rgba(20,42,48,0.34)');
    g.addColorStop(1, 'rgba(20,42,48,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 40; i++) {
      var x = w / 2 + (Math.random() - 0.5) * w * 0.7, y = h / 2 + (Math.random() - 0.5) * h * 0.6;
      var r = 8 + Math.random() * 24;
      var gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, 'rgba(20,42,48,0.10)'); gg.addColorStop(1, 'rgba(20,42,48,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
    }
  });
  // ---- barnacles / oysters at the waterline --------------------------
  T.barnacle = H.tex(1024, 128, function (ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(56,76,70,0.04)');
    grad.addColorStop(0.55, 'rgba(52,72,66,0.16)');
    grad.addColorStop(1, 'rgba(38,56,52,0.30)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 170; i++) {
      var x = Math.random() * w, y = h * (0.25 + Math.random() * 0.72);
      var r = 2.0 + Math.random() * 6.5;
      var el = Math.random() < 0.22;
      ctx.beginPath();
      if (el) ctx.ellipse(x, y, r * 1.5, r * 0.75, Math.random() * 3.14, 0, Math.PI * 2);
      else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(214,211,196,0.92)' : 'rgba(174,187,178,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(72,88,80,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + Math.random() * 2 - 1, y + Math.random() * 2 - 1, Math.max(0.7, r * 0.22), 0, 6.28);
      ctx.fillStyle = 'rgba(46,62,57,0.8)'; ctx.fill();
    }
    for (var k = 0; k < 120; k++) {
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 1.8, 0, 6.28);
      ctx.fillStyle = 'rgba(90,110,102,' + (0.15 + Math.random() * 0.3) + ')'; ctx.fill();
    }
  });
})(window.H);
