import "server-only";
import { subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { RowDataPacket } from "mysql2";
import { withHealthCheckMysqlRetry } from "@/lib/mysql/server";
import type {
  PrE2eDurationPoint,
  PrE2eFingerprintRow,
  PrE2eHeatmapCell,
  PrE2eIngestError,
  PrE2eIngestPoint,
  PrE2eNamedCount,
  PrE2ePassRatePoint,
  PrE2ePipelineFilter,
  PrE2ePrRaisedPoint,
  PrE2ePrRaisedSummary,
  PrE2eServiceDayFailure,
  PrE2eServiceHealth,
  PrE2eServicePoint,
  PrE2eTestCountPoint,
  PrE2eVolumePoint,
} from "@/lib/prE2e/types";
import {
  SQL_EFFECTIVE_FINGERPRINT,
  SQL_EFFECTIVE_MODULE,
  SQL_EFFECTIVE_TRIGGER,
} from "@/lib/prE2e/sqlExprs";
import { PR_E2E_ANALYTICS_MAX_ROWS } from "@/lib/prE2e/limits";
import {
  PR_E2E_ENV_GROUPS,
  SQL_PR_E2E_ENV_GROUP,
  type PrE2eEnvGroup,
} from "@/lib/prE2e/envGroups";
import { jenkinsResultIsSuccess, ragFromLastRun } from "@/lib/prE2e/types";
import type { PrE2eServiceEnvFailurePct, PrE2eServiceEnvStats } from "@/lib/prE2e/types";

const IST = "Asia/Kolkata";
export const TREND_DAYS = 30;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDayLabel(d: unknown): string {
  const dt = d instanceof Date ? d : new Date(String(d));
  return formatInTimeZone(dt, IST, "MMM d");
}

function pipelineClause(
  filter: PrE2ePipelineFilter,
  alias = "r",
): { sql: string; params: number[] } {
  if (filter === "pr") return { sql: ` AND ${alias}.is_release_pipeline = 0`, params: [] };
  if (filter === "release")
    return { sql: ` AND ${alias}.is_release_pipeline = 1`, params: [] };
  return { sql: "", params: [] };
}

const PASS_EXPR = `(COALESCE(r.failed_count,0) + COALESCE(r.broken_count,0) = 0 AND UPPER(r.e2e_jenkins_result) = 'SUCCESS')`;

export async function loadPrRaisedSummary(
  filter: PrE2ePipelineFilter,
): Promise<PrE2ePrRaisedSummary> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS runs_7d,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS runs_30d,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS runs_90d
       FROM pr_e2e_runs r
       WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)${pc.sql}`,
      pc.params,
    );
    const row = rows[0] ?? {};
    return {
      runs7d: num(row.runs_7d),
      runs30d: num(row.runs_30d),
      runs90d: num(row.runs_90d),
    };
  });
}

export async function loadPrRaisedTrend(
  filter: PrE2ePipelineFilter,
  days = 90,
): Promise<PrE2ePrRaisedPoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(r.created_at) AS d, COUNT(*) AS runs
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY DATE(r.created_at)
       ORDER BY d ASC`,
      [since, ...pc.params],
    );
    return rows.map((row) => ({
      label: formatDayLabel(row.d),
      runs: num(row.runs),
    }));
  });
}

export async function loadPrE2ePeriodStats(
  filter: PrE2ePipelineFilter,
): Promise<{
  runsToday: number;
  runs7d: number;
  runs30d: number;
  passRateToday: number | null;
  passRate7d: number | null;
  passRate30d: number | null;
  totalFailures30d: number;
  totalBroken30d: number;
  activeServices: number;
  runs24h: number;
  pass24h: number;
  fail24h: number;
}> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        SUM(CASE WHEN r.created_at >= CURDATE() THEN 1 ELSE 0 END) AS runs_today,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS runs_7d,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS runs_30d,
        AVG(CASE WHEN r.created_at >= CURDATE() AND r.pass_rate_pct IS NOT NULL THEN r.pass_rate_pct END) AS pr_today,
        AVG(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND r.pass_rate_pct IS NOT NULL THEN r.pass_rate_pct END) AS pr_7d,
        AVG(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND r.pass_rate_pct IS NOT NULL THEN r.pass_rate_pct END) AS pr_30d,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN COALESCE(r.failed_count,0) ELSE 0 END) AS fail_30d,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN COALESCE(r.broken_count,0) ELSE 0 END) AS broken_30d,
        COUNT(DISTINCT CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN r.service_repo END) AS services_30d,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS runs_24h,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND ${PASS_EXPR} THEN 1 ELSE 0 END) AS pass_24h,
        SUM(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND NOT (${PASS_EXPR}) THEN 1 ELSE 0 END) AS fail_24h
       FROM pr_e2e_runs r
       WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)${pc.sql}`,
      pc.params,
    );
    const row = rows[0] ?? {};
    return {
      runsToday: num(row.runs_today),
      runs7d: num(row.runs_7d),
      runs30d: num(row.runs_30d),
      passRateToday: numOrNull(row.pr_today),
      passRate7d: numOrNull(row.pr_7d),
      passRate30d: numOrNull(row.pr_30d),
      totalFailures30d: num(row.fail_30d),
      totalBroken30d: num(row.broken_30d),
      activeServices: num(row.services_30d),
      runs24h: num(row.runs_24h),
      pass24h: num(row.pass_24h),
      fail24h: num(row.fail_24h),
    };
  });
}

export async function loadPrE2ePassRateTrend(
  filter: PrE2ePipelineFilter,
  days = TREND_DAYS,
): Promise<PrE2ePassRatePoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(r.created_at) AS d,
        COUNT(*) AS runs,
        AVG(r.pass_rate_pct) AS pass_rate
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY DATE(r.created_at)
       ORDER BY d ASC`,
      [since, ...pc.params],
    );
    return rows.map((row) => ({
      label: formatDayLabel(row.d),
      runs: num(row.runs),
      passRate: numOrNull(row.pass_rate),
    }));
  });
}

export async function loadPrE2eVolumeTrend(
  filter: PrE2ePipelineFilter,
  days = TREND_DAYS,
): Promise<PrE2eVolumePoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(r.created_at) AS d,
        SUM(CASE WHEN UPPER(r.e2e_jenkins_result) = 'SUCCESS' THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN UPPER(r.e2e_jenkins_result) = 'FAILURE' THEN 1 ELSE 0 END) AS failure,
        SUM(CASE WHEN UPPER(r.e2e_jenkins_result) = 'UNSTABLE' THEN 1 ELSE 0 END) AS unstable,
        SUM(CASE WHEN UPPER(r.e2e_jenkins_result) = 'ABORTED' THEN 1 ELSE 0 END) AS aborted,
        SUM(CASE WHEN UPPER(r.e2e_jenkins_result) NOT IN ('SUCCESS','FAILURE','UNSTABLE','ABORTED') THEN 1 ELSE 0 END) AS other
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY DATE(r.created_at)
       ORDER BY d ASC`,
      [since, ...pc.params],
    );
    return rows.map((row) => ({
      label: formatDayLabel(row.d),
      success: num(row.success),
      failure: num(row.failure),
      unstable: num(row.unstable),
      aborted: num(row.aborted),
      other: num(row.other),
    }));
  });
}

export async function loadPrE2eTestCountTrend(
  filter: PrE2ePipelineFilter,
  days = TREND_DAYS,
): Promise<PrE2eTestCountPoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(r.created_at) AS d,
        SUM(COALESCE(r.passed_count,0)) AS passed,
        SUM(COALESCE(r.failed_count,0)) AS failed,
        SUM(COALESCE(r.broken_count,0)) AS broken,
        SUM(COALESCE(r.skipped_count,0)) AS skipped
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY DATE(r.created_at)
       ORDER BY d ASC`,
      [since, ...pc.params],
    );
    return rows.map((row) => ({
      label: formatDayLabel(row.d),
      passed: num(row.passed),
      failed: num(row.failed),
      broken: num(row.broken),
      skipped: num(row.skipped),
    }));
  });
}

export async function loadPrE2eDurationTrend(
  filter: PrE2ePipelineFilter,
  days = TREND_DAYS,
): Promise<PrE2eDurationPoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(r.created_at) AS d,
        AVG(r.e2e_duration_ms) AS avg_ms,
        COUNT(*) AS runs
       FROM pr_e2e_runs r
       WHERE r.created_at >= ? AND r.e2e_duration_ms IS NOT NULL AND r.e2e_duration_ms > 0${pc.sql}
       GROUP BY DATE(r.created_at)
       ORDER BY d ASC`,
      [since, ...pc.params],
    );
    return rows.map((row) => ({
      label: formatDayLabel(row.d),
      avgMs: numOrNull(row.avg_ms),
      runs: num(row.runs),
    }));
  });
}

export async function loadTopFailingTests(
  filter: PrE2ePipelineFilter,
  days: number,
  limit = PR_E2E_ANALYTICS_MAX_ROWS,
): Promise<PrE2eNamedCount[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter, "r");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.test_name AS name, ${SQL_EFFECTIVE_MODULE} AS test_module, COUNT(*) AS cnt
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY f.test_name, test_module
       ORDER BY cnt DESC
       LIMIT ?`,
      [since, ...pc.params, limit],
    );
    return rows.map((row) => ({
      name: String(row.name ?? ""),
      count: num(row.cnt),
      extra: row.test_module ? 1 : 0,
    }));
  });
}

export async function loadErrorFingerprints(
  filter: PrE2ePipelineFilter,
  days = 30,
  limit = PR_E2E_ANALYTICS_MAX_ROWS,
): Promise<PrE2eFingerprintRow[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter, "r");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${SQL_EFFECTIVE_FINGERPRINT} AS fp,
        COUNT(*) AS cnt,
        SUBSTRING(MAX(f.error_message), 1, 240) AS sample_msg
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.created_at >= ?
         AND f.error_message IS NOT NULL
         AND TRIM(f.error_message) <> ''${pc.sql}
       GROUP BY fp
       ORDER BY cnt DESC
       LIMIT ?`,
      [since, ...pc.params, limit],
    );
    return rows.map((row) => ({
      fingerprint: String(row.fp ?? "unknown"),
      count: num(row.cnt),
      sampleMessage: row.sample_msg ? String(row.sample_msg) : null,
    }));
  });
}

export async function loadFailureHeatmap(
  filter: PrE2ePipelineFilter,
  days = 14,
  testLimit = PR_E2E_ANALYTICS_MAX_ROWS,
): Promise<PrE2eHeatmapCell[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter, "r");
    const [topTests] = await pool.query<RowDataPacket[]>(
      `SELECT f.test_name AS tn, COUNT(*) AS c
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY f.test_name
       ORDER BY c DESC
       LIMIT ?`,
      [since, ...pc.params, testLimit],
    );
    const tests = topTests.map((t) => String(t.tn));
    if (!tests.length) return [];

    const placeholders = tests.map(() => "?").join(",");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(r.created_at) AS d, f.test_name AS tn, COUNT(*) AS c
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.created_at >= ?${pc.sql}
         AND f.test_name IN (${placeholders})
       GROUP BY DATE(r.created_at), f.test_name
       ORDER BY d ASC`,
      [since, ...pc.params, ...tests],
    );
    return rows.map((row) => ({
      date: formatDayLabel(row.d),
      test: String(row.tn),
      count: num(row.c),
    }));
  });
}

export async function loadFailuresByStatus(
  filter: PrE2ePipelineFilter,
  days = 30,
): Promise<PrE2eNamedCount[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter, "r");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT LOWER(f.status) AS name, COUNT(*) AS cnt
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY LOWER(f.status)
       ORDER BY cnt DESC`,
      [since, ...pc.params],
    );
    return rows.map((row) => ({ name: String(row.name), count: num(row.cnt) }));
  });
}

export async function loadStabilityDistribution(): Promise<PrE2eNamedCount[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT stability_label AS name, COUNT(*) AS cnt
       FROM pr_e2e_test_stability
       WHERE window_days = 30
       GROUP BY stability_label`,
    );
    return rows.map((row) => ({ name: String(row.name), count: num(row.cnt) }));
  });
}

export async function loadFlakinessByModule(): Promise<PrE2eNamedCount[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(NULLIF(module,''), 'unknown') AS name,
        ROUND(AVG(flaky_rate_pct), 1) AS cnt
       FROM pr_e2e_test_stability
       WHERE window_days = 30 AND stability_label = 'flaky'
       GROUP BY name
       ORDER BY cnt DESC
       LIMIT ?`,
      [PR_E2E_ANALYTICS_MAX_ROWS],
    );
    return rows.map((row) => ({
      name: String(row.name),
      count: num(row.cnt),
    }));
  });
}

export async function loadFailuresByService(
  filter: PrE2ePipelineFilter,
  days: number,
  limit = PR_E2E_ANALYTICS_MAX_ROWS,
): Promise<PrE2eServicePoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.service_repo AS service,
        COUNT(DISTINCT r.id) AS runs,
        SUM(
          GREATEST(
            COALESCE(r.failed_count, 0) + COALESCE(r.broken_count, 0),
            (SELECT COUNT(*) FROM pr_e2e_failures f WHERE f.run_id = r.id),
            IF(UPPER(r.e2e_jenkins_result) <> 'SUCCESS', 1, 0)
          )
        ) AS failures
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY r.service_repo
       ORDER BY failures DESC, runs DESC
       LIMIT ?`,
      [since, ...pc.params, limit],
    );
    return rows.map((row) => ({
      service: String(row.service ?? "unknown"),
      runs: num(row.runs),
      failures: num(row.failures),
    }));
  });
}

function mapServiceDayFailureRows(rows: RowDataPacket[]): PrE2eServiceDayFailure[] {
  return rows.map((row) => ({
    service: String(row.service ?? "unknown"),
    failedRuns: num(row.failed_runs),
    totalRuns: num(row.total_runs),
  }));
}

/** Failed PR E2E runs per service on one IST calendar day (`yyyy-MM-dd`). */
export async function loadServiceFailuresOnIstDay(
  istDate: string,
  filter: PrE2ePipelineFilter = "pr",
  limit = PR_E2E_ANALYTICS_MAX_ROWS,
): Promise<PrE2eServiceDayFailure[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.service_repo AS service,
        COUNT(*) AS total_runs,
        SUM(CASE WHEN NOT (${PASS_EXPR}) THEN 1 ELSE 0 END) AS failed_runs
       FROM pr_e2e_runs r
       WHERE DATE(CONVERT_TZ(r.created_at, '+00:00', '+05:30')) = ?
         ${pc.sql}
       GROUP BY r.service_repo
       HAVING failed_runs > 0
       ORDER BY failed_runs DESC, total_runs DESC
       LIMIT ?`,
      [istDate, ...pc.params, limit],
    );
    return mapServiceDayFailureRows(rows);
  });
}

/** Failed PR E2E runs per service over the last N days (rolling window). */
export async function loadServiceFailuresInRange(
  days: number,
  filter: PrE2ePipelineFilter = "pr",
  limit = PR_E2E_ANALYTICS_MAX_ROWS,
): Promise<PrE2eServiceDayFailure[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.service_repo AS service,
        COUNT(*) AS total_runs,
        SUM(CASE WHEN NOT (${PASS_EXPR}) THEN 1 ELSE 0 END) AS failed_runs
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY r.service_repo
       HAVING failed_runs > 0
       ORDER BY failed_runs DESC, total_runs DESC
       LIMIT ?`,
      [since, ...pc.params, limit],
    );
    return mapServiceDayFailureRows(rows);
  });
}

function emptyServiceEnvStats(): PrE2eServiceEnvStats {
  return { failPct: null, runs: 0, failedRuns: 0 };
}

function emptyServiceEnvMap(): Record<PrE2eEnvGroup, PrE2eServiceEnvStats> {
  return {
    "k8s-sdet-02": emptyServiceEnvStats(),
    "k8s-sdet-05": emptyServiceEnvStats(),
    ephemeral: emptyServiceEnvStats(),
  };
}

function pivotServiceEnvFailureRows(
  rows: RowDataPacket[],
): PrE2eServiceEnvFailurePct[] {
  const envSet = new Set<string>(PR_E2E_ENV_GROUPS);
  const map = new Map<string, Record<PrE2eEnvGroup, PrE2eServiceEnvStats>>();

  for (const row of rows) {
    const env = String(row.env_group ?? "");
    if (!envSet.has(env)) continue;
    const envKey = env as PrE2eEnvGroup;
    const service = String(row.service ?? "unknown");
    const total = num(row.total_runs);
    const failed = num(row.failed_runs);
    if (!map.has(service)) map.set(service, emptyServiceEnvMap());
    const entry = map.get(service)!;
    entry[envKey] = {
      runs: total,
      failedRuns: failed,
      failPct:
        total > 0 ? Math.round((failed / total) * 1000) / 10 : null,
    };
  }

  return [...map.entries()]
    .map(([service, envs]) => ({ service, envs }))
    .sort((a, b) => {
      const runs = (row: PrE2eServiceEnvFailurePct) =>
        PR_E2E_ENV_GROUPS.reduce((sum, env) => sum + row.envs[env].runs, 0);
      return runs(b) - runs(a);
    });
}

/** Failed-run % per service in k8s-sdet-02, k8s-sdet-05, and ephemeral env groups. */
export async function loadServiceFailurePctByEnv(
  filter: PrE2ePipelineFilter,
  days = 30,
  service?: string,
): Promise<PrE2eServiceEnvFailurePct[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const serviceSql = service ? " AND r.service_repo = ?" : "";
    const params: (Date | string | number)[] = [since, ...pc.params];
    if (service) params.push(service);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.service_repo AS service,
        ${SQL_PR_E2E_ENV_GROUP} AS env_group,
        COUNT(*) AS total_runs,
        SUM(CASE WHEN NOT (${PASS_EXPR}) THEN 1 ELSE 0 END) AS failed_runs
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}${serviceSql}
         AND ${SQL_PR_E2E_ENV_GROUP} IS NOT NULL
       GROUP BY r.service_repo, env_group
       ORDER BY r.service_repo ASC`,
      params,
    );
    return pivotServiceEnvFailureRows(rows);
  });
}

export async function loadServiceHealth(
  filter: PrE2ePipelineFilter,
  days = 30,
): Promise<PrE2eServiceHealth[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pc = pipelineClause(filter);
    const since = subDays(new Date(), days);
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.service_repo AS svc,
        COUNT(*) AS runs,
        AVG(r.pass_rate_pct) AS pass_rate,
        SUBSTRING_INDEX(GROUP_CONCAT(r.e2e_jenkins_result ORDER BY r.created_at DESC), ',', 1) AS last_result,
        SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(r.failed_count, 0) ORDER BY r.created_at DESC), ',', 1) AS last_failed,
        SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(r.broken_count, 0) ORDER BY r.created_at DESC), ',', 1) AS last_broken,
        SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(r.scenarios_failed, 0) ORDER BY r.created_at DESC), ',', 1) AS last_scenarios_failed,
        MAX(r.created_at) AS last_at
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY r.service_repo
       ORDER BY runs DESC`,
      [since, ...pc.params],
    );
    const [uniqueFailRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.service_repo AS svc, COUNT(DISTINCT f.test_name) AS unique_fails
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY r.service_repo`,
      [since, ...pc.params],
    );
    const uniqueFailMap = new Map(
      uniqueFailRows.map((r) => [String(r.svc), num(r.unique_fails)]),
    );
    const [flakyRows] = await pool.query<RowDataPacket[]>(
      `SELECT service_repo AS svc, COUNT(*) AS n
       FROM pr_e2e_test_stability
       WHERE window_days = 30 AND stability_label = 'flaky'
       GROUP BY service_repo`,
    );
    const flakyMap = new Map(
      flakyRows.map((r) => [String(r.svc), num(r.n)]),
    );

    return runRows.map((row) => {
      const passRate = numOrNull(row.pass_rate);
      const lastResult = String(row.last_result ?? "");
      const flakyCount = flakyMap.get(String(row.svc)) ?? 0;
      const rag = ragFromLastRun({
        e2e_jenkins_result: lastResult,
        failed_count: num(row.last_failed),
        broken_count: num(row.last_broken),
        scenarios_failed: num(row.last_scenarios_failed),
        total_tests: 0,
        scenarios_total: 0,
      });

      return {
        service: String(row.svc),
        runs: num(row.runs),
        passRate,
        lastResult,
        lastAt: row.last_at instanceof Date
          ? row.last_at.toISOString()
          : String(row.last_at),
        flakyCount,
        failureCount: uniqueFailMap.get(String(row.svc)) ?? 0,
        rag,
      };
    });
  });
}

export async function loadPrE2eRangeSummary(
  filter: PrE2ePipelineFilter,
  days: number,
): Promise<{
  runs: number;
  passRuns: number;
  failRuns: number;
  passRateAvg: number | null;
  totalFailures: number;
  totalBroken: number;
  activeServices: number;
}> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(*) AS runs,
        SUM(CASE WHEN ${PASS_EXPR} THEN 1 ELSE 0 END) AS pass_runs,
        SUM(CASE WHEN NOT (${PASS_EXPR}) THEN 1 ELSE 0 END) AS fail_runs,
        AVG(CASE WHEN r.pass_rate_pct IS NOT NULL THEN r.pass_rate_pct END) AS pr_avg,
        SUM(COALESCE(r.failed_count, 0)) AS fail_cnt,
        SUM(COALESCE(r.broken_count, 0)) AS broken_cnt,
        COUNT(DISTINCT r.service_repo) AS services
       FROM pr_e2e_runs r
       WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${pc.sql}`,
      [days, ...pc.params],
    );
    const row = rows[0] ?? {};
    return {
      runs: num(row.runs),
      passRuns: num(row.pass_runs),
      failRuns: num(row.fail_runs),
      passRateAvg: numOrNull(row.pr_avg),
      totalFailures: num(row.fail_cnt),
      totalBroken: num(row.broken_cnt),
      activeServices: num(row.services),
    };
  });
}

export async function loadPassRateByEnv(
  filter: PrE2ePipelineFilter,
  days = 30,
  limit = PR_E2E_ANALYTICS_MAX_ROWS,
): Promise<PrE2eNamedCount[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.env_suffix AS name,
        COUNT(*) AS cnt,
        ROUND(AVG(r.pass_rate_pct), 1) AS extra
       FROM pr_e2e_runs r
       WHERE r.created_at >= ? AND r.env_suffix IS NOT NULL AND r.env_suffix <> ''${pc.sql}
       GROUP BY r.env_suffix
       HAVING cnt >= 1
       ORDER BY cnt DESC
       LIMIT ?`,
      [since, ...pc.params, limit],
    );
    return rows.map((row) => ({
      name: String(row.name),
      count: num(row.cnt),
      extra: numOrNull(row.extra) ?? undefined,
    }));
  });
}

export async function loadRunsByTrigger(
  filter: PrE2ePipelineFilter,
  days = 30,
): Promise<PrE2eNamedCount[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${SQL_EFFECTIVE_TRIGGER} AS name, COUNT(*) AS cnt
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}
       GROUP BY name
       ORDER BY cnt DESC`,
      [since, ...pc.params],
    );
    return rows.map((row) => ({ name: String(row.name), count: num(row.cnt) }));
  });
}

export async function loadIngestTrend(days = 30): Promise<PrE2eIngestPoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(created_at) AS d,
        SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS err,
        SUM(CASE WHEN status = 'skipped_duplicate' THEN 1 ELSE 0 END) AS skipped
       FROM pr_e2e_ingest_log
       WHERE created_at >= ?
       GROUP BY DATE(created_at)
       ORDER BY d ASC`,
      [since],
    );
    return rows.map((row) => ({
      label: formatDayLabel(row.d),
      ok: num(row.ok),
      error: num(row.err),
      skipped: num(row.skipped),
    }));
  });
}

export async function loadRecentIngestErrors(
  limit = 20,
): Promise<PrE2eIngestError[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id,
         DATE_FORMAT(
           CONVERT_TZ(created_at, '+00:00', '+05:30'),
           '%Y-%m-%d %H:%i:%s'
         ) AS created_at,
         e2e_job_name, build_number, status, message
       FROM pr_e2e_ingest_log
       WHERE status <> 'ok'
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map((row) => ({
      id: String(row.id),
      created_at: String(row.created_at ?? ""),
      e2e_job_name: String(row.e2e_job_name ?? ""),
      build_number: num(row.build_number),
      status: String(row.status ?? ""),
      message: row.message ? String(row.message) : null,
    }));
  });
}

export async function loadIngestStatusCounts(): Promise<PrE2eNamedCount[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status AS name, COUNT(*) AS cnt FROM pr_e2e_ingest_log GROUP BY status`,
    );
    return rows.map((row) => ({ name: String(row.name), count: num(row.cnt) }));
  });
}

export async function loadPassRateWeekDelta(
  filter: PrE2ePipelineFilter,
): Promise<{ current: number | null; previous: number | null }> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        AVG(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND r.pass_rate_pct IS NOT NULL
          THEN r.pass_rate_pct END) AS cur_pr,
        AVG(CASE WHEN r.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
          AND r.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY) AND r.pass_rate_pct IS NOT NULL
          THEN r.pass_rate_pct END) AS prev_pr
       FROM pr_e2e_runs r
       WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)${pc.sql}`,
      pc.params,
    );
    const row = rows[0] ?? {};
    return {
      current: numOrNull(row.cur_pr),
      previous: numOrNull(row.prev_pr),
    };
  });
}

export async function loadLastSuccessfulIngest(): Promise<string | null> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(
         CONVERT_TZ(MAX(created_at), '+00:00', '+05:30'),
         '%Y-%m-%d %H:%i:%s'
       ) AS t
       FROM pr_e2e_ingest_log
       WHERE status = 'ok'`,
    );
    const t = rows[0]?.t;
    if (t == null || t === "") return null;
    return String(t);
  });
}

export async function loadServicePassRateTrend(
  service: string,
  days = 7,
): Promise<PrE2ePassRatePoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(r.created_at) AS d,
        COUNT(*) AS runs,
        AVG(r.pass_rate_pct) AS pass_rate
       FROM pr_e2e_runs r
       WHERE r.service_repo = ? AND r.created_at >= ? AND r.is_release_pipeline = 0
       GROUP BY DATE(r.created_at)
       ORDER BY d ASC`,
      [service, since],
    );
    return rows.map((row) => ({
      label: formatDayLabel(row.d),
      runs: num(row.runs),
      passRate: numOrNull(row.pass_rate),
    }));
  });
}

export async function loadStabilityFirstSeen(
  keys: { service_repo: string; test_name: string }[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!keys.length) return map;
  return withHealthCheckMysqlRetry(async (pool) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.service_repo AS svc, f.test_name AS tn, MIN(r.created_at) AS first_seen
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.is_release_pipeline = 0
       GROUP BY r.service_repo, f.test_name`,
    );
    for (const row of rows) {
      const key = `${row.svc}|${row.tn}`;
      map.set(
        key,
        row.first_seen instanceof Date
          ? row.first_seen.toISOString()
          : String(row.first_seen),
      );
    }
    return map;
  });
}

export async function loadTriggerUnknownShare(
  filter: PrE2ePipelineFilter,
): Promise<number | null> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), 30);
    const pc = pipelineClause(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        SUM(CASE WHEN ${SQL_EFFECTIVE_TRIGGER} = 'unknown' THEN 1 ELSE 0 END) AS unk,
        COUNT(*) AS total
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pc.sql}`,
      [since, ...pc.params],
    );
    const total = num(rows[0]?.total);
    if (total === 0) return null;
    return Math.round((num(rows[0]?.unk) / total) * 1000) / 10;
  });
}

export async function loadModuleUnknownShare(
  filter: PrE2ePipelineFilter,
): Promise<number | null> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), 30);
    const pc = pipelineClause(filter, "r");
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        SUM(CASE WHEN ${SQL_EFFECTIVE_MODULE} = 'unknown' THEN 1 ELSE 0 END) AS unk,
        COUNT(*) AS total
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.created_at >= ?${pc.sql}`,
      [since, ...pc.params],
    );
    const total = num(rows[0]?.total);
    if (total === 0) return null;
    return Math.round((num(rows[0]?.unk) / total) * 1000) / 10;
  });
}

export function parsePipelineFilter(
  _raw?: string | undefined,
): PrE2ePipelineFilter {
  return "pr";
}
