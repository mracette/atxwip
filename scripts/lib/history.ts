import type { ProjectFeature } from '../../src/types.ts';

export interface History {
  /** Date of the first build that kept history; projects seen then have no known arrival date. */
  baseline: string;
  seen: Record<string, { first: string; last: string }>;
}

export type Change = 'new' | 'started' | 'finished';

/** Site plans reach the city's map data one to three weeks after filing, so a single week often comes up empty. */
export const RECENT_DAYS = 14;
const RECENT_MS = RECENT_DAYS * 24 * 3600 * 1000;
/** Projects that dropped out of the data are remembered this long, so a flaky source doesn't make them "new" again. */
const FORGET_MS = 90 * 24 * 3600 * 1000;
/** More arrivals than this in one build means a new source or a data fix, not a busy week. */
const FLOOD = 150;

const day = (d: Date) => d.toISOString().slice(0, 10);

function recent(date: string | undefined, now: Date): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(`${date}T12:00:00Z`);
  return t <= now.getTime() && now.getTime() - t <= RECENT_MS;
}

/**
 * Tags projects that changed in the past two weeks and returns the updated history.
 * Filing, ground-breaking and completion come from permit and site plan dates,
 * so they work from the first build; other arrivals need a history of what
 * earlier builds saw.
 */
export function tagChanges(features: ProjectFeature[], history: History | undefined, now = new Date()): History {
  const today = day(now);
  const next: History = { baseline: history?.baseline ?? today, seen: {} };
  for (const [id, s] of Object.entries(history?.seen ?? {})) {
    if (now.getTime() - Date.parse(s.last) <= FORGET_MS) next.seen[id] = s;
  }
  const arrivals = history ? features.filter((f) => !history.seen[f.properties.id]).length : 0;
  const flooded = arrivals > FLOOD;

  for (const f of features) {
    const p = f.properties;
    const known = next.seen[p.id];
    const first = known?.first ?? (history && !flooded ? today : next.baseline);
    next.seen[p.id] = { first, last: today };

    if (p.status === 'complete' && recent(p.end, now)) tag(f, 'finished', p.end!);
    else if (p.status === 'active' && recent(p.start, now)) tag(f, 'started', p.start!);
    else if (p.status === 'planned' && recent(p.filed, now)) tag(f, 'new', p.filed!);
    else if (first !== next.baseline && recent(first, now)) tag(f, 'new', first);
  }
  return next;
}

function tag(f: ProjectFeature, change: Change, at: string) {
  f.properties.change = change;
  f.properties.changedAt = at;
}
