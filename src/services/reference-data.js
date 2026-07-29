import { normaliseSpatialData, normaliseSpatialFeature } from "../core/spatial.js";

const CACHE_NAME = "hideline-official-boundaries-v4";
const REQUEST_TIMEOUT_MS = 20_000;
const CENTRAL_LONDON_ENVELOPE = Object.freeze({ west: -0.27, south: 51.40, east: 0.035, north: 51.58 });
const RESPONSE_FORMATS = Object.freeze(["geojson", "json"]);

/**
 * HideLine keeps the exact ONS FeatureServer layer, field names and London
 * code prefixes in the application. The browser therefore never needs to
 * discover a layer inside a MapServer page or depend on a human-facing site.
 */
export const OFFICIAL_BOUNDARY_SOURCES = Object.freeze([
  Object.freeze({
    id: "borough",
    category: "borough",
    label: "London boroughs",
    provider: "Office for National Statistics",
    endpoint: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_DEC_2025_Boundaries_UK_BGC/FeatureServer/0/query",
    fields: "LAD25CD,LAD25NM",
    nameField: "LAD25NM",
    codeField: "LAD25CD",
    codePrefix: "E09"
  }),
  Object.freeze({
    id: "ward",
    category: "ward",
    label: "Electoral wards",
    provider: "Office for National Statistics",
    endpoint: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/WD_DEC_2025_UK_BGC/FeatureServer/0/query",
    fields: "WD25CD,WD25NM,LAD25CD,LAD25NM",
    nameField: "WD25NM",
    codeField: "WD25CD",
    codePrefix: "E05",
    parentCodeField: "LAD25CD",
    parentCodePrefix: "E09"
  }),
  Object.freeze({
    id: "constituency",
    category: "constituency",
    label: "Parliamentary constituencies",
    provider: "Office for National Statistics",
    endpoint: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC/FeatureServer/0/query",
    fields: "PCON24CD,PCON24NM",
    nameField: "PCON24NM",
    codeField: "PCON24CD",
    codePrefix: "E14"
  })
]);

export function officialBoundarySourceUrl(source, { format = "geojson" } = {}) {
  const params = new URLSearchParams({
    // Spatial filtering keeps the response well below the service's 2,000
    // feature limit. Filtering the London codes client-side avoids fragile
    // SQL LIKE expressions, which caused HTTP 400 responses on some devices.
    where: "1=1",
    outFields: source.fields,
    returnGeometry: "true",
    geometry: `${CENTRAL_LONDON_ENVELOPE.west},${CENTRAL_LONDON_ENVELOPE.south},${CENTRAL_LONDON_ENVELOPE.east},${CENTRAL_LONDON_ENVELOPE.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outSR: "4326",
    maxAllowableOffset: "0.00005",
    geometryPrecision: "6",
    resultRecordCount: "2000",
    f: format === "json" ? "json" : "geojson"
  });
  return `${source.endpoint}?${params.toString()}`;
}

async function cacheForBoundaries() {
  return typeof caches !== "undefined" ? caches.open(CACHE_NAME) : null;
}

async function fetchBoundaryResponse(url, { force = false } = {}) {
  const cache = await cacheForBoundaries();
  const stored = cache ? await cache.match(url) : null;
  if (!force && stored) return { response: stored, cache, fromCache: true };

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: force ? "reload" : "no-store",
      signal: controller?.signal
    });
    if (!response.ok) {
      const text = await response.clone().text().catch(() => "");
      let detail = "";
      try {
        const parsed = JSON.parse(text);
        detail = parsed?.error?.message || parsed?.message || "";
      } catch { /* HTML error pages are described by the status code. */ }
      throw new Error(`Boundary service returned HTTP ${response.status}${detail ? `: ${detail}` : ""}.`);
    }
    return { response, cache, fromCache: false };
  } catch (error) {
    // A previously validated response is preferable to losing a layer when a
    // phone has weak signal. Invalid cached responses are removed below.
    if (stored) return { response: stored, cache, fromCache: true };
    if (error?.name === "AbortError") throw new Error("The official boundary service timed out. Try again when the phone has a stronger connection.");
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function ringSignedArea(ring = []) {
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    sum += Number(current?.[0]) * Number(next?.[1]) - Number(next?.[0]) * Number(current?.[1]);
  }
  return sum / 2;
}

function cleanRing(value) {
  const ring = (Array.isArray(value) ? value : [])
    .map((coordinate) => [Number(coordinate?.[0]), Number(coordinate?.[1])])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (ring.length < 3) return null;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring.length >= 4 ? ring : null;
}

function coordinateInRing(coordinate, ring = []) {
  const x = Number(coordinate?.[0]);
  const y = Number(coordinate?.[1]);
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const xi = Number(ring[index]?.[0]);
    const yi = Number(ring[index]?.[1]);
    const xj = Number(ring[previous]?.[0]);
    const yj = Number(ring[previous]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function esriRingsToGeoJson(rings = []) {
  const valid = rings.map(cleanRing).filter(Boolean);
  if (!valid.length) return null;

  // Esri exterior rings are normally clockwise and holes counter-clockwise.
  // Detect the exterior orientation from the largest ring as an additional
  // safeguard for services that have normalised winding direction.
  const largest = [...valid].sort((a, b) => Math.abs(ringSignedArea(b)) - Math.abs(ringSignedArea(a)))[0];
  const exteriorSign = Math.sign(ringSignedArea(largest)) || -1;
  const outers = valid.filter((ring) => (Math.sign(ringSignedArea(ring)) || exteriorSign) === exteriorSign);
  const holes = valid.filter((ring) => (Math.sign(ringSignedArea(ring)) || exteriorSign) !== exteriorSign);
  const polygons = (outers.length ? outers : [largest]).map((outer) => [outer]);

  for (const hole of holes) {
    const sample = hole[0];
    const containers = polygons
      .map((polygon, index) => ({ index, area: Math.abs(ringSignedArea(polygon[0])), contains: coordinateInRing(sample, polygon[0]) }))
      .filter((candidate) => candidate.contains)
      .sort((a, b) => a.area - b.area);
    if (containers.length) polygons[containers[0].index].push(hole);
    else polygons.push([hole]);
  }

  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

function arcGisJsonToGeoJson(body) {
  const features = (Array.isArray(body?.features) ? body.features : []).map((feature, index) => {
    const geometry = feature?.geometry?.rings
      ? esriRingsToGeoJson(feature.geometry.rings)
      : feature?.geometry?.x != null && feature?.geometry?.y != null
        ? { type: "Point", coordinates: [Number(feature.geometry.x), Number(feature.geometry.y)] }
        : null;
    if (!geometry) return null;
    return {
      type: "Feature",
      id: feature.attributes?.FID ?? index,
      properties: feature.attributes || {},
      geometry
    };
  }).filter(Boolean);
  return { type: "FeatureCollection", features };
}

export async function parseBoundaryGeoJsonResponse(response, label = "Boundary layer") {
  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`${label} returned an empty response.`);
  if (trimmed.startsWith("<") || contentType.includes("text/html")) {
    throw new Error(`${label} returned a web page instead of boundary data. HideLine will retry the fixed FeatureServer endpoint.`);
  }

  let body;
  try {
    body = JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} returned invalid JSON rather than a usable boundary layer.`);
  }
  if (body?.error) {
    const details = Array.isArray(body.error.details) ? body.error.details.filter(Boolean).join(" ") : "";
    throw new Error([body.error.message, details].filter(Boolean).join(" — ") || `${label} could not be loaded.`);
  }
  if (body?.type === "FeatureCollection" && Array.isArray(body.features)) return body;
  if (Array.isArray(body?.features)) {
    const converted = arcGisJsonToGeoJson(body);
    if (converted.features.length) return converted;
  }
  throw new Error(`${label} did not return a GeoJSON or ArcGIS feature collection.`);
}

function sourceFeatureAllowed(source, properties = {}) {
  const code = String(properties[source.codeField] || "");
  if (source.codePrefix && !code.startsWith(source.codePrefix)) return false;
  if (source.parentCodeField && source.parentCodePrefix) {
    const parent = String(properties[source.parentCodeField] || "");
    if (!parent.startsWith(source.parentCodePrefix)) return false;
  }
  return true;
}

function normaliseOfficialFeatures(source, value) {
  const raw = Array.isArray(value?.features) ? value.features : [];
  return raw
    .filter((feature) => sourceFeatureAllowed(source, feature?.properties || {}))
    .map((feature, index) => {
      const properties = feature.properties || {};
      const name = String(properties[source.nameField] || properties.name || `${source.label} ${index + 1}`);
      const code = String(properties[source.codeField] || feature.id || index);
      return normaliseSpatialFeature({
        id: `official:${source.id}:${code}`,
        geometry: feature.geometry,
        properties: {
          ...properties,
          id: code,
          name,
          category: source.category,
          layer: source.label,
          source: `${source.provider} — ${source.label}`,
          description: `${source.label} official reference boundary`
        }
      }, index);
    })
    .filter(Boolean);
}

async function loadSourceFormat(source, format, options) {
  const url = officialBoundarySourceUrl(source, { format });
  let result = await fetchBoundaryResponse(url, options);
  let body;
  try {
    body = await parseBoundaryGeoJsonResponse(result.response.clone(), source.label);
  } catch (error) {
    // Remove any HTML/invalid response left by an older release, then make one
    // clean request before trying the alternate ArcGIS response format.
    if (result.fromCache && result.cache) {
      await result.cache.delete(url);
      result = await fetchBoundaryResponse(url, { force: true });
      body = await parseBoundaryGeoJsonResponse(result.response.clone(), source.label);
    } else throw error;
  }
  const features = normaliseOfficialFeatures(source, body);
  if (!features.length) throw new Error(`${source.label} service returned no Central London features.`);
  if (result.cache && !result.fromCache) await result.cache.put(url, result.response.clone());
  return { source, url, format, features };
}

async function loadSource(source, options) {
  const failures = [];
  for (const format of RESPONSE_FORMATS) {
    try {
      return await loadSourceFormat(source, format, options);
    } catch (error) {
      failures.push(`${format}: ${error?.message || "unavailable"}`);
    }
  }
  throw new Error(`${source.label} could not be loaded. ${failures.join(" ")}`);
}

/**
 * Load the three administrative layers required by the handbook. Source URLs,
 * field schemas and London code filters are built into HideLine. A successful
 * response is cached locally; GeoJSON automatically falls back to ArcGIS JSON.
 */
export async function loadOfficialBoundaryData({ force = false } = {}) {
  const settled = await Promise.allSettled(OFFICIAL_BOUNDARY_SOURCES.map((source) => loadSource(source, { force })));
  const features = [];
  const sources = [];
  const errors = [];
  settled.forEach((result, index) => {
    const source = OFFICIAL_BOUNDARY_SOURCES[index];
    if (result.status === "fulfilled") {
      features.push(...result.value.features);
      sources.push({ id: source.id, label: source.label, provider: source.provider, count: result.value.features.length, status: "ready", format: result.value.format });
    } else {
      errors.push(`${source.label}: ${result.reason?.message || "unavailable"}`);
      sources.push({ id: source.id, label: source.label, provider: source.provider, count: 0, status: "error" });
    }
  });
  if (!features.length) throw new Error(errors.join(" ") || "Official boundary data could not be loaded.");
  return {
    ...normaliseSpatialData({
      sourceName: "Built-in official ONS administrative boundaries",
      importedAt: new Date().toISOString(),
      features
    }),
    sources,
    errors
  };
}

export async function clearOfficialBoundaryCache() {
  if (typeof caches !== "undefined") await caches.delete(CACHE_NAME);
}
