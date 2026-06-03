import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import { PrE2eServicesHealthPanel } from "@/components/prE2e/PrE2eServicesRangeSections";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetPrE2eMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadServicePassRateTrend } from "@/lib/prE2e/analytics";
import { fillPassRateTrend } from "@/lib/prE2e/trendFill";
import { loadPrE2eDashboardBase } from "@/lib/prE2e/data";
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

  const cached = dbReady
    ? await getOrSetPrE2eMysqlCache("pr-e2e:services:v1", async () => {
        const data = await loadPrE2eDashboardBase(PR_E2E_PIPELINE_FILTER, 10);
        const services = data.serviceHealth ?? [];
        const sparklines: Record<string, PrE2ePassRatePoint[]> = {};
        if (services.length) {
          const trends = await Promise.all(
            services.map(async (s) => {
              const raw = await loadServicePassRateTrend(s.service, 7);
              return [s.service, fillPassRateTrend(raw, 7)] as const;
            }),
          );
          for (const [svc, pts] of trends) sparklines[svc] = pts;
        }
        return { data, sparklines };
      })
    : null;

  const data = cached?.data ?? null;
  const sparklines = cached?.sparklines ?? {};

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E"
          title="Service health"
          description="All services at a glance — click a card for run history. Table range is per-panel; sparklines stay 7-day."
          alerts={alerts}
          showCredentialsNav={false}
        />

        {data?.dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        <PrE2eServicesHealthPanel
          initialServices={data?.serviceHealth ?? []}
          sparklines={sparklines}
        />
      </div>
    </main>
  );
}
