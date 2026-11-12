"""Static rule scan for a submitted solution.cu. It only FLAGS lines for the grading AI to read;
it never decides a violation by itself.  Usage: python rules_scan.py path\\to\\solution.cu"""
import re, sys, json
from pathlib import Path

ALLOWED_INCLUDES = re.compile(r'^(rt\.h|render_math\.cuh|bvh\.hpp|cuda_runtime(_api)?\.h|device_launch_parameters\.h|'
                              r'cuda_fp16\.h|cuda_bf16\.h|vector_types\.h|vector_functions\.h|math_constants\.h|'
                              r'cooperative_groups(/.*)?(\.h)?|cub/.*|thrust/.*|cuda/.*|mma\.h|sm_\d+_.*\.h|'
                              r'[a-z_]+(\.h)?)$')  # bare names cover the C++ standard library (<vector>, <cmath>, ...)
STD_HEADER_SUSPECT = re.compile(r'^(windows|d3d\d*|dxgi|vulkan|optix|embree|cuda|nvrtc|cublas|cufft|curand|cusparse|nvjpeg|npp|cudnn)', re.I)

FLAGS = [  # (category, regex, note)
    ('外部库/接口', r'#\s*pragma\s+comment', 'MSVC 链接指令，可链接额外库'),
    ('外部库/接口', r'LoadLibrary|GetProcAddress|dlopen|dlsym', '动态加载 DLL'),
    ('外部库/接口', r'optix|embree|d3d12|dxgi|ID3D12|vulkan|vk[A-Z]\w+\(|DXR', '光追库或硬件光追接口'),
    ('外部库/接口', r'cudaGetDriverEntryPoint|\bcu[A-Z][A-Za-z]+\s*\(|<cuda\.h>|"cuda\.h"', 'CUDA Driver API'),
    ('数据回传', r'cudaMemcpy\w*\s*\([^;]*(DeviceToHost|cudaMemcpyDefault)', '设备到主机拷贝（只允许少量控制信息）'),
    ('数据回传', r'cudaMallocManaged|cudaHostAlloc|cudaHostRegister|cudaHostGetDevicePointer|cudaHostAllocMapped', '统一内存/映射内存（主机可直接读图像）'),
    ('文件/进程', r'\bfopen|ifstream|ofstream|fstream|CreateFile|_wfopen|\bsystem\s*\(|CreateProcess|_popen|ShellExecute|WinExec', '文件读写或启动进程'),
    ('文件/进程', r'getenv|GetEnvironmentVariable', '读环境变量'),
    ('亲和/优先级', r'SetProcessAffinityMask|SetThreadAffinityMask|SetPriorityClass|SetThreadPriority|SetThreadGroupAffinity|SetProcessPriorityBoost', '改亲和性或优先级'),
    ('线程', r'std::thread|std::async|std::jthread|CreateThread|_beginthread|#\s*pragma\s+omp|detach\s*\(', '主机线程：render 返回后不得再工作'),
    ('跨调用缓存', r'\bstatic\b[^;(]*(Tree|Node|bvh|BVH|cache|Cache|prev|last)', '静态变量名像缓存，人工确认没有跨场景复用'),
]
def public_constants():
    manifest = Path(__file__).resolve().parent / 'manifest.json'
    if not manifest.exists(): return []
    items = json.loads(manifest.read_text('utf-8')).get('performance', [])
    return sorted({str(item[key]) for item in items for key in ('triangle_count', 'triangles', 'seed') if key in item and int(item[key])>=1000})


def scan(path):
    text = Path(path).read_text('utf-8', errors='replace')
    lines = text.splitlines()
    constants = public_constants()
    out = dict(file=str(path), lines=len(lines), includes=[], flags=[], numeric_literals=0, public_constants=[])
    for i, l in enumerate(lines, 1):
        m = re.match(r'\s*#\s*include\s*[<"]([^>"]+)[>"]', l)
        if m:
            name = m[1]
            ok = bool(ALLOWED_INCLUDES.match(name)) and not STD_HEADER_SUSPECT.match(name) or name in ('cuda_runtime.h', 'cuda_runtime_api.h', 'cuda_fp16.h', 'cuda_bf16.h')
            out['includes'].append(dict(line=i, header=name, needs_review=not ok))
        for cat, rx, note in FLAGS:
            if re.search(rx, l):
                out['flags'].append(dict(line=i, category=cat, note=note, text=l.strip()[:160]))
        for c in constants:
            if re.search(r'(?<![\w.])' + c + r'(?![\w.])', l):
                out['public_constants'].append(dict(line=i, value=c, text=l.strip()[:120]))
    out['numeric_literals'] = len(re.findall(r'(?<![\w.])[-+]?\d+\.?\d*(?:[eE][-+]?\d+)?f?(?![\w.])', text))
    out['large_literal_table'] = out['numeric_literals'] > 3000
    return out


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(json.dumps(scan(p), ensure_ascii=False, indent=1))
