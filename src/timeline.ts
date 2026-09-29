import { toYear } from './format.ts';
import type { ProjectProps, Status } from './types.ts';

export const TIMELINE_MIN = 2020;
export const TIMELINE_MAX = 2034;

export function yearOf(d: Date): number {
  const y = d.getUTCFullYear();
  return y + (d.getTime() - Date.UTC(y, 0, 1)) / (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1));
}

/** Rough build time when a project doesn't say: about two years, longer for towers. */
function buildYears(p: ProjectProps): number {
  return p.floors ? 1.5 + p.floors / 25 : 2;
}

/**
 * When a project starts and finishes, filling gaps with estimates: an active
 * project with no start began about a year ago, a planned one starts about a
 * year out, and missing ends come from the build-time guess.
 */
export function projectSpan(p: ProjectProps, now: number): { start: number; end: number } {
  let start = p.start ? toYear(p.start) : p.status === 'planned' ? now + 1 : now - 1;
  if (p.status === 'planned') start = Math.max(start, now);
  let end = p.end ? toYear(p.end, 'end') : start + buildYears(p);
  if (p.status === 'complete') end = Math.min(end, now);
  if (p.status === 'active') end = Math.max(end, now + 0.25);
  if (p.status === 'planned') end = Math.max(end, start + 0.5);
  return { start: Math.min(start, end), end };
}

/**
 * A project's status at `year`, or null when it shouldn't be on the map yet.
 * Future years show not-yet-started work as planned; past years hide it.
 * `progress` runs 0 → 1 while it's under construction.
 */
export function statusAt(p: ProjectProps, year: number, now: number): { status: Status; progress: number } | null {
  const { start, end } = projectSpan(p, now);
  if (year < start) return year >= now ? { status: 'planned', progress: 0 } : null;
  if (year < end) return { status: 'active', progress: (year - start) / (end - start) };
  return { status: 'complete', progress: 1 };
}
