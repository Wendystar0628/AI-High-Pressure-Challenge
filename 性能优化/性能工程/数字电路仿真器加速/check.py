r"""Compare a compiled submission with reference.exe on this folder's inputs.

python 数据\check.py --exe .\grader.exe         all 9 inputs
python 数据\check.py --exe .\grader.exe 1 4     inputs 1 and 4

On each input, reference and submission run 3 times each in separate processes, interleaved as in
evaluate.py, taking each role's median. Processes use logical processors 0-15, high priority,
OMP_NUM_THREADS=16 and at most 60 s. Output includes both median times, agreement with the standard
answer, wrong digests, speedup and points from the statement's anchors (a failed submission scores 0).
Inputs 1-6 use the 12x table; register-file inputs 7-9 use the 8x table.
A failed reference invalidates the session. The mean covers only the inputs run, not the task score:
the 7 hidden correctness inputs are not in this folder.
"""
import argparse
import ctypes
from decimal import Decimal, ROUND_HALF_UP
import math
import os
from pathlib import Path
import re
import statistics
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
INPUT_NUMBERS = tuple(range(1, 10))
REPEATS = 3
ANCHORS = ((0.1, 0), (0.5, 5), (1, 12), (2, 27), (4, 47), (6, 62), (8, 76), (10, 89), (12, 100))
REGFILE_ANCHORS = ((0.1, 0), (0.5, 5), (1, 15), (2, 35), (4, 65), (6, 85), (8, 100))
MIN_MS = 0.001
AFFINITY = 0xffff
PROCESS_TIMEOUT_S = 60


def anchors_for(number):
    """Select by the input's number, independent of a partial run's order."""
    if number not in INPUT_NUMBERS:
        raise ValueError(f'Invalid circuit input: {number}')
    return ANCHORS if number <= 6 else REGFILE_ANCHORS


def points(s, number):
    """Per-input points, with the same rounding as evaluate.py."""
    anchors = anchors_for(number)
    if s <= anchors[0][0]:
        return float(anchors[0][1])
    if s >= anchors[-1][0]:
        return float(anchors[-1][1])
    (a, p), (b, q) = next(seg for seg in zip(anchors, anchors[1:]) if seg[0][0] <= s <= seg[1][0])
    return one_decimal(p + (q - p) * math.log(s / a) / math.log(b / a))


def one_decimal(value):
    return float(Decimal(repr(value)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))


def summary(numbers, scores):
    if None in scores:
        return 'reference failed: session invalid (no mean or task score)'
    mean = one_decimal(statistics.fmean(scores))
    if len(numbers) == len(INPUT_NUMBERS) and set(numbers) == set(INPUT_NUMBERS):
        return (f'all {len(INPUT_NUMBERS)} performance inputs: mean points={mean:.1f} '
                '(not a task score; 7 hidden correctness inputs not checked)')
    return f'partial inputs ({len(numbers)}/{len(INPUT_NUMBERS)}): mean points={mean:.1f} (not a task score)'


def failed_result(status, detail=''):
    return {'status': status, 'time_ms': None, 'detail': detail}


def run_once(exe, number, expected):
    env = dict(os.environ, OMP_NUM_THREADS='16')
    flags = subprocess.CREATE_NO_WINDOW | subprocess.HIGH_PRIORITY_CLASS
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        with subprocess.Popen([str(exe), str(ROOT / 'inputs' / f'input_{number:02d}.txt')], stdout=stdout, stderr=stderr,
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
                return failed_result('PROCESS_TIMEOUT', f'over {PROCESS_TIMEOUT_S} s')
        stdout.seek(0)
        stderr.seek(0)
        actual = stdout.read().replace(b'\r\n', b'\n')
        err = stderr.read().decode('utf-8', errors='replace')
    if proc.returncode:
        return failed_result('RUNTIME_ERROR', f'exit code {proc.returncode}\n{err[-2000:]}')
    timings = re.findall(r'^simulate_ms=([0-9]+(?:\.[0-9]+)?)\s*$', err, re.M)
    if len(timings) != 1:
        return failed_result('INVALID_TIMING', err[-2000:])
    ms = float(timings[0])
    if not math.isfinite(ms):
        return failed_result('INVALID_TIMING', err[-2000:])
    a, e = actual.split(), expected.split()
    wrong = sum(x != y for x, y in zip(a, e)) + abs(len(a) - len(e))
    return {'status': 'PASS' if actual == expected else 'WRONG_ANSWER', 'time_ms': ms, 'wrong': wrong}


def run_order(position):
    """Same 1-based input position and alternating pairs as evaluate.py."""
    pair = ('reference', 'candidate') if position % 2 else ('candidate', 'reference')
    return [role for k in range(REPEATS) for role in (pair if k % 2 == 0 else pair[::-1])]


def first_failure(runs):
    return next((x['status'] for x in runs if x['status'] != 'PASS'), None)


def run(exe, reference, number, position):
    expected = (ROOT / 'expected' / f'expected_{number:02d}.txt').read_bytes().replace(b'\r\n', b'\n')
    runs = {'reference': [], 'candidate': []}
    for role in run_order(position):
        if role == 'candidate' and first_failure(runs[role]):
            continue
        runs[role].append(run_once(reference if role == 'reference' else exe, number, expected))
    ref_failure, cand_failure = first_failure(runs['reference']), first_failure(runs['candidate'])
    R = statistics.median(x['time_ms'] for x in runs['reference']) if ref_failure is None else None
    C = statistics.median(x['time_ms'] for x in runs['candidate']) if cand_failure is None else None
    s = R / max(C, MIN_MS) if R is not None and C is not None else None
    got = points(s, number) if s is not None else (0.0 if R is not None else None)
    fmt = lambda value: 'n/a' if value is None else f'{value:.3f}'
    wrong = max((x['wrong'] for x in runs['candidate'] if 'wrong' in x), default=None)
    line = (f'input_{number:02d}  {cand_failure or "PASS"}  reference_status={ref_failure or "PASS"}  '
            f'baseline_ms={fmt(R)}  submission_ms={fmt(C)}  '
            f'wrong={wrong if wrong is not None else "n/a"}/{len(expected.split())}  '
            f'speedup={fmt(s)}  points={got if got is not None else "n/a"}')
    details = [f'{role}: {x["detail"]}' for role, records in runs.items()
               for x in records if x.get('detail')]
    return line + ('\n' + '\n'.join(details) if details else ''), got


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--exe', required=True, help='grader.cpp compiled with your solution.cpp')
    parser.add_argument('numbers', nargs='*', type=int, choices=INPUT_NUMBERS, help='inputs to run, default all')
    args = parser.parse_args()
    exe = Path(args.exe).resolve(strict=True)
    reference = (ROOT / 'reference.exe').resolve(strict=True)
    numbers = list(dict.fromkeys(args.numbers)) or list(INPUT_NUMBERS)
    got = []
    for position, number in enumerate(numbers, 1):
        line, p = run(exe, reference, number, position)
        got.append(p)
        print(line, flush=True)
    print(summary(numbers, got))
    return 2 if None in got else 0


if __name__ == '__main__':
    raise SystemExit(main())
