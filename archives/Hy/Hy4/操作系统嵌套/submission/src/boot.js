'use strict';
const params = new URLSearchParams(location.search);
const { Engine } = require('./engine');
const Runtime = require('./runtime');
const GFX = require('./gfx');
const UI = require('./ui');
const Bench = require('./bench');

const engine = new Engine({
  dataDir: params.get('dataDir'),
  width: parseInt(params.get('width'), 10) || window.innerWidth,
  height: parseInt(params.get('height'), 10) || window.innerHeight
});
engine.runtime = new Runtime(engine);
engine.gfx = new GFX(engine);
const ui = new UI(engine, engine.runtime, engine.gfx);
new Bench(engine, ui);
window.__nested = { engine, ui, runtime: engine.runtime, gfx: engine.gfx };
