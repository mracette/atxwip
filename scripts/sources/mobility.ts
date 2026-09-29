import type { Geometry } from 'geojson';
import { z } from 'zod';
import type { Link, ProjectFeature } from '../../src/types.ts';
import { COA, queryLayer } from '../lib/arcgis.ts';
import { mergeLines } from '../lib/geo.ts';
import { isoDate, makeProject } from '../lib/project.ts';

const LAYER = `${COA}/Moped_Project_Components_Complete_and_Construction_(Public_view)/FeatureServer/1`;
const SOURCE: Link = { label: 'Austin Transportation & Public Works (Moped)', url: 'https://mobility.austin.gov/' };

// TxDOT's own records cover the I-35 segments in more detail.
const COVERED_ELSEWHERE = /^(IH 35|Capital Express)/i;

const Row = z.object({
  project_id: z.number(),
  project_name: z.string(),
  project_sponsor: z.string().nullish(),
  project_website: z.string().nullish(),
  substantial_completion_date: z.number().nullish(),
  funding_sources: z.string().nullish(),
});

/** Judged on the subject only: "Burnet Rd from White Horse Trail to US 183" is a road project. */
export function isTrail(name: string): boolean {
  const subject = name.split(/\s(?:from|between|at)\s/i)[0] ?? name;
  return /\b(trail|SUPs?|shared.use path|greenway)\b/i.test(subject);
}

export async function fetchMobility(): Promise<ProjectFeature[]> {
  const rows = await queryLayer(LAYER, {
    where: `current_phase_name_simple = 'Construction'`,
    outFields: Object.keys(Row.shape),
    precision: 5,
  });
  const byProject = new Map<number, { row: z.infer<typeof Row>; geoms: Geometry[] }>();
  for (const f of rows) {
    const parsed = Row.safeParse(f.properties);
    if (!parsed.success || !f.geometry) continue;
    const entry = byProject.get(parsed.data.project_id) ?? { row: parsed.data, geoms: [] };
    entry.geoms.push(f.geometry);
    byProject.set(parsed.data.project_id, entry);
  }
  const out: ProjectFeature[] = [];
  for (const { row, geoms } of byProject.values()) {
    const name = row.project_name.replace(/_/g, ' ').trim();
    const geometry = mergeLines(geoms);
    if (COVERED_ELSEWHERE.test(name) || !geometry.coordinates.length) continue;
    out.push(makeProject(geometry, {
      id: `moped-${row.project_id}`,
      name,
      category: isTrail(name) ? 'trails' : 'transport',
      status: 'active',
      description: row.funding_sources ? `Funded by ${row.funding_sources.split(',').map((s) => s.trim()).filter((s, i, a) => a.indexOf(s) === i).slice(0, 3).join(', ')}.` : undefined,
      developer: row.project_sponsor ?? undefined,
      end: isoDate(row.substantial_completion_date),
      links: row.project_website ? [{ label: 'Project website', url: row.project_website }] : [],
      sources: [SOURCE],
    }));
  }
  return out;
}
