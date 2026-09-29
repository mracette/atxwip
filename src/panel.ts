import type { Geometry, Position } from 'geojson';
import { escapeHtml as esc, fmtCoord, fmtInt, fmtMoney, fmtWhen, toYear } from './format.ts';
import type { Category, Link, ProjectFeature, Segment, Status } from './types.ts';

export const CATEGORY_LABEL: Record<Category, string> = {
  residential: 'Residential',
  commercial: 'Commercial & mixed-use',
  civic: 'Civic & major projects',
  transport: 'Transportation',
  trails: 'Trails & parks',
};

export const STATUS_LABEL: Record<Status, string> = {
  planned: 'Planned',
  active: 'Under construction',
  complete: 'Complete',
};

export const STATUS_GLYPH: Record<Status, string> = { planned: '○', active: '◐', complete: '●' };

export function statusChip(s: Status): string {
  return `<span class="chip ${s}"><span aria-hidden="true">${STATUS_GLYPH[s]}</span>${STATUS_LABEL[s]}</span>`;
}

function parseJson<T>(s: string | undefined): T[] {
  if (!s) return [];
  try {
    return JSON.parse(s) as T[];
  } catch {
    return [];
  }
}

function lines(g: Geometry): Position[][] {
  switch (g.type) {
    case 'LineString': return [g.coordinates];
    case 'MultiLineString': return g.coordinates;
    case 'Polygon': return g.coordinates;
    case 'MultiPolygon': return g.coordinates.flat();
    default: return [];
  }
}

const EARTH_M = 6371008.8;
function lengthMiles(g: Geometry): number {
  let m = 0;
  for (const line of lines(g)) {
    for (let i = 1; i < line.length; i++) {
      const [x1, y1] = line[i - 1]!;
      const [x2, y2] = line[i]!;
      const rad = Math.PI / 180;
      const a = Math.sin(((y2! - y1!) * rad) / 2) ** 2 + Math.cos(y1! * rad) * Math.cos(y2! * rad) * Math.sin(((x2! - x1!) * rad) / 2) ** 2;
      m += 2 * EARTH_M * Math.asin(Math.sqrt(a));
    }
  }
  return m / 1609.344;
}

function hero(f: ProjectFeature): [string, string] | null {
  const p = f.properties;
  if (p.floors) return [String(p.floors), p.floors === 1 ? 'floor' : 'floors'];
  if (p.units && p.units > 1) return [fmtInt(p.units), 'homes'];
  const isLine = f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString';
  if (isLine) {
    const mi = lengthMiles(f.geometry);
    if (mi >= 0.1) return [mi.toFixed(1), 'miles'];
  }
  if (p.cost) return [fmtMoney(p.cost), 'est. cost'];
  return null;
}

function stats(f: ProjectFeature): string {
  const p = f.properties;
  const rows: [string, string | undefined][] = [
    ['Height', p.height_m ? `${fmtInt(p.height_m * 3.2808)} ft` : undefined],
    ['Homes', p.units ? `${fmtInt(p.units)} units` : undefined],
    ['Floor area', p.sqft ? `${fmtInt(p.sqft)} sq ft` : undefined],
    ['Cost', p.cost ? fmtMoney(p.cost) : undefined],
    ['Developer', p.developer],
    ['Started', p.start ? fmtWhen(p.start) : undefined],
    [p.status === 'complete' ? 'Finished' : 'Expected', p.end ? fmtWhen(p.end) : undefined],
    ['Address', p.address],
    ['Permit', p.permit],
  ];
  const html = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v!)}</dd></div>`)
    .join('');
  return html ? `<dl class="stats">${html}</dl>` : '';
}

/** A timeline row; rows with an `id` stand for another project on the same corridor. */
export type TimelineRow = Segment & { id?: string; current?: boolean };

/**
 * A dimension-line timeline: year ticks on a hairline, one bar per segment,
 * solid for the past and hatched for the future, with a TODAY marker.
 */
export function timeline(segments: TimelineRow[], category: Category, today = new Date(), title = 'Schedule'): string {
  const rows = segments.filter((s) => s.start && s.end);
  if (!rows.length) return '';
  const now = today.getUTCFullYear() + today.getUTCMonth() / 12;
  const starts = rows.map((s) => toYear(s.start));
  const ends = rows.map((s) => toYear(s.end, 'end'));
  const min = Math.floor(Math.min(...starts, now));
  const max = Math.ceil(Math.max(...ends, now + 0.5));
  const W = 360;
  const x = (y: number) => ((y - min) / (max - min)) * W;
  const rowH = rows.length > 1 ? 30 : 16;
  const top = 14;
  const height = top + rows.length * rowH + 22;
  const color = `var(--cat-${category})`;
  const step = max - min > 8 ? 2 : 1;

  let svg = `<defs><pattern id="tl-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${color}" opacity="0.15"/><line x1="0" y1="0" x2="0" y2="5" stroke="${color}" stroke-width="2" opacity="0.7"/></pattern></defs>`;
  rows.forEach((s, i) => {
    const y = top + i * rowH + (rows.length > 1 ? 16 : 0);
    const a = x(toYear(s.start));
    const b = Math.max(x(toYear(s.end, 'end')), a + 2);
    const split = Math.min(Math.max(x(now), a), b);
    const linked = s.id && !s.current;
    if (linked) svg += `<g class="tl-row" data-segment="${esc(s.id!)}" tabindex="0" role="button" aria-label="${esc(s.label)}, ${fmtWhen(s.start)} to ${fmtWhen(s.end)}"><rect class="tl-hit" x="-4" y="${y - rowH + 8}" width="${W + 8}" height="${rowH}" rx="3"/>`;
    if (rows.length > 1) {
      svg += `<text x="0" y="${y - 4}" class="tl-text${s.current ? ' current' : ''}">${esc(s.label)}</text>`;
      svg += `<text x="${W}" y="${y - 4}" text-anchor="end" class="tl-text mono">${fmtWhen(s.start)}–${fmtWhen(s.end)}</text>`;
    }
    svg += `<rect x="${a}" y="${y}" width="${split - a}" height="6" rx="1" fill="${color}"/>`;
    svg += `<rect x="${split}" y="${y}" width="${b - split}" height="6" rx="1" fill="url(#tl-hatch)"/>`;
    if (linked) svg += '</g>';
  });
  const axisY = height - 16;
  svg += `<line x1="0" x2="${W}" y1="${axisY}" y2="${axisY}" stroke="var(--ink-3)" stroke-width="1"/>`;
  for (let yr = min; yr <= max; yr += step) {
    const tx = x(yr);
    const cap = yr === min || yr === max;
    svg += `<line x1="${tx}" x2="${tx}" y1="${axisY - (cap ? 5 : 3)}" y2="${axisY + (cap ? 5 : 0)}" stroke="var(--ink-3)"/>`;
    if (yr < max) svg += `<text x="${tx + 2}" y="${axisY + 13}" class="tl-year">${yr}</text>`;
  }
  const nx = x(now);
  svg += `<line x1="${nx}" x2="${nx}" y1="6" y2="${axisY}" stroke="var(--accent)" stroke-width="1"/>`;
  svg += `<path d="M${nx - 4} 0h8l-4 6z" fill="var(--accent)"/>`;
  svg += `<text x="${nx + 6}" y="7" class="tl-today">TODAY</text>`;

  return `<span class="eyebrow section-label">${esc(title)}</span>
    <div class="timeline"><svg viewBox="0 0 ${W} ${height}" role="group" aria-label="${esc(title)}">${svg}</svg></div>`;
}

/** Draws the project's own geometry as a little site plan: hatch fill, north arrow, scale bar. */
function footprintPlan(f: ProjectFeature, category: Category): string {
  const rings = lines(f.geometry);
  if (!rings.length || f.geometry.type === 'Point') return '';
  const lat0 = f.properties.lat;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  const pts = rings.map((r) => r.map(([lon, lat]) => [lon! * kx, -lat! * ky] as const));
  const all = pts.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 360, H = 150, pad = 18;
  const s = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1));
  const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
  const isArea = f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon';
  const d = pts.map((r) => 'M' + r.map(([px, py]) => `${(ox + (px - minX) * s).toFixed(1)} ${(oy + (py - minY) * s).toFixed(1)}`).join('L') + (isArea ? 'Z' : '')).join('');
  const color = `var(--cat-${category})`;

  const niceM = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((m) => m * s > 40) ?? 5000;
  const barW = niceM * s;
  const label = niceM >= 1000 ? `${niceM / 1000} km` : `${niceM} m`;

  return `<figure class="footprint-plan">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Footprint plan">
      <defs><pattern id="plan-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${color}" stroke-width="1" opacity="0.6"/></pattern></defs>
      <path d="${d}" fill="${isArea ? 'url(#plan-hatch)' : 'none'}" stroke="${isArea ? 'var(--ink)' : color}" stroke-width="${isArea ? 1 : 3}" stroke-linejoin="round" stroke-linecap="round"/>
      <g transform="translate(${W - 20} 22)" fill="var(--ink-2)"><path d="M0 -12L5 4L0 1L-5 4Z"/><text y="16" text-anchor="middle" class="tl-year">N</text></g>
      <g transform="translate(${W - 20 - barW} ${H - 12})" stroke="var(--ink-2)"><line x2="${barW}"/><line y1="-4" y2="0"/><line x1="${barW}" x2="${barW}" y1="-4" y2="0"/><text x="${barW / 2}" y="-6" text-anchor="middle" class="tl-year" stroke="none" fill="var(--ink-2)">${label}</text></g>
    </svg>
    <figcaption class="source-line">${esc(f.properties.footprint ?? 'Project boundary')}</figcaption>
  </figure>`;
}

/** Every segment on the project's corridor, in start order, with the project's own rows marked. */
export function corridorRows(f: ProjectFeature, members: ProjectFeature[]): TimelineRow[] {
  return members
    .flatMap((m) => parseJson<Segment>(m.properties.segments).map((s) => ({ ...s, id: m.properties.id, current: m.properties.id === f.properties.id })))
    .sort((a, b) => toYear(a.start) - toYear(b.start) || toYear(a.end, 'end') - toYear(b.end, 'end'));
}

export function renderPanel(f: ProjectFeature, updatedAt: string | undefined, corridor: ProjectFeature[] = []): string {
  const p = f.properties;
  const h = hero(f);
  const rows = corridor.length > 1 ? corridorRows(f, corridor) : parseJson<Segment>(p.segments);
  if (!rows.length && p.start && p.end) rows.push({ label: '', start: p.start, end: p.end });
  const links = parseJson<Link>(p.links);
  const sources = parseJson<Link>(p.sources);

  return `
    <div class="panel-top">
      <span class="eyebrow mono">${fmtCoord(p.lat, p.lon)}${p.neighborhood ? ` · ${esc(p.neighborhood)}` : ''}</span>
      <button class="close-btn" type="button" data-close aria-label="Close">×</button>
    </div>
    <h2 class="panel-title">${esc(p.name)}</h2>
    <div class="chips">
      ${statusChip(p.status)}
      <span class="chip cat"><span class="dot" style="background:var(--cat-${p.category})"></span>${CATEGORY_LABEL[p.category]}</span>
    </div>
    ${h ? `<div class="hero"><span class="hero-value">${esc(h[0])}</span><span class="hero-unit">${h[1]}</span></div>` : ''}
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
    ${stats(f)}
    ${timeline(rows, p.category, new Date(), corridor.length > 1 && p.corridor ? `${p.corridor} schedule` : 'Schedule')}
    ${footprintPlan(f, p.category)}
    ${links.length ? `<div class="links">${links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div>` : ''}
    <div class="tick-rule" aria-hidden="true"></div>
    <p class="source-line">Source&nbsp; ${sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ') || 'Hand-curated'}</p>
    ${updatedAt ? `<p class="source-line">Updated&nbsp; ${esc(updatedAt.slice(0, 10))}</p>` : ''}
  `;
}
