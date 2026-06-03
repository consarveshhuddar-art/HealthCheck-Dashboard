/**
 * Re-parse Allure + scenario txt from GCS for runs that were ingested with 0/0 tests.
 * Usage: npm run backfill-pr-e2e-from-gcs
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import {
  collectExecutionsFromTree,
  collectFailedFromTree,
  executionDedupeKey,
  mergeExecutions,
  parseExecutionsFromScenarioTxt,
} from "./pr-e2e-allure.mjs";
import {
  STABILITY_REFRESH_SQL,
  splitStabilityStatements,
} from "./pr-e2e-stability-sql.mjs";

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

function gsutilCp(gcs, local) {
  fs.mkdirSync(path.dirname(local), { recursive: true });
  execSync(`gsutil -q cp "${gcs}" "${local}"`, { stdio: "pipe" });
}

async function insertExecutions(conn, runId, executions) {
  await conn.query(`DELETE FROM pr_e2e_test_executions WHERE run_id = ?`, [runId]);
  if (!executions.length) return 0;
  const BATCH = 200;
  for (let i = 0; i < executions.length; i += BATCH) {
    const chunk = executions.slice(i, i + BATCH);
    const placeholders = chunk.map(() => "(UUID(), ?, ?, ?, ?, ?, ?)").join(", ");
    const params = [];
    for (const e of chunk) {
      params.push(
        runId,
        e.test_name,
        e.test_name_full,
        e.status,
        e.module,
        e.duration_ms ?? 0,
      );
    }
    await conn.query(
      `INSERT INTO pr_e2e_test_executions (
        id, run_id, test_name, test_name_full, status, module, duration_ms
      ) VALUES ${placeholders}`,
      params,
    );
  }
  return executions.length;
}

async function loadArtifacts(gcsPath) {
  const base = gcsPath.replace(/\/$/, "");
  const tmp = fs.mkdtempSync(path.join(root, ".backfill-"));
  const summaryPath = path.join(tmp, "summary.json");
  const categoriesPath = path.join(tmp, "categories.json");
  const failedTxtPath = path.join(tmp, "failed.txt");
  const allRunTxtPath = path.join(tmp, "allRun.txt");
  const skippedTxtPath = path.join(tmp, "skipped.txt");

  let summary = {};
  let categories = {};
  let failedTxt = "";
  let allRunTxt = "";
  let skippedTxt = "";

  try {
    gsutilCp(`${base}/allure-report/widgets/summary.json`, summaryPath);
    summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  } catch {
    /* optional */
  }
  try {
    gsutilCp(`${base}/allure-report/data/categories.json`, categoriesPath);
    categories = JSON.parse(fs.readFileSync(categoriesPath, "utf8"));
  } catch {
    /* optional */
  }
  try {
    gsutilCp(`${base}/failedTestScenarios.txt`, failedTxtPath);
    failedTxt = fs.readFileSync(failedTxtPath, "utf8");
  } catch {
    /* optional */
  }
  try {
    gsutilCp(`${base}/AllRunScenarios.txt`, allRunTxtPath);
    allRunTxt = fs.readFileSync(allRunTxtPath, "utf8");
  } catch {
    /* optional */
  }
  try {
    gsutilCp(`${base}/skippedTestScenarios.txt`, skippedTxtPath);
    skippedTxt = fs.readFileSync(skippedTxtPath, "utf8");
  } catch {
    /* optional */
  }

  fs.rmSync(tmp, { recursive: true, force: true });

  const stat = summary.statistic ?? {};
  const executions = [];
  const execSeen = new Set();
  collectExecutionsFromTree(categories, null, executions, execSeen);
  mergeExecutions(executions, parseExecutionsFromScenarioTxt(allRunTxt));
  mergeExecutions(executions, parseExecutionsFromScenarioTxt(failedTxt));
  mergeExecutions(executions, parseExecutionsFromScenarioTxt(skippedTxt));

  const failures = [];
  const failSeen = new Set();
  collectFailedFromTree(categories, null, failures, failSeen);
  for (const f of parseExecutionsFromScenarioTxt(failedTxt)) {
    if (f.status !== "failed" && f.status !== "broken") continue;
    const key = executionDedupeKey(f.test_name, []);
    if (!failSeen.has(key)) {
      failSeen.add(key);
      failures.push({
        ...f,
        error_message: f.error_message ?? "From scenario log",
      });
    }
  }

  const allLines = allRunTxt.split("\n").filter((l) => l.trim());
  const scenarioStats = {
    scenarios_total: allLines.length || null,
    scenarios_passed: allLines.filter((l) => l.includes("PASSED")).length || null,
    scenarios_failed:
      failedTxt.split("\n").filter((l) => l.trim()).length || null,
    scenarios_skipped:
      skippedTxt.split("\n").filter((l) => l.trim()).length || null,
  };

  let total = stat.total ?? 0;
  let passed = stat.passed ?? 0;
  let failed = stat.failed ?? 0;
  let skipped = stat.skipped ?? 0;
  let broken = stat.broken ?? 0;
  let unknown = stat.unknown ?? 0;

  if (total <= 0 && scenarioStats.scenarios_total) {
    total = scenarioStats.scenarios_total;
    passed = scenarioStats.scenarios_passed ?? 0;
    failed = scenarioStats.scenarios_failed ?? 0;
    skipped = scenarioStats.scenarios_skipped ?? 0;
    unknown = Math.max(total - passed - failed - skipped - broken, 0);
  } else if ((scenarioStats.scenarios_failed ?? 0) > failed + broken) {
    failed = scenarioStats.scenarios_failed ?? failed;
    passed = scenarioStats.scenarios_passed ?? passed;
    total = scenarioStats.scenarios_total ?? total;
    skipped = scenarioStats.scenarios_skipped ?? skipped;
    unknown = Math.max(total - passed - failed - skipped - broken, 0);
  }

  const passRate = total > 0 ? Math.round((10000 * passed) / total) / 100 : null;

  return {
    stat: { total, passed, failed, broken, skipped, unknown },
    scenarioStats,
    failures,
    executions,
    passRate,
  };
}

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
    const [runs] = await conn.query(
      `SELECT id, gcs_report_path FROM pr_e2e_runs
       WHERE gcs_report_path IS NOT NULL AND gcs_report_path <> ''
       ORDER BY created_at DESC`,
    );

    if (!runs.length) {
      console.log("No unparsed runs to backfill.");
      return;
    }

    console.log(`Backfilling ${runs.length} run(s)...`);
    for (const run of runs) {
      const { stat, scenarioStats, failures, executions, passRate } =
        await loadArtifacts(run.gcs_report_path);
      if (!stat.total && !failures.length && !scenarioStats.scenarios_total) {
        console.warn(`Skip ${run.id}: no Allure data at ${run.gcs_report_path}`);
        continue;
      }

      await conn.beginTransaction();
      try {
        let summaryObj = {};
        try {
          const raw = run.summary;
          summaryObj =
            typeof raw === "string"
              ? JSON.parse(raw || "{}")
              : raw && typeof raw === "object"
                ? { ...raw }
                : {};
        } catch {
          summaryObj = {};
        }
        summaryObj.allure_statistic = stat;
        summaryObj.scenario_stats = scenarioStats;

        await conn.query(`DELETE FROM pr_e2e_failures WHERE run_id = ?`, [run.id]);
        const execN = await insertExecutions(conn, run.id, executions);
        await conn.query(
          `UPDATE pr_e2e_runs SET
            total_tests = ?, passed_count = ?, failed_count = ?, broken_count = ?,
            skipped_count = ?, unknown_count = ?, pass_rate_pct = ?,
            scenarios_total = ?, scenarios_passed = ?, scenarios_failed = ?, scenarios_skipped = ?,
            summary = ?
           WHERE id = ?`,
          [
            stat.total ?? 0,
            stat.passed ?? 0,
            stat.failed ?? 0,
            stat.broken ?? 0,
            stat.skipped ?? 0,
            stat.unknown ?? 0,
            passRate,
            scenarioStats.scenarios_total,
            scenarioStats.scenarios_passed,
            scenarioStats.scenarios_failed,
            scenarioStats.scenarios_skipped,
            JSON.stringify(summaryObj),
            run.id,
          ],
        );

        for (const f of failures) {
          await conn.query(
            `INSERT INTO pr_e2e_failures (
              id, run_id, test_name, test_name_full, status, error_message,
              duration_ms, module, tags, parameters, classification, detail
            ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', NULL)`,
            [
              run.id,
              f.test_name,
              f.test_name_full,
              f.status,
              f.error_message,
              f.duration_ms,
              f.module,
              f.tags,
              f.parameters,
            ],
          );
        }
        await conn.commit();
        console.log(
          `OK ${run.id}: total=${stat.total ?? 0} executions=${execN} failures=${failures.length}`,
        );
      } catch (e) {
        await conn.rollback();
        console.error(`FAIL ${run.id}:`, e.message || e);
      }
    }

    for (const stmt of splitStabilityStatements(STABILITY_REFRESH_SQL)) {
      await conn.query(stmt);
    }
    console.log("Refreshed pr_e2e_test_stability (30d, execution-based).");
  } finally {
    await conn.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
