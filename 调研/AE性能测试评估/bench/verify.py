"""独立核对代表媒体、结果完整性、代码语法及报告链接；不启动浏览器。"""
import json,os,subprocess,hashlib,re
from pathlib import Path
root=Path(__file__).parent
rows=json.loads((root/'practical-results.json').read_text(encoding='utf-8'))
exports=[r['value'] for r in rows if r['kind']=='export']
assert len(exports)==24
assert all(v['chunks']==600 and v['frames']==600 and v['error']==0 and not v['fail'] and min(v['psnr'].values())>=35 for v in exports)
edit=[r['value'] for r in rows if r['kind']=='edit']
assert len(edit)==3
assert all(v['N']==65536 and v['keys']==589824 and len(v['steps'])==20 and len(v['copies'])==8 and v['validEase'] and v['validFinal'] and all(c['valid'] for c in v['copies']) for v in edit)
media=Path(os.environ['TEMP'])/'ae-sol-performance-media'
probe=[]
for scene,angle in [('A',180),('B',180),('C',180),('C',360)]:
    p=media/f'normal-0-{scene}-1920x1080-{angle}-h264.mp4'
    args=['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_read_frames,duration','-of','json',str(p)]
    r=json.loads(subprocess.check_output(args,encoding='utf-8'));s=r['streams'][0]
    assert s['width']==1920 and s['height']==1080 and int(s['nb_read_frames'])==600 and s['r_frame_rate']=='60/1' and abs(float(s['duration'])-10)<.001
    probe.append({'文件':str(p),'SHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'ffprobe':r})
(root/'ffprobe-results.json').write_text(json.dumps(probe,ensure_ascii=False,indent=2),encoding='utf-8')
for p in list(root.glob('*.js'))+list(root.glob('*.cjs')):subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
report=root.parent/'AE性能测试评估_Sol.md'
text=report.read_text(encoding='utf-8')
broken=[]
for target in re.findall(r'\]\(([^)]+)\)',text):
    if target.startswith(('http:','https:','#')):continue
    if not (report.parent/target).exists():broken.append(target)
assert not broken,broken
strict_path=root/'strict-results.json'
if strict_path.exists():
    strict=json.loads(strict_path.read_text(encoding='utf-8'))
    e=[r['value'] for r in strict if r['kind']=='export']
    assert len(e)==8 and all(x['chunks']==600 and min(x['psnr'].values())>=35 for x in e)
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob('*') if p.is_file() and p.suffix in ('.js','.cjs','.py','.html')}
(root/'代码SHA256.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'三轮完整导出次数':len(exports),'编辑轮数':len(edit),'独立视频核对数':len(probe),'本地链接失效数':len(broken),'语法检查':'通过'},ensure_ascii=False))
