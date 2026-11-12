import { presentationData } from "./presentation.js";
import {
  Engine,
  copy,
  program,
  defaults,
  cellValue,
  range,
} from "./runtime.js";
import {
  decodePlayer,
  seekPlayer,
  beginRehearsal,
  sampleRecord,
  encodeRecord,
  queueSample,
  finishSample,
} from "./playback.js";
import * as VFS from "./vfs.js";
import { directoryEntries, applyFileRequest } from "./file-service.js";
import { createDialogs } from "./dialogs.js";
import { surfaceAt } from "./flight.js";
import { drawScene, pickScene } from "./graphics.js";
const scene = await fetch("assets/helicopter-24.scene").then((r) => r.json());
const E = new Engine(scene);
let saved = await window.host.load();
if (saved?.systems) E.state = saved;
E.state.epoch ??= Date.now() - E.root.clock * 1000;
const systemDate = (s) => new Date(E.state.epoch + s.clock * 1000);
const $ = (q, el = document) => el.querySelector(q),
  $$ = (q, el = document) => [...el.querySelectorAll(q)],
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icons = {
  files: "folder",
  spreadsheet: "grid",
  widgets: "widget",
  editor: "code",
  browser: "globe",
  tasks: "pulse",
  settings: "settings",
  player: "play",
  charts: "chart",
  systems: "layers",
  help: "help",
  projection: "project",
};
const paths = {
  folder: "M3 6h7l2 3h9v11H3z M3 6V4h7l2 2",
  grid: "M3 3h18v18H3z M3 9h18 M9 3v18 M3 15h18",
  widget: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  code: "m8 7-5 5 5 5 m8-10 5 5-5 5 M14 4l-4 16",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-5 5-5 13 0 18 M12 3c5 5 5 13 0 18",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  settings:
    "M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  play: "M4 3h16v18H4z m5 5 7 4-7 4z",
  chart: "M4 3v18h17 M8 16v-5 M13 16V6 M18 16V9",
  layers: "m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5",
  help: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9 8c0-4 7-3 6 1-1 2-3 1-3 4 M12 17v.1",
  project: "M3 3h18v13H3z M12 16v5 M7 21h10 m3-11-5-5 m0 0h5 m-5 0v5",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[icons[name] || name] || paths.folder}"/></svg>`;
const names = {
  files: "文件管理器",
  spreadsheet: "电子表格",
  widgets: "小组件",
  editor: "程序编辑器",
  browser: "浏览器",
  tasks: "进程管理器",
  settings: "个性化设置",
  player: "三维场景播放器",
  charts: "图表工作台",
  systems: "系统空间",
  help: "使用指南",
  projection: "投送视图",
};
let desktops = new Map(),
  views = new Map(),
  z = 10,
  focused = null,
  clipboardFiles = [],
  tickCount = 0;
const btn = (id, label, cls = "") =>
  `<button data-testid="${id}" class="${cls}">${label}</button>`;
const dialog = createDialogs({
  desktop: (s) => desktops.get(s.id),
  annotate,
  icon,
});
const askText = (s, title, value) => dialog(s, { title, value });
const askConfirm = async (s, title, message) =>
  (await dialog(s, { title, message })) === "ok";
function notify(text, s = E.root) {
  E.state.notifications.unshift({
    text,
    time: systemDate(s).toLocaleTimeString("zh-CN"),
    systemId: s.id,
  });
  E.state.notifications = E.state.notifications.slice(0, 60);
  if (!s.settings.dnd) {
    let toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    desktops.get(s.id)?.append(toast);
    setTimeout(() => toast.remove(), 3500);
  }
}
function act(el, id, fn) {
  let target = $(`[data-testid="${id}"]`, el);
  if (target)
    target.onclick = async (ev) => {
      ev.stopPropagation();
      try {
        await fn(ev);
      } catch (e) {
        notify(e.message);
      }
    };
}
function annotate(el, s, w) {
  $$("[data-testid],input,select,textarea,button", el).forEach((n) => {
    if (
      w?.appId === "system" &&
      el.querySelector(":scope > .window-content")?.contains(n)
    )
      return;
    const owner = n.closest('[data-testid="app-window"]');
    if (w && owner && owner.dataset.windowId !== w.id) return;
    if (!w && owner && el.contains(owner)) return;
    n.dataset.systemId = s.id;
    if (w) n.dataset.windowId = w.id;
    if (!n.getAttribute("aria-label"))
      n.setAttribute(
        "aria-label",
        n.title || n.textContent.trim() || n.dataset.testid || "输入",
      );
  });
}
function appList(s) {
  return s.parentId
    ? [
        "files",
        "player",
        "charts",
        "editor",
        "tasks",
        "settings",
        "systems",
        "help",
      ]
    : [
        "files",
        "spreadsheet",
        "browser",
        "widgets",
        "editor",
        "tasks",
        "settings",
        "systems",
        "help",
      ];
}
function desktop(s) {
  let el = document.createElement("section");
  el.className = "desktop " + (s.parentId ? "inner" : "outer");
  el.dataset.testid = "os-desktop";
  el.dataset.systemId = s.id;
  el.innerHTML = `<div class="desktop-top"><span class="brand">${icon("layers")} NEST<span>OS</span></span><span class="desktop-location">${s.parentId ? `${s.parentId} / ` : ""}<b class="system-name">${esc(s.name)}</b><i></i><span class="system-status">运行中</span></span><button class="quiet guide">使用指南 ↗</button></div><div class="desktop-icons">${appList(
    s,
  )
    .filter((a) => !["settings", "help", "tasks", "editor"].includes(a))
    .map(
      (a) =>
        `<button data-testid="desktop-icon" data-app-id="${a}" class="desktop-icon"><span class="app-icon ${a}">${icon(a)}</span><span>${names[a]}</span></button>`,
    )
    .join(
      "",
    )}</div><div class="landscape-caption"><div class="eyebrow">${s.parentId ? "A WORLD WITHIN A WORLD" : "YOUR SPACE. IN EVERY DIMENSION."}</div><h1>${s.parentId ? "世界之内，<br>仍有世界。" : "山水之间，<br>自有天地。"}</h1><p>${s.parentId ? "独立的时间 · 自由的探索" : "栖境 · 一个可以向内生长的桌面"}</p></div><div class="welcome"><span class="eyebrow">${s.parentId ? "NESTED WORKSPACE" : "WORKSPACE / 01"}</span><h2>${s.parentId ? "探索这一个世界" : "让灵感，拥有更多空间。"}</h2><p>${s.parentId ? "打开场景，连接数据，或继续向内探索。" : "运行一个独立系统，开启全新的工作现场。"}</p>${btn("system-new", icon("layers") + " 启动子系统 <span>↗</span>", "primary")}<button class="quiet manage">管理系统空间 →</button></div><div class="windows"></div><div class="taskbar"><button data-testid="start-toggle" class="start-button" title="开始">${icon("layers")}</button><span class="taskbar-sep"></span><button class="pin" data-pin="files" title="文件管理器">${icon("files")}</button><button class="pin" data-pin="${s.parentId ? "player" : "browser"}" title="固定应用">${icon(s.parentId ? "player" : "browser")}</button><button data-testid="widgets-toggle" title="小组件">${icon("widgets")}</button><div class="running-apps"></div><div class="tray"><span class="tray-state">● <span>${s.id}</span></span><button data-testid="notifications-toggle" title="通知中心">♧</button><button class="tray-clock" title="时钟与日历"></button></div></div>`;
  $(".guide", el).onclick = () => open(s, "help");
  $(".manage", el).onclick = () => open(s, "systems");
  act(el, "system-new", () => newSystem(s));
  act(el, "start-toggle", () => startMenu(s, el));
  act(el, "widgets-toggle", () => open(s, "widgets"));
  act(el, "notifications-toggle", () => notifications(s, el));
  $(".tray-clock", el).onclick = () => open(s, "widgets");
  $$("[data-pin]", el).forEach(
    (b) => (b.onclick = () => open(s, b.dataset.pin)),
  );
  $$(".desktop-icon", el).forEach((b) => {
    b.onclick = () => {
      $$(".desktop-icon", el).forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
    };
    b.ondblclick = () => open(s, b.dataset.appId);
  });
  el.oncontextmenu = (e) => {
    if (e.target.closest(".app-window")) return;
    e.preventDefault();
    e.stopPropagation();
    context(el, e, [
      ["新建子系统", () => newSystem(s)],
      ["文件管理器", () => open(s, "files")],
      ["个性化设置", () => open(s, "settings")],
      ["系统空间", () => open(s, "systems")],
    ]);
  };
  for (let event of ["click", "dblclick", "keydown", "pointerdown"])
    el.addEventListener(
      event,
      (e) => {
        if (!E.running(s)) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
  annotate(el, s);
  desktops.set(s.id, el);
  return el;
}
function context(el, event, items) {
  $$(".context-menu").forEach((x) => x.remove());
  let menu = document.createElement("div");
  menu.className = "context-menu";
  let r = el.getBoundingClientRect();
  menu.style.left =
    Math.min(event.clientX - r.left, el.clientWidth - 200) + "px";
  menu.style.top =
    Math.min(event.clientY - r.top, el.clientHeight - 230) + "px";
  for (let [label, fn] of items) {
    let b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => {
      menu.remove();
      fn();
    };
    menu.append(b);
  }
  el.append(menu);
}
function startMenu(s, el) {
  let existing = $(".start-menu", el);
  if (existing) {
    existing.remove();
    return;
  }
  let menu = document.createElement("div");
  menu.className = "start-menu";
  menu.dataset.testid = "start-menu";
  menu.innerHTML = `<div class="menu-heading">${icon("layers")}<b>${esc(s.name)}</b><span>${s.id}</span></div><input placeholder="搜索应用与工作空间" class="search"><div class="eyebrow">所有应用</div><div class="app-grid">${appList(
    s,
  )
    .map(
      (a) =>
        `<button data-testid="launch-${a}" data-app="${a}"><span class="app-icon ${a}">${icon(a)}</span><span>${names[a]}</span></button>`,
    )
    .join(
      "",
    )}</div><footer>● 系统运行中 <span>栖境 NEST OS · 1.0</span></footer>`;
  $$("[data-app]", menu).forEach(
    (b) =>
      (b.onclick = () => {
        open(s, b.dataset.app);
        menu.remove();
      }),
  );
  $(".search", menu).oninput = (e) =>
    $$("[data-app]", menu).forEach(
      (b) => (b.hidden = !b.textContent.includes(e.target.value)),
    );
  el.append(menu);
  annotate(menu, s);
}
function notifications(s, el) {
  let ex = $(".notification-panel", el);
  if (ex) {
    ex.remove();
    return;
  }
  let n = document.createElement("div");
  n.className = "notification-panel";
  n.innerHTML = `<h2>通知中心 <button class="quiet">清空</button></h2><label><input type="checkbox" ${s.settings.dnd ? "checked" : ""}> 免打扰</label><div>${
    E.state.notifications
      .filter((n) => n.systemId === s.id)
      .map(
        (n) =>
          `<article><span>${esc(n.text)}</span><small>${n.time}</small></article>`,
      )
      .join("") || '<p class="muted">暂无通知。一切井然有序。</p>'
  }</div>`;
  $("input", n).onchange = (e) => (s.settings.dnd = e.target.checked);
  $("button", n).onclick = () => {
    E.state.notifications = E.state.notifications.filter(
      (x) => x.systemId !== s.id,
    );
    n.remove();
    notifications(s, el);
  };
  el.append(n);
}
function newSystem(parent) {
  let s = E.create(parent.id);
  let w = makeWindow(parent, "system", s.id, { child: s.id });
  w.x = 105;
  w.y = 55;
  w.width = Math.max(620, (desktops.get(parent.id)?.clientWidth || 1100) - 145);
  w.height = Math.max(
    420,
    (desktops.get(parent.id)?.clientHeight || 750) - 130,
  );
  sync();
  open(s, "player");
  notify("已启动 " + s.id, parent);
  return s;
}
function makeWindow(s, appId, title, data = {}) {
  let index = s.windows.length,
    w = {
      id: "w" + ++E.state.wid,
      systemId: s.id,
      appId,
      title: title || names[appId],
      x: 115 + (index % 4) * 27,
      y: 65 + (index % 4) * 25,
      width:
        appId === "player"
          ? 820
          : appId === "systems"
            ? 880
            : appId === "spreadsheet"
              ? 850
              : 740,
      height: appId === "player" ? 580 : 540,
      z: ++z,
      state: "normal",
      data,
    };
  let desk = desktops.get(s.id);
  if (desk) {
    w.x = Math.min(w.x, Math.max(8, desk.clientWidth * 0.13));
    w.y = Math.min(w.y, Math.max(8, desk.clientHeight * 0.1));
    w.width = Math.min(w.width, Math.max(340, desk.clientWidth - w.x - 15));
    w.height = Math.min(w.height, Math.max(240, desk.clientHeight - w.y - 65));
  }
  z = Math.max(z, ...s.windows.map((x) => x.z || 0), w.z || 0);
  w.z = ++z;
  s.windows.push(w);
  if (appId !== "system" && appId !== "projection" && appId !== "program") {
    let file = "/System/" + appId + ".nest",
      src =
        s.files[file] ||
        program([
          { op: "sys", call: "app.tick" },
          { op: "jump", to: 0 },
        ]);
    let p = E.process(s, file, src, "app", w.id);
    w.pid = p.id;
    if (appId === "player") {
      for (let role of ["scene", "effects"]) {
        let path =
          role === "scene"
            ? "/System/flight-scene.nest"
            : "/System/effects.nest";
        let p2 = E.process(s, path, s.files[path], role, w.id);
        p2.name = role === "scene" ? "飞行场景" : "环境特效";
      }
    }
    if (appId === "charts") {
      let p2 = E.process(
        s,
        "/System/data-receiver.nest",
        s.files["/System/data-receiver.nest"],
        "receiver",
        w.id,
      );
      p2.name = "数据接收";
    }
  }
  sync();
  return w;
}
function open(s, appId, path, options = {}) {
  if (!E.running(s)) {
    notify("系统未运行，请在父系统恢复", s);
    return;
  }
  if (appId === "system") return newSystem(s);
  if (appId === "spreadsheet" && !path) path = "/Demo/sample.sheet";
  let w;
  if (!["editor", "player", "charts"].includes(appId)) {
    w = s.windows.find(
      (w) => w.appId === appId && (!path || w.data.path === path),
    );
    if (w) {
      w.state = "normal";
      w.z = ++z;
      sync();
      return w;
    }
  }
  let data = {};
  if (appId === "files") data = { path: "/Demo", selected: [] };
  if (appId === "spreadsheet")
    data = {
      path,
      cells: JSON.parse(s.files[path] || '{"cells":{}}').cells,
      formats: JSON.parse(s.files[path] || "{}").formats || {},
      selected: "A1",
      end: "A1",
      dirty: false,
      history: [],
      redo: [],
      version: 1,
    };
  if (appId === "editor") {
    path = path || "/Documents/未命名.txt";
    data = {
      path,
      text: s.files[path] || "",
      dirty: false,
      targetWindowId: options.targetWindowId || null,
    };
  }
  if (appId === "player") {
    path = path || "/Demo/helicopter-24.scene";
    data = decodePlayer(JSON.parse(s.files[path]), path, s.clock);
  }
  if (appId === "charts")
    data = {
      sourceTitle: "/Demo/sample.sheet",
      range: "A1:D4",
      label: "A",
      series: "D",
      chartType: "bar",
      connectionState: "未连接",
      cache: [],
      pending: [],
      version: 0,
    };
  if (appId === "widgets")
    data = {
      timer: 0,
      remaining: 0,
      running: false,
      note: s.files["/Documents/便笺.txt"] || "",
      month: 0,
      stopwatch: 0,
      swRunning: false,
      lastClock: s.clock,
    };
  w = makeWindow(s, appId, names[appId], data);
  return w;
}
async function close(s, w) {
  if (
    w.appId === "system" &&
    !(await askConfirm(
      s,
      "停止子系统？",
      "将停止 " + w.data.child + " 及其全部后代。已保存的快照仍可重新打开。",
    ))
  )
    return;
  if (w.data.dirty) {
    let choice = await dialog(s, {
      title: "保存修改？",
      message: w.data.path,
      choices: [
        ["cancel", "取消"],
        ["discard", "放弃修改"],
        ["save", "保存并关闭"],
      ],
    });
    if (choice === "cancel") return;
    if (choice === "save") saveDocument(s, w);
  }
  if (w.appId === "system") E.stop(E.systems[w.data.child]);
  s.windows = s.windows.filter((x) => x !== w);
  s.processes.filter((p) => p.windowId === w.id).forEach((p) => E.end(s, p));
  for (let sys of Object.values(E.systems))
    sys.windows = sys.windows.filter(
      (x) => x.appId !== "projection" || x.data.sourceWindowId !== w.id,
    );
  sync();
}
function saveDocument(s, w) {
  if (w.appId === "editor") {
    E.write(s, w.data.path, w.data.text);
  } else if (w.appId === "spreadsheet") {
    E.write(
      s,
      w.data.path,
      JSON.stringify({ cells: w.data.cells, formats: w.data.formats || {} }),
    );
  }
  w.data.dirty = false;
  notify("已保存 " + w.data.path, s);
}
function sourceOf(w) {
  if (w.appId !== "projection") return { s: E.systems[w.systemId], w };
  let s = E.systems[w.data.sourceSystemId];
  return { s, w: s?.windows.find((x) => x.id === w.data.sourceWindowId) };
}
function send(s, w, type, payload = {}) {
  if (!E.running(s)) {
    notify("源系统已暂停，内容操作暂不可用");
    return;
  }
  let event = { type, windowId: w.id, payload };
  if (s.parentId) s.input.push(copy(event));
  else handle(s, event);
}
function project(s, w, target) {
  let ex = Object.values(E.systems)
    .flatMap((s) => s.windows)
    .find((x) => x.appId === "projection" && x.data.sourceWindowId === w.id);
  if (ex) {
    ex.state = "normal";
    ex.z = ++z;
    sync();
    return;
  }
  makeWindow(
    E.systems[target],
    "projection",
    `${names[w.appId]} · 来自 ${s.id}`,
    {
      sourceSystemId: s.id,
      sourceWindowId: w.id,
      sourceAppId: w.appId,
      frame: copy(w.presentation || presentationData(w.data)),
    },
  );
  notify("视图已投送到 " + target, s);
}
function raise(s, w, pointer) {
  if (s.parentId) {
    if (pointer) {
      const windows = s.windows
        .filter((w) => w.state !== "minimized")
        .map((w) => {
          const r = views.get(w.id)?.getBoundingClientRect();
          return r
            ? {
                id: w.id,
                z: w.z,
                left: r.left,
                right: r.right,
                top: r.top,
                bottom: r.bottom,
              }
            : null;
        })
        .filter(Boolean);
      s.input.push({
        type: "window.pointer",
        x: pointer.clientX,
        y: pointer.clientY,
        windows,
        windowId: w.id,
      });
    } else s.input.push({ type: "window.focus", windowId: w.id, payload: {} });
  } else {
    focused = w.id;
    w.z = ++z;
  }
  let child = s;
  while (child.parentId) {
    let parent = E.systems[child.parentId],
      carrier = parent?.windows.find(
        (w) => w.appId === "system" && w.data.child === child.id,
      );
    if (carrier) {
      if (parent.parentId)
        parent.input.push({ type: "window.focus", windowId: carrier.id });
      else carrier.z = ++z;
    }
    child = parent;
  }
  syncPositions();
}
function viewWindow(s, w) {
  let el = document.createElement("div");
  el.className = "app-window";
  Object.assign(el.dataset, {
    testid: "app-window",
    systemId: s.id,
    windowId: w.id,
    appId: w.appId,
  });
  if (w.appId === "projection") {
    el.dataset.sourceSystemId = w.data.sourceSystemId;
    el.dataset.sourceWindowId = w.data.sourceWindowId;
    el.dataset.sourceAppId = w.data.sourceAppId;
  }
  el.innerHTML = `<header data-testid="window-titlebar" class="titlebar"><span class="window-icon">${icon(w.appId === "system" ? "layers" : w.appId)}</span><b class="window-title">${esc(w.title)}</b><span class="window-owner">${s.id}</span><div class="window-controls">${btn("window-minimize", "−")}${btn("window-maximize", "□")}${btn("window-close", "×")}</div></header><div class="window-content"></div><div data-testid="window-resize" class="resize-handle"></div>`;
  let bar = $(".titlebar", el);
  bar.onpointerdown = (ev) => {
    if (ev.target.closest("button")) return;
    ev.stopPropagation();
    raise(s, w);
    let r = el.getBoundingClientRect(),
      parent = el.parentElement.getBoundingClientRect(),
      ox = ev.clientX - r.left,
      oy = ev.clientY - r.top;
    bar.setPointerCapture(ev.pointerId);
    bar.onpointermove = (e) => {
      w.state = "normal";
      w.x = Math.max(
        0,
        Math.min(parent.width - 140, e.clientX - parent.left - ox),
      );
      w.y = Math.max(
        0,
        Math.min(parent.height - 80, e.clientY - parent.top - oy),
      );
      position(el, w);
    };
    bar.onpointerup = (e) => {
      bar.onpointermove = null;
      let x = e.clientX - parent.left;
      if (x < 18) {
        w.state = "left";
      } else if (x > parent.width - 18) {
        w.state = "right";
      }
      sync();
    };
  };
  bar.ondblclick = () => {
    w.state = w.state === "maximized" ? "normal" : "maximized";
    sync();
  };
  let resize = $(".resize-handle", el);
  resize.onpointerdown = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    let x = ev.clientX,
      y = ev.clientY,
      ww = el.offsetWidth,
      hh = el.offsetHeight;
    resize.setPointerCapture(ev.pointerId);
    resize.onpointermove = (e) => {
      w.state = "normal";
      w.width = Math.max(350, ww + e.clientX - x);
      w.height = Math.max(250, hh + e.clientY - y);
      position(el, w);
    };
    resize.onpointerup = () => (resize.onpointermove = null);
  };
  act(el, "window-minimize", () => {
    w.state = "minimized";
    sync();
  });
  act(el, "window-maximize", () => {
    w.state = w.state === "maximized" ? "normal" : "maximized";
    sync();
  });
  act(el, "window-close", () => close(s, w));
  el.onpointerdown = (ev) => {
    ev.stopPropagation();
    raise(s, w, ev);
  };
  let content = $(".window-content", el);
  if (w.appId === "system") {
    let child = E.systems[w.data.child];
    if (child) content.append(desktops.get(child.id) || desktop(child));
  } else buildApp(content, s, w);
  annotate(el, s, w);
  views.set(w.id, el);
  return el;
}
function position(el, w) {
  let max = w.state === "maximized",
    half = ["left", "right"].includes(w.state);
  el.style.cssText = `z-index:${w.z};display:${w.state === "minimized" ? "none" : "flex"};left:${max || w.state === "left" ? "0" : w.state === "right" ? "50%" : w.x + "px"};top:${max || half ? "0" : w.y + "px"};width:${max ? "100%" : half ? "50%" : w.width + "px"};height:${max || half ? "100%" : w.height + "px"};`;
  el.classList.toggle("focused", focused === w.id);
  el.classList.toggle("system-window", w.appId === "system");
}
function syncPositions() {
  for (let s of Object.values(E.systems))
    for (let w of s.windows) {
      let el = views.get(w.id);
      if (el) position(el, w);
    }
}
function sync() {
  let live = new Set();
  for (let s of Object.values(E.systems)) {
    let d = desktops.get(s.id);
    if (!d) continue;
    d.style.setProperty("--accent", s.settings.accent);
    d.style.setProperty("--ui-scale", s.settings.scale);
    d.dataset.wallpaper = s.settings.wallpaper;
    d.style.fontSize = 13 * s.settings.scale + "px";
    $(".system-name", d).textContent = s.name;
    for (let w of s.windows) {
      live.add(w.id);
      let el = views.get(w.id);
      if (!el) {
        el = viewWindow(s, w);
        $(".windows", d).append(el);
      }
      position(el, w);
    }
    let running = $(":scope > .taskbar > .running-apps", d);
    running.innerHTML = s.windows
      .map(
        (w) =>
          `<button data-testid="taskbar-item" data-window-id="${w.id}" class="${w.state !== "minimized" ? "active" : ""}" title="${esc(w.title)}">${icon(w.appId === "system" ? "layers" : w.appId)}<span>${esc(w.title)}</span></button>`,
      )
      .join("");
    $$("button", running).forEach(
      (b) =>
        (b.onclick = () => {
          let w = s.windows.find((w) => w.id === b.dataset.windowId);
          w.state =
            w.state === "minimized"
              ? "normal"
              : focused === w.id
                ? "minimized"
                : w.state;
          w.z = ++z;
          focused = w.id;
          sync();
        }),
    );
    annotate(running, s);
  }
  for (let [id, el] of views)
    if (!live.has(id)) {
      el.remove();
      views.delete(id);
    }
}
function buildApp(el, s, w) {
  const src = sourceOf(w);
  if (w.appId === "projection") {
    if (!src.w) {
      el.textContent = "源应用已结束";
      return;
    }
    el.innerHTML = `<div class="projection-banner">${icon("project")} 实时投送 <b>${src.s.id}</b><span>计算与输入归属源系统</span></div><div class="project-content"></div>`;
    const content = $(".project-content", el),
      model = {
        ...src.w,
        data: copy(
          w.data.frame || src.w.presentation || presentationData(src.w.data),
        ),
      };
    delete model.presentation;
    buildApp(content, src.s, model);
    const update = content._update;
    content._update = () => {
      if (w.data.frame) {
        for (const key of Object.keys(model.data)) delete model.data[key];
        Object.assign(model.data, copy(w.data.frame));
      }
      update?.();
    };
    return;
  }
  ({
    files: buildFiles,
    spreadsheet: buildSheet,
    editor: buildEditor,
    settings: buildSettings,
    widgets: buildWidgets,
    systems: buildSystems,
    tasks: buildTasks,
    player: buildPlayer,
    charts: buildCharts,
    browser: buildBrowser,
    help: buildHelp,
    program: buildProgram,
  })[w.appId]?.(el, s, w);
}
async function fileOperation(s, w, operation, payload = {}) {
  const request = {
    ...copy(payload),
    operation,
    id: ++E.state.requestSerial || (E.state.requestSerial = 1),
  };
  if (!s.parentId) {
    const result = applyFileRequest(E, s, request);
    if (!result.ok) throw Error(result.error);
    return result.selected;
  }
  const p = s.processes.find((p) => p.id === w.pid);
  if (!p || ["ended", "error"].includes(p.state))
    throw Error("文件管理进程未运行");
  if (!E.running(s)) throw Error("系统已暂停");
  send(s, w, "files.request", request);
  w.data.busy = true;
  try {
    while (!p.responses?.[request.id]) {
      if (!s.processes.includes(p) || ["ended", "error"].includes(p.state))
        throw Error(p.error || "文件操作已取消：进程已结束");
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    const response = p.responses[request.id];
    delete p.responses[request.id];
    if (!response.ok) throw Error(response.error);
    return response.selected;
  } finally {
    w.data.busy = false;
  }
}
function buildFiles(el, s, w) {
  const d = w.data;
  d.selected ??= [];
  let renderKey = "",
    anchor = null;
  el.innerHTML = `<div class="toolbar">${btn("files-new-file", "＋ 新建文件")}${btn("files-new-folder", "新建文件夹")}${btn("files-copy", "复制")}${btn("files-paste", "粘贴")}${btn("files-open", "打开")}<button class="file-rename">重命名</button><button class="file-delete">删除</button><button class="file-restore">恢复</button><button class="import">导入</button><button class="export">导出</button></div><div class="file-address"><button class="file-up" title="上一级">↑</button>${icon("folder")}<input data-testid="files-path" value="${esc(d.path)}"></div><div class="file-layout"><nav>${["/Documents", "/Downloads", "/Demo", "/Programs", "/System", "/Snapshots", "/Trash"].map((p) => `<button data-testid="files-nav" data-file-path="${p}">${icon("folder")} ${{ "/Documents": "文档", "/Downloads": "下载", "/Demo": "演示资源", "/Programs": "程序", "/System": "系统", "/Snapshots": "快照", "/Trash": "回收站" }[p]}</button>`).join("")}</nav><div class="file-main"><div class="file-columns"><span>名称</span><span>类型</span><span>大小</span></div><div data-testid="files-list" class="file-list"></div><div class="file-foot"></div></div></div>`;
  const safely = (fn) => async (e) => {
    try {
      await fn(e);
    } catch (error) {
      notify(error.message, s);
    }
  };
  const navigate = (path) => {
    path = VFS.cleanPath(path);
    if (path === "/" || s.folders.includes(path)) {
      d.path = path;
      d.selected = [];
      renderKey = "";
      $('[data-testid="files-path"]', el).value = path;
      refresh();
    } else if (VFS.exists(s, path)) openFile(s, path);
    else notify("目录或文件不存在：" + path, s);
  };
  const copyFiles = (cut) => {
    clipboardFiles = VFS.capture(s, d.selected, cut);
    notify(
      (cut ? "已剪切 " : "已复制 ") + clipboardFiles.length + " 个项目",
      s,
    );
  };
  const pasteFiles = async (entries = clipboardFiles) => {
    if (!entries.length) return;
    let conflict = entries.some((f) =>
      VFS.exists(s, VFS.cleanPath(d.path + "/" + f.name)),
    );
    if (
      conflict &&
      !(await askConfirm(
        s,
        "替换同名项目？",
        "目标目录中已有同名文件或文件夹，替换将覆盖原内容。",
      ))
    )
      return;
    d.selected = await fileOperation(s, w, "paste", {
      path: d.path,
      entries,
      overwrite: conflict,
    });
    if (entries === clipboardFiles && entries.some((e) => e.cut))
      clipboardFiles = [];
    renderKey = "";
    refresh();
    notify("已传入 " + d.selected.length + " 个项目 · " + s.id, s);
  };
  const renameFile = async () => {
    if (d.selected.length !== 1) return;
    let path = d.selected[0],
      name = await askText(s, "重命名", path.split("/").pop());
    if (name && name !== path.split("/").pop()) {
      d.selected = await fileOperation(s, w, "rename", { path, name });
      refresh();
      notify("名称已更新", s);
    }
  };
  const deleteFiles = async () => {
    if (!d.selected.length) return;
    if (d.path.startsWith("/Trash")) {
      notify("请使用恢复，将文件移出回收站", s);
      return;
    }
    await fileOperation(s, w, "trash", { paths: d.selected });
    d.selected = [];
    refresh();
    notify("项目已移入回收站，原路径已保留", s);
  };
  const restoreFiles = async () => {
    if (!d.selected.length) return;
    await fileOperation(s, w, "restore", { paths: d.selected });
    d.selected = [];
    refresh();
    notify("已恢复到原位置", s);
  };
  function refresh() {
    let items = s.parentId
      ? d.listingPath === d.path
        ? d.listing || []
        : []
      : directoryEntries(s, d.path);
    if (!s.parentId)
      items.sort(
        (a, b) =>
          Number(b.folder) - Number(a.folder) ||
          a.path.localeCompare(b.path, "zh-CN"),
      );
    let direction = "program";
    const list = $(".file-list", el),
      key = JSON.stringify([
        d.path,
        direction,
        items.map((i) => [i.path, i.folder, s.files[i.path]?.length]),
      ]);
    $(".file-foot", el).textContent =
      items.length +
      " 个项目 · 已选 " +
      d.selected.length +
      " · " +
      s.id +
      (d.busy ? " · 等待程序完成文件操作…" : "");
    $(".file-restore", el).hidden = !d.path.startsWith("/Trash");
    if (key === renderKey) {
      $$(".file-row", list).forEach((r) =>
        r.classList.toggle("selected", d.selected.includes(r.dataset.filePath)),
      );
      return;
    }
    renderKey = key;
    list.innerHTML =
      items
        .map(
          (f) =>
            `<div tabindex="0" draggable="true" data-testid="files-item" data-file-path="${esc(f.path)}" class="file-row ${d.selected.includes(f.path) ? "selected" : ""}"><span>${icon(f.folder ? "files" : /\.(scene|flight)$/.test(f.path) ? "player" : f.path.endsWith(".sheet") ? "spreadsheet" : "editor")} ${esc(f.path.split("/").pop())}</span><span>${f.folder ? "文件夹" : f.path.split(".").pop().toUpperCase()}</span><span>${f.folder ? "—" : ((s.files[f.path]?.length || 0) / 1024).toFixed(1) + " KB"}</span></div>`,
        )
        .join("") ||
      '<div class="empty"><span>空的文件夹</span><small>拖入文件，或者新建你的第一份作品。</small></div>';
    $$(".file-row", list).forEach((row) => {
      let path = row.dataset.filePath;
      row.onclick = (e) => {
        if (e.shiftKey && anchor) {
          let a = items.findIndex((i) => i.path === anchor),
            b = items.findIndex((i) => i.path === path);
          d.selected = items
            .slice(Math.min(a, b), Math.max(a, b) + 1)
            .map((i) => i.path);
        } else if (e.ctrlKey) {
          d.selected = d.selected.includes(path)
            ? d.selected.filter((p) => p !== path)
            : [...d.selected, path];
          anchor = path;
        } else {
          d.selected = [path];
          anchor = path;
        }
        refresh();
      };
      row.ondblclick = () => navigate(path);
      row.ondragstart = (e) => {
        e.stopPropagation();
        let paths = d.selected.includes(path) ? d.selected : [path];
        e.dataTransfer.setData(
          "application/nest-file",
          JSON.stringify({ systemId: s.id, paths }),
        );
        e.dataTransfer.effectAllowed = "copy";
      };
      row.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!d.selected.includes(path)) d.selected = [path];
        refresh();
        context(views.get(w.id) || el, e, [
          ["打开", () => navigate(path)],
          ["重命名", safely(renameFile)],
          ["复制", () => copyFiles(false)],
          ["剪切", () => copyFiles(true)],
          [
            d.path.startsWith("/Trash") ? "恢复到原位置" : "删除 / 放入回收站",
            safely(d.path.startsWith("/Trash") ? restoreFiles : deleteFiles),
          ],
        ]);
      };
    });
    annotate(el, s, w);
  }
  $$(".file-layout nav button", el).forEach(
    (b) => (b.onclick = () => navigate(b.dataset.filePath)),
  );
  $(".file-up", el).onclick = () =>
    navigate(d.path.slice(0, d.path.lastIndexOf("/")) || "/");
  $('[data-testid="files-path"]', el).onkeydown = safely((e) => {
    if (e.key === "Enter") navigate(e.target.value);
  });
  act(el, "files-open", () => d.selected[0] && navigate(d.selected[0]));
  act(el, "files-copy", () => copyFiles(false));
  act(el, "files-paste", () => pasteFiles());
  for (let [id, folder] of [
    ["files-new-file", false],
    ["files-new-folder", true],
  ])
    act(el, id, async () => {
      let name = await askText(
        s,
        folder ? "新建文件夹" : "新建文件",
        folder ? "新建文件夹" : "新建文档.txt",
      );
      if (!name) return;
      let path = VFS.cleanPath(d.path + "/" + name);
      if (VFS.exists(s, path)) throw Error("名称已存在");
      d.selected = await fileOperation(s, w, "create", {
        path: d.path,
        name,
        folder,
      });
      refresh();
      notify("已创建 " + name, s);
    });
  $(".file-rename", el).onclick = safely(renameFile);
  $(".file-delete", el).onclick = safely(deleteFiles);
  $(".file-restore", el).onclick = safely(restoreFiles);
  const list = $(".file-list", el);
  list.onkeydown = safely((e) => {
    if (e.key === "Enter" && d.selected[0]) navigate(d.selected[0]);
    if (e.key === "F2") {
      e.preventDefault();
      return renameFile();
    }
    if (e.key === "Delete") return deleteFiles();
    if (e.ctrlKey && e.key === "a") {
      e.preventDefault();
      d.selected = $$(".file-row", list).map((r) => r.dataset.filePath);
      refresh();
    }
    if (e.ctrlKey && e.key === "c") copyFiles(false);
    if (e.ctrlKey && e.key === "x") copyFiles(true);
    if (e.ctrlKey && e.key === "v") return pasteFiles();
  });
  list.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    list.classList.add("drop-target");
    $(".file-foot", el).textContent = "复制到 " + s.id + " · " + d.path;
  };
  list.ondragleave = () => {
    list.classList.remove("drop-target");
    refresh();
  };
  list.ondrop = safely(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    list.classList.remove("drop-target");
    let drag = JSON.parse(e.dataTransfer.getData("application/nest-file"));
    await pasteFiles(VFS.capture(E.systems[drag.systemId], drag.paths));
  });
  $(".import", el).onclick = safely(async () => {
    let f = await window.host.import();
    if (!f) return;
    await pasteFiles([{ name: f.name, files: { "": f.content }, folders: [] }]);
  });
  $(".export", el).onclick = safely(async () => {
    let path = d.selected[0];
    if (path && Object.hasOwn(s.files, path)) {
      if (await window.host.export(path.split("/").pop(), s.files[path]))
        notify("已导出 " + path, s);
    }
  });
  el._refresh = refresh;
  el._update = refresh;
  refresh();
}

function openFile(s, path) {
  if (path.endsWith(".sheet")) open(s, "spreadsheet", path);
  else if (path.endsWith(".scene") || path.endsWith(".flight"))
    open(s, "player", path);
  else if (path.endsWith(".snapshot")) {
    let snap = JSON.parse(s.files[path]);
    let original = E.systems[snap.root] || { parentId: s.id };
    let child = E.restore(original, snap, true);
    makeWindow(s, "system", child.id, { child: child.id });
    sync();
  } else open(s, "editor", path);
}
function buildSheet(el, s, w) {
  let d = w.data;
  el.innerHTML = `<div class="toolbar"><span class="doc-badge">${icon("spreadsheet")}</span><input data-testid="sheet-filename" class="filename" value="${esc(d.path)}">${btn("sheet-save", "保存", "primary")}<button class="sheet-new">新建</button><button class="undo" title="撤销">↶</button><button class="redo" title="重做">↷</button><button class="copy">复制</button><button class="bold">B</button></div><div class="formula-bar"><span class="cell-address">A1</span><i>ƒx</i><input data-testid="sheet-formula"></div><div class="sheet-scroll"><table data-testid="sheet-grid"><thead><tr><th></th>${Array.from({ length: 12 }, (_, c) => `<th>${String.fromCharCode(65 + c)}</th>`).join("")}</tr></thead><tbody>${Array.from(
    { length: 99 },
    (_, r) =>
      `<tr><th>${r + 1}</th>${Array.from({ length: 12 }, (_, c) => {
        let addr = String.fromCharCode(65 + c) + (r + 1);
        return `<td data-testid="sheet-cell" data-cell-address="${addr}" tabindex="0"></td>`;
      }).join("")}</tr>`,
  ).join(
    "",
  )}</tbody></table></div><div class="sheet-footer"><span class="sheet-tab">工作表 1</span><span class="sheet-summary"></span><span class="sheet-version"></span></div>`;
  function refresh() {
    if (
      el.contains(document.activeElement) &&
      (document.activeElement.matches("[data-testid=sheet-formula]") ||
        document.activeElement.isContentEditable)
    )
      return;
    let selected = range(d.selected + ":" + d.end);
    $$("td", el).forEach((td) => {
      let a = td.dataset.cellAddress;
      if (document.activeElement !== td || !td.isContentEditable)
        td.textContent = cellValue(d.cells, a);
      td.classList.toggle("cell-selected", selected.includes(a));
      td.classList.toggle("bold-cell", !!d.formats?.[a]);
      td.classList.toggle(
        "error-cell",
        String(cellValue(d.cells, a)).startsWith("#"),
      );
    });
    $(".cell-address", el).textContent = d.selected;
    $('[data-testid="sheet-formula"]', el).value = d.cells[d.selected] || "";
    $(".sheet-version", el).textContent =
      `${d.dirty ? "● 未保存" : "已保存"} · 版本 ${d.version}`;
    $(".sheet-summary", el).textContent =
      "选区求和 " +
      selected.reduce((n, a) => n + (+cellValue(d.cells, a) || 0), 0);
  }
  function commit(changes) {
    d.history.push(copy(d.cells));
    d.history = d.history.slice(-50);
    d.redo = [];
    Object.assign(d.cells, changes);
    d.dirty = true;
    d.version++;
    publish(w);
    if (document.activeElement?.isContentEditable)
      document.activeElement.contentEditable = false;
    refresh();
  }
  $$("td", el).forEach((td) => {
    let a = td.dataset.cellAddress;
    td.onpointerdown = (e) => {
      d.selected = a;
      d.end = a;
      refresh();
      let up = () => {
        document.removeEventListener("pointerup", up);
        $$("td", el).forEach((t) => (t.onpointerenter = null));
      };
      $$("td", el).forEach(
        (t) =>
          (t.onpointerenter = () => {
            d.end = t.dataset.cellAddress;
            refresh();
          }),
      );
      document.addEventListener("pointerup", up);
    };
    td.ondblclick = () => {
      td.contentEditable = true;
      td.textContent = d.cells[a] || "";
      td.focus();
      document.getSelection().selectAllChildren(td);
    };
    td.onkeydown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyCells();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (
        !td.isContentEditable &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"].includes(
          e.key,
        )
      ) {
        e.preventDefault();
        let col = a.charCodeAt(0),
          row = +a.slice(1);
        if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) col--;
        if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) col++;
        if (e.key === "ArrowUp") row--;
        if (e.key === "ArrowDown") row++;
        const next =
          String.fromCharCode(Math.max(65, Math.min(76, col))) +
          Math.max(1, Math.min(99, row));
        if (!e.shiftKey || e.key === "Tab") d.selected = next;
        d.end = next;
        refresh();
        const cell = $('[data-cell-address="' + next + '"]', el);
        cell?.focus();
        cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (td.isContentEditable) {
          commit({ [a]: td.textContent });
          td.contentEditable = false;
        }
        let next = a[0] + Math.min(99, +a.slice(1) + 1);
        d.selected = next;
        d.end = next;
        refresh();
        $(`[data-cell-address="${next}"]`, el)?.focus();
      } else if (!td.isContentEditable && e.key.length === 1 && !e.ctrlKey) {
        td.contentEditable = true;
        td.textContent = "";
      } else if (e.key === "Delete") {
        commit(
          Object.fromEntries(
            range(d.selected + ":" + d.end).map((a) => [a, ""]),
          ),
        );
      }
    };
    td.onblur = () => {
      if (td.isContentEditable) {
        commit({ [a]: td.textContent });
        td.contentEditable = false;
      }
    };
  });
  let form = $('[data-testid="sheet-formula"]', el);
  form.onkeydown = (e) => {
    if (e.key === "Enter") {
      commit({ [d.selected]: form.value });
      $(`[data-cell-address="${d.selected}"]`, el)?.focus();
    }
  };
  function copyCells() {
    let addrs = range(d.selected + ":" + d.end);
    let rows = {};
    for (let a of addrs) (rows[a.slice(1)] ??= []).push(cellValue(d.cells, a));
    let text = Object.values(rows)
      .map((r) => r.join("\t"))
      .join("\n");
    navigator.clipboard.writeText(text);
    E.state.clipboard.unshift(text);
    notify("选区已复制", s);
  }
  el.onpaste = (e) => {
    if (e.target.closest("td")) {
      e.preventDefault();
      let text = e.clipboardData.getData("text"),
        changes = {};
      text
        .split(/\r?\n/)
        .forEach((row, r) =>
          row
            .split("\t")
            .forEach(
              (v, c) =>
                (changes[
                  String.fromCharCode(d.selected.charCodeAt() + c) +
                    (+d.selected.slice(1) + r)
                ] = v),
            ),
        );
      commit(changes);
    }
  };
  function undo() {
    if (d.history.length) {
      d.redo.push(copy(d.cells));
      d.cells = d.history.pop();
      d.dirty = true;
      d.version++;
      publish(w);
      refresh();
    }
  }
  $(".undo", el).onclick = undo;
  $(".redo", el).onclick = () => {
    if (d.redo.length) {
      d.history.push(copy(d.cells));
      d.cells = d.redo.pop();
      d.version++;
      d.dirty = true;
      publish(w);
      refresh();
    }
  };
  $(".copy", el).onclick = copyCells;
  $(".bold", el).onclick = () => {
    d.formats ??= {};
    for (let a of range(d.selected + ":" + d.end)) d.formats[a] = !d.formats[a];
    d.dirty = true;
    refresh();
  };
  act(el, "sheet-save", () => {
    d.path = $('[data-testid="sheet-filename"]', el).value;
    saveDocument(s, w);
    refresh();
  });
  $(".sheet-new", el).onclick = async () => {
    let name = await askText(s, "新工作簿路径", "/Documents/新工作簿.sheet");
    if (name) {
      s.files[name] = '{"cells":{}}';
      open(s, "spreadsheet", name);
    }
  };
  el._refresh = refresh;
  refresh();
}
function publish(sheet) {
  for (let sys of Object.values(E.systems))
    for (let w of sys.windows)
      if (
        w.appId === "charts" &&
        w.data.connectionState === "已连接" &&
        w.data.sourceId === sheet.id
      ) {
        let d = w.data;
        try {
          let addrs = range(d.range),
            rows = {};
          for (let a of addrs) {
            let row = a.slice(1);
            (rows[row] ??= {})[a[0]] = cellValue(sheet.data.cells, a);
          }
          const queue = ((E.state.dataUpdates ??= {})[w.id] ??= []);
          queue.push({
            epoch: d.connectionEpoch || 0,
            version: sheet.data.version,
            rows: Object.values(rows),
          });
          if (queue.length > 1000) throw Error("数据队列配额不足");
        } catch (e) {
          d.connectionState = e.message;
        }
      }
}
function buildEditor(el, s, w) {
  let d = w.data;
  el.innerHTML = `<div class="toolbar">${icon("editor")}<input data-testid="editor-filename" class="filename" value="${esc(d.path)}">${btn("editor-save", "保存", "primary")}<select class="program-target" aria-label="程序设备归属"><option value="">普通程序</option>${s.windows
    .filter((x) => x.appId === "player")
    .map(
      (x) =>
        `<option value="${x.id}" ${d.targetWindowId === x.id ? "selected" : ""}>飞控 → ${x.id}</option>`,
    )
    .join(
      "",
    )}</select><button class="run-program">▷ 运行程序</button><button class="new-program">新建程序</button></div><div class="editor-label"><span>${esc(s.id)} / UTF-8</span><span>可编辑程序 · 保存后重新载入生效</span></div><textarea spellcheck="false" data-testid="editor-text" class="code-editor">${esc(d.text)}</textarea><div class="editor-output">${d.dirty ? "● 未保存" : "就绪"} · .nest 使用 JSON 指令格式；查看「使用指南」了解系统接口。</div>`;
  let input = $('[data-testid="editor-text"]', el);
  input.oninput = () => {
    d.text = input.value;
    d.dirty = true;
    $(".editor-output", el).textContent = "● 未保存";
  };
  input.onkeydown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      let start = input.selectionStart;
      input.setRangeText("  ", start, input.selectionEnd, "end");
      d.text = input.value;
      d.dirty = true;
    }
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      d.path = $('[data-testid="editor-filename"]', el).value;
      saveDocument(s, w);
    }
  };
  act(el, "editor-save", () => {
    d.path = $('[data-testid="editor-filename"]', el).value;
    saveDocument(s, w);
    $(".editor-output", el).textContent = "已保存 " + d.path;
  });
  $(".run-program", el).onclick = () => {
    try {
      saveDocument(s, w);
      const target = $(".program-target", el).value;
      if (target)
        for (const old of s.processes.filter(
          (p) => p.windowId === target && p.kind === "controller",
        ))
          E.end(s, old);
      let p = E.process(
        s,
        d.path,
        d.text,
        target ? "controller" : "user",
        target || null,
      );
      $(".editor-output", el).textContent = "已启动 " + p.id;
      notify("程序已启动：" + p.name, s);
    } catch (e) {
      $(".editor-output", el).textContent = "错误：" + e.message;
    }
  };
  $(".new-program", el).onclick = async () => {
    let name = await askText(s, "程序路径", "/Programs/custom.nest");
    if (name) {
      s.files[name] = defaults["/Programs/accumulate.nest"];
      open(s, "editor", name);
    }
  };
}
function buildSettings(el, s, w) {
  el.innerHTML = `<div class="settings-content"><div class="eyebrow">MAKE IT YOURS</div><h1>属于你的栖境</h1><p class="muted">外观与工作空间偏好，随每一个世界独立保存。</p><label class="setting-row">系统名称 <input class="system-name-input" value="${esc(s.name)}"></label><h3>桌面风景</h3><div class="wallpapers">${[
    ["lake", "晨雾山湖"],
    ["dusk", "暮色远山"],
    ["night", "月下青岚"],
  ]
    .map(
      ([v, n]) =>
        `<button data-testid="settings-wallpaper" data-value="${v}" class="wallpaper-card ${v} ${s.settings.wallpaper === v ? "chosen" : ""}"><span>${n}</span></button>`,
    )
    .join(
      "",
    )}</div><h3>强调色</h3><div class="swatches">${["#85cbb6", "#c9b0e8", "#dfb96a", "#8bbad4", "#d99588"].map((c) => `<button data-testid="settings-accent" data-value="${c}" style="background:${c}" title="${c}">${s.settings.accent === c ? "✓" : ""}</button>`).join("")}</div><label class="setting-row">界面缩放 <select data-testid="settings-scale"><option value="1">100%</option><option value="1.15">115%</option><option value="1.25">125%</option></select></label><label class="setting-row">免打扰 <input type="checkbox" class="dnd" ${s.settings.dnd ? "checked" : ""}></label></div>`;
  $(".system-name-input", el).onchange = (e) => {
    s.name = e.target.value;
    sync();
  };
  $$('[data-testid="settings-wallpaper"]', el).forEach(
    (b) =>
      (b.onclick = () => {
        s.settings.wallpaper = b.dataset.value;
        sync();
        $$(".wallpaper-card", el).forEach((x) =>
          x.classList.toggle("chosen", x === b),
        );
      }),
  );
  $$('[data-testid="settings-accent"]', el).forEach(
    (b) =>
      (b.onclick = () => {
        s.settings.accent = b.dataset.value;
        sync();
      }),
  );
  let scale = $('[data-testid="settings-scale"]', el);
  scale.value = s.settings.scale;
  scale.onchange = () => {
    s.settings.scale = +scale.value;
    sync();
  };
  $(".dnd", el).onchange = (e) => (s.settings.dnd = e.target.checked);
  el._update = () => {
    if (document.activeElement !== scale)
      scale.value = String(s.settings.scale);
    $(".dnd", el).checked = s.settings.dnd;
  };
}
function buildWidgets(el, s, w) {
  let d = w.data;
  el.innerHTML = `<div class="widget-grid"><section class="widget clock-widget"><span class="eyebrow">此时此刻</span><div class="big-clock"></div><div class="muted">虚拟时钟 · ${s.id}</div></section><section class="widget"><div class="widget-title">专注倒计时 <span>◷</span></div><div class="timer-display">00:00</div><div class="inline"><input data-testid="widget-timer-input" type="number" min="1" value="300" aria-label="倒计时秒数"><span>秒</span>${btn("widget-timer-start", "开始", "primary")}${btn("widget-timer-pause", "暂停")}${btn("widget-timer-reset", "重置")}</div></section><section class="widget calendar"><div class="widget-title"><button class="prev-month">‹</button><b class="month-name"></b><button class="next-month">›</button></div><div class="calendar-days"></div></section><section class="widget"><div class="widget-title">随手记 ${btn("widget-note-save", "保存")}</div><textarea data-testid="widget-note-text" placeholder="把此刻的灵感留在这里…">${esc(d.note)}</textarea></section><section class="widget"><div class="widget-title">秒表 <span class="sw-time">0.0s</span></div><button class="sw-start">开始 / 暂停</button><button class="sw-reset">归零</button><h4>剪贴板历史</h4><div data-testid="widget-clipboard-list" class="clipboard-list"></div></section><section class="widget"><div class="widget-title">最近通知</div><div data-testid="widget-notifications"></div><label><input class="dnd" type="checkbox" ${s.settings.dnd ? "checked" : ""}> 免打扰</label><div class="quick-settings"><h4>快捷设置</h4><label>强调色 <input class="quick-accent" type="color" value="${s.settings.accent}" aria-label="快捷强调色"></label><label>界面缩放 <select class="quick-scale" aria-label="快捷界面缩放"><option value="1">100%</option><option value="1.15">115%</option><option value="1.25">125%</option></select></label></div></section></div>`;
  function calendar() {
    let date = systemDate(s);
    date.setDate(1);
    date.setMonth(date.getMonth() + d.month);
    $(".month-name", el).textContent =
      date.getFullYear() + "年 " + (date.getMonth() + 1) + "月";
    let count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    $(".calendar-days", el).innerHTML =
      ["一", "二", "三", "四", "五", "六", "日"]
        .map((x) => `<small>${x}</small>`)
        .join("") +
      Array.from(
        { length: (date.getDay() + 6) % 7 },
        () => "<span></span>",
      ).join("") +
      Array.from(
        { length: count },
        (_, i) =>
          `<span class="${i + 1 === systemDate(s).getDate() && !d.month ? "today" : ""}">${i + 1}</span>`,
      ).join("");
  }
  $(".prev-month", el).onclick = () => {
    d.month--;
    calendar();
  };
  $(".next-month", el).onclick = () => {
    d.month++;
    calendar();
  };
  calendar();
  act(el, "widget-timer-start", () => {
    d.remaining =
      d.remaining ||
      Math.max(
        1,
        Math.min(
          86400,
          +$('[data-testid="widget-timer-input"]', el).value || 1,
        ),
      );
    d.running = true;
    d.lastClock = s.clock;
  });
  act(el, "widget-timer-pause", () => (d.running = false));
  act(el, "widget-timer-reset", () => {
    d.running = false;
    d.remaining = 0;
  });
  act(el, "widget-note-save", () => {
    d.note = $('[data-testid="widget-note-text"]', el).value;
    E.write(s, "/Documents/便笺.txt", d.note);
    notify("便笺已保存", s);
  });
  $(".quick-accent", el).onchange = (e) => {
    s.settings.accent = e.target.value;
    sync();
  };
  $(".quick-scale", el).value = String(s.settings.scale);
  $(".quick-scale", el).onchange = (e) => {
    s.settings.scale = +e.target.value;
    sync();
  };
  $(".sw-start", el).onclick = () => (d.swRunning = !d.swRunning);
  $(".sw-reset", el).onclick = () => (d.stopwatch = 0);
  $(".dnd", el).onchange = (e) => (s.settings.dnd = e.target.checked);
  el._update = () => {
    $(".dnd", el).checked = s.settings.dnd;
    if (document.activeElement !== $(".quick-accent", el))
      $(".quick-accent", el).value = s.settings.accent;
    if (document.activeElement !== $(".quick-scale", el))
      $(".quick-scale", el).value = String(s.settings.scale);
    $(".big-clock", el).textContent = systemDate(s).toLocaleTimeString(
      "zh-CN",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );
    $(".timer-display", el).textContent =
      Math.floor(d.remaining / 60)
        .toString()
        .padStart(2, "0") +
      ":" +
      Math.ceil(d.remaining % 60)
        .toString()
        .padStart(2, "0");
    $(".sw-time", el).textContent = d.stopwatch.toFixed(1) + "s";
    $('[data-testid="widget-clipboard-list"]', el).innerHTML =
      E.state.clipboard
        .slice(0, 4)
        .map((t) => `<p>${esc(t)}</p>`)
        .join("") || "<small>复制的内容会出现在这里</small>";
    $('[data-testid="widget-notifications"]', el).innerHTML =
      E.state.notifications
        .filter((n) => n.systemId === s.id)
        .slice(0, 3)
        .map((n) => `<p>${esc(n.text)}</p>`)
        .join("") || "<small>暂无通知</small>";
  };
  el._update();
}
function buildSystems(el, s, w) {
  el.innerHTML = `<div class="systems-head"><div><div class="eyebrow">WORKSPACE ORCHESTRATION</div><h1>系统空间</h1><p class="muted">独立运行，层层相连。管理 ${s.id} 的直属子系统。</p></div>${btn("system-new", "＋ 新建子系统", "primary")}</div><div class="system-list"></div><div class="system-foot">固定逻辑步 1/30 秒 · 暂停覆盖整棵子树 · 单步保留后代暂停状态</div>`;
  act(el, "system-new", () => {
    newSystem(s);
    refresh();
  });
  function refresh() {
    let list = $(".system-list", el);
    list.innerHTML =
      Object.values(E.systems)
        .filter((c) => c.parentId === s.id)
        .map(
          (c) =>
            `<article class="system-card" data-target-system-id="${c.id}"><div class="system-card-head"><span class="app-icon systems">${icon("layers")}</span><div><b>${c.name}</b><small>${s.id} → ${c.id}</small></div><span class="state-pill">${c.state}</span><button class="enter">打开桌面 ↗</button></div><div class="system-metrics"><span>虚拟时间 <b>${c.clock.toFixed(2)} s</b></span><span>逻辑工作 <b>${c.used} / ${c.budget}</b></span><span>后代系统 <b>${E.descendants(c.id).length - 1}</b></span></div>${c.error ? `<p data-testid="kernel-error" class="error">${esc(c.error)}</p>` : ""}<div class="system-actions">${btn("system-pause", "暂停")}${btn("system-resume", "继续")}<button class="step">单步</button><select class="rate"><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select>${btn("system-restart", "重启")}${btn("kernel-open", "编辑内核")}<button class="snapshot">创建快照</button><button class="restore">恢复快照</button><button class="fork">分叉</button><button class="stop">停止</button></div></article>`,
        )
        .join("") ||
      '<div class="empty">还没有子系统<small>新建一个系统，探索独立的时间与空间。</small></div>';
    $$(".system-card", list).forEach((card) => {
      let c = E.systems[card.dataset.targetSystemId];
      $$("button,input", card).forEach(
        (b) => (b.dataset.targetSystemId = c.id),
      );
      $(".enter", card).onclick = () => {
        let sw = s.windows.find((x) => x.data.child === c.id);
        if (!sw) makeWindow(s, "system", c.name, { child: c.id });
        else {
          sw.state = "normal";
          sw.z = ++z;
          sync();
        }
      };
      act(card, "system-pause", () => {
        c.state = "paused";
        refresh();
      });
      act(card, "system-resume", () => {
        c.state = "running";
        refresh();
      });
      $(".step", card).onclick = () => {
        if (E.running(s)) {
          E.advance(c, Math.min(s.budget, c.grant), 1 / 30, true);
          refresh();
        }
      };
      $(".rate", card).value = c.rate;
      $(".rate", card).onchange = (e) => (c.rate = +e.target.value);
      act(card, "system-restart", () => {
        E.restart(c);
        rebuildSubtree(c.id);
        refresh();
        notify("已重新载入内核与程序", s);
      });
      act(card, "kernel-open", () => open(s, "editor", c.kernelPath));
      $(".stop", card).onclick = async () => {
        if (await askConfirm(s, "停止整棵子树？")) {
          E.stop(c);
          refresh();
        }
      };
      $(".snapshot", card).onclick = () => {
        try {
          E.queueSnapshot(s, c, "/Snapshots/" + c.id + ".snapshot");
          notify("正在按父系统预算保存快照…", s);
        } catch (error) {
          notify(error.message, s);
        }
      };
      $(".restore", card).onclick = () => {
        let raw = s.files["/Snapshots/" + c.id + ".snapshot"];
        if (!raw) {
          notify("请先创建快照", s);
          return;
        }
        let restored = E.restore(c, JSON.parse(raw));
        rebuildSubtree(restored.id);
        notify("已恢复快照", s);
      };
      $(".fork", card).onclick = () => {
        let raw = s.files["/Snapshots/" + c.id + ".snapshot"];
        let child = E.restore(c, raw ? JSON.parse(raw) : E.snapshot(c), true);
        makeWindow(s, "system", child.id, { child: child.id });
        refresh();
        notify("已创建独立分叉 " + child.id, s);
      };
    });
    annotate(el, s, w);
  }
  el._refresh = refresh;
  refresh();
}
function buildTasks(el, s, w) {
  el.innerHTML = `<div class="tasks-heading"><div><div class="eyebrow">RESOURCE MONITOR</div><h2>进程与资源</h2></div><span class="state-pill">${s.id}</span></div><div class="budget-grid"><label>总执行预算 <input data-testid="tasks-budget" type="number" min="1" value="${s.budget}"></label><label>内存配额 / KB <input data-testid="tasks-memory" type="number" value="${s.memory}"></label><label>存储配额 / KB <input data-testid="tasks-storage" type="number" value="${s.storage}"></label></div><div class="resource-meter"></div><div class="task-table-wrap"><table class="task-table"><thead><tr><th>进程 / 身份</th><th>状态</th><th>累计指令</th><th>本步</th><th>PC / 队列</th><th>剩余 / KB</th><th>额度</th><th>控制</th></tr></thead><tbody></tbody></table></div><div class="task-detail"></div><div class="browser-resources"></div><div class="task-footer">每条指令 1 单位 · 承载读数包含后代 · Chromium 网页不计入逻辑执行</div>`;
  for (let [id, key] of [
    ["tasks-budget", "budget"],
    ["tasks-memory", "memory"],
    ["tasks-storage", "storage"],
  ])
    $(`[data-testid="${id}"]`, el).onchange = (e) =>
      (s[key] = Math.max(1, +e.target.value));
  function refresh() {
    if (
      el.contains(document.activeElement) &&
      document.activeElement.tagName === "INPUT"
    )
      return;
    $(".resource-meter", el).innerHTML =
      `<span>实际拨付 <b>${s.used}</b> / ${s.budget}</span><span>内核 <b>${s.own}</b></span><span>内存 <b>${E.memoryUsed(s)} KB</b></span><span>存储 <b>${E.storageUsed(s)} KB</b></span><span>虚拟时钟 <b>${s.clock.toFixed(2)}s</b></span>`;
    $("tbody", el).innerHTML = s.processes
      .map(
        (p) =>
          `<tr data-pid="${p.id}"><td><b>${esc(p.name)}</b><small>${p.id}${p.child ? " → " + p.child : ""}</small></td><td><span class="status ${p.state}">${{ ready: "就绪", running: "运行", waiting: "等待", suspended: "挂起", ended: "结束", error: "异常" }[p.state] || p.state}</span></td><td>${p.work}</td><td>${p.last}</td><td>${p.pc} / ${p.queue.length}</td><td>${p.remaining || 0} / ${p.state === "ended" ? 0 : Math.ceil(JSON.stringify(p).length / 1024)}</td><td><input type="number" class="quota" value="${p.child ? E.systems[p.child]?.grant : p.quota}" ${p.child ? `data-testid="tasks-grant" data-target-system-id="${p.child}"` : ""}></td><td><button class="suspend" ${["ended", "error"].includes(p.state) ? "disabled" : ""}>${p.state === "suspended" ? "继续" : "挂起"}</button><button class="end">结束</button></td></tr>`,
      )
      .join("");
    $$("tbody tr[data-pid]", el).forEach((row) => {
      let p = s.processes.find((p) => p.id === row.dataset.pid);
      $(".suspend", row).onclick = () => {
        if (p.state === "suspended") p.state = p.suspendedState || "ready";
        else {
          p.suspendedState = p.state;
          p.state = "suspended";
        }
        refresh();
      };
      $(".end", row).onclick = () => {
        E.end(s, p);
        sync();
        refresh();
      };
      $(".quota", row).onchange = (e) => {
        if (p.child) E.systems[p.child].grant = Math.max(0, +e.target.value);
        else p.quota = Math.max(0, +e.target.value);
      };
      row.onclick = (e) => {
        if (e.target.closest("button,input")) return;
        $(".task-detail", el).textContent = JSON.stringify(
          {
            身份: p.id,
            变量: p.vars,
            输出: p.output,
            错误: p.error,
            等待: p.waitFor || "",
            剩余工作: p.remaining,
            ...(p.child
              ? {
                  子系统内核本步: E.systems[p.child]?.own,
                  子树本步: E.systems[p.child]?.used,
                }
              : {}),
          },
          null,
          2,
        );
      };
    });
    const guests = s.windows
      .filter((w) => w.appId === "browser")
      .flatMap((w) => (w.data.tabs || []).map((t) => ({ window: w, tab: t })));
    $(".browser-resources", el).innerHTML = guests.length
      ? "<h4>Chromium 网页视图 · 独立于逻辑预算</h4>" +
        guests
          .map(
            ({ window: w, tab: t }) =>
              '<div class="guest-row"><span><b>' +
              esc(t.title) +
              "</b><small>" +
              esc(t.url) +
              "</small></span><span>" +
              esc(t.loadState) +
              '</span><span>工作量 / 内存由 Chromium 管理</span><button data-browser-window="' +
              w.id +
              '" data-browser-tab="' +
              t.id +
              '">结束网页</button></div>',
          )
          .join("")
      : "";
    $$("[data-browser-tab]", el).forEach(
      (button) =>
        (button.onclick = () => {
          const browser = views.get(button.dataset.browserWindow),
            tab = button.dataset.browserTab;
          browser
            ?.querySelector(
              '[data-testid="browser-close-tab"][data-tab-id="' + tab + '"]',
            )
            ?.click();
          refresh();
        }),
    );
    annotate(el, s, w);
  }
  el._refresh = refresh;
  refresh();
}
function buildBrowser(el, s, w) {
  let d = w.data;
  d.tabs ??= [
    {
      id: "tab-" + Date.now(),
      url: "https://www.bilibili.com",
      title: "新标签页",
      loadState: "loading",
    },
  ];
  d.active ??= d.tabs[0].id;
  el.innerHTML = `<div class="browser-tabs"></div><div class="browser-nav">${btn("browser-back", "←")}${btn("browser-forward", "→")}${btn("browser-reload", "↻")}<button class="browser-stop" title="停止加载">×</button><span class="lock">◇</span><input data-testid="browser-address" aria-label="网址">${btn("browser-go", "前往")}</div><div class="browser-status"></div><div class="webviews"></div>`;
  let webviews = new Map();
  function active() {
    return webviews.get(d.active);
  }
  function tabs() {
    let strip = $(".browser-tabs", el);
    strip.innerHTML =
      d.tabs
        .map(
          (t) =>
            `<div data-testid="browser-tab" data-tab-id="${t.id}" class="browser-tab ${d.active === t.id ? "selected" : ""}"><span>${esc(t.title)}</span><button data-testid="browser-close-tab" data-tab-id="${t.id}" title="关闭标签">×</button></div>`,
        )
        .join("") + btn("browser-new-tab", "＋");
    $$('[data-testid="browser-tab"]', strip).forEach((b) => {
      b.onclick = () => {
        d.active = b.dataset.tabId;
        tabs();
      };
      $("button", b).onclick = (e) => {
        e.stopPropagation();
        let id = b.dataset.tabId;
        webviews.get(id)?.remove();
        webviews.delete(id);
        d.tabs = d.tabs.filter((t) => t.id !== id);
        if (!d.tabs.length) add("https://example.com");
        if (d.active === id) d.active = d.tabs[0].id;
        tabs();
      };
    });
    act(strip, "browser-new-tab", () => add("https://example.com"));
    for (let t of d.tabs) {
      let v = webviews.get(t.id);
      if (!v) {
        v = document.createElement("webview");
        v.setAttribute("src", t.url);
        v.setAttribute("partition", "persist:nest-browser");
        v.setAttribute(
          "webpreferences",
          "contextIsolation=yes,nodeIntegration=no,backgroundThrottling=no",
        );
        v.style.width = "100%";
        v.style.height = "100%";
        $(".webviews", el).append(v);
        webviews.set(t.id, v);
        v.addEventListener("did-start-loading", () => {
          t.loadState = "loading";
          $(".browser-status", el).textContent = "正在连接 " + t.url;
        });
        v.addEventListener("did-stop-loading", () => {
          if (t.loadState === "error") return;
          t.loadState = "complete";
          if (t.id === d.active)
            $(".browser-status", el).textContent =
              "页面加载完成 · Chromium 安全网页视图";
        });
        v.addEventListener("did-fail-load", (e) => {
          if (e.errorCode === -3) return;
          t.loadState = "error";
          $(".browser-status", el).textContent =
            "加载失败：" + e.errorDescription + " · 点击 ↻ 重试";
        });
        v.addEventListener("page-title-updated", (e) => {
          t.title = e.title;
          tabs();
        });
        for (let event of ["did-navigate", "did-navigate-in-page"])
          v.addEventListener(event, (e) => {
            t.url = e.url;
            if (t.id === d.active)
              $('[data-testid="browser-address"]', el).value = t.url;
          });
      }
      v.style.display = t.id === d.active ? "flex" : "none";
    }
    $('[data-testid="browser-address"]', el).value =
      d.tabs.find((t) => t.id === d.active)?.url || "";
    annotate(el, s, w);
  }
  function add(url) {
    let t = {
      id: "tab-" + Date.now() + "-" + d.tabs.length,
      url,
      title: "新标签页",
      loadState: "loading",
    };
    d.tabs.push(t);
    d.active = t.id;
    tabs();
  }
  function go() {
    let url = $('[data-testid="browser-address"]', el).value.trim();
    if (!/^https?:\/\//.test(url)) url = "https://" + url;
    active()?.loadURL(url);
  }
  act(el, "browser-go", go);
  $('[data-testid="browser-address"]', el).onkeydown = (e) => {
    if (e.key === "Enter") go();
  };
  act(el, "browser-back", () => {
    if (active()?.canGoBack()) active().goBack();
  });
  act(el, "browser-forward", () => {
    if (active()?.canGoForward()) active().goForward();
  });
  act(el, "browser-reload", () => active()?.reload());
  $(".browser-stop", el).onclick = () => active()?.stop();
  el._newTab = add;
  tabs();
}
window.host.onTab((url) => {
  let w = E.root.windows.find((w) => w.appId === "browser");
  if (w) {
    $(".window-content", views.get(w.id))._newTab?.(url);
  }
});
function buildHelp(el, s, w) {
  el.innerHTML = `<article class="help-content"><div class="eyebrow">NEST OS / FIELD GUIDE</div><h1>欢迎来到栖境。</h1><p class="lead">一个桌面之内，是另一个完整的世界。</p><h2>开始探索</h2><p>双击桌面图标打开应用。左下角开始菜单包含全部工具。拖动窗口标题栏可以移动，靠近左右边缘贴靠半屏；双击标题栏最大化，右下角拖动缩放。任务栏恢复最小化窗口。</p><h2>系统空间与快照</h2><p>「启动子系统」创建独立桌面，任意层都能继续创建。系统空间管理直属实例的暂停、继续、单步（1/30 秒）、调速、重启、快照和分叉。暂停整棵子树不会影响兄弟与祖先。快照存入父系统 /Snapshots，可通过文件管理器导出、导入与双击分叉。</p><h2>程序与内核</h2><p>程序位于 /Programs，编译器和窗口管理程序位于 /System。每个子系统的内核在父系统 /System/inner-N.kernel.nest。保存修改后，从父系统「系统空间」重启实例。内核的 policy 变量支持 round-robin / priority；messagePrefix 改变消息投递，filePrefix 改变程序文件写入；增加变量即可以同名系统调用读取值。window-manager 的 stack 可设 reverse 改变层叠。</p><pre>{"version":1,"code":[
 {"op":"set","name":"n","value":"0"},
 {"op":"set","name":"n","value":"n+1"},
 {"op":"if","test":"n&lt;50","to":1},
 {"op":"sys","call":"print","value":"n"},
 {"op":"end"}
]}</pre><p>set 计算表达式；if / jump 使用从 0 开始的指令位置；wait 等待虚拟秒数；send 的 target 为进程身份或本系统程序名；recv 将消息写入 name 指定变量。sys 提供 clock、identity、file.read（path/name）、file.write（path/value）、process.spawn（path）、process.end（value）及 print。字符串表达式需要 JSON 双引号。预置 receiver、sender 与 spin 可组合验证消息与竞争。</p><h2>编译器与服务扩展</h2><p>/System/compiler.nest 使用同一套指令逐条解析、遍历和转换程序。默认把 increment 转换为加 1；修改第 10 条指令的表达式为 target+&quot;+2&quot;，后续程序便实际加 2。运行编译器自身可编译自身，结果写入 /System/compiler.compiled.nest。内核的 services 字典可新增系统调用，使用 return 返回结果；预置 math.double 接受 input。程序调用 display.submit 可提交文本、二维图形数组或 scene 路径。</p><h2>资源与调度</h2><p>进程管理器显示真实指令计数、程序位置、消息队列和变量。每条 VM 指令计 1 单位；内核 dispatch 的后代执行计入父级拨付。额度是上限，时间倍率不增加预算。可挂起或结束指定进程。内存与文件存储使用序列化数据 KB，加上场景设备估算。Chromium 网页、宿主渲染和界面构造不计入指令预算。</p><h2>三维播放器与排演</h2><p>在子系统打开 /Demo/helicopter-24.scene。紫黄 24 号直升机的演出为 15 秒、30 FPS。播放、逐帧、进度、倍率和镜头均可操作。自由环绕可拖拽、滚轮缩放；单击部件点选。「飞行排演」从当前姿态接续，风、航向与故障影响飞行，飞控程序在 /Programs/flight-control.nest。flight.sensor 返回高度；flight.control 写入总距，加速度单位 m/s²。控制周期落后导致姿态失稳。排演保存为 .flight，可重开与跳转。</p><h2>独立场景文件</h2><p>.scene 是 JSON 数据，包含 nodes、lights、camera、duration。节点支持 box/sphere/cylinder/cone/plane/torus/group，position/scale/rotation、parent、color、tracks。旋转为弧度。示例最小场景：</p><pre>{"version":1,"duration":10,"background":"#b9cec0",
"camera":{"position":[4,3,6],"target":[0,0,0]},
"lights":[{"type":"hemisphere","sky":"#ffffff","ground":"#888888","intensity":2}],
"nodes":[{"id":"立方体","type":"box","position":[0,0,0],"scale":[2,2,2],"color":"#7863b8"}]}</pre><h2>数据与投送</h2><p>根系统先打开工作簿；子系统图表选择工作簿、矩形区域、标签列与数值列，再点击连接。表格修改（包括未保存、粘贴和撤销）发布独立版本。暂停时排队，恢复后按序处理。播放器与图表右上角「投送」选择任意祖先，外框属于目标桌面，内容与输入属于源实例。关闭投送不结束源程序。</p><h2>文件与保存</h2><p>文件支持右键重命名、复制、剪切、删除与恢复。跨窗口拖放将独立副本传入目标目录；导入和导出连接本机文件。工作簿 .sheet 保存 cells 字典，支持四则运算、括号、单元格与 SUM(A1:B3)。应用每 5 秒自动保存桌面运行状态至指定数据目录，程序和文档的编辑需点击保存。</p></article>`;
}
function projectControls(el, s, w) {
  if (!s.parentId) return;
  let parent = s.parentId,
    options = [];
  while (parent) {
    options.push(parent);
    parent = E.systems[parent]?.parentId;
  }
  let controls = document.createElement("div");
  controls.className = "project-controls";
  controls.innerHTML =
    btn("window-project", icon("project") + " 投送") +
    `<div class="project-menu" hidden>${options.map((id) => `<button data-testid="project-target" data-target-system-id="${id}">${id === "outer" ? "根桌面 · outer" : id} ↗</button>`).join("")}</div>`;
  $(".app-top", el)?.append(controls);
  act(
    controls,
    "window-project",
    () =>
      ($(".project-menu", controls).hidden = !$(".project-menu", controls)
        .hidden),
  );
  $$('[data-testid="project-target"]', controls).forEach(
    (b) =>
      (b.onclick = () => {
        project(s, w, b.dataset.targetSystemId);
        $(".project-menu", controls).hidden = true;
      }),
  );
}
function buildPlayer(el, s, w) {
  let d = w.data;
  el.classList.add("player-app");
  el.innerHTML = `<div class="app-top"><div><span class="eyebrow">SCENE PLAYER / ${s.id}</span><strong>${esc(d.resource.title || "三维场景")}</strong></div>${btn("player-open", "打开场景")}</div><div class="player-stage"><canvas data-testid="player-view"></canvas><div class="scene-badge"><span class="scene-live">● 实时三维</span><span>${esc(d.resource.description || "独立场景资源")}</span></div><div class="scene-number">${esc(d.resource.registration || "")}<span>SCENE STUDY</span></div><div class="scene-selection" data-testid="player-selection">${esc(d.selection)}</div><div class="scene-paused" hidden>系统已暂停 · 画面冻结</div></div><div class="player-transport"><div class="transport-main">${btn("player-play", "▶", "primary")}${btn("player-pause", "Ⅱ")}${btn("player-stop", "■")}${btn("player-step", "▷|")}<span data-testid="player-time" class="timecode">00:00 / 00:15</span><input data-testid="player-position" class="position-input" type="number" min="0" step="0.033333" value="${d.position}" aria-label="跳转到秒数"><span class="transport-spacer"></span><label>循环 <input data-testid="player-loop" type="checkbox" ${d.loop ? "checked" : ""}></label><select data-testid="player-rate"><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><select data-testid="player-camera"><option>演出镜头</option><option>跟随镜头</option><option>自由环绕</option></select></div><input data-testid="player-seek" type="range" min="0" max="${d.duration}" step="0.033333" value="${d.position}"><div class="timeline-labels"><span>00:00 / 旋翼启动</span><span>起飞 / 前飞</span><span>故障 / 失控</span><span>00:15 / 余波</span></div></div><details class="rehearsal"><summary>飞行排演 <span>控制、风与调度，决定下一次飞行。</span></summary><div class="rehearsal-controls">${btn("rehearsal-start", "开始排演", "primary")}<label>风 <input data-testid="rehearsal-wind" type="range" min="-10" max="10" step=".5" value="0"></label><label>目标航向 <input data-testid="rehearsal-heading" type="number" value="0" min="-180" max="180"></label>${btn("rehearsal-fault", "触发故障")}${btn("rehearsal-controller", "编辑飞控")}<button class="save-flight">保存记录</button><span class="flight-status"></span></div></details>`;
  for (let [id, type] of [
    ["player-play", "play"],
    ["player-pause", "pause"],
    ["player-stop", "stop"],
    ["player-step", "step"],
    ["rehearsal-start", "rehearsal"],
    ["rehearsal-fault", "fault"],
  ])
    act(el, id, () => send(s, w, type));
  $('[data-testid="player-seek"]', el).oninput = (e) =>
    send(s, w, "seek", { value: +e.target.value });
  $('[data-testid="player-rate"]', el).value = d.rate;
  $('[data-testid="player-rate"]', el).onchange = (e) =>
    send(s, w, "rate", { value: +e.target.value });
  $('[data-testid="player-loop"]', el).onchange = (e) =>
    send(s, w, "loop", { value: e.target.checked });
  $('[data-testid="player-camera"]', el).value = d.camera;
  $('[data-testid="player-camera"]', el).onchange = (e) =>
    send(s, w, "camera", { value: e.target.value });
  $('[data-testid="rehearsal-wind"]', el).oninput = (e) =>
    send(s, w, "wind", { value: +e.target.value });
  $('[data-testid="rehearsal-heading"]', el).onchange = (e) =>
    send(s, w, "heading", { value: +e.target.value });
  act(el, "rehearsal-controller", () =>
    open(s, "editor", "/Programs/flight-control.nest", {
      targetWindowId: w.id,
    }),
  );
  act(el, "player-open", async () => {
    let path = await askText(s, "场景文件路径", d.scene);
    if (path && s.files[path]) {
      let resource = JSON.parse(s.files[path]);
      send(s, w, "load", { resource, scene: path });
    } else if (path) notify("文件不存在：" + path, s);
  });
  $(".save-flight", el).onclick = () => send(s, w, "save-record");
  let canvas = $("canvas", el);
  canvas.onpointerdown = (e) => {
    e.stopPropagation();
    let x = e.clientX,
      y = e.clientY,
      dragged = false;
    canvas.setPointerCapture(e.pointerId);
    canvas.onpointermove = (ev) => {
      if (Math.abs(ev.clientX - x) > 3) {
        dragged = true;
        send(s, w, "orbit", {
          value: (d.orbit ?? 0.75) + (ev.clientX - x) * 0.01,
        });
        x = ev.clientX;
      }
    };
    canvas.onpointerup = (ev) => {
      canvas.onpointermove = null;
      if (!dragged) send(s, w, "select", { value: pickScene(canvas, ev) });
    };
  };
  canvas.onwheel = (e) => {
    e.preventDefault();
    send(s, w, "distance", {
      value: Math.max(6, Math.min(45, (d.distance ?? 17) + e.deltaY * 0.02)),
    });
  };
  $('[data-testid="player-position"]', el).onchange = (e) =>
    send(s, w, "seek", { value: +e.target.value });
  projectControls(el, s, w);
  el._update = () => {
    $(".app-top strong", el).textContent = d.resource.title || "三维场景";
    const numeric = $('[data-testid="player-position"]', el);
    numeric.max = d.duration;
    for (const [id, key] of [
      ["player-rate", "rate"],
      ["player-camera", "camera"],
    ]) {
      const control = $('[data-testid="' + id + '"]', el);
      if (document.activeElement !== control) control.value = d[key];
    }
    $('[data-testid="player-loop"]', el).checked = !!d.loop;
    if (document.activeElement !== numeric)
      numeric.value = d.position.toFixed(2);
    let active = E.running(s);
    $(".scene-paused", el).hidden = active;
    $$(
      ".player-transport button,.player-transport input,.player-transport select,.rehearsal input",
      el,
    ).forEach((b) => (b.disabled = !active));
    $('[data-testid="player-seek"]', el).max = d.duration;
    $('[data-testid="player-time"]', el).textContent =
      d.position.toFixed(2) + " / " + d.duration.toFixed(2) + " s";
    if (document.activeElement !== $('[data-testid="player-seek"]', el))
      $('[data-testid="player-seek"]', el).value = d.position;
    $('[data-testid="player-selection"]', el).textContent =
      d.selection || "点击机体查看部件";
    $(".scene-live", el).textContent =
      "● " +
      (d.flight ? "飞行排演" : d.state === "playing" ? "正在播放" : "画面就绪");
    $(".flight-status", el).textContent = d.flight
      ? `高度 ${d.flight.y.toFixed(1)} m · 控制延迟 ${(s.clock - d.flight.controlTime).toFixed(2)} s${d.flight.crashed ? " · 撞击" : d.flight.landed ? " · 安全着陆" : ""}`
      : "";
    if (
      canvas.getBoundingClientRect().width > 0 &&
      canvas.closest(".app-window")?.style.display !== "none"
    ) {
      try {
        drawScene(canvas, copy(w.presentation || d));
      } catch (e) {
        $(".scene-selection", el).textContent = "场景错误：" + e.message;
      }
    }
  };
  el._update();
}
function buildCharts(el, s, w) {
  let d = w.data;
  el.classList.add("charts-app");
  el.innerHTML = `<div class="app-top"><div><span class="eyebrow">LIVE DATA / ${s.id}</span><strong>让数据，成为风景。</strong></div></div><div class="chart-config"><label>源工作簿<select data-testid="chart-source"></select></label><label>区域<input data-testid="chart-range" value="${esc(d.range)}"></label><label>标签列<input data-testid="chart-label-column" value="${esc(d.label)}"></label><label>数值列<input data-testid="chart-series" value="${esc(d.series)}" placeholder="B,D"></label>${btn("chart-connect", "连接数据", "primary")}${btn("chart-disconnect", "断开")}</div><div class="chart-head"><div><h3 class="chart-title">工作簿数据概览</h3><span class="chart-connection"></span></div><select data-testid="chart-type"><option value="bar">分组柱状图</option><option value="line">折线图</option></select></div><div class="chart-plot"></div><div class="chart-bottom"><span class="chart-selected">点击数据点查看数值</span><span class="chart-version">尚未接收数据</span></div>`;
  function sources() {
    let select = $('[data-testid="chart-source"]', el);
    let options = E.root.windows.filter((w) => w.appId === "spreadsheet");
    if (options.map((w) => w.id).join() !== select.dataset.options) {
      select.dataset.options = options.map((w) => w.id).join();
      select.innerHTML = options.length
        ? options
            .map((w) => `<option value="${w.id}">${esc(w.data.path)}</option>`)
            .join("")
        : '<option value="">请先在根系统打开工作簿</option>';
      if (d.sourceId) select.value = d.sourceId;
    }
  }
  sources();
  act(el, "chart-connect", () => {
    send(s, w, "connect", {
      sourceId: $('[data-testid="chart-source"]', el).value,
      range: $('[data-testid="chart-range"]', el).value,
      label: $('[data-testid="chart-label-column"]', el).value.toUpperCase(),
      series: $('[data-testid="chart-series"]', el).value.toUpperCase(),
    });
  });
  act(el, "chart-disconnect", () => send(s, w, "disconnect"));
  $('[data-testid="chart-type"]', el).value = d.chartType;
  $('[data-testid="chart-type"]', el).onchange = (e) =>
    send(s, w, "chart-type", { value: e.target.value });
  projectControls(el, s, w);
  el._update = () => {
    sources();
    if (document.activeElement !== $('[data-testid="chart-type"]', el))
      $('[data-testid="chart-type"]', el).value = d.chartType;
    $$(
      ".chart-config input,.chart-config select,.chart-config button,.chart-head select",
      el,
    ).forEach((control) => (control.disabled = !E.running(s)));
    $(".chart-connection", el).textContent =
      (E.running(s) ? d.connectionState : "源系统已暂停") +
      " · " +
      d.sourceTitle +
      " / " +
      d.range;
    $(".chart-version", el).textContent =
      "版本 " +
      d.version +
      " · 待处理 " +
      ((E.state.dataUpdates?.[w.id]?.length || 0) + (d.pending?.length || 0));
    let key = JSON.stringify([d.cache, d.chartType, d.version]);
    if (el._chartKey === key) return;
    el._chartKey = key;
    let plot = $(".chart-plot", el);
    if (d.cache.length < 2) {
      plot.innerHTML = `<div class="empty chart-empty">${icon("charts")}<h2>连接一个工作簿</h2><p>选择根系统的表格区域，让每一次修改实时可见。</p><small>推荐示例：sample.sheet · A1:D4 · 数值列 D</small></div>`;
      return;
    }
    let data = d.cache.slice(1),
      series = d.series.split(",").map((x) => x.trim()),
      min =
        Math.min(0, ...data.flatMap((row) => series.map((k) => +row[k] || 0))) *
        1.2,
      max =
        Math.max(1, ...data.flatMap((row) => series.map((k) => +row[k] || 0))) *
        1.2,
      colors = ["#79bca6", "#b4a1d2", "#d8b56a", "#89b9cc"],
      cw = 640,
      ch = 280,
      left = 55,
      bottom = 238,
      top = 20,
      group = (cw - left - 30) / data.length;
    let svg = `<svg viewBox="0 0 ${cw} ${ch}" role="img" aria-label="工作簿实时图表">`;
    for (let i = 0; i <= 4; i++) {
      let y = bottom - ((bottom - top) * i) / 4;
      svg += `<line x1="${left}" x2="620" y1="${y}" y2="${y}" stroke="#dce4df"/><text x="43" y="${y + 4}" text-anchor="end">${Math.round(min + ((max - min) * i) / 4)}</text>`;
    }
    series.forEach((k, j) => {
      let points = [];
      data.forEach((row, i) => {
        let value = +row[k] || 0,
          x = left + group * (i + 0.5),
          y = bottom - ((bottom - top) * (value - min)) / (max - min),
          zero = bottom - ((bottom - top) * (0 - min)) / (max - min);
        points.push([x, y]);
        if (d.chartType === "bar") {
          let width = Math.min(70, (group * 0.65) / series.length);
          svg += `<rect data-point="${i},${k}" x="${x + (j - series.length / 2) * width}" y="${Math.min(y, zero)}" width="${width - 6}" height="${Math.abs(zero - y)}" rx="4" fill="${colors[j % 4]}"><title>${esc(row[d.label])} / ${esc(k)}: ${value}</title></rect><text x="${x + (j - series.length / 2 + 0.5) * width - 3}" y="${y - 10}" text-anchor="middle" class="data-value">${value}</text>`;
        } else
          svg += `<circle data-point="${i},${k}" cx="${x}" cy="${y}" r="5" fill="${colors[j % 4]}"><title>${value}</title></circle><text x="${x}" y="${y - 13}" text-anchor="middle">${value}</text>`;
      });
      if (d.chartType === "line")
        svg += `<polyline points="${points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${colors[j % 4]}" stroke-width="3"/>`;
    });
    data.forEach(
      (row, i) =>
        (svg += `<text x="${left + group * (i + 0.5)}" y="265" text-anchor="middle">${esc(row[d.label])}</text>`),
    );
    svg +=
      '</svg><div class="chart-legend">' +
      series
        .map(
          (k, i) =>
            `<span><i style="background:${colors[i % 4]}"></i>${esc(d.cache[0][k] || k)}</span>`,
        )
        .join("") +
      "</div>";
    plot.innerHTML = svg;
    $$("[data-point]", plot).forEach(
      (p) =>
        (p.onclick = () => {
          let [i, k] = p.dataset.point.split(",");
          $(".chart-selected", el).textContent =
            data[i][d.label] + " / " + k + " = " + data[i][k];
          send(s, w, "chart-select", { value: p.dataset.point });
        }),
    );
  };
  el._update();
}
function handle(s, event) {
  let w = s.windows.find((w) => w.id === event.windowId);
  if (!w) return;
  let d = w.data,
    v = event.payload?.value;
  if (["wind", "heading", "fault"].includes(event.type)) {
    d.inputHistory ??= [];
    d.inputHistory.push({
      type: event.type,
      value: v ?? true,
      position: d.position,
      time: s.clock,
    });
  }
  switch (event.type) {
    case "save-record": {
      try {
        s.recordSerial ??= 0;
        let path;
        do {
          path = "/Documents/排演记录-" + ++s.recordSerial + ".flight";
        } while (s.files[path]);
        const text = JSON.stringify(encodeRecord(d));
        const job = E.process(
          s,
          "保存排演记录",
          program([
            { op: "sys", call: "file.write", path: "path", value: "text" },
            { op: "sys", call: "notify", value: '"排演记录已保存："+path' },
            { op: "end" },
          ]),
          "service",
        );
        job.launchVars = { path, text };
      } catch (error) {
        notify(error.message, s);
      }
      break;
    }
    case "play":
      if (d.position >= d.duration) d.position = 0;
      d.state = "playing";
      d.lastClock = s.clock;
      break;
    case "pause":
      d.state = "paused";
      break;
    case "stop":
      d.state = "paused";
      seekPlayer(d, 0);
      break;
    case "step":
      d.state = "paused";
      seekPlayer(d, d.position + 1 / (d.resource.fps || 30));
      break;
    case "seek":
      seekPlayer(d, v);
      break;
    case "rate":
      d.rate = v;
      break;
    case "loop":
      d.loop = v;
      break;
    case "camera":
      d.camera = v;
      break;
    case "orbit":
      d.camera = "自由环绕";
      d.orbit = v;
      break;
    case "distance":
      d.distance = v;
      break;
    case "select":
      d.selection =
        (typeof v === "object" ? v.name : v) +
        " · " +
        ((
          d.flight
            ? d.flight.crashed
            : d.position >= (d.resource.impact?.time ?? Infinity)
        )
          ? "损坏"
          : "完好");
      if (d.flight && v?.ground && v.point) {
        d.flight.target = Math.atan2(
          v.point[2] - d.flight.z,
          v.point[0] - d.flight.x,
        );
        d.inputHistory ??= [];
        d.inputHistory.push({
          type: "heading",
          value: (d.flight.target * 180) / Math.PI,
          position: d.position,
          time: s.clock,
        });
        d.selection +=
          " · 目标航向 " + Math.round((d.flight.target * 180) / Math.PI) + "°";
      }
      break;
    case "load": {
      let fresh = decodePlayer(
        event.payload.resource,
        event.payload.scene,
        s.clock,
      );
      for (let key of Object.keys(d)) delete d[key];
      Object.assign(d, fresh);
      for (const p of s.processes.filter(
        (p) => p.windowId === w.id && p.kind === "controller",
      ))
        E.end(s, p);
      break;
    }
    case "rehearsal": {
      beginRehearsal(d, s.clock);
      let controller = s.processes.find(
        (p) =>
          p.windowId === w.id &&
          p.kind === "controller" &&
          !["ended", "error"].includes(p.state),
      );
      if (!controller)
        E.process(
          s,
          "/Programs/flight-control.nest",
          s.files["/Programs/flight-control.nest"],
          "controller",
          w.id,
        );
      break;
    }
    case "wind":
      if (d.flight) d.flight.wind = v;
      break;
    case "heading":
      if (d.flight) d.flight.target = (v * Math.PI) / 180;
      break;
    case "fault":
      if (d.flight) d.flight.fault = true;
      break;
    case "connect": {
      Object.assign(d, event.payload);
      let sheet = E.root.windows.find((w) => w.id === d.sourceId);
      if (!sheet) {
        d.connectionState = "数据源未打开";
        break;
      }
      try {
        range(d.range);
        d.connectionState = "已连接";
        d.sourceTitle = sheet.data.path;
        d.connectionEpoch = (d.connectionEpoch || 0) + 1;
        d.version = 0;
        d.pending = [];
        (E.state.dataUpdates ??= {})[w.id] = [];
        for (const p of s.processes.filter((p) => p.windowId === w.id))
          p.queue = p.queue.filter(
            (q) => !q.data && !Object.hasOwn(q, "value"),
          );
        publish(sheet);
      } catch (e) {
        d.connectionState = e.message;
      }
      break;
    }
    case "disconnect":
      d.connectionState = "已断开";
      d.connectionEpoch = (d.connectionEpoch || 0) + 1;
      d.pending = [];
      (E.state.dataUpdates ??= {})[w.id] = [];
      break;
    case "chart-type":
      d.chartType = v;
      break;
    case "chart-select":
      d.selection = v;
      break;
  }
}
E.appCost = (s, p, call) => {
  let w = s.windows.find((w) => w.id === p.windowId);
  if (!w) return 0;
  if (call === "flight.advance" && w.data.flight && !w.data.recordPlayback)
    return (
      Math.max(1, Math.ceil((w.data.resource?.nodes?.length || 0) / 16)) *
      Math.min(
        8,
        Math.max(
          1,
          Math.ceil(
            ((w.data.physicsBacklog || 0) + (p.vars.delta || 0) * w.data.rate) *
              30,
          ),
        ),
      )
    );
  if (p.kind === "scene")
    return Math.ceil((w.data.resource?.nodes?.length || 0) / 12);
  if (p.kind === "effects")
    return Math.ceil(
      (w.data.resource?.emitters || []).reduce((n, e) => n + e.count, 0) / 20,
    );
  if (w.appId === "charts")
    return Math.ceil(
      (w.data.cache.length * Math.max(1, w.data.series.split(",").length)) / 8,
    );
  return 0;
};
function advanceFlight(s, w, delta) {
  const d = w.data;
  if (d.recordPlayback && d.record.length) {
    d.flight = sampleRecord(d.record, d.position);
  } else if (d.flight && (delta || d.physicsBacklog) && d.state === "playing") {
    let f = d.flight;
    d.physicsBacklog = (d.physicsBacklog || 0) + delta * d.rate;
    let iterations = Math.min(8, Math.ceil(d.physicsBacklog * 30));
    for (let n = 0; n < iterations; n++) {
      let dt = Math.min(1 / 30, d.physicsBacklog);
      d.physicsBacklog -= dt;
      let simTime = s.clock - d.physicsBacklog / Math.max(0.1, d.rate);
      let control = d.controls?.filter((c) => c.time <= simTime).at(-1) || {
        time: 0,
        value: 9.81,
      };
      if (!f.crashed && !f.landed) {
        let stale = Math.max(0, simTime - control.time - 0.1);
        const history = d.inputHistory || [],
          wind = history
            .filter((h) => h.type === "wind" && h.time <= simTime)
            .at(-1),
          heading = history
            .filter((h) => h.type === "heading" && h.time <= simTime)
            .at(-1),
          fault = history.find((h) => h.type === "fault" && h.time <= simTime);
        f.wind = wind?.value ?? d.initialFlight?.wind ?? 0;
        f.target =
          control.heading ??
          (heading
            ? (heading.value * Math.PI) / 180
            : (d.initialFlight?.target ?? 0));
        f.fault = !!fault || !!d.initialFlight?.fault;
        f.vy +=
          ((f.fault ? 1 : control.value) *
            Math.cos(f.roll) *
            Math.cos(f.pitch) -
            9.81) *
          dt;
        f.y += f.vy * dt;
        f.roll += (f.wind * 0.015 + stale * 0.2 - f.roll * 0.6) * dt;
        f.pitch += (stale * 0.3 - f.pitch * 0.4) * dt;
        f.heading += (f.target - f.heading) * dt;
        f.x += (Math.cos(f.heading) * 1.2 + f.wind * 0.13) * dt;
        f.z += Math.sin(f.heading) * 1.2 * dt;
        const surface = surfaceAt(d.resource, f.x, f.z),
          clearance = d.resource.flight?.clearance ?? 1.1;
        if (surface && f.y < surface.y + clearance - 0.002) {
          f.contact = { nodeId: surface.nodeId, x: f.x, y: surface.y, z: f.z };
          f.y = surface.y + clearance;
          if (
            surface.landing &&
            Math.abs(f.vy) < 1.8 &&
            Math.abs(f.roll) < 0.3 &&
            Math.abs(f.pitch) < 0.3
          ) {
            if (f.vy < -0.1) f.landed = true;
            f.vy = 0;
          } else {
            f.crashed = true;
            f.crashTime = d.position - d.physicsBacklog;
            f.vy = 0;
            f.roll = 1.3;
            f.pitch = 0.9;
            f.fault = true;
          }
        }
      }
      d.record.push({ t: d.position - d.physicsBacklog, flight: copy(f) });
    }
    d.record = d.record.slice(-18000);
  }
}
E.onApp = (s, event) => {
  if (event.type === "notification") {
    notify(event.message, s);
    return;
  }
  if (event.type === "window-present") {
    focused = event.windowId;
    syncPositions();
    return true;
  }
  if (event.type === "service") {
    const p = event.p,
      w = s.windows.find((w) => w.id === p.windowId);
    if (!w) return false;
    const d = w.data;
    switch (event.call) {
      case "app.input": {
        if (
          w.appId === "charts" &&
          d.connectionState === "已连接" &&
          !E.root.windows.some((x) => x.id === d.sourceId)
        ) {
          d.connectionState = "数据源已关闭";
          d.connectionEpoch = (d.connectionEpoch || 0) + 1;
          (E.state.dataUpdates ??= {})[w.id] = [];
        }
        const i = p.queue.findIndex((q) => q.event);
        if (i >= 0) handle(s, p.queue.splice(i, 1)[0].event);
        return true;
      }
      case "flight.advance":
        advanceFlight(s, w, event.value || 0);
        return true;
      case "scene.publish":
        queueSample(s, w);
        return true;
      case "scene.sample":
        finishSample(s, w, p);
        return true;
      case "chart.receive": {
        const queue = (E.state.dataUpdates ??= {})[w.id] ?? d.pending;
        return queue.length ? queue.shift() : false;
      }
      case "chart.submit":
        if (
          (p.vars.packet?.epoch ?? 0) === (d.connectionEpoch || 0) &&
          event.version >= d.version
        ) {
          d.previousCache = copy(d.cache);
          d.transitionStart = s.clock;
          d.cache = copy(event.value);
          d.version = event.version;
        }
        return true;
    }
  }

  if (event.type !== "tick") {
    let p = s.processes.find(
      (p) => p.windowId === event.windowId && p.kind === "app",
    );
    if (p) p.queue.push({ event: copy(event) });
    return;
  }
  let p = event.p,
    w = s.windows.find((w) => w.id === p.windowId);
  if (!w) return;
  let d = w.data;
  if (p.kind === "app") {
    let idx = p.queue.findIndex((q) => q.event);
    if (idx >= 0) {
      let msg = p.queue.splice(idx, 1)[0];
      handle(s, msg.event);
    }
  }
  if (w.appId === "player") {
    if (p.kind === "app") {
      let delta = Math.max(0, s.clock - (d.lastClock ?? s.clock));
      d.lastClock = s.clock;
      if (d.state === "playing") {
        d.position += delta * d.rate;
        if (d.position >= d.duration) {
          if (d.loop) d.position %= d.duration;
          else {
            d.position = d.duration;
            d.state = "paused";
          }
        }
      }
      advanceFlight(s, w, delta);
      queueSample(s, w);
    } else if (["scene", "effects"].includes(p.kind)) finishSample(s, w, p);
  } else if (w.appId === "charts") {
    if (p.kind === "receiver" && d.pending.length) {
      let packet = d.pending.shift();
      let app = s.processes.find(
        (p) => p.windowId === w.id && p.kind === "app",
      );
      app?.queue.push({ data: copy(packet) });
    } else if (p.kind === "app") {
      // Data packets retain FIFO order while a process is suspended.
      let packet = p.queue.find((q) => q.data);
      if (packet) {
        p.queue.splice(p.queue.indexOf(packet), 1);
        if (packet.data.version >= d.version) {
          d.cache = copy(packet.data.rows);
          let multiplier = p.vars.multiplier ?? 1;
          for (let row of d.cache.slice(1))
            for (let k of d.series.split(","))
              if (typeof row[k] === "number") row[k] *= multiplier;
          d.version = packet.data.version;
        }
      }
      if (
        d.connectionState === "已连接" &&
        !E.root.windows.some((w) => w.id === d.sourceId)
      )
        d.connectionState = "数据源已关闭";
    }
  } else if (w.appId === "widgets" && p.kind === "app") {
    let dt = Math.max(0, s.clock - (d.lastClock ?? s.clock));
    d.lastClock = s.clock;
    if (d.running) {
      d.remaining = Math.max(0, d.remaining - dt);
      if (d.remaining <= 0) {
        d.running = false;
        notify("专注倒计时已结束", s);
      }
    }
    if (d.swRunning) d.stopwatch += dt;
  }
};
function rebuildSubtree(id) {
  let ids = E.descendants(id),
    restored = E.systems[id];
  for (let sid of ids) {
    desktops.delete(sid);
    for (let [wid, el] of views)
      if (el.dataset.systemId === sid) {
        el.remove();
        views.delete(wid);
      }
  }
  let parent = E.systems[restored.parentId],
    carrier = parent?.windows.find(
      (w) => w.appId === "system" && w.data.child === id,
    );
  if (carrier) {
    let container = views.get(carrier.id);
    if (container)
      container
        .querySelector(":scope > .window-content")
        .replaceChildren(desktop(restored));
  }
  for (let sys of Object.values(E.systems))
    for (let w of sys.windows)
      if (w.appId === "projection" && ids.includes(w.data.sourceSystemId)) {
        let container = views.get(w.id);
        if (container) {
          let content = container.querySelector(":scope > .window-content");
          content.replaceChildren();
          const source = sourceOf(w);
          if (source.w)
            w.data.frame = copy(
              source.w.presentation || presentationData(source.w.data),
            );
          buildApp(content, sys, w);
          annotate(container, sys, w);
        }
      }
  sync();
}
function rebuildAll() {
  desktops.clear();
  views.clear();
  $("#root").replaceChildren(desktop(E.root));
  sync();
}
rebuildAll();
function updateViews() {
  for (let s of Object.values(E.systems)) {
    for (let p of s.processes) {
      if (p.display && !p.windowId && p.state !== "ended") {
        let pw = makeWindow(s, "program", p.name + " · 程序显示", {
          processId: p.id,
        });
        p.windowId = pw.id;
        pw.pid = p.id;
      }
    }
    let desk = desktops.get(s.id);
    if (desk) {
      $(".system-status", desk).textContent =
        s.state === "running"
          ? "运行中"
          : s.state === "paused"
            ? "已暂停"
            : s.state === "error"
              ? "内核错误"
              : "已停止";
      $(":scope > .taskbar > .tray > .tray-clock", desk).innerHTML =
        `${systemDate(s).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}<small>${systemDate(s).toLocaleDateString("zh-CN")}</small>`;
      desk.classList.toggle("system-frozen", !E.running(s));
      let wm = s.processes.find((p) => p.kind === "wm");
      for (let w of s.windows)
        if (views.has(w.id)) {
          let el = views.get(w.id);

          let content = $(".window-content", el);
          if (w.appId === "projection") {
            let src = sourceOf(w);
            if (!src.w || !src.s || src.s.state === "stopped") {
              content.innerHTML = '<div class="empty">源应用已结束</div>';
              continue;
            }
            content = $(".project-content", content);
          }
          content?._update?.();
          if (tickCount % 30 === 0) content?._refresh?.();
        }
    }
  }
}
setInterval(() => {
  E.tick();
  tickCount++;
  if (tickCount % 2 === 0) updateViews();
}, 1000 / 30);
setInterval(() => window.host.save(E.state), 5000);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape")
    $$(".context-menu,.start-menu,.notification-panel").forEach((x) =>
      x.remove(),
    );
});
document.addEventListener("copy", () => {
  let txt = document.getSelection()?.toString();
  if (txt) {
    E.state.clipboard.unshift(txt);
    E.state.clipboard = E.state.clipboard.slice(0, 20);
  }
});
window.bench = {
  version: 1,
  ready: async () => true,
  reset: async () => {
    let fresh = new Engine(scene);
    E.state = fresh.state;
    rebuildAll();
    await window.host.save(E.state);
    return true;
  },
  inspect: async () => {
    let systems = Object.values(E.systems),
      windows = systems.flatMap((s) => s.windows);
    return {
      systems: systems.map((s) => ({
        id: s.id,
        parentId: s.parentId,
        name: s.name,
        state: s.state,
        clock: s.clock,
      })),
      windows: windows.map(({ id, systemId, appId, title, state }) => ({
        id,
        systemId,
        appId,
        title,
        state,
      })),
      browsers: windows
        .filter((w) => w.appId === "browser")
        .flatMap((w) =>
          (w.data.tabs || []).map((t) => ({
            windowId: w.id,
            tabId: t.id,
            url: t.url,
            loadState: t.loadState,
          })),
        ),
      players: windows
        .filter((w) => w.appId === "player")
        .map((w) => ({
          windowId: w.id,
          systemId: w.systemId,
          ...Object.fromEntries(
            ["state", "position", "duration", "rate", "scene", "frameTime"].map(
              (k) => [k, w.data[k]],
            ),
          ),
        })),
      charts: windows
        .filter((w) => w.appId === "charts")
        .map((w) => ({
          windowId: w.id,
          systemId: w.systemId,
          ...Object.fromEntries(
            ["sourceTitle", "range", "chartType", "connectionState"].map(
              (k) => [k, w.data[k]],
            ),
          ),
        })),
      projections: windows
        .filter((w) => w.appId === "projection")
        .map((w) => ({
          windowId: w.id,
          systemId: w.systemId,
          sourceSystemId: w.data.sourceSystemId,
          sourceWindowId: w.data.sourceWindowId,
          sourceAppId: w.data.sourceAppId,
          state: w.state,
        })),
    };
  },
};

function buildProgram(el, s, w) {
  el.innerHTML =
    '<div class="app-top"><strong>程序显示设备</strong><span class="eyebrow">' +
    esc(s.id) +
    '</span></div><canvas class="program-canvas" style="width:100%;height:100%;flex:1;min-height:0"></canvas>';
  el._update = () => {
    let p = s.processes.find((p) => p.id === w.data.processId),
      d = p?.display;
    if (!d) return;
    let c = $("canvas", el);
    if (d.resource) {
      drawScene(c, copy(d));
      return;
    }
    c.width = c.clientWidth;
    c.height = c.clientHeight;
    let ctx = c.getContext("2d");
    ctx.fillStyle = "#1c342e";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = d.color;
    ctx.font = "24px Segoe UI";
    ctx.fillText(d.text, d.x, d.y);
    for (let shape of Array.isArray(d.shapes) ? d.shapes : []) {
      ctx.fillStyle = shape.color || d.color;
      if (shape.type === "rect")
        ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
      if (shape.type === "circle") {
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (shape.type === "text") ctx.fillText(shape.text, shape.x, shape.y);
    }
  };
  el._update();
}
