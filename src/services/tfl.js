const STATUS_URL = "https://api.tfl.gov.uk/Line/Mode/tube,overground,dlr,elizabeth-line/Status?detail=true";

export async function fetchTflStatus({ signal } = {}) {
  const response = await fetch(STATUS_URL, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`TfL status request failed (${response.status}).`);
  const payload = await response.json();
  return payload
    .map((line) => {
      const status = line.lineStatuses?.[0] || {};
      return {
        id: line.id,
        name: line.name,
        severity: Number(status.statusSeverity ?? 0),
        label: status.statusSeverityDescription || "Unknown",
        reason: status.reason || "",
        mode: line.modeName || ""
      };
    })
    .sort((a, b) => a.severity - b.severity || a.name.localeCompare(b.name));
}

export function statusTone(severity) {
  if (severity >= 10) return "good";
  if (severity >= 7) return "disrupted";
  return "severe";
}
