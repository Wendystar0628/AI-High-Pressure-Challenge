"""Build with the specified toolchain in an ASCII temporary directory."""
from pathlib import Path
import argparse
import ctypes
import os
import shutil
import subprocess
import tempfile
import time
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent/'数据'))
from rt_eval import SETTINGS, bind_self, launch

VC=r'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat'
NVCC=r'C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\bin\nvcc.exe'

def build(source, output, cpus=SETTINGS['cpus'], work=None, extra_flags=(), headers=None):
    bind_self(cpus); source=Path(source).resolve(); output=Path(output).resolve()
    here=Path(headers or __file__).resolve()
    if here.is_file(): here=here.parent
    own=work is None; folder=Path(work or tempfile.mkdtemp(prefix='rt_build_')); folder.mkdir(parents=True,exist_ok=True)
    try:
        for name in ('grader.cu','rt.h','render_math.cuh','bvh.hpp'): shutil.copy2(here/name,folder/name)
        shutil.copy2(source,folder/'solution.cu'); (folder/'tmp').mkdir(exist_ok=True)
        command=f'@echo off\ncall "{VC}" >nul\n"{NVCC}" -O3 -std=c++17 -arch=sm_89 -Xcompiler "/O2 /utf-8 /Zc:preprocessor" {" ".join(extra_flags)} -o built.exe grader.cu solution.cu\n'
        (folder/'build.cmd').write_text(command,encoding='mbcs')
        env=os.environ.copy(); env.update(TEMP=str(folder/'tmp'),TMP=str(folder/'tmp'))
        start=time.perf_counter()
        p=launch(['cmd.exe','/d','/c',r'.\build.cmd'],cpus,SETTINGS['priority'],cwd=folder,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        log,_=p.communicate(); dt=time.perf_counter()-start
        output.parent.mkdir(parents=True,exist_ok=True); output.with_suffix('.build.log').write_bytes(log)
        if p.returncode: raise RuntimeError(log.decode('utf-8',errors='replace'))
        shutil.copy2(folder/'built.exe',output)
        return dict(compile_s=dt,cpus=cpus,command=command.splitlines()[-1])
    finally:
        if own: shutil.rmtree(folder)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--source',type=Path,default=Path('solution.cu')); p.add_argument('--output',type=Path,default=Path('grader.exe')); p.add_argument('--cpus',default=SETTINGS['cpus'])
    a=p.parse_args(); print(build(a.source,a.output,a.cpus))
