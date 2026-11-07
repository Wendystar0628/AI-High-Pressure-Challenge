/* ==========================================================================
   B200 / DIE STUDY — diagrams, chapter choreography and 3D labels
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
  function fadeEl(node, opacity, ty) {
    if (!node) return;
    node.style.opacity = clamp(opacity, 0, 1);
    node.style.visibility = opacity > .01 ? 'visible' : 'hidden';
    if (ty != null) node.style.transform = opacity > .01 ? 'translateY(' + ty + 'px)' : 'translateY(' + (ty + 8) + 'px)';
  }

  Object.assign(proto, {
    /* ------------------------------------------------------------------ */
    /* memory diagrams                                                     */
    _buildChannels() {
      const svg = $('#ch4-channels');
      if (!svg || svg.dataset.built) return;
      svg.dataset.built = '1';
      let h = '';
      h += `<rect x="8" y="18" width="684" height="174" fill="rgba(7,13,17,.5)" stroke="rgba(236,235,227,.08)"/>`;
      h += `<text x="18" y="34" class="ch4v-lbl">LEFT HBM</text><text x="312" y="34" class="ch4v-lbl" text-anchor="middle">DIE A / DIE B</text><text x="676" y="34" class="ch4v-lbl" text-anchor="end">RESULT → HBM</text>`;
      h += `<rect x="92" y="44" width="56" height="132" rx="2" fill="rgba(255,203,112,.06)" stroke="rgba(255,203,112,.25)"/>`;
      for (let i = 0; i < 8; i++) h += `<rect x="98" y="${52 + i * 15}" width="44" height="9" fill="rgba(255,203,112,.12)" stroke="rgba(255,203,112,.26)" stroke-width=".4"/>`;
      h += `<rect x="300" y="44" width="98" height="132" rx="2" fill="rgba(198,239,122,.045)" stroke="rgba(198,239,122,.25)"/>`;
      h += `<rect x="304" y="48" width="44" height="124" fill="rgba(198,239,122,.12)"/>`;
      h += `<rect x="350" y="48" width="44" height="124" fill="rgba(198,239,122,.08)"/>`;
      h += `<line x1="349" y1="48" x2="349" y2="172" stroke="#ff8f6b" stroke-width="1" stroke-dasharray="2 2"/>`;
      h += `<text x="326" y="190" class="ch4v-lbl" text-anchor="middle">D2D ${this.s.seam > .3 ? 'DOWN' : '10 TB/s'}</text>`;
      h += `<rect x="608" y="60" width="56" height="100" fill="rgba(126,217,255,.05)" stroke="rgba(126,217,255,.22)"/>`;
      h += `<text x="636" y="115" class="ch4v-lbl" text-anchor="middle" transform="rotate(-90 636 115)">WRITE BACK</text>`;
      svg.innerHTML = h;
      this._channelFrame = h;
    },

    renderChannels() {
      this._buildChannels();
      const svg = $('#ch4-channels');
      if (!svg) return;
      const f = B.FORMATS[this.s.precision];
      const bytes = f.bytes;
      const count = Math.max(3, Math.min(18, Math.round(16 / Math.max(.5, bytes))));
      const laneW = 56;
      const blockW = Math.max(2.5, Math.min(9, 3 + bytes * 2.4));
      const blockGap = 1.6;
      const span = Math.min(188, count * (blockW + blockGap));
      // remove previous lane layer
      const old = $('.ch4-lanes', svg);
      if (old) old.remove();
      const g = sEl('g', { class: 'ch4-lanes' });
      for (let lane = 0; lane < 8; lane++) {
        const y = 48 + lane * 15;
        g.appendChild(sEl('line', { x1: 152, y1: y + 5, x2: 300, y2: y + 5, stroke: 'rgba(126,217,255,.14)', 'stroke-width': .7 }));
        g.appendChild(sEl('line', { x1: 398, y1: y + 5, x2: 602, y2: y + 5, stroke: 'rgba(126,217,255,.1)', 'stroke-width': .7 }));
        const laneG = sEl('g', { class: 'ch4-lane', 'data-lane': lane });
        for (let b = 0; b < count; b++) {
          const w = blockW;
          const x = 155 + b * (w + blockGap);
          if (x + w > 298) break;
          const color = this.s.precision === 'fp4' ? (b % 16 === 0 ? '#c9ef6a' : '#f2a35e') :
            this.s.precision === 'fp8' ? (b % 8 === 0 ? '#c9ef6a' : '#ffd06a') :
              this.s.precision === 'fp16' || this.s.precision === 'bf16' ? '#7ee0c4' : '#9fe8ff';
          laneG.appendChild(sEl('rect', { x: x, y: y, width: w, height: 8, rx: .7, fill: color, opacity: .5 }));
        }
        g.appendChild(laneG);
        // result lane
        const resG = sEl('g', { class: 'ch4-result-lane', 'data-lane': lane });
        resG.appendChild(sEl('rect', { x: 410, y: y, width: 34 + lane * 2, height: 8, rx: .7, fill: '#7ed9ff', opacity: .2 }));
        resG.appendChild(sEl('rect', { x: 452, y: y + 1, width: 10 + lane, height: 6, fill: '#c9ef6a', opacity: .28 }));
        g.appendChild(resG);
      }
      // glyph: bit fields
      const glyphX = 506, glyphY = 56;
      const total = f.bits;
      const fields = [['s', f.sign, '#c9ef6a'], ['e', f.exp, '#7ed9ff'], ['m', f.mant, '#e7a267']];
      let gx = glyphX;
      fields.forEach(([n, bits, c]) => {
        const w = 54 * bits / total;
        g.appendChild(sEl('rect', { x: gx, y: glyphY, width: Math.max(2, w), height: 13, fill: c, opacity: .3 }));
        if (w > 10) g.appendChild(sEl('text', { x: gx + w / 2, y: glyphY + 10, class: 'ch4v-lbl', 'text-anchor': 'middle' }, bits));
        gx += Math.max(2, w) + 1;
      });
      g.appendChild(sEl('text', { x: glyphX, y: glyphY + 30, class: 'ch4v-lbl' }, f.label + ' · ' + f.bits + ' bit / value'));
      g.appendChild(sEl('text', { x: glyphX, y: glyphY + 44, class: 'ch4v-lbl' }, count + ' VALUES / LANE · 8 LANES'));
      g.appendChild(sEl('text', { x: glyphX, y: glyphY + 58, class: 'ch4v-lbl', fill: 'rgba(201,239,106,.55)' }, this.s.precision === 'fp4' ? '16-VALUE SHARED SCALE' : 'PER-VALUE ENCODING'));
      svg.appendChild(g);
      this._channelLanes = $$('.ch4-lane', svg);
    },

    renderSide() {
      const svg = $('#ch4-side');
      if (!svg) return;
      const f = B.FORMATS[this.s.precision];
      const idx = this.s.selectedStack;
      const open = this.s.stackOpen;
      const gap = open ? 2.2 : .6;
      let h = '';
      h += `<rect x="8" y="8" width="334" height="234" fill="rgba(7,13,17,.45)" stroke="rgba(236,235,227,.08)"/>`;
      h += `<text x="18" y="25" class="ch4v-lbl">STACK ${String(idx + 1).padStart(2, '0')} · SIDE VIEW</text>`;
      h += `<text x="332" y="25" class="ch4v-lbl" text-anchor="end">${f.label} · ${f.bits} BIT</text>`;
      // package substrate
      h += `<rect x="38" y="206" width="274" height="18" fill="rgba(19,36,29,.8)" stroke="rgba(143,170,148,.4)" stroke-width=".7"/>`;
      for (let i = 0; i < 5; i++) h += `<line x1="38" y1="${208 + i * 3.2}" x2="312" y2="${208 + i * 3.2}" stroke="rgba(231,162,103,.22)" stroke-width=".6"/>`;
      // base
      const stackX = 110, stackW = 126;
      let y = 188;
      h += `<rect x="${stackX}" y="${y}" width="${stackW}" height="12" fill="rgba(28,48,40,.9)" stroke="rgba(160,185,154,.5)" stroke-width=".7"/>`;
      h += `<text x="${stackX + stackW + 7}" y="${y + 9}" class="ch4v-lbl">BASE</text>`;
      // layers bottom-up
      for (let i = 0; i < 8; i++) {
        y -= (10 + gap);
        h += `<rect x="${stackX}" y="${y}" width="${stackW}" height="10" fill="rgba(24,37,44,.9)" stroke="rgba(167,197,196,.42)" stroke-width=".7"/>`;
        h += `<line x1="${stackX + 6}" y1="${y + 10}" x2="${stackX + stackW - 6}" y2="${y + 10}" stroke="rgba(231,162,103,.5)" stroke-width=".7" stroke-dasharray="1 2"/>`;
        h += `<text x="${stackX + stackW + 7}" y="${y + 8}" class="ch4v-lbl">D${i}</text>`;
        // micro bumps
        for (let b = 0; b < 7; b++) h += `<circle cx="${stackX + 14 + b * 16}" cy="${y + 12}" r="1.2" fill="rgba(231,162,103,.6)"/>`;
      }
      const top = y;
      // TSVs
      for (let t = 0; t < 4; t++) {
        const x = stackX + 28 + t * 23;
        h += `<line x1="${x}" y1="${top + 1}" x2="${x}" y2="199" stroke="rgba(231,162,103,.8)" stroke-width="1"/>`;
        h += `<circle cx="${x}" cy="${top + 1}" r="1.7" fill="rgba(255,203,112,.9)"/>`;
      }
      h += `<text x="34" y="${top + 12}" class="ch4v-lbl hi">TSV</text><path d="M60 ${top + 8}H${stackX - 2}" stroke="rgba(231,162,103,.5)" stroke-dasharray="2 2"/>`;
      // format grouping glyph on the right
      const gx = 248, gy = 60;
      h += `<text x="${gx}" y="${gy - 4}" class="ch4v-lbl">LOGICAL BLOCK</text>`;
      if (this.s.precision === 'fp4') {
        for (let i = 0; i < 16; i++) h += `<rect x="${gx + (i % 4) * 19}" y="${gy + Math.floor(i / 4) * 19}" width="16" height="16" fill="rgba(242,163,94,.25)" stroke="rgba(242,163,94,.6)" stroke-width=".5"/>`;
        h += `<rect x="${gx + 80}" y="${gy}" width="16" height="16" fill="rgba(201,239,106,.22)" stroke="rgba(201,239,106,.7)" stroke-width=".5"/>`;
        h += `<text x="${gx + 102}" y="${gy + 11}" class="ch4v-lbl hi">1 scale</text>`;
        h += `<text x="${gx + 80}" y="${gy + 32}" class="ch4v-lbl hi">E4M3 s</text>`;
      } else {
        const n = Math.min(16, Math.round(16 / Math.max(.5, f.bytes) / 2));
        for (let i = 0; i < n; i++) h += `<rect x="${gx + (i % 4) * 19}" y="${gy + Math.floor(i / 4) * 19}" width="16" height="16" fill="rgba(126,217,255,.12)" stroke="rgba(126,217,255,.4)" stroke-width=".5"/>`;
        h += `<text x="${gx}" y="${gy + 95}" class="ch4v-lbl">${f.bits} bit / value</text>`;
      }
      h += `<text x="34" y="242" class="ch4v-lbl">SIDE ELEVATION · 层与通孔同步展开</text>`;
      svg.innerHTML = h;
      const note = $('#ch4-side-note');
      if (note) note.textContent = 'STACK ' + String(idx + 1).padStart(2, '0') + (open ? ' · OPEN' : ' · CLOSED');
    },

    /* ------------------------------------------------------------------ */
    /* package diagrams                                                    */
    renderExploded(explodeOverride) {
      const svg = $('#exploded-svg');
      if (!svg) return;
      const e = explodeOverride != null ? explodeOverride : (this.world ? (this.world.currentExplode || 0) : 0);
      const sel = this.s.selectedPart;
      const hi = key => sel === key ? 'style="stroke:#c9ef6a;fill:rgba(201,239,106,.12)"' : '';
      const baseY = 208;
      const subY = baseY - e * 7;
      const intY = 186 - e * 23;
      const dieY = 158 - e * 42;
      const hbmBaseY = 178 - e * 26;
      let h = `<g opacity=".35">${Array.from({ length: 12 }, (_, i) => `<line x1="10" y1="${22 + i * 18}" x2="410" y2="${22 + i * 18}" stroke="rgba(236,235,227,.045)"/>`).join('')}</g>`;
      // solder balls
      for (let i = 0; i < 18; i++) h += `<circle cx="${92 + i * 13}" cy="${subY + 19}" r="3" fill="rgba(181,193,197,.18)" stroke="rgba(181,193,197,.4)" stroke-width=".5"/>`;
      // substrate
      h += `<g ${hi('substrate')}><rect x="78" y="${subY}" width="264" height="16" class="svg-fill-sub"/><line x1="78" y1="${subY + 5}" x2="342" y2="${subY + 5}" stroke="rgba(231,162,103,.3)"/><line x1="78" y1="${subY + 10}" x2="342" y2="${subY + 10}" stroke="rgba(231,162,103,.2)"/></g>`;
      h += `<text x="352" y="${subY + 11}" class="svg-lbl">SUBSTRATE</text>`;
      // stiffener
      h += `<path d="M82 ${subY - 5}h40v5h178v-5h40v-7h-40v5h-178v-5h-40z" fill="rgba(145,154,156,.16)" stroke="rgba(198,208,206,.4)" stroke-width=".7"/>`;
      // interposer
      h += `<g ${hi('interposer')}><rect x="112" y="${intY}" width="196" height="9" class="svg-fill-inter"/></g>`;
      h += `<text x="312" y="${intY + 8}" class="svg-lbl">INTERPOSER</text>`;
      // dies
      [0, 1].forEach(i => {
        const dx = 142 + i * 86;
        h += `<g ${hi('die')}><rect x="${dx}" y="${dieY}" width="76" height="14" class="svg-fill-silicon"/>`;
        for (let k = 0; k < 4; k++) h += `<rect x="${dx + 7 + k * 16}" y="${dieY + 4}" width="12" height="6" fill="rgba(198,239,122,.2)" stroke="rgba(198,239,122,.3)" stroke-width=".3"/>`;
        h += `</g><text x="${dx + 38}" y="${dieY - 7}" class="svg-lbl" text-anchor="middle">DIE ${i ? 'B' : 'A'}</text>`;
        // bumps
        for (let b = 0; b < 5; b++) h += `<circle cx="${dx + 10 + b * 14}" cy="${dieY + 16}" r="1.2" class="svg-bump"/>`;
      });
      // HBM stacks
      [0, 1].forEach(side => {
        const sx = side ? 318 : 44;
        const cnt = 8;
        for (let l = 0; l < cnt; l++) {
          const ly = hbmBaseY - l * (5 + e * 1.7);
          h += `<rect x="${sx}" y="${ly}" width="58" height="5" fill="rgba(36,56,64,.85)" stroke="rgba(150,180,190,.45)" stroke-width=".5"/>`;
          if (l === 0) h += `<text x="${sx + 29}" y="${ly + 22}" class="svg-lbl" text-anchor="middle">HBM ${side ? '05–08' : '01–04'}</text>`;
        }
        h += `<rect x="${sx}" y="${hbmBaseY + 6}" width="58" height="7" fill="rgba(35,46,35,.8)" stroke="rgba(140,160,130,.4)" stroke-width=".5"/>`;
        h += `<line x1="${sx + 15}" y1="${hbmBaseY + 6}" x2="${sx + 15}" y2="${hbmBaseY - 8 * (5 + e * 1.7) + 8}" stroke="rgba(231,162,103,.55)" stroke-width=".7" stroke-dasharray="2 2"/>`;
      });
      h += `<text x="70" y="${hbmBaseY - 8 * (5 + e * 1.7) - 10}" class="svg-lbl">TSV</text>`;
      // leader lines and labels
      h += `<line x1="70" y1="${dieY + 7}" x2="24" y2="${dieY + 7}" stroke="rgba(201,239,106,.5)" stroke-width=".6"/><text x="8" y="${dieY + 10}" class="svg-lbl hi">DIE ×2</text>`;
      h += `<line x1="374" y1="${hbmBaseY - 20}" x2="398" y2="${hbmBaseY - 20}" stroke="rgba(255,203,112,.5)" stroke-width=".6"/><text x="386" y="${hbmBaseY - 24}" class="svg-lbl">HBM</text>`;
      h += `<text x="10" y="238" class="svg-lbl">EXPLODE ${Math.round(e * 100)}% · SCHEMATIC SIDE VIEW</text>`;
      // dimension ticks
      h += `<line x1="48" y1="${subY + 2}" x2="48" y2="${dieY}" stroke="rgba(236,235,227,.18)" stroke-width=".5"/><text x="38" y="${(subY + dieY) / 2}" class="svg-lbl" transform="rotate(-90 38 ${(subY + dieY) / 2})">≈ 2 mm</text>`;
      svg.innerHTML = h;
      const note = $('#explode-fig-note');
      if (note) note.textContent = '随三维同步 · ' + Math.round(e * 100) + '%';
    },

    renderXsec() {
      const svg = $('#xsec-svg');
      if (!svg) return;
      const cut = this.s.cut / 100;
      const z = lerp(-5, 5, cut);
      const inHBM = Math.abs(Math.abs(z) - 2.55) < .65;
      const inDie = Math.abs(z) < 1.45;
      const f = B.FORMATS[this.s.precision];
      const sx = v => 44 + (v + 5.8) / 11.6 * 672;
      let h = `<rect x="8" y="8" width="744" height="234" fill="rgba(7,13,17,.4)" stroke="rgba(236,235,227,.07)"/>`;
      // substrate layers
      for (let i = 0; i < 6; i++) {
        h += `<rect x="${sx(-5.9)}" y="${196 + i * 5}" width="${sx(5.9) - sx(-5.9)}" height="4.2" fill="${i % 2 ? 'rgba(19,36,29,.85)' : 'rgba(45,38,25,.72)'}" stroke="rgba(231,162,103,.18)" stroke-width=".4"/>`;
      }
      // balls
      for (let i = 0; i < 34; i++) h += `<circle cx="${62 + i * 19}" cy="231" r="2.5" class="svg-fill-ball"/>`;
      // stiffener
      h += `<rect x="${sx(-5.7)}" y="182" width="${sx(-4.45) - sx(-5.7)}" height="14" fill="rgba(140,150,152,.18)" stroke="rgba(200,208,206,.35)" stroke-width=".5"/>`;
      h += `<rect x="${sx(4.45)}" y="182" width="${sx(5.7) - sx(4.45)}" height="14" fill="rgba(140,150,152,.18)" stroke="rgba(200,208,206,.35)" stroke-width=".5"/>`;
      // caps
      for (let i = 0; i < 10; i++) h += `<rect x="${sx(-5.4) + i * 16}" y="${190 + (i % 2) * 4}" width="8" height="5" fill="rgba(196,174,112,.35)"/>`;
      // interposer
      if (Math.abs(z) < 3.5) {
        h += `<rect x="${sx(-4.55)}" y="176" width="${sx(4.55) - sx(-4.55)}" height="7" fill="rgba(66,53,38,.8)" stroke="rgba(210,160,100,.5)" stroke-width=".5"/>`;
      }
      // dies
      if (inDie) {
        [-2.02, 2.02].forEach((cx, i) => {
          h += `<rect x="${sx(cx - 1.8)}" y="152" width="${sx(cx + 1.8) - sx(cx - 1.8)}" height="17" fill="rgba(49,65,77,.75)" stroke="rgba(140,168,185,.6)" stroke-width=".6"/>`;
          h += `<line x1="${sx(cx - 1.6)}" y1="160" x2="${sx(cx + 1.6)}" y2="160" stroke="rgba(198,239,122,.3)" stroke-dasharray="2 2"/>`;
          h += `<text x="${sx(cx)}" y="148" class="svg-lbl" text-anchor="middle">DIE ${i ? 'B' : 'A'}</text>`;
          for (let b = 0; b < 9; b++) h += `<circle cx="${sx(cx - 1.5 + b * .37)}" cy="172" r="1.2" class="svg-bump"/>`;
        });
        h += `<line x1="${sx(0)}" y1="152" x2="${sx(0)}" y2="169" stroke="#ff8f6b" stroke-width="1" stroke-dasharray="2 2"/>`;
      }
      // HBM
      if (inHBM) {
        [-2.55, 2.55].forEach((zz, side) => {
          for (let sideX = 0; sideX < 2; sideX++) {
            const cx = (sideX ? 4.1 : 1.38) * (side ? 1 : -1);
            const x = sx(cx - .72), w = sx(cx + .72) - sx(cx - .72);
            for (let l = 0; l < 9; l++) {
              h += `<rect x="${x}" y="${112 - l * 8}" width="${w}" height="7" fill="rgba(30,45,53,.82)" stroke="rgba(160,185,195,.45)" stroke-width=".4"/>`;
            }
            h += `<line x1="${x + w * .35}" y1="112" x2="${x + w * .35}" y2="50" stroke="rgba(231,162,103,.8)" stroke-width=".9"/>`;
            h += `<text x="${x + w / 2}" y="104" class="svg-lbl" text-anchor="middle" transform="rotate(-90 ${x + w / 2} 104)">HBM3e</text>`;
          }
        });
      }
      // cut plane marker on a small top view
      const insetX = 620, insetY = 30, insetW = 118, insetH = 78;
      h += `<g opacity=".9"><rect x="${insetX}" y="${insetY}" width="${insetW}" height="${insetH}" fill="rgba(8,14,18,.8)" stroke="rgba(236,235,227,.2)" stroke-width=".5"/>`;
      h += `<rect x="${insetX + 14}" y="${insetY + 16}" width="${insetW - 28}" height="${insetH - 32}" fill="rgba(255,255,255,.025)" stroke="rgba(236,235,227,.18)" stroke-width=".4"/>`;
      h += `<line x1="${insetX + 14}" y1="${insetY + 16 + (z + 5) / 10 * (insetH - 32)}" x2="${insetX + insetW - 14}" y2="${insetY + 16 + (z + 5) / 10 * (insetH - 32)}" stroke="#ff7d64" stroke-width=".8" stroke-dasharray="2 2"/>`;
      h += `<text x="${insetX + 8}" y="${insetY + 11}" class="svg-lbl">CUT / TOP VIEW</text>`;
      h += `<text x="${insetX + 8}" y="${insetY + insetH - 6}" class="svg-lbl">z = ${z >= 0 ? '+' : ''}${z.toFixed(2)}</text></g>`;
      h += `<text x="20" y="26" class="svg-lbl hi">SECTION @ z = ${z >= 0 ? '+' : ''}${z.toFixed(2)}</text>`;
      h += `<text x="20" y="40" class="svg-lbl">${inDie ? 'DIES PRESENT' : 'NO DIE AT THIS DEPTH'} · ${inHBM ? 'HBM PRESENT' : 'NO HBM'}</text>`;
      h += `<line x1="${sx(-5.9)}" y1="244" x2="${sx(5.9)}" y2="244" stroke="rgba(236,235,227,.18)" stroke-width=".6"/>`;
      h += `<text x="${sx(-5.9)}" y="239" class="svg-lbl">-5.8 mm</text><text x="${sx(5.9)}" y="239" class="svg-lbl" text-anchor="end">+5.8 mm</text>`;
      h += `<text x="752" y="239" class="svg-lbl" text-anchor="end">${f.label} · ${f.bits} BIT LOGICAL BLOCK</text>`;
      svg.innerHTML = h;
      const note = $('#xsec-note');
      if (note) note.textContent = 'CUT ' + this.s.cut + '% · z=' + z.toFixed(2);
    },

    /* ------------------------------------------------------------------ */
    /* chapter choreography                                                */
    _updatePackageChapter(view) {
      const t = Math.max(0, view.time);
      const intro = Math.max(smooth(ramp(t, 0, 2.8)), smooth(ramp(view.p, .002, .02)));
      const n = Math.round(208e9 * intro);
      $('#transistor-count').textContent = n.toLocaleString('en-US');
      // hero svg slow rotation
      const rings = this._heroRings || [];
      rings.forEach((r, i) => {
        const a = t * (i % 2 ? -.004 : .006) + i * .3;
        r.setAttribute('transform', `rotate(${a * 57.3} 760 360)`);
      });
      const cells = this._heroCells || [];
      const beat = t * .35;
      const converge = smooth(ramp(view.p, .02, .108));
      cells.forEach((c, i) => {
        if (!c._base) {
          c._base = {
            x: parseFloat(c.getAttribute('x')), y: parseFloat(c.getAttribute('y')),
            w: parseFloat(c.getAttribute('width')), h: parseFloat(c.getAttribute('height'))
          };
        }
        const b = c._base;
        const die = +c.dataset.die;
        const centerX = die ? 880 : 640;
        const x = lerp(b.x, centerX - 18 + (b.x - centerX) * .45, converge * .8);
        const y = lerp(b.y, 360 - 105 + (b.y - 360) * .72, converge * .8);
        c.setAttribute('x', x.toFixed(2));
        c.setAttribute('y', y.toFixed(2));
        c.setAttribute('width', (b.w * (1 - converge * .42)).toFixed(2));
        c.setAttribute('height', (b.h * (1 - converge * .42)).toFixed(2));
        if (i % 7 === 0) {
          c.setAttribute('opacity', (0.22 + 0.62 * (0.5 + 0.5 * Math.sin(beat + (+c.dataset.r) * .7 + (+c.dataset.c) * .3))).toFixed(2));
        }
      });
      const dies = $$('#hero-svg .hero-die');
      dies.forEach((d, i) => {
        const sep = 120 + 32 * converge;
        d.setAttribute('x', 760 + (i ? sep : -sep) - 100);
      });
    },

    _updateAnatomyChapter(view) {
      const e = view.chapter.id === 'anatomy' ? Math.min(view.detail ? .32 : 1, smooth(ramp(view.u, .10, .57))) : (this.world ? (this.world.currentExplode || 0) : 0);
      const pct = Math.round(e * 100);
      $('#explode-readout').textContent = String(pct).padStart(2, '0') + '%';
      $('#explode-fill').style.width = pct + '%';
      if (this._lastExplode == null || Math.abs(e - this._lastExplode) > .004 || this._lastSel !== this.s.selectedPart) {
        this.renderExploded(e);
        this._lastExplode = e;
        this._lastSel = this.s.selectedPart;
      }
      if (this._lastCut !== this.s.cut) {
        this.renderXsec();
        this._lastCut = this.s.cut;
      }
      $('#cut-out').textContent = this.s.cut + '%';
      $('#xsec-note').textContent = 'CUT ' + this.s.cut + '%';
      const d = this.s.detail;
      $('.ch02').classList.toggle('detail-open', !!d);
      if (d) {
        $('#detail-panel').hidden = false;
        const key = d === 'hbm' ? 'hbm' : d === 'die' ? 'die' : 'sub';
        if (this._lastDetail !== key || this._detailFormat !== this.s.precision) {
          this.renderDetail();
          this._lastDetail = key;
          this._detailFormat = this.s.precision;
        }
      } else {
        $('#detail-panel').hidden = true;
      }
      // hide some annotation labels in deep view
      if (this.labels) this.labels.forEach(L => { if (L.def.ch === 2) L.hiddenByDetail = !!d; });
    },

    _updateSeamChapter(view) {
      const st = this.s;
      let phase;
      if (st.commReplayStart != null) phase = clamp((view.time - st.commReplayStart) / 3.6, 0, 1);
      else phase = smooth(ramp(view.u, .03, .92));
      st.commPhase = phase;
      const broken = st.seam > .30;
      const active = st.activeRegions;
      const computeOn = active.compute !== false;
      const activeCount = computeOn ? Math.round(24 + 24 * phase) : 0;
      const ta = $('#t-active'); if (ta) ta.textContent = activeCount;
      const lat = $('#t-lat'); if (lat) lat.textContent = broken ? '—' : (4.7 + Math.sin(phase * 8) * .2).toFixed(1);
      // map pulses
      (this._mapPulses || []).forEach((p, i) => {
        if (broken || active.d2d === false) { p.setAttribute('opacity', 0); return; }
        const ph = ((phase * 1.7 + i * .22) % 1);
        const x = 247 + ph * 66;
        p.setAttribute('cx', x);
        p.setAttribute('cy', (102 + i * 16 + Math.sin(phase * 9 + i) * 2).toFixed(1));
        p.setAttribute('opacity', (.1 + .85 * Math.sin(ph * Math.PI)).toFixed(2));
      });
      // sparkline bars
      let spark = $('#ch3-spark');
      if (spark && !spark.dataset.built) {
        spark.dataset.built = '1';
        spark.innerHTML = Array.from({ length: 24 }, (_, i) => `<i style="left:${i * 4.1}%;height:${20}%"></i>`).join('');
      }
      if (spark) {
        $$('i', spark).forEach((b, i) => {
          const v = broken ? .06 : 0.18 + 0.62 * Math.abs(Math.sin(view.time * 1.2 + i * .6)) * (.4 + .6 * phase);
          b.style.height = (v * 100) + '%';
        });
      }
      // pulse log
      let log = $('#pulse-log p');
      if (log) {
        let msg;
        if (broken) msg = '链路断开 · 数据停在接缝两侧';
        else if (phase < .12) msg = 'D2D 链路建立 · 等待批次';
        else if (phase < .4) msg = 'L2 → D2D：2.6 MB 批次写入';
        else if (phase < .72) msg = '跨缝传输 · ' + (10 * phase).toFixed(1) + ' TB/s';
        else msg = '两侧计算簇同步 · 一颗 GPU';
        if (log.textContent !== msg) log.textContent = msg;
      }
      const tstate = $('#t-state');
      if (tstate) { tstate.textContent = broken ? 'DOWN' : 'UP'; tstate.classList.toggle('down', broken); }
      const tstate2 = $('#t-state2'); if (tstate2) tstate2.textContent = broken ? 'DISCONNECTED' : 'LINKED';
      const tdd = $('#t-d2d'); if (tdd) tdd.textContent = broken ? '0.0' : '10.0';
      const replay = $('#comm-replay');
      if (replay) replay.innerHTML = (st.commReplayStart != null && phase < 1) ? '重放中… <span>◌</span>' : '重放通信 <span>↻</span>';
      // update labels positions after world; handled separately
      this.renderTechDetail();
    },

    _updateMemoryChapter(view) {
      const u = view.u;
      const st = this.s;
      const lens = $('#lens');
      if (lens) lens.hidden = !(st.lensOn && view.chapter.id === 'memory');
      const cursor = $('#ch4-cursor');
      if (cursor) cursor.style.left = (u * 100).toFixed(2) + '%';
      const trackNode = document.querySelector('.ch4-track');
      if (trackNode) trackNode.setAttribute('aria-valuenow', String(Math.round(u * 100)));
      const stationIndex = u < .36 ? 0 : u < .72 ? 1 : 2;
      ['.s-left', '.s-mid', '.s-right'].forEach((sel, i) => {
        const node = $('.ch04 ' + sel);
        if (!node) return;
        const boundary = i === 0 ? 1 - smooth(ramp(u, .30, .38)) : i === 1 ? smooth(ramp(u, .30, .38)) * (1 - smooth(ramp(u, .66, .74))) : smooth(ramp(u, .66, .74));
        const op = i === 0 ? Math.min(1, boundary) : (i === 1 ? Math.min(1, boundary) : Math.min(1, boundary));
        node.style.opacity = op.toFixed(3);
        node.style.transform = 'translateY(' + ((1 - op) * 10).toFixed(1) + 'px)';
        node.style.pointerEvents = op > .55 ? 'auto' : 'none';
        node.classList.toggle('focus', i === stationIndex);
      });
      // channel motion
      const lanes = this._channelLanes || [];
      lanes.forEach((g, i) => {
        const off = Math.sin(view.time * .5 + i * .6) * 3;
        g.setAttribute('transform', 'translate(' + off.toFixed(2) + ',0)');
      });
      // batch replay
      let prog = null;
      if (st.batchStart != null) prog = clamp((view.time - st.batchStart) / 3.2, 0, 1);
      else prog = (view.time * .07) % 1;
      const steps = ['.batch-path span:nth-of-type(1)', '.batch-path span:nth-of-type(2)', '.batch-path span:nth-of-type(3)', '.batch-path span:nth-of-type(4)', '.batch-path span:nth-of-type(5)'];
      const stepIdx = Math.min(4, Math.floor(prog * 5));
      steps.forEach((sel, i) => {
        const n = $(sel);
        if (n) n.classList.toggle('on', i === stepIdx);
      });
      const counter = $('#batch-counter');
      if (counter) counter.textContent = String(Math.min(5, stepIdx + 1)).padStart(2, '0') + ' / 05';
      const rstate = $('#ch4-replay-state');
      if (rstate) rstate.textContent = st.batchStart != null ? (prog >= 1 ? 'COMPLETE' : 'REPLAYING') : 'LOOP / READY';
      if (this._lastStack !== st.selectedStack || this._lastSideFmt !== st.precision || this._lastStackOpen !== st.stackOpen) {
        this.renderSide();
        this._lastStack = st.selectedStack;
        this._lastSideFmt = st.precision;
        this._lastStackOpen = st.stackOpen;
      }
      this._updateLensVisual(view);
    },

    _updateLensVisual(view) {
      const lens = $('#lens');
      if (!lens) return;
      const on = !!(this.s.lensOn && view.chapter && view.chapter.id === 'memory');
      lens.hidden = !on;
      if (on) {
        lens.style.left = (50 + this.s.lensX * 30) + '%';
        lens.style.top = '46%';
      }
      const marker = $('#lens-marker');
      if (marker) marker.setAttribute('transform', 'translate(' + (this.s.lensX * 320) + ',0)');
    },

    _updateNumericsChapter(view) {
      const u = view.u;
      // The 2D lab hands over to the 3D tensor array near the end of the chapter.
      const reveal = smooth(ramp(u, .78, .93));
      const panels = [$('.ch05 .format-rail'), $('.ch05 .bit-panel'), $('.ch05 .ch5-grid')];
      panels.forEach(el => {
        if (!el) return;
        el.style.opacity = (1 - reveal * .94).toFixed(3);
        el.style.pointerEvents = reveal > .55 ? 'none' : 'auto';
      });
      const tensorLabel = $('.ch5-tensor-label');
      if (tensorLabel) {
        tensorLabel.style.opacity = (0.35 + reveal * .65).toFixed(2);
        tensorLabel.style.transform = reveal > .5 ? 'scale(1.35)' : 'scale(1)';
        tensorLabel.style.transformOrigin = 'right bottom';
      }
      const head = $('.ch05 .ch-head');
      if (head) head.style.opacity = (1 - reveal * .55).toFixed(3);
      const narr = u < .16 ? 'fp64' : u < .30 ? 'tf32' : u < .44 ? 'fp16' : u < .58 ? 'bf16' : u < .72 ? 'fp8' : 'fp4';
      if (this.s.narrateFormat !== narr) {
        this.s.narrateFormat = narr;
        $$('#format-rail .fmt-card').forEach(b => b.classList.toggle('narrating', b.dataset.fmt === narr));
        const bf = $('#bit-focus');
        if (bf) bf.textContent = '全页精度 ' + B.FORMATS[this.s.precision].label + ' · 讲解 ' + B.FORMATS[narr].label;
      }
      // scale ladder
      const steps = $$('.ladder span');
      const active = clamp(Math.floor(ramp(u, .02, .98) * 7), 0, 6);
      steps.forEach((s, i) => s.classList.toggle('on', i === active));
      // ops counter
      const ops = this.s.opsTotal || 0;
      const val = ops / 1e15;
      const elb = $('#ops-count');
      if (elb) elb.textContent = val >= 100 ? val.toFixed(1) : val.toFixed(2);
      const unit = $('#ops-unit');
      if (unit) unit.textContent = val >= 1000 ? 'EFLOP' : 'PFLOP';
      // if the format changed externally, all linked visuals are already refreshed by setPrecision
      if (this._lastNarr !== narr) this._lastNarr = narr;
      // Ladder pointer transitions
    },

    _updateScaleChapter(view) {
      const u = view.u;
      const stage = u < .28 ? 0 : u < .46 ? 1 : u < .64 ? 2 : 3;
      if (this._topoStage !== stage) {
        this._topoStage = stage;
        this.renderTopology();
      }
      $$('#platform-tabs button').forEach((b, i) => {
        const on = i === stage;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const shardPanel = $('.shard-panel');
      if (shardPanel) {
        const hidden = stage >= 2;
        shardPanel.style.opacity = hidden ? '.08' : '1';
        shardPanel.style.pointerEvents = hidden ? 'none' : 'auto';
      }
      // left facts
      const facts = [
        { en: 'HGX B200 / BASEBOARD', num: '8', title: '八颗 B200，<br>一块基板。', desc: '八颗 GPU 通过两颗第五代 NVSwitch 形成全互连。它是服务器厂商的 GPU 基板，不含 CPU、机箱与电源。', list: [['GPU', '8 × B200'], ['交换', '2 × NVSwitch'], ['GPU 显存', '1,440 GB'], ['NVLink', '14.4 TB/s']], note: '点击三维 GPU 或下方拓扑节点，两端同步高亮。' },
        { en: 'DGX B200 / SYSTEM', num: '10U', title: '八卡基板，<br>长成一整套系统。', desc: 'DGX B200 在八卡基板之外加入两颗 Xeon 8570、网络卡、存储与六路电源，是一台完整的 AI 服务器。', list: [['GPU 显存', '1,440 GB'], ['系统内存', '2 TB DDR5'], ['NVLink', '14.4 TB/s'], ['最大功耗', '14.3 kW']], note: 'DGX 使用 2 颗 NVSwitch；交换能力与 HGX 基板同一量级。' },
        { en: 'GB200 / SUPERCHIP', num: '2+1', title: '一颗 Grace，<br>两颗 Blackwell。', desc: 'GB200 超级芯片由一颗 Grace CPU 与两颗 B200 通过 900 GB/s NVLink-C2C 连接。它不是八卡基板，也不是机柜。', list: [['GPU', '2 × B200'], ['CPU', '1 × Grace'], ['C2C', '900 GB/s'], ['HBM3e', '384 GB']], note: 'NVL72 由 36 个 GB200 超级芯片组成；请继续向下进入机柜尺度。' },
        { en: 'GB200 NVL72 / RACK', num: '72', title: '一个机柜，<br>一个 NVLink 域。', desc: 'GB200 把一颗 Grace CPU 与两颗 B200 组成超级芯片。NVL72 将 36 个超级芯片装入 18 个计算托盘，再用 9 个交换托盘连接成 72-GPU 域。', list: [['GPU / CPU', '72 / 36'], ['HBM3e', '13.5 TB'], ['NVLink 合计', '130 TB/s'], ['功耗', '约 120 kW']], note: 'GB200 不是八卡基板；NVL72 的 72 指 GPU 数量。' }
      ][stage];
      $('#sf-en').textContent = facts.en;
      $('#sf-num').textContent = facts.num;
      $('#sf-title').innerHTML = facts.title;
      $('#sf-desc').textContent = facts.desc;
      $('#sf-list').innerHTML = facts.list.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
      $('#sf-note').textContent = facts.note;
      // shard phase
      let phase;
      if (this.s.shardRunStart != null) phase = clamp((view.time - this.s.shardRunStart) / 4.5, 0, 1);
      else phase = smooth(ramp(u, .12, .74));
      this.s.shardPhase = phase;
      if (this._lastShardPhase == null || Math.abs(phase - this._lastShardPhase) > .006 || this._lastShardSel !== this.s.selectedGpu) {
        this.renderShard();
        this._lastShardPhase = phase;
        this._lastShardSel = this.s.selectedGpu;
      }
      // hint system
      const info = $('#shard-result span:last-child');
      if (info) info.textContent = phase > .72 ? '每颗 GPU 最终持有' : '等待归约完成';
      // moving dashes visualise link transfer in the 2D topology
      const dashLinks = document.querySelectorAll('#topology-svg .topo-link');
      dashLinks.forEach((l, i) => {
        l.style.strokeDasharray = '3 5';
        l.style.strokeDashoffset = (-view.time * 18 - i * 2.2).toFixed(1) + 'px';
      });
    },

    _updateCompareChapter(view) {
      // product and metric selections are event driven; animate nothing per frame
      if (this._lastProduct !== this.s.selectedProduct) {
        this._syncProductCards();
        this._lastProduct = this.s.selectedProduct;
      }
      if (this._lastMetric !== this.s.selectedMetric) {
        $$('#metric-tabs button').forEach(b => {
          const on = b.dataset.metric === this.s.selectedMetric;
          b.classList.toggle('on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        this.applyMetricHighlight();
        this._lastMetric = this.s.selectedMetric;
      }
    },

    _updateReturnChapter(view) {
      const u = view.u;
      const finale = smooth(ramp(u, .55, .76));
      const fadePanels = 1 - smooth(ramp(u, .70, .84));
      const work = $('.ch8-work'), tech = $('.tech-list'), closing = $('.closing-note');
      if (work) { work.style.opacity = fadePanels; work.style.pointerEvents = fadePanels > .45 ? 'auto' : 'none'; work.style.transform = `translateY(${(1 - fadePanels) * 10}px)`; }
      if (tech) { tech.style.opacity = fadePanels; tech.style.pointerEvents = fadePanels > .45 ? 'auto' : 'none'; }
      if (closing) closing.style.opacity = fadePanels * .9;
      const fin = $('#finale');
      if (fin) {
        fin.style.opacity = finale;
        fin.style.pointerEvents = finale > .5 ? 'auto' : 'none';
        fin.style.transform = `translate(-50%, ${(1 - finale) * 14}px)`;
      }
      // workload stream
      const stream = $('#workload-stream');
      if (stream) {
        const bars = $$('i', stream);
        const t = view.time;
        const w = this.s.workload;
        bars.forEach((b, i) => {
          let v;
          if (w === 'training') v = .2 + .55 * Math.pow(.5 + .5 * Math.sin(t * 1.1 + i * .25), 2) + .2 * Math.sin(t * .35 + i);
          else if (w === 'inference') v = .15 + .7 * (Math.sin(t * 3 + i * 1.7) > .55 ? .8 : .12) + .12 * Math.sin(t * 1.7 + i * .4);
          else v = .35 + .3 * Math.sin(t * .8 + i * .18) + .12 * Math.sin(t * 2.1 - i * .4);
          b.style.height = (clamp(v, .06, 1) * 100) + '%';
          b.style.background = w === 'science' ? 'var(--amber)' : w === 'inference' ? 'var(--cyan)' : 'var(--lime)';
        });
      }
      // readouts update four times per second (approx via time bucket)
      const bucket = Math.floor(view.time * 4);
      if (this._lastWorkBucket !== bucket) {
        this._lastWorkBucket = bucket;
        this.renderWorkload();
        this.renderTechDetail();
      }
      // live precision
      const finp = $('#fin-precision');
      if (finp) finp.textContent = B.FORMATS[this.s.precision].label;
    },

    _updateGlobalFormatBits(view) {
      // narration-only highlight in chapter 5; no global format mutation here
      if (view.chapter.id !== 'numerics') {
        $$('#format-rail .fmt-card').forEach(b => b.classList.remove('narrating'));
      }
    },

    /* ------------------------------------------------------------------ */
    /* 3D labels                                                           */
    renderLabelsForChapter(chNum, view) {
      // kept as a hook for selection changes; positioning happens in updateLabels
      if (!this.labels) return;
      this.labels.forEach(L => {
        const on = L.def.ch === chNum;
        L.node.classList.toggle('on', false);
        if (!on) L.node.style.opacity = 0;
      });
    },

    _updatePlanOverlay(world, view) {
      const g = this._planOverlay;
      if (!g) return;
      const p = view.p;
      const op = smooth(ramp(p, .301, .316)) * (1 - smooth(ramp(p, .342, .362)));
      g.style.opacity = op.toFixed(3);
      g.style.display = op > .01 ? '' : 'none';
      if (op <= .01) return;
      const a = world.projectDieQuad(0), b = world.projectDieQuad(1);
      if (!a || !b) return;
      const poly = pts => pts.map(q => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ');
      this._planPolys[0].setAttribute('points', poly(a));
      this._planPolys[1].setAttribute('points', poly(b));
      // inner-edge seam (die A right side -> die B left side)
      const seamA = [a[1], a[2]], seamB = [b[0], b[3]];
      this._planSeam[0].setAttribute('x1', seamA[0].x); this._planSeam[0].setAttribute('y1', seamA[0].y);
      this._planSeam[0].setAttribute('x2', seamB[0].x); this._planSeam[0].setAttribute('y2', seamB[0].y);
      this._planSeam[1].setAttribute('x1', seamA[1].x); this._planSeam[1].setAttribute('y1', seamA[1].y);
      this._planSeam[1].setAttribute('x2', seamB[1].x); this._planSeam[1].setAttribute('y2', seamB[1].y);
      const ca = [(a[0].x + a[2].x) / 2, (a[0].y + a[2].y) / 2];
      const cb = [(b[0].x + b[2].x) / 2, (b[0].y + b[2].y) / 2];
      this._planLabels[0].setAttribute('x', ca[0]); this._planLabels[0].setAttribute('y', ca[1]);
      this._planLabels[1].setAttribute('x', cb[0]); this._planLabels[1].setAttribute('y', cb[1]);
      this._planNote.setAttribute('x', (seamA[0].x + seamB[0].x) / 2);
      this._planNote.setAttribute('y', seamA[0].y - 14);
      this._planNote.setAttribute('text-anchor', 'middle');
    },

    updateLabels(world, view) {
      if (!world || !this.labels) return;
      this._updatePlanOverlay(world, view);
      const chNum = view.chapter.index + 1;
      const labelsRoot = document.getElementById('labels');
      if (labelsRoot) labelsRoot.style.zIndex = chNum === 6 ? 40 : 12;
      const W = window.innerWidth, H = window.innerHeight;
      const detail = this.s.detail;
      const now = view.time;
      const doOcclusion = view.export || (now - this._lastLabelCheck > .13);
      if (doOcclusion) this._lastLabelCheck = now;
      this.labels.forEach(L => {
        const d = L.def;
        const active = d.ch === chNum;
        const stageOk = d.stage == null || d.ch !== 6 || this._topoStage === d.stage;
        if (!active || !stageOk || chNum === 1 || (chNum === 2 && (!d.part || d.part !== this.s.selectedPart)) || (chNum === 2 && detail)) {
          L.node.classList.remove('on', 'occluded', 'active');
          L.node.style.opacity = 0;
          L.path.style.opacity = 0; L.elbow.style.opacity = 0; L.dot.style.opacity = 0;
          return;
        }
        const a = world.anchorScreen(d.keys);
        if (!a || !a.visible) {
          L.node.classList.remove('on'); L.node.style.opacity = 0;
          L.path.style.opacity = 0; L.elbow.style.opacity = 0; L.dot.style.opacity = 0;
          return;
        }
        if (doOcclusion) L.occ = chNum === 6 ? false : world.anchorOccluded(d.keys);
        const sx = clamp(W / 1440, .7, 1.35), sy = clamp(H / 900, .7, 1.3);
        let x = a.x + d.off[0] * sx;
        let y = a.y + d.off[1] * sy;
        const nw = 150 * sx, nh = 38 * sy;
        x = clamp(x, 108, W - nw - 14);
        y = clamp(y, 86, H - nh - 56);
        const attachLeft = d.off[0] >= 0;
        const ex = attachLeft ? x : x + nw;
        const ey = y + nh / 2;
        L.node.style.left = x + 'px';
        L.node.style.top = y + 'px';
        L.node.style.transform = 'translate(0,0)';
        L.node.classList.add('on');
        L.node.classList.toggle('compact', chNum === 8 || chNum === 6);
        L.node.classList.toggle('occluded', !!L.occ);
        const isActive = (chNum === 2 && d.part && d.part === this.s.selectedPart) ||
          (chNum === 8 && d.tech != null && d.tech === this.s.tech) ||
          (chNum === 1 && false);
        L.node.classList.toggle('active', isActive);
        const dim = L.occ ? .3 : (isActive ? 1 : .74);
        L.node.style.opacity = dim;
        // leader path: anchor -> elbow -> label
        const adx = a.x, ady = a.y;
        const midX = attachLeft ? ex - 16 : ex + 16;
        L.path.setAttribute('d', `M${adx} ${ady} L${midX} ${ady} L${midX} ${ey} L${ex} ${ey}`);
        L.path.classList.toggle('occluded', !!L.occ);
        L.path.style.opacity = L.occ ? .25 : .9;
        L.elbow.setAttribute('d', `M${midX} ${ey} L${ex} ${ey}`);
        L.elbow.style.opacity = L.occ ? .12 : .45;
        L.dot.setAttribute('cx', adx); L.dot.setAttribute('cy', ady);
        L.dot.classList.toggle('occluded', !!L.occ);
        L.dot.style.opacity = L.occ ? .35 : 1;
      });
    },

    _bindGlobal() {
      // Add any cross-cutting keyboard affordances here. Main owns global shortcuts.
      this._lastProduct = this.s.selectedProduct;
      this._lastMetric = this.s.selectedMetric;
    },

    _updateMemorySide() {}
  });
})();
