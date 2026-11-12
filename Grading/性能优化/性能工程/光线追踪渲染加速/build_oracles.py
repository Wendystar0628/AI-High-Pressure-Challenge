"""Build both double GPU mappings and the independent CPU brute-force checker."""
from pathlib import Path
import argparse,json,os,shutil,subprocess,tempfile,time
from build import build,VC,NVCC
from rt_eval import SETTINGS,bind_self,launch
HERE=Path(__file__).resolve().parent

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cpus',default=SETTINGS['cpus']);a=p.parse_args();bind_self(a.cpus)
    records={}
    for name in ('oracle','oracle_check'):records[name]=build(HERE/(name+'.cu'),HERE/(name+'.exe'),a.cpus)
    work=Path(tempfile.mkdtemp(prefix='rt_cpu_oracle_'))
    try:
        for name in ('oracle_cpu.cu','rt.h','render_math.cuh'):shutil.copy2(HERE/name,work/name)
        command=f'@echo off\ncall "{VC}" >nul\n"{NVCC}" -O3 -std=c++17 -arch=sm_89 -Xcompiler "/O2 /utf-8 /Zc:preprocessor" -o oracle_cpu.exe oracle_cpu.cu\n'
        (work/'build.cmd').write_text(command,encoding='mbcs');env=os.environ.copy();env.update(TEMP=str(work),TMP=str(work))
        start=time.perf_counter();process=launch(['cmd.exe','/d','/c',r'.\build.cmd'],a.cpus,SETTINGS['priority'],cwd=work,env=env,stdout=-1,stderr=-2)
        log,_=process.communicate();(HERE/'oracle_cpu.build.log').write_bytes(log)
        if process.returncode:raise RuntimeError(log.decode('utf-8',errors='replace'))
        shutil.copy2(work/'oracle_cpu.exe',HERE/'oracle_cpu.exe');records['oracle_cpu']=dict(cpus=a.cpus,compile_s=time.perf_counter()-start)
        (HERE/'oracle_build.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
    finally:shutil.rmtree(work)

if __name__=='__main__':main()
