import { z } from 'zod';
import type { Link, ProjectFeature, Status } from '../../src/types.ts';
import { queryLayer, TXDOT } from '../lib/arcgis.ts';
import { isoDate, makeProject, titleCase } from '../lib/project.ts';

const LAYER = `${TXDOT}/TxDOT_DCIS_All_Projects/FeatureServer/0`;
const SOURCE: Link = { label: 'TxDOT project information (DCIS)', url: 'https://www.txdot.gov/projects/project-tracker.html' };
const MIN_COST = 20_000_000;

const Row = z.object({
  CONTROL_SECT_JOB: z.string(),
  HIGHWAY_NUMBER: z.string().nullish(),
  PROJ_CLASS: z.string().nullish(),
  TYPE_OF_WORK: z.string().nullish(),
  LIMITS_FROM: z.string().nullish(),
  LIMITS_TO: z.string().nullish(),
  EST_CONSTRUCTION_COST: z.number().nullish(),
  PROJ_STG: z.string().nullish(),
  PROJ_STAT: z.string().nullish(),
  PROJ_ESTMTD_LET_D: z.number().nullish(),
  ACTUAL_LET_DATE: z.number().nullish(),
});

export function stageStatus(stage: string | null | undefined): Status {
  return /construct/i.test(stage ?? '') ? 'active' : 'planned';
}

/** "IH 35" → "I-35", "SL 360" → "Loop 360". */
export function highwayName(h: string): string {
  const [kind, num] = h.trim().split(/\s+/, 2);
  const names: Record<string, string> = { IH: 'I-', US: 'US ', SH: 'SH ', SL: 'Loop ', FM: 'FM ', RM: 'RM ', CR: 'County Rd ', CS: '' };
  return kind && kind in names ? `${names[kind]}${num ?? ''}`.trim() : h;
}

export function formatCsj(csj: string): string {
  return csj.length === 9 ? `${csj.slice(0, 4)}-${csj.slice(4, 6)}-${csj.slice(6)}` : csj;
}

function limits(from?: string | null, to?: string | null): string {
  const f = from ? titleCase(from) : '';
  const t = to && to.trim() !== '.' ? titleCase(to) : '';
  return t ? `${f} to ${t}` : f;
}

export async function fetchTxdot(): Promise<ProjectFeature[]> {
  const rows = await queryLayer(LAYER, {
    where: `COUNTY_NAME = 'Travis' AND PROJ_STAT NOT IN ('Closed','Cancelled') AND PROJ_STG NOT IN ('Closed','Cancelled') AND EST_CONSTRUCTION_COST >= ${MIN_COST}`,
    outFields: Object.keys(Row.shape),
    precision: 5,
  });
  const out: ProjectFeature[] = [];
  for (const f of rows) {
    const parsed = Row.safeParse(f.properties);
    if (!parsed.success || !f.geometry) continue;
    const r = parsed.data;
    const hwy = highwayName(r.HIGHWAY_NUMBER ?? '');
    const where = limits(r.LIMITS_FROM, r.LIMITS_TO);
    const csj = formatCsj(r.CONTROL_SECT_JOB);
    const isCapexCentral = csj.startsWith('0015-13-');
    out.push(makeProject(f.geometry, {
      id: `txdot-${csj}`,
      name: `${hwy}: ${where}`,
      category: 'transport',
      status: stageStatus(r.PROJ_STG),
      description: [r.PROJ_CLASS, r.TYPE_OF_WORK && r.TYPE_OF_WORK !== r.PROJ_CLASS ? r.TYPE_OF_WORK : null].filter(Boolean).join('. ') + (r.PROJ_STG ? `. TxDOT stage: ${r.PROJ_STG}.` : '.'),
      cost: r.EST_CONSTRUCTION_COST ?? undefined,
      developer: 'TxDOT',
      start: isoDate(r.ACTUAL_LET_DATE ?? r.PROJ_ESTMTD_LET_D),
      permit: `CSJ ${csj}`,
      links: [
        ...(isCapexCentral ? [{ label: 'I-35 Capital Express Central', url: 'https://www.txdot.gov/mymobility35/projects/capex-central.html' }] : []),
        { label: 'TxDOT Project Tracker', url: `https://apps3.txdot.gov/apps-cq/project_tracker/projects.htm?PROJCSJ=${csj}` },
      ],
      sources: [SOURCE],
    }));
  }
  return out;
}
