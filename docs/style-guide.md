# Austin WIP — Style Guide

Direction: **Survey Grade**
Stack assumptions: MapLibre GL JS, vector basemap (Protomaps/OpenMapTiles schema), GeoJSON project layers, plain CSS custom properties.

---

## 1. References

Each entry is what we take from it. Anything not listed is not borrowed.

| # | Reference | What we borrow |
|---|---|---|
| 1 | **NYT, "A Map of Every Building in America"** (Wallace, Watkins, Schwartz, 2018). Coverage: https://planetizen.com/node/101043 | Figure-ground restraint. Every context building is a quiet single tone, so the only color on the map is our data. Context buildings stay flat and gray. Only tracked projects get color and height. |
| 2 | **Stamen Toner** (now hosted by Stadia): https://docs.stadiamaps.com/map-styles/stamen-toner/ | The basemap is split into background, lines, and labels so data can sit *between* them. Our order is: land, water, roads, **project layers**, labels. Labels always stay on top of extrusions. |
| 3 | **Protomaps basemap flavors**: https://docs.protomaps.com/basemaps/themes (source: `protomaps/basemaps/styles/src/flavors.ts`) | The "grayscale", "white", and "black" data-viz flavors show how narrow the value range should be: land #cccccc, water #a3a3a3, roads #ebebeb, labels #474747 to #8f8f8f. We keep that range and warm or cool the tint (paper or blueprint). We keep their Flavor-object shape so the basemap is one config object. |
| 4 | **Felt, "How to design a beautiful map"**: https://felt.com/blog/how-to-design-a-beautiful-map, and the Felt UI tour: https://help.felt.com/getting-started/tour-the-interface | Use a small palette where each color has one job, with an explicit foreground, middle ground, and background. The app shell has five parts (toolbar, legend, detail panel, table, map). We copy the legend-as-layer-list model, where a legend row is also the toggle. |
| 5 | **UrbanToronto map relaunch (2024)**: https://urbantoronto.ca/news/2024/11/urbantoronto-launches-new-map-experience-explore-new-features-today.57285 | Filter by project type (residential, transit, …), plus a stats dashboard summary. At low zoom, dense areas become weighted circles instead of hundreds of pins. We use circle clusters below z12 and extrusions above z13. |
| 6 | **Urbanize Austin**: https://austin.urbanize.city/ | The metadata order for a project: units → $ value → developer → delivery date → neighborhood tag. This becomes the order of the stat rows in our detail panel. |
| 7 | **TxDOT I-35 Capital Express Central**: https://www.txdot.gov/mymobility35/projects/capex-central.html | Linear projects are shown as **named segments with their own date ranges** (e.g. Lady Bird Lake 2025–2033, Drainage Tunnel 2025–2029, Downtown 2027–2033). The segment timeline component copies this, and each I-35 segment is a separate selectable feature. |
| 8 | **NYC Planning ZoLa / Population FactFinder**: https://zola.planning.nyc.gov, https://www.nyc.gov/site/planning/about/press-releases/pr-20180419.page | Government-grade legibility: grouped layer menu with inline swatches, a profile panel with small charts, and a source line on every dataset. We use the grouped layer menu and the "Source: … · Updated …" footer. |
| 9 | **Vercel Geist**: https://vercel.com/geist | Mono type for technical labels and eyebrows. 1px hairline borders done with `box-shadow` instead of heavy chrome. Only three font weights (400 body / 500 controls / 600 headings). Our panels and controls follow these rules. |
| 10 | **Apple Maps / Google Maps bottom sheet**: overview of the pattern at https://proandroiddev.com/building-a-google-maps-style-bottom-sheet-with-jetpack-compose-eccc1f3cf578 and https://expo.dev/blog/how-to-create-apple-maps-style-liquid-glass-sheets.md | Three detents (peek / half / full). The map stays pannable and tappable at peek and half. The sheet floats with a gap and rounded corners at low detents. |
| 11 | **MUTCD Part 6** (temporary traffic control) summary: https://jalopnik.com/2215599/signs-construction-zone-orange-yellow-warning-mutcd-part-6/ and the **Okabe–Ito palette** | MUTCD makes work-zone signs black on orange. That grounds our use of orange for "roadwork" and "under construction". Okabe–Ito was the starting point for choosing category hues that stay separable under colorblindness. |

Also looked at but not borrowed from directly: The Pudding's Columbus warehouse-boom scrollytelling map (dots added over time; a possible later "time scrubber" feature), Bloomberg CityLab/MapLab (D3 + Mapbox editorial maps), and ATXfloods (City of Austin low-water-crossing map; a useful local precedent for "closed / caution" status on roads).

---

## 2. Design direction: Survey Grade

**Thesis.** The map should read like a surveyor's working drawing of a city under construction. That means a quiet drafting-paper basemap (a navy blueprint sheet in dark mode), hairline linework, coordinates and figures set in monospace, and a single high-visibility safety orange reserved for work in progress. The character comes from *drafting conventions* (tick marks, crosshair survey marks, dimension-line timelines, hazard hatching on active roadwork) rather than illustration, so the map stays legible as a data tool.

**Why this direction**
- *It matches the subject.* Construction documents already mix precise linework, mono data, and orange for active work. The visual language is borrowed from the real world, not invented.
- *It's a proven data-viz setup.* Refs 1–3 show that a near-monochrome basemap is what lets categorical color work. The blueprint and paper tints add character without adding hue noise.
- *Orange keeps one meaning.* Following MUTCD, orange always means "work happening now." It is never used as decoration.
- *Guardrails against kitsch:* no stencil or "construction" novelty fonts, no caution-tape borders on UI chrome, no hard-hat icons, and no texture images. Hazard stripes appear in exactly one place: road and rail segments under construction on the map.

Motifs, used sparingly:
- **Survey mark** ⌖: a crosshair in a circle marks the selected project's centroid on the map and is the app icon.
- **Tick rule**: a hairline with small ticks every 8px, used as a section divider in the panel and as the timeline axis.
- **Coordinate eyebrow**: `30.2672° N  97.7431° W` in mono above the project title.
- **Plan hatch**: 45° hairline hatching on the ground footprint of *planned* projects, the way unbuilt work is drawn on a site plan.

---

## 3. Color tokens

### 3.1 How colors were checked
- **Contrast**: WCAG 2.x relative-luminance ratio, computed with a script (see `palette/palette-check.py` next to this file). Text must be ≥ 4.5:1 (AA). Swatches, map glyphs, and non-text UI must be ≥ 3:1 (WCAG 1.4.11).
- **Colorblindness**: each category color was simulated for protanopia, deuteranopia, and tritanopia at full severity, using the Machado et al. (2009) matrices in linear RGB. For every pair of categories, the script measures CIEDE2000 distance (ΔE00, how different two colors look). We report the **minimum pairwise ΔE00** in each vision mode. Target is ≥ 10 (clearly distinct side by side). Candidate palettes were found with a constrained random search (hue fixed per category, lightness and chroma free, ≥ 3:1 against land), then hand-tuned.
- Re-run it with `cd docs/palette && python3 palette-check.py palette-final.py`.

Results (final palette):

| Mode | Light: min ΔE00 (closest pair) | Dark: min ΔE00 (closest pair) |
|---|---|---|
| Normal vision | 26.7 (trails / complete) | 21.9 (residential / complete) |
| Protanopia | 9.8 (residential / commercial) | 13.4 (civic / trails) |
| Deuteranopia | 13.7 (residential / commercial) | 14.0 (transport / trails) |
| Tritanopia | 12.2 (residential / trails) | 13.0 (commercial / civic) |

One pair falls just under target: light-mode residential and commercial under protanopia (9.8). These are still distinct, and category is never conveyed by color alone (see 3.5), so we accept it.

### 3.2 Categorical palette (6 layers)

| Token | Meaning | Light fill | Light text-safe | Dark fill | Dark text-safe |
|---|---|---|---|---|---|
| `--cat-residential` | Residential towers, apartments, housing | `#3A6FD0` | `#2F5FB8` | `#5C8BF7` | `#5C8BF7` |
| `--cat-commercial` | Commercial / mixed-use / office | `#C2379F` | `#A92E8A` | `#F59CCB` | `#F59CCB` |
| `--cat-civic` | Civic & major projects (Convention Center, airport, UT, Capitol complex) | `#735A12` (bronze) | `#735A12` | `#F2D25A` (capitol gold) | `#F2D25A` |
| `--cat-transport` | Transportation: I-35, Project Connect rail, bridges | `#E35A0B` | `#B8480C` | `#F07430` | `#F07430` |
| `--cat-trails` | Trails, parks, greenways | `#17935C` | `#0F7A4B` | `#2EBD78` | `#2EBD78` |
| `--cat-complete` | Any project with status *complete* (overrides category color on map) | `#A6A5A0` (concrete) | `#5C5B57` | `#5F6A72` | `#9AA5B0` |

Contrast of fills against land: light 3.2–5.7:1, and dark 5.3–11.6:1 for every category except complete. **Complete** is deliberately recessive: 2.1:1 in light and 3.1:1 in dark. Finished buildings should step back and read as "the city", but they still differ clearly from context buildings through height and tone.

Use **text-safe** variants whenever a category color is used as text. All are ≥ 4.5:1 on panel and land. For legend labels, prefer ink text next to a colored swatch.

Civic is bronze in light mode and gold in dark mode on purpose. A light yellow cannot reach 3:1 on paper, and a dark bronze disappears on navy. Both read as "capitol gold."

### 3.3 Basemap palette

| Feature | Light, "Drafting paper" | Dark, "Blueprint" |
|---|---|---|
| Background / land | `#F1EEE7` | `#0E1B2E` |
| Water (Lady Bird Lake, Colorado, creeks) | `#C8D5DE` | `#081424` |
| Parks / greenbelt | `#DCE3CF` | `#0F2A2A` |
| Context buildings (flat, z15+) | `#E4E0D6` | `#152640` |
| Minor roads | `#FFFFFF` (no casing) | `#1A2D47` |
| Major roads | `#FFFFFF`, casing `#DAD5CA` | `#22395A` |
| Highways | `#E9E3D6`, casing `#CFC7B8` | `#2C4870` |
| Rail (existing) | `#B9B3A6`, dash 2/2 | `#3A5478`, dash 2/2 |
| Boundaries / city limit | `#B9B3A6`, dash 4/2, 0.75px | `#3A5478` |
| Survey grid (optional, z≤13) | `#E6E1D6`, 0.5px | `#16294A`, 0.5px |
| Place / road labels | `#4F545C`, halo `#F1EEE7` 1.5px | `#9FB2CC`, halo `#0E1B2E` 1.5px |
| Water labels (italic) | `#3A566B` | `#7F9CC0` |
| Minor labels (neighborhoods) | `#6B7280` | `#8393AB` |

Label contrast ratios: 5.15–5.78:1 in light (on land, park, water, and building) and 5.4–8.0:1 in dark.

### 3.4 UI palette and status

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--bg` (map background) | `#F1EEE7` | `#0E1B2E` | |
| `--surface` (panels) | `#FAF8F4` | `#12223A` | |
| `--surface-sunken` (stat rows, inputs) | `#EDE9E0` | `#0B1626` | |
| `--line` (hairlines) | `#D9D4C8` | `#26395A` | decorative, not a contrast target |
| `--ink` | `#1B1F24` (15.6:1) | `#E8EDF5` (13.6:1) | |
| `--ink-2` | `#5A6069` (6.0:1) | `#A9B6C9` (7.8:1) | |
| `--ink-3` | `#6B7280` (4.56:1 on surface) | `#8393AB` (5.1:1) | min 12px; on land in light mode use `--ink-2` |
| `--accent` (safety orange) | `#F26B1D` | `#FF7A33` | fills only; ink text on it = 5.4:1 / 6.4:1 |
| `--accent-strong` | `#B8480C` | `#FF8A4C` | orange as text: 5.0:1 / 6.8:1 |
| `--focus` / links | `#2F5FB8` (5.7:1) | `#8AB4FF` (7.6:1) | focus ring is blue so it never reads as "construction" |
| Status: planned | bg `#E7E3DA`, fg `#1B1F24` | bg `#22324D`, fg `#E8EDF5` | + dashed outline |
| Status: under construction | bg `#F26B1D`, fg `#1B1F24` (5.4:1) | bg `#FF7A33`, fg `#1B1F24` (6.4:1) | the only solid-orange chip |
| Status: complete | bg `#DCEFE3`, fg `#1D5E3D` (6.4:1) | bg `#123A2C`, fg `#9BE3BD` (8.5:1) | |

Never put white text on orange. It is only 3.05:1.

### 3.5 Color is never the only signal
- Status on the map is shown by **form**, not only hue: planned = translucent ghost + hatch footprint; under construction = solid extrusion; complete = concrete gray.
- Transport and trails are **lines**, and the other categories are **volumes**. That separates the closest-hue pair (transport vs civic) by geometry.
- Legend rows always show a text label and a glyph. The glyph shape encodes the geometry type: square = building, line = corridor, dashed line = under-construction corridor.

### 3.6 CSS custom properties

```css
:root {
  /* type */
  --font-display: "Barlow Condensed", "Arial Narrow", sans-serif;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace;

  --fs-2xs: 0.6875rem; /* 11px, mono eyebrows only (uppercase, tracked) */
  --fs-xs: 0.75rem;    /* 12 */
  --fs-sm: 0.8125rem;  /* 13 */
  --fs-md: 0.9375rem;  /* 15 body */
  --fs-lg: 1.125rem;   /* 18 */
  --fs-xl: 1.5rem;     /* 24 */
  --fs-2xl: 2rem;      /* 32 panel title */
  --fs-3xl: 2.75rem;   /* 44 hero stat */

  /* space (4px base) */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px;

  --radius-sm: 4px;   /* chips, toggles */
  --radius-md: 8px;   /* controls, cards */
  --radius-lg: 14px;  /* panels, sheet */
  --panel-w: 400px;
  --header-h: 52px;

  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 120ms; --dur-med: 240ms; --dur-slow: 480ms;

  /* light: drafting paper */
  --bg: #F1EEE7;
  --surface: #FAF8F4;
  --surface-sunken: #EDE9E0;
  --line: #D9D4C8;
  --hairline: 0 0 0 1px rgba(27, 31, 36, 0.10);
  --shadow-float: 0 1px 2px rgba(27,31,36,.08), 0 8px 24px rgba(27,31,36,.10);
  --ink: #1B1F24;
  --ink-2: #5A6069;
  --ink-3: #6B7280;
  --accent: #F26B1D;
  --accent-strong: #B8480C;
  --on-accent: #1B1F24;
  --focus: #2F5FB8;

  --cat-residential: #3A6FD0;  --cat-residential-text: #2F5FB8;
  --cat-commercial: #C2379F;   --cat-commercial-text: #A92E8A;
  --cat-civic: #735A12;        --cat-civic-text: #735A12;
  --cat-transport: #E35A0B;    --cat-transport-text: #B8480C;
  --cat-trails: #17935C;       --cat-trails-text: #0F7A4B;
  --cat-complete: #A6A5A0;     --cat-complete-text: #5C5B57;

  --status-planned-bg: #E7E3DA;   --status-planned-fg: #1B1F24;
  --status-active-bg: #F26B1D;    --status-active-fg: #1B1F24;
  --status-complete-bg: #DCEFE3;  --status-complete-fg: #1D5E3D;

  --map-land: #F1EEE7; --map-water: #C8D5DE; --map-park: #DCE3CF;
  --map-building: #E4E0D6; --map-road-minor: #FFFFFF; --map-road-major: #FFFFFF;
  --map-road-casing: #DAD5CA; --map-highway: #E9E3D6; --map-highway-casing: #CFC7B8;
  --map-rail: #B9B3A6; --map-grid: #E6E1D6;
  --map-label: #4F545C; --map-label-halo: #F1EEE7; --map-label-water: #3A566B;

  color-scheme: light;
}

/* Light is the default for everyone; dark mode only applies once a visitor picks it with the toggle. */
:root[data-theme="dark"] {
  --bg: #0E1B2E;
  --surface: #12223A;
  --surface-sunken: #0B1626;
  --line: #26395A;
  --hairline: 0 0 0 1px rgba(159, 178, 204, 0.16);
  --shadow-float: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.45);
  --ink: #E8EDF5;
  --ink-2: #A9B6C9;
  --ink-3: #8393AB;
  --accent: #FF7A33;
  --accent-strong: #FF8A4C;
  --on-accent: #1B1F24;
  --focus: #8AB4FF;

  --cat-residential: #5C8BF7;  --cat-residential-text: #5C8BF7;
  --cat-commercial: #F59CCB;   --cat-commercial-text: #F59CCB;
  --cat-civic: #F2D25A;        --cat-civic-text: #F2D25A;
  --cat-transport: #F07430;    --cat-transport-text: #F07430;
  --cat-trails: #2EBD78;       --cat-trails-text: #2EBD78;
  --cat-complete: #5F6A72;     --cat-complete-text: #9AA5B0;

  --status-planned-bg: #22324D;   --status-planned-fg: #E8EDF5;
  --status-active-bg: #FF7A33;    --status-active-fg: #1B1F24;
  --status-complete-bg: #123A2C;  --status-complete-fg: #9BE3BD;

  --map-land: #0E1B2E; --map-water: #081424; --map-park: #0F2A2A;
  --map-building: #152640; --map-road-minor: #1A2D47; --map-road-major: #22395A;
  --map-road-casing: #0E1B2E; --map-highway: #2C4870; --map-highway-casing: #0E1B2E;
  --map-rail: #3A5478; --map-grid: #16294A;
  --map-label: #9FB2CC; --map-label-halo: #0E1B2E; --map-label-water: #7F9CC0;

  color-scheme: dark;
}
body { background: var(--bg); color: var(--ink); font: 400 var(--fs-md)/1.5 var(--font-body); }
```

(When implementing, copy the dark block into the `@media` rule too. Keep both the JS map style and CSS reading from one `tokens.ts` so they can't drift. MapLibre can't read CSS variables.)

---

## 4. Typography

All three families are on Google Fonts.

```html
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Role | Family | Why |
|---|---|---|
| Display (project titles, header wordmark, hero stats) | **Barlow Condensed** 600, often uppercase | Its design comes from California plates and highway signage, which gives a road/engineering tone without being a novelty font. Condensed widths fit long project names ("Waterloo Park / Waller Creek Tunnel") in a 400px panel. |
| Body / UI | **IBM Plex Sans** 400/500/600 | Engineering-born, neutral, and legible at 13px. Its tabular figures work in stat rows. |
| Data / labels | **IBM Plex Mono** 400/500 | Same skeleton as Plex Sans, so mixing them looks intentional. Used for coordinates, heights, unit counts, dates, permit IDs, and eyebrows. |

Scale and usage:

| Style | Font | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| Eyebrow | Mono | 11 / 16, uppercase | 500 | +0.08em | coordinate line, section labels ("SCHEDULE", "SOURCE") |
| Caption | Plex Sans | 12 / 16 | 400 | 0 | attribution, legend counts |
| UI | Plex Sans | 13 / 18 | 500 | 0 | toggles, buttons, chips |
| Body | Plex Sans | 15 / 24 | 400 | 0 | descriptions |
| Stat value | Mono | 15 / 20, `tabular-nums` | 500 | 0 | stat rows |
| H3 | Plex Sans | 18 / 24 | 600 | −0.01em | panel sub-sections |
| Panel title | Barlow Condensed | 32 / 34 | 600 | 0 | project name |
| Hero stat | Barlow Condensed | 44 / 44 | 600 | 0 | "58 FLOORS" in panel header |
| Map label: place | Plex Sans | 12–16 by zoom | 500 | +0.02em | |
| Map label: neighborhood | Mono | 11, uppercase | 400 | +0.12em | "EAST CESAR CHAVEZ" |
| Map label: project (z15+) | Barlow Condensed | 13 | 600 | 0 | |

Rules: stick to three weights (400/500/600). Put any number next to a unit in mono (`412 ft`, `1,092 units`, `2025–2033`). Don't use Barlow Condensed below 18px in the UI.

MapLibre glyphs: serve Plex Sans Medium, Plex Mono Regular, and Barlow Condensed SemiBold as PBF glyphs (build them with `font-maker` from the Protomaps project). Fall back to "Noto Sans Regular" in the `text-font` array.

**As built:** map labels currently use OpenFreeMap's hosted Noto Sans (Regular, Bold, Italic) because the Plex/Barlow PBF glyphs haven't been built yet. The UI chrome uses the web fonts above.

---

## 5. Components

### 5.1 Header (desktop 52px, mobile 48px)
- Floating bar, top-left, up to 640px wide: `--surface` background, `--hairline` border, `--shadow-float`, `--radius-md`, 8px inset from the viewport edge. Don't use a full-width bar, because the map should reach the top edge; a wide bar with little in it reads as app chrome. The legend and the detail panel both start at the height below it. While the panel is open, the bar narrows on smaller screens so it never runs under the panel.
- Contents: survey-mark icon (20px, `--accent` crosshair on ink circle) + wordmark "AUSTIN WIP" (Barlow Condensed 600, 20px, tracked +0.04em), then a search field (Plex Sans 13, placeholder "Search projects or addresses"). A theme toggle and an "About / sources" link sit at the right.
- A small mono counter under the wordmark on desktop: `214 PROJECTS · 61 ACTIVE`. The counter updates with filters and draws on UrbanToronto's stats dashboard.

### 5.2 Layer toggles / legend (one component)
From Felt and ZoLa: the legend *is* the layer control.
- Desktop: floating card, top-left under the toolbar, 280px wide, collapsible. It stays on the opposite side from the detail panel so the two never overlap. Mobile: a "Layers" pill under the toolbar that opens a small popover sheet.
- One row per category, 40px tall (44px on touch):
  `[checkbox-swatch] Label ............ count`
  - Swatch 14×14. Square for building categories, a 16×3 line for transport/trails, and orange-ink hazard stripes for the "Roadwork active" sub-row. When the layer is off, the swatch becomes an outlined box with `--line` and the label turns `--ink-3`.
  - Label: Plex Sans 13/500 `--ink`. Count: mono 12 `--ink-3`, right-aligned, tabular.
  - The whole row is the hit target (`role="switch"`, `aria-checked`). Hovering a row dims the other categories on the map to 25%.
- Below the categories, a hairline tick-rule divider, then a **status segmented control**: `Planned | Under construction | Complete`. It's multi-select, all on by default, with a mono label and a tiny status glyph each.
- Footer line: "Height = reported building height" in caption type.

### 5.3 Project detail panel

**Desktop: side panel.** Right side, `--panel-w` 400px, from below the header to an 8px inset at the bottom, `--radius-lg`, `--surface`, scrolls internally. On open, the map pads by `{right: 416}` so the selected building stays centered in the visible area.

Anatomy, top to bottom:
1. **Eyebrow row**: mono 11 uppercase: `30.2654° N 97.7470° W · DOWNTOWN`. Close button (×, 32px hit) at the right.
2. **Title**: Barlow Condensed 32, max 3 lines.
3. **Chip row**: status chip + category chip (swatch dot + label, outlined).
4. **Hero**: render or photo, 16:9, `--radius-md`, with a mono caption ("Rendering: Gensler"). If there's no image, show an auto-drawn footprint plan: the project's polygon in hairline ink on a hatch fill, with a north arrow and a scale bar. That fallback is in keeping with the design direction and costs nothing.
5. **Hero stat**: Barlow 44 value + mono unit ("58" "FLOORS" / "1.6" "MILES").
6. **Stat rows**: see 5.5.
7. **Timeline**: see 5.6.
8. **Description**: body 15/24, max 65ch, 3 lines collapsed with "More".
9. **Links**: "Permit record ↗", "Developer site ↗", in `--focus`.
10. **Source attribution**: see 5.7.

**Mobile: bottom sheet** (< 768px)
- Detents:
  - **Peek (132px)**: grabber, eyebrow, title (Barlow 24, 1 line, ellipsis), chips.
  - **Half (50vh)**: adds the hero image and stat rows.
  - **Full (100dvh − 48px)**: the whole panel.
- Opens at *peek* when a project is tapped, with the camera eased so the building sits in the upper 40% of the screen. The map stays interactive at peek and half. At full, the map gets a 30% `--bg` scrim.
- Floating styling at peek and half: 8px side and bottom gap, `--radius-lg` on all corners. At full: no gap, top corners only.
- Grabber: 36×4px, `--line`, centered 8px from the top. Drag with velocity snapping. Also support the grabber as a button: tap cycles peek → half → full. Escape or swipe down from peek closes the sheet.
- Use `env(safe-area-inset-bottom)` padding.

### 5.4 Status chip
Height 22px, padding 0 8px, `--radius-sm`, mono 11/500 uppercase, +0.06em tracking, with a leading 8px glyph:

| Status | Glyph | Style |
|---|---|---|
| PLANNED | ○ hollow circle | `--status-planned-*`, plus a 1px dashed `--ink-3` border |
| UNDER CONSTRUCTION | ◐ half-filled circle | `--status-active-*` (solid safety orange, ink text) |
| COMPLETE | ● filled circle | `--status-complete-*` |

The glyph carries the meaning without color and matches the map encoding (ghost / solid / concrete). Optional: in the panel only, an under-construction chip can show a mono progress suffix (`UNDER CONSTRUCTION · 62%`) when the data has one.

### 5.5 Stat rows
- Two-column definition list (`<dl>`) on `--surface-sunken`, `--radius-md`, rows 36px, hairline dividers between rows.
- Key: Plex Sans 13 `--ink-2`. Value: mono 15/500 `--ink`, `tabular-nums`, right-aligned.
- Order (from Urbanize): **Height / floors → Units / sq ft → Cost → Developer → Architect → Delivery → Permit #**. Hide rows with no data instead of showing "—".
- Units always use mono and follow the value: `412 ft · 58 fl`, `$1.6B`, `365 units`. Use imperial first, with metric in a `title` tooltip.

### 5.6 Timeline (dimension-line style)
- Horizontal axis drawn like an architectural dimension line: a 1px `--ink-3` hairline with ticks at each year and end caps at the start and end. Year labels in mono 11.
- Bar: 6px tall, category color. Past portion solid, future portion as a 45° hatch in the same color at 40% alpha.
- A "Today" marker: a 1px `--accent` vertical line with an 8px triangle on top, labeled `TODAY` in mono 10.
- **Segmented timelines** for linear projects (from TxDOT I-35): one row per segment, each with a label, e.g. `University (US 290 E–MLK) 2027–2033`. Hovering a row highlights that segment on the map.
- Milestones (groundbreaking, topping out, opening) are 7px diamonds on the bar, with a tooltip.

### 5.7 Source attribution
- Every panel ends with a hairline tick-rule and then mono 11 `--ink-3` text: `SOURCE  City of Austin permits · TxDOT · Urbanize ATX` and `UPDATED 2026-09-14`. Each source is a link.
- Map attribution (bottom-right) uses MapLibre's compact attribution restyled to caption type. Keep it on the map, never hidden behind the sheet: at mobile half/full detents, move it to the top-left.

---

## 6. Map specifics (MapLibre)

### 6.1 Layer order (bottom → top)
`land → survey-grid (z≤13) → landcover/parks → water → context-buildings (flat) → road casings → roads → rail → project-footprints (fill, hatch) → project-lines (trails, transport) → project-extrusions → selected-outline → labels (roads, places, water) → project-labels → selected survey-mark`

Put labels after the extrusions, as in Toner. Use `symbol-z-order: "viewport-y"` and `text-halo` so labels stay readable over 3D.

### 6.2 Camera defaults
- Initial hero view (desktop): `center [-97.7431, 30.2672]`, `zoom 14.2`, `pitch 55`, `bearing -20` (looking north up Congress from over Lady Bird Lake). Tune the bearing in the browser so the Congress Ave axis reads nearly vertical.
- Mobile: `zoom 13.2`, `pitch 45`, same bearing.
- Limits: `maxPitch 70`, `minZoom 9.5`, `maxBounds` ≈ Travis/Williamson bbox `[[-98.2, 30.0], [-97.4, 30.65]]`.
- Below z12: pitch eases to 0 and projects become clustered circles (UrbanToronto pattern), sized by count and colored by the dominant category.
- A "reset view" control, a "2D/3D" toggle (pitch 0 ↔ 55), and a compass that resets the bearing. The compass needle is red to the north (`#D0342C` light, `#FF6B5E` dark; 4.7:1 and 5.7:1 on `--surface`) and gray to the south. That is the only red in the UI.
- The zoom and compass controls sit bottom-right and slide left of the detail panel while it is open.

### 6.3 3D extrusions
MapLibre gotcha: **`fill-extrusion-opacity` is layer-wide and not data-driven.** So status needs *separate layers* that share one source and are split by filter.

| Layer | Filter | Color | Opacity | Notes |
|---|---|---|---|---|
| `proj-planned` | status = planned | category color | 0.35 | plus the hatch footprint layer below |
| `proj-active` | status = under_construction | category color | 0.92 | |
| `proj-complete` | status = complete | `--cat-complete` | 0.85 | |

```js
const catColor = ["match", ["get", "category"],
  "residential", T.catResidential, "commercial", T.catCommercial,
  "civic", T.catCivic, "transport", T.catTransport, "trails", T.catTrails,
  T.catComplete];

const catHover = ["match", ["get", "category"],   // each token lightened ~15% in OKLCH
  "residential", T.catResidentialHover, "commercial", T.catCommercialHover,
  "civic", T.catCivicHover, "transport", T.catTransportHover, "trails", T.catTrailsHover,
  T.catCompleteHover];
const catSelected = ["match", ["get", "category"],  // light: --cat-*-text; dark: category mixed 30% toward #FFFFFF
  "residential", T.catResidentialSel, "commercial", T.catCommercialSel,
  "civic", T.catCivicSel, "transport", T.catTransportSel, "trails", T.catTrailsSel,
  T.catCompleteSel];

paint: {
  "fill-extrusion-color": ["case",
    ["boolean", ["feature-state", "selected"], false], catSelected,
    ["boolean", ["feature-state", "hover"], false], catHover,
    catColor],
  "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"],
    12.5, 0,
    13.5, ["coalesce", ["get", "height_m"], ["*", ["get", "floors"], 3.6], 12]],
  "fill-extrusion-base": ["coalesce", ["get", "base_m"], 0],
  "fill-extrusion-vertical-gradient": true,
  "fill-extrusion-opacity": 0.92
}
```

- **Heights**: use the reported height in meters. If there's none, use floors × 3.6 m (≈ 11.8 ft). Otherwise use 12 m. No vertical exaggeration. Real heights are part of the story; Austin's towers are tall enough to read.
- **Grow-in**: extrusions interpolate from 0 to full height between z12.5 and z13.5, so they rise as you zoom in. Keep it tied to zoom, not a timer.
- **Hover**: color lightens about 15% (`catHover`). Show a cursor pointer and a small tooltip: title + status chip. Set hover and selection with `map.setFeatureState`, which needs `promoteId` or numeric feature ids on the source.
- **Selected**:
  - Extrusion color becomes `catSelected`: the darker text-safe tone in light mode, and the category lifted toward white in dark mode. The hue stays the same, with more emphasis.
  - A ground outline `line` layer (2px `--ink` / `--ink` dark, plus a 4px `--bg` casing) around the footprint.
  - A survey-mark symbol at the centroid (crosshair in circle, `--accent` stroke, 28px, `icon-allow-overlap`).
  - All other projects dim: switch the three extrusion layers to a desaturated variant with `setPaintProperty` over 240ms (`fill-extrusion-color` transition), not opacity.
- **Planned footprint hatch**: a `fill` layer with `fill-pattern: "hatch-45"`. Register the pattern at runtime: an 8×8 canvas with a 1px diagonal line in the category color at 60%, one image per category. Add a `line` layer with `line-dasharray [2, 2]` in the category color for the plan outline.

### 6.4 Line styles

| Feature | Status | Style |
|---|---|---|
| Transport corridor (I-35, rail) | under construction | **Hazard stripe**: two stacked lines. Base `line-color --cat-transport`, `line-width` interpolated z11: 4 → z16: 14. Top `line-color #1B1F24` (dark mode: `#0E1B2E`) with `line-dasharray [0.6, 0.6]` and `line-width` = base × 0.55. That gives an orange/ink striped band like work-zone barricades. For true diagonal stripes, use a `line-pattern` image (16×16, 45° orange/ink) on a single line instead. |
| Transport | planned | `--cat-transport` 3px, `line-dasharray [2, 1.5]`, opacity 0.7 |
| Transport | complete | `--cat-complete` 3px solid |
| Trails | under construction | `--cat-trails` 3px, `line-dasharray [3, 1.5]`, 1px `--bg` casing |
| Trails | planned | `--cat-trails` 2.5px, round caps, `line-dasharray [0.1, 2]` (dotted, like a proposed path on a site plan) |
| Trails | complete | `--cat-trails` 3px solid (complete trails keep green, since they're usable). Only buildings go concrete. |
| Segment ends (I-35 segments) | any | small perpendicular tick marks at segment boundaries (symbol layer with a rotated tick icon, `icon-rotation-alignment: map`), like station marks on a survey plan |

Animated marching dashes on active roadwork: allowed only when a transport feature is selected, and off under `prefers-reduced-motion`.

### 6.5 Labels
- Basemap labels: roads from z13, neighborhoods (mono uppercase, tracked) z11–15, then they fade out. Keep POI icons **off** entirely. The only "points of interest" on this map are projects.
- Project labels: z15+, Barlow Condensed 13, placed at the base of the extrusion (`text-anchor: top`, `text-offset [0, 0.6]`). Priority order: selected → under construction → civic → the rest (`symbol-sort-key`). `text-optional: true`, collision on.
- Water labels italic, `--map-label-water`, along the line for Lady Bird Lake and the Colorado.
- All labels get `text-halo-width 1.5`, `text-halo-blur 0.5`, halo = `--map-label-halo`.

---

## 7. Motion and interaction

1. **Motion explains place changes, nothing else.** Camera `easeTo` / `flyTo` on select: 900ms, `--ease-in-out`, `curve 1.2`. Keep the zoom change small and never pass z17.5.
2. **UI motion is short.** Panels and sheets take 240ms `--ease-out`. Chip and toggle state changes take 120ms. Nothing bounces.
3. **Map state and UI state stay in sync.** Hovering a legend row highlights that category on the map. Hovering a timeline segment highlights that segment. Hovering a building highlights its row in any list.
4. **The URL is the state.** `?p=<project-id>&layers=res,com,civ&status=uc&view=lat,lng,z,pitch,bearing`, so any view can be shared.
5. **Keyboard**: legend rows and chips are focusable. Arrow keys cycle projects in the visible viewport. Enter opens one and Esc closes the panel. The focus ring is a 2px `--focus` outline with a 2px offset.
6. **Reduced motion** (`prefers-reduced-motion: reduce`): `jumpTo` instead of `flyTo`, no marching dashes, and sheets snap without animation.
7. **Touch**: minimum 44px targets. Tap selects and doesn't hover. Two-finger drag controls pitch (MapLibre default), so don't override it.
8. **Loading**: skeleton rows in the panel, using hairline boxes with a 1.2s opacity pulse and no shimmer gradient. The map never blocks on project data. The basemap renders first.

---

## 8. Don'ts

- Don't use orange for anything except transport work, under-construction status, and the survey-mark accent. No orange headers, buttons, or hover states.
- No caution-tape borders, stencil fonts, hard hats, cone icons, or cork/paper textures. Blueprint means *color and linework*, not a skeuomorphic image.
- No satellite imagery as the default. It competes with the categorical colors. An optional satellite toggle is fine, with project layers kept on top.
- Don't color context buildings, show POI icons, or show a rainbow of road classes. Only tracked projects get hue.
- Don't vary `fill-extrusion-opacity` per feature. It can't be done, so split layers by status instead.
- Don't exaggerate heights, and don't extrude linear projects (I-35, trails). Lines stay on the ground.
- Don't put white text on orange (3.05:1), use category fills as text, or put `--ink-3` text on the light map background.
- Don't use more than 6 categorical hues. New layer types go into an existing category or get a pattern, not a seventh color.
- Don't show a legend that isn't also the toggle, or a toggle without a count.
- Don't hide attribution or source dates. Construction data goes stale fast, and "Updated" is part of the content.
- Don't autoplay camera tours on load. Start at the hero view and let the user drive.

---

## 9. Appendix: files
- `palette/palette-check.py`: WCAG contrast + Machado CVD simulation + CIEDE2000 checker.
- `palette-final.py`: the final palette and contrast pairs. Run `cd docs/palette && python3 palette-check.py palette-final.py`.
