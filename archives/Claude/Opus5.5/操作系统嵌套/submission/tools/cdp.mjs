// 开发检查工具：通过调试端口操作作品（求值、截图、鼠标、键盘）。
// 用法：node tools/cdp.mjs eval "<js>" | shot <file> | click <x> <y> | run <脚本文件>
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || 19136;
export async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page' && t.url.startsWith('nestos://')) || list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); if (d.error) rej(new Error(JSON.stringify(d.error))); else res(d.result); }
    else events.push(d);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (file, clip) => {
    const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  };
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: 1, ...extra });
  const click = async (x, y, extra = {}) => { await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y, extra); await mouse('mouseReleased', x, y, { buttons: 0, ...extra }); };
  const dbl = async (x, y) => { await click(x, y); await mouse('mousePressed', x, y, { clickCount: 2 }); await mouse('mouseReleased', x, y, { clickCount: 2, buttons: 0 }); };
  const drag = async (x0, y0, x1, y1, steps = 8) => {
    await mouse('mouseMoved', x0, y0, { buttons: 0 });
    await mouse('mousePressed', x0, y0);
    for (let i = 1; i <= steps; i++) { await mouse('mouseMoved', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await sleep(16); }
    await mouse('mouseReleased', x1, y1, { buttons: 0 });
  };
  const key = async (k, code, text, mods = 0) => {
    await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code: code || k, text, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : ({ Enter: 13, Escape: 27, Tab: 9, Delete: 46, Backspace: 8, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39 })[k] || 0, modifiers: mods });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: code || k, modifiers: mods });
  };
  const type = async (s) => { await send('Input.insertText', { text: s }); };
  const center = (sel) => evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};})()`);
  const clickEl = async (sel) => { const c = await center(sel); if (!c) throw new Error('找不到元素 ' + sel); await click(c.x, c.y); return c; };
  return { send, evalJs, shot, click, dbl, drag, key, type, center, clickEl, mouse, events, close: () => ws.close() };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.argv[1] && process.argv[1].endsWith('cdp.mjs')) {
  const [cmd, ...rest] = process.argv.slice(2);
  const c = await connect();
  if (cmd === 'eval') console.log(JSON.stringify(await c.evalJs(rest.join(' ')), null, 1));
  else if (cmd === 'shot') { await c.shot(rest[0]); console.log('saved', rest[0]); }
  else if (cmd === 'click') await c.click(+rest[0], +rest[1]);
  else if (cmd === 'clickel') console.log(await c.clickEl(rest.join(' ')));
  c.close();
}
