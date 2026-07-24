import { DEFAULT_DURATIONS, PHASES, TEAM_LABELS } from "../core/constants.js";
import { escapeHtml, formatClock, initials, relativeTime, titleCase } from "../core/format.js";
import { activeElapsedSeconds, formatDuration } from "../core/time.js";
import { calculateScore } from "../core/score.js";
import { buildDeductionViewModel } from "./deduction-view.js";
import { icon } from "./icons.js";

function phaseData(game, now) {
  if (!game) return { label: "No game", timer: "--:--", helper: "Create or join a game to begin." };
  const timers = game.timers || {};
  const elapsed = activeElapsedSeconds(timers.roundStartedAt, timers.roundStoppedAt, timers.pauses, now);
  const hidingPeriod = Number(timers.hidingPeriodSeconds || DEFAULT_DURATIONS.hidingPeriodSeconds);
  const cutoff = Number(timers.cutoffSeconds || DEFAULT_DURATIONS.roundCutoffSeconds);
  if (game.phase === PHASES.LOBBY) return { label: "Ready to start", timer: "Ready", helper: "Choose the first hiding team, then start the round." };
  if (game.phase === PHASES.HIDING) {
    const remaining = Math.max(0, hidingPeriod - elapsed);
    return { label: "Hiding period", timer: formatDuration(remaining), helper: `${TEAM_LABELS[game.hiderTeam]} must reach a valid 500 m station zone.` };
  }
  if ([PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase)) {
    const hidingElapsed = Math.max(0, elapsed - hidingPeriod);
    const cutoffRemaining = Math.max(0, cutoff - elapsed);
    return { label: game.phase === PHASES.ENDGAME ? "Endgame" : "Seeking", timer: formatDuration(hidingElapsed), helper: `${formatDuration(cutoffRemaining, { compact: true })} until the round cutoff.` };
  }
  const hidingElapsed = Math.max(0, elapsed - hidingPeriod);
  return { label: "Round complete", timer: formatDuration(hidingElapsed), helper: timers.foundAt ? `Found at ${formatClock(timers.foundAt)}.` : "Round stopped at the cutoff." };
}

function renderTimer(game, now) {
  const phase = phaseData(game, now);
  const paused = Boolean(game?.timers?.pauses?.at(-1) && !game.timers.pauses.at(-1).endedAt);
  return `
    <section class="card card-dark card-pad simple-timer" aria-label="Round timer">
      <div>
        <p class="eyebrow">Round ${game?.round || 1} · ${paused ? "Paused" : phase.label}</p>
        <div class="timer-readout" data-live-timer>${phase.timer}</div>
        <p class="timer-sub">${escapeHtml(phase.helper)}</p>
      </div>
      <div class="simple-timer-actions">
        ${game?.phase === PHASES.LOBBY ? `<button class="button button-primary" type="button" data-action="open-modal" data-modal="start-round">${icon("play")} Start round</button>` : ""}
        ${game?.phase !== PHASES.LOBBY && game?.phase !== PHASES.COMPLETE ? `<button class="button ${paused ? "button-mint" : "button-ghost"}" type="button" data-action="toggle-pause">${icon(paused ? "resume" : "pause")} ${paused ? "Resume" : "Pause"}</button>` : ""}
        ${game?.phase === PHASES.SEEKING ? `<button class="button button-ghost" type="button" data-action="trigger-endgame">${icon("eye")} Start endgame</button>` : ""}
        ${game?.phase === PHASES.ENDGAME ? `<button class="button button-ghost" type="button" data-action="cancel-endgame">${icon("undo")} Endgame was accidental</button>` : ""}
        ${[PHASES.SEEKING, PHASES.ENDGAME].includes(game?.phase) ? `<button class="button button-primary" type="button" data-action="mark-found">${icon("target")} Mark found</button>` : ""}
      </div>
    </section>`;
}

function roleCopy(game, team) {
  const isHider = team === game.hiderTeam;
  if (game.phase === PHASES.LOBBY) return { title: "Get ready", body: "Confirm teams, recap the rules and start when everyone is ready." };
  if (game.phase === PHASES.HIDING) return isHider
    ? { title: "Reach your hiding zone", body: "Choose a valid station and be inside its 500 m zone before the timer reaches zero." }
    : { title: "Wait for release", body: "Use this time to plan. Do not begin seeking until the hiding period ends." };
  if (game.phase === PHASES.SEEKING) return isHider
    ? { title: "Answer the next question", body: "Answer truthfully within the deadline, then record your card reward." }
    : { title: "Ask, answer, eliminate", body: "Ask one question at a time, then use the live map to narrow the possible stations." };
  if (game.phase === PHASES.ENDGAME) return isHider
    ? { title: "Stay in your hiding spot", body: "Do not move. Answer only what can be answered from the fixed spot." }
    : { title: "Search the remaining area", body: "Use the Endgame circle and mark the hiders found when you are within 2 m and have spotted them." };
  return { title: "Finish the round", body: "Check bonuses, traps and penalties, then save the final score." };
}

function renderPrimaryActions(state) {
  const game = state.game;
  const isHider = state.profile.team === game.hiderTeam;
  const pending = state.questions.filter((record) => record.status === "pending").length;
  const copy = roleCopy(game, state.profile.team);
  let actions = "";
  if (game.phase === PHASES.LOBBY) {
    actions = `<button class="button button-primary" type="button" data-action="open-modal" data-modal="start-round">${icon("play")} Start round</button><button class="button button-soft" type="button" data-action="navigate" data-view="rules">${icon("rules")} Quick rules</button>`;
  } else if (game.phase === PHASES.HIDING) {
    actions = isHider
      ? `<button class="button button-primary" type="button" data-action="navigate-tool" data-tool="stations">${icon("station")} Choose station</button><button class="button button-soft" type="button" data-action="navigate-map-mode" data-mode="zone">${icon("target")} Check 500 m zone</button>`
      : `<button class="button button-primary" type="button" data-action="navigate" data-view="rules">${icon("rules")} Review seeker rules</button><button class="button button-soft" type="button" data-action="navigate-map-mode" data-mode="authoritative">${icon("map")} Open game map</button>`;
  } else if ([PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase)) {
    if (isHider) {
      actions = `<button class="button button-primary" type="button" data-action="navigate" data-view="questions">${icon("questions")} ${pending ? `Answer ${pending} waiting` : "Open questions"}</button><button class="button button-soft" type="button" data-action="navigate-tool" data-tool="cards">${icon("card")} Cards</button>`;
    } else {
      actions = `<button class="button button-primary" type="button" data-action="navigate" data-view="questions">${icon("questions")} Ask a question</button><button class="button button-soft" type="button" data-action="navigate-deduction-map">${icon("map")} ${game.phase === PHASES.ENDGAME ? "Open Endgame map" : "Open live map"}</button><button class="button button-soft" type="button" data-action="open-modal" data-modal="${game.transit?.[state.profile.team]?.active ? "transit-end" : "transit-start"}">${icon("train")} ${game.transit?.[state.profile.team]?.active ? "I am off the train" : "Boarding a train"}</button>`;
    }
  } else {
    actions = `<button class="button button-primary" type="button" data-action="navigate-tool" data-tool="score">${icon("trophy")} Check score</button>${game.round === 1 ? `<button class="button button-soft" type="button" data-action="next-round">${icon("refresh")} Prepare round 2</button>` : ""}`;
  }
  return `
    <section class="card card-pad simple-next-card">
      <p class="eyebrow">What to do now</p>
      <h2>${escapeHtml(copy.title)}</h2>
      <p class="lead">${escapeHtml(copy.body)}</p>
      <div class="simple-action-grid">${actions}</div>
    </section>`;
}

function renderTeams(game, now) {
  return `<section class="card card-pad simple-team-summary">
    <div class="section-head"><div><h2>Teams</h2><p>Who is hiding and who is seeking.</p></div></div>
    <div class="simple-team-grid">${["alpha", "bravo"].map((teamId) => {
      const members = (game.members || []).filter((member) => member.team === teamId);
      const hiding = game.hiderTeam === teamId;
      const transit = game.transit?.[teamId]?.active;
      return `<article class="simple-team-row"><div><span class="team-mark ${teamId}"></span><strong>${escapeHtml(game.teams?.[teamId]?.name || TEAM_LABELS[teamId])}</strong><span class="badge ${hiding ? "badge-orange" : "badge-blue"}">${hiding ? "Hiding" : "Seeking"}</span></div><small>${members.length ? members.map((member) => escapeHtml(member.displayName || member.display_name || "Player")).join(", ") : "No linked players"}${transit ? " · on a train" : ""}</small></article>`;
    }).join("")}</div>
  </section>`;
}

function eventCopy(event) {
  const payload = event.payload || event;
  const author = payload.authorName || payload.displayName || event.authorName || "Player";
  switch (event.type || event.event_type) {
    case "question": return { title: `${author} asked ${payload.questionName || "a question"}`, text: payload.prompt || "Investigation question" };
    case "answer": return { title: `${author} answered ${payload.answer || ""}`.trim(), text: payload.questionName || "Answer recorded" };
    case "transit-start": return { title: `${author} boarded`, text: payload.station || payload.note || "Transit intent shared" };
    case "transit-end": return { title: `${author} left transit`, text: payload.station || payload.note || "Off train" };
    case "pause": return { title: "Game paused", text: payload.reason || "Pause recorded" };
    case "resume": return { title: "Game resumed", text: payload.reason || "Timer restarted" };
    case "found": return { title: "Hiders found", text: payload.note || "Round timer stopped" };
    case "chat": return { title: author, text: payload.message || "" };
    default: return { title: payload.title || titleCase(event.type || event.event_type || "Update"), text: payload.message || payload.note || "" };
  }
}

function renderRecentActivity(state, now) {
  const events = state.events.slice(0, 6);
  return `<section class="card card-pad simple-activity">
    <div class="section-head"><div><h2>Recent activity</h2><p>The latest questions, answers and movement notices.</p></div></div>
    ${events.length ? `<div class="simple-event-list">${events.map((event) => { const copy = eventCopy(event); const createdAt = event.createdAt || event.created_at || new Date().toISOString(); return `<article><div><strong>${escapeHtml(copy.title)}</strong><small>${escapeHtml(copy.text)}</small></div><time>${relativeTime(createdAt, now)}</time></article>`; }).join("")}</div>` : `<div class="empty-state simple-empty"><div class="empty-state-inner"><span class="empty-icon">${icon("route")}</span><strong>No activity yet</strong><span>Important actions appear here automatically.</span></div></div>`}
    <form class="chat-form simple-chat" data-form="chat"><label class="sr-only" for="chat-message">Game note</label><input id="chat-message" name="message" maxlength="300" placeholder="Add a short game note..." autocomplete="off" /><button class="button button-secondary" type="submit">${icon("chat")} Send</button></form>
  </section>`;
}

function renderSnapshot(state) {
  const game = state.game;
  const score = calculateScore(game.scoreByRound?.[game.round] || {});
  const isHider = state.profile.team === game.hiderTeam;
  let remaining = null;
  if (!isHider || game.mode === "local") {
    try { remaining = buildDeductionViewModel(state).summary.remaining; } catch { remaining = null; }
  }
  const answered = state.questions.filter((record) => record.status === "answered" && (record.round || 1) === game.round).length;
  const pending = state.questions.filter((record) => record.status === "pending" && (record.round || 1) === game.round).length;
  return `<section class="simple-snapshot-grid" aria-label="Round snapshot">
    <article class="card simple-snapshot"><span>Questions answered</span><strong>${answered}</strong><small>${pending ? `${pending} waiting` : "none waiting"}</small></article>
    ${remaining == null ? "" : `<article class="card simple-snapshot"><span>Stations still possible</span><strong>${remaining}</strong><small>from 100</small></article>`}
    <article class="card simple-snapshot"><span>Projected round time</span><strong>${formatDuration(score.totalRoundSeconds)}</strong><small>including hiding period</small></article>
  </section>`;
}

function renderNoGame() {
  return `<div class="view-stack simple-onboarding">
    <section class="card card-dark card-pad simple-welcome">
      <div><p class="eyebrow">London transit hide + seek</p><h2>Everything needed on game day. Nothing extra in the way.</h2><p>Run the timer, ask and answer questions, narrow the live map and calculate the final score.</p><div class="hero-actions"><button class="button button-primary" type="button" data-action="open-modal" data-modal="new-game">${icon("play")} Create a game</button><button class="button button-ghost" type="button" data-action="open-modal" data-modal="join-game">${icon("link")} Join with a code</button></div></div>
    </section>
    <section class="simple-start-steps"><article class="card"><span>1</span><div><strong>Start the round</strong><p>Use the built-in hiding and seeking timers.</p></div></article><article class="card"><span>2</span><div><strong>Ask one question</strong><p>The answer and deadline are recorded automatically.</p></div></article><article class="card"><span>3</span><div><strong>Follow the live map</strong><p>Impossible areas are greyed out without switching layers.</p></div></article></section>
    <div class="button-row"><button class="button button-soft" type="button" data-action="navigate" data-view="rules">${icon("rules")} Read the quick rules</button><a class="button button-soft" href="./docs/Hide-and-Seek-London-Handbook.pdf" target="_blank" rel="noopener">${icon("bookOpen")} Open full handbook</a></div>
  </div>`;
}

export function renderPlay(state, now = Date.now()) {
  if (!state.game) return renderNoGame();
  const game = state.game;
  const currentRole = state.profile.team === game.hiderTeam ? "Hider" : "Seeker";
  return `<div class="view-stack simple-game-view">
    <section class="simple-game-heading"><div><p class="eyebrow">${escapeHtml(game.code || "LOCAL")} · You are a ${currentRole}</p><h2>${escapeHtml(game.name)}</h2></div><div class="button-row compact"><button class="button button-soft button-small" type="button" data-action="share-invite">${icon("share")} Invite</button><button class="button button-soft button-small" type="button" data-action="open-modal" data-modal="game-settings">${icon("settings")} Game setup</button></div></section>
    ${renderTimer(game, now)}
    ${renderSnapshot(state)}
    <div class="grid simple-game-grid"><div class="stack">${renderPrimaryActions(state)}${renderRecentActivity(state, now)}</div><aside class="stack">${renderTeams(game, now)}<section class="card card-pad simple-help-card"><p class="eyebrow">Need a reminder?</p><h2>Quick rules</h2><p>Open the short role guide instead of searching through the full handbook.</p><button class="button button-soft" type="button" data-action="navigate" data-view="rules">${icon("rules")} Open quick rules</button></section></aside></div>
  </div>`;
}
