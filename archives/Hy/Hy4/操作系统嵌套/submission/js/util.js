/* 通用工具：纯数据克隆、ID、数值与时间格式化、HTML 转义等。 */
(function (OS) {
  'use strict';
  const util = {};

  util.deepClone = function (v, seen) {
    if (v === null || typeof v !== 'object') return v;
    seen = seen || new Map();
    if (seen.has(v)) return seen.get(v);
    if (Array.isArray(v)) {
      const a = []; seen.set(v, a);
      for (let i = 0; i < v.length; i++) a.push(util.deepClone(v[i], seen));
      return a;
    }
    const o = {}; seen.set(v, o);
    for (const k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = util.deepClone(v[k], seen);
    return o;
  };

  let _seq = 1;
  util.uid = (prefix) => (prefix || 'id') + '-' + (_seq++) + '-' + Math.floor(Math.random() * 100000);

  util.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  util.num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? (d === undefined ? 0 : d) : n; };
  util.escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  util.fmtClock = (d) => { const p = (x) => String(x).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); };
  util.fmtDate = (d) => d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  util.fmtSec = (s) => {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60), r = s - m * 60;
    return String(m).padStart(2, '0') + ':' + r.toFixed(2).padStart(5, '0');
  };
  util.colAddr = (c) => { let s = ''; c = c + 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  util.parseCell = (addr) => {
    const m = /^([A-Za-z]+)([0-9]+)$/.exec(addr || '');
    if (!m) return null;
    let c = 0; for (const ch of m[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { c: c - 1, r: parseInt(m[2], 10) - 1 };
  };
  util.rangeCells = (range) => {
    const m = /^([A-Z]+\d+):([A-Z]+\d+)$/.exec((range || '').replace(/\s/g, '').toUpperCase());
    if (!m) return null;
    const a = util.parseCell(m[1]), b = util.parseCell(m[2]);
    if (!a || !b) return null;
    return { r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
  };

  OS.util = util;
})(window.OS = window.OS || {});
