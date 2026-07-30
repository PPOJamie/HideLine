import { QUESTION_BY_ID, QUESTION_CATEGORIES, QUESTIONS, repeatedReward } from "../data/questions.js";
import { PHASES } from "../core/constants.js";
import { escapeHtml, relativeTime } from "../core/format.js";
import { formatDuration, questionSecondsRemaining } from "../core/time.js";
import { icon } from "./icons.js";
import { renderQuestionLocations } from "./question-location.js";

function categoryIcon(category) {
  const name = QUESTION_CATEGORIES[category]?.symbol || "questions";
  return `<span class="category-icon ${category}">${icon(name)}</span>`;
}

function filteredQuestions(state) {
  const category = state.ui.questionCategory || "all";
  const needle = String(state.ui.questionSearch || "").trim().toLowerCase();
  return QUESTIONS.filter((question) => {
    const categoryMatch = category === "all" || question.category === category;
    const textMatch = !needle || `${question.name} ${question.prompt} ${question.guidance} ${question.tags.join(" ")}`.toLowerCase().includes(needle);
    return categoryMatch && textMatch;
  });
}

function renderMapReference(record) {
  const reference = record?.mapReference;
  if (!reference?.name) return "";
  const distance = Number(reference.seekerDistanceMetres);
  const distanceText = Number.isFinite(distance) ? `${Math.round(distance)} m from the seeker pin` : "";
  return `<section class="question-reference-card"><div class="question-reference-icon">${icon("measure")}</div><div><span>Map reference used</span><strong>${escapeHtml(reference.name)}</strong><p>${escapeHtml([reference.method, distanceText].filter(Boolean).join(" · "))}</p>${reference.explanation ? `<p class="measurement-explanation">${escapeHtml(reference.explanation)}</p>` : ""}<small>${escapeHtml(reference.source || "Game map")}</small></div></section>`;
}

function renderChoiceAnswer(record) {
  const choices = Array.isArray(record.answerChoices) ? record.answerChoices : [];
  if (!choices.length) return "";
  return `<form class="choice-answer-form" data-form="choice-answer" data-question-instance="${escapeHtml(record.id)}"><div class="field"><label for="choice-${escapeHtml(record.id)}">Choose the mapped answer</label><select id="choice-${escapeHtml(record.id)}" name="answerFeatureId" required><option value="">Select one…</option>${choices.map((choice) => { const metres = Number(choice.distanceFromSeekerMetres); const suffix = Number.isFinite(metres) ? ` — ${metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`} from seeker pin` : ""; return `<option value="${escapeHtml(choice.id)}">${escapeHtml(choice.name + suffix)}</option>`; }).join("")}</select><span class="field-hint">Only mapped places within 2 km of the seeker pin are listed.</span></div><div class="field"><label for="choice-note-${escapeHtml(record.id)}">Optional explanation</label><textarea id="choice-note-${escapeHtml(record.id)}" name="note" maxlength="400"></textarea></div><button class="button button-primary" type="submit">${icon("check")} Submit selected answer</button></form>`;
}

function renderWaterAnswerAction(record) {
  const seekerDistance = Number(record.mapReference?.seekerDistanceMetres ?? record.deductionInput?.seekerDistanceMetres);
  const workflowReady = Number.isFinite(seekerDistance) && Number(record.deductionInput?.waterWorkflowVersion || 0) >= 2;
  if (!workflowReady) {
    return `<section class="water-answer-entry water-answer-entry-error"><div><span class="water-answer-entry-icon">${icon("alert")}</span><div><strong>This water question must be re-asked</strong><p>It was created with the old place-name list or has no valid seeker-to-edge distance. Ask the seekers to cancel it and use the new map-only Body of Water workflow.</p></div></div></section>`;
  }
  const distanceText = `${Math.round(seekerDistance)} m`;
  return `<section class="water-answer-entry"><div><span class="water-answer-entry-icon">${icon("measure")}</span><div><strong>Use the private water calculator</strong><p>The seeker’s baseline is ${escapeHtml(distanceText)}. Pick your current location and your own nearest valid water edge; HideLine will calculate Closer or Further.</p></div></div><button class="button button-primary button-large" type="button" data-action="open-water-answer" data-question-instance="${escapeHtml(record.id)}">${icon("map")} Calculate and answer</button><small>Your two private map points are not shared with the seeker team.</small></section>`;
}

function renderActiveQuestion(record, now, canAnswer) {
  const definition = QUESTION_BY_ID.get(record.questionId) || record;
  const remaining = questionSecondsRemaining(record, now);
  const overdue = remaining < 0;
  const answerOptions = record.answers || definition.answers || [];
  const answerControls = record.questionId === "measuring-water"
    ? renderWaterAnswerAction(record)
    : `${renderChoiceAnswer(record)}<div class="answer-grid simple-answer-grid">
      ${answerOptions.filter((option) => !["Photo submitted", "POI name"].includes(option)).map((option) => `<button type="button" class="answer-button" data-action="answer-question" data-question-instance="${record.id}" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}
      ${definition.photo ? `<button type="button" class="answer-button" data-action="open-answer-photo" data-question-instance="${record.id}">${icon("camera")} Add photo</button>` : ""}
      ${(definition.customInput || answerOptions.includes("POI name")) && !(record.answerChoices || []).length ? `<button type="button" class="answer-button" data-action="open-custom-answer" data-question-instance="${record.id}">${icon("edit")} Type answer</button>` : ""}
    </div>`;
  return `<article class="card card-pad simple-active-question">
    <div class="simple-active-head">
      <div class="row align-start">${categoryIcon(record.category || definition.category)}<div><p class="eyebrow">Question waiting</p><h2>${escapeHtml(record.questionName || definition.name)}</h2><p>Asked ${relativeTime(record.askedAt, now)}</p></div></div>
      <div class="question-countdown ${overdue ? "overdue" : ""}" data-question-countdown="${record.id}">${overdue ? `+${formatDuration(Math.abs(remaining))}` : formatDuration(remaining)}</div>
    </div>
    <div class="simple-question-prompt">${escapeHtml(record.prompt || definition.prompt)}</div>
    ${renderQuestionLocations(record)}
    ${renderMapReference(record)}
    ${record.note ? `<p class="muted small question-clarification"><strong>Question note:</strong> ${escapeHtml(record.note)}</p>` : ""}
    ${canAnswer ? answerControls : `<div class="callout">${icon("clock")}<p><strong>Waiting for the hider team.</strong>The timer is shared across the room.</p></div>`}
    ${overdue ? `<div class="callout danger">${icon("alert")}<p><strong>Time is up.</strong>Pause the game until the answer is complete; no card reward is earned.</p></div>` : ""}
  </article>`;
}

function renderQuestionCard(question, state, canAsk, unavailableLabel) {
  const currentRound = state.game?.round || 1;
  const previous = state.questions.filter((record) => record.questionId === question.id && (record.round || 1) === currentRound).length;
  const occurrence = previous + 1;
  const reward = repeatedReward(question, occurrence, state.settings.repeatRewardMode);
  return `<article class="card simple-question-card">
    <div class="simple-question-top">${categoryIcon(question.category)}<div><strong>${escapeHtml(question.name)}</strong><small>${escapeHtml(QUESTION_CATEGORIES[question.category].name)}</small></div>${previous ? `<span class="badge badge-yellow">x${occurrence}</span>` : ""}</div>
    <p>${escapeHtml(question.prompt)}</p>
    <div class="simple-question-footer"><span><strong>${question.responseSeconds / 60} min</strong> · Draw ${reward.draw}, keep ${reward.keep}${question.requiresPin ? " · Pin needed" : ""}</span><button class="button ${canAsk ? "button-primary" : "button-soft"} button-small" type="button" data-action="open-ask-question" data-question-id="${question.id}" ${canAsk ? "" : "disabled"}>${canAsk ? "Ask" : escapeHtml(unavailableLabel)}</button></div>
  </article>`;
}

function renderHistory(state, now) {
  const history = state.questions.filter((record) => record.status !== "pending").sort((a, b) => new Date(b.askedAt) - new Date(a.askedAt));
  return `<details class="card card-pad simple-expander question-history">
    <summary><span>${icon("clock")}<span><strong>Question history</strong><small>${history.length} completed in this game</small></span></span>${icon("chevron")}</summary>
    <div class="simple-expander-body">
      ${history.length ? `<div class="simple-list">${history.slice(0, 40).map((record) => {
        const definition = QUESTION_BY_ID.get(record.questionId) || record;
        const hasEvidence = Boolean(record.evidencePath || record.evidenceKey || record.evidenceDataUrl);
        return `<div class="simple-list-row"><span><strong>${escapeHtml(record.questionName || definition.name)}</strong><small>${escapeHtml(record.answer || "No answer")} · ${relativeTime(record.askedAt, now)}${record.occurrence > 1 ? ` · repeat x${record.occurrence}` : ""}</small></span><span class="question-history-actions"><button class="button button-primary button-small" type="button" data-action="view-answer" data-question-instance="${record.id}">${icon("eye")} View answer</button>${renderQuestionLocations(record, { compact: true })}${hasEvidence ? `<button class="button button-soft button-small" type="button" data-action="view-evidence" data-question-instance="${record.id}">${icon("camera")} Photo</button>` : ""}</span></div>`;
      }).join("")}</div>` : `<p class="muted">Completed questions will appear here.</p>`}
    </div>
  </details>`;
}

function renderLatestAnswer(state, now) {
  const record = state.questions
    .filter((question) => question.status === "answered")
    .sort((a, b) => new Date(b.answeredAt || b.askedAt) - new Date(a.answeredAt || a.askedAt))[0];
  if (!record) return "";
  return `<section class="card card-pad latest-answer-card"><div><p class="eyebrow">Latest answer</p><h2>${escapeHtml(record.questionName || "Question")}</h2><p><strong>${escapeHtml(record.answer || "No answer")}</strong> · ${relativeTime(record.answeredAt || record.askedAt, now)}</p></div><button class="button button-primary" type="button" data-action="view-answer" data-question-instance="${escapeHtml(record.id)}">${icon("eye")} View full answer</button></section>`;
}

export function renderQuestionsView(state, now = Date.now()) {
  const game = state.game;
  const isHider = Boolean(game && state.profile.team === game.hiderTeam);
  const activePhase = Boolean(game && [PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase));
  const sharedDevice = game?.mode === "local";
  const canAsk = activePhase && (sharedDevice || !isHider);
  const canAnswer = activePhase && (sharedDevice || isHider);
  const askUnavailableLabel = !game ? "Create game" : !activePhase ? "Not yet" : "Seeker only";
  const active = state.questions.filter((record) => record.status === "pending").sort((a, b) => new Date(a.askedAt) - new Date(b.askedAt));
  const visible = filteredQuestions(state);
  const categories = [{ id: "all", name: "All" }, ...Object.values(QUESTION_CATEGORIES).map(({ id, name }) => ({ id, name }))];
  const lockMessage = !game
    ? "Create or join a game first."
    : !activePhase
      ? "Questions unlock after the 45-minute hiding period."
      : !canAsk
        ? "This device belongs to the hider team, so it can answer but not ask."
        : "Ask only one question at a time.";

  return `<div class="view-stack simple-questions-view">
    ${active.length ? `<div class="question-list">${active.map((record) => renderActiveQuestion(record, now, canAnswer)).join("")}</div>` : `<section class="card card-pad simple-question-status"><div><p class="eyebrow">${isHider ? "Hider" : "Seeker"}</p><h2>${isHider ? "No question is waiting" : "Choose the next question"}</h2><p>${isHider ? "When the seekers ask, the answer timer will appear here." : "The map will update automatically after an answer whenever enough location data is available."}</p></div><span class="simple-status-icon">${icon(activePhase ? "questions" : "clock")}</span></section>`}
    ${renderLatestAnswer(state, now)}

    <section class="card card-pad simple-question-browser">
      <div class="section-head"><div><h2>Question list</h2><p>Pick a category or search by what you want to learn.</p></div><div class="simple-map-link">${icon("map")} Answers feed the map</div></div>
      <div class="simple-question-toolbar">
        <div class="simple-category-scroll" role="tablist" aria-label="Question categories">${categories.map((category) => `<button class="simple-category-button ${state.ui.questionCategory === category.id || (!state.ui.questionCategory && category.id === "all") ? "active" : ""}" type="button" data-action="question-category" data-category="${category.id}">${escapeHtml(category.name)}</button>`).join("")}</div>
        <div class="simple-search"><span>${icon("search")}</span><input type="search" data-action="question-search" value="${escapeHtml(state.ui.questionSearch || "")}" placeholder="Search questions…" aria-label="Search questions" /></div>
      </div>
      ${!canAsk ? `<div class="callout ${game && activePhase ? "warning" : ""}">${icon("info")}<p>${escapeHtml(lockMessage)}</p></div>` : ""}
      <div class="simple-question-grid">${visible.length ? visible.map((question) => renderQuestionCard(question, state, canAsk, askUnavailableLabel)).join("") : `<div class="empty-state"><div class="empty-state-inner"><span class="empty-icon">${icon("search")}</span><strong>No matching questions</strong><span>Try a different category or search.</span></div></div>`}</div>
    </section>

    <section class="callout warning simple-fair-play">${icon("safety")}<p><strong>Fair play:</strong> share required pins before moving, wait for the previous answer, and do not use Street View, reverse-image search or AI to solve the location.</p></section>
    ${renderHistory(state, now)}
  </div>`;
}
