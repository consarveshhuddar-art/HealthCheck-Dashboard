import { NextResponse } from "next/server";
import {
  loadServiceFailuresInRange,
  loadServiceFailuresOnIstDay,
} from "@/lib/prE2e/analytics";
import { getOrSetPrE2eMysqlCache } from "@/lib/dashboard-cache";
import { todayIstDateString, parseIstDateParam } from "@/lib/prE2e/istDate";
import { parseTrendDays, type PrE2eTrendDays } from "@/lib/prE2e/trendFill";
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
  const days: PrE2eTrendDays = parseTrendDays(searchParams.get("days") ?? "1");

  if (!(await isHealthCheckMysqlReachable())) {
    return NextResponse.json(
      { ok: false, error: "Database unreachable" },
      { status: 502 },
    );
  }

  try {
    if (days === 1) {
      const istDate =
        parseIstDateParam(searchParams.get("date")) ?? todayIstDateString();
      const data = await getOrSetPrE2eMysqlCache(
        `pr-e2e:svc-fail-day:v1:${PR_E2E_PIPELINE_FILTER}:${istDate}`,
        () => loadServiceFailuresOnIstDay(istDate, PR_E2E_PIPELINE_FILTER),
      );
      return NextResponse.json({ ok: true, days: 1, date: istDate, data });
    }

    const data = await getOrSetPrE2eMysqlCache(
      `pr-e2e:svc-fail-range:v1:${PR_E2E_PIPELINE_FILTER}:${days}`,
      () => loadServiceFailuresInRange(days, PR_E2E_PIPELINE_FILTER),
    );
    return NextResponse.json({ ok: true, days, data });
  } catch (e) {
    if (isRecoverableMysqlPoolError(e)) {
      invalidateHealthCheckMysqlPool();
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
