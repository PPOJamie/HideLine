import { GAME_MAP_URL } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import { NOT_USED_QUESTIONS, QUESTION_CATEGORIES } from "../data/questions.js";
import { GLOSSARY, QUICK_RULES, SAFETY_NOTES, SCHEDULE } from "../data/rules.js";
import { icon } from "./icons.js";

function ruleList(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function scheduleTable(rows) {
  return `<div class="schedule">${rows.map((row) => `<div class="schedule-row"><div class="schedule-time">${row.time}</div><div><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.detail)}</span></div></div>`).join("")}</div>`;
}

export function renderRulesView() {
  return `
    <div class="view-stack">
      <section class="card card-dark card-pad hero" style="min-height:220px">
        <div class="hero-copy"><p class="eyebrow">Fast reference</p><h2>Fair decisions without digging through fifteen pages.</h2><p>These summaries are designed for play. For edge cases, open the supplied handbook and use the authoritative Google map layer.</p><div class="hero-actions"><a class="button button-primary" href="./docs/Hide-and-Seek-London-Handbook.pdf" target="_blank" rel="noopener">${icon("bookOpen")} Open full handbook</a><a class="button button-ghost" href="${GAME_MAP_URL}" target="_blank" rel="noopener">${icon("map")} Open game map</a></div></div>
        <div class="hero-visual" aria-hidden="true"><div class="route-orbit"><span class="route-node n1"></span><span class="route-node n2"></span><span class="route-node n3"></span></div></div>
      </section>

      <div class="grid grid-3">
        <section class="card card-pad rule-section"><div class="section-head"><div><p class="eyebrow">Role guide</p><h2>Hiders</h2></div></div><details open><summary>Core rules</summary><div class="rule-body">${ruleList(QUICK_RULES.hider)}</div></details></section>
        <section class="card card-pad rule-section"><div class="section-head"><div><p class="eyebrow">Role guide</p><h2>Seekers</h2></div></div><details open><summary>Core rules</summary><div class="rule-body">${ruleList(QUICK_RULES.seeker)}</div></details></section>
        <section class="card card-pad rule-section"><div class="section-head"><div><p class="eyebrow">Shared guide</p><h2>Both teams</h2></div></div><details open><summary>Core rules</summary><div class="rule-body">${ruleList(QUICK_RULES.both)}</div></details></section>
      </div>

      <div class="grid grid-main">
        <section class="card card-pad rule-section">
          <div class="section-head"><div><h2>Investigation categories</h2><p>Response time and hider reward for each available category.</p></div></div>
          <div style="overflow:auto"><table class="rule-table"><thead><tr><th>Category</th><th>Format</th><th>Response</th><th>Reward</th><th>Answers</th></tr></thead><tbody>${Object.values(QUESTION_CATEGORIES).map((category) => `<tr><td><strong>${escapeHtml(category.name)}</strong></td><td>${escapeHtml(category.format)}</td><td>${category.responseSeconds / 60} min</td><td>Draw ${category.reward.draw}, keep ${category.reward.keep}</td><td>${escapeHtml(category.answers.join(" / "))}</td></tr>`).join("")}</tbody></table></div>
          <details><summary>Questions not normally used</summary><div class="rule-body"><p>A randomise power-up may bring greyed-out questions back into play. Otherwise, the London version excludes:</p>${ruleList(NOT_USED_QUESTIONS)}</div></details>
          <details><summary>Answer timing</summary><div class="rule-body"><ul><li>Normal questions: 5 minutes.</li><li>Photo questions: 10 minutes for this small/medium setup.</li><li>Late answers require a game pause until complete and earn no reward.</li><li>Answers use the hider's physical location at the moment of answering, unless endgame prevents movement.</li></ul></div></details>
          <details><summary>Photo protections</summary><div class="rule-body"><ul><li>Repeated photo asks should produce a meaningfully different image.</li><li>Censor only uniquely identifying text and keep the location matchable in person.</li><li>When a movement-dependent photo is asked and seekers are within 10 minutes of the zone, hiders may pause to take it and return.</li><li>During endgame, answer “I/we can't answer that” where the image cannot be taken without moving.</li></ul></div></details>
        </section>
        <aside class="stack">
          <section class="card card-pad"><div class="section-head"><div><h2>Numbers to remember</h2></div></div><div class="score-breakdown"><div class="score-row"><span>Hiding period</span><span>45 min</span></div><div class="score-row"><span>Hiding-zone radius</span><span>500 m</span></div><div class="score-row"><span>Found distance</span><span>2 m + spotted</span></div><div class="score-row"><span>Round cutoff</span><span>4 h 45 min</span></div><div class="score-row"><span>Default hand limit</span><span>6 cards</span></div><div class="score-row"><span>Invalid-zone penalty</span><span>−30 min</span></div><div class="score-row"><span>Curse cure reward</span><span>+45 min</span></div></div></section>
          <section class="callout danger">${icon("eye")}<p><strong>Investigation ban</strong>Do not use Google Street View, reverse-image search or AI tools to identify the hiding location.</p></section>
        </aside>
      </div>

      <div class="grid grid-2">
        <section class="card card-pad"><div class="section-head"><div><p class="eyebrow">Round 1</p><h2>Morning schedule</h2></div></div>${scheduleTable(SCHEDULE.round1)}</section>
        <section class="card card-pad"><div class="section-head"><div><p class="eyebrow">Round 2</p><h2>Afternoon schedule</h2></div></div>${scheduleTable(SCHEDULE.round2)}</section>
      </div>

      <div class="grid grid-main">
        <section class="card card-pad rule-section"><div class="section-head"><div><h2>Glossary</h2><p>Terms used by the timers and score calculator.</p></div></div>${GLOSSARY.map((item) => `<details><summary>${escapeHtml(item.term)}</summary><div class="rule-body">${escapeHtml(item.definition)}</div></details>`).join("")}</section>
        <aside class="card card-pad rule-section"><div class="section-head"><div><h2>Safety and practicalities</h2></div></div>${ruleList(SAFETY_NOTES)}<div class="callout warning">${icon("alert")}<p><strong>Real-world rules win.</strong>Staff instructions, transport rules, accessibility needs and personal safety always override game mechanics.</p></div></aside>
      </div>
    </div>
  `;
}
