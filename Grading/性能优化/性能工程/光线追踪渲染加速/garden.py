"""江南园林小样：光线追踪渲染加速题综合场景的调研用生成程序（验证用，不是定稿）。

一座被粉墙围住的小园：中间是不规则的水池（带镜面系数），池边叠石驳岸；右侧池畔一座六角攒尖亭，
左后方一组太湖石假山和一棵松，后墙左半贴着一段单面廊，右半是白墙前的竹丛和石笋，墙上开漏窗和月洞门，
月洞门后是一个小后院（芭蕉、湖石峰、后界墙）；池上一道三折曲桥，池里有荷叶荷花；右侧一棵红枫和石桌石凳；
墙外是远处的树和一座塔。全部三角形由本程序用公式和固定种子的随机数生成，不读任何模型或贴图。
输出题目的场景文件格式（8 个 uint32 + 16 个 float32 + 每个三角形 13 个 float32）。

  python garden.py --out g.bin                 默认参数、机位 A
  python garden.py --out g.bin --cam B         换机位（A 隔水正望、B 岸边平视、C 高处斜俯、D 月洞门前）
  python garden.py --out g.bin --seed 7        换种子（池形、假山、植物、漏窗花样都跟着变）
  python garden.py --out g.bin --check         生成后自查重复面和共面重叠
  python garden.py --help                      全部旋钮

只依赖 numpy。坐标：y 向上，地面 y=0，单位是米；后墙在 -z 方向，相机在 +z 一侧。所有大平面（地面、水面、墙）与坐标轴对齐。
"""
import argparse
import json
import math
import struct
from pathlib import Path

import numpy as np

TAU = 2 * math.pi

# ------------------------------------------------------------------ 旋钮
# 注释里写的是每个旋钮主要影响哪一块开销：建树 / 遮挡查询 / 最近交点查询 / 每样本自身。
DEFAULTS = dict(
    # 画面和采样（写进文件头）
    width=1920, height=1080,     # 分辨率：三块光线开销同比例变，建树不变
    spp=48,                       # 每像素样本数：三块光线开销同比例变，建树不变
    ao=1,                        # 每个交点的遮挡光线数：遮挡查询（也带一点每样本自身）
    depth=4,                     # 反射层数：最近交点查询
    ao_radius=1.6,               # 遮挡半径（米）：遮挡查询每条走多远
    render_seed=-1,              # 采样种子；-1 表示由 seed 推出
    seed=1,                      # 池形、假山、植物、漏窗花样的种子
    # 水和地面
    water_mirror=0.5,            # 水面镜面系数：最近交点查询（反射光线）
    ripple=0.0012,               # 水面细波纹的起伏幅度（米）；0 为整块平镜（两个三角形）
    water_n=64,                  # 水面网格沿长边的格数：建树；碎面越多反射方向越散
    paving_mirror=0.0,           # 铺地的镜面系数（0 是干地面；雨后湿地面 0.10–0.20，会把地上的影子冲淡）：最近交点查询
    # 规模
    bamboo=46,                   # 竹竿总数：建树、遮挡查询（竹叶是细碎遮挡物）
    leaves=1.0,                  # 每根竹的叶量倍数：建树、遮挡查询
    lotus=64,                    # 荷叶片数：建树
    rock_cell=0.19,              # 假山等值面的网格边长（米），越小面越多：建树
    peak_cell=1.25,               # 独立湖石峰的网格边长倍数（越大面越少）：建树
    bank_split=0.55,              # 驳岸石半径小于它的用粗网格（80 面），其余用细网格（320 面）：建树
    tile_pitch=0.25,              # 瓦垄间距（米），越小瓦垄越多：建树、遮挡查询
    grass=180,                   # 草丛数：建树
    far_trees=13,                # 墙外远树棵数：建树
    pine_tufts=36,               # 每个松针团里的针簇数：建树、遮挡查询
    # 相机与光
    cam='A',                     # 机位预设 A/B/C/D
    fov=0.0,                     # 竖直视场角（度），0 用预设
    eye='', target='',           # "x,y,z"，给了就覆盖预设
    light_azimuth=-55.0,         # 方向光方位：从 +z 转向 +x 为正（负值＝光从相机左前方来）
    light_elevation=36.0,        # 方向光高度角
)

CAMS = {   # 机位：眼睛、注视点、竖直视场角
    'A': ((1.5, 4.2, 21.5), (0.5, 1.19, -3.0), 36.0),      # 隔水正望：楼上凭栏的高度，水面占下半幅，后墙和天空在上
    'B': ((-10.9, 1.65, 7.4), (6.0, 2.1, -3.5), 44.0),     # 岸边平视：人眼高度，斜望亭子和竹墙，倒影最大
    'C': ((17.5, 13.0, 21.0), (-0.5, 0.0, 0.0), 31.0),     # 高处斜俯：全园布局和地上的影子，天空很少
    'D': ((2.4, 1.6, -5.0), (1.0, 1.4, -13.0), 46.0),      # 月洞门前：框景（门洞里的湖石和芭蕉）
}


# ------------------------------------------------------------------ 颜色（按实物取色，十六进制 sRGB → 线性值）
def lin(h):
    h = h.lstrip('#')
    return np.array([(int(h[i:i + 2], 16) / 255.0) ** 2.2 for i in (0, 2, 4)])


def mix(a, b, t):
    return np.asarray(a) * (1 - t) + np.asarray(b) * t


WALL_WHITE = lin('#F1EEE6')                                  # 粉墙：石灰白，略带暖
WALL_STAIN = lin('#DDD9CF')                                  # 墙脚受潮的灰白
TILE = [lin(x) for x in ('#4B5157', '#565C62', '#42484E')]   # 黛瓦：小青瓦的青灰
TILE_EDGE = lin('#6A7075')                                   # 瓦当滴水，磨得浅一点
RIDGE = lin('#3A3F44')                                       # 屋脊
WOOD = lin('#6B3B26')                                        # 栗壳色木构（柱、枋）
WOOD_D = lin('#55301F')                                      # 挂落、栏杆、窗棂（深一档）
CEIL = lin('#D9D3C5')                                        # 望砖刷白后的屋面底
GRANITE = lin('#B8B1A3')                                     # 金山石台基、阶沿、桥板
GRANITE_D = lin('#A29B8E')
BRICK = [lin(x) for x in ('#8F928D', '#959893', '#8A8E8C')]  # 青砖铺地
FLAG = [lin(x) for x in ('#A9A59A', '#B5B0A4', '#9C9A92')]   # 池边石板
SOIL, MOSS = lin('#5E5142'), lin('#6F7D45')
TAIHU = [lin(x) for x in ('#BFBEB8', '#A9AAA5', '#CBC9C1')]  # 太湖石：灰白
HUANG = [lin(x) for x in ('#9E917A', '#8E8470', '#ABA089')]  # 黄石驳岸：灰里带土黄
WATER = lin('#2F4A3C')                                       # 池水：深绿
CULM = [lin(x) for x in ('#6E8B3D', '#7C9645', '#5F7D38')]   # 竹竿
BLEAF = [lin(x) for x in ('#4F7A2E', '#6A9438', '#86A94A', '#5C8733')]   # 竹叶
PINE = [lin(x) for x in ('#2F5233', '#3D6B3A', '#274A2E')]   # 松针
BARK = lin('#6E4E3C')                                        # 松树皮
LOTUS = [lin(x) for x in ('#4E8C4A', '#6BA85A', '#3F7A44')]  # 荷叶
PETAL = [lin(x) for x in ('#F2A9B8', '#F8CBD3', '#EE8FA6')]  # 荷花
POD = lin('#C9B458')
MAPLE = [lin(x) for x in ('#B5382A', '#D0502E', '#9E2E26')]  # 红枫
TRUNK = lin('#5A4336')
BANANA = [lin(x) for x in ('#5FA040', '#74B24E')]            # 芭蕉
GRASS = [lin(x) for x in ('#3F6B34', '#4F7F3C', '#5E8E45')]  # 书带草
FAR = [lin(x) for x in ('#3C5F3B', '#476C42', '#335238', '#557A4B')]   # 墙外的树（压暗一点，退到后面）
PORCELAIN, COBALT = lin('#F2F3F0'), lin('#2E4E8E')           # 青花瓷鼓凳
PAGODA_BODY, OUTSIDE = lin('#D8CCB2'), lin('#7B8768')


def tone_var(rng, base, n, amount=0.07):
    """同一种材料 n 个三角形的颜色，亮度各自抖一点。"""
    base = np.asarray(base, float)
    if base.ndim == 1:
        c = np.broadcast_to(base, (n, 3))
    else:
        c = base[rng.integers(0, len(base), n)]
    return np.clip(c * (1 + amount * (2 * rng.random((n, 1)) - 1)), 0, 1)


# ------------------------------------------------------------------ 基本几何
def roty(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def place(tris, pos=(0, 0, 0), yaw=0.0, scale=1.0):
    t = np.asarray(tris, float) * scale
    if yaw:
        t = t @ roty(yaw).T
    return t + np.asarray(pos, float)


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def quad(a, b, c, d):
    a, b, c, d = (np.asarray(p, float) for p in (a, b, c, d))
    return np.array([[a, b, c], [a, c, d]])


def quads(A, B, C, D):
    """成批的四边形：A、B、C、D 各是 (n,3)。"""
    A, B, C, D = (np.asarray(p, float).reshape(-1, 3) for p in (A, B, C, D))
    return np.concatenate([np.stack([A, B, C], 1), np.stack([A, C, D], 1)])


def strip(A, B, closed=True):
    """两圈点 A、B（各 k 个，一一对应）之间连成一圈四边形。"""
    A = np.asarray(A, float); B = np.asarray(B, float)
    if closed:
        A2, B2 = np.roll(A, -1, axis=0), np.roll(B, -1, axis=0)
    else:
        A, A2, B, B2 = A[:-1], A[1:], B[:-1], B[1:]
    return np.concatenate([np.stack([A, A2, B2], 1), np.stack([A, B2, B], 1)])


def fan(center, ring, closed=True):
    ring = np.asarray(ring, float)
    c = np.broadcast_to(np.asarray(center, float), ring.shape)
    if closed:
        return np.stack([c, ring, np.roll(ring, -1, axis=0)], 1)
    return np.stack([c[:-1], ring[:-1], ring[1:]], 1)


def box(size, center=(0, 0, 0), bottom=True):
    h = np.asarray(size, float) / 2
    s = np.array([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], float)
    p = np.asarray(center, float) + s * h
    faces = [(0, 1, 2, 3), (5, 4, 7, 6), (4, 0, 3, 7), (1, 5, 6, 2), (3, 2, 6, 7)] + ([(4, 5, 1, 0)] if bottom else [])
    return np.concatenate([quad(p[a], p[b], p[c], p[d]) for a, b, c, d in faces])


def bar(a, b, w, t, nrm, caps=True):
    """a → b 的一根方条：截面在 nrm 方向厚 t，在与 nrm、条身都垂直的方向宽 w。"""
    a = np.asarray(a, float); b = np.asarray(b, float); d = b - a; nrm = np.asarray(nrm, float)
    s = np.cross(d, nrm); s = s / np.linalg.norm(s) * (w / 2); u = nrm / np.linalg.norm(nrm) * (t / 2)
    A = [a - s - u, a + s - u, a + s + u, a - s + u]; B = [b - s - u, b + s - u, b + s + u, b - s + u]
    out = [strip(A, B)]
    if caps:
        out += [quad(*A), quad(*B)]
    return np.concatenate(out)


def circle(r, y, n, phase=0.0):
    a = phase + TAU * np.arange(n) / n
    return np.stack([r * np.cos(a), np.full(n, float(y)), r * np.sin(a)], 1)


def lathe(profile, n, phase=0.0):
    """旋转体：profile 是 [(半径, 高度), ...]。半径为 0 处的退化三角形在最后统一去掉。"""
    rings = [circle(r, y, n, phase) for r, y in profile]
    return np.concatenate([strip(rings[i], rings[i + 1]) for i in range(len(rings) - 1)])


def tube(path, radius, sides=6, cap=True, phase=0.0):
    """沿折线扫出一根多边形截面的管子；radius 可以每个点一个。"""
    Pp = np.asarray(path, float); n = len(Pp)
    r = np.broadcast_to(np.asarray(radius, float), (n,))
    T = np.gradient(Pp, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-30
    a = np.array([0.0, 1.0, 0.0]) if abs(T[0, 1]) < 0.9 else np.array([1.0, 0.0, 0.0])
    N = unit(np.cross(T[0], a))
    ang = phase + TAU * np.arange(sides) / sides; ca, sa = np.cos(ang)[:, None], np.sin(ang)[:, None]
    rings = []
    for i in range(n):
        N = unit(N - T[i] * (N @ T[i]))
        B = np.cross(T[i], N)
        rings.append(Pp[i] + r[i] * (ca * N + sa * B))
    out = [strip(rings[i], rings[i + 1]) for i in range(n - 1)]
    if cap:
        out += [fan(Pp[0], rings[0]), fan(Pp[-1], rings[-1])]
    return np.concatenate(out)


_ICO = {}


def icosphere(level):
    if level not in _ICO:
        t = (1 + 5 ** .5) / 2
        V = [np.array(v, float) / math.sqrt(1 + t * t) for v in
             ((-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1))]
        F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
             (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
        for _ in range(level):
            cache = {}; G = []

            def mid(a, b):
                k = (a, b) if a < b else (b, a)
                if k not in cache:
                    v = V[a] + V[b]; V.append(v / np.linalg.norm(v)); cache[k] = len(V) - 1
                return cache[k]
            for a, b, c in F:
                ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
                G += [(a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)]
            F = G
        _ICO[level] = (np.array(V), np.array(F))
    return _ICO[level]


def blob(rng, level, radius, squash=1.0, rough=0.3):
    """一团不规则的多面体（树冠）：细分二十面体的顶点各自往里外挪一点。"""
    V, F = icosphere(level)
    V = V * (1 + rough * (rng.random((len(V), 1)) - 0.5)) * np.array([1.0, squash, 0.8 + 0.4 * rng.random()]) * radius
    return place(V[F], yaw=rng.random() * TAU)


def boulder(rng, n3, level, radius, squash=0.7, rough=0.5, flat=True):
    """一块石头（flat=False 时当树冠用）：细分二十面体按三维平滑噪声鼓出凹进，再压扁；石头把顶削平一点。"""
    V, F = icosphere(level)
    off = rng.random(3) * 30
    k = 1 + rough * n3(V * 1.35 + off) + 0.18 * rough * n3(V * 3.4 + off)
    V = V * k[:, None] * np.array([1.0, squash, 0.75 + 0.5 * rng.random()])
    if flat:
        V[:, 1] = np.minimum(V[:, 1], squash * (0.55 + 0.25 * rng.random()) + 0.06 * V[:, 0])
    return place(V[F] * radius, yaw=rng.random() * TAU)


class Noise2:
    """二维梯度噪声。"""

    def __init__(self, rng):
        a = rng.random((64, 64)) * TAU
        self.gx, self.gz = np.cos(a), np.sin(a)

    def __call__(self, x, z):
        x = np.asarray(x, float); z = np.asarray(z, float)
        xi = np.floor(x).astype(np.int64); zi = np.floor(z).astype(np.int64); fx = x - xi; fz = z - zi
        u = fx * fx * fx * (fx * (fx * 6 - 15) + 10); v = fz * fz * fz * (fz * (fz * 6 - 15) + 10)

        def dot(ix, iz, dx, dz):
            return self.gx[ix & 63, iz & 63] * dx + self.gz[ix & 63, iz & 63] * dz
        a = dot(xi, zi, fx, fz); b = dot(xi + 1, zi, fx - 1, fz); c = dot(xi, zi + 1, fx, fz - 1); d = dot(xi + 1, zi + 1, fx - 1, fz - 1)
        return 1.5 * ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v)


class Noise3:
    """三维值噪声（格点随机数，三线性插值），大致在 ±1 之内。"""

    def __init__(self, rng, n=32):
        self.v = rng.random((n, n, n)) * 2 - 1; self.n = n

    def __call__(self, p):
        p = np.asarray(p, float); q = np.floor(p).astype(np.int64); f = p - q; f = f * f * (3 - 2 * f); n = self.n

        def g(dx, dy, dz):
            return self.v[(q[..., 0] + dx) % n, (q[..., 1] + dy) % n, (q[..., 2] + dz) % n]
        fx, fy, fz = f[..., 0], f[..., 1], f[..., 2]
        a = (g(0, 0, 0) * (1 - fx) + g(1, 0, 0) * fx) * (1 - fy) + (g(0, 1, 0) * (1 - fx) + g(1, 1, 0) * fx) * fy
        b = (g(0, 0, 1) * (1 - fx) + g(1, 0, 1) * fx) * (1 - fy) + (g(0, 1, 1) * (1 - fx) + g(1, 1, 1) * fx) * fy
        return a * (1 - fz) + b * fz

    def fbm(self, p, octaves=3):
        s = 0.0; amp = 1.0; norm = 0.0; p = np.asarray(p, float)
        for o in range(octaves):
            s = s + amp * self(p * (2.03 ** o) + 7.3 * o); norm += amp; amp *= 0.5
        return s / norm


def iso_mesh(field, lo, hi, cell):
    """等值面（行进四面体）：field(点 (N,3)) > 0 的地方是实心。每条棱上的交点都按“下标小的顶点 → 下标大的顶点”插值，
    相邻四面体算出的公共顶点逐位相同，不留缝，也不会有重合的面。"""
    n = [int(math.ceil((hi[k] - lo[k]) / cell)) + 1 for k in range(3)]
    g = [lo[k] + cell * np.arange(n[k]) for k in range(3)]
    X, Y, Z = np.meshgrid(*g, indexing='ij')
    Pts = np.stack([X, Y, Z], -1).reshape(-1, 3); F = field(Pts)
    idx = np.arange(Pts.shape[0]).reshape(n)
    c = [idx[dx:n[0] - 1 + dx, dy:n[1] - 1 + dy, dz:n[2] - 1 + dz].ravel() for dx, dy, dz in
         ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0), (0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))]
    busy = np.zeros(len(c[0]), bool); S0 = F[c[0]] > 0
    for k in range(1, 8):
        busy |= (F[c[k]] > 0) != S0
    c = [x[busy] for x in c]

    def edge(i, j):
        a = np.minimum(i, j); b = np.maximum(i, j); fa, fb = F[a], F[b]; t = fa / (fa - fb)
        return Pts[a] + (Pts[b] - Pts[a]) * t[:, None]
    out = []
    others = np.array([[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]])
    for t in ((0, 1, 2, 6), (0, 2, 3, 6), (0, 3, 7, 6), (0, 7, 4, 6), (0, 4, 5, 6), (0, 5, 1, 6)):
        V = np.stack([c[t[0]], c[t[1]], c[t[2]], c[t[3]]], 1); S = F[V] > 0; k = S.sum(1)
        for cnt in (1, 3):
            sel = np.nonzero(k == cnt)[0]
            if not len(sel):
                continue
            Vs, Ss = V[sel], S[sel]; r = np.arange(len(sel))
            lone = np.argmax(Ss if cnt == 1 else ~Ss, axis=1); o = others[lone]; a = Vs[r, lone]
            out.append(np.stack([edge(a, Vs[r, o[:, j]]) for j in range(3)], 1))
        sel = np.nonzero(k == 2)[0]
        if len(sel):
            Vs, Ss = V[sel], S[sel]; r = np.arange(len(sel))
            order = np.argsort(~Ss, axis=1, kind='stable')
            ia, ib, ic, id_ = (Vs[r, order[:, j]] for j in range(4))
            pac, pad, pbd, pbc = edge(ia, ic), edge(ia, id_), edge(ib, id_), edge(ib, ic)
            out += [np.stack([pac, pad, pbd], 1), np.stack([pac, pbd, pbc], 1)]
    return np.concatenate(out) if out else np.zeros((0, 3, 3))


# ------------------------------------------------------------------ 网格容器
class Mesh:
    def __init__(self):
        self.parts = []

    def add(self, name, tris, color, mirror=0.0):
        t = np.asarray(tris, float).reshape(-1, 3, 3); n = len(t)
        if n:
            c = np.array(np.broadcast_to(np.asarray(color, float), (n, 3)))
            self.parts.append([name, t, np.clip(c, 0, 1), np.full(n, float(mirror))])

    def array(self):
        rows = []; counts = {}; self.labels = []
        for name, t, c, m in self.parts:
            area = np.linalg.norm(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]), axis=1)
            ok = area > 1e-9
            rows.append(np.concatenate([t[ok].reshape(-1, 9), c[ok], m[ok, None]], 1))
            counts[name] = counts.get(name, 0) + int(ok.sum())
            self.labels += [name] * int(ok.sum())
        a = np.concatenate(rows).astype('<f4')
        assert np.isfinite(a).all() and np.abs(a[:, :9]).max() <= 32.0, '坐标必须是有限值且绝对值不超过 32'
        return a, counts


# ------------------------------------------------------------------ 布局常量（米）
X0, X1 = -16.0, 16.0          # 左、右院墙中线
ZB, ZR, ZF = -11.0, -15.0, 14.0   # 花墙（后墙）中线、后界墙中线、园子前沿
WT = 0.30                     # 墙厚
H_PART, H_SIDE, H_REAR = 3.4, 3.6, 4.5
WATER_Y = -0.45
CS = 0.25                     # 铺地网格边长
PAV = (7.4, -1.3)             # 亭子中心
ROCK = (-10.9, -2.3)          # 假山中心
COR = (-10.4, -0.9)           # 廊的两端（沿 x）
GATE_X = 1.3                  # 月洞门中心
SHADE_TREE = (-0.2, -8.7)     # 白墙前投影用的小乔木
BRIDGE = [(-10.2, 3.1), (-7.6, 2.2), (-6.9, -0.3), (-4.9, -1.2), (-4.3, -4.0)]


class Pond:
    """池岸线：椭圆上叠几个低频起伏。"""

    def __init__(self, rng):
        self.c = (0.0, 4.4); self.rx, self.rz = 9.6, 8.4
        self.k = np.arange(2, 7); self.amp = (rng.random(5) - 0.5) * np.array([0.16, 0.14, 0.10, 0.07, 0.05]); self.ph = rng.random(5) * TAU

    def scale(self, th):
        th = np.asarray(th, float)
        return 1 + sum(a * np.cos(k * th + p) for a, k, p in zip(self.amp, self.k, self.ph))

    def rr(self, x, z):
        """归一化半径：<1 在水里，=1 在岸线上。"""
        u = (np.asarray(x, float) - self.c[0]) / self.rx; v = (np.asarray(z, float) - self.c[1]) / self.rz
        return np.hypot(u, v) / self.scale(np.arctan2(v, u))

    def boundary(self, n):
        th = TAU * np.arange(n) / n; s = self.scale(th)
        return np.stack([self.c[0] + self.rx * s * np.cos(th), self.c[1] + self.rz * s * np.sin(th)], 1)


# ------------------------------------------------------------------ 地面、水面
def build_ground(m, P, pond, rng, beds):
    nx = int(round((X1 - X0) / CS)); nz = int(round((ZF - ZB) / CS))
    i, j = np.meshgrid(np.arange(nx), np.arange(nz), indexing='ij')
    xa = X0 + i * CS; xb = X0 + (i + 1) * CS; za = ZB + j * CS; zb = ZB + (j + 1) * CS
    xc, zc = (xa + xb) / 2, (za + zb) / 2
    rr = pond.rr(xc, zc); keep = rr >= 1.0
    # 人字纹青砖：每块砖占两格
    d = (i - j) % 4
    bi = np.where(d == 1, i - 1, i); bj = np.where(d == 3, j + 1, j)
    h = (bi * 73856093) ^ (bj * 19349663) ^ (np.where(d < 2, 0, 1) * 83492791); h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFF
    tone = (h % 3); shade = 0.965 + 0.07 * ((h >> 4) % 64) / 63.0
    col = np.array(BRICK)[tone] * shade[..., None]
    mir = np.full(xc.shape, float(P['paving_mirror']))
    # 池边一圈乱石板：每格归到最近的石板中心
    seeds = np.stack([rng.uniform(-13, 13, 1300), rng.uniform(-7.0, 14.0, 1300)], 1)
    flag = (rr < 1.0 + 1.5 / pond.rz)
    fx, fz = xc[flag], zc[flag]
    nearest = np.argmin((fx[:, None] - seeds[None, :, 0]) ** 2 + (fz[:, None] - seeds[None, :, 1]) ** 2, axis=1)
    fcol = np.array(FLAG)[nearest % 3] * (0.95 + 0.1 * ((nearest * 2654435761) % 97) / 96.0)[:, None]
    col[flag] = fcol
    # 花池：土和青苔
    n2 = Noise2(rng)
    for cx, cz, rx, rz in beds:
        inb = ((xc - cx) / rx) ** 2 + ((zc - cz) / rz) ** 2 < 1.0 + 0.25 * n2(xc * 0.9, zc * 0.9)
        t = np.clip(0.5 + 0.9 * n2(xc[inb] * 1.7 + 5, zc[inb] * 1.7), 0, 1)[:, None]
        col[inb] = SOIL * (1 - t) + MOSS * t; mir[inb] = 0.0
    A = np.stack([xa, np.zeros_like(xa), za], -1); B = np.stack([xb, np.zeros_like(xa), za], -1)
    C = np.stack([xb, np.zeros_like(xa), zb], -1); D = np.stack([xa, np.zeros_like(xa), zb], -1)
    for mval in np.unique(mir[keep]):
        sel = keep & (mir == mval)
        m.add('铺地', quads(A[sel], D[sel], C[sel], B[sel]), np.concatenate([col[sel], col[sel]]), mval)
    # 池岸的竖壁（铺地边缘到水下）
    y0 = WATER_Y - 0.5
    e = keep[:-1, :] != keep[1:, :]
    xe = xb[:-1, :][e]; z1 = za[:-1, :][e]; z2 = zb[:-1, :][e]
    m.add('铺地', quads(np.stack([xe, 0 * xe, z1], 1), np.stack([xe, 0 * xe, z2], 1), np.stack([xe, 0 * xe + y0, z2], 1), np.stack([xe, 0 * xe + y0, z1], 1)), SOIL)
    e = keep[:, :-1] != keep[:, 1:]
    ze = zb[:, :-1][e]; x1 = xa[:, :-1][e]; x2 = xb[:, :-1][e]
    m.add('铺地', quads(np.stack([x1, 0 * ze, ze], 1), np.stack([x2, 0 * ze, ze], 1), np.stack([x2, 0 * ze + y0, ze], 1), np.stack([x1, 0 * ze + y0, ze], 1)), SOIL)
    # 后院和墙外：几块互不重叠的大矩形（与坐标轴对齐）
    def rect(xl, xr, zl, zr, c):
        m.add('铺地', quad((xl, 0, zl), (xl, 0, zr), (xr, 0, zr), (xr, 0, zl)), c)
    rect(X0, X1, ZR, ZB, mix(BRICK[1], MOSS, 0.35))
    rect(-31, X0, -31, 31, OUTSIDE); rect(X1, 31, -31, 31, OUTSIDE); rect(X0, X1, -31, ZR, OUTSIDE); rect(X0, X1, ZF, 31, mix(BRICK[0], GRANITE, 0.5))


def build_water(m, P, rng):
    xl, xr, zl, zr = -11.75, 11.75, -5.75, 13.75
    if P['ripple'] <= 0:
        m.add('水面', quad((xl, WATER_Y, zl), (xl, WATER_Y, zr), (xr, WATER_Y, zr), (xr, WATER_Y, zl)), WATER, P['water_mirror'])
        return
    nx = P['water_n']; nz = max(2, int(round(nx * (zr - zl) / (xr - xl))))
    n2 = Noise2(rng)
    gx = np.linspace(xl, xr, nx + 1); gz = np.linspace(zl, zr, nz + 1)
    Xg, Zg = np.meshgrid(gx, gz, indexing='ij')
    Yg = WATER_Y + P['ripple'] * (n2(Xg * 1.9, Zg * 2.7) + 0.5 * n2(Xg * 4.3 + 9, Zg * 5.1))
    Pn = np.stack([Xg, Yg, Zg], -1)
    a, b, c, d = Pn[:-1, :-1], Pn[1:, :-1], Pn[1:, 1:], Pn[:-1, 1:]
    par = ((np.arange(nx)[:, None] + np.arange(nz)[None, :]) % 2 == 0)
    t1 = np.where(par[..., None, None], np.stack([a, d, c], -2), np.stack([a, d, b], -2))
    t2 = np.where(par[..., None, None], np.stack([a, c, b], -2), np.stack([d, c, b], -2))
    m.add('水面', np.concatenate([t1.reshape(-1, 3, 3), t2.reshape(-1, 3, 3)]), WATER, P['water_mirror'])


def build_bank(m, P, pond, rng):
    """驳岸：沿岸线摆一圈大小不一的黄石，半埋在岸里，下半截浸在水里。"""
    pts = pond.boundary(300); n3 = Noise3(rng)
    seg = np.linalg.norm(np.roll(pts, -1, 0) - pts, axis=1); s = np.concatenate([[0], np.cumsum(seg)]); L = s[-1]
    pos = 0.0
    while pos < L:
        r = rng.uniform(0.28, 0.55) if rng.random() < 0.8 else rng.uniform(0.55, 0.85)
        k = min(max(np.searchsorted(s, pos) - 1, 0), len(pts) - 1)
        p = pts[k] + rng.normal(0, 0.14, 2)
        t = boulder(rng, n3, 1 if r < P['bank_split'] else 2, r, squash=rng.uniform(0.5, 0.8))
        y = rng.uniform(-0.3, -0.08) + 0.2 * r
        base = HUANG[rng.integers(3)] if rng.random() < 0.8 else TAIHU[1]
        col = tone_var(rng, base, len(t), 0.08)
        wet = np.clip((WATER_Y + 0.14 - (t[:, :, 1].mean(1) + y)) / 0.12, 0, 1)[:, None]        # 水线附近颜色深一点
        m.add('驳岸石', place(t, (p[0], y, p[1])), col * (1 - 0.35 * wet))
        pos += r * rng.uniform(1.1, 1.6)


# ------------------------------------------------------------------ 墙、漏窗、月洞门
def lattice_segments(kind, w, h, rng):
    """漏窗花样：返回窗洞局部坐标 (u∈[-w/2,w/2], v∈[-h/2,h/2]) 里的一组线段。"""
    S = []
    hw, hh = w / 2, h / 2
    if kind == 'grid':          # 方格
        for u in np.linspace(-hw, hw, 7)[1:-1]:
            S.append(((u, -hh), (u, hh)))
        for v in np.linspace(-hh, hh, 6)[1:-1]:
            S.append(((-hw, v), (hw, v)))
    elif kind == 'diamond':     # 斜方格（菱花）
        step = w / 5
        for c in np.arange(-hw - h, hw + h, step):
            for sg in (1, -1):      # v = sg*(u - c)
                u0, u1 = max(-hw, c - hh if sg > 0 else c - hh), min(hw, c + hh)
                if sg > 0:
                    u0, u1 = max(-hw, c - hh), min(hw, c + hh)
                    if u1 - u0 > 0.05:
                        S.append(((u0, u0 - c), (u1, u1 - c)))
                else:
                    u0, u1 = max(-hw, c - hh), min(hw, c + hh)
                    if u1 - u0 > 0.05:
                        S.append(((u0, c - u0), (u1, c - u1)))
    elif kind == 'ice':         # 冰裂纹：把矩形反复用斜线劈开
        polys = [np.array([(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)])]
        for _ in range(14):
            areas = [abs(((p[:, 0] - p[0, 0]) * (np.roll(p, -1, 0)[:, 1] - p[0, 1]) - (p[:, 1] - p[0, 1]) * (np.roll(p, -1, 0)[:, 0] - p[0, 0])).sum()) for p in polys]
            p = polys.pop(int(np.argmax(areas))); n = len(p)
            lens = np.linalg.norm(np.roll(p, -1, 0) - p, axis=1); i = int(np.argmax(lens)); j = (i + n // 2 + rng.integers(0, 2)) % n
            if j == i:
                j = (i + 1) % n
            ta, tb = rng.uniform(0.3, 0.7), rng.uniform(0.3, 0.7)
            a = p[i] * (1 - ta) + p[(i + 1) % n] * ta; b = p[j] * (1 - tb) + p[(j + 1) % n] * tb
            S.append((tuple(a), tuple(b)))
            lo, hi = sorted((i, j))
            polys.append(np.array([a if i == lo else b] + [p[k] for k in range(lo + 1, hi + 1)] + [b if i == lo else a]))
            polys.append(np.array([b if i == lo else a] + [p[k % n] for k in range(hi + 1, lo + n + 1)] + [a if i == lo else b]))
    elif kind == 'coins':       # 套环（钱纹）：相互搭接的圆环
        r = w / 4.0
        for cu in (-r, r):
            for cv in (-hh + r * 0.95, hh - r * 0.95) if h > 2.2 * r else (0.0,):
                a = TAU * np.arange(13) / 12 + 0.13
                S += [((cu + r * math.cos(a[k]), cv + r * math.sin(a[k])), (cu + r * math.cos(a[k + 1]), cv + r * math.sin(a[k + 1]))) for k in range(12)]
        a = TAU * np.arange(13) / 12
        S += [((0.62 * r * math.cos(a[k]), 0.62 * r * math.sin(a[k])), (0.62 * r * math.cos(a[k + 1]), 0.62 * r * math.sin(a[k + 1]))) for k in range(12)]
        S += [((-hw, 0), (-r * 2 + 0.02, 0)), ((r * 2 - 0.02, 0), (hw, 0)), ((0, -hh), (0, -0.62 * r)), ((0, 0.62 * r), (0, hh))]
    else:                       # 回纹：几圈套着的方框，每圈留一个口
        for k, f in enumerate((0.82, 0.58, 0.34)):
            a, b = hw * f, hh * f
            S += [((-a, -b), (a, -b)), ((a, -b), (a, b)), ((a, b), (-a + (0.25 * w if k % 2 == 0 else 0), b)), ((-a, b - (0.25 * h if k % 2 else 0)), (-a, -b))]
        S += [((-hw, 0), (-hw * 0.82, 0)), ((hw * 0.82, 0), (hw, 0)), ((0, hh * 0.82), (0, hh)), ((0, -hh), (0, -hh * 0.82)), ((0, -hh * 0.34), (0, hh * 0.34))]
    return S


def lattice_window(m, rng, origin, axis, w, h, kind):
    """在墙洞里做一扇漏窗。origin 是窗洞中心（在墙的中面上）；axis='x' 表示墙沿 x 方向（法线是 z）。
    每根棂条的厚度各不相同（取自一个等差数列再打乱），所以任何两根相交的棂条表面都不共面；
    边框比墙洞大一圈、埋进墙里，不和洞壁贴面。"""
    o = np.asarray(origin, float)
    eu = np.array([1.0, 0, 0]) if axis == 'x' else np.array([0, 0, 1.0]); nrm = np.array([0, 0, 1.0]) if axis == 'x' else np.array([1.0, 0, 0])
    ev = np.array([0, 1.0, 0])
    segs = lattice_segments(kind, w, h, rng)
    frame = [((-w / 2 - 0.03, -h / 2 - 0.005), (w / 2 + 0.03, -h / 2 - 0.005)), ((-w / 2 - 0.03, h / 2 + 0.005), (w / 2 + 0.03, h / 2 + 0.005)),
             ((-w / 2 - 0.005, -h / 2 - 0.03), (-w / 2 - 0.005, h / 2 + 0.03)), ((w / 2 + 0.005, -h / 2 - 0.03), (w / 2 + 0.005, h / 2 + 0.03))]
    n = len(segs) + 4
    depth = 0.050 + 0.045 * rng.permutation(n) / n
    out = []
    for k, (a, b) in enumerate(frame + segs):
        a = np.asarray(a, float); b = np.asarray(b, float); d = b - a; L = np.linalg.norm(d)
        if L < 1e-6:
            continue
        ext = 0.016 if k >= 4 else 0.0           # 棂条两头各多伸一点，插进相邻的条里
        a2 = a - d / L * ext; b2 = b + d / L * ext
        wd = 0.07 if k < 4 else 0.034 + 0.004 * (k % 3)
        out.append(bar(o + eu * a2[0] + ev * a2[1], o + eu * b2[0] + ev * b2[1], wd, depth[k], nrm))
    t = np.concatenate(out)
    m.add('漏窗', t, tone_var(rng, mix(TILE[1], WALL_STAIN, 0.25), len(t), 0.05))


def wall(m, rng, axis, c, s0, s1, y0, y1, holes=(), gate=None, ends=(False, False), name='墙'):
    """一段与坐标轴对齐的墙。axis='x'：沿 x 从 s0 到 s1，中面在 z=c；axis='z'：沿 z，中面在 x=c。
    holes 是矩形洞 [(sa, sb, ya, yb)]；gate=(sc, yc, r) 是一个圆洞（月洞门），这时不能再有矩形洞。
    正反两面按洞口的边线切成互不重叠的矩形，洞壁另加，墙内部没有多余的面。"""
    def pt(s, y, side):
        return (s, y, c + side * WT / 2) if axis == 'x' else (c + side * WT / 2, y, s)
    T = []
    if gate is None:
        S = sorted({s0, s1} | {v for h in holes for v in h[:2]}); Y = sorted({y0, y1} | {v for h in holes for v in h[2:]})
        for a, b in zip(S[:-1], S[1:]):
            for ya, yb in zip(Y[:-1], Y[1:]):
                if any(h[0] <= a and b <= h[1] and h[2] <= ya and yb <= h[3] for h in holes):
                    continue
                for side in (-1, 1):
                    T.append(quad(pt(a, ya, side), pt(b, ya, side), pt(b, yb, side), pt(a, yb, side)))
        for a, b, ya, yb in holes:
            for (p, q) in (((a, ya), (b, ya)), ((b, ya), (b, yb)), ((b, yb), (a, yb)), ((a, yb), (a, ya))):
                T.append(quad(pt(p[0], p[1], -1), pt(q[0], q[1], -1), pt(q[0], q[1], 1), pt(p[0], p[1], 1)))
    else:
        sc, yc, r = gate; n = 64
        ang = TAU * (np.arange(n + 1) / n)
        cs = np.stack([sc + r * np.cos(ang), yc + r * np.sin(ang)], 1)
        # 圆洞外接的矩形边界：同一角度方向射到 [s0,s1]×[y0,y1] 的边上
        dx, dy = np.cos(ang), np.sin(ang)
        with np.errstate(divide='ignore', invalid='ignore'):
            tx = np.where(dx > 0, (s1 - sc) / dx, np.where(dx < 0, (s0 - sc) / dx, np.inf))
            ty = np.where(dy > 0, (y1 - yc) / dy, np.where(dy < 0, (y0 - yc) / dy, np.inf))
        t = np.minimum(tx, ty); rs = np.stack([sc + t * dx, yc + t * dy], 1)
        # 四个角要落在顶点上：把最接近角的那个采样点挪到角上
        for cx_, cy_ in ((s0, y0), (s1, y0), (s1, y1), (s0, y1)):
            k = int(np.argmin(np.abs(np.arctan2(np.sin(ang - math.atan2(cy_ - yc, cx_ - sc)), np.cos(ang - math.atan2(cy_ - yc, cx_ - sc))))))
            rs[k] = (cx_, cy_)
            if k == 0 or k == n:
                rs[0] = rs[n] = (cx_, cy_)
        for side in (-1, 1):
            A = np.array([pt(s, y, side) for s, y in cs]); B = np.array([pt(s, y, side) for s, y in rs])
            T.append(strip(A, B, closed=False))
        A = np.array([pt(s, y, -1) for s, y in cs]); B = np.array([pt(s, y, 1) for s, y in cs])
        T.append(strip(A, B, closed=False))
    for k, s in enumerate((s0, s1)):
        if ends[k]:
            T.append(quad(pt(s, y0, -1), pt(s, y0, 1), pt(s, y1, 1), pt(s, y1, -1)))
    t = np.concatenate(T)
    # 墙脚 0.5 米以内略带潮渍
    low = t[:, :, 1].mean(1) < 0.5
    col = np.where(low[:, None], WALL_STAIN, WALL_WHITE)
    m.add(name, t, col)


def wall_cap(m, P, rng, axis, c, s0, s1, y):
    s0, s1 = s0 - 0.045, s1 + 0.045          # 比墙身长出一点，端面不和墙的端面共面
    """墙帽：两坡小瓦顶，每隔一个瓦垄间距一条筒瓦垄，顶上一道脊。"""
    ov, rise = 0.17, 0.2
    def pt(s, off, yy):
        return (s, yy, c + off) if axis == 'x' else (c + off, yy, s)
    half = WT / 2 + ov
    yb = y - 0.03
    T = [quad(pt(s0, -half, yb), pt(s1, -half, yb), pt(s1, 0, yb + rise), pt(s0, 0, yb + rise)),
         quad(pt(s0, half, yb), pt(s1, half, yb), pt(s1, 0, yb + rise), pt(s0, 0, yb + rise)),
         quad(pt(s0, -half, yb), pt(s1, -half, yb), pt(s1, half, yb), pt(s0, half, yb)),
         np.array([[pt(s0, -half, yb), pt(s0, half, yb), pt(s0, 0, yb + rise)]], float), np.array([[pt(s1, -half, yb), pt(s1, half, yb), pt(s1, 0, yb + rise)]], float)]
    t = np.concatenate(T); m.add('墙帽', t, TILE[2])
    pitch = P['tile_pitch']; n = int((s1 - s0) / pitch)
    rows = []
    for sgn in (-1, 1):
        nrm = unit(np.array(pt(0, sgn * rise, half)) - np.array(pt(0, 0, 0)))   # 坡面法线
        for k in range(n):
            s = s0 + (k + 0.5) * (s1 - s0) / n
            a = np.array(pt(s, sgn * (half + 0.02), yb + 0.012)); b = np.array(pt(s, sgn * 0.03, yb + rise + 0.012))
            rows.append(bar(a, b, 0.095, 0.05, nrm))
    t = np.concatenate(rows); m.add('墙帽', t, tone_var(rng, TILE, len(t) // 12, 0.06).repeat(12, 0))
    m.add('墙帽', bar(pt(s0 - 0.05, 0, yb + rise + 0.05), pt(s1 + 0.05, 0, yb + rise + 0.05), 0.09, 0.15, (0, 1, 0)), RIDGE)


def build_walls(m, P, rng):
    kinds = ['grid', 'diamond', 'ice', 'coins', 'fret']
    def windows(axis, c, centers, yc, w=1.15, h=0.95):
        hs = []
        for s in centers:
            hs.append((s - w / 2, s + w / 2, yc - h / 2, yc + h / 2))
            o = (s, yc, c) if axis == 'x' else (c, yc, s)
            lattice_window(m, rng, o, axis, w, h, kinds[rng.integers(len(kinds))])
        return hs
    # 花墙（后墙）：廊里三扇、月洞门、右半四扇
    left = windows('x', ZB, [-8.9, -5.65, -2.4], 2.05)
    right = windows('x', ZB, [4.4, 7.9, 11.3, 14.2], 1.75)
    wall(m, rng, 'x', ZB, X0, GATE_X - 1.9, -0.3, H_PART, left)
    wall(m, rng, 'x', ZB, GATE_X - 1.9, GATE_X + 1.9, -0.3, H_PART, gate=(GATE_X, 1.32, 1.08))
    wall(m, rng, 'x', ZB, GATE_X + 1.9, X1, -0.3, H_PART, right)
    # 月洞门的门套（水磨青砖一圈，比墙面略凸）
    ang = TAU * np.arange(49) / 48
    for r0, r1, th, col in ((1.045, 1.20, WT / 2 + 0.035, mix(TILE[1], GRANITE, 0.3)),):
        a = np.stack([GATE_X + r0 * np.cos(ang), 1.32 + r0 * np.sin(ang)], 1); b = np.stack([GATE_X + r1 * np.cos(ang), 1.32 + r1 * np.sin(ang)], 1)
        T = []
        for side in (-1, 1):
            A = np.column_stack([a, np.full(49, ZB + side * th)]); B = np.column_stack([b, np.full(49, ZB + side * th)])
            T.append(strip(A, B, closed=False))
        A = np.column_stack([a, np.full(49, ZB - th)]); B = np.column_stack([a, np.full(49, ZB + th)]); T.append(strip(A, B, closed=False))
        A = np.column_stack([b, np.full(49, ZB - th)]); B = np.column_stack([b, np.full(49, ZB + th)]); T.append(strip(A, B, closed=False))
        t = np.concatenate(T); t = t[t[:, :, 1].max(1) > 0.012]      # 埋在地下的部分不要
        m.add('墙', t, col)
    wall_cap(m, P, rng, 'x', ZB, X0, X1, H_PART)
    # 左右院墙和后界墙
    lw = windows('z', X0, [-6.6, -2.9, 0.8, 4.5, 8.2], 1.85)
    rw = windows('z', X1, [-6.0, -1.5, 3.0, 7.5], 1.85)
    wall(m, rng, 'z', X0, ZR, ZF, -0.3, H_SIDE, lw, ends=(False, True)); wall_cap(m, P, rng, 'z', X0, ZR, ZF, H_SIDE)
    wall(m, rng, 'z', X1, ZR, ZF, -0.3, H_SIDE, rw, ends=(False, True)); wall_cap(m, P, rng, 'z', X1, ZR, ZF, H_SIDE)
    wall(m, rng, 'x', ZR, X0 - WT / 2 - 0.06, X1 + WT / 2 + 0.06, -0.3, H_REAR, ends=(True, True)); wall_cap(m, P, rng, 'x', ZR, X0 - WT / 2 - 0.06, X1 + WT / 2 + 0.06, H_REAR)


# ------------------------------------------------------------------ 挂落、栏杆、瓦
def hanging_fret(m, rng, a, b, nrm):
    """挂落：两根柱子之间、枋子下面的一幅木格。a、b 是枋底两端的点。横条和竖条厚度不同，交叉处不共面。"""
    a = np.asarray(a, float); b = np.asarray(b, float); d = b - a; L = np.linalg.norm(d); e = d / L; up = np.array([0, 1.0, 0])
    T = []
    def hb(s0, s1, y, k=0):
        T.append(bar(a + e * s0 + up * y, a + e * s1 + up * y, 0.028, 0.034 + 0.003 * k, nrm))
    def vb(s, y0, y1, k=0):
        T.append(bar(a + e * s + up * y0, a + e * s + up * y1, 0.026, 0.026 + 0.0025 * k, nrm))
    hb(0.02, L - 0.02, -0.031); hb(0.02, L - 0.02, -0.15, 1); hb(0.30, L - 0.30, -0.28, 2)
    hb(0.02, 0.33, -0.46, 1); hb(L - 0.33, L - 0.02, -0.46, 2)
    vb(0.045, -0.03, -0.475); vb(L - 0.045, -0.03, -0.475, 1); vb(0.315, -0.135, -0.475, 2); vb(L - 0.315, -0.135, -0.475, 1)
    n = max(3, int((L - 0.7) / 0.24))
    for k in range(n + 1):
        s = 0.35 + (L - 0.7) * k / n
        vb(s, -0.03, -0.165, k % 3) if k % 2 == 0 else vb(s, -0.135, -0.295, k % 3)
    t = np.concatenate(T); m.add('挂落', t, WOOD_D)


def low_railing(m, rng, a, b, nrm, h=0.78):
    """柱间的木栏杆：上中下三道横档加一排竖棂。a、b 是地面上的两个端点。"""
    a = np.asarray(a, float); b = np.asarray(b, float); d = b - a; L = np.linalg.norm(d); e = d / L; up = np.array([0, 1.0, 0])
    T = [bar(a + up * h, b + up * h, 0.07, 0.06, nrm), bar(a + up * (h - 0.2), b + up * (h - 0.2), 0.03, 0.036, nrm), bar(a + up * 0.1, b + up * 0.1, 0.04, 0.04, nrm)]
    n = int(L / 0.13)
    for k in range(1, n):
        s = L * k / n
        T.append(bar(a + e * s + up * 0.1, a + e * s + up * (h - 0.2), 0.022, 0.024 + 0.002 * (k % 3), nrm))
    for k in range(1, 4):
        s = L * k / 4
        T.append(bar(a + e * s + up * (h - 0.192), a + e * s + up * (h - 0.01), 0.03, 0.03, nrm))
    m.add('栏杆', np.concatenate(T), WOOD_D)


def tile_row(pts_c, side, up, hw=0.052, hh=0.05, cap=True):
    """一条筒瓦垄：沿中线 pts_c（落在屋面上）扫出一个梯形截面的小脊；檐口那头封上（瓦当）。"""
    C = np.asarray(pts_c, float); s = np.asarray(side, float) * hw; u = np.asarray(up, float)
    C = np.concatenate([[C[0] + (C[0] - C[1]) / np.linalg.norm(C[0] - C[1]) * 0.035], C])     # 檐口多挑出一点，瓦当不和封檐板共面
    L = C - s - u * 0.012; R = C + s - u * 0.012; TL = C - s * 0.45 + u * hh; TR = C + s * 0.45 + u * hh
    out = [strip(L, TL, closed=False), strip(TL, TR, closed=False), strip(TR, R, closed=False)]
    if cap:
        out.append(quad(L[0], TL[0], TR[0], R[0]))
    return np.concatenate(out)


# ------------------------------------------------------------------ 廊
def build_corridor(m, P, rng):
    xa, xb = COR; zw = ZB + WT / 2; fl = 0.30; zc = zw + 1.78; ze = zw + 2.28      # 墙面、柱列、檐口
    y_wall, y_eave = fl + 2.98, fl + 2.42
    # 台基
    m.add('廊', box((xb - xa + 0.5, fl + 0.4, zc - zw + 0.42), ((xa + xb) / 2, fl - (fl + 0.4) / 2, zw + (zc - zw + 0.36) / 2 - 0.03), bottom=False), GRANITE)
    m.add('廊', box((xb - xa + 0.56, 0.07, 0.34), ((xa + xb) / 2, fl - 0.027, zc + 0.26), bottom=False), GRANITE_D)   # 阶沿石
    nb = 4; xs = np.linspace(xa + 0.2, xb - 0.2, nb + 1)
    for x in xs:
        base = lathe([(0.0, fl + 0.13), (0.13, fl + 0.13), (0.17, fl + 0.06), (0.15, fl - 0.02)], 10)
        m.add('廊', place(base, (x, 0, zc)), GRANITE_D)
        m.add('廊', tube([(x, fl + 0.1, zc), (x, y_eave + 0.05, zc)], 0.085, 10, cap=False), WOOD)
        yb = y_eave + (y_wall - y_eave) * (ze - zc) / (ze - zw) - 0.16
        m.add('廊', bar((x, yb + 0.02, zc + 0.05), (x, y_wall - 0.24, zw - 0.05), 0.09, 0.16, (1, 0, 0)), WOOD)     # 柱到墙的梁
    m.add('廊', bar((xs[0] - 0.12, y_eave - 0.02, zc), (xs[-1] + 0.12, y_eave - 0.02, zc), 0.19, 0.085, (0, 0, 1)), WOOD)   # 檐枋
    for k in range(nb):
        hanging_fret(m, rng, (xs[k] + 0.07, y_eave - 0.105, zc), (xs[k + 1] - 0.07, y_eave - 0.105, zc), (0, 0, 1))
        if k != 2:      # 第三间留作出入口
            low_railing(m, rng, (xs[k] + 0.06, fl - 0.01, zc), (xs[k + 1] - 0.06, fl - 0.01, zc), (0, 0, 1))
        else:
            for q in range(2):
                m.add('廊', box((1.7 + 0.24 * q, 0.16, 0.36), ((xs[k] + xs[k + 1]) / 2, 0.155 - 0.15 * q - 0.012, zc + 0.5 + 0.34 * q), bottom=False), GRANITE)
    # 屋面：单坡，自墙向园内落；略带凹曲
    nseg = 5; v = np.linspace(0, 1, nseg + 1)
    zz = ze + (zw - 0.02 - ze) * v; yy = y_eave + (y_wall - y_eave) * (0.55 * v + 0.45 * v ** 1.8)
    x0r, x1r = xa - 0.25, xb + 0.25
    A = np.stack([np.full(nseg + 1, x0r), yy, zz], 1); B = np.stack([np.full(nseg + 1, x1r), yy, zz], 1)
    m.add('廊瓦', strip(A, B, closed=False), TILE[0])
    m.add('廊', strip(A - (0, 0.06, 0), B - (0, 0.06, 0), closed=False), CEIL)                       # 屋面底（望砖）
    m.add('廊', np.concatenate([quads(A[:-1], A[1:], A[1:] - (0, 0.06, 0), A[:-1] - (0, 0.06, 0)), quads(B[:-1], B[1:], B[1:] - (0, 0.06, 0), B[:-1] - (0, 0.06, 0)),
                               quad(A[0], B[0], B[0] - (0, 0.06, 0), A[0] - (0, 0.06, 0))]), WOOD)
    for x in np.arange(x0r + 0.2, x1r, 0.42):                                                      # 椽子
        m.add('廊', bar((x, yy[0] - 0.105, zz[0] + 0.02), (x, yy[-1] - 0.12, zz[-1]), 0.05, 0.05, (0, 1, 0)), WOOD)
    pitch = P['tile_pitch']; n = int((x1r - x0r) / pitch); rows = []
    for k in range(n):
        x = x0r + (k + 0.5) * (x1r - x0r) / n
        rows.append(tile_row(np.stack([np.full(nseg + 1, x), yy, zz], 1), (1, 0, 0), (0, 1, 0)))
    t = np.concatenate(rows); per = len(rows[0])
    m.add('廊瓦', t, tone_var(rng, TILE, n, 0.07).repeat(per, 0))
    drip = [np.array([[(x - 0.045, yy[0] - 0.005, zz[0] + 0.004), (x + 0.045, yy[0] - 0.005, zz[0] + 0.004), (x, yy[0] - 0.085, zz[0] + 0.01)]]) for x in x0r + (np.arange(n - 1) + 1) * (x1r - x0r) / n]
    m.add('廊瓦', np.concatenate(drip), TILE_EDGE)
    m.add('廊瓦', bar((x0r - 0.03, yy[-1] + 0.09, zw + 0.07), (x1r + 0.03, yy[-1] + 0.09, zw + 0.07), 0.2, 0.13, (0, 0, 1)), RIDGE)   # 贴墙的一道脊


# ------------------------------------------------------------------ 六角亭
def build_pavilion(m, P, rng):
    cx, cz = PAV; yaw = math.radians(30.0); hp = 0.5
    Rc, Rp, Re = 1.72, 2.5, 3.05; col_h = 2.7; ye = hp + col_h + 0.12; H = 1.95; Lc = 0.6; a0 = 0.13
    ae = Re * math.cos(math.pi / 6); t30 = math.tan(math.pi / 6)
    C = np.array([cx, 0.0, cz])
    corner = lambda k, r, y: C + np.array([r * math.cos(yaw + k * TAU / 6), y, r * math.sin(yaw + k * TAU / 6)])
    # 台基：六棱柱，下探到水里；面上一圈阶沿石
    ring_b = np.array([corner(k, Rp, WATER_Y - 0.6) for k in range(6)]); ring_t = np.array([corner(k, Rp, hp) for k in range(6)])
    m.add('亭', strip(ring_b, ring_t), GRANITE_D); m.add('亭', fan(C + (0, hp, 0), ring_t), mix(GRANITE, BRICK[1], 0.35))
    ring_o = np.array([corner(k, Rp + 0.07, hp - 0.11) for k in range(6)]); ring_o2 = np.array([corner(k, Rp + 0.07, hp + 0.012) for k in range(6)]); ring_i = np.array([corner(k, Rp - 0.3, hp + 0.012) for k in range(6)])
    m.add('亭', np.concatenate([strip(ring_o, ring_o2), strip(ring_o2, ring_i)]), GRANITE)
    # 屋面
    def roof(k, q, v, lift=0.0):
        q = np.asarray(q, float); v = np.asarray(v, float)
        phi = yaw + (k + 0.5) * TAU / 6; c = np.array([math.cos(phi), 0, math.sin(phi)]); t = np.array([-math.sin(phi), 0, math.cos(phi)])
        d = ae * (1 - v) + a0 * v; s = q * d * t30; aq = np.abs(q) ** 3 * (1 - v) ** 2
        y = ye + H * (0.42 * v + 0.58 * v ** 2.3) + Lc * aq + lift
        return C + (c * d[..., None] + t * s[..., None]) * (1 + 0.075 * aq)[..., None] + np.array([0, 1.0, 0]) * y[..., None]
    nq, nv = 8, 8
    pitch = P['tile_pitch'] * 1.05; nrow = int(2 * ae * t30 / pitch)
    for k in range(6):
        Q, V = np.meshgrid(np.linspace(-1, 1, nq + 1), np.linspace(0, 1, nv + 1), indexing='ij')
        S = roof(k, Q, V)
        m.add('亭瓦', quads(S[:-1, :-1], S[1:, :-1], S[1:, 1:], S[:-1, 1:]), TILE[0])
        Sb = roof(k, Q, V, -0.07)
        m.add('亭', quads(Sb[:-1, :-1], Sb[1:, :-1], Sb[1:, 1:], Sb[:-1, 1:]), CEIL)
        m.add('亭', quads(S[:-1, 0], S[1:, 0], Sb[1:, 0], Sb[:-1, 0]), WOOD)                         # 檐口封板
        phi = yaw + (k + 0.5) * TAU / 6; t = np.array([-math.sin(phi), 0, math.cos(phi)]); rows = []; cols = []
        for i in range(nrow):
            s = (i + 0.5 - nrow / 2) * (2 * ae * t30 / nrow)
            vmax = min(0.93, (ae - abs(s) / t30) / (ae - a0) - 0.05)
            if vmax < 0.12:
                continue
            ns = max(2, int(round(6 * vmax))); v = np.linspace(0, vmax, ns + 1); d = ae * (1 - v) + a0 * v; q = s / (d * t30)
            rows.append(tile_row(roof(k, q, v), t, (0, 1, 0), hw=0.055, hh=0.055)); cols.append(np.repeat(tone_var(rng, TILE, 1, 0.07), len(rows[-1]), 0))
        m.add('亭瓦', np.concatenate(rows), np.concatenate(cols))
        # 滴水：檐口上一排朝下的小三角
        qs = (np.arange(nrow - 1) + 1 - nrow / 2) * (2 / nrow)
        E = roof(k, qs, np.zeros_like(qs)); dq = roof(k, qs + 0.022, np.zeros_like(qs)) - E
        m.add('亭瓦', np.stack([E - dq, E + dq, E - (0, 0.09, 0)], 1), TILE_EDGE)
        # 戗脊：沿屋角一路下来，出檐后向上翘起
        vv = np.linspace(0.9, 0.0, 9); ridge = roof(k, np.ones(9), vv, 0.07)
        tip_dir = unit((ridge[-1] - ridge[-2]) * (1, 0, 1))
        ext = np.array([ridge[-1] + tip_dir * 0.22 * j + np.array([0, 0.11 * j ** 1.8, 0]) for j in (1, 2, 3)])
        path = np.concatenate([ridge, ext]); rad = np.concatenate([np.full(9, 0.075), [0.062, 0.045, 0.02]])
        m.add('亭瓦', tube(path, rad, 4, cap=True, phase=TAU / 8), RIDGE)
    top = ye + H
    m.add('亭瓦', place(lathe([(0.19, top - 0.12), (0.24, top + 0.02), (0.13, top + 0.16), (0.2, top + 0.34), (0.12, top + 0.5), (0.035, top + 0.72), (0.0, top + 0.86)], 12), (cx, 0, cz)), RIDGE)   # 宝顶
    # 柱、柱础、枋、挂落、坐槛和靠背
    cols = [corner(k, Rc, 0) for k in range(6)]
    for p in cols:
        m.add('亭', place(lathe([(0.0, hp + 0.15), (0.14, hp + 0.15), (0.19, hp + 0.07), (0.17, hp - 0.02)], 10), (p[0], 0, p[2])), GRANITE_D)
        m.add('亭', tube([(p[0], hp + 0.12, p[2]), (p[0], ye - 0.02, p[2])], 0.095, 10, cap=False), WOOD)
    for k in range(6):
        a, b = cols[k], cols[(k + 1) % 6]; e = unit(b - a); nrm = unit(np.cross(e, (0, 1, 0)))
        if nrm @ ((a + b) / 2 - C) < 0:
            nrm = -nrm
        yb = hp + col_h - 0.08
        m.add('亭', bar(a + (0, yb, 0) - e * 0.02, b + (0, yb, 0) + e * 0.02, 0.2 + 0.004 * k, 0.09 + 0.003 * k, nrm), WOOD)
        hanging_fret(m, rng, a + (0, yb - 0.1, 0) + e * 0.09, b + (0, yb - 0.1, 0) - e * 0.09, nrm)
        if k in (1, 4):      # 留两面出入
            continue
        # 坐槛：一条石板凳；靠背：一排外倾的弯木条加扶手
        pa, pb = a + e * 0.12 + nrm * 0.1, b - e * 0.12 + nrm * 0.1
        m.add('亭', bar(pa + (0, hp + 0.44, 0), pb + (0, hp + 0.44, 0), 0.36, 0.07, (0, 1, 0)), GRANITE)
        for f in (0.12, 0.5, 0.88):
            q = pa + (pb - pa) * f
            m.add('亭', box((0.12 + 0.01 * f, 0.46, 0.2 + 0.01 * f), (q[0], hp + 0.215, q[2]), bottom=False), GRANITE_D)
        L = np.linalg.norm(pb - pa); ns = int(L / 0.11); slats = []
        for j in range(ns + 1):
            q = pa + (pb - pa) * (j / ns) + nrm * 0.14
            slats.append(tube([q + (0, hp + 0.46, 0), q + nrm * 0.06 + (0, hp + 0.62, 0), q + nrm * 0.17 + (0, hp + 0.76, 0), q + nrm * 0.22 + (0, hp + 0.93, 0)], 0.013, 4, cap=False))
        m.add('栏杆', np.concatenate(slats), WOOD_D)
        m.add('栏杆', bar(pa + nrm * 0.36 + (0, hp + 0.94, 0), pb + nrm * 0.36 + (0, hp + 0.94, 0), 0.06, 0.05, (0, 1, 0)), WOOD_D)
        m.add('栏杆', bar(pa + nrm * 0.215 + (0, hp + 0.65, 0), pb + nrm * 0.215 + (0, hp + 0.65, 0), 0.03, 0.028, nrm), WOOD_D)
    # 踏步：朝岸的一面（第 1 面）两级
    k = 1; a, b = corner(k, Rp, 0), corner(k + 1, Rp, 0); mid = (a + b) / 2; out = unit((mid - C) * (1, 0, 1)); e = unit(b - a)
    for q in range(2):
        cen = mid + out * (0.17 + 0.36 * q)
        bx = box((1.5 + 0.3 * q, 0.19, 0.4), (0, 0, 0), bottom=False)
        R = np.array([e, [0, 1, 0], out]).T
        m.add('亭', bx @ R.T + cen + (0, hp - 0.16 - 0.17 * q - 0.095, 0), GRANITE)


# ------------------------------------------------------------------ 假山、湖石
def rock_mesh(rng, blobs, holes, cell, bump=0.55, freq=1.25):
    """太湖石：若干椭球形的团块叠在一起，表面用三维噪声做出皱褶，再用几条穿过去的洞挖出“漏、透”。"""
    cen = np.array([b[0] for b in blobs], float); rad = np.array([b[1] for b in blobs], float)
    n3 = Noise3(rng); off = rng.random(3) * 20

    def field(p):
        g = np.zeros(len(p))
        for c, r in zip(cen, rad):
            g += np.exp(-1.5 * (((p - c) / r) ** 2).sum(1))
        f = g - 0.32 * (1 + bump * n3.fbm(p * freq + off, 3) + 0.22 * n3(p * freq * 3.1 + off))
        for a, b, r in holes:
            a = np.asarray(a, float); b = np.asarray(b, float); ab = b - a
            t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1); d2 = ((p - a - t[:, None] * ab) ** 2).sum(1)
            f -= 1.3 * np.exp(-1.6 * d2 / (r * r))
        return f
    lo = (cen - rad * 1.5).min(0); hi = (cen + rad * 1.5).max(0)
    t = iso_mesh(field, lo, hi, cell)
    return t[t[:, :, 1].max(1) > -0.6]


def rock_colors(rng, t, base=TAIHU):
    n3 = rock_colors.n3
    c = t.mean(1)
    k = np.clip(0.5 + 0.8 * n3(c * 1.6), 0, 1)[:, None]
    col = base[0] * (1 - k) + base[1] * k
    col = col * (0.94 + 0.12 * rng.random((len(t), 1)))
    low = np.clip(1 - c[:, 1] / 0.5, 0, 1)[:, None] * 0.55          # 石脚的青苔
    return col * (1 - low) + MOSS * low


def build_rockery(m, P, rng):
    rock_colors.n3 = Noise3(rng)
    cx, cz = ROCK; cell = P['rock_cell']; pc = P['rock_cell'] * P['peak_cell']
    blobs = [((cx - 0.4, 2.3, cz - 0.6), (1.05, 1.9, 0.95)), ((cx + 1.3, 1.4, cz + 0.2), (1.2, 1.5, 1.0)), ((cx - 1.9, 1.2, cz + 0.4), (1.1, 1.35, 0.95)),
             ((cx + 0.3, 0.8, cz + 1.5), (1.5, 1.0, 1.0)), ((cx + 2.6, 0.7, cz + 1.2), (1.0, 0.9, 0.9)), ((cx - 1.0, 0.7, cz - 1.9), (1.3, 0.95, 0.9)),
             ((cx + 1.9, 2.6, cz - 1.0), (0.6, 1.0, 0.6)), ((cx - 2.6, 0.6, cz - 1.0), (0.9, 0.8, 0.9)), ((cx + 0.6, 0.5, cz + 2.7), (1.1, 0.7, 0.8))]
    blobs = [((b[0][0] + rng.normal(0, 0.15), b[0][1], b[0][2] + rng.normal(0, 0.15)), b[1]) for b in blobs]
    holes = [((cx - 1.2, 1.5, cz + 2.0), (cx - 0.2, 1.7, cz - 2.0), 0.42), ((cx + 0.2, 0.75, cz + 2.4), (cx + 1.0, 0.9, cz - 0.6), 0.5),
             ((cx - 3.0, 1.1, cz + 0.2), (cx - 0.6, 1.3, cz + 0.5), 0.3), ((cx + 0.6, 2.4, cz - 2.0), (cx + 1.7, 2.1, cz + 1.2), 0.3),
             ((cx - 0.8, 3.1, cz - 1.6), (cx - 0.2, 3.0, cz + 0.6), 0.24), ((cx + 2.0, 1.0, cz + 2.2), (cx + 3.2, 1.2, cz - 0.4), 0.28)]
    t = rock_mesh(rng, blobs, holes, cell)
    m.add('假山', t, rock_colors(rng, t))
    # 几块独立的湖石峰：后院（月洞门里看得见）、竹丛边、前岸
    for (px, pz, hgt, c2) in ((GATE_X + 0.15, -13.1, 2.7, pc * 0.66), (3.3, -9.6, 1.5, pc * 0.62), (9.6, 8.6, 2.2, pc * 0.55), (-2.0, -5.6, 1.4, pc * 0.62)):
        nb = 5; ys = np.linspace(0.25, hgt - 0.3, nb)
        bl = [((px + rng.normal(0, 0.14), y, pz + rng.normal(0, 0.12)), (rng.uniform(0.34, 0.5) * (1.15 - 0.3 * i / nb), hgt / nb * 0.95, rng.uniform(0.28, 0.4))) for i, y in enumerate(ys)]
        hl = [((px - 0.7, y, pz + rng.normal(0, 0.1)), (px + 0.7, y + rng.normal(0, 0.15), pz + rng.normal(0, 0.1)), rng.uniform(0.11, 0.17)) for y in np.linspace(0.6, hgt - 0.5, 3)]
        hl += [((px + rng.normal(0, 0.1), y, pz - 0.6), (px + rng.normal(0, 0.1), y, pz + 0.6), rng.uniform(0.09, 0.14)) for y in np.linspace(0.9, hgt - 0.8, 2)]
        t = rock_mesh(rng, bl, hl, c2, bump=0.7, freq=2.6)
        m.add('湖石峰', t, rock_colors(rng, t))
        m.add('湖石峰', box((1.0, 0.24, 0.8), (px, 0.09, pz), bottom=False), GRANITE_D)            # 石座


# ------------------------------------------------------------------ 植物
def leaves(points, dirs, length, width, rng, fold=0.25):
    """成批的叶片：每片是两个三角形拼成的长菱形，沿中脉略折。points、dirs 是 (n,3)。"""
    Pp = np.asarray(points, float); D = np.asarray(dirs, float); D = D / np.linalg.norm(D, axis=1, keepdims=True)
    side = np.cross(D, (0, 1.0, 0)); nn = np.linalg.norm(side, axis=1, keepdims=True)
    side = np.where(nn > 1e-6, side / np.maximum(nn, 1e-9), np.array([1.0, 0, 0]))
    nrm = np.cross(side, D)
    L = np.broadcast_to(np.asarray(length, float), (len(Pp),))[:, None]; W = np.broadcast_to(np.asarray(width, float), (len(Pp),))[:, None]
    tip = Pp + D * L; midc = Pp + D * L * 0.38 - nrm * W * fold
    a = midc + side * W / 2; b = midc - side * W / 2
    return np.concatenate([np.stack([Pp, a, tip], 1), np.stack([Pp, tip, b], 1)])


def build_bamboo(m, P, rng):
    clumps = [((4.6, -9.9), 0.26), ((5.9, -10.2), 0.14), ((13.6, -9.6), 0.18), ((-13.0, -13.2), 0.12), ((9.2, -13.4), 0.12), ((-14.4, 6.5), 0.10), ((13.8, -12.9), 0.08)]
    total = P['bamboo']; T_c, T_l, C_c, C_l = [], [], [], []
    for (px, pz), share in clumps:
        n = int(round(total * share))
        for _ in range(n):
            bx, bz = px + rng.normal(0, 0.42), pz + rng.normal(0, 0.2)
            hgt = rng.uniform(4.4, 6.6); r0 = rng.uniform(0.026, 0.04)
            lean = rng.normal(0, 0.05, 2); bend = unit(np.array([rng.normal(0, 1), 0, rng.normal(0.6, 1)])) * rng.uniform(0.5, 1.3)
            ts = np.linspace(0, 1, 13)
            path = np.stack([bx + lean[0] * hgt * ts + bend[0] * ts ** 2.6, hgt * ts - 0.1, bz + lean[1] * hgt * ts + bend[2] * ts ** 2.6], 1)
            T_c.append(tube(path, r0 * (1 - 0.72 * ts), 5, cap=False)); C_c.append(np.repeat(tone_var(rng, CULM, 1, 0.08), len(T_c[-1]), 0))
            # 竹节：每节一圈略粗的浅色环
            for k in range(2, 12, 2):
                pk = path[k]; T_c.append(tube([pk - (0, 0.012, 0), pk + (0, 0.012, 0)], r0 * (1 - 0.72 * ts[k]) + 0.006, 5, cap=False)); C_c.append(np.repeat(lin('#A7B46E')[None], len(T_c[-1]), 0))
            # 枝和叶：上面六成的节上出枝
            nbr = int(round(17 * P['leaves']))
            for _ in range(nbr):
                t0 = rng.uniform(0.38, 0.98); p0 = np.array([np.interp(t0, ts, path[:, k]) for k in range(3)])
                az = rng.uniform(0, TAU); el = rng.uniform(0.25, 0.9); bl = rng.uniform(0.5, 1.05) * (1.15 - 0.5 * t0)
                bd = np.array([math.cos(az) * math.cos(el), math.sin(el), math.sin(az) * math.cos(el)])
                p1 = p0 + bd * bl * 0.55; p2 = p0 + bd * bl + np.array([0, -0.16 * bl, 0])
                T_c.append(tube([p0, p1, p2], [0.008, 0.006, 0.003], 3, cap=False)); C_c.append(np.repeat(CULM[2][None], len(T_c[-1]), 0))
                nl = rng.integers(8, 13); tt = rng.uniform(0.25, 1.0, nl)
                lp = np.where(tt[:, None] < 0.55, p0 + (p1 - p0) * (tt[:, None] / 0.55), p1 + (p2 - p1) * ((tt[:, None] - 0.55) / 0.45))
                ld = bd * 0.5 + rng.normal(0, 0.55, (nl, 3)) + np.array([0, -0.75, 0])
                T_l.append(leaves(lp, ld, rng.uniform(0.2, 0.32, nl), rng.uniform(0.04, 0.062, nl), rng)); C_l.append(np.tile(tone_var(rng, BLEAF, nl, 0.1), (2, 1)))
    if T_c:
        m.add('竹竿', np.concatenate(T_c), np.concatenate(C_c))
    if T_l:
        m.add('竹叶', np.concatenate(T_l), np.concatenate(C_l))
    # 石笋：竹丛里几根瘦长的石条
    for (px, pz, h) in ((5.3, -9.5, 2.3), (4.0, -9.7, 1.5), (6.5, -9.65, 1.1), (13.2, -9.2, 1.7)):
        prof = [(0.17, -0.1), (0.16, h * 0.3), (0.13, h * 0.62), (0.085, h * 0.88), (0.02, h)]
        t = lathe(prof, 5, rng.uniform(0, 1)); rng.normal(0, 0.012, (len(t), 1, 3))      # 这次取数不用，只为不改动后面元素的随机数序列
        m.add('石笋', place(t, (px, 0, pz), yaw=rng.uniform(0, 1)), tone_var(rng, mix(TAIHU[1], MOSS, 0.2), len(t), 0.08))


def build_pine(m, P, rng):
    """假山上的一棵松：弯曲的树干，几根横枝，枝头是一层层由针簇组成的“云片”。"""
    base = np.array([ROCK[0] + 2.2, 1.15, ROCK[1] - 1.4])
    ts = np.linspace(0, 1, 12)
    trunk = np.stack([base[0] + 1.6 * ts ** 1.5 + 0.25 * np.sin(ts * 5), base[1] + 3.6 * ts, base[2] + 0.9 * ts + 0.3 * np.sin(ts * 4 + 1)], 1)
    t = tube(trunk, 0.2 * (1 - 0.72 * ts) + 0.03, 8, cap=True); m.add('松', t, tone_var(rng, BARK, len(t), 0.12))
    pads = []
    for t0, az, ln, rise in ((0.45, 0.3, 2.0, 0.25), (0.6, 2.5, 1.6, 0.3), (0.72, -1.2, 1.7, 0.35), (0.85, 1.4, 1.3, 0.4), (0.97, -0.3, 0.9, 0.7), (0.55, -2.4, 1.3, 0.2)):
        p0 = np.array([np.interp(t0, ts, trunk[:, k]) for k in range(3)])
        d = np.array([math.cos(az), 0, math.sin(az)])
        u = np.linspace(0, 1, 6)
        br = p0 + d * (ln * u)[:, None] + np.array([0, 1.0, 0]) * (rise * ln * (u - 0.6 * u ** 2))[:, None] + rng.normal(0, 0.04, (6, 3))
        br[0] = p0
        m.add('松', tube(br, 0.07 * (1 - 0.8 * u) + 0.015, 5, cap=False), BARK)
        pads.append((br[-1], ln * 0.48)); pads.append((br[3], ln * 0.34))
    Pn, Dn, Cn = [], [], []
    for c, r in pads:
        k = P['pine_tufts']
        q = rng.normal(0, 1, (k, 3)); q = q / np.linalg.norm(q, axis=1, keepdims=True) * rng.uniform(0.35, 1.0, (k, 1)) ** 0.6
        cen = c + q * np.array([r, r * 0.28, r * 0.85]) + np.array([0, 0.08, 0])
        nn = 9
        dirs = rng.normal(0, 1, (k, nn, 3)); dirs[..., 1] = np.abs(dirs[..., 1]) * 0.9 + 0.25
        Pn.append(np.repeat(cen, nn, 0)); Dn.append(dirs.reshape(-1, 3)); Cn.append(np.repeat(tone_var(rng, PINE, k, 0.1), nn, 0))
    Pn = np.concatenate(Pn); Dn = np.concatenate(Dn); Cn = np.concatenate(Cn)
    m.add('松针', leaves(Pn, Dn, rng.uniform(0.2, 0.3, len(Pn)), 0.034, rng, fold=0.0), np.tile(Cn, (2, 1)))


def build_maple(m, P, rng):
    base = np.array([11.6, -0.1, 2.4])
    ts = np.linspace(0, 1, 8)
    trunk = np.stack([base[0] + 0.3 * np.sin(ts * 3), base[1] + 1.9 * ts, base[2] + 0.25 * ts], 1)
    m.add('红枫', tube(trunk, 0.11 * (1 - 0.5 * ts), 7, cap=False), TRUNK)
    Pn, Dn = [], []
    for k in range(9):
        az = k * 2.4 + rng.uniform(0, 0.5); ln = rng.uniform(1.1, 1.9); u = np.linspace(0, 1, 5)
        d = np.array([math.cos(az), 0, math.sin(az)])
        br = trunk[-1] - (0, 0.3 * (k % 3), 0) + d * (ln * u)[:, None] + np.array([0, 1.0, 0]) * ((0.9 - 0.25 * (k % 3)) * ln * (u - 0.45 * u ** 2))[:, None]
        m.add('红枫', tube(br, 0.05 * (1 - 0.8 * u) + 0.008, 4, cap=False), TRUNK)
        for j in (2, 3, 4):
            n = 46
            q = rng.normal(0, 1, (n, 3)) * np.array([0.42, 0.13, 0.42]) * (0.7 + 0.25 * j / 4)
            Pn.append(br[j] + q + (0, 0.05, 0)); Dn.append(rng.normal(0, 1, (n, 3)) * np.array([1, 0.35, 1]) + np.array([0, -0.15, 0]))
    Pn = np.concatenate(Pn); Dn = np.concatenate(Dn)
    m.add('红枫', leaves(Pn, Dn, rng.uniform(0.11, 0.17, len(Pn)), rng.uniform(0.07, 0.1, len(Pn)), rng, fold=0.12), np.tile(tone_var(rng, MAPLE, len(Pn), 0.1), (2, 1)))


def build_shade_tree(m, P, rng):
    """白墙前的一棵落叶小乔木：树冠高过墙头，叶子稀疏，太阳把枝叶的影子投在月洞门旁边的白墙上。"""
    base = np.array([SHADE_TREE[0], -0.1, SHADE_TREE[1]])
    ts = np.linspace(0, 1, 9)
    trunk = np.stack([base[0] + 0.25 * np.sin(ts * 2.6), base[1] + 3.7 * ts, base[2] + 0.15 * np.sin(ts * 3.1 + 1)], 1)
    m.add('庭树', tube(trunk, 0.13 * (1 - 0.45 * ts) + 0.02, 7, cap=False), lin('#7A6A58'))
    Pn, Dn = [], []
    for k in range(8):
        az = k * TAU / 8 + rng.uniform(-0.3, 0.3); ln = rng.uniform(1.3, 2.1); u = np.linspace(0, 1, 5)
        d = np.array([math.cos(az), 0, math.sin(az)]); rise = rng.uniform(0.7, 1.3)
        br = trunk[-1] - (0, 0.35 * (k % 3), 0) + d * (ln * u)[:, None] + np.array([0, 1.0, 0]) * (rise * ln * (u - 0.35 * u ** 2))[:, None]
        m.add('庭树', tube(br, 0.045 * (1 - 0.8 * u) + 0.008, 4, cap=False), lin('#7A6A58'))
        for j in (2, 3, 4):
            n = int(60 * P['leaves'])
            Pn.append(br[j] + rng.normal(0, 1, (n, 3)) * np.array([0.5, 0.3, 0.5])); Dn.append(rng.normal(0, 1, (n, 3)) * np.array([1, 0.5, 1]) + np.array([0, -0.2, 0]))
    Pn = np.concatenate(Pn); Dn = np.concatenate(Dn)
    m.add('庭树', leaves(Pn, Dn, rng.uniform(0.13, 0.21, len(Pn)), rng.uniform(0.065, 0.095, len(Pn)), rng, fold=0.15),
          np.tile(tone_var(rng, [lin('#6F9A3E'), lin('#86AE4A'), lin('#5A8736')], len(Pn), 0.1), (2, 1)))


def build_lotus(m, P, rng, pond):
    n = P['lotus']; k = 0; tries = 0
    centers = [(-3.4, 9.6, 2.5, 1.2), (3.6, 10.6, 1.6, 0.8), (-7.6, 7.0, 0.9, 1.0), (8.2, 6.2, 0.5, 0.8)]
    while k < n and tries < 4000:
        tries += 1
        cx, cz, sx, sz = centers[rng.choice(4, p=[0.5, 0.2, 0.18, 0.12])]
        x, z = rng.normal(cx, sx), rng.normal(cz, sz)
        if pond.rr(x, z) > 0.9:
            continue
        k += 1
        r = rng.uniform(0.22, 0.5); ns = 14; raised = rng.random() < 0.38
        ang = TAU * np.arange(ns) / ns + rng.uniform(0, 1)
        wave = 1 + 0.07 * np.sin(ang * 3 + rng.uniform(0, 6))
        if raised:
            h = rng.uniform(0.25, 0.85); tilt = rng.normal(0, 0.22, 2)
            cen = np.array([x, WATER_Y + h, z]); rim = np.stack([x + r * wave * np.cos(ang), WATER_Y + h + 0.12 * r + r * (tilt[0] * np.cos(ang) + tilt[1] * np.sin(ang)) + 0.05 * r * np.sin(ang * 4), z + r * wave * np.sin(ang)], 1)
            midr = cen + (rim - cen) * 0.55 + (0, 0.02 * r, 0)
            t = np.concatenate([fan(cen, midr), strip(midr, rim)])
            m.add('荷', tube([(x + rng.normal(0, 0.05), WATER_Y - 0.1, z + rng.normal(0, 0.05)), cen - (0, 0.005, 0)], 0.014, 4, cap=False), LOTUS[2])
        else:
            y = WATER_Y + rng.uniform(0.012, 0.03)
            cen = np.array([x, y - 0.004, z]); rim = np.stack([x + r * wave * np.cos(ang), y + 0.006 * np.sin(ang * 2 + 1), z + r * wave * np.sin(ang)], 1)
            t = fan(cen, rim)
        m.add('荷', t, tone_var(rng, LOTUS, len(t), 0.07))
    # 荷花和莲蓬
    for _ in range(max(3, n // 6)):
        for _try in range(50):
            cx, cz, sx, sz = centers[rng.choice(4, p=[0.6, 0.15, 0.2, 0.05])]
            x, z = rng.normal(cx, sx * 0.8), rng.normal(cz, sz * 0.8)
            if pond.rr(x, z) < 0.86:
                break
        h = rng.uniform(0.5, 1.0); top = np.array([x, WATER_Y + h, z])
        m.add('荷', tube([(x, WATER_Y - 0.1, z), top], 0.012, 4, cap=False), LOTUS[2])
        if rng.random() < 0.7:
            for ring, (npet, open_, ln) in enumerate(((7, 0.9, 0.17), (6, 0.45, 0.15))):
                ang = TAU * np.arange(npet) / npet + ring * 0.4
                d = np.stack([np.cos(ang) * open_, np.full(npet, 1.0 - 0.3 * open_), np.sin(ang) * open_], 1)
                m.add('荷', leaves(np.repeat(top[None], npet, 0), d, ln, 0.085, rng, fold=-0.3), np.tile(tone_var(rng, PETAL, npet, 0.05), (2, 1)))
            m.add('荷', place(lathe([(0.0, 0.0), (0.035, 0.02), (0.04, 0.06), (0.0, 0.065)], 6), top), POD)
        else:
            m.add('荷', place(lathe([(0.0, -0.01), (0.03, 0.02), (0.07, 0.09), (0.0, 0.095)], 7), top), POD)


def build_banana(m, rng, pos):
    x, z = pos
    m.add('芭蕉', tube([(x, -0.1, z), (x + 0.05, 1.5, z)], [0.13, 0.08], 6, cap=False), BANANA[0] * 0.8)
    for k in range(8):
        az = k * 2.3 + rng.uniform(0, 0.6); ln = rng.uniform(1.3, 1.9); d = np.array([math.cos(az), 0, math.sin(az)]); s = np.array([-d[2], 0, d[0]])
        u = np.linspace(0, 1, 7); mid = np.array([x + 0.05, 1.4, z]) + d * (ln * u)[:, None] + np.array([0, 1.0, 0]) * (ln * (0.95 * u - 0.85 * u ** 2))[:, None]
        w = 0.28 * np.sin(np.pi * np.clip(u * 0.9 + 0.08, 0, 1)) ** 0.7
        for sg in (-1, 1):
            edge = mid + s * (sg * w)[:, None] - (0, 0.07, 0) * (w / 0.28)[:, None]
            m.add('芭蕉', strip(mid, edge, closed=False), tone_var(rng, BANANA, 12, 0.06))


def build_grass(m, P, rng, pond, spots):
    n = P['grass']; Pn, Dn = [], []
    for _ in range(n):
        cx, cz, r = spots[rng.integers(len(spots))]
        a = rng.uniform(0, TAU); rr = r * math.sqrt(rng.random())
        x, z = cx + rr * math.cos(a), cz + rr * math.sin(a)
        if pond.rr(x, z) < 1.02:
            continue
        nb = 9
        Pn.append(np.tile([x, -0.01, z], (nb, 1)) + rng.normal(0, 0.03, (nb, 3)) * (1, 0, 1)); Dn.append(rng.normal(0, 0.45, (nb, 3)) + (0, 1.0, 0))
    if not Pn:
        return
    Pn = np.concatenate(Pn); Dn = np.concatenate(Dn)
    m.add('草', leaves(Pn, Dn, rng.uniform(0.18, 0.34, len(Pn)), 0.03, rng, fold=0.1), np.tile(tone_var(rng, GRASS, len(Pn), 0.1), (2, 1)))


# ------------------------------------------------------------------ 桥、陈设、远景
def build_bridge(m, rng):
    """三折曲桥：桥面是一条带斜接转角的石板带（各段不重叠），两侧矮石栏，折点下有石墩。"""
    pts = np.array(BRIDGE, float); w = 0.72; yt, yb = 0.19, 0.03
    d = np.diff(pts, axis=0); d /= np.linalg.norm(d, axis=1, keepdims=True)
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    L, R = [], []
    for i in range(len(pts)):
        if i == 0:
            off = nrm[0] * w
        elif i == len(pts) - 1:
            off = nrm[-1] * w
        else:
            b = unit(nrm[i - 1] + nrm[i]); off = b * (w / (b @ nrm[i]))
        L.append(pts[i] + off); R.append(pts[i] - off)
    L = np.array(L); R = np.array(R)
    def v3(p, y):
        return np.column_stack([p[:, 0], np.full(len(p), y), p[:, 1]])
    T = [strip(v3(L, yt), v3(R, yt), closed=False), strip(v3(L, yb), v3(R, yb), closed=False), strip(v3(L, yb), v3(L, yt), closed=False), strip(v3(R, yb), v3(R, yt), closed=False),
         quad(v3(L[:1], yb)[0], v3(R[:1], yb)[0], v3(R[:1], yt)[0], v3(L[:1], yt)[0]), quad(v3(L[-1:], yb)[0], v3(R[-1:], yb)[0], v3(R[-1:], yt)[0], v3(L[-1:], yt)[0])]
    t = np.concatenate(T); m.add('曲桥', t, tone_var(rng, GRANITE, len(t), 0.05))
    for side in (L, R):
        inner = side + (pts - side) * 0.09
        for i in range(len(pts) - 1):
            a, b = inner[i], inner[i + 1]; dd = unit(b - a)
            m.add('曲桥', bar((a[0], 0.55, a[1]) + np.array([dd[0], 0, dd[1]]) * 0.05, (b[0], 0.55, b[1]) - np.array([dd[0], 0, dd[1]]) * 0.05, 0.09, 0.075 + 0.004 * i, (0, 1, 0)), GRANITE)
            n = max(2, int(np.linalg.norm(b - a) / 0.95))
            for k in range(n + 1):
                q = a + (b - a) * (0.06 + 0.88 * k / n)
                m.add('曲桥', box((0.11, 0.5, 0.11), (q[0], 0.39, q[1]), bottom=False), GRANITE_D)
    for p in pts[1:-1]:
        m.add('曲桥', box((1.1, 0.75, 0.36), (p[0], -0.30, p[1]), bottom=False), GRANITE_D)


def build_props(m, P, rng):
    # 石桌和四只青花瓷鼓凳（瓷面带一点镜面）
    tx, tz = 12.6, -1.6
    m.add('陈设', place(lathe([(0.0, 0.78), (0.5, 0.78), (0.5, 0.70), (0.16, 0.66), (0.2, 0.3), (0.3, -0.02)], 16), (tx, 0, tz)), GRANITE)
    for k in range(4):
        a = k * TAU / 4 + 0.5; sx, sz = tx + 0.85 * math.cos(a), tz + 0.85 * math.sin(a)
        prof = [(0.0, 0.47), (0.15, 0.47), (0.19, 0.42), (0.225, 0.3), (0.235, 0.22), (0.225, 0.14), (0.19, 0.04), (0.16, -0.02)]
        t = place(lathe(prof, 14), (sx, 0, sz))
        seg = (np.arange(len(t)) // 28)
        col = np.where(np.isin(seg, (1, 5))[:, None], COBALT, PORCELAIN)
        m.add('陈设', t, col, 0.22)
    # 廊前、亭边的盆景：石几上一只紫砂盆，盆里一团修剪过的树冠
    for (px, pz) in ((-9.9, -8.25), (-1.4, -8.25), (10.6, -4.6), (11.6, 6.4), (-12.6, 6.0)):
        m.add('陈设', box((0.5, 0.56, 0.36), (px, 0.26, pz), bottom=False), GRANITE_D)
        m.add('陈设', place(lathe([(0.0, 0.56), (0.17, 0.56), (0.21, 0.72), (0.19, 0.74), (0.0, 0.71)], 10), (px, 0, pz)), lin('#7A4A3A'))
        m.add('陈设', tube([(px, 0.7, pz), (px + 0.06, 0.92, pz + 0.03), (px - 0.05, 1.08, pz)], 0.018, 4, cap=False), TRUNK)
        for q in range(3):
            t = blob(rng, 1, rng.uniform(0.13, 0.2), 0.6, 0.35)
            m.add('陈设', place(t, (px + rng.normal(0, 0.1), 1.05 + 0.1 * q, pz + rng.normal(0, 0.08))), tone_var(rng, PINE, len(t), 0.1))


def build_far(m, P, rng):
    """墙外借来的景：一圈高树，远处一座五层小塔。"""
    n = P['far_trees']; far_n3 = Noise3(rng)
    for k in range(n):
        x = -25 + 50 * (k + rng.uniform(0.15, 0.85)) / n; z = rng.uniform(-26.5, -17.5); h = rng.uniform(5.0, 8.2)
        if abs(x - (1.5 - 8.5 * (21.5 - z) / 50.0)) < 3.6:      # 从机位 A 看塔的那条视线上不种树
            continue
        m.add('远树', tube([(x, 0, z), (x + rng.normal(0, 0.3), h * 0.62, z)], [0.28, 0.14], 6, cap=False), TRUNK)
        base = FAR[rng.integers(4)]
        for q in range(3):
            r = rng.uniform(1.6, 2.6) * (1 - 0.12 * q)
            c = np.array([x + np.clip(rng.normal(0, 1.2), -2, 2), h * (0.6 + 0.15 * q) + rng.normal(0, 0.3), z + np.clip(rng.normal(0, 1.0), -1.5, 1.5)])
            # 树冠：里面一团深色的芯，外面一层朝各个方向的大叶片，轮廓是碎的、叶间透光
            t = boulder(rng, far_n3, 1, r * 0.78, rng.uniform(0.75, 0.95), 0.4, flat=False)
            m.add('远树', place(t, c), tone_var(rng, base * 0.8, len(t), 0.08))
            k = 230; d = rng.normal(0, 1, (k, 3)); d /= np.linalg.norm(d, axis=1, keepdims=True)
            shell = c + d * r * np.array([1.0, 0.82, 0.92]) * rng.uniform(0.72, 1.0, (k, 1))
            up = 0.5 + 0.5 * d[:, 1:2]                                           # 朝上的叶片亮一点
            m.add('远树', leaves(shell, d * 0.35 + rng.normal(0, 0.7, (k, 3)), rng.uniform(0.55, 0.95, k), rng.uniform(0.38, 0.6, k), rng, fold=0.18),
                  np.tile(tone_var(rng, base, k, 0.1) * (0.85 + 0.35 * up), (2, 1)))
    px, pz = -7.0, -28.5; y = 0.0; r = 1.75
    for tier in range(5):
        hgt = 1.55 - 0.08 * tier
        body = lathe([(r, y), (r * 0.96, y + hgt)], 6, 0.2); m.add('塔', place(body, (px, 0, pz)), PAGODA_BODY)
        eave = lathe([(r * 0.96, y + hgt - 0.08), (r + 0.95, y + hgt + 0.02), (r + 1.0, y + hgt + 0.1), (r * 0.9, y + hgt + 0.5)], 6, 0.2); m.add('塔', place(eave, (px, 0, pz)), TILE[2])
        y += hgt + 0.48; r *= 0.87
    m.add('塔', place(lathe([(r * 0.9, y - 0.02), (0.2, y + 0.9), (0.09, y + 1.2), (0.16, y + 1.5), (0.05, y + 2.1), (0.0, y + 2.5)], 6, 0.2), (px, 0, pz)), TILE[2])


# ------------------------------------------------------------------ 组装
def build(P):
    rng = np.random.default_rng(P['seed'])
    pond = Pond(np.random.default_rng(P['seed'] * 7919 + 13))
    m = Mesh()
    beds = [(5.2, -9.9, 2.6, 0.95), (13.6, -9.6, 1.6, 1.2), (ROCK[0], ROCK[1], 3.9, 3.3), (11.6, 2.4, 1.3, 1.1), (-14.4, 6.5, 1.2, 1.5), (9.6, 8.6, 1.3, 0.9), (SHADE_TREE[0], SHADE_TREE[1], 0.75, 0.6)]
    build_ground(m, P, pond, rng, beds)
    build_water(m, P, rng)
    build_bank(m, P, pond, rng)
    build_walls(m, P, rng)
    build_corridor(m, P, rng)
    build_pavilion(m, P, rng)
    build_rockery(m, P, rng)
    build_bamboo(m, P, rng)
    build_pine(m, P, rng)
    build_maple(m, P, rng)
    build_shade_tree(m, P, rng)
    build_lotus(m, P, rng, pond)
    build_banana(m, rng, (GATE_X - 1.5, -13.6)); build_banana(m, rng, (-14.4, -12.6))
    build_grass(m, P, rng, pond, [(b[0], b[1], max(b[2], b[3])) for b in beds] + [(GATE_X, -13.0, 1.3), (-11.5, 9.5, 2.5), (-2.0, -5.6, 1.2), (11.5, 8.5, 2.5)])
    build_bridge(m, rng)
    build_props(m, P, rng)
    build_far(m, P, rng)
    eye, target, fov = CAMS[P['cam']]
    if P['eye']:
        eye = tuple(float(v) for v in P['eye'].split(','))
    if P['target']:
        target = tuple(float(v) for v in P['target'].split(','))
    if P['fov'] > 0:
        fov = P['fov']
    eye = np.array(eye, float); target = np.array(target, float)
    w = unit(target - eye); u = unit(np.cross(w, (0, 1, 0))); v = np.cross(u, w)
    f = math.tan(math.radians(fov) / 2)
    la, le = math.radians(P['light_azimuth']), math.radians(P['light_elevation'])
    light = np.array([math.sin(la) * math.cos(le), math.sin(le), math.cos(la) * math.cos(le)])
    assert np.abs(eye).max() <= 32.0
    cam = dict(eye=eye, u=u * f * P['width'] / P['height'], v=v * f, w=w, light=light)
    tris, counts = m.array(); build.labels = m.labels
    info = dict(params=P, triangles=int(len(tris)), parts=counts, eye=[round(float(t), 4) for t in eye], target=[round(float(t), 4) for t in target], fov=fov,
                light=[round(float(t), 4) for t in light])
    return tris, cam, info


def write_scene(path, tris, cam, P):
    seed = P['render_seed'] if P['render_seed'] >= 0 else (0x9E3779B1 * (P['seed'] + 1)) & 0xFFFFFFFF
    with open(path, 'wb') as f:
        f.write(struct.pack('<8I', 0x31544252, P['width'], P['height'], P['spp'], P['ao'], P['depth'], len(tris), seed))
        f.write(np.concatenate([cam['eye'], cam['u'], cam['v'], cam['w'], cam['light'], [P['ao_radius']]]).astype('<f4').tobytes())
        f.write(tris.tobytes())


def check(tris, labels=None):
    """生成后的自查：没有重复的三角形，没有两个共面三角形互相重叠（共面的大组分块比较）。"""
    T = tris[:, :9].astype(np.float64).reshape(-1, 3, 3)
    key = np.sort(np.ascontiguousarray(T).view([('x', 'f8'), ('y', 'f8'), ('z', 'f8')]).reshape(-1, 3), axis=1)
    dup = len(T) - len(np.unique(np.ascontiguousarray(key).view('f8').reshape(-1, 9), axis=0))
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True)
    k = np.argmax(np.abs(n), axis=1); n *= np.sign(n[np.arange(len(n)), k])[:, None]
    d = (n * T[:, 0]).sum(1)
    pairs = set()
    for shift in (0.0, 0.5):                                                    # 量化两遍（错开半格），免得共面的一对被分到相邻两格里
        q = np.floor(np.concatenate([n, d[:, None]], 1) / 4e-5 + shift).astype(np.int64)
        _, inv, cnt = np.unique(q, axis=0, return_inverse=True, return_counts=True)
        inv = inv.ravel(); order = np.argsort(inv, kind='stable'); starts = np.concatenate([[0], np.cumsum(cnt)])
        for g in np.nonzero(cnt > 1)[0]:
            ids = order[starts[g]:starts[g + 1]]
            nn = n[ids[0]]; ax = np.argmax(np.abs(nn)); keep = [i for i in range(3) if i != ax]
            Pg = T[ids][:, :, keep]                                            # 投到平面上
            lo, hi = Pg.min(1), Pg.max(1); e = 1e-6
            for s in range(0, len(ids), 400):
                sl = slice(s, s + 400)
                cand = (lo[sl, None, 0] < hi[None, :, 0] - e) & (lo[None, :, 0] < hi[sl, None, 0] - e) & (lo[sl, None, 1] < hi[None, :, 1] - e) & (lo[None, :, 1] < hi[sl, None, 1] - e)
                ia, ib = np.nonzero(cand); ia = ia + s; ok = ia < ib; ia, ib = ia[ok], ib[ok]
                if not len(ia):
                    continue
                A, B = Pg[ia], Pg[ib]; sep = np.zeros(len(ia), bool)
                for tri in (A, B):                                              # 分离轴：两个三角形的六条边
                    for j in range(3):
                        ed = tri[:, (j + 1) % 3] - tri[:, j]; ax2 = np.stack([-ed[:, 1], ed[:, 0]], 1)
                        pa = (A * ax2[:, None]).sum(2); pb = (B * ax2[:, None]).sum(2); tol = 1e-7 * (np.abs(pa).max(1) + 1)
                        sep |= (pa.max(1) <= pb.min(1) + tol) | (pb.max(1) <= pa.min(1) + tol)
                pairs |= {(int(min(ids[i], ids[j])), int(max(ids[i], ids[j]))) for i, j in zip(ia[~sep], ib[~sep])}
    out = dict(duplicates=int(dup), coplanar_overlaps=len(pairs))
    if labels is not None and pairs:
        kinds = {}
        for i, j in pairs:
            kk = ' / '.join(sorted((labels[i], labels[j]))); kinds[kk] = kinds.get(kk, 0) + 1
        i, j = sorted(pairs)[0]
        out['overlap_parts'] = kinds; out['overlap_example'] = [labels[i], tris[i, :9].round(4).tolist(), labels[j], tris[j, :9].round(4).tolist()]
    return out


def bind_cpus(mask=0x00800000):
    """调研期间的约定：占处理器的运行都绑在逻辑处理器 23。不是 Windows 就什么都不做。"""
    try:
        import ctypes
        k = ctypes.WinDLL('kernel32'); k.GetCurrentProcess.restype = ctypes.c_void_p
        k.SetProcessAffinityMask.argtypes = [ctypes.c_void_p, ctypes.c_size_t]
        k.SetProcessAffinityMask(k.GetCurrentProcess(), mask)
    except Exception:
        pass


def main():
    bind_cpus()
    ap = argparse.ArgumentParser(description='江南园林小样生成程序')
    ap.add_argument('--out', required=True)
    ap.add_argument('--check', action='store_true', help='生成后检查有没有重复或共面重叠的三角形')
    for k, v in DEFAULTS.items():
        ap.add_argument('--' + k.replace('_', '-'), type=type(v), default=v)
    a = ap.parse_args()
    P = {k: getattr(a, k) for k in DEFAULTS}
    tris, cam, info = build(P)
    write_scene(a.out, tris, cam, P)
    if a.check:
        info['check'] = check(tris, build.labels)
    Path(a.out).with_suffix('.json').write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f"{a.out}: {info['triangles']} tris " + ' '.join(f'{k}={v}' for k, v in info['parts'].items()) + (f" check={info['check']}" if a.check else ''))


if __name__ == '__main__':
    main()
