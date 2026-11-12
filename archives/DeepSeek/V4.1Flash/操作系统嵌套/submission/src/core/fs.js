// 虚拟文件系统：每个系统拥有独立目录树；节点可完整 JSON 序列化。
export const TRASH_PATH = '/Recycle Bin';

let uidSeq = 1;
export function uid(prefix = 'n') {
  return `${prefix}-${Date.now().toString(36)}-${(uidSeq++).toString(36)}`;
}

export function fileNode(name, content = '', meta = {}) {
  return { type: 'file', name, content, meta: { ...meta }, createdAt: Date.now(), id: uid('f') };
}
export function dirNode(name, children = [], meta = {}) {
  return { type: 'dir', name, children, meta: { ...meta }, createdAt: Date.now(), id: uid('d') };
}

export function createRootFS() {
  const root = dirNode('', []);
  const documents = dirNode('Documents', [
    fileNode('欢迎使用.txt', '欢迎来到 NESTED OS。\n\n这是一套可以嵌套运行的操作系统。双击桌面图标，或从开始菜单启动应用。\n右键桌面可以新建、整理或打开操作说明。\n'),
    fileNode('项目记录.txt', '项目：24 号机飞行表演\n状态：待排演\n\n备注：\n- 检查 2 号停机坪的着陆点\n- 风场设置为东南 3 级\n- 紫黄配色涂装已确认\n'),
  ]);
  const downloads = dirNode('Download', [
    fileNode('发布说明.md', '# NESTED OS 1.0\n\n- 递归系统树\n- 实时数据图表\n- 24 号直升机演出\n'),
  ]);
  const demo = dirNode('Demo', []);
  const programs = dirNode('Programs', []);
  const apps = dirNode('Apps', []);
  const system = dirNode('System', []);
  const trash = dirNode('Recycle Bin', [], { trash: true });
  const snapshots = dirNode('Snapshots', []);
  const desktop = dirNode('Desktop', [
    fileNode('给未来的自己.txt', 'NESTED OS 是一台可以不断嵌套的电脑。\n在这个桌面之下，还会有别的桌面。\n\n—— 24 号机项目组\n'),
  ]);
  root.children.push(documents, downloads, demo, programs, apps, system, snapshots, desktop, trash);
  const old = fileNode('废弃草稿.txt', '这是上一版的分镜草稿，已经不再使用。\n');
  old.meta.trashed = { from: '/Documents', at: Date.now() };
  trash.children.push(old);
  return root;
}

export function normalizePath(p) {
  if (!p) return '/';
  let parts = String(p).replace(/\\/g, '/').split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return '/' + stack.join('/');
}
export function parentPath(p) {
  const np = normalizePath(p);
  if (np === '/') return '/';
  const idx = np.lastIndexOf('/');
  return idx <= 0 ? '/' : np.slice(0, idx);
}
export function baseName(p) {
  const np = normalizePath(p);
  if (np === '/') return '/';
  return np.slice(np.lastIndexOf('/') + 1);
}
export function joinPath(dir, name) {
  if (!dir || dir === '/') return normalizePath('/' + name);
  return normalizePath(dir + '/' + name);
}
export function splitPath(p) {
  const np = normalizePath(p);
  if (np === '/') return [];
  return np.slice(1).split('/');
}

export function resolveNode(root, path) {
  const parts = splitPath(path);
  let cur = root;
  for (const part of parts) {
    if (!cur || cur.type !== 'dir') return null;
    cur = cur.children.find((c) => c.name === part);
  }
  return cur || null;
}

export function ensureDir(root, path) {
  const parts = splitPath(path);
  let cur = root;
  for (const part of parts) {
    let child = cur.children.find((c) => c.name === part);
    if (!child) {
      child = dirNode(part);
      cur.children.push(child);
    }
    if (child.type !== 'dir') return null;
    cur = child;
  }
  return cur;
}

export function uniqueName(dir, name) {
  if (!dir.children.some((c) => c.name === name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  while (dir.children.some((c) => c.name === `${base} (${i})${ext}`)) i++;
  return `${base} (${i})${ext}`;
}

export function writeFile(root, path, content, meta = {}) {
  const normalized = normalizePath(path);
  const parent = resolveNode(root, parentPath(normalized));
  if (!parent || parent.type !== 'dir') throw new Error('目标目录不存在');
  const name = baseName(normalized);
  let node = parent.children.find((c) => c.name === name);
  if (node && node.type !== 'file') throw new Error('同名目录已存在');
  if (!node) {
    node = fileNode(name, content, meta);
    parent.children.push(node);
  } else {
    node.content = content;
    node.meta = { ...node.meta, ...meta };
    node.updatedAt = Date.now();
  }
  return node;
}

export function mkdir(root, path) {
  const normalized = normalizePath(path);
  const parent = resolveNode(root, parentPath(normalized));
  if (!parent || parent.type !== 'dir') throw new Error('目标目录不存在');
  const name = baseName(normalized);
  const exist = parent.children.find((c) => c.name === name);
  if (exist) {
    if (exist.type === 'dir') return exist;
    throw new Error('同名文件已存在');
  }
  const node = dirNode(name);
  parent.children.push(node);
  return node;
}

export function moveNode(root, from, toDirPath) {
  const np = normalizePath(from);
  const node = resolveNode(root, np);
  if (!node) throw new Error('文件不存在');
  if (np === '/' || np === TRASH_PATH) throw new Error('不能移动此目录');
  const targetDir = resolveNode(root, toDirPath);
  if (!targetDir || targetDir.type !== 'dir') throw new Error('目标目录不存在');
  if (node.type === 'dir' && normalizePath(toDirPath).startsWith(np + '/')) throw new Error('不能移动到自身内部');
  const fromParent = resolveNode(root, parentPath(np));
  fromParent.children = fromParent.children.filter((c) => c !== node);
  node.name = uniqueName(targetDir, node.name);
  targetDir.children.push(node);
  return node;
}

export function copyNode(node) {
  const clone = JSON.parse(JSON.stringify(node));
  reid(clone);
  return clone;
}
function reid(node) {
  node.id = uid(node.type === 'dir' ? 'd' : 'f');
  if (node.type === 'dir') node.children.forEach(reid);
}

export function copyInto(root, fromPath, toDirPath, newName) {
  const src = resolveNode(root, fromPath);
  if (!src) throw new Error('源文件不存在');
  const dstDir = resolveNode(root, toDirPath);
  if (!dstDir || dstDir.type !== 'dir') throw new Error('目标目录不存在');
  const clone = copyNode(src);
  clone.name = uniqueName(dstDir, newName || clone.name);
  dstDir.children.push(clone);
  return clone;
}

export function deleteToTrash(root, path, virtualNow = Date.now()) {
  const node = resolveNode(root, path);
  if (!node) throw new Error('文件不存在');
  if (normalizePath(path) === '/' || normalizePath(path) === TRASH_PATH) throw new Error('不能删除此目录');
  const trash = resolveNode(root, TRASH_PATH) || mkdir(root, TRASH_PATH);
  const from = parentPath(path);
  const parent = resolveNode(root, from);
  parent.children = parent.children.filter((c) => c !== node);
  node.meta.trashed = { from, at: virtualNow, originalName: node.name };
  node.name = uniqueName(trash, node.name);
  trash.children.push(node);
  return node;
}

export function restoreFromTrash(root, path) {
  const node = resolveNode(root, path);
  if (!node) throw new Error('回收站项目不存在');
  const trash = resolveNode(root, TRASH_PATH);
  if (!trash || !trash.children.includes(node)) throw new Error('该项目不在回收站');
  let target = node.meta?.trashed?.from || '/Documents';
  if (!resolveNode(root, target)) target = '/Documents';
  ensureDir(root, target);
  const dir = resolveNode(root, target);
  trash.children = trash.children.filter((c) => c !== node);
  node.name = uniqueName(dir, node.meta?.trashed?.originalName || node.name);
  delete node.meta.trashed;
  dir.children.push(node);
  return node;
}

export function emptyTrash(root) {
  const trash = resolveNode(root, TRASH_PATH);
  if (trash) trash.children = [];
}

export function listDir(root, path) {
  const node = resolveNode(root, path);
  if (!node) throw new Error('目录不存在');
  if (node.type !== 'dir') throw new Error('不是目录');
  return node.children.slice();
}

export function fileSize(node) {
  if (!node) return 0;
  if (node.type === 'file') {
    const enc = node.meta?.encoding || 'utf8';
    if (enc === 'base64') return Math.floor((node.content || '').length * 0.75);
    return new TextEncoder().encode(node.content || '').length;
  }
  return node.children.reduce((s, c) => s + fileSize(c), 0);
}

export function treeSize(node) {
  return fileSize(node);
}

export function countFiles(node) {
  if (!node) return 0;
  if (node.type === 'file') return 1;
  return node.children.reduce((s, c) => s + countFiles(c), 0);
}

export function extOf(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function fileKind(name) {
  const ext = extOf(name);
  if (ext === 'sheet') return 'sheet';
  if (ext === 'scene') return 'scene';
  if (ext === 'flight') return 'flight';
  if (ext === 'prog') return 'program';
  if (ext === 'snap') return 'snapshot';
  if (['txt', 'md', 'log', 'json', 'csv'].includes(ext)) return 'text';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  return 'file';
}

export function walkFiles(node, base = '/', out = []) {
  if (!node) return out;
  if (node.type === 'file') {
    out.push({ node, path: joinPath(base, node.name) });
  } else {
    for (const c of node.children) walkFiles(c, node === undefined ? base : joinPath(base, c.name), out);
  }
  return out;
}

export function cloneFS(root) {
  return JSON.parse(JSON.stringify(root));
}
