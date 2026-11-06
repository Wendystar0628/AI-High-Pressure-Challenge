# 双晶一芯 — NVIDIA B200 网页艺术

本页为概念设计作品，非 NVIDIA 官方页面。

双击根目录的 `index.html`，用 Chrome 打开即可运行，不需要网页服务器。

## 文件组织

- `index.html`：入口
- `dist/`：打包后的脚本和样式（three.js 已打包在内）
- `src/`：源码。`core/` 是时间轴、状态、编排和数值运算，`gfx/` 是渲染管线与几何工具，`models/` 是封装与系统模型，`chapters/` 是八章的文字、SVG 和交互，`data/specs.js` 是规格数据与来源
- 重新打包：`npm install` 后运行 `node build.mjs --min`

## 操作

- 滚轮或滚动条：前进和后退。第 04 章的纵向滚动会映射为横向前进
- 模型上拖动：旋转；方向键也可旋转（画布获得焦点时）；`+` `-` 缩放
- `E`：进入探索模式，滚轮改为缩放，页面不再滚动；`Esc` 退出或逐级返回
- `[` `]`：切换上一章、下一章；`Tab`：在控件间移动
- 右上角六种格式：全页共享的精度，默认 FP4

## 视频导出

```js
window.videoExport.runs                          // ['page']
await window.videoExport.begin('page', { fps })  // 返回 { chapters: [{ id, start, end, zones }] }
await window.videoExport.frame(progress, time)   // 放到全页进度 progress、动画时刻 time
window.videoExport.end()                         // 回到正常的可操作状态
```

## 数据口径

- 单颗 B200 有两种公开配置：HGX / DGX 约 1 kW、可用 180 GB；GB200 约 1.2 kW、可用 186 GB。物理容量按 8 × 24 GB = 192 GB
- 算力按产品页的“稀疏 | 稠密”列出，稠密为稀疏的一半；FP64 没有稀疏口径
- GB200 和 NVL72 的功耗不在产品页规格表内，页面上标为公开资料的常见量级
- 焊球、凸点、硅通孔的数量和晶粒内部布局是标明含义的示意

来源：

- [Blackwell 架构发布说明](https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing/)
- [GB200 NVL72 产品页](https://www.nvidia.com/en-us/data-center/gb200-nvl72/)
- [HGX 平台页](https://www.nvidia.com/en-us/data-center/hgx/)
- [DGX B200 产品页](https://www.nvidia.com/en-us/data-center/dgx-b200/)
- [Multi-Node NVLink 调优指南](https://docs.nvidia.com/multi-node-nvlink-systems/multi-node-tuning-guide/overview.html)
- [NVFP4 格式与缩放说明](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/)
- [DGX BasePOD 核心组件](https://docs.nvidia.com/dgx-basepod/reference-architecture-infrastructure-foundation-enterprise-ai/latest/core-components.html)
