r"""Run a compiled grader on the inputs of this folder and check its answers, under the conditions of the scoring.

python 数据\check.py --exe .\grader.exe         all 8 inputs
python 数据\check.py --exe .\grader.exe 1 7     inputs 1 and 7

Each input gets one run in its own process: logical processors 0-15, high priority, at most 120 s. The output gives
the time, the worst error as a share of its tolerance (above 1 is wrong), the number of wrong elements, the speedup
against the baseline time in the statement, and the points of the statement's anchor table (a wrong answer scores 0).
The scoring takes the median of 3 runs and measures the baseline again in the same session.
"""
import argparse
import ctypes
import math
import os
from pathlib import Path
import re
import statistics
import subprocess
import tempfile

import numpy as np

ROOT = Path(__file__).resolve().parent
BASELINE_MS = {1: 268.7, 2: 113.3, 3: 228.1, 4: 9251.9, 5: 543.4, 6: 177.2, 7: 274.9, 8: 129.5}
ANCHORS = ((0.2, 0), (0.6, 5), (1.2, 15), (2, 25), (4, 45), (8, 70), (12, 86), (16, 100))
ATOL, RTOL = 0.005, 0.02
AFFINITY = 0xffff
PROCESS_TIMEOUT_S = 120


def compare(actual, expected):
    """Worst error as a share of its tolerance, and the number of elements above 1 (non-finite ones count)."""
    a, e = np.frombuffer(actual, '<f4'), np.frombuffer(expected, '<f4')
    if a.size != e.size:
        return math.inf, e.size
    worst, wrong = 0.0, 0
    for start in range(0, a.size, 1 << 24):
        ai, ei = a[start:start + (1 << 24)].astype(np.float64), e[start:start + (1 << 24)].astype(np.float64)
        d = np.abs(ai - ei)
        r = np.minimum(d / ATOL, np.divide(d, RTOL * np.abs(ei), out=np.full_like(d, np.inf), where=ei != 0))
        r[~np.isfinite(ai)] = np.inf
        worst, wrong = max(worst, float(r.max())), wrong + int((r > 1).sum())
    return worst, wrong


def points(s):
    if s <= ANCHORS[0][0]:
        return float(ANCHORS[0][1])
    if s >= ANCHORS[-1][0]:
        return float(ANCHORS[-1][1])
    (a, p), (b, q) = next(seg for seg in zip(ANCHORS, ANCHORS[1:]) if seg[0][0] <= s <= seg[1][0])
    return round(p + (q - p) * math.log(s / a) / math.log(b / a), 1)


def run(exe, number):
    """One line of results for this input, and its points."""
    name = f'input_{number:02d}'
    env = dict(os.environ, OMP_NUM_THREADS='16', CUDA_MODULE_LOADING='EAGER')
    flags = subprocess.CREATE_NO_WINDOW | subprocess.HIGH_PRIORITY_CLASS
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        with subprocess.Popen([str(exe), str(ROOT / 'inputs' / f'{name}.bin')], stdout=stdout, stderr=stderr,
                              env=env, creationflags=flags) as proc:
            kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
            kernel32.SetProcessAffinityMask.argtypes = [ctypes.c_void_p, ctypes.c_size_t]
            kernel32.SetProcessAffinityMask.restype = ctypes.c_int
            if not kernel32.SetProcessAffinityMask(int(proc._handle), AFFINITY):
                proc.kill()
                proc.wait()
                raise ctypes.WinError(ctypes.get_last_error())
            try:
                proc.wait(timeout=PROCESS_TIMEOUT_S)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                return f'{name}  PROCESS_TIMEOUT  over {PROCESS_TIMEOUT_S} s  points=0', 0.0
        stdout.seek(0)
        stderr.seek(0)
        actual = stdout.read()
        err = stderr.read().decode('utf-8', errors='replace')
    if proc.returncode:
        return f'{name}  RUNTIME_ERROR  exit code {proc.returncode}  points=0\n{err[-2000:]}', 0.0
    timings = re.findall(r'^forward_ms=([0-9]+(?:\.[0-9]+)?)\s*$', err, re.M)
    if len(timings) != 1:
        return f'{name}  INVALID_TIMING  points=0\n{err[-2000:]}', 0.0
    ms = float(timings[0])
    expected = (ROOT / 'expected' / f'expected_{number:02d}.bin').read_bytes()
    worst, wrong = compare(actual, expected)
    s = BASELINE_MS[number] / max(ms, 0.001)
    got = points(s) if worst <= 1 else 0.0
    status = 'PASS' if worst <= 1 else 'WRONG_ANSWER'
    return (f'{name}  {status}  forward_ms={ms:.3f}  error/tolerance={worst:.3f}  wrong={wrong}/{len(expected) // 4}  '
            f'baseline_ms={BASELINE_MS[number]}  speedup={s:.3f}  points={got}'), got


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--exe', required=True, help='grader.cu compiled with your solution.cu')
    parser.add_argument('numbers', nargs='*', type=int, choices=sorted(BASELINE_MS), help='inputs to run, default all')
    args = parser.parse_args()
    exe = Path(args.exe).resolve(strict=True)
    numbers = args.numbers or sorted(BASELINE_MS)
    got = []
    for number in numbers:
        line, p = run(exe, number)
        got.append(p)
        print(line, flush=True)
    print(f'mean points over {len(got)} of {len(BASELINE_MS)} inputs: {statistics.fmean(got):.1f}')


if __name__ == '__main__':
    main()
