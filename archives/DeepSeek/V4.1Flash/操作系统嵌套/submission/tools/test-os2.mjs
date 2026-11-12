import { NestedOS } from '../src/core/os.js';
const os = new NestedOS();
await os.init({}, null);
await os.start();
const child = os.createChildSystem('outer');
for (let i=0;i<4;i++) {
  await new Promise(r=>setTimeout(r,200));
  console.log('t', i, 'rootTick', os.tickId, 'rootClock', os.root.clock.toFixed(2), 'childClock', child.clock.toFixed(2), 'carrier', (os.carrierOf(child)?.cpu||0), 'k', (os.carrierOf(child)?.cpuKernel||0), 'spent', child.spent, 'kernelCpu', child.processes[0]?.cpu);
}
os.stopTicking(); process.exit(0);
