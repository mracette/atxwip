import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Geometry } from 'geojson';
import type { DataMeta, ProjectCollection, ProjectFeature, SourceMeta } from '../src/types.ts';
import { ADDITIONS, LIGHT_RAIL, OVERRIDES, type Override } from './curated.ts';
import { COA, queryLayer } from './lib/arcgis.ts';
import { mergeLines } from './lib/geo.ts';
import { makeProject, type ProjectInput } from './lib/project.ts';
import { fetchCapitalProjects } from './sources/capital-projects.ts';
import { fetchDevelopment } from './sources/development.ts';
import { fetchMobility } from './sources/mobility.ts';
import { fetchTrails } from './sources/trails.ts';
import { fetchTxdot } from './sources/txdot.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SNAPSHOTS = path.join(ROOT, 'data/snapshots');
const OUT = path.join(ROOT, 'public/data');

interface Source {
  id: string;
  name: string;
  url: string;
  fetch: () => Promise<ProjectFeature[]>;
  /** A result smaller than this is treated as an upstream fault, not a real change. */
  minCount: number;
}

async function fetchLightRail(): Promise<ProjectFeature[]> {
  const rows = await queryLayer(`${COA}/Austin_Light_Rail_DTI_Employment_Forecast/FeatureServer/2`, { where: '1=1', outFields: ['OBJECTID'], precision: 5 });
  const lines = rows.map((f) => f.geometry).filter((g): g is Geometry => !!g);
  return lines.length ? [makeProject(mergeLines(lines), { id: 'light-rail-phase-1', ...LIGHT_RAIL })] : [];
}

async function fetchCurated(): Promise<ProjectFeature[]> {
  return ADDITIONS.map((a) => makeProject(a.geometry, a.input));
}

const SOURCES: Source[] = [
  { id: 'development', name: 'City of Austin building permits and site plans', url: 'https://data.austintexas.gov/d/3syk-w9eu', fetch: () => fetchDevelopment(), minCount: 500 },
  { id: 'capital-projects', name: 'City of Austin Capital Projects Explorer', url: 'https://capitalprojects.austintexas.gov/', fetch: fetchCapitalProjects, minCount: 30 },
  { id: 'txdot', name: 'TxDOT project information', url: 'https://www.txdot.gov/projects/project-tracker.html', fetch: fetchTxdot, minCount: 20 },
  { id: 'mobility', name: 'Austin Transportation & Public Works projects', url: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Moped_Project_Components_Complete_and_Construction_(Public_view)/FeatureServer', fetch: fetchMobility, minCount: 10 },
  { id: 'trails', name: 'City of Austin Urban Trails', url: 'https://data.austintexas.gov/d/jdwm-wfps', fetch: () => fetchTrails(), minCount: 10 },
  { id: 'light-rail', name: 'Austin Light Rail Phase 1 route (City of Austin GIS)', url: 'https://www.atptx.org/light-rail', fetch: fetchLightRail, minCount: 1 },
  { id: 'curated', name: 'Hand-checked major projects', url: 'https://github.com/mracette/austin-wip/blob/main/scripts/curated.ts', fetch: fetchCurated, minCount: 1 },
];

interface Snapshot { fetchedAt: string; features: ProjectFeature[] }

async function readSnapshot(id: string): Promise<Snapshot | undefined> {
  try {
    return JSON.parse(await readFile(path.join(SNAPSHOTS, `${id}.json`), 'utf8')) as Snapshot;
  } catch {
    return undefined;
  }
}

/**
 * Fetches a source, keeping its last good snapshot when the upstream fails
 * or returns implausibly little. One broken API never blanks the map.
 */
async function runSource(s: Source): Promise<{ features: ProjectFeature[]; meta: SourceMeta; ok: boolean }> {
  const started = Date.now();
  try {
    const features = await s.fetch();
    if (features.length < s.minCount) throw new Error(`only ${features.length} features (expected ≥ ${s.minCount})`);
    const fetchedAt = new Date().toISOString();
    await writeFile(path.join(SNAPSHOTS, `${s.id}.json`), JSON.stringify({ fetchedAt, features } satisfies Snapshot));
    console.log(`✓ ${s.id}: ${features.length} features in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    return { features, ok: true, meta: { id: s.id, name: s.name, url: s.url, count: features.length, fetchedAt } };
  } catch (err) {
    const snap = await readSnapshot(s.id);
    console.warn(`✗ ${s.id}: ${(err as Error).message}${snap ? ` (using snapshot from ${snap.fetchedAt})` : ' (no snapshot)'}`);
    const features = snap?.features ?? [];
    return { features, ok: false, meta: { id: s.id, name: s.name, url: s.url, count: features.length, fetchedAt: snap?.fetchedAt ?? '' } };
  }
}

export function applyOverrides(features: ProjectFeature[], overrides: Override[]): ProjectFeature[] {
  return features.map((f) => {
    const hits = overrides.filter(({ match: m }) =>
      (m.id === undefined || m.id === f.properties.id)
      && (m.idPrefix === undefined || f.properties.id.startsWith(m.idPrefix))
      && (m.name === undefined || m.name.test(f.properties.name)));
    if (!hits.length) return f;
    const { lon, lat, segments, links, sources, ...props } = f.properties;
    const input: ProjectInput = {
      ...props,
      segments: segments ? JSON.parse(segments) : undefined,
      links: links ? JSON.parse(links) : undefined,
      sources: sources ? JSON.parse(sources) : undefined,
    };
    for (const h of hits) Object.assign(input, h.set);
    if (input.flat === false) delete input.flat;
    return makeProject(f.geometry, input);
  });
}

async function main() {
  await mkdir(SNAPSHOTS, { recursive: true });
  await mkdir(OUT, { recursive: true });
  const results = [];
  // Sequential on purpose: these are small civic servers and a burst of parallel paging is rude.
  for (const s of SOURCES) results.push(await runSource(s));

  const seen = new Set<string>();
  const features = applyOverrides(results.flatMap((r) => r.features), OVERRIDES).filter((f) => {
    if (seen.has(f.properties.id)) return false;
    seen.add(f.properties.id);
    return true;
  });

  // Houses are most of the rows but opt-in on the map, so they ship in their own file.
  const files: Record<string, ProjectFeature[]> = {
    'projects.json': features.filter((f) => !f.properties.small),
    'homes.json': features.filter((f) => f.properties.small),
  };
  for (const [name, list] of Object.entries(files)) {
    const json = JSON.stringify({ type: 'FeatureCollection', features: list } satisfies ProjectCollection);
    await writeFile(path.join(OUT, name), json);
    console.log(`Wrote ${list.length} features to ${name} (${(Buffer.byteLength(json) / 1024).toFixed(0)} KB)`);
  }
  const meta: DataMeta = { generatedAt: new Date().toISOString(), sources: results.map((r) => r.meta) };
  await writeFile(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
  if (results.every((r) => !r.ok)) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
