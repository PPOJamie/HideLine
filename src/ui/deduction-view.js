import { DEFAULT_DURATIONS, GAME_MAP_URL } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import {
  DEDUCTION_AREA_SELECTION_ALL,
  DEDUCTION_MAP_MODES,
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
import { clipWaterDataToGameBoundary, mergeSpatialData, normaliseSpatialData, spatialCategoryLabel, spatialDataStats } from "../core/spatial.js";
import { resolveAuthoritativeStations } from "../core/station-authority.js";
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

  const importedSpatialData = normaliseSpatialData(state.privateTeamState?.spatialData);
  const officialBoundaries = (state.officialMapData?.features || []).filter((feature) => feature?.category === "game_boundary");
  const clippingBoundaries = officialBoundaries.length
    ? officialBoundaries
    : importedSpatialData.features.filter((feature) => feature?.category === "game_boundary");
  const effectiveWaterData = clipWaterDataToGameBoundary(
    state.waterData,
    clippingBoundaries
  );
  const spatialData = mergeSpatialData(importedSpatialData, state.referenceData, effectiveWaterData, state.officialMapData);
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
  const stationAuthority = resolveAuthoritativeStations(STATIONS, spatialData.features);
  const mergedStations = stationAuthority.stations;
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
      stationGeos: mergedStations,
      cellSizeMetres: 25
    })
    : null;
  const endgameHistoryMask = selectedCandidate
    ? evaluateZoneAreaMask({
      station: selectedCandidate,
      constraints,
      mode: "history",
      spatialFeatures: spatialData.features,
      stationGeos: mergedStations,
      cellSizeMetres: 25
    })
    : null;
  const resolutions = new Map(constraints.map((constraint) => [constraint.id, constraintResolution(constraint, { spatialFeatures: spatialData.features, stationGeos: mergedStations })]));
  return {
    round,
    roundState,
    spatialData,
    importedSpatialData,
    referenceData: state.referenceData || { status: "idle", features: [], sources: [] },
    officialMapData: state.officialMapData || { status: "idle", features: [] },
    waterData: effectiveWaterData,
    stationAuthority: stationAuthority.diagnostics,
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
    endgameHistoryMask,
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

function percentLabel(fraction, unresolved = 0) {
  if (unresolved) return "Pending";
  if (fraction == null) return "—";
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}

function renderMapControls(model) {
  const endgame = model.roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ENDGAME;
  if (endgame) {
    const stationEliminated = model.endgameStation?.status === DEDUCTION_STATUS.ELIMINATED;
    const currentUnresolved = model.endgameMask?.unresolved?.length || 0;
    const historyUnresolved = model.endgameHistoryMask?.unresolved?.length || 0;
    const currentArea = stationEliminated ? "0%" : percentLabel(model.endgameMask?.allowedFraction, currentUnresolved);
    const historyCount = model.endgameHistoryMask?.constraintCount || 0;
    const historyOverlap = historyCount ? percentLabel(model.endgameHistoryMask?.allowedFraction, historyUnresolved) : "None yet";
    const stationStatus = model.endgameStation ? statusLabel(model.endgameStation) : "Choose a station";
    return `<div class="simple-endgame-controls"><div class="field grow"><label for="deduction-endgame-station">Endgame station</label><select id="deduction-endgame-station" data-action="deduction-endgame-station">${endgameStationOptions(model)}</select><small class="endgame-station-status status-${escapeHtml(model.endgameStation?.status || "possible")}">All-stations result: ${escapeHtml(stationStatus)}</small></div><div class="endgame-area-readout"><span>Current area in play</span><strong>${currentArea}</strong><small>Earlier-clue overlap: ${historyOverlap}${historyCount ? ` · ${historyCount} clue${historyCount === 1 ? "" : "s"}` : ""}</small></div><button class="button button-soft" type="button" data-action="deduction-exit-endgame">${icon("map")} Back to all stations</button></div>`;
  }
  return `<div class="simple-overview-controls"><div class="simple-map-key"><span class="key-green"></span>Possible <span class="key-grey"></span>Excluded <span class="key-amber"></span>Needs data</div><label class="toggle-row"><input type="checkbox" data-action="deduction-show-eliminated" ${model.roundState.showEliminated ? "checked" : ""} /><span>Show ruled-out stations</span></label></div>`;
}

function renderMapExplanation(model) {
  const endgame = model.roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ENDGAME;
  if (endgame) {
    const station = model.endgameStation;
    const earlier = model.endgameHistoryMask?.constraintCount || 0;
    const overlap = model.endgameHistoryMask?.allowedFraction;
    const stationEliminated = station?.status === DEDUCTION_STATUS.ELIMINATED;
    const hardExcluded = Number(model.endgameMask?.excluded || 0) > 0;
    const carried = Number(model.endgameMask?.carriedStationExclusionCount || 0);
    if (stationEliminated) {
      const reason = station?.failures?.[0] || model.endgameMask?.carriedStationExclusions?.[0] || "an earlier answer rules out the station";
      return `<div class="callout danger">${icon("target")}<p><strong>This station is already ruled out.</strong> The entire circle is red because ${escapeHtml(reason)}. This now matches the result on the All stations map.</p></div>`;
    }
    const overlapText = earlier
      ? overlap === 0
        ? " The earlier clues do not overlap at one single point, which can still be valid because the hider was allowed to move between answers."
        : " The blue area is where every earlier location clue overlaps at one point; it is a planning hint, not a hard final-position rule."
      : "";
    if (!hardExcluded && !carried) {
      return `<div class="callout">${icon("info")}<p><strong>The whole green circle is currently in play.</strong> The All stations result has been carried across: this station still survives every earlier answer.${overlapText} New answers recorded during Endgame will create hard red exclusions.</p></div>`;
    }
    return `<div class="callout">${icon("target")}<p><strong>Green is in play now; red is ruled out now.</strong> Station facts, station-wide eliminations and answers recorded after Endgame began form the hard red mask.${overlapText}</p></div>`;
  }
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
  const importedCount = model.importedSpatialData?.features?.length || 0;
  const reference = model.referenceData || {};
  const official = model.officialMapData || {};
  const water = model.waterData || {};
  const adminCount = reference.features?.length || 0;
  const officialFeatureCount = official.features?.length || 0;
  const officialBoundaryCount = (official.features || []).filter((feature) => feature.category === "game_boundary").length;
  const waterFeatures = (water.features || []).filter((feature) => feature.category === "water");
  const waterCount = waterFeatures.length;
  const sourceWaterCount = Number.isFinite(Number(water.sourceFeatureCount)) ? Number(water.sourceFeatureCount) : waterCount;
  const exactWaterCount = waterFeatures.filter((feature) => feature.properties?.quality === "mapped-edge").length;
  const derivedWaterCount = waterFeatures.filter((feature) => feature.properties?.quality === "width-derived-fallback").length;
  const stationAuthority = model.stationAuthority || {};
  const boundarySourceStatus = (reference.sources || []).length
    ? `<div class="boundary-source-list">${reference.sources.map((source) => `<span class="boundary-source-status status-${source.status === "ready" ? "ready" : "error"}"><strong>${escapeHtml(source.label)}</strong><small>${source.status === "ready" ? `${source.count} polygons ready${source.format ? ` · ${escapeHtml(source.format)}` : ""}` : "Unavailable"}</small></span>`).join("")}</div>`
    : "";
  const mapReady = official.status === "ready" && officialBoundaryCount && stationAuthority.matchedCount;
  const waterReady = water.status === "ready" && water.clippedToGameBoundary && waterCount;
  return `<details class="card card-pad simple-expander map-setup">
    <summary><span>${icon("settings")}<span><strong>Map data and reset</strong><small>${stationAuthority.matchedCount || 0}/100 official station pins · ${waterCount} in-area water edges</small></span></span>${icon("chevron")}</summary>
    <div class="simple-expander-body stack">
      <div class="map-data-status-grid">
        <div><span>Official game map</span><strong>${official.status === "loading" ? "Loading…" : mapReady ? "Ready" : "Needs attention"}</strong><small>${officialFeatureCount ? `${officialFeatureCount} features · ${stationAuthority.matchedCount || 0} station circles use official pins${officialBoundaryCount ? " · exact red boundary active" : ""}.` : "HideLine has not loaded the deployed Google My Maps snapshot yet."}</small></div>
        <div><span>Named water edges</span><strong>${water.status === "loading" ? "Loading…" : waterReady ? `${waterCount} in game area` : water.status === "ready" && !water.clippedToGameBoundary ? "Waiting for boundary" : "Unavailable"}</strong><small>${waterReady ? `${sourceWaterCount} source feature${sourceWaterCount === 1 ? "" : "s"} checked · ${exactWaterCount} mapped bank/shoreline feature${exactWaterCount === 1 ? "" : "s"} remain after clipping to ${escapeHtml(water.gameBoundarySource || "the official red boundary")}${derivedWaterCount ? ` · ${derivedWaterCount} width-derived fallback${derivedWaterCount === 1 ? "" : "s"}` : ""}.` : water.clipReason ? escapeHtml(water.clipReason) : "Body of Water shading is disabled until real line or polygon geometry loads."}</small></div>
        <div><span>Official administration layers</span><strong>${reference.status === "loading" ? "Loading…" : adminCount ? `${adminCount} ready` : "Unavailable"}</strong><small>London boroughs, electoral wards and parliamentary constituencies use fixed official boundary services.</small></div>
        <div><span>Manual imported map</span><strong>${importedCount ? `${importedCount} features` : "None"}</strong><small>An imported KML/KMZ can supplement missing POIs and remains private to the seeker team. The supplied official boundary and Hiding Stations pins keep priority.</small></div>
      </div>
      ${boundarySourceStatus}
      ${official.error ? `<div class="callout warning">${icon("alert")}<p><strong>Official game map:</strong> ${escapeHtml(official.error)}</p></div>` : ""}
      ${water.error ? `<div class="callout warning">${icon("alert")}<p><strong>Water edges:</strong> ${escapeHtml(water.error)}</p></div>` : ""}
      ${water.status === "ready" && !water.clippedToGameBoundary ? `<div class="callout warning">${icon("alert")}<p><strong>Water calculations are waiting for the official red Game Area boundary.</strong> HideLine deliberately excludes all water until it can enforce the handbook rule that features outside the Game Area do not exist for Matching and Measuring.</p></div>` : ""}
      ${reference.error ? `<div class="callout warning">${icon("alert")}<p>${escapeHtml(reference.error)}</p></div>` : ""}
      ${stationAuthority.fallbackCount ? `<div class="callout warning">${icon("alert")}<p><strong>${stationAuthority.fallbackCount} station circle${stationAuthority.fallbackCount === 1 ? "" : "s"} still use fallback coordinates.</strong> Refresh or import the official KML before relying on borderline circle positions.${stationAuthority.unmatchedStationIds?.length ? ` Unmatched: ${escapeHtml(stationAuthority.unmatchedStationIds.slice(0, 12).map((id) => STATION_BY_ID.get(id)?.name || id).join(", "))}${stationAuthority.unmatchedStationIds.length > 12 ? "…" : ""}.` : ""}</p></div>` : `<div class="callout success">${icon("check")}<p><strong>All 100 hiding circles are centred on the supplied game-map station pins.</strong>${Number.isFinite(stationAuthority.maximumFallbackOffsetMetres) ? ` The largest correction from the old fallback centres was ${Math.round(stationAuthority.maximumFallbackOffsetMetres)} m.` : ""}</p></div>`}
      <div class="row wrap"><button class="button button-soft button-small" type="button" data-action="official-map-refresh">${icon("refresh")} Refresh official game map</button><button class="button button-soft button-small" type="button" data-action="water-data-refresh">${icon("refresh")} Refresh water geometry</button><button class="button button-soft button-small" type="button" data-action="reference-data-refresh">${icon("refresh")} Retry administrative boundaries</button></div>
      <form class="stack" data-form="spatial-data-import"><div class="field"><label for="spatial-data-file">Updated game map KML, KMZ or GeoJSON</label><input id="spatial-data-file" name="spatialDataFile" type="file" accept=".kml,.kmz,.geojson,.json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" required /></div><div class="row wrap"><button class="button button-primary button-small" type="submit">${icon("uploadCloud")} Import updated map</button>${importedCount ? `<button class="button button-soft button-small" type="button" data-action="spatial-data-clear">Clear manual import</button>` : ""}</div></form>
      <div class="callout">${icon("info")}<p>The red boundary and 500 m circle centres now come from the supplied Google My Map. Body of Water calculations use named OpenStreetMap water-edge geometry that is generated during deployment and cached for game day. The old hand-drawn water atlas is no longer used.</p></div>
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
      <div class="map-shell deduction-map-shell"><div id="deduction-map" role="application" aria-label="Live deduction map"></div><div class="deduction-legend ${endgame ? "endgame-legend" : ""}" aria-label="Map legend"><span class="legend-possible">${endgame ? "In play now" : "Possible area"}</span><span class="legend-eliminated">${endgame ? "Ruled out now" : "Excluded area"}</span>${endgame ? `<span class="legend-history">Earlier-clue overlap</span>` : ""}<span class="legend-partial">Needs data</span></div></div>
      ${renderMapExplanation(model)}
      <p class="tiny muted">${endgame ? "The pale green circle is the current fixed-spot search area. Red is a hard exclusion. Blue only highlights where all earlier movable clues overlap, so it never hides the current green/red answer. " : ""}The cells are a planning aid clipped to each 500 m circle. Use the official game map for borderline paths and entrances.</p>
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
