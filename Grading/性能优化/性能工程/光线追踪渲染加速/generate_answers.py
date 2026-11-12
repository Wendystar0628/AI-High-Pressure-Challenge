"""Generate answers only after two GPU mappings agree bitwise and CPU probes agree."""
from pathlib import Path
import argparse,json,os,shutil,struct,tempfile,time
import numpy as np
from PIL import Image
from rt_eval import SETTINGS,bind_self,compare,launch,wait_idle

HERE=Path(__file__).resolve().parent

def preview(path,w,h,out):
    rgb=np.maximum(np.fromfile(path,dtype='<f4').reshape(h,w,3).astype(np.float64)*1.25,0)
    rgb=np.clip((rgb*(2.51*rgb+.03))/(rgb*(2.43*rgb+.59)+.14),0,1)**(1/2.2)
    Image.fromarray(np.uint8(np.rint(rgb*255))).save(out)

def run_program(binary,inp,out,cpus,stage,role,extras=(),timeout=120,idle=True):
    exe=stage/(role+'.exe');shutil.copy2(binary,exe)
    if idle and role!='cpu':wait_idle(SETTINGS)
    stdout=stage/(role+'.stdout');stderr=stage/(role+'.stderr')
    with stdout.open('wb') as so,stderr.open('wb') as se:
        env=os.environ.copy();env.pop("RT_ORACLE_DOUBLE_OUTPUT",None)
        if role in ("oracle","verify"):env["RT_ORACLE_DOUBLE_OUTPUT"]=out.with_suffix(".f64").name
        p=launch([exe,inp,out,*map(str,extras)],cpus,SETTINGS['priority'],cwd=stage,env=env,stdout=so,stderr=se)
        try:code=p.wait(timeout=timeout)
        except BaseException:
            if p.poll() is None:p.kill()
            p.wait();raise
    log=stderr.read_text('utf-8',errors='replace')
    if code:raise RuntimeError(f'{role} failed, exit={code}: {log}')
    if not out.exists():raise RuntimeError(f'{role} produced no output')
    return log

def validate_gpu(first,second,pixels):
    a=np.fromfile(first,dtype='<f4');b=np.fromfile(second,dtype='<f4')
    if a.size!=pixels*3 or b.size!=a.size:raise RuntimeError('oracle output size mismatch')
    if not np.isfinite(a).all() or not np.isfinite(b).all():raise RuntimeError('nonfinite oracle output')
    da=np.fromfile(first.with_suffix('.f64'),dtype='<f8');db=np.fromfile(second.with_suffix('.f64'),dtype='<f8')
    if da.size!=a.size or db.size!=a.size or not np.isfinite(da).all() or not np.isfinite(db).all():raise RuntimeError('invalid float64 oracle output')
    if not np.array_equal(da.view('<u8'),db.view('<u8')):raise RuntimeError('float64 GPU mappings differ bitwise')
    if not np.array_equal(da.astype('<f4').view('<u4'),a.view('<u4')) or not np.array_equal(db.astype('<f4').view('<u4'),b.view('<u4')):raise RuntimeError('oracle float32 output disagrees with its float64 result')
    unequal=a.view('<u4')!=b.view('<u4')
    if unequal.any():
        ids=np.flatnonzero(unequal.reshape(-1,3).any(1))
        raise RuntimeError(f'double GPU mappings differ in {len(ids)} pixels; first pixels={ids[:16].tolist()}, max_error={np.abs(a.astype(float)-b.astype(float)).max()}')
    return a.reshape(-1,3)

def validate_cpu(path,image,width):
    if path.stat().st_size%16:raise RuntimeError('malformed CPU probe records')
    probes=np.fromfile(path,dtype=[('pixel','<u4'),('rgb','<f4',(3,))])
    if len(probes)<32 or (probes['pixel']>=len(image)).any() or not np.isfinite(probes['rgb']).all():raise RuntimeError('invalid CPU probe results')
    expected=probes['rgb'].astype(np.float64);actual=image[probes['pixel']].astype(np.float64)
    errors=np.abs(actual-expected);bad=np.any(errors>1e-6+1e-6*np.abs(expected),axis=1)
    if bad.any():
        report=[dict(pixel=int(p['pixel']),xy=[int(p['pixel'])%width,int(p['pixel'])//width],cpu=p['rgb'].tolist(),gpu=image[p['pixel']].tolist()) for p in probes[bad]]
        raise RuntimeError('CPU brute-force probes disagree: '+json.dumps(report))
    return dict(count=len(probes),pixels=probes['pixel'].tolist(),max_abs_error=float(errors.max()),absolute_tolerance=1e-6,relative_tolerance=1e-6)

def generate(manifest_path,oracle,oracle_check,cpu_oracle,reference,cpus,work_dir=None,idle=True):
    bind_self(cpus);manifest_path=Path(manifest_path).resolve();root=manifest_path.parent
    manifest=json.loads(manifest_path.read_text('utf-8'))
    items=manifest.get('performance',[])+manifest.get('boundary',[])+manifest.get('hidden',[])
    if not items:raise ValueError('no inputs: scene specification pending')
    for exe in (oracle,oracle_check,cpu_oracle,reference):
        if not Path(exe).is_file():raise FileNotFoundError(exe)
    own=work_dir is None;stage=Path(work_dir or tempfile.mkdtemp(prefix='rt_answers_')).resolve();stage.mkdir(parents=True,exist_ok=True)
    evidence=[];pending=[]
    try:
        for number,item in enumerate(items):
            inp=root/item['input'];raw=inp.read_bytes();h=struct.unpack('<8I',raw[:32]);w,hh=h[1:3]
            if [w,hh]!=[item['width'],item['height']]:raise ValueError('manifest/header size mismatch')
            staged=stage/'input.bin';staged.write_bytes(raw)
            primary=stage/f'{number}_primary.bin';verified=stage/f'{number}_verify.bin';cpu=stage/f'{number}_cpu.bin';base=stage/f'{number}_baseline.bin'
            start=time.perf_counter()
            first_log=run_program(Path(oracle).resolve(),staged,primary,cpus,stage,'oracle',idle=idle)
            second_log=run_program(Path(oracle_check).resolve(),staged,verified,cpus,stage,'verify',idle=idle)
            image=validate_gpu(primary,verified,w*hh)
            cpu_log=run_program(Path(cpu_oracle).resolve(),staged,cpu,cpus,stage,'cpu',extras=item.get('cpu_probe_pixels',[]),timeout=600,idle=False)
            cpu_metrics=validate_cpu(cpu,image,w)
            baseline_log=run_program(Path(reference).resolve(),staged,base,cpus,stage,'baseline',idle=idle)
            initial=compare(base,primary,0,w,hh);b=initial.get('exception_pixels')
            if b is None:raise RuntimeError('baseline failed: '+str(initial))
            result=compare(base,primary,b,w,hh)
            if result['factor']!=1:raise RuntimeError('baseline fails image criteria: '+str(result))
            pending.append((item,primary,b))
            evidence.append(dict(id=item['id'],gpu_bitwise_equal=True,gpu_float64_bitwise_equal=True,cpu=cpu_metrics,baseline=result,oracle_log=first_log,verify_log=second_log,cpu_log=cpu_log,baseline_log=baseline_log,wall_s=time.perf_counter()-start))
            print(item['id'],'double mappings bitwise equal; CPU probes',cpu_metrics['count'],'b',b,'limit',4*b+20,flush=True)
        # Publish only after every input has passed both independent checks.
        for item,path,b in pending:
            expected=root/item['expected'];expected.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,expected)
            item['baseline_exceptions']=b
            if item in manifest.get('performance',[]):preview(expected,item['width'],item['height'],expected.with_suffix('.png'))
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        report=dict(cpus=cpus,idle_check=idle,items=evidence)
        (root/'answer_generation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        images=[Image.open((root/i['expected']).with_suffix('.png')).convert('RGB') for i in manifest.get('performance',[])]
        if images:
            cols=1 if len(images)==1 else 2;tw,th=960,540
            sheet=Image.new('RGB',(cols*tw,((len(images)+cols-1)//cols)*th),(242,241,246))
            for n,im in enumerate(images):
                im.thumbnail((tw,th),Image.Resampling.LANCZOS);sheet.paste(im,((n%cols)*tw+(tw-im.width)//2,(n//cols)*th+(th-im.height)//2))
            sheet.save(root/'standard_sheet.png')
        return report
    finally:
        if own:shutil.rmtree(stage)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--oracle',type=Path,required=True);p.add_argument('--oracle-check',type=Path,required=True);p.add_argument('--cpu-oracle',type=Path,required=True);p.add_argument('--reference',type=Path,required=True)
    p.add_argument('--manifest',type=Path,default=HERE/'manifest.json');p.add_argument('--cpus',default=SETTINGS['cpus']);p.add_argument('--work-dir',type=Path)
    p.add_argument('--no-idle-check',action='store_true',help='development correctness checks only')
    a=p.parse_args();generate(a.manifest,a.oracle,a.oracle_check,a.cpu_oracle,a.reference,a.cpus,a.work_dir,not a.no_idle_check)

if __name__=='__main__':main()
