// Number and date formatting. Scores are 0-100 with one decimal; missing
// values print as an em dash. Figures use tabular digits in CSS (.num).
import { t, lang } from './i18n.js';

export const DASH = '—';

/** 74.7 -> "74.7"; null -> "—" */
export function fmtScore(v, digits = 1) {
  return v == null || Number.isNaN(+v) ? DASH : (+v).toFixed(digits);
}

/** Round to one decimal like the export does (ties are compared on this). */
export const round1 = (v) => (v == null ? null : Math.round(v * 10 + Number.EPSILON * 10) / 10);

/** "2026-11-04" -> "2026.11.04" */
export function fmtDate(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10).replace(/-/g, '.');
}

/** 15 -> "15%"; 12.5 -> "12.5%"; 7.5 -> "7.5%" */
export function fmtPct(w, digits = 1) {
  if (w == null) return DASH;
  const s = (+w).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return `${s}%`;
}

/** 1 -> "01" */
export function fmtRank(n, width = 2) {
  return n == null ? DASH : String(n).padStart(width, '0');
}

/** 1 -> "No.01" */
export function fmtNo(n) {
  return `No.${fmtRank(n)}`;
}

/** +14.7 -> "+14.7"; -0.1 -> "−0.1" (true minus sign); 0 -> "0.0" */
export function fmtDiff(v, digits = 1) {
  if (v == null) return DASH;
  const r = +(+v).toFixed(digits);
  if (r === 0) return (0).toFixed(digits);
  return (r > 0 ? '+' : '−') + Math.abs(r).toFixed(digits);
}

/** 60 -> "60 分钟" / "60 min" */
export function fmtMinutes(n) {
  return t('common.unit.minutes', { n });
}

/** Thousands separators for counts. */
export function fmtInt(n) {
  return n == null ? DASH : Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN');
}

/** "1 / 7" */
export function fmtRankOf(rank, of) {
  return rank == null ? DASH : t('common.score.rankShort', { n: rank, of });
}

/** "第 1 名" / "Rank 1"; null -> "评测中" */
export function fmtRankLabel(rank) {
  return rank == null ? t('common.score.pending') : t('common.score.rank', { n: rank });
}
