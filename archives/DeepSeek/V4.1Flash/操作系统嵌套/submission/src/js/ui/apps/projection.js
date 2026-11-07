// 投送窗口：根据来源应用挂载播放器或图表的内容视图
import * as players from './player.js';
import * as charts from './charts.js';
import { rt } from '../../store.js';
import * as M from '../../model.js';
import { el } from '../../util.js';
import { toast } from '../common.js';

export function mount(ctx) {
  const model = ctx.ui.model;
  const srcSys = model.systems[ctx.win.payload.sourceSystemId];
  const srcWin = srcSys ? srcSys.windows.find(w => w.id === ctx.win.payload.sourceWindowId) : null;
  if (!srcSys || !srcWin) {
    ctx.body.append(el('div', { class: 'empty-state' }, el('div', { class: 'big', text: '⧉' }), el('div', { text: '源应用已关闭，投送结束。' })));
    return {
      destroy() { },
      onTick() {
        const s = model.systems[ctx.win.payload.sourceSystemId];
        const w = s && s.windows.find(x => x.id === ctx.win.payload.sourceWindowId);
        if (!w && model.systems[ctx.win.systemId]) {
          M.closeWindow(model, model.systems[ctx.win.systemId], ctx.win.id);
          ctx.ui.refresh('projection-source-gone');
        }
      }
    };
  }
  let ctrl = null;
  if (srcWin.appId === 'player') ctrl = players.mountProjection(ctx);
  else if (srcWin.appId === 'charts') ctrl = charts.mountProjection(ctx);
  else {
    ctx.body.append(el('div', { class: 'empty-state', text: '该应用不支持投送。' }));
    return { destroy() { } };
  }
  if (!ctrl) return { destroy() { } };
  const origTick = ctrl.onTick;
  const origDestroy = ctrl.destroy;
  let closed = false;
  return {
    onTick() {
      if (!closed) {
        const proc = srcSys.processes.find(p => p.service === (srcWin.appId === 'player' ? 'player' : 'charts'));
        if (proc && proc.state === 'ended') {
          const targetSys = model.systems[ctx.win.systemId];
          if (targetSys) {
            closed = true;
            M.closeWindow(model, targetSys, ctx.win.id);
            ctx.ui.refresh('projection-ended');
            toast('投送已结束', '源应用进程已结束，投送视图已移除。', 'warn', targetSys);
          }
        }
      }
      if (!closed && origTick) origTick();
    },
    destroy() { if (origDestroy) origDestroy(); },
    requestClose: ctrl.requestClose
  };
}
