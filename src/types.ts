import type { Feature, FeatureCollection, Geometry } from 'geojson';

export const CATEGORIES = ['residential', 'commercial', 'civic', 'transport', 'trails'] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ['planned', 'active', 'complete'] as const;
export type Status = (typeof STATUSES)[number];

export interface Segment {
  label: string;
  start: string;
  end: string;
}

export interface Link {
  label: string;
  url: string;
}

/**
 * Flat properties so MapLibre expressions can read them directly. Arrays and
 * objects (segments, links, sources) are JSON-encoded strings because vector
 * and GeoJSON sources in MapLibre drop nested values.
 */
export interface ProjectProps {
  id: string;
  name: string;
  category: Category;
  status: Status;
  address?: string;
  neighborhood?: string;
  description?: string;
  floors?: number;
  height_m?: number;
  units?: number;
  sqft?: number;
  cost?: number;
  developer?: string;
  /** ISO date the plans were submitted to the city. */
  filed?: string;
  /** ISO date or year. */
  start?: string;
  end?: string;
  permit?: string;
  /** Single-family homes and duplexes: numerous, so hidden unless the viewer opts in. */
  small?: boolean;
  /** Large sites drawn as a ground footprint instead of an extrusion. */
  flat?: boolean;
  /** Set when the project was added, broke ground or finished in the two weeks before the build. */
  change?: 'new' | 'started' | 'finished';
  /** ISO date of that change. */
  changedAt?: string;
  /** A remote URL while building; a path under data/images/ once the build has saved a copy. */
  image?: string;
  /** e.g. "Rendering: KPF" or "Photo: City of Austin". */
  imageCredit?: string;
  /** Short label for where the geometry came from, e.g. "Site plan boundary". */
  footprint?: string;
  segments?: string;
  /** Projects sharing a corridor show each other's segments on one timeline. */
  corridor?: string;
  links?: string;
  sources?: string;
  lon: number;
  lat: number;
}

export type ProjectFeature = Feature<Geometry, ProjectProps>;
export type ProjectCollection = FeatureCollection<Geometry, ProjectProps>;

export interface SourceMeta {
  id: string;
  name: string;
  url: string;
  count: number;
  fetchedAt: string;
}

export interface DataMeta {
  generatedAt: string;
  sources: SourceMeta[];
  closureSources?: SourceMeta[];
}

export type ClosureImpact = 'closed' | 'partial';

/** A lane or road closure in effect today, drawn as an optional overlay. */
export interface ClosureProps {
  id: string;
  road: string;
  /** What the crew is doing, when the source says. */
  work?: string;
  impact: ClosureImpact;
  /** ISO date. */
  end?: string;
  by: 'city' | 'txdot';
}

export type ClosureFeature = Feature<Geometry, ClosureProps>;
export type ClosureCollection = FeatureCollection<Geometry, ClosureProps>;
