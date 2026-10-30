# desktop 重启排查收尾（2026-10-31）

- 根因：`runas` 跨账户启动仍会继承嵌套 Windows Job，外层终止会传递到受测宿主；会话自己的 Job 不能解除外层依赖。已用无害探针复现，亦只读确认物理仍在 desktop 持有的可终止 Job 中；机制参见 [Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)。
- 最终保留：`orchestrator/session_runtime.py` 的 runas 增加 `CREATE_BREAKAWAY_FROM_JOB | CREATE_NO_WINDOW`；`orchestrator/supervisor.py` 启动监督增加 `CREATE_BREAKAWAY_FROM_JOB`。仅保留这两处小改动，并将文档字符串改成说明“上层容器 Job 仍可能保留，不保证 desktop 重启安全”。
- 回退及撤下：`E:/Test/_bench/bench.py` 已逐字节恢复接手前版本；新增探针入口和未上线的 WMI 启动器草稿已送回收站，未部署独立启动系统。playbook 的准备与 Agent 说明已恢复，仅总纲补充“作答期间保持 desktop 运行”。未改任何受测侧脚本、题面或数据，未提交 git。
- 验证：旧启动探针随外层关闭退出，显式脱离探针在外层关闭或 TerminateJobObject 后存活，会话自身 close 仍能结束子孙进程；这些只证明可脱离的 Job 层，不能据此保证真实 desktop 重启安全。探针均已清理，最终 `python -m pytest -q orchestrator/tests/test_automation.py` 为 **99 passed, 80 subtests passed（27.99 秒）**。
- 监督已核对 PID、命令行、created 后仅按 PID 重载，现 PID **43700**，心跳正常；物理和 AE 的 host、Job helper、agent 身份与存活状态均保持，未结束、挂起或迁移它们。
- 按用户决定停止后续修复。物理截止 **05:28:27**，03:58 重开的 AE 截止 **05:38:08**；AE 已脱离 desktop 的一层可终止 Job，但仍共享上层应用容器，不能认定完全独立。当前继续保持 desktop 存活；两题均到时前不重启，未执行真实 desktop 重启验证。
