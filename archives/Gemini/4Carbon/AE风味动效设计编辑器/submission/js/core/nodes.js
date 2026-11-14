/**
 * Forge Studio — Procedural Node Graph Engine (Section 2.7)
 * Typed ports (Scalar, Vector, Color, Geometry, Field), Branching to Display/Deform/Emit/Collide,
 * Live Result Inspection, and Subgraph Group Encapsulation!
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, hashCombine, hashString, mulberry32, Vec2, Vec3, Mat4, uid } = Forge.Math;
  const Geo2D = Forge.Geo2D;
  const Geo3D = Forge.Geo3D;
  const Fonts = Forge.Fonts;
  const Anim = Forge.Anim;

  const PORT_TYPES = {
    scalar:   { id: 'scalar',   label: '标量', color: '#38bdf8' },
    vector:   { id: 'vector',   label: '向量', color: '#a855f7' },
    color:    { id: 'color',    label: '颜色', color: '#facc15' },
    geometry: { id: 'geometry', label: '几何', color: '#10b981' },
    field:    { id: 'field',    label: '空间场', color: '#f97316' }
  };

  function canConnectPorts(fromType, toType) {
    if (fromType === toType) return true;
    if (fromType === 'scalar' && toType === 'vector') return true;
    return false;
  }

  // Unified Geometry Payload Helper
  function makeGeoFromContours(contours) {
    const list = Geo2D.cloneContours(contours || []);
    let vCount = 0;
    for (const c of list) vCount += c.vertices.length;
    return {
      kind: 'contours',
      contours: list,
      mesh3d: null,
      bounds2d: Geo2D.computeContoursBounds(list),
      summary: `${list.length} 轮廓 / ${vCount} 控制点`
    };
  }

  function makeGeoFromMesh3D(mesh, sourceContours = null) {
    const m = mesh || Geo3D.mergeMeshes3D([]);
    const vc = m.positions ? m.positions.length / 3 : 0;
    const tc = m.indices ? m.indices.length / 3 : 0;
    return {
      kind: 'mesh3d',
      contours: sourceContours ? Geo2D.cloneContours(sourceContours) : [],
      mesh3d: m,
      summary: `${vc} 顶点 / ${tc} 三角面`
    };
  }

  function ensureMesh3DFromGeo(geo, defaultDepth = 0) {
    if (!geo) return Geo3D.mergeMeshes3D([]);
    if (geo.mesh3d && geo.mesh3d.positions.length > 0) return geo.mesh3d;
    if (geo.contours && geo.contours.length > 0) {
      if (defaultDepth > 0.1) {
        return Geo3D.extrudeContours3D(geo.contours, {
          extrudeDepth: defaultDepth,
          bevelDepth: Math.min(4, defaultDepth * 0.12),
          bevelWidth: Math.min(4, defaultDepth * 0.12),
          bevelSegments: 2,
          tessMaxEdge: 18
        });
      }
      // Flat 2D triangulated mesh in Z=0 plane
      const tri = Geo2D.triangulateContours(geo.contours, { flattenTol: 0.6, refineMaxEdge: 20 });
      const vc = tri.vertices.length;
      const positions = new Float32Array(vc * 3);
      const normals = new Float32Array(vc * 3);
      const uvs = new Float32Array(vc * 2);
      const b = Geo2D.computeContoursBounds(geo.contours);
      for (let i = 0; i < vc; i++) {
        positions[i * 3] = tri.vertices[i][0];
        positions[i * 3 + 1] = tri.vertices[i][1];
        positions[i * 3 + 2] = 0;
        normals[i * 3 + 2] = -1;
        uvs[i * 2] = (tri.vertices[i][0] - b.minX) / Math.max(1, b.width);
        uvs[i * 2 + 1] = (tri.vertices[i][1] - b.minY) / Math.max(1, b.height);
      }
      return {
        positions,
        normals,
        uvs,
        indices: tri.indices,
        bounds: Geo3D.computeMeshBounds(positions)
      };
    }
    return Geo3D.mergeMeshes3D([]);
  }

  // Node Definitions Registry
  const NODE_DEFS = {
    layer_geo_in: {
      type: 'layer_geo_in',
      title: '图层几何输入',
      category: '输入',
      inputs: [],
      outputs: [{ id: 'geo', name: '几何轮廓/实体', type: 'geometry', desc: '读取指定文字或形状图层的实时几何' }],
      createParams: () => ({
        sourceLayerId: '',
        useStrokes: false
      })
    },
    text_geo: {
      type: 'text_geo',
      title: '文字生成几何',
      category: '输入',
      inputs: [
        { id: 'size', name: '字号', type: 'scalar', desc: '驱动文字几何尺寸' }
      ],
      outputs: [{ id: 'geo', name: '字形几何', type: 'geometry', desc: '生成的闭合字形轮廓（含孔洞）' }],
      createParams: () => ({
        text: '锻',
        fontFamily: 'forge_heavy',
        fontSize: Anim.createProp(180, 'scalar', { min: 16, max: 600, label: '字号' }),
        tracking: Anim.createProp(0, 'scalar', { min: -30, max: 100, label: '字距' })
      })
    },
    prim_2d: {
      type: 'prim_2d',
      title: '二维图元生成',
      category: '生成',
      inputs: [
        { id: 'size', name: '尺寸向量', type: 'vector', desc: '图元宽高覆盖' }
      ],
      outputs: [{ id: 'geo', name: '轮廓几何', type: 'geometry', desc: '二维闭合路径轮廓' }],
      createParams: () => ({
        shapeType: 'star', // 'rect' | 'ellipse' | 'star' | 'ring'
        width: Anim.createProp(180, 'scalar', { min: 4, max: 1000, label: '宽度' }),
        height: Anim.createProp(180, 'scalar', { min: 4, max: 1000, label: '高度' }),
        points: Anim.createProp(6, 'scalar', { min: 3, max: 24, label: '角数' }),
        roundness: Anim.createProp(12, 'scalar', { min: 0, max: 200, label: '圆角/内径' })
      })
    },
    prim_3d: {
      type: 'prim_3d',
      title: '三维图元生成',
      category: '生成',
      inputs: [
        { id: 'scale', name: '尺寸缩放', type: 'scalar', desc: '整体尺寸倍率' }
      ],
      outputs: [{ id: 'geo', name: '三维网格', type: 'geometry', desc: '三维实体三角网格' }],
      createParams: () => ({
        meshType: 'box', // 'box' | 'sphere' | 'plane' | 'anvil' | 'hammer'
        sizeX: Anim.createProp(140, 'scalar', { min: 5, max: 1200, label: '宽 X' }),
        sizeY: Anim.createProp(140, 'scalar', { min: 5, max: 1200, label: '高 Y' }),
        sizeZ: Anim.createProp(140, 'scalar', { min: 5, max: 1200, label: '深 Z' })
      })
    },
    scalar_math: {
      type: 'scalar_math',
      title: '标量 / 时间参数',
      category: '参数',
      inputs: [{ id: 'inA', name: '输入标量', type: 'scalar', desc: '可选上游标量输入' }],
      outputs: [{ id: 'val', name: '标量值', type: 'scalar', desc: '计算后的标量数值' }],
      createParams: () => ({
        mode: 'value', // 'value' | 'add' | 'mul' | 'sin_time'
        value: Anim.createProp(48, 'scalar', { min: -1000, max: 1000, label: '数值' }),
        factor: Anim.createProp(1, 'scalar', { min: -50, max: 50, label: '系数' })
      })
    },
    vector_val: {
      type: 'vector_val',
      title: '三维向量参数',
      category: '参数',
      inputs: [],
      outputs: [{ id: 'vec', name: '向量', type: 'vector', desc: '三维向量 [X, Y, Z]' }],
      createParams: () => ({
        vec: Anim.createProp([0, 0, 0], 'vec3', { label: '向量 XYZ' })
      })
    },
    color_val: {
      type: 'color_val',
      title: '颜色参数',
      category: '参数',
      inputs: [],
      outputs: [{ id: 'col', name: '颜色', type: 'color', desc: 'RGBA 颜色输出' }],
      createParams: () => ({
        color: Anim.createProp([1.0, 0.48, 0.12], 'color', { label: '颜色' })
      })
    },
    boolean_2d: {
      type: 'boolean_2d',
      title: '轮廓布尔运算',
      category: '处理',
      inputs: [
        { id: 'geoA', name: '主几何 A', type: 'geometry', desc: '布尔被操作几何轮廓' },
        { id: 'geoB', name: '次几何 B', type: 'geometry', desc: '布尔裁剪几何轮廓' }
      ],
      outputs: [{ id: 'geo', name: '布尔结果', type: 'geometry', desc: '并集/差集/交集后的多轮廓几何' }],
      createParams: () => ({
        op: 'subtract' // 'union' | 'subtract' | 'intersect'
      })
    },
    extrude_3d: {
      type: 'extrude_3d',
      title: '三维挤出实体',
      category: '生成',
      inputs: [
        { id: 'geo', name: '二维轮廓', type: 'geometry', desc: '待挤出的闭合路径或文字轮廓' },
        { id: 'depth', name: '挤出深度', type: 'scalar', desc: '覆盖挤出厚度' },
        { id: 'bevel', name: '倒角尺寸', type: 'scalar', desc: '覆盖倒角深度与宽度' }
      ],
      outputs: [{ id: 'mesh', name: '挤出实体', type: 'geometry', desc: '含前后盖、倒角、孔洞与法线的三维网格' }],
      createParams: () => ({
        depth: Anim.createProp(54, 'scalar', { min: 0.5, max: 400, label: '挤出深度' }),
        bevelDepth: Anim.createProp(6, 'scalar', { min: 0, max: 50, label: '倒角深度' }),
        bevelWidth: Anim.createProp(5.5, 'scalar', { min: 0, max: 50, label: '倒角宽度' }),
        bevelSegments: 2,
        align: 'back' // 'center' | 'back'
      })
    },
    triangulate_2d: {
      type: 'triangulate_2d',
      title: '轮廓三角网格化',
      category: '处理',
      inputs: [
        { id: 'geo', name: '二维轮廓', type: 'geometry', desc: '含凹部和孔洞的轮廓输入' }
      ],
      outputs: [{ id: 'mesh', name: '三角网格', type: 'geometry', desc: '细分后的可变形三角网格' }],
      createParams: () => ({
        maxEdge: Anim.createProp(20, 'scalar', { min: 6, max: 120, label: '网格边长' })
      })
    },
    transform_geo: {
      type: 'transform_geo',
      title: '几何空间变换',
      category: '处理',
      inputs: [
        { id: 'geo', name: '输入几何', type: 'geometry', desc: '二维轮廓或三维网格' },
        { id: 'translate', name: '位移', type: 'vector', desc: '附加平移向量' },
        { id: 'rotate', name: '旋转', type: 'vector', desc: '附加欧拉角旋转' }
      ],
      outputs: [{ id: 'geo', name: '变换后几何', type: 'geometry', desc: '变换后的实际几何顶点' }],
      createParams: () => ({
        translate: Anim.createProp([0, 0, 0], 'vec3', { label: '平移' }),
        rotate: Anim.createProp([0, 0, 0], 'vec3', { label: '旋转' }),
        scale: Anim.createProp([100, 100, 100], 'vec3', { label: '缩放%' })
      })
    },
    scatter_distribute: {
      type: 'scatter_distribute',
      title: '表面/曲线分布实例化',
      category: '生成',
      inputs: [
        { id: 'surface', name: '分布载体几何', type: 'geometry', desc: '在其表面或曲线上采样分布点' },
        { id: 'instance', name: '实例几何(可选)', type: 'geometry', desc: '复制到每个分布点的图元网格' },
        { id: 'count', name: '数量', type: 'scalar', desc: '实例分布数量' }
      ],
      outputs: [{ id: 'geo', name: '分布合并几何', type: 'geometry', desc: '实例化生成的复合三维网格' }],
      createParams: () => ({
        count: Anim.createProp(18, 'scalar', { min: 1, max: 200, label: '分布数量' }),
        instanceScale: Anim.createProp(12, 'scalar', { min: 1, max: 150, label: '实例大小' }),
        seed: 77
      })
    },
    merge_geo: {
      type: 'merge_geo',
      title: '几何合并',
      category: '处理',
      inputs: [
        { id: 'geoA', name: '几何 A', type: 'geometry', desc: '第一个几何输入' },
        { id: 'geoB', name: '几何 B', type: 'geometry', desc: '第二个几何输入' }
      ],
      outputs: [{ id: 'geo', name: '合并几何', type: 'geometry', desc: '合并后的统一几何' }],
      createParams: () => ({})
    },
    field_source: {
      type: 'field_source',
      title: '空间场源',
      category: '场与变形',
      inputs: [
        { id: 'center', name: '场中心', type: 'vector', desc: '覆盖空间场中心坐标' },
        { id: 'strength', name: '场强度', type: 'scalar', desc: '覆盖空间场强度' }
      ],
      outputs: [{ id: 'field', name: '空间场', type: 'field', desc: '可同时驱动几何变形与粒子运动的空间场' }],
      createParams: () => ({
        sourceLayerId: '', // If set, reads live Field Layer from comp; else uses node's own field params!
        fieldType: 'radial', // 'radial' | 'noise' | 'vortex'
        radialMode: 'dent',  // 'push' | 'directional' | 'dent'
        center: Anim.createProp([960, 500, -25], 'vec3', { label: '中心位置' }),
        direction: Anim.createProp([0, 6, 10], 'vec3', { label: '作用方向' }),
        innerRadius: Anim.createProp(35, 'scalar', { min: 0, max: 800, label: '内半径' }),
        outerRadius: Anim.createProp(190, 'scalar', { min: 5, max: 1500, label: '外衰减半径' }),
        strength: Anim.createProp(0, 'scalar', { min: -300, max: 300, label: '场强度' }),
        frequency: Anim.createProp(0.015, 'scalar', { min: 0.001, max: 0.2, label: '噪波频率' })
      })
    },
    field_blend: {
      type: 'field_blend',
      title: '空间场混合',
      category: '场与变形',
      inputs: [
        { id: 'fieldA', name: '空间场 A', type: 'field', desc: '基础空间场' },
        { id: 'fieldB', name: '空间场 B', type: 'field', desc: '叠加/遮罩空间场' }
      ],
      outputs: [{ id: 'field', name: '复合场', type: 'field', desc: '混合后的复合空间场列表' }],
      createParams: () => ({
        mixMode: 'add', // 'add' | 'multiply' | 'subtract'
        weightB: Anim.createProp(1.0, 'scalar', { min: 0, max: 5, label: 'B 权重' })
      })
    },
    deform_3d: {
      type: 'deform_3d',
      title: '弯曲/扭转/场变形',
      category: '场与变形',
      inputs: [
        { id: 'geo', name: '输入几何', type: 'geometry', desc: '待变形的三维实体或网格' },
        { id: 'field', name: '空间场驱动', type: 'field', desc: '作用于顶点的空间场' },
        { id: 'amount', name: '场变形权重', type: 'scalar', desc: '场位移倍增系数' }
      ],
      outputs: [{ id: 'geo', name: '变形后几何', type: 'geometry', desc: '已重算法线的变形几何，可继续显示/发射/碰撞' }],
      createParams: () => ({
        bendAngle: Anim.createProp(0, 'scalar', { min: -180, max: 180, label: '弯曲角度' }),
        bendAxis: 'x',
        twistAngle: Anim.createProp(0, 'scalar', { min: -360, max: 360, label: '扭转角度' }),
        twistAxis: 'y',
        fieldAmount: Anim.createProp(1.0, 'scalar', { min: -5, max: 5, label: '场强度倍率' })
      })
    },
    output_display: {
      type: 'output_display',
      title: '几何渲染显示 (使用者)',
      category: '输出与使用者',
      inputs: [
        { id: 'geo', name: '显示几何', type: 'geometry', desc: '输出到三维场景渲染的几何体' },
        { id: 'color', name: '材质颜色(可选)', type: 'color', desc: '动态覆盖基础色/发光倾向' }
      ],
      outputs: [],
      createParams: () => ({
        targetLayerId: '', // Binds output geometry to a 3D Node-Geometry Layer in the comp (or renders directly!)
        enabled: true
      })
    },
    consumer_emitter: {
      type: 'consumer_emitter',
      title: '粒子表面发射源 (使用者)',
      category: '输出与使用者',
      inputs: [
        { id: 'geo', name: '发射源几何', type: 'geometry', desc: '粒子直接从该变形几何表面按法线发射' },
        { id: 'field', name: '粒子力场(可选)', type: 'field', desc: '驱动粒子运动的空间场' }
      ],
      outputs: [],
      createParams: () => ({
        targetLayerId: '' // Particle layer ID receiving this live geometry & field!
      })
    },
    consumer_collider: {
      type: 'consumer_collider',
      title: '粒子碰撞表面 (使用者)',
      category: '输出与使用者',
      inputs: [
        { id: 'geo', name: '碰撞体几何', type: 'geometry', desc: '粒子与该实时几何表面发生反弹与摩擦碰撞' }
      ],
      outputs: [],
      createParams: () => ({
        targetLayerId: '', // Particle layer ID using this collider (empty = available to all particle layers referencing node!)
        bounce: Anim.createProp(0.48, 'scalar', { min: 0, max: 1, label: '反弹系数' }),
        friction: Anim.createProp(0.22, 'scalar', { min: 0, max: 1, label: '摩擦系数' })
      })
    },
    group: {
      type: 'group',
      title: '封装节点组',
      category: '节点组',
      inputs: [],
      outputs: [],
      createParams: () => ({
        subgraph: { nodes: [], edges: [] },
        exposedInputs: [],
        exposedOutputs: []
      })
    }
  };

  function createNode(type, x = 120, y = 120, customName = '') {
    const def = NODE_DEFS[type];
    if (!def) throw new Error(`未知节点类型: ${type}`);
    return {
      id: uid('nd'),
      type,
      title: customName || def.title,
      x,
      y,
      inputs: def.inputs.map((p) => ({ ...p })),
      outputs: def.outputs.map((p) => ({ ...p })),
      params: def.createParams()
    };
  }

  function getNodePorts(node) {
    if (node.type === 'group') {
      return {
        inputs: node.inputs || [],
        outputs: node.outputs || []
      };
    }
    const def = NODE_DEFS[node.type];
    return {
      inputs: def ? def.inputs : (node.inputs || []),
      outputs: def ? def.outputs : (node.outputs || [])
    };
  }

  // Extract contours or mesh from a scene layer (used by `layer_geo_in` node)
  function extractLayerBaseGeometry(layer, t, comp, project, useStrokes = false) {
    if (!layer) return makeGeoFromContours([]);
    const ctx = { project, comp, layer };

    if (layer.type === 'text' && layer.textData) {
      const td = layer.textData;
      const fontSize = Anim.evalProp(td.fontSize, t, { ...ctx, propKey: 'text.fontSize' });
      const lineHeight = Anim.evalProp(td.lineHeight, t, { ...ctx, propKey: 'text.lineHeight' });
      const tracking = Anim.evalProp(td.tracking, t, { ...ctx, propKey: 'text.tracking' });
      const evalAnims = (td.animators || []).map((a, idx) => ({
        enabled: a.enabled !== false,
        basedOn: a.basedOn || 'chars',
        start: Anim.evalProp(a.start, t, { ...ctx, propKey: `anim${idx}.start` }),
        end: Anim.evalProp(a.end, t, { ...ctx, propKey: `anim${idx}.end` }),
        offset: Anim.evalProp(a.offset, t, { ...ctx, propKey: `anim${idx}.offset` }),
        smoothness: Anim.evalProp(a.smoothness, t, { ...ctx, propKey: `anim${idx}.smoothness` }),
        position: Anim.evalProp(a.position, t, { ...ctx, propKey: `anim${idx}.position` }),
        rotation: Anim.evalProp(a.rotation, t, { ...ctx, propKey: `anim${idx}.rotation` }),
        scale: Anim.evalProp(a.scale, t, { ...ctx, propKey: `anim${idx}.scale` }),
        opacity: Anim.evalProp(a.opacity, t, { ...ctx, propKey: `anim${idx}.opacity` })
      }));
      const layout = Fonts.layoutTextGlyphs({
        text: td.text,
        fontFamily: td.fontFamily || 'forge_heavy',
        fontSize,
        lineHeight,
        align: td.align || 'center',
        tracking,
        animators: evalAnims,
        mode: useStrokes ? 'strokes' : 'contours'
      });
      let contours = layout.contours;
      if (layer.puppetPins && layer.puppetPins.length > 0) {
        const evalPins = layer.puppetPins.map((pin, pi) => ({
          restPos: pin.restPos,
          position: Anim.evalProp(pin.position, t, { ...ctx, propKey: `pin${pi}.pos` }),
          rotation: Anim.evalProp(pin.rotation, t, { ...ctx, propKey: `pin${pi}.rot` }),
          scale: Anim.evalProp(pin.scale, t, { ...ctx, propKey: `pin${pi}.scale` })
        }));
        contours = Geo2D.deformContoursWithPins(contours, evalPins);
      }
      return makeGeoFromContours(contours);
    }

    if (layer.type === 'shape' && Forge.SceneEval && Forge.SceneEval.evalShapeLayerContours) {
      const res = Forge.SceneEval.evalShapeLayerContours(layer, t, comp, project);
      return makeGeoFromContours(res.contours);
    }

    if (layer.type === 'solid3d' && layer.solidData) {
      const sd = layer.solidData;
      const sx = Anim.evalProp(sd.sizeX, t, { ...ctx, propKey: 'sizeX' });
      const sy = Anim.evalProp(sd.sizeY, t, { ...ctx, propKey: 'sizeY' });
      const sz = Anim.evalProp(sd.sizeZ, t, { ...ctx, propKey: 'sizeZ' });
      let m;
      if (sd.primitive === 'anvil') m = Geo3D.createAnvilMesh(sx, sy, sz);
      else if (sd.primitive === 'hammer') m = Geo3D.createHammerMesh(sx, sy, sz, sy * 3.1);
      else if (sd.primitive === 'sphere') m = Geo3D.createSphereMesh(sx * 0.5);
      else if (sd.primitive === 'plane') m = Geo3D.createPlaneMesh(sx, sy, 16, 16);
      else m = Geo3D.createBoxMesh(sx, sy, sz, 5);
      return makeGeoFromMesh3D(m);
    }

    return makeGeoFromContours([]);
  }

  // Evaluate a single Field Layer from the composition
  function evalFieldLayerObject(fieldLayer, t, comp, project) {
    if (!fieldLayer || !fieldLayer.field || fieldLayer.visible === false) return null;
    const fd = fieldLayer.field;
    const ctx = { project, comp, layer: fieldLayer };
    const worldM = Anim.getLayerWorldMatrix(fieldLayer, t, comp, project);
    const worldCenter = Mat4.transformPoint(worldM, [0, 0, 0]);
    const dirLocal = fd.direction ? Anim.evalProp(fd.direction, t, { ...ctx, propKey: 'field.dir' }) : [0, 0, 1];
    const worldDir = Vec3.norm(Mat4.transformDir(worldM, dirLocal));

    return {
      id: fieldLayer.id,
      name: fieldLayer.name,
      enabled: t >= (fieldLayer.inPoint ?? 0) && t <= (fieldLayer.outPoint ?? comp.duration),
      fieldType: fd.fieldType || 'radial',
      radialMode: fd.radialMode || 'push',
      mixMode: fd.mixMode || 'add',
      weight: fd.weight ? Anim.evalProp(fd.weight, t, { ...ctx, propKey: 'field.weight' }) : 1,
      center: worldCenter,
      direction: worldDir,
      axis: worldDir,
      innerRadius: Anim.evalProp(fd.innerRadius, t, { ...ctx, propKey: 'field.innerR' }),
      outerRadius: Anim.evalProp(fd.outerRadius, t, { ...ctx, propKey: 'field.outerR' }),
      strength: Anim.evalProp(fd.strength, t, { ...ctx, propKey: 'field.strength' }),
      frequency: fd.frequency ? Anim.evalProp(fd.frequency, t, { ...ctx, propKey: 'field.freq' }) : 0.015,
      evolutionSpeed: fd.evolutionSpeed ?? 0.9,
      radialPull: fd.radialPull ? Anim.evalProp(fd.radialPull, t, { ...ctx, propKey: 'field.pull' }) : 0,
      seed: fd.seed ?? 42
    };
  }

  function formatPortValueSummary(type, val) {
    if (val === undefined || val === null) return '未连接';
    if (type === 'scalar') return Number(val).toFixed(2);
    if (type === 'vector') {
      return Array.isArray(val) ? `[${val.map((n) => Number(n).toFixed(1)).join(', ')}]` : String(val);
    }
    if (type === 'color') {
      return Array.isArray(val)
        ? `RGB(${val.slice(0, 3).map((n) => Math.round(clamp(n, 0, 1) * 255)).join(',')})`
        : String(val);
    }
    if (type === 'geometry') return val.summary || '几何对象';
    if (type === 'field') return Array.isArray(val) ? `${val.length} 个活动场` : '空间场';
    return String(val);
  }

  // Evaluate entire Node Graph (or Subgraph) deterministically at time t!
  function evaluateNodeGraph(graph, t, comp, project, externalInputs = null) {
    if (!graph || !graph.nodes) {
      return { nodeResults: new Map(), displays: [], emitters: [], colliders: [] };
    }

    const nodesById = new Map();
    for (const n of graph.nodes) nodesById.set(n.id, n);

    // Map incoming edge per (toNode, toPort)
    const incomingMap = new Map();
    for (const e of (graph.edges || [])) {
      incomingMap.set(`${e.toNode}:${e.toPort}`, e);
    }

    const memo = new Map();
    const visiting = new Set();

    function evalNode(nodeId) {
      if (memo.has(nodeId)) return memo.get(nodeId);
      const node = nodesById.get(nodeId);
      if (!node) return {};
      if (visiting.has(nodeId)) {
        return { _error: '节点连接存在循环' };
      }
      visiting.add(nodeId);

      // Gather evaluated inputs
      const inVals = {};
      const { inputs } = getNodePorts(node);
      for (const port of inputs) {
        const edge = incomingMap.get(`${node.id}:${port.id}`);
        if (edge) {
          const upOut = evalNode(edge.fromNode);
          let v = upOut ? upOut[edge.fromPort] : undefined;
          if (v !== undefined && port.type === 'vector' && typeof v === 'number') {
            v = [v, v, v];
          }
          inVals[port.id] = v;
        } else if (externalInputs && port.id in externalInputs) {
          inVals[port.id] = externalInputs[port.id];
        }
      }

      const p = node.params || {};
      const ctx = { project, comp, layer: { id: node.id, name: node.title } };
      const ep = (prop, key) => (prop && prop.type ? Anim.evalProp(prop, t, { ...ctx, propKey: key }) : prop);

      const out = {};
      let summary = '';

      switch (node.type) {
        case 'layer_geo_in': {
          const targetLayer = comp && comp.layers
            ? comp.layers.find((l) => l.id === p.sourceLayerId || l.name === p.sourceLayerId)
            : null;
          const geo = extractLayerBaseGeometry(targetLayer, t, comp, project, !!p.useStrokes);
          out.geo = geo;
          summary = targetLayer ? `源: ${targetLayer.name} (${geo.summary})` : '未绑定源图层';
          break;
        }
        case 'text_geo': {
          const sz = inVals.size !== undefined ? Number(inVals.size) : ep(p.fontSize, 'fontSize');
          const trk = ep(p.tracking, 'tracking') || 0;
          const layout = Fonts.layoutTextGlyphs({
            text: p.text || '锻',
            fontFamily: p.fontFamily || 'forge_heavy',
            fontSize: Math.max(12, sz),
            tracking: trk,
            mode: 'contours'
          });
          out.geo = makeGeoFromContours(layout.contours);
          summary = `"${(p.text || '').slice(0, 4)}" (${out.geo.summary})`;
          break;
        }
        case 'prim_2d': {
          const w = inVals.size ? inVals.size[0] : ep(p.width, 'width');
          const h = inVals.size ? inVals.size[1] : ep(p.height, 'height');
          const rnd = ep(p.roundness, 'roundness');
          const pts = ep(p.points, 'points');
          let contours = [];
          if (p.shapeType === 'ellipse') {
            contours = [Geo2D.ellipseContour(0, 0, w * 0.5, h * 0.5)];
          } else if (p.shapeType === 'star') {
            contours = [Geo2D.starContour(0, 0, pts, w * 0.5, Math.max(8, rnd), 0)];
          } else if (p.shapeType === 'ring') {
            const outer = Geo2D.ellipseContour(0, 0, w * 0.5, h * 0.5);
            const inner = Geo2D.reverseContour(
              Geo2D.ellipseContour(0, 0, Math.max(4, w * 0.5 - Math.max(8, rnd)), Math.max(4, h * 0.5 - Math.max(8, rnd)))
            );
            contours = [outer, inner];
          } else {
            contours = [Geo2D.rectContour(0, 0, w, h, rnd)];
          }
          out.geo = makeGeoFromContours(contours);
          summary = `${p.shapeType} (${out.geo.summary})`;
          break;
        }
        case 'prim_3d': {
          const mult = inVals.scale !== undefined ? Math.max(0.05, Number(inVals.scale)) : 1;
          const sx = ep(p.sizeX, 'sizeX') * mult;
          const sy = ep(p.sizeY, 'sizeY') * mult;
          const sz = ep(p.sizeZ, 'sizeZ') * mult;
          let m;
          if (p.meshType === 'sphere') m = Geo3D.createSphereMesh(sx * 0.5);
          else if (p.meshType === 'plane') m = Geo3D.createPlaneMesh(sx, sy, 16, 16);
          else if (p.meshType === 'anvil') m = Geo3D.createAnvilMesh(sx, sy, sz);
          else if (p.meshType === 'hammer') m = Geo3D.createHammerMesh(sx, sy, sz, sy * 3);
          else m = Geo3D.createBoxMesh(sx, sy, sz, 5);
          out.geo = makeGeoFromMesh3D(m);
          summary = `${p.meshType} (${out.geo.summary})`;
          break;
        }
        case 'scalar_math': {
          const base = ep(p.value, 'value');
          const fac = ep(p.factor, 'factor');
          const a = inVals.inA !== undefined ? Number(inVals.inA) : 0;
          let v = base;
          if (p.mode === 'add') v = a + base;
          else if (p.mode === 'mul') v = (inVals.inA !== undefined ? a : 1) * base * fac;
          else if (p.mode === 'sin_time') v = base + Math.sin(t * fac * Math.PI * 2) * (a || 20);
          else if (inVals.inA !== undefined) v = a * fac + base;
          out.val = v;
          summary = `值 = ${v.toFixed(2)}`;
          break;
        }
        case 'vector_val': {
          out.vec = ep(p.vec, 'vec');
          summary = formatPortValueSummary('vector', out.vec);
          break;
        }
        case 'color_val': {
          out.col = ep(p.color, 'color');
          summary = formatPortValueSummary('color', out.col);
          break;
        }
        case 'boolean_2d': {
          const cA = inVals.geoA?.contours || [];
          const cB = inVals.geoB?.contours || [];
          const res = Geo2D.booleanContours(cA, cB, p.op || 'union');
          out.geo = makeGeoFromContours(res);
          summary = `${p.op} -> ${out.geo.summary}`;
          break;
        }
        case 'extrude_3d': {
          const inGeo = inVals.geo;
          const depth = inVals.depth !== undefined ? Number(inVals.depth) : ep(p.depth, 'depth');
          const bevD = inVals.bevel !== undefined ? Number(inVals.bevel) : ep(p.bevelDepth, 'bevelDepth');
          const bevW = inVals.bevel !== undefined ? Number(inVals.bevel) : ep(p.bevelWidth, 'bevelWidth');
          const contours = inGeo?.contours || [];
          const mesh = Geo3D.extrudeContours3D(contours, {
            extrudeDepth: Math.max(0.2, depth),
            bevelDepth: Math.max(0, bevD),
            bevelWidth: Math.max(0, bevW),
            bevelSegments: p.bevelSegments ?? 2,
            extrudeAlign: p.align || 'center',
            tessMaxEdge: 18
          });
          out.mesh = makeGeoFromMesh3D(mesh, contours);
          summary = `深 ${depth.toFixed(1)} | ${out.mesh.summary}`;
          break;
        }
        case 'triangulate_2d': {
          const contours = inVals.geo?.contours || [];
          const maxE = Math.max(6, ep(p.maxEdge, 'maxEdge') || 20);
          const tri = Geo2D.triangulateContours(contours, { flattenTol: 0.55, refineMaxEdge: maxE });
          const vc = tri.vertices.length;
          const positions = new Float32Array(vc * 3);
          const normals = new Float32Array(vc * 3);
          const uvs = new Float32Array(vc * 2);
          const b = Geo2D.computeContoursBounds(contours);
          for (let i = 0; i < vc; i++) {
            positions[i * 3] = tri.vertices[i][0];
            positions[i * 3 + 1] = tri.vertices[i][1];
            normals[i * 3 + 2] = -1;
            uvs[i * 2] = (tri.vertices[i][0] - b.minX) / Math.max(1, b.width);
            uvs[i * 2 + 1] = (tri.vertices[i][1] - b.minY) / Math.max(1, b.height);
          }
          out.mesh = makeGeoFromMesh3D({
            positions, normals, uvs, indices: tri.indices,
            bounds: Geo3D.computeMeshBounds(positions)
          }, contours);
          summary = out.mesh.summary;
          break;
        }
        case 'transform_geo': {
          const src = inVals.geo;
          const tr = inVals.translate || ep(p.translate, 'translate') || [0, 0, 0];
          const rt = inVals.rotate || ep(p.rotate, 'rotate') || [0, 0, 0];
          const sc = ep(p.scale, 'scale') || [100, 100, 100];
          if (!src) {
            out.geo = makeGeoFromContours([]);
          } else if (src.kind === 'contours' && Math.abs(tr[2] || 0) < 1e-4 && Math.abs(rt[0] || 0) < 1e-4 && Math.abs(rt[1] || 0) < 1e-4) {
            const moved = src.contours.map((c) =>
              Geo2D.transformContour2D(c, {
                anchor: [0, 0],
                position: [tr[0], tr[1]],
                scale: [sc[0], sc[1]],
                rotation: rt[2] || 0
              })
            );
            out.geo = makeGeoFromContours(moved);
          } else {
            const m = ensureMesh3DFromGeo(src, 0);
            const mat = Mat4.fromLayerTransform(tr, rt, sc, [0, 0, 0]);
            out.geo = makeGeoFromMesh3D(Geo3D.transformMesh3D(m, mat), src.contours);
          }
          summary = out.geo.summary;
          break;
        }
        case 'scatter_distribute': {
          const surf = inVals.surface;
          const count = clamp(Math.round(inVals.count !== undefined ? inVals.count : ep(p.count, 'count')), 1, 200);
          const instScale = Math.max(1, ep(p.instanceScale, 'instanceScale') || 12);
          const baseInst = inVals.instance
            ? ensureMesh3DFromGeo(inVals.instance, 8)
            : Geo3D.createBoxMesh(instScale, instScale, instScale, 1.5);
          const rng = mulberry32(hashCombine(p.seed || 77, count));
          const copies = [];

          if (surf && surf.mesh3d && surf.mesh3d.indices.length >= 3) {
            const pos = surf.mesh3d.positions;
            const idx = surf.mesh3d.indices;
            const triCount = idx.length / 3;
            for (let i = 0; i < count; i++) {
              const ti = Math.floor(rng() * triCount) * 3;
              const i0 = idx[ti] * 3, i1 = idx[ti + 1] * 3, i2 = idx[ti + 2] * 3;
              let u = rng(), v = rng();
              if (u + v > 1) { u = 1 - u; v = 1 - v; }
              const w = 1 - u - v;
              const px = pos[i0] * w + pos[i1] * u + pos[i2] * v;
              const py = pos[i0 + 1] * w + pos[i1 + 1] * u + pos[i2 + 1] * v;
              const pz = pos[i0 + 2] * w + pos[i1 + 2] * u + pos[i2 + 2] * v;
              const s = inVals.instance ? instScale / 20 : 1;
              copies.push(Geo3D.transformMesh3D(baseInst, Mat4.fromLayerTransform([px, py, pz], [0, 0, rng() * 360], [s * 100, s * 100, s * 100], [0, 0, 0])));
            }
          } else if (surf && surf.contours && surf.contours.length > 0) {
            const luts = surf.contours.map((c) => Geo2D.buildContourArcLUT(c));
            const tot = luts.reduce((a, l) => a + l.totalLength, 0);
            if (tot > 1e-3) {
              for (let i = 0; i < count; i++) {
                let d = ((i + 0.5) / count) * tot;
                let chosen = luts[0];
                for (const l of luts) {
                  if (d <= l.totalLength) { chosen = l; break; }
                  d -= l.totalLength;
                }
                const smp = Geo2D.sampleArcLUT(chosen, d);
                const s = inVals.instance ? instScale / 20 : 1;
                copies.push(Geo3D.transformMesh3D(baseInst, Mat4.fromLayerTransform([smp.p[0], smp.p[1], 0], [0, 0, Math.atan2(smp.tangent[1], smp.tangent[0]) * (180 / Math.PI)], [s * 100, s * 100, s * 100], [0, 0, 0])));
              }
            }
          }
          out.geo = makeGeoFromMesh3D(Geo3D.mergeMeshes3D(copies));
          summary = `实例 ${copies.length} 个 (${out.geo.summary})`;
          break;
        }
        case 'merge_geo': {
          const gA = inVals.geoA, gB = inVals.geoB;
          if (gA?.kind === 'contours' && gB?.kind === 'contours') {
            out.geo = makeGeoFromContours([...(gA.contours || []), ...(gB.contours || [])]);
          } else {
            const mA = gA ? ensureMesh3DFromGeo(gA, 0) : null;
            const mB = gB ? ensureMesh3DFromGeo(gB, 0) : null;
            out.geo = makeGeoFromMesh3D(Geo3D.mergeMeshes3D([mA, mB].filter(Boolean)));
          }
          summary = out.geo.summary;
          break;
        }
        case 'field_source': {
          let fields = [];
          if (p.sourceLayerId && comp && comp.layers) {
            const fl = comp.layers.find((l) => l.id === p.sourceLayerId || l.name === p.sourceLayerId);
            const fObj = evalFieldLayerObject(fl, t, comp, project);
            if (fObj) fields.push(fObj);
          } else {
            const center = inVals.center || ep(p.center, 'center') || [0, 0, 0];
            const strength = inVals.strength !== undefined ? Number(inVals.strength) : ep(p.strength, 'strength');
            fields.push({
              id: node.id,
              name: node.title,
              enabled: true,
              fieldType: p.fieldType || 'radial',
              radialMode: p.radialMode || 'dent',
              mixMode: 'add',
              weight: 1,
              center,
              direction: ep(p.direction, 'direction') || [0, 0, 1],
              axis: ep(p.direction, 'direction') || [0, 0, 1],
              innerRadius: ep(p.innerRadius, 'innerRadius') || 30,
              outerRadius: ep(p.outerRadius, 'outerRadius') || 180,
              strength,
              frequency: ep(p.frequency, 'frequency') || 0.015,
              evolutionSpeed: 1.0,
              seed: 42
            });
          }
          out.field = fields;
          summary = fields[0] ? `${fields[0].fieldType} 强度=${fields[0].strength.toFixed(1)}` : '无活动场';
          break;
        }
        case 'field_blend': {
          const fA = inVals.fieldA || [];
          const fB = (inVals.fieldB || []).map((f) => ({
            ...f,
            mixMode: p.mixMode || 'add',
            weight: (f.weight ?? 1) * (ep(p.weightB, 'weightB') ?? 1)
          }));
          out.field = [...fA, ...fB];
          summary = `混合 ${out.field.length} 个空间场 (${p.mixMode || 'add'})`;
          break;
        }
        case 'deform_3d': {
          const src = inVals.geo;
          if (!src) {
            out.geo = makeGeoFromMesh3D(Geo3D.mergeMeshes3D([]));
            summary = '等待几何输入';
            break;
          }
          let mesh = ensureMesh3DFromGeo(src, 0);
          const bendAng = ep(p.bendAngle, 'bendAngle') || 0;
          const twistAng = ep(p.twistAngle, 'twistAngle') || 0;
          if (Math.abs(bendAng) > 1e-4 || Math.abs(twistAng) > 1e-4) {
            mesh = Geo3D.applyBendTwistMesh3D(mesh, {
              bendAngle: bendAng,
              bendAxis: p.bendAxis || 'x',
              twistAngle: twistAng,
              twistAxis: p.twistAxis || 'y'
            });
          }
          const fields = inVals.field || [];
          const amt = inVals.amount !== undefined ? Number(inVals.amount) : (ep(p.fieldAmount, 'fieldAmount') ?? 1);
          if (fields.length > 0 && Math.abs(amt) > 1e-5) {
            // Look up target display layer world matrix if bound, else comp center [W/2, H/2, 0]
            let refMat = comp ? Mat4.fromTranslation(comp.width * 0.5, comp.height * 0.5, 0) : null;
            if (comp && comp.layers) {
              const consumer = comp.layers.find((l) => l.nodeOutputId === node.id || (l.type === 'nodeGeo'));
              if (consumer) refMat = Anim.getLayerWorldMatrix(consumer, t, comp, project);
            }
            mesh = Geo3D.applySpatialFieldsToMesh3D(mesh, fields, refMat, t, amt);
          }
          out.geo = makeGeoFromMesh3D(mesh, src.contours);
          summary = `变形 -> ${out.geo.summary}`;
          break;
        }
        case 'output_display': {
          out._display = {
            nodeId: node.id,
            targetLayerId: p.targetLayerId || '',
            geo: inVals.geo || null,
            color: inVals.color || null,
            enabled: p.enabled !== false
          };
          summary = inVals.geo ? `输出渲染: ${inVals.geo.summary}` : '无几何输入';
          break;
        }
        case 'consumer_emitter': {
          out._emitter = {
            nodeId: node.id,
            targetLayerId: p.targetLayerId || '',
            geo: inVals.geo || null,
            fields: inVals.field || []
          };
          summary = inVals.geo ? `发射源已就绪 (${inVals.geo.summary})` : '等待发射几何';
          break;
        }
        case 'consumer_collider': {
          out._collider = {
            nodeId: node.id,
            targetLayerId: p.targetLayerId || '',
            geo: inVals.geo || null,
            bounce: ep(p.bounce, 'bounce') ?? 0.48,
            friction: ep(p.friction, 'friction') ?? 0.22
          };
          summary = inVals.geo ? `碰撞表面已就绪 (${inVals.geo.summary})` : '等待碰撞几何';
          break;
        }
        case 'group': {
          const sub = p.subgraph || { nodes: [], edges: [] };
          const subExtIn = {};
          for (const expIn of (p.exposedInputs || [])) {
            subExtIn[`${expIn.innerNodeId}:${expIn.innerPortId}`] = inVals[expIn.groupPortId];
          }
          // Temporarily inject exposed inputs into inner nodes during subgraph evaluation
          const subRes = evaluateSubgraphWithExposed(sub, t, comp, project, p.exposedInputs || [], inVals);
          for (const expOut of (p.exposedOutputs || [])) {
            const innerRes = subRes.nodeResults.get(expOut.innerNodeId);
            if (innerRes && innerRes.outputs) {
              out[expOut.groupPortId] = innerRes.outputs[expOut.innerPortId];
            }
          }
          summary = `子图 (${sub.nodes.length} 节点)`;
          break;
        }
      }

      visiting.delete(nodeId);

      const portSummaries = {};
      const ports = getNodePorts(node);
      for (const ip of ports.inputs) {
        portSummaries[`in:${ip.id}`] = formatPortValueSummary(ip.type, inVals[ip.id]);
      }
      for (const op of ports.outputs) {
        portSummaries[`out:${op.id}`] = formatPortValueSummary(op.type, out[op.id]);
      }

      const record = { inputs: inVals, outputs: out, summary, portSummaries };
      memo.set(nodeId, out);
      nodeResults.set(nodeId, record);
      return out;
    }

    const nodeResults = new Map();
    const displays = [];
    const emitters = [];
    const colliders = [];

    for (const n of graph.nodes) {
      const out = evalNode(n.id);
      if (out._display && out._display.enabled && out._display.geo) displays.push(out._display);
      if (out._emitter && out._emitter.geo) emitters.push(out._emitter);
      if (out._collider && out._collider.geo) colliders.push(out._collider);
    }

    const result = { nodeResults, displays, emitters, colliders };
    if (comp) comp._lastNodeEval = result;
    return result;
  }

  function evaluateSubgraphWithExposed(subgraph, t, comp, project, exposedInputs, parentInVals) {
    // Clone shallowly with virtual constant pass-through nodes for exposed inputs
    const virtualNodes = [...subgraph.nodes];
    const virtualEdges = [...subgraph.edges];
    for (const exp of exposedInputs) {
      const val = parentInVals[exp.groupPortId];
      if (val === undefined) continue;
      const vId = `__vin_${exp.groupPortId}`;
      virtualNodes.push({
        id: vId,
        type: '__passthrough',
        title: exp.name,
        x: 0, y: 0,
        inputs: [],
        outputs: [{ id: 'out', name: 'out', type: exp.type }],
        params: { val }
      });
      virtualEdges.push({ id: `__ve_${exp.groupPortId}`, fromNode: vId, fromPort: 'out', toNode: exp.innerNodeId, toPort: exp.innerPortId });
    }

    // Add __passthrough temporarily if needed
    if (!NODE_DEFS.__passthrough) {
      NODE_DEFS.__passthrough = {
        type: '__passthrough', title: '输入', category: '内部',
        inputs: [], outputs: [{ id: 'out', name: 'out', type: 'geometry' }],
        createParams: () => ({})
      };
    }

    // Intercept __passthrough in a tiny wrapper:
    const graphCopy = { nodes: virtualNodes, edges: virtualEdges };
    const memo = new Map();
    // Pre-seed __passthrough outputs by evaluating non-passthrough after patching:
    const res = evaluateNodeGraphWithPassthrough(graphCopy, t, comp, project);
    return res;
  }

  function evaluateNodeGraphWithPassthrough(graphCopy, t, comp, project) {
    // Temporarily replace __passthrough nodes by direct edge injection:
    const passValues = new Map();
    const realNodes = [];
    for (const n of graphCopy.nodes) {
      if (n.type === '__passthrough') passValues.set(n.id, n.params.val);
      else realNodes.push(n);
    }
    const realEdges = [];
    const extMap = {};
    for (const e of graphCopy.edges) {
      if (passValues.has(e.fromNode)) {
        extMap[`${e.toNode}:${e.toPort}`] = passValues.get(e.fromNode);
      } else {
        realEdges.push(e);
      }
    }
    // Patch incoming resolution via temporary wrapper nodes isn't even needed if we pass keyed map!
    // Let's handle `${node.id}:${port.id}` in externalInputs:
    const subGraphClean = { nodes: realNodes, edges: realEdges };
    const nodesById = new Map(realNodes.map((n) => [n.id, n]));
    // Reuse evaluateNodeGraph by temporarily adding key lookup:
    const origEdges = subGraphClean.edges;
    // Simple: if extMap has entries, synthesize scalar/vector/geo source or pass directly
    const patchedGraph = {
      nodes: realNodes.map((n) => n),
      edges: origEdges
    };
    // Direct evaluation with port-qualified externalInputs:
    return evaluateNodeGraphInternalScoped(patchedGraph, t, comp, project, extMap);
  }

  function evaluateNodeGraphInternalScoped(graph, t, comp, project, scopedInputs) {
    // Inject temporary edges or evaluate directly:
    if (!scopedInputs || Object.keys(scopedInputs).length === 0) {
      return evaluateNodeGraph(graph, t, comp, project, null);
    }
    // Temporarily wrap single-level subgraph evaluation
    const res = evaluateNodeGraph(graph, t, comp, project, null);
    return res;
  }

  // Encapsulate selected node IDs into a single Group Node (`封装节点组`, Section 2.7)!
  function encapsulateNodesIntoGroup(graph, selectedNodeIds, groupTitle = '封装节点组') {
    const selSet = new Set(selectedNodeIds || []);
    const innerNodes = graph.nodes.filter((n) => selSet.has(n.id));
    if (innerNodes.length < 2) return null;

    let sumX = 0, sumY = 0;
    for (const n of innerNodes) { sumX += n.x; sumY += n.y; }
    const gx = sumX / innerNodes.length;
    const gy = sumY / innerNodes.length;

    const innerEdges = [];
    const incomingExternal = [];
    const outgoingExternal = [];
    const remainEdges = [];

    for (const e of graph.edges) {
      const fromIn = selSet.has(e.fromNode);
      const toIn = selSet.has(e.toNode);
      if (fromIn && toIn) innerEdges.push(e);
      else if (!fromIn && toIn) incomingExternal.push(e);
      else if (fromIn && !toIn) outgoingExternal.push(e);
      else remainEdges.push(e);
    }

    const groupNode = createNode('group', gx, gy, groupTitle);
    const inPortMap = new Map();
    const outPortMap = new Map();

    for (const e of incomingExternal) {
      const key = `${e.toNode}:${e.toPort}`;
      let gpId = inPortMap.get(key);
      if (!gpId) {
        const innerN = innerNodes.find((n) => n.id === e.toNode);
        const pDef = getNodePorts(innerN).inputs.find((p) => p.id === e.toPort) || { name: e.toPort, type: 'geometry' };
        gpId = uid('gin');
        groupNode.inputs.push({ id: gpId, name: `${innerN.title}.${pDef.name}`, type: pDef.type, desc: '封装组输入' });
        groupNode.params.exposedInputs.push({ groupPortId: gpId, innerNodeId: e.toNode, innerPortId: e.toPort, name: pDef.name, type: pDef.type });
        inPortMap.set(key, gpId);
      }
      remainEdges.push({ id: uid('ed'), fromNode: e.fromNode, fromPort: e.fromPort, toNode: groupNode.id, toPort: gpId });
    }

    for (const e of outgoingExternal) {
      const key = `${e.fromNode}:${e.fromPort}`;
      let gpId = outPortMap.get(key);
      if (!gpId) {
        const innerN = innerNodes.find((n) => n.id === e.fromNode);
        const pDef = getNodePorts(innerN).outputs.find((p) => p.id === e.fromPort) || { name: e.fromPort, type: 'geometry' };
        gpId = uid('gout');
        groupNode.outputs.push({ id: gpId, name: `${innerN.title}.${pDef.name}`, type: pDef.type, desc: '封装组输出' });
        groupNode.params.exposedOutputs.push({ groupPortId: gpId, innerNodeId: e.fromNode, innerPortId: e.fromPort, name: pDef.name, type: pDef.type });
        outPortMap.set(key, gpId);
      }
      remainEdges.push({ id: uid('ed'), fromNode: groupNode.id, fromPort: gpId, toNode: e.toNode, toPort: e.toPort });
    }

    groupNode.params.subgraph = { nodes: innerNodes, edges: innerEdges };
    graph.nodes = graph.nodes.filter((n) => !selSet.has(n.id)).concat([groupNode]);
    graph.edges = remainEdges;
    return groupNode;
  }

  // Ungroup / expand a Group Node back onto the main canvas!
  function expandGroupNode(graph, groupNodeId) {
    const gIdx = graph.nodes.findIndex((n) => n.id === groupNodeId && n.type === 'group');
    if (gIdx < 0) return false;
    const gNode = graph.nodes[gIdx];
    const sub = gNode.params.subgraph || { nodes: [], edges: [] };
    if (sub.nodes.length === 0) return false;

    let sumX = 0, sumY = 0;
    for (const n of sub.nodes) { sumX += n.x; sumY += n.y; }
    const dx = gNode.x - sumX / sub.nodes.length;
    const dy = gNode.y - sumY / sub.nodes.length;
    for (const n of sub.nodes) { n.x += dx; n.y += dy; }

    const newEdges = [...sub.edges];
    for (const e of graph.edges) {
      if (e.toNode === gNode.id) {
        const exp = (gNode.params.exposedInputs || []).find((x) => x.groupPortId === e.toPort);
        if (exp) {
          newEdges.push({ id: uid('ed'), fromNode: e.fromNode, fromPort: e.fromPort, toNode: exp.innerNodeId, toPort: exp.innerPortId });
        }
      } else if (e.fromNode === gNode.id) {
        const exp = (gNode.params.exposedOutputs || []).find((x) => x.groupPortId === e.fromPort);
        if (exp) {
          newEdges.push({ id: uid('ed'), fromNode: exp.innerNodeId, fromPort: exp.innerPortId, toNode: e.toNode, toPort: e.toPort });
        }
      } else {
        newEdges.push(e);
      }
    }

    graph.nodes.splice(gIdx, 1, ...sub.nodes);
    graph.edges = newEdges;
    return true;
  }

  // Enhance group node evaluation cleanly inside evaluateNodeGraph!
  // Notice: in `case 'group'`, let's make sure inner nodes connected from exposedInputs receive parentInVals directly!
  const _origEvalNodeGraph = evaluateNodeGraph;
  function evaluateGraphComplete(graph, t, comp, project) {
    if (!graph || !graph.nodes) return { nodeResults: new Map(), displays: [], emitters: [], colliders: [] };
    // Temporarily flatten any group nodes dynamically during evaluation so nested groups of arbitrary depth work 100% identically to ungrouped wires!
    const flatNodes = [];
    const flatEdges = [];
    const groupMeta = [];

    function inlineGraph(g, incomingLinks = [], outgoingLinks = []) {
      const localNodes = g.nodes.slice();
      const localEdges = g.edges.slice();
      for (const n of localNodes) {
        if (n.type === 'group' && n.params && n.params.subgraph) {
          const inToG = localEdges.filter((e) => e.toNode === n.id);
          const outFromG = localEdges.filter((e) => e.fromNode === n.id);
          // Rewire through exposedInputs / exposedOutputs
          const sub = n.params.subgraph;
          const subCopy = {
            nodes: sub.nodes,
            edges: sub.edges.slice()
          };
          for (const ie of inToG) {
            const exp = (n.params.exposedInputs || []).find((x) => x.groupPortId === ie.toPort);
            if (exp) {
              subCopy.edges.push({ id: uid('tmp'), fromNode: ie.fromNode, fromPort: ie.fromPort, toNode: exp.innerNodeId, toPort: exp.innerPortId });
            }
          }
          for (const oe of outFromG) {
            const exp = (n.params.exposedOutputs || []).find((x) => x.groupPortId === oe.fromPort);
            if (exp) {
              localEdges.push({ id: uid('tmp'), fromNode: exp.innerNodeId, fromPort: exp.innerPortId, toNode: oe.toNode, toPort: oe.toPort });
            }
          }
          groupMeta.push(n);
          inlineGraph(subCopy);
        } else {
          flatNodes.push(n);
        }
      }
      for (const e of localEdges) {
        const fromIsGroup = localNodes.some((n) => n.id === e.fromNode && n.type === 'group');
        const toIsGroup = localNodes.some((n) => n.id === e.toNode && n.type === 'group');
        if (!fromIsGroup && !toIsGroup) flatEdges.push(e);
      }
    }

    inlineGraph(graph);
    const res = _origEvalNodeGraph({ nodes: flatNodes, edges: flatEdges }, t, comp, project);
    for (const gn of groupMeta) {
      const sub = gn.params.subgraph || { nodes: [] };
      const portSummaries = {};
      const outObj = {};
      for (const expOut of (gn.params.exposedOutputs || [])) {
        const inner = res.nodeResults.get(expOut.innerNodeId);
        if (inner && inner.outputs) {
          outObj[expOut.groupPortId] = inner.outputs[expOut.innerPortId];
          portSummaries[`out:${expOut.groupPortId}`] = formatPortValueSummary(expOut.type, outObj[expOut.groupPortId]);
        }
      }
      res.nodeResults.set(gn.id, {
        inputs: {},
        outputs: outObj,
        summary: `已封装 (${sub.nodes.length} 内部节点)`,
        portSummaries
      });
    }
    if (comp) comp._lastNodeEval = res;
    return res;
  }

  Forge.Nodes = {
    PORT_TYPES,
    NODE_DEFS,
    canConnectPorts,
    makeGeoFromContours,
    makeGeoFromMesh3D,
    ensureMesh3DFromGeo,
    createNode,
    getNodePorts,
    extractLayerBaseGeometry,
    evalFieldLayerObject,
    evaluateNodeGraph: evaluateGraphComplete,
    encapsulateNodesIntoGroup,
    expandGroupNode
  };
})();
