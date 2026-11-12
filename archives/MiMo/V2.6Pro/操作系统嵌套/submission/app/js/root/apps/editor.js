/* editor.js — text & program editor (KernelScript) */
import { el } from '../../utils.js';
import { parse, Interp } from '../../vm/ks.js';

export class EditorApp {
  constructor(root) {
    this.root = root;
    this.instances = new Set();
  }

  open(params = {}) {
    const state = {
      path: params.path || null,
      text: '',
      dirty: false,
      running: null
    };
    if (params.path) {
      try {
        const c = this.root.vfs.read(params.path);
        state.text = typeof c === 'string' ? c : JSON.stringify(c, null, 2);
      } catch (e) { }
    }
    if (params.text) state.text = params.text;
    if (!state.text && !params.path) {
      state.text = `// KernelScript 示例程序
// 点击"运行"执行，查看输出

let sum = 0;
let i = 1;
while (i <= 10) {
  sum = sum + i;
  i = i + 1;
}
sys.log("1 到 10 的和 =", sum);

fn greet(name) {
  return "你好, " + name;
}
sys.log(greet("Nested OS"));

let arr = [3, 1, 4, 1, 5];
let total = 0;
for (let j = 0; j < arr.length; j = j + 1) {
  total = total + arr[j];
}
sys.log("数组和 =", total);
return sum;
`;
    }

    const win = this.root.createWindow({
      appId: 'editor',
      title: (state.path || '未命名') + ' — 编辑器',
      icon: 'editor',
      w: 820, h: 560,
      onClose: () => true
    });
    this._render(win.body, state, win);
    return win;
  }

  _render(body, state, win) {
    body.innerHTML = '';
    const app = el('div', {
      class: 'app-root editor-wrap',
      'data-app-id': 'editor', 'data-system-id': this.root.id, 'data-window-id': win.id
    });

    const toolbar = el('div', { class: 'editor-toolbar' });
    const nameInput = el('input', {
      type: 'text', 'data-testid': 'editor-filename',
      value: state.path || '未命名.ks', style: 'width:240px'
    });
    const saveBtn = el('button', {
      class: 'btn primary', 'data-testid': 'editor-save', text: '保存',
      onclick: () => this._save(state, nameInput)
    });
    const runBtn = el('button', {
      class: 'btn', 'data-testid': 'editor-run', text: '▶ 运行',
      onclick: () => this._run(state)
    });
    const stopBtn = el('button', {
      class: 'btn', text: '■ 停止',
      onclick: () => this._stop(state)
    });
    toolbar.appendChild(nameInput);
    toolbar.appendChild(saveBtn);
    toolbar.appendChild(el('div', { class: 'sep' }));
    toolbar.appendChild(runBtn);
    toolbar.appendChild(stopBtn);

    const textarea = el('textarea', {
      class: 'editor-text', 'data-testid': 'editor-text',
      spellcheck: 'false'
    });
    textarea.value = state.text;
    textarea.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = textarea.selectionStart;
        textarea.value = textarea.value.slice(0, s) + '  ' + textarea.value.slice(textarea.selectionEnd);
        textarea.selectionStart = textarea.selectionEnd = s + 2;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this._save(state, nameInput);
      }
    });
    textarea.addEventListener('input', () => {
      state.text = textarea.value;
      state.dirty = true;
    });

    const output = el('div', { class: 'editor-output', 'data-testid': 'editor-output', text: '// 运行输出将显示在这里' });
    const status = el('div', { class: 'editor-status' }, [
      el('span', { text: 'KernelScript 编辑器' }),
      el('span', { text: 'Ctrl+S 保存 · ▶ 运行程序' })
    ]);

    app.appendChild(toolbar);
    app.appendChild(textarea);
    app.appendChild(output);
    app.appendChild(status);
    body.appendChild(app);

    state._els = { textarea, output, nameInput, win };
  }

  _save(state, nameInput) {
    const name = nameInput.value.trim();
    if (!name) return;
    const path = name.startsWith('/') ? name : '/Documents/' + name;
    try {
      this.root.vfs.write(path, state.text);
      state.path = path;
      state.dirty = false;
      this.root.notify('文件已保存', path);
    } catch (e) {
      this.root.toast('保存失败', e.message, 'bad');
    }
  }

  _run(state) {
    this._stop(state);
    const out = state._els.output;
    out.classList.remove('err');
    out.textContent = '';
    const log = (...args) => {
      out.textContent += args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n';
      out.scrollTop = out.scrollHeight;
    };
    let ast;
    try {
      ast = parse(state.text);
    } catch (e) {
      out.classList.add('err');
      out.textContent = '编译错误: ' + e.message;
      return;
    }
    const root = this.root;
    const interp = new Interp({
      sys: {
        time: () => root.now(),
        wait: (ms) => ({ ksSuspend: true, type: 'wait', ms }),
        pid: () => 1,
        log: (...a) => { log(...a); return null; },
        print: (...a) => { log(...a); return null; },
        readFile: (p) => ({ ksSuspend: true, type: 'syscall', request: { name: 'readFile', path: p } }),
        writeFile: (p, d) => ({ ksSuspend: true, type: 'syscall', request: { name: 'writeFile', path: p, data: d } }),
        listDir: (p) => ({ ksSuspend: true, type: 'syscall', request: { name: 'listDir', path: p } }),
        send: (pid, msg) => ({ ksSuspend: true, type: 'syscall', request: { name: 'send', to: pid, msg } }),
        recv: () => ({ ksSuspend: true, type: 'syscall', request: { name: 'recv' } }),
        spawn: (prog, args) => ({ ksSuspend: true, type: 'syscall', request: { name: 'spawn', prog, args } }),
        exit: () => { throw new Error('程序退出'); },
        now: () => root.now()
      }
    });
    interp.start(ast);
    state.running = { interp, log, timer: null };

    // drive it (host-run loop, bypassing subsystem scheduler for root preview)
    let lastInject;
    let hasInject = false;
    const step = () => {
      if (!state.running) return;
      const r = hasInject ? interp.run(8000, lastInject) : interp.run(8000);
      hasInject = false;
      if (r.status === 'done') {
        log('// 程序结束, 返回值: ' + JSON.stringify(r.value));
        state.running = null;
        return;
      }
      if (r.status === 'error') {
        out.classList.add('err');
        log('运行错误: ' + r.error);
        state.running = null;
        return;
      }
      if (r.status === 'budget') {
        state.running.timer = setTimeout(step, 10);
        return;
      }
      if (r.status === 'suspend') {
        const s = r.suspend;
        if (s.type === 'wait') {
          state.running.timer = setTimeout(step, Math.min(2000, s.ms || 10));
        } else if (s.type === 'syscall') {
          // resolve simple syscalls inline for root editor preview
          const req = s.request;
          let result = null;
          try {
            if (req.name === 'readFile') result = { ok: true, data: root.vfs.read(req.path) };
            else if (req.name === 'writeFile') { root.vfs.write(req.path, req.data); result = { ok: true }; }
            else if (req.name === 'listDir') result = { ok: true, list: root.vfs.list(req.path) };
            else if (req.name === 'send') {
              // deliver to root scheduler processes
              const ok = root.scheduler.deliver(req.to, { from: 1, data: req.msg });
              result = { ok };
            } else if (req.name === 'recv') {
              const p = root.scheduler.get(1);
              if (p && p.messages.length) result = { ok: true, msg: p.messages.shift() };
              else { state.running.timer = setTimeout(step, 50); return; }
            } else if (req.name === 'spawn') {
              result = { ok: false, error: '编辑器预览不支持 spawn，请在子系统中运行' };
            } else result = { ok: false, error: '未知系统调用 ' + req.name };
          } catch (e) {
            result = { ok: false, error: e.message };
          }
          lastInject = result;
          hasInject = true;
          state.running.timer = setTimeout(step, 0);
        } else {
          state.running.timer = setTimeout(step, 10);
        }
      }
    };
    step();
  }

  _stop(state) {
    if (state.running) {
      if (state.running.timer) clearTimeout(state.running.timer);
      state.running = null;
      if (state._els) {
        state._els.output.textContent += '// 已停止\n';
      }
    }
  }
}
