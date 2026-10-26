"""正负一序列的自相关能量最小化：校验 answer.md 并精确计算 E(s)。

用法：python check_answer.py <answer.md 路径>
输出：JSON（UTF-8）。
退出码：0 有效；1 无效；2 用法错误或文件无法读取（未作判定）。
只用 Python 标准库，全程整数运算。
"""
import hashlib
import json
import os
import sys
from fractions import Fraction

TASK = "正负一序列的自相关能量最小化"
N = 251
BOM = b"\xef\xbb\xbf"


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


def parse(data):
    """校验格式，返回 ±1 列表；不合格时抛出 Invalid。"""
    if data.startswith(BOM):
        data = data[len(BOM):]
    if data.endswith(b"\r\n"):
        data = data[:-2]
    elif data.endswith(b"\n"):
        data = data[:-1]
    for i, b in enumerate(data):
        if b not in b"+-":
            raise Invalid(f"第 {i + 1} 个字节（不计 BOM）不是 + 或 -，从该处起为 '{show(data[i:i + 8])}'")
    if len(data) != N:
        raise Invalid(f"序列长度为 {len(data)}，应为 {N}")
    return [1 if b == 0x2B else -1 for b in data]


def energy(s):
    """E(s) = Σ_{k=1}^{n-1} C_k^2，C_k = Σ_{i=1}^{n-k} s_i s_{i+k}。"""
    n = len(s)
    return sum(sum(s[i] * s[i + k] for i in range(n - k)) ** 2 for k in range(1, n))


def check(path):
    res = {"task": TASK, "file": os.path.abspath(path), "sha256": None,
           "valid": False, "invalid_reason": None,
           "energy": None, "energy_approx": None}
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
        s = parse(data)
    except Invalid as e:
        res["invalid_reason"] = str(e)
        return res
    e = energy(s)
    res.update(valid=True, energy=e, energy_approx=sig20(Fraction(e)))
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
