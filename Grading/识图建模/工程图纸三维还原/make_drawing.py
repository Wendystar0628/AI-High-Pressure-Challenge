"""出图程序：参考建模描述 + 出图规格 → 240 dpi工程图PNG、公开尺寸/视图JSON与出题端私有图线JSON。

用法：
  python make_drawing.py 出图规格/01.json                    # 参考描述默认取 参考答案/第01题.json
  python make_drawing.py 出图规格/01.json --ref X.json --out 输出目录 --dpi 200
  python make_drawing.py --all                                # 出图规格/ 下全部
出图规格的写法见本目录 README.md。输出默认写到 识图建模/工程图纸三维还原/<题号>/。
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[2] / "识图建模" / "工程图纸三维还原"
sys.path.insert(0, str(PUBLIC / "工具"))
from drawkit import geom2d as g2  # noqa: E402
from drawkit import model, project, render  # noqa: E402

BASIC = {
    "front": ("主视图", (0, 1, 0), (1, 0, 0), (0, 0, 1), (1, 1)),
    "top": ("俯视图", (0, 0, -1), (1, 0, 0), (0, 1, 0), (2, 1)),
    "left": ("左视图", (1, 0, 0), (0, -1, 0), (0, 0, 1), (1, 2)),
    "right": ("右视图", (-1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 0)),
    "bottom": ("仰视图", (0, 0, 1), (1, 0, 0), (0, -1, 0), (0, 1)),
    "rear": ("后视图", (0, -1, 0), (-1, 0, 0), (0, 0, 1), (1, 3)),
}
PAPERS = {"A4": (210, 297, 25, 5), "A3": (420, 297, 25, 5), "A2": (594, 420, 25, 10), "A1": (841, 594, 25, 10)}
SCALES = [5, 4, 2.5, 2, 1, 1 / 1.5, 1 / 2, 1 / 2.5, 1 / 3, 1 / 4, 1 / 5]
DIM_H = 9.0        # 尺寸数字字高
LABEL_H = 9.0      # 视图名称字高
ARROW = 3.0        # 箭头长
EXT_GAP = 1.0      # 尺寸界线与轮廓的间隙
EXT_OVER = 2.0     # 尺寸界线超出尺寸线
LEVEL0 = 12.0       # 第一道尺寸线离轮廓
LEVEL_STEP = 14.0   # 相邻尺寸线间距
VIEW_GAP = 12.0    # 视图间距
TB_W, TB_H = 180.0, 32.0
PL_ROW = 7.0
ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ"]
HATCH_STYLES = [(45, 3.0), (135, 3.0), (45, 1.8), (135, 1.8), (60, 3.0), (120, 3.0)]


class SpecError(Exception):
    pass


WARN = []


def warn(msg):
    WARN.append(msg)


def flush_warnings():
    seen = []
    for m in WARN:
        if m not in seen:
            seen.append(m)
            print("警告：" + m)
    WARN.clear()


def scale_text(s):
    if s >= 1:
        return f"{model.fmt(s)}:1"
    return f"1:{model.fmt(1 / s)}"


# ---------------------------------------------------------------- 小工具

def box_union(a, b):
    if a is None:
        return b
    if b is None:
        return a
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


def box_pts(pts):
    pts = np.asarray(pts, float)
    return [float(pts[:, 0].min()), float(pts[:, 1].min()), float(pts[:, 0].max()), float(pts[:, 1].max())]


def box_overlap(a, b, margin=0.0):
    return not (a[2] + margin <= b[0] or b[2] + margin <= a[0] or a[3] + margin <= b[1] or b[3] + margin <= a[1])


def text_box(text, at, h, anchor="mm", angle=0.0):
    w, hh = render.text_extent(text, h)
    ax = {"l": 0.0, "m": 0.5, "r": 1.0}[anchor[0]] * w
    ay = {"t": 1.0, "m": 0.5, "b": 0.0}[anchor[1]] * hh
    corners = np.array([[0, 0], [w, 0], [w, hh], [0, hh]]) - [ax, ay]
    a = math.radians(angle)
    rot = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    return box_pts(corners @ rot.T + np.asarray(at))


class Occupancy:
    """视图周围的占用栅格（局部图纸坐标，0.5 毫米一格），用来给文字、引线找不压线的位置。"""
    RES = 0.5

    def __init__(self, box, margin=100.0):
        self.x0, self.y0 = box[0] - margin, box[1] - margin
        self.nx = int((box[2] - box[0] + 2 * margin) / self.RES) + 1
        self.ny = int((box[3] - box[1] + 2 * margin) / self.RES) + 1
        self.g = np.zeros((self.ny, self.nx), np.float32)
        self.text_g = np.zeros_like(self.g)

    def _ij(self, pts):
        pts = np.atleast_2d(pts)
        i = ((pts[:, 0] - self.x0) / self.RES).astype(int)
        j = ((pts[:, 1] - self.y0) / self.RES).astype(int)
        ok = (i >= 0) & (i < self.nx) & (j >= 0) & (j < self.ny)
        return i[ok], j[ok]

    def add_curve(self, c, w=1.0):
        i, j = self._ij(g2.sample(c, 0.25))
        self.g[j, i] = np.maximum(self.g[j, i], w)

    def _slice(self, box, inset=0.0):
        i0 = int(np.floor((box[0] + inset - self.x0) / self.RES))
        i1 = int(np.ceil((box[2] - inset - self.x0) / self.RES))
        j0 = int(np.floor((box[1] + inset - self.y0) / self.RES))
        j1 = int(np.ceil((box[3] - inset - self.y0) / self.RES))
        return slice(max(0, j0), max(0, min(self.ny, j1))), slice(max(0, i0), max(0, min(self.nx, i1)))

    def add_box(self, box, w=4.0):
        sj, si = self._slice(box)
        self.g[sj, si] += w

    def add_text(self, box):
        sj, si = self._slice(box)
        self.g[sj, si] += 20.0
        self.text_g[sj, si] = 1.0

    def crosses_text(self, a, b):
        i, j = self._ij(g2.sample(g2.line(a, b, "x"), 0.25))
        return float(self.text_g[j, i].sum())

    def add_fill(self, loops, w=0.5):
        b = box_pts(np.concatenate([np.asarray(lp, float) for lp in loops]))
        sj, si = self._slice(b)
        if sj.stop <= sj.start or si.stop <= si.start:
            return
        jj, ii = np.mgrid[sj, si]
        pts = np.stack([self.x0 + (ii.ravel() + 0.5) * self.RES, self.y0 + (jj.ravel() + 0.5) * self.RES], axis=1)
        inside = np.zeros(len(pts), bool)
        for lp in loops:
            inside ^= g2.contains({"shape": "polygon", "points": lp}, pts)
        sub = self.g[sj, si].ravel()
        sub[inside] = np.maximum(sub[inside], w)
        self.g[sj, si] = sub.reshape(self.g[sj, si].shape)

    def cost(self, box, inset=0.3):
        sj, si = self._slice(box, inset)
        return float(self.g[sj, si].sum())

    def line_cost(self, a, b):
        i, j = self._ij(g2.sample(g2.line(a, b, "x"), 0.25))
        return float(self.g[j, i].sum()) * 0.5


class Marks:
    """视图内的标注图元，坐标先用"局部图纸坐标"（视图坐标 × 比例），最后换回视图坐标。
    occ 不为空时，画上的图元同时登记到占用栅格。"""

    def __init__(self, occ=None):
        self.items = []
        self.box = None
        self.occ = occ

    def curve(self, c, role=None):
        self.items.append({"kind": "curve", "curve": c, "role": role})
        self.box = box_union(self.box, g2.bounds([c]))
        if self.occ is not None:
            self.occ.add_curve(c, 1.0)

    def line(self, a, b, kind="thin", role=None):
        self.curve(g2.line(a, b, kind), role)

    def arrow(self, tip, d, role=None, size=ARROW):
        d = np.asarray(d, float)
        d = d / np.linalg.norm(d)
        self.items.append({"kind": "arrow", "tip": g2.P(tip), "dir": g2.P(d), "size": size, "role": role})
        self.box = box_union(self.box, box_pts([tip, np.asarray(tip) - d * size]))
        if self.occ is not None:
            self.occ.add_box(box_pts([tip, np.asarray(tip) - d * size]), 1.0)

    def dot(self, at, role=None, r=0.6):
        self.items.append({"kind": "dot", "at": g2.P(at), "r": r, "role": role})

    def text(self, text, at, h=None, anchor="mm", angle=0.0, role=None):
        h = DIM_H if h is None else h
        self.items.append({"kind": "text", "text": str(text), "at": g2.P(at), "height": h,
                           "anchor": anchor, "angle": float(angle), "role": role})
        tb = text_box(text, at, h, anchor, angle)
        self.box = box_union(self.box, tb)
        if self.occ is not None:
            self.occ.add_text([tb[0] - 0.8, tb[1] - 0.8, tb[2] + 0.8, tb[3] + 0.8])

    def to_view(self, s):
        out = []
        for m in self.items:
            m = dict(m)
            if m["kind"] == "curve":
                m["curve"] = g2.xform(m["curve"], 1 / s, (0, 0))
                for key in ("from", "to", "center", "points"):
                    if key in m["curve"]:
                        m["curve"][key] = round_any(m["curve"][key])
                if "r" in m["curve"]:
                    m["curve"]["r"] = round(m["curve"]["r"], 6)
            for key in ("tip", "at"):
                if key in m:
                    m[key] = [round(m[key][0] / s, 6), round(m[key][1] / s, 6)]
            if m.get("role") is None:
                m.pop("role", None)
            out.append(m)
        return out


def round_any(v):
    if isinstance(v, (list, tuple)) and v and isinstance(v[0], (list, tuple)):
        return [[round(a, 6), round(b, 6)] for a, b in v]
    return [round(v[0], 6), round(v[1], 6)]


# ---------------------------------------------------------------- 视图解析

class View:
    def __init__(self, spec, index):
        self.spec = spec
        self.index = index
        self.kind = spec.get("type")
        self.name = None
        self.vdef = None
        self.grid = None
        self.parent = spec.get("parent")
        self.scale = None
        self.geom = None
        self.dims = []
        self.marks = Marks()
        self.extra_lines = []
        self.box_geom = None
        self.paper_origin = None


def resolve_views(sheet, part_names):
    views = []
    letters_used = set()
    for i, spec in enumerate(sheet.get("views", [])):
        v = View(spec, i)
        t = v.kind
        parts = spec.get("parts") or part_names
        if t in BASIC:
            name, d, u, vv, grid = BASIC[t]
            sec = spec.get("section")
            v.grid = None if (spec.get("at") or spec.get("free")) else grid
            vdef = {"kind": "basic", "direction": list(d), "u": list(u), "v": list(vv), "origin": [0, 0, 0],
                    "parts": parts, "hidden": spec.get("hidden", not sec), "section": None, "keep": spec.get("keep")}
            v.letter = None
            if sec:
                name = apply_section(v, vdef, sec, name)
            v.name = spec.get("name", name)
            v.vdef = vdef
        elif t == "auxiliary":
            d = np.asarray(spec["direction"], float)
            d /= np.linalg.norm(d)
            u, vv = project.frame_axes(d, spec.get("up", [0, 0, 1]))
            v.letter = spec.get("label", spec.get("name"))
            name = v.letter
            v.vdef = {"kind": "auxiliary", "direction": list(d), "u": list(u), "v": list(vv), "origin": [0, 0, 0],
                      "parts": parts, "hidden": spec.get("hidden", False), "section": None, "keep": spec.get("keep")}
            if spec.get("section"):
                name = apply_section(v, v.vdef, spec["section"], name)
            v.name = spec.get("name", name)
        elif t == "removed_section":
            d = np.asarray(spec["normal"], float)
            d /= np.linalg.norm(d)
            u, vv = project.frame_axes(d, spec.get("up", [0, 0, 1]))
            v.letter = spec.get("label")
            v.name = spec.get("name", f"{v.letter}-{v.letter}" if v.letter else "断面")
            v.vdef = {"kind": "removed_section", "direction": list(d), "u": list(u), "v": list(vv),
                      "origin": [0, 0, 0], "parts": parts, "hidden": False,
                      "section": {"point": spec["point"], "mode": "removed"}}
        elif t == "detail":
            v.letter = spec.get("label")
            v.name = spec.get("name", v.letter or "局部放大图")
            v.vdef = {"kind": "detail", "parts": parts,
                      "detail": {"parent": spec["parent"], "center": spec["center"], "r": spec["r"]}}
        else:
            raise SpecError(f"未知视图类型 {t}")
        views.append(v)
    names = [v.name for v in views]
    if len(set(names)) != len(names):
        raise SpecError(f"视图名称重复：{names}")
    # 局部放大图编号
    k = 0
    for v in views:
        if v.kind == "detail" and not v.letter:
            v.letter = ROMAN[k]
            v.name = v.spec.get("name", v.letter)
            k += 1
    return views


def apply_section(v, vdef, sec, name):
    mode = sec.get("mode", "full")
    letter = sec.get("label")
    s2 = {"point": sec.get("point", [0, 0, 0]), "mode": mode}
    if mode == "half":
        s2["half"] = sec["half"]
    if mode == "local":
        s2["region"] = sec["region"]
    for key in ("unsectioned", "no_hatch"):
        if sec.get(key):
            s2[key] = sec[key]
    vdef["section"] = s2
    if "hidden" not in v.spec:
        vdef["hidden"] = False
    if letter and mode != "local":
        name = f"{letter}-{letter}"
    v.parent = sec.get("parent")
    v.letter = letter
    return name


def view_by_name(views, name):
    for v in views:
        if v.name == name:
            return v
    raise SpecError(f"找不到视图 {name}")


_PROJECT_CACHE = {}


def project_all(views, shapes, scale):
    for v in views:
        if v.kind == "detail":
            continue
        v.scale = float(v.spec.get("scale", scale))
        v.vdef["scale"] = v.scale
        key=(tuple((n,hash(s)) for n,s in shapes.items()),json.dumps(v.vdef,sort_keys=True))
        if key not in _PROJECT_CACHE:
            _PROJECT_CACHE[key]=project.project_view(shapes,v.vdef)
        v.geom = _PROJECT_CACHE[key]
    for v in views:
        if v.kind != "detail":
            continue
        parent = view_by_name(views, v.vdef["detail"]["parent"])
        v.scale = float(v.spec["scale"])
        v.vdef.update({k: parent.vdef[k] for k in ("direction", "u", "v", "origin")})
        v.vdef["scale"] = v.scale
        v.vdef["parent_definition"] = {k: val for k, val in parent.vdef.items()}
        v.geom = project.project_view(shapes, v.vdef, parent=parent.geom)


# ---------------------------------------------------------------- 尺寸

def drawn_points(view, step=0.5):
    curves = list(view.geom["lines"])
    # 补充中心线也可作为尺寸基准，且与图纸导出的中心线一致。
    for mark in view.marks.items:
        if mark.get("role") == "centerline" and mark.get("kind") == "curve":
            curves.append(g2.xform(mark["curve"], 1 / view.scale, (0, 0)))
    pts = [g2.sample(c, step) for c in curves]
    return np.concatenate(pts) if pts else np.zeros((0, 2))


def check_point(view, p, what):
    from scipy.spatial import cKDTree
    if not hasattr(view, "_tree"):
        pts = drawn_points(view, 0.05)
        view._tree = cKDTree(pts) if len(pts) else None
    if view._tree is None:
        return
    d, _ = view._tree.query(p)
    if d > 0.05:
        WARN.append(f"{view.name} 的尺寸 {what} 端点 ({model.fmt(p[0])}, {model.fmt(p[1])}) 不在图线上（最近 {d:.2f}）")


def dim_text(spec, value, default_prefix=""):
    if "text" in spec:
        text = str(spec["text"])
    else:
        text = f"{spec.get('prefix', default_prefix)}{model.fmt(value)}{spec.get('suffix', '')}"
    if spec.get("reference"):
        text = f"({text})"
    return (f"〔{spec['_id']}〕 " if spec.get("_id") else "") + text


class Stack:
    def __init__(self):
        self.levels = {"top": [], "bottom": [], "left": [], "right": []}

    def place(self, side, lo, hi):
        levels = self.levels[side]
        for k, occ in enumerate(levels):
            if all(hi <= a - 0.5 or lo >= b + 0.5 for a, b in occ):
                occ.append((lo, hi))
                return k
        levels.append([(lo, hi)])
        return len(levels) - 1


def linear_dims(view, specs, s):
    """线性尺寸：自动分道排布在视图轮廓外侧（剖切符号、箭头之外）。"""
    gb = view.box_geom
    outer = gb
    for m in view.marks.items:
        if m.get("role") in ("section", "aux", "origin"):
            mb = Marks()
            mb.items = []
            if m["kind"] == "curve":
                outer = box_union(outer, g2.bounds([m["curve"]]))
            elif m["kind"] == "text":
                outer = box_union(outer, text_box(m["text"], m["at"], m["height"], m["anchor"], m["angle"]))
    stack = Stack()
    jobs = []
    for spec in specs:
        p1, p2 = np.asarray(spec["from"], float), np.asarray(spec["to"], float)
        if spec.get("snap"):
            ax = 0 if spec["dir"] == "h" else 1
            samples=[g2.sample(c,0.15) for c in view.geom["lines"]]
            def witness(p):
                candidates=[]
                for pts in samples:
                    for a,b in zip(pts,pts[1:]):
                        da,db=a[ax]-p[ax],b[ax]-p[ax]
                        if abs(da)<1e-6:candidates.append(a)
                        if da*db<0:candidates.append(a+(b-a)*(-da)/(db-da))
                    if len(pts) and abs(pts[-1,ax]-p[ax])<1e-6:candidates.append(pts[-1])
                # 理论交线因倒圆消失时，保留辅助尺寸界线的理论位置。
                return min(candidates,key=lambda q:np.linalg.norm(q-p)) if candidates else p
            p1,p2=witness(p1),witness(p2)
        check_point(view, p1, spec.get("text", f"{model.fmt(abs(p2[0]-p1[0]))}/{model.fmt(abs(p2[1]-p1[1]))}"))
        check_point(view, p2, spec.get("text", f"{model.fmt(abs(p2[0]-p1[0]))}/{model.fmt(abs(p2[1]-p1[1]))}"))
        d = spec.get("dir")
        if d is None:
            side0 = spec.get("side")
            if side0 in ("top", "bottom"):
                d = "h"
            elif side0 in ("left", "right"):
                d = "v"
            else:
                d = "h" if abs(p1[1] - p2[1]) < 1e-9 else "v" if abs(p1[0] - p2[0]) < 1e-9 else "a"
        value = abs(p2[0] - p1[0]) if d == "h" else abs(p2[1] - p1[1]) if d == "v" else float(np.linalg.norm(p2 - p1))
        text = dim_text(spec, value)
        q1, q2 = p1 * s, p2 * s
        if d == "a":
            aligned_dim(view, spec, q1, q2, text, value)
            continue
        side = spec.get("side")
        if side is None:
            if d == "h":
                side = "top" if (gb[3] - max(q1[1], q2[1])) < (min(q1[1], q2[1]) - gb[1]) else "bottom"
            else:
                side = "right" if (gb[2] - max(q1[0], q2[0])) < (min(q1[0], q2[0]) - gb[0]) else "left"
        if (d == "h") != (side in ("top", "bottom")):
            raise SpecError(f"{view.name} 尺寸 {text}：dir={d} 与 side={side} 不匹配")
        ax = 0 if d == "h" else 1
        span = abs(q2[ax] - q1[ax])
        jobs.append((span, spec, q1, q2, d, side, text, value))
    jobs.sort(key=lambda j: j[0])
    for span, spec, q1, q2, d, side, text, value in jobs:
        ax = 0 if d == "h" else 1
        a, b = sorted((q1[ax], q2[ax]))
        tw, _ = render.text_extent(text, DIM_H)
        inside = b - a >= tw + 2 * ARROW + 1.5
        arrows_in = b - a >= 2 * ARROW + 1.0
        lo, hi = a, b
        if not inside:
            hi = b + (ARROW + 2 if not arrows_in else 1) + tw + 1
            lo = a - (ARROW + 2 if not arrows_in else 1) - tw - 1
        if not arrows_in:
            lo = min(lo, a - ARROW - 2)
        sgn = 1 if side in ("top", "right") else -1
        edge = (outer[3] if side == "top" else outer[1]) if d == "h" else (outer[2] if side == "right" else outer[0])
        if "offset" in spec:
            far = max(q1[1 - ax], q2[1 - ax]) if sgn > 0 else min(q1[1 - ax], q2[1 - ax])
            pos = far + sgn * float(spec["offset"])
        else:
            k = stack.place(side, lo, hi)
            pos = edge + sgn * (LEVEL0 + LEVEL_STEP * k)
        P = (lambda t, n: (t, n)) if d == "h" else (lambda t, n: (n, t))
        occ = view.occ
        # 文字位置：先居中，压线时沿尺寸线挪动或移到尺寸界线外
        if d == "h":
            tbox = lambda tc: text_box(text, (tc, pos + 0.8), DIM_H, "mb")
        else:
            tbox = lambda tc: text_box(text, (pos - 0.8, tc), DIM_H, "mb", 90)
        mid = (a + b) / 2
        out_gap = (ARROW + 2 if not arrows_in else 1) + tw / 2 + 0.5
        cands = []
        if inside:
            lim = (b - a) / 2 - ARROW - tw / 2 - 0.5
            k = 0.0
            while k <= lim + 1e-9:
                cands += [(mid + k, k * 0.01), (mid - k, k * 0.01)] if k else [(mid, 0.0)]
                k += 1.0
        cands += [(b + out_gap, 3.0), (a - out_gap, 3.2)]
        best = min(cands, key=lambda c_: occ.cost(tbox(c_[0])) + c_[1])
        tc = best[0]
        m = Marks(occ)
        for q in (q1, q2):
            start = q[1 - ax] + sgn * EXT_GAP
            if (pos - start) * sgn > 0:
                m.line(P(q[ax], start), P(q[ax], pos + sgn * EXT_OVER))
        if arrows_in:
            m.line(P(a, pos), P(b, pos))
            m.arrow(P(a, pos), P(-1, 0) if d == "h" else (0, -1))
            m.arrow(P(b, pos), P(1, 0) if d == "h" else (0, 1))
        else:
            m.line(P(a - ARROW - 2, pos), P(b + ARROW + 2, pos))
            m.arrow(P(a, pos), P(1, 0) if d == "h" else (0, 1))
            m.arrow(P(b, pos), P(-1, 0) if d == "h" else (0, -1))
        if tc > b:
            m.line(P(b, pos), P(tc + tw / 2 + 0.5, pos))
        elif tc < a:
            m.line(P(tc - tw / 2 - 0.5, pos), P(a, pos))
        if d == "h":
            m.text(text, (tc, pos + 0.8), anchor="mb")
        else:
            m.text(text, (pos - 0.8, tc), anchor="mb", angle=90)
        view.dims.append({"reference": bool(spec.get("reference", False)), "type": "linear", "dir": d, "text": text, "value": round(value, 6),
                          "from": g2.P(q1 / s), "to": g2.P(q2 / s), "marks": m})


def aligned_dim(view, spec, q1, q2, text, value):
    e = (q2 - q1) / np.linalg.norm(q2 - q1)
    nrm = np.array([-e[1], e[0]])
    if spec.get("side", "left") == "right":
        nrm = -nrm
    off = float(spec.get("offset", 10.0))
    a1, a2 = q1 + nrm * off, q2 + nrm * off
    m = Marks(view.occ)
    m.line(q1 + nrm * EXT_GAP, a1 + nrm * EXT_OVER)
    m.line(q2 + nrm * EXT_GAP, a2 + nrm * EXT_OVER)
    m.line(a1, a2)
    m.arrow(a1, -e)
    m.arrow(a2, e)
    ang = math.degrees(math.atan2(e[1], e[0]))
    if ang > 90 + 1e-6:
        ang -= 180
    if ang <= -90 + 1e-6:
        ang += 180
    up = np.array([-math.sin(math.radians(ang)), math.cos(math.radians(ang))])
    mid = (a1 + a2) / 2
    if up @ nrm >= 0:
        m.text(text, mid + up * 0.8, anchor="mb", angle=ang)
    else:
        m.text(text, mid - up * 0.8, anchor="mt", angle=ang)
    view.dims.append({"reference": bool(spec.get("reference", False)), "type": "linear", "dir": "a", "text": text, "value": round(value, 6),
                      "from": g2.P(q1 / view.scale), "to": g2.P(q2 / view.scale), "marks": m})


def shoulder_ops(start, e, text_lines):
    """引出线末端的水平折线和文字：返回图元计划。"""
    sgn = 1 if e[0] >= 0 else -1
    tw = max(render.text_extent(t, DIM_H)[0] for t in text_lines)
    start = np.asarray(start, float)
    end = start + [sgn * (tw + 2), 0]
    cx = (start[0] + end[0]) / 2
    ops = [("line", start, end, True)]
    ops.append(("text", text_lines[0], (cx, start[1] + 0.8), "mb"))
    for i, t in enumerate(text_lines[1:]):
        ops.append(("text", t, (cx, start[1] - 0.8 - i * (DIM_H + 1.5)), "mt"))
    return ops


def plan_cost(occ, ops):
    cost = 0.0
    for op in ops:
        if op[0] == "line" and op[3]:
            cost += occ.line_cost(op[1], op[2]) + 100000 * occ.crosses_text(op[1], op[2])
        elif op[0] == "text":
            cost += 10000 * occ.cost(text_box(op[1], op[2], DIM_H, op[3]))
    return cost


def apply_ops(m, ops):
    for op in ops:
        if op[0] == "line":
            m.line(op[1], op[2])
        elif op[0] == "arrow":
            m.arrow(op[1], op[2])
        elif op[0] == "dot":
            m.dot(op[1])
        else:
            m.text(op[1], op[2], anchor=op[3])


ANGLE_TRIES = [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90, 120, -120, 150, -150, 180]


def best_plan(occ, spec, make, base_angle, base_len):
    """在引线方向、长度上搜索不压线的布置；spec 写 "fixed": true 时不搜索。"""
    if spec.get("fixed"):
        return make(base_angle, base_len)
    best = None
    for da in ANGLE_TRIES:
        for j, extra in enumerate((0.0, 5.0, 10.0, 20.0, 35.0, 50.0, 70.0, 90.0)):
            ops = make(base_angle + da, base_len + extra)
            score = plan_cost(occ, ops) + 0.02 * abs(da) / 15 + 0.05 * j
            if spec.get('_avoid_box'):
                for op in ops:
                    if op[0]=='text' and box_overlap(text_box(op[1],op[2],DIM_H,op[3]),spec['_avoid_box'],3):
                        score+=1e12
            if best is None or score < best[0] - 1e-9:
                best = (score, ops)
        if best[0] < 0.05:
            break
    return best[1]


def circle_dim(view, spec, s, kind):
    if spec.get('avoid_box'):
        spec=dict(spec,_avoid_box=view.box_geom)
    c = np.asarray(spec["center"], float) * s
    if kind == "diameter":
        r = (spec["d"] / 2 if "d" in spec else spec["r"])
        value = 2 * r
        text = dim_text(spec, value, "Φ")
    else:
        r = spec["r"]
        value = r
        text = dim_text(spec, value, "R")
    rs = r * s

    def make(ang, lead):
        e = np.array([math.cos(math.radians(ang)), math.sin(math.radians(ang))])
        knee = c + e * (rs + lead)
        if kind == "diameter" and 2 * rs >= 12 and not spec.get("outside"):
            ops = [("line", c - e * rs, c + e * (rs + 1), False), ("line", c + e * (rs + 1), knee, True),
                   ("arrow", c + e * rs, e), ("arrow", c - e * rs, -e)]
        elif kind == "radius" and rs >= 8 and not spec.get("outside"):
            ops = [("line", c, c + e * (rs + 1), False), ("line", c + e * (rs + 1), knee, True),
                   ("arrow", c + e * rs, e)]
        else:
            ops = [("line", c + e * rs, c + e * (rs + 1.5), False), ("line", c + e * (rs + 1.5), knee, True),
                   ("arrow", c + e * rs, -e)]
        return ops + shoulder_ops(knee, e, [text])

    m = Marks(view.occ)
    apply_ops(m, best_plan(view.occ, spec, make, float(spec.get("angle", 45)), float(spec.get("length", 8.0))))
    view.dims.append({"reference": bool(spec.get("reference", False)), "type": kind, "text": text, "value": round(value, 6), "center": g2.P(c / s),
                      "r": round(r, 6), "marks": m})


def angle_dim(view, spec, s):
    o = np.asarray(spec["vertex"], float) * s
    p1 = np.asarray(spec["from"], float) * s
    p2 = np.asarray(spec["to"], float) * s
    a1 = math.degrees(math.atan2(*(p1 - o)[::-1]))
    a2 = math.degrees(math.atan2(*(p2 - o)[::-1]))
    span = (a2 - a1) % 360
    value = span
    text = dim_text(spec, value, "")
    if "text" not in spec:
        text = text + "°"
    R0 = float(spec.get("radius", 18.0))
    mid = math.radians(a1 + span / 2)
    em = np.array([math.cos(mid), math.sin(mid)])
    anchor = ("l" if em[0] > 0.3 else "r" if em[0] < -0.3 else "m") + ("b" if em[1] > 0.3 else "t" if em[1] < -0.3 else "m")
    R = min((R0 + k for k in (0, 5, 10, -4, 15)) if not spec.get("fixed") else [R0],
            key=lambda rr: view.occ.cost(text_box(text, o + em * (rr + 2.5), DIM_H, anchor)) + 0.01 * abs(rr - R0))
    m = Marks(view.occ)
    m.curve(g2.arc(o, R, a1, a1 + span, "thin"))
    for ang, p in ((a1, p1), (a2, p2)):
        L = np.linalg.norm(p - o)
        e = np.array([math.cos(math.radians(ang)), math.sin(math.radians(ang))])
        if L < R + 1:
            m.line(o + e * (L + EXT_GAP if L > 0.5 else 0), o + e * (R + EXT_OVER))
    for ang, sgn in ((a1, -1), (a1 + span, 1)):
        t = math.radians(ang)
        tip = o + R * np.array([math.cos(t), math.sin(t)])
        tangent = np.array([-math.sin(t), math.cos(t)]) * sgn
        m.arrow(tip, tangent)
    m.text(text, o + em * (R + 2.5), anchor=anchor)
    view.dims.append({"reference": bool(spec.get("reference", False)), "type": "angle", "text": text, "value": round(value, 6), "vertex": g2.P(o / s),
                      "from": g2.P(p1 / s), "to": g2.P(p2 / s), "marks": m})


def leader_dim(view, spec, s):
    point = np.asarray(spec["at"], float)
    # 基准尺寸的见证必须落在最终实体的图线/轴线上。切削工具伸出外缘、
    # 多个特征相交等情况会消去原来的见证点；沿同一基准位置移到实际图线上。
    if spec.get("category") == "线性坐标尺寸":
        axis = str(spec["text"][0])[0]
        component = 0 if axis == "X" else 1
        value = float(spec["value"])
        samples = [g2.sample(c, 0.08) for c in view.geom["lines"]]
        points = np.concatenate(samples) if samples else np.zeros((0, 2))
        if len(points) and np.linalg.norm(points-point, axis=1).min() > 0.15:
            candidates=[]
            for pts in samples:
                for a,b in zip(pts,pts[1:]):
                    da,db=a[component]-value,b[component]-value
                    if abs(da)<1e-7:candidates.append(a)
                    if da*db<0:
                        candidates.append(a+(b-a)*(-da)/(db-da))
                if len(pts) and abs(pts[-1,component]-value)<1e-7:candidates.append(pts[-1])
            if not candidates:
                raise SpecError(f"{view.name} 的基准尺寸{axis}={value}没有最终图线见证")
            point = min(candidates,key=lambda p:np.linalg.norm(p-point))
    at = point * s
    a = math.radians(spec.get("angle", 45))
    e = np.array([math.cos(a), math.sin(a)])
    lines = list(spec["text"]) if isinstance(spec["text"], list) else [spec["text"]]
    if spec.get("reference"):
        lines = ["(" + " ".join(lines) + ")"]
    if spec.get("_id"):
        lines[0] = f"〔{spec['_id']}〕 " + lines[0]

    def make(ang, length):
        e = np.array([math.cos(math.radians(ang)), math.sin(math.radians(ang))])
        knee = at + e * length
        ops = [("line", at, at + e * 1.5, False), ("line", at + e * 1.5, knee, True)]
        ops.append(("arrow", at, -e) if spec.get("end", "arrow") == "arrow" else ("dot", at))
        return ops + shoulder_ops(knee, e, lines)

    m = Marks(view.occ)
    apply_ops(m, best_plan(view.occ, spec, make, float(spec.get("angle", 45)), float(spec.get("length", 12.0))))
    view.dims.append({"reference": bool(spec.get("reference", False)), "type": "leader", "text": " ".join(lines), "lines": lines, "at": g2.P(at / s), "marks": m})


def build_dims(view, specs):
    s = view.scale
    lin = [d for d in specs if d.get("type", "linear") == "linear"]
    linear_dims(view, lin, s)
    for d in specs:
        t = d.get("type", "linear")
        if t in ("diameter", "radius"):
            if "center" in d:
                pts = np.asarray(d["center"], float)
                ok = any(c["geom"] in ("arc", "circle") and np.hypot(c["center"][0] - pts[0], c["center"][1] - pts[1]) < 1e-3
                         and abs(c["r"] - (d.get("d", 0) / 2 if t == "diameter" and "d" in d else d.get("r", 0))) < 1e-3
                         for c in view.geom["lines"])
                if not ok:
                    warn(f"{view.name} 的尺寸 {d.get('text', t)}：图上没有对应的圆或圆弧")
            circle_dim(view, d, s, t)
        elif t == "angle":
            angle_dim(view, d, s)
        elif t == "leader":
            leader_dim(view, d, s)
        elif t != "linear":
            raise SpecError(f"未知尺寸类型 {t}")

    catalog = {d.get("_id"): d for d in specs}
    for d in view.dims:
        match = re.match(r"〔(D\d+)〕\s*", d["text"])
        if not match:
            raise SpecError("尺寸缺少编号")
        d["id"] = match[1]
        d["text"] = d["text"][match.end():]
        source = catalog[d["id"]]
        if "value" in source:
            d["value"] = source["value"]
        if "category" in source:
            d["category"] = source["category"]
        d["source_feature"] = source.get("source_feature")


# ---------------------------------------------------------------- 标注：剖切符号、箭头、原点

def trace_symbol(parent, plane_point, direction, letter):
    """在父视图上画剖切位置（粗短画）、投射方向箭头和字母。"""
    s = parent.scale
    pj = project.Projector(parent.vdef)
    d = np.asarray(direction, float)
    n = np.array([d @ pj.u, d @ pj.v])
    if np.linalg.norm(n) < 0.99:
        warn(f"剖切面 {letter} 与 {parent.name} 不垂直，无法在 {parent.name} 上画剖切符号")
        return
    n /= np.linalg.norm(n)
    c = float((np.asarray(plane_point, float) - pj.o) @ d)
    t = np.array([-n[1], n[0]])
    gb = np.asarray(parent.box_geom).reshape(2, 2)
    corners = np.array([[gb[0, 0], gb[0, 1]], [gb[1, 0], gb[0, 1]], [gb[1, 0], gb[1, 1]], [gb[0, 0], gb[1, 1]]])
    # 用剖切线与真实轮廓的交点定位短画。斜断面不能取整张视图
    # 包围盒在切线方向上的极值，否则短画会远离被剖的细长斜臂。
    hits = []
    for curve in parent.geom["lines"]:
        if curve["type"] not in ("visible", "hidden"):
            continue
        points = g2.sample(curve, 0.1) * s
        for aa, bb in zip(points[:-1], points[1:]):
            da, db = aa @ n - c * s, bb @ n - c * s
            if da * db <= 0 and abs(da - db) > 1e-10:
                hit = aa + (bb - aa) * da / (da - db)
                hits.append(float(hit @ t))
            elif abs(da) < 1e-7:
                hits.append(float(aa @ t))
    ts = np.asarray(hits) if hits else corners @ t
    base = n * c * s
    m = parent.marks
    for sign, tt in ((-1, ts.min()), (1, ts.max())):
        p_in = base + t * (tt + sign * 1.5)
        p_out = base + t * (tt + sign * 7.5)
        m.line(p_in, p_out, "cut", role="section")
        m.line(p_out, p_out + n * 7, "thin", role="section")
        m.arrow(p_out + n * 7, n, role="section")
        m.text(letter, p_out + n * 7 + n * (2.0 + LABEL_H / 2) + t * sign * 0.5, LABEL_H, "mm", role="section")


def origin_marker(view):
    if view.kind not in BASIC:
        return
    pj = project.Projector(view.vdef)
    m = view.marks
    m.curve(g2.arc((0, 0), 1.2, 0, 360, "thin"), role="origin")
    axes = {}
    for name, e in (("X", (1, 0, 0)), ("Y", (0, 1, 0)), ("Z", (0, 0, 1))):
        d2 = np.array([np.dot(e, pj.u), np.dot(e, pj.v)])
        if np.linalg.norm(d2) > 0.99:
            axes[name] = [round(float(d2[0])), round(float(d2[1]))]
            tip = d2 * 18
            m.line(d2 * 1.2, tip, "thin", role="origin")
            m.arrow(tip, d2, role="origin", size=2.5)
            nrm = np.array([-d2[1], d2[0]])
            cands = [(tip + d2 * 1.5, "lm" if d2[0] > 0.5 else "rm" if d2[0] < -0.5 else ("mb" if d2[1] > 0 else "mt")),
                     (tip - d2 * 1.5 + nrm * 1.2, "mb" if abs(d2[0]) > 0.5 else ("rm" if nrm[0] < 0 else "lm")),
                     (tip - d2 * 1.5 - nrm * 1.2, "mt" if abs(d2[0]) > 0.5 else ("rm" if -nrm[0] < 0 else "lm"))]
            at, anchor = min(cands, key=lambda c_: view.occ.cost(text_box(name, c_[0], LABEL_H, c_[1])))
            m.text(name, at, LABEL_H, anchor, role="origin")
    cands = [((-4, 4), "rb"), ((-4, -4), "rt"), ((4, -4), "lt"), ((4, 4), "lb")]
    at, anchor = min(cands, key=lambda c_: view.occ.cost(text_box("O", c_[0], LABEL_H, c_[1])))
    m.text("O", at, LABEL_H, anchor, role="origin")
    view.axes = axes


# ---------------------------------------------------------------- 图框、标题栏、明细栏

def sheet_frame(paper, info, sheet_index, sheet_count, parts_list, notes):
    W,H,a,c=PAPERS[paper]
    m=Marks()
    m.curve(g2.polyline([(a,c),(W-c,c),(W-c,H-c),(a,H-c),(a,c)],'frame'))
    h=9.0 if paper=='A1' else 6.5
    m.text(f"{info['title']}  |  {info['problem_label']}  {sheet_index}/{sheet_count}",(a+6,c+6),h,'lb')
    m.text(f"第一角画法   单位mm   比例{info['scale_text']}   {info['drawing_no']}",(W-c-6,c+6),h,'rb')
    m.line((a,c+22),(W-c,c+22),'frame')
    y=H-c-8
    reserved=[[a,c,W-c,c+25]]
    # 技术要求行短而明确；文字放大不改变零件视图大小。
    for text in notes[1:]:
        m.text(text,(a+6,y),h,'lt'); y-=h+4
    reserved.append([a,H-c-4*(h+4)-10,W-c,H-c])
    if parts_list:
        labels=['装配明细：']+[f"{r['no']} {r['name']} ×{r['qty']}" for r in parts_list]
        line='  '.join(labels)
        # 每行三件，明细栏字号与其他文字一致。
        for k in range(0,len(labels),3):
            m.text('  '.join(labels[k:k+3]),(a+6,y),h,'lt'); y-=h+4
        reserved[-1][1]=y-6
    return m,(a,c+25,W-c,y-6),reserved


def view_extent(v):
    """视图在局部图纸坐标（视图原点为 0）下占的范围，含尺寸、标注、名称。"""
    b = None
    s = v.scale
    gb = getattr(v, "box_full", v.box_geom)
    b = box_union(b, gb)
    for d in v.dims:
        b = box_union(b, d["marks"].box)
    b = box_union(b, v.marks.box)
    return b


def add_label(v):
    b = view_extent(v)
    cx = (b[0] + b[2]) / 2 if v.kind not in BASIC else (v.box_geom[0] + v.box_geom[2]) / 2
    if v.kind == "detail":
        y = b[3] + 4
        tw = max(render.text_extent(v.letter, LABEL_H)[0], render.text_extent(scale_text(v.scale), DIM_H)[0])
        v.marks.text(scale_text(v.scale), (cx, y), DIM_H, "mb", role="label")
        v.marks.line((cx - tw / 2 - 1, y + DIM_H + 1), (cx + tw / 2 + 1, y + DIM_H + 1), role="label")
        v.marks.text(v.letter, (cx, y + DIM_H + 2), LABEL_H, "mb", role="label")
    else:
        v.marks.text(v.name, (cx, b[3] + 4), LABEL_H, "mb", role="label")
        if v.spec.get("rotated"):
            # 旋转配置的斜视图：字母旁画旋转符号（半圆箭头）
            tw = render.text_extent(v.name, LABEL_H)[0]
            c = np.array([cx + tw / 2 + 4.5, b[3] + 4 + LABEL_H / 2])
            r = LABEL_H / 2
            v.marks.curve(g2.arc(c, r, 0, 180, "thin"), role="label")
            ccw = v.spec.get("rotated") != "cw"
            v.marks.arrow(c + ([r, 0] if ccw else [-r, 0]), (0, -1), role="label", size=1.8)


def arrange(views, frame_box, reserved, placed_boxes=None):
    basics = [v for v in views if v.grid is not None]
    grids = [v.grid for v in basics]
    if len(set(grids)) != len(grids):
        raise SpecError("同一个基本视图位置上有两个视图；其中一个请加 \"free\": true 或 \"at\" 另行配置")
    ext = {v.name: view_extent(v) for v in views}
    occupied = list(reserved)
    rows = sorted({v.grid[0] for v in basics})
    cols = sorted({v.grid[1] for v in basics})
    L = {c: max(-ext[v.name][0] for v in basics if v.grid[1] == c) for c in cols}
    Rr = {c: max(ext[v.name][2] for v in basics if v.grid[1] == c) for c in cols}
    T = {r: max(ext[v.name][3] for v in basics if v.grid[0] == r) for r in rows}
    B = {r: max(-ext[v.name][1] for v in basics if v.grid[0] == r) for r in rows}
    xs, ys = {}, {}
    x = 0.0
    for i, c in enumerate(cols):
        if i:
            x += Rr[cols[i - 1]] + VIEW_GAP + L[c]
        xs[c] = x
    y = 0.0
    for i, r in enumerate(rows):
        if i:
            y -= B[rows[i - 1]] + VIEW_GAP + T[r]
        ys[r] = y
    fit = True
    if basics:
        cl = [xs[c] - L[c] for c in cols]
        cr = [xs[c] + Rr[c] for c in cols]
        ct = [ys[r] + T[r] for r in rows]
        cb = [ys[r] - B[r] for r in rows]
        cluster = [min(cl), min(cb), max(cr), max(ct)]
        cw, ch = cluster[2] - cluster[0], cluster[3] - cluster[1]
        fx0, fy0, fx1, fy1 = frame_box
        best = None
        ideal = ((fx0 + fx1) / 2, (fy0 + fy1) / 2 + 5)
        for ox in np.arange(fx0 + 5, fx1 - 5 - cw + 1e-9, 2.0):
            for oy in np.arange(fy0 + 5, fy1 - 5 - ch + 1e-9, 2.0):
                rect = [ox, oy, ox + cw, oy + ch]
                if any(box_overlap(rect, r, 3) for r in occupied):
                    continue
                dist = (ox + cw / 2 - ideal[0]) ** 2 + (oy + ch / 2 - ideal[1]) ** 2
                if best is None or dist < best[0]:
                    best = (dist, ox, oy)
        if best is None:
            fit = False
            best = (0, (fx0 + fx1) / 2 - cw / 2, (fy0 + fy1) / 2 - ch / 2)
        dx, dy = best[1] - cluster[0], best[2] - cluster[1]
        for v in basics:
            v.paper_origin = [xs[v.grid[1]] + dx, ys[v.grid[0]] + dy]
            e = ext[v.name]
            occupied.append([e[0] + v.paper_origin[0], e[1] + v.paper_origin[1],
                             e[2] + v.paper_origin[0], e[3] + v.paper_origin[1]])
    others = [v for v in views if v.grid is None]
    for v in others:
        e = ext[v.name]
        w, h = e[2] - e[0], e[3] - e[1]
        if v.spec.get("at"):
            cx, cy = v.spec["at"]
            v.paper_origin = [cx - (e[0] + e[2]) / 2, cy - (e[1] + e[3]) / 2]
            rect = [e[0] + v.paper_origin[0], e[1] + v.paper_origin[1],
                    e[2] + v.paper_origin[0], e[3] + v.paper_origin[1]]
            if rect[0] < frame_box[0] + 3 or rect[1] < frame_box[1] + 3 or rect[2] > frame_box[2] - 3 or rect[3] > frame_box[3] - 3:
                fit = False
            if any(box_overlap(rect, r, 2) for r in occupied):
                fit = False
        else:
            target = None
            if v.parent:
                pv = view_by_name(views, v.parent)
                if pv.paper_origin is not None:
                    pe = ext[pv.name]
                    target = ((pe[0] + pe[2]) / 2 + pv.paper_origin[0], (pe[1] + pe[3]) / 2 + pv.paper_origin[1])
            fx0, fy0, fx1, fy1 = frame_box
            if target is None:
                target = ((fx0 + fx1) / 2, (fy0 + fy1) / 2)
            best = None
            for ox in np.arange(fx0 + 4, fx1 - 4 - w + 1e-9, 2.0):
                for oy in np.arange(fy0 + 4, fy1 - 4 - h + 1e-9, 2.0):
                    rect = [ox, oy, ox + w, oy + h]
                    if any(box_overlap(rect, r, 4) for r in occupied):
                        continue
                    dist = (ox + w / 2 - target[0]) ** 2 + (oy + h / 2 - target[1]) ** 2
                    if best is None or dist < best[0]:
                        best = (dist, ox, oy)
            if best is None:
                fit = False
                best = (0, fx0 + 5, fy0 + 5)
            v.paper_origin = [best[1] - e[0], best[2] - e[1]]
        occupied.append([e[0] + v.paper_origin[0], e[1] + v.paper_origin[1],
                         e[2] + v.paper_origin[0], e[3] + v.paper_origin[1]])
    return fit


# ---------------------------------------------------------------- 整张图

def sheet_shapes(mdl, sheet):
    frame = sheet.get("frame", "part")
    if frame == "assembly":
        cache=getattr(mdl,'_drawing_placed',{})
        shapes={}
        for p in mdl.parts:
            stamp=(hash(p.shape),tuple(p.placement.ravel()))
            if p.name not in cache or cache[p.name][0]!=stamp:cache[p.name]=(stamp,p.placed())
            shapes[p.name]=cache[p.name][1]
        mdl._drawing_placed=cache
        return shapes, [p.name for p in mdl.parts]
    name = sheet.get("part", mdl.parts[0].name)
    part = mdl.part(name)
    if part is None:
        raise SpecError(f"参考描述中没有零件 {name}")
    return {name: part.shape}, [name]


def compose(sheet, mdl, scale, sheet_index, sheet_count, problem, problem_title):
    shapes, names = sheet_shapes(mdl, sheet)
    views = resolve_views(sheet, names)
    project_all(views, shapes, scale)
    for v in views:
        s = v.scale
        gb = project.geometry_bounds(v.geom)
        v.box_geom = [gb[0] * s, gb[1] * s, gb[2] * s, gb[3] * s]
        full = g2.bounds(v.geom["lines"]) or gb
        v.box_full = box_union(v.box_geom, [full[0] * s, full[1] * s, full[2] * s, full[3] * s])
        v.occ = Occupancy(v.box_geom)
        for c in v.geom["lines"]:
            v.occ.add_curve(g2.xform(c, s, (0, 0)), 0.8 if c["type"] == "center" else 1.0)
        for h in v.geom["hatches"]:
            if not h.get("clip"):
                v.occ.add_fill([[[p[0] * s, p[1] * s] for p in lp] for lp in h["loops"]], 0.5)
        v.marks.occ = v.occ
    # 跨图纸剖视的剖切位置：结果视图在另一张图上，本张仍给出剖切符号。
    for trace in sheet.get("section_traces", []):
        trace_symbol(view_by_name(views, trace["parent"]), trace["point"], trace["direction"], trace["label"])
    # 剖切符号、斜视图箭头、放大范围圆
    for v in views:
        if v.kind in ("auxiliary",) + tuple(BASIC) and v.vdef.get("section") and v.parent and v.letter                 and v.vdef["section"]["mode"] != "local":
            trace_symbol(view_by_name(views, v.parent), v.vdef["section"]["point"], v.vdef["direction"], v.letter)
        elif v.kind == "removed_section" and v.parent and v.letter:
            trace_symbol(view_by_name(views, v.parent), v.vdef["section"]["point"], v.vdef["direction"], v.letter)
        elif v.kind == "auxiliary" and v.parent:
            pv = view_by_name(views, v.parent)
            pj = project.Projector(pv.vdef)
            d = np.asarray(v.vdef["direction"])
            e = np.array([d @ pj.u, d @ pj.v])
            if np.linalg.norm(e) < 0.2:
                warn(f"斜视图 {v.name} 的投射方向与 {pv.name} 的图面几乎垂直")
            e /= np.linalg.norm(e)
            tip = np.asarray(v.spec.get("arrow_at", [0, 0]), float) * pv.scale
            tail = tip - e * 12
            pv.marks.line(tail, tip, role="aux")
            pv.marks.arrow(tip, e, role="aux")
            nrm = np.array([-e[1], e[0]])
            pv.marks.text(v.letter, tail - e * 2 + nrm * LABEL_H, LABEL_H, "mm", role="aux")
        elif v.kind == "detail":
            pv = view_by_name(views, v.vdef["detail"]["parent"])
            c = np.asarray(v.vdef["detail"]["center"], float) * pv.scale
            r = v.vdef["detail"]["r"] * pv.scale
            pv.marks.curve(g2.arc(c, r, 0, 360, "thin"), role="detail")
            e = np.array([math.cos(math.radians(55)), math.sin(math.radians(55))])
            pv.marks.line(c + e * r, c + e * (r + 7), role="detail")
            pv.marks.text(v.letter, c + e * (r + 7) + [0, 0.8], LABEL_H, "mb", role="detail")
    for v in views:
        origin_marker(v)
    # 补充中心线
    for cl in sheet.get("centerlines", []):
        v = view_by_name(views, cl["view"])
        a, b = np.asarray(cl["from"], float), np.asarray(cl["to"], float)
        e = (b - a) / np.linalg.norm(b - a)
        ext = cl.get("extend", 3.0)
        v.marks.line(a * v.scale - e * ext, b * v.scale + e * ext, "center", role="centerline")
    for ph in sheet.get("phantom", []):
        v = view_by_name(views, ph["view"])
        s = v.scale
        if "points" in ph:
            pts = [[p[0] * s, p[1] * s] for p in ph["points"]]
            if ph.get("closed"):
                pts.append(pts[0])
            v.marks.curve(g2.polyline(pts, "phantom"), role="phantom")
        else:
            c = [ph["center"][0] * s, ph["center"][1] * s]
            v.marks.curve(g2.arc(c, ph["r"] * s, ph.get("start", 0), ph.get("end", 360), "phantom"), role="phantom")
    # 尺寸
    for v in views:
        build_dims(v, [d for d in sheet.get("dimensions", []) if d.get("view") == v.name])
    # 零件序号
    balloons = sheet.get("balloons", [])
    for v in views:
        mine = [b for b in balloons if b.get("view") == v.name]
        if mine:
            place_balloons(v, mine)
    for v in views:
        add_label(v)
    return views


def place_balloons(v, items):
    gb = v.box_geom
    cx, cy = (gb[0] + gb[2]) / 2, (gb[1] + gb[3]) / 2
    sides = {"left": [], "right": [], "top": []}
    for b in items:
        at = np.asarray(b["at"], float) * v.scale
        side = b.get("side") or ("left" if at[0] < cx else "right")
        sides[side].append((b, at))
    for side, lst in sides.items():
        if not lst:
            continue
        if side == "top":
            lst.sort(key=lambda x: x[1][0])
            y = gb[3] + 10
            xs = [x[1][0] for x in lst]
            for i in range(1, len(xs)):
                xs[i] = max(xs[i], xs[i - 1] + 9)
            for (b, at), x in zip(lst, xs):
                v.marks.dot(at, role="balloon")
                v.marks.line(at, (x, y), role="balloon")
                v.marks.line((x - LABEL_H, y), (x + LABEL_H, y), role="balloon")
                v.marks.text(str(b["part"]), (x, y + 0.8), LABEL_H, "mb", role="balloon")
            continue
        lst.sort(key=lambda x: -x[1][1])
        x = (gb[0] - 12) if side == "left" else (gb[2] + 12)
        ys = [at[1] + 6 for _, at in lst]
        for i in range(1, len(ys)):
            ys[i] = min(ys[i], ys[i - 1] - 9)
        previous_y = float('inf')
        for (b, at), y in zip(lst, ys):
            y = min(y, previous_y - 9)
            x2 = x - 7 if side == "left" else x + 7
            # 尺寸先于序号绘制，序号也须避开已有的多行说明。
            dimension_marks = [m for d in v.dims for m in d['marks'].items]
            occupied = [text_box(m['text'], m['at'], m['height'], m['anchor'], m['angle'])
                        for m in v.marks.items + dimension_marks if m['kind'] == 'text']
            for _ in range(100):
                candidate = text_box(str(b['part']), ((x+x2)/2, y+0.8), LABEL_H, 'mb')
                if not any(box_overlap(candidate, other, 1.5) for other in occupied):
                    break
                y -= LABEL_H + 2
            previous_y = y
            v.marks.dot(at, role="balloon")
            v.marks.line(at, (x, y), role="balloon")
            x2 = x - 7 if side == "left" else x + 7
            v.marks.line((x, y), (x2, y), role="balloon")
            v.marks.text(str(b["part"]), ((x + x2) / 2, y + 0.8), LABEL_H, "mb", role="balloon")


def pick_scale(sheet, mdl, paper, sheet_index, sheet_count, problem, title, info, parts_list, notes):
    global DIM_H, LABEL_H, LEVEL_STEP
    DIM_H=9.0 if paper=='A1' else 6.5
    LABEL_H=DIM_H
    LEVEL_STEP=DIM_H+5
    spec_scale = sheet.get("scale", 1)
    candidates = [float(x) for x in spec_scale] if isinstance(spec_scale, list) else SCALES if spec_scale == "auto" else [float(spec_scale)]
    for sc in candidates:
        WARN.clear()
        views = compose(sheet, mdl, sc, sheet_index, sheet_count, problem, title)
        _, frame_box, reserved = sheet_frame(paper, dict(info, scale_text=scale_text(sc)), sheet_index,
                                             sheet_count, parts_list, notes)
        fit = arrange(views, frame_box, reserved)
        if fit:
            flush_warnings()
            return sc, views
        if sc == candidates[-1]:
            raise SpecError(f"第 {sheet.get('id')} 张图在 {paper} 图幅上排不下，请改用更大图幅或更小比例")
    raise AssertionError


def hatch_style(index):
    return HATCH_STYLES[index % len(HATCH_STYLES)]


def protect_annotation_text(view):
    """标注线遇文字留白；只断开尺寸/辅助线，绝不裁剪零件轮廓。"""
    scale=view['placement']['scale']
    groups=[d['draw'] for d in view['dimensions']]+[view.get('annotations',[])]
    boxes=[]
    for marks in groups:
        for mark in marks:
            if mark['kind']=='text':
                b=text_box(mark['text'],np.asarray(mark['at'])*scale,mark['height'],mark.get('anchor','mm'),mark.get('angle',0))
                boxes.append([(b[0]-.5)/scale,(b[1]-.5)/scale,(b[2]+.5)/scale,(b[3]+.5)/scale])
    for marks in groups:
        revised=[]
        for mark in marks:
            if mark['kind']!='curve':
                revised.append(mark);continue
            curves=[mark['curve']]
            for x0,y0,x1,y1 in boxes:
                region={'shape':'polygon','points':[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]}
                if any(box_overlap(g2.bounds([c]),[x0,y0,x1,y1]) for c in curves):
                    curves=g2.clip_all(curves,region,inside=False)
            revised.extend(dict(mark,curve=c) for c in curves)
        marks[:]=revised


def make_sheet(sheet, mdl, problem, title, sheet_index, sheet_count, dpi):
    paper = sheet.get("paper", "A3")
    if paper not in PAPERS:
        raise SpecError(f"图幅 {paper} 不支持，可用 {'、'.join(PAPERS)}")
    parts_list = sheet.get("parts_list") or []
    notes = sheet.get("notes") or []
    frame = sheet.get("frame", "part")
    info = {"title": sheet.get("title", title), "drawing_no": sheet.get("drawing_no", f"JX-{problem}"),
            "material": sheet.get("material", ""), "quantity": sheet.get("quantity", 1 if frame == "part" else ""),
            "problem_label": f"第 {problem} 题" + (f" · 第 {sheet_index} 张" if sheet_count > 1 else "")}
    sc, views = pick_scale(sheet, mdl, paper, sheet_index, sheet_count, problem, title, info, parts_list, notes)
    info["scale_text"] = scale_text(sc)
    frame_marks, _, _ = sheet_frame(paper, info, sheet_index, sheet_count, parts_list, notes)
    W, H = PAPERS[paper][:2]
    order = [p.name for p in mdl.parts]
    out_views = []
    for v in views:
        hatches = []
        for h in v.geom["hatches"]:
            ang, sp = hatch_style(order.index(h["part"]) if h["part"] in order else 0)
            if frame == "part":
                ang, sp = 45, 3.0
            hh = {"part": h["part"], "angle": ang, "spacing": sp, "loops": h["loops"]}
            for key in ("clip", "exclude"):
                if h.get(key):
                    hh[key] = h[key]
            hatches.append(hh)
        vdef = {k: val for k, val in v.vdef.items() if k not in ("parent_definition",)}
        for k in ("direction", "u", "v", "origin"):
            if k in vdef:
                vdef[k] = [float(x) + 0.0 for x in vdef[k]]
        if v.kind == "detail":
            vdef["parent_definition"] = {k: val for k, val in v.vdef["parent_definition"].items()}
        entry = {
            "name": v.name,
            "kind": v.kind if v.kind in ("auxiliary", "removed_section", "detail") else "basic",
            "position": v.kind if v.kind in BASIC else None,
            "frame": frame,
            "definition": vdef,
            "placement": {"scale": v.scale, "scale_text": scale_text(v.scale),
                          "paper_origin": [round(v.paper_origin[0], 4), round(v.paper_origin[1], 4)]},
        }
        if getattr(v, "axes", None):
            entry["axes"] = v.axes
        if v.kind in BASIC and v.vdef.get("section"):
            entry["section_label"] = v.letter
        entry["lines"] = [c for c in v.geom["lines"]]
        entry["hatches"] = hatches
        entry["dimensions"] = []
        for d in v.dims:
            dd = {k: val for k, val in d.items() if k != "marks"}
            dd["draw"] = d["marks"].to_view(v.scale)
            entry["dimensions"].append(dd)
        entry["annotations"] = v.marks.to_view(v.scale)
        protect_annotation_text(entry)
        out_views.append(entry)
    sheet_json = {
        "format": "工程图纸三维还原·图纸", "version": 1,
        "problem": problem, "sheet": sheet["id"], "sheet_index": sheet_index, "sheet_count": sheet_count,
        "title": info["title"], "frame": frame, "part": sheet.get("part") if frame == "part" else None,
        "paper": {"size": paper, "width": W, "height": H}, "dpi": dpi,
        "projection": "第一角画法", "units": "毫米", "scale": scale_text(sc),
        "conventions": CONVENTIONS,
        "title_block": {k: info[k] for k in ("title", "drawing_no", "material", "quantity", "scale_text")},
        "parts_list": parts_list,
        "notes": notes,
        "views": out_views,
        "sheet_marks": frame_marks.to_view(1.0),
    }
    return sheet_json


CONVENTIONS = {
    "零件坐标系": "三维坐标单位为毫米。各基本视图上画有坐标原点 O 和坐标轴箭头 X、Y、Z（指向正向）。"
              "主视图沿 +Y 方向投射，俯视图沿 −Z，左视图沿 +X；第一角画法。",
    "视图坐标": "每个视图有自己的二维坐标 (u, v)，单位为零件毫米（实际尺寸，不受比例影响）。"
             "三维点 P 投影到视图：u = (P − origin)·definition.u，v = (P − origin)·definition.v；"
             "definition.direction 为投射方向（视线方向）。",
    "图纸位置": "图纸毫米坐标原点在图幅左下角，y 向上；视图坐标 (u, v) 在图纸上的位置为 "
             "placement.paper_origin + placement.scale × (u, v)。",
    "曲线": "line 为线段 from→to；circle 为整圆；arc 为圆弧，start、end 是角度（度），从 u 正向逆时针量，"
          "圆弧从 start 逆时针画到 end；polyline 为折线逼近（椭圆、相贯线等）。",
    "线型": render.LINE_TYPE_CN,
    "剖切": "section 定义剖切：剖切平面过 point 且垂直于投射方向，观察者一侧的材料移去；mode 为 full（全剖）、"
          "half（半剖，half.axis 为分界所在坐标轴 u 或 v，at 为分界坐标，side 为剖开的一侧 + 或 −）、"
          "local（局部剖，region 为剖开范围的多边形）。removed_section（断面图）只画剖切平面上的截面。"
          "hatches 为剖面线区域（loops 为闭合边界，奇偶规则；clip 为附加裁剪区域）。",
    "局部视图": "keep 为局部视图保留的区域，边界在材料上画波浪线；detail 为局部放大图，"
             "detail.center、detail.r 为在父视图坐标中的放大范围。",
    "尺寸": "dimensions 中 value 为尺寸数值（毫米或度），text 为标注文字；linear 的 from、to 为被测两点，"
          "dir 为 h（沿 u 方向的距离）、v（沿 v 方向）或 a（两点连线方向）；diameter、radius 给 center 和 r；"
          "angle 给 vertex、from、to（从 from 射线逆时针量到 to 射线）；leader 为引出标注（如孔的说明）。"
          "draw 为尺寸线、尺寸界线、箭头和文字的画法图元。",
}



PUBLIC_CONVENTIONS = {
    "图纸": "形状、图线、遮挡关系和剖面边界仅见同名PNG；JSON不提供图线或标注图元坐标。",
    "尺寸": "每个尺寸旁的〔D编号〕对应dimensions目录；编号在整题内唯一。value为尺寸数值，text为完整标注，参考尺寸保留括号。",
    "坐标": "O是零件坐标原点，箭头X/Y/Z指向正向；单位毫米。装配图采用总坐标系，零件图采用各自坐标系。",
    "投影": "第一角画法；主视沿+Y，俯视沿−Z，左视沿+X。其他视图以definition.direction为投射方向。",
    "剖切": "definition.section只说明剖切平面与方式；剖切位置字母标在PNG上，不包含截面轮廓。",
    "尺寸链": "线性尺寸由尺寸界线所指的轮廓、轴线或中心位置之间量取。局部定形与相对定位尺寸需结合PNG联立；不得将尺寸数值直接当成绝对坐标。",
}


def public_sheet(sheet):
    """明确的允许字段白名单；绝不递归复制图元。"""
    keys = ("format", "problem", "sheet", "sheet_index", "sheet_count", "title", "frame", "part",
            "paper", "dpi", "projection", "units", "scale", "title_block", "parts_list", "notes")
    out = {k: sheet[k] for k in keys}
    out.update(version=2, conventions=PUBLIC_CONVENTIONS, dimensions=[], views=[])
    cn = {"linear": "线性", "diameter": "直径", "radius": "半径", "angle": "角度", "leader": "孔标注或尺寸说明"}
    kind_cn = {"basic": "基本视图", "auxiliary": "斜视图", "removed_section": "断面", "detail": "局部放大"}
    for v in sheet["views"]:
        # 新题仅使用全剖/断面；视图定位是页面布局而非任何参考图线。
        if (v["definition"].get("section") or {}).get("region"):
            raise SpecError("公开协议不允许局部剖区域顶点；请改用独立全剖图")
        vv = {k: v[k] for k in ("name", "kind", "position", "frame")}
        vv["projection_direction"] = v["definition"].get("direction")
        vv["section"] = ({"label":v.get("section_label"),"mode":v["definition"]["section"]["mode"]} if v["definition"].get("section") else None)
        vv["type"] = "剖视" if v["definition"].get("section") else kind_cn[v["kind"]]
        vv["section_label"] = v.get("section_label")
        vv["coordinate_system"] = "装配总坐标系" if sheet["frame"] == "assembly" else "零件自身坐标系；O及正向见PNG"
        out["views"].append(vv)
        for d in v["dimensions"]:
            out["dimensions"].append({"id": d["id"], "view": v["name"], "type": d.get("category", cn[d["type"]]),
                "value": d.get("value"), "text": d["text"]})
    out["dimensions"].sort(key=lambda d: int(d["id"][1:]))
    return out


def validate_public(doc):
    forbidden = {"lines", "hatches", "loops", "draw", "annotations", "sheet_marks", "from", "to", "points", "vertices", "center", "region"}
    def visit(node):
        if isinstance(node, dict):
            if forbidden.intersection(node):
                raise SpecError(f"公开JSON泄露图元字段：{forbidden.intersection(node)}")
            for val in node.values():
                visit(val)
        elif isinstance(node, list):
            for val in node:
                visit(val)
    visit(doc)
    ids = [d["id"] for d in doc["dimensions"]]
    if len(ids) != len(set(ids)):
        raise SpecError("尺寸编号重复")


def clear_auxiliary_letters(sheet):
    """文字避开真实零件轮廓，保留原定位端点并以引线关联。"""
    geometry=[];texts=[];points=[]
    for v in sheet['views']:
        sc,off=render.view_xf(v)
        curves=[c for c in v['lines'] if c['type'] in ('visible','hidden')]
        gb=g2.bounds(curves)
        geometry.append(None if gb is None else [gb[0]*sc+off[0],gb[1]*sc+off[1],gb[2]*sc+off[0],gb[3]*sc+off[1]])
        arrays=[g2.sample(g2.xform(c,sc,off),.35) for c in curves]
        points.append(np.concatenate(arrays) if arrays else np.zeros((0,2)))
        for m in v['annotations']+[m for d in v['dimensions'] for m in d['draw']]:
            if m['kind']=='text':texts.append(text_box(m['text'],np.array(m['at'])*sc+off,m['height'],m.get('anchor','mm'),m.get('angle',0)))
    for m in sheet['sheet_marks']:
        if m['kind']=='text':texts.append(text_box(m['text'],m['at'],m['height'],m.get('anchor','mm'),m.get('angle',0)))
    for vi,v in enumerate(sheet['views']):
        sc,off=render.view_xf(v);gb=geometry[vi];pts=points[vi]
        if gb is None:continue
        targets=[m for m in v['annotations'] if m['kind']=='text' and m.get('role') in ('aux','detail','section','label')]
        targets += [m for d in v['dimensions'] for m in d['draw'] if m['kind']=='text']
        for m in targets:
            old=np.array(m['at'])*sc+off
            box=text_box(m['text'],old,m['height'],m.get('anchor','mm'),m.get('angle',0))
            n=int(((pts[:,0]>box[0]+.6)&(pts[:,0]<box[2]-.6)&(pts[:,1]>box[1]+.6)&(pts[:,1]<box[3]-.6)).sum())
            own=next((i for i,b in enumerate(texts) if np.allclose(b,box,atol=1e-6)),None)
            others=[b for i,b in enumerate(texts) if i!=own]
            collision=any(box_overlap([box[0]+.6,box[1]+.6,box[2]-.6,box[3]-.6],[b[0]+.6,b[1]+.6,b[2]-.6,b[3]-.6]) for b in others)
            if n<=2 and not collision:continue
            if own is not None:texts.pop(own)
            tw,th=render.text_extent(m['text'],m['height']);candidates=[]
            for gap in (8,16,24,36,50,70,100):
                candidates += [[gb[2]+gap+tw/2,old[1]],[gb[0]-gap-tw/2,old[1]],
                    [old[0],gb[3]+gap+th/2],[old[0],gb[1]-gap-th/2]]
            def choose(candidates):
                good=[]
                for at in candidates:
                    b=text_box(m['text'],at,m['height'],'mm')
                    if b[0]<31 or b[2]>sheet['paper']['width']-15 or b[1]<40 or b[3]>sheet['paper']['height']-20:continue
                    if any(box_overlap(b,r,2) for r in geometry+texts if r is not None):continue
                    good.append((float(np.linalg.norm(np.array(at)-old)),at,b))
                return min(good,key=lambda t:t[0]) if good else None
            best=choose(candidates)
            if best is None:best=choose([[x,y] for x in np.arange(35+tw/2,sheet['paper']['width']-15-tw/2,12) for y in np.arange(45,sheet['paper']['height']-24,12)])
            if best is None:raise SpecError(f"{sheet['sheet']}：文字无空白位置：{m['text']}")
            _,at,bestbox=best;m['at']=((np.array(at)-off)/sc).tolist();m['anchor']='mm';m['angle']=0
            v['annotations'].append(dict(kind='curve',curve=g2.line((old-off)/sc,m['at'],'thin'),role='text-callout'))
            texts.append(bestbox)
    for v in sheet['views']:protect_annotation_text(v)
    return sheet


def run(spec_path, ref_path=None, out_dir=None, dpi=240, sheet_filter=None):
    _PROJECT_CACHE.clear()
    spec = json.loads(Path(spec_path).read_text(encoding="utf-8-sig"))
    problem = spec.get("problem") or Path(spec_path).stem
    ref_path = Path(ref_path) if ref_path else HERE / "参考答案" / f"第{problem}题.json"
    desc = model.load(ref_path)
    mdl = model.build(desc)
    for p in mdl.parts:
        for w in p.warnings:
            warn(w)
        if p.error:
            raise SpecError(f"参考描述生成失败：零件 {p.error['part']} 第 {p.error['step']} 个特征：{p.error['message']}")
    out_dir = Path(out_dir) if out_dir else PUBLIC
    out_dir.mkdir(parents=True, exist_ok=True)
    sheets = spec["sheets"]
    title = spec.get("title", "")
    written = []
    number = 0
    for sh in sheets:
        for dimension in sh.get("dimensions", []):
            number += 1
            dimension["_id"] = f"D{number}"
    private = HERE / "图纸几何" if out_dir == PUBLIC else out_dir / "出题端几何"
    private.mkdir(parents=True, exist_ok=True)
    out_dir = out_dir / problem   # 公开图纸按题号分文件夹：<输出目录>/NN/NN-张次.png
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, sheet in enumerate(sheets, start=1):
        sheet.setdefault("id", problem if len(sheets) == 1 else f"{problem}-{i}")
        if sheet_filter and sheet["id"] not in sheet_filter:
            continue
        sj = make_sheet(sheet, mdl, problem, sheet.get("title", title), i, len(sheets), dpi)
        if int(problem)>=16:clear_auxiliary_letters(sj)
        jpath = out_dir / f"{sheet['id']}.json"
        (private / jpath.name).write_text(json.dumps(sj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        public = public_sheet(sj)
        validate_public(public)
        jpath.write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8")
        img = render.render_sheet(sj).image()
        ppath = out_dir / f"{sheet['id']}.png"
        img.save(ppath, optimize=True, dpi=(dpi, dpi))
        written += [ppath, jpath]
        print(f"已出图：{ppath.name}（{sj['paper']['size']}，比例 {sj['scale']}，{len(sj['views'])} 个视图）")
    return written


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec", nargs="*", help="出图规格 JSON")
    ap.add_argument("--ref", help="参考建模描述（默认 参考答案/第NN题.json）")
    ap.add_argument("--out", help="输出目录（默认 识图建模/工程图纸三维还原/；图纸写在其下的题号文件夹）")
    ap.add_argument("--dpi", type=int, default=240, help="PNG 分辨率；200—300 dpi，默认240")
    ap.add_argument("--all", action="store_true", help="处理 出图规格/ 下全部规格")
    ap.add_argument("--sheets", help="只重出指定图号，逗号分隔；尺寸编号仍按完整题目分配")
    args = ap.parse_args()
    specs = [Path(p) for p in args.spec]
    if args.all:
        specs = sorted((HERE / "出图规格").glob("*.json"))
    if not specs:
        ap.error("请给出出图规格文件或 --all")
    for sp in specs:
        spec = json.loads(sp.read_text(encoding="utf-8-sig"))
        big = any(s.get("paper", "A3") in ("A2", "A1") for s in spec.get("sheets", []))
        dpi = args.dpi or 240
        if not 200 <= dpi <= 300:
            ap.error("图纸分辨率必须为200—300 dpi")
        try:
            run(sp, args.ref, args.out, dpi, set(args.sheets.split(',')) if args.sheets else None)
        except (SpecError, model.ModelError, KeyError) as exc:
            print(f"出图失败（{sp.name}）：{exc}")
            sys.exit(1)


if __name__ == "__main__":
    main()
