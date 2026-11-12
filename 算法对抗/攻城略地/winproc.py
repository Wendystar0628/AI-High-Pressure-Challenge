"""Own-child Windows process controls, usable without administrator privileges."""
import ctypes as C
from ctypes import wintypes as W
import subprocess
import time
from contextlib import contextmanager

K = C.WinDLL("kernel32", use_last_error=True)
SIZE = C.c_size_t
HANDLE = W.HANDLE
DWORD = W.DWORD
U64 = C.c_uint64

def api(name, args, result=W.BOOL):
    fn = getattr(K, name)
    fn.argtypes, fn.restype = args, result
    return fn

close_handle = api("CloseHandle", [HANDLE])
query_cycles = api("QueryProcessCycleTime", [HANDLE, C.POINTER(U64)])
set_affinity = api("SetProcessAffinityMask", [HANDLE, SIZE])
get_affinity = api("GetProcessAffinityMask", [HANDLE, C.POINTER(SIZE), C.POINTER(SIZE)])
get_current = api("GetCurrentProcess", [], HANDLE)
create_job = api("CreateJobObjectW", [C.c_void_p, W.LPCWSTR], HANDLE)
set_job = api("SetInformationJobObject", [HANDLE, C.c_int, C.c_void_p, DWORD])
assign_job = api("AssignProcessToJobObject", [HANDLE, HANDLE])
create_port = api("CreateIoCompletionPort", [HANDLE,HANDLE,SIZE,DWORD], HANDLE)
get_completion = api("GetQueuedCompletionStatus", [HANDLE,C.POINTER(DWORD),C.POINTER(SIZE),C.POINTER(C.c_void_p),DWORD])
snapshot = api("CreateToolhelp32Snapshot", [DWORD,DWORD], HANDLE)
open_thread = api("OpenThread", [DWORD,W.BOOL,DWORD], HANDLE)
resume_thread = api("ResumeThread", [HANDLE], DWORD)

class THREADENTRY32(C.Structure):
    _fields_ = [("dwSize",DWORD),("cntUsage",DWORD),("th32ThreadID",DWORD),
                ("th32OwnerProcessID",DWORD),("tpBasePri",W.LONG),
                ("tpDeltaPri",W.LONG),("dwFlags",DWORD)]
thread_first = api("Thread32First",[HANDLE,C.POINTER(THREADENTRY32)])
thread_next = api("Thread32Next",[HANDLE,C.POINTER(THREADENTRY32)])

class BASIC_LIMIT(C.Structure):
    _fields_ = [("PerProcessUserTimeLimit",C.c_int64),("PerJobUserTimeLimit",C.c_int64),
                ("LimitFlags",DWORD),("MinimumWorkingSetSize",SIZE),
                ("MaximumWorkingSetSize",SIZE),("ActiveProcessLimit",DWORD),
                ("Affinity",SIZE),("PriorityClass",DWORD),("SchedulingClass",DWORD)]
class IO_COUNTERS(C.Structure):
    _fields_ = [(name,U64) for name in ("ReadOperationCount","WriteOperationCount",
                "OtherOperationCount","ReadTransferCount","WriteTransferCount","OtherTransferCount")]
class EXTENDED_LIMIT(C.Structure):
    _fields_ = [("BasicLimitInformation",BASIC_LIMIT),("IoInfo",IO_COUNTERS),
                ("ProcessMemoryLimit",SIZE),("JobMemoryLimit",SIZE),
                ("PeakProcessMemoryUsed",SIZE),("PeakJobMemoryUsed",SIZE)]
class COMPLETION_PORT(C.Structure):
    _fields_ = [("CompletionKey",C.c_void_p),("CompletionPort",HANDLE)]

def check(ok):
    if not ok:
        raise C.WinError(C.get_last_error())
    return ok

def allowed_cpus():
    mask,system = SIZE(),SIZE()
    check(get_affinity(get_current(),C.byref(mask),C.byref(system)))
    return [i for i in range(C.sizeof(SIZE)*8) if mask.value & (1<<i)]

@contextmanager
def process_affinity(cpus):
    original,system = SIZE(),SIZE()
    check(get_affinity(get_current(),C.byref(original),C.byref(system)))
    mask = sum(1<<cpu for cpu in cpus)
    if not mask or mask & ~original.value:
        raise ValueError("requested CPUs are not available to the referee")
    check(set_affinity(get_current(),mask))
    try:
        yield
    finally:
        check(set_affinity(get_current(),original.value))

class Child:
    """Spawn suspended, pin and memory-limit before the first user instruction."""
    def __init__(self, command, cpu, env, cwd=None, memory_limit=1<<30):
        self.proc = None
        self.job = self.port = None
        self.cpu = cpu
        self.memory_exceeded = False
        self.started = time.perf_counter()
        try:
            self.job = check(create_job(None,None))
            limits = EXTENDED_LIMIT()
            limits.BasicLimitInformation.LimitFlags = 0x2000 | 0x100  # kill on close, process memory
            limits.ProcessMemoryLimit = memory_limit
            check(set_job(self.job,9,C.byref(limits),C.sizeof(limits)))
            self.port = check(create_port(HANDLE(-1),None,0,1))
            completion = COMPLETION_PORT(None,self.port)
            check(set_job(self.job,7,C.byref(completion),C.sizeof(completion)))
            self.proc = subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,env=env,cwd=cwd,creationflags=0x4|0x08000000)
            self.created_at=time.perf_counter()
            check(set_affinity(HANDLE(int(self.proc._handle)),1<<cpu))
            check(assign_job(self.job,HANDLE(int(self.proc._handle))))
            snap = snapshot(4,0)
            if snap == HANDLE(-1).value:
                raise C.WinError(C.get_last_error())
            try:
                entry = THREADENTRY32(); entry.dwSize=C.sizeof(entry)
                found = thread_first(snap,C.byref(entry))
                resumed = False
                while found:
                    if entry.th32OwnerProcessID == self.proc.pid:
                        thread = check(open_thread(2,False,entry.th32ThreadID))
                        try:
                            if resume_thread(thread) == 0xFFFFFFFF:
                                raise C.WinError(C.get_last_error())
                            resumed = True
                            self.resumed_at=time.perf_counter()
                        finally:
                            close_handle(thread)
                        break
                    found = thread_next(snap,C.byref(entry))
                if not resumed:
                    raise RuntimeError("cannot find suspended child main thread")
            finally:
                close_handle(snap)
        except BaseException:
            self.close()
            raise

    def cycles(self):
        cycles = U64()
        check(query_cycles(HANDLE(int(self.proc._handle)),C.byref(cycles)))
        return cycles.value

    def memory_event(self):
        message,key,overlap = DWORD(),SIZE(),C.c_void_p()
        while get_completion(self.port,C.byref(message),C.byref(key),C.byref(overlap),0):
            if message.value == 9:  # JOB_OBJECT_MSG_PROCESS_MEMORY_LIMIT
                self.memory_exceeded = True
        return self.memory_exceeded

    def close(self):
        # All handles/PIDs here belong to this Child; never kill by image name.
        if self.job:
            close_handle(self.job); self.job=None
        if self.proc:
            if self.proc.poll() is None:
                self.proc.kill()
            self.proc.wait()
            for pipe in (self.proc.stdin,self.proc.stdout):
                if pipe:
                    pipe.close()
        if self.port:
            close_handle(self.port); self.port=None
