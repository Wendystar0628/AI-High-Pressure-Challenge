"""评一个或多个作答目录；不执行受测模型提交的程序。

完整拆开：w × max(0.6, min(1, B / N))，B 为固定基准步数 best_moves，N 为总步数。
没拆完：从初态起按 check.py 的深度优先顺序逐步检查，到第一处碰撞、记号错误或没拆完的
分支为止，合法完成了 k 次分离，得 w × 0.5 × S_k / S_total；S 为参考解按同一顺序的
各阶段步数 reference_stage_moves，S_k 为前 k 个阶段之和。每完成一次分离都加分，最高 50%。
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[2] / "空间推理" / "鲁班锁拆解"
spec = importlib.util.spec_from_file_location("trusted_burr_check", HERE / "check.py")
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)

FULL_FLOOR = 0.6   # 完整拆开的保底比例
PARTIAL_SHARE = 0.5  # 没拆完时按完成阶段线性计分的比例，最高 50%


def grade(directories):
    records = checker.load(HERE / "references.json")["records"]
    puzzles = {}
    for record in records:
        path = PUBLIC / (record["id"] + ".json")
        if hashlib.sha256(path.read_bytes()).hexdigest() != record["input_sha256"]:
            raise ValueError(f"出题端第 {record['id']} 题结构与参考记录不一致")
        puzzles[record["id"]] = checker.load(path)
    results = []
    baselines = {r["id"]: r["best_moves"] for r in records}  # 已知最优步数，固定不变
    stage_moves = {r["id"]: r["reference_stage_moves"] for r in records}
    for directory in directories:
        model = {"directory": str(Path(directory).resolve()), "items": []}
        for record in records:
            key = record["id"]
            answer = Path(directory) / "答案" / f"第{key}题.json"
            item = {"id": key, "weight": record["weight"]}
            try:
                report = checker.progress(puzzles[key], checker.load(answer))
            except (OSError, ValueError, KeyError, TypeError) as exc:  # 缺失或无法解析
                report = {"valid": False, "reason": str(exc), "separations": 0}
            item.update({k: v for k, v in report.items() if k not in ("stages", "puzzle")})
            model["items"].append(item)
        results.append(model)
    for model in results:
        unrounded_total = 0
        for item in model["items"]:
            baseline = baselines[item["id"]]
            item["baseline_moves"] = baseline
            if item["valid"]:
                raw_score = item["weight"] * max(FULL_FLOOR, min(1, baseline / item["moves"]))
            else:
                stages = stage_moves[item["id"]]
                ratio = sum(stages[:item["separations"]]) / sum(stages)
                item["partial_ratio"] = round(ratio, 4)
                raw_score = item["weight"] * PARTIAL_SHARE * ratio
            item["score"] = round(raw_score, 2)
            unrounded_total += raw_score
        model["total"] = round(unrounded_total, 2)
    return {"baselines": baselines, "stage_moves": stage_moves, "results": results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directories", nargs="+", help="一个或多个题目工作目录")
    parser.add_argument("--output", type=Path, help="评分 JSON 输出位置")
    args = parser.parse_args()
    result = grade(args.directories)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
