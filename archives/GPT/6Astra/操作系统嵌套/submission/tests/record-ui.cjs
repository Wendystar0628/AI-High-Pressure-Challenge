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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    click = (sel) =>
      run(`document.querySelector(${JSON.stringify(sel)}).click()`),
    dbl = (sel) =>
      run(
        `document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
      ),
    shot = async (name) => {
      let r = await call("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(
        path.join(os.tmpdir(), name),
        Buffer.from(r.result.data, "base64"),
      );
    };
  await run("bench.reset()");
  await click("[data-testid=system-new][data-system-id=outer]");
  await click("[data-testid=rehearsal-start][data-system-id=inner-1]");
  await sleep(3400);
  await click("[data-testid=player-pause][data-system-id=inner-1]");
  await sleep(200);
  await click("[data-system-id=inner-1] .save-flight");
  for (
    let i = 0;
    i < 50 &&
    !(await run(`document.body.textContent.includes('排演记录已保存')`));
    i++
  )
    await sleep(100);
  assert.ok(await run(`document.body.textContent.includes('排演记录已保存')`));
  await dbl(
    "[data-testid=desktop-icon][data-system-id=inner-1][data-app-id=files]",
  );
  await click(
    '[data-testid=files-nav][data-system-id=inner-1][data-file-path="/Documents"]',
  );
  const file =
    '[data-testid=files-item][data-file-path="/Documents/排演记录-1.flight"]';
  for (
    let i = 0;
    i < 60 &&
    !(await run("!!document.querySelector(" + JSON.stringify(file) + ")"));
    i++
  )
    await sleep(100);
  await dbl(file);
  await sleep(500);
  let state = await run("bench.inspect()"),
    record = state.players.find((p) => p.scene.endsWith(".flight"));
  assert.ok(record);
  assert.equal(record.position, 0);
  assert.equal(record.state, "paused");
  assert.ok(record.duration > 2);
  const scope =
    '[data-testid=app-window][data-window-id="' + record.windowId + '"] ';
  await run(
    "(()=>{let el=document.querySelector(" +
      JSON.stringify(scope + "[data-testid=player-position]") +
      ');el.value="1.5";el.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
  await sleep(500);
  record = (await run("bench.inspect()")).players.find(
    (p) => p.windowId === record.windowId,
  );
  assert.equal(record.position, 1.5);
  assert.equal(record.state, "paused");
  await click(scope + "[data-testid=rehearsal-start]");
  await sleep(1300);
  await click(scope + "[data-testid=player-pause]");
  await sleep(200);
  await click(scope + ".save-flight");
  await sleep(900);
  await dbl(
    "[data-testid=desktop-icon][data-system-id=inner-1][data-app-id=files]",
  );
  await sleep(600);
  assert.ok(
    await run("!!document.querySelector(" + JSON.stringify(file) + ")"),
  );
  assert.ok(
    await run(
      "!!document.querySelector(" +
        JSON.stringify(file.replace("-1.flight", "-2.flight")) +
        ")",
    ),
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(
    "PASS: actual flight record file reopen, seek while paused, continuation and independent branch save",
  );
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
