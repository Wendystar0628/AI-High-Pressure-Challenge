// TeX -> MathML Core for the reading pages: the formulas of the about page and
// of the task statements (题干). No DOM and no imports, so it also runs in Node.
//
//   tex('\\frac{a}{b}')        inline <math>
//   tex('\\sum_i x_i', true)   display <math display="block">
//
// Covers what the site's text uses: fractions, roots, binomials, scripts and
// limits, big operators, \left…\right and \big fences, matrices and cases,
// \substack, \pmod, \text / \mathrm / \operatorname, the letter styles
// \mathbb \mathcal \mathsf \mathbf \mathit \mathfrak, Greek letters, the usual
// relations, arrows and set symbols, and spacing. An unknown command shows as
// itself in an <mtext class="tex-unknown"> so a gap is easy to spot.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ',
  varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
};
// upright, as TeX sets capital Greek
const GREEK_UP = { Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };
// ordinary symbols (identifiers)
const ORD = {
  infty: '∞', ell: 'ℓ', partial: '∂', nabla: '∇', emptyset: '∅', varnothing: '∅', hbar: 'ℏ', aleph: 'ℵ', Re: 'ℜ', Im: 'ℑ',
  forall: '∀', exists: '∃', nexists: '∄', top: '⊤', bot: '⊥', triangle: '△', angle: '∠', prime: '′', imath: 'ı', jmath: 'ȷ',
  '#': '#', '%': '%', '&': '&', $: '$', _: '_',
};
// operators, relations, arrows, punctuation
const OP = {
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', subsetneq: '⊊', cup: '∪', cap: '∩',
  setminus: '∖', to: '→', gets: '←', mapsto: '↦', rightarrow: '→', leftarrow: '←', longrightarrow: '⟶', longleftarrow: '⟵',
  Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', leftrightarrow: '↔', iff: '⟺', implies: '⟹', uparrow: '↑', downarrow: '↓',
  ne: '≠', neq: '≠', le: '≤', leq: '≤', ge: '≥', geq: '≥', lt: '<', gt: '>', ll: '≪', gg: '≫', equiv: '≡', approx: '≈', sim: '∼',
  simeq: '≃', cong: '≅', propto: '∝', perp: '⊥', parallel: '∥', times: '×', cdot: '⋅', div: '÷', circ: '∘', bullet: '∙',
  ast: '∗', star: '⋆', pm: '±', mp: '∓', oplus: '⊕', ominus: '⊖', otimes: '⊗', wedge: '∧', land: '∧', vee: '∨', lor: '∨',
  neg: '¬', lnot: '¬', ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱', dotsc: '…', dotsb: '⋯',
};
// operators that can stretch, set as ordinary-size unless \left, \right or \big asks
const FENCE = { '(': '(', ')': ')', '[': '[', ']': ']', '|': '|', '\\{': '{', '\\}': '}', '\\|': '‖', '.': '' };
const FENCE_CMD = { lbrace: '{', rbrace: '}', langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', vert: '|', Vert: '‖', lvert: '|', rvert: '|', lVert: '‖', rVert: '‖', mid: '∣' };
const DOTS = ['ldots', 'dots', 'cdots', 'vdots', 'ddots', 'dotsc', 'dotsb'];
const BIG_SIZE = { big: null, Big: '1.623em', bigg: '2.047em', Bigg: '2.470em' };
// function names: upright, a thin space before what follows unless it is a bracket
const FN = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'exp', 'dim', 'ker', 'deg', 'det', 'gcd', 'hom', 'arg', 'Pr'];
// names whose limits go under them in display style
const LIM_FN = ['lim', 'liminf', 'limsup', 'sup', 'inf', 'max', 'min'];
// big operators: limits under and over in display style, beside in text
const BIG_OP = { sum: '∑', prod: '∏', coprod: '∐', bigoplus: '⨁', bigotimes: '⨂', bigcup: '⋃', bigcap: '⋂', bigvee: '⋁', bigwedge: '⋀', bigsqcup: '⨆' };
const INT = { int: '∫', iint: '∬', iiint: '∭', oint: '∮' };
const SPACE = { quad: '1em', qquad: '2em', ',': '0.1667em', thinspace: '0.1667em', ':': '0.2222em', '>': '0.2222em', medspace: '0.2222em', ';': '0.2778em', thickspace: '0.2778em', ' ': '0.25em', enspace: '0.5em' };
const ACCENT = { bar: '‾', overline: '‾', hat: '^', widehat: '^', tilde: '~', widetilde: '~', vec: '→', dot: '˙', ddot: '¨' };
// letter styles as Unicode mathematical alphanumerics (MathML Core has no mathvariant beyond "normal")
const STYLE = {
  mathbb: { A: 0x1d538, a: 0x1d552, d: 0x1d7d8, x: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' } },
  mathcal: { A: 0x1d49c, a: 0x1d4b6, x: { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' } },
  mathsf: { A: 0x1d5a0, a: 0x1d5ba, d: 0x1d7e2 },
  mathbf: { A: 0x1d400, a: 0x1d41a, d: 0x1d7ce },
  mathit: { A: 0x1d434, a: 0x1d44e, x: { h: 'ℎ' } },
  mathfrak: { A: 0x1d504, a: 0x1d51e, x: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' } },
};
STYLE.mathscr = STYLE.mathcal;
STYLE.boldsymbol = STYLE.bm = STYLE.mathbf;
const ENV = { matrix: ['', ''], pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', ''], aligned: ['', ''], array: ['', ''] };

function styled(style, text) {
  const m = STYLE[style];
  return [...text]
    .map((c) => {
      if (m.x?.[c]) return m.x[c];
      if (c >= 'A' && c <= 'Z') return String.fromCodePoint(m.A + c.charCodeAt(0) - 65);
      if (c >= 'a' && c <= 'z' && m.a) return String.fromCodePoint(m.a + c.charCodeAt(0) - 97);
      if (c >= '0' && c <= '9' && m.d) return String.fromCodePoint(m.d + c.charCodeAt(0) - 48);
      return c;
    })
    .join('');
}

/** The character a symbol command stands for ('' when it has none): texSymbol('le') -> '≤'. For plain-text readouts. */
export function texSymbol(name) {
  return GREEK[name] ?? GREEK_UP[name] ?? ORD[name] ?? OP[name] ?? BIG_OP[name] ?? INT[name] ?? FENCE_CMD[name] ?? (FN.includes(name) || LIM_FN.includes(name) ? name : '');
}

const node = (m, o = {}) => ({ m, ...o });
const row = (items) => (items.length === 1 ? items[0].m : `<mrow>${items.map((x) => x.m).join('')}</mrow>`);
const mo = (c, attrs = '') => `<mo${attrs}>${esc(c)}</mo>`;
const UNI_OP = /[−+×÷±∓≤≥≠≈≡∼→←↦⇒⇔∈∉⊂⊆∪∩∖∧∨¬⊕⊗∘⋅·…⋯∣∥]/;

export function tex(src, display = false) {
  const s = String(src ?? '').replace(/\s+/g, ' ').trim();
  let i = 0;
  const ws = () => {
    while (s[i] === ' ') i++;
  };
  // a stop like "\right" must not match "\rightarrow"
  const at = (x) => s.startsWith(x, i) && !(/^\\[a-z]+$/i.test(x) && /[a-zA-Z]/.test(s[i + x.length] ?? ''));

  /** Command name after a backslash at i (i moves past it). */
  function name() {
    i++; // backslash
    if (/[a-zA-Z]/.test(s[i] ?? '')) {
      let n = '';
      while (/[a-zA-Z]/.test(s[i] ?? '')) n += s[i++];
      return n;
    }
    return s[i++] ?? '';
  }

  /** The raw text of a {group}, or one character / command name. */
  function rawArg() {
    ws();
    if (s[i] === '{') {
      let depth = 0;
      const start = i + 1;
      for (; i < s.length; i++) {
        if (s[i] === '\\') {
          i++;
          continue;
        }
        if (s[i] === '{') depth++;
        else if (s[i] === '}' && --depth === 0) break;
      }
      const v = s.slice(start, i);
      i++;
      return v;
    }
    if (s[i] === '\\') return '\\' + name();
    return s[i++] ?? '';
  }

  /** One argument: a {group}, a command, or a single character (\frac12 is 1 over 2). */
  function arg() {
    ws();
    if (s[i] === '{') {
      i++;
      const items = seq(['}']);
      i++;
      return node(row(items.length ? items : [node('<mrow></mrow>')]));
    }
    if (s[i] === '\\') return atom();
    const c = s[i++];
    if (c == null) return node('<mrow></mrow>');
    if (/[0-9]/.test(c)) return node(`<mn>${c}</mn>`);
    return single(c);
  }

  /** A fence delimiter after \left, \right, \big…: its character ('' for "."). */
  function delim() {
    ws();
    if (s[i] === '\\') {
      const n = name();
      if (FENCE_CMD[n]) return FENCE_CMD[n];
      return FENCE['\\' + n] ?? '';
    }
    const c = s[i++];
    return FENCE[c] ?? c ?? '';
  }

  function single(c) {
    if (/[a-zA-Z]/.test(c)) return node(`<mi>${c}</mi>`);
    if (c === '-' || c === '+') return node(mo(c === '-' ? '−' : '+'), { kind: 'op', sign: true });
    if (c === '*') return node(mo('∗'), { kind: 'op' });
    if ('(['.includes(c)) return node(mo(c, ' stretchy="false"'), { kind: 'open' });
    if (')]'.includes(c)) return node(mo(c, ' stretchy="false"'), { kind: 'close' });
    // a bar and a full stop are ordinary symbols in TeX: no operator spacing
    if (c === '|' || c === '.') return node(mo(c, ' stretchy="false" lspace="0" rspace="0"'));
    if (c === '/') return node(mo('/', ' stretchy="false" lspace="0" rspace="0"'));
    if (c === '~') return node('<mspace width="0.25em"/>');
    if (c === "'") {
      let n = 1;
      while (s[i] === "'") {
        n++;
        i++;
      }
      return node(mo(['′', '″', '‴'][n - 1] ?? '′'.repeat(n), ' lspace="0" rspace="0"'));
    }
    if (/[㐀-鿿　-〿＀-￯]/.test(c)) {
      let w = c;
      while (s[i] != null && /[㐀-鿿　-〿＀-￯]/.test(s[i])) w += s[i++];
      return node(`<mtext>${esc(w)}</mtext>`);
    }
    if (c === ',' || c === ';') return node(mo(c), { kind: 'punct' });
    if (UNI_OP.test(c) || /[=<>:!?]/.test(c)) return node(mo(c === '·' ? '⋅' : c), { kind: c === '!' || c === '?' ? 'close' : 'op' });
    return node(`<mi>${esc(c)}</mi>`);
  }

  /** \begin{env} … \end{env}: a table, with fences for the matrix kinds and cases. */
  function env(kind) {
    if (kind === 'array') rawArg(); // column spec
    const rows = [];
    let cells = [];
    for (;;) {
      const items = seq(['&', '\\\\', '\\end']);
      cells.push(items);
      if (at('&')) {
        i++;
        continue;
      }
      if (at('\\\\')) {
        i += 2;
        rows.push(cells);
        cells = [];
        continue;
      }
      break;
    }
    if (at('\\end')) {
      i += 4;
      rawArg();
    }
    if (cells.length > 1 || cells[0]?.length) rows.push(cells);
    const left = kind === 'cases' || kind === 'aligned';
    const table = `<mtable${kind === 'cases' ? ' class="tex-cases"' : ''}>${rows
      .map((r) => `<mtr>${r.map((c) => `<mtd${left ? ' style="text-align:left"' : ''}>${row(c.length ? c : [node('<mrow></mrow>')])}</mtd>`).join('')}</mtr>`)
      .join('')}</mtable>`;
    const [l, r] = ENV[kind] ?? ['', ''];
    if (!l && !r) return node(table);
    return node(`<mrow>${l ? mo(l) : ''}${table}${r ? mo(r) : ''}</mrow>`);
  }

  function command() {
    const n = name();
    if (n === 'frac' || n === 'dfrac' || n === 'tfrac' || n === 'cfrac') {
      const a = arg();
      const b = arg();
      const f = `<mfrac>${a.m}${b.m}</mfrac>`;
      return node(n === 'dfrac' ? `<mrow displaystyle="true">${f}</mrow>` : n === 'tfrac' ? `<mrow displaystyle="false">${f}</mrow>` : f);
    }
    if (n === 'binom' || n === 'dbinom' || n === 'tbinom') {
      const a = arg();
      const b = arg();
      return node(`<mrow>${mo('(')}<mfrac linethickness="0">${a.m}${b.m}</mfrac>${mo(')')}</mrow>`);
    }
    if (n === 'sqrt') {
      ws();
      if (s[i] === '[') {
        i++;
        const idx = seq([']']);
        i++;
        return node(`<mroot>${arg().m}${row(idx)}</mroot>`);
      }
      return node(`<msqrt>${arg().m}</msqrt>`);
    }
    if (n === 'text' || n === 'textrm' || n === 'mbox' || n === 'textup') {
      const v = rawArg().replace(/^ | $/g, ' ');
      return node(`<mtext>${esc(v)}</mtext>`);
    }
    if (n === 'mathrm' || n === 'operatorname' || n === 'mathup') {
      const v = rawArg();
      if (/^[A-Za-z0-9]+$/.test(v)) {
        const fn = n === 'operatorname';
        return node(`<mi${v.length === 1 ? ' mathvariant="normal"' : ''}>${esc(v)}</mi>`, { fn });
      }
      return node(`<mtext>${esc(v)}</mtext>`);
    }
    if (STYLE[n]) {
      const v = rawArg();
      if (v.startsWith('\\') && GREEK[v.slice(1)]) return node(`<mi>${GREEK[v.slice(1)]}</mi>`);
      return node(`<mi>${esc(styled(n, v))}</mi>`);
    }
    if (n === 'left') {
      const l = delim();
      const items = seq(['\\right']);
      let r = '';
      if (at('\\right')) {
        i += 6;
        r = delim();
      }
      return node(`<mrow>${l ? mo(l, ' stretchy="true" symmetric="true"') : ''}${items.map((x) => x.m).join('')}${r ? mo(r, ' stretchy="true" symmetric="true"') : ''}</mrow>`);
    }
    if (n === 'right') return node('');
    if (n === 'middle') {
      const d = delim();
      return node(d ? mo(d, ' stretchy="true" symmetric="true"') : '');
    }
    const big = /^(big|Big|bigg|Bigg)([lrm]?)$/.exec(n);
    if (big) {
      const d = delim();
      // \big keeps the font's own size (its next variant would already look like \Big); the larger ones stretch
      const size = BIG_SIZE[big[1]];
      const kind = big[2] === 'l' ? 'open' : big[2] === 'r' ? 'close' : undefined;
      if (!size) return node(d ? mo(d, ' stretchy="false"') : '', { kind });
      return node(d ? mo(d, ` stretchy="true" symmetric="true" minsize="${size}" maxsize="${size}"`) : '', { kind });
    }
    if (n === 'begin') return env(rawArg());
    if (n === 'substack') {
      ws();
      if (s[i] !== '{') return node('');
      i++;
      const lines = [];
      for (;;) {
        lines.push(seq(['\\\\', '}']));
        if (at('\\\\')) {
          i += 2;
          continue;
        }
        i++;
        break;
      }
      return node(`<mtable class="tex-substack">${lines.map((l) => `<mtr><mtd>${row(l.length ? l : [node('<mrow></mrow>')])}</mtd></mtr>`).join('')}</mtable>`);
    }
    if (n === 'pmod' || n === 'mod') {
      const a = arg();
      const body = `<mo lspace="0" rspace="0.3333em">mod</mo>${a.m}`;
      return node(n === 'pmod' ? `<mspace width="1em"/>${mo('(', ' stretchy="false"')}${body}${mo(')', ' stretchy="false"')}` : `<mspace width="0.6667em"/>${body}`);
    }
    if (n === 'bmod') return node('<mo lspace="0.2222em" rspace="0.2222em">mod</mo>');
    if (ACCENT[n]) {
      const a = arg();
      const stretch = n === 'overline' || n.startsWith('wide') ? ' stretchy="true"' : '';
      return node(`<mover accent="true">${a.m}<mo${stretch}>${ACCENT[n]}</mo></mover>`);
    }
    if (n === 'underline') return node(`<munder accentunder="true">${arg().m}<mo stretchy="true">_</mo></munder>`);
    if (n === 'not') {
      const next = atom();
      return node(next?.m.replace(/<mo([^>]*)>([^<]*)<\/mo>/, (m0, a, c) => `<mo${a}>${c}̸</mo>`) ?? '');
    }
    if (n in SPACE) return node(`<mspace width="${SPACE[n]}"/>`);
    if (n === '!' || n === 'displaystyle' || n === 'textstyle' || n === 'limits' || n === 'nolimits' || n === '\\') return node('');
    if (n === 'colon') return node(mo(':', ' lspace="0" rspace="0.2778em"'));
    if (n === 'mid') return node(mo('∣', ' lspace="0.2778em" rspace="0.2778em"'));
    if (n === '{' || n === '}') return node(mo(FENCE['\\' + n], ' stretchy="false"'), { kind: n === '{' ? 'open' : 'close' });
    if (n === '|') return node(mo('‖', ' stretchy="false" lspace="0" rspace="0"'));
    if (FENCE_CMD[n]) return node(mo(FENCE_CMD[n], ' stretchy="false"'));
    if (BIG_OP[n]) return node(mo(BIG_OP[n], ` largeop="true" movablelimits="true"${display ? ' class="rd-bigop"' : ''}`), { limits: true, kind: 'op' });
    if (INT[n]) return node(mo(INT[n], ` largeop="true"${display ? ' class="rd-bigop"' : ''}`));
    if (LIM_FN.includes(n)) return node(`<mo movablelimits="true" lspace="0.1667em" rspace="0.1667em">${n === 'liminf' ? 'lim inf' : n === 'limsup' ? 'lim sup' : n}</mo>`, { limits: true, fn: true });
    if (FN.includes(n)) return node(`<mi>${n}</mi>`, { fn: true });
    if (GREEK[n]) return node(`<mi>${GREEK[n]}</mi>`);
    if (GREEK_UP[n]) return node(`<mi mathvariant="normal">${GREEK_UP[n]}</mi>`);
    if (ORD[n]) return node(`<mi>${esc(ORD[n])}</mi>`);
    // dots are ordinary symbols in TeX: only the commas or operators around them space them
    if (DOTS.includes(n)) return node(mo(OP[n], ' lspace="0" rspace="0"'));
    if (OP[n]) return node(mo(OP[n]), { kind: 'op', sign: n === 'pm' || n === 'mp' });
    return node(`<mtext class="tex-unknown">\\${esc(n)}</mtext>`);
  }

  function atom() {
    ws();
    const c = s[i];
    if (c == null) return null;
    if (c === '{') {
      i++;
      const items = seq(['}']);
      i++;
      return node(row(items.length ? items : [node('<mrow></mrow>')]));
    }
    if (c === '\\') return command();
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let n = '';
      while (/[0-9]/.test(s[i] ?? '') || (s[i] === '.' && /[0-9]/.test(s[i + 1] ?? ''))) n += s[i++];
      return node(`<mn>${n}</mn>`);
    }
    i++;
    return single(c);
  }

  /** Atoms with their scripts until one of the stop strings (not consumed). */
  function seq(stops = []) {
    const out = [];
    for (;;) {
      ws();
      if (i >= s.length || stops.some((x) => at(x))) break;
      const base = atom();
      if (!base) break;
      let sub = null;
      let sup = null;
      for (;;) {
        ws();
        if (s[i] === '_' && !sub) {
          i++;
          sub = arg();
        } else if (s[i] === '^' && !sup) {
          i++;
          sup = arg();
        } else if (s[i] === "'" && !sup) {
          i++;
          let n = 1;
          while (s[i] === "'") {
            n++;
            i++;
          }
          sup = node(`<mo>${['′', '″', '‴'][n - 1] ?? '′'.repeat(n)}</mo>`);
        } else break;
      }
      let m = base.m;
      if (sub || sup) {
        const under = base.limits;
        const tag = under ? (sub && sup ? 'munderover' : sub ? 'munder' : 'mover') : sub && sup ? 'msubsup' : sub ? 'msub' : 'msup';
        m = `<${tag}>${base.m}${sub ? sub.m : ''}${sup ? sup.m : ''}</${tag}>`;
      }
      // a sign at the start, after an opening bracket, an operator or a comma is unary (TeX's rule): no spacing
      const prev = out[out.length - 1];
      if (base.sign && !sub && !sup && (!prev || ['open', 'op', 'punct'].includes(prev.kind))) m = m.replace('<mo', '<mo form="prefix" lspace="0" rspace="0"');
      out.push(node(m, { kind: sub || sup ? 'ord' : base.kind }));
      if (base.fn) {
        // thin space after a function name unless a bracket or nothing follows
        ws();
        if (i < s.length && !/[([|{]/.test(s[i]) && !at('\\left') && !at('\\big') && !at('\\{') && !stops.some((x) => at(x))) out.push(node('<mspace width="0.1667em"/>'));
      }
    }
    return out;
  }

  const body = seq([])
    .map((x) => x.m)
    .join('');
  return `<math${display ? ' display="block"' : ''}>${body}</math>`;
}
