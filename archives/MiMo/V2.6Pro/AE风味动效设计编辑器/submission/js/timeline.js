/* timeline.js — 时间轴：图层条、关键帧、播放头、缩放、吸附 */
(function(global) {
'use strict';

const TL = {};
const $ = id => document.getElementById(id);

let pxPerSec = 80;
let snapEnabled = true;

TL.render = function() {
  const S = UI.S;
  const comp = S.comp;
  if (!comp) return;
  renderLayerList(comp);
  renderTracks(comp);
  TL.updatePlayhead();
};

function renderLayerList(comp) {
  const el = $('tl-layers');
  if (!el) return;
  el.innerHTML = '';
  comp.layers.forEach((layer, i) => {
    const div = document.createElement('div');
    div.className = 'tl-layer' + (S_selected(layer) ? ' selected' : '');
    div.innerHTML = `
      <span class="vis" title="显示/隐藏">${layer.visible ? '👁' : '—'}</span>
      <span class="lock ${layer.locked ? 'on' : ''}" title="锁定">${layer.locked ? '🔒' : '🔓'}</span>
      <span class="type-ico" title="${Model.typeName(layer.type)}">${Model.typeIcon(layer.type)}</span>
      <span class="color-bar" style="background:${layer.color}"></span>
      <span class="name">${UI.esc(layer.name)}</span>`;
    div.onclick = (e) => {
      if (e.target.classList.contains('vis')) {
        UI.pushUndo('切换显示');
        layer.visible = !layer.visible;
        UI.renderViewer();
        renderLayerList(comp);
        return;
      }
      if (e.target.classList.contains('lock')) {
        UI.pushUndo('切换锁定');
        layer.locked = !layer.locked;
        renderLayerList(comp);
        return;
      }
      if (e.shiftKey) {
        const idx = UI.S.selected.indexOf(layer.id);
        if (idx >= 0) UI.S.selected.splice(idx, 1);
        else UI.S.selected.push(layer.id);
      } else {
        UI.S.selected = [layer.id];
      }
      UI.S.selectedProps = [{ layerId: layer.id, propPath: 'transform.position' }];
      UI.refreshAll();
    };
    div.oncontextmenu = (e) => {
      e.preventDefault();
      if (confirm('删除图层「' + layer.name + '」？')) {
        UI.pushUndo('删除图层');
        Model.removeLayer(comp, layer.id);
        UI.refreshAll();
      }
    };
    el.appendChild(div);
  });
}

function S_selected(layer) {
  return UI.S.selected.includes(layer.id);
}

function renderTracks(comp) {
  const S = UI.S;
  const wrap = $('tl-tracks-wrap');
  const ruler = $('tl-ruler');
  const tracks = $('tl-tracks');
  if (!wrap || !tracks) return;

  const totalW = Math.max(wrap.clientWidth, comp.duration * pxPerSec + 100);
  // 标尺
  const rctx = getCanvasCtx(ruler, totalW, 22);
  rctx.clearRect(0, 0, totalW, 22);
  rctx.fillStyle = '#2a2a30';
  rctx.fillRect(0, 0, totalW, 22);
  rctx.strokeStyle = '#444';
  rctx.fillStyle = '#889';
  rctx.font = '10px sans-serif';
  for (let s = 0; s <= comp.duration; s++) {
    const x = s * pxPerSec;
    rctx.beginPath(); rctx.moveTo(x, 12); rctx.lineTo(x, 22); rctx.stroke();
    rctx.fillText(s + 's', x + 2, 10);
    // 帧刻度
    for (let f = 1; f < comp.fps; f += Math.max(1, Math.floor(comp.fps / 10))) {
      const fx = x + f / comp.fps * pxPerSec;
      if (fx > totalW) break;
      rctx.beginPath(); rctx.moveTo(fx, 17); rctx.lineTo(fx, 22); rctx.stroke();
    }
  }
  // 工作区
  rctx.fillStyle = 'rgba(80,140,220,0.18)';
  rctx.fillRect(comp.workArea[0] * pxPerSec, 0, (comp.workArea[1] - comp.workArea[0]) * pxPerSec, 22);

  // 轨道
  tracks.style.width = totalW + 'px';
  tracks.innerHTML = '';
  comp.layers.forEach(layer => {
    const row = document.createElement('div');
    row.className = 'tl-track';
    row.dataset.layer = layer.id;
    // 层条
    const bar = document.createElement('div');
    bar.className = 'tl-bar' + (S_selected(layer) ? ' selected' : '');
    bar.style.left = (layer.inPoint * pxPerSec) + 'px';
    bar.style.width = Math.max(4, (layer.outPoint - layer.inPoint) * pxPerSec) + 'px';
    bar.style.background = layer.color;
    bar.title = layer.name;
    row.appendChild(bar);

    // 关键帧
    appendKeyframes(row, layer);

    // 拖动层条
    bar.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const sx = e.clientX, origIn = layer.inPoint, origOut = layer.outPoint;
      const move = (ev) => {
        const dt = (ev.clientX - sx) / pxPerSec;
        layer.inPoint = Math.max(0, origIn + dt);
        layer.outPoint = Math.max(layer.inPoint + 0.05, origOut + dt);
        bar.style.left = (layer.inPoint * pxPerSec) + 'px';
        bar.style.width = ((layer.outPoint - layer.inPoint) * pxPerSec) + 'px';
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        UI.pushUndo('移动层条');
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });

    row.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('tl-kf')) return;
      // 点击轨道 = 擦洗
      const rect = tracks.getBoundingClientRect();
      let t = (e.clientX - rect.left) / pxPerSec;
      if (snapEnabled) t = snapTime(t, comp);
      UI.setTime(t);
    });

    tracks.appendChild(row);
  });

  // 轨道区拖动擦洗
  tracks.onmousedown = (e) => {
    if (e.target.classList.contains('tl-kf')) return;
    const rect = tracks.getBoundingClientRect();
    const seek = (ev) => {
      let t = (ev.clientX - rect.left) / pxPerSec;
      if (snapEnabled) t = snapTime(t, comp);
      UI.setTime(t);
    };
    seek(e);
    const up = () => {
      window.removeEventListener('mousemove', seek);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', seek);
    window.addEventListener('mouseup', up);
  };
}

function appendKeyframes(row, layer) {
  const props = [
    ['transform.position', '位置'],
    ['transform.rotation', '旋转'],
    ['transform.scale', '缩放'],
    ['transform.opacity', '不透明度'],
    ['transform.anchor', '锚点']
  ];
  props.forEach(([path, label]) => {
    const anim = Engine.getAnim(layer, path);
    if (!anim || !anim.kfs.length) return;
    anim.kfs.forEach(kf => {
      const el = document.createElement('div');
      el.className = 'tl-kf' + (kf.hold ? ' hold' : ' bezier');
      const sel = UI.S.selectedKfs.some(s => s.layerId === layer.id && s.propPath === path && Math.abs(s.time - kf.t) < 1e-4);
      if (sel) el.classList.add('selected');
      el.style.left = (kf.t * pxPerSec) + 'px';
      el.title = `${label} @ ${kf.t.toFixed(3)}s`;
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        UI.S.selectedKfs = [{ layerId: layer.id, propPath: path, time: kf.t }];
        UI.S.selectedProps = [{ layerId: layer.id, propPath: path }];
        // 拖动关键帧
        const sx = e.clientX, origT = kf.t;
        const move = (ev) => {
          let nt = origT + (ev.clientX - sx) / pxPerSec;
          if (snapEnabled) nt = snapTime(nt, UI.S.comp);
          kf.t = U.clamp(nt, 0, UI.S.comp.duration);
          el.style.left = (kf.t * pxPerSec) + 'px';
          Engine.invalidate(layer.id);
          UI.setTime(kf.t, true);
          UI.renderViewer();
          Curves.render();
        };
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
          UI.pushUndo('移动关键帧');
          anim.kfs.sort((a, b) => a.t - b.t);
          Timeline.render();
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        Timeline.render();
        UI.renderProperties();
      });
      row.appendChild(el);
    });
  });
}

function snapTime(t, comp) {
  if (!snapEnabled) return t;
  const frame = Math.round(t * comp.fps);
  let nt = frame / comp.fps;
  // 吸附到关键帧
  comp.layers.forEach(l => {
    ['transform.position', 'transform.rotation', 'transform.opacity', 'transform.scale'].forEach(p => {
      const anim = Engine.getAnim(l, p);
      if (!anim) return;
      anim.kfs.forEach(kf => {
        if (Math.abs(kf.t - nt) < 0.08) nt = kf.t;
      });
    });
    if (Math.abs(l.inPoint - nt) < 0.08) nt = l.inPoint;
    if (Math.abs(l.outPoint - nt) < 0.08) nt = l.outPoint;
  });
  return nt;
}

function getCanvasCtx(el, w, h) {
  if (el.tagName === 'CANVAS') {
    el.width = w; el.height = h;
    return el.getContext('2d');
  }
  // div → 替换为 canvas
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.style.width = '100%';
  cv.style.height = h + 'px';
  cv.style.display = 'block';
  el.innerHTML = '';
  el.appendChild(cv);
  return cv.getContext('2d');
}

TL.updatePlayhead = function() {
  const S = UI.S;
  const ph = $('tl-playhead');
  const tracks = $('tl-tracks');
  if (!ph || !tracks) return;
  ph.style.left = (S.time * pxPerSec) + 'px';
  // 保证可见
  const wrap = $('tl-tracks-wrap');
  if (wrap) {
    const x = S.time * pxPerSec;
    if (x < wrap.scrollLeft || x > wrap.scrollLeft + wrap.clientWidth - 40) {
      wrap.scrollLeft = Math.max(0, x - wrap.clientWidth * 0.3);
    }
  }
};

TL.refreshKeyframeHighlight = function() {
  // 轻量：仅在需要时由 render 处理
};

TL.setZoom = function(v) {
  pxPerSec = U.clamp(v, 8, 400);
  TL.render();
};

TL.toggleSnap = function() {
  snapEnabled = !snapEnabled;
  const b = $('btn-snap');
  if (b) b.classList.toggle('active', snapEnabled);
  return snapEnabled;
};

TL.addKeyframe = function() {
  const S = UI.S;
  const layer = UI.selectedLayer();
  if (!layer) return;
  UI.pushUndo('添加关键帧');
  const paths = S.selectedProps.length ? S.selectedProps.map(p => p.propPath) : ['transform.position'];
  paths.forEach(p => {
    const anim = Engine.getAnim(layer, p);
    if (anim) Interp.setKeyframe(anim, S.time, Interp.evaluateKfs(anim, S.time));
  });
  Engine.invalidate(layer.id);
  UI.refreshAll();
};

TL.deleteKeyframe = function() {
  const S = UI.S;
  UI.pushUndo('删除关键帧');
  let n = 0;
  S.selectedKfs.forEach(sk => {
    const found = Model.findLayerDeep(S.project, sk.layerId);
    if (!found) return;
    const anim = Engine.getAnim(found.layer, sk.propPath);
    if (anim && Interp.removeKeyframe(anim, sk.time)) n++;
    Engine.invalidate(sk.layerId);
  });
  // 或删除当前时间
  if (!n) {
    const layer = UI.selectedLayer();
    if (layer) {
      (S.selectedProps.length ? S.selectedProps : [{ propPath: 'transform.position' }]).forEach(p => {
        const anim = Engine.getAnim(layer, p.propPath);
        if (anim && Interp.removeKeyframe(anim, S.time)) n++;
      });
    }
  }
  S.selectedKfs = [];
  UI.refreshAll();
  toast('删除了 ' + n + ' 个关键帧');
};

TL.f9 = function() {
  const S = UI.S;
  const layer = UI.selectedLayer();
  if (!layer) return;
  UI.pushUndo('缓入缓出');
  const paths = S.selectedProps.length ? S.selectedProps.map(p => p.propPath) : ['transform.position'];
  paths.forEach(p => {
    const anim = Engine.getAnim(layer, p);
    if (anim) Interp.easeEasy(anim);
  });
  UI.refreshAll();
  toast('已应用 F9 缓入缓出');
};

TL.applyEase = function() {
  TL.f9();
};

TL.getPxPerSec = () => pxPerSec;

global.Timeline = TL;
})(window);
