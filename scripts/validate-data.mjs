import { STATIONS, stationNameLength } from "../src/data/stations.js";
import { QUESTIONS, QUESTION_CATEGORIES } from "../src/data/questions.js";
import { APPROXIMATE_GAME_BOUNDARY } from "../src/data/boundary.js";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(STATIONS.length === 100, `Expected 100 hiding-station entries, found ${STATIONS.length}.`);
assert(new Set(STATIONS.map((station) => station.id)).size === STATIONS.length, "Station IDs must be unique.");
assert(STATIONS.every((station) => station.name && stationNameLength(station.name) > 0), "Every station needs a name.");
assert(QUESTIONS.length >= 45, `Expected a comprehensive question catalogue, found ${QUESTIONS.length}.`);
assert(new Set(QUESTIONS.map((question) => question.id)).size === QUESTIONS.length, "Question IDs must be unique.");
assert(QUESTIONS.every((question) => QUESTION_CATEGORIES[question.category]), "Every question must reference a known category.");
assert(QUESTIONS.every((question) => question.responseSeconds === 300 || question.responseSeconds === 600), "Question response time must be five or ten minutes.");
assert(APPROXIMATE_GAME_BOUNDARY.length >= 4, "The planning boundary needs at least four coordinates.");
assert(JSON.stringify(APPROXIMATE_GAME_BOUNDARY[0]) === JSON.stringify(APPROXIMATE_GAME_BOUNDARY.at(-1)), "The planning polygon must be closed.");

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
console.log(`Validated ${STATIONS.length} stations, ${QUESTIONS.length} questions, the planning boundary and install assets.`);
