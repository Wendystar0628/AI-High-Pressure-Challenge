const assert = require("assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path");
(async () => {
  let pages = await (await fetch("http://127.0.0.1:19106/json")).json(),
    page = pages.find((p) => p.url.includes("index.html"));
  let ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let i = 0,
    pending = {},
    errors = [];
  ws.onmessage = (e) => {
    let m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails);
    if (pending[m.id]) {
      pending[m.id](m);
      delete pending[m.id];
    }
  };
  let call = (method, params = {}) =>
    new Promise((r) => {
      let id = ++i;
      pending[id] = r;
      ws.send(JSON.stringify({ id, method, params }));
    });
  await call("Runtime.enable");
  async function run(expression) {
    let r = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result.exceptionDetails)
      throw Error(JSON.stringify(r.result.exceptionDetails));
    return r.result.result.value;
  }
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) =>
    run(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const dbl = (sel) =>
    run(
      `document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
    );
  await run("window.bench.reset()");
  await dbl(
    "[data-testid=desktop-icon][data-app-id=spreadsheet][data-system-id=outer]",
  );
  await run(
    `(()=>{let c=document.querySelector('[data-cell-address=D5]');c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));let f=document.querySelector('[data-testid=sheet-formula]');f.value='=SUM(D2:D4)';f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`,
  );
  assert.equal(
    await run(`document.querySelector('[data-cell-address=D5]').textContent`),
    "312",
  );
  await click("[data-testid=system-new][data-system-id=outer]");
  await click("[data-testid=start-toggle][data-system-id=inner-1]");
  await click("[data-testid=launch-charts][data-system-id=inner-1]");
  await click("[data-testid=chart-connect][data-system-id=inner-1]");
  await pause(900);
  assert.ok(await run(`!!document.querySelector('.chart-plot [data-point]')`));
  await click(
    "[data-app-id=charts][data-testid=app-window] [data-testid=window-project]",
  );
  await click(
    "[data-app-id=charts][data-testid=app-window] [data-testid=project-target][data-target-system-id=outer]",
  );
  await run(
    `(()=>{let c=document.querySelector('[data-cell-address=B2]');c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));let f=document.querySelector('[data-testid=sheet-formula]');f.value='30';f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`,
  );
  await pause(700);
  assert.ok(
    await run(
      `document.querySelector('[data-app-id=projection] .chart-plot').textContent.includes('180')`,
    ),
  );
  await click("[data-testid=system-new][data-system-id=inner-1]");
  await click("[data-testid=system-new][data-system-id=inner-2]");
  await pause(600);
  let state = await run("window.bench.inspect()");
  assert.equal(state.systems.length, 4);
  assert.ok(state.systems.find((s) => s.id === "inner-3").clock > 0);
  await dbl(
    "[data-testid=desktop-icon][data-system-id=inner-3][data-app-id=files]",
  );
  for (
    let i = 0;
    i < 60 &&
    !(await run(
      `!!document.querySelector('[data-testid=files-item][data-system-id=inner-3]')`,
    ));
    i++
  )
    await pause(100);
  assert.ok(
    await run(
      `!!document.querySelector('[data-testid=files-item][data-system-id=inner-3]')`,
    ),
  );
  await click("[data-testid=player-play][data-system-id=inner-3]");
  await pause(800);
  state = await run("window.bench.inspect()");
  assert.ok(state.players.find((p) => p.systemId === "inner-3").position > 0);
  await click("[data-testid=player-pause][data-system-id=inner-3]");
  await pause(200);
  let pos = (await run("window.bench.inspect()")).players.find(
    (p) => p.systemId === "inner-3",
  ).position;
  await pause(400);
  assert.equal(
    (await run("window.bench.inspect()")).players.find(
      (p) => p.systemId === "inner-3",
    ).position,
    pos,
  );
  let shot = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    path.join(os.tmpdir(), "nest-os-smoke.png"),
    Buffer.from(shot.result.data, "base64"),
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(
    "PASS: UI formula, chart FIFO updates and projection, four desktops, deep files, playback pause.",
  );
  console.log(JSON.stringify(state));
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
