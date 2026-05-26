import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import { PrE2eBarChartSimple } from "@/components/prE2e/PrE2eDashboardCharts";
import { PrE2eDataBanners } from "@/components/prE2e/PrE2eDataBanners";
import {
  PrE2eFingerprintTable,
  PrE2eHeatmapGrid,
  PrE2eNamedCountTable,
  PrE2ePanel,
} from "@/components/prE2e/PrE2eDataTables";
import { PrE2eTopFailingCompare } from "@/components/prE2e/PrE2eTopFailingCompare";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { mergeTopFailingCompare } from "@/lib/prE2e/format";
import { loadPrE2eFullDashboard } from "@/lib/prE2e/data";
import { PR_E2E_ANALYTICS_MAX_ROWS } from "@/lib/prE2e/limits";
import { parseTrendDays } from "@/lib/prE2e/trendFill";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export default async function PrChecksAnalyticsPage({
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

  const data = dbReady
    ? await getOrSetDashboardMysqlCache(`pr-e2e:analytics:v2:${pipeline}:${days}`, () =>
        loadPrE2eFullDashboard(pipeline, 20, days),
      )
    : null;

  const compare = mergeTopFailingCompare(
    data?.topFailing7d ?? [],
    data?.topFailing30d ?? [],
    PR_E2E_ANALYTICS_MAX_ROWS,
  );

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E"
          title="Failure analytics"
          description="Top failing tests with 7d vs 30d trend, heatmap, fingerprints, and breakdowns."
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

        <PrE2ePanel
          title="Top failing tests (7d vs 30d)"
          description={`▲ = worsening vs expected weekly rate from 30d baseline. Up to ${PR_E2E_ANALYTICS_MAX_ROWS} rows — scroll within each panel.`}
        >
          <PrE2eTopFailingCompare rows={compare} />
        </PrE2ePanel>

        <div className="mt-4">
          <PrE2ePanel
            title="Failure heatmap"
            description="Top tests × date — hover cells for full test name and count."
          >
            <PrE2eHeatmapGrid cells={data?.heatmap ?? []} />
          </PrE2ePanel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PrE2ePanel title="Error fingerprints">
            <PrE2eFingerprintTable rows={data?.fingerprints ?? []} />
          </PrE2ePanel>
          <PrE2ePanel title="Failures by module">
            <PrE2eBarChartSimple data={data?.failuresByModule ?? []} />
          </PrE2ePanel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PrE2ePanel title="Pass rate by env">
            <PrE2eNamedCountTable
              rows={data?.passRateByEnv ?? []}
              nameHeader="Env"
              countHeader="Runs"
              showExtra
              extraHeader="Avg pass %"
            />
          </PrE2ePanel>
          <PrE2ePanel title="Failures by git author">
            <PrE2eBarChartSimple data={data?.failuresByAuthor ?? []} layout="horizontal" />
          </PrE2ePanel>
        </div>

      </div>
    </main>
  );
}
