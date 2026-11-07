'use strict';
// 系统内程序源文件（全部为同一种自定义程序格式，可在编辑器中查看、修改、保存、重新编译运行）。
// 内核程序存放在父系统文件系统中；编译器、飞控、示例程序都随项目交付。

const COMPILER = `# compiler.prog — 程序编译器（系统内的程序，可修改并编译自身）
# 输入: args.path；输出: out 一条降低后的程序文本（去注释、解析标签到行号）
dev arg -> a
set path = get(a, "path")
dev disk_read path -> text
if get(text, "__err") == null goto c_ok
out "# 编译失败: 源文件不存在"
goto done
label c_ok
set lines = split(text, "\\n")
set labels = {}
set kept = []
set i = 0
set n = len(lines)
label p1
if i >= n goto p2
set ln = trim(get(lines, i))
if ln == "" goto p1n
if find(ln, "#") == 0 goto p1n
set w = words(ln)
if get(w, 0) != "label" goto keep1
seti labels get(w, 1) len(kept)
goto p1n
label keep1
push kept ln
label p1n
set i = i + 1
goto p1
label p2
set ks = keys(labels)
set j = 0
label p2l
if j >= len(ks) goto emit
set name = get(ks, j)
set dest = get(labels, name)
set from = cat("goto ", name)
set to = cat("goto ", str(dest))
set k = 0
label p2k
if k >= len(kept) goto p2n
set ln = get(kept, k)
seti kept k gotosub(ln, from, to)
set k = k + 1
goto p2k
label p2n
set j = j + 1
goto p2l
label emit
set res = join(kept, "\\n")
out res
label done
end
`;

// 内核程序：进程表、轮转调度、等待与唤醒、消息投递、文件系统与系统调用分发、直属子系统拨付。
// 可调参数：Q 时间片、GRANTDIV 子实例分额分母、MSGDROP 未知目标投递、READONLY 文件只读。
const KERNEL = `# kernel.prog — 子系统内核（父系统文件系统中的普通程序文件）
# 修改下列参数并重启本实例，可改变调度策略、消息规则与文件行为；其它实例不受影响。
set Q = 24
set GRANTDIV = 1
set MSGDROP = 0
set READONLY = 0
set CHILDSHARE = 0.55
set first = 1
set procs = {}
set rr = 0
label loop
dev take_requests -> reqs
set ri = 0
label reqloop
if ri >= len(reqs) goto reqdone
set rq = get(reqs, ri)
dev compile get(rq, "path") -> code
if get(code, "__err") == null goto reqok
dev fail get(rq, "replyTo") get(code, "__err") -> _
goto reqnext
label reqok
dev cpu_spawn code get(rq, "args") -> np
seti procs np 1
dev resolve get(rq, "replyTo") np -> _
label reqnext
set ri = ri + 1
goto reqloop
label reqdone
if first == 0 goto work
set first = 0
goto children
label work
dev budget -> b
if b <= 2 goto finish
dev procs_snapshot -> ps
set ids = keys(ps)
set n = len(ids)
if n == 0 goto finish
set k = 0
label pick
if k >= n goto finish
set idx = (rr + k) % n
set pid = get(ids, idx)
set s = get(ps, pid)
set st = get(s, "status")
if st == "ready" goto run
if st == "suspended" goto next
if st == "ended" goto next
if st == "error" goto next
if st != "wait" goto next
set wk = get(s, "waitKind")
if wk == "recv" goto chkrecv
if wk != "sleep" goto next
dev time -> now
if now < get(s, "waitUntil") goto next
dev wake pid -> w
goto next
label chkrecv
if get(s, "inboxLen") <= 0 goto next
dev wake_recv pid -> w
label next
set k = k + 1
goto pick
label run
set q = get(s, "quota")
if q > 0 goto runstep
set q = Q
label runstep
dev cpu_step pid q -> used
set rr = (idx + 1) % n
label traps
dev pull_trap -> t
if t == null goto loop
set tn = get(t, "name")
set tp = get(t, "pid")
set ta = get(t, "args")
if tn == "time" goto s_time
if tn == "self" goto s_self
if tn == "sleep" goto s_sleep
if tn == "spawn" goto s_spawn
if tn == "kill" goto s_kill
if tn == "send" goto s_send
if tn == "recv" goto s_recv
if tn == "fread" goto s_fread
if tn == "fwrite" goto s_fwrite
if tn == "flist" goto s_flist
if tn == "fdel" goto s_fdel
if tn == "draw" goto s_draw
if tn == "app_tick" goto s_tick
if tn == "quota" goto s_quota
dev misc tn ta tp -> mr
if get(mr, "__err") == null goto miscok
dev fail tp get(mr, "__err") -> _
goto traps
label miscok
dev resolve tp get(mr, "value") -> _
goto traps
label s_time
dev time -> v
dev resolve tp v -> _
goto traps
label s_self
dev resolve tp tp -> _
goto traps
label s_sleep
dev hold tp get(ta, 0) -> _
goto traps
label s_spawn
dev compile get(ta, 0) -> code
if get(code, "__err") == null goto spok
dev fail tp get(code, "__err") -> _
goto traps
label spok
dev cpu_spawn code get(ta, 1) -> np
seti procs np 1
dev resolve tp np -> _
goto traps
label s_kill
dev cpu_kill get(ta, 0) -> _
del procs get(ta, 0)
dev resolve tp 1 -> _
goto traps
label s_send
set tgt = get(ta, 0)
if has(ps, tgt) goto sendok
if MSGDROP == 1 goto sendfail
dev fail tp "目标进程不存在" -> _
goto traps
label sendfail
dev resolve tp 0 -> _
goto traps
label sendok
dev inbox_push tgt get(ta, 1) -> _
dev resolve tp 1 -> _
goto traps
label s_recv
dev hold_recv tp -> _
goto traps
label s_fread
dev disk_read get(ta, 0) -> c
if get(c, "__err") == null goto frok
dev fail tp get(c, "__err") -> _
goto traps
label frok
dev resolve tp c -> _
goto traps
label s_fwrite
if READONLY == 1 goto fwro
dev disk_usage -> du
dev storage_cap -> cap
if du + len(get(ta, 1)) <= cap goto fwok
dev fail tp "存储配额不足" -> _
goto traps
label fwro
dev fail tp "文件系统只读（内核策略）" -> _
goto traps
label fwok
dev disk_write get(ta, 0) get(ta, 1) -> ok
dev resolve tp ok -> _
goto traps
label s_flist
dev disk_list get(ta, 0) -> l
dev resolve tp l -> _
goto traps
label s_fdel
dev disk_delete get(ta, 0) -> ok
dev resolve tp ok -> _
goto traps
label s_draw
dev display tp get(ta, 0) -> ok
dev resolve tp ok -> _
goto traps
label s_tick
dev app_tick tp get(ta, 0) -> r
dev resolve tp r -> _
goto traps
label s_quota
dev set_quota tp get(ta, 0) -> _
dev resolve tp 1 -> _
goto traps
label children
dev child_ids -> cids
set ci = 0
set cn = len(cids)
label cloop
if ci >= cn goto chdone
dev budget -> b
if b <= 1 goto chdone
set cid = get(cids, ci)
dev child_grant cid -> g
set remain = cn - ci
set give = b * CHILDSHARE / remain / GRANTDIV
if give > g goto give1
goto give2
label give1
set give = g
label give2
if give < 1 goto give3
goto give4
label give3
set give = 1
label give4
dev run_child cid give -> used
set ci = ci + 1
goto cloop
label chdone
goto work
label finish
set first = 1
yield
goto loop
`;

const APP_LOOP = `# app_loop.prog — 应用驱动进程（由内核启动）
label loop
sys app_tick get(args, "appId") -> r
sys sleep 0.1 -> _
goto loop
`;

const ACCUMULATE = `# accumulate.prog — 累加计算示例（可修改循环次数）
set sum = 0
set i = 0
set limit = 40
label loop
if i >= limit goto done
set sum = sum + i
set i = i + 1
goto loop
label done
out cat("累加结果 = ", str(sum))
sys fwrite "/Programs/accumulate.out" cat("sum=", str(sum)) -> ok
end
`;

const SENDER = `# sender.prog — 消息发送示例（修改消息内容与收件人即可运行）
sys self -> me
set target = get(args, "target")
if target != null goto ok
set target = "p2"
label ok
set i = 0
label loop
if i >= 6 goto done
sys send target cat("消息-", str(i)) -> r
out cat("已发送: 消息-", str(i))
set i = i + 1
goto loop
label done
out "发送完成"
end
`;

const RECEIVER = `# receiver.prog — 消息接收示例（等待并按顺序输出）
set i = 0
label loop
if i >= 6 goto done
sys recv -> m
out cat("收到: ", str(m))
set i = i + 1
goto loop
label done
out "接收完成"
end
`;

const WAITPROG = `# wait.prog — 虚拟时间等待与读时示例
sys time -> t0
out cat("开始虚拟时刻 ", str(t0))
sys sleep 1.5 -> _
sys time -> t1
out cat("唤醒虚拟时刻 ", str(t1))
end
`;

const BUSY = `# busy.prog — 持续计算（不主动让出执行权，用于检验调度）
set x = 0
label loop
set x = x + 1
set x = x * 3
if x > 999999999 set x = 1
goto loop
`;

const FILEDEMO = `# filedemo.prog — 文件读写与消息协作示例
sys fwrite "/Documents/from-program.txt" "由自定义程序写入" -> ok
sys fread "/Documents/from-program.txt" -> c
out cat("读回: ", str(c))
sys time -> t
out cat("虚拟时刻: ", str(t))
end
`;

const CONTROLLER = `# controller.prog — 飞控进程（排演中的被控对象保持者）
# 经系统接口读取带时间戳的传感器值，写入总距与舵面；控制量保持到下一次写入。
label loop
sys sensor -> s
set alt = get(s, "alt")
set vy = get(s, "vy")
set pitch = get(s, "pitch")
set roll = get(s, "roll")
set target = get(args, "targetAlt")
set col = 0.52 + (target - alt) * 0.09 - vy * 0.16 - pitch * 0.03
if col > 1 goto colhi
goto collo
label colhi
set col = 1
label collo
if col < 0 goto colneg
goto colok
label colneg
set col = 0
label colok
set cyc = roll * 0.4 + get(s, "vx") * 0.05
sys control col cyc 0 -> _
sys sleep 0.04 -> _
goto loop
`;

const CHART_RECEIVER = `# chart_receiver.prog — 图表数据接收进程（与图表绘制进程经消息协作）
label loop
sys recv -> v
out cat("收到数据版本 ", str(get(v, "version")))
sys send get(args, "chartPid") v -> ok
goto loop
`;

const CHART_DRAW = `# chart_draw.prog — 图表计算与图形提交进程
label loop
sys recv -> v
out cat("绘制版本 ", str(get(v, "version")))
sys draw v -> ok
goto loop
`;

const PLAYER_DRIVER = `# player_driver.prog — 时序进程：按所属系统时间推进播放位置，经消息驱动飞行场景与环境特效进程
label loop
sys app_tick get(args, "appId") -> st
set msg = {}
seti msg "type" "scene"
seti msg "t" get(st, "frameTime")
seti msg "appId" get(args, "appId")
sys send get(args, "flightPid") msg -> ok
sys sleep 0.1 -> _
goto loop
`;

const FLIGHT = `# player_flight.prog — 飞行场景进程：按时序消息计算部件位姿与相机，交给特效进程合成
label loop
sys recv -> m
sys scene_sample get(m, "t") -> frame
seti frame "appId" get(m, "appId")
sys send get(args, "fxPid") frame -> ok
goto loop
`;

const FX = `# player_fx.prog — 环境特效进程：尘土、烟、碎片与火，提交可复制的场景状态
label loop
sys recv -> frame
sys fx_sample get(frame, "t") get(frame, "pose") -> fx
seti frame "fx" fx
seti frame "type" "scene"
sys draw frame -> ok
goto loop
`;

module.exports = {
  COMPILER, KERNEL, APP_LOOP, ACCUMULATE, SENDER, RECEIVER, WAITPROG, BUSY, FILEDEMO,
  CONTROLLER, CHART_RECEIVER, CHART_DRAW, PLAYER_DRIVER, FLIGHT, FX
};
