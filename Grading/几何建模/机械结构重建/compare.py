"""作答与图纸逐视图比对：按本题图纸 JSON 中每个视图的定义（含剖视）投影作答零件，
列出对不上的线（图纸有而作答缺少的、作答多出来的）在哪个视图、哪个位置，并输出叠图。

用法：python Grading/几何建模/机械结构重建/compare.py 答案/第01题.json [--out 目录] [--tol 0.3]
叠图在作答目录的 预览/第NN题/比对-NN.png：图纸线浅灰，缺少的线红色，多出的线蓝色。
只比粗实线（可见轮廓）和细虚线（不可见轮廓）；坐标为该视图的二维坐标（零件毫米）。
仅供出题端使用：读取 Grading 下私有图纸几何，严禁打包给受测模型。
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[2] / "几何建模" / "机械结构重建"
sys.path.insert(0, str(PUBLIC / "工具"))

from drawkit import geom2d as g2  # noqa: E402
from drawkit import model, render, sheets  # noqa: E402
from preview import answer_root, load_answer, report  # noqa: E402


def problem_kind(sheet_list):
    return "assembly" if any(s.get("frame") == "assembly" for s in sheet_list) else "part"

TYPES = {"visible": "粗实线", "hidden": "细虚线"}
STEP = 0.25
MAX_LIST = 25


def samples(curves, kind):
    pts, owner = [], []
    for i, c in enumerate(curves):
        if c["type"] != kind:
            continue
        p = g2.sample(c, STEP)
        pts.append(p)
        owner.append(np.full(len(p), i))
    if not pts:
        return np.zeros((0, 2)), np.zeros(0, int)
    return np.concatenate(pts), np.concatenate(owner)


def runs(pts, owner, flags, min_len):
    """沿同一条曲线连续的超差点 → 线段 [(起点, 终点, 长度, 点列)]。"""
    out = []
    n = len(pts)
    i = 0
    while i < n:
        if not flags[i]:
            i += 1
            continue
        j = i
        while j + 1 < n and flags[j + 1] and owner[j + 1] == owner[i] and np.linalg.norm(pts[j + 1] - pts[j]) < 3 * STEP:
            j += 1
        seg = pts[i:j + 1]
        L = float(np.sum(np.linalg.norm(np.diff(seg, axis=0), axis=1))) if len(seg) > 1 else 0.0
        if L >= min_len:
            out.append((seg[0], seg[-1], L, seg, int(owner[i])))
        i = j + 1
    return out


def near(tree, pts, tol):
    if tree is None or len(pts) == 0:
        return np.zeros(len(pts), bool)
    d, _ = tree.query(pts, distance_upper_bound=tol)
    return np.isfinite(d)


def compare_view(ref_lines, ans_lines, tol):
    """返回 {"missing": [...], "extra": [...], "mismatch": [...]}，各项为 (线型, 起点, 终点, 长度, 点列)。"""
    res = {"missing": [], "extra": [], "mismatch": []}
    data = {}
    for kind in TYPES:
        rp, ro = samples(ref_lines, kind)
        ap, ao = samples(ans_lines, kind)
        data[kind] = (rp, ro, ap, ao, cKDTree(rp) if len(rp) else None, cKDTree(ap) if len(ap) else None)
    for kind, other in (("visible", "hidden"), ("hidden", "visible")):
        rp, ro, ap, ao, rt, at = data[kind]
        miss = ~near(at, rp, tol)
        swapped = miss & near(data[other][5], rp, tol)       # 作答在同一位置画成了另一种线型
        for a, b, L, seg, o in runs(rp, ro, miss & ~swapped, 2 * tol + 0.5):
            res["missing"].append((kind, where(ref_lines[o], a, b, L), L, seg))
        for a, b, L, seg, o in runs(rp, ro, swapped, 2 * tol + 0.5):
            res["mismatch"].append((kind, where(ref_lines[o], a, b, L), L, seg))
        extra = ~near(rt, ap, tol) & ~near(data[other][4], ap, tol)
        for a, b, L, seg, o in runs(ap, ao, extra, 2 * tol + 0.5):
            res["extra"].append((kind, where(ans_lines[o], a, b, L), L, seg))
    return res


def fmtp(p):
    return f"({p[0]:.1f}, {p[1]:.1f})"


def where(curve, a, b, L):
    """差异段的位置说明：直线、折线写起止点；圆弧写圆心、半径和角度范围。"""
    if curve["geom"] in ("arc", "circle"):
        c, r = curve["center"], curve["r"]
        ang = lambda p: np.degrees(np.arctan2(p[1] - c[1], p[0] - c[0])) % 360
        if L >= 2 * np.pi * r * 0.98:
            return f"整圆 圆心 {fmtp(c)} R{r:.1f}"
        return f"圆弧 圆心 {fmtp(c)} R{r:.1f}，{ang(a):.0f}°～{ang(b):.0f}°"
    return f"{fmtp(a)} → {fmtp(b)}"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("answer", help="答案文件，如 答案/第01题.json")
    ap.add_argument("--out", help="叠图输出目录（默认 作答目录/预览/第NN题）")
    ap.add_argument("--tol", type=float, default=0.3, help="线条位置容差（毫米，默认 0.3）")
    ap.add_argument("--drawings", help=argparse.SUPPRESS)
    args = ap.parse_args()
    try:
        desc, pid, mdl = load_answer(args.answer)
    except model.ModelError as exc:
        print(f"生成失败：{exc}")
        sys.exit(1)
    print(f"第 {pid} 题")
    report(mdl)
    sheet_list = sheets.problem_sheets(Path(args.drawings) if args.drawings else HERE / "图纸几何", pid)
    if not sheet_list:
        print(f"没有找到第 {pid} 题的图纸 JSON。")
        sys.exit(1)
    out = Path(args.out) if args.out else answer_root(args.answer) / "预览" / f"第{pid}题"
    out.mkdir(parents=True, exist_ok=True)
    kind = problem_kind(sheet_list)
    total = 0
    for sheet in sheet_list:
        shapes = sheets.sheet_shapes(mdl, sheet, kind)
        geoms = sheets.reproject(sheet, shapes)
        cv = render.render_sheet(sheet, mode="RGB", color=(190, 190, 190))
        print(f"\n【图纸 {sheet['sheet']}】" + (f"（{sheet['title']}）" if sheet.get("title") else ""))
        for view in sheet["views"]:
            res = compare_view(view["lines"], geoms.get(view["name"], sheets.empty())["lines"], args.tol)
            n = sum(len(v) for v in res.values())
            total += n
            if not n:
                print(f"  {view['name']}：一致")
                continue
            print(f"  {view['name']}：缺少 {len(res['missing'])} 处，多出 {len(res['extra'])} 处，"
                  f"线型不符 {len(res['mismatch'])} 处")
            items = ([("缺少", k, w, L) for k, w, L, _ in res["missing"]] +
                     [("线型不符", k, w, L) for k, w, L, _ in res["mismatch"]] +
                     [("多出", k, w, L) for k, w, L, _ in res["extra"]])
            items.sort(key=lambda x: -x[3])
            for what, k, w, L in items[:MAX_LIST]:
                if what == "线型不符":
                    desc_ = f"图纸为{TYPES[k]}，作答为{TYPES['hidden' if k == 'visible' else 'visible']}"
                else:
                    desc_ = TYPES[k]
                print(f"    {what} {desc_} {w}，长 {L:.1f}")
            if len(items) > MAX_LIST:
                print(f"    ……另有 {len(items) - MAX_LIST} 处较短的差异")
            s, t = render.view_xf(view)
            for key, color in (("missing", (220, 30, 30)), ("mismatch", (230, 140, 0)), ("extra", (30, 80, 230))):
                for k, w, L, seg in res[key]:
                    cv.curve(g2.xform(g2.polyline(seg, "visible"), s, t), color, width=0.6, pattern=None)
        path = out / f"比对-{sheet['sheet']}.png"
        cv.image().save(path, optimize=True)
        print(f"  叠图：{path}")
    print("\n全部视图与图纸一致。" if total == 0 else f"\n共 {total} 处差异（红色缺少、蓝色多出、橙色线型不符）。")


if __name__ == "__main__":
    main()
