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
