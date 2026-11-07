/* ==========================================================================
   B200 / DIE STUDY — interface, SVG graphics and state
   ========================================================================== */
(function () {
  'use strict';
  const B = window.B200;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = B.clamp, lerp = B.lerp, smooth = B.smooth, ramp = B.ramp;
  const STORE_KEY = 'b200-die-study-state-v2';

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function sEl(tag, attrs, content) {
    const n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    if (content != null) n.textContent = content;
    return n;
  }
  function clone2(a) { return a.map(r => r.slice()); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function nf(v, d) { return Number(v).toFixed(d == null ? 3 : d); }
  function short(v, d) {
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(d == null ? 1 : d) + ' B';
    if (a >= 1e6) return (v / 1e6).toFixed(d == null ? 1 : d) + ' M';
    if (a >= 1e3) return (v / 1e3).toFixed(d == null ? 1 : d) + ' K';
    return nf(v, d == null ? 2 : d);
  }
  function saveState(s) {
    try {
      const keep = {};
      ['precision', 'selectedPart', 'selectedDie', 'selectedStack', 'cut', 'seam',
        'activeRegions', 'selectedRegion', 'sparse', 'probe', 'stackOpen', 'lensOn',
        'lensX', 'loadParams', 'selectedProduct', 'selectedMetric', 'workload', 'tech',
        'running', 'matrixA', 'matrixB'].forEach(k => { keep[k] = s[k]; });
      localStorage.setItem(STORE_KEY, JSON.stringify(keep));
    } catch (e) { /* file:// storage may be unavailable */ }
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : null;
    } catch (e) { return null; }
  }

  B.defaultState = function () {
    return {
      precision: 'fp4',
      selectedPart: 'overview',
      detail: null,
      selectedDie: 0,
      selectedStack: 0,
      cut: 45,
      seam: 0,
      activeRegions: { compute: true, cache: true, hbmphy: true, d2d: true, nvlink: true, sec: true },
      selectedRegion: 'compute',
      matrixA: clone2(B.MATRIX_A),
      matrixB: clone2(B.MATRIX_B),
      sparse: false,
      probe: 1.37,
      trace: { mat: 'C', r: 0, c: 0 },
      stackOpen: true,
      lensOn: true,
      lensX: .5,
      loadParams: 480,
      selectedGpu: null,
      selectedTray: null,
      selectedLink: null,
      selectedProduct: 'b200',
      selectedMetric: 'compute',
      workload: 'training',
      tech: 0,
      running: true,
      opsTotal: 0,
      commPhase: 1,
      shardPhase: 0,
      commReplayStart: null,
      shardRunStart: null,
      batchStart: null
    };
  };

  const TECHS = [
    { key: 'transformer', n: 'Transformer Engine', v: 'FP4 · 动态缩放', anchor: 'transformer',
      d: '面向注意力的矩阵引擎，随格式调整缩放与累加路径；本页的矩阵实验就是它的最小示意。' },
    { key: 'd2d', n: '片间互连', v: '10 TB/s', anchor: 'd2d-tech',
      d: '两颗晶粒之间的高带宽链路，把分割的硅片连成一颗逻辑 GPU。' },
    { key: 'decompress', n: '解压缩引擎', v: '数据库 / 分析', anchor: 'decompress',
      d: '独立的数据解压缩单元，让压缩数据在进入计算前被并行展开。' },
    { key: 'hbm', n: 'HBM3e', v: '192 GB · 8 TB/s', anchor: 'hbm-tech',
      d: '八堆 HBM3e 围绕晶粒放置，容量与带宽一起决定一颗 GPU 能容纳的工作集。' },
    { key: 'nvlink', n: 'NVLink 5', v: '1.8 TB/s / GPU', anchor: 'nvlink-tech',
      d: '面向系统内其他 GPU 的横向扩展接口；八卡基板合计 14.4 TB/s。' },
    { key: 'ras', n: 'RAS 与机密计算', v: '可靠性 · 隔离', anchor: 'ras-tech',
      d: '遥测、可靠性引擎与机密计算能力，在大规模部署中保护数据与可用性。' },
    { key: 'power', n: '功耗', v: '≤ 1,000 W', anchor: 'power-tech',
      d: '电压调节与去耦网络把电流送到晶粒与 HBM；整卡热设计功耗最高 1,000 W。' }
  ];
  B.TECHS = TECHS;

  B.UI = class UI {
    constructor(world, opts) {
      this.world = world;
      this.opts = opts || {};
      this.s = Object.assign(B.defaultState(), loadState() || {});
      // recover from malformed persisted matrices
      if (!Array.isArray(this.s.matrixA) || this.s.matrixA.length !== 4) this.s.matrixA = clone2(B.MATRIX_A);
      if (!Array.isArray(this.s.matrixB) || this.s.matrixB.length !== 4) this.s.matrixB = clone2(B.MATRIX_B);
      this.s.matrixA = this.s.matrixA.map(r => r.map(v => isNum(+v) ? +v : 0));
      this.s.matrixB = this.s.matrixB.map(r => r.map(v => isNum(+v) ? +v : 0));
      if (!this.s.trace || ['A', 'B', 'C'].indexOf(this.s.trace.mat) < 0) this.s.trace = { mat: 'C', r: 0, c: 0 };
      this.time = 0;
      this.lastNav = -1;
      this.labels = [];
      this.dirty = { bit: true, matrix: true, shard: true };
      this._lastLabelCheck = -1;
      this._occlusion = {};
      this._initNav();
      this._initPrecision();
      this._initFormats();
      this._initParts();
      this._initRegions();
      this._initMemory();
      this._initMatrix();
      this._initProducts();
      this._initTech();
      this._initWorkloads();
      this._initLabels();
      this._initDialogs();
      this._initMisc();
      this.compute();
      this.renderEverything();
      this._bindGlobal();
    }

    /* ------------------------------------------------------------------ */
    /* construction                                                       */
    /* ------------------------------------------------------------------ */
    _initNav() {
      const nav = $('#nav-list');
      nav.innerHTML = '';
      B.CHAPTERS.forEach((c, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.className = 'nav-item';
        b.type = 'button';
        b.setAttribute('aria-label', c.num + ' ' + c.cn + ' · ' + c.en);
        b.innerHTML = `<span class="n">${c.num}</span><span class="cn">${c.cn}</span><span class="en">${c.en}</span>`;
        b.addEventListener('click', () => this.navigate(i));
        li.appendChild(b);
        nav.appendChild(li);
      });
      const brand = $('#brand-home');
      if (brand) brand.addEventListener('click', () => this.navigate(0));
      // bottom chapter strip
      const fc = $('#fin-chapters');
      if (fc) {
        fc.innerHTML = B.CHAPTERS.map((c, i) => `<span data-i="${i}"><b>${c.num}</b>${c.cn}</span>`).join('');
        fc.addEventListener('click', e => {
          const t = e.target.closest('span[data-i]');
          if (t) this.navigate(+t.dataset.i);
        });
      }
    }

    _initPrecision() {
      const dock = $('#precision-dock');
      dock.innerHTML = '';
      B.FORMAT_ORDER.forEach(k => {
        const f = B.FORMATS[k];
        const b = document.createElement('button');
        b.className = 'pd-btn';
        b.type = 'button';
        b.dataset.fmt = k;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', 'false');
        b.textContent = f.label;
        b.title = f.label + ' · ' + f.sub + ' · ' + f.bytes + ' B/value';
        b.addEventListener('click', () => this.setPrecision(k, true));
        dock.appendChild(b);
      });
    }

    _formatRibbon(f) {
      const total = f.bits;
      const fields = [['s', f.sign, 'var(--lime)'], ['e', f.exp, 'var(--cyan)'], ['m', f.mant, 'var(--copper)']];
      if (f.key === 'tf32') fields.push(['p', 13, '#3c484c']);
      return fields.map(([n, w, c]) => `<i style="width:${w / total * 100}%;background:${c}"></i>`).join('');
    }

    _initFormats() {
      const rail = $('#format-rail');
      rail.innerHTML = '';
      B.FORMAT_ORDER.forEach(k => {
        const f = B.FORMATS[k];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fmt-card';
        b.dataset.fmt = k;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', 'false');
        b.innerHTML = `
          <div class="fc-top"><b>${f.label}</b><span class="fc-sub">${f.sub}</span></div>
          <div class="fc-bits">${this._formatRibbon(f)}</div>
          <div class="fc-meta"><span>S${f.sign} E${f.exp} M${f.mant}</span><span>${f.bytes < 1 ? '0.5' : f.bytes} B</span></div>`;
        b.addEventListener('click', () => this.setPrecision(k, true));
        rail.appendChild(b);
      });
    }

    _initParts() {
      const list = $('#part-list');
      const order = ['overview', 'die', 'hbm', 'interposer', 'substrate', 'balls'];
      list.innerHTML = '';
      order.forEach((key, i) => {
        const p = B.PARTS[key];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'part-item';
        b.dataset.part = key;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', 'false');
        b.innerHTML = `<span class="pi">${String(i).padStart(2, '0')}</span><span class="pn">${p.name}</span><span class="pe">${p.en.split(' / ')[0]}</span>`;
        b.addEventListener('click', () => this.selectPart(key));
        list.appendChild(b);
      });
      // format-dependent DRAM grouping card
      const info = $('.anatomy-info');
      const group = el('div', 'data-group');
      group.innerHTML = `<div class="mini-head"><span>数据分组 / FORMAT</span><i></i></div>
        <div class="dg-row"><span>逻辑分区</span><b id="ch2-group">—</b></div>
        <div class="dg-row"><span>容量折算</span><b id="ch2-occupancy">—</b></div>
        <p class="micro" id="ch2-group-note"></p>`;
      info.appendChild(group);
      const open = $('#detail-open');
      open.addEventListener('click', () => this.openDetail());
      $('#detail-close').addEventListener('click', () => this.closeDetail());
      // controls
      const cut = $('#cut-range');
      cut.addEventListener('input', () => {
        this.s.cut = +cut.value;
        $('#cut-out').textContent = this.s.cut + '%';
        $('#xsec-note').textContent = 'CUT ' + this.s.cut + '%';
        saveState(this.s);
      });
      const seam = $('#seam-range');
      seam.addEventListener('input', () => {
        this.s.seam = +seam.value / 100;
        this._syncSeam();
        saveState(this.s);
      });
      $('#zoom-in').addEventListener('click', () => this.zoom(1.18));
      $('#zoom-out').addEventListener('click', () => this.zoom(1 / 1.18));
      $('#orbit-reset').addEventListener('click', () => this.resetOrbit());
      this._syncSeam();
    }

    _initRegions() {
      const wrap = $('#region-btns');
      wrap.innerHTML = '';
      B.REGION_ORDER.forEach(k => {
        const r = B.DIE_REGIONS[k];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'region-btn on';
        b.dataset.region = k;
        b.setAttribute('aria-pressed', 'true');
        b.innerHTML = `<i style="background:${r.color}"></i>${r.name}`;
        b.addEventListener('click', () => this.toggleRegion(k));
        wrap.appendChild(b);
      });
      const legend = $('#map-legend');
      legend.innerHTML = B.REGION_ORDER.map(k =>
        `<span><i style="background:${B.DIE_REGIONS[k].color}"></i>${B.DIE_REGIONS[k].name}</span>`).join('');
      $('#comm-replay').addEventListener('click', () => {
        this.s.commReplayStart = this.time;
        this.toast('重放片间通信');
        $('#comm-replay').classList.add('pulse');
        setTimeout(() => $('#comm-replay').classList.remove('pulse'), 800);
      });
      $('#seam-toggle-btn').addEventListener('click', () => {
        this.s.seam = (this.s.seam > .30) ? 0 : .62;
        this._syncSeam();
        saveState(this.s);
      });
      // clickable die map is bound on every render via delegation
      $('#die-map').addEventListener('click', e => {
        const g = e.target.closest('[data-region]');
        if (g) this.toggleRegion(g.dataset.region);
      });
      $('#die-map').addEventListener('keydown', e => {
        const g = e.target.closest('[data-region]');
        if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.toggleRegion(g.dataset.region); }
      });
    }

    _initMemory() {
      const sp = $('#stack-picker');
      sp.innerHTML = '';
      for (let i = 0; i < 8; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stack-btn' + (i === this.s.selectedStack ? ' on' : '');
        b.textContent = String(i + 1).padStart(2, '0');
        b.setAttribute('aria-label', '选择 HBM 堆栈 ' + (i + 1));
        b.addEventListener('click', () => {
          this.s.selectedStack = i;
          $$('.stack-btn').forEach((x, j) => x.classList.toggle('on', j === i));
          saveState(this.s);
          this.dirty.bit = true;
        });
        sp.appendChild(b);
      }
      $('#stack-expand').addEventListener('click', () => {
        this.s.stackOpen = !this.s.stackOpen;
        $('#stack-expand').innerHTML = this.s.stackOpen ? '收拢全部堆栈 <span>↕</span>' : '展开全部堆栈 <span>↕</span>';
        saveState(this.s);
      });
      $('#lens-toggle').addEventListener('click', () => {
        this.s.lensOn = !this.s.lensOn;
        this._syncLens();
        saveState(this.s);
      });
      // lens pointer control over the strip / stage
      const setLens = (clientX) => {
        const r = $('#viewport').getBoundingClientRect();
        this.s.lensX = clamp((clientX - r.left) / r.width, .16, .84);
        this._syncLens();
      };
      $('#lens-map').addEventListener('pointerdown', e => {
        this._lensDrag = true; setLens(e.clientX);
      });
      window.addEventListener('pointermove', e => {
        if (this._lensDrag) setLens(e.clientX);
        else if (this._inMemory() && this.s.lensOn && e.target && e.target.id === 'gl') setLens(e.clientX);
      });
      window.addEventListener('pointerup', () => { this._lensDrag = false; });
      $('#batch-play').addEventListener('click', () => {
        this.s.batchStart = this.time;
        this.toast('重放一批数据：DRAM → TSV → 中介层 → HBM PHY → 计算');
      });
    }

    _initMatrix() {
      const build = (target, mat, editable, letter) => {
        target.innerHTML = '';
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            const cell = el('div', 'mcell');
            cell.dataset.mat = letter;
            cell.dataset.r = r; cell.dataset.c = c;
            if (editable) {
              const input = document.createElement('input');
              input.type = 'number';
              input.step = '.01';
              input.value = mat[r][c];
              input.setAttribute('aria-label', `${letter} 矩阵第 ${r + 1} 行第 ${c + 1} 列`);
              input.addEventListener('input', () => {
                let v = parseFloat(input.value);
                if (!isFinite(v)) return;
                v = clamp(v, -9.99, 9.99);
                this.s[letter === 'A' ? 'matrixA' : 'matrixB'][r][c] = v;
                this.compute();
                this.renderMatrix();
                saveState(this.s);
              });
              input.addEventListener('blur', () => {
                let v = parseFloat(input.value);
                if (!isFinite(v)) v = 0;
                v = clamp(v, -9.99, 9.99);
                input.value = nf(v, 2);
                this.s[letter === 'A' ? 'matrixA' : 'matrixB'][r][c] = v;
                this.compute(); this.renderMatrix(); saveState(this.s);
              });
              cell.appendChild(input);
              const qv = document.createElement('span');
              qv.className = 'qval';
              qv.title = '量化后的值';
              cell.appendChild(qv);
            } else {
              cell.innerHTML = '<span class="res-v">0</span><span class="cell-dot"></span>';
            }
            cell.addEventListener('click', () => {
              this.s.trace = { mat: letter, r: r, c: c };
              this.renderTrace();
              this.renderMatrix();
            });
            target.appendChild(cell);
          }
        }
      };
      build($('#mat-a'), this.s.matrixA, true, 'A');
      build($('#mat-b'), this.s.matrixB, true, 'B');
      build($('#mat-c'), B.quant.multiply(this.s.matrixA, this.s.matrixB), false, 'C');
      $$('#matrix-lab .seg button').forEach(b => {
        b.addEventListener('click', () => {
          this.s.sparse = b.dataset.sparse === '1';
          $$('#matrix-lab .seg button').forEach(x => {
            x.classList.toggle('on', x === b);
            x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
          });
          this.compute(); this.renderMatrix(); this.renderTrace(); this.renderFormatDependent(); saveState(this.s);
        });
      });
      $('#matrix-reset').addEventListener('click', () => {
        this.s.matrixA = clone2(B.MATRIX_A); this.s.matrixB = clone2(B.MATRIX_B);
        this.s.sparse = false; this.s.trace = null;
        $$('#mat-a input, #mat-b input').forEach(() => {});
        this._fillMatrixInputs();
        $$('#matrix-lab .seg button').forEach(x => {
          x.classList.toggle('on', x.dataset.sparse === '0');
          x.setAttribute('aria-pressed', x.dataset.sparse === '0' ? 'true' : 'false');
        });
        this.compute(); this.renderMatrix(); this.renderTrace(); this.renderFormatDependent(); saveState(this.s);
      });
      const probe = $('#probe-range');
      probe.addEventListener('input', () => {
        this.s.probe = +probe.value;
        this.dirty.bit = true;
        this.renderBitStrip(); this.renderNumberLine();
        saveState(this.s);
      });
      const run = $('#run-toggle');
      run.addEventListener('click', () => {
        this.s.running = !this.s.running;
        run.setAttribute('aria-pressed', this.s.running ? 'true' : 'false');
        this.opts.onRunToggle && this.opts.onRunToggle(this.s.running);
      });
    }

    _fillMatrixInputs() {
      $$('#mat-a input').forEach(inp => {
        const r = +inp.closest('.mcell').dataset.r, c = +inp.closest('.mcell').dataset.c;
        inp.value = nf(this.s.matrixA[r][c], 2);
      });
      $$('#mat-b input').forEach(inp => {
        const r = +inp.closest('.mcell').dataset.r, c = +inp.closest('.mcell').dataset.c;
        inp.value = nf(this.s.matrixB[r][c], 2);
      });
    }

    _initProducts() {
      const row = $('#product-row');
      row.innerHTML = '';
      const draw = {
        b200: `<svg viewBox="0 0 180 74" aria-hidden="true">
          <rect x="24" y="17" width="132" height="44" rx="3" class="p-base"/>
          <rect x="36" y="23" width="50" height="32" rx="1" class="p-die"/>
          <rect x="94" y="23" width="50" height="32" rx="1" class="p-die"/>
          <g class="p-mem">${[0,1,2,3].map(i=>`<rect x="${39+i*14}" y="13" width="10" height="7"/>`).join('')}${[0,1,2,3].map(i=>`<rect x="${39+i*14}" y="58" width="10" height="7"/>`).join('')}</g>
          <path d="M86 39h8" class="p-link"/>
          <g class="p-pins">${Array.from({length:12},(_,i)=>`<path d="M${34+i*10} 67v5"/>`).join('')}</g>
        </svg>`,
        hgx: `<svg viewBox="0 0 180 74" aria-hidden="true">
          <rect x="8" y="10" width="164" height="54" rx="2" class="p-base"/>
          <g class="p-compute">${[0,1,2,3].map(i=>`<rect x="${17+i*40}" y="17" width="30" height="16" rx="1"/>`).join('')}${[0,1,2,3].map(i=>`<rect x="${17+i*40}" y="41" width="30" height="16" rx="1"/>`).join('')}</g>
          <g class="p-switch"><rect x="76" y="34" width="12" height="10" rx="1"/><rect x="92" y="34" width="12" height="10" rx="1"/></g>
          <path d="M60 29h55M60 50h55M120 29h17M120 50h17" class="p-link"/>
        </svg>`,
        dgx: `<svg viewBox="0 0 180 74" aria-hidden="true">
          <rect x="12" y="16" width="156" height="44" rx="3" class="p-base"/>
          <g class="p-fans">${[0,1,2,3,4,5,6].map(i=>`<circle cx="${26+i*21}" cy="38" r="7"/>`).join('')}</g>
          <g class="p-compute">${[0,1].map(i=>`<rect x="${126+i*15}" y="27" width="10" height="9" rx="1"/>`).join('')}${[0,1].map(i=>`<rect x="${126+i*15}" y="42" width="10" height="9" rx="1"/>`).join('')}</g>
          <path d="M20 60h140" class="p-power"/>
        </svg>`,
        gb200: `<svg viewBox="0 0 180 74" aria-hidden="true">
          <rect x="15" y="16" width="150" height="44" rx="3" class="p-base"/>
          <rect x="26" y="27" width="46" height="22" rx="1" class="p-cpu"/>
          <g class="p-compute"><rect x="84" y="21" width="32" height="34" rx="1"/><rect x="122" y="21" width="32" height="34" rx="1"/></g>
          <path d="M72 38h12" class="p-link"/>
          <text x="49" y="55" class="p-txt">GRACE</text><text x="120" y="63" class="p-txt">2 × B200</text>
        </svg>`,
        nvl72: `<svg viewBox="0 0 180 74" aria-hidden="true">
          <rect x="55" y="5" width="70" height="64" rx="2" class="p-base"/>
          <g class="p-compute">${Array.from({length:12},(_,i)=>`<rect x="${64+(i%3)*20}" y="${12+Math.floor(i/3)*12}" width="15" height="5"/>`).join('')}</g>
          <g class="p-switch">${Array.from({length:6},(_,i)=>`<rect x="${64+(i%3)*20}" y="${55+Math.floor(i/3)*6}" width="15" height="3"/>`).join('')}</g>
          <path d="M46 8v58M134 8v58" class="p-link"/>
          <text x="64" y="4" class="p-txt">18 COMPUTE · 9 SWITCH</text>
        </svg>`
      };
      B.PRODUCTS.forEach(p => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'product-card' + (p.key === this.s.selectedProduct ? ' sel' : '');
        b.dataset.product = p.key;
        b.innerHTML = `${draw[p.key]}<div class="pc-name"><b>${p.name}</b><span>${p.form}</span></div><div class="pc-comp">${p.compos.replace(/ · /g, ' · ')}</div>`;
        b.addEventListener('click', () => {
          this.s.selectedProduct = p.key;
          $$('.product-card').forEach(x => x.classList.toggle('sel', x.dataset.product === p.key));
          this.renderSpecTable(); this.renderSpecBars();
          saveState(this.s);
        });
        row.appendChild(b);
      });
      $('#metric-tabs').addEventListener('click', e => {
        const b = e.target.closest('button[data-metric]');
        if (!b) return;
        this.s.selectedMetric = b.dataset.metric;
        $$('#metric-tabs button').forEach(x => {
          const on = x.dataset.metric === this.s.selectedMetric;
          x.classList.toggle('on', on);
          x.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        this.renderSpecTable(); this.renderSpecBars();
        this.applyMetricHighlight();
        saveState(this.s);
      });
      this.renderSpecTable();
      this.renderSpecBars();
      this.applyMetricHighlight();
      // carry the five product figures into the closing chapter
      const strip = document.getElementById('fin-lineup');
      if (strip) {
        strip.innerHTML = '';
        B.PRODUCTS.forEach(p => {
          const card = document.querySelector(`.product-card[data-product="${p.key}"]`);
          const svg = card && card.querySelector('svg');
          if (!svg) return;
          const item = document.createElement('div');
          item.className = 'fin-product product-card';
          item.appendChild(svg.cloneNode(true));
          const cap = document.createElement('span');
          cap.textContent = p.name;
          item.appendChild(cap);
          strip.appendChild(item);
        });
      }
      // five vector forms lift out of the system view as chapter 07 begins
      const lh = document.getElementById('lineup-handoff');
      if (lh) {
        lh.innerHTML = '';
        const cap0 = document.createElement('div');
        cap0.className = 'lh-caption';
        cap0.textContent = 'SAME SILICON · 3D → SVG';
        lh.appendChild(cap0);
        B.PRODUCTS.forEach(p => {
          const card = document.querySelector(`.product-card[data-product="${p.key}"]`);
          const svg = card && card.querySelector('svg');
          if (!svg) return;
          const item = document.createElement('div');
          item.className = 'lh-item';
          item.dataset.product = p.key;
          item.appendChild(svg.cloneNode(true));
          const cap = document.createElement('span');
          cap.textContent = p.name;
          item.appendChild(cap);
          lh.appendChild(item);
        });
        this._lhItems = $$('#lineup-handoff .lh-item');
      }
    }

    _initTech() {
      const list = $('#tech-list');
      list.innerHTML = '';
      TECHS.forEach((t, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tech-item' + (i === this.s.tech ? ' on' : '');
        b.dataset.tech = i;
        b.innerHTML = `<span class="ti">${String(i + 1).padStart(2, '0')}</span><span class="tn">${t.n}</span><span class="tv">${t.v}</span>`;
        b.addEventListener('click', () => {
          this.s.tech = i;
          $$('.tech-item').forEach((x, j) => x.classList.toggle('on', j === i));
          this.renderTechDetail();
          this.renderLabelsForChapter(8, this._lastView);
        });
        list.appendChild(b);
      });
      const detail = el('div', 'tech-detail');
      detail.id = 'tech-detail';
      list.appendChild(detail);
      this.renderTechDetail();
    }

    _initWorkloads() {
      $$('#workload-tabs button').forEach(b => {
        b.addEventListener('click', () => {
          this.s.workload = b.dataset.workload;
          $$('#workload-tabs button').forEach(x => {
            const on = x.dataset.workload === this.s.workload;
            x.classList.toggle('on', on);
            x.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          this.renderWorkload();
          saveState(this.s);
        });
      });
      const ws = $('#workload-stream');
      ws.innerHTML = Array.from({ length: 48 }, () => '<i></i>').join('');
      this.renderWorkload();
    }

    _initLabels() {
      const defs = [
        // 01
        { ch: 1, keys: 'dieL', title: '计算晶粒 ×2', sub: '2080 亿晶体管', off: [-170, -72], cls: '' },
        { ch: 1, keys: 'hbmR', title: 'HBM3e ×8', sub: '192 GB / 8 TB/s', off: [150, -40], cls: '' },
        { ch: 1, keys: 'substrate', title: '有机基板', sub: '多层铜布线', off: [-170, 54], cls: '' },
        { ch: 1, keys: 'seam', title: '10 TB/s D2D', sub: 'TWO DIES · ONE GPU', off: [110, 74], cls: '' },
        // 02
        { ch: 2, keys: 'dieL', title: '计算晶粒', sub: 'COMPUTE DIE', off: [-180, -80], part: 'die' },
        { ch: 2, keys: 'hbmL', title: 'HBM3e 堆栈', sub: '1 BASE + 8 DRAM', off: [135, -66], part: 'hbm' },
        { ch: 2, keys: 'interposer', title: '硅中介层', sub: '2.5D INTERPOSER', off: [145, 35], part: 'interposer' },
        { ch: 2, keys: 'substrate', title: '基板与焊球', sub: 'BGA / LAYERS', off: [-155, 72], part: 'substrate' },
        // 03
        { ch: 3, keys: 'dieL', title: 'DIE A', sub: 'COMPUTE CLUSTERS', off: [-155, -58] },
        { ch: 3, keys: 'dieR', title: 'DIE B', sub: 'SHARED TOPOLOGY', off: [130, -48] },
        { ch: 3, keys: 'seam', title: '片间接缝', sub: '10 TB/s', off: [0, -105] },
        // 06 — GB200 superchip
        { ch: 6, keys: 'gb-gpu0', title: 'B200 ×2', sub: 'TWO BLACKWELL GPUs', off: [-150, -65], stage: 2 },
        { ch: 6, keys: 'gb-cpu', title: 'Grace CPU', sub: 'NVLink-C2C · 900 GB/s', off: [-148, 82], stage: 2 },
        // 08
        { ch: 8, keys: 'transformer', title: 'Transformer Engine', sub: 'FP4 · 动态缩放', off: [-190, -92], tech: 0 },
        { ch: 8, keys: 'd2d-tech', title: '片间互连', sub: '10 TB/s', off: [15, -130], tech: 1 },
        { ch: 8, keys: 'decompress', title: '解压缩引擎', sub: 'DATA ANALYTICS', off: [145, -75], tech: 2 },
        { ch: 8, keys: 'hbm-tech', title: 'HBM3e', sub: '192 GB / 8 TB/s', off: [155, -15], tech: 3 },
        { ch: 8, keys: 'nvlink-tech', title: 'NVLink 5', sub: '1.8 TB/s / GPU', off: [165, 65], tech: 4 },
        { ch: 8, keys: 'ras-tech', title: 'RAS / 机密计算', sub: 'SECURE AI', off: [35, 120], tech: 5 },
        { ch: 8, keys: 'power-tech', title: '功耗', sub: '≤ 1,000 W', off: [145, 135], tech: 6 }
      ];
      const layer = $('#labels');
      const svg = $('#leaders');
      layer.innerHTML = '';
      svg.innerHTML = '';
      defs.forEach((d, i) => {
        const node = el('div', 'lbl3d');
        node.innerHTML = `<b>${d.title}</b><small>${d.sub}</small>`;
        node.dataset.i = i;
        layer.appendChild(node);
        const path = sEl('path', { class: 'leader-line', d: '' });
        const dot = sEl('circle', { class: 'leader-dot', r: 2.2, cx: 0, cy: 0 });
        const elbow = sEl('path', { class: 'leader-elbow', d: '' });
        svg.appendChild(elbow); svg.appendChild(path); svg.appendChild(dot);
        this.labels.push({ def: d, node: node, path: path, dot: dot, elbow: elbow, occluded: false });
      });
      // Plan-view overlay used while the camera dives from chapter 02 into 03.
      const plan = document.createElementNS(NS, 'g');
      plan.setAttribute('class', 'plan-overlay');
      plan.innerHTML = `
        <polygon class="plan-poly" />
        <polygon class="plan-poly" />
        <line class="plan-seam" />
        <line class="plan-seam short" />
        <text class="plan-label" data-i="0">DIE A · PLAN</text>
        <text class="plan-label" data-i="1">DIE B · PLAN</text>
        <text class="plan-note">3D → 2D · ALIGNED</text>`;
      svg.appendChild(plan);
      this._planOverlay = plan;
      this._planPolys = plan.querySelectorAll('.plan-poly');
      this._planSeam = plan.querySelectorAll('.plan-seam');
      this._planLabels = plan.querySelectorAll('.plan-label');
      this._planNote = plan.querySelector('.plan-note');
    }

    _initDialogs() {
      const about = $('#about-dialog');
      const help = $('#help-dialog');
      const open = () => { this._closeAllDialogs(); if (about.showModal) about.showModal(); };
      const openHelp = () => { this._closeAllDialogs(); if (help.showModal) help.showModal(); };
      $('#about-open').addEventListener('click', open);
      $('#about-open-2').addEventListener('click', open);
      $('#about-close').addEventListener('click', () => about.close());
      $('#help-open').addEventListener('click', openHelp);
      $('#help-close').addEventListener('click', () => help.close());
      [about, help].forEach(d => d.addEventListener('click', e => {
        if (e.target === d) d.close();
      }));
      const sources = $('#source-list');
      if (sources) sources.innerHTML = B.SOURCES.map(s =>
        `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`).join('');
    }

    _initMisc() {
      this._syncLens();
      this._syncSeam();
      $('#stack-expand').innerHTML = this.s.stackOpen ? '收拢全部堆栈 <span>↕</span>' : '展开全部堆栈 <span>↕</span>';
      // cursor ring
      const dot = $('#cursor-dot'), ring = $('#cursor-ring');
      window.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px';
        ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
        dot.style.opacity = '.85'; ring.style.opacity = '.65';
        const hot = e.target && (e.target.closest('button, input, select, a, [tabindex="0"]'));
        ring.classList.toggle('hot', !!hot || e.target.id === 'gl');
      }, { passive: true });
      document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
      // stage tabs
      $('#platform-tabs').addEventListener('click', e => {
        const b = e.target.closest('button[data-stage]');
        if (!b) return;
        const i = +b.dataset.stage;
        this.opts.onPlatformStage && this.opts.onPlatformStage(i);
      });
      // load presets
      $('#load-presets').addEventListener('click', e => {
        const b = e.target.closest('button[data-load]');
        if (!b) return;
        this.s.loadParams = +b.dataset.load;
        $$('#load-presets button').forEach(x => {
          const on = x === b;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        this.renderShardStatic(); this.renderShard();
        saveState(this.s);
      });
      $('#shard-run').addEventListener('click', () => {
        this.s.shardRunStart = this.time;
        this.s.shardPhase = 0;
        $('#shard-run').classList.add('pulse');
        setTimeout(() => $('#shard-run').classList.remove('pulse'), 700);
        this.toast('八卡分片运算开始');
      });
      $('#shard-replay').addEventListener('click', () => {
        this.s.shardRunStart = this.time;
        this.toast('重放全归约');
      });
      $('#topo-reset').addEventListener('click', () => {
        this.s.selectedGpu = null; this.s.selectedTray = null; this.s.selectedLink = null;
        this.renderTopology();
      });
      // info label vertical? clicking 3D handled by main
      this.showKeyHint();
    }

    showKeyHint() {
      const hint = $('#key-hint');
      hint.classList.add('show');
      setTimeout(() => hint.classList.remove('show'), 9000);
    }

    _closeAllDialogs() {
      $$('dialog[open]').forEach(d => d.close());
    }

    /* ------------------------------------------------------------------ */
    /* user actions                                                        */
    /* ------------------------------------------------------------------ */
    navigate(i) {
      const c = B.CHAPTERS[clamp(i, 0, 7)];
      const target = c.start + Math.min(c.span * .12, .018);
      this.opts.onNavigate && this.opts.onNavigate(target, i);
      this.s.detail = null;
      this.closeDetailPanel();
    }
    setPrecision(key, fromUser) {
      if (!B.FORMATS[key]) return;
      this.s.precision = key;
      saveState(this.s);
      this.compute();
      this.renderEverything();
      this.toast('全页精度 → ' + B.FORMATS[key].label + (key === 'fp4' ? ' · E2M1 + 共享缩放' : ''));
      if (fromUser) this.opts.onPrecision && this.opts.onPrecision(key);
    }
    selectPart(key) {
      this.s.selectedPart = key;
      if (key === 'hbm') this.s.selectedDie = this.s.selectedDie;
      $$('.part-item').forEach(b => {
        const on = b.dataset.part === key;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      this.renderPartInfo();
      const open = $('#detail-open');
      open.style.visibility = (key === 'die' || key === 'hbm' || key === 'interposer' || key === 'substrate') ? 'visible' : 'hidden';
      this.renderLabelsForChapter(2, this._lastView);
    }
    openDetail() {
      const p = this.s.selectedPart;
      if (p === 'die') this.s.detail = 'die';
      else if (p === 'hbm') this.s.detail = 'hbm';
      else if (p === 'interposer' || p === 'substrate') this.s.detail = 'sub';
      else this.s.detail = 'hbm';
      this.renderDetail();
      $('#detail-panel').hidden = false;
      $('.ch02').classList.add('detail-open');
      this.s.selectedPart = this.s.detail === 'sub' ? (p === 'substrate' ? 'substrate' : 'interposer') : (this.s.detail === 'die' ? 'die' : 'hbm');
    }
    closeDetail() {
      this.s.detail = null;
      $('#detail-panel').hidden = true;
      $('.ch02').classList.remove('detail-open');
    }
    closeDetailPanel() {
      if (this.s.detail) { this.s.detail = null; $('#detail-panel').hidden = true; $('.ch02').classList.remove('detail-open'); }
    }
    toggleRegion(k) {
      if (!this.s.activeRegions[k] && k === 'd2d' && this.s.seam > .3) {
        this.toast('片间链路断开：先恢复接缝');
        return;
      }
      this.s.activeRegions[k] = !this.s.activeRegions[k];
      this.s.selectedRegion = k;
      $$('.region-btn').forEach(b => {
        const on = !!this.s.activeRegions[b.dataset.region];
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      this.renderDieMap();
      saveState(this.s);
    }
    zoom(f) {
      const o = this.opts.getOrbit ? this.opts.getOrbit() : { zoom: 1 };
      o.zoom = clamp((o.zoom || 1) * f, .62, 1.9);
      this.opts.setOrbit && this.opts.setOrbit(o);
    }
    resetOrbit() {
      this.opts.resetOrbit && this.opts.resetOrbit();
      this.toast('观看角度已复位');
    }
    _syncSeam() {
      const seam = $('#seam-range');
      seam.value = Math.round(this.s.seam * 100);
      $('#seam-out').textContent = (this.s.seam * .8).toFixed(1) + ' mm';
      const broken = this.s.seam > .30;
      $('#seam-state').classList.toggle('down', broken);
      $('#seam-label').textContent = broken ? '接缝断开 · 链路停止' : '接缝连接正常';
      $('#seam-sub').textContent = broken ? '跨缝数据在断开处停止' : '10 TB/s 片间链路 · 脉冲可通过';
      $('#seam-num').textContent = broken ? '0.0 TB/s' : '10.0 TB/s';
      const toggle = $('#seam-toggle-btn');
      toggle.setAttribute('aria-pressed', broken ? 'true' : 'false');
      $('#t-state').textContent = broken ? 'DOWN' : 'UP';
      $('#t-state2').textContent = broken ? 'DISCONNECTED' : 'LINKED';
      $('#t-state').classList.toggle('down', broken);
      const d2d = $('#t-d2d');
      if (d2d) d2d.textContent = broken ? '0.0' : '10.0';
      saveState(this.s);
    }
    _syncLens() {
      const on = !!this.s.lensOn;
      $('#lens-toggle').setAttribute('aria-pressed', on ? 'true' : 'false');
      const lens = $('#lens');
      if (lens) lens.hidden = !on;
      const map = $('#lens-map');
      if (map && !map.dataset.built) {
        map.dataset.built = '1';
        map.innerHTML = '';
        const defs = [
          ['HBM 01–04', 4, 1, '#ffcb70'], ['DIE A', 110, 44, 'rgba(198,239,122,.5)'],
          ['SEAM', 160, 12, '#ff8f6b'], ['DIE B', 210, 44, 'rgba(198,239,122,.5)'],
          ['HBM 05–08', 268, 1, '#ffcb70']
        ];
        const base = sEl('rect', { x: 0, y: 30, width: 320, height: 2, fill: 'rgba(236,235,227,.14)' });
        map.appendChild(base);
        defs.forEach(([name, x, y, fill]) => {
          const r = sEl('rect', { x: x, y: 18, width: name.startsWith('HBM') ? 46 : 44, height: 14, fill: fill, opacity: .5 });
          map.appendChild(r);
          const t = sEl('text', { x: x, y: 42, class: 'lens-map-t' }, name);
          map.appendChild(t);
        });
        const marker = sEl('g', { class: 'lens-marker' });
        marker.innerHTML = `<rect x="-13" y="10" width="26" height="24" fill="none" stroke="#c9ef6a" stroke-width="1"/><path d="M0 4v6M0 34v6" stroke="#c9ef6a"/>`;
        marker.id = 'lens-marker';
        map.appendChild(marker);
        this._lensMapReady = true;
      }
      const marker = $('#lens-marker');
      if (marker) marker.setAttribute('transform', 'translate(' + (this.s.lensX * 320) + ',0)');
      if (lens) {
        lens.style.left = (50 + this.s.lensX * 30) + '%';
        lens.style.top = '50%';
      }
    }
    _inMemory() {
      const v = this._lastView;
      return !!v && v.chapter && v.chapter.id === 'memory';
    }
    toast(msg) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }
    resetForExport() {
      this.s = B.defaultState();
      this.s.detail = null;
      $('#detail-panel').hidden = true;
      $('.ch02').classList.remove('detail-open');
      this._fillMatrixInputs();
      $$('.part-item').forEach(x => { x.classList.toggle('active', x.dataset.part === 'overview'); x.setAttribute('aria-selected', x.dataset.part === 'overview' ? 'true' : 'false'); });
      $$('#matrix-lab .seg button').forEach(x => { x.classList.toggle('on', x.dataset.sparse === '0'); });
      $$('#platform-tabs button').forEach((x, i) => { x.classList.toggle('on', i === 0); });
      $$('#load-presets button').forEach(x => { x.classList.toggle('on', x.dataset.load === '480'); });
      $('#run-toggle').setAttribute('aria-pressed', 'true');
      $('#stack-expand').innerHTML = '收拢全部堆栈 <span>↕</span>';
      $('#toast').classList.remove('show');
      $$('dialog[open]').forEach(d => d.close());
      this._lastExplode = null;
      this._lastSel = null;
      this._lastDetail = null;
      this.compute();
      this.renderEverything();
    }

    /* ------------------------------------------------------------------ */
    /* computation                                                         */
    /* ------------------------------------------------------------------ */
    compute() {
      const fmt = B.FORMATS[this.s.precision] || B.FORMATS.fp4;
      const A = this.s.matrixA, Bm = this.s.matrixB;
      const Aq = B.quant.matrix(A, this.s.precision, this.s.sparse);
      const Bq = B.quant.matrix(Bm, this.s.precision, this.s.sparse);
      const Cq = B.quant.multiply(Aq.values, Bq.values);
      const exact = B.quant.multiply(A, Bm);
      const quantExact = B.quant.multiply(Aq.values, Bq.values);
      const err = B.quant.mae(exact, Cq);
      const aErr = B.quant.mae(A, Aq.values);
      const bErr = B.quant.mae(Bm, Bq.values);
      let zerosA = 0, zerosB = 0;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { if (!Aq.mask[r][c]) zerosA++; if (!Bq.mask[r][c]) zerosB++; }
      const macDense = 64;
      const macActual = (16 - zerosA) * 4 + (16 - zerosB) * 4 - (16 - zerosA) * (16 - zerosB) / 4;
      // simpler effective MAC: non-zero A entries × non-zero corresponding B entries
      let mac = 0;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (Aq.mask[i][j] && Aq.values[i][j] !== 0) {
        for (let k = 0; k < 4; k++) if (Bq.mask[j][k] && Bq.values[j][k] !== 0) mac++;
      }
      this.derived = {
        fmt: fmt, Aq: Aq, Bq: Bq, Cq: Cq, exact: exact,
        err: err, aErr: aErr, bErr: bErr, zerosA: zerosA, zerosB: zerosB,
        mac: mac, macDense: macDense,
        valueBytes: fmt.bytes,
        scaleA: Aq.scale, scaleB: Bq.scale
      };
      this.dirty.matrix = true;
      return this.derived;
    }

    /* ------------------------------------------------------------------ */
    /* main update                                                         */
    /* ------------------------------------------------------------------ */
    update(view) {
      this._lastView = view;
      this.time = view.time;
      const p = view.p, info = view.chapter, u = view.u;
      this._syncChapters(view);
      this._updateHud(view);
      this._updateNav(view);
      this._updateLabelsVisibility(view);
      // chapter specific updates
      if (info.id === 'package') this._updatePackageChapter(view);
      if (info.id === 'anatomy') this._updateAnatomyChapter(view);
      if (info.id === 'seam') this._updateSeamChapter(view);
      if (info.id === 'memory') this._updateMemoryChapter(view);
      if (info.id === 'numerics') this._updateNumericsChapter(view);
      if (info.id === 'scale') this._updateScaleChapter(view);
      if (info.id === 'compare') this._updateCompareChapter(view);
      if (info.id === 'return') this._updateReturnChapter(view);
      this._updateGlobalFormatBits(view);
      this._updateHandoff(view.p);
      this._updateLineupHandoff(view.p);
      if (this._inMemory()) this._updateLensVisual(view);
      else this._updateLensVisual(view);
    }

    _updateLineupHandoff(p) {
      const node = document.getElementById('lineup-handoff');
      if (!node) return;
      const active = p > .838 && p < .872;
      if (!active) { node.style.display = 'none'; return; }
      node.style.display = 'block';
      const W = window.innerWidth, H = window.innerHeight;
      const t = smooth(ramp(p, .842, .862));
      const fade = smooth(ramp(p, .838, .844)) * (1 - smooth(ramp(p, .858, .870)));
      const caption = node.querySelector('.lh-caption');
      if (caption) caption.style.opacity = fade.toFixed(3);
      (this._lhItems || []).forEach((item, i) => {
        const sx = W * .5 + (i - 2) * 24;
        const sy = H * .58 + (i % 2 ? 12 : -12);
        const tx = W * .5 + (i - 2) * W * .112;
        const ty = H * .60;
        const x = lerp(sx, tx, t), y = lerp(sy, ty, t);
        const sc = lerp(.55, .95, t);
        item.style.opacity = fade.toFixed(3);
        item.style.transform = `translate(${x - 78}px, ${y - 30}px) scale(${sc})`;
      });
    }

    _updateHandoff(p) {
      const node = document.getElementById('b200-handoff');
      if (!node) return;
      const active = p > .912 && p < .966;
      if (!active) { node.style.display = 'none'; return; }
      node.style.display = 'block';
      const t = smooth(ramp(p, .915, .952));
      const W = window.innerWidth, H = window.innerHeight;
      const svg = document.querySelector('.product-card[data-product="b200"] svg');
      const r = svg ? svg.getBoundingClientRect() : null;
      const startX = r ? r.left + r.width / 2 : W * .32;
      const startY = r ? r.top + r.height / 2 : H * .16;
      const endX = W * .50, endY = H * .59;
      const cx = lerp(startX, endX, t), cy = lerp(startY, endY, t);
      const scale = .8 + t * 2.35;
      node.style.transform = `translate(${cx - 90}px, ${cy - 37}px) scale(${scale})`;
      node.style.opacity = (0.85 * smooth(ramp(p, .912, .924)) * (1 - smooth(ramp(p, .942, .960)))).toFixed(3);
    }

    _syncChapters(view) {
      const p = view.p;
      this.chEls = this.chEls || $$('.ch');
      B.CHAPTERS.forEach((c, i) => {
        const node = this.chEls[i];
        let inA = i === 0 ? 1 : smooth(ramp(p, c.start - .004, c.start + .016));
        if (i === 6) inA = smooth(ramp(p, c.start - .020, c.start + .006));
        let outA = i === 7 ? 1 : 1 - smooth(ramp(p, c.end - .014, c.end + .002));
        let a = Math.min(inA, outA);
        if (p < c.start - .03 || p > c.end + .03) a = 0;
        node.style.opacity = a;
        node.style.visibility = a > .015 ? 'visible' : 'hidden';
      });
      // active click capture only for current chapter
      this.chEls.forEach((node, i) => {
        node.style.pointerEvents = 'none';
      });
      // css custom progress for any chapter
      document.documentElement.style.setProperty('--p', p.toFixed(5));
    }

    _updateHud(view) {
      $('#hud-chapter').textContent = view.chapter.num + ' / ' + view.chapter.cn;
      $('#hud-en').textContent = view.chapter.en;
      $('#progress-readout').textContent = String(Math.round(view.p * 100)).padStart(3, '0') + '%';
      $('#progress-fill').style.width = (view.p * 100) + '%';
      const t = Math.max(0, view.time);
      const hh = String(Math.floor(t / 3600)).padStart(2, '0');
      const mm = String(Math.floor(t / 60) % 60).padStart(2, '0');
      const ss = String(Math.floor(t) % 60).padStart(2, '0');
      $('#hud-clock').textContent = 'T+' + hh + ':' + mm + ':' + ss;
      const st = $('#bb-status'), hint = $('#bb-hint');
      const info = view.chapter.id;
      const statusMap = {
        package: ['PACKAGE / ONLINE', 'DRAG TO ORBIT · SCROLL TO CONTINUE'],
        anatomy: ['STRUCTURE / EXPLODED', 'CLICK A PART · CUT · SEAM'],
        seam: ['D2D / 10 TB/s', 'SELECT A REGION · REPLAY'],
        memory: ['HBM / 8 CHANNELS', 'MOVE THE LENS · SCROLL HORIZONTAL'],
        numerics: ['NUMERICS / ' + this.s.precision.toUpperCase(), 'EDIT MATRICES · CHANGE PRECISION'],
        scale: ['NVLINK / SCALE OUT', 'SELECT GPU OR TRAY · RUN ALL-REDUCE'],
        compare: ['SPECS / FIVE FORMS', 'SELECT A PRODUCT OR METRIC'],
        return: ['RETURN / ONE GPU', 'SELECT A TECHNOLOGY · WORKLOAD']
      };
      const pair = statusMap[info] || statusMap.package;
      if (st.textContent !== pair[0]) st.textContent = pair[0];
      if (hint.textContent !== pair[1]) hint.textContent = pair[1];
    }

    _updateNav(view) {
      const idx = view.chapter.index;
      $$('.nav-item').forEach((b, i) => {
        b.classList.toggle('live', i === idx);
        b.classList.toggle('done', i < idx);
      });
      $('#nav-progress').style.height = (view.p * 100) + '%';
      $$('#fin-chapters span').forEach((s, i) => s.classList.toggle('on', i === idx));
    }

    _updateLabelsVisibility(view) {
      const chNum = view.chapter.index + 1;
      this.labels.forEach(L => {
        const d = L.def;
        const on = d.ch === chNum;
        L.activeChapter = on;
        if (!on) {
          L.node.classList.remove('on');
          L.node.style.opacity = 0;
          L.path.style.opacity = 0; L.elbow.style.opacity = 0; L.dot.style.opacity = 0;
        }
      });
    }
  };
})();
