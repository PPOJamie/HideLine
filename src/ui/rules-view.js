import { GAME_MAP_URL } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import { QUICK_RULES } from "../data/rules.js";
import { icon } from "./icons.js";

function ruleList(items) {
  return `<ul class="simple-rule-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function renderRulesView() {
  return `<div class="view-stack simple-rules-view">
    <section class="card card-dark card-pad simple-rules-hero"><div><p class="eyebrow">Quick reference</p><h2>The rules you need during play.</h2><p>Use this page for common decisions. Open the full handbook only for an unusual edge case.</p></div><div class="row wrap"><button class="button button-primary" type="button" data-action="navigate" data-view="play">${icon("play")} Back to game</button><a class="button button-ghost" href="./docs/Hide-and-Seek-London-Handbook.pdf" target="_blank" rel="noopener">${icon("bookOpen")} Full handbook</a><a class="button button-ghost" href="${GAME_MAP_URL}" target="_blank" rel="noopener">${icon("map")} Official map</a></div></section>

    <section class="simple-numbers-grid">
      <article class="card card-pad"><strong>45 min</strong><span>Hiding period</span></article>
      <article class="card card-pad"><strong>500 m</strong><span>Station zone</span></article>
      <article class="card card-pad"><strong>5 / 10 min</strong><span>Normal / photo answer</span></article>
      <article class="card card-pad"><strong>2 m</strong><span>Found and spotted</span></article>
    </section>

    <div class="grid grid-3 simple-rule-grid">
      <section class="card card-pad"><div class="section-head"><div><p class="eyebrow">Hiders</p><h2>Stay legal and answer</h2></div></div>${ruleList(QUICK_RULES.hider.slice(0, 8))}</section>
      <section class="card card-pad"><div class="section-head"><div><p class="eyebrow">Seekers</p><h2>Ask fairly</h2></div></div>${ruleList(QUICK_RULES.seeker.slice(0, 8))}</section>
      <section class="card card-pad"><div class="section-head"><div><p class="eyebrow">Both teams</p><h2>Keep the game moving</h2></div></div>${ruleList(QUICK_RULES.both.slice(0, 8))}</section>
    </div>

    <section class="card card-pad simple-key-decisions"><div class="section-head"><div><h2>Three decisions that often matter</h2></div></div><div class="simple-decision-grid"><article><span>${icon("train")}</span><div><strong>Tell the hiders before and after train travel</strong><p>Share the starting station while signal is reliable.</p></div></article><article><span>${icon("clock")}</span><div><strong>Late answer means a pause and no reward</strong><p>Normal questions have five minutes; photos have ten.</p></div></article><article><span>${icon("target")}</span><div><strong>Endgame means the hiders stay put</strong><p>If seekers leave the zone by train after an accidental trigger, movement can resume.</p></div></article></div></section>

    <section class="callout danger">${icon("eye")}<p><strong>Do not use Street View, reverse-image search or AI to identify the hiding location.</strong> Staff instructions, transport rules, accessibility needs and personal safety always override the game.</p></section>
  </div>`;
}
