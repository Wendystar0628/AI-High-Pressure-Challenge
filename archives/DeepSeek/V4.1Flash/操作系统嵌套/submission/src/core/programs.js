// 预置的 NPL 程序与内核源文件（均为实际运行的用户态/内核态程序）。

export const KERNEL_SOURCE = `// NESTED OS 子系统内核 —— NPL/1
// 本文件位于父系统：/System/inner-N.kernel.prog
// 修改并重启该子系统后生效。以下每一项都实际决定内核行为。

var VERSION   = "NESTED-KERNEL/1.2";
var SLICE     = 900;          // 每个进程每轮可取得的预算（指令/工作单位）
var ROUNDS    = 8;            // 每逻辑步轮转轮数
var POLICY    = "round-robin";// 调度策略
var DELIVERY  = "fifo";       // 消息投递顺序
var FS_POLICY = "normal";     // normal / readonly

function boot() {
  sys.log(VERSION + " 启动；策略 " + POLICY);
  sys.fsPolicy(FS_POLICY);
  sys.deliverMode(DELIVERY);
  sys.registerSyscall("now", "time");
  sys.registerSyscall("double", "mul2");
  sys.registerSyscall("sum", "add");
  // 内核启动的桌面与应用服务程序
  sys.spawn("/Apps/wm.prog", "wm");
  sys.spawn("/Apps/files.prog", "files");
  sys.spawn("/Apps/player.prog", "player");
  sys.spawn("/Apps/charts.prog", "charts");
  sys.setReady("运行中");
}

function runRound(procs, reverse) {
  var n = len(procs);
  var i = 0;
  while (i < n) {
    var idx = i;
    if (reverse == true) { idx = n - 1 - i; }
    var p = procs[idx];
    if (p.pid != sys.pid() && p.state == "ready") {
      sys.run(p.pid, SLICE);
    }
    i = i + 1;
  }
}

function schedule() {
  var procs = sys.procs();
  var rounds = 0;
  var reverse = false;
  if (POLICY == "reverse") { reverse = true; }
  while (rounds < ROUNDS) {
    runRound(procs, reverse);
    rounds = rounds + 1;
  }
}

function main() {
  boot();
  while (true) {
    var dt = sys.stepWait();
    schedule();
  }
}
`;

export const WM_SOURCE = `// 窗口管理程序（内核启动）—— 决定层叠顺序、焦点候选与新建窗口的层叠偏移
var POLICY  = "stack";   // stack：最近聚焦在上；alpha：按标题；creation：按创建顺序
var CASCADE = 28;        // 新窗口层叠偏移
var FOCUS_RULE = "recent"; // recent / first

function main() {
  ui.wmPolicy(POLICY, CASCADE, FOCUS_RULE);
  while (true) {
    var order = ui.windowOrder(POLICY);
    ui.wmApply(order, FOCUS_RULE);
    sys.stepWait();
  }
}
`;

export const FILES_SOURCE = `// 文件管理器服务程序（内核启动）
var SORT = "kind";       // kind / name / size / time
var SHOW_HIDDEN = false;

function main() {
  app.configure("files", SORT, SHOW_HIDDEN);
  while (true) {
    app.pump("files");
    sys.wait(0.2);
  }
}
`;

export const PLAYER_SOURCE = `// 三维场景播放器程序（内核启动）
var FPS = 30;
var LOOP = false;
var DEFAULT_SCENE = "/Demo/helicopter-24.scene";

function main() {
  app.configure("player", FPS, LOOP, DEFAULT_SCENE);
  while (true) {
    app.pump("player");
    sys.stepWait();
  }
}
`;

export const CHARTS_SOURCE = `// 图表工作台程序（内核启动）
var TRANSITION = 0.35;
var SERIES_LIMIT = 6;
var BAR_GAP = 0.18;
var LINE_WIDTH = 2;
var DEFAULT_TYPE = "bar";

function main() {
  app.configure("charts", TRANSITION, SERIES_LIMIT, BAR_GAP, LINE_WIDTH, DEFAULT_TYPE);
  while (true) {
    app.pump("charts");
    sys.stepWait();
  }
}
`;

export const COMPILER_SOURCE = `// NPL 编译器程序。修改后，此后启动/编译的程序按新规则编译。
// 可以加入 PRELUDE 全局定义；关闭 ALLOW_LOOPS 会拒绝带循环的新程序。
var PRELUDE = "";
var ALLOW_LOOPS = true;
var NAME = "nplc 1.0";

function main() {
  compiler.configure(PRELUDE, ALLOW_LOOPS, NAME);
}
`;

export const FLIGHT_SOURCE = `// 24 号机飞控程序 —— 普通程序文件，可在子系统编辑器中修改。
// 接口：flight.sensors() / flight.setControls(collective, pitch, roll, yaw)
var PERIOD = 0.02;
var ALT_GAIN = 0.028;
var ALT_DAMP = 0.026;
var POS_GAIN = 0.0035;
var VEL_DAMP = 0.030;
var YAW_GAIN = 0.35;

function main() {
  flight.bind("N24-controller");
  while (true) {
    var s = flight.sensors();
    if (s == null) {
      sys.wait(0.05);
    } else {
      var col = 0.55 + (s.targetAlt - s.y) * ALT_GAIN - s.vy * ALT_DAMP;
      if (col < 0.05) { col = 0.05; }
      if (col > 0.95) { col = 0.95; }
      var pitch = (s.targetX - s.x) * POS_GAIN - s.vx * VEL_DAMP;
      var roll  = (s.targetZ - s.z) * POS_GAIN - s.vz * VEL_DAMP;
      if (pitch < -0.22) { pitch = -0.22; }
      if (pitch > 0.22) { pitch = 0.22; }
      if (roll < -0.22) { roll = -0.22; }
      if (roll > 0.22) { roll = 0.22; }
      var yawCmd = (s.targetYaw - s.yaw) * YAW_GAIN;
      if (yawCmd < -0.6) { yawCmd = -0.6; }
      if (yawCmd > 0.6) { yawCmd = 0.6; }
      flight.setControls(col, pitch, roll, yawCmd);
    }
    sys.wait(PERIOD);
  }
}
`;

export const COUNTER_SOURCE = `// 累加计算：修改循环次数后重新运行即可观察结果
var n = 0;
var total = 0;
while (n < 20) {
  n = n + 1;
  total = total + n;
  print("累加 " + n + " → " + total);
  sys.wait(0.15);
}
print("完成：1 到 20 的和为 " + total);
`;

export const BURNER_SOURCE = `// 持续计算：循环中不等待、不让出，用于检验抢占式调度
var x = 0;
while (true) {
  x = (x + 1) % 1000000;
}
`;

export const RECEIVER_SOURCE = `// 消息接收
print("接收进程 " + sys.pid() + " 已就绪");
while (true) {
  var m = msg.recv(8);
  if (m == null) {
    print("等待超时，继续等待");
  } else {
    print("收到消息 #" + m.seq + "：" + m.text + "（来自 " + m.from + "）");
  }
}
`;

export const SENDER_SOURCE = `// 消息发送：自动寻找/启动接收进程，然后发送一串消息
var peer = proc.find("message-receiver");
if (peer == 0) {
  peer = sys.spawn("/Programs/消息接收.prog", "message-receiver");
  sys.wait(0.3);
}
print("发送进程 " + sys.pid() + " → 接收进程 " + peer);
var i = 1;
while (i <= 8) {
  var ok = msg.send(peer, { seq: i, text: "来自嵌套系统的第 " + i + " 条消息", from: sys.pid() });
  print("发送 #" + i + " 结果 " + ok);
  sys.wait(0.35);
  i = i + 1;
}
print("发送完毕");
`;

export const MESSENGER_SOURCE = `// 消息联调：启动接收进程，发送 6 条消息并打印结果
var peer = proc.find("message-receiver");
if (peer == 0) {
  peer = sys.spawn("/Programs/消息接收.prog", "message-receiver");
}
print("消息链 " + sys.pid() + " → " + peer);
var i = 1;
while (i <= 6) {
  msg.send(peer, { seq: i, text: "联调消息 " + i, from: sys.pid() });
  print("已发送 " + i);
  sys.wait(0.4);
  i = i + 1;
}
`;

export const HELLO_SOURCE = `// 最小程序：读取本系统时间与文件
print("你好，NESTED OS。系统时间 " + sys.time());
print("当前目录文件：" + fs.list("/"));
var f = fs.read("/Documents/欢迎使用.txt");
if (f != null) {
  print("文档前 40 个字符：" + substr(f, 0, 40));
}
`;

export const SCRIPTS = {
  counter: { name: '累加计算.prog', source: COUNTER_SOURCE },
  burner: { name: '持续计算.prog', source: BURNER_SOURCE },
  receiver: { name: '消息接收.prog', source: RECEIVER_SOURCE },
  sender: { name: '消息发送.prog', source: SENDER_SOURCE },
  messenger: { name: '消息联调.prog', source: MESSENGER_SOURCE },
  hello: { name: '你好.prog', source: HELLO_SOURCE },
};
