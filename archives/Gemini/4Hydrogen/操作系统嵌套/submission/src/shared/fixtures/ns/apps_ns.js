// Subsystem Core Apps: /System/files.ns, /System/editor.ns, /System/tasks.ns

export const FILES_NS_SOURCE = `// ============================================================================
// 子系统文件管理器 (/System/files.ns)
// 支持目录导航、排序规则定制 (sort_entries)、多选、复制粘贴、新建、重命名、
// 回收站删除与恢复、跨层拖放接收、本机导入导出、以及双击打开应用。
// ============================================================================

let WIN_ID = __args.winId;
let CUR_DIR = "/Documents";
let ENTRIES = [];
let SELECTED = []; // 选中的路径数组
let CLIPBOARD_PATHS = [];
let SORT_BY = "name"; // "name" | "size" | "type"
let SORT_DESC = false;
let STATUS_MSG = "就绪";
let RENAME_TARGET = null;
let RENAME_TEXT = "";
let PATH_INPUT = CUR_DIR;
let OVERWRITE_PROMPT = null; // { name, content }
let SNAP_MODAL = null; // { path }

// 排序规则函数：修改本函数并重新打开文件管理器可改变排序与显示规则
fn sort_entries(list, sort_by, desc) {
  // 目录优先，然后按名称/大小排列（冒泡/插入排序，可被抢占调度）
  let out = clone(list);
  let n = len(out);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      let a = out[i];
      let b = out[j];
      let swap = false;
      if (a.type != b.type) {
        if (a.type != "dir" && b.type == "dir") swap = true;
      } else {
        if (sort_by == "size") {
          swap = desc ? (a.size < b.size) : (a.size > b.size);
        } else {
          swap = desc ? (a.name < b.name) : (a.name > b.name);
        }
      }
      if (swap) {
        out[i] = b;
        out[j] = a;
      }
    }
  }
  return out;
}

fn refresh() {
  let raw = syscall("fs_list", CUR_DIR);
  ENTRIES = sort_entries(raw, SORT_BY, SORT_DESC);
  PATH_INPUT = CUR_DIR;
}

fn get_ext(name) {
  let n = len(name);
  let dot = -1;
  for (let i = n - 1; i >= 0; i -= 1) {
    if (char_at(name, i) == ".") { dot = i; break; }
  }
  if (dot < 0) return "";
  return substr(name, dot, n - dot);
}

fn open_entry(path) {
  let st = syscall("fs_stat", path);
  if (!st) return;
  if (st.type == "dir") {
    CUR_DIR = path;
    SELECTED = [];
    refresh();
    return;
  }
  let ext = get_ext(path);
  if (ext == ".snap") {
    SNAP_MODAL = { path: path };
    return;
  }
  syscall("app_send_wm", { type: "open_file", path: path, ext: ext });
}

fn base_name(p) {
  let parts = split(p, "/");
  return parts[len(parts) - 1];
}

fn submit_ui() {
  let sys = syscall("get_system_info");
  syscall("app_submit_ui", WIN_ID, {
    kind: "files",
    curDir: CUR_DIR,
    pathInput: PATH_INPUT,
    entries: ENTRIES,
    selected: SELECTED,
    clipboardCount: len(CLIPBOARD_PATHS),
    sortBy: SORT_BY,
    sortDesc: SORT_DESC,
    statusMsg: STATUS_MSG,
    renameTarget: RENAME_TARGET,
    renameText: RENAME_TEXT,
    overwritePrompt: OVERWRITE_PROMPT,
    snapModal: SNAP_MODAL,
    storageUsed: sys.storageUsed,
    storageQuota: sys.storageQuota
  });
}

refresh();
submit_ui();

while (true) {
  let msg = syscall("recv_msg", 250);
  if (msg != null) {
    let d = msg.data;
    if (d.type == "external_drop") {
      let target_path = CUR_DIR == "/" ? ("/" + d.name) : (CUR_DIR + "/" + d.name);
      let exists = syscall("fs_stat", target_path);
      if (exists != null && !d.overwrite) {
        OVERWRITE_PROMPT = { name: d.name, content: d.content, targetPath: target_path };
      } else {
        let wr = syscall("fs_write", target_path, d.content);
        if (wr.ok) {
          STATUS_MSG = "已接收跨层文件: " + d.name;
          refresh();
        } else {
          STATUS_MSG = "接收失败: " + wr.error;
        }
      }
      submit_ui();
    } else if (d.type == "ui_event") {
      let ev = d.event;
      let ch = ev.controlHint;
      if (ch && ch.action) {
        let act = ch.action;
        if (act == "nav") {
          CUR_DIR = ch.path;
          SELECTED = [];
          RENAME_TARGET = null;
          refresh();
        } else if (act == "path_input") {
          PATH_INPUT = ev.value != null ? ev.value : ch.value;
        } else if (act == "path_go") {
          let st = syscall("fs_stat", PATH_INPUT);
          if (st && st.type == "dir") {
            CUR_DIR = PATH_INPUT;
            SELECTED = [];
            refresh();
          } else {
            STATUS_MSG = "目录不存在: " + PATH_INPUT;
          }
        } else if (act == "select_item") {
          let p = ch.path;
          if (ev.ctrl) {
            let idx = index_of(SELECTED, p);
            if (idx >= 0) splice_remove(SELECTED, idx, 1);
            else push(SELECTED, p);
          } else {
            SELECTED = [p];
          }
          if (ev.type == "dblclick") open_entry(p);
        } else if (act == "open_selected") {
          if (len(SELECTED) > 0) open_entry(SELECTED[0]);
        } else if (act == "new_file") {
          let seq = 1;
          let fnm = "program_" + to_str(seq) + ".ns";
          let fp = (CUR_DIR == "/" ? "" : CUR_DIR) + "/" + fnm;
          while (syscall("fs_stat", fp) != null) {
            seq += 1;
            fnm = "program_" + to_str(seq) + ".ns";
            fp = (CUR_DIR == "/" ? "" : CUR_DIR) + "/" + fnm;
          }
          let wr = syscall("fs_write", fp, "// 新建 NScript 程序\\nlet x = 1;\\nprint_log(\\"hello\\", x);\\n");
          if (wr.ok) {
            SELECTED = [fp];
            STATUS_MSG = "已新建文件: " + fnm;
            refresh();
          } else {
            STATUS_MSG = wr.error;
          }
        } else if (act == "new_folder") {
          let seq = 1;
          let dnm = "新建文件夹_" + to_str(seq);
          let dp = (CUR_DIR == "/" ? "" : CUR_DIR) + "/" + dnm;
          while (syscall("fs_stat", dp) != null) {
            seq += 1;
            dnm = "新建文件夹_" + to_str(seq);
            dp = (CUR_DIR == "/" ? "" : CUR_DIR) + "/" + dnm;
          }
          syscall("fs_mkdir", dp);
          STATUS_MSG = "已新建文件夹: " + dnm;
          refresh();
        } else if (act == "copy_selected") {
          CLIPBOARD_PATHS = clone(SELECTED);
          STATUS_MSG = "已复制 " + to_str(len(CLIPBOARD_PATHS)) + " 项";
        } else if (act == "paste") {
          for (let i = 0; i < len(CLIPBOARD_PATHS); i += 1) {
            let sp = CLIPBOARD_PATHS[i];
            let bn = base_name(sp);
            let dp = (CUR_DIR == "/" ? "" : CUR_DIR) + "/" + bn;
            if (dp == sp) dp = dp + ".copy";
            let cr = syscall("fs_copy", sp, dp);
            if (!cr.ok) STATUS_MSG = "粘贴失败: " + cr.error;
          }
          refresh();
        } else if (act == "delete_selected") {
          for (let i = 0; i < len(SELECTED); i += 1) {
            syscall("fs_delete", SELECTED[i], CUR_DIR == "/RecycleBin");
          }
          SELECTED = [];
          STATUS_MSG = CUR_DIR == "/RecycleBin" ? "已永久删除" : "已移入回收站";
          refresh();
        } else if (act == "restore_selected") {
          for (let i = 0; i < len(SELECTED); i += 1) {
            syscall("fs_restore", SELECTED[i]);
          }
          SELECTED = [];
          STATUS_MSG = "已从回收站恢复";
          refresh();
        } else if (act == "start_rename") {
          if (len(SELECTED) > 0) {
            RENAME_TARGET = SELECTED[0];
            RENAME_TEXT = base_name(RENAME_TARGET);
          }
        } else if (act == "rename_input") {
          RENAME_TEXT = ev.value != null ? ev.value : "";
        } else if (act == "rename_confirm") {
          if (RENAME_TARGET && len(RENAME_TEXT) > 0) {
            let rr = syscall("fs_rename", RENAME_TARGET, RENAME_TEXT);
            STATUS_MSG = rr.ok ? "已重命名" : rr.error;
            RENAME_TARGET = null;
            refresh();
          }
        } else if (act == "rename_cancel") {
          RENAME_TARGET = null;
        } else if (act == "toggle_sort") {
          if (SORT_BY == ch.by) SORT_DESC = !SORT_DESC;
          else { SORT_BY = ch.by; SORT_DESC = false; }
          refresh();
        } else if (act == "overwrite_yes") {
          if (OVERWRITE_PROMPT) {
            let wr = syscall("fs_write", OVERWRITE_PROMPT.targetPath, OVERWRITE_PROMPT.content);
            STATUS_MSG = wr.ok ? "已覆盖保存: " + OVERWRITE_PROMPT.name : wr.error;
            OVERWRITE_PROMPT = null;
            refresh();
          }
        } else if (act == "overwrite_no") {
          OVERWRITE_PROMPT = null;
          STATUS_MSG = "已取消覆盖";
        } else if (act == "snap_fork") {
          if (SNAP_MODAL) {
            let fr = syscall("host_snapshot_fork_file", SNAP_MODAL.path);
            STATUS_MSG = fr && fr.ok ? ("已从快照分叉新子树: " + fr.id) : (fr ? fr.error : "分叉失败");
            SNAP_MODAL = null;
          }
        } else if (act == "snap_close") {
          SNAP_MODAL = null;
        } else if (act == "host_export") {
          if (len(SELECTED) > 0) {
            let rd = syscall("fs_read", SELECTED[0]);
            if (rd.ok) syscall("host_export_dialog", base_name(SELECTED[0]), rd.content);
          }
        } else if (act == "host_import") {
          let imp = syscall("host_import_dialog");
          if (imp && !imp.canceled) {
            let dst = (CUR_DIR == "/" ? "" : CUR_DIR) + "/" + imp.name;
            let wr = syscall("fs_write", dst, imp.content);
            STATUS_MSG = wr.ok ? ("已导入本机文件: " + imp.name) : wr.error;
            refresh();
          }
        } else if (act == "refresh") {
          refresh();
        }
        submit_ui();
      }
    }
  } else {
    refresh();
    submit_ui();
  }
}
`;

export const EDITOR_NS_SOURCE = `// ============================================================================
// 子系统文本与程序编辑器 (/System/editor.ns)
// 支持打开、编辑、保存文本/程序/场景/内核文件，支持编译运行及自举编译器重建。
// ============================================================================

let WIN_ID = __args.winId;
let FILE_PATH = (__args.params && __args.params.filePath) ? __args.params.filePath : "/Demo/calc_loop.ns";
let CONTENT = "";
let DIRTY = false;
let STATUS_MSG = "已打开";
let RUN_PID = null;
let RUN_OUTPUT = "";
let COMPILE_ERR = null;

fn load_file(path) {
  let rd = syscall("fs_read", path);
  FILE_PATH = path;
  if (rd.ok) {
    CONTENT = rd.content;
    DIRTY = false;
    COMPILE_ERR = null;
    STATUS_MSG = "已加载 (" + to_str(len(CONTENT)) + " B)";
  } else {
    CONTENT = "";
    STATUS_MSG = "读取失败: " + rd.error;
  }
}

fn submit_ui() {
  let run_info = null;
  if (RUN_PID != null) {
    let ps = syscall("ps");
    for (let i = 0; i < len(ps); i += 1) {
      if (ps[i].pid == RUN_PID) {
        run_info = ps[i];
        break;
      }
    }
  }
  syscall("app_submit_ui", WIN_ID, {
    kind: "editor",
    filePath: FILE_PATH,
    content: CONTENT,
    dirty: DIRTY,
    statusMsg: STATUS_MSG,
    compileError: COMPILE_ERR,
    isCompilerFile: FILE_PATH == "/System/compiler.ns",
    runPid: RUN_PID,
    runInfo: run_info
  });
}

load_file(FILE_PATH);
submit_ui();

while (true) {
  let msg = syscall("recv_msg", 250);
  if (msg != null) {
    let d = msg.data;
    if (d.type == "open_path") {
      load_file(d.path);
      submit_ui();
    } else if (d.type == "ui_event") {
      let ev = d.event;
      let ch = ev.controlHint;
      if (ev.type == "input_text" || (ch && ch.action == "edit_text")) {
        if (ev.field == "filename" || (ch && ch.field == "filename")) {
          FILE_PATH = ev.value != null ? ev.value : FILE_PATH;
        } else {
          CONTENT = ev.value != null ? ev.value : CONTENT;
          DIRTY = true;
        }
        submit_ui();
      } else if (ch && ch.action) {
        let act = ch.action;
        if (act == "open_file_path") {
          load_file(FILE_PATH);
        } else if (act == "save") {
          let wr = syscall("fs_write", FILE_PATH, CONTENT);
          if (wr.ok) {
            DIRTY = false;
            COMPILE_ERR = null;
            STATUS_MSG = "已保存到 " + FILE_PATH;
          } else {
            STATUS_MSG = "保存失败: " + wr.error;
          }
        } else if (act == "run") {
          let wr = syscall("fs_write", FILE_PATH, CONTENT);
          if (!wr.ok) {
            STATUS_MSG = "保存失败: " + wr.error;
          } else {
            DIRTY = false;
            let sp = syscall("spawn", FILE_PATH, { fromEditor: true }, "user");
            if (sp.ok) {
              RUN_PID = sp.pid;
              COMPILE_ERR = null;
              STATUS_MSG = "已启动进程 PID " + to_str(sp.pid);
            } else {
              COMPILE_ERR = sp.error;
              STATUS_MSG = "编译/启动失败";
            }
          }
        } else if (act == "rebuild_compiler") {
          let wr = syscall("fs_write", "/System/compiler.ns", CONTENT);
          if (!wr.ok) {
            STATUS_MSG = "保存失败: " + wr.error;
          } else {
            DIRTY = false;
            let rb = syscall("rebuild_compiler");
            if (rb.ok) {
              COMPILE_ERR = null;
              STATUS_MSG = "编译器已成功重编自身 (" + rb.compilerId + ")";
            } else {
              COMPILE_ERR = rb ? rb.error : "编译失败";
              STATUS_MSG = "编译器自编译失败";
            }
          }
        } else if (act == "new_blank") {
          FILE_PATH = "/Documents/untitled.ns";
          CONTENT = "// 新建 NScript 程序\\nlet total = 0;\\nfor (let i = 1; i <= 10; i += 1) {\\n  total += i;\\n}\\nprint_log(\\"total =\\", total);\\n";
          DIRTY = true;
          COMPILE_ERR = null;
          STATUS_MSG = "新建缓冲区";
        }
        submit_ui();
      }
    }
  } else {
    submit_ui();
  }
}
`;

export const TASKS_NS_SOURCE = `// ============================================================================
// 子系统进程与系统管理器 (/System/tasks.ns)
// 显示总预算、实际拨付、内核/用户/承载消耗、剩余工作、内存与存储占用，
// 支持挂起/继续/结束进程，管理直属子系统的创建、暂停、单步、调速、重启、快照与分叉。
// ============================================================================

let WIN_ID = __args.winId;
let SYS_INFO = syscall("get_system_info");
let INPUT_BUDGET = to_str(SYS_INFO.totalBudget);
let INPUT_MEM = to_str(floor(SYS_INFO.memQuota / 1024));
let INPUT_STORAGE = to_str(floor(SYS_INFO.storageQuota / 1024));
let GRANT_INPUTS = {};
let STATUS_MSG = "就绪";

fn build_snap_path(cid) {
  let t = floor(syscall("time_now"));
  return "/Documents/" + cid + "_snap_" + to_str(t) + ".snap";
}

fn submit_ui() {
  SYS_INFO = syscall("get_system_info");
  let procs = syscall("ps");
  let tree = syscall("sys_get_tree");
  let children = [];
  for (let i = 0; i < len(tree); i += 1) {
    if (tree[i].parentId == SYS_INFO.id) {
      push(children, tree[i]);
      if (!has_key(GRANT_INPUTS, tree[i].id)) {
        GRANT_INPUTS[tree[i].id] = to_str(tree[i].grantCap || 20000);
      }
    }
  }
  syscall("app_submit_ui", WIN_ID, {
    kind: "tasks",
    sysInfo: SYS_INFO,
    procs: procs,
    children: children,
    inputBudget: INPUT_BUDGET,
    inputMemKB: INPUT_MEM,
    inputStorageKB: INPUT_STORAGE,
    grantInputs: GRANT_INPUTS,
    statusMsg: STATUS_MSG
  });
}

submit_ui();

while (true) {
  let msg = syscall("recv_msg", 200);
  if (msg != null && msg.data.type == "ui_event") {
    let ev = msg.data.event;
    let ch = ev.controlHint;
    if (ch && ch.action) {
      let act = ch.action;
      if (act == "input_budget") INPUT_BUDGET = ev.value;
      else if (act == "input_mem") INPUT_MEM = ev.value;
      else if (act == "input_storage") INPUT_STORAGE = ev.value;
      else if (act == "input_grant") GRANT_INPUTS[ch.targetId] = ev.value;
      else if (act == "apply_quotas") {
        let nb = to_num(INPUT_BUDGET);
        let nm = to_num(INPUT_MEM) * 1024;
        let ns = to_num(INPUT_STORAGE) * 1024;
        syscall("sys_set_quotas", { totalBudget: nb, memQuota: nm, storageQuota: ns });
        STATUS_MSG = "已更新本系统预算与配额";
      } else if (act == "apply_grant") {
        let cid = ch.targetId;
        let g = to_num(GRANT_INPUTS[cid]);
        syscall("sys_child_op", cid, "set_grant", g);
        STATUS_MSG = "已设置 " + cid + " 拨付上限为 " + to_str(g);
      } else if (act == "proc_suspend") {
        syscall("suspend", ch.pid);
      } else if (act == "proc_resume") {
        syscall("resume", ch.pid);
      } else if (act == "proc_kill") {
        syscall("kill", ch.pid);
      } else if (act == "sys_new") {
        let cr = syscall("sys_create_child", null);
        STATUS_MSG = cr.ok ? ("已创建子系统 " + cr.id) : ("创建失败: " + cr.error);
      } else if (act == "sys_pause") {
        syscall("sys_child_op", ch.targetId, "pause", null);
        STATUS_MSG = "已暂停子树 " + ch.targetId;
      } else if (act == "sys_resume") {
        syscall("sys_child_op", ch.targetId, "resume", null);
        STATUS_MSG = "已继续子树 " + ch.targetId;
      } else if (act == "sys_step") {
        let sr = syscall("sys_child_op", ch.targetId, "step", 50);
        STATUS_MSG = sr.ok ? ("已单步推进 " + ch.targetId + " (50ms)") : sr.error;
      } else if (act == "sys_speed") {
        syscall("sys_child_op", ch.targetId, "set_speed", to_num(ev.value != null ? ev.value : ch.value));
      } else if (act == "sys_restart") {
        let rr = syscall("sys_child_op", ch.targetId, "restart", null);
        STATUS_MSG = rr.ok ? ("已重启 " + ch.targetId) : ("重启失败: " + rr.error);
      } else if (act == "kernel_open") {
        let kp = "/Systems/" + ch.targetId + "/kernel.ns";
        syscall("app_send_wm", { type: "open_editor_path", path: kp });
      } else if (act == "sys_snapshot") {
        let spath = build_snap_path(ch.targetId);
        let sr = syscall("host_snapshot_create", ch.targetId, spath);
        STATUS_MSG = sr && sr.ok ? ("快照已保存: " + spath) : (sr ? sr.error : "快照失败");
      } else if (act == "sys_restore_latest") {
        let rr = syscall("host_snapshot_restore_latest", ch.targetId);
        STATUS_MSG = rr && rr.ok ? ("已从快照恢复 " + ch.targetId) : (rr ? rr.error : "恢复失败");
      } else if (act == "sys_fork_latest") {
        let fr = syscall("host_snapshot_fork_latest", ch.targetId);
        STATUS_MSG = fr && fr.ok ? ("已分叉新子树 " + fr.id) : (fr ? fr.error : "分叉失败");
      }
      submit_ui();
    }
  } else {
    submit_ui();
  }
}
`;
