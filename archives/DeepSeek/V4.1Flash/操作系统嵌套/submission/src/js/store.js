// 运行时单例与变更广播
export const rt = {
  model: null,
  ui: null,
  host: null,      // Electron preload API
  info: null,
  ready: false,
  revision: 0,
  dirty: false,
  saving: false,
  saveTimer: null,
  bootAt: Date.now(),
  toasts: 0,
  serialize: null  // main 注入
};

const bus = new EventTarget();

export function on(evt, cb) {
  const h = (e) => cb(e.detail);
  bus.addEventListener(evt, h);
  return () => bus.removeEventListener(evt, h);
}

export function emit(evt, detail) { bus.dispatchEvent(new CustomEvent(evt, { detail })); }

export function changed(reason = 'update') {
  rt.revision++;
  rt.dirty = true;
  emit('model', { reason, revision: rt.revision });
  scheduleSave();
}

export function scheduleSave() {
  if (!rt.host || !rt.serialize) return;
  if (rt.saveTimer) clearTimeout(rt.saveTimer);
  rt.saveTimer = setTimeout(() => { saveNow(); }, 1200);
}

export async function saveNow(force = false) {
  if (!rt.host || !rt.serialize) return false;
  if (rt.saving) return false;
  rt.saving = true;
  try {
    const json = rt.serialize(rt.model);
    const r = await rt.host.saveState(json);
    if (r && r.ok) { rt.dirty = false; emit('saved', r); }
    return !!(r && r.ok);
  } catch (e) {
    console.warn('保存失败', e);
    return false;
  } finally { rt.saving = false; }
}

export function markDirty() { rt.dirty = true; }
