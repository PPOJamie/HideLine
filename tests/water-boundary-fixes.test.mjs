import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderModal } from "../src/ui/modals.js";
import { constraintResolution, DEDUCTION_TOOL_TYPES } from "../src/core/deduction.js";
import { normaliseSpatialFeature } from "../src/core/spatial.js";
import {
  OFFICIAL_BOUNDARY_SOURCES,
  officialBoundarySourceUrl,
  parseBoundaryGeoJsonResponse
} from "../src/services/reference-data.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../src/services/map.js", import.meta.url), "utf8");

function waterFeature() {
  return normaliseSpatialFeature({
    id: "water:test",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-0.120, 51.500],
        [-0.110, 51.500],
        [-0.110, 51.510],
        [-0.120, 51.510],
        [-0.120, 51.500]
      ]]
    },
    properties: { name: "Test Water", category: "water", layer: "Bodies of water", source: "Test map" }
  });
}

function modalState() {
  return {
    profile: { id: "seeker", name: "Seeker", team: "alpha" },
    connection: { mode: "local", status: "offline", roomCode: null },
    game: {
      id: "game",
      name: "Test",
      round: 1,
      phase: "seeking",
      hiderTeam: "bravo",
      mode: "local",
      teams: { alpha: { name: "Seekers" }, bravo: { name: "Hiders" } },
      members: []
    },
    questions: [],
    events: [],
    location: { current: { lat: 51.505, lng: -0.125 } },
    settings: { repeatRewardMode: "multiply-both", notificationsEnabled: false },
    privateTeamState: { spatialData: { sourceName: "Test", importedAt: null, features: [waterFeature()] } },
    referenceData: { status: "ready", sourceName: "Official", features: [], sources: [], errors: [] }
  };
}

test("official boundary URLs use fixed FeatureServer layers and a SQL-free Central London query", () => {
  assert.deepEqual(new Set(OFFICIAL_BOUNDARY_SOURCES.map((source) => source.category)), new Set(["borough", "ward", "constituency"]));
  for (const source of OFFICIAL_BOUNDARY_SOURCES) {
    assert.match(source.endpoint, /FeatureServer\/0\/query$/);
    const geoUrl = new URL(officialBoundarySourceUrl(source));
    const jsonUrl = new URL(officialBoundarySourceUrl(source, { format: "json" }));
    assert.equal(geoUrl.searchParams.get("where"), "1=1");
    assert.equal(geoUrl.searchParams.get("f"), "geojson");
    assert.equal(jsonUrl.searchParams.get("f"), "json");
    assert.equal(geoUrl.searchParams.get("inSR"), "4326");
    assert.equal(geoUrl.searchParams.get("outSR"), "4326");
    assert.ok(geoUrl.searchParams.get("geometry"));
    assert.doesNotMatch(geoUrl.toString(), /MapServer|LIKE/i);
  }
});

test("boundary parser rejects cached HTML with a useful error", async () => {
  const response = new Response("<html><body>Not boundary data</body></html>", { headers: { "content-type": "text/html" } });
  await assert.rejects(() => parseBoundaryGeoJsonResponse(response, "London boroughs"), /web page instead of boundary data/i);
});

test("boundary parser accepts ArcGIS JSON when GeoJSON is unavailable", async () => {
  const response = new Response(JSON.stringify({
    features: [{
      attributes: { LAD25CD: "E09000001", LAD25NM: "Test Borough" },
      geometry: { rings: [[[-0.12, 51.50], [-0.12, 51.51], [-0.11, 51.51], [-0.11, 51.50], [-0.12, 51.50]]] }
    }]
  }), { headers: { "content-type": "application/json" } });
  const result = await parseBoundaryGeoJsonResponse(response, "London boroughs");
  assert.equal(result.type, "FeatureCollection");
  assert.equal(result.features.length, 1);
  assert.ok(["Polygon", "MultiPolygon"].includes(result.features[0].geometry.type));
  assert.equal(result.features[0].properties.LAD25NM, "Test Borough");
});

test("body-of-water questions offer a map shoreline picker and calculated reference", () => {
  const html = renderModal("ask-question", modalState(), { questionId: "measuring-water" });
  assert.match(html, /Pick nearest water edge from map/);
  assert.match(html, /data-picker-mode="water-edge"/);
  assert.match(html, /name="deductionWaterName"/);
  assert.match(html, /Test Water/);
  assert.match(html, /calculates the seeker's distance automatically/i);
  assert.match(appSource, /automaticFeature = mode === "water-edge"/);
  assert.match(appSource, /seekerDistanceMetres: haversineMetres\(seeker, selectedPoint\)/);
  assert.match(mapSource, /referenceFeatures/);
});

test("a manually selected shoreline keeps its exact point and distance without unsafe auto-elimination", () => {
  const result = constraintResolution({
    id: "water-manual",
    type: DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE,
    category: "water",
    answer: "closer",
    seeker: { lat: 51.50, lng: -0.13 },
    referenceFeatureId: null,
    referenceFeatureName: "Regent's Canal",
    referencePoint: { lat: 51.505, lng: -0.125 },
    seekerDistanceMetres: 654,
    measurementMethod: "player-confirmed nearest shoreline point",
    manualReference: true
  }, { spatialFeatures: [] });
  assert.equal(result.ready, false);
  assert.equal(result.manual, true);
  assert.deepEqual(result.referencePoint, { lat: 51.505, lng: -0.125 });
  assert.equal(result.seekerDistanceMetres, 654);
  assert.match(result.reason, /exact seeker shoreline and distance are recorded/i);
});
