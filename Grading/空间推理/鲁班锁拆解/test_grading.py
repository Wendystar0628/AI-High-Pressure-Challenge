"""运行：python -m unittest discover -s . -p test_grading.py"""
import copy
import importlib.util
import hashlib
import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("grade_burr", HERE / "grade.py")
grader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grader)
check = grader.checker


def puzzle(points):
    return {"id": "test", "pieces": [
        {"id": chr(65+i), "position": list(p), "voxels": [[0, 0, 0]]}
        for i, p in enumerate(points)]}


def answer(moves, removed=None, remaining=None):
    return {"puzzle": "test", "plan": {
        "moves": moves, "removed": removed, "remaining": remaining}}


class JudgeTests(unittest.TestCase):
    def test_saved_reference_solutions(self):
        records = check.load(HERE / "references.json")["records"]
        self.assertEqual(len(records), 8)
        self.assertEqual([(r["id"], r["name"], r["tier"], r["weight"]) for r in records], [
            ("01", "Handshake", 1, 8), ("02", "Plusminus", 1, 8),
            ("03", "Mini Lock", 2, 12), ("04", "Ticket", 2, 12),
            ("05", "Stepping Burr", 2, 12), ("06", "Flat Four", 2, 12),
            ("07", "More Visible Moves", 3, 18), ("08", "Linear", 3, 18)])
        self.assertEqual(check.load(HERE / "references.json")["tier_basis"], "user_selected_after_model_retest")
        self.assertEqual([r["public_level"] for r in records], ["4.2.2", "6.2.2", "6.7", "8.4", "10", "11.1.3", "19.11.4.6", "20.2.5"])
        for record in records:
            # 本版按用户结合试测指定的2/4/2题组分档；公开等级作为来源元数据单列。
            level = int(record["public_level"].split(".")[0])
            self.assertEqual(record["public_level"], record["source_moves"])
            self.assertEqual(level, record["public_level_grade"])
            # 用户定基准 B 为参考解完整步数。
            self.assertEqual(record["best_moves"], record["reference_moves"])
        for record in records:
            key = record["id"]
            with self.subTest(puzzle=key):
                puzzle_path = grader.PUBLIC / f"{key}.json"
                answer_path = HERE / "标准解答" / f"第{key}题.json"
                model = check.load(puzzle_path)
                self.assertEqual(model["id"], key)
                self.assertEqual(model["tier"], record["tier"])
                self.assertEqual(len(model["pieces"]), record["piece_count"])
                self.assertEqual(hashlib.sha256(puzzle_path.read_bytes()).hexdigest(), record["input_sha256"])
                self.assertEqual(hashlib.sha256(answer_path.read_bytes()).hexdigest(), record["answer_sha256"])
                result = check.validate(model, check.load(answer_path))
                self.assertEqual(result["moves"], record["reference_moves"])
                self.assertEqual(result["first_split_moves"], record["reference_first_split"])
                self.assertEqual([s["moves"] for s in result["stages"]], record["reference_stage_moves"])
                self.assertEqual(result["separations"], record["piece_count"]-1)

    def test_swept_collision_even_when_endpoint_clear(self):
        p = puzzle([(0, 0, 0), (2, 0, 0)])
        a = answer([{"pieces": ["A"], "delta": [4, 0, 0]},
                    {"pieces": ["A"], "out": [0, 1, 0]}])
        with self.assertRaises(check.Invalid):
            check.validate(p, a)

    def test_out_checks_all_future_distance(self):
        p = puzzle([(0, 0, 0), (100000, 0, 0)])
        with self.assertRaises(check.Invalid):
            check.validate(p, answer([{"pieces": ["A"], "out": [1, 0, 0]}]))

    def test_touching_faces_and_arbitrary_valid_path(self):
        p = puzzle([(0, 0, 0), (1, 0, 0)])
        result = check.validate(p, answer([{"pieces": ["A"], "out": [0, 1, 0]}]))
        self.assertEqual(result["moves"], 1)

    def test_continuous_commands_merge_including_out(self):
        p = puzzle([(0, 0, 0), (0, 2, 0)])
        a = answer([{"pieces": ["A"], "delta": [1, 0, 0]},
                    {"pieces": ["A"], "delta": [3, 0, 0]},
                    {"pieces": ["A"], "out": [1, 0, 0]}])
        self.assertEqual(check.validate(p, a)["moves"], 1)

    def test_subassembly_branches_must_both_finish(self):
        p = puzzle([(0, 0, 0), (1, 0, 0), (2, 0, 0)])
        a = answer([{"pieces": ["A", "B"], "out": [0, 1, 0]}])
        with self.assertRaises(check.Invalid):
            check.validate(p, a)
        a["plan"]["removed"] = {
            "moves": [{"pieces": ["A"], "out": [-1, 0, 0]}],
            "removed": None, "remaining": None}
        self.assertEqual(check.validate(p, a)["moves"], 2)

    def test_foreign_piece_rotation_and_zero_displacement_rejected(self):
        p = puzzle([(0, 0, 0), (1, 0, 0)])
        for move in [{"pieces": ["X"], "out": [0, 1, 0]},
                     {"pieces": ["A"], "delta": [0, 0, 0]},
                     {"pieces": ["A"], "delta": [1, 1, 0]},
                     {"pieces": ["A", "A"], "out": [-1, 0, 0]},
                     {"pieces": ["A", "B"], "out": [0, 1, 0]}]:
            with self.subTest(move=move), self.assertRaises(check.Invalid):
                check.validate(p, answer([move]))

    def test_fixed_baseline_caps_at_full_marks(self):
        original_load = check.load
        record = original_load(HERE / "references.json")
        # 按题名定位 Stepping Burr，保留先移后退的绕路样例；本版编号为05。
        target_index = next(i for i, item in enumerate(record["records"]) if item["name"] == "Stepping Burr")
        target = record["records"][target_index]
        target["best_moves"] = target["reference_moves"] + 10
        def load(path):
            return copy.deepcopy(record) if Path(path) == HERE / "references.json" else original_load(path)
        with tempfile.TemporaryDirectory() as folder:
            roots = [Path(folder) / name for name in ("shorter", "longer")]
            for root in roots:
                (root / "答案").mkdir(parents=True)
                for source in (HERE / "标准解答").glob("*.json"):
                    (root / "答案" / source.name).write_bytes(source.read_bytes())
            path = roots[1] / "答案" / f"第{target['id']}题.json"
            longer = original_load(path)
            first = copy.deepcopy(longer["plan"]["moves"][0])
            if "out" in first:
                first["delta"] = first.pop("out")
            undo = copy.deepcopy(first)
            undo["delta"] = [-x for x in undo["delta"]]
            longer["plan"]["moves"] = [first, undo] + longer["plan"]["moves"]
            import json
            path.write_text(json.dumps(longer), encoding="utf-8")
            with patch.object(check, "load", side_effect=load):
                result = grader.grade(roots)
            one, two = result["results"]
            # 少于基准步数也只得满分；基准不随提交改变
            self.assertEqual(one["items"][target_index]["score"], round(one["items"][target_index]["weight"], 2))
            self.assertEqual(result["baselines"][target["id"]], target["best_moves"])
            self.assertEqual(one["items"][target_index]["baseline_moves"], two["items"][target_index]["baseline_moves"])

    def test_missing_answers_do_not_read_reference_directory(self):
        result = grader.grade([HERE])
        self.assertEqual(result["results"][0]["total"], 0)
        self.assertTrue(all(not item["valid"] for item in result["results"][0]["items"]))


if __name__ == "__main__":
    unittest.main()
