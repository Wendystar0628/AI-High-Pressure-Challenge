import json,statistics,math
from pathlib import Path
root=Path(__file__).parent
rows=json.loads((root/'practical-results.json').read_text(encoding='utf-8'))
out={}
for fast in [False,True]:
    label='优化版' if fast else '常规版'
    out[label]={}
    for scene,angle in [('A',180),('B',180),('C',180),('C',360)]:
        a=[r['value'] for r in rows if r['kind']=='export' and r['optimized']==fast and r['value']['scene']==scene and r['value']['angle']==angle]
        if not a:continue
        t=[v['totalMs']/1000 for v in a]
        out[label][scene+str(angle)]={'次数':len(a),'中位秒':statistics.median(t),'最小秒':min(t),'最大秒':max(t),'最小PSNR':min(min(v['psnr'].values()) for v in a),'文件MB':statistics.median([v['bytes']/1e6 for v in a]),'帧数':[v['chunks'] for v in a]}
ed=[r['value'] for r in rows if r['kind']=='edit']
if ed:
    out['编辑']={k:{'中位秒':statistics.median(v[k]/1000 for v in ed),'最小秒':min(v[k]/1000 for v in ed),'最大秒':max(v[k]/1000 for v in ed)} for k in ['task4Ms','task5Ms']}
    out['内存']={'基础堆MB':[v['baseHeap']/1e6 for v in ed],'采样峰值MB':[v['peakHeap']/1e6 for v in ed]}
def score(t,w,t1,t0):return round(w*max(0,min(1,math.log(t0/t)/math.log(t0/t1))),1)
for label in ['常规版','优化版']:
    if len(out[label])<4 or not ed:continue
    times=[out[label][k]['中位秒'] for k in ['A180','B180','C180']]+[out['编辑'][k]['中位秒'] for k in ['task4Ms','task5Ms']]+[out[label]['C360']['中位秒']]
    params=[(2,2.5,9.5),(2,2.5,15),(2,2.5,70),(2,.85,55),(1,1.5,50),(1,2.5,70)]
    out[label]['旧阈值分数']=[score(t,*p) for t,p in zip(times,params)]
    out[label]['六任务纯计时合计秒']=sum(times)
(root/'summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
