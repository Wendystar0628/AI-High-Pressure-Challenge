"""单位正方形内最小三角形面积最大化：校验 answer.md 并精确计算 Δ。

用法：python check_answer.py <answer.md 路径>
输出：JSON（UTF-8）。
退出码：0 有效；1 无效；2 用法错误或文件无法读取（未作判定）。
只用 Python 标准库，全程整数 / Fraction 运算，不用浮点。
"""
import hashlib
import json
import os
import re
import sys
from fractions import Fraction
from itertools import combinations

TASK = "单位正方形内最小三角形面积最大化"
N = 30                  # 点数 n
DIGITS = 20             # 小数位数上限
SCALE = 10 ** DIGITS    # 坐标乘以 SCALE 后为整数
BOM = b"\xef\xbb\xbf"
# 数字：0 或 1，或 0./1. 后接 1~20 位数字；只认 ASCII
NUM = rb"[01](?:\.[0-9]{1,20})?"
LINE = re.compile(NUM + rb" " + NUM)


class Invalid(Exception):
    pass


def show(b, limit=60):
    """字节串的转义写法，便于在原因里展示。"""
    s = repr(bytes(b))[2:-1]
    return s if len(s) <= limit else s[:limit] + "..."


def sig20(q):
    """非负 Fraction 的 20 位有效数字十进制近似（四舍六入五成双），定点写法。"""
    if q == 0:
        return "0"
    e = len(str(q.numerator)) - len(str(q.denominator))
    while Fraction(10) ** e > q:
        e -= 1
    while Fraction(10) ** (e + 1) <= q:
        e += 1
    m = round(q * Fraction(10) ** (19 - e))  # 20 位整数
    if m == 10 ** 20:
        m, e = 10 ** 19, e + 1
    d = str(m)
    if e >= 19:
        return d + "0" * (e - 19)
    if e >= 0:
        return d[:e + 1] + "." + d[e + 1:]
    return "0." + "0" * (-e - 1) + d


def split_lines(data):
    """按 \\n 或 \\r\\n 切分（可混用）；最后一行末尾的一个换行不产生新行。"""
    if data.endswith(b"\r\n"):
        data = data[:-2]
    elif data.endswith(b"\n"):
        data = data[:-1]
    parts = data.split(b"\n")
    # 后面跟着 \n 的 \r 属于换行；最后一行后面没有 \n，其中的 \r 保留（随后判为格式不符）
    return [p[:-1] if p.endswith(b"\r") else p for p in parts[:-1]] + parts[-1:]


def scaled(tok):
    """十进制坐标字节串 → 乘以 10^20 后的精确整数。"""
    head, _, frac = tok.partition(b".")
    return int(head) * SCALE + int(frac.ljust(DIGITS, b"0"))


def parse(data):
    """校验格式与范围，返回放大后的整数坐标列表；不合格时抛出 Invalid。"""
    if data.startswith(BOM):
        data = data[len(BOM):]
    if not data:
        raise Invalid("文件为空")
    lines = split_lines(data)
    for k, ln in enumerate(lines, 1):
        if not ln:
            raise Invalid(f"第 {k} 行是空行")
        if not LINE.fullmatch(ln):
            raise Invalid(f"第 {k} 行格式不符：'{show(ln)}'")
    if len(lines) != N:
        raise Invalid(f"共 {len(lines)} 行，应为 {N} 行")
    pts = []
    for k, ln in enumerate(lines, 1):
        x, y = (scaled(t) for t in ln.split(b" "))
        if x > SCALE or y > SCALE:
            raise Invalid(f"第 {k} 行的点不在单位正方形内：'{show(ln)}'")
        pts.append((x, y))
    return pts


def min_area(pts):
    """pts 为放大 10^20 的整数坐标。返回 (Δ, 第一个达到最小值的三元组，从 1 编号)。"""
    best = tri = None
    for (i, (xi, yi)), (j, (xj, yj)), (k, (xk, yk)) in combinations(enumerate(pts, 1), 3):
        d = abs((xj - xi) * (yk - yi) - (xk - xi) * (yj - yi))
        if best is None or d < best:
            best, tri = d, (i, j, k)
    return Fraction(best, 2 * SCALE * SCALE), tri


def check(path):
    res = {"task": TASK, "file": os.path.abspath(path), "sha256": None,
           "valid": False, "invalid_reason": None,
           "delta_exact": None, "delta_approx": None, "min_triangle": None}
    if not os.path.exists(path):
        res["invalid_reason"] = "文件不存在"
        return res
    if not os.path.isfile(path):
        res["invalid_reason"] = "路径不是普通文件"
        return res
    with open(path, "rb") as f:
        data = f.read()
    res["sha256"] = hashlib.sha256(data).hexdigest()
    try:
        pts = parse(data)
    except Invalid as e:
        res["invalid_reason"] = str(e)
        return res
    delta, tri = min_area(pts)
    res.update(valid=True, delta_exact=str(delta), delta_approx=sig20(delta),
               min_triangle=list(tri))
    return res


def main(argv):
    if len(argv) != 2:
        print("用法：python check_answer.py <answer.md 路径>", file=sys.stderr)
        return 2
    try:
        res = check(argv[1])
    except OSError as e:
        err = {"task": TASK, "file": os.path.abspath(argv[1]), "valid": None,
               "error": f"无法读取文件：{type(e).__name__}: {e.strerror or e}"}
        print(json.dumps(err, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0 if res["valid"] else 1


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if not stream.isatty():
            stream.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv))
