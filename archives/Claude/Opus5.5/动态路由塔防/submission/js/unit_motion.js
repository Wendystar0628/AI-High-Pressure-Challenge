// 单位的专属退场动作：每种敌人和 Boss 都有自己的死法，由模型的关节完成，不是统一的崩解。
(function (root) {
  const TD = root.TD = root.TD || {};
  const THREE = root.THREE;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const seg = (k, a, b) => clamp01((k - a) / (b - a));
  const easeOut = (v) => 1 - (1 - v) * (1 - v);
  const easeIn = (v) => v * v;
  const v3 = new THREE.Vector3();
  const worldOf = (o) => o.getWorldPosition(v3);
  const once = (M, key) => { M._fx = M._fx || {}; if (M._fx[key]) return false; M._fx[key] = 1; return true; };

  TD.DieAnim = {
    // 蠕虫：从尾到头一节一节爆开，最后头部张着颚倒下
    worm: {
      dur: 0.85,
      step(M, k, dt, fx) {
        const n = M.segs.length;
        for (let i = 0; i < n; i++) {
          const order = n - 1 - i;
          const t = seg(k, order * 0.13, order * 0.13 + 0.26);
          const s = M.segs[i];
          if (t >= 1) { s.visible = false; continue; }
          s.scale.setScalar(Math.max(0.02, 1 + Math.sin(t * Math.PI) * 0.6 - t * t));
          s.position.y = Math.max(0.05, s.position.y - dt * 0.6);
          if (t > 0.5 && fx && once(M, 's' + i)) { const p = worldOf(s); fx.burst(p.x, p.y, p.z, 0xE0355E, 5, 2.6, 0.17, 0.3, { up: 1, grav: 5 }); }
        }
        const h = seg(k, 0.62, 1);
        M.jawL.rotation.y = -0.25 - h * 1.2; M.jawR.rotation.y = 0.25 + h * 1.2;
        M.head.rotation.x = h * 1.1;
        M.head.position.y = Math.max(0.08, 0.36 - h * 0.3);
        M.head.scale.setScalar(Math.max(0.02, 1 - easeIn(seg(k, 0.82, 1))));
      },
    },
    // 洪泛团：先向内塌缩，再把外壳炸成碎块
    flood: {
      dur: 0.8,
      step(M, k, dt, fx) {
        const a = seg(k, 0, 0.28), b = seg(k, 0.28, 1);
        M.shell.rotation.y += dt * (10 + a * 20);
        M.shell2.rotation.y -= dt * (8 + a * 18);
        if (k < 0.28) {
          const s = 1 - a * 0.42;
          M.body.scale.setScalar(s);
          M.coreB.scale.setScalar(1 + a * 0.3);
        } else {
          M.body.scale.setScalar(0.58 + easeOut(b) * 0.9);
          M.shell.scale.setScalar(1 + easeOut(b) * 1.6);
          M.shell2.scale.setScalar(1 + easeOut(b) * 2.1);
          M.coreB.scale.setScalar(Math.max(0.02, 1.3 - b * 2.4));
          M.body.position.y = 0.72 - b * 0.42;
          if (fx && once(M, 'boom')) { const p = worldOf(M.body); fx.burst(p.x, p.y, p.z, 0xF0522A, 34, 7, 0.34, 0.6, { up: 2, grav: 7 }); fx.ring(p.x, 0.2, p.z, 3.4, 0xEE6A2E, 0.45, { w: 0.2, fill: 0.2 }); }
          if (b > 0.72) { M.shell.visible = false; M.shell2.visible = false; }
        }
      },
    },
    // 木马：显形时四腿跪倒侧翻；未显形时外壳炸开
    trojan: {
      dur: 0.95,
      step(M, k, dt, fx) {
        if (M.reveal < 0.5) {
          const b = easeOut(seg(k, 0, 0.55));
          M.shellA.visible = M.shellB.visible = k < 0.6;
          M.shellA.position.y = 0.34 + b * 1.1; M.shellA.rotation.x = -b * 2.4; M.shellA.position.z = -b * 0.7;
          M.shellB.position.x = b * 0.9; M.shellB.rotation.z = -b * 1.9; M.shellB.position.y = 0.3 - b * 0.2;
          M.inner.scale.setScalar(Math.max(0.02, b));
        }
        const f = easeIn(seg(k, 0.1, 0.62));
        for (let i = 0; i < M.legs.length; i++) M.legs[i].rotation.x = (i % 2 ? -1 : 1) * f * 1.1;
        M.inner.position.y = -f * 0.34;
        M.inner.rotation.z = f * 1.35;
        M.neck.rotation.x = f * 1.2;
        const g = seg(k, 0.74, 1);
        M.inner.scale.setScalar(Math.max(0.02, (M.reveal < 0.5 ? easeOut(seg(k, 0, 0.55)) : 1) * (1 - g)));
        if (k > 0.6 && fx && once(M, 'hit')) { const p = worldOf(M.torso); fx.burst(p.x, 0.25, p.z, 0xE8403A, 12, 2.6, 0.2, 0.4, { flat: true, grav: 1 }); }
      },
    },
    // 勒索者：锁环崩飞，躯干向前栽倒
    ransom: {
      dur: 1.0,
      step(M, k, dt, fx) {
        const a = easeOut(seg(k, 0, 0.5));
        M.shackle.position.y = 0.82 + a * 1.6; M.shackle.position.z = -a * 0.6; M.shackle.rotation.x += dt * 9; M.shackle.rotation.y += dt * 6;
        M.shackle.scale.setScalar(Math.max(0.02, 1 - seg(k, 0.55, 0.85)));
        if (fx && once(M, 'pop')) { const p = worldOf(M.hip); fx.burst(p.x, p.y + 0.7, p.z, 0xD9AF4E, 12, 3.4, 0.17, 0.5, { up: 2, grav: 7 }); }
        const f = easeIn(seg(k, 0.12, 0.72));
        M.hip.rotation.x = f * 1.45;
        M.hip.position.y = 0.72 - f * 0.46;
        M.legL.rotation.x = -f * 1.1; M.legR.rotation.x = -f * 0.8;
        M.shinL.rotation.x = f * 1.2; M.shinR.rotation.x = f * 1.3;
        M.arm.rotation.x = f * 1.1;
        if (k > 0.72) M.hip.scale.setScalar(Math.max(0.02, 1 - seg(k, 0.72, 1)));
        if (k > 0.66 && fx && once(M, 'fall')) { const p = worldOf(M.hip); fx.burst(p.x, 0.25, p.z, 0x6C45C8, 16, 3.4, 0.2, 0.42, { flat: true, grav: 1 }); }
      },
    },
    // 伪热点：旋翼失速，打着旋坠地
    hotspot: {
      dur: 1.25,
      init(M) { M.fallV = 0; M.startY = M.root.position.y; },
      step(M, k, dt, fx) {
        M.fallV += 13 * dt;
        M.root.position.y = Math.max(0.3, M.root.position.y - M.fallV * dt);
        M.disc.rotation.y += dt * (5 + k * 16);
        M.disc.rotation.x = 0.2 + k * 1.0;
        M.disc.rotation.z = Math.sin(k * 16) * 0.3;
        for (let i = 0; i < M.rotors.length; i++) M.rotors[i].rotation.y += dt * 30 * (1 - k);
        for (const a of M.arcs) a.visible = false;
        const p = M.root.position;
        if (fx && p.y > 0.4 && Math.random() < dt * 30) fx.p(p.x, p.y, p.z, 0, 0.6, 0, 0.4, 0.3, 1.2, 0.32, 0.72, { size2: 0.02 });
        if (p.y <= 0.3) {
          if (fx && once(M, 'crash')) { fx.burst(p.x, 0.3, p.z, 0xF2558F, 24, 5, 0.26, 0.5, { up: 2, grav: 8 }); fx.ring(p.x, 0.2, p.z, 2.4, 0xF2558F, 0.4, { w: 0.2 }); }
          M.disc.scale.setScalar(Math.max(0.02, 1 - seg(k, 0.72, 1)));
        }
      },
    },
    // 加壳器：一层层壳向外飞散，露出的本体蜷起六足
    packer: {
      dur: 0.95,
      step(M, k, dt, fx) {
        for (let i = 0; i < M.layers.length; i++) {
          const l = M.layers[i], t = easeOut(seg(k, i * 0.12, 0.45 + i * 0.12));
          l.position.y = 0.22 + i * 0.13 + t * (0.9 + i * 0.45);
          l.rotation.y += dt * (9 - i * 2) * (i % 2 ? -1 : 1);
          l.rotation.x = t * (i % 2 ? 0.8 : -0.8);
          const op = 1 + t * 1.0;
          const fade = Math.max(0.02, 1 - seg(k, 0.55 + i * 0.1, 0.9));
          l.scale.set(op * fade, fade, op * fade);
        }
        M.proj.scale.setScalar(Math.max(0.02, 1 - seg(k, 0, 0.3)));
        if (fx && once(M, 'pop')) { const p = worldOf(M.body); fx.burst(p.x, p.y + 0.3, p.z, 0xD277E8, 18, 4, 0.2, 0.5, { up: 2, grav: 5 }); }
        for (let i = 0; i < M.legsArr.length; i++) M.legsArr[i].rotation.z = -seg(k, 0.25, 0.8) * 1.4;
        M.body.position.y = 0.5 - seg(k, 0.25, 0.8) * 0.36;
        if (k > 0.78) M.body.scale.setScalar(Math.max(0.02, 1 - seg(k, 0.78, 1)));
      },
    },
    // 万傀：六足依次跪折，躯干砸地，傀儡丝断落，核心爆开
    wankui: {
      dur: 3.2,
      step(M, k, dt, fx, t, view) {
        for (const L of M.legs) {
          const a = easeIn(seg(k, 0.02 + L.i * 0.05, 0.3 + L.i * 0.05));
          L.up.rotation.x = -a * 0.75;
          L.low.rotation.x = a * 1.5;
        }
        const drop = easeIn(seg(k, 0.12, 0.5));
        M.body.position.y = 4.1 - drop * 3.15;
        M.body.rotation.z = drop * 0.22;
        M.body.rotation.x = drop * 0.16;
        M.crown.rotation.y += dt * (3 - k * 3);
        M.crown.rotation.z = drop * 0.5;
        M.crown.position.y = 2.3 - drop * 1.1;
        for (let i = 0; i < M.puppets.length; i++) {
          const g = M.puppets[i];
          const s = seg(k, 0.14 + i * 0.03, 0.42 + i * 0.03);
          g.children[0].visible = s < 0.15;       // 丝线断开
          g.rotation.x = s * 2.1 * (i % 2 ? 1 : -1);
          g.scale.setScalar(Math.max(0.02, 1 - seg(k, 0.55, 0.8)));
        }
        M.coreRed.visible = true;
        M.head.rotation.x = drop * 0.9;
        for (const r of M.ribs) r.children[0].rotation.x = 0.72 + seg(k, 0.55, 0.85) * 1.2;
        const heart = seg(k, 0.55, 0.86);
        M.coreRed.scale.setScalar(0.6 + heart * 2.0 + Math.sin(t * 40) * heart * 0.25);
        const p = M.root.position;
        if (drop >= 0.99 && fx && once(M, 'slam')) {
          fx.ring(p.x, 0.3, p.z, 12, 0xEFA864, 0.9, { w: 0.12, fill: 0.2 });
          fx.burst(p.x, 0.6, p.z, 0xEFA864, 80, 9, 0.5, 0.8, { flat: true, grav: 2 });
          if (view) view.shake = Math.max(view.shake, 1.6);
        }
        if (k > 0.86 && fx && once(M, 'boom')) {
          fx.pillar(p.x, 0, p.z, 3.5, 34, 0xE2392F, 1.4);
          fx.burst(p.x, 1.6, p.z, 0xE8344A, 120, 13, 0.7, 1.4, { up: 4, grav: 5 });
          if (view) view.shake = Math.max(view.shake, 1.2);
        }
        if (k > 0.86) M.body.scale.setScalar(Math.max(0.02, 1 - seg(k, 0.86, 1)));
      },
    },
    // 蜃楼：光环越转越快后碎裂，棱柱坍缩成一点再闪灭
    shenlou: {
      dur: 2.8,
      step(M, k, dt, fx, t, view) {
        M.halos.forEach((h, i) => {
          h.rotation.y += dt * (3 + k * 42) * (i % 2 ? -1 : 1);
          const b = seg(k, 0.42, 0.68);
          h.scale.setScalar(1.2 + k * 0.5 + easeOut(b) * 1.7);
          h.rotation.x = b * (i - 1) * 1.1;
          h.visible = b < 1;
        });
        M.ghosts.forEach((g, i) => { g.visible = k < 0.5 && Math.sin(t * 34 + i) > 0; g.position.x = (i ? 1 : -1) * (1.9 - k * 3.2); });
        M.ribbons.forEach((r, i) => r.forEach((s, j) => { s.rotation.x = Math.sin(t * 7 + i + j) * (0.4 + k); s.scale.y = Math.max(0.02, 1 - seg(k, 0.4, 0.75)); }));
        M.eye.scale.setScalar(1 + seg(k, 0.1, 0.7) * 2.6);
        const c = easeIn(seg(k, 0.55, 0.9));
        M.float.scale.set(Math.max(0.02, 1 - c), Math.max(0.02, 1 - c * 0.5), Math.max(0.02, 1 - c));
        M.float.position.y = 3.1 - c * 1.4;
        const p = M.root.position;
        if (k > 0.68 && fx && once(M, 'shatter')) {
          fx.burst(p.x, 3.2, p.z, 0xA8E4F5, 80, 11, 0.42, 1.0, { up: 2, grav: 3 });
          fx.burst(p.x, 3.2, p.z, 0xE58CD8, 60, 9, 0.42, 1.0, { up: 2, grav: 3 });
        }
        if (k > 0.9 && fx && once(M, 'flash')) {
          fx.pillar(p.x, 0, p.z, 3.2, 40, 0xffffff, 1.1);
          for (let i = 0; i < 3; i++) fx.ring(p.x, 0.4 + i * 1.2, p.z, 14 + i * 5, i % 2 ? 0xE58CD8 : 0xA8E4F5, 0.9 + i * 0.2, { w: 0.08 });
          if (view) view.shake = Math.max(view.shake, 1.4);
        }
      },
    },
    // 蛰影：裂隙迸发，斗篷像失去支撑的布一样塌落，兜帽最后落下
    zheying: {
      dur: 3.0,
      step(M, k, dt, fx, t, view) {
        M.cracks.visible = k < 0.62;
        M.cracks.scale.setScalar(1 + seg(k, 0, 0.5) * 0.25 + Math.sin(t * 50) * 0.02);
        M.armor.visible = k < 0.4;
        for (const w of M.wing) { w.visible = k < 0.55; const s = Math.max(0.02, 1 - seg(k, 0.15, 0.55)); w.scale.set(s, s, s); w.rotation.z = Math.sin(t * 9) * 0.3 * (1 - k); }
        const c = easeIn(seg(k, 0.22, 0.72));
        M.cloak.scale.set(1 + c * 0.55, Math.max(0.03, 1 - c * 0.97), 1 + c * 0.55);
        M.arms[0].rotation.x = -0.3 + c * 1.6; M.arms[1].rotation.x = -0.3 + c * 1.5;
        for (const a of M.arms) a.position.y = 4.15 - c * 3.8;
        M.hood.position.y = 5.1 - c * 4.9;
        M.hood.rotation.x = c * 1.2;
        M.rig.scale.setScalar(1);
        const p = M.root.position;
        if (fx && k < 0.6 && Math.random() < dt * 34) {
          const a = Math.random() * 6.28;
          fx.p(p.x + Math.cos(a) * 1.2, 1 + Math.random() * 3.6, p.z + Math.sin(a) * 1.2, Math.cos(a) * 2, 1.2, Math.sin(a) * 2, 0.6, 0.34, 1.6, 0.2, 0.26, { size2: 0.03 });
        }
        if (k > 0.6 && fx && once(M, 'rupture')) {
          fx.pillar(p.x, 0, p.z, 3.4, 36, 0xE8302A, 1.3);
          fx.burst(p.x, 1.4, p.z, 0xE8302A, 90, 12, 0.6, 1.2, { up: 3, grav: 4 });
          if (view) view.shake = Math.max(view.shake, 1.5);
        }
        if (k > 0.8) { const s = Math.max(0.02, 1 - seg(k, 0.8, 1)); M.rig.scale.set(s, s, s); }
      },
    },
  };

  // 塔被撤下：设备收回平台，不崩解
  TD.retractModel = function (M, k) {
    const e = 1 - (1 - k) * (1 - k);
    M.root.scale.set(1 - e * 0.25, Math.max(0.02, 1 - e), 1 - e * 0.25);
    M.root.rotation.y += 0.05;
  };
})(typeof window !== 'undefined' ? window : globalThis);
