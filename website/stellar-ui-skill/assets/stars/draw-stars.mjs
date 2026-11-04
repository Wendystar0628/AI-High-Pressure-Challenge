// Draws two faint star-chart patches, a and b, written next to this file:
// four-point stars sized by magnitude, one or two sparse constellation lines,
// and a few arcs of a chart grid (circles of declination and hour lines)
// running round a pole that lies outside the patch.
// Every star is a four-point star, the faintest class too.
// No labels, no coordinates, no crosshairs. The same seed always gives the
// same files. They are used as CSS masks, so they take whatever colour the
// page gives them; every patch thins out to nothing towards its edge.
// Each patch is written three times:
//   stars-a.svg         lines and stars together (one colour)
//   stars-a-lines.svg   the grid arcs and constellation lines only
//   stars-a-glints.svg  the stars only
// stellar.css paints the lines and the stars in two colours from the split
// files. Change the seeds, sizes or counts at the bottom for a different sky:
//   node draw-stars.mjs
import { writeFileSync } from 'node:fs';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => String(Math.round(v * 10) / 10);

// Magnitude classes, faint to bright: how much room a star keeps (r), the
// distance from its centre to a tip (tip) and how full its waist is (waist,
// a share of tip measured on the diagonal). Faint stars get a fuller waist so
// they keep their shape when small. Few bright ones, many faint ones (share
// per 100 stars), as on a printed star atlas.
const CLASSES = [
  { r: 0.8, tip: 2.1, waist: 0.44, share: 44 },
  { r: 1.1, tip: 2.8, waist: 0.4, share: 28 },
  { r: 1.55, tip: 3.7, waist: 0.36, share: 16 },
  { r: 2.1, tip: 4.9, waist: 0.33, share: 9 },
  { r: 2.8, tip: 6.4, waist: 0.3, share: 3 },
];

/** A four-point star: tips on the axes, sides curving in to the waist. Drawn
    with relative curves, so a whole sky is a single path. */
function star(x, y, tip, waist) {
  const k = (waist / Math.SQRT2 - 0.25) * 2 * tip; // the curves' control offset
  const R = tip;
  return (
    `M${n(x)} ${n(y - R)}` +
    `q${n(k)} ${n(R - k)} ${n(R)} ${n(R)}` +
    `q${n(k - R)} ${n(k)} ${n(-R)} ${n(R)}` +
    `q${n(-k)} ${n(k - R)} ${n(-R)} ${n(-R)}` +
    `q${n(R - k)} ${n(-k)} ${n(R)} ${n(-R)}z`
  );
}

/** Stars scattered with a soft band of higher density across the patch (like
    a stretch of the Milky Way), kept apart so they never clump into blobs. */
function scatter(r, w, h, count, band) {
  const stars = [];
  const pick = () => {
    let x = r() * 100;
    for (const c of CLASSES) if ((x -= c.share) < 0) return c;
    return CLASSES[0];
  };
  let guard = 0;
  while (stars.length < count && guard++ < count * 80) {
    const x = r() * w;
    const y = r() * h;
    // distance from the band's centre line, in units of the band's half width
    const d = Math.abs((x - band.x) * Math.sin(band.a) - (y - band.y) * Math.cos(band.a)) / band.width;
    if (r() > 0.28 + 0.72 * Math.exp(-d * d)) continue;
    const mag = pick();
    const gap = 9 + mag.r * 5;
    if (stars.some((s) => Math.hypot(s.x - x, s.y - y) < gap)) continue;
    stars.push({ x, y, size: mag.r, tip: mag.tip, waist: mag.waist });
  }
  return stars;
}

/** A constellation: a short open chain through bright stars near the middle
    of the patch, turning gently, never closing into a loop. */
function chain(stars, from, length, w, h, used) {
  const bright = stars.filter((s) => s.size >= 1.55 && !used.has(s) && Math.hypot(s.x / w - 0.5, s.y / h - 0.5) < 0.38);
  let here = bright.sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
  if (!here) return [];
  const line = [here];
  used.add(here);
  let heading = null;
  while (line.length < length) {
    const next = bright
      .filter((s) => !used.has(s))
      .map((s) => {
        const dx = s.x - here.x;
        const dy = s.y - here.y;
        const dist = Math.hypot(dx, dy);
        const turn = heading === null ? 0 : Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - heading), Math.cos(Math.atan2(dy, dx) - heading)));
        return { s, dist, turn, dx, dy };
      })
      .filter((c) => c.dist > 40 && c.dist < 210 && c.turn < 1.9)
      .sort((a, b) => a.dist + a.turn * 40 - (b.dist + b.turn * 40))[0];
    if (!next) break;
    heading = Math.atan2(next.dy, next.dx);
    used.add(next.s);
    line.push(next.s);
    here = next.s;
  }
  return line;
}

/** The segments between stars, stopped short of each star as on a chart. */
function chainPath(line) {
  let d = '';
  for (let k = 0; k + 1 < line.length; k++) {
    const [a, b] = [line[k], line[k + 1]];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const [ux, uy] = [(b.x - a.x) / len, (b.y - a.y) / len];
    const ga = a.tip + 3;
    const gb = b.tip + 3;
    d += `M${n(a.x + ux * ga)} ${n(a.y + uy * ga)}L${n(b.x - ux * gb)} ${n(b.y - uy * gb)}`;
  }
  return d;
}

/** The part of a circle round the pole that falls inside the patch, as arcs. */
function arcPath(pole, radius, w, h) {
  const steps = 720;
  const inside = (t) => {
    const x = pole.x + radius * Math.cos(t);
    const y = pole.y + radius * Math.sin(t);
    return x >= 0 && x <= w && y >= 0 && y <= h;
  };
  let d = '';
  let start = null;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    if (inside(t) && start === null) start = t;
    if ((!inside(t) || i === steps) && start !== null) {
      const end = t;
      if (end - start > 0.02) {
        const [x0, y0] = [pole.x + radius * Math.cos(start), pole.y + radius * Math.sin(start)];
        const [x1, y1] = [pole.x + radius * Math.cos(end), pole.y + radius * Math.sin(end)];
        d += `M${n(x0)} ${n(y0)}A${n(radius)} ${n(radius)} 0 ${end - start > Math.PI ? 1 : 0} 1 ${n(x1)} ${n(y1)}`;
      }
      start = null;
    }
  }
  return d;
}

/** A short stretch of an hour line: a ray from the pole between two radii. */
function rayPath(pole, angle, r0, r1) {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return `M${n(pole.x + r0 * c)} ${n(pole.y + r0 * s)}L${n(pole.x + r1 * c)} ${n(pole.y + r1 * s)}`;
}

function draw(name, { seed, w, h, count, band, pole, circles, rays, chains }) {
  const r = rng(seed);
  const stars = scatter(r, w, h, count, band);
  const solid = circles.filter((_, i) => i % 2 === 0).map((radius) => arcPath(pole, radius, w, h)).join('');
  const dashed = circles.filter((_, i) => i % 2 === 1).map((radius) => arcPath(pole, radius, w, h)).join('');
  const hours = rays.map(({ angle, from, to }) => rayPath(pole, angle, from, to)).join('');
  const used = new Set();
  const figures = chains.map(({ from, length }) => chainPath(chain(stars, from, length, w, h, used))).join('');
  const glints = stars
    .sort((a, b) => a.size - b.size)
    .map((s) => star(s.x, s.y, s.tip, s.waist))
    .join('');

  const open =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
    `<defs><radialGradient id="f"><stop offset=".42" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>` +
    `<mask id="m"><rect width="${w}" height="${h}" fill="url(#f)"/></mask></defs>` +
    `<g mask="url(#m)">`;
  const close = `</g></svg>\n`;
  const lines =
    `<g fill="none" stroke="#000" stroke-width="1" stroke-opacity=".5"><path d="${solid}"/><path stroke-dasharray="2 6" d="${dashed}"/><path stroke-dasharray="1 5" d="${hours}"/></g>` +
    `<path fill="none" stroke="#000" stroke-width="1" stroke-opacity=".8" d="${figures}"/>`;
  const points = `<path d="${glints}"/>`;

  const files = {
    [`${name}.svg`]: open + lines + points + close,
    [`${name}-lines.svg`]: open + lines + close,
    [`${name}-glints.svg`]: open + points + close,
  };
  for (const [file, svg] of Object.entries(files)) writeFileSync(new URL(`./${file}`, import.meta.url), svg);
  console.log(name, `${stars.length} stars`, Object.entries(files).map(([f, s]) => `${f} ${(s.length / 1024).toFixed(1)} KB`).join(', '));
}

draw('stars-a', {
  seed: 20261104,
  w: 960,
  h: 720,
  count: 210,
  band: { x: 480, y: 360, a: -0.62, width: 150 },
  pole: { x: 1120, y: -260 },
  circles: [520, 640, 760, 880],
  rays: [
    { angle: 2.05, from: 470, to: 930 },
    { angle: 2.45, from: 470, to: 930 },
  ],
  chains: [
    { from: { x: 420, y: 300 }, length: 5 },
    { from: { x: 640, y: 480 }, length: 4 },
  ],
});
draw('stars-b', {
  seed: 1977,
  w: 800,
  h: 800,
  count: 140,
  band: { x: 400, y: 400, a: 0.75, width: 140 },
  pole: { x: -180, y: 1020 },
  circles: [560, 690, 820],
  rays: [{ angle: -0.95, from: 520, to: 860 }],
  chains: [{ from: { x: 380, y: 380 }, length: 5 }],
});
