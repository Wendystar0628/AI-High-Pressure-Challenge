"""建模描述（JSON）→ 每个零件一个 OpenCascade B-rep 实体。

规格见上级目录的《建模描述.md》。生成失败时给出第几个零件第几个特征、原因，
并保留失败前一步的实体（PartBuild.shape）。
"""
import json
import math
import re
from pathlib import Path

import numpy as np
from OCP.BRep import BRep_Builder
from OCP.BRepFilletAPI import BRepFilletAPI_MakeFillet, BRepFilletAPI_MakeChamfer
from OCP.BRepExtrema import BRepExtrema_DistShapeShape
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeVertex
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common, BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepBuilderAPI import (BRepBuilderAPI_MakeEdge, BRepBuilderAPI_MakeFace,
                                BRepBuilderAPI_MakeWire, BRepBuilderAPI_Transform)
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.BRepPrimAPI import BRepPrimAPI_MakePrism, BRepPrimAPI_MakeRevol
from OCP.Bnd import Bnd_Box
from OCP.GC import GC_MakeArcOfCircle
from OCP.GProp import GProp_GProps
from OCP.ShapeFix import ShapeFix_Shape
from OCP.ShapeUpgrade import ShapeUpgrade_UnifySameDomain
from OCP.TopAbs import TopAbs_SOLID, TopAbs_EDGE
from OCP.TopoDS import TopoDS
from OCP.TopExp import TopExp_Explorer
from OCP.TopTools import TopTools_ListOfShape
from OCP.TopoDS import TopoDS_Compound
from OCP.gp import gp_Ax1, gp_Ax2, gp_Ax3, gp_Circ, gp_Dir, gp_Pln, gp_Pnt, gp_Trsf, gp_Vec

TYPE_CN = {"extrude": "拉伸", "revolve": "旋转", "hole": "孔", "pattern_linear": "线性阵列",
           "pattern_circular": "环形阵列", "mirror": "镜像", "fillet": "倒圆", "chamfer": "倒角"}
OP_CN = {"add": "加料", "cut": "除料", "intersect": "求交"}
EPS = 1e-6

# 命名平面：草图 x 轴、y 轴；法向 = x × y
NAMED_PLANES = {
    "XY": ((1, 0, 0), (0, 1, 0)), "YX": ((0, 1, 0), (1, 0, 0)),
    "YZ": ((0, 1, 0), (0, 0, 1)), "ZY": ((0, 0, 1), (0, 1, 0)),
    "ZX": ((0, 0, 1), (1, 0, 0)), "XZ": ((1, 0, 0), (0, 0, 1)),
}
AXIS_VEC = {"X": (1, 0, 0), "Y": (0, 1, 0), "Z": (0, 0, 1)}


class ModelError(Exception):
    """part 为零件名，step 为特征序号（从 1 开始）；二者为 None 表示整份描述的问题。"""

    def __init__(self, message, part=None, step=None):
        super().__init__(message)
        self.message, self.part, self.step = message, part, step

    def where(self):
        if self.part is None:
            return "建模描述"
        if self.step is None:
            return f"零件 {self.part}"
        return f"零件 {self.part} 第 {self.step} 个特征"

    def __str__(self):
        return f"{self.where()}：{self.message}"


class Bad(Exception):
    """特征内部的格式或几何错误，由调用方补上零件和特征序号。"""


def need(cond, message):
    if not cond:
        raise Bad(message)


# ---------------------------------------------------------------- 数值读取

def num(value, what, positive=False, allow_zero=True):
    need(isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value),
         f"{what} 应为数字，实际为 {json.dumps(value, ensure_ascii=False)}")
    if positive:
        need(value > 0 or (allow_zero and value == 0), f"{what} 应为正数，实际为 {value}")
    return float(value)


def vec(value, n, what):
    need(isinstance(value, list) and len(value) == n, f"{what} 应为 {n} 个数字组成的数组")
    return np.array([num(x, what) for x in value], dtype=float)


def unit(v, what):
    length = float(np.linalg.norm(v))
    need(length > 1e-12, f"{what} 不能为零向量")
    return v / length


def axis_vector(value, what):
    if isinstance(value, str):
        key = value.strip().upper()
        sign = -1.0 if key.startswith("-") else 1.0
        key = key.lstrip("+-")
        need(key in AXIS_VEC, f"{what} 应为 X、Y、Z（可带正负号）或三维向量")
        return sign * np.array(AXIS_VEC[key], dtype=float)
    return unit(vec(value, 3, what), what)


def fmt(x):
    """尺寸显示：整数不带小数，其余最多两位。"""
    x = round(float(x), 2)
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return f"{x:.2f}".rstrip("0").rstrip(".")


# ---------------------------------------------------------------- 坐标与变换

def pnt(p):
    return gp_Pnt(float(p[0]), float(p[1]), float(p[2]))


def gdir(v):
    return gp_Dir(float(v[0]), float(v[1]), float(v[2]))


def trsf_from_matrix(m):
    t = gp_Trsf()
    t.SetValues(*[float(m[i, j]) for i in range(3) for j in range(4)])
    return t


def transformed(shape, trsf):
    return BRepBuilderAPI_Transform(shape, trsf, True).Shape()


def rotation_matrix(axis, angle_deg):
    a = math.radians(angle_deg)
    x, y, z = axis
    c, s, C = math.cos(a), math.sin(a), 1 - math.cos(a)
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def placement_matrix(spec):
    """{"rotate": [{"axis": "Z", "angle": 90}, ...], "translate": [x, y, z]} → 4×4。"""
    m = np.eye(4)
    if spec is None:
        return m
    need(isinstance(spec, dict), "placement 应为对象")
    unknown = set(spec) - {"rotate", "translate"}
    need(not unknown, f"placement 中有未知字段：{'、'.join(sorted(unknown))}")
    rot = spec.get("rotate", [])
    if isinstance(rot, dict):
        rot = [rot]
    need(isinstance(rot, list), "placement.rotate 应为数组")
    r = np.eye(3)
    for i, item in enumerate(rot):
        need(isinstance(item, dict) and "axis" in item and "angle" in item,
             f"placement.rotate[{i}] 应写成 {{\"axis\": \"Z\", \"angle\": 90}}")
        r = rotation_matrix(axis_vector(item["axis"], f"placement.rotate[{i}].axis"),
                            num(item["angle"], f"placement.rotate[{i}].angle")) @ r
    m[:3, :3] = r
    if "translate" in spec:
        m[:3, 3] = vec(spec["translate"], 3, "placement.translate")
    return m


def shape_volume(shape):
    if shape is None or shape.IsNull():
        return 0.0
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props)
    return props.Mass()


def shape_area(shape):
    props = GProp_GProps()
    BRepGProp.SurfaceProperties_s(shape, props)
    return props.Mass()


def shape_bbox(shape):
    box = Bnd_Box()
    BRepBndLib.AddOptimal_s(shape, box, False, False)
    if box.IsVoid():
        return None
    x0, y0, z0, x1, y1, z1 = box.Get()
    return np.array([x0, y0, z0]), np.array([x1, y1, z1])


def count_solids(shape):
    n, ex = 0, TopExp_Explorer(shape, TopAbs_SOLID)
    while ex.More():
        n += 1
        ex.Next()
    return n


def compound(shapes):
    comp, builder = TopoDS_Compound(), BRep_Builder()
    builder.MakeCompound(comp)
    for s in shapes:
        if s is not None and not s.IsNull():
            builder.Add(comp, s)
    return comp


# ---------------------------------------------------------------- 草图平面

class Frame:
    """草图平面：原点 o，x 轴 xd，y 轴 yd，法向 n = xd × yd。"""

    def __init__(self, o, xd, yd):
        self.o, self.xd, self.yd = o, xd, yd
        self.n = np.cross(xd, yd)

    def to3(self, p):
        return self.o + p[0] * self.xd + p[1] * self.yd

    def vec3(self, d):
        return d[0] * self.xd + d[1] * self.yd

    def ax3(self, at=None):
        return gp_Ax3(pnt(self.o if at is None else at), gdir(self.n), gdir(self.xd))


def sketch_frame(feature):
    plane = feature.get("plane", "XY")
    origin = vec(feature["origin"], 3, "origin") if "origin" in feature else np.zeros(3)
    if isinstance(plane, str):
        key = plane.strip().upper()
        need(key in NAMED_PLANES, f"plane 应为 XY、YZ、ZX、XZ、YX、ZY 之一或自定义平面，实际为 {plane}")
        xd, yd = (np.array(v, dtype=float) for v in NAMED_PLANES[key])
        return Frame(origin, xd, yd)
    need(isinstance(plane, dict), "plane 应为平面名称或对象")
    o = vec(plane["origin"], 3, "plane.origin") if "origin" in plane else origin
    need("normal" in plane and "x_dir" in plane, "自定义平面需要 normal 和 x_dir")
    n = unit(vec(plane["normal"], 3, "plane.normal"), "plane.normal")
    xd = vec(plane["x_dir"], 3, "plane.x_dir")
    xd = xd - np.dot(xd, n) * n
    xd = unit(xd, "plane.x_dir（去掉法向分量后）")
    return Frame(o, xd, np.cross(n, xd))


# ---------------------------------------------------------------- 二维轮廓

def pt2(value, what):
    return vec(value, 2, what)


def ccw_span(a0, a1):
    return (a1 - a0) % (2 * math.pi)


class Loop:
    """一个封闭轮廓：elements 为 ('line', p0, p1) / ('arc', p0, p1, c, ccw) / ('circle', c, r)。"""

    def __init__(self, elements, what):
        self.elements, self.what = elements, what
        self.summary = None
        self.poly = self._polygon()
        area = polygon_area(self.poly)
        need(abs(area) > 1e-9, f"{what} 面积为零")
        if area < 0:
            self.elements = [reverse_element(e) for e in reversed(self.elements)]
            self.poly = self.poly[::-1]
        self.area = abs(area)

    def _polygon(self):
        pts = []
        for e in self.elements:
            if e[0] == "circle":
                c, r = e[1], e[2]
                return np.array([c + r * np.array([math.cos(t), math.sin(t)])
                                 for t in np.linspace(0, 2 * math.pi, 145)[:-1]])
            if e[0] == "line":
                pts.append(e[1])
            else:
                _, p0, p1, c, ccw = e
                pts.extend(arc_points(p0, p1, c, ccw)[:-1])
        return np.array(pts)

    def inner_point(self):
        p = self.poly
        a, b = p[0], p[1 % len(p)]
        d = b - a
        size = float(np.ptp(p, axis=0).max()) + 1.0
        nl = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-300)
        return (a + b) / 2 + nl * 1e-5 * size


def arc_points(p0, p1, c, ccw, step_deg=5.0):
    r = np.linalg.norm(p0 - c)
    a0 = math.atan2(p0[1] - c[1], p0[0] - c[0])
    a1 = math.atan2(p1[1] - c[1], p1[0] - c[0])
    span = ccw_span(a0, a1) if ccw else -ccw_span(a1, a0)
    n = max(2, int(abs(math.degrees(span)) / step_deg) + 2)
    return [c + r * np.array([math.cos(a0 + span * t), math.sin(a0 + span * t)])
            for t in np.linspace(0, 1, n)]


def arc_mid(p0, p1, c, ccw):
    r = np.linalg.norm(p0 - c)
    a0 = math.atan2(p0[1] - c[1], p0[0] - c[0])
    a1 = math.atan2(p1[1] - c[1], p1[0] - c[0])
    span = ccw_span(a0, a1) if ccw else -ccw_span(a1, a0)
    am = a0 + span / 2
    return c + r * np.array([math.cos(am), math.sin(am)])


def reverse_element(e):
    if e[0] == "line":
        return ("line", e[2], e[1])
    if e[0] == "arc":
        return ("arc", e[2], e[1], e[3], not e[4])
    return e


def polygon_area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def point_in_polygon(q, poly):
    x, y = q
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xi > x:
                inside = not inside
    return inside


def circumcenter(a, b, c):
    d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
    need(abs(d) > 1e-12, "三点圆弧的三个点共线")
    ux = ((a @ a) * (b[1] - c[1]) + (b @ b) * (c[1] - a[1]) + (c @ c) * (a[1] - b[1])) / d
    uy = ((a @ a) * (c[0] - b[0]) + (b @ b) * (a[0] - c[0]) + (c @ c) * (b[0] - a[0])) / d
    return np.array([ux, uy])


def parse_vertex(item, what):
    """路径中的一项 → (点, 倒圆半径, 进入该点的线段)。"""
    if isinstance(item, list):
        return pt2(item, what), 0.0, ("line",)
    need(isinstance(item, dict), f"{what} 应为 [x, y] 或对象")
    if "arc" in item:
        p = pt2(item["arc"], f"{what}.arc")
        if "center" in item:
            seg = ("arc", pt2(item["center"], f"{what}.center"), not bool(item.get("cw", False)))
        elif "through" in item:
            seg = ("arc3", pt2(item["through"], f"{what}.through"))
        else:
            raise Bad(f"{what} 的圆弧需要 center（圆心）或 through（弧上一点）")
        need("r" not in item, f"{what}：圆弧终点不能再倒圆")
        return p, 0.0, seg
    need("p" in item, f"{what} 应写成 [x, y]、{{\"p\": [x, y], \"r\": 半径}} 或 {{\"arc\": [x, y], ...}}")
    r = num(item.get("r", 0), f"{what}.r", positive=True)
    return pt2(item["p"], f"{what}.p"), r, ("line",)


def parse_path(items, what):
    need(isinstance(items, list) and len(items) >= 2, f"{what} 至少需要两个点")
    verts = [parse_vertex(item, f"{what}[{i}]") for i, item in enumerate(items)]
    closing = ("line",)
    if len(verts) >= 2 and np.linalg.norm(verts[-1][0] - verts[0][0]) < 1e-6:
        closing = verts[-1][2]
        need(verts[-1][1] == 0, f"{what}：回到起点的那一项不能倒圆，请把倒圆写在第一项")
        verts = verts[:-1]
    n = len(verts)
    need(n >= 2, f"{what} 至少需要两个不同的点")
    pts = [v[0] for v in verts]
    fillet = [v[1] for v in verts]
    segs = [closing] + [v[2] for v in verts[1:]]  # segs[i]：从 i-1 到 i
    for i in range(n):
        need(np.linalg.norm(pts[i] - pts[i - 1]) > 1e-9, f"{what} 第 {i + 1} 个点与前一点重合")
    if n == 2:
        need(not (segs[0][0] == "line" and segs[1][0] == "line"), f"{what} 只有两个点且都是直线，不能围成轮廓")
    # 倒圆：每个顶点两侧都必须是直线
    trim = [0.0] * n
    fillet_arcs = {}
    for i in range(n):
        r = fillet[i]
        if r <= 0:
            continue
        j = (i + 1) % n
        need(segs[i][0] == "line" and segs[j][0] == "line",
             f"{what} 第 {i + 1} 个点：倒圆只能用于两条直线之间的顶点")
        d1 = pts[i] - pts[i - 1]
        d2 = pts[j] - pts[i]
        d1 /= np.linalg.norm(d1)
        d2 /= np.linalg.norm(d2)
        cross = d1[0] * d2[1] - d1[1] * d2[0]
        phi = math.atan2(abs(cross), float(d1 @ d2))
        need(phi > 1e-6 and phi < math.pi - 1e-6, f"{what} 第 {i + 1} 个点两侧共线，不能倒圆")
        t = r * math.tan(phi / 2)
        trim[i] = t
        bis = (-d1 + d2)
        bis /= np.linalg.norm(bis)
        c = pts[i] + bis * (r / math.cos(phi / 2))
        fillet_arcs[i] = (pts[i] - t * d1, pts[i] + t * d2, c, cross > 0)
    elements = []
    for k in range(1, n + 1):
        i = k % n
        a, b = pts[i - 1], pts[i]
        seg = segs[i]
        if seg[0] == "line":
            length = np.linalg.norm(b - a)
            need(trim[i - 1] + trim[i] <= length + 1e-9,
                 f"{what} 第 {i if i else n} 段到第 {i + 1} 个点：倒圆半径太大，直线长度不够")
            d = (b - a) / length
            a2, b2 = a + d * trim[i - 1], b - d * trim[i]
            if np.linalg.norm(b2 - a2) > 1e-9:
                elements.append(("line", a2, b2))
        elif seg[0] == "arc":
            c, ccw = seg[1], seg[2]
            r0, r1 = np.linalg.norm(a - c), np.linalg.norm(b - c)
            need(abs(r0 - r1) < 1e-3, f"{what} 第 {i + 1} 个点：圆弧起点、终点到圆心的距离不等"
                                      f"（{r0:.4f} 与 {r1:.4f}）")
            elements.append(("arc", a, b, c, ccw))
        else:
            m = seg[1]
            c = circumcenter(a, m, b)
            ccw = ((m - a)[0] * (b - m)[1] - (m - a)[1] * (b - m)[0]) > 0
            elements.append(("arc", a, b, c, ccw))
        if i in fillet_arcs:
            p0, p1, c, ccw = fillet_arcs[i]
            elements.append(("arc", p0, p1, c, ccw))
    return elements


def parse_loop(loop, what):
    need(isinstance(loop, dict), f"{what} 应为对象")
    kinds = [k for k in ("rect", "circle", "slot", "path", "polygon") if k in loop]
    need(len(kinds) == 1, f"{what} 应恰好包含 rect、circle、slot、path 之一")
    kind = kinds[0]
    if kind == "rect":
        v = loop["rect"]
        need(isinstance(v, list) and len(v) == 4, f"{what}.rect 应为 [x0, y0, x1, y1]")
        x0, y0, x1, y1 = (num(x, f"{what}.rect") for x in v)
        need(abs(x1 - x0) > 1e-9 and abs(y1 - y0) > 1e-9, f"{what}.rect 宽或高为零")
        r = num(loop.get("r", 0), f"{what}.r", positive=True)
        corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
        items = [{"p": c, "r": r} for c in corners] if r > 0 else corners
        lp = Loop(parse_path(items, what), what)
        lp.summary = f"{fmt(abs(x1 - x0))}×{fmt(abs(y1 - y0))}"
        return lp
    if kind == "circle":
        c = pt2(loop["circle"], f"{what}.circle")
        if "d" in loop:
            r = num(loop["d"], f"{what}.d", positive=True, allow_zero=False) / 2
        else:
            need("r" in loop, f"{what} 的圆需要 d（直径）或 r（半径）")
            r = num(loop["r"], f"{what}.r", positive=True, allow_zero=False)
        lp = Loop([("circle", c, r)], what)
        lp.summary = f"Φ{fmt(2 * r)}"
        return lp
    if kind == "slot":
        v = loop["slot"]
        need(isinstance(v, list) and len(v) == 2, f"{what}.slot 应为 [[x1, y1], [x2, y2]]")
        a, b = pt2(v[0], f"{what}.slot[0]"), pt2(v[1], f"{what}.slot[1]")
        w = num(loop.get("width"), f"{what}.width", positive=True, allow_zero=False)
        d = b - a
        need(np.linalg.norm(d) > 1e-9, f"{what}.slot 两个圆心重合")
        d /= np.linalg.norm(d)
        nl = np.array([-d[1], d[0]]) * w / 2
        return Loop([("line", a - nl, b - nl), ("arc", b - nl, b + nl, b, True),
                     ("line", b + nl, a + nl), ("arc", a + nl, a - nl, a, True)], what)
    return Loop(parse_path(loop[kind], f"{what}.{kind}"), what)


def parse_loops(feature):
    loops = feature.get("loops")
    need(isinstance(loops, list) and loops, "loops 应为非空数组（草图轮廓）")
    return [parse_loop(lp, f"loops[{i}]") for i, lp in enumerate(loops)]


def loop_depths(loops):
    depths = []
    for i, lp in enumerate(loops):
        q = lp.inner_point()
        depth = 0
        for j, other in enumerate(loops):
            if j != i and other.area > lp.area and point_in_polygon(q, other.poly):
                depth += 1
        depths.append(depth)
    return depths


def loop_face(loop, frame, offset=0.0):
    o = frame.o + frame.n * offset
    to3 = lambda p: pnt(o + p[0] * frame.xd + p[1] * frame.yd)
    mw = BRepBuilderAPI_MakeWire()
    for e in loop.elements:
        if e[0] == "line":
            edge = BRepBuilderAPI_MakeEdge(to3(e[1]), to3(e[2])).Edge()
        elif e[0] == "arc":
            _, p0, p1, c, ccw = e
            curve = GC_MakeArcOfCircle(to3(p0), to3(arc_mid(p0, p1, c, ccw)), to3(p1)).Value()
            edge = BRepBuilderAPI_MakeEdge(curve).Edge()
        else:
            c, r = e[1], e[2]
            circ = gp_Circ(gp_Ax2(to3(c), gdir(frame.n), gdir(frame.xd)), float(r))
            edge = BRepBuilderAPI_MakeEdge(circ).Edge()
        mw.Add(edge)
    need(mw.IsDone(), f"{loop.what} 的边无法首尾相连成封闭轮廓")
    mf = BRepBuilderAPI_MakeFace(gp_Pln(gp_Ax3(pnt(o), gdir(frame.n), gdir(frame.xd))), mw.Wire(), True)
    need(mf.IsDone(), f"{loop.what} 无法生成平面区域（可能自相交）")
    return mf.Face()


# ---------------------------------------------------------------- 布尔运算

def boolean(kind, body, tools, what="布尔运算"):
    cls = {"add": BRepAlgoAPI_Fuse, "cut": BRepAlgoAPI_Cut, "intersect": BRepAlgoAPI_Common}[kind]
    op = cls()
    args, tl = TopTools_ListOfShape(), TopTools_ListOfShape()
    args.Append(body)
    for t in tools:
        tl.Append(t)
    op.SetArguments(args)
    op.SetTools(tl)
    op.SetRunParallel(False)
    op.Build()
    need(op.IsDone(), f"{what}失败（OpenCascade 布尔运算报错）")
    return clean(op.Shape(), what)


def clean(shape, what="实体"):
    need(shape is not None and not shape.IsNull(), f"{what}结果为空")
    unify = ShapeUpgrade_UnifySameDomain(shape, True, True, False)
    unify.Build()
    result = unify.Shape()
    if not BRepCheck_Analyzer(result).IsValid():
        fix = ShapeFix_Shape(result)
        fix.Perform()
        result = fix.Shape()
        need(BRepCheck_Analyzer(result).IsValid(), f"{what}结果不是有效实体")
    return result


def fuse_all(tools):
    if len(tools) == 1:
        return clean(tools[0])
    return boolean("add", tools[0], tools[1:], "合并")


# ---------------------------------------------------------------- 特征

class Step:
    def __init__(self, index, ftype, label, kind, tools, result, axis=None, revolve=None):
        self.index, self.type, self.label, self.kind = index, ftype, label, kind
        self.tools, self.result, self.axis, self.revolve = tools, result, axis, revolve


class PartBuild:
    def __init__(self, name, title):
        self.name, self.title = name, title
        self.steps, self.warnings = [], []
        self.shape = None            # 最后一个成功步骤的实体（局部坐标）
        self.error = None            # {"part", "step", "message"}
        self.placement = np.eye(4)

    def placed(self):
        if self.shape is None:
            return None
        return transformed(self.shape, trsf_from_matrix(self.placement))


class Model:
    def __init__(self, problem, parts):
        self.problem, self.parts = problem, parts

    @property
    def ok(self):
        return all(p.error is None for p in self.parts)

    def errors(self):
        return [p.error for p in self.parts if p.error]

    def part(self, name):
        for p in self.parts:
            if p.name == name:
                return p
        return None


def depth_range(feature, body):
    """拉伸范围 [a, b]（沿草图法向）。"""
    through = feature.get("through")
    if through:
        need("depth" not in feature, "through 与 depth 只能写一个")
        big = 1000.0
        if body is not None:
            box = shape_bbox(body)
            if box:
                big = float(np.linalg.norm(box[1] - box[0])) * 2 + 1000.0
        if through is True:
            return -big, big
        need(through in ("+", "-"), "through 应为 true、\"+\" 或 \"-\"")
        return (0.0, big) if through == "+" else (-big, 0.0)
    need("depth" in feature, "缺少 depth（拉伸深度）")
    d = feature["depth"]
    if isinstance(d, list):
        need(len(d) == 2, "depth 写成数组时应为 [起点, 终点]")
        a, b = num(d[0], "depth[0]"), num(d[1], "depth[1]")
    else:
        v = num(d, "depth")
        a, b = (0.0, v) if v >= 0 else (v, 0.0)
    need(b - a > 1e-9, "拉伸深度为零（depth 终点应大于起点）")
    return a, b


def profile_tool(loops, make_solid):
    depths = loop_depths(loops)
    by_depth = {}
    for lp, dep in zip(loops, depths):
        by_depth.setdefault(dep, []).append(make_solid(lp))
    tool = None
    for dep in sorted(by_depth):
        solids = by_depth[dep]
        if tool is None:
            need(dep == 0, "草图轮廓嵌套关系有误")
            tool = fuse_all(solids)
        else:
            tool = boolean("cut" if dep % 2 else "add", tool, solids, "草图内外环组合")
    return tool


def feat_extrude(feature, body):
    frame = sketch_frame(feature)
    loops = parse_loops(feature)
    a, b = depth_range(feature, body)

    def solid(lp):
        face = loop_face(lp, frame, a)
        return BRepPrimAPI_MakePrism(face, gp_Vec(*(frame.n * (b - a)))).Shape()

    tool = profile_tool(loops, solid)
    axis = frame.n if b >= -a else -frame.n
    return tool, {"axis": axis, "loops": loops, "depth": (a, b)}


def revolve_axis(feature, frame):
    ax = feature.get("axis", "y")
    if isinstance(ax, str):
        key = ax.strip().lower()
        need(key in ("x", "y"), "revolve 的 axis 应为 \"x\"、\"y\" 或 {\"point\": [x, y], \"dir\": [dx, dy]}")
        p, d = np.zeros(2), np.array([1.0, 0.0]) if key == "x" else np.array([0.0, 1.0])
    else:
        need(isinstance(ax, dict) and "dir" in ax, "revolve 的 axis 需要 dir")
        p = pt2(ax.get("point", [0, 0]), "axis.point")
        d = unit(pt2(ax["dir"], "axis.dir"), "axis.dir")
    return p, d


def feat_revolve(feature, body):
    frame = sketch_frame(feature)
    loops = parse_loops(feature)
    p2, d2 = revolve_axis(feature, frame)
    for lp in loops:
        rel = lp.poly - p2
        side = rel[:, 0] * d2[1] - rel[:, 1] * d2[0]
        need(side.min() >= -1e-6 or side.max() <= 1e-6, f"{lp.what} 跨过了旋转轴")
    ang = feature.get("angle", 360)
    if isinstance(ang, list):
        need(len(ang) == 2, "angle 写成数组时应为 [起始角, 终止角]")
        a0, a1 = num(ang[0], "angle[0]"), num(ang[1], "angle[1]")
    else:
        a0, a1 = 0.0, num(ang, "angle")
    need(1e-6 < abs(a1 - a0) <= 360 + 1e-9, "旋转角度应在 0 到 360 度之间")
    o3 = frame.to3(p2)
    d3 = frame.vec3(d2)
    ax1 = gp_Ax1(pnt(o3), gdir(d3))

    def solid(lp):
        face = loop_face(lp, frame)
        if abs(a0) > 1e-9:
            t = gp_Trsf()
            t.SetRotation(ax1, math.radians(a0))
            face = transformed(face, t)
        if abs(abs(a1 - a0) - 360) < 1e-9:
            return BRepPrimAPI_MakeRevol(face, ax1).Shape()
        return BRepPrimAPI_MakeRevol(face, ax1, math.radians(a1 - a0)).Shape()

    tool = profile_tool(loops, solid)
    return tool, {"revolve": {"origin": o3, "axis": d3}, "angle": (a0, a1)}


def feat_hole(feature, body):
    frame = sketch_frame(feature)
    at = feature.get("at")
    need(isinstance(at, list) and at, "hole 需要 at（孔中心，草图坐标 [x, y] 或其数组）")
    centers = [pt2(at, "at")] if not isinstance(at[0], list) else [pt2(p, f"at[{i}]") for i, p in enumerate(at)]
    r = num(feature.get("d"), "d", positive=True, allow_zero=False) / 2
    through = bool(feature.get("through", False))
    if through:
        need("depth" not in feature, "through 与 depth 只能写一个")
        depth = 1000.0
        if body is not None and shape_bbox(body):
            lo, hi = shape_bbox(body)
            depth = float(np.linalg.norm(hi - lo)) * 2 + 1000.0
    else:
        depth = num(feature.get("depth"), "depth（孔深；通孔写 \"through\": true）", positive=True, allow_zero=False)
    prof = [(0.0, 0.0)]
    top_depth = 0.0
    cb = feature.get("cbore") or feature.get("spotface")
    if feature.get("cbore") and feature.get("spotface"):
        raise Bad("cbore 与 spotface 只能写一个")
    if cb:
        need(isinstance(cb, dict), "cbore/spotface 应为 {\"d\": 直径, \"depth\": 深度}")
        rc = num(cb.get("d"), "cbore.d", positive=True, allow_zero=False) / 2
        dc = num(cb.get("depth"), "cbore.depth", positive=True, allow_zero=False)
        need(rc > r + 1e-9, "沉孔/锪平直径应大于孔径")
        need(through or dc < depth - 1e-9, "沉孔/锪平深度应小于孔深")
        prof += [(rc, 0.0), (rc, dc), (r, dc)]
        top_depth = dc
    cs = feature.get("csink")
    if cs:
        need(not cb, "csink 不能与 cbore/spotface 同时使用")
        need(isinstance(cs, dict), "csink 应为 {\"d\": 大端直径, \"angle\": 锥角}")
        rk = num(cs.get("d"), "csink.d", positive=True, allow_zero=False) / 2
        ang = num(cs.get("angle", 90), "csink.angle", positive=True, allow_zero=False)
        need(rk > r + 1e-9 and ang < 180, "锥孔大端直径应大于孔径，锥角小于 180°")
        h = (rk - r) / math.tan(math.radians(ang) / 2)
        need(through or h < depth - 1e-9, "锥孔深度超过孔深")
        prof += [(rk, 0.0), (r, h)]
        top_depth = h
    if not cb and not cs:
        prof.append((r, 0.0))
    prof.append((r, depth))
    tip = feature.get("tip_angle")
    if tip and not through:
        ta = num(tip, "tip_angle", positive=True, allow_zero=False)
        need(ta < 180, "tip_angle 应小于 180°")
        prof.append((0.0, depth + r / math.tan(math.radians(ta) / 2)))
    else:
        prof.append((0.0, depth))
    d = -frame.n if not feature.get("reverse") else frame.n
    tools = []
    for c2 in centers:
        c3 = frame.to3(c2)
        mw = BRepBuilderAPI_MakeWire()
        pts = [pnt(c3 + rr * frame.xd + zz * d) for rr, zz in prof]
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            if a.Distance(b) > 1e-9:
                mw.Add(BRepBuilderAPI_MakeEdge(a, b).Edge())
        need(mw.IsDone(), "孔的截面轮廓无法生成")
        face = BRepBuilderAPI_MakeFace(mw.Wire(), True).Face()
        tools.append(BRepPrimAPI_MakeRevol(face, gp_Ax1(pnt(c3), gdir(d))).Shape())
    return tools, {"axis": d, "count": len(centers), "r": r, "through": through, "depth": depth}


def feature_refs(feature, records, index):
    refs = feature.get("features")
    need(refs is not None, "需要 features（被阵列或镜像的特征序号数组，从 1 开始）")
    if refs == "all":
        return "all"
    need(isinstance(refs, list) and refs, "features 应为特征序号数组")
    out = []
    for r in refs:
        need(isinstance(r, int) and not isinstance(r, bool), "features 中应为整数序号")
        need(1 <= r < index, f"features 中的 {r} 不是本特征之前的特征序号")
        out.append(r)
    return out


def ref_tools(refs, records):
    tools = []
    for r in refs:
        need(bool(records[r - 1]), f"第{r}个特征是棱修饰，不能作为阵列/镜像的独立工具；请复制基础几何后再修饰")
        tools.extend(records[r - 1])
    return tools


def copies(tools, trsfs):
    return [(transformed(t, tr), op) for tr in trsfs for t, op in tools]


def feat_pattern_linear(feature, records, index):
    refs = feature_refs(feature, records, index)
    need(refs != "all", "阵列不能用 \"all\"")
    d1 = unit(vec(feature.get("dir"), 3, "dir"), "dir")
    s1 = num(feature.get("spacing"), "spacing")
    n1 = feature.get("count")
    need(isinstance(n1, int) and n1 >= 1, "count 应为正整数（含原特征）")
    n2, s2, d2 = 1, 0.0, np.zeros(3)
    if "count2" in feature or "dir2" in feature:
        d2 = unit(vec(feature.get("dir2"), 3, "dir2"), "dir2")
        s2 = num(feature.get("spacing2"), "spacing2")
        n2 = feature.get("count2")
        need(isinstance(n2, int) and n2 >= 1, "count2 应为正整数")
    need(n1 * n2 >= 2, "阵列至少要有 2 个实例")
    trsfs = []
    for i in range(n1):
        for j in range(n2):
            if i == 0 and j == 0:
                continue
            t = gp_Trsf()
            t.SetTranslation(gp_Vec(*(d1 * s1 * i + d2 * s2 * j)))
            trsfs.append(t)
    return refs, trsfs, f"{n1}×{n2}" if n2 > 1 else f"{n1} 个"


def feat_pattern_circular(feature, records, index):
    refs = feature_refs(feature, records, index)
    need(refs != "all", "阵列不能用 \"all\"")
    ax = feature.get("axis")
    need(isinstance(ax, dict) and "dir" in ax, "axis 应为 {\"point\": [x, y, z], \"dir\": [dx, dy, dz]}")
    p = vec(ax.get("point", [0, 0, 0]), 3, "axis.point")
    d = axis_vector(ax["dir"], "axis.dir")
    n = feature.get("count")
    need(isinstance(n, int) and n >= 2, "count 应为不小于 2 的整数（含原特征）")
    step = num(feature.get("step", 360.0 / n), "step")
    trsfs = []
    for k in range(1, n):
        t = gp_Trsf()
        t.SetRotation(gp_Ax1(pnt(p), gdir(d)), math.radians(step * k))
        trsfs.append(t)
    return refs, trsfs, f"{n} 个，间隔 {fmt(step)}°"


def feat_mirror(feature, records, index):
    refs = feature_refs(feature, records, index)
    plane = feature.get("plane", "YZ")
    if isinstance(plane, str):
        key = plane.strip().upper()
        need(key in NAMED_PLANES, "镜像 plane 应为 XY、YZ、ZX 等或 {\"point\": [...], \"normal\": [...]}")
        xd, yd = NAMED_PLANES[key]
        n = np.cross(xd, yd).astype(float)
        p = vec(feature["origin"], 3, "origin") if "origin" in feature else np.zeros(3)
    else:
        need(isinstance(plane, dict) and "normal" in plane, "镜像 plane 需要 normal")
        n = unit(vec(plane["normal"], 3, "plane.normal"), "plane.normal")
        p = vec(plane.get("point", [0, 0, 0]), 3, "plane.point")
    t = gp_Trsf()
    t.SetMirror(gp_Ax2(pnt(p), gdir(n)))
    return refs, [t], "镜像"


def feat_edge_finish(feature, body):
    """以边上见证点选择棱，避免不稳定的拓扑序号。每点必须唯一命中一条边。"""
    need(body is not None, "倒圆/倒角之前还没有实体")
    key = "radius" if feature["type"] == "fillet" else "distance"
    amount = num(feature.get(key), key, positive=True, allow_zero=False)
    points = feature.get("edges")
    need(isinstance(points, list) and points, "edges 应为棱上见证点的非空数组，如 [[20,0,5]]")
    tol = num(feature.get("tolerance", 0.05), "tolerance", positive=True, allow_zero=False)
    need(tol <= 0.2, "棱选择容差不得超过0.2毫米")
    edges=[]
    ex=TopExp_Explorer(body, TopAbs_EDGE)
    while ex.More():
        edge=TopoDS.Edge_s(ex.Current())
        if not any(edge.IsSame(e) for e in edges): edges.append(edge)
        ex.Next()
    selected=[]
    for i, point in enumerate(points):
        vertex=BRepBuilderAPI_MakeVertex(pnt(vec(point,3,f"edges[{i}]"))).Vertex()
        hits=[]
        for edge in edges:
            dist=BRepExtrema_DistShapeShape(vertex,edge)
            dist.Perform()
            if dist.IsDone() and dist.Value() <= tol: hits.append(edge)
        need(len(hits)==1, f"edges[{i}] 命中{len(hits)}条棱；见证点须在棱中部，避开端点")
        need(not any(hits[0].IsSame(e) for e in selected), f"edges[{i}] 重复选择同一条棱")
        selected.append(hits[0])
    maker=(BRepFilletAPI_MakeFillet(body) if feature["type"]=="fillet" else BRepFilletAPI_MakeChamfer(body))
    for edge in selected: maker.Add(amount,edge)
    maker.Build()
    need(maker.IsDone(), "倒圆/倒角失败：请检查半径、距离和相邻结构")
    result=clean(maker.Shape(),"倒圆/倒角")
    need(count_solids(result)==count_solids(body),"倒圆/倒角改变了实体数量")
    return result, {"summary": ("R" if key=="radius" else "C")+fmt(amount)+f"，{len(selected)}条棱"}


def feature_label(ftype, op, feature, info):
    name = feature.get("name")
    head = TYPE_CN.get(ftype, ftype)
    if ftype in ("extrude", "revolve") and op != "add":
        head += OP_CN[op]
    detail = ""
    if ftype == "extrude":
        loops = info["loops"]
        a, b = info["depth"]
        depth = "通" if feature.get("through") else fmt(b - a)
        if len(loops) == 1 and loops[0].summary:
            detail = f"{loops[0].summary}×{depth}"
        else:
            detail = f"深 {depth}"
    elif ftype == "revolve":
        a0, a1 = info["angle"]
        detail = f"{fmt(a1 - a0)}°"
    elif ftype == "hole":
        n = info["count"]
        detail = (f"{n}×" if n > 1 else "") + f"Φ{fmt(info['r'] * 2)}"
        detail += " 通孔" if info["through"] else f" 深{fmt(info['depth'])}"
        if feature.get("cbore"):
            detail += f" 沉孔Φ{fmt(feature['cbore']['d'])}"
        if feature.get("spotface"):
            detail += f" 锪平Φ{fmt(feature['spotface']['d'])}"
        if feature.get("csink"):
            detail += f" 锥孔Φ{fmt(feature['csink']['d'])}"
    else:
        detail = info.get("summary", "")
    parts = [head]
    if name:
        parts.append(str(name))
    if detail:
        parts.append(detail)
    return " · ".join([parts[0], " ".join(parts[1:])]) if len(parts) > 1 else head


def build_part(spec, index):
    need_dict = isinstance(spec, dict)
    name = str(spec.get("name", index)) if need_dict else str(index)
    title = spec.get("title", "") if need_dict else ""
    part = PartBuild(name, title)
    if not need_dict:
        part.error = {"part": name, "step": None, "message": "零件应为 JSON 对象"}
        return part
    try:
        part.placement = placement_matrix(spec.get("placement"))
    except Bad as exc:
        part.error = {"part": name, "step": None, "message": str(exc)}
        return part
    features = spec.get("features")
    if not isinstance(features, list) or not features:
        part.error = {"part": name, "step": None, "message": "features 应为非空数组"}
        return part
    body = None
    records = []  # 每个特征代表的 (工具实体, 运算) 列表，供阵列、镜像引用
    axes = {}
    for k, feature in enumerate(features, start=1):
        try:
            need(isinstance(feature, dict), "特征应为 JSON 对象")
            ftype = feature.get("type")
            need(ftype in TYPE_CN, f"未知的特征类型 {json.dumps(ftype, ensure_ascii=False)}；"
                                   f"可用：{'、'.join(TYPE_CN)}")
            axis = revolve = None
            if ftype in ("fillet", "chamfer"):
                result, info = feat_edge_finish(feature, body)
                removed=boolean("cut",body,[result],"棱修饰除料")
                added=boolean("cut",result,[body],"棱修饰加料")
                step_tools=[s for s in (removed,added) if shape_volume(s)>1e-7]
                label=feature_label(ftype,"cut",feature,info)
                kind="add" if shape_volume(result)>shape_volume(body) else "cut"
                part.steps.append(Step(k,ftype,label,kind,step_tools,result))
                records.append([])
                axes[k]=None
                body=result
                part.shape=body
                continue
            if ftype in ("extrude", "revolve", "hole"):
                op = feature.get("op", "cut" if ftype == "hole" else "add")
                need(op in OP_CN, "op 应为 \"add\"、\"cut\" 或 \"intersect\"")
                need(ftype != "hole" or op == "cut", "孔只能除料（op 为 \"cut\"）")
                if ftype == "extrude":
                    tool, info = feat_extrude(feature, body)
                    tools, axis = [tool], info["axis"]
                elif ftype == "revolve":
                    tool, info = feat_revolve(feature, body)
                    tools, revolve = [tool], info["revolve"]
                else:
                    tools, info = feat_hole(feature, body)
                    axis = info["axis"]
                ops = [(t, op) for t in tools]
                own = ops
            else:
                maker = {"pattern_linear": feat_pattern_linear, "pattern_circular": feat_pattern_circular,
                         "mirror": feat_mirror}[ftype]
                refs, trsfs, summary = maker(feature, records, k)
                info = {"summary": summary}
                need(body is not None, "阵列或镜像之前还没有实体")
                if refs == "all":
                    ops = [(transformed(body, trsfs[0]), "add")]
                    own = ops
                else:
                    base = ref_tools(refs, records)
                    ops = copies(base, trsfs)
                    own = base + ops
                op = ops[0][1] if len({o for _, o in ops}) == 1 else "add"
                axis = None
                if refs != "all" and axes.get(refs[0]) is not None:
                    v = gp_Vec(*axes[refs[0]]).Transformed(trsfs[0])
                    axis = np.array([v.X(), v.Y(), v.Z()])
            need(body is not None or all(o == "add" for _, o in ops), "第一个特征必须是加料（op 为 \"add\"）")
            before = shape_volume(body) if body is not None else 0.0
            solids_before = count_solids(body) if body is not None else 0
            result = body
            for o in ("add", "cut", "intersect"):
                group = [t for t, oo in ops if oo == o]
                if not group:
                    continue
                if result is None:
                    result = fuse_all(group)
                else:
                    result = boolean(o, result, group, OP_CN[o])
            after = shape_volume(result)
            need(after > 1e-6, "运算后实体体积为零（被完全切除，或轮廓方向、深度有误）")
            if body is not None and op == "cut" and abs(after - before) <= 1e-7 * max(1.0, before):
                part.warnings.append(f"零件 {name} 第 {k} 个特征除料没有切到实体（体积未变）")
            if body is not None and op == "add" and count_solids(result) > solids_before:
                part.warnings.append(f"零件 {name} 第 {k} 个特征加料后出现分离的实体（与已有实体不相连）")
            label = feature_label(ftype, op, feature, info)
            kind = "add" if op == "add" else "cut"
            step_tools = [t for t, _ in ops]
            if op == "intersect" and body is not None:
                # 回放把求交显示成"挖掉了交集以外的部分"
                step_tools = [boolean("cut", body, [result], "求交显示")]
            part.steps.append(Step(k, ftype, label, kind, step_tools, result,
                                   axis=None if axis is None else np.asarray(axis, float), revolve=revolve))
            records.append(own)
            axes[k] = None if axis is None else np.asarray(axis, float)
            body = result
            part.shape = body
        except Bad as exc:
            part.error = {"part": name, "step": k, "message": str(exc)}
            return part
        except Exception as exc:  # OpenCascade 内部异常
            part.error = {"part": name, "step": k, "message": f"几何运算异常：{type(exc).__name__} {exc}"}
            return part
    return part


def build(desc, problem=None):
    """desc 为已解析的 JSON 对象。整份描述格式不对时抛出 ModelError。"""
    if not isinstance(desc, dict):
        raise ModelError("建模描述应为 JSON 对象")
    parts = desc.get("parts")
    if not isinstance(parts, list) or not parts:
        raise ModelError("缺少 parts（零件数组）")
    names = set()
    out = []
    for i, spec in enumerate(parts, start=1):
        part = build_part(spec, i)
        if part.name in names:
            raise ModelError(f"零件名 {part.name} 重复")
        names.add(part.name)
        out.append(part)
    return Model(desc.get("problem", problem), out)


def load(path):
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError) as exc:
        raise ModelError(f"无法读取文件 {path}（请使用 UTF-8 编码）：{type(exc).__name__}")
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ModelError(f"JSON 无法解析：第 {exc.lineno} 行第 {exc.colno} 列，请检查引号、逗号、括号和值")


def problem_id(path, desc=None):
    """题号：优先取文件名 第NN题，其次 JSON 的 problem 字段。"""
    m = re.fullmatch(r"第(.+)题", Path(path).stem)
    if m:
        return m.group(1)
    if isinstance(desc, dict) and isinstance(desc.get("problem"), str) and desc["problem"].strip():
        return desc["problem"].strip()
    m = re.search(r"(\d{2})", Path(path).stem)
    return m.group(1) if m else None
