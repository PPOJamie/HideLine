import test from "node:test";
import assert from "node:assert/strict";
import {
  DEDUCTION_MOVEMENT,
  DEDUCTION_STATUS,
  DEDUCTION_TOOL_TYPES,
  deriveAutomaticConstraints,
  evaluateStationPossibilities,
  sampleZonePoints,
  thamesSide
} from "../src/core/deduction.js";
import { STATION_GEO } from "../src/data/station-geo.js";
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
