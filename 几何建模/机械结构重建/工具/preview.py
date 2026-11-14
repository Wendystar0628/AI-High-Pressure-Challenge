"""作答预览：只生成作答实体的两张轴测着色图。
用法：python 机械结构重建/工具/preview.py 答案/第01题.json [--out 目录]
不读取图纸PNG、JSON或评分文件；不输出正投影、剖视或对照图。
"""
import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from drawkit import model, shade  # noqa: E402


def answer_root(path):
    path = Path(path).resolve()
    return path.parent.parent if path.parent.name == "答案" else path.parent


def load_answer(path):
    desc = model.load(path)
    pid = model.problem_id(path, desc)
    if pid is None:
        raise model.ModelError("无法确定题号：文件名应为 第NN题.json，或在 JSON 中写 \"problem\": \"NN\"")
    return desc, pid, model.build(desc, pid)


def report(mdl):
    ok = True
    for p in mdl.parts:
        head = f"零件 {p.name}" + (f"（{p.title}）" if p.title else "")
        n = len(p.steps)
        if p.error:
            ok = False
            step = p.error["step"]
            where = f"第 {step} 个特征" if step else "零件定义"
            print(f"{head}：{where}出错——{p.error['message']}")
            print(f"    已成功生成前 {n} 个特征；预览和评分按这一步的实体计。")
        else:
            print(f"{head}：{n} 个特征全部生成。")
        for w in p.warnings:
            print("    提示：" + w)
        if p.shape is not None:
            vol = model.shape_volume(p.shape)
            box = model.shape_bbox(p.placed())
            lo, hi = box
            size = hi - lo
            nsol = model.count_solids(p.shape)
            print(f"    体积 {vol:,.1f} mm³；外形 {size[0]:.2f} × {size[1]:.2f} × {size[2]:.2f} mm"
                  f"（X {lo[0]:.2f}～{hi[0]:.2f}，Y {lo[1]:.2f}～{hi[1]:.2f}，Z {lo[2]:.2f}～{hi[2]:.2f}）"
                  + (f"；由 {nsol} 块互不相连的实体组成" if nsol > 1 else ""))
    return ok


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("answer", help="答案文件，如 答案/第01题.json")
    ap.add_argument("--out", help="输出目录（默认 作答目录/预览/第NN题）")
    args = ap.parse_args()
    try:
        desc, pid, mdl = load_answer(args.answer)
    except model.ModelError as exc:
        print(f"生成失败：{exc}")
        sys.exit(1)
    print(f"第 {pid} 题")
    report(mdl)
    out = Path(args.out) if args.out else answer_root(args.answer) / "预览" / f"第{pid}题"
    out.mkdir(parents=True, exist_ok=True)
    items = [(p.placed(), shade.PALETTE[i % len(shade.PALETTE)]) for i, p in enumerate(mdl.parts) if p.shape is not None]
    for name, (d, up) in shade.VIEWS.items():
        path = out / f"{name}.png"
        shade.render(items, d, up).save(path, optimize=True)
        print(f"已画轴测图：{path}")


if __name__ == "__main__":
    main()
