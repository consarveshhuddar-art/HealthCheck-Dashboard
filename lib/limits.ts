/** Failure trend area charts: fixed IST windows (not tied to Runs day/week/month control). */
export const TREND_DAILY_DAYS = 31;
export const TREND_WEEKLY_BUCKETS = 5;
/** IST calendar days of failure rows to load for those charts (covers weekly buckets). */
export const TREND_FAILURE_LOOKBACK_IST_DAYS = 45;

/** How many recent `health_check_runs` rows to load for KPIs, charts, and the table. */
export type RunDataWindow = "day" | "week" | "month";

export const RUN_WINDOW_LIMITS: Record<RunDataWindow, number> = {
  /** ~1 day of typical CI volume */
  day: 150,
  /** ~1 week */
  week: 500,
  /** ~1 month */
  month: 1500,
};

export const DEFAULT_RUN_DATA_WINDOW: RunDataWindow = "week";

/** Legacy name — same as month cap (≈1 month). */
export const RECENT_RUNS_LIMIT = RUN_WINDOW_LIMITS.month;

export function parseRunDataWindow(raw: string | undefined): RunDataWindow {
  if (raw === "day" || raw === "week" || raw === "month") return raw;
  return DEFAULT_RUN_DATA_WINDOW;
}

export function runLimitForWindow(w: RunDataWindow): number {
  return RUN_WINDOW_LIMITS[w];
}

export function runDataWindowLabel(w: RunDataWindow): string {
  switch (w) {
    case "day":
      return "1 day";
    case "week":
      return "1 week";
    case "month":
      return "1 month";
    default:
      return w;
  }
}
