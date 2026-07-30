import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveAuthoritativeStations } from "../src/core/station-authority.js";
import { evaluateStationPossibilities, DEDUCTION_MOVEMENT, DEDUCTION_STATUS, DEDUCTION_TOOL_TYPES } from "../src/core/deduction.js";
import { clipLineCoordinatesToBoundaries, clipWaterDataToGameBoundary, mergeSpatialData } from "../src/core/spatial.js";
import { STATIONS } from "../src/data/stations.js";
import { STATION_GEO_BY_ID } from "../src/data/station-geo.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const viewSource = await readFile(new URL("../src/ui/deduction-view.js", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../src/services/map.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/fetch-authoritative-map-data.mjs", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

test("official Google My Map station pins replace fallback circle centres", () => {
  const station = STATIONS.find((candidate) => candidate.name === "Aldgate");
  const fallback = STATION_GEO_BY_ID.get(station.id);
  const official = { lat: fallback.lat + 0.0007, lng: fallback.lng - 0.0006 };
  const feature = {
    id: "kml:official-aldgate",
    name: "Aldgate",
    category: "station",
    layer: "Official map / Hiding Stations",
    source: "Official Google My Map",
    geometry: { type: "Point", coordinates: [official.lng, official.lat] },
    properties: { description: "Hiding Stations" }
  };
  const resolved = resolveAuthoritativeStations([station], [feature]);
  assert.equal(resolved.diagnostics.matchedCount, 1);
  assert.equal(resolved.diagnostics.fallbackCount, 0);
  assert.equal(resolved.stations[0].coordinateSource, "official-map");
  assert.equal(resolved.stations[0].lat, official.lat);
  assert.equal(resolved.stations[0].lng, official.lng);
  assert.ok(resolved.stations[0].fallbackOffsetMetres > 50);
});

test("duplicate handbook station names retain separate official pins", () => {
  const features = [
    { id: "brixton:u", name: "Brixton", category: "station", geometry: { type: "Point", coordinates: [-0.1149, 51.4627] }, properties: {} },
    { id: "brixton:nr", name: "Brixton", category: "station", geometry: { type: "Point", coordinates: [-0.1142, 51.4632] }, properties: {} }
  ];
  const merged = mergeSpatialData({ sourceName: "Official", features });
  assert.equal(merged.features.filter((feature) => feature.category === "station" && feature.name === "Brixton").length, 2);
  const stations = STATIONS.filter((station) => station.name === "Brixton");
  const resolved = resolveAuthoritativeStations(stations, merged.features);
  assert.equal(resolved.diagnostics.matchedCount, 2);
  assert.equal(new Set(resolved.stations.map((station) => `${station.lat},${station.lng}`)).size, 2);
});

test("an official game-map station pin wins over a same-name manual point", () => {
  const station = STATIONS.find((candidate) => candidate.name === "Aldgate");
  const fallback = STATION_GEO_BY_ID.get(station.id);
  const manual = {
    id: "manual:aldgate",
    name: "Aldgate",
    category: "station",
    source: "Manual import",
    geometry: { type: "Point", coordinates: [fallback.lng + 0.0005, fallback.lat] },
    properties: {}
  };
  const official = {
    id: "official:aldgate",
    name: "Aldgate",
    category: "station",
    layer: "Hiding Stations",
    source: "Bundled official Google My Map snapshot",
    geometry: { type: "Point", coordinates: [fallback.lng - 0.0004, fallback.lat] },
    properties: {}
  };
  const resolved = resolveAuthoritativeStations([station], [manual, official]);
  assert.equal(resolved.stations[0].officialFeatureId, official.id);
  assert.equal(resolved.stations[0].lng, official.geometry.coordinates[0]);
});

test("the supplied official game boundary overrides a same-name manual import", () => {
  const manual = {
    sourceName: "Manual import",
    features: [{
      id: "manual-boundary",
      name: "Game Area Map Boundary",
      category: "game_boundary",
      source: "Manual import",
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: {}
    }]
  };
  const official = {
    sourceName: "Bundled official Google My Map snapshot",
    features: [{
      id: "official-boundary",
      name: "Game Area Map Boundary",
      category: "game_boundary",
      source: "Bundled official Google My Map snapshot",
      geometry: { type: "Polygon", coordinates: [[[10, 10], [11, 10], [11, 11], [10, 10]]] },
      properties: {}
    }]
  };
  const merged = mergeSpatialData(manual, official);
  const boundary = merged.features.find((feature) => feature.category === "game_boundary");
  assert.equal(boundary.id, "official-boundary");
});

test("water edges are clipped to the exact game-boundary polygon", () => {
  const boundary = {
    id: "game-boundary",
    name: "Game Area Map Boundary",
    category: "game_boundary",
    geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
    properties: {}
  };
  const clipped = clipLineCoordinatesToBoundaries([[-1, 0.5], [2, 0.5]], [boundary]);
  assert.equal(clipped.length, 1);
  assert.ok(Math.abs(clipped[0][0][0]) < 1e-9);
  assert.ok(Math.abs(clipped[0].at(-1)[0] - 1) < 1e-9);

  const water = {
    status: "ready",
    sourceName: "Test water",
    features: [
      { id: "crossing", name: "Crossing Water", category: "water", geometry: { type: "LineString", coordinates: [[-1, 0.5], [2, 0.5]] }, properties: { quality: "mapped-edge" } },
      { id: "outside", name: "Outside Water", category: "water", geometry: { type: "LineString", coordinates: [[2, 2], [3, 3]] }, properties: { quality: "mapped-edge" } }
    ]
  };
  const effective = clipWaterDataToGameBoundary(water, [boundary]);
  assert.equal(effective.clippedToGameBoundary, true);
  assert.equal(effective.sourceFeatureCount, 2);
  assert.equal(effective.features.length, 1);
  assert.equal(effective.features[0].name, "Crossing Water");
  assert.equal(effective.excludedOutsideGameAreaCount, 1);
});

test("water calculations stay disabled until the official game boundary is available", () => {
  const water = {
    status: "ready",
    sourceName: "Test water",
    features: [{ id: "water", name: "Water", category: "water", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }, properties: { quality: "mapped-edge" } }]
  };
  const effective = clipWaterDataToGameBoundary(water, []);
  assert.equal(effective.clippedToGameBoundary, false);
  assert.equal(effective.features.length, 0);
  assert.match(effective.clipReason, /official game-area boundary/i);
});

test("deduction sampling is centred on the supplied runtime station coordinate", () => {
  const station = STATIONS[0];
  const fallback = STATION_GEO_BY_ID.get(station.id);
  const runtimeStation = { ...station, ...fallback, lat: fallback.lat + 0.012, lng: fallback.lng, coordinateSource: "official-map" };
  const constraint = {
    id: "official-centre-radar",
    type: DEDUCTION_TOOL_TYPES.RADAR,
    movementMode: DEDUCTION_MOVEMENT.MOBILE,
    centre: { lat: runtimeStation.lat, lng: runtimeStation.lng },
    radiusMetres: 100,
    answer: "yes"
  };
  const [result] = evaluateStationPossibilities({ stations: [runtimeStation], constraints: [constraint], radiusMetres: 500 });
  assert.equal(result.status, DEDUCTION_STATUS.PARTIAL);
  assert.equal(result.lat, runtimeStation.lat);
  assert.equal(result.lng, runtimeStation.lng);
});

test("the Pages workflow validates fresh official map and water snapshots before publishing", () => {
  assert.match(buildSource, /google\.com\/maps\/d\/kml/);
  assert.match(buildSource, /Hiding\\s\*Stations/);
  assert.match(buildSource, /official game-boundary polygon was missing/);
  assert.match(buildSource, /officialStationMatchCount/);
  assert.match(buildSource, /matchedCount !== STATIONS\.length/);
  assert.match(buildSource, /OpenStreetMap/);
  assert.match(workflow, /fetch-authoritative-map-data\.mjs --strict/);
  assert.match(workflow, /actions\/cache@v4/);
  assert.ok(workflow.indexOf("fetch-authoritative-map-data.mjs --strict") < workflow.indexOf("upload-pages-artifact"));
});

test("the UI clearly identifies authoritative versus fallback circle centres", () => {
  assert.match(appSource, /All 100 station circles use official game-map pins/);
  assert.match(viewSource, /All 100 hiding circles are centred on the supplied game-map station pins/);
  assert.match(viewSource, /still use fallback coordinates/);
  assert.match(mapSource, /Circle centre:/);
  assert.match(mapSource, /coordinateSourceLabel/);
  assert.match(appSource, /clipWaterDataToGameBoundary/);
  assert.match(viewSource, /remain after clipping to/);
});
