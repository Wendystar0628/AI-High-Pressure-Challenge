# 厂商 logo

来源：npm 包 `@lobehub/icons-static-svg@1.95.1`（2026-09-21 发布）的 `icons/` 目录。下载后只删掉了固定的 `1em` 宽高和行内 style，图形没有改动。商标归各厂商所有，只用来标明模型出处。

- `mark/<名>.svg`：图形标，单色，24×24。
- `mark/<名>-color.svg`：图形标，品牌色；没有这个文件的品牌只出单色。
- `wordmark/<名>.svg`：字标，单色，高 24。

| 名 | 品牌 | 彩色版 | 字标写法 |
|---|---|---|---|
| `anthropic` | Anthropic | 无 | ANTHROPIC |
| `claude` | Claude（Anthropic） | 品牌橙 | Claude |
| `openai` | OpenAI，GPT 系列 | 无 | OpenAI |
| `gemini` | Gemini（Google） | 四色渐变 | Gemini |
| `grok` | Grok（xAI） | 无 | Grok |
| `deepseek` | DeepSeek | 蓝 | deepseek |
| `qwen` | 通义千问（阿里） | 紫 | Qwen |
| `hunyuan` | 腾讯混元 | 蓝 | 腾讯混元 |
| `kimi` | Kimi（月之暗面） | 白字蓝点，只用于深色底 | KIMI |
| `zhipu` | 智谱，GLM 系列 | 蓝 | 智谱·AI |
| `zai` | Z.ai，智谱的国际品牌，GLM 系列 | 无 | Z.ai |
| `doubao` | 豆包（字节跳动） | 蓝绿紫 | 豆包大模型 |
| `minimax` | MiniMax | 粉橙 | MINIMAX |

## 用法

- 单色文件用 `fill="currentColor"`，内联进页面或当 CSS `mask` 用，颜色跟随文字；当 `<img>` 引用时一律显示黑色。彩色版可以直接当 `<img>`。
- 尺寸只由 viewBox 决定，在 CSS 里设高度即可；字标宽度各不相同。
- 单色版在浅色主题用墨色 `#1A1726`，深色主题用纸色 `#F2F1F6`。不要把厂商 logo 染成紫色或荧光绿；需要彩色时只用各家自带的彩色版。
