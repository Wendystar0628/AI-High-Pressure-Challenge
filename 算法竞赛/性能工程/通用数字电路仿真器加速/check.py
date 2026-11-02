r"""Run a compiled grader on the inputs of this folder and check its answers, under the conditions of the scoring.

python 数据\check.py --exe .\grader.exe         all 24 inputs
python 数据\check.py --exe .\grader.exe 1 7     inputs 1 and 7

Each input gets one run in its own process: logical processors 0-15, high priority, at most 60 s. The output gives
the time, the number of digests that differ from the standard answer, the speedup against the baseline time in the
statement, and the points of the statement's anchor table (a wrong answer scores 0). The scoring takes the median of
3 runs and measures the baseline again in the same session; the 7 correctness inputs are not in this folder.
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

ROOT = Path(__file__).resolve().parent
BASELINE_MS = {1: 1019.6, 2: 1015.9, 3: 1014.8, 4: 1938.0, 5: 2656.1, 6: 1673.8, 7: 958.5, 8: 978.4,
               9: 961.4, 10: 986.7, 11: 1001.6, 12: 978.8, 13: 990.6, 14: 994.5, 15: 991.5, 16: 999.5,
               17: 1021.1, 18: 988.0, 19: 1020.2, 20: 1027.1, 21: 1021.1, 22: 1018.4, 23: 975.2, 24: 975.5}
ANCHORS = ((0.1, 0), (0.5, 5), (1, 15), (2, 35), (4, 65), (6, 85), (8, 100))
AFFINITY = 0xffff
PROCESS_TIMEOUT_S = 60


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
    env = dict(os.environ, OMP_NUM_THREADS='16')
    flags = subprocess.CREATE_NO_WINDOW | subprocess.HIGH_PRIORITY_CLASS
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        with subprocess.Popen([str(exe), str(ROOT / 'inputs' / f'{name}.txt')], stdout=stdout, stderr=stderr,
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
        actual = stdout.read().split()
        err = stderr.read().decode('utf-8', errors='replace')
    if proc.returncode:
        return f'{name}  RUNTIME_ERROR  exit code {proc.returncode}  points=0\n{err[-2000:]}', 0.0
    timings = re.findall(r'^simulate_ms=([0-9]+(?:\.[0-9]+)?)\s*$', err, re.M)
    if len(timings) != 1:
        return f'{name}  INVALID_TIMING  points=0\n{err[-2000:]}', 0.0
    ms = float(timings[0])
    expected = (ROOT / 'expected' / f'expected_{number:02d}.txt').read_bytes().split()
    wrong = sum(a != e for a, e in zip(actual, expected)) + abs(len(actual) - len(expected))
    s = BASELINE_MS[number] / max(ms, 0.001)
    got = 0.0 if wrong else points(s)
    status = 'WRONG_ANSWER' if wrong else 'PASS'
    return (f'{name}  {status}  simulate_ms={ms:.3f}  wrong={wrong}/{len(expected)}  '
            f'baseline_ms={BASELINE_MS[number]}  speedup={s:.3f}  points={got}'), got


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--exe', required=True, help='grader.cpp compiled with your solution.cpp')
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
