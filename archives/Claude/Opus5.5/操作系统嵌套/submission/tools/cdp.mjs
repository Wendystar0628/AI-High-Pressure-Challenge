// 开发用：通过调试端口操作 Electron 主窗口（求值、截图、鼠标、键盘）
// 用法：node tools/cdp.mjs <port> eval "<js>" | shot <file> | click x y | key <key> | type <text> | drag x1 y1 x2 y2
const [port, cmd, ...rest] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = list.find((t) => t.type === 'page' && t.url.startsWith('app://'));
if (!page) { console.error('no page', list.map((t) => t.url)); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) return 'EXC: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 1500);
  return r.result && r.result.result ? r.result.result.value : r;
}
async function mouse(type, x, y, button = 'left', clickCount = 1) { await send('Input.dispatchMouseEvent', { type, x, y, button, clickCount, buttons: type === 'mouseReleased' ? 0 : 1 }); }
if (cmd === 'eval') { const v = await evalJs(rest.join(' ')); console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1)); }
else if (cmd === 'shot') { const r = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(rest[0], Buffer.from(r.result.data, 'base64')); console.log('saved', rest[0]); }
else if (cmd === 'click' || cmd === 'dbl') { const x = +rest[0], y = +rest[1]; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await mouse('mousePressed', x, y, rest[2] || 'left', 1); await mouse('mouseReleased', x, y, rest[2] || 'left', 1); if (cmd === 'dbl') { await mouse('mousePressed', x, y, 'left', 2); await mouse('mouseReleased', x, y, 'left', 2); } console.log('ok'); }
else if (cmd === 'drag') { const [x1, y1, x2, y2] = rest.map(Number); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1 }); await mouse('mousePressed', x1, y1); for (let i = 1; i <= 12; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1 + (x2 - x1) * i / 12, y: y1 + (y2 - y1) * i / 12, button: 'left', buttons: 1 }); await sleep(30); } await mouse('mouseReleased', x2, y2); console.log('ok'); }
else if (cmd === 'keys') { for (const ch of rest.join(' ')) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); } console.log('ok'); }
else if (cmd === 'type') { await send('Input.insertText', { text: rest.join(' ') }); console.log('ok'); }
else if (cmd === 'key') { const key = rest[0]; const code = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46 }[key] || key.toUpperCase().charCodeAt(0); await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, windowsVirtualKeyCode: code, code: key }); if (key.length === 1) await send('Input.dispatchKeyEvent', { type: 'char', text: key, key }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: code }); console.log('ok'); }
else if (cmd === 'sel' || cmd === 'dblsel') {
  const r = await evalJs('(() => { const els = [...document.querySelectorAll(' + JSON.stringify(rest[0]) + ')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }); const e = els[' + (rest[1] || 0) + ']; if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, els.length]; })()');
  if (!r) { console.log('not found'); } else {
    const [x, y] = r;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await mouse('mousePressed', x, y, 'left', 1); await mouse('mouseReleased', x, y, 'left', 1);
    if (cmd === 'dblsel') { await mouse('mousePressed', x, y, 'left', 2); await mouse('mouseReleased', x, y, 'left', 2); }
    console.log('clicked', r);
  }
}
ws.close();
process.exit(0);
