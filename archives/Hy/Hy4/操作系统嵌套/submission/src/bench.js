'use strict';
class Bench {
  constructor(engine, ui) {
    this.engine = engine; this.ui = ui; this.version = 1;
    // 主窗口可能被其它窗口完全盖住，Chromium 会停止 rAF；因此全部使用定时器，不依赖动画帧回调。
    window.bench = {
      version: 1,
      ready: () => engine.readyPromise.then(() => new Promise(r => setTimeout(() => r(true), 30))),
      reset: () => new Promise(resolve => {
        engine.reset();
        setTimeout(() => resolve(true), 260);
      }),
      inspect: () => engine.inspect(),
      _engine: () => engine
    };
  }
}
module.exports = Bench;
