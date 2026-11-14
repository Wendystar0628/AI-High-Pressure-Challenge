/**
 * Forge Studio — 15-Second Default Demo Project:「锻字」(Section 三)
 * 100% Procedural & Editable Project Data:
 *   Stage 1 (0.0s - 3.6s): 写成 — Calligraphic strokes trace progressively into「锻」
 *   Stage 2 (3.6s - 6.5s): 成块 — Extrudes into an incandescent 3D molten metal character block
 *   Stage 3 (6.5s - 11.4s): 锻打 — 3 escalating hammer strikes with anticipation/accel/follow-through,
 *                           spatial field mesh denting, expression camera shake & colliding 3D sparks
 *   Stage 4 (11.4s - 15.0s): 冷却 — Incandescence cools to sleek brushed steel, embers fade, camera settles
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { uid } = Forge.Math;
  const Geo2D = Forge.Geo2D;
  const Anim = Forge.Anim;
  const Nodes = Forge.Nodes;
  const Scene = Forge.SceneEval;

  // Helper to attach keyframes concisely
  function addKF(prop, time, value, easeMode = 'ease', extra = {}) {
    prop.animated = true;
    const kf = {
      id: uid('kf'),
      time,
      value: Anim.cloneValue(value, prop.type),
      inInterp: easeMode === 'linear' ? 'linear' : easeMode === 'hold' ? 'linear' : 'bezier',
      outInterp: easeMode === 'linear' ? 'linear' : easeMode === 'hold' ? 'hold' : 'bezier',
      inEase: { influence: extra.inInf ?? 36, speed: extra.inSpd ?? 0 },
      outEase: { influence: extra.outInf ?? 36, speed: extra.outSpd ?? 0 }
    };
    if (prop.isSpatial && Array.isArray(value)) {
      kf.spatialMode = extra.spatialMode || 'smooth';
      kf.spatialIn = extra.spatialIn || [0, 0, 0];
      kf.spatialOut = extra.spatialOut || [0, 0, 0];
      if (extra.spatialIn || extra.spatialOut) kf.spatialCustom = true;
    }
    prop.keyframes.push(kf);
    Anim.sortKeyframes(prop);
    if (prop.isSpatial) Anim.recomputeSmoothSpatialTangents(prop);
    return kf;
  }

  function createEmptyProject() {
    const mainComp = Scene.createComposition({
      name: '新建合成 1',
      width: 1280,
      height: 720,
      fps: 30,
      duration: 10,
      bgColor: [0.06, 0.065, 0.085]
    });
    return {
      version: '1.0',
      name: '未命名工程',
      activeCompId: mainComp.id,
      compositions: [mainComp]
    };
  }

  function createForgeDemoProject() {
    const W = 1280;
    const H = 720;

    // -----------------------------------------------------------------------
    // SUB-COMPOSITION:「炉台火纹预合成」(Demonstrates real Pre-comp + Repeater + Trim!)
    // -----------------------------------------------------------------------
    const sigilComp = Scene.createComposition({
      name: '炉台火纹预合成',
      width: W,
      height: H,
      fps: 30,
      duration: 15,
      bgColor: [0, 0, 0]
    });
    sigilComp.transparentBg = true;

    const ringShape = Scene.createShapeLayer(sigilComp, '锻炉刻度环', 'ellipse');
    ringShape.shapeData.fillEnabled = false;
    ringShape.shapeData.strokeEnabled = true;
    ringShape.shapeData.strokeColor.value = [0.95, 0.45, 0.12];
    ringShape.shapeData.strokeWidth.value = 2.2;
    ringShape.shapeData.strokeOpacity.value = 55;
    ringShape.shapeData.items[0].size.value = [450, 450];
    // Add a dashed/trimmed tick accent via Repeater!
    const tickShape = Scene.createShapeLayer(sigilComp, '锻造阵列刻线', 'rect');
    tickShape.shapeData.fillEnabled = true;
    tickShape.shapeData.fillColor.value = [1.0, 0.52, 0.14];
    tickShape.shapeData.fillOpacity.value = 42;
    tickShape.shapeData.strokeEnabled = false;
    tickShape.shapeData.items[0].position.value = [0, -242];
    tickShape.shapeData.items[0].size.value = [4, 18];
    tickShape.shapeData.items[0].roundness.value = 2;
    const rep = Scene.createShapeOperator('repeater');
    rep.copies.value = 12;
    rep.position.value = [0, 0];
    rep.scale.value = [100, 100];
    rep.rotation.value = 30;
    tickShape.shapeData.items.push(rep);
    // Gentle expression-driven slow rotation!
    ringShape.transform.rotationZ.expressionEnabled = true;
    ringShape.transform.rotationZ.expression = 'time * 4.5';
    tickShape.transform.rotationZ.expressionEnabled = true;
    tickShape.transform.rotationZ.expression = '-time * 3.0';

    sigilComp.layers = [tickShape, ringShape];

    // -----------------------------------------------------------------------
    // MAIN 15-SECOND COMPOSITION:「锻字 (主合成 15s)」
    // -----------------------------------------------------------------------
    const mainComp = Scene.createComposition({
      name: '锻字 (主合成 15s)',
      width: W,
      height: H,
      fps: 30,
      duration: 15,
      bgColor: [0.042, 0.046, 0.062]
    });
    mainComp.workAreaStart = 0;
    mainComp.workAreaEnd = 15;
    mainComp.motionBlur = {
      enabled: true,
      shutterAngle: 190,
      shutterPhase: -95,
      samples: 7
    };

    // 1. Master Controller Null:「震动控制器」(Drives Camera impact shake via cross-layer Expression!)
    const shakeCtrl = Scene.createNullLayer(mainComp, '震动控制器');
    shakeCtrl.visible = false;
    // Scale[0] encodes impact shake amplitude (0 at rest, spikes on the 3 hammer blows!)
    addKF(shakeCtrl.transform.rotationZ, 0.0, 0, 'linear');
    addKF(shakeCtrl.transform.rotationZ, 7.32, 0, 'linear');
    addKF(shakeCtrl.transform.rotationZ, 7.36, 14, 'ease');
    addKF(shakeCtrl.transform.rotationZ, 7.82, 0, 'ease');
    addKF(shakeCtrl.transform.rotationZ, 8.82, 0, 'linear');
    addKF(shakeCtrl.transform.rotationZ, 8.86, 21, 'ease');
    addKF(shakeCtrl.transform.rotationZ, 9.38, 0, 'ease');
    addKF(shakeCtrl.transform.rotationZ, 10.32, 0, 'linear');
    addKF(shakeCtrl.transform.rotationZ, 10.36, 32, 'ease');
    addKF(shakeCtrl.transform.rotationZ, 11.05, 0, 'ease');
    addKF(shakeCtrl.transform.rotationZ, 15.0, 0, 'linear');

    // 2. Active 3D Camera:「主摄影机」(Parented to Camera Shake Rig!)
    const camRig = Scene.createNullLayer(mainComp, '摄影机震动架');
    camRig.threeD = true;
    camRig.visible = false;
    camRig.transform.position.value = [W * 0.5, H * 0.5, 0];
    // Cross-layer expression using wiggle + controller reference!
    camRig.transform.position.expressionEnabled = true;
    camRig.transform.position.expression =
      'wiggle(26, thisComp.layer("震动控制器").transform.rotation)';

    const camLayer = Scene.createCameraLayer(mainComp, '主摄影机');
    camLayer.parentId = camRig.id;
    camLayer.motionBlur = false;
    // Camera choreography across the 4 stages (in parent camRig local space where [0,0,0] = comp center [640,360,0]):
    // Stage 1 (写成 0-3.5s): Poised near-frontal elevated view
    addKF(camLayer.transform.position, 0.0, [0, -28, -760], 'ease');
    addKF(camLayer.transform.position, 3.3, [18, -36, -745], 'ease');
    // Stage 2 (成块 3.5-6.5s): Dramatic 3D orbit revealing rising hot metal thickness & bevels
    addKF(camLayer.transform.position, 6.2, [-215, -155, -670], 'ease');
    // Stage 3 (锻打 6.5-11.4s): Heroic forging angle with clear view of character + hammer strikes + spark ricochets
    addKF(camLayer.transform.position, 7.2, [-185, -165, -755], 'ease');
    addKF(camLayer.transform.position, 10.5, [-155, -150, -735], 'ease');
    // Stage 4 (冷却 11.4-14.0s, completely rock-steady 14.0-15.0s!): Dignified steel portrait
    addKF(camLayer.transform.position, 13.85, [-85, -75, -685], 'ease');
    addKF(camLayer.transform.position, 15.0, [-85, -75, -685], 'linear');

    // Camera Target (Point of Interest) in parent space (comp center = [640, 360, 0] in world; wait: getActiveCameraState transforms cam.target by parentM, so local [0, 0, -20] -> world [640, 360, -20]!)
    addKF(camLayer.camera.target, 0.0, [0, 4, -8], 'ease');
    addKF(camLayer.camera.target, 3.5, [0, 2, -14], 'ease');
    addKF(camLayer.camera.target, 6.4, [6, -6, -28], 'ease');
    addKF(camLayer.camera.target, 11.2, [4, -6, -26], 'ease');
    addKF(camLayer.camera.target, 13.85, [0, -4, -26], 'ease');
    addKF(camLayer.camera.target, 15.0, [0, -4, -26], 'linear');

    // Depth of Field (`focusDistance` & `aperture`) tracking the forged character!
    addKF(camLayer.camera.focusDistance, 0.0, 760, 'ease');
    addKF(camLayer.camera.focusDistance, 3.5, 745, 'ease');
    addKF(camLayer.camera.focusDistance, 6.2, 710, 'ease');
    addKF(camLayer.camera.focusDistance, 10.5, 755, 'ease');
    addKF(camLayer.camera.focusDistance, 13.85, 692, 'ease');
    addKF(camLayer.camera.focusDistance, 15.0, 692, 'linear');

    addKF(camLayer.camera.aperture, 0.0, 4, 'ease');
    addKF(camLayer.camera.aperture, 3.6, 8, 'ease');
    addKF(camLayer.camera.aperture, 6.2, 18, 'ease');
    addKF(camLayer.camera.aperture, 11.4, 15, 'ease');
    addKF(camLayer.camera.aperture, 13.85, 12, 'ease');
    addKF(camLayer.camera.aperture, 15.0, 12, 'linear');

    // 3. Scene Lights:
    // 3a. Directional Shadow-Casting Key Light:「天窗冷钢主光」(Casts real geometric shadow onto anvil!)
    const keyLight = Scene.createLightLayer(mainComp, '天窗主聚光 (投射阴影)', 'directional');
    keyLight.transform.position.value = [W * 0.5 + 340, H * 0.5 - 420, -520];
    keyLight.light.target.value = [W * 0.5, H * 0.5, 0];
    keyLight.light.castShadows = true;
    addKF(keyLight.light.color, 0.0, [0.95, 0.88, 0.78], 'ease');
    addKF(keyLight.light.color, 6.5, [1.0, 0.90, 0.80], 'ease');
    addKF(keyLight.light.color, 13.8, [0.86, 0.93, 1.0], 'ease');
    addKF(keyLight.light.intensity, 0.0, 0.95, 'ease');
    addKF(keyLight.light.intensity, 6.0, 1.35, 'ease');
    addKF(keyLight.light.intensity, 13.8, 1.68, 'ease');
    addKF(keyLight.light.intensity, 15.0, 1.68, 'linear');

    // 3b. Dynamic Forge Hearth Point Light:「熔炉火光点光源」(Flares warmly during heating & hammer impacts, cools in Stage 4!)
    const hearthLight = Scene.createLightLayer(mainComp, '熔炉炽热点光源', 'point');
    hearthLight.light.castShadows = false;
    hearthLight.light.color.value = [1.0, 0.45, 0.10];
    hearthLight.light.range.value = 1400;
    hearthLight.transform.position.value = [W * 0.5 + 80, H * 0.5 + 110, -190];
    addKF(hearthLight.light.intensity, 0.0, 0.85, 'ease');
    addKF(hearthLight.light.intensity, 3.5, 1.25, 'ease');
    addKF(hearthLight.light.intensity, 6.0, 2.55, 'ease');
    addKF(hearthLight.light.intensity, 7.36, 3.6, 'ease');
    addKF(hearthLight.light.intensity, 7.8, 2.2, 'ease');
    addKF(hearthLight.light.intensity, 8.86, 3.9, 'ease');
    addKF(hearthLight.light.intensity, 9.3, 2.3, 'ease');
    addKF(hearthLight.light.intensity, 10.36, 4.5, 'ease');
    addKF(hearthLight.light.intensity, 11.4, 2.1, 'ease');
    addKF(hearthLight.light.intensity, 13.8, 0.35, 'ease');
    addKF(hearthLight.light.intensity, 15.0, 0.35, 'linear');

    // 4. Master Character Layer:「锻字主字 (可改字)」(Text Layer!)
    // Stage 1 (0.0s - 3.85s): Visible on the anvil surface (`z = -2`), writing strokes progressively!
    // Downstream Node Graph ALSO reads this exact layer's character contours for Stage 2-4!
    const masterText = Scene.createTextLayer(mainComp, '锻字主字 (在此改字)', '锻');
    masterText.threeD = true;
    masterText.castShadows = false;
    masterText.receiveShadows = false;
    masterText.inPoint = 0;
    masterText.outPoint = 4.0;
    masterText.transform.position.value = [W * 0.5, H * 0.5, -2];
    masterText.textData.fontFamily = 'forge_heavy';
    masterText.textData.fontSize.value = 310;
    masterText.textData.strokeMode = true;
    masterText.textData.fillColor.value = [1.0, 0.76, 0.28];
    // Frame 0 already has 15% of the first strokes glowing on the anvil ("第 0 帧画面已经成立")!
    addKF(masterText.textData.trimEnd, 0.0, 15, 'ease');
    addKF(masterText.textData.trimEnd, 3.35, 100, 'ease');
    addKF(masterText.transform.opacity, 0.0, 100, 'linear');
    addKF(masterText.transform.opacity, 3.45, 100, 'ease');
    addKF(masterText.transform.opacity, 3.95, 0, 'ease');
    // Warm golden glow effect on the calligraphy strokes!
    const writeGlow = Scene.createEffectInstance('glow');
    writeGlow.params.threshold.value = 0.25;
    writeGlow.params.radius.value = 26;
    writeGlow.params.intensity.value = 1.45;
    writeGlow.params.color.value = [1.0, 0.55, 0.14];
    masterText.effects.push(writeGlow);

    // 5. Spatial Fields (Section 2.8 — simultaneously deform the 3D metal character AND accelerate particles!):
    // 5a. Hammer Impact Dent Field:「锻击凹陷空间场」
    const dentFieldLayer = Scene.createFieldLayer(mainComp, '锻击凹陷空间场', 'radial');
    dentFieldLayer.field.radialMode = 'dent';
    dentFieldLayer.field.direction.value = [0, 3, 10]; // Compresses into +Z (into anvil) + lateral forge bulge!
    dentFieldLayer.field.innerRadius.value = 52;
    dentFieldLayer.field.outerRadius.value = 195;
    // Moves impact focus across the 3 strikes (Strike 1 left-upper, Strike 2 right-mid, Strike 3 center hero!)
    addKF(dentFieldLayer.transform.position, 0.0, [W * 0.5 - 55, H * 0.5 - 25, -52], 'linear');
    addKF(dentFieldLayer.transform.position, 7.3, [W * 0.5 - 55, H * 0.5 - 25, -52], 'hold');
    addKF(dentFieldLayer.transform.position, 8.5, [W * 0.5 + 48, H * 0.5 + 10, -52], 'hold');
    addKF(dentFieldLayer.transform.position, 10.0, [W * 0.5 + 5, H * 0.5 - 5, -52], 'linear');

    addKF(dentFieldLayer.field.strength, 0.0, 0, 'linear');
    addKF(dentFieldLayer.field.strength, 7.30, 0, 'linear');
    addKF(dentFieldLayer.field.strength, 7.37, 15, 'ease');   // Strike 1 impact dent!
    addKF(dentFieldLayer.field.strength, 7.75, 5.5, 'ease');  // Hot plastic retention
    addKF(dentFieldLayer.field.strength, 8.80, 5.5, 'linear');
    addKF(dentFieldLayer.field.strength, 8.87, 22, 'ease');   // Strike 2 deeper dent!
    addKF(dentFieldLayer.field.strength, 9.30, 9.0, 'ease');
    addKF(dentFieldLayer.field.strength, 10.30, 9.0, 'linear');
    addKF(dentFieldLayer.field.strength, 10.37, 29, 'ease');  // Strike 3 climax dent!
    addKF(dentFieldLayer.field.strength, 11.10, 11.5, 'ease'); // Permanent forged metal facet settles cleanly!
    addKF(dentFieldLayer.field.strength, 15.0, 11.5, 'linear');

    // 5b. Vortex Swirl Field:「热浪旋涡空间场」(Swirls rising sparks organically!)
    const vortexFieldLayer = Scene.createFieldLayer(mainComp, '热浪旋涡空间场', 'vortex');
    vortexFieldLayer.transform.position.value = [W * 0.5, H * 0.5 - 40, -60];
    vortexFieldLayer.field.direction.value = [0, -1, -0.35];
    vortexFieldLayer.field.innerRadius.value = 60;
    vortexFieldLayer.field.outerRadius.value = 460;
    vortexFieldLayer.field.strength.value = 14;
    vortexFieldLayer.field.radialPull.value = -4;

    // 6. Procedural Node Graph (Section 2.7 — Live Extrusion + Field Deformation + Multi-Consumer Branching!):
    const nCharIn = Nodes.createNode('layer_geo_in', 70, 110, '读取主字轮廓');
    nCharIn.params.sourceLayerId = masterText.id;
    nCharIn.params.useStrokes = false;

    const nExtrude = Nodes.createNode('extrude_3d', 310, 95, '字形三维挤出');
    nExtrude.params.align = 'back'; // Base sits planted on z=0 anvil while thickness rises toward -Z!
    addKF(nExtrude.params.depth, 0.0, 2, 'linear');
    addKF(nExtrude.params.depth, 3.5, 3, 'ease');
    addKF(nExtrude.params.depth, 6.1, 56, 'ease');    // Stage 2: 成块!
    addKF(nExtrude.params.depth, 7.37, 52, 'ease');   // Slight forge compression under hammer
    addKF(nExtrude.params.depth, 10.38, 47, 'ease');  // Forged compact thickness
    addKF(nExtrude.params.depth, 15.0, 47, 'linear');

    addKF(nExtrude.params.bevelDepth, 0.0, 0.5, 'linear');
    addKF(nExtrude.params.bevelDepth, 3.6, 0.8, 'ease');
    addKF(nExtrude.params.bevelDepth, 6.1, 6.5, 'ease');
    addKF(nExtrude.params.bevelDepth, 15.0, 6.5, 'linear');

    addKF(nExtrude.params.bevelWidth, 0.0, 0.5, 'linear');
    addKF(nExtrude.params.bevelWidth, 3.6, 0.8, 'ease');
    addKF(nExtrude.params.bevelWidth, 6.1, 5.8, 'ease');
    addKF(nExtrude.params.bevelWidth, 15.0, 5.8, 'linear');

    const nFieldIn = Nodes.createNode('field_source', 310, 285, '读取锻击空间场');
    nFieldIn.params.sourceLayerId = dentFieldLayer.id;

    const nDeform = Nodes.createNode('deform_3d', 565, 145, '受击网格变形');
    nDeform.params.fieldAmount.value = 1.0;
    // Subtle forge impact flex on bendAngle at strikes too!
    addKF(nDeform.params.bendAngle, 0.0, 0, 'linear');
    addKF(nDeform.params.bendAngle, 7.31, 0, 'linear');
    addKF(nDeform.params.bendAngle, 7.37, -4.5, 'ease');
    addKF(nDeform.params.bendAngle, 7.75, -1.0, 'ease');
    addKF(nDeform.params.bendAngle, 8.81, -1.0, 'linear');
    addKF(nDeform.params.bendAngle, 8.87, 5.2, 'ease');
    addKF(nDeform.params.bendAngle, 9.30, 1.2, 'ease');
    addKF(nDeform.params.bendAngle, 10.31, 1.2, 'linear');
    addKF(nDeform.params.bendAngle, 10.37, -6.5, 'ease');
    addKF(nDeform.params.bendAngle, 11.1, -1.8, 'ease');
    addKF(nDeform.params.bendAngle, 15.0, -1.8, 'linear');

    // ONE deformed geometry output branches simultaneously to 3 consumers (Section 2.7)!
    const nOutDisplay = Nodes.createNode('output_display', 845, 55, '显示输出: 锻造字块');
    const nOutEmitter = Nodes.createNode('consumer_emitter', 845, 180, '粒子发射: 字块受击处');
    const nOutCollider = Nodes.createNode('consumer_collider', 845, 305, '碰撞表面: 字块侧壁');

    // 7. Forged 3D Metal Character Layer:「锻造字块 (三维实体)」
    const forgedBlockLayer = Scene.createNodeGeoLayer(mainComp, '锻造字块 (三维实体)', nOutDisplay.id);
    nOutDisplay.params.targetLayerId = forgedBlockLayer.id;
    forgedBlockLayer.inPoint = 3.35;
    forgedBlockLayer.outPoint = 15.0;
    forgedBlockLayer.castShadows = true;
    forgedBlockLayer.receiveShadows = true;
    forgedBlockLayer.motionBlur = false;
    forgedBlockLayer.transform.position.value = [W * 0.5, H * 0.5, 0];

    addKF(forgedBlockLayer.transform.opacity, 3.35, 0, 'ease');
    addKF(forgedBlockLayer.transform.opacity, 3.85, 100, 'ease');
    addKF(forgedBlockLayer.transform.opacity, 15.0, 100, 'linear');

    // PBR Material Evolution across Stage 2 (炽热成块) -> Stage 3 (锤击闪耀) -> Stage 4 (淬火冷却成钢)!
    const bm = forgedBlockLayer.material;
    addKF(bm.baseColor, 3.4, [0.98, 0.52, 0.14], 'ease');
    addKF(bm.baseColor, 6.2, [0.88, 0.28, 0.07], 'ease');
    addKF(bm.baseColor, 10.4, [0.95, 0.34, 0.08], 'ease');
    addKF(bm.baseColor, 11.6, [0.52, 0.22, 0.14], 'ease');
    addKF(bm.baseColor, 13.7, [0.66, 0.72, 0.80], 'ease'); // Tempered brushed silver-gunmetal steel!
    addKF(bm.baseColor, 15.0, [0.66, 0.72, 0.80], 'linear');

    addKF(bm.metallic, 3.4, 0.72, 'ease');
    addKF(bm.metallic, 11.4, 0.84, 'ease');
    addKF(bm.metallic, 13.7, 0.96, 'ease');
    addKF(bm.metallic, 15.0, 0.96, 'linear');

    addKF(bm.roughness, 3.4, 0.46, 'ease');
    addKF(bm.roughness, 11.2, 0.38, 'ease');
    addKF(bm.roughness, 13.7, 0.16, 'ease'); // Smooth gleaming forged steel bevels!
    addKF(bm.roughness, 15.0, 0.16, 'linear');

    addKF(bm.emissionColor, 3.4, [1.0, 0.55, 0.14], 'ease');
    addKF(bm.emissionColor, 6.2, [1.0, 0.36, 0.06], 'ease');
    addKF(bm.emissionColor, 10.37, [1.0, 0.52, 0.12], 'ease');
    addKF(bm.emissionColor, 12.6, [0.75, 0.14, 0.02], 'ease');
    addKF(bm.emissionColor, 13.8, [0.0, 0.0, 0.0], 'ease');

    addKF(bm.emissionIntensity, 3.4, 2.35, 'ease');
    addKF(bm.emissionIntensity, 6.2, 1.65, 'ease');
    addKF(bm.emissionIntensity, 7.36, 2.45, 'ease'); // Flare on Strike 1!
    addKF(bm.emissionIntensity, 7.85, 1.45, 'ease');
    addKF(bm.emissionIntensity, 8.86, 2.65, 'ease'); // Flare on Strike 2!
    addKF(bm.emissionIntensity, 9.35, 1.50, 'ease');
    addKF(bm.emissionIntensity, 10.36, 3.10, 'ease'); // Peak white-hot flare on Strike 3!
    addKF(bm.emissionIntensity, 11.3, 1.35, 'ease');
    addKF(bm.emissionIntensity, 13.75, 0.0, 'ease');  // Completely cooled to true metallic luster!
    addKF(bm.emissionIntensity, 15.0, 0.0, 'linear');

    // 8. 3D Blacksmith Hammer:「重锻铁锤」(With classic Anticipation -> Fast Acceleration -> Impact -> Follow-through + Motion Blur!)
    const hammerLayer = Scene.createSolid3DLayer(mainComp, '重锻铁锤', 'hammer');
    hammerLayer.inPoint = 6.35;
    hammerLayer.outPoint = 11.55;
    hammerLayer.motionBlur = true; // Real 3D shutter motion blur on high-speed downward swings!
    hammerLayer.castShadows = true;
    hammerLayer.receiveShadows = true;
    hammerLayer.solidData.sizeX.value = 96;
    hammerLayer.solidData.sizeY.value = 68;
    hammerLayer.solidData.sizeZ.value = 74;
    hammerLayer.material.baseColor.value = [0.34, 0.37, 0.42];
    hammerLayer.material.metallic.value = 0.91;
    hammerLayer.material.roughness.value = 0.27;
    // Pivot near handle grip so rotation swings the heavy hammerhead in a natural power arc!
    hammerLayer.transform.anchorPoint.value = [0, -195, 0];

    // Strike 1 (7.36s), Strike 2 (8.86s), Strike 3 (10.36s):
    // Notice hammer strikes from upper-right/front-Z onto the character's front-top bevels (`z ~ -86`) and lifts cleanly away!
    addKF(hammerLayer.transform.position, 6.35, [W * 0.5 + 165, H * 0.5 - 390, -240], 'ease');
    // Strike 1: wind-up coil (6.95s) -> fast slam (7.36s) -> elastic rebound (7.68s)
    addKF(hammerLayer.transform.position, 6.98, [W * 0.5 + 65, H * 0.5 - 305, -255], 'ease', { outInf: 65 });
    addKF(hammerLayer.transform.position, 7.36, [W * 0.5 - 45, H * 0.5 - 195, -92], 'ease', { inInf: 18, outInf: 25 });
    addKF(hammerLayer.transform.position, 7.72, [W * 0.5 + 35, H * 0.5 - 275, -210], 'ease');
    // Strike 2: wind-up coil (8.45s) -> faster slam (8.86s) -> rebound (9.22s)
    addKF(hammerLayer.transform.position, 8.46, [W * 0.5 + 145, H * 0.5 - 315, -275], 'ease', { outInf: 68 });
    addKF(hammerLayer.transform.position, 8.86, [W * 0.5 + 48, H * 0.5 - 172, -88], 'ease', { inInf: 15, outInf: 25 });
    addKF(hammerLayer.transform.position, 9.24, [W * 0.5 + 110, H * 0.5 - 275, -220], 'ease');
    // Strike 3 (Hero Climax): high wind-up pause (9.92s) -> max-velocity slam (10.36s) -> rebound (10.75s) -> clean exit (11.5s)!
    addKF(hammerLayer.transform.position, 9.94, [W * 0.5 + 115, H * 0.5 - 345, -310], 'ease', { outInf: 74 });
    addKF(hammerLayer.transform.position, 10.36, [W * 0.5 + 8, H * 0.5 - 182, -85], 'ease', { inInf: 12, outInf: 22 });
    addKF(hammerLayer.transform.position, 10.76, [W * 0.5 + 75, H * 0.5 - 270, -215], 'ease');
    addKF(hammerLayer.transform.position, 11.50, [W * 0.5 + 240, H * 0.5 - 460, -340], 'ease');

    // Hammer swing angles (X & Z rotation for authentic blacksmith wrist/shoulder snap!)
    addKF(hammerLayer.transform.rotationX, 6.35, -52, 'ease');
    addKF(hammerLayer.transform.rotationX, 6.98, -64, 'ease', { outInf: 65 });
    addKF(hammerLayer.transform.rotationX, 7.36, -4, 'ease', { inInf: 16 });
    addKF(hammerLayer.transform.rotationX, 7.72, -38, 'ease');
    addKF(hammerLayer.transform.rotationX, 8.46, -68, 'ease', { outInf: 68 });
    addKF(hammerLayer.transform.rotationX, 8.86, -3, 'ease', { inInf: 14 });
    addKF(hammerLayer.transform.rotationX, 9.24, -42, 'ease');
    addKF(hammerLayer.transform.rotationX, 9.94, -76, 'ease', { outInf: 74 });
    addKF(hammerLayer.transform.rotationX, 10.36, -2, 'ease', { inInf: 12 });
    addKF(hammerLayer.transform.rotationX, 10.76, -44, 'ease');
    addKF(hammerLayer.transform.rotationX, 11.50, -68, 'ease');

    hammerLayer.transform.rotationZ.value = -16;

    // 9. 3D Iron Anvil Base:「玄铁砧台」(Receives real hole-accurate shadows & collides with sparks!)
    const anvilLayer = Scene.createSolid3DLayer(mainComp, '玄铁砧台', 'plane');
    anvilLayer.solidData.sizeX.value = 680;
    anvilLayer.solidData.sizeY.value = 500;
    anvilLayer.transform.position.value = [W * 0.5, H * 0.5 + 8, 1];
    anvilLayer.castShadows = false;
    anvilLayer.receiveShadows = true;
    anvilLayer.material.baseColor.value = [0.16, 0.18, 0.22];
    anvilLayer.material.metallic.value = 0.82;
    anvilLayer.material.roughness.value = 0.40;

    // Sculpted 3D Anvil Pedestal Block right behind the working plane for rich 3D silhouette
    const anvilBody = Scene.createSolid3DLayer(mainComp, '铁砧底座实体', 'anvil');
    anvilBody.solidData.sizeX.value = 620;
    anvilBody.solidData.sizeY.value = 480;
    anvilBody.solidData.sizeZ.value = 85;
    anvilBody.transform.position.value = [W * 0.5, H * 0.5 + 10, 4];
    anvilBody.castShadows = true;
    anvilBody.receiveShadows = true;
    anvilBody.material.baseColor.value = [0.16, 0.17, 0.21];
    anvilBody.material.metallic.value = 0.84;
    anvilBody.material.roughness.value = 0.38;

    // 10. Forged Sparks Particle System:「锻造迸射火星」(Emits from deformed character surface, collides with Anvil & Character, leaves 3D trails!)
    const sparkLayer = Scene.createParticleLayer(mainComp, '锻造迸射火星');
    sparkLayer.blendMode = 'add';
    sparkLayer.motionBlur = true;
    nOutEmitter.params.targetLayerId = sparkLayer.id;
    nOutCollider.params.targetLayerId = sparkLayer.id;

    const emMain = sparkLayer.particleData.emitters[0];
    emMain.name = '受击表面迸射源';
    emMain.sourceType = 'surface';
    emMain.sourceLayerId = forgedBlockLayer.id;
    emMain.focusByField = true; // Concentrates spark eruption right at the deformed hammer contact region!
    emMain.initialSpeed.value = 430;
    emMain.speedVariance = 0.42;
    emMain.spread.value = 68;
    emMain.lifetime.value = 1.35;
    emMain.size.value = 5.2;

    // Emission rate bursts precisely on the 3 hammer strikes + subtle embers during heating, 0 by cooling end!
    addKF(emMain.rate, 0.0, 0, 'linear');
    addKF(emMain.rate, 3.8, 0, 'linear');
    addKF(emMain.rate, 5.6, 18, 'ease');    // Gentle rising embers during heating
    addKF(emMain.rate, 7.31, 14, 'linear');
    addKF(emMain.rate, 7.36, 980, 'linear'); // Strike 1 spark burst!
    addKF(emMain.rate, 7.50, 28, 'ease');
    addKF(emMain.rate, 8.81, 18, 'linear');
    addKF(emMain.rate, 8.86, 1450, 'linear'); // Strike 2 larger spark burst!
    addKF(emMain.rate, 9.02, 35, 'ease');
    addKF(emMain.rate, 10.31, 22, 'linear');
    addKF(emMain.rate, 10.36, 2100, 'linear'); // Strike 3 massive climax spark shower!
    addKF(emMain.rate, 10.55, 45, 'ease');
    addKF(emMain.rate, 12.2, 0, 'ease');      // Sparks extinguish completely during cooling!
    addKF(emMain.rate, 15.0, 0, 'linear');

    sparkLayer.particleData.gravity.value = [0, 560, 95]; // Falls downward (+Y) and toward anvil (+Z) to bounce & skitter!
    sparkLayer.particleData.colliderLayerIds = [anvilLayer.id];
    sparkLayer.particleData.bounce.value = 0.54;
    sparkLayer.particleData.friction.value = 0.18;
    sparkLayer.particleData.secondaryOnHitCount = 2;
    sparkLayer.particleData.trailSteps = 9;
    sparkLayer.particleData.trailWidth = 0.65;

    // Wire up the Procedural Node Graph edges!
    mainComp.nodeGraph = {
      nodes: [nCharIn, nExtrude, nFieldIn, nDeform, nOutDisplay, nOutEmitter, nOutCollider],
      edges: [
        { id: uid('ed'), fromNode: nCharIn.id, fromPort: 'geo', toNode: nExtrude.id, toPort: 'geo' },
        { id: uid('ed'), fromNode: nExtrude.id, fromPort: 'mesh', toNode: nDeform.id, toPort: 'geo' },
        { id: uid('ed'), fromNode: nFieldIn.id, fromPort: 'field', toNode: nDeform.id, toPort: 'field' },
        // Branching ONE deformed geometry output to Display + Emitter + Collider simultaneously!
        { id: uid('ed'), fromNode: nDeform.id, fromPort: 'geo', toNode: nOutDisplay.id, toPort: 'geo' },
        { id: uid('ed'), fromNode: nDeform.id, fromPort: 'geo', toNode: nOutEmitter.id, toPort: 'geo' },
        { id: uid('ed'), fromNode: nDeform.id, fromPort: 'geo', toNode: nOutCollider.id, toPort: 'geo' }
      ]
    };

    // 11. Pre-comp Forge Sigil Layer resting on the anvil surface (`z = 0.5`):
    const sigilPreLayer = Scene.createBaseLayer('precomp', '炉台火纹 (预合成)', mainComp);
    sigilPreLayer.compId = sigilComp.id;
    sigilPreLayer.threeD = false; // Subtle atmospheric HUD/backdrop ring behind 3D or blend screen!
    sigilPreLayer.blendMode = 'screen';
    sigilPreLayer.transform.anchorPoint.value = [W * 0.5, H * 0.5, 0];
    sigilPreLayer.transform.position.value = [W * 0.5, H * 0.5, 0];
    addKF(sigilPreLayer.transform.opacity, 0.0, 52, 'ease');
    addKF(sigilPreLayer.transform.opacity, 3.6, 38, 'ease');
    addKF(sigilPreLayer.transform.opacity, 10.4, 48, 'ease');
    addKF(sigilPreLayer.transform.opacity, 13.8, 18, 'ease');
    addKF(sigilPreLayer.transform.opacity, 15.0, 18, 'linear');
    sigilPreLayer.timeRemapEnabled = true;
    sigilPreLayer.timeRemap = Anim.createProp(0, 'scalar', { min: 0, max: 15, label: '时间重映射 (秒)' });
    addKF(sigilPreLayer.timeRemap, 0.0, 0.0, 'linear');
    addKF(sigilPreLayer.timeRemap, 14.0, 14.0, 'ease');
    addKF(sigilPreLayer.timeRemap, 15.0, 14.0, 'linear'); // Settles to freeze in final second!

    // 12. Top Adjustment Layer:「全局辉光与调色调整层」(Demonstrates Adjustment Layer + Glow + Mask!)
    const adjLayer = Scene.createAdjustmentLayer(mainComp, '全局辉光调整层');
    const adjGlow = Scene.createEffectInstance('glow');
    adjGlow.params.threshold.value = 0.58;
    adjGlow.params.radius.value = 28;
    addKF(adjGlow.params.intensity, 0.0, 0.65, 'ease');
    addKF(adjGlow.params.intensity, 6.2, 0.92, 'ease');
    addKF(adjGlow.params.intensity, 10.37, 1.25, 'ease');
    addKF(adjGlow.params.intensity, 13.8, 0.42, 'ease');
    addKF(adjGlow.params.intensity, 15.0, 0.42, 'linear');
    adjGlow.params.color.value = [1.0, 0.68, 0.34];
    adjLayer.effects.push(adjGlow);

    // 13. Built-in Sound & Score Layers (Section 2.15 & 3.2 — Accents land squarely on hammer strikes!):
    // 13a. Forge Atmospheric Score Pad
    const audioDrone = Scene.createAudioLayer(mainComp, '[配乐] 熔炉低鸣弦垫', 'forge_drone');
    audioDrone.audioData.volume.value = 62;
    audioDrone.audioData.events = [
      { id: uid('aev'), time: 0.02, duration: 3.6, pitch: -5, velocity: 0.65 },
      { id: uid('aev'), time: 3.60, duration: 3.0, pitch: -2, velocity: 0.82 },
      { id: uid('aev'), time: 6.55, duration: 4.8, pitch: 0, velocity: 0.95 },
      { id: uid('aev'), time: 11.40, duration: 2.8, pitch: -5, velocity: 0.58 }
    ];

    // 13b. Calligraphy Stroke Plucks (Stage 1: 0.05s - 3.3s)
    const audioWrite = Scene.createAudioLayer(mainComp, '[音效] 笔锋金石书写', 'brush_pluck');
    audioWrite.audioData.volume.value = 72;
    audioWrite.audioData.events = [
      { id: uid('aev'), time: 0.05, duration: 0.45, pitch: 0, velocity: 0.72 },
      { id: uid('aev'), time: 0.55, duration: 0.40, pitch: 2, velocity: 0.68 },
      { id: uid('aev'), time: 1.05, duration: 0.45, pitch: 4, velocity: 0.75 },
      { id: uid('aev'), time: 1.60, duration: 0.45, pitch: 7, velocity: 0.78 },
      { id: uid('aev'), time: 2.15, duration: 0.45, pitch: 9, velocity: 0.82 },
      { id: uid('aev'), time: 2.75, duration: 0.65, pitch: 12, velocity: 0.90 }
    ];

    // 13c. Heavy Anvil Hammer Strikes (Exact frame sync with 7.36s, 8.86s, 10.36s!)
    const audioHammer = Scene.createAudioLayer(mainComp, '[重音] 铁砧重锤锻击', 'anvil_strike');
    audioHammer.audioData.volume.value = 95;
    audioHammer.audioData.decay.value = 1.35;
    audioHammer.audioData.events = [
      { id: uid('aev'), time: 7.36, duration: 1.15, pitch: 0, velocity: 0.88 },
      { id: uid('aev'), time: 8.86, duration: 1.25, pitch: -2, velocity: 0.96 },
      { id: uid('aev'), time: 10.36, duration: 1.85, pitch: -4, velocity: 1.15 }
    ];

    // 13d. Sparks Crackle & Quench Steam Hiss
    const audioSparks = Scene.createAudioLayer(mainComp, '[音效] 火星爆裂与淬火', 'quench_sizzle');
    audioSparks.audioData.volume.value = 74;
    audioSparks.audioData.events = [
      { id: uid('aev'), time: 4.10, duration: 1.8, pitch: -3, velocity: 0.45 },
      { id: uid('aev'), time: 7.37, duration: 0.75, pitch: 4, velocity: 0.82 },
      { id: uid('aev'), time: 8.87, duration: 0.85, pitch: 5, velocity: 0.90 },
      { id: uid('aev'), time: 10.37, duration: 1.15, pitch: 6, velocity: 1.00 },
      { id: uid('aev'), time: 11.55, duration: 2.10, pitch: -4, velocity: 0.68 }
    ];

    // Assemble layer stack from TOP (index 0) to BOTTOM:
    mainComp.layers = [
      adjLayer,
      camLayer,
      camRig,
      shakeCtrl,
      keyLight,
      hearthLight,
      sparkLayer,
      hammerLayer,
      masterText,
      forgedBlockLayer,
      dentFieldLayer,
      vortexFieldLayer,
      anvilLayer,
      anvilBody,
      sigilPreLayer,
      audioHammer,
      audioSparks,
      audioWrite,
      audioDrone
    ];

    return {
      version: '1.0',
      name: '锻字 · 15秒动效工程',
      activeCompId: mainComp.id,
      compositions: [mainComp, sigilComp]
    };
  }

  Forge.Demo = {
    addKF,
    createEmptyProject,
    createForgeDemoProject
  };
})();
