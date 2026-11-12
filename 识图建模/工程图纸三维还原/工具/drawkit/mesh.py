"""实体三角化（numpy 数组）。"""
import numpy as np
from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRepTools import BRepTools
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS


def triangulate(shape, linear=0.1, angular=0.25):
    """返回 (V, F)：顶点 N×3、三角形 M×3（外法向按右手定则）。"""
    if shape is None or shape.IsNull():
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    BRepTools.Clean_s(shape)
    BRepMesh_IncrementalMesh(shape, linear, False, angular, True)
    verts, faces, off = [], [], 0
    ex = TopExp_Explorer(shape, TopAbs_FACE)
    while ex.More():
        face = TopoDS.Face_s(ex.Current())
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is not None:
            tr = loc.Transformation()
            n = tri.NbNodes()
            pts = np.empty((n, 3))
            for i in range(1, n + 1):
                p = tri.Node(i).Transformed(tr)
                pts[i - 1] = (p.X(), p.Y(), p.Z())
            m = tri.NbTriangles()
            idx = np.empty((m, 3), np.int64)
            for i in range(1, m + 1):
                a, b, c = tri.Triangle(i).Get()
                idx[i - 1] = (a - 1, b - 1, c - 1)
            if face.Orientation() == TopAbs_REVERSED:
                idx = idx[:, [0, 2, 1]]
            verts.append(pts)
            faces.append(idx + off)
            off += n
        ex.Next()
    if not verts:
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    return np.concatenate(verts), np.concatenate(faces)


def transform(V, m):
    """4×4 矩阵作用于顶点。"""
    if len(V) == 0:
        return V
    return V @ m[:3, :3].T + m[:3, 3]


def areas(V, F):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    return 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)


def subdivide(V, F, max_edge):
    """最长边二分：把边长超过 max_edge 的三角形沿最长边中点一分为二，直到所有边都不超过 max_edge。"""
    allv = np.asarray(V, float)
    F = np.asarray(F, np.int64)
    out = []
    while len(F):
        a, b, c = allv[F[:, 0]], allv[F[:, 1]], allv[F[:, 2]]
        L = np.stack([np.linalg.norm(b - a, axis=1), np.linalg.norm(c - b, axis=1), np.linalg.norm(a - c, axis=1)], 1)
        ok = L.max(axis=1) <= max_edge
        out.append(F[ok])
        F, L = F[~ok], L[~ok]
        if not len(F):
            break
        k = L.argmax(axis=1)
        # 旋转顶点顺序，使最长边为 (i0, i1)
        order = np.stack([k, (k + 1) % 3, (k + 2) % 3], 1)
        G = np.take_along_axis(F, order, axis=1)
        mid = (allv[G[:, 0]] + allv[G[:, 1]]) / 2
        im = np.arange(len(allv), len(allv) + len(G))
        allv = np.concatenate([allv, mid])
        F = np.concatenate([np.stack([G[:, 0], im, G[:, 2]], 1), np.stack([im, G[:, 1], G[:, 2]], 1)])
    return allv, (np.concatenate(out) if out else np.zeros((0, 3), np.int64))
