import type { Geometry, Point } from 'geojson';
import { z } from 'zod';
import type { Category, Link, ProjectFeature, Status } from '../../src/types.ts';
import { COA, queryLayer, sqlList, sqlTimestamp } from '../lib/arcgis.ts';
import { area, bbox, mergePolygons, pointInPolygon } from '../lib/geo.ts';
import { isoDate, makeProject, titleCase } from '../lib/project.ts';

const PERMITS = `${COA}/PLANNINGCADASTRE_issued_building_permits/FeatureServer/0`;
const SITE_PLANS = `${COA}/PLANNINGCADASTRE_site_plan_case/FeatureServer/0`;
const PARCELS = `${COA}/EXTERNAL_tcad_parcel/FeatureServer/0`;

const PERMIT_SOURCE: Link = { label: 'City of Austin building permits', url: 'https://data.austintexas.gov/d/3syk-w9eu' };
const SITE_PLAN_SOURCE: Link = { label: 'City of Austin site plans', url: 'https://data.austintexas.gov/d/mavg-96ck' };
const PARCEL_SOURCE: Link = { label: 'Travis Central Appraisal District parcels', url: 'https://www.traviscad.org/' };

/** Sites bigger than this (in square degrees, ~15 acres) are drawn flat: extruding a whole tract to building height reads as one giant slab. */
const FLAT_AREA = 6e-6;
/** Valuations under this are placeholders ($1, $1,000) rather than real estimates. */
const MIN_REAL_VALUATION = 50_000;
/** Additions and remodels of existing commercial buildings count as projects at this valuation; below it they're mostly patios and tenant finish-outs. */
const MIN_ALTERATION_VALUATION = 300_000;

const Permit = z.object({
  PERMIT_NUMBER: z.string(),
  SUB_TYPE: z.string(),
  WORK_TYPE: z.string(),
  PERMIT_LOCATION: z.string().nullish(),
  TCAD_ID: z.string().nullish(),
  ISSUE_DATE: z.number().nullish(),
  FINAL_DATE: z.number().nullish(),
  STATUS: z.string(),
  TOTAL_JOB_VALUATION: z.number().nullish(),
  NUMBER_OF_FLOORS: z.number().nullish(),
  NUMBER_OF_UNITS: z.number().nullish(),
  TOTAL_NEW_ADD_FOOTAGE: z.number().nullish(),
  WORK_DESCRIPTION: z.string().nullish(),
  LINK: z.string().nullish(),
});
type Permit = z.infer<typeof Permit> & { point: [number, number] };

const SitePlan = z.object({
  CASE_NUMBER: z.string(),
  SITE_PLAN_CASE_NAME: z.string().nullish(),
  SITE_PLAN_CASE_STATUS: z.string().nullish(),
  PROPOSED_LAND_USE: z.string().nullish(),
  DESC_OF_PROPOSED_DEVELOPMENT: z.string().nullish(),
  APPLICATION_START_DATE: z.number().nullish(),
  APPROVAL_DATE: z.number().nullish(),
  LINK: z.string().nullish(),
  OWNER_ORGANIZATION_NAME: z.string().nullish(),
});
type SitePlan = z.infer<typeof SitePlan> & { geometry: Geometry; bbox: [number, number, number, number] };

const SMALL_TYPES = /^R- 10[123]|^C- 10[123]/;

export function permitCategory(subType: string): Category {
  if (/^[RC]- 10[1-5]/.test(subType)) return 'residential';
  if (/^C- (319|323|325|326)/.test(subType)) return 'civic';
  return 'commercial';
}

export function landUseCategory(use: string | null | undefined, name = ''): Category {
  const s = `${use ?? ''} ${name}`.toLowerCase();
  if (/mixed/.test(s)) return 'commercial';
  if (/famil|housing|resid|condo|apartment|townhome|\bmf\b/.test(s)) return 'residential';
  if (/civic|school|library|church|relig|fire station|hospital|park|recreat/.test(s)) return 'civic';
  return 'commercial';
}

export function cleanSitePlanName(name: string): string {
  return titleCase(name.replace(/\(\s*W\/R[^)]*\)/gi, '').replace(/\s*-\s*$/, ''));
}

/** "ePlan: Commercial Expedited Review - [CONCURRENT] New Construction of New Apartments (34436 SF)." → "New Construction of New Apartments (34436 SF)." */
export function cleanWorkDescription(s: string): string {
  return s.replace(/^.*?Review\s*-\s*/i, '').replace(/\[[^\]]*\]\s*/g, '').replace(/^ePlan:\s*/i, '').trim();
}

/** Strips unit/building suffixes so the buildings of one project share an address. */
export function baseAddress(loc: string): string {
  return titleCase(loc.replace(/\s+(BLDG|BUILDING|UNIT|STE|SUITE|APT|#)\b.*$/i, '').trim());
}

function permitStatus(p: Permit): Status {
  return p.STATUS === 'Final' ? 'complete' : 'active';
}

/** Several buildings in one project often each carry the project total, so identical valuations count once. */
export function projectCost(values: (number | null | undefined)[]): number | undefined {
  const distinct = [...new Set(values.filter((v): v is number => typeof v === 'number' && v >= MIN_REAL_VALUATION))];
  return distinct.length ? distinct.reduce((a, b) => a + b, 0) : undefined;
}

/** Clubhouses, garages and leasing offices ride along with apartment projects; they don't make a complex "mixed use". */
const ACCESSORY = /^C- (318|321|328)/;
/** Below this per-square-foot figure a valuation is a filing placeholder, not a construction cost. */
const MIN_COST_PER_SQFT = 20;

export function projectCategory(permits: Pick<Permit, 'SUB_TYPE' | 'TOTAL_NEW_ADD_FOOTAGE' | 'NUMBER_OF_UNITS'>[]): Category {
  const weight = new Map<Category, number>();
  const hasHomes = permits.some((p) => permitCategory(p.SUB_TYPE) === 'residential' && (p.NUMBER_OF_UNITS ?? 0) > 0);
  for (const p of permits) {
    if (hasHomes && ACCESSORY.test(p.SUB_TYPE)) continue;
    const c = permitCategory(p.SUB_TYPE);
    weight.set(c, (weight.get(c) ?? 0) + (p.TOTAL_NEW_ADD_FOOTAGE || 1));
  }
  const total = [...weight.values()].reduce((a, b) => a + b, 0);
  const res = weight.get('residential') ?? 0;
  const com = weight.get('commercial') ?? 0;
  if (res && com && com / total >= 0.25) return 'commercial';
  return [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'commercial';
}

/**
 * Permit floor counts are typed by hand and sometimes hold a square footage or
 * a typo (a house listed at 1,463 floors). Austin's tallest tower has 74.
 */
export function plausibleFloors(n: number | null | undefined, max = 80): number | undefined {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
}

function summarize(permits: Permit[]) {
  const residential = permits.filter((p) => permitCategory(p.SUB_TYPE) === 'residential');
  const units = residential.reduce((s, p) => s + (p.NUMBER_OF_UNITS ?? 0), 0);
  const floors = Math.max(0, ...permits.map((p) => plausibleFloors(p.NUMBER_OF_FLOORS) ?? 0));
  const sqft = permits.reduce((s, p) => s + (p.TOTAL_NEW_ADD_FOOTAGE ?? 0), 0);
  const issued = permits.map((p) => p.ISSUE_DATE).filter((d): d is number => !!d);
  const finals = permits.map((p) => p.FINAL_DATE).filter((d): d is number => !!d);
  const status: Status = permits.some((p) => permitStatus(p) === 'active') ? 'active' : 'complete';
  const cost = projectCost(permits.map((p) => p.TOTAL_JOB_VALUATION));
  return {
    category: projectCategory(permits),
    units: units > 1 ? units : undefined,
    floors: floors || undefined,
    sqft: sqft || undefined,
    cost: cost && (!sqft || cost / sqft >= MIN_COST_PER_SQFT) ? cost : undefined,
    start: issued.length ? isoDate(Math.min(...issued)) : undefined,
    end: status === 'complete' && finals.length ? isoDate(Math.max(...finals)) : undefined,
    status,
    description: permits.map((p) => p.WORK_DESCRIPTION).find(Boolean),
    existingBuilding: permits.every((p) => p.WORK_TYPE !== 'New'),
  };
}

function permitLinks(permits: Permit[]): Link[] {
  const first = permits.find((p) => p.LINK);
  if (!first) return [];
  return [{ label: permits.length > 1 ? `Building permits (${permits.length})` : 'Building permit', url: first.LINK! }];
}

async function fetchPermits(since: Date): Promise<Permit[]> {
  const raw = await queryLayer(PERMITS, {
    where: `ISSUE_DATE >= ${sqlTimestamp(since)} AND STATUS IN ('Active','Final')
      AND (SUB_TYPE LIKE 'C-%' OR SUB_TYPE LIKE 'R- 10%') AND SUB_TYPE NOT LIKE 'C- 329%' AND SUB_TYPE NOT LIKE 'C- 330%'
      AND (WORK_TYPE = 'New' OR (WORK_TYPE IN ('Addition','Addition and Remodel') AND SUB_TYPE LIKE 'C-%'
        AND SUB_TYPE NOT LIKE 'C- 101%' AND SUB_TYPE NOT LIKE 'C- 102%' AND SUB_TYPE NOT LIKE 'C- 103%'
        AND TOTAL_JOB_VALUATION >= ${MIN_ALTERATION_VALUATION}))`,
    outFields: Object.keys(Permit.shape),
    pageSize: 2000,
  });
  const out: Permit[] = [];
  for (const f of raw) {
    const parsed = Permit.safeParse(f.properties);
    if (!parsed.success || f.geometry?.type !== 'Point') continue;
    out.push({ ...parsed.data, point: (f.geometry as Point).coordinates as [number, number] });
  }
  return out;
}

async function fetchSitePlans(since: Date): Promise<SitePlan[]> {
  const raw = await queryLayer(SITE_PLANS, {
    where: `WORK_TYPE = 'Consolidated' AND SITE_PLAN_CASE_STATUS NOT IN ('WITHDRAWN','Withdrawn','EXPIRED','Expired','VOID','Void')
      AND (APPROVAL_DATE >= ${sqlTimestamp(since)} OR SITE_PLAN_CASE_STATUS IN ('IN REVIEW','In Review'))`,
    outFields: Object.keys(SitePlan.shape),
    pageSize: 1000,
  });
  const out: SitePlan[] = [];
  for (const f of raw) {
    const parsed = SitePlan.safeParse(f.properties);
    if (!parsed.success || !f.geometry || !/Polygon/.test(f.geometry.type)) continue;
    out.push({ ...parsed.data, geometry: f.geometry, bbox: bbox(f.geometry) });
  }
  return out;
}

async function fetchParcels(ids: string[]): Promise<Map<string, Geometry>> {
  const out = new Map<string, Geometry>();
  for (let i = 0; i < ids.length; i += 150) {
    const batch = ids.slice(i, i + 150);
    const raw = await queryLayer<{ PID_10: string }>(PARCELS, { where: `PID_10 IN (${sqlList(batch)})`, outFields: ['PID_10'], pageSize: 2000 });
    for (const f of raw) {
      if (!f.geometry) continue;
      const prev = out.get(f.properties.PID_10);
      out.set(f.properties.PID_10, prev ? mergePolygons([prev, f.geometry]) : f.geometry);
    }
  }
  return out;
}

function containing(plans: SitePlan[], [x, y]: [number, number]): SitePlan | undefined {
  const hits = plans.filter((p) => x >= p.bbox[0] && x <= p.bbox[2] && y >= p.bbox[1] && y <= p.bbox[3] && pointInPolygon([x, y], p.geometry));
  // Nested cases happen (a phase inside a master plan); the smallest boundary is the most specific.
  return hits.sort((a, b) => area(a.geometry) - area(b.geometry))[0];
}

export async function fetchDevelopment(now = new Date()): Promise<ProjectFeature[]> {
  const permitSince = new Date(now);
  permitSince.setUTCFullYear(now.getUTCFullYear() - 2);
  const namingSince = new Date(now);
  namingSince.setUTCFullYear(now.getUTCFullYear() - 6);
  const plannedSince = new Date(now);
  plannedSince.setUTCFullYear(now.getUTCFullYear() - 2);

  const [permits, plans] = await Promise.all([fetchPermits(permitSince), fetchSitePlans(namingSince)]);
  console.log(`  development: ${permits.length} permits, ${plans.length} site plans`);

  const features: ProjectFeature[] = [];
  const big: Permit[] = [];
  for (const p of permits) {
    if (!SMALL_TYPES.test(p.SUB_TYPE)) {
      big.push(p);
      continue;
    }
    features.push(makeProject({ type: 'Point', coordinates: p.point }, {
      id: `permit-${p.PERMIT_NUMBER.replace(/\s+/g, '-')}`,
      name: baseAddress(p.PERMIT_LOCATION ?? p.PERMIT_NUMBER),
      category: 'residential',
      status: permitStatus(p),
      small: true,
      address: titleCase(p.PERMIT_LOCATION ?? ''),
      description: /^R- 102/.test(p.SUB_TYPE) ? 'New accessory apartment' : /^[RC]- 103/.test(p.SUB_TYPE) ? 'New duplex' : 'New single-family house',
      floors: plausibleFloors(p.NUMBER_OF_FLOORS, 5),
      units: p.NUMBER_OF_UNITS && p.NUMBER_OF_UNITS > 1 ? p.NUMBER_OF_UNITS : undefined,
      sqft: p.TOTAL_NEW_ADD_FOOTAGE ?? undefined,
      start: isoDate(p.ISSUE_DATE),
      end: p.STATUS === 'Final' ? isoDate(p.FINAL_DATE) : undefined,
      permit: p.PERMIT_NUMBER,
      links: permitLinks([p]),
      sources: [PERMIT_SOURCE],
    }));
  }

  const byPlan = new Map<SitePlan, Permit[]>();
  const byParcel = new Map<string, Permit[]>();
  for (const p of big) {
    const plan = containing(plans, p.point);
    if (plan) byPlan.set(plan, [...(byPlan.get(plan) ?? []), p]);
    else {
      const key = p.TCAD_ID || baseAddress(p.PERMIT_LOCATION ?? p.PERMIT_NUMBER);
      byParcel.set(key, [...(byParcel.get(key) ?? []), p]);
    }
  }

  for (const plan of plans) {
    const ps = byPlan.get(plan);
    const approved = plan.APPROVAL_DATE && plan.APPROVAL_DATE >= plannedSince.getTime();
    const inReview = /in review/i.test(plan.SITE_PLAN_CASE_STATUS ?? '');
    if (!ps && !approved && !inReview) continue;
    const name = cleanSitePlanName(plan.SITE_PLAN_CASE_NAME || plan.CASE_NUMBER);
    const s = ps ? summarize(ps) : undefined;
    const links: Link[] = [];
    if (plan.LINK) links.push({ label: `Site plan ${plan.CASE_NUMBER}`, url: plan.LINK });
    if (ps) links.push(...permitLinks(ps));
    const planDesc = plan.DESC_OF_PROPOSED_DEVELOPMENT?.trim();
    features.push(makeProject(plan.geometry, {
      id: `siteplan-${plan.CASE_NUMBER}`,
      name,
      category: s?.category ?? landUseCategory(plan.PROPOSED_LAND_USE, name),
      status: s?.status ?? 'planned',
      description: planDesc && planDesc.length > 12 ? planDesc : s?.description ? cleanWorkDescription(s.description) : undefined,
      floors: s?.floors,
      units: s?.units,
      sqft: s?.sqft,
      cost: s?.cost,
      developer: plan.OWNER_ORGANIZATION_NAME ? titleCase(plan.OWNER_ORGANIZATION_NAME) : undefined,
      filed: isoDate(plan.APPLICATION_START_DATE),
      start: s?.start,
      end: s?.end,
      address: ps?.[0]?.PERMIT_LOCATION ? baseAddress(ps[0].PERMIT_LOCATION) : undefined,
      permit: ps ? (ps.length > 1 ? `${ps.length} buildings` : ps[0]!.PERMIT_NUMBER) : plan.CASE_NUMBER,
      footprint: 'Site plan boundary',
      flat: area(plan.geometry) > FLAT_AREA || s?.existingBuilding || undefined,
      links,
      sources: ps ? [SITE_PLAN_SOURCE, PERMIT_SOURCE] : [SITE_PLAN_SOURCE],
    }));
  }

  const parcelIds = [...byParcel.values()].map((ps) => ps[0]!.TCAD_ID).filter((id): id is string => !!id);
  const parcels = await fetchParcels([...new Set(parcelIds)]);
  for (const [key, ps] of byParcel) {
    const parcel = ps[0]!.TCAD_ID ? parcels.get(ps[0]!.TCAD_ID) : undefined;
    const covers = parcel && ps.some((p) => pointInPolygon(p.point, parcel));
    const geometry: Geometry = covers ? parcel : { type: 'Point', coordinates: ps[0]!.point };
    const s = summarize(ps);
    const address = baseAddress(ps[0]!.PERMIT_LOCATION ?? key);
    features.push(makeProject(geometry, {
      id: `parcel-${key.replace(/[^\w-]+/g, '-')}`,
      name: address,
      category: s.category,
      status: s.status,
      description: s.description ? cleanWorkDescription(s.description) : undefined,
      floors: s.floors,
      units: s.units,
      sqft: s.sqft,
      cost: s.cost,
      start: s.start,
      end: s.end,
      address,
      permit: ps.length > 1 ? `${ps.length} buildings` : ps[0]!.PERMIT_NUMBER,
      footprint: covers ? 'Parcel boundary' : undefined,
      flat: (covers && (area(parcel) > FLAT_AREA || s.existingBuilding)) || undefined,
      links: permitLinks(ps),
      sources: covers ? [PERMIT_SOURCE, PARCEL_SOURCE] : [PERMIT_SOURCE],
    }));
  }
  return features;
}

