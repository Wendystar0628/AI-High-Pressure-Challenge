// Subsystem Window Manager & Desktop Shell (/System/wm.ns)
// Written in NScript: owns windows, z-order, focus, hit-testing, drag/resize/snap,
// taskbar, start menu, desktop icons, and input forwarding to app processes & child systems.

export const WM_NS_SOURCE = `// ============================================================================
// 叠境操作系统 · 子系统窗口管理器与桌面外壳 (/System/wm.ns)
// 说明：窗口次序 (Z_ORDER)、焦点分配 (FOCUSED_WIN)、命中测试 (wm_hit_test)
// 与输入分发均由本程序决定。修改后重启对应子系统即可按新规则运行。
// ============================================================================

let MY_PID = syscall("get_pid");
let SYS_INFO = syscall("get_system_info");
syscall("wm_register");

let DESK_W = 960;
let DESK_H = 600;
let TASKBAR_H = 40;
let TITLEBAR_H = 30;
let NEXT_WIN_SEQ = 1;

let WINDOWS = [];
let Z_ORDER = [];
let FOCUSED_WIN = null;

let START_OPEN = false;
let CONTEXT_MENU = null; // { x, y, targetType, targetId }
let CONFIRM_MODAL = null; // { kind, winId, childId, message }
let PROJECT_POPUP = null; // { winId, x, y, targets }
let DRAG = null; // { mode, winId, edge, startX, startY, origX, origY, origW, origH }
let SELECTED_ICON = null;
let LAST_CLICK_ICON = null;
let LAST_CLICK_TIME = 0;
let LAST_TITLE_CLICK_WIN = null;
let LAST_TITLE_CLICK_TIME = 0;

let ICONS = [
  { id: "ico_player", appId: "player", label: "三维场景播放器", x: 18, y: 18 },
  { id: "ico_charts", appId: "charts", label: "图表工作台", x: 18, y: 104 },
  { id: "ico_files", appId: "files", label: "文件管理器", x: 18, y: 190 },
  { id: "ico_editor", appId: "editor", label: "程序编辑器", x: 18, y: 276 },
  { id: "ico_tasks", appId: "tasks", label: "进程管理器", x: 18, y: 362 },
  { id: "ico_newsys", appId: "new_system", label: "新建子系统", x: 18, y: 448 }
];

fn find_win(wid) {
  for (let i = 0; i < len(WINDOWS); i += 1) {
    if (WINDOWS[i].id == wid) return WINDOWS[i];
  }
  return null;
}

fn find_win_by_child(cid) {
  for (let i = 0; i < len(WINDOWS); i += 1) {
    if (WINDOWS[i].childSystemId == cid) return WINDOWS[i];
  }
  return null;
}

// 规则函数 1：窗口焦点分配 (可修改此规则以改变焦点转移行为)
fn wm_assign_focus(wid) {
  FOCUSED_WIN = wid;
}

// 规则函数 2：窗口置顶与次序调整 (可修改此规则以改变层叠顺序)
fn wm_bring_to_front(wid) {
  let w = find_win(wid);
  if (!w) return;
  let new_z = [];
  for (let i = 0; i < len(Z_ORDER); i += 1) {
    if (Z_ORDER[i] != wid) push(new_z, Z_ORDER[i]);
  }
  push(new_z, wid);
  Z_ORDER = new_z;
  wm_assign_focus(wid);
}

fn wm_pick_next_focus() {
  for (let i = len(Z_ORDER) - 1; i >= 0; i -= 1) {
    let w = find_win(Z_ORDER[i]);
    if (w && !w.minimized) {
      wm_assign_focus(w.id);
      return;
    }
  }
  wm_assign_focus(null);
}

// 规则函数 3：坐标命中测试 (严格按 Z_ORDER 从顶到底判定窗口与区域)
fn wm_hit_test(x, y) {
  if (CONFIRM_MODAL != null) {
    return { kind: "modal" };
  }
  if (PROJECT_POPUP != null) {
    let px = PROJECT_POPUP.x;
    let py = PROJECT_POPUP.y;
    let pw = 210;
    let ph = 36 + len(PROJECT_POPUP.targets) * 32;
    if (x >= px && x <= px + pw && y >= py && y <= py + ph) {
      return { kind: "project_popup" };
    }
  }
  if (CONTEXT_MENU != null) {
    let cx = CONTEXT_MENU.x;
    let cy = CONTEXT_MENU.y;
    if (x >= cx && x <= cx + 170 && y >= cy && y <= cy + 140) {
      return { kind: "context_menu" };
    }
  }
  if (START_OPEN) {
    if (x >= 8 && x <= 268 && y >= DESK_H - TASKBAR_H - 320 && y <= DESK_H - TASKBAR_H) {
      return { kind: "start_menu" };
    }
  }
  if (y >= DESK_H - TASKBAR_H) {
    return { kind: "taskbar" };
  }

  // 自顶向下遍历 Z_ORDER 窗口栈
  for (let i = len(Z_ORDER) - 1; i >= 0; i -= 1) {
    let w = find_win(Z_ORDER[i]);
    if (!w || w.minimized) continue;
    let pad = 6;
    if (x >= w.x - pad && x <= w.x + w.w + pad && y >= w.y - pad && y <= w.y + w.h + pad) {
      // 判定边缘缩放区（顶部仅留 3px 外缘以免误触标题栏按钮）
      let on_l = !w.maximized && x <= w.x + 5;
      let on_r = !w.maximized && x >= w.x + w.w - 5;
      let on_t = !w.maximized && y <= w.y + 3;
      let on_b = !w.maximized && y >= w.y + w.h - 5;
      if (on_r && on_b) return { kind: "win_resize", win: w, edge: "se" };
      if (on_l || on_r || on_t || on_b) {
        let edge = "";
        if (on_t) edge += "n";
        if (on_b) edge += "s";
        if (on_l) edge += "w";
        if (on_r) edge += "e";
        return { kind: "win_resize", win: w, edge: edge };
      }
      if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + TITLEBAR_H) {
        return { kind: "win_titlebar", win: w };
      }
      if (x >= w.x && x <= w.x + w.w && y >= w.y + TITLEBAR_H && y <= w.y + w.h) {
        return { kind: "win_client", win: w };
      }
    }
  }

  // 桌面图标
  for (let i = len(ICONS) - 1; i >= 0; i -= 1) {
    let ic = ICONS[i];
    if (x >= ic.x && x <= ic.x + 82 && y >= ic.y && y <= ic.y + 78) {
      return { kind: "icon", icon: ic };
    }
  }
  return { kind: "desktop" };
}

fn clamp_win_rect(w) {
  let max_h = max(180, DESK_H - TASKBAR_H);
  if (w.w > DESK_W) w.w = DESK_W;
  if (w.h > max_h) w.h = max_h;
  if (w.w < 260) w.w = min(260, DESK_W);
  if (w.h < 180) w.h = min(180, max_h);
  w.x = clamp(w.x, 0, max(0, DESK_W - w.w));
  w.y = clamp(w.y, 0, max(0, max_h - w.h));
}

fn toggle_maximize(w) {
  let max_h = max(180, DESK_H - TASKBAR_H);
  if (w.maximized) {
    if (w.restoreRect) {
      w.x = w.restoreRect.x;
      w.y = w.restoreRect.y;
      w.w = w.restoreRect.w;
      w.h = w.restoreRect.h;
    }
    w.maximized = false;
    w.snapped = null;
  } else {
    w.restoreRect = { x: w.x, y: w.y, w: w.w, h: w.h };
    w.x = 0;
    w.y = 0;
    w.w = DESK_W;
    w.h = max_h;
    w.maximized = true;
    w.snapped = null;
  }
}

fn snap_window(w, side) {
  let max_h = max(180, DESK_H - TASKBAR_H);
  if (!w.maximized && !w.snapped) {
    w.restoreRect = { x: w.x, y: w.y, w: w.w, h: w.h };
  }
  w.maximized = false;
  w.snapped = side;
  w.y = 0;
  w.h = max_h;
  w.w = floor(DESK_W / 2);
  if (side == "left") w.x = 0;
  else w.x = DESK_W - w.w;
}

fn close_window_now(wid) {
  let w = find_win(wid);
  if (!w) return;
  if (w.appId == "subsystem" && w.childSystemId) {
    syscall("sys_child_op", w.childSystemId, "stop", null);
  }
  if (w.pid > 0) syscall("kill", w.pid);
  if (w.coopPids) {
    for (let i = 0; i < len(w.coopPids); i += 1) {
      syscall("kill", w.coopPids[i]);
    }
  }
  syscall("host_window_closed", wid);

  let nw = [];
  for (let i = 0; i < len(WINDOWS); i += 1) {
    if (WINDOWS[i].id != wid) push(nw, WINDOWS[i]);
  }
  WINDOWS = nw;
  let nz = [];
  for (let i = 0; i < len(Z_ORDER); i += 1) {
    if (Z_ORDER[i] != wid) push(nz, Z_ORDER[i]);
  }
  Z_ORDER = nz;
  if (FOCUSED_WIN == wid) wm_pick_next_focus();
}

fn launch_app(app_id, params) {
  if (app_id == "new_system") {
    let cr = syscall("sys_create_child", null);
    return cr;
  }

  let wid = SYS_INFO.id + "-win-" + to_str(NEXT_WIN_SEQ);
  NEXT_WIN_SEQ += 1;
  let max_h = max(200, DESK_H - TASKBAR_H);
  let def_w = min(640, max(320, DESK_W - 80));
  let def_h = min(440, max(240, max_h - 50));
  let title = app_id;
  let script = "/System/files.ns";

  if (app_id == "player") {
    title = "三维场景播放器与飞行排演";
    script = "/System/player_seq.ns";
    def_w = min(760, max(380, DESK_W - 50));
    def_h = min(480, max(260, max_h - 40));
  } else if (app_id == "charts") {
    title = "实时数据图表工作台";
    script = "/System/chart_draw.ns";
    def_w = min(640, max(360, DESK_W - 60));
    def_h = min(440, max(250, max_h - 40));
  } else if (app_id == "files") {
    title = "文件管理器";
    script = "/System/files.ns";
  } else if (app_id == "editor") {
    title = "文本与程序编辑器";
    script = "/System/editor.ns";
    def_w = min(640, max(360, DESK_W - 60));
    def_h = min(450, max(250, max_h - 40));
  } else if (app_id == "tasks") {
    title = "进程与系统管理器";
    script = "/System/tasks.ns";
    def_w = min(680, max(380, DESK_W - 60));
    def_h = min(450, max(260, max_h - 40));
  }

  let off = ((NEXT_WIN_SEQ - 2) % 5) * 26;
  let wx = min(90 + off, max(0, DESK_W - def_w));
  let wy = min(22 + off, max(0, max_h - def_h));

  let sp = syscall("spawn", script, { winId: wid, params: params || {} }, "app");
  if (!sp || !sp.ok) {
    return sp;
  }

  let win = {
    id: wid,
    appId: app_id,
    title: title,
    pid: sp.pid,
    coopPids: [],
    x: wx,
    y: wy,
    w: def_w,
    h: def_h,
    minimized: false,
    maximized: false,
    snapped: null,
    restoreRect: null,
    childSystemId: null,
    ui: { kind: "loading", text: "正在启动 " + title + "..." }
  };
  push(WINDOWS, win);
  push(Z_ORDER, wid);
  wm_assign_focus(wid);
  START_OPEN = false;
  return { ok: true, winId: wid };
}

fn open_child_system_window(cid, title) {
  let existing = find_win_by_child(cid);
  if (existing) {
    existing.minimized = false;
    wm_bring_to_front(existing.id);
    return;
  }
  let wid = SYS_INFO.id + "-win-" + to_str(NEXT_WIN_SEQ);
  NEXT_WIN_SEQ += 1;
  let max_h = max(240, DESK_H - TASKBAR_H);
  let cw = min(floor(DESK_W * 0.84), max(420, DESK_W - 40));
  let ch = min(floor(max_h * 0.86), max(280, max_h - 24));
  let wx = max(16, DESK_W - cw - 16);
  let wy = max(12, floor((max_h - ch) / 2));

  let win = {
    id: wid,
    appId: "subsystem",
    title: title || cid,
    pid: -1,
    coopPids: [],
    x: wx,
    y: wy,
    w: cw,
    h: ch,
    minimized: false,
    maximized: false,
    snapped: null,
    restoreRect: null,
    childSystemId: cid,
    ui: null
  };
  push(WINDOWS, win);
  push(Z_ORDER, wid);
  wm_assign_focus(wid);
}

fn handle_control_action(ev) {
  let act = ev.action;
  let target_id = ev.targetId;
  if (act == "start_toggle") {
    START_OPEN = !START_OPEN;
    CONTEXT_MENU = null;
    PROJECT_POPUP = null;
    return;
  }
  if (act == "launch") {
    START_OPEN = false;
    CONTEXT_MENU = null;
    launch_app(target_id, ev.params);
    return;
  }
  if (act == "taskbar_toggle") {
    let w = find_win(target_id);
    if (!w) return;
    if (w.minimized) {
      w.minimized = false;
      wm_bring_to_front(w.id);
    } else if (FOCUSED_WIN == w.id) {
      w.minimized = true;
      wm_pick_next_focus();
    } else {
      wm_bring_to_front(w.id);
    }
    return;
  }
  if (act == "win_minimize") {
    let w = find_win(target_id);
    if (w) {
      w.minimized = true;
      if (FOCUSED_WIN == w.id) wm_pick_next_focus();
    }
    return;
  }
  if (act == "win_maximize") {
    let w = find_win(target_id);
    if (w) {
      toggle_maximize(w);
      wm_bring_to_front(w.id);
    }
    return;
  }
  if (act == "win_close") {
    let w = find_win(target_id);
    if (!w) return;
    if (w.appId == "subsystem") {
      CONFIRM_MODAL = {
        kind: "close_child",
        winId: w.id,
        childId: w.childSystemId,
        message: "确认停止并关闭子系统 " + w.childSystemId + "（将停止其整棵子树内的全部程序）？"
      };
    } else {
      close_window_now(w.id);
    }
    return;
  }
  if (act == "confirm_modal_yes") {
    if (CONFIRM_MODAL && CONFIRM_MODAL.kind == "close_child") {
      close_window_now(CONFIRM_MODAL.winId);
    }
    CONFIRM_MODAL = null;
    return;
  }
  if (act == "confirm_modal_no") {
    CONFIRM_MODAL = null;
    return;
  }
  if (act == "win_project_menu") {
    let w = find_win(target_id);
    if (!w) return;
    let tree = syscall("sys_get_tree");
    let targets = [];
    // 收集所有祖先系统 (含 outer)
    let cur_pid = SYS_INFO.parentId;
    let map = {};
    for (let i = 0; i < len(tree); i += 1) map[tree[i].id] = tree[i];
    while (cur_pid != null && has_key(map, cur_pid)) {
      let anc = map[cur_pid];
      push(targets, { id: anc.id, label: anc.id == "outer" ? "根系统桌面 (outer)" : anc.name + " (" + anc.id + ")" });
      cur_pid = anc.parentId;
    }
    PROJECT_POPUP = {
      winId: w.id,
      x: clamp(w.x + w.w - 220, 8, DESK_W - 220),
      y: w.y + TITLEBAR_H + 4,
      targets: targets
    };
    return;
  }
  if (act == "project_to") {
    if (PROJECT_POPUP) {
      let w = find_win(PROJECT_POPUP.winId);
      if (w) {
        syscall("project_window", w.id, target_id, {
          appId: w.appId,
          title: w.title,
          pid: w.pid
        });
      }
      PROJECT_POPUP = null;
    }
    return;
  }
  if (act == "ctx_action") {
    CONTEXT_MENU = null;
    if (target_id == "new_system") launch_app("new_system", null);
    else if (target_id == "open_files") launch_app("files", null);
    else if (target_id == "open_editor") launch_app("editor", null);
    else if (target_id == "open_tasks") launch_app("tasks", null);
    else if (target_id == "open_player") launch_app("player", null);
    else if (target_id == "open_charts") launch_app("charts", null);
    return;
  }
}

fn handle_raw_input(ev) {
  if (ev.type == "open_projection") {
    let p = ev.proj;
    if (p) {
      let ex = find_win(p.projWinId);
      if (ex) {
        ex.minimized = false;
        wm_bring_to_front(ex.id);
        return;
      }
      let max_h = max(200, DESK_H - TASKBAR_H);
      let pw = min(680, max(360, DESK_W - 60));
      let ph = min(460, max(250, max_h - 40));
      let win = {
        id: p.projWinId,
        appId: "projection",
        title: p.title,
        pid: -1,
        coopPids: [],
        sourceSystemId: p.sourceSystemId,
        sourceWindowId: p.sourceWindowId,
        sourceAppId: p.sourceAppId,
        x: 64,
        y: 24,
        w: pw,
        h: ph,
        minimized: false,
        maximized: false,
        snapped: null,
        restoreRect: null,
        childSystemId: null,
        ui: null
      };
      push(WINDOWS, win);
      push(Z_ORDER, win.id);
      wm_assign_focus(win.id);
    }
    return;
  }

  if (ev.type == "focus_projection") {
    let w = find_win(ev.projWinId);
    if (w) {
      w.minimized = false;
      wm_bring_to_front(w.id);
    }
    return;
  }

  if (ev.type == "close_projection") {
    if (find_win(ev.projWinId)) {
      close_window_now(ev.projWinId);
    }
    return;
  }

  if (ev.type == "resize_viewport") {
    DESK_W = max(360, to_num(ev.width));
    DESK_H = max(240, to_num(ev.height));
    for (let i = 0; i < len(WINDOWS); i += 1) {
      if (WINDOWS[i].maximized) {
        WINDOWS[i].w = DESK_W;
        WINDOWS[i].h = max(180, DESK_H - TASKBAR_H);
      } else {
        clamp_win_rect(WINDOWS[i]);
      }
    }
    return;
  }

  if (ev.type == "pointermove") {
    if (DRAG != null) {
      let w = find_win(DRAG.winId);
      if (!w) { DRAG = null; return; }
      let dx = ev.x - DRAG.startX;
      let dy = ev.y - DRAG.startY;
      let max_h = max(180, DESK_H - TASKBAR_H);
      if (DRAG.mode == "move") {
        if (w.maximized || w.snapped) {
          if (abs(dx) > 10 || abs(dy) > 10) {
            let rw = w.restoreRect ? w.restoreRect.w : floor(DESK_W * 0.65);
            let rh = w.restoreRect ? w.restoreRect.h : floor(max_h * 0.72);
            w.maximized = false;
            w.snapped = null;
            w.w = rw;
            w.h = rh;
            DRAG.origX = clamp(ev.x - floor(rw / 2), 0, DESK_W - rw);
            DRAG.origY = max(0, ev.y - 14);
            DRAG.startX = ev.x;
            DRAG.startY = ev.y;
            dx = 0;
            dy = 0;
          }
        }
        w.x = clamp(DRAG.origX + dx, -floor(w.w * 0.5), DESK_W - 80);
        w.y = clamp(DRAG.origY + dy, 0, max_h - 32);
      } else if (DRAG.mode == "resize") {
        let e = DRAG.edge;
        if (index_of(e, "e") >= 0) w.w = max(280, min(DESK_W - w.x, DRAG.origW + dx));
        if (index_of(e, "s") >= 0) w.h = max(200, min(max_h - w.y, DRAG.origH + dy));
        if (index_of(e, "w") >= 0) {
          let nw = max(280, DRAG.origW - dx);
          w.x = clamp(DRAG.origX + (DRAG.origW - nw), 0, DRAG.origX + DRAG.origW - 280);
          w.w = nw;
        }
        if (index_of(e, "n") >= 0) {
          let nh = max(200, DRAG.origH - dy);
          w.y = clamp(DRAG.origY + (DRAG.origH - nh), 0, DRAG.origY + DRAG.origH - 200);
          w.h = nh;
        }
      }
      return;
    }
    // 将悬停/拖动传给当前命中或捕获的应用/子系统
    let hit = wm_hit_test(ev.x, ev.y);
    if (hit.kind == "win_client") {
      let w = hit.win;
      let lx = ev.x - w.x;
      let ly = ev.y - (w.y + TITLEBAR_H);
      if (w.appId == "subsystem" && w.childSystemId) {
        let sx = floor((lx * 960) / max(1, w.w));
        let sy = floor((ly * 600) / max(1, w.h - TITLEBAR_H));
        syscall("sys_forward_input", w.childSystemId, { type: "pointermove", x: sx, y: sy, controlHint: ev.controlHint });
      } else if (w.pid > 0) {
        ipc_forward(w, { type: "pointermove", x: lx, y: ly, controlHint: ev.controlHint });
      }
    }
    return;
  }

  if (ev.type == "pointerup") {
    if (DRAG != null) {
      let w = find_win(DRAG.winId);
      if (w && DRAG.mode == "move") {
        if (ev.x <= 12) snap_window(w, "left");
        else if (ev.x >= DESK_W - 12) snap_window(w, "right");
        else clamp_win_rect(w);
      }
      DRAG = null;
      return;
    }
    let hit = wm_hit_test(ev.x, ev.y);
    if (hit.kind == "win_client") {
      let w = hit.win;
      let lx = ev.x - w.x;
      let ly = ev.y - (w.y + TITLEBAR_H);
      if (w.appId == "subsystem" && w.childSystemId) {
        let sx = floor((lx * 960) / max(1, w.w));
        let sy = floor((ly * 600) / max(1, w.h - TITLEBAR_H));
        syscall("sys_forward_input", w.childSystemId, { type: "pointerup", x: sx, y: sy, button: ev.button, controlHint: ev.controlHint });
      } else if (w.pid > 0) {
        ipc_forward(w, { type: "pointerup", x: lx, y: ly, button: ev.button, controlHint: ev.controlHint });
      }
    }
    return;
  }

  if (ev.type == "drop_file_to_window") {
    let w = find_win(ev.winId);
    if (w && w.appId == "files" && w.pid > 0) {
      syscall("send_msg", w.pid, { type: "external_drop", name: ev.name, content: ev.content, overwrite: ev.overwrite });
    }
    return;
  }

  if (ev.type == "control_action") {
    if (CONFIRM_MODAL != null && ev.action != "confirm_modal_yes" && ev.action != "confirm_modal_no") return;
    if (ev.targetSysId && ev.targetSysId != SYS_INFO.id) {
      let hit = wm_hit_test(ev.x, ev.y);
      if (hit.kind == "win_client" && hit.win.childSystemId) {
        wm_bring_to_front(hit.win.id);
        let lx = ev.x - hit.win.x;
        let ly = ev.y - (hit.win.y + TITLEBAR_H);
        let sx = floor((lx * 960) / max(1, hit.win.w));
        let sy = floor((ly * 600) / max(1, hit.win.h - TITLEBAR_H));
        syscall("sys_forward_input", hit.win.childSystemId, {
          type: "control_action",
          targetSysId: ev.targetSysId,
          action: ev.action,
          targetId: ev.targetId,
          params: ev.params,
          windowId: ev.windowId,
          x: sx,
          y: sy
        });
      }
      return;
    }
    // 校验触发控件所属窗口是否被上层窗口遮挡！
    if (ev.windowId) {
      let hit = wm_hit_test(ev.x, ev.y);
      if (hit.kind == "win_titlebar" || hit.kind == "win_client" || hit.kind == "win_resize") {
        if (hit.win.id != ev.windowId) return;
      }
    }
    handle_control_action(ev);
    return;
  }

  if (ev.type == "keydown" || ev.type == "input_text") {
    if (ev.key == "Escape") {
      START_OPEN = false;
      CONTEXT_MENU = null;
      PROJECT_POPUP = null;
      CONFIRM_MODAL = null;
    }
    let tw = (ev.controlHint && ev.controlHint.windowId) ? find_win(ev.controlHint.windowId) : null;
    if (tw && !tw.minimized && tw.pid > 0) {
      ipc_forward(tw, ev);
      return;
    }
    if (FOCUSED_WIN != null) {
      let fw = find_win(FOCUSED_WIN);
      if (fw && !fw.minimized) {
        if (fw.appId == "subsystem" && fw.childSystemId) {
          syscall("sys_forward_input", fw.childSystemId, ev);
        } else if (fw.pid > 0) {
          ipc_forward(fw, ev);
        }
      }
    }
    return;
  }

  if (ev.type == "contextmenu") {
    let hit = wm_hit_test(ev.x, ev.y);
    if (hit.kind == "desktop" || hit.kind == "icon") {
      CONTEXT_MENU = {
        x: clamp(ev.x, 4, DESK_W - 176),
        y: clamp(ev.y, 4, DESK_H - TASKBAR_H - 146),
        targetType: hit.kind
      };
      START_OPEN = false;
      PROJECT_POPUP = null;
      return;
    }
    if (hit.kind == "win_client") {
      let w = hit.win;
      wm_bring_to_front(w.id);
      let lx = ev.x - w.x;
      let ly = ev.y - (w.y + TITLEBAR_H);
      if (w.appId == "subsystem" && w.childSystemId) {
        let sx = floor((lx * 960) / max(1, w.w));
        let sy = floor((ly * 600) / max(1, w.h - TITLEBAR_H));
        syscall("sys_forward_input", w.childSystemId, { type: "contextmenu", x: sx, y: sy, controlHint: ev.controlHint });
      } else if (w.pid > 0) {
        ipc_forward(w, { type: "contextmenu", x: lx, y: ly, controlHint: ev.controlHint });
      }
    }
    return;
  }

  if (ev.type == "wheel") {
    let hit = wm_hit_test(ev.x, ev.y);
    if (hit.kind == "win_client") {
      let w = hit.win;
      let lx = ev.x - w.x;
      let ly = ev.y - (w.y + TITLEBAR_H);
      if (w.appId == "subsystem" && w.childSystemId) {
        let sx = floor((lx * 960) / max(1, w.w));
        let sy = floor((ly * 600) / max(1, w.h - TITLEBAR_H));
        syscall("sys_forward_input", w.childSystemId, { type: "wheel", x: sx, y: sy, deltaY: ev.deltaY, controlHint: ev.controlHint });
      } else if (w.pid > 0) {
        ipc_forward(w, { type: "wheel", x: lx, y: ly, deltaY: ev.deltaY, controlHint: ev.controlHint });
      }
    }
    return;
  }

  if (ev.type == "pointerdown" || ev.type == "dblclick") {
    let hit = wm_hit_test(ev.x, ev.y);
    if (hit.kind != "start_menu" && !(ev.controlHint && ev.controlHint.testId == "start-toggle")) {
      START_OPEN = false;
    }
    if (hit.kind != "context_menu") CONTEXT_MENU = null;
    if (hit.kind != "project_popup") PROJECT_POPUP = null;

    if (hit.kind == "desktop") {
      SELECTED_ICON = null;
      wm_assign_focus(null);
      return;
    }
    if (hit.kind == "icon") {
      let now = syscall("time_now");
      SELECTED_ICON = hit.icon.id;
      if (ev.type == "dblclick" || (LAST_CLICK_ICON == hit.icon.id && now - LAST_CLICK_TIME < 450)) {
        launch_app(hit.icon.appId, null);
        LAST_CLICK_ICON = null;
      } else {
        LAST_CLICK_ICON = hit.icon.id;
        LAST_CLICK_TIME = now;
      }
      return;
    }
    if (hit.kind == "win_titlebar") {
      let w = hit.win;
      wm_bring_to_front(w.id);
      if (ev.controlHint && ev.controlHint.action) {
        handle_control_action({
          action: ev.controlHint.action,
          targetId: w.id,
          windowId: w.id,
          x: ev.x,
          y: ev.y
        });
        return;
      }
      let now = syscall("time_now");
      if (ev.type == "dblclick" || (LAST_TITLE_CLICK_WIN == w.id && now - LAST_TITLE_CLICK_TIME < 400)) {
        toggle_maximize(w);
        LAST_TITLE_CLICK_WIN = null;
        return;
      }
      LAST_TITLE_CLICK_WIN = w.id;
      LAST_TITLE_CLICK_TIME = now;
      DRAG = {
        mode: "move",
        winId: w.id,
        startX: ev.x,
        startY: ev.y,
        origX: w.x,
        origY: w.y,
        origW: w.w,
        origH: w.h
      };
      return;
    }
    if (hit.kind == "win_resize") {
      let w = hit.win;
      wm_bring_to_front(w.id);
      DRAG = {
        mode: "resize",
        winId: w.id,
        edge: hit.edge,
        startX: ev.x,
        startY: ev.y,
        origX: w.x,
        origY: w.y,
        origW: w.w,
        origH: w.h
      };
      return;
    }
    if (hit.kind == "win_client") {
      let w = hit.win;
      wm_bring_to_front(w.id);
      let lx = ev.x - w.x;
      let ly = ev.y - (w.y + TITLEBAR_H);
      if (w.appId == "subsystem" && w.childSystemId) {
        let sx = floor((lx * 960) / max(1, w.w));
        let sy = floor((ly * 600) / max(1, w.h - TITLEBAR_H));
        syscall("sys_forward_input", w.childSystemId, {
          type: ev.type,
          x: sx,
          y: sy,
          button: ev.button,
          shift: ev.shift,
          ctrl: ev.ctrl,
          controlHint: ev.controlHint
        });
      } else if (w.pid > 0) {
        // 严格防遮挡验证：仅允许命中同一窗口的 controlHint！
        let safe_hint = null;
        if (ev.controlHint && ev.controlHint.windowId == w.id) {
          safe_hint = ev.controlHint;
        }
        ipc_forward(w, {
          type: ev.type,
          x: lx,
          y: ly,
          button: ev.button,
          shift: ev.shift,
          ctrl: ev.ctrl,
          controlHint: safe_hint
        });
      }
      return;
    }
  }
}

fn ipc_forward(win, payload) {
  syscall("send_msg", win.pid, { type: "ui_event", event: payload });
}

fn render_desktop() {
  let ordered_wins = [];
  for (let i = 0; i < len(Z_ORDER); i += 1) {
    let w = find_win(Z_ORDER[i]);
    if (w) {
      push(ordered_wins, {
        id: w.id,
        appId: w.appId,
        title: w.title,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        zIndex: 10 + i,
        focused: FOCUSED_WIN == w.id,
        minimized: w.minimized,
        maximized: w.maximized,
        snapped: w.snapped,
        childSystemId: w.childSystemId,
        sourceSystemId: w.sourceSystemId,
        sourceWindowId: w.sourceWindowId,
        sourceAppId: w.sourceAppId,
        canProject: w.appId == "player" || w.appId == "charts",
        ui: w.ui
      });
    }
  }
  let vtime = syscall("time_now");
  syscall("wm_submit_desktop", {
    sysId: SYS_INFO.id,
    sysName: SYS_INFO.name,
    depth: SYS_INFO.depth,
    deskW: DESK_W,
    deskH: DESK_H,
    virtualTime: vtime,
    icons: ICONS,
    selectedIcon: SELECTED_ICON,
    windows: ordered_wins,
    focusedWinId: FOCUSED_WIN,
    startOpen: START_OPEN,
    contextMenu: CONTEXT_MENU,
    confirmModal: CONFIRM_MODAL,
    projectPopup: PROJECT_POPUP
  });
}

// 初始渲染
render_desktop();

while (true) {
  let msg = syscall("recv_msg", 100);
  let dirty = true;
  while (msg != null) {
    let d = msg.data;
    if (d.type == "raw_input") {
      handle_raw_input(d.event);
    } else if (d.type == "app_ui") {
      let w = find_win(d.winId);
      if (w) w.ui = d.ui;
    } else if (d.type == "register_coop_pid") {
      let w = find_win(d.winId);
      if (w) push(w.coopPids, d.pid);
    } else if (d.type == "open_child_window") {
      open_child_system_window(d.childId, d.title);
    } else if (d.type == "open_file") {
      // 从文件管理器打开文件到编辑器或播放器
      let ext = d.ext;
      if (ext == ".scene" || ext == ".rehearsal") {
        launch_app("player", { filePath: d.path });
      } else {
        launch_app("editor", { filePath: d.path });
      }
    } else if (d.type == "open_editor_path") {
      // 在本系统编辑器中打开指定路径（例如 kernel-open 打开直属子系统 kernel.ns）
      let existing_ed = null;
      for (let i = 0; i < len(WINDOWS); i += 1) {
        if (WINDOWS[i].appId == "editor") { existing_ed = WINDOWS[i]; break; }
      }
      if (existing_ed) {
        existing_ed.minimized = false;
        wm_bring_to_front(existing_ed.id);
        syscall("send_msg", existing_ed.pid, { type: "open_path", path: d.path });
      } else {
        launch_app("editor", { filePath: d.path });
      }
    } else if (d.type == "drop_file_to_window") {
      let w = find_win(d.winId);
      if (w && w.appId == "files" && w.pid > 0) {
        syscall("send_msg", w.pid, { type: "external_drop", name: d.name, content: d.content, overwrite: d.overwrite });
      }
    }
    msg = syscall("recv_msg", 0);
  }
  if (dirty) render_desktop();
}
`;
