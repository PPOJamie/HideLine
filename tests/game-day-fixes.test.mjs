import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderModal } from "../src/ui/modals.js";
import { renderQuestionsView } from "../src/ui/questions-view.js";
import { featureNearestPoint, measurementOptionsForCategory, normaliseSpatialFeature } from "../src/core/spatial.js";
import { deriveAutomaticConstraints } from "../src/core/deduction.js";
import { OFFICIAL_BOUNDARY_SOURCES } from "../src/services/reference-data.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const modalSource = await readFile(new URL("../src/ui/modals.js", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../src/services/map.js", import.meta.url), "utf8");
const playSource = await readFile(new URL("../src/ui/play.js", import.meta.url), "utf8");

function pointFeature(id, name, category, lng, lat) {
  return normaliseSpatialFeature({
    id,
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: { name, category, layer: category, source: "Test game map" }
  });
}

function questionState(team = "bravo") {
  const features = [
    pointFeature("museum:one", "Museum One", "museum", -0.11, 51.505),
    pointFeature("museum:two", "Museum Two", "museum", -0.09, 51.51),
    pointFeature("park:one", "Example Park", "park", -0.12, 51.50),
    pointFeature("hospital:one", "Example Hospital", "hospital", -0.10, 51.50)
  ];
  return {
    profile: { id: `player-${team}`, name: "Player", team },
    ui: { view: "questions", questionCategory: "all", questionSearch: "", installPromptAvailable: false },
    connection: { mode: "connected", status: "online", roomCode: "ABC123" },
    game: {
      id: "game-1",
      name: "London game",
      round: 1,
      phase: "seeking",
      hiderTeam: "bravo",
      mode: "connected",
      teams: { alpha: { name: "Seekers" }, bravo: { name: "Hiders" } },
      members: []
    },
    questions: [],
    events: [],
    location: { current: { lat: 51.503, lng: -0.11 } },
    settings: { repeatRewardMode: "multiply-both", notificationsEnabled: false },
    privateTeamState: { spatialData: { sourceName: "Test", importedAt: null, features } },
    referenceData: { status: "ready", sourceName: "Official", features: [], sources: [], errors: [] }
  };
}

test("Start now uses the exact button press rather than a minute-rounded form time", () => {
  assert.match(modalSource, /name="startMode" value="now" checked/);
  assert.match(modalSource, /type="datetime-local" step="1"/);
  assert.match(appSource, /data\.startMode === "scheduled"/);
  assert.match(appSource, /useScheduledStart \? Date\.parse\(data\.roundStart\) : Date\.now\(\)/);
});

test("open question forms retain unsaved coordinates and other draft controls across live renders", () => {
  assert.match(appSource, /captureModalDraft\(\);\s*const state = this\.store\.get\(\)/s);
  assert.match(appSource, /restoreModalDraft\(\)/);
  assert.match(appSource, /\[name\$="Lat"\], \[name\$="Lng"\]/);
  assert.match(appSource, /this\.captureModalDraft\(\);\s*this\.closeCoordinatePicker\(\)/s);
});

test("answers have direct view controls from both history and the game activity feed", () => {
  assert.match(playSource, /data-action="view-answer"/);
  assert.match(appSource, /case "view-answer": this\.openModal\("answer-details"/);
  assert.match(modalSource, /function answerDetailsModal/);
});

test("the official game boundary is red only when imported; the fallback is amber and labelled approximate", () => {
  assert.match(mapSource, /category === "game_boundary"/);
  assert.match(mapSource, /color: "#d51f3d"/);
  assert.match(mapSource, /color: "#b7791f"/);
  assert.match(mapSource, /Fallback station-coverage guide/);
  assert.match(appSource, /ensureConfiguredGameMapData/);
});

test("body-of-water and administrative measurements use the nearest polygon edge", () => {
  const feature = normaliseSpatialFeature({
    id: "water-square",
    geometry: { type: "Polygon", coordinates: [[[-0.01, -0.01], [0.01, -0.01], [0.01, 0.01], [-0.01, 0.01], [-0.01, -0.01]]] },
    properties: { name: "Test Water", category: "water", layer: "Bodies of water" }
  });
  const result = featureNearestPoint({ lat: 0, lng: 0 }, feature, measurementOptionsForCategory("water"));
  assert.ok(result.distanceMetres > 1000 && result.distanceMetres < 1200);
  assert.ok(Math.abs(Math.abs(result.point.lat) - 0.01) < 0.0001 || Math.abs(Math.abs(result.point.lng) - 0.01) < 0.0001);
  assert.match(mapSource, /Your current nearest reference/);
  assert.match(mapSource, /Seeker question pin/);
});

test("borough, ward and constituency boundary sources are built into HideLine", () => {
  assert.deepEqual(new Set(OFFICIAL_BOUNDARY_SOURCES.map((source) => source.category)), new Set(["borough", "ward", "constituency"]));
  assert.ok(OFFICIAL_BOUNDARY_SOURCES.every((source) => /\/rest\/services\//i.test(source.endpoint)));
  assert.equal(OFFICIAL_BOUNDARY_SOURCES.find((source) => source.category === "ward").nameField, "WD25NM");
  assert.equal(OFFICIAL_BOUNDARY_SOURCES.find((source) => source.category === "constituency").nameField, "PCON24NM");
});

test("Tentacle questions render a mapped answer drop-down for the hider", () => {
  const state = questionState("bravo");
  state.questions = [{
    id: "tentacle-1",
    questionId: "tentacles-museums",
    questionName: "Museums Tentacle",
    category: "tentacles",
    prompt: "Which museum are you closest to?",
    askedAt: new Date().toISOString(),
    responseSeconds: 300,
    status: "pending",
    answers: ["POI name"],
    answerChoices: [
      { id: "museum:one", name: "Museum One", distanceFromSeekerMetres: 520 },
      { id: "museum:two", name: "Museum Two", distanceFromSeekerMetres: 1230 }
    ]
  }];
  const html = renderQuestionsView(state);
  assert.match(html, /name="answerFeatureId"/);
  assert.match(html, /Museum One/);
  assert.match(html, /Museum Two/);
  assert.match(html, /Submit selected answer/);
});

test("matching and measuring POI questions offer a feature list while asking", () => {
  const state = questionState("alpha");
  const matching = renderModal("ask-question", state, { questionId: "matching-museum" });
  assert.match(matching, /name="deductionReferenceFeatureId"/);
  assert.match(matching, /Museum One/);
  assert.match(matching, /Museum Two/);
  const measuring = renderModal("ask-question", state, { questionId: "measuring-park" });
  assert.match(measuring, /Example Park/);
  assert.match(measuring, /Choose automatically from the seeker pin/);
});

test("a missing stored seeker distance stays unresolved instead of becoming zero metres", () => {
  const constraints = deriveAutomaticConstraints({
    team: "alpha",
    round: 1,
    questions: [{
      id: "measurement-1",
      questionId: "measuring-water",
      questionName: "Body of water",
      status: "answered",
      answer: "Closer",
      askedByTeam: "alpha",
      round: 1,
      deductionInput: {
        enabled: true,
        type: "nearest-feature-distance",
        movementMode: "mobile",
        seeker: { lat: 51.5, lng: -0.1 },
        category: "water",
        boundaryOnly: true,
        referenceFeatureId: "water-1",
        seekerDistanceMetres: null
      }
    }]
  });
  assert.equal(constraints.length, 1);
  assert.equal(constraints[0].seekerDistanceMetres, null);
});
