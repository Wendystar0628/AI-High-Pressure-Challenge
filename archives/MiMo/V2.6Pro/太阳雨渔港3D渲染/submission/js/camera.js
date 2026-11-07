/* 轨道相机控制（拖拽旋转 / 滚轮缩放 / 右键平移） */
(function () {
  'use strict';
  const H = window.H;

  H.makeCamera = function (camera, dom) {
    const state = {
      target: new THREE.Vector3(-0.5, 0.4, -0.5),
      radius: 22,
      theta: 0.72, // 方位角
      phi: 1.02, // 极角（0=正上方）
      minR: 3.2,
      maxR: 42,
      minPhi: 0.18,
      maxPhi: 1.46,
      dragging: false,
      panning: false,
      lastX: 0,
      lastY: 0,
      userActive: false,
      lastInteract: -10,
      autoRotate: true,
    };

    function apply() {
      const sp = Math.sin(state.phi), cp = Math.cos(state.phi);
      camera.position.set(
        state.target.x + state.radius * sp * Math.sin(state.theta),
        state.target.y + state.radius * cp,
        state.target.z + state.radius * sp * Math.cos(state.theta)
      );
      camera.lookAt(state.target);
    }
    apply();

    function interact(t) {
      state.lastInteract = t;
      state.userActive = true;
    }

    dom.addEventListener('mousedown', function (e) {
      if (e.button === 0) state.dragging = true;
      else if (e.button === 2) state.panning = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      interact(H.sim.t);
    });
    window.addEventListener('mouseup', function () {
      state.dragging = false;
      state.panning = false;
    });
    window.addEventListener('mousemove', function (e) {
      if (!state.dragging && !state.panning) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      if (state.dragging) {
        state.theta += dx * 0.0052;
        state.phi = H.clamp(state.phi + dy * 0.0042, state.minPhi, state.maxPhi);
      } else if (state.panning) {
        const sp = Math.sin(state.phi), cp = Math.cos(state.phi);
        const right = new THREE.Vector3(Math.cos(state.theta), 0, -Math.sin(state.theta));
        const up = new THREE.Vector3(-cp * Math.sin(state.theta), sp, -cp * Math.cos(state.theta));
        const k = state.radius * 0.0016;
        state.target.addScaledVector(right, -dx * k);
        state.target.addScaledVector(up, dy * k);
        state.target.x = H.clamp(state.target.x, -12, 12);
        state.target.y = H.clamp(state.target.y, -1.2, 8);
        state.target.z = H.clamp(state.target.z, -12, 12);
      }
      interact(H.sim.t);
    });
    dom.addEventListener('wheel', function (e) {
      e.preventDefault();
      const d = e.deltaY > 0 ? 1.11 : 0.9;
      state.radius = H.clamp(state.radius * d, state.minR, state.maxR);
      interact(H.sim.t);
    }, { passive: false });
    dom.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    // 触发“被观看”程度：镜头靠近场景中心
    function update(dt, t) {
      if (H.sim.exportMode) {
        apply();
        return;
      }
      // 缓慢自动漂移（用户未操作时）
      if (t - state.lastInteract > 4.0) {
        state.theta += dt * 0.012;
        state.userActive = false;
      }
      apply();
      // watch level: 镜头半径小 → 被观看
      H.sim.watchLevel = H.clamp(1 - (state.radius - 5) / 12, 0, 1);
    }

    function setPose(theta, phi, radius, target) {
      state.theta = theta;
      state.phi = phi;
      state.radius = radius;
      if (target) state.target.copy(target);
      apply();
    }

    function getPose() {
      return {
        theta: state.theta,
        phi: state.phi,
        radius: state.radius,
        target: state.target.clone(),
      };
    }

    // 导出模式直接设置位姿（含位置 + 注视点）
    function setCameraPose(pos, lookAt, up) {
      camera.position.copy(pos);
      camera.up.copy(up || new THREE.Vector3(0, 1, 0));
      camera.lookAt(lookAt);
    }

    return {
      state: state,
      update: update,
      setPose: setPose,
      getPose: getPose,
      setCameraPose: setCameraPose,
      apply: apply,
    };
  };
})();
