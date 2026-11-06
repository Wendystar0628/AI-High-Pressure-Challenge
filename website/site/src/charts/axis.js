// Axis helpers for the 0-100 score charts. Every 0-100 chart on a page uses
// the same fixed scale (never rescaled to the data), light grid at 20/40/80
// and the cyan pass line at 60 (leaderboard.md 视图).
import * as d3 from './d3.js';

export const SCORE_DOMAIN = [0, 100];
export const GRID = [20, 40, 80];
export const PASS = 60;

/** A fixed 0-100 linear scale onto [x0, x1]. */
export const scale100 = (x0, x1) => d3.scaleLinear().domain(SCORE_DOMAIN).range([x0, x1]).clamp(true);

/**
 * Grid lines and the pass line in an SVG group, spanning [y0, y1].
 *   drawGrid(g, x, { y0: 0, y1: 300, pass: true, grid: [20, 40, 80] })
 * Classes: .grid-line, .pass-line (styled in charts.css).
 */
export function drawGrid(g, x, { y0 = 0, y1 = 100, pass = true, grid = GRID } = {}) {
  const sel = d3.select(g);
  sel
    .selectAll('line.grid-line')
    .data(grid, (d) => d)
    .join('line')
    .attr('class', 'grid-line')
    .attr('x1', (d) => x(d))
    .attr('x2', (d) => x(d))
    .attr('y1', y0)
    .attr('y2', y1);
  sel
    .selectAll('line.pass-line')
    .data(pass ? [PASS] : [])
    .join('line')
    .attr('class', 'pass-line')
    .attr('x1', (d) => x(d))
    .attr('x2', (d) => x(d))
    .attr('y1', y0)
    .attr('y2', y1);
  return sel;
}

/**
 * Tick labels along the top or bottom: drawTicks(g, x, { y: 12, ticks: [0, 20, …, 100], format })
 * Class: .tick-label (field type, secondary ink).
 */
export function drawTicks(g, x, { y = 12, ticks = [0, 20, 40, 60, 80, 100], format = (d) => String(d), anchor = 'middle' } = {}) {
  return d3
    .select(g)
    .selectAll('text.tick-label')
    .data(ticks, (d) => d)
    .join('text')
    .attr('class', 'tick-label')
    .attr('x', (d) => x(d))
    .attr('y', y)
    .attr('text-anchor', anchor)
    .text(format);
}
