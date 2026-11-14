export type MapId = 'intranet' | 'backbone' | 'airgap';

export type TileType =
  | 'void'
  | 'link'
  | 'legacy'
  | 'platform'
  | 'node'
  | 'obstacle'
  | 'entry'
  | 'exit';

export type Direction = 0 | 1 | 2 | 3; // 0: +Z (South), 1: +X (East), 2: -Z (North), 3: -X (West)

export type TowerType =
  | 'firewall'
  | 'honeypot'
  | 'gate'
  | 'interceptor'
  | 'sandbox'
  | 'repair';

export type BranchId =
  | 'honeypot_mimic'
  | 'honeypot_snare'
  | 'interceptor_pierce'
  | 'interceptor_suppress';

export type EnemyType =
  | 'worm'
  | 'flood'
  | 'trojan'
  | 'ransomware'
  | 'hotspot'
  | 'packer'
  | 'boss_wankui'
  | 'boss_shenlou'
  | 'boss_zheying';

export type ItemId = 'isolator' | 'downgrade' | 'restore';

export type GamePhase =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'victory'
  | 'defeat'
  | 'demo';

export interface GridCoord {
  x: number;
  y: number;
}

export interface EntryDef {
  id: 'A' | 'B' | 'C';
  name: string;
  x: number;
  y: number;
  color: string;
  hex: number;
}

export interface ExitDef {
  id: 'M' | 'X' | 'Y';
  name: string;
  x: number;
  y: number;
}

export interface WaveGroup {
  enemy: EnemyType;
  count: number;
  entryId: 'A' | 'B' | 'C';
  delay: number;      // seconds after wave starts
  interval: number;   // seconds between spawns
  isSurge?: boolean;
}

export interface WaveDef {
  index: number;      // 1-based
  title: string;
  groups: WaveGroup[];
  intelBonus: number;
  isSurgeWave?: boolean;
  isBossWave?: boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  networkTag: string;
  difficulty: string;
  description: string;
  tacticalTip: string;
  cols: number;
  rows: number;
  startCompute: number;
  startIntel: number;
  maxIntegrity: number;
  grid: string[]; // row-major characters
  entries: EntryDef[];
  exits: ExitDef[];
  nodeNames: Record<string, string>; // "x,y" -> Chinese label
  waves: WaveDef[];
}

export interface TileState {
  x: number;
  y: number;
  type: TileType;
  entryId?: 'A' | 'B' | 'C';
  exitId?: 'M' | 'X' | 'Y';
  nodeName?: string;
  // Dynamic states
  towerId: number | null;
  isolatorId: number | null;
  nodeCooldown: number;      // remaining cooldown before re-isolation
  downgradeTimer: number;    // from Protocol Downgrade item
  blackholeTimer: number;    // from Boss Shenlou
  lockdownTimer: number;     // from Boss Zheying
  telegraphType: 'none' | 'blackhole' | 'lockdown' | 'surge';
  telegraphTimer: number;
}

export interface IsolatorEntity {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  timer: number;
  maxTimer: number;
  hitFlash: number;
}

export interface TowerEntity {
  id: number;
  type: TowerType;
  x: number;
  y: number;
  level: 1 | 2;
  branch: BranchId | null;
  direction: Direction; // primarily for interceptor
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  encryptedTimer: number;
  encryptResistTimer: number;
  attackCooldown: number;
  skillCooldown: number;
  maxSkillCooldown: number;
  skillActiveTimer: number;
  intelTickTimer: number;
  computeSpent: number;
  intelSpent: number;
  blockedEnemyIds: number[];
  targetId: number | null;
  secondaryTargetId: number | null;
  aimYaw: number;
  recoil: number;
  hitFlash: number;
  healFlash: number;
  kills: number;
  damageDealt: number;
  healingDone: number;
}

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  entryId: 'A' | 'B' | 'C';
  targetExitId: 'M' | 'X' | 'Y';
  isBoss: boolean;
  isFlying: boolean;
  isClone: boolean;
  x: number;          // grid float position
  y: number;          // grid float position
  vx: number;
  vy: number;
  yaw: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  armor: number;
  speed: number;
  blockWeight: number;
  blockedByTowerId: number | null;
  disguised: boolean; // trojan / zheying phase 1
  detected: boolean;
  snaredTimer: number;
  slowTimer: number;
  slowFactor: number;
  vulnerableTimer: number;
  dotTimer: number;
  dotDps: number;
  attackCooldown: number;
  abilityCooldown: number;
  bossPhase: 1 | 2 | 3;
  hasReplicated: boolean;
  passedNodes: Set<string>;
  route: GridCoord[]; // current tile path from current tile to an exit
  routeIndex: number;
  targetNodeKey: string | null; // for Flood Pack node-breaker
  flightProgress: number;       // 0..1 for flying hotspot
  animPhase: number;
  hitFlash: number;
  attackAnim: number;
  lastTargetTowerId: number | null;
}

export interface ProjectileVfx {
  id: number;
  kind:
    | 'rail'
    | 'pierce_rail'
    | 'suppress_bolt'
    | 'firewall_pulse'
    | 'ransom_beam'
    | 'heal_beam'
    | 'boss_surge'
    | 'snare_arc'
    | 'packer_shield';
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  color: number;
  timer: number;
  duration: number;
  width: number;
}

export interface BurstVfx {
  id: number;
  kind:
    | 'sandbox_ring'
    | 'snare_cage'
    | 'failover_wave'
    | 'downgrade_ring'
    | 'restore_burst'
    | 'node_slam'
    | 'node_break'
    | 'payload_blast'
    | 'death_shard'
    | 'route_storm'
    | 'teleport_spawn'
    | 'intel_ping';
  x: number;
  y: number;
  z: number;
  radius: number;
  color: number;
  timer: number;
  duration: number;
}

export interface GameAlert {
  id: number;
  level: 'info' | 'warn' | 'danger' | 'success';
  text: string;
  timer: number;
}

export interface GameStats {
  enemiesDefeated: number;
  leaks: number;
  towersLost: number;
  computeEarned: number;
  intelEarned: number;
  intelFromNodes: number;
  reroutesTriggered: number;
  damageToTowers: number;
  healingTotal: number;
}

export interface RoutePreviewResult {
  valid: boolean;
  reason?: string;
  blockedPoints: GridCoord[];
  currentRoutes: Record<string, GridCoord[]>;
  previewRoutes: Record<string, GridCoord[]>;
  changedEntries: Array<'A' | 'B' | 'C'>;
}
