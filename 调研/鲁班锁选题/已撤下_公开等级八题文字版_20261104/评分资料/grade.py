"""按固定基准步数评一个或多个作答目录；不执行受测模型提交的程序。"""
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
    for directory in directories:
        model = {"directory": str(Path(directory).resolve()), "items": []}
        for record in records:
            key = record["id"]
            answer = Path(directory) / "答案" / f"第{key}题.json"
            item = {"id": key, "weight": record["weight"]}
            try:
                report = checker.validate(puzzles[key], checker.load(answer))
                item.update({k: v for k, v in report.items() if k not in ("stages", "puzzle")})
            except (checker.Invalid, OSError, ValueError, KeyError, TypeError) as exc:
                item.update(valid=False, reason=str(exc))
            model["items"].append(item)
        results.append(model)
    for model in results:
        unrounded_total = 0
        for item in model["items"]:
            baseline = baselines[item["id"]]
            item["baseline_moves"] = baseline
            raw_score = item["weight"] * min(1, baseline / item["moves"]) if item["valid"] else 0
            item["score"] = round(raw_score, 2)
            unrounded_total += raw_score
        model["total"] = round(unrounded_total, 2)
    return {"baselines": baselines, "results": results}


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
