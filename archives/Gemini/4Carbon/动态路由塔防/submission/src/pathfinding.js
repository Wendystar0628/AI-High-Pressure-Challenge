// 动态路由寻路引擎（加权 Dijkstra、连通性守卫、改道预览与洪泛团破点导航）

import { TILE, ROUTE_COSTS, TILE_SIZE } from './constants.js';

const DIRS = [
  { dx: 0, dz: 1 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: -1 },
  { dx: -1, dz: 0 }
];

export function keyOf(x, z) {
  return `${x},${z}`;
}

export function gridToWorld(map, gx, gz, y = 0) {
  const ox = -((map.cols - 1) * TILE_SIZE) / 2;
  const oz = -((map.rows - 1) * TILE_SIZE) / 2;
  return {
    x: ox + gx * TILE_SIZE,
    y,
    z: oz + gz * TILE_SIZE
  };
}

export function worldToGrid(map, wx, wz) {
  const ox = -((map.cols - 1) * TILE_SIZE) / 2;
  const oz = -((map.rows - 1) * TILE_SIZE) / 2;
  const gx = Math.round((wx - ox) / TILE_SIZE);
  const gz = Math.round((wz - oz) / TILE_SIZE);
  return { gx, gz };
}

/**
 * 判断格子对地面敌人是否可进入
 * blockedSet: Set<"x,z"> 包含已隔离交换节点、Boss黑洞、Boss锁死路段
 */
export function isGroundPassable(map, gx, gz, blockedSet) {
  if (gx < 0 || gx >= map.cols || gz < 0 || gz >= map.rows) return false;
  const t = map.grid[gz][gx];
  if (t === TILE.VOID || t === TILE.PLATFORM || t === TILE.OBSTACLE) return false;
  if (blockedSet && blockedSet.has(keyOf(gx, gz))) return false;
  return true;
}

/**
 * 获取进入格子 (gx, gz) 的通行时间权重开销
 * downgradedSet: Set<"x,z"> 被协议降级覆盖的标准链路格
 */
export function getTileMoveCost(map, gx, gz, downgradedSet) {
  const t = map.grid[gz][gx];
  if (t === TILE.LEGACY) return ROUTE_COSTS.LEGACY;
  if (downgradedSet && downgradedSet.has(keyOf(gx, gz)) && t === TILE.LINK) {
    return ROUTE_COSTS.LEGACY;
  }
  return ROUTE_COSTS.LINK;
}

/**
 * 从所有出口反向运行多源 Dijkstra，生成全图到最近出口的距离场 distField 与下一跳 nextHop
 * 注意：即便某个格子自身处于新近被隔离状态（例如场上有敌人正站在该格内），
 * 我们依然允许从任何格子“走出”到相邻可通行格（但不允许其他格走进被隔离格）！
 */
export function computeDistanceField(map, blockedSet = new Set(), downgradedSet = new Set()) {
  const cols = map.cols;
  const rows = map.rows;
  const dist = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  const next = Array.from({ length: rows }, () => Array(cols).fill(null));
  const targetExit = Array.from({ length: rows }, () => Array(cols).fill(null));

  // 简易优先队列（地图仅 15x11 = 165 格，线性/二叉堆极快且完全确定性）
  const pq = [];
  const push = (item) => {
    pq.push(item);
    pq.sort((a, b) => (a.d !== b.d ? a.d - b.d : a.z !== b.z ? a.z - b.z : a.x - b.x));
  };

  for (const ex of map.exits) {
    if (!blockedSet.has(keyOf(ex.x, ex.z))) {
      dist[ex.z][ex.x] = 0;
      targetExit[ex.z][ex.x] = ex.id;
      push({ x: ex.x, z: ex.z, d: 0 });
    }
  }

  // 第一阶段：扩展所有可通行格
  while (pq.length > 0) {
    const cur = pq.shift();
    if (cur.d > dist[cur.z][cur.x] + 1e-9) continue;

    const stepIntoCurCost = getTileMoveCost(map, cur.x, cur.z, downgradedSet);

    for (const { dx, dz } of DIRS) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;
      const nt = map.grid[nz][nx];
      if (nt === TILE.VOID || nt === TILE.PLATFORM || nt === TILE.OBSTACLE) continue;

      // 如果 (nx, nz) 是普通可通行格，可以从 (nx, nz) 走进 cur（因为 cur 已在队列中说明 cur 可通行）
      const nd = cur.d + stepIntoCurCost;
      if (nd + 1e-6 < dist[nz][nx]) {
        dist[nz][nx] = nd;
        next[nz][nx] = { x: cur.x, z: cur.z };
        targetExit[nz][nx] = targetExit[cur.z][cur.x];
        // 只有当 (nx, nz) 自身未被隔离时，其他格子才能进一步通过 (nx, nz)！
        if (!blockedSet.has(keyOf(nx, nz))) {
          push({ x: nx, z: nz, d: nd });
        }
      }
    }
  }

  return { dist, next, targetExit };
}

/**
 * 根据距离场追踪从起点 (sx, sz) 到出口的完整网格路径
 */
export function traceRouteFromField(field, sx, sz, maxSteps = 200) {
  if (!Number.isFinite(field.dist[sz]?.[sx])) return null;
  const path = [{ x: sx, z: sz }];
  let cx = sx;
  let cz = sz;
  let guard = 0;
  while (field.next[cz][cx] && guard++ < maxSteps) {
    const n = field.next[cz][cx];
    path.push({ x: n.x, z: n.z });
    cx = n.x;
    cz = n.z;
  }
  return {
    path,
    cost: field.dist[sz][sx],
    exitId: field.targetExit[sz][sx]
  };
}

/**
 * 计算所有入口当前的路线表
 */
export function computeAllEntryRoutes(map, blockedSet = new Set(), downgradedSet = new Set()) {
  const field = computeDistanceField(map, blockedSet, downgradedSet);
  const routes = {};
  for (const entry of map.entries) {
    routes[entry.id] = traceRouteFromField(field, entry.x, entry.z);
  }
  return { field, routes };
}

/**
 * 判断两条路径是否实质不同
 */
export function routesDiffer(r1, r2) {
  if (!r1 || !r2) return r1 !== r2;
  if (r1.path.length !== r2.path.length) return true;
  for (let i = 0; i < r1.path.length; i++) {
    if (r1.path[i].x !== r2.path[i].x || r1.path[i].z !== r2.path[i].z) return true;
  }
  return false;
}

/**
 * 连通性校验（2.7.4 保持连通）：
 * 检查假设将 candidateBlockedSet 应用后：
 * 1) 是否所有入口都有可达中枢出口的路径；
 * 2) 是否场上所有存活的地面敌人从其所在格仍有可达中枢出口的路径。
 * 返回 { ok, blockedEntries: [], trappedEnemies: [], previewField, previewRoutes }
 */
export function validateConnectivity(map, candidateBlockedSet, downgradedSet, groundEnemies = []) {
  const field = computeDistanceField(map, candidateBlockedSet, downgradedSet);
  const blockedEntries = [];
  const previewRoutes = {};

  for (const entry of map.entries) {
    if (candidateBlockedSet.has(keyOf(entry.x, entry.z)) || !Number.isFinite(field.dist[entry.z][entry.x])) {
      blockedEntries.push(entry);
    } else {
      previewRoutes[entry.id] = traceRouteFromField(field, entry.x, entry.z);
    }
  }

  const trappedEnemies = [];
  for (const e of groundEnemies) {
    if (e.dead || e.flying) continue;
    const { gx, gz } = worldToGrid(map, e.x, e.z);
    if (gx < 0 || gx >= map.cols || gz < 0 || gz >= map.rows || !Number.isFinite(field.dist[gz]?.[gx])) {
      trappedEnemies.push(e);
    }
  }

  return {
    ok: blockedEntries.length === 0 && trappedEnemies.length === 0,
    blockedEntries,
    trappedEnemies,
    previewField: field,
    previewRoutes
  };
}

/**
 * 洪泛团破点导航：寻找从 (sx, sz) 出发距离在 maxSteps 内的被隔离交换节点的可通行邻格
 * 返回 { nodeX, nodeZ, standX, standZ, path } 或 null
 */
export function findNearestIsolatedNodeApproach(map, sx, sz, isolatedNodesSet, blockedSet, maxSteps = 6) {
  if (!isolatedNodesSet || isolatedNodesSet.size === 0) return null;

  // BFS 从 (sx, sz) 搜索可通行格
  const visited = new Map();
  const parent = new Map();
  const startKey = keyOf(sx, sz);
  visited.set(startKey, 0);
  const queue = [{ x: sx, z: sz, d: 0 }];

  let bestMatch = null;

  while (queue.length > 0) {
    const cur = queue.shift();
    // 检查 cur 是否紧邻某个被隔离节点
    for (const { dx, dz } of DIRS) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      const nk = keyOf(nx, nz);
      if (isolatedNodesSet.has(nk)) {
        bestMatch = { nodeX: nx, nodeZ: nz, standX: cur.x, standZ: cur.z, dist: cur.d };
        break;
      }
    }
    if (bestMatch) break;
    if (cur.d >= maxSteps) continue;

    for (const { dx, dz } of DIRS) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      const nk = keyOf(nx, nz);
      if (visited.has(nk)) continue;
      if (!isGroundPassable(map, nx, nz, blockedSet)) continue;
      visited.set(nk, cur.d + 1);
      parent.set(nk, cur);
      queue.push({ x: nx, z: nz, d: cur.d + 1 });
    }
  }

  if (!bestMatch) return null;

  // 回溯路径
  const path = [];
  let ck = keyOf(bestMatch.standX, bestMatch.standZ);
  let curPos = { x: bestMatch.standX, z: bestMatch.standZ };
  while (curPos) {
    path.unshift({ x: curPos.x, z: curPos.z });
    const p = parent.get(ck);
    if (!p) break;
    curPos = p;
    ck = keyOf(p.x, p.z);
  }

  return {
    nodeX: bestMatch.nodeX,
    nodeZ: bestMatch.nodeZ,
    standX: bestMatch.standX,
    standZ: bestMatch.standZ,
    path
  };
}

/**
 * 寻找从 (sx, sz) 到目标道路格 (tx, tz) 在 maxSteps 步以内的合法道路路径（供蜜罐诱敌牵引地面单位使用，严禁越障）
 */
export function findRoadPathToTarget(map, sx, sz, tx, tz, blockedSet, maxSteps = 4) {
  if (sx === tx && sz === tz) return [{ x: sx, z: sz }];
  const visited = new Map();
  const parent = new Map();
  const startKey = keyOf(sx, sz);
  visited.set(startKey, 0);
  const queue = [{ x: sx, z: sz, d: 0 }];

  let found = false;
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.x === tx && cur.z === tz) {
      found = true;
      break;
    }
    if (cur.d >= maxSteps) continue;
    for (const { dx, dz } of DIRS) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      const nk = keyOf(nx, nz);
      if (visited.has(nk)) continue;
      if (!isGroundPassable(map, nx, nz, blockedSet)) continue;
      visited.set(nk, cur.d + 1);
      parent.set(nk, cur);
      queue.push({ x: nx, z: nz, d: cur.d + 1 });
    }
  }

  if (!found) return null;
  const path = [];
  let ck = keyOf(tx, tz);
  let curPos = { x: tx, z: tz };
  while (curPos) {
    path.unshift({ x: curPos.x, z: curPos.z });
    const p = parent.get(ck);
    if (!p) break;
    curPos = p;
    ck = keyOf(p.x, p.z);
  }
  return path;
}
