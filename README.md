# ATX WIP

What's being built around Austin, on one map: new apartments and towers from
city permits, the I-35 rebuild segment by segment, the new convention center,
light rail, city capital projects, and new trails. Buildings rise in 3D to
their permitted height; click anything for details and the source record.

Live at **https://atxwip.info** (rebuilt daily from the latest public data).

## Run it

```sh
npm install
npm run data   # fetch every source into public/data (about 15 s)
npm run dev
```

## Checks

```sh
npm test && npm run typecheck && npm run build
```

## How it works

- `scripts/` runs at build time. Each module in `scripts/sources/` pulls one
  public dataset and turns it into project features; `scripts/build-data.ts`
  merges them, applies the hand-checked facts in `scripts/curated.ts`, and
  writes `public/data/projects.json` and `homes.json`.
- `src/` is a static MapLibre app. The basemap is our own style over
  [OpenFreeMap](https://openfreemap.org) vector tiles, so there's no API key.
- A GitHub Action refreshes the data every morning and deploys to GitHub Pages.
  If a source is down, it reuses that source's last good snapshot.

## Docs

- [docs/data-sources.md](docs/data-sources.md): what we pull and the quirks
- [docs/style-guide.md](docs/style-guide.md): the "Survey Grade" visual design,
  its references and palette checks
- [docs/research/data-source-survey.md](docs/research/data-source-survey.md):
  every source that was probed, including ones not used yet

## Data

City of Austin open data (public domain), Travis Central Appraisal District
parcels, TxDOT project information, and OpenStreetMap contributors (ODbL).
Permit and schedule data changes often; each project links to its source record.
