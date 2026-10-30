// 声音探针：三道网页题共用，用法见同目录 README.md。
// 载入：chrome-devtools-mcp 的 evaluate_script，sourcePath 指向本文件（文件要在 MCP 允许读取的目录里，如 %TEMP%）。
// 整个文件是一个函数，载入即安装并返回 info()；重复载入不会重复安装。
// 只旁听，不改变作品的声音：接到扬声器（AudioContext.destination）的节点另接一路到静音的录音节点；
// <audio>/<video> 用 captureStream 旁听，并按元素自己的音量和静音换算。
// 打开作品时先用 navigate_page 的 initScript 注入下面这一行，载入探针之前已接到扬声器的节点也能录到：
// window.__sndEarly={n:[],c:AudioNode.prototype.connect};AudioNode.prototype.connect=function(d){if(d instanceof AudioDestinationNode)__sndEarly.n.push(this);return __sndEarly.c.apply(this,arguments)}
() => {
  const W = window;
  if (W.__snd) return W.__snd.info();
  const AC = W.AudioContext || W.webkitAudioContext;
  if (!AC) return { error: '页面没有 Web Audio' };
  const VERSION = '1.0';
  const E = W.__sndEarly;
  const AN = AudioNode.prototype;
  const curConnect = AN.connect, curDisconnect = AN.disconnect;
  const nConnect = (E && E.c) || curConnect, nDisconnect = curDisconnect;
  const pnow = () => performance.now();
  const r1 = x => Math.round(x * 10) / 10;
  const dB = x => (x > 1e-6 ? r1(20 * Math.log10(x)) : -120);
  const B = 256;            // 电平块：256 个采样（48 kHz 下约 5.3 ms）
  const AUDIBLE = 0.001;    // −60 dBFS 以上算有声
  let keepSec = 180;        // 原始采样保留最近多少秒；电平一直保留
  const recs = [], recOf = new Map(), events = [], marks = [], vis = [], warns = new Set();
  let curVia = null, mctx = null, earlyTapped = 0, offlineStarts = 0;

  // ---------- 录音：每个实时音频环境一个旁路 ----------
  const REC_SRC = `class R extends AudioWorkletProcessor{constructor(){super();this.N=1024;this.b=null;this.k=0;this.f=0;this.nz=false}
process(I){const x=I[0]||[],len=(x[0]&&x[0].length)||128,C=x.length||(this.b?this.b.length:1);
if(!this.b||this.b.length!==C){this.flush();this.b=[];for(let c=0;c<C;c++)this.b.push(new Float32Array(this.N+128));}
if(this.k===0)this.f=currentFrame;
for(let c=0;c<C;c++){const d=x[c],o=this.b[c];if(d){o.set(d,this.k);if(!this.nz)for(let i=0;i<d.length;i++)if(d[i]!==0){this.nz=true;break}}else o.fill(0,this.k,this.k+len)}
this.k+=len;if(this.k>=this.N)this.flush();return true}
flush(){if(!this.b||!this.k)return;if(this.nz){const o=this.b.map(a=>a.slice(0,this.k));this.port.postMessage({f:this.f,n:this.k,d:o},o.map(a=>a.buffer))}else this.port.postMessage({f:this.f,n:this.k});this.k=0;this.nz=false}}
registerProcessor('__snd_rec',R);`;

  function toPage(ctx, ct) {
    try {
      const o = ctx.getOutputTimestamp();
      if (o && o.performanceTime > 0 && o.contextTime > 0) return o.performanceTime + (ct - o.contextTime) * 1000;
    } catch (e) { }
    return pnow() - (ctx.currentTime - ct) * 1000 + (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
  }

  function recFor(ctx) {
    let r = recOf.get(ctx);
    if (r) return r;
    if (!(ctx instanceof AC) || ctx.state === 'closed') return null;
    const dest = ctx.destination, ch = Math.max(1, Math.min(dest.channelCount || 2, 8));
    r = { id: recs.length, ctx, sr: ctx.sampleRate, ch, mode: 'pending', err: null, chunks: [], last: null, pcmHead: 0, own: ctx === mctx, taps: ctx === mctx ? 1 : 0 };
    recs.push(r); recOf.set(ctx, r);
    const tap = r.tap = ctx.createGain();
    tap.channelCount = ch; tap.channelCountMode = 'explicit'; tap.channelInterpretation = dest.channelInterpretation;
    const zero = ctx.createGain(); zero.gain.value = 0; nConnect.call(zero, dest);
    const useSP = err => {
      r.err = String((err && err.message) || err);
      try {
        const sp = ctx.createScriptProcessor(1024, ch, 1);
        sp.onaudioprocess = e => {
          const ib = e.inputBuffer, d = []; let nz = false;
          for (let c = 0; c < ib.numberOfChannels; c++) { const a = ib.getChannelData(c).slice(); d.push(a); if (!nz) for (let i = 0; i < a.length; i++) if (a[i] !== 0) { nz = true; break; } }
          chunk(r, Math.max(0, Math.round(e.playbackTime * r.sr) - ib.length), ib.length, nz ? d : null);
        };
        nConnect.call(tap, sp); nConnect.call(sp, zero); r.mode = 'scriptprocessor';
      } catch (e) { r.mode = 'failed'; r.err += ' / ' + e; }
    };
    const attach = () => {
      const n = new AudioWorkletNode(ctx, '__snd_rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: ch, channelCountMode: 'explicit', channelInterpretation: dest.channelInterpretation });
      n.port.onmessage = e => { const m = e.data; chunk(r, m.f, m.n, m.d || null); };
      nConnect.call(tap, n); nConnect.call(n, zero); r.mode = 'worklet';
    };
    const url = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(REC_SRC);
    (ctx.audioWorklet ? ctx.audioWorklet.addModule(url) : Promise.reject(new Error('no audioWorklet')))
      .catch(() => ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([REC_SRC], { type: 'text/javascript' }))))
      .then(attach).catch(useSP);
    ctx.addEventListener('statechange', () => ev({ kind: 'ctx.' + ctx.state, ctx: r.id }));
    ev({ kind: 'ctx.seen', ctx: r.id, detail: `${ctx.state} ${r.sr}Hz ${ch}ch${r.own ? ' (探针为媒体元素建的)' : ''}` });
    return r;
  }

  function chunk(r, f, n, d) {
    let t = toPage(r.ctx, f / r.sr);
    const p = r.last;
    if (p && Math.abs(f - (p.f + p.n)) < 2) { const exp = p.t + p.n / r.sr * 1000; if (Math.abs(t - exp) < 25) t = exp + (t - exp) * 0.02; }
    const c = { f, t, n, sr: r.sr, ch: d ? d.length : r.ch, pk: null, ms: null, hf: null, clip: 0, pcm: null };
    if (d) {
      const C = d.length, nb = Math.ceil(n / B), pk = new Float32Array(nb), ms = new Float32Array(nb * C), hf = new Float32Array(nb), pcm = new Int16Array(n * C);
      let clip = 0;
      for (let k = 0; k < C; k++) {
        const a = d[k]; let prev = a[0];
        for (let i = 0; i < n; i++) {
          const x = a[i], ax = x < 0 ? -x : x, b = (i / B) | 0, df = x - prev; prev = x;
          if (ax > pk[b]) pk[b] = ax;
          ms[b * C + k] += x * x; hf[b] += df * df;
          if (ax >= 0.999) clip++;
          pcm[i * C + k] = (x > 1 ? 1 : x < -1 ? -1 : x) * 32767;
        }
      }
      for (let b = 0; b < nb; b++) { const len = Math.min(B, n - b * B); for (let k = 0; k < C; k++) ms[b * C + k] /= len; hf[b] /= len * C; }
      Object.assign(c, { pk, ms, hf, clip, pcm });
    }
    r.chunks.push(c); r.last = c;
    const old = t - keepSec * 1000;
    while (r.pcmHead < r.chunks.length && r.chunks[r.pcmHead].t < old) r.chunks[r.pcmHead++].pcm = null;
  }

  function tapNode(node, out) {
    const r = recFor(node.context);
    if (r) try { nConnect.call(node, r.tap, out || 0); r.taps++; } catch (e) { warns.add('旁路连接失败：' + e); }
  }

  // ---------- 挂钩：连接、发声、媒体元素、输入 ----------
  AN.connect = function __snd_connect(d) {
    const res = curConnect.apply(this, arguments);
    if (d instanceof AudioDestinationNode && this.context instanceof AC) tapNode(this, arguments[1]);
    return res;
  };
  AN.disconnect = function __snd_disconnect(d) {
    const res = curDisconnect.apply(this, arguments);
    if (d instanceof AudioDestinationNode) { const r = recOf.get(this.context); if (r) try { nDisconnect.call(this, r.tap); } catch (e) { } }
    return res;
  };
  if (E) {
    for (const n of new Set(E.n)) if (n.context instanceof AC && n.context.state !== 'closed') { tapNode(n); earlyTapped++; }
    E.n = { push() { } };
  }

  const Patched = function AudioContext(...a) {
    const c = Reflect.construct(AC, a, new.target || Patched);
    ev({ kind: 'AudioContext.new', detail: c.state, site: site(), via: via() });
    recFor(c);
    return c;
  };
  Patched.prototype = AC.prototype; Object.setPrototypeOf(Patched, AC);
  W.AudioContext = Patched; if (W.webkitAudioContext) W.webkitAudioContext = Patched;

  function via() {
    const e = W.event;
    if (e && e.type) return (e.isTrusted ? '' : '脚本派发 ') + e.type;
    return curVia || 'other';
  }
  // 发声调用来自作品代码的哪几层函数；前几层都在同一个文件里（例如音频库）时，接上第一个来自别的文件的调用者
  function site() {
    const L = Error.stackTraceLimit; Error.stackTraceLimit = 30;
    const s = new Error().stack || ''; Error.stackTraceLimit = L;
    const fr = s.split('\n').slice(1).map(x => x.trim().replace(/^at /, ''))
      .filter(x => !/__snd_|pptr:|^new AudioContext|^Reflect\.construct/.test(x))
      .map(x => x.replace(/\(?([^\s()]+):(\d+):\d+\)?$/, (m, u, l) => '@' + (u.split(/[\/\\]/).pop() || u).slice(0, 48) + ':' + l));
    const file = x => (x.match(/@(.+):\d+$/) || [])[1];
    let out = fr.slice(0, 4);
    if (fr.length > 4 && out.every(x => file(x) === file(fr[0]))) {
      const k = fr.findIndex(x => file(x) && file(x) !== file(fr[0]));
      if (k > 0) out = [fr[0], fr[1], '…', fr[k], fr[k + 1]].filter(Boolean);
    }
    return out.join(' ← ');
  }
  function ev(o) {
    const e = Object.assign({ t: r1(pnow()) }, o);
    events.push(e);
    if (events.length > 100000) events.splice(0, 10000);
    return e;
  }

  function onStart(node, when) {
    const ctx = node.context;
    if (!(ctx instanceof AC)) { offlineStarts++; return; }
    const r = recFor(ctx); if (!r) return;
    const cur = ctx.currentTime, w = Math.max(+when || 0, cur);
    ev({ kind: node.constructor.name.replace(/Node$/, ''), ctx: r.id, state: ctx.state, ct: +w.toFixed(4),
      play: ctx.state === 'running' ? r1(toPage(ctx, w)) : null,
      detail: w > cur + 0.005 ? `+${Math.round((w - cur) * 1000)}ms` : undefined, site: site(), via: via() });
  }
  for (const K of [W.AudioScheduledSourceNode, W.AudioBufferSourceNode, W.OscillatorNode, W.ConstantSourceNode]) {
    if (!K || !Object.prototype.hasOwnProperty.call(K.prototype, 'start')) continue;
    const o = K.prototype.start;
    K.prototype.start = function __snd_start(when) { try { onStart(this, when); } catch (e) { } return o.apply(this, arguments); };
  }

  // 媒体元素：数据载入后用 captureStream 旁听（不改变元素自己的输出），按元素音量与静音换算。
  // file:// 页面播放本地音频文件时浏览器视为跨来源，录不到波形，改按元素状态（播放进度、音量、静音）判断。
  const mediaInfo = new WeakMap(), inGraph = new WeakSet();
  let mediaCount = 0;
  function tapMedia(el) {
    let mi = mediaInfo.get(el); if (mi) return mi;
    mediaInfo.set(el, mi = { tainted: false, g: null, inGraph: inGraph.has(el) });
    if (inGraph.has(el)) return mi;
    const tryCap = () => {
      if (mi.g || mi.tainted || inGraph.has(el) || el.readyState < 2) return;
      let stream;
      try { stream = el.captureStream(); } catch (e) {
        if (e.name === 'SecurityError') { mi.tainted = true; warns.add('有媒体元素播放跨来源的音频（file:// 页面播放本地文件即如此），录不到它的波形，按播放进度、音量、静音判断'); }
        else warns.add('媒体元素无法旁听：' + e);
        return;
      }
      if (!mctx) { mctx = new AC(); recFor(mctx); }
      if (mctx.state !== 'running') mctx.resume();
      const g = mi.g = mctx.createGain(); mediaCount++;
      const upd = () => { g.gain.value = el.muted ? 0 : el.volume; };
      upd(); el.addEventListener('volumechange', upd);
      nConnect.call(g, recOf.get(mctx).tap);
      const done = new Set();
      const hook = () => { for (const tr of stream.getAudioTracks()) { if (done.has(tr)) continue; done.add(tr); try { nConnect.call(mctx.createMediaStreamSource(new MediaStream([tr])), g); } catch (e) { warns.add('媒体旁听失败：' + e); } } };
      hook(); stream.addEventListener('addtrack', hook);
    };
    el.addEventListener('loadeddata', tryCap); el.addEventListener('playing', tryCap); tryCap();
    return mi;
  }
  function mediaEvent(el, viaKind) {
    const t0 = el.currentTime;
    const e = ev({ kind: 'media.play', ctx: null, play: r1(pnow()), detail: `${(el.currentSrc || el.src || '').split(/[\/\\]/).pop().slice(0, 40)} vol=${el.volume} muted=${el.muted}`, site: viaKind ? undefined : site(), via: viaKind || via() });
    Object.defineProperty(e, '_mi', { value: tapMedia(el) });
    if (mctx && mctx.state !== 'running') mctx.resume();
    oSetTimeout(() => { e.after = { adv_ms: Math.round((el.currentTime - t0) * 1000), vol: el.volume, muted: el.muted, paused: el.paused }; }, 400);
  }
  const oSetTimeout = W.setTimeout.bind(W);
  const oPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function __snd_play() {
    try { mediaEvent(this); } catch (e) { }
    return oPlay.apply(this, arguments);
  };
  W.addEventListener('play', e => { const el = e.target; if (el instanceof HTMLMediaElement && !mediaInfo.has(el)) mediaEvent(el, 'autoplay'); }, true);
  const oCMES = AC.prototype.createMediaElementSource;
  if (oCMES) AC.prototype.createMediaElementSource = function __snd_cmes(el) {
    inGraph.add(el); const mi = mediaInfo.get(el);
    if (mi) { mi.inGraph = true; if (mi.g) try { nDisconnect.call(mi.g); mi.g = null; } catch (e) { } }
    return oCMES.apply(this, arguments);
  };

  // 导出与其他发声途径：只记调用
  const hookCall = (obj, name, kind, detail) => {
    if (!obj || !obj[name]) return;
    const o = obj[name];
    obj[name] = function __snd_call() { try { ev({ kind, detail: detail(this, arguments), site: site(), via: via(), unmeasured: true }); } catch (e) { } return o.apply(this, arguments); };
  };
  if (W.OfflineAudioContext) hookCall(OfflineAudioContext.prototype, 'startRendering', 'offline.render', c => `${c.length} 帧 ${c.sampleRate}Hz ${c.destination.channelCount}ch`);
  if (W.MediaRecorder) hookCall(MediaRecorder.prototype, 'start', 'MediaRecorder.start', m => `${m.mimeType} 音轨${m.stream.getAudioTracks().length} 视频轨${m.stream.getVideoTracks().length}`);
  if (W.AudioEncoder) hookCall(AudioEncoder.prototype, 'configure', 'AudioEncoder.configure', (x, a) => `${a[0] && a[0].codec} ${a[0] && a[0].sampleRate}Hz ${a[0] && a[0].numberOfChannels}ch`);
  if (W.speechSynthesis) hookCall(W.speechSynthesis, 'speak', 'speech', (x, a) => String(a[0] && a[0].text).slice(0, 30));

  // 计时器与动画帧：记下发声来自哪一类回调（via）
  const wrapTimer = (name, kind) => {
    const o = W[name];
    W[name] = function (cb) {
      if (typeof cb === 'function') {
        const f = cb;
        arguments[0] = function () { const pv = curVia; curVia = kind; try { return f.apply(this, arguments); } finally { curVia = pv; } };
      }
      const id = o.apply(W, arguments);
      if (kind === 'raf') queueSampler();
      return id;
    };
  };
  const nRAF = W.requestAnimationFrame.bind(W);
  wrapTimer('setTimeout', 'timeout'); wrapTimer('setInterval', 'interval'); wrapTimer('requestAnimationFrame', 'raf');

  // 真实的点击与按键（评分员经 MCP 的 click、press_key 等发出的都算）
  for (const type of ['pointerdown', 'keydown']) {
    W.addEventListener(type, e => {
      if (!e.isTrusted || e.repeat) return;
      const el = e.target || {}, big = el === document.body || el === document.documentElement;
      const txt = big ? '' : ((el.value || el.ariaLabel || el.textContent || '') + '').slice(0, 60).trim().replace(/\s+/g, ' ').slice(0, 20);
      marks.push({ t: r1(pnow()), label: `${type}${e.key ? ':' + e.key : ''} ${el.tagName || ''}${el.id ? '#' + el.id : ''}${txt ? ' "' + txt + '"' : ''}`, auto: true });
    }, true);
  }

  // ---------- 画面取样（AE 预览的声画同步） ----------
  let watchOn = false, watchSel = null, watchEl = null, sQueued = false, prevThumb = null, frameN = 0;
  const TW = 32, TH = 18, sc = document.createElement('canvas'); sc.width = TW; sc.height = TH;
  const sg = sc.getContext('2d', { willReadFrequently: true });
  function pickTarget() {
    if (watchSel) return typeof watchSel === 'string' ? document.querySelector(watchSel) : watchSel;
    let best = null, area = 0;
    for (const c of document.querySelectorAll('canvas')) { const b = c.getBoundingClientRect(), a = b.width * b.height; if (a > area) { area = a; best = c; } }
    return best;
  }
  function sampler(ts) {
    sQueued = false;
    if (!watchOn) return;
    if (!watchEl || frameN++ % 60 === 0) watchEl = pickTarget();
    if (watchEl) try {
      sg.drawImage(watchEl, 0, 0, TW, TH);
      const d = sg.getImageData(0, 0, TW, TH).data, th = new Float32Array(TW * TH);
      let lum = 0, diff = 0;
      for (let i = 0; i < th.length; i++) { th[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255; lum += th[i]; if (prevThumb) diff += Math.abs(th[i] - prevThumb[i]); }
      vis.push({ t: r1(ts), lum: +(lum / th.length).toFixed(4), diff: +(diff / th.length).toFixed(4) });
      if (vis.length > 200000) vis.splice(0, 20000);
      prevThumb = th;
    } catch (e) { warns.add('画面取样失败：' + e); }
    queueSampler();
  }
  function queueSampler() { if (watchOn && !sQueued) { sQueued = true; nRAF(sampler); } }

  // ---------- 读数 ----------
  function lowerBound(cs, t) { let lo = 0, hi = cs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (cs[m].t < t) lo = m + 1; else hi = m; } return lo; }
  function eachBlock(from, to, fn, onlyRec) {
    for (const r of recs) {
      if (onlyRec != null && r.id !== onlyRec) continue;
      const cs = r.chunks;
      for (let i = Math.max(0, lowerBound(cs, from - 100)); i < cs.length; i++) {
        const c = cs[i]; if (c.t > to) break;
        const bd = B * 1000 / c.sr, nb = Math.ceil(c.n / B);
        for (let b = 0; b < nb; b++) { const t = c.t + b * bd; if (t >= from && t < to) fn(t, c, b, r); }
      }
    }
  }
  const msOf = (c, b) => { let s = 0; for (let k = 0; k < c.ch; k++) s += c.ms[b * c.ch + k]; return s / c.ch; };
  function win(from, to) {
    let pk = 0, rms = 0, nb = 0;
    eachBlock(from, to, (t, c, b) => { nb++; if (!c.pk) return; if (c.pk[b] > pk) pk = c.pk[b]; const s = Math.sqrt(msOf(c, b)); if (s > rms) rms = s; });
    return { pk, rms, nb };
  }
  // 声音实际送到输出的时刻：按录到的帧时间线换算（环境挂起时调用的，在恢复后才响）
  function playTime(e) {
    const r = e.ctx != null ? recs[e.ctx] : null;
    if (!r || e.ct == null) return e.play;
    const fr = e.ct * r.sr, cs = r.chunks; let lo = 0, hi = cs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cs[m].f + cs[m].n <= fr) lo = m + 1; else hi = m; }
    if (lo >= cs.length) return r.ctx.state === 'running' ? e.play : null;
    const c = cs[lo];
    return r1(c.f >= fr ? c.t : c.t + (fr - c.f) * 1000 / c.sr);
  }
  function judge(e) {
    if (e.unmeasured) return { heard: null };
    const mi = e._mi;
    if (mi && !mi.inGraph && (mi.tainted || !mi.g)) { // 媒体元素录不到波形：按元素状态判断
      const a = e.after;
      if (!a) return { heard: null, note: '等待元素状态' };
      return { heard: a.adv_ms > 20 && a.vol > 0 && !a.muted, note: mi.tainted ? '跨来源媒体，按元素状态判断' : '未能旁听，按元素状态判断' };
    }
    if (e.ctx != null && recs[e.ctx] && !recs[e.ctx].taps) return { heard: null, note: '探针没看到这个音频环境接到扬声器（多半是没带 initScript 打开），无法判断' };
    const play = playTime(e);
    if (play == null) return { play, heard: false, note: '音频环境一直没有运行' };
    const pre = win(play - 200, play - 10), post = win(play - 10, play + (mi ? 600 : 300));
    if (!post.nb) return { play, heard: false, note: '这段没有录到' };
    const rise = dB(post.rms) - dB(pre.rms);
    const onset = post.pk >= AUDIBLE && rise < 3 && pre.rms >= AUDIBLE && onsets(play - 40, play + (mi ? 600 : 80)).some(o => o.t >= play - 15);
    return { play, lvl: dB(post.pk), rise: r1(rise), heard: post.pk >= AUDIBLE && (pre.rms < AUDIBLE || rise >= 3 || onset) };
  }
  function samples(r, t, n) {
    const cs = r.chunks; let i = Math.max(0, lowerBound(cs, t) - 1);
    while (i < cs.length && cs[i].t + cs[i].n * 1000 / cs[i].sr <= t) i++;
    if (i >= cs.length || !cs[i].pcm) return null;
    const out = new Float32Array(n); let c = cs[i], j = Math.max(0, Math.round((t - c.t) * c.sr / 1000)), k = 0;
    while (k < n && c && c.pcm) {
      for (; j < c.n && k < n; j++, k++) { let s = 0; for (let q = 0; q < c.ch; q++) s += c.pcm[j * c.ch + q]; out[k] = s / c.ch / 32767; }
      const nx = cs[++i]; if (!nx || nx.f !== c.f + c.n) break; c = nx; j = 0;
    }
    return out;
  }
  function centroid(x, sr) {
    const n = x.length, re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, h = len / 2; for (let i = 0; i < n; i += len) for (let k = 0; k < h; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), p = i + k + h, xr = re[p] * c - im[p] * s, xi = re[p] * s + im[p] * c; re[p] = re[i + k] - xr; im[p] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } }
    let num = 0, den = 0; for (let k = 1; k < n / 2; k++) { const m = Math.hypot(re[k], im[k]); num += k * sr / n * m; den += m; }
    return den > 0 ? Math.round(num / den) : null;
  }
  function onsets(from = -Infinity, to = Infinity, o = {}) {
    const rise = o.riseDb ?? 8, floor = o.floorDb ?? -55, gap = o.minGapMs ?? 30, out = [];
    for (const r of recs) {
      const hist = []; let last = -1e9, prevT = null;
      eachBlock(from - 30, to, (t, c, b) => {
        const bd = B * 1000 / c.sr;
        let gapBefore = prevT != null && t - prevT > 3 * bd;
        if (prevT == null && b === 0) { const p = r.chunks[lowerBound(r.chunks, c.t) - 1]; gapBefore = !p || p.t + p.n * 1000 / p.sr < c.t - 3 * bd; }
        if (gapBefore) { hist.length = 0; hist.push([-120, -120], [-120, -120], [-120, -120]); } // 录音段的开头按静音算
        prevT = t;
        const lv = c.pk ? 10 * Math.log10(msOf(c, b) + 1e-12) : -120, hv = c.pk ? 10 * Math.log10(c.hf[b] + 1e-12) : -120;
        if (hist.length === 3) {
          const mL = Math.min(hist[0][0], hist[1][0], hist[2][0]), mH = Math.min(hist[0][1], hist[1][1], hist[2][1]);
          if (lv > floor && (lv - mL > rise || hv - mH > rise) && t - last > gap) { last = t; if (t >= from) out.push(describe(r, c, b, t)); }
        }
        hist.push([lv, hv]); if (hist.length > 3) hist.shift();
      }, r.id);
    }
    out.sort((a, b) => a.t - b.t);
    return out.filter((x, i) => i === 0 || x.t - out[i - 1].t > 5);
  }
  function describe(r, c, b, t) {
    let t0 = t;
    if (c.pcm) { // 起音细化到采样：块内第一个超过该块峰值 30% 的采样
      const th = c.pk[b] * 0.3, i0 = b * B;
      for (let i = i0; i < Math.min(c.n, i0 + B); i++) { let a = 0; for (let k = 0; k < c.ch; k++) a = Math.max(a, Math.abs(c.pcm[i * c.ch + k]) / 32767); if (a >= th) { t0 = c.t + i * 1000 / c.sr; break; } }
    }
    let pk = 0, eL = 0, eR = 0;
    eachBlock(t, t + 40, (tt, cc, bb) => { if (!cc.pk) return; pk = Math.max(pk, cc.pk[bb]); eL += cc.ms[bb * cc.ch]; eR += cc.ms[bb * cc.ch + (cc.ch > 1 ? 1 : 0)]; }, r.id);
    const x = samples(r, t0, 2048);
    return { t: r1(t0), peak_db: dB(pk), pan_db: r.ch > 1 ? r1(10 * Math.log10((eR + 1e-12) / (eL + 1e-12))) : 0, centroid_hz: x ? centroid(x, r.sr) : null, ctx: r.id };
  }
  const inRange = (from, to) => x => x.t >= from && x.t < to;

  function info() {
    const contexts = recs.map(r => {
      let n = 0, sounding = 0, last = null, pcmSec = 0;
      for (const c of r.chunks) { n += c.n; last = c.t; if (c.pcm) pcmSec += c.n / c.sr; if (c.pk) for (let b = 0; b < c.pk.length; b++) if (Math.sqrt(msOf(c, b)) >= AUDIBLE) sounding += Math.min(B, c.n - b * B); }
      return { id: r.id, state: r.ctx.state, sr: r.sr, ch: r.ch, mode: r.mode, err: r.err || undefined, own: r.own || undefined, recorded_s: r1(n / r.sr), sounding_s: r1(sounding / r.sr), kept_s: r1(pcmSec), last_t: last == null ? null : r1(last) };
    });
    const w = [...warns];
    if (!E) w.push('未用 initScript 注入早期挂钩：载入探针之前已接到扬声器的节点录不到');
    if (recs.some(r => !r.own && r.ctx.state === 'suspended')) w.push('有音频环境仍挂起：页面还没被点击过，或作品没有恢复它');
    if (recs.some(r => !r.taps && events.some(e => e.ctx === r.id && e.site))) w.push('有音频环境在发声，但探针没看到它接到扬声器：结论不可靠，带 initScript 重新打开');
    return { version: VERSION, url: location.href, now: r1(pnow()), early_hook: E ? `已接 ${earlyTapped} 个早期节点` : false, contexts, media_elements: mediaCount, offline_starts: offlineStarts || undefined, events: events.length, marks: marks.length, watching: watchOn, keep_s: keepSec, warnings: w };
  }

  W.__snd = {
    info,
    mark(label) { const m = { t: r1(pnow()), label: String(label) }; marks.push(m); return m; },
    // 每次点击、按键之后 windowMs 内：电平是否明显升高、隔多少毫秒、调用了哪些发声
    report(windowMs = 600, preMs = 300) {
      const am = marks.filter(m => m.auto);
      return am.map((m, i) => {
        const end = Math.min(m.t + windowMs, i + 1 < am.length ? am[i + 1].t : Infinity);
        const pre = win(m.t - preMs, m.t), thr = Math.max(pre.rms * 2, AUDIBLE);
        let on = null, pk = 0, nb = 0;
        eachBlock(m.t, end, (t, c, b) => { nb++; if (!c.pk) return; if (c.pk[b] > pk) pk = c.pk[b]; if (Math.sqrt(msOf(c, b)) > thr && (on == null || t < on)) on = t; });
        if (on == null && pk >= AUDIBLE) { const o = onsets(m.t - 40, end).find(x => x.t >= m.t); if (o) on = o.t; }
        const cs = events.filter(e => e.t >= m.t - 20 && e.t < end && !/^ctx\./.test(e.kind));
        const kinds = Object.entries(cs.reduce((o, e) => (o[e.kind] = (o[e.kind] || 0) + 1, o), {})).map(([k, n]) => n > 1 ? `${k}×${n}` : k).join(', ');
        const byState = on == null && cs.some(e => e._mi && judge(e).heard && /元素状态/.test(judge(e).note || ''));
        return { t: m.t, input: m.label, sounded: on != null || byState, onset_ms: on != null ? Math.round(on - m.t) : null, peak_db: dB(pk), base_db: dB(pre.rms), recorded: nb > 0, calls: kinds || undefined, site: cs.find(e => e.site) ? cs.find(e => e.site).site : undefined, note: byState ? '媒体元素按播放状态判断' : undefined };
      });
    },
    // 发声调用列表：每条带实际播放时刻 play、那段输出的峰值 lvl 与抬升 rise、是否真的听得到 heard
    events(o = {}) {
      const from = o.from ?? -Infinity, to = o.to ?? Infinity, lim = o.limit ?? 100;
      let es = events.filter(e => e.t >= from && e.t < to && (!o.kind || e.kind.includes(o.kind)) && (!o.site || (e.site || '').includes(o.site)));
      if (!o.all) es = es.filter(e => !/^ctx\.|^AudioContext/.test(e.kind));
      return es.slice(-lim).map(e => Object.assign({}, e, /^ctx\.|^AudioContext/.test(e.kind) ? {} : judge(e)));
    },
    // 按调用位置汇总：哪些函数发过声、几次、其中几次真的有声、来自哪类回调
    sites(top = 30) {
      const m = new Map();
      for (const e of events) {
        if (!e.site || /^AudioContext/.test(e.kind)) continue;
        const k = e.kind + ' | ' + e.site; let v = m.get(k);
        if (!v) m.set(k, v = { site: e.site, kind: e.kind, n: 0, heard: 0, first: e.t, last: e.t, via: {} });
        v.n++; v.last = e.t; v.via[e.via] = (v.via[e.via] || 0) + 1;
        if (pnow() - e.t > 400 && judge(e).heard) v.heard++;
      }
      return [...m.values()].sort((a, b) => b.n - a.n).slice(0, top);
    },
    levels(from = -Infinity, to = Infinity, binMs = 250) {
      if (!isFinite(from)) { const ts = recs.flatMap(r => r.chunks.length ? [r.chunks[0].t] : []); from = ts.length ? Math.min(...ts) : 0; }
      if (!isFinite(to)) to = pnow();
      const nb = Math.max(1, Math.ceil((to - from) / binMs)), L = new Array(nb).fill(null), R = new Array(nb).fill(null);
      eachBlock(from, to, (t, c, b) => {
        const i = Math.floor((t - from) / binMs); if (i < 0 || i >= nb) return;
        const l = c.pk ? Math.sqrt(c.ms[b * c.ch]) : 0, rr = c.pk ? Math.sqrt(c.ms[b * c.ch + (c.ch > 1 ? 1 : 0)]) : 0;
        L[i] = Math.max(L[i] ?? 0, l); R[i] = Math.max(R[i] ?? 0, rr);
      });
      return { from: r1(from), bin_ms: binMs, L: L.map(x => x == null ? null : dB(x)), R: R.map(x => x == null ? null : dB(x)) };
    },
    summary(from = -Infinity, to = Infinity) {
      let n = 0, sounding = 0, pk = 0, e = 0, eL = 0, eR = 0, ch = 1; const clipped = new Set();
      eachBlock(from, to, (t, c, b) => {
        const len = Math.min(B, c.n - b * B); n += len; ch = Math.max(ch, c.ch);
        if (!c.pk) return;
        const s = msOf(c, b); if (Math.sqrt(s) >= AUDIBLE) sounding += len;
        pk = Math.max(pk, c.pk[b]); e += s * len; eL += c.ms[b * c.ch] * len; eR += c.ms[b * c.ch + (c.ch > 1 ? 1 : 0)] * len;
        if (c.clip) clipped.add(c);
      });
      const sr = recs.length ? recs[0].sr : 48000, os = onsets(from, to);
      return { recorded_s: r1(n / sr), sounding_s: r1(sounding / sr), peak_db: dB(pk), rms_db: n ? dB(Math.sqrt(e / n)) : -120, clipped_samples: [...clipped].reduce((s, c) => s + c.clip, 0), channels: ch, pan_db: ch > 1 && e > 0 ? r1(10 * Math.log10((eR + 1e-12) / (eL + 1e-12))) : 0, onsets: os.length };
    },
    onsets,
    // 画面取样：每帧在作品自己的绘制之后取最大的 canvas（或 selector 指定的 canvas）的平均亮度与帧间差
    watch(on = true, selector = null) { watchOn = !!on; watchSel = selector; watchEl = null; prevThumb = null; queueSampler(); return { watching: watchOn }; },
    // 声音起音与画面突变的对齐：offset_ms = 画面时刻 − 声音时刻（正数表示画面晚于声音）
    sync(from = -Infinity, to = Infinity, o = {}) {
      const fr = vis.filter(inRange(from, to)), maxMs = o.maxMs ?? 150;
      const ds = fr.map(f => f.diff).sort((a, b) => a - b), med = ds.length ? ds[ds.length >> 1] : 0, thr = o.diffThr ?? Math.max(0.02, med * 4);
      const ve = []; let last = -1e9, armed = true; // 突变的第一帧：帧间差越过阈值，回落到一半以下才算下一次
      for (const f of fr) { if (armed && f.diff > thr && f.t - last > 60) { ve.push(f.t); last = f.t; armed = false; } else if (f.diff < thr / 2) armed = true; }
      const au = onsets(from, to).map(x => x.t), pairs = [];
      for (const a of au) { let best = null; for (const v of ve) if (Math.abs(v - a) <= maxMs && (best == null || Math.abs(v - a) < Math.abs(best - a))) best = v; if (best != null) pairs.push({ audio: a, visual: best, offset_ms: r1(best - a) }); }
      const offs = pairs.map(p => p.offset_ms).sort((a, b) => a - b);
      return { frames: fr.length, visual_changes: ve.length, audio_onsets: au.length, matched: pairs.length, median_offset_ms: offs.length ? offs[offs.length >> 1] : null, pairs: pairs.slice(0, o.limit ?? 50) };
    },
    // 导出：事件、标记、起音、画面取样、电平，以及（pcm 不为 false 时）这段录音的 WAV（base64）
    export(from = -Infinity, to = Infinity, o = {}) {
      const res = { probe: 'sound_probe', version: VERSION, url: location.href, from, to, info: info(), marks: marks.filter(inRange(from, to)), events: this.events({ from, to, limit: Infinity, all: true }), onsets: onsets(from, to), vis: vis.filter(inRange(from, to)), levels: this.levels(from, to, 20) };
      if (o.pcm !== false) res.wav = mixWav(from, to, o.sr);
      return res;
    },
    clear() { for (const r of recs) { r.chunks = []; r.last = null; r.pcmHead = 0; } events.length = 0; marks.length = 0; vis.length = 0; return 'cleared'; },
    config(o = {}) { if (o.keepSec) keepSec = +o.keepSec; return { keep_s: keepSec }; },
  };

  function mixWav(from, to, outSr) {
    const runs = [];
    for (const r of recs) {
      let prev = null, placed = 0;
      for (const c of r.chunks) {
        if (!c.pcm || c.t + c.n * 1000 / c.sr < from || c.t > to) { prev = null; continue; }
        placed = prev && c.f === prev.f + prev.n && Math.abs(c.t - (placed + prev.n * 1000 / c.sr)) < 25 ? placed + prev.n * 1000 / c.sr : c.t;
        runs.push({ c, at: placed }); prev = c;
      }
    }
    if (!runs.length) return null;
    outSr = outSr || recs.find(r => r.chunks.some(c => c.pcm)).sr;
    const C = Math.min(8, Math.max(...runs.map(x => x.c.ch)));
    const start = Math.max(from, Math.min(...runs.map(x => x.at))), end = Math.min(to, Math.max(...runs.map(x => x.at + x.c.n * 1000 / x.c.sr)));
    const N = Math.max(0, Math.ceil((end - start) / 1000 * outSr));
    if (N * C * 2 > 300e6) return { error: '时间段太长，请缩短' };
    const mix = new Float32Array(N * C);
    for (const { c, at } of runs) {
      const step = outSr / c.sr, off = (at - start) / 1000 * outSr, m = Math.round(c.n * step);
      for (let j = 0; j < m; j++) {
        const o = Math.round(off) + j; if (o < 0 || o >= N) continue;
        const sp = j / step, i = Math.min(c.n - 1, Math.floor(sp)), fr = sp - i, i2 = Math.min(c.n - 1, i + 1);
        for (let k = 0; k < C; k++) { const q = Math.min(k, c.ch - 1); mix[o * C + k] += (c.pcm[i * c.ch + q] * (1 - fr) + c.pcm[i2 * c.ch + q] * fr) / 32767; }
      }
    }
    const buf = new ArrayBuffer(44 + N * C * 2), v = new DataView(buf); let p = 0;
    const ws = s => { for (const ch of s) v.setUint8(p++, ch.charCodeAt(0)); }, u32 = x => { v.setUint32(p, x, true); p += 4; }, u16 = x => { v.setUint16(p, x, true); p += 2; };
    ws('RIFF'); u32(36 + N * C * 2); ws('WAVE'); ws('fmt '); u32(16); u16(1); u16(C); u32(outSr); u32(outSr * C * 2); u16(C * 2); u16(16); ws('data'); u32(N * C * 2);
    for (let i = 0; i < N * C; i++) { v.setInt16(p, Math.max(-1, Math.min(1, mix[i])) * 32767, true); p += 2; }
    const u8 = new Uint8Array(buf); let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { start_ms: r1(start), sr: outSr, channels: C, b64: btoa(bin) };
  }

  return info();
}
