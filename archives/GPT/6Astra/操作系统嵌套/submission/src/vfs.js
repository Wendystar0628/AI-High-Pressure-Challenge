import { copy } from "./runtime.js";
export function cleanPath(path) {
  if (typeof path !== "string" || !path.trim()) throw Error("路径不能为空");
  let parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.some((p) => p === "." || p === ".." || /[<>:"|?*]/.test(p)))
    throw Error("名称含有无效字符");
  return "/" + parts.join("/");
}
export const exists = (s, path) =>
  Object.hasOwn(s.files, path) || s.folders.includes(path);
export function capture(s, paths, cut = false) {
  let selected = [...new Set(paths.map(cleanPath))].filter(
    (p) => !paths.some((other) => p !== other && p.startsWith(other + "/")),
  );
  return selected.map((path) => {
    if (!exists(s, path)) throw Error("文件不存在：" + path);
    let folder = s.folders.includes(path);
    return {
      name: path.split("/").pop(),
      source: s.id,
      path,
      cut,
      folder,
      files: folder
        ? Object.fromEntries(
            Object.entries(s.files)
              .filter(([p]) => p.startsWith(path + "/"))
              .map(([p, v]) => [p.slice(path.length), v]),
          )
        : { "": s.files[path] },
      folders: folder
        ? s.folders
            .filter((p) => p === path || p.startsWith(path + "/"))
            .map((p) => p.slice(path.length))
        : [],
    };
  });
}
function erase(s, path) {
  for (let p of Object.keys(s.files))
    if (p === path || p.startsWith(path + "/")) delete s.files[p];
  s.folders = s.folders.filter((p) => p !== path && !p.startsWith(path + "/"));
}
function transaction(engine, operation) {
  let states = Object.values(engine.systems),
    before = states.map((s) => ({
      s,
      files: copy(s.files),
      folders: [...s.folders],
      trash: copy(s.trash || {}),
    }));
  try {
    let result = operation();
    for (let s of states)
      if (engine.storageUsed(s) > s.storage)
        throw Error("存储配额不足：" + s.id);
    return result;
  } catch (error) {
    for (let b of before)
      Object.assign(b.s, {
        files: b.files,
        folders: b.folders,
        trash: b.trash,
      });
    throw error;
  }
}
export function paste(engine, target, directory, entries, overwrite = false) {
  directory = cleanPath(directory);
  if (directory !== "/" && !target.folders.includes(directory))
    throw Error("目标目录不存在");
  return transaction(engine, () => {
    let destinations = [];
    for (let entry of entries) {
      let dest = cleanPath(directory + "/" + entry.name),
        source = engine.systems[entry.source];
      if (entry.source === target.id && entry.path === dest)
        throw Error("源与目标相同");
      if (
        entry.folder &&
        entry.source === target.id &&
        dest.startsWith(entry.path + "/")
      )
        throw Error("不能将文件夹放入自身");
      if (exists(target, dest) && !overwrite)
        throw Error("目标已存在：" + dest);
      if (exists(target, dest)) erase(target, dest);
      for (let folder of entry.folders) target.folders.push(dest + folder);
      for (let [relative, text] of Object.entries(entry.files))
        target.files[dest + relative] = text;
      if (entry.cut && source) erase(source, entry.path);
      destinations.push(dest);
    }
    target.folders = [...new Set(target.folders)];
    return destinations;
  });
}
export function rename(engine, s, path, name) {
  if (!name || name.includes("/") || name.includes("\\"))
    throw Error("请输入一个有效名称");
  let parent = path.slice(0, path.lastIndexOf("/")) || "/",
    item = capture(s, [path], true)[0];
  item.name = name;
  return paste(engine, s, parent, [item])[0];
}
export function trash(engine, s, paths) {
  return transaction(engine, () => {
    s.trash ??= {};
    for (let item of capture(s, paths, true)) {
      let original = item.path,
        base = item.name,
        i = 1;
      while (exists(s, "/Trash/" + item.name))
        item.name = base + " (" + i++ + ")";
      let [dest] = paste(engine, s, "/Trash", [item]);
      s.trash[dest] = original;
    }
  });
}
export function restore(engine, s, paths) {
  return transaction(engine, () => {
    for (let item of capture(s, paths, true)) {
      let dest = s.trash?.[item.path] || "/Documents/" + item.name,
        parent = dest.slice(0, dest.lastIndexOf("/")) || "/";
      item.name = dest.split("/").pop();
      if (parent !== "/" && !s.folders.includes(parent)) s.folders.push(parent);
      paste(engine, s, parent, [item]);
      delete s.trash?.[item.path];
    }
  });
}
