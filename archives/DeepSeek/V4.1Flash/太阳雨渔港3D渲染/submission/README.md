# 太阳雨中的小渔港堤岸 / Shiomi Harbour

一个使用 Three.js 制作的微缩港口 3D 场景，位于一块正方形底座上。所有素材均由代码与 Canvas 程序化生成，不依赖网络、贴图文件或本地服务器。

## 运行

直接用 Chrome 打开根目录下的 `index.html`（`file://` 方式）即可。

- 鼠标左键拖拽：旋转
- 滚轮：缩放
- 鼠标右键 / Shift + 拖拽：平移
- 双击：回到默认视角

## 视频导出接口

作品内置一段约 62 秒的 `tour` 镜头组，环境动态是确定性的时间函数，因此可按帧精确导出：

```js
window.videoExport.runs                 // ['tour']
await window.videoExport.begin('tour', { fps })
// -> { frames }  总帧数 = 62 * fps；调用后第 0 帧即已渲染
await window.videoExport.frame(i)       // i 从 0 递增，完成时第 i 帧已经渲染在页面上
window.videoExport.end()                // 恢复普通可交互观看
```

支持 3 fps 预览与 60 fps 正式导出；导出分辨率随浏览器窗口自动适配（含 3840×2160）。
