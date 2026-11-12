// A deterministic surface query over the same static geometry submitted to the renderer.
// Geometry dimensions follow graphics.js: box/cylinder/cone have unit height,
// sphere has unit radius. The flight body uses the resource's contact clearance.
export function surfaceAt(resource, x, z) {
  let best = null;
  for (const node of resource.nodes || []) {
    if (
      node.parent ||
      node.type === "group" ||
      node.visibleAfter !== undefined ||
      node.collision === false ||
      (node.text && node.collision !== true)
    )
      continue;
    const [px, py, pz] = node.position || [0, 0, 0],
      [sx, sy, sz] = node.scale || [1, 1, 1],
      yaw = node.rotation?.[1] || 0;
    let dx = (x - px) * Math.cos(yaw) - (z - pz) * Math.sin(yaw),
      dz = (x - px) * Math.sin(yaw) + (z - pz) * Math.cos(yaw),
      y = -Infinity;
    if (node.type === "box" && Math.abs(dx) <= sx / 2 && Math.abs(dz) <= sz / 2)
      y = py + sy / 2;
    const radius = (dx / sx) ** 2 + (dz / sz) ** 2;
    if (node.type === "sphere" && radius <= 1)
      y = py + sy * Math.sqrt(1 - radius);
    if (node.type === "cylinder" && radius <= 1) y = py + sy / 2;
    if (node.type === "cone" && radius <= 1)
      y = py + sy / 2 - sy * Math.sqrt(radius);
    if (
      node.type === "plane" &&
      Math.abs(Math.abs(node.rotation?.[0] || 0) - Math.PI / 2) < 0.01 &&
      Math.abs(dx) <= sx / 2 &&
      Math.abs(dz) <= sy / 2
    )
      y = py;
    if (Number.isFinite(y) && (!best || y > best.y))
      best = {
        y,
        nodeId: node.id,
        landing:
          node.landing === true ||
          (node.type === "cylinder" && sx > 2 && sz > 2),
      };
  }
  return best;
}
