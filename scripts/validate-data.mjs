import { STATIONS, stationNameLength } from "../src/data/stations.js";
import { QUESTIONS, QUESTION_CATEGORIES } from "../src/data/questions.js";
import { QUESTION_DEDUCTION } from "../src/data/question-deduction.js";
import { APP_VERSION } from "../src/core/constants.js";
import { APPROXIMATE_GAME_BOUNDARY } from "../src/data/boundary.js";
import { RAIL_LINES, STATION_GEO } from "../src/data/station-geo.js";
import { THAMES_CENTRELINE } from "../src/data/thames-centreline.js";
import { parseOverpassWaterData } from "../src/services/water-data.js";
import { resolveAuthoritativeStations } from "../src/core/station-authority.js";
import { usableWaterFeatures } from "../src/core/spatial.js";
import { haversineMetres } from "../src/core/geo.js";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(STATIONS.length === 100, `Expected 100 hiding-station entries, found ${STATIONS.length}.`);
assert(new Set(STATIONS.map((station) => station.id)).size === STATIONS.length, "Station IDs must be unique.");
assert(STATIONS.every((station) => station.name && stationNameLength(station.name) > 0), "Every station needs a name.");
assert(STATION_GEO.length === STATIONS.length, `Expected fallback coordinates for ${STATIONS.length} stations, found ${STATION_GEO.length}.`);
assert(new Set(STATION_GEO.map((station) => station.id)).size === STATION_GEO.length, "Fallback station-coordinate IDs must be unique.");
assert(STATION_GEO.every((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng)), "Every fallback station needs numeric coordinates.");
assert(STATION_GEO.every((station) => station.lat > 51.43 && station.lat < 51.56 && station.lng > -0.24 && station.lng < 0.02), "Fallback station coordinates must stay within the Central London planning extent.");
assert(STATION_GEO.every((station) => STATIONS.some((candidate) => candidate.id === station.id)), "Every fallback coordinate must reference a handbook station.");
const lineIds = new Set(RAIL_LINES.map((line) => line.id));
assert(STATION_GEO.every((station) => station.lines.every((lineId) => lineIds.has(lineId))), "Every station line membership must reference a known line preset.");

assert(QUESTIONS.length >= 45, `Expected a comprehensive question catalogue, found ${QUESTIONS.length}.`);
assert(new Set(QUESTIONS.map((question) => question.id)).size === QUESTIONS.length, "Question IDs must be unique.");
assert(QUESTIONS.every((question) => QUESTION_CATEGORIES[question.category]), "Every question must reference a known category.");
assert(QUESTIONS.every((question) => question.responseSeconds === 300 || question.responseSeconds === 600), "Question response time must be five or ten minutes.");
assert(Object.keys(QUESTION_DEDUCTION).length === QUESTIONS.length, "Every handbook question must have exactly one deduction-map capability entry.");
assert(QUESTIONS.every((question) => QUESTION_DEDUCTION[question.id]), "Every handbook question must be linked to the deduction-map audit trail.");
assert(Object.keys(QUESTION_DEDUCTION).every((id) => QUESTIONS.some((question) => question.id === id)), "The deduction capability map must not contain unknown question IDs.");

assert(APPROXIMATE_GAME_BOUNDARY.length >= 4, "The emergency planning boundary needs at least four coordinates.");
assert(JSON.stringify(APPROXIMATE_GAME_BOUNDARY[0]) === JSON.stringify(APPROXIMATE_GAME_BOUNDARY.at(-1)), "The emergency planning polygon must be closed.");
assert(THAMES_CENTRELINE.length > 500, `Expected a high-resolution Thames side-of-river guide, found ${THAMES_CENTRELINE.length} points.`);
assert(THAMES_CENTRELINE.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Number.isFinite(point.halfWidthMetres)), "Every Thames guide point needs latitude, longitude and a half-width.");
assert(THAMES_CENTRELINE[0].lng < THAMES_CENTRELINE.at(-1).lng, "The Thames guide must run broadly west to east.");
assert(THAMES_CENTRELINE.every((point, index, points) => index === 0 || haversineMetres(points[index - 1], point) <= 40), "Adjacent Thames guide points must remain within 40 metres.");

const waterFixture = {
  osm3s: { timestamp_osm_base: "2026-01-01T00:00:00Z" },
  elements: [
    {
      type: "relation",
      id: 1,
      tags: { type: "multipolygon", natural: "water", name: "Example Water" },
      members: [{
        type: "way",
        ref: 11,
        role: "outer",
        geometry: [
          { lat: 51.5000, lon: -0.1000 }, { lat: 51.5000, lon: -0.0990 },
          { lat: 51.5010, lon: -0.0990 }, { lat: 51.5010, lon: -0.1000 },
          { lat: 51.5000, lon: -0.1000 }
        ]
      }]
    },
    {
      type: "way",
      id: 2,
      tags: { waterway: "river", name: "Example Water", width: "80" },
      geometry: [{ lat: 51.5005, lon: -0.1010 }, { lat: 51.5005, lon: -0.0980 }]
    },
    {
      type: "way",
      id: 3,
      tags: { natural: "water", leisure: "swimming_pool", name: "Excluded Pool" },
      geometry: [
        { lat: 51.49, lon: -0.11 }, { lat: 51.49, lon: -0.109 },
        { lat: 51.491, lon: -0.109 }, { lat: 51.49, lon: -0.11 }
      ]
    }
  ]
};
const parsedWater = parseOverpassWaterData(waterFixture, "Validation fixture");
const waterFeatures = usableWaterFeatures(parsedWater.features);
assert(waterFeatures.length === 1, "Water parser should group a named water body and exclude swimming pools/fountains.");
assert(waterFeatures[0]?.name === "Example Water", "Water parser must preserve the mapped water name.");
assert(waterFeatures[0]?.properties?.quality === "mapped-edge", "Mapped polygon banks must take precedence over a width-derived centreline for the same named water body.");
assert(parsedWater.exactFeatureCount === 1 && parsedWater.fallbackFeatureCount === 0, "Water parser diagnostics must distinguish exact mapped edges from width-derived fallback banks.");

const station = STATIONS[0];
const fallback = STATION_GEO.find((candidate) => candidate.id === station.id);
const officialFeature = {
  id: "official:test",
  name: station.name,
  category: "station",
  layer: "Hiding Stations",
  geometry: { type: "Point", coordinates: [fallback.lng + 0.0005, fallback.lat + 0.0005] },
  properties: { description: "Hiding Stations", source: "Official map fixture" }
};
const authority = resolveAuthoritativeStations([station], [officialFeature]);
assert(authority.diagnostics.matchedCount === 1, "Official station pin matching must resolve handbook stations.");
assert(authority.stations[0]?.coordinateSource === "official-map", "An official game-map pin must replace the embedded fallback as the 500 m circle centre.");
assert(haversineMetres(authority.stations[0], fallback) > 0, "Official station matching must retain a measurable correction from the fallback coordinate.");

const thamesAnchors = [
  { name: "Hammersmith Bridge", lat: 51.48630, lng: -0.22483 },
  { name: "Putney Bridge", lat: 51.46665, lng: -0.21339 },
  { name: "Fulham Railway Bridge", lat: 51.45950, lng: -0.20583 },
  { name: "Wandsworth Bridge", lat: 51.46500, lng: -0.18806 },
  { name: "Battersea Railway Bridge", lat: 51.47306, lng: -0.17917 },
  { name: "Battersea Bridge", lat: 51.48111, lng: -0.17250 },
  { name: "Albert Bridge", lat: 51.48230, lng: -0.16670 },
  { name: "Chelsea Bridge", lat: 51.48472, lng: -0.15000 },
  { name: "Westminster Bridge", lat: 51.50086, lng: -0.12179 },
  { name: "Tower Bridge", lat: 51.50555, lng: -0.07528 }
];
for (const anchor of thamesAnchors) {
  assert(THAMES_CENTRELINE.some((point) => haversineMetres(point, anchor) <= 2), `The Thames guide must pass through ${anchor.name}.`);
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
assert(packageJson.version === APP_VERSION, `package.json version ${packageJson.version} must match app version ${APP_VERSION}.`);

const manifest = JSON.parse(await readFile(resolve(root, "manifest.webmanifest"), "utf8"));
const manifestFiles = [
  ...(manifest.icons || []).map((item) => item.src),
  ...(manifest.screenshots || []).map((item) => item.src),
  ...(manifest.shortcuts || []).flatMap((item) => (item.icons || []).map((icon) => icon.src))
];
for (const relativePath of new Set(manifestFiles)) {
  try { await access(resolve(root, relativePath.replace(/^\.\//, ""))); }
  catch { failures.push(`Manifest asset is missing: ${relativePath}`); }
}

const serviceWorker = await readFile(resolve(root, "service-worker.js"), "utf8");
const shellBlock = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] || "";
const shellFiles = [...shellBlock.matchAll(/"(\.\/[^"?]+)"/g)].map((match) => match[1]);
assert(shellFiles.length >= 25, "The service-worker application shell looks incomplete.");
for (const relativePath of new Set(shellFiles.filter((item) => item !== "./"))) {
  try { await access(resolve(root, relativePath.replace(/^\.\//, ""))); }
  catch { failures.push(`Service-worker shell file is missing: ${relativePath}`); }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`Validated HideLine ${APP_VERSION}: ${STATIONS.length} handbook stations with official-pin override support, all ${QUESTIONS.length} linked questions, ${RAIL_LINES.length} line presets, the emergency boundary, ${THAMES_CENTRELINE.length}-point Thames side guide, deployment-generated water-edge parsing and install assets.`);
