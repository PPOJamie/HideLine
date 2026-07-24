import { STATIONS, stationNameLength } from "../src/data/stations.js";
import { QUESTIONS, QUESTION_CATEGORIES } from "../src/data/questions.js";
import { QUESTION_DEDUCTION } from "../src/data/question-deduction.js";
import { APP_VERSION } from "../src/core/constants.js";
import { APPROXIMATE_GAME_BOUNDARY } from "../src/data/boundary.js";
import { RAIL_LINES, STATION_GEO } from "../src/data/station-geo.js";
import { THAMES_CENTRELINE } from "../src/data/thames-centreline.js";
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
assert(STATION_GEO.length === STATIONS.length, `Expected coordinates for ${STATIONS.length} stations, found ${STATION_GEO.length}.`);
assert(new Set(STATION_GEO.map((station) => station.id)).size === STATION_GEO.length, "Station coordinate IDs must be unique.");
assert(STATION_GEO.every((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng)), "Every station needs numeric coordinates.");
assert(STATION_GEO.every((station) => station.lat > 51.43 && station.lat < 51.56 && station.lng > -0.24 && station.lng < 0.02), "Station coordinates must stay within the central-London planning extent.");
assert(STATION_GEO.every((station) => STATIONS.some((candidate) => candidate.id === station.id)), "Every coordinate entry must reference a handbook station.");
const lineIds = new Set(RAIL_LINES.map((line) => line.id));
assert(STATION_GEO.every((station) => station.lines.every((lineId) => lineIds.has(lineId))), "Every station line membership must reference a known line preset.");
assert(QUESTIONS.length >= 45, `Expected a comprehensive question catalogue, found ${QUESTIONS.length}.`);
assert(new Set(QUESTIONS.map((question) => question.id)).size === QUESTIONS.length, "Question IDs must be unique.");
assert(QUESTIONS.every((question) => QUESTION_CATEGORIES[question.category]), "Every question must reference a known category.");
assert(QUESTIONS.every((question) => question.responseSeconds === 300 || question.responseSeconds === 600), "Question response time must be five or ten minutes.");
assert(Object.keys(QUESTION_DEDUCTION).length === QUESTIONS.length, "Every handbook question must have exactly one deduction-map capability entry.");
assert(QUESTIONS.every((question) => QUESTION_DEDUCTION[question.id]), "Every handbook question must be linked to the deduction-map audit trail.");
assert(Object.keys(QUESTION_DEDUCTION).every((id) => QUESTIONS.some((question) => question.id === id)), "The deduction capability map must not contain unknown question IDs.");
assert(APPROXIMATE_GAME_BOUNDARY.length >= 4, "The planning boundary needs at least four coordinates.");
assert(JSON.stringify(APPROXIMATE_GAME_BOUNDARY[0]) === JSON.stringify(APPROXIMATE_GAME_BOUNDARY.at(-1)), "The planning polygon must be closed.");
assert(THAMES_CENTRELINE.length >= 500, `Expected a densely interpolated Thames guide, found ${THAMES_CENTRELINE.length} points.`);
assert(THAMES_CENTRELINE.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Number.isFinite(point.halfWidthMetres)), "Every Thames guide point needs latitude, longitude and a half-width.");
assert(THAMES_CENTRELINE[0].lng < THAMES_CENTRELINE.at(-1).lng, "The Thames guide must run broadly west to east.");
const thamesSegmentMetres = (a, b) => {
  const meanLatRadians = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const north = (b.lat - a.lat) * 111_320;
  const east = (b.lng - a.lng) * 111_320 * Math.cos(meanLatRadians);
  return Math.hypot(east, north);
};
assert(THAMES_CENTRELINE.every((point, index, points) => index === 0 || thamesSegmentMetres(points[index - 1], point) <= 36), "Adjacent Thames guide points must remain within the 35 m interpolation target.");

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
console.log(`Validated HideLine ${APP_VERSION}: ${STATIONS.length} stations and coordinates, all ${QUESTIONS.length} linked questions, ${RAIL_LINES.length} line presets, the planning boundary, ${THAMES_CENTRELINE.length}-point remapped Thames guide and install assets.`);
