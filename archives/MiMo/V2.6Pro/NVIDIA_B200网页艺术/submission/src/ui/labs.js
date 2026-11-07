// ============================================================
// 交互面板：部件列表 / 拆解控制 / 接缝 / 矩阵实验 / 观察窗 / 分片 / 规格表
// ============================================================
import { h } from './beats.js';
import { quantizeMatrix, matmul, traceMACs, nonzeroCount, quantize, formatBitString } from '../numerics.js';
import { store, FACTS, workload, PRECISIONS, precisionById, GPU_PEAK } from '../state.js';
import { fmtNum, fmtBytes } from '../svg/runtime.js';

const PART_INFO = {
  lid: { name: '盖板与加固框架', desc: '镍铜盖板与周边加固框，压住晶粒与显存并导热。拆解第一步先抬开盖板。' },
  dieA: { name: '计算晶粒 A', desc: '光罩极限尺寸硅片。顶面是 Tensor 阵列、L2 与接口区；底面是微凸点。与晶粒 B 以 NV-HBI 相连。' },
  dieB: { name: '计算晶粒 B', desc: '与晶粒 A 镜像对称，共同组成一颗 GPU。两颗晶粒共享统一的显存与 NVLink 域。' },
  bridge: { name: '片间互连桥 NV-HBI', desc: '两颗晶粒之间的高密度互连，10 TB/s。拉开接缝时，跨缝传输在断口处停止。' },
  interposer: { name: '硅中介层', desc: '把晶粒与显存的微凸点扇出到基板，表面有细密走线，连接晶粒之间与显存之间的通道。' },
  substrate: { name: '有机基板', desc: '多层铜走线的有机基板，把中介层信号引到 BGA 焊球。含芯板与四层铜（剖切可见）。' },
  balls: { name: 'BGA 焊球阵列', desc: '底面焊球阵列，把整个封装焊到主板。数量以千计，提供供电与信号通道。' },
  caps: { name: '去耦元件', desc: '基板外围的去耦电容阵列，为晶粒瞬态电流提供本地储能。' },
  hbm0: { name: 'HBM3e 堆栈 1', desc: '基底 + 8 层 DRAM，层间微凸点与贯穿硅通孔（TSV）。可单独展开查看层结构。' },
};
for (let i = 0; i < 8; i++) {
  if (!PART_INFO['hbm' + i]) {
    PART_INFO['hbm' + i] = {
      name: `HBM3e 堆栈 ${i + 1}`,
      desc: '基底 + 8 层 DRAM，层间微凸点与贯穿硅通孔（TSV）。可单独展开查看层结构。',
    };
  }
}

function toastMsg(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

export class Labs {
  constructor(beats) {
    this.beats = beats;
    this.buildParts();
    this.buildExplodeControls();
    this.buildPartDetail();
    this.buildSeamControls();
    this.buildMatrixLab();
    this.buildLoupe();
    this.buildShardTask();
    this.buildSpecTable();
  }

  // ---------- 02 部件列表 ----------
  buildParts() {
    const root = this.beats.panels['parts'];
    if (!root) return;
    root.appendChild(h('div', { class: 'control-panel', html: '<h4>部件 · PARTS</h4>' }));
    const panel = root.querySelector('.control-panel');
    const list = h('div', { class: 'part-list' });
    const ids = ['lid', 'dieA', 'dieB', 'bridge', 'interposer', 'substrate', 'balls', 'caps', 'hbm0'];
    this.partButtons = {};
    for (const id of ids) {
      const info = PART_INFO[id] || { name: id, desc: '' };
      const btn = h('button', {
        class: 'part-item', type: 'button',
        onclick: () => {
          store.set('selectedPart', store.selectedPart === id ? null : id, 'select');
        },
      }, [
        h('span', { text: info.name }),
        h('span', { class: 'pmark', text: id.toUpperCase() }),
      ]);
      list.appendChild(btn);
      this.partButtons[id] = btn;
    }
    panel.appendChild(list);
    const desc = h('div', { class: 'part-desc', id: 'part-desc' });
    desc.textContent = '选择部件：三维、线稿与本列表同步高亮。';
    panel.appendChild(desc);
    this.partDesc = desc;
  }

  // ---------- 02 拆解控制 ----------
  buildExplodeControls() {
    const root = this.beats.panels['explode-controls'];
    if (!root) return;
    const panel = h('div', { class: 'control-panel' });
    panel.appendChild(h('h4', { text: '拆解与剖切 · CONTROLS' }));

    // 展开滑杆
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('span', { class: 'ctrl-label', text: '展开程度' }),
      h('input', {
        type: 'range', min: 0, max: 100, value: 0, id: 'rng-explode',
        oninput: (e) => {
          const v = e.target.value / 100;
          store.set('explode', v, 'explode');
          if (window.__scene) window.__scene.setUserExplode(v);
          e.target.style.setProperty('--fill', (v * 100) + '%');
        },
      }),
      h('span', { class: 'ctrl-value', id: 'val-explode', text: '0%' }),
    ]));
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('button', {
        class: 'action secondary', type: 'button', text: '跟随滚动',
        onclick: () => {
          if (window.__scene) window.__scene.clearUserExplode();
          const r = document.getElementById('rng-explode');
          if (r) { r.value = 0; r.style.setProperty('--fill', '0%'); }
          const v = document.getElementById('val-explode');
          if (v) v.textContent = '自动';
          store.set('explode', 0, 'explode');
        },
      }),
      h('button', {
        class: 'action secondary', type: 'button', text: '全部展开',
        onclick: () => {
          if (window.__scene) window.__scene.setUserExplode(1);
          const r = document.getElementById('rng-explode');
          if (r) { r.value = 100; r.style.setProperty('--fill', '100%'); }
          const v = document.getElementById('val-explode');
          if (v) v.textContent = '100%';
          store.set('explode', 1, 'explode');
        },
      }),
    ]));

    // 剖切滑杆
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('span', { class: 'ctrl-label', text: '剖切位置' }),
      h('input', {
        type: 'range', min: 0, max: 100, value: 0, id: 'rng-cut',
        oninput: (e) => {
          const v = e.target.value / 100;
          store.set('cutaway', v, 'cutaway');
          e.target.style.setProperty('--fill', (v * 100) + '%');
          const lb = document.getElementById('val-cut');
          if (lb) lb.textContent = Math.round(v * 100) + '%';
        },
      }),
      h('span', { class: 'ctrl-value', id: 'val-cut', text: '0%' }),
    ]));
    panel.appendChild(h('p', {
      class: 'part-desc',
      text: '剖切显示具有厚度的实心截面与不同材料内部层次；右侧二维剖面同步移动。',
    }));
    root.appendChild(panel);
  }

  // ---------- 02 部件详情（深入一级） ----------
  buildPartDetail() {
    const root = this.beats.panels['part-detail'];
    if (!root) return;
    const panel = h('div', { class: 'control-panel' });
    panel.appendChild(h('h4', { text: '深入一级 · DETAIL' }));
    this.detailBody = h('div', { class: 'part-desc' });
    this.detailBody.innerHTML = '选中部件后，这里显示更细一层的结构说明与数据分区。';
    panel.appendChild(this.detailBody);

    // DRAM 逻辑分区（随精度联动）
    panel.appendChild(h('h4', { text: 'DRAM 逻辑分区（随精度联动）', style: 'margin-top:14px' }));
    this.dramBars = h('div', { id: 'dram-partition' });
    panel.appendChild(this.dramBars);
    root.appendChild(panel);
  }

  // ---------- 03 接缝控制 ----------
  buildSeamControls() {
    const root = this.beats.panels['seam-controls'];
    if (!root) return;
    const panel = h('div', { class: 'control-panel' });
    panel.appendChild(h('h4', { text: '接缝 · DIE SEAM' }));
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('span', { class: 'ctrl-label', text: '拉开接缝' }),
      h('input', {
        type: 'range', min: 0, max: 100, value: 0, id: 'rng-seam',
        oninput: (e) => {
          const v = e.target.value / 100;
          store.set('dieSeamGap', v, 'seam');
          e.target.style.setProperty('--fill', (v * 100) + '%');
          const lb = document.getElementById('val-seam');
          if (lb) lb.textContent = v > 0.35 ? '已断开' : Math.round(v * 100) + '%';
        },
      }),
      h('span', { class: 'ctrl-value', id: 'val-seam', text: '0%' }),
    ]));
    this.seamState = h('div', {
      class: 'part-desc',
      text: '接缝拉距 > 35% 时，跨缝脉冲停在断口；合拢后重新传输。',
    });
    panel.appendChild(this.seamState);
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('button', {
        class: 'action', type: 'button', text: '重放通信过程',
        onclick: () => {
          store.set('dieSeamGap', 0, 'seam');
          const r = document.getElementById('rng-seam');
          if (r) { r.value = 0; r.style.setProperty('--fill', '0%'); }
          window.__replayTime = performance.now() / 1000;
        },
      }),
    ]));
    root.appendChild(panel);
  }

  // ---------- 05 矩阵实验 ----------
  buildMatrixLab() {
    const root = this.beats.panels['matrix-lab'];
    if (!root) return;
    const panel = h('div', { class: 'control-panel' });
    panel.appendChild(h('h4', { text: '矩阵实验 · QUANTIZED MATMUL' }));

    // 格式切换（FP16 / FP8 / FP4）
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': '实验精度' });
    for (const f of ['FP16', 'FP8', 'FP4']) {
      seg.appendChild(h('button', {
        type: 'button', text: f, 'data-fmt': f,
        'aria-pressed': String(store.precision === f),
        onclick: () => {
          store.setPrecision(f);
          this.syncMatrixLab();
        },
      }));
    }
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('span', { class: 'ctrl-label', text: '实验格式' }), seg,
    ]));

    // 稀疏 / 稠密
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('span', { class: 'ctrl-label', text: '计算模式' }),
      h('div', { class: 'seg' }, [
        h('button', {
          type: 'button', text: '稠密', id: 'btn-dense',
          'aria-pressed': String(!store.sparse),
          onclick: () => { store.set('sparse', false, 'sparse'); store.save(); this.syncMatrixLab(); },
        }),
        h('button', {
          type: 'button', text: '稀疏', id: 'btn-sparse',
          'aria-pressed': String(store.sparse),
          onclick: () => {
            store.set('sparse', true, 'sparse');
            // 把 A 的一些元素清零（2:4 结构化示意）
            for (let i = 0; i < 4; i++) {
              if (i % 2 === 0) store.setMat('A', i, 1, 0);
              if (i % 2 === 1) store.setMat('B', i, 2, 0);
            }
            store.save();
            this.syncMatrixLab();
          },
        }),
      ]),
      h('button', {
        class: 'action secondary', type: 'button', text: '重置输入',
        onclick: () => { store.resetMat(); this.syncMatrixLab(); },
      }),
    ]));

    // 矩阵网格
    const wrap = h('div', { class: 'mat-row' });
    this.gridA = this.makeGrid('A');
    this.gridB = this.makeGrid('B');
    this.gridQ = this.makeGrid('Q', true);
    this.gridE = this.makeGrid('E', true);
    wrap.appendChild(this.gridA.block);
    wrap.appendChild(h('div', { class: 'mat-op', text: '×' }));
    wrap.appendChild(this.gridB.block);
    wrap.appendChild(h('div', { class: 'mat-op', text: '=' }));
    wrap.appendChild(this.gridQ.block);
    wrap.appendChild(h('div', { class: 'mat-op', text: 'Δ' }));
    wrap.appendChild(this.gridE.block);
    panel.appendChild(wrap);

    this.readout = h('div', { class: 'readout-strip' });
    panel.appendChild(this.readout);

    // 持续运行：累计运算量随演示时间变化
    this.opsRunning = false;
    this.opsT0 = 0;
    this.opsAcc = 0;
    this.opsBase = 0;
    this.opsRow = h('div', { class: 'ctrl-row', style: 'margin-top:8px' }, [
      h('button', {
        class: 'action', type: 'button', text: '▶ 持续运行', id: 'btn-ops-run',
        onclick: () => {
          this.opsRunning = !this.opsRunning;
          const b = document.getElementById('btn-ops-run');
          if (b) {
            b.textContent = this.opsRunning ? '❚❚ 暂停' : '▶ 持续运行';
            b.classList.toggle('on', this.opsRunning);
          }
          if (this.opsRunning && this._now != null) {
            this.opsT0 = this._now;
            this.opsBase = this.opsAcc;
          } else if (!this.opsRunning) {
            this.opsBase = this.opsAcc;
          }
        },
      }),
      h('button', {
        class: 'action secondary', type: 'button', text: '清零',
        onclick: () => { this.opsAcc = 0; this.opsBase = 0; this.opsT0 = this._now || 0; this.updateOpsRead(); },
      }),
    ]);
    panel.appendChild(this.opsRow);
    this.opsRead = h('div', {
      class: 'readout-strip',
      html: '<span>累计运算量 <b id="ops-acc">0</b> OP（示意工作量）· 演示速率与官方峰值分列</span>',
    });
    panel.appendChild(this.opsRead);

    // 追踪
    this.traceBox = h('div', { class: 'part-desc', style: 'margin-top:8px' });
    this.traceBox.textContent = '点击结果元素，追踪它参与的乘加。';
    panel.appendChild(this.traceBox);

    root.appendChild(panel);
    this.syncMatrixLab();
  }

  makeGrid(which, readonly = false) {
    const block = h('div', { class: 'mat-block' });
    const title = h('div', {
      class: 'mat-title',
      text: which === 'A' ? '输入 A' : which === 'B' ? '输入 B' : which === 'Q' ? '量化结果 C' : '误差 Δ',
    });
    const grid = h('div', { class: 'mat-grid n4' });
    const cells = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (readonly) {
          const c = h('div', {
            class: 'mat-cell',
            tabindex: '0',
            role: 'button',
            onclick: () => {
              if (which === 'Q') {
                store.set('traceIJ', [i, j], 'trace');
                this.showTrace(i, j);
              }
            },
          });
          grid.appendChild(c);
          cells.push(c);
        } else {
          const c = h('input', {
            class: 'mat-cell', type: 'text',
            'data-i': i, 'data-j': j,
            onchange: (e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) store.setMat(which, i, j, v);
              this.syncMatrixLab();
            },
          });
          grid.appendChild(c);
          cells.push(c);
        }
      }
    }
    block.appendChild(title);
    block.appendChild(grid);
    return { block, grid, cells, which };
  }

  syncMatrixLab() {
    const fmt = store.precision === 'TF32' || store.precision === 'BF16' || store.precision === 'FP64'
      ? 'FP16' : store.precision;
    // 输入值
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const ia = this.gridA.cells[i * 4 + j];
        const ib = this.gridB.cells[i * 4 + j];
        if (document.activeElement !== ia) ia.value = store.matA[i][j].toFixed(2);
        if (document.activeElement !== ib) ib.value = store.matB[i][j].toFixed(2);
      }
    }
    // 量化
    const qa = quantizeMatrix(store.matA, fmt);
    const qb = quantizeMatrix(store.matB, fmt);
    const cq = matmul(qa.mat, qb.mat);
    const cref = matmul(store.matA, store.matB);
    let errMax = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const idx = i * 4 + j;
        this.gridQ.cells[idx].textContent = cq[i][j].toFixed(3);
        const err = cq[i][j] - cref[i][j];
        errMax = Math.max(errMax, Math.abs(err));
        const ec = this.gridE.cells[idx];
        ec.textContent = err.toFixed(3);
        ec.classList.toggle('err', Math.abs(err) > 0.05);
      }
    }
    // 稀疏
    document.getElementById('btn-dense')?.setAttribute('aria-pressed', String(!store.sparse));
    document.getElementById('btn-sparse')?.setAttribute('aria-pressed', String(store.sparse));
    const nzA = nonzeroCount(store.matA), nzB = nonzeroCount(store.matB);
    const ops = nzA * nzB / 4 * 4; // 粗略 MAC 计数（示意）
    const wl = workload();
    const peaks = GPU_PEAK[store.precision] || GPU_PEAK.FP4;
    const fmtName = store.precision === 'FP4' ? 'FP4 (NVFP4, 16 值共享 E4M3 缩放)' : store.precision;
    this.readout.innerHTML = `
      <span>格式 <b>${fmtName}</b></span>
      <span>量化块缩放 <b>${fmt === 'FP4' ? qa.scale.toFixed(4) : '—'}</b></span>
      <span>最大结果误差 <b class="${errMax > 0.05 ? 'warn' : ''}">${errMax.toFixed(4)}</b></span>
      <span>非零 A/B <b>${nzA}/${nzB}</b></span>
      <span>参与乘加 <b>${store.sparse ? Math.round(ops) : 64}</b></span>
      <span>负载 <b>${fmtBytes(wl.bytes)}</b> → <b>${wl.gpusNeeded} GPU</b></span>
      <span>官方峰值 <b>${peaks.dense} ${peaks.unit}</b> 稠密 / <b>${peaks.sparse}</b> 稀疏</span>`;

    // 格式按钮状态
    for (const btn of this.beats.panels['matrix-lab']?.querySelectorAll('[data-fmt]') || []) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-fmt') === store.precision));
    }
  }

  showTrace(i, j) {
    const fmt = store.precision === 'TF32' || store.precision === 'BF16' || store.precision === 'FP64'
      ? 'FP16' : store.precision;
    const qa = quantizeMatrix(store.matA, fmt);
    const qb = quantizeMatrix(store.matB, fmt);
    const steps = traceMACs(qa.mat, qb.mat, i, j);
    // 高亮
    for (const c of this.gridQ.cells) c.classList.remove('trace');
    this.gridQ.cells[i * 4 + j].classList.add('trace');
    let html = `<b>追踪 C[${i}][${j}]</b>：`;
    for (const s of steps) {
      html += `A[${i}][${s.t}]=${s.av.toFixed(2)} × B[${s.t}][${j}]=${s.bv.toFixed(2)} → ${s.p.toFixed(3)}；`;
    }
    html += `累加 = ${steps[steps.length - 1].acc.toFixed(3)}`;
    this.traceBox.innerHTML = html;
  }

  // ---------- 04 局部观察窗 ----------
  buildLoupe() {
    const root = this.beats.panels['loupe'];
    if (!root) return;
    const panel = h('div', { class: 'control-panel' });
    panel.appendChild(h('h4', { text: '局部观察窗 · LOUPE' }));
    panel.appendChild(h('p', {
      class: 'part-desc',
      text: '拖动下方观察窗，在二维版图同一位置看到更深入的三维结构与流动数据（放大 + 折射表现）。',
    }));
    const wrap = h('div', { style: 'margin-top:10px;position:relative;height:180px;border:1px solid rgba(130,175,230,0.25);border-radius:10px;overflow:hidden;background:rgba(8,14,24,0.7);cursor:grab;' });
    this.loupeCanvas = h('canvas', { width: 520, height: 300, style: 'width:100%;height:100%;display:block' });
    wrap.appendChild(this.loupeCanvas);
    this.loupeWrap = wrap;
    panel.appendChild(wrap);

    // 拖动
    let dragging = false;
    this.loupePos = { x: 0.5, y: 0.5 };
    const setFromEvent = (e) => {
      const r = wrap.getBoundingClientRect();
      this.loupePos.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      this.loupePos.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    };
    wrap.addEventListener('pointerdown', (e) => {
      dragging = true;
      wrap.setPointerCapture(e.pointerId);
      wrap.style.cursor = 'grabbing';
      setFromEvent(e);
    });
    wrap.addEventListener('pointermove', (e) => { if (dragging) setFromEvent(e); });
    wrap.addEventListener('pointerup', (e) => {
      dragging = false;
      wrap.style.cursor = 'grab';
    });
    panel.appendChild(h('div', { class: 'ctrl-row', style: 'margin-top:10px' }, [
      h('button', {
        class: 'action', type: 'button', text: '重放数据路径',
        onclick: () => {
          window.__replayTime = performance.now() / 1000;
          toastMsg('重放：显存层 → 连接 → 计算单元');
        },
      }),
      h('span', { class: 'pmark', text: '从任一堆栈到计算区' }),
    ]));
    root.appendChild(panel);
  }

  drawLoupe(time) {
    if (!this.loupeCanvas) return;
    const ctx = this.loupeCanvas.getContext('2d');
    const W = this.loupeCanvas.width, H = this.loupeCanvas.height;
    ctx.clearRect(0, 0, W, H);
    // 底层二维版图
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(70,216,255,0.25)';
    for (let x = 0; x < W; x += 26) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 26) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // 数据流
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = i % 2 ? 'rgba(110,242,160,0.5)' : 'rgba(70,216,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const y0 = 20 + i * 34;
      ctx.moveTo(0, y0);
      for (let x = 0; x <= W; x += 20) {
        ctx.lineTo(x, y0 + Math.sin(x * 0.02 + time * 1.4 + i) * 10);
      }
      ctx.stroke();
    }
    // 观察窗（放大 + 折射环）
    const px = this.loupePos.x * W, py = this.loupePos.y * H;
    const R = 74;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    ctx.clip();
    // 放大绘制：把画布自身放大
    ctx.drawImage(this.loupeCanvas, px - R * 0.55, py - R * 0.55, R * 1.1, R * 1.1, px - R, py - R, R * 2, R * 2);
    // 内部三维结构示意（TSV 柱 + 层）
    const fmt = store.precision;
    for (let L = 0; L < 6; L++) {
      ctx.fillStyle = `rgba(70,216,255,${0.12 + L * 0.05})`;
      ctx.fillRect(px - R, py + R - 24 - L * 18, R * 2, 14);
    }
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = 'rgba(216,168,96,0.85)';
      ctx.fillRect(px - 60 + k * 18, py - R * 0.6, 6, R * 1.2);
    }
    // 流动数据块
    for (let i = 0; i < 6; i++) {
      const t = (time * 0.35 + i / 6) % 1;
      ctx.fillStyle = fmt === 'FP4' ? 'rgba(255,107,107,0.9)' : 'rgba(70,216,255,0.9)';
      ctx.fillRect(px - R + t * R * 2, py - 10 + Math.sin(i * 2) * 20, 14, 10);
    }
    ctx.restore();
    // 折射环
    const grad = ctx.createRadialGradient(px, py, R * 0.82, px, py, R * 1.06);
    grad.addColorStop(0, 'rgba(70,216,255,0)');
    grad.addColorStop(0.72, 'rgba(70,216,255,0.18)');
    grad.addColorStop(0.88, 'rgba(155,235,255,0.55)');
    grad.addColorStop(1, 'rgba(70,216,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, R * 1.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- 06 分片任务 ----------
  buildShardTask() {
    const root = this.beats.panels['shard-task'];
    if (!root) return;
    const panel = h('div', { class: 'control-panel' });
    panel.appendChild(h('h4', { text: '分片计算任务 · SHARDING' }));
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('span', { class: 'ctrl-label', text: '负载规模' }),
      h('input', {
        type: 'range', min: 25, max: 1600, value: 100, id: 'rng-load',
        oninput: (e) => {
          const v = e.target.value / 100;
          store.set('loadScale', v, 'load');
          e.target.style.setProperty('--fill', ((e.target.value - 25) / 1575 * 100) + '%');
          this.updateShardTask();
        },
      }),
      h('span', { class: 'ctrl-value', id: 'val-load', text: '1.0×' }),
    ]));
    this.shardRead = h('div', { class: 'part-desc' });
    panel.appendChild(this.shardRead);
    panel.appendChild(h('div', { class: 'ctrl-row' }, [
      h('button', {
        class: 'action', type: 'button', text: '从 GPU 1 重放',
        onclick: () => {
          store.set('shardRound', store.shardRound + 1, 'shard');
          window.__replayTime = performance.now() / 1000;
        },
      }),
    ]));
    panel.appendChild(h('p', {
      class: 'part-desc',
      text: '默认示例：单卡 186 GB 装不下此负载，八卡分片后可容纳；改变精度或负载规模后重新估算。显存容量按逻辑数据量估算，链路口径：NVLink 1.8 TB/s 双向/卡。',
    }));
    root.appendChild(panel);
    this.updateShardTask();
  }

  updateOpsRead() {
    const node = document.getElementById('ops-acc');
    if (node) node.textContent = fmtNum(this.opsAcc, 2);
  }

  updateShardTask() {
    const wl = workload();
    const fmt = store.precision;
    const bpv = store.precisionDef;
    if (this.shardRead) {
      this.shardRead.innerHTML = `
        格式 <b>${fmt}</b>（${bpv.bits} bit${fmt === 'FP4' ? ' + 16 值共享缩放 ≈4.5 bit/值' : ''}）<br>
        负载 <b>${fmtNum(wl.elements)}</b> 值 = <b>${fmtBytes(wl.bytes)}</b><br>
        单卡显存 ${FACTS.hbm3eCapacity} GB → 需要 <b>${wl.gpusNeeded}</b> GPU / <b>${wl.platformsNeeded}</b> 平台<br>
        分片后每卡 <b>${fmtBytes(wl.perShardBytes)}</b>`;
    }
    const lb = document.getElementById('val-load');
    if (lb) lb.textContent = store.loadScale.toFixed(2) + '×';
  }

  // ---------- 07 规格表 ----------
  buildSpecTable() {
    const root = this.beats.panels['spec-table'];
    if (!root) return;
    const wrap = h('div', { class: 'spec-table-wrap' });
    const rows = [
      ['B200', '单颗 GPU（双晶粒）', '186 GB', '8 TB/s', 'NVLink 1.8 TB/s', '20|10', '10|5', '5|2.5', '40 / 40', '≈1000 W'],
      ['HGX B200', '8×B200 基板', '1.4 TB', '64 TB/s', 'NVLink 14.4 TB/s', '144|72', '72', '36', '296 / 296', '随整机'],
      ['DGX B200', '8×B200 服务器', '1,440 GB', '64 TB/s', 'NVLink 14.4 TB/s', '144|72', '72', '36', '296 / 296', '≈14.3 kW'],
      ['GB200', '1 Grace + 2×B200', '372 GB', '16 TB/s', 'C2C 900 GB/s', '40|20', '20', '10', '80 / 80', '≈2.7 kW'],
      ['GB200 NVL72', '36 Grace + 72 GPU', '13.4 TB', '576 TB/s', 'NVLink 域 130 TB/s', '1,440|720', '720', '360', '2,880 / 2,880', '≈120–132 kW'],
    ];
    const thead = `<thead><tr>
      <th>产品</th><th>组成</th><th>显存</th><th>带宽</th><th>互连</th>
      <th>FP4 稀疏|稠密</th><th>FP8 稀疏</th><th>FP16 稀疏</th><th>FP64 / Tensor</th><th>功耗</th>
    </tr></thead>`;
    let tbody = '';
    for (const r of rows) {
      tbody += `<tr data-prod="${r[0]}"><td class="prod">${r[0]}</td><td class="dim">${r[1]}</td>`;
      for (let i = 2; i < r.length; i++) tbody += `<td class="num">${r[i]}</td>`;
      tbody += '</tr>';
    }
    const foot = `<tfoot><tr><td colspan="10" class="foot">
      算力单位 PFLOPS（FP64 为 TFLOPS）。口径：稀疏 | 稠密（NVIDIA GB200 NVL72 官方表；HGX/DGX B200 采用风冷配置数值，与 GB200 液冷配置的每卡 20|10 PFLOPS 略有差别）。
      单卡指标与系统总量已分列。数据来源：NVIDIA Blackwell 发布稿、NVIDIA DGX B200 / HGX / GB200 NVL72 产品页、NVFP4 技术博客。本页为概念设计作品，非 NVIDIA 官方页面。
    </td></tr></tfoot>`;
    wrap.appendChild(h('table', { class: 'spec', html: thead + tbody + foot }));
    root.appendChild(wrap);
    // 行选择 → selectedProduct
    wrap.querySelectorAll('tr[data-prod]').forEach((tr) => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => {
        const id = tr.getAttribute('data-prod') === 'HGX B200' ? 'HGX'
          : tr.getAttribute('data-prod') === 'DGX B200' ? 'DGX'
          : tr.getAttribute('data-prod') === 'GB200 NVL72' ? 'NVL72'
          : tr.getAttribute('data-prod') === 'GB200' ? 'GB200' : 'B200';
        store.set('selectedProduct', store.selectedProduct === id ? null : id, 'product');
      });
    });
    this.specWrap = wrap;
  }

  // ---------- 每帧刷新 ----------
  update(p, time) {
    this._now = time;
    // 持续运行累计：ops = 冻结值 + 速率 × (time - 起点)，纯时间函数（导出确定）
    if (this.opsRunning && this.opsT0 != null) {
      const peaks = GPU_PEAK[store.precision] || GPU_PEAK.FP4;
      const rate = peaks.dense * 1e12 * 1e-4; // 演示速率（示意），与官方峰值分列
      this.opsAcc = this.opsBase + rate * Math.max(0, time - this.opsT0);
      this.updateOpsRead();
    }
    // 部件高亮
    if (this.partButtons) {
      for (const id in this.partButtons) {
        this.partButtons[id].classList.toggle('selected', store.selectedPart === id);
      }
    }
    if (this.partDesc && store.selectedPart) {
      const info = PART_INFO[store.selectedPart] || PART_INFO[store.selectedPart.replace(/\d+$/, '')];
      if (info) {
        this.partDesc.innerHTML = `<b>${info.name}</b><br>${info.desc}`;
      }
    }
    if (this.detailBody && store.selectedPart) {
      const id = store.selectedPart;
      const extra = id.startsWith('hbm')
        ? '深入：基底逻辑层 + 8 层 DRAM，层间微凸点与贯穿 TSV 已在展开时显形。'
        : id.startsWith('die')
          ? '深入：功能区包括 Tensor 阵列、L2、HBM PHY、NVLink PHY 与片间互连 PHY（示意布局）。'
          : id === 'substrate'
            ? '深入：阻焊 / 芯板 / 四层铜走线（剖切面可观察）。'
            : id === 'interposer'
              ? '深入：表面扇出走线连接晶粒与显存、以及两颗晶粒之间。'
              : '';
      this.detailBody.innerHTML = `<b>${(PART_INFO[id] || {}).name || id}</b><br>${extra || '结构见左侧分层线稿。'}`;
    }

    // DRAM 逻辑分区（02 章，随精度联动）
    if (this.dramBars) {
      const fmt = store.precision;
      const bits = store.precisionDef.bits;
      const bpv = store.bytesPerValue;
      const totalGB = FACTS.hbm3eCapacity;
      const values = totalGB * 1e9 / bpv;
      const groups = fmt === 'FP4' ? 16 : fmt === 'FP8' ? 8 : 4;
      const barW = 12 + (bits / 64) * 200;
      this.dramBars.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center;margin:6px 0">
          <div style="width:${barW}px;height:14px;border-radius:3px;background:linear-gradient(90deg,var(--precision),transparent);border:1px solid color-mix(in srgb,var(--precision) 50%,transparent)"></div>
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--ink-2)">${bits} bit / 值</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--ink-3);line-height:1.7">
          分组 ${groups} 值 / 块 · 可容纳 ≈ ${fmtNum(values)} 个值<br>
          同一批数据占用：${fmtBytes(values * bpv)}（186 GB 口径）<br>
          精度切换后逻辑分区与占用同步变化，物理层尺寸不变。
        </div>`;
    }

    // 接缝状态
    if (this.seamState) {
      const gap = store.dieSeamGap || 0;
      this.seamState.textContent = gap > 0.35
        ? `接缝已断开（${Math.round(gap * 100)}%）：跨缝脉冲停在断口，片间 10 TB/s 链路中断。`
        : `接缝距离 ${Math.round(gap * 100)}%：跨缝传输正常，NV-HBI 10 TB/s。`;
    }

    // 展开读数跟随滚动拆解
    {
      const val = document.getElementById('val-explode');
      const rng = document.getElementById('rng-explode');
      const eff = store._effExplode;
      if (val && eff != null && window.__scene && window.__scene._userExplode == null) {
        val.textContent = Math.round(eff * 100) + '%';
        if (rng && document.activeElement !== rng) {
          rng.value = Math.round(eff * 100);
          rng.style.setProperty('--fill', (eff * 100) + '%');
        }
      }
    }

    // 04 读数
    const b4 = document.getElementById('b4-prec');
    if (b4) b4.textContent = store.precision;

    // 05 标签
    const b5 = document.getElementById('b5-fmt-tag');
    if (b5) b5.textContent = store.precision + (store.precision === 'FP4' ? ' · NVFP4' : '');

    // 08 读数
    const b8f = document.getElementById('b8-fmt');
    if (b8f) b8f.textContent = '精度 ' + store.precision;
    const b8o = document.getElementById('b8-ops');
    if (b8o) {
      const wl = workload();
      b8o.textContent = `工作量 ${fmtNum(wl.elements)} 值 · ${wl.gpusNeeded} GPU`;
    }

    // 观察窗
    if (this.loupeCanvas && this.loupeWrap) {
      const visible = this.loupeWrap.getBoundingClientRect().width > 0;
      if (visible) this.drawLoupe(time);
    }

    // 规格表选中
    if (this.specWrap) {
      this.specWrap.querySelectorAll('tr[data-prod]').forEach((tr) => {
        const id = tr.getAttribute('data-prod') === 'HGX B200' ? 'HGX'
          : tr.getAttribute('data-prod') === 'DGX B200' ? 'DGX'
          : tr.getAttribute('data-prod') === 'GB200 NVL72' ? 'NVL72'
          : tr.getAttribute('data-prod') === 'GB200' ? 'GB200' : 'B200';
        tr.classList.toggle('hot', store.selectedProduct === id);
      });
    }
  }
}
