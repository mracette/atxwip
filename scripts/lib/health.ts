/** How long a source can keep failing before the daily run itself fails, so GitHub's failed-run email goes out. */
export const STALE_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

export interface SourceRun {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
  /** When the data now on the map was fetched; empty when nothing could be shown. */
  fetchedAt: string;
  count: number;
}

/** Source id → ISO date it started failing. Carried between runs in the Actions cache. */
export type FailingSince = Record<string, string>;

export interface Health {
  failingSince: FailingSince;
  problems: (SourceRun & { since: string; days: number })[];
  stale: string[];
}

export function assessHealth(runs: SourceRun[], previous: FailingSince, now = new Date()): Health {
  const failingSince: FailingSince = {};
  const problems: Health['problems'] = [];
  for (const r of runs) {
    if (r.ok) continue;
    const since = previous[r.id] ?? now.toISOString();
    failingSince[r.id] = since;
    problems.push({ ...r, since, days: Math.floor((now.getTime() - Date.parse(since)) / DAY_MS) });
  }
  return { failingSince, problems, stale: problems.filter((p) => p.days >= STALE_DAYS).map((p) => p.id) };
}

const ago = (iso: string, now: Date) => {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS);
  return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
};

/** Body of the "Data source problems" issue. The hidden first line lets the workflow tell whether the set of failing sources changed. */
export function healthReport(health: Health, mention: string, runUrl: string | undefined, now = new Date()): string {
  const ids = health.problems.map((p) => p.id).sort();
  return [
    `<!-- failing: ${ids.join(',')} -->`,
    `@${mention} ${health.problems.length === 1 ? 'a data source is' : `${health.problems.length} data sources are`} failing. The map keeps showing each one's last good data until it recovers, and this issue closes itself once every source fetches cleanly.`,
    '',
    ...health.problems.map((p) => [
      `- **${p.name}** (\`${p.id}\`), failing since ${p.since.slice(0, 10)}${p.days >= STALE_DAYS ? `, **${p.days} days**: the daily run now fails until this is fixed` : ''}`,
      `  - Error: ${p.error ?? 'unknown'}`,
      `  - On the map: ${p.fetchedAt ? `${p.count} features fetched ${ago(p.fetchedAt, now)}` : 'nothing, because there is no recent copy to fall back on'}`,
    ].join('\n')),
    '',
    `After ${STALE_DAYS} days of failing, a source also fails the daily run, which sends GitHub's failed-run email.`,
    ...(runUrl ? ['', `Latest run: ${runUrl}`] : []),
    '',
  ].join('\n');
}
