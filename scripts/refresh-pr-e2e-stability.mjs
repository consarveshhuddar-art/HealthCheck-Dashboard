/**
 * Recompute pr_e2e_test_stability (30d) with service-level aggregation for PR ephemeral envs.
 * Usage: npm run refresh-pr-e2e-stability
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

function parseEnvLocal(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const STABILITY_SQL = `
DELETE FROM pr_e2e_test_stability WHERE window_days = 30;
INSERT INTO pr_e2e_test_stability (
  id, computed_at, window_days, service_repo, env_suffix, test_name, module,
  total_runs, runs_with_failure, runs_without_failure, flaky_rate_pct, stability_label,
  last_error_fingerprint, last_seen_at
)
SELECT
  UUID(), NOW(), 30, agg.service_repo, 'pr-checks', agg.test_name, agg.module,
  agg.total_runs, agg.runs_with_failure, GREATEST(agg.total_runs - agg.runs_with_failure, 0),
  ROUND(100.0 * agg.runs_with_failure / NULLIF(agg.total_runs, 0), 2),
  CASE
    WHEN agg.runs_with_failure >= 2 AND (agg.total_runs - agg.runs_with_failure) >= 1 THEN 'flaky'
    WHEN agg.runs_with_failure >= 2 THEN 'failing'
    ELSE 'stable'
  END,
  agg.last_error_fingerprint, agg.last_seen_at
FROM (
  SELECT
    r.service_repo,
    f.test_name,
    MAX(f.module) AS module,
    svc_runs.total_runs,
    COUNT(DISTINCT f.run_id) AS runs_with_failure,
    MAX(f.error_fingerprint) AS last_error_fingerprint,
    MAX(r.created_at) AS last_seen_at
  FROM pr_e2e_failures f
  INNER JOIN pr_e2e_runs r ON r.id = f.run_id
  INNER JOIN (
    SELECT service_repo, COUNT(*) AS total_runs
    FROM pr_e2e_runs
    WHERE created_at >= NOW() - INTERVAL 30 DAY
    GROUP BY service_repo
  ) svc_runs ON svc_runs.service_repo = r.service_repo
  WHERE r.created_at >= NOW() - INTERVAL 30 DAY
  GROUP BY r.service_repo, f.test_name, svc_runs.total_runs
) agg;
UPDATE pr_e2e_failures f
INNER JOIN pr_e2e_runs r ON r.id = f.run_id
INNER JOIN pr_e2e_test_stability s ON s.window_days = 30
  AND s.service_repo = r.service_repo AND s.env_suffix = 'pr-checks' AND s.test_name = f.test_name
SET f.classification = CASE s.stability_label WHEN 'flaky' THEN 'flaky' WHEN 'failing' THEN 'new' ELSE 'stable' END
WHERE r.created_at >= NOW() - INTERVAL 30 DAY;
`;

async function main() {
  const env = parseEnvLocal(fs.readFileSync(envPath, "utf8"));
  const conn = await mysql.createConnection({
    host: env.HEALTH_CHECK_MYSQL_HOST?.trim(),
    port: parseInt(env.HEALTH_CHECK_MYSQL_PORT?.trim() || "3306", 10),
    user: env.HEALTH_CHECK_MYSQL_USER?.trim(),
    password: env.HEALTH_CHECK_MYSQL_PASSWORD,
    database: env.HEALTH_CHECK_MYSQL_DATABASE?.trim(),
  });
  try {
    for (const stmt of STABILITY_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await conn.query(stmt);
    }
    const [counts] = await conn.query(
      `SELECT stability_label, COUNT(*) AS n FROM pr_e2e_test_stability
       WHERE window_days = 30 GROUP BY stability_label`,
    );
    console.log("pr_e2e_test_stability refreshed (service-level, env_suffix=pr-checks):");
    console.table(counts);
  } finally {
    await conn.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
