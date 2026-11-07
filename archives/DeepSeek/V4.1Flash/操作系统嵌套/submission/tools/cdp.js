// 开发检查工具：通过 CDP 操作/截图 Electron 渲染进程
const fs = require('fs');
const http = require('http');
const PORT = process.argv[2] || 19106;
const MODE = process.argv[3] || 'eval';
const ARG = process.argv[4] || '';

function getJson() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json' }, (res) => {
      let s = '';
      res.on('data', d => s += d);
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
async function main() {
  const pages = await getJson();
  const page = pages.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
  if (MODE === 'shot') {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(ARG || 'shot.png', Buffer.from(r.result.data, 'base64'));
    console.log(ARG || 'shot.png');
  } else if (MODE === 'eval' || MODE === 'evalfile') {
    const expression = MODE === 'evalfile' ? fs.readFileSync(ARG, 'utf8') : (ARG || 'document.title');
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) {
      console.log(JSON.stringify({ exception: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text }, null, 2));
    } else {
      console.log(JSON.stringify(r.result && r.result.result ? r.result.result.value : r, null, 2));
    }
  } else if (MODE === 'snap') {
    const r = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,4000)', returnByValue: true });
    console.log(r.result.result.value);
  }
  ws.close();
}
main().catch(e => { console.error(e); process.exit(1); });
