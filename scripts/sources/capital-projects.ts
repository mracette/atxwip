import type { Geometry } from 'geojson';
import { z } from 'zod';
import type { Category, Link, ProjectFeature, Status } from '../../src/types.ts';
import { area } from '../lib/geo.ts';
import { fetchJson } from '../lib/http.ts';
import { makeProject } from '../lib/project.ts';

// The Capital Projects Explorer's own JSON feed. It is internal to that web
// app (its Socrata dataset isn't publicly queryable), so a failure here falls
// back to the last good snapshot like any other source.
const URL = 'https://capitalprojects.austintexas.gov/api/projects';
const SOURCE: Link = { label: 'City of Austin Capital Projects Explorer', url: 'https://capitalprojects.austintexas.gov/' };

const CATEGORY: Record<string, Category> = {
  'Mobility Infrastructure': 'transport',
  Facilities: 'civic',
  'Park Amenities': 'trails',
  Housing: 'residential',
  Other: 'civic',
};

const STAGE: Record<string, Status> = { Construction: 'active', Active: 'planned', Anticipated: 'planned' };

/** Small repairs clutter the map without telling you anything about the city changing. */
const MIN_BUDGET = 1_000_000;

const Row = z.object({
  project_id: z.string(),
  project_name: z.string(),
  project_description: z.string().nullish(),
  category_id: z.string().nullish(),
  project_stage_id: z.string().nullish(),
  budget: z.coerce.number().nullish(),
  project_start_date: z.string().nullish(),
  project_end_date: z.string().nullish(),
  project_column_filter_entry3: z.string().nullish(),
  project_image: z.unknown().optional(),
  shapes: z.union([z.string(), z.array(z.object({ the_geom: z.unknown() }))]).nullish(),
});

const SEASON_MONTH: Record<string, string> = { spring: '04', summer: '07', fall: '10', autumn: '10', winter: '01' };

/** "Anticipated Winter 2028-29" → "2029-01"; "Summer 2024" → "2024-07"; "2027" → "2027". */
export function seasonDate(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/(spring|summer|fall|autumn|winter)?\s*(\d{4})(?:\s*-\s*(\d{2,4}))?/i);
  if (!m) return undefined;
  const season = m[1]?.toLowerCase();
  let year = Number(m[2]);
  if (season === 'winter' && m[3]) year += 1;
  return season ? `${year}-${SEASON_MONTH[season]}` : String(year);
}

/** The feed stores its photo as `{ url }`, occasionally as a list or a bare string. */
export function imageUrl(v: unknown): string | undefined {
  const first = Array.isArray(v) ? v[0] : v;
  const url = typeof first === 'string' ? first : (first as { url?: unknown } | null)?.url;
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url.replace(/^http:/, 'https:') : undefined;
}

export function describe(html: string | null | undefined): { description?: string; address?: string } {
  if (!html) return {};
  const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const para = html.match(/<p>([\s\S]*?)<\/p>/i)?.[1];
  const loc = html.match(/Project Location:\s*([^<]+)/i)?.[1];
  return { description: para ? text(para) : undefined, address: loc ? text(loc) : undefined };
}

function geometryOf(shapes: z.infer<typeof Row>['shapes']): Geometry | undefined {
  const list = typeof shapes === 'string' ? (JSON.parse(shapes || '[]') as { the_geom: unknown }[]) : shapes ?? [];
  const polys = list
    .map((s) => s.the_geom as Geometry | undefined)
    .filter((g): g is Geometry => !!g && (g.type === 'Polygon' || g.type === 'MultiPolygon'));
  if (!polys.length) return undefined;
  return { type: 'MultiPolygon', coordinates: polys.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])) };
}

export async function fetchCapitalProjects(): Promise<ProjectFeature[]> {
  const rows = await fetchJson<unknown[]>(URL);
  const out: ProjectFeature[] = [];
  for (const raw of rows) {
    const parsed = Row.safeParse(raw);
    if (!parsed.success) continue;
    const r = parsed.data;
    const category = CATEGORY[r.category_id ?? ''];
    const status = STAGE[r.project_stage_id ?? ''];
    if (!category || !status || (r.budget ?? 0) < MIN_BUDGET) continue;
    const geometry = geometryOf(r.shapes);
    if (!geometry) continue;
    const { description, address } = describe(r.project_description);
    out.push(makeProject(geometry, {
      id: `cpe-${r.project_id}`,
      name: r.project_name.trim(),
      category,
      status,
      description: description && description !== r.project_name ? description : undefined,
      address,
      cost: r.budget ?? undefined,
      developer: r.project_column_filter_entry3 ?? undefined,
      start: seasonDate(r.project_start_date),
      end: seasonDate(r.project_end_date),
      image: imageUrl(r.project_image),
      imageCredit: imageUrl(r.project_image) ? 'Photo: City of Austin' : undefined,
      footprint: 'Project area',
      // Capital project shapes are work areas (whole parks, road rights-of-way), not buildings.
      flat: true,
      links: [{ label: 'Capital Projects Explorer', url: `https://capitalprojects.austintexas.gov/projects/${r.project_id}` }],
      sources: [SOURCE],
    }));
  }
  return out.sort((a, b) => area(b.geometry) - area(a.geometry));
}
