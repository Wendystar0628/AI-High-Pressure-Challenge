import type { EnemyType, ItemId, TowerType } from './types';

export function getTowerSvg(type: TowerType): string {
  switch (type) {
    case 'firewall':
      return `<svg viewBox="0 0 32 32" fill="none"><path d="M16 3L27 7.5V15.5C27 22.2 22.3 27.6 16 29.5C9.7 27.6 5 22.2 5 15.5V7.5L16 3Z" stroke="currentColor" stroke-width="2.2" fill="currentColor" fill-opacity="0.16"/><path d="M11 13H21M11 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'honeypot':
      return `<svg viewBox="0 0 32 32" fill="none"><polygon points="16,3 27,10 27,22 16,29 5,22 5,10" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.14"/><circle cx="16" cy="16" r="5" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="1.8" fill="currentColor"/></svg>`;
    case 'gate':
      return `<svg viewBox="0 0 32 32" fill="none"><rect x="4" y="6" width="8" height="20" rx="1.5" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.18"/><rect x="20" y="6" width="8" height="20" rx="1.5" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.18"/><path d="M12 16H20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M16 11V21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'interceptor':
      return `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="19" r="7" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.15"/><path d="M16 4V16M11 9L16 4L21 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="19" r="2.2" fill="currentColor"/></svg>`;
    case 'sandbox':
      return `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="1.8" stroke-dasharray="4 3"/><circle cx="16" cy="16" r="6.5" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.14"/><path d="M16 16L23.5 8.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg>`;
    case 'repair':
      return `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.14"/><path d="M16 10V22M10 16H22" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`;
  }
}

export function getItemSvg(id: ItemId): string {
  switch (id) {
    case 'isolator':
      return `<svg viewBox="0 0 32 32" fill="none"><polygon points="16,3 28,16 16,29 4,16" stroke="currentColor" stroke-width="2.2" fill="currentColor" fill-opacity="0.16"/><path d="M16 10V17M16 21V22.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
    case 'downgrade':
      return `<svg viewBox="0 0 32 32" fill="none"><path d="M6 10H26M6 16H26M6 22H26" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><path d="M16 5V27M11 22L16 27L21 22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'restore':
      return `<svg viewBox="0 0 32 32" fill="none"><path d="M9 12A8.5 8.5 0 1 1 8.2 19.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5 12H10.5V6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 12V20M12 16H20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  }
}

export function getEnemySvg(type: EnemyType): string {
  switch (type) {
    case 'worm':
      return `<svg viewBox="0 0 24 24" fill="none"><path d="M4 16C7 9 11 19 14 11C16 6 19 8 20 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="12" r="2" fill="currentColor"/></svg>`;
    case 'flood':
      return `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.2"/><polygon points="15,6 22,12 15,18" fill="currentColor"/></svg>`;
    case 'trojan':
      return `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><path d="M9 9L15 15M15 9L9 15" stroke="#f43f5e" stroke-width="2"/></svg>`;
    case 'ransomware':
      return `<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="11" width="12" height="9" rx="2" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.2"/><path d="M8.5 11V8A3.5 3.5 0 0 1 15.5 8V11" stroke="currentColor" stroke-width="2"/></svg>`;
    case 'hotspot':
      return `<svg viewBox="0 0 24 24" fill="none"><path d="M4 9C8.5 4.5 15.5 4.5 20 9M7.5 12.5C10 10 14 10 16.5 12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="2.2" fill="currentColor"/></svg>`;
    case 'packer':
      return `<svg viewBox="0 0 24 24" fill="none"><polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" stroke="currentColor" stroke-width="2" fill="currentColor" fill-opacity="0.18"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" fill="none"><polygon points="12,2 21,9 18,21 6,21 3,9" stroke="currentColor" stroke-width="2.2" fill="currentColor" fill-opacity="0.22"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`;
  }
}
