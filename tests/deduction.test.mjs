import test from "node:test";
import assert from "node:assert/strict";
import {
  DEDUCTION_AREA_SELECTION_ALL,
  DEDUCTION_MOVEMENT,
  DEDUCTION_STATUS,
  DEDUCTION_TOOL_TYPES,
  deriveAutomaticConstraints,
  evaluateStationPossibilities,
  evaluateZoneAreaMask,
  normaliseDeductionRoundState,
  sampleZoneCells,
  sampleZonePoints,
  thamesSide,
  THAMES_CENTRELINE
} from "../src/core/deduction.js";
import { STATION_GEO } from "../src/data/station-geo.js";
import { QUESTIONS } from "../src/data/questions.js";
import { QUESTION_DEDUCTION } from "../src/data/question-deduction.js";
import { STATIONS } from "../src/data/stations.js";

test("every handbook station has an embedded coordinate for the offline deduction map", () => {
  assert.equal(STATION_GEO.length, 100);
  assert.equal(new Set(STATION_GEO.map((station) => station.id)).size, 100);
  assert.ok(STATION_GEO.every((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng)));
  assert.deepEqual(new Set(STATION_GEO.map((station) => station.id)), new Set(STATIONS.map((station) => station.id)));
});

test("zone sampling includes the station centre and points close to the 500 m edge", () => {
  const points = sampleZonePoints({ lat: 51.5, lng: -0.1 }, 500);
  assert.equal(points.length, 97);
  assert.equal(points[0].offsetMetres, 0);
  assert.ok(points.some((point) => point.offsetMetres > 490));
});

test("mobile snapshots can both fit one station even when no single fixed point fits both", () => {
  const station = { id: "test-zone", name: "Test Zone", lat: 51.5, lng: -0.1 };
  const east = { lat: 51.5, lng: -0.0943 };
  const west = { lat: 51.5, lng: -0.1057 };
  const baseConstraints = [
    { id: "east", type: DEDUCTION_TOOL_TYPES.RADAR, centre: east, radiusMetres: 190, answer: "yes" },
    { id: "west", type: DEDUCTION_TOOL_TYPES.RADAR, centre: west, radiusMetres: 190, answer: "yes" }
  ];
  const mobile = evaluateStationPossibilities({
    stations: [station],
    constraints: baseConstraints.map((constraint) => ({ ...constraint, movementMode: DEDUCTION_MOVEMENT.MOBILE }))
  })[0];
  const locked = evaluateStationPossibilities({
    stations: [station],
    constraints: baseConstraints.map((constraint) => ({ ...constraint, movementMode: DEDUCTION_MOVEMENT.LOCKED }))
  })[0];
  assert.notEqual(mobile.baseStatus, DEDUCTION_STATUS.ELIMINATED);
  assert.equal(locked.baseStatus, DEDUCTION_STATUS.ELIMINATED);
});

test("the combined answer overlay shows exclusions from every supplied answer at once", () => {
  const station = { id: "combined-overlay", name: "Combined overlay", lat: 51.5, lng: -0.1 };
  const constraints = [
    {
      id: "overlay-east",
      type: DEDUCTION_TOOL_TYPES.RADAR,
      movementMode: DEDUCTION_MOVEMENT.MOBILE,
      centre: { lat: 51.5, lng: -0.098 },
      radiusMetres: 430,
      answer: "yes"
    },
    {
      id: "overlay-west",
      type: DEDUCTION_TOOL_TYPES.RADAR,
      movementMode: DEDUCTION_MOVEMENT.MOBILE,
      centre: { lat: 51.5, lng: -0.102 },
      radiusMetres: 430,
      answer: "yes"
    }
  ];
  const mask = evaluateZoneAreaMask({
    station,
    constraints,
    mode: "overlay",
    cellSizeMetres: 35
  });
  assert.equal(mask.constraintCount, 2);
  assert.ok(mask.allowed > 0);
  assert.ok(mask.excluded > 0);
  assert.equal(mask.unknown, 0);
  assert.ok(mask.cells.some((cell) => cell.state === "excluded" && cell.excludedByCount >= 2));
});

test("older latest-answer preferences migrate to the all-answer overlay", () => {
  const roundState = normaliseDeductionRoundState({ areaConstraintId: "latest" });
  assert.equal(roundState.areaConstraintId, DEDUCTION_AREA_SELECTION_ALL);
});

test("station-name length is a station-level filter", () => {
  const results = evaluateStationPossibilities({
    stations: [
      { id: "one", name: "Tower Hill", lat: 51.5, lng: -0.1 },
      { id: "two", name: "Oxford Circus", lat: 51.5, lng: -0.1 }
    ],
    constraints: [{ id: "length", type: DEDUCTION_TOOL_TYPES.STATION_NAME, seekerLength: 10, answer: "same" }]
  });
  assert.equal(results[0].baseStatus, DEDUCTION_STATUS.POSSIBLE);
  assert.equal(results[1].baseStatus, DEDUCTION_STATUS.ELIMINATED);
});

test("transit exact stops override a broad line preset", () => {
  const stations = [
    { id: "bank-station", name: "Bank Station", lat: 51.5129, lng: -0.0873 },
    { id: "waterloo", name: "Waterloo", lat: 51.5032, lng: -0.1133 }
  ];
  const results = evaluateStationPossibilities({
    stations,
    constraints: [{
      id: "train",
      type: DEDUCTION_TOOL_TYPES.TRANSIT,
      lineId: "waterloo-city",
      stationIds: ["waterloo"],
      answer: "yes"
    }]
  });
  assert.equal(results[0].baseStatus, DEDUCTION_STATUS.ELIMINATED);
  assert.equal(results[1].baseStatus, DEDUCTION_STATUS.POSSIBLE);
});

test("a radar edge crossing leaves a station partly possible", () => {
  const result = evaluateStationPossibilities({
    stations: [{ id: "edge", name: "Edge", lat: 51.5, lng: -0.1 }],
    constraints: [{
      id: "radar",
      type: DEDUCTION_TOOL_TYPES.RADAR,
      movementMode: DEDUCTION_MOVEMENT.MOBILE,
      centre: { lat: 51.5, lng: -0.0928 },
      radiusMetres: 500,
      answer: "yes"
    }]
  })[0];
  assert.equal(result.baseStatus, DEDUCTION_STATUS.PARTIAL);
});

test("answered structured questions become automatic seeker constraints", () => {
  const constraints = deriveAutomaticConstraints({
    team: "alpha",
    round: 1,
    questions: [{
      id: "question-1",
      questionId: "radar-2",
      questionName: "2 km radar",
      askedByTeam: "alpha",
      round: 1,
      status: "answered",
      answer: "No",
      askedAt: "2026-01-01T12:00:00.000Z",
      deductionInput: {
        enabled: true,
        type: DEDUCTION_TOOL_TYPES.RADAR,
        movementMode: DEDUCTION_MOVEMENT.MOBILE,
        centre: { lat: 51.5, lng: -0.1 },
        radiusMetres: 2000
      }
    }]
  });
  assert.equal(constraints.length, 1);
  assert.equal(constraints[0].id, "auto:question-1");
  assert.equal(constraints[0].answer, "no");
});

test("an answer recorded during endgame is treated as fixed even when asked earlier", () => {
  const constraints = deriveAutomaticConstraints({
    team: "alpha",
    round: 1,
    questions: [{
      id: "question-endgame",
      questionId: "radar-1",
      questionName: "1 km radar",
      askedByTeam: "alpha",
      round: 1,
      phase: "seeking",
      answeredPhase: "endgame",
      status: "answered",
      answer: "Yes",
      deductionInput: {
        enabled: true,
        type: DEDUCTION_TOOL_TYPES.RADAR,
        movementMode: DEDUCTION_MOVEMENT.MOBILE,
        centre: { lat: 51.5, lng: -0.1 },
        radiusMetres: 1000
      }
    }]
  });
  assert.equal(constraints[0].movementMode, DEDUCTION_MOVEMENT.LOCKED);
});

test("the simplified Thames guide distinguishes central north and south points", () => {
  assert.equal(thamesSide({ lat: 51.515, lng: -0.11 }), "north");
  assert.equal(thamesSide({ lat: 51.49, lng: -0.11 }), "south");
});

test("the remapped Thames guide follows the western bends rather than cutting through land", () => {
  assert.ok(THAMES_CENTRELINE.length > 500);
  assert.ok(THAMES_CENTRELINE.some((point) => point.lng < -0.22 && point.lat > 51.485));
  assert.ok(THAMES_CENTRELINE.some((point) => point.lng < -0.20 && point.lat < 51.461));
  assert.equal(thamesSide({ lat: 51.495, lng: -0.225 }), "north");
  assert.equal(thamesSide({ lat: 51.475, lng: -0.225 }), "south");
  assert.equal(thamesSide({ lat: 51.4863, lng: -0.22483 }), "both");
  assert.equal(thamesSide({ lat: 51.46665, lng: -0.21339 }), "both");
  assert.equal(thamesSide({ lat: 51.4595, lng: -0.20583 }), "both");
  assert.equal(thamesSide({ lat: 51.475, lng: -0.19 }), "north");
  assert.equal(thamesSide({ lat: 51.455, lng: -0.19 }), "south");
  assert.equal(thamesSide({ lat: 51.465, lng: -0.18806 }), "both");
  assert.equal(thamesSide({ lat: 51.47306, lng: -0.17917 }), "both");
  assert.equal(thamesSide({ lat: 51.48111, lng: -0.1725 }), "both");
});



test("all 55 handbook questions are linked to either automatic geometry or guided review", () => {
  assert.equal(QUESTIONS.length, 55);
  assert.equal(Object.keys(QUESTION_DEDUCTION).length, QUESTIONS.length);
  assert.deepEqual(
    new Set(Object.keys(QUESTION_DEDUCTION)),
    new Set(QUESTIONS.map((question) => question.id))
  );
  assert.ok(Object.values(QUESTION_DEDUCTION).every((config) => ["automatic", "guided"].includes(config.mode)));
});

test("visual cells cover the full circular zone after clipping", () => {
  const station = { id: "cells", name: "Cells", lat: 51.5, lng: -0.1 };
  const cells = sampleZoneCells(station, 500, 50);
  assert.ok(cells.length > 300);
  const furthestCorner = Math.max(...cells.flatMap((cell) => cell.corners.map((corner) => {
    const north = (corner.lat - station.lat) * 111_320;
    const east = (corner.lng - station.lng) * 111_320 * Math.cos((station.lat * Math.PI) / 180);
    return Math.hypot(east, north);
  })));
  assert.ok(furthestCorner >= 500, "edge-touching cells should extend past the clip circle");
});

test("a linked manual polygon greys only the excluded half of a station circle", () => {
  const station = { id: "manual-mask", name: "Manual mask", lat: 51.5, lng: -0.1 };
  const constraint = {
    id: "manual-west",
    type: DEDUCTION_TOOL_TYPES.MANUAL_AREA,
    movementMode: DEDUCTION_MOVEMENT.MOBILE,
    shape: "polygon",
    answer: "inside",
    polygon: [
      { lat: 51.494, lng: -0.108 },
      { lat: 51.506, lng: -0.108 },
      { lat: 51.506, lng: -0.1 },
      { lat: 51.494, lng: -0.1 }
    ]
  };
  const mask = evaluateZoneAreaMask({
    station,
    constraints: [constraint],
    mode: "constraint",
    activeConstraintId: constraint.id,
    cellSizeMetres: 40
  });
  assert.ok(mask.allowed > 0);
  assert.ok(mask.excluded > 0);
  assert.equal(mask.unknown, 0);
  assert.ok(mask.allowedFraction > 0.35 && mask.allowedFraction < 0.65);
});

function pointFeature(id, name, category, lat, lng) {
  return {
    id,
    name,
    category,
    layer: category,
    geometry: { type: "Point", coordinates: [lng, lat] },
    bbox: { west: lng, east: lng, south: lat, north: lat },
    source: "test",
    properties: {}
  };
}

function polygonFeature(id, name, category, west, south, east, north) {
  return {
    id,
    name,
    category,
    layer: category,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [west, south], [east, south], [east, north], [west, north], [west, south]
      ]]
    },
    bbox: { west, south, east, north },
    source: "test",
    properties: {}
  };
}

test("nearest-feature matching creates a detailed partial mask", () => {
  const station = { id: "nearest-match", name: "Nearest match", lat: 51.5, lng: -0.1 };
  const features = [
    pointFeature("museum-west", "West Museum", "museum", 51.5, -0.1045),
    pointFeature("museum-east", "East Museum", "museum", 51.5, -0.0955)
  ];
  const constraint = {
    id: "nearest-match-answer",
    type: DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH,
    movementMode: DEDUCTION_MOVEMENT.MOBILE,
    seeker: { lat: 51.5, lng: -0.105 },
    category: "museum",
    answer: "yes"
  };
  const mask = evaluateZoneAreaMask({
    station,
    constraints: [constraint],
    mode: "constraint",
    activeConstraintId: constraint.id,
    spatialFeatures: features,
    cellSizeMetres: 35
  });
  assert.ok(mask.allowed > 0);
  assert.ok(mask.excluded > 0);
  assert.equal(mask.unknown, 0);
});

test("region matching uses imported boundary polygons", () => {
  const station = { id: "region-mask", name: "Region mask", lat: 51.5, lng: -0.1 };
  const features = [
    polygonFeature("borough-west", "West Borough", "borough", -0.12, 51.48, -0.1, 51.52),
    polygonFeature("borough-east", "East Borough", "borough", -0.1, 51.48, -0.08, 51.52)
  ];
  const constraint = {
    id: "borough-match",
    type: DEDUCTION_TOOL_TYPES.REGION_MATCH,
    movementMode: DEDUCTION_MOVEMENT.MOBILE,
    seeker: { lat: 51.5, lng: -0.11 },
    category: "borough",
    answer: "yes"
  };
  const mask = evaluateZoneAreaMask({
    station,
    constraints: [constraint],
    mode: "constraint",
    activeConstraintId: constraint.id,
    spatialFeatures: features,
    cellSizeMetres: 35
  });
  assert.ok(mask.allowed > 0);
  assert.ok(mask.excluded > 0);
  assert.equal(mask.unknown, 0);
});

test("Tentacles keeps cells closest to the named valid POI within two kilometres", () => {
  const station = { id: "tentacle-mask", name: "Tentacle mask", lat: 51.5, lng: -0.1 };
  const features = [
    pointFeature("museum-west", "West Museum", "museum", 51.5, -0.1045),
    pointFeature("museum-east", "East Museum", "museum", 51.5, -0.0955),
    pointFeature("museum-far", "Far Museum", "museum", 51.5, -0.2)
  ];
  const constraint = {
    id: "tentacle-answer",
    type: DEDUCTION_TOOL_TYPES.TENTACLE,
    movementMode: DEDUCTION_MOVEMENT.MOBILE,
    seeker: { lat: 51.5, lng: -0.1 },
    category: "museum",
    radiusMetres: 2000,
    answerFeatureName: "West Museum",
    answer: "West Museum"
  };
  const mask = evaluateZoneAreaMask({
    station,
    constraints: [constraint],
    mode: "constraint",
    activeConstraintId: constraint.id,
    spatialFeatures: features,
    cellSizeMetres: 35
  });
  assert.ok(mask.allowed > 0);
  assert.ok(mask.excluded > 0);
  assert.equal(mask.unknown, 0);
});

test("Endgame hard masks retain station-level answers asked before Endgame", () => {
  const station = { id: "endgame-station-fact", name: "Tower Hill", lat: 51.5, lng: -0.1 };
  const mask = evaluateZoneAreaMask({
    station,
    constraints: [{
      id: "old-name-answer",
      type: DEDUCTION_TOOL_TYPES.STATION_NAME,
      movementMode: DEDUCTION_MOVEMENT.MOBILE,
      seekerLength: 13,
      answer: "same"
    }],
    mode: "endgame",
    cellSizeMetres: 50
  });
  assert.equal(mask.constraintCount, 1);
  assert.equal(mask.allowed, 0);
  assert.ok(mask.excluded > 0);
});

test("pre-Endgame area answers are retained as a separate historical mask", () => {
  const station = { id: "endgame-history", name: "Endgame history", lat: 51.5, lng: -0.1 };
  const constraints = [{
    id: "old-radar",
    type: DEDUCTION_TOOL_TYPES.RADAR,
    movementMode: DEDUCTION_MOVEMENT.MOBILE,
    centre: { lat: 51.5, lng: -0.096 },
    radiusMetres: 420,
    answer: "yes"
  }];
  const current = evaluateZoneAreaMask({ station, constraints, mode: "endgame", cellSizeMetres: 40 });
  const history = evaluateZoneAreaMask({ station, constraints, mode: "history", cellSizeMetres: 40 });
  assert.equal(current.constraintCount, 0);
  assert.equal(current.excluded, 0);
  assert.equal(history.constraintCount, 1);
  assert.ok(history.allowed > 0);
  assert.ok(history.excluded > 0);
});

test("the Endgame circle intersects all locked answer areas at one fixed point", () => {
  const station = { id: "endgame-mask", name: "Endgame mask", lat: 51.5, lng: -0.1 };
  const constraints = [
    {
      id: "locked-east",
      type: DEDUCTION_TOOL_TYPES.RADAR,
      movementMode: DEDUCTION_MOVEMENT.LOCKED,
      centre: { lat: 51.5, lng: -0.0965 },
      radiusMetres: 420,
      answer: "yes"
    },
    {
      id: "locked-west",
      type: DEDUCTION_TOOL_TYPES.RADAR,
      movementMode: DEDUCTION_MOVEMENT.LOCKED,
      centre: { lat: 51.5, lng: -0.1035 },
      radiusMetres: 420,
      answer: "yes"
    },
    {
      id: "mobile-ignored-in-endgame",
      type: DEDUCTION_TOOL_TYPES.RADAR,
      movementMode: DEDUCTION_MOVEMENT.MOBILE,
      centre: { lat: 51.5, lng: -0.1 },
      radiusMetres: 20,
      answer: "yes"
    }
  ];
  const mask = evaluateZoneAreaMask({
    station,
    constraints,
    mode: "endgame",
    cellSizeMetres: 30
  });
  assert.equal(mask.constraintCount, 2);
  assert.ok(mask.allowed > 0);
  assert.ok(mask.excluded > 0);
  assert.equal(mask.unknown, 0);
  assert.ok(mask.allowedFraction < 0.5);
});
