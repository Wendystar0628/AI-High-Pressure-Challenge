/**
 * Forge Studio — Project Panel & Context-Sensitive Properties Inspector
 * Covers:
 *   - Project Compositions manager, Comp Settings (size, fps, duration, work area, shutter angle/phase),
 *     Quick Add Layer palette, Font Range & Single-Source Character Quick-Swap (`锻` -> `铸`/`铁`/`器`/`回`...)
 *   - Empty Project, No Selection, Multi-Selection, and Single-Layer Inspectors
 *   - Universal Animatable Property Control with Stopwatch, Keyframe toggle, Live Playback Readout,
 *     and Expression Editor (`fx` with preset snippets & clear error/cycle fallback banner)
 *   - Reorderable Shape Operators & Path Morphing, Text & Text Animators & Convert-to-Shape/3D,
 *     Puppet Pins & Mesh Triangulation, Masks & Track Matte, Reorderable Effects Stack,
 *     3D Extrude + PBR Material + Bend/Twist/Field Deformers, Spatial Fields,
 *     Particle Multi-Emitters + Forces + Colliders + Trails, and Procedural Audio Synth Layers
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, uid, rgbToHex, hexToRgb } = Forge.Math;
  const Geo2D = Forge.Geo2D;
  const Fonts = Forge.Fonts;
  const Anim = Forge.Anim;
  const Scene = Forge.SceneEval;
  const Particles = Forge.Particles;
  const AudioMod = Forge.Audio;

  const SHOWCASE_CHARS = ['锻', '铸', '钢', '铁', '锋', '火', '刃', '匠', '魂', '器', '回', '国', '永', '鼎'];

  const EXPR_SNIPPETS = [
    ['抖动 wiggle(频率, 幅度)', 'wiggle(5, 18)'],
    ['循环 loopOut("cycle")', 'loopOut("cycle")'],
    ['往返 loopOut("pingpong")', 'loopOut("pingpong")'],
    ['线性映射 linear(t,a,b,c,d)', 'linear(time, 0, 5, 0, 100)'],
    ['缓动映射 ease(t,a,b,c,d)', 'ease(time, 0, 3, 0, 100)'],
    ['叠加关键帧 value + sin', 'value + Math.sin(time * 6) * 15'],
    ['跨层属性引用 + valueAtTime', 'thisComp.layer(1).transform.rotation.valueAtTime(time - 0.15)']
  ];

  class InspectorController {
    constructor(app) {
      this.app = app;
      this.projectBodyEl = document.getElementById('project-panel-body');
      this.inspectorBodyEl = document.getElementById('inspector-panel-body');

      // Registry of live-bound DOM inputs for fast frame-by-frame readout updates without rebuilding DOM!
      this._liveBindings = [];
      this._openExprKeys = new Set();
    }

    renderAll() {
      this.renderProjectPanel();
      this.renderInspectorPanel();
    }

    // Fast non-destructive update during playback, scrubbing & `window.videoExport.frame(i)`!
    updateLiveValues() {
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const t = this.app.currentTime;
      const activeEl = document.activeElement;

      for (const b of this._liveBindings) {
        if (!b.el || !b.el.isConnected || b.el === activeEl) continue;
        try {
          if (b.kind === 'anchor') {
            const v = Anim.evalProp(b.prop, t, { project: this.app.project, comp, layer: b.layer, propKey: b.propKey });
            b.el.value = Number(v[b.dim] || 0).toFixed(1);
          } else if (b.kind === 'scalar') {
            const v = Anim.evalProp(b.prop, t, { project: this.app.project, comp, layer: b.layer, propKey: b.propKey });
            b.el.value = Number(v).toFixed(b.precision ?? 1);
          } else if (b.kind === 'vec') {
            const v = Anim.evalProp(b.prop, t, { project: this.app.project, comp, layer: b.layer, propKey: b.propKey });
            b.el.value = Number(v[b.dim] || 0).toFixed(1);
          } else if (b.kind === 'color') {
            const v = Anim.evalProp(b.prop, t, { project: this.app.project, comp, layer: b.layer, propKey: b.propKey });
            b.el.value = rgbToHex(v);
          } else if (b.kind === 'exprStatus') {
            const v = Anim.evalProp(b.prop, t, { project: this.app.project, comp, layer: b.layer, propKey: b.propKey });
            if (b.prop._exprError) {
              b.el.className = 'expr-status err';
              const fb = Anim.evalKeyframesAtTime(b.prop, t);
              const fbStr = Array.isArray(fb) ? fb.map((x) => Number(x).toFixed(1)).join(', ') : Number(fb).toFixed(2);
              b.el.textContent = `⚠ 表达式错误：${b.prop._exprError}（已安全退回关键帧值：${fbStr}）`;
            } else {
              b.el.className = 'expr-status ok';
              const vStr = Array.isArray(v) ? v.map((x) => Number(x).toFixed(2)).join(', ') : Number(v).toFixed(2);
              b.el.textContent = `✓ 当前求值结果：${vStr}`;
            }
          }
        } catch (_) {
          // Ignore transient stale binding
        }
      }
    }

    // =========================================================================
    // LEFT SIDEBAR: PROJECT PANEL (`项目、合成设置、添加图层、可用字体与换字`)
    // =========================================================================
    renderProjectPanel() {
      if (!this.projectBodyEl) return;
      this.projectBodyEl.innerHTML = '';
      const proj = this.app.project;
      const activeComp = this.app.getActiveComp();

      // 1. Compositions Section
      const compSec = this._createSection('工程合成列表', true);
      const newCompBtn = document.createElement('button');
      newCompBtn.className = 'btn-accent full';
      newCompBtn.textContent = '+ 新建合成 (Composition)';
      newCompBtn.addEventListener('click', () => {
        this.app.createNewComposition();
      });
      compSec.body.appendChild(newCompBtn);

      if (!proj.compositions || proj.compositions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'inspector-note';
        empty.textContent = '当前为空工程，点击上方按钮新建第一个合成。';
        compSec.body.appendChild(empty);
      } else {
        const listEl = document.createElement('div');
        listEl.className = 'comp-list';
        proj.compositions.forEach((c) => {
          const item = document.createElement('div');
          item.className = `comp-item${activeComp && activeComp.id === c.id ? ' active' : ''}`;
          const info = document.createElement('div');
          info.className = 'comp-item-info';
          info.innerHTML = `
            <div class="comp-item-name">🎬 ${c.name}</div>
            <div class="comp-item-meta">${c.width}×${c.height} · ${c.fps}fps · ${c.duration}s · ${(c.layers || []).length}层</div>
          `;
          item.appendChild(info);

          if (proj.compositions.length > 1) {
            const delBtn = document.createElement('button');
            delBtn.className = 'icon-del-btn';
            delBtn.title = '删除此合成';
            delBtn.textContent = '×';
            delBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.app.deleteComposition(c.id);
            });
            item.appendChild(delBtn);
          }

          item.addEventListener('click', () => {
            this.app.setActiveComp(c.id);
          });
          listEl.appendChild(item);
        });
        compSec.body.appendChild(listEl);
      }
      this.projectBodyEl.appendChild(compSec.el);

      if (!activeComp) return;

      // 2. Quick Add Layer Grid (`新建图层`)
      const addSec = this._createSection('快速新建图层', true);
      const grid = document.createElement('div');
      grid.className = 'add-layer-grid';
      [
        ['shape', '✦ 形状'],
        ['text', '字 文字'],
        ['solid3d', '⬡ 三维体'],
        ['nodeGeo', '◈ 节点体'],
        ['particle', '✸ 粒子'],
        ['field', '◎ 空间场'],
        ['camera', '🎥 摄像机'],
        ['light', '💡 灯光'],
        ['null', '⌖ 空对象'],
        ['adjustment', '◐ 调整层'],
        ['audio', '♪ 音色层']
      ].forEach(([lType, label]) => {
        const b = document.createElement('button');
        b.className = 'btn-chip';
        b.textContent = label;
        b.addEventListener('click', () => this.app.addLayerOfType(lType));
        grid.appendChild(b);
      });
      addSec.body.appendChild(grid);
      this.projectBodyEl.appendChild(addSec.el);

      // 3. Active Composition Settings (`尺寸、帧率、时长、工作区、运动模糊快门`)
      const setSec = this._createSection('当前合成设置 & 运动模糊', false);
      this._appendSimpleTextRow(setSec.body, '合成名称', activeComp.name, (v) => {
        if (v.trim()) activeComp.name = v.trim();
      });
      this._appendDualNumRow(
        setSec.body, '画幅尺寸', activeComp.width, activeComp.height,
        (w, h) => {
          activeComp.width = clamp(Math.round(w), 160, 3840);
          activeComp.height = clamp(Math.round(h), 120, 2160);
          this.app.overlay?.fitToViewport();
        }
      );
      this._appendDualNumRow(
        setSec.body, '帧率 / 时长s', activeComp.fps, activeComp.duration,
        (fps, dur) => {
          activeComp.fps = clamp(Math.round(fps), 1, 120);
          activeComp.duration = clamp(dur, 0.5, 300);
          activeComp.workEnd = clamp(activeComp.workEnd ?? activeComp.duration, 0.2, activeComp.duration);
          this.app.timeline?.resetTimeRangeForComp(activeComp);
        }
      );
      this._appendDualNumRow(
        setSec.body, '工作区 (B..N)', activeComp.workStart ?? 0, activeComp.workEnd ?? activeComp.duration,
        (ws, we) => {
          activeComp.workStart = clamp(ws, 0, activeComp.duration - 0.1);
          activeComp.workEnd = clamp(we, activeComp.workStart + 0.1, activeComp.duration);
        }
      );

      // Background color
      const bgRow = document.createElement('div');
      bgRow.className = 'ins-row';
      bgRow.innerHTML = `<label>背景底色</label>`;
      const bgInp = document.createElement('input');
      bgInp.type = 'color';
      bgInp.value = rgbToHex(activeComp.bgColor || [0.05, 0.06, 0.08]);
      bgInp.addEventListener('change', () => {
        this.app.recordAction('修改合成背景色', () => {
          activeComp.bgColor = hexToRgb(bgInp.value);
        });
      });
      bgRow.appendChild(bgInp);
      setSec.body.appendChild(bgRow);

      // Motion Blur Master Settings (`合成总开关、快门角度与相位`)
      if (!activeComp.motionBlur) {
        activeComp.motionBlur = { enabled: true, shutterAngle: 180, shutterPhase: -90, samples: 7 };
      }
      const mb = activeComp.motionBlur;
      this._appendCheckboxRow(setSec.body, '合成运动模糊总开关', mb.enabled !== false, (checked) => {
        mb.enabled = checked;
      });
      this._appendDualNumRow(
        setSec.body, '快门角度 / 相位°', mb.shutterAngle ?? 180, mb.shutterPhase ?? -90,
        (ang, ph) => {
          mb.shutterAngle = clamp(ang, 0, 720);
          mb.shutterPhase = clamp(ph, -360, 360);
        }
      );
      this.projectBodyEl.appendChild(setSec.el);

      // 4. Built-in Fonts & Single-Source Character Regeneration Card (Sections 2.6, 3.3, 4.1)
      const fontSec = this._createSection('内置字体范围 & 单源换字验证', true);
      const fontDesc = document.createElement('div');
      fontDesc.className = 'inspector-note';
      fontDesc.innerHTML = `
        <div><strong>内置三套矢量字体：</strong>玄铁重黑 / 精工黑体 / 寒刃宋刻</div>
        <div style="margin-top:3px"><strong>字符支持范围：</strong>内置 26 个精修笔画顺序汉字，并对任意常见中文汉字、ASCII 与符号提供亚像素轮廓矢量化（保留封闭内孔）。</div>
      `;
      fontSec.body.appendChild(fontDesc);

      // Find primary source text layer in active comp (e.g., `锻字主字 (在此改字)` or any selected text layer)
      const mainTextLayer = activeComp.layers.find((l) => l.type === 'text' && !l.textData?.linkedSourceLayerId);
      if (mainTextLayer && mainTextLayer.textData) {
        const swapWrap = document.createElement('div');
        swapWrap.className = 'char-swap-box';
        const curCh = mainTextLayer.textData.text;
        swapWrap.innerHTML = `<div class="cs-label">全片单源主字（修改即重算笔画、字块、凹陷与火星）：</div>`;
        const chipRow = document.createElement('div');
        chipRow.className = 'char-chip-row';
        SHOWCASE_CHARS.forEach((ch) => {
          const cb = document.createElement('button');
          cb.className = `char-chip${curCh === ch ? ' active' : ''}`;
          cb.textContent = ch;
          cb.addEventListener('click', () => {
            this.app.recordAction(`更换主字为「${ch}」`, () => {
              mainTextLayer.textData.text = ch;
              Particles.invalidateAllParticleCaches();
            });
          });
          chipRow.appendChild(cb);
        });
        swapWrap.appendChild(chipRow);
        fontSec.body.appendChild(swapWrap);
      }

      this.projectBodyEl.appendChild(fontSec.el);
    }

    // =========================================================================
    // RIGHT SIDEBAR: CONTEXT-SENSITIVE PROPERTIES INSPECTOR
    // =========================================================================
    renderInspectorPanel() {
      if (!this.inspectorBodyEl) return;
      this._liveBindings = [];
      this.inspectorBodyEl.innerHTML = '';

      const proj = this.app.project;
      const comp = this.app.getActiveComp();

      // Case 1: Empty Project (`空工程`)
      if (!proj.compositions || proj.compositions.length === 0 || !comp) {
        const box = document.createElement('div');
        box.className = 'empty-state-card';
        box.innerHTML = `
          <div class="esc-icon">⚒</div>
          <div class="esc-title">空工程状态</div>
          <p>当前工程不含任何合成或图层。您可以新建空合成从零搭建动效，或随时恢复 15 秒「锻字」默认示例工程。</p>
        `;
        const btnCreate = document.createElement('button');
        btnCreate.className = 'btn-accent full';
        btnCreate.textContent = '+ 新建 1280×720 合成';
        btnCreate.addEventListener('click', () => this.app.createNewComposition());

        const btnDemo = document.createElement('button');
        btnDemo.className = 'btn-subtle full';
        btnDemo.style.marginTop = '8px';
        btnDemo.textContent = '↺ 载入「锻字」15 秒示例工程';
        btnDemo.addEventListener('click', () => this.app.loadDemoProject());

        box.append(btnCreate, btnDemo);
        this.inspectorBodyEl.appendChild(box);
        return;
      }

      const selLayers = comp.layers.filter((l) => this.app.selectedLayerIds.has(l.id));

      // Case 2: No Layer Selected (`无选择`)
      if (selLayers.length === 0) {
        const box = document.createElement('div');
        box.className = 'empty-state-card';
        const camCount = comp.layers.filter((l) => l.type === 'camera' && l.visible !== false).length;
        const lightCount = comp.layers.filter((l) => l.type === 'light' && l.visible !== false).length;
        box.innerHTML = `
          <div class="esc-icon">🎬</div>
          <div class="esc-title">未选择图层 · 合成概览</div>
          <p>当前合成：<strong>${comp.name}</strong> (${comp.width}×${comp.height}, ${comp.fps}fps, ${comp.duration}s)</p>
          <p>共 ${comp.layers.length} 个图层 · ${camCount} 台活动摄像机 · ${lightCount} 盏灯光</p>
          <p>在画布或时间轴点击任意图层可编辑其变换、表达式、形状操作符、三维材质、粒子碰撞或音色参数。</p>
        `;
        this.inspectorBodyEl.appendChild(box);
        return;
      }

      // Case 3: Multi-Selection (`多选`)
      if (selLayers.length > 1) {
        this._renderMultiSelectInspector(comp, selLayers);
        return;
      }

      // Case 4: Single Layer Detailed Inspector
      this._renderSingleLayerInspector(comp, selLayers[0]);
    }

    _renderMultiSelectInspector(comp, selLayers) {
      const sec = this._createSection(`已多选 ${selLayers.length} 个图层`, true);
      const names = document.createElement('div');
      names.className = 'inspector-note';
      names.textContent = selLayers.map((l) => l.name).join(' 、 ');
      sec.body.appendChild(names);

      const preBtn = document.createElement('button');
      preBtn.className = 'btn-accent full';
      preBtn.textContent = '📦 原位预合成所选图层 (Ctrl+Shift+C)';
      preBtn.addEventListener('click', () => this.app.precomposeSelection());
      sec.body.appendChild(preBtn);

      // Batch Parent preserving world frame
      const parentOpts = [['', '解除父级（保留当前画面）']].concat(
        comp.layers
          .filter((cand) => !this.app.selectedLayerIds.has(cand.id) && cand.type !== 'audio' && cand.type !== 'adjustment')
          .map((cand, idx) => [cand.id, `${idx + 1}. ${cand.name}`])
      );
      this._appendSelectRow(sec.body, '批量设定父级', '', parentOpts, (pid) => {
        for (const l of selLayers) {
          if (!pid || !Anim.wouldCreateParentCycle(comp, l.id, pid)) {
            Anim.setLayerParentPreservingWorld(comp, l, pid || null, this.app.currentTime, this.app.project);
          }
        }
      });

      this._appendSelectRow(
        sec.body, '批量混合模式', selLayers[0].blendMode || 'normal',
        [['normal', '正常'], ['add', '相加'], ['screen', '滤色'], ['multiply', '正片叠底'], ['overlay', '叠加']],
        (bm) => { for (const l of selLayers) l.blendMode = bm; }
      );

      const rowBtns = document.createElement('div');
      rowBtns.className = 'btn-row-2';
      const dupBtn = document.createElement('button');
      dupBtn.className = 'btn-subtle';
      dupBtn.textContent = '复制所选 (Ctrl+D)';
      dupBtn.addEventListener('click', () => this.app.duplicateSelectedLayers());

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger';
      delBtn.textContent = '删除所选图层';
      delBtn.addEventListener('click', () => this.app.deleteSelectedLayers());
      rowBtns.append(dupBtn, delBtn);
      sec.body.appendChild(rowBtns);

      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderSingleLayerInspector(comp, layer) {
      // 1. Layer Header & Timing / Switches
      const headSec = this._createSection(`图层：${layer.name}`, true);
      this._appendSimpleTextRow(headSec.body, '图层名称', layer.name, (v) => {
        if (v.trim()) layer.name = v.trim();
      });
      this._appendDualNumRow(
        headSec.body, '入点 / 出点 (秒)', layer.inPoint ?? 0, layer.outPoint ?? comp.duration,
        (inP, outP) => {
          layer.inPoint = clamp(inP, 0, comp.duration - 0.04);
          layer.outPoint = clamp(outP, layer.inPoint + 0.04, comp.duration);
        }
      );

      if (layer.type !== 'audio') {
        const parentOpts = [['', '无父级']].concat(
          comp.layers
            .filter((c) => c.id !== layer.id && c.type !== 'audio' && c.type !== 'adjustment' && !Anim.wouldCreateParentCycle(comp, layer.id, c.id))
            .map((c, idx) => [c.id, `${idx + 1}. ${c.name}`])
        );
        this._appendSelectRow(headSec.body, '父级 (保画面)', layer.parentId || '', parentOpts, (pid) => {
          Anim.setLayerParentPreservingWorld(comp, layer, pid || null, this.app.currentTime, this.app.project);
        });

        this._appendSelectRow(
          headSec.body, '混合模式', layer.blendMode || 'normal',
          [['normal', '正常 (Normal)'], ['add', '相加 (Add)'], ['screen', '滤色 (Screen)'], ['multiply', '正片叠底 (Multiply)'], ['overlay', '叠加 (Overlay)']],
          (bm) => { layer.blendMode = bm; }
        );

        // Track Matte (`轨道遮罩`)
        if (!layer.trackMatte || typeof layer.trackMatte !== 'object') {
          layer.trackMatte = { mode: 'none', sourceLayerId: '' };
        }
        this._appendSelectRow(
          headSec.body, '轨道遮罩', layer.trackMatte.mode || 'none',
          [['none', '无轨道遮罩'], ['alpha', 'Alpha 遮罩'], ['alpha_inv', 'Alpha 反转遮罩'], ['luma', '亮度遮罩'], ['luma_inv', '亮度反转遮罩']],
          (m) => { layer.trackMatte.mode = m; }
        );
        if (layer.trackMatte.mode && layer.trackMatte.mode !== 'none') {
          const srcOpts = [['', '正上方相邻图层 (AE 默认)']].concat(
            comp.layers.filter((c) => c.id !== layer.id).map((c, i) => [c.id, `${i + 1}. ${c.name}`])
          );
          this._appendSelectRow(headSec.body, '遮罩源图层', layer.trackMatte.sourceLayerId || '', srcOpts, (sid) => {
            layer.trackMatte.sourceLayerId = sid;
          });
        }
      }

      const actRow = document.createElement('div');
      actRow.className = 'btn-row-2';
      const preBtn = document.createElement('button');
      preBtn.className = 'btn-subtle';
      preBtn.textContent = '📦 原位预合成';
      preBtn.addEventListener('click', () => this.app.precomposeSelection());
      const dupBtn = document.createElement('button');
      dupBtn.className = 'btn-subtle';
      dupBtn.textContent = '⎘ 复制图层';
      dupBtn.addEventListener('click', () => this.app.duplicateSelectedLayers());
      actRow.append(preBtn, dupBtn);
      headSec.body.appendChild(actRow);
      this.inspectorBodyEl.appendChild(headSec.el);

      // 2. Transform (`变换`)
      if (layer.transform && layer.type !== 'audio') {
        const trSec = this._createSection('变换 (Transform)', true);
        const tr = layer.transform;
        // Anchor Point uses `setAnchorPreservingVisual` so moving anchor alone keeps visual position invariant! (Section 2.2)
        this._renderAnchorControl(trSec.body, comp, layer, tr.anchorPoint);
        this._renderAnimProp(trSec.body, comp, layer, 'transform.position', '位置 (Position)', tr.position);
        this._renderAnimProp(trSec.body, comp, layer, 'transform.scale', '缩放 % (Scale)', tr.scale);
        if (layer.threeD) {
          this._renderAnimProp(trSec.body, comp, layer, 'transform.rotationX', 'X 轴旋转 °', tr.rotationX);
          this._renderAnimProp(trSec.body, comp, layer, 'transform.rotationY', 'Y 轴旋转 °', tr.rotationY);
          this._renderAnimProp(trSec.body, comp, layer, 'transform.rotationZ', 'Z 轴旋转 °', tr.rotationZ || tr.rotation);
        } else {
          this._renderAnimProp(trSec.body, comp, layer, 'transform.rotation', '旋转 °', tr.rotationZ || tr.rotation);
        }
        if (!['camera', 'light', 'field'].includes(layer.type)) {
          this._renderAnimProp(trSec.body, comp, layer, 'transform.opacity', '不透明度 %', tr.opacity);
        }
        this.inspectorBodyEl.appendChild(trSec.el);
      }

      // 3. Type-Specific Inspectors
      if (layer.type === 'precomp') this._renderPrecompSection(comp, layer);
      if (layer.type === 'text') this._renderTextSection(comp, layer);
      if (layer.type === 'shape') this._renderShapeSection(comp, layer);
      if (layer.type === 'solid3d') this._renderSolid3DSection(comp, layer);
      if (layer.type === 'camera') this._renderCameraSection(comp, layer);
      if (layer.type === 'light') this._renderLightSection(comp, layer);
      if (layer.type === 'field') this._renderFieldSection(comp, layer);
      if (layer.type === 'particle') this._renderParticleSection(comp, layer);
      if (layer.type === 'audio') this._renderAudioSection(comp, layer);

      // 4. Puppet Pins & Triangulation (`图钉与三角网格`, Section 2.8) for Shape / Text
      if (layer.type === 'shape' || layer.type === 'text') {
        this._renderPuppetSection(comp, layer);
      }

      // 5. 3D Extrude, PBR Material & 3D Deformers (Sections 2.8, 2.11)
      if (['shape', 'text', 'solid3d', 'nodeGeo'].includes(layer.type)) {
        this._render3DMaterialDeformSection(comp, layer);
      }

      // 6. Masks (`多蒙版`, Section 2.9) & Reorderable Effects (`效果栈`, Section 2.9)
      if (!['camera', 'light', 'field', 'audio', 'null'].includes(layer.type)) {
        this._renderMasksSection(comp, layer);
        this._renderEffectsSection(comp, layer);
      }
    }

    // =========================================================================
    // UNIVERSAL ANIMATABLE PROPERTY + EXPRESSION WIDGET
    // =========================================================================
    _renderAnchorControl(container, comp, layer, anchorProp) {
      const wrap = document.createElement('div');
      wrap.className = 'prop-block';
      const top = document.createElement('div');
      top.className = 'prop-top';

      const sw = document.createElement('button');
      sw.className = `sw-btn${anchorProp.animated ? ' on' : ''}`;
      sw.textContent = '⏱';
      sw.title = '锚点关键帧码表';
      sw.addEventListener('click', () => {
        this.app.recordAction('切换锚点码表', () => Anim.togglePropStopwatch(anchorProp, this.app.currentTime));
      });

      const lbl = document.createElement('span');
      lbl.className = 'prop-lbl';
      lbl.textContent = '锚点 (保画面平移)';
      top.append(sw, lbl);

      const inputsWrap = document.createElement('div');
      inputsWrap.className = 'prop-inputs';
      const dims = layer.threeD ? 3 : 2;
      const curVal = Anim.evalProp(anchorProp, this.app.currentTime, { project: this.app.project, comp, layer, propKey: 'anchor' });

      for (let d = 0; d < dims; d++) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '1';
        inp.value = Number(curVal[d] || 0).toFixed(1);
        this._liveBindings.push({ kind: 'anchor', el: inp, prop: anchorProp, dim: d, layer, propKey: 'anchor' });
        inp.addEventListener('change', () => {
          const nv = parseFloat(inp.value);
          if (!Number.isFinite(nv)) return;
          this.app.recordAction('调整图层锚点（保持画面位置不变）', () => {
            const curA = Anim.evalProp(anchorProp, this.app.currentTime, { project: this.app.project, comp, layer }).slice();
            curA[d] = nv;
            Anim.setAnchorPreservingVisual(comp, layer, curA, this.app.currentTime, this.app.project);
            Particles.invalidateAllParticleCaches();
          });
        });
        inputsWrap.appendChild(inp);
      }

      top.appendChild(inputsWrap);
      wrap.appendChild(top);
      container.appendChild(wrap);
    }

    _renderAnimProp(container, comp, layer, propKey, label, prop, opts = {}) {
      if (!prop || typeof prop !== 'object' || !('value' in prop)) return;
      const exprUid = `${layer.id}::${propKey}`;
      const isExprOpen = this._openExprKeys.has(exprUid) || Boolean(prop.expressionEnabled && prop.expression);

      const wrap = document.createElement('div');
      wrap.className = 'prop-block';

      const top = document.createElement('div');
      top.className = 'prop-top';

      // Stopwatch
      const sw = document.createElement('button');
      sw.className = `sw-btn${prop.animated ? ' on' : ''}`;
      sw.textContent = '⏱';
      sw.title = '开启/关闭关键帧动画';
      sw.addEventListener('click', () => {
        this.app.recordAction(`切换码表: ${label}`, () => {
          Anim.togglePropStopwatch(prop, this.app.currentTime);
          Particles.invalidateAllParticleCaches();
        });
      });

      const lbl = document.createElement('span');
      lbl.className = 'prop-lbl';
      lbl.textContent = label;
      lbl.title = '点击可在下方曲线视图定位此属性';
      lbl.addEventListener('click', () => {
        if (this.app.timeline) {
          this.app.timeline.activeGraphTarget = { layerId: layer.id, key: propKey, label, prop };
          this.app.timeline.graphViewBounds = null;
          this.app.timeline.renderCanvas();
        }
      });

      top.append(sw, lbl);

      const inputsWrap = document.createElement('div');
      inputsWrap.className = 'prop-inputs';
      const curVal = Anim.evalProp(prop, this.app.currentTime, { project: this.app.project, comp, layer, propKey });

      if (prop.type === 'scalar') {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = String(opts.step || prop.step || 1);
        inp.value = Number(curVal).toFixed(opts.precision ?? (prop.step && prop.step < 0.2 ? 2 : 1));
        this._liveBindings.push({ kind: 'scalar', el: inp, prop, layer, propKey, precision: opts.precision ?? (prop.step && prop.step < 0.2 ? 2 : 1) });
        inp.addEventListener('change', () => {
          let nv = parseFloat(inp.value);
          if (!Number.isFinite(nv)) return;
          if (prop.min !== undefined) nv = Math.max(prop.min, nv);
          if (prop.max !== undefined) nv = Math.min(prop.max, nv);
          this.app.recordAction(`修改 ${label}`, () => {
            Anim.setPropValueAtTime(prop, nv, this.app.currentTime);
            Particles.invalidateAllParticleCaches();
          });
        });
        inputsWrap.appendChild(inp);
      } else if (prop.type === 'vec2' || prop.type === 'vec3') {
        const dims = (prop.type === 'vec2' || (!layer.threeD && propKey.startsWith('transform.'))) ? 2 : 3;
        for (let d = 0; d < dims; d++) {
          const inp = document.createElement('input');
          inp.type = 'number';
          inp.step = '1';
          inp.value = Number(curVal[d] || 0).toFixed(1);
          this._liveBindings.push({ kind: 'vec', el: inp, prop, dim: d, layer, propKey });
          inp.addEventListener('change', () => {
            const nv = parseFloat(inp.value);
            if (!Number.isFinite(nv)) return;
            this.app.recordAction(`修改 ${label}`, () => {
              const next = Anim.evalKeyframesAtTime(prop, this.app.currentTime).slice();
              next[d] = nv;
              Anim.setPropValueAtTime(prop, next, this.app.currentTime);
              Particles.invalidateAllParticleCaches();
            });
          });
          inputsWrap.appendChild(inp);
        }
      } else if (prop.type === 'color') {
        const inp = document.createElement('input');
        inp.type = 'color';
        inp.value = rgbToHex(curVal);
        this._liveBindings.push({ kind: 'color', el: inp, prop, layer, propKey });
        inp.addEventListener('input', () => {
          Anim.setPropValueAtTime(prop, hexToRgb(inp.value), this.app.currentTime);
          Particles.invalidateAllParticleCaches();
          this.app.refreshViewsAfterEdit(true);
        });
        inp.addEventListener('change', () => {
          this.app.recordAction(`修改 ${label}`, () => {
            Anim.setPropValueAtTime(prop, hexToRgb(inp.value), this.app.currentTime);
          });
        });
        inputsWrap.appendChild(inp);
      }

      // Expression Toggle Button (`fx`)
      if (prop.type !== 'path') {
        const fxBtn = document.createElement('button');
        fxBtn.className = `fx-toggle-btn${prop.expressionEnabled && prop.expression ? ' on' : ''}${prop._exprError ? ' err' : ''}`;
        fxBtn.textContent = 'fx';
        fxBtn.title = '为此属性添加或编辑表达式 (wiggle / loopOut / linear / ease / 跨层引用 / valueAtTime)';
        fxBtn.addEventListener('click', () => {
          if (this._openExprKeys.has(exprUid)) this._openExprKeys.delete(exprUid);
          else this._openExprKeys.add(exprUid);
          this.renderInspectorPanel();
        });
        inputsWrap.appendChild(fxBtn);
      }

      top.appendChild(inputsWrap);
      wrap.appendChild(top);

      // Expandable Expression Editor (`Section 2.4`)
      if (isExprOpen && prop.type !== 'path') {
        const exprBox = document.createElement('div');
        exprBox.className = 'expr-editor-box';

        const bar = document.createElement('div');
        bar.className = 'expr-bar';
        const enChk = document.createElement('input');
        enChk.type = 'checkbox';
        enChk.checked = prop.expressionEnabled !== false;
        const enLbl = document.createElement('label');
        enLbl.append(enChk, document.createTextNode(' 启用表达式'));

        const snipSel = document.createElement('select');
        snipSel.innerHTML = `<option value="">插入常用表达式语法…</option>`;
        EXPR_SNIPPETS.forEach(([title, code]) => {
          const o = document.createElement('option');
          o.value = code;
          o.textContent = title;
          snipSel.appendChild(o);
        });

        bar.append(enLbl, snipSel);

        const ta = document.createElement('textarea');
        ta.className = 'expr-textarea';
        ta.rows = 2;
        ta.placeholder = '例如: wiggle(4, 15) 或 thisComp.layer("控制器").transform.rotation';
        ta.value = prop.expression || '';

        const statusDiv = document.createElement('div');
        statusDiv.className = prop._exprError ? 'expr-status err' : 'expr-status ok';
        this._liveBindings.push({ kind: 'exprStatus', el: statusDiv, prop, layer, propKey });

        const applyExpr = (newCode, enabled) => {
          this.app.recordAction(`编辑表达式: ${label}`, () => {
            prop.expression = newCode;
            prop.expressionEnabled = enabled;
            Particles.invalidateAllParticleCaches();
          });
        };

        enChk.addEventListener('change', () => applyExpr(ta.value, enChk.checked));
        ta.addEventListener('change', () => applyExpr(ta.value, ta.value.trim().length > 0 ? true : enChk.checked));
        snipSel.addEventListener('change', () => {
          if (!snipSel.value) return;
          ta.value = snipSel.value;
          snipSel.value = '';
          applyExpr(ta.value, true);
        });

        exprBox.append(bar, ta, statusDiv);
        wrap.appendChild(exprBox);
        this.updateLiveValues();
      }

      container.appendChild(wrap);
    }

    // =========================================================================
    // SPECIALIZED INSPECTOR SECTIONS
    // =========================================================================
    _renderPrecompSection(comp, layer) {
      const sec = this._createSection('预合成与时间重映射 (2.10)', true);
      const enterBtn = document.createElement('button');
      enterBtn.className = 'btn-accent full';
      enterBtn.textContent = '🎬 进入该子合成编辑';
      enterBtn.addEventListener('click', () => {
        if (layer.sourceCompId) this.app.setActiveComp(layer.sourceCompId);
      });
      sec.body.appendChild(enterBtn);

      const srcOpts = this.app.project.compositions
        .filter((c) => c.id !== comp.id)
        .map((c) => [c.id, c.name]);
      if (srcOpts.length > 0) {
        this._appendSelectRow(sec.body, '引用源合成', layer.sourceCompId, srcOpts, (cid) => {
          layer.sourceCompId = cid;
        });
      }

      this._appendCheckboxRow(sec.body, '启用时间重映射 (Time Remap)', Boolean(layer.timeRemapEnabled), (chk) => {
        layer.timeRemapEnabled = chk;
        if (chk && !layer.timeRemap) {
          const subDur = this.app.project.compositions.find((c) => c.id === layer.sourceCompId)?.duration || comp.duration;
          layer.timeRemap = Anim.createProp(0, 'scalar', { min: 0, max: subDur, label: '重映射时间 s' });
          Anim.togglePropStopwatch(layer.timeRemap, 0);
          Anim.setPropValueAtTime(layer.timeRemap, subDur, subDur);
        }
      });

      if (layer.timeRemapEnabled && layer.timeRemap) {
        this._renderAnimProp(sec.body, comp, layer, 'timeRemap', '重映射内部时间 (秒)', layer.timeRemap, { step: 0.05, precision: 2 });
        const presetRow = document.createElement('div');
        presetRow.className = 'add-layer-grid';
        const subDur = this.app.project.compositions.find((c) => c.id === layer.sourceCompId)?.duration || comp.duration;
        [
          ['正常 1x', () => {
            layer.timeRemap.animated = true;
            layer.timeRemap.keyframes = [];
            Anim.setPropValueAtTime(layer.timeRemap, 0, layer.inPoint ?? 0);
            Anim.setPropValueAtTime(layer.timeRemap, subDur, layer.outPoint ?? comp.duration);
          }],
          ['2 倍快放', () => {
            layer.timeRemap.animated = true;
            layer.timeRemap.keyframes = [];
            Anim.setPropValueAtTime(layer.timeRemap, 0, layer.inPoint ?? 0);
            Anim.setPropValueAtTime(layer.timeRemap, subDur, (layer.inPoint ?? 0) + subDur * 0.5);
          }],
          ['倒放 Reverse', () => {
            layer.timeRemap.animated = true;
            layer.timeRemap.keyframes = [];
            Anim.setPropValueAtTime(layer.timeRemap, subDur, layer.inPoint ?? 0);
            Anim.setPropValueAtTime(layer.timeRemap, 0, layer.outPoint ?? comp.duration);
          }],
          ['当前帧定格', () => {
            const cur = Scene.evalPrecompInnerTime(layer, this.app.currentTime, comp, this.app.project);
            layer.timeRemap.animated = false;
            layer.timeRemap.keyframes = [];
            layer.timeRemap.value = cur;
          }]
        ].forEach(([lbl, fn]) => {
          const b = document.createElement('button');
          b.className = 'btn-chip';
          b.textContent = lbl;
          b.addEventListener('click', () => this.app.recordAction(`时间重映射预设: ${lbl}`, fn));
          presetRow.appendChild(b);
        });
        sec.body.appendChild(presetRow);
      }
      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderTextSection(comp, layer) {
      const td = layer.textData;
      if (!td) return;
      const sec = this._createSection('文字排版与动画器 (2.6)', true);

      // Multiline Chinese Textarea (`支持中文多行`)
      const taWrap = document.createElement('div');
      taWrap.className = 'ins-col';
      taWrap.innerHTML = `<label>文字内容（支持中文多行；修改后字形、挤出、变形与粒子同步更新）</label>`;
      const ta = document.createElement('textarea');
      ta.className = 'text-content-input';
      ta.rows = 2;
      ta.value = td.text || '';
      ta.addEventListener('input', () => {
        td.text = ta.value;
        Particles.invalidateAllParticleCaches();
        this.app.refreshViewsAfterEdit(true);
      });
      ta.addEventListener('change', () => {
        this.app.recordAction('修改文字内容', () => {
          td.text = ta.value;
          Particles.invalidateAllParticleCaches();
        });
      });
      taWrap.appendChild(ta);
      sec.body.appendChild(taWrap);

      this._appendSelectRow(
        sec.body, '内置矢量字体', td.fontFamily || 'forge_heavy',
        Object.values(Fonts.FONT_FAMILIES).map((f) => [f.id, f.name]),
        (fid) => { td.fontFamily = fid; Particles.invalidateAllParticleCaches(); }
      );
      this._appendSelectRow(
        sec.body, '段落对齐', td.align || 'center',
        [['left', '左对齐'], ['center', '居中对齐'], ['right', '右对齐']],
        (al) => { td.align = al; Particles.invalidateAllParticleCaches(); }
      );

      this._renderAnimProp(sec.body, comp, layer, 'text.fontSize', '字号 px', td.fontSize);
      this._renderAnimProp(sec.body, comp, layer, 'text.lineHeight', '多行行距倍率', td.lineHeight, { step: 0.05, precision: 2 });
      this._renderAnimProp(sec.body, comp, layer, 'text.tracking', '字距 (Tracking)', td.tracking);

      this._appendCheckboxRow(sec.body, '启用填充', td.fillEnabled !== false, (c) => { td.fillEnabled = c; });
      if (td.fillEnabled !== false) {
        this._renderAnimProp(sec.body, comp, layer, 'text.fillColor', '文字填充色', td.fillColor);
      }
      this._appendCheckboxRow(sec.body, '启用描边', Boolean(td.strokeEnabled), (c) => { td.strokeEnabled = c; });
      if (td.strokeEnabled) {
        this._renderAnimProp(sec.body, comp, layer, 'text.strokeColor', '文字描边色', td.strokeColor);
        this._renderAnimProp(sec.body, comp, layer, 'text.strokeWidth', '描边粗细 px', td.strokeWidth);
      }

      this._appendCheckboxRow(sec.body, '笔画骨架书写模式 (Stroke Write)', Boolean(td.strokeMode), (c) => {
        td.strokeMode = c;
        if (c) td.strokeEnabled = true;
      });
      if (td.strokeMode) {
        this._renderAnimProp(sec.body, comp, layer, 'text.trimStart', '笔画起点 %', td.trimStart);
        this._renderAnimProp(sec.body, comp, layer, 'text.trimEnd', '笔画终点 %', td.trimEnd);
      }

      // Convert Text Glyph Contours to Editable Shape Layer (`字形轮廓转为几何` — Section 2.6)
      const convBtn = document.createElement('button');
      convBtn.className = 'btn-subtle full';
      convBtn.textContent = '✒ 将当前文字轮廓转为可编辑形状图层（保留孔洞）';
      convBtn.addEventListener('click', () => {
        this.app.recordAction('文字转形状几何图层', () => {
          const prevStroke = td.strokeMode;
          td.strokeMode = false;
          const res = Scene.evalTextLayerContours(layer, this.app.currentTime, comp, this.app.project);
          td.strokeMode = prevStroke;
          const shLayer = Scene.createShapeLayer(comp, `${layer.name} 轮廓`, 'empty');
          shLayer.transform = JSON.parse(JSON.stringify(layer.transform));
          shLayer.threeD = layer.threeD;
          shLayer.shapeData.items.push({
            id: uid('sh'),
            kind: 'path',
            name: '字形闭合轮廓组',
            enabled: true,
            path: Anim.createProp(Geo2D.cloneContours(res.contours), 'path', { label: '字形轮廓' })
          });
          const idx = comp.layers.indexOf(layer);
          comp.layers.splice(Math.max(0, idx), 0, shLayer);
          this.app.selectLayer(shLayer.id);
        });
      });
      sec.body.appendChild(convBtn);

      // Text Animators (`文字动画器: 按字/词/行, 绕自身中心变化` — Section 2.6)
      const addTaBtn = document.createElement('button');
      addTaBtn.className = 'btn-accent full';
      addTaBtn.style.marginTop = '6px';
      addTaBtn.textContent = '+ 添加文字范围动画器 (按字/词/行)';
      addTaBtn.addEventListener('click', () => {
        this.app.recordAction('添加文字动画器', () => {
          if (!td.animators) td.animators = [];
          td.animators.push(Scene.createTextAnimator(`文字动画器 ${td.animators.length + 1}`));
        });
      });
      sec.body.appendChild(addTaBtn);

      (td.animators || []).forEach((anim, idx) => {
        const sub = document.createElement('div');
        sub.className = 'sub-card';
        const hdr = document.createElement('div');
        hdr.className = 'sub-card-hdr';
        hdr.innerHTML = `<strong>${anim.name || `动画器 ${idx + 1}`}</strong>`;
        const del = document.createElement('button');
        del.className = 'icon-del-btn';
        del.textContent = '×';
        del.addEventListener('click', () => {
          this.app.recordAction('删除文字动画器', () => td.animators.splice(idx, 1));
        });
        hdr.appendChild(del);
        sub.appendChild(hdr);

        this._appendSelectRow(
          sub, '选择单位', anim.basedOn || 'chars',
          [['chars', '按字符 (Chars)'], ['words', '按词组 (Words)'], ['lines', '按行 (Lines)']],
          (v) => { anim.basedOn = v; }
        );
        this._renderAnimProp(sub, comp, layer, `ta.${idx}.start`, '范围起点 %', anim.start);
        this._renderAnimProp(sub, comp, layer, `ta.${idx}.end`, '范围终点 %', anim.end);
        this._renderAnimProp(sub, comp, layer, `ta.${idx}.offset`, '范围偏移 %', anim.offset);
        this._renderAnimProp(sub, comp, layer, `ta.${idx}.smooth`, '软边过渡 %', anim.smoothness);
        this._renderAnimProp(sub, comp, layer, `ta.${idx}.pos`, '字符位移', anim.position);
        this._renderAnimProp(sub, comp, layer, `ta.${idx}.rot`, '绕自身中心旋转 °', anim.rotation);
        this._renderAnimProp(sub, comp, layer, `ta.${idx}.scale`, '绕自身中心缩放 %', anim.scale);
        this._renderAnimProp(sub, comp, layer, `ta.${idx}.opacity`, '字符不透明度 %', anim.opacity);
        sec.body.appendChild(sub);
      });

      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderShapeSection(comp, layer) {
      const sd = layer.shapeData;
      if (!sd) return;
      const sec = this._createSection('矢量形状、操作符排序与路径形变 (2.5)', true);

      // Fill & Stroke
      this._appendCheckboxRow(sec.body, '填充 (Fill)', sd.fillEnabled !== false, (c) => { sd.fillEnabled = c; });
      if (sd.fillEnabled !== false) {
        this._renderAnimProp(sec.body, comp, layer, 'shape.fillColor', '填充颜色', sd.fillColor);
        this._renderAnimProp(sec.body, comp, layer, 'shape.fillOpacity', '填充不透明度 %', sd.fillOpacity);
      }
      this._appendCheckboxRow(sec.body, '描边 (Stroke)', sd.strokeEnabled !== false, (c) => { sd.strokeEnabled = c; });
      if (sd.strokeEnabled !== false) {
        this._renderAnimProp(sec.body, comp, layer, 'shape.strokeColor', '描边颜色', sd.strokeColor);
        this._renderAnimProp(sec.body, comp, layer, 'shape.strokeWidth', '描边宽度 px', sd.strokeWidth);
      }

      // Add Shape / Operator Buttons
      const opGrid = document.createElement('div');
      opGrid.className = 'add-layer-grid';
      [
        ['+ 矩形', () => sd.items.push({ id: uid('sh'), kind: 'rect', name: '矩形', enabled: true, position: Anim.createProp([40, 0], 'vec2'), size: Anim.createProp([180, 140], 'vec2'), roundness: Anim.createProp(8, 'scalar') })],
        ['+ 椭圆', () => sd.items.push({ id: uid('sh'), kind: 'ellipse', name: '椭圆', enabled: true, position: Anim.createProp([60, 0], 'vec2'), size: Anim.createProp([170, 170], 'vec2') })],
        ['+ 自由星形', () => sd.items.push({ id: uid('sh'), kind: 'path', name: '贝塞尔路径', enabled: true, path: Anim.createProp([Geo2D.starContour(0, 0, 5, 110, 52, 0)], 'path') })],
        ['+ 修剪路径', () => sd.items.push(Scene.createShapeOperator('trim'))],
        ['+ 重复器', () => sd.items.push(Scene.createShapeOperator('repeater'))],
        ['+ 布尔运算', () => sd.items.push(Scene.createShapeOperator('boolean'))]
      ].forEach(([lbl, fn]) => {
        const b = document.createElement('button');
        b.className = 'btn-chip';
        b.textContent = lbl;
        b.addEventListener('click', () => {
          this.app.recordAction(`添加形状项: ${lbl}`, () => {
            fn();
            Particles.invalidateAllParticleCaches();
          });
        });
        opGrid.appendChild(b);
      });
      sec.body.appendChild(opGrid);

      // Ordered Items & Operators Stack (`调整顺序交换结果`)
      (sd.items || []).forEach((it, idx) => {
        const sub = document.createElement('div');
        sub.className = 'sub-card';
        const hdr = document.createElement('div');
        hdr.className = 'sub-card-hdr';
        hdr.innerHTML = `<span>${idx + 1}. <strong>${it.name || it.kind}</strong></span>`;

        const ctrls = document.createElement('div');
        ctrls.className = 'sub-card-btns';
        const upBtn = document.createElement('button');
        upBtn.textContent = '▲';
        upBtn.title = '上移顺序（改变修剪/重复器/布尔先后关系）';
        upBtn.disabled = idx === 0;
        upBtn.addEventListener('click', () => {
          this.app.recordAction('上移形状操作符顺序', () => {
            const [m] = sd.items.splice(idx, 1);
            sd.items.splice(idx - 1, 0, m);
            Particles.invalidateAllParticleCaches();
          });
        });

        const dnBtn = document.createElement('button');
        dnBtn.textContent = '▼';
        dnBtn.title = '下移顺序（改变修剪/重复器/布尔先后关系）';
        dnBtn.disabled = idx === sd.items.length - 1;
        dnBtn.addEventListener('click', () => {
          this.app.recordAction('下移形状操作符顺序', () => {
            const [m] = sd.items.splice(idx, 1);
            sd.items.splice(idx + 1, 0, m);
            Particles.invalidateAllParticleCaches();
          });
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'icon-del-btn';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', () => {
          this.app.recordAction('删除形状项', () => {
            sd.items.splice(idx, 1);
            Particles.invalidateAllParticleCaches();
          });
        });

        ctrls.append(upBtn, dnBtn, delBtn);
        hdr.appendChild(ctrls);
        sub.appendChild(hdr);

        if (it.kind === 'rect' || it.kind === 'ellipse') {
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.pos`, '中心位置', it.position);
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.size`, '宽高尺寸', it.size);
          if (it.roundness) this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.rnd`, '圆角半径', it.roundness);
        } else if (it.kind === 'path') {
          // Keyframe Path Morphing Controls (including hole-preserving morphing! Section 2.5)
          const swRow = document.createElement('div');
          swRow.className = 'btn-row-2';
          const kfBtn = document.createElement('button');
          kfBtn.className = 'btn-subtle';
          kfBtn.textContent = it.path.animated ? '◆ 记录当前路径关键帧' : '⏱ 开启路径形变动画';
          kfBtn.addEventListener('click', () => {
            this.app.recordAction('记录路径形变关键帧', () => {
              if (!it.path.animated) Anim.togglePropStopwatch(it.path, this.app.currentTime);
              else {
                const curC = Anim.evalProp(it.path, this.app.currentTime, { project: this.app.project, comp, layer });
                Anim.setPropValueAtTime(it.path, Geo2D.cloneContours(curC), this.app.currentTime);
              }
            });
          });
          swRow.appendChild(kfBtn);
          sub.appendChild(swRow);

          // Morph Target Presets with Holes (`含孔洞轮廓保持对应形变`)
          this._appendSelectRow(
            sub, '当前帧设为形变目标', '',
            [
              ['', '选择预设轮廓写入当前关键帧…'],
              ['ring_hole', '圆环（外圆 + 中心圆孔）'],
              ['frame_hole', '方框（外方 + 内部方孔）'],
              ['gear_hole', '八齿锻轮（外齿 + 轴孔）']
            ],
            (preset) => {
              if (!preset) return;
              if (!it.path.animated) Anim.togglePropStopwatch(it.path, 0);
              let contours;
              if (preset === 'ring_hole') {
                contours = [
                  Geo2D.ellipseContour(0, 0, 120, 120),
                  Geo2D.reverseContour(Geo2D.ellipseContour(0, 0, 52, 52))
                ];
              } else if (preset === 'frame_hole') {
                contours = [
                  Geo2D.rectContour(0, 0, 230, 190, 14),
                  Geo2D.reverseContour(Geo2D.rectContour(0, 0, 96, 80, 6))
                ];
              } else {
                contours = [
                  Geo2D.starContour(0, 0, 8, 130, 92, 0),
                  Geo2D.reverseContour(Geo2D.ellipseContour(0, 0, 44, 44))
                ];
              }
              Anim.setPropValueAtTime(it.path, contours, this.app.currentTime);
              Particles.invalidateAllParticleCaches();
            }
          );
        } else if (it.kind === 'trim') {
          this._appendSelectRow(
            sub, '修剪方式', it.trimMode || 'simultaneous',
            [['simultaneous', '同时修剪'], ['individual', '逐条路径依次修剪']],
            (m) => { it.trimMode = m; }
          );
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.start`, '起点 %', it.start);
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.end`, '终点 %', it.end);
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.offset`, '偏移 °', it.offset);
        } else if (it.kind === 'repeater') {
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.copies`, '副本数量', it.copies);
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.pos`, '副本位移', it.position);
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.scale`, '副本缩放 %', it.scale);
          this._renderAnimProp(sub, comp, layer, `shape.item.${idx}.rot`, '副本旋转 °', it.rotation);
        } else if (it.kind === 'boolean') {
          this._appendSelectRow(
            sub, '布尔模式', it.mode || 'subtract',
            [['union', '并集 (Union)'], ['subtract', '差集 (Subtract)'], ['intersect', '交集 (Intersect)']],
            (m) => { it.mode = m; Particles.invalidateAllParticleCaches(); }
          );
        }

        sec.body.appendChild(sub);
      });

      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderPuppetSection(comp, layer) {
      const sec = this._createSection('三角网格与图钉变形 (2.8)', (layer.puppetPins && layer.puppetPins.length > 0));
      if (layer.shapeData) {
        this._appendCheckboxRow(sec.body, '生成并显示变形三角网格', Boolean(layer.shapeData.triangulateMesh), (c) => {
          layer.shapeData.triangulateMesh = c;
        });
      }
      const pinToolBtn = document.createElement('button');
      pinToolBtn.className = 'btn-subtle full';
      pinToolBtn.textContent = '📌 激活「图钉工具 (Ctrl+P)」在画布点击打钉';
      pinToolBtn.addEventListener('click', () => this.app.setTool('pin'));
      sec.body.appendChild(pinToolBtn);

      (layer.puppetPins || []).forEach((pin, idx) => {
        const sub = document.createElement('div');
        sub.className = 'sub-card';
        const hdr = document.createElement('div');
        hdr.className = 'sub-card-hdr';
        hdr.innerHTML = `<strong>📌 ${pin.name || `图钉 ${idx + 1}`}</strong>`;
        const del = document.createElement('button');
        del.className = 'icon-del-btn';
        del.textContent = '×';
        del.addEventListener('click', () => {
          this.app.recordAction('删除图钉', () => layer.puppetPins.splice(idx, 1));
        });
        hdr.appendChild(del);
        sub.appendChild(hdr);
        this._renderAnimProp(sub, comp, layer, `pin.${idx}.pos`, '图钉位置', pin.position);
        this._renderAnimProp(sub, comp, layer, `pin.${idx}.rot`, '图钉旋转 °', pin.rotation);
        this._renderAnimProp(sub, comp, layer, `pin.${idx}.scale`, '图钉缩放 %', pin.scale);
        sec.body.appendChild(sub);
      });

      this.inspectorBodyEl.appendChild(sec.el);
    }

    _render3DMaterialDeformSection(comp, layer) {
      const isExtrudable = layer.type === 'shape' || layer.type === 'text';
      const openDefault = layer.threeD || layer.type === 'solid3d' || layer.type === 'nodeGeo';
      const sec = this._createSection('三维挤出、PBR 材质与场变形 (2.8 / 2.11)', openDefault);

      if (isExtrudable) {
        if (!layer.extrude) layer.extrude = Scene.createDefaultExtrude(false, 52);
        this._appendCheckboxRow(sec.body, '生成三维挤出实体（含前后盖与倒角）', Boolean(layer.extrude.enabled), (chk) => {
          layer.extrude.enabled = chk;
          if (chk) layer.threeD = true;
          Particles.invalidateAllParticleCaches();
        });
        if (layer.extrude.enabled) {
          this._renderAnimProp(sec.body, comp, layer, 'extrude.depth', '挤出深度', layer.extrude.depth);
          this._renderAnimProp(sec.body, comp, layer, 'extrude.bevelDepth', '倒角深度', layer.extrude.bevelDepth);
          this._renderAnimProp(sec.body, comp, layer, 'extrude.bevelWidth', '倒角宽度', layer.extrude.bevelWidth);
        }
      }

      if (layer.threeD || layer.type === 'solid3d' || layer.type === 'nodeGeo') {
        this._appendCheckboxRow(sec.body, '投射几何阴影 (Cast Shadows)', layer.castShadows !== false, (c) => { layer.castShadows = c; });
        this._appendCheckboxRow(sec.body, '接收阴影 (Receive Shadows)', layer.receiveShadows !== false, (c) => { layer.receiveShadows = c; });

        if (!layer.material) layer.material = Scene.createDefaultMaterial();
        const mat = layer.material;
        this._renderAnimProp(sec.body, comp, layer, 'mat.baseColor', '材质基础色', mat.baseColor);
        this._renderAnimProp(sec.body, comp, layer, 'mat.metallic', '金属度 (0-1)', mat.metallic, { step: 0.05, precision: 2 });
        this._renderAnimProp(sec.body, comp, layer, 'mat.roughness', '粗糙度 (0-1)', mat.roughness, { step: 0.05, precision: 2 });
        this._renderAnimProp(sec.body, comp, layer, 'mat.emissiveColor', '炽热自发光色', mat.emissiveColor);
        this._renderAnimProp(sec.body, comp, layer, 'mat.emissiveIntensity', '自发光强度', mat.emissiveIntensity, { step: 0.1, precision: 2 });

        if (!layer.deform) layer.deform = Scene.createDefaultDeform();
        const def = layer.deform;
        this._renderAnimProp(sec.body, comp, layer, 'deform.bendAngle', '三维弯曲角度 °', def.bendAngle);
        this._appendSelectRow(sec.body, '弯曲轴向', def.bendAxis || 'x', [['x', 'X 轴'], ['y', 'Y 轴'], ['z', 'Z 轴']], (a) => { def.bendAxis = a; });
        this._renderAnimProp(sec.body, comp, layer, 'deform.twistAngle', '三维扭转角度 °', def.twistAngle);
        this._appendCheckboxRow(sec.body, '受合成内空间场驱动顶点变形', Boolean(def.useSceneFields), (c) => {
          def.useSceneFields = c;
          Particles.invalidateAllParticleCaches();
        });
        if (def.useSceneFields) {
          this._renderAnimProp(sec.body, comp, layer, 'deform.fieldAmount', '空间场变形倍增', def.fieldAmount, { step: 0.1, precision: 2 });
        }
      }

      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderSolid3DSection(comp, layer) {
      const sd = layer.solidData;
      if (!sd) return;
      const sec = this._createSection('三维基本体几何', true);
      this._appendSelectRow(
        sec.body, '几何体类型', sd.primitive || 'box',
        [['anvil', '锻造铁砧'], ['hammer', '重型锻锤'], ['box', '倒角长方体'], ['sphere', '经纬球体'], ['plane', '细分地面']],
        (p) => { sd.primitive = p; Particles.invalidateAllParticleCaches(); }
      );
      this._renderAnimProp(sec.body, comp, layer, 'solid.sizeX', '宽度 X', sd.sizeX);
      this._renderAnimProp(sec.body, comp, layer, 'solid.sizeY', '高度 Y', sd.sizeY);
      this._renderAnimProp(sec.body, comp, layer, 'solid.sizeZ', '深度 Z', sd.sizeZ);
      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderCameraSection(comp, layer) {
      const cam = layer.camera;
      if (!cam) return;
      const sec = this._createSection('三维摄像机与真实景深 (2.12)', true);
      this._appendCheckboxRow(sec.body, '启用目标点注视 (Look-At)', cam.useTarget !== false, (c) => { cam.useTarget = c; });
      if (cam.useTarget !== false) {
        this._renderAnimProp(sec.body, comp, layer, 'cam.target', '目标点坐标', cam.target);
      }
      this._renderAnimProp(sec.body, comp, layer, 'cam.fov', '垂直视角 FOV °', cam.fov);
      this._renderAnimProp(sec.body, comp, layer, 'cam.focusDistance', '对焦距离 (px)', cam.focusDistance);
      this._renderAnimProp(sec.body, comp, layer, 'cam.aperture', '光圈模糊半径 (景深)', cam.aperture, { step: 1, precision: 1 });
      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderLightSection(comp, layer) {
      const lgt = layer.light;
      if (!lgt) return;
      const sec = this._createSection('三维光源与几何阴影 (2.11)', true);
      this._appendSelectRow(
        sec.body, '光源类型', lgt.lightType || 'directional',
        [['directional', '平行光 (Directional)'], ['point', '点光源 (Point)']],
        (t) => { lgt.lightType = t; }
      );
      this._renderAnimProp(sec.body, comp, layer, 'light.color', '灯光颜色', lgt.color);
      this._renderAnimProp(sec.body, comp, layer, 'light.intensity', '光照强度', lgt.intensity, { step: 0.05, precision: 2 });
      if (lgt.lightType === 'directional' && lgt.target) {
        this._renderAnimProp(sec.body, comp, layer, 'light.target', '平行光照射目标', lgt.target);
      } else if (lgt.range) {
        this._renderAnimProp(sec.body, comp, layer, 'light.range', '点光源作用半径', lgt.range);
      }
      this._appendCheckboxRow(sec.body, '产生真实几何阴影 (Shadow Map)', lgt.castShadows !== false, (c) => { lgt.castShadows = c; });
      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderFieldSection(comp, layer) {
      const f = layer.field;
      if (!f) return;
      const sec = this._createSection('空间场（同时作用于顶点变形与粒子）(2.8)', true);
      this._appendSelectRow(
        sec.body, '空间场类型', f.fieldType || 'radial',
        [['radial', '距离衰减场 (Radial)'], ['noise', '三维湍流噪波场 (Noise)'], ['vortex', '旋涡力场 (Vortex)']],
        (v) => { f.fieldType = v; Particles.invalidateAllParticleCaches(); }
      );
      if ((f.fieldType || 'radial') === 'radial') {
        this._appendSelectRow(
          sec.body, '径向作用模式', f.radialMode || 'dent',
          [['dent', '锻打塑性凹陷 (Dent)'], ['push', '球形推斥/吸引'], ['directional', '定向力矢量']],
          (v) => { f.radialMode = v; Particles.invalidateAllParticleCaches(); }
        );
      }
      this._appendSelectRow(
        sec.body, '多场混合模式', f.mixMode || 'add',
        [['add', '叠加 (Add)'], ['multiply', '相乘遮罩 (Multiply)'], ['subtract', '相减 (Subtract)']],
        (v) => { f.mixMode = v; Particles.invalidateAllParticleCaches(); }
      );
      this._renderAnimProp(sec.body, comp, layer, 'field.strength', '场强度', f.strength);
      this._renderAnimProp(sec.body, comp, layer, 'field.innerRadius', '满强度内半径', f.innerRadius);
      this._renderAnimProp(sec.body, comp, layer, 'field.outerRadius', '衰减外半径', f.outerRadius);
      this._renderAnimProp(sec.body, comp, layer, 'field.direction', '方向 / 旋转轴', f.direction);
      if (f.fieldType === 'noise') {
        this._renderAnimProp(sec.body, comp, layer, 'field.frequency', '噪波频率', f.frequency, { step: 0.002, precision: 3 });
      }
      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderParticleSection(comp, layer) {
      const pd = layer.particleData;
      if (!pd) return;
      const sec = this._createSection('三维粒子、多发射器、碰撞与拖尾 (2.13)', true);

      // Random seed
      this._appendSimpleNumRow(sec.body, '确定性随机种子', pd.seed ?? 2026, 1, (v) => {
        pd.seed = Math.round(v);
        Particles.invalidateAllParticleCaches();
      });

      // Multi-Emitters (`支持多个发射器: 点、曲线、变形后几何表面`)
      const addEmBtn = document.createElement('button');
      addEmBtn.className = 'btn-accent full';
      addEmBtn.textContent = '+ 新增粒子发射器 (点 / 曲线 / 变形几何表面)';
      addEmBtn.addEventListener('click', () => {
        this.app.recordAction('新增粒子发射器', () => {
          pd.emitters.push({
            id: uid('em'),
            name: `发射器 ${pd.emitters.length + 1}`,
            enabled: true,
            sourceType: 'point',
            sourceLayerId: '',
            focusByField: false,
            offset: Anim.createProp([0, 0, 0], 'vec3'),
            direction: [0, -1, -0.3],
            rate: Anim.createProp(60, 'scalar'),
            initialSpeed: Anim.createProp(260, 'scalar'),
            speedVariance: 0.35,
            spread: Anim.createProp(50, 'scalar'),
            lifetime: Anim.createProp(1.2, 'scalar'),
            lifetimeVariance: 0.25,
            inheritVelocity: 0.5,
            size: Anim.createProp(5, 'scalar')
          });
          Particles.invalidateAllParticleCaches();
        });
      });
      sec.body.appendChild(addEmBtn);

      const geoLayerOpts = [['', '（节点连接或自身坐标）']].concat(
        comp.layers
          .filter((l) => ['shape', 'text', 'solid3d', 'nodeGeo'].includes(l.type))
          .map((l, idx) => [l.id, `${idx + 1}. ${l.name}`])
      );

      (pd.emitters || []).forEach((em, idx) => {
        const sub = document.createElement('div');
        sub.className = 'sub-card';
        const hdr = document.createElement('div');
        hdr.className = 'sub-card-hdr';
        hdr.innerHTML = `<strong>✸ ${em.name || `发射器 ${idx + 1}`}</strong>`;
        if (pd.emitters.length > 1) {
          const del = document.createElement('button');
          del.className = 'icon-del-btn';
          del.textContent = '×';
          del.addEventListener('click', () => {
            this.app.recordAction('删除粒子发射器', () => {
              pd.emitters.splice(idx, 1);
              Particles.invalidateAllParticleCaches();
            });
          });
          hdr.appendChild(del);
        }
        sub.appendChild(hdr);

        this._appendSelectRow(
          sub, '发射源形态', em.sourceType || 'point',
          [['point', '点发射器 (Point)'], ['curve', '路径曲线 (Curve)'], ['surface', '实时变形几何表面 (Surface)']],
          (v) => { em.sourceType = v; Particles.invalidateAllParticleCaches(); }
        );
        if (em.sourceType === 'curve' || em.sourceType === 'surface') {
          this._appendSelectRow(sub, '发射几何图层', em.sourceLayerId || '', geoLayerOpts, (lid) => {
            em.sourceLayerId = lid;
            Particles.invalidateAllParticleCaches();
          });
        }
        this._renderAnimProp(sub, comp, layer, `part.em${idx}.rate`, '速率 (个/秒)', em.rate);
        this._renderAnimProp(sub, comp, layer, `part.em${idx}.speed`, '初速度 px/s', em.initialSpeed);
        this._renderAnimProp(sub, comp, layer, `part.em${idx}.spread`, '扩散角 °', em.spread);
        this._renderAnimProp(sub, comp, layer, `part.em${idx}.life`, '寿命 (秒)', em.lifetime, { step: 0.05, precision: 2 });
        this._renderAnimProp(sub, comp, layer, `part.em${idx}.size`, '初始大小 px', em.size);
        sec.body.appendChild(sub);
      });

      // Forces (`重力、方向力、吸引/排斥、2.8 空间场`)
      this._renderAnimProp(sec.body, comp, layer, 'part.gravity', '重力加速度', pd.gravity);
      this._renderAnimProp(sec.body, comp, layer, 'part.dirForce', '方向风力', pd.directionalForce);
      this._renderAnimProp(sec.body, comp, layer, 'part.drag', '空气阻力', pd.drag, { step: 0.05, precision: 2 });
      this._appendSimpleNumRow(sec.body, '2.8 空间场驱动强度', pd.fieldInfluence ?? 15, 1, (v) => {
        pd.fieldInfluence = v;
        Particles.invalidateAllParticleCaches();
      });
      this._appendCheckboxRow(sec.body, '启用吸引/排斥力点', Boolean(pd.attractorEnabled), (c) => {
        pd.attractorEnabled = c;
        Particles.invalidateAllParticleCaches();
      });
      if (pd.attractorEnabled) {
        this._renderAnimProp(sec.body, comp, layer, 'part.attrPos', '吸引/排斥中心', pd.attractorPos);
        this._renderAnimProp(sec.body, comp, layer, 'part.attrStr', '强度 (+吸引/-排斥)', pd.attractorStrength);
      }

      // Colliders (`碰撞表面、反弹摩擦、碰撞变色与次级发射`)
      const colWrap = document.createElement('div');
      colWrap.className = 'sub-card';
      colWrap.innerHTML = `<div class="sub-card-hdr"><strong>碰撞检测表面 & 次级火星</strong></div>`;
      comp.layers
        .filter((l) => ['solid3d', 'nodeGeo', 'shape', 'text'].includes(l.type) && l.id !== layer.id)
        .forEach((cand) => {
          const checked = (pd.colliderLayerIds || []).includes(cand.id);
          this._appendCheckboxRow(colWrap, `碰撞层：${cand.name}`, checked, (isChk) => {
            if (!pd.colliderLayerIds) pd.colliderLayerIds = [];
            if (isChk && !pd.colliderLayerIds.includes(cand.id)) pd.colliderLayerIds.push(cand.id);
            if (!isChk) pd.colliderLayerIds = pd.colliderLayerIds.filter((id) => id !== cand.id);
            Particles.invalidateAllParticleCaches();
          });
        });
      this._renderAnimProp(colWrap, comp, layer, 'part.bounce', '表面反弹系数', pd.bounce, { step: 0.05, precision: 2 });
      this._renderAnimProp(colWrap, comp, layer, 'part.friction', '表面动摩擦系数', pd.friction, { step: 0.05, precision: 2 });
      this._appendSimpleNumRow(colWrap, '碰撞触发次级火花数', pd.secondaryOnHitCount ?? 2, 1, (v) => {
        pd.secondaryOnHitCount = clamp(Math.round(v), 0, 8);
        Particles.invalidateAllParticleCaches();
      });
      sec.body.appendChild(colWrap);

      // Trajectory Trails (`三维轨迹拖尾`)
      this._appendCheckboxRow(sec.body, '启用粒子真实轨迹三维拖尾', pd.trailsEnabled !== false, (c) => {
        pd.trailsEnabled = c;
        Particles.invalidateAllParticleCaches();
      });
      if (pd.trailsEnabled !== false) {
        this._appendSimpleNumRow(sec.body, '拖尾采样长度', pd.trailSteps ?? 10, 1, (v) => {
          pd.trailSteps = clamp(Math.round(v), 2, 32);
          Particles.invalidateAllParticleCaches();
        });
        this._appendSimpleNumRow(sec.body, '拖尾宽度倍率', pd.trailWidth ?? 0.72, 0.05, (v) => {
          pd.trailWidth = clamp(v, 0.05, 5);
        });
      }

      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderMasksSection(comp, layer) {
      const hasMasks = layer.masks && layer.masks.length > 0;
      const sec = this._createSection(`图层蒙版 (${(layer.masks || []).length}) (2.9)`, hasMasks);

      const addRow = document.createElement('div');
      addRow.className = 'add-layer-grid';
      [
        ['+ 矩形蒙版', () => layer.masks.push(Scene.createLayerMask('rect', 300, 200))],
        ['+ 椭圆蒙版', () => layer.masks.push(Scene.createLayerMask('ellipse', 280, 220))],
        ['+ 钢笔自由蒙版', () => this.app.setTool('pen')]
      ].forEach(([lbl, fn]) => {
        const b = document.createElement('button');
        b.className = 'btn-chip';
        b.textContent = lbl;
        b.addEventListener('click', () => this.app.recordAction(lbl, fn));
        addRow.appendChild(b);
      });
      sec.body.appendChild(addRow);

      (layer.masks || []).forEach((mk, idx) => {
        const sub = document.createElement('div');
        sub.className = 'sub-card';
        const hdr = document.createElement('div');
        hdr.className = 'sub-card-hdr';
        hdr.innerHTML = `<strong>🎭 ${mk.name || `蒙版 ${idx + 1}`}</strong>`;
        const del = document.createElement('button');
        del.className = 'icon-del-btn';
        del.textContent = '×';
        del.addEventListener('click', () => this.app.recordAction('删除蒙版', () => layer.masks.splice(idx, 1)));
        hdr.appendChild(del);
        sub.appendChild(hdr);

        this._appendSelectRow(
          sub, '蒙版布尔', mk.mode || 'add',
          [['add', '相加 (Add)'], ['subtract', '相减 (Subtract)'], ['intersect', '交集 (Intersect)']],
          (m) => { mk.mode = m; }
        );
        this._appendCheckboxRow(sub, '反转蒙版 (Inverted)', Boolean(mk.inverted), (c) => { mk.inverted = c; });
        this._renderAnimProp(sub, comp, layer, `mask.${idx}.feather`, '蒙版羽化 px', mk.feather);
        this._renderAnimProp(sub, comp, layer, `mask.${idx}.opacity`, '蒙版不透明度 %', mk.opacity);

        const kfBtn = document.createElement('button');
        kfBtn.className = 'btn-subtle full';
        kfBtn.textContent = mk.path.animated ? '◆ 记录当前蒙版路径关键帧' : '⏱ 开启蒙版路径动画';
        kfBtn.addEventListener('click', () => {
          this.app.recordAction('蒙版路径关键帧', () => {
            if (!mk.path.animated) Anim.togglePropStopwatch(mk.path, this.app.currentTime);
            else {
              const cur = Anim.evalProp(mk.path, this.app.currentTime, { project: this.app.project, comp, layer });
              Anim.setPropValueAtTime(mk.path, Geo2D.cloneContours(cur), this.app.currentTime);
            }
          });
        });
        sub.appendChild(kfBtn);
        sec.body.appendChild(sub);
      });

      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderEffectsSection(comp, layer) {
      const hasFx = layer.effects && layer.effects.length > 0;
      const sec = this._createSection(`效果栈 (${(layer.effects || []).length}) (2.9)`, hasFx);

      const addRow = document.createElement('div');
      addRow.className = 'add-layer-grid';
      [
        ['gaussianBlur', '+ 高斯模糊'],
        ['glow', '+ 辉光发光'],
        ['dropShadow', '+ 投影'],
        ['hsl', '+ 色相/饱和/亮']
      ].forEach(([fxType, lbl]) => {
        const b = document.createElement('button');
        b.className = 'btn-chip';
        b.textContent = lbl;
        b.addEventListener('click', () => {
          this.app.recordAction(`添加效果: ${lbl}`, () => {
            if (!layer.effects) layer.effects = [];
            layer.effects.push(Scene.createEffectInstance(fxType));
          });
        });
        addRow.appendChild(b);
      });
      sec.body.appendChild(addRow);

      (layer.effects || []).forEach((fx, idx) => {
        const sub = document.createElement('div');
        sub.className = 'sub-card';
        const hdr = document.createElement('div');
        hdr.className = 'sub-card-hdr';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = fx.enabled !== false;
        chk.addEventListener('change', () => {
          this.app.recordAction('切换效果开关', () => { fx.enabled = chk.checked; });
        });
        const title = document.createElement('span');
        title.innerHTML = ` <strong>${idx + 1}. ${fx.name}</strong>`;
        const left = document.createElement('div');
        left.append(chk, title);

        const ctrls = document.createElement('div');
        ctrls.className = 'sub-card-btns';
        const up = document.createElement('button');
        up.textContent = '▲';
        up.disabled = idx === 0;
        up.addEventListener('click', () => {
          this.app.recordAction('上移效果顺序', () => {
            const [m] = layer.effects.splice(idx, 1);
            layer.effects.splice(idx - 1, 0, m);
          });
        });
        const dn = document.createElement('button');
        dn.textContent = '▼';
        dn.disabled = idx === layer.effects.length - 1;
        dn.addEventListener('click', () => {
          this.app.recordAction('下移效果顺序', () => {
            const [m] = layer.effects.splice(idx, 1);
            layer.effects.splice(idx + 1, 0, m);
          });
        });
        const del = document.createElement('button');
        del.className = 'icon-del-btn';
        del.textContent = '×';
        del.addEventListener('click', () => {
          this.app.recordAction('删除效果', () => layer.effects.splice(idx, 1));
        });
        ctrls.append(up, dn, del);
        hdr.append(left, ctrls);
        sub.appendChild(hdr);

        Object.entries(fx.params || {}).forEach(([pk, pv]) => {
          if (pv && typeof pv === 'object' && 'value' in pv) {
            this._renderAnimProp(sub, comp, layer, `fx.${idx}.${pk}`, pv.name || pk, pv);
          }
        });
        sec.body.appendChild(sub);
      });

      this.inspectorBodyEl.appendChild(sec.el);
    }

    _renderAudioSection(comp, layer) {
      const ad = layer.audioData;
      if (!ad) return;
      const sec = this._createSection('内置音色合成与发声事件 (2.15)', true);

      this._appendSelectRow(
        sec.body, '合成器音色', ad.patch || 'anvil_strike',
        Object.entries(AudioMod.SYNTH_PATCHES).map(([k, v]) => [k, v.name]),
        (p) => { ad.patch = p; }
      );

      const testBtn = document.createElement('button');
      testBtn.className = 'btn-accent full';
      testBtn.textContent = '🔊 试听当前内置音色';
      testBtn.addEventListener('click', () => {
        AudioMod.engine.unlock();
        AudioMod.engine.triggerSynthEvent(
          ad.patch || 'anvil_strike',
          {
            volume: Anim.evalProp(ad.volume, this.app.currentTime, { project: this.app.project, comp, layer }),
            pitchShift: Anim.evalProp(ad.pitchShift, this.app.currentTime, { project: this.app.project, comp, layer }),
            tone: Anim.evalProp(ad.tone, this.app.currentTime, { project: this.app.project, comp, layer }),
            decay: Anim.evalProp(ad.decay, this.app.currentTime, { project: this.app.project, comp, layer })
          },
          { time: 0, duration: 0.9, pitch: 0, velocity: 0.95 },
          0
        );
      });
      sec.body.appendChild(testBtn);

      this._renderAnimProp(sec.body, comp, layer, 'audio.volume', '音量 %', ad.volume);
      this._renderAnimProp(sec.body, comp, layer, 'audio.pitchShift', '音高偏移 (半音)', ad.pitchShift);
      this._renderAnimProp(sec.body, comp, layer, 'audio.tone', '音色明暗 %', ad.tone);
      this._renderAnimProp(sec.body, comp, layer, 'audio.decay', '衰减倍率', ad.decay, { step: 0.05, precision: 2 });

      const addEvBtn = document.createElement('button');
      addEvBtn.className = 'btn-subtle full';
      addEvBtn.textContent = `+ 在当前播放头 (${this.app.currentTime.toFixed(2)}s) 插入发声点`;
      addEvBtn.addEventListener('click', () => {
        this.app.recordAction('添加音色触发点', () => {
          if (!ad.events) ad.events = [];
          ad.events.push({ id: uid('aev'), time: Number(this.app.currentTime.toFixed(3)), duration: 0.85, pitch: 0, velocity: 0.92 });
          ad.events.sort((a, b) => a.time - b.time);
        });
      });
      sec.body.appendChild(addEvBtn);

      (ad.events || []).forEach((ev, idx) => {
        const row = document.createElement('div');
        row.className = 'ins-row';
        row.innerHTML = `<label>重音 #${idx + 1}</label>`;
        const tInp = document.createElement('input');
        tInp.type = 'number';
        tInp.step = '0.05';
        tInp.style.width = '68px';
        tInp.title = '触发时刻 (秒)';
        tInp.value = Number(ev.time).toFixed(2);
        tInp.addEventListener('change', () => {
          this.app.recordAction('修改音色触发时刻', () => {
            ev.time = clamp(parseFloat(tInp.value) || 0, 0, comp.duration);
          });
        });

        const pInp = document.createElement('input');
        pInp.type = 'number';
        pInp.step = '1';
        pInp.style.width = '52px';
        pInp.title = '相对音高 (半音)';
        pInp.value = String(ev.pitch ?? 0);
        pInp.addEventListener('change', () => {
          this.app.recordAction('修改音色触发音高', () => {
            ev.pitch = clamp(parseFloat(pInp.value) || 0, -24, 24);
          });
        });

        const del = document.createElement('button');
        del.className = 'icon-del-btn';
        del.textContent = '×';
        del.addEventListener('click', () => {
          this.app.recordAction('删除音色触发点', () => ad.events.splice(idx, 1));
        });
        row.append(tInp, pInp, del);
        sec.body.appendChild(row);
      });

      this.inspectorBodyEl.appendChild(sec.el);
    }

    // =========================================================================
    // UI DOM HELPERS
    // =========================================================================
    _createSection(title, openByDefault = true) {
      const el = document.createElement('details');
      el.className = 'ins-section';
      el.open = openByDefault;
      const sum = document.createElement('summary');
      sum.textContent = title;
      const body = document.createElement('div');
      body.className = 'ins-section-body';
      el.append(sum, body);
      return { el, body };
    }

    _appendSimpleTextRow(parent, label, val, onCommit) {
      const r = document.createElement('div');
      r.className = 'ins-row';
      const l = document.createElement('label');
      l.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = val ?? '';
      inp.addEventListener('change', () => {
        this.app.recordAction(`修改 ${label}`, () => onCommit(inp.value));
      });
      r.append(l, inp);
      parent.appendChild(r);
    }

    _appendSimpleNumRow(parent, label, val, step, onCommit) {
      const r = document.createElement('div');
      r.className = 'ins-row';
      const l = document.createElement('label');
      l.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = String(step || 1);
      inp.value = String(val);
      inp.addEventListener('change', () => {
        const nv = parseFloat(inp.value);
        if (Number.isFinite(nv)) this.app.recordAction(`修改 ${label}`, () => onCommit(nv));
      });
      r.append(l, inp);
      parent.appendChild(r);
    }

    _appendDualNumRow(parent, label, v1, v2, onCommit) {
      const r = document.createElement('div');
      r.className = 'ins-row';
      const l = document.createElement('label');
      l.textContent = label;
      const wrap = document.createElement('div');
      wrap.className = 'dual-num';
      const i1 = document.createElement('input');
      i1.type = 'number';
      i1.step = 'any';
      i1.value = Number(v1).toFixed(v1 % 1 === 0 ? 0 : 2);
      const i2 = document.createElement('input');
      i2.type = 'number';
      i2.step = 'any';
      i2.value = Number(v2).toFixed(v2 % 1 === 0 ? 0 : 2);
      const apply = () => {
        const n1 = parseFloat(i1.value);
        const n2 = parseFloat(i2.value);
        if (Number.isFinite(n1) && Number.isFinite(n2)) {
          this.app.recordAction(`修改 ${label}`, () => onCommit(n1, n2));
        }
      };
      i1.addEventListener('change', apply);
      i2.addEventListener('change', apply);
      wrap.append(i1, i2);
      r.append(l, wrap);
      parent.appendChild(r);
    }

    _appendCheckboxRow(parent, label, checked, onCommit) {
      const r = document.createElement('label');
      r.className = 'ins-check-row';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = Boolean(checked);
      chk.addEventListener('change', () => {
        this.app.recordAction(`切换 ${label}`, () => onCommit(chk.checked));
      });
      r.append(chk, document.createTextNode(` ${label}`));
      parent.appendChild(r);
    }

    _appendSelectRow(parent, label, curVal, options, onCommit) {
      const r = document.createElement('div');
      r.className = 'ins-row';
      const l = document.createElement('label');
      l.textContent = label;
      const sel = document.createElement('select');
      for (const [val, txt] of options) {
        const o = document.createElement('option');
        o.value = val;
        o.textContent = txt;
        sel.appendChild(o);
      }
      sel.value = curVal ?? '';
      sel.addEventListener('change', () => {
        this.app.recordAction(`修改 ${label}`, () => onCommit(sel.value));
      });
      r.append(l, sel);
      parent.appendChild(r);
    }
  }

  Forge.InspectorView = {
    InspectorController
  };
})();
