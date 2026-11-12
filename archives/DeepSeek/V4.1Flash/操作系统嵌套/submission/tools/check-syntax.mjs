for (const p of ['../src/apps/player.js','../src/apps/charts.js','../src/apps/browser.js','../src/apps/files.js','../src/apps/spreadsheet.js','../src/apps/systems.js','../src/scene/heliScene.js','../src/core/os.js','../src/ui/shell.js','../src/renderer.js']) {
  try { await import(p); } catch (e) { console.log('FAIL', p, e.message); process.exitCode=1; }
}
console.log('all imported');
