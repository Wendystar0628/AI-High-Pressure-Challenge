// 15 秒默认示例工程「锻字」：完全由本编辑器真实图层、节点、关键帧、表达式、场、三维实体、粒子碰撞与音色构造

import { makeProp, addOrUpdateKeyframe, applyEasyEaseToKeyframes } from '../core/property.js';
import {
  createComposition,
  createLayer,
  createEffect,
  createShapeOperator,
  createSpatialField,
  createParticleEmitter,
  createMask,
  defaultEllipsePath,
  genId,
} from '../core/project.js';
import { createNodeGraph, createNode } from '../nodes/nodeGraph.js';

function addEaseKf(prop, time, value, easeMode = 'both') {
  const kf = addOrUpdateKeyframe(prop, time, value);
  if (easeMode !== 'none') {
    applyEasyEaseToKeyframes(prop, [kf.id], easeMode);
  }
  return kf;
}

export function createForgeDemoProject() {
  const W = 1280;
  const H = 720;
  const FPS = 30;
  const DUR = 15;
  const CX = W * 0.5;   // 640
  const CY = H * 0.49;  // 352.8

  // ---- 1. 预合成：炉火背景与浮动微尘氛围 ----
  const bgComp = createComposition({
    id: 'comp_forge_bg',
    name: '炉火背景预合成',
    width: W,
    height: H,
    fps: FPS,
    duration: DUR,
    backgroundColor: [0.025, 0.028, 0.036, 1],
    transparentBg: false,
    motionBlur: false,
  });

  // 预合成底层暗红炉火光晕形状
  const hearthGlow = createLayer('shape', bgComp, {
    id: 'lyr_bg_hearth',
    name: '炉火底光晕',
    shapeSource: 'ellipse',
    ellipseSize: [920, 620],
    position: [CX, CY + 65, 0],
    fillEnabled: true,
    fillColor: [0.68, 0.22, 0.06, 0.72],
    strokeEnabled: false,
  });
  const bgBlur = createEffect('gaussianBlur');
  bgBlur.params.radius.value = 95;
  hearthGlow.effects.push(bgBlur);
  // 用表达式让炉火明暗随时间微微呼吸脉动
  hearthGlow.transform.opacity.animated = true;
  hearthGlow.transform.opacity.value = 55;
  hearthGlow.transform.opacity.expressionEnabled = true;
  hearthGlow.transform.opacity.expression =
    'ease(time, 5.5, 9.3, 42, 85) * (1 - ease(time, 10.5, 13.8, 0, 0.68)) + wiggle(2.2, 6)';

  // 预合成上方冷蓝钢青顶光晕（与底部暖色炉火形成冷暖对比）
  const coolBack = createLayer('shape', bgComp, {
    id: 'lyr_bg_cool',
    name: '冷钢顶光晕',
    shapeSource: 'ellipse',
    ellipseSize: [1080, 420],
    position: [CX, 140, 0],
    fillEnabled: true,
    fillColor: [0.14, 0.26, 0.44, 0.42],
    strokeEnabled: false,
    blendMode: 'screen',
  });
  const bgCoolBlur = createEffect('gaussianBlur');
  bgCoolBlur.params.radius.value = 85;
  coolBack.effects.push(bgCoolBlur);

  // 预合成重复器氛围微粒环（展示重复器+旋转动画）
  const emberRing = createLayer('shape', bgComp, {
    id: 'lyr_bg_dust',
    name: '锻室余烬光斑',
    shapeSource: 'ellipse',
    ellipseSize: [14, 14],
    position: [CX, CY, 0],
    fillEnabled: true,
    fillColor: [1, 0.56, 0.18, 0.45],
    strokeEnabled: false,
    blendMode: 'add',
  });
  const repOp = createShapeOperator('repeater');
  repOp.params.copies.value = 10;
  repOp.params.position.value = [68, -22];
  repOp.params.rotation.value = 36;
  repOp.params.scale.value = [94, 94];
  repOp.params.endOpacity.value = 25;
  emberRing.operators = undefined;
  emberRing.shape.operators.push(repOp);
  const dustBlur = createEffect('gaussianBlur');
  dustBlur.params.radius.value = 10;
  emberRing.effects.push(dustBlur);
  emberRing.transform.rotation.animated = true;
  addOrUpdateKeyframe(emberRing.transform.rotation, 0, 0);
  addOrUpdateKeyframe(emberRing.transform.rotation, 15, 55);
  emberRing.transform.opacity.animated = true;
  addEaseKf(emberRing.transform.opacity, 0, 35);
  addEaseKf(emberRing.transform.opacity, 9.2, 65);
  addEaseKf(emberRing.transform.opacity, 13.6, 15);

  bgComp.layers = [emberRing, coolBack, hearthGlow];

  // ---- 2. 主合成：「锻字」15 秒作品 ----
  const mainComp = createComposition({
    id: 'comp_main',
    name: '主合成：锻字',
    width: W,
    height: H,
    fps: FPS,
    duration: DUR,
    currentTime: 0,
    workAreaStart: 0,
    workAreaEnd: DUR,
    backgroundColor: [0.025, 0.028, 0.036, 1],
    transparentBg: false,
    motionBlur: true,
    shutterAngle: 180,
    shutterPhase: -90,
  });

  // (A) 源文字定义层（修改此层文字内容即可重新生成整条笔画/实体/变形/火花管线）
  const glyphSrcLayer = createLayer('text', mainComp, {
    id: 'lyr_glyph_source',
    name: '字形源',
    text: '锻',
    fontId: 'noto-serif-sc',
    fontSize: 330,
    align: 'center',
    visible: false, // 仅作为程序节点源输入，避免重复渲染平面字
    position: [CX, CY, 0],
  });

  // (B) 空间场控制空对象：锻打冲击场（驱动金属字块局部压痕、顶点变形与火花飞溅）
  const strikeFieldLayer = createLayer('null', mainComp, {
    id: 'lyr_strike_field',
    name: '锻打冲击场',
    is3D: true,
    position: [CX + 58, CY - 34, -18],
    spatialField: createSpatialField('distanceFalloff', '锻打冲击径向场'),
  });
  strikeFieldLayer.spatialField.radius.value = 185;
  strikeFieldLayer.spatialField.falloff.value = 1.65;
  strikeFieldLayer.spatialField.strength.animated = true;
  // 随三次锤击形成渐进锻打冲击与持久微形变
  addEaseKf(strikeFieldLayer.spatialField.strength, 0, 0);
  addEaseKf(strikeFieldLayer.spatialField.strength, 6.45, 0);
  addEaseKf(strikeFieldLayer.spatialField.strength, 6.53, 18);
  addEaseKf(strikeFieldLayer.spatialField.strength, 6.85, 8);
  addEaseKf(strikeFieldLayer.spatialField.strength, 7.80, 8);
  addEaseKf(strikeFieldLayer.spatialField.strength, 7.88, 28);
  addEaseKf(strikeFieldLayer.spatialField.strength, 8.20, 15);
  addEaseKf(strikeFieldLayer.spatialField.strength, 9.18, 15);
  addEaseKf(strikeFieldLayer.spatialField.strength, 9.28, 42);
  addEaseKf(strikeFieldLayer.spatialField.strength, 9.75, 22);
  addEaseKf(strikeFieldLayer.spatialField.strength, 15.0, 22);

  // (C) 空间场控制空对象：锻室热浪旋涡场（作用于迸出的火星粒子轨迹）
  const heatVortexLayer = createLayer('null', mainComp, {
    id: 'lyr_heat_vortex',
    name: '热浪旋涡场',
    is3D: true,
    position: [CX + 20, CY - 10, -20],
    spatialField: createSpatialField('vortex', '热浪升腾旋涡场'),
  });
  heatVortexLayer.spatialField.radius.value = 460;
  heatVortexLayer.spatialField.strength.value = 18;
  heatVortexLayer.spatialField.direction.value = [0.15, -1, 0.1];
  heatVortexLayer.spatialField.frequency.value = 0.015;

  // (D) 镜头冲击震动控制器（由表达式驱动主摄像机微小震动）
  const shakeCtrlLayer = createLayer('null', mainComp, {
    id: 'lyr_shake_ctrl',
    name: '冲击震动控制',
    is3D: false,
    opacity: 0,
  });
  shakeCtrlLayer.transform.opacity.animated = true;
  addEaseKf(shakeCtrlLayer.transform.opacity, 0, 0);
  addEaseKf(shakeCtrlLayer.transform.opacity, 6.48, 0);
  addEaseKf(shakeCtrlLayer.transform.opacity, 6.52, 42);
  addEaseKf(shakeCtrlLayer.transform.opacity, 6.82, 0);
  addEaseKf(shakeCtrlLayer.transform.opacity, 7.82, 0);
  addEaseKf(shakeCtrlLayer.transform.opacity, 7.86, 68);
  addEaseKf(shakeCtrlLayer.transform.opacity, 8.20, 0);
  addEaseKf(shakeCtrlLayer.transform.opacity, 9.21, 0);
  addEaseKf(shakeCtrlLayer.transform.opacity, 9.26, 100);
  addEaseKf(shakeCtrlLayer.transform.opacity, 9.80, 0);
  addEaseKf(shakeCtrlLayer.transform.opacity, 15.0, 0);

  // ---- 3. 程序节点图：「锻字程序管线」（一源多用：同时输出笔画、挤出变形实体、粒子发射源、碰撞体） ----
  const graph = createNodeGraph('锻字程序管线');
  graph.id = 'ng_forge_pipeline';

  const nTextSrc = createNode('TextGlyphInput', 40, 140, {
    label: '字形源读取',
    layerId: glyphSrcLayer.id,
  });
  const nExtrudeDepth = createNode('LayerParamInput', 40, 320, {
    label: '读取挤出深度',
    layerId: 'lyr_forged_char',
    propPath: 'mesh3d.extrude.depth',
  });
  const nFieldSrc = createNode('FieldNode', 280, 390, {
    label: '读取锻打冲击场',
    layerId: strikeFieldLayer.id,
  });
  const nFieldStrengthParam = createNode('LayerParamInput', 40, 480, {
    label: '读取冲击强度',
    layerId: strikeFieldLayer.id,
    propPath: 'spatialField.strength',
  });
  const nDentScale = createNode('MathNode', 280, 520, {
    label: '压痕比例系数',
    op: 'mul',
    b: 0.72,
  });
  const nDentPos = createNode('VectorInput', 280, 650, {
    label: '局部锤击点',
    value: [58, -34, -18],
  });

  const nOutRawStrokes = createNode('DisplayOutput', 320, 60, { label: '输出: 原始笔画' });

  const nExtrude = createNode('ExtrudeNode', 320, 210, {
    label: '字形三维挤出',
    depth: 54,
    bevel: 5.5,
    bevelThickness: 6.5,
    bevelSegments: 3,
  });
  const nDeform = createNode('FieldDeformNode', 580, 290, {
    label: '场与锻打受力变形',
    fieldStrength: 0.85,
    dentRadius: 120,
  });

  const nOutSolid = createNode('DisplayOutput', 840, 170, { label: '输出: 锻字实体' });
  const nOutEmit = createNode('ParticleEmitterOutput', 840, 290, { label: '输出: 火星发射表面' });
  const nOutCollide = createNode('ColliderOutput', 840, 410, { label: '输出: 字块碰撞体' });

  graph.nodes = [
    nTextSrc,
    nExtrudeDepth,
    nFieldSrc,
    nFieldStrengthParam,
    nDentScale,
    nDentPos,
    nOutRawStrokes,
    nExtrude,
    nDeform,
    nOutSolid,
    nOutEmit,
    nOutCollide,
  ];
  graph.edges = [
    { id: genId('ed'), fromNodeId: nTextSrc.id, fromPort: 'geo', toNodeId: nOutRawStrokes.id, toPort: 'geo' },
    { id: genId('ed'), fromNodeId: nTextSrc.id, fromPort: 'geo', toNodeId: nExtrude.id, toPort: 'geo' },
    { id: genId('ed'), fromNodeId: nExtrudeDepth.id, fromPort: 'scalar', toNodeId: nExtrude.id, toPort: 'depth' },
    { id: genId('ed'), fromNodeId: nFieldStrengthParam.id, fromPort: 'scalar', toNodeId: nDentScale.id, toPort: 'a' },
    { id: genId('ed'), fromNodeId: nExtrude.id, fromPort: 'geo', toNodeId: nDeform.id, toPort: 'geo' },
    { id: genId('ed'), fromNodeId: nFieldSrc.id, fromPort: 'field', toNodeId: nDeform.id, toPort: 'field' },
    { id: genId('ed'), fromNodeId: nDentScale.id, fromPort: 'res', toNodeId: nDeform.id, toPort: 'dentDepth' },
    { id: genId('ed'), fromNodeId: nDentPos.id, fromPort: 'vec', toNodeId: nDeform.id, toPort: 'dentCenter' },
    { id: genId('ed'), fromNodeId: nDeform.id, fromPort: 'geo', toNodeId: nOutSolid.id, toPort: 'geo' },
    { id: genId('ed'), fromNodeId: nDeform.id, fromPort: 'geo', toNodeId: nOutEmit.id, toPort: 'geo' },
    { id: genId('ed'), fromNodeId: nDeform.id, fromPort: 'geo', toNodeId: nOutCollide.id, toPort: 'geo' },
  ];

  // ---- 4. 主合成其余核心图层 ----

  // (E) 阶段一：笔画书写图层（来自节点原始笔画 + 逐段修剪路径 + 炽热发光描边）
  const strokeWriteLayer = createLayer('shape', mainComp, {
    id: 'lyr_stroke_write',
    name: '笔画书写',
    is3D: true,
    shapeSource: 'node',
    nodeBinding: { graphId: graph.id, outputNodeId: nOutRawStrokes.id },
    position: [CX, CY, 0],
    fillEnabled: false,
    strokeEnabled: true,
    strokeColor: [1, 0.78, 0.36, 1],
    strokeWidth: 4.5,
    inPoint: 0,
    outPoint: 4.1,
  });
  strokeWriteLayer.shape.nodeUseRawStrokes = true;
  const trimOp = createShapeOperator('trim');
  trimOp.params.mode = 'individual';
  trimOp.params.start.value = 0;
  trimOp.params.end.animated = true;
  // 第0帧已有首笔起点成立，至3.35秒写完所有笔画
  addEaseKf(trimOp.params.end, 0, 8, 'out');
  addEaseKf(trimOp.params.end, 3.35, 100, 'both');
  strokeWriteLayer.shape.operators.push(trimOp);

  // 第 2.3s 起逐渐亮起字形填充并平顺交棒给三维字块
  strokeWriteLayer.shape.fill.enabled = true;
  strokeWriteLayer.shape.fill.color.value = [1, 0.54, 0.16, 1];
  strokeWriteLayer.shape.fill.opacity.animated = true;
  addEaseKf(strokeWriteLayer.shape.fill.opacity, 0, 0);
  addEaseKf(strokeWriteLayer.shape.fill.opacity, 2.2, 0);
  addEaseKf(strokeWriteLayer.shape.fill.opacity, 3.2, 85);

  strokeWriteLayer.transform.opacity.animated = true;
  addEaseKf(strokeWriteLayer.transform.opacity, 0, 100);
  addEaseKf(strokeWriteLayer.transform.opacity, 3.15, 100);
  addEaseKf(strokeWriteLayer.transform.opacity, 3.85, 0);

  const strokeGlow = createEffect('glow');
  strokeGlow.params.threshold.value = 0.25;
  strokeGlow.params.radius.value = 18;
  strokeGlow.params.intensity.value = 1.6;
  strokeGlow.params.color.value = [1, 0.58, 0.15, 1];
  strokeWriteLayer.effects.push(strokeGlow);

  // (F) 阶段二至四：锻字三维实体（连接节点管线，材质由炽白橙热退火为冷钢金属本色）
  const forgedCharLayer = createLayer('mesh3d', mainComp, {
    id: 'lyr_forged_char',
    name: '锻字三维实体',
    sourceType: 'node',
    nodeBinding: { graphId: graph.id, outputNodeId: nOutSolid.id },
    position: [CX, CY, 0],
    inPoint: 2.8,
    outPoint: DUR,
    castShadow: true,
    receiveShadow: true,
    motionBlur: true,
  });

  // 挤出厚度动画（成块阶段从薄片升起为厚实金属字块）
  forgedCharLayer.mesh3d.extrude.depth.animated = true;
  addEaseKf(forgedCharLayer.mesh3d.extrude.depth, 2.8, 2);
  addEaseKf(forgedCharLayer.mesh3d.extrude.depth, 5.1, 56);

  // 淡入交接
  forgedCharLayer.transform.opacity.animated = true;
  addEaseKf(forgedCharLayer.transform.opacity, 2.8, 0);
  addEaseKf(forgedCharLayer.transform.opacity, 3.35, 100);

  // 受击微小后挫弹性震颤
  forgedCharLayer.transform.position.animated = true;
  addEaseKf(forgedCharLayer.transform.position, 2.8, [CX, CY, 0]);
  addEaseKf(forgedCharLayer.transform.position, 6.49, [CX, CY, 0]);
  addEaseKf(forgedCharLayer.transform.position, 6.53, [CX, CY + 5, 6]);
  addEaseKf(forgedCharLayer.transform.position, 6.80, [CX, CY, 0]);
  addEaseKf(forgedCharLayer.transform.position, 7.84, [CX, CY, 0]);
  addEaseKf(forgedCharLayer.transform.position, 7.88, [CX, CY + 8, 10]);
  addEaseKf(forgedCharLayer.transform.position, 8.15, [CX, CY, 0]);
  addEaseKf(forgedCharLayer.transform.position, 9.24, [CX, CY, 0]);
  addEaseKf(forgedCharLayer.transform.position, 9.29, [CX, CY + 12, 16]);
  addEaseKf(forgedCharLayer.transform.position, 9.65, [CX, CY, 0]);
  addEaseKf(forgedCharLayer.transform.position, 15.0, [CX, CY, 0]);

  // 材质参数动画：炽热熔融 -> 锻打高光 -> 冷却金属本色
  const mat = forgedCharLayer.mesh3d.material;
  mat.baseColor.animated = true;
  addEaseKf(mat.baseColor, 2.8, [1.0, 0.62, 0.25, 1]);
  addEaseKf(mat.baseColor, 5.6, [0.96, 0.44, 0.14, 1]);
  addEaseKf(mat.baseColor, 9.4, [0.92, 0.42, 0.14, 1]);
  addEaseKf(mat.baseColor, 13.5, [0.64, 0.71, 0.80, 1]);

  mat.metalness.animated = true;
  addEaseKf(mat.metalness, 2.8, 0.35);
  addEaseKf(mat.metalness, 5.8, 0.72);
  addEaseKf(mat.metalness, 13.5, 0.94);

  mat.roughness.animated = true;
  addEaseKf(mat.roughness, 2.8, 0.48);
  addEaseKf(mat.roughness, 9.5, 0.36);
  addEaseKf(mat.roughness, 13.5, 0.21);

  mat.emissiveColor.value = [1.0, 0.28, 0.03, 1];
  mat.emissiveIntensity.animated = true;
  addEaseKf(mat.emissiveIntensity, 2.8, 2.2);
  addEaseKf(mat.emissiveIntensity, 5.5, 1.55);
  addEaseKf(mat.emissiveIntensity, 6.53, 2.15);
  addEaseKf(mat.emissiveIntensity, 7.88, 2.35);
  addEaseKf(mat.emissiveIntensity, 9.27, 2.65);
  addEaseKf(mat.emissiveIntensity, 10.6, 1.15);
  addEaseKf(mat.emissiveIntensity, 13.4, 0.02);
  addEaseKf(mat.emissiveIntensity, 15.0, 0.02);
  // 炽热阶段加入轻微余烬闪烁表达式，冷却后自然归零
  mat.emissiveIntensity.expressionEnabled = true;
  mat.emissiveIntensity.expression =
    'Math.max(0, value + wiggle(6.5, 0.24) * linear(time, 10.2, 13.3, 1, 0))';

  // (G) 铁砧台座（真实三维实体，接收字块投影与粒子反弹碰撞）
  const anvilLayer = createLayer('mesh3d', mainComp, {
    id: 'lyr_anvil',
    name: '铁砧底座',
    sourceType: 'primitive',
    primitive: 'anvil',
    primitiveSize: [680, 195, 360],
    position: [CX, CY + 112, 12],
    baseColor: [0.16, 0.18, 0.22, 1],
    metalness: 0.85,
    roughness: 0.42,
    emissiveColor: [0.6, 0.2, 0.04, 1],
    emissiveIntensity: 0.0,
    castShadow: false,
    receiveShadow: true,
    inPoint: 0,
    outPoint: DUR,
  });
  // 铁砧反照亮度通过表达式联动字块的炽热发光强度
  anvilLayer.mesh3d.material.emissiveIntensity.expressionEnabled = true;
  anvilLayer.mesh3d.material.emissiveIntensity.expression =
    'clamp(thisComp.layer("锻字三维实体").material.emissiveIntensity * 0.045, 0, 0.25)';

  // (H) 三维锻锤（预备蓄势 -> 加速下砸 -> 回弹收势，带运动模糊）
  const hammerLayer = createLayer('mesh3d', mainComp, {
    id: 'lyr_hammer',
    name: '锻锤',
    sourceType: 'primitive',
    primitive: 'hammer',
    primitiveSize: [108, 70, 82],
    anchorPoint: [0, -230, 0],
    position: [CX + 82, CY - 268, -44],
    rotationY: -22,
    rotationX: 12,
    baseColor: [0.30, 0.34, 0.40, 1],
    metalness: 0.9,
    roughness: 0.24,
    castShadow: true,
    receiveShadow: true,
    motionBlur: true,
    inPoint: 5.0,
    outPoint: 11.2,
  });
  // 锤柄蓄势入场、三次锻打（预备-加速-撞击-回弹）与退场收势
  hammerLayer.transform.opacity.animated = true;
  addEaseKf(hammerLayer.transform.opacity, 5.0, 0);
  addEaseKf(hammerLayer.transform.opacity, 5.5, 100);
  addEaseKf(hammerLayer.transform.opacity, 10.3, 100);
  addEaseKf(hammerLayer.transform.opacity, 11.0, 0);

  hammerLayer.transform.rotationZ.animated = true;
  // 蓄势入场（抬高蓄势）
  addEaseKf(hammerLayer.transform.rotationZ, 5.0, -92);
  addEaseKf(hammerLayer.transform.rotationZ, 6.28, -58); // 预备顶峰停顿蓄力
  // 第1锤加速下砸（6.50s 命中）
  const kH1Hit = addOrUpdateKeyframe(hammerLayer.transform.rotationZ, 6.50, 7);
  kH1Hit.inInterp = 'bezier';
  kH1Hit.inEase = { influence: 15, speed: 620 }; // 高速砸击入点
  kH1Hit.outInterp = 'bezier';
  kH1Hit.outEase = { influence: 30, speed: -240 }; // 回弹收势
  addEaseKf(hammerLayer.transform.rotationZ, 7.10, -48);
  // 第2锤蓄势（7.62s 顶峰）-> 7.85s 命中
  addEaseKf(hammerLayer.transform.rotationZ, 7.62, -68);
  const kH2Hit = addOrUpdateKeyframe(hammerLayer.transform.rotationZ, 7.85, 9);
  kH2Hit.inInterp = 'bezier';
  kH2Hit.inEase = { influence: 14, speed: 740 };
  kH2Hit.outInterp = 'bezier';
  kH2Hit.outEase = { influence: 32, speed: -280 };
  addEaseKf(hammerLayer.transform.rotationZ, 8.45, -52);
  // 第3锤全片高潮重击蓄势（9.00s 最高点）-> 9.25s 猛击
  addEaseKf(hammerLayer.transform.rotationZ, 9.00, -82);
  const kH3Hit = addOrUpdateKeyframe(hammerLayer.transform.rotationZ, 9.25, 12);
  kH3Hit.inInterp = 'bezier';
  kH3Hit.inEase = { influence: 12, speed: 920 };
  kH3Hit.outInterp = 'bezier';
  kH3Hit.outEase = { influence: 35, speed: -320 };
  // 收势退出画面
  addEaseKf(hammerLayer.transform.rotationZ, 10.1, -56);
  addEaseKf(hammerLayer.transform.rotationZ, 11.0, -98);

  // (I) 粒子系统：锻打火星（从变形后字块几何表面及击打点迸出，受重力+旋涡场，与铁砧及字块碰撞反弹并产生次级火星与拖尾）
  const sparkLayer = createLayer('particle', mainComp, {
    id: 'lyr_sparks',
    name: '火星发射器',
    seed: 202611,
    gravity: [0, 560, 0],
    fieldLayerIds: [heatVortexLayer.id, strikeFieldLayer.id],
    trailEnabled: true,
    trailLength: 0.18,
    trailWidth: 3.8,
    trailColor: [1, 0.58, 0.14, 1],
    motionBlur: true,
    inPoint: 5.8,
    outPoint: 14.0,
  });

  // 发射器 1：直接绑定节点管线中已变形的「锻字三维实体」几何表面
  const emSurface = createParticleEmitter('字块变形表面火星');
  emSurface.sourceType = 'geometry';
  emSurface.nodeBinding = { graphId: graph.id, outputNodeId: nOutEmit.id };
  emSurface.speed.value = 165;
  emSurface.spread.value = 72;
  emSurface.life.value = 1.35;
  emSurface.sizeStart.value = 8.5;
  emSurface.sizeEnd.value = 1.2;
  emSurface.rate.animated = true;
  addEaseKf(emSurface.rate, 5.8, 0);
  addEaseKf(emSurface.rate, 6.5, 30);
  addEaseKf(emSurface.rate, 9.3, 52);
  addEaseKf(emSurface.rate, 10.6, 0);

  const setBurstStep = (prop, t, val) => {
    const k = addOrUpdateKeyframe(prop, t, val);
    if (val === 0) k.outInterp = 'hold';
    return k;
  };

  emSurface.burst.animated = true;
  setBurstStep(emSurface.burst, 5.8, 0);
  setBurstStep(emSurface.burst, 6.50, 95);
  setBurstStep(emSurface.burst, 6.58, 0);
  setBurstStep(emSurface.burst, 7.85, 130);
  setBurstStep(emSurface.burst, 7.93, 0);
  setBurstStep(emSurface.burst, 9.25, 220);
  setBurstStep(emSurface.burst, 9.33, 0);

  // 发射器 2：精准锁定锤击形变处的爆裂高速火星束
  const emStrike = createParticleEmitter('锤击点迸发火花');
  emStrike.sourceType = 'point';
  emStrike.position.value = [58, -36, -42];
  emStrike.speed.value = 470;
  emStrike.spread.value = 115;
  emStrike.life.value = 1.65;
  emStrike.sizeStart.value = 11.5;
  emStrike.sizeEnd.value = 1.5;
  emStrike.rate.value = 0;
  emStrike.burst.animated = true;
  setBurstStep(emStrike.burst, 5.8, 0);
  setBurstStep(emStrike.burst, 6.50, 105);
  setBurstStep(emStrike.burst, 6.58, 0);
  setBurstStep(emStrike.burst, 7.85, 155);
  setBurstStep(emStrike.burst, 7.93, 0);
  setBurstStep(emStrike.burst, 9.25, 260);
  setBurstStep(emStrike.burst, 9.33, 0);

  sparkLayer.transform.position.value = [CX, CY, 0];
  sparkLayer.particle.emitters = [emSurface, emStrike];
  sparkLayer.particle.physics.drag.value = 0.38;
  sparkLayer.particle.colliders = [
    {
      id: 'col_anvil',
      layerId: anvilLayer.id,
      nodeBinding: null,
      enabled: true,
      restitution: 0.56,
      friction: 0.24,
      hitColor: [1, 0.98, 0.85, 1],
      hitLifeDelta: -0.15,
      secondaryEmitCount: 2,
      secondarySpeed: 155,
    },
    {
      id: 'col_char',
      layerId: forgedCharLayer.id,
      nodeBinding: { graphId: graph.id, outputNodeId: nOutCollide.id },
      enabled: true,
      restitution: 0.48,
      friction: 0.3,
      hitColor: [1, 0.86, 0.42, 1],
      hitLifeDelta: 0,
      secondaryEmitCount: 0,
      secondarySpeed: 80,
    },
  ];

  // (J) 灯光系统：暖色主炉火点光源（随锻打爆发增亮） + 冷色定向轮廓光（真实投影）
  const keyForgeLight = createLayer('light', mainComp, {
    id: 'lyr_light_forge',
    name: '主炉点光源',
    lightType: 'point',
    position: [CX - 280, CY - 140, -440],
    color: [1, 0.62, 0.26, 1],
    intensity: 2.6,
    castShadow: false,
  });
  keyForgeLight.light.intensity.animated = true;
  addEaseKf(keyForgeLight.light.intensity, 0, 2.2);
  addEaseKf(keyForgeLight.light.intensity, 5.5, 2.6);
  addEaseKf(keyForgeLight.light.intensity, 6.53, 4.0);
  addEaseKf(keyForgeLight.light.intensity, 7.88, 4.4);
  addEaseKf(keyForgeLight.light.intensity, 9.27, 5.4);
  addEaseKf(keyForgeLight.light.intensity, 10.8, 2.3);
  addEaseKf(keyForgeLight.light.intensity, 13.5, 1.5);

  const rimCoolLight = createLayer('light', mainComp, {
    id: 'lyr_light_rim',
    name: '冷色轮廓投影灯',
    lightType: 'directional',
    position: [CX + 380, CY - 420, -460],
    target: [CX, CY + 40, 0],
    color: [0.68, 0.85, 1.0, 1],
    intensity: 2.0,
    castShadow: true,
  });
  rimCoolLight.light.intensity.animated = true;
  addEaseKf(rimCoolLight.light.intensity, 0, 1.6);
  addEaseKf(rimCoolLight.light.intensity, 9.5, 1.9);
  addEaseKf(rimCoolLight.light.intensity, 13.5, 3.0);

  // (K) 主摄像机：景别、角度与焦点跟随字的状态变化，开头成立、结尾稳停
  const mainCam = createLayer('camera', mainComp, {
    id: 'lyr_camera',
    name: '主摄像机',
    position: [CX + 12, CY - 140, -680],
    target: [CX, CY, 0],
    fov: 40,
    focusDistance: 695,
    aperture: 13,
    dofEnabled: true,
    motionBlur: true,
  });
  mainCam.transform.position.animated = true;
  addEaseKf(mainCam.transform.position, 0.0, [CX + 18, CY - 140, -685]);
  addEaseKf(mainCam.transform.position, 3.2, [CX + 65, CY - 90, -660]);
  addEaseKf(mainCam.transform.position, 5.8, [CX - 225, CY - 65, -620]); // 成块推进斜侧透视凸显厚度
  addEaseKf(mainCam.transform.position, 9.3, [CX - 185, CY - 38, -595]); // 锻打高潮紧盯受击区
  addEaseKf(mainCam.transform.position, 13.6, [CX - 95, CY - 42, -730]); // 冷却拉开沉稳端正收尾
  addEaseKf(mainCam.transform.position, 15.0, [CX - 95, CY - 42, -730]); // 末段完全停稳
  // 表达式叠加：锤击瞬间叠加微幅冲击震动，其余时刻振幅为 0
  mainCam.transform.position.expressionEnabled = true;
  mainCam.transform.position.expression =
    'wiggle(28, thisComp.layer("冲击震动控制").transform.opacity * 0.14)';

  mainCam.camera.focusDistance.animated = true;
  addEaseKf(mainCam.camera.focusDistance, 0.0, 695);
  addEaseKf(mainCam.camera.focusDistance, 5.8, 655);
  addEaseKf(mainCam.camera.focusDistance, 9.3, 615);
  addEaseKf(mainCam.camera.focusDistance, 13.6, 740);
  addEaseKf(mainCam.camera.focusDistance, 15.0, 740);

  mainCam.camera.aperture.animated = true;
  addEaseKf(mainCam.camera.aperture, 0.0, 12);
  addEaseKf(mainCam.camera.aperture, 9.3, 18);
  addEaseKf(mainCam.camera.aperture, 13.6, 7); // 冷却定型期景深加深，全字锐利清晰

  // (L) 预合成背景图层
  const bgPrecompLayer = createLayer('precomp', mainComp, {
    id: 'lyr_bg_precomp',
    name: '炉火背景预合成',
    compId: bgComp.id,
    position: [0, 0, 0],
    inPoint: 0,
    outPoint: DUR,
  });

  // (M) 调整图层（带有椭圆软边蒙版与发光+饱和度，强化高潮期炽热氛围）
  const adjLayer = createLayer('adjustment', mainComp, {
    id: 'lyr_adj_climax',
    name: '高潮辉光调色层',
    position: [CX, CY, 0],
    opacity: 45,
    inPoint: 0,
    outPoint: DUR,
  });
  const adjMask = createMask('ellipse', 960, 560);
  adjMask.feather.value = 140;
  adjLayer.masks.push(adjMask);
  const adjGlow = createEffect('glow');
  adjGlow.params.threshold.value = 0.56;
  adjGlow.params.radius.value = 26;
  adjGlow.params.intensity.animated = true;
  addEaseKf(adjGlow.params.intensity, 0.0, 0.65);
  addEaseKf(adjGlow.params.intensity, 6.5, 1.15);
  addEaseKf(adjGlow.params.intensity, 9.3, 1.45);
  addEaseKf(adjGlow.params.intensity, 13.5, 0.50);
  adjLayer.effects.push(adjGlow);
  adjLayer.transform.opacity.animated = true;
  addEaseKf(adjLayer.transform.opacity, 0.0, 48);
  addEaseKf(adjLayer.transform.opacity, 9.3, 88);
  addEaseKf(adjLayer.transform.opacity, 13.6, 36);

  // (N) 音色图层：铁砧重击音效（精确落在三次锤击瞬间）与熔炉低鸣配乐
  const anvilAudio = createLayer('audio', mainComp, {
    id: 'lyr_audio_anvil',
    name: '音色：铁砧锻打',
    preset: 'anvilStrike',
    waveform: 'triangle',
    gain: 0.88,
    pitch: 245,
    cutoff: 3200,
  });
  anvilAudio.audio.trigger.animated = true;
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 0.0, 0);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 6.48, 0);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 6.50, 1);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 6.58, 0);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 7.83, 0);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 7.85, 1);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 7.93, 0);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 9.23, 0);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 9.25, 1);
  addOrUpdateKeyframe(anvilAudio.audio.trigger, 9.35, 0);
  anvilAudio.audio.pitch.animated = true;
  addOrUpdateKeyframe(anvilAudio.audio.pitch, 6.5, 250);
  addOrUpdateKeyframe(anvilAudio.audio.pitch, 7.85, 228);
  addOrUpdateKeyframe(anvilAudio.audio.pitch, 9.25, 195); // 高潮重锤低沉厚重

  const droneAudio = createLayer('audio', mainComp, {
    id: 'lyr_audio_drone',
    name: '音色：熔炉底鸣配乐',
    preset: 'forgeDrone',
    waveform: 'sawtooth',
    droneEnabled: true,
    gain: 0.45,
    pitch: 65,
    cutoff: 320,
    inPoint: 0,
    outPoint: 14.8,
  });
  droneAudio.audio.gain.animated = true;
  addEaseKf(droneAudio.audio.gain, 0.0, 0.25);
  addEaseKf(droneAudio.audio.gain, 5.6, 0.42);
  addEaseKf(droneAudio.audio.gain, 9.25, 0.65);
  addEaseKf(droneAudio.audio.gain, 13.5, 0.16);
  addEaseKf(droneAudio.audio.gain, 14.8, 0.0);
  droneAudio.audio.cutoff.animated = true;
  addEaseKf(droneAudio.audio.cutoff, 0.0, 260);
  addEaseKf(droneAudio.audio.cutoff, 9.25, 760);
  addEaseKf(droneAudio.audio.cutoff, 13.8, 190);

  // 层级排序：顶层在前，底层在后（时间轴自上而下）
  mainComp.layers = [
    mainCam,
    keyForgeLight,
    rimCoolLight,
    adjLayer,
    sparkLayer,
    hammerLayer,
    forgedCharLayer,
    strokeWriteLayer,
    anvilLayer,
    strikeFieldLayer,
    heatVortexLayer,
    shakeCtrlLayer,
    glyphSrcLayer,
    bgPrecompLayer,
    anvilAudio,
    droneAudio,
  ];

  return {
    version: 1,
    name: '默认示例工程：锻字',
    activeCompId: mainComp.id,
    compositions: [mainComp, bgComp],
    nodeGraphs: [graph],
    selectedLayerIds: [forgedCharLayer.id],
    selectedKeyframes: [],
    revision: 1,
  };
}
