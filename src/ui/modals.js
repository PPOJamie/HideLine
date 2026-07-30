import { APP_VERSION, DEFAULT_DURATIONS, PHASES, TEAM_LABELS } from "../core/constants.js";
import { BUILT_IN_WATER_DATA } from "../data/water-edges.js";
import { escapeHtml, formatDateTime } from "../core/format.js";
import { QUESTION_BY_ID, repeatedReward } from "../data/questions.js";
import { CARD_TYPES } from "../data/rules.js";
import { STATIONS, STATION_BY_ID } from "../data/stations.js";
import { RAIL_LINES } from "../data/station-geo.js";
import { questionDeductionConfig } from "../data/question-deduction.js";
import { featuresForCategory, mergeSpatialData, spatialCategoryLabel, usableWaterFeatures } from "../core/spatial.js";
import { icon } from "./icons.js";
import { renderQuestionLocations } from "./question-location.js";

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
    case "water-answer": return waterAnswerModal(state, context.questionInstanceId);
    case "photo-answer": return photoAnswerModal(state, context.questionInstanceId);
    case "answer-details": return answerDetailsModal(state, context.questionInstanceId);
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
      <div class="field"><span class="field-label">Mode</span><label class="checkbox-row"><input type="radio" name="mode" value="local" checked /><span><strong>Local Mode</strong><br><span class="field-hint">Best for trying the app or sharing one device.</span></span></label><label class="checkbox-row"><input type="radio" name="mode" value="connected" /><span><strong>Connected Mode</strong><br><span class="field-hint">Links the teams with a room code. Open setup below only when this deployment has not been configured.</span></span></label></div>
      <details class="manual-coordinate-details"><summary>Connected Mode setup</summary><div class="stack"><div class="callout">${icon("link")}<p>These details normally come from the person who deployed HideLine.</p></div>${connectionFields(state)}</div></details>
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
      <details class="manual-coordinate-details" ${!state.connection.supabaseUrl || !state.connection.supabaseAnonKey ? "open" : ""}><summary>Connection settings</summary><div class="stack">${connectionFields(state)}</div></details>
      <button class="button button-primary" type="submit">${icon("link")} Join room</button>
    </form>
  `);
}

function notificationSettingsBlock(state) {
  const supported = typeof globalThis.Notification !== "undefined";
  const permission = supported ? globalThis.Notification.permission : "unsupported";
  const enabled = Boolean(state.settings?.notificationsEnabled && permission === "granted");
  const status = !supported
    ? "Not supported by this browser"
    : permission === "denied"
      ? "Blocked in browser or phone settings"
      : enabled
        ? "Enabled for this device"
        : permission === "granted"
          ? "Permission granted, currently paused in HideLine"
          : "Not enabled yet";
  const action = enabled
    ? `<button class="button button-soft button-small" type="button" data-action="disable-notifications">Disable device alerts</button>`
    : permission === "denied" || !supported
      ? ""
      : `<button class="button button-primary button-small" type="button" data-action="enable-notifications">${icon("bell")} Enable device alerts</button>`;
  return `<section class="notification-settings-card"><span class="notification-settings-icon">${icon("bell")}</span><div><strong>Game notifications</strong><p>In-app pop-ups always appear for important live updates. Device alerts can also appear when HideLine is open in the background.</p><small>HideLine ${escapeHtml(APP_VERSION)} · ${escapeHtml(status)}</small></div><div class="notification-settings-actions"><button class="button button-soft button-small" type="button" data-action="test-notification">Test pop-up</button>${action}</div></section>`;
}

function settingsModal(state) {
  return frame("App settings", "Configure live sync, repeat-question rewards and privacy defaults.", `
    <form class="stack" data-form="settings">
      <div class="field"><label for="repeat-mode">Repeated-question rewards</label><select id="repeat-mode" name="repeatRewardMode"><option value="multiply-both" ${state.settings.repeatRewardMode === "multiply-both" ? "selected" : ""}>Multiply draw and keep</option><option value="draw-only" ${state.settings.repeatRewardMode === "draw-only" ? "selected" : ""}>Multiply draw only</option><option value="manual" ${state.settings.repeatRewardMode === "manual" ? "selected" : ""}>Resolve manually</option></select></div>
      ${notificationSettingsBlock(state)}
      <div class="field"><label for="safety-contact">Emergency / organiser contact</label><input id="safety-contact" name="safetyContact" value="${escapeHtml(state.settings.safetyContact || "")}" placeholder="Name or phone number" /></div>
      <details class="manual-coordinate-details"><summary>Connected Mode setup</summary><div class="stack">${connectionFields(state)}<label class="checkbox-row"><input type="checkbox" name="rememberConnection" checked /><span>Remember these settings in this browser.</span></label></div></details>
      <button class="button button-primary" type="submit">${icon("check")} Save settings</button>
      <button class="button button-soft" type="button" data-action="export-game">${icon("download")} Export current game JSON</button>
      <button class="button button-danger" type="button" data-action="reset-app">${icon("trash")} Reset local app data</button>
    </form>
  `);
}

function startRoundModal(state) {
  const game = state.game;
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
  return frame(`Start round ${game?.round || 1}`, "Choose the hiding team. Start now uses the exact second when you press the button.", `
    <form class="stack" data-form="start-round">
      <div class="field"><label for="hider-team">Hiding team</label><select id="hider-team" name="hiderTeam"><option value="alpha" ${game?.hiderTeam === "alpha" ? "selected" : ""}>${escapeHtml(game?.teams?.alpha?.name || TEAM_LABELS.alpha)}</option><option value="bravo" ${game?.hiderTeam === "bravo" ? "selected" : ""}>${escapeHtml(game?.teams?.bravo?.name || TEAM_LABELS.bravo)}</option></select></div>
      <fieldset class="field"><legend class="field-label">When should the timer begin?</legend><label class="checkbox-row"><input type="radio" name="startMode" value="now" checked /><span><strong>Start now</strong><br><span class="field-hint">Recommended. The timer begins at the exact moment you submit.</span></span></label><label class="checkbox-row"><input type="radio" name="startMode" value="scheduled" /><span><strong>Use an agreed start time</strong><br><span class="field-hint">Use this only when both teams agreed a specific clock time.</span></span></label></fieldset>
      <div class="field"><label for="round-start">Agreed start time</label><input id="round-start" name="roundStart" type="datetime-local" step="1" value="${localDate}" /><span class="field-hint">This is ignored while “Start now” is selected.</span></div>
      <details class="manual-coordinate-details"><summary>Change the standard timings</summary><div class="field-row"><div class="field"><label for="hide-minutes">Hiding period</label><input id="hide-minutes" name="hidingMinutes" type="number" min="1" step="0.1" value="45" /></div><div class="field"><label for="cutoff-minutes">Total round cutoff</label><input id="cutoff-minutes" name="cutoffMinutes" type="number" min="1.1" step="0.1" value="285" /></div></div></details>
      <div class="callout warning">${icon("alert")}<p>At release, hiders must be inside a valid 500 m station-centred zone.</p></div>
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
  const selected = Boolean(lat && lng);
  const mapUrl = selected ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}` : "";
  return `
    <fieldset class="coordinate-pair compact-coordinate-pair simple-coordinate-pair">
      <legend>${escapeHtml(label)}</legend>
      <div class="coordinate-actions">
        <button class="button button-soft button-small" type="button" data-action="deduction-fill-gps" data-prefix="${prefix}">${icon("location")} Use current GPS</button>
        <button class="button button-primary button-small" type="button" data-action="coordinate-picker-open" data-prefix="${prefix}" data-label="${escapeHtml(label)}">${icon("map")} Pick coordinates from map</button>
      </div>
      <div class="coordinate-selection-summary ${selected ? "selected" : ""}" data-coordinate-summary="${prefix}">
        ${icon("location")}<span>${selected ? `${lat}, ${lng}` : "No point selected yet"}</span>
        <a class="coordinate-preview-link" data-coordinate-preview="${prefix}" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer" ${selected ? "" : "hidden"}>Open in Google Maps ${icon("external")}</a>
      </div>
      <details class="manual-coordinate-details" ${selected ? "open" : ""}><summary>Enter coordinates manually</summary><div class="field-row"><div class="field"><label for="${prefix}-lat">Latitude</label><input id="${prefix}-lat" name="${prefix}Lat" type="number" inputmode="decimal" step="any" min="-90" max="90" value="${lat}" /></div><div class="field"><label for="${prefix}-lng">Longitude</label><input id="${prefix}-lng" name="${prefix}Lng" type="number" inputmode="decimal" step="any" min="-180" max="180" value="${lng}" /></div></div></details>
    </fieldset>`;
}

function deductionMovementInput(state) {
  const mode = state.game?.phase === PHASES.ENDGAME ? "locked" : "mobile";
  return `<input type="hidden" name="deductionMovementMode" value="${mode}" />`;
}

function questionSpatialData(state) {
  return mergeSpatialData(BUILT_IN_WATER_DATA, state.privateTeamState?.spatialData, state.referenceData);
}

const REFERENCE_SELECT_CATEGORIES = new Set(["park", "zoo", "museum", "cinema", "hospital", "library", "consulate", "aquarium", "high_speed_rail", "borough"]);

function featureReferenceSelect(features, config, question) {
  if (!config.category || !REFERENCE_SELECT_CATEGORIES.has(config.category)) return "";
  if (!["nearest-feature-match", "nearest-feature-distance"].includes(config.type)) return "";
  const sorted = [...features].sort((a, b) => a.name.localeCompare(b.name));
  if (!sorted.length) return "";
  const label = config.type === "nearest-feature-match"
    ? `Seeker's nearest ${spatialCategoryLabel(config.category).toLowerCase()}`
    : `Reference used for the seeker's ${question.name.toLowerCase()} measurement`;
  return `<div class="field reference-feature-field"><label for="deduction-reference-feature">${escapeHtml(label)}</label><select id="deduction-reference-feature" name="deductionReferenceFeatureId" data-reference-category="${escapeHtml(config.category)}"><option value="">Choose automatically from the seeker pin</option>${sorted.map((feature) => `<option value="${escapeHtml(feature.id)}">${escapeHtml(feature.name)}</option>`).join("")}</select><span class="field-hint">HideLine automatically selects the nearest valid map feature when this is left blank. Choose one to resolve an ambiguous pin or confirm the exact handbook layer item.</span></div>`;
}

function waterReferenceFields() {
  return `<section class="water-reference-picker" data-water-calculator data-location-prefix="deductionSeeker" data-edge-prefix="deductionWaterPoint" data-name-field="deductionWaterName" data-mode-field="deductionWaterReferenceMode" data-feature-id-field="deductionWaterFeatureId">
    <input type="hidden" name="deductionWaterReferenceMode" value="auto" />
    <input type="hidden" name="deductionWaterFeatureId" value="" />
    <div class="water-reference-heading"><span class="water-reference-icon">${icon("measure")}</span><div><strong>Nearest Body of Water edge</strong><p>After you choose the seeker pin, HideLine automatically selects the nearest shoreline or bank from its built-in Central London water atlas.</p></div></div>
    <ol class="water-question-steps">
      <li><strong>Choose the seeker pin above.</strong><span>The nearest mapped water edge and distance will appear automatically.</span></li>
      <li><strong>Review only when needed.</strong><span>Open the water map if the automatic edge looks wrong or a tiny local water body is missing.</span></li>
    </ol>
    <div class="field"><label for="deduction-water-name">Selected body of water</label><input id="deduction-water-name" name="deductionWaterName" maxlength="120" placeholder="Filled automatically" data-action="water-reference-name" /><span class="field-hint">This name is an audit label. The calculation uses the exact edge coordinate below.</span></div>
    <details class="manual-coordinate-details"><summary>View or enter exact water-edge coordinates</summary><div class="field-row"><div class="field"><label for="deduction-water-point-lat">Edge latitude</label><input id="deduction-water-point-lat" name="deductionWaterPointLat" type="number" inputmode="decimal" step="any" min="-90" max="90" /></div><div class="field"><label for="deduction-water-point-lng">Edge longitude</label><input id="deduction-water-point-lng" name="deductionWaterPointLng" type="number" inputmode="decimal" step="any" min="-180" max="180" /></div></div></details>
    <div class="water-reference-actions">
      <button class="button button-soft" type="button" data-action="water-reference-auto">${icon("refresh")} Recalculate nearest edge</button>
      <button class="button button-primary" type="button" data-action="coordinate-picker-open" data-prefix="deductionWaterPoint" data-label="Review the seeker’s nearest valid water edge" data-picker-mode="water-edge" data-seeker-prefix="deductionSeeker">${icon("map")} Review on map</button>
    </div>
    <div class="coordinate-selection-summary water-reference-summary" data-coordinate-summary="deductionWaterPoint" data-water-reference-summary>
      ${icon("location")}<span>Choose the seeker pin to calculate the nearest edge</span>
      <a class="coordinate-preview-link" data-coordinate-preview="deductionWaterPoint" target="_blank" rel="noopener noreferrer" hidden>Open in Google Maps ${icon("external")}</a>
      <small data-water-reference-distance>HideLine will select the nearest built-in water edge automatically.</small>
    </div>
    <div class="callout water-rule-note">${icon("info")}<p><strong>What counts:</strong> a named area shaded blue on the normal map. Measure to its nearest edge. Swimming pools and fountains do not count. The hider uses the same atlas privately for their own location.</p></div>
  </section>`;
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
  const spatialData = questionSpatialData(state);
  const categoryFeatures = config.category ? featuresForCategory(spatialData.features, config.category) : [];
  const usableCategoryFeatures = config.category === "water" ? usableWaterFeatures(categoryFeatures) : categoryFeatures;
  const categoryCount = usableCategoryFeatures.length;
  const hidden = `<input type="hidden" name="deductionEnabled" value="on" />${deductionMovementInput(state)}`;
  let fields = "";

  if (config.mode === "guided") {
    return `${hidden}<details class="deduction-question-fields simple-question-map-details"><summary><span>${icon("map")} Map note</span><span class="badge badge-neutral">Saved for review</span></summary><div class="stack deduction-question-body"><p class="muted small">${escapeHtml(config.reason || "This clue needs player judgement.")} HideLine records the answer but will not guess the excluded area.</p></div></details>`;
  }

  if (question.category === "radar") {
    fields = deductionCoordinateFields("deductionCentre", "Where the seekers asked the Radar question", current);
  } else if (question.category === "thermometer") {
    fields = `${deductionCoordinateFields("deductionStart", "Where the journey started")}${deductionCoordinateFields("deductionEnd", "Where the journey ended", current)}`;
  } else if (question.id === "matching-station-name") {
    fields = `<div class="field"><label for="deduction-seeker-station">Seeker station</label><select id="deduction-seeker-station" name="deductionSeekerStationId"><option value="">Choose the handbook station name…</option>${STATIONS.map((station) => `<option value="${station.id}">${escapeHtml(station.name)}${station.note ? ` — ${escapeHtml(station.note)}` : ""}</option>`).join("")}</select></div>`;
  } else if (question.id === "matching-rail-line") {
    fields = `<div class="field"><label for="deduction-line">Train line or operator</label><select id="deduction-line" name="deductionLineId">${deductionLineOptions()}</select></div><details class="manual-coordinate-details"><summary>Choose exact stops when branches differ</summary><div class="field"><label for="deduction-stops">Stops in the game area</label><select id="deduction-stops" name="deductionStationIds" multiple size="7">${STATIONS.map((station) => `<option value="${station.id}">${escapeHtml(station.name)}${station.note ? ` — ${escapeHtml(station.note)}` : ""}</option>`).join("")}</select><span class="field-hint">Exact stops override the broad line preset.</span></div></details>`;
  } else if (question.id === "matching-landmass") {
    fields = `${deductionCoordinateFields("deductionSeeker", "Seeker pin for Thames-side matching", current)}<div class="callout">${icon("info")}<p>HideLine detects north, south or the bridge/tunnel river corridor from this pin automatically.</p></div>`;
  } else if (config.requiresSeekerPoint) {
    fields = deductionCoordinateFields("deductionSeeker", "Seeker pin used for this question", current);
  }

  fields += question.id === "measuring-water"
    ? waterReferenceFields()
    : featureReferenceSelect(categoryFeatures, config, question);
  if (config.type === "tentacle" && categoryCount) {
    fields += `<div class="callout success">${icon("check")}<p>HideLine will build the hider's answer drop-down from the ${categoryCount} mapped ${escapeHtml(spatialCategoryLabel(config.category).toLowerCase())} and keep only those within 2 km of the seeker pin.</p></div>`;
  }

  const dataNote = question.id === "measuring-water"
    ? `<div class="callout success water-atlas-ready">${icon("check")}<p><strong>${categoryCount} built-in named water shapes are ready.</strong> The exact nearest-edge calculation and Find Hiders shading now use the same bundled atlas. You can still review the selected edge on the map.</p></div>`
    : config.category && !categoryCount
      ? `<div class="callout warning map-data-question-warning">${icon("info")}<div><p>This question needs ${escapeHtml(config.dataLabel || spatialCategoryLabel(config.category))}. Borough, ward and constituency polygons load from HideLine's built-in official sources; curated POIs come from the supplied game map.</p><button class="button button-soft button-small" type="button" data-action="spatial-data-load-configured">${icon("download")} Load official game map</button></div></div>`
      : config.category
        ? `<p class="tiny muted">${categoryCount} matching map features are ready.</p>`
        : "";
  return `${hidden}<details class="deduction-question-fields simple-question-map-details" open><summary><span>${icon("map")} Information needed for the map</span><span class="badge badge-mint">Automatic</span></summary><div class="stack deduction-question-body">${fields}${dataNote}</div></details>`;
}

function questionPinFields(state, question) {
  if (!question?.requiresPin) return "";
  const config = questionDeductionConfig(question);
  const hasMapCoordinateControls = question.category === "radar"
    || question.category === "thermometer"
    || question.id === "matching-landmass"
    || Boolean(config.requiresSeekerPoint);
  const picker = hasMapCoordinateControls
    ? `<div class="callout question-pin-help">${icon("location")}<p><strong>Share the map point.</strong> Use the <em>Pick coordinates from map</em> button below. HideLine will also add a clickable Google Maps link to the question.</p></div>`
    : deductionCoordinateFields("deductionShared", "Question pin shared with the hiders", state.location?.current || null);
  return `${picker}<details class="manual-coordinate-details"><summary>Paste a Google Maps link or add a location name</summary><div class="field"><label for="question-pin">Shared pin or location label</label><input id="question-pin" name="pinLabel" maxlength="300" placeholder="https://maps.google.com/… or Waterloo station" /><span class="field-hint">This is saved with the question and shown to the hider team.</span></div></details>`;
}

function askQuestionModal(state, questionId) {
  const question = QUESTION_BY_ID.get(questionId);
  if (!question) return frame("Question not found", "", `<p>The selected question is no longer available.</p>`);
  const currentRound = state.game?.round || 1;
  const occurrence = state.questions.filter((record) => record.questionId === question.id && (record.round || 1) === currentRound).length + 1;
  const reward = repeatedReward(question, occurrence, state.settings.repeatRewardMode);
  return frame(`Ask: ${escapeHtml(question.name)}`, "Check the wording, add any map information and start the timer.", `
    <form class="stack simple-ask-form" data-form="ask-question" data-question-id="${question.id}">
      <div class="simple-modal-prompt"><strong>${escapeHtml(question.prompt)}</strong><p>${escapeHtml(question.guidance)}</p></div>
      <div class="row wrap simple-question-facts"><span class="badge badge-blue">${question.responseSeconds / 60} min to answer</span><span class="badge badge-purple">Draw ${reward.draw}, keep ${reward.keep}</span>${occurrence > 1 ? `<span class="badge badge-yellow">Repeat x${occurrence}</span>` : ""}</div>
      ${questionPinFields(state, question)}
      ${question.customInput ? `<div class="field"><label for="custom-value">Custom distance or value</label><input id="custom-value" name="customValue" maxlength="80" required placeholder="e.g. 7.4 km" /></div>` : ""}
      ${questionDeductionFields(state, question)}
      <details class="manual-coordinate-details"><summary>Add an optional clarification</summary><div class="field"><label for="question-note">Note</label><textarea id="question-note" name="note" maxlength="400" placeholder="Line branch, endpoints, floor, POI interpretation…"></textarea></div></details>
      <label class="checkbox-row"><input type="checkbox" name="confirmed" required /><span>I have shared any required pin or transit notice, and no other question is waiting.</span></label>
      <button class="button button-primary button-large" type="submit">${icon("clock")} Ask and start timer</button>
    </form>
  `);
}

function renderAnswerMapReference(record) {
  const reference = record?.mapReference;
  if (!reference?.name) return "";
  const distance = Number(reference.seekerDistanceMetres);
  return `<section class="question-reference-card"><div class="question-reference-icon">${icon("measure")}</div><div><span>Map reference used</span><strong>${escapeHtml(reference.name)}</strong><p>${escapeHtml([reference.method, Number.isFinite(distance) ? `${Math.round(distance)} m from the seeker pin` : ""].filter(Boolean).join(" · "))}</p>${reference.explanation ? `<p class="measurement-explanation">${escapeHtml(reference.explanation)}</p>` : ""}<small>${escapeHtml(reference.source || "Game map")}</small></div></section>`;
}

function answerDetailsModal(state, instanceId) {
  const record = state.questions.find((question) => question.id === instanceId);
  if (!record) return frame("Answer not found", "", `<p class="muted">This answer is no longer available on this device.</p>`);
  const definition = QUESTION_BY_ID.get(record.questionId) || record;
  const hasEvidence = Boolean(record.evidencePath || record.evidenceKey || record.evidenceDataUrl);
  const answeredAt = record.answeredAt ? formatDateTime(record.answeredAt) : "Not recorded";
  const reward = record.reward || definition.reward || { draw: 0, keep: 0 };
  return frame("Answer details", escapeHtml(record.questionName || definition.name || "Question"), `
    <article class="answer-details-card">
      <div class="answer-details-result"><span>Answer</span><strong>${escapeHtml(record.answer || "No answer recorded")}</strong></div>
      <div class="answer-details-question"><span>Question</span><p>${escapeHtml(record.prompt || definition.prompt || "")}</p></div>
      ${renderQuestionLocations(record)}
      ${renderAnswerMapReference(record)}
      ${record.note ? `<div class="answer-details-note"><span>Question clarification</span><p>${escapeHtml(record.note)}</p></div>` : ""}
      ${record.answerNote ? `<div class="answer-details-note"><span>Hider explanation</span><p>${escapeHtml(record.answerNote)}</p></div>` : ""}
      <dl class="answer-details-meta"><div><dt>Asked</dt><dd>${escapeHtml(record.askedAt ? formatDateTime(record.askedAt) : "Not recorded")}</dd></div><div><dt>Answered</dt><dd>${escapeHtml(answeredAt)}</dd></div><div><dt>Reward</dt><dd>${record.rewardEarned === false ? "No reward — answered after deadline" : `Draw ${Number(reward.draw) || 0}, keep ${Number(reward.keep) || 0}`}</dd></div><div><dt>Phase</dt><dd>${escapeHtml(record.answeredPhase || record.phase || "Unknown")}</dd></div></dl>
      <div class="row wrap">${hasEvidence ? `<button class="button button-primary" type="button" data-action="view-evidence" data-question-instance="${escapeHtml(record.id)}">${icon("camera")} Open photo answer</button>` : ""}<button class="button button-soft" type="button" data-action="close-modal">Close</button></div>
    </article>
  `);
}

function waterAnswerModal(state, instanceId) {
  const record = state.questions.find((question) => question.id === instanceId);
  if (!record) return frame("Question not found", "Body of Water", `<p class="muted">This question is no longer available.</p>`);
  const seekerDistance = Number(record.mapReference?.seekerDistanceMetres ?? record.deductionInput?.seekerDistanceMetres);
  const workflowVersion = Number(record.deductionInput?.waterWorkflowVersion || 0);
  const baselineReady = Number.isFinite(seekerDistance);
  const workflowReady = baselineReady && workflowVersion >= 2;
  const baselineText = workflowReady ? `${Math.round(seekerDistance)} m` : "Re-ask required";
  return frame("Calculate your Body of Water answer", "Your location and water-edge selection stay on this device. Only Closer or Further is shared with the seekers.", `
    <form class="stack water-answer-form" data-form="water-answer" data-question-instance="${escapeHtml(instanceId || "")}">
      <section class="water-baseline-card"><span>${icon("measure")}</span><div><small>Seeker’s recorded distance</small><strong>${escapeHtml(baselineText)}</strong><p>Measured from the shared seeker pin to the exact water-edge point shown with the question.</p></div></section>
      ${workflowReady ? "" : `<div class="callout danger">${icon("alert")}<p>This question was created with the old water list or has no valid seeker distance. Ask the seekers to cancel it and re-ask Body of Water with the current built-in water atlas.</p></div>`}
      <section class="water-private-calculator" data-water-calculator data-location-prefix="hiderWaterLocation" data-edge-prefix="hiderWaterEdge" data-name-field="hiderWaterName" data-mode-field="hiderWaterReferenceMode" data-feature-id-field="hiderWaterFeatureId" data-baseline-distance="${workflowReady ? seekerDistance : ""}">
        <input type="hidden" name="hiderWaterReferenceMode" value="auto" />
        <input type="hidden" name="hiderWaterFeatureId" value="" />
        <div class="water-private-banner">${icon("safety")}<p><strong>Private calculation:</strong> these two coordinates are not added to the shared question or sent to the opposing team.</p></div>
        <div class="water-answer-step"><span>1</span><div><strong>Choose your current position</strong><p>Use your physical location at the moment you answer.</p></div></div>
        ${deductionCoordinateFields("hiderWaterLocation", "Your current position", state.location?.current || null)}
        <div class="water-answer-step"><span>2</span><div><strong>Check the automatic nearest edge</strong><p>HideLine selects the nearest bank or shoreline from the built-in atlas. Review it on the map only if needed.</p></div></div>
        <div class="field"><label for="hider-water-name">Selected body of water</label><input id="hider-water-name" name="hiderWaterName" maxlength="120" placeholder="Filled automatically" data-action="water-reference-name" /></div>
        <details class="manual-coordinate-details"><summary>Enter exact water-edge coordinates manually</summary><div class="field-row"><div class="field"><label for="hider-water-edge-lat">Edge latitude</label><input id="hider-water-edge-lat" name="hiderWaterEdgeLat" type="number" inputmode="decimal" step="any" min="-90" max="90" /></div><div class="field"><label for="hider-water-edge-lng">Edge longitude</label><input id="hider-water-edge-lng" name="hiderWaterEdgeLng" type="number" inputmode="decimal" step="any" min="-180" max="180" /></div></div></details>
        <div class="water-reference-actions"><button class="button button-soft" type="button" data-action="water-reference-auto">${icon("refresh")} Recalculate nearest edge</button><button class="button button-primary" type="button" data-action="coordinate-picker-open" data-prefix="hiderWaterEdge" data-label="Review your nearest valid water edge" data-picker-mode="water-edge" data-seeker-prefix="hiderWaterLocation">${icon("map")} Review on map</button></div>
        <div class="coordinate-selection-summary water-reference-summary" data-coordinate-summary="hiderWaterEdge" data-water-reference-summary>
          ${icon("location")}<span>Choose your location to calculate the nearest edge</span>
          <a class="coordinate-preview-link" data-coordinate-preview="hiderWaterEdge" target="_blank" rel="noopener noreferrer" hidden>Open in Google Maps ${icon("external")}</a>
          <small data-water-reference-distance>HideLine will select your nearest built-in water edge automatically.</small>
        </div>
        <input type="hidden" name="computedAnswer" value="" />
        <div class="water-answer-result pending" data-water-answer-result role="status" aria-live="polite"><span>${icon("measure")}</span><div><small>Calculated answer</small><strong>Choose your location</strong><p>HideLine will select your nearest mapped water edge and compare the distances.</p></div></div>
      </section>
      <div class="field"><label for="water-answer-note">Optional explanation</label><textarea id="water-answer-note" name="note" maxlength="400" placeholder="Only add a note if the result needed judgement."></textarea></div>
      <button class="button button-primary button-large" type="submit" data-water-answer-submit ${baselineReady ? "disabled" : "disabled"}>${icon("check")} Submit calculated answer</button>
      <details class="manual-coordinate-details"><summary>Already measured outside HideLine?</summary><div class="stack"><p class="muted small">Use a manual answer only when you have independently followed the same nearest-edge rule.</p><div class="answer-grid"><button type="button" class="answer-button" data-action="answer-question" data-question-instance="${escapeHtml(instanceId || "")}" data-answer="Closer">Closer</button><button type="button" class="answer-button" data-action="answer-question" data-question-instance="${escapeHtml(instanceId || "")}" data-answer="Further">Further</button></div></div></details>
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
