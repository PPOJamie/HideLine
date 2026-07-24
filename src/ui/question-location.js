import { escapeHtml } from "../core/format.js";
import { questionLocations } from "../core/question-location.js";
import { icon } from "./icons.js";

function compactLabel(location) {
  if (/start/i.test(location.label)) return "Start map";
  if (/end/i.test(location.label)) return "End map";
  if (/reference/i.test(location.label)) return "Reference map";
  return "Open pin";
}

export function renderQuestionLocations(record, { compact = false } = {}) {
  const locations = questionLocations(record);
  if (!locations.length) return "";

  if (compact) {
    return locations.slice(0, 3).map((location) => location.url
      ? `<a class="button button-soft button-small question-location-history-link" href="${escapeHtml(location.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(`${location.label}: ${location.text}`)}">${icon("location")} ${escapeHtml(compactLabel(location))}</a>`
      : `<span class="question-location-compact">${icon("location")} ${escapeHtml(location.text)}</span>`).join("");
  }

  return `<section class="question-location-card" aria-label="Location shared with this question">
    <div class="question-location-heading"><span>${icon("location")}</span><div><strong>Question location</strong><small>Tap a coordinate to open it in Google Maps.</small></div></div>
    <div class="question-location-list">${locations.map((location) => {
      const content = `<span><strong>${escapeHtml(location.label)}</strong><code>${escapeHtml(location.text)}</code></span>${location.url ? `<span class="question-location-open">Open map ${icon("external")}</span>` : ""}`;
      return location.url
        ? `<a class="question-location-link" href="${escapeHtml(location.url)}" target="_blank" rel="noopener noreferrer">${content}</a>`
        : `<div class="question-location-link no-link">${content}</div>`;
    }).join("")}</div>
  </section>`;
}
