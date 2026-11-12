import * as VFS from "./vfs.js";
export function directoryEntries(s, path) {
  const prefix = path === "/" ? "/" : path + "/";
  return [
    ...s.folders
      .filter(
        (p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"),
      )
      .map((path) => ({ path, folder: true })),
    ...Object.keys(s.files)
      .filter(
        (p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"),
      )
      .map((path) => ({ path, folder: false })),
  ];
}
// Raw filesystem device: policy, ordering and request dispatch belong to .nest programs.
export function applyFileRequest(engine, s, request) {
  const { operation, path, name, entries, overwrite, paths } = request;
  try {
    let selected = [];
    if (operation === "create") {
      const destination = VFS.cleanPath(path + "/" + name);
      if (!name || /[/\\]/.test(name)) throw Error("请输入一个有效名称");
      if (VFS.exists(s, destination)) throw Error("名称已存在");
      if (request.folder) s.folders.push(destination);
      else engine.write(s, destination, request.text || "");
      selected = [destination];
    } else if (operation === "paste")
      selected = VFS.paste(engine, s, path, entries, overwrite);
    else if (operation === "rename")
      selected = [VFS.rename(engine, s, path, name)];
    else if (operation === "trash") VFS.trash(engine, s, paths);
    else if (operation === "restore") VFS.restore(engine, s, paths);
    else throw Error("未知文件操作：" + operation);
    return { ok: true, selected };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
export function fileRequestCost(s, request) {
  let bytes = JSON.stringify(request).length;
  const paths = request.paths || [request.path];
  if (["trash", "restore", "rename"].includes(request.operation))
    for (const [path, text] of Object.entries(s.files))
      if (paths.some((p) => path === p || path.startsWith(p + "/")))
        bytes += text.length;
  return Math.max(1, Math.ceil(bytes / 256));
}
