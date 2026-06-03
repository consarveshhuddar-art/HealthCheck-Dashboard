import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

/** Parse MySQL DATETIME / ISO values stored as UTC (same convention as health_check_runs). */
function parseMysqlUtcTimestamp(value: string): Date | null {
  const s = value.trim();
  if (!s) return null;
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const base = normalized.split(".")[0] ?? normalized;
  try {
    return fromZonedTime(base, "UTC");
  } catch {
    return null;
  }
}

/** Display a DB/ISO timestamp in IST (dashboard default). */
export function formatPrE2eDateTimeIst(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = parseMysqlUtcTimestamp(iso);
  if (!dt) return null;
  return `${formatInTimeZone(dt, IST, "yyyy-MM-dd HH:mm:ss")} IST`;
}

/** When column: prefer Jenkins finish time (already IST); else UTC created_at → IST. */
export function formatPrE2eRunWhen(
  finishedAtIst: string | null | undefined,
  createdAt: string,
): string {
  const fin = finishedAtIst?.trim();
  if (fin) return fin.includes("IST") ? fin : `${fin} IST`;
  return formatPrE2eDateTimeIst(createdAt) ?? createdAt;
}

export function formatPassRateDelta(
  current: number | null,
  previous: number | null,
): { text: string; direction: "up" | "down" | "flat" } | null {
  if (current == null || previous == null) return null;
  const delta = Math.round((current - previous) * 10) / 10;
  if (Math.abs(delta) < 0.05) {
    return { text: "flat vs prior week", direction: "flat" };
  }
  const arrow = delta > 0 ? "↑" : "↓";
  return {
    text: `${arrow} ${Math.abs(delta)}% vs prior week`,
    direction: delta > 0 ? "up" : "down",
  };
}

/** Friendlier ingest error than raw exit codes */
export function formatIngestErrorMessage(raw: string | null): string {
  if (!raw?.trim()) return "No message recorded";
  const msg = raw.trim();
  if (/exit code 1/i.test(msg) && msg.length < 120) {
    return "Ingest script failed (exit 1). Check Jenkins prE2eIngest.groovy logs and GCS/Allure paths.";
  }
  if (/duplicate/i.test(msg)) return msg;
  if (msg.length > 280) return `${msg.slice(0, 280)}…`;
  return msg;
}

export type TopFailingCompareRow = {
  name: string;
  count7d: number;
  count30d: number;
  delta: number;
  trend: "worse" | "better" | "same" | "new";
};

export function mergeTopFailingCompare(
  seven: { name: string; count: number }[],
  thirty: { name: string; count: number }[],
  limit = 8,
): TopFailingCompareRow[] {
  const map30 = new Map(thirty.map((r) => [r.name, r.count]));
  const map7 = new Map(seven.map((r) => [r.name, r.count]));
  const names = new Set([...map7.keys(), ...map30.keys()]);
  const rows: TopFailingCompareRow[] = [];
  for (const name of names) {
    const count7d = map7.get(name) ?? 0;
    const count30d = map30.get(name) ?? 0;
    const expected7d = Math.round((count30d * 7) / 30);
    const delta = count7d - expected7d;
    let trend: TopFailingCompareRow["trend"] = "same";
    if (count7d > 0 && count30d === count7d) trend = "new";
    else if (delta > 1) trend = "worse";
    else if (delta < -1) trend = "better";
    rows.push({ name, count7d, count30d, delta, trend });
  }
  return rows
    .sort((a, b) => b.count7d - a.count7d || b.count30d - a.count30d)
    .slice(0, limit);
}
