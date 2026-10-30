# 精选中英文字体安装清单（Opus）

日期：2026-10-31

## 结论

- 新装中文 26 款、29 个文件；英文 30 款、33 个文件；合计 62 个文件。上限是中文 30 款、英文 30 款、合计 90 个文件，三项都在上限内。
- 全部装成系统级：文件复制到 `C:\Windows\Fonts`，并在 `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` 注册。AIAgent 和管理员看到的是同一套。
- 没有装进任何账户的个人字体目录，也没有删除或替换已有的系统字体。
- 正在运行的 Chrome 要重启后才能看到新字体。

## 已有字体（不占名额，不重装）

- **Windows 自带，中文**：微软雅黑、等线、宋体、新宋体、黑体、楷体、仿宋、幼圆、隶书、华文系列（宋体、中宋、仿宋、楷体、细黑、行楷、新魏、隶书、彩云、琥珀）、方正舒体、方正姚体、微软正黑。
- **Windows 自带，英文**：Arial、Times New Roman、Georgia、Verdana、Tahoma、Trebuchet MS、Segoe UI（含 Variable）、Calibri、Cambria、Candara、Constantia、Corbel、Consolas、Courier New、Lucida Console、Bahnschrift、Cascadia Code、Cascadia Mono、Century Gothic、Garamond、Book Antiqua、Bookman Old Style、Palatino Linotype、Franklin Gothic Medium、Impact、Comic Sans MS、Sitka。
- **之前另装，中文**：HarmonyOS Sans（SC、TC）、MiSans、思源黑体（Source Han Sans CN）、思源宋体（Source Han Serif CN）、Noto Sans SC、Noto Serif SC、霞鹜文楷 GB、霞鹜文楷 Mono GB、荆南波波黑、鸿雷拙书、字库星球飞扬体。还有：
  - 阿里妈妈东方大楷、刀隶体、方圆体、数黑体；
  - 抖音美好体、站酷文艺体、猫啃什锦黑、庞门正道细线体、标小智无界黑；
  - 寒蝉活黑体、寒蝉活宋体、三极锦宋、三极硬朗黑、临海体；
  - 方正书宋、汉仪中黑、京华老宋体、汇文明朝体、Ark Pixel 像素体。
- **之前另装，英文**：Inter（常规、Medium、SemiBold）、Inter Tight、Poppins、Playfair Display、Oswald、Bebas Neue、Rubik、Outfit、Noto Sans、Noto Serif、Courier Prime、Google Sans Flex、Gilroy、Great Vibes、Barlow Condensed、DejaVu、Liberation、Latin Modern Mono。另有几款只注册了部分字重：Orbitron 只有 Bold，Cormorant Garamond 只有 Medium 和 SemiBold，Lato 原本只有 Black（这次补装了常规和粗体，见下文）。

## 新装字体

文件规则：

- 有可变字体的，只装可变字体这一个文件；
- 没有可变字体的，只装常规体；
- 下面 6 款常用于正文或界面，另加了一个粗体：阿里巴巴普惠体、霞鹜 975 圆体、寒蝉圆黑体、Lato、PT Serif、IBM Plex Mono。

不装斜体、细体、特粗等其他字重，也不装等宽变体、繁体版或日文版。

“CSS 名”一列是在新开的 Chrome 里实测能用的 `font-family` 名字。

### 中文

| # | 字体 | 风格 | CSS 名 | 装的文件 | 许可 | 来源 |
|---|---|---|---|---|---|---|
| 1 | 霞鹜新晰黑 LXGW Neo XiHei | 黑体 | "LXGW Neo XiHei" / "霞鹜新晰黑" | `LXGWNeoXiHei.ttf` | IPA Font License 1.0（免费商用） | https://github.com/lxgw/LxgwNeoXiHei |
| 2 | 阿里巴巴普惠体 3.0 | 黑体 | "Alibaba PuHuiTi 3.0" / "阿里巴巴普惠体 3.0" | `AlibabaPuHuiTi-3-55-Regular.ttf`<br>`AlibabaPuHuiTi-3-85-Bold.ttf` | 阿里巴巴官方免费商用授权 | https://fonts.alibabagroup.com/#/font |
| 3 | 更纱等距黑体 Sarasa Mono SC | 黑体·中英等宽 | "Sarasa Mono SC" / "等距更纱黑体 SC" | `SarasaMonoSC-Regular.ttf` | SIL OFL 1.1 | https://github.com/be5invis/Sarasa-Gothic |
| 4 | 霞鹜新致宋 LXGW Neo ZhiSong | 宋体 | "LXGW Neo ZhiSong" / "霞鹜新致宋" | `LXGWNeoZhiSong.ttf` | IPA Font License 1.0（免费商用） | https://github.com/lxgw/LxgwNeoZhiSong |
| 5 | 猫啃网风雅宋 | 宋体 | "MaoKenWangFengYaSong" / "猫啃网风雅宋" | `MaoKenWangFengYaSong.ttf` | SIL OFL 1.1 | https://github.com/maoken-fonts/fengyasong |
| 6 | 朱雀仿宋 Zhuque Fangsong | 仿宋 | "Zhuque Fangsong (technical preview)" / "朱雀仿宋（预览测试版）" | `ZhuqueFangsong-Regular.ttf` | SIL OFL 1.1 | https://github.com/TrionesType/zhuque |
| 7 | 站酷小薇LOGO体 ZCOOL XiaoWei | 宋体·标题 | "站酷小薇体"（英文名 ZCOOL XiaoWei 无效） | `ZCOOLXiaoWei-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/zcoolxiaowei |
| 8 | 霞鹜臻楷 LXGW ZhenKai | 楷体 | "LXGW ZhenKai Slab GB" / "霞鹜臻楷 Slab GB" | `LXGWZhenKaiSlabGB-Regular.ttf` | SIL OFL 1.1 | https://github.com/lxgw/LxgwZhenKai |
| 9 | 寒蝉正楷体 ChillKai | 楷体 | "ChillKai" / "寒蝉正楷体" | `ChillKai.ttf` | SIL OFL 1.1（字体内另注台湾政府资料开放授权，可商用） | https://github.com/Warren2060/Chillkai |
| 10 | 演示春风楷 Slidechunfeng | 楷体·行楷 | "Slidechunfeng" / "演示春风楷" | `Slidechunfeng-Regular.ttf` | SIL OFL 1.1 | https://github.com/maoken-fonts/slidefont |
| 11 | 演示悠然小楷 Slideyouran | 楷体·小楷 | "slideyouran" / "演示悠然小楷" | `Slideyouran-Regular.ttf` | SIL OFL 1.1 | https://github.com/maoken-fonts/slidefont |
| 12 | 马善政毛笔楷书 Ma Shan Zheng | 楷体·毛笔 | "Ma Shan Zheng" | `MaShanZheng-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/mashanzheng |
| 13 | 霞鹜 975 圆体 LXGW 975 Yuan SC | 圆体 | "LXGW 975 Yuan SC" / "霞鹜975圆体SC" | `LXGW975YuanSC-400W.ttf`<br>`LXGW975YuanSC-700W.ttf` | SIL OFL 1.1 | https://github.com/lxgw/975Yuan |
| 14 | 寒蝉圆黑体 ChillRoundGothic | 圆体·圆角黑 | "Chill Round Gothic" / "寒蝉圆黑体" | `ChillRoundGothic_Regular.otf`<br>`ChillRoundGothic_Bold.otf` | SIL OFL 1.1 | https://github.com/Warren2060/ChillRoundGothic |
| 15 | 荆南麦圆体 KNMaiyuan | 圆体·手写感 | "KN Maiyuan" / "荆南麦圆体" | `KNMaiyuan-Regular.ttf` | SIL OFL 1.1 | https://github.com/maoken-fonts/KNMaiyuan |
| 16 | 得意黑 Smiley Sans | 标题·斜黑 | "Smiley Sans" / "得意黑" | `SmileySans-Oblique.ttf`（得意黑只有这一个字形） | SIL OFL 1.1 | https://github.com/atelier-anchor/smiley-sans |
| 17 | 钉钉进步体 DingTalk JinBuTi | 标题·斜黑 | "DingTalk JinBuTi" / "钉钉进步体" | `DingTalkJinBuTi-Regular.ttf` | 阿里巴巴官方免费商用授权 | https://fonts.alibabagroup.com/#/font |
| 18 | 淘宝买菜体 TaoBao MaiCaiTi | 展示·手写 | "TBMCYXT" / "淘宝买菜营销体" | `TaoBaoMaiCaiTi-Regular.otf` | 阿里巴巴官方免费商用授权 | https://fonts.alibabagroup.com/#/font |
| 19 | 站酷快乐体 ZCOOL KuaiLe | 展示·活泼 | "ZCOOL KuaiLe"（中文名无效） | `ZCOOLKuaiLe-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/zcoolkuaile |
| 20 | 站酷庆科黄油体 ZCOOL QingKe HuangYou | 展示·标题 | "ZCOOL QingKe HuangYou" / "站酷庆科黄油体" | `ZCOOLQingKeHuangYou-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/zcoolqingkehuangyou |
| 21 | 霞鹜漫黑 LXGW Marker Gothic | 展示·漫画 | "LXGW Marker Gothic" / "霞鹜漫黑" | `LXGWMarkerGothic-Regular.ttf` | SIL OFL 1.1 | https://github.com/lxgw/LxgwMarkerGothic |
| 22 | 缝合像素字体 Fusion Pixel 12px（简体） | 展示·像素 | "Fusion Pixel 12px Prop zh-Hans" | `fusion-pixel-12px-proportional-zh_hans.ttf` | SIL OFL 1.1 | https://github.com/TakWolf/fusion-pixel-font |
| 23 | 小赖字体 Xiaolai SC | 手写·圆润 | "Xiaolai" / "小赖字体" | `Xiaolai-Regular.ttf` | SIL OFL 1.1 | https://github.com/lxgw/kose-font |
| 24 | 悠哉字体 Yozai | 手写 | "Yozai" / "悠哉字体" | `Yozai-Regular.ttf` | SIL OFL 1.1 | https://github.com/lxgw/yozai-font |
| 25 | 志莽行书 Zhi Mang Xing | 书法·行书 | "Zhi Mang Xing" / "钟齐志莽行书" | `ZhiMangXing-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/zhimangxing |
| 26 | 龙藏体 Long Cang | 书法·手写 | "Long Cang" / "有字库龙藏体" | `LongCang-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/longcang |

### 英文

英文字体的 CSS 名就是表中的字体名。

| # | 字体 | 风格 | 装的文件 | 许可 | 来源 |
|---|---|---|---|---|---|
| 1 | Roboto | 无衬线 | `Roboto[wdth,wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/roboto |
| 2 | Open Sans | 无衬线 | `OpenSans[wdth,wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/opensans |
| 3 | Lato | 无衬线 | `Lato-Regular_GF.ttf`<br>`Lato-Bold.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/lato |
| 4 | Source Sans 3 | 无衬线 | `SourceSans3[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/sourcesans3 |
| 5 | IBM Plex Sans | 无衬线 | `IBMPlexSans[wdth,wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/ibmplexsans |
| 6 | Work Sans | 无衬线 | `WorkSans[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/worksans |
| 7 | Nunito | 无衬线·圆润 | `Nunito[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/nunito |
| 8 | Geist | 无衬线 | `Geist[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/geist |
| 9 | Montserrat | 几何 | `Montserrat[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/montserrat |
| 10 | Raleway | 几何·优雅 | `Raleway[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/raleway |
| 11 | Figtree | 几何 | `Figtree[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/figtree |
| 12 | Manrope | 几何 | `Manrope[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/manrope |
| 13 | Plus Jakarta Sans | 几何 | `PlusJakartaSans[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/plusjakartasans |
| 14 | Space Grotesk | 几何·怪诞 | `SpaceGrotesk[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/spacegrotesk |
| 15 | PT Serif | 衬线 | `PT_Serif-Web-Regular.ttf`<br>`PT_Serif-Web-Bold.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/ptserif |
| 16 | Lora | 衬线 | `Lora[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/lora |
| 17 | Source Serif 4 | 衬线 | `SourceSerif4[opsz,wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/sourceserif4 |
| 18 | EB Garamond | 衬线·古典 | `EBGaramond[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/ebgaramond |
| 19 | Libre Baskerville | 衬线·古典 | `LibreBaskerville[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/librebaskerville |
| 20 | Roboto Slab | 粗衬线 | `RobotoSlab[wght].ttf`（可变） | Apache 2.0 | https://github.com/google/fonts/tree/main/apache/robotoslab |
| 21 | DM Serif Display | 衬线·标题 | `DMSerifDisplay-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/dmserifdisplay |
| 22 | JetBrains Mono | 等宽 | `JetBrainsMono[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/jetbrainsmono |
| 23 | Fira Code | 等宽·连字 | `FiraCode[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/firacode |
| 24 | Source Code Pro | 等宽 | `SourceCodePro[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/sourcecodepro |
| 25 | IBM Plex Mono | 等宽 | `IBMPlexMono-Regular.ttf`<br>`IBMPlexMono-Bold.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/ibmplexmono |
| 26 | Anton | 展示·窄粗 | `Anton-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/anton |
| 27 | Abril Fatface | 展示·粗衬线 | `AbrilFatface-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/abrilfatface |
| 28 | Pacifico | 展示·手写 | `Pacifico-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/pacifico |
| 29 | Caveat | 展示·手写 | `Caveat[wght].ttf`（可变） | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/caveat |
| 30 | Press Start 2P | 展示·像素 | `PressStart2P-Regular.ttf` | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/pressstart2p |

## 款数和文件数统计

| | 款数（上限） | 文件数 | 构成 |
|---|---|---|---|
| 中文 | 26（30） | 29 | 23 款各 1 个文件，3 款常规加粗体 |
| 英文 | 30（30） | 33 | 22 款可变字体各 1 个文件；8 款静态字体，其中 Lato、PT Serif、IBM Plex Mono 各 2 个文件，其余 5 款各 1 个文件 |
| 合计 | 56 | 62（上限 90） | |

## 取舍说明

- **阿里妈妈灵动体**：下载到的文件不含汉字，只有西文，所以没装。
- **淘宝买菜体**：官方包里的 TTF 缺少字体名记录，所以改装同一个包里的 OTF。
- **DM Sans、Merriweather、Fraunces**：先装上，验证后又换掉了。
  - 原因：这三款可变字体带字号轴。新开的 Chrome 只认 "DM Sans 14pt"、"Merriweather 18pt"、"Fraunces 9pt" 这类名字，写 `font-family: "DM Sans"` 不生效。
  - 处理：已撤掉注册，文件移入回收站，换成 Figtree、PT Serif、DM Serif Display。新装的三款写常用名就能生效。
- **Lato**：
  - 原状：系统原来只注册了 Lato Black。`C:\Windows\Fonts` 里另有旧版 Lato-Regular、Italic、BoldItalic 三个文件，但没有注册，所以不生效。写 `font-family: Lato` 时全部文字都是 Black 字重。
  - 处理：这次补装了常规体和粗体。为了不覆盖旧文件，常规体存成 `Lato-Regular_GF.ttf`。
- **没选的字体**：
  - 思源黑体、思源宋体的 SC 版：与已装的 CN 版字形相同；
  - 霞鹜文楷非 GB 版：已有 GB 版；
  - 更纱黑体：等于思源黑体加 Inter；
  - 文泉驿：TTC 文件里捆绑了等宽变体；
  - 未来荧黑、寒蝉全圆体、演示夏行楷、演示秋鸿楷、演示佛系体、龙珠体：为控制数量没选。
- **清理残留**：上一批卸载时漏了一条注册项 `Lato Black (TrueType) [e08c529f2e1f]`，它指向已不存在的 `Lato-Black_v2.ttf`，已删除。

## 验证

- **文件和注册**：62 个文件都在 `C:\Windows\Fonts`，HKLM 注册值都指向它们。HKLM 字体项从 980 条变成 1041 条：删掉 1 条残留，新增 62 条。
- **管理员会话**：用 GDI 枚举字体，56 款新字体都在。
- **新开的 Chrome**：
  - 做法：另开一个 Chrome 156，使用临时配置目录，用画布测宽法逐个检查 CSS 名。
  - 结果：56 款都能用上表的 CSS 名取到。
  - 字重：可变字体和补了粗体的字体，700 字重的宽度与 400 不同，说明用的是真实字重。
  - 对照：本次安装前就已打开的 Chrome 实例（包括 chrome-devtools-mcp 开着的浏览器）实测一款都取不到。
- **结论**：正在运行的 Chrome 必须重启后才能看到新字体。
- **AIAgent**：AIAgent 没有个人字体，系统级字体对所有账户生效，所以 AIAgent 看到的新字体与管理员相同。本次没有以 AIAgent 身份实测。

## 管理员独有字体

- **真正只有管理员能用的**：梦源黑体 CN W20、W27，以及梦源黑体 JP（夢ノ角ゴ）W20、W27，即 Dream Han Sans。
  - 文件只在 `C:\Users\Administrator\AppData\Local\Microsoft\Windows\Fonts`，并且只在管理员的 HKCU 下注册。
  - 上一位子代理曾把它们装成系统级，已随 386 个文件一起卸载，所以现在又只有管理员能看到。
  - 按要求没有另外处理。
- **不属于独有的**：三极锦宋、三极硬朗黑、寒蝉活黑体、寒蝉活宋体、临海体。管理员个人目录里有这些文件，但 `C:\Windows\Fonts` 里也有同名文件，并已在 HKLM 注册，两个账户都能看到。
- **两边都用不到的**：个人目录里还有以下文件，都没有在 HKCU 注册，管理员当前也加载不到（GDI 枚举里没有），两个账户一致：
  - Noto Serif JP；
  - Shippori Mincho B1 常规、粗、特粗；
  - Zen Kaku Gothic New 常规、粗；
  - Cormorant Garamond 可变版。

  另外，Shippori Mincho B1 Medium、Zen Kaku Gothic New Medium、Cormorant Garamond Medium 和 SemiBold 是系统级的。
- **影响**：作品如果用了梦源黑体，评分员（管理员）看到的是梦源黑体，受测模型（AIAgent）看到的是回退字体，两边渲染会不同。
