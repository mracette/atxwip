# atxwip

Static map of Austin construction. Build-time Node scripts fetch public data
into `public/data/`; a Vite + MapLibre app renders it. Pushes to `main` deploy
to GitHub Pages, and a daily scheduled run refreshes the data.

| Doc | When |
|---|---|
| [docs/data-sources.md](docs/data-sources.md) | Touching anything in `scripts/` |
| [docs/style-guide.md](docs/style-guide.md) | Any visual or map-style change; colors live in both `src/tokens.ts` and `src/styles.css` and must match |
| [docs/research/data-source-survey.md](docs/research/data-source-survey.md) | Adding a new source |

## Checks

`npm test && npm run typecheck && npm run build`. Run `npm run data` once
before `npm run dev`; the generated data is gitignored.

## Gotchas

- `~/.npmrc` has `save=false`; use `npm_config_save=true npm install ...` for
  dependency changes.
- MapLibre 6 loads its worker from a sibling module. Dev excludes it from Vite
  pre-bundling; production passes the bundled worker to `setWorkerUrl`. Both
  are needed or the map stays blank with no error.
- MapLibre 6 resolves missing images with `map.setMissingStyleImageResolver`;
  the old `styleimagemissing` event can no longer supply them.
- `fill-extrusion-opacity` can't vary per feature, so status is split across
  layers. Filters can't read `feature-state`; use it in paint properties.
- Headless browser screenshots of the map lag behind the page by several
  seconds under software WebGL; check page state before trusting a blank shot.

## Conventions

- UI copy is for a first-time visitor: plain words, no dataset jargon.
- Never use em dashes in user-facing copy.
- Re-verify facts in `scripts/curated.ts` when editing, and keep its sources.
