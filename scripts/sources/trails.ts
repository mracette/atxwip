import type { FeatureCollection, Geometry } from 'geojson';
import { z } from 'zod';
import type { Link, ProjectFeature, Status } from '../../src/types.ts';
import { mergeLines } from '../lib/geo.ts';
import { fetchJson } from '../lib/http.ts';
import { makeProject } from '../lib/project.ts';

const DATASET = 'https://data.austintexas.gov/resource/jdwm-wfps.geojson';
const SOURCE: Link = { label: 'City of Austin Urban Trails network', url: 'https://data.austintexas.gov/d/jdwm-wfps' };

const Row = z.object({
  urban_trail_name: z.string().nullish(),
  urban_trail_system_name: z.string().nullish(),
  phase_simple: z.string().nullish(),
  build_status: z.string().nullish(),
  year_open: z.coerce.number().nullish(),
  project_sponsor: z.string().nullish(),
});

export function trailStatus(phase: string | null | undefined): Status | undefined {
  if (phase === 'CONSTRUCTION') return 'active';
  if (phase === 'ACTIVE') return 'planned';
  if (phase === 'EXISTING') return 'complete';
  return undefined;
}

const BUILD_LABEL: Record<string, string> = {
  CONSTRUCTION: 'Under construction',
  DESIGN: 'In design',
  PRELIMINARY_ENGINEERING: 'In preliminary engineering',
  PROPOSED: 'Funded and in early planning',
  EXISTING: 'Open',
};

export async function fetchTrails(now = new Date()): Promise<ProjectFeature[]> {
  const recent = now.getUTCFullYear() - 1;
  const url = `${DATASET}?${new URLSearchParams({
    $where: `phase_simple in ('CONSTRUCTION','ACTIVE') OR (phase_simple = 'EXISTING' AND year_open >= '${recent}')`,
    $limit: '5000',
  })}`;
  const fc = await fetchJson<FeatureCollection<Geometry | null>>(url);
  const groups = new Map<string, { row: z.infer<typeof Row>; status: Status; geoms: Geometry[] }>();
  for (const f of fc.features) {
    const parsed = Row.safeParse(f.properties);
    if (!parsed.success || !f.geometry) continue;
    const status = trailStatus(parsed.data.phase_simple);
    if (!status) continue;
    const key = `${parsed.data.urban_trail_name ?? parsed.data.urban_trail_system_name}|${status}`;
    const g = groups.get(key) ?? { row: parsed.data, status, geoms: [] };
    g.geoms.push(f.geometry);
    groups.set(key, g);
  }
  const out: ProjectFeature[] = [];
  for (const [key, { row, status, geoms }] of groups) {
    const geometry = mergeLines(geoms);
    if (!geometry.coordinates.length) continue;
    const name = row.urban_trail_name?.trim() || row.urban_trail_system_name?.trim() || 'Urban trail';
    const system = row.urban_trail_system_name?.replace(/^.*?:\s*/, '').trim();
    out.push(makeProject(geometry, {
      id: `trail-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 90),
      name,
      category: 'trails',
      status,
      description: [system && !name.includes(system) ? `Part of the ${system}.` : '', `${BUILD_LABEL[row.build_status ?? ''] ?? ''}${row.build_status ? '.' : ''}`].filter(Boolean).join(' ') || undefined,
      developer: row.project_sponsor ?? undefined,
      end: row.year_open ? String(row.year_open) : undefined,
      links: [{ label: 'Austin Urban Trails program', url: 'https://www.austintexas.gov/UrbanTrails' }],
      sources: [SOURCE],
    }));
  }
  return out;
}
