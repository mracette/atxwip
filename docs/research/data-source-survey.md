# Austin construction map: data sources (probed 2026-09-28)

All endpoints below were hit with curl using an identifying User-Agent. **VERIFIED** means data came back and the fields and counts shown are real. Sample responses were saved during the survey but are not kept in the repo.

Base hosts:
- Socrata (SODA): `https://data.austintexas.gov/resource/<id>.json|.geojson`. Public domain, per the City of Austin Open Data Terms of Use. It works without a token, but an app token (`X-App-Token`) is recommended to avoid throttling. Aggregate queries on the 2.4M-row permit table take 20–60 s, so set timeouts of at least 120 s.
- City of Austin ArcGIS Online org: `https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/<Service>/FeatureServer/<layer>`. The org lists about 2,180 services (list saved in `coa_agol_services.txt`). All the layers used here support `f=geojson` and `outSR=4326`. `maxRecordCount` is 1000–2000, so page with `resultOffset`.
- TxDOT ArcGIS Online org: `https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/...` (list in `txdot_services.txt`).
- City on-prem ArcGIS: `https://maps.austintexas.gov/arcgis/rest/services` (folders: Shared, LongRangeCIP, Geocode/COA_Locator, and others).

---

## Recommended pipeline (TL;DR)

| Layer on map | Source | Geometry |
|---|---|---|
| New buildings (points, then parcel polygons) | ArcGIS `PLANNINGCADASTRE_issued_building_permits` (100% geocoded), joined on `TCAD_ID` to `EXTERNAL_tcad_parcel.PID_10` | Point, then Polygon |
| Project names and site footprints for big developments | ArcGIS `PLANNINGCADASTRE_site_plan_case` | Polygon (site boundary) |
| City capital projects (convention center, WWTPs, parks, mobility) | Capital Projects Explorer JSON `capitalprojects.austintexas.gov/api/projects` | MultiPolygon (405 of 1,498 projects) |
| City mobility projects in construction (corridors, SUPs, TxDOT-partnered) | ArcGIS `Moped_Project_Components_Complete_and_Construction_(Public_view)` | Line and MultiPoint |
| I-35 Capital Express segments | TxDOT `TxDOT_DCIS_All_Projects` (filter IH 35, Travis) | LineString |
| Urban Trails (in design or construction) | Socrata `jdwm-wfps` | MultiLineString |
| Light rail Phase 1 | ArcGIS `Austin_Light_Rail_DTI_Employment_Forecast/2` and `Light_Rail_Phase_1_Stops_WFL1/0` | Line and Point |
| Lane closures / work zones (city ROW) | Socrata `qyfh-gwei` (WZDx-style) | LineString |
| 3D context buildings | Socrata `scq8-2cei` (Impervious Cover 2023, `feature='Structure'`, `max_height` ft) | MultiPolygon |
| 3D for new projects | `number_of_floors` from permits × ~3.5 m, extruded on the parcel or site-plan polygon | — |

---

## 1. Issued Construction Permits (Socrata `3syk-w9eu`): VERIFIED

- Endpoint: `https://data.austintexas.gov/resource/3syk-w9eu.json` (also `.geojson`, using the `location` column).
- Volume: 2,377,723 rows (1980 to present). Updated **daily** (rowsUpdatedAt was 2026-09-28). License: Public Domain. Owner: Austin Development Services.
- Key fields: `permit_number`, `permittype` (BP/EP/MP/PP/DS), `permit_type_desc`, `permit_class_mapped` (Residential/Commercial), `permit_class` (for example "C- 105 Five or More Family Bldgs"), `work_class` (**'New'**, Remodel, Shell, Demolition…), `description`, `permit_location`, `tcad_id`, `applieddate`, `issue_date`, `status_current` (Active/Final/Expired/VOID…), `statusdate`, `expiresdate`, `completed_date`, `total_new_add_sqft`, `total_job_valuation`, `building_valuation`, `number_of_floors`, `housing_units`, `latitude`, `longitude`, `location`, `link` (object `{url}`), `project_id` (= AMANDA FOLDERRSN), `masterpermitnum` (groups the buildings of one project), `council_district`, `contractor_*`, `applicant_*`, `certificate_of_occupancy`.
- **There is no project-name field.** Get names from site plans (section 2).
- Filtering to new construction: `permittype='BP' AND work_class='New'`. Other permit types (EP/MP/PP/DS) repeat the same project. In the last 2 years there are 8,381 new BPs:
  - Residential: R-101 single family 4,079, R-103 duplex 512, R-329 structures 1,537 (pools, etc.; mostly noise).
  - Commercial: 1,802 total. C-105 5+ family 222, C-329 non-building structures 1,114 (EV chargers, pergolas, pools; **exclude these**), C-328 other nonres 120, C-326 schools 74, C-321 parking garages 69, C-327 stores 44, C-318 amusement 37, C-324 office 36, C-320 industrial 27, C-213 hotels 6, C-106 mixed use 6.
- Example queries (URL-encode the values):
  - New commercial buildings in the last 2 years, excluding C-329:
    `https://data.austintexas.gov/resource/3syk-w9eu.json?$where=permittype='BP' AND work_class='New' AND permit_class_mapped='Commercial' AND permit_class not like 'C- 329%' AND issue_date > '2024-09-28'&$limit=5000`
  - Multifamily grouped by project (one row per project):
    `$query=SELECT masterpermitnum, max(permit_location) as addr, max(total_job_valuation) as val, sum(housing_units) as units, max(number_of_floors) as floors, sum(total_new_add_sqft) as sqft, count(*) as n, max(latitude) as lat, max(longitude) as lon, max(tcad_id) as tcad WHERE issue_date > '2024-09-28' AND work_class='New' AND permittype='BP' AND permit_class in ('C- 105 Five or More Family Bldgs','C- 106 Mixed Use') GROUP BY masterpermitnum ORDER BY units DESC`
    This returns projects such as 512 Sabine St (696 units, 6 floors, $79.5M), 2730 E 7th (375 units, 7 floors, $70M), and 1420 E Howard Ln (1,580 units across 16 buildings).
  - Count check: `$query=SELECT count(*) WHERE ...`
- Quirks:
  - **Latitude/longitude are missing for many recent records in Socrata.** New BPs with coordinates: 2025 had 3,075 of 4,146; 2026 has only 1,226 of 3,306. `tcad_id` is about 99% populated. **Use the ArcGIS copy below, which is 100% geocoded.**
  - **Valuation is unreliable.** Many rows hold placeholder values ($1, $1,000, $100,000), and `total_job_valuation` is repeated on every building permit under a master project (for example 830,000,000 on every Bridge Point Pkwy permit). Aggregate with `max()` per `masterpermitnum`, never `sum()`. Also treat valuation as "reported," not reliable.
  - `ORDER BY total_job_valuation DESC` puts NULLs first. Add `AND total_job_valuation IS NOT NULL`.
  - `housing_units` is 1 on non-residential rows, so only trust it for R-101/102/103 and C-104/105/106.
- Permit detail link: `https://abc.austintexas.gov/web/permit/public-search-other?t_detail=1&t_selected_folderrsn=<project_id>`. It returns HTTP 200 as a JavaScript shell and works in a browser. The same pattern works for site plans (their `folderrsn`).
- Saved samples: `permits_sample.json`, `top_commercial.json`, `permits_metadata.json`.

### 1b. ArcGIS copy of building permits: VERIFIED (recommended)
- `https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/PLANNINGCADASTRE_issued_building_permits/FeatureServer/0`
- Point layer with 288,701 rows (**building permits only**; there are sibling layers `..._issued_electrical_permits`, `_mechanical_`, `_plumbing_`, `_ds_`, `_tree_`). Rebuilt **daily** (lastEdit 2026-09-28).
- It has the same 8,381 new BPs for the last 2 years, and **all 8,381 have geometry** (`GEOCODE_TYPE` 'xy coordinates' for 8,378, 'geocoding' for 3).
- Fields: `PERMIT_NUMBER, PERMIT_TYPE` ('Building Permit'), `SUB_TYPE` (= permit_class), `WORK_TYPE` (= work_class), `PERMIT_LOCATION, TCAD_ID, ISSUE_DATE` (epoch ms), `STATUS, FINAL_DATE, TOTAL_NEW_ADD_FOOTAGE, TOTAL_JOB_VALUATION, NUMBER_OF_FLOORS, NUMBER_OF_UNITS, WORK_DESCRIPTION, LINK, FOLDERRSN, LATITUDE, LONGITUDE, APPLICATION_DATE, EXPIRY_DATE, CERTIFICATE_OF_OCCUPANCY`. There is **no masterpermitnum**, so join to Socrata on `permit_number` if you need project grouping.
- Date filters must use `timestamp 'YYYY-MM-DD HH:MM:SS'`. `DATE '...'` silently returns 0.
- Example (688 features, 459 KB):
  `.../query?where=ISSUE_DATE >= timestamp '2024-09-28 00:00:00' AND WORK_TYPE='New' AND SUB_TYPE LIKE 'C-%' AND SUB_TYPE NOT LIKE 'C- 329%'&outFields=PERMIT_NUMBER,SUB_TYPE,PERMIT_LOCATION,TCAD_ID,ISSUE_DATE,STATUS,TOTAL_JOB_VALUATION,NUMBER_OF_FLOORS,NUMBER_OF_UNITS,TOTAL_NEW_ADD_FOOTAGE,WORK_DESCRIPTION,LINK,FOLDERRSN&outSR=4326&resultRecordCount=2000&f=geojson`
- Saved: `arcgis_permits_new_commercial_2y.geojson`, `arcgis_permits_sample.geojson`.

---

## 2. Site Plan Cases (project names and site polygons): VERIFIED

### 2a. Polygon layer (best source for "project footprint + name")
- `https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/PLANNINGCADASTRE_site_plan_case/FeatureServer/0`
- Polygon layer with 12,300 cases, updated **daily** (2026-09-28).
- Fields: `CASE_NUMBER` (SP-2026-0306C…), `SITE_PLAN_CASE_NAME` (**project name**, for example "Westin at the Domain Expansion" or "Koenig Mixed Use Development"), `SITE_PLAN_CASE_STATUS` (APPROVED 7,542 / EXPIRED / IN REVIEW 1,180 / WITHDRAWN…), `DETAILED_STATUS`, `SUB_TYPE`, `WORK_TYPE` ('Consolidated' = full site plan; 'Bldg/Prkg,Clring,…'), `PROPOSED_LAND_USE`, `DESC_OF_PROPOSED_DEVELOPMENT`, `DESCRIPTION_OF_WORK`, `APPLICATION_START_DATE`, `APPROVAL_DATE`, `TCAD_ID`, `LINK`, `FOLDERRSN`, `EXISTING_ZONING`, `OWNER_ORGANIZATION_NAME`.
- Quirk: `PROPOSED_NO_OF_UNITS`, `PROPOSED_BLDG_SQ_FOOTAGE`, and `GROSS_SITE_AREA_ACRES` exist but are almost always NULL. Get units and floors from permits instead.
- Example (765 polygons):
  `.../query?where=WORK_TYPE='Consolidated' AND (APPROVAL_DATE >= timestamp '2024-01-01 00:00:00' OR SITE_PLAN_CASE_STATUS='IN REVIEW')&outFields=CASE_NUMBER,SITE_PLAN_CASE_NAME,SITE_PLAN_CASE_STATUS,DETAILED_STATUS,PROPOSED_LAND_USE,DESC_OF_PROPOSED_DEVELOPMENT,APPROVAL_DATE,TCAD_ID,LINK&outSR=4326&geometryPrecision=6&f=geojson`
- Join to permits: spatially (permit point inside site-plan polygon) or on `TCAD_ID`.
- Saved: `siteplan_polygons_recent.geojson`, `siteplan_polygons_sample.geojson`.

### 2b. Tabular copy (Socrata `mavg-96ck`)
- `https://data.austintexas.gov/resource/mavg-96ck.json`. 23,735 rows, 19,345 with lat/lon. Updated daily.
- Fields: `case_name`, `permit_number`, `status`, `work`, `sub_type`, `proposed_land_use`, `description_of_work`, `application_start_date`, `approval_date`, `tcad_id`, `latitude/longitude/location` (Point), `link`, `owner_organization_name`, `smart_housing`.
- Example: `?$where=work='Consolidated' AND application_start_date > '2025-01-01'&$order=application_start_date DESC`
- Saved: `siteplan_sample.json`.
- Related layers not probed in depth: `PLANNINGCADASTRE_zoning_review_case`, `PLANNINGCADASTRE_subdivision_case`, and `PLANNINGCADASTRE_plan_review_cases` (points). Socrata also has Zoning Cases `edir-dcnf`.

---

## 3. Parcel polygons (TCAD): VERIFIED

- `https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/EXTERNAL_tcad_parcel/FeatureServer/0`
- 386,562 polygons, lastEdit 2026-09 (the city refreshes it from TCAD). Formats: JSON, geoJSON, PBF. maxRecordCount 2000.
- Fields: `PID_10` (**matches the permit `tcad_id`**, 10-digit, zero-padded string), `PROP_ID` (TCAD numeric id), `SITUS`, `ZONING`, `LAND_VALUE`, `PLAT`, `LOTS`, `BLOCKS`.
- By attribute (15 of 16 recent multifamily `tcad_id`s matched; the miss was probably a new replat, so fall back to point-in-polygon):
  `.../query?where=PID_10 IN ('0206041001','0204120426')&outFields=PID_10,PROP_ID,SITUS,ZONING&outSR=4326&f=geojson`
- Point-in-polygon (confirmed; returns the same parcel as the attribute query for 512 Sabine St):
  `.../query?geometry=-97.73637518,30.26592121&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=PROP_ID,PID_10,SITUS&outSR=4326&f=geojson`
- Use POST for long `IN` lists. Batch in about 200 ids per request.
- Other parcel layers: `BOUNDARIES_city_of_austin_parcel` (3,993 city-owned parcels) and `EXTERNAL_wcad_parcel` / `EXTERNAL_hcad_parcels` (Williamson and Hays counties, for projects outside Travis).
- Saved: `tcad_by_pid10.geojson`, `tcad_by_point.geojson`, `tcad_parcels_for_permits.geojson`.
- Caveat: a parcel is the lot, not the building. Master-planned sites are split across many lots, which is where site-plan polygons are better.

---

## 4. I-35 Capital Express (TxDOT)

### 4a. TxDOT DCIS All Projects: VERIFIED (best)
- `https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_DCIS_All_Projects/FeatureServer/0`
- Polyline layer with 73,306 projects statewide. lastEdit 2026-03-12, so it refreshes roughly every few months.
- Fields: `CONTROL_SECT_JOB` (CSJ), `HIGHWAY_NUMBER` ('IH 35'), `COUNTY_NAME`, `PROJ_CLASS`, `TYPE_OF_WORK`, `LIMITS_FROM`, `LIMITS_TO`, `EST_CONSTRUCTION_COST`, `PROJ_STG` (Planning/PE/PS&E/Construction/Closed), `PROJ_STAT`, `PROJ_ESTMTD_LET_D`, `ACTUAL_LET_DATE`, `PT_TOP100`, `PROJECT_ID`.
- Example (41 active I-35 Travis segments):
  `.../query?where=HIGHWAY_NUMBER='IH 35' AND COUNTY_NAME='Travis' AND PROJ_STAT<>'Closed'&outFields=CONTROL_SECT_JOB,PROJ_CLASS,TYPE_OF_WORK,LIMITS_FROM,LIMITS_TO,EST_CONSTRUCTION_COST,PROJ_STG,PROJ_STAT&outSR=4326&geometryPrecision=6&f=geojson`
- Capital Express Central CSJs found (0015-13-xxx):

  | CSJ | Segment | Cost | Stage |
  |---|---|---|---|
  | 428 | Holly St → US 290W/SH 71 (Lady Bird Lake segment) | $477M | Construction |
  | 433 | Drainage tunnel, MLK → Holly | $206M | Construction |
  | 440 | Drainage, Airport Blvd → 9th | $149M | Construction |
  | 438 | MLK bridge | $35M | Construction |
  | 423 | 51st → MLK | $1.50B | PS&E |
  | 442 | MLK → Holly (downtown) | $1.20B | PS&E |
  | 437 | Highway/railroad, MLK → Holly | $387M | PS&E |
  | 432 | US 290E → MLK | $254M | PS&E |
  | 441 | US 290E → 51st | $85M | PS&E |
  | 460 | Cesar Chavez → 4th | $150M | PS&E |
  | 455, 456, 457, 458 | Landscape (cap/stitch-adjacent) | — | Planning |
  | 388 | Umbrella, US 290E → SH 71 | cost $0.01 (placeholder) | — |

  Capital Express North (-389, -062, -073) and South (-077, 0016-01-113) are also present.
- Quirk: 1 of the 41 rows (a feasibility study) has null geometry, and some rows carry placeholder costs.
- Saved: `txdot_i35_travis_active.geojson`.

### 4b. Other TxDOT layers
- `TxDOT_Projects_FME/FeatureServer/0`: VERIFIED but **stale** (lastEdit 2023-09). It has a nice `PT_PHASE` text field ("Construction underway or begins soon"). Prefer DCIS.
- `ProjectTracker_AGO`: contains only a district polygon plus tables `%vwPTProjects` and `%PROJ_SPENDING_DTL`. Not probed further. UNVERIFIED as a usable source.
- Human project page pattern: `https://www.txdot.gov/mymobility35/projects/capex-central.html`. Project Tracker: `https://apps3.txdot.gov/apps-cq/project_tracker/projects.htm?PROJCSJ=0015-13-428` (UNVERIFIED, not fetched).
- Lane closures: DriveTexas `https://api.drivetexas.org/api/conditions.geojson` and `.../conditions.wzdx.geojson` return **401 Unauthorized** because an API key is required (free registration at drivetexas.org). The endpoint exists, but the data is UNVERIFIED.
- City copy of the I-35 footprint: `services.arcgis.com/0L95CJ0VTaxqcmED/.../I35Footprint/FeatureServer/0`. One polygon from 2021, likely the downtown ROW envelope. VERIFIED but old (`i35footprint_coa.geojson`).
- The city's Moped layer (section 5b) also includes "IH 35 from Holly St. to SH 71", "Capital Express Central - MLK", "IH 35 … CapEx South/North" as lines with phase 'Construction'.
- **Our Future 35 (cap and stitch):** no GIS layer found. Hand-curate it (see section 7).

---

## 5. City capital projects and mobility

### 5a. Capital Projects Explorer JSON: VERIFIED (unofficial but public)
- `https://capitalprojects.austintexas.gov/api/projects` returns a JSON array of **1,498 projects** (13.6 MB) with `project_id, project_name, project_description` (HTML), `category_id` (Water 503, Mobility Infrastructure 364, Facilities 245, Purchases 123, Housing 90, Park Amenities 80…), `project_stage_id` (Active 836 / Construction 310 / Anticipated 212 / Closeout 140), `budget`, `amount_spent`, `project_start_date`, `project_end_date` (free text such as "Anticipated Winter 2028-29"), `district_id`, `project_column_filter_entry3` (department), and `shapes[].the_geom` (**MultiPolygon, WGS84**).
- 405 projects have shapes, 168 of them in the Construction stage. Examples: Austin Convention Center Expansion ($1.74B budget, $1.19B spent, polygon); The Confluence ($95.7M); Spicewood Springs Rd ($52.8M); Walnut Creek WWTP; Concourse B and Tunnel ($1.33B, no shape).
- It is backed by Socrata dataset `ygpg-iccr` ("CPE All Temp", revealed by `/api/project_meta.json`). That dataset is **not** publicly queryable through `/resource/` (404), and the id looks temporary. The app endpoint is internal to the web app, so cache it and fail gracefully. Human project URL: `https://capitalprojects.austintexas.gov/projects/<project_id>` (pattern inferred, UNVERIFIED).
- Saved: `cpe_api_projects.json`, `cpe_construction_shapes.geojson` (168 features).
- Related Socrata tables without geometry: Capital Open Budget `ad5y-pg42` (5,202 rows) and Public Improvement Bonds Overview `s39q-8hvy` (2,953 rows: subproject_id, status, current_phase, appropriations). Both join on subproject id (= CPE `project_id`).

### 5b. Moped (ATPW Mobility Project Database) public view: VERIFIED
- `https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Moped_Project_Components_Complete_and_Construction_(Public_view)/FeatureServer/1` (lines) and `/0` (multipoints). Updated daily (2026-09-28).
- Lines: 2,260 total (138 in Construction). Points: 3,325 (286 in Construction).
- Fields: `project_id, project_name, component_name_full, current_phase_name_simple` ('Construction' | 'Complete'), `project_sponsor, project_lead, project_partners, project_website, substantial_completion_date, funding_sources, project_tags, council_districts`.
- Example (138 lines, 60 projects: 183 North, CapEx South, Pleasant Valley, Mokan Trail, Congress Ave Phase 1, Burnet Rd, Guadalupe…):
  `.../FeatureServer/1/query?where=current_phase_name_simple='Construction'&outFields=project_id,project_name,component_name_full,project_sponsor,project_website,substantial_completion_date,funding_sources&outSR=4326&geometryPrecision=6&f=geojson`
- The public view only includes Complete and Construction phases, not design.
- Saved: `moped_lines_construction.geojson`.

### 5c. Other city layers seen
- `2022_Large_Capital_Projects`: 5 lines, stale (2022).
- `TDS_CIP_Projects`: 2024 CIP intersections and segments.
- `Mobility_Bond_Programs`: lines.
- `2016_Mobility_Bond_Corridor_Projects`.
- `Safe_Routes_to_School_*`.
- `Sidewalks_Bond_Complete`.
- `Capital_Improvement_Projects_(Austin_Water)`.
- `WPD CIP Projects`.

These exist but were not probed (UNVERIFIED). The CPE and Moped sources above already cover most of them.

### 5d. Roadway Work Zones (Socrata `qyfh-gwei`): VERIFIED
- `https://data.austintexas.gov/resource/qyfh-gwei.geojson`. 4,179 current work zones with LineString geometry, updated **daily**, in WZDx-style fields: `name, road_names, direction, description, start_date, end_date, vehicle_impact` (all-lanes-closed 485 / some-lanes-closed 3,694), `work_zone_type, folderrsn, critical_corridor`.
- It only covers city ROW/excavation permits. **There are no TxDOT I-35 closures** (a query on road_names like '%IH 35%' returned 0). Only currently active or future zones are present (min end_date is today).
- Saved: `workzones_i35_sample.geojson` (actually W 35th St results).

---

## 6. Trails

### 6a. Urban Trails network (Socrata `jdwm-wfps`): VERIFIED (best)
- `https://data.austintexas.gov/resource/jdwm-wfps.geojson`, MultiLineString, 2,564 segments, updated daily. Also on ArcGIS as `TRANSPORTATION_urban_trails_network` and `Urban_Trails_Network_Public_view`.
- Fields: `urban_trail_name, urban_trail_system_name, build_status` (EXISTING / PROPOSED / DESIGN / PRELIMINARY_ENGINEERING / CONSTRUCTION / PROPOSED_NEEDS_UPGRADE), `phase_simple` (EXISTING / PROPOSED / ACTIVE / CONSTRUCTION), `length_miles, year_open, project_sponsor, construction_manager, priority_2023utp, trail_surface_type`.
- Counts: CONSTRUCTION 20 segments (4.6 mi), ACTIVE (design/PE) 93 segments (~32 mi), PROPOSED 734 (442 mi), EXISTING 1,540 (209 mi).
- Example (113 features):
  `?$query=SELECT urban_trail_name, urban_trail_system_name, build_status, phase_simple, length_miles, project_sponsor, the_geom WHERE phase_simple in ('CONSTRUCTION','ACTIVE')`
- In construction: Waterloo Park to Colorado River, Shoal Creek, Slaughter Creek, Burnet Rd SUP, Violet Crown, Bergstrom Spur, Country Club Creek, Mokan, Zilker Multimodal. In design: Northern Walnut Creek, Red Line Trail, Bergstrom Spur, Mokan.
- Saved: `urban_trails_active.geojson`.

### 6b. PARD trails (parks asset inventory): VERIFIED
- `.../pard_trails_nrpa/FeatureServer/0`. 4,096 lines, lastEdit 2026-04. Fields: `TRAIL_SYSTEM_NAME, ASSET_STATUS, YEAR_BUILT, WIDTH_FT, ASSET_SURFACE`. Existing trails only, so it is a context layer and has no construction status.
- Also `pard_proposed_local_trails`, `Proposed_Urban_Trails_Network_Public_View`, and `UrbanTrails_*_Construction` (older years). Not probed.

---

## 7. Light rail (Project Connect / Austin Light Rail Phase 1): VERIFIED
- Route: `https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Austin_Light_Rail_DTI_Employment_Forecast/FeatureServer/2`. 3 LineString/MultiLineString features (Riverside | 38th, Riverside | SoCo, Riverside | Oltorf | Yellow Jacket), `Phasing='Phase 1'`, lastEdit 2026-08-12. Saved as `lightrail_route_coa.geojson`.
- Stops: `.../Light_Rail_Phase_1_Stops_WFL1/FeatureServer/0`. 15 Phase 1 stations, lastEdit 2026-07-24 (`lightrail_phase1_stops.geojson`). The older `Light_Rail_Stations` layer has 31 stations with a `Starter` flag (2024).
- This is a city-hosted copy, not Austin Transit Partnership's own service. Treat it as authoritative-ish.

---

## 8. 3D and building heights

- **Impervious Cover 2023 (Socrata `scq8-2cei`): VERIFIED.** It contains 452,119 `feature='Structure'` MultiPolygons, and all of them have `max_height` (feet above ground), `elevation`, `base_eleva`, and `source` (imagery year up to 2019/2023). This is the best citywide footprint + height layer. Example:
  `https://data.austintexas.gov/resource/scq8-2cei.geojson?$where=feature='Structure' AND within_box(the_geom, 30.2700, -97.7440, 30.2650, -97.7380)&$select=the_geom,max_height,base_eleva,source`
  The top result was 519 ft (the Austonian). This is an existing-conditions layer, so new towers finished after about 2023 are missing. It is too big to ship whole; tile it with tippecanoe to PMTiles, or clip to downtown.
- `UTILITIESCOMMUNICATION_building_footprints_2017` (ArcGIS, 737k polygons with `MAX_HEIGHT` ft; 105k have null or 0) and `STRUCTURE_building_footprints_2013`: VERIFIED but older.
- For **new projects**, use `number_of_floors` from permits (per building, about 99% populated on new BPs) × ~3.5 m (commercial) or 3.0 m (residential). Extrude the site-plan or parcel polygon, or better, a buffered footprint. `total_new_add_sqft / floors` gives an approximate footprint area to sanity-check against the parcel.
- Saved: `impervious2023_structures_downtown.geojson`, `footprints2017_downtown_sample.geojson`.

---

## 9. Hand-curated major projects (facts checked by web search, Sept 2026)

Coordinates are approximate centers. Items marked (CPE) are centroids of the city's Capital Projects Explorer polygon.

| # | Project | Description | Status (Sep 2026) | Est. completion | Budget | Official URL | lat, lon |
|---|---|---|---|---|---|---|---|
| 1 | I-35 Capital Express Central | TxDOT rebuild of I-35 from US 290E to SH 71: lowered mainlanes, drainage tunnels, new bridges including Lady Bird Lake. | Under construction in segments. Tunnel boring machines arrive in 2026; Lady Bird Lake bridge work starts late 2026. | Segments 2029–2033 | ~$4.5B | https://www.txdot.gov/mymobility35/projects/capex-central.html | 30.2700, -97.7340 |
| 2 | Our Future 35: cap and stitch | City-funded deck parks ("caps") and widened crossings ("stitches") over the lowered I-35. Council approved up to $104M for structural support for 3 downtown caps and 2 northern stitches. | Design / funding | Tied to CapEx Central (~2030s) | ~$870M+ total estimated; $104M committed for supports | https://capitalprojects.austintexas.gov/projects/9224.011 (CPE; the city Our Future 35 page URL was not confirmed) | 30.2660, -97.7360 |
| 3 | Austin Convention Center redevelopment | Old center closed April 2025 and was demolished; a new, larger center with about double the rentable space is being built on the same site. | Excavation and early construction | Reopens 2029 | $1.6B (CPE budget $1.74B) | https://unconventionalatx.com | 30.26365, -97.73965 (CPE) |
| 4 | Austin Light Rail Phase 1 | 9.8-mile line from 38th St through downtown and across the lake to Oltorf and Yellow Jacket, with 15 stations. FTA environmental clearance came in Jan 2026; a $60M early design-build contract went to Austin Rail Constructors. | Pre-construction; heavy construction starts 2027 | First trains 2033 | ~$4.8B (2024 $), ~$7.1B year-of-expenditure | https://www.atptx.org/light-rail | 30.2600, -97.7430 (downtown) |
| 5 | AUS Journey with AUS / Concourse B | Airport expansion: 26-gate midfield Concourse B plus tunnel, and a new Arrivals and Departures Hall. $90M FAA grant in June 2026. | Enabling projects in construction; Concourse B in design/early works | Concourse B ~2030 | ~$4B program (Concourse B + tunnel ~$1.33B per CPE) | https://capitalprojects.austintexas.gov/projects/13185.001 (CPE page; the airport program page URL was not confirmed) | 30.1975, -97.6664 |
| 6 | Waterloo Greenway Phase II: The Confluence | 13-acre park and creek restoration on lower Waller Creek, 4th St to Lady Bird Lake. | **Opened June 6, 2026** (show as recently completed) | 2026 | $91.5M | https://waterloogreenway.org | 30.26192, -97.73918 (CPE) |
| 7 | Waterline | 74-story, 1,025 ft supertall at 98 Red River St (apartments, office, 1 Hotel); the tallest building in Texas. | **Construction completed late Aug 2026** | 2026 | private | https://www.kpf.com/projects/waterline | 30.2612, -97.7383 |
| 8 | UT Austin Medical Center (with MD Anderson) | Two hospitals: a UT specialty hospital and an MD Anderson cancer center. In Feb 2026 the site moved from the Erwin Center to NW Austin, west of the Pickle Research Campus; the exact site is not confirmed. | Planning / rezoning | 2030 target | multibillion ($2.5B est. originally) | none confirmed (news: kut.org / communityimpact.com, Feb 18 2026) | ~30.39, -97.73 (approx.) |
| 9 | 183 North Mobility Project (CTRMA) | Adds 2 toll lanes each way plus a 4th general-purpose lane on US 183 from MoPac to SH 45, about 9 miles. | Construction, finishing | 2026 | $612M | https://www.183north.com | 30.4300, -97.7600 |
| 10 | Congress Avenue Urban Design Initiative | Wider sidewalks, trees, and upgraded bikeways on Congress Ave. Phase 1 runs Cesar Chavez to 7th and broke ground Jan 30, 2026. | Construction (Phase 1) | Phase 1 summer 2027; full program ~2030 | $13M Phase 1 / $29M total | https://www.austintexas.gov/page/congress-avenue | 30.2665, -97.7431 |
| 11 | Barton Springs Road Bridge replacement | Replaces the 1925 bridge over Barton Creek at the Zilker entrance. | Design; bid late 2026 to early 2027 | Construction begins summer 2027; CPE says Winter 2030-31 | $32M (CPE budget $38.5M) | https://capitalprojects.austintexas.gov/projects/5873.031 | 30.2641, -97.7702 |
| 12 | Bergstrom Spur Urban Trail | 6.5-mile rail-trail from near St. David's South toward the airport, built in phases. | Construction on the first phase; other phases in design | 2028–2030 by segment | ~$47M across 3 CPE subprojects | https://www.austintexas.gov/UrbanTrails | 30.2131, -97.6945 (CPE, east) / ~30.215, -97.740 (west) |
| 13 | Red Line Trail (Braker Ln → Northern Walnut Creek Trail) | 1.7-mile shared-use path along the CapMetro Red Line. | Construction starting 2026 | Spring 2029 (CPE) | ~$8.8M | https://www.austintexas.gov/UrbanTrails | 30.40264, -97.71187 (CPE) |
| 14 | Spicewood Springs Road Regional Mobility | Corridor safety and capacity rebuild. | Construction | Fall 2026 | $52.8M | https://data.austintexas.gov/stories/s/v4g4-vwxa | 30.37802, -97.76362 (CPE) |
| 15 | I-35 Capital Express North and South | TxDOT added managed lanes north (SH 45N → US 290E) and south (SH 71 → SH 45SE). | Construction | ~2026–2027 | ~$330M North + ~$226M/$147M South segments (DCIS) | https://www.txdot.gov/mymobility35.html | North 30.36, -97.69 / South 30.18, -97.77 |

Not included:
- Oak Hill Parkway (US 290/SH 71) was reported completed in 2026.
- The Statesman site (South Central Waterfront, Endeavor; up to 1,378 units and 40-story towers) is approved but has no confirmed 2026 construction start. Verify before adding it.
- The Travis County Expo Center rebuild ($470–620M) is still in planning.

---

## 10. Suggested build-time fetch order and sizes

1. ArcGIS building permits, new, last 24 months, excluding C-329: about 690 commercial rows plus about 5,700 residential BPs (maybe filter R-101 to clusters or show as dots). Page 2,000 at a time.
2. For the commercial and multifamily results, look up TCAD parcels by `TCAD_ID` in batches of about 200 via POST. Fall back to point-in-polygon.
3. Site-plan polygons (765 rows for Consolidated since 2024 plus in-review) to supply names. Spatially join them to permits.
4. CPE `/api/projects`, filtered to `project_stage_id in (Construction, Active)` with shapes (about 384 polygons). Cache the last good copy because the endpoint is internal to the web app.
5. Moped lines and points in Construction (138 + 286).
6. TxDOT DCIS IH 35 Travis (41 lines). Optionally add other highways such as US 183, SL 1, and US 290.
7. Urban trails in CONSTRUCTION or ACTIVE (113 lines).
8. Light rail route and stops (static; refresh monthly).
9. Hand-curated `major-projects.json` from section 9.
10. Optional: `qyfh-gwei` work zones for a daily "closures" overlay (4k lines).

Politeness and robustness: set an identifying User-Agent, use an app token for Socrata, allow 120 s timeouts on Socrata aggregates, and on ArcGIS use `resultOffset` paging and check `exceededTransferLimit`.

URL check (curl -L, 2026-09-28):
- Returned 200: atptx.org/light-rail, kpf.com/projects/waterline, 183north.com, austintexas.gov/page/congress-avenue, austintexas.gov/UrbanTrails, unconventionalatx.com, waterloogreenway.org, txdot.gov capex-central, and the capitalprojects.austintexas.gov/projects/<id> pattern.
- Several guessed austintexas.gov department URLs returned 404 and were replaced with CPE project pages.

Sources for section 9:
- [TxDOT CapEx Central](https://www.txdot.gov/mymobility35/projects/capex-central.html)
- [Equipment World, CapEx Central 2026](https://www.equipmentworld.com/roadbuilding/article/15774495/txdot-i35-central-project-to-speed-up-in-2026)
- [Unconventional ATX](https://unconventionalatx.com/)
- [KUT, Project Connect explainer, Jul 2026](https://www.kut.org/transportation/2026-07-24/austin-tx-project-connect-explainer-capmetro-light-rail-bus-train)
- [Community Impact, $60M light rail contract](https://beta2.communityimpact.com/austin/south-central-austin/transportation/2026/02/19/60m-design-build-contract-approved-for-first-phase-of-austin-light-rail-construction)
- [AUS $90M FAA grant](https://www.spartnerships.com/austin-bergstrom-secures-record-90m-faa-grant-for-concourse-b-project/)
- [Waterloo Greenway Confluence opening](https://www.austinchamber.com/events/grand-opening-of-waterloo-greenway-phase-ii-the-confluence)
- [Waterline (Wikipedia)](https://en.wikipedia.org/wiki/Waterline_(Austin))
- [UT medical center moves to NW Austin](https://www.kedt.org/texas-news/2026-02-18/ut-scraps-plans-for-medical-center-at-erwin-center-site-moves-to-north-austin)
- [183 North](https://tollroadsnews.com/2025/04/01/ctrmas-183-north-mobility-project-progresses-toward-2026-completion)
- [Congress Ave groundbreaking](https://beta2.communityimpact.com/austin/south-central-austin/transportation/2026/01/30/austin-officials-break-ground-on-first-phase-of-congress-avenue-urban-design-initiative)
- [Barton Springs Rd bridge](https://beta2.communityimpact.com/austin/central-austin/transportation/2026/06/12/central-austin-transportation-greenway-opens-road-projects-advance-this-summer/)
- [Cap and stitch funding](https://communityimpact.com/south-central-austin/transportation/grants-loans-and-a-new-city-bond-how-austin-could-cover-870m-in-i-35-cap-and-stitch-costs/)
- [Bergstrom Spur](https://austinmonitor.com/stories/2025/02/south-austins-newest-trail-is-under-construction-will-the-trump-administration-help-pay-for-it/)
- [Oak Hill Parkway completed](https://www.fox7austin.com/news/txdot-completes-oak-hill-parkway-project.amp)
