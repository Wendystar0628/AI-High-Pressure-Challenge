// 通过 Chrome DevTools Protocol 检查 Electron 应用。
// 用法：node tools/cdp.mjs eval "1+1" | shot <file> | click <x> <y> | type <text> | key <key> | targets
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || '19116';
const base = `http://127.0.0.1:${PORT}`;

async function targets() {
  const res = await fetch(base + '/json/list');
  return res.json();
}

async function getTarget() {
  const list = await targets();
  const page = list.find((t) => t.type === 'page' && (t.title.includes('NESTED') || t.title.includes('Nested') || t.url.includes('index.html')));
  if (!page) throw new Error('找不到 NESTED OS 页面');
  return page;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let idSeq = 1;
    const pending = new Map();
    ws.addEventListener('open', () => resolve({
      ws,
      send(method, params = {}) {
        const id = idSeq++;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((res, rej) => {
          pending.set(id, { res, rej });
          setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('CDP timeout: ' + method)); } }, 30000);
        });
      },
      close() { ws.close(); },
    }));
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error(msg.error.message));
        else p.res(msg.result);
      }
    });
    ws.addEventListener('error', (e) => reject(e));
  });
}

const args = process.argv.slice(2);
const cmd = args[0] || 'eval';
try {
  if (cmd === 'targets') {
    console.log(JSON.stringify(await targets(), null, 2));
    process.exit(0);
  }
  const target = await getTarget();
  const c = await connect(target.webSocketDebuggerUrl);
  if (cmd === 'eval') {
    const expression = args[1] || '1+1';
    const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) {
      console.error(JSON.stringify(r.exceptionDetails, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(r.result?.value ?? r.result, null, 2));
    }
  } else if (cmd === 'shot') {
    await c.send('Page.enable');
    const r = await c.send('Page.captureScreenshot', { format: 'png' });
    const out = args[1] || 'screen.png';
    fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
    console.log(out);
  } else if (cmd === 'click') {
    const x = Number(args[1]), y = Number(args[2]);
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    console.log('clicked', x, y);
  } else if (cmd === 'dblclick') {
    const x = Number(args[1]), y = Number(args[2]);
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 2 });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2 });
    console.log('doubleclicked', x, y);
  } else if (cmd === 'type') {
    const text = args.slice(1).join(' ');
    await c.send('Input.insertText', { text });
    console.log('typed', text.length, 'chars');
  } else if (cmd === 'key') {
    const key = args[1] || 'Enter';
    await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined });
    console.log('key', key);
  } else if (cmd === 'scroll') {
    const x = Number(args[1]), y = Number(args[2]), dy = Number(args[3] || 300);
    await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy });
    console.log('scrolled');
  } else if (cmd === 'console') {
    const r = await c.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__bootErrors||[])', returnByValue: true });
    console.log(r.result?.value);
  }
  c.close();
  setTimeout(() => process.exit(process.exitCode || 0), 80);
} catch (err) {
  console.error('ERR', err.message);
  process.exit(1);
}
