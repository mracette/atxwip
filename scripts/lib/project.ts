import type { Geometry } from 'geojson';
import type { Link, ProjectFeature, ProjectProps, Segment } from '../../src/types.ts';
import { anchor, roundGeometry } from './geo.ts';

export type ProjectInput = Omit<ProjectProps, 'lon' | 'lat' | 'segments' | 'links' | 'sources'> & {
  segments?: Segment[];
  links?: Link[];
  sources?: Link[];
};

export function makeProject(geometry: Geometry, input: ProjectInput): ProjectFeature {
  const g = roundGeometry(geometry);
  const [lon, lat] = anchor(g);
  const { segments, links, sources, ...rest } = input;
  const props: ProjectProps = { ...rest, lon: round(lon!), lat: round(lat!) };
  if (segments?.length) props.segments = JSON.stringify(segments);
  if (links?.length) props.links = JSON.stringify(links);
  if (sources?.length) props.sources = JSON.stringify(sources);
  for (const k of Object.keys(props) as (keyof ProjectProps)[]) {
    const v = props[k];
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) delete props[k];
  }
  return { type: 'Feature', geometry: g, properties: props };
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** "SOUTH CONGRESS AVE" → "South Congress Ave"; leaves mixed-case input alone. */
export function titleCase(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Ih|Us|Sh|Fm|Rm|Sl|Mf|Llc|Pud|Atx|Sup)\b/g, (m) => m.toUpperCase());
}

export function isoDate(ms: number | null | undefined): string | undefined {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : undefined;
}
