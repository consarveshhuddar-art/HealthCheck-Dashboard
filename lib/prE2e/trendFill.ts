import { eachDayOfInterval, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

export const PR_E2E_TREND_DAY_OPTIONS = [1, 7, 30, 90] as const;
export type PrE2eTrendDays = (typeof PR_E2E_TREND_DAY_OPTIONS)[number];
export const PR_E2E_TREND_DAYS_DEFAULT: PrE2eTrendDays = 7;

export const PR_E2E_TREND_RANGE_BUTTONS: { key: string; label: string }[] = [
  { key: "1", label: "1d" },
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
];

export function parseTrendDays(raw: string | undefined): PrE2eTrendDays {
  if (raw === "1" || raw === "7" || raw === "90") {
    return Number(raw) as PrE2eTrendDays;
  }
  return PR_E2E_TREND_DAYS_DEFAULT;
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

export function fillPrRaisedTrend<
  T extends { label: string; runs: number },
>(points: T[], days: number): T[] {
  const labels = trendDayLabels(days);
  const byLabel = new Map(points.map((p) => [p.label, p]));
  return labels.map(
    (label) => byLabel.get(label) ?? ({ label, runs: 0 } as T),
  );
}
