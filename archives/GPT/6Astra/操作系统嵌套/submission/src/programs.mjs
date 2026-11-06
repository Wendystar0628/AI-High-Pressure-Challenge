export const KERNEL=`# NEST kernel 1.0 — 父系统中的普通程序文件
# 调整 quantum / policy / messageMode，保存后重启子系统
set quantum 512
set policy "round-robin"
set messageMode "fifo"
set cursor -1
loop:
sys tasks process.list null
if len(tasks) == 0 goto loop
set cursor (cursor + 1) % len(tasks)
set target tasks[policy == "reverse" ? len(tasks)-1-cursor : cursor]
sys info process.info target
if info.state == "suspended" goto loop
if info.state == "ended" goto loop
if info.state == "error" goto loop
if info.state != "waiting" goto execute
if info.pending goto dispatch
if info.wake > time goto loop
if info.waitMessage && info.messages == 0 goto loop
sys wake process.wake target
execute:
sys spent process.execute {id:target,quantum:quantum}
dispatch:
sys request process.request target
if !request goto loop
if request.service == "message.send" goto message
if request.service == "file.read" goto read
if request.service == "file.write" goto write
if request.service == "process.start" goto start
if request.service == "process.end" goto end
sys result service.dispatch request
if result.deferred goto loop
goto reply
message:
sys exists process.exists request.args.to
if !exists goto missing
sys result mailbox.push {to:request.args.to,from:target,value:request.args.value,mode:messageMode}
goto reply
missing:
set result {ok:false,error:"目标进程不存在或已结束"}
goto reply
read:
sys result storage.read request.args
goto reply
write:
sys quota storage.available null
sys previous storage.size request.args.path
set quota quota+previous
if len(request.args.content)*2 > quota goto full
sys result storage.write request.args
goto reply
full:
set result {ok:false,error:"存储配额不足"}
goto reply
start:
sys result executable.load request.args
goto reply
end:
sys result process.terminate request.args
reply:
sys completed request.complete {id:target,requestId:request.requestId,value:result}
goto loop
`;
export const APP=`# 应用输入服务。每个窗口的程序拥有独立消息队列。
set caption "层界应用"
set accent "default"
sys configured display.configure {caption:caption,accent:accent}
loop:
receive input
sys result app.dispatch input
goto loop
`;
export const WINDOW_MANAGER=`# 窗口管理程序：顺序接收输入，决定焦点与堆叠顺序。
set focusPolicy "raise"
loop:
receive event
if event.type == "input" goto input
if event.type == "geometry" goto geometry
if event.type != "focus" goto loop
sys win window.read event.windowId
if !win goto loop
sys top window.stack null
if focusPolicy != "raise" goto loop
sys result window.write {id:event.windowId,patch:{z:top+1},focus:true}
goto loop
geometry:
sys result window.write {id:event.windowId,patch:event.geometry,focus:false}
goto loop
input:
sys win window.read event.windowId
if !win goto loop
sys delivered message.send {to:win.processId,value:event.value}
goto loop
`;
export const FILES=`# 文件管理器的复制写入在此程序中逐个执行。
# 修改复制顺序、内容或冲突行为后，重新打开文件管理器生效。
loop:
receive input
if input.type != "files" goto dispatch
if input.action != "transfer" goto dispatch
set i 0
copy:
if i >= len(input.entries) goto complete
set item input.entries[i]
sys result file.write {path:item.path,content:item.content}
if !result.ok goto failed
sys metadata file.attributes {path:item.path,type:item.type}
set i i+1
goto copy
complete:
sys result app.dispatch {type:"files",action:"complete",sourceId:input.sourceId,sourcePaths:input.sourcePaths,cut:input.cut,notice:input.notice}
goto loop
failed:
sys result notification result.error
goto loop
dispatch:
sys result app.dispatch input
goto loop
`;
export const PLAYER=`# 时序进程：时间推进通过消息交给场景与特效进程。
loop:
sys frame player.advance {now:time}
wait 25
goto loop
`;
export const SCENE=`# 飞行场景进程：取样资源与物理状态，提交可复制场景。
loop:
receive frame
sys result scene.sample frame
goto loop
`;
export const EFFECTS=`# 环境特效进程：与机体使用同一时序消息。
loop:
receive frame
sys result effects.sample frame
goto loop
`;
export const FLIGHT=`# 飞控程序。sensor: y,vy,x,vx,roll,rollRate,targetX,targetY,stamp
# 闭环控制量保持至下一次写入；挂起控制进程不会挂起物理进程。
loop:
sys sensor flight.sensor null
set lift (9.81 + (sensor.targetY-sensor.y)*2.4 - sensor.vy*3.2) / max(0.5,cos(sensor.roll)*cos(sensor.pitch))
set targetBank max(-0.22,min(0.22,((sensor.targetX-sensor.x)*0.25-sensor.vx*0.9)/9.81))
set targetPitch max(-0.22,min(0.22,((sensor.targetZ-sensor.z)*0.25-sensor.vz*0.9)/9.81))
set bank (targetBank-sensor.roll)*20 - sensor.rollRate*8 - sensor.roll*1.8
set pitch (targetPitch-sensor.pitch)*20 - sensor.pitchRate*8 - sensor.pitch*1.5
sys result flight.control {collective:max(0,min(18,lift)),cyclic:max(-3,min(3,bank)),cyclicZ:max(-3,min(3,pitch)),stamp:sensor.stamp}
wait 40
goto loop
`;
export const RECEIVER=`# 数据接收与图表计算分离，版本严格按队列处理。
loop:
receive packet
sys result chart.receive packet
goto loop
`;
export const CHART=`# 坐标域与数值处理都由这个图表程序完成。
set padding 1.18
loop:
receive packet
sys config chart.config null
set high 10
set low 0
set row 1
scanRows:
if row >= len(packet.table) goto submit
set column 0
scanColumns:
if column >= len(config.series) goto nextRow
set value number(packet.table[row][config.series[column]])
if !value goto nextColumn
set high max(high,value)
set low min(low,value)
nextColumn:
set column column+1
goto scanColumns
nextRow:
set row row+1
goto scanRows
submit:
set plot {high:high*padding,low:low*padding,series:config.series,label:config.label,group:1/max(1,len(packet.table)-1)}
sys result chart.layout {linkId:packet.linkId,local:packet.local,version:packet.version,table:packet.table,title:packet.title,plot:plot}
goto loop
`;
export const COMPILER=`# 自举 NEX 编译器：此程序自己解析、建标签表并生成指令。
# 编辑后运行本文件，编译器会编译自己并用于随后启动的程序。
set maxInstructions 20000
set allowPrint true
sys job compiler.job null
set lines split(job.source,"\\n")
set code []
set labels {}
set i 0
parse:
if i >= len(lines) goto resolve
set line trim(lines[i])
set i i+1
if len(line) == 0 goto parse
if starts(line,"#") goto parse
if ends(line,":") goto label
set space index(line," ")
set op space<0 ? line : slice(line,0,space)
set text space<0 ? "" : trim(slice(line,space+1))
if !includes(["set","sys","if","goto","print","wait","receive","send","halt"],op) goto syntax
if op == "print" && !allowPrint goto syntax
set ins {op:op,text:text,line:i}
set code append(code,ins)
if len(code)>maxInstructions goto syntax
goto parse
label:
set labels assoc(labels,slice(line,0,len(line)-1),len(code))
goto parse
resolve:
set i 0
resolveLoop:
if i>=len(code) goto install
set ins code[i]
set op ins.op
if op == "set" || op == "sys" goto variable
if op == "goto" goto jump
if op == "if" goto condition
goto next
variable:
set space index(ins.text," ")
if space<1 goto syntax
set ins assoc(ins,"dest",slice(ins.text,0,space))
set ins assoc(ins,"expr",trim(slice(ins.text,space+1)))
if op != "sys" goto next
set space index(ins.expr," ")
if space<1 goto syntax
set ins assoc(ins,"service",slice(ins.expr,0,space))
set ins assoc(ins,"expr",trim(slice(ins.expr,space+1)))
goto next
jump:
if !has(labels,ins.text) goto syntax
set ins assoc(ins,"target",labels[ins.text])
goto next
condition:
set pos index(ins.text," goto ")
if pos<0 goto syntax
set target trim(slice(ins.text,pos+6))
if !has(labels,target) goto syntax
set ins assoc(ins,"expr",trim(slice(ins.text,0,pos)))
set ins assoc(ins,"target",labels[target])
next:
set code replaceAt(code,i,ins)
set i i+1
goto resolveLoop
install:
sys result executable.install {target:job.target,code:code}
print "编译完成"
halt
syntax:
sys result executable.reject {target:job.target,error:"第 "+string(i)+" 行：编译失败"}
print result
halt
`;
export const EXAMPLES={
 'draw.nx':`# 纯数据二维显示；点击预览会把输入消息送回本进程\nloop:\nset x 180+sin(time)*100\nsys frame display.submit {kind:"2d",width:480,height:200,background:"#edf3e9",shapes:[{type:"circle",x:x,y:100,r:35,fill:"#7d69a1"},{type:"text",x:25,y:35,text:"由系统程序生成的画面",fill:"#417c70",size:16}]}\nwait 50\ngoto loop`,
 'sum.nx':`# 修改循环上限后运行\nset n 100\nset i 0\nset total 0\nloop:\nset i i+1\nset total total+i\nif i<n goto loop\nprint total\nsys saved file.write {path:"/Documents/result.txt",content:string(total)}\nhalt`,
 'compute.nx':`# 不主动让出处理器的持续计算\nset counter 0\nloop:\nset counter counter+1\nset result sqrt(counter)*sin(counter)\ngoto loop`,
 'receive.nx':`# 运行后从任务管理器复制进程 ID 给发送程序\nloop:\nreceive message\nprint message\ngoto loop`,
 'send.nx':`set receiver "替换为接收进程ID"\nset i 0\nloop:\nset i i+1\nsend {to:receiver,value:{index:i,text:"你好，层界"}}\nprint sendResult\nwait 200\nif i<5 goto loop\nhalt`,
};
