/* scheduler.js — logical-step budget & scheduling shared by root and subsystems.
   Work unit = 1 instruction or 1 defined compute step. Budget is per logical step. */

export class Process {
  constructor(opts) {
    this.pid = opts.pid;
    this.name = opts.name;
    this.ownerSystem = opts.ownerSystem;
    this.kind = opts.kind || 'user'; // user | kernel | app-service | carrier | host-app
    this.state = 'ready'; // ready | running | waiting | suspended | ended | error
    this.program = opts.program || null;
    this.interp = opts.interp || null;
    this.pcState = opts.pcState || null;
    this.parentPid = opts.parentPid || 0;
    this.priority = opts.priority ?? 1;
    this.quota = opts.quota ?? Infinity;   // max units usable per step
    this.usedThisStep = 0;
    this.totalUsed = 0;
    this.memUsage = opts.memUsage || 0;
    this.error = null;
    this.waitReason = null;
    this.waitUntil = 0;
    this.messages = [];
    this.waitingRecv = false;
    this.spawnTime = 0;
    this.output = [];
    this.extra = opts.extra || {};
    this.runFn = opts.runFn || null; // host-app processes: (budget) => consumed
  }
}

export class Scheduler {
  constructor(system) {
    this.system = system;
    this.processes = new Map();
    this.nextPid = 1;
    this.totalBudget = 4000;     // units per logical step for this system
    this.usedThisStep = 0;
    this.stepIndex = 0;
  }
  createPid() { return this.nextPid++; }

  addProcess(opts) {
    const p = new Process({ ...opts, pid: opts.pid || this.createPid() });
    p.spawnTime = this.system ? this.system.now() : 0;
    this.processes.set(p.pid, p);
    return p;
  }
  get(pid) { return this.processes.get(pid) || null; }
  removeProcess(pid) {
    const p = this.processes.get(pid);
    if (p) {
      p.state = 'ended';
      this.processes.delete(pid);
    }
    return p;
  }
  list() { return [...this.processes.values()]; }

  /* run one logical scheduling step: distribute budget among ready processes */
  step() {
    this.stepIndex++;
    this.usedThisStep = 0;
    for (const p of this.processes.values()) p.usedThisStep = 0;

    const ready = this.list().filter(p => p.state === 'ready' || p.state === 'running');
    // wake waiters whose time has come
    const now = this.system ? this.system.now() : 0;
    for (const p of this.processes.values()) {
      if (p.state === 'waiting' && p.waitReason === 'time' && p.waitUntil <= now) {
        p.state = 'ready';
        p.waitReason = null;
      }
    }
    // round-robin with quota cap
    const runnable = this.list().filter(p => p.state === 'ready' || p.state === 'running')
      .sort((a, b) => b.priority - a.priority);
    let progress = true;
    let guard = 0;
    while (progress && this.usedThisStep < this.totalBudget && guard++ < 1000) {
      progress = false;
      for (const p of runnable) {
        if (this.usedThisStep >= this.totalBudget) break;
        if (p.state !== 'ready' && p.state !== 'running') continue;
        const remainQuota = p.quota === Infinity ? Infinity : p.quota - p.usedThisStep;
        if (remainQuota <= 0) continue;
        const grant = Math.min(
          remainQuota === Infinity ? 400 : remainQuota,
          this.totalBudget - this.usedThisStep,
          400
        );
        if (grant <= 0) continue;
        p.state = 'running';
        const consumed = this._runProcess(p, grant);
        p.usedThisStep += consumed;
        p.totalUsed += consumed;
        this.usedThisStep += consumed;
        progress = true;
        if (p.state === 'running') p.state = 'ready';
      }
    }
    return this.usedThisStep;
  }

  _runProcess(p, grant) {
    if (p.runFn) {
      try { return p.runFn(grant) || 0; }
      catch (e) {
        p.state = 'error';
        p.error = e.message || String(e);
        return 0;
      }
    }
    if (p.interp) {
      // continue or start an interpreted program
      try {
        p.interp.maxInstr = p.interp.instrCount + grant;
        const r = p.continueRun ? p.continueRun() : p.interp.run(p.program, p.scope);
        const consumed = (p.interp.instrCount - (p.usedThisStep || 0)) || grant;
        if (r.status === 'done') {
          p.state = 'ended';
          p.result = r.value;
          if (p.onDone) p.onDone(r);
        } else if (r.status === 'error') {
          p.state = 'error';
          p.error = r.error;
          if (p.onError) p.onError(r);
        } else if (r.status === 'budget') {
          p.state = 'ready'; // out of budget this step
          p.continueRun = () => p.interp.continue();
        } else if (r.status === 'suspend') {
          if (r.suspend && r.suspend.reason === 'wait') {
            p.state = 'waiting';
            p.waitReason = 'time';
            p.waitUntil = (this.system ? this.system.now() : 0) + (r.suspend.ms || 0);
          } else if (r.suspend && r.suspend.reason === 'recv') {
            p.state = 'waiting';
            p.waitReason = 'recv';
            p.waitingRecv = true;
          } else if (r.suspend && r.suspend.reason === 'syscall') {
            p.state = 'waiting';
            p.waitReason = 'syscall';
            if (p.onSyscall) p.onSyscall(r.suspend);
          } else {
            p.state = 'ready';
          }
          p.continueRun = () => p.interp.continue();
        }
        return Math.max(0, p.interp.instrCount - (p.stepBase || 0));
      } catch (e) {
        p.state = 'error';
        p.error = e.message || String(e);
        return 0;
      }
    }
    return 0;
  }

  /* deliver message; returns false if target gone */
  deliver(toPid, msg) {
    const p = this.processes.get(toPid);
    if (!p || p.state === 'ended' || p.state === 'error') return false;
    p.messages.push(msg);
    if (p.state === 'waiting' && p.waitReason === 'recv') {
      p.state = 'ready';
      p.waitReason = null;
      p.waitingRecv = false;
    }
    return true;
  }

  suspendProcess(pid) {
    const p = this.processes.get(pid);
    if (p && (p.state === 'ready' || p.state === 'running' || p.state === 'waiting')) {
      p.state = 'suspended';
      p.suspendPrevState = p.state;
      return true;
    }
    return false;
  }
  resumeProcess(pid) {
    const p = this.processes.get(pid);
    if (p && p.state === 'suspended') {
      p.state = p.waitingRecv ? 'waiting' : 'ready';
      return true;
    }
    return false;
  }
  killProcess(pid) {
    const p = this.processes.get(pid);
    if (p) {
      p.state = 'ended';
      p.killed = true;
      if (p.onKilled) p.onKilled();
      this.processes.delete(pid);
      return true;
    }
    return false;
  }
}

/* Budget chain: a system's effective budget is min(localTotal, parentGrant) */
export class BudgetChain {
  constructor() {
    this.localTotal = 4000;
    this.parentGrant = Infinity;
  }
  effective() { return Math.min(this.localTotal, this.parentGrant); }
}
