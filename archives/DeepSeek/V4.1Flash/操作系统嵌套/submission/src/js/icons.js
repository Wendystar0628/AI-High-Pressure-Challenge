// 自绘图标系统 —— 所有图形均为项目内生成的 SVG
const APP_ICONS = {
  files: {
    g: ['#ffca7a', '#ff9a56'], glyph: `<path d="M9 13.5h20.5l3.5 7.5H12.5z" fill="#7a4a1c" opacity=".35"/>
      <path d="M7.5 15.5c0-1.2 1-2 2.2-2h7l2.3 2.6h13.3c1.2 0 2 .8 2 2v11.4c0 2.3-1.4 3.6-3.7 3.6H11.2c-2.3 0-3.7-1.3-3.7-3.6z" fill="url(#ig)" />
      <path d="M8.5 22.5h28l-2.6 9.4c-.3 1.1-1.2 1.7-2.3 1.7H12.9c-1.1 0-2-.6-2.3-1.7z" fill="#fff" opacity=".28"/>`},
  spreadsheet: {
    g: ['#6ff0c0', '#1fa97b'], glyph: `<rect x="10" y="10" width="28" height="28" rx="5" fill="url(#ig)" opacity=".95"/>
      <g stroke="#0b3b2d" stroke-width="1.2" opacity=".7"><path d="M10 19h28M10 28h28M20 10v28M29 10v28"/></g>
      <path d="M10 10h28v9H10z" fill="#fff" opacity=".25"/>`},
  widgets: {
    g: ['#b3a6ff', '#6d5bef'], glyph: `<rect x="9" y="9" width="12.5" height="12.5" rx="3.5" fill="url(#ig)"/>
      <rect x="26" y="9" width="12.5" height="12.5" rx="6" fill="#ffd166"/>
      <rect x="9" y="26" width="12.5" height="12.5" rx="6" fill="#4be3d1"/>
      <rect x="26" y="26" width="12.5" height="12.5" rx="3.5" fill="url(#ig)" opacity=".8"/>`},
  editor: {
    g: ['#89c4ff', '#4d7cff'], glyph: `<rect x="9" y="9" width="30" height="30" rx="6" fill="url(#ig)"/>
      <path d="M19 18l-6 6 6 6M29 18l6 6-6 6M25 14l-6 20" stroke="#071a3d" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`},
  browser: {
    g: ['#6be6e0', '#2a7bd4'], glyph: `<circle cx="24" cy="24" r="15" fill="none" stroke="url(#ig)" stroke-width="3"/>
      <ellipse cx="24" cy="24" rx="7.5" ry="15" fill="none" stroke="url(#ig)" stroke-width="2" opacity=".9"/>
      <path d="M9.5 24h29M11.5 17h25M11.5 31h25" stroke="url(#ig)" stroke-width="2" opacity=".9"/>`},
  tasks: {
    g: ['#7ef0e3', '#2d9ce0'], glyph: `<rect x="9" y="9" width="30" height="30" rx="7" fill="rgba(9,30,45,.55)"/>
      <path d="M12 27l6-8 5 5 8-12" stroke="#7ef0e3" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="31" cy="12" r="3" fill="#ffd166"/>`},
  settings: {
    g: ['#aab6d8', '#5d6b96'], glyph: `<path d="M24 15.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zm0 4.5a4 4 0 110 8 4 4 0 010-8z" fill="url(#ig)"/>
      <path d="M24 7.5l2.6 4.4 5.1-1 1 5.2 4.9 1.9-2.6 4.5 2.6 4.5-4.9 1.9-1 5.2-5.1-1L24 40.5l-2.6-4.4-5.1 1-1-5.2-4.9-1.9 2.6-4.5-2.6-4.5 4.9-1.9 1-5.2 5.1 1z" fill="none" stroke="url(#ig)" stroke-width="2" opacity=".85"/>`},
  systems: {
    g: ['#a99bff', '#4b3fd0'], glyph: `<rect x="9" y="9" width="20" height="20" rx="4.5" fill="none" stroke="url(#ig)" stroke-width="2.6"/>
      <rect x="18" y="18" width="20" height="20" rx="4.5" fill="rgba(11,14,28,.5)" stroke="#4be3d1" stroke-width="2.6"/>
      <circle cx="28" cy="28" r="3" fill="#ffd166"/>`},
  player: {
    g: ['#ffd98a', '#e8963a'], glyph: `<circle cx="24" cy="24" r="16" fill="rgba(22,20,10,.55)"/>
      <path d="M20.5 16.5l13 7.5-13 7.5z" fill="#ffd166"/>
      <path d="M9 12c6-3 12-3 18 0M9 37c6 2 12 2 18 0" stroke="#ffd98a" stroke-width="2" opacity=".55" fill="none" stroke-linecap="round"/>`},
  charts: {
    g: ['#ff9ac2', '#9d5bff'], glyph: `<rect x="9" y="9" width="30" height="30" rx="6" fill="rgba(20,10,35,.5)"/>
      <rect x="14" y="24" width="4.5" height="10" rx="1.5" fill="#ff9ac2"/><rect x="21.5" y="18" width="4.5" height="16" rx="1.5" fill="#b99bff"/><rect x="29" y="13" width="4.5" height="21" rx="1.5" fill="#4be3d1"/>
      <path d="M12 17l5-3 5 5 7-7" stroke="#ffd166" stroke-width="1.8" fill="none" stroke-linecap="round"/>`},
  guide: {
    g: ['#ffd7a8', '#d18a4a'], glyph: `<path d="M10 12.5c4.5-2 9-2 13 0v24c-4-2-8.5-2-13 0zM38 12.5c-4.5-2-9-2-13 0v24c4-2 8.5-2 13 0z" fill="url(#ig)" opacity=".95"/>
      <path d="M13 17h6M13 21h6M28 17h6M28 21h6" stroke="#4a2a12" stroke-width="1.4" opacity=".6"/>`},
  compiler: {
    g: ['#bfeaff', '#4f9ac9'], glyph: `<rect x="9" y="9" width="30" height="30" rx="6" fill="rgba(8,25,38,.6)"/>
      <path d="M16 20l6-5M16 28l6 5M32 19h-9v10h9" stroke="#8fe6ff" stroke-width="2" fill="none" stroke-linecap="round"/>`},
  terminal: {
    g: ['#9ff5c4', '#2f9a66'], glyph: `<rect x="8" y="11" width="32" height="26" rx="5" fill="#07180f"/>
      <path d="M14 19l5 5-5 5M23 29h9" stroke="#9ff5c4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`},
  kernel: {
    g: ['#ffd98a', '#b9822a'], glyph: `<path d="M24 9l13 7.5v15L24 39l-13-7.5v-15z" fill="rgba(30,20,5,.55)" stroke="#ffd166" stroke-width="2"/>
      <path d="M24 17l6.5 3.8v7.4L24 32l-6.5-3.8v-7.4z" fill="#ffd166" opacity=".85"/>`},
};
const KNOWN_ALIAS = { sheet: 'spreadsheet', folder: 'files', note: 'editor', code: 'editor', process: 'tasks', system: 'systems' };

let iconUid = 0;
export function iconSvg(name, size = 24) {
  name = KNOWN_ALIAS[name] || name;
  const def = APP_ICONS[name];
  const uid = 'ig' + (++iconUid);
  const alt = `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${def ? def.g[0] : '#9aa5c8'}"/><stop offset="1" stop-color="${def ? def.g[1] : '#5d6b96'}"/></linearGradient></defs>`;
  const body = def ? def.glyph.replace(/url\(#ig\)/g, `url(#${uid})`) : `<rect x="8" y="8" width="32" height="32" rx="8" fill="url(#${uid})"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${alt}${body}</svg>`;
}

const U = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>',
  min: '<path d="M4 10h12"/>',
  max: '<rect x="4.5" y="4.5" width="11" height="11" rx="1.5"/>',
  restore: '<rect x="6.5" y="3.5" width="10" height="10" rx="1.5"/><path d="M6.5 6.5h-2v10h10v-2"/>',
  bell: '<path d="M9 3a5 5 0 00-5 5v3.5L2.5 14h15L16 11.5V8a5 5 0 00-5-5z"/><path d="M7.5 16.5a1.6 1.6 0 003 0"/>',
  moon: '<path d="M15 11.5A6.5 6.5 0 116.5 3a5.5 5.5 0 008.5 8.5z"/>',
  volume: '<path d="M3 6.5h3l4-3v11l-4-3H3z"/><path d="M12.5 5.5a5 5 0 010 7M14.5 3.5a8 8 0 010 11"/>',
  clock: '<circle cx="9" cy="9" r="7"/><path d="M9 5v4.5l3 1.8"/>',
  folder: '<path d="M2.5 5.5a1 1 0 011-1h4l1.5 2h6.5a1 1 0 011 1v6a1 1 0 01-1 1h-12a1 1 0 01-1-1z"/>',
  file: '<path d="M5 2.5h5l3 3v10H5z"/><path d="M10 2.5v3h3"/>',
  trash: '<path d="M3.5 5.5h11M7 5.5V3.5h4v2M5 5.5l.7 10h6.6l.7-10"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="9" rx="1"/><path d="M3.5 11.5v-8h8"/>',
  paste: '<rect x="4" y="4" width="10" height="11" rx="1.2"/><path d="M6.5 4V2.5h5V4M7 8h4M7 11h4"/>',
  plus: '<path d="M9 3v12M3 9h12"/>',
  chevronR: '<path d="M6.5 4l5 5-5 5"/>',
  chevronL: '<path d="M11.5 4l-5 5 5 5"/>',
  chevronD: '<path d="M4 6.5l5 5 5-5"/>',
  up: '<path d="M4 12l5-6 5 6M9 6v9"/>',
  refresh: '<path d="M15 9a6 6 0 11-1.8-4.3M15 2.5V6h-3.5"/>',
  play: '<path d="M5 3l10 6-10 6z"/>',
  pause: '<path d="M5 3h3v12H5zM11 3h3v12h-3z"/>',
  stop: '<rect x="4" y="4" width="10" height="10" rx="1.5"/>',
  step: '<path d="M4 3l8 6-8 6zM14 3v12"/>',
  loop: '<path d="M4 7a4 4 0 014-4h5M14 11a4 4 0 01-4 4H5"/><path d="M10 1l2.5 2L10 5M8 13l-2.5 2L8 17"/>',
  camera: '<rect x="2.5" y="5" width="13" height="9" rx="2"/><circle cx="9" cy="9.5" r="2.5"/><path d="M6 5l1.2-2h3.6L12 5"/>',
  project: '<rect x="2.5" y="3" width="10" height="8" rx="1.5"/><path d="M6.5 14h8V8"/><path d="M9 11l5-5"/>',
  kernel: '<path d="M9 2l6 3.5v7L9 16l-6-3.5v-7z"/><path d="M9 7l2.5 1.5v3L9 13l-2.5-1.5v-3z"/>',
  grid: '<rect x="2.5" y="2.5" width="5" height="5"/><rect x="10.5" y="2.5" width="5" height="5"/><rect x="2.5" y="10.5" width="5" height="5"/><rect x="10.5" y="10.5" width="5" height="5"/>',
  layers: '<path d="M9 2l7 4-7 4-7-4z"/><path d="M2 9l7 4 7-4M2 12.5l7 4 7-4"/>',
  power: '<path d="M9 2.5v6"/><path d="M5 5a6 6 0 108 0"/>',
  speed: '<path d="M2.5 13a7 7 0 1113 0"/><path d="M9 13l4-5"/>',
  snapshot: '<rect x="2.5" y="4.5" width="13" height="9" rx="1.5"/><circle cx="9" cy="9" r="2.5"/><path d="M6 2.5h6"/>',
  fork: '<path d="M5 3v5a3 3 0 003 3h6"/><circle cx="4" cy="2.5" r="1.6"/><circle cx="15" cy="11" r="1.6"/><circle cx="15" cy="4" r="1.6"/><path d="M8.5 11H14"/>',
  restore2: '<path d="M3 6a6.5 6.5 0 106-4.5"/><path d="M3 2v4h4"/>',
  edit: '<path d="M3 15l1-4 8-8 3 3-8 8z"/>',
  eye: '<path d="M1.5 9S4 4 9 4s7.5 5 7.5 5S14 14 9 14 1.5 9 1.5 9z"/><circle cx="9" cy="9" r="2.3"/>',
  drag: '<circle cx="6" cy="4" r="1"/><circle cx="12" cy="4" r="1"/><circle cx="6" cy="9" r="1"/><circle cx="12" cy="9" r="1"/><circle cx="6" cy="14" r="1"/><circle cx="12" cy="14" r="1"/>',
  info: '<circle cx="9" cy="9" r="7"/><path d="M9 8v5M9 5.2v.6"/>',
  warning: '<path d="M9 2l7.5 14h-15z"/><path d="M9 7v4M9 13v.5"/>',
  check: '<path d="M3 9.5l4 4 8-9"/>',
  home: '<path d="M3 8l6-5.5L15 8v7.5H3z"/><path d="M7 15.5v-5h4v5"/>',
  download: '<path d="M9 2.5v8M5.5 7.5L9 11l3.5-3.5M3 14.5h12"/>',
  upload: '<path d="M9 12.5v-8M5.5 8L9 4.5 12.5 8M3 14.5h12"/>',
  globe: '<circle cx="9" cy="9" r="7"/><path d="M2 9h14M9 2c2.5 2 3.5 4.5 3.5 7s-1 5-3.5 7c-2.5-2-3.5-4.5-3.5-7S6.5 4 9 2z"/>',
  save: '<path d="M2.5 2.5h10l3 3v10h-13z"/><path d="M5 2.5v4h6v-4M5 11.5h8"/>',
  open: '<path d="M2.5 4.5h5l1.5 2h6v8h-13z"/>',
  undo: '<path d="M6 4L2.5 7.5 6 11"/><path d="M2.5 7.5H11a4.5 4.5 0 010 9H8"/>',
  redo: '<path d="M12 4l3.5 3.5L12 11"/><path d="M15.5 7.5H7a4.5 4.5 0 000 9h3"/>',
  bold: '<path d="M5 3h5a3.5 3.5 0 010 7H5zM5 10h6a3.5 3.5 0 010 7H5z"/>',
  code: '<path d="M6.5 5L2 9l4.5 4M11.5 5L16 9l-4.5 4M10 3l-2 12"/>',
  timer: '<circle cx="9" cy="10" r="6.5"/><path d="M9 6.5V10l2.5 1.5M6.5 1.5h5M13.5 4l1.2 1.2"/>',
  note: '<path d="M3 2.5h12v13H3z"/><path d="M6 6h6M6 9h6M6 12h4"/>',
  clipboard: '<rect x="4" y="3" width="10" height="12" rx="1.5"/><path d="M7 3V1.5h4V3M7 7h4M7 10h4"/>',
  wifi: '<path d="M2 6.5C6 2.5 12 2.5 16 6.5M4.5 9.5c3-2.5 6-2.5 9 0M7 12.5c1.5-1.2 2.5-1.2 4 0"/><circle cx="9" cy="15" r=".8"/>',
  eyeoff: '<path d="M2 2l14 14M7.5 4.5A8.8 8.8 0 019 4c5 0 7.5 5 7.5 5a12 12 0 01-2 2.6M4.5 6.5A13 13 0 001.5 9S4 14 9 14c1 0 1.9-.2 2.7-.5"/>',
  move: '<path d="M9 1.5v15M1.5 9h15M9 1.5L6.5 4M9 1.5L11.5 4M9 16.5L6.5 14M9 16.5l2.5-2.5M1.5 9L4 6.5M1.5 9L4 11.5M16.5 9L14 6.5M16.5 9L14 11.5"/>',
};
export function ui(name, size = 16, cls = '') {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${U[name] || U.info}</svg>`;
}

export function appIcon(appId, size = 32) { return iconSvg(appId, size); }

export function brandMark(size = 28) {
  const uid = 'brand' + (++iconUid);
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#b9a8ff"/><stop offset=".48" stop-color="#7a5cff"/><stop offset="1" stop-color="#3be0cf"/>
      </linearGradient>
      <filter id="${uid}g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6"/></filter>
    </defs>
    <g fill="none" stroke="url(#${uid})" stroke-width="4" stroke-linejoin="round">
      <rect x="6" y="6" width="23" height="23" rx="7" opacity=".95"/>
      <rect x="19" y="19" width="23" height="23" rx="7" opacity=".8"/>
    </g>
    <circle cx="24" cy="24" r="4.2" fill="url(#${uid})" filter="url(#${uid}g)"/>
    <circle cx="24" cy="24" r="2.4" fill="#ffffff"/>
  </svg>`;
}

export const APP_META = {
  files: { title: '文件管理器', icon: 'files' },
  spreadsheet: { title: '电子表格', icon: 'spreadsheet' },
  widgets: { title: '桌面小组件', icon: 'widgets' },
  editor: { title: '文本与程序编辑器', icon: 'editor' },
  browser: { title: '浏览器', icon: 'browser' },
  tasks: { title: '任务管理器', icon: 'tasks' },
  settings: { title: '设置', icon: 'settings' },
  systems: { title: '系统管理', icon: 'systems' },
  player: { title: '三维场景播放器', icon: 'player' },
  charts: { title: '图表工作台', icon: 'charts' },
  guide: { title: '操作说明', icon: 'guide' },
};
