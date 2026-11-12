const assert = require("node:assert/strict");
(async () => {
  const { Engine } = await import("../src/runtime.js");
  const e = new Engine({ nodes: [] }),
    parent = e.create("outer"),
    child = e.create(parent.id);
  child.state = "paused";
  child.files["/Documents/large.txt"] = "payload".repeat(2000);
  parent.budget = 24;
  const p = e.queueSnapshot(parent, child, "/Snapshots/budget.snapshot");
  let partial = false;
  for (let i = 0; i < 8000 && p.state !== "ended" && p.state !== "error"; i++) {
    e.tick();
    assert.ok(parent.used <= parent.budget);
    if (p.pendingSnapshot && p.remaining > 0) {
      partial = true;
      assert.equal(parent.files["/Snapshots/budget.snapshot"], undefined);
    }
  }
  assert.equal(p.state, "ended", p.error);
  assert.ok(partial, "snapshot copying yields under budget");
  const snap = JSON.parse(parent.files["/Snapshots/budget.snapshot"]);
  assert.equal(
    snap.systems[child.id].files["/Documents/large.txt"],
    child.files["/Documents/large.txt"],
  );
  assert.equal(snap.systems[child.id].clock, 0);
  assert.ok(
    p.work > (JSON.stringify(snap).length / 256) * 2,
    "copy and write both charge",
  );
  console.log(
    "PASS: parent-budget snapshot copying, paused-child capture and deferred file commit",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
