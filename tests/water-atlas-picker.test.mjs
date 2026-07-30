import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BUILT_IN_WATER_DATA,
  BUILT_IN_WATER_FEATURE_COUNT
} from "../src/data/water-edges.js";
import {
  featureNearestPoint,
  mergeSpatialData,
  measurementOptionsForCategory,
  nearestFeature,
  normaliseSpatialData,
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

function waterFeatures() {
  return usableWaterFeatures(normaliseSpatialData(BUILT_IN_WATER_DATA).features);
}

test("the bundled Central London water atlas contains usable named edge geometry", () => {
  const features = waterFeatures();
  assert.ok(BUILT_IN_WATER_FEATURE_COUNT >= 36);
  assert.equal(features.length, BUILT_IN_WATER_FEATURE_COUNT);
  assert.equal(new Set(features.map((feature) => feature.id)).size, features.length);
  for (const expected of ["River Thames", "Regent's Canal", "Canada Water", "The Serpentine", "St Katharine Docks"]) {
    assert.ok(features.some((feature) => feature.name === expected), `Missing ${expected}`);
  }
  assert.ok(features.every((feature) => feature.bbox && feature.category === "water"));
});

test("the atlas selects a real shoreline rather than the Canada Water station placemark", () => {
  const features = waterFeatures();
  const options = measurementOptionsForCategory("water", { boundaryOnly: true });
  const canadaWaterStation = { lat: 51.49788, lng: -0.04972 };
  const nearestCanada = nearestFeature(canadaWaterStation, features, options);
  assert.equal(nearestCanada?.feature?.name, "Canada Water");
  assert.ok(nearestCanada.distanceMetres < 160);
  const edge = featureNearestPoint(canadaWaterStation, nearestCanada.feature, options);
  assert.ok(edge?.point && edge.distanceMetres < 160);

  const londonBridge = { lat: 51.5054, lng: -0.0865 };
  const nearestBridge = nearestFeature(londonBridge, features, options);
  assert.equal(nearestBridge?.feature?.name, "River Thames");
  assert.ok(nearestBridge.distanceMetres < 350);
});

test("a same-named point import cannot replace usable built-in shoreline geometry", () => {
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
  const merged = mergeSpatialData(BUILT_IN_WATER_DATA, importedPin);
  const canada = merged.features.find((feature) => feature.category === "water" && feature.name === "Canada Water");
  assert.ok(canada);
  assert.notEqual(canada.geometry.type, "Point");
  assert.ok(usableWaterFeatures([canada]).length === 1);
});

test("Body of Water Find Hiders constraints resolve immediately from the bundled atlas", () => {
  const features = waterFeatures();
  const constraint = {
    id: "built-in-water-constraint",
    type: DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE,
    category: "water",
    answer: "closer",
    seeker: { lat: 51.5054, lng: -0.0865 },
    referenceFeatureId: null,
    referenceFeatureName: "River Thames",
    referencePoint: { lat: 51.5049, lng: -0.0863 },
    seekerDistanceMetres: 120,
    measurementMethod: "nearest point on each player's nearest named water edge",
    manualReference: true
  };
  const resolution = constraintResolution(constraint, { spatialFeatures: features });
  assert.equal(resolution.ready, true);
  assert.equal(resolution.manual, false);
  assert.ok(resolution.featureCount >= 36);
  assert.equal(typeof evaluateConstraintAtPoint(constraint, { lat: 51.506, lng: -0.09 }, { spatialFeatures: features }), "boolean");
});

test("the mobile coordinate picker keeps the confirmation controls outside the map", () => {
  assert.match(styles, /\.coordinate-picker-frame\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/);
  assert.match(styles, /\.coordinate-picker-footer\s*\{[\s\S]*z-index:\s*20/);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*\.coordinate-picker-modal\s*\{[\s\S]*height:\s*96dvh/);
  assert.match(styles, /\.coordinate-picker-actions \.button\s*\{[^}]*min-height:\s*46px/);
  assert.match(mapSource, /renderCoordinatePickerFallback\([^)]*referenceFeatures/);
  assert.match(mapSource, /referenceFeatures\.map|referenceFeatures \|\| \[\]/);
  assert.match(modalSource, /built-in Central London water atlas/i);
  assert.doesNotMatch(modalSource, /Find Hiders shading will remain unresolved until a real water line or polygon/i);
});
