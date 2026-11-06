// Light / dark. <html data-theme="light|dark"> when the visitor chose one
// (stored in localStorage "theme", the key the skill's fx.js uses); no
// attribute = follow the system. The toggle button and its reveal are wired
// in shell/bar.js with fx.js wireTheme().

const system = matchMedia('(prefers-color-scheme: dark)');

/** 'light' | 'dark' as it is drawn right now. */
export function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return system.matches ? 'dark' : 'light';
}

/** Call fn(theme) whenever the drawn theme changes. Returns an unsubscribe function. */
export function onThemeChange(fn) {
  let last = currentTheme();
  const check = () => {
    const now = currentTheme();
    if (now !== last) {
      last = now;
      fn(now);
    }
  };
  const mo = new MutationObserver(check);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  system.addEventListener('change', check);
  return () => {
    mo.disconnect();
    system.removeEventListener('change', check);
  };
}
