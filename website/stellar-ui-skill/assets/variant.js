// variant.js: picks a variant (and, if asked, a theme) before the page
// paints. Load it in <head> as a plain (not module) script, before the
// stylesheet:
//   <script src="../assets/variant.js"></script>
// It sets data-st-* on <html> from, in order of strength:
//   the address: ?variant=observatory or single axes (?paper=cool&cut=tight …)
//   attributes already written on <html> (data-st-variant="nebula", data-st-paper=…)
// ?theme=light|dark picks the theme for this visit (handy for comparing);
// otherwise a choice saved by fx.js wireTheme() wins, then a preset's theme,
// then the system.
// The axes and presets are explained in references/variation.md and match
// the "variant" block in tokens.json. The two theme colours never change.
(() => {
  const presets = {
    zenith: {},
    observatory: { paper: 'cool', cut: 'tight', ground: 'chart', motion: 'calm' },
    nebula: { paper: 'dusk', cut: 'wide', density: 'roomy' },
    midnight: { ground: 'plain', density: 'compact', motion: 'calm', theme: 'dark' },
  };
  const axes = ['paper', 'cut', 'ground', 'density', 'motion'];
  const html = document.documentElement;
  let q;
  try {
    q = new URLSearchParams(location.search);
  } catch {
    q = new URLSearchParams();
  }
  const name = q.get('variant') || html.dataset.stVariant;
  const preset = presets[name] || {};
  if (name in presets) html.dataset.stVariant = name;
  for (const a of axes) {
    const v = q.get(a) || html.getAttribute(`data-st-${a}`) || preset[a];
    if (v) html.setAttribute(`data-st-${a}`, v);
  }
  let saved = null;
  try {
    saved = localStorage.getItem('theme');
  } catch {}
  const asked = q.get('theme');
  if (asked === 'light' || asked === 'dark') html.dataset.theme = asked;
  else if (saved === 'light' || saved === 'dark') html.dataset.theme = saved;
  else if (preset.theme && !html.dataset.theme) html.dataset.theme = preset.theme;
})();
