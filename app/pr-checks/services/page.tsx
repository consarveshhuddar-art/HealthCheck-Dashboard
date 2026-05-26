import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import { PrE2eServiceCards } from "@/components/prE2e/PrE2eServiceCards";
import { PrE2eServiceHealthTable, PrE2ePanel } from "@/components/prE2e/PrE2eDataTables";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadServicePassRateTrend } from "@/lib/prE2e/analytics";
import { fillPassRateTrend } from "@/lib/prE2e/trendFill";
import { loadPrE2eFullDashboard } from "@/lib/prE2e/data";
import type { PrE2ePassRatePoint } from "@/lib/prE2e/types";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export default async function PrChecksServicesPage() {
  const dbReady = isHealthCheckMysqlConfigured();
  const credTableReady = dbReady
    ? await isCredentialExpiryTableAvailable()
    : false;
  const alerts =
    dbReady && credTableReady ? await getCredentialAlertCounts() : null;

  const data = dbReady
    ? await getOrSetDashboardMysqlCache("pr-e2e:services:v2", () =>
        loadPrE2eFullDashboard(PR_E2E_PIPELINE_FILTER, 10),
      )
    : null;

  const services = data?.serviceHealth ?? [];
  const sparklines: Record<string, PrE2ePassRatePoint[]> = {};
  if (dbReady && services.length) {
    const trends = await Promise.all(
      services.map(async (s) => {
        const raw = await loadServicePassRateTrend(s.service, 7);
        return [s.service, fillPassRateTrend(raw, 7)] as const;
      }),
    );
    for (const [svc, pts] of trends) sparklines[svc] = pts;
  }

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E"
          title="Service health"
          description="All services at a glance — click a card for run history and stability. Sparkline = 7-day pass rate."
          alerts={alerts}
          showCredentialsNav={false}
        />

        {data?.dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        <PrE2ePanel title="Service cards" className="mb-4">
          <PrE2eServiceCards services={services} sparklines={sparklines} />
        </PrE2ePanel>

        <PrE2ePanel title="Comparison table (30d)">
          <PrE2eServiceHealthTable rows={services} />
        </PrE2ePanel>
      </div>
    </main>
  );
}
