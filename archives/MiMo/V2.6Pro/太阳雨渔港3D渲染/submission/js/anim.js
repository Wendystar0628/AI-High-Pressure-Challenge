/* 动效：全部动态均以 sim 时间 t 为自变量，保证导出帧确定性 */
(function () {
  'use strict';
  const H = window.H;

  // 出港船路径（绕防波堤一圈）
  const outPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.4, 0, -9.2),
    new THREE.Vector3(0.8, 0, -8.6),
    new THREE.Vector3(3.6, 0, -7.6),
    new THREE.Vector3(5.8, 0, -6.2),
    new THREE.Vector3(7.6, 0, -3.6),
    new THREE.Vector3(8.1, 0, 0.2),
    new THREE.Vector3(7.4, 0, 3.2),
    new THREE.Vector3(5.2, 0, 4.8),
    new THREE.Vector3(3.2, 0, 4.2),
    new THREE.Vector3(1.6, 0, 1.8),
    new THREE.Vector3(0.6, 0, -2.2),
    new THREE.Vector3(-0.4, 0, -6.0),
    new THREE.Vector3(-2.4, 0, -9.2),
  ]);

  // 港猫巡走路径（不同趟次由 phase 区分）
  function catPath(trip, out) {
    // 生成折线点
    const rng = H.makeRng(1000 + trip * 17);
    const pts = [];
    const n = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      pts.push(new THREE.Vector3(
        -2.0 - rng() * 5.6,
        0.42,
        -3.5 + rng() * 11.5
      ));
    }
    // out=0 → 舢板下, out=1 → 巡走中
    const total = pts.length - 1;
    const tt = out * total;
    const i0 = Math.min(total - 1, Math.floor(tt));
    const f = tt - i0;
    return pts[i0].clone().lerp(pts[i0 + 1], f);
  }

  H.updateAnim = function (dt, t) {
    const s = H.sim;
    const g = H.g;
    const boats = H.boats;
    const props = H.props;
    const weather = H.weather;
    const creatures = H.creatures;

    // ---------- 水面 ----------
    if (H.water) {
      H.water.uniforms.uTime.value = t;
      H.water.uniforms.uCloudShadow.value = s.cloudShadow;
      H.water.uniforms.uWind.value = s.wind;
      // 色块倒影缓慢变形
      if (H.water.reflBlocks) {
        for (let i = 0; i < H.water.reflBlocks.length; i++) {
          const b = H.water.reflBlocks[i];
          const ph = b.userData.phase;
          b.position.y = H.L.WATER + 0.012 + Math.sin(t * 0.6 + ph) * 0.006;
          const sx = b.scale.x;
          b.scale.x = sx * (1 + Math.sin(t * 0.35 + ph) * 0.0012);
          b.rotation.z = ph + Math.sin(t * 0.12 + ph) * 0.35;
          b.material.opacity = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.5 + ph * 1.7));
        }
      }
      // 消波块浪花翻涌
      if (H.water.foams) {
        for (let i = 0; i < H.water.foams.length; i++) {
          const f = H.water.foams[i];
          const k = 0.5 + 0.5 * Math.sin(t * 1.1 + f.userData.phase);
          f.scale.setScalar(0.85 + k * 0.3);
          f.material.opacity = 0.5 + k * 0.42;
          f.rotation.z = (i % 2 ? 1 : -1) * (t * 0.06 + f.userData.phase);
        }
      }
    }

    // ---------- 海藻摆动 ----------
    if (g && g.seaweeds) {
      for (let i = 0; i < g.seaweeds.length; i++) {
        const w = g.seaweeds[i];
        w.rotation.z = w.userData.baseRot + Math.sin(t * 0.9 + w.userData.phase) * (0.12 + s.wind * 0.22);
      }
    }
    if (g && g.underWeeds) {
      for (let i = 0; i < g.underWeeds.length; i++) {
        const w = g.underWeeds[i];
        w.rotation.z = Math.sin(t * 0.7 + w.userData.phase) * 0.16;
      }
    }

    // ---------- 船只摇晃 ----------
    if (boats && boats.list) {
      for (let i = 0; i < boats.list.length; i++) {
        const b = boats.list[i];
        const ph = b.userData.phase;
        const rock = Math.sin(t * 0.72 + ph) * 0.022 + Math.sin(t * 0.45 + ph * 1.7) * 0.014;
        const pitch = Math.sin(t * 0.55 + ph * 0.8) * 0.018;
        b.position.y = b.userData.baseY + rock;
        b.rotation.z = pitch;
        b.rotation.x = Math.sin(t * 0.62 + ph * 1.3) * 0.014;
      }
      // 雷达屏微光呼吸
      if (boats.list[1] && boats.list[1].userData.radarScreens) {
        boats.list[1].userData.radarScreens.forEach(function (sc, k) {
          const pulse = 0.55 + 0.35 * Math.sin(t * 2.1 + k * 2.0);
          sc.material.opacity = 0.55 + pulse * 0.4;
        });
      }
    }

    // ---------- 浮标起伏 ----------
    if (props && props.buoys) {
      props.buoys.forEach(function (b, i) {
        b.position.y = b.userData.baseY + Math.sin(t * 0.85 + b.userData.phase) * 0.05;
        b.rotation.z = Math.sin(t * 0.6 + b.userData.phase) * 0.1;
        b.rotation.x = Math.cos(t * 0.5 + b.userData.phase * 1.2) * 0.08;
      });
    }

    // ---------- 阵风：风向袋、小旗、渔网、树冠 ----------
    const wind = s.wind;
    if (props && props.windsockSegs) {
      props.windsockSegs.forEach(function (seg) {
        const idx = seg.userData.idx;
        // 风从海上吹来 → 沿路径依次摆动
        const w2 = Math.sin(t * 1.6 - idx * 0.75) * (0.1 + wind * 0.38);
        seg.position.x = Math.sin(t * 1.2 - idx * 0.6) * (0.03 + wind * 0.12) * (idx + 1) * 0.45;
        seg.position.y = 2.12 + Math.sin(t * 1.4 - idx * 0.7) * (0.015 + wind * 0.05) + idx * 0.008;
        seg.rotation.z = w2 * 0.7;
        seg.rotation.x = Math.PI / 2 + w2 * 0.35;
      });
    }
    if (props && props.flag) {
      // 小旗：网格顶点波动
      const fl = props.flag;
      const geo = fl.geometry;
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        posAttr.setZ(i, Math.sin(t * 3.2 + x * 6.5 + y * 2.0) * (0.03 + wind * 0.12) * (x + 0.3));
      }
      posAttr.needsUpdate = true;
    }
    if (props && props.netPlane) {
      props.netPlane.rotation.y = Math.sin(t * 0.8) * (0.015 + wind * 0.06);
      props.netPlane.position.z = Math.sin(t * 1.3) * (0.01 + wind * 0.05);
    }

    // 树冠摆动（山坡）
    if (g && g.trees) {
      g.trees.forEach(function (tr, i) {
        const sway = Math.sin(t * 1.1 + (tr.userData.phase || i)) * (0.01 + wind * 0.05);
        tr.rotation.z = sway;
        tr.rotation.x = Math.sin(t * 0.9 + i * 0.7) * (0.008 + wind * 0.03);
      });
    }

    // ---------- 水洼涟漪（同心圆扩散） ----------
    if (props && props.puddles) {
      if (!H._puddleRings) {
        H._puddleRings = [];
        props.puddles.forEach(function (pd, pi) {
          for (let k = 0; k < 2; k++) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(0.12, 0.155, 22),
              new THREE.MeshBasicMaterial({
                color: 0xd8ecec, transparent: true, opacity: 0.35,
                depthWrite: false, side: THREE.DoubleSide,
              })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(pd.position);
            ring.position.y += 0.006;
            ring.userData.puddle = pd;
            ring.userData.phase = pi * 1.3 + k * 2.1;
            H.scene.add(ring);
            H._puddleRings.push(ring);
          }
        });
      }
      H._puddleRings.forEach(function (r) {
        const cyc = (t * 0.55 + r.userData.phase) % 1;
        const sc = 0.3 + cyc * 2.6;
        r.scale.set(sc, sc, sc);
        r.material.opacity = 0.32 * (1 - cyc);
      });
    }

    // ---------- 滴水 ----------
    if (weather && weather.drips) {
      weather.drips.forEach(function (d) {
        const cyc = (t * 0.42 + d.userData.phase) % 1;
        if (cyc < 0.18) {
          d.visible = true;
          const fall = cyc / 0.18;
          d.position.y = d.userData.topY - fall * fall * 1.15;
          d.material.opacity = 0.75 * (1 - fall * 0.6);
        } else {
          d.visible = false;
        }
      });
    }

    // ---------- 雨 ----------
    if (weather && weather.updateRain) {
      weather.updateRain(t, wind);
    }

    // ---------- 彩虹（雨转弱时浮现） ----------
    if (weather && weather.rainbow) {
      // 雨量低于阈值且处于特定相位
      const show = s.rainAmount < 0.38 ? 1 : 0;
      const flick = 0.5 + 0.5 * Math.sin(t * 0.23);
      weather.rainbow.visible = show > 0 && flick > 0.25;
      if (weather.rainbow.visible) {
        weather.rainbow.children.forEach(function (c, i) {
          c.material.opacity = 0.06 + 0.05 * Math.sin(t * 0.4 + i);
        });
      }
    }

    // ---------- 淡雾漂移 ----------
    if (weather && weather.mist) {
      weather.mist.children.forEach(function (m) {
        m.position.x = m.userData.baseX + Math.sin(t * 0.05 + m.userData.phase) * 1.6;
        m.material.opacity = 0.08 + 0.05 * Math.sin(t * 0.11 + m.userData.phase);
      });
    }

    // ---------- 云影 → 光照联动 ----------
    if (H.sky) {
      H.sky.sun.intensity = 0.48 + s.cloudShadow * 0.34;
      H.sky.hemi.intensity = 0.28 + s.cloudShadow * 0.18;
      H.sky.skyMat.uniforms.uCloudShadow.value = s.cloudShadow;
      H.sky.skyMat.uniforms.uTime.value = t;
    }

    // ---------- 灯塔 ----------
    if (g && g.lampCore) {
      const on = s.lighthouseOn;
      g.lampCore.material.color.setHex(on > 0.05 ? 0xfff6d8 : 0xe8e0c8);
      g.lampGlass.material.opacity = 0.4 + on * 0.5;
      if (on > 0.05) {
        g.lampCore.scale.setScalar(1 + on * 0.35);
      } else {
        g.lampCore.scale.setScalar(1);
      }
    }

    // ---------- 仓库光柱 / 天花板粼光 ----------
    if (H.buildings && H.buildings.warehouse) {
      const wh = H.buildings.warehouse;
      wh.traverse(function (o) {
        if (o.material && o.material.blending === THREE.AdditiveBlending && o.material.color) {
          // 光柱与光斑
          if (o.geometry && o.geometry.type === 'CylinderGeometry') {
            o.material.opacity = 0.1 + 0.06 * Math.sin(t * 0.7 + o.position.x) * s.cloudShadow;
          } else if (o.geometry && o.geometry.type === 'PlaneGeometry') {
            o.material.opacity = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.9 + (o.userData.phase || 0))) * s.cloudShadow;
            o.position.x += Math.sin(t * 0.5 + (o.userData.phase || 0)) * 0.0012;
          }
        }
      });
    }

    // ---------- 舱顶粼光 ----------
    if (boats && boats.list) {
      boats.list.forEach(function (b) {
        b.traverse(function (o) {
          if (o.userData && o.userData.isCeilGlimmer) {
            o.material.opacity = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.1 + o.id * 0.3));
            o.position.x = Math.sin(t * 0.6 + o.id) * 0.12;
          }
        });
      });
    }

    // ---------- 海鸥 ----------
    if (creatures && creatures.gulls) {
      creatures.gulls.forEach(function (gu, i) {
        const ph = gu.userData.flyPhase;
        // 飞行/停歇周期：60s 一轮，飞 32s，停 28s
        const cyc = ((t + ph * 7) % 60) / 60;
        const flying = cyc < 0.53;
        // 被镜头惊扰
        const startled = s.watchLevel > 0.6;
        const wantFly = flying || startled;
        const wl = gu.userData.wingL;
        const wr = gu.userData.wingR;
        if (wantFly) {
          // 盘旋路径
          const ft = t * 0.11 + ph;
          const r = 5.5 + (i % 3) * 1.6;
          const cx = -1.5 + Math.sin(ph * 2.1) * 3.5;
          const cz = -1.5 + Math.cos(ph * 1.7) * 3.5;
          const px = cx + Math.cos(ft) * r;
          const pz = cz + Math.sin(ft) * r * 0.72;
          const py = 3.4 + Math.sin(ft * 1.7 + ph) * 1.1 + (i % 2) * 0.7;
          // 掠过水面
          const dip = Math.max(0, Math.sin(ft * 0.9 + ph)) < 0.12 ? -1.6 : 0;
          gu.position.set(px, py + dip, pz);
          // 朝向速度方向
          const nx = cx + Math.cos(ft + 0.05) * r;
          const nz = cz + Math.sin(ft + 0.05) * r * 0.72;
          gu.rotation.y = Math.atan2(nx - px, nz - pz);
          gu.rotation.z = Math.sin(ft * 2) * 0.12;
          // 扑翅
          const flap = Math.sin(t * (5.5 + (i % 3)) + ph * 3) * 0.75;
          wl.rotation.z = -0.15 - flap * 0.65;
          wr.rotation.z = 0.15 + flap * 0.65;
          wl.rotation.y = 0.1;
          wr.rotation.y = -0.1;
          gu.userData.landed = false;
        } else {
          // 落在系船柱/船顶
          const p = gu.userData.perch;
          gu.position.lerp(p, 0.04);
          gu.rotation.y += (Math.sin(ph * 3 + t * 0.1) * 0.6 - gu.rotation.y) * 0.02;
          gu.rotation.z *= 0.95;
          // 收翅
          wl.rotation.z *= 0.9;
          wr.rotation.z *= 0.9;
          wl.rotation.y += (-1.15 - wl.rotation.y) * 0.06;
          wr.rotation.y += (1.15 - wr.rotation.y) * 0.06;
          gu.userData.landed = true;
        }
      });
    }

    // ---------- 远处渔船驶过 ----------
    if (creatures && creatures.farBoat) {
      const fb = creatures.farBoat;
      const loop = (t % 150) / 150;
      fb.position.x = -14 + loop * 28;
      fb.position.y = H.L.WATER + 0.05 + Math.sin(t * 0.7) * 0.03;
      fb.rotation.y = Math.PI / 2;
      fb.visible = loop < 0.92;
    }

    // ---------- 港猫 ----------
    if (creatures && creatures.cat) {
      const cat = creatures.cat;
      // 雨疏时出来走动
      const out01 = H.smoothstep(0.52, 0.32, s.rainAmount); // 1=出来
      // 每 85s 一趟
      const trip = Math.floor(t / 85);
      const tripT = (t % 85) / 85;
      // 行走窗口 0.15..0.75
      const walk = H.smoothstep(0.12, 0.22, tripT) * (1 - H.smoothstep(0.68, 0.8, tripT));
      const moveAmt = Math.min(out01, 0.25 + walk);
      const target = catPath(trip, H.clamp(moveAmt * 1.15, 0, 1));
      // 舢板下位置
      const home = new THREE.Vector3(3.22, 0.26, 7.28);
      const goal = home.clone().lerp(target, moveAmt);
      cat.position.lerp(goal, 0.022);
      // 朝向运动方向
      const dir = goal.clone().sub(cat.position);
      if (dir.lengthSq() > 0.001) {
        const targetRot = Math.atan2(dir.x, dir.z);
        let d = targetRot - cat.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        cat.rotation.y += d * 0.045;
      }
      // 尾巴摆动
      if (cat.userData.tail) {
        cat.userData.tail.rotation.z = Math.sin(t * 1.6) * 0.35;
      }
      // 被观看时抬头
      if (cat.userData.head && s.watchLevel > 0.5 && moveAmt > 0.2) {
        cat.userData.head.rotation.x = -0.55 * s.watchLevel;
      } else if (cat.userData.head) {
        cat.userData.head.rotation.x *= 0.95;
      }
      // 步态起伏
      cat.position.y = goal.y + Math.abs(Math.sin(t * 4.2)) * 0.018 * moveAmt;
    }

    // ---------- 水下鱼群 ----------
    if (creatures && creatures.fish) {
      // 被观看时散开
      const scatter = s.watchLevel > 0.62 ? (s.watchLevel - 0.62) * 2.6 : 0;
      creatures.fish.forEach(function (f) {
        const u = f.userData;
        const ft = t * 0.42 + u.phase;
        const rr = u.radius * (1 + scatter * 1.8 + Math.sin(ft * 0.31) * 0.12);
        const px = u.center.x + Math.cos(ft) * rr;
        const pz = u.center.z + Math.sin(ft * 0.83) * rr;
        const py = u.center.y + Math.sin(ft * 1.21) * 0.12 + scatter * 0.25;
        const prev = f.position.clone();
        f.position.set(px, py, pz);
        const dir = f.position.clone().sub(prev);
        if (dir.lengthSq() > 1e-6) {
          f.rotation.y = Math.atan2(dir.x, dir.z);
        }
        // 尾摆
        f.rotation.z = Math.sin(ft * 6) * 0.16;
      });
    }

    // ---------- 出港船 ----------
    if (boats && boats.leavingBoat) {
      // 110s 一圈
      const period = 110;
      const u = (t % period) / period;
      let out;
      if (u < 0.1) out = 0;
      else if (u < 0.92) out = (u - 0.1) / 0.82;
      else out = 1;
      // 停泊时保持原位
      const boat = boats.leavingBoat;
      if (out <= 0.001) {
        boat.position.set(-2.4, H.L.WATER + 0.16, -9.2);
        boat.rotation.y = 0;
      } else if (out >= 0.999) {
        boat.position.set(-2.4, H.L.WATER + 0.16, -9.2);
        boat.rotation.y = 0;
      } else {
        const p = outPath.getPoint(out);
        const p2 = outPath.getPoint(Math.min(1, out + 0.004));
        boat.position.set(p.x, H.L.WATER + 0.16 + Math.sin(t * 0.8) * 0.03, p.z);
        boat.rotation.y = Math.atan2(p2.x - p.x, p2.z - p.z);
        boat.rotation.z = Math.sin(t * 1.1) * 0.03;
      }
      s.boatOut = out;

      // 航迹：船尾白浪环
      if (!H._wakeRings) {
        H._wakeRings = [];
        for (let i = 0; i < 8; i++) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 0.52, 18),
            new THREE.MeshBasicMaterial({
              color: 0xf6fcfa, transparent: true, opacity: 0.5,
              depthWrite: false, side: THREE.DoubleSide,
            })
          );
          ring.rotation.x = -Math.PI / 2;
          H.scene.add(ring);
          H._wakeRings.push(ring);
        }
      }
      H._wakeRings.forEach(function (ring, i) {
        if (out <= 0.002 || out >= 0.998) {
          ring.visible = false;
          return;
        }
        ring.visible = true;
        const back = Math.max(0, out - 0.006 - i * 0.007);
        const p = outPath.getPoint(back);
        ring.position.set(p.x, H.L.WATER + 0.03, p.z);
        const cyc = ((t * 0.5 + i * 0.13) % 1);
        const sc = 0.7 + cyc * 2.4;
        ring.scale.set(sc, sc, sc);
        ring.material.opacity = 0.5 * (1 - cyc);
      });

      // 航迹沿途晃动浮标
      if (props && props.buoys && out > 0.02 && out < 0.98) {
        const bp = outPath.getPoint(out);
        props.buoys.forEach(function (b) {
          const d = b.position.distanceTo(bp);
          if (d < 2.2) {
            b.rotation.z = Math.sin(t * 1.6 + b.userData.phase) * 0.1 + Math.sin(t * 3.2) * 0.035 * (1 - d / 2.2);
            b.position.y = b.userData.baseY + Math.sin(t * 0.85 + b.userData.phase) * 0.05 + Math.sin(t * 3.6) * 0.02 * (1 - d / 2.2);
          }
        });
      }
    }

    // ---------- 缆绳时紧时松（轻摆） ----------
    if (boats && boats.ropes) {
      boats.ropes.forEach(function (r, i) {
        r.rotation.z = Math.sin(t * 0.7 + i * 1.1) * 0.008;
        r.rotation.x = Math.sin(t * 0.55 + i * 0.8) * 0.006;
      });
    }

    // ---------- 贩卖机灯箱微闪 ----------
    if (props && props.vmGlow) {
      props.vmGlow.material.opacity = 0.22 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.7)) + 0.04 * Math.sin(t * 7.1);
    }

    // ---------- 灯柱灯罩微光 ----------
    if (props && props.lampPosts) {
      props.lampPosts.forEach(function (lp) {
        const k = 0.42 + 0.12 * Math.sin(t * 1.3 + lp.userData.phase);
        lp.userData.glow.material.opacity = k * (0.7 + 0.3 * s.cloudShadow);
      });
    }
  };
})();
