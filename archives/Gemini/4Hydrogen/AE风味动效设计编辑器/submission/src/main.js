// 应用入口：挂载 AE 风格动效设计编辑器（IIFE 打包，纯 file:// 本地双击即可运行）

import { AEEditorApp } from './ui/App.js';

function boot() {
  const root = document.getElementById('app');
  if (!root) return;
  try {
    const app = new AEEditorApp(root);
    window.__AE_APP__ = app;
  } catch (err) {
    console.error('编辑器初始化异常:', err);
    root.innerHTML = `<div style="padding:28px;color:#fecaca;background:#1f1215;font-family:sans-serif;">
      <h2>编辑器启动遇到异常</h2>
      <pre style="white-space:pre-wrap;">${err && err.stack ? err.stack : String(err)}</pre>
    </div>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
