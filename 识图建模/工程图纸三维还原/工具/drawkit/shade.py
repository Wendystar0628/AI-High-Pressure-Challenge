"""轴测着色图：numpy 深度缓冲光栅化 + 精确消隐的可见棱线。"""
import math

import numpy as np
from PIL import Image, ImageDraw

from . import geom2d as g2
from . import project
from .mesh import triangulate

PALETTE = [(176, 196, 222), (222, 196, 160), (180, 214, 180), (230, 180, 180), (205, 190, 225),
           (200, 220, 230), (235, 215, 160), (190, 190, 190)]
VIEWS = {
    "轴测-1": ((1, 1, -1), (0, 0, 1)),     # 从左前上方看
    "轴测-2": ((-1, -1, -1), (0, 0, 1)),   # 从右后上方看
}


def render(shapes, direction, up=(0, 0, 1), size=(1400, 1050), margin=60, ss=2):
    """shapes: [(实体, 颜色)]。返回 PIL 图像。"""
    d = np.asarray(direction, float)
    d /= np.linalg.norm(d)
    u, v = project.frame_axes(d, up)
    w = -d
    W, H = size[0] * ss, size[1] * ss
    tris = []
    for shape, color in shapes:
        V, F = triangulate(shape, 0.05, 0.2)
        if len(F):
            tris.append((V, F, color))
    img = Image.new("RGB", (W, H), (255, 255, 255))
    if not tris:
        return img.resize(size, Image.LANCZOS)
    allv = np.concatenate([t[0] for t in tris])
    xs, ys = allv @ u, allv @ v
    k = min((W - 2 * margin * ss) / max(xs.max() - xs.min(), 1e-6), (H - 2 * margin * ss) / max(ys.max() - ys.min(), 1e-6))
    cx, cy = (xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2
    to_px = lambda x, y: (W / 2 + (x - cx) * k, H / 2 - (y - cy) * k)
    zbuf = np.full((H, W), -np.inf)
    rgb = np.full((H, W, 3), 255.0)
    light = np.array([0.35, 0.55, 0.75])
    light = light[0] * u + light[1] * v + light[2] * w
    light /= np.linalg.norm(light)
    for V, F, color in tris:
        a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
        n = np.cross(b - a, c - a)
        nl = np.linalg.norm(n, axis=1)
        good = nl > 1e-12
        n[good] /= nl[good, None]
        facing = n @ w
        shade = 0.38 + 0.62 * np.abs(n @ light) * np.where(facing > 0, 1.0, 0.6)
        P = [np.stack(to_px(p @ u, p @ v), axis=1) for p in (a, b, c)]
        Z = [p @ w for p in (a, b, c)]
        col = np.asarray(color, float)
        for i in np.nonzero(good)[0]:
            x0, y0 = P[0][i]
            x1, y1 = P[1][i]
            x2, y2 = P[2][i]
            xmin, xmax = int(max(0, math.floor(min(x0, x1, x2)))), int(min(W - 1, math.ceil(max(x0, x1, x2))))
            ymin, ymax = int(max(0, math.floor(min(y0, y1, y2)))), int(min(H - 1, math.ceil(max(y0, y1, y2))))
            if xmax < xmin or ymax < ymin:
                continue
            den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(den) < 1e-12:
                continue
            gx, gy = np.meshgrid(np.arange(xmin, xmax + 1) + 0.5, np.arange(ymin, ymax + 1) + 0.5)
            l0 = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / den
            l1 = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / den
            l2 = 1 - l0 - l1
            m = (l0 >= -1e-9) & (l1 >= -1e-9) & (l2 >= -1e-9)
            if not m.any():
                continue
            z = l0 * Z[0][i] + l1 * Z[1][i] + l2 * Z[2][i]
            sub = zbuf[ymin:ymax + 1, xmin:xmax + 1]
            upd = m & (z > sub)
            if upd.any():
                sub[upd] = z[upd]
                rgb[ymin:ymax + 1, xmin:xmax + 1][upd] = col * shade[i]
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    # 精确消隐的可见棱线
    pj = project.Projector({"u": list(u), "v": list(v), "origin": [0, 0, 0]})
    vis, _ = project.hlr([s for s, _ in shapes], pj)
    dr = ImageDraw.Draw(img)
    lw = max(1, int(1.6 * ss))
    for c in g2.merge(vis, priority=("visible",)):
        pts = g2.sample(c, 2.0 / k)
        xy = [to_px(x, y) for x, y in pts]
        dr.line(xy, fill=(40, 40, 40), width=lw, joint="curve")
    return img.resize(size, Image.LANCZOS)
