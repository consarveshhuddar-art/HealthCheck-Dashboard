import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import Link from "next/link";
import { PrE2eDataBanners } from "@/components/prE2e/PrE2eDataBanners";
import { PrE2eTrendChartsSection } from "@/components/prE2e/PrE2eDashboardCharts";
import { PrE2eIngestNotice } from "@/components/prE2e/PrE2eIngestNotice";
import { PrE2eRunsTable } from "@/components/prE2e/PrE2eRunsTable";
import { PrE2eStabilityTable } from "@/components/prE2e/PrE2eStabilityTable";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatCard } from "@/components/StatCard";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { formatPassRateDelta } from "@/lib/prE2e/format";
import { loadPrE2eFullDashboard } from "@/lib/prE2e/data";
import { parseTrendDays } from "@/lib/prE2e/trendFill";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

const healthAccent = {
  green: "emerald" as const,
  amber: "amber" as const,
  red: "rose" as const,
};

export default async function PrChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = parseTrendDays(sp.days);
  const pipeline = PR_E2E_PIPELINE_FILTER;
  const dbReady = isHealthCheckMysqlConfigured();
  const credTableReady = dbReady
    ? await isCredentialExpiryTableAvailable()
    : false;
  const alerts =
    dbReady && credTableReady ? await getCredentialAlertCounts() : null;

  const snapshot = dbReady
    ? await getOrSetDashboardMysqlCache(`pr-e2e:full:v2:${pipeline}:${days}`, () =>
        loadPrE2eFullDashboard(pipeline, 80, days),
      )
    : null;

  const data = snapshot ?? {
    runs: [],
    stats: {
      runsToday: 0,
      runs7d: 0,
      runs30d: 0,
      passRateToday: null,
      passRate7d: null,
      passRate30d: null,
      totalFailures30d: 0,
      totalBroken30d: 0,
      activeServices: 0,
      runs24h: 0,
      pass24h: 0,
      fail24h: 0,
      health24h: "amber" as const,
      recentRuns: 0,
      passRuns: 0,
      failRuns: 0,
      avgPassRate: null,
      flakyCount: 0,
      failingCount: 0,
      stableCount: 0,
      stabilityTrackedTotal: 0,
    },
    daily: [],
    byService: [],
    passRateTrend: [],
    volumeTrend: [],
    testCountTrend: [],
    durationTrend: [],
    stability: [],
    runsByTrigger: [],
    failuresByStatus: [],
    stabilityDist: [],
    passRateWeekDelta: { current: null, previous: null },
    triggerUnknownPct: null,
    moduleUnknownPct: null,
    fingerprints: [],
    dbConnectionError: false,
  };

  const {
    runs,
    stats,
    daily,
    byService,
    passRateTrend,
    volumeTrend,
    testCountTrend,
    durationTrend,
    stability,
    runsByTrigger,
    failuresByStatus,
    stabilityDist,
    passRateWeekDelta,
    triggerUnknownPct,
    moduleUnknownPct,
    fingerprints,
    dbConnectionError,
  } = data;

  const passDelta = formatPassRateDelta(
    passRateWeekDelta.current,
    passRateWeekDelta.previous,
  );
  const flakyPreview = stability.filter((s) => s.stability_label === "flaky").slice(0, 5);
  const hasPerTestFailures = runs.some((r) => r.failures.length > 0);
  const daysQ = days !== 30 ? `days=${days}` : "";
  const failRunsHref = `/pr-checks/runs?result=fail${daysQ ? `&${daysQ}` : ""}`;

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="Automation"
          title="PR E2E checks"
          description="PR pipeline only (release runs excluded). Use the range picker above for 7d / 30d / 90d trends."
          alerts={alerts}
          showCredentialsNav={false}
        />

        {!dbReady ? (
          <p className="rounded-[10px] border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            MySQL not configured. Set HEALTH_CHECK_MYSQL_* in .env.local.
          </p>
        ) : null}

        {dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        {dbReady && !dbConnectionError ? (
          <>
            <PrE2eDataBanners
              triggerUnknownPct={triggerUnknownPct}
              moduleUnknownPct={moduleUnknownPct}
              fingerprintCount={fingerprints.length}
            />
            <PrE2eIngestNotice
              className="mb-4"
              hasRuns={runs.length > 0}
              hasPerTestFailures={hasPerTestFailures}
              hasStability={stability.length > 0}
            />
          </>
        ) : null}

        <div className={`${dashboardUi.statGrid} lg:grid-cols-6`}>
          <StatCard
            title="Runs today"
            value={stats.runsToday}
            hint="E2E builds ingested today (IST)"
            accent="slate"
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
          <StatCard
            title={`Avg pass rate (${days}d)`}
            value={
              stats.passRate30d != null ? `${stats.passRate30d}%` : "—"
            }
            delta={
              passDelta
                ? {
                    text: passDelta.text,
                    direction:
                      passDelta.direction === "up"
                        ? "up"
                        : passDelta.direction === "down"
                          ? "down"
                          : "flat",
                  }
                : undefined
            }
            hint="Allure pass % averaged over selected range"
            accent="emerald"
          />
          <StatCard
            title="Failures + broken"
            value={stats.totalFailures30d + stats.totalBroken30d}
            hint={`${stats.totalFailures30d} failed · ${stats.totalBroken30d} broken`}
            accent="rose"
          />
          <StatCard
            title="Active services"
            value={stats.activeServices}
            hint="Distinct service_repo in range"
            accent="slate"
          />
          <StatCard
            title="Last 24h"
            value={stats.runs24h}
            hint={
              <>
                {stats.pass24h} pass ·{" "}
                <Link href={failRunsHref} className="font-medium text-rose-700 underline">
                  {stats.fail24h} fail
                </Link>
              </>
            }
            accent={healthAccent[stats.health24h]}
          />
        </div>

        <div className={`mt-3 ${dashboardUi.statGrid} lg:grid-cols-4`}>
          <StatCard
            title="Runs passing"
            value={`${stats.passRuns} / ${stats.recentRuns}`}
            hint="Loaded runs with SUCCESS and no test failures"
            accent="emerald"
          />
          <StatCard
            title="Runs failing"
            value={stats.failRuns}
            hint={
              <Link href={failRunsHref} className="underline">
                View failed runs →
              </Link>
            }
            accent="rose"
          />
          <StatCard
            title="Flaky / failing"
            value={`${stats.flakyCount} / ${stats.failingCount}`}
            hint={`${stats.stableCount} stable of ${stats.stabilityTrackedTotal || stats.flakyCount + stats.failingCount + stats.stableCount} tracked tests (30d batch)`}
            accent="amber"
          />
        </div>

        <PrE2eTrendChartsSection
          daily={daily}
          passRateTrend={passRateTrend}
          volumeTrend={volumeTrend}
          testCountTrend={testCountTrend}
          durationTrend={durationTrend}
          byService={byService}
          runsByTrigger={runsByTrigger}
          failuresByStatus={failuresByStatus}
          stabilityDist={stabilityDist}
        />

        <section className={`mt-4 ${dashboardUi.panel}`}>
          <div className={dashboardUi.panelHeaderDivider}>
            <h2 className={dashboardUi.panelTitle}>Recent E2E runs</h2>
            <p className={dashboardUi.panelDesc}>
              <Link href="/pr-checks/runs" className="text-violet-800 underline">
                All runs →
              </Link>
            </p>
          </div>
          <div className="mt-3">
            <PrE2eRunsTable runs={runs.slice(0, 15)} />
          </div>
        </section>

        {flakyPreview.length ? (
          <section className={`mt-4 ${dashboardUi.panel}`}>
            <div className={dashboardUi.panelHeaderDivider}>
              <h2 className={dashboardUi.panelTitle}>Flaky tests (preview)</h2>
              <p className={dashboardUi.panelDesc}>
                <Link href="/pr-checks/flaky?label=flaky" className="text-violet-800 underline">
                  Full flakiness tab →
                </Link>
              </p>
            </div>
            <div className="mt-3">
              <PrE2eStabilityTable rows={flakyPreview} />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
