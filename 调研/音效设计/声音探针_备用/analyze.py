"""声音探针的分析脚本，用法见同目录 README.md。

  python analyze.py probe <探针导出.json> [--out 目录]
      把 __snd.export() 存下的 JSON 还原成 WAV，画电平、频谱、发声调用与标记，打印摘要。
  python analyze.py media <视频或音频文件> [--expect 0.5,1.0,...] [--out 目录]
      导出文件：音轨与画面的基本信息、帧间隔、起音、画面突变、声画偏差；
      --expect 给出应当发声的时刻（秒，如关键帧、标记），逐个找最近的起音。
需要 numpy、matplotlib；media 模式需要 ffmpeg/ffprobe（只有 .wav 时不需要）。
"""
import argparse, base64, io, json, os, shutil, subprocess, sys, wave
import numpy as np
import warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)

B = 256  # 电平块：256 个采样


def db(x):
    return round(float(20 * np.log10(x)), 1) if x > 1e-6 else -120.0


def find_ff(name):
    p = shutil.which(name)
    if p:
        return p
    for root in [r"E:\software\ffmepg"]:
        for d, _, fs in os.walk(root):
            if name + ".exe" in fs:
                return os.path.join(d, name + ".exe")
    return None


# ---------- 起音与画面突变 ----------
def onsets(x, sr, start=0.0, rise=8.0, floor=-55.0, gap=0.03):
    """x: (n, ch) float。按块能量与一阶差分能量的突升找起音，返回 [{t, peak_db, pan_db, centroid_hz}]"""
    n = len(x) // B
    if n < 4:
        return []
    blk = x[: n * B].reshape(n, B, -1)
    lv = 10 * np.log10((blk ** 2).mean(axis=(1, 2)) + 1e-12)
    d = np.diff(x, axis=0, prepend=x[:1])[: n * B].reshape(n, B, -1)
    hv = 10 * np.log10((d ** 2).mean(axis=(1, 2)) + 1e-12)
    pk = np.abs(blk).max(axis=(1, 2))
    out, last = [], -1e9
    for k in range(3, n):
        t = start + k * B / sr
        if lv[k] > floor and (lv[k] - lv[k - 3:k].min() > rise or hv[k] - hv[k - 3:k].min() > rise) and t - last > gap:
            last = t
            seg = np.abs(x[k * B:(k + 1) * B]).max(axis=1)
            i0 = k * B + int(np.argmax(seg >= pk[k] * 0.3))
            w = x[i0:i0 + int(0.04 * sr)]
            eL = float((w[:, 0] ** 2).sum()); eR = float((w[:, -1] ** 2).sum())
            m = x[i0:i0 + 2048].mean(axis=1)
            cen = None
            if len(m) == 2048:
                sp = np.abs(np.fft.rfft(m * np.hanning(2048)))
                f = np.fft.rfftfreq(2048, 1 / sr)
                cen = int((sp[1:] * f[1:]).sum() / max(sp[1:].sum(), 1e-12))
            out.append({"t": round(float(start + i0 / sr), 4), "peak_db": db(float(np.abs(w).max()) if len(w) else 0),
                        "pan_db": round(float(10 * np.log10((eR + 1e-12) / (eL + 1e-12))), 1) if x.shape[1] > 1 else 0.0,
                        "centroid_hz": cen})
    return out


def visual_changes(ts, diff, thr=None, gap=0.06):
    if len(diff) < 3:
        return [], 0
    thr = thr if thr is not None else max(0.02, 4 * float(np.median(diff)))
    ev, last, armed = [], -1e9, True
    for i in range(len(diff)):  # 突变的第一帧：帧间差越过阈值（先回落到阈值一半以下才算下一次）
        v = diff[i]
        if armed and v > thr and ts[i] - last > gap:
            ev.append(float(ts[i])); last = ts[i]; armed = False
        elif v < thr / 2:
            armed = True
    return ev, thr


def pair(audio, visual, max_s=0.15):
    res = []
    for a in audio:
        if not visual:
            break
        v = min(visual, key=lambda y: abs(y - a))
        if abs(v - a) <= max_s:
            res.append({"audio": round(float(a), 4), "visual": round(float(v), 4), "offset_ms": round(float(v - a) * 1000, 1)})
    return res


def stats(x):
    pk = float(np.abs(x).max()) if x.size else 0.0
    e = (x ** 2).mean(axis=0) if x.size else np.zeros(1)
    return {"seconds": None, "peak_db": db(pk), "rms_db": db(float(np.sqrt(e.mean()))) if x.size else -120.0,
            "clipped_samples": int((np.abs(x) >= 0.999).sum()),
            "pan_db": round(float(10 * np.log10((e[-1] + 1e-12) / (e[0] + 1e-12))), 1) if x.shape[1] > 1 else 0.0,
            "channel_rms_db": [db(float(np.sqrt(v))) for v in e]}


# ---------- 画图 ----------
def plot(path, x, sr, start, title, marks=(), events=(), ons=(), vis=None, visual=(), expect=(), levels=None):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    rows = 3 + (vis is not None)
    fig, ax = plt.subplots(rows, 1, figsize=(18, 3.0 * rows), sharex=True, gridspec_kw={"height_ratios": [2, 2, 1.2] + ([1] if vis is not None else [])})
    if x is not None and len(x):
        t = start + np.arange(len(x)) / sr
        step = max(1, len(x) // 6000)
        for c in range(x.shape[1]):
            env = np.abs(x[: len(x) // step * step, c]).reshape(-1, step).max(axis=1)
            ax[0].plot(t[: len(env) * step: step], 20 * np.log10(env + 1e-6), lw=0.6, label=["L", "R"][c] if x.shape[1] == 2 else f"ch{c}")
        m = x.mean(axis=1); N = 1024; hop = max(256, (len(m) - N) // 3000 + 1)
        if len(m) > N:
            fr = np.lib.stride_tricks.sliding_window_view(m, N)[::hop] * np.hanning(N)
            S = 20 * np.log10(np.abs(np.fft.rfft(fr, axis=1)) / (N / 4) + 1e-9)
            ax[1].imshow(S.T, origin="lower", aspect="auto", cmap="magma", vmin=-100, vmax=0,
                         extent=(start, start + (len(S) * hop + N) / sr, 0, sr / 2))
        ax[1].set_ylim(0, min(16000, sr / 2))
    elif levels:
        tt = levels["from"] / 1000 + np.arange(len(levels["L"])) * levels["bin_ms"] / 1000
        for k in ("L", "R"):
            ax[0].plot(tt, [v if v is not None else np.nan for v in levels[k]], lw=0.6, label=k)
    ax[0].set_ylim(-80, 3); ax[0].set_ylabel("峰值 dBFS"); ax[0].legend(loc="upper right")
    ax[1].set_ylabel("频率 Hz")
    for o in ons:
        ax[0].axvline(o["t"], color="tab:blue", alpha=0.25, lw=0.8)
    kinds = sorted({e["kind"] for e in events})
    for e in events:
        y = kinds.index(e["kind"])
        tt = (e.get("play") or e["t"]) / (1000 if e.get("_ms") else 1)
        col = {True: "tab:green", False: "tab:red"}.get(e.get("heard"), "tab:gray")
        ax[2].plot([tt], [y], "|", ms=12, mew=2, color=col)
    ax[2].set_yticks(range(len(kinds))); ax[2].set_yticklabels(kinds, fontsize=8)
    ax[2].set_ylabel("发声调用\n绿=有声 红=无声")
    for m in marks:  # 手动标记（橙色，带名字）；点击、按键（细绿线）
        for a in ax:
            a.axvline(m["t"], color="tab:olive" if m.get("auto") else "tab:orange", lw=0.5 if m.get("auto") else 1.2, alpha=0.8)
        if not m.get("auto"):
            ax[0].text(m["t"], 1, m["label"][:24], rotation=90, fontsize=8, va="top", ha="right")
    for v in expect:
        for a in ax:
            a.axvline(v, color="tab:purple", ls="--", lw=1)
    if vis is not None:
        ax[-1].plot(vis[0], vis[1], lw=0.7, color="k"); ax[-1].set_ylabel("画面帧间差")
        for v in visual:
            ax[-1].axvline(v, color="tab:red", alpha=0.5)
    ax[-1].set_xlabel("时间 s")
    ax[0].set_title(title)
    fig.tight_layout(); fig.savefig(path, dpi=80); plt.close(fig)


# ---------- 两种模式 ----------
def read_wav_bytes(b):
    with wave.open(io.BytesIO(b)) as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), np.int16).astype(np.float32).reshape(-1, ch) / 32768
    return x, sr


def cmd_probe(a):
    d = json.load(open(a.file, encoding="utf-8"))
    if isinstance(d, str):
        d = json.loads(d)
    out = a.out or os.path.dirname(os.path.abspath(a.file))
    stem = os.path.join(out, os.path.splitext(os.path.basename(a.file))[0])
    x, sr, start = None, 48000, 0.0
    if d.get("wav") and d["wav"].get("b64"):
        raw = base64.b64decode(d["wav"]["b64"])
        open(stem + ".wav", "wb").write(raw)
        x, sr = read_wav_bytes(raw)
        start = d["wav"]["start_ms"] / 1000
        print(f"WAV: {stem}.wav  {len(x) / sr:.1f} s  {sr} Hz  {x.shape[1]} 声道  起点 {start:.3f} s（页面时间）")
    s = stats(x) if x is not None else {}
    if s:
        s["seconds"] = round(len(x) / sr, 2)
        print("整段：", json.dumps(s, ensure_ascii=False))
    info = d.get("info", {})
    print("音频环境：", json.dumps(info.get("contexts"), ensure_ascii=False))
    if info.get("warnings"):
        print("提示：", "；".join(info["warnings"]))
    evs = [e for e in d.get("events", []) if not e["kind"].startswith(("ctx.", "AudioContext"))]
    sites = {}
    for e in evs:
        k = (e["kind"], e.get("site") or "")
        v = sites.setdefault(k, [0, 0, set()]); v[0] += 1; v[1] += bool(e.get("heard")); v[2].add(e.get("via"))
    print(f"发声调用 {len(evs)} 次（按调用位置：次数 / 其中有声 / 来自）：")
    for (k, st), v in sorted(sites.items(), key=lambda z: -z[1][0])[:30]:
        print(f"  {v[0]:4d} / {v[1]:4d}  {k:18s} {'/'.join(sorted(map(str, v[2])))}  {st}")
    ons = d.get("onsets", [])
    print(f"起音 {len(ons)} 个；标记 {len(d.get('marks', []))} 个")
    to_s = lambda L: [dict(m, t=m["t"] / 1000) for m in L]
    ev_s = [dict(e, t=e["t"] / 1000, play=(e.get("play") or e["t"]) / 1000) for e in evs]
    vis = d.get("vis") or []
    vv = None; vch = []
    if vis:
        ts = np.array([v["t"] for v in vis]) / 1000; df = np.array([v["diff"] for v in vis])
        vv = (ts, df); vch, _ = visual_changes(ts, df)
    plot(stem + ".png", x, sr, start, os.path.basename(a.file), to_s(d.get("marks", [])), ev_s, to_s(ons), vv, vch,
         levels=d.get("levels") if x is None else None)
    print("图：", stem + ".png")


def cmd_media(a):
    out = a.out or os.path.dirname(os.path.abspath(a.file))
    stem = os.path.join(out, os.path.splitext(os.path.basename(a.file))[0])
    ffprobe, ffmpeg = find_ff("ffprobe"), find_ff("ffmpeg")
    expect = [float(v) for v in a.expect.split(",")] if a.expect else []
    vis = None; vch = []; x = None; sr = 48000; a_start = 0.0
    if not (ffprobe and ffmpeg):
        if not a.file.lower().endswith(".wav"):
            sys.exit("本机找不到 ffmpeg/ffprobe，只能分析 .wav")
        x, sr = read_wav_bytes(open(a.file, "rb").read())
        print(f"WAV {len(x) / sr:.3f} s {sr} Hz {x.shape[1]} 声道")
    else:
        pr = json.loads(subprocess.check_output([ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", a.file]))
        fmt = pr.get("format", {})
        print(f"容器 {fmt.get('format_name')}  时长 {fmt.get('duration')}  起点 {fmt.get('start_time')}")
        aud = [s for s in pr["streams"] if s["codec_type"] == "audio"]
        vid = [s for s in pr["streams"] if s["codec_type"] == "video"]
        for s in aud:
            print(f"音轨 #{s['index']}: {s.get('codec_name')} {s.get('sample_rate')} Hz {s.get('channels')} 声道  起点 {s.get('start_time')}  时长 {s.get('duration') or s.get('tags', {}).get('DURATION')}")
        for s in vid:
            print(f"画面 #{s['index']}: {s.get('codec_name')} {s.get('width')}x{s.get('height')}  帧率 {s.get('avg_frame_rate')} (r {s.get('r_frame_rate')})  起点 {s.get('start_time')}  时长 {s.get('duration') or s.get('tags', {}).get('DURATION')}  帧数 {s.get('nb_frames')}")
        if not aud:
            print("没有音轨")
        if aud:
            s = aud[0]; ch = int(s.get("channels") or 2); a_start = float(s.get("start_time") or 0)
            raw = subprocess.check_output([ffmpeg, "-v", "error", "-i", a.file, "-map", "0:a:0", "-f", "f32le", "-ac", str(ch), "-ar", str(sr), "-"])
            x = np.frombuffer(raw, np.float32).reshape(-1, ch)
            print(f"音轨解码 {len(x) / sr:.3f} s")
        if vid:
            fr = json.loads(subprocess.check_output([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=pts_time,best_effort_timestamp_time", "-of", "json", a.file]))["frames"]
            pts = np.array([float(f.get("pts_time") or f.get("best_effort_timestamp_time") or "nan") for f in fr])
            rawv = subprocess.check_output([ffmpeg, "-v", "error", "-i", a.file, "-map", "0:v:0", "-fps_mode", "passthrough", "-vf", "scale=32:18,format=gray", "-f", "rawvideo", "-"])
            g = np.frombuffer(rawv, np.uint8).reshape(-1, 32 * 18).astype(np.float32) / 255
            n = min(len(pts), len(g)); pts, g = pts[:n], g[:n]
            df = np.concatenate([[0], np.abs(np.diff(g, axis=0)).mean(axis=1)])
            iv = np.diff(pts) * 1000
            if len(iv):
                print(f"帧 {n} 个，首帧 {pts[0]:.4f} s，末帧 {pts[-1]:.4f} s；帧间隔 ms：最小 {iv.min():.1f} 中位 {np.median(iv):.1f} 最大 {iv.max():.1f}" + ("（不均匀，可能是边播边录）" if iv.max() > 1.5 * max(iv.min(), 1e-3) else "（均匀）"))
            vis = (pts, df); vch, thr = visual_changes(pts, df)
            print(f"画面突变 {len(vch)} 处（阈值 {thr:.3f}）：", [round(v, 4) for v in vch[:40]])
    if x is None:
        return
    s = stats(x); s["seconds"] = round(len(x) / sr, 3)
    print("音轨：", json.dumps(s, ensure_ascii=False))
    cover = f"音轨覆盖 {a_start:.3f}–{a_start + len(x) / sr:.3f} s"
    if vis is not None and len(vis[0]) > 1:
        cover += f"；画面覆盖 {vis[0][0]:.3f}–{vis[0][-1] + float(np.median(np.diff(vis[0]))):.3f} s"
    print(cover)
    ons = onsets(x, sr, a_start)
    print(f"起音 {len(ons)} 个：", [o["t"] for o in ons[:60]])
    if vis is not None:
        ps = pair([o["t"] for o in ons], vch)
        offs = sorted(p["offset_ms"] for p in ps)
        print(f"声画配对 {len(ps)} 对（偏差 = 画面 − 声音，正数表示画面晚）：中位 {offs[len(offs) // 2] if offs else None} ms；", [p["offset_ms"] for p in ps[:40]])
    for e in expect:
        if ons:
            o = min(ons, key=lambda y: abs(y["t"] - e))
            print(f"应在 {e:.3f} s：最近起音 {o['t']:.4f} s，偏差 {1000 * (o['t'] - e):+.1f} ms，峰值 {o['peak_db']} dB，声像 {o['pan_db']} dB，重心 {o['centroid_hz']} Hz")
    plot(stem + ".png", x, sr, a_start, os.path.basename(a.file), ons=ons, vis=vis, visual=vch, expect=expect)
    print("图：", stem + ".png")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("mode", choices=["probe", "media"])
    p.add_argument("file")
    p.add_argument("--out")
    p.add_argument("--expect", help="应当发声的时刻，秒，逗号分隔")
    a = p.parse_args()
    {"probe": cmd_probe, "media": cmd_media}[a.mode](a)
