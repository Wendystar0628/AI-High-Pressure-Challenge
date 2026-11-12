const assert = require("node:assert/strict");
(async () => {
  const { Engine, program } = await import("../src/runtime.js");
  let e = new Engine({ nodes: [] }),
    s = e.create("outer");
  let kernel = JSON.parse(e.root.files[s.kernelPath]);
  kernel.services["math.double"] = [
    { op: "set", name: "result", value: "input*3" },
    { op: "return", value: "result" },
  ];
  e.root.files[s.kernelPath] = JSON.stringify(kernel);
  e.restart(s);
  let p = e.process(
    s,
    "custom",
    program([
      { op: "sys", call: "math.double", value: "14", name: "answer" },
      {
        op: "sys",
        call: "file.write",
        path: '"/Documents/result.txt"',
        value: '"saved by service"',
      },
      { op: "end" },
    ]),
  );
  for (let i = 0; i < 40; i++) e.tick();
  assert.equal(p.vars.answer, 42);
  assert.equal(s.files["/Documents/result.txt"], "saved by service");
  assert.equal(p.state, "ended");
  let user = e.process(s, "loop", s.files["/Programs/spin.nest"]);
  s.grant = 1;
  let time = s.clock,
    work = user.work;
  for (let i = 0; i < 30; i++) e.tick();
  assert.ok(s.clock > time + 0.9);
  assert.equal(user.work, work);
  s.grant = 1800;
  for (let i = 0; i < 10; i++) e.tick();
  assert.ok(user.work > work);
  let other = e.create("outer");
  e.root.storage = e.storageUsed(e.root) + 1;
  assert.throws(
    () => e.write(other, "/Documents/big.txt", "x".repeat(4000)),
    /存储配额/,
  );
  assert.equal(e.root.state, "running");
  let partial = e.process(
    s,
    "slow",
    program([
      {
        op: "sys",
        call: "file.write",
        path: '"/Documents/partial.txt"',
        value: '"' + "a".repeat(1500) + '"',
      },
      { op: "end" },
    ]),
  );
  partial.quota = 1;
  e.root.storage = 32768;
  e.tick();
  assert.equal(s.files["/Documents/partial.txt"], undefined);
  let snap = e.snapshot(s);
  for (let i = 0; i < 80; i++) e.tick();
  assert.equal(s.files["/Documents/partial.txt"].length, 1500);
  let savedClock = snap.systems[s.id].clock;
  e.restore(s, snap);
  assert.equal(e.systems[s.id].clock, savedClock);
  assert.equal(e.systems[s.id].files["/Documents/partial.txt"], undefined);
  for (let i = 0; i < 80; i++) e.tick();
  assert.equal(e.systems[s.id].files["/Documents/partial.txt"].length, 1500);
  console.log(
    "PASS: editable syscall handler, real file service, time independent of budget, shared storage, resumable paid work and snapshot",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
