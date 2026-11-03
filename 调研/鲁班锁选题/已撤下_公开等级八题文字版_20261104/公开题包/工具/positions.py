"""位置记账工具：把移动记录逐条累加，输出各零件当前的位置。

只做加法，不检查碰撞，不判断哪一步能走、能否移出。
用法（在作答目录运行）：
  python 题目/工具/positions.py 01 记录.json            各零件当前 position 与相对初态的位移
  python 题目/工具/positions.py 01 记录.json --piece A  另列出零件 A 当前占据的单位格（一次只能查一个零件）
记录.json 是移动指令数组，格式同答案里的 moves：{"pieces": [...], "delta": [x, y, z]}；
带 "out" 的指令表示这组零件已移出，之后不再列出它们的位置。记录为空数组时输出初态。
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def axis_vector(value, ray):
    if not (isinstance(value, list) and len(value) == 3 and all(type(x) is int for x in value)):
        raise ValueError("位移须为三个整数组成的数组")
    if sum(1 for x in value if x) != 1:
        raise ValueError("每步须沿一个坐标轴移动，且距离不能为零")
    if ray and max(abs(x) for x in value) != 1:
        raise ValueError("out 向量须为一个正负单位轴向量")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("puzzle", help="题号，如 01")
    parser.add_argument("record", help="移动记录 JSON 文件")
    parser.add_argument("--piece", help="列出这一个零件当前占据的单位格")
    a = parser.parse_args()
    puzzle = json.loads((HERE.parent / f"{a.puzzle}.json").read_text(encoding="utf-8-sig"))
    start = {p["id"]: list(p["position"]) for p in puzzle["pieces"]}
    shapes = {p["id"]: p["voxels"] for p in puzzle["pieces"]}
    now, gone = {k: list(v) for k, v in start.items()}, set()
    moves = json.loads(Path(a.record).read_text(encoding="utf-8-sig"))
    if not isinstance(moves, list):
        raise SystemExit("记录应为移动指令数组")
    for i, move in enumerate(moves):
        try:
            ids = move["pieces"]
            unknown = [k for k in ids if k not in now]
            if unknown:
                raise ValueError(f"没有零件 {unknown}")
            moved_out = [k for k in ids if k in gone]
            if moved_out:
                raise ValueError(f"零件 {moved_out} 已移出")
            if "out" in move:
                axis_vector(move["out"], True)
                gone.update(ids)
            else:
                d = axis_vector(move["delta"], False)
                for k in ids:
                    now[k] = [now[k][j] + d[j] for j in range(3)]
        except (KeyError, TypeError, ValueError) as exc:
            raise SystemExit(f"第 {i + 1} 条指令无法记账：{exc}")
    print(f"第{a.puzzle}题，已记账 {len(moves)} 条指令（未检查碰撞）：")
    for k in now:
        if k in gone:
            print(f"  {k}：已移出")
        else:
            offset = [now[k][j] - start[k][j] for j in range(3)]
            print(f"  {k}：position {now[k]}，相对初态位移 {offset}")
    if a.piece:
        if a.piece not in now:
            raise SystemExit(f"没有零件 {a.piece}")
        if a.piece in gone:
            raise SystemExit(f"零件 {a.piece} 已移出")
        cells = sorted(tuple(c[j] + now[a.piece][j] for j in range(3)) for c in shapes[a.piece])
        print(f"零件 {a.piece} 当前占据 {len(cells)} 个单位格（[x,y,z] 表示 [x,x+1]×[y,y+1]×[z,z+1]）：")
        for c in cells:
            print(f"  {list(c)}")


if __name__ == "__main__":
    main()
