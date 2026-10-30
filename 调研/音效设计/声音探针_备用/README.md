# 声音探针

三道网页题（动态路由塔防、多物理连锁机关、AE风味动效设计编辑器）共用。评分用的 `oneshot_browser` 是无窗口 Chrome，启动时自带 `--mute-audio`，评分 AI 也不能听。探针在页面里旁听实际送往扬声器的声音：记录每次发声的时刻、电平、声道和调用位置，可以导出录音。它只做测量，不影响作品的声音，也不打分。

- `sound_probe.js`：探针，在页面里运行。
- `analyze.py`：把探针导出的数据还原成 WAV 并画图，也能分析作品导出的视频或音频文件。需要 numpy、matplotlib，处理视频还要本机的 ffmpeg 和 ffprobe。

## 注入

1. 先把探针复制到系统临时目录。MCP 只保证能读写这个目录里的文件，从项目目录直接读会被拒绝。

   ```powershell
   Copy-Item E:\Project\AI_OneShot_Bench\Grading\工具\声音探针\sound_probe.js $env:TEMP\
   ```

2. 用 `navigate_page` 打开作品（`new_page` 不能带脚本），`initScript` 原样填下面这一行。它在作品的任何脚本之前运行，记下作品载入时就接到扬声器的节点：

   ```js
   window.__sndEarly={n:[],c:AudioNode.prototype.connect};AudioNode.prototype.connect=function(d){if(d instanceof AudioDestinationNode)__sndEarly.n.push(this);return __sndEarly.c.apply(this,arguments)}
   ```

3. 页面打开后、第一次点击之前，调用 `evaluate_script`，只填 `sourcePath`（`C:\Users\Administrator\AppData\Local\Temp\sound_probe.js`）和 `waitForStableDom: false`。返回 `info()` 就说明装好了。
4. 先用 `click` 或 `press_key` 点一次页面，解除浏览器的出声限制，然后照常操作。

`initScript` 只对这一次打开有效。作品自己刷新或重新打开后，重做第 2、3 步。如果跳过第 2 步，作品在探针载入之前接好的总线就录不到。这时 `info().warnings` 会提示，相关调用的 `heard` 为 `null`。

## 读结果

在 `evaluate_script` 的 `function` 里填调用，例如 `() => __snd.report()`。也加上 `waitForStableDom: false`，否则页面动画会让每次读数多等最多 3 秒。所有时间都是页面的 `performance.now()`，单位毫秒；`__snd.mark('名字')` 打标记并返回当前时刻。

| 调用 | 给出什么 |
|---|---|
| `__snd.info()` | 各音频环境的状态、已录秒数 `recorded_s`、其中有声的秒数 `sounding_s`、提示 `warnings` |
| `__snd.report()` | 每次点击和按键之后 0.6 秒内：是否出声 `sounded`、隔多少毫秒 `onset_ms`、峰值、调用了哪些发声 |
| `__snd.sites()` | 按调用位置汇总的发声：函数和行号 `site`、次数 `n`、其中真有声的次数 `heard`（最近 0.4 秒内的调用暂不计入）、来自哪类回调 `via`（`click`、`keydown` 等事件，`raf`、`timeout`、`interval`、`message`、`other`） |
| `__snd.events({from, to, kind, site, limit})` | 逐条发声调用：调用时刻 `t`、实际播放时刻 `play`、那段输出的峰值 `lvl`（dBFS）和抬升 `rise`、`heard`、说明 `note` |
| `__snd.summary(from, to)` | 一段时间的峰值、平均电平、有声秒数、削顶采样数、声像 `pan_db`（右声道比左声道的能量，单位 dB，正数偏右）、起音个数 |
| `__snd.levels(from, to, binMs)` | 逐格的左右声道电平 |
| `__snd.onsets(from, to)` | 起音：时刻、峰值、声像、频谱重心 |
| `__snd.watch()`、`__snd.sync(from, to)` | 每帧取最大的 canvas 的画面（`watch(true, '选择器')` 可指定 canvas 或 video）；把声音起音和画面突变配对，`offset_ms` 为画面时刻减去声音时刻 |
| `__snd.export(from, to)` | 以上全部数据和这段录音 |

存盘：`evaluate_script` 填 `function: "() => __snd.export()"`，`filePath` 填临时目录下的路径，例如 `C:\Users\Administrator\AppData\Local\Temp\snd\塔防_第一波.json`。MCP 一律存成 `.json`。然后运行：

```powershell
python analyze.py probe C:\Users\Administrator\AppData\Local\Temp\snd\塔防_第一波.json
python analyze.py media C:\Users\Administrator\Downloads\导出.mp4 --expect 0.5,1.0,1.75
```

- `probe`：在 JSON 旁边生成同名的 `.wav` 和 `.png`（电平、频谱、发声调用、标记），并打印摘要。
- `media`：分析作品导出的文件，打印这些内容：
  - 音轨的编码、起点和覆盖范围；
  - 帧数和帧间隔（帧间隔不均匀，说明是边播边录）；
  - 起音、画面突变，以及声画偏差的中位数；
  - `--expect` 列出应当发声的时刻（关键帧、标记），对每个时刻给出最近的起音和偏差。
- 无窗口浏览器下载的文件在 `C:\Users\Administrator\Downloads`。

## 判断

- **有声**：作品的音频环境 `state` 为 `running`，且 `sounding_s > 0`；或 `report()` 里有 `sounded: true`。
- **挂在事件上**：
  - 评分员亲手做的操作（点击、按键、部署、技能等）：看 `report()` 里这一次操作的 `sounded` 是否为 `true`，`onset_ms` 一般在 300 ms 以内。
  - 作品里自己发生的事件：看 `sites()` 的调用位置是不是处理这个事件的函数，并且 `heard > 0`。仿真步进里发出的声音，`via` 为 `raf`。来自 `interval` 或 `timeout`、调用位置又和事件无关的，是按定时器播放的。
  - 物理题“随仿真变化”：同一环用正常速度和 1/4 速各跑一次，起音间隔应拉长约 4 倍，定时器播放的不变。暂停时没有起音。强弱和左右看 `onsets` 的 `peak_db` 和 `pan_db`。
- **假出声**：`events` 或 `sites` 里有调用，但 `heard` 为 `false`，`lvl` 为 −120 dB。常见原因是音量为 0、没接到输出，或音频环境一直没有运行。`heard` 为 `null` 表示无法判断，原因见 `note`。
- **AE 预览同步**：
  - 先运行 `__snd.watch()`，再播放一段画面变化和声音都很明确的预览，例如在同一时刻闪白并配一声打击。
  - `sync()` 的 `median_offset_ms` 在一帧以内（约 ±35 ms）就算同步。
  - 导出的文件用 `analyze.py media` 核对。
- **阈值**：−60 dBFS 以上算有声。`heard` 要求满足两条：播放后 0.3 秒内有声；同时比前 0.2 秒高出 3 dB 以上，或者出现了新的起音。

## 已验证

在评分员同一个 chrome-devtools-mcp 1.12.0、同样的启动参数下，只用 MCP 工具、分别以 file:// 和 http:// 打开测试页验证过，以下情形都判对：正常出声，增益为 0 和 `<audio>` 音量为 0 的假出声，只在点击后出声，载入时建好而挂起的音频环境，定时器播放（`via` 为 `interval`），仿真步进中发声（`via` 为 `raf`，1/4 速时起音间隔为 4.06 倍），暂停，左右声像（±132 dB）和单侧声道，200 个声音同时响的削顶，Tone.js 和作品自己的 AudioWorklet。AE 场景中，预览同步的测得 0 到 +12 ms，声音晚 120 ms 的测得 −109 到 −114 ms；MediaRecorder 边播边录导出的 WebM，同步的测得 +7 到 +15 ms，晚 120 ms 的测得 −105.5 ms；逐帧对齐的 MP4 测得 0 ms，晚一帧的测得 −33.3 ms。

## 限制

- file:// 页面用 `<audio>` 播放本地文件时，浏览器把它当作跨来源，探针录不到波形，只能按播放进度、音量和静音判断，`note` 里会写明。用本地网页服务器打开就能录到。
- 只覆盖 Web Audio 和 `<audio>`、`<video>`。`speechSynthesis` 只记录调用。
- 画面取样只支持 canvas 和 video。作品用 DOM 或 SVG 做预览时，`sync` 没有数据，改为核对导出的文件。
- 探针会给主线程加一点负担，测性能时不要注入。
- 原始采样只保留最近 180 秒，可以用 `__snd.config({keepSec})` 调整。电平和事件一直保留。
