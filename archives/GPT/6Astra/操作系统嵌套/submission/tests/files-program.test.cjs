const assert = require("node:assert/strict");
(async () => {
  const { Engine } = await import("../src/runtime.js");
  const e = new Engine({ nodes: [] }),
    s = e.create("outer");
  s.files["/Documents/a.txt"] = "a";
  s.files["/Documents/z.txt"] = "z";
  const w = {
    id: "files",
    appId: "files",
    data: { path: "/Documents" },
    state: "normal",
    z: 1,
  };
  s.windows.push(w);
  let code = JSON.parse(s.files["/System/files.nest"]);
  code.code.find((i) => i.name === "sort").value = '"descending"';
  code.code.find((i) => i.name === "allowDelete").value = "false";
  const p = e.process(
    s,
    "/System/files.nest",
    JSON.stringify(code),
    "app",
    w.id,
  );
  w.pid = p.id;
  for (let i = 0; i < 300; i++) e.tick();
  const names = w.data.listing.map((f) => f.path);
  assert.ok(
    names.indexOf("/Documents/z.txt") < names.indexOf("/Documents/a.txt"),
  );
  p.queue.push({
    event: {
      type: "files.request",
      payload: { id: 1, operation: "trash", paths: ["/Documents/a.txt"] },
    },
  });
  for (let i = 0; i < 100; i++) e.tick();
  assert.equal(p.responses[1].ok, false);
  assert.equal(s.files["/Documents/a.txt"], "a");
  p.state = "suspended";
  p.queue.push({
    event: {
      type: "files.request",
      payload: {
        id: 2,
        operation: "create",
        path: "/Documents",
        name: "held.txt",
      },
    },
  });
  for (let i = 0; i < 100; i++) e.tick();
  assert.equal(s.files["/Documents/held.txt"], undefined);
  p.state = "ready";
  for (let i = 0; i < 100; i++) e.tick();
  assert.equal(s.files["/Documents/held.txt"], "");
  s.budget = 24;
  p.queue.push({
    event: {
      type: "files.request",
      payload: {
        id: 3,
        operation: "paste",
        path: "/Documents",
        entries: [
          { name: "large.txt", files: { "": "X".repeat(12000) }, folders: [] },
        ],
      },
    },
  });
  let partial = false;
  for (let i = 0; i < 4000 && !p.responses[3]; i++) {
    e.tick();
    if (p.remaining) {
      partial = true;
      assert.equal(s.files["/Documents/large.txt"], undefined);
    }
  }
  assert.ok(partial);
  assert.equal(s.files["/Documents/large.txt"].length, 12000);
  assert.ok(p.responses[3].ok);
  console.log(
    "PASS: editable file sorting, delete policy, suspended requests and budgeted file copies",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
