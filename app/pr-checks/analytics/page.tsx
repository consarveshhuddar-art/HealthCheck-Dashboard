import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import {
  PrE2eAnalyticsFailuresByAuthorPanel,
  PrE2eAnalyticsFailuresByModulePanel,
  PrE2eAnalyticsHeatmapPanel,
  PrE2eAnalyticsPassRateByEnvPanel,
  PrE2eAnalyticsTopFailingPanel,
} from "@/components/prE2e/PrE2eAnalyticsRangeSections";
import { PrE2eDataBanners } from "@/components/prE2e/PrE2eDataBanners";
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

export default async function PrChecksAnalyticsPage() {
  const pipeline = PR_E2E_PIPELINE_FILTER;
  const dbReady = isHealthCheckMysqlConfigured();
  const credTableReady = dbReady
    ? await isCredentialExpiryTableAvailable()
    : false;
  const alerts =
    dbReady && credTableReady ? await getCredentialAlertCounts() : null;

  const data = dbReady
    ? await getOrSetDashboardMysqlCache(`pr-e2e:base:v1:${pipeline}`, () =>
        loadPrE2eDashboardBase(pipeline, 20),
      )
    : null;

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E"
          title="Failure analytics"
          description="Top failing tests use a fixed 7d vs 30d comparison. Other panels have their own range control."
          alerts={alerts}
          showCredentialsNav={false}
        />

        {data?.dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        <PrE2eDataBanners
          triggerUnknownPct={data?.triggerUnknownPct ?? null}
          moduleUnknownPct={data?.moduleUnknownPct ?? null}
          fingerprintCount={data?.fingerprints.length ?? 0}
        />

        <PrE2eAnalyticsTopFailingPanel />

        <div className="mt-4">
          <PrE2eAnalyticsHeatmapPanel />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PrE2eAnalyticsFailuresByModulePanel />
          <PrE2eAnalyticsPassRateByEnvPanel />
        </div>

        <div className="mt-4">
          <PrE2eAnalyticsFailuresByAuthorPanel />
        </div>
      </div>
    </main>
  );
}
