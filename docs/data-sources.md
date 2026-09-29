# Data sources

What `npm run data` pulls, and the quirks that shape the code. The wider survey
of everything that was probed (including sources we don't use yet) is in
[research/data-source-survey.md](research/data-source-survey.md).

Each source is a module in `scripts/sources/` that returns project features.
`scripts/build-data.ts` runs them one at a time, saves each good result to
`data/snapshots/<id>.json`, and falls back to that snapshot when a source fails
or returns suspiciously few rows. In CI the snapshots live in the Actions cache.

| Source | Module | Map layer | Volume |
|---|---|---|---|
| City of Austin building permits (ArcGIS copy of Socrata `3syk-w9eu`) | `development.ts` | Residential, commercial, civic buildings; houses | ~5k permits → ~750 projects + ~4.5k homes |
| City of Austin site plans (`PLANNINGCADASTRE_site_plan_case`) | `development.ts` | Names and boundaries for the above; planned projects | ~1.3k polygons |
| TCAD parcels (`EXTERNAL_tcad_parcel`) | `development.ts` | Footprints for permits outside any site plan | ~80 lookups |
| Capital Projects Explorer (`capitalprojects.austintexas.gov/api/projects`) | `capital-projects.ts` | City facilities, parks, mobility areas | ~80 |
| TxDOT DCIS projects (`TxDOT_DCIS_All_Projects`) | `txdot.ts` | I-35 and other highway work in Travis County, ≥ $20M | ~70 |
| ATPW Moped projects in construction | `mobility.ts` | City street and trail projects | ~55 |
| Urban Trails network (Socrata `jdwm-wfps`) | `trails.ts` | Trails in design, construction, or opened in the last year | ~80 |
| Light rail Phase 1 route (city ArcGIS) | `build-data.ts` | Light rail | 1 |
| Hand-checked projects | `curated.ts` | Waterline, Confluence, airport, cap and stitch; overrides | 4 + overrides |
| City right-of-way work zones (Socrata `qyfh-gwei`) | `closures.ts` | Lane closures overlay (`closures.json`) | ~3k in effect today |
| TxDOT DriveTexas conditions (`api.drivetexas.org`) | `closures.ts` | Lane closures overlay, highways | Only with `DRIVETEXAS_API_KEY` |

## How development projects are assembled

1. New building permits from the last two years: `WORK_TYPE = 'New'`, status
   Active or Final, excluding `C- 329`/`C- 330` (EV chargers, pergolas, pools).
2. Houses, ADUs and duplexes (`R- 101/102/103`, `C- 101/103`) become one point
   each and ship separately in `homes.json`, which the map only loads when the
   viewer opts in.
3. Every other permit is placed inside the smallest site-plan polygon that
   contains it (site plans approved in the last six years or still in review).
   The site plan gives the project its name and boundary.
4. Permits outside any site plan are grouped by TCAD parcel id and drawn on the
   parcel polygon when the permit point actually falls inside it.
5. Site plans with no permits yet, approved in the last two years or in review,
   become "planned" projects.

Status: any Active permit makes a project "under construction"; all Final means
"complete".

## Quirks worth knowing

- **ArcGIS date filters** must be written `timestamp 'YYYY-MM-DD HH:MM:SS'`.
  `DATE '...'` silently matches nothing.
- **Socrata's permit table is missing coordinates** for most 2026 permits; the
  ArcGIS copy is fully geocoded, which is why we query it instead.
- **Valuations are unreliable.** Every building in a project often repeats the
  project total, so identical values count once; values under $50k or under
  $20 per square foot are treated as placeholders and dropped.
- **Category of a mixed permit set:** clubhouse (`C- 318`), garage (`C- 321`)
  and "other nonresidential" (`C- 328`) permits don't count toward "mixed use"
  when the project has homes. Otherwise a project is mixed use when
  non-residential floor area is at least 25%.
- **Height** is `floors × 3.6 m`. Projects without a floor count, and sites over
  about 15 acres, are drawn flat instead of extruded.
- **Capital Projects Explorer** shapes are work areas, not buildings, so they
  are always drawn flat. Its JSON feed is internal to that app; the snapshot
  fallback covers it if it moves. Water-utility projects are excluded as noise.
- **TxDOT** DCIS refreshes every few months. "Construction" and "Design and
  Construct" stages map to under construction; the rest to planned. The CSJ
  (`0015-13-428`) is the stable id.
- **Moped** also lists the I-35 segments; those are skipped in favor of TxDOT's
  records.
- **Lane closures** ship in their own `closures.json`, loaded only when the
  viewer turns the overlay on. They describe today, so a failed fetch falls
  back to a snapshot only if it is under three days old. City work zones repeat
  one line per direction of travel; identical lines collapse to one.
- **DriveTexas** needs a free key from api.drivetexas.org, passed as
  `?key=` and stored as the `DRIVETEXAS_API_KEY` repo secret. Without it the
  source is skipped. Its statewide feed is cut to the Austin area by bounding
  box, which leaves a couple dozen at a time. The live feed uses snake_case
  fields (`condition`, `route_name`, `roadway`, `end_time`); the API's
  published example file still shows older uppercase names, so ignore it.
- **I-35 Capital Express Central** segments share a `corridor` value in
  `curated.ts`, so any one segment's panel shows the whole corridor's schedule.
- **Project images** come from the Capital Projects Explorer's `project_image`
  field and from `image`/`imageCredit` set by hand in `curated.ts`. The build
  downloads each one once, saves a 960px WebP in `data/image-cache/` (kept in the
  Actions cache), and ships copies in `public/data/images/`. An image that later
  vanishes upstream keeps showing. City photos reused by more than two projects
  are skipped as generic. Many of the city's older Flickr links are dead. Each run
  writes `data/image-report.md`, and CI mirrors it into the open GitHub issue
  "Project images to add": hand-picked images that failed, and big projects
  (10+ floors or $100M+) that still have none.
- **Recent changes** tag projects from the last two weeks. "Broke ground" and
  "finished" use first-permit and final-inspection dates; "plans filed" uses the
  site plan application date, or failing that the day a project first appeared
  in the data. `data/history.json` (Actions cache) remembers first appearances.
  Houses are left out, and a build that adds more than 150 projects at once is
  treated as a data change rather than news.
- **Floor counts** are typed by hand on permits and sometimes hold nonsense (a
  house at 1,463 floors); anything over 80, or over 5 for a house, is dropped.
- **OpenStreetMap context buildings** that a curated project draws itself are
  hidden by id in `src/basemap.ts`, or the two extrusions z-fight.
