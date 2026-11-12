// Figures of the reading pages, by key (common.js ORDER gives their numbers).
//   const fig = makeFigure('timeline', ctx);  // ctx: { data, c (about content), vars }
//   parent.append(fig.el); fig.arm();
import './figs.css';
import { heroFigure, howtoFigure, weightsFigure } from './overview.js';
import { reasonFigure, algoFigure, battleFigure, spatialFigure, drawingFigure } from './standard.js';
import { pointsFigure } from './points.js';
import { timelineFigure, isolationFigure, scheduleFigure, rulesFigure } from './format.js';
import { pipelineFigure, typesFigure, designscoreFigure } from './scoring.js';

export { ORDER, figNo } from './common.js';
export { dirStats } from './points.js';

const STANDARD = { reason: reasonFigure, algo: algoFigure, battle: battleFigure, spatial: spatialFigure, drawing: drawingFigure };

/** The figure for a category on the about page / a task page (its category figure or its points bar). */
export function categoryFigure(ctx, category, opts = {}) {
  if (STANDARD[category]) return STANDARD[category](ctx);
  return pointsFigure(ctx, category, opts);
}

export function makeFigure(key, ctx, opts = {}) {
  try {
    switch (key) {
      case 'hero':
        return heroFigure(ctx);
      case 'howto':
        return howtoFigure(ctx);
      case 'weights':
        return weightsFigure(ctx, opts);
      case 'timeline':
        return timelineFigure(ctx);
      case 'isolation':
        return isolationFigure(ctx);
      case 'schedule':
        return scheduleFigure(ctx);
      case 'rules':
        return rulesFigure(ctx);
      case 'pipeline':
        return pipelineFigure(ctx);
      case 'types':
        return typesFigure(ctx);
      case 'designscore':
        return designscoreFigure(ctx);
      default:
        return categoryFigure(ctx, key, opts);
    }
  } catch (e) {
    console.error(`figure ${key}:`, e);
    return null;
  }
}
