// 初始系统内容：文件、程序、内核、工作簿、说明文档
import { SCENE_JSON } from './scene-data.js';

export const GUIDE_MD = `# Nested OS 操作说明

Nested OS 是一个可以反复嵌套的图形操作系统。根系统名为 **outer**，每个子系统按创建顺序命名为
inner-1、inner-2……。每个系统都有自己的虚拟时钟、进程表、消息、文件、桌面和窗口。

## 1. 启动与初始状态

- 启动：在项目根目录执行 \`npm start\`。可附加 \`--data-dir <目录> --width <像素> --height <像素> --remote-debugging-port=19106\`。
- 初次启动显示根系统桌面，不会自动播放演示。所有运行数据写入 \`--data-dir\` 指定的目录，不写回源码目录。
- 桌面、任务栏、开始菜单、窗口、通知和小部件都是真实可操作的。单击图标选中，双击打开；桌面空白处和文件项上可以右键。
- 任务栏左侧是开始按钮与固定应用；中部是运行中的窗口；右侧是通知、免打扰、时钟和预算读数。

## 2. 各层桌面与嵌套

- 每个系统都用 Windows 式的布局：桌面图标、开始菜单、底部任务栏、窗口与系统托盘。
- 打开「系统管理」（桌面图标或开始菜单）可以在任意层创建直属子系统。新建后父桌面出现一个“系统窗口”，
  里面就是子系统的完整桌面，可以继续在其中创建系统，最多 6 层。
- 子系统的这个系统窗口本身就是父系统的一个窗口：可以移动、缩放、最小化、最大化和贴靠。
  关闭前会询问是只关闭窗口（子系统继续运行）还是停止整个子树。
- 每个系统有独立的壁纸、强调色、桌面、窗口、时钟与通知。子系统窗口左上角显示层级与运行状态。
- 管理界面中可对直属子系统执行：暂停、继续、单步（0.1 秒）、调速、重启、关闭、快照、恢复、分叉。
- 暂停会冻结整棵子树（时钟、程序、播放器、图表与窗口内容）；祖先暂停时，后代单独点“继续”也不能越过。
- 单步仅在被管理的直属子系统暂停、且父系统正在运行时可用，一次推进 0.1 秒虚拟时间并覆盖整棵子树。

## 3. 窗口

- 拖动标题栏移动；拖动边缘或四角缩放；双击标题栏切换最大化；把窗口拖到桌面左/右边缘可贴靠半屏。
- 最小化只隐藏窗口，程序继续运行；关闭应用窗口会结束该应用及其协作进程。
- 点击窗口切换焦点；键盘输入只进入当前焦点窗口。每个系统各自维护焦点与遮挡顺序。

## 4. 根系统应用

- **文件管理器**：目录导航、路径栏、文件列表、多选。新建文件/文件夹、复制、粘贴、重命名、删除和打开。
  删除进入回收站，可恢复或清空。文件按扩展名打开：\`.sheet\` 电子表格、\`.nest\` 编辑器、\`.scene\`/\`.flight\` 播放器。
- **电子表格**：单工作表，带行列标题、单元格/区域选择、编辑、复制粘贴、撤销重做。公式支持
  四则运算、括号、单元格/区域引用与 \`SUM\`，依赖变化自动重算；\`#DIV/0!\`、\`#REF!\`、\`#VALUE!\`、\`#CYCLE!\` 有提示。
  文件格式为 JSON（扩展名 \`.sheet\`），保存内容、公式与基础格式。未保存时文件名旁显示黄点，关闭前可保存/放弃/取消。
- **桌面小组件**：时钟与日历、倒计时、秒表、便笺、剪贴板历史、通知中心、快捷设置。数据属于根系统并会保留。
- **文本与程序编辑器**：打开/保存文本与 \`.nest\` 程序，支持行号、运行程序和编辑子系统内核源文件。
- **任务管理器**：查看应用、自定义进程、直属子系统承载进程；显示状态、逻辑工作量、剩余工作、内存、消息与错误；
  可挂起/继续/结束进程，调整本系统总预算、内存/存储配额、进程额度和子系统拨付上限。
- **设置**：系统名称、壁纸、强调色、界面缩放、免打扰。修改立即生效并保存。
- **浏览器**：内置 Chromium（Electron \`webview\`），支持真实联网、标签、前进后退、刷新、停止与站内交互。
  网页视图随窗口移动、缩放、裁剪和被遮挡；最小化时隐藏。关闭浏览器或结束其进程会释放网页视图。
- **系统管理**、**操作说明** 可从桌面和开始菜单打开。

## 5. 子系统应用

每个非根系统提供：三维场景播放器、图表工作台、文件管理器、程序编辑器、进程管理器和系统管理。
播放器与图表工作台都支持把可交互视图投送到任一祖先桌面。

## 6. 三维播放器与场景

- 用「打开场景」选择 \`.scene\` 资源，默认 \`/Demo/helicopter-24.scene\`。场景是纯数据 JSON：
  环境、几何部件、材质、灯光、演出镜头、关键帧时序都在文件里，播放器源码不含 24 号直升机的形状。
- 控制：播放/暂停/停止/重播、逐帧（1/60 秒）、循环、进度条跳转、时间输入、速率 0.25×–4×。
  播放位置由播放器进程按系统虚拟时间推进，播放速率与系统时间速率共同生效。
- 镜头：演出镜头、跟随镜头与自由环绕。自由镜头可拖动旋转、滚轮缩放。点击机体显示部件名称与损坏状态。
- 默认演出为资源里的 15 秒飞行记录：停机启动 → 起飞 → 飞行 → 失控下坠 → 撞击与烟尘余波。
- 播放器由内核启动的三个进程协作：时序进程（player）、飞行场景进程、环境特效进程（由场景采样服务驱动）。
  挂起某个进程会停止它负责的更新；暂停整个系统则整段画面冻结。

### 6.1 场景资源格式（最小场景）

\`\`\`json
{
  "format": "nested-scene", "version": 1, "name": "最小场景", "duration": 5,
  "environment": { "skyTop": "#0a1638", "skyBottom": "#3a4c72", "sun": [-30, 50, 20],
    "pads": [{ "x": 0, "z": 0, "y": 0, "radius": 8 }] },
  "model": {
    "materials": { "body": { "color": "#7c4dd6", "roughness": 0.5, "metalness": 0.3 } },
    "parts": [
      { "name": "机身", "type": "ellipsoid", "geometry": [1, 0.8, 2], "material": "body",
        "pos": [0, 1.5, 0], "rot": [0, 0, 0] }
    ]
  },
  "cameras": { "shots": [{ "id": "main", "pos": [8, 5, 12], "look": [0, 2, 0] }] },
  "timeline": {
    "heli": [{ "t": 0, "pos": [0, 0, 0], "rot": [0, 0, 0] }],
    "rotor": [{ "t": 0, "speed": 0 }],
    "shots": [{ "t": 0, "shot": "main" }]
  }
}
\`\`\`

支持的部件类型：\`box\`、\`ellipsoid\`、\`cylinder\`、\`cone\`、\`blade\`、\`skid\`、\`decal\`。
材质字段：\`color\`、\`roughness\`、\`metalness\`、\`opacity\`、\`emissive\`。修改资源后重新打开即可看到变化。

## 7. 飞行排演

- 播放器底部点击「进入排演」，从当前演出位置接管为可操控的飞控对象。排演中可调整风速、目标航向和故障触发；
  点击地面可把落点方向设为当前目标航向。
- 直升机是不稳定被控对象，没有控制输入会失去姿态。保持飞行的是子系统里的飞控进程：
  \`/System/programs/controller.nest\`，它是普通巢语程序，可在编辑器修改，重启该子系统或重载飞控后生效。
- 飞控服务接口：\`sys("sensor")\` 返回带时间戳的传感器对象；\`sys("set_control", 总距, 纵向, 横向, 脚舵)\` 写入控制量；
  \`sys("wait", 毫秒)\` 等待下一次控制周期；\`sys("log", 文本)\` 写入控制台。控制量保持到下一次写入，错过的周期不补发。
- 预算、调度与时间速率实际影响飞行：降低任一祖先的拨付、运行持续计算或提高速率，控制周期变长，姿态会抖动、发散直至坠毁；
  及时恢复可以拉回。物理计算落后时画面停在算完的时刻，补算按虚拟时间进行，不会变成慢动作。
- 飞行记录保存为 \`.flight\` 文件，包含场景、初态、实际输入与实际控制时序。可以跳转、回放、从任意位置续演并另存，
  回放结果不随当前预算变化。系统完整快照（\`.snap\`）则保存整棵子树。

## 8. 图表与实时数据

- 图表工作台先选择根系统已打开的工作簿、矩形区域（如 \`A1:D4\`）、标签列（A）与数值列（D，可用逗号分隔多列），
  再点「连接」。连接先取得当前完整值，之后每次提交/粘贴/撤销/重做并完成重算，都会发布完整选区新版本。
- 图表进程通过消息接收版本，处理数据并绘制。支持分组柱状图与折线图切换、标题、坐标轴、图例、数据值与悬停提示。
- 暂停子系统或其祖先时，根表格照常编辑，更新在范围外按序暂存；继续后按序处理，最终对应最新版本。
- 断开连接后保留最后图表与数据；关闭源工作簿会提示数据源已关闭；重新打开工作簿后需要重新选择连接。

## 9. 窗口投送

- 播放器或图表窗口标题栏上的「投送」按钮可选择任一祖先桌面（可跨层直达根桌面）。目标桌面创建投送窗口，
  可移动、缩放、贴靠、最小化和关闭；源窗口保留。
- 投送外框属于目标桌面；应用状态、计算、输入处理都属于源系统。投送视图与源视图显示同一状态，不同尺寸各自取景。
- 投送控件上的操作会通过接口送入源应用消息队列；一次输入只执行一次。暂停源系统或其祖先时内容冻结、控件禁用并提示原因。
- 关闭投送只取消该视图；关闭源窗口/结束应用/停止子树时，对应投送结束并提示。每个源窗口至多一个投送窗口，重复投送聚焦已有窗口。

## 10. 资源、预算与计量

- 每个系统每 50 毫秒（墙钟）取得一个逻辑步预算，进程额度是上限而不是额外预算。所有进程、系统服务、内核和直属子系统
  共享同一份预算，并按实际工作量计费：VM 指令、文件处理、公式重算、图表计算、场景取样和显示提交都计费。
- 预算逐级拨付：子系统实际可用预算 ≤ 父系统实际拨付，且 ≤ 自身配置。兄弟子树共享父系统剩余预算，深层份额更小。
- 调高时间速率、增加实例、打开窗口或投送视图都不会增加预算。预算不足时未完成工作保留，在后续获得额度时续行。
- 总预算、内存与存储配额、进程额度、直属子系统拨付上限都在任务/进程管理器中调整并实际生效。
- 内存：进程变量、消息、图表缓存、场景资源与视图缓存计入内存；存储：文件占用存储。配额不足时操作失败并有提示。
- 宿主 Chromium 网页执行与实际屏幕绘制**不计入**自定义逻辑预算；这一边界同样适用于投送绘制。
- 工作量单位是可重复核对的逻辑单位（1 条 VM 指令 = 1 单位；服务按数据规模计费）。

## 11. 程序格式（巢语）与系统接口

\`\`\`text
# 注释
let n = 10
let sum = 0
for (let i = 1; i <= n; i = i + 1) { sum = sum + i }
fn greet(name) { return "你好, " + name }
print(greet("巢语"), sum)
\`\`\`

支持变量、四则运算与比较、布尔、if/else、while/for、函数、数组、对象、字符串、break/continue/return。
系统服务通过 \`sys("名称", 参数...)\` 调用；\`print(...)\` 输出到编辑器控制台。

| 服务 | 说明 |
|---|---|
| \`sys("clock")\` | 本系统虚拟时间（秒） |
| \`sys("wait", 毫秒)\` | 等待指定虚拟时长 |
| \`sys("spawn", 名称, 程序路径)\` | 启动进程（内核使用） |
| \`sys("kill", pid)\` / \`sys("self")\` | 结束进程 / 取得自身身份 |
| \`sys("send", 目标, 值)\` / \`sys("recv", 超时毫秒)\` | 消息发送与接收 |
| \`sys("read", 路径)\` / \`sys("write", 路径, 内容)\` | 读写本系统文件 |
| \`sys("sensor")\` / \`sys("set_control", ...)\` | 飞控传感器 / 控制量 |
| \`sys("submit_scene", ...)\` | 向显示设备提交场景状态 |
| \`sys("compile", 路径, 源)\` | 编译器服务 |

根系统的预置程序在 \`/System/programs\`，子系统的内核在父系统的 \`/System/subsystems/inner-N/kernel.nest\`。
内核是普通巢语程序：进程表、调度次序、额度分配、消息分发、计时唤醒都写在其中。修改内核并重启子系统后生效；
语法错误或运行时错误会让该子系统显示“内核错误”并停止，父系统与兄弟系统不受影响。

## 12. 快照、恢复与分叉

- 系统管理里可以给直属子系统创建快照，保存为父系统文件 \`/Snapshots/*.snap\`：整棵子树的结构、内核与运行位置、
  进程变量、预算与未完成工作、虚拟时间、消息、文件、桌面、应用、播放器与图表状态。
- 恢复只影响选定子树；快照没有覆盖的范围外文件、运行状态与连接保持当前值。分叉会创建新的实例身份并复制整棵子树，之后可独立演化。
- 快照可导出到本机，重启作品后导入。数据连接在恢复后处于“已恢复，待重新连接”，重新连接会取得源工作簿当前选区。

## 13. 跨层文件传递

- 文件管理器支持把文件拖到任意层（包括兄弟与祖先）文件管理器窗口内。拖动时目标目录高亮，放下后经系统接口复制独立副本。
- 重名时询问覆盖或取消；目标存储配额不足则失败并提示。复制与图表实时订阅是两种不同操作。

## 14. 自动化接口

- 根目录 \`automation.json\` 记录了启动命令、窗口定位、示例素材路径和 \`window.bench\` 接口。
- \`window.bench.version === 1\`；\`ready()\` 在桌面可交互后完成；\`reset()\` 清空实例与当前数据目录中的运行文件并恢复初态；
  \`inspect()\` 返回 systems/windows/browsers/players/charts/projections。
- 关键控件都有稳定的 \`data-testid\`，窗口容器 \`data-app-id\`，并标注所属 \`data-system-id\` / \`data-window-id\`。

## 15. 常用快捷键

- \`Ctrl+S\`：在编辑器中保存；在电子表格中保存工作簿。
- \`F2\`：电子表格编辑单元格；\`Enter\` 提交并下移；\`Tab\` 右移；方向键移动选区；\`Delete\` 清除。
- \`Esc\`：关闭菜单/弹窗；\`Alt+Tab\` 本系统内切换窗口（可选）。
`;

export const PROGRAMS = {
  'hello.nest': `# 你好，巢语
print("你好，这是一个可编辑、可运行的巢语程序。")
let t = sys("clock")
print("当前系统时间：", t, " 秒")
`,
  'accumulator.nest': `# 累加计算：计算 1..n 的和
# 可在编辑器中修改 n，再点“运行”
let n = 100
let i = 1
let sum = 0
while (i <= n) {
  sum = sum + i
  i = i + 1
}
print("1..", n, " 的和 =", sum)
`,
  'message-sender.nest': `# 消息发送程序
# 与 message-receiver.nest 一起运行以观察消息通信
let i = 1
while (i <= 5) {
  let reply = sys("send", "message-receiver", "消息 #" + i + "，来自发送进程")
  print("发送第 ", i, " 条 => ", reply)
  i = i + 1
  sys("wait", 80)
}
print("发送完毕")
`,
  'message-receiver.nest': `# 消息接收程序
# 在另一个窗口中运行，等待并打印消息
let count = 0
while (count < 5) {
  let m = sys("recv", 800)
  if (m != null) {
    count = count + 1
    print("收到第 ", count, " 条：", m)
  } else {
    print("等待消息…")
  }
}
print("接收完毕")
`,
  'busy-loop.nest': `# 持续计算程序：循环中不让出执行权，用于检验调度
# 运行后打开任务管理器，观察它持续消耗预算而其他进程仍有执行机会
let x = 7
let n = 0
while (true) {
  x = (x * 31 + 17) % 1000003
  n = n + 1
  if (n % 50000 == 0) {
    print("已执行 ", n, " 次，x = ", x)
  }
}
`,
  'wm.nest': `# 窗口管理进程：从输入队列取样，处理焦点与命中
# 由内核启动；等待时间影响界面响应与工作量
while (true) {
  let n = sys("wm_pump", 8)
  if (n == 0) { sys("wait", 24) }
}
`,
  'files.nest': `# 文件管理器服务进程：处理文件操作队列
while (true) {
  sys("files_service")
  sys("wait", 40)
}
`,
  'player.nest': `# 三维播放器进程：按本系统虚拟时间推进播放位置并提交场景取样
# 播放控制、逐帧、跳转与排演物理都由这里（以及场景/特效服务）驱动
while (true) {
  sys("player_service")
  sys("wait", 8)
}
`,
  'charts.nest': `# 图表工作台进程：从消息队列接收数据版本，计算并提交图形
while (true) {
  sys("chart_service")
  sys("wait", 12)
}
`,
  'datafeed.nest': `# 数据接收进程：从根系统实时数据连接接收版本，转换为图表数据并投递给绘图进程
while (true) {
  sys("datafeed_service")
  sys("wait", 16)
}
`,
  'scene.nest': `# 飞行场景进程：按系统虚拟时间取样直线演出，或积分排演物理
# 与播放器（时序）、环境特效进程协作，三者职责分离
while (true) {
  sys("scene_service")
  sys("wait", 8)
}
`,
  'effects.nest': `# 环境特效进程：计算下洗尘土、烟气、火光与碎片轨迹
while (true) {
  sys("effects_service")
  sys("wait", 12)
}
`,
};

export const CONTROLLER_SOURCE = `# 24 号直升机飞控程序（可在编辑器中修改）
# 接口：sys("sensor") 读取带时间戳的传感器状态；
#       sys("set_control", 总距, 纵向周期变距, 横向周期变距, 脚舵) 写入控制量；
#       sys("log", 文本) 输出日志。
# 直升机是不稳定对象，控制周期受系统预算与调度影响，错过周期不补发。

let logTick = 0

while (true) {
  let s = sys("sensor")
  if (s.active != 1) {
    # 未在排演时不消耗控制周期
    sys("wait", 180)
  } else {
    let targetAlt = 16
    let hdgTarget = s.targetHeading
    let pitchCmd = (0 - s.pitch) * 0.090 - s.rateP * 0.026 + s.vF * 0.010
    let rollCmd = (0 - s.roll) * 0.090 - s.rateR * 0.026 + s.vR * 0.010

    # 请求降落到 B 停机坪：先转向、再接近，最后阶段下降
    if (s.landing == 1) {
      hdgTarget = s.padBearing
      if (s.padDistance < 9) { targetAlt = 1.2 } else { targetAlt = 16 }
      let herr = s.padBearing - s.heading
      if (herr > 180) { herr = herr - 360 }
      if (herr < -180) { herr = herr + 360 }
      if (s.padDistance > 8 && herr > -35 && herr < 35) {
        # 目标前向速度；通过期望俯仰角产生加速度，接近时反向制动
        let want = clamp(s.padDistance * 0.55, 3, 11)
        let desiredPitch = clamp((want - s.vF) * -2.2, -15, 9)
        pitchCmd = (desiredPitch - s.pitch) * 0.055 - s.rateP * 0.028
      }
    }

    # 高度保持：总距
    let collective = 0.53 + (targetAlt - s.alt) * 0.015 - s.vy * 0.045

    # 航向保持：脚舵
    let err = hdgTarget - s.heading
    if (err > 180) { err = err - 360 }
    if (err < -180) { err = err + 360 }
    let pedal = clamp(err * 0.012 - s.rateY * 0.06, -0.65, 0.65)

    sys("set_control", clamp(collective, 0.18, 0.96),
        clamp(pitchCmd, -0.62, 0.62), clamp(rollCmd, -0.62, 0.62), pedal)

    logTick = logTick + 1
    if (logTick % 120 == 0) {
      sys("log", "飞控: 高度 " + round(s.alt) + "m 姿态 " + round(s.pitch) + "/" + round(s.roll) + "° 航向 " + round(s.heading) + "°")
    }
  }
  sys("wait", 40)
}
`;

export const COMPILER_SOURCE = `# 巢语编译器外壳（系统程序）
# 内核启动子系统程序时调用本程序提供的编译服务。
# 修改本文件并重启相关系统后，后续启动的程序将按新逻辑编译。
let strict = 1
let optimize = 1

fn compile_program(path, source) {
  let r = sys("compile", path, source, strict)
  if (r.ok == false) {
    print("编译失败 ", path, "：", r.error)
  }
  return r
}

# 编译器也编译自身：读取本文件并验证
let self = sys("read", "/System/compiler.nest")
let selfCheck = compile_program("/System/compiler.nest", self)
if (selfCheck.ok) {
  print("编译器自检通过；严格模式=", strict)
}
`;

export function kernelSource(id, name) {
  return `# ============================================================
# 子系统内核程序 —— ${name} (${id})
# 存放于父系统文件系统：/System/subsystems/${id}/kernel.nest
# 修改本文件后，在父系统「系统管理」中重启该子系统即生效。
# 该程序以巢语编写，由父系统的承载进程执行并受父系统调度。
# ============================================================

let slice = 1600        # 每个进程每次最多执行多少逻辑单位
let turn = 0            # 轮转指针
let booted = 0
let failCount = 0

fn boot() {
  sys("kernel_log", "内核启动：装载程序并建立进程表")
  sys("spawn", "窗口管理", "/System/programs/wm.nest", "wm")
  sys("spawn", "文件管理器", "/System/programs/files.nest", "files")
  sys("spawn", "三维播放器", "/System/programs/player.nest", "player")
  sys("spawn", "飞行场景", "/System/programs/scene.nest", "scene")
  sys("spawn", "环境特效", "/System/programs/effects.nest", "effects")
  sys("spawn", "图表工作台", "/System/programs/charts.nest", "charts")
  sys("spawn", "数据接收", "/System/programs/datafeed.nest", "datafeed")
  sys("spawn", "飞控", "/System/programs/controller.nest", "controller")
  sys("spawn", "编译器", "/System/compiler.nest", "compiler")
  sys("kernel_log", "进程表建立完成")
}

# 首次运行：建立进程表
if (booted == 0) {
  boot()
  booted = 1
}

# 主调度循环：所有工作都在父系统拨付的预算之内
while (true) {
  let grant = sys("begin_step")
  if (grant <= 0) {
    # 本逻辑步已无预算：让出到下一个逻辑步（不退回已拨付额度）
    sys("idle")
  } else {
    let list = sys("ready_list")
    let n = len(list)
    let i = 0
    let remaining = grant
    while (i < n && remaining > 0) {
      let pid = list[(turn + i) % n]
      let q = sys("quota_of", pid)
      if (q > slice) { q = slice }
      if (q > remaining) { q = remaining }
      let used = sys("run_slice", pid, q)
      remaining = remaining - used
      i = i + 1
    }
    turn = turn + n
    let delivered = sys("deliver_messages")
    let woken = sys("wake_timers")
    sys("end_step", grant - remaining)
    # 所有进程都在等待时，本步提前结束
    if (remaining == grant) {
      sys("idle")
    }
  }
}
`;
}

export const SAMPLE_SHEET = {
  format: 'nested-sheet', version: 1,
  name: '示例工作簿', sheet: 'Sheet1',
  cells: {
    A1: { v: '项目', s: { bold: true, fill: 'h' } },
    B1: { v: '数量', s: { bold: true, fill: 'h' } },
    C1: { v: '单价', s: { bold: true, fill: 'h' } },
    D1: { v: '小计', s: { bold: true, fill: 'h' } },
    A2: { v: '项目 A' }, B2: { v: 24 }, C2: { v: 6 }, D2: { v: '=B2*C2' },
    A3: { v: '项目 B' }, B3: { v: 12 }, C3: { v: 8 }, D3: { v: '=B3*C3' },
    A4: { v: '项目 C' }, B4: { v: 18 }, C4: { v: 4 }, D4: { v: '=B4*C4' },
  }
};

export const SAMPLE_SHEET_JSON = JSON.stringify(SAMPLE_SHEET, null, 1);
export const SCENE_TEXT = SCENE_JSON;

const WELCOME = `欢迎来到 Nested OS。

这是一个可以嵌套的图形操作系统：
· 双击桌面「系统管理」可以创建子系统；
· 子系统本身运行在一份内核程序之上，内核位于父系统的 /System/subsystems/ 下；
· 每个系统都有自己的时间、预算、文件、消息、窗口与应用。

打开「操作说明」了解完整的功能、程序格式、内核修改方法与投送/快照规则。
`;

function guideMini(id) {
  return `# 子系统 ${id} 操作速览

1. 桌面图标：三维播放器、图表工作台、文件管理器、编辑器、进程管理器、系统管理。
2. 播放器默认打开 /Demo/helicopter-24.scene。播放、跳转、逐帧都会消耗本系统预算。
3. 图表工作台从根系统已打开的工作簿建立实时连接（选区示例 A1:D4，标签列 A，数值列 D）。
4. 播放器与图表标题栏的「投送」可以把视图送到任意祖先桌面。
5. 进程管理器显示本系统内核、程序与直属子系统承载进程的实际工作量；可暂停/继续/结束进程，调整预算与配额。
6. 内核源文件位于父系统：/System/subsystems/${id}/kernel.nest。在父系统编辑器中修改并重启本系统即生效。
7. 飞控程序：/System/programs/controller.nest，可在本系统编辑器中修改。
`;
}

export function initialFiles(kind, id) {
  const files = {};
  const now = Date.now();
  const dir = (p) => { files[p] = { type: 'dir', created: now }; };
  const file = (p, content, mime = 'text/plain') => {
    files[p] = { type: 'file', content: String(content), mime, created: now, modified: now };
  };
  ['/', '/Documents', '/Downloads', '/Demo', '/System', '/System/programs', '/System/subsystems',
    '/Snapshots', '/Recycle Bin'].forEach(dir);
  if (kind === 'root') {
    file('/Documents/欢迎使用.txt', WELCOME);
    file('/Documents/操作说明.md', GUIDE_MD, 'text/markdown');
    file('/Documents/预算与计量.txt',
      `逻辑工作单位（u）是可重复核对的计量单位：\n1 条巢语 VM 指令 = 1 u；\n场景取样约 40-90 u/次；公式重算按单元格数量计费；文件与图表按字节/数据点规模计费。\n\n根系统每个墙钟逻辑步（50 ms）总预算默认 24000 u，逐级拨付给承载进程。\n调高时间速率、打开更多窗口或投送视图不会增加预算。\nChromium 网页执行与宿主实际绘制不计入此预算。\n`);
    file('/Demo/sample.sheet', SAMPLE_SHEET_JSON, 'application/x-nested-sheet');
    file('/Demo/helicopter-24.scene', SCENE_TEXT, 'application/x-nested-scene');
    file('/System/compiler.nest', COMPILER_SOURCE);
    for (const [name, src] of Object.entries(PROGRAMS)) {
      if (['wm.nest', 'files.nest', 'player.nest', 'charts.nest'].includes(name)) continue;
      file('/System/programs/' + name, src);
    }
  } else {
    file('/Documents/欢迎.txt', `这是子系统 ${id}。\n\n它由父系统文件系统中的内核程序运行，拥有独立的时钟、进程表、文件、桌面与预算。\n${guideMini(id)}`);
    file('/Documents/操作说明.md', guideMini(id), 'text/markdown');
    file('/Demo/helicopter-24.scene', SCENE_TEXT, 'application/x-nested-scene');
    file('/Demo/sample.sheet', SAMPLE_SHEET_JSON, 'application/x-nested-sheet');
    file('/System/compiler.nest', COMPILER_SOURCE);
    for (const [name, src] of Object.entries(PROGRAMS)) {
      file('/System/programs/' + name, src);
    }
    file('/System/programs/controller.nest', CONTROLLER_SOURCE);
  }
  return files;
}

export function newWidgets() {
  return {
    open: false, section: 'all',
    calendar: { offset: 0, selected: null },
    timer: { duration: 300, remaining: 300, running: false, endAt: null, lastStarted: null },
    stopwatch: { running: false, startedAt: null, elapsed: 0, laps: [] },
    notes: [{ id: 'n1', text: '欢迎使用 Nested OS 便笺。\n双击桌面图标即可开始。', created: 0 }],
    dnd: false,
  };
}
