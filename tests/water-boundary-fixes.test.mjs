import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderModal } from "../src/ui/modals.js";
import {
  constraintResolution,
  DEDUCTION_TOOL_TYPES,
  evaluateConstraintAtPoint
} from "../src/core/deduction.js";
import {
  bodyOfWaterDistanceResult,
  inferSpatialCategory,
  isUsableWaterFeature,
  normaliseSpatialFeature,
  usableWaterFeatures
} from "../src/core/spatial.js";
import {
  OFFICIAL_BOUNDARY_SOURCES,
  officialBoundarySourceUrl,
  parseBoundaryGeoJsonResponse
} from "../src/services/reference-data.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../src/services/map.js", import.meta.url), "utf8");

function waterFeature(overrides = {}) {
  return normaliseSpatialFeature({
    id: overrides.id || "water:test",
    geometry: overrides.geometry || {
      type: "Polygon",
      coordinates: [[
        [-0.120, 51.500],
        [-0.110, 51.500],
        [-0.110, 51.510],
        [-0.120, 51.510],
        [-0.120, 51.500]
      ]]
    },
    properties: {
      name: overrides.name || "Test Water",
      category: overrides.category || "water",
      layer: overrides.layer || "Bodies of water",
      source: "Test map",
      description: overrides.description || ""
    }
  });
}

function modalState(question = null) {
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
    questions: question ? [question] : [],
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

test("Body of Water asking is map-only and contains no place-name dropdown", () => {
  const html = renderModal("ask-question", modalState(), { questionId: "measuring-water" });
  assert.match(html, /There is no place-name list/i);
  assert.match(html, /Select nearest water edge on map/);
  assert.match(html, /data-picker-mode="water-edge"/);
  assert.match(html, /data-water-calculator/);
  assert.match(html, /name="deductionWaterPointLat"/);
  assert.match(html, /name="deductionWaterPointLng"/);
  assert.match(html, /Water name[\s\S]*optional/i);
  assert.doesNotMatch(html, /name="deductionReferenceFeatureId"/);
  assert.doesNotMatch(html, /<option[^>]*>Test Water<\/option>/);
  assert.match(appSource, /waterWorkflowVersion:\s*2/);
  assert.match(appSource, /exact player-selected nearest water edge/);
});

test("Body of Water answering uses a private two-point calculator", () => {
  const question = {
    id: "water-question",
    questionId: "measuring-water",
    questionName: "Body of water",
    status: "pending",
    deductionInput: {
      waterWorkflowVersion: 2,
      seekerDistanceMetres: 620,
      referencePoint: { lat: 51.51, lng: -0.12 }
    },
    mapReference: { name: "Selected nearest water edge", seekerDistanceMetres: 620 }
  };
  const html = renderModal("water-answer", modalState(question), { questionInstanceId: question.id });
  assert.match(html, /Private calculation/i);
  assert.match(html, /620 m/);
  assert.match(html, /name="hiderWaterLocationLat"/);
  assert.match(html, /name="hiderWaterEdgeLat"/);
  assert.match(html, /Select my nearest water edge on map/);
  assert.match(html, /name="computedAnswer"/);
  assert.match(html, /Submit calculated answer/);
  assert.doesNotMatch(html, /<select/);
  assert.match(appSource, /waterAnswerMethod:\s*"private-two-point-calculator"/);
  assert.match(appSource, /do not attach the hider's location/i);
});

test("legacy Body of Water questions are rejected for re-asking", () => {
  const oldQuestion = {
    id: "old-water",
    questionId: "measuring-water",
    questionName: "Body of water",
    status: "pending",
    deductionInput: { seekerDistanceMetres: 500 },
    mapReference: { name: "Canada Water", seekerDistanceMetres: 500 }
  };
  const html = renderModal("water-answer", modalState(oldQuestion), { questionInstanceId: oldQuestion.id });
  assert.match(html, /old water list/i);
  assert.match(html, /Re-ask required/);
  assert.doesNotMatch(html, /data-baseline-distance="500"/);
});

test("the two-point water calculator returns closer and further", () => {
  const location = { lat: 51.5000, lng: -0.1200 };
  const edge = { lat: 51.5000, lng: -0.1190 };
  const closer = bodyOfWaterDistanceResult(location, edge, 100);
  const further = bodyOfWaterDistanceResult(location, edge, 50);
  assert.equal(closer.ready, true);
  assert.equal(closer.answer, "Closer");
  assert.equal(further.ready, true);
  assert.equal(further.answer, "Further");
  assert.ok(closer.playerDistanceMetres > 60 && closer.playerDistanceMetres < 80);
});

test("station pins and point placemarks cannot become water-edge references", () => {
  assert.equal(inferSpatialCategory("Hiding Stations", "Canada Water"), "station");
  const stationPoint = waterFeature({
    id: "water:canada-station",
    name: "Canada Water",
    layer: "Hiding Stations",
    geometry: { type: "Point", coordinates: [-0.05, 51.498] }
  });
  const pool = waterFeature({ name: "Hotel swimming pool" });
  const polygon = waterFeature();
  assert.equal(isUsableWaterFeature(stationPoint), false);
  assert.equal(isUsableWaterFeature(pool), false);
  assert.equal(isUsableWaterFeature(polygon), true);
  assert.deepEqual(usableWaterFeatures([stationPoint, pool, polygon]).map((feature) => feature.id), [polygon.id]);
});

test("water deduction stays transparent without geometry and activates with a usable water edge layer", () => {
  const constraint = {
    id: "water-manual",
    type: DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE,
    category: "water",
    answer: "closer",
    seeker: { lat: 51.50, lng: -0.13 },
    referenceFeatureId: null,
    referenceFeatureName: "Regent's Canal",
    referencePoint: { lat: 51.505, lng: -0.125 },
    seekerDistanceMetres: 654,
    measurementMethod: "exact player-selected nearest water edge",
    manualReference: true
  };
  const unresolved = constraintResolution(constraint, { spatialFeatures: [] });
  assert.equal(unresolved.ready, false);
  assert.equal(unresolved.manual, true);
  assert.deepEqual(unresolved.referencePoint, { lat: 51.505, lng: -0.125 });
  assert.equal(unresolved.seekerDistanceMetres, 654);
  assert.match(unresolved.reason, /polygon or line layer/i);

  const resolved = constraintResolution(constraint, { spatialFeatures: [waterFeature()] });
  assert.equal(resolved.ready, true);
  assert.equal(resolved.manual, false);
  assert.equal(resolved.featureCount, 1);
  assert.equal(typeof evaluateConstraintAtPoint(constraint, { lat: 51.505, lng: -0.115 }, { spatialFeatures: [waterFeature()] }), "boolean");
});

test("the coordinate picker draws the player location and measurement line online and offline", () => {
  assert.match(mapSource, /originPoint = null/);
  assert.match(mapSource, /coordinatePickerOriginMarker/);
  assert.match(mapSource, /coordinatePickerGuideLine/);
  assert.match(mapSource, /data-picker-guide/);
  assert.match(appSource, /coordinate-picker-water-legend/);
  assert.match(appSource, /Use this exact edge/);
});
