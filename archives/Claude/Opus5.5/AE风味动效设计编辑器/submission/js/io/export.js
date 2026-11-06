// 工程存取、音频导入、工作区导出（WebM 视频带音轨 / PNG 序列 ZIP）、逐帧接口 window.videoExport
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, E = AE.Eval, Mdl = AE.Model, W = AE.W, GL = AE.GL, R = AE.R;
  const IO = AE.IO = {};
  const App = () => AE.App;
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); };
  IO.download = download;

  // ---------- 工程 ----------
  IO.save = () => { const s = Mdl.serialize(App().proj); download(new Blob([s], { type: 'application/json' }), (App().proj.name || '工程') + '.motion.json'); App().status('已保存工程（' + (s.length / 1024).toFixed(0) + ' KB）：图层、节点、轮廓、绑定、材质、引用、音频与模拟设置'); };
  IO.load = async (text) => {
    const p = Mdl.deserialize(text);
    if (!p.comps || !p.comps.length) throw new Error('不是有效的工程文件');
    const A = App(); A.play(false);
    A.proj = p; E.bump(); E.index(p);
    A.stack = [{ comp: p.mainComp || p.comps[0].id }]; A.time = 0; A.sel.layers = []; A.sel.keys.clear();
    A.resetHistory(); AE.Viewer.fit(); A.mark();
    for (const a of p.assets) if (a.type === 'audio') { try { await AE.Audio.decodeAsset(a); } catch (e) { } }
  };
  IO.open = () => {
    const inp = document.getElementById('fileOpen');
    inp.onchange = async () => { const f = inp.files[0]; inp.value = ''; if (!f) return; try { await IO.load(await f.text()); App().status('已打开：' + f.name); } catch (e) { W.toast('打开失败：' + e.message, true); } };
    inp.click();
  };
  IO.restoreAutosave = async () => { const s = localStorage.getItem('motion-autosave'); if (!s) { W.toast('没有自动保存的工程'); return; } await IO.load(s); App().status('已恢复自动保存'); };
  IO.importAudio = (layer) => {
    const inp = document.getElementById('audioOpen');
    inp.onchange = async () => {
      const f = inp.files[0]; inp.value = ''; if (!f) return;
      const buf = new Uint8Array(await f.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      const asset = { id: Mdl.newId('as'), type: 'audio', name: f.name, data: btoa(s) };
      try { await AE.Audio.decodeAsset(asset); } catch (e) { W.toast('无法解码音频：' + e.message, true); return; }
      App().edit('导入音频', () => {
        App().proj.assets.push(asset);
        if (layer) layer.audio.asset = asset.id;
        else { const l = Mdl.newAudio(App().comp(), asset.id, f.name); l.outPoint = Math.min(App().comp().duration, asset.duration); App().comp().layers.unshift(l); App().sel.layers = [l.id]; }
      });
    };
    inp.click();
  };

  // ---------- 渲染一帧到 RGBA8 像素 ----------
  IO.renderPixels = (comp, t, ctx, w, h) => {
    const gl = GL.gl;
    const space = R.space([0, 0, comp.width, comp.height], w, h);
    const fr = R.renderFrame(comp, t, space, { ctx, bg: true });
    const t8 = GL.target(w, h, 'c8');
    // 合成到黑底并翻转（视频无透明）
    GL.bind(t8); GL.clear(0, 0, 0, 1);
    GL.use(flipProg(), { uTex: fr }); GL.drawQuad();
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t8.fbo); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    GL.release(fr); GL.release(t8);
    return px;
  };
  let fp = null;
  const flipProg = () => fp || (fp = GL.prog('flip', `layout(location=0) in vec2 aPos; out vec2 vUV; void main(){ vUV=vec2(aPos.x,1.0-aPos.y); gl_Position=vec4(aPos*2.0-1.0,0.0,1.0); }`, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; void main(){ vec4 c=texture(uTex,vUV); o=vec4(clamp(c.rgb + vec3(0.0)*(1.0-c.a),0.0,1.0),1.0); }`));

  // ---------- WebM 封装（EBML） ----------
  const enc = new TextEncoder();
  function vint(n) { // 尺寸编码（8 字节）
    const b = new Uint8Array(8); b[0] = 0x01; let v = n; for (let i = 7; i >= 1; i--) { b[i] = v % 256; v = Math.floor(v / 256); } return b;
  }
  function idBytes(id) { const a = []; let v = id; while (v > 0) { a.unshift(v & 255); v = Math.floor(v / 256); } return new Uint8Array(a); }
  function uintBytes(v) { const a = []; do { a.unshift(v % 256); v = Math.floor(v / 256); } while (v > 0); return new Uint8Array(a); }
  function f64(v) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b; }
  function cat(parts) { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }
  const elm = (id, data) => cat([idBytes(id), vint(data.length), data]);
  const elU = (id, v) => elm(id, uintBytes(v)), elS = (id, s) => elm(id, enc.encode(s)), elF = (id, v) => elm(id, f64(v));
  function muxWebM(o) {
    const tracks = [elm(0xAE, cat([elU(0xD7, 1), elU(0x73C5, 1), elS(0x86, o.vcodec), elU(0x83, 1), elm(0xE0, cat([elU(0xB0, o.w), elU(0xBA, o.h)]))]))];
    if (o.audio) {
      const head = new Uint8Array(19); head.set(enc.encode('OpusHead')); head[8] = 1; head[9] = 2; new DataView(head.buffer).setUint16(10, 312, true); new DataView(head.buffer).setUint32(12, 48000, true);
      tracks.push(elm(0xAE, cat([elU(0xD7, 2), elU(0x73C5, 2), elS(0x86, 'A_OPUS'), elU(0x83, 2), elU(0x56AA, 6500000), elU(0x56BB, 80000000), elm(0x63A2, o.audio.desc || head), elm(0xE1, cat([elF(0xB5, 48000), elU(0x9F, 2)]))])));
    }
    const header = elm(0x1A45DFA3, cat([elU(0x4286, 1), elU(0x42F7, 1), elU(0x42F2, 4), elU(0x42F3, 8), elS(0x4282, 'webm'), elU(0x4287, 4), elU(0x4285, 2)]));
    const info = elm(0x1549A966, cat([elU(0x2AD7B1, 1000000), elS(0x4D80, 'liuxing-motion'), elS(0x5741, 'liuxing-motion'), elF(0x4489, o.durationMs)]));
    // 按时间交错 → 每秒一簇
    const blocks = o.video.map(c => ({ tr: 1, ts: c.ts / 1000, key: c.key, data: c.data }));
    if (o.audio) for (const c of o.audio.chunks) blocks.push({ tr: 2, ts: c.ts / 1000, key: true, data: c.data });
    blocks.sort((a, b) => a.ts - b.ts || a.tr - b.tr);
    const clusters = []; let cur = null, base = 0;
    for (const b of blocks) {
      const tsm = Math.round(b.ts);
      if (!cur || tsm - base > 30000 || (b.tr === 1 && b.key && tsm - base >= 1000)) { if (cur) clusters.push(elm(0x1F43B675, cat(cur))); cur = [elU(0xE7, tsm)]; base = tsm; }
      const hdr = new Uint8Array(4); hdr[0] = 0x80 | b.tr; new DataView(hdr.buffer).setInt16(1, tsm - base); hdr[3] = b.key ? 0x80 : 0;
      cur.push(elm(0xA3, cat([hdr, b.data])));
    }
    if (cur) clusters.push(elm(0x1F43B675, cat(cur)));
    const segment = elm(0x18538067, cat([info, elm(0x1654AE6B, cat(tracks)), ...clusters]));
    return new Blob([header, segment], { type: 'video/webm' });
  }
  // ---------- ZIP（存储） ----------
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (d) => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = crcT[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const parts = [], central = []; let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint32(14, crc, true); lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, f.data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint32(16, crc, true); ch.setUint32(20, f.data.length, true); ch.setUint32(24, f.data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + f.data.length;
    }
    const cs = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  // ---------- 工作区导出 ----------
  IO.exportDialog = () => {
    const A = App(), comp = A.rootComp();
    const st = { fmt: 'webm', fps: comp.fps, from: comp.workArea[0], to: comp.workArea[1], scale: 1 };
    const fpsSel = W.select({ [comp.fps]: comp.fps + '（合成帧率）', 24: '24', 30: '30', 60: '60' }, comp.fps, v => { st.fps = +v; info(); });
    const fmtSel = W.select({ webm: '视频 WebM（VP9/VP8 + Opus 音轨）', png: 'PNG 图像序列（ZIP）' }, 'webm', v => { st.fmt = v; info(); });
    const sz = el => el;
    const infoEl = W.el('div', { class: 'small' });
    const info = () => { const n = Math.round((st.to - st.from) * st.fps); infoEl.textContent = `范围 ${st.from.toFixed(2)}s → ${st.to.toFixed(2)}s（工作区），${n} 帧 @ ${st.fps}fps，尺寸 ${comp.width}×${comp.height}（与合成相同）。按工程时间逐帧取样，与同刻预览一致，不受画布缩放、窗口或负载影响。`; };
    info();
    const prog = W.el('div', { class: 'progress' }, W.el('div')); const msg = W.el('div', { class: 'small' });
    const body = W.el('div', {}, W.el('div', { class: 'row' }, W.el('label', { text: '合成' }), W.el('span', { text: comp.name })), W.el('div', { class: 'row' }, W.el('label', { text: '格式' }), fmtSel), W.el('div', { class: 'row' }, W.el('label', { text: '帧率' }), fpsSel), infoEl, prog, msg);
    let cancel = false, running = false;
    const d = W.dialog('导出工作区', body, [{ label: '取消', fn: () => { if (running) { cancel = true; return false; } } }, { label: '开始导出', pri: true, fn: () => { if (running) return false; running = true; run(); return false; } }]);
    const run = async () => {
      try {
        const res = await IO.exportRange(comp, st, (p, m) => { prog.firstChild.style.width = (p * 100).toFixed(1) + '%'; msg.textContent = m; }, () => cancel);
        if (res) { download(res.blob, comp.name + (st.fmt === 'webm' ? '.webm' : '_png序列.zip')); msg.textContent = '完成：' + (res.blob.size / 1048576).toFixed(1) + ' MB'; }
        else msg.textContent = '已取消';
      } catch (e) { console.error(e); msg.textContent = '导出失败：' + e.message; }
      running = false;
    };
  };
  IO.exportRange = async (comp, st, onProg, isCancelled) => {
    const A = App();
    A.play(false); A.exporting = true;
    const w = comp.width, h = comp.height, n = Math.max(1, Math.round((st.to - st.from) * st.fps));
    const ctx = E.root(comp);
    try {
      if (st.fmt === 'png') {
        const files = []; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c2 = cv.getContext('2d');
        for (let i = 0; i < n; i++) {
          if (isCancelled()) return null;
          const t = st.from + i / st.fps;
          const px = IO.renderPixels(comp, t, ctx, w, h);
          c2.putImageData(new ImageData(new Uint8ClampedArray(px.buffer), w, h), 0, 0);
          const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
          files.push({ name: 'frame_' + String(i).padStart(5, '0') + '.png', data: new Uint8Array(await blob.arrayBuffer()) });
          onProg((i + 1) / n, `第 ${i + 1}/${n} 帧（${t.toFixed(3)}s）`);
          await new Promise(r => setTimeout(r, 0));
        }
        return { blob: zip(files) };
      }
      if (!window.VideoEncoder) throw new Error('浏览器不支持 WebCodecs 视频编码');
      let vcodec = 'vp09.00.40.08', mk = 'V_VP9';
      const cfg = { codec: vcodec, width: w, height: h, bitrate: 14e6, framerate: st.fps };
      if (!(await VideoEncoder.isConfigSupported(cfg)).supported) { cfg.codec = vcodec = 'vp8'; mk = 'V_VP8'; }
      const video = [];
      let encErr = null;
      const ve = new VideoEncoder({ output: (chunk) => { const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); video.push({ ts: chunk.timestamp, key: chunk.type === 'key', data: d }); }, error: (e) => { encErr = e; } });
      ve.configure(cfg);
      // 音轨（离线渲染，同一工程时间）
      onProg(0, '渲染音轨…');
      let audio = null;
      try {
        const ab = await AE.Audio.renderOffline(A.proj, comp, st.from, st.to);
        if (window.AudioEncoder) {
          const chunks = []; let desc = null;
          const ae = new AudioEncoder({ output: (c, meta) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); chunks.push({ ts: c.timestamp, data: d }); if (meta && meta.decoderConfig && meta.decoderConfig.description && !desc) desc = new Uint8Array(meta.decoderConfig.description); }, error: e => console.warn(e) });
          ae.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 });
          const L = ab.getChannelData(0), Rr = ab.numberOfChannels > 1 ? ab.getChannelData(1) : L, F = 960;
          for (let i = 0; i < ab.length; i += F) {
            const m = Math.min(F, ab.length - i), buf = new Float32Array(m * 2); buf.set(L.subarray(i, i + m), 0); buf.set(Rr.subarray(i, i + m), m);
            ae.encode(new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: m, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data: buf }));
          }
          await ae.flush(); ae.close();
          audio = { chunks, desc };
        }
      } catch (e) { console.warn('音轨失败', e); }
      for (let i = 0; i < n; i++) {
        if (isCancelled()) { ve.close(); return null; }
        if (encErr) throw encErr;
        const t = st.from + i / st.fps;
        const px = IO.renderPixels(comp, t, ctx, w, h);
        const vf = new VideoFrame(px, { format: 'RGBA', codedWidth: w, codedHeight: h, timestamp: Math.round(i / st.fps * 1e6), duration: Math.round(1e6 / st.fps) });
        ve.encode(vf, { keyFrame: i % Math.round(st.fps * 2) === 0 }); vf.close();
        while (ve.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 2));
        onProg((i + 1) / n, `第 ${i + 1}/${n} 帧（${t.toFixed(3)}s）`);
        if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
      }
      await ve.flush(); ve.close();
      onProg(1, '封装 WebM…');
      return { blob: muxWebM({ vcodec: mk, w, h, video, audio, durationMs: n / st.fps * 1000 }) };
    } finally { A.exporting = false; A.mark(); }
  };

  // ---------- 逐帧接口 ----------
  let ve = { fps: 30, active: false };
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  window.videoExport = {
    runs: ['demo'],
    async begin(runId, opts = {}) {
      const A = App();
      while (!window.__ready) await new Promise(r => setTimeout(r, 50));
      if (runId !== 'demo') throw new Error('未知的 run：' + runId);
      A.play(false);
      ve = { fps: opts.fps || 60, active: true };
      // 回到这一段的起始状态：重新载入示例工程
      AE.UI.loadDemo();
      A.exporting = true;
      A.setWorkspace('anim');
      AE.Timeline.fitTime();
      A.time = 0;
      // 界面状态：选中主摄像机，时间轴展开其动画属性，属性面板随播放同步
      const comp0 = A.rootComp(), cam = comp0.layers.find(l => l.type === 'camera');
      if (cam) { A.sel.layers = [cam.id]; AE.Timeline.open.add(cam.id); AE.Timeline.open.add(cam.id + ':transform'); AE.Timeline.open.add(cam.id + ':camera'); AE.Timeline.sy = Math.max(0, comp0.layers.indexOf(cam) * 22 - 22); }
      AE.Viewer.show.paths = false;
      // 预热：字体、着色器、粒子缓存
      A.drawPanels(); await raf();
      const comp = A.rootComp();
      return { frames: Math.round(comp.duration * ve.fps) };
    },
    async frame(i) {
      const A = App();
      A.exporting = true;
      const comp = A.rootComp();
      A.time = Math.min(comp.duration, i / ve.fps);
      A.sel.keys.clear();
      A.mark();
      A.drawPanels();
      GL.gl.finish();
      await raf();
      return true;
    },
    end() { const A = App(); ve.active = false; A.exporting = false; AE.Viewer.show.paths = true; A.mark(); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
