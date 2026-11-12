r"""Score an already compiled submission against the reference solution, re-run in the same session.

python evaluate.py --task circuit --exe grader.exe --reference reference.exe
    --report result.json

Session: the candidate's correctness inputs first, then, input by input, every performance input is run 3 times by the reference solution and 3 times by
the candidate, each run in its own process, interleaved: odd inputs start with the reference, even inputs with the
candidate, and the order flips after every pair (R C C R R C ... / C R R C C R ...). Each role's time on an input
is the median of its runs. Circuit uses input_01 through input_09 across 3 families.
Speedup: s_i = R_i / C_i (R_i reference time, C_i candidate time); G = exp(mean ln s_i).
Circuit: each performance input is scored on its own by interpolating its family's anchor table in ln s_i
(inputs 1-6: full at 12x; register-file inputs 7-9: full at 8x),
one decimal place, clamped to 0-100; a failed input scores 0. The task score is the mean of the input scores
times the share of correctness inputs passed (each of the 7 is worth 1/7), one decimal place. G is reference only.
If the reference solution itself fails, the session is void: score null, exit code 2.
"""
import argparse
import ctypes
from decimal import Decimal, ROUND_HALF_UP
import json
import math
import os
from pathlib import Path
import re
import statistics
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
TASKS = {  # anchors: (speedup, points), per input
    'circuit': {'folder': '数字电路仿真器加速', 'timer': 'simulate_ms',
                'performance_inputs': tuple(f'input_{i:02d}' for i in range(1, 10)),
                'anchors': ((0.1, 0), (0.5, 5), (1, 12), (2, 27), (4, 47), (6, 62), (8, 76), (10, 89), (12, 100)),
                'regfile_anchors': ((0.1, 0), (0.5, 5), (1, 15), (2, 35), (4, 65), (6, 85), (8, 100))},
}
CORRECTNESS_INPUTS = 7
REPEATS = 3                     # runs per role on every performance input
AFFINITY = 0xffff               # logical processors 0-15, the performance cores
PROCESS_TIMEOUT_S = 60           # hang guard for every process
MIN_MS = 0.001                  # graders print 3 decimals; faster readings are clamped to this


def run_once(exe, inp, expected, timer):
    env = dict(os.environ, OMP_NUM_THREADS='16')
    flags = subprocess.CREATE_NO_WINDOW | subprocess.HIGH_PRIORITY_CLASS if os.name == 'nt' else 0
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        with subprocess.Popen([str(exe), str(inp)], stdout=stdout, stderr=stderr,
                              env=env, creationflags=flags) as proc:
            if os.name == 'nt':
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
                return {'status': 'PROCESS_TIMEOUT', 'time_ms': None}
            stdout.seek(0)
            stderr.seek(0)
            actual = stdout.read()
            err = stderr.read().decode('utf-8', errors='replace')
        timings = re.findall(r'^' + re.escape(timer) + r'=([0-9]+(?:\.[0-9]+)?)\s*$', err, re.M)
        ms = float(timings[0]) if len(timings) == 1 else None
        if proc.returncode:
            status = 'RUNTIME_ERROR'
        elif ms is None or not math.isfinite(ms):
            status = 'INVALID_TIMING'
        elif actual.replace(b'\r\n', b'\n') != expected:
            status = 'WRONG_ANSWER'
        else:
            status = 'PASS'
        record = {'status': status, 'time_ms': ms, 'returncode': proc.returncode}
        if status != 'PASS': record['stderr'] = err[-3000:]
        return record


def cases(folder, pattern):
    """(input, expected file) pairs, sorted by name; the expected bytes are read when the input is run."""
    return [(inp, folder / 'expected' / inp.name.replace('input_', 'expected_'))
            for inp in sorted((folder / 'inputs').glob(pattern))]


def read_expected(path):
    return path.read_bytes().replace(b'\r\n', b'\n')


def circuit_anchors(number):
    """The public input number fixes its family, even if metadata is missing."""
    if not 1 <= number <= 9:
        raise ValueError(f'Invalid circuit input: {number}')
    return TASKS['circuit']['anchors' if number <= 6 else 'regfile_anchors']


def points(s, anchors):
    """Official conversion: the anchor table interpolated linearly in ln s, clamped at both ends, one decimal place."""
    if s <= anchors[0][0]:
        raw = float(anchors[0][1])
    elif s >= anchors[-1][0]:
        raw = float(anchors[-1][1])
    else:
        (a, p), (b, q) = next(seg for seg in zip(anchors, anchors[1:]) if seg[0][0] <= s <= seg[1][0])
        raw = p + (q - p) * math.log(s / a) / math.log(b / a)
    return float(Decimal(repr(raw)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))


def geomean(values):
    return math.exp(statistics.fmean(math.log(v) for v in values))


def one_decimal(x):
    return float(Decimal(repr(x)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))


def mean_points(values, passed=None, total=None):
    """The task score: mean of the per-input points, times passed/total correctness inputs when given; one decimal."""
    m = statistics.fmean(values)
    return one_decimal(m if passed is None else m * passed / total)


def families(suite):
    """case -> family from the task's validation.json."""
    data = json.loads((suite / 'validation.json').read_text(encoding='utf-8'))
    return {x['case']: x['family'] for x in data['inputs']}


def run_order(position):
    """Roles for the performance input at 1-based position: odd inputs start with the reference, even inputs with
    the candidate, and the order flips after every pair."""
    pair = ('reference', 'candidate') if position % 2 else ('candidate', 'reference')
    return [role for k in range(REPEATS) for role in (pair if k % 2 == 0 else pair[::-1])]


def first_failure(runs):
    return next((x['status'] for x in runs if x['status'] != 'PASS'), None)


def evaluate(args):
    task = TASKS[args.task]
    suite = ROOT / task['folder']
    timer = task['timer']
    exe = Path(args.exe).resolve(strict=True)
    reference = Path(args.reference).resolve(strict=True)
    correctness_cases = cases(suite / 'correctness', '*.txt')
    perf_cases = cases(suite / 'performance', '*.txt')
    if 'performance_inputs' in task:
        names = task['performance_inputs']
        perf_cases = [(inp, expected) for inp, expected in perf_cases if inp.stem in names]
        if tuple(inp.stem for inp, _ in perf_cases) != names:
            raise ValueError(f'Missing performance inputs: {names}')
    family = families(suite)
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    session_errors, items = [], []
    report = {'task': args.task, 'correctness': [], 'performance': items}
    save = lambda: report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    def run(role_exe, inp, expected):
        return run_once(role_exe, inp, expected, timer)

    # 1. Candidate correctness inputs, one process each.
    for inp, expected_path in correctness_cases:
        r = run(exe, inp, read_expected(expected_path))
        report['correctness'].append({'case': inp.stem, 'passed': r['status'] == 'PASS', 'run': r})
        print(f"correctness/{inp.stem}: {r['status']}", flush=True)
        save()
    report['correctness_passed'] = sum(x['passed'] for x in report['correctness'])

    # 2. Performance inputs, one at a time: the reference solution and the candidate, 3 runs each, interleaved.
    for position, (inp, expected_path) in enumerate(perf_cases, 1):
        expected = read_expected(expected_path)
        order = run_order(position)
        item = {'case': inp.stem, 'family': family.get(inp.stem),
                'order': ''.join('R' if role == 'reference' else 'C' for role in order), 'runs': []}
        items.append(item)
        for seq, role in enumerate(order, 1):
            # The failed input's scoring value is fixed; rerunning a crash could stack driver resets up to a blue screen.
            if role == 'candidate' and first_failure(x for x in item['runs'] if x['role'] == role):
                continue
            r = run(reference if role == 'reference' else exe, inp, expected)
            item['runs'].append({'seq': seq, 'role': role, **r})
            print(f"{inp.stem} #{seq} {role}: {r['status']} {r['time_ms']} ms", flush=True)
            save()
        ref_runs = [x for x in item['runs'] if x['role'] == 'reference']
        cand_runs = [x for x in item['runs'] if x['role'] == 'candidate']
        ref_failure, cand_failure = first_failure(ref_runs), first_failure(cand_runs)
        R = statistics.median(x['time_ms'] for x in ref_runs) if ref_failure is None else None
        C = statistics.median(x['time_ms'] for x in cand_runs) if cand_failure is None else None
        if ref_failure is not None:
            session_errors.append(f'reference solution failed on {inp.stem}: {ref_failure}')
        s = R / max(C, MIN_MS) if R is not None and C is not None else None
        item.update(reference_status=ref_failure or 'PASS', status=cand_failure or 'PASS',
                    R_i_ms=R, C_i_ms=C, s_i=s)
        anchors = circuit_anchors(int(inp.stem.removeprefix('input_')))
        item['points_i'] = points(s, anchors) if s is not None else (0.0 if R is not None else None)
        save()

    # 3. Metric and score.
    report['performance_inputs'] = len(items)
    report['performance_passed'] = sum(x['status'] == 'PASS' for x in items)
    speedups = [x['s_i'] for x in items]
    report['G'] = geomean(speedups) if items and None not in speedups else None
    report['session_errors'] = session_errors
    if session_errors or not items:
        report['score'] = None  # the reference solution itself failed: the session must be repeated
    else:
        report['performance_score'] = mean_points([x['points_i'] for x in items])
        report['score'] = mean_points([x['points_i'] for x in items], report['correctness_passed'], CORRECTNESS_INPUTS)
        report['correctness_factor'] = f"{report['correctness_passed']}/{CORRECTNESS_INPUTS}"
        report['failed_inputs'] = [x['case'] for x in items if x['status'] != 'PASS']
    summary_keys = ('case', 'family', 'R_i_ms', 'C_i_ms', 's_i', 'points_i', 'status')
    report['summary'] = [{k: x[k] for k in summary_keys}
                         for x in items]
    save()
    print(json.dumps({k: report.get(k) for k in ('correctness_passed', 'performance_inputs', 'performance_passed',
                                                 'G', 'performance_score', 'score', 'session_errors')},
                     ensure_ascii=False), flush=True)
    if session_errors: return 2
    return 0 if report['score'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--task', required=True, choices=TASKS)
    parser.add_argument('--exe', required=True, help='compiled grader + candidate solution')
    parser.add_argument('--reference', required=True,
                        help='compiled grader + baselines/reference_solution, the numerator of s_i')
    parser.add_argument('--report', required=True)
    raise SystemExit(evaluate(parser.parse_args()))
