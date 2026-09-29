import type { FeatureCollection, Geometry } from 'geojson';
import { z } from 'zod';
import type { ClosureFeature, ClosureImpact } from '../../src/types.ts';
import { bbox, roundGeometry } from '../lib/geo.ts';
import { fetchJson } from '../lib/http.ts';
import { titleCase } from '../lib/project.ts';

const WORK_ZONES = 'https://data.austintexas.gov/resource/qyfh-gwei.geojson';
const DRIVETEXAS = 'https://api.drivetexas.org/api/conditions.geojson';
/** Roughly the map's bounds; DriveTexas is statewide. */
const AUSTIN: [number, number, number, number] = [-98.3, 29.95, -97.3, 30.65];

const WorkZone = z.object({
  road_names: z.string().nullish(),
  name: z.string().nullish(),
  vehicle_impact: z.string().nullish(),
  end_date: z.string().nullish(),
});

/** "AE/Mastec - W OLTORF ST 1400 BLK - REPLACE WIRING" → "Replace Wiring". Crew codes like "LTC" are dropped. */
export function workFromName(name: string | null | undefined): string | undefined {
  const parts = (name ?? '').split(' - ').map((p) => p.trim()).filter(Boolean);
  const last = parts.length > 1 ? parts.at(-1) : undefined;
  if (!last || last.length <= 3 || /^workzone event$/i.test(last)) return undefined;
  return titleCase(last);
}

export function impact(vehicleImpact: string | null | undefined): ClosureImpact {
  return vehicleImpact === 'all-lanes-closed' ? 'closed' : 'partial';
}

/** City right-of-way work zones in effect today. Many permits repeat one line per direction; those collapse to one. */
export async function fetchWorkZones(now = new Date()): Promise<ClosureFeature[]> {
  const ts = now.toISOString().slice(0, 19);
  const url = `${WORK_ZONES}?${new URLSearchParams({ $where: `start_date <= '${ts}' AND end_date >= '${ts}'`, $limit: '20000' })}`;
  const fc = await fetchJson<FeatureCollection<Geometry | null>>(url);
  const seen = new Set<string>();
  const out: ClosureFeature[] = [];
  for (const f of fc.features) {
    const parsed = WorkZone.safeParse(f.properties);
    if (!parsed.success || !f.geometry) continue;
    const geometry = roundGeometry(f.geometry);
    const key = JSON.stringify(geometry);
    if (seen.has(key)) continue;
    seen.add(key);
    const r = parsed.data;
    out.push({
      type: 'Feature',
      geometry,
      properties: prune({
        id: `wz-${out.length}`,
        road: titleCase(r.road_names ?? 'Street'),
        work: workFromName(r.name),
        impact: impact(r.vehicle_impact),
        end: r.end_date?.slice(0, 10),
        by: 'city',
      }),
    });
  }
  return out;
}

const Condition = z.object({
  GLOBALID: z.string(),
  condition: z.string().nullish(),
  route_name: z.string().nullish(),
  roadway: z.string().nullish(),
  description: z.string().nullish(),
  end_time: z.string().nullish(),
});

/**
 * DriveTexas descriptions open with "- Right lane closed.<br/>- Night work only."
 * bullets, then a free-text project note. The bullets are the useful summary.
 */
export function conditionText(html: string | null | undefined): string | undefined {
  const bullets = (html ?? '').split(/(?:<br\s*\/?>\s*){2,}/i)[0]!
    .split(/<br\s*\/?>/i)
    .map((b) => b.replace(/<[^>]+>/g, '').replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  const text = bullets.join(' ');
  return text ? (text.length > 140 ? `${text.slice(0, 139)}…` : text) : undefined;
}

export function conditionImpact(condition: string | null | undefined, text: string | undefined): ClosureImpact {
  return /closure/i.test(condition ?? '') || /main lanes closed|roadway is closed|road closed|all lanes closed/i.test(text ?? '') ? 'closed' : 'partial';
}

/** "IH0035" → "I-35", "FM0969" → "FM 969", "US0183A" → "US 183A". */
export function routeName(rte: string): string {
  const m = /^([A-Z]{2})0*(\d+[A-Z]?)$/.exec(rte.trim());
  if (!m) return rte;
  const [, kind, num] = m;
  const names: Record<string, string> = { IH: 'I-', US: 'US ', SH: 'SH ', SL: 'Loop ', FM: 'FM ', RM: 'RM ' };
  return kind! in names ? `${names[kind!]}${num}` : `${kind} ${num}`;
}

/** TxDOT lane and road closures from DriveTexas. Needs a free key from api.drivetexas.org. */
export async function fetchDriveTexas(key: string): Promise<ClosureFeature[]> {
  const fc = await fetchJson<FeatureCollection<Geometry | null>>(`${DRIVETEXAS}?key=${encodeURIComponent(key)}`).catch((err: Error) => {
    throw new Error(err.message.replaceAll(key, '***'));
  });
  const out: ClosureFeature[] = [];
  for (const f of fc.features) {
    const parsed = Condition.safeParse(f.properties);
    if (!parsed.success || !f.geometry || !inAustin(f.geometry)) continue;
    const r = parsed.data;
    if (!/construction|closure/i.test(r.condition ?? '')) continue;
    const text = conditionText(r.description);
    out.push({
      type: 'Feature',
      geometry: roundGeometry(f.geometry),
      properties: prune({
        id: `dt-${r.GLOBALID}`,
        road: r.roadway?.trim() || routeName(r.route_name ?? 'Highway'),
        work: text,
        impact: conditionImpact(r.condition, text),
        end: r.end_time?.slice(0, 10),
        by: 'txdot',
      }),
    });
  }
  return out;
}

function inAustin(g: Geometry): boolean {
  const [minX, minY, maxX, maxY] = bbox(g);
  return maxX >= AUSTIN[0] && minX <= AUSTIN[2] && maxY >= AUSTIN[1] && minY <= AUSTIN[3];
}

function prune<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}
