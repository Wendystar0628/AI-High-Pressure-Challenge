const assert = require("node:assert/strict");
(async () => {
  const { Engine, program } = await import("../src/runtime.js");
  let e = new Engine({ nodes: [] }),
    s = e.create("outer");
  let source = program([
    { op: "set", name: "n", value: "10" },
    { op: "increment", name: "n" },
    { op: "end" },
  ]);
  let a = e.process(s, "first.nest", source);
  for (let i = 0; i < 40; i++) e.tick();
  assert.equal(a.vars.n, 11);
  let compiler = JSON.parse(s.files["/System/compiler.nest"]);
  compiler.code[10].value = 'target+"+2"';
  s.files["/System/compiler.nest"] = JSON.stringify(compiler);
  let b = e.process(s, "second.nest", source);
  for (let i = 0; i < 40; i++) e.tick();
  assert.equal(b.vars.n, 12);
  let self = e.process(
    s,
    "/System/compiler.nest",
    s.files["/System/compiler.nest"],
  );
  for (let i = 0; i < 80; i++) e.tick();
  assert.equal(self.state, "ended");
  assert.ok(s.files["/System/compiler.compiled.nest"]);
  assert.deepEqual(
    JSON.parse(s.files["/System/compiler.compiled.nest"]).code,
    compiler.code,
  );
  console.log(
    "PASS: compiler is a scheduled editable program; new opcode transformation and self compilation",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
