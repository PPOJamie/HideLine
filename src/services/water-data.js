import { normaliseSpatialData, normaliseSpatialFeature } from "../core/spatial.js";

const WATER_BBOX = Object.freeze({ south: 51.444, west: -0.245, north: 51.548, east: -0.018 });
const OVERPASS_ENDPOINTS = Object.freeze([
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
]);
const BUNDLED_WATER_URL = new URL("../../data/osm-water.json", import.meta.url);
const DEFAULT_WIDTHS = Object.freeze({ river: 45, canal: 10, stream: 4, drain: 3, ditch: 2 });
const METRES_PER_DEGREE_LAT = 111_320;

function waterName(tags = {}) {
  return String(tags.name || tags["name:en"] || tags.official_name || "").trim();
}

function normaliseWaterName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function validCoordinate(value) {
  return Number.isFinite(Number(value?.lat)) && Number.isFinite(Number(value?.lon ?? value?.lng));
}

function lineFromGeometry(geometry = []) {
  return geometry
    .filter(validCoordinate)
    .map((value) => [Number(value.lon ?? value.lng), Number(value.lat)]);
}

function sameCoordinate(a, b) {
  return Boolean(a && b && Math.abs(Number(a[0]) - Number(b[0])) < 1e-8 && Math.abs(Number(a[1]) - Number(b[1])) < 1e-8);
}

function isClosedLine(line = []) {
  return line.length >= 4 && sameCoordinate(line[0], line.at(-1));
}

function parseWidth(value) {
  const match = String(value || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  const width = match ? Number(match[0]) : NaN;
  return Number.isFinite(width) && width > 0 && width < 1000 ? width : null;
}

function metresPerDegreeLng(lat) {
  return METRES_PER_DEGREE_LAT * Math.cos((Number(lat) * Math.PI) / 180);
}

function offsetCoordinate(coordinate, eastMetres, northMetres) {
  const [lng, lat] = coordinate;
  return [
    Number(lng) + eastMetres / (metresPerDegreeLng(lat) || Number.EPSILON),
    Number(lat) + northMetres / METRES_PER_DEGREE_LAT
  ];
}

function tangent(line, index) {
  const previous = line[Math.max(0, index - 1)];
  const next = line[Math.min(line.length - 1, index + 1)];
  const meanLat = (Number(previous[1]) + Number(next[1])) / 2;
  const east = (Number(next[0]) - Number(previous[0])) * metresPerDegreeLng(meanLat);
  const north = (Number(next[1]) - Number(previous[1])) * METRES_PER_DEGREE_LAT;
  const length = Math.hypot(east, north) || 1;
  return { east: east / length, north: north / length };
}

function bankLines(line, fullWidthMetres) {
  const halfWidth = Math.max(0.5, Number(fullWidthMetres) / 2);
  const left = [];
  const right = [];
  line.forEach((coordinate, index) => {
    const direction = tangent(line, index);
    const normalEast = -direction.north;
    const normalNorth = direction.east;
    left.push(offsetCoordinate(coordinate, normalEast * halfWidth, normalNorth * halfWidth));
    right.push(offsetCoordinate(coordinate, -normalEast * halfWidth, -normalNorth * halfWidth));
  });
  return [left, right];
}

function lineWidth(tags = {}) {
  const tagged = parseWidth(tags.width || tags["width:water"] || tags.est_width);
  if (tagged) return { width: tagged, estimated: false };
  const waterway = String(tags.waterway || "").toLowerCase();
  return { width: DEFAULT_WIDTHS[waterway] || 8, estimated: true };
}

function areaLike(tags = {}, line = []) {
  const waterway = String(tags.waterway || "").toLowerCase();
  return isClosedLine(line) && (
    tags.natural === "water"
    || tags.landuse === "reservoir"
    || Boolean(tags.water)
    || ["riverbank", "dock", "basin"].includes(waterway)
    || tags.area === "yes"
  );
}

function excludedWater(tags = {}) {
  const text = `${tags.leisure || ""} ${tags.amenity || ""} ${tags.water || ""} ${tags.name || ""}`.toLowerCase();
  return /swimming_pool|swimming pool|paddling_pool|paddling pool|fountain|splash/.test(text);
}

function derivedBanks(line, tags = {}) {
  const width = lineWidth(tags);
  return bankLines(line, width.width).map((bank) => ({
    line: bank,
    exact: false,
    derived: true,
    estimatedWidth: width.estimated,
    widthMetres: width.width
  }));
}

function elementLines(element) {
  const tags = element?.tags || {};
  if (!waterName(tags) || excludedWater(tags)) return [];
  const lines = [];
  if (element.type === "way") {
    const line = lineFromGeometry(element.geometry);
    if (line.length < 2) return [];
    if (areaLike(tags, line) || ["riverbank", "dock", "basin"].includes(String(tags.waterway || "").toLowerCase())) {
      lines.push({ line, exact: true, derived: false });
    } else {
      lines.push(...derivedBanks(line, tags));
    }
    return lines;
  }
  if (element.type === "relation") {
    const relationArea = tags.type === "multipolygon"
      || tags.natural === "water"
      || tags.landuse === "reservoir"
      || Boolean(tags.water)
      || ["riverbank", "dock", "basin"].includes(String(tags.waterway || "").toLowerCase());
    for (const member of element.members || []) {
      const line = lineFromGeometry(member.geometry);
      if (line.length < 2) continue;
      const role = String(member.role || "").toLowerCase();
      if (relationArea || ["outer", "inner"].includes(role)) lines.push({ line, exact: true, derived: false });
      else lines.push(...derivedBanks(line, tags));
    }
  }
  return lines;
}

/**
 * Convert Overpass JSON into one edge feature per named body of water.
 *
 * When OSM supplies a mapped water polygon or riverbank, only that real edge is
 * used. A width-derived bank is retained solely as a fallback for named linear
 * waterways that have no mapped area geometry; it never competes with a real
 * shoreline for the same named water body.
 */
export function parseOverpassWaterData(body, sourceName = "OpenStreetMap named water edges") {
  const groups = new Map();
  for (const element of Array.isArray(body?.elements) ? body.elements : []) {
    const name = waterName(element.tags);
    const key = normaliseWaterName(name);
    if (!key) continue;
    const lines = elementLines(element);
    if (!lines.length) continue;
    const group = groups.get(key) || {
      name,
      exactLines: [],
      derivedLines: [],
      exactElementIds: [],
      derivedElementIds: []
    };
    for (const item of lines) {
      if (item.exact) group.exactLines.push(item.line);
      else group.derivedLines.push(item.line);
    }
    if (lines.some((item) => item.exact)) group.exactElementIds.push(`${element.type}/${element.id}`);
    if (lines.some((item) => !item.exact)) group.derivedElementIds.push(`${element.type}/${element.id}`);
    groups.set(key, group);
  }

  const features = [...groups.values()].map((group, index) => {
    const exact = group.exactLines.length > 0;
    const lines = exact ? group.exactLines : group.derivedLines;
    if (!lines.length) return null;
    const elementIds = exact ? group.exactElementIds : group.derivedElementIds;
    return normaliseSpatialFeature({
      id: `osm-water:${normaliseWaterName(group.name).replace(/\s+/g, "-")}:${index}`,
      name: group.name,
      category: "water",
      layer: exact ? "OpenStreetMap mapped water edges" : "OpenStreetMap width-derived water edges",
      source: sourceName,
      geometry: lines.length === 1
        ? { type: "LineString", coordinates: lines[0] }
        : { type: "MultiLineString", coordinates: lines },
      properties: {
        name: group.name,
        category: "water",
        layer: exact ? "OpenStreetMap mapped water edges" : "OpenStreetMap width-derived water edges",
        source: sourceName,
        description: exact
          ? `${lines.length} mapped shoreline or bank section(s).`
          : `${lines.length} bank section(s) derived from a named waterway centreline because no mapped water polygon was available.`,
        quality: exact ? "mapped-edge" : "width-derived-fallback",
        osmElements: elementIds.slice(0, 150).join(",")
      }
    }, index);
  }).filter(Boolean);

  if (!features.length) throw new Error("The water-data response contained no usable named water edges.");
  const exactFeatureCount = features.filter((feature) => feature.properties?.quality === "mapped-edge").length;
  return {
    ...normaliseSpatialData({
      sourceName,
      importedAt: body?.osm3s?.timestamp_osm_base || new Date().toISOString(),
      features
    }),
    status: "ready",
    sourceUrl: body?.generator ? `OpenStreetMap via ${body.generator}` : "OpenStreetMap Overpass API",
    rawElementCount: Array.isArray(body?.elements) ? body.elements.length : 0,
    exactFeatureCount,
    fallbackFeatureCount: Math.max(0, features.length - exactFeatureCount)
  };
}

function overpassQuery() {
  const { south, west, north, east } = WATER_BBOX;
  const bbox = `${south},${west},${north},${east}`;
  return `[out:json][timeout:180][maxsize:1073741824];\n(\n  way["natural"="water"]["name"](${bbox});\n  relation["natural"="water"]["name"](${bbox});\n  way["landuse"="reservoir"]["name"](${bbox});\n  relation["landuse"="reservoir"]["name"](${bbox});\n  way["water"]["name"](${bbox});\n  relation["water"]["name"](${bbox});\n  way["waterway"~"^(riverbank|river|canal|stream|dock|basin|tidal_channel|drain|ditch)$"]["name"](${bbox});\n  relation["waterway"~"^(riverbank|river|canal|stream|dock|basin|tidal_channel|drain|ditch)$"]["name"](${bbox});\n);\nout tags geom;`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadBundled({ force = false } = {}) {
  const response = await fetch(BUNDLED_WATER_URL, { cache: force ? "reload" : "no-cache", credentials: "same-origin" });
  if (!response.ok) throw new Error(`Bundled water data returned HTTP ${response.status}.`);
  const body = await response.json();
  return { ...parseOverpassWaterData(body, "Bundled OpenStreetMap water-edge snapshot"), delivery: "bundled" };
}

async function loadLive() {
  const query = overpassQuery();
  const failures = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
        body: new URLSearchParams({ data: query }).toString()
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      return { ...parseOverpassWaterData(body, "Live OpenStreetMap water edges"), delivery: "live", endpoint };
    } catch (error) {
      failures.push(`${endpoint}: ${error?.message || "unavailable"}`);
    }
  }
  throw new Error(`Named water geometry could not be loaded. ${failures.join(" ")}`);
}

export async function loadAuthoritativeWaterData({ force = false } = {}) {
  try {
    return await loadBundled({ force });
  } catch (bundledError) {
    try {
      return await loadLive();
    } catch (liveError) {
      throw new Error(`${bundledError.message} ${liveError.message}`);
    }
  }
}

export const WATER_DATA_BBOX = WATER_BBOX;
export const WATER_OVERPASS_QUERY = overpassQuery;
