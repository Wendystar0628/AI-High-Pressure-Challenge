// 自绘图标：统一的圆角渐变底 + 白色线面符号。所有图形都在这里手写，不使用任何外部图标。
const GRADS = {
  gold: ['#ffd76a', '#f08a24'], violet: ['#a58bff', '#5b34d6'], teal: ['#5ff0d2', '#0d8f9f'], coral: ['#ff9d7e', '#d9345e'],
  blue: ['#7cc4ff', '#2a5fe0'], green: ['#8ee88a', '#1d9a5b'], slate: ['#9aa7c7', '#46517a'], pink: ['#ff9fd6', '#b43bc4'],
};
const defs = Object.entries(GRADS).map(([k, [a, b]]) => `<linearGradient id="ng-${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('');
if (typeof document !== 'undefined') {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>${defs}</defs></svg>`;
  (document.body || document.documentElement).appendChild(holder);
}
const tile = (g, glyph) => `<svg viewBox="0 0 48 48" width="100%" height="100%"><rect x="2" y="2" width="44" height="44" rx="12" fill="url(#ng-${g})"/><rect x="2.6" y="2.6" width="42.8" height="42.8" rx="11.4" fill="none" stroke="#fff" stroke-opacity=".28"/>${glyph}</svg>`;
const line = (d, w = 3) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const small = (d, w = 1.6) => `<svg viewBox="0 0 16 16" width="100%" height="100%"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const I = {
  files: tile('gold', `<path d="M10 16a3 3 0 0 1 3-3h7l4 4h11a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" fill="#fff" fill-opacity=".95"/><path d="M10 22h28" stroke="#f08a24" stroke-width="2"/>`),
  spreadsheet: tile('green', `<rect x="11" y="12" width="26" height="24" rx="3" fill="#fff"/><path d="M11 20h26M11 28h26M20 12v24M29 12v24" stroke="#1d9a5b" stroke-width="2"/>`),
  widgets: tile('pink', `<rect x="11" y="11" width="12" height="12" rx="3" fill="#fff"/><rect x="26" y="11" width="11" height="17" rx="3" fill="#fff" fill-opacity=".8"/><rect x="11" y="26" width="12" height="11" rx="3" fill="#fff" fill-opacity=".8"/><circle cx="31.5" cy="33" r="4.5" fill="#fff"/>`),
  editor: tile('violet', line('M18 16l-8 8 8 8M30 16l8 8-8 8M27 13l-6 22', 3.2)),
  browser: tile('blue', `<circle cx="24" cy="24" r="13" fill="none" stroke="#fff" stroke-width="3"/><path d="M11 24h26M24 11c-8 8-8 18 0 26M24 11c8 8 8 18 0 26" fill="none" stroke="#fff" stroke-width="2.4"/>`),
  tasks: tile('teal', line('M9 26h7l4-11 7 20 4-9h8', 3.2)),
  settings: tile('slate', `<circle cx="24" cy="24" r="5.5" fill="none" stroke="#fff" stroke-width="3"/><path d="M24 10v5M24 33v5M10 24h5M33 24h5M14 14l3.5 3.5M30.5 30.5L34 34M34 14l-3.5 3.5M17.5 30.5L14 34" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`),
  player: tile('violet', `<path d="M8 19h32" stroke="#ffd76a" stroke-width="2.6" stroke-linecap="round"/><path d="M24 19v4" stroke="#fff" stroke-width="2.6"/><path d="M13 27c0-3 3-4.5 7-4.5h7c5 0 8 2 10 5l-5 .5c-1 3-3 4-6 4h-6c-4 0-7-2-7-5z" fill="#ffd76a"/><path d="M20 35h13M19 32v3M31 32v3" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`),
  charts: tile('coral', `<rect x="12" y="24" width="6" height="12" rx="1.5" fill="#fff"/><rect x="21" y="16" width="6" height="20" rx="1.5" fill="#fff"/><rect x="30" y="20" width="6" height="16" rx="1.5" fill="#fff" fill-opacity=".85"/>`),
  systems: tile('teal', `<rect x="18" y="9" width="12" height="9" rx="2" fill="#fff"/><rect x="9" y="30" width="12" height="9" rx="2" fill="#fff"/><rect x="27" y="30" width="12" height="9" rx="2" fill="#fff"/><path d="M24 18v6M15 30v-6h18v6" fill="none" stroke="#fff" stroke-width="2.4"/>`),
  system: tile('violet', `<rect x="9" y="11" width="30" height="26" rx="3" fill="none" stroke="#fff" stroke-width="3"/><rect x="15" y="17" width="18" height="14" rx="2" fill="#fff" fill-opacity=".9"/><rect x="20" y="21" width="8" height="6" rx="1" fill="#5b34d6"/>`),
  help: tile('blue', `<path d="M18 19a6 6 0 1 1 9 5.2c-2 1.2-3 2.3-3 4.8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="24" cy="35" r="2.2" fill="#fff"/>`),
  console: tile('slate', line('M12 17l7 7-7 7M23 32h13', 3.2)),
  projection: tile('pink', `<rect x="9" y="12" width="22" height="16" rx="2.5" fill="none" stroke="#fff" stroke-width="2.8"/><path d="M26 34h12V22" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="M38 34l-9-9" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`),
  folder: `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M2 7a2 2 0 0 1 2-2h5l2.5 2.5H20a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="url(#ng-gold)"/></svg>`,
  start: `<svg viewBox="0 0 28 28" width="100%" height="100%"><path d="M14 3l9.5 5.5v11L14 25l-9.5-5.5v-11z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 9l4.8 2.8v5.4L14 20l-4.8-2.8v-5.4z" fill="currentColor"/></svg>`,
  min: small('M3 8h10'),
  max: small('M3.5 3.5h9v9h-9z'),
  restore: small('M5.5 5.5h7v7h-7zM3.5 10V3.5H10'),
  close: small('M4 4l8 8M12 4l-8 8'),
  up: small('M8 13V3M4 7l4-4 4 4'),
  bell: small('M4 11V7a4 4 0 1 1 8 0v4l1.5 1.5h-11zM6.5 14a1.5 1.5 0 0 0 3 0', 1.4),
  back: small('M10 3L5 8l5 5'),
  forward: small('M6 3l5 5-5 5'),
  reload: small('M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3'),
  stop: small('M4 4l8 8M12 4l-8 8'),
  plus: small('M8 3v10M3 8h10'),
  search: small('M7 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zM10.5 10.5L14 14'),
};
function fileIcon(ext) {
  const color = { nest: 'violet', scene: 'coral', flight: 'pink', sheet: 'green', txt: 'slate', md: 'blue', json: 'teal', snap: 'gold', nbc: 'slate' }[ext] || 'slate';
  const label = (ext || '').slice(0, 4).toUpperCase();
  return `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5 2h9l5 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="url(#ng-${color})"/><path d="M14 2v5h5" fill="#fff" fill-opacity=".45"/><text x="11" y="18" text-anchor="middle" font-size="6" font-weight="700" font-family="Segoe UI,Arial" fill="#fff">${label}</text></svg>`;
}
export function iconSvg(name) {
  if (!name) return '';
  if (name.startsWith('file-')) return fileIcon(name.slice(5));
  return I[name] || fileIcon('');
}
