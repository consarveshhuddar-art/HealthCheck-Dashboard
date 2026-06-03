import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import { PrE2eRunsExplorer } from "@/components/prE2e/PrE2eRunsExplorer";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetPrE2eMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadPrE2eRunsPage } from "@/lib/prE2e/data";
import { PR_E2E_RUNS_PAGE_SIZE } from "@/lib/prE2e/limits";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured, isHealthCheckMysqlReachable } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export default async function PrChecksRunsPage({
  searchParams,
}: {
  searchParams: Promise<{
    result?: string;
    service?: string;
    pr?: string;
    env?: string;
  }>;
}) {
  const sp = await searchParams;
  const initialResult =
    sp.result === "pass" || sp.result === "fail" ? sp.result : "";
  const dbReady = isHealthCheckMysqlConfigured();
  const credTableReady = dbReady
    ? await isCredentialExpiryTableAvailable()
    : false;
  const alerts =
    dbReady && credTableReady ? await getCredentialAlertCounts() : null;

  const snapshot = dbReady
    ? await getOrSetPrE2eMysqlCache(
        `pr-e2e:runs-page:v1:${PR_E2E_RUNS_PAGE_SIZE}:0`,
        async () => {
          if (!(await isHealthCheckMysqlReachable())) {
            return { runs: [], total: 0, dbConnectionError: true };
          }
          const page = await loadPrE2eRunsPage(
            PR_E2E_RUNS_PAGE_SIZE,
            0,
            PR_E2E_PIPELINE_FILTER,
          );
          return { ...page, dbConnectionError: false };
        },
      )
    : { runs: [], total: 0, dbConnectionError: false };

  const { runs, total, dbConnectionError } = snapshot;

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E"
          title="All runs"
          description="Filter by service, environment, result, or PR. Expand a row to see failed tests inline."
          alerts={alerts}
          showCredentialsNav={false}
        />

        {dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        <section className={dashboardUi.panel}>
          <PrE2eRunsExplorer
            runs={runs}
            totalRuns={total}
            pageSize={PR_E2E_RUNS_PAGE_SIZE}
            initialResult={initialResult}
            initialService={sp.service ?? ""}
            initialPr={sp.pr ?? ""}
            initialEnv={sp.env ?? ""}
          />
        </section>
      </div>
    </main>
  );
}
