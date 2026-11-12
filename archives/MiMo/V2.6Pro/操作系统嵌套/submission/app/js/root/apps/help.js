/* help.js — operation manual */
import { el } from '../../utils.js';

export class HelpApp {
  constructor(root) { this.root = root; }
  open() {
    const win = this.root.createWindow({
      appId: 'help', title: '操作说明', icon: 'text',
      w: 820, h: 620
    });
    const body = win.body;
    body.innerHTML = '';
    const content = el('div', {
      style: 'padding:24px 30px;overflow-y:auto;height:100%;line-height:1.75;font-size:13.5px;color:var(--text)',
      'data-app-id': 'help', 'data-system-id': this.root.id, 'data-window-id': win.id
    });
    content.innerHTML = HELP_HTML;
    body.appendChild(content);
    return win;
  }
}

const HELP_HTML = `
<h2 style="margin-bottom:14px">Nested OS 操作说明</h2>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">一、桌面与窗口</h3>
<ul style="padding-left:20px">
<li>桌面图标：单击选中，双击打开；右键桌面空白处弹出菜单。</li>
<li>任务栏：左侧开始按钮，中部显示运行窗口（点击切换/最小化），右侧托盘为通知、小组件与时钟。</li>
<li>窗口：拖动标题栏移动，拖边缘缩放；右上角按钮依次为最小化、最大化、关闭；双击标题栏切换最大化。</li>
<li>贴靠：把窗口拖到屏幕左/右边缘可半屏贴靠，拖到顶部最大化。</li>
<li>开始菜单：点击开始按钮，可搜索并启动应用。</li>
</ul>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">二、文件管理器</h3>
<ul style="padding-left:20px">
<li>双击文件夹进入，双击文件按类型打开（.sheet 用电子表格，.ks/.txt 用编辑器）。</li>
<li>工具栏支持新建文件/文件夹、复制、粘贴、删除（删除进入回收站，可在回收站恢复）。</li>
<li>Ctrl+单击 多选；右键文件弹出重命名/删除菜单。</li>
<li>跨层传文件：把文件行拖拽到子系统窗口内的文件管理器（见子系统说明）。</li>
</ul>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">三、电子表格</h3>
<ul style="padding-left:20px">
<li>单元格双击编辑；公式以 = 开头，支持 + - * / 、括号、单元格引用（如 B2）与 SUM。</li>
<li>区域引用写法：<code>=SUM(D2:D4)</code>。修改后按依赖关系自动重算。</li>
<li>除零、无效引用、循环依赖会显示明确错误。</li>
<li>工作簿保存到文件系统（默认 /Documents/*.sheet），未保存修改有黄色标点提示。</li>
<li>子系统图表工作台可对已打开工作簿建立实时数据连接。</li>
</ul>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">四、KernelScript 程序</h3>
<p>程序格式为 KernelScript（KS），类 JavaScript 语法。可声明变量（let）、函数（fn）、if/else、while、for，支持数组与对象字面量。</p>
<p><b>系统服务（sys.*）</b>：</p>
<ul style="padding-left:20px">
<li><code>sys.time()</code> / <code>sys.now()</code> — 读取本系统虚拟时间（毫秒）</li>
<li><code>sys.wait(ms)</code> — 等待指定时长（虚拟时间）</li>
<li><code>sys.pid()</code> — 自身进程号</li>
<li><code>sys.spawn(progPath, args)</code> — 启动进程；<code>sys.exit()</code> — 结束自身</li>
<li><code>sys.send(pid, msg)</code> / <code>sys.recv()</code> — 消息发送与等待接收</li>
<li><code>sys.readFile(path)</code> / <code>sys.writeFile(path, data)</code> / <code>sys.listDir(path)</code> — 文件读写</li>
<li><code>sys.submit2d(cmds)</code> — 提交二维图形；<code>sys.submit3d(scene)</code> — 提交三维场景</li>
<li><code>sys.log(...)</code> — 输出日志；<code>sys.charge(n)</code> — 计入工作量</li>
</ul>
<p><b>内核程序</b>：每个子系统由父系统文件系统中的内核程序运行（默认 <code>/System/kernel.ks</code>）。内核实现进程表、调度、消息、文件与系统调用分发。可在父系统编辑器中修改内核源文件，重启子系统后生效。</p>
<p><b>内核专用接口（kern.*）</b>：<code>kern.getSyscall()</code>、<code>kern.returnSyscall(pid, result)</code>、<code>kern.runProcess(pid, budget)</code>、<code>kern.storageRead/Write</code>、<code>kern.submitDisplay</code>、<code>kern.readInput</code>、<code>kern.stepTime()</code>。</p>
<p><b>预置程序</b>：累加计算（accum.ks）、消息发送/接收（sender.ks / receiver.ks）、持续计算（busy.ks，用于检验调度）、编译器（compiler.ks）与飞控程序（flightctl.ks）。</p>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">五、子系统</h3>
<ul style="padding-left:20px">
<li>从桌面“系统管理”或开始菜单创建子系统。每个子系统在独立系统窗口中显示完整桌面。</li>
<li>可暂停/继续/单步/调速/重启/关闭，也可以创建快照、恢复和分叉。</li>
<li>暂停子树停止整棵子树推进；祖先暂停覆盖后代。</li>
<li>递归：子系统内可继续创建子系统（至少四层桌面可用）。</li>
<li>改写内核源文件并重启后，调度、消息、文件等行为按新规则运行。</li>
</ul>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">六、三维播放器与飞行排演</h3>
<ul style="padding-left:20px">
<li>播放器从子系统文件系统打开 .scene 场景资源，默认演出为 24 号直升机起飞—失控—坠毁（15 秒）。</li>
<li>播放控制：播放/暂停/停止/重播/逐帧，进度条拖动与时间跳转，速率调节。</li>
<li>镜头：演出镜头 / 跟随镜头 / 自由环绕（拖动旋转、滚轮缩放）。</li>
<li>飞行排演：点“排演”进入，可调风、目标航向、故障触发；飞控程序（flightctl.ks）经系统接口读传感器、写控制量。</li>
<li>排演可保存为 .rec 记录文件，重新打开可跳转回放或续演。</li>
</ul>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">七、图表工作台与窗口投送</h3>
<ul style="padding-left:20px">
<li>图表工作台选择根系统工作簿与矩形区域、标签列和数值列，生成柱状图或折线图。</li>
<li>连接后表格每次提交编辑都会发布新版本，图表实时更新（经子系统进程处理）。</li>
<li>播放器与图表都可“投送”到任一祖先桌面：目标桌面出现投送窗口，输入转发回源应用。</li>
<li>关闭投送只取消视图；关闭源窗口或停止子树会结束对应投送。</li>
</ul>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">八、预算与配额</h3>
<ul style="padding-left:20px">
<li>每个系统每逻辑步有总执行预算（指令单位），内核、程序、应用服务与子系统承载进程共同竞争。</li>
<li>任务管理器可查看各进程实际消耗与未完成工作，调整总预算、进程额度与子系统拨付。</li>
<li>内存与存储配额逐级拨付，不足时分配失败并给出可处理错误。</li>
<li>宿主绘制与 Chromium 网页执行不计入逻辑预算。</li>
</ul>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">九、快照与恢复</h3>
<ul style="padding-left:20px">
<li>对子系统创建快照可保存整棵子树的运行状态（进程、消息、文件、桌面、场景、时钟）。</li>
<li>恢复到原实例或从中分叉出独立新子树；范围外的系统不受影响。</li>
<li>快照保存为父系统文件（.snap），可导入导出到本机。</li>
</ul>

<h3 style="margin:16px 0 8px;color:var(--accent-2)">十、浏览器</h3>
<ul style="padding-left:20px">
<li>根系统内置 Chromium 浏览器，支持多标签、前进后退、刷新、地址栏。</li>
<li>可真实访问 bilibili 等站点；网页在窗口内移动缩放裁剪，不悬浮于其他应用之上。</li>
</ul>
`;
