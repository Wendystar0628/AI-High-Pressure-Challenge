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
  await dbl(
    "[data-testid=desktop-icon][data-app-id=browser][data-system-id=outer]",
  );
  let loaded = false;
  for (let i = 0; i < 40; i++) {
    const state = await run("bench.inspect()");
    if (state.browsers[0]?.loadState === "complete") {
      loaded = true;
      break;
    }
    await sleep(500);
  }
  assert.ok(loaded, "real external webpage should finish loading");
  const title = await run(
    `document.querySelector('webview').executeJavaScript('document.title')`,
  );
  const links = await run(
    `document.querySelector('webview').executeJavaScript('document.querySelectorAll("a").length')`,
  );
  assert.ok(title.includes("哔哩") || title.toLowerCase().includes("bilibili"));
  assert.ok(links > 5);
  await click("[data-testid=browser-new-tab]");
  await sleep(700);
  assert.equal((await run("bench.inspect()")).browsers.length, 2);
  await click(
    "[data-app-id=browser][data-testid=app-window] [data-testid=window-close]",
  );
  assert.equal(await run(`document.querySelectorAll('webview').length`), 0);
  await click("[data-testid=start-toggle][data-system-id=outer]");
  await click("[data-testid=launch-tasks]");
  await run(
    `(()=>{let el=document.querySelector('[data-testid=tasks-memory][data-system-id=outer]');el.value='131072';el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await click("[data-testid=system-new][data-system-id=outer]");
  await click("[data-testid=start-toggle][data-system-id=inner-1]");
  await click("[data-testid=launch-tasks][data-system-id=inner-1]");
  await run(
    `(()=>{let el=document.querySelector('[data-testid=tasks-memory][data-system-id=inner-1]');el.value='131072';el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  for (let i = 0; i < 19; i++)
    await dbl(
      "[data-testid=desktop-icon][data-app-id=player][data-system-id=inner-1]",
    );
  await sleep(1200);
  const canvases = await run(
    `Array.from(document.querySelectorAll('[data-testid=player-view]')).map(c=>({width:c.width,height:c.height,alpha:c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[3]}))`,
  );
  assert.equal(canvases.length, 20);
  assert.ok(
    canvases.every((c) => c.width > 0 && c.height > 0 && c.alpha === 255),
  );
  await shot("nest-twenty-views.png");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(
    "PASS: real bilibili webpage, multiple tabs and release; twenty populated 3D views sharing the renderer",
  );
  await run("bench.reset()");
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
