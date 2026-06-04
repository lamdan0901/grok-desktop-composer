const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Parse Grok `sessions list` CREATED/UPDATED columns (e.g. `2026-06-04`, `18h`). */
export function parseGrokSessionTimestamp(
  raw?: string,
  now = Date.now(),
): number | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const ms = Date.parse(`${s}T12:00:00`);
    return Number.isFinite(ms) ? ms : undefined;
  }

  const rel = s.match(/^(\d+)([mhd])$/i);
  if (rel) {
    const n = Number(rel[1]);
    if (!Number.isFinite(n) || n < 0) return undefined;
    const unit = rel[2].toLowerCase();
    const mult = unit === "m" ? MINUTE : unit === "h" ? HOUR : DAY;
    return now - n * mult;
  }

  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Short relative label like Codex sidebar (e.g. 56m, 18h, 3d). */
export function formatRelativeShort(timestampMs: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestampMs);
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  return `${Math.floor(diff / DAY)}d`;
}