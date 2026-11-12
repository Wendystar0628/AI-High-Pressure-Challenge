"""Official match driver; evaluate.py can import judge_core.run_matches directly."""
import argparse
import json
import sys
from pathlib import Path
from judge_core import Match, run_matches

def round_robin_matches(players,seeds,base_dir):
    if len({p['id'] for p in players})!=len(players):raise ValueError('名册id重复')
    matches=[]
    for index,seed in enumerate(seeds):
        for i,left in enumerate(players):
            for right in players[i+1:]:
                a,b=(left,right) if index%2==0 else (right,left)
                def executable(p):
                    path=Path(p['executable'])
                    return str(path if path.is_absolute() else Path(base_dir)/path)
                matches.append(Match(seed,executable(a),executable(b),(a['id'],b['id']),
                    display_names=(a.get('name',a['id']),b.get('name',b['id']))))
    return matches

def main():
    for stream in (sys.stdout,sys.stderr):
        if hasattr(stream,"reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--matches",help='显式比赛JSON列表，按列表原样运行')
    group.add_argument("--round-robin",help='名册JSON，生成每图单局、座位交替的循环赛')
    parser.add_argument("--seeds",help='循环赛的开发种子范围；省略时读正式seeds.json')
    parser.add_argument("--seeds-file",default=str(Path(__file__).with_name('seeds.json')))
    parser.add_argument("--report",required=True)
    parser.add_argument("--cpus",default="0-15")
    parser.add_argument("--jobs",type=int,default=8)
    parser.add_argument("--log-dir")
    parser.add_argument("--build-dir",default=str(Path.cwd()/".arena_cache"))
    parser.add_argument("--calibration",default=str(Path(__file__).with_name("cycles.json")))
    parser.add_argument("--time-scale",type=float,default=1.0)
    args = parser.parse_args()
    from arena import numbers
    metadata={}
    if args.round_robin:
        path=Path(args.round_robin).resolve()
        roster=json.loads(path.read_text(encoding='utf-8-sig'))
        players=roster['players'] if isinstance(roster,dict) else roster
        if args.seeds:
            seeds=numbers(args.seeds)
            if any(not 100000<=seed<=100999 for seed in seeds):parser.error('开发种子只用100000–100999')
        else:
            from evaluate import load_official_seeds
            seeds=load_official_seeds(args.seeds_file)
        matches=round_robin_matches(players,seeds,path.parent)
        metadata=dict(mode='round-robin-alternating-single-v1',players=players,seeds=seeds)
    else:
        if args.seeds:parser.error('--seeds仅用于--round-robin')
        values=json.loads(Path(args.matches).read_text(encoding='utf-8-sig'))
        matches=[Match(seed=v['seed'],a=v['a'],b=v['b'],labels=tuple(v.get('labels',['A','B'])),
            name=v.get('name',''),display_names=tuple(v.get('display_names',['','']))) for v in values]
        metadata=dict(mode='explicit-matches')
    results = run_matches(matches,cpus=numbers(args.cpus),jobs=args.jobs,
        build_dir=args.build_dir,calibration_path=args.calibration,log_dir=args.log_dir,time_scale=args.time_scale)
    Path(args.report).parent.mkdir(parents=True,exist_ok=True)
    Path(args.report).write_text(json.dumps(dict(**metadata,games=results),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    from rate import pair_table
    for row in pair_table(results):print(f"{row['a']} / {row['b']}: {row['wins']}/{row['draws']}/{row['losses']} ({row['maps']} maps)")
    print('report='+str(Path(args.report).resolve()))

if __name__=="__main__":
    main()
