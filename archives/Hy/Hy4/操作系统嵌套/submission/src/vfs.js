'use strict';
// 每个系统独立的虚拟文件系统：目录树 + 文件内容（字符串）。文件内容按长度计入存储配额。

class VFS {
  constructor() { this.nodes = { '/': { type: 'dir', created: 0, modified: 0 } }; }
  static norm(p) {
    if (!p) return '/';
    p = String(p).replace(/\\/g, '/');
    if (p[0] !== '/') p = '/' + p;
    const parts = [];
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop(); else parts.push(seg);
    }
    return '/' + parts.join('/');
  }
  static dirname(p) { p = VFS.norm(p); return p === '/' ? '/' : VFS.norm(p.slice(0, p.lastIndexOf('/')) || '/'); }
  static basename(p) { p = VFS.norm(p); return p === '/' ? '/' : p.slice(p.lastIndexOf('/') + 1); }
  static join(a, b) { return VFS.norm((a === '/' ? '' : VFS.norm(a)) + '/' + b); }
  exists(p) { return !!this.nodes[VFS.norm(p)]; }
  isDir(p) { const n = this.nodes[VFS.norm(p)]; return !!n && n.type === 'dir'; }
  isFile(p) { const n = this.nodes[VFS.norm(p)]; return !!n && n.type === 'file'; }
  read(p) { const n = this.nodes[VFS.norm(p)]; return (n && n.type === 'file') ? n.content : null; }
  node(p) { return this.nodes[VFS.norm(p)] || null; }
  ensureDir(p) {
    p = VFS.norm(p);
    if (this.nodes[p]) return this.nodes[p].type === 'dir';
    const parent = VFS.dirname(p);
    if (parent !== p && !this.exists(parent)) { if (!this.ensureDir(parent)) return false; }
    if (this.nodes[parent] && this.nodes[parent].type !== 'dir') return false;
    this.nodes[p] = { type: 'dir', created: 0, modified: 0 };
    return true;
  }
  write(p, content, format) {
    p = VFS.norm(p);
    if (p === '/') return false;
    if (!this.ensureDir(VFS.dirname(p))) return false;
    this.nodes[p] = Object.assign(this.nodes[p] && this.nodes[p].type === 'file' ? this.nodes[p] : {}, {
      type: 'file', content: String(content == null ? '' : content),
      format: format || this.guessFormat(p), modified: 0
    });
    return true;
  }
  guessFormat(p) {
    const m = /\.([^.]+)$/.exec(p);
    return m ? m[1] : 'txt';
  }
  mkdir(p) {
    p = VFS.norm(p);
    if (p === '/' || this.exists(p)) return false;
    return this.ensureDir(p);
  }
  list(p) {
    p = VFS.norm(p);
    const n = this.nodes[p];
    if (!n || n.type !== 'dir') return null;
    const out = [];
    for (const k in this.nodes) {
      if (k === p) continue;
      if (VFS.dirname(k) === p) {
        const c = this.nodes[k];
        out.push({ name: VFS.basename(k), path: k, type: c.type, size: c.type === 'file' ? String(c.content).length : 0,
          format: c.format || (c.type === 'dir' ? 'dir' : 'txt'), origPath: c.origPath || null, modified: c.modified });
      }
    }
    out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'zh') : (a.type === 'dir' ? -1 : 1)));
    return out;
  }
  remove(p) {
    p = VFS.norm(p);
    if (p === '/' || !this.exists(p)) return false;
    for (const k in this.nodes) if (k === p || k.startsWith(p + '/')) delete this.nodes[k];
    return true;
  }
  deleteToTrash(p) {
    p = VFS.norm(p);
    const n = this.nodes[p];
    if (!n || n.type !== 'file' || p.startsWith('/Recycle Bin')) return false;
    this.ensureDir('/Recycle Bin');
    let dest = VFS.join('/Recycle Bin', VFS.basename(p));
    let i = 1;
    while (this.exists(dest)) dest = VFS.join('/Recycle Bin', VFS.basename(p) + ' (' + (i++) + ')');
    const copy = Object.assign({}, n, { origPath: p });
    this.nodes[dest] = copy;
    delete this.nodes[p];
    return dest;
  }
  restoreFromTrash(p) {
    const n = this.nodes[VFS.norm(p)];
    if (!n || !n.origPath) return false;
    let dest = n.origPath;
    let i = 1;
    while (this.exists(dest)) {
      const dot = dest.lastIndexOf('.');
      dest = (dot > 0 ? dest.slice(0, dot) : dest) + ' (恢复' + (i++) + ')' + (dot > 0 ? dest.slice(dot) : '');
    }
    this.ensureDir(VFS.dirname(dest));
    this.nodes[dest] = Object.assign({}, n);
    delete this.nodes[dest].origPath;
    delete this.nodes[VFS.norm(p)];
    return dest;
  }
  copy(src, dst) {
    src = VFS.norm(src); dst = VFS.norm(dst);
    const n = this.nodes[src];
    if (!n || n.type !== 'file') return false;
    return this.write(dst, n.content, n.format);
  }
  move(src, dst) {
    if (!this.copy(src, dst)) return false;
    return this.remove(src);
  }
  rename(p, name) {
    p = VFS.norm(p);
    if (p === '/' || !this.exists(p) || !name || String(name).includes('/')) return false;
    const dst = VFS.join(VFS.dirname(p), name);
    if (dst === p) return true;
    if (this.exists(dst)) return false;
    const n = this.nodes[p];
    if (n.type === 'file') { this.nodes[dst] = n; delete this.nodes[p]; return true; }
    const prefix = p + '/';
    for (const k in this.nodes) {
      if (k === p || k.startsWith(prefix)) {
        const nk = dst + k.slice(p.length);
        this.nodes[nk] = this.nodes[k]; delete this.nodes[k];
      }
    }
    return true;
  }
  usage() {
    let n = 0;
    for (const k in this.nodes) if (this.nodes[k].type === 'file') n += String(this.nodes[k].content).length;
    return n;
  }
  allFiles() {
    return Object.keys(this.nodes).filter(k => this.nodes[k].type === 'file').sort();
  }
  serialize() { return JSON.parse(JSON.stringify(this.nodes)); }
  static deserialize(o) { const v = new VFS(); v.nodes = o || { '/': { type: 'dir' } }; return v; }
}
module.exports = { VFS };
