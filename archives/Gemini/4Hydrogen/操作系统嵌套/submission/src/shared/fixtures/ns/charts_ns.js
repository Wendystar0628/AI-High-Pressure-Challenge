// Real-time Data Visualization Chart Workbench Multi-Process Group:
// - /System/chart_recv.ns (Cross-layer subscription & monotonic data receiver)
// - /System/chart_draw.ns (Chart layout calculation, virtual-time animation & UI)

export const CHART_RECV_NS_SOURCE = `// ============================================================================
// 图表工作台 · 跨层数据接收进程 (/System/chart_recv.ns)
// 职责：向根系统电子表格建立与维护实时数据连接，接收并缓存完整选区副本，
// 确保版本单调前进，并经 IPC 消息转交 chart_draw.ns 处理。
// ============================================================================

let DRAW_PID = __args.drawPid;
let SUB_ID = null;
let LAST_VERSION = 0;
let SOURCE_TITLE = "";
let RANGE_STR = "A1:D4";
let CONN_STATE = "disconnected"; // "disconnected" | "connected" | "source_closed" | "restored_pending"

while (true) {
  let msg = syscall("recv_msg", 80);
  while (msg != null) {
    let d = msg.data;
    if (d.type == "connect") {
      if (SUB_ID != null) {
        syscall("chart_unsubscribe", SUB_ID);
        SUB_ID = null;
      }
      RANGE_STR = d.range || "A1:D4";
      let res = syscall("chart_subscribe", d.docId, RANGE_STR);
      if (res && res.ok) {
        SUB_ID = res.subId;
        SOURCE_TITLE = res.title || d.sourceTitle || "";
        LAST_VERSION = res.version || 1;
        CONN_STATE = "connected";
        syscall("send_msg", DRAW_PID, {
          type: "sub_snapshot",
          subId: SUB_ID,
          docId: d.docId,
          sourceTitle: SOURCE_TITLE,
          range: RANGE_STR,
          version: LAST_VERSION,
          connectionState: CONN_STATE,
          data: res.initialData
        });
      } else {
        syscall("send_msg", DRAW_PID, {
          type: "sub_error",
          error: res ? res.error : "连接数据源失败"
        });
      }
    } else if (d.type == "disconnect") {
      if (SUB_ID != null) {
        syscall("chart_unsubscribe", SUB_ID);
        SUB_ID = null;
      }
      CONN_STATE = "disconnected";
      syscall("send_msg", DRAW_PID, {
        type: "sub_status",
        connectionState: CONN_STATE
      });
    } else if (d.type == "mark_restored") {
      SUB_ID = null;
      if (CONN_STATE == "connected") {
        CONN_STATE = "restored_pending";
        syscall("send_msg", DRAW_PID, {
          type: "sub_status",
          connectionState: CONN_STATE
        });
      }
    }
    msg = syscall("recv_msg", 0);
  }

  // 轮询跨层增量版本缓冲（若所属子树曾暂停，恢复后按序交付全部积压版本）
  if (SUB_ID != null && CONN_STATE == "connected") {
    let updates = syscall("chart_poll", SUB_ID);
    if (updates && len(updates) > 0) {
      for (let i = 0; i < len(updates); i += 1) {
        let u = updates[i];
        if (u.closed) {
          CONN_STATE = "source_closed";
          SUB_ID = null;
          syscall("send_msg", DRAW_PID, {
            type: "sub_status",
            connectionState: "source_closed"
          });
          break;
        }
        if (u.version > LAST_VERSION) {
          LAST_VERSION = u.version;
          syscall("send_msg", DRAW_PID, {
            type: "sub_update",
            version: u.version,
            data: u.data
          });
        }
      }
    }
  }
}
`;

export const CHART_DRAW_NS_SOURCE = `// ============================================================================
// 图表工作台 · 图表计算与绘制进程 (/System/chart_draw.ns)
// 职责：管理图表配置、接收 chart_recv.ns 的数据副本、基于子系统虚拟时间执行平滑过渡，
// 计算柱状图/折线图几何并提交可交互图表界面（同时支持投送窗口）。
// ============================================================================

let WIN_ID = __args.winId;
let MY_PID = syscall("get_pid");
let RECV_PID = -1;

let sp_recv = syscall("spawn", "/System/chart_recv.ns", { winId: WIN_ID, drawPid: MY_PID }, "app");
if (sp_recv && sp_recv.ok) {
  RECV_PID = sp_recv.pid;
  syscall("app_send_wm", { type: "register_coop_pid", winId: WIN_ID, pid: RECV_PID });
}

let SOURCES = [];
let SELECTED_DOC_ID = "";
let SOURCE_TITLE = "";
let RANGE_STR = "A1:D4";
let LABEL_COL = "A";
let SERIES_STR = "D"; // 例如 "D" 或 "B,D"
let CHART_TYPE = "bar"; // "bar" | "line"
let CONN_STATE = "disconnected";
let DATA_VERSION = 0;

let RAW_TABLE = null; // { cols: ["A","B","C","D"], headers: [...], rows: [[...], ...] }
let PARSED_SERIES = []; // [{ col, name, targetVals: [...], animVals: [...] }]
let LABELS = [];
let HOVER_INFO = null; // { seriesIdx, rowIdx, label, seriesName, value }
let SELECTED_PT = null;
let STATUS_MSG = "请选择工作簿并建立连接";
let LAST_ANIM_TIME = syscall("time_now");

fn refresh_sources() {
  let list = syscall("chart_list_sources");
  if (list) {
    SOURCES = list;
    if (SELECTED_DOC_ID == "" && len(SOURCES) > 0) {
      SELECTED_DOC_ID = SOURCES[0].docId;
      SOURCE_TITLE = SOURCES[0].title;
    }
  }
}

fn col_to_idx(col_letter) {
  let up = upper(trim(col_letter));
  if (!RAW_TABLE || !RAW_TABLE.cols) return -1;
  for (let i = 0; i < len(RAW_TABLE.cols); i += 1) {
    if (RAW_TABLE.cols[i] == up) return i;
  }
  return -1;
}

// 图表数值提取与坐标映射计算（修改此规则并重启可改变图表取值/计算规则）
fn rebuild_series_from_table() {
  if (!RAW_TABLE || !RAW_TABLE.rows) return;
  let l_idx = col_to_idx(LABEL_COL);
  if (l_idx < 0) l_idx = 0;

  let new_labels = [];
  for (let r = 0; r < len(RAW_TABLE.rows); r += 1) {
    let row = RAW_TABLE.rows[r];
    let lb = (l_idx < len(row) && row[l_idx] != null) ? to_str(row[l_idx]) : ("行" + to_str(r + 1));
    push(new_labels, lb);
  }
  LABELS = new_labels;

  let parts = split(SERIES_STR, ",");
  let new_series = [];
  for (let p = 0; p < len(parts); p += 1) {
    let cname = upper(trim(parts[p]));
    if (cname == "") continue;
    let c_idx = col_to_idx(cname);
    if (c_idx < 0) continue;
    let s_title = (RAW_TABLE.headers && c_idx < len(RAW_TABLE.headers) && RAW_TABLE.headers[c_idx]) ? to_str(RAW_TABLE.headers[c_idx]) : cname;
    let tvals = [];
    for (let r = 0; r < len(RAW_TABLE.rows); r += 1) {
      let row = RAW_TABLE.rows[r];
      let raw_v = c_idx < len(row) ? row[c_idx] : 0;
      let num_v = to_num(raw_v);
      if (is_nan(num_v)) num_v = 0;
      push(tvals, num_v);
    }
    // 若已有同列动画值则从当前值平滑过渡
    let avals = clone(tvals);
    for (let old_i = 0; old_i < len(PARSED_SERIES); old_i += 1) {
      if (PARSED_SERIES[old_i].col == cname) {
        let old_a = PARSED_SERIES[old_i].animVals;
        for (let k = 0; k < len(tvals); k += 1) {
          avals[k] = k < len(old_a) ? old_a[k] : 0;
        }
        break;
      }
    }
    push(new_series, {
      col: cname,
      name: s_title + " (" + cname + ")",
      targetVals: tvals,
      animVals: avals
    });
  }
  PARSED_SERIES = new_series;
}

fn step_chart_animation(dt_sec) {
  let alpha = min(1.0, dt_sec * 8.5);
  for (let s = 0; s < len(PARSED_SERIES); s += 1) {
    let ser = PARSED_SERIES[s];
    for (let i = 0; i < len(ser.targetVals); i += 1) {
      let cur = ser.animVals[i];
      let tgt = ser.targetVals[i];
      if (abs(tgt - cur) < 0.01) ser.animVals[i] = tgt;
      else ser.animVals[i] = cur + (tgt - cur) * alpha;
    }
  }
}

fn compute_chart_geometry() {
  let min_v = 0;
  let max_v = 10;
  let has_any = false;
  for (let s = 0; s < len(PARSED_SERIES); s += 1) {
    let tv = PARSED_SERIES[s].targetVals;
    let av = PARSED_SERIES[s].animVals;
    for (let i = 0; i < len(tv); i += 1) {
      let v = max(tv[i], av[i]);
      let vl = min(tv[i], av[i]);
      if (!has_any) { max_v = max(1, v); min_v = min(0, vl); has_any = true; }
      else { max_v = max(max_v, v); min_v = min(min_v, vl); }
    }
  }
  max_v = ceil(max_v * 1.15);
  if (max_v <= min_v) max_v = min_v + 10;

  let geom = {
    chartType: CHART_TYPE,
    yMin: min_v,
    yMax: max_v,
    labels: LABELS,
    series: PARSED_SERIES
  };
  return geom;
}

fn submit_ui() {
  refresh_sources();
  let geom = compute_chart_geometry();
  syscall("app_submit_ui", WIN_ID, {
    kind: "charts",
    sources: SOURCES,
    selectedDocId: SELECTED_DOC_ID,
    sourceTitle: SOURCE_TITLE,
    rangeStr: RANGE_STR,
    labelCol: LABEL_COL,
    seriesStr: SERIES_STR,
    availCols: RAW_TABLE ? RAW_TABLE.cols : ["A", "B", "C", "D"],
    chartType: CHART_TYPE,
    connectionState: CONN_STATE,
    version: DATA_VERSION,
    geometry: geom,
    hoverInfo: HOVER_INFO,
    selectedPt: SELECTED_PT,
    statusMsg: STATUS_MSG
  });
}

refresh_sources();
submit_ui();

while (true) {
  let msg = syscall("recv_msg", 45);
  let now = syscall("time_now");
  let dt_sec = max(0, (now - LAST_ANIM_TIME) / 1000.0);
  LAST_ANIM_TIME = now;

  while (msg != null) {
    let d = msg.data;
    if (d.type == "sub_snapshot") {
      CONN_STATE = d.connectionState;
      DATA_VERSION = d.version;
      SOURCE_TITLE = d.sourceTitle;
      RAW_TABLE = d.data;
      rebuild_series_from_table();
      STATUS_MSG = "已连接 · 版本 v" + to_str(DATA_VERSION);
    } else if (d.type == "sub_update") {
      DATA_VERSION = d.version;
      RAW_TABLE = d.data;
      rebuild_series_from_table();
      STATUS_MSG = "实时同步 · 版本 v" + to_str(DATA_VERSION);
    } else if (d.type == "sub_status") {
      CONN_STATE = d.connectionState;
      if (CONN_STATE == "source_closed") STATUS_MSG = "数据源已关闭（保留最后数据）";
      else if (CONN_STATE == "restored_pending") STATUS_MSG = "已恢复，待重新连接";
      else if (CONN_STATE == "disconnected") STATUS_MSG = "已断开连接（保留最后数据）";
    } else if (d.type == "sub_error") {
      STATUS_MSG = "连接错误: " + d.error;
    } else if (d.type == "ui_event" || d.type == "cross_input") {
      let ev = d.event;
      let ch = ev.controlHint;
      if (ch && ch.action) {
        let act = ch.action;
        if (act == "select_source") {
          SELECTED_DOC_ID = ev.value != null ? ev.value : ch.value;
          for (let i = 0; i < len(SOURCES); i += 1) {
            if (SOURCES[i].docId == SELECTED_DOC_ID) SOURCE_TITLE = SOURCES[i].title;
          }
        } else if (act == "input_range") {
          RANGE_STR = ev.value != null ? ev.value : ch.value;
        } else if (act == "select_label_col") {
          LABEL_COL = upper(trim(ev.value != null ? ev.value : ch.value));
          rebuild_series_from_table();
        } else if (act == "select_series") {
          SERIES_STR = upper(trim(ev.value != null ? ev.value : ch.value));
          rebuild_series_from_table();
        } else if (act == "toggle_series_col") {
          let c = upper(ch.col);
          let cur = split(SERIES_STR, ",");
          let next_list = [];
          let found = false;
          for (let i = 0; i < len(cur); i += 1) {
            let tc = upper(trim(cur[i]));
            if (tc == "") continue;
            if (tc == c) found = true;
            else push(next_list, tc);
          }
          if (!found) push(next_list, c);
          if (len(next_list) == 0) push(next_list, c);
          SERIES_STR = join(next_list, ",");
          rebuild_series_from_table();
        } else if (act == "connect") {
          refresh_sources();
          if (SELECTED_DOC_ID == "" && len(SOURCES) > 0) SELECTED_DOC_ID = SOURCES[0].docId;
          if (SELECTED_DOC_ID == "") {
            STATUS_MSG = "根系统中没有已打开的工作簿";
          } else {
            syscall("send_msg", RECV_PID, {
              type: "connect",
              docId: SELECTED_DOC_ID,
              sourceTitle: SOURCE_TITLE,
              range: RANGE_STR
            });
          }
        } else if (act == "disconnect") {
          syscall("send_msg", RECV_PID, { type: "disconnect" });
        } else if (act == "toggle_type") {
          CHART_TYPE = CHART_TYPE == "bar" ? "line" : "bar";
        } else if (act == "hover_point") {
          HOVER_INFO = ch.info;
        } else if (act == "select_point") {
          SELECTED_PT = ch.info;
        }
      }
    }
    msg = syscall("recv_msg", 0);
  }

  step_chart_animation(dt_sec);
  submit_ui();
}
`;
