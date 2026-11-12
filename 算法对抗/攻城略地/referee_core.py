"""Shared local/official referee. No third-party Python packages are required."""
from __future__ import annotations
import concurrent.futures
import dataclasses
import json
import math
import os
from pathlib import Path
import queue
import statistics
import subprocess
import threading
import time

from mapgen import generate, VERSION as MAP_VERSION
from winproc import Child, allowed_cpus, process_affinity

KIT = Path(__file__).resolve().parent
COMPILER = Path(r"C:\msys64\ucrt64\bin\g++.exe")
LOG_VERSION = "siege-replay-v1"
DISCARD = ["accepted","command_limit","invalid_node","not_owned",
           "same_node","nonpositive","insufficient"]

def process_env():
    env = os.environ.copy()
    env["PATH"] = str(COMPILER.parent) + os.pathsep + env.get("PATH", "")
    return env

def build_bridge(build_dir):
    """Build within the caller's directory; do not require writes to the kit."""
    build_dir = Path(build_dir).resolve()
    build_dir.mkdir(parents=True, exist_ok=True)
    target = build_dir / "engine_bridge.exe"
    sources = [KIT/"engine_bridge.cpp", KIT/"engine.hpp"]
    if not target.exists() or any(p.stat().st_mtime_ns > target.stat().st_mtime_ns for p in sources):
        subprocess.run([str(COMPILER),"-O2","-std=c++20","-I"+str(KIT),
                        "-o",target.name,str(sources[0])],check=True,env=process_env(),cwd=build_dir)
    return target

def calibrate(bridge, cpus, path):
    """Median of three cycles / GetProcessTimes CPU-ms ratios on each CPU."""
    path = Path(path).resolve()
    existing = {}
    if path.exists():
        existing = json.loads(path.read_text(encoding="utf-8-sig"))
    result = dict(existing)
    result.update(schema="siege-cycle-calibration-v1", method="QueryProcessCycleTime / GetProcessTimes(user+kernel)",
                  interval_wall_ms=500, samples_per_cpu=3, memory_limit_bytes=1<<30)
    values = result.setdefault("cpus",{})
    for cpu in cpus:
        child = Child([str(bridge),"--calibrate"],cpu,process_env())
        try:
            output = child.proc.communicate(timeout=20)[0].decode("ascii")
            if child.proc.returncode:
                raise RuntimeError(f"calibration child exited {child.proc.returncode}")
            samples = []
            for line in output.splitlines():
                cycles,ticks,_ = map(int,line.split())
                if ticks <= 0:
                    raise RuntimeError("invalid CPU reference interval")
                samples.append(dict(cycles=cycles,cpu_100ns=ticks,
                                    cycles_per_ms=cycles/(ticks/10000)))
            if len(samples)!=3:
                raise RuntimeError("incomplete cycle calibration")
            values[str(cpu)] = dict(cycles_per_ms=statistics.median(s["cycles_per_ms"] for s in samples),
                                    samples=samples)
        finally:
            child.close()
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return result

def load_calibration(bridge, cpus, path, force=False):
    path = Path(path).resolve()
    data = json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else {"cpus":{}}
    missing = cpus if force else [c for c in cpus if str(c) not in data.get("cpus",{})]
    if missing:
        data = calibrate(bridge,missing,path)
    if data.get("schema") != "siege-cycle-calibration-v1":
        raise ValueError("unrecognized calibration file")
    for cpu in cpus:
        value = data["cpus"][str(cpu)]["cycles_per_ms"]
        if not isinstance(value,(float,int)) or not math.isfinite(value) or value<=0:
            raise ValueError(f"invalid calibration for CPU {cpu}")
    return data

def encode_state(state, flip=False):
    lines = [f"STATE {state['turn']} {state['max_turns']} {len(state['nodes'])} {len(state['fleets'])}"]
    def owner(value):
        return 3-value if flip and value else value
    for p in state["nodes"]:
        lines.append(f"{p['x']} {p['y']} {owner(p['owner'])} {p['troops']} {p['growth']}")
    for f in state["fleets"]:
        lines.append(f"{owner(f['owner'])} {f['troops']} {f['from']} {f['to']} {f['turns_left']}")
    return ("\n".join(lines)+"\n").encode("ascii")

def totals(state):
    result = [0,0]
    for p in state["nodes"]+state["fleets"]:
        if p["owner"]:
            result[p["owner"]-1]+=p["troops"]
    return result

class Engine:
    def __init__(self, bridge):
        self.proc = subprocess.Popen([str(bridge)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE,env=process_env(),creationflags=0x08000000)

    def settle(self,state,orders):
        payload = bytearray(encode_state(state))
        for commands in orders:
            payload.extend((str(len(commands))+"\n").encode("ascii"))
            for o in commands:
                payload.extend((" ".join(map(str,o))+"\n").encode("ascii"))
        self.proc.stdin.write(payload); self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("engine bridge failed: "+self.proc.stderr.read().decode(errors="replace"))
        result = json.loads(line)
        all_fleets = list(state["fleets"])
        for f in all_fleets+result["departures"]:
            a,b=state["nodes"][f["from"]],state["nodes"][f["to"]]
            squared=(a["x"]-b["x"])**2+(a["y"]-b["y"])**2
            floor=math.isqrt(squared)
            f["total_distance"]=floor+(floor*floor<squared)
        departing = iter(result["departures"])
        for e in result["orders"]:
            e["reason"] = DISCARD[e["reason"]]
            if e["reason"] == "accepted":
                f = next(departing)
                f["id"] = f"t{state['turn']}-p{e['owner']}-o{e['index']}"
                e["fleet_id"] = f["id"]
                all_fleets.append(f)
            else:
                e["fleet_id"] = None
            del e["fleet_index"]
        arrived = set()
        for e in result["arrivals"]:
            indices = e.pop("fleet_indices")
            arrived.update(indices)
            e["fleets"] = [dict(all_fleets[i],turns_left=0) for i in indices]
        result["movement"] = [dict(id=f["id"],before=f["turns_left"],after=f["turns_left"]-1,
                                   arrived=i in arrived) for i,f in enumerate(all_fleets)]
        remaining = [f for i,f in enumerate(all_fleets) if i not in arrived]
        for f,old in zip(result["state"]["fleets"],remaining,strict=True):
            f["id"] = old["id"]
            f["total_distance"]=old["total_distance"]
        result["growth"] = [dict(node=i,owner=p["owner"],troops_added=p["growth"])
                            for i,p in enumerate(state["nodes"]) if p["owner"]]
        return result

    def close(self):
        if self.proc.poll() is None:
            try:
                self.proc.stdin.write(b"STOP\n"); self.proc.stdin.flush()
                self.proc.wait(timeout=2)
            except (OSError,subprocess.TimeoutExpired):
                self.proc.kill(); self.proc.wait()
        for p in (self.proc.stdin,self.proc.stdout,self.proc.stderr):
            p.close()

def parse_int(text):
    value = int(text)
    if not -(1<<31) <= value < 1<<31:
        raise ValueError("order field outside C++ int")
    return value

class Player:
    def __init__(self, executable, cpu, cycles_per_ms):
        self.child = Child([str(Path(executable).resolve())],cpu,process_env())
        self.cycles_per_ms = cycles_per_ms
        self.previous_cycles = 0  # startup and globals are charged to turn 1
        self.debt_ms = 0.0
        self.streak = 0
        self.messages = queue.Queue()
        self.reader = threading.Thread(target=self._read,daemon=True)
        self.reader.start()

    def _read(self):
        try:
            stream = self.child.proc.stdout
            while True:
                line = stream.readline()
                if not line:
                    raise EOFError("process closed stdout")
                header = line.split()
                if len(header)!=3 or header[0]!=b"ORDERS":
                    raise ValueError("expected ORDERS turn count")
                turn,count = map(int,header[1:])
                if count < 0:
                    raise ValueError("negative order count")
                commands = []
                for _ in range(count):
                    fields = stream.readline().split()
                    if len(fields)!=3:
                        raise ValueError("expected from to troops")
                    commands.append([parse_int(v) for v in fields])
                end = stream.readline().split()
                if end != [b"END",str(turn).encode("ascii")]:
                    raise ValueError("missing or mismatched END")
                self.messages.put(dict(turn=turn,orders=commands,cycles=self.child.cycles(),
                                       completed_at=time.perf_counter()))
        except BaseException as error:
            self.messages.put(dict(error=f"{type(error).__name__}: {error}",
                                   completed_at=time.perf_counter()))

    def send(self,state,flip):
        # The wall deadline starts when this state is handed to the process,
        # never while Windows is still creating a process or another seat.
        # CPU turn 1 still starts at counter 0, including all initialization.
        self.sent_at = time.perf_counter()
        self.write_error = None
        # Sending large states must not block the referee's wall/memory monitor.
        def write():
            try:
                self.child.proc.stdin.write(encode_state(state,flip))
                self.child.proc.stdin.flush()
            except OSError as error:
                self.write_error = str(error)
        self.writer = threading.Thread(target=write,daemon=True)
        self.writer.start()

    def finish(self,message,turn,time_scale):
        end_cycles = message["cycles"] if "cycles" in message else self.child.cycles()
        delta_cycles = max(0,end_cycles-self.previous_cycles)
        cpu_ms = delta_cycles/self.cycles_per_ms
        self.previous_cycles = end_cycles
        budget = (1000.0 if turn==1 else 50.0)*time_scale
        debt_before = self.debt_ms
        timeout = debt_before+cpu_ms > budget
        self.debt_ms = max(0.0,debt_before+cpu_ms-budget)
        self.streak = self.streak+1 if timeout else 0
        failure = message.get("failure")
        if not failure and timeout and self.streak>=3:
            failure = "three_cpu_timeouts"
        if self.child.memory_event():
            failure = "memory_limit"
        commands = message.get("orders",[])
        timing = dict(cpu_cycles=end_cycles,delta_cycles=delta_cycles,
                      cpu_ms=cpu_ms,wall_ms=1000*(message["completed_at"]-self.sent_at),
                      nominal_budget_ms=budget,debt_before_ms=debt_before,
                      available_ms=max(0.0,budget-debt_before),debt_after_ms=self.debt_ms,
                      cpu_timeout=timeout,consecutive_timeouts=self.streak,
                      failure=failure,exit_code=self.child.proc.poll(),
                      memory_limit_bytes=1<<30)
        if turn==1:
            timing["process_setup_wall_ms"]=1000*(self.sent_at-self.child.started)
            timing["process_creation_wall_ms"]=1000*(self.child.created_at-self.child.started)
        return dict(commands=commands,applied=[] if timeout or failure else commands,
                    discard_all="cpu_timeout" if timeout else (failure or None),timing=timing)

    def close(self):
        self.child.close()
        self.reader.join(timeout=1)
        if hasattr(self,"writer"):
            self.writer.join(timeout=1)

def collect(players,turn,time_scale):
    pending = set(range(2)); messages = [None,None]
    while pending:
        for i in sorted(pending):
            p = players[i]
            now = time.perf_counter()
            try:
                message = p.messages.get_nowait()
            except queue.Empty:
                message = None
            if message is not None:
                if "error" in message:
                    message["failure"] = "process_exit" if p.child.proc.poll() is not None else "protocol_error"
                elif message["turn"]!=turn:
                    message["failure"] = "protocol_error"
                    message["error"] = "unexpected turn number"
                elif message["completed_at"]-p.sent_at > 5:
                    message["failure"] = "wall_timeout"
            elif p.child.memory_event():
                message = dict(failure="memory_limit",completed_at=now)
            elif p.child.proc.poll() is not None:
                message = dict(failure="process_exit",completed_at=now)
            elif p.write_error:
                message = dict(failure="protocol_error",error=p.write_error,completed_at=now)
            elif now-p.sent_at>=5:
                message = dict(failure="wall_timeout",completed_at=now)
            if message is not None:
                if "error" in message:
                    message.setdefault("failure","protocol_error")
                messages[i] = message
                pending.remove(i)
        if pending:
            time.sleep(0.001)
    responses = [p.finish(m,turn,time_scale) for p,m in zip(players,messages)]
    for r,m in zip(responses,messages):
        if "error" in m:
            r["timing"]["detail"] = m["error"]
    return responses

@dataclasses.dataclass(frozen=True)
class Match:
    seed: int
    a: str
    b: str
    # Original identities in seat order, used by the paired CLI output.
    labels: tuple[str,str] = ("A","B")
    name: str = ""
    display_names: tuple[str,str] = ("","")

def run_game(match, bridge, cpus, calibration, log_path=None, time_scale=1.0):
    state = generate(match.seed)
    state = {k:state[k] for k in ("turn","max_turns","nodes","fleets")}
    stream = Path(log_path).open("w",encoding="utf-8",newline="\n") if log_path else None
    players = []; engine = None
    max_cpu = [0.0,0.0]; timeouts=[0,0]; completed=0; failure_turn=None
    def emit(value):
        if stream:
            stream.write(json.dumps(value,ensure_ascii=False,separators=(",",":"))+"\n")
            stream.flush()
    emit(dict(type="header",schema=LOG_VERSION,seed=match.seed,map_generator=MAP_VERSION,
              name=match.name,players=[dict(seat=i+1,label=match.labels[i],
              display_name=match.display_names[i] or match.labels[i],executable=str(Path(exe).resolve()),
              cpu=cpus[i],cycles_per_ms=calibration["cpus"][str(cpus[i])]["cycles_per_ms"])
              for i,exe in enumerate((match.a,match.b))],
              rules=dict(max_turns=200,first_cpu_ms=1000*time_scale,cpu_ms=50*time_scale,
                         wall_ms=5000,memory_bytes=1<<30,command_limit=1000,
                         cpu_time_scale=time_scale,simultaneous_forfeit="draw"),initial_state=state))
    try:
        engine = Engine(bridge)
        # Both children start independently; each starts its own 5-second clock.
        for i,(exe,cpu) in enumerate(zip((match.a,match.b),cpus)):
            players.append(Player(exe,cpu,calibration["cpus"][str(cpu)]["cycles_per_ms"]))
            # Deliver turn 1 immediately. Slow creation of the other seat cannot
            # postpone the first player's input or its response timestamp.
            players[-1].send(state,flip=bool(i))
        while True:
            turn = state["turn"]
            if turn!=1:
                for i,p in enumerate(players):
                    p.send(state,flip=bool(i))
            responses = collect(players,turn,time_scale)
            for i,r in enumerate(responses):
                max_cpu[i] = max(max_cpu[i],r["timing"]["cpu_ms"])
                timeouts[i] += int(r["timing"]["cpu_timeout"])
            failures = [r["timing"]["failure"] for r in responses]
            record = dict(type="turn",turn=turn,players=responses)
            if any(failures):
                failure_turn=turn
                winner = 3 if all(failures) else (2 if failures[0] else 1)
                reason = "forfeit"
                # No departure, growth, or arrival on a turn terminated by penalty.
                record.update(settled=False,state=state,orders=[],departures=[],movement=[],growth=[],arrivals=[])
                emit(record)
                break
            settled = engine.settle(state,[r["applied"] for r in responses])
            state = settled.pop("state")
            winner = settled.pop("result")
            completed += 1
            record.update(settled=True,state=state,**settled)
            emit(record)
            if winner:
                alive = [any(p["owner"]==i for p in state["nodes"]+state["fleets"]) for i in (1,2)]
                reason = "turn_limit" if all(alive) else "elimination"
                break
        summary = dict(type="result",seed=match.seed,name=match.name,labels=list(match.labels),
                       display_names=[match.display_names[i] or match.labels[i] for i in range(2)],
                       winner=winner,winner_label=match.labels[winner-1] if winner in (1,2) else None,
                       score=[1,0] if winner==1 else ([0,1] if winner==2 else [0.5,0.5]),
                       reason=reason,turns=completed,failure_turn=failure_turn,
                       totals=totals(state),max_turn_cpu_ms=max_cpu,cpu_timeouts=timeouts,
                       forfeits=failures if reason=="forfeit" else [None,None],
                       cpus=list(cpus),log=str(Path(log_path).resolve()) if log_path else None)
        emit(summary)
        return summary
    finally:
        for player in players:
            player.close()
        if engine:
            engine.close()
        if stream:
            stream.close()

def _run_matches(matches, *, cpus, jobs=8, build_dir=None, calibration_path=None,
                log_dir=None,time_scale=1.0,on_result=None):
    """Stable slot scheduling; results always returned in input match order.

    Each slot owns two exclusive logical CPUs and processes indices slot, slot+jobs,...
    on_result is called in input order after completion. No random work scheduling.
    """
    matches = list(matches)
    if jobs<1 or len(cpus)<2*jobs or len(set(cpus))!=len(cpus):
        raise ValueError("need at least 2*jobs distinct logical CPUs")
    if set(cpus)-set(allowed_cpus()):
        raise ValueError("requested CPUs are not available to this user process")
    if not math.isfinite(time_scale) or time_scale<=0:
        raise ValueError("time_scale must be positive")
    build_dir = Path(build_dir or Path.cwd()/".arena_cache").resolve()
    bridge = build_bridge(build_dir)
    calibration_path = Path(calibration_path or build_dir/"cycles.json").resolve()
    calibration = load_calibration(bridge,cpus[:2*jobs],calibration_path)
    if log_dir:
        log_dir = Path(log_dir).resolve(); log_dir.mkdir(parents=True,exist_ok=True)
    results = [None]*len(matches)
    updates = queue.Queue()
    def worker(slot):
        try:
            for index in range(slot,len(matches),jobs):
                m = matches[index]
                log = log_dir/f"{index:05d}_seed{m.seed}_{m.labels[0]}-{m.labels[1]}.jsonl" if log_dir else None
                results[index] = run_game(m,bridge,cpus[2*slot:2*slot+2],calibration,log,time_scale)
                updates.put(index)
        except BaseException as error:
            updates.put(error)
            raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
        futures = [pool.submit(worker,slot) for slot in range(jobs)]
        next_output=0
        for _ in matches:
            update=updates.get()
            if isinstance(update,BaseException):
                raise update
            while next_output<len(results) and results[next_output] is not None:
                if on_result:
                    on_result(results[next_output])
                next_output+=1
        for future in futures:
            future.result()  # Tool/OS faults propagate, never become a player's loss.
    return results

def run_matches(matches, *, cpus, jobs=8, build_dir=None, calibration_path=None,
                log_dir=None,time_scale=1.0,on_result=None):
    """Run paired CPU-pinned slots; keep the referee/helpers on this CPU pool too."""
    with process_affinity(cpus):
        return _run_matches(matches,cpus=cpus,jobs=jobs,build_dir=build_dir,
            calibration_path=calibration_path,log_dir=log_dir,time_scale=time_scale,on_result=on_result)
