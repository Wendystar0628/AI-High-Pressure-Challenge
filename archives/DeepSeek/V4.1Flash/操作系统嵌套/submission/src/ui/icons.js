// 自绘 SVG 图标集（全部为项目内原创几何图形）。
const P = {
  files: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.4h7a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.8 10.2h16.4" opacity=".55"/>',
  spreadsheet: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M9.2 9.5v10M14.8 9.5v10"/><path d="M7.6 13.2h1.2M12.3 13.2h1.2M16.8 13.2h1.2" opacity=".7"/>',
  widgets: '<rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2"/><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2"/><circle cx="16.9" cy="16.9" r="3.6"/><path d="M16.9 14.6v2.4l1.6 1" opacity=".8"/>',
  editor: '<path d="M6.5 3.8h7.4l4 4.1v11.3a1.8 1.8 0 0 1-1.8 1.8H6.5a1.8 1.8 0 0 1-1.8-1.8V5.6a1.8 1.8 0 0 1 1.8-1.8z"/><path d="M13.7 3.9v4.4h4.2"/><path d="M8.2 12h6.2M8.2 15.4h4.2"/>',
  browser: '<circle cx="12" cy="12" r="8.6"/><path d="M3.7 9.2h16.6M3.7 14.8h16.6"/><path d="M12 3.4c2.2 2.3 3.3 5.2 3.3 8.6s-1.1 6.3-3.3 8.6c-2.2-2.3-3.3-5.2-3.3-8.6S9.8 5.7 12 3.4z"/>',
  tasks: '<path d="M4 5.5h8.5M4 12h8.5M4 18.5h8.5"/><circle cx="17" cy="6" r="2.2"/><circle cx="17" cy="12.4" r="2.2"/><circle cx="17" cy="18.2" r="2.2" opacity=".55"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.2l1.1 2.2 2.4.5 1.9-1.4 2 2-1.4 1.9.5 2.4 2.2 1.1-1.1 2.2-2.3-.1-1.4 1.9.3 2.3-2.4.8-1.4-1.9-2.3.3-1.1 2.2-2.2-1.1.1-2.3-1.9-1.4-2.3.3-.8-2.4 1.9-1.4-.3-2.3L3.3 12l1.1-2.2 2.3.1 1.4-1.9-.3-2.3 2.4-.8 1.4 1.9 2.3-.3z" transform="translate(0 -0.6) scale(0.92)" opacity=".9"/>',
  player: '<path d="M4.5 6.8l14.7-2.5a1.5 1.5 0 0 1 1.7 1.9l-2.2 8.3a2 2 0 0 1-1.9 1.4H9.3a2 2 0 0 1-1.9-1.5L4.5 6.8z"/><path d="M9.7 9.2l4.4 2.6-4.4 2.6z" fill="currentColor" stroke="none"/><path d="M3 18.4c2.6-1.3 5.3-1.9 9.6-1.9 2.4 0 5.1.3 8.4 1.2" opacity=".8"/>',
  charts: '<path d="M4 19.5h16" opacity=".55"/><rect x="5.5" y="11" width="3.2" height="6.4" rx="1"/><rect x="10.5" y="6.5" width="3.2" height="10.9" rx="1"/><rect x="15.5" y="9" width="3.2" height="8.4" rx="1"/><path d="M5.3 8.3l4.6-3 4.2 1.7 4.9-4" opacity=".75"/>',
  systems: '<rect x="3.5" y="4" width="17" height="5.4" rx="1.8"/><rect x="6.5" y="9.4" width="11" height="5.2" rx="1.8"/><rect x="9.5" y="14.6" width="5" height="5" rx="1.5"/><path d="M6.4 6.7h.1M9.4 12.1h.1M12.1 17.1h.1"/>',
  help: '<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.1a2.6 2.6 0 0 1 5 .9c0 1.8-2.6 2-2.6 3.8"/><circle cx="12" cy="17" r=".7" fill="currentColor"/>',
  projection: '<path d="M3.6 6.6h8.8v10.8H3.6z"/><path d="M12.4 10.2h5.2v4.6h-5.2"/><path d="M15 8.4l3.6 3.1-3.6 3.1" opacity=".8"/>',
  folder: '<path d="M3.5 7.6a2 2 0 0 1 2-2h4l2 2.4h7a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  sheet: '<rect x="3.8" y="4.2" width="16.4" height="15.6" rx="2.4"/><path d="M3.8 9.1h16.4M9.3 9.1v10.7M14.8 9.1v10.7"/>',
  scene: '<path d="M12 3.4l8 4.5v8.2l-8 4.5-8-4.5V7.9z"/><path d="M4.2 8l7.8 4.4L19.8 8M12 12.4v8"/><path d="M8.2 10.3V6.2M15.8 10.3V6.2" opacity=".6"/>',
  program: '<path d="M8.2 7.4L4 12l4.2 4.6M15.8 7.4L20 12l-4.2 4.6M13.4 4.8l-2.8 14.4"/>',
  snapshot: '<path d="M4.4 7.5a2 2 0 0 1 2-2h3.2l1.6 2h6.4a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2z"/><circle cx="12" cy="13.4" r="2.7"/><path d="M8.2 9.6h.1"/>',
  text: '<path d="M6.4 3.8h7.5l4 4.1v11.3a1.8 1.8 0 0 1-1.8 1.8H6.4a1.8 1.8 0 0 1-1.8-1.8V5.6a1.8 1.8 0 0 1 1.8-1.8z"/><path d="M13.7 3.9v4.4h4.2M8 12.2h7M8 15.4h4.8"/>',
  trash: '<path d="M4.6 7.2h14.8M9.5 7.2V4.9h5v2.3M6.8 7.2l.8 12.2a1.8 1.8 0 0 0 1.8 1.7h5.2a1.8 1.8 0 0 0 1.8-1.7l.8-12.2"/><path d="M10.2 10.8v6M13.8 10.8v6" opacity=".7"/>',
  image: '<rect x="3.6" y="4.8" width="16.8" height="14.4" rx="2.2"/><circle cx="8.8" cy="9.8" r="1.7"/><path d="M4.5 17l4.6-4.4 3.2 2.9 2.7-2.3 4.4 4.1"/>',
  search: '<circle cx="10.6" cy="10.6" r="6.4"/><path d="M15.4 15.4L20 20"/>',
  bell: '<path d="M6.4 16.8h11.2l-1.5-2.1V10a4.1 4.1 0 0 0-8.2 0v4.7z"/><path d="M10 19.4a2.1 2.1 0 0 0 4 0"/><path d="M12 4.1V5.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M8.2 5.4l10 6.6-10 6.6z"/>',
  pause: '<rect x="7" y="5.4" width="3.2" height="13.2" rx="1"/><rect x="13.8" y="5.4" width="3.2" height="13.2" rx="1"/>',
  stop: '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2"/>',
  step: '<path d="M6.8 5.4l8.8 6.6-8.8 6.6z"/><path d="M17.2 5.4v13.2"/>',
  loop: '<path d="M4.4 10.4a4 4 0 0 1 4-4h8.8l-2.4-2.4M19.6 13.6a4 4 0 0 1-4 4H6.8l2.4 2.4"/>',
  camera: '<path d="M4 8.2h3l1.4-2h7.2l1.4 2h3v9.6H4z"/><circle cx="12" cy="12.8" r="3.1"/>',
  wind: '<path d="M3.8 8.6h9.4a2.4 2.4 0 1 0-2.4-2.4M3.8 12.4h12.8a2.4 2.4 0 1 1-2.4 2.4M3.8 16.2h5.4"/>',
  link: '<path d="M9.2 14.8l5.6-5.6"/><path d="M7.6 17.4l-1.3 1.3a3.4 3.4 0 0 1-4.8-4.8l2.5-2.5a3.4 3.4 0 0 1 4.8 0"/><path d="M16.4 6.6l1.3-1.3a3.4 3.4 0 1 1 4.8 4.8l-2.5 2.5a3.4 3.4 0 0 1-4.8 0"/>',
  chevron: '<path d="M9 5.8l6 6.2-6 6.2"/>',
  close: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/>',
  minimize: '<path d="M5.4 12h13.2"/>',
  maximize: '<rect x="5.8" y="5.8" width="12.4" height="12.4" rx="1.5"/>',
  restore: '<rect x="4.8" y="7.8" width="10.4" height="10.4" rx="1.4"/><path d="M8.4 7.8V5.6h10v10h-2.2"/>',
  pauseCircle: '<circle cx="12" cy="12" r="8.6"/><path d="M10 8.8v6.4M14 8.8v6.4"/>',
  resume: '<circle cx="12" cy="12" r="8.6"/><path d="M10.4 8.4l6 3.6-6 3.6z"/>',
  restart: '<path d="M19 12a7 7 0 1 1-2.2-5.1"/><path d="M19.4 4.8v4.6H15"/>',
  stopCircle: '<circle cx="12" cy="12" r="8.6"/><rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1"/>',
  cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><path d="M9.8 3.8v2.7M14.2 3.8v2.7M9.8 17.5v2.7M14.2 17.5v2.7M3.8 9.8h2.7M3.8 14.2h2.7M17.5 9.8h2.7M17.5 14.2h2.7"/>',
  memory: '<rect x="3.4" y="7.4" width="17.2" height="9.2" rx="1.8"/><path d="M6.8 10.4v3.2M10.2 10.4v3.2M13.6 10.4v3.2M17 10.4v3.2"/>',
  disk: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="2.4"/><path d="M18.4 12h-4.1M12 9.6V6.2M12 17.8v-3.4"/>',
  note: '<path d="M5 4.6h14v11.2l-4.2 4.2H5z"/><path d="M14.8 20v-4.2H19M8.2 8.4h7.6M8.2 11.8h5.4"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  list: '<path d="M5 6.6h14M5 12h14M5 17.4h14"/>',
  arrowLeft: '<path d="M19 12H5M11 5.8L5 12l6 6.2"/>',
  arrowRight: '<path d="M5 12h14M13 5.8l6 6.2-6 6.2"/>',
  reload: '<path d="M19.4 10.4A7.6 7.6 0 1 0 19 16"/><path d="M19.8 4.6v5.8h-5.6"/>',
  shield: '<path d="M12 3.6l7.2 2.7v5.4c0 4.3-2.8 7.3-7.2 9.1-4.4-1.8-7.2-4.8-7.2-9.1V6.3z"/><path d="M9 12l2.2 2.2 4-4.2"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5.6a1.8 1.8 0 0 0-1.8-1.8H5.6a1.8 1.8 0 0 0-1.8 1.8v8.6a1.8 1.8 0 0 0 1.8 1.8H8"/>',
  cut: '<circle cx="6.4" cy="17.4" r="2.6"/><circle cx="17.6" cy="17.4" r="2.6"/><path d="M8.2 15.4L17 4M15.8 15.4L7 4"/>',
  paste: '<path d="M8 5.4H6.2A1.8 1.8 0 0 0 4.4 7.2v11.4a1.8 1.8 0 0 0 1.8 1.8h11.6a1.8 1.8 0 0 0 1.8-1.8V7.2a1.8 1.8 0 0 0-1.8-1.8H16"/><rect x="8.4" y="3.4" width="7.2" height="4" rx="1.2"/>',
  rename: '<path d="M4 19.6h4.2L19.4 8.4a2.4 2.4 0 0 0-3.4-3.4L4.8 16.2z"/><path d="M13.8 6.6l3.4 3.4"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 10.8v5.2"/><circle cx="12" cy="8" r=".8" fill="currentColor"/>',
  warning: '<path d="M12 4L21 19.6H3z"/><path d="M12 9.4v4.4"/><circle cx="12" cy="16.8" r=".8" fill="currentColor"/>',
  success: '<circle cx="12" cy="12" r="8.6"/><path d="M8.4 12.2l2.4 2.5 4.8-5"/>',
  moon: '<path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6z"/>',
  wifi: '<path d="M3.6 9.4a13 13 0 0 1 16.8 0M6.4 12.4a8.7 8.7 0 0 1 11.2 0M9.3 15.3a4.4 4.4 0 0 1 5.4 0"/><circle cx="12" cy="18.2" r=".9" fill="currentColor"/>',
  bluetooth: '<path d="M8 7.4l8 5.2-4 4V4l4 4-8 5.2"/>',
  volume: '<path d="M4.4 9.6h3l4-3.2v11.2l-4-3.2h-3z"/><path d="M15 9a4.2 4.2 0 0 1 0 6M17.6 6.6a8 8 0 0 1 0 10.8" opacity=".7"/>',
  timer: '<circle cx="12" cy="13.4" r="7"/><path d="M12 9.2v4.2l2.6 1.6M9.4 3.4h5.2"/>',
  calendar: '<rect x="4" y="5.6" width="16" height="14.4" rx="2"/><path d="M4 10h16M8.2 3.6v4M15.8 3.6v4M8 13.4h1.2M11.4 13.4h1.2M14.8 13.4h1.2M8 16.4h1.2M11.4 16.4h1.2"/>',
  clipboard: '<rect x="5.6" y="5" width="12.8" height="15.2" rx="2"/><path d="M9 5V3.8h6V5M9 9.4h6M9 12.8h6M9 16.2h3.6"/>',
  check: '<path d="M5 12.4l4.4 4.4L19.2 7"/>',
  dots: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  power: '<path d="M12 4v7"/><path d="M7.4 6.6a7 7 0 1 0 9.2 0"/>',
  expand: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  send: '<path d="M4 12l16-7-6.2 16-3-6.4z"/><path d="M10.8 12.8L15.2 8.4"/>',
  dataset: '<ellipse cx="12" cy="6.4" rx="7" ry="2.8"/><path d="M5 6.4v11.2c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8V6.4M5 12c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8"/>',
};

export const APP_COLORS = {
  files: ['#f5b942', '#e07a2b'],
  spreadsheet: ['#34d399', '#0f9f78'],
  widgets: ['#f472b6', '#a855f7'],
  editor: ['#60a5fa', '#3b82f6'],
  browser: ['#22d3ee', '#2563eb'],
  tasks: ['#fb7185', '#e11d48'],
  settings: ['#94a3b8', '#475569'],
  player: ['#a78bfa', '#7c3aed'],
  charts: ['#fbbf24', '#f97316'],
  systems: ['#818cf8', '#4f46e5'],
  help: ['#5eead4', '#0ea5a4'],
  projection: ['#c084fc', '#7e22ce'],
  system: ['#a78bfa', '#4c1d95'],
};

export function uiIcon(name, cls = '', extra = '') {
  const p = P[name] || P.info;
  return `<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
}

export function appIcon(appId, opts = {}) {
  const size = opts.size || 44;
  const cls = opts.cls || '';
  const [a, b] = APP_COLORS[appId] || ['#a78bfa', '#6d28d9'];
  const glyph = appId === 'preview' ? P.info : (P[appId] || P.info);
  return `<span class="app-icon ${cls}" data-app-icon="${appId}" style="--icon-a:${a};--icon-b:${b};width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.27)}px">
    <span class="app-icon-glow"></span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:${Math.round(size * 0.56)}px;height:${Math.round(size * 0.56)}px">${glyph}</svg>
  </span>`;
}

export function fileIcon(name, size = 40) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  let kind = 'text';
  let glyph = P.text;
  let color = ['#94a3b8', '#475569'];
  if (ext === 'sheet') { kind = 'sheet'; glyph = P.sheet; color = ['#34d399', '#0f9f78']; }
  else if (ext === 'scene') { kind = 'scene'; glyph = P.scene; color = ['#a78bfa', '#6d28d9']; }
  else if (ext === 'flight') { kind = 'flight'; glyph = P.player; color = ['#f472b6', '#be185d']; }
  else if (ext === 'prog') { kind = 'program'; glyph = P.program; color = ['#60a5fa', '#1d4ed8']; }
  else if (ext === 'snap') { kind = 'snapshot'; glyph = P.snapshot; color = ['#fbbf24', '#b45309']; }
  else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) { kind = 'image'; glyph = P.image; color = ['#5eead4', '#0f766e']; }
  else if (['zip', '7z', 'rar'].includes(ext)) { kind = 'archive'; glyph = P.snapshot; color = ['#fca5a5', '#b91c1c']; }
  return `<span class="file-icon" data-kind="${kind}" style="--file-a:${color[0]};--file-b:${color[1]};width:${size}px;height:${size}px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    <span class="file-ext">${ext ? ext.toUpperCase() : ''}</span>
  </span>`;
}

export function folderIcon(size = 40) {
  return `<span class="file-icon folder-icon" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${P.folder}</svg>
  </span>`;
}
