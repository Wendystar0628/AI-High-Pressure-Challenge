/* PRISM demo project — 星核 NOVA CORE (15s) */
(function () {
  const AE = window.AE, U = AE.U, G = AE.G, T = AE.Text, P = AE.P, M = AE.M;
  const D = (AE.Demo = {});
  const C = (hex, a = 1) => P.hex(hex, a);
  const IVORY = C('#f2f1e8'), MINT = C('#7fe7d4'), GOLD = C('#e8b66a'), TEAL = C('#38c7b2');
  const DARK = C('#05080c');

  function comp(project, opts) { const c = P.newComp(opts); project.comps.push(c); return c; }
  function layer(comp, type, opts) { const l = P.createLayer(D.project, comp, type, opts); comp.layers.push(l); return l; }
  function set(l, key, v) { if (!l.props[key]) l.props[key] = P.prop(v); else l.props[key].value = v; return l; }
  function prop(l, key) { return l.props[key]; }
  function key(t, v, opts = {}) { return P.key(t, v, opts); }
  function anim(l, key, keys, opts = {}) {
    let p = l.props[key];
    if (!p) p = l.props[key] = P.prop(keys[0] ? keys[0].v : 0);
    p.keys = keys.map(k => (k && k.t != null ? k : P.key(0, k)));
    P.sortKeys(p); p.animated = true;
    if (opts.spatial != null) p.spatial = opts.spatial;
    if (opts.expr != null) p.expr = opts.expr;
    return p;
  }
  function expr(l, key, code) { const p = l.props[key]; if (p) p.expr = code; return l; }
  function colorKeys(l, keyName, entries) { anim(l, keyName, entries.map(e => P.key(e[0], U.hexToRgb(e[1]).concat([1]), e[2] || {}))); }

  D.build = function () {
    const project = P.newProject({ name: '星核 · NOVA CORE', seed: 90210, isDemo: true });
    project._rev = 1;
    D.project = project;
    const main = comp(project, { name: '主合成', width: 1920, height: 1080, fps: 60, duration: 15, bg: [.012, .017, .026, 1], isDemo: true });
    main.workStart = 0; main.workEnd = 15;
    main.motionBlur = { enabled: true, shutterAngle: 180, samples: 2, phase: 0 };
    main.markers = [
      { t: 0, label: '开场 / INTRO', color: '#7fe7d4' },
      { t: 2.4, label: '展开 / REVEAL', color: '#7fe7d4' },
      { t: 5.4, label: '能量 / FLUX', color: '#ffb454' },
      { t: 8.8, label: '汇聚 / CONVERGE', color: '#e8b66a' },
      { t: 11.6, label: '收束 / FINALE', color: '#ff7a66' },
      { t: 14.35, label: '停稳', color: '#7fe7d4' }
    ];

    // ============ title comp ============
    const title = comp(project, { name: '标题排版', width: 1600, height: 500, fps: 60, duration: 7, bg: [0, 0, 0, 0] });
    title.params = [];
    const tMain = layer(title, 'text', { name: '主标题', text: '星核', font: T.CN_FONT, weight: 800, fontSize: 236, fillColor: IVORY, tracking: 26, position: [800, 200, 0] });
    set(tMain, 'text.tracking', 22);
    anim(tMain, 'transform.scale', [key(0, [92, 92, 100], { out: 'ease' }), key(1.1, [101, 101, 100], { outH: [.3, 1.25], inH: [.7, 1] }), key(1.5, [100, 100, 100])]);
    const an1 = P.addTextAnimator(tMain);
    an1.selector = 'characters';
    anim(tMain, `anim.${an1.id}.end`, [key(.15, 0, { out: 'ease' }), key(1.35, 100)]);
    set(tMain, `anim.${an1.id}.start`, 0); set(tMain, `anim.${an1.id}.softness`, 22);
    set(tMain, `anim.${an1.id}.position`, [0, 120]); anim(tMain, `anim.${an1.id}.position`, [key(.15, [0, 110]), key(1.35, [0, 0])]);
    anim(tMain, `anim.${an1.id}.rotation`, [key(.15, 9), key(1.4, 0)]);
    anim(tMain, `anim.${an1.id}.opacity`, [key(.15, 0), key(.9, 100)]);
    anim(tMain, `anim.${an1.id}.scale`, [key(.15, 70), key(1.45, 100)]);
    P.addEffect(tMain, 'glow', { threshold: .52, radius: 24, intensity: .75, color: MINT });

    const tSub = layer(title, 'text', { name: '副标题', text: 'NOVA CORE', font: T.DEFAULT_FONT, weight: 600, fontSize: 52, fillColor: MINT, tracking: 20, position: [800, 362, 0], opacity: 0 });
    const an2 = P.addTextAnimator(tSub);
    an2.selector = 'words';
    anim(tSub, 'transform.opacity', [key(.5, 0), key(1.25, 100)]);
    set(tSub, `anim.${an2.id}.start`, 0); set(tSub, `anim.${an2.id}.end`, 100); set(tSub, `anim.${an2.id}.softness`, 45);
    anim(tSub, `anim.${an2.id}.position`, [key(.45, [0, 40]), key(1.6, [0, 0])]);
    anim(tSub, `anim.${an2.id}.opacity`, [key(.45, 0), key(1.3, 100)]);
    anim(tSub, 'text.tracking', [key(.5, 40), key(1.9, 18)]);

    const line = layer(title, 'shape', { name: '分隔线', shapeType: 'rect', size: [520, 2], fillColor: GOLD, position: [800, 300, 0], opacity: 0 });
    set(line, 'shape.fillColor', GOLD); set(line, 'shape.fillOpacity', 75);
    const linePath = line.contents[0];
    set(line, 'content.' + linePath.id + '.size', [520, 2]);
    anim(line, 'transform.opacity', [key(1.0, 0), key(1.6, 100)]);
    anim(line, 'transform.scale', [key(1.0, [0, 100, 100], { out: 'ease' }), key(2.2, [100, 100, 100], { outH: [.2, 1.3], inH: [.8, 1] })]);
    P.addEffect(line, 'glow', { threshold: .2, radius: 16, intensity: 2.2, color: GOLD });

    const meta = layer(title, 'text', { name: '元信息', text: 'FIELD STUDY  ·  PRISM / 001', font: T.DEFAULT_FONT, weight: 500, fontSize: 16, fillColor: C('#8e9c98'), tracking: 9, position: [800, 418, 0], opacity: 0 });
    anim(meta, 'transform.opacity', [key(1.3, 0), key(2.1, 90)]);
    anim(meta, 'text.tracking', [key(1.3, 20), key(2.6, 9)]);

    title.params = [
      { id: 'pTitle', name: '主标题', layerId: tMain.id, key: 'text.content', type: 'text', def: '星核' },
      { id: 'pSub', name: '副标题', layerId: tSub.id, key: 'text.content', type: 'text', def: 'NOVA CORE' },
      { id: 'pColor', name: '强调色', layerId: tMain.id, key: 'text.fillColor', type: 'color', def: IVORY }
    ];

    // ============ data screen comp ============
    const screen = comp(project, { name: '数据屏', width: 720, height: 400, fps: 60, duration: 6, bg: [.014, .025, .032, 1] });
    screen.params = [];
    const sBg = layer(screen, 'solid', { name: '屏幕底色', color: [.012, .025, .03, 1] });
    set(sBg, 'solid.gradientOn', true); set(sBg, 'solid.gradientStart', [.01, .035, .04, 1]); set(sBg, 'solid.gradientEnd', [.015, .012, .02, 1]);
    const grid = layer(screen, 'shape', { name: '网格', shapeType: 'rect', size: [660, 1], fillColor: MINT, position: [360, 30, 0] });
    set(grid, 'shape.fillOpacity', 12);
    const gr = grid.contents[0];
    // repeated horizontal lines via repeater
    P.contentItem(grid, 'repeater', { name: '横线阵列' }).type = 'repeater';
    // easier: create lines as separate shape items with repeater on a line
    grid.contents = grid.contents.filter(c => c.type === 'rect');
    const rep = P.contentItem(grid, 'repeater', { name: '横向网格' });
    set(grid, 'content.' + grid.id + '.x', 0);
    set(grid, 'content.' + gr.id + '.position', [0, -180, 0]);
    set(grid, 'content.' + gr.id + '.size', [660, 1]);
    set(grid, 'content.' + rep.id + '.copies', 10); set(grid, 'content.' + rep.id + '.position', [0, 40, 0]);
    set(grid, 'content.' + rep.id + '.rotation', 0); set(grid, 'content.' + rep.id + '.startOpacity', .8); set(grid, 'content.' + rep.id + '.endOpacity', .2);
    set(grid, 'shape.fillOpacity', 13);

    const frame = layer(screen, 'shape', { name: '边框', shapeType: 'rect', size: [680, 360], fillColor: [0, 0, 0, 0], position: [360, 200, 0] });
    set(frame, 'shape.fillOn', false); set(frame, 'shape.strokeOn', true); set(frame, 'shape.strokeColor', C('#2f8f84')); set(frame, 'shape.strokeWidth', 1.5); set(frame, 'shape.strokeOpacity', 75);
    const fr = frame.contents[0]; set(frame, 'content.' + fr.id + '.roundness', 6);
    const bracket1 = layer(screen, 'shape', { name: '角标', shapeType: 'rect', size: [26, 26], fillColor: [0, 0, 0, 0], position: [40, 40, 0] });
    set(bracket1, 'shape.fillOn', false); set(bracket1, 'shape.strokeOn', true); set(bracket1, 'shape.strokeColor', MINT); set(bracket1, 'shape.strokeWidth', 2);
    const sTitle = layer(screen, 'text', { name: '屏标题', text: 'NOVA CORE', font: T.DEFAULT_FONT, weight: 700, fontSize: 34, fillColor: IVORY, tracking: 8, align: 'left', position: [54, 82, 0] });
    set(sTitle, 'text.justify', 'top');
    const sSub = layer(screen, 'text', { name: '屏副标', text: 'TELEMETRY / FIELD 04', font: T.DEFAULT_FONT, weight: 500, fontSize: 13, fillColor: MINT, tracking: 4, align: 'left', position: [54, 118, 0] });
    const sState = layer(screen, 'text', { name: '状态', text: 'STABLE   ●', font: T.DEFAULT_FONT, weight: 600, fontSize: 14, fillColor: MINT, tracking: 3, align: 'right', position: [664, 86, 0] });
    const bars = layer(screen, 'shape', { name: '频谱', shapeType: 'rect', size: [10, 80], fillColor: MINT, position: [130, 262, 0] });
    set(bars, 'shape.fillOpacity', 80);
    const barRect = bars.contents[0];
    set(bars, 'content.' + barRect.id + '.position', [0, 0, 0]);
    const barRep = P.contentItem(bars, 'repeater', { name: '频谱重复' });
    set(bars, 'content.' + barRep.id + '.copies', 22); set(bars, 'content.' + barRep.id + '.position', [26, 0, 0]);
    set(bars, 'content.' + barRep.id + '.rotation', 0); set(bars, 'content.' + barRep.id + '.scale', 100);
    set(bars, 'content.' + barRep.id + '.startOpacity', 1); set(bars, 'content.' + barRep.id + '.endOpacity', .2);
    anim(bars, 'transform.scale', [key(0, [100, 18, 100], { out: 'ease' }), key(.8, [100, 84, 100]), key(1.6, [100, 40, 100]), key(2.4, [100, 100, 100]), key(3.4, [100, 55, 100]), key(5.2, [100, 28, 100])]);
    anim(bars, 'shape.fillColor', [key(0, TEAL), key(2.8, MINT), key(4.0, GOLD)]);
    const note = layer(screen, 'text', { name: '注释', text: 'SIGNAL LOCKED / NOMINAL', font: T.DEFAULT_FONT, weight: 500, fontSize: 12, fillColor: C('#83a39b'), tracking: 3, align: 'left', position: [54, 330, 0], opacity: 60 });
    const readout = layer(screen, 'text', { name: '读数', text: '88.14', font: T.DEFAULT_FONT, weight: 700, fontSize: 58, fillColor: IVORY, tracking: 1, align: 'right', position: [664, 300, 0] });
    anim(readout, 'transform.opacity', [key(0, 0), key(.8, 100)]);
    const scan = layer(screen, 'shape', { name: '扫描线', shapeType: 'rect', size: [660, 2], fillColor: MINT, position: [360, 30, 0] });
    set(scan, 'shape.fillOpacity', 55);
    P.addEffect(scan, 'glow', { threshold: .1, radius: 12, intensity: 2, color: MINT });
    anim(scan, 'transform.position', [key(0, [360, 28, 0], { out: 'linear' }), key(5.6, [360, 372, 0], { out: 'linear' })]);
    screen.params = [
      { id: 'pRead', name: '读数', layerId: readout.id, key: 'text.content', type: 'text', def: '88.14' },
      { id: 'pState', name: '状态', layerId: sState.id, key: 'text.content', type: 'text', def: 'STABLE   ●' }
    ];

    // ============ stage comp (preserve 3D) ============
    const stage = comp(project, { name: '能量舞台', width: 1920, height: 1080, fps: 60, duration: 15, bg: [0, 0, 0, 0] });
    // field inside stage for torus
    const stageField = layer(stage, 'field', { name: '内场', fieldType: 'noise', strength: 14, radius: 900, position: [960, 540, 0], speed: .35 });
    set(stageField, 'field.scale', 1.8);
    const haloGroup = comp(project, { name: '光环组', width: 1920, height: 1080, fps: 60, duration: 15, bg: [0, 0, 0, 0] });
    const torus = layer(haloGroup, 'geo', { name: '轨道环', kind: 'torus', radius: 352, tube: 15, segments: 96, rings: 16, position: [960, 540, 0] });
    set(torus, 'mat.front.baseColor', C('#2c514d')); set(torus, 'mat.front.metalness', .92); set(torus, 'mat.front.roughness', .24);
    set(torus, 'mat.front.emissive', .12); set(torus, 'mat.front.emissiveColor', MINT); set(torus, 'mat.env', 1.5);
    anim(torus, 'transform.rotation', [key(0, [10, 0, 0]), key(5, [22, 8, 90]), key(9, [62, 26, 180]), key(12, [-8, 52, 260]), key(15, [14, 10, 330])]);
    const innerTorus = layer(haloGroup, 'geo', { name: '内旋环', kind: 'torus', radius: 280, tube: 2.1, segments: 80, rings: 8, position: [960, 540, 0] });
    set(innerTorus, 'mat.front.baseColor', C('#c9a25d')); set(innerTorus, 'mat.front.metalness', 1); set(innerTorus, 'mat.front.roughness', .2);
    set(innerTorus, 'mat.front.emissive', .3); set(innerTorus, 'mat.front.emissiveColor', GOLD);
    anim(innerTorus, 'transform.rotation', [key(0, [68, 0, 0]), key(7, [80, 58, 180]), key(15, [110, 160, 360])]);
    const prism = layer(haloGroup, 'geo', { name: '棱镜星体', kind: 'extrude', depth: 46, bevel: 5, sourceLayerId: null, position: [960, 540, 0] });
    set(prism, 'geo.path', G.star(48, 20, 6));
    set(prism, 'mat.front.baseColor', C('#9ab7b2')); set(prism, 'mat.front.metalness', .95); set(prism, 'mat.front.roughness', .16);
    set(prism, 'mat.side.baseColor', C('#3b2f1c')); set(prism, 'mat.bevel.baseColor', GOLD); set(prism, 'mat.bevel.metalness', 1); set(prism, 'mat.bevel.roughness', .2);
    set(prism, 'geo.fields', []);
    const stageGroupLayer = layer(stage, 'precomp', { name: '光环组', compId: haloGroup.id, mode: 'preserve3d', position: [960, 540, 0], anchor: [960, 540, 0] });
    torus.geo.fields = [stageField.id];
    prism.geo.fields = [stageField.id];
    // tilt and animate group as a whole
    anim(stageGroupLayer, 'transform.rotation', [key(0, [12, -18, 0]), key(5, [26, 34, 8]), key(9, [-8, -24, -4]), key(13, [10, 8, 0]), key(15, [12, 4, 0])]);
    anim(stageGroupLayer, 'transform.scale', [key(0, [72, 72, 72]), key(2.4, [90, 90, 90]), key(5.4, [100, 100, 100]), key(8.8, [86, 86, 86]), key(12, [100, 100, 100]), key(15, [96, 96, 96])]);
    const core = layer(stage, 'geo', { name: '能量核', kind: 'sphere', radius: 46, segments: 32, rings: 20, position: [960, 540, 0] });
    set(core, 'mat.front.baseColor', C('#192d2c')); set(core, 'mat.front.metalness', .7); set(core, 'mat.front.roughness', .18);
    set(core, 'mat.front.emissive', .55); set(core, 'mat.front.emissiveColor', MINT); set(core, 'mat.env', 1.2);
    anim(core, 'transform.scale', [key(0, [70, 70, 70]), key(2.4, [100, 100, 100]), key(5.4, [130, 130, 130]), key(8.8, [88, 88, 88]), key(11.6, [120, 120, 120]), key(15, [100, 100, 100])]);
    // flatten stage layer transform into main later

    // ============ main: helpers ============
    const ctrl = layer(main, 'null', { name: '节奏控制器', position: [960, 540, 0] });
    anim(ctrl, 'transform.position', [key(0, [960, 540, 0]), key(2.4, [985, 528, 8]), key(5.4, [968, 566, 30]), key(8.8, [1000, 520, 12]), key(11.6, [960, 540, 0]), key(14.5, [960, 538, 0])]);
    anim(ctrl, 'transform.rotation', [key(0, [0, 0, 0]), key(5.4, [0, 0, 12]), key(8.8, [0, 0, -6]), key(12, [0, 0, 0])]);

    // ============ background ============
    const bg = layer(main, 'solid', { name: '深空背景' });
    set(bg, 'solid.gradientOn', true);
    set(bg, 'solid.gradientStart', C('#020509')); set(bg, 'solid.gradientEnd', C('#0a1c1d'));
    set(bg, 'solid.gradientAngle', 108);
    colorKeys(bg, 'solid.gradientStart', [[0, '#020509'], [3, '#031014'], [8.8, '#061615'], [12, '#080b10']]);
    colorKeys(bg, 'solid.gradientEnd', [[0, '#0a1c1d'], [3, '#0d2a2a'], [8.8, '#16261f'], [12, '#1a1512']]);
    P.addEffect(bg, 'vignette', { amount: .5, radius: .48, softness: .7 });
    P.addEffect(bg, 'grain', { amount: .035, size: 1.2 });

    // far atmosphere bands
    const atm = layer(main, 'solid', { name: '大气辉光', color: C('#0d3b3a') });
    set(atm, 'solid.gradientOn', true); set(atm, 'solid.gradientStart', [.05, .25, .23, .7]); set(atm, 'solid.gradientEnd', [0, 0, 0, 0]); set(atm, 'solid.gradientAngle', 90);
    set(atm, 'transform.position', [960, 740, 0]); set(atm, 'transform.scale', [100, 52, 100]);
    set(atm, 'blendMode', 'screen'); set(atm, 'transform.opacity', 12);
    P.addEffect(atm, 'glow', { threshold: .05, radius: 60, intensity: .8, color: TEAL });

    // ghost title (independent precomp, behind 3D)
    const haloGlow = layer(main, 'shape', { name: '核心辉光', shapeType: 'ellipse', size: [1400, 1400], fillColor: C('#1d7a70'), position: [960, 540, 0], opacity: 0 });
    set(haloGlow, 'shape.fillColor', C('#1e7f74')); set(haloGlow, 'shape.fillOpacity', 20);
    P.addEffect(haloGlow, 'blur', { amount: 110, repeat: 2 });
    P.addEffect(haloGlow, 'glow', { threshold: .02, radius: 120, intensity: 1.2, color: MINT });
    set(haloGlow, 'blendMode', 'screen');
    anim(haloGlow, 'transform.opacity', [key(0, 0), key(2.4, 100), key(5.4, 62), key(8.8, 80), key(12, 46), key(15, 40)]);
    anim(haloGlow, 'transform.scale', [key(0, [50, 50, 100]), key(3.4, [100, 100, 100]), key(6.5, [86, 86, 100]), key(10, [112, 112, 100]), key(13.4, [92, 92, 100]), key(15, [90, 90, 100])]);
    const ghost = layer(main, 'precomp', { name: '标题 · 幽灵', compId: title.id, mode: 'flat', position: [960, 690, 0], scale: [118, 118, 100] });
    ghost.startTime = 0; ghost.inPoint = 0; ghost.outPoint = 15;
    ghost.precomp.speed = -62; ghost.precomp.offset = 15; ghost.precomp.timeRemap = false;
    ghost.precomp.overrides = { pTitle: '星核', pSub: 'NOVA CORE', pColor: [.42, .75, .68, 1] };
    set(ghost, 'precomp.opacity', 22); set(ghost, 'transform.opacity', 22);
    set(ghost, 'blendMode', 'screen');
    anim(ghost, 'transform.opacity', [key(0, 0), key(5.4, 18), key(9, 5), key(11.6, 10), key(14.5, 3)]);
    P.addEffect(ghost, 'blur', { amount: 2.4, repeat: 1 });
    P.addEffect(ghost, 'glow', { threshold: .3, radius: 18, intensity: .7, color: MINT });

    // ============ main 3D group ============
    // dark far backdrop (shadow receiver)
    const wall = layer(main, 'geo', { name: '弧幕 · 深空背景', kind: 'plane', width: 4200, height: 3000, segments: 16, rings: 12, position: [960, 540, 1250] });
    P.addMaterialGroup(wall);
    set(wall, 'mat.front.baseColor', C('#010807')); set(wall, 'mat.front.metalness', 0); set(wall, 'mat.front.roughness', .98); set(wall, 'mat.env', .02); set(wall, 'mat.reflect', 0);
    set(wall, 'mat.side.baseColor', C('#010807')); set(wall, 'mat.bevel.baseColor', C('#010807'));
    set(wall, 'mat.front.emissive', 0);
    set(wall, 'mat.opacity', 0);

    // stage precomp (nested)
    const stageLayer = layer(main, 'precomp', { name: '能量舞台 · 3D', compId: stage.id, mode: 'preserve3d', position: [960, 540, 0], anchor: [960, 540, 0] });
    anim(stageLayer, 'transform.rotation', [key(0, [0, 0, -8]), key(4, [8, 18, 0]), key(8.8, [-12, -24, 6]), key(12, [4, 6, 0]), key(15, [0, 0, 0])]);
    anim(stageLayer, 'transform.scale', [key(0, [88, 88, 88]), key(5.4, [100, 100, 100]), key(8.8, [86, 86, 86]), key(12, [102, 102, 102]), key(15, [98, 98, 98])]);

    // bead ring in main (emitter)
    const beads = layer(main, 'geo', { name: '光珠环', kind: 'sphere', radius: 16, segments: 14, rings: 9, instances: 72, instRadius: 468, instSize: 34, position: [960, 540, 20] });
    set(beads, 'geo.segments', 14); set(beads, 'geo.rings', 9);
    P.addMaterialGroup(beads);
    set(beads, 'mat.front.baseColor', C('#d79a38')); set(beads, 'mat.front.metalness', 1); set(beads, 'mat.front.roughness', .16);
    set(beads, 'mat.side.baseColor', C('#4d3212')); set(beads, 'mat.bevel.baseColor', C('#fff0c8')); set(beads, 'mat.env', 2.2); set(beads, 'mat.reflect', 1.5);
    set(beads, 'mat.front.emissive', .08); set(beads, 'mat.front.emissiveColor', GOLD);
    anim(beads, 'transform.rotation', [key(0, [24, 0, 0]), key(4, [40, 8, 40]), key(6.4, [70, 35, 95]), key(8.8, [22, -8, 140]), key(11.6, [10, 4, 180]), key(15, [18, 0, 220])]);
    anim(beads, 'transform.scale', [key(0, [62, 62, 62], { out: 'ease' }), key(2.4, [90, 90, 90], { outH: [.2, 1.12], inH: [.8, 1] }), key(5.4, [100, 100, 100]), key(8.8, [94, 94, 94]), key(12, [100, 100, 100]), key(15, [97, 97, 97])]);
    set(beads, 'geo.instWave', 6);
    set(beads, 'geo.instSize', 30);
    expr(beads, 'transform.position', 'var c = thisComp.layer("节奏控制器").transform.position; [c[0], c[1], c[2] + 20]');
    beads.geo.fields = [];

    // node tick ring
    const graph = { id: U.uid('graph'), name: '星环刻度 · 程序节点', nodes: [], links: [], exposed: [] };
    const gRing = AE.Nodes.newNode('ring', 40, 80); gRing.params.radius = 560; gRing.params.count = 110; gRing.params.wave = 8;
    const gDist = AE.Nodes.newNode('distribute', 300, 70); gDist.params.count = 110; gDist.params.width = 4; gDist.params.height = 18; gDist.params.depth = 5; gDist.params.scaleVar = .3;
    const gTrans = AE.Nodes.newNode('transform', 560, 80); gTrans.params.scale = 100; gTrans.params.spin = 4;
    const gNoise = AE.Nodes.newNode('noise', 820, 80); gNoise.params.amount = 8; gNoise.params.scale = .006; gNoise.params.speed = .5;
    const gOut = AE.Nodes.newNode('output', 1080, 90);
    graph.nodes = [gRing, gDist, gTrans, gNoise, gOut];
    AE.Nodes.link(graph, gRing.id, 'geo', gDist.id, 'geo');
    AE.Nodes.link(graph, gDist.id, 'geo', gTrans.id, 'geo');
    AE.Nodes.link(graph, gTrans.id, 'geo', gNoise.id, 'geo');
    AE.Nodes.link(graph, gNoise.id, 'geo', gOut.id, 'geo');
    project.nodeGraphs.push(graph);

    const ticks = layer(main, 'nodes', { name: '刻度星环 · NODES', graphId: graph.id, position: [960, 540, 120] });
    P.addMaterialGroup(ticks);
    set(ticks, 'mat.front.baseColor', C('#8faeaa')); set(ticks, 'mat.front.metalness', .9); set(ticks, 'mat.front.roughness', .3);
    set(ticks, 'mat.front.emissive', .25); set(ticks, 'mat.front.emissiveColor', MINT); set(ticks, 'mat.env', 1.2);
    expr(ticks, 'transform.rotation', 'var c = thisComp.layer("节奏控制器").transform.rotation; [0, 0, time * 4 + c * 2]');
    anim(ticks, 'transform.opacity', [key(0, 0), key(2.4, 100), key(8.8, 46), key(12, 64), key(15, 40)]);
    set(ticks, 'mat.front.emissive', .18);
    // shared graph second instance
    const ticks2 = layer(main, 'nodes', { name: '刻度星环 · 副本', graphId: graph.id, position: [960, 540, -30], scale: [68, 68, 68] });
    P.addMaterialGroup(ticks2);
    set(ticks2, 'mat.front.baseColor', C('#5a7a77')); set(ticks2, 'mat.front.metalness', .7); set(ticks2, 'mat.front.roughness', .45);
    set(ticks2, 'mat.front.emissive', .08); set(ticks2, 'mat.front.emissiveColor', TEAL);
    set(ticks2, 'transform.rotation', [0, 0, 22]);
    set(ticks2, 'transform.opacity', 35);

    // distant star lattice node graph
    const starGraph = { id: U.uid('graph'), name: '星尘矩阵 · 程序节点', nodes: [], links: [], exposed: [] };
    const sGrid = AE.Nodes.newNode('grid', 40, 80); sGrid.params.cols = 22; sGrid.params.rows = 13; sGrid.params.gapX = 132; sGrid.params.gapY = 126;
    const sDist = AE.Nodes.newNode('distribute', 300, 80); sDist.params.count = 286; sDist.params.width = 2.4; sDist.params.height = 2.4; sDist.params.depth = 2.4; sDist.params.scaleVar = .7;
    const sNoise = AE.Nodes.newNode('noise', 560, 80); sNoise.params.amount = 90; sNoise.params.scale = .003; sNoise.params.speed = .12; sNoise.params.axis = 'xyz';
    const sOut2 = AE.Nodes.newNode('output', 820, 90);
    starGraph.nodes = [sGrid, sDist, sNoise, sOut2];
    AE.Nodes.link(starGraph, sGrid.id, 'geo', sDist.id, 'geo');
    AE.Nodes.link(starGraph, sDist.id, 'geo', sNoise.id, 'geo');
    AE.Nodes.link(starGraph, sNoise.id, 'geo', sOut2.id, 'geo');
    project.nodeGraphs.push(starGraph);
    const stars = layer(main, 'nodes', { name: '星尘矩阵 · NODES', graphId: starGraph.id, position: [960, 540, 820], scale: [150, 150, 150] });
    P.addMaterialGroup(stars);
    set(stars, 'mat.front.baseColor', C('#1a2a28')); set(stars, 'mat.front.metalness', .2); set(stars, 'mat.front.roughness', .5);
    set(stars, 'mat.front.emissive', .5); set(stars, 'mat.front.emissiveColor', C('#a9d8ce')); set(stars, 'mat.opacity', 55);
    anim(stars, 'transform.opacity', [key(0, 0), key(2.4, 46), key(6, 30), key(9, 50), key(13, 24), key(15, 18)]);
    anim(stars, 'transform.rotation', [key(0, [0, 0, -12]), key(7, [4, 0, 8]), key(12, [-3, 0, 20]), key(15, [0, 0, 14])]);

    // NOVA extruded text
    const nova = layer(main, 'geo', { name: 'NOVA · 挤出字', kind: 'text', text: 'NOVA', font: T.DEFAULT_FONT, fontWeight: 700, fontSize: 232, depth: 84, bevel: 5, position: [1580, 470, 80] });
    const nt = nova.text;
    set(nova, 'text.tracking', 2);
    P.addMaterialGroup(nova);
    set(nova, 'mat.front.baseColor', C('#a8bab5')); set(nova, 'mat.front.metalness', .8); set(nova, 'mat.front.roughness', .2);
    set(nova, 'mat.side.baseColor', C('#3b2b17')); set(nova, 'mat.side.metalness', .85); set(nova, 'mat.side.roughness', .4);
    set(nova, 'mat.bevel.baseColor', C('#f4d49c')); set(nova, 'mat.bevel.metalness', 1); set(nova, 'mat.bevel.roughness', .15);
    set(nova, 'mat.env', 1.7); set(nova, 'mat.reflect', 1.25);
    anim(nova, 'transform.position', [key(3.4, [1720, 620, 700], { out: 'ease' }), key(4.5, [1600, 490, 150], { outH: [.3, 1.4], inH: [.7, .9] }), key(5.2, [1580, 470, 80]), key(8.8, [1590, 470, 80]), key(11.6, [1540, 462, 60]), key(15, [1540, 464, 60])], { spatial: true });
    anim(nova, 'transform.rotation', [key(3.4, [0, -76, 0]), key(4.8, [5, -38, 0]), key(5.4, [3, -20, 0]), key(8.8, [2, -16, 0]), key(11.6, [-4, -10, 0]), key(15, [-4, -10, 0])]);
    anim(nova, 'transform.scale', [key(3.4, [80, 80, 80]), key(4.7, [104, 104, 104], { outH: [.25, 1.2], inH: [.75, 1] }), key(5.4, [100, 100, 100]), key(8.8, [86, 86, 86]), key(11.6, [70, 70, 70]), key(15, [70, 70, 70])]);
    set(nova, 'mat.opacity', 0);
    anim(nova, 'mat.opacity', [key(5.8, 0, { out: 'linear' }), key(6.4, 100)]);
    nova.geo.fields = [];

    // 星核 extruded text
    const coreText = layer(main, 'geo', { name: '星核 · 挤出字', kind: 'text', text: '星核', font: T.CN_FONT, fontWeight: 800, fontSize: 330, depth: 118, bevel: 6, position: [820, 500, 40] });
    set(coreText, 'text.tracking', 12);
    P.addMaterialGroup(coreText);
    set(coreText, 'mat.front.baseColor', C('#e5c98f')); set(coreText, 'mat.front.metalness', .28); set(coreText, 'mat.front.roughness', .34);
    set(coreText, 'mat.front.emissive', .28); set(coreText, 'mat.front.emissiveColor', C('#c98b3f'));
    set(coreText, 'mat.side.baseColor', C('#6a4a24')); set(coreText, 'mat.side.metalness', .8); set(coreText, 'mat.side.roughness', .36);
    set(coreText, 'mat.bevel.baseColor', C('#ffe6b4')); set(coreText, 'mat.bevel.metalness', 1); set(coreText, 'mat.bevel.roughness', .13);
    set(coreText, 'mat.env', .55); set(coreText, 'mat.reflect', .55);
    anim(coreText, 'transform.position', [key(8.0, [820, 620, -520], { out: 'ease' }), key(9.2, [820, 490, 120], { outH: [.2, 1.2], inH: [.8, 1] }), key(9.8, [820, 500, 40]), key(11.6, [820, 500, 35]), key(13.2, [830, 505, 30]), key(15, [830, 505, 30])], { spatial: true });
    anim(coreText, 'transform.rotation', [key(8.0, [0, 48, 0]), key(9.4, [0, 20, 0]), key(11.6, [-3, 16, 0]), key(13.4, [-5, 14, 0]), key(15, [-5, 14, 0])]);
    anim(coreText, 'transform.scale', [key(8.0, [68, 68, 68], { out: 'ease' }), key(9.4, [103, 103, 103], { outH: [.25, 1.15], inH: [.75, 1] }), key(10.1, [100, 100, 100]), key(13.4, [92, 92, 92]), key(15, [92, 92, 92])]);
    set(coreText, 'mat.opacity', 0);
    anim(coreText, 'mat.opacity', [key(8.0, 0, { out: 'linear' }), key(8.4, 100)]);
    coreText.geo.fields = [];

    // collider plane (deforming, pinned) — a dark energy floor
    const collider = layer(main, 'geo', { name: '能量织网 · 碰撞', kind: 'plane', width: 2600, height: 1900, segments: 30, rings: 20, position: [960, 980, 160], rotation: [90, 0, 0] });
    P.addMaterialGroup(collider);
    set(collider, 'mat.front.baseColor', C('#010706')); set(collider, 'mat.front.metalness', .05); set(collider, 'mat.front.roughness', .88);
    set(collider, 'mat.front.emissive', .008); set(collider, 'mat.front.emissiveColor', C('#0e514a')); set(collider, 'mat.env', .05); set(collider, 'mat.reflect', .03);
    set(collider, 'mat.side.baseColor', C('#020908')); set(collider, 'geo.bend', -10); set(collider, 'geo.bendAxis', 'x');
    anim(collider, 'mat.opacity', [key(0, 0), key(1.4, 0), key(2.8, 100)]);
    const edge = layer(main, 'geo', { name: '织网边缘', kind: 'torus', radius: 1080, tube: 2.4, segments: 96, rings: 6, position: [960, 975, 160], rotation: [90, 0, 0], scale: [100, 68, 100] });
    P.addMaterialGroup(edge); set(edge, 'mat.front.baseColor', C('#2b6b62')); set(edge, 'mat.front.emissive', .55); set(edge, 'mat.front.emissiveColor', TEAL); set(edge, 'mat.front.metalness', .4); set(edge, 'mat.front.roughness', .3);
    set(edge, 'mat.front.emissive', .25); set(edge, 'mat.opacity', 42); set(edge, 'mat.env', .3); set(edge, 'mat.reflect', .2);
    anim(edge, 'mat.opacity', [key(0, 0), key(1.8, 0), key(3.2, 42)]);
    P.addPin(collider, [-560, 120, 0]); P.addPin(collider, [520, -60, 0]);
    const pins = collider.geo.pins;
    anim(collider, `pin.${pins[0].id}.offset`, [key(0, [0, 0, 0]), key(3.4, [80, 100, 180]), key(6, [40, -60, 120]), key(9, [-60, 40, 90]), key(12, [0, 0, 0])]);
    anim(collider, `pin.${pins[1].id}.offset`, [key(0, [0, 0, 0]), key(4.4, [-60, 80, 140]), key(7, [40, -40, 100]), key(9.4, [40, 40, 60]), key(13, [0, 0, 0])]);
    set(collider, `pin.${pins[0].id}.radius`, 620); set(collider, `pin.${pins[1].id}.radius`, 520);

    // fields (affect beads, collider, particles)
    const vortex = layer(main, 'field', { name: '旋涡场', fieldType: 'vortex', strength: 52, radius: 1050, position: [960, 540, 160], speed: 1 });
    set(vortex, 'field.visible', true);
    const noiseField = layer(main, 'field', { name: '噪声场', fieldType: 'noise', strength: 20, radius: 920, position: [960, 540, 120], speed: .6 });
    set(noiseField, 'field.scale', 1.6);
    expr(vortex, 'transform.position', 'var c = thisComp.layer("节奏控制器").toWorld([0, 0, 160]); [c[0] + 60, c[1] - 30, c[2]]');
    expr(noiseField, 'transform.position', 'var c = thisComp.layer("节奏控制器").toWorld([0, 0, 120]); [c[0] - 80, c[1] + 50, c[2]]');
    beads.geo.fields = [vortex.id, noiseField.id];
    collider.geo.fields = [noiseField.id, vortex.id];
    anim(vortex, 'field.strength', [key(0, 18), key(3.4, 34), key(5.4, 78), key(8.8, 58), key(11.6, 24), key(15, 10)]);
    anim(noiseField, 'field.strength', [key(0, 4), key(5.4, 26), key(9, 14), key(12, 4)]);

    // particle layer
    const dust = layer(main, 'particle', { name: '金尘 · 粒子发射', emitterLayerId: beads.id, collisionLayerId: collider.id, fields: [vortex.id, noiseField.id], rate: 120, seed: 31 });
    beads.particles = null;
    set(dust, 'particle.rate', 30); anim(dust, 'particle.rate', [key(3.6, 12), key(5.0, 150), key(6.8, 120), key(9.0, 60), key(11.6, 20), key(13.8, 0)]);
    anim(dust, 'particle.speed', [key(3.6, 120), key(5.4, 260), key(8.8, 180)]);
    set(dust, 'particle.spread', 86); set(dust, 'particle.lifetime', 2.8); set(dust, 'particle.gravity', 2.2);
    set(dust, 'particle.size', 8); set(dust, 'particle.sizeVar', .9); set(dust, 'particle.drag', .16);
    colorKeys(dust, 'particle.colorA', [[3.6, '#ffd28d'], [5.4, '#f4b15a'], [8.8, '#ffe9bb']]);
    colorKeys(dust, 'particle.colorB', [[3.6, '#7fe7d4'], [5.4, '#38c7b2'], [9, '#d9b36a']]);
    set(dust, 'particle.opacity', 100); set(dust, 'particle.rotationSpeed', 40);
    set(dust, 'particle.emitterRadius', 300); set(dust, 'particle.trailWidth', 3.4); set(dust, 'particle.trailOpacity', 85);
    dust.particles.trails = { enabled: true, length: 18, width: 3.6, decay: .78, color: [1, .74, .36, 1] };
    dust.particles.events = { enabled: true, type: 'color', color: TEAL, lifespan: .55, impulse: 40, secondary: 2 };
    set(dust, 'particle.restitution', .5); set(dust, 'particle.friction', .72); set(dust, 'particle.collision', 1);
    set(dust, 'mat.front.baseColor', GOLD);

    // data screen as 3D plane precomp
    const screenLayer = layer(main, 'precomp', { name: '数据屏 · 独立画面', compId: screen.id, mode: 'flat', position: [360, 760, 220], scale: [52, 52, 100] });
    screenLayer.precomp.as3dPlane = true;
    screenLayer.precomp.speed = 100;
    screenLayer.precomp.overrides = { pRead: '88.14', pState: 'STABLE   ●' };
    anim(screenLayer, 'transform.rotation', [key(0, [10, -26, 8]), key(5.4, [4, -16, 2]), key(9, [12, -20, -4]), key(13, [4, -10, 0]), key(15, [4, -10, 0])]);
    anim(screenLayer, 'transform.position', [key(0, [420, 820, 260], { out: 'ease' }), key(5.4, [360, 760, 220]), key(9, [300, 740, 200]), key(12, [340, 730, 210]), key(15, [340, 730, 210])]);
    set(screenLayer, 'transform.opacity', 0);
    anim(screenLayer, 'transform.opacity', [key(6.2, 0), key(7.1, 84), key(11.6, 60), key(14.2, 24)]);

    // ============ 2D HUD ============
    // left closed ring
    const arc = layer(main, 'shape', { name: 'HUD · 左环', shapeType: 'ellipse', size: [330, 330], fillColor: [0, 0, 0, 0], strokeColor: MINT, position: [300, 560, 0], opacity: 0 });
    set(arc, 'shape.fillOn', false); set(arc, 'shape.strokeOn', true); set(arc, 'shape.strokeWidth', 1.2); set(arc, 'shape.strokeColor', MINT); set(arc, 'shape.strokeOpacity', 72);
    const arcItem = arc.contents[0];
    P.contentItem(arc, 'trim', { name: '绘制' });
    const trim = arc.contents[arc.contents.length - 1];
    anim(arc, `content.${trim.id}.start`, [key(1.0, 0), key(4.6, 34)]);
    anim(arc, `content.${trim.id}.end`, [key(1.0, 0, { out: 'ease' }), key(3.6, 92, { out: 'linear' }), key(5.4, 70), key(8.8, 84), key(12, 42)]);
    anim(arc, 'transform.opacity', [key(.8, 0), key(1.8, 100), key(8.8, 62), key(11.6, 88), key(14.4, 20)]);
    P.addEffect(arc, 'glow', { threshold: .2, radius: 14, intensity: 1.6, color: MINT });
    anim(arc, 'transform.rotation', [key(0, [0, 0, -18]), key(5, [0, 0, 26]), key(10, [0, 0, -8]), key(15, [0, 0, 2])]);

    // tick ring via repeater
    const tickRing = layer(main, 'shape', { name: 'HUD · 刻度环', shapeType: 'rect', size: [1.5, 13], fillColor: MINT, position: [1680, 420, 0], opacity: 0 });
    const tickRect = tickRing.contents[0];
    set(tickRing, `content.${tickRect.id}.position`, [0, -136, 0]);
    P.contentItem(tickRing, 'repeater', { name: '径向重复' });
    const tickRep = tickRing.contents[tickRing.contents.length - 1];
    set(tickRing, `content.${tickRep.id}.copies`, 42); set(tickRing, `content.${tickRep.id}.rotation`, 360 / 42); set(tickRing, `content.${tickRep.id}.startOpacity`, 1); set(tickRing, `content.${tickRep.id}.endOpacity`, .18);
    set(tickRing, 'shape.fillOpacity', 60);
    anim(tickRing, 'transform.opacity', [key(1.2, 0), key(2.4, 100), key(8.8, 70), key(11.6, 100), key(14.3, 12)]);
    anim(tickRing, 'transform.rotation', [key(0, [0, 0, 0]), key(5, [0, 0, 32]), key(9, [0, 0, -16]), key(15, [0, 0, 6])]);
    P.addEffect(tickRing, 'glow', { threshold: .15, radius: 9, intensity: 1.2, color: MINT });

    // boolean crescent
    const cres = layer(main, 'shape', { name: 'HUD · 布尔月牙', shapeType: 'ellipse', size: [300, 300], fillColor: [0, 0, 0, 0], position: [1660, 820, 0], opacity: 0 });
    // boolean demo uses its own geometry; discard the default ellipse
    if (cres.contents && cres.contents.length) {
      for (const c of cres.contents) for (const k of Object.keys(cres.props)) if (k.startsWith('content.' + c.id + '.')) delete cres.props[k];
      cres.contents = [];
    }
    set(cres, 'shape.fillOn', true); set(cres, 'shape.fillColor', GOLD); set(cres, 'shape.fillOpacity', 86); set(cres, 'shape.strokeOn', true); set(cres, 'shape.strokeColor', GOLD); set(cres, 'shape.strokeWidth', 1); set(cres, 'shape.strokeOpacity', 70);
    const cresGroup = P.contentItem(cres, 'group', { name: '月牙组' });
    const ell1 = P.contentItem(cres, 'ellipse', { name: '外形', parentId: cresGroup.id }); set(cres, `content.${ell1.id}.size`, [300, 300]);
    const ell2 = P.contentItem(cres, 'ellipse', { name: '挖除', parentId: cresGroup.id }); set(cres, `content.${ell2.id}.size`, [280, 280]); set(cres, `content.${ell2.id}.position`, [58, -30]);
    const bool = P.contentItem(cres, 'boolean', { name: '差集', parentId: cresGroup.id, op: 'difference' });
    anim(cres, 'transform.opacity', [key(2.2, 0), key(3.2, 100), key(9, 34), key(12, 82), key(14.2, 10)]);
    anim(cres, 'transform.rotation', [key(0, [0, 0, -30]), key(9, [0, 0, 36]), key(15, [0, 0, 12])]);
    P.addEffect(cres, 'glow', { threshold: .1, radius: 18, intensity: 1.4, color: GOLD });

    // crosshair
    const cross = layer(main, 'shape', { name: 'HUD · 十字准星', shapeType: 'rect', size: [160, 1], fillColor: MINT, position: [960, 540, 0], opacity: 0 });
    set(cross, 'shape.fillOpacity', 40);
    const crossRep = P.contentItem(cross, 'repeater', { name: '四向' });
    set(cross, `content.${crossRep.id}.copies`, 2); set(cross, `content.${crossRep.id}.rotation`, 90);
    anim(cross, 'transform.opacity', [key(3.6, 0), key(4.4, 100), key(5.6, 0), key(12.4, 0), key(13.2, 60), key(14.6, 0)]);

    // path-morph HUD ring
    const morph = layer(main, 'shape', { name: 'HUD · 路径形变', shapeType: 'path', path: G.circle(180), size: [250, 250], fillColor: [0, 0, 0, 0], position: [960, 540, 0], opacity: 0 });
    set(morph, 'shape.fillOn', false); set(morph, 'shape.strokeOn', true); set(morph, 'shape.strokeColor', GOLD); set(morph, 'shape.strokeWidth', 1.4); set(morph, 'shape.strokeOpacity', 55);
    const morphItem = morph.contents[0];
    set(morph, `content.${morphItem.id}.path`, G.circle(180));
    anim(morph, `content.${morphItem.id}.path`, [key(2.4, G.circle(180), { out: 'ease' }), key(4.4, G.rect(300, 300, 0, 0, 54), { out: 'ease' }), key(6.4, G.circle(210), { out: 'ease' }), key(8.8, G.star(220, 160, 8), { out: 'ease' }), key(12, G.circle(180))]);
    anim(morph, 'transform.opacity', [key(2.4, 0), key(3.4, 100), key(9, 50), key(11.6, 90), key(14.2, 0)]);
    anim(morph, 'transform.rotation', [key(0, [0, 0, 0]), key(8, [0, 0, 90]), key(13, [0, 0, 180])]);
    P.addEffect(morph, 'glow', { threshold: .2, radius: 10, intensity: 1.2, color: GOLD });

    // rotating loop ring
    const loopRing = layer(main, 'shape', { name: 'HUD · LOOP 弧', shapeType: 'ellipse', size: [520, 520], fillColor: [0, 0, 0, 0], position: [960, 540, 0], opacity: 0 });
    set(loopRing, 'shape.fillOn', false); set(loopRing, 'shape.strokeOn', true); set(loopRing, 'shape.strokeColor', C('#4c837b')); set(loopRing, 'shape.strokeWidth', 1);
    const loopItem = loopRing.contents[0];
    P.contentItem(loopRing, 'trim', { name: '段' });
    const loopTrim = loopRing.contents[loopRing.contents.length - 1];
    set(loopRing, `content.${loopTrim.id}.start`, 4); set(loopRing, `content.${loopTrim.id}.end`, 34);
    anim(loopRing, 'transform.rotation', [key(0, [0, 0, 0]), key(4, [0, 0, 360])]);
    expr(loopRing, 'transform.rotation', 'loopOut("cycle")');
    anim(loopRing, 'transform.opacity', [key(3.8, 0), key(5, 60), key(8.8, 36), key(13.8, 0)]);
    P.addEffect(loopRing, 'glow', { threshold: .25, radius: 10, intensity: .8, color: TEAL });

    // HUD labels
    const lab1 = layer(main, 'text', { name: 'HUD · 角标', text: 'PRISM / FIELD STUDY — 01', font: T.DEFAULT_FONT, weight: 500, fontSize: 15, fillColor: C('#8ba39e'), tracking: 6, align: 'left', position: [92, 84, 0], opacity: 0 });
    anim(lab1, 'transform.opacity', [key(0, 55), key(1.4, 88)]);
    const lab2 = layer(main, 'text', { name: 'HUD · 计数', text: 'VX—04    F 88.14    Δ 0.42', font: T.DEFAULT_FONT, weight: 500, fontSize: 13, fillColor: C('#7fe7d4'), tracking: 4, align: 'right', position: [1828, 84, 0], opacity: 0 });
    anim(lab2, 'transform.opacity', [key(0, 35), key(2.2, 90)]);
    expr(lab2, 'transform.position', 'var c = thisComp.layer("节奏控制器").transform.position; [1828 + Math.sin(time * .8) * 3, 84 + Math.cos(time * .7) * 2, 0]');
    // path text
    const pathText = layer(main, 'text', { name: 'HUD · 路径文字', text: 'BEYOND THE CORE · MOTION STUDY · ', font: T.DEFAULT_FONT, weight: 500, fontSize: 20, fillColor: C('#a8c4bd'), tracking: 2, align: 'left', position: [960, 540, 0], opacity: 0 });
    pathText.text.onPath = true; pathText.text.pathAlign = 'center'; pathText.text.pathOffset = 0;
    set(pathText, 'text.path', G.circle(500));
    set(pathText, 'text.fillColor', C('#a8c4bd'));
    anim(pathText, 'text.fontSize', [key(4.6, 16), key(6.2, 21), key(12, 17)]);
    anim(pathText, 'transform.opacity', [key(4.8, 0), key(6.0, 72), key(9.2, 34), key(12.4, 62), key(14.4, 14)]);
    P.addEffect(pathText, 'glow', { threshold: .3, radius: 8, intensity: .7, color: MINT });

    // temporal spectrum band (time displacement + echo)
    const tdControl = layer(main, 'shape', { name: '置换控制器', shapeType: 'ellipse', size: [420, 240], fillColor: [1, 1, 1, 1], position: [720, 900, 0], opacity: 100 });
    tdControl.visible = false;
    set(tdControl, 'shape.fillColor', [1, 1, 1, 1]); set(tdControl, 'shape.fillOpacity', 100);
    P.addEffect(tdControl, 'blur', { amount: 55, repeat: 2 });
    anim(tdControl, 'transform.position', [key(3.0, [300, 900, 0]), key(6.0, [1500, 860, 0]), key(9.0, [500, 930, 0]), key(12.0, [1200, 880, 0]), key(15, [800, 900, 0])]);
    anim(tdControl, 'transform.scale', [key(3.0, [70, 60, 100]), key(6.0, [120, 90, 100]), key(9.0, [60, 80, 100]), key(12.0, [100, 60, 100])]);
    const tdBand = layer(main, 'shape', { name: '光谱带 · 时间置换', shapeType: 'rect', size: [560, 22], fillColor: [0, 0, 0, 0], position: [960, 888, 0], opacity: 0 });
    set(tdBand, 'shape.fillOn', false); set(tdBand, 'shape.strokeOn', true); set(tdBand, 'shape.strokeColor', MINT); set(tdBand, 'shape.strokeWidth', 2); set(tdBand, 'shape.strokeOpacity', 60);
    const tdBandRect = tdBand.contents[0];
    set(tdBand, `content.${tdBandRect.id}.size`, [32, 12]);
    P.contentItem(tdBand, 'repeater', { name: '光谱重复' });
    const tdBandRep = tdBand.contents[tdBand.contents.length - 1];
    set(tdBand, `content.${tdBandRep.id}.copies`, 26); set(tdBand, `content.${tdBandRep.id}.position`, [22, -5, 0]); set(tdBand, `content.${tdBandRep.id}.rotation`, 0);
    set(tdBand, `content.${tdBandRep.id}.startOpacity`, 1); set(tdBand, `content.${tdBandRep.id}.endOpacity`, .2);
    anim(tdBand, 'transform.position', [key(3.4, [800, 888, 0]), key(5.6, [960, 888, 0]), key(8.8, [900, 888, 0]), key(11.6, [960, 888, 0]), key(14.4, [960, 888, 0])]);
    anim(tdBand, 'transform.opacity', [key(3.4, 0), key(5.2, 100), key(8.8, 58), key(11.6, 46), key(13.8, 22), key(14.6, 0)]);
    expr(tdBand, 'transform.rotation', 'Math.sin(time * 1.2) * 2');
    const tdFx = P.addEffect(tdBand, 'timeDisplace', { span: .55, slices: 4, amount: 1.2, offset: -.3 });
    tdFx.controlLayerId = tdControl.id;
    P.addEffect(tdBand, 'echo', { samples: 3, delay: .075, decay: .45, offset: 8 });
    P.addEffect(tdBand, 'glow', { threshold: .2, radius: 12, intensity: 1.2, color: MINT });
    set(tdBand, 'blendMode', 'screen');

    // intro title flat instance (above 3D)
    const intro = layer(main, 'precomp', { name: '标题 · 开场', compId: title.id, mode: 'flat', position: [960, 430, 0], scale: [96, 96, 100] });
    intro.precomp.timeRemap = true; intro.startTime = 0; intro.inPoint = 0; intro.outPoint = 6.0;
    intro.precomp.overrides = { pTitle: '星核', pSub: 'NOVA CORE', pColor: IVORY };
    anim(intro, 'precomp.time', [key(0, .85, { out: 'ease' }), key(1.2, 2.4), key(3.7, 3.4, { out: 'hold' }), key(4.3, 3.4, { out: 'linear' }), key(5.1, 2.2), key(5.8, 2.2)]);
    anim(intro, 'transform.position', [key(0, [960, 510, 0], { out: 'ease' }), key(1.4, [960, 430, 0], { outH: [.2, 1.15], inH: [.8, 1] }), key(3.7, [960, 430, 0]), key(5.4, [960, 410, 0]), key(6.0, [960, 380, 0])]);
    anim(intro, 'transform.opacity', [key(0, 100), key(.8, 100), key(3.6, 100), key(4.7, 55), key(5.35, 0)]);
    anim(intro, 'transform.scale', [key(0, [88, 88, 100]), key(1.4, [100, 100, 100]), key(3.8, [100, 100, 100]), key(5.6, [104, 104, 100])]);
    P.addEffect(intro, 'glow', { threshold: .5, radius: 26, intensity: .8, color: MINT });
    P.addEffect(intro, 'shadow', { distance: 26, angle: 96, softness: 30, opacity: 40, color: C('#000000') });

    // tagline + mask reveal
    const tagline = layer(main, 'text', { name: '收束 · 标语', text: '于核心之处，见万象', font: T.CN_FONT, weight: 500, fontSize: 40, fillColor: C('#e4e0d2'), tracking: 12, align: 'center', position: [960, 985, 0], opacity: 0 });
    P.addMask(tagline, 'rect');
    const mask = tagline.masks[0];
    set(tagline, `mask.${mask.id}.feather`, 26);
    set(tagline, `mask.${mask.id}.path`, G.rect(0, 110, -380, 0));
    anim(tagline, `mask.${mask.id}.path`, [key(11.2, G.rect(0, 110, -380, 0), { out: 'ease' }), key(12.9, G.rect(1200, 110, 0, 0), { out: 'ease' }), key(13.8, G.rect(1300, 110, 0, 0))]);
    anim(tagline, 'transform.opacity', [key(11.2, 0), key(11.8, 100), key(15, 88)]);
    expr(tagline, 'transform.opacity', 'linear(time, 11.2, 12.4, 0, 100) * 0.9');
    P.addEffect(tagline, 'shadow', { distance: 14, angle: 100, softness: 18, opacity: 55, color: C('#000000') });
    P.addEffect(tagline, 'glow', { threshold: .6, radius: 12, intensity: .4, color: GOLD });
    const endCap = layer(main, 'text', { name: '收束 · 署名', text: 'NOVA CORE  /  A MOTION STUDY  /  PRISM 2026', font: T.DEFAULT_FONT, weight: 500, fontSize: 13, fillColor: C('#8fa59e'), tracking: 3, align: 'center', position: [960, 1042, 0], opacity: 0 });
    anim(endCap, 'transform.opacity', [key(13.0, 0), key(13.8, 70), key(15, 60)]);
    set(endCap, 'blendMode', 'normal');

    // track matte: scan label
    const matteSrc = layer(main, 'shape', { name: '遮罩 · 扫光', shapeType: 'rect', size: [220, 60], fillColor: C('#ffffff'), position: [900, 1010, 0], opacity: 100 });
    set(matteSrc, 'shape.fillColor', [1, 1, 1, 1]); set(matteSrc, 'shape.fillOpacity', 100);
    anim(matteSrc, 'transform.position', [key(12.0, [640, 1010, 0], { out: 'ease' }), key(13.4, [1280, 1010, 0])]);
    const matteText = layer(main, 'text', { name: '遮罩文字 · SIGNAL', text: 'SIGNAL / 星核信号已锁定', font: T.CN_FONT, weight: 600, fontSize: 22, fillColor: C('#d9eee7'), tracking: 5, align: 'center', position: [960, 1010, 0] });
    matteText.matte = { enabled: true, source: matteSrc.id, mode: 'alpha' };
    set(matteText, 'transform.opacity', 75);
    anim(matteText, 'transform.opacity', [key(12.0, 0), key(12.2, 70), key(14.2, 70), key(14.5, 0)]);
    // luma matte: soft gradient sweep reveals a small HUD caption
    const lumaSrc = layer(main, 'solid', { name: '遮罩源 · 亮度渐变', color: C('#ffffff'), position: [220, 960, 0], scale: [22, 5, 100] });
    set(lumaSrc, 'solid.gradientOn', true); set(lumaSrc, 'solid.gradientStart', [1, 1, 1, 1]); set(lumaSrc, 'solid.gradientEnd', [0, 0, 0, 1]); set(lumaSrc, 'solid.gradientAngle', 90);
    anim(lumaSrc, 'transform.position', [key(12.1, [160, 960, 0], { out: 'ease' }), key(13.6, [470, 960, 0])]);
    const lumaText = layer(main, 'text', { name: '遮罩文字 · LUMA', text: 'LUMA / 亮度遮罩', font: T.CN_FONT, weight: 600, fontSize: 15, fillColor: C('#a9d8ce'), tracking: 4, align: 'center', position: [300, 960, 0] });
    lumaText.matte = { enabled: true, source: lumaSrc.id, mode: 'luma' };
    anim(lumaText, 'transform.opacity', [key(12.1, 0), key(12.4, 75), key(14.3, 75), key(14.6, 0)]);

    // shockwave rings on the 8.8s reveal
    for (let si = 0; si < 2; si++) {
      const ring = layer(main, 'shape', { name: '冲击 · 光环 ' + (si + 1), shapeType: 'ellipse', size: [320, 320], fillColor: [0, 0, 0, 0], position: [960, 540, 0], opacity: 0 });
      set(ring, 'shape.fillOn', false); set(ring, 'shape.strokeOn', true); set(ring, 'shape.strokeWidth', 4); set(ring, 'shape.strokeColor', GOLD); set(ring, 'shape.strokeOpacity', 100);
      set(ring, 'blendMode', 'add');
      const d = si * .16;
      anim(ring, 'transform.scale', [key(8.55 + d, [8, 8, 100], { out: 'ease' }), key(9.55 + d, [230, 230, 100]), key(10.3 + d, [285, 285, 100])]);
      anim(ring, 'transform.opacity', [key(8.55 + d, 0), key(8.85 + d, 78), key(9.7 + d, 0)]);
      P.addEffect(ring, 'glow', { threshold: .05, radius: 22, intensity: 1.8, color: GOLD });
    }

    // light leak / bloom overlay
    const leak = layer(main, 'solid', { name: '光晕 · 上层', color: C('#3b8f7d') });
    set(leak, 'solid.gradientOn', true); set(leak, 'solid.gradientStart', [.16, .55, .48, .6]); set(leak, 'solid.gradientEnd', [0, 0, 0, 0]); set(leak, 'solid.gradientAngle', 60);
    set(leak, 'transform.position', [1180, 360, 0]); set(leak, 'transform.scale', [44, 30, 100]);
    set(leak, 'blendMode', 'screen'); set(leak, 'transform.opacity', 12);
    P.addEffect(leak, 'glow', { threshold: .02, radius: 70, intensity: 1.2, color: C('#66d8c4') });
    anim(leak, 'transform.opacity', [key(0, 0), key(2.4, 10), key(5.4, 18), key(9, 8), key(13, 12), key(15, 4)]);

    // additive bokeh accent
    const bokeh = layer(main, 'shape', { name: '光斑 · 相加', shapeType: 'ellipse', size: [54, 54], fillColor: C('#ffbf6e'), position: [1450, 330, 0], opacity: 0 });
    set(bokeh, 'shape.fillColor', C('#ffbd70')); set(bokeh, 'shape.fillOpacity', 10);
    P.addEffect(bokeh, 'blur', { amount: 26, repeat: 2 });
    P.addEffect(bokeh, 'glow', { threshold: .05, radius: 36, intensity: 1.0, color: GOLD });
    set(bokeh, 'blendMode', 'add');
    anim(bokeh, 'transform.opacity', [key(2.4, 0), key(4.4, 70), key(6.0, 0)]);
    anim(bokeh, 'transform.position', [key(2.4, [1450, 330, 0]), key(8.8, [1550, 500, 0]), key(13, [1400, 280, 0]), key(15, [1380, 260, 0])]);
    anim(bokeh, 'transform.scale', [key(2.4, [40, 40, 100]), key(5.4, [90, 90, 100]), key(8.8, [60, 60, 100]), key(12, [36, 36, 100])]);
    // overlay warmth layer
    const warm = layer(main, 'solid', { name: '暖调 · 叠加', color: C('#5c3a1c') });
    set(warm, 'solid.gradientOn', true); set(warm, 'solid.gradientStart', [.32, .18, .06, .8]); set(warm, 'solid.gradientEnd', [0, 0, 0, 0]); set(warm, 'solid.gradientAngle', 120);
    set(warm, 'blendMode', 'overlay'); set(warm, 'transform.opacity', 16);
    anim(warm, 'transform.opacity', [key(3.4, 0), key(8.8, 22), key(12, 12), key(15, 6)]);

    // track matte? done. darker vignette multiply layer (solid gradient)
    const vig = layer(main, 'solid', { name: '暗角 · 正片叠底', color: C('#000000') });
    set(vig, 'solid.gradientOn', true); set(vig, 'solid.gradientStart', [0, 0, 0, 1]); set(vig, 'solid.gradientEnd', [0, 0, 0, 0]); set(vig, 'solid.gradientAngle', 60);
    set(vig, 'blendMode', 'multiply'); set(vig, 'transform.opacity', 35);
    P.addEffect(vig, 'vignette', { amount: .8, radius: .3, softness: .7 });

    // adjustment / grade
    const grade = layer(main, 'adjustment', { name: '总调色 · GRADE' });
    P.addEffect(grade, 'hueSat', { hue: 4, sat: 108, bright: 102, contrast: 106 });
    P.addEffect(grade, 'vignette', { amount: .34, radius: .62, softness: .5 });
    P.addEffect(grade, 'grain', { amount: .028, size: 1.2 });

    // ============ camera / lights ============
    const cam = layer(main, 'camera', { name: '主相机', position: [1300, 690, -1720], fov: 35 });
    main.activeCamera = cam.id;
    cam.camera.target = [960, 540, 100];
    set(cam, 'camera.target', [960, 540, 100]);
    anim(cam, 'transform.position', [
      key(0, [1360, 720, -1780], { out: 'ease', spatialOut: [-60, -40, 120] }),
      key(2.4, [1160, 620, -1460], { out: 'ease', spatialOut: [-80, -30, 150] }),
      key(4.4, [810, 470, -660], { out: 'ease', spatialOut: [-40, 10, 120] }),
      key(5.4, [720, 460, -560], { out: 'ease', spatialOut: [40, 50, -80] }),
      key(7.2, [1560, 720, -1900], { out: 'ease', spatialOut: [-100, -20, 80] }),
      key(8.8, [1440, 600, -1600], { out: 'ease', spatialOut: [-40, 20, 100] }),
      key(11.6, [1000, 550, -1220], { out: 'ease', spatialOut: [-20, 10, 60] }),
      key(13.4, [1260, 630, -1860], { out: 'ease', spatialOut: [10, 0, 40] }),
      key(15, [1220, 615, -1800], { out: 'ease' })
    ], { spatial: true });
    expr(cam, 'transform.position', 'wiggle(0.28, 3.5)');
    anim(cam, 'camera.target', [key(0, [960, 540, 140]), key(2.4, [960, 540, 110]), key(4.4, [970, 545, 120]), key(5.4, [980, 555, 100]), key(7.2, [960, 540, 40]), key(8.8, [980, 540, 40]), key(11.6, [900, 540, 40]), key(13.4, [960, 540, 30]), key(15, [960, 538, 30])]);
    anim(cam, 'camera.fov', [key(0, 37), key(2.4, 35), key(4.4, 31), key(5.4, 33), key(7.2, 38), key(11.6, 34), key(13.4, 33), key(15, 33)]);
    anim(cam, 'camera.focus', [key(0, 0, { out: 'linear' }), key(2.4, 0), key(3.8, 520), key(4.4, 700), key(5.4, 920), key(7.2, 1900), key(8.8, 1600), key(11.6, 1050), key(13.4, 1680), key(15, 1620)]);
    anim(cam, 'camera.aperture', [key(0, .5), key(3.4, 1.8), key(4.3, 3.2), key(5.2, 1.8), key(7.2, 1.8), key(9, 2.0), key(13.4, 1.2), key(15, 1.0)]);
    set(cam, 'camera.near', 1); set(cam, 'camera.far', 30000);

    const keyLight = layer(main, 'light', { name: '主光 · 暖', lightType: 'directional', position: [-700, -900, -1500], target: [960, 540, 300], color: C('#ffe6c4'), intensity: 4.2, castsShadow: true });
    expr(keyLight, 'light.intensity', '4.4 + 2.4 * (0.5 + 0.5 * Math.sin(time * 0.9))');
    anim(keyLight, 'transform.position', [key(0, [-700, -900, -1600]), key(5.4, [-1100, -500, -1200]), key(9, [-500, -1100, -1600]), key(13, [-900, -700, -1400]), key(15, [-850, -750, -1500])]);
    const rim = layer(main, 'light', { name: '轮廓光 · 冷', lightType: 'directional', position: [2200, 300, -1300], target: [960, 540, 150], color: C('#8fe3d8'), intensity: 2.2, castsShadow: false });
    anim(rim, 'transform.position', [key(0, [2100, 200, -1500]), key(5.4, [1600, 500, -900]), key(9, [2400, -100, -1300]), key(13, [1900, 400, -1200]), key(15, [2000, 300, -1300])]);
    expr(rim, 'light.intensity', '1.2 + 1.4 * (0.5 + 0.5 * Math.cos(time * .7))');
    const fillLight = layer(main, 'light', { name: '字面补光 · 暖', lightType: 'point', position: [980, 470, -360], target: [960, 540, 0], color: C('#ffcf98'), intensity: 7, radius: 980 });
    anim(fillLight, 'transform.position', [key(0, [760, 380, -420]), key(4.5, [860, 420, -300]), key(9, [980, 470, -360]), key(12, [900, 440, -380]), key(15, [850, 430, -400])]);
    const rimLight = layer(main, 'light', { name: '点光 · 青', lightType: 'point', position: [960, 540, -260], target: [960, 540, 0], color: MINT, intensity: 9, radius: 1200 });
    expr(rimLight, 'transform.position', 'var c = thisComp.layer("节奏控制器").transform.position; [c[0] + 140, c[1] - 120, c[2] - 180]');
    expr(rimLight, 'light.intensity', '3 + 8 * (0.5 + 0.5 * Math.sin(time * 1.3 + 1.2))');
    const warmLight = layer(main, 'light', { name: '点光 · 金', lightType: 'point', position: [1500, -200, -800], target: [960, 540, 0], color: GOLD, intensity: 6, radius: 1800 });
    expr(warmLight, 'transform.position', 'var p = thisComp.layer("节奏控制器").transform.position.valueAtTime(Math.max(0, time - 0.18)); [p[0] + 540, p[1] - 350, p[2] - 500]');
    expr(warmLight, 'light.intensity', '2.4 + 2.6 * (0.5 + 0.5 * Math.sin(time * 1.1 + 2))');

    // ============ sound ============
    const pad = layer(main, 'tone', { name: '配乐 · 低频铺底', instrument: 'pad', volume: 46, notes: [] });
    pad.tone.notes = [
      { t: 0, dur: 4.6, midi: 45, vel: .5 }, { t: 0, dur: 4.6, midi: 52, vel: .35 }, { t: 0, dur: 4.6, midi: 57, vel: .28 },
      { t: 2.4, dur: 3.2, midi: 48, vel: .4 }, { t: 2.4, dur: 3.2, midi: 55, vel: .24 },
      { t: 5.4, dur: 3.6, midi: 41, vel: .5 }, { t: 5.4, dur: 3.6, midi: 48, vel: .3 }, { t: 5.4, dur: 3.6, midi: 53, vel: .24 },
      { t: 8.8, dur: 3.2, midi: 43, vel: .45 }, { t: 8.8, dur: 3.2, midi: 50, vel: .3 },
      { t: 11.6, dur: 3.4, midi: 45, vel: .5 }, { t: 11.6, dur: 3.4, midi: 52, vel: .34 }, { t: 11.6, dur: 3.4, midi: 57, vel: .3 }
    ];
    const bass = layer(main, 'tone', { name: '配乐 · 低音脉冲', instrument: 'bass', volume: 52 });
    bass.tone.notes = [];
    for (let i = 0; i < 24; i++) bass.tone.notes.push({ t: .4 + i * .62, dur: .5, midi: i < 4 ? 33 : i < 9 ? 36 : i < 14 ? 29 : i < 19 ? 31 : 33, vel: i % 4 === 0 ? .8 : .5 });
    const arp = layer(main, 'tone', { name: '配乐 · 拨弦星纹', instrument: 'pluck', volume: 36 });
    const arpScale = [69, 72, 76, 79, 81, 84, 79, 76];
    arp.tone.notes = [];
    for (let i = 0; i < 37; i++) {
      const t = 2.2 + i * .325;
      arp.tone.notes.push({ t, dur: .22, midi: arpScale[i % arpScale.length] - (i > 18 ? 12 : 0), vel: .35 + (i % 4 === 0 ? .3 : 0) });
    }
    const shimmer = layer(main, 'tone', { name: '配乐 · 高频闪烁', instrument: 'shimmer', volume: 22 });
    shimmer.tone.notes = [
      { t: 5.6, dur: 1.2, midi: 84, vel: .3 }, { t: 6.7, dur: .8, midi: 88, vel: .25 }, { t: 8.9, dur: 1.5, midi: 91, vel: .3 }, { t: 12, dur: 2, midi: 88, vel: .22 }, { t: 13.8, dur: 1.2, midi: 96, vel: .18 }
    ];
    const whoosh = layer(main, 'tone', { name: '音效 · 转场风', instrument: 'whoosh', volume: 44 });
    whoosh.tone.notes = [{ t: 2.0, dur: .8, midi: 45, vel: .7 }, { t: 5.0, dur: .9, midi: 50, vel: .8 }, { t: 8.4, dur: 1.0, midi: 55, vel: .7 }, { t: 11.1, dur: 1.1, midi: 48, vel: .65 }];
    const impacts = layer(main, 'tone', { name: '音效 · 重音', instrument: 'impact', volume: 62 });
    impacts.tone.notes = [{ t: .1, dur: 1.6, midi: 28, vel: .9 }, { t: 5.4, dur: 1.8, midi: 33, vel: .8 }, { t: 8.8, dur: 2.0, midi: 36, vel: .85 }, { t: 11.6, dur: 2.2, midi: 33, vel: .9 }, { t: 14.1, dur: 2.4, midi: 24, vel: .7 }];

    // active camera / comp settings
    main.activeCamera = cam.id;
    main.params = [];
    // assistant layers (camera / light / field / audio / tone / null) live below the visual stack
    const helperTypes = new Set(['camera', 'light', 'field', 'audio', 'tone', 'null']);
    const helpers = main.layers.filter(l => helperTypes.has(l.type));
    const visuals = main.layers.filter(l => !helperTypes.has(l.type));
    main.layers = helpers.concat(visuals);
    const noPick = new Set(['深空背景', '大气辉光', '核心辉光', '暖调 · 叠加', '暗角 · 正片叠底', '光晕 · 上层', '遮罩 · 扫光', '遮罩源 · 亮度渐变', 'HUD · 路径形变']);
    for (const l of main.layers) if (noPick.has(l.name)) l.pickable = false;
    project.name = '星核 · NOVA CORE';
    project.demoCompId = main.id;
    project._demoMain = main.id;
    project._titleComp = title.id;
    return project;
  };

  D.get = function (project) {
    return project.comps.find(c => c.id === project._demoMain) || project.comps[0];
  };
})();
