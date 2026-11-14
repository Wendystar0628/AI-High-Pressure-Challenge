// Demo & Test User Programs + Minimal Scene Resource Example

export const DEMO_CALC_NS_SOURCE = `// ============================================================================
// 示例程序：可控累加计算 (/Demo/calc_loop.ns)
// 说明：按循环次数执行累加计算，期间主动休眠让出时间片，可在编辑器修改次数与步长。
// ============================================================================

let ITERATIONS = 20;
let STEP_SLEEP_MS = 120;
let total = 0;

print_log("开始累加计算，循环次数 =", ITERATIONS);
for (let i = 1; i <= ITERATIONS; i += 1) {
  total += i * i;
  print_log("step", i, "平方和 =", total, "虚拟时钟(ms) =", round(syscall("time_now")));
  syscall("sleep", STEP_SLEEP_MS);
}
print_log("累加计算完成，最终结果 =", total);
return total;
`;

export const DEMO_BUSY_NS_SOURCE = `// ============================================================================
// 示例程序：持续计算循环 (/Demo/busy_loop.ns)
// 说明：在循环中不主动等待或让出执行权，用于验证抢占调度与预算竞争！
// 启动本程序后，受同一预算池约束的进程与子系统会共享额度，但不会卡死系统控制。
// ============================================================================

let count = 0;
let acc = 0;
print_log("持续计算进程已启动（不主动让出 CPU）");

while (true) {
  count += 1;
  acc = (acc + count * 17) % 1000003;
  if (count % 500 == 0) {
    print_log("busy iterations =", count, "acc =", acc);
  }
}
`;

export const DEMO_MSG_RECEIVER_NS_SOURCE = `// ============================================================================
// 示例程序：IPC 消息接收方 (/Demo/msg_receiver.ns)
// 说明：先运行本程序获取其 PID，再修改并运行 msg_sender.ns 向该 PID 发消息。
// ============================================================================

let my_pid = syscall("get_pid");
print_log("消息接收方已就绪，我的 PID =", my_pid);
print_log("等待来自其他进程的消息...");

let received = 0;
while (received < 10) {
  let msg = syscall("recv_msg", -1);
  received += 1;
  print_log("收到消息 #" + to_str(received), "来自 PID", msg.from, "内容 =", msg.data, "时间戳 =", round(msg.timestamp));
}
print_log("接收演示完成");
`;

export const DEMO_MSG_SENDER_NS_SOURCE = `// ============================================================================
// 示例程序：IPC 消息发送方 (/Demo/msg_sender.ns)
// 说明：将 TARGET_PID 改为正在运行的 msg_receiver.ns 的 PID，可修改消息内容与数量。
// ============================================================================

let TARGET_PID = 3; // 请按进程管理器中 msg_receiver.ns 的实际 PID 修改
let MSG_COUNT = 5;
let PREFIX = "NestedMsg";

let my_pid = syscall("get_pid");
print_log("发送方 PID =", my_pid, "目标 PID =", TARGET_PID);

for (let i = 1; i <= MSG_COUNT; i += 1) {
  let payload = { seq: i, text: PREFIX + "-" + to_str(i), sender: my_pid };
  let res = syscall("send_msg", TARGET_PID, payload);
  print_log("发送 #" + to_str(i), res.ok ? "成功" : ("失败: " + res.error));
  syscall("sleep", 80);
}
print_log("消息发送完成");
`;

export const MINIMAL_SCENE_EXAMPLE = `{
  "magic": "NSSCENE",
  "version": 1,
  "name": "最小合法三维场景示例",
  "duration": 6.0,
  "fps": 30,
  "environment": {
    "skyTop": "#0f172a",
    "skyHorizon": "#334155",
    "fogColor": "#1e293b",
    "fogDensity": 0.005,
    "ambientColor": "#94a3b8",
    "ambientIntensity": 0.6
  },
  "entities": [
    {
      "id": "cube_1",
      "name": "测试立方体",
      "shape": "box",
      "size": [2.2, 2.2, 2.2],
      "pos": [0, 1.5, 0],
      "rot": [0, 0, 0],
      "material": { "color": "#facc15", "roughness": 0.35, "metalness": 0.4 },
      "keyframes": [
        { "t": 0.0, "pos": [-4, 1.5, 0], "rot": [0, 0, 0] },
        { "t": 3.0, "pos": [4, 3.2, 0], "rot": [0.5, 3.14, 0] },
        { "t": 6.0, "pos": [-4, 1.5, 0], "rot": [0, 6.28, 0] }
      ]
    }
  ],
  "lights": [
    { "id": "key", "type": "directional", "color": "#ffffff", "intensity": 2.2, "dir": [0.6, 0.8, 0.4], "shadow": true }
  ],
  "cameras": [
    { "id": "orbit", "name": "主相机", "pos": [0, 6, 12], "target": [0, 1.5, 0] }
  ]
}`;
