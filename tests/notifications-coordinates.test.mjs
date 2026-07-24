import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { notificationForGameEvent, notificationForPendingQuestion } from "../src/core/notifications.js";
import { questionLocations, googleMapsCoordinateUrl, serialiseQuestionLocations } from "../src/core/question-location.js";
import { renderQuestionLocations } from "../src/ui/question-location.js";
import { renderQuestionsView } from "../src/ui/questions-view.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../src/services/map.js", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
const modalSource = await readFile(new URL("../src/ui/modals.js", import.meta.url), "utf8");

function connectedState(team = "bravo") {
  return {
    profile: { id: `player-${team}`, name: "Player", team },
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
    connection: { mode: "connected", status: "online", roomCode: "ABC123" },
    settings: { repeatRewardMode: "multiply-both", notificationsEnabled: false },
    questions: [],
    privateTeamState: { spatialData: { features: [] } },
    ui: { view: "questions", questionCategory: "all", questionSearch: "", installPromptAvailable: false },
    location: { current: null }
  };
}

test("a remote question creates an actionable hider notification", () => {
  const notice = notificationForGameEvent({
    id: "event-1",
    type: "question",
    payload: {
      questionInstanceId: "question-1",
      questionName: "2 km radar",
      prompt: "Are you within 2 km of me?",
      locations: [{ label: "Seeker pin", text: "51.503300, -0.119500" }]
    }
  }, connectedState("bravo"));
  assert.equal(notice.title, "Question to answer");
  assert.equal(notice.actionLabel, "Answer now");
  assert.equal(notice.view, "questions");
  assert.match(notice.body, /51\.503300, -0\.119500/);
  assert.equal(notificationForGameEvent({ id: "event-1", type: "question", payload: {} }, connectedState("alpha")), null);
});

test("question coordinate helpers expose clickable Google Maps locations", () => {
  const record = {
    pinLabel: "https://www.google.com/maps?q=51.503300,-0.119500",
    deductionInput: {
      type: "thermometer",
      start: { lat: 51.5033, lng: -0.1195 },
      end: { lat: 51.5134, lng: -0.089 }
    }
  };
  const coreLocations = questionLocations(record);
  assert.equal(coreLocations.length, 2);
  assert.equal(coreLocations[0].url, googleMapsCoordinateUrl(record.deductionInput.start));
  assert.equal(coreLocations.length, 2, "the generated shared pin should not be duplicated");
  const html = renderQuestionLocations(record);
  assert.match(html, /51\.503300, -0\.119500/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /google\.com\/maps\/search/);
});

test("canonical stored question locations survive without deduction input", () => {
  const record = {
    locations: [{ label: "Seeker pin", lat: 51.5007, lng: -0.1246, text: "51.500700, -0.124600", url: "https://www.google.com/maps/search/?api=1&query=51.500700%2C-0.124600" }]
  };
  const locations = questionLocations(record);
  assert.equal(locations.length, 1);
  assert.equal(locations[0].label, "Seeker pin");
  assert.match(locations[0].url, /google\.com\/maps/);
});

test("active and completed questions visibly include their map pins", () => {
  const state = connectedState("bravo");
  state.questions = [{
    id: "question-1",
    questionId: "radar-2",
    questionName: "2 km radar",
    category: "radar",
    prompt: "Are you within 2 km of me?",
    askedAt: new Date().toISOString(),
    askedByTeam: "alpha",
    responseSeconds: 300,
    answers: ["Yes", "No"],
    deductionInput: { type: "radar", centre: { lat: 51.5033, lng: -0.1195 }, radiusMetres: 2000 },
    status: "pending"
  }];
  const pendingHtml = renderQuestionsView(state);
  assert.match(pendingHtml, /Question location/);
  assert.match(pendingHtml, /Open map/);
  state.questions[0].status = "answered";
  state.questions[0].answer = "No";
  const historyHtml = renderQuestionsView(state);
  assert.match(historyHtml, /Open pin/);
  assert.match(historyHtml, /target="_blank"/);
});

test("the app renders live alerts and can request device notifications", () => {
  assert.match(appSource, /class="game-alert/);
  assert.match(appSource, /showGameNotification/);
  assert.match(appSource, /enableDeviceNotifications/);
  assert.match(styles, /\.game-alert-region/);
  assert.match(styles, /\.game-alert\.question/);
  assert.match(workerSource, /notificationclick/);
});

test("Endgame uses strongly contrasting green, red and purple layers", () => {
  assert.match(mapSource, /#00c476/);
  assert.match(mapSource, /#da183e/);
  assert.match(mapSource, /#6d3db0/);
  assert.match(mapSource, /paletteMode: "endgame"/);
  assert.match(styles, /legend-eliminated::before[^}]*#da183e/s);
});

test("question map coordinates are always stored with the question record", () => {
  assert.doesNotMatch(appSource, /data\.deductionEnabled !== ["']on["']/);
  assert.match(modalSource, /name="deductionEnabled" value="on"/);
  assert.match(appSource, /const deductionInput = this\.questionDeductionInput/);
  assert.match(appSource, /record\.locations = serialiseQuestionLocations\(record\)/);
  assert.match(appSource, /locations: record\.locations/);
});

test("notification pop-ups survive a mixed-cache shell and include a test control", () => {
  assert.match(appSource, /notificationRegion\(\)/);
  assert.match(appSource, /document\.body\.append\(region\)/);
  assert.match(appSource, /syncPendingQuestionNotifications\(\)/);
  assert.match(appSource, /setInterval\(\(\) => this\.syncPendingQuestionNotifications\(\), 5_000\)/);
  assert.match(modalSource, /data-action="test-notification"/);
  assert.match(modalSource, /HideLine \${escapeHtml\(APP_VERSION\)}/);
});


test("persisted question locations survive clients that do not understand deduction input", () => {
  const record = {
    id: "question-explicit",
    status: "pending",
    questionName: "Street or path",
    prompt: "Is your nearest street or path the same as ours?",
    locations: [{
      key: "shared:51.501000,-0.101000",
      label: "Question pin",
      lat: 51.501,
      lng: -0.101,
      text: "51.501000, -0.101000",
      url: googleMapsCoordinateUrl({ lat: 51.501, lng: -0.101 })
    }]
  };
  const restored = questionLocations(record);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].label, "Question pin");
  assert.match(renderQuestionLocations(record), /51\.501000, -0\.101000/);
  assert.deepEqual(serialiseQuestionLocations(record), record.locations);
});

test("pending-question reconciliation includes shared coordinates even without a realtime event", () => {
  const state = connectedState("bravo");
  const record = {
    id: "question-reconciled",
    status: "pending",
    questionName: "2 km radar",
    prompt: "Are you within 2 km of me?",
    askedBy: "other-device",
    locations: [{ label: "Seeker pin", text: "51.503300, -0.119500", lat: 51.5033, lng: -0.1195, url: googleMapsCoordinateUrl({ lat: 51.5033, lng: -0.1195 }) }]
  };
  const notice = notificationForPendingQuestion(record, state);
  assert.equal(notice.tag, "question:question-reconciled");
  assert.match(notice.body, /51\.503300, -0\.119500/);
  assert.equal(notice.persistent, true);
});

test("every pin-required question offers a map picker and blank required coordinates are rejected", () => {
  assert.match(modalSource, /deductionCoordinateFields\("deductionShared", "Question pin shared with the hiders"/);
  assert.match(modalSource, /Pick coordinates from map/);
  assert.match(appSource, /Pick coordinates for \${label} before asking the question/);
  assert.match(appSource, /locations: \[\]/);
  assert.match(appSource, /record\.locations = serialiseQuestionLocations\(record\)/);
});
