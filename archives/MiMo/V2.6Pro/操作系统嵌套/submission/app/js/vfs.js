/* vfs.js — virtual file system for each OS instance.
   A file is { name, type: 'file'|'dir', content: string|array|object, children: {}, meta: {} }.
   All systems share the same VFS class; instances are independent. */
import { deepClone } from './utils.js';

function now() { return Date.now(); }

export class VFS {
  constructor(name = 'root') {
    this.name = name;
    this.root = { name: '', type: 'dir', children: {}, meta: { created: now() } };
  }
  static normalize(path) {
    if (!path || path === '/') return [];
    return path.split('/').filter(x => x && x !== '.').map(x => x === '..' ? '..' : x);
  }
  _resolve(path, createDirs = false) {
    const parts = VFS.normalize(path);
    let node = this.root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p === '..') return null;
      if (node.type !== 'dir') return null;
      if (!node.children[p]) {
        if (createDirs && i < parts.length - 1) {
          node.children[p] = { name: p, type: 'dir', children: {}, meta: { created: now() } };
        } else return null;
      }
      node = node.children[p];
    }
    return node;
  }
  exists(path) { return !!this._resolve(path); }
  isDir(path) { const n = this._resolve(path); return !!n && n.type === 'dir'; }
  read(path) {
    const n = this._resolve(path);
    if (!n) throw new Error('文件不存在: ' + path);
    if (n.type === 'dir') throw new Error('是目录: ' + path);
    return deepClone(n.content);
  }
  readText(path) {
    const c = this.read(path);
    return typeof c === 'string' ? c : JSON.stringify(c, null, 2);
  }
  write(path, content, type = 'file') {
    const parts = VFS.normalize(path);
    if (!parts.length) throw new Error('无效路径');
    const name = parts[parts.length - 1];
    let dir = this._resolve('/' + parts.slice(0, -1).join('/'), true);
    if (!dir) {
      // create parent chain
      dir = this.root;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!dir.children[parts[i]]) dir.children[parts[i]] = { name: parts[i], type: 'dir', children: {}, meta: { created: now() } };
        dir = dir.children[parts[i]];
        if (dir.type !== 'dir') throw new Error('路径冲突: ' + parts[i]);
      }
    }
    if (dir.type !== 'dir') throw new Error('父路径不是目录');
    const existing = dir.children[name];
    dir.children[name] = {
      name, type, content: type === 'file' ? deepClone(content) : undefined,
      children: type === 'dir' ? (existing && existing.type === 'dir' ? existing.children : {}) : undefined,
      meta: { created: existing ? existing.meta.created : now(), modified: now(), size: estimateSize(content) }
    };
  }
  mkdir(path) {
    const parts = VFS.normalize(path);
    if (!parts.length) throw new Error('无效路径');
    let node = this.root;
    for (const p of parts) {
      if (!node.children[p]) node.children[p] = { name: p, type: 'dir', children: {}, meta: { created: now() } };
      node = node.children[p];
      if (node.type !== 'dir') throw new Error('路径冲突: ' + p);
    }
    return true;
  }
  list(path) {
    const n = this._resolve(path);
    if (!n) throw new Error('目录不存在: ' + path);
    if (n.type !== 'dir') throw new Error('不是目录: ' + path);
    return Object.values(n.children).map(c => ({
      name: c.name, type: c.type,
      size: c.type === 'file' ? estimateSize(c.content) : countBytes(c),
      modified: c.meta.modified, created: c.meta.created
    })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  }
  delete(path) {
    const parts = VFS.normalize(path);
    if (!parts.length) throw new Error('不能删除根');
    const name = parts[parts.length - 1];
    const parent = this._resolve('/' + parts.slice(0, -1).join('/'));
    if (!parent || !parent.children[name]) throw new Error('不存在: ' + path);
    const node = parent.children[name];
    delete parent.children[name];
    return deepClone(node);
  }
  rename(from, to) {
    const node = this.delete(from);
    const parts = VFS.normalize(to);
    const name = parts[parts.length - 1];
    node.name = name;
    let dir = this.root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!dir.children[parts[i]]) dir.children[parts[i]] = { name: parts[i], type: 'dir', children: {}, meta: { created: now() } };
      dir = dir.children[parts[i]];
      if (dir.type !== 'dir') throw new Error('路径冲突');
    }
    if (dir.children[name]) throw new Error('目标已存在: ' + to);
    dir.children[name] = node;
    return true;
  }
  copy(from, to) {
    const node = this._resolve(from);
    if (!node) throw new Error('不存在: ' + from);
    this.write(to, node.type === 'file' ? node.content : undefined, node.type);
    if (node.type === 'dir') {
      const target = this._resolve(to);
      for (const k in node.children) {
        this.copy(from + '/' + k, to + '/' + k);
      }
    }
    return true;
  }
  move(from, to) {
    this.copy(from, to);
    this.delete(from);
    return true;
  }
  stat(path) {
    const n = this._resolve(path);
    if (!n) return null;
    return {
      name: n.name, type: n.type,
      size: n.type === 'file' ? estimateSize(n.content) : countBytes(n),
      created: n.meta.created, modified: n.meta.modified
    };
  }
  totalBytes() { return countBytes(this.root); }
  serialize() { return JSON.stringify(this.root); }
  static deserialize(json, name = 'root') {
    const v = new VFS(name);
    v.root = JSON.parse(json);
    return v;
  }
  clone() { return VFS.deserialize(this.serialize(), this.name + '-clone'); }
  /* seed standard directory structure */
  seed() {
    this.mkdir('/Documents');
    this.mkdir('/Downloads');
    this.mkdir('/RecycleBin');
    this.mkdir('/Demo');
    this.mkdir('/Programs');
    this.mkdir('/System');
  }
}

function estimateSize(content) {
  if (content === undefined || content === null) return 0;
  if (typeof content === 'string') return content.length;
  return JSON.stringify(content).length;
}
function countBytes(node) {
  if (!node) return 0;
  if (node.type === 'file') return estimateSize(node.content);
  let s = 0;
  for (const k in node.children) s += countBytes(node.children[k]);
  return s;
}
