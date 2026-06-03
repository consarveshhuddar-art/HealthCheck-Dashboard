/**
 * Shared 30d stability refresh from pr_e2e_test_executions.
 * Labels: stable <5% fail, flaky 5–80%, failing >=80% (min executions required).
 */

export const STABILITY_WINDOW_DAYS = 30;
export const STABILITY_MIN_EXECUTIONS = 5;
export const STABILITY_FAIL_RATE_STABLE_MAX = 5;
export const STABILITY_FAIL_RATE_FLAKY_MAX = 80;

export const STABILITY_REFRESH_SQL = `
DELETE FROM pr_e2e_test_stability WHERE window_days = ${STABILITY_WINDOW_DAYS};
INSERT INTO pr_e2e_test_stability (
  id, computed_at, window_days, service_repo, env_suffix, test_name, module,
  total_runs, runs_with_failure, runs_without_failure, flaky_rate_pct, stability_label,
  last_error_fingerprint, last_seen_at
)
SELECT
  UUID(), NOW(), ${STABILITY_WINDOW_DAYS}, agg.service_repo, 'pr-checks', agg.test_name, agg.module,
  agg.total_executions,
  agg.failed_executions,
  agg.passed_executions,
  agg.failure_rate_pct,
  CASE
    WHEN agg.total_executions < ${STABILITY_MIN_EXECUTIONS} THEN 'stable'
    WHEN agg.failure_rate_pct < ${STABILITY_FAIL_RATE_STABLE_MAX} THEN 'stable'
    WHEN agg.failure_rate_pct < ${STABILITY_FAIL_RATE_FLAKY_MAX} THEN 'flaky'
    ELSE 'failing'
  END,
  agg.last_error_fingerprint,
  agg.last_seen_at
FROM (
  SELECT
    r.service_repo,
    e.test_name,
    MAX(f.module) AS module,
    COUNT(*) AS total_executions,
    SUM(CASE WHEN e.status IN ('failed', 'broken') THEN 1 ELSE 0 END) AS failed_executions,
    SUM(CASE WHEN e.status = 'passed' THEN 1 ELSE 0 END) AS passed_executions,
    ROUND(
      100.0 * SUM(CASE WHEN e.status IN ('failed', 'broken') THEN 1 ELSE 0 END)
      / NULLIF(
        SUM(CASE WHEN e.status IN ('passed', 'failed', 'broken') THEN 1 ELSE 0 END),
        0
      ),
      2
    ) AS failure_rate_pct,
    MAX(f.error_fingerprint) AS last_error_fingerprint,
    MAX(r.created_at) AS last_seen_at
  FROM pr_e2e_test_executions e
  INNER JOIN pr_e2e_runs r ON r.id = e.run_id
  LEFT JOIN pr_e2e_failures f
    ON f.run_id = e.run_id AND f.test_name = e.test_name
  WHERE r.created_at >= NOW() - INTERVAL ${STABILITY_WINDOW_DAYS} DAY
    AND r.is_release_pipeline = 0
    AND e.status IN ('passed', 'failed', 'broken')
  GROUP BY r.service_repo, e.test_name
) agg;
UPDATE pr_e2e_failures f
INNER JOIN pr_e2e_runs r ON r.id = f.run_id
INNER JOIN pr_e2e_test_stability s
  ON s.window_days = ${STABILITY_WINDOW_DAYS}
  AND s.service_repo = r.service_repo
  AND s.env_suffix = 'pr-checks'
  AND s.test_name = f.test_name
SET f.classification = CASE s.stability_label
  WHEN 'flaky' THEN 'flaky'
  WHEN 'failing' THEN 'new'
  ELSE 'stable'
END
WHERE r.created_at >= NOW() - INTERVAL ${STABILITY_WINDOW_DAYS} DAY;
`;

export function splitStabilityStatements(sql) {
  return sql.split(";").map((s) => s.trim()).filter(Boolean);
}
