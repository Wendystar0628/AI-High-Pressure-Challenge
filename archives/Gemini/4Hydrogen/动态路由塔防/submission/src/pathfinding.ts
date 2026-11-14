import { GAME_CONSTANTS } from './config';
import type {
  EnemyEntity,
  GridCoord,
  MapDef,
  RoutePreviewResult,
  TileState,
  TileType,
} from './types';

export function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

export function charToTileType(ch: string): TileType {
  switch (ch) {
    case '=':
      return 'link';
    case '~':
      return 'legacy';
    case 'P':
      return 'platform';
    case 'N':
      return 'node';
    case 'O':
      return 'obstacle';
    case 'A':
    case 'B':
    case 'C':
      return 'entry';
    case 'M':
    case 'X':
    case 'Y':
      return 'exit';
    default:
      return 'void';
  }
}

export function createTilesFromMap(map: MapDef): TileState[][] {
  const grid: TileState[][] = [];
  for (let y = 0; y < map.rows; y++) {
    const rowStr = map.grid[y] ?? '';
    const row: TileState[] = [];
    for (let x = 0; x < map.cols; x++) {
      const ch = rowStr[x] ?? '.';
      const type = charToTileType(ch);
      const entry = map.entries.find((e) => e.x === x && e.y === y);
      const exit = map.exits.find((e) => e.x === x && e.y === y);
      row.push({
        x,
        y,
        type,
        entryId: entry?.id,
        exitId: exit?.id,
        nodeName: map.nodeNames[keyOf(x, y)],
        towerId: null,
        isolatorId: null,
        nodeCooldown: 0,
        downgradeTimer: 0,
        blackholeTimer: 0,
        lockdownTimer: 0,
        telegraphType: 'none',
        telegraphTimer: 0,
      });
    }
    grid.push(row);
  }
  return grid;
}

export function isTileWalkable(
  tile: TileState,
  overrideBlockedKeys?: Set<string>
): boolean {
  if (
    tile.type === 'void' ||
    tile.type === 'obstacle' ||
    tile.type === 'platform'
  ) {
    return false;
  }
  const k = keyOf(tile.x, tile.y);
  if (overrideBlockedKeys && overrideBlockedKeys.has(k)) {
    return false;
  }
  if (tile.blackholeTimer > 0 || tile.lockdownTimer > 0) {
    return false;
  }
  if (tile.type === 'node') {
    if (tile.towerId !== null || tile.isolatorId !== null) {
      return false;
    }
  }
  return true;
}

export function getTileMoveCost(
  tile: TileState,
  extraDowngradeKeys?: Set<string>
): number {
  const k = keyOf(tile.x, tile.y);
  if (
    tile.type === 'legacy' ||
    tile.downgradeTimer > 0 ||
    (extraDowngradeKeys && extraDowngradeKeys.has(k))
  ) {
    return GAME_CONSTANTS.LEGACY_PATH_COST;
  }
  return 1.0;
}

const DIRS: GridCoord[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
];

export function findShortestPathToAnyExit(
  tiles: TileState[][],
  startX: number,
  startY: number,
  exits: GridCoord[],
  overrideBlockedKeys?: Set<string>,
  extraDowngradeKeys?: Set<string>,
  allowStartBlocked = false
): GridCoord[] | null {
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  if (startX < 0 || startX >= cols || startY < 0 || startY >= rows) return null;

  const startTile = tiles[startY][startX];
  if (!allowStartBlocked && !isTileWalkable(startTile, overrideBlockedKeys)) {
    return null;
  }

  const exitKeys = new Set(exits.map((e) => keyOf(e.x, e.y)));
  const dist = new Float64Array(rows * cols).fill(Infinity);
  const prev = new Int32Array(rows * cols).fill(-1);
  const visited = new Uint8Array(rows * cols);

  const idx = (x: number, y: number) => y * cols + x;
  const startIdx = idx(startX, startY);
  dist[startIdx] = 0;

  // Simple priority queue via small array (grid is ~165 tiles)
  const queue: number[] = [startIdx];

  while (queue.length > 0) {
    // Pop smallest dist
    let bestPos = 0;
    let bestDist = dist[queue[0]];
    for (let i = 1; i < queue.length; i++) {
      const d = dist[queue[i]];
      if (d < bestDist) {
        bestDist = d;
        bestPos = i;
      }
    }
    const curr = queue[bestPos];
    queue[bestPos] = queue[queue.length - 1];
    queue.pop();

    if (visited[curr]) continue;
    visited[curr] = 1;

    const cx = curr % cols;
    const cy = Math.floor(curr / cols);
    if (exitKeys.has(keyOf(cx, cy))) {
      // Reconstruct path
      const path: GridCoord[] = [];
      let trace = curr;
      while (trace !== -1) {
        path.push({ x: trace % cols, y: Math.floor(trace / cols) });
        trace = prev[trace];
      }
      path.reverse();
      return path;
    }

    for (const d of DIRS) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const nTile = tiles[ny][nx];
      if (!isTileWalkable(nTile, overrideBlockedKeys)) continue;

      const stepCost = getTileMoveCost(nTile, extraDowngradeKeys);
      const nIdx = idx(nx, ny);
      const nd = dist[curr] + stepCost;
      if (nd < dist[nIdx]) {
        dist[nIdx] = nd;
        prev[nIdx] = curr;
        queue.push(nIdx);
      }
    }
  }

  return null;
}

export function findShortestPathToTarget(
  tiles: TileState[][],
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  overrideBlockedKeys?: Set<string>
): GridCoord[] | null {
  return findShortestPathToAnyExit(
    tiles,
    startX,
    startY,
    [{ x: targetX, y: targetY }],
    overrideBlockedKeys
  );
}

export function computeAllEntryRoutes(
  tiles: TileState[][],
  map: MapDef,
  overrideBlockedKeys?: Set<string>,
  extraDowngradeKeys?: Set<string>
): Record<string, GridCoord[]> {
  const routes: Record<string, GridCoord[]> = {};
  const exitCoords = map.exits.map((e) => ({ x: e.x, y: e.y }));
  for (const entry of map.entries) {
    const path = findShortestPathToAnyExit(
      tiles,
      entry.x,
      entry.y,
      exitCoords,
      overrideBlockedKeys,
      extraDowngradeKeys
    );
    if (path) {
      routes[entry.id] = path;
    }
  }
  return routes;
}

export function pathsEqual(a?: GridCoord[], b?: GridCoord[]): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

export function evaluateRouteChange(
  tiles: TileState[][],
  map: MapDef,
  enemies: EnemyEntity[],
  extraBlocked?: GridCoord[],
  extraDowngrade?: GridCoord[]
): RoutePreviewResult {
  const currentRoutes = computeAllEntryRoutes(tiles, map);

  const blockedSet = new Set<string>();
  if (extraBlocked) {
    for (const c of extraBlocked) blockedSet.add(keyOf(c.x, c.y));
  }
  const downgradeSet = new Set<string>();
  if (extraDowngrade) {
    for (const c of extraDowngrade) downgradeSet.add(keyOf(c.x, c.y));
  }

  const exitCoords = map.exits.map((e) => ({ x: e.x, y: e.y }));
  const previewRoutes: Record<string, GridCoord[]> = {};
  const blockedPoints: GridCoord[] = [];
  let reason: string | undefined;

  // Check every entry remains connected
  for (const entry of map.entries) {
    const p = findShortestPathToAnyExit(
      tiles,
      entry.x,
      entry.y,
      exitCoords,
      blockedSet,
      downgradeSet
    );
    if (!p) {
      blockedPoints.push({ x: entry.x, y: entry.y });
      if (!reason) {
        reason = `操作被拒：将切断入口 ${entry.id}「${entry.name}」至核心的连通！`;
      }
    } else {
      previewRoutes[entry.id] = p;
    }
  }

  // Check every alive ground enemy remains connected (and isn't standing inside the blocked tile!)
  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.isFlying) continue;
    const ex = Math.round(enemy.x);
    const ey = Math.round(enemy.y);
    if (blockedSet.has(keyOf(ex, ey))) {
      blockedPoints.push({ x: ex, y: ey });
      if (!reason) {
        reason = '操作被拒：该位置当前有敌方单位占格通行，无法直接封锁！';
      }
      continue;
    }
    const p = findShortestPathToAnyExit(
      tiles,
      ex,
      ey,
      exitCoords,
      blockedSet,
      downgradeSet
    );
    if (!p) {
      blockedPoints.push({ x: ex, y: ey });
      if (!reason) {
        reason = '操作被拒：将封死场上地面敌军的前进通路！';
      }
    }
  }

  const changedEntries: Array<'A' | 'B' | 'C'> = [];
  for (const entry of map.entries) {
    if (
      previewRoutes[entry.id] &&
      !pathsEqual(currentRoutes[entry.id], previewRoutes[entry.id])
    ) {
      changedEntries.push(entry.id);
    }
  }

  return {
    valid: blockedPoints.length === 0,
    reason,
    blockedPoints,
    currentRoutes,
    previewRoutes,
    changedEntries,
  };
}
