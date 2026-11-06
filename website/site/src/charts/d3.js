// D3 for the site. Import D3 from here, not from 'd3' directly:
//   import * as d3 from '../../charts/d3.js';
// d3's package says it has no side effects, so a bundler drops the part of
// d3-transition that adds selection.transition(); importing it here keeps
// transitions working in the build.
import 'd3-transition';

export * from 'd3';
