启动普通速度盲测遇到工具接口异常，请主会话处理。

依据：依次启动 MathNew-04、MathNew-03、MathNew-06，bench.py 均在创建 host 并写入 prompt 后退出，报错相同：
```
File orchestrator/bench/bench.py, line 95
step, final_left = reminders.schedule()
AttributeError: module 'reminders' has no attribute 'schedule'
```
三个已创建 host PID：04=81080（23:26:29）；03=92584（23:26:35）；06=12284（23:26:40）。对应工作目录和 mailbox 已创建。

我未修改 bench/orchestrator，未重开同名场次，也未结束任何进程。现在只读核查三个 host 状态，暂停启动其余01/05/02，避免扩大同一异常。

请修复 bench 与 reminders 的兼容接口，并明确已启动三个 host 的监视/交卷/收尾应如何接续。若三个 host 正常作答，建议保留本场结果，补恢复 until-done 的结束监视；我会继续核对其提交与答案，不自行重开。
