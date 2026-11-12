const assert = require("node:assert/strict");
(async () => {
  const { surfaceAt } = await import("../src/flight.js"),
    { cellValue, expr } = await import("../src/runtime.js");
  const resource = {
    nodes: [
      { id: "ground", type: "box", position: [0, -0.5, 0], scale: [20, 1, 20] },
      { id: "hill", type: "sphere", position: [3, 0, 0], scale: [2, 3, 2] },
      {
        id: "pad",
        type: "cylinder",
        position: [-4, 0.4, 0],
        scale: [3, 0.2, 3],
      },
    ],
  };
  assert.equal(surfaceAt(resource, 0, 0).y, 0);
  assert.equal(surfaceAt(resource, 3, 0).y, 3);
  assert.equal(surfaceAt(resource, -4, 0).y, 0.5);
  assert.ok(surfaceAt(resource, -4, 0).landing);
  resource.nodes[1].scale[1] = 7;
  assert.equal(surfaceAt(resource, 3, 0).y, 7);
  assert.equal(surfaceAt(resource, 40, 40), null);
  assert.equal(cellValue({ A1: "=SUM(A0:B2)" }, "A1"), "#REF!");
  assert.equal(cellValue({ A1: "=SUM(K1:M2)" }, "A1"), "#REF!");
  assert.equal(cellValue({ A1: "=1 2" }, "A1"), "#ERROR!");
  assert.equal(expr(".5+1.5"), 2);
  assert.throws(() => expr("2;3"));
  console.log(
    "PASS: resource-driven terrain/pad height and strict spreadsheet expression/reference errors",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
