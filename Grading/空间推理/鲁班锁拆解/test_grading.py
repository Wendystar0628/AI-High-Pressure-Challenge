"""运行：python -m unittest discover -s . -p test_grading.py"""
import copy
import importlib.util
import hashlib
import json
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


def reference(key):
    return check.load(HERE / "标准解答" / f"第{key}题.json")


def truncate(plan, keep):
    """保留前 keep 次分离：按深度优先顺序把其后的拆解节点都改成 null（未拆开）。"""
    count = 0

    def cut(node):
        nonlocal count
        if not isinstance(node, dict):
            return node
        if count == keep:
            return None
        count += 1
        node["removed"] = cut(node["removed"])
        node["remaining"] = cut(node["remaining"])
        return node

    return cut(plan)


def grade_one(key, content):
    """把一份答案（对象或原始文本）放进临时作答目录评分，返回该题分项。"""
    with tempfile.TemporaryDirectory() as folder:
        (Path(folder) / "答案").mkdir()
        text = content if isinstance(content, str) else json.dumps(content)
        (Path(folder) / "答案" / f"第{key}题.json").write_text(text, encoding="utf-8")
        result = grader.grade([folder])
    return next(item for item in result["results"][0]["items"] if item["id"] == key)


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


class PartialCreditTests(unittest.TestCase):
    """完整拆开有 60% 保底；没拆完按参考解阶段步数线性计部分分，最高 50%。"""

    def test_complete_references_score_full(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "答案").mkdir()
            for source in (HERE / "标准解答").glob("*.json"):
                (Path(folder) / "答案" / source.name).write_bytes(source.read_bytes())
            result = grader.grade([folder])
        self.assertEqual(result["results"][0]["total"], 100)
        self.assertTrue(all(item["valid"] for item in result["results"][0]["items"]))

    def test_long_complete_route_keeps_floor(self):
        self.assertLess(grader.PARTIAL_SHARE, grader.FULL_FLOOR)
        for detours, moves, score in [(1, 10, 6.4), (2, 12, 5.33), (10, 28, 4.8)]:
            with self.subTest(detours=detours):
                route = reference("01")
                first = route["plan"]["moves"][0]
                undo = dict(first, delta=[-x for x in first["delta"]])
                route["plan"]["moves"] = [first, undo] * detours + route["plan"]["moves"]
                item = grade_one("01", route)
                self.assertTrue(item["valid"])
                self.assertEqual(item["moves"], moves)
                self.assertEqual(item["score"], score)

    def test_partial_separations_follow_reference_stages(self):
        route = reference("07")
        route["plan"] = truncate(route["plan"], 1)
        item = grade_one("07", route)
        self.assertFalse(item["valid"])
        self.assertEqual(item["separations"], 1)
        self.assertEqual(item["partial_ratio"], round(19 / 42, 4))
        self.assertEqual(item["score"], round(18 * 0.5 * 19 / 42, 2))
        self.assertIn("未拆开", item["reason"])

    def test_each_separation_adds_credit_up_to_half(self):
        # 07 参考分段 19+12+5+6：每多完成一次分离都加分
        for keep, done in ((2, 31), (3, 36)):
            with self.subTest(keep=keep):
                route = reference("07")
                route["plan"] = truncate(route["plan"], keep)
                item = grade_one("07", route)
                self.assertEqual(item["separations"], keep)
                self.assertEqual(item["score"], round(18 * 0.5 * done / 42, 2))
        # 首拆完成后单件分支写错记号：只计首拆
        route = reference("07")
        route["plan"]["removed"] = {"moves": []}
        item = grade_one("07", route)
        self.assertFalse(item["valid"])
        self.assertEqual(item["separations"], 1)
        # 全部分离都已完成、只在单件分支写错记号，仍按没拆完计，正好 50%
        route = reference("07")
        route["plan"]["remaining"]["remaining"]["remaining"]["removed"] = {"moves": []}
        item = grade_one("07", route)
        self.assertEqual(item["separations"], 4)
        self.assertEqual(item["score"], 9)

    def test_first_move_collision_scores_zero(self):
        route = reference("01")
        route["plan"]["moves"][0] = {"pieces": ["C"], "delta": [1, 0, 0]}
        item = grade_one("01", route)
        self.assertEqual(item["separations"], 0)
        self.assertEqual(item["score"], 0)
        self.assertIn("碰撞", item["reason"])

    def test_broken_routes_count_only_finished_separations(self):
        # 第二阶段写到一半，没有 out
        route = reference("07")
        route["plan"]["remaining"]["moves"] = route["plan"]["remaining"]["moves"][:3]
        route["plan"]["remaining"]["removed"] = route["plan"]["remaining"]["remaining"] = None
        self.assertEqual(grade_one("07", route)["separations"], 1)
        # 第二阶段中途碰撞：此前完成的分离照计，后面的不再检查
        route = reference("07")
        route["plan"]["remaining"]["moves"].insert(0, {"pieces": ["A"], "delta": [0, 0, 100]})
        item = grade_one("07", route)
        self.assertEqual(item["separations"], 1)
        self.assertIn("plan.remaining.moves[0]", item["reason"])
        # 记号错误：两轴同时移动
        route = reference("07")
        route["plan"]["remaining"]["moves"][0]["delta"] = [1, 1, 0]
        self.assertEqual(grade_one("07", route)["separations"], 1)
        # 文件写断、无法解析：0 分
        text = (HERE / "标准解答" / "第07题.json").read_text(encoding="utf-8")
        item = grade_one("07", text[:len(text) // 2])
        self.assertEqual((item["separations"], item["score"]), (0, 0))

    def test_depth_first_order_stops_at_first_unfinished_branch(self):
        p = puzzle([(0, 0, 0), (1, 0, 0), (2, 0, 0), (3, 0, 0)])
        left = {"moves": [{"pieces": ["A"], "out": [-1, 0, 0]}], "removed": None, "remaining": None}
        right = {"moves": [{"pieces": ["D"], "out": [1, 0, 0]}], "removed": None, "remaining": None}
        split = [{"pieces": ["A", "B"], "out": [0, 1, 0]}]
        self.assertTrue(check.progress(p, answer(split, left, right))["valid"])
        # removed 分支没拆完时停在那里，remaining 分支不再计入
        result = check.progress(p, answer(split, None, right))
        self.assertEqual((result["valid"], result["separations"]), (False, 1))
        self.assertIn("plan.removed", result["reason"])
        result = check.progress(p, answer(split, left, None))
        self.assertEqual((result["valid"], result["separations"]), (False, 2))
        with self.assertRaises(check.Invalid):
            check.validate(p, answer(split, left, None))


if __name__ == "__main__":
    unittest.main()
