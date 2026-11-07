// 入口
import './ui/style.css';
import { App } from './app.js';
import { installVideoExport } from './export/videoExport.js';

const app = new App();
window.__app = app;

app.init().then(() => {
  installVideoExport(app);
  console.log('[AE 动效编辑器] 初始化完成');
}).catch((err) => {
  console.error('初始化失败', err);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:#12151c;color:#e26d6d;padding:40px;font-family:monospace;font-size:14px;z-index:9999;overflow:auto';
  el.textContent = '初始化失败: ' + (err && err.stack ? err.stack : err);
  document.body.appendChild(el);
});
