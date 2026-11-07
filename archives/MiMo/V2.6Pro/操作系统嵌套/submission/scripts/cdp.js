// CDP 客户端: 连接 Electron 调试端口,截图/求值/点击等
// 用法: node scripts/cdp.js shot <out.png> | eval "<js>" | evalfile <file.js>
const http = require('http');

const PORT = process.env.CDP_PORT || 19106;

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const cmd = process.argv[2] || 'eval';
  const arg = process.argv[3] || '';
  const targets = await getTargets();
  const page = targets.find((t) => t.type === 'page' && !t.url.includes('devtools://'))
    || targets.find((t) => t.type === 'page');
  if (!page) {
    console.error('no page target');
    process.exit(1);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message));
      else p.resolve(m.result);
    }
  };
  await new Promise((r) => { ws.onopen = r; });

  if (cmd === 'shot') {
    const out = arg || 'shot.png';
    const r = await send('Page.captureScreenshot', { format: 'png' });
    require('fs').writeFileSync(out, Buffer.from(r.data, 'base64'));
    console.log('saved', out);
  } else if (cmd === 'eval') {
    const r = await send('Runtime.evaluate', {
      expression: arg,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      console.error('EXCEPTION:', JSON.stringify(r.exceptionDetails, null, 2));
    } else {
      console.log(JSON.stringify(r.result && r.result.value, null, 2));
    }
  } else if (cmd === 'evalfile') {
    const src = require('fs').readFileSync(arg, 'utf8');
    const r = await send('Runtime.evaluate', {
      expression: src,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      console.error('EXCEPTION:', JSON.stringify(r.exceptionDetails, null, 2));
    } else {
      console.log(JSON.stringify(r.result && r.result.value, null, 2));
    }
  } else if (cmd === 'targets') {
    console.log(JSON.stringify(targets.map((t) => ({ type: t.type, url: t.url, title: t.title })), null, 2));
  } else {
    console.error('unknown cmd', cmd);
  }
  ws.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
