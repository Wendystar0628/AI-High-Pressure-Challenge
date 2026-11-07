// 根系统虚拟文件系统(宿主实现,持久化到 --data-dir)
// 路径统一使用 / 开头的绝对路径;目录以 '/' 结尾。
import { EventBus } from './util.js';

export class FileSystem {
  constructor() {
    this.files = new Map();   // path -> {content, kind, mtime, size, meta}
    this.bus = new EventBus();
    this.dirty = false;
  }

  normalize(p) {
    if (!p) return '/';
    p = String(p).replace(/\\/g, '/');
    if (!p.startsWith('/')) p = '/' + p;
    const parts = [];
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return '/' + parts.join('/');
  }

  mkdir(path) {
    path = this.normalize(path);
    if (!path.endsWith('/')) path += '/';
    if (!this.files.has(path)) {
      this.files.set(path, { kind: 'dir', content: '', mtime: Date.now(), size: 0 });
      this._changed('mkdir', path);
    }
  }

  writeFile(path, content, meta = {}) {
    path = this.normalize(path);
    if (this.files.get(path)?.kind === 'dir') throw new Error('路径是目录: ' + path);
    // 确保父目录存在
    const parent = path.substring(0, path.lastIndexOf('/') + 1);
    this.mkdir(parent);
    this.files.set(path, {
      kind: meta.kind || 'file',
      content: String(content),
      mtime: Date.now(),
      size: String(content).length,
      meta,
    });
    this._changed('write', path);
  }

  readFile(path) {
    path = this.normalize(path);
    const f = this.files.get(path);
    if (!f || f.kind === 'dir') return null;
    return f.content;
  }

  stat(path) {
    path = this.normalize(path);
    if (!path.endsWith('/') && this.files.has(path + '/')) path += '/';
    return this.files.get(path) || null;
  }

  exists(path) {
    return !!this.stat(path);
  }

  list(path) {
    path = this.normalize(path);
    if (!path.endsWith('/')) path += '/';
    const out = [];
    for (const [p, f] of this.files) {
      if (!p.startsWith(path)) continue;
      const rest = p.slice(path.length);
      if (!rest) continue;
      if (rest.endsWith('/')) {
        if (!rest.slice(0, -1).includes('/')) {
          out.push({ path: p, name: rest.slice(0, -1), kind: 'dir', size: 0, mtime: f.mtime });
        }
      } else if (!rest.includes('/')) {
        out.push({ path: p, name: rest, kind: f.kind, size: f.size, mtime: f.mtime, meta: f.meta || {} });
      }
    }
    out.sort((a, b) => {
      if (a.kind === 'dir' && b.kind !== 'dir') return -1;
      if (b.kind === 'dir' && a.kind !== 'dir') return 1;
      return a.name.localeCompare(b.name, 'zh');
    });
    return out;
  }

  delete(path, { toRecycle = true } = {}) {
    path = this.normalize(path);
    const f = this.files.get(path);
    if (!f) return false;
    if (f.kind === 'dir') {
      const prefix = path.endsWith('/') ? path : path + '/';
      for (const p of [...this.files.keys()]) {
        if (p.startsWith(prefix) || p === path) {
          this._trash(p, this.files.get(p));
          this.files.delete(p);
        }
      }
    } else {
      this._trash(path, f);
      this.files.delete(path);
    }
    this._changed('delete', path);
    return true;
  }

  _trash(path, f) {
    if (!f || String(path).startsWith('/RecycleBin/')) return;
    const name = path.split('/').filter(Boolean).pop();
    let dest = '/RecycleBin/' + name;
    let i = 1;
    while (this.files.has(dest)) dest = '/RecycleBin/' + name + '.' + (i++);
    this.files.set(dest, {
      ...f,
      mtime: Date.now(),
      meta: { ...(f.meta || {}), origPath: path },
    });
  }

  restoreFromRecycle(path) {
    const f = this.files.get(path);
    if (!f) return false;
    const orig = (f.meta && f.meta.origPath) || ('/Documents/' + path.split('/').pop());
    this.files.delete(path);
    const parent = orig.substring(0, orig.lastIndexOf('/') + 1);
    this.mkdir(parent);
    this.files.set(orig, { ...f, mtime: Date.now(), meta: { ...(f.meta || {}), origPath: undefined } });
    this._changed('restore', orig);
    return true;
  }

  emptyRecycle() {
    for (const p of [...this.files.keys()]) {
      if (p.startsWith('/RecycleBin/')) this.files.delete(p);
    }
    this._changed('emptyRecycle', '/RecycleBin/');
  }

  rename(path, newName) {
    path = this.normalize(path);
    const f = this.files.get(path);
    if (!f) return false;
    const parent = path.substring(0, path.lastIndexOf('/') + 1);
    const dest = parent + newName;
    if (this.files.has(dest)) throw new Error('目标名称已存在');
    if (f.kind === 'dir') {
      const prefix = path.endsWith('/') ? path : path + '/';
      const destDir = dest.endsWith('/') ? dest : dest + '/';
      for (const p of [...this.files.keys()]) {
        if (p === path || p === prefix) {
          this.files.set(destDir, this.files.get(p));
          this.files.delete(p);
        } else if (p.startsWith(prefix)) {
          this.files.set(destDir + p.slice(prefix.length), this.files.get(p));
          this.files.delete(p);
        }
      }
    } else {
      this.files.set(dest, f);
      this.files.delete(path);
    }
    this._changed('rename', dest);
    return true;
  }

  copy(src, destDir) {
    src = this.normalize(src);
    destDir = this.normalize(destDir);
    if (!destDir.endsWith('/')) destDir += '/';
    const f = this.files.get(src);
    if (!f) return false;
    const name = src.split('/').filter(Boolean).pop();
    let dest = destDir + name;
    let i = 1;
    while (this.files.has(dest)) dest = destDir + name + ' (' + (i++) + ')';
    if (f.kind === 'dir') {
      const prefix = src.endsWith('/') ? src : src + '/';
      this.mkdir(dest);
      for (const p of this.files.keys()) {
        if (p.startsWith(prefix)) {
          this.files.set(dest + '/' + p.slice(prefix.length), { ...this.files.get(p) });
        }
      }
    } else {
      this.files.set(dest, { ...f, mtime: Date.now() });
    }
    this._changed('copy', dest);
    return dest;
  }

  move(src, destDir) {
    const dest = this.copy(src, destDir);
    if (dest) this.delete(src, { toRecycle: false });
    return dest;
  }

  totalSize() {
    let s = 0;
    for (const f of this.files.values()) s += f.size || 0;
    return s;
  }

  serialize() {
    const obj = {};
    for (const [p, f] of this.files) obj[p] = f;
    return obj;
  }

  load(obj) {
    this.files = new Map(Object.entries(obj || {}));
    this._changed('load', '/');
  }

  _changed(op, path) {
    this.dirty = true;
    this.bus.emit('change', { op, path });
  }
}

// ---- 预置内容 ----
export function seedFileSystem(fs, sceneJson, kernelSources) {
  fs.mkdir('/Documents');
  fs.mkdir('/Demo');
  fs.mkdir('/Downloads');
  fs.mkdir('/RecycleBin');
  fs.mkdir('/System');
  fs.mkdir('/System/Kernels');
  fs.mkdir('/Programs');

  // 示例工作簿
  fs.writeFile('/Demo/sample.sheet', JSON.stringify({
    format: 'nested-sheet/1',
    name: '示例工作簿',
    cells: {
      A1: '项目', B1: '数量', C1: '单价', D1: '小计',
      A2: '项目 A', B2: 24, C2: 6, D2: '=B2*C2',
      A3: '项目 B', B3: 12, C3: 8, D3: '=B3*C3',
      A4: '项目 C', B4: 18, C4: 4, D4: '=B4*C4',
      A6: '合计', D6: '=SUM(D2:D4)',
    },
  }, null, 2), { kind: 'sheet' });

  // 直升机场景
  fs.writeFile('/Demo/helicopter-24.scene', sceneJson, { kind: 'scene' });

  // 内核源文件
  if (kernelSources) {
    for (const [name, text] of Object.entries(kernelSources)) {
      fs.writeFile('/System/Kernels/' + name, text, { kind: 'sys' });
    }
  }

  // 示例程序
  fs.writeFile('/Programs/accumulate.prog', `# 累加计算: 计算 1+2+...+N 并输出
var n = 10
var sum = 0
var i = 1
while i <= n
  sum = sum + i
  i = i + 1
end
sys.log("累加结果: " + str(sum))
`, { kind: 'prog' });

  fs.writeFile('/Programs/send.prog', `# 消息发送: 向指定进程发送消息
var target = num(sys.argv(1))
var text = sys.argv(2)
sys.send(target, { from: sys.self(), text: text, at: sys.time() })
sys.log("已发送消息给进程 " + str(target))
`, { kind: 'prog' });

  fs.writeFile('/Programs/recv.prog', `# 消息接收: 等待并打印收到的消息
sys.log("等待消息中…")
var m = sys.recv(10000)
if m == null
  sys.log("超时未收到消息")
else
  sys.log("收到消息: " + str(m))
end
`, { kind: 'prog' });

  fs.writeFile('/Programs/spin.prog', `# 持续计算: 不主动让出,用于检验调度
var n = 0
while true
  n = n + 1
  if n % 100000 == 0
    sys.log("持续计算中: " + str(n))
  end
end
`, { kind: 'prog' });

  fs.writeFile('/Documents/说明-程序格式.txt',
    `程序格式说明(简要):
- 以 # 开头的行为注释
- var 声明变量;支持数字、字符串、布尔、数组、对象
- if/else/end、while/end、for/end 控制流程
- sys.time() 虚拟时间(毫秒); sys.wait(ms) 等待
- sys.send(pid, msg) / sys.recv(timeout) 消息
- sys.readFile / sys.writeFile 文件
- sys.log(text) 输出到进程日志
完整说明请打开桌面「操作说明」。
`);
  return fs;
}
