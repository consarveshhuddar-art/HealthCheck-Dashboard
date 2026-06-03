"use client";

import { LoaderSpinner } from "@/components/LoaderSpinner";
import { PrE2ePageLink } from "@/components/prE2e/PrE2ePageLink";
import { PrE2eRangePicker } from "@/components/prE2e/PrE2eRangePicker";
import { PrE2eRunsTable } from "@/components/prE2e/PrE2eRunsTable";
import { usePrE2eRangeQuery } from "@/components/prE2e/usePrE2eRangeQuery";
import { StatCard } from "@/components/StatCard";
import { dashboardUi } from "@/lib/dashboardUi";
import { formatPassRateDelta } from "@/lib/prE2e/format";
import type { PrE2eRunWithFailures } from "@/lib/prE2e/types";
import { PR_E2E_RECENT_RUNS_MAX_ROWS } from "@/lib/prE2e/limits";
import { PR_E2E_TREND_DAYS_DEFAULT } from "@/lib/prE2e/trendFill";

type RangeSummary = {
  runs: number;
  passRuns: number;
  failRuns: number;
  passRateAvg: number | null;
  totalFailures: number;
  totalBroken: number;
  activeServices: number;
};

function ChartLoading() {
  return (
    <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#94A3B8]">
      <LoaderSpinner size="md" />
      Loading…
    </p>
  );
}

export function PrE2eOverviewHealthSummary({
  passRateWeekDelta,
}: {
  passRateWeekDelta: { current: number | null; previous: number | null };
}) {
  const { days, setDays, data: summary, loading } = usePrE2eRangeQuery<RangeSummary>(
    "rangeSummary",
    PR_E2E_TREND_DAYS_DEFAULT,
  );
  const passDelta = formatPassRateDelta(
    passRateWeekDelta.current,
    passRateWeekDelta.previous,
  );
  const passRateDelta =
    days === 7 && passDelta && !loading
      ? {
          text: passDelta.text,
          direction:
            passDelta.direction === "up"
              ? ("up" as const)
              : passDelta.direction === "down"
                ? ("down" as const)
                : ("flat" as const),
        }
      : undefined;

  return (
    <div className="space-y-3">
      <div className="flex justify-start">
        <PrE2eRangePicker value={days} onChange={setDays} loading={loading} />
      </div>
      <div className={`${dashboardUi.statGrid} lg:grid-cols-3`}>
        <StatCard
          title={`Avg pass rate (${days}d)`}
          value={
            loading
              ? "…"
              : summary?.passRateAvg != null
                ? `${summary.passRateAvg}%`
                : "—"
          }
          hint="Allure pass % averaged over selected range"
          delta={passRateDelta}
          accent="emerald"
        />
        <StatCard
          title={`Runs passing (${days}d)`}
          value={
            loading ? "…" : summary ? `${summary.passRuns} / ${summary.runs}` : "—"
          }
          hint="Runs with SUCCESS and no test failures in range"
          accent="emerald"
        />
        <StatCard
          title={`Runs failing (${days}d)`}
          value={loading ? "…" : (summary?.failRuns ?? "—")}
          hint={
            <PrE2ePageLink href="/pr-checks/runs?result=fail" className="underline">
              View failed runs →
            </PrE2ePageLink>
          }
          accent="rose"
        />
      </div>
      <div className={`${dashboardUi.statGrid} lg:grid-cols-2`}>
        <StatCard
          title={`Failures + broken (${days}d)`}
          value={
            loading
              ? "…"
              : summary
                ? summary.totalFailures + summary.totalBroken
                : "—"
          }
          hint={
            summary
              ? `${summary.totalFailures} failed · ${summary.totalBroken} broken`
              : "Failed + broken test counts in range"
          }
          accent="rose"
        />
        <StatCard
          title={`Active services (${days}d)`}
          value={loading ? "…" : (summary?.activeServices ?? "—")}
          hint="Distinct service_repo in range"
          accent="slate"
        />
      </div>
    </div>
  );
}

/** @deprecated Use PrE2eOverviewHealthSummary */
export function PrE2eOverviewRangeStatCards({
  passRateWeekDelta,
}: {
  passRateWeekDelta: { current: number | null; previous: number | null };
}) {
  return (
    <PrE2eOverviewHealthSummary passRateWeekDelta={passRateWeekDelta} />
  );
}

/** @deprecated Merged into PrE2eOverviewHealthSummary */
export function PrE2eOverviewRunOutcomeStats() {
  return null;
}

export function PrE2eOverviewRecentRunsPanel({ embedded = false }: { embedded?: boolean }) {
  const { days, setDays, data, loading, error } = usePrE2eRangeQuery<
    PrE2eRunWithFailures[]
  >("runs", PR_E2E_TREND_DAYS_DEFAULT);

  const runs = (data ?? []).slice(0, PR_E2E_RECENT_RUNS_MAX_ROWS);
  const table = loading ? (
    <ChartLoading />
  ) : error ? (
    <p className="py-8 text-center text-sm text-rose-700">{error}</p>
  ) : (
    <div className="overflow-hidden rounded-[8px] border border-[#EAEFF5]">
      <div className="max-h-[min(70vh,480px)] overflow-auto overscroll-contain">
        <PrE2eRunsTable runs={runs} embedScroll={false} />
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className={dashboardUi.panel}>
        <div className={dashboardUi.panelHeaderDivider}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className={dashboardUi.panelDesc}>
              <PrE2ePageLink href="/pr-checks/runs" className="text-violet-800 underline">
                All runs →
              </PrE2ePageLink>
            </p>
            <PrE2eRangePicker value={days} onChange={setDays} loading={loading} />
          </div>
        </div>
        <div className="mt-3">{table}</div>
      </div>
    );
  }

  return (
    <section className={`mt-4 ${dashboardUi.panel}`}>
      <div className={dashboardUi.panelHeaderDivider}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className={dashboardUi.panelTitle}>Recent E2E runs</h2>
            <p className={dashboardUi.panelDesc}>
              <PrE2ePageLink href="/pr-checks/runs" className="text-violet-800 underline">
                All runs →
              </PrE2ePageLink>
            </p>
          </div>
          <PrE2eRangePicker value={days} onChange={setDays} loading={loading} />
        </div>
      </div>
      <div className="mt-3">{table}</div>
    </section>
  );
}
