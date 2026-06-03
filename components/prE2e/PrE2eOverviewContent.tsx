"use client";

import { PrE2ePageLink } from "@/components/prE2e/PrE2ePageLink";
import {
  PrE2eOverviewBreakdownCharts,
  PrE2eOverviewTrendCharts,
} from "@/components/prE2e/PrE2eDashboardCharts";
import { PrE2eOverviewChartsProvider } from "@/components/prE2e/PrE2eOverviewChartsContext";
import {
  PrE2eOverviewHealthSummary,
  PrE2eOverviewRecentRunsPanel,
} from "@/components/prE2e/PrE2eOverviewRangeWidgets";
import { PrE2eOverviewSection } from "@/components/prE2e/PrE2eOverviewSection";
import { PrE2eStabilityTable } from "@/components/prE2e/PrE2eStabilityTable";
import { StatCard } from "@/components/StatCard";
import { dashboardUi } from "@/lib/dashboardUi";
import type {
  PrE2eNamedCount,
  PrE2eOverviewStats,
  PrE2eStabilityRow,
} from "@/lib/prE2e/types";

export function PrE2eOverviewContent({
  stats,
  passRateWeekDelta,
  stabilityDist,
  flakyPreview,
}: {
  stats: PrE2eOverviewStats;
  passRateWeekDelta: { current: number | null; previous: number | null };
  stabilityDist: PrE2eNamedCount[];
  flakyPreview: PrE2eStabilityRow[];
}) {
  const healthAccent = {
    green: "emerald" as const,
    amber: "amber" as const,
    red: "rose" as const,
  };

  return (
    <>
      <PrE2eOverviewSection
        title="At a glance"
        description="Fixed windows — today, rolling 7 days, and last 24 hours."
        className="mt-4"
      >
        <div className={`${dashboardUi.statGrid} lg:grid-cols-3`}>
          <StatCard
            title="Runs today"
            value={stats.runsToday}
            hint="E2E builds ingested today (IST)"
            accent="slate"
          />
          <StatCard
            title="Last 24h"
            value={stats.runs24h}
            hint={
              <>
                {stats.pass24h} pass ·{" "}
                <PrE2ePageLink
                  href="/pr-checks/runs?result=fail"
                  className="font-medium text-rose-700 underline"
                >
                  {stats.fail24h} fail
                </PrE2ePageLink>
              </>
            }
            accent={healthAccent[stats.health24h]}
          />
          <StatCard
            title="Runs (7d)"
            value={stats.runs7d}
            hint={
              stats.passRate7d != null
                ? `${stats.passRate7d}% avg pass rate`
                : "Last 7 days"
            }
            accent="sky"
          />
        </div>
      </PrE2eOverviewSection>

      <PrE2eOverviewSection
        title="Recent runs"
        description="Latest PR E2E builds — use the range control to narrow the list."
      >
        <PrE2eOverviewRecentRunsPanel embedded />
      </PrE2eOverviewSection>

      <PrE2eOverviewSection
        title="Health summary"
        description="Compare pass rate, outcomes, and failure volume for the same window using the range control."
      >
        <PrE2eOverviewHealthSummary passRateWeekDelta={passRateWeekDelta} />
      </PrE2eOverviewSection>

      <PrE2eOverviewChartsProvider>
        <PrE2eOverviewSection
          title="Trends"
          description="How pass rate, volume, and suite health change day over day — use the range control for all charts below."
        >
          <PrE2eOverviewTrendCharts />
        </PrE2eOverviewSection>

        <PrE2eOverviewSection
          title="Breakdowns"
          description="Where failures concentrate — by service, trigger, and stability label."
        >
          <PrE2eOverviewBreakdownCharts stabilityDist={stabilityDist} />
        </PrE2eOverviewSection>
      </PrE2eOverviewChartsProvider>

      {flakyPreview.length ? (
        <PrE2eOverviewSection
          title="Flaky tests"
          description="30-day stability batch — open Flakiness for the full list."
        >
          <div className={dashboardUi.panel}>
            <div className={dashboardUi.panelHeaderDivider}>
              <p className={dashboardUi.panelDesc}>
                <PrE2ePageLink
                  href="/pr-checks/flaky?label=flaky"
                  className="text-violet-800 underline"
                >
                  Full flakiness tab →
                </PrE2ePageLink>
              </p>
            </div>
            <div className="mt-3">
              <PrE2eStabilityTable rows={flakyPreview} />
            </div>
          </div>
        </PrE2eOverviewSection>
      ) : null}
    </>
  );
}
