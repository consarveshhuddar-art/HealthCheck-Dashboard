import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import { PrE2eIngestTrendPanel } from "@/components/prE2e/PrE2eAnalyticsRangeSections";
import {
  PrE2eIngestErrorsTable,
  PrE2eNamedCountTable,
  PrE2ePanel,
} from "@/components/prE2e/PrE2eDataTables";
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

export default async function PrChecksIngestPage() {
  const dbReady = isHealthCheckMysqlConfigured();
  const credTableReady = dbReady
    ? await isCredentialExpiryTableAvailable()
    : false;
  const alerts =
    dbReady && credTableReady ? await getCredentialAlertCounts() : null;

  const data = dbReady
    ? await getOrSetDashboardMysqlCache("pr-e2e:ingest-base:v1", () =>
        loadPrE2eDashboardBase(PR_E2E_PIPELINE_FILTER, 5),
      )
    : null;

  const lastOk = data?.lastSuccessfulIngest;
  const errorCount =
    data?.ingestStatus.find((s) => s.name === "error")?.count ?? 0;

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E"
          title="Ingest ops health"
          description="pr_e2e_ingest_log — pipeline health before trusting dashboard numbers."
          alerts={alerts}
          showCredentialsNav={false}
        />

        {data?.dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        <p
          className={`mb-4 rounded-[10px] border px-4 py-3 text-sm ${
            lastOk
              ? "border-emerald-200/60 bg-emerald-50/80 text-emerald-950"
              : "border-amber-200/60 bg-amber-50/80 text-amber-950"
          }`}
        >
          <span className="font-medium">Last successful ingest: </span>
          {lastOk
            ? new Date(lastOk).toISOString().replace("T", " ").slice(0, 19)
            : "None recorded — dashboard may be stale"}
        </p>

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <PrE2eIngestTrendPanel />
          </div>
          <div className="lg:col-span-2">
            <PrE2ePanel title="Status totals">
              <PrE2eNamedCountTable
                rows={(data?.ingestStatus ?? []).map((row) =>
                  row.name === "error"
                    ? {
                        ...row,
                        name: "error",
                      }
                    : row,
                )}
                nameHeader="Status"
                countHeader="Count"
              />
              {errorCount > 0 ? (
                <p className="mt-2 text-[11px]">
                  <a href="#ingest-errors" className="text-rose-700 underline">
                    Jump to {errorCount} error log entries ↓
                  </a>
                </p>
              ) : null}
            </PrE2ePanel>
          </div>
        </div>

        <div className="mt-4" id="ingest-errors">
          <PrE2ePanel title="Recent ingest errors">
            <PrE2eIngestErrorsTable rows={data?.ingestErrors ?? []} />
          </PrE2ePanel>
        </div>
      </div>
    </main>
  );
}
