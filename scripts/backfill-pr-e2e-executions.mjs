/**
 * Populate pr_e2e_test_executions from GCS Allure artifacts for existing runs.
 * Usage: npm run backfill-pr-e2e-executions
 *
 * Then: npm run refresh-pr-e2e-stability
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

async function loadArtifacts(gcsPath) {
  const base = gcsPath.replace(/\/$/, "");
  const tmp = fs.mkdtempSync(path.join(root, ".backfill-exec-"));
  const summaryPath = path.join(tmp, "summary.json");
  const categoriesPath = path.join(tmp, "categories.json");
  const failedTxtPath = path.join(tmp, "failed.txt");
  const allRunTxtPath = path.join(tmp, "allRun.txt");
  const skippedTxtPath = path.join(tmp, "skipped.txt");

  let categories = {};
  let failedTxt = "";
  let allRunTxt = "";
  let skippedTxt = "";

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

  const executions = [];
  const seen = new Set();
  collectExecutionsFromTree(categories, null, executions, seen);
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
      failures.push(f);
    }
  }

  return { executions, failures };
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
         AND created_at >= NOW() - INTERVAL 30 DAY
       ORDER BY created_at DESC`,
    );

    if (!runs.length) {
      console.log("No runs with GCS paths in the last 30 days.");
      return;
    }

    console.log(`Backfilling executions for ${runs.length} run(s)...`);
    let ok = 0;
    let skip = 0;
    for (const run of runs) {
      try {
        const { executions } = await loadArtifacts(run.gcs_report_path);
        if (!executions.length) {
          console.warn(`Skip ${run.id}: no executions parsed`);
          skip++;
          continue;
        }
        await conn.beginTransaction();
        try {
          const n = await insertExecutions(conn, run.id, executions);
          await conn.commit();
          ok++;
          console.log(`OK ${run.id}: ${n} execution(s)`);
        } catch (e) {
          await conn.rollback();
          console.error(`FAIL ${run.id}:`, e.message || e);
        }
      } catch (e) {
        console.error(`FAIL ${run.id} (GCS):`, e.message || e);
      }
    }

    console.log(`Done: ${ok} run(s) with executions, ${skip} skipped.`);
    for (const stmt of splitStabilityStatements(STABILITY_REFRESH_SQL)) {
      await conn.query(stmt);
    }
    const [counts] = await conn.query(
      `SELECT stability_label, COUNT(*) AS n FROM pr_e2e_test_stability
       WHERE window_days = 30 GROUP BY stability_label`,
    );
    console.log("Refreshed pr_e2e_test_stability:");
    console.table(counts);
  } finally {
    await conn.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
