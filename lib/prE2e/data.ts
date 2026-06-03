import "server-only";
import { subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { RowDataPacket } from "mysql2";
import {
  loadErrorFingerprints,
  loadFailureHeatmap,
  loadFailuresByAuthor,
  loadFailuresByModule,
  loadFailuresByStatus,
  loadFlakinessByModule,
  loadIngestStatusCounts,
  loadIngestTrend,
  loadPassRateByEnv,
  loadPrE2eDurationTrend,
  loadPrE2ePassRateTrend,
  loadPrE2ePeriodStats,
  loadPrE2eTestCountTrend,
  loadPrE2eVolumeTrend,
  loadRecentIngestErrors,
  loadRunsByTrigger,
  loadServiceHealth,
  loadStabilityDistribution,
  loadTopFailingTests,
  loadPassRateWeekDelta,
  loadLastSuccessfulIngest,
  loadTriggerUnknownShare,
  loadModuleUnknownShare,
  parsePipelineFilter,
  TREND_DAYS,
} from "@/lib/prE2e/analytics";
import { PR_E2E_ANALYTICS_MAX_ROWS } from "@/lib/prE2e/limits";
import { fillDailyTrend, fillPassRateTrend } from "@/lib/prE2e/trendFill";
import { isHealthCheckMysqlReachable, withHealthCheckMysqlRetry } from "@/lib/mysql/server";
import type {
  PrE2eDailyPoint,
  PrE2eDurationPoint,
  PrE2eFailure,
  PrE2eFingerprintRow,
  PrE2eHeatmapCell,
  PrE2eIngestError,
  PrE2eIngestPoint,
  PrE2eNamedCount,
  PrE2eOverviewStats,
  PrE2ePassRatePoint,
  PrE2ePipelineFilter,
  PrE2eRun,
  PrE2eRunWithFailures,
  PrE2eServiceHealth,
  PrE2eServicePoint,
  PrE2eStabilityRow,
  PrE2eTestCountPoint,
  PrE2eVolumePoint,
} from "@/lib/prE2e/types";
import { classifyPrE2eEnvGroup } from "@/lib/prE2e/envGroups";
import {
  escapeMysqlLike,
  failureHasAllTags,
  parsePrE2eFailureTags,
  parseTagSearchQuery,
} from "@/lib/prE2e/tags";
import {
  effectiveFailureCount,
  effectivePassRatePct,
  runPasses,
} from "@/lib/prE2e/types";

const IST = "Asia/Kolkata";
const DEFAULT_RUNS_LIMIT = 80;

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date(String(v)).toISOString();
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

function pipelineWhere(
  filter: PrE2ePipelineFilter,
  alias = "r",
): { sql: string; params: number[] } {
  if (filter === "pr") return { sql: ` AND ${alias}.is_release_pipeline = 0`, params: [] };
  if (filter === "release")
    return { sql: ` AND ${alias}.is_release_pipeline = 1`, params: [] };
  return { sql: "", params: [] };
}

function mapRun(row: RowDataPacket): PrE2eRun {
  return {
    id: String(row.id),
    created_at: toIso(row.created_at),
    e2e_job_name: String(row.e2e_job_name ?? ""),
    service_repo: String(row.service_repo ?? ""),
    module_primary: row.module_primary ? String(row.module_primary) : null,
    e2e_build_number: num(row.e2e_build_number),
    e2e_build_url: String(row.e2e_build_url ?? ""),
    e2e_jenkins_result: String(row.e2e_jenkins_result ?? ""),
    e2e_duration_ms: numOrNull(row.e2e_duration_ms),
    finished_at_ist: row.finished_at_ist ? String(row.finished_at_ist) : null,
    github_pr_link: row.github_pr_link ? String(row.github_pr_link) : null,
    pr_number: numOrNull(row.pr_number),
    test_branch: row.test_branch ? String(row.test_branch) : null,
    feature_branch: row.feature_branch ? String(row.feature_branch) : null,
    git_username: row.git_username ? String(row.git_username) : null,
    git_author: row.git_author ? String(row.git_author) : null,
    env_suffix: String(row.env_suffix ?? ""),
    cucumber_tags: row.cucumber_tags ? String(row.cucumber_tags) : null,
    test_group: row.test_group ? String(row.test_group) : null,
    retry_enabled: bool(row.retry_enabled),
    parallel_execution: bool(row.parallel_execution),
    is_release_pipeline: bool(row.is_release_pipeline),
    trigger_type: row.trigger_type ? String(row.trigger_type) : null,
    trigger_user: row.trigger_user ? String(row.trigger_user) : null,
    upstream_job_name: row.upstream_job_name
      ? String(row.upstream_job_name)
      : null,
    total_tests: num(row.total_tests),
    passed_count: num(row.passed_count),
    failed_count: num(row.failed_count),
    broken_count: num(row.broken_count),
    skipped_count: num(row.skipped_count),
    unknown_count: num(row.unknown_count),
    pass_rate_pct: numOrNull(row.pass_rate_pct),
    scenarios_total: numOrNull(row.scenarios_total),
    scenarios_passed: numOrNull(row.scenarios_passed),
    scenarios_failed: numOrNull(row.scenarios_failed),
    scenarios_skipped: numOrNull(row.scenarios_skipped),
    allure_url: row.allure_url ? String(row.allure_url) : null,
    gcs_report_path: row.gcs_report_path ? String(row.gcs_report_path) : null,
  };
}

function mapFailure(row: RowDataPacket): PrE2eFailure {
  return {
    id: String(row.id),
    run_id: String(row.run_id),
    test_name: String(row.test_name ?? ""),
    test_name_full: row.test_name_full ? String(row.test_name_full) : null,
    status: String(row.status ?? "failed"),
    error_message: row.error_message ? String(row.error_message) : null,
    error_fingerprint: row.error_fingerprint
      ? String(row.error_fingerprint)
      : null,
    module: row.module ? String(row.module) : null,
    tags: parsePrE2eFailureTags(row.tags),
    classification: String(row.classification ?? "unknown"),
    duration_ms: numOrNull(row.duration_ms),
  };
}

function mapStability(row: RowDataPacket): PrE2eStabilityRow {
  const label = String(row.stability_label ?? "stable");
  return {
    id: String(row.id),
    computed_at: toIso(row.computed_at),
    service_repo: String(row.service_repo ?? ""),
    env_suffix: String(row.env_suffix ?? ""),
    test_name: String(row.test_name ?? ""),
    module: row.module ? String(row.module) : null,
    total_runs: num(row.total_runs),
    runs_with_failure: num(row.runs_with_failure),
    runs_without_failure: num(row.runs_without_failure),
    flaky_rate_pct: num(row.flaky_rate_pct),
    stability_label:
      label === "flaky" || label === "failing" ? label : "stable",
    last_seen_at: row.last_seen_at ? toIso(row.last_seen_at) : null,
  };
}

async function fetchFailuresForRunIds(
  pool: import("mysql2/promise").Pool,
  runIds: string[],
): Promise<Map<string, PrE2eFailure[]>> {
  const map = new Map<string, PrE2eFailure[]>();
  if (!pool || runIds.length === 0) return map;
  const placeholders = runIds.map(() => "?").join(",");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM pr_e2e_failures WHERE run_id IN (${placeholders})`,
    runIds,
  );
  for (const row of rows) {
    const f = mapFailure(row);
    const list = map.get(f.run_id) ?? [];
    list.push(f);
    map.set(f.run_id, list);
  }
  return map;
}

function attachFailuresToRuns(
  runs: PrE2eRun[],
  failuresByRun: Map<string, PrE2eFailure[]>,
): PrE2eRunWithFailures[] {
  return runs.map((r) => {
    const failures = failuresByRun.get(r.id) ?? [];
    return {
      ...r,
      failures,
      failure_count: effectiveFailureCount({
        failure_count: failures.length,
        failed_count: r.failed_count,
        broken_count: r.broken_count,
        e2e_jenkins_result: r.e2e_jenkins_result,
        total_tests: r.total_tests,
        scenarios_total: r.scenarios_total,
        scenarios_failed: r.scenarios_failed,
      }),
    };
  });
}

export async function loadPrE2eRuns(
  limit = DEFAULT_RUNS_LIMIT,
  filter: PrE2ePipelineFilter = "pr",
): Promise<PrE2eRunWithFailures[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pw = pipelineWhere(filter);
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*,
        (SELECT COUNT(*) FROM pr_e2e_failures f WHERE f.run_id = r.id) AS failure_count
       FROM pr_e2e_runs r
       WHERE 1=1${pw.sql}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [...pw.params, limit],
    );
    const runs = runRows.map((row) => mapRun(row));
    const failuresByRun = await fetchFailuresForRunIds(
      pool,
      runs.map((r) => r.id),
    );
    return attachFailuresToRuns(runs, failuresByRun);
  });
}

export async function loadPrE2eRunsInRange(
  days: number,
  limit: number,
  filter: PrE2ePipelineFilter = "pr",
): Promise<PrE2eRunWithFailures[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pw = pipelineWhere(filter);
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*,
        (SELECT COUNT(*) FROM pr_e2e_failures f WHERE f.run_id = r.id) AS failure_count
       FROM pr_e2e_runs r
       WHERE r.created_at >= ?${pw.sql}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [since, ...pw.params, limit],
    );
    const runs = runRows.map((row) => mapRun(row));
    const failuresByRun = await fetchFailuresForRunIds(
      pool,
      runs.map((r) => r.id),
    );
    return attachFailuresToRuns(runs, failuresByRun);
  });
}

export async function loadPrE2eRunById(
  id: string,
): Promise<PrE2eRunWithFailures | null> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM pr_e2e_runs WHERE id = ? LIMIT 1",
      [id],
    );
    if (!rows.length) return null;
    const run = mapRun(rows[0]);
    const [failRows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM pr_e2e_failures WHERE run_id = ? ORDER BY test_name",
      [id],
    );
    const failures = failRows.map(mapFailure);
    return {
      ...run,
      failures,
      failure_count: effectiveFailureCount({
        failure_count: failures.length,
        failed_count: run.failed_count,
        broken_count: run.broken_count,
        e2e_jenkins_result: run.e2e_jenkins_result,
        total_tests: run.total_tests,
        scenarios_total: run.scenarios_total,
        scenarios_failed: run.scenarios_failed,
      }),
    };
  });
}

export async function loadPrE2eRunsByPr(
  prNumber: number,
  service?: string,
): Promise<PrE2eRunWithFailures[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pw = pipelineWhere("pr");
    const params: (string | number)[] = [prNumber];
    let serviceSql = "";
    if (service) {
      serviceSql = " AND r.service_repo = ?";
      params.push(service);
    }
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*,
        (SELECT COUNT(*) FROM pr_e2e_failures f WHERE f.run_id = r.id) AS failure_count
       FROM pr_e2e_runs r
       WHERE r.pr_number = ?${serviceSql}${pw.sql}
       ORDER BY r.created_at DESC`,
      [...params, ...pw.params],
    );
    const runs = runRows.map((row) => mapRun(row));
    const failuresByRun = await fetchFailuresForRunIds(
      pool,
      runs.map((r) => r.id),
    );
    return attachFailuresToRuns(runs, failuresByRun);
  });
}

export async function loadPrE2eRunsByService(
  service: string,
  limit = 100,
): Promise<PrE2eRunWithFailures[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const pw = pipelineWhere("pr");
    const [runRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*,
        (SELECT COUNT(*) FROM pr_e2e_failures f WHERE f.run_id = r.id) AS failure_count
       FROM pr_e2e_runs r
       WHERE r.service_repo = ?${pw.sql}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [service, ...pw.params, limit],
    );
    const runs = runRows.map((row) => mapRun(row));
    const failuresByRun = await fetchFailuresForRunIds(
      pool,
      runs.map((r) => r.id),
    );
    return attachFailuresToRuns(runs, failuresByRun);
  });
}

export type PrE2eTestHistoryRow = {
  id: string;
  run_id: string;
  test_name: string;
  created_at: string;
  service_repo: string;
  git_author: string;
  e2e_build_number: number;
  status: string;
  error_message: string | null;
  tags: string[];
  classification: string;
  pass_rate_pct: number | null;
  e2e_jenkins_result: string;
  env_suffix: string;
  env_group: string;
};

export type PrE2eSearchResultFilters = {
  service?: string;
  author?: string;
};

const TEST_HISTORY_SELECT = `f.id, f.run_id, f.test_name, f.status, f.error_message, f.tags, f.classification,
  r.created_at, r.service_repo, r.e2e_build_number,
  r.pass_rate_pct, r.e2e_jenkins_result,
  COALESCE(NULLIF(TRIM(r.env_suffix), ''), '') AS env_suffix,
  COALESCE(NULLIF(TRIM(r.git_author), ''), NULLIF(TRIM(r.git_username), ''), 'unknown') AS git_author`;

function mapTestHistoryRow(row: RowDataPacket): PrE2eTestHistoryRow {
  return {
    id: String(row.id),
    run_id: String(row.run_id),
    test_name: String(row.test_name ?? ""),
    created_at: toIso(row.created_at),
    service_repo: String(row.service_repo ?? ""),
    git_author: String(row.git_author ?? "unknown"),
    e2e_build_number: num(row.e2e_build_number),
    status: String(row.status ?? ""),
    error_message: row.error_message ? String(row.error_message) : null,
    tags: parsePrE2eFailureTags(row.tags),
    classification: String(row.classification ?? "unknown"),
    pass_rate_pct: numOrNull(row.pass_rate_pct),
    e2e_jenkins_result: String(row.e2e_jenkins_result ?? ""),
    env_suffix: String(row.env_suffix ?? ""),
    env_group: classifyPrE2eEnvGroup(row.env_suffix),
  };
}

/** Failure rows for a test name (exact match on test_name / test_name_full). */
function searchFilterSql(filters?: PrE2eSearchResultFilters): {
  sql: string;
  params: string[];
} {
  const parts: string[] = [];
  const params: string[] = [];
  if (filters?.service?.trim()) {
    parts.push(" AND LOWER(r.service_repo) LIKE ?");
    params.push(`%${escapeMysqlLike(filters.service.trim().toLowerCase())}%`);
  }
  if (filters?.author?.trim()) {
    parts.push(
      ` AND LOWER(COALESCE(NULLIF(TRIM(r.git_author), ''), NULLIF(TRIM(r.git_username), ''), 'unknown')) LIKE ?`,
    );
    params.push(`%${escapeMysqlLike(filters.author.trim().toLowerCase())}%`);
  }
  return { sql: parts.join(""), params };
}

export async function loadPrE2eTestHistory(
  testName: string,
  limit = 100,
  filters?: PrE2eSearchResultFilters,
): Promise<PrE2eTestHistoryRow[]> {
  const term = testName.trim();
  if (!term) return [];

  return withHealthCheckMysqlRetry(async (pool) => {
    const like = `%${escapeMysqlLike(term)}%`;
    const ff = searchFilterSql(filters);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${TEST_HISTORY_SELECT}
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.is_release_pipeline = 0
         AND (
           f.test_name = ?
           OR f.test_name_full = ?
           OR f.test_name LIKE ?
           OR f.test_name_full LIKE ?
         )${ff.sql}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [term, term, like, like, ...ff.params, limit],
    );
    return rows.map(mapTestHistoryRow);
  });
}

export type PrE2eTagSearchResult = {
  rows: PrE2eTestHistoryRow[];
  totalCount: number;
  facets: { services: string[]; authors: string[] };
};

function applySearchResultFilters(
  rows: PrE2eTestHistoryRow[],
  filters?: PrE2eSearchResultFilters,
): PrE2eTestHistoryRow[] {
  if (!filters?.service?.trim() && !filters?.author?.trim()) return rows;
  const serviceNeedle = filters.service?.trim().toLowerCase() ?? "";
  const authorNeedle = filters.author?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (serviceNeedle && !row.service_repo.toLowerCase().includes(serviceNeedle)) {
      return false;
    }
    if (authorNeedle && !row.git_author.toLowerCase().includes(authorNeedle)) {
      return false;
    }
    return true;
  });
}

/** Failure rows whose tags include every token in the query (space-separated AND). */
export async function loadPrE2eFailuresByTags(
  tagQuery: string,
  limit = 150,
  filters?: PrE2eSearchResultFilters,
): Promise<PrE2eTagSearchResult> {
  const required = parseTagSearchQuery(tagQuery);
  if (!required.length) {
    return { rows: [], totalCount: 0, facets: { services: [], authors: [] } };
  }

  return withHealthCheckMysqlRetry(async (pool) => {
    const tagClauses = required
      .map(() => "LOWER(COALESCE(f.tags, '')) LIKE ?")
      .join(" AND ");
    const likeParams = required.map(
      (t) => `%${escapeMysqlLike(t.trim().toLowerCase())}%`,
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${TEST_HISTORY_SELECT}
       FROM pr_e2e_failures f
       INNER JOIN pr_e2e_runs r ON r.id = f.run_id
       WHERE r.is_release_pipeline = 0
         AND f.tags IS NOT NULL
         AND TRIM(f.tags) <> ''
         AND f.tags <> '[]'
         AND ${tagClauses}
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [...likeParams, Math.min(limit * 3, 500)],
    );

    const all = rows
      .map(mapTestHistoryRow)
      .filter((row) => failureHasAllTags(row.tags, required));

    const services = [...new Set(all.map((r) => r.service_repo).filter(Boolean))].sort();
    const authors = [...new Set(all.map((r) => r.git_author).filter((a) => a !== "unknown"))].sort();

    const filtered = applySearchResultFilters(all, filters);

    return {
      rows: filtered.slice(0, limit),
      totalCount: all.length,
      facets: { services, authors },
    };
  });
}

export async function loadPrE2eStability(
  label?: "flaky" | "failing" | "stable",
  limit = 200,
): Promise<PrE2eStabilityRow[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const sql = label
      ? `SELECT * FROM pr_e2e_test_stability
         WHERE window_days = 30 AND stability_label = ?
         ORDER BY flaky_rate_pct DESC, last_seen_at DESC
         LIMIT ?`
      : `SELECT * FROM pr_e2e_test_stability
         WHERE window_days = 30
         ORDER BY FIELD(stability_label, 'flaky', 'failing', 'stable'),
           flaky_rate_pct DESC
         LIMIT ?`;
    const params = label ? [label, limit] : [limit];
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows.map(mapStability);
  });
}

export type PrE2eFullDashboard = {
  runs: PrE2eRunWithFailures[];
  stability: PrE2eStabilityRow[];
  stats: PrE2eOverviewStats;
  daily: PrE2eDailyPoint[];
  byService: PrE2eServicePoint[];
  passRateTrend: PrE2ePassRatePoint[];
  volumeTrend: PrE2eVolumePoint[];
  testCountTrend: PrE2eTestCountPoint[];
  durationTrend: PrE2eDurationPoint[];
  topFailing7d: PrE2eNamedCount[];
  topFailing30d: PrE2eNamedCount[];
  fingerprints: PrE2eFingerprintRow[];
  heatmap: PrE2eHeatmapCell[];
  failuresByModule: PrE2eNamedCount[];
  failuresByStatus: PrE2eNamedCount[];
  stabilityDist: PrE2eNamedCount[];
  flakinessByModule: PrE2eNamedCount[];
  serviceHealth: PrE2eServiceHealth[];
  passRateByEnv: PrE2eNamedCount[];
  runsByTrigger: PrE2eNamedCount[];
  failuresByAuthor: PrE2eNamedCount[];
  ingestTrend: PrE2eIngestPoint[];
  ingestErrors: PrE2eIngestError[];
  ingestStatus: PrE2eNamedCount[];
  passRateWeekDelta: { current: number | null; previous: number | null };
  lastSuccessfulIngest: string | null;
  triggerUnknownPct: number | null;
  moduleUnknownPct: number | null;
  dbConnectionError: boolean;
};

/** Core PR E2E data without range-scoped charts (those load per-widget via /api/pr-e2e/query). */
export async function loadPrE2eDashboardBase(
  filter: PrE2ePipelineFilter = "pr",
  runsLimit = DEFAULT_RUNS_LIMIT,
): Promise<PrE2eFullDashboard> {
  const empty: PrE2eFullDashboard = {
    runs: [],
    stability: [],
    stats: emptyStats(),
    daily: [],
    byService: [],
    passRateTrend: [],
    volumeTrend: [],
    testCountTrend: [],
    durationTrend: [],
    topFailing7d: [],
    topFailing30d: [],
    fingerprints: [],
    heatmap: [],
    failuresByModule: [],
    failuresByStatus: [],
    stabilityDist: [],
    flakinessByModule: [],
    serviceHealth: [],
    passRateByEnv: [],
    runsByTrigger: [],
    failuresByAuthor: [],
    ingestTrend: [],
    ingestErrors: [],
    ingestStatus: [],
    passRateWeekDelta: { current: null, previous: null },
    lastSuccessfulIngest: null,
    triggerUnknownPct: null,
    moduleUnknownPct: null,
    dbConnectionError: true,
  };

  if (!(await isHealthCheckMysqlReachable())) return empty;

  const [
    runs,
    stability,
    period,
    topFailing7d,
    topFailing30d,
    stabilityDist,
    flakinessByModule,
    serviceHealth,
    ingestTrend,
    ingestErrors,
    ingestStatus,
    passRateWeekDelta,
    lastSuccessfulIngest,
    triggerUnknownPct,
    moduleUnknownPct,
    fingerprints,
  ] = await Promise.all([
    loadPrE2eRuns(runsLimit, filter),
    loadPrE2eStability(undefined, 50),
    loadPrE2ePeriodStats(filter),
    loadTopFailingTests(filter, 7, PR_E2E_ANALYTICS_MAX_ROWS),
    loadTopFailingTests(filter, 30, PR_E2E_ANALYTICS_MAX_ROWS),
    loadStabilityDistribution(),
    loadFlakinessByModule(),
    loadServiceHealth(filter),
    loadIngestTrend(),
    loadRecentIngestErrors(),
    loadIngestStatusCounts(),
    loadPassRateWeekDelta(filter),
    loadLastSuccessfulIngest(),
    loadTriggerUnknownShare(filter),
    loadModuleUnknownShare(filter),
    loadErrorFingerprints(filter, 30, PR_E2E_ANALYTICS_MAX_ROWS),
  ]);

  const passRuns = runs.filter(runPasses).length;
  const failRuns = runs.length - passRuns;
  const flakyCount = stability.filter((s) => s.stability_label === "flaky").length;
  const failingCount = stability.filter(
    (s) => s.stability_label === "failing",
  ).length;
  const stableCount = stability.filter((s) => s.stability_label === "stable").length;
  const stabilityTrackedTotal = stabilityDist.reduce((a, s) => a + s.count, 0);

  let health24h: "green" | "amber" | "red" = "green";
  if (period.runs24h === 0) health24h = "amber";
  else if (period.fail24h > period.pass24h) health24h = "red";
  else if (period.fail24h > 0) health24h = "amber";

  return {
    runs,
    stability,
    daily: [],
    byService: [],
    passRateTrend: [],
    volumeTrend: [],
    testCountTrend: [],
    durationTrend: [],
    topFailing7d,
    topFailing30d,
    fingerprints,
    heatmap: [],
    failuresByModule: [],
    failuresByStatus: [],
    stabilityDist,
    flakinessByModule,
    serviceHealth,
    passRateByEnv: [],
    runsByTrigger: [],
    failuresByAuthor: [],
    ingestTrend,
    ingestErrors,
    ingestStatus,
    passRateWeekDelta,
    lastSuccessfulIngest,
    triggerUnknownPct,
    moduleUnknownPct,
    stats: {
      ...period,
      recentRuns: runs.length,
      passRuns,
      failRuns,
      avgPassRate: null,
      flakyCount,
      failingCount,
      stableCount,
      stabilityTrackedTotal,
      health24h,
    },
    dbConnectionError: false,
  };
}

export async function loadPrE2eFullDashboard(
  filter: PrE2ePipelineFilter = "pr",
  runsLimit = DEFAULT_RUNS_LIMIT,
  trendDays: number = TREND_DAYS,
): Promise<PrE2eFullDashboard> {
  const empty: PrE2eFullDashboard = {
    runs: [],
    stability: [],
    stats: emptyStats(),
    daily: [],
    byService: [],
    passRateTrend: [],
    volumeTrend: [],
    testCountTrend: [],
    durationTrend: [],
    topFailing7d: [],
    topFailing30d: [],
    fingerprints: [],
    heatmap: [],
    failuresByModule: [],
    failuresByStatus: [],
    stabilityDist: [],
    flakinessByModule: [],
    serviceHealth: [],
    passRateByEnv: [],
    runsByTrigger: [],
    failuresByAuthor: [],
    ingestTrend: [],
    ingestErrors: [],
    ingestStatus: [],
    passRateWeekDelta: { current: null, previous: null },
    lastSuccessfulIngest: null,
    triggerUnknownPct: null,
    moduleUnknownPct: null,
    dbConnectionError: true,
  };

  if (!(await isHealthCheckMysqlReachable())) return empty;

  const [
    runs,
    stability,
    period,
    daily,
    byService,
    passRateTrend,
    volumeTrend,
    testCountTrend,
    durationTrend,
    topFailing7d,
    topFailing30d,
    fingerprints,
    heatmap,
    failuresByModule,
    failuresByStatus,
    stabilityDist,
    flakinessByModule,
    serviceHealth,
    passRateByEnv,
    runsByTrigger,
    failuresByAuthor,
    ingestTrend,
    ingestErrors,
    ingestStatus,
    passRateWeekDelta,
    lastSuccessfulIngest,
    triggerUnknownPct,
    moduleUnknownPct,
  ] = await Promise.all([
    loadPrE2eRuns(runsLimit, filter),
    loadPrE2eStability(undefined, 50),
    loadPrE2ePeriodStats(filter),
    loadDailyTrend(filter, trendDays),
    loadFailuresByService(filter, trendDays),
    loadPrE2ePassRateTrend(filter, trendDays),
    loadPrE2eVolumeTrend(filter, trendDays),
    loadPrE2eTestCountTrend(filter, trendDays),
    loadPrE2eDurationTrend(filter, trendDays),
    loadTopFailingTests(filter, 7, PR_E2E_ANALYTICS_MAX_ROWS),
    loadTopFailingTests(filter, 30, PR_E2E_ANALYTICS_MAX_ROWS),
    loadErrorFingerprints(filter, trendDays, PR_E2E_ANALYTICS_MAX_ROWS),
    loadFailureHeatmap(filter, trendDays, PR_E2E_ANALYTICS_MAX_ROWS),
    loadFailuresByModule(filter, trendDays, PR_E2E_ANALYTICS_MAX_ROWS),
    loadFailuresByStatus(filter, trendDays),
    loadStabilityDistribution(),
    loadFlakinessByModule(),
    loadServiceHealth(filter),
    loadPassRateByEnv(filter, 30, PR_E2E_ANALYTICS_MAX_ROWS),
    loadRunsByTrigger(filter, 30),
    loadFailuresByAuthor(filter, 30, PR_E2E_ANALYTICS_MAX_ROWS),
    loadIngestTrend(),
    loadRecentIngestErrors(),
    loadIngestStatusCounts(),
    loadPassRateWeekDelta(filter),
    loadLastSuccessfulIngest(),
    loadTriggerUnknownShare(filter),
    loadModuleUnknownShare(filter),
  ]);

  const filledPassRate = fillPassRateTrend(passRateTrend, trendDays);
  const filledDaily = fillDailyTrend(daily, trendDays);

  const passRuns = runs.filter(runPasses).length;
  const failRuns = runs.length - passRuns;
  const rates = runs
    .map((r) => effectivePassRatePct(r))
    .filter((x): x is number => x != null);
  const avgPassRate =
    rates.length > 0
      ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100
      : null;

  const flakyCount = stability.filter((s) => s.stability_label === "flaky").length;
  const failingCount = stability.filter(
    (s) => s.stability_label === "failing",
  ).length;
  const stableCount = stability.filter(
    (s) => s.stability_label === "stable",
  ).length;
  const stabilityTrackedTotal = stabilityDist.reduce((a, s) => a + s.count, 0);

  let health24h: "green" | "amber" | "red" = "green";
  if (period.runs24h === 0) health24h = "amber";
  else if (period.fail24h > period.pass24h) health24h = "red";
  else if (period.fail24h > 0) health24h = "amber";

  return {
    runs,
    stability,
    daily: filledDaily,
    byService,
    passRateTrend: filledPassRate,
    volumeTrend,
    testCountTrend,
    durationTrend,
    topFailing7d,
    topFailing30d,
    fingerprints,
    heatmap,
    failuresByModule,
    failuresByStatus,
    stabilityDist,
    flakinessByModule,
    serviceHealth,
    passRateByEnv,
    runsByTrigger,
    failuresByAuthor,
    ingestTrend,
    ingestErrors,
    ingestStatus,
    passRateWeekDelta,
    lastSuccessfulIngest,
    triggerUnknownPct,
    moduleUnknownPct,
    stats: {
      ...period,
      recentRuns: runs.length,
      passRuns,
      failRuns,
      avgPassRate,
      flakyCount,
      failingCount,
      stableCount,
      stabilityTrackedTotal,
      health24h,
    },
    dbConnectionError: false,
  };
}

function emptyStats(): PrE2eOverviewStats {
  return {
    runsToday: 0,
    runs7d: 0,
    runs30d: 0,
    passRateToday: null,
    passRate7d: null,
    passRate30d: null,
    totalFailures30d: 0,
    totalBroken30d: 0,
    activeServices: 0,
    runs24h: 0,
    pass24h: 0,
    fail24h: 0,
    health24h: "amber",
    recentRuns: 0,
    passRuns: 0,
    failRuns: 0,
    avgPassRate: null,
    flakyCount: 0,
    failingCount: 0,
    stableCount: 0,
    stabilityTrackedTotal: 0,
  };
}

/** @deprecated Use loadPrE2eFullDashboard */
export async function loadPrE2eOverviewSnapshot(runsLimit = DEFAULT_RUNS_LIMIT) {
  const full = await loadPrE2eFullDashboard("pr", runsLimit);
  return {
    runs: full.runs,
    stability: full.stability,
    daily: full.daily,
    byService: full.byService,
    stats: full.stats,
    dbConnectionError: full.dbConnectionError,
  };
}

async function loadDailyTrend(
  filter: PrE2ePipelineFilter,
  days = TREND_DAYS,
): Promise<PrE2eDailyPoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pw = pipelineWhere(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(created_at) AS d,
        SUM(CASE WHEN
          GREATEST(
            COALESCE(failed_count, 0) + COALESCE(broken_count, 0),
            COALESCE(scenarios_failed, 0)
          ) = 0
          AND UPPER(e2e_jenkins_result) = 'SUCCESS'
        THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN NOT (
          GREATEST(
            COALESCE(failed_count, 0) + COALESCE(broken_count, 0),
            COALESCE(scenarios_failed, 0)
          ) = 0
          AND UPPER(e2e_jenkins_result) = 'SUCCESS'
        ) THEN 1 ELSE 0 END) AS failed
       FROM pr_e2e_runs r
       WHERE created_at >= ?${pw.sql}
       GROUP BY DATE(created_at)
       ORDER BY d ASC`,
      [since, ...pw.params],
    );
    return rows.map((row) => ({
      label: formatInTimeZone(
        row.d instanceof Date ? row.d : new Date(String(row.d)),
        IST,
        "MMM d",
      ),
      passed: num(row.passed),
      failed: num(row.failed),
    }));
  });
}

async function loadFailuresByService(
  filter: PrE2ePipelineFilter,
  days = TREND_DAYS,
): Promise<PrE2eServicePoint[]> {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pw = pipelineWhere(filter);
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
       WHERE r.created_at >= ?${pw.sql}
       GROUP BY r.service_repo
       HAVING failures > 0
       ORDER BY failures DESC
       LIMIT 12`,
      [since, ...pw.params],
    );
    return rows.map((row) => ({
      service: String(row.service ?? "unknown"),
      runs: num(row.runs),
      failures: num(row.failures),
    }));
  });
}

export { parsePipelineFilter };

export function summarizePrE2eRuns(runs: PrE2eRunWithFailures[]) {
  const totalFailures = runs.reduce((a, r) => a + effectiveFailureCount(r), 0);
  return { runCount: runs.length, totalFailures };
}
