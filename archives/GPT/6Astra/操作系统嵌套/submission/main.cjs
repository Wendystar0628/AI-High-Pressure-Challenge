const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("fs"),
  path = require("path"),
  os = require("os");
const args = process.argv;
function arg(k, d) {
  let v = args.find((x) => x.startsWith(k + "="));
  let i = args.indexOf(k);
  return v ? v.split("=").slice(1).join("=") : i >= 0 ? args[i + 1] : d;
}
const dataDir = path.resolve(
  arg("--data-dir", path.join(os.tmpdir(), "nest-os-data")),
);
fs.mkdirSync(dataDir, { recursive: true });
app.setPath("userData", dataDir);
app.commandLine.appendSwitch(
  "remote-debugging-port",
  arg("--remote-debugging-port", "19106"),
);
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
let win;
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: +arg("--width", 1440),
    height: +arg("--height", 960),
    useContentSize: true,
    title: "栖境 NEST OS",
    backgroundColor: "#122f36",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      backgroundThrottling: false,
    },
  });
  win.loadFile("index.html");
  win.webContents.on("will-attach-webview", (event, preferences) => {
    preferences.nodeIntegration = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
    delete preferences.preload;
  });
});
app.on("web-contents-created", (_, wc) => {
  wc.setWindowOpenHandler(({ url }) => {
    if (wc.getType() === "webview")
      win.webContents.send("new-browser-tab", url);
    return { action: "deny" };
  });
});
ipcMain.handle("load-state", () => {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dataDir, "state.json"), "utf8"),
    );
  } catch {
    return null;
  }
});
ipcMain.handle("save-state", (_, s) => {
  fs.writeFileSync(path.join(dataDir, "state.tmp"), JSON.stringify(s));
  fs.renameSync(
    path.join(dataDir, "state.tmp"),
    path.join(dataDir, "state.json"),
  );
  return true;
});
ipcMain.handle("export-file", async (_, name, content) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name });
  if (r.canceled) return false;
  fs.writeFileSync(r.filePath, content);
  return true;
});
ipcMain.handle("import-file", async () => {
  const r = await dialog.showOpenDialog(win, { properties: ["openFile"] });
  if (r.canceled) return null;
  return {
    name: path.basename(r.filePaths[0]),
    content: fs.readFileSync(r.filePaths[0], "utf8"),
  };
});
app.on("window-all-closed", () => app.quit());
