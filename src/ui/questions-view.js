import { QUESTION_BY_ID, QUESTION_CATEGORIES, QUESTIONS, repeatedReward } from "../data/questions.js";
import { PHASES } from "../core/constants.js";
import { escapeHtml, relativeTime } from "../core/format.js";
import { formatDuration, questionSecondsRemaining } from "../core/time.js";
import { icon } from "./icons.js";

function categoryIcon(category) {
  const name = QUESTION_CATEGORIES[category]?.symbol || "questions";
  return `<span class="category-icon ${category}">${icon(name)}</span>`;
}

function filteredQuestions(state) {
  const category = state.ui.questionCategory || "all";
  const needle = String(state.ui.questionSearch || "").trim().toLowerCase();
  return QUESTIONS.filter((question) => (category === "all" || question.category === category) && (!needle || `${question.name} ${question.prompt} ${question.guidance} ${question.tags.join(" ")}`.toLowerCase().includes(needle)));
}

function renderActiveQuestion(record, state, now, canAnswer) {
  const definition = QUESTION_BY_ID.get(record.questionId) || record;
  const remaining = questionSecondsRemaining(record, now);
  const overdue = remaining < 0;
  const answerOptions = record.answers || definition.answers || [];
  return `
    <article class="question-card active-question">
      <div class="question-card-head">
        <div class="row align-start">${categoryIcon(record.category || definition.category)}<div class="question-title"><strong>${escapeHtml(record.questionName || definition.name)}</strong><span>Asked ${relativeTime(record.askedAt, now)} · repeat cost x${record.occurrence || 1}</span></div></div>
        <div class="question-countdown ${overdue ? "overdue" : ""}" data-question-countdown="${record.id}">${overdue ? `+${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}</div>
      </div>
      <p class="question-prompt"><strong>${escapeHtml(record.prompt || definition.prompt)}</strong></p>
      ${record.note ? `<div class="callout">${icon("info")}<p>${escapeHtml(record.note)}</p></div>` : ""}
      <div class="question-meta">
        <span class="badge badge-purple">Draw ${record.reward?.draw ?? definition.reward?.draw}, keep ${record.reward?.keep ?? definition.reward?.keep}</span>
        <span class="badge ${overdue ? "badge-red" : "badge-blue"}">${definition.photo ? "10 min" : "5 min"} response</span>
        ${record.pinLabel ? `<span class="badge badge-mint">Pin: ${escapeHtml(record.pinLabel)}</span>` : ""}
      </div>
      ${canAnswer ? `
        <div class="answer-grid">
          ${answerOptions.filter((option) => option !== "Photo submitted").map((option) => `<button type="button" class="answer-button" data-action="answer-question" data-question-instance="${record.id}" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}
          ${definition.photo ? `<button type="button" class="answer-button" data-action="open-answer-photo" data-question-instance="${record.id}">${icon("camera")} Take / upload photo</button>` : ""}
          ${definition.customInput || answerOptions.includes("POI name") ? `<button type="button" class="answer-button" data-action="open-custom-answer" data-question-instance="${record.id}">${icon("edit")} Enter answer</button>` : ""}
        </div>
        ${overdue ? `<div class="callout danger">${icon("alert")}<p><strong>Response time exceeded.</strong>Call a game pause until the answer is complete; no card reward is earned.</p></div>` : ""}
      ` : `<div class="callout">${icon("clock")}<p><strong>Waiting for the hider team.</strong>The answer timer is based on the shared timestamp.</p></div>`}
    </article>
  `;
}

function renderHistoryItem(record, state, now) {
  const definition = QUESTION_BY_ID.get(record.questionId) || record;
  const hasEvidence = Boolean(record.evidencePath || record.evidenceKey || record.evidenceDataUrl);
  return `<article class="timeline-item question"><div class="timeline-top"><strong>${escapeHtml(record.questionName || definition.name)}</strong><time>${relativeTime(record.askedAt, now)}</time></div><p>${escapeHtml(record.answer || (record.status === "pending" ? "Pending" : "No answer recorded"))}${record.occurrence > 1 ? ` · repeat x${record.occurrence}` : ""}</p>${hasEvidence ? `<button class="button button-soft button-small evidence-button" type="button" data-action="view-evidence" data-question-instance="${record.id}">${icon("camera")} View photo</button>` : ""}</article>`;
}

function renderQuestionCard(question, state, canAsk, unavailableLabel) {
  const currentRound = state.game?.round || 1;
  const previous = state.questions.filter((record) => record.questionId === question.id && (record.round || 1) === currentRound).length;
  const occurrence = previous + 1;
  const reward = repeatedReward(question, occurrence, state.settings.repeatRewardMode);
  return `
    <article class="question-card">
      <div class="question-card-head">
        <div class="row align-start">${categoryIcon(question.category)}<div class="question-title"><strong>${escapeHtml(question.name)}</strong><span>${escapeHtml(QUESTION_CATEGORIES[question.category].name)}</span></div></div>
        ${previous ? `<span class="badge badge-yellow">Next use x${occurrence}</span>` : ""}
      </div>
      <p class="question-prompt">${escapeHtml(question.prompt)}</p>
      <div class="question-meta">
        <span class="badge badge-purple">Draw ${reward.draw}, keep ${reward.keep}</span>
        <span class="badge badge-blue">${question.responseSeconds / 60} min</span>
        ${question.requiresPin ? `<span class="badge badge-mint">Share a pin</span>` : ""}
        ${question.endgameFriendly ? `<span class="badge badge-orange">Endgame-friendly</span>` : ""}
      </div>
      <div class="row-between wrap"><span class="tiny muted">${escapeHtml(question.guidance)}</span><button class="button ${canAsk ? "button-primary" : "button-soft"} button-small" type="button" data-action="open-ask-question" data-question-id="${question.id}" ${canAsk ? "" : "disabled"}>${icon(canAsk ? "questions" : "clock")} ${canAsk ? "Ask" : escapeHtml(unavailableLabel)}</button></div>
    </article>
  `;
}

export function renderQuestionsView(state, now = Date.now()) {
  const game = state.game;
  const isHider = Boolean(game && state.profile.team === game.hiderTeam);
  const activePhase = Boolean(game && [PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase));
  const sharedDevice = game?.mode === "local";
  const canAsk = activePhase && (sharedDevice || !isHider);
  const canAnswer = activePhase && (sharedDevice || isHider);
  const askUnavailableLabel = !game ? "Create game" : !activePhase ? "Start seeker phase" : "Seeker only";
  const workflowMessage = !game
    ? "Create or join a game to activate timed questions."
    : !activePhase
      ? "Question controls unlock when the 45-minute hiding period ends."
      : !canAsk
        ? "You are on the hider team in Connected Mode, so this device is answer-only."
        : "Only ask the next question after the previous answer is complete.";
  const active = state.questions.filter((record) => record.status === "pending").sort((a, b) => new Date(a.askedAt) - new Date(b.askedAt));
  const visible = filteredQuestions(state);
  const history = state.questions.filter((record) => record.status !== "pending").sort((a, b) => new Date(b.askedAt) - new Date(a.askedAt));
  const categories = [{ id: "all", name: "All" }, ...Object.values(QUESTION_CATEGORIES).map(({ id, name }) => ({ id, name }))];
  return `
    <div class="view-stack">
      <section class="card card-pad">
        <div class="section-head"><div><p class="eyebrow">${isHider ? "Hider workflow" : "Seeker workflow"}</p><h2>${isHider ? "Answer one question at a time" : "Build a clean investigation trail"}</h2><p>${isHider ? "The app starts the handbook deadline, records the answer and keeps the reward auditable." : "Repeated questions automatically display their increasing cost and every ask is timestamped."}</p></div></div>
        ${active.length ? `<div class="question-list">${active.map((record) => renderActiveQuestion(record, state, now, canAnswer)).join("")}</div>` : `<div class="empty-state"><div class="empty-state-inner"><span class="empty-icon">${icon("questions")}</span><strong>No question is waiting</strong><span>${isHider && activePhase ? "The seeker team has not asked a question yet." : workflowMessage}</span></div></div>`}
      </section>

      <div class="grid grid-main">
        <section class="card card-pad stack">
          <div class="question-toolbar">
            <div class="tabs" role="tablist" aria-label="Question categories">${categories.map((category) => `<button class="tab-button ${state.ui.questionCategory === category.id || (!state.ui.questionCategory && category.id === "all") ? "active" : ""}" type="button" data-action="question-category" data-category="${category.id}">${category.name}</button>`).join("")}</div>
            <div class="row" style="min-width:min(100%,280px)"><span class="sr-only" id="question-search-label">Search questions</span><input class="input" type="search" data-action="question-search" aria-labelledby="question-search-label" value="${escapeHtml(state.ui.questionSearch || "")}" placeholder="Search questions..." /></div>
          </div>
          ${!canAsk ? `<div class="callout ${game && activePhase ? "warning" : ""}">${icon(game && activePhase ? "info" : "clock")}<p><strong>Question controls are locked.</strong>${escapeHtml(workflowMessage)}</p></div>` : ""}
          <div class="question-list">${visible.length ? visible.map((question) => renderQuestionCard(question, state, canAsk, askUnavailableLabel)).join("") : `<div class="empty-state"><div class="empty-state-inner"><span class="empty-icon">${icon("search")}</span><strong>No matching questions</strong><span>Try another category or search phrase.</span></div></div>`}</div>
        </section>
        <aside class="stack">
          <section class="card card-pad">
            <div class="section-head"><div><h2>Question history</h2><p>${state.questions.length} total asks in this game.</p></div></div>
            ${history.length ? `<div class="timeline">${history.slice(0, 40).map((record) => renderHistoryItem(record, state, now)).join("")}</div>` : `<div class="empty-state" style="min-height:140px"><div class="empty-state-inner"><span class="empty-icon">${icon("clock")}</span><strong>No completed questions</strong><span>Answers will appear here with their repeat count.</span></div></div>`}
          </section>
          <section class="card card-pad stack">
            <div><p class="eyebrow">Fair-play guardrails</p><h2>Before asking</h2></div>
            <div class="callout warning">${icon("alert")}<p><strong>One at a time.</strong>Wait until the previous question has been answered.</p></div>
            <div class="callout">${icon("location")}<p><strong>Drop and share a pin</strong>for matching, measuring, radar and tentacles before moving away.</p></div>
            <div class="callout danger">${icon("eye")}<p><strong>Banned tools:</strong> Street View, reverse-image search and AI used to solve the hiding location.</p></div>
          </section>
        </aside>
      </div>
    </div>
  `;
}
