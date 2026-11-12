// 项目原创壁纸：根系统为手绘风景，子系统使用统一的程序化深空壁纸。
import { APP_COLORS } from './icons.js';

function stars(count, seed = 7, w = 1600, h = 1000) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (rnd() * w).toFixed(1), y = (rnd() * h * 0.55).toFixed(1);
    const r = (0.5 + rnd() * 1.6).toFixed(2);
    const o = (0.18 + rnd() * 0.7).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
  }
  return out;
}

const ridge = (points, fill, opacity = 1) => `<path d="${points}" fill="${fill}" opacity="${opacity}"/>`;

function landscapeDusk() {
  return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" class="wallpaper-svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#060a18"/><stop offset=".38" stop-color="#191a3a"/>
      <stop offset=".62" stop-color="#4b2b54"/><stop offset=".78" stop-color="#a45a5a"/>
      <stop offset=".9" stop-color="#eba05e"/><stop offset="1" stop-color="#f6c078"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffe6a8" stop-opacity=".95"/><stop offset=".3" stop-color="#ffc26b" stop-opacity=".55"/>
      <stop offset="1" stop-color="#ff9a55" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a3a58"/><stop offset=".35" stop-color="#2e2846"/><stop offset="1" stop-color="#0b0e1d"/>
    </linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d59b87" stop-opacity=".34"/><stop offset="1" stop-color="#d59b87" stop-opacity="0"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="4"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".07"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
    <radialGradient id="vignette" cx=".5" cy=".48" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#050711" stop-opacity=".62"/></radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#sky)"/>
  ${stars(230, 12)}
  <circle cx="1150" cy="475" r="230" fill="url(#sunGlow)"/>
  <circle cx="1150" cy="475" r="62" fill="#ffdda1" opacity=".92"/>
  <g opacity=".5" filter="url(#soft)">
    <ellipse cx="470" cy="300" rx="300" ry="34" fill="#6b4a6b"/>
    <ellipse cx="950" cy="240" rx="360" ry="26" fill="#7d5772"/>
    <ellipse cx="1320" cy="340" rx="250" ry="22" fill="#c4786b"/>
  </g>
  <path d="M0 560 L140 512 L240 540 L360 470 L520 548 L650 500 L780 548 L930 468 L1080 546 L1210 500 L1370 552 L1500 510 L1600 548 L1600 700 L0 700 Z" fill="#2b2141" opacity=".75"/>
  <path d="M0 610 L180 552 L330 600 L470 520 L610 596 L760 540 L900 602 L1060 512 L1220 596 L1380 536 L1600 604 L1600 760 L0 760 Z" fill="#3b2a4d"/>
  <path d="M0 670 L160 618 L360 668 L560 604 L760 672 L980 612 L1200 676 L1400 622 L1600 674 L1600 830 L0 830 Z" fill="#2a1e3a"/>
  <rect y="700" width="1600" height="300" fill="url(#lake)"/>
  <g opacity=".5">
    <rect x="1080" y="706" width="150" height="3" rx="1.5" fill="#ffd08a" opacity=".55"/>
    <rect x="1020" y="720" width="230" height="2" rx="1" fill="#ffd08a" opacity=".3"/>
    <rect x="1110" y="737" width="130" height="2" rx="1" fill="#ffc27a" opacity=".45"/>
    <rect x="985" y="755" width="280" height="2" rx="1" fill="#ffc27a" opacity=".18"/>
    <rect x="1140" y="776" width="170" height="2" rx="1" fill="#ffd9a1" opacity=".22"/>
  </g>
  <path d="M0 790 Q 260 745 520 795 T 1050 792 T 1600 780 L1600 870 Q 1250 840 980 872 T 460 860 T 0 880 Z" fill="#15172a" opacity=".9"/>
  <g fill="#0b0e17">
    <path d="M70 880 l22 -70 l10 70 l16 -104 l12 104 l18 -56 l8 56 z"/>
    <path d="M150 890 l18 -56 l8 56 l13 -82 l10 82 l14 -48 l7 48 z"/>
    <path d="M1430 892 l20 -62 l9 62 l15 -92 l11 92 l16 -50 l7 50 z"/>
    <path d="M1510 900 l16 -52 l8 52 l12 -76 l9 76 l13 -44 l7 44 z"/>
  </g>
  <path d="M0 930 Q 200 890 420 930 T 880 926 T 1320 936 T 1600 920 L1600 1000 L0 1000 Z" fill="#070a12"/>
  <g opacity=".9">
    <path d="M1090 800 q18 -8 36 0" stroke="#d7b7d8" stroke-width="1.2" fill="none" opacity=".4"/>
    <path d="M1140 815 q14 -6 28 0" stroke="#d7b7d8" stroke-width="1.1" fill="none" opacity=".3"/>
  </g>
  <rect width="1600" height="1000" fill="url(#vignette)"/>
  <rect width="1600" height="1000" filter="url(#grain)" opacity=".55"/>
</svg>`;
}

function landscapeEmber() {
  return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" class="wallpaper-svg">
  <defs>
    <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0a18"/><stop offset=".45" stop-color="#3e1f33"/><stop offset=".7" stop-color="#bb513f"/><stop offset=".86" stop-color="#ef9353"/><stop offset="1" stop-color="#ffd08a"/></linearGradient>
    <linearGradient id="mesa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b3235"/><stop offset="1" stop-color="#2b101c"/></linearGradient>
    <radialGradient id="sun2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3c4"/><stop offset=".55" stop-color="#ffce82"/><stop offset="1" stop-color="#ff8a4f" stop-opacity="0"/></radialGradient>
    <filter id="blur2"><feGaussianBlur stdDeviation="24"/></filter>
    <radialGradient id="vig2" cx=".5" cy=".5" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#08040a" stop-opacity=".68"/></radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#sky2)"/>
  ${stars(120, 33)}
  <circle cx="520" cy="580" r="270" fill="url(#sun2)" opacity=".9"/>
  <g filter="url(#blur2)" opacity=".35"><ellipse cx="1000" cy="520" rx="420" ry="40" fill="#e8855b"/></g>
  <path d="M0 660 L200 560 L310 600 L470 512 L620 612 L810 570 L980 620 L1180 540 L1370 620 L1600 560 L1600 900 L0 900 Z" fill="#4a2130" opacity=".8"/>
  <path d="M0 710h180l60-150 190 10 40 140h250l50-90 180 20 50 70h220l70-120 140 10 70 120h100v300H0z" fill="url(#mesa)"/>
  <g fill="#1a0c14">
    <rect x="240" y="560" width="26" height="160"/><rect x="300" y="560" width="26" height="160"/>
    <rect x="1050" y="610" width="22" height="120"/><rect x="1110" y="610" width="22" height="120"/>
  </g>
  <path d="M0 790 Q300 750 620 800 T 1220 795 T 1600 786 L1600 1000 L0 1000 Z" fill="#140a12"/>
  <g stroke="#f2a267" stroke-width="1" opacity=".35">
    <path d="M60 860 q220 -20 460 2M900 880 q280 -18 640 6"/>
  </g>
  <rect width="1600" height="1000" fill="url(#vig2)"/>
</svg>`;
}

function landscapeAurora() {
  return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" class="wallpaper-svg">
  <defs>
    <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030b14"/><stop offset=".5" stop-color="#07242e"/><stop offset=".78" stop-color="#0c3b45"/><stop offset="1" stop-color="#123a40"/></linearGradient>
    <linearGradient id="aur1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ade80" stop-opacity="0"/><stop offset=".4" stop-color="#4ade80" stop-opacity=".55"/><stop offset=".7" stop-color="#22d3ee" stop-opacity=".4"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>
    <linearGradient id="aur2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a78bfa" stop-opacity="0"/><stop offset=".5" stop-color="#a78bfa" stop-opacity=".4"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></linearGradient>
    <linearGradient id="water3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2c35"/><stop offset="1" stop-color="#030b12"/></linearGradient>
    <filter id="blur3"><feGaussianBlur stdDeviation="26"/></filter>
    <radialGradient id="vig3" cx=".5" cy=".45" r=".8"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#02060b" stop-opacity=".7"/></radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#sky3)"/>
  ${stars(300, 19)}
  <g filter="url(#blur3)">
    <path d="M-100 420 C 300 220 520 560 820 300 S 1320 420 1700 240 L1700 590 C 1300 640 1060 470 820 560 S 300 700 -100 560 Z" fill="url(#aur1)" opacity=".7"/>
    <path d="M-100 520 C 350 380 560 650 950 420 S 1400 500 1700 380 L1700 680 C 1250 720 1050 600 780 680 S 260 780 -100 650 Z" fill="url(#aur2)" opacity=".5"/>
  </g>
  <path d="M0 680 L250 590 L420 650 L610 560 L840 660 L1040 590 L1270 660 L1460 600 L1600 650 L1600 820 L0 820 Z" fill="#0a2530"/>
  <rect y="760" width="1600" height="240" fill="url(#water3)"/>
  <g opacity=".3" stroke="#6ee7b7" stroke-width="1.2">
    <path d="M200 820h300M780 850h420M1150 810h260M420 860h260M100 900h380"/>
  </g>
  <g fill="#031118">
    <path d="M120 880 l26 -100 l14 100 l18 -130 l12 130 l20 -70 l10 70z"/>
    <path d="M1400 890 l24 -90 l13 90 l17 -120 l11 120 l18 -66 l9 66z"/>
  </g>
  <path d="M0 930 L300 890 L700 924 L1100 894 L1600 928 L1600 1000 L0 1000 Z" fill="#02080d"/>
  <rect width="1600" height="1000" fill="url(#vig3)"/>
</svg>`;
}

export const WALLPAPERS = {
  'dusk-ridge': { name: '暮色山脊', svg: landscapeDusk, hue: '#a78bfa' },
  'ember-canyon': { name: '余烬峡谷', svg: landscapeEmber, hue: '#fb923c' },
  'aurora-lake': { name: '极光湖', svg: landscapeAurora, hue: '#5eead4' },
};

export function rootWallpaper(id) {
  const w = WALLPAPERS[id] || WALLPAPERS['dusk-ridge'];
  return `<div class="wallpaper-art" data-wallpaper="${id || 'dusk-ridge'}">${w.svg()}</div>`;
}

const INNER_ACCENTS = ['#fbbf24', '#5eead4', '#fb7185', '#60a5fa', '#c084fc', '#f472b6'];

export function accentForSystem(sys) {
  if (!sys || sys.isRoot) return sys?.settings?.accent || '#a78bfa';
  return INNER_ACCENTS[(sys.depth - 1) % INNER_ACCENTS.length];
}

export function innerWallpaper(sys, accent) {
  const depth = sys.depth;
  const name = sys.name;
  const oldName = sys.name.replace('-', '_');
  const id = 'iw' + depth + name.replace(/[^a-z0-9]/gi, '');
  const dots = stars(90, depth * 17 + 5);
  return `<div class="wallpaper-art inner-wallpaper" style="--accent:${accent}">
  <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" class="wallpaper-svg">
    <defs>
      <radialGradient id="${id}a" cx=".18" cy=".12" r="1"><stop offset="0" stop-color="${accent}" stop-opacity=".26"/><stop offset=".55" stop-color="#10142a" stop-opacity=".1"/><stop offset="1" stop-color="#060912"/></radialGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}c" cx=".5" cy=".5" r=".5"><stop offset=".5" stop-color="${accent}" stop-opacity=".14"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#${id}a)"/>
    <g opacity=".75">${dots}</g>
    <circle cx="1010" cy="190" r="240" fill="url(#${id}c)"/>
    <circle cx="1010" cy="190" r="156" fill="none" stroke="${accent}" stroke-opacity=".16" stroke-width="1.2"/>
    <circle cx="1010" cy="190" r="122" fill="none" stroke="${accent}" stroke-opacity=".22" stroke-width="1"/>
    <circle cx="1010" cy="190" r="12" fill="${accent}" opacity=".75"/>
    <g opacity=".18" stroke="${accent}" stroke-width="1">
      <path d="M0 620 L240 540 L480 600 L700 520 L920 596 L1200 530"/>
      <path d="M0 670 L240 600 L480 650 L700 580 L920 640 L1200 586"/>
      <path d="M0 720 L240 660 L480 696 L700 640 L920 688 L1200 648"/>
    </g>
    <path d="M0 700 Q 160 640 320 700 T 640 700 T 960 700 T 1280 700 L1280 800 L0 800 Z" fill="#05080f" opacity=".85"/>
    <g opacity=".1" fill="${accent}">
      <rect x="60" y="90" width="2" height="300"/><rect x="72" y="90" width="1" height="240"/>
      <rect x="1140" y="500" width="2" height="200"/>
    </g>
    <text x="72" y="742" fill="${accent}" fill-opacity=".24" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="140" font-weight="700" letter-spacing="8">L${depth}</text>
    <text x="78" y="772" fill="#e9e7f3" fill-opacity=".28" font-family="Segoe UI, sans-serif" font-size="15" letter-spacing="6">${name.toUpperCase()} · NESTED OS</text>
    <g transform="translate(1032 700)" opacity=".35">
      <circle r="30" fill="none" stroke="${accent}"/><circle r="20" fill="none" stroke="${accent}" stroke-opacity=".6"/><circle r="4" fill="${accent}"/>
    </g>
    <rect width="1200" height="800" fill="url(#${id}b)" opacity=".07"/>
  </svg>
  </div>`;
}
