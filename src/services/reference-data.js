import { normaliseSpatialData, normaliseSpatialFeature } from "../core/spatial.js";

const CACHE_NAME = "hideline-official-boundaries-v2";
const REQUEST_TIMEOUT_MS = 15_000;
const CENTRAL_LONDON_ENVELOPE = Object.freeze({ west: -0.27, south: 51.40, east: 0.035, north: 51.58 });

export const OFFICIAL_BOUNDARY_SOURCES = Object.freeze([
  Object.freeze({
    id: "borough",
    category: "borough",
    label: "London boroughs",
    provider: "Greater London Authority",
    endpoint: "https://gis.london.gov.uk/server/rest/services/apps/planning_data_map_02/MapServer/301/query",
    fields: "name,gss_code",
    nameField: "name",
    codeField: "gss_code",
    where: "1=1"
  }),
  Object.freeze({
    id: "ward",
    category: "ward",
    label: "Electoral wards",
    provider: "Office for National Statistics",
    endpoint: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/ArcGIS/rest/services/Wards_%28December_2025%29_Boundaries_UK_BGC/MapServer/0/query",
    fields: "WD25CD,WD25NM,LAD25CD,LAD25NM",
    nameField: "WD25NM",
    codeField: "WD25CD",
    where: "LAD25CD LIKE 'E09%'"
  }),
  Object.freeze({
    id: "constituency",
    category: "constituency",
    label: "Parliamentary constituencies",
    provider: "Office for National Statistics",
    endpoint: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/ArcGIS/rest/services/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC/FeatureServer/0/query",
    fields: "PCON24CD,PCON24NM",
    nameField: "PCON24NM",
    codeField: "PCON24CD",
    where: "PCON24CD LIKE 'E14%'"
  })
]);

function sourceUrl(source) {
  const params = new URLSearchParams({
    where: source.where,
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
    f: "geojson"
  });
  return `${source.endpoint}?${params.toString()}`;
}

async function cachedResponse(url, { force = false } = {}) {
  const cache = typeof caches !== "undefined" ? await caches.open(CACHE_NAME) : null;
  const stored = cache ? await cache.match(url) : null;
  if (!force && stored) return stored;

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: force ? "reload" : "default",
      signal: controller?.signal
    });
    if (!response.ok) throw new Error(`Boundary service returned HTTP ${response.status}.`);
    if (cache) await cache.put(url, response.clone());
    return response;
  } catch (error) {
    // Once an official layer has been loaded successfully, keep using that
    // cached geometry on game day even when signal is weak or the source API is
    // temporarily unavailable.
    if (stored) return stored;
    if (error?.name === "AbortError") throw new Error("The official boundary service timed out. Try again when the phone has a stronger connection.");
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normaliseOfficialFeatures(source, value) {
  const raw = Array.isArray(value?.features) ? value.features : [];
  return raw.map((feature, index) => {
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
  }).filter(Boolean);
}

async function loadSource(source, options) {
  const url = sourceUrl(source);
  const response = await cachedResponse(url, options);
  const body = await response.json();
  if (body?.error) throw new Error(body.error.message || `${source.label} could not be loaded.`);
  const features = normaliseOfficialFeatures(source, body);
  if (!features.length) throw new Error(`${source.label} service returned no Central London features.`);
  return { source, url, features };
}

/**
 * Load the three administrative layers required by the handbook. The source
 * URLs are built into HideLine; users no longer need to find the layers in a
 * My Maps export. Responses are cached by the browser for offline reuse.
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
      sources.push({ id: source.id, label: source.label, provider: source.provider, count: result.value.features.length, status: "ready" });
    } else {
      errors.push(`${source.label}: ${result.reason?.message || "unavailable"}`);
      sources.push({ id: source.id, label: source.label, provider: source.provider, count: 0, status: "error" });
    }
  });
  if (!features.length) throw new Error(errors.join(" ") || "Official boundary data could not be loaded.");
  return {
    ...normaliseSpatialData({
      sourceName: "Built-in official administrative boundaries",
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
