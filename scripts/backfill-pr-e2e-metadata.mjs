/**
 * Backfill trigger_type, failure module, and error_fingerprint on existing PR E2E rows.
 * Usage: npm run backfill-pr-e2e-metadata
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

function errorFingerprint(msg) {
  if (!msg) return null;
  const norm = String(msg).replace(/\d+/g, "#").slice(0, 500);
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 31 + norm.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash));
}

function inferTrigger(row) {
  const stored = (row.trigger_type || "").trim().toLowerCase();
  if (stored && stored !== "unknown") return stored;

  if (row.upstream_job_name?.trim()) return "upstream";
  if (row.trigger_user?.trim()) return "manual";

  const detail = (row.trigger_detail || "").toLowerCase();
  const summaryTrigger = (() => {
    try {
      const s =
        typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary;
      return (s?.build_trigger_by || "").toLowerCase();
    } catch {
      return "";
    }
  })();
  const text = `${detail} ${summaryTrigger}`;
  if (/timer|cron|scheduled/.test(text)) return "cron";
  if (/upstream|started by project/.test(text)) return "upstream";
  if (/started by user|user:/.test(text)) return "manual";
  if (/comment/.test(text)) return "comment_test";
  return "unknown";
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.local");
    process.exit(1);
  }
  const env = parseEnvLocal(fs.readFileSync(envPath, "utf8"));
  const conn = await mysql.createConnection({
    host: env.HEALTH_CHECK_MYSQL_HOST,
    port: Number(env.HEALTH_CHECK_MYSQL_PORT || 3306),
    user: env.HEALTH_CHECK_MYSQL_USER,
    password: env.HEALTH_CHECK_MYSQL_PASSWORD,
    database: env.HEALTH_CHECK_MYSQL_DATABASE || "automation_testdata",
  });

  const [runs] = await conn.query(
    `SELECT id, trigger_type, trigger_detail, trigger_user, upstream_job_name, summary
     FROM pr_e2e_runs
     WHERE is_release_pipeline = 0`,
  );

  let triggerUpdates = 0;
  for (const row of runs) {
    const inferred = inferTrigger(row);
    const current = (row.trigger_type || "").trim().toLowerCase();
    if (current === inferred) continue;
    if (current && current !== "unknown" && inferred === "unknown") continue;
    await conn.query(`UPDATE pr_e2e_runs SET trigger_type = ? WHERE id = ?`, [
      inferred,
      row.id,
    ]);
    triggerUpdates++;
  }

  const [failures] = await conn.query(
    `SELECT f.id, f.module, f.error_message, f.error_fingerprint,
            r.module_primary, r.service_repo, r.cucumber_tags
     FROM pr_e2e_failures f
     INNER JOIN pr_e2e_runs r ON r.id = f.run_id
     WHERE r.is_release_pipeline = 0`,
  );

  let moduleUpdates = 0;
  let fpUpdates = 0;
  for (const row of failures) {
    const mod = (row.module || "").trim().toLowerCase();
    const primary = (row.module_primary || "").trim().toLowerCase();
    const svc = (row.service_repo || "").trim();
    const tags = row.cucumber_tags || "";
    const tagMatch = tags.match(/@service_([a-zA-Z0-9_]+)/);
    const inferredModule =
      (mod && mod !== "unknown" ? mod : null) ||
      (primary && primary !== "unknown" ? primary : null) ||
      (tagMatch ? tagMatch[1] : null) ||
      svc ||
      "unknown";

    const fp = errorFingerprint(row.error_message);
    const needsModule = !mod || mod === "unknown";
    const needsFp = !row.error_fingerprint && fp;

    if (!needsModule && !needsFp) continue;
    await conn.query(
      `UPDATE pr_e2e_failures
       SET module = COALESCE(?, module),
           error_fingerprint = COALESCE(?, error_fingerprint)
       WHERE id = ?`,
      [
        needsModule ? inferredModule : null,
        needsFp ? fp : null,
        row.id,
      ],
    );
    if (needsModule) moduleUpdates++;
    if (needsFp) fpUpdates++;
  }

  console.log(
    `Backfill done: trigger_type=${triggerUpdates}, module=${moduleUpdates}, error_fingerprint=${fpUpdates}`,
  );
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
