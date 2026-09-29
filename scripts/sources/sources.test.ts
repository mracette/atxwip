import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describe as describeCpe, seasonDate } from './capital-projects.ts';
import { impact, routeName, workFromName } from './closures.ts';
import { baseAddress, cleanSitePlanName, cleanWorkDescription, landUseCategory, projectCategory, projectCost } from './development.ts';
import { isTrail } from './mobility.ts';
import { formatCsj, highwayName, stageStatus } from './txdot.ts';

test('seasonDate reads the Capital Projects Explorer free-text dates', () => {
  assert.equal(seasonDate('Anticipated Winter 2028-29'), '2029-01');
  assert.equal(seasonDate('Summer 2024'), '2024-07');
  assert.equal(seasonDate('Anticipated Fall 2027'), '2027-10');
  assert.equal(seasonDate('2031'), '2031');
  assert.equal(seasonDate('TBD'), undefined);
});

test('describe pulls the summary and location out of CPE description HTML', () => {
  const html = '<p>Convention Center Expansion per City Council Resolution</p><a href="mailto:x">Contact Us</a><br><font size=3>Project Location: 500 East Cesar Chavez</font><br>';
  assert.deepEqual(describeCpe(html), { description: 'Convention Center Expansion per City Council Resolution', address: '500 East Cesar Chavez' });
});

test('projectCost counts a repeated master valuation once and ignores placeholders', () => {
  assert.equal(projectCost([830_000_000, 830_000_000, 830_000_000]), 830_000_000);
  assert.equal(projectCost([12_000_000, 9_000_000]), 21_000_000);
  assert.equal(projectCost([1, 1000, null]), undefined);
});

test('an apartment complex stays residential despite its clubhouse and garage permits', () => {
  const permits = [
    { SUB_TYPE: 'C- 105 Five or More Family Bldgs', TOTAL_NEW_ADD_FOOTAGE: 300_000, NUMBER_OF_UNITS: 300 },
    { SUB_TYPE: 'C- 321 Pkg Garage Bldg & Open Deck', TOTAL_NEW_ADD_FOOTAGE: 200_000, NUMBER_OF_UNITS: 1 },
    { SUB_TYPE: 'C- 318 Amusement, Social & Rec Bldgs', TOTAL_NEW_ADD_FOOTAGE: 8_000, NUMBER_OF_UNITS: 1 },
  ];
  assert.equal(projectCategory(permits), 'residential');
});

test('a tower with substantial office space is mixed use', () => {
  const permits = [
    { SUB_TYPE: 'C- 105 Five or More Family Bldgs', TOTAL_NEW_ADD_FOOTAGE: 400_000, NUMBER_OF_UNITS: 350 },
    { SUB_TYPE: 'C- 324 Office, Bank & Professional Bldgs', TOTAL_NEW_ADD_FOOTAGE: 250_000, NUMBER_OF_UNITS: 1 },
  ];
  assert.equal(projectCategory(permits), 'commercial');
});

test('site plan and permit text cleanup', () => {
  assert.equal(cleanSitePlanName('Midtown Point (W/R SP-2023-0516C)'), 'Midtown Point');
  assert.equal(cleanSitePlanName('ENDEAVOR BLUE BLUFF MULTIFAMILY'), 'Endeavor Blue Bluff Multifamily');
  assert.equal(
    cleanWorkDescription('ePlan: Commercial Expedited Review - [CONCURRENT] New Construction of New Apartments (34436 SF).'),
    'New Construction of New Apartments (34436 SF).',
  );
  assert.equal(baseAddress('8920 HILLOCK TER BLDG 4'), '8920 Hillock Ter');
  assert.equal(landUseCategory('Commercial Multi Family'), 'residential');
  assert.equal(landUseCategory('Mixed Use (Residential/Commercial)'), 'commercial');
  assert.equal(landUseCategory('Public/Civic'), 'civic');
});

test('TxDOT naming and stages', () => {
  assert.equal(highwayName('IH 35'), 'I-35');
  assert.equal(highwayName('SL 360'), 'Loop 360');
  assert.equal(formatCsj('001513428'), '0015-13-428');
  assert.equal(stageStatus('Construction'), 'active');
  assert.equal(stageStatus('Design and Construct'), 'active');
  assert.equal(stageStatus('PS&E'), 'planned');
});

test('mobility projects that are really trails go on the trails layer', () => {
  assert.ok(isTrail('Mokan Trail from 5th St. / Pedernales to Southern Walnut Creek Trail'));
  assert.ok(isTrail('Middle Fiskville SUP - Koenig Ln to Clayton Ln'));
  assert.ok(isTrail('Barton Springs and Stratford SUPs QuarterCent'));
  assert.ok(!isTrail('Burnet Rd from White Horse Trail to US 183'));
});

test('closure text from city work zones and DriveTexas', () => {
  assert.equal(workFromName('AE/Mastec/Primoris - W OLTORF ST 1400 BLK - Replace Wiring '), 'Replace Wiring');
  assert.equal(workFromName('CIP - MUNIZ - NORTHCROSS DRIVE 7622-7840 BLK - SIDEWALK IMPROVEMENTS'), 'Sidewalk Improvements');
  assert.equal(workFromName('WorkZone Event'), undefined);
  assert.equal(workFromName('Crew - E DEAN KEETON - LTC'), undefined);
  assert.equal(impact('all-lanes-closed'), 'closed');
  assert.equal(impact('some-lanes-closed'), 'partial');
  assert.equal(routeName('IH0035'), 'I-35');
  assert.equal(routeName('FM0969'), 'FM 969');
  assert.equal(routeName('US0183A'), 'US 183A');
  assert.equal(routeName('BI0020F'), 'BI 20F');
});
