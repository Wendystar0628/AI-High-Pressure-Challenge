/* ==========================================================================
   B200 / DIE STUDY — renderers for the interface and diagrams
   ========================================================================== */
(function () {
  'use strict';
  const B = window.B200;
  const proto = B.UI.prototype;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = B.clamp, lerp = B.lerp, smooth = B.smooth, ramp = B.ramp;
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function sEl(tag, attrs, text) { const n = document.createElementNS(NS, tag); if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k])); if (text != null) n.textContent = text; return n; }
  function nf(v, d) { return Number(v).toFixed(d == null ? 3 : d); }
  function sci(v, d) {
    if (!isFinite(v) || v === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(v)));
    const m = v / Math.pow(10, e);
    return m.toFixed(d == null ? 2 : d) + ' × 10' + sup(e);
  }
  function sup(n) {
    const map = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(n).split('').map(c => map[c] || c).join('');
  }
  function shortCount(v, d) {
    if (v >= 1e12) return (v / 1e12).toFixed(d == null ? 2 : d) + 'T';
    if (v >= 1e9) return (v / 1e9).toFixed(d == null ? 2 : d) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(d == null ? 1 : d) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(d == null ? 1 : d) + 'K';
    return nf(v, 0);
  }
  function svgWrap(inner, cls) { return `<svg class="${cls || ''}" viewBox="0 0 420 220" preserveAspectRatio="xMidYMid meet">${inner}</svg>`; }

  Object.assign(proto, {
    /* ------------------------------------------------------------------ */
    renderEverything() {
      if (!this.derived) this.compute();
      this._buildHeroSvg();
      this._syncPrecisionButtons();
      this.renderPartInfo();
      this.renderBitStrip();
      this.renderNumberLine();
      this.renderMatrix();
      this.renderTrace();
      this.renderDieMap();
      this._buildChannels();
      this.renderChannels();
      this.renderSide();
      this.renderExploded();
      this.renderXsec();
      this.renderTopology();
      this.renderShardStatic();
      this.renderShard();
      this.renderSpecTable();
      this.renderSpecBars();
      this.applyMetricHighlight();
      this.renderTechDetail();
      this.renderWorkload();
      this.renderFormatDependent();
      if (this.s.detail) this.renderDetail();
    },

    _buildHeroSvg() {
      const svg = $('#hero-svg');
      if (!svg || svg.dataset.built) return;
      svg.dataset.built = '1';
      const parts = [];
      parts.push(`<g class="hero-rings" id="hero-rings">
        <circle cx="760" cy="360" r="440"/><circle cx="760" cy="360" r="350"/><circle cx="760" cy="360" r="262"/><circle cx="760" cy="360" r="176"/>
        <circle cx="760" cy="360" r="510" stroke-dasharray="1 11"/>
      </g>`);
      // radial ticks
      let ticks = '';
      for (let i = 0; i < 72; i++) {
        const a = i / 72 * Math.PI * 2;
        const r1 = i % 6 === 0 ? 428 : 438, r2 = 446;
        ticks += `<line class="hero-tick" x1="${760 + Math.cos(a) * r1}" y1="${360 + Math.sin(a) * r1}" x2="${760 + Math.cos(a) * r2}" y2="${360 + Math.sin(a) * r2}" opacity="${i % 6 === 0 ? .6 : .25}"/>`;
      }
      parts.push(ticks);
      parts.push(`<line class="hero-cross" x1="180" y1="360" x2="1300" y2="360"/><line class="hero-cross" x1="760" y1="10" x2="760" y2="710"/>`);
      // die outlines, cells
      const cells = [];
      [-1, 1].forEach((s, di) => {
        const cx = 760 + s * 120;
        const w = 200, h = 242, x = cx - w / 2, y = 360 - h / 2;
        parts.push(`<rect class="hero-die" id="hero-die-${di}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`);
        parts.push(`<text class="hero-text" x="${x}" y="${y - 12}">DIE ${di ? 'B' : 'A'} · ${di ? '0xE2' : '0xA1'}</text>`);
        for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) {
          const ww = 22, hh = 20;
          const px = x + 18 + c * 29, py = y + 20 + r * 27;
          cells.push(`<rect class="hero-cell" data-die="${di}" data-r="${r}" data-c="${c}" x="${px}" y="${py}" width="${ww}" height="${hh}" rx="1"/>`);
        }
      });
      parts.push(`<g id="hero-cells">${cells.join('')}</g>`);
      parts.push(`<path class="hero-cross" d="M760 118v-58M760 602v58" stroke-dasharray="3 5"/>`);
      parts.push(`<text class="hero-text" x="600" y="685">TWO RETICLE DIES · ONE LOGICAL GPU</text>`);
      parts.push(`<text class="hero-text" x="1080" y="96">2,080,000,000,000 TRANSISTORS / NOT TO SCALE</text>`);
      parts.push(`<g id="hero-scale">${Array.from({ length: 20 }, (_, i) => `<line class="hero-tick" x1="${180 + i * 20}" y1="710" x2="${180 + i * 20}" y2="${i % 5 ? 716 : 722}"/>`).join('')}</g>`);
      svg.innerHTML = parts.join('');
      this._heroRings = $$('#hero-rings circle', svg);
      this._heroCells = $$('.hero-cell', svg);
    },

    _syncPrecisionButtons() {
      const key = this.s.precision;
      $$('#precision-dock .pd-btn').forEach(b => {
        const on = b.dataset.fmt === key;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      $$('#format-rail .fmt-card').forEach(b => {
        const on = b.dataset.fmt === key;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      const f = B.FORMATS[key];
      $('#pd-note').textContent = f.label + ' · ' + (f.bytes < 1 ? '0.5' : f.bytes) + ' B/value' + (key === 'fp4' ? ' · 默认' : '');
      $('#run-toggle').setAttribute('aria-pressed', this.s.running ? 'true' : 'false');
    },

    renderPartInfo() {
      const key = this.s.selectedPart || 'overview';
      const p = B.PARTS[key] || B.PARTS.overview;
      const order = ['overview', 'die', 'hbm', 'interposer', 'substrate', 'balls'];
      const n = order.indexOf(key) + 1;
      $('#part-en').textContent = p.en;
      $('#part-index').textContent = String(n).padStart(2, '0');
      $('#part-name').textContent = p.name;
      $('#part-val').textContent = p.val;
      $('#part-desc').textContent = p.desc;
      $('#part-metric').textContent = p.metric;
      $$('.part-item').forEach(b => {
        const on = b.dataset.part === key;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const open = $('#detail-open');
      if (open) open.style.visibility = (key === 'die' || key === 'hbm' || key === 'interposer' || key === 'substrate') ? 'visible' : 'hidden';
    },

    renderDetail() {
      const d = this.s.detail;
      const f = B.FORMATS[this.s.precision];
      const diagram = $('#detail-diagram');
      const copy = $('#detail-copy');
      if (!d) return;
      $('#detail-panel').hidden = false;
      if (d === 'hbm') {
        $('#detail-title').textContent = 'HBM3e 堆栈 · 层、凸点与通孔';
        let svg = `<svg viewBox="0 0 430 220" preserveAspectRatio="xMidYMid meet">`;
        svg += `<g opacity=".5">${Array.from({ length: 8 }, (_, i) => `<line x1="34" y1="${30 + i * 22}" x2="396" y2="${30 + i * 22}" stroke="rgba(236,235,227,.06)"/>`).join('')}</g>`;
        svg += `<rect x="150" y="190" width="168" height="14" class="svg-fill-sub"/><text x="324" y="201" class="svg-lbl">BASE DIE</text>`;
        for (let i = 0; i < 8; i++) {
          const y = 172 - i * 19;
          svg += `<rect x="156" y="${y}" width="156" height="13" class="svg-fill-silicon"/>`;
          svg += `<text x="320" y="${y + 10}" class="svg-lbl">DRAM ${i}</text>`;
          svg += `<line x1="166" y1="${y + 13}" x2="302" y2="${y + 13}" stroke="rgba(231,162,103,.45)" stroke-width="1" stroke-dasharray="2 3"/>`;
          for (let b = 0; b < 6; b++) svg += `<circle cx="${178 + b * 22}" cy="${y + 16}" r="1.5" class="svg-bump"/>`;
        }
        for (let t = 0; t < 4; t++) {
          svg += `<line x1="${188 + t * 30}" y1="30" x2="${188 + t * 30}" y2="192" class="svg-tsv"/>`;
        }
        svg += `<text x="34" y="55" class="svg-lbl hi">TSV / 硅通孔</text><path d="M98 58h52" stroke="rgba(231,162,103,.5)" stroke-dasharray="2 2"/>`;
        svg += `<text x="34" y="115" class="svg-lbl">μBUMP / 层间微凸点</text><path d="M118 118h62" stroke="rgba(222,195,140,.4)" stroke-dasharray="2 2"/>`;
        svg += `<text x="34" y="175" class="svg-lbl">8 × DRAM LAYERS</text>`;
        svg += `</svg>`;
        diagram.innerHTML = svg;
        copy.innerHTML = `<p>每个 HBM3e 堆栈由 1 个基底与 8 层 DRAM 叠成；层间微凸点提供电源与信号，TSV 垂直贯穿整个堆叠。</p>
          <ul>
            <li><span>层数</span><b>1 base + 8 DRAM</b></li>
            <li><span>单堆栈容量（示意）</span><b>24 GB</b></li>
            <li><span>8 堆栈合计</span><b>192 GB</b></li>
            <li><span>当前格式</span><b>${f.label} · ${f.bits} bit / value</b></li>
            <li><span>逻辑分组</span><b>${this.s.precision === 'fp4' ? '16 值 / 共享缩放' : '逐值编码'}</b></li>
            <li><span>容量折算</span><b>${sci(192e9 / f.bytes, 2)} values</b></li>
          </ul>`;
      } else if (d === 'die') {
        $('#detail-title').textContent = '计算晶粒 · 功能分区';
        let svg = `<svg viewBox="0 0 430 220" preserveAspectRatio="xMidYMid meet">`;
        svg += `<rect x="30" y="30" width="370" height="160" class="dm-die"/>`;
        const reg = [
          [50, 44, 150, 92, '#c6ef7a', 'COMPUTE A'], [50, 174, 150, 8, '#ff8f6b', ''],
          [210, 44, 150, 92, '#c6ef7a', 'COMPUTE B'], [210, 174, 150, 8, '#ff8f6b', ''],
          [50, 142, 310, 24, '#7ed8ff', 'L2 CACHE'],
          [38, 58, 8, 100, '#b6a3ff', 'NV'],
          [382, 58, 8, 100, '#ff8f6b', 'D2D'],
          [42, 30, 330, 9, '#ffcb70', 'HBM PHY'],
          [42, 194, 330, 9, '#ffcb70', 'HBM PHY']
        ];
        reg.forEach(r => {
          svg += `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${r[4]}" opacity="${r[4] === '#ff8f6b' ? .35 : .17}" stroke="${r[4]}" stroke-width=".7"/>`;
          if (r[5]) svg += `<text x="${r[0] + 4}" y="${r[1] + (r[3] > 20 ? 16 : 7)}" class="svg-lbl">${r[5]}</text>`;
        });
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 4; j++) {
            svg += `<rect x="${58 + j * 34}" y="${52 + i * 10}" width="30" height="8" fill="rgba(198,239,122,.13)" stroke="rgba(198,239,122,.2)" stroke-width=".4"/>`;
            svg += `<rect x="${218 + j * 34}" y="${52 + i * 10}" width="30" height="8" fill="rgba(198,239,122,.13)" stroke="rgba(198,239,122,.2)" stroke-width=".4"/>`;
          }
        }
        svg += `<text x="50" y="212" class="svg-lbl">示意布局 · 不对应已公开版图</text></svg>`;
        diagram.innerHTML = svg;
        copy.innerHTML = `<p>顶面是计算簇阵列、共享缓存与接口的拼贴。朝向接缝的是片间互连 PHY，外侧是 NVLink，上下边缘面向 HBM。</p>
          <ul>
            <li><span>计算区</span><b>张量 / 向量阵列</b></li>
            <li><span>缓存</span><b>L2 · 片内共享</b></li>
            <li><span>片间</span><b>D2D PHY · 10 TB/s</b></li>
            <li><span>系统</span><b>NVLink 5 · 1.8 TB/s</b></li>
            <li><span>当前格式</span><b>${f.label}</b></li>
          </ul>`;
      } else {
        $('#detail-title').textContent = '基板 · 多层铜与电源完整性';
        let svg = `<svg viewBox="0 0 430 220" preserveAspectRatio="xMidYMid meet">`;
        for (let i = 0; i < 10; i++) {
          const y = 190 - i * 12;
          svg += `<rect x="35" y="${y}" width="360" height="10" fill="${i % 2 ? 'rgba(19,36,29,.8)' : 'rgba(51,42,26,.6)'}" stroke="rgba(231,162,103,.25)" stroke-width=".5"/>`;
          svg += `<text x="45" y="${y + 8}" class="svg-lbl">L${10 - i}</text>`;
        }
        svg += `<path d="M60 194 L120 194 L120 158 L210 158 L210 122 L300 122 L300 78 L380 78" fill="none" stroke="rgba(231,162,103,.65)" stroke-width="1.1"/>`;
        svg += `<path d="M60 194 L100 194 L100 134 L250 134 L250 102 L380 102" fill="none" stroke="rgba(126,217,255,.45)" stroke-width=".8" stroke-dasharray="2 2"/>`;
        svg += `<text x="48" y="34" class="svg-lbl hi">铜布线 / 扇出</text><text x="270" y="34" class="svg-lbl">CORE / PREPREG / SOLDER MASK</text>`;
        svg += `<rect x="42" y="202" width="346" height="8" fill="rgba(181,193,197,.15)" stroke="rgba(181,193,197,.35)" stroke-width=".6"/>`;
        svg += `<text x="42" y="214" class="svg-lbl">BGA SOLDER ARRAY</text></svg>`;
        diagram.innerHTML = svg;
        copy.innerHTML = `<p>有机基板把封装内的微间距信号扇出到主板，同时承担机械支撑与电源分配。加强框限制大面积翘曲。</p>
          <ul>
            <li><span>结构</span><b>10+ 层有机基板</b></li>
            <li><span>布线</span><b>铜 / 介质交替</b></li>
            <li><span>连接</span><b>焊球阵列 + 微凸点</b></li>
            <li><span>加固</span><b>金属加强框 + 去耦</b></li>
            <li><span>当前格式</span><b>${f.label}</b></li>
          </ul>`;
      }
    },

    /* ------------------------------------------------------------------ */
    /* bit fields                                                          */
    _ensureBitStrip() {
      const strip = $('#bit-strip');
      if (!strip.dataset.built) {
        strip.dataset.built = '1';
        strip.innerHTML = `<div class="bit-scale-chip" id="bit-scale-chip"></div><div class="bit-field-labels" id="bit-field-labels"></div><div class="bit-cells" id="bit-cells"></div><div class="bit-foot" id="bit-foot"></div>`;
        const cells = $('#bit-cells');
        let h = '';
        for (let i = 0; i < 64; i++) h += `<span class="bit-cell" data-i="${i}"></span>`;
        cells.innerHTML = h;
      }
    },

    renderBitStrip() {
      this._ensureBitStrip();
      const f = B.FORMATS[this.s.precision];
      const fieldsObj = B.quant.formatFields(this.s.precision, this.s.probe, this.derived.scaleA);
      const fields = fieldsObj.fields;
      const colorOf = { sign: 'var(--lime)', exp: 'var(--cyan)', mant: 'var(--copper)', pad: '#354145' };
      const totalBits = fields.reduce((a, x) => a + x.bits.length, 0) || 1;
      const start = 1.2, end = 98.8, gap = fields.length > 1 ? .55 : 0;
      const usable = end - start - gap * (fields.length - 1);
      let cursor = start;
      const labelWrap = $('#bit-field-labels');
      const foot = $('#bit-foot');
      labelWrap.innerHTML = '';
      foot.innerHTML = '';
      const cellNodes = $$('#bit-cells .bit-cell');
      let idx = 0;
      fields.forEach((field, fi) => {
        const w = usable * field.bits.length / totalBits;
        // field label
        const lab = el('div', 'bit-field-label');
        lab.style.left = cursor + '%';
        lab.style.width = w + '%';
        lab.style.color = colorOf[field.key] || 'var(--muted)';
        lab.innerHTML = `<b>${{ sign: '符号 S', exp: '指数 E', mant: '尾数 M', pad: '填充' }[field.key]}</b><span>${field.bits.length} bit</span>`;
        labelWrap.appendChild(lab);
        // cells
        for (let b = 0; b < field.bits.length; b++) {
          const node = cellNodes[idx++];
          const cw = w / field.bits.length;
          node.style.left = (cursor + b * cw) + '%';
          node.style.width = cw + '%';
          node.style.background = colorOf[field.key];
          node.classList.toggle('small', cw < 1.15);
          node.textContent = cw >= 1.15 ? field.bits[b] : '';
          node.dataset.bit = field.bits[b];
          node.title = field.key + ' bit ' + b + ' = ' + field.bits[b];
        }
        // foot summary
        foot.innerHTML += `<span style="color:${colorOf[field.key]}">${field.bits.length}×${{ sign: 'S', exp: 'E', mant: 'M', pad: 'PAD' }[field.key]}</span>`;
        cursor += w + gap;
      });
      for (let i = idx; i < cellNodes.length; i++) {
        cellNodes[i].style.width = '0%';
        cellNodes[i].style.left = '99%';
        cellNodes[i].style.opacity = '0';
      }
      for (let i = 0; i < idx; i++) cellNodes[i].style.opacity = '1';
      const chip = $('#bit-scale-chip');
      if (this.s.precision === 'fp4') {
        chip.style.display = 'flex';
        chip.innerHTML = `<span>共享缩放 / SHARED E4M3</span><b>s = ${nf(this.derived.scaleA, 5)}</b><i>每 16 值 1 个缩放因子</i>`;
      } else {
        chip.style.display = 'none';
      }
      const val = this.s.probe, q = B.quant.value(val, this.s.precision, this.derived.scaleA);
      const err = Math.abs(q.value - val);
      $('#bit-title').innerHTML = `${f.label} <small>${f.sub}</small>`;
      $('#bit-bytes').textContent = (f.bytes < 1 ? '0.5' : f.bytes) + ' B / value';
      $('#bit-range').textContent = f.key === 'fp4' ? '可表示 ±0, .5 … 6 × s' : f.key === 'fp64' ? 'IEEE 754 double' : '指数偏置 ' + f.bias;
      $('#bit-code').textContent = 'HEX ' + fieldsObj.hex;
      $('#bit-input').textContent = nf(val, 3);
      $('#bit-quant').textContent = nf(q.value, 4);
      $('#bit-error').textContent = nf(err, 5);
      $('#bit-scale').textContent = this.s.precision === 'fp4' ? nf(this.derived.scaleA, 5) : '1';
      $('#bit-focus').textContent = '全页精度 ' + f.label + (this.s.narrateFormat && this.s.narrateFormat !== this.s.precision ? ' · 讲解 ' + B.FORMATS[this.s.narrateFormat].label : '');
      $('#bit-note').textContent = f.note + ' 滚动中的格式讲解不会覆盖你的全页精度。';
      $('#probe-out').textContent = nf(val, 3);
      $('#probe-range').value = val;
    },

    renderNumberLine() {
      const svg = $('#numberline-svg');
      if (!svg) return;
      const f = B.FORMATS[this.s.precision];
      const s = this.derived.scaleA;
      const domain = 2.6;
      const left = 22, right = 356, y = 112, top = 26, bottom = 154;
      const x = v => left + (clamp(v, -domain, domain) + domain) / (domain * 2) * (right - left);
      const reps = B.quant.representables(this.s.precision, s, domain);
      const uniq = [];
      reps.forEach(v => { if (!uniq.length || Math.abs(v - uniq[uniq.length - 1]) > 1e-7) uniq.push(v); });
      let ticks = '';
      const n = uniq.length;
      uniq.forEach((v, i) => {
        const op = n > 300 ? .18 : n > 90 ? .32 : .55;
        ticks += `<line x1="${x(v)}" y1="${y - 6}" x2="${x(v)}" y2="${y + 6}" stroke="rgba(236,235,227,${op})" stroke-width="${n > 300 ? .5 : .8}"/>`;
        if (n <= 18) ticks += `<line x1="${x(v)}" y1="${y + 6}" x2="${x(v)}" y2="${y + 11}" stroke="rgba(201,239,106,.45)" stroke-width=".6"/>`;
      });
      const probe = clamp(this.s.probe, -domain, domain);
      const qObj = B.quant.value(this.s.probe, this.s.precision, s);
      const q = clamp(qObj.value, -domain, domain);
      const err = Math.abs(qObj.value - this.s.probe);
      const grid = [];
      for (let i = -2; i <= 2; i++) {
        grid.push(`<line x1="${x(i)}" y1="${top}" x2="${x(i)}" y2="${bottom}" stroke="rgba(236,235,227,.055)" stroke-width=".6"/>`);
        grid.push(`<text x="${x(i)}" y="174" class="nl-tick" text-anchor="middle">${i}</text>`);
      }
      const bracketY = 70;
      const bx1 = x(Math.min(probe, q)), bx2 = x(Math.max(probe, q));
      let h = `<svg viewBox="0 0 380 190" preserveAspectRatio="xMidYMid meet">${grid.join('')}`;
      h += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="rgba(236,235,227,.22)"/>`;
      h += ticks;
      h += `<path d="M${bx1} ${bracketY + 7}v-7h${Math.max(1, bx2 - bx1)}v7" fill="none" stroke="var(--danger)" stroke-width=".8"/>`;
      h += `<text x="${(bx1 + bx2) / 2}" y="${bracketY - 12}" class="nl-err" text-anchor="middle">|ε| ${nf(err, 4)}</text>`;
      h += `<line x1="${x(probe)}" y1="${top}" x2="${x(probe)}" y2="${bottom}" stroke="var(--paper)" stroke-width=".8" stroke-dasharray="2 2"/>`;
      h += `<circle cx="${x(q)}" cy="${y}" r="3.2" fill="var(--lime)"/><line x1="${x(q)}" y1="${y - 9}" x2="${x(q)}" y2="${y + 9}" stroke="var(--lime)" stroke-width="1"/>`;
      h += `<text x="${x(probe)}" y="${bottom + 15}" class="nl-lbl" text-anchor="middle">x ${nf(probe, 3)}</text>`;
      h += `<text x="${x(q)}" y="${y - 16}" class="nl-lbl hi" text-anchor="middle">q(x) ${nf(qObj.value, 4)}</text>`;
      h += `<text x="${left}" y="20" class="nl-lbl" fill="rgba(236,235,227,.45)">${uniq.length} 个可表示值 / ±${domain}</text>`;
      h += `<text x="${right}" y="20" class="nl-lbl" text-anchor="end" fill="rgba(201,239,106,.6)">${f.label} · ${f.bits} bit</text>`;
      h += `<text x="${left}" y="${bottom + 31}" class="nl-lbl" fill="rgba(236,235,227,.28)">LINEAR SCALE · 舍入到最近可表示值</text>`;
      h += `</svg>`;
      svg.innerHTML = h;
      $('#nl-error').textContent = nf(err, 5);
      $('#nl-errbar').style.width = clamp(err / (domain / 8) * 100, 0, 100) + '%';
      $('#format-facts').innerHTML = `<b>${f.label} · ${f.role}</b>${f.note}`;
    },

    /* ------------------------------------------------------------------ */
    /* matrix lab                                                          */
    renderMatrix() {
      if (!this.derived) return;
      const D = this.derived;
      $$('#mat-c .res-v').forEach((node, idx) => {
        const r = Math.floor(idx / 4), c = idx % 4;
        node.textContent = nf(D.Cq[r][c], 2);
      });
      $$('#mat-a .mcell').forEach((cell, idx) => {
        const r = Math.floor(idx / 4), c = idx % 4;
        const zero = this.s.sparse && !D.Aq.mask[r][c];
        cell.classList.toggle('zero', zero);
        const qv = cell.querySelector('.qval');
        if (qv) qv.textContent = zero ? '→0' : nf(D.Aq.values[r][c], 2);
        cell.title = zero ? '2:4 稀疏：该元素量化后为零' : '点击追踪 A[' + r + '][' + c + ']';
      });
      $$('#mat-b .mcell').forEach((cell, idx) => {
        const r = Math.floor(idx / 4), c = idx % 4;
        const zero = this.s.sparse && !D.Bq.mask[r][c];
        cell.classList.toggle('zero', zero);
        const qv = cell.querySelector('.qval');
        if (qv) qv.textContent = zero ? '→0' : nf(D.Bq.values[r][c], 2);
        cell.title = zero ? '2:4 稀疏：该元素量化后为零' : '点击追踪 B[' + r + '][' + c + ']';
      });
      $('#scale-a').textContent = this.s.precision === 'fp4' ? nf(D.scaleA, 4) : '—';
      $('#scale-b').textContent = this.s.precision === 'fp4' ? nf(D.scaleB, 4) : '—';
      $('#result-error').textContent = nf(D.err.mean, 4);
      const mc = $('#lab-mac');
      if (mc) mc.textContent = D.mac + ' / ' + D.macDense + ' MAC';
      if (!this.s.trace) $('#trace-title').textContent = '实际乘加 ' + D.mac + ' / ' + D.macDense;
      // workload panel sparse note
      const extra = $('.workload-panel .micro');
      if (extra) extra.textContent = `实际乘加 ${D.mac} / ${D.macDense} · 稀疏零元素 ${D.zerosA + D.zerosB} / 32 · 累计读数按演示时间，不代表硬件峰值。`;
    },

    renderTrace() {
      const D = this.derived;
      $$('.mcell').forEach(c => c.classList.remove('traced', 'source'));
      const body = $('#trace-body');
      const title = $('#trace-title');
      if (!body) return;
      if (!this.s.trace) {
        body.innerHTML = '<p class="trace-empty">选中 A、B 中任一元素，追踪它参与的乘加与输出；选中 C 中元素查看一次完整的点积。</p>';
        return;
      }
      const { mat, r, c } = this.s.trace;
      const A = D.Aq.values, Bq = D.Bq.values, C = D.Cq;
      const cellEl = (m, rr, cc) => $(`#mat-${m.toLowerCase()} .mcell[data-r="${rr}"][data-c="${cc}"]`);
      let terms = [];
      let text = '';
      if (mat === 'C') {
        for (let t = 0; t < 4; t++) {
          terms.push({ a: A[r][t], b: Bq[t][c], p: A[r][t] * Bq[t][c], target: `C[${r}][${c}]` });
          const ae = cellEl('A', r, t); if (ae) ae.classList.add('traced');
          const be = cellEl('B', t, c); if (be) be.classList.add('traced');
        }
        const ce = cellEl('C', r, c); if (ce) ce.classList.add('source');
        text = `C[${r}][${c}] = Σ A[${r}][t] × B[t][${c}]`;
      } else if (mat === 'A') {
        for (let k = 0; k < 4; k++) {
          terms.push({ a: A[r][c], b: Bq[c][k], p: A[r][c] * Bq[c][k], target: `C[${r}][${k}]` });
          const ce = cellEl('C', r, k); if (ce) ce.classList.add('traced');
        }
        const ae = cellEl('A', r, c); if (ae) ae.classList.add('source');
        for (let k = 0; k < 4; k++) { const be = cellEl('B', c, k); if (be) be.classList.add('traced'); }
        text = `A[${r}][${c}] 参与 C 第 ${r} 行的四个乘加`;
      } else {
        for (let k = 0; k < 4; k++) {
          terms.push({ a: A[k][r], b: Bq[r][c], p: A[k][r] * Bq[r][c], target: `C[${k}][${c}]` });
          const ce = cellEl('C', k, c); if (ce) ce.classList.add('traced');
        }
        const be = cellEl('B', r, c); if (be) be.classList.add('source');
        for (let k = 0; k < 4; k++) { const ae = cellEl('A', k, r); if (ae) ae.classList.add('traced'); }
        text = `B[${r}][${c}] 参与 C 第 ${c} 列的四个乘加`;
      }
      title.textContent = text;
      const sum = terms.reduce((a, t) => a + t.p, 0);
      body.innerHTML = terms.map(t =>
        `<div class="trace-term"><span>A ${nf(t.a, 3)}</span><i>×</i><span>B ${nf(t.b, 3)}</span><i>=</i><b>${nf(t.p, 3)}</b><em>→ ${t.target}</em></div>`
      ).join('') + `<div class="trace-sum">Σ ${nf(sum, 4)}</div>`;
    },
  });
})();
