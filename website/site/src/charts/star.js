// The four-point star — the only star shape on the site (skill rule).
// Same drawing as stellar-ui-skill/assets/stars/draw-stars.mjs star().
//
//   starPath(cx, cy, tip, waist)   SVG path data; tip = centre-to-tip distance
//   starD(tip, waist)              centred on 0,0 (for <path transform="translate(x,y)">)
//   tipForArea(weight, k)          tip length so the star's area grows with weight
//   bestStar(parent, x, y, size)   append the flare "best" star (with ink edge on light)

const n = (v) => +v.toFixed(2);

export function starPath(x, y, tip, waist = 0.4) {
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

export const starD = (tip, waist = 0.4) => starPath(0, 0, tip, waist);

/** Area grows linearly with weight: tip = k * sqrt(weight). */
export const tipForArea = (weight, k = 3.4) => k * Math.sqrt(Math.max(0, weight));

/** A flare four-point star marking a best value (class "best-star", styled in charts.css). */
export function bestStar(parent, x, y, tip = 6) {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('class', 'best-star');
  p.setAttribute('d', starPath(x, y, tip, 0.36));
  p.setAttribute('aria-hidden', 'true');
  parent.append(p);
  return p;
}
