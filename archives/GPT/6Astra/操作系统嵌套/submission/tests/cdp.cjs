const fs = require("fs"),
  os = require("os"),
  path = require("path");
(async () => {
  let pages = await (await fetch("http://127.0.0.1:19106/json")).json();
  let page = pages.find(
    (p) => p.type === "page" && p.url.includes("index.html"),
  );
  if (!page) throw Error(JSON.stringify(pages));
  let ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0,
    pending = {};
  ws.onmessage = (e) => {
    let m = JSON.parse(e.data);
    if (pending[m.id]) {
      pending[m.id](m);
      delete pending[m.id];
    }
  };
  let call = (method, params = {}) =>
    new Promise((r) => {
      let i = ++id;
      pending[i] = r;
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  let expression = process.argv[2] || "window.bench.inspect()";
  let result = await call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log(JSON.stringify(result.result || result));
  if (process.argv.includes("--shot")) {
    let shot = await call("Page.captureScreenshot", { format: "png" });
    let file = path.join(os.tmpdir(), "nest-os-check.png");
    fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    console.log(file);
  }
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
