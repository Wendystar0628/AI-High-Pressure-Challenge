"""机械图纸评分及回放回归测试；实验文件仅在调研目录临时创建。"""
import copy
import json
import struct
import sys
import tempfile
import time
import unittest
from pathlib import Path

import numpy as np

import grade
import replay_data as replay

HERE = Path(__file__).resolve().parent
EXPERIMENT = HERE.parents[2] / "调研" / "机械结构重建" / "实验"


def extrusion(box, depth, **kw):
    return dict(type="extrude", loops=[{"rect": box}], depth=depth, **kw)


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return path


def glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data)
    assert (magic, version, length) == (0x46546C67, 2, len(data)), "GLB 文件头无效"
    size, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A, "GLB 缺少 JSON 块"
    return json.loads(data[20:20 + size])


class GradingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        EXPERIMENT.mkdir(parents=True, exist_ok=True)
        cls.tmp = tempfile.TemporaryDirectory(prefix="后端回归-", dir=EXPERIMENT)
        cls.root = Path(cls.tmp.name)
        cls.cfg = grade.load_config()
        cls.part = {"parts": [{"name": "1", "title": "测试台阶", "features": [
            extrusion([0, 0, 24, 12], 5, name="底板"),
            extrusion([3, 2, 9, 8], 8, origin=[0, 0, 5], name="凸台")]}]}
        cls.assembly = {"parts": [{"name": str(i + 1), "title": "测试零件",
            "placement": {"translate": [i * 32, 0, 0]},
            "features": [extrusion([0, 0, 12 + i, 6 + i], 4 + i)]} for i in range(5)]}
        cls.records = []
        cls.refs = {}
        for pid, desc, kind in (("S1", cls.part, "part"), ("A1", cls.assembly, "assembly")):
            path = save(cls.root / f"参考-{pid}.json", desc)
            r = dict(id=pid, tier="测试档", name="回归测试件", kind=kind, max=10,
                     parts=[p["name"] for p in desc["parts"]], reference=str(path))
            cls.records.append(r)
            cls.refs[pid] = grade.reference_surfaces(r, cls.cfg)
        cls.cfg["records"] = cls.records

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def score(self, desc, assembly=False):
        r = self.records[int(assembly)]
        path = save(self.root / "作答.json", desc)
        return grade.grade_problem(r, self.refs[r["id"]], path, self.cfg)

    def test_reference(self):
        """单件与五件装配参考自评满分"""
        for desc, asm in ((self.part, False), (self.assembly, True)):
            item = self.score(desc, asm)
            self.assertEqual(item["score"], 10)
            self.assertEqual(item["fscore"], 1)

    def test_missing_and_bad_json(self):
        """缺文件、坏JSON及非UTF-8文件均为零分并有中文原因"""
        r = self.records[0]
        for content, status in ((None, "missing"), (b'{"parts":', "invalid"), (b'\xff', "invalid")):
            path = self.root / f"错误-{status}-{content is None}.json"
            if content is not None:
                path.write_bytes(content)
            item = grade.grade_problem(r, self.refs["S1"], path, self.cfg)
            self.assertEqual(item["score"], 0)
            self.assertEqual(item["status"], status)
            self.assertIn("0 分", item["reason"])

    def test_failed_feature(self):
        """第k步失败严格按第k−1步实体计分和回放"""
        before = copy.deepcopy(self.part)
        broken = copy.deepcopy(before)
        broken["parts"][0]["features"] += [extrusion([0, 0, 2, 2], 0), extrusion([0, 0, 50, 50], 50)]
        a, b = self.score(before), self.score(broken)
        self.assertEqual(a["score"], b["score"])
        self.assertEqual(b["status"], "partial")
        self.assertEqual(b["errors"][0]["step"], 3)
        self.assertEqual(b["errors"][0]["part"], "1")
        out = self.root / "回放失败"
        entry = replay.export_problem(self.records[0], self.cfg, save(self.root / "失败.json", broken), out, {})
        self.assertEqual(entry["status"], "invalid")
        self.assertEqual(entry["error"]["step"], 3)
        self.assertEqual(len(entry["parts"][0]["steps"]), 2)
        self.assertEqual(entry["compare"]["fscore"], b["fscore"])

    def test_translation(self):
        """整体平移允许满分且找回同一反向平移"""
        delta = np.array([7., -4., 9.])
        for desc, asm in ((self.part, False), (self.assembly, True)):
            shifted = copy.deepcopy(desc)
            for p in shifted["parts"]:
                old = p.setdefault("placement", {}).get("translate", [0, 0, 0])
                p["placement"]["translate"] = (np.array(old) + delta).tolist()
            item = self.score(shifted, asm)
            self.assertEqual(item["score"], 10)
            np.testing.assert_allclose(item["translation"], -delta, atol=0.15)

    def test_missing_assembly_part(self):
        """装配缺件只损失该件的参考面，准确率仍为一"""
        desc = copy.deepcopy(self.assembly)
        desc["parts"].pop()
        item = self.score(desc, True)
        self.assertEqual(item["precision"], 1)
        self.assertEqual(item["recall"], 0.8)
        expected = grade.fscore(1, .8)
        self.assertAlmostEqual(item["fscore"], expected, places=4)
        self.assertEqual(item["parts"][-1]["fscore"], 0)
        self.assertAlmostEqual(item["score"], round(10 * expected / self.cfg['full_credit_f'], 2))

    def test_small_hole(self):
        """大板漏掉小孔会损失一个参考面并明显扣分"""
        desc = {"parts": [{"name": "1", "features": [extrusion([0, 0, 100, 100], 10),
            {"type": "hole", "origin": [0, 0, 10], "at": [50, 50], "d": 2, "through": True}]}]}
        r = dict(self.records[0], reference=str(save(self.root / "小孔参考.json", desc)))
        refs = grade.reference_surfaces(r, self.cfg)
        desc["parts"][0]["features"].pop()
        item = grade.grade_problem(r, refs, save(self.root / "漏孔.json", desc), self.cfg)
        self.assertEqual(refs["1"].face_count, 7)
        self.assertTrue(all(len(points) >= 256 for points in refs["1"].face_samples))
        self.assertGreater(item["precision"], .99)
        self.assertLess(item["recall"], .88)
        self.assertLess(item["score"], 9.5)

    def test_missing_small_pin(self):
        """复杂主体加小销，缺销仅扣小销的三张参考面"""
        main = copy.deepcopy(self.part["parts"][0])
        for x in (4, 12, 20):
            main["features"].append({"type": "hole", "origin": [0, 0, 5], "at": [x, 10], "d": 1, "through": True})
        pin = {"name": "2", "placement": {"translate": [40, 0, 0]},
               "features": [{"type": "extrude", "loops": [{"circle": [0, 0], "d": 2}], "depth": 4}]}
        desc = {"parts": [main, pin]}
        r = dict(self.records[1], reference=str(save(self.root / "小销参考.json", desc)))
        refs = grade.reference_surfaces(r, self.cfg)
        self.assertEqual(refs["2"].face_count, 3)
        desc["parts"].pop()
        item = grade.grade_problem(r, refs, save(self.root / "缺销.json", desc), self.cfg)
        expected_r = refs["1"].face_count / sum(ref.face_count for ref in refs.values())
        self.assertAlmostEqual(item["recall"], expected_r, places=4)
        self.assertEqual(item["precision"], 1)
        self.assertAlmostEqual(item["fscore"], grade.fscore(1, expected_r), places=4)
        entry = replay.export_problem(r, self.cfg, self.root / "缺销.json", self.root / "缺销回放", {})
        for key in ("precision", "recall", "fscore", "translation"):
            self.assertEqual(entry["compare"][key], item[key])

    def test_merge_split_faces(self):
        """缝线或布尔分割产生的相连同平面和同圆柱片段合并"""
        from OCP.BRepAlgoAPI import BRepAlgoAPI_Fuse
        from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder
        from OCP.gp import gp_Pnt
        # 不经 model.clean，直接制造有分割边的同域面。
        box = BRepAlgoAPI_Fuse(BRepPrimAPI_MakeBox(10, 10, 5).Shape(),
                              BRepPrimAPI_MakeBox(gp_Pnt(0, 0, 5), 10, 10, 5).Shape()).Shape()
        self.assertEqual(grade.Surface(box, 3, self.cfg, reference=True).face_count, 6)
        disjoint = grade.model.compound([BRepPrimAPI_MakeBox(10, 10, 5).Shape(),
            BRepPrimAPI_MakeBox(gp_Pnt(30, 0, 0), 10, 10, 5).Shape()])
        self.assertEqual(grade.Surface(disjoint, 5, self.cfg, reference=True).face_count, 12)
        from OCP.gp import gp_Ax2, gp_Dir
        cyl = BRepAlgoAPI_Fuse(BRepPrimAPI_MakeCylinder(5, 5).Shape(),
            BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(0, 0, 5), gp_Dir(0, 0, 1)), 5, 5).Shape()).Shape()
        self.assertEqual(grade.Surface(cyl, 4, self.cfg, reference=True).face_count, 3)

    def test_misplaced_assembly_part(self):
        """单独错位的装配零件不能各自平移修复"""
        desc = copy.deepcopy(self.assembly)
        desc["parts"][-1]["placement"]["translate"][2] += 20
        item = self.score(desc, True)
        self.assertLess(item["score"], 10)
        self.assertLess(item["parts"][-1]["fscore"], .5)
        self.assertGreater(item["parts"][0]["fscore"], .98)

    def test_rotation_error(self):
        """旋转错误不能通过只平移对齐恢复满分"""
        desc = copy.deepcopy(self.part)
        desc["parts"][0]["placement"] = {"rotate": [{"axis": "Z", "angle": 90}]}
        self.assertLess(self.score(desc)["score"], 9)

    def test_multiple_directories(self):
        """多个作答目录及鲁班锁风格结果结构"""
        dirs = [self.root / "提交甲", self.root / "提交乙"]
        save(dirs[0] / "答案" / "第S1题.json", self.part)
        result = grade.grade(dirs, self.cfg, only={"S1"})["results"]
        self.assertEqual([r["total"] for r in result], [10, 0])
        self.assertEqual(result[0]["items"][0]["name"], "第S1题")
        self.assertEqual(result[0]["items"][0]["max"], 10)

    def test_replay_contract(self):
        """回放坐标、材料差、空GLB、爆炸距离与缺答约定"""
        out = self.root / "回放"
        r = self.records[1]
        entry = replay.export_problem(r, self.cfg, r["reference"], out, {})
        self.assertEqual(entry["compare"]["fscore"], 1)
        self.assertEqual(entry["status"], "ok")
        self.assertNotIn("score", entry)
        self.assertEqual(len(entry["parts"]), 5)
        np.testing.assert_equal(entry["parts"][1]["placement"][12:15], [32, 0, 0])
        self.assertGreater(np.linalg.norm(entry["parts"][2]["explode"]), 30)
        for p in entry["parts"]:
            self.assertIn("meshes", glb(out / p["final"]))
            self.assertEqual(p["steps"][0]["axis"], [0, 0, 1])
        for key in ("extra", "missing"):
            self.assertNotIn("meshes", glb(out / entry["compare"][key]))
        missing = replay.export_problem(r, self.cfg, self.root / "不存在.json", out, {})
        self.assertEqual(missing["status"], "missing")
        self.assertEqual(missing["parts"], [])
        self.assertIsNone(missing["compare"])
        # 第二次加料与底板重叠，工具应只包含新加材料。
        desc = copy.deepcopy(self.part)
        desc["parts"][0]["features"][1]["origin"] = [0, 0, 2]
        mdl = grade.model.build(desc)
        p = mdl.parts[0]
        tool = replay.step_tool(p.steps[1], p.steps[0].result)
        self.assertAlmostEqual(grade.model.shape_volume(tool),
                               grade.model.shape_volume(p.shape) - grade.model.shape_volume(p.steps[0].result), places=5)
        # 完全包含在已有实体内的加料是空工具，仍可导出合法空场景。
        desc["parts"][0]["features"].append(extrusion([1, 1, 2, 2], 1))
        p = grade.model.build(desc).parts[0]
        self.assertIsNone(p.error)
        empty = replay.step_tool(p.steps[2], p.steps[1].result)
        replay.shape_glb(self.root / "空工具.glb", empty)
        self.assertNotIn("meshes", glb(self.root / "空工具.glb"))

    def test_original_fixtures(self):
        """交接测试件T1、T2、T3参考自评满分"""
        cfg = grade.load_config(HERE / "测试件" / "references.json")
        result = grade.grade(["参考"], cfg, answer_path=lambda _, pid:
                             HERE / next(r["reference"] for r in cfg["records"] if r["id"] == pid))
        self.assertEqual(result["results"][0]["total"], 28)
        self.assertTrue(all(i["fscore"] == 1 for i in result["results"][0]["items"]))

    def test_all_twenty_five_references(self):
        """正式25题参考自评100分且各题满分"""
        cfg = grade.load_config()
        self.assertEqual([r['max'] for r in cfg['records']], [3.5]*8+[4]*7+[4.4]*10)
        absent = [r["id"] for r in cfg["records"] if not (HERE / r["reference"]).exists()]
        if absent:
            self.skipTest("正式参考尚未齐全：" + "、".join(absent))
        self.assertEqual(len(cfg["records"]), 25)
        self.assertAlmostEqual(sum(r["max"] for r in cfg["records"]), 100)
        start = time.perf_counter()
        result = grade.grade(["参考"], cfg, answer_path=lambda _, pid:
                             HERE / next(r["reference"] for r in cfg["records"] if r["id"] == pid))
        for i in result["results"][0]["items"]:
            self.assertEqual(i["status"], "ok", i["name"])
            self.assertEqual(i["fscore"], 1, i["name"])
            self.assertEqual(i["score"], i["max"], i["name"])
        self.assertEqual(result["results"][0]["total"], 100)
        elapsed = time.perf_counter() - start
        save(EXPERIMENT / "按面-正式25题参考自评.json", dict(result, elapsed_seconds=elapsed))
        print(f"  正式25题参考自评用时 {elapsed:.2f} 秒", flush=True)

    def test_dual_tolerance_uses_strict_alignment_and_weighted_fs(self):
        """宽容差复用窄容差平移，合成F而非合成P/R或按零件平均"""
        from types import SimpleNamespace
        from unittest.mock import patch
        pairs=[(SimpleNamespace(area=100),SimpleNamespace(face_count=6)),
               (SimpleNamespace(area=10),SimpleNamespace(face_count=24))]
        strict=[(.9,.5,grade.fscore(.9,.5)),(.4,.7,grade.fscore(.4,.7))]
        wide=[(1,.8,grade.fscore(1,.8)),(.8,1,grade.fscore(.8,1))]
        t=np.array([.7,-1.2,3.4])
        with patch.object(grade,'align_and_score',return_value=(t,strict)) as align, patch.object(grade,'evaluate',return_value=wide) as evaluate:
            d=grade.score_dual(pairs,.2,{'wide_tolerance_mm':2,'strict_f_weight':.8})
        align.assert_called_once_with(pairs,.2)
        self.assertEqual(evaluate.call_count,1)
        self.assertIs(evaluate.call_args.args[1],t)
        self.assertEqual(evaluate.call_args.args[2],2)
        a=grade.aggregate(pairs,strict)[2];b=grade.aggregate(pairs,wide)[2]
        self.assertAlmostEqual(d['fscore'],.8*a+.2*b)
        self.assertGreater(abs(d['fscore']-(a+b)/2),.01)

    def test_two_mm_band_accepts_small_hole_location_error(self):
        """局部孔偏1mm时宽档改善，窄档仍扣分；仍按面等权"""
        desc=lambda x:{'parts':[{'features':[extrusion([0,0,100,60],20),{'type':'hole','plane':'XY','origin':[0,0,20],'at':[x,30],'d':10,'depth':20}]}]}
        ref=grade.model.build(desc(30)).parts[0].shape
        ans=grade.model.build(desc(31)).parts[0].shape
        pairs=[(grade.Surface(ans,32,self.cfg),grade.Surface(ref,31,self.cfg,reference=True))]
        d=grade.score_dual(pairs,.2,self.cfg)
        self.assertLess(d['strict_total'][2],.99)
        self.assertGreater(d['wide_total'][2],.999)
        self.assertGreater(d['fscore'],d['strict_total'][2])
        self.assertAlmostEqual(d['fscore'],.8*d['strict_total'][2]+.2*d['wide_total'][2])

    def test_edge_finishes_and_partial_failure(self):
        """三维倒圆、倒角为有效曲面；选棱歧义时保留上一步实体"""
        m=grade.model
        desc={"parts":[{"name":"1","features":[extrusion([0,0,40,30],20),
            {"type":"fillet","radius":3,"edges":[[0,0,10]]},
            {"type":"chamfer","distance":2,"edges":[[20,0,0]]}]}]}
        built=m.build(desc).parts[0]
        self.assertIsNone(built.error)
        self.assertEqual(m.count_solids(built.shape),1)
        self.assertLess(m.shape_volume(built.shape),24000)
        import replay_data
        with tempfile.TemporaryDirectory() as tmp:
            steps, final = replay_data.export_part(built, 'p1', Path(tmp), '01')
            self.assertEqual([st['type'] for st in steps], ['extrude', 'fillet', 'chamfer'])
            self.assertEqual([st.get('transition') for st in steps], [None, 'finish', 'finish'])
            for st in steps:
                self.assertGreater((Path(tmp)/Path(st['tool']).name).stat().st_size, 100)
            self.assertTrue((Path(tmp)/Path(final).name).exists())

        cfg=self.cfg
        ref=grade.Surface(built.shape,1,cfg,reference=True)
        same=grade.Surface(built.shape,2,cfg)
        self.assertEqual(grade.evaluate([(same,ref)],np.zeros(3),.2)[0],(1,1,1))
        plain=m.build({"parts":[{"features":[extrusion([0,0,40,30],20)]}]}).parts[0]
        raw=grade.Surface(plain.shape,3,cfg)
        self.assertLess(grade.evaluate([(raw,ref)],np.zeros(3),.2)[0][2],.98)
        desc['parts'][0]['features'].append({'type':'fillet','radius':2,'edges':[[40,30,20]]})
        partial=m.build(desc).parts[0]
        self.assertEqual(partial.error['step'],4)
        self.assertEqual(len(partial.steps),3)
        self.assertAlmostEqual(m.shape_volume(partial.shape),m.shape_volume(built.shape),places=5)

    def test_oblique_hole_and_root_blend(self):
        """任意平面的斜孔和环面过渡可采样评分，不退化为正交孔"""
        m=grade.model
        import math
        desc={'parts':[{'features':[extrusion([0,0,60,50],40),
            {'type':'hole','plane':{'origin':[20,25,40],'normal':[.5,0,math.sqrt(.75)],'x_dir':[math.sqrt(.75),0,-.5]},'at':[0,0],'d':10,'depth':35}]}]}
        part=m.build(desc).parts[0]
        self.assertIsNone(part.error)
        self.assertLess(m.shape_volume(part.shape),120000)
        ref=grade.Surface(part.shape,4,self.cfg,reference=True)
        ans=grade.Surface(part.shape,5,self.cfg)
        self.assertEqual(grade.evaluate([(ans,ref)],np.zeros(3),.2)[0][2],1)


class ChineseResult(unittest.TestResult):
    def startTest(self, test):
        super().startTest(test)
        print("正在验证：" + (test.shortDescription() or str(test)), flush=True)

    def addSuccess(self, test):
        super().addSuccess(test)
        print("  通过", flush=True)

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        print("  跳过：" + reason, flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(GradingTests)
    result = ChineseResult()
    suite.run(result)
    for test, error in result.failures + result.errors:
        print("失败：" + (test.shortDescription() or str(test)) + "\n" + error)
    print(f"验证结束：共 {result.testsRun} 项，失败 {len(result.failures)} 项，异常 {len(result.errors)} 项，跳过 {len(result.skipped)} 项。")
    sys.exit(0 if result.wasSuccessful() else 1)
