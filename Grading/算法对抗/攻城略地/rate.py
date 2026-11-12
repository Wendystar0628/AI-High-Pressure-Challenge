"""Bradley-Terry fit for development/official round-robin result JSON (stdlib)."""
import argparse
import json
import math
import os
from pathlib import Path

def fit(games, names=None, anchor=None, ridge=0.0):
    names=sorted(set(names or (name for g in games for name in g['labels'])))
    if len(names)<2: raise ValueError('need at least two players')
    index={name:i for i,name in enumerate(names)}
    counts={}
    adjacency=[set() for _ in names]
    for g in games:
        a,b=map(index.__getitem__,g['labels'])
        if a==b: continue
        score=g.get('score')
        if score is None:
            winner=g['winner']; score=[1,0] if winner==1 else ([0,1] if winner==2 else [0.5,0.5])
        if abs(sum(score)-1)>1e-9 or any(not 0<=s<=1 for s in score):
            raise ValueError('scores must be in [0,1] and sum to one')
        if a>b:a,b=b,a;score=score[::-1]
        count,total=counts.get((a,b),(0,0.0))
        counts[a,b]=(count+1,total+float(score[0]))
        adjacency[a].add(b);adjacency[b].add(a)
    connected={0}
    while True:
        expanded=connected|set().union(*(adjacency[i] for i in connected))
        if expanded==connected: break
        connected=expanded
    if len(connected)!=len(names): raise ValueError('comparison graph is disconnected')
    observations=[(a,b,count,total) for (a,b),(count,total) in counts.items()]
    directed=[set() for _ in names]
    for a,b,count,total in observations:
        if total>0:directed[a].add(b)
        if total<count:directed[b].add(a)
    finite=True
    for start in range(len(names)):
        reached={start}
        while True:
            expanded=reached|set().union(*(directed[i] for i in reached))
            if expanded==reached:break
            reached=expanded
        finite=finite and len(reached)==len(names)
    if not finite and ridge==0:
        raise ValueError('unregularized finite MLE does not exist (complete separation); collect overlapping results or explicitly use --ridge')
    # Coordinate maximization, with the common additive constant centered away.
    ratings=[0.0]*len(names)
    converged=False
    for iteration in range(20000):
        largest=0
        for i in range(len(names)):
            gradient=-ridge*ratings[i]; curvature=ridge
            for a,b,count,total in observations:
                if i not in (a,b): continue
                delta=max(-40,min(40,ratings[a]-ratings[b]))
                p=1/(1+math.exp(-delta))
                gradient+=(total-count*p)*(1 if i==a else -1)
                curvature+=count*p*(1-p)
            change=max(-1.0,min(1.0,gradient/max(curvature,1e-15)))
            ratings[i]+=change; largest=max(largest,abs(change))
        center=sum(ratings)/len(ratings)
        ratings=[v-center for v in ratings]
        if largest<1e-10:
            converged=True; break
    offset=ratings[index[anchor or names[0]]]
    elo={name:(ratings[i]-offset)*400/math.log(10) for i,name in enumerate(names)}
    return dict(ratings=elo,anchor=anchor or names[0],converged=converged,
                iterations=iteration+1,ridge=ridge,finite_mle=finite,games=sum(c for a,b,c,t in observations))

def pair_table(games):
    names=sorted({n for g in games for n in g['labels']}); pairs=[]
    for i,a in enumerate(names):
        for b in names[i+1:]:
            wins=draws=losses=0;seeds=set()
            for g in games:
                if set(g['labels'])!={a,b}: continue
                seeds.add(g['seed']); seat=g['labels'].index(a)
                score=g['score'][seat]
                wins+=score==1;draws+=score==0.5;losses+=score==0
            if wins+draws+losses:
                pairs.append(dict(a=a,b=b,wins=wins,draws=draws,losses=losses,maps=len(seeds)))
    return pairs

def export_baselines(games, result, roster_path, output, require_formal=False):
    """Write the five real opponents; R5+200 is the virtual 100-point knot."""
    roster_path=Path(roster_path).resolve();output=Path(output).resolve()
    roster=json.loads(roster_path.read_text(encoding='utf-8-sig'))
    rows=roster['players'] if isinstance(roster,dict) else roster
    if len(rows)!=5 or {p['id'] for p in rows}!=set(result['ratings']):
        raise ValueError('正式基线输出需要同一套五档名册和拟合结果')
    seeds={g['seed'] for g in games};expected=len(seeds)*10
    if len(games)!=expected or len({(g['seed'],tuple(sorted(g['labels']))) for g in games})!=expected:
        raise ValueError('循环赛必须每张图、每对恰好一局，不能换边重复或缺局')
    order={p['id']:i for i,p in enumerate(rows)}
    seed_order=roster.get('seeds',[]) if isinstance(roster,dict) else []
    if require_formal and (len(seeds)!=96 or len(games)!=960 or set(seed_order)!=seeds):
        raise ValueError('正式定分需96张图、每对96局、总计960局，并在名册保留种子顺序')
    if seed_order:
        positions={seed:i for i,seed in enumerate(seed_order)}
        for g in games:
            a,b=g['labels'];lower=a if order[a]<order[b] else b
            if g['labels'].index(lower)!=positions[g['seed']]%2:
                raise ValueError('循环赛座位未按地图顺序交替')
    opponents=[]
    for i,p in enumerate(rows):
        source=Path(p['source'])
        if not source.is_absolute():source=roster_path.parent/source
        try:source_text=os.path.relpath(source.resolve(),output.parent)
        except ValueError:source_text=str(source.resolve())
        value=float(result['ratings'][p['id']])
        if opponents and value<=opponents[-1]['rating']:
            raise ValueError('五档拟合实力值不是严格递增，不写正式基线')
        opponents.append(dict(id=p['id'],name=p.get('name',p['id']),rating=value,score=10 if i == 0 else 20*i,
                              source=source_text,defines=p.get('defines',{})))
    document=dict(schema='siege-baselines-v2',opponents=opponents,
        maps=len(seeds),games=len(games),seat_schedule='map_index_even_lower_A_odd_lower_B',
        score_rule='R1-200=0; 10/20/40/60/80; R5+200=100',anchor=result['anchor'])
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return document

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('reports',nargs='+');p.add_argument('--output');p.add_argument('--anchor')
    p.add_argument('--ridge',type=float,default=0.0)
    p.add_argument('--baselines',help='输出五档正式基线配置（需--roster）')
    p.add_argument('--roster',help='含id/name/source/defines的五档名册')
    p.add_argument('--require-formal',action='store_true',help='写基线时要求96图交替座位的960局完整循环赛')
    args=p.parse_args();games=[]
    for file in args.reports:
        value=json.loads(Path(file).read_text(encoding='utf-8-sig'))
        games.extend(value['games'] if isinstance(value,dict) else value)
    result=fit(games,anchor=args.anchor,ridge=args.ridge);result['pairs']=pair_table(games)
    if args.baselines:
        if not args.roster:p.error('--baselines需要--roster')
        if args.ridge!=0 or not result['converged'] or not result['finite_mle']:
            raise ValueError('正式基线必须用已收敛的无正则有限MLE')
        export_baselines(games,result,args.roster,args.baselines,args.require_formal)
    text=json.dumps(result,ensure_ascii=False,indent=2)
    print(text)
    if args.output:Path(args.output).write_text(text+'\n',encoding='utf-8')

if __name__=='__main__': main()
