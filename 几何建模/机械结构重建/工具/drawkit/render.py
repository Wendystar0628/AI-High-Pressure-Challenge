"""把图纸 JSON 画成 PNG（Pillow）。图纸、作答预览和比对叠图都用这一份渲染。

图纸坐标：毫米，原点在图幅左下角，y 向上。视图内坐标经视图的 scale 和
paper_origin（视图坐标 (0,0) 在图纸上的位置）换算到图纸。
"""
import math
import os
import re
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from . import geom2d as g2

SS = 2  # 超采样倍数，画完缩小以抗锯齿

THICK = 0.7   # 粗线宽（毫米）
THIN = 0.35   # 细线宽
STYLE = {
    "visible": (THICK, None),
    "hidden": (THIN, [3.0, 1.0]),
    "center": (THIN, [12.0, 1.5, 0.6, 1.5]),
    "wave": (THIN, None),
    "thin": (THIN, None),
    "cut": (THICK * 1.5, None),
    "frame": (0.7, None),
    "border": (THIN, None),
    "phantom": (THIN, [12.0, 1.5, 0.6, 1.5, 0.6, 1.5]),
}
LINE_TYPE_CN = {
    "visible": "粗实线：可见轮廓线",
    "hidden": "细虚线：不可见轮廓线",
    "center": "细点画线：轴线、对称中心线、孔的中心线、节圆",
    "wave": "波浪线（细实线）：局部剖视、局部视图、局部放大图的断裂边界",
    "thin": "细实线：尺寸线、尺寸界线、剖面线、指引线、局部放大范围圆",
    "cut": "粗短画：剖切位置符号",
    "phantom": "细双点画线：假想轮廓（相邻零件、工件、运动极限位置），不属于零件实体",
}

FONT_DIR = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
FONT_FILES = ["simfang.ttf", "seguisym.ttf"]   # 仿宋；缺字（如 ↧ ⌴ ⌵ Ø）时用符号字体
FONT_EM = 1.15  # 字号（毫米）→ 字体 em 大小的倍数


def _cmap(path):
    """读 TrueType 字体的字符表（格式 4 和 12），返回码位集合。"""
    import struct
    try:
        data = open(path, "rb").read()
    except OSError:
        return set()
    num = struct.unpack(">H", data[4:6])[0]
    tables = {}
    for i in range(num):
        tag, _, off, length = struct.unpack(">4sIII", data[12 + 16 * i:28 + 16 * i])
        tables[tag] = off
    if b"cmap" not in tables:
        return set()
    base = tables[b"cmap"]
    n = struct.unpack(">H", data[base + 2:base + 4])[0]
    codes = set()
    for i in range(n):
        pid, eid, off = struct.unpack(">HHI", data[base + 4 + 8 * i:base + 12 + 8 * i])
        sub = base + off
        fmt = struct.unpack(">H", data[sub:sub + 2])[0]
        if fmt == 4:
            segx2 = struct.unpack(">H", data[sub + 6:sub + 8])[0]
            ends = struct.unpack(f">{segx2 // 2}H", data[sub + 14:sub + 14 + segx2])
            starts = struct.unpack(f">{segx2 // 2}H", data[sub + 16 + segx2:sub + 16 + 2 * segx2])
            for a, b in zip(starts, ends):
                if a != 0xFFFF:
                    codes.update(range(a, b + 1))
        elif fmt == 12:
            ngroups = struct.unpack(">I", data[sub + 12:sub + 16])[0]
            for g in range(ngroups):
                a, b, _ = struct.unpack(">III", data[sub + 16 + 12 * g:sub + 28 + 12 * g])
                codes.update(range(a, b + 1))
    return codes


@lru_cache(maxsize=None)
def font_set():
    out = []
    for name in FONT_FILES:
        path = os.path.join(FONT_DIR, name)
        if os.path.exists(path):
            out.append((path, _cmap(path)))
    return out


@lru_cache(maxsize=512)
def font(px, index=0):
    fonts = font_set()
    if not fonts:
        return ImageFont.load_default()
    return ImageFont.truetype(fonts[min(index, len(fonts) - 1)][0], max(4, int(round(px))))


def text_runs(text):
    """按字体拆分文字：[(字体序号, 片段)]。"""
    fonts = font_set()
    runs = []
    for ch in str(text):
        idx = 0
        for i, (_, codes) in enumerate(fonts):
            if ord(ch) in codes:
                idx = i
                break
        if runs and runs[-1][0] == idx:
            runs[-1] = (idx, runs[-1][1] + ch)
        else:
            runs.append((idx, ch))
    return runs


def runs_length(runs, px):
    return sum(font(px, i).getlength(t) for i, t in runs)


def styled_runs(text):
    """尺寸编号比数值小一档；保留独立括号与空隙以免混淆。"""
    text = str(text)
    tag = re.match(r"〔D\d+〕\s*", text)
    if tag:
        return [(i,t,1.0) for i,t in text_runs(tag[0])] + [(i,t,1.0) for i,t in text_runs(text[tag.end():])]
    return [(i,t,1.0) for i,t in text_runs(text)]


def text_extent(text, height):
    """文字在图纸上的宽、高（毫米）。"""
    ref = 200.0
    w = sum(font(ref * FONT_EM * scale, i).getlength(t) for i,t,scale in styled_runs(text)) / ref * height
    return w, height


def xf_region(region, s, t):
    kind = region["shape"]
    if kind == "halfplane":
        n = np.asarray(region["n"], float)
        return {"shape": "halfplane", "n": list(n), "c": region["c"] * s + float(n @ np.asarray(t))}
    if kind == "rect":
        x0, y0, x1, y1 = region["box"]
        return {"shape": "rect", "box": [x0 * s + t[0], y0 * s + t[1], x1 * s + t[0], y1 * s + t[1]]}
    if kind == "circle":
        c = region["center"]
        return {"shape": "circle", "center": [c[0] * s + t[0], c[1] * s + t[1]], "r": region["r"] * s}
    return {"shape": "polygon", "points": [[p[0] * s + t[0], p[1] * s + t[1]] for p in region["points"]]}


class Canvas:
    def __init__(self, width_mm, height_mm, dpi, mode="L"):
        self.w_mm, self.h_mm, self.dpi = width_mm, height_mm, dpi
        self.k = dpi / 25.4 * SS
        self.size = (int(round(width_mm * dpi / 25.4)), int(round(height_mm * dpi / 25.4)))
        self.mode = mode
        bg = 255 if mode == "L" else (255, 255, 255)
        self.img = Image.new(mode, (self.size[0] * SS, self.size[1] * SS), bg)
        self.draw = ImageDraw.Draw(self.img)

    def px(self, p):
        return (p[0] * self.k, (self.h_mm - p[1]) * self.k)

    def ink(self, color):
        if self.mode == "L":
            if isinstance(color, tuple):
                return int(round(0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]))
            return color
        return color if isinstance(color, tuple) else (color, color, color)

    def polyline(self, pts, width_mm, color=0):
        if len(pts) < 2:
            return
        w = max(1, int(round(width_mm * self.k)))
        xy = [self.px(p) for p in pts]
        self.draw.line(xy, fill=self.ink(color), width=w, joint="curve")
        if w >= 3:
            r = w / 2.0
            for x, y in (xy[0], xy[-1]):
                self.draw.ellipse([x - r, y - r, x + r, y + r], fill=self.ink(color))

    def curve(self, c, color=0, width=None, pattern="auto"):
        kind = c.get("type", "thin")
        lw, dash = STYLE.get(kind, (THIN, None))
        if width is not None:
            lw = width
        if pattern != "auto":
            dash = pattern
        step = 0.15
        pts = g2.sample(c, step) if c["geom"] in ("arc", "circle") else np.asarray(
            c["points"] if c["geom"] == "polyline" else [c["from"], c["to"]], float)
        if dash is None:
            self.polyline(pts, lw, color)
            return
        for run in dash_runs(pts, dash):
            self.polyline(run, lw, color)

    def polygon(self, pts, color=0):
        self.draw.polygon([self.px(p) for p in pts], fill=self.ink(color))

    def text(self, text, at, height, anchor="mm", angle=0.0, color=0):
        text = str(text)
        if not text:
            return
        px = height * FONT_EM * self.k
        runs = styled_runs(text)
        tw = sum(font(px * scale, i).getlength(t) for i,t,scale in runs)
        th = height * self.k
        pad = int(th)
        W, H = int(tw + 2 * pad), int(th + 2 * pad)
        layer = Image.new("L", (W, H), 0)
        dl = ImageDraw.Draw(layer)
        x = pad
        for i, t, scale in runs:
            f = font(px * scale, i)
            dl.text((x, pad + th / 2), t, font=f, fill=255, anchor="lm")
            x += f.getlength(t)
        ax = pad + {"l": 0.0, "m": 0.5, "r": 1.0}[anchor[0]] * tw
        ay = pad + {"t": 0.0, "m": 0.5, "b": 1.0}[anchor[1]] * th
        if abs(angle) > 1e-6:
            rot = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
            a = math.radians(angle)
            dx, dy = ax - W / 2, ay - H / 2
            nx = dx * math.cos(a) + dy * math.sin(a)
            ny = -dx * math.sin(a) + dy * math.cos(a)
            ax, ay = rot.size[0] / 2 + nx, rot.size[1] / 2 + ny
            layer = rot
        x, y = self.px(at)
        solid = Image.new(self.mode, layer.size, self.ink(color))
        self.img.paste(solid, (int(round(x - ax)), int(round(y - ay))), layer)

    def arrow(self, tip, direction, size=3.0, color=0):
        d = np.asarray(direction, float)
        d = d / (np.linalg.norm(d) + 1e-300)
        n = np.array([-d[1], d[0]])
        tip = np.asarray(tip, float)
        base = tip - d * size
        self.polygon([tip, base + n * size / 6.0, base - n * size / 6.0], color)

    def dot(self, at, r=0.6, color=0):
        x, y = self.px(at)
        rr = r * self.k
        self.draw.ellipse([x - rr, y - rr, x + rr, y + rr], fill=self.ink(color))

    def image(self):
        return self.img.resize(self.size, Image.LANCZOS)


def dash_runs(pts, pattern):
    pts = np.asarray(pts, float)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    total = s[-1]
    if total < 1e-9:
        return []
    period = sum(pattern)
    # 让两端尽量都落在长画上：起点相位居中
    start = -((total % period) - pattern[0]) / 2 if total > period else 0.0
    runs = []
    pos = start
    i = 0
    while pos < total:
        L = pattern[i % len(pattern)]
        if i % 2 == 0:
            a, b = max(0.0, pos), min(total, pos + L)
            if b - a > 1e-6:
                ts = np.concatenate([[a], s[(s > a) & (s < b)], [b]])
                xs = np.interp(ts, s, pts[:, 0])
                ys = np.interp(ts, s, pts[:, 1])
                runs.append(np.stack([xs, ys], axis=1))
        pos += L
        i += 1
    return runs


def hatch_segments(loops, angle, spacing, phase=0.0):
    """在多个闭合环（奇偶规则）内按 angle、spacing 生成剖面线段（同一坐标系）。"""
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)
    rot = lambda p: (p[:, 0] * ca + p[:, 1] * sa, -p[:, 0] * sa + p[:, 1] * ca)
    edges = []
    for lp in loops:
        p = np.asarray(lp, float)
        if len(p) < 3:
            continue
        x, y = rot(p)
        x2, y2 = np.roll(x, -1), np.roll(y, -1)
        edges.append(np.stack([x, y, x2, y2], axis=1))
    if not edges:
        return []
    E = np.concatenate(edges)
    ymin, ymax = min(E[:, 1].min(), E[:, 3].min()), max(E[:, 1].max(), E[:, 3].max())
    out = []
    k0 = math.ceil((ymin - phase) / spacing)
    k1 = math.floor((ymax - phase) / spacing)
    for k in range(k0, k1 + 1):
        yy = phase + k * spacing
        m = (E[:, 1] > yy) != (E[:, 3] > yy)
        if not m.any():
            continue
        e = E[m]
        xs = np.sort(e[:, 0] + (yy - e[:, 1]) * (e[:, 2] - e[:, 0]) / (e[:, 3] - e[:, 1]))
        for x0, x1 in zip(xs[0::2], xs[1::2]):
            if x1 - x0 > 1e-6:
                p0 = (x0 * ca - yy * sa, x0 * sa + yy * ca)
                p1 = (x1 * ca - yy * sa, x1 * sa + yy * ca)
                out.append((p0, p1))
    return out


def view_xf(view):
    pl = view["placement"]
    return float(pl["scale"]), pl["paper_origin"]


def draw_hatches(cv, view, color=0):
    s, t = view_xf(view)
    for h in view.get("hatches", []):
        loops = [[[p[0] * s + t[0], p[1] * s + t[1]] for p in lp] for lp in h["loops"]]
        segs = hatch_segments(loops, h.get("angle", 45), h.get("spacing", 3.0))
        clips = [xf_region(r, s, t) for r in h.get("clip", [])]
        excl = [xf_region(r, s, t) for r in h.get("exclude", [])]
        for p0, p1 in segs:
            pieces = [g2.line(p0, p1, "thin")]
            for r in clips:
                pieces = g2.clip_all(pieces, r)
            for r in excl:
                pieces = g2.clip_all(pieces, r, inside=False)
            for c in pieces:
                cv.curve(c, color)


def draw_marks(cv, marks, s, t, color=0):
    for m in marks:
        kind = m["kind"]
        if kind == "curve":
            cv.curve(g2.xform(m["curve"], s, t), color)
        elif kind == "arrow":
            tip = [m["tip"][0] * s + t[0], m["tip"][1] * s + t[1]]
            cv.arrow(tip, m["dir"], m.get("size", 3.0), color)
        elif kind == "dot":
            cv.dot([m["at"][0] * s + t[0], m["at"][1] * s + t[1]], m.get("r", 0.6), color)
        elif kind == "text":
            cv.text(m["text"], [m["at"][0] * s + t[0], m["at"][1] * s + t[1]], m.get("height", 3.5),
                    m.get("anchor", "mm"), m.get("angle", 0.0), color)


ORDER = ["thin", "wave", "hidden", "center", "visible"]


def draw_view(cv, view, color=0, dims=True, marks=True, lines=None):
    s, t = view_xf(view)
    draw_hatches(cv, view, color)
    curves = view["lines"] if lines is None else lines
    for kind in ORDER:
        for c in curves:
            if c["type"] == kind:
                cv.curve(g2.xform(c, s, t), color)
    for c in curves:
        if c["type"] not in ORDER:
            cv.curve(g2.xform(c, s, t), color)
    if marks:
        draw_marks(cv, view.get("annotations", []), s, t, color)
    if dims:
        for d in view.get("dimensions", []):
            draw_marks(cv, d["draw"], s, t, color)


def render_sheet(sheet, dpi=None, mode="L", color=0, dims=True, view_lines=None, skip_marks=()):
    """view_lines：{视图名: 线条列表}，用于替换视图的几何（作答预览）。"""
    paper = sheet["paper"]
    cv = Canvas(paper["width"], paper["height"], dpi or sheet.get("dpi", 200), mode)
    draw_marks(cv, sheet.get("sheet_marks", []), 1.0, (0.0, 0.0), color)
    for view in sheet["views"]:
        lines = None if view_lines is None else view_lines.get(view["name"], [])
        if view_lines is not None:
            v = dict(view, hatches=view_lines.get(view["name"] + "#hatches", []))
        else:
            v = view
        ann = [m for m in v.get("annotations", []) if m.get("role") not in skip_marks]
        draw_view(cv, dict(v, annotations=ann), color, dims=dims, lines=lines)
    return cv
