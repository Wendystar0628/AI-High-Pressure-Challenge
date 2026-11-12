export function presentationData(data) {
  const hidden = new Set([
    "record",
    "controls",
    "inputHistory",
    "initialFlight",
    "_sampleParts",
    "_sampleKey",
    "lastClock",
    "pending",
    "history",
    "redo",
  ]);
  return JSON.parse(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(data).filter(([key]) => !hidden.has(key)),
      ),
    ),
  );
}
export function projectionTargets(engine, systemId, windowId) {
  return Object.values(engine.systems)
    .flatMap((s) => s.windows)
    .filter(
      (w) =>
        w.appId === "projection" &&
        w.data.sourceSystemId === systemId &&
        w.data.sourceWindowId === windowId,
    );
}
