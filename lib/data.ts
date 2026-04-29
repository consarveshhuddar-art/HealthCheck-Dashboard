import "server-only";
import { addDays, addWeeks, parseISO, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { EXPECTED_SERVICES } from "@/lib/healthServices";
import { RECENT_RUNS_LIMIT } from "@/lib/limits";
import { getSupabaseServer } from "@/lib/supabase/server";
import type {
  FailureWithRunTime,
  HealthCheckFailure,
  RunWithFailures,
} from "@/lib/types";

const IST = "Asia/Kolkata";

const RUN_COLUMNS =
  "id, created_at, checked_at_ist, build_number, build_url, jenkins_result, envs, summary";

const FAILURE_COLUMNS =
  "id, run_id, env, service_name, http_code, detail";

export async function fetchRecentRunsWithFailures(
  limit = RECENT_RUNS_LIMIT,
): Promise<RunWithFailures[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data: runs, error: runsErr } = await supabase
    .from("health_check_runs")
    .select(RUN_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (runsErr) {
    console.error(
      "fetchRecentRunsWithFailures runs:",
      runsErr.message,
      runsErr.code ?? "",
      runsErr.details ?? "",
    );
    return [];
  }

  const runList = runs ?? [];
  const ids = runList.map((r) => r.id).filter(Boolean);

  const failuresByRun = new Map<string, HealthCheckFailure[]>();
  if (ids.length > 0) {
    const { data: failures, error: failErr } = await supabase
      .from("health_check_failures")
      .select(FAILURE_COLUMNS)
      .in("run_id", ids);

    if (failErr) {
      console.error(
        "fetchRecentRunsWithFailures failures:",
        failErr.message,
        failErr.code ?? "",
        failErr.details ?? "",
      );
    } else {
      for (const row of failures ?? []) {
        const rid = row.run_id as string;
        const list = failuresByRun.get(rid) ?? [];
        list.push(row as HealthCheckFailure);
        failuresByRun.set(rid, list);
      }
    }
  }

  return runList.map((run) => ({
    ...(run as Omit<RunWithFailures, "health_check_failures">),
    health_check_failures: failuresByRun.get(run.id) ?? [],
  }));
}

/** Flatten failures with parent run timestamp for charts */
export function flattenFailuresWithRunTime(
  runs: RunWithFailures[],
): FailureWithRunTime[] {
  const out: FailureWithRunTime[] = [];
  for (const run of runs) {
    const failures = run.health_check_failures;
    if (!failures?.length) continue;
    for (const f of failures) {
      out.push({
        ...f,
        run_created_at: run.created_at,
      });
    }
  }
  return out;
}

export type DailyPoint = { date: string; label: string; count: number };
export type WeeklyPoint = { label: string; count: number };
export type ServiceCount = { service_name: string; count: number };

function istDayKey(iso: string): string {
  return formatInTimeZone(parseISO(iso), IST, "yyyy-MM-dd");
}

/** Last `daysBack` calendar days labeled in IST (approximation from rolling UTC offsets). */
function lastNDaysIST(daysBack: number): string[] {
  const days: string[] = [];
  const now = Date.now();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    days.push(formatInTimeZone(d, IST, "yyyy-MM-dd"));
  }
  return days;
}

export function aggregateDailyFailures(
  failures: FailureWithRunTime[],
  daysBack = 14,
): DailyPoint[] {
  const slots = lastNDaysIST(daysBack);
  const counts = new Map<string, number>();
  for (const day of slots) counts.set(day, 0);

  for (const f of failures) {
    const day = istDayKey(f.run_created_at);
    if (counts.has(day)) {
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }

  return slots.map((date) => ({
    date,
    label: formatInTimeZone(parseISO(`${date}T06:30:00.000Z`), IST, "MMM d"),
    count: counts.get(date) ?? 0,
  }));
}

/** Per IST calendar day: pipeline runs in window, split by presence of failure rows */
export type DailyRunOutcome = {
  date: string;
  label: string;
  total: number;
  success: number;
  failed: number;
};

export function aggregateDailyRunOutcomes(
  runs: RunWithFailures[],
  daysBack = 14,
): DailyRunOutcome[] {
  const slots = lastNDaysIST(daysBack);
  return slots.map((date) => {
    const dayRuns = runs.filter((r) => istDayKey(r.created_at) === date);
    let success = 0;
    let failed = 0;
    for (const r of dayRuns) {
      const fc = r.health_check_failures?.length ?? 0;
      if (fc === 0) success++;
      else failed++;
    }
    return {
      date,
      label: formatInTimeZone(parseISO(`${date}T06:30:00.000Z`), IST, "MMM d"),
      total: dayRuns.length,
      success,
      failed,
    };
  });
}

/** IST Monday 00:00 → UTC instant for the week containing `instant` */
function startOfISTMondayUtc(instant: Date): Date {
  const z = toZonedTime(instant, IST);
  const mondayLocal = startOfWeek(z, { weekStartsOn: 1 });
  return fromZonedTime(mondayLocal, IST);
}

/**
 * Failure counts per IST calendar week: Monday 00:00 IST through following Monday 00:00 IST (exclusive).
 * Weeks are contiguous and aligned — same boundaries as “week of Apr 27” / previous Mondays.
 */
export function aggregateWeeklyFailures(
  failures: FailureWithRunTime[],
  weeksBack = 8,
): WeeklyPoint[] {
  const now = new Date();
  const thisMondayUtc = startOfISTMondayUtc(now);

  const points: WeeklyPoint[] = [];

  for (let w = 0; w < weeksBack; w++) {
    const offset = w - (weeksBack - 1);
    const weekStartUtc = addWeeks(thisMondayUtc, offset);
    const weekEndUtc = addDays(weekStartUtc, 7);

    let count = 0;
    for (const f of failures) {
      const t = parseISO(f.run_created_at).getTime();
      if (t >= weekStartUtc.getTime() && t < weekEndUtc.getTime()) {
        count++;
      }
    }

    const labelStart = formatInTimeZone(weekStartUtc, IST, "MMM d");
    const sundayUtc = addDays(weekStartUtc, 6);
    const labelEnd = formatInTimeZone(sundayUtc, IST, "MMM d");

    points.push({
      label: `${labelStart} – ${labelEnd}`,
      count,
    });
  }

  return points;
}

export function topFailingServices(
  failures: FailureWithRunTime[],
  topN = 12,
): ServiceCount[] {
  const map = new Map<string, number>();
  for (const f of failures) {
    const name = f.service_name || "(unknown)";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([service_name, count]) => ({ service_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

export function summarizeRuns(runs: RunWithFailures[]) {
  const total = runs.length;
  let clean = 0;
  let withFailures = 0;
  for (const r of runs) {
    const fc = r.health_check_failures?.length ?? 0;
    if (fc === 0) clean++;
    else withFailures++;
  }
  const successRate = total ? Math.round((clean / total) * 1000) / 10 : 0;
  const last = runs[0];
  return {
    total,
    clean,
    withFailures,
    successRate,
    lastRun: last ?? null,
  };
}

/** IST calendar day as yyyy-MM-dd for URL defaults */
export function defaultIstDayString(): string {
  return formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
}

/** Inclusive UTC instant range for one IST calendar day (India has no DST). */
function istDayUtcRange(day: string): { startIso: string; endIso: string } {
  const start = new Date(`${day}T00:00:00.000+05:30`);
  const end = new Date(`${day}T23:59:59.999+05:30`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Strip `:branch` from deployment-style names from Jenkins / DB */
export function normalizeServiceName(raw: string): string {
  let s = raw.trim();
  const idx = s.indexOf(":");
  if (idx !== -1) s = s.slice(0, idx).trim();
  return s;
}

/** Map `health_check_failures.env` to chart keys */
export function normalizeEnvSegment(
  env: string,
): "sdet02" | "sdet05" | null {
  const e = env.toLowerCase();
  if (e.includes("sdet-02") || e.endsWith("sdet-02") || e === "k8s-sdet-02") {
    return "sdet02";
  }
  if (e.includes("sdet-05") || e.endsWith("sdet-05") || e === "k8s-sdet-05") {
    return "sdet05";
  }
  return null;
}

export type ServiceEnvDayRow = {
  service: string;
  sdet02: number;
  sdet05: number;
};

/** Group failures for one IST day into per-service counts for sdet-02 vs sdet-05 */
export function buildServiceEnvDayChart(
  failures: HealthCheckFailure[],
): ServiceEnvDayRow[] {
  const counts = new Map<string, { sdet02: number; sdet05: number }>();
  for (const name of EXPECTED_SERVICES) {
    counts.set(name, { sdet02: 0, sdet05: 0 });
  }

  for (const f of failures) {
    const svc = normalizeServiceName(f.service_name);
    const seg = normalizeEnvSegment(f.env ?? "");
    if (!seg || !counts.has(svc)) continue;
    const c = counts.get(svc)!;
    if (seg === "sdet02") c.sdet02 += 1;
    else c.sdet05 += 1;
  }

  return EXPECTED_SERVICES.map((service) => ({
    service,
    ...counts.get(service)!,
  }));
}

/** All failure rows for runs created on the given IST calendar day */
export async function fetchFailuresForIstDay(
  day: string,
): Promise<HealthCheckFailure[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { startIso, endIso } = istDayUtcRange(day);

  const { data: runs, error: runsErr } = await supabase
    .from("health_check_runs")
    .select("id")
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (runsErr) {
    console.error(
      "fetchFailuresForIstDay runs:",
      runsErr.message,
      runsErr.code ?? "",
    );
    return [];
  }

  const ids = (runs ?? []).map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: failures, error: failErr } = await supabase
    .from("health_check_failures")
    .select(FAILURE_COLUMNS)
    .in("run_id", ids);

  if (failErr) {
    console.error(
      "fetchFailuresForIstDay failures:",
      failErr.message,
      failErr.code ?? "",
    );
    return [];
  }

  return (failures ?? []) as HealthCheckFailure[];
}
