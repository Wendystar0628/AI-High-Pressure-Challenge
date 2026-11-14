// ============================================================================
// 08_timeline_director.js
// Complete 78.0s Stateless Global Timeline:
//   - 37-Ship 3D Fleet Formation (1 Flagship + 18 Guards + 18 Vanguards)
//   - 16 Active & Berthed Fleet Shuttles
//   - 4-Weapon Overlapping Assault & Jigsaw Voxel Asteroid Destruction
//   - Sequential Fleet-Wide Energy Shields & Propulsion Surge Acceleration
//   - 4 Flagship Conceptual Interiors & Live Mechanical / Holo Animations
//   - 8-Shot Collision-Free Camera Choreography with C1 Seamless Loop (78s == 0s)
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});
  const {
    createRNG, clamp, saturate, lerp, smoothstep, smootherstep,
    V3, M4, evalCatmullRom3, evalCatmullRomTangent3, evalTimedSpline3
  } = SF.Math;

  const LOOP_DURATION = 78.0;
  const TWO_PI = Math.PI * 2.0;

  // Export runs: 4 logical acts covering [0 .. 78.0s] on ONE shared global timeline!
  // Note: Camera shots intentionally cross 20.0s, 42.0s, and 63.0s smoothly!
  const EXPORT_RUNS = [
    { id: 'act1_fleet_scale',       start:  0.0, end: 20.0 },
    { id: 'act2_flagship_interiors', start: 20.0, end: 42.0 },
    { id: 'act3_asteroid_assault',  start: 42.0, end: 63.0 },
    { id: 'act4_shields_surge',     start: 63.0, end: 78.0 }
  ];

  class FleetDirector {
    constructor(assets) {
      this.assets = assets;
      this._initSpeedCurve();
      this._initFleetRoster();
      this._initShuttles();
      this._initAsteroidField();
      this._initCombatSchedule();
      this._initSpaceDust();
    }

    // ------------------------------------------------------------------------
    // 1. Periodic Fleet Forward Speed & Integrated Travel Lookup (0..78.0s)
    //    Matches speed(0) == speed(78) == 136 u/s, derivative 0 at seam!
    // ------------------------------------------------------------------------
    _initSpeedCurve() {
      const N = 7800;
      this.travelLUT = new Float32Array(N + 1);
      let acc = 0;
      const dt = LOOP_DURATION / N;
      for (let i = 0; i <= N; i++) {
        this.travelLUT[i] = acc;
        const tMid = (i + 0.5) * dt;
        acc += this.getFleetSpeed(tMid) * dt;
      }
      this.totalLoopTravel = this.travelLUT[N];
    }

    getSurgeFactor(t) {
      // Smooth C1 periodic surge: 1.0 at t=78/0, decays to 0 by t=6.2s, ramps 0->1 across t=67.8..78.0s
      const startDecay = 1.0 - smootherstep(0.0, 6.2, t);
      const endRise = smootherstep(67.8, 78.0, t);
      return saturate(startDecay + endRise);
    }

    getFleetSpeed(t) {
      const surge = this.getSurgeFactor(t);
      return lerp(42.0, 196.0, surge);
    }

    getTravelDistance(t) {
      const tc = clamp(t, 0, LOOP_DURATION);
      const f = (tc / LOOP_DURATION) * 7800;
      const i = Math.min(7799, Math.floor(f));
      const frac = f - i;
      return lerp(this.travelLUT[i], this.travelLUT[i + 1], frac);
    }

    // ------------------------------------------------------------------------
    // 2. 37-Ship 3D Fleet Formation (1 Flagship + 18 Guards + 18 Vanguards)
    // ------------------------------------------------------------------------
    _initFleetRoster() {
      const ships = [];

      // #0: Sovereign Flagship at center of array
      ships.push({
        id: 0,
        type: 'flagship',
        basePos: [0, 0, 0],
        spreadVec: [0, 0, 0],
        bobAmp: [1.5, 2.2, 1.0],
        bobFreq: [1, 1, 1],
        phase: 0.0,
        shieldStart: 63.0
      });

      // 18 Close-Defense "Aegis Guard" Escorts (flanking, dorsal/ventral, and rear columns)
      const guardCoords = [
        // Hero close flankers (#1..#4)
        [-275, -18,  155], // #1 Port fore-flank (sweeps past foreground in Shot 1!)
        [-315,  94, -125], // #2 Port upper-mid escort
        [ 255,  22,  250], // #3 Starboard close CIWS shooter in Shot 7!
        [ 345, -54,  375], // #4 Starboard lower CIWS shooter in Shot 7!
        // Mid & Aft 3D echelons (multi-altitude, staggered Z for mutual occlusion & plume depth)
        [-455, -86,  -85],
        [ 440,  96,  -40],
        [-260, -118,-390],
        [ 285, -105,-360],
        [-540,  48, -420],
        [ 560, -36, -450],
        [-375,  148,-640],
        [ 395,  136,-680],
        [-680, -95, -720],
        [ 710,  72, -790],
        [-235,  62, -890],
        [ 260, -68, -940],
        [-510, -142,-1080],
        [ 535,  118,-1160]
      ];

      for (let i = 0; i < guardCoords.length; i++) {
        const bp = guardCoords[i];
        const distNorm = saturate((700 - bp[2]) / 1900);
        ships.push({
          id: ships.length,
          type: 'guard',
          guardIdx: i,
          basePos: bp,
          spreadVec: [Math.sign(bp[0]) * (42 + Math.abs(bp[0]) * 0.14), bp[1] * 0.16, 12],
          bobAmp: [4.5, 5.5, 3.0],
          bobFreq: [2, 3, 2],
          phase: i * 0.87 + 0.4,
          shieldStart: 64.1 + distNorm * 3.6 + (i % 3) * 0.22
        });
      }

      // 18 "Lance Vanguard" Missile Cruisers (forward spearhead & wide outer wings)
      const vanguardCoords = [
        // Forward spearhead visible through Command Bridge panoramic window & in Assault!
        [-310,  86,  760], // VG #0 (high port spearhead, clear of Flagship bow line)
        [ 220,  58,  345], // VG #1 (Close Starboard Missile Shooter A!)
        [-435,  24,  895], // VG #2
        [ 395,  18,  275], // VG #3 (Starboard Wing Missile Shooter B!)
        [-135, 138,  985], // VG #4
        [ 148, -42,  415], // VG #5 (Lower Starboard Missile Shooter C!)
        // Outer forward & lateral sweeping wings
        [-640,  88,  610],
        [ 585, -68,  620],
        [-820, -45,  420],
        [ 790,  95,  470],
        [-585, -148, 280],
        [ 610,  156, 310],
        [-980,  36,  140],
        [1010, -62,  180],
        [-740,  175, 840],
        [ 720, -145, 880],
        [-330, -132,1090],
        [ 345,  132, 960]
      ];

      for (let i = 0; i < vanguardCoords.length; i++) {
        const bp = vanguardCoords[i];
        const distNorm = saturate((Math.abs(bp[0]) + Math.abs(bp[2] - 400)) / 1800);
        ships.push({
          id: ships.length,
          type: 'vanguard',
          vanguardIdx: i,
          basePos: bp,
          spreadVec: [Math.sign(bp[0]) * (55 + Math.abs(bp[0]) * 0.16), bp[1] * 0.18, 26],
          bobAmp: [5.0, 6.0, 4.0],
          bobFreq: [2, 2, 1],
          phase: i * 1.13 + 1.7,
          shieldStart: 64.0 + distNorm * 3.8 + (i % 4) * 0.20
        });
      }

      this.ships = ships;
    }

    getCombatSpread(t) {
      // Pre-combat lateral expansion (t = 37.5..44.5), hold during combat, reform (t = 59.5..65.5)
      return smootherstep(37.5, 44.5, t) * (1.0 - smootherstep(59.5, 65.5, t));
    }

    evalShipState(ship, t) {
      const ang1 = TWO_PI * ship.bobFreq[0] * (t / LOOP_DURATION) + ship.phase;
      const ang2 = TWO_PI * ship.bobFreq[1] * (t / LOOP_DURATION) + ship.phase * 1.37;
      const ang3 = TWO_PI * ship.bobFreq[2] * (t / LOOP_DURATION) + ship.phase * 0.73;

      const spread = this.getCombatSpread(t);
      const surge = this.getSurgeFactor(t);

      // Forward surge differential: faster outer escorts pull slightly ahead then settle seamlessly
      const surgeZ = (ship.type === 'flagship' ? 0 : (ship.type === 'vanguard' ? 18 : 10)) * Math.sin(surge * Math.PI);

      const x = ship.basePos[0] + ship.spreadVec[0] * spread + Math.sin(ang1) * ship.bobAmp[0];
      const y = ship.basePos[1] + ship.spreadVec[1] * spread + Math.cos(ang2) * ship.bobAmp[1];
      const z = ship.basePos[2] + ship.spreadVec[2] * spread + Math.sin(ang3) * ship.bobAmp[2] + surgeZ;

      // Gentle banking & micro-attitude adjustments during spread/reform & weave
      const spreadDeriv = (smoothstep(37.5, 41.0, t) * (1 - smoothstep(41.0, 44.5, t)))
                        - (smoothstep(59.5, 62.5, t) * (1 - smoothstep(62.5, 65.5, t)));
      const sideSign = Math.sign(ship.basePos[0]);
      const yaw = (ship.type === 'flagship' ? 0.004 : 0.018) * Math.cos(ang1) + sideSign * spreadDeriv * 0.045;
      const pitch = (ship.type === 'flagship' ? 0.003 : 0.014) * Math.sin(ang2);
      const roll = (ship.type === 'flagship' ? -0.005 : -0.032) * Math.cos(ang1) - sideSign * spreadDeriv * 0.14;

      // Shield state (seamless across t = 78.0 -> 0.0!)
      let shieldInflate = 1.0;
      let shieldWaveZ = -2.0; // -2 = fully covered steady state
      let shieldIntensity = 0.0;
      let hullShieldReflect = 0.0;

      if (t >= ship.shieldStart) {
        const dtS = t - ship.shieldStart;
        const dur = ship.type === 'flagship' ? 3.2 : 1.9;
        const p = saturate(dtS / dur);
        shieldInflate = lerp(0.76, 1.0, smoothstep(0.0, 0.42, p));
        shieldWaveZ = lerp(1.25, -1.35, smoothstep(0.08, 0.96, p));
        shieldIntensity = lerp(0.0, 0.72, smoothstep(0.0, 0.25, p)) * lerp(1.25, 0.68 / 0.72, smoothstep(0.5, 1.0, p));
        if (p > 0.05 && p < 0.98) {
          hullShieldReflect = Math.sin(p * Math.PI) * 1.35;
        }
      } else if (t < 5.8) {
        // Opening continuation: shield afterglow naturally thins out over t = 0..5.8s!
        shieldInflate = 1.0;
        shieldWaveZ = -2.0;
        shieldIntensity = 0.68 * (1.0 - smootherstep(0.0, 5.6, t));
      }

      return {
        pos: [x, y, z],
        yaw, pitch, roll,
        surge,
        shieldInflate,
        shieldWaveZ,
        shieldIntensity,
        hullShieldReflect
      };
    }

    // ------------------------------------------------------------------------
    // 3. 16 Fleet Shuttles (Parked, Launching/Recovering, & Hull-Skimming Loops)
    // ------------------------------------------------------------------------
    _initShuttles() {
      const hangarBerths = this.assets.throughHangar.berths;
      this.parkedShuttleBerths = [
        hangarBerths[0], hangarBerths[2], hangarBerths[4], hangarBerths[6],
        hangarBerths[8], hangarBerths[10]
      ].filter(Boolean);

      // Closed periodic 3D hull-skimming loops around the Flagship (22-45 voxels clear of armor!)
      this.hullShuttleLoops = [
        // Loop 0: Skims Port Flank -> Twin-Tine Bow -> Dorsal Spine -> Stern -> Port Mouth
        {
          cycles: 1, phase: 0.06,
          pts: [
            [-172,  14, -260], [-162,  18,   40], [-110,  28,  340], [   0,  36,  520],
            [  98,  58,  260], [  88,  66,  -60], [  96,  52, -380], [   0,  46, -540],
            [-158,  10, -440]
          ]
        },
        // Loop 1: Partner shuttle offset slightly behind Loop 0!
        {
          cycles: 1, phase: 0.095,
          pts: [
            [-184,   6, -260], [-174,  10,   40], [-124,  20,  340], [ -16,  30,  535],
            [  84,  52,  260], [  76,  62,  -60], [  84,  48, -380], [ -14,  40, -548],
            [-170,   4, -440]
          ]
        },
        // Loop 2: Ventral Keel & Rib-Cage Skimmer -> Bow Jaw -> Starboard Wing!
        {
          cycles: 1, phase: 0.22,
          pts: [
            [-148, -48, -320], [ -52, -74,  -60], [ -42, -52,  260], [   0, -28,  530],
            [ 132,  -8,  220], [ 168,   6, -160], [ 142, -32, -460], [   0, -68, -510]
          ]
        },
        // Loop 3: Dorsal Pulse-Turret Canyon Runner (2 cycles per 78s = brisk lively pace!)
        {
          cycles: 2, phase: 0.45,
          pts: [
            [ -34,  68, -40], [ -32,  64, 180], [ -42,  46, 440], [  42,  46, 440],
            [  34,  64, 180], [  34,  68, -40], [  82,  82,-220], [ -82,  82,-220]
          ]
        },
        // Loop 4: Port Hangar Approach & Escort Orbit (2 cycles)
        {
          cycles: 2, phase: 0.78,
          pts: [
            [-168,   4, -220], [-235,  18,  -80], [-215,  38,  160], [-158,  26,  280],
            [-155, -14,   60], [-195, -24, -140], [-220, -12, -340], [-178,  -2, -300]
          ]
        },
        // Loop 5: Starboard Outrigger Pod & Citadel Escort
        {
          cycles: 1, phase: 0.58,
          pts: [
            [ 162,  44, -280], [ 156,  78,  -60], [ 154,  74,  140], [  88,  54,  380],
            [ -78,  54,  380], [-152,  76,  110], [-148,  84, -160], [   0, 116, -210]
          ]
        }
      ];

      // Hero Shot-2 Inbound Shuttle (leads 42 voxels ahead of camera so it frames scale cleanly!)
      this.heroInboundKeys = [
        [10.5, -188, -18, -510],
        [13.5, -166,  -2, -325],
        [15.8, -128,   0, -218],
        [17.8,  -78,  -3, -122],
        [20.4,  -76,  -5,   -8],
        [23.8,  -42, -11,   38]
      ];

      // Hero Shot-2 Outbound Shuttle (undocks inside Hangar -> glides aft past camera on upper-right -> exits!)
      this.heroOutboundKeys = [
        [15.5,  -36, -12,   18],
        [17.8,  -52,   6,  -24],
        [20.2,  -56,   7, -145],
        [22.2, -136,   6, -235],
        [24.5, -235,  18, -310]
      ];
    }

    // ------------------------------------------------------------------------
    // 4. Voxel Asteroid Field & 4-Weapon Combat Schedule
    // ------------------------------------------------------------------------
    _initAsteroidField() {
      const rng = createRNG(202611);
      // Base cluster Z0 at t = 0.0s: sits at Z = +3340 so at t=45.2s it arrives at Z ~ +970,
      // and during the t=68..76s surge it sweeps far behind the fleet (Z < -1200) well before t=78s!
      this.clusterBaseZ = 3340;

      // 7 Hero Destructible Asteroids (all forward of their respective shooters along +Z!):
      //   #0: Colossus Asteroid #1 (Main Beam cleave + Pulse edge-chipping!)
      //   #1: Heavy Asteroid #2 (Flagship Pulse Turret barrage!)
      //   #2: Heavy Asteroid #3 (Vanguard Missile Salvo wave 1 — forward of Vanguards!)
      //   #3: Heavy Asteroid #4 (Vanguard Missile Salvo wave 2 — forward of Vanguards!)
      //   #4..#6: Medium Asteroids #5..#7 (Aegis Guard CIWS rapid point-defense!)
      this.heroAsteroids = [
        { id: 0, assetIdx: 0, offset: [  72,  26,   35], mode: 'beam_pulse',      hitStart: 45.35, cleaveTime: 47.05 },
        { id: 1, assetIdx: 1, offset: [-115,  92,  -15], mode: 'pulse_barrage',   hitStart: 46.85, cleaveTime: 47.20 },
        { id: 2, assetIdx: 2, offset: [ 285,  42,  285], mode: 'missile_shatter', hitStart: 56.85, cleaveTime: 57.30 },
        { id: 3, assetIdx: 3, offset: [ 225, -56,  365], mode: 'missile_shatter', hitStart: 57.85, cleaveTime: 58.30 },
        { id: 4, assetIdx: 4, offset: [ 305,  14,  -10], mode: 'ciws_shred',      hitStart: 51.95, cleaveTime: 52.35 },
        { id: 5, assetIdx: 5, offset: [ 395, -34,   65], mode: 'ciws_shred',      hitStart: 52.90, cleaveTime: 53.30 },
        { id: 6, assetIdx: 6, offset: [-245, -18,  -45], mode: 'ciws_shred',      hitStart: 52.40, cleaveTime: 52.80 }
      ];

      // Pre-generate deterministic Small Voxel Shard bursts for each Hero Asteroid!
      this.shardBursts = [];
      for (const ha of this.heroAsteroids) {
        const count = ha.mode === 'beam_pulse' ? 48 : (ha.mode === 'missile_shatter' ? 38 : 28);
        for (let i = 0; i < count; i++) {
          const th = rng() * TWO_PI;
          const ph = Math.acos(2 * rng() - 1);
          const spd = 22 + rng() * 68;
          this.shardBursts.push({
            parentId: ha.id,
            archIdx: i % this.assets.shardArchetypes.length,
            spawnTime: ha.cleaveTime + (rng() - 0.3) * (ha.mode === 'missile_shatter' ? 0.35 : 1.1),
            localOrigin: [(rng() - 0.5) * 32, (rng() - 0.5) * 28, (rng() - 0.5) * 32],
            vel: [
              Math.sin(ph) * Math.cos(th) * spd,
              Math.cos(ph) * spd,
              Math.sin(ph) * Math.sin(th) * spd
            ],
            spin: [(rng() - 0.5) * 6.5, (rng() - 0.5) * 6.5, (rng() - 0.5) * 6.5]
          });
        }
      }

      // 22 Intact Surrounding Voxel Asteroids (near, mid, far occlusion & parallax!)
      this.intactAsteroids = [];
      const fixedIntact = [
        [ 480,  115,   90, 0], [-360,  135,  140, 1], [ 560, -110,  -80, 0],
        [-490,  -95,  -40, 1], [  40,  195,  190, 2], [ 380,  175, -190, 2],
        [ 640,   25, -340, 1], [-580,   65, -320, 2], [ 155, -165,  110, 2],
        [-145, -155,  -90, 3], [ 495,  -45, -440, 3], [-420,  140, -460, 3]
      ];
      for (let i = 0; i < fixedIntact.length; i++) {
        const f = fixedIntact[i];
        this.intactAsteroids.push({
          offset: [f[0], f[1], f[2]],
          archIdx: f[3],
          rot0: [rng() * TWO_PI, rng() * TWO_PI, rng() * TWO_PI],
          // Integer number of rotations over 78s so Cluster B -> Cluster A matches seamlessly!
          rotCycles: [i % 2 === 0 ? 1 : -1, (i % 3) - 1, 1]
        });
      }
      for (let i = 0; i < 10; i++) {
        const side = (i % 2 === 0) ? 1 : -1;
        this.intactAsteroids.push({
          offset: [
            side * (460 + rng() * 520),
            (rng() - 0.5) * 420,
            (rng() - 0.5) * 950
          ],
          archIdx: 3 + (i % 3),
          rot0: [rng() * TWO_PI, rng() * TWO_PI, rng() * TWO_PI],
          rotCycles: [1, -1, i % 2]
        });
      }
    }

    // Evaluate cluster Z offset for pass `k` (k=0 is primary cluster A, k=1 is next incoming cluster B!)
    getClusterWorldZ(t, passIndex) {
      const travel = this.getTravelDistance(t);
      return this.clusterBaseZ + passIndex * this.totalLoopTravel - travel;
    }

    getHeroAsteroidBaseWorldPos(heroIdx, t) {
      const ha = this.heroAsteroids[heroIdx];
      const cz = this.getClusterWorldZ(t, 0);
      return [ha.offset[0], ha.offset[1], cz + ha.offset[2]];
    }

    // ------------------------------------------------------------------------
    // 5. Pre-Scheduled Deterministic 4-Weapon Projectiles (Pulse, CIWS, Missiles)
    // ------------------------------------------------------------------------
    _initCombatSchedule() {
      const rng = createRNG(88421);

      // --- A. Flagship 16 Pulse Turrets (12 Hull + 4 Floating Pods) ---
      // Fire grouped bursts across t = 46.35 .. 52.10s with adjacent half-beat stagger!
      this.pulseShots = [];
      const totalTurrets = 16;
      for (let ti = 0; ti < totalTurrets; ti++) {
        const halfBeat = (ti % 2) * 0.31 + Math.floor(ti / 4) * 0.08;
        const targetHeroIdx = (ti % 3 === 0) ? 0 : 1; // Split fire between Asteroid #1 upper ridge & Asteroid #2!
        for (let volley = 0; volley < 6; volley++) {
          const tFire = 46.35 + volley * 0.82 + halfBeat;
          if (tFire > 51.8) continue;
          // Twin barrels fire crisp paired bolts 0.09s apart
          for (let b = 0; b < 2; b++) {
            const tf = tFire + b * 0.085;
            const flightDur = 0.62 + (rng() - 0.5) * 0.08;
            this.pulseShots.push({
              turretIdx: ti,
              barrelIdx: b,
              targetHeroIdx,
              tFire: tf,
              tHit: tf + flightDur,
              targetJitter: [
                (rng() - 0.5) * 34,
                (targetHeroIdx === 0 ? 28 : 4) + (rng() - 0.5) * 26,
                (rng() - 0.5) * 28
              ]
            });
          }
        }
      }

      // --- B. Aegis Guard Rapid-Fire CIWS Point-Defense Bursts (t = 51.65 .. 56.65s) ---
      // Guards #3 (ship index 3), #4 (ship index 4), and #1 (ship index 1) shred Asteroids #4, #5, #6!
      this.ciwsBursts = [
        { shipIdx: 3, sponsonIndices: [0, 1, 2, 3], targetHeroIdx: 4, tStart: 51.65, tEnd: 56.45 },
        { shipIdx: 4, sponsonIndices: [0, 1, 3, 5], targetHeroIdx: 5, tStart: 52.35, tEnd: 56.75 },
        { shipIdx: 1, sponsonIndices: [0, 1, 4, 5], targetHeroIdx: 6, tStart: 51.95, tEnd: 56.15 }
      ];

      // --- C. Lance Vanguard 36-Missile Curved-Spline Salvo (t = 53.05 .. 59.10s) ---
      // Vanguards #1 (ship index 20), #3 (ship index 22), #5 (ship index 24) launch 12 missiles each!
      this.missiles = [];
      const shooterShipIndices = [20, 22, 24];
      for (let s = 0; s < shooterShipIndices.length; s++) {
        const shipIdx = shooterShipIndices[s];
        for (let c = 0; c < 12; c++) {
          const cellIdx = c % 16;
          const tLaunch = 53.05 + s * 0.42 + c * 0.135;
          const targetHeroIdx = (c + s) % 2 === 0 ? 2 : 3; // Strike Heavy Asteroids #3 & #4!
          const flightTime = 2.65 + (c % 4) * 0.22 + rng() * 0.20;
          const sideSign = (cellIdx < 8) ? -1 : 1;
          this.missiles.push({
            shipIdx,
            cellIdx,
            targetHeroIdx,
            tLaunch,
            tIgnite: tLaunch + 0.28, // Separates cleanly from bay, THEN ignites bright tail!
            tHit: tLaunch + flightTime,
            arcApexOffset: [
              sideSign * (68 + rng() * 75),
              52 + (c % 3) * 28 + (rng() - 0.5) * 35,
              110 + rng() * 60
            ],
            targetOffset: [
              (rng() - 0.5) * 36,
              (rng() - 0.5) * 32,
              (rng() - 0.5) * 32
            ],
            seed: rng() * 10.0
          });
        }
      }
    }

    // Evaluate a Vanguard Missile's exact 3D position along its curved acceleration trajectory at time `tau`
    evalMissilePos(out, m, tau) {
      const shipState = this.evalShipState(this.ships[m.shipIdx], m.tLaunch);
      const cellLocal = this.assets.lanceVanguard.launchCells[m.cellIdx].pos;
      const p0 = [
        shipState.pos[0] + cellLocal[0],
        shipState.pos[1] + cellLocal[1],
        shipState.pos[2] + cellLocal[2]
      ];
      // Phase 1: Eject upward/outward cleanly before motor ignition (tLaunch .. tIgnite)
      const p1 = [
        p0[0] + Math.sign(cellLocal[0]) * 18,
        p0[1] + 22,
        p0[2] + 24
      ];
      if (tau <= m.tIgnite) {
        const u = saturate((tau - m.tLaunch) / (m.tIgnite - m.tLaunch));
        const ease = u * (2.0 - u);
        return V3.lerp(out, p0, p1, ease);
      }

      // Phase 2: Accelerating curved cubic Bezier into target asteroid!
      const uRaw = saturate((tau - m.tIgnite) / (m.tHit - m.tIgnite));
      // Strong acceleration curve (starts slower right at ignition, whips fast into target!)
      const u = clamp(0.32 * uRaw + 0.68 * uRaw * uRaw, 0, 1);

      const targBase = this.getHeroAsteroidBaseWorldPos(m.targetHeroIdx, m.tHit);
      const p3 = [
        targBase[0] + m.targetOffset[0],
        targBase[1] + m.targetOffset[1],
        targBase[2] + m.targetOffset[2]
      ];
      const p2 = [
        lerp(p1[0], p3[0], 0.45) + m.arcApexOffset[0],
        lerp(p1[1], p3[1], 0.45) + m.arcApexOffset[1],
        lerp(p1[2], p3[2], 0.42) + m.arcApexOffset[2]
      ];
      const c1 = [p1[0] + Math.sign(cellLocal[0]) * 30, p1[1] + 28, p1[2] + 95];

      const om = 1.0 - u;
      const b0 = om * om * om;
      const b1 = 3.0 * om * om * u;
      const b2 = 3.0 * om * u * u;
      const b3 = u * u * u;

      out[0] = b0 * p1[0] + b1 * c1[0] + b2 * p2[0] + b3 * p3[0];
      out[1] = b0 * p1[1] + b1 * c1[1] + b2 * p2[1] + b3 * p3[1];
      out[2] = b0 * p1[2] + b1 * c1[2] + b2 * p2[2] + b3 * p3[2];
      return out;
    }

    // ------------------------------------------------------------------------
    // 6. Periodic 3D Space Parallax Dust Motes (catches thruster & weapon light!)
    // ------------------------------------------------------------------------
    _initSpaceDust() {
      const rng = createRNG(55109);
      this.spaceMotes = [];
      // Box volume: X in [-950..+950], Y in [-550..+550], periodic along Z modulo `totalLoopTravel / 3`!
      // Wait: if wrapPeriodZ = totalLoopTravel / 4, then over 1 full 78s loop, every dust mote wraps
      // EXACTLY 4.000000 integer periods so at t = 78.0s it sits at its EXACT t = 0.0s world coordinate!!
      this.dustWrapZ = this.totalLoopTravel / 4.0;
      for (let i = 0; i < 420; i++) {
        this.spaceMotes.push({
          x: (rng() - 0.5) * 1850,
          y: (rng() - 0.5) * 1050,
          z0: rng() * this.dustWrapZ,
          size: 0.9 + rng() * 2.1,
          bright: 0.35 + rng() * 0.65
        });
      }
    }

    // ------------------------------------------------------------------------
    // 7. 8-Shot Collision-Verified Camera Program (0.0s .. 78.0s)
    //    Returns { mode, pos, target, up, fovDeg }
    //    Modes: 'exterior' | 'atrium' | 'corridor' | 'bridge'
    //    Note: Hangar in Shot 2 IS 'exterior' because the 384-voxel Hangar is
    //    physically embedded inside the Flagship at 1:1 scale!
    // ------------------------------------------------------------------------
    evalCamera(t) {
      const pos = [0, 0, 0];
      const target = [0, 0, 0];
      let up = [0, 1, 0];
      let fovDeg = 50.0;
      let mode = 'exterior';

      // Exact seam state shared by t = 0.0s (Shot 1 start) and t = 78.0s (Shot 8 end):
      // Seam Pos = [-355, 42, 390], Seam Vel = [+22, -10, -48] u/s
      // Seam Target = [-35, 14, 120], Seam Target Vel = [+18, -3, -30] u/s

      if (t < 11.5) {
        // ====================================================================
        // SHOT 1 (0.0s .. 11.5s): Fleet Scale Progression!
        // Close Guard escort sweeps past foreground -> Flagship Twin-Tine Bow &
        // Main Cannon slice in -> wide majestic sweep along Flagship flank,
        // Ventral Ribs & skimming Shuttles -> 37-ship 3D Fleet & distant Asteroids!
        // ====================================================================
        const posKeys = [
          [-3.8, -445,  82,  565], // Virtual pre-key matching Shot 8's exact t=74.2s key!
          [ 0.0, -385,  54,  430],
          [ 3.6, -425,  18,  195],
          [ 7.2, -385, -26,  -95],
          [ 9.8, -322,  14, -335],
          [11.5, -325,  42, -465]
        ];
        const lookKeys = [
          [-3.8,  -65,  22,  210],
          [ 0.0,  -35,  14,  140],
          [ 3.6,   -5,   4,  135],
          [ 7.2,   45,   8,   65],
          [ 9.8,   85,  16,  185],
          [11.5,  125,  22,  320]
        ];
        evalTimedSpline3(pos, posKeys, t);
        evalTimedSpline3(target, lookKeys, t);
        fovDeg = lerp(50.0, 53.0, smoothstep(3.0, 10.5, t));
        up = [-0.04 * Math.sin(t * 0.35), 1.0, 0.0];
      } else if (t < 23.5) {
        // ====================================================================
        // SHOT 2 (11.5s .. 23.5s, crosses 20.0s chunk boundary continuously!):
        // Close pass beneath the Flagship's 7 blazing Stern Nozzles -> sweep
        // forward with Shuttles -> enter OBLIQUELY through the 132x42 Port Hangar
        // Mouth -> glide straight down the 384-voxel Longitudinal Hangar!
        // ====================================================================
        const posKeys = [
          [11.5, -258, -36, -638],
          [13.8, -205, -12, -455],
          [15.8, -166,   2, -298],
          [17.4, -124,   3, -222],
          [19.2,  -70,   2, -156],
          [21.4,  -68,   2,  -56],
          [23.5,  -68,   3,   28]
        ];
        const lookKeys = [
          [11.5,    5,  -2, -495],
          [13.8,  -75,   4, -310],
          [15.8, -108,   2, -212],
          [17.4,  -68,   1, -135],
          [19.2,  -68,   0,  -25],
          [21.4,  -68,   1,   56],
          [23.5,  -68,   3,   92]
        ];
        evalTimedSpline3(pos, posKeys, t);
        evalTimedSpline3(target, lookKeys, t);
        fovDeg = lerp(54.0, 58.0, smoothstep(16.0, 19.5, t));
      } else if (t < 30.5) {
        // ====================================================================
        // SHOT 3 (23.5s .. 30.5s): Interior #2 — 256x264x256 Power Core Atrium!
        // ====================================================================
        mode = 'atrium';
        const posKeys = [
          [23.5,  50, -78, -48],
          [25.6,  66, -34,  20],
          [28.0,  52,  38,  78],
          [30.5, -38,  56,  88]
        ];
        const lookKeys = [
          [23.5,   4, -42,   0],
          [25.6,   0,  -8,   0],
          [28.0,  -4,   0,  -6],
          [30.5,   0,   2, -12]
        ];
        evalTimedSpline3(pos, posKeys, t);
        evalTimedSpline3(target, lookKeys, t);
        fovDeg = 58.0;
      } else if (t < 36.8) {
        // ====================================================================
        // SHOT 4 (30.5s .. 36.8s): Interior #3 — 368-Voxel Energy Corridor!
        // ====================================================================
        mode = 'corridor';
        const posKeys = [
          [30.5,  -9, -3, -168],
          [32.6,   7,  0,  -72],
          [34.8,  -5,  2,   32],
          [36.8,   0,  3,  128]
        ];
        const lookKeys = [
          [30.5,   5, -1,  -75],
          [32.6,  -4,  1,   35],
          [34.8,   2,  2,  165],
          [36.8,   0,  2,  212]
        ];
        evalTimedSpline3(pos, posKeys, t);
        evalTimedSpline3(target, lookKeys, t);
        fovDeg = 57.0;
      } else if (t < 43.2) {
        // ====================================================================
        // SHOT 5 (36.8s .. 43.2s, crosses 42.0s chunk boundary continuously!):
        // Interior #4 — 136x140x64 Wide Command Bridge!
        // ====================================================================
        mode = 'bridge';
        const bo = this.assets.flagship.bridgeOrigin; // [0, 76, 42]
        const localPosKeys = [
          [36.8, -44, 11, -48],
          [39.0, -24,  9, -18],
          [41.2,  -8,  8,  10],
          [43.2,   4,  8,  38]
        ];
        const localLookKeys = [
          [36.8,   6,  2,   8],
          [39.0,   4,  3,  38],
          [41.2,   8,  0, 185],
          [43.2,  16, -6, 440]
        ];
        evalTimedSpline3(pos, localPosKeys, t);
        evalTimedSpline3(target, localLookKeys, t);
        pos[0] += bo[0]; pos[1] += bo[1]; pos[2] += bo[2];
        target[0] += bo[0]; target[1] += bo[1]; target[2] += bo[2];
        fovDeg = 56.0;
      } else if (t < 51.5) {
        // ====================================================================
        // SHOT 6 (43.2s .. 51.5s): Assault Part 1 — Flagship Main Beam + Pulse!
        // Starts directly above the Twin-Tine Bow Canyon so ALL 10 sequential
        // barrel capacitor slots + condensing muzzle sphere + firing Pulse Turrets
        // + cleaving Target Asteroids #1 & #2 read in one commanding composition!
        // ====================================================================
        const posKeys = [
          [43.2,  -22,  92,  265],
          [45.3,  -34,  98,  325],
          [48.5, -186,  96,  475],
          [51.5, -152,  72,  615]
        ];
        const lookKeys = [
          [43.2,    2,   4,  495],
          [45.3,   24,   8,  685],
          [48.5,   58,  18,  865],
          [51.5,   65,  18,  885]
        ];
        evalTimedSpline3(pos, posKeys, t);
        evalTimedSpline3(target, lookKeys, t);
        fovDeg = 54.0;
      } else if (t < 62.5) {
        // ====================================================================
        // SHOT 7 (51.5s .. 62.5s): Assault Part 2 — Close Guard CIWS Rapid Fire
        // -> Vanguard 36-Missile Curved Salvo -> Multi-Scale Voxel Debris!
        // ====================================================================
        const posKeys = [
          [51.5,  182,  52,  175],
          [54.2,  162,  68,  265],
          [57.2,  128,  56,  455],
          [60.2,  112,  42,  605],
          [62.5,  128,  58,  655]
        ];
        const lookKeys = [
          [51.5,  295,  16,  420],
          [54.2,  265,  26,  565],
          [57.2,  240,  10,  795],
          [60.2,  228,  -6,  755],
          [62.5,  195,  -8,  685]
        ];
        evalTimedSpline3(pos, posKeys, t);
        evalTimedSpline3(target, lookKeys, t);
        fovDeg = 54.0;
      } else {
        // ====================================================================
        // SHOT 8 (62.5s .. 78.0s, crosses 63.0s boundary AND joins Shot 1 at 78.0s
        // with EXACT C1 position & velocity continuity!):
        // ====================================================================
        const posKeys = [
          [62.5,  165,  84,  580],
          [65.8,   35, 118,  775],
          [69.8, -265, 108,  720],
          [74.2, -445,  82,  565],
          [78.0, -385,  54,  430], // EXACT Shot 1 t=0.0s position!
          [81.6, -425,  18,  195]  // Virtual post-key matching Shot 1's exact t=3.6s key!
        ];
        const lookKeys = [
          [62.5,  -15,  12,  175],
          [65.8,  -20,   8,   35],
          [69.8,    5,   8,   25],
          [74.2,  -65,  22,  210],
          [78.0,  -35,  14,  140], // EXACT Shot 1 t=0.0s target!
          [81.6,   -5,   4,  135]  // Virtual post-key matching Shot 1's exact t=3.6s target!
        ];
        evalTimedSpline3(pos, posKeys, t);
        evalTimedSpline3(target, lookKeys, t);
        fovDeg = lerp(53.0, 50.0, smoothstep(70.0, 78.0, t));
        up = [-0.04 * Math.sin((t - 78.0) * 0.35), 1.0, 0.0];
      }

      V3.normalize(up, up);
      return { mode, pos, target, up, fovDeg };
    }
  }

  SF.LOOP_DURATION = LOOP_DURATION;
  SF.EXPORT_RUNS = EXPORT_RUNS;
  SF.FleetDirector = FleetDirector;
})(window);
