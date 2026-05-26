import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import { PrE2eRunsExplorer } from "@/components/prE2e/PrE2eRunsExplorer";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadPrE2eRuns } from "@/lib/prE2e/data";
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
    author?: string;
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

  const { runs, dbConnectionError } = dbReady
    ? await getOrSetDashboardMysqlCache("pr-e2e:runs:v3:120", async () => {
        if (!(await isHealthCheckMysqlReachable())) {
          return { runs: [], dbConnectionError: true };
        }
        return {
          runs: await loadPrE2eRuns(120, PR_E2E_PIPELINE_FILTER),
          dbConnectionError: false,
        };
      })
    : { runs: [], dbConnectionError: false };

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E"
          title="All runs"
          description="Filter by service, git author, result, or PR. Expand a row to see failed tests inline."
          alerts={alerts}
          showCredentialsNav={false}
        />

        {dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        <section className={dashboardUi.panel}>
          <PrE2eRunsExplorer
            runs={runs}
            initialResult={initialResult}
            initialService={sp.service ?? ""}
            initialPr={sp.pr ?? ""}
            initialAuthor={sp.author ?? ""}
          />
        </section>
      </div>
    </main>
  );
}
