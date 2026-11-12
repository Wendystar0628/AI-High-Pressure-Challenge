const assert = require("node:assert/strict");
(async () => {
  const pages = await (await fetch("http://127.0.0.1:19106/json")).json(),
    page = pages.find((p) => p.url.includes("index.html")),
    ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0,
    pending = {},
    errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (pending[m.id]) {
      pending[m.id](m);
      delete pending[m.id];
    }
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails);
  };
  const call = (method, params = {}) =>
      new Promise((r) => {
        pending[++id] = r;
        ws.send(JSON.stringify({ id, method, params }));
      }),
    run = async (expression) => {
      let r = await call("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.result.exceptionDetails)
        throw Error(JSON.stringify(r.result.exceptionDetails));
      return r.result.result.value;
    },
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    click = (sel) =>
      run(`document.querySelector(${JSON.stringify(sel)}).click()`),
    dbl = (sel) =>
      run(
        `document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
      ),
    change = (sel, value, event = "change") =>
      run(
        `(()=>{let el=document.querySelector(${JSON.stringify(sel)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`,
      );
  await call("Runtime.enable");
  await run("bench.reset()");
  await dbl("[data-testid=desktop-icon][data-app-id=widgets]");
  await change("[data-testid=widget-timer-input]", "1");
  await click("[data-testid=widget-timer-start]");
  await change(".quick-scale", "1.15");
  await change(".quick-accent", "#c9b0e8");
  await change("[data-testid=widget-note-text]", "本轮质量检查便笺", "input");
  await click("[data-testid=widget-note-save]");
  await click("[data-testid=start-toggle][data-system-id=outer]");
  await click("[data-testid=launch-settings]");
  assert.equal(
    await run(`document.querySelector('[data-testid=settings-scale]').value`),
    "1.15",
  );
  await change("[data-testid=settings-scale]", "1");
  await sleep(1200);
  assert.equal(await run(`document.querySelector('.quick-scale').value`), "1");
  assert.ok(
    await run(
      `document.querySelector('[data-testid=widget-notifications]').textContent.includes('专注倒计时已结束')`,
    ),
  );
  await click("[data-testid=start-toggle][data-system-id=outer]");
  await click("[data-testid=launch-tasks]");
  assert.ok(
    await run(
      `document.querySelector('.task-table').textContent.includes('剩余 / KB')`,
    ),
  );
  await click("[data-testid=system-new][data-system-id=outer]");
  await dbl(
    "[data-testid=desktop-icon][data-app-id=files][data-system-id=inner-1]",
  );
  await sleep(500);
  await click(
    '[data-testid=files-nav][data-file-path="/Documents"][data-system-id=inner-1]',
  );
  await click("[data-testid=files-new-file][data-system-id=inner-1]");
  await change("[data-testid=dialog-input]", "程序驱动创建.txt");
  await click("[data-testid=dialog-ok]");
  for (
    let i = 0;
    i < 50 &&
    !(await run(
      `!!document.querySelector('[data-testid=files-item][data-file-path="/Documents/程序驱动创建.txt"]')`,
    ));
    i++
  )
    await sleep(100);
  assert.ok(
    await run(
      `!!document.querySelector('[data-testid=files-item][data-file-path="/Documents/程序驱动创建.txt"]')`,
    ),
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(
    "PASS: timer notification, note save, shared quick settings, process metrics and VM-driven child file creation",
  );
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
