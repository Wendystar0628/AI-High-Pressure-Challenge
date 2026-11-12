const assert = require("node:assert/strict");
(async () => {
  const { Engine } = await import("../src/runtime.js");
  for (const mode of ["front", "back"]) {
    const e = new Engine({ nodes: [] }),
      s = e.create("outer"),
      wm = s.processes.find((p) => p.kind === "wm");
    e.end(s, wm);
    const code = JSON.parse(s.files["/System/window-manager.nest"]);
    code.code.find((i) => i.name === "hitRule").value = JSON.stringify(mode);
    e.process(s, "/System/window-manager.nest", JSON.stringify(code), "wm");
    s.windows = [
      { id: "low", z: 2, state: "normal" },
      { id: "high", z: 8, state: "normal" },
      { id: "outside", z: 20, state: "normal" },
    ];
    s.input.push({
      type: "window.pointer",
      x: 50,
      y: 50,
      windows: [
        { id: "low", z: 2, left: 0, top: 0, right: 100, bottom: 100 },
        { id: "high", z: 8, left: 20, top: 20, right: 100, bottom: 100 },
        { id: "outside", z: 20, left: 200, top: 200, right: 300, bottom: 300 },
      ],
    });
    for (let i = 0; i < 200; i++) e.tick();
    assert.equal(s.focusedWindow, mode === "front" ? "high" : "low");
  }
  console.log(
    "PASS: window program performs coordinate hit testing and editable overlap policy",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
