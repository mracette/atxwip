export function fmtMoney(n: number): string {
  if (n >= 1e9) return `$${trim(n / 1e9)}B`;
  if (n >= 1e6) return `$${trim(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

function trim(n: number): string {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '');
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtCoord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
}

/** "2026-03-14" → "Mar 2026"; "2031" → "2031". */
export function fmtWhen(s: string): string {
  if (/^\d{4}$/.test(s)) return s;
  const d = new Date(`${s.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Fractional year for positioning on a timeline; bare years mean mid-year for ends, Jan 1 for starts. */
export function toYear(s: string, edge: 'start' | 'end' = 'start'): number {
  if (/^\d{4}$/.test(s)) return Number(s) + (edge === 'end' ? 1 : 0);
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  const y = d.getUTCFullYear();
  return y + (d.getTime() - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
