'use strict';

let counters = {};
function uid(prefix) {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return prefix + '-' + counters[prefix];
}
function resetIds() { counters = {}; }
function setIdCounters(c) { counters = Object.assign({}, c || {}); }
function getIdCounters() { return Object.assign({}, counters); }

function deepClone(x) {
  if (x === undefined) return undefined;
  return JSON.parse(JSON.stringify(x));
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtTime(t) {
  t = Math.max(0, Number(t) || 0);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  const p2 = n => String(n).padStart(2, '0');
  return (h ? p2(h) + ':' : '') + p2(m) + ':' + p2(s) + '.' + p2(cs);
}
function fmtClock(d) {
  const p2 = n => String(n).padStart(2, '0');
  return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
}
function fmtDate(d) {
  const p2 = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}
function num(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (dflt === undefined ? 0 : dflt);
}
function jsonSize(x) {
  try { return JSON.stringify(x).length; } catch (e) { return 8; }
}
function nowReal() { return Date.now(); }

class Emitter {
  constructor() { this.map = {}; }
  on(k, fn) { (this.map[k] = this.map[k] || []).push(fn); return () => this.off(k, fn); }
  off(k, fn) { if (this.map[k]) this.map[k] = this.map[k].filter(f => f !== fn); }
  emit(k, v) { (this.map[k] || []).slice().forEach(fn => { try { fn(v); } catch (e) { console.error('emit ' + k, e); } }); }
}

module.exports = { uid, resetIds, setIdCounters, getIdCounters, deepClone, clamp, esc, fmtTime, fmtClock, fmtDate, num, jsonSize, nowReal, Emitter };
