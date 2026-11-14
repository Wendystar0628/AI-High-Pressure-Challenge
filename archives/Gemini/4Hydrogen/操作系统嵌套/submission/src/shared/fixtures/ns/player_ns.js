// 3D Scene Player & Flight Rehearsal Multi-Process Group:
// - /System/player_seq.ns (Sequencer & UI)
// - /System/player_scene.ns (Flight Physics, Scene Evaluation, Checkpoints & Rehearsal Recording)
// - /System/player_fx.ns (Downwash Dust, Engine Fault Smoke/Sparks, Impact Fireball & Grass Bend)
// - /System/flight_ctrl.ns (Closed-Loop Helicopter Flight Controller)

export const PLAYER_SEQ_NS_SOURCE = `// ============================================================================
// 三维场景播放器 · 时序与界面进程 (/System/player_seq.ns)
// 通过消息驱动 player_scene.ns (飞行场景) 与 player_fx.ns (环境特效)，
// 并在排演模式启动 /System/flight_ctrl.ns 闭环飞控进程。
// ============================================================================

let WIN_ID = __args.winId;
let MY_PID = syscall("get_pid");
let SCENE_PATH = (__args.params && __args.params.filePath) ? __args.params.filePath : "/Demo/helicopter-24.scene";

let MODE = "playback"; // "playback" | "rehearsal"
let PLAY_STATE = "paused"; // "playing" | "paused" | "ended"
let PLAY_TIME = 0.0;
let BASE_DURATION = 15.0;
let DURATION = 15.0;
let FPS = 30;
let PLAY_RATE = 1.0;
let LOOP_ON = false;
let CAMERA_MODE = "cinematic"; // "cinematic" | "follow" | "orbit"
let CAMERA_ORBIT = { yaw: 0.65, pitch: 0.36, dist: 24.0 };
let FRAME_SEQ = 0;

let WIND_VEC = [1.4, 0.0, -0.6];
let TARGET_HEADING = 0.85;
let TARGET_POS = [22, 0.44, -12];
let LANDING_PAD2 = false;
let FAULT_MODE = "none"; // "none" | "tail_precursor" | "tail_failure"
let CTRL_PATH = "/System/flight_ctrl.ns";
let SELECTION_INFO = "未选中部件";
let STATUS_MSG = "就绪";
let LAST_FRAME_TIME = 0.0;
let LAST_HELI_ALT = 0.0;
let LAST_HELI_CRASHED = false;
let SCENE_OPEN_INPUT = SCENE_PATH;

// 启动协作子进程：飞行场景进程 & 环境特效进程
let SCENE_PID = -1;
let FX_PID = -1;
let CTRL_PID = -1;

let sp_fx = syscall("spawn", "/System/player_fx.ns", { winId: WIN_ID, seqPid: MY_PID }, "app");
if (sp_fx && sp_fx.ok) {
  FX_PID = sp_fx.pid;
  syscall("app_send_wm", { type: "register_coop_pid", winId: WIN_ID, pid: FX_PID });
}

let sp_sc = syscall("spawn", "/System/player_scene.ns", {
  winId: WIN_ID,
  seqPid: MY_PID,
  fxPid: FX_PID,
  scenePath: SCENE_PATH
}, "app");
if (sp_sc && sp_sc.ok) {
  SCENE_PID = sp_sc.pid;
  syscall("app_send_wm", { type: "register_coop_pid", winId: WIN_ID, pid: SCENE_PID });
}

fn ensure_controller_running() {
  if (CTRL_PID > 0) {
    let ps = syscall("ps");
    let alive = false;
    for (let i = 0; i < len(ps); i += 1) {
      if (ps[i].pid == CTRL_PID && ps[i].state != "exited" && ps[i].state != "error") {
        alive = true;
        break;
      }
    }
    if (alive) return;
  }
  let sp = syscall("spawn", CTRL_PATH, { playerId: WIN_ID }, "app");
  if (sp && sp.ok) {
    CTRL_PID = sp.pid;
    syscall("app_send_wm", { type: "register_coop_pid", winId: WIN_ID, pid: CTRL_PID });
    STATUS_MSG = "飞控进程已启动 (PID " + to_str(CTRL_PID) + ")";
  } else {
    STATUS_MSG = "飞控启动失败: " + (sp ? sp.error : "");
  }
}

fn stop_controller() {
  if (CTRL_PID > 0) {
    syscall("kill", CTRL_PID);
    CTRL_PID = -1;
  }
}

fn dispatch_frame(is_seek) {
  FRAME_SEQ += 1;
  let tick_msg = {
    type: "frame_tick",
    seq: FRAME_SEQ,
    time: PLAY_TIME,
    mode: MODE,
    isSeek: is_seek,
    cameraMode: CAMERA_MODE,
    cameraOrbit: CAMERA_ORBIT,
    wind: WIND_VEC,
    targetHeading: TARGET_HEADING,
    targetPos: TARGET_POS,
    landingPad2: LANDING_PAD2,
    faultMode: FAULT_MODE
  };
  if (SCENE_PID > 0) syscall("send_msg", SCENE_PID, tick_msg);
  if (FX_PID > 0) syscall("send_msg", FX_PID, {
    type: "fx_tick",
    seq: FRAME_SEQ,
    time: PLAY_TIME,
    wind: WIND_VEC,
    mode: MODE
  });
}

fn submit_ui() {
  syscall("app_submit_ui", WIN_ID, {
    kind: "player",
    playerId: WIN_ID,
    scenePath: SCENE_PATH,
    sceneOpenInput: SCENE_OPEN_INPUT,
    mode: MODE,
    playState: PLAY_STATE,
    playTime: PLAY_TIME,
    frameTime: LAST_FRAME_TIME,
    duration: DURATION,
    fps: FPS,
    rate: PLAY_RATE,
    loop: LOOP_ON,
    cameraMode: CAMERA_MODE,
    wind: WIND_VEC,
    targetHeading: TARGET_HEADING,
    landingPad2: LANDING_PAD2,
    faultMode: FAULT_MODE,
    controllerPath: CTRL_PATH,
    controllerPid: CTRL_PID,
    selection: SELECTION_INFO,
    heliAlt: LAST_HELI_ALT,
    crashed: LAST_HELI_CRASHED,
    statusMsg: STATUS_MSG
  });
}

// 通知场景进程初始化第 0 帧
dispatch_frame(true);
submit_ui();

let LAST_VTIME = syscall("time_now");
let ORBIT_DRAGGING = false;
let LAST_DRAG_X = 0;
let LAST_DRAG_Y = 0;

while (true) {
  let msg = syscall("recv_msg", 33);
  let now = syscall("time_now");
  let dt_sec = max(0, (now - LAST_VTIME) / 1000.0);
  LAST_VTIME = now;

  // 处理积压消息
  while (msg != null) {
    let d = msg.data;
    if (d.type == "scene_loaded") {
      BASE_DURATION = d.duration || 15.0;
      DURATION = BASE_DURATION;
      FPS = d.fps || 30;
      if (d.wind) WIND_VEC = d.wind;
      if (d.targetHeading != null) TARGET_HEADING = d.targetHeading;
      if (d.targetPos) TARGET_POS = d.targetPos;
      if (d.isRehearsal) STATUS_MSG = "已载入排演记录";
      else STATUS_MSG = "已载入场景: " + d.name;
      dispatch_frame(true);
    } else if (d.type == "scene_error") {
      STATUS_MSG = "场景错误: " + d.error;
    } else if (d.type == "scene_frame_done") {
      LAST_FRAME_TIME = d.frameTime;
      LAST_HELI_ALT = d.heliAlt || 0;
      LAST_HELI_CRASHED = d.crashed || false;
    } else if (d.type == "rehearsal_saved") {
      STATUS_MSG = d.ok ? ("排演记录已保存: " + d.path) : ("保存失败: " + d.error);
    } else if (d.type == "ui_event" || d.type == "cross_input") {
      let ev = d.event;
      let ch = ev.controlHint;
      if (ev.type == "pointerdown" && ch && ch.testId == "player-view") {
        ORBIT_DRAGGING = true;
        LAST_DRAG_X = ev.x;
        LAST_DRAG_Y = ev.y;
        // 射线拾取部件或地面目标
        if (ch.normX != null && ch.normY != null) {
          let hit = syscall("display_3d_raycast", WIN_ID, ch.normX, ch.normY, CAMERA_MODE, CAMERA_ORBIT);
          if (hit && hit.hitType == "part") {
            SELECTION_INFO = hit.partName + " (" + (hit.detached ? "已脱落" : (hit.damage > 0.2 ? "受损" : "完好")) + ")";
          } else if (hit && hit.hitType == "ground") {
            if (MODE == "rehearsal" && hit.point) {
              TARGET_POS = [hit.point[0], hit.point[1], hit.point[2]];
              let dx = hit.point[0] - (hit.heliX || 0);
              let dz = hit.point[2] - (hit.heliZ || 0);
              TARGET_HEADING = atan2(dx, dz);
              LANDING_PAD2 = false;
              SELECTION_INFO = "目标航点 (" + to_str(round(hit.point[0])) + ", " + to_str(round(hit.point[2])) + ")";
              dispatch_frame(false);
            } else {
              SELECTION_INFO = "地形 (" + to_str(round(hit.point[0])) + ", " + to_str(round(hit.point[2])) + ")";
            }
          }
        }
      } else if (ev.type == "pointermove" && ORBIT_DRAGGING) {
        let dx = ev.x - LAST_DRAG_X;
        let dy = ev.y - LAST_DRAG_Y;
        LAST_DRAG_X = ev.x;
        LAST_DRAG_Y = ev.y;
        CAMERA_ORBIT.yaw -= dx * 0.01;
        CAMERA_ORBIT.pitch = clamp(CAMERA_ORBIT.pitch + dy * 0.008, 0.06, 1.42);
        dispatch_frame(false);
      } else if (ev.type == "pointerup") {
        ORBIT_DRAGGING = false;
      } else if (ev.type == "wheel" && ch && ch.testId == "player-view") {
        CAMERA_ORBIT.dist = clamp(CAMERA_ORBIT.dist + (ev.deltaY > 0 ? 2.2 : -2.2), 7.0, 75.0);
        dispatch_frame(false);
      } else if (ch && ch.action) {
        let act = ch.action;
        if (act == "play") {
          if (PLAY_STATE == "ended" && MODE == "playback") PLAY_TIME = 0.0;
          PLAY_STATE = "playing";
          if (MODE == "rehearsal") ensure_controller_running();
          dispatch_frame(false);
        } else if (act == "pause") {
          PLAY_STATE = "paused";
        } else if (act == "stop") {
          PLAY_STATE = "paused";
          MODE = "playback";
          stop_controller();
          PLAY_TIME = 0.0;
          DURATION = BASE_DURATION;
          FAULT_MODE = "none";
          SELECTION_INFO = "未选中部件";
          dispatch_frame(true);
        } else if (act == "replay") {
          MODE = "playback";
          stop_controller();
          PLAY_TIME = 0.0;
          DURATION = BASE_DURATION;
          FAULT_MODE = "none";
          PLAY_STATE = "playing";
          dispatch_frame(true);
        } else if (act == "step") {
          PLAY_STATE = "paused";
          let step_dt = 1.0 / FPS;
          PLAY_TIME = min(DURATION, PLAY_TIME + step_dt);
          if (MODE == "rehearsal") DURATION = max(DURATION, PLAY_TIME + 5.0);
          dispatch_frame(true);
        } else if (act == "toggle_loop") {
          LOOP_ON = !LOOP_ON;
        } else if (act == "seek") {
          let t = clamp(to_num(ev.value != null ? ev.value : ch.value), 0, DURATION);
          PLAY_TIME = t;
          if (PLAY_STATE == "ended" && t < DURATION) PLAY_STATE = "paused";
          dispatch_frame(true);
        } else if (act == "set_rate") {
          PLAY_RATE = clamp(to_num(ev.value != null ? ev.value : ch.value), 0.1, 4.0);
        } else if (act == "set_camera") {
          CAMERA_MODE = ch.mode || ev.value || "cinematic";
          dispatch_frame(false);
        } else if (act == "scene_input") {
          SCENE_OPEN_INPUT = ev.value != null ? ev.value : SCENE_OPEN_INPUT;
        } else if (act == "open_scene") {
          let np = ch.path || SCENE_OPEN_INPUT;
          SCENE_PATH = np;
          SCENE_OPEN_INPUT = np;
          MODE = "playback";
          PLAY_STATE = "paused";
          PLAY_TIME = 0.0;
          stop_controller();
          if (SCENE_PID > 0) syscall("send_msg", SCENE_PID, { type: "load_scene", path: np });
        } else if (act == "start_rehearsal") {
          // 从当前画面无缝转入闭环飞行排演，不跳变！
          MODE = "rehearsal";
          PLAY_STATE = "playing";
          if (DURATION < PLAY_TIME + 30.0) DURATION = PLAY_TIME + 30.0;
          if (SCENE_PID > 0) syscall("send_msg", SCENE_PID, { type: "enter_rehearsal", atTime: PLAY_TIME });
          ensure_controller_running();
          STATUS_MSG = "已转入飞行排演模式";
          dispatch_frame(false);
        } else if (act == "set_wind") {
          let wval = to_num(ev.value != null ? ev.value : ch.value);
          WIND_VEC = [wval, 0.0, -wval * 0.35];
          dispatch_frame(false);
        } else if (act == "set_heading") {
          TARGET_HEADING = to_num(ev.value != null ? ev.value : ch.value);
          LANDING_PAD2 = false;
          dispatch_frame(false);
        } else if (act == "land_pad2") {
          TARGET_POS = [22, 0.44, -12];
          LANDING_PAD2 = true;
          STATUS_MSG = "已指令飞控前往 2 号停机坪悬停降落";
          dispatch_frame(false);
        } else if (act == "trigger_fault") {
          FAULT_MODE = ch.fault || (FAULT_MODE == "none" ? "tail_failure" : "none");
          STATUS_MSG = FAULT_MODE == "none" ? "已清除人工故障" : ("注入故障: " + FAULT_MODE);
          dispatch_frame(false);
        } else if (act == "ctrl_path_input") {
          CTRL_PATH = ev.value != null ? ev.value : CTRL_PATH;
        } else if (act == "reload_controller") {
          stop_controller();
          if (MODE == "rehearsal") ensure_controller_running();
          else STATUS_MSG = "已设定飞控程序: " + CTRL_PATH;
        } else if (act == "save_rehearsal") {
          let spath = "/Documents/rehearsal_" + to_str(floor(syscall("time_now"))) + ".rehearsal";
          if (SCENE_PID > 0) syscall("send_msg", SCENE_PID, { type: "save_rehearsal", path: spath });
        }
      }
    }
    msg = syscall("recv_msg", 0);
  }

  // 根据所属系统虚拟时间推进播放头
  if (PLAY_STATE == "playing" && dt_sec > 0) {
    let adv = dt_sec * PLAY_RATE;
    PLAY_TIME += adv;
    if (MODE == "playback") {
      if (PLAY_TIME >= DURATION) {
        if (LOOP_ON) {
          PLAY_TIME = 0.0;
          dispatch_frame(true);
        } else {
          PLAY_TIME = DURATION;
          PLAY_STATE = "ended";
          dispatch_frame(false);
        }
      } else {
        dispatch_frame(false);
      }
    } else {
      // 排演模式持续推进虚拟时间与动态时长
      if (PLAY_TIME + 5.0 > DURATION) DURATION = PLAY_TIME + 10.0;
      dispatch_frame(false);
    }
  }

  submit_ui();
}
`;

export const PLAYER_SCENE_NS_SOURCE = `// ============================================================================
// 三维场景播放器 · 飞行物理、碰撞与场景求值进程 (/System/player_scene.ns)
// 职责：读取 .scene / .rehearsal 资源，按物理步长求值机体位姿、地形/障碍接触、
// 部件损坏与碎片翻滚，维护检查点缓存支持任意时刻精确跳转与续演。
// ============================================================================

let WIN_ID = __args.winId;
let SEQ_PID = __args.seqPid;
let FX_PID = __args.fxPid;
let SCENE_PATH = __args.scenePath || "/Demo/helicopter-24.scene";

let SCENE = null;
let IS_GENERIC = false;
let IS_REHEARSAL_FILE = false;
let RECORDED_CTRLS = null;
let SIM = null; // 当前物理状态
let CHECKPOINTS = {}; // "tIdx" (0.5s) -> cloned SIM
let REHEARSAL_LOG = []; // [{ t, ctrl, wind, fault }]
let MODE = "playback";
let LAST_TICK_REQ = null;

// 与显示设备完全一致的地形高度函数
fn terrain_height(terrain, x, z) {
  if (!terrain) return 0;
  let base_y = terrain.baseY || 0;
  let hs = terrain.hillScale || 0;
  if (hs == 0) return base_y;
  let r = sqrt(x * x + z * z);
  let vr = terrain.valleyRadius || 38;
  let rim = 0;
  if (r > vr) {
    let d = r - vr;
    rim = min(22, d * d * 0.0085);
  }
  let wave = (sin(x * 0.075) * cos(z * 0.068) + 0.45 * sin((x + z) * 0.11)) * hs * 0.35;
  let d1 = sqrt((x + 22) * (x + 22) + (z - 14) * (z - 14));
  let d2 = sqrt((x - 22) * (x - 22) + (z + 12) * (z + 12));
  let f1 = clamp((d1 - 7) / 8, 0, 1);
  let f2 = clamp((d2 - 7) / 8, 0, 1);
  let blend = min(f1, f2);
  let bumps = 0;
  if (terrain.bumps) {
    for (let i = 0; i < len(terrain.bumps); i += 1) {
      let b = terrain.bumps[i];
      let db = sqrt((x - b.x) * (x - b.x) + (z - b.z) * (z - b.z));
      if (db < b.radius) {
        let k = 1 - db / b.radius;
        bumps += b.height * k * k;
      }
    }
  }
  return base_y + (rim + wave) * blend + bumps;
}

fn surface_height_at(x, z) {
  let gy = terrain_height(SCENE.terrain, x, z);
  if (SCENE.helipads) {
    for (let i = 0; i < len(SCENE.helipads); i += 1) {
      let p = SCENE.helipads[i];
      let d = sqrt((x - p.pos[0]) * (x - p.pos[0]) + (z - p.pos[2]) * (z - p.pos[2]));
      if (d <= p.radius) {
        let top_y = p.pos[1] + (p.height || 0.44) * 0.5;
        if (top_y > gy) gy = top_y;
      }
    }
  }
  return gy;
}

fn check_obstacle_hit(x, y, z) {
  if (!SCENE.obstacles) return null;
  for (let i = 0; i < len(SCENE.obstacles); i += 1) {
    let ob = SCENE.obstacles[i];
    if (ob.shape == "cylinder") {
      let dx = x - ob.pos[0];
      let dz = z - ob.pos[2];
      let hr = (ob.radius || 1.5) + 1.4;
      let hh = (ob.height || 4) * 0.5 + 1.0;
      if (dx * dx + dz * dz < hr * hr && abs(y - ob.pos[1]) < hh) {
        return ob;
      }
    } else {
      let hx = (ob.size[0] || 4) * 0.5 + 1.4;
      let hy = (ob.size[1] || 4) * 0.5 + 1.0;
      let hz = (ob.size[2] || 4) * 0.5 + 1.4;
      if (abs(x - ob.pos[0]) < hx && abs(y - ob.pos[1]) < hy && abs(z - ob.pos[2]) < hz) {
        return ob;
      }
    }
  }
  return null;
}

fn make_initial_sim() {
  let ini = SCENE.initialState || {
    pos: [-22, 0.88, 14],
    vel: [0, 0, 0],
    rot: [0, 0.85, 0],
    angVel: [0, 0, 0],
    rpm: 0.35,
    targetHeading: 0.85,
    targetPos: [22, 0.88, -12],
    wind: [1.4, 0, -0.6]
  };
  let parts = {};
  if (SCENE.heroModel && SCENE.heroModel.parts) {
    for (let i = 0; i < len(SCENE.heroModel.parts); i += 1) {
      let pt = SCENE.heroModel.parts[i];
      parts[pt.id] = { damage: 0, detached: false };
    }
  }
  return {
    t: 0.0,
    pos: clone(ini.pos),
    vel: clone(ini.vel),
    rot: clone(ini.rot),
    angVel: clone(ini.angVel),
    rpm: ini.rpm || 0.25,
    mainRotorAngle: 0.0,
    tailRotorAngle: 0.0,
    wind: clone(ini.wind || [1.4, 0, -0.6]),
    targetHeading: ini.targetHeading || 0.85,
    targetPos: clone(ini.targetPos || [22, 0.44, -12]),
    fault: { active: false, type: "none", severity: 0 },
    crashed: false,
    crashTime: null,
    crashPos: null,
    parts: parts,
    debris: [],
    lastCtrl: { collective: 0.0, pitch: 0.0, roll: 0.0, yaw: 0.0 }
  };
}

// 默认演出闭环参考控制律 (与 flight_ctrl.ns 同构，驱动默认演出按脚本阶段飞行)
fn compute_default_perf_ctrl(s, t) {
  let phases = SCENE.defaultPerformance.phases;
  let ph = phases[0];
  for (let i = 0; i < len(phases); i += 1) {
    if (t >= phases[i].t) ph = phases[i];
  }
  if (ph.fault) {
    s.fault = { active: true, type: ph.fault.type, severity: ph.fault.severity };
  } else {
    s.fault = { active: false, type: "none", severity: 0 };
  }
  if (ph.mode == "spool") {
    return { collective: 0.12, pitch: 0, roll: 0, yaw: 0 };
  }
  if (ph.mode == "uncontrolled") {
    // 失控阶段：尾桨失效+向右翻滚俯冲
    return { collective: 0.28, pitch: 0.58, roll: 0.65, yaw: -0.92 };
  }
  // 正常闭环飞向阶段目标点
  let tx = ph.targetPos[0];
  let ty = ph.targetAlt;
  let tz = ph.targetPos[2];
  let ex = tx - s.pos[0];
  let ey = ty - s.pos[1];
  let ez = tz - s.pos[2];

  let yaw = s.rot[1];
  let sy = sin(yaw);
  let cy = cos(yaw);
  // 转换位置误差到机体局部前/右坐标
  let fwd_err = ex * sy + ez * cy;
  let right_err = ex * cy - ez * sy;
  let fwd_vel = s.vel[0] * sy + s.vel[2] * cy;
  let right_vel = s.vel[0] * cy - s.vel[2] * sy;

  let des_pitch = clamp(fwd_err * 0.032 - fwd_vel * 0.065, -0.34, 0.34);
  let des_roll = clamp(-right_err * 0.028 + right_vel * 0.055, -0.36, 0.36);

  let pitch_cmd = clamp((des_pitch - s.rot[0]) * 3.8 - s.angVel[0] * 1.4, -1, 1);
  let roll_cmd = clamp((des_roll - s.rot[2]) * 3.8 - s.angVel[2] * 1.4, -1, 1);
  let des_yaw = atan2(ex, ez);
  let dyaw = des_yaw - yaw;
  while (dyaw > 3.14159) dyaw -= 6.28318;
  while (dyaw < -3.14159) dyaw += 6.28318;
  let yaw_cmd = clamp(dyaw * 1.8 - s.angVel[1] * 0.9, -1, 1);
  let coll = clamp(0.62 + ey * 0.14 - s.vel[1] * 0.16, 0.05, 1.35);

  if (ph.fault && ph.fault.type == "tail_precursor") {
    yaw_cmd += sin(t * 9.0) * 0.25;
  }
  return { collective: coll, pitch: pitch_cmd, roll: roll_cmd, yaw: yaw_cmd };
}

fn spawn_debris_on_crash(s) {
  let det_ids = ["main_rotor_blades", "tail_boom", "skid_left", "skid_right", "engine_cowling"];
  let dirs = [
    [-4.5, 6.2, 3.2],
    [3.8, 4.5, -5.2],
    [-2.5, 2.8, -3.1],
    [3.1, 3.2, 2.4],
    [1.8, 5.4, 3.9]
  ];
  for (let i = 0; i < len(det_ids); i += 1) {
    let pid = det_ids[i];
    if (has_key(s.parts, pid)) {
      s.parts[pid].detached = true;
      s.parts[pid].damage = 1.0;
    }
    let d = dirs[i];
    push(s.debris, {
      partId: pid,
      pos: [s.pos[0] + d[0] * 0.18, s.pos[1] + 0.8, s.pos[2] + d[2] * 0.18],
      vel: [s.vel[0] * 0.35 + d[0], max(2.2, abs(s.vel[1]) * 0.3 + d[1]), s.vel[2] * 0.35 + d[2]],
      rot: [s.rot[0], s.rot[1], s.rot[2]],
      angVel: [2.5 + i * 0.9, -3.2 + i * 1.1, 2.8 - i * 0.7],
      settled: false
    });
  }
  if (has_key(s.parts, "tail_rotor_blades")) {
    s.parts["tail_rotor_blades"].detached = true;
    s.parts["tail_rotor_blades"].damage = 1.0;
  }
  if (has_key(s.parts, "fuselage")) s.parts["fuselage"].damage = 0.85;
  if (has_key(s.parts, "cockpit_glass")) s.parts["cockpit_glass"].damage = 0.9;
}

// 核心 6-DOF 飞行动力学与碰撞单步推进 (固定 dt = 1/60s)
fn step_physics(s, dt, ctrl) {
  s.t += dt;
  s.lastCtrl = ctrl;

  // 推进已脱落的 3D 碎片刚体弹跳与停稳
  for (let i = 0; i < len(s.debris); i += 1) {
    let db = s.debris[i];
    if (db.settled) continue;
    db.vel[1] -= 9.81 * dt;
    db.pos[0] += db.vel[0] * dt;
    db.pos[1] += db.vel[1] * dt;
    db.pos[2] += db.vel[2] * dt;
    db.rot[0] += db.angVel[0] * dt;
    db.rot[1] += db.angVel[1] * dt;
    db.rot[2] += db.angVel[2] * dt;
    let gy = surface_height_at(db.pos[0], db.pos[2]) + 0.28;
    if (db.pos[1] <= gy) {
      db.pos[1] = gy;
      if (abs(db.vel[1]) > 1.1) {
        db.vel[1] = -db.vel[1] * 0.28;
      } else {
        db.vel[1] = 0;
      }
      db.vel[0] *= 0.68;
      db.vel[2] *= 0.68;
      db.angVel[0] *= 0.55;
      db.angVel[1] *= 0.55;
      db.angVel[2] *= 0.55;
      let spd = abs(db.vel[0]) + abs(db.vel[1]) + abs(db.vel[2]);
      if (spd < 0.14) {
        db.vel = [0, 0, 0];
        db.angVel = [0, 0, 0];
        db.settled = true;
      }
    }
  }

  if (s.crashed) {
    s.rpm = max(0, s.rpm - 0.55 * dt);
    s.mainRotorAngle += s.rpm * 24.0 * dt;
    // 残骸主体受阻尼停稳
    let gy = surface_height_at(s.pos[0], s.pos[2]) + 0.45;
    if (s.pos[1] > gy) {
      s.vel[1] -= 9.81 * dt;
      s.pos[0] += s.vel[0] * dt;
      s.pos[1] += s.vel[1] * dt;
      s.pos[2] += s.vel[2] * dt;
      if (s.pos[1] <= gy) {
        s.pos[1] = gy;
        s.vel = [s.vel[0] * 0.4, 0, s.vel[2] * 0.4];
      }
    } else {
      s.vel[0] *= 0.85;
      s.vel[2] *= 0.85;
      s.pos[0] += s.vel[0] * dt;
      s.pos[2] += s.vel[2] * dt;
      s.pos[1] = gy;
      if (abs(s.vel[0]) + abs(s.vel[2]) < 0.06) s.vel = [0, 0, 0];
    }
    return;
  }

  // 旋翼加速
  let target_rpm = ctrl.collective > 0.05 ? 1.0 : 0.35;
  s.rpm += (target_rpm - s.rpm) * min(1, 2.2 * dt);
  s.mainRotorAngle += s.rpm * 34.0 * dt;
  s.tailRotorAngle += s.rpm * 68.0 * dt;

  let pitch = s.rot[0];
  let yaw = s.rot[1];
  let roll = s.rot[2];

  // 故障效应：前兆抖动或尾桨完全失效（丧失反扭矩与尾舵控制，诱发急剧偏航/滚转/失升下坠）
  let fault_yaw_torque = 0;
  let fault_roll_torque = 0;
  let fault_pitch_torque = 0;
  let yaw_eff = 1.0;
  let lift_eff = 1.0;
  if (s.fault.active) {
    if (s.fault.type == "tail_precursor") {
      fault_yaw_torque = sin(s.t * 14.0) * 0.85;
    } else if (s.fault.type == "tail_failure") {
      fault_yaw_torque = -6.8;
      fault_roll_torque = 5.8 + sin(s.t * 4.5) * 2.2;
      fault_pitch_torque = 2.4 + cos(s.t * 3.8) * 1.8;
      yaw_eff = 0.08;
      lift_eff = 0.56;
    }
  }

  // 本征不稳定直升机动力学：没有控制输入就会发散倾斜！
  let instab_pitch = 0.85 * sin(pitch) + 0.12;
  let instab_roll = 0.95 * sin(roll) - 0.08;

  let ap = ctrl.pitch * 4.8 + instab_pitch + fault_pitch_torque - s.angVel[0] * 1.15;
  let ay = ctrl.yaw * 3.6 * yaw_eff + fault_yaw_torque - s.angVel[1] * 0.95;
  let ar = ctrl.roll * 5.2 + instab_roll + fault_roll_torque - s.angVel[2] * 1.15;

  s.angVel[0] += ap * dt;
  s.angVel[1] += ay * dt;
  s.angVel[2] += ar * dt;

  s.rot[0] += s.angVel[0] * dt;
  s.rot[1] += s.angVel[1] * dt;
  s.rot[2] += s.angVel[2] * dt;

  // 旋翼总升力沿机体上方向量分解到世界坐标
  let thrust_mag = clamp(ctrl.collective, 0, 1.5) * 15.82 * s.rpm * lift_eff;
  let cp = cos(s.rot[0]);
  let sp = sin(s.rot[0]);
  let cr = cos(s.rot[2]);
  let sr = sin(s.rot[2]);
  let cy = cos(s.rot[1]);
  let sy = sin(s.rot[1]);

  // 机体上轴在世界坐标中的投影
  let ux = sy * sp * cr + cy * sr;
  let uy = cp * cr;
  let uz = cy * sp * cr - sy * sr;

  let ax = ux * thrust_mag + (s.wind[0] - s.vel[0]) * 0.32;
  let ay_f = uy * thrust_mag - 9.81 + (s.wind[1] - s.vel[1]) * 0.25;
  let az = uz * thrust_mag + (s.wind[2] - s.vel[2]) * 0.32;

  s.vel[0] += ax * dt;
  s.vel[1] += ay_f * dt;
  s.vel[2] += az * dt;

  s.pos[0] += s.vel[0] * dt;
  s.pos[1] += s.vel[1] * dt;
  s.pos[2] += s.vel[2] * dt;

  // 地形与障碍物接触检测
  let gy = surface_height_at(s.pos[0], s.pos[2]) + 0.44;
  let ob_hit = check_obstacle_hit(s.pos[0], s.pos[1], s.pos[2]);

  if (ob_hit != null) {
    s.crashed = true;
    s.crashTime = s.t;
    s.crashPos = clone(s.pos);
    spawn_debris_on_crash(s);
    return;
  }

  if (s.pos[1] <= gy) {
    s.pos[1] = gy;
    let impact_spd = abs(s.vel[1]) + 0.35 * sqrt(s.vel[0] * s.vel[0] + s.vel[2] * s.vel[2]);
    let bad_tilt = abs(s.rot[0]) > 0.38 || abs(s.rot[2]) > 0.38;
    if (impact_spd > 3.6 || (bad_tilt && s.t > 1.5)) {
      s.crashed = true;
      s.crashTime = s.t;
      s.crashPos = [s.pos[0], gy - 0.44, s.pos[2]];
      s.rot[2] = clamp(s.rot[2], -0.8, 0.8);
      spawn_debris_on_crash(s);
    } else {
      // 安全停落地面/停机坪
      if (s.vel[1] < 0) s.vel[1] = 0;
      s.vel[0] *= 0.82;
      s.vel[2] *= 0.82;
      s.angVel[0] *= 0.7;
      s.angVel[2] *= 0.7;
      s.rot[0] *= 0.85;
      s.rot[2] *= 0.85;
    }
  }
}

fn eval_generic_scene(t) {
  let out_ents = [];
  if (SCENE.entities) {
    for (let i = 0; i < len(SCENE.entities); i += 1) {
      let e = clone(SCENE.entities[i]);
      if (e.keyframes && len(e.keyframes) > 0) {
        let k0 = e.keyframes[0];
        let k1 = e.keyframes[len(e.keyframes) - 1];
        for (let j = 0; j < len(e.keyframes) - 1; j += 1) {
          if (t >= e.keyframes[j].t && t <= e.keyframes[j + 1].t) {
            k0 = e.keyframes[j];
            k1 = e.keyframes[j + 1];
            break;
          }
        }
        let span = k1.t - k0.t;
        let alpha = span > 0 ? clamp((t - k0.t) / span, 0, 1) : 0;
        if (k0.pos && k1.pos) {
          e.pos = [
            k0.pos[0] + (k1.pos[0] - k0.pos[0]) * alpha,
            k0.pos[1] + (k1.pos[1] - k0.pos[1]) * alpha,
            k0.pos[2] + (k1.pos[2] - k0.pos[2]) * alpha
          ];
        }
        if (k0.rot && k1.rot) {
          e.rot = [
            k0.rot[0] + (k1.rot[0] - k0.rot[0]) * alpha,
            k0.rot[1] + (k1.rot[1] - k0.rot[1]) * alpha,
            k0.rot[2] + (k1.rot[2] - k0.rot[2]) * alpha
          ];
        }
      }
      push(out_ents, e);
    }
  }
  return out_ents;
}

fn save_checkpoint_if_needed(s) {
  let key = to_str(floor(s.t * 2 + 0.0001));
  if (!has_key(CHECKPOINTS, key)) {
    CHECKPOINTS[key] = clone(s);
  }
}

fn lookup_recorded_ctrl(t) {
  if (!RECORDED_CTRLS || len(RECORDED_CTRLS) == 0) return { collective: 0, pitch: 0, roll: 0, yaw: 0 };
  let chosen = RECORDED_CTRLS[0];
  for (let i = 0; i < len(RECORDED_CTRLS); i += 1) {
    if (RECORDED_CTRLS[i].t <= t + 0.0001) chosen = RECORDED_CTRLS[i];
    else break;
  }
  return chosen;
}

fn advance_playback_to(target_t) {
  if (IS_GENERIC) {
    SIM.t = target_t;
    return;
  }
  // 从最近的检查点或从头确定性步进至 target_t
  if (target_t < SIM.t - 0.001) {
    let best_k = floor(target_t * 2);
    let found = null;
    while (best_k >= 0) {
      let ks = to_str(best_k);
      if (has_key(CHECKPOINTS, ks)) { found = CHECKPOINTS[ks]; break; }
      best_k -= 1;
    }
    SIM = found ? clone(found) : make_initial_sim();
  }
  let dt = 1.0 / 60.0;
  let guard = 0;
  while (SIM.t + dt * 0.5 <= target_t && guard < 1200) {
    guard += 1;
    let ctrl = null;
    if (IS_REHEARSAL_FILE) {
      let rec = lookup_recorded_ctrl(SIM.t);
      if (rec.wind) SIM.wind = clone(rec.wind);
      if (rec.fault) SIM.fault = clone(rec.fault);
      ctrl = rec.ctrl;
    } else {
      ctrl = compute_default_perf_ctrl(SIM, SIM.t);
    }
    step_physics(SIM, dt, ctrl);
    save_checkpoint_if_needed(SIM);
  }
}

fn load_scene_path(path) {
  let rd = syscall("fs_read", path);
  if (!rd.ok) {
    syscall("send_msg", SEQ_PID, { type: "scene_error", error: rd.error });
    return;
  }
  let parsed = json_parse(rd.content);
  if (!parsed) {
    syscall("send_msg", SEQ_PID, { type: "scene_error", error: "无效的场景 JSON" });
    return;
  }
  if (parsed.magic == "NSREHEARSAL") {
    let srd = syscall("fs_read", parsed.scenePath);
    if (!srd.ok) {
      syscall("send_msg", SEQ_PID, { type: "scene_error", error: "找不到基础场景: " + parsed.scenePath });
      return;
    }
    SCENE = json_parse(srd.content);
    SCENE_PATH = parsed.scenePath;
    IS_REHEARSAL_FILE = true;
    RECORDED_CTRLS = parsed.controlLog || [];
    IS_GENERIC = false;
  } else {
    SCENE = parsed;
    SCENE_PATH = path;
    IS_REHEARSAL_FILE = false;
    RECORDED_CTRLS = null;
    IS_GENERIC = !(SCENE.heroModel && SCENE.heroModel.kind == "helicopter_articulated");
  }

  CHECKPOINTS = {};
  REHEARSAL_LOG = [];
  if (IS_GENERIC) {
    SIM = { t: 0.0 };
  } else {
    SIM = make_initial_sim();
    CHECKPOINTS["0"] = clone(SIM);
  }

  syscall("display_3d_load", WIN_ID, {
    isGeneric: IS_GENERIC,
    environment: SCENE.environment,
    terrain: SCENE.terrain,
    helipads: SCENE.helipads,
    obstacles: SCENE.obstacles,
    trees: SCENE.trees,
    heroModel: SCENE.heroModel,
    entities: SCENE.entities,
    lights: SCENE.lights,
    cameras: SCENE.cameras
  });

  syscall("send_msg", SEQ_PID, {
    type: "scene_loaded",
    name: SCENE.name || path,
    duration: SCENE.duration || (IS_REHEARSAL_FILE ? 20.0 : 15.0),
    fps: SCENE.fps || 30,
    isRehearsal: IS_REHEARSAL_FILE,
    wind: SIM.wind,
    targetHeading: SIM.targetHeading,
    targetPos: SIM.targetPos
  });
}

fn submit_current_frame(cam_mode, cam_orbit) {
  if (!SCENE || !SIM) return;
  if (IS_GENERIC) {
    syscall("display_3d_frame", WIN_ID, {
      isGeneric: true,
      frameTime: SIM.t,
      entities: eval_generic_scene(SIM.t),
      cameraMode: cam_mode,
      cameraOrbit: cam_orbit
    });
    syscall("send_msg", SEQ_PID, { type: "scene_frame_done", frameTime: SIM.t, heliAlt: 0, crashed: false });
    return;
  }

  let gy = surface_height_at(SIM.pos[0], SIM.pos[2]);
  let alt_agl = max(0, SIM.pos[1] - gy - 0.44);
  let pkt = {
    isGeneric: false,
    frameTime: SIM.t,
    cameraMode: cam_mode,
    cameraOrbit: cam_orbit,
    heliPose: {
      pos: SIM.pos,
      rot: SIM.rot,
      vel: SIM.vel,
      rpm: SIM.rpm,
      mainRotorAngle: SIM.mainRotorAngle,
      tailRotorAngle: SIM.tailRotorAngle
    },
    parts: SIM.parts,
    debris: SIM.debris,
    fault: SIM.fault,
    crashed: SIM.crashed,
    crashTime: SIM.crashTime,
    crashPos: SIM.crashPos,
    altitudeAGL: alt_agl,
    wind: SIM.wind
  };
  syscall("display_3d_frame", WIN_ID, pkt);
  if (FX_PID > 0) {
    syscall("send_msg", FX_PID, { type: "fx_scene_state", state: pkt });
  }
  syscall("send_msg", SEQ_PID, {
    type: "scene_frame_done",
    frameTime: SIM.t,
    heliAlt: alt_agl,
    crashed: SIM.crashed
  });
}

load_scene_path(SCENE_PATH);
submit_current_frame("cinematic", { yaw: 0.65, pitch: 0.36, dist: 24.0 });

while (true) {
  let msg = syscall("recv_msg", 40);
  while (msg != null) {
    let d = msg.data;
    if (d.type == "load_scene") {
      MODE = "playback";
      load_scene_path(d.path);
      submit_current_frame("cinematic", { yaw: 0.65, pitch: 0.36, dist: 24.0 });
    } else if (d.type == "enter_rehearsal") {
      MODE = "rehearsal";
      // 保留当前姿态与速度无跳变续演，记录已发生的控制历史
      if (len(REHEARSAL_LOG) == 0 && !IS_GENERIC) {
        let dt_rec = 1.0 / 30.0;
        let ts = 0.0;
        let tmp = make_initial_sim();
        while (ts < SIM.t) {
          let ctrl = IS_REHEARSAL_FILE ? lookup_recorded_ctrl(ts).ctrl : compute_default_perf_ctrl(tmp, ts);
          push(REHEARSAL_LOG, { t: ts, ctrl: clone(ctrl), wind: clone(tmp.wind), fault: clone(tmp.fault) });
          step_physics(tmp, dt_rec, ctrl);
          ts += dt_rec;
        }
      }
    } else if (d.type == "save_rehearsal") {
      let doc = {
        magic: "NSREHEARSAL",
        version: 1,
        scenePath: SCENE_PATH,
        duration: max(SIM.t, 1.0),
        fps: 30,
        controlLog: REHEARSAL_LOG
      };
      let wr = syscall("fs_write", d.path, json_stringify(doc));
      syscall("send_msg", SEQ_PID, { type: "rehearsal_saved", ok: wr.ok, path: d.path, error: wr.error });
    } else if (d.type == "frame_tick") {
      MODE = d.mode || MODE;
      if (MODE == "playback") {
        advance_playback_to(d.time);
        submit_current_frame(d.cameraMode, d.cameraOrbit);
      } else if (!IS_GENERIC) {
        // 排演模式：受控对象随系统虚拟时间连续步进，不等待飞控！
        SIM.wind = d.wind || SIM.wind;
        SIM.targetHeading = d.targetHeading != null ? d.targetHeading : SIM.targetHeading;
        SIM.targetPos = d.targetPos || SIM.targetPos;
        if (d.faultMode && d.faultMode != "none") {
          SIM.fault = { active: true, type: d.faultMode, severity: d.faultMode == "tail_failure" ? 1.0 : 0.45 };
        } else {
          SIM.fault = { active: false, type: "none", severity: 0 };
        }
        let dt = 1.0 / 60.0;
        let guard = 0;
        while (SIM.t + dt * 0.5 <= d.time && guard < 300) {
          guard += 1;
          let ctrl = syscall("heli_read_controls", WIN_ID, SIM.t);
          push(REHEARSAL_LOG, { t: SIM.t, ctrl: clone(ctrl), wind: clone(SIM.wind), fault: clone(SIM.fault) });
          step_physics(SIM, dt, ctrl);
        }
        let gy = surface_height_at(SIM.pos[0], SIM.pos[2]);
        syscall("heli_publish_sensors", WIN_ID, {
          ok: true,
          timestamp: syscall("time_now") / 1000.0,
          simTime: SIM.t,
          mode: "rehearsal",
          pos: SIM.pos,
          vel: SIM.vel,
          rot: SIM.rot,
          angVel: SIM.angVel,
          altitudeAGL: max(0, SIM.pos[1] - gy - 0.44),
          groundY: gy,
          rpm: SIM.rpm,
          crashed: SIM.crashed,
          wind: SIM.wind,
          targetHeading: SIM.targetHeading,
          targetPos: SIM.targetPos,
          landingRequested: d.landingPad2 || false,
          fault: SIM.fault
        });
        submit_current_frame(d.cameraMode, d.cameraOrbit);
      }
    }
    msg = syscall("recv_msg", 0);
  }
}
`;

export const PLAYER_FX_NS_SOURCE = `// ============================================================================
// 三维场景播放器 · 环境特效进程 (/System/player_fx.ns)
// 职责：根据旋翼下洗高度、风速、故障状态与撞击事件计算尘土、烟火与草叶扰动参数，
// 提交给显示设备进行确定性展开渲染。挂起本进程将只停止环境特效更新。
// ============================================================================

let WIN_ID = __args.winId;
let LAST_SCENE = null;
let LAST_TIME = 0.0;
let LAST_WIND = [1.4, 0, -0.6];

fn emit_fx() {
  if (!LAST_SCENE || LAST_SCENE.isGeneric) return;
  let hp = LAST_SCENE.heliPose;
  let emitters = [];
  let alt = LAST_SCENE.altitudeAGL || 0;

  // 下洗气流尘土环
  let downwash = 0;
  if (!LAST_SCENE.crashed && hp.rpm > 0.2 && alt < 11.0) {
    downwash = hp.rpm * clamp(1.0 - alt / 11.0, 0, 1);
    push(emitters, {
      kind: "dust_ring",
      origin: [hp.pos[0], hp.pos[1] - alt - 0.3, hp.pos[2]],
      intensity: downwash,
      startTime: 0,
      endTime: null,
      seed: 101
    });
  }

  // 引擎故障黑烟与火星 (故障先于失控)
  if (LAST_SCENE.fault && LAST_SCENE.fault.active && !LAST_SCENE.crashed) {
    push(emitters, {
      kind: "engine_smoke",
      origin: [hp.pos[0], hp.pos[1] + 0.5, hp.pos[2]],
      intensity: LAST_SCENE.fault.severity || 0.6,
      startTime: 0,
      endTime: null,
      seed: 202
    });
    push(emitters, {
      kind: "sparks",
      origin: [hp.pos[0], hp.pos[1] + 0.4, hp.pos[2]],
      intensity: LAST_SCENE.fault.severity || 0.6,
      startTime: 0,
      endTime: null,
      seed: 303
    });
  }

  // 撞击高潮火球与余波残骸浓烟
  if (LAST_SCENE.crashed && LAST_SCENE.crashPos != null) {
    let ct = LAST_SCENE.crashTime || 0;
    let since = LAST_TIME - ct;
    if (since >= 0 && since < 2.2) {
      push(emitters, {
        kind: "fireball",
        origin: LAST_SCENE.crashPos,
        intensity: clamp(1.0 - since / 2.2, 0, 1),
        startTime: ct,
        endTime: ct + 2.2,
        seed: 404
      });
    }
    push(emitters, {
      kind: "wreck_smoke",
      origin: LAST_SCENE.crashPos,
      intensity: 1.0,
      startTime: ct,
      endTime: null,
      seed: 505
    });
  }

  syscall("display_3d_fx", WIN_ID, {
    frameTime: LAST_TIME,
    wind: LAST_WIND,
    downwashPos: [hp.pos[0], hp.pos[2]],
    downwashStrength: downwash,
    emitters: emitters
  });
}

while (true) {
  let msg = syscall("recv_msg", 100);
  while (msg != null) {
    let d = msg.data;
    if (d.type == "fx_tick") {
      LAST_TIME = d.time;
      if (d.wind) LAST_WIND = d.wind;
      emit_fx();
    } else if (d.type == "fx_scene_state") {
      LAST_SCENE = d.state;
      LAST_TIME = d.state.frameTime;
      emit_fx();
    }
    msg = syscall("recv_msg", 0);
  }
}
`;

export const FLIGHT_CTRL_NS_SOURCE = `// ============================================================================
// 24号直升机闭环飞控程序 (/System/flight_ctrl.ns)
// 说明：本程序作为子系统内的普通进程运行，与其他进程竞争执行预算。
// 通过系统调用 heli_read_sensors 读取传感器、heli_write_controls 输出总距与舵面。
// ============================================================================

let PLAYER_ID = __args.playerId;
let CRUISE_ALT = 9.0;

while (true) {
  let s = syscall("heli_read_sensors", PLAYER_ID);
  if (s && s.ok && !s.crashed) {
    let tx = s.targetPos[0];
    let tz = s.targetPos[2];
    let dx = tx - s.pos[0];
    let dz = tz - s.pos[2];
    let dist_xz = sqrt(dx * dx + dz * dz);

    // 若收到前往 2 号停机坪降落指令，接近目标后平稳降低高度并悬停着陆
    let goal_alt = CRUISE_ALT;
    if (s.landingRequested) {
      if (dist_xz < 4.5) {
        goal_alt = 0.15;
      } else if (dist_xz < 12.0) {
        goal_alt = 4.0;
      }
    }

    let alt_err = goal_alt - s.altitudeAGL;
    let yaw = s.rot[1];
    let sy = sin(yaw);
    let cy = cos(yaw);

    // 若指定了目标航点，在距离较远时转向并飞向目标点；否则保持设定航向悬停
    let des_vx = 0;
    let des_vz = 0;
    if (s.landingRequested || dist_xz > 2.5) {
      let spd = min(5.5, dist_xz * 0.45);
      if (dist_xz > 0.2) {
        des_vx = (dx / dist_xz) * spd;
        des_vz = (dz / dist_xz) * spd;
      }
    }

    let vx_err = des_vx - s.vel[0];
    let vz_err = des_vz - s.vel[2];
    let fwd_err = vx_err * sy + vz_err * cy;
    let right_err = vx_err * cy - vz_err * sy;

    // 期望俯仰与横滚角 + 风速前馈补偿
    let des_pitch = clamp(fwd_err * 0.085, -0.32, 0.32);
    let des_roll = clamp(-right_err * 0.085, -0.32, 0.32);

    let pitch_cmd = clamp((des_pitch - s.rot[0]) * 4.2 - s.angVel[0] * 1.45, -1, 1);
    let roll_cmd = clamp((des_roll - s.rot[2]) * 4.2 - s.angVel[2] * 1.45, -1, 1);

    let des_yaw = s.targetHeading;
    if (s.landingRequested && dist_xz > 5.0) {
      des_yaw = atan2(dx, dz);
    }
    let dyaw = des_yaw - yaw;
    while (dyaw > 3.14159) dyaw -= 6.28318;
    while (dyaw < -3.14159) dyaw += 6.28318;
    let yaw_cmd = clamp(dyaw * 2.2 - s.angVel[1] * 1.1, -1, 1);

    // 总距控制（包含重力和姿态倾角补偿）
    let tilt_comp = 1.0 / max(0.65, cos(s.rot[0]) * cos(s.rot[2]));
    let coll = clamp(0.62 * tilt_comp + alt_err * 0.16 - s.vel[1] * 0.22, 0.05, 1.38);
    if (s.landingRequested && dist_xz < 2.5 && s.altitudeAGL < 0.35) {
      coll = 0.08; // 触坪停桨
    }

    syscall("heli_write_controls", PLAYER_ID, {
      collective: coll,
      pitch: pitch_cmd,
      roll: roll_cmd,
      yaw: yaw_cmd
    });
  }
  syscall("sleep", 33);
}
`;
