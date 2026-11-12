"""Generate the approved garden main input, 12 hidden cases and 3 public boundaries."""
from pathlib import Path
import argparse,json,math,shutil
import numpy as np
from rt_eval import bind_self,SETTINGS
import garden

HERE=Path(__file__).resolve().parent
PUBLIC=HERE.parents[3]/'性能优化/性能工程/光线追踪渲染加速/数据'
DETAIL_KEYS=('seed','water_mirror','ripple','water_n','paving_mirror','bamboo','leaves','lotus','rock_cell','peak_cell','bank_split','tile_pitch','grass','far_trees','pine_tufts')

def camera(P):
    eye,target,fov=garden.CAMS[P['cam']]
    if P['eye']:eye=tuple(map(float,P['eye'].split(',')))
    if P['target']:target=tuple(map(float,P['target'].split(',')))
    if P['fov']>0:fov=P['fov']
    eye=np.array(eye,float);target=np.array(target,float);w=garden.unit(target-eye)
    u=garden.unit(np.cross(w,(0,1,0)));v=np.cross(u,w);f=math.tan(math.radians(fov)/2)
    az,el=math.radians(P['light_azimuth']),math.radians(P['light_elevation'])
    light=np.array([math.sin(az)*math.cos(el),math.sin(el),math.cos(az)*math.cos(el)])
    return dict(eye=eye,u=u*f*P['width']/P['height'],v=v*f,w=w,light=light)

def configurations(main_spp):
    ordinary=dict(width=512,height=288,spp=16,ao=1,depth=4)
    result=[dict(id='garden',kind='performance',name='江南园林',input='inputs/input_01.bin',expected='expected/expected_01.bin',seed=1,cam='A',width=1920,height=1080,spp=main_spp)]
    hidden=[
        dict(seed=2,cam='A'),dict(seed=2,cam='B'),dict(seed=2,cam='C'),dict(seed=2,cam='D',ao=0),
        dict(seed=3,cam='A',ao=64,spp=8),dict(seed=3,cam='B',depth=1),dict(seed=3,cam='C',depth=8),
        dict(seed=3,cam='D',width=608,height=342,spp=1),
        dict(seed=4,cam='B',width=688,height=387,spp=8),dict(seed=4,cam='C',spp=256,light_override=[0,1,0]),
        dict(seed=2,cam='D',spp=8,triangle_limit=1),
        dict(seed=6,cam='A',spp=8,rock_cell=.08,peak_cell=.75,bamboo=80,leaves=1.5,tile_pitch=.18,far_trees=16),
    ]
    for number,extra in enumerate(hidden,1):
        result.append(dict(ordinary,**dict(id=f'hidden_{number:02}',kind='hidden',name=f'园林边界 {number}',input=f'hidden/hidden_{number:02}.bin',expected=f'hidden_expected/expected_{number:02}.bin',**{'for':'garden'}),**extra))
    for number,extra in enumerate([dict(ao=0),dict(depth=1),dict(all_mirror=True,depth=8)],1):
        result.append(dict(ordinary,**dict(id=f'boundary_{number:02}',kind='boundary',name=['无遮挡采样','单层反射','全镜面'][number-1],input=f'boundary/input_{number:02}.bin',expected=f'boundary_expected/expected_{number:02}.bin',seed=1,cam='A'),**extra))
    return result

def generate(main_spp=56):
    cache={};manifest=dict(version=1,status='已接入园林，等待标准答案与正式计时校准',performance=[],hidden=[],boundary=[])
    records=[]
    for case in configurations(main_spp):
        P=garden.DEFAULTS.copy();P.update({k:v for k,v in case.items() if k in P})
        key=tuple(P[k] for k in DETAIL_KEYS)
        if key not in cache:
            tris,_,info=garden.build(P);cache[key]=(tris,info)
            print('generated geometry seed',P['seed'],'triangles',len(tris),flush=True)
        tris,info=cache[key];cam=camera(P)
        if case.get('triangle_limit'):tris=tris[:case['triangle_limit']].copy()
        if case.get('all_mirror'):tris=tris.copy();tris[:,12]=1
        if case.get('light_override'):cam['light']=np.array(case['light_override'],float)
        if not 1<=len(tris)<=1000000 or not np.isfinite(tris).all() or np.abs(tris[:,:9]).max()>32:raise ValueError('scene outside format limits')
        if case['id']=='garden':assert 160000<=len(tris)<=180000
        if case['id']=='hidden_12':assert len(tris)>500000,f'high-detail case has only {len(tris)} triangles'
        path=HERE/case['input'];path.parent.mkdir(parents=True,exist_ok=True);garden.write_scene(path,tris,cam,P)
        row={k:case[k] for k in ('id','name','input','expected')};row.update(width=P['width'],height=P['height'],spp=P['spp'],ao=P['ao'],depth=P['depth'],triangles=len(tris),baseline_exceptions=None,seed=P['seed'],camera=P['cam'])
        if case['kind']=='hidden':row['for']='garden'
        if case['kind']=='performance':row['anchors']=SETTINGS['scoring']['anchors']
        manifest[case['kind']].append(row)
        records.append(dict(case=case,params=P,triangles=len(tris),parts=info['parts']))
        print(case['id'],len(tris),P['width'],P['height'],P['spp'],P['ao'],P['depth'],flush=True)
    (HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (HERE/'generation.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    return manifest

def publish_public():
    manifest=json.loads((HERE/'manifest.json').read_text('utf-8'))
    public=dict(manifest,hidden=[])
    for item in manifest['performance']+manifest['boundary']:
        for key in ('input','expected'):
            source=HERE/item[key];target=PUBLIC/item[key];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
        png=(HERE/item['expected']).with_suffix('.png')
        if png.exists():shutil.copy2(png,(PUBLIC/item['expected']).with_suffix('.png'))
    if (HERE/'standard_sheet.png').exists():shutil.copy2(HERE/'standard_sheet.png',PUBLIC/'standard_sheet.png')
    for f in ('sample.bin','sample_expected.bin','reference.exe'):shutil.copy2(HERE/f,PUBLIC/f)
    (PUBLIC/'manifest.json').write_text(json.dumps(public,ensure_ascii=False,indent=2),encoding='utf-8')
    print('public inputs and answers copied',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--main-spp',type=int,default=56);p.add_argument('--cpus',default='22-23');p.add_argument('--publish',action='store_true');a=p.parse_args();bind_self(a.cpus)
    if a.publish:publish_public()
    else:generate(a.main_spp)
