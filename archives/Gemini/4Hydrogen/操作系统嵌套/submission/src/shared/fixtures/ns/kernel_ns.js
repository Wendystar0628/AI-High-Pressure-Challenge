// Subsystem Kernel Program (/System/kernel.ns & /Systems/<id>/kernel.ns)
// Written in NScript: runs inside the carrier process under parent scheduling.
// Manages Process Table, Preemptive Scheduler, IPC Messages, VFS, Quotas, Syscalls, and Child Carriers.

export const KERNEL_NS_SOURCE = `// ============================================================================
// 叠境操作系统 · 子系统微内核 (/System/kernel.ns)
// 说明：本内核是存放在父系统文件系统中的普通 NScript 程序。
// 在父系统编辑器中修改并保存本文件，然后重启对应子系统即可按新规则运行。
// ============================================================================

let SYS = {
  id: __sys_id,
  name: __sys_name,
  parentId: __parent_id,
  depth: __depth,
  virtualTime: 0,
  timeRate: 1.0,
  totalBudget: __total_budget,
  memQuota: __mem_quota,
  storageQuota: __storage_quota,
  compilerId: __compiler_id,
  compilerSeq: 1
};

// 初始化虚拟文件系统 (VFS)
let VFS = {};
let STORAGE_USED = 0;

fn vfs_norm(p) {
  if (type_of(p) != "string" || len(p) == 0) return "/";
  let parts = split(p, "/");
  let stack = [];
  for (let i = 0; i < len(parts); i += 1) {
    let seg = parts[i];
    if (seg == "" || seg == ".") continue;
    if (seg == "..") {
      if (len(stack) > 0) pop(stack);
    } else {
      push(stack, seg);
    }
  }
  if (len(stack) == 0) return "/";
  return "/" + join(stack, "/");
}

fn vfs_parent(p) {
  let np = vfs_norm(p);
  if (np == "/") return "/";
  let parts = split(np, "/");
  pop(parts);
  if (len(parts) <= 1) return "/";
  return join(parts, "/");
}

fn vfs_base(p) {
  let np = vfs_norm(p);
  if (np == "/") return "/";
  let parts = split(np, "/");
  return parts[len(parts) - 1];
}

fn vfs_recalc_storage() {
  let total = 0;
  let ks = keys(VFS);
  for (let i = 0; i < len(ks); i += 1) {
    let node = VFS[ks[i]];
    if (node.type == "file") total += node.size;
  }
  STORAGE_USED = total;
}

fn vfs_ensure_dirs(dir_path) {
  let np = vfs_norm(dir_path);
  if (np == "/") return;
  let parts = split(np, "/");
  let cur = "";
  for (let i = 1; i < len(parts); i += 1) {
    cur += "/" + parts[i];
    if (!has_key(VFS, cur)) {
      VFS[cur] = { type: "dir", mtime: SYS.virtualTime, size: 0 };
    }
  }
}

fn vfs_init() {
  VFS["/"] = { type: "dir", mtime: 0, size: 0 };
  if (__seed_vfs) {
    let ks = keys(__seed_vfs);
    for (let i = 0; i < len(ks); i += 1) {
      let p = vfs_norm(ks[i]);
      let item = __seed_vfs[ks[i]];
      if (item.type == "dir") {
        vfs_ensure_dirs(p);
      } else {
        vfs_ensure_dirs(vfs_parent(p));
        let c = item.content;
        if (c == null) c = "";
        VFS[p] = { type: "file", content: c, size: len(c), mtime: 0 };
      }
    }
  }
  vfs_ensure_dirs("/RecycleBin");
  vfs_ensure_dirs("/Documents");
  vfs_ensure_dirs("/Demo");
  vfs_ensure_dirs("/System");
  vfs_ensure_dirs("/Systems");
  vfs_recalc_storage();
}

// 文件系统操作函数 (可被改写以改变文件列表或读写行为)
fn vfs_list(dir_path) {
  let np = vfs_norm(dir_path);
  if (!has_key(VFS, np) || VFS[np].type != "dir") return [];
  let res = [];
  let ks = keys(VFS);
  for (let i = 0; i < len(ks); i += 1) {
    let k = ks[i];
    if (k == "/") continue;
    if (vfs_parent(k) == np) {
      let node = VFS[k];
      push(res, {
        name: vfs_base(k),
        path: k,
        type: node.type,
        size: node.size,
        mtime: node.mtime,
        origPath: node.origPath
      });
    }
  }
  return res;
}

fn vfs_read(file_path) {
  let np = vfs_norm(file_path);
  if (!has_key(VFS, np)) return { ok: false, error: "文件不存在: " + np };
  let node = VFS[np];
  if (node.type != "file") return { ok: false, error: "目标不是文件: " + np };
  return { ok: true, content: node.content, size: node.size, mtime: node.mtime };
}

fn vfs_write(file_path, content) {
  let np = vfs_norm(file_path);
  let text = to_str(content);
  if (type_of(content) == "string") text = content;
  let new_size = len(text);
  let old_size = 0;
  if (has_key(VFS, np) && VFS[np].type == "file") {
    old_size = VFS[np].size;
  }
  let delta = new_size - old_size;
  if (STORAGE_USED + delta > SYS.storageQuota) {
    return {
      ok: false,
      error: "存储配额不足 (需要 " + to_str(STORAGE_USED + delta) + " / 上限 " + to_str(SYS.storageQuota) + " B)"
    };
  }
  vfs_ensure_dirs(vfs_parent(np));
  VFS[np] = { type: "file", content: text, size: new_size, mtime: SYS.virtualTime };
  STORAGE_USED += delta;
  return { ok: true, path: np, size: new_size };
}

fn vfs_mkdir(dir_path) {
  let np = vfs_norm(dir_path);
  if (has_key(VFS, np)) return { ok: false, error: "路径已存在" };
  vfs_ensure_dirs(np);
  return { ok: true, path: np };
}

fn vfs_delete(target_path, permanent) {
  let np = vfs_norm(target_path);
  if (np == "/" || !has_key(VFS, np)) return { ok: false, error: "路径不存在" };
  let node = VFS[np];
  if (permanent || index_of(np, "/RecycleBin/") == 0 || np == "/RecycleBin") {
    // 永久删除及其子节点
    let ks = keys(VFS);
    let prefix = np + "/";
    for (let i = 0; i < len(ks); i += 1) {
      let k = ks[i];
      if (k == np || index_of(k, prefix) == 0) {
        if (VFS[k].type == "file") STORAGE_USED -= VFS[k].size;
        del_key(VFS, k);
      }
    }
    return { ok: true };
  }
  // 移入回收站
  let bname = vfs_base(np);
  let trash_p = "/RecycleBin/" + bname;
  let seq = 1;
  while (has_key(VFS, trash_p)) {
    trash_p = "/RecycleBin/" + bname + "_" + to_str(seq);
    seq += 1;
  }
  if (node.type == "file") {
    VFS[trash_p] = {
      type: "file",
      content: node.content,
      size: node.size,
      mtime: SYS.virtualTime,
      origPath: np
    };
    del_key(VFS, np);
  } else {
    let ks = keys(VFS);
    let prefix = np + "/";
    VFS[trash_p] = { type: "dir", mtime: SYS.virtualTime, size: 0, origPath: np };
    for (let i = 0; i < len(ks); i += 1) {
      let k = ks[i];
      if (index_of(k, prefix) == 0) {
        let rel = substr(k, len(np), len(k) - len(np));
        let nd = VFS[k];
        VFS[trash_p + rel] = clone(nd);
        del_key(VFS, k);
      }
    }
    del_key(VFS, np);
  }
  return { ok: true, trashPath: trash_p };
}

fn vfs_restore(trash_path) {
  let tp = vfs_norm(trash_path);
  if (!has_key(VFS, tp)) return { ok: false, error: "回收站记录不存在" };
  let node = VFS[tp];
  let dst = node.origPath;
  if (!dst) dst = "/Documents/" + vfs_base(tp);
  if (has_key(VFS, dst)) {
    dst = dst + ".restored";
  }
  vfs_ensure_dirs(vfs_parent(dst));
  if (node.type == "file") {
    VFS[dst] = { type: "file", content: node.content, size: node.size, mtime: SYS.virtualTime };
    del_key(VFS, tp);
  } else {
    let ks = keys(VFS);
    let prefix = tp + "/";
    VFS[dst] = { type: "dir", mtime: SYS.virtualTime, size: 0 };
    for (let i = 0; i < len(ks); i += 1) {
      let k = ks[i];
      if (index_of(k, prefix) == 0) {
        let rel = substr(k, len(tp), len(k) - len(tp));
        VFS[dst + rel] = clone(VFS[k]);
        del_key(VFS, k);
      }
    }
    del_key(VFS, tp);
  }
  return { ok: true, path: dst };
}

fn vfs_rename(old_path, new_name) {
  let op = vfs_norm(old_path);
  if (!has_key(VFS, op) || op == "/") return { ok: false, error: "源路径不存在" };
  let np = vfs_norm(vfs_parent(op) + "/" + new_name);
  if (has_key(VFS, np)) return { ok: false, error: "目标名称已存在" };
  let node = VFS[op];
  if (node.type == "file") {
    VFS[np] = node;
    del_key(VFS, op);
  } else {
    let ks = keys(VFS);
    let prefix = op + "/";
    VFS[np] = node;
    for (let i = 0; i < len(ks); i += 1) {
      let k = ks[i];
      if (index_of(k, prefix) == 0) {
        let rel = substr(k, len(op), len(k) - len(op));
        VFS[np + rel] = VFS[k];
        del_key(VFS, k);
      }
    }
    del_key(VFS, op);
  }
  return { ok: true, path: np };
}

fn vfs_copy(src_path, dst_path) {
  let sp = vfs_norm(src_path);
  let dp = vfs_norm(dst_path);
  if (!has_key(VFS, sp)) return { ok: false, error: "源文件不存在" };
  let node = VFS[sp];
  if (node.type == "file") {
    return vfs_write(dp, node.content);
  }
  // 递归拷贝目录
  let needed = 0;
  let ks = keys(VFS);
  let prefix = sp + "/";
  for (let i = 0; i < len(ks); i += 1) {
    let k = ks[i];
    if (index_of(k, prefix) == 0 && VFS[k].type == "file") {
      needed += VFS[k].size;
    }
  }
  if (STORAGE_USED + needed > SYS.storageQuota) {
    return { ok: false, error: "存储配额不足" };
  }
  vfs_ensure_dirs(dp);
  for (let i = 0; i < len(ks); i += 1) {
    let k = ks[i];
    if (index_of(k, prefix) == 0) {
      let rel = substr(k, len(sp), len(k) - len(sp));
      if (VFS[k].type == "dir") vfs_ensure_dirs(dp + rel);
      else vfs_write(dp + rel, VFS[k].content);
    }
  }
  return { ok: true, path: dp };
}

// ============================================================================
// 进程表与调度器
// ============================================================================
let PROCS = [];
let NEXT_PID = 2; // PID 1 是本内核自身
let LAST_SCHED_IDX = -1;
let WM_PID = -1;
let MSG_SEQ = 1;
let KERNEL_COST_TOTAL = 0;
let USER_COST_TOTAL = 0;
let TICK_REMAINING = 0;
let EFFECTIVE_GRANT = 0;
let ACTIVE_COMPILER_BC = null;
let COMPILER_CACHE = {}; // path -> { srcHash, compilerId, bc }
let FLIGHT_BUS = {}; // playerId -> { sensors, ctrlLog, latestCtrl }
let CHILDREN = {}; // childSysId -> { id, name, carrierPid, grantCap, paused, timeRate, state, kernelPath, kernelError, kernelCost, internalCost }
let PENDING_CROSS_INPUTS = {}; // winId -> [ev...]

// 调度策略函数：在就绪进程中选择下一个运行者
// 修改本函数并重启子系统即可彻底改变调度策略！
fn pick_next_process(procs, last_idx) {
  let n = len(procs);
  if (n == 0) return -1;
  let best_idx = -1;
  let best_prio = -999;
  for (let step = 1; step <= n; step += 1) {
    let idx = (last_idx + step) % n;
    let p = procs[idx];
    if (p.state == "ready" || p.state == "pending_op") {
      if (p.priority > best_prio) {
        best_prio = p.priority;
        best_idx = idx;
      }
    }
  }
  return best_idx;
}

fn find_proc(pid) {
  for (let i = 0; i < len(PROCS); i += 1) {
    if (PROCS[i].pid == pid) return PROCS[i];
  }
  return null;
}

fn total_mem_used() {
  let total = 4096 + STORAGE_USED;
  for (let i = 0; i < len(PROCS); i += 1) {
    total += PROCS[i].memBytes;
  }
  return total;
}

fn ensure_compiler_loaded() {
  if (ACTIVE_COMPILER_BC != null) return true;
  // 优先尝试加载 VFS 中的 /System/compiler.bc
  if (has_key(VFS, "/System/compiler.bc")) {
    let parsed = json_parse(VFS["/System/compiler.bc"].content);
    if (parsed && parsed.magic == "NSBC") {
      ACTIVE_COMPILER_BC = parsed;
      return true;
    }
  }
  // 回退使用引导编译器字节码
  if (__seed_compiler_bc) {
    ACTIVE_COMPILER_BC = __seed_compiler_bc;
    vfs_write("/System/compiler.bc", json_stringify(ACTIVE_COMPILER_BC));
    return true;
  }
  return false;
}

fn compile_with_system_compiler(src) {
  ensure_compiler_loaded();
  let cid = SYS.compilerId + "-" + to_str(SYS.compilerSeq);
  let res = syscall("host_run_compiler_vm", ACTIVE_COMPILER_BC, src, cid, SYS.memQuota - total_mem_used());
  return res;
}

fn compile_program_file(path) {
  let np = vfs_norm(path);
  let rd = vfs_read(np);
  if (!rd.ok) return rd;
  let src = rd.content;
  let h = str_hash(src);
  let cid = SYS.compilerId + "-" + to_str(SYS.compilerSeq);
  // 若源码哈希和编译器代数均未变，可使用对应 .bc 缓存加速
  let bc_path = "";
  if (len(np) > 3 && substr(np, len(np) - 3, 3) == ".ns") {
    bc_path = substr(np, 0, len(np) - 3) + ".bc";
  }
  if (has_key(COMPILER_CACHE, np)) {
    let ce = COMPILER_CACHE[np];
    if (ce.srcHash == h && ce.compilerId == cid) {
      return { ok: true, bytecode: ce.bc, cost: 20 };
    }
  }
  if (bc_path != "" && has_key(VFS, bc_path)) {
    let cached = json_parse(VFS[bc_path].content);
    if (cached && cached.magic == "NSBC" && cached.srcHash == h && cached.compilerId == cid) {
      COMPILER_CACHE[np] = { srcHash: h, compilerId: cid, bc: cached };
      return { ok: true, bytecode: cached, cost: 40 };
    }
  }
  let cres = compile_with_system_compiler(src);
  if (cres && cres.ok) {
    COMPILER_CACHE[np] = { srcHash: h, compilerId: cid, bc: cres.bytecode };
    if (bc_path != "") {
      vfs_write(bc_path, json_stringify(cres.bytecode));
    }
  }
  return cres;
}

fn spawn_process(path, args, parent_pid, ptype) {
  let np = vfs_norm(path);
  let comp = compile_program_file(np);
  if (!comp || !comp.ok) {
    return { ok: false, error: comp ? comp.error : "编译失败" };
  }
  let mem_est = 2048 + len(json_stringify(comp.bytecode));
  if (total_mem_used() + mem_est > SYS.memQuota) {
    return { ok: false, error: "内存配额不足，无法启动进程 " + np };
  }
  let pid = NEXT_PID;
  NEXT_PID += 1;
  let globals = { __args: args, __pid: pid, __sys_id: SYS.id };
  let vm_id = syscall("host_vm_create", comp.bytecode, globals, pid * 2654435761);
  let proc = {
    pid: pid,
    name: vfs_base(np),
    path: np,
    parentPid: parent_pid,
    type: ptype || "user",
    state: "ready",
    savedState: null,
    waitType: null,
    waitUntil: 0,
    priority: 1,
    quantum: 3500,
    budgetLimit: 1000000,
    tickBudgetUsed: 0,
    budgetUsed: comp.cost || 100,
    memBytes: mem_est,
    remainingWork: 0,
    pendingOp: null,
    pendingReply: false,
    inbox: [],
    vmId: vm_id,
    childSystemId: null,
    error: null,
    stdout: [],
    createdAt: SYS.virtualTime
  };
  push(PROCS, proc);
  return { ok: true, pid: pid, proc: proc };
}

fn kill_process(target_pid) {
  if (target_pid == 1) return false;
  let p = find_proc(target_pid);
  if (!p || p.state == "exited") return false;
  p.state = "exited";
  p.waitType = null;
  p.pendingOp = null;
  p.remainingWork = 0;
  p.inbox = [];
  if (p.vmId != null) {
    syscall("host_vm_destroy", p.vmId);
  }
  if (p.type == "carrier" && p.childSystemId != null) {
    if (has_key(CHILDREN, p.childSystemId)) {
      CHILDREN[p.childSystemId].state = "stopped";
      syscall("host_child_stopped", p.childSystemId);
    }
  }
  if (p.pid == WM_PID) WM_PID = -1;
  return true;
}

// ============================================================================
// IPC 消息规则 (可改写以测试消息顺序/过滤/投递规则修改)
// ============================================================================
fn ipc_send(sender_pid, target_pid, payload) {
  let target = find_proc(target_pid);
  if (!target || target.state == "exited" || target.state == "error") {
    return { ok: false, error: "目标进程不存在或已结束" };
  }
  let cloned = clone(payload);
  let msg_bytes = 64 + len(json_stringify(cloned));
  if (total_mem_used() + msg_bytes > SYS.memQuota) {
    return { ok: false, error: "内存配额不足，消息发送失败" };
  }
  let seq = MSG_SEQ;
  MSG_SEQ += 1;
  let msg = {
    from: sender_pid,
    seq: seq,
    timestamp: SYS.virtualTime,
    data: cloned
  };
  push(target.inbox, msg);
  target.memBytes += msg_bytes;
  if (target.state == "waiting" && target.waitType == "msg") {
    target.state = "ready";
    target.waitType = null;
    if (target.pendingReply) {
      target.pendingReply = false;
      let popped = shift(target.inbox);
      syscall("host_vm_resume", target.vmId, popped);
    }
  }
  return { ok: true, seq: seq };
}

// ============================================================================
// 系统调用分发 (在此新增 case / if 分支即可扩展系统调用)
// ============================================================================
fn begin_pending_op(p, op_name, args, work_cost) {
  if (work_cost <= 1 || work_cost <= TICK_REMAINING) {
    if (work_cost > 0) {
      TICK_REMAINING -= work_cost;
      p.budgetUsed += work_cost;
      USER_COST_TOTAL += work_cost;
    }
    return true;
  }
  let pay = TICK_REMAINING;
  TICK_REMAINING = 0;
  p.budgetUsed += pay;
  USER_COST_TOTAL += pay;
  p.pendingOp = { name: op_name, args: args, done: pay, total: work_cost };
  p.remainingWork = work_cost - pay;
  p.state = "pending_op";
  return false;
}

fn execute_syscall_now(p, name, args) {
  // --- 扩展系统调用示例 (按题面可自定义新增) ---
  if (name == "sys_ping") {
    return { ok: true, pong: args[0], sys: SYS.id, time: SYS.virtualTime };
  }

  // --- 时间与进程控制 ---
  if (name == "time_now") return SYS.virtualTime;
  if (name == "get_pid") return p.pid;
  if (name == "get_system_info") {
    return {
      id: SYS.id,
      name: SYS.name,
      parentId: SYS.parentId,
      depth: SYS.depth,
      virtualTime: SYS.virtualTime,
      timeRate: SYS.timeRate,
      totalBudget: SYS.totalBudget,
      effectiveGrant: EFFECTIVE_GRANT,
      remainingBudget: TICK_REMAINING,
      memQuota: SYS.memQuota,
      memUsed: total_mem_used(),
      storageQuota: SYS.storageQuota,
      storageUsed: STORAGE_USED,
      kernelCost: KERNEL_COST_TOTAL,
      userCost: USER_COST_TOTAL,
      compilerId: SYS.compilerId + "-" + to_str(SYS.compilerSeq),
      telemetry: {
        lastGrant: EFFECTIVE_GRANT,
        kernelSteps: LAST_TICK_KERNEL_STEPS,
        userSteps: LAST_TICK_USER_STEPS,
        carrierSteps: LAST_TICK_CARRIER_STEPS,
        remainingWork: LAST_TICK_REMAINING_WORK
      }
    };
  }
  if (name == "sleep") {
    let ms = to_num(args[0]);
    if (ms <= 0) return true;
    p.state = "waiting";
    p.waitType = "time";
    p.waitUntil = SYS.virtualTime + ms;
    p.pendingReply = true;
    return null;
  }
  if (name == "yield") {
    return true;
  }
  if (name == "spawn") {
    return spawn_process(args[0], args[1], p.pid, args[2] || "user");
  }
  if (name == "kill") {
    return kill_process(to_num(args[0]));
  }
  if (name == "suspend") {
    let tp = find_proc(to_num(args[0]));
    if (!tp || tp.pid == 1 || tp.state == "exited") return false;
    if (tp.state != "suspended") {
      tp.savedState = tp.state;
      tp.state = "suspended";
    }
    return true;
  }
  if (name == "resume") {
    let tp = find_proc(to_num(args[0]));
    if (!tp || tp.state != "suspended") return false;
    tp.state = tp.savedState || "ready";
    tp.savedState = null;
    if (tp.state == "waiting" && tp.waitType == "msg" && len(tp.inbox) > 0) {
      tp.state = "ready";
      tp.waitType = null;
      if (tp.pendingReply) {
        tp.pendingReply = false;
        let popped = shift(tp.inbox);
        syscall("host_vm_resume", tp.vmId, popped);
      }
    } else if (tp.state == "waiting" && tp.waitType == "time" && SYS.virtualTime >= tp.waitUntil) {
      tp.state = "ready";
      tp.waitType = null;
      if (tp.pendingReply) {
        tp.pendingReply = false;
        syscall("host_vm_resume", tp.vmId, true);
      }
    }
    return true;
  }
  if (name == "exit") {
    kill_process(p.pid);
    return null;
  }
  if (name == "ps") {
    let list = [];
    push(list, {
      pid: 1,
      name: "kernel.ns",
      path: "/System/kernel.ns",
      parentPid: 0,
      type: "kernel",
      state: "running",
      priority: 99,
      budgetUsed: KERNEL_COST_TOTAL,
      remainingWork: 0,
      memBytes: 4096,
      error: null
    });
    for (let i = 0; i < len(PROCS); i += 1) {
      let pr = PROCS[i];
      let c_k = 0;
      let c_i = 0;
      if (pr.type == "carrier" && pr.childSystemId && has_key(CHILDREN, pr.childSystemId)) {
        c_k = CHILDREN[pr.childSystemId].kernelCost;
        c_i = CHILDREN[pr.childSystemId].internalCost;
      }
      push(list, {
        pid: pr.pid,
        name: pr.name,
        path: pr.path,
        parentPid: pr.parentPid,
        type: pr.type,
        state: pr.state,
        waitType: pr.waitType,
        priority: pr.priority,
        budgetUsed: pr.budgetUsed,
        stepsThisTick: pr.tickBudgetUsed > 0 ? pr.tickBudgetUsed : (pr.lastTickSteps || 0),
        remainingWork: pr.remainingWork,
        memBytes: pr.memBytes,
        inboxCount: len(pr.inbox),
        error: pr.error,
        childSystemId: pr.childSystemId,
        childKernelCost: c_k,
        childInternalCost: c_i,
        stdout: syscall("host_vm_stdout", pr.vmId)
      });
    }
    return list;
  }

  // --- IPC 消息通信 ---
  if (name == "send_msg") {
    return ipc_send(p.pid, to_num(args[0]), args[1]);
  }
  if (name == "recv_msg") {
    if (len(p.inbox) > 0) {
      let m = shift(p.inbox);
      return m;
    }
    let timeout = args[0];
    if (timeout == 0) return null;
    p.state = "waiting";
    p.waitType = "msg";
    p.waitUntil = timeout > 0 ? (SYS.virtualTime + timeout) : -1;
    p.pendingReply = true;
    return null;
  }
  if (name == "peek_msg") {
    return len(p.inbox);
  }

  // --- 文件系统操作 ---
  if (name == "fs_list") return vfs_list(args[0] || "/");
  if (name == "fs_read") return vfs_read(args[0]);
  if (name == "fs_write") return vfs_write(args[0], args[1]);
  if (name == "fs_mkdir") return vfs_mkdir(args[0]);
  if (name == "fs_delete") return vfs_delete(args[0], args[1]);
  if (name == "fs_restore") return vfs_restore(args[0]);
  if (name == "fs_rename") return vfs_rename(args[0], args[1]);
  if (name == "fs_copy") return vfs_copy(args[0], args[1]);
  if (name == "fs_stat") {
    let np = vfs_norm(args[0]);
    if (!has_key(VFS, np)) return null;
    return { path: np, type: VFS[np].type, size: VFS[np].size, mtime: VFS[np].mtime };
  }

  // --- 窗口管理与显示设备 ---
  if (name == "wm_register") {
    WM_PID = p.pid;
    return true;
  }
  if (name == "wm_submit_desktop") {
    syscall("host_submit_desktop", args[0]);
    return true;
  }
  if (name == "app_submit_ui") {
    // 应用提交 UI 到窗口管理器及跨层投送注册表
    if (WM_PID > 0 && WM_PID != p.pid) {
      ipc_send(p.pid, WM_PID, { type: "app_ui", winId: args[0], ui: args[1] });
    }
    syscall("host_publish_app_ui", args[0], args[1]);
    return true;
  }
  if (name == "app_send_wm") {
    if (WM_PID > 0) {
      return ipc_send(p.pid, WM_PID, args[0]);
    }
    return { ok: false, error: "无窗口管理器" };
  }

  // --- 三维显示与飞控总线 ---
  if (name == "display_3d_load") {
    let pid3d = args[0];
    let scene_res = args[1];
    let bytes = 8192 + len(json_stringify(scene_res));
    if (total_mem_used() + bytes > SYS.memQuota) {
      return { ok: false, error: "显存/内存配额不足，无法载入三维场景" };
    }
    p.memBytes += bytes;
    syscall("host_3d_load", pid3d, scene_res);
    return { ok: true, memBytes: bytes };
  }
  if (name == "display_3d_frame") {
    syscall("host_3d_frame", args[0], args[1]);
    return true;
  }
  if (name == "display_3d_fx") {
    syscall("host_3d_fx", args[0], args[1]);
    return true;
  }
  if (name == "display_3d_raycast") {
    return syscall("host_3d_raycast", args[0], args[1], args[2], args[3], args[4]);
  }
  if (name == "heli_publish_sensors") {
    let pl_id = args[0];
    if (!has_key(FLIGHT_BUS, pl_id)) {
      FLIGHT_BUS[pl_id] = { sensors: null, latestCtrl: { collective: 0, pitch: 0, roll: 0, yaw: 0, t: 0 }, ctrlLog: [] };
    }
    FLIGHT_BUS[pl_id].sensors = args[1];
    return true;
  }
  if (name == "heli_read_sensors") {
    let pl_id = args[0];
    if (!has_key(FLIGHT_BUS, pl_id)) return null;
    return clone(FLIGHT_BUS[pl_id].sensors);
  }
  if (name == "heli_write_controls") {
    let pl_id = args[0];
    let ctrl = clone(args[1]);
    ctrl.t = SYS.virtualTime;
    if (!has_key(FLIGHT_BUS, pl_id)) {
      FLIGHT_BUS[pl_id] = { sensors: null, latestCtrl: ctrl, ctrlLog: [] };
    }
    FLIGHT_BUS[pl_id].latestCtrl = ctrl;
    push(FLIGHT_BUS[pl_id].ctrlLog, ctrl);
    if (len(FLIGHT_BUS[pl_id].ctrlLog) > 240) shift(FLIGHT_BUS[pl_id].ctrlLog);
    return true;
  }
  if (name == "heli_read_controls") {
    let pl_id = args[0];
    let at_t = args[1];
    if (!has_key(FLIGHT_BUS, pl_id)) {
      return { collective: 0, pitch: 0, roll: 0, yaw: 0, t: 0 };
    }
    let bus = FLIGHT_BUS[pl_id];
    if (at_t == null) return clone(bus.latestCtrl);
    // 查找在 at_t 时刻生效的最新控制量
    let chosen = bus.latestCtrl;
    let log = bus.ctrlLog;
    for (let i = len(log) - 1; i >= 0; i -= 1) {
      if (log[i].t <= at_t + 0.0001) {
        chosen = log[i];
        break;
      }
    }
    return clone(chosen);
  }

  // --- 编译器与自编译 ---
  if (name == "compile_source") {
    return compile_with_system_compiler(args[0]);
  }
  if (name == "rebuild_compiler") {
    let rd = vfs_read("/System/compiler.ns");
    if (!rd.ok) return rd;
    let cres = compile_with_system_compiler(rd.content);
    if (!cres || !cres.ok) return cres;
    SYS.compilerSeq += 1;
    cres.bytecode.compilerId = SYS.compilerId + "-" + to_str(SYS.compilerSeq);
    ACTIVE_COMPILER_BC = cres.bytecode;
    COMPILER_CACHE = {};
    vfs_write("/System/compiler.bc", json_stringify(ACTIVE_COMPILER_BC));
    return { ok: true, compilerId: cres.bytecode.compilerId };
  }

  // --- 跨层实时数据连接与窗口投送 ---
  if (name == "chart_list_sources") return syscall("host_chart_list_sources");
  if (name == "chart_subscribe") return syscall("host_chart_subscribe", args[0], args[1]);
  if (name == "chart_poll") return syscall("host_chart_poll", args[0]);
  if (name == "chart_unsubscribe") return syscall("host_chart_unsubscribe", args[0]);
  if (name == "project_window") return syscall("host_project_window", args[0], args[1], args[2]);
  if (name == "sys_poll_cross_inputs") {
    let wid = args[0];
    if (!has_key(PENDING_CROSS_INPUTS, wid)) return [];
    let evs = PENDING_CROSS_INPUTS[wid];
    PENDING_CROSS_INPUTS[wid] = [];
    return evs;
  }

  // --- 直属子系统管理 ---
  if (name == "sys_get_tree") return syscall("host_get_sys_tree");
  if (name == "sys_create_child") return create_child_subsystem(args[0]);
  if (name == "sys_child_op") return handle_child_op(args[0], args[1], args[2]);
  if (name == "sys_forward_input") {
    syscall("host_forward_child_input", args[0], args[1]);
    return true;
  }
  if (name == "sys_set_quotas") {
    let cfg = args[0];
    if (cfg.totalBudget != null && cfg.totalBudget >= 500) SYS.totalBudget = to_num(cfg.totalBudget);
    if (cfg.memQuota != null && cfg.memQuota >= 65536) SYS.memQuota = to_num(cfg.memQuota);
    if (cfg.storageQuota != null && cfg.storageQuota >= 65536) SYS.storageQuota = to_num(cfg.storageQuota);
    syscall("host_update_self_quotas", { totalBudget: SYS.totalBudget, memQuota: SYS.memQuota, storageQuota: SYS.storageQuota });
    return { ok: true };
  }

  // --- 子系统承载内核转发接口 ---
  if (name == "host_next_tick") {
    if (p.type == "carrier") {
      p.state = "waiting";
      p.waitType = "next_tick";
      p.pendingReply = true;
      return null;
    }
    return null;
  }
  if (name == "host_child_telemetry") {
    if (p.type == "carrier" && p.childSystemId && has_key(CHILDREN, p.childSystemId)) {
      let c = CHILDREN[p.childSystemId];
      c.kernelCost = args[0].kernelCost;
      c.internalCost = args[0].userCost + args[0].childrenCost;
    }
    syscall("host_relay_child_telemetry", p.childSystemId, args[0]);
    return true;
  }

  return syscall("host_passthrough", p.childSystemId, name, args);
}

fn calc_syscall_work(name, args) {
  if (name == "fs_read" || name == "fs_write") {
    let sz = 0;
    if (name == "fs_write") sz = len(to_str(args[1]));
    else {
      let st = has_key(VFS, vfs_norm(args[0])) ? VFS[vfs_norm(args[0])].size : 0;
      sz = st;
    }
    return 1 + floor(sz / 32);
  }
  if (name == "fs_copy") {
    let st = has_key(VFS, vfs_norm(args[0])) ? VFS[vfs_norm(args[0])].size : 64;
    return 2 + floor(st / 24);
  }
  if (name == "send_msg") {
    return 2 + floor(len(json_stringify(args[1])) / 48);
  }
  if (name == "display_3d_load") {
    return 10 + floor(len(json_stringify(args[1])) / 64);
  }
  if (name == "display_3d_frame" || name == "display_3d_fx") {
    return 8;
  }
  if (name == "compile_source" || name == "rebuild_compiler") {
    return 20;
  }
  return 1;
}

fn handle_syscall(p, name, args) {
  let w = calc_syscall_work(name, args);
  if (!begin_pending_op(p, name, args, w)) {
    return;
  }
  let res = execute_syscall_now(p, name, args);
  if (p.state == "ready") {
    syscall("host_vm_resume", p.vmId, res);
  }
}

// ============================================================================
// 直属子系统承载管理
// ============================================================================
fn create_child_subsystem(custom_grant) {
  let info = syscall("host_alloc_child", SYS.id);
  if (!info || !info.ok) return info;
  let cid = info.id;
  let kpath = "/Systems/" + cid + "/kernel.ns";
  // 把本系统保存的子系统内核模板写入子系统内核源文件
  let tpl = vfs_read("/System/kernel.ns");
  let ksrc = tpl.ok ? tpl.content : "";
  let wr = vfs_write(kpath, ksrc);
  if (!wr.ok) return wr;

  let grant_cap = custom_grant || floor(SYS.totalBudget * 0.65);
  CHILDREN[cid] = {
    id: cid,
    name: cid,
    carrierPid: -1,
    grantCap: grant_cap,
    paused: false,
    timeRate: 1.0,
    state: "stopped",
    kernelPath: kpath,
    kernelError: null,
    kernelCost: 0,
    internalCost: 0
  };
  return start_child_subsystem(cid);
}

fn start_child_subsystem(cid) {
  if (!has_key(CHILDREN, cid)) return { ok: false, error: "子系统不存在: " + cid };
  let child = CHILDREN[cid];
  let rd = vfs_read(child.kernelPath);
  if (!rd.ok) {
    child.state = "kernel_error";
    child.kernelError = "无法读取内核源文件: " + child.kernelPath;
    syscall("host_child_error", cid, child.kernelError);
    return { ok: false, error: child.kernelError };
  }
  let comp = compile_program_file(child.kernelPath);
  if (!comp || !comp.ok) {
    child.state = "kernel_error";
    child.kernelError = "内核编译错误: " + (comp ? comp.error : "未知错误");
    syscall("host_child_error", cid, child.kernelError);
    return { ok: false, error: child.kernelError };
  }

  let child_seed = syscall("host_get_child_seed", cid);
  let globals = {
    __sys_id: cid,
    __sys_name: child.name,
    __parent_id: SYS.id,
    __depth: SYS.depth + 1,
    __total_budget: child_seed.totalBudget,
    __mem_quota: child_seed.memQuota,
    __storage_quota: child_seed.storageQuota,
    __compiler_id: "self",
    __seed_vfs: child_seed.seedVfs,
    __seed_compiler_bc: ACTIVE_COMPILER_BC
  };
  let vm_id = syscall("host_vm_create_child", cid, comp.bytecode, globals);
  let pid = NEXT_PID;
  NEXT_PID += 1;
  let proc = {
    pid: pid,
    name: cid + " (内核承载)",
    path: child.kernelPath,
    parentPid: 1,
    type: "carrier",
    state: "ready",
    savedState: null,
    waitType: null,
    waitUntil: 0,
    priority: 1,
    quantum: 12000,
    budgetLimit: 1000000,
    tickBudgetUsed: 0,
    budgetUsed: 0,
    memBytes: 8192,
    remainingWork: 0,
    pendingOp: null,
    pendingReply: false,
    inbox: [],
    vmId: vm_id,
    childSystemId: cid,
    error: null,
    stdout: [],
    createdAt: SYS.virtualTime
  };
  push(PROCS, proc);
  child.carrierPid = pid;
  child.state = child.paused ? "paused" : "running";
  child.kernelError = null;
  syscall("host_child_started", cid, child);
  if (WM_PID > 0) {
    ipc_send(1, WM_PID, { type: "open_child_window", childId: cid, title: cid + " (L" + to_str(SYS.depth + 1) + ")" });
  }
  return { ok: true, id: cid, pid: pid };
}

fn handle_child_op(cid, op, arg) {
  if (!has_key(CHILDREN, cid)) return { ok: false, error: "子系统不存在" };
  let child = CHILDREN[cid];
  if (op == "pause") {
    child.paused = true;
    child.state = "paused";
    syscall("host_child_state", cid, { paused: true, state: "paused" });
    return { ok: true };
  }
  if (op == "resume") {
    child.paused = false;
    if (child.carrierPid > 0) child.state = "running";
    syscall("host_child_state", cid, { paused: false, state: child.state });
    return { ok: true };
  }
  if (op == "step") {
    if (!child.paused) return { ok: false, error: "仅暂停中的子系统可执行单步" };
    child.pendingStepMs = to_num(arg) > 0 ? to_num(arg) : 50;
    return { ok: true };
  }
  if (op == "set_grant") {
    child.grantCap = max(500, to_num(arg));
    syscall("host_child_state", cid, { grantCap: child.grantCap });
    return { ok: true };
  }
  if (op == "set_speed") {
    child.timeRate = clamp(to_num(arg), 0.1, 8.0);
    syscall("host_child_state", cid, { timeRate: child.timeRate });
    return { ok: true };
  }
  if (op == "restart") {
    if (child.carrierPid > 0) kill_process(child.carrierPid);
    syscall("host_child_reset_for_restart", cid);
    return start_child_subsystem(cid);
  }
  if (op == "stop") {
    if (child.carrierPid > 0) kill_process(child.carrierPid);
    child.state = "stopped";
    syscall("host_child_state", cid, { state: "stopped" });
    return { ok: true };
  }
  return { ok: false, error: "未知操作" };
}

let LAST_TICK_KERNEL_STEPS = 0;
let LAST_TICK_USER_STEPS = 0;
let LAST_TICK_CARRIER_STEPS = 0;
let LAST_TICK_REMAINING_WORK = 0;

// ============================================================================
// 内核启动与主调度循环
// ============================================================================
vfs_init();
ensure_compiler_loaded();

// 启动桌面与窗口管理器 (/System/wm.ns)
let wm_res = spawn_process("/System/wm.ns", {}, 1, "wm");
if (wm_res.ok) {
  WM_PID = wm_res.pid;
}

// 若为保留子树结构的重启，重新启动既有直属子系统并维持既有状态配置
let restored_kids = syscall("host_take_preserved_children");
if (restored_kids && len(restored_kids) > 0) {
  for (let rk = 0; rk < len(restored_kids); rk += 1) {
    let pc = restored_kids[rk];
    CHILDREN[pc.id] = {
      id: pc.id,
      name: pc.name,
      carrierPid: -1,
      grantCap: pc.grantCap,
      paused: pc.paused,
      timeRate: pc.timeRate,
      state: "stopped",
      kernelPath: pc.kernelPath,
      kernelError: null,
      kernelCost: 0,
      internalCost: 0
    };
    start_child_subsystem(pc.id);
  }
}

while (true) {
  let tick = syscall("host_next_tick");
  if (!tick) continue;

  let dt_ms = tick.dtMs * SYS.timeRate;
  SYS.virtualTime += dt_ms;
  EFFECTIVE_GRANT = min(SYS.totalBudget, tick.budgetGrant);
  TICK_REMAINING = EFFECTIVE_GRANT;
  let tick_kernel_steps = 0;

  // 1. 唤醒到期的计时等待进程
  for (let i = 0; i < len(PROCS); i += 1) {
    let p = PROCS[i];
    p.tickBudgetUsed = 0;
    if (p.state == "waiting" && p.waitType == "time" && SYS.virtualTime >= p.waitUntil) {
      p.state = "ready";
      p.waitType = null;
      if (p.pendingReply) {
        p.pendingReply = false;
        syscall("host_vm_resume", p.vmId, true);
      }
    } else if (p.state == "waiting" && p.waitType == "msg" && p.waitUntil > 0 && SYS.virtualTime >= p.waitUntil) {
      p.state = "ready";
      p.waitType = null;
      if (p.pendingReply) {
        p.pendingReply = false;
        syscall("host_vm_resume", p.vmId, null);
      }
    } else if (p.state == "waiting" && p.waitType == "next_tick") {
      let c = CHILDREN[p.childSystemId];
      let can_run = true;
      let c_dt = dt_ms;
      if (c && c.paused) {
        if (c.pendingStepMs > 0) {
          c_dt = c.pendingStepMs * c.timeRate;
          c.pendingStepMs = 0;
        } else if (tick.stepChildren && has_key(tick.stepChildren, c.id)) {
          c_dt = tick.stepChildren[c.id] * c.timeRate;
        } else {
          can_run = false;
        }
      }
      if (can_run) {
        p.state = "ready";
        p.waitType = null;
        if (p.pendingReply) {
          p.pendingReply = false;
          let cgrant = c ? c.grantCap : 10000;
          let cinfo = syscall("host_child_tick_payload", c.id, c_dt, min(TICK_REMAINING, cgrant));
          syscall("host_vm_resume", p.vmId, cinfo);
        }
      }
    }
  }

  // 2. 分发本系统输入事件给窗口管理器 (wm.ns)
  if (WM_PID > 0 && tick.inputs && len(tick.inputs) > 0) {
    for (let i = 0; i < len(tick.inputs); i += 1) {
      ipc_send(1, WM_PID, { type: "raw_input", event: tick.inputs[i] });
    }
  }

  // 3. 缓存跨层投送窗口发来的输入，供目标应用按序取用
  if (tick.crossInputs && len(tick.crossInputs) > 0) {
    for (let i = 0; i < len(tick.crossInputs); i += 1) {
      let ci = tick.crossInputs[i];
      if (!has_key(PENDING_CROSS_INPUTS, ci.winId)) PENDING_CROSS_INPUTS[ci.winId] = [];
      push(PENDING_CROSS_INPUTS[ci.winId], ci.event);
      if (ci.pid > 0) {
        ipc_send(1, ci.pid, { type: "cross_input", winId: ci.winId, event: ci.event });
      }
    }
  }

  // 4. 分发主调度循环，直到本步预算耗尽或无就绪进程
  let guard = 0;
  while (TICK_REMAINING > 0 && guard < 120) {
    guard += 1;
    let idx = pick_next_process(PROCS, LAST_SCHED_IDX);
    if (idx < 0) break;
    LAST_SCHED_IDX = idx;
    let p = PROCS[idx];

    let slice = min(p.quantum, TICK_REMAINING);
    if (p.type == "carrier" && p.childSystemId && has_key(CHILDREN, p.childSystemId)) {
      slice = min(slice, CHILDREN[p.childSystemId].grantCap);
    }
    if (slice <= 0) break;

    // 若进程有未完成的多步系统调用工作，先扣减进度
    if (p.state == "pending_op" && p.pendingOp) {
      let pop_op = p.pendingOp;
      let rem = pop_op.total - pop_op.done;
      let pay = min(slice, rem);
      pop_op.done += pay;
      TICK_REMAINING -= pay;
      p.budgetUsed += pay;
      p.tickBudgetUsed += pay;
      USER_COST_TOTAL += pay;
      p.remainingWork = pop_op.total - pop_op.done;
      if (pop_op.done >= pop_op.total) {
        p.pendingOp = null;
        p.remainingWork = 0;
        p.state = "ready";
        let sret = execute_syscall_now(p, pop_op.name, pop_op.args);
        if (p.state == "ready") {
          syscall("host_vm_resume", p.vmId, sret);
        }
      }
      continue;
    }

    let avail_mem = max(0, SYS.memQuota - total_mem_used() + p.memBytes);
    let step_res = syscall("host_vm_step", p.vmId, slice, avail_mem);
    let used = step_res.cost || 0;
    TICK_REMAINING = max(0, TICK_REMAINING - used);
    p.budgetUsed += used;
    p.tickBudgetUsed += used;
    p.memBytes = step_res.memBytes || p.memBytes;
    p.remainingWork = step_res.remainingWork || 0;
    if (p.type != "carrier") {
      USER_COST_TOTAL += used;
    }

    if (step_res.status == "PREEMPT") {
      p.state = "ready";
    } else if (step_res.status == "HALTED") {
      p.state = "exited";
      if (p.pid == WM_PID) WM_PID = -1;
    } else if (step_res.status == "ERROR") {
      p.state = "error";
      p.error = step_res.error;
      if (p.type == "carrier" && p.childSystemId && has_key(CHILDREN, p.childSystemId)) {
        CHILDREN[p.childSystemId].state = "kernel_error";
        CHILDREN[p.childSystemId].kernelError = step_res.error;
        syscall("host_child_error", p.childSystemId, step_res.error);
      }
    } else if (step_res.status == "TRAP") {
      handle_syscall(p, step_res.syscall, step_res.args);
    }
    let kstep_in = syscall("host_self_cost");
    KERNEL_COST_TOTAL += kstep_in;
    tick_kernel_steps += kstep_in;
    TICK_REMAINING = max(0, TICK_REMAINING - kstep_in);
  }

  let kstep = syscall("host_self_cost");
  KERNEL_COST_TOTAL += kstep;
  tick_kernel_steps += kstep;

  let user_steps = 0;
  let carrier_steps = 0;
  let rem_work = 0;
  for (let i = 0; i < len(PROCS); i += 1) {
    let pr = PROCS[i];
    if (pr.state != "exited") {
      pr.lastTickSteps = pr.tickBudgetUsed;
      rem_work += pr.remainingWork || 0;
      if (pr.type == "carrier") {
        carrier_steps += pr.tickBudgetUsed;
      } else {
        user_steps += pr.tickBudgetUsed;
      }
    }
  }
  LAST_TICK_KERNEL_STEPS = tick_kernel_steps;
  LAST_TICK_USER_STEPS = user_steps;
  LAST_TICK_CARRIER_STEPS = carrier_steps;
  LAST_TICK_REMAINING_WORK = rem_work;

  // 汇总统计上报宿主显示与任务管理器
  let children_cost = 0;
  let cks = keys(CHILDREN);
  for (let i = 0; i < len(cks); i += 1) {
    let ch = CHILDREN[cks[i]];
    children_cost += ch.kernelCost + ch.internalCost;
  }
  syscall("host_report_telemetry", {
    sysId: SYS.id,
    virtualTime: SYS.virtualTime,
    timeRate: SYS.timeRate,
    totalBudget: SYS.totalBudget,
    effectiveGrant: EFFECTIVE_GRANT,
    remainingBudget: TICK_REMAINING,
    lastGrant: EFFECTIVE_GRANT,
    kernelSteps: tick_kernel_steps,
    userSteps: user_steps,
    carrierSteps: carrier_steps,
    kernelSelfSteps: tick_kernel_steps,
    internalSteps: user_steps + carrier_steps,
    remainingWork: rem_work,
    kernelCost: KERNEL_COST_TOTAL,
    userCost: USER_COST_TOTAL,
    childrenCost: children_cost,
    memQuota: SYS.memQuota,
    memUsed: total_mem_used(),
    storageQuota: SYS.storageQuota,
    storageUsed: STORAGE_USED
  });
}
`;
