// Comprehensive Simplified Chinese User & Developer Manual (accessible from Desktop & Start Menu)

export const MANUAL_SECTIONS = [
  {
    id: 'overview',
    title: '一、系统总览与分层架构',
    body: `叠境操作系统 (Nested OS) 是一个支持任意深度递归嵌套、可编程微内核与实时三维仿真排演的桌面操作系统。

• 根系统 (outer)：运行在主窗口中，提供桌面、文件管理器、电子表格、小组件、基于 Chromium 的真实网页浏览器、文本与程序编辑器、任务管理器、系统设置与操作说明。
• 子系统 (inner-1, inner-2, ...)：从根系统或任意子系统内创建。每个非根系统都是一份运行在父系统承载进程中的真实内核程序 (/Systems/<id>/kernel.ns)，拥有独立的虚拟时钟、进程表、消息队列、VFS 文件系统、桌面窗口管理器与全部应用。
• 宿主边界说明：宿主机仅提供 NScript 字节码执行环境、显示设备（含 Three.js WebGL 2 渲染与 2D 界面绘制）和原始鼠标/键盘事件转发；根系统浏览器标签由 Chromium 直接运行，不纳入子系统虚拟时间、逻辑预算与快照范围；Three.js 图形光栅化绘制本身不计入逻辑指令预算，而场景求值、物理步进、粒子参数计算与显示数据提交均严格计入对应层预算。`
  },
  {
    id: 'nscript',
    title: '二、NScript 程序格式与系统调用接口',
    body: `所有子系统内核、窗口管理器、应用与用户程序均采用 NScript (.ns) 编写。

1. 语言语法要点：
• 变量与函数：let x = 10;  fn add(a, b) { return a + b; }  匿名函数 fn(x) { ... }
• 控制流：if / else、while、for (let i = 0; i < n; i += 1)、break、continue、return
• 数据类型：数字、字符串、布尔、null、数组 [...]、对象 { k: v }、三元运算 a ? b : c、复合赋值 += -= *=
• 常用内置函数：len, push, pop, shift, slice, splice_remove, concat, index_of, substr, char_at, char_code, from_char_code, split, join, trim, upper, lower, replace, keys, has_key, del_key, type_of, to_str, to_num, parse_int, is_nan, clone, json_parse, json_stringify, str_hash, abs, floor, ceil, round, min, max, sqrt, sin, cos, tan, asin, acos, atan2, pow, exp, log, clamp, rand, print_log

2. 常用系统调用 syscall(name, ...args)：
• 时间与进程：time_now()、sleep(ms)、yield()、get_pid()、get_system_info()、spawn(path, args)、kill(pid)、suspend(pid)、resume(pid)、ps()、exit()
• IPC 消息：send_msg(targetPid, data)、recv_msg(timeoutMs)（-1 阻塞等待，0 非阻塞）、peek_msg()
• 文件系统：fs_list(dir)、fs_read(path)、fs_write(path, text)、fs_mkdir(dir)、fs_delete(path, perm)、fs_restore(trashPath)、fs_rename(old, newName)、fs_copy(src, dst)、fs_stat(path)
• 显示与三维：app_submit_ui(winId, ui)、display_3d_load(playerId, res)、display_3d_frame(playerId, frame)、display_3d_fx(playerId, fx)
• 飞控总线：heli_read_sensors(playerId)、heli_write_controls(playerId, { collective, pitch, roll, yaw })
• 编译器：compile_source(src)、rebuild_compiler()`
  },
  {
    id: 'kernel_mod',
    title: '三、内核修改、编译器自举与窗口/应用替换',
    body: `1. 修改直属子系统内核：
• 每个直属子系统的内核源文件保存在其父系统 VFS 的 /Systems/<childId>/kernel.ns。
• 在父系统“任务/进程管理器”中点击该子系统的【编辑内核】(kernel-open)，或在父系统编辑器打开 /Systems/<childId>/kernel.ns：
  - 调度策略：修改 pick_next_process(procs, last_idx) 函数即可改变进程调度顺序。
  - 新增系统调用：在 execute_syscall_now(p, name, args) 中添加 if (name == "my_call") { ... } 分支。
  - 改写消息/文件规则：修改 ipc_send 或 vfs_list / vfs_read / vfs_write。
• 保存文件后在父系统点击【重启子系统】(system-restart)，子系统将重新编译载入新内核并保留已保存文件。若内核存在语法或运行错误，该子系统将显示内核错误提示并停止，父系统与兄弟子系统不受影响。

2. 编译器自编译：
• 编译器源码位于 /System/compiler.ns，可执行字节码为 /System/compiler.bc。
• 在子系统编辑器中打开 /System/compiler.ns 修改编译规则后，点击【保存并重编编译器】，当前编译器将编译新源码生成新版 /System/compiler.bc，之后启动或重启的一切程序均由新版编译器编译。

3. 修改窗口管理与替换应用：
• 窗口次序 (Z_ORDER)、焦点 (wm_assign_focus) 与命中测试 (wm_hit_test) 均在 /System/wm.ns 中实现。
• 文件排序规则位于 /System/files.ns 的 sort_entries()；图表取值与映射位于 /System/chart_draw.ns。修改并重启或重开对应应用后即按新规则工作。`
  },
  {
    id: 'budget_time',
    title: '四、执行预算、配额计量与虚拟时间',
    body: `1. 执行预算 (逻辑工作单位)：
• 每次字节码指令计 1 单位，字符串拼接/比较、数据复制 (clone)、序列化、文件读写拷贝、消息投递、场景载入与显示提交均按实际数据规模计费。
• 父系统总预算逐级拨付到直属子系统（受父系统剩余预算与拨付上限 tasks-grant 共同限制），子系统内的内核自身、所有应用/用户程序与后代承载进程共同竞争本步额度。
• 当系统调用或大数据操作超出本步剩余预算时，保留已完成工作进度（在任务/进程管理器显示“剩余工作”），待后续步取得额度后继续支付，全部完成后方才提交结果。

2. 内存与存储配额：
• 变量、数组、对象、消息队列与已载入的三维几何资源均计入系统内存配额 (tasks-memory)；VFS 文件内容计入存储配额 (tasks-storage)。超出配额将拒绝分配或写盘并给出明确错误反馈。

3. 虚拟时间与单步：
• 子系统虚拟时间 = Σ(父步长 × 本系统时间速率)。调整时间速率不增加逻辑预算。
• 暂停祖先会冻结整棵子树；恢复时保留后代各自原有的暂停状态，不补跑现实暂停时长。
• 对暂停中的直属子系统点击【单步】将精确推进 50 ms (0.05 秒) 逻辑时间步，其后代仍遵守各自的暂停与调速设置。`
  },
  {
    id: 'scene_flight',
    title: '五、三维场景格式 (.scene)、播放器与闭环飞控',
    body: `1. 播放器规格：
• 播放器固定帧率为 30 FPS（逐帧前进推进 1/30 秒 ≈ 0.0333 秒）。
• 支持在子系统文件管理器双击 .scene / .rehearsal 文件打开，或在播放器输入路径打开。
• 视图支持切换：演出镜头 / 跟随镜头 / 自由环绕（左键拖动旋转、滚轮缩放）。点击三维视图中的机身部件可查看名称与损坏状态；排演模式下点击地面可设定目标航点。

2. 最小合法场景写法（一个物体、一盏灯、一台相机）：
{
  "magic": "NSSCENE",
  "version": 1,
  "name": "最小测试场景",
  "duration": 6.0,
  "fps": 30,
  "entities": [
    {
      "id": "box1", "shape": "box", "size": [2, 2, 2], "pos": [0, 1.5, 0],
      "material": { "color": "#facc15", "roughness": 0.4, "metalness": 0.3 },
      "keyframes": [
        { "t": 0.0, "pos": [-3, 1.5, 0], "rot": [0, 0, 0] },
        { "t": 3.0, "pos": [3, 2.5, 0], "rot": [0, 3.14, 0] }
      ]
    }
  ],
  "lights": [{ "id": "sun", "type": "directional", "color": "#ffffff", "intensity": 2.0, "dir": [0.5, 0.8, 0.4] }],
  "cameras": [{ "id": "orbit", "name": "主相机", "pos": [0, 5, 10], "target": [0, 1.5, 0] }]
}

3. 闭环飞行排演与飞控接口：
• 排演中直升机状态随所属系统虚拟时间连续演化，不等待飞控进程。
• 默认飞控程序为 /System/flight_ctrl.ns，也可在编辑器编写新的飞控脚本并在播放器【飞控路径】栏切换加载。
• 飞控循环调用 heli_read_sensors(playerId) 获取 { pos, vel, rot, angVel, altitudeAGL, wind, targetHeading, targetPos, landingRequested, crashed }，计算后调用 heli_write_controls(playerId, { collective, pitch, roll, yaw })。
• 降低预算、并发运行 /Demo/busy_loop.ns 或调高时间速率会延长飞控采样周期，引发姿态发散直至坠毁；及时恢复预算可重新稳定悬停。点击【降落2号坪】可引导飞控飞往并降落于 2 号停机坪。`
  },
  {
    id: 'projection_charts_snap',
    title: '六、跨层投送、实时图表、跨层文件与子树快照',
    body: `1. 跨层窗口投送：
• 播放器与图表工作台窗口右上角提供【投送】按钮 (window-project)，可选择投送到包括根系统 (outer) 在内的任意祖先桌面。
• 职责边界：投送窗口的外框（位置、大小、贴靠、最小化、关闭）由目标祖先桌面管理；应用状态、渲染内容、预算消耗与交互结果始终归属源系统。在投送窗口中的点击、拖拽、键盘操作经跨层接口送回源进程处理。

2. 实时数据可视化（图表工作台）：
• 由 chart_recv.ns（接收）与 chart_draw.ns（绘制）双进程协作。在根系统打开工作簿后，在子系统图表工作台选择工作簿、填写区域（如 A1:D4）、标签列（如 A）与数值列（如 D 或 B,D），点击【连接】。
• 根系统电子表格每次提交编辑、粘贴、撤销/重做并完成公式重算后发布新版本；若目标子树已暂停，更新将在范围外按序暂存，恢复后交付处理。

3. 跨层文件拖放与本机导入导出：
• 可直接从任意层文件管理器按住文件拖过嵌套边界投放到另一层或兄弟实例的文件管理器目录中。
• 支持在文件管理器中使用本机导出/导入按钮将文件或快照保存到宿主机并重新导入。

4. 排演记录 vs 子树快照：
• 排演记录 (.rehearsal) 保存场景资源与实际控制/输入时序，重开后可跳转到任意时间点回放或从该处继续分叉排演。
• 子树快照 (.snap) 在父系统创建并保存所选直属子系统及其全部后代在统一逻辑时点的完整运行状态（包含内核、进程、变量、PC、未完成工作、消息队列、VFS、桌面、播放器与图表状态），支持原位恢复、分叉为新子树及导出/重启后导入恢复。快照恢复后，图表进入“已恢复，待重新连接”状态。`
  }
];
