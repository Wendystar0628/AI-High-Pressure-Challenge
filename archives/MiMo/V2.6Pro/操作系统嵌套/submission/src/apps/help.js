// 操作说明(简体中文,含程序格式/系统接口/内核/飞控/配额/场景/投送等)
import { escapeHtml } from '../core/util.js';

const SECTIONS = [
  {
    id: 'start', title: '快速开始', html: `
<h1>操作说明</h1>
<p>欢迎使用<b>嵌套图形操作系统</b>。根系统提供日常桌面与常见应用;每个系统都可以继续创建子系统,形成多级嵌套的系统树。子系统以三维直升机场景、飞行排演和实时图表为主要工作内容。</p>
<h2>启动与基本操作</h2>
<ul>
<li>桌面图标<b>单击选中、双击打开</b>;桌面空白处右键可打开菜单。</li>
<li>窗口标题栏可拖动,双击最大化/还原,边缘可缩放;拖到屏幕左右边缘可半屏贴靠。</li>
<li>任务栏左侧为开始按钮,中部为运行中的窗口,右侧为通知与小组件入口、时钟。</li>
<li>开始菜单可搜索并启动应用。</li>
</ul>
<h2>启动参数</h2>
<pre>npm start -- --data-dir &lt;目录&gt; --width 1280 --height 800 --remote-debugging-port=19106</pre>
<p>数据目录用于独立测试数据,互不影响。调试端口默认 19106。</p>
` },
  {
    id: 'tree', title: '递归系统树', html: `
<h1>递归系统树</h1>
<p>根系统标识为 <code>outer</code>,其余实例按创建顺序命名为 <code>inner-1</code>、<code>inner-2</code> …。同一父系统下可同时运行多个子系统。</p>
<h2>管理操作</h2>
<ul>
<li>在桌面「系统管理」或各层开始菜单中可新建、启动、暂停、继续、单步、调速、重启、关闭直属子系统。</li>
<li>支持为子系统创建<b>快照</b>、<b>恢复</b>与<b>分叉</b>(从快照启动独立新子树)。</li>
<li>暂停一个实例会停止整棵子树的推进;继续后,后代保留各自原有暂停状态。</li>
<li>重启实例会结束子树内原有进程,重新载入内核源文件,保留已保存的文件。</li>
</ul>
<h2>内核程序</h2>
<p>每个子系统由存放在<b>父系统文件系统</b>中的内核程序运行(默认路径 <code>/System/Kernels/&lt;实例名&gt;.sys</code>)。
进程表、调度、消息、文件系统与系统调用分发都写在这份内核程序里。可在父系统编辑器中打开、修改并保存,重启该子系统后生效。</p>
<p>内核本身消耗执行预算,计入父系统读数。层数越深,到达用户程序的份额越小。</p>
` },
  {
    id: 'proc', title: '程序格式 (KS)', html: `
<h1>程序格式说明 (KernelScript)</h1>
<p>程序是文本文件,扩展名 <code>.prog</code>,内核源文件扩展名 <code>.sys</code>,使用同一种语言。以 <code>#</code> 开头的行为注释。</p>
<h2>语法示例</h2>
<pre># 累加与消息
var n = 10
var sum = 0
var i = 1
while i &lt;= n
  sum = sum + i
  i = i + 1
end
sys.log("结果: " + str(sum))

var m = { to: 3, text: "hello" }
sys.send(3, m)
var got = sys.recv(1000)
if got != null
  sys.log(str(got))
end</pre>
<h2>数据类型</h2>
<p>数字、字符串、布尔 <code>true/false</code>、<code>null</code>、数组 <code>[1,2,3]</code>、对象 <code>{a:1,b:"x"}</code>。支持算术、比较、逻辑与字符串拼接。</p>
<h2>系统调用(用户程序)</h2>
<table>
<tr><th>调用</th><th>说明</th></tr>
<tr><td><code>sys.time()</code></td><td>本系统虚拟时间(毫秒)</td></tr>
<tr><td><code>sys.wait(ms)</code></td><td>等待指定时长(虚拟时间)</td></tr>
<tr><td><code>sys.self()</code></td><td>自身进程标识</td></tr>
<tr><td><code>sys.spawn(path, args)</code></td><td>启动进程,返回新进程标识</td></tr>
<tr><td><code>sys.exit(code)</code></td><td>结束自身</td></tr>
<tr><td><code>sys.send(pid, msg)</code></td><td>向指定进程发送消息(带收件人身份)</td></tr>
<tr><td><code>sys.recv(timeout)</code></td><td>等待并接收消息;超时返回 null</td></tr>
<tr><td><code>sys.readFile(path)</code> / <code>sys.writeFile(path, data)</code></td><td>读写本系统文件</td></tr>
<tr><td><code>sys.listDir(path)</code> / <code>sys.mkdir(path)</code> / <code>sys.remove(path)</code></td><td>目录与删除</td></tr>
<tr><td><code>sys.draw(cmds)</code></td><td>提交二维图形命令列表(显示区域)</td></tr>
<tr><td><code>sys.input()</code></td><td>取回本应用输入事件列表(指针/键盘/滚轮)</td></tr>
<tr><td><code>sys.scene3d(state)</code></td><td>提交三维场景状态(位姿、相机、粒子等)</td></tr>
<tr><td><code>sys.sceneResource(res)</code></td><td>登记三维场景资源(几何、材质、灯光)</td></tr>
</table>
<h2>内核可用的额外调用</h2>
<p>内核程序还可使用 <code>cpu.*</code>(载入/步进/结束用户进程)、<code>host.*</code>(显示设备、时间、子系统创建与管理)等宿主原语,详见内置内核源文件。</p>
<h2>预置程序</h2>
<p><code>/Programs/</code> 下预置累加计算、消息发送、消息接收与持续计算程序,可在编辑器中查看、修改并运行。持续计算程序在循环中不主动让出,用于检验调度公平性。</p>
` },
  {
    id: 'budget', title: '预算与配额', html: `
<h1>共享资源与分层调度</h1>
<p>每个系统在一个逻辑步内有有限的<b>总执行预算</b>(以逻辑工作单位计量)。内核、普通程序、应用服务与直属子系统承载进程共同竞争这份预算。</p>
<ul>
<li>进程额度是其可用上限,不是额外预算;多个进程不会重复取得整份总预算。</li>
<li>子系统本步实际可用预算受父系统实际拨付与本系统配置共同限制;后代工作逐级计入承载进程读数。</li>
<li>调高时间速率、增加实例、创建应用或投送视图<b>不增加</b>逻辑执行预算。</li>
<li>工作量按实际规模计费:文件处理、表格重算、图表计算、飞行物理、场景取样与显示提交等。</li>
<li>预算不足时保留未完成工作,在以后取得额度后续行。</li>
</ul>
<h2>内存与存储配额</h2>
<p>每个系统还有有限的内存与存储配额,同样逐级拨付、兄弟共享。程序变量、消息、缓存与显示资源占用内存;文件占用存储。配额不足时分配失败并给出可处理的错误,影响范围限于该配额范围内的系统。</p>
<h2>时间</h2>
<p>各系统有独立虚拟时钟,可暂停、继续、单步与调速。子系统时间随父系统逻辑时间与自身速率推进。暂停子树会停止其时钟与全部程序;恢复时不补进暂停时长。调快时间不会补发预算。</p>
<p>宿主实际绘制与 Chromium 网页执行不计入逻辑预算;应用计算与子系统窗口管理归对应系统预算。</p>
` },
  {
    id: 'helicopter', title: '直升机与飞行排演', html: `
<h1>三维直升机场景</h1>
<p>主角是紫黄配色的 <b>24 号直升机</b>。默认演出在 1 倍速下总时长 <b>15 秒</b>:停机与启动 → 起飞 → 飞行 → 失控与下坠 → 撞击与余波。</p>
<h2>播放器</h2>
<ul>
<li>支持播放、暂停、停止回到开头、重播、逐帧、循环开关;显示当前时间、总时长、速率与状态。</li>
<li>可拖动进度条或输入时间跳转;暂停后跳转保持暂停。</li>
<li>镜头可切换:演出镜头 / 跟随镜头 / 自由环绕(拖动旋转、滚轮缩放)。</li>
<li>点击部件可查看名称与损坏状态;排演中点击地面可设为目标航向。</li>
</ul>
<h2>飞行排演</h2>
<p>排演中直升机是不稳定被控对象,由子系统里的<b>飞控进程</b>(程序文件)保持飞行。飞控经系统接口读取带时间戳的传感器值、写入总距与舵面,与其他进程竞争执行预算。控制量保持到下一次写入,错过周期不补发。</p>
<pre># 飞控接口
var s = flight.sensors()      # {roll,pitch,yaw,alt,vx,vy,vz,rotor,...} 带时间戳
flight.write({ collective: 0.55, cyclic: {x:0, y:0}, pedal: 0 })</pre>
<p>预算、调度与时间速率实际影响排演飞行:降低拨付或提高时间速率会使控制周期变长,机体抖动、发散直至坠毁;及时恢复可以拉回。</p>
<h2>输入与记录</h2>
<p>排演中可改变风、目标航向与故障触发时机。排演过程可作为本系统文件保存与重新打开(记录保留初态、输入与控制时序),可跳转回放,并从同一位置继续排演产生不同后续。</p>
` },
  {
    id: 'chart', title: '图表与投送', html: `
<h1>实时数据可视化</h1>
<p>图表工作台从根系统电子表格建立<b>显式数据连接</b>:选择已打开的工作簿与矩形区域,指定标签列与数值列,生成分组柱状图或折线图。</p>
<ul>
<li>建立连接先取得当前完整值;之后每次编辑/粘贴/撤销重算完成,发布该区域新版本。</li>
<li>图表版本只前进不后退;断开连接后不再变化。</li>
<li>数据接收与图表更新是子系统内职责可区分的进程,经消息协作。</li>
<li>暂停目标子树时,更新在范围外按序暂存,恢复后按序处理。</li>
</ul>
<h2>跨层窗口投送</h2>
<p>播放器与图表都有「投送」入口,可选择任一祖先桌面(包括直接投送到根系统)。目标桌面创建独立的投送窗口,源窗口继续保留。</p>
<ul>
<li>源应用、状态与计算始终属于源系统,工作计入源系统预算。</li>
<li>投送中的播放、进度、点选等输入经接口进入源应用消息队列,一次输入只执行一次。</li>
<li>关闭投送只取消视图;关闭源窗口或停止源子树时投送结束并提示。</li>
<li>暂停源系统时投送内容冻结,控件禁用并提示原因。</li>
</ul>
` },
  {
    id: 'files', title: '文件与快照', html: `
<h1>文件与跨层传递</h1>
<p>每个系统有独立目录树;工作簿、程序、内核源、场景资源、排演记录与文本走同一套文件操作。</p>
<ul>
<li>各层文件管理器之间可<b>双向拖放</b>文件(祖先↔后代、兄弟实例之间),投放前显示目标,目标取得独立副本。</li>
<li>重名时可取消或确认覆盖;目标存储配额不足时传递失败并反馈。</li>
<li>可将本系统文件保存到本机,再从本机导入。</li>
</ul>
<h2>子树快照、恢复与分叉</h2>
<p>每层可为直属子系统创建快照,保存为父系统文件。快照范围是选定实例及全部后代,保存同一逻辑时点的全部运行状态(系统树、内核运行位置、进程与变量、调度、虚拟时间、消息、文件、桌面与应用状态等)。</p>
<ul>
<li><b>续行</b>:恢复后从保存位置继续,不重做已处理事件。</li>
<li><b>范围</b>:只改变选定子树;范围外保持当前值。</li>
<li><b>分叉</b>:从快照启动独立新子树,身份全部换新,与原子树互不影响。</li>
<li>快照可保存到本机,作品重启后导入仍能恢复。</li>
</ul>
` },
  {
    id: 'kernel', title: '修改内核', html: `
<h1>修改内核程序</h1>
<p>每个子系统对应父系统中一份内核源文件(默认 <code>/System/Kernels/&lt;实例名&gt;.sys</code>),可在父系统编辑器中打开、修改、保存,重启该子系统后生效。</p>
<h2>可修改内容</h2>
<ul>
<li>调度策略(如时间片轮转、优先级、公平分享)</li>
<li>消息规则(广播、优先级队列等)</li>
<li>文件行为(配额策略、路径规则)</li>
<li>增加系统调用</li>
</ul>
<p>修改后重启该子系统,实际行为随之变化;<b>其他子系统不受影响</b>。内核写坏时该子系统显示「内核错误」并停止,父系统与兄弟系统照常运行,改回后可重新启动。</p>
<h2>作用链</h2>
<p>子系统的窗口管理与文件管理器、播放器、图表工作台都是内核启动的程序,经显示接口提交画面、经消息取得输入。修改这些程序源文件并重启后,界面与行为随之变化。</p>
` },
  {
    id: 'bench', title: '自动化接口', html: `
<h1>自动化与录制约定</h1>
<pre>window.bench.version
await window.bench.ready()
await window.bench.reset()
await window.bench.inspect()</pre>
<p><code>inspect()</code> 返回 systems / windows / browsers / players / charts / projections 状态数组。</p>
<p>启动参数:<code>--data-dir</code>、<code>--width</code>、<code>--height</code>;连接方式见根目录 <code>automation.json</code>。</p>
<h2>关键控件标识</h2>
<p>界面关键控件具有稳定 <code>data-testid</code> 与所属 <code>data-system-id</code> / <code>data-window-id</code>。应用标识:
<code>files / spreadsheet / widgets / editor / browser / tasks / settings / player / charts / projection</code>。</p>
<p>示例:<code>os-desktop</code>、<code>start-toggle</code>、<code>app-window</code>、<code>sheet-grid</code>、<code>chart-connect</code>、<code>player-play</code>、<code>window-project</code> 等。</p>
` },
];

export function launchHelp(ctx) {
  const { wm } = ctx;
  const exist = wm.list().find(w => w.appId === 'help');
  if (exist) { wm.focus(exist.id); return; }

  wm.create({
    appId: 'help',
    title: '操作说明',
    icon: '📖',
    x: 220, y: 70, w: 860, h: 580,
    minWidth: 560, minHeight: 380,
    bodyBuilder(body) {
      body.innerHTML = `
        <div class="help-app">
          <div class="help-side"></div>
          <div class="help-main" data-testid="help-content"></div>
        </div>`;
      const side = body.querySelector('.help-side');
      const main = body.querySelector('.help-content');
      for (const s of SECTIONS) {
        const d = document.createElement('div');
        d.className = 'h-item';
        d.dataset.testid = 'help-nav-' + s.id;
        d.textContent = s.title;
        d.addEventListener('click', () => {
          side.querySelectorAll('.h-item').forEach(x => x.classList.remove('active'));
          d.classList.add('active');
          main.innerHTML = s.html;
          main.scrollTop = 0;
        });
        side.appendChild(d);
      }
      side.querySelector('.h-item').classList.add('active');
      main.innerHTML = SECTIONS[0].html;
    },
  });
}
