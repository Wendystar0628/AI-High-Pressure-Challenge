// Custom-designed SVG vector icon library for Nested OS (zero external assets).

const SVG_BASE = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"';

const ICONS = {
  files: `<svg ${SVG_BASE}>
    <defs>
      <linearGradient id="fldG" x1="6" y1="10" x2="42" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f6c453"/>
        <stop offset="100%" stop-color="#d98a1a"/>
      </linearGradient>
    </defs>
    <path d="M6 12C6 9.8 7.8 8 10 8H19L23 13H38C40.2 13 42 14.8 42 17V36C42 38.2 40.2 40 38 40H10C7.8 40 6 38.2 6 36V12Z" fill="#c77a14"/>
    <path d="M6 16C6 14.3 7.3 13 9 13H39C40.7 13 42 14.3 42 16V36C42 38.2 40.2 40 38 40H10C7.8 40 6 38.2 6 36V16Z" fill="url(#fldG)"/>
    <path d="M10 19H38" stroke="#fff3cf" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  sheet: `<svg ${SVG_BASE}>
    <rect x="7" y="6" width="34" height="36" rx="5" fill="#177e52"/>
    <rect x="10" y="10" width="28" height="28" rx="3" fill="#21a366"/>
    <path d="M13 18H35M13 25H35M13 32H35M21 13V35M29 13V35" stroke="#e9fff4" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="13" y="13" width="22" height="5" rx="1" fill="#ffffff" fill-opacity="0.24"/>
  </svg>`,

  editor: `<svg ${SVG_BASE}>
    <rect x="7" y="7" width="34" height="34" rx="6" fill="#253657"/>
    <rect x="10" y="10" width="28" height="28" rx="4" fill="#17233a"/>
    <path d="M19 19L14 24L19 29M29 19L34 24L29 29M26 17L22 31" stroke="#68d1ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  tasks: `<svg ${SVG_BASE}>
    <rect x="6" y="8" width="36" height="32" rx="6" fill="#16293d"/>
    <rect x="9" y="11" width="30" height="26" rx="4" fill="#0f1d2c"/>
    <path d="M11 27H16L20 17L24 31L28 21L31 27H37" stroke="#38e89e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="31" cy="27" r="2" fill="#9bf9d0"/>
  </svg>`,

  browser: `<svg ${SVG_BASE}>
    <defs>
      <linearGradient id="brG" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#5ec2ff"/>
        <stop offset="100%" stop-color="#226ce0"/>
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="18" fill="url(#brG)"/>
    <ellipse cx="24" cy="24" rx="8.5" ry="18" stroke="#d8f2ff" stroke-width="2"/>
    <path d="M7 20H41M7 28H41" stroke="#d8f2ff" stroke-width="1.8"/>
    <circle cx="24" cy="24" r="17" stroke="#a6ddff" stroke-width="1.5"/>
  </svg>`,

  settings: `<svg ${SVG_BASE}>
    <circle cx="24" cy="24" r="17" fill="#3a4c67"/>
    <path d="M24 9V13M24 35V39M9 24H13M35 24H39M13.4 13.4L16.3 16.3M31.7 31.7L34.6 34.6M34.6 13.4L31.7 16.3M16.3 31.7L13.4 34.6" stroke="#c8d8f0" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="8" fill="#1e2a3c" stroke="#85b8ff" stroke-width="2.5"/>
    <circle cx="24" cy="24" r="3" fill="#85b8ff"/>
  </svg>`,

  widgets: `<svg ${SVG_BASE}>
    <rect x="7" y="7" width="15" height="15" rx="4" fill="#4f9cf9"/>
    <rect x="26" y="7" width="15" height="15" rx="4" fill="#a77df7"/>
    <rect x="7" y="26" width="15" height="15" rx="4" fill="#43c79e"/>
    <rect x="26" y="26" width="15" height="15" rx="4" fill="#f5b041"/>
  </svg>`,

  manual: `<svg ${SVG_BASE}>
    <path d="M8 11C8 9.3 9.3 8 11 8H23V38H11C9.3 38 8 36.7 8 35V11Z" fill="#3b7be0"/>
    <path d="M40 11C40 9.3 38.7 8 37 8H25V38H37C38.7 38 40 36.7 40 35V11Z" fill="#5b9bff"/>
    <path d="M12 15H20M12 21H20M12 27H18M28 15H36M28 21H36M28 27H34" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    <rect x="22.5" y="8" width="3" height="31" fill="#1e4999"/>
  </svg>`,

  player: `<svg ${SVG_BASE}>
    <rect x="6" y="8" width="36" height="32" rx="7" fill="#321f5e"/>
    <rect x="9" y="11" width="30" height="26" rx="5" fill="#4d2c91"/>
    <path d="M12 16H36" stroke="#f5cb2e" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M15 24C15 20.5 19.5 18 25 18C30 18 33 20.5 33 24C33 26.8 30 28.5 25 28.5H19L15 24Z" fill="#7c4dff" stroke="#f5cb2e" stroke-width="1.6"/>
    <path d="M18 32H30M21 28.5V32M27 28.5V32" stroke="#ffd84d" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="24" cy="23" r="2.2" fill="#f5cb2e"/>
  </svg>`,

  charts: `<svg ${SVG_BASE}>
    <rect x="6" y="7" width="36" height="34" rx="6" fill="#192841"/>
    <rect x="12" y="24" width="5" height="11" rx="1.2" fill="#46b6ff"/>
    <rect x="21" y="17" width="5" height="18" rx="1.2" fill="#46e6b6"/>
    <rect x="30" y="12" width="5" height="23" rx="1.2" fill="#f6c453"/>
    <path d="M11 19L22 14L33 10" stroke="#ff82a9" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  subsystem: `<svg ${SVG_BASE}>
    <rect x="6" y="6" width="36" height="36" rx="7" fill="#1c3554" stroke="#62b4ff" stroke-width="2"/>
    <rect x="13" y="13" width="22" height="22" rx="4" fill="#284c78" stroke="#8ad3ff" stroke-width="1.8"/>
    <rect x="19" y="19" width="10" height="10" rx="2" fill="#f6c453"/>
  </svg>`,

  folder: `<svg ${SVG_BASE}>
    <path d="M7 13C7 10.8 8.8 9 11 9H19L23 13H37C39.2 13 41 14.8 41 17V35C41 37.2 39.2 39 37 39H11C8.8 39 7 37.2 7 35V13Z" fill="#e59c24"/>
    <path d="M7 16H41V35C41 37.2 39.2 39 37 39H11C8.8 39 7 37.2 7 35V16Z" fill="#f6c453"/>
  </svg>`,

  file: `<svg ${SVG_BASE}>
    <path d="M12 7H29L36 14V41H12V7Z" fill="#e6edf7"/>
    <path d="M29 7V14H36L29 7Z" fill="#9fb5d4"/>
    <path d="M17 21H31M17 27H31M17 33H26" stroke="#537299" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  kernel: `<svg ${SVG_BASE}>
    <path d="M12 7H29L36 14V41H12V7Z" fill="#212d45" stroke="#6ea8ff" stroke-width="1.6"/>
    <path d="M29 7V14H36" fill="#3a527e"/>
    <rect x="18" y="20" width="12" height="12" rx="2.5" fill="#46b6ff" fill-opacity="0.28" stroke="#64d2ff" stroke-width="1.8"/>
    <circle cx="24" cy="26" r="2.2" fill="#ffd84d"/>
  </svg>`,

  scene: `<svg ${SVG_BASE}>
    <path d="M12 7H29L36 14V41H12V7Z" fill="#2c1d4c" stroke="#b388ff" stroke-width="1.6"/>
    <polygon points="24,18 33,24 24,30 15,24" fill="#f6c453"/>
    <polygon points="15,24 24,30 24,36 15,30" fill="#7c4dff"/>
    <polygon points="33,24 24,30 24,36 33,30" fill="#5e35b1"/>
  </svg>`,

  snap: `<svg ${SVG_BASE}>
    <rect x="8" y="10" width="32" height="28" rx="6" fill="#1c3b47" stroke="#45e0c0" stroke-width="2"/>
    <circle cx="24" cy="24" r="7" fill="#0f252e" stroke="#45e0c0" stroke-width="2"/>
    <circle cx="24" cy="24" r="2.8" fill="#ffd84d"/>
    <circle cx="34" cy="16" r="1.8" fill="#45e0c0"/>
  </svg>`,

  trash: `<svg ${SVG_BASE}>
    <path d="M13 15H35L33 39C33 40.7 31.7 42 30 42H18C16.3 42 15 40.7 15 39L13 15Z" fill="#6b7f9c"/>
    <path d="M10 12H38V15H10V12Z" fill="#8ca2bf"/>
    <path d="M19 8H29V12H19V8Z" fill="#a9bdd6"/>
    <path d="M20 20V35M24 20V35M28 20V35" stroke="#d9e4f2" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  start: `<svg ${SVG_BASE}>
    <rect x="6" y="6" width="16" height="16" rx="3.5" fill="#68b7ff"/>
    <rect x="26" y="6" width="16" height="16" rx="3.5" fill="#4f99f5"/>
    <rect x="6" y="26" width="16" height="16" rx="3.5" fill="#4f99f5"/>
    <rect x="26" y="26" width="16" height="16" rx="3.5" fill="#3a7be0"/>
  </svg>`,
};

export function getAppIconSvg(appOrKind, className = 'os-svg-icon') {
  const key = ICONS[appOrKind] ? appOrKind : 'file';
  return `<span class="${className}" aria-hidden="true">${ICONS[key]}</span>`;
}

export function getFileIconSvg(fileNameOrKind, isDir = false, className = 'os-svg-icon') {
  if (isDir) {
    if (fileNameOrKind === 'RecycleBin' || fileNameOrKind === '/RecycleBin') {
      return getAppIconSvg('trash', className);
    }
    return getAppIconSvg('folder', className);
  }
  const lower = String(fileNameOrKind || '').toLowerCase();
  if (lower.endsWith('.ns') || lower.endsWith('.bc')) return getAppIconSvg('kernel', className);
  if (lower.endsWith('.scene') || lower.endsWith('.rehearsal')) return getAppIconSvg('scene', className);
  if (lower.endsWith('.sheet')) return getAppIconSvg('sheet', className);
  if (lower.endsWith('.snap')) return getAppIconSvg('snap', className);
  return getAppIconSvg('file', className);
}

export function getIconDataUrl(name) {
  const svg = ICONS[name] || ICONS.file;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
