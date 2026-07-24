import { GAME_MAP_URL } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import { QUESTION_CATEGORIES } from "../data/questions.js";
import { QUICK_RULES } from "../data/rules.js";
import { icon } from "./icons.js";

function ruleList(items, limit = items.length) {
  return `<ul class="simple-rule-list">${items.slice(0, limit).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function renderRulesView() {
  return `<div class="view-stack simple-rules-view">
    <section class="simple-rules-heading"><div><p class="eyebrow">Game-day reference</p><h2>The rules most likely to matter while playing</h2><p>Use the full handbook only for edge cases or a disputed ruling.</p></div><div class="button-row"><button class="button button-soft" type="button" data-action="navigate" data-view="tools">${icon("undo")} Back to More</button><a class="button button-primary" href="./docs/Hide-and-Seek-London-Handbook.pdf" target="_blank" rel="noopener">${icon("bookOpen")} Full handbook</a></div></section>

    <section class="simple-key-numbers" aria-label="Key game numbers">
      <article class="card"><strong>45 min</strong><span>Hiding period</span></article>
      <article class="card"><strong>500 m</strong><span>Hiding-zone radius</span></article>
      <article class="card"><strong>5 min</strong><span>Normal answer</span></article>
      <article class="card"><strong>10 min</strong><span>Photo answer</span></article>
      <article class="card"><strong>2 m</strong><span>Found distance + spotted</span></article>
      <article class="card"><strong>6</strong><span>Default card limit</span></article>
    </section>

    <div class="grid grid-3 simple-role-rules">
      <section class="card card-pad"><div class="section-head"><div><p class="eyebrow">Hiders</p><h2>Protect the zone</h2></div></div>${ruleList(QUICK_RULES.hider, 7)}</section>
      <section class="card card-pad"><div class="section-head"><div><p class="eyebrow">Seekers</p><h2>Ask fairly</h2></div></div>${ruleList(QUICK_RULES.seeker, 7)}</section>
      <section class="card card-pad"><div class="section-head"><div><p class="eyebrow">Both teams</p><h2>Keep it moving</h2></div></div>${ruleList(QUICK_RULES.both, 7)}</section>
    </div>

    <section class="card card-pad simple-category-guide"><div class="section-head"><div><h2>Question rewards and deadlines</h2><p>The app handles repeat multipliers and starts the deadline automatically.</p></div></div><div class="simple-category-grid">${Object.values(QUESTION_CATEGORIES).map((category) => `<article><strong>${escapeHtml(category.name)}</strong><span>${category.responseSeconds / 60} min</span><small>Draw ${category.reward.draw}, keep ${category.reward.keep}</small></article>`).join("")}</div></section>

    <div class="grid grid-2">
      <section class="callout danger">${icon("eye")}<p><strong>Never use Street View, reverse-image search or AI to identify the hiding location.</strong></p></section>
      <section class="callout warning">${icon("safety")}<p><strong>Safety overrides the game.</strong> Stop before using the phone, obey staff instructions and do not hide somewhere inaccessible or disruptive.</p></section>
    </div>

    <section class="card card-pad simple-rule-links"><div><h2>Official references</h2><p>Use the supplied map for boundary, station and curated POI rulings.</p></div><div class="button-row"><a class="button button-soft" href="${GAME_MAP_URL}" target="_blank" rel="noopener">${icon("map")} Official game map</a><a class="button button-soft" href="./docs/Hide-and-Seek-London-Handbook.pdf" target="_blank" rel="noopener">${icon("bookOpen")} Full handbook</a></div></section>
  </div>`;
}
