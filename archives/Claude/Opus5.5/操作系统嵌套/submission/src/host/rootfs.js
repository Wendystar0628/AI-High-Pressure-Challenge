// 根系统文件系统（宿主实现）。子系统的磁盘也以目录形式存放在这里：
// /System/Disks/<inner-N>/...（子系统内核经父系统接口写透）。
import { hashStr } from '../vm/vm.js';

export class RootFS {
  constructor() {
    this.files = new Map();
    this.files.set('/', { type: 'dir', mtime: Date.now(), size: 0 });
    this.quota = 2 * 1024 * 1024 * 1024;
    this.used = 0;
    this.listeners = new Set();
    this.dirty = false;
    this.saveTimer = null;
    this.persist = null; // 由宿主设置
    this.chargeHook = null;
  }
  norm(p) {
    if (typeof p !== 'string') throw new Error('路径必须是字符串');
    if (!p.startsWith('/')) p = '/' + p;
    p = p.replace(/\/+/g, '/');
    while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }
  dirname(p) { const i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); }
  basename(p) { return p.slice(p.lastIndexOf('/') + 1); }
  join(d, n) { return d === '/' ? '/' + n : d + '/' + n; }
  get(p) { return this.files.get(this.norm(p)) || null; }
  exists(p) { return this.files.has(this.norm(p)); }
  isDir(p) { const e = this.get(p); return !!e && e.type === 'dir'; }
  charge(n) { if (this.chargeHook) this.chargeHook(n); }
  changed(p, kind) {
    this.dirty = true;
    for (const l of this.listeners) { try { l(p, kind); } catch (e) { console.error(e); } }
    if (this.persist && !this.saveTimer) this.saveTimer = setTimeout(() => { this.saveTimer = null; this.flush(); }, 1200);
  }
  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }

  mkdir(p, quiet) {
    p = this.norm(p);
    if (p === '/') return true;
    const e = this.files.get(p);
    if (e) { if (e.type === 'dir') return true; throw new Error('已存在同名文件: ' + p); }
    this.mkdir(this.dirname(p), true);
    this.files.set(p, { type: 'dir', mtime: Date.now(), size: 0 });
    if (!quiet) this.changed(p, 'mkdir'); else this.dirty = true;
    return true;
  }
  write(p, data, meta) {
    p = this.norm(p);
    if (typeof data !== 'string') data = String(data);
    const old = this.files.get(p);
    if (old && old.type === 'dir') throw new Error('是目录: ' + p);
    const delta = data.length - (old ? old.size : 0);
    if (this.used + delta > this.quota) throw new Error(`存储配额不足：需要 ${fmtB(this.used + delta)}，配额 ${fmtB(this.quota)}`);
    this.mkdir(this.dirname(p), true);
    this.files.set(p, { type: 'file', data, mtime: Date.now(), size: data.length, meta: meta || (old && old.meta) || null });
    this.used += delta;
    this.charge(Math.ceil(data.length / 32));
    this.changed(p, 'write');
    return true;
  }
  read(p) {
    const e = this.get(p);
    if (!e) return null;
    if (e.type === 'dir') throw new Error('是目录: ' + p);
    this.charge(Math.ceil(e.size / 64));
    return e.data;
  }
  list(dir) {
    dir = this.norm(dir);
    if (!this.isDir(dir)) throw new Error('目录不存在: ' + dir);
    const prefix = dir === '/' ? '/' : dir + '/';
    const out = [];
    for (const [p, e] of this.files) {
      if (p !== dir && p.startsWith(prefix) && p.indexOf('/', prefix.length) < 0) {
        out.push({ name: p.slice(prefix.length), path: p, type: e.type, size: e.type === 'dir' ? this.dirSize(p) : e.size, mtime: e.mtime, meta: e.meta || null });
      }
    }
    this.charge(Math.ceil(out.length / 4));
    return out;
  }
  dirSize() { return 0; }
  treeSize(p) {
    p = this.norm(p); let n = 0; const pre = p === '/' ? '/' : p + '/';
    for (const [q, e] of this.files) if ((q === p || q.startsWith(pre)) && e.type === 'file') n += e.size;
    return n;
  }
  delete(p) {
    p = this.norm(p);
    if (p === '/') throw new Error('不能删除根目录');
    if (!this.files.has(p)) throw new Error('不存在: ' + p);
    const pre = p + '/';
    for (const [q, e] of [...this.files]) {
      if (q === p || q.startsWith(pre)) { if (e.type === 'file') this.used -= e.size; this.files.delete(q); }
    }
    this.changed(p, 'delete');
    return true;
  }
  rename(from, to) {
    from = this.norm(from); to = this.norm(to);
    if (!this.files.has(from)) throw new Error('不存在: ' + from);
    if (this.files.has(to)) throw new Error('目标已存在: ' + to);
    if (to === from || to.startsWith(from + '/')) throw new Error('不能移动到自身内部');
    this.mkdir(this.dirname(to), true);
    const pre = from + '/';
    for (const [q, e] of [...this.files]) {
      if (q === from || q.startsWith(pre)) { this.files.delete(q); this.files.set(to + q.slice(from.length), e); }
    }
    this.changed(from, 'rename'); this.changed(to, 'rename');
    return true;
  }
  copy(from, to) {
    from = this.norm(from); to = this.norm(to);
    const e = this.files.get(from);
    if (!e) throw new Error('不存在: ' + from);
    if (e.type === 'dir') {
      this.mkdir(to);
      for (const c of this.list(from)) this.copy(c.path, this.join(to, c.name));
    } else this.write(to, e.data);
    return true;
  }
  uniqueName(dir, name) {
    if (!this.exists(this.join(dir, name))) return name;
    const i = name.lastIndexOf('.');
    const stem = i > 0 ? name.slice(0, i) : name, ext = i > 0 ? name.slice(i) : '';
    for (let n = 2; ; n++) { const c = `${stem} (${n})${ext}`; if (!this.exists(this.join(dir, c))) return c; }
  }
  // 回收站：移动到 /Recycle 并记录原位置
  recycle(p) {
    p = this.norm(p);
    if (p.startsWith('/Recycle/')) return this.delete(p);
    const name = this.uniqueName('/Recycle', this.basename(p));
    const dst = this.join('/Recycle', name);
    this.rename(p, dst);
    const e = this.files.get(dst); e.meta = { ...(e.meta || {}), origin: p, deleted: Date.now() };
    this.changed(dst, 'recycle');
    return dst;
  }
  restore(p) {
    p = this.norm(p);
    const e = this.files.get(p);
    if (!e) throw new Error('不存在: ' + p);
    const origin = (e.meta && e.meta.origin) || this.join('/Documents', this.basename(p));
    const dir = this.dirname(origin);
    const target = this.join(dir, this.uniqueName(dir, this.basename(origin)));
    this.rename(p, target);
    const ne = this.files.get(target); if (ne.meta) { delete ne.meta.origin; delete ne.meta.deleted; }
    this.changed(target, 'restore');
    return target;
  }

  // ---- 映像与持久化 ----
  loadImage(imageFiles) {
    this.files.clear(); this.used = 0;
    this.files.set('/', { type: 'dir', mtime: Date.now(), size: 0 });
    const keys = Object.keys(imageFiles).sort();
    for (const k of keys) {
      if (k.endsWith('/')) this.mkdir(k, true);
      else { this.mkdir(this.dirname(k), true); this.files.set(k, { type: 'file', data: imageFiles[k], mtime: Date.now(), size: imageFiles[k].length, meta: null }); this.used += imageFiles[k].length; }
    }
    this.dirty = true;
  }
  async flush() {
    if (!this.persist || !this.dirty) return;
    this.dirty = false;
    const rows = []; const keep = [];
    for (const [p, e] of this.files) {
      if (e.type === 'dir') { rows.push([p, 'd', e.mtime]); continue; }
      if (e.size > 16384) {
        const key = (e.blobKey && e.blobFor === e.data) ? e.blobKey : hashStr(e.data) + '-' + e.size;
        if (e.blobKey !== key) { await this.persist.blobWrite(key, e.data); e.blobKey = key; e.blobFor = e.data; }
        keep.push(key);
        rows.push([p, 'b', e.mtime, key, e.meta || null]);
      } else rows.push([p, 'f', e.mtime, e.data, e.meta || null]);
    }
    await this.persist.storeWrite('rootfs.json', JSON.stringify({ format: 'nest-rootfs', v: 1, rows }));
    this.lastKeep = keep;
  }
  async load() {
    const txt = await this.persist.storeRead('rootfs.json');
    if (!txt) return false;
    let data;
    try { data = JSON.parse(txt); } catch { return false; }
    if (data.format !== 'nest-rootfs') return false;
    this.files.clear(); this.used = 0;
    for (const r of data.rows) {
      if (r[1] === 'd') this.files.set(r[0], { type: 'dir', mtime: r[2], size: 0 });
      else {
        let content = r[3];
        if (r[1] === 'b') { content = await this.persist.blobRead(r[3]); if (content == null) continue; }
        this.files.set(r[0], { type: 'file', data: content, mtime: r[2], size: content.length, meta: r[4] || null, blobKey: r[1] === 'b' ? r[3] : undefined, blobFor: r[1] === 'b' ? content : undefined });
        this.used += content.length;
      }
    }
    if (!this.files.has('/')) this.files.set('/', { type: 'dir', mtime: Date.now(), size: 0 });
    return true;
  }
}

export function fmtB(n) {
  if (n == null) return '-';
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}
