// 右侧属性检查器面板：统一编辑选中图层（或合成）全部可关键帧属性、表达式编辑器、形状操作符/布尔/操纵点图钉、文字/动画器、三维挤出/变形/PBR材质、空间场、粒子与碰撞体、音色、蒙版与效果栈

import { clamp } from '../core/math.js';
import {
  addOrUpdateKeyframe,
  removeKeyframeById,
  invalidateSpatialCache,
  cloneVal,
} from '../core/property.js';
import { evalProperty, resolvePropertyByPath } from '../core/expressions.js';
import {
  getActiveComp,
  getLayerById,
  createEffect,
  createMask,
  createShapeOperator,
  createPuppetPin,
  createSpatialField,
  createParticleEmitter,
  createLayer,
  moveAnchorPreserveVisual,
  reparentLayerPreserveVisual,
  genId,
} from '../core/project.js';
import { getAvailableFonts, getUnsupportedChars, textToGeometry } from '../geometry/fonts.js';
import { AUDIO_PRESETS } from '../audio/synth.js';
import {
  el,
  LAYER_TYPE_META,
  createScrubInput,
  rgb01ToHex,
  hexToRgb01,
  showToast,
} from './helpers.js';

const BLEND_MODES = [
  { value: 'normal', label: '正常 (Normal)' },
  { value: 'add', label: '相加 (Add)' },
  { value: 'screen', label: '滤色 (Screen)' },
  { value: 'multiply', label: '正片叠底 (Multiply)' },
  { value: 'overlay', label: '叠加 (Overlay)' },
];

const TRACK_MATTE_MODES = [
  { value: 'none', label: '无轨道遮罩' },
  { value: 'alpha', label: 'Alpha 遮罩 (显示有 Alpha 区域)' },
  { value: 'alphaInv', label: 'Alpha 反转遮罩' },
  { value: 'luma', label: '亮度遮罩 (Luma)' },
  { value: 'lumaInv', label: '亮度反转遮罩' },
];

export class PropertiesPanel {
  constructor(containerEl, app) {
    this.containerEl = containerEl;
    this.app = app;
    this._expandedExprPaths = new Set();
    this._anchorPreserveMode = true;
    this._liveUpdaters = []; // () => void 快速同步数值，无需重建 DOM

    this._renderSkeleton();
  }

  _renderSkeleton() {
    this.containerEl.innerHTML = '';
    this.headerEl = el('div', { className: 'panel-header' }, [
      el('span', { className: 'panel-title', text: '属性与效果控制' }),
    ]);
    this.bodyEl = el('div', { className: 'panel-scroll props-body' });
    this.containerEl.appendChild(this.headerEl);
    this.containerEl.appendChild(this.bodyEl);
  }

  refreshValuesOnly() {
    for (const fn of this._liveUpdaters) {
      fn();
    }
  }

  _makeSection(title, extraRight = null, startCollapsed = false) {
    const sec = el('div', { className: `prop-sec ${startCollapsed ? 'collapsed' : ''}` });
    const arrow = el('span', { className: 'prop-sec-arrow', text: startCollapsed ? '▸' : '▾' });
    const head = el('div', {
      className: 'prop-sec-head',
      onClick: (e) => {
        if (e.target.closest('button, select, input')) return;
        sec.classList.toggle('collapsed');
        arrow.textContent = sec.classList.contains('collapsed') ? '▸' : '▾';
      },
    }, [
      el('span', { className: 'prop-sec-title' }, [arrow, document.createTextNode(title)]),
      extraRight ? el('div', { className: 'prop-sec-actions' }, extraRight) : null,
    ]);
    const body = el('div', { className: 'prop-sec-body' });
    sec.appendChild(head);
    sec.appendChild(body);
    return { sec, body };
  }

  // 构建可关键帧 + 表达式的通用属性行
  _buildPropRow(layer, propPath, overrideLabel = null, customOpts = {}) {
    const project = this.app.project;
    const comp = getActiveComp(project);
    const prop = resolvePropertyByPath(layer, propPath);
    if (!prop || !comp) return null;

    const label = overrideLabel || prop.label || propPath;
    const t = comp.currentTime;
    const isExprOpen = this._expandedExprPaths.has(`${layer.id}::${propPath}`) || prop.expressionEnabled;

    const rowWrap = el('div', { className: 'prop-item-wrap' });
    const mainRow = el('div', { className: 'prop-row' });

    // 秒表 + 加关键帧 + 图表按钮 + 表达式按钮
    const swBtn = el('button', {
      className: `ae-tiny-btn ${prop.animated ? 'sw-on' : ''}`,
      text: '⏱',
      title: '切换关键帧动画开关',
      onClick: () => {
        this.app.history.recordAction(project, `切换动画 ${label}`, () => {
          if (prop.animated) {
            prop.value = cloneVal(evalProperty(project, comp, layer, propPath, comp.currentTime));
            prop.keyframes = [];
            prop.animated = false;
          } else {
            prop.animated = true;
            addOrUpdateKeyframe(prop, comp.currentTime, evalProperty(project, comp, layer, propPath, comp.currentTime));
          }
        });
        this.app.refreshAll();
      },
    });

    const kfBtn = el('button', {
      className: 'ae-tiny-btn',
      text: '◆',
      title: '在当前时间添加/删除关键帧',
      onClick: () => {
        this.app.history.recordAction(project, `关键帧操作 ${label}`, () => {
          const ex = (prop.keyframes || []).find((k) => Math.abs(k.time - comp.currentTime) < 0.015);
          if (ex) {
            removeKeyframeById(prop, ex.id);
            if (prop.keyframes.length === 0) prop.animated = false;
          } else {
            prop.animated = true;
            addOrUpdateKeyframe(prop, comp.currentTime, evalProperty(project, comp, layer, propPath, comp.currentTime));
          }
        });
        this.app.refreshAll();
      },
    });

    const exprBtn = el('button', {
      className: `ae-tiny-btn fx-btn ${prop.expressionEnabled ? 'fx-on' : ''}`,
      text: 'fx',
      title: '展开/启用表达式编辑器',
      onClick: () => {
        const key = `${layer.id}::${propPath}`;
        if (this._expandedExprPaths.has(key)) this._expandedExprPaths.delete(key);
        else this._expandedExprPaths.add(key);
        if (!prop.expressionEnabled && !this._expandedExprPaths.has(key)) {
          prop.expressionEnabled = false;
        }
        this.render();
      },
    });

    const graphBtn = el('button', {
      className: 'ae-tiny-btn',
      text: '📈',
      title: '在曲线编辑器中打开',
      onClick: () => {
        this.app.setGraphTarget(layer.id, propPath, true);
      },
    });

    const controlsBox = el('div', { className: 'prop-ctrl-box' });
    const curVal = evalProperty(project, comp, layer, propPath, t);

    const commitNewValue = (nextVal, labelOp = `调整 ${label}`) => {
      if (customOpts.onCustomApply) {
        customOpts.onCustomApply(nextVal);
        return;
      }
      this.app.setPropertyValue(layer, propPath, nextVal, comp.currentTime);
    };

    if (prop.type === 'number') {
      const scrub = createScrubInput({
        value: Number(curVal) || 0,
        min: prop.min ?? -1e6,
        max: prop.max ?? 1e6,
        step: prop.step ?? 1,
        precision: (prop.step && prop.step < 0.1) ? 3 : 2,
        onBeginDrag: () => this.app.history.beginTransaction(project, `编辑 ${label}`),
        onPreview: (v) => {
          commitNewValue(v);
          this.app.renderCurrentFrame();
          this.app.timelinePanel?.updatePlayheadOnly();
        },
        onCommit: () => {
          this.app.history.commitTransaction(project);
          this.app.refreshAll();
        },
      });
      controlsBox.appendChild(scrub);
      this._liveUpdaters.push(() => {
        const c = getActiveComp(this.app.project);
        if (!c) return;
        scrub.setValue(evalProperty(this.app.project, c, layer, propPath, c.currentTime));
        kfBtn.classList.toggle('kf-at-now', !!prop.animated && prop.keyframes.some((k) => Math.abs(k.time - c.currentTime) < 0.015));
      });
    } else if (prop.type === 'vec2' || prop.type === 'vec3') {
      const count = prop.type === 'vec2' ? 2 : (layer.is3D || propPath !== 'transform.position' && propPath !== 'transform.anchorPoint' && propPath !== 'transform.scale' ? 3 : 2);
      const axisNames = ['X', 'Y', 'Z'];
      const scrubs = [];
      for (let i = 0; i < count; i++) {
        const sc = createScrubInput({
          value: Array.isArray(curVal) ? (curVal[i] ?? 0) : 0,
          step: prop.step ?? (propPath.includes('scale') ? 1 : 1),
          precision: prop.step && prop.step < 0.1 ? 3 : 1,
          onBeginDrag: () => this.app.history.beginTransaction(project, `编辑 ${label}`),
          onPreview: (v) => {
            const latest = cloneVal(evalProperty(project, comp, layer, propPath, comp.currentTime));
            const arr = Array.isArray(latest) ? [...latest] : [0, 0, 0];
            arr[i] = v;
            commitNewValue(arr);
            this.app.renderCurrentFrame();
            this.app.timelinePanel?.updatePlayheadOnly();
          },
          onCommit: () => {
            this.app.history.commitTransaction(project);
            this.app.refreshAll();
          },
        });
        scrubs.push(sc);
        controlsBox.appendChild(el('span', { className: 'prop-axis-pair' }, [
          el('span', { className: 'prop-axis-lbl', text: axisNames[i] }),
          sc,
        ]));
      }
      this._liveUpdaters.push(() => {
        const c = getActiveComp(this.app.project);
        if (!c) return;
        const v = evalProperty(this.app.project, c, layer, propPath, c.currentTime);
        scrubs.forEach((sc, idx) => sc.setValue(Array.isArray(v) ? (v[idx] ?? 0) : 0));
        kfBtn.classList.toggle('kf-at-now', !!prop.animated && prop.keyframes.some((k) => Math.abs(k.time - c.currentTime) < 0.015));
      });
    } else if (prop.type === 'color') {
      const colorInp = el('input', {
        type: 'color',
        className: 'ae-color-inp',
        value: rgb01ToHex(curVal),
        onInput: () => {
          this.app.history.beginTransaction(project, `调整颜色 ${label}`);
          const old = evalProperty(project, comp, layer, propPath, comp.currentTime);
          const next = hexToRgb01(colorInp.value, Array.isArray(old) ? (old[3] ?? 1) : 1);
          commitNewValue(next);
          this.app.renderCurrentFrame();
        },
        onChange: () => {
          this.app.history.commitTransaction(project);
          this.app.refreshAll();
        },
      });
      const alphaSc = createScrubInput({
        value: Array.isArray(curVal) ? (curVal[3] ?? 1) : 1,
        min: 0,
        max: 1,
        step: 0.02,
        precision: 2,
        unit: 'A',
        onBeginDrag: () => this.app.history.beginTransaction(project, `调整透明通道 ${label}`),
        onPreview: (v) => {
          const old = evalProperty(project, comp, layer, propPath, comp.currentTime);
          const next = [...(Array.isArray(old) ? old : [1, 1, 1, 1])];
          next[3] = clamp(v, 0, 1);
          commitNewValue(next);
          this.app.renderCurrentFrame();
        },
        onCommit: () => {
          this.app.history.commitTransaction(project);
          this.app.refreshAll();
        },
      });
      controlsBox.appendChild(colorInp);
      controlsBox.appendChild(alphaSc);
      this._liveUpdaters.push(() => {
        const c = getActiveComp(this.app.project);
        if (!c) return;
        const v = evalProperty(this.app.project, c, layer, propPath, c.currentTime);
        if (document.activeElement !== colorInp) colorInp.value = rgb01ToHex(v);
        alphaSc.setValue(Array.isArray(v) ? (v[3] ?? 1) : 1);
      });
    } else if (prop.type === 'path') {
      controlsBox.appendChild(
        el('span', {
          className: 'prop-path-summary',
          text: `${curVal?.contours?.length || 0} 条轮廓 (${curVal?.contours?.[0]?.points?.length || 0} 点)`,
        })
      );
    }

    kfBtn.classList.toggle('kf-at-now', !!prop.animated && prop.keyframes.some((k) => Math.abs(k.time - t) < 0.015));

    mainRow.appendChild(el('div', { className: 'prop-left' }, [swBtn, kfBtn, exprBtn, graphBtn, el('span', { className: 'prop-lbl', text: label, title: propPath })]));
    mainRow.appendChild(controlsBox);
    rowWrap.appendChild(mainRow);

    // 表达式折叠区
    if (isExprOpen) {
      const exprErr = layer._exprErrors?.[propPath];
      const exprBox = el('div', { className: 'prop-expr-box' });
      const enableCb = el('input', {
        type: 'checkbox',
        checked: !!prop.expressionEnabled,
        onChange: () => {
          this.app.history.recordAction(project, '开关表达式', () => {
            prop.expressionEnabled = enableCb.checked;
            if (!prop.expressionEnabled && layer._exprErrors) delete layer._exprErrors[propPath];
          });
          this.app.refreshAll();
        },
      });
      const ta = el('textarea', {
        className: 'prop-expr-ta',
        rows: 2,
        placeholder: '示例: wiggle(3, 25) 或 loopOut("pingpong") 或 ease(time, 0, 2, 0, 100)',
        value: prop.expression || '',
      });
      const applyExpr = () => {
        this.app.history.recordAction(project, '编辑表达式', () => {
          prop.expression = ta.value;
          prop.expressionEnabled = ta.value.trim().length > 0;
        });
        this.app.refreshAll();
      };
      ta.addEventListener('change', applyExpr);
      ta.addEventListener('keydown', (ke) => {
        if (ke.ctrlKey && ke.key === 'Enter') applyExpr();
      });

      const snippets = [
        { lbl: 'wiggle', code: 'value + wiggle(3, 25)' },
        { lbl: 'loopCycle', code: 'loopOut("cycle")' },
        { lbl: 'loopPingPong', code: 'loopOut("pingpong")' },
        { lbl: 'ease时间', code: 'ease(time, 0, 2, 0, 100)' },
        { lbl: '延迟跟随', code: 'thisComp.layer(Math.max(1, index - 1)).transform.position.valueAtTime(time - 0.15)' },
      ];
      const snipRow = el('div', { className: 'prop-expr-snips' }, [
        el('label', { className: 'prop-expr-chk' }, [enableCb, el('span', { text: '启用表达式' })]),
        ...snippets.map((s) =>
          el('button', {
            className: 'ae-micro-btn',
            text: s.lbl,
            title: s.code,
            onClick: () => {
              ta.value = s.code;
              applyExpr();
            },
          })
        ),
        el('button', { className: 'ae-micro-btn primary', text: '应用', onClick: applyExpr }),
      ]);

      exprBox.appendChild(snipRow);
      exprBox.appendChild(ta);
      if (exprErr) {
        exprBox.appendChild(el('div', { className: 'prop-expr-err', text: `表达式错误(已回退基础值): ${exprErr}` }));
      }
      rowWrap.appendChild(exprBox);
    }

    return rowWrap;
  }

  render() {
    const project = this.app.project;
    const comp = getActiveComp(project);
    this._liveUpdaters = [];
    this.bodyEl.innerHTML = '';
    if (!project || !comp) return;

    const selIds = project.selectedLayerIds || [];
    const layer = selIds.length ? getLayerById(comp, selIds[selIds.length - 1]) : null;

    if (!layer) {
      this._renderCompSummary(comp);
      return;
    }

    const meta = LAYER_TYPE_META[layer.type] || { label: layer.type, color: '#64748b', short: '?' };

    // 顶部图层卡头 + 混合模式 + 父子联动 + 轨道遮罩
    const topCard = el('div', { className: 'prop-top-card' }, [
      el('div', { className: 'prop-top-row' }, [
        el('span', { className: 'tl-type-badge', style: { backgroundColor: meta.color }, text: meta.short }),
        el('input', {
          type: 'text',
          className: 'ae-input sm prop-name-inp',
          value: layer.name,
          onChange: (e) => {
            this.app.history.recordAction(project, '重命名图层', () => {
              layer.name = e.target.value.trim() || layer.name;
            });
            this.app.refreshAll();
          },
        }),
        el('label', { className: 'prop-chip-chk' }, [
          el('input', {
            type: 'checkbox',
            checked: !!layer.is3D,
            onChange: (e) => {
              this.app.history.recordAction(project, '切换 3D 图层', () => {
                layer.is3D = e.target.checked;
              });
              this.app.refreshAll();
            },
          }),
          el('span', { text: '3D' }),
        ]),
        el('label', { className: 'prop-chip-chk' }, [
          el('input', {
            type: 'checkbox',
            checked: !!layer.motionBlur,
            onChange: (e) => {
              this.app.history.recordAction(project, '切换运动模糊', () => {
                layer.motionBlur = e.target.checked;
              });
              this.app.refreshAll();
            },
          }),
          el('span', { text: '模糊' }),
        ]),
      ]),
      el('div', { className: 'prop-comp-grid' }, [
        el('label', { className: 'prop-mini-field' }, [
          el('span', { text: '混合模式' }),
          (() => {
            const s = el('select', { className: 'ae-select sm' }, BLEND_MODES.map((m) =>
              el('option', { value: m.value, text: m.label, selected: layer.blendMode === m.value })
            ));
            s.addEventListener('change', () => {
              this.app.history.recordAction(project, '修改混合模式', () => {
                layer.blendMode = s.value;
              });
              this.app.refreshAll();
            });
            return s;
          })(),
        ]),
        el('label', { className: 'prop-mini-field' }, [
          el('span', { text: '父级联动' }),
          (() => {
            const s = el('select', { className: 'ae-select sm' }, [
              el('option', { value: '', text: '无父级', selected: !layer.parentId }),
              ...comp.layers.filter((o) => o.id !== layer.id).map((o) =>
                el('option', { value: o.id, text: o.name, selected: layer.parentId === o.id })
              ),
            ]);
            s.addEventListener('change', () => {
              this.app.history.recordAction(project, '重设父级(保持当前姿态)', () => {
                if (!reparentLayerPreserveVisual(project, comp, layer, s.value || null, comp.currentTime)) {
                  showToast('禁止循环父级', 'warn');
                }
              });
              this.app.refreshAll();
            });
            return s;
          })(),
        ]),
      ]),
    ]);

    // 轨道遮罩配置行
    const tmRow = el('div', { className: 'prop-comp-grid' }, [
      el('label', { className: 'prop-mini-field' }, [
        el('span', { text: '轨道遮罩' }),
        (() => {
          const s = el('select', { className: 'ae-select sm' }, TRACK_MATTE_MODES.map((m) =>
            el('option', { value: m.value, text: m.label, selected: (layer.trackMatte?.mode || 'none') === m.value })
          ));
          s.addEventListener('change', () => {
            this.app.history.recordAction(project, '修改轨道遮罩模式', () => {
              if (!layer.trackMatte) layer.trackMatte = { sourceLayerId: null, mode: 'none' };
              layer.trackMatte.mode = s.value;
              if (s.value !== 'none' && !layer.trackMatte.sourceLayerId) {
                const idx = comp.layers.findIndex((x) => x.id === layer.id);
                const above = idx > 0 ? comp.layers[idx - 1] : comp.layers.find((x) => x.id !== layer.id);
                if (above) layer.trackMatte.sourceLayerId = above.id;
              }
            });
            this.app.refreshAll();
          });
          return s;
        })(),
      ]),
      el('label', { className: 'prop-mini-field' }, [
        el('span', { text: '遮罩源图层' }),
        (() => {
          const s = el('select', { className: 'ae-select sm' }, [
            el('option', { value: '', text: '无源图层', selected: !layer.trackMatte?.sourceLayerId }),
            ...comp.layers.filter((o) => o.id !== layer.id).map((o) =>
              el('option', { value: o.id, text: o.name, selected: layer.trackMatte?.sourceLayerId === o.id })
            ),
          ]);
          s.addEventListener('change', () => {
            this.app.history.recordAction(project, '设置轨道遮罩源图层', () => {
              if (!layer.trackMatte) layer.trackMatte = { sourceLayerId: null, mode: 'alpha' };
              layer.trackMatte.sourceLayerId = s.value || null;
              if (s.value && layer.trackMatte.mode === 'none') layer.trackMatte.mode = 'alpha';
            });
            this.app.refreshAll();
          });
          return s;
        })(),
      ]),
    ]);
    topCard.appendChild(tmRow);
    this.bodyEl.appendChild(topCard);

    // 1. 变换 (Transform)
    const { sec: trSec, body: trBody } = this._makeSection('变换 (Transform)', [
      el('label', { className: 'prop-mini-chk', title: '调节锚点数值时自动补偿位置，保持当前帧视觉位置不变' }, [
        el('input', {
          type: 'checkbox',
          checked: this._anchorPreserveMode,
          onChange: (e) => { this._anchorPreserveMode = e.target.checked; },
        }),
        el('span', { text: '锚点保形' }),
      ]),
    ]);
    trBody.appendChild(this._buildPropRow(layer, 'transform.anchorPoint', '锚点', {
      onCustomApply: this._anchorPreserveMode
        ? (newAnchor) => {
            const res = moveAnchorPreserveVisual(project, comp, layer, newAnchor, comp.currentTime);
            this.app.setPropertyValue(layer, 'transform.anchorPoint', res.anchorPoint, comp.currentTime);
            this.app.setPropertyValue(layer, 'transform.position', res.position, comp.currentTime);
          }
        : null,
    }));
    trBody.appendChild(this._buildPropRow(layer, 'transform.position', '位置'));
    trBody.appendChild(this._buildPropRow(layer, 'transform.scale', '缩放 (%)'));
    if (layer.is3D) {
      trBody.appendChild(this._buildPropRow(layer, 'transform.rotationX', 'X 旋转 (°)'));
      trBody.appendChild(this._buildPropRow(layer, 'transform.rotationY', 'Y 旋转 (°)'));
      trBody.appendChild(this._buildPropRow(layer, 'transform.rotationZ', 'Z 旋转 (°)'));
    } else {
      trBody.appendChild(this._buildPropRow(layer, 'transform.rotation', '旋转 (°)'));
    }
    trBody.appendChild(this._buildPropRow(layer, 'transform.opacity', '不透明度 (%)'));
    this.bodyEl.appendChild(trSec);

    // 2. 图层专用模块
    if (layer.type === 'shape') this._renderShapeSection(project, comp, layer);
    if (layer.type === 'text') this._renderTextSection(project, comp, layer);
    if (layer.type === 'null') this._renderNullFieldSection(project, comp, layer);
    if (layer.type === 'precomp') this._renderPrecompSection(project, comp, layer);
    if (layer.type === 'camera') this._renderCameraSection(project, comp, layer);
    if (layer.type === 'light') this._renderLightSection(project, comp, layer);
    if (layer.type === 'mesh3d') this._renderMesh3DSection(project, comp, layer);
    if (layer.type === 'particle') this._renderParticleSection(project, comp, layer);
    if (layer.type === 'audio') this._renderAudioSection(project, comp, layer);

    // 3. 蒙版 (Masks)
    this._renderMasksSection(project, comp, layer);

    // 4. 可重排效果栈 (Effects)
    this._renderEffectsSection(project, comp, layer);
  }

  _renderCompSummary(comp) {
    const project = this.app.project;
    const { sec, body } = this._makeSection(`合成属性 · ${comp.name}`);
    body.appendChild(el('div', { className: 'prop-info-txt', text: `画布尺寸: ${comp.width} × ${comp.height} px · 帧率 ${comp.fps} fps · 时长 ${comp.duration}s` }));
    body.appendChild(el('div', { className: 'prop-info-txt', text: `快门角度 ${comp.shutterAngle ?? 180}° · 相位 ${comp.shutterPhase ?? -90}° · 共 ${comp.layers.length} 个图层` }));
    body.appendChild(
      el('div', { className: 'prop-btn-row' }, [
        el('button', { className: 'ae-btn sm', text: '编辑合成设置', onClick: () => this.app.projectPanel?.promptEditComp(comp) }),
        el('button', {
          className: 'ae-btn sm primary',
          text: '+ 选中第一个图层',
          onClick: () => {
            if (comp.layers[0]) {
              project.selectedLayerIds = [comp.layers[0].id];
              this.app.refreshAll();
            }
          },
        }),
      ])
    );
    this.bodyEl.appendChild(sec);
  }

  _renderShapeSection(project, comp, layer) {
    const s = layer.shape;
    const { sec, body } = this._makeSection('矢量形状与操作符', [
      el('button', { className: 'ae-micro-btn', text: '+修剪', onClick: () => this._addShapeOp(layer, 'trim') }),
      el('button', { className: 'ae-micro-btn', text: '+重复', onClick: () => this._addShapeOp(layer, 'repeater') }),
      el('button', { className: 'ae-micro-btn', text: '+布尔', onClick: () => this._addShapeOp(layer, 'boolean') }),
    ]);

    const srcSel = el('select', { className: 'ae-select sm' }, [
      el('option', { value: 'rect', text: '参数矩形', selected: s.source === 'rect' }),
      el('option', { value: 'ellipse', text: '参数椭圆', selected: s.source === 'ellipse' }),
      el('option', { value: 'path', text: '自定义贝塞尔路径', selected: s.source === 'path' }),
      el('option', { value: 'node', text: '程序节点输出几何', selected: s.source === 'node' }),
    ]);
    srcSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '切换形状几何源', () => { s.source = srcSel.value; });
      this.app.refreshAll();
    });
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '几何源' }), srcSel]));

    if (s.source === 'rect') {
      body.appendChild(this._buildPropRow(layer, 'shape.rectSize', '矩形尺寸'));
      body.appendChild(this._buildPropRow(layer, 'shape.rectRoundness', '圆角半径'));
    } else if (s.source === 'ellipse') {
      body.appendChild(this._buildPropRow(layer, 'shape.ellipseSize', '椭圆尺寸'));
    } else if (s.source === 'path') {
      body.appendChild(this._buildPropRow(layer, 'shape.path', '形状路径 (画布拖动节点/手柄)'));
    } else if (s.source === 'node') {
      this._renderNodeBindingControls(project, s.nodeBinding, body);
    }

    // 填充与描边
    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!s.fill.enabled,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关填充', () => { s.fill.enabled = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '启用填充' }),
    ]));
    if (s.fill.enabled) {
      body.appendChild(this._buildPropRow(layer, 'shape.fill.color', '填充颜色'));
      body.appendChild(this._buildPropRow(layer, 'shape.fill.opacity', '填充不透明度'));
    }

    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!s.stroke.enabled,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关描边', () => { s.stroke.enabled = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '启用描边' }),
    ]));
    if (s.stroke.enabled) {
      body.appendChild(this._buildPropRow(layer, 'shape.stroke.color', '描边颜色'));
      body.appendChild(this._buildPropRow(layer, 'shape.stroke.width', '描边宽度'));
      body.appendChild(this._buildPropRow(layer, 'shape.stroke.opacity', '描边不透明度'));
    }

    // 可重排操作符栈
    (s.operators || []).forEach((op, idx) => {
      const card = el('div', { className: 'prop-sub-card' });
      const head = el('div', { className: 'prop-sub-head' }, [
        el('label', { className: 'prop-inline-chk' }, [
          el('input', {
            type: 'checkbox',
            checked: op.enabled !== false,
            onChange: (e) => {
              this.app.history.recordAction(project, '开关形状操作', () => { op.enabled = e.target.checked; });
              this.app.refreshAll();
            },
          }),
          el('span', { text: `${idx + 1}. ${op.name}` }),
        ]),
        el('div', { className: 'prop-sub-btns' }, [
          el('button', {
            className: 'ae-micro-btn',
            text: '↑',
            title: '上移操作顺序（影响布尔/修剪/重复管线结果）',
            onClick: () => this._moveArrayItem(s.operators, idx, -1, '重排形状操作符'),
          }),
          el('button', {
            className: 'ae-micro-btn',
            text: '↓',
            onClick: () => this._moveArrayItem(s.operators, idx, 1, '重排形状操作符'),
          }),
          el('button', {
            className: 'ae-micro-btn danger',
            text: '×',
            onClick: () => {
              this.app.history.recordAction(project, '删除形状操作', () => { s.operators.splice(idx, 1); });
              this.app.refreshAll();
            },
          }),
        ]),
      ]);
      card.appendChild(head);

      if (op.type === 'trim') {
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.start`, '起点 (%)'));
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.end`, '终点 (%)'));
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.offset`, '偏移 (°)'));
        const mSel = el('select', { className: 'ae-select sm' }, [
          el('option', { value: 'simultaneous', text: '同时修剪所有轮廓', selected: op.params.mode === 'simultaneous' }),
          el('option', { value: 'individual', text: '逐条依次修剪', selected: op.params.mode === 'individual' }),
        ]);
        mSel.addEventListener('change', () => {
          this.app.history.recordAction(project, '修改修剪模式', () => { op.params.mode = mSel.value; });
          this.app.refreshAll();
        });
        card.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '修剪方式' }), mSel]));
      } else if (op.type === 'repeater') {
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.copies`, '副本数量'));
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.offset`, '副本偏移'));
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.position`, '递增位移'));
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.rotation`, '递增旋转 (°)'));
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.scale`, '递增缩放 (%)'));
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.startOpacity`, '起始不透明 (%)'));
        card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.endOpacity`, '结束不透明 (%)'));
      } else if (op.type === 'boolean') {
        const opSel = el('select', { className: 'ae-select sm' }, [
          el('option', { value: 'union', text: '并集 (Union)', selected: op.params.op === 'union' }),
          el('option', { value: 'difference', text: '差集 (Difference)', selected: op.params.op === 'difference' }),
          el('option', { value: 'intersect', text: '交集 (Intersect)', selected: op.params.op === 'intersect' }),
          el('option', { value: 'exclude', text: '排除 (Exclude)', selected: op.params.op === 'exclude' }),
        ]);
        opSel.addEventListener('change', () => {
          this.app.history.recordAction(project, '修改布尔运算方式', () => { op.params.op = opSel.value; });
          this.app.refreshAll();
        });
        const kindSel = el('select', { className: 'ae-select sm' }, [
          el('option', { value: 'rect', text: '内置矩形', selected: op.params.operandKind === 'rect' }),
          el('option', { value: 'ellipse', text: '内置椭圆', selected: op.params.operandKind === 'ellipse' }),
          el('option', { value: 'layer', text: '引用场景形状图层', selected: op.params.operandKind === 'layer' }),
        ]);
        kindSel.addEventListener('change', () => {
          this.app.history.recordAction(project, '修改布尔运算目标', () => { op.params.operandKind = kindSel.value; });
          this.app.refreshAll();
        });
        card.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '布尔类型' }), opSel]));
        card.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '目标形状' }), kindSel]));
        if (op.params.operandKind === 'layer') {
          const lSel = el('select', { className: 'ae-select sm' }, [
            el('option', { value: '', text: '选择另一个形状图层...', selected: !op.params.operandLayerId }),
            ...comp.layers.filter((x) => x.id !== layer.id && x.type === 'shape').map((x) =>
              el('option', { value: x.id, text: x.name, selected: op.params.operandLayerId === x.id })
            ),
          ]);
          lSel.addEventListener('change', () => {
            this.app.history.recordAction(project, '选择布尔目标图层', () => { op.params.operandLayerId = lSel.value || null; });
            this.app.refreshAll();
          });
          card.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '目标图层' }), lSel]));
        } else {
          card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.operandSize`, '目标尺寸'));
          card.appendChild(this._buildPropRow(layer, `shape.operators.${idx}.params.operandOffset`, '目标偏移'));
        }
      }
      body.appendChild(card);
    });

    this._renderPuppetPinsSubSection(project, layer, 'shape.puppetPins', layer.shape.puppetPins, body);
    this.bodyEl.appendChild(sec);
  }

  _addShapeOp(layer, type) {
    this.app.history.recordAction(this.app.project, `添加形状操作 ${type}`, () => {
      if (!layer.shape.operators) layer.shape.operators = [];
      layer.shape.operators.push(createShapeOperator(type));
    });
    this.app.refreshAll();
  }

  _renderPuppetPinsSubSection(project, layer, prefix, pins, parentBody) {
    const box = el('div', { className: 'prop-sub-card' });
    box.appendChild(
      el('div', { className: 'prop-sub-head' }, [
        el('span', { text: `二维网格操纵点图钉 (${pins?.length || 0})` }),
        el('button', {
          className: 'ae-micro-btn',
          text: '+ 添加图钉',
          title: '也可以切换到工具栏的「图钉工具 (Ctrl+P)」直接点击画布放置',
          onClick: () => {
            this.app.history.recordAction(project, '添加操纵点图钉', () => {
              const list = prefix.startsWith('text.') ? layer.text.puppetPins : layer.shape.puppetPins;
              list.push(createPuppetPin((list.length % 3 - 1) * 60, 0, `图钉 ${list.length + 1}`));
            });
            this.app.refreshAll();
          },
        }),
      ])
    );
    (pins || []).forEach((pin, pi) => {
      box.appendChild(
        el('div', { className: 'prop-sub-head' }, [
          el('span', { text: `${pin.name} (基准 [${pin.restPos[0].toFixed(0)}, ${pin.restPos[1].toFixed(0)}])` }),
          el('button', {
            className: 'ae-micro-btn danger',
            text: '删除',
            onClick: () => {
              this.app.history.recordAction(project, '删除图钉', () => { pins.splice(pi, 1); });
              this.app.refreshAll();
            },
          }),
        ])
      );
      box.appendChild(this._buildPropRow(layer, `${prefix}.${pi}.pos`, `${pin.name} 位置`));
    });
    parentBody.appendChild(box);
  }

  _renderTextSection(project, comp, layer) {
    const tx = layer.text;
    const { sec, body } = this._makeSection('文字内容、字体转换与动画器');

    const ta = el('textarea', {
      className: 'ae-textarea',
      rows: 2,
      value: tx.content || '',
      placeholder: '输入中英文文字（支持多行）',
      onInput: () => {
        this.app.history.beginTransaction(project, '修改文字内容');
        tx.content = ta.value;
        // 清空可能依赖此文本的节点图与粒子缓存，实现 100% 工程原生联动！
        for (const ng of project.nodeGraphs || []) {
          ng._evalCache = null;
          ng._evalCacheMap = null;
        }
        comp._worldGeoCache = null;
        for (const l of comp.layers) {
          l._simCache = null;
          if (l.particle) l.particle._simCache = null;
        }
        this.app.renderCurrentFrame();
      },
      onChange: () => {
        this.app.history.commitTransaction(project);
        this.app.refreshAll();
      },
    });
    body.appendChild(el('div', { className: 'prop-block-lbl', text: '文本内容（修改将实时同步到关联字形/三维体与火花）' }));
    body.appendChild(ta);

    const fonts = getAvailableFonts();
    const fontSel = el('select', { className: 'ae-select sm' }, fonts.map((f) =>
      el('option', { value: f.id, text: `${f.displayName} (${f.cjkCount}字)`, selected: tx.fontId === f.id })
    ));
    fontSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '切换字体', () => {
        tx.fontId = fontSel.value;
        for (const ng of project.nodeGraphs || []) {
          ng._evalCache = null;
          ng._evalCacheMap = null;
        }
        comp._worldGeoCache = null;
        for (const l of comp.layers) {
          l._simCache = null;
          if (l.particle) l.particle._simCache = null;
        }
      });
      this.app.refreshAll();
    });
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '字体包' }), fontSel]));

    const missing = getUnsupportedChars(tx.fontId, tx.content);
    if (missing.length) {
      body.appendChild(el('div', { className: 'prop-warn-box', text: `当前内置字体未包含字符: ${missing.join(' ')}` }));
    }

    const alignSel = el('select', { className: 'ae-select sm' }, [
      el('option', { value: 'left', text: '左对齐', selected: tx.align === 'left' }),
      el('option', { value: 'center', text: '居中对齐', selected: tx.align === 'center' }),
      el('option', { value: 'right', text: '右对齐', selected: tx.align === 'right' }),
    ]);
    alignSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '修改对齐', () => { tx.align = alignSel.value; });
      this.app.refreshAll();
    });
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '段落对齐' }), alignSel]));

    body.appendChild(this._buildPropRow(layer, 'text.fontSize', '字号'));
    body.appendChild(this._buildPropRow(layer, 'text.lineHeight', '行距'));
    body.appendChild(this._buildPropRow(layer, 'text.tracking', '字距'));
    body.appendChild(this._buildPropRow(layer, 'text.fillColor', '填充颜色'));
    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!tx.strokeEnabled,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关文字描边', () => { tx.strokeEnabled = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '启用文字描边' }),
    ]));
    if (tx.strokeEnabled) {
      body.appendChild(this._buildPropRow(layer, 'text.strokeColor', '描边颜色'));
      body.appendChild(this._buildPropRow(layer, 'text.strokeWidth', '描边宽度'));
    }

    // 转换操作按钮
    body.appendChild(
      el('div', { className: 'prop-btn-row' }, [
        el('button', {
          className: 'ae-btn sm',
          text: '转为矢量形状层',
          onClick: () => {
            this.app.history.recordAction(project, '文字转为矢量形状层', () => {
              const geom = textToGeometry(tx.content, {
                fontId: tx.fontId,
                fontSize: evalProperty(project, comp, layer, 'text.fontSize', comp.currentTime),
                lineHeight: evalProperty(project, comp, layer, 'text.lineHeight', comp.currentTime),
                tracking: evalProperty(project, comp, layer, 'text.tracking', comp.currentTime),
                align: tx.align,
              });
              const sh = createLayer('shape', comp, {
                name: `${layer.name} 矢量轮廓`,
                shapeSource: 'path',
                position: cloneVal(layer.transform.position.value),
                path: geom.cleanOutlinePath,
                fillColor: cloneVal(tx.fillColor.value),
              });
              comp.layers.unshift(sh);
              project.selectedLayerIds = [sh.id];
            });
            this.app.refreshAll();
          },
        }),
        el('button', {
          className: 'ae-btn sm primary',
          text: '生成三维挤出字层',
          onClick: () => {
            this.app.history.recordAction(project, '从文字生成三维挤出实体', () => {
              const m3 = createLayer('mesh3d', comp, {
                name: `${layer.name} 三维字`,
                sourceType: 'layer',
                sourceLayerId: layer.id,
                position: cloneVal(layer.transform.position.value),
              });
              comp.layers.unshift(m3);
              project.selectedLayerIds = [m3.id];
            });
            this.app.refreshAll();
          },
        }),
      ])
    );

    // 文字动画器
    const anim = tx.animator;
    const animCard = el('div', { className: 'prop-sub-card' });
    animCard.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!anim.enabled,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关文字动画器', () => { anim.enabled = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '启用文字动画器 (逐字符/词/行)' }),
    ]));
    if (anim.enabled) {
      const unitSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: 'char', text: '基于字符 (Char)', selected: anim.unit === 'char' }),
        el('option', { value: 'word', text: '基于词 (Word)', selected: anim.unit === 'word' }),
        el('option', { value: 'line', text: '基于行 (Line)', selected: anim.unit === 'line' }),
      ]);
      unitSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '修改动画器单位', () => { anim.unit = unitSel.value; });
        this.app.refreshAll();
      });
      const shpSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: 'smooth', text: '柔和 S 曲线', selected: anim.shape === 'smooth' }),
        el('option', { value: 'rampUp', text: '上坡 (Ramp Up)', selected: anim.shape === 'rampUp' }),
        el('option', { value: 'rampDown', text: '下坡 (Ramp Down)', selected: anim.shape === 'rampDown' }),
        el('option', { value: 'triangle', text: '三角波', selected: anim.shape === 'triangle' }),
        el('option', { value: 'square', text: '方波阶跃', selected: anim.shape === 'square' }),
      ]);
      shpSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '修改动画器形状', () => { anim.shape = shpSel.value; });
        this.app.refreshAll();
      });
      animCard.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '作用粒度' }), unitSel]));
      animCard.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '选择器形状' }), shpSel]));
      animCard.appendChild(this._buildPropRow(layer, 'text.animator.start', '范围起点'));
      animCard.appendChild(this._buildPropRow(layer, 'text.animator.end', '范围终点'));
      animCard.appendChild(this._buildPropRow(layer, 'text.animator.offset', '范围偏移'));
      animCard.appendChild(this._buildPropRow(layer, 'text.animator.smoothness', '软边 (%)'));
      animCard.appendChild(this._buildPropRow(layer, 'text.animator.position', '字偏移'));
      animCard.appendChild(this._buildPropRow(layer, 'text.animator.rotation', '字旋转'));
      animCard.appendChild(this._buildPropRow(layer, 'text.animator.scale', '字缩放'));
      animCard.appendChild(this._buildPropRow(layer, 'text.animator.opacity', '字不透明'));
    }
    body.appendChild(animCard);

    this._renderPuppetPinsSubSection(project, layer, 'text.puppetPins', tx.puppetPins, body);
    this.bodyEl.appendChild(sec);
  }

  _renderNullFieldSection(project, comp, layer) {
    const { sec, body } = this._makeSection('空对象与空间场发生器');
    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!layer.spatialField,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关空间场发生器', () => {
            layer.spatialField = e.target.checked ? createSpatialField('noise', `${layer.name} 场`) : null;
          });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '作为三维空间场发生器（可同时驱动三维顶点与粒子）' }),
    ]));

    if (layer.spatialField) {
      const sf = layer.spatialField;
      const kSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: 'distanceFalloff', text: '距离径向推拉 (Falloff)', selected: sf.kind === 'distanceFalloff' }),
        el('option', { value: 'noise', text: '无散度旋度涡流噪声 (Noise)', selected: sf.kind === 'noise' }),
        el('option', { value: 'vortex', text: '螺旋涡旋场 (Vortex)', selected: sf.kind === 'vortex' }),
        el('option', { value: 'directional', text: '定向风/冲击场 (Directional)', selected: sf.kind === 'directional' }),
        el('option', { value: 'attract', text: '引力吸引/斥力场 (Attract)', selected: sf.kind === 'attract' }),
      ]);
      kSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '修改空间场类型', () => { sf.kind = kSel.value; });
        this.app.refreshAll();
      });
      const bSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: 'add', text: '叠加 (Add)', selected: sf.blendMode === 'add' }),
        el('option', { value: 'multiply', text: '倍增调制 (Multiply)', selected: sf.blendMode === 'multiply' }),
        el('option', { value: 'mix', text: '混合权重 (Mix)', selected: sf.blendMode === 'mix' }),
      ]);
      bSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '修改空间场混合模式', () => { sf.blendMode = bSel.value; });
        this.app.refreshAll();
      });
      body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '空间场模式' }), kSel]));
      body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '多场混合' }), bSel]));
      body.appendChild(this._buildPropRow(layer, 'spatialField.strength', '场强'));
      body.appendChild(this._buildPropRow(layer, 'spatialField.radius', '影响半径'));
      body.appendChild(this._buildPropRow(layer, 'spatialField.falloff', '衰减指数'));
      body.appendChild(this._buildPropRow(layer, 'spatialField.frequency', '噪声频率'));
      body.appendChild(this._buildPropRow(layer, 'spatialField.speed', '随时间变化速度'));
      body.appendChild(this._buildPropRow(layer, 'spatialField.direction', '方向/轴向'));
    }
    this.bodyEl.appendChild(sec);
  }

  _renderPrecompSection(project, comp, layer) {
    const pc = layer.precomp;
    const { sec, body } = this._makeSection('预合成嵌套与时间重映射');
    const cSel = el('select', { className: 'ae-select sm' }, project.compositions
      .filter((c) => c.id !== comp.id)
      .map((c) => el('option', { value: c.id, text: c.name, selected: pc.compId === c.id }))
    );
    cSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '更换引用的预合成', () => { pc.compId = cSel.value; });
      this.app.refreshAll();
    });
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '源合成' }), cSel]));

    const stSc = createScrubInput({
      value: layer.startTime || 0,
      step: 0.05,
      precision: 2,
      unit: 's',
      onBeginDrag: () => this.app.history.beginTransaction(project, '调整预合成起始偏移'),
      onPreview: (v) => {
        layer.startTime = v;
        this.app.renderCurrentFrame();
      },
      onCommit: () => {
        this.app.history.commitTransaction(project);
        this.app.refreshAll();
      },
    });
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '起始时间偏移' }), stSc]));

    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!pc.timeRemapEnabled,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关时间重映射', () => { pc.timeRemapEnabled = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '启用时间重映射 (变速 / 倒放 / 定格)' }),
    ]));
    if (pc.timeRemapEnabled) {
      body.appendChild(this._buildPropRow(layer, 'precomp.timeRemap', '映射合成时间(秒)'));
    }
    this.bodyEl.appendChild(sec);
  }

  _renderCameraSection(project, comp, layer) {
    const cam = layer.camera;
    const { sec, body } = this._makeSection('三维摄像机与光学景深 (DOF)');
    body.appendChild(this._buildPropRow(layer, 'camera.fov', '视角 FOV (°)'));
    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!cam.useTarget,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关摄像机目标点', () => { cam.useTarget = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '朝向目标点 (LookAt Target)' }),
    ]));
    if (cam.useTarget) body.appendChild(this._buildPropRow(layer, 'camera.target', '目标点坐标'));
    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: cam.dofEnabled !== false,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关景深', () => { cam.dofEnabled = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '启用实景景深 (浅景深虚化)' }),
    ]));
    body.appendChild(this._buildPropRow(layer, 'camera.focusDistance', '对焦距离'));
    body.appendChild(this._buildPropRow(layer, 'camera.aperture', '光圈虚化强度'));
    this.bodyEl.appendChild(sec);
  }

  _renderLightSection(project, comp, layer) {
    const lt = layer.light;
    const { sec, body } = this._makeSection('三维灯光与实时阴影');
    const tSel = el('select', { className: 'ae-select sm' }, [
      el('option', { value: 'point', text: '点光源 (Point)', selected: lt.lightType === 'point' }),
      el('option', { value: 'directional', text: '平行方向光 (Directional)', selected: lt.lightType === 'directional' }),
      el('option', { value: 'ambient', text: '环境补光 (Ambient)', selected: lt.lightType === 'ambient' }),
    ]);
    tSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '修改灯光类型', () => { lt.lightType = tSel.value; });
      this.app.refreshAll();
    });
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '灯光类型' }), tSel]));
    body.appendChild(this._buildPropRow(layer, 'light.color', '灯光颜色'));
    body.appendChild(this._buildPropRow(layer, 'light.intensity', '光强'));
    if (lt.lightType === 'directional') {
      body.appendChild(this._buildPropRow(layer, 'light.target', '照射目标'));
    }
    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!lt.castShadow,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关灯光实时阴影', () => { lt.castShadow = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '投射实时软阴影' }),
    ]));
    this.bodyEl.appendChild(sec);
  }

  _renderNodeBindingControls(project, binding, parentBody) {
    const graphs = project.nodeGraphs || [];
    const gSel = el('select', { className: 'ae-select sm' }, [
      el('option', { value: '', text: '选择程序节点图...', selected: !binding.graphId }),
      ...graphs.map((g) => el('option', { value: g.id, text: g.name, selected: binding.graphId === g.id })),
    ]);
    gSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '绑定节点图', () => {
        binding.graphId = gSel.value || null;
        binding.outputNodeId = null;
      });
      this.app.refreshAll();
    });

    const curG = graphs.find((g) => g.id === binding.graphId);
    const outNodes = curG ? curG.nodes.filter((n) => n.type.endsWith('Output') || getNodeCandidateOut(n)) : [];
    const nSel = el('select', { className: 'ae-select sm' }, [
      el('option', { value: '', text: '自动输出节点', selected: !binding.outputNodeId }),
      ...outNodes.map((n) => el('option', { value: n.id, text: `${n.label} (${n.type})`, selected: binding.outputNodeId === n.id })),
    ]);
    nSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '切换输出节点', () => { binding.outputNodeId = nSel.value || null; });
      this.app.refreshAll();
    });

    parentBody.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '程序节点图' }), gSel]));
    parentBody.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '目标节点' }), nSel]));
    if (binding.graphId) {
      parentBody.appendChild(el('button', {
        className: 'ae-btn sm',
        text: '打开此节点图编辑',
        onClick: () => this.app.openNodeGraph(binding.graphId),
      }));
    }
  }

  _renderMesh3DSection(project, comp, layer) {
    const m = layer.mesh3d;
    const { sec, body } = this._makeSection('三维实体、挤出、变形与 PBR 材质');

    const srcSel = el('select', { className: 'ae-select sm' }, [
      el('option', { value: 'node', text: '程序节点图输出 (Node)', selected: m.sourceType === 'node' }),
      el('option', { value: 'layer', text: '图层二维轮廓挤出 (文字/形状)', selected: m.sourceType === 'layer' }),
      el('option', { value: 'primitive', text: '内置三维实体', selected: m.sourceType === 'primitive' }),
    ]);
    srcSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '切换三维几何源', () => { m.sourceType = srcSel.value; });
      this.app.refreshAll();
    });
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '几何来源' }), srcSel]));

    if (m.sourceType === 'node') {
      this._renderNodeBindingControls(project, m.nodeBinding, body);
    } else if (m.sourceType === 'layer') {
      const lSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: '', text: '选择文字/形状图层...', selected: !m.sourceLayerId }),
        ...comp.layers.filter((x) => x.id !== layer.id && (x.type === 'text' || x.type === 'shape')).map((x) =>
          el('option', { value: x.id, text: x.name, selected: m.sourceLayerId === x.id })
        ),
      ]);
      lSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '绑定三维挤出源图层', () => { m.sourceLayerId = lSel.value || null; });
        this.app.refreshAll();
      });
      body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '轮廓源图层' }), lSel]));
    } else {
      const pSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: 'box', text: '立方块 (Box)', selected: m.primitive === 'box' }),
        el('option', { value: 'sphere', text: '球体 (Sphere)', selected: m.primitive === 'sphere' }),
        el('option', { value: 'cylinder', text: '圆柱 (Cylinder)', selected: m.primitive === 'cylinder' }),
        el('option', { value: 'plane', text: '工作台/地面 (Plane)', selected: m.primitive === 'plane' }),
        el('option', { value: 'anvil', text: '锻造铁砧 (Anvil)', selected: m.primitive === 'anvil' }),
        el('option', { value: 'hammer', text: '锻打重锤 (Hammer)', selected: m.primitive === 'hammer' }),
      ]);
      pSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '切换三维几何体', () => { m.primitive = pSel.value; });
        this.app.refreshAll();
      });
      body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '内置体' }), pSel]));
    }

    if (m.sourceType === 'layer') {
      body.appendChild(this._buildPropRow(layer, 'mesh3d.extrude.depth', '挤出深度'));
      body.appendChild(this._buildPropRow(layer, 'mesh3d.extrude.bevelSize', '倒角宽度'));
      body.appendChild(this._buildPropRow(layer, 'mesh3d.extrude.bevelThickness', '倒角厚度'));
    }

    body.appendChild(el('div', { className: 'prop-block-lbl', text: '顶点非破坏性变形 (重算真实法线)' }));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.deform.bendAngle', '弯曲角度 (°)'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.deform.twistAngle', '扭转角度 (°)'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.deform.dentCenter', '受力压痕中心'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.deform.dentRadius', '受力影响半径'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.deform.dentDepth', '受力压痕形变'));

    // 关联场景空间场
    const fieldNulls = comp.layers.filter((x) => x.type === 'null' && x.spatialField);
    if (fieldNulls.length) {
      const fBox = el('div', { className: 'prop-sub-card' }, [
        el('div', { className: 'prop-sub-head', text: '空间场直接驱动顶点形变' }),
      ]);
      for (const fn of fieldNulls) {
        const active = (m.deform.fieldLayerIds || []).includes(fn.id);
        fBox.appendChild(el('label', { className: 'prop-inline-chk' }, [
          el('input', {
            type: 'checkbox',
            checked: active,
            onChange: (e) => {
              this.app.history.recordAction(project, '绑定空间场到三维变形', () => {
                const set = new Set(m.deform.fieldLayerIds || []);
                if (e.target.checked) set.add(fn.id);
                else set.delete(fn.id);
                m.deform.fieldLayerIds = [...set];
              });
              this.app.refreshAll();
            },
          }),
          el('span', { text: `${fn.name} (${fn.spatialField.kind})` }),
        ]));
      }
      body.appendChild(fBox);
    }

    body.appendChild(el('div', { className: 'prop-block-lbl', text: 'PBR 金属质感材质' }));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.material.baseColor', '基础反照率颜色'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.material.metalness', '金属度 (0~1)'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.material.roughness', '粗糙度 (0~1)'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.material.emissiveColor', '自发光/炽热色'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.material.emissiveIntensity', '自发光强度'));
    body.appendChild(this._buildPropRow(layer, 'mesh3d.material.opacity', '材质不透明度'));

    body.appendChild(el('div', { className: 'prop-btn-row' }, [
      el('label', { className: 'prop-chip-chk' }, [
        el('input', {
          type: 'checkbox',
          checked: !!m.castShadow,
          onChange: (e) => {
            this.app.history.recordAction(project, '切换投射阴影', () => { m.castShadow = e.target.checked; });
            this.app.refreshAll();
          },
        }),
        el('span', { text: '投射阴影' }),
      ]),
      el('label', { className: 'prop-chip-chk' }, [
        el('input', {
          type: 'checkbox',
          checked: !!m.receiveShadow,
          onChange: (e) => {
            this.app.history.recordAction(project, '切换接收阴影', () => { m.receiveShadow = e.target.checked; });
            this.app.refreshAll();
          },
        }),
        el('span', { text: '接收阴影' }),
      ]),
    ]));
    this.bodyEl.appendChild(sec);
  }

  _renderParticleSection(project, comp, layer) {
    const pt = layer.particle;
    const { sec, body } = this._makeSection('确定性粒子、力场、碰撞与拖尾', [
      el('button', {
        className: 'ae-micro-btn',
        text: '+ 发射器',
        onClick: () => {
          this.app.history.recordAction(project, '添加粒子发射器', () => {
            pt.emitters.push(createParticleEmitter(`发射器 ${pt.emitters.length + 1}`));
          });
          this.app.refreshAll();
        },
      }),
      el('button', {
        className: 'ae-micro-btn',
        text: '+ 碰撞体',
        onClick: () => {
          this.app.history.recordAction(project, '添加粒子碰撞体', () => {
            const m3 = comp.layers.find((x) => x.type === 'mesh3d');
            pt.colliders.push({
              id: genId('col'),
              enabled: true,
              layerId: m3 ? m3.id : null,
              nodeBinding: { graphId: null, outputNodeId: null },
              restitution: 0.58,
              friction: 0.22,
              hitColor: [1, 0.96, 0.72, 1],
              hitLifeDelta: 0,
              secondaryEmitCount: 2,
              secondarySpeed: 140,
            });
          });
          this.app.refreshAll();
        },
      }),
    ]);

    const seedInp = el('input', {
      type: 'number',
      className: 'ae-input sm',
      value: pt.seed ?? 2026,
      onChange: () => {
        this.app.history.recordAction(project, '修改随机种子', () => {
          pt.seed = Math.round(Number(seedInp.value) || 1);
        });
        this.app.refreshAll();
      },
    });
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '随机种子 (可复现)' }), seedInp]));

    // 发射器列表
    (pt.emitters || []).forEach((em, ei) => {
      const card = el('div', { className: 'prop-sub-card' });
      card.appendChild(el('div', { className: 'prop-sub-head' }, [
        el('label', { className: 'prop-inline-chk' }, [
          el('input', {
            type: 'checkbox',
            checked: em.enabled !== false,
            onChange: (e) => {
              this.app.history.recordAction(project, '开关发射器', () => { em.enabled = e.target.checked; });
              this.app.refreshAll();
            },
          }),
          el('span', { text: em.name || `发射器 ${ei + 1}` }),
        ]),
        pt.emitters.length > 1
          ? el('button', {
              className: 'ae-micro-btn danger',
              text: '删',
              onClick: () => {
                this.app.history.recordAction(project, '删除发射器', () => { pt.emitters.splice(ei, 1); });
                this.app.refreshAll();
              },
            })
          : null,
      ]));

      const sSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: 'point', text: '点发射 (Point)', selected: em.sourceType === 'point' }),
        el('option', { value: 'curve', text: '曲线路径发射 (Curve)', selected: em.sourceType === 'curve' }),
        el('option', { value: 'geometry', text: '几何体表面发射 (Mesh/变形表面)', selected: em.sourceType === 'geometry' }),
      ]);
      sSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '切换发射源类型', () => { em.sourceType = sSel.value; });
        this.app.refreshAll();
      });
      card.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '发射源类型' }), sSel]));
      if (em.sourceType === 'geometry') {
        const lSel = el('select', { className: 'ae-select sm' }, [
          el('option', { value: '', text: '无源图层 (可用下方节点)', selected: !em.sourceLayerId }),
          ...comp.layers.filter((x) => x.id !== layer.id && (x.type === 'mesh3d' || x.type === 'text' || x.type === 'shape')).map((x) =>
            el('option', { value: x.id, text: x.name, selected: em.sourceLayerId === x.id })
          ),
        ]);
        lSel.addEventListener('change', () => {
          this.app.history.recordAction(project, '选择发射几何图层', () => { em.sourceLayerId = lSel.value || null; });
          this.app.refreshAll();
        });
        card.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '几何源图层' }), lSel]));
        if (em.nodeBinding) this._renderNodeBindingControls(project, em.nodeBinding, card);
      }

      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.position`, '局部偏移'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.rate`, '发射速率 (/秒)'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.burst`, '爆发脉冲数'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.speed`, '初速度'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.spread`, '扩散张角 (°)'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.life`, '寿命 (秒)'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.sizeStart`, '初始尺寸'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.sizeEnd`, '结束尺寸'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.colorStart`, '初生颜色'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.colorMid`, '中期颜色'));
      card.appendChild(this._buildPropRow(layer, `particle.emitters.${ei}.colorEnd`, '消散颜色'));
      body.appendChild(card);
    });

    // 力场与物理
    const physCard = el('div', { className: 'prop-sub-card' }, [
      el('div', { className: 'prop-sub-head', text: '粒子物理力场与空间场联动' }),
    ]);
    physCard.appendChild(this._buildPropRow(layer, 'particle.physics.gravity', '重力加速度'));
    physCard.appendChild(this._buildPropRow(layer, 'particle.physics.directionalForce', '恒定方向力'));
    physCard.appendChild(this._buildPropRow(layer, 'particle.physics.attractPos', '吸引/排斥点'));
    physCard.appendChild(this._buildPropRow(layer, 'particle.physics.attractStrength', '吸引/排斥强度'));
    physCard.appendChild(this._buildPropRow(layer, 'particle.physics.drag', '空气阻尼'));

    const fieldNulls = comp.layers.filter((x) => x.type === 'null' && x.spatialField);
    for (const fn of fieldNulls) {
      const active = (pt.physics.fieldLayerIds || []).includes(fn.id);
      physCard.appendChild(el('label', { className: 'prop-inline-chk' }, [
        el('input', {
          type: 'checkbox',
          checked: active,
          onChange: (e) => {
            this.app.history.recordAction(project, '绑定空间场驱动粒子', () => {
              const set = new Set(pt.physics.fieldLayerIds || []);
              if (e.target.checked) set.add(fn.id);
              else set.delete(fn.id);
              pt.physics.fieldLayerIds = [...set];
            });
            this.app.refreshAll();
          },
        }),
        el('span', { text: `空间场: ${fn.name} (${fn.spatialField.kind})` }),
      ]));
    }
    body.appendChild(physCard);

    // 碰撞体列表
    (pt.colliders || []).forEach((col, ci) => {
      const colCard = el('div', { className: 'prop-sub-card' });
      const targetSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: '', text: '选择碰撞体图层...', selected: !col.layerId }),
        ...comp.layers.filter((x) => x.id !== layer.id && (x.type === 'mesh3d' || x.type === 'text' || x.type === 'shape')).map((x) =>
          el('option', { value: x.id, text: x.name, selected: col.layerId === x.id })
        ),
      ]);
      targetSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '修改碰撞目标图层', () => { col.layerId = targetSel.value || null; });
        this.app.refreshAll();
      });
      const restSc = createScrubInput({
        value: col.restitution ?? 0.55,
        min: 0,
        max: 1.2,
        step: 0.05,
        onBeginDrag: () => this.app.history.beginTransaction(project, '调整碰撞弹性'),
        onPreview: (v) => { col.restitution = v; this.app.renderCurrentFrame(); },
        onCommit: () => { this.app.history.commitTransaction(project); this.app.refreshAll(); },
      });
      const secCntInp = el('input', {
        type: 'number',
        min: 0,
        max: 4,
        step: 1,
        className: 'ae-input sm',
        value: col.secondaryEmitCount ?? 0,
        onChange: () => {
          this.app.history.recordAction(project, '修改次级溅射粒子数', () => {
            col.secondaryEmitCount = clamp(Math.round(Number(secCntInp.value) || 0), 0, 4);
          });
          this.app.refreshAll();
        },
      });
      colCard.appendChild(el('div', { className: 'prop-sub-head' }, [
        el('label', { className: 'prop-inline-chk' }, [
          el('input', {
            type: 'checkbox',
            checked: col.enabled !== false,
            onChange: (e) => {
              this.app.history.recordAction(project, '开关碰撞体', () => { col.enabled = e.target.checked; });
              this.app.refreshAll();
            },
          }),
          el('span', { text: `三维实体碰撞体 ${ci + 1}` }),
        ]),
        el('button', {
          className: 'ae-micro-btn danger',
          text: '×',
          onClick: () => {
            this.app.history.recordAction(project, '删除碰撞体', () => { pt.colliders.splice(ci, 1); });
            this.app.refreshAll();
          },
        }),
      ]));
      colCard.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '碰撞图层' }), targetSel]));
      colCard.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '弹性系数' }), restSc]));
      colCard.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '撞击次级迸溅' }), secCntInp]));
      body.appendChild(colCard);
    });

    // 拖尾设置
    const trCard = el('div', { className: 'prop-sub-card' });
    trCard.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!pt.trail.enabled,
        onChange: (e) => {
          this.app.history.recordAction(project, '开关粒子拖尾', () => { pt.trail.enabled = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '启用粒子三维空间拖尾轨迹' }),
    ]));
    if (pt.trail.enabled) {
      trCard.appendChild(this._buildPropRow(layer, 'particle.trail.length', '拖尾时长 (秒)'));
      trCard.appendChild(this._buildPropRow(layer, 'particle.trail.width', '拖尾线宽'));
      trCard.appendChild(this._buildPropRow(layer, 'particle.trail.color', '拖尾色调'));
      trCard.appendChild(this._buildPropRow(layer, 'particle.trail.fade', '尾端消退'));
    }
    body.appendChild(trCard);

    this.bodyEl.appendChild(sec);
  }

  _renderAudioSection(project, comp, layer) {
    const au = layer.audio;
    const { sec, body } = this._makeSection('音色合成器 (Web Audio 声画同步)', [
      el('button', {
        className: 'ae-micro-btn primary',
        text: '▶ 试听音色',
        onClick: () => this.app.audio.triggerPreview(layer, project, comp, comp.currentTime),
      }),
    ]);

    const pSel = el('select', { className: 'ae-select sm' }, Object.entries(AUDIO_PRESETS).map(([k, lbl]) =>
      el('option', { value: k, text: lbl, selected: au.preset === k })
    ));
    pSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '切换音色预设', () => { au.preset = pSel.value; });
      this.app.refreshAll();
    });
    const wSel = el('select', { className: 'ae-select sm' }, ['sine', 'triangle', 'sawtooth', 'square'].map((w) =>
      el('option', { value: w, text: w, selected: au.waveform === w })
    ));
    wSel.addEventListener('change', () => {
      this.app.history.recordAction(project, '切换波形', () => { au.waveform = wSel.value; });
      this.app.refreshAll();
    });

    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '音色模型' }), pSel]));
    body.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '振荡波形' }), wSel]));
    body.appendChild(el('label', { className: 'prop-inline-chk' }, [
      el('input', {
        type: 'checkbox',
        checked: !!au.droneEnabled,
        onChange: (e) => {
          this.app.history.recordAction(project, '切换持续氛围音', () => { au.droneEnabled = e.target.checked; });
          this.app.refreshAll();
        },
      }),
      el('span', { text: '持续氛围音 (播放期间连续包络)' }),
    ]));
    body.appendChild(this._buildPropRow(layer, 'audio.gain', '音量增益'));
    body.appendChild(this._buildPropRow(layer, 'audio.pitch', '基频 (Hz)'));
    body.appendChild(this._buildPropRow(layer, 'audio.cutoff', '低通截止 (Hz)'));
    body.appendChild(this._buildPropRow(layer, 'audio.trigger', '触发脉冲 (0->1 瞬时打击)'));
    this.bodyEl.appendChild(sec);
  }

  _renderMasksSection(project, comp, layer) {
    const { sec, body } = this._makeSection(`蒙版 Masks (${layer.masks?.length || 0})`, [
      el('button', {
        className: 'ae-micro-btn',
        text: '+ 矩形',
        onClick: () => {
          this.app.history.recordAction(project, '添加矩形蒙版', () => {
            layer.masks.push(createMask('rect', 320, 220));
          });
          this.app.refreshAll();
        },
      }),
      el('button', {
        className: 'ae-micro-btn',
        text: '+ 椭圆',
        onClick: () => {
          this.app.history.recordAction(project, '添加椭圆蒙版', () => {
            layer.masks.push(createMask('ellipse', 280, 280));
          });
          this.app.refreshAll();
        },
      }),
    ], !(layer.masks && layer.masks.length));

    (layer.masks || []).forEach((msk, mi) => {
      const card = el('div', { className: 'prop-sub-card' });
      const mSel = el('select', { className: 'ae-select sm' }, [
        el('option', { value: 'add', text: '相加 (Add)', selected: msk.mode === 'add' }),
        el('option', { value: 'subtract', text: '相减 (Subtract)', selected: msk.mode === 'subtract' }),
        el('option', { value: 'intersect', text: '相交 (Intersect)', selected: msk.mode === 'intersect' }),
      ]);
      mSel.addEventListener('change', () => {
        this.app.history.recordAction(project, '修改蒙版模式', () => { msk.mode = mSel.value; });
        this.app.refreshAll();
      });

      card.appendChild(el('div', { className: 'prop-sub-head' }, [
        el('label', { className: 'prop-inline-chk' }, [
          el('input', {
            type: 'checkbox',
            checked: msk.enabled !== false,
            onChange: (e) => {
              this.app.history.recordAction(project, '开关蒙版', () => { msk.enabled = e.target.checked; });
              this.app.refreshAll();
            },
          }),
          el('span', { text: msk.name || `蒙版 ${mi + 1}` }),
        ]),
        el('div', { className: 'prop-sub-btns' }, [
          el('label', { className: 'prop-chip-chk' }, [
            el('input', {
              type: 'checkbox',
              checked: !!msk.inverted,
              onChange: (e) => {
                this.app.history.recordAction(project, '反转蒙版', () => { msk.inverted = e.target.checked; });
                this.app.refreshAll();
              },
            }),
            el('span', { text: '反转' }),
          ]),
          el('button', {
            className: 'ae-micro-btn danger',
            text: '×',
            onClick: () => {
              this.app.history.recordAction(project, '删除蒙版', () => { layer.masks.splice(mi, 1); });
              this.app.refreshAll();
            },
          }),
        ]),
      ]));
      card.appendChild(el('label', { className: 'prop-inline-row' }, [el('span', { text: '蒙版模式' }), mSel]));
      card.appendChild(this._buildPropRow(layer, `masks.${mi}.feather`, '羽化宽度'));
      card.appendChild(this._buildPropRow(layer, `masks.${mi}.opacity`, '蒙版不透明'));
      card.appendChild(this._buildPropRow(layer, `masks.${mi}.path`, '蒙版路径'));
      body.appendChild(card);
    });
    this.bodyEl.appendChild(sec);
  }

  _renderEffectsSection(project, comp, layer) {
    const addSel = el('select', { className: 'ae-select sm' }, [
      el('option', { value: '', text: '+ 添加效果...' }),
      el('option', { value: 'gaussianBlur', text: '高斯模糊 (Gaussian Blur)' }),
      el('option', { value: 'glow', text: '外发光 / 辉光 (Glow)' }),
      el('option', { value: 'dropShadow', text: '扩展投影 (Drop Shadow)' }),
      el('option', { value: 'hsl', text: '色相/饱和度/亮度 (HSL)' }),
    ]);
    addSel.addEventListener('change', () => {
      const t = addSel.value;
      addSel.value = '';
      if (!t) return;
      this.app.history.recordAction(project, `添加效果 ${t}`, () => {
        layer.effects.push(createEffect(t));
      });
      this.app.refreshAll();
    });

    const { sec, body } = this._makeSection(`效果管线 Effects (${layer.effects?.length || 0})`, [addSel]);
    (layer.effects || []).forEach((fx, fi) => {
      const card = el('div', { className: 'prop-sub-card' });
      card.appendChild(el('div', { className: 'prop-sub-head' }, [
        el('label', { className: 'prop-inline-chk' }, [
          el('input', {
            type: 'checkbox',
            checked: fx.enabled !== false,
            onChange: (e) => {
              this.app.history.recordAction(project, '开关效果', () => { fx.enabled = e.target.checked; });
              this.app.refreshAll();
            },
          }),
          el('span', { text: `${fi + 1}. ${fx.name}` }),
        ]),
        el('div', { className: 'prop-sub-btns' }, [
          el('button', {
            className: 'ae-micro-btn',
            text: '↑',
            title: '上移效果顺序',
            onClick: () => this._moveArrayItem(layer.effects, fi, -1, '重排效果管线顺序'),
          }),
          el('button', {
            className: 'ae-micro-btn',
            text: '↓',
            onClick: () => this._moveArrayItem(layer.effects, fi, 1, '重排效果管线顺序'),
          }),
          el('button', {
            className: 'ae-micro-btn danger',
            text: '×',
            onClick: () => {
              this.app.history.recordAction(project, '删除效果', () => { layer.effects.splice(fi, 1); });
              this.app.refreshAll();
            },
          }),
        ]),
      ]));

      for (const k of Object.keys(fx.params || {})) {
        const row = this._buildPropRow(layer, `effects.${fi}.params.${k}`);
        if (row) card.appendChild(row);
      }
      body.appendChild(card);
    });
    this.bodyEl.appendChild(sec);
  }

  _moveArrayItem(arr, idx, delta, label) {
    const target = idx + delta;
    if (target < 0 || target >= arr.length) return;
    this.app.history.recordAction(this.app.project, label, () => {
      const [item] = arr.splice(idx, 1);
      arr.splice(target, 0, item);
    });
    this.app.refreshAll();
  }
}

function getNodeCandidateOut(node) {
  return node.type === 'ExtrudeNode' || node.type === 'FieldDeformNode' || node.type === 'GroupNode' || node.type === 'BooleanNode' || node.type === 'TrimNode';
}
