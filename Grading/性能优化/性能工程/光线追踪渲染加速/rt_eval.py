"""Shared public checking / private grading engine. Input counts come from manifest.json."""
from pathlib import Path
import ctypes
import ctypes.wintypes as wt
import json
import math
import os
import re
import shutil
import statistics
import subprocess
import tempfile
import time
import numpy as np

HERE = Path(__file__).resolve().parent
SETTINGS = json.loads((HERE/'settings.json').read_text('utf-8'))


def affinity_mask(cpus):
    values = set()
    for part in cpus.split(','):
        a, sep, b = part.partition('-')
        values.update(range(int(a), int(b)+1) if sep else [int(a)])
    if not values or min(values) < 0 or max(values) >= 28:
        raise ValueError('logical processors must be in 0..27')
    return sum(1 << c for c in values), len(values)


def bind_self(cpus):
    mask, count = affinity_mask(cpus)
    k = ctypes.WinDLL('kernel32', use_last_error=True)
    k.GetCurrentProcess.restype = ctypes.c_void_p
    k.SetProcessAffinityMask.argtypes = [ctypes.c_void_p, ctypes.c_size_t]
    if not k.SetProcessAffinityMask(k.GetCurrentProcess(), mask):
        raise ctypes.WinError(ctypes.get_last_error())
    os.environ['OMP_NUM_THREADS'] = str(count)
    os.environ['CUDA_MODULE_LOADING'] = 'EAGER'


def launch(argv, cpus, priority='high', cwd=None, env=None, **kw):
    """Start suspended so no submission code runs before affinity is applied."""
    mask, _ = affinity_mask(cpus)
    flags = 0x4 | (subprocess.HIGH_PRIORITY_CLASS if priority == 'high' else subprocess.BELOW_NORMAL_PRIORITY_CLASS)
    p = subprocess.Popen([str(x) for x in argv], cwd=cwd, env=env, creationflags=flags, **kw)
    k = ctypes.WinDLL('kernel32', use_last_error=True)
    k.SetProcessAffinityMask.argtypes = [ctypes.c_void_p, ctypes.c_size_t]
    nt = ctypes.WinDLL('ntdll'); nt.NtResumeProcess.argtypes = [ctypes.c_void_p]
    if not k.SetProcessAffinityMask(int(p._handle), mask):
        p.kill(); p.wait(); raise ctypes.WinError(ctypes.get_last_error())
    if nt.NtResumeProcess(int(p._handle)) != 0:
        p.kill(); p.wait(); raise RuntimeError('cannot resume owned child process')
    return p


def cuda_users(pids):
    """WDDM 610.88 labels desktop graphics processes C+G too; inspect CUDA modules."""
    class Module(ctypes.Structure):
        _fields_=[('size',wt.DWORD),('module_id',wt.DWORD),('pid',wt.DWORD),('global_usage',wt.DWORD),('usage',wt.DWORD),('base',ctypes.c_void_p),('base_size',wt.DWORD),('module',wt.HMODULE),('name',wt.WCHAR*256),('path',wt.WCHAR*260)]
    k=ctypes.WinDLL('kernel32',use_last_error=True)
    k.CreateToolhelp32Snapshot.argtypes=[wt.DWORD,wt.DWORD];k.CreateToolhelp32Snapshot.restype=wt.HANDLE
    k.Module32FirstW.argtypes=[wt.HANDLE,ctypes.POINTER(Module)];k.Module32NextW.argtypes=[wt.HANDLE,ctypes.POINTER(Module)];k.CloseHandle.argtypes=[wt.HANDLE]
    found=[];unknown=[]
    for pid in pids:
        handle=k.CreateToolhelp32Snapshot(0x18,pid)
        if handle==ctypes.c_void_p(-1).value:
            if ctypes.get_last_error()!=87: unknown.append(pid)
            continue
        m=Module();m.size=ctypes.sizeof(m)
        try:
            if not k.Module32FirstW(handle,ctypes.byref(m)):
                if ctypes.get_last_error()!=18: unknown.append(pid)
                continue
            while True:
                if m.name.lower()=='nvcuda.dll':found.append(pid);break
                if not k.Module32NextW(handle,ctypes.byref(m)):break
        finally:k.CloseHandle(handle)
    return found,unknown


class _Nvml:
    """Read the installed driver's NVML API without repeatedly spawning nvidia-smi.
    Layouts match CUDA 13.2 include/nvml.h (legacy process-info v2, 24 bytes).
    """
    class Util(ctypes.Structure):
        _fields_=[('gpu',ctypes.c_uint),('memory',ctypes.c_uint)]
    class Memory(ctypes.Structure):
        _fields_=[('total',ctypes.c_ulonglong),('free',ctypes.c_ulonglong),('used',ctypes.c_ulonglong)]
    class Process(ctypes.Structure):
        _fields_=[('pid',ctypes.c_uint),('used',ctypes.c_ulonglong),('gpu_instance',ctypes.c_uint),('compute_instance',ctypes.c_uint)]
    @staticmethod
    def check(code):
        if code:raise RuntimeError(f'NVML returned {code}')
    def __init__(self):
        n=self.library=ctypes.CDLL(str(Path(os.environ.get('SystemRoot',r'C:\Windows'))/'System32/nvml.dll'))
        n.nvmlDeviceGetHandleByIndex_v2.argtypes=[ctypes.c_uint,ctypes.POINTER(ctypes.c_void_p)]
        n.nvmlDeviceGetUtilizationRates.argtypes=[ctypes.c_void_p,ctypes.POINTER(self.Util)]
        n.nvmlDeviceGetMemoryInfo.argtypes=[ctypes.c_void_p,ctypes.POINTER(self.Memory)]
        n.nvmlDeviceGetComputeRunningProcesses_v2.argtypes=[ctypes.c_void_p,ctypes.POINTER(ctypes.c_uint),ctypes.POINTER(self.Process)]
        self.check(n.nvmlInit_v2());self.handle=ctypes.c_void_p()
        self.check(n.nvmlDeviceGetHandleByIndex_v2(0,ctypes.byref(self.handle)))
    def state(self):
        n=self.library;u=self.Util();m=self.Memory()
        self.check(n.nvmlDeviceGetUtilizationRates(self.handle,ctypes.byref(u)))
        self.check(n.nvmlDeviceGetMemoryInfo(self.handle,ctypes.byref(m)))
        capacity=256
        for attempt in range(3):
            count=ctypes.c_uint(capacity);records=(self.Process*capacity)()
            code=n.nvmlDeviceGetComputeRunningProcesses_v2(self.handle,ctypes.byref(count),records)
            if code==7:capacity=count.value+16;continue
            self.check(code)
            return u.gpu,m.free//1048576,[records[i].pid for i in range(count.value)]
        raise RuntimeError('NVML process list kept changing')


_nvml=None
_nvml_unavailable=False


def gpu_state():
    global _nvml,_nvml_unavailable
    if not _nvml_unavailable:
        try:
            if _nvml is None:_nvml=_Nvml()
            util,free,pids=_nvml.state();compute,unknown=cuda_users(pids)
            return dict(utilization=util,free_mib=free,compute_pids=compute,wddm_pids=pids,unclassified_pids=unknown,monitor_backend='nvml')
        except (OSError,AttributeError,RuntimeError):
            _nvml_unavailable=True
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    q = subprocess.run(['nvidia-smi','--query-gpu=utilization.gpu,memory.free','--format=csv,noheader,nounits'], capture_output=True, text=True, creationflags=flags, timeout=10)
    if q.returncode: raise RuntimeError('nvidia-smi failed: '+q.stderr)
    util, free = [int(x.strip()) for x in q.stdout.strip().splitlines()[0].split(',')]
    q = subprocess.run(['nvidia-smi','--query-compute-apps=pid','--format=csv,noheader,nounits'], capture_output=True, text=True, creationflags=flags, timeout=10)
    if q.returncode: raise RuntimeError('nvidia-smi process query failed: '+q.stderr)
    pids = [int(x) for x in q.stdout.splitlines() if x.strip().isdigit()]
    compute,unknown=cuda_users(pids)
    return dict(utilization=util,free_mib=free,compute_pids=compute,wddm_pids=pids,unclassified_pids=unknown,monitor_backend='nvidia-smi')


def wait_idle(settings):
    deadline = time.monotonic()+settings['gpu_idle_timeout_s']
    while True:
        state=gpu_state()
        if state['utilization'] <= settings['gpu_idle_util_percent'] and not state['compute_pids']: return state
        if time.monotonic() >= deadline: raise RuntimeError('GPU did not become idle: '+str(state))
        time.sleep(.25)


def compare(output, expected, b, width, height, settings=SETTINGS):
    n=width*height*3
    def arr(x):
        return np.frombuffer(x, dtype='<f4') if isinstance(x, bytes) else np.fromfile(x,dtype='<f4')
    ref=arr(expected).astype(np.float64)
    if ref.size != n or not np.isfinite(ref).all(): raise ValueError('invalid reference image')
    try: out=arr(output).astype(np.float64)
    except (ValueError,OSError) as e: return dict(status='fail',factor=0,reason=str(e))
    if out.size != n: return dict(status='fail',factor=0,reason=f'output channels {out.size}, expected {n}')
    if not np.isfinite(out).all():
        bad=np.flatnonzero(~np.isfinite(out)); p=int(bad[0])//3
        return dict(status='fail',factor=0,reason='nonfinite output',nonfinite=int(bad.size),worst_xy=[p%width,p//width])
    c=settings['comparison']; d=(out-ref).reshape(-1,3); err=np.abs(d)
    exceptions=np.any(err > c['absolute']+c['relative']*np.abs(ref.reshape(-1,3)),axis=1)
    clean=d[~exceptions]; bad=int(exceptions.sum()); limit=c['baseline_multiplier']*b+c['pixel_slack']
    if not len(clean):
        worst=int(np.argmax(np.max(err,axis=1)))
        return dict(status='fail',factor=0,exception_pixels=bad,exception_limit=limit,baseline_exceptions=b,
                    bias=None,rmse=None,max_error=float(err.max()),worst_xy=[worst%width,worst//width],reason='no non-exception pixels')
    bias=np.mean(clean,axis=0)
    rmse=float(np.sqrt(np.mean(clean*clean)))
    max_bias=float(np.max(np.abs(bias))); minor=c['minor_multiplier']
    tier=next((scale for scale in (1,minor) if bad<=limit*scale and max_bias<=c['bias']*scale and rmse<=c['rmse']*scale),None)
    worst=int(np.argmax(np.max(err,axis=1)))
    reasons=[]
    for key,value,lim in [('exception_pixels',bad,limit),('bias',max_bias,c['bias']),('rmse',rmse,c['rmse'])]:
        if value>lim: reasons.append(f'{key}={value:.9g} > {lim:.9g}')
    return dict(status='pass' if tier==1 else 'minor' if tier else 'fail',factor=1 if tier==1 else .5 if tier else 0,
                exception_pixels=bad,exception_limit=limit,baseline_exceptions=b,bias=bias.tolist(),bias_limit=c['bias'],
                rmse=rmse,rmse_limit=c['rmse'],max_error=float(err.max()),worst_xy=[worst%width,worst//width],reason='; '.join(reasons))


def anchors_for(item, settings=SETTINGS):
    """Manifest values are explicit; generated inputs may fall back to shared scoring settings."""
    return item.get('anchors') or settings.get('scoring', {}).get('anchors')


def score_speed(speed, anchors):
    if not anchors: return None
    if speed is None: return 0
    if speed<=anchors[0][0]: return anchors[0][1]
    if speed>=anchors[-1][0]: return anchors[-1][1]
    for (a,p),(b,q) in zip(anchors,anchors[1:]):
        if a<=speed<=b: return p+(q-p)*math.log(speed/a)/math.log(b/a)


class InvalidBaseline(RuntimeError): pass


class DeviceGuard:
    def __init__(self): self.failures=0; self.skip_inputs=set()
    def blocked(self, item, settings): return item in self.skip_inputs or self.failures>=settings['max_device_failures']


def device_failure(row):
    text=row.get('stderr','').lower()
    return row.get('timeout',False) or bool(re.search(r'cuda_error code=(700|702|709|710|719|999)\b',text)) or any(x in text for x in ('launch timeout','launch timed out','unspecified launch failure','device has been lost','illegal memory access','device-side assert'))


def run_once(exe, item, root, out, cpus, settings, guard, idle=True):
    if guard.blocked(item['id'],settings): return dict(ok=False,status='skipped',factor=0,reason='earlier device failure')
    idle_start=time.perf_counter();state=wait_idle(settings) if idle else gpu_state();idle_wait=time.perf_counter()-idle_start
    env=os.environ.copy(); env['CUDA_MODULE_LOADING']='EAGER'; env['OMP_NUM_THREADS']=str(affinity_mask(cpus)[1])
    if out.exists(): out.unlink()
    started=time.perf_counter()
    p=launch([exe,root/item['input'],out],cpus,settings['priority'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    timed_out=False
    try: stdout,stderr=p.communicate(timeout=settings['process_timeout_s'])
    except subprocess.TimeoutExpired:
        p.kill(); stdout,stderr=p.communicate(); timed_out=True
    err=stderr.decode('utf-8',errors='replace'); m=re.search(r'render_ms=([0-9.]+)',err)
    elapsed=float(m[1]) if m else None
    row=dict(pid=p.pid,returncode=p.returncode,timeout=timed_out,ms=elapsed,wall_s=time.perf_counter()-started,idle_wait_s=idle_wait,stderr=err,gpu_before=state)
    row.update(compare(out,root/item['expected'],item['baseline_exceptions'],item['width'],item['height'],settings)
               if p.returncode==0 and elapsed is not None and elapsed>0 and out.exists() else dict(status='fail',factor=0,reason='process failed, timed out, or did not report a positive time'))
    if device_failure(row):
        guard.failures+=1; guard.skip_inputs.add(item['id']); row['device_failure']=True
        # Stop this input immediately. Before the next input, wait and run a safe micro probe.
        time.sleep(settings['recovery_wait_s'])
        if guard.failures<settings['max_device_failures']:
            wait_idle(settings)
            probe=launch([root/'reference.exe',root/'sample.bin',out.with_suffix('.probe')],cpus,settings['priority'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            try: _,pe=probe.communicate(timeout=15)
            except subprocess.TimeoutExpired:
                probe.kill(); _,pe=probe.communicate(); guard.failures=settings['max_device_failures']
            if probe.returncode: guard.failures=settings['max_device_failures']
            row['recovery_probe']=dict(returncode=probe.returncode,stderr=pe.decode('utf-8',errors='replace'))
    return row


def validate_manifest(manifest, hidden=False):
    perf=manifest.get('performance',[])
    if not perf: raise ValueError('manifest has no performance inputs; scene specification is pending')
    all_items=perf+manifest.get('boundary',[])+manifest.get('hidden',[])
    ids=[x['id'] for x in all_items]
    if len(ids)!=len(set(ids)): raise ValueError('duplicate input IDs')
    for x in all_items:
        for k in ('id','input','expected','width','height','baseline_exceptions'):
            if k not in x: raise ValueError(f'{x.get("id")}: missing {k}')
        if not isinstance(x['baseline_exceptions'],int) or x['baseline_exceptions']<0: raise ValueError('baseline exceptions not calibrated')
        anchors=anchors_for(x)
        if anchors:
            if anchors[0]!=[1,0] or anchors[-1][1]!=100 or any(a[0]>=b[0] or a[1]>=b[1] for a,b in zip(anchors,anchors[1:])):
                raise ValueError('anchors must start at [1,0], strictly increase, and end at 100')
    if hidden:
        for x in perf:
            if not any(h.get('for')==x['id'] for h in manifest.get('hidden',[])):
                raise ValueError('missing hidden inputs for '+x['id'])
        if any(h.get('for') not in {p['id'] for p in perf} for h in manifest.get('hidden',[])):
            raise ValueError('hidden input has unknown performance association')


def evaluate(exe, root, manifest, cpus=None, quick=False, hidden=False, selected=(), idle=True, output_dir=None, baseline_exe=None):
    validate_manifest(manifest,hidden)
    cpus=cpus or SETTINGS['cpus']; bind_self(cpus)
    settings=json.loads(json.dumps(SETTINGS)); settings['timing']['repeats']=1 if quick else SETTINGS['timing']['repeats']
    root=Path(root).resolve(); exe=Path(exe).resolve(); started=time.perf_counter()
    folder=Path(output_dir) if output_dir else Path(tempfile.mkdtemp(prefix='rt_check_')); folder.mkdir(parents=True,exist_ok=True)
    # Stage executables in an ASCII temporary directory. Data paths are opened by Python,
    # then staged too, so neither executable nor profiler needs Chinese command-line paths.
    stage=Path(tempfile.mkdtemp(prefix='rt_run_'))
    try:
        shutil.copy2(exe,stage/'submission.exe'); shutil.copy2(baseline_exe or root/'reference.exe',stage/'reference.exe')
        if (root/'sample.bin').exists(): shutil.copy2(root/'sample.bin',stage/'sample.bin')
        sg=DeviceGuard(); bg=DeviceGuard(); rows=[]
        def one(binary,item,baseline=False):
            staged=dict(item); staged['input']='input.bin'; staged['expected']='expected.bin'
            shutil.copy2(root/item['input'],stage/'input.bin'); shutil.copy2(root/item['expected'],stage/'expected.bin')
            row=run_once(stage/binary,staged,stage,stage/'output.bin',cpus,settings,bg if baseline else sg,idle)
            if baseline and row['factor']!=1: raise InvalidBaseline('baseline failed on '+item['id']+': '+str(row))
            if (stage/'output.bin').exists(): shutil.copy2(stage/'output.bin',folder/(item['id']+('_baseline' if baseline else '_submission')+'.bin'))
            return row
        for item in manifest.get('boundary',[]):
            r=one('submission.exe',item); print(f'boundary {item["id"]}: {r["status"]} {r.get("reason","")}',flush=True)
            rows.append(dict(id=item['id'],kind='boundary',runs=[r]))
        for index,item in enumerate(manifest['performance'],1):
            if selected and item['id'] not in selected and str(index) not in selected: continue
            base=[]; submission=[]
            for rep in range(settings['timing']['repeats']):
                # Alternating which implementation goes first removes fixed first-run bias.
                order=[True,False] if rep%2==0 else [False,True]
                for baseline in order:
                    r=one('reference.exe' if baseline else 'submission.exe',item,baseline)
                    (base if baseline else submission).append(r)
            stat={'min':min,'median':statistics.median}.get(settings['timing']['statistic'])
            if stat is None: raise ValueError('unknown timing statistic')
            rb=stat([r['ms'] for r in base]); valid=[r['ms'] for r in submission if r.get('ms')]
            cs=stat(valid) if valid else None; speed=rb/cs if cs else None; c=statistics.mean(r['factor'] for r in submission)
            anchors=anchors_for(item,settings); q=score_speed(speed,anchors); hs=[]
            if hidden:
                for h in manifest['hidden']:
                    if h['for']==item['id']: hs.append(dict(id=h['id'],**one('submission.exe',h)))
            h=statistics.mean(r['factor'] for r in hs) if hs else None
            row=dict(id=item['id'],kind='performance',baseline_ms=rb,submission_ms=cs,speedup=speed,q=q,c=c,h=h,
                     score=q*c*(h if h is not None else 1) if q is not None else None,
                     full_speedup=anchors[-1][0] if anchors else None,baseline_runs=base,runs=submission,hidden_runs=hs)
            rows.append(row)
            ratios='无有效用时' if speed is None else f'{speed:.3f}x'
            scored='待定' if q is None else f'{row["score"]:.1f}'
            speed_points='待定' if q is None else f'{q:.1f}'
            print(f'{item["id"]}: baseline={rb:.3f}ms submission={cs}ms speedup={ratios} q={speed_points} c={c:.2f} h={h} score={scored} full={row["full_speedup"] or "待定"}',flush=True)
            for j,r in enumerate(submission,1):
                print(f'  run {j}: {r["status"]} exceptions={r.get("exception_pixels")}/{r.get("exception_limit")} bias={r.get("bias")} rmse={r.get("rmse")} worst={r.get("worst_xy")} {r.get("reason","")}',flush=True)
        perf=[r for r in rows if r['kind']=='performance']
        score=statistics.mean(r['score'] for r in perf) if perf and all(r['score'] is not None for r in perf) else None
        result=dict(valid=True,formal=hidden and not quick and not selected and idle and cpus==SETTINGS['cpus'],cpus=cpus,priority=settings['priority'],timing=settings['timing'],score=score,
                    partial=bool(selected),includes_hidden=hidden,rows=rows,wall_s=time.perf_counter()-started)
        (folder/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
        print('score='+('待定（只输出加速比与画面判定）' if score is None else f'{score:.1f}')+f' wall_s={result["wall_s"]:.3f}',flush=True)
        if not hidden: print('公开自测得分不含隐藏系数 h。',flush=True)
        return result
    finally:
        shutil.rmtree(stage)
