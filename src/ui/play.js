import { DEFAULT_DURATIONS, PHASES, TEAM_LABELS } from "../core/constants.js";
import { escapeHtml, formatClock, formatDateTime, initials, relativeTime, titleCase } from "../core/format.js";
import { activeCountdownSeconds, activeElapsedSeconds, formatDuration } from "../core/time.js";
import { calculateScore } from "../core/score.js";
import { SCHEDULE } from "../data/rules.js";
import { icon } from "./icons.js";

function phaseData(game, now) {
  if (!game) return { label: "No game", timer: "--:--", helper: "Create or join a game to begin.", activeIndex: 0 };
  const timers = game.timers || {};
  const elapsed = activeElapsedSeconds(timers.roundStartedAt, timers.roundStoppedAt, timers.pauses, now);
  const hidingPeriod = Number(timers.hidingPeriodSeconds || DEFAULT_DURATIONS.hidingPeriodSeconds);
  const cutoff = Number(timers.cutoffSeconds || DEFAULT_DURATIONS.roundCutoffSeconds);
  if (game.phase === PHASES.LOBBY) return { label: "Lobby", timer: "Ready", helper: "Choose the first hiding team and start when everyone is ready.", activeIndex: 0, elapsed };
  if (game.phase === PHASES.HIDING) {
    const remaining = Math.max(0, hidingPeriod - elapsed);
    return { label: "Hiding period", timer: formatDuration(remaining), helper: `${TEAM_LABELS[game.hiderTeam]} must reach a valid 500 m hiding zone.`, activeIndex: 0, elapsed, remaining };
  }
  if ([PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase)) {
    const hidingElapsed = Math.max(0, elapsed - hidingPeriod);
    const cutoffRemaining = Math.max(0, cutoff - elapsed);
    return { label: game.phase === PHASES.ENDGAME ? "Endgame" : "Seeking", timer: formatDuration(hidingElapsed), helper: `${formatDuration(cutoffRemaining, { compact: true })} until the round cutoff.`, activeIndex: game.phase === PHASES.ENDGAME ? 2 : 1, elapsed, cutoffRemaining, hidingElapsed };
  }
  const hidingElapsed = Math.max(0, elapsed - hidingPeriod);
  return { label: "Round complete", timer: formatDuration(hidingElapsed), helper: timers.foundAt ? `Found at ${formatClock(timers.foundAt)}.` : "Round stopped at the cutoff.", activeIndex: 3, elapsed, hidingElapsed };
}

function renderTimer(game, now) {
  const phase = phaseData(game, now);
  const paused = Boolean(game?.timers?.pauses?.at(-1) && !game.timers.pauses.at(-1).endedAt);
  const phases = [
    ["Hide", "45 min"], ["Seek", "up to 4 h"], ["Endgame", "hold spot"], ["Complete", "score"]
  ];
  return `
    <section class="card card-dark card-pad timer-panel" aria-label="Round timer">
      <div class="timer-main">
        <div>
          <p class="eyebrow">Round ${game?.round || 1} · ${paused ? "Paused" : phase.label}</p>
          <div class="timer-readout" data-live-timer>${phase.timer}</div>
          <div class="timer-sub">${escapeHtml(phase.helper)}</div>
        </div>
        <div class="stack">
          ${game?.phase !== PHASES.LOBBY && game?.phase !== PHASES.COMPLETE ? `
            <button class="button ${paused ? "button-mint" : "button-ghost"}" type="button" data-action="toggle-pause">${icon(paused ? "resume" : "pause")} ${paused ? "Resume" : "Pause"}</button>
          ` : ""}
          ${game?.phase === PHASES.LOBBY ? `<button class="button button-primary" type="button" data-action="open-modal" data-modal="start-round">${icon("play")} Start round</button>` : ""}
          ${game?.phase === PHASES.SEEKING ? `<button class="button button-ghost" type="button" data-action="trigger-endgame">${icon("eye")} Start endgame</button>` : ""}
          ${game?.phase === PHASES.ENDGAME ? `<button class="button button-ghost" type="button" data-action="cancel-endgame">${icon("route")} Accidental trigger</button>` : ""}
          ${[PHASES.SEEKING, PHASES.ENDGAME].includes(game?.phase) ? `<button class="button button-primary" type="button" data-action="mark-found">${icon("target")} Mark found</button>` : ""}
        </div>
      </div>
      <div class="phase-rail">
        ${phases.map(([label, detail], index) => `<div class="phase-step ${index === phase.activeIndex ? "active" : index < phase.activeIndex ? "done" : ""}"><strong>${label}</strong><small>${detail}</small></div>`).join("")}
      </div>
    </section>
  `;
}

function renderTeam(game, teamId, state, now) {
  const members = (game.members || []).filter((member) => member.team === teamId);
  const active = game.hiderTeam === teamId;
  const transit = game.transit?.[teamId];
  return `
    <article class="card team-card ${active ? "active-team" : ""}">
      <div class="team-header">
        <div class="team-name"><span class="team-mark ${teamId}"></span><span>${escapeHtml(game.teams?.[teamId]?.name || TEAM_LABELS[teamId])}</span></div>
        <span class="badge ${active ? "badge-orange" : "badge-blue"}">${active ? "Hiding" : "Seeking"}</span>
      </div>
      ${transit?.active ? `<div class="callout"><div>${icon("train")}</div><p><strong>On a train</strong>${escapeHtml(transit.station || "Transit intent shared")} · ${relativeTime(transit.startedAt, now)}</p></div>` : ""}
      <div class="member-list">
        ${members.length ? members.map((member) => {
          const online = now - new Date(member.lastSeen || member.last_seen || member.joinedAt || 0).getTime() < 120_000;
          return `<div class="member-row"><div class="member-meta"><span class="avatar">${escapeHtml(initials(member.displayName || member.display_name))}</span><strong>${escapeHtml(member.displayName || member.display_name || "Player")}${member.isHost || member.is_host ? " · Host" : ""}</strong></div><span class="member-status ${online ? "online" : ""}" title="${online ? "Recently active" : "Not recently active"}"></span></div>`;
        }).join("") : `<div class="member-row"><span class="muted small">No players on this team yet.</span></div>`}
      </div>
    </article>
  `;
}

function eventCopy(event) {
  const payload = event.payload || event;
  const author = payload.authorName || payload.displayName || event.authorName || "Player";
  switch (event.type || event.event_type) {
    case "question": return { title: `${author} asked ${payload.questionName || "a question"}`, text: payload.prompt || "Investigation question", className: "question" };
    case "answer": return { title: `${author} answered`, text: payload.answer || "Answer recorded", className: "question" };
    case "transit-start": return { title: `${author} boarded a train`, text: payload.station || payload.note || "Transit intent shared", className: "transit" };
    case "transit-end": return { title: `${author} left transit`, text: payload.station || payload.note || "Off train", className: "transit" };
    case "pause": return { title: "Game paused", text: payload.reason || "Pause recorded", className: "alert" };
    case "resume": return { title: "Game resumed", text: payload.reason || "Timer restarted", className: "alert" };
    case "found": return { title: "Hiders found", text: payload.note || "Round timer stopped", className: "alert" };
    case "chat": return { title: author, text: payload.message || "", className: "chat" };
    case "trap": return { title: "Time trap update", text: payload.message || payload.station || "Trap changed", className: "alert" };
    case "safety": return { title: "Safety check", text: payload.message || "Player requested a check-in", className: "alert" };
    default: return { title: payload.title || titleCase(event.type || event.event_type || "Update"), text: payload.message || payload.note || "", className: "" };
  }
}

function renderTimeline(state, now) {
  const events = state.events.slice(0, 18);
  return `
    <section class="card card-pad">
      <div class="section-head"><div><h2>Live timeline</h2><p>Questions, movement, pauses, traps and team messages.</p></div><button class="button button-soft button-small" type="button" data-action="export-game">${icon("download")} Export</button></div>
      ${events.length ? `<div class="timeline">${events.map((event) => {
        const copy = eventCopy(event);
        const createdAt = event.createdAt || event.created_at || new Date().toISOString();
        return `<article class="timeline-item ${copy.className}"><div class="timeline-top"><strong>${escapeHtml(copy.title)}</strong><time datetime="${createdAt}">${relativeTime(createdAt, now)}</time></div>${copy.text ? `<p>${escapeHtml(copy.text)}</p>` : ""}</article>`;
      }).join("")}</div>` : `<div class="empty-state"><div class="empty-state-inner"><span class="empty-icon">${icon("route")}</span><strong>No game events yet</strong><span>Start the round or post a team message. Every important action is timestamped here.</span></div></div>`}
      <form class="chat-form" data-form="chat">
        <label class="sr-only" for="chat-message">Team message</label>
        <input id="chat-message" name="message" maxlength="300" placeholder="Add a timestamped note for everyone..." autocomplete="off" />
        <button class="button button-secondary" type="submit">${icon("chat")} Send</button>
      </form>
    </section>
  `;
}

function renderRoundSummary(game) {
  const score = calculateScore(game.scoreByRound?.[game.round] || {});
  const timers = game.timers || {};
  return `
    <section class="card card-pad">
      <div class="section-head"><div><h2>Round snapshot</h2><p>Key numbers recorded for the active round.</p></div></div>
      <div class="grid grid-2">
        <div class="metric-card card"><span class="metric-label">Round start</span><strong class="metric-value" style="font-size:1.65rem">${timers.roundStartedAt ? formatClock(timers.roundStartedAt) : "Not set"}</strong><span class="metric-foot">45-minute hiding period</span></div>
        <div class="metric-card card"><span class="metric-label">Projected score</span><strong class="metric-value" style="font-size:1.65rem">${formatDuration(score.totalRoundSeconds)}</strong><span class="metric-foot">Includes hiding period</span></div>
      </div>
      <div class="row wrap" style="margin-top:14px">
        <button class="button button-soft" type="button" data-action="navigate" data-view="tools">${icon("trophy")} Open score calculator</button>
        ${game.phase === PHASES.COMPLETE && game.round === 1 ? `<button class="button button-primary" type="button" data-action="next-round">${icon("refresh")} Prepare round 2</button>` : ""}
      </div>
    </section>
  `;
}

function renderSchedule(round) {
  const rows = round === 2 ? SCHEDULE.round2 : SCHEDULE.round1;
  return `<section class="card card-pad"><div class="section-head"><div><h2>Nominal day plan</h2><p>The handbook schedule; actual start times can be mutually adjusted.</p></div></div><div class="schedule">${rows.map((row) => `<div class="schedule-row"><div class="schedule-time">${row.time}</div><div><strong>${row.title}</strong><span>${row.detail}</span></div></div>`).join("")}</div></section>`;
}

function renderNoGame() {
  return `
    <div class="view-stack">
      <section class="card card-dark card-pad hero">
        <div class="hero-copy">
          <p class="eyebrow">London transit hide + seek</p>
          <h2>Run the whole game day from one calm, shared board.</h2>
          <p>HideLine turns the handbook into timers, question workflows, a 500 m zone check, live transit intent, card and trap records, scoring and optional real-time team sync.</p>
          <div class="hero-actions">
            <button class="button button-primary" type="button" data-action="open-modal" data-modal="new-game">${icon("play")} Create a game</button>
            <button class="button button-ghost" type="button" data-action="open-modal" data-modal="join-game">${icon("link")} Join with a code</button>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true"><div class="route-orbit"><span class="route-node n1"></span><span class="route-node n2"></span><span class="route-node n3"></span></div></div>
      </section>
      <div class="grid grid-3">
        <article class="card metric-card"><span class="category-icon thermometer">${icon("clock")}</span><strong>Round control</strong><span class="metric-foot">45-minute release, pauses, cutoff and found time.</span></article>
        <article class="card metric-card"><span class="category-icon radar">${icon("wifi")}</span><strong>Team linking</strong><span class="metric-foot">Optional Supabase rooms, presence, chat and shared game state.</span></article>
        <article class="card metric-card"><span class="category-icon measuring">${icon("map")}</span><strong>Map-aware tools</strong><span class="metric-foot">Authoritative game map, GPS zone check and seeker movement.</span></article>
      </div>
      <div class="grid grid-main">
        ${renderSchedule(1)}
        <section class="card card-pad stack">
          <div><p class="eyebrow">Designed for the handbook</p><h2>Rules that surface at the right moment</h2></div>
          <div class="callout success">${icon("check")}<p><strong>Offline-capable local mode</strong>Practice or run one device without an account.</p></div>
          <div class="callout">${icon("link")}<p><strong>Connected Mode</strong>Link team-mates and opponents through a room code after a one-time Supabase setup.</p></div>
          <div class="callout warning">${icon("safety")}<p><strong>Privacy first</strong>Location is opt-in and hider sharing defaults to team-only.</p></div>
        </section>
      </div>
    </div>
  `;
}

export function renderPlay(state, now = Date.now()) {
  if (!state.game) return renderNoGame();
  const game = state.game;
  const currentTeam = state.profile.team;
  const currentRole = currentTeam === game.hiderTeam ? "Hider" : "Seeker";
  return `
    <div class="view-stack">
      <section class="row-between wrap">
        <div>
          <p class="eyebrow">${escapeHtml(game.code || "LOCAL")} · ${escapeHtml(currentRole)} view</p>
          <h2>${escapeHtml(game.name)}</h2>
          <p class="lead">${game.mode === "connected" ? "Live changes are shared with all room members." : "This game is stored on this device. Enable Connected Mode to link other phones."}</p>
        </div>
        <div class="row wrap">
          <button class="button button-soft" type="button" data-action="share-invite">${icon("share")} Share invite</button>
          <button class="button button-soft" type="button" data-action="open-modal" data-modal="game-settings">${icon("settings")} Game</button>
        </div>
      </section>
      ${renderTimer(game, now)}
      <div class="grid grid-main">
        <div class="stack">
          <section class="grid grid-2" aria-label="Teams">${renderTeam(game, "alpha", state, now)}${renderTeam(game, "bravo", state, now)}</section>
          ${renderTimeline(state, now)}
        </div>
        <aside class="stack">
          <section class="card card-pad stack">
            <div><p class="eyebrow">Your role</p><h2>${currentRole}</h2><p class="muted">${currentRole === "Hider" ? "Protect the secret station, answer truthfully and manage cards." : "Share pins and transit intent, then eliminate the map one question at a time."}</p></div>
            <div class="row wrap">
              <button class="button button-primary" type="button" data-action="navigate" data-view="${currentRole === "Hider" ? "questions" : "questions"}">${icon("questions")} ${currentRole === "Hider" ? "Answer questions" : "Ask a question"}</button>
              <button class="button button-soft" type="button" data-action="navigate" data-view="map">${icon("map")} Map tools</button>
            </div>
          </section>
          ${renderRoundSummary(game)}
          ${renderSchedule(game.round)}
        </aside>
      </div>
    </div>
  `;
}
