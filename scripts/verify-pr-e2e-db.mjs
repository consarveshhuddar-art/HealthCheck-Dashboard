/**
 * Verifies pr_e2e_* tables (read-only). Usage: npm run verify-pr-e2e-db
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

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

async function main() {
  let raw;
  try {
    raw = fs.readFileSync(envPath, "utf8");
  } catch {
    console.error("Missing .env.local — set HEALTH_CHECK_MYSQL_*.");
    process.exit(1);
  }

  const env = parseEnvLocal(raw);
  const host = env.HEALTH_CHECK_MYSQL_HOST?.trim();
  const user = env.HEALTH_CHECK_MYSQL_USER?.trim();
  const password =
    env.HEALTH_CHECK_MYSQL_PASSWORD !== undefined
      ? env.HEALTH_CHECK_MYSQL_PASSWORD
      : undefined;
  const database = env.HEALTH_CHECK_MYSQL_DATABASE?.trim();
  const port = parseInt(env.HEALTH_CHECK_MYSQL_PORT?.trim() || "3306", 10);

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  try {
    const [[runs]] = await conn.query(
      "SELECT COUNT(*) AS n FROM pr_e2e_runs",
    );
    const [[fail]] = await conn.query(
      "SELECT COUNT(*) AS n FROM pr_e2e_failures",
    );
    const [[stab]] = await conn.query(
      "SELECT COUNT(*) AS n FROM pr_e2e_test_stability WHERE window_days = 30",
    );
    let execN = null;
    try {
      const [[exec]] = await conn.query(
        `SELECT COUNT(*) AS n FROM pr_e2e_test_executions e
         INNER JOIN pr_e2e_runs r ON r.id = e.run_id
         WHERE r.created_at >= NOW() - INTERVAL 30 DAY`,
      );
      execN = exec.n;
    } catch {
      /* table may not exist yet */
    }
    const [latest] = await conn.query(
      `SELECT id, service_repo, e2e_build_number, e2e_jenkins_result,
              total_tests, failed_count, broken_count, gcs_report_path, created_at
       FROM pr_e2e_runs ORDER BY created_at DESC LIMIT 5`,
    );
    const [unparsed] = await conn.query(
      `SELECT id, service_repo, e2e_build_number, e2e_jenkins_result, gcs_report_path
       FROM pr_e2e_runs r
       WHERE r.gcs_report_path IS NOT NULL
         AND r.gcs_report_path <> ''
         AND COALESCE(r.total_tests, 0) = 0
         AND COALESCE(r.failed_count, 0) + COALESCE(r.broken_count, 0) = 0
         AND NOT EXISTS (SELECT 1 FROM pr_e2e_failures f WHERE f.run_id = r.id)
       ORDER BY r.created_at DESC
       LIMIT 10`,
    );
    const [ingestOk] = await conn.query(
      `SELECT status, COUNT(*) AS n FROM pr_e2e_ingest_log GROUP BY status`,
    );

    console.log("pr_e2e_runs:", runs.n);
    console.log("pr_e2e_failures:", fail.n);
    console.log("pr_e2e_test_stability (30d):", stab.n);
    if (execN != null) console.log("pr_e2e_test_executions (30d):", execN);
    console.log("\nIngest log by status:");
    console.table(ingestOk);
    console.log("\nLatest runs:");
    console.table(latest);

    if (Number(fail.n) === 0 && Number(runs.n) > 0) {
      console.warn(
        "\nWARN: pr_e2e_failures is empty but runs exist — ingest likely only writes pr_e2e_runs.",
      );
    }
    if (execN === null) {
      console.warn(
        "WARN: pr_e2e_test_executions table missing — run scripts/create-pr-e2e-test-executions.sql",
      );
    } else if (Number(execN) === 0) {
      console.warn(
        "WARN: pr_e2e_test_executions empty — npm run backfill-pr-e2e-executions",
      );
    }
    if (Number(stab.n) === 0) {
      console.warn(
        "WARN: pr_e2e_test_stability is empty — npm run refresh-pr-e2e-stability after executions exist.",
      );
    }
    if (unparsed.length) {
      console.warn(
        `\nWARN: ${unparsed.length} run(s) have gcs_report_path but Allure was not parsed (0/0 tests, no failure rows):`,
      );
      console.table(unparsed);
      console.warn(
        "Fix prE2eIngest.groovy: after upload to GCS, read Allure widgets/summary + failed cases, UPDATE pr_e2e_runs counts, INSERT pr_e2e_failures.",
      );
    }

    console.log("\nOK — pr_e2e tables readable.");
  } catch (e) {
    console.error("DB error:", e.message || e);
    process.exit(1);
  } finally {
    await conn.end().catch(() => {});
  }
}

main();
