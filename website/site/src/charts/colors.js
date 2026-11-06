// Colours for charts, read from the --st-* / site CSS variables so both
// themes follow (website/docs/visual.md). In D3 prefer the variable form
// (sel.style('fill', fill.category('reason'))) so a theme switch needs no
// redraw; use the resolved form (resolve('--v-500')) only where a real colour
// value is needed (canvas, computed mixes).

/** var(--x) string for CSS / D3 .style() */
export const v = (name) => `var(${name.startsWith('--') ? name : `--${name}`})`;

/** Resolved value of a CSS variable now, e.g. resolve('--st-ink') -> "#1a1726". */
export function resolve(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name.startsWith('--') ? name : `--${name}`).trim();
}

/** Category fixed colours (visual.md 三). */
export const CATEGORY_VAR = {
  reason: '--cat-reason',
  algo: '--cat-algo',
  spatial: '--cat-spatial',
  interact: '--cat-interact',
  game: '--cat-game',
  physics: '--cat-physics',
  visual: '--cat-visual',
  system: '--cat-system',
};

/** Lime-family fills get a 1px ink edge (light theme). */
export const LIME_FAMILY = new Set(['reason', 'algo', 'spatial']);

export const fill = {
  /** a category's fixed colour */
  category: (key) => v(CATEGORY_VAR[key] ?? '--series'),
  /** data of a task kind: 'standard' (lime) | 'design' (violet); level: 'base' | 'deep' | 'soft' */
  kind: (kind, level = 'base') => v(`--kind-${kind === 'design' ? 'design' : 'standard'}${level === 'base' ? '' : `-${level}`}`),
  /** single-measure series: pale violet, deep when pointed at or ticked */
  series: (deep = false) => v(deep ? '--series-deep' : '--series'),
  /** compare view: the n-th ticked model (1..4) */
  compare: (n) => v(`--compare-${Math.min(4, Math.max(1, n))}`),
  best: () => v('--st-flare'),
  ref: () => v('--ref-line'),
  refBand: () => v('--ref-band'),
  pending: () => v('--pending-fill'),
};

/** Does a fill of this category / kind need the 1px ink edge? */
export function needsEdge(keyOrKind) {
  return keyOrKind === 'standard' || LIME_FAMILY.has(keyOrKind);
}

/** stroke for the edge: ink on light; invisible on dark (lime is visible there). */
export const edge = () => v('--lime-edge');

/** Which of the 5 sequential steps a 0-100 value falls in (0–20 → 0 … 80–100 → 4). */
export const stepOf = (value) => Math.min(4, Math.max(0, Math.floor(value / 20)));

/**
 * Sequential steps for a 0-100 value (matrix cells): 5 steps, lime 100→500 or
 * violet 100→300 in light; in dark they rise out of the panel (tokens.css
 * --step-*), so a theme switch needs no redraw.
 */
export function stepFill(kind, value) {
  if (value == null) return v('--pending-fill');
  return v(`--step-${kind === 'design' ? 'design' : 'standard'}-${stepOf(value)}`);
}

/** Ink for a number written on a step (light ink on the dim low steps of the dark theme). */
export function stepInk(value) {
  return v(value != null && stepOf(value) >= 3 ? '--step-ink-high' : '--step-ink-low');
}
