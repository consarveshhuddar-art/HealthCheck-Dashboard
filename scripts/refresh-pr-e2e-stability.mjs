/**
 * Recompute pr_e2e_test_stability (30d) from pr_e2e_test_executions failure rates.
 * Usage: npm run refresh-pr-e2e-stability
 *
 * Requires: scripts/create-pr-e2e-test-executions.sql applied and executions populated
 * (ingest or npm run backfill-pr-e2e-executions).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import {
  STABILITY_REFRESH_SQL,
  STABILITY_MIN_EXECUTIONS,
  splitStabilityStatements,
} from "./pr-e2e-stability-sql.mjs";

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
    const [[execCount]] = await conn.query(
      `SELECT COUNT(*) AS n FROM pr_e2e_test_executions e
       INNER JOIN pr_e2e_runs r ON r.id = e.run_id
       WHERE r.created_at >= NOW() - INTERVAL 30 DAY`,
    );
    if (Number(execCount?.n ?? 0) === 0) {
      console.warn(
        "WARN: pr_e2e_test_executions is empty for the last 30 days.",
      );
      console.warn(
        "Run: npm run backfill-pr-e2e-executions (or extend ingest to insert executions).",
      );
    }

    for (const stmt of splitStabilityStatements(STABILITY_REFRESH_SQL)) {
      await conn.query(stmt);
    }
    const [counts] = await conn.query(
      `SELECT stability_label, COUNT(*) AS n FROM pr_e2e_test_stability
       WHERE window_days = 30 GROUP BY stability_label`,
    );
    console.log(
      `pr_e2e_test_stability refreshed (execution-based, min ${STABILITY_MIN_EXECUTIONS} samples for flaky/failing):`,
    );
    console.table(counts);
  } finally {
    await conn.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
