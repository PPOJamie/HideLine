import test from "node:test";
import assert from "node:assert/strict";
import { renderDeductionView } from "../src/ui/deduction-view.js";

function stateFor(mode) {
  return {
    game: { round: 1, phase: "seeking", hiderTeam: "bravo" },
    profile: { team: "alpha" },
    connection: { mode: "local" },
    privateTeamState: {
      deductionByRound: {
        1: {
          constraints: [{
            id: "manual-radar",
            type: "radar",
            movementMode: "mobile",
            centre: { lat: 51.5, lng: -0.1 },
            radiusMetres: 1000,
            answer: "yes"
          }],
          mapDisplayMode: mode,
          areaConstraintId: "all",
          showAreaMask: true,
          showEliminated: true,
          showZones: true,
          maskScope: "all"
        }
      },
      spatialData: { version: 1, sourceName: "No map data imported", importedAt: null, features: [] }
    },
    questions: [],
    ui: { deductionTool: "radar", deductionSearch: "", deductionSelectedStationId: null },
    location: { current: null }
  };
}

test("Answer Areas defaults to an all-linked-answer overlay", () => {
  const html = renderDeductionView(stateFor("answer"));
  assert.match(html, /All linked answers — combined overlay/);
  assert.match(html, /data-action="deduction-show-all-constraints"/);
  assert.match(html, /All exclusions at once\./);
});

test("Endgame view provides an explicit route back to all station circles", () => {
  const html = renderDeductionView(stateFor("endgame"));
  assert.match(html, /data-action="deduction-exit-endgame"/);
  assert.match(html, />[^<]*Show all circles</);
});
