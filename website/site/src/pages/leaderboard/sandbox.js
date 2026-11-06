// 权重沙盘: a strip that opens above the axis bar (W). One slider per
// category, 0–30 in steps of 0.5; the weight used is slider ÷ the sum of all
// sliders. Presets, "恢复官方权重", the sum and the normalised shares.
//   onInput()  while dragging (bars follow, rows stay)
//   onCommit() when a slider is let go (rows re-sort after a short pause)
//   onPreset() when a preset or the reset is pressed
import { h, t, pick, fmtPct } from '../../core/index.js';
import { fill, needsEdge } from '../../charts/index.js';
import { SLIDER, presets, normWeights, sliderSum, isOfficial } from './model.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

export function createSandbox({ data, state, onInput, onCommit, onPreset }) {
  const list = presets(data);
  const chips = list.map((p) =>
    h('button.st-chip.lb-sb-preset', { type: 'button', 'aria-pressed': 'false', dataset: { preset: p.key }, onclick: () => apply(p.sliders) }, t(`leaderboard.sandbox.presets.${p.key}`)),
  );
  const reset = h('button.st-btn.small.lb-sb-reset', { type: 'button', onclick: () => apply(list[0].sliders) }, t('leaderboard.sandbox.reset'));
  const sumOut = h('b.num.lb-sb-sumv');
  const sumNote = h('span.lb-sb-sumnote');
  const mini = h('span.lb-sb-mini', { 'aria-hidden': 'true' }, data.categories.map((c) => h('i', { dataset: { cat: c.key }, style: { '--c': fill.category(c.key) }, class: needsEdge(c.key) ? 'has-edge' : null })));

  const items = data.categories.map((c) => {
    const input = h('input', {
      type: 'range',
      min: SLIDER.min,
      max: SLIDER.max,
      step: SLIDER.step,
      'aria-label': t('leaderboard.sandbox.slider', { name: pick(c, 'name') }),
    });
    const val = h('output.num.lb-sb-val');
    const norm = h('span.num.lb-sb-norm');
    input.addEventListener('input', () => {
      let v = +input.value;
      // never let every weight be zero
      if (sliderSum(data, { ...state.sliders, [c.key]: v }) <= 0) {
        v = SLIDER.step;
        input.value = v;
      }
      state.sliders = { ...state.sliders, [c.key]: v };
      sync();
      onInput?.();
    });
    input.addEventListener('change', () => onCommit?.());
    const el = h(
      'label.lb-sb-item',
      { dataset: { cat: c.key }, style: { '--c': fill.category(c.key) } },
      h('span.lb-sb-name', h('i.lb-sb-sw', { class: needsEdge(c.key) ? 'has-edge' : null, 'aria-hidden': 'true' }), h('span', pick(c, 'short') || pick(c, 'name'))),
      val,
      input,
      norm,
    );
    return { c, input, val, norm, el };
  });

  const el = h(
    'section.lb-sandbox',
    { id: 'lb-sandbox', hidden: true, 'aria-label': t('leaderboard.sandbox.label') },
    h(
      'div.lb-sb-top',
      h('p.st-pair.lb-sb-title', h('span.st-eyebrow', t('leaderboard.sandbox.eyebrow')), h('span', t('leaderboard.sandbox.title'))),
      h('p.lb-sb-help', t('leaderboard.sandbox.help')),
      h('div.lb-sb-presets', { role: 'group', 'aria-label': t('leaderboard.sandbox.presetsLabel') }, chips, reset),
      h('p.lb-sb-sum', h('span.lb-sb-sumlab', t('leaderboard.sandbox.sum')), sumOut, sumNote, mini),
    ),
    h('div.lb-sb-grid', items.map((i) => i.el)),
  );

  function apply(sliders) {
    state.sliders = { ...sliders };
    sync();
    onPreset?.();
  }

  function sync() {
    const norm = normWeights(data, state.sliders);
    const sum = sliderSum(data, state.sliders);
    for (const it of items) {
      const v = +state.sliders[it.c.key] || 0;
      if (+it.input.value !== v) it.input.value = v;
      it.input.style.setProperty('--p', `${((v - SLIDER.min) / (SLIDER.max - SLIDER.min)) * 100}%`);
      it.input.setAttribute('aria-valuetext', `${fmtPct(v)} → ${fmtPct(norm[it.c.key])}`);
      it.val.textContent = fmtPct(v);
      it.norm.textContent = t('leaderboard.sandbox.norm', { v: fmtPct(norm[it.c.key]) });
      it.el.classList.toggle('is-zero', v === 0);
    }
    sumOut.textContent = fmtPct(sum);
    sumNote.textContent = near(sum, 100) ? '' : t('leaderboard.sandbox.sumNote');
    for (const i of mini.children) i.style.flexGrow = String(norm[i.dataset.cat] || 0);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const same = data.categories.every((c) => near(+state.sliders[c.key] || 0, +p.sliders[c.key] || 0));
      chips[i].setAttribute('aria-pressed', String(same));
    }
    reset.disabled = isOfficial(data, state.sliders);
  }

  sync();
  return {
    el,
    sync,
    get open() {
      return !el.hidden;
    },
    setOpen(on) {
      el.hidden = !on;
    },
  };
}
