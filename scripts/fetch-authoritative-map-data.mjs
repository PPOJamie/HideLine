import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { STATIONS } from "../src/data/stations.js";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DATA_DIR = path.join(ROOT, "data");
const MAP_ID = process.env.HIDELINE_MAP_ID || "1lDtKjR7rN1zelD3FjepU1XNvHmnb774";
const STRICT = process.argv.includes("--strict");
const FALLBACK_BBOX = { south: 51.444, west: -0.245, north: 51.548, east: -0.018 };
const KML_URLS = [
  `https://www.google.com/maps/d/kml?mid=${encodeURIComponent(MAP_ID)}&forcekml=1`,
  `https://www.google.com/maps/d/u/0/kml?mid=${encodeURIComponent(MAP_ID)}&forcekml=1`
];
const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
];

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/gi, "&")
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stationNameKey(value) {
  return decodeXml(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/\bst\s*\.?\s*/g, "saint ")
    .replace(/\bstation\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function validateStationPlacemarks(kml) {
  const pointNames = [];
  for (const match of String(kml).matchAll(/<Placemark\b[\s\S]*?<\/Placemark>/gi)) {
    const block = match[0];
    if (!/<Point\b/i.test(block)) continue;
    const name = block.match(/<name\b[^>]*>([\s\S]*?)<\/name>/i)?.[1] || "";
    const key = stationNameKey(name.replace(/<[^>]+>/g, ""));
    if (key) pointNames.push(key);
  }
  const available = new Map();
  for (const key of pointNames) available.set(key, (available.get(key) || 0) + 1);
  const unmatched = [];
  let matchedCount = 0;
  for (const station of STATIONS) {
    const key = stationNameKey(station.name);
    const remaining = available.get(key) || 0;
    if (remaining > 0) {
      available.set(key, remaining - 1);
      matchedCount += 1;
    } else {
      unmatched.push(`${station.id}:${station.name}`);
    }
  }
  return { matchedCount, unmatched, pointPlacemarkCount: pointNames.length };
}

function waterQuery(bboxValue = FALLBACK_BBOX) {
  const { south, west, north, east } = bboxValue;
  const bbox = `${south},${west},${north},${east}`;
  return `[out:json][timeout:180][maxsize:1073741824];\n(\n  way["natural"="water"]["name"](${bbox});\n  relation["natural"="water"]["name"](${bbox});\n  way["landuse"="reservoir"]["name"](${bbox});\n  relation["landuse"="reservoir"]["name"](${bbox});\n  way["water"]["name"](${bbox});\n  relation["water"]["name"](${bbox});\n  way["waterway"~"^(riverbank|river|canal|stream|dock|basin|tidal_channel|drain|ditch)$"]["name"](${bbox});\n  relation["waterway"~"^(riverbank|river|canal|stream|dock|basin|tidal_channel|drain|ditch)$"]["name"](${bbox});\n);\nout tags geom;`;
}

function coordinatePairs(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((token) => token.split(",").slice(0, 2).map(Number))
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

function gameBoundaryBbox(kml, bufferDegrees = 0.012) {
  const points = [];
  for (const match of String(kml).matchAll(/<Placemark\b[\s\S]*?<\/Placemark>/gi)) {
    const block = match[0];
    const name = decodeXml(block.match(/<name\b[^>]*>([\s\S]*?)<\/name>/i)?.[1] || "").replace(/<[^>]+>/g, "");
    if (!/game\s*(area\s*)?(map\s*)?boundar/i.test(name) || !/<Polygon\b/i.test(block)) continue;
    for (const coordinatesMatch of block.matchAll(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/gi)) {
      points.push(...coordinatePairs(coordinatesMatch[1]));
    }
  }
  if (!points.length) return null;
  const west = Math.min(...points.map(([lng]) => lng));
  const east = Math.max(...points.map(([lng]) => lng));
  const south = Math.min(...points.map(([, lat]) => lat));
  const north = Math.max(...points.map(([, lat]) => lat));
  if (![west, east, south, north].every(Number.isFinite)) return null;
  return {
    south: Math.max(-90, south - bufferDegrees),
    west: Math.max(-180, west - bufferDegrees),
    north: Math.min(90, north + bufferDegrees),
    east: Math.min(180, east + bufferDegrees)
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 150_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "HideLine-map-data-builder/2.3.4 (+https://github.com/PPOJamie/HideLine)",
        Accept: "*/*",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function downloadKml() {
  const failures = [];
  for (const url of KML_URLS) {
    try {
      const response = await fetchWithTimeout(url, { redirect: "follow", cache: "no-store" }, 90_000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!/<kml[\s>]/i.test(text) || !/<Placemark[\s>]/i.test(text)) throw new Error("response was not a usable KML document");
      const pointCount = (text.match(/<Point[\s>]/gi) || []).length;
      const polygonCount = (text.match(/<Polygon[\s>]/gi) || []).length;
      if (!/Hiding\s*Stations?/i.test(text) || pointCount < 90) throw new Error(`official station layer was missing or incomplete (${pointCount} point placemarks)`);
      if (!/Game\s*(Area\s*)?(Map\s*)?Boundary/i.test(text) || polygonCount < 1) throw new Error("official game-boundary polygon was missing");
      const stationValidation = validateStationPlacemarks(text);
      if (stationValidation.matchedCount !== STATIONS.length) {
        throw new Error(`official Hiding Stations pins did not match the complete handbook list (${stationValidation.matchedCount}/${STATIONS.length}); missing ${stationValidation.unmatched.slice(0, 12).join(", ")}`);
      }
      const boundaryBbox = gameBoundaryBbox(text);
      if (!boundaryBbox) throw new Error("official game-boundary coordinates could not be read");
      return { text, url, pointCount, polygonCount, stationValidation, boundaryBbox };
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(failures.join(" | "));
}

async function downloadWater(bboxValue) {
  const query = waterQuery(bboxValue);
  const failures = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json"
        },
        body: new URLSearchParams({ data: query }).toString()
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body?.elements) || !body.elements.length) throw new Error("response contained no water elements");
      return { body, endpoint };
    } catch (error) {
      failures.push(`${endpoint}: ${error.message}`);
    }
  }
  throw new Error(failures.join(" | "));
}

async function keepExisting(filename, label, error) {
  const filepath = path.join(DATA_DIR, filename);
  if (!existsSync(filepath)) return false;
  const existing = await readFile(filepath);
  if (!existing.length) return false;
  console.warn(`::warning::${label} refresh failed; retaining the checked-in snapshot. ${error.message}`);
  return true;
}

await mkdir(DATA_DIR, { recursive: true });
const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  mapId: MAP_ID,
  bbox: FALLBACK_BBOX,
  gameMap: { status: "error" },
  water: { status: "error" }
};
let failed = false;
let waterBbox = FALLBACK_BBOX;

try {
  const result = await downloadKml();
  await writeFile(path.join(DATA_DIR, "official-game-map.kml"), result.text, "utf8");
  manifest.gameMap = {
    status: "ready",
    source: result.url,
    bytes: Buffer.byteLength(result.text),
    placemarkCount: (result.text.match(/<Placemark[\s>]/gi) || []).length,
    pointCount: result.pointCount,
    polygonCount: result.polygonCount,
    officialStationMatchCount: result.stationValidation.matchedCount,
    waterQueryBbox: result.boundaryBbox
  };
  waterBbox = result.boundaryBbox;
  manifest.bbox = waterBbox;
  console.log(`Downloaded official game map: ${manifest.gameMap.placemarkCount} placemarks, ${result.pointCount} points, ${result.polygonCount} polygons.`);
} catch (error) {
  const retained = await keepExisting("official-game-map.kml", "Official game map", error);
  manifest.gameMap = { status: retained ? "retained" : "error", error: error.message };
  failed ||= !retained;
}

try {
  const result = await downloadWater(waterBbox);
  const json = JSON.stringify(result.body);
  await writeFile(path.join(DATA_DIR, "osm-water.json"), json, "utf8");
  manifest.water = {
    status: "ready",
    source: result.endpoint,
    bytes: Buffer.byteLength(json),
    elementCount: result.body.elements.length,
    osmTimestamp: result.body.osm3s?.timestamp_osm_base || null
  };
  console.log(`Downloaded OpenStreetMap water geometry: ${manifest.water.elementCount} elements.`);
} catch (error) {
  const retained = await keepExisting("osm-water.json", "OpenStreetMap water data", error);
  manifest.water = { status: retained ? "retained" : "error", error: error.message };
  failed ||= !retained;
}

await writeFile(path.join(DATA_DIR, "map-data-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
if (STRICT && failed) {
  console.error("Authoritative map data could not be generated and no previous snapshot was available.");
  process.exit(1);
}
