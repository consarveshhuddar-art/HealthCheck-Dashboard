import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import { PrE2eDataBanners } from "@/components/prE2e/PrE2eDataBanners";
import { PrE2eOverviewContent } from "@/components/prE2e/PrE2eOverviewContent";
import { PrE2eIngestNotice } from "@/components/prE2e/PrE2eIngestNotice";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadPrE2eDashboardBase } from "@/lib/prE2e/data";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export default async function PrChecksPage() {
  const pipeline = PR_E2E_PIPELINE_FILTER;
  const dbReady = isHealthCheckMysqlConfigured();
  const credTableReady = dbReady
    ? await isCredentialExpiryTableAvailable()
    : false;
  const alerts =
    dbReady && credTableReady ? await getCredentialAlertCounts() : null;

  const snapshot = dbReady
    ? await getOrSetDashboardMysqlCache(`pr-e2e:base:v3:${pipeline}`, () =>
        loadPrE2eDashboardBase(pipeline, 80),
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
    stability: [],
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
    stability,
    stabilityDist,
    passRateWeekDelta,
    triggerUnknownPct,
    moduleUnknownPct,
    fingerprints,
    dbConnectionError,
  } = data;

  const flakyPreview = stability.filter((s) => s.stability_label === "flaky").slice(0, 5);
  const hasPerTestFailures = runs.some((r) => r.failures.length > 0);

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="Automation"
          title="PR E2E checks"
          description="PR pipeline only (release runs excluded). Sections flow from latest activity → health → trends → breakdowns → flaky tests."
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

        <PrE2eOverviewContent
          stats={stats}
          passRateWeekDelta={passRateWeekDelta}
          stabilityDist={stabilityDist}
          flakyPreview={flakyPreview}
        />
      </div>
    </main>
  );
}
