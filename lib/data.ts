import "server-only";
import { addDays, addWeeks, parseISO, startOfWeek, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type { RowDataPacket } from "mysql2";
import { EXPECTED_SERVICES } from "@/lib/healthServices";
import {
  RUN_WINDOW_LIMITS,
  TREND_DAILY_DAYS,
  TREND_FAILURE_LOOKBACK_IST_DAYS,
  TREND_WEEKLY_BUCKETS,
} from "@/lib/limits";
import {
  getHealthCheckMysqlPool,
  invalidateHealthCheckMysqlPool,
  isRecoverableMysqlPoolError,
  withHealthCheckMysqlRetry,
} from "@/lib/mysql/server";
import type {
  FailureWithRunTime,
  HealthCheckFailure,
  HealthCheckRun,
  RunWithFailures,
} from "@/lib/types";

const IST = "Asia/Kolkata";

/** Chunk size for `WHERE run_id IN (...)` — balance packet size vs round-trips. */
const FAILURE_RUN_ID_CHUNK = 350;

function logAndMaybeResetPool(context: string, e: unknown): void {
  console.error(context, e);
  if (isRecoverableMysqlPoolError(e)) {
    invalidateHealthCheckMysqlPool();
  }
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  try {
    return new Date(String(value)).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function parseEnvs(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseSummary(raw: unknown): Record<string, unknown> {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (typeof p === "object" && p !== null && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function parseHttpCode(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapFailureRow(row: Record<string, unknown>): HealthCheckFailure {
  return {
    id: String(row.id ?? ""),
    run_id: String(row.run_id ?? ""),
    env: String(row.env ?? ""),
    service_name: String(row.service_name ?? ""),
    http_code: parseHttpCode(row.http_code),
    detail:
      row.detail === null || row.detail === undefined
        ? null
        : String(row.detail),
  };
}

function mapRunRow(row: Record<string, unknown>): HealthCheckRun {
  const bn = row.build_number;
  return {
    id: String(row.id ?? ""),
    created_at: toIso(row.created_at),
    checked_at_ist: String(row.checked_at_ist ?? ""),
    build_url: String(row.build_url ?? ""),
    jenkins_result: String(row.jenkins_result ?? ""),
    build_number:
      typeof bn === "number"
        ? bn
        : Number.isFinite(Number(bn))
          ? Number(bn)
          : 0,
    envs: parseEnvs(row.envs),
    summary: parseSummary(row.summary),
  };
}

async function fetchFailuresForRunIds(
  runIds: string[],
): Promise<HealthCheckFailure[]> {
  if (!getHealthCheckMysqlPool() || runIds.length === 0) return [];

  const out: HealthCheckFailure[] = [];
  for (let i = 0; i < runIds.length; i += FAILURE_RUN_ID_CHUNK) {
    const chunk = runIds.slice(i, i + FAILURE_RUN_ID_CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    try {
      const rows = await withHealthCheckMysqlRetry(async (pool) => {
        const [r] = await pool.query<RowDataPacket[]>(
          `SELECT id, run_id, env, service_name, http_code, detail
         FROM health_check_failures
         WHERE run_id IN (${placeholders})`,
          chunk,
        );
        return r;
      });
      for (const row of rows) {
        out.push(mapFailureRow(row as Record<string, unknown>));
      }
    } catch (e) {
      logAndMaybeResetPool("fetchFailuresForRunIds:", e);
    }
  }
  return out;
}

export async function fetchRecentRunsWithFailures(
  limit = RUN_WINDOW_LIMITS.week,
): Promise<RunWithFailures[]> {
  if (!getHealthCheckMysqlPool()) return [];

  let runList: HealthCheckRun[] = [];
  try {
    runList = await withHealthCheckMysqlRetry(async (pool) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, created_at, checked_at_ist, build_number, build_url, jenkins_result, envs, summary
       FROM health_check_runs
       ORDER BY created_at DESC
       LIMIT ?`,
        [limit],
      );
      return rows.map((r) => mapRunRow(r as Record<string, unknown>));
    });
  } catch (e) {
    logAndMaybeResetPool("fetchRecentRunsWithFailures runs:", e);
    return [];
  }

  const ids = runList.map((r) => r.id).filter(Boolean);
  const failuresByRun = new Map<string, HealthCheckFailure[]>();
  if (ids.length > 0) {
    const failures = await fetchFailuresForRunIds(ids);
    for (const row of failures) {
      const rid = row.run_id;
      const list = failuresByRun.get(rid) ?? [];
      list.push(row);
      failuresByRun.set(rid, list);
    }
  }

  return runList.map((run) => ({
    ...run,
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

/** Last `daysBack` IST calendar days as `yyyy-MM-dd` (oldest first). */
export function lastNDaysIST(daysBack: number): string[] {
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

/**
 * Build donut-series data from per-day totals (e.g. MySQL aggregate). Fills missing days with zeros.
 */
export function buildDailyRunOutcomesFromAggregates(
  byDay: Map<string, { total: number; failed: number }>,
  daysBack: number,
): DailyRunOutcome[] {
  const slots = lastNDaysIST(daysBack);
  return slots.map((date) => {
    const row = byDay.get(date);
    const total = row?.total ?? 0;
    const failed = Math.min(row?.failed ?? 0, total);
    const success = total - failed;
    return {
      date,
      label: formatInTimeZone(parseISO(`${date}T06:30:00.000Z`), IST, "MMM d"),
      total,
      success,
      failed,
    };
  });
}

/** Per-IST-day run counts for outcome donuts (~1 month window). */
export async function fetchRunOutcomeAggregatesByIstDay(
  startIso: string,
  endIso: string,
): Promise<Map<string, { total: number; failed: number }>> {
  const out = new Map<string, { total: number; failed: number }>();
  if (!getHealthCheckMysqlPool()) return out;

  try {
    const rows = await withHealthCheckMysqlRetry(async (pool) => {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT
           DATE_FORMAT(
             CONVERT_TZ(r.created_at, '+00:00', '+05:30'),
             '%Y-%m-%d'
           ) AS ist_day,
           COUNT(*) AS total,
           SUM(IF(COALESCE(fc.cnt, 0) > 0, 1, 0)) AS failed_runs
         FROM health_check_runs r
         LEFT JOIN (
           SELECT run_id, COUNT(*) AS cnt
           FROM health_check_failures
           GROUP BY run_id
         ) fc ON fc.run_id = r.id
         WHERE r.created_at >= ? AND r.created_at <= ?
         GROUP BY ist_day
         ORDER BY ist_day ASC`,
        [startIso, endIso],
      );
      return r;
    });

    for (const row of rows) {
      const rec = row as Record<string, unknown>;
      const day = String(rec.ist_day ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const total = Number(rec.total ?? 0);
      const failed = Number(rec.failed_runs ?? 0);
      out.set(day, { total, failed: Math.min(failed, total) });
    }
  } catch (e) {
    logAndMaybeResetPool("fetchRunOutcomeAggregatesByIstDay:", e);
  }

  return out;
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

export type EnvFailureRangeMode = "day" | "week" | "all";

export function parseEnvFailureRangeMode(
  raw: string | undefined,
): EnvFailureRangeMode {
  if (raw === "week" || raw === "all") return raw;
  return "day";
}

/** Rolling 7 IST calendar days ending today (inclusive). */
export function last7IstDaysUtcRange(): { startIso: string; endIso: string } {
  const istNow = toZonedTime(new Date(), IST);
  const endDay = formatInTimeZone(istNow, IST, "yyyy-MM-dd");
  const startLocal = subDays(istNow, 6);
  const startDay = formatInTimeZone(startLocal, IST, "yyyy-MM-dd");
  return {
    startIso: istDayUtcRange(startDay).startIso,
    endIso: istDayUtcRange(endDay).endIso,
  };
}

/** Rolling `n` IST calendar days ending today (inclusive). */
export function lastNIstDaysUtcRange(
  n: number,
): { startIso: string; endIso: string } {
  if (n < 1) {
    const d = defaultIstDayString();
    const r = istDayUtcRange(d);
    return { startIso: r.startIso, endIso: r.endIso };
  }
  const istNow = toZonedTime(new Date(), IST);
  const endDay = formatInTimeZone(istNow, IST, "yyyy-MM-dd");
  const startLocal = subDays(istNow, n - 1);
  const startDay = formatInTimeZone(startLocal, IST, "yyyy-MM-dd");
  return {
    startIso: istDayUtcRange(startDay).startIso,
    endIso: istDayUtcRange(endDay).endIso,
  };
}

export function envFailureRangeCaption(
  mode: EnvFailureRangeMode,
  day: string,
): { title: string; detail: string } {
  if (mode === "day") {
    const label = formatInTimeZone(
      parseISO(`${day}T06:30:00.000Z`),
      IST,
      "d MMM yyyy",
    );
    return {
      title: `One day · ${label} (IST)`,
      detail:
        "Failures linked to runs created on this IST calendar day only.",
    };
  }
  if (mode === "week") {
    const { startIso, endIso } = last7IstDaysUtcRange();
    const a = formatInTimeZone(parseISO(startIso), IST, "d MMM yyyy");
    const b = formatInTimeZone(parseISO(endIso), IST, "d MMM yyyy");
    return {
      title: `Last 7 days · ${a} – ${b} (IST)`,
      detail:
        "Failures linked to runs whose created_at falls in this IST window (today and the six prior calendar days).",
    };
  }
  return {
    title: "All time",
    detail:
      "Aggregates every row (paginated load; capped at 150k rows for safety).",
  };
}

/** Failures for runs created in [startIso, endIso] (typically IST-derived instants). */
export async function fetchFailuresForCreatedAtRange(
  startIso: string,
  endIso: string,
): Promise<HealthCheckFailure[]> {
  if (!getHealthCheckMysqlPool()) return [];

  try {
    const rows = await withHealthCheckMysqlRetry(async (pool) => {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM health_check_runs
       WHERE created_at >= ? AND created_at <= ?`,
        [startIso, endIso],
      );
      return r;
    });
    const ids = rows.map((r) => String((r as { id: string }).id)).filter(Boolean);
    return fetchFailuresForRunIds(ids);
  } catch (e) {
    logAndMaybeResetPool("fetchFailuresForCreatedAtRange runs:", e);
    return [];
  }
}

const TREND_FAILURE_QUERY_ROW_CAP = 250_000;

/**
 * Failure rows with parent run `created_at` for area charts (one JOIN).
 * Capped for safety on very large ranges.
 */
export async function fetchFailuresWithRunCreatedAtInUtcRange(
  startIso: string,
  endIso: string,
): Promise<FailureWithRunTime[]> {
  if (!getHealthCheckMysqlPool()) return [];

  try {
    const rows = await withHealthCheckMysqlRetry(async (pool) => {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT f.id, f.run_id, f.env, f.service_name, f.http_code, f.detail,
                r.created_at AS run_created_at
         FROM health_check_failures f
         INNER JOIN health_check_runs r ON r.id = f.run_id
         WHERE r.created_at >= ? AND r.created_at <= ?
         ORDER BY r.created_at DESC
         LIMIT ?`,
        [startIso, endIso, TREND_FAILURE_QUERY_ROW_CAP],
      );
      return r;
    });
    return rows.map((row) => {
      const rec = row as Record<string, unknown>;
      return {
        ...mapFailureRow(rec),
        run_created_at: toIso(rec.run_created_at),
      };
    });
  } catch (e) {
    logAndMaybeResetPool("fetchFailuresWithRunCreatedAtInUtcRange:", e);
    return [];
  }
}

const ALL_FAILURES_MAX = 150_000;

/** Paginated failure rows, ordered by parent run time then failure id (stable). */
export async function fetchAllFailuresLimited(): Promise<HealthCheckFailure[]> {
  if (!getHealthCheckMysqlPool()) return [];

  const pageSize = 1000;
  const out: HealthCheckFailure[] = [];
  let offset = 0;

  while (out.length < ALL_FAILURES_MAX) {
    const take = Math.min(pageSize, ALL_FAILURES_MAX - out.length);
    try {
      const rows = await withHealthCheckMysqlRetry(async (pool) => {
        const [r] = await pool.query<RowDataPacket[]>(
          `SELECT f.id, f.run_id, f.env, f.service_name, f.http_code, f.detail
         FROM health_check_failures f
         INNER JOIN health_check_runs r ON r.id = f.run_id
         ORDER BY r.created_at DESC, f.id ASC
         LIMIT ? OFFSET ?`,
          [take, offset],
        );
        return r;
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        out.push(mapFailureRow(row as Record<string, unknown>));
      }
      if (rows.length < take) break;
      offset += rows.length;
    } catch (e) {
      logAndMaybeResetPool("fetchAllFailuresLimited:", e);
      break;
    }
  }

  return out;
}

export async function fetchFailuresForEnvRange(
  mode: EnvFailureRangeMode,
  day: string,
): Promise<HealthCheckFailure[]> {
  if (mode === "day") {
    const { startIso, endIso } = istDayUtcRange(day);
    return fetchFailuresForCreatedAtRange(startIso, endIso);
  }
  if (mode === "week") {
    const { startIso, endIso } = last7IstDaysUtcRange();
    return fetchFailuresForCreatedAtRange(startIso, endIso);
  }
  return fetchAllFailuresLimited();
}

/** Parallel MySQL load for the main dashboard (runs + env-range failures + trend series). */
export async function loadDashboardMysqlSnapshot(params: {
  runsLimit: number;
  envRange: EnvFailureRangeMode;
  selectedIstDay: string;
}): Promise<{
  runs: RunWithFailures[];
  envFailures: HealthCheckFailure[];
  trendFailures: FailureWithRunTime[];
  outcomeAggregates: Map<string, { total: number; failed: number }>;
}> {
  const trendRange = lastNIstDaysUtcRange(TREND_FAILURE_LOOKBACK_IST_DAYS);
  const outcomeRange = lastNIstDaysUtcRange(TREND_DAILY_DAYS);
  const [runs, envFailures, trendFailures, outcomeAggregates] =
    await Promise.all([
      fetchRecentRunsWithFailures(params.runsLimit),
      fetchFailuresForEnvRange(params.envRange, params.selectedIstDay),
      fetchFailuresWithRunCreatedAtInUtcRange(
        trendRange.startIso,
        trendRange.endIso,
      ),
      fetchRunOutcomeAggregatesByIstDay(
        outcomeRange.startIso,
        outcomeRange.endIso,
      ),
    ]);
  return { runs, envFailures, trendFailures, outcomeAggregates };
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

/** Group failures into per-service counts for sdet-02 vs sdet-05 (any time window). */
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
  const { startIso, endIso } = istDayUtcRange(day);
  return fetchFailuresForCreatedAtRange(startIso, endIso);
}
