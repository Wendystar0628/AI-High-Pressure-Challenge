/* 天气：太阳雨雨丝、淡彩虹、薄雾、滴水 */
(function () {
  'use strict';
  const H = window.H;

  H.buildWeather = function (scene) {
    const g = (H.weather = {});

    // ================= 雨丝（暖金色短线） =================
    const RAIN_N = 1500;
    const rainGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(RAIN_N * 6); // 每条线 2 顶点
    const seeds = new Float32Array(RAIN_N * 4); // x,z,速度,相位
    const rng = H.makeRng(7777);
    for (let i = 0; i < RAIN_N; i++) {
      seeds[i * 4] = (rng() - 0.5) * 26;
      seeds[i * 4 + 1] = (rng() - 0.5) * 26;
      seeds[i * 4 + 2] = 3.2 + rng() * 3.4;
      seeds[i * 4 + 3] = rng() * 20;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xffe8c0,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rain = new THREE.LineSegments(rainGeo, rainMat);
    rain.frustumCulled = false;
    rain.renderOrder = 20;
    scene.add(rain);
    g.rain = rain;
    g.rainSeeds = seeds;
    g.rainCount = RAIN_N;

    // 雨丝更新（世界空间循环，斜落）
    g.updateRain = function (t, wind) {
      const p = rainGeo.attributes.position.array;
      const slant = 0.22 + wind * 0.55;
      const lenBase = 0.2 + H.sim.rainAmount * 0.16;
      for (let i = 0; i < RAIN_N; i++) {
        const x0 = seeds[i * 4];
        const z0 = seeds[i * 4 + 1];
        const sp = seeds[i * 4 + 2];
        const ph = seeds[i * 4 + 3];
        // 世界 y：循环下落
        const cycle = 12.5;
        const y = ((ph - t * sp) % cycle + cycle) % cycle; // 0..cycle
        const worldY = 1.1 + y * 1.15; // 1.1 .. 15.5
        const x = x0 + Math.sin(t * 0.14 + ph) * 0.4 + worldY * slant * 0.22;
        const z = z0 + Math.cos(t * 0.11 + ph) * 0.3;
        const i6 = i * 6;
        p[i6] = x;
        p[i6 + 1] = worldY;
        p[i6 + 2] = z;
        p[i6 + 3] = x + slant * lenBase * 2.2;
        p[i6 + 4] = worldY - lenBase;
        p[i6 + 5] = z + 0.08;
      }
      rainGeo.attributes.position.needsUpdate = true;
      rainMat.opacity = 0.09 + H.sim.rainAmount * 0.17;
    };

    // ================= 极淡彩虹 =================
    const rainbow = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(7.2 + i * 0.42, 0.16, 6, 40, Math.PI * 0.52),
        new THREE.MeshBasicMaterial({
          color: [0xf8a0a0, 0xf8d890, 0xa8e0a8, 0x98c8f0, 0xc8a8f0][i],
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        })
      );
      rainbow.add(ring);
    }
    rainbow.position.set(6, 3.2, -12);
    rainbow.rotation.x = -0.12;
    rainbow.rotation.y = 0.35;
    rainbow.visible = false;
    scene.add(rainbow);
    g.rainbow = rainbow;

    // ================= 远处海面淡雾 =================
    const mistGrp = new THREE.Group();
    const mistTex = H.canvasTex(128, function (ctx, s) {
      const rg = H.makeRng(4242);
      for (let i = 0; i < 26; i++) {
        const x = rg() * s, y = rg() * s, r = 18 + rg() * 40;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.55)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 边缘径向渐隐
      const fade = ctx.createRadialGradient(s/2, s/2, s*0.12, s/2, s/2, s*0.52);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, s, s);
      ctx.globalCompositeOperation = 'source-over';
    });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(9 + (i % 3) * 3, 2.2 + (i % 2) * 1.2),
        new THREE.MeshBasicMaterial({
          map: mistTex, transparent: true, opacity: 0.1 + (i % 3) * 0.03,
          depthWrite: false, side: THREE.DoubleSide,
        })
      );
      m.position.set(-6 + i * 2.6, 0.7 + (i % 3) * 0.5, -11.5 + (i % 4) * 1.2);
      m.userData.phase = i * 1.1;
      m.userData.baseX = m.position.x;
      mistGrp.add(m);
    }
    scene.add(mistGrp);
    g.mist = mistGrp;

    // ================= 滴水（伞沿、船舷、灯罩偶尔滴落） =================
    g.drips = [];

    const dripMat = new THREE.MeshBasicMaterial({ color: 0xffe8c2, transparent: true, opacity: 0.7 });
    const dripSpots = [
      [-2.6, 1.1, 6.55], // 伞沿
      [-2.9, 0.75, -1.4], // 船舷
      [-1.55, 2.35, -1.1], // 灯罩
      [-2.9, 0.72, 2.2],
      [3.4, 2.2, 4.3], // 风向袋杆
    ];
    dripSpots.forEach(function (sp, i) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), dripMat);
      drop.position.set(sp[0], sp[1], sp[2]);
      drop.userData.topY = sp[1];
      drop.userData.phase = i * 1.7;
      drop.scale.y = 1.6;
      scene.add(drop);
      g.drips.push(drop);
    });

    return g;
  };
})();
