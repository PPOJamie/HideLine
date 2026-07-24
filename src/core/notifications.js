import { VIEWS } from "./constants.js";
import { questionLocations } from "./question-location.js";

function compact(value, fallback = "") {
  const text = String(value ?? fallback).replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

function currentRole(state) {
  const game = state?.game;
  if (!game) return { isHider: false, isSeeker: false };
  const isHider = state?.profile?.team === game.hiderTeam;
  return { isHider, isSeeker: !isHider };
}

function locationSuffix(payload = {}) {
  const locations = Array.isArray(payload.locations) ? payload.locations : questionLocations(payload);
  if (locations.length) {
    return ` · ${locations.map((location) => `${compact(location.label, "Pin")}: ${compact(location.text)}`).join(" · ")}`;
  }
  const summary = compact(payload.locationSummary || payload.location_summary);
  return summary ? ` · ${summary}` : "";
}

export function notificationForPendingQuestion(record, state) {
  const { isHider } = currentRole(state);
  if (!record || record.status !== "pending" || !isHider) return null;
  return {
    title: "Question to answer",
    body: `${compact(record.questionName, "New question")}: ${compact(record.prompt, "Open Questions to answer.")}${locationSuffix(record)}`,
    tone: "question",
    iconName: "questions",
    urgent: true,
    persistent: true,
    view: VIEWS.QUESTIONS,
    actionLabel: "Answer now",
    tag: `question:${record.id}`,
    questionInstanceId: record.id
  };
}

export function notificationForGameEvent(event, state) {
  if (!event) return null;
  const payload = event.payload || event;
  const type = event.type || event.event_type;
  const { isHider, isSeeker } = currentRole(state);

  if (type === "question") {
    if (!isHider) return null;
    return {
      title: "Question to answer",
      body: `${compact(payload.questionName, "New question")}: ${compact(payload.prompt, "Open Questions to answer.")}${locationSuffix(payload)}`,
      tone: "question",
      iconName: "questions",
      urgent: true,
      persistent: true,
      view: VIEWS.QUESTIONS,
      actionLabel: "Answer now",
      tag: `question:${payload.questionInstanceId || event.id}`,
      questionInstanceId: payload.questionInstanceId || null
    };
  }

  if (type === "answer") {
    if (!isSeeker) return null;
    return {
      title: "Answer received",
      body: `${compact(payload.questionName, "Question")}: ${compact(payload.answer, "Answer recorded")}`,
      tone: "success",
      iconName: "check",
      view: VIEWS.QUESTIONS,
      actionLabel: "View answer",
      tag: `answer:${payload.questionInstanceId || event.id}`
    };
  }

  const shared = {
    "round-start": { title: "Round started", body: payload.message || "The round timer has started.", tone: "success", iconName: "play", view: VIEWS.PLAY, actionLabel: "Open game" },
    release: { title: "Seekers released", body: payload.message || "The hiding period has ended.", tone: "question", iconName: "play", urgent: true, view: VIEWS.QUESTIONS, actionLabel: "Open questions" },
    pause: { title: "Game paused", body: payload.reason || payload.note || "All active timing is paused.", tone: "warning", iconName: "pause", urgent: true, view: VIEWS.PLAY, actionLabel: "Open game" },
    resume: { title: "Game resumed", body: payload.reason || "The round timer is running again.", tone: "success", iconName: "resume", view: VIEWS.PLAY, actionLabel: "Open game" },
    endgame: { title: "Endgame started", body: payload.message || "Hiders must remain at their fixed hiding spot.", tone: "warning", iconName: "target", urgent: true, view: isHider ? VIEWS.QUESTIONS : VIEWS.MAP, actionLabel: isHider ? "Open questions" : "Open Endgame map" },
    "endgame-cancelled": { title: "Endgame cleared", body: payload.message || "Hiders may move within their zone again.", tone: "info", iconName: "refresh", view: VIEWS.PLAY, actionLabel: "Open game" },
    found: { title: "Hiders found", body: payload.note || "The round has ended.", tone: "success", iconName: "target", urgent: true, view: VIEWS.PLAY, actionLabel: "View result" },
    cutoff: { title: "Round cutoff reached", body: payload.message || "Record final bonuses and penalties.", tone: "warning", iconName: "clock", urgent: true, view: VIEWS.PLAY, actionLabel: "Open game" },
    "round-reset": { title: "Next round ready", body: payload.message || "The next round lobby is ready.", tone: "success", iconName: "refresh", view: VIEWS.PLAY, actionLabel: "Open game" },
    trap: { title: "Time trap update", body: payload.message || "A time trap changed.", tone: "warning", iconName: "trap", view: VIEWS.PLAY, actionLabel: "Open game" },
    safety: { title: "Safety check-in", body: payload.message || "A player checked in as safe.", tone: "success", iconName: "safety", view: VIEWS.PLAY, actionLabel: "Open game" }
  }[type];

  if (shared) return { ...shared, body: compact(shared.body), tag: `${type}:${event.id || Date.now()}` };

  if (["transit-start", "transit-end"].includes(type) && event.team !== state?.profile?.team) {
    const title = type === "transit-start" ? "Other team boarded a train" : "Other team left the train";
    const body = type === "transit-start"
      ? [payload.station, payload.line, payload.note].filter(Boolean).join(" · ") || "Transit notice received."
      : [payload.station, payload.note].filter(Boolean).join(" · ") || "Off-transit notice received.";
    return { title, body: compact(body), tone: "info", iconName: "train", view: VIEWS.PLAY, actionLabel: "Open game", tag: `transit:${event.id || Date.now()}` };
  }

  return null;
}
