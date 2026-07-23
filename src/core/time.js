import { clamp, number } from "./format.js";

export function toIso(value = Date.now()) {
  return new Date(value).toISOString();
}

export function secondsBetween(start, end = Date.now()) {
  if (!start) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 1000));
}

export function totalPausedSeconds(pauses = [], now = Date.now()) {
  return pauses.reduce((total, pause) => {
    if (!pause?.startedAt) return total;
    const end = pause.endedAt || now;
    return total + secondsBetween(pause.startedAt, end);
  }, 0);
}

export function activeElapsedSeconds(startedAt, stoppedAt, pauses = [], now = Date.now()) {
  if (!startedAt) return 0;
  const endpoint = stoppedAt || now;
  return Math.max(0, secondsBetween(startedAt, endpoint) - totalPausedSeconds(pauses, endpoint));
}

export function activeCountdownSeconds(durationSeconds, startedAt, stoppedAt, pauses = [], now = Date.now()) {
  return Math.max(0, number(durationSeconds) - activeElapsedSeconds(startedAt, stoppedAt, pauses, now));
}

export function formatDuration(totalSeconds, { signed = false, showSeconds = true, compact = false } = {}) {
  const raw = number(totalSeconds);
  const sign = raw < 0 ? "−" : signed && raw > 0 ? "+" : "";
  const seconds = Math.abs(Math.round(raw));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (compact) {
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes || (!hours && !remainder)) parts.push(`${minutes}m`);
    if (showSeconds && remainder) parts.push(`${remainder}s`);
    return `${sign}${parts.join(" ")}`;
  }
  if (hours) return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  return `${sign}${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function parseDurationParts(hours = 0, minutes = 0, seconds = 0) {
  return Math.round(number(hours) * 3600 + number(minutes) * 60 + number(seconds));
}

export function roundProgress(startedAt, durationSeconds, pauses = [], stoppedAt, now = Date.now()) {
  if (!startedAt || !durationSeconds) return 0;
  return clamp(activeElapsedSeconds(startedAt, stoppedAt, pauses, now) / durationSeconds, 0, 1);
}

export function getQuestionDeadline(question) {
  if (!question?.askedAt) return null;
  return new Date(new Date(question.askedAt).getTime() + number(question.responseSeconds, 300) * 1000).toISOString();
}

export function questionSecondsRemaining(question, now = Date.now()) {
  if (!question?.askedAt || question.status !== "pending") return 0;
  const deadline = new Date(getQuestionDeadline(question)).getTime();
  return Math.ceil((deadline - now) / 1000);
}

export function nominalRoundSchedule(round, gameDate = new Date()) {
  const date = new Date(gameDate);
  const set = (hours, minutes) => {
    const item = new Date(date);
    item.setHours(hours, minutes, 0, 0);
    return item.toISOString();
  };
  if (Number(round) === 2) {
    return { meetAt: set(13, 45), prepAt: set(14, 30), startsAt: set(14, 45), seekersReleasedAt: set(15, 30), cutoffAt: set(19, 30) };
  }
  return { meetAt: set(8, 30), prepAt: set(8, 30), startsAt: set(9, 0), seekersReleasedAt: set(9, 45), cutoffAt: set(13, 45) };
}
