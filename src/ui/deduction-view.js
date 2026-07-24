import { DEFAULT_DURATIONS, GAME_MAP_URL } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import {
  DEDUCTION_AREA_SELECTION_ALL,
  DEDUCTION_MAP_MODES,
  DEDUCTION_MOVEMENT,
  DEDUCTION_STATUS,
  constraintResolution,
  constraintTitle,
  deductionSummary,
  deriveAutomaticConstraints,
  evaluateStationPossibilities,
  evaluateZoneAreaMask,
  isMaskConstraint,
  normaliseDeductionRoundState
} from "../core/deduction.js";
import { normaliseSpatialData, spatialCategoryLabel, spatialDataStats } from "../core/spatial.js";
import { STATION_GEO_BY_ID } from "../data/station-geo.js";
import { STATIONS, STATION_BY_ID, stationNameLength } from "../data/stations.js";
import { icon } from "./icons.js";

export function buildDeductionViewModel(state) {
  const round = state.game?.round || 1;
  const storedRoundState = normaliseDeductionRoundState(state.privateTeamState?.deductionByRound?.[round]);
  const roundState = { ...storedRoundState };
  if (roundState.mapDisplayMode !== DEDUCTION_MAP_MODES.ENDGAME) {
    roundState.mapDisplayMode = DEDUCTION_MAP_MODES.ANSWER;
    roundState.areaConstraintId = DEDUCTION_AREA_SELECTION_ALL;
    roundState.maskScope = "all";
    roundState.showAreaMask = true;
    roundState.showZones = true;
  }

  const spatialData = normaliseSpatialData(state.privateTeamState?.spatialData);
  const allAutomatic = deriveAutomaticConstraints({
    questions: state.questions,
    team: state.profile.team,
    round,
    ignoredIds: []
  });
  const ignored = new Set(roundState.ignoredAutoConstraintIds || []);
  const automatic = allAutomatic.filter((constraint) => !ignored.has(constraint.id));
  const manual = (roundState.constraints || []).filter((constraint) => constraint?.enabled !== false);
  const constraints = [...automatic, ...manual];
  const mergedStations = STATIONS.map((station) => ({ ...station, ...(STATION_GEO_BY_ID.get(station.id) || {}) }));
  const results = evaluateStationPossibilities({
    stations: mergedStations,
    constraints,
    stationOverrides: roundState.stationOverrides,
    radiusMetres: DEFAULT_DURATIONS.hidingZoneRadiusMetres,
    spatialFeatures: spatialData.features
  });
  const areaConstraints = constraints.filter(isMaskConstraint);
  const answerConstraints = areaConstraints;
  const remaining = results.filter((result) => result.possible);
  const selectedCandidate = results.find((result) => result.id === roundState.endgameStationId)
    || results.find((result) => result.id === state.ui.deductionSelectedStationId)
    || remaining.find((result) => result.priority)
    || remaining[0]
    || null;
  const endgameMask = selectedCandidate
    ? evaluateZoneAreaMask({
      station: selectedCandidate,
      constraints,
      mode: "endgame",
      spatialFeatures: spatialData.features,
      cellSizeMetres: 25
    })
    : null;
  const resolutions = new Map(constraints.map((constraint) => [constraint.id, constraintResolution(constraint, { spatialFeatures: spatialData.features })]));
  return {
    round,
    roundState,
    spatialData,
    spatialStats: spatialDataStats(spatialData),
    allAutomatic,
    automatic,
    manual,
    constraints,
    areaConstraints,
    areaSelectionAll: true,
    activeAreaConstraint: null,
    answerConstraints,
    results,
    remaining,
    endgameStation: selectedCandidate,
    endgameMask,
    resolutions,
    summary: deductionSummary(results),
    isHider: Boolean(state.game && state.profile.team === state.game.hiderTeam),
    canView: state.connection.mode !== "connected" || !state.game || state.profile.team !== state.game.hiderTeam
  };
}

function renderPrivacyLocked() {
  return `<section class="card card-pad"><div class="empty-state" style="min-height:360px"><div class="empty-state-inner"><span class="empty-icon">${icon("lock")}</span><h2>Private seeker map</h2><p>The hider team cannot see the seeker team's deductions in Connected Mode.</p><button class="button button-primary" type="button" data-action="map-mode" data-mode="zone">Open my 500 m zone</button></div></div></section>`;
}

function statusLabel(result) {
  if (result.status === DEDUCTION_STATUS.PRIORITY) return "Priority";
  if (result.status === DEDUCTION_STATUS.PARTIAL) return "Partly possible";
  if (result.status === DEDUCTION_STATUS.ELIMINATED) return "Ruled out";
  return "Possible";
}

function reasonText(result) {
  if (result.failures.length) return result.failures[0];
  if (result.partials.length) return result.partials[0];
  if (result.unresolved?.length) return `${result.unresolved.length} answer${result.unresolved.length === 1 ? "" : "s"} still need map data`;
  if (result.passes.length) return `Fits ${result.passes.length} deduction${result.passes.length === 1 ? "" : "s"}`;
  return "No question has narrowed this station yet";
}

function endgameStationOptions(model) {
  return `<option value="">Choose the suspected station…</option>${model.results.map((result) => `<option value="${result.id}" ${model.endgameStation?.id === result.id ? "selected" : ""}>${escapeHtml(result.name)} — ${statusLabel(result).toLowerCase()}</option>`).join("")}`;
}

function renderMapHeader(model) {
  const endgame = model.roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ENDGAME;
  const unresolved = [...model.resolutions.values()].filter((item) => !item.ready).length;
  return `<section class="card card-pad simple-deduction-head">
    <div class="simple-deduction-summary"><div><p class="eyebrow">Round ${model.round} · seeker private</p><h2>${model.summary.remaining} of ${model.summary.total} stations remain</h2><p>${model.constraints.length ? `${model.constraints.length} answered clue${model.constraints.length === 1 ? "" : "s"} applied automatically.` : "Answer a question to start narrowing the map."}${unresolved ? ` ${unresolved} still need map data or player judgement.` : ""}</p></div><div class="simple-deduction-number"><strong>${model.summary.eliminated}</strong><span>ruled out</span></div></div>
    <div class="simple-deduction-toolbar">
      <div class="simple-map-switch inline" role="tablist" aria-label="Deduction map mode">
        <button type="button" class="${endgame ? "" : "active"}" data-action="deduction-show-all-constraints">${icon("layers")} All stations</button>
        <button type="button" class="${endgame ? "active" : ""}" data-action="deduction-map-display" data-mode="endgame">${icon("target")} Endgame</button>
      </div>
      <div class="row wrap"><button class="button button-soft button-small" type="button" data-action="deduction-undo" ${model.roundState.undoStack?.length ? "" : "disabled"}>${icon("undo")} Undo</button><a class="button button-soft button-small" href="${GAME_MAP_URL}" target="_blank" rel="noopener">${icon("external")} Official map</a></div>
    </div>
  </section>`;
}

function renderMapControls(model) {
  const endgame = model.roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ENDGAME;
  if (endgame) {
    const locked = model.constraints.filter((constraint) => constraint.movementMode === DEDUCTION_MOVEMENT.LOCKED && isMaskConstraint(constraint)).length;
    const fraction = model.endgameMask?.allowedFraction;
    const unresolved = model.endgameMask?.unresolved?.length || 0;
    const remaining = !locked ? "100%" : fraction == null || unresolved ? "Pending" : `${Math.round(fraction * 100)}%`;
    return `<div class="simple-endgame-controls"><div class="field grow"><label for="deduction-endgame-station">Endgame station</label><select id="deduction-endgame-station" data-action="deduction-endgame-station">${endgameStationOptions(model)}</select></div><div class="endgame-area-readout"><span>Approx. area left</span><strong>${remaining}</strong><small>${locked ? `${locked} fixed-spot answer${locked === 1 ? "" : "s"}` : "No endgame answers yet"}</small></div><button class="button button-soft" type="button" data-action="deduction-exit-endgame">${icon("map")} Back to all stations</button></div>`;
  }
  return `<div class="simple-overview-controls"><div class="simple-map-key"><span class="key-green"></span>Possible <span class="key-grey"></span>Excluded <span class="key-amber"></span>Needs data</div><label class="toggle-row"><input type="checkbox" data-action="deduction-show-eliminated" ${model.roundState.showEliminated ? "checked" : ""} /><span>Show ruled-out stations</span></label></div>`;
}

function renderMapExplanation(model) {
  const endgame = model.roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ENDGAME;
  if (endgame) return `<div class="callout">${icon("target")}<p><strong>Fixed hiding spot.</strong>Only the selected station's 500 m circle is shown. Answers recorded during Endgame are combined at one location.</p></div>`;
  if (!model.answerConstraints.length) return `<div class="callout warning">${icon("info")}<p><strong>No area answers yet.</strong>The station circles are ready. Ask a Radar, Thermometer, Measuring, Matching or Tentacle question to begin greying out impossible areas.</p></div>`;
  return `<div class="callout">${icon("layers")}<p><strong>Everything is combined automatically.</strong>Green survives every map-ready answer. Grey is excluded by at least one answer. Amber still needs map data or player judgement.</p></div>`;
}

function renderRemainingStations(state, model) {
  const query = String(state.ui.deductionSearch || "").trim().toLowerCase();
  const stations = model.remaining.filter((result) => !query || `${result.name} ${result.service || ""} ${result.note || ""}`.toLowerCase().includes(query));
  return `<details class="card card-pad simple-expander remaining-stations" open>
    <summary><span>${icon("station")}<span><strong>Remaining stations</strong><small>${stations.length} shown</small></span></span>${icon("chevron")}</summary>
    <div class="simple-expander-body stack">
      <div class="simple-search"><span>${icon("search")}</span><input id="deduction-search" data-action="deduction-search" type="search" value="${escapeHtml(state.ui.deductionSearch || "")}" placeholder="Search remaining stations…" aria-label="Search remaining stations" /></div>
      <div class="simple-station-list">${stations.map((result) => `<article class="simple-station-row status-${result.status}"><button type="button" class="simple-station-focus" data-action="deduction-focus-station" data-id="${result.id}"><span class="station-status-dot"></span><span><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(reasonText(result))}</small></span></button><span class="badge status-badge">${statusLabel(result)}</span><button class="button button-soft button-small" type="button" data-action="deduction-inspect-station" data-id="${result.id}" data-mode="endgame">Endgame</button></article>`).join("") || `<p class="muted">No remaining station matches the search.</p>`}</div>
    </div>
  </details>`;
}

function constraintDetails(constraint) {
  if (constraint.category) return `${spatialCategoryLabel(constraint.category)}${constraint.answerFeatureName ? ` · ${constraint.answerFeatureName}` : ""}`;
  return String(constraint.answer || "Answer recorded");
}

function renderAnswerLog(model) {
  const ignored = new Set(model.roundState.ignoredAutoConstraintIds || []);
  const items = [
    ...model.allAutomatic.map((constraint) => ({ ...constraint, auto: true, ignored: ignored.has(constraint.id) })),
    ...model.roundState.constraints.map((constraint) => ({ ...constraint, auto: false, ignored: constraint.enabled === false }))
  ];
  return `<details class="card card-pad simple-expander answer-log">
    <summary><span>${icon("questions")}<span><strong>Answers used by the map</strong><small>${items.length} linked</small></span></span>${icon("chevron")}</summary>
    <div class="simple-expander-body">
      ${items.length ? `<div class="simple-list">${items.map((constraint) => {
        const resolution = model.resolutions.get(constraint.id) || { ready: false, reason: "Ignored" };
        const status = constraint.ignored ? "Ignored" : resolution.ready ? "Mapped" : resolution.manual ? "Player review" : "Needs map data";
        return `<div class="simple-list-row ${constraint.ignored ? "muted-row" : ""}"><span><strong>${escapeHtml(constraintTitle(constraint))}</strong><small>${escapeHtml(constraintDetails(constraint))} · ${escapeHtml(status)}</small></span><button class="button button-soft button-small" type="button" data-action="${constraint.auto ? "deduction-toggle-auto" : "deduction-remove-constraint"}" data-id="${escapeHtml(constraint.id)}">${constraint.auto ? (constraint.ignored ? "Use" : "Ignore") : "Remove"}</button></div>`;
      }).join("")}</div>` : `<p class="muted">Answered questions will appear here automatically.</p>`}
    </div>
  </details>`;
}

function renderMapSetup(model) {
  const stats = model.spatialStats;
  return `<details class="card card-pad simple-expander map-setup">
    <summary><span>${icon("settings")}<span><strong>Map setup and reset</strong><small>${stats.total ? `${stats.total} imported map features` : "Only needed for POIs, boundaries and Tentacles"}</small></span></span>${icon("chevron")}</summary>
    <div class="simple-expander-body stack">
      <div class="callout">${icon("info")}<p>Radar, Thermometer, station names, transit lines and Thames-side questions work immediately. Tentacles and POI/boundary questions need the Google My Maps KML/KMZ imported once.</p></div>
      <form class="stack" data-form="spatial-data-import"><div class="field"><label for="spatial-data-file">Game map KML, KMZ or GeoJSON</label><input id="spatial-data-file" name="spatialDataFile" type="file" accept=".kml,.kmz,.geojson,.json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" required /></div><div class="row wrap"><button class="button button-primary button-small" type="submit">${icon("uploadCloud")} Import map data</button><button class="button button-soft button-small" type="button" data-action="spatial-data-load-configured">${icon("download")} Try public map</button>${stats.total ? `<button class="button button-soft button-small" type="button" data-action="spatial-data-clear">Clear imported data</button>` : ""}</div></form>
      <div class="divider"></div><button class="button button-danger button-small" type="button" data-action="deduction-reset">${icon("refresh")} Reset this round's deductions</button>
    </div>
  </details>`;
}

export function renderDeductionView(state) {
  const model = buildDeductionViewModel(state);
  if (!model.canView) return renderPrivacyLocked();
  const endgame = model.roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ENDGAME;
  return `<div class="view-stack simple-deduction-view">
    ${renderMapHeader(model)}
    <section class="card card-pad stack simple-deduction-map-card">
      ${renderMapControls(model)}
      <div class="map-shell deduction-map-shell"><div id="deduction-map" role="application" aria-label="Live deduction map"></div><div class="deduction-legend" aria-label="Map legend"><span class="legend-possible">${endgame ? "Remaining endgame area" : "Possible area"}</span><span class="legend-partial">Needs data</span><span class="legend-eliminated">Excluded area</span></div></div>
      ${renderMapExplanation(model)}
      <p class="tiny muted">The grey/green cells are a planning aid clipped to each 500 m circle. Use the official game map for borderline paths and entrances.</p>
    </section>
    ${renderRemainingStations(state, model)}
    ${renderAnswerLog(model)}
    ${renderMapSetup(model)}
  </div>`;
}

export function deductionStationDetail(result) {
  const station = STATION_BY_ID.get(result.id);
  return { title: station?.name || result.name, nameLength: stationNameLength(station?.name || result.name), reason: reasonText(result), status: statusLabel(result) };
}
