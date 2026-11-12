"""按视图定义把实体投影成二维线条（OpenCascade 精确消隐 HLR、精确剖切）。

视图定义（字典，出图程序写进图纸 JSON 的 "definition"）：
  kind        "basic" | "auxiliary" | "removed_section" | "detail"
  direction   投射方向（观察者视线方向，三维单位向量）
  u, v        视图二维坐标轴在三维中的方向；u × v 指向观察者
  origin      视图二维原点 (0, 0) 对应的三维点
  scale       图纸比例（图纸毫米 / 零件毫米）
  frame       "part"（零件自身坐标）或 "assembly"（装配坐标）
  parts       参与本视图的零件名
  hidden      是否画不可见轮廓（细虚线）
  section     null 或 {"point": 剖切平面上一点, "mode": "full"|"half"|"local",
                       "half": {"axis": "u"|"v", "at": 数, "side": "+"|"-"},
                       "region": [[u, v], ...], "unsectioned": [零件名]}
              剖切平面垂直于投射方向；观察者一侧的材料被移去。
  keep        null 或区域字典（局部视图保留的范围，视图坐标）
  detail      仅 kind="detail"：{"parent": 视图名, "center": [u, v], "r": 半径}
"""
import math

import numpy as np
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeEdge, BRepBuilderAPI_MakeFace, BRepBuilderAPI_MakeWire
from OCP.BRepLib import BRepLib
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakePrism
from OCP.BRepTools import BRepTools, BRepTools_WireExplorer
from OCP.GCPnts import GCPnts_AbscissaPoint
from OCP.GeomAbs import GeomAbs_Circle, GeomAbs_Cone, GeomAbs_Cylinder, GeomAbs_Line, GeomAbs_Plane
from OCP.HLRAlgo import HLRAlgo_Projector
from OCP.HLRBRep import HLRBRep_Algo, HLRBRep_HLRToShape
from OCP.IntCurvesFace import IntCurvesFace_ShapeIntersector
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_REVERSED, TopAbs_WIRE
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.gp import gp_Ax2, gp_Lin, gp_Pnt, gp_Vec

from . import geom2d as g2
from .model import compound, gdir, pnt, shape_bbox, transformed, trsf_from_matrix

CENTER_EXT = 3.0      # 中心线伸出轮廓的长度（图纸毫米）
WAVE_AMP = 0.7        # 波浪线振幅（图纸毫米）
WAVE_LEN = 5.0        # 波浪线波长（图纸毫米）


def frame_axes(direction, up):
    """由投射方向和大致向上方向求 u、v（u × v 指向观察者）。"""
    w = -np.asarray(direction, float)
    w /= np.linalg.norm(w)
    v = np.asarray(up, float) - np.dot(up, w) * w
    v /= np.linalg.norm(v)
    u = np.cross(v, w)
    return u, v


class Projector:
    def __init__(self, vdef):
        self.o = np.asarray(vdef.get("origin", [0, 0, 0]), float)
        self.u = np.asarray(vdef["u"], float)
        self.v = np.asarray(vdef["v"], float)
        self.w = np.cross(self.u, self.v)
        self.scale = float(vdef.get("scale", 1.0))

    def to2(self, p):
        q = np.array([p.X(), p.Y(), p.Z()]) - self.o if isinstance(p, gp_Pnt) else np.asarray(p) - self.o
        return float(q @ self.u), float(q @ self.v)

    def depth(self, p):
        q = np.array([p.X(), p.Y(), p.Z()]) if isinstance(p, gp_Pnt) else np.asarray(p, float)
        return float((q - self.o) @ self.w)

    def world(self, a, b, c=0.0):
        return self.o + a * self.u + b * self.v + c * self.w

    def matrix(self):
        m = np.eye(4)
        m[:3, 0], m[:3, 1], m[:3, 2], m[:3, 3] = self.u, self.v, self.w, self.o
        return m


# ---------------------------------------------------------------- 边 → 二维曲线

def edge_curves(edge, kind, to2):
    c = BRepAdaptor_Curve(edge)
    t0, t1 = c.FirstParameter(), c.LastParameter()
    typ = c.GetType()
    p0, p1 = np.array(to2(c.Value(t0))), np.array(to2(c.Value(t1)))
    if typ == GeomAbs_Line:
        return [g2.line(p0, p1, kind)] if np.linalg.norm(p1 - p0) > 1e-7 else []
    if typ == GeomAbs_Circle:
        circ = c.Circle()
        cc = np.array(to2(circ.Location()))
        r = circ.Radius()
        pm = np.array(to2(c.Value((t0 + t1) / 2)))
        if abs(np.linalg.norm(pm - cc) - r) < 1e-6 * max(1, r):   # 圆所在平面与视图平行
            if abs((t1 - t0) - 2 * math.pi) < 1e-9:
                return [g2.arc(cc, r, 0, 360, kind)]
            ang = lambda p: math.degrees(math.atan2(p[1] - cc[1], p[0] - cc[0]))
            a0, am, a1 = ang(p0), ang(pm), ang(p1)
            if (am - a0) % 360 < (a1 - a0) % 360:
                return [g2.arc(cc, r, a0, a0 + (a1 - a0) % 360, kind)]
            return [g2.arc(cc, r, a1, a1 + (a0 - a1) % 360, kind)]
    try:
        L = GCPnts_AbscissaPoint.Length_s(c)
    except Exception:
        L = 10.0
    n = int(min(600, max(8, L / 0.3 + 8)))
    pts = np.array([to2(c.Value(t0 + (t1 - t0) * i / n)) for i in range(n + 1)])
    if L < 1e-7:
        return []
    return [simplify(pts, kind)] if len(pts) > 1 else []


def simplify(pts, kind):
    """折线若实为直线或圆弧（如侧视的圆、投影后仍是圆的曲线），改写成精确的直线、圆弧。"""
    span = pts.max(axis=0) - pts.min(axis=0)
    if np.linalg.norm(span) < 1e-7:
        return g2.polyline(pts, kind)
    # 直线：所有点到主方向直线的距离很小
    c0 = pts.mean(axis=0)
    _, _, vt = np.linalg.svd(pts - c0)
    e = vt[0]
    off = np.abs((pts - c0) @ np.array([-e[1], e[0]]))
    if off.max() < 1e-6:
        t = (pts - c0) @ e
        return g2.line(c0 + e * t.min(), c0 + e * t.max(), kind)
    # 圆弧
    if len(pts) >= 5:
        try:
            from .model import circumcenter
            m = len(pts) // 2
            cc = circumcenter(pts[0], pts[m], pts[-1])
        except Exception:
            cc = None
        if cc is not None:
            r = np.linalg.norm(pts - cc, axis=1)
            if np.ptp(r) < 1e-6 * max(1.0, r.mean()) and r.mean() < 1e5:
                ang = np.degrees(np.arctan2(pts[:, 1] - cc[1], pts[:, 0] - cc[0]))
                steps = (np.diff(ang) + 180) % 360 - 180
                total = float(steps.sum())
                if abs(total) >= 360 - 1e-6:
                    return g2.arc(cc, r.mean(), 0, 360, kind)
                if total > 0:
                    return g2.arc(cc, r.mean(), ang[0], ang[0] + total, kind)
                return g2.arc(cc, r.mean(), ang[-1], ang[-1] - total, kind)
    return g2.polyline(pts, kind)


def compound_curves(comp, kind, to2):
    out = []
    if comp is None or comp.IsNull():
        return out
    ex = TopExp_Explorer(comp, TopAbs_EDGE)
    while ex.More():
        out.extend(edge_curves(TopoDS.Edge_s(ex.Current()), kind, to2))
        ex.Next()
    return out


def hlr(shapes, pj):
    shapes = [s for s in shapes if s is not None and not s.IsNull()]
    if not shapes:
        return [], []
    algo = HLRBRep_Algo()
    for s in shapes:
        BRepLib.EncodeRegularity_s(s, 1e-4)
        algo.Add(s)
    algo.Projector(HLRAlgo_Projector(gp_Ax2(pnt(pj.o), gdir(pj.w), gdir(pj.u))))
    algo.Update()
    algo.Hide()
    hs = HLRBRep_HLRToShape(algo)
    local = lambda p: (p.X(), p.Y())
    vis = compound_curves(hs.VCompound(), "visible", local) + compound_curves(hs.OutLineVCompound(), "visible", local)
    hid = compound_curves(hs.HCompound(), "hidden", local) + compound_curves(hs.OutLineHCompound(), "hidden", local)
    return vis, hid


# ---------------------------------------------------------------- 剖切

def big_size(shapes):
    size = 100.0
    for s in shapes:
        b = shape_bbox(s)
        if b:
            size = max(size, float(np.linalg.norm(b[1] - b[0])) + float(np.abs(np.concatenate(b)).max()))
    return size * 4


def local_box(pj, lo, hi):
    box = BRepPrimAPI_MakeBox(gp_Pnt(*lo), gp_Pnt(*hi)).Shape()
    return transformed(box, trsf_from_matrix(pj.matrix()))


def local_prism(pj, polygon, w0, w1):
    mw = BRepBuilderAPI_MakeWire()
    pts = [gp_Pnt(float(p[0]), float(p[1]), w0) for p in polygon]
    for i in range(len(pts)):
        mw.Add(BRepBuilderAPI_MakeEdge(pts[i], pts[(i + 1) % len(pts)]).Edge())
    face = BRepBuilderAPI_MakeFace(mw.Wire(), True).Face()
    solid = BRepPrimAPI_MakePrism(face, gp_Vec(0, 0, w1 - w0)).Shape()
    return transformed(solid, trsf_from_matrix(pj.matrix()))


def cut_tool(pj, section, big):
    w0 = pj.depth(section["point"])
    mode = section.get("mode", "full")
    if mode == "local":
        return local_prism(pj, section["region"], w0, w0 + big)
    lo, hi = [-big, -big, w0], [big, big, w0 + big]
    if mode == "half":
        h = section["half"]
        i = 0 if h.get("axis", "u") == "u" else 1
        if h.get("side", "+") == "+":
            lo[i] = float(h["at"])
        else:
            hi[i] = float(h["at"])
    return local_box(pj, lo, hi)


def section_region(section):
    """剖开部分在视图中的区域（区域字典）；全剖返回 None。"""
    mode = section.get("mode", "full")
    if mode == "half":
        h = section["half"]
        n = [1.0, 0.0] if h.get("axis", "u") == "u" else [0.0, 1.0]
        if h.get("side", "+") == "-":
            n = [-n[0], -n[1]]
            return {"shape": "halfplane", "n": n, "c": -float(h["at"])}
        return {"shape": "halfplane", "n": n, "c": float(h["at"])}
    if mode == "local":
        return {"shape": "polygon", "points": section["region"]}
    return None


def plane_faces(shape, pj, w0):
    out = []
    ex = TopExp_Explorer(shape, TopAbs_FACE)
    while ex.More():
        f = TopoDS.Face_s(ex.Current())
        s = BRepAdaptor_Surface(f)
        if s.GetType() == GeomAbs_Plane:
            pl = s.Plane()
            n = pl.Axis().Direction()
            nn = np.array([n.X(), n.Y(), n.Z()])
            if abs(abs(nn @ pj.w) - 1) < 1e-9 and abs(pj.depth(pl.Location()) - w0) < 1e-6:
                out.append(f)
        ex.Next()
    return out


def face_loops(face, pj, step=0.25):
    loops, outline = [], []
    ex = TopExp_Explorer(face, TopAbs_WIRE)
    while ex.More():
        wire = TopoDS.Wire_s(ex.Current())
        we = BRepTools_WireExplorer(wire, face)
        pts = []
        while we.More():
            e = we.Current()
            outline.extend(edge_curves(e, "visible", pj.to2))
            c = BRepAdaptor_Curve(e)
            t0, t1 = c.FirstParameter(), c.LastParameter()
            if c.GetType() == GeomAbs_Line:
                n = 1
            else:
                try:
                    L = GCPnts_AbscissaPoint.Length_s(c)
                except Exception:
                    L = 10.0
                n = int(min(720, max(4, L / step)))
            seq = [pj.to2(c.Value(t0 + (t1 - t0) * i / n)) for i in range(n + 1)]
            if e.Orientation() == TopAbs_REVERSED:
                seq = seq[::-1]
            if pts and np.hypot(pts[-1][0] - seq[0][0], pts[-1][1] - seq[0][1]) < 1e-6:
                seq = seq[1:]
            pts.extend(seq)
            we.Next()
        if len(pts) >= 3:
            loops.append([g2.P(p, 4) for p in pts])
        ex.Next()
    return loops, outline


# ---------------------------------------------------------------- 中心线

def cylinder_axes(shapes):
    out = []
    for shape in shapes:
        ex = TopExp_Explorer(shape, TopAbs_FACE)
        while ex.More():
            f = TopoDS.Face_s(ex.Current())
            s = BRepAdaptor_Surface(f)
            typ = s.GetType()
            if typ in (GeomAbs_Cylinder, GeomAbs_Cone):
                g = s.Cylinder() if typ == GeomAbs_Cylinder else s.Cone()
                ax = g.Axis()
                loc = np.array([ax.Location().X(), ax.Location().Y(), ax.Location().Z()])
                d = np.array([ax.Direction().X(), ax.Direction().Y(), ax.Direction().Z()])
                umin, umax, vmin, vmax = BRepTools.UVBounds_s(f)
                ts, rs = [], []
                for uu in (umin, (umin + umax) / 2, umax):
                    for vv in (vmin, vmax):
                        p = s.Value(uu, vv)
                        q = np.array([p.X(), p.Y(), p.Z()]) - loc
                        t = float(q @ d)
                        ts.append(t)
                        rs.append(float(np.linalg.norm(q - t * d)))
                out.append({"loc": loc, "dir": d, "r": max(rs), "rmin": min(rs), "span": umax - umin,
                            "t0": min(ts), "t1": max(ts)})
            ex.Next()
    return out


def auto_centerlines(shapes, pj, drawn):
    ext = CENTER_EXT / pj.scale
    lines_, crosses = [], {}
    drawn_lines = [c for c in drawn if c["geom"] == "line"]
    drawn_arcs = [c for c in drawn if c["geom"] in ("arc", "circle")]
    for a in cylinder_axes(shapes):
        if a["span"] < math.pi - 1e-3:
            continue
        d2 = np.array([a["dir"] @ pj.u, a["dir"] @ pj.v])
        if abs(a["dir"] @ pj.w) > 0.999:
            c = np.array(pj.to2(a["loc"]))
            if not any(np.hypot(arc_["center"][0] - c[0], arc_["center"][1] - c[1]) < 1e-4 for arc_ in drawn_arcs):
                continue
            key = (round(c[0], 4), round(c[1], 4))
            crosses[key] = max(crosses.get(key, 0.0), a["r"])
            continue
        p0 = np.array(pj.to2(a["loc"] + a["dir"] * a["t0"]))
        p1 = np.array(pj.to2(a["loc"] + a["dir"] * a["t1"]))
        L = np.linalg.norm(p1 - p0)
        if L < 1e-6:
            continue
        e = (p1 - p0) / L
        if abs(a["dir"] @ pj.w) < 1e-3:
            ok = False
            for ln in drawn_lines:
                q0, q1 = np.asarray(ln["from"]), np.asarray(ln["to"])
                dq = q1 - q0
                lq = np.linalg.norm(dq)
                if lq < 1e-6 or abs(e[0] * dq[1] - e[1] * dq[0]) / lq > 1e-4:
                    continue
                off = abs(e[0] * (q0 - p0)[1] - e[1] * (q0 - p0)[0])
                if off < a["rmin"] - 1e-4 or off > a["r"] + 1e-4 or off < 1e-4:
                    continue
                s0, s1 = sorted(((q0 - p0) @ e, (q1 - p0) @ e))
                if s1 > 1e-4 and s0 < L - 1e-4:
                    ok = True
                    break
            if not ok:
                continue
        lines_.append(g2.line(p0 - e * ext, p1 + e * ext, "center"))
    out = g2.merge(lines_, priority=("center",))
    # 均布孔：同径的孔心共圆时画节圆和径向中心线
    used = set()
    by_r = {}
    for key, r in crosses.items():
        by_r.setdefault(round(r, 4), []).append(key)
    for r, keys in by_r.items():
        if len(keys) < 3:
            continue
        pts = np.array(keys, float)
        try:
            from .model import circumcenter
            cc = circumcenter(pts[0], pts[1], pts[2])
        except Exception:
            continue
        R = np.linalg.norm(pts - cc, axis=1)
        if np.ptp(R) > 1e-3 or R[0] < 1.5 * r:
            continue
        # 只有沿整圆等分（均布）才画节圆；矩形排布的四孔画十字中心线
        ang = np.sort(np.degrees(np.arctan2(pts[:, 1] - cc[1], pts[:, 0] - cc[0])))
        gaps = np.diff(np.concatenate([ang, [ang[0] + 360]]))
        if np.ptp(gaps) > 0.05:
            continue
        if len(pts) == 4 and len(np.unique(np.round(pts[:, 0], 3))) == 2 and len(np.unique(np.round(pts[:, 1], 3))) == 2:
            continue
        out.append(g2.arc(cc, R[0], 0, 360, "center"))
        for p in pts:
            radial = (p - cc) / np.linalg.norm(p - cc)
            out.append(g2.line(p - radial * (r + ext), p + radial * (r + ext), "center"))
            used.add((round(p[0], 4), round(p[1], 4)))
    for key, r in crosses.items():
        if key in used:
            continue
        c = np.array(key)
        h = r + ext
        out.append(g2.line(c - [h, 0], c + [h, 0], "center"))
        out.append(g2.line(c - [0, h], c + [0, h], "center"))
    return out


# ---------------------------------------------------------------- 材料检测（波浪线）

class Material:
    def __init__(self, shapes):
        self.items = []
        for s in shapes:
            it = IntCurvesFace_ShapeIntersector()
            it.Load(s, 1e-7)
            self.items.append(it)

    def hits(self, pj, pts, w0=None):
        out = []
        for p in pts:
            base = pj.world(p[0], p[1], 0.0)
            lin = gp_Lin(pnt(base), gdir(pj.w))
            lo, hi = (-1e7, 1e7) if w0 is None else (w0, 1e7)
            hit = False
            for it in self.items:
                it.Perform(lin, lo, hi)
                if it.IsDone() and it.NbPnt() > 0:
                    hit = True
                    break
            out.append(hit)
        return out


def boundary_waves(region, pj, material, w0=None):
    step = 0.5 / pj.scale
    path = g2.boundary_polyline(region, step)
    flags = material.hits(pj, path, w0)
    return g2.wave_runs(path, flags, WAVE_AMP / pj.scale, WAVE_LEN / pj.scale)


def on_segments(c, segs, tol=1e-5):
    pts = g2.sample(c, 1e9) if c["geom"] in ("line", "polyline") else g2.sample(c, max(c["r"] * 0.2, 1e-3))
    for a, b in segs:
        d = b - a
        L = np.linalg.norm(d)
        if L < 1e-12:
            continue
        e = d / L
        rel = pts - a
        off = np.abs(rel[:, 0] * e[1] - rel[:, 1] * e[0])
        t = rel @ e
        if off.max() < tol and t.min() > -tol and t.max() < L + tol:
            return True
    return False


# ---------------------------------------------------------------- 视图投影

def project_view(shapes, vdef, parent=None):
    """shapes: {零件名: 实体}（已处于视图所用坐标系）；parent：detail 视图的父视图投影结果。

    返回 {"lines": [...], "hatches": [...], "_shapes": [...]}；lines 的 type 为
    visible / hidden / center / wave。"""
    pj = Projector(vdef)
    kind = vdef.get("kind", "basic")
    names = vdef.get("parts") or list(shapes)
    names = [n for n in names if n in shapes and shapes[n] is not None]
    if kind == "detail":
        return project_detail(vdef, parent, pj)
    if kind == "removed_section":
        return project_removed(shapes, names, vdef, pj)
    section = vdef.get("section")
    hatches = []
    if section:
        big = big_size([shapes[n] for n in names])
        tool = cut_tool(pj, section, big)
        keep_whole = set(section.get("unsectioned", []))
        cut = {}
        for n in names:
            if n in keep_whole:
                # 实心件纵剖按不剖画，只保留穿过剖切面的零件。
                # 完全位于移去一侧的销等仍须移去，否则会遮挡剖面内部。
                lo, hi = shape_bbox(shapes[n])
                corners = [np.array([x, y, z]) for x in (lo[0], hi[0])
                           for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
                entirely_front = min(pj.depth(p) for p in corners) > pj.depth(section["point"]) + 1e-6
                cut[n] = BRepAlgoAPI_Cut(shapes[n], tool).Shape() if entirely_front else shapes[n]
            else:
                cut[n] = BRepAlgoAPI_Cut(shapes[n], tool).Shape()
        view_shapes = [cut[n] for n in names]
        vis, hid = hlr(view_shapes, pj)
        region = section_region(section)
        w0 = pj.depth(section["point"])
        if region is not None:
            if region["shape"] == "halfplane":
                segs = [(b[1], b[2]) for b in g2.boundary(region)]
            else:
                pts = [np.asarray(p, float) for p in region["points"]]
                segs = [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]
            vis = [c for c in vis if not on_segments(c, segs)]
            hid = [c for c in hid if not on_segments(c, segs)]
            hid = g2.clip_all(hid, region, inside=False) if vdef.get("hidden") else []
        else:
            hid = []
        for n in names:
            if n in keep_whole:
                continue
            for f in plane_faces(cut[n], pj, w0):
                loops, _ = face_loops(f, pj)
                if loops:
                    hatches.append({"part": n, "loops": loops})
        extra = rib_lines(section, hatches)
        if section.get("mode") == "local":
            mat = Material([shapes[n] for n in names])
            extra += boundary_waves(region, pj, mat, w0)
    else:
        view_shapes = [shapes[n] for n in names]
        vis, hid = hlr(view_shapes, pj)
        if not vdef.get("hidden", True):
            hid = []
        extra = []
    lines = g2.merge(vis + hid + [c for c in extra if c["type"] == "visible"])
    lines += auto_centerlines(view_shapes, pj, [c for c in lines])
    lines += [c for c in extra if c["type"] != "visible"]
    keep = vdef.get("keep")
    if keep:
        lines = g2.clip_all(lines, keep)
        lines += boundary_waves(keep, pj, Material(view_shapes))
        for h in hatches:
            h["clip"] = [keep]
    return {"lines": lines, "hatches": hatches, "_shapes": view_shapes}


def in_loops(pts, loops):
    inside = np.zeros(len(pts), bool)
    for lp in loops:
        inside ^= g2.contains({"shape": "polygon", "points": lp}, pts)
    return inside


def rib_lines(section, hatches):
    """肋板等纵剖不画剖面线的区域：剖面线避开这些多边形，多边形在材料内的边画成粗实线。"""
    out = []
    for poly in section.get("no_hatch", []):
        region = {"shape": "polygon", "points": poly}
        for h in hatches:
            h.setdefault("exclude", []).append(region)
        pts = [np.asarray(p, float) for p in poly]
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            L = np.linalg.norm(b - a)
            if L < 1e-9:
                continue
            ts = np.linspace(0, 1, max(2, int(L / 0.2) + 1))
            q = a + (b - a) * ts[:, None]
            nrm = np.array([-(b - a)[1], (b - a)[0]]) / L * 1e-3
            flags = np.zeros(len(q), bool)
            for h in hatches:
                flags |= in_loops(q + nrm, h["loops"]) & in_loops(q - nrm, h["loops"])
            run = None
            for k, f in enumerate(list(flags) + [False]):
                if f and run is None:
                    run = k
                elif not f and run is not None:
                    if k - 1 > run:
                        out.append(g2.line(q[run], q[k - 1], "visible"))
                    run = None
    return out


def project_removed(shapes, names, vdef, pj):
    section = vdef["section"]
    big = big_size([shapes[n] for n in names])
    w0 = pj.depth(section["point"])
    tool = local_box(pj, [-big, -big, w0], [big, big, w0 + big])
    lines, hatches, view_shapes = [], [], []
    for n in names:
        cut = BRepAlgoAPI_Cut(shapes[n], tool).Shape()
        view_shapes.append(cut)
        for f in plane_faces(cut, pj, w0):
            loops, outline = face_loops(f, pj)
            if loops:
                hatches.append({"part": n, "loops": loops})
            lines.extend(outline)
    lines = g2.merge(lines)
    ext = CENTER_EXT / pj.scale
    seen = set()
    for c in lines:
        if c["geom"] in ("arc", "circle") and (c["geom"] == "circle" or c["end"] - c["start"] >= 180 - 1e-6):
            key = (round(c["center"][0], 4), round(c["center"][1], 4))
            if key in seen:
                continue
            seen.add(key)
    crosses = []
    for key in seen:
        r = max(c["r"] for c in lines if c["geom"] in ("arc", "circle")
                and (round(c["center"][0], 4), round(c["center"][1], 4)) == key)
        h = r + ext
        crosses += [g2.line((key[0] - h, key[1]), (key[0] + h, key[1]), "center"),
                    g2.line((key[0], key[1] - h), (key[0], key[1] + h), "center")]
    return {"lines": lines + crosses, "hatches": hatches, "_shapes": view_shapes}


def project_detail(vdef, parent, pj):
    d = vdef["detail"]
    region = {"shape": "circle", "center": d["center"], "r": d["r"]}
    lines = g2.clip_all([c for c in parent["lines"] if c["type"] != "wave"], region)
    lines += g2.clip_all([c for c in parent["lines"] if c["type"] == "wave"], region)
    hatches = [dict(h, clip=h.get("clip", []) + [region]) for h in parent["hatches"]]
    lines += boundary_waves(region, pj, Material(parent["_shapes"]))
    return {"lines": lines, "hatches": hatches, "_shapes": parent["_shapes"]}


def geometry_bounds(geom):
    curves = list(geom["lines"])
    for h in geom["hatches"]:
        if h.get("clip"):
            continue
        for lp in h["loops"]:
            curves.append(g2.polyline(lp, "x"))
    b = g2.bounds([c for c in curves if c["type"] != "center"]) or g2.bounds(curves)
    return b
