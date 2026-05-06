/**
 * Loads Dashboard/.env.local and runs read-only queries against health_check_* tables.
 * Usage (from repo Dashboard/): npm run verify-db
 *
 * Note: MySQL speaks a binary protocol on TCP — `curl` cannot query it. Use this script
 * or the `mysql` CLI: mysql -h HOST -P PORT -u USER -p -D DB -e "SELECT ..."
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
    console.error("Missing .env.local — copy .env.example and fill HEALTH_CHECK_MYSQL_*.");
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

  const missing = [];
  if (!host) missing.push("HEALTH_CHECK_MYSQL_HOST");
  if (!user) missing.push("HEALTH_CHECK_MYSQL_USER");
  if (!database) missing.push("HEALTH_CHECK_MYSQL_DATABASE");
  if (password === undefined) missing.push("HEALTH_CHECK_MYSQL_PASSWORD");
  if (missing.length) {
    console.error(
      "Incomplete .env.local — add:\n  " +
        missing.join("\n  ") +
        "\n(Copy from .env.example; PASSWORD key must exist, value may be empty.)",
    );
    process.exit(1);
  }

  console.log(`Connecting to ${host}:${port} database=${database} user=${user} …`);

  let conn;
  try {
    conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    const [[runsRow]] = await conn.query(
      "SELECT COUNT(*) AS n FROM health_check_runs",
    );
    const [[failRow]] = await conn.query(
      "SELECT COUNT(*) AS n FROM health_check_failures",
    );
    const [latest] = await conn.query(
      `SELECT id, created_at, checked_at_ist, build_number, jenkins_result
       FROM health_check_runs
       ORDER BY created_at DESC
       LIMIT 3`,
    );

    console.log("health_check_runs count:", runsRow.n);
    console.log("health_check_failures count:", failRow.n);
    console.log("Latest runs (up to 3):");
    console.table(latest);

    console.log("\nOK — read-only queries succeeded.");
  } catch (e) {
    console.error("DB error:", e.message || e);
    process.exit(1);
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

main();
