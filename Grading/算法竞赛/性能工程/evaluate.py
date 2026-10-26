r"""Score an already compiled submission against the weak baseline, re-run in the same session.

python evaluate.py --task sand --exe C:\eval\sand\grader.exe --weak C:\eval\sand\weak.exe
    --strong C:\eval\sand\strong.exe --report result.json

Session: candidate correctness inputs first (any failure -> score 0, nothing else is run); then every
performance input once with the weak baseline, once with the strong baseline, and once with the
candidate, in that order, each in its own process.
Score: s_i = W_i / C_i, G = exp(mean ln s_i), score = 100 * min(1, ln G / ln S_max).
The strong baseline is reported for reference only and does not affect the score.
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
TASKS = {
    'circuit': {'folder': '通用数字电路仿真器加速', 'timer': 'simulate_ms', 'smax': 316},
    'sand': {'folder': '网格沙粒倒塌的GPU加速', 'timer': 'solve_ms', 'smax': 576},
}
PROCESS_TIMEOUT_S = 60           # hang guard for every process
HEALTH_PER_INPUT = 0.05          # weak time vs validation.json, per input
HEALTH_GEOMEAN = 0.03            # weak times vs validation.json, geometric mean
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


def cases(folder, count, kind):
    inputs = sorted((folder / 'inputs').glob('*.txt'))
    if len(inputs) != count:
        raise RuntimeError(f'Expected {count} {kind} inputs, found {len(inputs)}: {folder}')
    return [(inp, (folder / 'expected' / inp.name.replace('input_', 'expected_')).read_bytes().replace(b'\r\n', b'\n'))
            for inp in inputs]


def points(G, smax):
    """Official conversion: 100 * min(1, ln G / ln S_max), one decimal place."""
    raw = 100.0 * min(1.0, max(0.0, math.log(G) / math.log(smax)))
    return float(Decimal(repr(raw)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))


def geomean(values):
    return math.exp(statistics.fmean(math.log(v) for v in values))


def health_check(suite, weak_ms):
    """Compare this session's weak times with those recorded in validation.json."""
    try:
        recorded = json.loads((suite / 'validation.json').read_text(encoding='utf-8'))['weak_baseline_medians_ms']
    except (OSError, KeyError, ValueError):
        return {'ok': False, 'warnings': ['validation.json has no weak_baseline_medians_ms']}
    ratios, warnings = {}, []
    for case, w in weak_ms.items():
        ref = recorded.get(case)
        if ref is None or w is None:
            warnings.append(f'{case}: no weak time to compare')
            continue
        ratios[case] = w / ref
        if abs(w / ref - 1) > HEALTH_PER_INPUT:
            warnings.append(f'{case}: weak time {w:.3f} ms is {100 * (w / ref - 1):+.1f}% '
                            f'from the recorded {ref:.3f} ms (limit {100 * HEALTH_PER_INPUT:.0f}%)')
    gm = geomean(ratios.values()) if ratios else None
    if gm is not None and abs(gm - 1) > HEALTH_GEOMEAN:
        warnings.append(f'weak times are {100 * (gm - 1):+.1f}% from validation.json in geometric mean '
                        f'(limit {100 * HEALTH_GEOMEAN:.0f}%)')
    return {'ok': not warnings, 'weak_ratio_to_recorded': ratios, 'geomean_ratio': gm, 'warnings': warnings}


def evaluate(args):
    task = TASKS[args.task]
    suite = ROOT / task['folder']
    timer = task['timer']
    exe = Path(args.exe).resolve(strict=True)
    weak = Path(args.weak).resolve(strict=True) if args.weak else None
    strong = Path(args.strong).resolve(strict=True) if args.strong else None
    if (weak is None or strong is None) and not args.correctness_only:
        raise SystemExit('--weak and --strong are required unless --correctness-only is given')
    smax = args.smax if args.smax is not None else task['smax']
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {'task': args.task, 'started': time.strftime('%Y-%m-%d %H:%M:%S'),
              'exe': str(exe), 'weak_exe': str(weak) if weak else None,
              'strong_exe': str(strong) if strong else None, 'pause_s': args.pause,
              'affinity_mask': hex(args.affinity), 'process_timeout_s': PROCESS_TIMEOUT_S, 's_max': smax,
              'official': not args.correctness_only and smax == task['smax'],
              'correctness': [], 'performance': []}
    save = lambda: report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    def run(role_exe, inp, expected):
        time.sleep(args.pause)
        return run_once(role_exe, inp, expected, timer, args.affinity)

    # 1. Candidate correctness inputs, one process each.
    for inp, expected in cases(suite / 'correctness', 7, 'correctness'):
        r = run(exe, inp, expected)
        report['correctness'].append({'case': inp.stem, 'passed': r['status'] == 'PASS', 'run': r})
        print(f"correctness/{inp.stem}: {r['status']}", flush=True)
        save()
    failed = [x['case'] for x in report['correctness'] if not x['passed']]
    report['correctness_passed'] = 7 - len(failed)
    zero = [f'correctness input {c} failed' for c in failed]

    # 2. Performance inputs: weak baseline, then strong baseline, then the candidate, once each.
    session_errors, perf, clamped = [], {}, []
    if not args.correctness_only and not failed:
        perf_cases = cases(suite / 'performance', 8, 'performance')
        for role, role_exe in (('weak', weak), ('strong', strong), ('candidate', exe)):
            for inp, expected in perf_cases:
                r = run(role_exe, inp, expected)
                perf.setdefault(inp.stem, {'case': inp.stem})[role] = r
                print(f"{role}/{inp.stem}: {r['status']} {r['time_ms']} ms", flush=True)
                if r['status'] != 'PASS':
                    if role == 'weak': session_errors.append(f"weak baseline failed on {inp.stem}: {r['status']}")
                    if role == 'candidate': zero.append(f"{inp.stem} candidate: {r['status']}")
                report['performance'] = list(perf.values())
                save()
        for item in perf.values():
            W = item['weak']['time_ms'] if item['weak']['status'] == 'PASS' else None
            S = item['strong']['time_ms'] if item['strong']['status'] == 'PASS' else None
            C = item['candidate']['time_ms'] if item['candidate']['status'] == 'PASS' else None
            if W is not None and W < MIN_MS:
                session_errors.append(f"weak baseline reported {W:.3f} ms on {item['case']}")
                W = None
            if C is not None and C < MIN_MS: clamped.append(item['case'])
            item.update(W_i_ms=W, strong_ms=S, C_i_ms=C,
                        s_i=W / max(C, MIN_MS) if W is not None and C is not None else None,
                        strong_speedup=W / max(S, MIN_MS) if W is not None and S is not None else None)
            if W is not None and C is not None and C > W:
                zero.append(f"{item['case']}: candidate {C:.3f} ms > weak {W:.3f} ms")

    # 3. Metric and score.
    items = list(perf.values())
    report['performance'] = items
    report['performance_passed'] = sum(x['candidate']['status'] == 'PASS' for x in items)
    speedups = [x['s_i'] for x in items]
    G = geomean(speedups) if len(items) == 8 and None not in speedups else None
    report['G'] = G
    report['session_valid'] = not session_errors
    report['session_errors'] = session_errors
    report['zero_score'] = bool(zero)
    report['zero_score_reasons'] = zero
    report['manual_review_required'] = False
    if args.correctness_only:
        report['score'] = None
    elif zero:
        report['score'] = 0.0
    elif session_errors or G is None:
        report['score'] = None  # the weak baseline itself failed: the session must be repeated
    else:
        report['score'] = points(G, smax)
        notes = ['G 达到或超过 S_max'] if G >= smax else []
        if clamped: notes.append(f"提交在 {', '.join(clamped)} 上的计时低于 {MIN_MS} ms，已按 {MIN_MS} ms 计算")
        report['manual_review_required'] = bool(notes)
        if notes: report['manual_review_note'] = '需人工复核：' + '；'.join(notes)
    report['official'] = report['official'] and not session_errors
    report['summary'] = [{'case': x['case'], 'W_i_ms': x['W_i_ms'], 'strong_ms': x['strong_ms'],
                          'C_i_ms': x['C_i_ms'], 's_i': x['s_i']} for x in items]
    strong_speedups = [x['strong_speedup'] for x in items]
    if len(items) == 8 and None not in strong_speedups:
        report['strong_G'] = geomean(strong_speedups)
        report['strong_score'] = points(report['strong_G'], smax)
    if items:
        report['health'] = health_check(suite, {x['case']: x['W_i_ms'] for x in items})
        for w in report['health']['warnings']: print('HEALTH WARNING: ' + w, flush=True)
    report['finished'] = time.strftime('%Y-%m-%d %H:%M:%S')
    save()
    print(json.dumps({k: report.get(k) for k in ('correctness_passed', 'performance_passed', 'G', 's_max', 'score',
                                                 'strong_G', 'strong_score', 'zero_score_reasons',
                                                 'session_errors', 'manual_review_required', 'official')},
                     ensure_ascii=False), flush=True)
    if session_errors: return 2
    if args.correctness_only: return 1 if failed else 0
    return 0 if report['score'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--task', required=True, choices=TASKS)
    parser.add_argument('--exe', required=True, help='compiled grader + candidate solution')
    parser.add_argument('--weak', help='compiled grader + baselines/weak_solution (required for performance)')
    parser.add_argument('--strong', help='compiled grader + baselines/strong_solution (required for performance, '
                                         'reported for reference only)')
    parser.add_argument('--report', required=True)
    parser.add_argument('--pause', type=float, default=0.0, help='seconds slept before every run')
    parser.add_argument('--smax', type=float, help='override S_max (diagnostic only; the report is then not official)')
    parser.add_argument('--affinity', type=lambda s: int(s, 0), default=0xffff)
    parser.add_argument('--correctness-only', action='store_true')
    raise SystemExit(evaluate(parser.parse_args()))
