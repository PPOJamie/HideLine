import { DEFAULT_DURATIONS, PHASES, TEAM_LABELS } from "../core/constants.js";
import { escapeHtml, formatClock, initials, relativeTime } from "../core/format.js";
import { activeElapsedSeconds, formatDuration } from "../core/time.js";
import { calculateScore } from "../core/score.js";
import { STATIONS, STATION_BY_ID } from "../data/stations.js";
import { buildDeductionViewModel } from "./deduction-view.js";
import { icon } from "./icons.js";

function phaseData(game, now) {
  if (!game) return { label: "No game", timer: "--:--", helper: "Create or join a game to begin." };
  const timers = game.timers || {};
  const elapsed = activeElapsedSeconds(timers.roundStartedAt, timers.roundStoppedAt, timers.pauses, now);
  const hidingPeriod = Number(timers.hidingPeriodSeconds || DEFAULT_DURATIONS.hidingPeriodSeconds);
  const cutoff = Number(timers.cutoffSeconds || DEFAULT_DURATIONS.roundCutoffSeconds);
  if (game.phase === PHASES.LOBBY) return { label: "Ready to start", timer: "Ready", helper: "Choose the hiding team, then start the round." };
  if (game.phase === PHASES.HIDING) {
    const remaining = Math.max(0, hidingPeriod - elapsed);
    return { label: "Hiding period", timer: formatDuration(remaining), helper: `${TEAM_LABELS[game.hiderTeam]} must reach a valid 500 m station zone.` };
  }
  if ([PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase)) {
    const hidingElapsed = Math.max(0, elapsed - hidingPeriod);
    const cutoffRemaining = Math.max(0, cutoff - elapsed);
    return {
      label: game.phase === PHASES.ENDGAME ? "Endgame" : "Seeking",
      timer: formatDuration(hidingElapsed),
      helper: `${formatDuration(cutoffRemaining, { compact: true })} until the round cutoff.`
    };
  }
  const hidingElapsed = Math.max(0, elapsed - hidingPeriod);
  return {
    label: "Round complete",
    timer: formatDuration(hidingElapsed),
    helper: timers.foundAt ? `Found at ${formatClock(timers.foundAt)}.` : "Round stopped at the cutoff."
  };
}

function timerActions(game, currentRole, pendingCount) {
  if (game.phase === PHASES.LOBBY) {
    return `<button class="button button-primary button-large" type="button" data-action="open-modal" data-modal="start-round">${icon("play")} Start round</button>`;
  }
  if (game.phase === PHASES.HIDING) {
    return `<button class="button button-primary" type="button" data-action="navigate" data-view="map">${icon("map")} ${currentRole === "Hider" ? "Check my zone" : "Open map"}</button>`;
  }
  if (game.phase === PHASES.SEEKING) {
    return `<button class="button button-primary button-large" type="button" data-action="navigate" data-view="questions">${icon("questions")} ${pendingCount ? "Open pending question" : currentRole === "Seeker" ? "Ask a question" : "View questions"}</button>
      <button class="button button-ghost" type="button" data-action="trigger-endgame">${icon("target")} Start endgame</button>`;
  }
  if (game.phase === PHASES.ENDGAME) {
    return `<button class="button button-primary button-large" type="button" data-action="navigate" data-view="map">${icon("target")} Open endgame map</button>
      <button class="button button-ghost" type="button" data-action="mark-found">${icon("check")} Mark found</button>`;
  }
  if (game.round === 1) {
    return `<button class="button button-primary button-large" type="button" data-action="next-round">${icon("refresh")} Prepare round 2</button>`;
  }
  return `<button class="button button-primary button-large" type="button" data-action="open-modal" data-modal="score-adjustment">${icon("trophy")} Finalise score</button>`;
}

function renderTimer(game, currentRole, pendingCount, now) {
  const phase = phaseData(game, now);
  const paused = Boolean(game?.timers?.pauses?.at(-1) && !game.timers.pauses.at(-1).endedAt);
  return `
    <section class="card card-dark card-pad simple-timer" aria-label="Round timer">
      <div class="simple-timer-copy">
        <div class="row wrap gap-sm"><span class="badge badge-dark">Round ${game.round}</span><span class="badge ${paused ? "badge-orange" : "badge-mint"}">${paused ? "Paused" : phase.label}</span></div>
        <div class="timer-readout" data-live-timer>${phase.timer}</div>
        <p class="timer-sub">${escapeHtml(phase.helper)}</p>
      </div>
      <div class="simple-timer-actions">
        ${timerActions(game, currentRole, pendingCount)}
        ${game.phase !== PHASES.LOBBY && game.phase !== PHASES.COMPLETE ? `<button class="button ${paused ? "button-mint" : "button-ghost"}" type="button" data-action="toggle-pause">${icon(paused ? "resume" : "pause")} ${paused ? "Resume" : "Pause"}</button>` : ""}
        ${game.phase === PHASES.ENDGAME ? `<button class="button button-ghost button-small" type="button" data-action="cancel-endgame">Accidental trigger</button>` : ""}
      </div>
    </section>`;
}

function memberNames(game, teamId) {
  const members = (game.members || []).filter((member) => member.team === teamId);
  if (!members.length) return "No players yet";
  return members.map((member) => member.displayName || member.display_name || "Player").join(", ");
}

function renderTeams(game) {
  return `<section class="card card-pad simple-team-panel">
    <div class="section-head"><div><h2>Teams</h2><p>The active role switches automatically each round.</p></div></div>
    <div class="simple-team-grid">
      ${["alpha", "bravo"].map((teamId) => {
        const hiding = game.hiderTeam === teamId;
        return `<article class="simple-team-row ${hiding ? "is-hiding" : ""}"><span class="avatar">${escapeHtml(initials(game.teams?.[teamId]?.name || TEAM_LABELS[teamId]))}</span><div><strong>${escapeHtml(game.teams?.[teamId]?.name || TEAM_LABELS[teamId])}</strong><small>${escapeHtml(memberNames(game, teamId))}</small></div><span class="badge ${hiding ? "badge-orange" : "badge-blue"}">${hiding ? "Hiding" : "Seeking"}</span></article>`;
      }).join("")}
    </div>
  </section>`;
}

function quickStat({ label, value, note, iconName, action, view, modal, tone = "" }) {
  const attrs = action ? `data-action="${action}"` : view ? `data-action="navigate" data-view="${view}"` : modal ? `data-action="open-modal" data-modal="${modal}"` : "";
  return `<button class="card simple-stat ${tone}" type="button" ${attrs}><span class="simple-stat-icon">${icon(iconName)}</span><span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><em>${escapeHtml(note)}</em></span>${icon("chevron")}</button>`;
}

function trapSeconds(trap) {
  if (!trap.placedAt) return 0;
  const end = trap.removedAt || Date.now();
  return Math.max(0, Math.floor((new Date(end) - new Date(trap.placedAt)) / 1000));
}

function renderGameKit(state, score, currentRole) {
  const game = state.game;
  const station = STATION_BY_ID.get(state.privateTeamState.stationId);
  const cards = state.privateTeamState.cards || [];
  const traps = game.traps || [];
  const activeTransit = game.transit?.[state.profile.team]?.active;
  const showHiderTools = game.mode === "local" || currentRole === "Hider";
  return `<details class="card card-pad simple-expander game-kit">
    <summary><span>${icon("tools")}<span><strong>Game kit</strong><small>Station, cards, traps, transit and scoring</small></span></span>${icon("chevron")}</summary>
    <div class="simple-expander-body stack">
      <div class="grid grid-2 simple-kit-grid">
        ${showHiderTools ? `<section class="simple-kit-section">
          <div class="section-head compact"><div><h3>Private hiding station</h3><p>${station ? escapeHtml(station.name) : "Not selected"}</p></div></div>
          <form class="station-picker" data-form="station-select">
            <div class="field"><label for="simple-station">Station</label><select id="simple-station" name="stationId"><option value="">Choose a station…</option>${STATIONS.map((item) => `<option value="${item.id}" ${item.id === state.privateTeamState.stationId ? "selected" : ""}>${escapeHtml(item.name)}${item.note ? ` — ${escapeHtml(item.note)}` : ""}</option>`).join("")}</select></div>
            <button class="button button-soft button-small" type="submit">${icon("check")} Save station</button>
          </form>
        </section>
        <section class="simple-kit-section">
          <div class="section-head compact"><div><h3>Hider cards</h3><p>${cards.length} of ${state.privateTeamState.handLimit || 6} recorded</p></div><button class="button button-soft button-small" type="button" data-action="open-modal" data-modal="add-card">${icon("plus")} Add</button></div>
          ${cards.length ? `<div class="simple-chip-list">${cards.map((card) => `<span class="simple-removable-chip"><span><strong>${escapeHtml(card.name)}</strong>${card.note ? `<small>${escapeHtml(card.note)}</small>` : ""}</span><button type="button" data-action="remove-card" data-id="${card.id}" aria-label="Remove ${escapeHtml(card.name)}">×</button></span>`).join("")}</div>` : `<p class="muted small">Add only the cards the hiders keep.</p>`}
        </section>` : `<section class="simple-kit-section simple-private-note"><div class="section-head compact"><div><h3>Hider information stays private</h3><p>The other team manages its station and cards on its own devices.</p></div></div></section>`}
        <section class="simple-kit-section">
          <div class="section-head compact"><div><h3>Time traps</h3><p>${traps.filter((trap) => !trap.removedAt).length} active</p></div><button class="button button-soft button-small" type="button" data-action="open-modal" data-modal="add-trap">${icon("plus")} Place</button></div>
          ${traps.length ? `<div class="simple-list">${traps.slice(-5).reverse().map((trap) => `<div class="simple-list-row"><span><strong>${escapeHtml(trap.station)}</strong><small>${trap.removedAt ? `Finished · ${formatDuration(trapSeconds(trap), { compact: true })}` : `Active · ${formatDuration(trapSeconds(trap), { compact: true })}`}</small></span>${!trap.removedAt ? `<button class="button button-soft button-small" type="button" data-action="remove-trap" data-id="${trap.id}">Passed</button>` : ""}</div>`).join("")}</div>` : `<p class="muted small">Only use this when a trap card is played.</p>`}
        </section>
        <section class="simple-kit-section">
          <div class="section-head compact"><div><h3>Round score</h3><p>${formatDuration(score.totalRoundSeconds)} projected total</p></div><button class="button button-soft button-small" type="button" data-action="open-modal" data-modal="score-adjustment">${icon("plus")} Adjust</button></div>
          <div class="row wrap"><button class="button button-soft button-small" type="button" data-action="use-live-time">Use live time</button><button class="button button-soft button-small" type="button" data-action="open-modal" data-modal="game-settings">Game settings</button></div>
        </section>
      </div>
      <div class="simple-kit-footer">
        <button class="button button-primary" type="button" data-action="open-modal" data-modal="${activeTransit ? "transit-end" : "transit-start"}">${icon("train")} ${activeTransit ? "I am off the train" : "I am boarding a train"}</button>
        <button class="button button-soft" type="button" data-action="send-safety-check">${icon("safety")} Safety check-in</button>
        <button class="button button-soft" type="button" data-action="navigate" data-view="rules">${icon("bookOpen")} Quick rules</button>
      </div>
    </div>
  </details>`;
}

function eventText(event) {
  const payload = event.payload || event;
  const type = event.type || event.event_type;
  if (type === "question") return `${payload.authorName || "Seeker"} asked ${payload.questionName || "a question"}`;
  if (type === "answer") return `Answer: ${payload.answer || "recorded"}`;
  if (type === "transit-start") return `${payload.authorName || "Team"} boarded at ${payload.station || "a station"}`;
  if (type === "transit-end") return `${payload.authorName || "Team"} left the train`;
  if (type === "pause") return "Game paused";
  if (type === "resume") return "Game resumed";
  if (type === "found") return "Hiders found";
  if (type === "chat") return `${payload.authorName || "Player"}: ${payload.message || ""}`;
  if (type === "trap") return payload.message || "Time trap updated";
  return payload.message || payload.note || payload.title || "Game update";
}

function renderRecentActivity(state, now) {
  const events = state.events.slice(0, 6);
  return `<section class="card card-pad simple-activity">
    <div class="section-head"><div><h2>Recent activity</h2><p>Only the latest useful updates are shown.</p></div></div>
    ${events.length ? `<div class="simple-list">${events.map((event) => {
      const createdAt = event.createdAt || event.created_at || new Date().toISOString();
      return `<div class="simple-list-row activity-row"><span class="activity-dot"></span><span><strong>${escapeHtml(eventText(event))}</strong><small>${relativeTime(createdAt, now)}</small></span></div>`;
    }).join("")}</div>` : `<p class="muted">Nothing has happened yet.</p>`}
    <form class="chat-form compact-chat" data-form="chat"><label class="sr-only" for="chat-message">Team note</label><input id="chat-message" name="message" maxlength="300" placeholder="Add a short team note…" autocomplete="off" /><button class="button button-secondary" type="submit">Send</button></form>
  </section>`;
}

function renderNoGame() {
  return `<div class="view-stack simple-start">
    <section class="card card-dark card-pad simple-start-hero">
      <div><p class="eyebrow">London Hide + Seek</p><h2>A simple game-day companion.</h2><p>Use one screen for the timer, one for questions and one for the deduction map. The app keeps the technical work in the background.</p></div>
      <div class="hero-actions"><button class="button button-primary button-large" type="button" data-action="open-modal" data-modal="new-game">${icon("play")} Create a game</button><button class="button button-ghost" type="button" data-action="open-modal" data-modal="join-game">${icon("link")} Join a game</button></div>
    </section>
    <section class="simple-three-steps">
      <article class="card card-pad"><span>1</span><div><strong>Start the round</strong><p>The 45-minute hiding timer and cutoff are handled for you.</p></div></article>
      <article class="card card-pad"><span>2</span><div><strong>Ask and answer</strong><p>Each question has the correct deadline and reward.</p></div></article>
      <article class="card card-pad"><span>3</span><div><strong>Follow the map</strong><p>Impossible areas are greyed out automatically.</p></div></article>
    </section>
    <section class="callout warning">${icon("safety")}<p><strong>Keep it safe.</strong>Stop walking before using the app, follow staff instructions and never hide somewhere inaccessible or disruptive.</p></section>
  </div>`;
}

export function renderPlay(state, now = Date.now()) {
  if (!state.game) return renderNoGame();
  const game = state.game;
  const currentRole = state.profile.team === game.hiderTeam ? "Hider" : "Seeker";
  const pendingCount = state.questions.filter((record) => record.status === "pending").length;
  const score = calculateScore(game.scoreByRound?.[game.round] || {});
  const cards = state.privateTeamState.cards || [];
  let mapValue = "Private";
  let mapNote = "Seeker team only";
  try {
    const model = buildDeductionViewModel(state);
    if (model.canView) {
      mapValue = `${model.summary.remaining} left`;
      mapNote = `${model.summary.eliminated} ruled out`;
    }
  } catch {
    mapValue = "Open map";
    mapNote = "See remaining areas";
  }
  return `<div class="view-stack simple-game-view">
    <section class="simple-game-heading row-between wrap">
      <div><p class="eyebrow">${escapeHtml(game.code || "LOCAL")} · You are a ${currentRole.toLowerCase()}</p><h2>${escapeHtml(game.name)}</h2><p>${game.mode === "connected" ? "Changes are shared live with the room." : "This game is saved on this device."}</p></div>
      <div class="row wrap"><button class="button button-soft button-small" type="button" data-action="share-invite">${icon("share")} Invite</button><button class="button button-soft button-small" type="button" data-action="open-modal" data-modal="game-settings">${icon("settings")} Edit game</button></div>
    </section>
    ${renderTimer(game, currentRole, pendingCount, now)}
    <section class="simple-stat-grid" aria-label="Game shortcuts">
      ${quickStat({ label: "Questions", value: pendingCount ? `${pendingCount} waiting` : "Ready", note: pendingCount ? "Answer before asking another" : currentRole === "Seeker" ? "Choose the next clue" : "No question waiting", iconName: "questions", view: "questions", tone: pendingCount ? "attention" : "" })}
      ${quickStat({ label: "Deduction map", value: mapValue, note: mapNote, iconName: "map", view: "map" })}
      ${quickStat({ label: "Game kit", value: currentRole === "Hider" ? `${cards.length} cards` : "Round tools", note: "Cards, traps, transit and score", iconName: "tools", action: "open-game-kit" })}
      ${quickStat({ label: "Projected score", value: formatDuration(score.totalRoundSeconds), note: "Includes the 45-minute hiding period", iconName: "trophy", modal: "score-adjustment" })}
    </section>
    <div class="grid simple-home-grid">
      <div class="stack">${renderTeams(game)}${renderRecentActivity(state, now)}</div>
      <aside class="stack">
        <section class="card card-pad next-step-card"><p class="eyebrow">Your next step</p><h2>${currentRole === "Hider" ? "Stay ready to answer" : "Ask one useful question"}</h2><p>${currentRole === "Hider" ? "Keep inside the 500 m zone, answer truthfully and use the full response time when needed." : "Share any required pin first. Once the answer arrives, the map updates automatically."}</p><button class="button button-primary" type="button" data-action="navigate" data-view="${game.phase === PHASES.HIDING && currentRole === "Hider" ? "map" : "questions"}">${icon(game.phase === PHASES.HIDING && currentRole === "Hider" ? "map" : "questions")} ${game.phase === PHASES.HIDING && currentRole === "Hider" ? "Check my zone" : "Open questions"}</button></section>
      </aside>
    </div>
    ${renderGameKit(state, score, currentRole)}
  </div>`;
}
