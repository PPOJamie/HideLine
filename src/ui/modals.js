import { DEFAULT_DURATIONS, PHASES, TEAM_LABELS } from "../core/constants.js";
import { escapeHtml, formatDateTime } from "../core/format.js";
import { QUESTION_BY_ID, repeatedReward } from "../data/questions.js";
import { CARD_TYPES } from "../data/rules.js";
import { STATIONS, STATION_BY_ID } from "../data/stations.js";
import { RAIL_LINES } from "../data/station-geo.js";
import { questionDeductionConfig, questionDeductionKind } from "../data/question-deduction.js";
import { spatialCategoryLabel } from "../core/spatial.js";
import { icon } from "./icons.js";

function frame(title, subtitle, body, actions = "") {
  return `
    <div class="modal-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="close-button" type="button" data-action="close-modal" aria-label="Close">${icon("close")}</button></div>
    <div class="modal-body">${body}</div>
    ${actions ? `<div class="modal-actions">${actions}</div>` : ""}
  `;
}

export function renderModal(name, state, context = {}) {
  switch (name) {
    case "profile": return profileModal(state);
    case "new-game": return newGameModal(state);
    case "join-game": return joinGameModal(state);
    case "settings": return settingsModal(state);
    case "start-round": return startRoundModal(state);
    case "game-settings": return gameSettingsModal(state);
    case "pause": return pauseModal(state);
    case "transit-start": return transitModal(state, true);
    case "transit-end": return transitModal(state, false);
    case "score-adjustment": return scoreAdjustmentModal(state);
    case "add-card": return addCardModal(state);
    case "add-trap": return addTrapModal(state);
    case "ask-question": return askQuestionModal(state, context.questionId);
    case "custom-answer": return customAnswerModal(state, context.questionInstanceId);
    case "photo-answer": return photoAnswerModal(state, context.questionInstanceId);
    case "evidence-loading": return evidenceLoadingModal(context);
    case "evidence-preview": return evidencePreviewModal(context);
    case "mark-found": return markFoundModal(state);
    default: return frame("HideLine", "", `<p class="muted">Nothing to configure here.</p>`);
  }
}

function profileModal(state) {
  return frame("Your profile", "This name and team appear to other room members in Connected Mode.", `
    <form class="stack" data-form="profile">
      <div class="field"><label for="profile-name">Display name</label><input id="profile-name" name="name" maxlength="40" required value="${escapeHtml(state.profile.name)}" autocomplete="name" /></div>
      <div class="field"><label for="profile-team">Team</label><select id="profile-team" name="team"><option value="alpha" ${state.profile.team === "alpha" ? "selected" : ""}>Team Alpha</option><option value="bravo" ${state.profile.team === "bravo" ? "selected" : ""}>Team Bravo</option></select><span class="field-hint">Changing team in a connected game updates your membership and private team state access.</span></div>
      <button class="button button-primary" type="submit">${icon("check")} Save profile</button>
    </form>
  `);
}

function connectionFields(state) {
  return `
    <div class="field"><label for="supabase-url">Supabase project URL</label><input id="supabase-url" name="supabaseUrl" type="url" inputmode="url" placeholder="https://your-project.supabase.co" value="${escapeHtml(state.connection.supabaseUrl || "")}" /></div>
    <div class="field"><label for="supabase-key">Supabase anon key</label><textarea id="supabase-key" name="supabaseAnonKey" rows="3" placeholder="eyJ...">${escapeHtml(state.connection.supabaseAnonKey || "")}</textarea><span class="field-hint">The anon key is public by design. The included Row Level Security migration protects room data.</span></div>
  `;
}

function newGameModal(state) {
  return frame("Create a game", "Start instantly on one device or create a live room for team-mates and opponents.", `
    <form class="stack" data-form="new-game">
      <div class="field"><label for="game-name">Game name</label><input id="game-name" name="gameName" maxlength="60" required value="London Hide + Seek" /></div>
      <div class="field"><span class="field-label">Mode</span><label class="checkbox-row"><input type="radio" name="mode" value="local" checked /><span><strong>Local Mode</strong><br><span class="field-hint">Works immediately and offline; state stays on this device.</span></span></label><label class="checkbox-row"><input type="radio" name="mode" value="connected" /><span><strong>Connected Mode</strong><br><span class="field-hint">Creates a room code with Supabase real-time sync.</span></span></label></div>
      <div class="callout">${icon("link")}<p><strong>Connected Mode setup</strong>If the URL/key below are blank, use Settings after deploying the included Supabase migration.</p></div>
      ${connectionFields(state)}
      <button class="button button-primary" type="submit">${icon("play")} Create game</button>
    </form>
  `);
}

function joinGameModal(state) {
  const queryCode = new URLSearchParams(location.search).get("join") || "";
  return frame("Join a connected game", "Enter the six-character room code shared by the host.", `
    <form class="stack" data-form="join-game">
      <div class="field"><label for="join-code">Room code</label><input id="join-code" name="code" class="mono" maxlength="8" required value="${escapeHtml(queryCode.toUpperCase())}" placeholder="AB12CD" autocapitalize="characters" /></div>
      <div class="field"><label for="join-team">Join team</label><select id="join-team" name="team"><option value="alpha" ${state.profile.team === "alpha" ? "selected" : ""}>Team Alpha</option><option value="bravo" ${state.profile.team === "bravo" ? "selected" : ""}>Team Bravo</option></select></div>
      ${connectionFields(state)}
      <button class="button button-primary" type="submit">${icon("link")} Join room</button>
    </form>
  `);
}

function settingsModal(state) {
  return frame("App settings", "Configure live sync, repeat-question rewards and privacy defaults.", `
    <form class="stack" data-form="settings">
      ${connectionFields(state)}
      <div class="divider"></div>
      <div class="field"><label for="repeat-mode">Repeated-question reward display</label><select id="repeat-mode" name="repeatRewardMode"><option value="multiply-both" ${state.settings.repeatRewardMode === "multiply-both" ? "selected" : ""}>Multiply draw and keep</option><option value="draw-only" ${state.settings.repeatRewardMode === "draw-only" ? "selected" : ""}>Multiply draw only</option><option value="manual" ${state.settings.repeatRewardMode === "manual" ? "selected" : ""}>Show multiplier; resolve manually</option></select><span class="field-hint">The handbook says repeated questions pay x2, x3, and so on. Choose how your physical deck interprets that cost.</span></div>
      <div class="field"><label for="safety-contact">Emergency / organiser contact</label><input id="safety-contact" name="safetyContact" value="${escapeHtml(state.settings.safetyContact || "")}" placeholder="Name or phone number" /></div>
      <label class="checkbox-row"><input type="checkbox" name="rememberConnection" checked /><span>Store the Supabase URL and anon key in this browser.</span></label>
      <button class="button button-primary" type="submit">${icon("check")} Save settings</button>
      <button class="button button-soft" type="button" data-action="export-game">${icon("download")} Export current game JSON</button>
      <button class="button button-danger" type="button" data-action="reset-app">${icon("trash")} Reset local app data</button>
    </form>
  `);
}

function startRoundModal(state) {
  const game = state.game;
  const now = new Date();
  now.setSeconds(0, 0);
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return frame(`Start round ${game?.round || 1}`, "Choose the hiding team and start time. The default release is 45 minutes later.", `
    <form class="stack" data-form="start-round">
      <div class="field"><label for="hider-team">Hiding team</label><select id="hider-team" name="hiderTeam"><option value="alpha" ${game?.hiderTeam === "alpha" ? "selected" : ""}>${escapeHtml(game?.teams?.alpha?.name || TEAM_LABELS.alpha)}</option><option value="bravo" ${game?.hiderTeam === "bravo" ? "selected" : ""}>${escapeHtml(game?.teams?.bravo?.name || TEAM_LABELS.bravo)}</option></select></div>
      <div class="field"><label for="round-start">Round start</label><input id="round-start" name="roundStart" type="datetime-local" value="${localDate}" required /><span class="field-hint">Use now, or enter a mutually agreed start time.</span></div>
      <div class="field-row"><div class="field"><label for="hide-minutes">Hiding period</label><input id="hide-minutes" name="hidingMinutes" type="number" min="1" value="45" /></div><div class="field"><label for="cutoff-minutes">Total round cutoff</label><input id="cutoff-minutes" name="cutoffMinutes" type="number" min="46" value="285" /></div></div>
      <div class="callout warning">${icon("alert")}<p>At release, hiders must be inside a valid 500 m station-centred zone. Being in transit triggers a pause, backtrack and −30 minute penalty.</p></div>
      <button class="button button-primary" type="submit">${icon("play")} Start round</button>
    </form>
  `);
}

function gameSettingsModal(state) {
  const game = state.game;
  return frame("Game settings", "Rename teams, move the hider role or leave/reset this board.", `
    <form class="stack" data-form="game-settings">
      <div class="field"><label for="edit-game-name">Game name</label><input id="edit-game-name" name="gameName" maxlength="60" value="${escapeHtml(game?.name || "")}" /></div>
      <div class="field-row"><div class="field"><label for="alpha-name">Team Alpha name</label><input id="alpha-name" name="alphaName" maxlength="30" value="${escapeHtml(game?.teams?.alpha?.name || "Team Alpha")}" /></div><div class="field"><label for="bravo-name">Team Bravo name</label><input id="bravo-name" name="bravoName" maxlength="30" value="${escapeHtml(game?.teams?.bravo?.name || "Team Bravo")}" /></div></div>
      <div class="field"><label for="edit-hider-team">Current hiding team</label><select id="edit-hider-team" name="hiderTeam"><option value="alpha" ${game?.hiderTeam === "alpha" ? "selected" : ""}>Alpha</option><option value="bravo" ${game?.hiderTeam === "bravo" ? "selected" : ""}>Bravo</option></select></div>
      <button class="button button-primary" type="submit">${icon("check")} Save game</button>
      <div class="divider"></div>
      <button class="button button-soft" type="button" data-action="leave-game">${icon("external")} Leave game on this device</button>
    </form>
  `);
}

function pauseModal() {
  return frame("Pause the game", "All active round timing stops until the pause is resumed.", `
    <form class="stack" data-form="pause-game">
      <div class="field"><label for="pause-reason">Reason</label><select id="pause-reason" name="reason"><option>Question answer overdue</option><option>Photo movement protection</option><option>Hiders backtracking to a valid zone</option><option>Transport disruption / force majeure</option><option>Rule clarification</option><option>Safety issue</option><option>Other</option></select></div>
      <div class="field"><label for="pause-note">Note</label><textarea id="pause-note" name="note" maxlength="300" placeholder="What should both teams know?"></textarea></div>
      <button class="button button-primary" type="submit">${icon("pause")} Start pause</button>
    </form>
  `);
}

function transitModal(state, starting) {
  const transit = state.game?.transit?.[state.profile.team] || {};
  return frame(starting ? "Boarding a train" : "Leaving the train", starting ? "Share this before moving, while signal is reliable." : "Send this as soon as your team is off transit.", `
    <form class="stack" data-form="${starting ? "transit-start" : "transit-end"}">
      <div class="field"><label for="transit-station">${starting ? "Starting station" : "Exit station"}</label><input id="transit-station" name="station" maxlength="80" required value="${escapeHtml(starting ? "" : transit.station || "")}" placeholder="e.g. Waterloo" /></div>
      ${starting ? `<div class="field"><label for="transit-line">Line / intended service</label><input id="transit-line" name="line" maxlength="100" placeholder="e.g. Jubilee line toward Stratford" /></div>` : ""}
      <div class="field"><label for="transit-note">Optional note</label><textarea id="transit-note" name="note" maxlength="240" placeholder="Stops, branch, signal expectations..."></textarea></div>
      <label class="checkbox-row"><input type="checkbox" name="includeLocation" checked /><span>Take and share a current location reading with this event.</span></label>
      <button class="button button-primary" type="submit">${icon(starting ? "train" : "stop")} ${starting ? "Share boarding intent" : "Share that I am off"}</button>
    </form>
  `);
}

function scoreAdjustmentModal() {
  return frame("Add score adjustment", "Use negative time for penalties. Percentages are entered as points, such as 25 for +25%.", `
    <form class="stack" data-form="score-adjustment">
      <div class="field"><label for="adjust-kind">Type</label><select id="adjust-kind" name="kind"><option value="trap">Activated time trap</option><option value="percentage">Percentage bonus</option><option value="time">Time bonus</option><option value="curse">Curse extra time</option><option value="cure">Curse cure</option><option value="other">Other adjustment / penalty</option></select></div>
      <div class="field"><label for="adjust-label">Label</label><input id="adjust-label" name="label" maxlength="80" placeholder="e.g. Invalid zone penalty" /></div>
      <div class="field-row"><div class="field"><label for="adjust-hours">Hours</label><input id="adjust-hours" name="hours" type="number" value="0" /></div><div class="field"><label for="adjust-minutes">Minutes</label><input id="adjust-minutes" name="minutes" type="number" value="0" /></div></div>
      <div class="field-row"><div class="field"><label for="adjust-seconds">Seconds</label><input id="adjust-seconds" name="seconds" type="number" value="0" /></div><div class="field"><label for="adjust-percent">Percentage points</label><input id="adjust-percent" name="percent" type="number" step="0.1" value="0" /></div></div>
      <div class="callout">${icon("info")}<p>For the standard invalid-zone penalty, choose Other and enter −30 minutes. For a curse cure, choose Curse cure and enter +45 minutes.</p></div>
      <button class="button button-primary" type="submit">${icon("plus")} Add adjustment</button>
    </form>
  `);
}

function addCardModal(state) {
  return frame("Add a hider card", `Current hand ${state.privateTeamState.cards?.length || 0} / ${state.privateTeamState.handLimit || 6}.`, `
    <form class="stack" data-form="add-card">
      <div class="field"><label for="card-type">Card type</label><select id="card-type" name="type">${CARD_TYPES.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="card-name">Card name</label><input id="card-name" name="name" maxlength="80" required placeholder="e.g. Veto" /></div>
      <div class="field"><label for="card-note">Effect / value</label><textarea id="card-note" name="note" maxlength="400" placeholder="Record enough detail to resolve it accurately."></textarea></div>
      <div class="field"><label for="hand-limit">Hand limit after this card</label><input id="hand-limit" name="handLimit" type="number" min="1" max="20" value="${state.privateTeamState.handLimit || 6}" /></div>
      <button class="button button-primary" type="submit">${icon("card")} Add to hand</button>
    </form>
  `);
}

function addTrapModal() {
  return frame("Place a time trap", "The placement timestamp is created when you submit this form.", `
    <form class="stack" data-form="add-trap">
      <div class="field"><label for="trap-station">Trapped station</label><input id="trap-station" name="station" list="station-names" required placeholder="Station name" /><datalist id="station-names">${STATIONS.map((station) => `<option value="${escapeHtml(station.name)}"></option>`).join("")}</datalist></div>
      <div class="field"><label for="trap-note">Card rule / cap</label><textarea id="trap-note" name="note" maxlength="300" placeholder="Optional: how earned time is converted or capped."></textarea></div>
      <button class="button button-primary" type="submit">${icon("trap")} Record placement now</button>
    </form>
  `);
}

function deductionCoordinateFields(prefix, label, current = null) {
  const lat = current?.lat != null ? Number(current.lat).toFixed(6) : "";
  const lng = current?.lng != null ? Number(current.lng).toFixed(6) : "";
  return `
    <fieldset class="coordinate-pair compact-coordinate-pair">
      <legend>${escapeHtml(label)}</legend>
      <div class="field-row"><div class="field"><label for="${prefix}-lat">Latitude</label><input id="${prefix}-lat" name="${prefix}Lat" type="number" inputmode="decimal" step="any" min="-90" max="90" value="${lat}" /></div><div class="field"><label for="${prefix}-lng">Longitude</label><input id="${prefix}-lng" name="${prefix}Lng" type="number" inputmode="decimal" step="any" min="-180" max="180" value="${lng}" /></div></div>
      <button class="button button-soft button-small" type="button" data-action="deduction-fill-gps" data-prefix="${prefix}">${icon("location")} Use current GPS</button>
    </fieldset>`;
}

function deductionMovementSelect(state) {
  const locked = state.game?.phase === PHASES.ENDGAME;
  return `<div class="field"><label for="deduction-movement">Movement rule for this answer</label><select id="deduction-movement" name="deductionMovementMode"><option value="mobile" ${locked ? "" : "selected"}>Before endgame — hider may move within the zone</option><option value="locked" ${locked ? "selected" : ""}>Endgame — fixed hiding spot</option></select></div>`;
}

function deductionLineOptions() {
  const groups = new Map();
  for (const line of RAIL_LINES) {
    if (!groups.has(line.group)) groups.set(line.group, []);
    groups.get(line.group).push(line);
  }
  return `<option value="">Choose a line or operator…</option>${[...groups.entries()].map(([group, lines]) => `<optgroup label="${escapeHtml(group)}">${lines.map((line) => `<option value="${line.id}">${escapeHtml(line.name)}</option>`).join("")}</optgroup>`).join("")}`;
}

function questionDeductionFields(state, question) {
  const current = state.location?.current || null;
  const config = questionDeductionConfig(question);
  const importedFeatures = state.privateTeamState?.spatialData?.features || [];
  const categoryCount = config.category ? importedFeatures.filter((feature) => feature.category === config.category).length : 0;
  let fields = "";
  let badge = config.mode === "automatic" ? "Automatic area" : "Guided map review";

  if (config.mode === "guided") {
    fields = `
      <div class="callout warning">${icon("info")}<p><strong>Linked, not guessed.</strong>${escapeHtml(config.reason || "This answer needs seeker judgement.")} The answer will appear in the Deduction Map audit trail, where you can link a manual circle or polygon without using banned AI or reverse-image tools.</p></div>
      ${deductionMovementSelect(state)}`;
  } else if (question.category === "radar") {
    fields = `${deductionCoordinateFields("deductionCentre", "Seeker radar pin", current)}${deductionMovementSelect(state)}`;
  } else if (question.category === "thermometer") {
    fields = `${deductionCoordinateFields("deductionStart", "Position before travelling")}${deductionCoordinateFields("deductionEnd", "Position after travelling", current)}${deductionMovementSelect(state)}`;
  } else if (question.id === "matching-station-name") {
    fields = `<div class="field"><label for="deduction-seeker-station">Seeker station</label><select id="deduction-seeker-station" name="deductionSeekerStationId"><option value="">Choose the definitive handbook name…</option>${STATIONS.map((station) => `<option value="${station.id}">${escapeHtml(station.name)}${station.note ? ` — ${escapeHtml(station.note)}` : ""}</option>`).join("")}</select></div>`;
  } else if (question.id === "matching-rail-line") {
    fields = `<div class="field"><label for="deduction-line">Line / operator preset</label><select id="deduction-line" name="deductionLineId">${deductionLineOptions()}</select></div><div class="field"><label for="deduction-stops">Exact stops in the game area (recommended when branches differ)</label><select id="deduction-stops" name="deductionStationIds" multiple size="7">${STATIONS.map((station) => `<option value="${station.id}">${escapeHtml(station.name)}${station.note ? ` — ${escapeHtml(station.note)}` : ""}</option>`).join("")}</select><span class="field-hint">Exact stops override the preset and make the filter match the particular train you are riding.</span></div>`;
  } else if (question.id === "matching-landmass") {
    fields = `<div class="field"><label for="deduction-thames-side">Seeker position</label><select id="deduction-thames-side" name="deductionSeekerSide"><option value="north">North of the Thames</option><option value="south">South of the Thames</option><option value="both">On a bridge / in a tunnel</option></select></div>${deductionMovementSelect(state)}`;
  } else if (config.requiresSeekerPoint) {
    const dataMessage = config.category
      ? `<div class="callout ${categoryCount ? "" : "warning"}">${icon(categoryCount ? "check" : "info")}<p><strong>${categoryCount ? `${categoryCount} imported features ready.` : "Map layer needed."}</strong>${categoryCount ? `HideLine will use the imported ${escapeHtml(spatialCategoryLabel(config.category).toLowerCase())} layer.` : `The answer is still linked now, but it will remain unresolved until the authoritative ${escapeHtml(config.dataLabel || spatialCategoryLabel(config.category).toLowerCase())} layer is imported on the Deduction Map.`}</p></div>`
      : "";
    fields = `${deductionCoordinateFields("deductionSeeker", "Seeker pin used for this question", current)}${deductionMovementSelect(state)}${dataMessage}`;
  } else {
    fields = `${deductionMovementSelect(state)}`;
  }

  return `
    <details class="deduction-question-fields" open>
      <summary><span>${icon("filter")} Link this answer to the Deduction Map</span><span class="badge ${config.mode === "automatic" ? "badge-mint" : "badge-yellow"}">${escapeHtml(badge)}</span></summary>
      <div class="stack deduction-question-body">
        <label class="checkbox-row"><input type="checkbox" name="deductionEnabled" data-action="deduction-enable-question" checked /><span><strong>Record this as a map-linked answer</strong><br><span class="field-hint">Shared question details remain visible to both teams. Eliminations, imported map data and seeker annotations remain private to the seeker team.</span></span></label>
        <div class="deduction-auto-fields stack">${fields}</div>
      </div>
    </details>`;
}

function askQuestionModal(state, questionId) {
  const question = QUESTION_BY_ID.get(questionId);
  if (!question) return frame("Question not found", "", `<p>The selected question is no longer available.</p>`);
  const currentRound = state.game?.round || 1;
  const occurrence = state.questions.filter((record) => record.questionId === question.id && (record.round || 1) === currentRound).length + 1;
  const reward = repeatedReward(question, occurrence, state.settings.repeatRewardMode);
  return frame(`Ask: ${escapeHtml(question.name)}`, `${question.responseSeconds / 60}-minute answer timer · repeat cost x${occurrence}`, `
    <form class="stack" data-form="ask-question" data-question-id="${question.id}">
      <div class="callout">${icon("questions")}<p><strong>${escapeHtml(question.prompt)}</strong><br>${escapeHtml(question.guidance)}</p></div>
      <div class="grid grid-3"><div class="metric-card card"><span class="metric-label">Draw</span><strong class="metric-value">${reward.draw}</strong></div><div class="metric-card card"><span class="metric-label">Keep</span><strong class="metric-value">${reward.keep}</strong></div><div class="metric-card card"><span class="metric-label">Deadline</span><strong class="metric-value" style="font-size:1.6rem">${question.responseSeconds / 60} min</strong></div></div>
      ${question.requiresPin ? `<div class="field"><label for="question-pin">Shared pin / location label</label><input id="question-pin" name="pinLabel" maxlength="120" placeholder="Paste a Google Maps pin or describe the pinned location" /><span class="field-hint">Share the actual pin with the hiders before submitting.</span></div>` : ""}
      ${question.customInput ? `<div class="field"><label for="custom-value">Custom radius / parameter</label><input id="custom-value" name="customValue" maxlength="80" required placeholder="e.g. 7.4 km" /></div>` : ""}
      ${questionDeductionFields(state, question)}
      <div class="field"><label for="question-note">Optional clarification</label><textarea id="question-note" name="note" maxlength="400" placeholder="Line branch, endpoints, altitude, floor, POI interpretation..."></textarea></div>
      <label class="checkbox-row"><input type="checkbox" name="confirmed" required /><span>I confirm no other question is currently awaiting an answer, and any required pin/transit intent has been shared.</span></label>
      <button class="button button-primary" type="submit">${icon("clock")} Ask and start timer</button>
    </form>
  `);
}

function customAnswerModal(state, instanceId) {
  const record = state.questions.find((question) => question.id === instanceId);
  return frame("Enter answer", record ? escapeHtml(record.questionName) : "Question", `
    <form class="stack" data-form="custom-answer" data-question-instance="${escapeHtml(instanceId || "")}">
      <div class="field"><label for="custom-answer-text">Answer</label><input id="custom-answer-text" name="answer" maxlength="180" required autofocus /></div>
      <div class="field"><label for="custom-answer-note">Optional explanation</label><textarea id="custom-answer-note" name="note" maxlength="400"></textarea></div>
      <button class="button button-primary" type="submit">${icon("check")} Submit answer</button>
    </form>
  `);
}

function photoAnswerModal(state, instanceId) {
  const record = state.questions.find((question) => question.id === instanceId);
  return frame("Submit photo answer", record ? escapeHtml(record.questionName) : "Photo question", `
    <form class="stack" data-form="photo-answer" data-question-instance="${escapeHtml(instanceId || "")}">
      <div class="callout warning">${icon("camera")}<p>Use a fair, matchable image and avoid photographing strangers unnecessarily. You may censor uniquely identifying text only.</p></div>
      <div class="field"><label for="evidence-file">Photo</label><input id="evidence-file" name="photo" type="file" accept="image/*" capture="environment" required /><span class="field-hint">Images are compressed before upload. Connected Mode stores them in the private Supabase bucket.</span></div>
      <div class="field"><label for="photo-note">Optional note</label><textarea id="photo-note" name="note" maxlength="300"></textarea></div>
      <button class="button button-primary" type="submit">${icon("uploadCloud")} Submit photo answer</button>
    </form>
  `);
}

function evidenceLoadingModal(context) {
  return frame("Opening photo", escapeHtml(context.questionName || "Question evidence"), `
    <div class="evidence-loading" role="status" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <strong>Preparing the private image...</strong>
      <span class="muted">Connected photos use a short-lived signed link. Local photos stay in this browser.</span>
    </div>
  `);
}

function evidencePreviewModal(context) {
  return frame("Photo evidence", escapeHtml(context.questionName || "Question evidence"), `
    <figure class="evidence-figure">
      <img class="evidence-preview" src="${escapeHtml(context.url || "")}" alt="Photo answer for ${escapeHtml(context.questionName || "the question")}" />
      ${context.answerNote ? `<figcaption>${escapeHtml(context.answerNote)}</figcaption>` : ""}
    </figure>
    <div class="callout">${icon("safety")}<p>This image is shown only inside the current game context. Avoid sharing photos that expose bystanders or sensitive personal information.</p></div>
  `);
}

function markFoundModal(state) {
  return frame("Mark hiders found", "Stop the round timer when seekers are within 2 m and have spotted the hiders.", `
    <form class="stack" data-form="mark-found">
      <div class="field"><label for="found-note">Optional note</label><textarea id="found-note" name="note" maxlength="300" placeholder="Exact location, adjudication note, duplicate cards played..."></textarea></div>
      <label class="checkbox-row"><input type="checkbox" name="confirmed" required /><span>Seekers are within 2 metres and have spotted the hiders.</span></label>
      <button class="button button-primary" type="submit">${icon("target")} Stop round and mark found</button>
    </form>
  `);
}
