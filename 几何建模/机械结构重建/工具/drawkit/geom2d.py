"""视图内的二维曲线：直线、圆弧、圆、折线（JSON 字典形式），以及裁剪、合并、采样。

曲线字典：
  {"geom": "line", "from": [x, y], "to": [x, y], "type": 线型}
  {"geom": "arc", "center": [x, y], "r": r, "start": 度, "end": 度, "type": 线型}   逆时针从 start 到 end
  {"geom": "circle", "center": [x, y], "r": r, "type": 线型}
  {"geom": "polyline", "points": [[x, y], ...], "type": 线型}
区域字典（用于裁剪）：
  {"shape": "halfplane", "n": [nx, ny], "c": c}      n·p ≥ c 为内
  {"shape": "rect", "box": [x0, y0, x1, y1]}
  {"shape": "circle", "center": [x, y], "r": r}
  {"shape": "polygon", "points": [[x, y], ...]}
"""
import math

import numpy as np

TOL = 1e-5


def R(x, nd=6):
    return round(float(x), nd)


def P(p, nd=6):
    return [R(p[0], nd), R(p[1], nd)]


def line(a, b, kind):
    return {"geom": "line", "from": P(a), "to": P(b), "type": kind}


def arc(c, r, start, end, kind):
    """start/end 为度；逆时针。跨度 ≥ 360 时为整圆。"""
    if end - start >= 360 - 1e-7:
        return {"geom": "circle", "center": P(c), "r": R(r), "type": kind}
    s = start % 360.0
    e = s + (end - start)
    return {"geom": "arc", "center": P(c), "r": R(r), "start": R(s), "end": R(e), "type": kind}


def polyline(points, kind):
    return {"geom": "polyline", "points": [P(p) for p in points], "type": kind}


def span_of(c):
    if c["geom"] == "circle":
        return 0.0, 360.0
    return c["start"], c["end"]


def length(c):
    g = c["geom"]
    if g == "line":
        return float(np.hypot(c["to"][0] - c["from"][0], c["to"][1] - c["from"][1]))
    if g in ("arc", "circle"):
        s, e = span_of(c)
        return math.radians(e - s) * c["r"]
    pts = np.asarray(c["points"], float)
    return float(np.sum(np.linalg.norm(np.diff(pts, axis=0), axis=1))) if len(pts) > 1 else 0.0


def sample(c, step):
    """沿曲线按约 step 的间距取点（含端点）。"""
    g = c["geom"]
    if g == "line":
        a, b = np.asarray(c["from"], float), np.asarray(c["to"], float)
        n = max(1, int(math.ceil(np.linalg.norm(b - a) / step)))
        t = np.linspace(0, 1, n + 1)[:, None]
        return a + (b - a) * t
    if g in ("arc", "circle"):
        s, e = span_of(c)
        r = c["r"]
        n = max(2, int(math.ceil(math.radians(e - s) * r / step)))
        t = np.radians(np.linspace(s, e, n + 1))
        cx, cy = c["center"]
        return np.stack([cx + r * np.cos(t), cy + r * np.sin(t)], axis=1)
    pts = np.asarray(c["points"], float)
    out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        n = max(1, int(math.ceil(np.linalg.norm(b - a) / step)))
        for t in np.linspace(0, 1, n + 1)[1:]:
            out.append(a + (b - a) * t)
    return np.asarray(out)


def bounds(curves):
    # 折线极值就在节点上；避免在复杂消隐曲线的每段上反复创建 linspace。
    pts = [np.asarray([c['from'], c['to']] if c['geom']=='line' else c['points'], float)
           if c['geom'] in ('line','polyline') else sample(c, max(c['r'] * 0.05, 1e-3))
           for c in curves]
    if not pts:
        return None
    allp = np.concatenate(pts)
    return [float(allp[:, 0].min()), float(allp[:, 1].min()), float(allp[:, 0].max()), float(allp[:, 1].max())]


def xform(c, s, t):
    """均匀缩放 s 再平移 t（视图坐标 → 图纸毫米）。"""
    g = c["geom"]
    f = lambda p: [p[0] * s + t[0], p[1] * s + t[1]]
    out = dict(c)
    if g == "line":
        out["from"], out["to"] = f(c["from"]), f(c["to"])
    elif g in ("arc", "circle"):
        out["center"], out["r"] = f(c["center"]), c["r"] * s
    else:
        out["points"] = [f(p) for p in c["points"]]
    return out


# ---------------------------------------------------------------- 区域

def contains(region, pts):
    pts = np.atleast_2d(np.asarray(pts, float))
    kind = region["shape"]
    if kind == "halfplane":
        n = np.asarray(region["n"], float)
        return pts @ n >= region["c"] - 1e-9
    if kind == "rect":
        x0, y0, x1, y1 = region["box"]
        return ((pts[:, 0] >= min(x0, x1) - 1e-9) & (pts[:, 0] <= max(x0, x1) + 1e-9) &
                (pts[:, 1] >= min(y0, y1) - 1e-9) & (pts[:, 1] <= max(y0, y1) + 1e-9))
    if kind == "circle":
        c = np.asarray(region["center"], float)
        return np.linalg.norm(pts - c, axis=1) <= region["r"] + 1e-9
    poly = np.asarray(region["points"], float)
    inside = np.zeros(len(pts), bool)
    x, y = pts[:, 0], pts[:, 1]
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        cond = (y1 > y) != (y2 > y)
        with np.errstate(divide="ignore", invalid="ignore"):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
        inside ^= cond & (xi > x)
    return inside


def boundary(region, big=1e6):
    kind = region["shape"]
    if kind == "circle":
        return [("circ", np.asarray(region["center"], float), float(region["r"]))]
    if kind == "halfplane":
        n = np.asarray(region["n"], float) / np.linalg.norm(region["n"])
        p0 = n * region["c"] / np.linalg.norm(region["n"])
        d = np.array([-n[1], n[0]])
        return [("seg", p0 - d * big, p0 + d * big)]
    if kind == "rect":
        x0, y0, x1, y1 = region["box"]
        pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    else:
        pts = region["points"]
    pts = [np.asarray(p, float) for p in pts]
    return [("seg", pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]


def boundary_polyline(region, step):
    """区域边界的折线（闭合），用于波浪线。"""
    kind = region["shape"]
    if kind == "circle":
        c, r = np.asarray(region["center"], float), region["r"]
        n = max(24, int(2 * math.pi * r / step))
        t = np.linspace(0, 2 * math.pi, n + 1)
        return np.stack([c[0] + r * np.cos(t), c[1] + r * np.sin(t)], axis=1)
    segs = boundary(region)
    out = []
    for _, a, b in segs:
        n = max(1, int(math.ceil(np.linalg.norm(b - a) / step)))
        for t in np.linspace(0, 1, n + 1)[:-1]:
            out.append(a + (b - a) * t)
    out.append(out[0])
    return np.asarray(out)


def _seg_seg(a, b, p, q):
    d1, d2 = b - a, q - p
    den = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(den) < 1e-14:
        return []
    w = p - a
    t = (w[0] * d2[1] - w[1] * d2[0]) / den
    u = (w[0] * d1[1] - w[1] * d1[0]) / den
    if -1e-12 <= u <= 1 + 1e-12 and 0 < t < 1:
        return [t]
    return []


def _seg_circ(a, b, c, r):
    d = b - a
    f = a - c
    A, B, C = d @ d, 2 * (f @ d), f @ f - r * r
    disc = B * B - 4 * A * C
    if disc <= 0 or A < 1e-300:
        return []
    s = math.sqrt(disc)
    return [t for t in ((-B - s) / (2 * A), (-B + s) / (2 * A)) if 0 < t < 1]


def _circle_line_angles(c, r, p, q, seg=True):
    d = q - p
    f = p - c
    A, B, C = d @ d, 2 * (f @ d), f @ f - r * r
    disc = B * B - 4 * A * C
    if disc <= 0 or A < 1e-300:
        return []
    s = math.sqrt(disc)
    out = []
    for t in ((-B - s) / (2 * A), (-B + s) / (2 * A)):
        if not seg or -1e-12 <= t <= 1 + 1e-12:
            x = p + d * t - c
            out.append(math.degrees(math.atan2(x[1], x[0])))
    return out


def _circle_circle_angles(c1, r1, c2, r2):
    d = c2 - c1
    L = float(np.linalg.norm(d))
    if L < 1e-12 or L > r1 + r2 or L < abs(r1 - r2):
        return []
    a = (r1 * r1 - r2 * r2 + L * L) / (2 * L)
    h2 = r1 * r1 - a * a
    if h2 <= 0:
        return []
    base = math.atan2(d[1], d[0])
    off = math.acos(max(-1.0, min(1.0, a / r1)))
    return [math.degrees(base - off), math.degrees(base + off)]


def _in_span(angle, s, e):
    x = (angle - s) % 360.0
    return 0 < x < (e - s)


def clip(c, region, inside=True):
    """把曲线裁剪到区域内（inside=False 时保留区域外）。"""
    g = c["geom"]
    kind = c["type"]
    bnd = boundary(region)
    if g == "line":
        a, b = np.asarray(c["from"], float), np.asarray(c["to"], float)
        ts = [0.0, 1.0]
        for item in bnd:
            ts += _seg_seg(a, b, item[1], item[2]) if item[0] == "seg" else _seg_circ(a, b, item[1], item[2])
        ts = sorted(set(ts))
        out = []
        for t0, t1 in zip(ts[:-1], ts[1:]):
            if t1 - t0 < 1e-12:
                continue
            m = a + (b - a) * (t0 + t1) / 2
            if bool(contains(region, m)[0]) == inside:
                if out and abs(out[-1][1] - t0) < 1e-12:
                    out[-1][1] = t1
                else:
                    out.append([t0, t1])
        return [line(a + (b - a) * t0, a + (b - a) * t1, kind) for t0, t1 in out
                if np.linalg.norm(b - a) * (t1 - t0) > 1e-6]
    if g in ("arc", "circle"):
        cc, r = np.asarray(c["center"], float), c["r"]
        s, e = span_of(c)
        angs = []
        for item in bnd:
            if item[0] == "seg":
                angs += _circle_line_angles(cc, r, item[1], item[2])
            else:
                angs += _circle_circle_angles(cc, r, item[1], item[2])
        rel = sorted({(x - s) % 360.0 for x in angs if _in_span(x, s, e) or g == "circle"})
        cuts = [0.0] + [x for x in rel if 1e-9 < x < (e - s) - 1e-9] + [e - s]
        out = []
        for t0, t1 in zip(cuts[:-1], cuts[1:]):
            m = math.radians(s + (t0 + t1) / 2)
            p = cc + r * np.array([math.cos(m), math.sin(m)])
            if bool(contains(region, p)[0]) == inside:
                if out and abs(out[-1][1] - t0) < 1e-9:
                    out[-1][1] = t1
                else:
                    out.append([t0, t1])
        if g == "circle" and len(out) >= 2 and out[0][0] < 1e-9 and abs(out[-1][1] - 360) < 1e-9:
            first = out.pop(0)
            out[-1][1] = 360 + first[1]
        if len(out) == 1 and out[0][1] - out[0][0] >= 360 - 1e-9:
            return [dict(c)]
        return [arc(cc, r, s + t0, s + t1, kind) for t0, t1 in out if math.radians(t1 - t0) * r > 1e-6]
    # 折线：逐段裁剪后重新连接
    pts = [np.asarray(p, float) for p in c["points"]]
    pieces = []
    for a, b in zip(pts[:-1], pts[1:]):
        for seg in clip(line(a, b, kind), region, inside):
            p0, p1 = np.asarray(seg["from"]), np.asarray(seg["to"])
            if pieces and np.linalg.norm(pieces[-1][-1] - p0) < 1e-9:
                pieces[-1].append(p1)
            else:
                pieces.append([p0, p1])
    return [polyline(pc, kind) for pc in pieces]


def clip_all(curves, region, inside=True):
    out = []
    for c in curves:
        out.extend(clip(c, region, inside))
    return out


# ---------------------------------------------------------------- 合并

def _cluster(values, tol):
    """values: [(key, idx)] 已排序；按相邻差 ≤ tol 分组。"""
    groups, cur, last = [], [], None
    for v, i in values:
        if last is not None and v - last > tol:
            groups.append(cur)
            cur = []
        cur.append(i)
        last = v
    if cur:
        groups.append(cur)
    return groups


def _merge_intervals(iv, gap=TOL):
    iv = sorted(iv)
    out = []
    for a, b in iv:
        if out and a <= out[-1][1] + gap:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def _subtract(iv, cut, gap=TOL):
    out = []
    for a, b in iv:
        pieces = [[a, b]]
        for c0, c1 in cut:
            nxt = []
            for x0, x1 in pieces:
                if c1 <= x0 + gap or c0 >= x1 - gap:
                    nxt.append([x0, x1])
                    continue
                if c0 > x0 + gap:
                    nxt.append([x0, c0])
                if c1 < x1 - gap:
                    nxt.append([c1, x1])
            pieces = nxt
        out.extend(pieces)
    return [p for p in out if p[1] - p[0] > gap]


def merge(curves, priority=("visible", "hidden")):
    """合并共线重叠的直线、同心同半径的圆弧；同一位置的高优先级线型覆盖低优先级。"""
    lines, arcs, others = [], [], []
    for c in curves:
        (lines if c["geom"] == "line" else arcs if c["geom"] in ("arc", "circle") else others).append(c)
    out = []
    # 直线
    recs = []
    for c in lines:
        a, b = np.asarray(c["from"], float), np.asarray(c["to"], float)
        d = b - a
        L = float(np.linalg.norm(d))
        if L < 1e-6:
            continue
        th = math.atan2(d[1], d[0]) % math.pi
        if th > math.pi - 1e-7:
            th -= math.pi
        ux, uy = math.cos(th), math.sin(th)
        off = -uy * a[0] + ux * a[1]
        t0, t1 = sorted((ux * a[0] + uy * a[1], ux * b[0] + uy * b[1]))
        recs.append((th, off, t0, t1, c["type"]))
    order = sorted(range(len(recs)), key=lambda i: recs[i][0])
    for g in _cluster([(recs[i][0], i) for i in order], 1e-7):
        sub = sorted(g, key=lambda i: recs[i][1])
        for h in _cluster([(recs[i][1], i) for i in sub], TOL):
            th = sum(recs[i][0] for i in h) / len(h)
            off = sum(recs[i][1] for i in h) / len(h)
            ux, uy = math.cos(th), math.sin(th)
            taken = []
            types = {recs[i][4] for i in h}
            for kind in list(priority) + sorted(types - set(priority)):
                if kind not in types:
                    continue
                iv = _merge_intervals([[recs[i][2], recs[i][3]] for i in h if recs[i][4] == kind])
                if kind in priority:
                    iv = _subtract(iv, taken)
                    taken = _merge_intervals(taken + iv)
                for t0, t1 in iv:
                    p0 = (ux * t0 - uy * off, uy * t0 + ux * off)
                    p1 = (ux * t1 - uy * off, uy * t1 + ux * off)
                    out.append(line(p0, p1, kind))
    # 圆弧
    recs = []
    for c in arcs:
        s, e = span_of(c)
        recs.append((c["center"][0], c["center"][1], c["r"], s, e, c["type"]))
    order = sorted(range(len(recs)), key=lambda i: recs[i][0])
    for g in _cluster([(recs[i][0], i) for i in order], TOL):
        for g2 in _cluster(sorted([(recs[i][1], i) for i in g]), TOL):
            for h in _cluster(sorted([(recs[i][2], i) for i in g2]), TOL):
                cx = sum(recs[i][0] for i in h) / len(h)
                cy = sum(recs[i][1] for i in h) / len(h)
                r = sum(recs[i][2] for i in h) / len(h)
                types = {recs[i][5] for i in h}
                taken = []
                for kind in list(priority) + sorted(types - set(priority)):
                    if kind not in types:
                        continue
                    iv = []
                    for i in h:
                        if recs[i][5] != kind:
                            continue
                        s, e = recs[i][3], recs[i][4]
                        if e - s >= 360 - 1e-7:
                            iv.append([0.0, 360.0])
                            continue
                        s %= 360.0
                        e = s + (recs[i][4] - recs[i][3])
                        if e > 360:
                            iv += [[s, 360.0], [0.0, e - 360]]
                        else:
                            iv.append([s, e])
                    iv = _merge_intervals(iv, 1e-6)
                    if kind in priority:
                        iv = _subtract(iv, taken, 1e-6)
                        taken = _merge_intervals(taken + iv, 1e-6)
                    if len(iv) >= 2 and iv[0][0] < 1e-6 and iv[-1][1] > 360 - 1e-6:
                        first = iv.pop(0)
                        iv[-1][1] = 360 + first[1]
                    for s, e in iv:
                        out.append(arc((cx, cy), r, s, e, kind))
    out.extend(others)
    return out


# ---------------------------------------------------------------- 波浪线

def wave_runs(path, flags, amplitude, wavelength, kind="wave", min_points=2):
    """沿 path（N×2）上 flags 为真的连续段画波浪线。"""
    out = []
    n = len(path)
    if n < 2:
        return out
    closed = np.linalg.norm(path[0] - path[-1]) < 1e-9
    flags = np.asarray(flags, bool)
    if flags.all() and closed:
        runs = [list(range(n))]
    else:
        runs, cur = [], []
        for i in range(n):
            if flags[i]:
                cur.append(i)
            elif cur:
                runs.append(cur)
                cur = []
        if cur:
            if closed and runs and runs[0][0] == 0:
                runs[0] = cur + runs[0][1:]
            else:
                runs.append(cur)
    for run in runs:
        if len(run) < min_points:
            continue
        pts = path[run]
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        s = np.concatenate([[0], np.cumsum(seg)])
        if s[-1] < 1e-9:
            continue
        # 在每段上细分后加正弦偏移
        dense_s = np.linspace(0, s[-1], max(8, int(s[-1] / (wavelength / 12)) + 1))
        xs = np.interp(dense_s, s, pts[:, 0])
        ys = np.interp(dense_s, s, pts[:, 1])
        dx, dy = np.gradient(xs), np.gradient(ys)
        nrm = np.hypot(dx, dy) + 1e-300
        nx, ny = -dy / nrm, dx / nrm
        off = amplitude * np.sin(2 * math.pi * dense_s / wavelength)
        out.append(polyline(np.stack([xs + nx * off, ys + ny * off], axis=1), kind))
    return out
