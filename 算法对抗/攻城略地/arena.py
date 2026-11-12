"""Local paired matches. Example: python 数据\arena.py bot.exe sample.exe --seeds 1-20"""
import argparse
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True

from referee_core import Match, run_matches, build_bridge, load_calibration
from winproc import allowed_cpus

def numbers(text):
    values = []
    for part in text.split(","):
        part = part.strip()
        if "-" in part[1:]:
            start,end = part[1:].split("-",1) if part.startswith("-") else part.split("-",1)
            start = -int(start) if part.startswith("-") else int(start)
            end = int(end)
            if end<start:
                raise argparse.ArgumentTypeError("range end must be >= start")
            values.extend(range(start,end+1))
        else:
            values.append(int(part))
    if not values or len(values)!=len(set(values)):
        raise argparse.ArgumentTypeError("empty or duplicate seed/CPU")
    return values

def print_game(r):
    winner = r["winner_label"] or "draw"
    labels = r["labels"]
    print(f"seed={r['seed']} seats={labels[0]}/{labels[1]} winner={winner} "
          f"turns={r['turns']} troops={r['totals'][0]}/{r['totals'][1]} "
          f"max_cpu_ms={r['max_turn_cpu_ms'][0]:.3f}/{r['max_turn_cpu_ms'][1]:.3f} "
          f"reason={r['reason']} forfeits={r['forfeits']}",flush=True)

def main():
    for stream in (sys.stdout,sys.stderr):
        if hasattr(stream,"reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bot_a",nargs="?")
    parser.add_argument("bot_b",nargs="?")
    parser.add_argument("--seeds",type=numbers,default=numbers("1-20"))
    parser.add_argument("--cpus",type=numbers,help="exclusive logical CPUs, e.g. 0-15")
    parser.add_argument("--jobs",type=int,default=1)
    parser.add_argument("--log-dir",help="save one JSONL file per game")
    parser.add_argument("--report",help="save machine-readable game summaries")
    parser.add_argument("--build-dir",default=str(Path.cwd()/".arena_cache"))
    parser.add_argument("--calibration",help="cycle conversion JSON; auto-calibrate missing CPUs")
    parser.add_argument("--calibrate",action="store_true",help="remeasure requested CPUs then exit")
    parser.add_argument("--time-scale",type=float,default=1.0,help="development CPU budget multiplier; official value is 1")
    parser.add_argument("--name-a",help="human-readable name for program A")
    parser.add_argument("--name-b",help="human-readable name for program B")
    args = parser.parse_args()
    cpus = args.cpus if args.cpus is not None else allowed_cpus()[:2*args.jobs]
    if args.calibrate:
        bridge = build_bridge(args.build_dir)
        path = args.calibration or str(Path(args.build_dir)/"cycles.json")
        data = load_calibration(bridge,cpus,path,force=True)
        for cpu in cpus:
            print(f"cpu={cpu} cycles_per_ms={data['cpus'][str(cpu)]['cycles_per_ms']:.6f}")
        print(f"calibration={Path(path).resolve()}")
        return
    if not args.bot_a or not args.bot_b:
        parser.error("provide two executables, or use --calibrate")
    for exe in (args.bot_a,args.bot_b):
        if not Path(exe).is_file():
            parser.error(f"executable does not exist: {exe}")
    matches = []
    for seed in args.seeds:
        display=(args.name_a or Path(args.bot_a).stem,args.name_b or Path(args.bot_b).stem)
        matches.append(Match(seed,args.bot_a,args.bot_b,("A","B"),display_names=display))
        matches.append(Match(seed,args.bot_b,args.bot_a,("B","A"),display_names=display[::-1]))
    results = run_matches(matches,cpus=cpus,jobs=args.jobs,build_dir=args.build_dir,
        calibration_path=args.calibration,log_dir=args.log_dir,time_scale=args.time_scale,on_result=print_game)
    score_a = sum(r["score"][r["labels"].index("A")] for r in results)
    print(f"A_score={score_a:g}/{len(results)} B_score={len(results)-score_a:g}/{len(results)}")
    if args.report:
        Path(args.report).write_text(json.dumps(dict(games=results),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
    main()
