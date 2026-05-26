import { eachDayOfInterval, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

export function parseTrendDays(raw: string | undefined): 7 | 30 | 90 {
  if (raw === "7" || raw === "90") return Number(raw) as 7 | 30 | 90;
  return 30;
}

export function trendDayLabels(days: number): string[] {
  const end = new Date();
  const start = subDays(end, days - 1);
  return eachDayOfInterval({ start, end }).map((d) =>
    formatInTimeZone(d, IST, "MMM d"),
  );
}

export function fillPassRateTrend<
  T extends { label: string; passRate: number | null; runs: number },
>(points: T[], days: number): T[] {
  const labels = trendDayLabels(days);
  const byLabel = new Map(points.map((p) => [p.label, p]));
  return labels.map(
    (label) =>
      byLabel.get(label) ?? ({
        label,
        passRate: null,
        runs: 0,
      } as T),
  );
}

export function fillDailyTrend<
  T extends { label: string; passed: number; failed: number },
>(points: T[], days: number): T[] {
  const labels = trendDayLabels(days);
  const byLabel = new Map(points.map((p) => [p.label, p]));
  return labels.map(
    (label) =>
      byLabel.get(label) ?? ({ label, passed: 0, failed: 0 } as T),
  );
}
