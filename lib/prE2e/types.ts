export type PrE2ePipelineFilter = "all" | "pr" | "release";

/** PR E2E dashboard only shows PR pipeline runs (not release). */
export const PR_E2E_PIPELINE_FILTER: PrE2ePipelineFilter = "pr";

export type PrE2eRun = {
  id: string;
  created_at: string;
  e2e_job_name: string;
  service_repo: string;
  module_primary: string | null;
  e2e_build_number: number;
  e2e_build_url: string;
  e2e_jenkins_result: string;
  e2e_duration_ms: number | null;
  finished_at_ist: string | null;
  github_pr_link: string | null;
  pr_number: number | null;
  test_branch: string | null;
  feature_branch: string | null;
  git_username: string | null;
  git_author: string | null;
  env_suffix: string;
  cucumber_tags: string | null;
  test_group: string | null;
  retry_enabled: boolean;
  parallel_execution: boolean;
  is_release_pipeline: boolean;
  trigger_type: string | null;
  trigger_user: string | null;
  upstream_job_name: string | null;
  total_tests: number;
  passed_count: number;
  failed_count: number;
  broken_count: number;
  skipped_count: number;
  unknown_count: number;
  pass_rate_pct: number | null;
  allure_url: string | null;
  gcs_report_path: string | null;
};

export type PrE2eFailure = {
  id: string;
  run_id: string;
  test_name: string;
  test_name_full: string | null;
  status: string;
  error_message: string | null;
  error_fingerprint: string | null;
  module: string | null;
  tags: string[];
  classification: string;
  duration_ms: number | null;
};

export type PrE2eRunWithFailures = PrE2eRun & {
  failures: PrE2eFailure[];
  failure_count: number;
};

export type PrE2eStabilityRow = {
  id: string;
  computed_at: string;
  service_repo: string;
  env_suffix: string;
  test_name: string;
  module: string | null;
  total_runs: number;
  runs_with_failure: number;
  runs_without_failure: number;
  flaky_rate_pct: number;
  stability_label: "flaky" | "failing" | "stable";
  last_seen_at: string | null;
};

export type PrE2eOverviewStats = {
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
  health24h: "green" | "amber" | "red";
  recentRuns: number;
  passRuns: number;
  failRuns: number;
  avgPassRate: number | null;
  flakyCount: number;
  failingCount: number;
  stableCount: number;
  stabilityTrackedTotal: number;
};

export type PrE2eDailyPoint = { label: string; passed: number; failed: number };

export type PrE2ePassRatePoint = {
  label: string;
  passRate: number | null;
  runs: number;
};

export type PrE2eVolumePoint = {
  label: string;
  success: number;
  failure: number;
  unstable: number;
  aborted: number;
  other: number;
};

export type PrE2eTestCountPoint = {
  label: string;
  passed: number;
  failed: number;
  broken: number;
  skipped: number;
};

export type PrE2eDurationPoint = { label: string; avgMs: number | null; runs: number };

export type PrE2eServicePoint = { service: string; failures: number; runs: number };

export type PrE2eNamedCount = { name: string; count: number; extra?: number };

export type PrE2eServiceHealth = {
  service: string;
  runs: number;
  passRate: number | null;
  lastResult: string;
  lastAt: string;
  flakyCount: number;
  failureCount: number;
  rag: "green" | "amber" | "red";
};

export type PrE2eHeatmapCell = { date: string; test: string; count: number };

export type PrE2eFingerprintRow = {
  fingerprint: string;
  count: number;
  sampleMessage: string | null;
};

export type PrE2eIngestPoint = { label: string; ok: number; error: number; skipped: number };

export type PrE2eIngestError = {
  id: string;
  created_at: string;
  e2e_job_name: string;
  build_number: number;
  status: string;
  message: string | null;
};

export type PrE2eCompareRow = {
  key: string;
  runs: number;
  passRate: number | null;
  failures: number;
};

/** Aggregated scope for 30d stability (PR env_suffix is ephemeral per build). */
export const PR_E2E_STABILITY_SCOPE = "pr-checks";

export function formatPrE2eStabilityScope(envSuffix: string): string {
  return envSuffix === PR_E2E_STABILITY_SCOPE
    ? "All PR envs"
    : envSuffix;
}

export function jenkinsResultIsSuccess(result: string): boolean {
  return result.trim().toUpperCase() === "SUCCESS";
}

export function runPasses(
  run: Pick<
    PrE2eRun,
    "failed_count" | "broken_count" | "e2e_jenkins_result"
  > & { failure_count?: number },
): boolean {
  const fc = effectiveFailureCount({
    failure_count: run.failure_count ?? 0,
    failed_count: run.failed_count,
    broken_count: run.broken_count,
    e2e_jenkins_result: run.e2e_jenkins_result,
  });
  return fc === 0 && jenkinsResultIsSuccess(run.e2e_jenkins_result);
}

/** Allure pass % on the run row, or derived from passed/total when ingest omitted pass_rate_pct. */
export function effectivePassRatePct(
  run: Pick<PrE2eRun, "pass_rate_pct" | "passed_count" | "total_tests">,
): number | null {
  if (run.pass_rate_pct != null) return run.pass_rate_pct;
  if (run.total_tests > 0) {
    return Math.round((run.passed_count / run.total_tests) * 10000) / 100;
  }
  return null;
}

/**
 * Failed/broken tests from pr_e2e_failures or Allure counts on the run.
 * When ingest only stored Jenkins outcome, a non-SUCCESS result counts as 1.
 */
export function effectiveFailureCount(
  run: Pick<PrE2eRun, "failed_count" | "broken_count" | "e2e_jenkins_result"> & {
    failure_count: number;
  },
): number {
  const fromDetail = Math.max(
    run.failure_count,
    run.failed_count + run.broken_count,
  );
  if (fromDetail > 0) return fromDetail;
  if (!jenkinsResultIsSuccess(run.e2e_jenkins_result)) return 1;
  return 0;
}

/** Display name for run author (git_author, else git_username). */
export function runGitAuthor(
  run: Pick<PrE2eRun, "git_author" | "git_username">,
): string {
  const a = run.git_author?.trim();
  if (a) return a;
  const u = run.git_username?.trim();
  if (u && u !== "NA") return u;
  return "unknown";
}

export function testHistoryHref(testName: string): string {
  return `/pr-checks/tests?name=${encodeURIComponent(testName)}`;
}

export function prHistoryHref(prNumber: number, service?: string): string {
  const base = `/pr-checks/pr/${prNumber}`;
  return service ? `${base}?service=${encodeURIComponent(service)}` : base;
}

export function serviceHref(service: string): string {
  return `/pr-checks/services/${encodeURIComponent(service)}`;
}
