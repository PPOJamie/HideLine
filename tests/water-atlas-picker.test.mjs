import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseOverpassWaterData, WATER_OVERPASS_QUERY } from "../src/services/water-data.js";
import {
  featureNearestPoint,
  mergeSpatialData,
  measurementOptionsForCategory,
  nearestFeature,
  usableWaterFeatures
} from "../src/core/spatial.js";
import {
  constraintResolution,
  DEDUCTION_TOOL_TYPES,
  evaluateConstraintAtPoint
} from "../src/core/deduction.js";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../src/services/map.js", import.meta.url), "utf8");
const modalSource = await readFile(new URL("../src/ui/modals.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

function fixtureWaterData() {
  return parseOverpassWaterData({
    osm3s: { timestamp_osm_base: "2026-01-01T00:00:00Z" },
    elements: [
      {
        type: "relation",
        id: 101,
        tags: { type: "multipolygon", natural: "water", name: "Canada Water" },
        members: [{ type: "way", ref: 1001, role: "outer", geometry: [
          { lat: 51.4972, lon: -0.0510 }, { lat: 51.4972, lon: -0.0488 },
          { lat: 51.4988, lon: -0.0488 }, { lat: 51.4988, lon: -0.0510 },
          { lat: 51.4972, lon: -0.0510 }
        ] }]
      },
      {
        type: "relation",
        id: 102,
        tags: { type: "multipolygon", natural: "water", name: "River Thames" },
        members: [{ type: "way", ref: 1002, role: "outer", geometry: [
          { lat: 51.5038, lon: -0.0900 }, { lat: 51.5039, lon: -0.0800 },
          { lat: 51.5070, lon: -0.0800 }, { lat: 51.5069, lon: -0.0900 },
          { lat: 51.5038, lon: -0.0900 }
        ] }]
      },
      {
        type: "way",
        id: 103,
        tags: { waterway: "canal", name: "Linear Canal", width: "12" },
        geometry: [{ lat: 51.51, lon: -0.13 }, { lat: 51.51, lon: -0.11 }]
      },
      {
        type: "way",
        id: 104,
        tags: { natural: "water", leisure: "swimming_pool", name: "Excluded Pool" },
        geometry: [
          { lat: 51.49, lon: -0.11 }, { lat: 51.49, lon: -0.109 },
          { lat: 51.491, lon: -0.109 }, { lat: 51.49, lon: -0.11 }
        ]
      }
    ]
  }, "Test OpenStreetMap snapshot");
}

test("deployment water parser creates named mapped edges and clearly labelled linear fallbacks", () => {
  const data = fixtureWaterData();
  const features = usableWaterFeatures(data.features);
  assert.equal(features.length, 3);
  assert.equal(data.exactFeatureCount, 2);
  assert.equal(data.fallbackFeatureCount, 1);
  assert.equal(features.find((feature) => feature.name === "Canada Water")?.properties?.quality, "mapped-edge");
  assert.equal(features.find((feature) => feature.name === "Linear Canal")?.properties?.quality, "width-derived-fallback");
  assert.ok(!features.some((feature) => feature.name === "Excluded Pool"));
});

test("water selection uses a shoreline and cannot be replaced by the Canada Water station placemark", () => {
  const data = fixtureWaterData();
  const features = usableWaterFeatures(data.features);
  const options = measurementOptionsForCategory("water", { boundaryOnly: true });
  const canadaWaterStation = { lat: 51.49788, lng: -0.04972 };
  const nearestCanada = nearestFeature(canadaWaterStation, features, options);
  assert.equal(nearestCanada?.feature?.name, "Canada Water");
  assert.ok(nearestCanada.distanceMetres < 120);
  const edge = featureNearestPoint(canadaWaterStation, nearestCanada.feature, options);
  assert.ok(edge?.point && edge.distanceMetres < 120);

  const importedPin = {
    sourceName: "Example imported pins",
    features: [{
      id: "imported:canada-water-pin",
      name: "Canada Water",
      category: "water",
      layer: "Bodies of water",
      geometry: { type: "Point", coordinates: [-0.0498, 51.4980] }
    }]
  };
  const merged = mergeSpatialData(data, importedPin);
  const canada = merged.features.find((feature) => feature.category === "water" && feature.name === "Canada Water");
  assert.ok(canada);
  assert.notEqual(canada.geometry.type, "Point");
  assert.equal(usableWaterFeatures([canada]).length, 1);
});

test("Body of Water Find Hiders constraints resolve from deployment-generated mapped geometry", () => {
  const features = usableWaterFeatures(fixtureWaterData().features);
  const constraint = {
    id: "mapped-water-constraint",
    type: DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE,
    category: "water",
    answer: "closer",
    seeker: { lat: 51.5054, lng: -0.0865 },
    referenceFeatureId: null,
    referenceFeatureName: "River Thames",
    referencePoint: { lat: 51.5040, lng: -0.0865 },
    seekerDistanceMetres: 155,
    measurementMethod: "nearest point on each player's nearest named water edge",
    manualReference: true
  };
  const resolution = constraintResolution(constraint, { spatialFeatures: features });
  assert.equal(resolution.ready, true);
  assert.equal(resolution.manual, false);
  assert.equal(resolution.featureCount, 3);
  assert.equal(typeof evaluateConstraintAtPoint(constraint, { lat: 51.506, lng: -0.09 }, { spatialFeatures: features }), "boolean");
});

test("water snapshot generation is part of deployment and the retired hand-drawn atlas is inactive", () => {
  assert.match(WATER_OVERPASS_QUERY(), /natural"="water/);
  assert.match(WATER_OVERPASS_QUERY(), /out tags geom/);
  assert.match(workflow, /fetch-authoritative-map-data\.mjs --strict/);
  assert.match(appSource, /loadAuthoritativeWaterData/);
  assert.doesNotMatch(appSource, /BUILT_IN_WATER_DATA/);
  assert.doesNotMatch(worker, /src\/data\/water-edges\.js/);
  assert.match(worker, /src\/services\/water-data\.js/);
});

test("the mobile coordinate picker keeps the confirmation controls outside the map", () => {
  assert.match(styles, /\.coordinate-picker-frame\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/);
  assert.match(styles, /\.coordinate-picker-footer\s*\{[\s\S]*z-index:\s*20/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.coordinate-picker-modal\s*\{[\s\S]*height:\s*96dvh/);
  assert.match(styles, /\.coordinate-picker-actions \.button\s*\{[^}]*min-height:\s*46px/);
  assert.match(mapSource, /renderCoordinatePickerFallback\([^)]*referenceFeatures/);
  assert.match(mapSource, /referenceFeatures\.map|referenceFeatures \|\| \[\]/);
  assert.match(modalSource, /deployed OpenStreetMap water-edge snapshot/i);
  assert.doesNotMatch(modalSource, /Find Hiders shading will remain unresolved until a real water line or polygon/i);
});
