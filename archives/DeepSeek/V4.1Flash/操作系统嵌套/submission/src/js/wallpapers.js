// 自绘壁纸 —— 全部由本项目的 SVG 生成，不复制任何系统素材
import { mulberry32, hashStr } from './util.js';

function svgUri(svg) { return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`; }

function stars(seed, count, w = 1600, h = 660) {
  const rnd = mulberry32(seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (rnd() * w).toFixed(1), y = (rnd() * h).toFixed(1);
    const r = (rnd() * 1.5 + 0.3).toFixed(2), o = (rnd() * 0.7 + 0.2).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#e8f4ff" opacity="${o}"/>`;
  }
  return out;
}

function auroraLayers(seed) {
  const rnd = mulberry32(seed);
  let out = '';
  const colors = ['#4be3d1', '#7d6bff', '#43c6e8'];
  for (let i = 0; i < 4; i++) {
    const y = 90 + i * 55 + rnd() * 30;
    const w = 700 + rnd() * 700;
    const x = 100 + rnd() * 700;
    const c = colors[i % colors.length];
    out += `<path d="M${x - w / 2} ${y + 130} C ${x - w / 4} ${y - 70}, ${x + w / 4} ${y + 80}, ${x + w / 2} ${y - 40}"
      stroke="${c}" stroke-width="${32 + rnd() * 42}" fill="none" opacity="${0.2 + rnd() * 0.18}"
      filter="url(#softBlur)" stroke-linecap="round"/>`;
  }
  return out;
}

const AURORA_LAKE = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#050917"/><stop offset=".32" stop-color="#0c1733"/>
    <stop offset=".58" stop-color="#15355a"/><stop offset=".72" stop-color="#2a5c74"/>
    <stop offset=".8" stop-color="#3c6f7f"/>
  </linearGradient>
  <radialGradient id="moonGlow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#fdf6d8" stop-opacity=".9"/><stop offset=".3" stop-color="#d7e9ff" stop-opacity=".28"/>
    <stop offset="1" stop-color="#d7e9ff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="mtnFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c4a63"/><stop offset="1" stop-color="#16283c"/></linearGradient>
  <linearGradient id="mtnMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a48"/><stop offset="1" stop-color="#0c1a26"/></linearGradient>
  <linearGradient id="mtnNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132630"/><stop offset="1" stop-color="#060e14"/></linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1b3f54"/><stop offset=".35" stop-color="#10283a"/><stop offset="1" stop-color="#050c15"/>
  </linearGradient>
  <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
  </linearGradient>
  <linearGradient id="moonTrail" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#eaf4ff" stop-opacity=".42"/><stop offset=".55" stop-color="#b9d8ee" stop-opacity=".12"/><stop offset="1" stop-color="#9fcde6" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="meteor" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#dff4ff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <filter id="softBlur"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="mist"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".045"/></feComponentTransfer></filter>
</defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
${stars(7, 240)}
<circle cx="1220" cy="170" r="125" fill="url(#moonGlow)"/>
<circle cx="1220" cy="170" r="31" fill="#f7f3df"/>
<circle cx="1231" cy="163" r="28" fill="#0c1733" opacity=".55"/>
${auroraLayers(21)}
<g opacity=".55" filter="url(#mist)">
  <ellipse cx="800" cy="560" rx="620" ry="46" fill="#76b7c4" opacity=".22"/>
  <ellipse cx="1180" cy="520" rx="380" ry="30" fill="#9b8bff" opacity=".16"/>
</g>
<path d="M0 600 L140 470 L250 520 L390 380 L470 430 L590 330 L720 470 L820 420 L950 540 L1080 470 L1220 560 L1360 480 L1500 570 L1600 520 V1000 H0 Z" fill="url(#mtnFar)" opacity=".95"/>
<path d="M0 660 L120 560 L260 610 L400 500 L520 580 L640 470 L780 590 L900 530 L1050 630 L1200 560 L1340 650 L1470 590 L1600 650 V1000 H0 Z" fill="url(#mtnMid)"/>
<path d="M390 380 L430 342 L470 430 L440 414 L420 428 Z" fill="#dbeaf3" opacity=".7"/>
<path d="M640 470 L680 420 L720 470 L695 460 L672 476 Z" fill="#d5e6f0" opacity=".5"/>
<rect y="640" width="1600" height="360" fill="url(#water)"/>
<ellipse cx="1210" cy="900" rx="42" ry="260" fill="url(#moonTrail)" filter="url(#mist)"/>
<g stroke="#dff2ff" stroke-width="2" opacity=".35" stroke-linecap="round">
  <path d="M430 250 l62 -34" stroke="url(#meteor)"/><circle cx="430" cy="250" r="1.6" fill="#fff"/>
  <path d="M880 160 l38 -20" stroke="url(#meteor)" opacity=".7"/>
</g>
<g opacity=".23" filter="url(#softBlur)" transform="translate(0,1280) scale(1,-1)">
  <path d="M300 640 L470 500 L640 620 L800 460 L960 620 L1120 520 L1320 650 L1600 560 V700 H300 Z" fill="#4b8ba0"/>
</g>
<g stroke="#9fd8e6" stroke-linecap="round" opacity=".3">
  <path d="M1050 720h230M1150 760h150M980 800h180M1190 835h95M880 735h120M1240 880h140" stroke-width="2"/>
</g>
<g fill="#04090d">
  <path d="M0 1000 V760 L50 700 L120 760 V1000 Z"/>
  <path d="M100 1000 V700 L150 620 L205 700 V1000 Z"/>
  <path d="M250 1000 V730 L320 640 L400 740 V1000 Z"/>
  <path d="M1460 1000 V720 L1520 660 L1580 730 V1000 Z"/>
  <path d="M1350 1000 V760 L1400 700 L1450 770 V1000 Z"/>
</g>
<g fill="#071018" opacity=".95">
  <path d="M540 1000 V830 L590 760 L640 840 V1000 Z"/>
  <path d="M640 1000 V860 L680 800 L725 870 V1000 Z"/>
  <path d="M1120 1000 V820 L1160 770 L1200 825 V1000 Z"/>
</g>
<g stroke="#e6f3ff" stroke-width="2" opacity=".55" fill="none">
  <path d="M700 200 q12 -9 24 0 q12 -9 24 0"/>
  <path d="M760 245 q9 -7 18 0 q9 -7 18 0"/>
</g>
<g opacity=".22" filter="url(#mist)">
  <ellipse cx="420" cy="620" rx="360" ry="26" fill="#cfe6ef"/>
  <ellipse cx="1180" cy="628" rx="300" ry="20" fill="#d7e8f4"/>
</g>
<rect width="1600" height="1000" fill="url(#vig)"/>
<rect width="1600" height="1000" filter="url(#grain)" opacity=".7"/>
</svg>`;

const SUNSET_DUNES = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2b2050"/><stop offset=".3" stop-color="#7b3a63"/>
    <stop offset=".56" stop-color="#e07a63"/><stop offset=".74" stop-color="#f7c07a"/><stop offset=".9" stop-color="#ffe2ad"/>
  </linearGradient>
  <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d9"/><stop offset=".4" stop-color="#ffd489" stop-opacity=".95"/><stop offset="1" stop-color="#ffb46b" stop-opacity="0"/></radialGradient>
  <linearGradient id="d1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d98a67"/><stop offset="1" stop-color="#a8584e"/></linearGradient>
  <linearGradient id="d2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ad6457"/><stop offset="1" stop-color="#6e3a45"/></linearGradient>
  <linearGradient id="d3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f4750"/><stop offset="1" stop-color="#3a2436"/></linearGradient>
  <linearGradient id="d4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c2e3d"/><stop offset="1" stop-color="#1e1626"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="30"/></filter>
</defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
<g opacity=".9"><circle cx="1120" cy="520" r="230" fill="url(#sun)"/></g>
<circle cx="1120" cy="520" r="78" fill="#fff0c8" opacity=".95"/>
<g fill="#5c3560" opacity=".3" filter="url(#blur)">
  <ellipse cx="380" cy="380" rx="280" ry="28"/><ellipse cx="1180" cy="300" rx="330" ry="22"/><ellipse cx="820" cy="220" rx="220" ry="16"/>
</g>
<path d="M0 640 C240 590 380 660 620 620 C880 575 1030 640 1270 600 C1390 580 1500 605 1600 590 V1000 H0Z" fill="url(#d1)"/>
<path d="M0 730 C260 650 430 760 720 710 C980 665 1180 760 1600 690 V1000 H0Z" fill="url(#d2)"/>
<path d="M0 800 C300 740 520 850 850 790 C1130 740 1350 830 1600 780 V1000 H0Z" fill="url(#d3)"/>
<path d="M0 900 C350 830 640 930 950 880 C1220 840 1430 900 1600 860 V1000 H0Z" fill="url(#d4)"/>
<path d="M1010 640 C1110 700 1250 760 1600 780" stroke="#ffe6b0" stroke-width="3" opacity=".3" fill="none"/>
<g stroke="#3b2433" stroke-width="2" fill="none" opacity=".8" stroke-linecap="round">
  <path d="M700 340 q14-11 28 0 q14-11 28 0"/><path d="M780 300 q11-8 22 0 q11-8 22 0"/><path d="M640 260 q9-7 18 0 q9-7 18 0"/>
</g>
<g fill="#2a1a25" opacity=".85">
  <path d="M240 870 h72 v-8 h-72z"/><path d="M300 860 l4-120 c0 0 10 40 8 120z"/>
  <path d="M360 880 h50 v-6 h-50z"/>
</g>
</svg>`;

const JADE_VALLEY = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7fb6d9"/><stop offset=".5" stop-color="#bcdce4"/><stop offset=".78" stop-color="#e8f2ea"/>
  </linearGradient>
  <linearGradient id="f1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c9aa0"/><stop offset="1" stop-color="#4c6a72"/></linearGradient>
  <linearGradient id="f2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f6661"/><stop offset="1" stop-color="#24433f"/></linearGradient>
  <linearGradient id="f3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24443d"/><stop offset="1" stop-color="#10251f"/></linearGradient>
  <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#89c2c0"/><stop offset=".4" stop-color="#4b8f8b"/><stop offset="1" stop-color="#2b5d5b"/></linearGradient>
  <filter id="mist2"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
<g fill="#fff" opacity=".65" filter="url(#mist2)">
  <ellipse cx="300" cy="170" rx="230" ry="40"/><ellipse cx="1250" cy="120" rx="300" ry="34"/><ellipse cx="880" cy="230" rx="220" ry="26"/>
</g>
<circle cx="1300" cy="140" r="60" fill="#fffbe4" opacity=".9"/>
<path d="M0 560 L180 380 L320 470 L480 300 L640 470 L790 350 L980 520 L1140 400 L1310 520 L1470 430 L1600 500 V1000 H0Z" fill="url(#f1)" opacity=".9"/>
<path d="M480 300 L520 250 L560 330 Z" fill="#eef6f2" opacity=".85"/>
<path d="M790 350 L830 300 L870 375 Z" fill="#eef6f2" opacity=".7"/>
<g opacity=".5" filter="url(#mist2)"><ellipse cx="820" cy="530" rx="700" ry="36" fill="#e5f2ee"/></g>
<path d="M0 650 L200 520 L390 600 L560 480 L760 620 L940 500 L1150 640 L1330 540 L1600 640 V1000 H0Z" fill="url(#f2)"/>
<rect y="640" width="1600" height="360" fill="url(#lake)"/>
<g opacity=".25" transform="translate(0,1280) scale(1,-1)" filter="url(#mist2)">
  <path d="M220 650 L420 520 L620 620 L820 500 L1010 620 L1240 540 L1600 640 V720 H220Z" fill="#dfeee8"/>
</g>
<g stroke="#d9f0e8" stroke-linecap="round" opacity=".32"><path d="M1020 740h240M1120 790h130M900 820h160M1180 870h180" stroke-width="2"/></g>
<path d="M0 1000 V740 C180 700 280 760 420 730 C520 705 610 740 700 780 V1000 Z" fill="url(#f3)"/>
<path d="M1600 1000 V720 C1460 690 1360 750 1240 720 C1160 700 1090 740 1030 800 V1000 Z" fill="url(#f3)"/>
<g fill="#0c211d">
  <path d="M130 760 l38 -120 38 120z"/><path d="M200 790 l30 -96 30 96z"/><path d="M70 800 l44 -140 44 140z"/>
  <path d="M1390 760 l40 -128 40 128z"/><path d="M1450 800 l34 -108 34 108z"/><path d="M1520 780 l42 -134 42 134z"/>
  <rect x="166" y="760" width="6" height="40"/><rect x="230" y="790" width="5" height="30"/><rect x="110" y="800" width="7" height="46"/>
  <rect x="1426" y="760" width="6" height="45"/><rect x="1480" y="800" width="5" height="30"/><rect x="1558" y="780" width="6" height="40"/>
</g>
<g stroke="#f0f8f4" stroke-width="2.5" opacity=".8" fill="none">
  <path d="M710 220 q14-11 28 0 q14-11 28 0"/><path d="M790 260 q10-8 20 0 q10-8 20 0"/>
</g>
</svg>`;

const DEEP_FIELD = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs>
  <radialGradient id="neb" cx=".5" cy=".45" r=".7">
    <stop offset="0" stop-color="#3a2a7a"/><stop offset=".45" stop-color="#141334"/><stop offset="1" stop-color="#05060f"/>
  </radialGradient>
  <filter id="b"><feGaussianBlur stdDeviation="45"/></filter>
</defs>
<rect width="1600" height="1000" fill="url(#neb)"/>
<g filter="url(#b)" opacity=".5">
  <ellipse cx="620" cy="380" rx="380" ry="220" fill="#7d4bd8"/>
  <ellipse cx="1080" cy="620" rx="420" ry="240" fill="#1d7a95"/>
  <ellipse cx="900" cy="420" rx="200" ry="160" fill="#e05a9a" opacity=".7"/>
</g>
${stars(99, 420, 1600, 1000)}
<g opacity=".85"><circle cx="1240" cy="300" r="2.2" fill="#fff"/><circle cx="1240" cy="300" r="8" fill="#ffd166" opacity=".3"/></g>
<path d="M0 820 C300 760 500 860 800 810 C1100 760 1300 840 1600 790 V1000 H0Z" fill="#080a15" opacity=".9"/>
</svg>`;

export const WALLPAPERS = {
  'aurora-lake': { name: '极光湖畔', css: svgUri(AURORA_LAKE), dark: true },
  'sunset-dunes': { name: '落日沙丘', css: svgUri(SUNSET_DUNES), dark: true },
  'jade-valley': { name: '翡翠山谷', css: svgUri(JADE_VALLEY), dark: false },
  'deep-field': { name: '深空星云', css: svgUri(DEEP_FIELD), dark: true },
};

export function wallpaperCss(name) {
  return (WALLPAPERS[name] || WALLPAPERS['aurora-lake']).css;
}

// 子系统壁纸：使用系统强调色与深度生成，与根系统同源设计语言
export function innerWallpaper(depth, accent) {
  const hue = hashStr(accent + depth) % 360;
  const c1 = accent || '#8b7bff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#080b18"/><stop offset=".55" stop-color="#0d1526"/><stop offset="1" stop-color="#101b2d"/>
    </linearGradient>
    <radialGradient id="a1" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${c1}" stop-opacity=".38"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
    <radialGradient id="a2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4be3d1" stop-opacity=".22"/><stop offset="1" stop-color="#4be3d1" stop-opacity="0"/></radialGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c1}" stop-opacity="0"/><stop offset=".5" stop-color="${c1}" stop-opacity=".8"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1400" height="900" fill="url(#bg)"/>
  <ellipse cx="${180 + depth * 120}" cy="180" rx="520" ry="380" fill="url(#a1)"/>
  <ellipse cx="${1100 - depth * 80}" cy="760" rx="500" ry="340" fill="url(#a2)"/>
  <g stroke="${c1}" stroke-opacity=".10" fill="none">
    ${Array.from({ length: 11 }, (_, i) => `<path d="M${-100 + i * 150} 900 L${300 + i * 150} 0"/>`).join('')}
    ${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${120 + i * 130} H1400"/>`).join('')}
  </g>
  <g opacity=".5">
    <circle cx="${1120 - depth * 60}" cy="${170 + depth * 30}" r="190" fill="none" stroke="${c1}" stroke-opacity=".16" stroke-width="1.2"/>
    <circle cx="${1120 - depth * 60}" cy="${170 + depth * 30}" r="130" fill="none" stroke="${c1}" stroke-opacity=".2" stroke-width="1.2"/>
    <circle cx="${1120 - depth * 60}" cy="${170 + depth * 30}" r="70" fill="none" stroke="#4be3d1" stroke-opacity=".18" stroke-width="1.2"/>
  </g>
  <rect x="0" y="858" width="1400" height="2" fill="url(#line)" opacity=".7"/>
  </svg>`;
  return svgUri(svg);
}

export const ACCENTS = [
  { value: '#8b7bff', name: '星紫' }, { value: '#4be3d1', name: '极光青' },
  { value: '#ff7aa2', name: '霓虹粉' }, { value: '#ffb04d', name: '日冕橙' },
  { value: '#5ba8ff', name: '冰川蓝' }, { value: '#8ee06a', name: '森野绿' }
];
