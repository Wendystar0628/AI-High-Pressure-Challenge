// 生成自制风景壁纸（SVG）：湖畔暮色 / 山脊晨雾 / 极光雪原
import fs from 'node:fs';
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function ridge(y0, amp, rough, step = 24, w = 1920) {
  let pts = []; let y = y0; let v = 0;
  for (let x = -20; x <= w + 40; x += step) {
    v += (rnd() - 0.5) * rough; v *= 0.9;
    const yy = y0 + Math.sin(x / 260 + y0) * amp * 0.5 + Math.sin(x / 97 + amp) * amp * 0.18 + v * amp * 0.08;
    pts.push(`${x},${yy.toFixed(1)}`);
  }
  return `M-20,1100 L${pts.join(' L')} L${w + 40},1100 Z`;
}
function trees(yBase, n, hMin, hMax, color, w = 1920) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = rnd() * w; const h = hMin + rnd() * (hMax - hMin); const y = yBase + rnd() * 20;
    const ww = h * 0.34;
    s += `<path d="M${x.toFixed(1)},${(y - h).toFixed(1)} L${(x + ww).toFixed(1)},${y.toFixed(1)} L${(x - ww).toFixed(1)},${y.toFixed(1)} Z" fill="${color}"/>`;
  }
  return s;
}
function stars(n, maxY, op = 0.9) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${(rnd() * 1920).toFixed(0)}" cy="${(rnd() * maxY).toFixed(0)}" r="${(rnd() * 1.4 + 0.3).toFixed(2)}" fill="#fff" opacity="${(rnd() * op).toFixed(2)}"/>`;
  return s;
}
const head = (defs) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="1920" height="1080"><defs>${defs}</defs>`;

// 1. 湖畔暮色
seed = 11;
let a = head(`
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1d4a"/><stop offset="0.45" stop-color="#6b3a78"/><stop offset="0.72" stop-color="#e2765a"/><stop offset="0.86" stop-color="#f6b56b"/></linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff4d6"/><stop offset="0.25" stop-color="#ffd28a" stop-opacity="0.95"/><stop offset="1" stop-color="#ff9e5e" stop-opacity="0"/></radialGradient>
<linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4f7d"/><stop offset="1" stop-color="#5a3566"/></linearGradient>
<linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b3463"/><stop offset="1" stop-color="#3a2548"/></linearGradient>
<linearGradient id="m3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f1f3d"/><stop offset="1" stop-color="#1d1428"/></linearGradient>
<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0a46a"/><stop offset="0.25" stop-color="#9c5476"/><stop offset="1" stop-color="#1c1733"/></linearGradient>
<linearGradient id="refl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a8" stop-opacity="0.85"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></linearGradient>`);
a += `<rect width="1920" height="1080" fill="url(#sky)"/>${stars(120, 360, 0.7)}`;
a += `<circle cx="1180" cy="640" r="230" fill="url(#sun)"/><circle cx="1180" cy="640" r="58" fill="#fff1cf"/>`;
for (let i = 0; i < 6; i++) a += `<ellipse cx="${300 + i * 300}" cy="${210 + (i % 3) * 60}" rx="${180 + i * 20}" ry="14" fill="#f7a8a0" opacity="0.18"/>`;
a += `<path d="${ridge(560, 130, 6)}" fill="url(#m1)" opacity="0.92"/>`;
a += `<path d="${ridge(640, 110, 8, 20)}" fill="url(#m2)"/>`;
a += `<rect y="700" width="1920" height="380" fill="url(#lake)"/>`;
a += `<rect x="1110" y="700" width="140" height="300" fill="url(#refl)"/>`;
for (let i = 0; i < 26; i++) { const y = 712 + i * 13; a += `<rect x="${(1180 - 30 - rnd() * 70).toFixed(0)}" y="${y}" width="${(60 + rnd() * 140).toFixed(0)}" height="2" fill="#fff3d0" opacity="${(0.55 - i * 0.018).toFixed(2)}"/>`; }
a += `<path d="${ridge(700, 18, 3, 30)}" fill="url(#m3)"/>`;
a += trees(720, 70, 40, 120, '#140d1d');
a += `<path d="M-20,1100 L-20,880 C300,860 520,920 760,960 C980,995 1300,940 1940,980 L1940,1100 Z" fill="#110b18"/>`;
a += trees(990, 40, 70, 190, '#0b0711');
a += `</svg>`;
fs.writeFileSync('assets/wallpapers/lakeside.svg', a);

// 2. 山脊晨雾
seed = 23;
let b = head(`
<linearGradient id="s2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc4e4"/><stop offset="0.6" stop-color="#e8e3d6"/><stop offset="1" stop-color="#f3dcc0"/></linearGradient>
<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#f4f1ea" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
b += `<rect width="1920" height="1080" fill="url(#s2)"/><circle cx="420" cy="300" r="70" fill="#fffaf0" opacity="0.9"/><circle cx="420" cy="300" r="160" fill="#fff8e6" opacity="0.25"/>`;
const cols = ['#a9b9cf', '#8ea3bd', '#6f88a6', '#536c8d', '#3c5574', '#28405c'];
cols.forEach((c, i) => { b += `<path d="${ridge(420 + i * 95, 150 - i * 12, 7, 22)}" fill="${c}"/>`; b += `<rect y="${440 + i * 95}" width="1920" height="140" fill="url(#fog)" opacity="${0.75 - i * 0.08}"/>`; });
b += trees(1010, 90, 40, 110, '#1a2b3f');
b += `</svg>`;
fs.writeFileSync('assets/wallpapers/ridge.svg', b);

// 3. 极光雪原
seed = 41;
let c = head(`
<linearGradient id="s3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030714"/><stop offset="0.6" stop-color="#0b1a35"/><stop offset="1" stop-color="#16345a"/></linearGradient>
<linearGradient id="au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5eead4" stop-opacity="0"/><stop offset="0.5" stop-color="#5eead4" stop-opacity="0.55"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient>
<linearGradient id="snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3f5"/><stop offset="1" stop-color="#6d8fb5"/></linearGradient>
<filter id="bl"><feGaussianBlur stdDeviation="18"/></filter>`);
c += `<rect width="1920" height="1080" fill="url(#s3)"/>${stars(380, 700, 1)}`;
for (let i = 0; i < 4; i++) c += `<path d="M${-100 + i * 80},${420 - i * 40} C${400},${120 + i * 60} ${900},${520 - i * 50} ${1300},${240 + i * 30} S${1900},${160 + i * 40} ${2050},${300}" stroke="url(#au)" stroke-width="${130 - i * 22}" fill="none" filter="url(#bl)" opacity="${0.8 - i * 0.12}"/>`;
c += `<path d="${ridge(640, 170, 8, 18)}" fill="#2a4365"/><path d="${ridge(700, 120, 6, 20)}" fill="url(#snow)" opacity="0.92"/>`;
c += `<path d="M-20,1100 L-20,860 C400,820 900,880 1300,850 C1600,830 1800,870 1940,860 L1940,1100 Z" fill="#dbe9f6"/>`;
c += trees(880, 60, 40, 140, '#0c1a2b');
c += `</svg>`;
fs.writeFileSync('assets/wallpapers/aurora.svg', c);
console.log('wallpapers ok');
