import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { fetchJson } from './http.ts';

export const COA = 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services';
export const TXDOT = 'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services';

interface ArcgisError { error?: { code: number; message: string } }

/**
 * Pages through an ArcGIS FeatureServer layer as GeoJSON. Queries go by POST
 * so long IN (...) lists fit. Dates in `where` must be written as
 * `timestamp 'YYYY-MM-DD HH:MM:SS'`: `DATE '...'` silently matches nothing.
 */
export async function queryLayer<P = Record<string, unknown>>(
  layerUrl: string,
  params: {
    where: string;
    outFields: string[] | '*';
    pageSize?: number;
    precision?: number;
    returnGeometry?: boolean;
  },
): Promise<Feature<Geometry | null, P>[]> {
  const pageSize = params.pageSize ?? 1000;
  const out: Feature<Geometry | null, P>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const body = new URLSearchParams({
      where: params.where,
      outFields: params.outFields === '*' ? '*' : params.outFields.join(','),
      outSR: '4326',
      geometryPrecision: String(params.precision ?? 6),
      returnGeometry: String(params.returnGeometry ?? true),
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      orderByFields: 'OBJECTID',
      f: 'geojson',
    });
    const page = await fetchJson<FeatureCollection<Geometry | null, P> & ArcgisError & { properties?: { exceededTransferLimit?: boolean } }>(
      `${layerUrl}/query`,
      { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    if (page.error) throw new Error(`ArcGIS ${page.error.code}: ${page.error.message}`);
    out.push(...page.features);
    const more = page.properties?.exceededTransferLimit ?? page.features.length === pageSize;
    if (!more || page.features.length === 0) break;
  }
  return out;
}

export function sqlList(values: string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
}

export function sqlTimestamp(d: Date): string {
  return `timestamp '${d.toISOString().slice(0, 10)} 00:00:00'`;
}
