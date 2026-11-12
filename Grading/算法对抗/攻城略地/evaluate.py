"""Run the scoring matches or a development sparring calibration (stdlib only)."""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
BOT_LABEL = "candidate"
SCHEMA = "siege-evaluation-v2"
BOOTSTRAP_SAMPLES = 1000
BOOTSTRAP_SEED = 0


@dataclass(frozen=True)
class Opponent:
    id: str
    name: str
    rating: float
    score: float
    source: Path
    defines: tuple[str, ...]


def finite_number(value, field):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{field} 必须是有限数字")
    return float(value)


def load_baselines(path):
    path = Path(path).resolve()
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or data.get("schema") != "siege-baselines-v2":
        raise ValueError("baselines.json 的 schema 应为 siege-baselines-v2（96图单局、最强档80分）")
    rows = data.get("opponents")
    if not isinstance(rows, list) or not 2 <= len(rows) <= 5:
        raise ValueError("baselines.json 需要2到5个对手，按实力从弱到强排列")
    opponents = []
    seen = set()
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError("每个 opponent 必须是对象")
        identity = row.get("id", "")
        if not isinstance(identity, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", identity):
            raise ValueError("opponent.id 只能含英文字母、数字、下划线或连字符")
        if identity in seen or identity == BOT_LABEL:
            raise ValueError(f"重复或保留的 opponent.id: {identity}")
        seen.add(identity)
        name = row.get("name", identity)
        if not isinstance(name, str) or not name or "\n" in name or "\r" in name:
            raise ValueError("opponent.name 必须是非空单行文本")
        rating = finite_number(row.get("rating"), f"opponents[{index}].rating")
        score = finite_number(row.get("score"), f"opponents[{index}].score")
        if score != (10 if index == 0 else 20 * index):
            raise ValueError("对手分数锚点应依次为10、20、40、60、80；0分另在第1档-200处，100分另在第5档+200处")
        if not 0 <= score <= 100:
            raise ValueError("分数锚点必须在0到100内")
        if opponents and (rating <= opponents[-1].rating or score <= opponents[-1].score):
            raise ValueError("rating 和 score 都必须按配置顺序严格递增")
        source = row.get("source")
        if not isinstance(source, str) or not source:
            raise ValueError("每个对手需要 source 源文件路径")
        source = Path(source)
        if not source.is_absolute():
            source = path.parent / source
        source = source.resolve()
        if not source.is_file():
            raise ValueError(f"对手 {identity} 的源文件不存在: {source}")
        defines = row.get("defines", {})
        if not isinstance(defines, dict):
            raise ValueError("defines 必须是宏名到宏值的对象")
        flags = []
        for key, value in defines.items():
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                raise ValueError(f"无效编译宏名称: {key}")
            if isinstance(value, bool) or not isinstance(value, (str, int, float)):
                raise ValueError(f"编译宏 {key} 的值应为文本或数字")
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError(f"编译宏 {key} 的值不是有限数字")
            if "\n" in str(value) or "\r" in str(value):
                raise ValueError("编译宏不能含换行")
            flags.append(f"-D{key}={value}")
        opponents.append(Opponent(identity, name, rating, score, source, tuple(flags)))
    return opponents


def parse_ranges(value):
    values = []
    for item in value.split(","):
        match = re.fullmatch(r"\s*(-?\d+)(?:-(-?\d+))?\s*", item)
        if not match:
            raise argparse.ArgumentTypeError("使用例如100000-100019或24-27的写法")
        first = int(match[1])
        last = int(match[2]) if match[2] is not None else first
        if last < first or last - first > 10000:
            raise argparse.ArgumentTypeError("范围倒置或过大")
        values.extend(range(first, last + 1))
    if not values or len(values) != len(set(values)):
        raise argparse.ArgumentTypeError("范围不能为空或含重复值")
    return values


def load_official_seeds(path):
    data = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    seeds = data.get("seeds") if isinstance(data, dict) else None
    if (not isinstance(seeds, list) or len(seeds) != 96
            or any(isinstance(s, bool) or not isinstance(s, int) for s in seeds)
            or len(set(seeds)) != 96):
        raise ValueError("seeds.json 应为含96个不同整数种子的对象 {\"seeds\": [...]}")
    return seeds


def win_probability(rating, opponent_rating):
    exponent = (opponent_rating - rating) * (math.log(10) / 400)
    if exponent >= 0:
        value = math.exp(-exponent)
        return value / (1 + value)
    value = math.exp(exponent)
    return 1 / (1 + value)


def infer_rating(ratings, counts, points):
    if not ratings or len(ratings) != len(counts) or any(n < 0 for n in counts):
        raise ValueError("无效的实力值观测")
    total = sum(counts)
    if total <= 0 or not math.isfinite(points) or not 0 <= points <= total:
        raise ValueError("无效的对局得分")
    low, high = min(ratings) - 200, max(ratings) + 200
    def expected(value):
        return math.fsum(n * win_probability(value, r) for r, n in zip(ratings, counts))
    if points <= expected(low):
        return low
    if points >= expected(high):
        return high
    for _ in range(80):
        middle = low / 2 + high / 2
        if expected(middle) < points:
            low = middle
        else:
            high = middle
    return low / 2 + high / 2


def score_for_rating(rating, opponents):
    # R1-200 (0 points) and R5+200 (100 points) are score points, not extra opponents.
    if len(opponents) == 5 and rating >= opponents[-1].rating:
        fraction = min(1.0, max(0.0, (rating - opponents[-1].rating) / 200))
        return 80.0 + 20.0 * fraction
    if rating <= opponents[0].rating:
        if len(opponents) != 5:
            return opponents[0].score
        fraction = min(1.0, max(0.0, (rating - (opponents[0].rating - 200)) / 200))
        return opponents[0].score * fraction
    for left, right in zip(opponents, opponents[1:]):
        if rating <= right.rating:
            fraction = (rating - left.rating) / (right.rating - left.rating)
            return left.score + fraction * (right.score - left.score)
    return opponents[-1].score


def rounded_score(value):
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


class BootstrapRng:
    """Explicit SplitMix64, independent of Python's random-library implementation."""
    def __init__(self, seed):
        self.state = seed & ((1 << 64) - 1)

    def below(self, size):
        mask = (1 << 64) - 1
        limit = (1 << 64) - ((1 << 64) % size)
        while True:
            self.state = (self.state + 0x9E3779B97F4A7C15) & mask
            value = self.state
            value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & mask
            value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & mask
            value ^= value >> 31
            if value < limit:
                return value % size


def percentile(sorted_values, probability):
    index = (len(sorted_values) - 1) * probability
    left = math.floor(index)
    right = math.ceil(index)
    return sorted_values[left] + (sorted_values[right] - sorted_values[left]) * (index - left)


def bootstrap_intervals(map_points, opponents, samples=BOOTSTRAP_SAMPLES, seed=BOOTSTRAP_SEED):
    if not map_points or samples < 1:
        raise ValueError("重抽样需要至少一张地图和一次抽样")
    size = len(map_points)
    counts = [size] * len(opponents)
    ratings = [o.rating for o in opponents]
    rng = BootstrapRng(seed)
    cached = {}
    rating_samples, score_samples = [], []
    for _ in range(samples):
        # A selected map brings its recorded game against every configured tier.
        # Its original seat stays attached; resampling does not alternate anew.
        points = math.fsum(map_points[rng.below(size)] for _ in range(size))
        if points not in cached:
            r = infer_rating(ratings, counts, points)
            cached[points] = (r, score_for_rating(r, opponents))
        r, score = cached[points]
        rating_samples.append(r)
        score_samples.append(score)
    rating_samples.sort()
    score_samples.sort()
    return ([percentile(rating_samples, q) for q in (0.025, 0.975)],
            [percentile(score_samples, q) for q in (0.025, 0.975)])


def summarize(games, opponents, seeds):
    identities = {o.id for o in opponents}
    by_id = {o.id: dict(id=o.id, name=o.name, rating=o.rating, score_anchor=o.score,
        games=0, wins=0, draws=0, losses=0, points=0.0, cpu_timeout_turns=0,
        forfeit_losses=0, penalty_games=0, opponent_cpu_timeout_turns=0,
        opponent_forfeit_losses=0, opponent_penalty_games=0, simultaneous_forfeit_draws=0)
        for o in opponents}
    blocks = {seed: [] for seed in seeds}
    seats = {seed: index % 2 for index, seed in enumerate(seeds)}
    seen = set()
    bot_reasons, opponent_reasons = Counter(), Counter()
    for game in games:
        labels = game["labels"]
        if len(labels) != 2 or labels.count(BOT_LABEL) != 1:
            raise ValueError("对局摘要的受测程序席位不正确")
        seat = labels.index(BOT_LABEL)
        identity = labels[1 - seat]
        seed = game["seed"]
        key = (seed, identity, seat)
        if identity not in identities or seed not in blocks or key in seen:
            raise ValueError("对局摘要含未知对手、地图或重复的图/对手/座位")
        if seat != seats[seed]:
            raise ValueError("座位不符合地图顺序：奇数图提交为甲方，偶数图为乙方")
        seen.add(key)
        points = game["score"][seat]
        if points not in (0, 0.5, 1) or game["score"][1 - seat] != 1 - points:
            raise ValueError("对局摘要的得分无效")
        row = by_id[identity]
        row["games"] += 1
        row[{1: "wins", 0.5: "draws", 0: "losses"}[points]] += 1
        row["points"] += points
        blocks[seed].append(points)
        row["cpu_timeout_turns"] += game["cpu_timeouts"][seat]
        row["opponent_cpu_timeout_turns"] += game["cpu_timeouts"][1 - seat]
        mine, theirs = game["forfeits"][seat], game["forfeits"][1 - seat]
        row["penalty_games"] += int(mine is not None)
        row["opponent_penalty_games"] += int(theirs is not None)
        row["forfeit_losses"] += int(mine is not None and points == 0)
        row["opponent_forfeit_losses"] += int(theirs is not None and points == 1)
        row["simultaneous_forfeit_draws"] += int(mine is not None and theirs is not None and points == 0.5)
        if mine is not None:
            bot_reasons[mine] += 1
        if theirs is not None:
            opponent_reasons[theirs] += 1
    expected = len(opponents) * len(seeds)
    if len(seen) != expected or any(len(v) != len(opponents) for v in blocks.values()):
        raise ValueError(f"对局不完整，期望{expected}局，实际{len(seen)}局；不计算分数")
    rows = [by_id[o.id] for o in opponents]
    counts = [row["games"] for row in rows]
    points = math.fsum(row["points"] for row in rows)
    r = infer_rating([o.rating for o in opponents], counts, points)
    raw_score = score_for_rating(r, opponents)
    rating_ci, score_ci = bootstrap_intervals([math.fsum(blocks[s]) for s in sorted(seeds)], opponents)
    totals = {key: sum(row[key] for row in rows) for key in (
        "wins", "draws", "losses", "cpu_timeout_turns", "forfeit_losses", "penalty_games",
        "opponent_cpu_timeout_turns", "opponent_forfeit_losses", "opponent_penalty_games",
        "simultaneous_forfeit_draws")}
    return dict(score=rounded_score(raw_score), score_raw=raw_score,
        score_ci95=[rounded_score(v) for v in score_ci], score_ci95_raw=score_ci,
        r=r, rating_ci95=rating_ci, rating_bounds=[opponents[0].rating - 200, opponents[-1].rating + 200],
        total_games=len(games), total_points=points, by_opponent=rows, **totals,
        penalty_reasons=dict(bot=dict(bot_reasons), opponents=dict(opponent_reasons)),
        bootstrap=dict(samples=BOOTSTRAP_SAMPLES, unit="map", seed=BOOTSTRAP_SEED,
            rng="SplitMix64-v1", confidence=0.95, percentile_interpolation="linear"),
        seat_schedule="map_index_0_based_even_candidate_A_odd_candidate_B",
        full_score_rating=opponents[-1].rating + 200 if len(opponents) == 5 else None,
        score_rounding="decimal_half_up_0.1")


def compile_opponents(opponents, work_dir):
    from judge_core import PUBLIC_KIT
    from referee_core import COMPILER, process_env
    directory = Path(work_dir) / "opponents"
    directory.mkdir(parents=True, exist_ok=True)
    executables = {}
    for opponent in opponents:
        output = directory / f"opponent_{opponent.id}.exe"
        command = [str(COMPILER), "-O2", "-std=c++20", "-I" + str(PUBLIC_KIT),
            *opponent.defines, "-o", output.name, str(PUBLIC_KIT / "main.cpp"), str(opponent.source)]
        result = subprocess.run(command, cwd=directory, env=process_env(), capture_output=True)
        if result.returncode:
            # Keep compiler diagnostics out of the sparring author's table/report.
            # They can include source excerpts; only the coordinator/baseline author
            # should inspect this build diagnostic when investigating a failure.
            (directory / f"{opponent.id}.compiler-error.txt").write_bytes(result.stdout + result.stderr)
            raise RuntimeError(f"对手 {opponent.id} 编译失败，退出码{result.returncode}；请联系指挥")
        executables[opponent.id] = output.resolve()
    return executables


def make_matches(bot, opponents, seeds, executables):
    from judge_core import Match
    matches = []
    for index, seed in enumerate(seeds):
        for opponent in opponents:
            executable = str(executables[opponent.id])
            if index % 2 == 0:
                matches.append(Match(seed, str(bot), executable, (BOT_LABEL, opponent.id),
                    display_names=(Path(bot).stem, opponent.name)))
            else:
                matches.append(Match(seed, executable, str(bot), (opponent.id, BOT_LABEL),
                    display_names=(opponent.name, Path(bot).stem)))
    return matches


def write_report(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def run_evaluation(args):
    from judge_core import run_matches
    from winproc import process_affinity
    report_path = args.report.resolve()
    development = args.seeds is not None
    work_dir = (args.work_dir or report_path.parent / (report_path.stem + "_work")).resolve()
    report = dict(schema=SCHEMA, status="running", mode="development" if development else "official",
        bot=str(args.bot.resolve()), baselines=str(args.baselines.resolve()), work_dir=str(work_dir),
        cpus=args.cpus, jobs=args.jobs, pid=os.getpid(), report=str(report_path), stage="configuration")
    completed = []
    try:
        with process_affinity(args.cpus):
            write_report(report_path, report)
            if not args.bot.is_file():
                raise ValueError(f"受测可执行文件不存在: {args.bot}")
            opponents = load_baselines(args.baselines)
            seeds = args.seeds if development else load_official_seeds(HERE / "seeds.json")
            if development and any(not 100000 <= seed <= 100999 for seed in seeds):
                raise ValueError("开发/陪练对准种子限100000–100999")
            report.update(seeds=seeds, map_count=len(seeds),
                expected_games=len(opponents) * len(seeds),
                opponents=[dict(id=o.id, name=o.name, rating=o.rating, score=o.score) for o in opponents])
            report["is_official_configuration"] = (not development and len(opponents) == 5
                and [o.score for o in opponents] == [10, 20, 40, 60, 80]
                and args.cpus == list(range(16)) and args.jobs == 8)
            report["stage"] = "compile_opponents"
            write_report(report_path, report)
            executables = compile_opponents(opponents, work_dir)
            matches = make_matches(args.bot.resolve(), opponents, seeds, executables)
            report["stage"] = "matches"
            write_report(report_path, report)
            games = run_matches(matches, cpus=args.cpus, jobs=args.jobs, build_dir=work_dir / "referee",
                calibration_path=args.calibration.resolve(), log_dir=None, time_scale=1.0,
                on_result=completed.append)
            report["stage"] = "scoring"
            report.update(summarize(games, opponents, seeds))
            calibration = json.loads(args.calibration.read_text(encoding="utf-8-sig"))
            report["cycles_per_ms"] = {str(cpu): calibration["cpus"][str(cpu)]["cycles_per_ms"]
                for cpu in args.cpus[:2 * args.jobs]}
            report.update(status="complete", stage="complete", games=games)
            write_report(report_path, report)
    except (Exception, KeyboardInterrupt) as error:
        report.update(status="interrupted" if isinstance(error, KeyboardInterrupt) else "error",
            error=f"{type(error).__name__}: {error}", completed_games=len(completed), games=completed)
        # An incomplete run is never reported as a score or automatically retried.
        for key in ("score", "score_raw", "score_ci95", "score_ci95_raw", "r", "rating_ci95"):
            report.pop(key, None)
        write_report(report_path, report)
        raise
    return report


def print_summary(report):
    title = "开发对准成绩" if report["mode"] == "development" else (
        "评测成绩" if report["is_official_configuration"] else "非正式配置的评测成绩")
    print(title)
    print("对手\t胜\t平\t负\t得分/局数")
    for row in report["by_opponent"]:
        print(f"{row['name']}\t{row['wins']}\t{row['draws']}\t{row['losses']}\t{row['points']:g}/{row['games']}")
    print(f"实力值 r={report['r']:.6f}，范围 [{report['rating_bounds'][0]:.6f}, {report['rating_bounds'][1]:.6f}]")
    if report["mode"] == "official":
        print(f"得分 {report['score']:.1f}，95%区间 [{report['score_ci95'][0]:.1f}, {report['score_ci95'][1]:.1f}]")
    print(f"受测程序 CPU超时回合={report['cpu_timeout_turns']}，判负局数={report['forfeit_losses']}")
    if report["opponent_penalty_games"] or report["simultaneous_forfeit_draws"]:
        print(f"对手触发判罚局数={report['opponent_penalty_games']}，双方同时判罚平局={report['simultaneous_forfeit_draws']}")
    print(f"报告：{report['report']}")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bot", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--baselines", type=Path, default=HERE / "baselines.json")
    parser.add_argument("--seeds", type=parse_ranges,
        help="开发/陪练种子范围，例如100000-100199；不填则使用正式seeds.json")
    parser.add_argument("--cpus", type=parse_ranges, help="逻辑处理器范围，例如24-27")
    parser.add_argument("--jobs", type=int)
    parser.add_argument("--work-dir", type=Path, help="编译与裁判缓存目录，默认报告同级的<报告名>_work")
    parser.add_argument("--calibration", type=Path, default=HERE / "cycles.json")
    args = parser.parse_args(argv)
    if args.seeds is not None and (args.cpus is None or args.jobs is None):
        parser.error("开发/陪练入口需同时明确 --seeds、--cpus、--jobs")
    args.cpus = args.cpus if args.cpus is not None else list(range(16))
    args.jobs = args.jobs if args.jobs is not None else 8
    if args.jobs < 1 or len(args.cpus) < 2 * args.jobs or any(cpu < 0 for cpu in args.cpus):
        parser.error("每局需两个独占逻辑处理器；CPU数量至少为并行局数两倍")
    if args.seeds is not None and any(not 100000 <= seed <= 100999 for seed in args.seeds):
        parser.error("开发/陪练种子限100000–100999")
    return args


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    args = parse_args(argv)
    try:
        report = run_evaluation(args)
    except KeyboardInterrupt:
        print(f"对局已中断，不计分。报告：{args.report.resolve()}", file=sys.stderr)
        return 130
    except Exception as error:
        print(f"评测未完成：{error}\n报告：{args.report.resolve()}", file=sys.stderr)
        return 2
    print_summary(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
