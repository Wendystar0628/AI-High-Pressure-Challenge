import { presentationData, projectionTargets } from "./presentation.js";
import {
  directoryEntries,
  applyFileRequest,
  fileRequestCost,
} from "./file-service.js";
import { applicationPrograms } from "./programs.js";
export const copy = (x) => JSON.parse(JSON.stringify(x));
export const program = (code) => JSON.stringify({ version: 1, code }, null, 2);
export const defaults = {
  "/System/kernel.nest": program([
    { op: "set", name: "policy", value: '"round-robin"' },
    { op: "set", name: "messagePrefix", value: '""' },
    { op: "set", name: "filePrefix", value: '""' },
    { op: "set", name: "cursor", value: "0" },
    { op: "sys", call: "kernel.count", name: "count" },
    { op: "if", test: "count==0", to: 4 },
    { op: "set", name: "cursor", value: "(cursor+1)%count" },
    { op: "if", test: 'policy!="priority"', to: 9 },
    { op: "set", name: "cursor", value: "0" },
    { op: "sys", call: "kernel.run", value: "cursor" },
    { op: "jump", to: 4 },
  ]),
  "/System/window-manager.nest": program([
    { op: "set", name: "stack", value: '"normal"' },
    { op: "set", name: "focus", value: '"clicked"' },
    { op: "sys", call: "window.dispatch" },
    { op: "jump", to: 2 },
  ]),
  "/System/compiler.nest": program([
    { op: "sys", call: "compiler.parse" },
    { op: "end" },
  ]),
  "/Programs/accumulate.nest": program([
    { op: "set", name: "n", value: "0" },
    { op: "set", name: "total", value: "0" },
    { op: "set", name: "n", value: "n+1" },
    { op: "set", name: "total", value: "total+n" },
    { op: "if", test: "n<100", to: 2 },
    { op: "sys", call: "print", value: "total" },
    { op: "end" },
  ]),
  "/Programs/spin.nest": program([
    { op: "set", name: "n", value: "0" },
    { op: "set", name: "n", value: "n+1" },
    { op: "jump", to: 1 },
  ]),
  "/Programs/receiver.nest": program([
    { op: "recv", name: "message" },
    { op: "sys", call: "print", value: "message" },
    { op: "jump", to: 0 },
  ]),
  "/Programs/sender.nest": program([
    { op: "send", target: '"receiver"', value: '"来自栖境的消息"' },
    { op: "wait", value: "1" },
    { op: "jump", to: 0 },
  ]),
  "/Programs/flight-control.nest": program([
    { op: "sys", call: "flight.sensor", name: "altitude" },
    {
      op: "sys",
      call: "flight.sensor",
      sensor: "verticalSpeed",
      name: "velocity",
    },
    {
      op: "set",
      name: "collective",
      value: "9.81+(5-altitude)*2-velocity*2.8",
    },
    { op: "sys", call: "flight.control", value: "collective" },
    { op: "wait", value: "0.05" },
    { op: "jump", to: 0 },
  ]),
  "/System/files.nest": program([
    { op: "set", name: "sort", value: '"ascending"' },
    { op: "sys", call: "app.tick" },
    { op: "jump", to: 1 },
  ]),
  "/System/charts.nest": program([
    { op: "set", name: "multiplier", value: "1" },
    { op: "sys", call: "app.tick" },
    { op: "jump", to: 1 },
  ]),
  "/System/player.nest": program([
    { op: "sys", call: "app.tick" },
    { op: "jump", to: 0 },
  ]),
  "/Documents/欢迎.txt":
    "欢迎来到栖境。每一扇窗口，都通向一个独立世界。\n从桌面的「系统空间」创建子系统，从文件管理器查看、编辑与运行程序。",
  "/Demo/sample.sheet": JSON.stringify({
    cells: {
      A1: "项目",
      B1: "数量",
      C1: "单价",
      D1: "小计",
      A2: "项目 A",
      B2: "24",
      C2: "6",
      D2: "=B2*C2",
      A3: "项目 B",
      B3: "12",
      C3: "8",
      D3: "=B3*C3",
      A4: "项目 C",
      B4: "18",
      C4: "4",
      D4: "=B4*C4",
    },
  }),
};
// Kernel service bodies use the same resumable instruction format as user programs.
const kernelTemplate = JSON.parse(defaults["/System/kernel.nest"]);
kernelTemplate.services = {
  "message.send": [
    { op: "if", test: 'messagePrefix==""', to: 2 },
    { op: "set", name: "message", value: "messagePrefix+message" },
    { op: "sys", call: "message.deliver", target: "target", value: "message" },
    { op: "return", value: "true" },
  ],
  "file.read": [
    { op: "sys", call: "file.read.raw", path: "path", name: "result" },
    { op: "return", value: "result" },
  ],
  "file.write": [
    { op: "set", name: "data", value: "filePrefix+data" },
    { op: "sys", call: "file.write.raw", path: "path", value: "data" },
    { op: "return", value: "true" },
  ],
  "files.apply": [
    { op: "sys", call: "files.apply.raw", value: "input", name: "result" },
    { op: "return", value: "result" },
  ],
  "math.double": [
    { op: "set", name: "result", value: "input*2" },
    { op: "return", value: "result" },
  ],
};
defaults["/System/kernel.nest"] = JSON.stringify(kernelTemplate, null, 2);

// The compiler itself is a VM program. It parses JSON and expands an editable opcode alias.
defaults["/System/compiler.nest"] = program([
  { op: "sys", call: "json.parse", value: "source", name: "document" },
  {
    op: "sys",
    call: "object.get",
    object: "document",
    key: '"code"',
    name: "instructions",
  },
  { op: "set", name: "i", value: "0" },
  { op: "sys", call: "array.length", value: "instructions", name: "count" },
  { op: "if", test: "i>=count", to: 15 },
  {
    op: "sys",
    call: "array.get",
    array: "instructions",
    index: "i",
    name: "instruction",
  },
  {
    op: "sys",
    call: "object.get",
    object: "instruction",
    key: '"op"',
    name: "opcode",
  },
  { op: "if", test: 'opcode!="increment"', to: 13 },
  {
    op: "sys",
    call: "object.get",
    object: "instruction",
    key: '"name"',
    name: "target",
  },
  {
    op: "sys",
    call: "object.set",
    object: "instruction",
    key: '"op"',
    value: '"set"',
  },
  {
    op: "sys",
    call: "object.set",
    object: "instruction",
    key: '"value"',
    value: 'target+"+1"',
  },
  {
    op: "sys",
    call: "array.set",
    array: "instructions",
    index: "i",
    value: "instruction",
  },
  { op: "jump", to: 13 },
  { op: "set", name: "i", value: "i+1" },
  { op: "jump", to: 4 },
  {
    op: "sys",
    call: "object.set",
    object: "document",
    key: '"code"',
    value: "instructions",
  },
  { op: "sys", call: "compiler.finish", value: "document" },
]);

Object.assign(defaults, applicationPrograms);
defaults["/System/snapshot.nest"] = program([
  { op: "sys", call: "snapshot.capture", value: "target", name: "image" },
  { op: "sys", call: "json.stringify", value: "image", name: "text" },
  { op: "sys", call: "file.write", path: "path", value: "text" },
  { op: "sys", call: "notify", value: '"快照已保存："+path' },
  { op: "end" },
]);

// Restricted expression parser: no host objects, property access, functions or eval.
export function expr(source, vars = {}) {
  if (typeof source !== "string") return source;
  const ts = [],
    token =
      /"(?:[^"\\]|\\.)*"|'[^']*'|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||[-+*/%()<>!]/gy;
  let offset = 0,
    i = 0;
  while (offset < source.length) {
    if (/\s/.test(source[offset])) {
      offset++;
      continue;
    }
    token.lastIndex = offset;
    const match = token.exec(source);
    if (!match) throw Error("表达式含无效字符：" + source[offset]);
    ts.push(match[0]);
    offset = token.lastIndex;
  }
  const precedence = {
    "||": 1,
    "&&": 2,
    "==": 3,
    "!=": 3,
    "<": 4,
    ">": 4,
    "<=": 4,
    ">=": 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
    "%": 6,
  };
  function parse(min = 0) {
    let t = ts[i++],
      v;
    if (t === "(") {
      v = parse();
      if (ts[i++] !== ")") throw Error("缺少右括号");
    } else if (t === "-") v = -parse(7);
    else if (t === "!") v = !parse(7);
    else if (t?.startsWith('"')) v = JSON.parse(t);
    else if (t?.startsWith("'")) v = t.slice(1, -1);
    else if (/^(\d|\.\d)/.test(t)) v = +t;
    else if (t === "true" || t === "false") v = t === "true";
    else if (t in vars) v = vars[t];
    else if (t === undefined) throw Error("空表达式");
    else v = 0;
    while (i < ts.length && (precedence[ts[i]] || 0) > min) {
      let op = ts[i++],
        r = parse(precedence[op]);
      v = {
        "+": () => v + r,
        "-": () => v - r,
        "*": () => v * r,
        "/": () => {
          if (!r) throw Error("除零");
          return v / r;
        },
        "%": () => v % r,
        "<": () => v < r,
        ">": () => v > r,
        "<=": () => v <= r,
        ">=": () => v >= r,
        "==": () => v == r,
        "!=": () => v != r,
        "&&": () => v && r,
        "||": () => v || r,
      }[op]();
    }
    return v;
  }
  const value = parse();
  if (i !== ts.length) throw Error("表达式有多余内容");
  return value;
}
export function compile(text) {
  let p = JSON.parse(text);
  if (p.version !== 1 || !Array.isArray(p.code))
    throw Error("需要 version:1 和 code 指令数组");
  const ops = [
    "set",
    "if",
    "jump",
    "wait",
    "send",
    "recv",
    "sys",
    "end",
    "return",
  ];
  p.code.forEach((x, i) => {
    if (!ops.includes(x.op)) throw Error("第 " + i + " 条指令无效：" + x.op);
  });
  return p.code;
}
export function cellValue(cells, address, seen = []) {
  if (seen.includes(address)) return "#CYCLE!";
  let raw = cells[address] ?? "";
  if (!String(raw).startsWith("="))
    return raw !== "" && !isNaN(raw) ? +raw : raw;
  try {
    let code = raw
      .slice(1)
      .toUpperCase()
      .replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (_, a, b) =>
        range(a + ":" + b).reduce((sum, k) => {
          let v = cellValue(cells, k, [...seen, address]);
          if (String(v).startsWith("#")) throw Error(v);
          return sum + (+v || 0);
        }, 0),
      );
    code = code.replace(/\b[A-Z]+\d+\b/g, (k) => {
      if (!/^[A-L]([1-9]|[1-9][0-9])$/.test(k)) throw Error("#REF!");
      let v = cellValue(cells, k, [...seen, address]);
      if (String(v).startsWith("#")) throw Error(v);
      return +v || 0;
    });
    if (/[^\d.\s()+*/%<>!=-]/.test(code)) return "#REF!";
    return expr(code);
  } catch (e) {
    return e.message === "除零"
      ? "#DIV/0!"
      : e.message.startsWith("#")
        ? e.message
        : "#ERROR!";
  }
}
export function range(s) {
  let [a, b] = s.toUpperCase().split(":");
  b = b || a;
  let ma = a.match(/^([A-Z])(\d+)$/),
    mb = b.match(/^([A-Z])(\d+)$/);
  if (
    !ma ||
    !mb ||
    !/^[A-L]([1-9]|[1-9][0-9])$/.test(a) ||
    !/^[A-L]([1-9]|[1-9][0-9])$/.test(b)
  )
    throw Error("#REF!");
  let result = [];
  for (
    let r = Math.min(+ma[2], +mb[2]);
    r <= Math.min(Math.max(+ma[2], +mb[2]), 99);
    r++
  )
    for (
      let c = Math.min(ma[1].charCodeAt(), mb[1].charCodeAt());
      c <= Math.min(Math.max(ma[1].charCodeAt(), mb[1].charCodeAt()), 76);
      c++
    )
      result.push(String.fromCharCode(c) + r);
  return result;
}
export class Engine {
  constructor(scene) {
    this.scene = scene;
    this.state = {
      systems: {},
      serial: 0,
      pid: 0,
      wid: 0,
      clipboard: [],
      notifications: [],
      epoch: Date.now(),
    };
    this.onApp = () => {};
    this.create(null);
  }
  get systems() {
    return this.state.systems;
  }
  get root() {
    return this.systems.outer;
  }
  create(parentId) {
    let id = parentId ? "inner-" + ++this.state.serial : "outer",
      files = copy(defaults);
    files["/Demo/helicopter-24.scene"] = JSON.stringify(this.scene);
    let s = {
      id,
      parentId,
      name: parentId ? id : "栖境",
      state: "running",
      clock: 0,
      rate: 1,
      budget: 2400,
      grant: 1800,
      memory: 32768,
      storage: 32768,
      used: 0,
      own: 0,
      rr: 0,
      processes: [],
      windows: [],
      files,
      folders: [
        "/Documents",
        "/Downloads",
        "/Trash",
        "/Demo",
        "/System",
        "/Programs",
        "/Snapshots",
      ],
      settings: { accent: "#85cbb6", wallpaper: "lake", scale: 1 },
      input: [],
      snapshots: [],
      kernel: null,
    };
    this.systems[id] = s;
    if (parentId) {
      s.kernelPath = "/System/" + id + ".kernel.nest";
      this.systems[parentId].files[s.kernelPath] =
        defaults["/System/kernel.nest"];
      s.kernel = this.process(
        s,
        s.kernelPath,
        this.systems[parentId].files[s.kernelPath],
        "kernel",
      );
      let carrier = this.process(
        this.systems[parentId],
        "承载 · " + id,
        program([
          { op: "sys", call: "child.run" },
          { op: "jump", to: 0 },
        ]),
        "carrier",
      );
      carrier.child = id;
      this.process(
        s,
        "/System/window-manager.nest",
        files["/System/window-manager.nest"],
        "wm",
      );
    }
    return s;
  }
  process(s, path, source, kind = "user", windowId = null) {
    this.ensureMemory(s, 1);
    let p = {
      id: s.id + ":p" + ++this.state.pid,
      path,
      name: path.split("/").pop().replace(".nest", ""),
      code: compile(
        (kind === "kernel"
          ? this.systems[s.parentId]?.files["/System/compiler.nest"]
          : s.files["/System/compiler.nest"]) ||
          defaults["/System/compiler.nest"],
      ),
      compiling: true,
      source,
      services: JSON.parse(source).services || {},
      frames: [],
      kind,
      pc: 0,
      vars: { source },
      queue: [],
      state: "ready",
      wake: 0,
      work: 0,
      last: 0,
      quota: 240,
      remaining: 0,
      error: "",
      output: [],
      windowId,
    };
    if (kind !== "kernel") s.processes.push(p);
    return p;
  }
  ownMemory(s) {
    return (
      Math.ceil(
        JSON.stringify({
          p: s.processes.filter((p) => p.state !== "ended"),
          w: s.state === "stopped" ? [] : s.windows,
        }).length / 1024,
      ) +
      (s.state === "stopped"
        ? 0
        : s.windows.filter((w) => w.appId === "player").length * 2048)
    );
  }
  memoryUsed(s) {
    return this.descendants(s.id).reduce(
      (n, id) => n + this.ownMemory(this.systems[id]),
      0,
    );
  }
  ensureMemory(s, extra = 0) {
    for (let node = s; node; node = this.systems[node.parentId])
      if (this.memoryUsed(node) + extra > node.memory)
        throw Error("内存配额不足：" + node.id);
  }
  storageUsed(s) {
    return this.descendants(s.id).reduce(
      (n, id) =>
        n + Math.ceil(JSON.stringify(this.systems[id].files).length / 1024),
      0,
    );
  }
  write(s, path, text) {
    let growth = (text.length - (s.files[path]?.length || 0)) / 1024;
    for (let node = s; node; node = this.systems[node.parentId])
      if (this.storageUsed(node) + growth > node.storage)
        throw Error("存储配额不足：" + node.id);
    s.files[path] = text;
  }
  running(s) {
    return (
      s.state === "running" &&
      (!s.parentId || this.running(this.systems[s.parentId]))
    );
  }
  tick() {
    for (const s of Object.values(this.systems)) {
      s.used = 0;
      s.own = 0;
      for (const p of s.processes) {
        p.last = 0;
        p.ran = false;
      }
    }
    this.advance(this.root, this.root.budget, 1 / 30);
  }
  clockTree(s, dt, force = false) {
    if (s.state !== "running" && !force) return;
    s.clock += dt * s.rate;
    for (let child of Object.values(this.systems).filter(
      (c) => c.parentId === s.id,
    ))
      this.clockTree(child, dt * s.rate);
  }
  advance(s, budget, dt, force = false, clockReady = false) {
    if (s.state !== "running" && !force) return 0;
    if (!clockReady) this.clockTree(s, dt, force);
    if (budget <= 0) return 0;
    s.used = 0;
    s.own = 0;
    budget = Math.min(budget, s.budget);
    for (let p of s.processes) {
      p.last = 0;
      p.ran = false;
    }
    let safety = 0;
    while (s.used < budget && safety++ < budget * 2) {
      if (s.kernel) {
        let before = s.used;
        this.instruction(s, s.kernel, budget - s.used, dt * s.rate);
        s.own++;
        s.used++;
        if (s.kernel.state === "error") {
          s.state = "error";
          s.error = s.kernel.error;
          break;
        }
        if (s.used === before) break;
      } else {
        let cost = this.dispatch(s, budget - s.used, dt * s.rate);
        if (!cost) break;
        s.used += cost;
      }
    }
    return s.used;
  }
  eligible(p, s) {
    return (
      !["ended", "error", "suspended"].includes(p.state) &&
      p.last < p.quota &&
      !(p.kind === "carrier" && p.ran) &&
      !(
        p.state === "waiting" &&
        ((p.waitFor === "time" && s.clock < p.wake) ||
          (p.waitFor === "message" && !p.queue.length))
      )
    );
  }
  dispatch(s, budget, dt) {
    const all = s.processes;
    if (!all.length) return 0;
    for (let i = 0; i < all.length; i++) {
      const p = all[s.rr++ % all.length];
      if (this.eligible(p, s)) return this.runSelected(s, p, budget, dt);
    }
    return 0;
  }
  runSelected(s, p, budget, dt) {
    let n = Math.min(12, budget, p.quota - p.last),
      used = 0;
    if (p.kind === "carrier") {
      if (budget < 2 || p.ran) return 0;
      p.ran = true;
      let child = this.systems[p.child];
      if (child && child.state === "running" && !p.visited) {
        p.visited = true;
        used =
          1 +
          this.advance(
            child,
            Math.min(budget - 1, child.grant),
            dt,
            false,
            true,
          );
        p.visited = false;
        p.last = used;
        p.work += used;
        return used;
      }
      p.last = 1;
      p.work++;
      return 1;
    }
    for (let j = 0; j < n; j++) {
      if (!this.instruction(s, p, n - j, dt)) break;
      used++;
    }

    return used;
  }
  service(s, p, call, args, dest) {
    let code = s.kernel?.services?.[call];
    if (!code) return false;
    p.frames ??= [];
    p.frames.push({ code: p.code, pc: p.pc, vars: p.vars, dest });
    p.code = copy(code);
    p.pc = 0;
    p.vars = { ...copy(s.kernel.vars), ...copy(args) };
    return true;
  }
  instruction(s, p, budget, dt) {
    if (p.state === "waiting") {
      if (p.waitFor === "message" && !p.queue.length) return false;
      if (p.waitFor === "time" && s.clock < p.wake) return false;
      p.state = "ready";
    }
    if (["ended", "error", "suspended"].includes(p.state)) return false;
    if (p.remaining > 0) {
      p.remaining--;
      p.work++;
      p.last++;
      return true;
    }
    let ins = p.code[p.pc];
    if (!ins) {
      p.state = "ended";
      return false;
    }
    try {
      let val = (x) => expr(x, p.vars);
      if (
        p.prepaid !== p.pc &&
        ins.op === "sys" &&
        ins.call === "snapshot.capture"
      ) {
        const target = this.systems[val(ins.value)];
        if (!target || target.parentId !== s.id)
          throw Error("只能为直属子系统创建快照");
        p.pendingSnapshot = this.snapshot(target);
        p.prepaid = p.pc;
        p.remaining = Math.max(
          1,
          Math.ceil(JSON.stringify(p.pendingSnapshot).length / 256),
        );
        p.work++;
        p.last++;
        return true;
      }
      if (
        p.prepaid !== p.pc &&
        ins.op === "sys" &&
        ins.call === "app.present"
      ) {
        const w = s.windows.find((w) => w.id === p.windowId);
        if (w) {
          const packet = presentationData(w.data),
            key = JSON.stringify(packet);
          if (w.presentationKey !== key) {
            p.pendingPresentation = packet;
            p.presentationKey = key;
            p.prepaid = p.pc;
            p.remaining =
              Math.max(1, Math.ceil(key.length / 1024)) *
              (1 + projectionTargets(this, s.id, w.id).length);
            p.work++;
            p.last++;
            return true;
          }
        }
      }
      if (p.prepaid !== p.pc) {
        let cost =
          ins.op === "sys" && ins.call === "files.apply.raw"
            ? fileRequestCost(s, val(ins.value))
            : ins.op === "sys" &&
                [
                  "app.tick",
                  "scene.sample",
                  "chart.receive",
                  "chart.submit",
                  "flight.advance",
                ].includes(ins.call)
              ? this.appCost?.(s, p, ins.call) || 0
              : ins.op === "sys" &&
                  ["file.write", "file.write.raw"].includes(ins.call)
                ? Math.ceil(String(val(ins.value)).length / 256)
                : 0;
        if (cost > 0) {
          p.prepaid = p.pc;
          p.remaining = cost;
          p.work++;
          p.last++;
          return true;
        }
      }
      p.prepaid = null;
      p.pc++;
      if (p.frames?.length) s.own++;
      switch (ins.op) {
        case "set": {
          let value = val(ins.value);
          if (typeof value === "string" && value.length > 1024)
            this.ensureMemory(
              s,
              Math.max(
                0,
                value.length - String(p.vars[ins.name] ?? "").length,
              ) / 1024,
            );
          p.vars[ins.name] = value;
          break;
        }
        case "jump":
          p.pc = ins.to;
          break;
        case "if":
          if (val(ins.test)) p.pc = ins.to;
          break;
        case "wait":
          p.wake = s.clock + val(ins.value);
          p.state = "waiting";
          p.waitFor = "time";
          break;
        case "recv":
          if (p.queue.length) p.vars[ins.name] = p.queue.shift().value;
          else {
            p.pc--;
            p.state = "waiting";
            p.waitFor = "message";
          }
          break;
        case "send": {
          let target = val(ins.target);
          let targetP = s.processes.find(
            (x) => x.id === target || x.name === target,
          );
          if (!targetP || ["ended", "error"].includes(targetP.state))
            throw Error("收件进程不存在");
          if (
            this.service(
              s,
              p,
              "message.send",
              { target: targetP.id, message: copy(val(ins.value)) },
              "sendResult",
            )
          )
            break;
          let q = s.processes.find((x) => x.id === target || x.name === target);
          if (!q || ["ended", "error"].includes(q.state))
            throw Error("收件进程不存在");
          q.queue.push({
            from: p.id,
            value: copy(val(ins.value)),
            time: s.clock,
          });
          break;
        }
        case "return": {
          let result = val(ins.value),
            frame = p.frames?.pop();
          if (!frame) {
            p.state = "ended";
            break;
          }
          p.code = frame.code;
          p.pc = frame.pc;
          p.vars = frame.vars;
          if (frame.dest) p.vars[frame.dest] = copy(result);
          break;
        }
        case "end":
          p.state = "ended";
          break;
        case "sys":
          if (
            ins.call !== "kernel.run" &&
            s.kernel?.services?.[ins.call] &&
            this.service(
              s,
              p,
              ins.call,
              {
                input: val(ins.value),
                data: val(ins.value),
                path: val(ins.path),
              },
              ins.name || "result",
            )
          )
            break;
          switch (ins.call) {
            case "kernel.count":
              p.vars[ins.name || "count"] = s.processes.length;
              break;
            case "kernel.run": {
              const target = s.processes[Math.floor(val(ins.value))];
              if (target && this.eligible(target, s)) {
                if (budget <= 1) p.pc--;
                else s.used += this.runSelected(s, target, budget - 1, dt);
              }
              break;
            }
            case "kernel.dispatch":
              s.used += this.dispatch(s, Math.max(0, budget - 1), dt);
              break;
            case "window.dispatch": {
              let event = s.input.shift();
              if (event) {
                if (p.vars.focus === "topmost") {
                  let top = s.windows
                    .filter(
                      (w) => w.appId !== "system" && w.state !== "minimized",
                    )
                    .sort((a, b) => b.z - a.z)[0];
                  if (top) event.windowId = top.id;
                }
                this.onApp(s, event);
              }
              break;
            }
            case "input.poll":
              p.vars[ins.name] = s.input.length ? s.input.shift() : false;
              break;
            case "window.top":
              p.vars[ins.name] =
                s.windows
                  .filter((w) => w.state !== "minimized")
                  .sort((a, b) => b.z - a.z)[0]?.id || "";
              break;
            case "window.z":
              p.vars[ins.name] =
                val(ins.direction) === "min"
                  ? Math.min(0, ...s.windows.map((w) => w.z))
                  : Math.max(0, ...s.windows.map((w) => w.z));
              break;
            case "window.set": {
              const w = s.windows.find((w) => w.id === val(ins.target));
              if (w) {
                w.z = val(ins.value);
                s.focusedWindow = w.id;
                this.onApp(s, { type: "window-present", windowId: w.id });
              }
              break;
            }
            case "message.route":
              this.onApp(s, copy(val(ins.value)));
              break;
            case "files.poll": {
              const index = p.queue.findIndex(
                (q) => q.event?.type === "files.request",
              );
              p.fileRequest =
                index < 0 ? null : p.queue.splice(index, 1)[0].event.payload;
              p.vars[ins.name] = p.fileRequest ? copy(p.fileRequest) : false;
              break;
            }
            case "files.apply":
            case "files.apply.raw":
              p.vars[ins.name] = applyFileRequest(this, s, val(ins.value));
              break;
            case "files.reply":
              (p.responses ??= {})[p.fileRequest.id] = copy(val(ins.value));
              delete p.listKey;
              break;
            case "files.scan": {
              const w = s.windows.find((w) => w.id === p.windowId),
                path = w?.data.path || "/Documents",
                items = directoryEntries(s, path);
              const key = JSON.stringify([
                path,
                items.map((i) => [i.path, s.files[i.path]?.length]),
              ]);
              p.vars[ins.name] = key === p.listKey ? false : items;
              p.listKey = key;
              p.listPath = path;
              break;
            }
            case "files.present": {
              const w = s.windows.find((w) => w.id === p.windowId);
              if (w) {
                w.data.listing = copy(val(ins.value));
                w.data.listingPath = p.listPath;
              }
              break;
            }
            case "string.compare":
              p.vars[ins.name] = String(val(ins.value)).localeCompare(
                String(val(ins.other)),
                "zh-CN",
              );
              break;
            case "app.present": {
              const w = s.windows.find((w) => w.id === p.windowId);
              if (w && p.pendingPresentation) {
                w.presentation = p.pendingPresentation;
                w.presentationKey = p.presentationKey;
                for (const target of projectionTargets(this, s.id, w.id))
                  target.data.frame = copy(p.pendingPresentation);
                delete p.pendingPresentation;
                delete p.presentationKey;
              }
              break;
            }
            case "app.read": {
              const w = s.windows.find((w) => w.id === p.windowId);
              p.vars[ins.name || "value"] = copy(
                w?.data?.[val(ins.key)] ?? null,
              );
              break;
            }
            case "app.write": {
              const w = s.windows.find((w) => w.id === p.windowId),
                key = val(ins.key);
              if (["__proto__", "constructor", "prototype"].includes(key))
                throw Error("保留字段");
              if (w) w.data[key] = copy(val(ins.value));
              break;
            }
            case "message.poll": {
              const index = p.queue.findIndex((q) => Object.hasOwn(q, "value"));
              p.vars[ins.name || "message"] =
                index < 0 ? false : p.queue.splice(index, 1)[0].value;
              break;
            }
            case "app.send": {
              const target = s.processes.find(
                (q) =>
                  q.windowId === p.windowId &&
                  q.kind === "app" &&
                  !["ended", "error"].includes(q.state),
              );
              if (target)
                target.queue.push({
                  from: p.id,
                  value: copy(val(ins.value)),
                  time: s.clock,
                });
              break;
            }
            case "string.split":
              p.vars[ins.name] = String(val(ins.value))
                .split(val(ins.separator) || ",")
                .map((s) => s.trim());
              break;
            case "number": {
              const n = Number(val(ins.value));
              p.vars[ins.name] = Number.isFinite(n) ? n : 0;
              break;
            }
            case "app.input":
            case "scene.publish":
            case "scene.sample":
            case "flight.advance":
            case "chart.receive":
            case "chart.submit": {
              const result = this.onApp(s, {
                type: "service",
                call: ins.call,
                p,
                value: val(ins.value),
                version: val(ins.version),
              });
              if (ins.name) p.vars[ins.name] = copy(result ?? false);
              break;
            }
            case "app.tick":
              this.onApp(s, { type: "tick", p, dt });
              break;
            case "print":
              p.output.push(String(val(ins.value)));
              p.output = p.output.slice(-50);
              break;
            case "clock":
              p.vars[ins.name || "time"] = s.clock;
              break;
            case "identity":
              p.vars[ins.name || "pid"] = p.id;
              break;
            case "message.deliver": {
              let q = s.processes.find((q) => q.id === val(ins.target));
              if (!q || ["ended", "error"].includes(q.state))
                throw Error("收件进程不存在");
              let message = copy(val(ins.value));
              this.ensureMemory(s, JSON.stringify(message).length / 1024);
              q.queue.push({ from: p.id, value: message, time: s.clock });
              break;
            }
            case "file.read.raw":
            case "file.read":
              p.vars[ins.name || "data"] = s.files[val(ins.path)] ?? "";
              break;
            case "file.write.raw":
            case "file.write":
              this.write(s, val(ins.path), String(val(ins.value)));
              break;
            case "process.spawn": {
              let path = val(ins.path);
              p.vars[ins.name || "pid"] = this.process(
                s,
                path,
                s.files[path],
              ).id;
              break;
            }
            case "process.end": {
              let target = s.processes.find((x) => x.id === val(ins.value));
              if (target) this.end(s, target);
              break;
            }
            case "flight.sensor": {
              let w = p.windowId
                ? s.windows.find(
                    (w) => w.id === p.windowId && w.appId === "player",
                  )
                : s.windows.filter((w) => w.appId === "player").length === 1
                  ? s.windows.find((w) => w.appId === "player")
                  : null;
              let flight = w?.data.flight;
              p.vars[ins.name || "altitude"] = flight
                ? ({
                    x: flight.x,
                    z: flight.z,
                    altitude: flight.y,
                    verticalSpeed: flight.vy,
                    heading: flight.heading,
                  }[ins.sensor || "altitude"] ?? flight.y)
                : 0;
              p.vars.sensorTime = s.clock - (w?.data.physicsBacklog || 0);
              break;
            }
            case "flight.control": {
              let w = p.windowId
                ? s.windows.find(
                    (w) => w.id === p.windowId && w.appId === "player",
                  )
                : s.windows.filter((w) => w.appId === "player").length === 1
                  ? s.windows.find((w) => w.appId === "player")
                  : null;
              if (w?.data.flight) {
                w.data.flight.control = val(ins.value);
                if (ins.heading !== undefined)
                  w.data.flight.target = val(ins.heading);
                if (ins.roll !== undefined)
                  w.data.flight.rollTarget = val(ins.roll);
                w.data.flight.controlTime = s.clock;
                w.data.controls ??= [];
                w.data.controls.push({
                  time: s.clock,
                  value: val(ins.value),
                  heading:
                    ins.heading === undefined ? undefined : val(ins.heading),
                });
                w.data.controls = w.data.controls.slice(-12000);
              }
              break;
            }
            case "snapshot.capture":
              p.vars[ins.name] = p.pendingSnapshot;
              delete p.pendingSnapshot;
              break;
            case "json.stringify":
              p.vars[ins.name] = JSON.stringify(val(ins.value));
              break;
            case "notify":
              this.onApp(s, {
                type: "notification",
                message: String(val(ins.value)),
              });
              break;
            case "json.parse":
              p.vars[ins.name] = JSON.parse(String(val(ins.value)));
              break;
            case "object.get":
              p.vars[ins.name] = copy(val(ins.object)[val(ins.key)]);
              break;
            case "object.set": {
              let obj = val(ins.object),
                key = val(ins.key);
              if (["__proto__", "constructor", "prototype"].includes(key))
                throw Error("保留字段");
              obj[key] = copy(val(ins.value));
              break;
            }
            case "array.length":
              p.vars[ins.name] = val(ins.value).length;
              break;
            case "array.get":
              p.vars[ins.name] = copy(val(ins.array)[val(ins.index)]);
              break;
            case "array.set":
              val(ins.array)[val(ins.index)] = copy(val(ins.value));
              break;
            case "compiler.finish": {
              let doc = val(ins.value);
              if (p.compiling) {
                p.code = compile(JSON.stringify(doc));
                p.pc = 0;
                p.compiling = false;
                p.vars =
                  p.path === "/System/compiler.nest"
                    ? { source: p.source }
                    : copy(p.launchVars || {});
              } else {
                p.output.push(JSON.stringify(doc));
                this.write(
                  s,
                  "/System/compiler.compiled.nest",
                  JSON.stringify(doc),
                );
                p.state = "ended";
              }
              break;
            }
            case "display.submit": {
              p.display = {
                text:
                  typeof val(ins.value) === "object"
                    ? ""
                    : String(val(ins.value)),
                shapes:
                  typeof val(ins.value) === "object"
                    ? copy(val(ins.value))
                    : [],
                x: val(ins.x) || 30,
                y: val(ins.y) || 40,
                color: val(ins.color) || "#85cbb6",
                time: s.clock,
                resource: ins.scene
                  ? JSON.parse(s.files[val(ins.scene)])
                  : null,
                position: val(ins.time) || 0,
              };
              break;
            }
            case "compiler.parse":
              p.vars.result = "JSON instruction compiler v1";
              break;
            default:
              if (s.kernel?.vars[ins.call] !== undefined)
                p.vars[ins.name || "result"] = s.kernel.vars[ins.call];
              else throw Error("未知系统调用 " + ins.call);
          }
          break;
      }
      p.work++;
      p.last++;
      return true;
    } catch (e) {
      p.state = "error";
      p.error = e.message;
      return false;
    }
  }
  end(s, p) {
    p.state = "ended";
    p.queue = [];
    p.frames = [];
    p.remaining = 0;
    if (p.child) this.stop(this.systems[p.child]);
    if (p.windowId && (p.kind === "app" || p.kind === "user")) {
      for (const helper of s.processes.filter(
        (x) => x.windowId === p.windowId,
      )) {
        helper.state = "ended";
        helper.queue = [];
        helper.remaining = 0;
      }
      s.windows = s.windows.filter((w) => w.id !== p.windowId);
    }
  }
  stop(s) {
    s.state = "stopped";
    for (let p of s.processes) p.state = "ended";
    for (let c of Object.values(this.systems).filter(
      (c) => c.parentId === s.id,
    ))
      this.stop(c);
  }
  restart(s) {
    const original = [...s.processes],
      children = Object.values(this.systems).filter((c) => c.parentId === s.id);
    for (const p of original) {
      p.previousState = p.state;
      p.state = "ended";
      p.queue = [];
    }
    s.processes = [];
    s.input = [];
    s.clock = 0;
    s.used = 0;
    s.own = 0;
    s.rr = 0;
    s.state = "running";
    s.error = "";
    try {
      if (s.parentId) {
        const parent = this.systems[s.parentId];
        s.kernel = this.process(
          s,
          s.kernelPath,
          parent.files[s.kernelPath],
          "kernel",
        );
        let carrier = parent.processes.find(
          (p) => p.child === s.id && p.state !== "ended",
        );
        if (!carrier) {
          carrier = this.process(
            parent,
            "承载 · " + s.id,
            program([{ op: "end" }]),
            "carrier",
          );
          carrier.child = s.id;
        }
      }
      for (const old of original) {
        if (
          old.kind === "carrier" ||
          old.kind === "controller" ||
          old.previousState === "ended"
        )
          continue;
        const source = s.files[old.path] || old.source;
        if (!source) continue;
        const next = this.process(s, old.path, source, old.kind, old.windowId);
        next.name = old.name;
        next.quota = old.quota;
        const w = s.windows.find((w) => w.id === old.windowId);
        if (w && old.kind === "app") w.pid = next.id;
      }
      for (const w of s.windows) {
        if (w.appId === "player") {
          const resource = JSON.parse(
            s.files[w.data.scene] || JSON.stringify(w.data.resource),
          );
          Object.assign(w.data, {
            resource,
            position: 0,
            frameTime: 0,
            sceneTime: 0,
            effectsTime: 0,
            state: "paused",
            lastClock: 0,
            record: [],
            controls: [],
            physicsBacklog: 0,
            sceneFlight: null,
          });
          delete w.data.flight;
        }
        if (w.appId === "charts")
          Object.assign(w.data, {
            pending: [],
            cache: [],
            version: 0,
            connectionState: "未连接",
          });
        if (w.appId === "editor")
          Object.assign(w.data, {
            text: s.files[w.data.path] || "",
            dirty: false,
          });
      }
      for (const child of children) this.restart(child);
    } catch (error) {
      s.state = "error";
      s.error = error.message;
    }
  }
  queueSnapshot(parent, child, path) {
    let p = this.process(
      parent,
      "/System/snapshot.nest",
      parent.files["/System/snapshot.nest"] ||
        defaults["/System/snapshot.nest"],
      "service",
    );
    p.launchVars = { target: child.id, path };
    return p;
  }
  snapshot(s) {
    let ids = this.descendants(s.id);
    return {
      version: 1,
      root: s.id,
      systems: copy(
        Object.fromEntries(ids.map((id) => [id, this.systems[id]])),
      ),
    };
  }
  descendants(id) {
    return [
      id,
      ...Object.values(this.systems)
        .filter((s) => s.parentId === id)
        .flatMap((s) => this.descendants(s.id)),
    ];
  }
  restore(s, snap, fork = false) {
    let data = copy(snap.systems),
      map = {},
      pmap = {},
      wmap = {};
    for (let id of Object.keys(data))
      map[id] = fork ? "inner-" + ++this.state.serial : id;
    for (let node of Object.values(data)) {
      for (let w of node.windows)
        wmap[w.id] = fork ? "w" + ++this.state.wid : w.id;
      for (let p of [...node.processes, ...(node.kernel ? [node.kernel] : [])])
        pmap[p.id] = fork ? map[node.id] + ":p" + ++this.state.pid : p.id;
    }
    let oldParent = s.parentId;
    if (!fork) for (let id of this.descendants(s.id)) delete this.systems[id];
    for (let [id, node] of Object.entries(data)) {
      node.id = map[id];
      node.parentId = id === snap.root ? oldParent : map[node.parentId];
      if (fork) node.name = node.id;
      for (let p of [
        ...node.processes,
        ...(node.kernel ? [node.kernel] : []),
      ]) {
        p.id = pmap[p.id];
        if (p.child) p.child = map[p.child];
        if (p.windowId) p.windowId = wmap[p.windowId];
        for (let q of p.queue) {
          if (q.from) q.from = pmap[q.from] || q.from;
          if (q.event)
            q.event.windowId = wmap[q.event.windowId] || q.event.windowId;
        }
        for (let k of Object.keys(p.vars))
          if (typeof p.vars[k] === "string" && pmap[p.vars[k]])
            p.vars[k] = pmap[p.vars[k]];
      }
      if (fork) {
        const refs = { ...map, ...pmap, ...wmap };
        const remap = (v) =>
          typeof v === "string"
            ? refs[v] || v
            : Array.isArray(v)
              ? v.map(remap)
              : v && typeof v === "object"
                ? Object.fromEntries(
                    Object.entries(v).map(([k, x]) => [k, remap(x)]),
                  )
                : v;
        for (const p of [
          ...node.processes,
          ...(node.kernel ? [node.kernel] : []),
        ]) {
          p.vars = remap(p.vars);
          p.frames = remap(p.frames);
          p.queue = remap(p.queue);
        }
        for (const w of node.windows)
          if (w.data.processId)
            w.data.processId = pmap[w.data.processId] || w.data.processId;
      }
      node.input = node.input.map((e) => ({
        ...e,
        windowId: wmap[e.windowId] || e.windowId,
      }));
      for (let w of node.windows) {
        w.id = wmap[w.id];
        w.systemId = node.id;
        if (w.pid) w.pid = pmap[w.pid];
        if (w.data.child) w.data.child = map[w.data.child];
        if (w.appId === "projection") {
          w.data.sourceSystemId =
            map[w.data.sourceSystemId] || w.data.sourceSystemId;
          w.data.sourceWindowId =
            wmap[w.data.sourceWindowId] || w.data.sourceWindowId;
        }
        if (w.appId === "charts") {
          if (this.state.dataUpdates) delete this.state.dataUpdates[w.id];
          w.data.connectionState = "已恢复，待重新连接";
          w.data.pending = [];
        }
      }
      this.systems[node.id] = node;
    }
    let node = this.systems[map[snap.root]];
    if (fork) {
      for (let item of Object.values(data)) {
        item.kernelPath = "/System/" + item.id + ".kernel.nest";
        this.systems[item.parentId].files[item.kernelPath] = JSON.stringify({
          version: 1,
          code: item.kernel.code,
          services: item.kernel.services || {},
        });
      }
      let p = this.process(
        this.systems[oldParent],
        "承载 · " + node.id,
        program([{ op: "end" }]),
        "carrier",
      );
      p.child = node.id;
    }
    return node;
  }
}
