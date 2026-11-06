/* 普通本地脚本：导出时使用固定模拟步长，正常浏览时不接管任何全局时钟。 */
(() => {
  'use strict';
  const app = window.__harborVideo;
  const { camera, controls, scene, U } = app;
  const durations = { overview: 5, tour: 60 };

  // 保存引用和内容，在原对象上恢复，保持各更新函数闭包中的引用有效。
  function snapshot() {
    const seen = new Set(), undo = [];
    function save(value, root = false) {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      // 窗口尺寸始终由实际窗口决定，不能随初态回滚。
      if (value === U.uResolution || value === U.uResolution.value) return;
      seen.add(value);
      if (value.isObject3D || value.isTexture || value.isMaterial || value.isBufferGeometry) return;
      if (value.clone && value.copy && (value.isVector2 || value.isVector3 || value.isVector4 ||
          value.isColor || value.isMatrix3 || value.isMatrix4 || value.isQuaternion || value.isEuler)) {
        const copy = value.clone(); undo.push(() => value.copy(copy)); return;
      }
      if (ArrayBuffer.isView(value)) {
        const copy = value.slice(); undo.push(() => value.set(copy)); return;
      }
      if (value instanceof Set) {
        const copy = [...value]; undo.push(() => { value.clear(); copy.forEach(v => value.add(v)); }); return;
      }
      if (!root && !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return;
      const entries = Object.entries(value);
      const keys = new Set(entries.map(([key]) => key));
      const length = Array.isArray(value) ? value.length : null;
      undo.push(() => {
        for (const key of Object.keys(value)) if (!keys.has(key)) delete value[key];
        for (const [key, item] of entries) value[key] = item;
        if (length !== null) value.length = length;
      });
      entries.forEach(([, item]) => save(item));
    }
    // Director 是类实例，其余根节点和闭包状态是普通对象。
    save(app.state.director, true);
    save(app.state);
    save(U);
    // OrbitControls 的内部阻尼、鼠标缩放和平移状态也随导出一并恢复。
    save(controls, true);
    scene.traverse(node => {
      const position = node.position.clone(), quaternion = node.quaternion.clone(), scale = node.scale.clone();
      const visible = node.visible;
      undo.push(() => {
        node.position.copy(position); node.quaternion.copy(quaternion); node.scale.copy(scale);
        node.visible = visible; node.updateMatrix();
      });
      for (const attr of [node.instanceMatrix,
        ...(!node.frustumCulled && node.geometry ?
          [node.geometry.attributes.position, node.geometry.attributes.normal] : [])]) {
        if (!attr) continue;
        const copy = attr.array.slice();
        undo.push(() => { attr.array.set(copy); attr.needsUpdate = true; });
      }
      for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
        if (material?.uniforms) save(material.uniforms);
      }
    });
    const time = app.time, userMoved = app.userMoved, seed = app.randomState.seed;
    const cameraState = { position: camera.position.clone(), quaternion: camera.quaternion.clone(),
      fov: camera.fov, near: camera.near, far: camera.far, zoom: camera.zoom };
    return () => {
      undo.forEach(restore => restore());
      app.time = time; app.userMoved = userMoved; app.randomState.seed = seed;
      camera.position.copy(cameraState.position); camera.quaternion.copy(cameraState.quaternion);
      Object.assign(camera, { fov: cameraState.fov, near: cameraState.near, far: cameraState.far, zoom: cameraState.zoom });
      camera.updateProjectionMatrix(); scene.updateMatrixWorld(true);
    };
  }
  // 此脚本在 app.js 后同步加载，此时尚未执行第一帧。
  const resetInitial = snapshot();
  let restoreNormal = null, runId = null, fps = 60, frames = 0, tick = 0, randomSeed = 1;
  let restoreBoundary = null;
  const stepHz = 120;
  const view = new app.THREE.Vector3();

  // 镜头组，共 60 秒，12 个镜头之间硬切。每个关键帧为：镜头内秒数、镜头位置、注视点、视角。
  // 镜头顺序按导出时间线上的事件排：约 8–13 秒阵风扫过，约 14 秒海鸥落上防波堤系船柱，
  // 约 31 秒渔船解缆出港，约 43–46 秒驶过灯塔外侧，约 48–51 秒沿防波堤外侧向西。
  // follow 镜头的位置和注视点相对出港渔船的水平位置。
  const shots = [
    // 远景（0–6.6）：从港外高处慢慢推向 L 形码头，前景是防波堤和灯塔，雨丝落在阳光里。
    { keys: [
      [0, [37, 21.5, -41], [-1.5, -0.4, 1], 33],
      [6.6, [23, 12, -26.5], [-2.6, -0.8, 2.6], 33],
    ] },
    // 中景（6.6–13.4）：越过晒网架望向港口，阵风从海上吹来，远处风向袋和小旗先摆，
    // 再是渔船上的旗，最后是前景的晒网；浮球绳串挂在网架下。
    { keys: [
      [0, [-5.9, 4.3, 20.9], [8.5, 1.3, 8.6], 38],
      [6.8, [-5.5, 4.05, 20.5], [5.6, 0.75, 10], 38],
    ] },
    // 特写（13.4–18.2）：防波堤系船柱上的海鸥，长焦轻推；镜头进入 8 米内海鸥扑翅起飞，随后上摇跟出。
    { keys: [
      [0, [10.25, 1.25, -4.25], [1.45, 1.5, -9.85], 9.5],
      [2.9, [8.4, 1.22, -5.5], [1.5, 1.45, -9.9], 8.8],
      [3.7, [8.15, 1.2, -5.65], [1.55, 2, -9.8], 11],
      [4.8, [7.95, 1.18, -5.78], [1.75, 4.2, -9.4], 18],
    ] },
    // 中景（18.2–22.8）：贴水面沿堤岸横移，浮标从前景掠过，后面是泊位里的渔船。
    { keys: [
      [0, [14.2, -0.12, -6.4], [11.4, -0.5, 4.4], 34],
      [4.6, [4.2, -0.05, -5.6], [2.2, -0.4, 4.8], 34],
    ] },
    // 中景（22.8–27.4）：低机位看堤岸上的乐器硬箱和斜靠台阶的透明雨伞，前景水洼倒映灯柱和船只。
    { keys: [
      [0, [1, 0.75, 14], [1.9, 0.15, 9], 38],
      [4.6, [2.9, 0.68, 13.6], [2.4, 0.12, 8.8], 38],
    ] },
    // 特写（27.4–31.4）：隔着驾驶舱侧窗玻璃，慢慢推向雷达屏、海图和仪表台上的杯子。
    { keys: [
      [0, [-4.05, 1.08, 3.95], [-6.55, 0.58, 2.48], 30],
      [4, [-4.75, 0.93, 3.32], [-6.6, 0.56, 2.46], 26],
    ] },
    // 中景（31.4–35.6）：沿仓库前的街巷前行，经过半拉起的卷帘门，摇进仓库看光柱和成垛鱼箱。
    { keys: [
      [0, [-9.15, 1.55, 1.9], [-10.3, 1.45, -6.5], 46],
      [1.8, [-9.1, 1.5, -0.4], [-10.8, 1.4, -6.8], 46],
      [4.2, [-9.05, 1.38, -3.6], [-15.6, 0.9, -7.4], 46],
    ] },
    // 中景（35.6–39.6）：防波堤尽头的灯塔，从消波块之间翻涌的浪花上摇到灯笼。
    { keys: [
      [0, [0.4, 2.3, -19.3], [6.9, -0.9, -12.8], 40],
      [4, [1.2, 2.7, -18.8], [7.5, 3.9, -10.7], 40],
    ] },
    // 远景（39.6–47）：在港外一侧跟着出港的白色渔船，随它绕过灯塔并拉高，带上身后的航迹和港内。
    { follow: true, keys: [
      [0, [6.8, 2.5, -6.8], [-0.6, -0.7, 0.8], 40],
      [3.6, [7.2, 5.6, -7], [-1.2, -0.9, 0.9], 42],
      [7.4, [8.7, 10, -10.5], [-2.2, -1.2, 1.6], 46],
    ] },
    // 中景（47–52）：沿底座背面的剖面下沉，看防波堤岸壁、消波块、海床和鱼群，渔船从水面上方驶过。
    { keys: [
      [0, [-2.2, 0.5, -26.6], [-0.6, -0.9, -15], 42],
      [5, [-2.8, -2.2, -26.3], [-1.2, -2.5, -15], 42],
    ] },
    // 中景（52–56）：隔着候船室的落地玻璃横移，看长椅、收音机和墙上的挂钟。
    { keys: [
      [0, [-14.3, 1.3, 14.7], [-15.6, 1.3, 9], 36],
      [4, [-17.4, 1.2, 14.6], [-18, 1, 10.2], 36],
    ] },
    // 特写（56–60）：舢板下的港猫，镜头贴着滑道从斜前方推近，进入 9 米内时它抬头转向镜头。
    { keys: [
      [0, [13.55, -0.12, -1.7], [15.05, -0.58, 8.35], 10],
      [4, [13.65, -0.32, 3.6], [15.05, -0.6, 8.35], 16],
    ] },
  ];

  // 非均匀时间 Hermite 曲线，位置、注视点、视角的一阶速度在同一镜头内连续。
  function sample(keys, t, column, component) {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1], h = b[0] - a[0];
    const get = row => component === undefined ? row[column] : row[column][component];
    const slope = k => {
      const p = keys[Math.max(0, k - 1)], n = keys[Math.min(keys.length - 1, k + 1)];
      return (get(n) - get(p)) / (n[0] - p[0]);
    };
    const u = Math.max(0, Math.min(1, (t - a[0]) / h)), u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * get(a) + (u3 - 2 * u2 + u) * h * slope(i) +
      (-2 * u3 + 3 * u2) * get(b) + (u3 - u2) * h * slope(i + 1);
  }
  function pose(t) {
    if (runId === 'overview') {
      const k = Math.max(1, 1.72 / camera.aspect);
      view.set(-1.5, -1.4, -1.5);
      camera.position.set(49.8, 32.1, 57.1).multiplyScalar(k).add(view);
      camera.fov = 30;
    } else {
      let start = 0, shot = shots[0];
      for (shot of shots) {
        const length = shot.keys[shot.keys.length - 1][0];
        if (t < start + length || shot === shots[shots.length - 1]) break;
        start += length;
      }
      const keys = shot.keys, local = t - start;
      camera.position.set(sample(keys, local, 1, 0), sample(keys, local, 1, 1), sample(keys, local, 1, 2));
      view.set(sample(keys, local, 2, 0), sample(keys, local, 2, 1), sample(keys, local, 2, 2));
      if (shot.follow) {
        const boat = app.state.harbor.boats[3].group.position;
        camera.position.x += boat.x; camera.position.z += boat.z;
        view.x += boat.x; view.z += boat.z;
      }
      camera.fov = sample(keys, local, 3);
      // 窄窗口保留横向取景，宽屏仍使用设计视角。
      camera.fov = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.max(1, 1.72 / camera.aspect)) * 180 / Math.PI;
    }
    camera.near = 0.12;
    camera.zoom = 1;
    camera.lookAt(view);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
  }
  function simulate(t, dt) {
    pose(t);
    // 仅在同步更新期间替换随机数和旧海鸥代码里的 performance.now；不污染正常操作。
    const realRandom = Math.random, descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    Math.random = () => {
      randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
      return randomSeed / 4294967296;
    };
    Object.defineProperty(performance, 'now', { configurable: true, value: () => t * 1000 });
    try { app.update(t, dt); }
    finally {
      Math.random = realRandom;
      if (descriptor) Object.defineProperty(performance, 'now', descriptor);
      else delete performance.now;
    }
  }
  function end() {
    if (!restoreNormal) return;
    restoreBoundary = null;
    restoreNormal(); restoreNormal = null; runId = null;
    app.draw();
    app.resume();
  }
  window.videoExport = {
    runs: ['overview', 'tour'],
    async begin(id, options = {}) {
      if (!Object.prototype.hasOwnProperty.call(durations, id)) throw new Error('未知视频段：' + id);
      const rate = options.fps === undefined ? 60 : options.fps;
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('fps 必须是大于零的有限数字');
      end();
      app.pause();
      try {
        await app.ready;
        restoreNormal = snapshot();
        resetInitial();
        controls.enabled = false;
        runId = id; fps = rate; frames = Math.round(durations[id] * fps); tick = 0; randomSeed = 0x5a17c9;
        simulate(0, 0);
        app.draw();
        return { frames };
      } catch (error) {
        if (restoreNormal) end(); else app.resume();
        throw error;
      }
    },
    async frame(i) {
      if (!restoreNormal) throw new Error('请先调用 begin()');
      if (!Number.isInteger(i) || i < 0 || i >= frames) throw new Error('帧序号超出范围');
      const target = i / fps;
      if (target < tick / stepHz - 1e-8) throw new Error('请从第零帧按顺序调用 frame()');
      if (restoreBoundary) { restoreBoundary(); restoreBoundary = null; }
      while ((tick + 1) / stepHz <= target + 1e-8) {
        tick++;
        simulate(tick / stepHz, 1 / stepHz);
      }
      // 支持非整除 120 的 fps：末尾不足一步时只临时取样，防止累计误差。
      if (Math.abs(target - tick / stepHz) > 1e-8) {
        const restoreTick = snapshot(), seed = randomSeed;
        simulate(target, target - tick / stepHz);
        app.draw();
        app.renderer.getContext().finish();
        restoreBoundary = () => { restoreTick(); randomSeed = seed; };
      } else {
        pose(target); app.draw(); app.renderer.getContext().finish();
      }
    },
    end,
  };
})();
