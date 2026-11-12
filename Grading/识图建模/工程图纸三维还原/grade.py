"""评一个或多个作答目录；不执行受测模型提交的程序，只把建模描述交给建模内核生成实体。

每题：precision 按作答表面积计算，recall 对参考的每个几何面单独按面积采样后等权平均，取 F 值。
相连且同曲面的参考面先由 OpenCascade 合并。装配按序号比较，precision 按全部作答面积汇总，
recall 按全部参考面等权汇总。整题允许一个最佳平移对齐（只平移不旋转）。描述在第 k 个特征
出错的零件按第 k−1 步的实体计；缺文件、JSON 无法解析记 0 分。
0.2毫米先求对齐，2毫米沿用同一平移；F综合=0.8F(0.2)+0.2F(2)。
得分 = 分值 × min(1, F综合 / 0.99)。

用法：
  python grade.py <作答目录> [<作答目录> ...] [--output 评分.json] [--only 01,03]
  python grade.py --reference            # 参考答案自评，应为满分
"""
import argparse
import hashlib
import json
import os
import sys
import zipfile
import zlib
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree
from OCP.ShapeUpgrade import ShapeUpgrade_UnifySameDomain
from OCP.TopAbs import TopAbs_FACE
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[2] / "识图建模" / "工程图纸三维还原"
sys.path.insert(0, str(PUBLIC / "工具"))
from drawkit import mesh, model  # noqa: E402

CACHE_VERSION = 2


def load_config(path=None):
    return json.loads(Path(path or HERE / "references.json").read_text(encoding="utf-8-sig"))


# ---------------------------------------------------------------- 表面采样与距离

def point_triangle_dist(p, a, b, c):
    """点到三角形的距离（向量化，Ericson 最近点算法）。"""
    ab, ac = b - a, c - a
    ap, bp, cp = p - a, p - b, p - c
    dot = lambda x, y: np.einsum("ij,ij->i", x, y)
    d1, d2 = dot(ab, ap), dot(ac, ap)
    d3, d4 = dot(ab, bp), dot(ac, bp)
    d5, d6 = dot(ab, cp), dot(ac, cp)
    vc = d1 * d4 - d3 * d2
    vb = d5 * d2 - d1 * d6
    va = d3 * d6 - d5 * d4
    with np.errstate(divide="ignore", invalid="ignore"):
        t_ab = d1 / (d1 - d3)
        t_ac = d2 / (d2 - d6)
        t_bc = (d4 - d3) / ((d4 - d3) + (d5 - d6))
        den = 1.0 / (va + vb + vc)
        v, w = vb * den, vc * den
    conds = [(d1 <= 0) & (d2 <= 0), (d3 >= 0) & (d4 <= d3), (vc <= 0) & (d1 >= 0) & (d3 <= 0),
             (d6 >= 0) & (d5 <= d6), (vb <= 0) & (d2 >= 0) & (d6 <= 0),
             (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0)]
    q = np.empty_like(p)
    q[:] = a + ab * v[:, None] + ac * w[:, None]
    choices = [a, b, a + ab * t_ab[:, None], c, a + ac * t_ac[:, None], b + (c - b) * t_bc[:, None]]
    done = np.zeros(len(p), bool)
    for cond, ch in zip(conds, choices):
        m = cond & ~done
        q[m] = ch[m]
        done |= m
    return np.linalg.norm(p - q, axis=1)


class Surface:
    """面积样本用于准确率与平移，参考面独立样本用于完整率。"""

    def __init__(self, shape, seed, cfg, reference=False):
        s = cfg["sampling"]
        self.face_samples = []
        V, F = mesh.triangulate(shape, s["mesh_linear_mm"], s["mesh_angular_rad"])
        ar = mesh.areas(V, F) if len(F) else np.zeros(0)
        keep = ar > 1e-12
        V, F, ar = V, F[keep], ar[keep]
        self.area = float(ar.sum())
        self.empty = self.area <= 0
        if self.empty:
            self.samples = np.zeros((0, 3))
            return
        rng = np.random.default_rng(seed)
        n = int(np.clip(self.area * s["density_per_mm2"], s["min_points"], s["max_points"]))
        idx = rng.choice(len(F), size=n, p=ar / ar.sum())
        r1, r2 = np.sqrt(rng.random(n)), rng.random(n)
        a, b, c = V[F[idx, 0]], V[F[idx, 1]], V[F[idx, 2]]
        self.samples = a * (1 - r1)[:, None] + b * (r1 * (1 - r2))[:, None] + c * (r1 * r2)[:, None]
        V2, F2 = mesh.subdivide(V, F, s["max_edge_mm"])
        self.A, self.B, self.C = V2[F2[:, 0]], V2[F2[:, 1]], V2[F2[:, 2]]
        self._index()
        if reference:
            unified = ShapeUpgrade_UnifySameDomain(shape, True, True, False)
            unified.SetLinearTolerance(s.get("face_merge_linear_mm", 1e-7))
            unified.SetAngularTolerance(s.get("face_merge_angular_rad", 1e-7))
            unified.Build()
            ex = TopExp_Explorer(unified.Shape(), TopAbs_FACE)
            while ex.More():
                fv, ff = mesh.triangulate(TopoDS.Face_s(ex.Current()), s["mesh_linear_mm"], s["mesh_angular_rad"])
                fa = mesh.areas(fv, ff)
                keep = fa > 1e-12
                ff, fa = ff[keep], fa[keep]
                if len(fa):
                    n = int(np.clip(fa.sum() * s["density_per_mm2"],
                                    s.get("min_points_per_face", 256), s.get("max_points_per_face", 5000)))
                    self.face_samples.append(sample_triangles(fv, ff, fa, n, rng))
                ex.Next()

    def _index(self):
        """按三角形包围球大小分组；每组查询半径是严格上界。"""
        self.sample_tree = cKDTree(self.samples)
        if self.empty:
            return
        cen = (self.A + self.B + self.C) / 3
        vertices = np.stack([self.A, self.B, self.C])
        radii = np.linalg.norm(vertices - cen, axis=2).max(axis=0)
        self.lower, self.upper = vertices.min(axis=0), vertices.max(axis=0)
        self.tree = cKDTree(cen)
        self.groups = []
        bins = np.floor(np.log2(np.maximum(radii, 1e-12))).astype(int)
        for size in np.unique(bins):
            ids = np.flatnonzero(bins == size)
            self.groups.append((ids, cKDTree(cen[ids]), float(radii[ids].max())))

    @property
    def face_count(self):
        return len(self.face_samples)

    def within(self, pts, tol):
        """pts 各点到本表面的距离是否 ≤ tol。"""
        if self.empty or len(pts) == 0:
            return np.zeros(len(pts), bool)
        out = np.zeros(len(pts), bool)
        for start in range(0, len(pts), 2048):
            chunk = pts[start:start + 2048]
            # 最近质心命中即可确认；未命中的点继续完整候选查询，不近似拒绝。
            _, tri = self.tree.query(chunk)
            hit = point_triangle_dist(chunk, self.A[tri], self.B[tri], self.C[tri]) <= tol
            for ids, tree, radius in self.groups:
                pending = np.flatnonzero(~hit)
                if not len(pending):
                    break
                lists = tree.query_ball_point(chunk[pending], tol + radius, return_sorted=False)
                lens = np.fromiter((len(x) for x in lists), int, len(lists))
                if not lens.sum():
                    continue
                tri = ids[np.concatenate([np.asarray(x, int) for x in lists if len(x)])]
                owner = pending[np.repeat(np.arange(len(pending)), lens)]
                p = chunk[owner]
                # AABB 距离下界筛选，避免对大量无关三角形计算精确距离。
                delta = np.maximum(np.maximum(self.lower[tri] - p, p - self.upper[tri]), 0)
                keep = np.einsum('ij,ij->i', delta, delta) <= tol * tol
                tri, owner = tri[keep], owner[keep]
                d = point_triangle_dist(chunk[owner], self.A[tri], self.B[tri], self.C[tri])
                hit[owner[d <= tol]] = True
            out[start:start + len(chunk)] = hit
        return out


def fscore(p, r):
    return 0.0 if p + r <= 0 else 2 * p * r / (p + r)


def sample_triangles(V, F, areas, n, rng):
    idx = rng.choice(len(F), size=n, p=areas / areas.sum())
    r1, r2 = np.sqrt(rng.random(n)), rng.random(n)
    a, b, c = V[F[idx, 0]], V[F[idx, 1]], V[F[idx, 2]]
    return a * (1 - r1)[:, None] + b * (r1 * (1 - r2))[:, None] + c * (r1 * r2)[:, None]


def evaluate(pairs, t, tol, limit=None, coarse_out=None):
    """pairs: [(作答 Surface 或 None, 参考 Surface)]；返回各零件 (P, R, F)。limit：只用前若干个采样点（粗选平移用）。"""
    out = []
    for ans, ref in pairs:
        if ans is None or ans.empty:
            out.append((0.0, 0.0, 0.0))
            if coarse_out is not None:
                coarse_out.append((0.0, 0.0, 0.0))
            continue
        precision_hits = ref.within(ans.samples[:limit] + t, tol)
        P = float(precision_hits.mean())
        # 粗选也覆盖每个参考面，不能截取拼接后开头的几个面。
        samples = [pts[:min(limit, 128)] if limit else pts for pts in ref.face_samples]
        hits = ans.within(np.concatenate(samples) - t, tol)
        offsets = np.cumsum([0] + [len(pts) for pts in samples])
        R = float(np.mean([hits[a:b].mean() for a, b in zip(offsets[:-1], offsets[1:])]))
        out.append((P, R, fscore(P, R)))
        if coarse_out is not None:
            cp = float(precision_hits[:4000].mean())
            cr = float(np.mean([hits[a:min(a + 128, b)].mean() for a, b in zip(offsets[:-1], offsets[1:])]))
            coarse_out.append((cp, cr, fscore(cp, cr)))
    return out


def aggregate(pairs, ev):
    """整题 P 按作答面积加权，R 按参考几何面数加权，再计算整题 F。"""
    area = sum(ans.area for ans, _ in pairs if ans is not None)
    faces = sum(ref.face_count for _, ref in pairs)
    P = sum((ans.area if ans is not None else 0) * e[0] for (ans, _), e in zip(pairs, ev)) / area if area else 0.0
    R = sum(ref.face_count * e[1] for (_, ref), e in zip(pairs, ev)) / faces if faces else 0.0
    return P, R, fscore(P, R)


def icp_samples(pairs):
    """所有起点复用同一组确定性 ICP 样本。"""
    rng = np.random.default_rng(7)
    subs = []
    for ans, ref in pairs:
        if ans is None or ans.empty:
            continue
        ia = rng.choice(len(ans.samples), min(len(ans.samples), 6000), replace=False)
        ir = rng.choice(len(ref.samples), min(len(ref.samples), 6000), replace=False)
        subs.append((ans, ref, ans.samples[ia], ref.samples[ir]))
    return subs


def icp_translation(pairs, t0, tol, iters=40, subs=None):
    """只平移的双向 ICP（采样点最近点，逐步收紧配对距离）。"""
    t = np.asarray(t0, float).copy()
    subs = icp_samples(pairs) if subs is None else subs
    if not subs:
        return t
    for k in range(iters):
        dmax = max(3 * tol, 20.0 * (0.8 ** k))
        res = []
        for ans, ref, A, Rs in subs:
            d, i = ref.sample_tree.query(A + t, distance_upper_bound=dmax)
            ok = np.isfinite(d)
            res.append(ref.samples[i[ok]] - (A[ok] + t))
            d, i = ans.sample_tree.query(Rs - t, distance_upper_bound=dmax)
            ok = np.isfinite(d)
            res.append(Rs[ok] - (ans.samples[i[ok]] + t))
        res = np.concatenate(res) if res else np.zeros((0, 3))
        if len(res) < 10:
            break
        step = res.mean(axis=0)
        t += step
        if np.linalg.norm(step) < 1e-5 and dmax <= 3 * tol + 1e-9:
            break
    return t


def bbox_of(surfs):
    pts = [s.samples for s in surfs if s is not None and not s.empty]
    if not pts:
        return None
    allp = np.concatenate(pts)
    return allp.min(axis=0), allp.max(axis=0), allp.mean(axis=0)


def align_and_score(pairs, tol):
    """在若干初值上做平移 ICP，取 F 值最高的平移（含不平移）。"""
    def total(ev):
        return aggregate(pairs, ev)[2]

    best_t = np.zeros(3)
    coarse0 = []
    full0 = evaluate(pairs, best_t, tol, coarse_out=coarse0)
    if total(full0) >= 0.9999:
        return best_t, full0
    best_ev = coarse0
    a = bbox_of([p[0] for p in pairs])
    r = bbox_of([p[1] for p in pairs])
    starts = [np.zeros(3)]
    if a and r:
        starts += [r[2] - a[2], (r[0] + r[1]) / 2 - (a[0] + a[1]) / 2, r[0] - a[0], r[1] - a[1]]
    subs = icp_samples(pairs)
    tried_starts, tried_results = [], [np.zeros(3)]
    for t0 in starts:
        if any(np.linalg.norm(t0 - old) < 1e-9 for old in tried_starts):
            continue
        tried_starts.append(t0)
        t = icp_translation(pairs, t0, tol, subs=subs)
        if any(np.linalg.norm(t - old) < 1e-9 for old in tried_results):
            continue
        tried_results.append(t)
        ev = evaluate(pairs, t, tol, 4000)
        if total(ev) > total(best_ev) + 1e-9:
            best_t, best_ev = t, ev
    if not np.any(best_t):
        return best_t, full0
    full = evaluate(pairs, best_t, tol)
    return (best_t, full) if total(full) > total(full0) else (np.zeros(3), full0)


def score_dual(pairs, tol, cfg):
    """宽容差只重算命中，不重新对齐；先各自汇总P/R/F，再按80/20合成整题F。"""
    t, strict = align_and_score(pairs, tol)
    narrow = aggregate(pairs, strict)
    wide_tol = float(cfg.get('wide_tolerance_mm', 2.0))
    # 窄容差全部命中必然也全部命中宽容差；不改变任何采样或数值定义。
    wide = strict if wide_tol >= tol and narrow[2] == 1.0 else evaluate(pairs, t, wide_tol)
    broad = aggregate(pairs, wide)
    weight = float(cfg.get('strict_f_weight', .8))
    combined = weight * narrow[2] + (1-weight) * broad[2]
    return dict(translation=t, strict=strict, wide=wide, strict_total=narrow, wide_total=broad,
                fscore=combined, strict_weight=weight, wide_tolerance=wide_tol)


# ---------------------------------------------------------------- 一题

def seed_of(pid, name, side):
    return zlib.crc32(f"{pid}/{name}/{side}".encode("utf-8"))


def reference_shapes(record, base=HERE):
    desc = model.load(base / record["reference"])
    mdl = model.build(desc, record["id"])
    if not mdl.ok:
        e = mdl.errors()[0]
        raise RuntimeError(f"参考描述第 {record['id']} 题零件 {e['part']} 第 {e['step']} 个特征出错：{e['message']}")
    return {p.name: p.placed() for p in mdl.parts}


def reference_surfaces(record, cfg, base=HERE):
    pid = record["id"]
    # 仅保存数值数组，不反序列化可执行对象。描述、采样参数及实现变化自动失效。
    reference_path = (Path(base) / record['reference']).resolve()
    digest = hashlib.sha256()
    for data in (reference_path.read_bytes(),
                 json.dumps([CACHE_VERSION, pid, cfg['sampling']], sort_keys=True).encode(),
                 Path(__file__).read_bytes(), Path(mesh.__file__).read_bytes(), Path(model.__file__).read_bytes()):
        digest.update(data)
    key = digest.hexdigest()
    # 同一参考路径只保留一个版本，参数调整不会积累大体积旧缓存。
    slot = hashlib.sha256(str(reference_path).encode('utf-8')).hexdigest()
    cache = HERE / '.surface-cache' / (slot + '.npz')
    try:
        with np.load(cache, allow_pickle=False) as data:
            if str(data['key']) != key:
                raise ValueError('stale reference cache')
            result = {}
            for i, name in enumerate(data['names'].tolist()):
                surf = Surface.__new__(Surface)
                surf.area = float(data[f'{i}_area'])
                surf.empty = surf.area <= 0
                surf.samples = data[f'{i}_samples']
                surf.face_samples = (list(np.split(data[f'{i}_faces'], data[f'{i}_offsets']))
                                     if int(data[f'{i}_face_count']) else [])
                if not surf.empty:
                    surf.A, surf.B, surf.C = (data[f'{i}_{key}'] for key in 'ABC')
                surf._index()
                result[name] = surf
            return result
    except (OSError, ValueError, KeyError, EOFError, zipfile.BadZipFile):
        pass
    result = {name: Surface(shape, seed_of(pid, name, "ref"), cfg, reference=True)
              for name, shape in reference_shapes(record, base).items()}
    arrays = {'names': np.array(list(result)), 'key': np.array(key)}
    for i, surf in enumerate(result.values()):
        arrays.update({f'{i}_area': surf.area, f'{i}_samples': surf.samples,
                       f'{i}_face_count': surf.face_count,
                       f'{i}_faces': np.concatenate(surf.face_samples) if surf.face_samples else np.empty((0, 3)),
                       f'{i}_offsets': np.cumsum([len(p) for p in surf.face_samples])[:-1]})
        if not surf.empty:
            arrays.update({f'{i}_{key}': getattr(surf, key) for key in 'ABC'})
    temporary = cache.with_suffix(f'.{os.getpid()}.tmp.npz')
    try:
        cache.parent.mkdir(exist_ok=True)
        np.savez(temporary, **arrays)
        os.replace(temporary, cache)
    except OSError:
        # 只读评分副本也可评分，缓存不可写不影响结果。
        pass
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass
    return result


def grade_problem(record, ref_surfs, answer_path, cfg):
    pid = record["id"]
    tol = float(record.get("tolerance_mm", cfg["tolerance_mm"]))
    full = float(cfg["full_credit_f"])
    item = {"name": f"第{pid}题", "id": pid, "tier": record["tier"], "title": record["name"],
            "kind": record["kind"], "max": record["max"], "status": "ok", "errors": [],
            "fscore": 0.0, "precision": 0.0, "recall": 0.0, "translation": [0.0, 0.0, 0.0], "parts": []}
    item.update(fscore_strict=0.0, fscore_wide=0.0, wide_precision=0.0, wide_recall=0.0)
    answer_path = Path(answer_path)
    if not answer_path.exists():
        item.update(status="missing", score=0.0, reason="未提交本题答案文件，记 0 分。")
        return item
    try:
        mdl = model.build(model.load(answer_path), pid)
    except model.ModelError as exc:
        item.update(status="invalid", score=0.0, reason=f"{exc}，记 0 分。")
        item["errors"].append({"part": None, "step": None, "message": str(exc)})
        return item
    item["errors"] = mdl.errors()
    if item["errors"]:
        item["status"] = "partial"
    names = [p.name for p in mdl.parts]
    if record["kind"] == "part":
        shapes = [p.placed() for p in mdl.parts if p.shape is not None]
        ans_shape = None if not shapes else (shapes[0] if len(shapes) == 1 else model.compound(shapes))
        ref_name = next(iter(ref_surfs))
        matched = [(ref_name, ans_shape)]
    else:
        matched = []
        for ref_name in ref_surfs:
            p = mdl.part(ref_name)
            matched.append((ref_name, p.placed() if p is not None and p.shape is not None else None))
        extra = [n for n in names if n not in ref_surfs]
        if extra:
            item["extra_parts"] = extra
    pairs = []
    for ref_name, ans_shape in matched:
        ans = Surface(ans_shape, seed_of(pid, ref_name, "ans"), cfg) if ans_shape is not None else None
        pairs.append((ans, ref_surfs[ref_name]))
    dual = score_dual(pairs, tol, cfg)
    t, ev, wide_ev = dual['translation'], dual['strict'], dual['wide']
    item["translation"] = [round(float(x), 3) + 0.0 for x in t]
    for (ref_name, _), (P, R, F), (WP, WR, WF) in zip(matched, ev, wide_ev):
        item["parts"].append({"name": ref_name, "precision": round(P, 4), "recall": round(R, 4),
                              "fscore": round(.8*F+.2*WF, 4), "fscore_strict": round(F,4), "fscore_wide": round(WF,4),
                              "wide_precision": round(WP,4), "wide_recall": round(WR,4), "reference_faces": ref_surfs[ref_name].face_count})
    P, R, Fstrict = dual['strict_total']
    WP, WR, Fwide = dual['wide_total']
    F = dual['fscore']
    item["precision"] = round(P, 4)
    item["recall"] = round(R, 4)
    item["fscore"] = round(F, 4)
    item.update(fscore_strict=round(Fstrict,4), fscore_wide=round(Fwide,4), wide_precision=round(WP,4), wide_recall=round(WR,4),
                tolerance_mm=tol, wide_tolerance_mm=dual['wide_tolerance'])
    item['_strict_f'] = Fstrict
    raw = record["max"] * min(1.0, F / full)
    item["score"] = round(raw, 2)
    item["_raw"] = raw
    why = [f"F综合 {F:.4f}=0.8×F({tol:g}mm) {Fstrict:.4f}+0.2×F({dual['wide_tolerance']:g}mm) {Fwide:.4f}；窄容差P={P:.4f}、R={R:.4f}，宽容差P={WP:.4f}、R={WR:.4f}"]
    if np.linalg.norm(t) > 1e-3:
        why.append(f"平移对齐 ({', '.join(f'{x:.2f}' for x in t)})")
    if item["errors"]:
        e = item["errors"][0]
        why.append(f"零件 {e['part']} 第 {e['step']} 个特征出错（{e['message']}），按出错前一步的实体计")
    if record["kind"] == "assembly":
        why.append("各零件 F 值：" + "，".join(f"{p['name']}={p['fscore']:.3f}" for p in item["parts"]))
    item["reason"] = "；".join(why) + f"；得 {item['score']} 分。"
    return item


def grade(directories, cfg=None, only=None, answer_path=None, base=HERE):
    """directories：作答目录（含 答案/）；answer_path(目录, 题号) 可替换答案位置。"""
    cfg = cfg or load_config()
    records = [r for r in cfg["records"] if not only or r["id"] in only]
    answer_path = answer_path or (lambda d, pid: Path(d) / "答案" / f"第{pid}题.json")
    refs = {r["id"]: reference_surfaces(r, cfg, base) for r in records}
    results = []
    for directory in directories:
        items, total = [], 0.0
        for r in records:
            item = grade_problem(r, refs[r["id"]], answer_path(directory, r["id"]), cfg)
            total += item.pop("_raw", item["score"])
            item.pop('_strict_f', None)
            items.append(item)
        results.append({"directory": str(Path(directory).resolve()), "items": items, "total": round(total, 2)})
    return {"geometry_schema": 4, "tolerance_mm": cfg["tolerance_mm"], "wide_tolerance_mm":cfg.get('wide_tolerance_mm',2.0),
            "strict_f_weight":cfg.get('strict_f_weight',.8), "full_credit_f": cfg["full_credit_f"],
            "assembly_weighting": "precision_area_recall_faces", "results": results}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("directories", nargs="*", help="一个或多个作答目录（含 答案/第NN题.json）")
    ap.add_argument("--output", type=Path, help="评分 JSON 输出位置")
    ap.add_argument("--only", help="只评这些题号，逗号分隔")
    ap.add_argument("--reference", action="store_true", help="用参考答案自评")
    args = ap.parse_args()
    only = set(args.only.split(",")) if args.only else None
    if args.reference:
        cfg = load_config()
        result = grade(["参考答案"], cfg, only,
                       answer_path=lambda d, pid: HERE / next(r["reference"] for r in cfg["records"] if r["id"] == pid))
    else:
        if not args.directories:
            ap.error("请给出作答目录，或用 --reference")
        result = grade(args.directories, only=only)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
