/**
 * Re-parse Allure + scenario txt from GCS for runs that were ingested with 0/0 tests.
 * Usage: npm run backfill-pr-e2e-from-gcs
 */

import { execSync } from "child_process";
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

function gsutilCp(gcs, local) {
  fs.mkdirSync(path.dirname(local), { recursive: true });
  execSync(`gsutil -q cp "${gcs}" "${local}"`, { stdio: "pipe" });
}

function normalizeScenarioName(testName) {
  return testName
    ?.replace(/\s*\[.*?\]$/, "")
    ?.replace(/\s*\(.*?\)$/, "")
    ?.replace(/\s*\|.*$/, "")
    ?.trim();
}

function failureDedupeKey(testName, parameters) {
  const base = normalizeScenarioName(testName) || testName;
  if (!Array.isArray(parameters) || parameters.length === 0) return base;
  const sig = parameters
    .map((p) => {
      if (typeof p === "string") return p;
      const n = p?.name ?? p?.key ?? "";
      const v = p?.value ?? p?.val ?? "";
      return n ? `${n}=${v}` : String(v ?? "");
    })
    .filter((s) => s?.trim())
    .join(",");
  return sig ? `${base}|${sig}` : base;
}

function sanitizeErrorMessage(msg) {
  const err = msg?.trim();
  if (!err || err === "categories" || err === "Product defects" || err === "Test defects") {
    return "No error details available";
  }
  return err;
}

function collectFailedFromTree(node, errorContext, failures, seen) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectFailedFromTree(item, errorContext, failures, seen);
    return;
  }
  if (typeof node !== "object") return;
  const status = node.status?.toString();
  const name = node.name?.toString();
  if ((status === "failed" || status === "broken") && name) {
    const base = normalizeScenarioName(name) || name;
    const params = node.parameters ?? [];
    const key = failureDedupeKey(base, params);
    if (!seen.has(key)) {
      seen.add(key);
      failures.push({
        test_name: base,
        test_name_full: name,
        status,
        error_message: sanitizeErrorMessage(errorContext),
        duration_ms: node.time?.duration ?? 0,
        module: null,
        tags: JSON.stringify(node.tags ?? []),
        parameters: JSON.stringify(
          Array.isArray(params)
            ? params.map((p) =>
                typeof p === "string" ? { name: "param", value: p } : p,
              )
            : params,
        ),
      });
    }
    const hasChildCases =
      Array.isArray(node.children) && node.children.some((c) => c?.status);
    if (!hasChildCases) return;
  }
  let nextError = errorContext;
  if (name && !status && Array.isArray(node.children)) {
    const childHasStatus = node.children.some((c) => c?.status);
    nextError = childHasStatus ? name : errorContext || name;
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectFailedFromTree(c, nextError, failures, seen);
  }
  if (Array.isArray(node.items)) {
    for (const c of node.items) collectFailedFromTree(c, nextError, failures, seen);
  }
}

function parseFailuresFromTxt(text) {
  const failures = [];
  const seen = new Set();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    const name = colon > 0 ? trimmed.slice(0, colon).trim() : trimmed;
    const detail = colon > 0 ? trimmed.slice(colon + 1).trim() : "FAILED";
    const base = normalizeScenarioName(name) || trimmed;
    if (seen.has(base)) continue;
    seen.add(base);
    failures.push({
      test_name: base,
      test_name_full: trimmed,
      status: "failed",
      error_message: detail,
      duration_ms: 0,
      module: null,
      tags: "[]",
      parameters: "[]",
    });
  }
  return failures;
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
  const failures = [];
  const seen = new Set();
  collectFailedFromTree(categories, null, failures, seen);
  for (const f of parseFailuresFromTxt(failedTxt)) {
    const key = failureDedupeKey(f.test_name, []);
    if (!seen.has(key)) {
      seen.add(key);
      failures.push(f);
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
      const { stat, scenarioStats, failures, passRate } = await loadArtifacts(
        run.gcs_report_path,
      );
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
          `OK ${run.id}: total=${stat.total ?? 0} failures=${failures.length}`,
        );
      } catch (e) {
        await conn.rollback();
        console.error(`FAIL ${run.id}:`, e.message || e);
      }
    }

    await conn.query(`DELETE FROM pr_e2e_test_stability WHERE window_days = 30`);
    await conn.query(`
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
      ) agg
    `);
    console.log("Refreshed pr_e2e_test_stability (30d).");
  } finally {
    await conn.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
