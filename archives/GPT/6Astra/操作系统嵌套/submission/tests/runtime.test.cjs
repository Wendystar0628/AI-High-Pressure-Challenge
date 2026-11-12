const assert = require("node:assert/strict");
(async () => {
  const { Engine, program, cellValue, copy } = await import(
    "../src/runtime.js"
  );
  const scene = { version: 1, nodes: [], duration: 15 };
  let e = new Engine(scene),
    a = e.create("outer"),
    b = e.create("outer"),
    c = e.create(a.id),
    d = e.create(c.id);
  let p = e.process(d, "sum", e.root.files["/Programs/accumulate.nest"]);
  for (let i = 0; i < 100; i++) e.tick();
  assert.equal(p.vars.total, 5050);
  assert.equal(p.state, "ended");
  let spin = e.process(a, "spin", a.files["/Programs/spin.nest"]);
  for (let i = 0; i < 5; i++) e.tick();
  let before = spin.work;
  a.state = "paused";
  let clock = c.clock;
  for (let i = 0; i < 10; i++) e.tick();
  assert.equal(spin.work, before);
  assert.equal(c.clock, clock);
  assert.ok(b.clock > clock);
  e.advance(a, 1000, 1 / 30, true);
  assert.ok(spin.work > before);
  a.state = "running";
  let receiver = e.process(a, "receiver", a.files["/Programs/receiver.nest"]);
  let sender = e.process(a, "sender", a.files["/Programs/sender.nest"]);
  for (let i = 0; i < 10; i++) e.tick();
  assert.ok(receiver.output.includes("来自栖境的消息"));
  let snap = e.snapshot(a),
    fork = e.restore(a, snap, true);
  assert.notEqual(fork.id, a.id);
  assert.deepEqual(
    fork.processes.find((p) => p.name === "spin").vars,
    spin.vars,
  );
  let fc = fork.clock;
  a.state = "paused";
  for (let i = 0; i < 10; i++) e.tick();
  assert.ok(fork.clock > fc);
  let saved = e.snapshot(fork);
  for (let i = 0; i < 5; i++) e.tick();
  e.restore(fork, saved);
  assert.equal(e.systems[fork.id].clock, saved.systems[fork.id].clock);
  assert.equal(cellValue({ A1: "2", A2: "3", B1: "=SUM(A1:A2)*4" }, "B1"), 20);
  assert.equal(cellValue({ A1: "=1/0" }, "A1"), "#DIV/0!");
  assert.equal(cellValue({ A1: "=B1", B1: "=A1" }, "A1"), "#CYCLE!");
  e.root.files[b.kernelPath] = "invalid";
  e.restart(b);
  assert.equal(b.state, "error");
  assert.equal(e.root.state, "running");
  console.log(
    "PASS: four-level execution, pause, step, messages, fork, restore, formulas, kernel isolation",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
