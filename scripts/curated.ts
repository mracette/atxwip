import type { Geometry } from 'geojson';
import type { ProjectInput } from './lib/project.ts';

/**
 * Hand-checked facts for projects the public datasets describe poorly.
 * Re-verify dates and budgets when editing; each entry cites where its facts came from.
 * Last reviewed 2026-09-29.
 */

/** Overrides applied to a feature produced by a data source, matched by id or by name. */
export interface Override {
  match: { id?: string; idPrefix?: string; name?: RegExp };
  set: Partial<ProjectInput>;
}

/** Projects no dataset has. */
export interface Addition {
  input: ProjectInput;
  geometry: Geometry;
}

const CAPEX_URL = 'https://www.txdot.gov/mymobility35/projects/capex-central.html';
const CAPEX_CORRIDOR = 'I-35 Capital Express Central';
const CAPEX = 'Part of I-35 Capital Express Central, TxDOT\'s ~$4.5B rebuild of I-35 between US 290 East and SH 71: lowered main lanes, new drainage tunnels and rebuilt crossings.';

/** Applied in order, so later (more specific) entries win. */
export const OVERRIDES: Override[] = [
  {
    match: { idPrefix: 'txdot-0015-13-' },
    set: { description: CAPEX },
  },
  {
    match: { id: 'txdot-0015-13-428' },
    set: {
      name: 'I-35 Capital Express Central: Holly St to SH 71',
      description: `${CAPEX} This southern segment includes new bridges over Lady Bird Lake.`,
      segments: [{ label: 'Lady Bird Lake segment', start: '2025', end: '2033' }],
      corridor: CAPEX_CORRIDOR,
    },
  },
  {
    match: { id: 'txdot-0015-13-433' },
    set: {
      name: 'I-35 Capital Express Central: drainage tunnel',
      description: `${CAPEX} A tunnel bored beneath the corridor carries storm water from MLK to Lady Bird Lake so the lowered highway doesn't flood.`,
      segments: [{ label: 'Drainage tunnel', start: '2025', end: '2029' }],
      corridor: CAPEX_CORRIDOR,
    },
  },
  {
    match: { id: 'txdot-0015-13-442' },
    set: {
      name: 'I-35 Capital Express Central: downtown (MLK to Holly)',
      description: `${CAPEX} Downtown, the main lanes drop below street level, which is what makes the city's cap-and-stitch decks possible.`,
      segments: [{ label: 'Downtown segment', start: '2027', end: '2033' }],
      corridor: CAPEX_CORRIDOR,
    },
  },
  {
    match: { id: 'txdot-0015-13-438' },
    set: {
      name: 'I-35 Capital Express Central: MLK Blvd',
      description: `${CAPEX} The first segment to start, at the Martin Luther King Jr. Blvd crossing.`,
      segments: [{ label: 'MLK Blvd segment', start: '2024', end: '2026' }],
      corridor: CAPEX_CORRIDOR,
    },
  },
  {
    match: { id: 'txdot-0015-13-432' },
    set: {
      name: 'I-35 Capital Express Central: University (US 290 E to MLK)',
      description: `${CAPEX} This northern segment runs from US 290 East down to MLK, along the east side of the University of Texas campus.`,
      segments: [{ label: 'University segment', start: '2027', end: '2033' }],
      corridor: CAPEX_CORRIDOR,
    },
  },
  {
    match: { id: 'cpe-6020.119' },
    set: {
      name: 'Austin Convention Center redevelopment',
      category: 'civic',
      status: 'active',
      flat: false,
      floors: 6,
      description: 'The old convention center closed in April 2025 and was torn down. A new center with roughly double the rentable space is going up on the same blocks, with the street grid partly restored.',
      start: '2025-04',
      end: '2029',
      links: [{ label: 'Unconventional ATX (project site)', url: 'https://unconventionalatx.com' }],
    },
  },
  {
    match: { name: /^183 North from MoPac/i },
    set: {
      name: '183 North Mobility Project',
      description: 'Adds two toll lanes each way plus a fourth general-purpose lane on US 183 from MoPac to SH 45, about 9 miles. Built by the Central Texas Regional Mobility Authority.',
      cost: 612_000_000,
      end: '2026',
      links: [{ label: '183north.com', url: 'https://www.183north.com' }],
    },
  },
  {
    match: { name: /^Congress Avenue Urban Design Initiative/i },
    set: {
      name: 'Congress Avenue Urban Design Initiative, Phase 1',
      description: 'Wider sidewalks, shade trees and upgraded bikeways on Congress Avenue from Cesar Chavez to 7th Street. Broke ground January 30, 2026.',
      start: '2026-01',
      end: '2027-07',
      cost: 13_000_000,
      links: [{ label: 'City project page', url: 'https://www.austintexas.gov/page/congress-avenue' }],
    },
  },
];

export const ADDITIONS: Addition[] = [
  {
    // Tower footprint traced from OpenStreetMap (way 12139667662).
    geometry: {
      type: 'Polygon',
      coordinates: [[[-97.739793, 30.261342], [-97.739342, 30.261713], [-97.739058, 30.261453], [-97.739509, 30.261083], [-97.739793, 30.261342]]],
    },
    input: {
      id: 'curated-waterline',
      name: 'Waterline',
      category: 'commercial',
      status: 'complete',
      description: 'A 74-story supertall at 98 Red River St with apartments, offices and a 1 Hotel. At about 1,025 feet it is the tallest building in Texas.',
      floors: 74,
      height_m: 312,
      end: '2026-08',
      address: '98 Red River St',
      footprint: 'Tower footprint (OpenStreetMap)',
      links: [{ label: 'KPF project page', url: 'https://www.kpf.com/projects/waterline' }],
      sources: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Waterline_(Austin)' }],
    },
  },
  {
    geometry: { type: 'Point', coordinates: [-97.73918, 30.26192] },
    input: {
      id: 'curated-confluence',
      name: 'Waterloo Greenway: The Confluence',
      category: 'trails',
      status: 'complete',
      description: 'A 13-acre park and creek restoration on lower Waller Creek, from 4th Street to Lady Bird Lake. Opened June 6, 2026.',
      cost: 91_500_000,
      end: '2026-06',
      links: [{ label: 'Waterloo Greenway', url: 'https://waterloogreenway.org' }],
      sources: [{ label: 'Greater Austin Chamber', url: 'https://www.austinchamber.com/events/grand-opening-of-waterloo-greenway-phase-ii-the-confluence' }],
    },
  },
  {
    geometry: { type: 'Point', coordinates: [-97.6664, 30.1975] },
    input: {
      id: 'curated-aus-concourse-b',
      name: 'AUS airport expansion: Concourse B',
      category: 'civic',
      status: 'active',
      description: 'Journey with AUS: a new 26-gate midfield Concourse B connected by a tunnel, plus a new arrivals and departures hall. Enabling projects are under construction; the airport won a record $90M FAA grant for Concourse B in June 2026.',
      cost: 4_000_000_000,
      end: '2030',
      links: [{ label: 'Capital Projects Explorer', url: 'https://capitalprojects.austintexas.gov/projects/13185.001' }],
      sources: [{ label: 'Airport news release', url: 'https://www.spartnerships.com/austin-bergstrom-secures-record-90m-faa-grant-for-concourse-b-project/' }],
    },
  },
  {
    geometry: { type: 'Point', coordinates: [-97.7355, 30.2690] },
    input: {
      id: 'curated-cap-and-stitch',
      name: 'Our Future 35: cap and stitch',
      category: 'civic',
      status: 'planned',
      description: 'City-led deck parks ("caps") and widened crossings ("stitches") over the lowered I-35. Council committed up to $104M for the structural supports for three downtown caps and two northern stitches; the full program is estimated at about $870M.',
      cost: 870_000_000,
      end: '2033',
      links: [{ label: 'Capital Projects Explorer', url: 'https://capitalprojects.austintexas.gov/projects/9224.011' }],
      sources: [{ label: 'Community Impact', url: 'https://communityimpact.com/south-central-austin/transportation/grants-loans-and-a-new-city-bond-how-austin-could-cover-870m-in-i-35-cap-and-stitch-costs/' }],
    },
  },
];

/** Applied to the light rail route fetched from the city's GIS. */
export const LIGHT_RAIL: Omit<ProjectInput, 'id'> = {
  name: 'Austin Light Rail, Phase 1',
  category: 'transport',
  status: 'planned',
  description: 'A 9.8-mile line from 38th Street through downtown and across Lady Bird Lake to Oltorf and Yellow Jacket, with 15 stations. Federal environmental clearance came in January 2026 and an early design-build contract went to Austin Rail Constructors; heavy construction is expected to start in 2027.',
  cost: 7_100_000_000,
  developer: 'Austin Transit Partnership',
  start: '2027',
  end: '2033',
  links: [{ label: 'Austin Transit Partnership', url: 'https://www.atptx.org/light-rail' }],
  sources: [
    { label: 'City of Austin GIS (route)', url: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Austin_Light_Rail_DTI_Employment_Forecast/FeatureServer/2' },
    { label: 'KUT', url: 'https://www.kut.org/transportation/2026-07-24/austin-tx-project-connect-explainer-capmetro-light-rail-bus-train' },
  ],
};
