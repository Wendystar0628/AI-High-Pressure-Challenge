// 工程面板：管理多合成列表、合成参数设置、程序节点图资产与已内置字体字符集信息

import {
  createComposition,
  getActiveComp,
  cloneVal,
  genId,
} from '../core/project.js';
import { createNodeGraph } from '../nodes/nodeGraph.js';
import { getAvailableFonts } from '../geometry/fonts.js';
import { el, showModalDialog, rgb01ToHex, hexToRgb01 } from './helpers.js';

export class ProjectPanel {
  constructor(containerEl, app) {
    this.containerEl = containerEl;
    this.app = app;
    this._renderSkeleton();
  }

  _renderSkeleton() {
    this.containerEl.innerHTML = '';
    this.headerEl = el('div', { className: 'panel-header' }, [
      el('span', { className: 'panel-title', text: '项目资源' }),
      el('div', { className: 'panel-actions' }, [
        el('button', {
          className: 'ae-btn sm',
          text: '+ 合成',
          title: '新建合成',
          onClick: () => this.promptNewComp(),
        }),
        el('button', {
          className: 'ae-btn sm',
          text: '+ 节点图',
          title: '新建程序节点图',
          onClick: () => this.createNewNodeGraph(),
        }),
      ]),
    ]);
    this.bodyEl = el('div', { className: 'panel-scroll project-body' });
    this.containerEl.appendChild(this.headerEl);
    this.containerEl.appendChild(this.bodyEl);
  }

  promptNewComp() {
    const project = this.app.project;
    showModalDialog({
      title: '新建合成',
      fields: [
        { name: 'name', label: '合成名称', value: `合成 ${project.compositions.length + 1}` },
        { name: 'width', label: '宽度 (px)', type: 'number', value: 1280, min: 64, max: 3840 },
        { name: 'height', label: '高度 (px)', type: 'number', value: 720, min: 64, max: 2160 },
        { name: 'fps', label: '帧率 (fps)', type: 'number', value: 30, min: 1, max: 120 },
        { name: 'duration', label: '时长 (秒)', type: 'number', value: 10, min: 0.5, max: 300 },
        { name: 'transparentBg', label: '透明背景', type: 'checkbox', value: false },
      ],
      onConfirm: (vals) => {
        this.app.history.recordAction(project, '新建合成', () => {
          const comp = createComposition({
            name: vals.name || '新合成',
            width: Math.max(64, Number(vals.width) || 1280),
            height: Math.max(64, Number(vals.height) || 720),
            fps: Math.max(1, Number(vals.fps) || 30),
            duration: Math.max(0.5, Number(vals.duration) || 10),
            transparentBg: !!vals.transparentBg,
          });
          project.compositions.push(comp);
          project.activeCompId = comp.id;
          project.selectedLayerIds = [];
        });
        this.app.refreshAll();
      },
    });
  }

  promptEditComp(comp) {
    const project = this.app.project;
    showModalDialog({
      title: `合成设置 · ${comp.name}`,
      fields: [
        { name: 'name', label: '名称', value: comp.name },
        { name: 'width', label: '宽度 (px)', type: 'number', value: comp.width, min: 64, max: 3840 },
        { name: 'height', label: '高度 (px)', type: 'number', value: comp.height, min: 64, max: 2160 },
        { name: 'fps', label: '帧率 (fps)', type: 'number', value: comp.fps, min: 1, max: 120 },
        { name: 'duration', label: '时长 (秒)', type: 'number', value: comp.duration, min: 0.5, max: 300 },
        { name: 'backgroundColor', label: '背景色 (Hex)', value: rgb01ToHex(comp.backgroundColor) },
        { name: 'transparentBg', label: '透明背景通道', type: 'checkbox', value: !!comp.transparentBg },
        { name: 'motionBlur', label: '启用快门运动模糊', type: 'checkbox', value: !!comp.motionBlur },
        { name: 'shutterAngle', label: '快门角度 (°)', type: 'number', value: comp.shutterAngle ?? 180, min: 0, max: 720 },
        { name: 'shutterPhase', label: '快门相位 (°)', type: 'number', value: comp.shutterPhase ?? -90, min: -360, max: 360 },
      ],
      onConfirm: (vals) => {
        this.app.history.recordAction(project, '修改合成设置', () => {
          comp.name = vals.name || comp.name;
          comp.width = Math.max(64, Number(vals.width) || comp.width);
          comp.height = Math.max(64, Number(vals.height) || comp.height);
          comp.fps = Math.max(1, Number(vals.fps) || comp.fps);
          comp.duration = Math.max(0.5, Number(vals.duration) || comp.duration);
          comp.workAreaEnd = Math.min(comp.duration, Math.max(comp.workAreaStart + 0.1, comp.workAreaEnd));
          comp.currentTime = Math.min(comp.duration, Math.max(0, comp.currentTime));
          comp.backgroundColor = hexToRgb01(vals.backgroundColor, 1);
          comp.transparentBg = !!vals.transparentBg;
          comp.motionBlur = !!vals.motionBlur;
          comp.shutterAngle = Math.max(0, Math.min(720, Number(vals.shutterAngle) ?? 180));
          comp.shutterPhase = Math.max(-360, Math.min(360, Number(vals.shutterPhase) ?? -90));
        });
        this.app.refreshAll();
      },
    });
  }

  createNewNodeGraph() {
    const project = this.app.project;
    let newGraph = null;
    this.app.history.recordAction(project, '新建节点图', () => {
      newGraph = createNodeGraph(`程序几何图 ${(project.nodeGraphs?.length || 0) + 1}`);
      if (!project.nodeGraphs) project.nodeGraphs = [];
      project.nodeGraphs.push(newGraph);
    });
    if (newGraph) {
      this.app.openNodeGraph(newGraph.id);
    }
    this.app.refreshAll();
  }

  render() {
    const project = this.app.project;
    if (!project) return;
    const activeComp = getActiveComp(project);
    this.bodyEl.innerHTML = '';

    // 1. 合成资产区
    const compSec = el('div', { className: 'proj-section' });
    compSec.appendChild(el('div', { className: 'proj-sec-title', text: `合成 (${project.compositions.length})` }));
    for (const c of project.compositions) {
      const isActive = activeComp && c.id === activeComp.id;
      const item = el('div', {
        className: `proj-item ${isActive ? 'active' : ''}`,
        onClick: () => {
          project.activeCompId = c.id;
          project.selectedLayerIds = [];
          this.app.refreshAll();
        },
        onDblclick: () => this.promptEditComp(c),
      });
      item.appendChild(el('span', { className: 'proj-badge comp', text: '合成' }));
      item.appendChild(
        el('div', { className: 'proj-item-info' }, [
          el('div', { className: 'proj-item-name', text: c.name }),
          el('div', {
            className: 'proj-item-sub',
            text: `${c.width}×${c.height} · ${c.fps}fps · ${c.duration}s · ${c.layers.length}层`,
          }),
        ])
      );
      const btns = el('div', { className: 'proj-item-btns' }, [
        el('button', {
          className: 'ae-icon-btn',
          text: '⚙',
          title: '合成设置',
          onClick: (e) => {
            e.stopPropagation();
            this.promptEditComp(c);
          },
        }),
      ]);
      if (project.compositions.length > 1) {
        btns.appendChild(
          el('button', {
            className: 'ae-icon-btn danger',
            text: '×',
            title: '删除合成',
            onClick: (e) => {
              e.stopPropagation();
              this.app.history.recordAction(project, '删除合成', () => {
                project.compositions = project.compositions.filter((x) => x.id !== c.id);
                if (project.activeCompId === c.id) {
                  project.activeCompId = project.compositions[0]?.id || null;
                }
                project.selectedLayerIds = [];
              });
              this.app.refreshAll();
            },
          })
        );
      }
      item.appendChild(btns);
      compSec.appendChild(item);
    }
    this.bodyEl.appendChild(compSec);

    // 2. 程序节点图资产区
    const ngList = project.nodeGraphs || [];
    const ngSec = el('div', { className: 'proj-section' });
    ngSec.appendChild(el('div', { className: 'proj-sec-title', text: `程序节点图 (${ngList.length})` }));
    for (const g of ngList) {
      const isCur = this.app.activeNodeGraphId === g.id;
      const item = el('div', {
        className: `proj-item ${isCur ? 'active' : ''}`,
        onClick: () => {
          this.app.openNodeGraph(g.id);
        },
      });
      item.appendChild(el('span', { className: 'proj-badge node', text: '节点' }));
      item.appendChild(
        el('div', { className: 'proj-item-info' }, [
          el('div', { className: 'proj-item-name', text: g.name }),
          el('div', { className: 'proj-item-sub', text: `${g.nodes.length} 节点 · ${g.edges.length} 连线` }),
        ])
      );
      const btns = el('div', { className: 'proj-item-btns' }, [
        el('button', {
          className: 'ae-icon-btn',
          text: '复制',
          title: '复制节点图',
          onClick: (e) => {
            e.stopPropagation();
            this.app.history.recordAction(project, '复制节点图', () => {
              const dup = cloneVal(g);
              dup.id = genId('ng');
              dup.name = `${g.name} 副本`;
              dup._evalCache = null;
              project.nodeGraphs.push(dup);
            });
            this.app.refreshAll();
          },
        }),
      ]);
      item.appendChild(btns);
      ngSec.appendChild(item);
    }
    this.bodyEl.appendChild(ngSec);

    // 3. 当前合成快捷开关
    if (activeComp) {
      const quick = el('div', { className: 'proj-section' });
      quick.appendChild(el('div', { className: 'proj-sec-title', text: '当前合成快门与画布' }));
      const row1 = el('label', { className: 'proj-check-row' }, [
        el('input', {
          type: 'checkbox',
          checked: !!activeComp.motionBlur,
          onChange: (e) => {
            this.app.history.recordAction(project, '切换合成运动模糊', () => {
              activeComp.motionBlur = e.target.checked;
            });
            this.app.refreshAll();
          },
        }),
        el('span', { text: `快门模糊 (${activeComp.shutterAngle ?? 180}° / 相位 ${activeComp.shutterPhase ?? -90}°)` }),
      ]);
      const row2 = el('label', { className: 'proj-check-row' }, [
        el('input', {
          type: 'checkbox',
          checked: !!activeComp.transparentBg,
          onChange: (e) => {
            this.app.history.recordAction(project, '切换透明棋盘背景', () => {
              activeComp.transparentBg = e.target.checked;
            });
            this.app.refreshAll();
          },
        }),
        el('span', { text: '透明背景通道 (棋盘格)' }),
      ]);
      quick.appendChild(row1);
      quick.appendChild(row2);
      this.bodyEl.appendChild(quick);
    }

    // 4. 内置离线字体包字符范围明示
    const fonts = getAvailableFonts();
    const fontSec = el('div', { className: 'proj-section' });
    fontSec.appendChild(el('div', { className: 'proj-sec-title', text: `内置可矢量化字体 (${fonts.length})` }));
    for (const f of fonts) {
      fontSec.appendChild(
        el('div', { className: 'proj-font-card' }, [
          el('div', { className: 'proj-font-name', text: f.displayName }),
          el('div', {
            className: 'proj-font-meta',
            text: `共 ${f.totalGlyphs} 字形 (汉字 ${f.cjkCount}) · ${f.rangeDescription || '常用汉字与西文标点'}`,
          }),
        ])
      );
    }
    this.bodyEl.appendChild(fontSec);
  }
}
