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

function renderActiveQuestion(record, now, canAnswer) {
  const definition = QUESTION_BY_ID.get(record.questionId) || record;
  const remaining = questionSecondsRemaining(record, now);
  const overdue = remaining < 0;
  const answerOptions = record.answers || definition.answers || [];
  return `<article class="card card-pad simple-active-question">
    <div class="simple-active-head"><div>${categoryIcon(record.category || definition.category)}<div><p class="eyebrow">Answer now</p><h2>${escapeHtml(record.questionName || definition.name)}</h2></div></div><div class="question-countdown ${overdue ? "overdue" : ""}" data-question-countdown="${record.id}">${overdue ? `+${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}</div></div>
    <p class="simple-question-prompt">${escapeHtml(record.prompt || definition.prompt)}</p>
    ${record.note ? `<div class="callout">${icon("info")}<p>${escapeHtml(record.note)}</p></div>` : ""}
    <div class="simple-answer-meta"><span>Reward: draw ${record.reward?.draw ?? definition.reward?.draw}, keep ${record.reward?.keep ?? definition.reward?.keep}</span><span>${definition.photo ? "10" : "5"} minute deadline</span></div>
    ${canAnswer ? `<div class="answer-grid simple-answer-grid">${answerOptions.filter((option) => option !== "Photo submitted").map((option) => `<button type="button" class="answer-button" data-action="answer-question" data-question-instance="${record.id}" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}${definition.photo ? `<button type="button" class="answer-button" data-action="open-answer-photo" data-question-instance="${record.id}">${icon("camera")} Add photo</button>` : ""}${definition.customInput || answerOptions.includes("POI name") ? `<button type="button" class="answer-button" data-action="open-custom-answer" data-question-instance="${record.id}">${icon("edit")} Type answer</button>` : ""}</div>` : `<div class="callout">${icon("clock")}<p><strong>Waiting for the hider team.</strong>The timer uses the shared ask time.</p></div>`}
    ${overdue ? `<div class="callout danger">${icon("alert")}<p><strong>Deadline passed.</strong>Pause the game until the answer is complete; no card reward is earned.</p></div>` : ""}
  </article>`;
}

function renderQuestionCard(question, state, canAsk, unavailableLabel) {
  const currentRound = state.game?.round || 1;
  const previous = state.questions.filter((record) => record.questionId === question.id && (record.round || 1) === currentRound).length;
  const occurrence = previous + 1;
  const reward = repeatedReward(question, occurrence, state.settings.repeatRewardMode);
  return `<article class="simple-question-card">
    <div class="simple-question-main">${categoryIcon(question.category)}<div><div class="simple-question-title"><strong>${escapeHtml(question.name)}</strong>${previous ? `<span>Repeat ×${occurrence}</span>` : ""}</div><p>${escapeHtml(question.prompt)}</p><div class="simple-question-facts"><span>Draw ${reward.draw}, keep ${reward.keep}</span><span>${question.responseSeconds / 60} min</span>${question.requiresPin ? `<span>Pin needed</span>` : ""}</div></div></div>
    <div class="simple-question-actions"><details><summary>How to use</summary><p>${escapeHtml(question.guidance)}</p></details><button class="button ${canAsk ? "button-primary" : "button-soft"} button-small" type="button" data-action="open-ask-question" data-question-id="${question.id}" ${canAsk ? "" : "disabled"}>${icon(canAsk ? "questions" : "clock")} ${canAsk ? "Ask" : escapeHtml(unavailableLabel)}</button></div>
  </article>`;
}

function renderHistoryItem(record, now) {
  const definition = QUESTION_BY_ID.get(record.questionId) || record;
  const hasEvidence = Boolean(record.evidencePath || record.evidenceKey || record.evidenceDataUrl);
  return `<article><div><strong>${escapeHtml(record.questionName || definition.name)}</strong><small>${escapeHtml(record.answer || "No answer recorded")}${record.occurrence > 1 ? ` · repeat ×${record.occurrence}` : ""}</small></div><div><time>${relativeTime(record.askedAt, now)}</time>${hasEvidence ? `<button class="icon-button" type="button" data-action="view-evidence" data-question-instance="${record.id}" title="View photo">${icon("camera")}</button>` : ""}</div></article>`;
}

export function renderQuestionsView(state, now = Date.now()) {
  const game = state.game;
  const isHider = Boolean(game && state.profile.team === game.hiderTeam);
  const activePhase = Boolean(game && [PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase));
  const sharedDevice = game?.mode === "local";
  const canAsk = activePhase && (sharedDevice || !isHider);
  const canAnswer = activePhase && (sharedDevice || isHider);
  const unavailableLabel = !game ? "Create game" : !activePhase ? "Not started" : "Seeker only";
  const active = state.questions.filter((record) => record.status === "pending").sort((a, b) => new Date(a.askedAt) - new Date(b.askedAt));
  const visible = filteredQuestions(state);
  const history = state.questions.filter((record) => record.status !== "pending").sort((a, b) => new Date(b.askedAt) - new Date(a.askedAt));
  const categories = [{ id: "all", name: "All" }, ...Object.values(QUESTION_CATEGORIES).map(({ id, name }) => ({ id, name }))];
  const helper = !game ? "Create or join a game first." : !activePhase ? "Questions unlock after the 45-minute hiding period." : isHider && !sharedDevice ? "This device is ready to answer the seeker team's next question." : "Ask only one question at a time.";
  return `<div class="view-stack simple-questions-view">
    ${active.length ? `<div class="question-list">${active.map((record) => renderActiveQuestion(record, now, canAnswer)).join("")}</div>` : `<section class="card card-pad simple-question-ready"><span class="empty-icon">${icon("questions")}</span><div><h2>No question is waiting</h2><p>${escapeHtml(helper)}</p></div></section>`}
    <section class="card card-pad simple-question-browser">
      <div class="section-head"><div><p class="eyebrow">Investigation book</p><h2>${isHider && !sharedDevice ? "Questions the seekers can ask" : "Choose the next question"}</h2><p>The map updates automatically after a structured answer is recorded.</p></div></div>
      <div class="simple-question-toolbar"><div class="tabs simple-category-tabs" role="tablist" aria-label="Question categories">${categories.map((category) => `<button class="tab-button ${state.ui.questionCategory === category.id || (!state.ui.questionCategory && category.id === "all") ? "active" : ""}" type="button" data-action="question-category" data-category="${category.id}">${category.name}</button>`).join("")}</div><label class="simple-search"><span class="sr-only">Search questions</span>${icon("search")}<input type="search" data-action="question-search" value="${escapeHtml(state.ui.questionSearch || "")}" placeholder="Search questions..." /></label></div>
      ${!canAsk ? `<div class="callout ${game && activePhase ? "" : "warning"}">${icon("info")}<p>${escapeHtml(helper)}</p></div>` : ""}
      <div class="simple-question-list">${visible.length ? visible.map((question) => renderQuestionCard(question, state, canAsk, unavailableLabel)).join("") : `<div class="empty-state simple-empty"><div class="empty-state-inner"><strong>No matching questions</strong><span>Clear the search or choose another category.</span></div></div>`}</div>
    </section>
    <details class="card card-pad simple-details question-history-details"><summary>${icon("clock")} Question history (${history.length})</summary><div class="simple-details-body">${history.length ? `<div class="simple-history-list">${history.slice(0, 40).map((record) => renderHistoryItem(record, now)).join("")}</div>` : `<p class="muted">Completed questions will appear here.</p>`}</div></details>
    <section class="callout warning simple-fair-play">${icon("alert")}<p><strong>Fair play:</strong> wait for the previous answer, share a pin where required, and do not use Street View, reverse-image search or AI to solve the location.</p></section>
  </div>`;
}
