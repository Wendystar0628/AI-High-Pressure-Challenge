// 通用 UI 构造工具、可拖拽数字输入框、色彩转换、属性路径枚举与非阻塞对话框

import { clamp } from '../core/math.js';
import { cloneVal } from '../core/property.js';
import { evalProperty } from '../core/expressions.js';

export const LAYER_TYPE_META = {
  shape: { label: '形状', color: '#f59e0b', short: '形' },
  text: { label: '文字', color: '#38bdf8', short: '文' },
  null: { label: '空对象', color: '#94a3b8', short: '空' },
  adjustment: { label: '调整图层', color: '#a78bfa', short: '调' },
  precomp: { label: '预合成', color: '#34d399', short: '合' },
  camera: { label: '摄像机', color: '#60a5fa', short: '机' },
  light: { label: '灯光', color: '#fde047', short: '灯' },
  mesh3d: { label: '三维实体', color: '#fb7185', short: '3D' },
  particle: { label: '粒子系统', color: '#fb923c', short: '粒' },
  audio: { label: '音色', color: '#2dd4bf', short: '音' },
};

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'value' && (tag === 'input' || tag === 'select' || tag === 'textarea')) {
      node.value = v;
    } else if (k === 'checked' && tag === 'input') {
      node.checked = !!v;
    } else {
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export function formatTimeShort(t) {
  return `${Number(t || 0).toFixed(2)}s`;
}

export function formatTimeFull(t, fps = 30) {
  const sec = Math.max(0, Number(t || 0));
  const f = Math.round(sec * fps);
  return `${sec.toFixed(2)}s  [${f} 帧]`;
}

export function rgb01ToHex(c) {
  const r = clamp(Math.round((c?.[0] ?? 1) * 255), 0, 255).toString(16).padStart(2, '0');
  const g = clamp(Math.round((c?.[1] ?? 1) * 255), 0, 255).toString(16).padStart(2, '0');
  const b = clamp(Math.round((c?.[2] ?? 1) * 255), 0, 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function hexToRgb01(hex, alpha = 1) {
  const clean = String(hex || '#ffffff').replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  if (!Number.isFinite(n)) return [1, 1, 1, alpha];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

// AE 风格可左右拖拽调节数字框，同时支持直接键入精确数值
export function createScrubInput({
  value = 0,
  min = -1e6,
  max = 1e6,
  step = 1,
  precision = 2,
  unit = '',
  disabled = false,
  onPreview,
  onCommit,
  onBeginDrag,
}) {
  const wrap = el('span', { className: 'ae-scrub-wrap' });
  const input = el('input', {
    type: 'text',
    className: 'ae-scrub-input',
    value: Number(value || 0).toFixed(precision).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m)),
    disabled,
  });
  wrap.appendChild(input);
  if (unit) wrap.appendChild(el('span', { className: 'ae-scrub-unit', text: unit }));

  let curVal = Number(value) || 0;
  const formatV = (v) => {
    const n = clamp(Number(v) || 0, min, max);
    return Number(n.toFixed(precision)).toString();
  };

  let dragging = false;
  let moved = false;
  let startX = 0;
  let startVal = 0;

  input.addEventListener('pointerdown', (e) => {
    if (disabled || document.activeElement === input) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startVal = curVal;
    input.setPointerCapture(e.pointerId);
  });

  input.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) < 3) return;
    if (!moved) {
      moved = true;
      onBeginDrag?.();
    }
    e.preventDefault();
    const mult = e.shiftKey ? 5 : e.altKey ? 0.1 : 1;
    const next = clamp(startVal + dx * step * 0.5 * mult, min, max);
    curVal = next;
    input.value = formatV(next);
    onPreview?.(next);
  });

  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (moved) {
      moved = false;
      onCommit?.(curVal);
    }
  };
  input.addEventListener('pointerup', finishDrag);
  input.addEventListener('pointercancel', finishDrag);

  input.addEventListener('change', () => {
    const parsed = parseFloat(input.value);
    if (!Number.isFinite(parsed)) {
      input.value = formatV(curVal);
      return;
    }
    const next = clamp(parsed, min, max);
    curVal = next;
    input.value = formatV(next);
    onBeginDrag?.();
    onPreview?.(next);
    onCommit?.(next);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
      const next = clamp(curVal + delta, min, max);
      curVal = next;
      input.value = formatV(next);
      onBeginDrag?.();
      onPreview?.(next);
      onCommit?.(next);
    }
  });

  wrap.setValue = (v) => {
    if (document.activeElement === input || dragging) return;
    curVal = Number(v) || 0;
    input.value = formatV(curVal);
  };
  wrap.inputEl = input;
  return wrap;
}

// 枚举某个图层全部可关键帧/表达式驱动的属性
export function getLayerAnimatableProps(layer) {
  if (!layer) return [];
  const out = [];
  const push = (group, path, label, prop) => {
    if (prop && typeof prop === 'object' && 'type' in prop && 'value' in prop) {
      out.push({ group, path, label: label || prop.label || path, prop });
    }
  };

  const t = layer.transform;
  if (t) {
    push('变换', 'transform.anchorPoint', '锚点', t.anchorPoint);
    push('变换', 'transform.position', '位置', t.position);
    push('变换', 'transform.scale', '缩放(%)', t.scale);
    if (layer.is3D) {
      push('变换', 'transform.rotationX', 'X 旋转(°)', t.rotationX);
      push('变换', 'transform.rotationY', 'Y 旋转(°)', t.rotationY);
      push('变换', 'transform.rotationZ', 'Z 旋转(°)', t.rotationZ);
    } else {
      push('变换', 'transform.rotation', '旋转(°)', t.rotation);
    }
    push('变换', 'transform.opacity', '不透明度(%)', t.opacity);
  }

  if (layer.type === 'shape' && layer.shape) {
    const s = layer.shape;
    if (s.source === 'rect') {
      push('形状', 'shape.rectSize', '矩形尺寸', s.rectSize);
      push('形状', 'shape.rectRoundness', '圆角', s.rectRoundness);
    } else if (s.source === 'ellipse') {
      push('形状', 'shape.ellipseSize', '椭圆尺寸', s.ellipseSize);
    } else if (s.source === 'path') {
      push('形状', 'shape.path', '形状路径', s.path);
    }
    if (s.fill) {
      push('填充/描边', 'shape.fill.color', '填充颜色', s.fill.color);
      push('填充/描边', 'shape.fill.opacity', '填充不透明度', s.fill.opacity);
    }
    if (s.stroke) {
      push('填充/描边', 'shape.stroke.color', '描边颜色', s.stroke.color);
      push('填充/描边', 'shape.stroke.width', '描边宽度', s.stroke.width);
      push('填充/描边', 'shape.stroke.opacity', '描边不透明度', s.stroke.opacity);
    }
    (s.operators || []).forEach((op, oi) => {
      if (!op.params) return;
      for (const [k, p] of Object.entries(op.params)) {
        if (p && typeof p === 'object' && 'type' in p && 'value' in p) {
          push(`操作:${op.name}`, `shape.operators.${oi}.params.${k}`, `${op.name}.${p.label || k}`, p);
        }
      }
    });
    (s.puppetPins || []).forEach((pin, pi) => {
      push('操纵点图钉', `shape.puppetPins.${pi}.pos`, `${pin.name} 位置`, pin.pos);
      push('操纵点图钉', `shape.puppetPins.${pi}.rotation`, `${pin.name} 旋转`, pin.rotation);
      push('操纵点图钉', `shape.puppetPins.${pi}.scale`, `${pin.name} 缩放`, pin.scale);
    });
  } else if (layer.type === 'text' && layer.text) {
    const tx = layer.text;
    push('文字', 'text.fontSize', '字号', tx.fontSize);
    push('文字', 'text.lineHeight', '行距', tx.lineHeight);
    push('文字', 'text.tracking', '字距', tx.tracking);
    push('文字', 'text.fillColor', '文字填充色', tx.fillColor);
    push('文字', 'text.strokeColor', '文字描边色', tx.strokeColor);
    push('文字', 'text.strokeWidth', '文字描边宽', tx.strokeWidth);
    if (tx.animator) {
      const a = tx.animator;
      push('文字动画器', 'text.animator.start', '范围起点(%)', a.start);
      push('文字动画器', 'text.animator.end', '范围终点(%)', a.end);
      push('文字动画器', 'text.animator.offset', '范围偏移(%)', a.offset);
      push('文字动画器', 'text.animator.smoothness', '软边(%)', a.smoothness);
      push('文字动画器', 'text.animator.position', '字符位置偏移', a.position);
      push('文字动画器', 'text.animator.rotation', '字符旋转(°)', a.rotation);
      push('文字动画器', 'text.animator.scale', '字符缩放(%)', a.scale);
      push('文字动画器', 'text.animator.opacity', '字符不透明度(%)', a.opacity);
    }
    (tx.puppetPins || []).forEach((pin, pi) => {
      push('操纵点图钉', `text.puppetPins.${pi}.pos`, `${pin.name} 位置`, pin.pos);
      push('操纵点图钉', `text.puppetPins.${pi}.rotation`, `${pin.name} 旋转`, pin.rotation);
      push('操纵点图钉', `text.puppetPins.${pi}.scale`, `${pin.name} 缩放`, pin.scale);
    });
  } else if (layer.type === 'null' && layer.spatialField) {
    const sf = layer.spatialField;
    push('空间场', 'spatialField.strength', '场强', sf.strength);
    push('空间场', 'spatialField.radius', '影响半径', sf.radius);
    push('空间场', 'spatialField.falloff', '衰减指数', sf.falloff);
    push('空间场', 'spatialField.frequency', '噪声频率', sf.frequency);
    push('空间场', 'spatialField.speed', '变化速度', sf.speed);
    push('空间场', 'spatialField.direction', '方向/轴向', sf.direction);
  } else if (layer.type === 'precomp' && layer.precomp?.timeRemapEnabled) {
    push('时间', 'precomp.timeRemap', '时间重映射(秒)', layer.precomp.timeRemap);
  } else if (layer.type === 'camera' && layer.camera) {
    push('摄像机', 'camera.fov', '视角 FOV(°)', layer.camera.fov);
    push('摄像机', 'camera.target', '目标点', layer.camera.target);
    push('摄像机', 'camera.focusDistance', '对焦距离', layer.camera.focusDistance);
    push('摄像机', 'camera.aperture', '光圈(景深)', layer.camera.aperture);
  } else if (layer.type === 'light' && layer.light) {
    push('灯光', 'light.color', '灯光颜色', layer.light.color);
    push('灯光', 'light.intensity', '灯光强度', layer.light.intensity);
    push('灯光', 'light.target', '方向目标', layer.light.target);
  } else if (layer.type === 'mesh3d' && layer.mesh3d) {
    const m = layer.mesh3d;
    push('三维挤出', 'mesh3d.extrude.depth', '挤出深度', m.extrude?.depth);
    push('三维挤出', 'mesh3d.extrude.bevelSize', '倒角宽度', m.extrude?.bevelSize);
    push('三维挤出', 'mesh3d.extrude.bevelThickness', '倒角深度', m.extrude?.bevelThickness);
    push('三维变形', 'mesh3d.deform.bendAngle', '弯曲角度(°)', m.deform?.bendAngle);
    push('三维变形', 'mesh3d.deform.twistAngle', '扭转角度(°)', m.deform?.twistAngle);
    push('三维变形', 'mesh3d.deform.dentCenter', '局部受力中心', m.deform?.dentCenter);
    push('三维变形', 'mesh3d.deform.dentRadius', '受力半径', m.deform?.dentRadius);
    push('三维变形', 'mesh3d.deform.dentDepth', '局部压痕形变', m.deform?.dentDepth);
    push('PBR 材质', 'mesh3d.material.baseColor', '基础色', m.material?.baseColor);
    push('PBR 材质', 'mesh3d.material.metalness', '金属度', m.material?.metalness);
    push('PBR 材质', 'mesh3d.material.roughness', '粗糙度', m.material?.roughness);
    push('PBR 材质', 'mesh3d.material.emissiveColor', '自发光色', m.material?.emissiveColor);
    push('PBR 材质', 'mesh3d.material.emissiveIntensity', '自发光强度', m.material?.emissiveIntensity);
    push('PBR 材质', 'mesh3d.material.opacity', '材质不透明度', m.material?.opacity);
  } else if (layer.type === 'particle' && layer.particle) {
    const p = layer.particle;
    (p.emitters || []).forEach((em, ei) => {
      const g = `发射器:${em.name}`;
      push(g, `particle.emitters.${ei}.position`, `${em.name}.局部位置`, em.position);
      push(g, `particle.emitters.${ei}.rate`, `${em.name}.速率`, em.rate);
      push(g, `particle.emitters.${ei}.burst`, `${em.name}.爆发脉冲`, em.burst);
      push(g, `particle.emitters.${ei}.speed`, `${em.name}.初速度`, em.speed);
      push(g, `particle.emitters.${ei}.spread`, `${em.name}.扩散角`, em.spread);
      push(g, `particle.emitters.${ei}.life`, `${em.name}.寿命`, em.life);
      push(g, `particle.emitters.${ei}.sizeStart`, `${em.name}.初始大小`, em.sizeStart);
      push(g, `particle.emitters.${ei}.sizeEnd`, `${em.name}.结束大小`, em.sizeEnd);
      push(g, `particle.emitters.${ei}.colorStart`, `${em.name}.初始色`, em.colorStart);
      push(g, `particle.emitters.${ei}.colorMid`, `${em.name}.中期色`, em.colorMid);
      push(g, `particle.emitters.${ei}.colorEnd`, `${em.name}.结束色`, em.colorEnd);
    });
    if (p.physics) {
      push('物理场', 'particle.physics.gravity', '重力', p.physics.gravity);
      push('物理场', 'particle.physics.directionalForce', '方向力', p.physics.directionalForce);
      push('物理场', 'particle.physics.attractPos', '吸引中心', p.physics.attractPos);
      push('物理场', 'particle.physics.attractStrength', '吸引强度', p.physics.attractStrength);
      push('物理场', 'particle.physics.drag', '空气阻力', p.physics.drag);
    }
    if (p.trail) {
      push('拖尾', 'particle.trail.length', '拖尾时长', p.trail.length);
      push('拖尾', 'particle.trail.width', '拖尾宽度', p.trail.width);
      push('拖尾', 'particle.trail.color', '拖尾颜色', p.trail.color);
      push('拖尾', 'particle.trail.fade', '末端消退', p.trail.fade);
    }
  } else if (layer.type === 'audio' && layer.audio) {
    push('音色', 'audio.gain', '音量', layer.audio.gain);
    push('音色', 'audio.pitch', '基频(Hz)', layer.audio.pitch);
    push('音色', 'audio.cutoff', '滤波截止(Hz)', layer.audio.cutoff);
    push('音色', 'audio.trigger', '打击触发脉冲', layer.audio.trigger);
  }

  (layer.masks || []).forEach((msk, mi) => {
    push(`蒙版:${msk.name}`, `masks.${mi}.path`, `${msk.name}.路径`, msk.path);
    push(`蒙版:${msk.name}`, `masks.${mi}.feather`, `${msk.name}.羽化`, msk.feather);
    push(`蒙版:${msk.name}`, `masks.${mi}.opacity`, `${msk.name}.不透明度`, msk.opacity);
  });

  (layer.effects || []).forEach((fx, fi) => {
    if (!fx.params) return;
    for (const [k, p] of Object.entries(fx.params)) {
      if (p && typeof p === 'object' && 'type' in p && 'value' in p) {
        push(`效果:${fx.name}`, `effects.${fi}.params.${k}`, `${fx.name}.${p.label || k}`, p);
      }
    }
  });

  return out;
}

// 将属性值转为标量方便曲线编辑器采样
export function propValueToScalars(val, type) {
  if (typeof val === 'number') return [val];
  if (Array.isArray(val)) return val.map((v) => Number(v) || 0);
  if (val && typeof val === 'object' && Array.isArray(val.contours)) {
    const pts = val.contours[0]?.points || [];
    return [pts.length];
  }
  return [0];
}

// 非阻塞 DOM 模态表单对话框
export function showModalDialog({ title = '确认操作', fields = [], message = '', confirmText = '确定', cancelText = '取消', onConfirm }) {
  const overlay = el('div', { className: 'ae-modal-overlay' });
  const card = el('div', { className: 'ae-modal-card' });
  card.appendChild(el('div', { className: 'ae-modal-title', text: title }));
  if (message) card.appendChild(el('div', { className: 'ae-modal-msg', text: message }));

  const inputs = {};
  const form = el('div', { className: 'ae-modal-form' });
  for (const f of fields) {
    const row = el('label', { className: 'ae-modal-row' });
    row.appendChild(el('span', { className: 'ae-modal-label', text: f.label }));
    let inp;
    if (f.type === 'select') {
      inp = el('select', { className: 'ae-input' }, (f.options || []).map((o) =>
        el('option', { value: o.value, text: o.label, selected: o.value === f.value })
      ));
    } else if (f.type === 'checkbox') {
      inp = el('input', { type: 'checkbox', checked: !!f.value });
    } else {
      inp = el('input', {
        type: f.type || 'text',
        className: 'ae-input',
        value: f.value ?? '',
        min: f.min,
        max: f.max,
        step: f.step,
      });
    }
    inputs[f.name] = { el: inp, type: f.type || 'text' };
    row.appendChild(inp);
    form.appendChild(row);
  }
  if (fields.length) card.appendChild(form);

  const close = () => overlay.remove();
  const submit = () => {
    const vals = {};
    for (const [k, info] of Object.entries(inputs)) {
      if (info.type === 'checkbox') vals[k] = info.el.checked;
      else if (info.type === 'number') vals[k] = Number(info.el.value);
      else vals[k] = info.el.value;
    }
    close();
    onConfirm?.(vals);
  };

  const footer = el('div', { className: 'ae-modal-footer' }, [
    el('button', { className: 'ae-btn', text: cancelText, onClick: close }),
    el('button', { className: 'ae-btn primary', text: confirmText, onClick: submit }),
  ]);
  card.appendChild(footer);
  overlay.appendChild(card);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      submit();
    }
  });
  document.body.appendChild(overlay);
  const firstInp = Object.values(inputs)[0]?.el;
  if (firstInp && firstInp.focus) {
    setTimeout(() => {
      firstInp.focus();
      firstInp.select?.();
    }, 10);
  }
}

export function showToast(msg, kind = 'info') {
  let host = document.getElementById('ae-toast-host');
  if (!host) {
    host = el('div', { id: 'ae-toast-host', className: 'ae-toast-host' });
    document.body.appendChild(host);
  }
  const item = el('div', { className: `ae-toast ${kind}`, text: msg });
  host.appendChild(item);
  setTimeout(() => {
    item.classList.add('fade');
    setTimeout(() => item.remove(), 350);
  }, 2400);
}

export function getCompAtPropEval(project, comp, layer, propPath, time) {
  try {
    return cloneVal(evalProperty(project, comp, layer, propPath, time));
  } catch {
    return null;
  }
}
