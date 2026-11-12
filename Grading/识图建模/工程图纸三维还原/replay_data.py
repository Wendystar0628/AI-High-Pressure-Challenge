"""视频回放数据导出：replay.json + GLB 网格（毫米，图纸坐标系 Z 朝上）。格式见 replay_data.md。

用法：
  python replay_data.py --answers <作答目录> --out <输出目录> [--only 01,02]
  python replay_data.py --reference --out <输出目录>        # 用参考答案当作答（播放器联调）
"""
import argparse
import json
import shutil
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.gp import gp_Pnt

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import grade  # noqa: E402
from grade import PUBLIC, model, mesh  # noqa: E402

MESH_LIN, MESH_ANG = 0.1, 0.3      # 回放网格精度（毫米、弧度）
CMP_EDGE = 4.0                     # 比对网格细分边长（毫米），越小着色越细
EXPLODE = 0.5                      # 爆炸距离为装配包围盒对角线的此倍数


# ---------------------------------------------------------------- GLB

def write_glb(path, V, F):
    """最小 glTF 2.0 二进制：一个网格、一个三角形图元（只含 POSITION 与索引）。顶点会去重。"""
    V = np.asarray(V, np.float64)
    F = np.asarray(F, np.int64)
    if len(V) and len(F):
        key = np.round(V, 5)
        uniq, inv = np.unique(key, axis=0, return_inverse=True)
        V, F = uniq, inv.reshape(-1)[F]
        F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
    pos = V.astype(np.float32).tobytes()
    idx = F.astype(np.uint32).tobytes()
    pad = lambda b, fill=b"\0": b + fill * ((4 - len(b) % 4) % 4)
    pos, idx = pad(pos), pad(idx)
    lo = V.min(axis=0).tolist() if len(V) else [0, 0, 0]
    hi = V.max(axis=0).tolist() if len(V) else [0, 0, 0]
    gltf = {
        "asset": {"version": "2.0", "generator": "工程图纸三维还原 replay_data.py"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "mode": 4}]}] if len(F) else [{"primitives": []}],
        "buffers": [{"byteLength": len(pos) + len(idx)}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(pos), "target": 34962},
                        {"buffer": 0, "byteOffset": len(pos), "byteLength": len(idx), "target": 34963}],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": int(len(V)), "type": "VEC3", "min": lo, "max": hi},
                      {"bufferView": 1, "componentType": 5125, "count": int(F.size), "type": "SCALAR"}],
    }
    if not len(F):
        # 空分类也给有效的 GLB 空场景，避免零长度 accessor / 空 primitives。
        gltf = {"asset": gltf["asset"], "scene": 0, "scenes": [{}]}
        pos = idx = b""
    js = pad(json.dumps(gltf, ensure_ascii=False).encode("utf-8"), b" ")
    binary = pos + idx
    chunks = struct.pack("<II", len(js), 0x4E4F534A) + js
    if binary:
        chunks += struct.pack("<II", len(binary), 0x004E4942) + binary
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, 12 + len(chunks)) + chunks)


def shape_glb(path, shape, matrix=None):
    V, F = mesh.triangulate(shape, MESH_LIN, MESH_ANG)
    if matrix is not None:
        V = mesh.transform(V, matrix)
    write_glb(path, V, F)


# ---------------------------------------------------------------- 步骤

def clip_box(shapes, margin=5.0):
    lo, hi = None, None
    for s in shapes:
        b = model.shape_bbox(s) if s is not None else None
        if b:
            lo = b[0] if lo is None else np.minimum(lo, b[0])
            hi = b[1] if hi is None else np.maximum(hi, b[1])
    if lo is None:
        return None
    pad = (hi - lo) * 0.05 + margin
    lo, hi = lo - pad, hi + pad
    return BRepPrimAPI_MakeBox(gp_Pnt(*lo), gp_Pnt(*hi)).Shape()


def common(a, b):
    try:
        op = BRepAlgoAPI_Common(a, b)
        if op.IsDone():
            r = op.Shape()
            if model.shape_volume(r) > 1e-6:
                return r
    except Exception:
        pass
    return None


def step_tool(step, prev):
    """这一步加上或挖掉的那块实体：除料取实际切掉的材料，加料取工具体（截到零件附近）。"""
    tool = model.compound(step.tools)
    if prev is not None:
        # 用前后实体差得到实际增减材料；镜像、阵列、求交同样适用。
        a, b = (prev, step.result) if step.kind == "cut" else (step.result, prev)
        return model.boolean("cut", a, [b], "回放步骤材料差")
    box = clip_box([prev, step.result])
    clipped = common(tool, box) if box is not None else None
    return clipped if clipped is not None else tool


def col_major(m):
    return [round(float(x), 9) + 0.0 for x in np.asarray(m).flatten(order="F")]


def export_part(part, prefix, out_dir, rel):
    steps = []
    prev = None
    for k, st in enumerate(part.steps, start=1):
        tool_name = f"{prefix}_tool_{k:02d}.glb"
        res_name = f"{prefix}_step_{k:02d}.glb"
        shape_glb(out_dir / tool_name, step_tool(st, prev))
        shape_glb(out_dir / res_name, st.result)
        entry = {"label": st.label, "kind": st.kind, "tool": f"{rel}/{tool_name}", "result": f"{rel}/{res_name}",
                 "feature": st.index, "type": st.type}
        if st.type in ("fillet", "chamfer"):
            entry["transition"] = "finish"
        if st.revolve is not None:
            entry["revolve"] = {"origin": [round(float(x), 6) for x in st.revolve["origin"]],
                                "axis": [round(float(x), 6) for x in st.revolve["axis"]]}
        else:
            ax = st.axis if st.axis is not None else np.array([0.0, 0.0, 1.0])
            entry["axis"] = [round(float(x), 6) + 0.0 for x in ax]
        steps.append(entry)
        prev = st.result
    final = None
    if part.shape is not None:
        final = f"{rel}/{prefix}_final.glb"
        shape_glb(out_dir / f"{prefix}_final.glb", part.shape)
    return steps, final


# ---------------------------------------------------------------- 比对网格

def classify_mesh(shape, matrix, shift, other, tol):
    """把 shape（放到装配位置并平移 shift 后）的表面三角形按是否落在 other 表面容差内分成两组。"""
    V, F = mesh.triangulate(shape, min(MESH_LIN, tol/10), min(MESH_ANG, .1))
    V = mesh.transform(V, matrix) + shift
    V, F = mesh.subdivide(V, F, CMP_EDGE)
    if not len(F):
        return (V, F), (V, F)
    cen = (V[F[:, 0]] + V[F[:, 1]] + V[F[:, 2]]) / 3
    ok = other.within(cen, tol) if other is not None and not other.empty else np.zeros(len(F), bool)
    return (V, F[ok]), (V, F[~ok])


def merge_meshes(items):
    Vs, Fs, off = [], [], 0
    for V, F in items:
        if len(F):
            Vs.append(V)
            Fs.append(F + off)
            off += len(V)
    if not Vs:
        return np.zeros((0, 3)), np.zeros((0, 3), np.int64)
    return np.concatenate(Vs), np.concatenate(Fs)


# ---------------------------------------------------------------- 一题

def first_drawing(pid, out_dir, rel):
    found = list((PUBLIC / pid).glob(f"{pid}.png")) + list((PUBLIC / pid).glob(f"{pid}-*.png"))
    # 新装配题超过九张图；按张次排序，不能把-10排在-2之前。
    found.sort(key=lambda p: int(p.stem.split('-')[1]) if '-' in p.stem else 0)
    names = []
    for i, p in enumerate(found, start=1):
        name = "drawing.png" if i == 1 else f"drawing-{i}.png"
        # 回放只显示小幅缩略图；A1原图直接解码会让多个渲染面占用大量显存。
        # 原始240dpi题图不改，回放副本等比限制到1600×1200像素。
        with Image.open(p) as img:
            img.thumbnail((1600, 1200), Image.Resampling.LANCZOS)
            img.save(out_dir / name, optimize=True)
        names.append(f"{rel}/{name}")
    return names


def export_problem(record, cfg, answer_path, out_root, ref_cache):
    pid = record["id"]
    rel = pid
    out_dir = out_root / pid
    out_dir.mkdir(parents=True, exist_ok=True)
    tol = float(record.get("tolerance_mm", cfg["tolerance_mm"]))
    drawings = first_drawing(pid, out_dir, rel)
    entry = {"id": pid, "tier": record["tier"], "name": record["name"], "kind": record["kind"], "max": record["max"],
             "drawing": drawings[0] if drawings else None, "drawings": drawings,
             "status": "ok", "error": None, "parts": [], "reference": {"parts": []}, "compare": None}
    # 参考
    if pid not in ref_cache:
        rdesc = model.load(HERE / record["reference"])
        rmdl = model.build(rdesc, pid)
        if not rmdl.ok:
            raise RuntimeError(f"第 {pid} 题参考描述无效：{rmdl.errors()}")
        ref_cache[pid] = (rmdl, {p.name: grade.Surface(p.placed(), grade.seed_of(pid, p.name, "ref"), cfg, reference=True)
                                 for p in rmdl.parts})
    rmdl, rsurf = ref_cache[pid]
    for p in rmdl.parts:
        name = f"ref_p{p.name}.glb"
        shape_glb(out_dir / name, p.shape)
        entry["reference"]["parts"].append({"name": p.name, "title": p.title, "mesh": f"{rel}/{name}",
                                            "placement": col_major(p.placement)})
    # 作答
    answer_path = Path(answer_path)
    if not answer_path.exists():
        entry["status"] = "missing"
        return entry
    try:
        mdl = model.build(model.load(answer_path), pid)
    except model.ModelError as exc:
        entry["status"] = "invalid"
        entry["error"] = {"part": None, "step": None, "message": str(exc)}
        return entry
    errs = mdl.errors()
    if errs:
        entry["status"] = "invalid"
        entry["error"] = {"part": errs[0]["part"], "step": errs[0]["step"], "message": errs[0]["message"]}
    centers, bounds = {}, []
    for p in mdl.parts:
        if p.shape is not None:
            b = model.shape_bbox(p.placed())
            centers[p.name] = (b[0] + b[1]) / 2
            bounds.append(b)
    if centers:
        lo = np.min([b[0] for b in bounds], axis=0)
        hi = np.max([b[1] for b in bounds], axis=0)
        asm_c, explode_len = (lo + hi) / 2, np.linalg.norm(hi - lo) * EXPLODE
    for part_index, p in enumerate(mdl.parts, 1):
        prefix = f"p{part_index}"
        steps, final = export_part(p, prefix, out_dir, rel)
        explode = [0.0, 0.0, 0.0]
        if record["kind"] == "assembly" and p.name in centers and len(centers) > 1:
            direction = centers[p.name] - asm_c
            if np.linalg.norm(direction) < 1e-6:
                direction = np.eye(3)[(part_index - 1) % 3]
            explode = [round(float(x), 3) for x in direction / np.linalg.norm(direction) * explode_len]
        entry["parts"].append({"name": p.name, "title": p.title, "steps": steps, "final": final,
                               "placement": col_major(p.placement), "explode": explode})
    # 比对（与 grade.py 同一套对齐和容差）
    if record["kind"] == "part":
        shapes = [p.placed() for p in mdl.parts if p.shape is not None]
        ans_shape = None if not shapes else (shapes[0] if len(shapes) == 1 else model.compound(shapes))
        matched = [(next(iter(rsurf)), ans_shape)]
    else:
        matched = [(n, mdl.part(n).placed() if mdl.part(n) is not None and mdl.part(n).shape is not None else None)
                   for n in rsurf]
    pairs = [(grade.Surface(s, grade.seed_of(pid, n, "ans"), cfg) if s is not None else None, rsurf[n])
             for n, s in matched]
    dual = grade.score_dual(pairs, tol, cfg)
    t, ev, wide_ev = dual['translation'], dual['strict'], dual['wide']
    good, extra, missing = [], [], []
    rparts = {p.name: p for p in rmdl.parts}
    for (n, s), (ans, ref) in zip(matched, pairs):
        if s is not None:
            m_ok, m_bad = classify_mesh(s, np.eye(4), t, ref, tol)
            good.append(m_ok)
            extra.append(m_bad)
        rp = rparts[n]
        _, r_bad = classify_mesh(rp.shape, rp.placement, np.zeros(3), _shifted(ans, t), tol)
        missing.append(r_bad)
    for name, items in (("cmp_matched.glb", good), ("cmp_extra.glb", extra), ("cmp_missing.glb", missing)):
        V, F = merge_meshes(items)
        write_glb(out_dir / name, V, F)
    P, R, Fstrict = dual['strict_total']
    WP, WR, Fwide = dual['wide_total']
    F = dual['fscore']
    entry["compare"] = {
        "fscore": round(F, 4),
        "precision": round(P, 4),
        "recall": round(R, 4),
        "fscore_strict": round(Fstrict,4), "fscore_wide": round(Fwide,4),
        "wide_precision": round(WP,4), "wide_recall": round(WR,4),
        "strict_f_weight": dual['strict_weight'], "wide_tolerance": dual['wide_tolerance'],
        "translation": [round(float(x), 3) + 0.0 for x in t],
        "tolerance": tol,
        "parts": [{"name": n, "fscore": round(.8*e[2]+.2*w[2], 4), "fscore_strict":round(e[2],4), "fscore_wide":round(w[2],4)} for (n, _), e, w in zip(matched, ev, wide_ev)],
        "matched": f"{rel}/cmp_matched.glb", "extra": f"{rel}/cmp_extra.glb", "missing": f"{rel}/cmp_missing.glb",
    }
    return entry


class _shifted:
    """把作答表面平移 t 后的距离查询（参考三角形是否落在作答表面容差内）。"""

    def __init__(self, surf, t):
        self.surf, self.t = surf, np.asarray(t, float)
        self.empty = surf is None or surf.empty

    def within(self, pts, tol):
        return self.surf.within(pts - self.t, tol)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--answers", help="作答目录（含 答案/第NN题.json）")
    src.add_argument("--reference", action="store_true", help="用参考答案当作答导出")
    ap.add_argument("--out", required=True, help="输出目录")
    ap.add_argument("--only", help="只导出这些题号，逗号分隔")
    ap.add_argument("--config", help=argparse.SUPPRESS)
    args = ap.parse_args()
    cfg = grade.load_config(args.config)
    only = set(args.only.split(",")) if args.only else None
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    problems, cache = [], {}
    for r in cfg["records"]:
        if only and r["id"] not in only:
            continue
        if args.reference:
            path = HERE / r["reference"]
        else:
            path = Path(args.answers) / "答案" / f"第{r['id']}题.json"
        problems.append(export_problem(r, cfg, path, out, cache))
        e = problems[-1]
        state = {"ok": "成功", "missing": "缺少作答", "invalid": "描述有误"}[e["status"]]
        print(f"第 {r['id']} 题：{state}" + (f"，F {e['compare']['fscore']}" if e["compare"] else ""))
        if e["error"]:
            err = e["error"]
            print(f"  零件 {err['part']}，特征 {err['step']}：{err['message']}")
    doc = {"format": "工程图纸三维还原·回放", "version": 1, "units": "毫米", "up": "Z",
           "scoring_schema": 4, "tolerance_mm":cfg['tolerance_mm'], "wide_tolerance_mm":cfg.get('wide_tolerance_mm',2.0), "strict_f_weight":cfg.get('strict_f_weight',.8),
           "source": "reference" if args.reference else str(Path(args.answers).resolve()), "problems": problems}
    (out / "replay.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"已写出 {out / 'replay.json'}")


if __name__ == "__main__":
    main()
