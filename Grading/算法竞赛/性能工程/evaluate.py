r"""Score an already compiled submission against the reference solution, re-run in the same session.

python evaluate.py --task sand --exe C:\eval\sand\grader.exe --reference C:\eval\sand\reference.exe
    --report result.json

Session: the candidate's correctness inputs first (any failure -> score 0, nothing else is run). Then, input by
input, every performance input is run --repeats times (default 1) by the reference solution and --repeats times by
the candidate, each run in its own process, interleaved: odd inputs start with the reference, even inputs with the
candidate, and the order flips after every pair (R C C R R C ... / C R R C C R ...). Each role's time on an input
is the median of its runs. The inputs are whatever performance/inputs holds (24 per task, at least 3).
Score: each performance input is scored on its own: s_i = R_i / C_i (R_i reference time, C_i candidate time), and
the task's anchor table interpolated linearly in ln s_i gives 0-100 points, one decimal place: 0 at or below the
lowest anchor, 100 at or above the highest anchor (flagged for manual review). An input the candidate fails (wrong
answer, crash, timeout) scores 0. The task score is the mean of the input scores, one decimal place.
G = exp(mean ln s_i) is reported for reference only. If the reference solution itself fails, the session is void:
score null, exit code 2.
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
import time

ROOT = Path(__file__).resolve().parent
TASKS = {  # anchors: (s_i, points), s_i relative to the reference solution, as in the statement's scoring section
    'circuit': {'folder': '通用数字电路仿真器加速', 'timer': 'simulate_ms',
                'anchors': ((0.1, 0), (0.5, 10), (1, 30), (1.75, 52), (2.75, 75), (4, 100))},
    'sand': {'folder': '网格沙粒倒塌的GPU加速', 'timer': 'solve_ms',
             'anchors': ((0.2, 0), (0.5, 5), (1, 20), (1.5, 34), (3, 60), (6, 100))},
}
CORRECTNESS_INPUTS = 7
MIN_PERFORMANCE_INPUTS = 3
PROCESS_TIMEOUT_S = 60           # hang guard for every process
HEALTH_PER_INPUT = 0.10          # reference time vs validation.json, per input; a single run varies about 5-7%
HEALTH_GEOMEAN = 0.05            # reference times vs validation.json, geometric mean
MIN_MS = 0.001                   # graders print 3 decimals; faster readings are clamped to this


def run_once(exe, inp, expected, timer, affinity):
    env = dict(os.environ, OMP_NUM_THREADS='16', CUDA_MODULE_LOADING='EAGER')
    flags = subprocess.CREATE_NO_WINDOW | subprocess.HIGH_PRIORITY_CLASS if os.name == 'nt' else 0
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        with subprocess.Popen([str(exe), str(inp)], stdout=stdout, stderr=stderr,
                              env=env, creationflags=flags) as proc:
            if os.name == 'nt':
                kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
                kernel32.SetProcessAffinityMask.argtypes = [ctypes.c_void_p, ctypes.c_size_t]
                kernel32.SetProcessAffinityMask.restype = ctypes.c_int
                if not kernel32.SetProcessAffinityMask(int(proc._handle), affinity):
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
            actual = stdout.read().replace(b'\r\n', b'\n')
            err = stderr.read().decode('utf-8', errors='replace')
        timings = re.findall(r'^' + re.escape(timer) + r'=([0-9]+(?:\.[0-9]+)?)\s*$', err, re.M)
        ms = float(timings[0]) if len(timings) == 1 else None
        if proc.returncode:
            status = 'RUNTIME_ERROR'
        elif ms is None or not math.isfinite(ms):
            status = 'INVALID_TIMING'
        elif actual != expected:
            status = 'WRONG_ANSWER'
        else:
            status = 'PASS'
        record = {'status': status, 'time_ms': ms, 'returncode': proc.returncode}
        if status != 'PASS': record['stderr'] = err[-3000:]
        return record


def cases(folder, kind, exact=None, minimum=1):
    """(input, expected file) pairs, sorted by name; the expected bytes are read when the input is run."""
    inputs = sorted((folder / 'inputs').glob('*.txt'))
    if exact is not None and len(inputs) != exact:
        raise RuntimeError(f'Expected {exact} {kind} inputs, found {len(inputs)}: {folder}')
    if len(inputs) < minimum:
        raise RuntimeError(f'Expected at least {minimum} {kind} inputs, found {len(inputs)}: {folder}')
    pairs = [(inp, folder / 'expected' / inp.name.replace('input_', 'expected_')) for inp in inputs]
    missing = [str(e) for _, e in pairs if not e.is_file()]
    if missing:
        raise RuntimeError(f'Missing expected outputs: {", ".join(missing)}')
    return pairs


def read_expected(path):
    return path.read_bytes().replace(b'\r\n', b'\n')


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


def mean_points(values):
    """The task score: mean of the per-input points, one decimal place."""
    return float(Decimal(repr(statistics.fmean(values))).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))


def load_validation(suite):
    try:
        data = json.loads((suite / 'validation.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def families(validation):
    """case -> family from validation.json's inputs (a list of {case, family, ...} or a dict keyed by case)."""
    inputs = validation.get('inputs')
    if isinstance(inputs, dict):
        inputs = [dict(v, case=k) for k, v in inputs.items() if isinstance(v, dict)]
    if not isinstance(inputs, list):
        return {}
    return {x['case']: x.get('family') for x in inputs if isinstance(x, dict) and 'case' in x}


def health_check(validation, reference_ms):
    """Compare this session's reference times with reference_medians_ms recorded in validation.json."""
    recorded = validation.get('reference_medians_ms')
    if not isinstance(recorded, dict):
        return {'ok': False, 'warnings': ['validation.json has no reference_medians_ms']}
    ratios, warnings = {}, []
    for case, r in reference_ms.items():
        ref = recorded.get(case)
        if not isinstance(ref, (int, float)) or ref <= 0 or r is None:
            warnings.append(f'{case}: no reference time to compare')
            continue
        ratios[case] = r / ref
        if abs(r / ref - 1) > HEALTH_PER_INPUT:
            warnings.append(f'{case}: reference time {r:.3f} ms is {100 * (r / ref - 1):+.1f}% '
                            f'from the recorded {ref:.3f} ms (limit {100 * HEALTH_PER_INPUT:.0f}%)')
    extra = sorted(set(recorded) - set(reference_ms))
    if extra:
        warnings.append(f'validation.json records inputs that were not run: {", ".join(extra)}')
    gm = geomean(ratios.values()) if ratios else None
    if gm is not None and abs(gm - 1) > HEALTH_GEOMEAN:
        warnings.append(f'reference times are {100 * (gm - 1):+.1f}% from validation.json in geometric mean '
                        f'(limit {100 * HEALTH_GEOMEAN:.0f}%)')
    return {'ok': not warnings, 'reference_ratio_to_recorded': ratios, 'geomean_ratio': gm, 'warnings': warnings}


def run_order(position, repeats):
    """Roles for the performance input at 1-based position: odd inputs start with the reference, even inputs with
    the candidate, and the order flips after every pair."""
    pair = ('reference', 'candidate') if position % 2 else ('candidate', 'reference')
    return [role for k in range(repeats) for role in (pair if k % 2 == 0 else pair[::-1])]


def first_failure(runs):
    return next((x['status'] for x in runs if x['status'] != 'PASS'), None)


def evaluate(args):
    task = TASKS[args.task]
    suite = ROOT / task['folder']
    timer = task['timer']
    anchors = task['anchors']
    if args.repeats < 1:
        raise SystemExit('--repeats must be at least 1')
    exe = Path(args.exe).resolve(strict=True)
    reference = Path(args.reference).resolve(strict=True) if args.reference else None
    if reference is None and not args.correctness_only:
        raise SystemExit('--reference is required unless --correctness-only is given')
    correctness_cases = cases(suite / 'correctness', 'correctness', exact=CORRECTNESS_INPUTS)
    perf_cases = None if args.correctness_only else \
        cases(suite / 'performance', 'performance', minimum=MIN_PERFORMANCE_INPUTS)
    validation = load_validation(suite)
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {'task': args.task, 'started': time.strftime('%Y-%m-%d %H:%M:%S'),
              'exe': str(exe), 'reference_exe': str(reference) if reference else None,
              'repeats': args.repeats, 'pause_s': args.pause, 'affinity_mask': hex(args.affinity),
              'process_timeout_s': PROCESS_TIMEOUT_S, 'anchors': anchors, 's_max': anchors[-1][0],
              'official': not args.correctness_only,
              'correctness': [], 'performance': []}
    save = lambda: report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    def run(role_exe, inp, expected):
        time.sleep(args.pause)
        return run_once(role_exe, inp, expected, timer, args.affinity)

    # 1. Candidate correctness inputs, one process each.
    for inp, expected_path in correctness_cases:
        r = run(exe, inp, read_expected(expected_path))
        report['correctness'].append({'case': inp.stem, 'passed': r['status'] == 'PASS', 'run': r})
        print(f"correctness/{inp.stem}: {r['status']}", flush=True)
        save()
    failed = [x['case'] for x in report['correctness'] if not x['passed']]
    report['correctness_passed'] = CORRECTNESS_INPUTS - len(failed)
    zero = [f'correctness input {c} failed' for c in failed]

    # 2. Performance inputs, one at a time: the reference solution and the candidate, --repeats runs each, interleaved.
    session_errors, items, clamped = [], [], []
    if perf_cases is not None and not failed:
        family = families(validation)
        for position, (inp, expected_path) in enumerate(perf_cases, 1):
            expected = read_expected(expected_path)
            order = run_order(position, args.repeats)
            item = {'case': inp.stem, 'family': family.get(inp.stem),
                    'order': ''.join('R' if role == 'reference' else 'C' for role in order), 'runs': []}
            items.append(item)
            report['performance'] = items
            for seq, role in enumerate(order, 1):
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
            elif R < MIN_MS:
                session_errors.append(f'reference solution reported {R:.3f} ms on {inp.stem}')
                R = None
            if C is not None and C < MIN_MS: clamped.append(inp.stem)
            s = R / max(C, MIN_MS) if R is not None and C is not None else None
            item.update(reference_status=ref_failure or 'PASS', status=cand_failure or 'PASS',
                        R_i_ms=R, C_i_ms=C, s_i=s,
                        points_i=points(s, anchors) if s is not None else (0.0 if R is not None else None))
            save()

    # 3. Metric and score.
    report['performance'] = items
    report['performance_inputs'] = len(items)
    report['performance_passed'] = sum(x['status'] == 'PASS' for x in items)
    speedups = [x['s_i'] for x in items]
    report['G'] = geomean(speedups) if items and None not in speedups else None
    report['session_valid'] = not session_errors
    report['session_errors'] = session_errors
    report['zero_score'] = bool(zero)
    report['zero_score_reasons'] = zero
    report['manual_review_required'] = False
    if args.correctness_only:
        report['score'] = None
    elif session_errors:
        report['score'] = None  # the reference solution itself failed: the session must be repeated
        report['zero_score'] = False
    elif zero:
        report['score'] = 0.0
    elif not items or any(x['points_i'] is None for x in items):
        report['score'] = None
    else:
        report['score'] = mean_points(x['points_i'] for x in items)
        report['failed_inputs'] = [x['case'] for x in items if x['status'] != 'PASS']
        top = [x['case'] for x in items if x['s_i'] is not None and x['s_i'] >= anchors[-1][0]]
        notes = [f"{', '.join(top)} 的加速比达到或超过最高锚点 {anchors[-1][0]}"] if top else []
        if clamped: notes.append(f"提交在 {', '.join(clamped)} 上的计时低于 {MIN_MS} ms，已按 {MIN_MS} ms 计算")
        report['manual_review_required'] = bool(notes)
        if notes: report['manual_review_note'] = '需人工复核：' + '；'.join(notes)
    report['official'] = report['official'] and not session_errors
    report['summary'] = [{k: x[k] for k in ('case', 'family', 'R_i_ms', 'C_i_ms', 's_i', 'points_i', 'status')}
                         for x in items]
    if items:
        report['health'] = health_check(validation, {x['case']: x['R_i_ms'] for x in items})
        for w in report['health']['warnings']: print('HEALTH WARNING: ' + w, flush=True)
    report['finished'] = time.strftime('%Y-%m-%d %H:%M:%S')
    save()
    print(json.dumps({k: report.get(k) for k in ('correctness_passed', 'performance_inputs', 'performance_passed',
                                                 'G', 'score', 'zero_score_reasons', 'session_errors',
                                                 'manual_review_required', 'official')},
                     ensure_ascii=False), flush=True)
    if session_errors: return 2
    if args.correctness_only: return 1 if failed else 0
    return 0 if report['score'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--task', required=True, choices=TASKS)
    parser.add_argument('--exe', required=True, help='compiled grader + candidate solution')
    parser.add_argument('--reference', help='compiled grader + baselines/reference_solution, the denominator of s_i '
                                            '(required unless --correctness-only)')
    parser.add_argument('--report', required=True)
    parser.add_argument('--repeats', type=int, default=1,
                        help='runs per role on every performance input; each role takes the median (default 1)')
    parser.add_argument('--pause', type=float, default=0.0, help='seconds slept before every run')
    parser.add_argument('--affinity', type=lambda s: int(s, 0), default=0xffff)
    parser.add_argument('--correctness-only', action='store_true')
    raise SystemExit(evaluate(parser.parse_args()))
