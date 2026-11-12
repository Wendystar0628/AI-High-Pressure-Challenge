const assert = require("node:assert/strict");
(async () => {
  const { Engine, program } = await import("../src/runtime.js");
  const e = new Engine({ nodes: [] }),
    s = e.create("outer");
  s.budget = 24;
  const source = {
    id: "source",
    appId: "player",
    data: {
      position: 3,
      frameTime: 3,
      resource: { nodes: [{ id: "cube", color: "purple" }] },
      record: Array(100).fill(2),
      label: "x".repeat(5000),
    },
  };
  const target = {
    id: "target",
    appId: "projection",
    data: { sourceSystemId: s.id, sourceWindowId: "source" },
  };
  s.windows.push(source);
  e.root.windows.push(target);
  const p = e.process(
    s,
    "present",
    program([{ op: "sys", call: "app.present" }, { op: "end" }]),
    "app",
    source.id,
  );
  let partial = false;
  for (let i = 0; i < 1000 && p.state !== "ended"; i++) {
    e.tick();
    if (p.pendingPresentation && p.remaining) {
      partial = true;
      assert.equal(target.data.frame, undefined);
    }
  }
  assert.ok(partial);
  assert.equal(target.data.frame.position, 3);
  assert.equal(target.data.frame.record, undefined);
  source.data.resource.nodes[0].color = "yellow";
  source.data.position = 9;
  assert.equal(target.data.frame.resource.nodes[0].color, "purple");
  assert.equal(target.data.frame.position, 3);
  target.data.frame.resource.nodes[0].color = "green";
  assert.equal(source.presentation.resource.nodes[0].color, "purple");
  console.log(
    "PASS: paid source display submissions and isolated projection copies",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
