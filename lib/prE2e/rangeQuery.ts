import "server-only";
import {
  loadErrorFingerprints,
  loadFailureHeatmap,
  loadFailuresByService,
  loadIngestTrend,
  loadPassRateByEnv,
  loadPrE2eDurationTrend,
  loadPrE2ePassRateTrend,
  loadPrE2eRangeSummary,
  loadPrE2eTestCountTrend,
  loadPrE2eVolumeTrend,
  loadRunsByTrigger,
  loadServiceFailurePctByEnv,
  loadServiceHealth,
  loadTopFailingTests,
} from "@/lib/prE2e/analytics";
import { loadPrE2eRunsInRange } from "@/lib/prE2e/data";
import { fillDailyTrend, fillPassRateTrend } from "@/lib/prE2e/trendFill";
import type { PrE2eTrendDays } from "@/lib/prE2e/trendFill";
import { groupPassRateByEnvRows } from "@/lib/prE2e/envGroups";
import { mergeTopFailingCompare } from "@/lib/prE2e/format";
import {
  PR_E2E_ANALYTICS_MAX_ROWS,
  PR_E2E_RECENT_RUNS_MAX_ROWS,
} from "@/lib/prE2e/limits";
import type { PrE2ePipelineFilter } from "@/lib/prE2e/types";
import { subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { RowDataPacket } from "mysql2";
import { withHealthCheckMysqlRetry } from "@/lib/mysql/server";

const IST = "Asia/Kolkata";

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pipelineWhere(
  filter: PrE2ePipelineFilter,
): { sql: string; params: number[] } {
  if (filter === "pr") return { sql: " AND is_release_pipeline = 0", params: [] };
  if (filter === "release")
    return { sql: " AND is_release_pipeline = 1", params: [] };
  return { sql: "", params: [] };
}

async function loadDailyTrend(
  filter: PrE2ePipelineFilter,
  days: number,
) {
  return withHealthCheckMysqlRetry(async (pool) => {
    const since = subDays(new Date(), days);
    const pw = pipelineWhere(filter);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(created_at) AS d,
        SUM(CASE WHEN
          GREATEST(
            COALESCE(failed_count, 0) + COALESCE(broken_count, 0),
            COALESCE(scenarios_failed, 0)
          ) = 0
          AND UPPER(e2e_jenkins_result) = 'SUCCESS'
        THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN NOT (
          GREATEST(
            COALESCE(failed_count, 0) + COALESCE(broken_count, 0),
            COALESCE(scenarios_failed, 0)
          ) = 0
          AND UPPER(e2e_jenkins_result) = 'SUCCESS'
        ) THEN 1 ELSE 0 END) AS failed
       FROM pr_e2e_runs r
       WHERE created_at >= ?${pw.sql}
       GROUP BY DATE(created_at)
       ORDER BY d ASC`,
      [since, ...pw.params],
    );
    return rows.map((row) => ({
      label: formatInTimeZone(
        row.d instanceof Date ? row.d : new Date(String(row.d)),
        IST,
        "MMM d",
      ),
      passed: num(row.passed),
      failed: num(row.failed),
    }));
  });
}

export const PR_E2E_RANGE_METRICS = [
  "rangeSummary",
  "passRateTrend",
  "volumeTrend",
  "testCountTrend",
  "durationTrend",
  "daily",
  "byService",
  "runsByTrigger",
  "fingerprints",
  "heatmap",
  "passRateByEnv",
  "ingestTrend",
  "serviceHealth",
  "serviceFailPctByEnv",
  "runs",
  "topFailingCompare",
] as const;

export type PrE2eRangeMetric = (typeof PR_E2E_RANGE_METRICS)[number];

export function isPrE2eRangeMetric(v: string): v is PrE2eRangeMetric {
  return (PR_E2E_RANGE_METRICS as readonly string[]).includes(v);
}

export async function executePrE2eRangeQuery(
  metric: PrE2eRangeMetric,
  days: PrE2eTrendDays,
  filter: PrE2ePipelineFilter = "pr",
): Promise<unknown> {
  switch (metric) {
    case "rangeSummary":
      return loadPrE2eRangeSummary(filter, days);
    case "passRateTrend":
      return fillPassRateTrend(
        await loadPrE2ePassRateTrend(filter, days),
        days,
      );
    case "volumeTrend":
      return loadPrE2eVolumeTrend(filter, days);
    case "testCountTrend":
      return loadPrE2eTestCountTrend(filter, days);
    case "durationTrend":
      return loadPrE2eDurationTrend(filter, days);
    case "daily":
      return fillDailyTrend(await loadDailyTrend(filter, days), days);
    case "byService":
      return loadFailuresByService(filter, days);
    case "runsByTrigger":
      return loadRunsByTrigger(filter, days);
    case "fingerprints":
      return loadErrorFingerprints(filter, days, PR_E2E_ANALYTICS_MAX_ROWS);
    case "heatmap":
      return loadFailureHeatmap(filter, 30, PR_E2E_ANALYTICS_MAX_ROWS);
    case "passRateByEnv":
      return groupPassRateByEnvRows(
        await loadPassRateByEnv(filter, days, 500),
      );
    case "ingestTrend":
      return loadIngestTrend(days);
    case "serviceHealth":
      return loadServiceHealth(filter, days);
    case "serviceFailPctByEnv":
      return loadServiceFailurePctByEnv(filter, days);
    case "runs":
      return loadPrE2eRunsInRange(days, PR_E2E_RECENT_RUNS_MAX_ROWS, filter);
    case "topFailingCompare":
      return mergeTopFailingCompare(
        await loadTopFailingTests(filter, 7, PR_E2E_ANALYTICS_MAX_ROWS),
        await loadTopFailingTests(filter, 30, PR_E2E_ANALYTICS_MAX_ROWS),
        PR_E2E_ANALYTICS_MAX_ROWS,
      );
    default:
      throw new Error(`Unknown metric: ${metric satisfies never}`);
  }
}
