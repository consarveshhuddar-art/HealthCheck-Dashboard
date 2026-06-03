import { NextResponse } from "next/server";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import {
  executePrE2eRangeQuery,
  isPrE2eRangeMetric,
} from "@/lib/prE2e/rangeQuery";
import { parseTrendDays } from "@/lib/prE2e/trendFill";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import {
  invalidateHealthCheckMysqlPool,
  isHealthCheckMysqlConfigured,
  isHealthCheckMysqlReachable,
  isRecoverableMysqlPoolError,
} from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isHealthCheckMysqlConfigured()) {
    return NextResponse.json(
      { ok: false, error: "MySQL not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") ?? "";
  const days = parseTrendDays(searchParams.get("days") ?? undefined);

  if (!isPrE2eRangeMetric(metric)) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing metric" },
      { status: 400 },
    );
  }

  if (!(await isHealthCheckMysqlReachable())) {
    return NextResponse.json(
      { ok: false, error: "Database unreachable" },
      { status: 502 },
    );
  }

  try {
    const data = await getOrSetDashboardMysqlCache(
      `pr-e2e:query:v1:${PR_E2E_PIPELINE_FILTER}:${metric}:${days}`,
      () => executePrE2eRangeQuery(metric, days, PR_E2E_PIPELINE_FILTER),
    );
    return NextResponse.json({ ok: true, metric, days, data });
  } catch (e) {
    if (isRecoverableMysqlPoolError(e)) {
      invalidateHealthCheckMysqlPool();
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
