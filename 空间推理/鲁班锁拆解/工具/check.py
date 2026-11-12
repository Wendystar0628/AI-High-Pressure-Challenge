"""路线检查器：检查答案里的整条拆解路线是否合法，并按题面规则计步。

它只检查你写出的路线，不会替你找路线，也不含参考答案。用法（在作答目录运行）：
  python 鲁班锁拆解/工具/check.py 答案/第01题.json
路线中途发生碰撞、写错或没有拆完时，会指出断在哪里，并报告在此之前从初态起已经
合法完成了几次分离。尚未拆开的分支写 null。
"""
import bisect
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


class Invalid(ValueError):
    pass


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def require(condition, message):
    if not condition:
        raise Invalid(message)


def vector(value, ray=False):
    require(isinstance(value, list) and len(value) == 3,
            "位移须为三个整数组成的数组")
    require(all(type(x) is int for x in value), "位移须为整数")
    nonzero = [i for i, x in enumerate(value) if x]
    require(len(nonzero) == 1, "每步须沿一个坐标轴移动，且距离不能为零")
    axis = nonzero[0]
    amount = value[axis]
    require(not ray or abs(amount) == 1, "out 向量须为一个正负单位轴向量")
    return axis, (1 if amount > 0 else -1), abs(amount)


def sweep(shapes, positions, component, moving, axis, sign, distance=None):
    """检查整个扫掠区间。distance=None 表示沿射线一直平移到无穷远。"""
    orth = [d for d in range(3) if d != axis]
    lines = {}
    for key in component - moving:
        pos = positions[key]
        for cell in shapes[key]:
            p = tuple(cell[d] + pos[d] for d in range(3))
            line = (p[orth[0]], p[orth[1]])
            lines.setdefault(line, []).append(sign * p[axis])
    for line in lines.values():
        line.sort()
    for key in moving:
        pos = positions[key]
        for cell in shapes[key]:
            p = tuple(cell[d] + pos[d] for d in range(3))
            line = lines.get((p[orth[0]], p[orth[1]]), ())
            at = sign * p[axis]
            j = bisect.bisect_right(line, at)
            if j < len(line) and (distance is None or line[j] - at <= distance):
                raise Invalid(f"零件 {key} 的移动路径发生碰撞")


def walk(puzzle, answer, stages):
    """从初态起按深度优先顺序（本组件、removed 分支、remaining 分支）逐步检查路线。

    每合法完成一次分离，就把这一阶段追加到 stages；遇到第一处碰撞、记号错误或
    没拆完的分支时抛出 Invalid，此前完成的分离仍留在 stages 里。返回总步数。
    """
    require(isinstance(answer, dict), "答案应为 JSON 对象")
    require(answer.get("puzzle") == puzzle["id"], "答案的 puzzle 编号与题目不一致")
    shapes, positions, occupied = {}, {}, set()
    for part in puzzle["pieces"]:
        key = part["id"]
        require(key not in shapes, "题目中零件编号重复")
        shapes[key] = [tuple(c) for c in part["voxels"]]
        positions[key] = tuple(part["position"])
        for cell in shapes[key]:
            world = tuple(cell[d] + positions[key][d] for d in range(3))
            require(world not in occupied, "题目初态存在重叠")
            occupied.add(world)

    def visit(node, component, positions, path):
        if len(component) == 1:
            require(node is None, f"{path} 已是单个零件，分支应写 null")
            return 0
        require(isinstance(node, dict), f"{path} 尚有 {len(component)} 件未拆开")
        moves = node.get("moves")
        require(isinstance(moves, list) and len(moves) > 0, f"{path} 缺少移动步骤")
        positions = dict(positions)
        previous, count, split = None, 0, None
        for index, move in enumerate(moves):
            where = f"{path}.moves[{index}]"
            require(isinstance(move, dict), f"{where} 应为对象")
            ids = move.get("pieces")
            require(isinstance(ids, list) and all(isinstance(k, str) for k in ids),
                    f"{where} 的 pieces 应为零件编号数组")
            moving = set(ids)
            require(len(moving) == len(ids) and moving and moving < component,
                    f"{where} 必须选本组件中不重复的非空真子集")
            ray = "out" in move
            require(("delta" in move) != ray, f"{where} 须且仅须提供 delta 或 out")
            axis, sign, length = vector(move["out" if ray else "delta"], ray)
            try:
                sweep(shapes, positions, component, moving, axis, sign,
                      None if ray else length)
            except Invalid as exc:
                raise Invalid(f"{where}: {exc}") from exc
            signature = (frozenset(moving), axis, sign)
            if signature != previous:
                count += 1
            previous = signature
            if ray:
                require(index == len(moves) - 1, f"{where}: out 必须是本段最后一步")
                split = moving
            else:
                delta = move["delta"]
                for key in moving:
                    positions[key] = tuple(positions[key][d] + delta[d] for d in range(3))
        require(split is not None, f"{path} 未完成组件分离")
        stages.append({"path": path, "pieces": sorted(component), "moves": count,
                       "removed": sorted(split)})
        require("removed" in node and "remaining" in node, f"{path} 缺少两个后续分支")
        return (count + visit(node["removed"], split, positions, path + ".removed")
                + visit(node["remaining"], component - split, positions, path + ".remaining"))

    return visit(answer.get("plan"), set(shapes), positions, "plan")


def progress(puzzle, answer):
    """检查写出的路线，不因路线出错而抛出：没拆完或出错时报告断点和此前合法完成的分离。"""
    stages = []
    try:
        total = walk(puzzle, answer, stages)
    except Invalid as exc:
        return {"valid": False, "puzzle": puzzle["id"], "reason": str(exc),
                "separations": len(stages), "stages": stages}
    return {"valid": True, "puzzle": puzzle["id"], "moves": total,
            "first_split_moves": stages[0]["moves"], "separations": len(stages),
            "stages": stages}


def validate(puzzle, answer):
    """整条路线须合法并完整拆开，否则抛出 Invalid。"""
    result = progress(puzzle, answer)
    require(result["valid"], result.get("reason", ""))
    return result


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    try:
        answer = load(sys.argv[1])
        key = answer.get("puzzle") if isinstance(answer, dict) else None
        require(isinstance(key, str) and (HERE.parent / f"{key}.json").is_file(), "puzzle 应为题号字符串，如 \"01\"")
        puzzle = load(HERE.parent / f"{key}.json")
        result = progress(puzzle, answer)
    except (Invalid, KeyError, TypeError, json.JSONDecodeError, OSError) as exc:
        print(f"路线不合法：{exc}")
        raise SystemExit(1)
    if result["valid"]:
        print(f"第{result['puzzle']}题路线合法，已完整拆开，按题面规则共 {result['moves']} 步。")
    else:
        print(f"第{result['puzzle']}题路线没有完整拆开，断在：{result['reason']}")
        print(f"在此之前从初态起已合法完成 {result['separations']} 次分离"
              f"（全部拆开共需 {len(puzzle['pieces']) - 1} 次）。")
    for s in result["stages"]:
        print(f"  {s['path']}：组件 {''.join(s['pieces'])}，{s['moves']} 步后分出 {''.join(s['removed'])}")
    raise SystemExit(0 if result["valid"] else 1)


if __name__ == "__main__":
    main()
