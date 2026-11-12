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
  await click("[data-testid=window-project][data-system-id=inner-1]");
  await click("[data-testid=project-target][data-target-system-id=outer]");
  await click("[data-app-id=projection] [data-testid=window-maximize]");
  await click("[data-app-id=projection] [data-testid=player-play]");
  await sleep(5500);
  await shot("nest-flight-airborne.png");
  await sleep(7300);
  await shot("nest-flight-impact.png");
  await sleep(4000);
  let state = await run("bench.inspect()");
  assert.equal(state.players[0].position, 15);
  assert.equal(state.players[0].state, "paused");
  await click("[data-app-id=projection] [data-testid=player-stop]");
  await click("[data-app-id=projection] [data-testid=window-minimize]");
  await dbl(
    "[data-testid=desktop-icon][data-app-id=systems][data-system-id=outer]",
  );
  await click(".system-card .snapshot");
  for (
    let i = 0;
    i < 100 && !(await run(`document.body.textContent.includes("快照已保存")`));
    i++
  )
    await sleep(100);
  assert.ok(await run(`document.body.textContent.includes("快照已保存")`));
  await click("[data-testid=system-pause]");
  let a = (await run("bench.inspect()")).systems.find(
    (s) => s.id === "inner-1",
  ).clock;
  await sleep(400);
  assert.equal(
    (await run("bench.inspect()")).systems.find((s) => s.id === "inner-1")
      .clock,
    a,
  );
  await click("[data-testid=system-resume]");
  await sleep(200);
  await click(".system-card .restore");
  await sleep(200);
  assert.equal((await run("bench.inspect()")).projections.length, 1);
  await click("[data-testid=rehearsal-start][data-system-id=inner-1]");
  await sleep(3000);
  await click("[data-testid=player-pause][data-system-id=inner-1]");
  await click("[data-system-id=inner-1] .save-flight");
  for (
    let i = 0;
    i < 30 &&
    !(await run(`document.body.textContent.includes("排演记录已保存")`));
    i++
  )
    await sleep(100);
  assert.ok(await run(`document.body.textContent.includes('排演记录已保存')`));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(
    "PASS: full 15-second projected show, subtree pause/restore, projection identity, rehearsal and record save",
  );
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
