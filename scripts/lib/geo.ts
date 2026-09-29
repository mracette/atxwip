import type { Geometry, MultiLineString, MultiPolygon, Position } from 'geojson';

type Ring = Position[];

function polygons(g: Geometry): Ring[][] {
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

function linestrings(g: Geometry): Position[][] {
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  return [];
}

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]![0]! * r[i]![1]!) - (r[i]![0]! * r[j]![1]!);
  return a / 2;
}

/** Planar area in square degrees; only used for ranking and weighting, never displayed. */
export function area(g: Geometry): number {
  return polygons(g).reduce((sum, p) => sum + Math.abs(ringArea(p[0]!)) - p.slice(1).reduce((h, r) => h + Math.abs(ringArea(r)), 0), 0);
}

function pointInRing([x, y]: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if ((yi! > y!) !== (yj! > y!) && x! < ((xj! - xi!) * (y! - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(pt: Position, g: Geometry): boolean {
  return polygons(g).some(([outer, ...holes]) => pointInRing(pt, outer!) && !holes.some((h) => pointInRing(pt, h)));
}

export function bbox(g: Geometry): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1] as number);
      b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1] as number);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  if ('coordinates' in g) visit(g.coordinates);
  return b;
}

/**
 * A representative point that sits on the feature: the area-weighted centroid
 * of the largest polygon (nudged inside if it falls in a notch), or the
 * halfway point along a line.
 */
export function anchor(g: Geometry): Position {
  if (g.type === 'Point') return g.coordinates;
  if (g.type === 'MultiPoint') return g.coordinates[0]!;
  const polys = polygons(g);
  if (polys.length) {
    const biggest = polys.reduce((a, b) => (Math.abs(ringArea(b[0]!)) > Math.abs(ringArea(a[0]!)) ? b : a));
    const r = biggest[0]!;
    let cx = 0, cy = 0, a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = r[j]![0]! * r[i]![1]! - r[i]![0]! * r[j]![1]!;
      cx += (r[j]![0]! + r[i]![0]!) * f;
      cy += (r[j]![1]! + r[i]![1]!) * f;
      a += f;
    }
    const c: Position = a ? [cx / (3 * a), cy / (3 * a)] : r[0]!;
    return pointInPolygon(c, { type: 'Polygon', coordinates: biggest }) ? c : r[0]!;
  }
  const lines = linestrings(g);
  const segs: [Position, Position, number][] = [];
  for (const l of lines) for (let i = 1; i < l.length; i++) segs.push([l[i - 1]!, l[i]!, Math.hypot(l[i]![0]! - l[i - 1]![0]!, l[i]![1]! - l[i - 1]![1]!)]);
  const total = segs.reduce((s, x) => s + x[2], 0);
  let walked = 0;
  for (const [a, b, len] of segs) {
    if (walked + len >= total / 2) {
      const t = len ? (total / 2 - walked) / len : 0;
      return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t];
    }
    walked += len;
  }
  return lines[0]?.[0] ?? [0, 0];
}

export function mergeLines(gs: Geometry[]): MultiLineString {
  return { type: 'MultiLineString', coordinates: gs.flatMap(linestrings) };
}

export function mergePolygons(gs: Geometry[]): MultiPolygon {
  return { type: 'MultiPolygon', coordinates: gs.flatMap(polygons) };
}

/** Rounds coordinates (5 decimals ≈ 1 m) and drops consecutive duplicates to keep the shipped file small. */
export function roundGeometry<G extends Geometry>(g: G, decimals = 5): G {
  const k = 10 ** decimals;
  const r = (c: unknown): unknown => {
    if (Array.isArray(c) && typeof c[0] === 'number') return [Math.round(c[0] * k) / k, Math.round((c[1] as number) * k) / k];
    if (Array.isArray(c) && Array.isArray(c[0]) && typeof c[0][0] === 'number') {
      const pts = c.map(r) as number[][];
      return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1]![0] || p[1] !== pts[i - 1]![1]);
    }
    return Array.isArray(c) ? c.map(r) : c;
  };
  if (g.type === 'GeometryCollection') return g;
  return { ...g, coordinates: r(g.coordinates) } as G;
}
