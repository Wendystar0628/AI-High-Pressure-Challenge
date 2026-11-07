/* ==========================================================================
   B200 / DIE STUDY — topology, shards, products, workload
   ========================================================================== */
(function () {
  'use strict';
  const B = window.B200;
  const proto = B.UI.prototype;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = B.clamp, smooth = B.smooth, ramp = B.ramp, lerp = B.lerp;
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function sEl(tag, attrs, text) { const n = document.createElementNS(NS, tag); if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k])); if (text != null) n.textContent = text; return n; }
  function nf(v, d) { return Number(v).toFixed(d == null ? 3 : d); }
  function sci(v, d) { if (!isFinite(v) || v === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(v))); const m = v / Math.pow(10, e); return m.toFixed(d == null ? 2 : d) + ' × 10' + sup(e); }
  function sup(n) { const map = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }; return String(n).split('').map(c => map[c] || c).join(''); }
  function shortCount(v, d) {
    if (v >= 1e12) return (v / 1e12).toFixed(d == null ? 2 : d) + 'T';
    if (v >= 1e9) return (v / 1e9).toFixed(d == null ? 2 : d) + '×10⁹';
    if (v >= 1e6) return (v / 1e6).toFixed(d == null ? 1 : d) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(d == null ? 1 : d) + 'K';
    return nf(v, 0);
  }

  Object.assign(proto, {
    /* ------------------------------------------------------------------ */
    /* die floorplan                                                       */
    renderDieMap() {
      const svg = $('#die-map');
      if (!svg) return;
      const s = this.s;
      const active = s.activeRegions;
      const colors = {
        compute: '#c6ef7a', cache: '#7ed8ff', hbmphy: '#ffcb70',
        d2d: '#ff8f6b', nvlink: '#b6a3ff', sec: '#f5a8d7'
      };
      const region = (x, y, w, h, key, label, extra) => {
        const on = active[key] !== false;
        let cells = '';
        if (key === 'compute') {
          for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) {
            cells += `<rect x="${x + 6 + c * ((w - 12) / 4)}" y="${y + 14 + r * ((h - 20) / 7)}" width="${((w - 12) / 4) - 3}" height="${((h - 20) / 7) - 2}" fill="${colors[key]}" opacity="${on ? .08 + (r + c) % 3 * .025 : .02}" pointer-events="none"/>`;
          }
        }
        if (key === 'cache') {
          for (let r = 0; r < 3; r++) {
            cells += `<line x1="${x + 5}" y1="${y + 5 + r * 4.5}" x2="${x + w - 5}" y2="${y + 5 + r * 4.5}" stroke="${colors[key]}" opacity="${on ? .3 : .06}" pointer-events="none"/>`;
          }
        }
        return `<g class="dm-region ${on ? '' : 'off'} ${s.selectedRegion === key ? 'sel' : ''}" data-region="${key}" tabindex="0" role="button" aria-label="${B.DIE_REGIONS[key].name} ${on ? '已激活' : '已关闭'}">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colors[key]}" opacity="${on ? .19 : .05}" stroke="${colors[key]}" stroke-width="${s.selectedRegion === key ? 1.2 : .55}" pointer-events="all"/>
          ${cells}
          <text x="${x + 4}" y="${y + (h < 26 ? h - 4 : 12)}" class="dm-label" fill="${on ? colors[key] : '#5d696d'}">${label}</text>
        </g>`;
      };
      let h = `<g class="dm-frame">
        <rect x="10" y="12" width="540" height="232" fill="rgba(6,11,15,.82)" stroke="rgba(236,235,227,.1)"/>
        ${Array.from({ length: 15 }, (_, i) => `<line x1="${20 + i * 36}" y1="20" x2="${20 + i * 36}" y2="238" stroke="rgba(236,235,227,.025)"/>`).join('')}
        ${Array.from({ length: 7 }, (_, i) => `<line x1="18" y1="${30 + i * 30}" x2="544" y2="${30 + i * 30}" stroke="rgba(236,235,227,.025)"/>`).join('')}
      </g>`;
      // package outline / two dies
      h += `<text x="24" y="28" class="dm-note">SCHEMATIC FLOORPLAN · 功能分区示意</text>`;
      h += `<text x="536" y="28" class="dm-note" text-anchor="end">${this.s.precision.toUpperCase()} · ${B.FORMATS[this.s.precision].bits} BIT</text>`;
      h += `<rect class="dm-die" x="22" y="40" width="248" height="176" rx="2"/>`;
      h += `<rect class="dm-die" x="290" y="40" width="248" height="176" rx="2"/>`;
      h += `<text x="34" y="53" class="dm-die-name">DIE A</text>`;
      h += `<text x="302" y="53" class="dm-die-name">DIE B</text>`;
      // PHY strips top/bottom
      h += region(34, 42, 224, 8, 'hbmphy', 'HBM PHY');
      h += region(34, 196, 224, 8, 'hbmphy', 'HBM PHY');
      h += region(302, 42, 224, 8, 'hbmphy', 'HBM PHY');
      h += region(302, 196, 224, 8, 'hbmphy', 'HBM PHY');
      // compute banks
      h += region(34, 56, 108, 108, 'compute', 'COMPUTE A');
      h += region(150, 56, 108, 108, 'compute', 'COMPUTE B');
      h += region(302, 56, 108, 108, 'compute', 'COMPUTE A');
      h += region(418, 56, 108, 108, 'compute', 'COMPUTE B');
      // caches
      h += region(34, 170, 224, 18, 'cache', 'L2 CACHE');
      h += region(302, 170, 224, 18, 'cache', 'L2 CACHE');
      // interface edges
      h += region(252, 56, 9, 108, 'd2d', 'D2D');
      h += region(299, 56, 9, 108, 'd2d', 'D2D');
      h += region(24, 56, 8, 108, 'nvlink', '');
      h += region(528, 56, 8, 108, 'nvlink', '');
      // security blocks
      h += region(214, 168, 40, 22, 'sec', 'SEC');
      h += region(482, 168, 40, 22, 'sec', 'SEC');
      // internal routing detail
      h += `<g pointer-events="none" opacity=".4">
        <path d="M140 80h12v60h-12M140 150h12M418 80h12v60h-12" fill="none" stroke="rgba(231,162,103,.45)" stroke-width=".6"/>
        <path d="M46 174v20M58 174v20M70 174v20M82 174v20" stroke="rgba(126,217,255,.3)" stroke-width=".5"/>
        <path d="M314 174v20M326 174v20M338 174v20M350 174v20" stroke="rgba(126,217,255,.3)" stroke-width=".5"/>
      </g>`;
      // seam bridge
      h += `<g class="dm-bridge" data-region="d2d" tabindex="0" role="button" aria-label="片间桥接">
        <rect x="270" y="90" width="20" height="76" fill="rgba(255,143,107,.18)" stroke="rgba(255,143,107,.55)" stroke-width=".7"/>
        <line x1="280" y1="88" x2="280" y2="168" stroke="#ff8f6b" stroke-width="1.2" stroke-dasharray="2 2"/>
        <text x="280" y="84" class="dm-note" text-anchor="middle" fill="${this.s.seam > .3 ? '#ff7d64' : '#ffb07d'}">${this.s.seam > .3 ? 'SEAM OPEN' : 'D2D · 10 TB/s'}</text>
        <text x="280" y="180" class="dm-note" text-anchor="middle">TWO DIES · ONE GPU</text>
      </g>`;
      for (let i = 0; i < 4; i++) {
        h += `<circle class="dm-pulse" data-p="${i}" cx="248" cy="${102 + i * 16}" r="1.9" fill="#ffd28e" opacity=".9"/>`;
      }
      // dimension marks
      h += `<g pointer-events="none" opacity=".55">
        <line x1="22" y1="226" x2="270" y2="226" stroke="rgba(236,235,227,.2)" stroke-width=".5"/>
        <line x1="22" y1="223" x2="22" y2="229" stroke="rgba(236,235,227,.3)"/>
        <line x1="270" y1="223" x2="270" y2="229" stroke="rgba(236,235,227,.3)"/>
        <text x="146" y="235" class="dm-note" text-anchor="middle">7.6 mm · reticle-class die</text>
        <text x="530" y="235" class="dm-note" text-anchor="end">CLICK A REGION TO TOGGLE</text>
      </g>`;
      svg.innerHTML = h;
      this._mapPulses = $$('.dm-pulse', svg);
      $$('.dm-region', svg).forEach(g => {
        g.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggleRegion(g.dataset.region); }
        });
      });
      const bridge = $('.dm-bridge', svg);
      if (bridge) bridge.addEventListener('click', () => this.toggleRegion('d2d'));
    },

    /* ------------------------------------------------------------------ */
    /* topology                                                            */
    renderTopology() {
      const svg = $('#topology-svg');
      if (!svg) return;
      if (!svg.dataset.built) {
        svg.dataset.built = '1';
        this._buildTopologySvg(svg);
      }
      const stage = this._topoStage == null ? 0 : this._topoStage;
      const board = $('.topo-board', svg), rack = $('.topo-rack', svg), gb = $('.topo-gb200', svg);
      if (board) {
        board.style.opacity = stage < 2 ? 1 : 0;
        board.style.pointerEvents = stage < 2 ? 'auto' : 'none';
        board.style.transform = stage < 2 ? 'scale(1)' : 'scale(.86)';
      }
      if (gb) {
        gb.style.opacity = stage === 2 ? 1 : 0;
        gb.style.pointerEvents = stage === 2 ? 'auto' : 'none';
        gb.style.transform = stage === 2 ? 'scale(1)' : 'scale(.9)';
      }
      if (rack) {
        rack.style.opacity = stage >= 3 ? 1 : 0;
        rack.style.pointerEvents = stage >= 3 ? 'auto' : 'none';
        rack.style.transform = stage >= 3 ? 'scale(1)' : 'scale(.92)';
      }
      $('#topo-mode').textContent = stage >= 3 ? 'NVL72 RACK · 72 GPU' : stage === 2 ? 'GB200 · 1 GRACE + 2 B200' : '8-GPU BASEBOARD';
      // selection
      $$('.topo-node', svg).forEach(n => n.classList.remove('sel'));
      const selGpu = this.s.selectedGpu;
      const selTray = this.s.selectedTray;
      if (stage < 2) {
        if (selGpu != null && selGpu < 8) {
          $$(`.topo-board .topo-node[data-gpu="${selGpu}"]`, svg).forEach(n => n.classList.add('sel'));
        }
      } else if (stage === 2) {
        if (selGpu != null && selGpu < 2) $$(`.topo-gb200 .topo-node[data-gpu="${selGpu}"]`, svg).forEach(n => n.classList.add('sel'));
      } else {
        let tray = selTray;
        if (tray == null && selGpu != null) tray = Math.floor(selGpu / 4);
        if (tray != null) $$(`.topo-tray[data-tray="${tray}"]`, svg).forEach(n => n.classList.add('sel'));
        if (selGpu != null && selGpu < 72) $$(`.topo-gpu-dot[data-gpu="${selGpu}"]`, svg).forEach(n => n.classList.add('sel'));
      }
      $$('.topo-link', svg).forEach(l => {
        const on = this.s.selectedLink != null && l.dataset.link === String(this.s.selectedLink);
        l.classList.toggle('active', on);
      });
    },

    _buildTopologySvg(svg) {
      const boardPos = [
        [42, 34], [42, 104], [42, 174], [42, 244],
        [328, 34], [328, 104], [328, 174], [328, 244]
      ];
      const swPos = [[185, 102], [185, 206]];
      let h = `<g class="topo-board">`;
      h += `<rect x="14" y="16" width="432" height="292" rx="4" fill="rgba(8,13,17,.55)" stroke="rgba(236,235,227,.13)"/>`;
      h += `<text x="28" y="32" class="topo-label">HGX B200 · 8 GPUs · 2 NVSWITCH</text>`;
      // links
      for (let i = 0; i < 8; i++) {
        for (let s = 0; s < 2; s++) {
          const from = [boardPos[i][0] + (boardPos[i][0] < 200 ? 92 : 0), boardPos[i][1] + 20];
          const to = [swPos[s][0] + (boardPos[i][0] < 200 ? 0 : 88), swPos[s][1] + 20];
          h += `<path class="topo-link" data-link="${i}-${s}" tabindex="0" role="button" aria-label="GPU ${i + 1} 到 NVSwitch ${s + 1} 的链路" d="M${from[0]} ${from[1]} C${(from[0] + to[0]) / 2} ${from[1]},${(from[0] + to[0]) / 2} ${to[1]},${to[0]} ${to[1]}"/>`;
        }
      }
      // switches
      swPos.forEach((p, i) => {
        h += `<g class="topo-node" data-switch="${i}" tabindex="0" role="button" aria-label="NVSwitch ${i + 1}">
          <rect x="${p[0]}" y="${p[1]}" width="88" height="40" rx="2" fill="rgba(126,217,255,.08)" stroke="rgba(126,217,255,.45)"/>
          <text x="${p[0] + 44}" y="${p[1] + 17}" class="topo-label" text-anchor="middle">NVLINK SWITCH ${i + 1}</text>
          <text x="${p[0] + 44}" y="${p[1] + 31}" class="topo-label" text-anchor="middle" fill="rgba(126,217,255,.5)">7.2 TB/s</text>
        </g>`;
      });
      // gpu nodes
      boardPos.forEach((p, i) => {
        h += `<g class="topo-node" data-gpu="${i}" tabindex="0" role="button" aria-label="GPU ${i + 1} B200">
          <rect x="${p[0]}" y="${p[1]}" width="92" height="42" rx="2" fill="rgba(201,239,106,.055)" stroke="rgba(201,239,106,.33)"/>
          <text x="${p[0] + 8}" y="${p[1] + 17}" class="topo-label" fill="rgba(236,235,227,.8)">GPU ${i + 1}</text>
          <text x="${p[0] + 8}" y="${p[1] + 30}" class="topo-label">B200 · 180 GB</text>
          <circle cx="${p[0] + 80}" cy="${p[1] + 12}" r="2" fill="#c9ef6a"/>
        </g>`;
      });
      h += `</g>`;
      // GB200 superchip layer
      h += `<g class="topo-gb200" style="opacity:0;transform-origin:center">`;
      h += `<rect x="14" y="16" width="432" height="292" rx="4" fill="rgba(8,13,17,.55)" stroke="rgba(236,235,227,.13)"/>`;
      h += `<text x="28" y="32" class="topo-label">GB200 · SUPERCHIP</text>`;
      h += `<path class="topo-link" d="M120 100 C160 70,200 70,225 112M335 100 C295 70,255 70,235 112" style="stroke:rgba(255,203,112,.55);stroke-width:1.1"/>`;
      h += `<path class="topo-link" d="M120 100 C160 170,190 200,220 212M335 100 C295 170,260 200,240 212" style="stroke:rgba(182,163,255,.45);stroke-width:.8"/>`;
      h += `<g class="topo-node" data-gpu="0" tabindex="0" role="button" aria-label="B200 GPU 1">
        <rect x="70" y="72" width="102" height="62" rx="2" fill="rgba(201,239,106,.05)" stroke="rgba(201,239,106,.38)"/>
        <text x="82" y="93" class="topo-label" fill="rgba(236,235,227,.85)">B200 · GPU 1</text>
        <text x="82" y="108" class="topo-label">2 dies · 8 HBM3e</text>
        <text x="82" y="122" class="topo-label" fill="rgba(201,239,106,.55)">192 GB · 8 TB/s</text>
      </g>`;
      h += `<g class="topo-node" data-gpu="1" tabindex="0" role="button" aria-label="B200 GPU 2">
        <rect x="283" y="72" width="102" height="62" rx="2" fill="rgba(201,239,106,.05)" stroke="rgba(201,239,106,.38)"/>
        <text x="295" y="93" class="topo-label" fill="rgba(236,235,227,.85)">B200 · GPU 2</text>
        <text x="295" y="108" class="topo-label">2 dies · 8 HBM3e</text>
        <text x="295" y="122" class="topo-label" fill="rgba(201,239,106,.55)">192 GB · 8 TB/s</text>
      </g>`;
      h += `<g class="topo-node" data-cpu="1" tabindex="0" role="button" aria-label="Grace CPU">
        <rect x="170" y="196" width="116" height="62" rx="2" fill="rgba(182,163,255,.07)" stroke="rgba(182,163,255,.45)"/>
        <text x="184" y="218" class="topo-label" fill="rgba(236,235,227,.85)">GRACE CPU</text>
        <text x="184" y="233" class="topo-label">LPDDR5X · ARM Neoverse</text>
        <text x="184" y="247" class="topo-label" fill="rgba(182,163,255,.7)">NVLink-C2C</text>
      </g>`;
      h += `<text x="228" y="160" class="topo-label" text-anchor="middle" fill="rgba(255,203,112,.7)">900 GB/s C2C</text>`;
      h += `<text x="28" y="306" class="topo-label">ONE GRACE + TWO B200 = ONE GB200 SUPERCHIP</text>`;
      h += `</g>`;
      // rack layer
      h += `<g class="topo-rack" style="opacity:0;transform-origin:center">`;
      h += `<rect x="14" y="16" width="432" height="292" rx="4" fill="rgba(8,13,17,.55)" stroke="rgba(236,235,227,.13)"/>`;
      h += `<text x="28" y="32" class="topo-label">GB200 NVL72 · 3 × 9 TRAYS · 72 GPUs</text>`;
      const cols = 3, rows = 9, cw = 130, chh = 22, gx = 145, gy = 30;
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const x = 30 + col * gx, y = 42 + row * gy;
          if (row < 6) {
            const computeIdx = col * 6 + row;
            const trayIdx = computeIdx;
            h += `<g class="topo-tray" data-tray="${trayIdx}" data-type="compute" tabindex="0" role="button" aria-label="计算托盘 ${computeIdx + 1}，4 颗 B200">
              <rect x="${x}" y="${y}" width="${cw}" height="${chh - 3}" fill="rgba(255,255,255,.035)" stroke="rgba(236,235,227,.12)" stroke-width=".6"/>
              <text x="${x + 4}" y="${y + 9}" class="topo-label">C${String(computeIdx + 1).padStart(2, '0')}</text>`;
            for (let g = 0; g < 4; g++) {
              const gpuIdx = computeIdx * 4 + g;
              h += `<rect class="topo-gpu-dot" data-gpu="${gpuIdx}" x="${x + 38 + g * 21}" y="${y + 5}" width="15" height="10" rx="1" fill="rgba(201,239,106,.22)" stroke="rgba(201,239,106,.5)" stroke-width=".5"/>`;
            }
            h += `<text x="${x + cw - 4}" y="${y + 9}" class="topo-label" text-anchor="end" fill="rgba(201,239,106,.45)">4×B200</text></g>`;
          } else {
            const switchIdx = 18 + col * 3 + (row - 6);
            h += `<g class="topo-tray" data-tray="${switchIdx}" data-type="switch" tabindex="0" role="button" aria-label="交换托盘 ${switchIdx - 17}">
              <rect x="${x}" y="${y}" width="${cw}" height="${chh - 3}" fill="rgba(126,217,255,.06)" stroke="rgba(126,217,255,.25)" stroke-width=".6"/>
              <text x="${x + 4}" y="${y + 9}" class="topo-label" fill="rgba(126,217,255,.75)">S${String(switchIdx - 17).padStart(2, '0')} · SWITCH</text>
              <text x="${x + cw - 4}" y="${y + 9}" class="topo-label" text-anchor="end" fill="rgba(126,217,255,.45)">2×NVSWITCH</text>
            </g>`;
          }
        }
      }
      h += `<text x="28" y="306" class="topo-label">18 COMPUTE TRAYS + 9 SWITCH TRAYS · NVLINK DOMAIN</text>`;
      h += `</g>`;
      svg.innerHTML = h;
      this._bindTopology(svg);
    },

    _bindTopology(svg) {
      const activate = (target) => {
        if (target.closest('.topo-gpu-dot')) {
          const gpu = +target.closest('.topo-gpu-dot').dataset.gpu;
          this.s.selectedGpu = gpu;
          this.s.selectedTray = Math.floor(gpu / 4);
          this.s.selectedLink = null;
        } else if (target.closest('.topo-tray')) {
          const tray = +target.closest('.topo-tray').dataset.tray;
          this.s.selectedTray = tray;
          this.s.selectedGpu = tray < 18 ? tray * 4 : null;
          this.s.selectedLink = null;
        } else if (target.closest('.topo-node[data-gpu]')) {
          this.s.selectedGpu = +target.closest('.topo-node').dataset.gpu;
          this.s.selectedTray = null;
          this.s.selectedLink = null;
        } else if (target.closest('.topo-node[data-switch]')) {
          this.s.selectedGpu = null;
          this.s.selectedTray = null;
        } else if (target.closest('.topo-link')) {
          this.s.selectedLink = target.closest('.topo-link').dataset.link;
        }
        this.renderTopology();
        this.opts.onSelectSystem && this.opts.onSelectSystem(this.s);
      };
      svg.addEventListener('click', e => activate(e.target));
      svg.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(e.target);
        }
      });
    },

    /* ------------------------------------------------------------------ */
    /* shards                                                              */
    renderShardStatic() {
      const f = B.FORMATS[this.s.precision];
      const bytes = this.s.loadParams * 1e9 * f.bytes;
      const cap = 180e9;
      const totalCap = 8 * cap;
      const required = Math.max(1, Math.ceil(bytes / cap));
      const fitSingle = bytes <= cap;
      const fit8 = bytes <= totalCap;
      const platforms = Math.ceil(required / 8);
      const C = this.derived.Cq;
      const flat = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) flat.push(C[r][c]);
      const locals = [];
      for (let i = 0; i < 8; i++) locals.push(flat[i * 2] + flat[i * 2 + 1]);
      const total = flat.reduce((a, b) => a + b, 0);
      this.shardData = { bytes, cap, totalCap, required, fitSingle, fit8, platforms, locals, total, fmt: f };
      const totalGB = bytes / 1e9;
      $('#shard-bytes').textContent = totalGB >= 100 ? totalGB.toFixed(0) : totalGB.toFixed(1);
      $('#shard-format').textContent = f.label;
      $('#shard-gpus').textContent = required;
      const racks = Math.ceil(required / 72);
      const pf = $('#shard-platforms');
      if (pf) pf.textContent = platforms;
      const pn = $('#shard-platform-note');
      if (pn) pn.textContent = '8 卡 / NVL72 ×' + Math.max(1, racks);
      const fitLabel = $('#shard-fit');
      const fitWrap = $('#fit-warning');
      if (!fitSingle) {
        fitWrap.hidden = false;
        fitWrap.querySelector('b').textContent = fit8 ? '单卡装不下' : '八卡平台装不下';
        fitWrap.querySelector('span').textContent = fit8
          ? `需要至少 ${required} 颗 GPU 才能容纳；8 卡平台仍有容量。`
          : `需要 ${required} 颗 GPU，约 ${platforms} 个八卡平台；可降低精度或增加设备。`;
      } else {
        fitWrap.hidden = true;
      }
      fitLabel.textContent = fitSingle ? '单卡可容纳' : (fit8 ? '需 ' + required + ' 卡' : '超出 8 卡');
      fitLabel.style.color = fitSingle ? 'var(--lime)' : (fit8 ? 'var(--amber)' : 'var(--danger)');
      $('#shard-per').textContent = (totalGB / 8).toFixed(1);
      // bars
      const bars = $('#shard-bars');
      bars.innerHTML = '';
      for (let i = 0; i < 8; i++) {
        const per = bytes / 8;
        const pct = clamp(per / cap * 100, 0, 100);
        const b = el('div', 'shard-bar' + (i < required ? ' active' : '') + (per > cap ? ' overflow' : ''));
        b.dataset.gpu = i;
        b.innerHTML = `<header><span>GPU ${i + 1}</span><b>${(per / 1e9).toFixed(1)} GB</b></header><div class="sb-fill"><i style="width:${pct.toFixed(1)}%"></i></div>`;
        b.addEventListener('click', () => {
          this.s.selectedGpu = i; this.s.selectedTray = null;
          this.renderShard(); this.renderTopology();
        });
        bars.appendChild(b);
      }
      this.renderShardTable();
    },

    renderShardTable() {
      const wrap = $('#shard-table');
      if (!this.shardData) return;
      const rows = this.shardData.locals;
      wrap.innerHTML = `<table><thead><tr><th>GPU</th><th>分片</th><th>局部 Σ</th><th>状态</th></tr></thead><tbody>` +
        rows.map((v, i) => `<tr data-gpu="${i}"><td>${String(i + 1).padStart(2, '0')}</td><td>${(this.shardData.bytes / 8 / 1e9).toFixed(1)} GB</td><td class="lv">${nf(v, 3)}</td><td class="st">LOCAL</td></tr>`).join('') +
        `</tbody></table>`;
      wrap.addEventListener('click', e => {
        const tr = e.target.closest('tr[data-gpu]');
        if (tr) {
          this.s.selectedGpu = +tr.dataset.gpu;
          this.s.selectedTray = null;
          this.renderShard(); this.renderTopology();
        }
      });
    },

    restoreState(state) {
      this.s = Object.assign(B.defaultState(), state || {});
      this.s.detail = null;
      this._fillMatrixInputs();
      $$('.part-item').forEach(b => {
        const on = b.dataset.part === this.s.selectedPart;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      $$('#matrix-lab .seg button').forEach(x => {
        const on = (x.dataset.sparse === '1') === !!this.s.sparse;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $$('#load-presets button').forEach(x => {
        const on = +x.dataset.load === this.s.loadParams;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $$('#stack-picker .stack-btn').forEach((x, i) => x.classList.toggle('on', i === this.s.selectedStack));
      $$('#workload-tabs button').forEach(b => {
        const on = b.dataset.workload === this.s.workload;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      $$('.tech-item').forEach((b, i) => b.classList.toggle('on', i === this.s.tech));
      $('#run-toggle').setAttribute('aria-pressed', this.s.running ? 'true' : 'false');
      $('#stack-expand').innerHTML = this.s.stackOpen ? '收拢全部堆栈 <span>↕</span>' : '展开全部堆栈 <span>↕</span>';
      this.compute();
      this.renderEverything();
      this._syncSeam();
      this._syncLens();
      this._lastShardPhase = null;
      this._lastExplode = null;
      this._lastSel = null;
      this._lastNarr = null;
    },

    renderShard() {
      if (!this.shardData) this.renderShardStatic();
      const D = this.shardData;
      if (!D) return;
      const phase = clamp(this.s.shardPhase || 0, 0, 1);
      const f = D.fmt;
      const total = D.total;
      const rows = D.locals;
      $$('#shard-table tbody tr').forEach((tr, i) => {
        const lv = tr.querySelector('.lv'), st = tr.querySelector('.st');
        let val = rows[i];
        let status = 'LOCAL';
        if (phase > .28) {
          status = 'RING';
          const steps = Math.min(7, Math.floor((phase - .28) / .42 * 8));
          if (i <= steps) { val = rows.slice(0, i + 1).reduce((a, b) => a + b, 0); }
        }
        if (phase > .72) { val = total; status = 'Σ'; }
        if (lv) lv.textContent = nf(val, 4);
        if (st) { st.textContent = status; st.classList.toggle('on', status === 'Σ'); }
        tr.classList.toggle('active', this.s.selectedGpu === i);
      });
      const res = $('#shard-result b');
      if (res) res.textContent = phase > .72 ? nf(total, 6) : '—';
      $('#shard-phase').textContent = phase > .98 ? 'COMPLETE / BROADCAST' :
        phase > .72 ? 'ALL-REDUCE / BROADCAST' :
          phase > .28 ? 'RING EXCHANGE · ' + Math.round(phase * 100) + '%' :
            phase > .02 ? 'LOCAL COMPUTE · ' + Math.round(phase * 100) + '%' : 'READY / 点击开始或滚动观看';
      $$('.shard-bar').forEach((b, i) => {
        b.classList.toggle('active', i < Math.max(D.required, 1));
        b.dataset.phase = phase.toFixed(2);
        const fill = b.querySelector('.sb-fill i');
        if (fill) fill.style.opacity = phase > .02 ? (.55 + .45 * Math.sin(i + phase * 8) * .5) : .6;
      });
      // highlight corresponding 3D selection
      if (this.s.selectedTray == null && this.s.selectedGpu != null) {
        this.s.selectedTray = Math.floor(this.s.selectedGpu / 4);
      }
    },

    /* ------------------------------------------------------------------ */
    /* products + spec table                                               */
    renderSpecTable() {
      const table = $('#spec-table');
      if (!table) return;
      const rows = [
        ['组成', 'compos', p => p.compos],
        ['GPU / CPU', 'count', p => `${p.gpus} GPU${p.cpus ? ' + ' + p.cpus + ' CPU' : ''}`],
        ['显存', 'memory', p => p.mem],
        ['显存带宽', 'bandwidth', p => p.bwNote],
        ['GPU 互连', 'interconnect', p => p.nvlink],
        ['FP4 稠密 / 稀疏', 'compute', p => `${p.fp4[0]} / ${p.fp4[1]} PF`],
        ['FP8 稠密 / 稀疏', 'compute', p => `${p.fp8[0]} / ${p.fp8[1]} PF`],
        ['FP16 稠密 / 稀疏', 'compute', p => `${p.fp16[0]} / ${p.fp16[1]} PF`],
        ['TF32 / FP64', 'compute', p => `${p.tf32[0]} PF / ${p.fp64 >= 1 ? p.fp64.toFixed(1) + ' PF' : (p.fp64 * 1000).toFixed(0) + ' TF'}`],
        ['功耗', 'power', p => p.power],
        ['形态', 'form', p => p.form]
      ];
      let h = `<caption>口径：单颗 GPU 与整套系统分开；算力为 Tensor Core 稠密值，括号内为 2:4 稀疏值。1 PFLOPS = 1,000 TFLOPS。</caption>`;
      h += `<thead><tr><th>指标 / 产品</th>${B.PRODUCTS.map(p => `<th class="${p.key === this.s.selectedProduct ? 'sel' : ''}" data-product="${p.key}"><button class="th-btn" type="button">${p.name}<small>${p.cn}</small></button></th>`).join('')}</tr></thead><tbody>`;
      rows.forEach(([label, metric, fn]) => {
        h += `<tr data-metric="${metric}"><th>${label}</th>`;
        B.PRODUCTS.forEach(p => {
          const sel = p.key === this.s.selectedProduct;
          h += `<td class="${sel ? 'sel' : ''}" data-product="${p.key}">${fn(p)}</td>`;
        });
        h += `</tr>`;
      });
      h += `</tbody>`;
      table.innerHTML = h;
      table.querySelectorAll('th[data-product] button').forEach(b => {
        b.addEventListener('click', () => {
          this.s.selectedProduct = b.closest('th').dataset.product;
          this._syncProductCards();
          this.renderSpecTable(); this.renderSpecBars();
        });
      });
      table.querySelectorAll('td[data-product]').forEach(td => {
        td.addEventListener('click', () => {
          this.s.selectedProduct = td.dataset.product;
          this._syncProductCards();
          this.renderSpecTable(); this.renderSpecBars();
        });
      });
      this.applyMetricHighlight();
    },

    _syncProductCards() {
      $$('.product-card').forEach(x => x.classList.toggle('sel', x.dataset.product === this.s.selectedProduct));
    },

    renderSpecBars() {
      const wrap = $('#spec-bars');
      if (!wrap) return;
      const metric = this.s.selectedMetric;
      const values = {
        compute: { unit: 'PFLOPS', get: p => p.fp4[0], fmt: v => v.toFixed(1), name: 'FP4 稠密' },
        memory: { unit: 'GB HBM', get: p => p.key === 'nvl72' ? 13500 : (p.key === 'b200' ? 192 : p.key === 'gb200' ? 384 : 1440), fmt: v => v >= 1000 ? (v / 1000).toFixed(1) + ' TB' : v + ' GB', name: 'HBM 容量' },
        bandwidth: { unit: 'TB/s', get: p => p.bw, fmt: v => v + ' TB/s', name: '显存带宽' },
        interconnect: { unit: 'TB/s', get: p => p.nvValue, fmt: v => v < 2 ? v.toFixed(1) + ' TB/s' : v + ' TB/s', name: 'GPU 互连' },
        power: { unit: 'W', get: p => p.powerNum, fmt: v => v >= 1000 ? (v / 1000).toFixed(1) + ' kW' : v + ' W', name: '功耗' }
      }[metric];
      const max = Math.max.apply(null, B.PRODUCTS.map(values.get));
      let h = `<div class="bar-note">${values.name} / ${values.unit} <span>对数相对刻度</span></div>`;
      B.PRODUCTS.forEach(p => {
        const v = values.get(p);
        const pct = Math.log10(1 + v) / Math.log10(1 + max) * 100;
        h += `<div class="spec-bar ${p.key === this.s.selectedProduct ? 'sel' : ''}" data-product="${p.key}">
          <div class="bar-head"><b>${p.name}</b><span class="bv">${values.fmt(v)}</span></div>
          <div class="bar-track"><i style="width:${pct.toFixed(1)}%"></i></div>
        </div>`;
      });
      wrap.innerHTML = h;
      wrap.querySelectorAll('.spec-bar').forEach(b => b.addEventListener('click', () => {
        this.s.selectedProduct = b.dataset.product;
        this._syncProductCards();
        this.renderSpecTable(); this.renderSpecBars();
      }));
    },

    applyMetricHighlight() {
      const m = this.s.selectedMetric;
      const map = {
        compute: ['p-compute', 'p-die', 'p-cpu'],
        memory: ['p-mem'],
        bandwidth: ['p-mem', 'p-link'],
        interconnect: ['p-switch', 'p-link'],
        power: ['p-power', 'p-fans']
      };
      $$('.product-card').forEach(card => {
        card.querySelectorAll('svg *').forEach(n => n.classList.remove('hl'));
        (map[m] || []).forEach(cls => {
          card.querySelectorAll('.' + cls).forEach(n => n.classList.add('hl'));
        });
      });
      $$('#spec-table tbody tr').forEach(tr => {
        tr.classList.toggle('metric-focus', tr.dataset.metric === m);
      });
    },

    /* ------------------------------------------------------------------ */
    /* technology + workload                                               */
    renderTechDetail() {
      const d = $('#tech-detail');
      if (!d) return;
      const t = B.TECHS[this.s.tech] || B.TECHS[0];
      const f = B.FORMATS[this.s.precision];
      const extra = t.key === 'transformer' ? `<br><span style="color:var(--lime)">当前格式：${f.label} · ${f.bits} bit</span>` :
        t.key === 'hbm' ? `<br><span style="color:var(--lime)">当前可容纳 ${sci(192e9 / f.bytes, 2)} 个 ${f.label} 值</span>` :
          t.key === 'd2d' ? `<br><span style="color:var(--lime)">接缝状态：${this.s.seam > .3 ? '断开' : '连通'}</span>` : '';
      d.innerHTML = `<b>${t.n} · ${t.v}</b>${t.d}${extra}`;
    },

    renderWorkload() {
      const w = B.WORKLOADS[this.s.workload] || B.WORKLOADS.training;
      const f = B.FORMATS[this.s.precision];
      $('#workload-desc').textContent = w.desc;
      const science = this.s.workload === 'science';
      const scale = f.key === 'fp4' ? 1 : f.key === 'fp8' ? .52 : f.key === 'fp16' ? .28 : f.key === 'bf16' ? .25 : .12;
      const t = this.time || 0;
      let readouts;
      if (this.s.workload === 'training') {
        readouts = [
          ['训练吞吐', (1.62 + Math.sin(t * .7) * .08).toFixed(2) + ' M tok/s'],
          ['有效算力', (9 * scale * .82).toFixed(1) + ' PFLOPS'],
          ['通信占比', (26 + Math.sin(t * .4) * 2).toFixed(0) + '%']
        ];
      } else if (this.s.workload === 'inference') {
        readouts = [
          ['输出吞吐', Math.round(24100 + Math.sin(t * 1.2) * 900).toLocaleString() + ' tok/s'],
          ['首 token 延迟', (0.42 + Math.sin(t * .9) * .02).toFixed(2) + ' s'],
          ['并发请求', '1,024']
        ];
      } else {
        readouts = [
          ['FP64 算力', '40 TFLOPS'],
          ['迭代 / s', (38 + Math.sin(t * .8) * 2).toFixed(0)],
          ['网格规模', '2.4 × 10⁹']
        ];
      }
      $('#workload-readouts').innerHTML = readouts.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
      $('#workload-stream').dataset.workload = this.s.workload;
      $('#ch8-precision').textContent = f.label;
      const note = $('#ch8-format-note');
      if (science) {
        note.innerHTML = '<span style="color:var(--amber)">本负载采用 FP64 · 独立格式</span> · 全页精度保持 ' + f.label;
      } else {
        note.textContent = f.sub + ' · 负载沿用当前全页精度';
      }
      $('#fin-precision').textContent = f.label;
      $('#ch5-tensor-mode').textContent = f.label + ' · ' + f.sub.toUpperCase();
      $$('#workload-tabs button').forEach(b => {
        const on = b.dataset.workload === this.s.workload;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    },

    /* ------------------------------------------------------------------ */
    /* global format linkage                                               */
    renderFormatDependent() {
      const f = B.FORMATS[this.s.precision];
      const D = this.derived;
      this._syncPrecisionButtons();
      // 02
      const groupText = this.s.precision === 'fp4'
        ? '每 16 值 · 1 个 E4M3 缩放'
        : `每值独立 · ${f.bits} bit`;
      const gEl = $('#ch2-group');
      if (gEl) gEl.textContent = groupText;
      const occ = $('#ch2-occupancy');
      if (occ) occ.textContent = `192 GB ≈ ${sci(192e9 / f.bytes, 2)} 值`;
      const gnote = $('#ch2-group-note');
      if (gnote) gnote.textContent = `8 堆栈 × 8 层中，同一批 ${this.s.sparse ? '2:4 稀疏' : '稠密'}数据按 ${f.label} 分组；容量与占用随格式重新计算。`;
      // 04
      const bits = $('#ch4-bits'); if (bits) bits.textContent = f.bits + ' bit';
      const batches = $('#ch4-batches'); if (batches) batches.textContent = '4,096';
      const dwell = $('#ch4-dwell'); if (dwell) dwell.textContent = shortCount(192e9 / f.bytes, 2);
      const pergb = $('#ch4-pergb'); if (pergb) pergb.textContent = sci(1e9 / f.bytes, 2);
      const unit = $('#ch4-pergb-unit'); if (unit) unit.textContent = f.label + ' 值 / GB';
      const bt = $('#ch4-batchtime'); if (bt) bt.textContent = '0.13';
      // 08 + shared
      this.renderTechDetail();
      this.renderWorkload();
      this.renderBitStrip();
      this.renderNumberLine();
      this.renderMatrix();
      this.renderTrace();
      this.renderChannels();
      this.renderSide();
      this.renderShardStatic();
      this.renderShard();
      this.renderDieMap();
      if (this.s.detail) this.renderDetail();
    },
  });
})();
