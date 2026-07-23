export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function initials(name = "Player") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function titleCase(value = "") {
  return String(value)
    .replaceAll(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDateTime(value, options = {}) {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: options.weekday ?? undefined,
    day: options.day ?? "2-digit",
    month: options.month ?? "short",
    hour: options.hour ?? "2-digit",
    minute: options.minute ?? "2-digit",
    ...options
  }).format(date);
}

export function formatClock(value) {
  if (!value) return "--:--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function relativeTime(value, now = Date.now()) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  const delta = Math.round((timestamp - now) / 1000);
  const abs = Math.abs(delta);
  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  if (abs < 60) return formatter.format(delta, "second");
  if (abs < 3600) return formatter.format(Math.round(delta / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(delta / 3600), "hour");
  return formatter.format(Math.round(delta / 86400), "day");
}

export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function randomId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function roomCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (byte, index) => alphabet[(byte || Math.floor(Math.random() * 255) + index) % alphabet.length]).join("");
}

export function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
