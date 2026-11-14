"""读取一题的图纸 JSON，并按其中的视图定义重新投影任意一组实体（作答预览、比对用）。"""
import json
import re
from pathlib import Path

from . import project
from .model import compound


def problem_sheets(drawing_dir, pid):
    """第 pid 题的全部图纸 JSON（NN.json 或 NN-1.json、NN-2.json …），按张次排序。"""
    drawing_dir = Path(drawing_dir)
    found = []
    for p in drawing_dir.glob(f"{pid}*.json"):
        if re.fullmatch(rf"{re.escape(pid)}(-\d+)?", p.stem):
            found.append(p)
    sheets = [json.loads(p.read_text(encoding="utf-8-sig")) for p in found]
    sheets.sort(key=lambda s: s.get("sheet_index", 1))
    for sheet in sheets:
        if sheet.get("version", 1) >= 2:
            prepare_preview(sheet)
    return sheets


def sheet_shapes(mdl, sheet, kind=None):
    """按图纸的坐标系取作答实体：零件图用零件自身坐标，装配图用装配坐标。

    单件题（kind="part" 或作答只有一个零件）的零件图：作答各零件合在一起当作该零件。"""
    if sheet.get("frame") == "assembly":
        return {p.name: p.placed() for p in mdl.parts if p.shape is not None}
    name = sheet.get("part") or "1"
    part = mdl.part(name)
    if part is not None and part.shape is not None and kind != "part":
        return {name: part.shape}
    shapes = [p.shape for p in mdl.parts if p.shape is not None]
    if kind == "part" or len(mdl.parts) == 1 or part is None:
        if not shapes:
            return {}
        return {name: shapes[0] if len(shapes) == 1 else compound(shapes)}
    return {name: part.shape} if part is not None and part.shape is not None else {}


def reproject(sheet, shapes, cache=None):
    """{视图名: 投影结果}；视图定义里的零件名映射到 shapes 中现有的零件。"""
    out = {}
    views = sheet["views"]
    for v in views:
        d = v["definition"]
        if d.get("kind") == "detail":
            continue
        dd = dict(d)
        dd["parts"] = [n for n in (d.get("parts") or list(shapes)) if n in shapes]
        if sheet.get("frame") != "assembly":
            dd["parts"] = list(shapes)
        key = (json.dumps(dd, sort_keys=True), tuple((n, id(shapes[n])) for n in dd["parts"]))
        if cache is not None and key in cache:
            out[v["name"]] = cache[key][0]
        else:
            out[v["name"]] = project.project_view(shapes, dd) if dd["parts"] else empty()
            if cache is not None:
                # 保持输入实体的强引用，避免对象回收后id复用；缓存只活在本次预览进程中。
                cache[key] = (out[v["name"]], tuple(shapes[n] for n in dd["parts"]))
    for v in views:
        d = v["definition"]
        if d.get("kind") != "detail":
            continue
        parent = out.get(d["detail"]["parent"]) or empty()
        out[v["name"]] = project.project_view(shapes, d, parent=parent) if parent["_shapes"] else empty()
    return out


def empty():
    return {"lines": [], "hatches": [], "_shapes": []}


def hatch_styles(sheet):
    """沿用图纸上各零件的剖面线角度和间距。"""
    styles = {}
    for i, row in enumerate(sheet.get("parts_list", [])):
        styles[str(row["no"])] = (45 if i % 2 == 0 else 135, 3.0 if i % 4 < 2 else 2.2)
    for v in sheet["views"]:
        for h in v.get("hatches", []):
            styles.setdefault(h["part"], (h.get("angle", 45), h.get("spacing", 3.0)))
    return styles


def styled_hatches(geom, styles):
    out = []
    for h in geom["hatches"]:
        ang, sp = styles.get(h["part"], (45, 3.0))
        hh = dict(h, angle=ang, spacing=sp)
        out.append(hh)
    return out


def prepare_preview(sheet):
    """只从允许的元数据构造预览版面；不读取参考轮廓、尺寸位置或评分端。"""
    from . import geom2d as g2
    w, h = sheet["paper"]["width"], sheet["paper"]["height"]
    sheet["sheet_marks"] = [
        {"kind": "curve", "curve": g2.polyline([[5,5],[w-5,5],[w-5,h-5],[5,h-5],[5,5]], "frame")},
        {"kind": "text", "text": sheet["title"] + " · 作答预览 · " + sheet["sheet"], "at": [w/2, 12], "height": 4},
    ]
    for view in sheet["views"]:
        view.update(lines=[], hatches=[], dimensions=[], annotations=[])
        s = view["placement"]["scale"]
        view["annotations"].append({"kind": "text", "text": view["name"], "at": [0, -18/s], "height": 4, "role":"label"})
        d = view["definition"]
        if d.get("kind") == "detail":
            continue
        view["annotations"].append({"kind": "text", "text": "O", "at": [-3/s,-3/s], "height": 3})
        for axis, vec in zip("XYZ", ([1,0,0], [0,1,0], [0,0,1])):
            import numpy as np
            a = np.array([np.dot(vec,d["u"]),np.dot(vec,d["v"])])
            if np.linalg.norm(a) < 0.99:
                continue
            tip = a*10/s
            view["annotations"] += [
                {"kind":"curve", "curve":g2.line([0,0], tip.tolist(), "thin"), "role":"origin"},
                {"kind":"arrow", "tip":tip.tolist(), "dir":a.tolist(), "size":2, "role":"origin"},
                {"kind":"text", "text":axis, "at":(a*14/s).tolist(), "height":3, "role":"origin"},
            ]
