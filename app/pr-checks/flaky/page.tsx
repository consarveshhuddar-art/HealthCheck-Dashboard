import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import {
  PrE2eBarChartSimple,
  PrE2eStabilityDonut,
} from "@/components/prE2e/PrE2eDashboardCharts";
import { PrE2eStabilityTable } from "@/components/prE2e/PrE2eStabilityTable";
import { PrE2ePanel } from "@/components/prE2e/PrE2eDataTables";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadStabilityFirstSeen } from "@/lib/prE2e/analytics";
import { loadPrE2eFullDashboard, loadPrE2eStability } from "@/lib/prE2e/data";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured, isHealthCheckMysqlReachable } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export default async function PrChecksFlakyPage({
  searchParams,
}: {
  searchParams: Promise<{ label?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const label =
    sp.label === "flaky" || sp.label === "failing" || sp.label === "stable"
      ? sp.label
      : undefined;

  const dbReady = isHealthCheckMysqlConfigured();
  const credTableReady = dbReady
    ? await isCredentialExpiryTableAvailable()
    : false;
  const alerts =
    dbReady && credTableReady ? await getCredentialAlertCounts() : null;

  const [{ rows, dbConnectionError }, summary, firstSeenMap] = dbReady
    ? await Promise.all([
        getOrSetDashboardMysqlCache(
          `pr-e2e:stability:v2:${label ?? "all"}`,
          async () => {
            if (!(await isHealthCheckMysqlReachable())) {
              return { rows: [], dbConnectionError: true };
            }
            return {
              rows: await loadPrE2eStability(label, 300),
              dbConnectionError: false,
            };
          },
        ),
        getOrSetDashboardMysqlCache("pr-e2e:flaky-summary:v1", () =>
          loadPrE2eFullDashboard(PR_E2E_PIPELINE_FILTER, 5, 30),
        ),
        loadStabilityFirstSeen([]),
      ])
    : [{ rows: [], dbConnectionError: false }, null, new Map<string, string>()];

  const counts = {
    flaky: summary?.stabilityDist.find((s) => s.name === "flaky")?.count ?? 0,
    failing: summary?.stabilityDist.find((s) => s.name === "failing")?.count ?? 0,
    stable: summary?.stabilityDist.find((s) => s.name === "stable")?.count ?? 0,
  };
  const total = counts.flaky + counts.failing + counts.stable;

  const firstSeen: Record<string, string> = {};
  for (const [k, v] of firstSeenMap) firstSeen[k] = v;

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E"
          title="Test stability (30 days)"
          description="Flaky: failed in ≥2 builds with ≥1 clean build. Failing: failed every build (≥2). Stable: everything else in the batch."
          alerts={alerts}
          showCredentialsNav={false}
        />

        <nav className="mb-4 flex flex-wrap gap-2 text-[11px]" aria-label="Stability label">
          {(
            [
              { tab: "all", label: "All", n: total },
              { tab: "flaky", label: "Flaky", n: counts.flaky },
              { tab: "failing", label: "Failing", n: counts.failing },
              { tab: "stable", label: "Stable", n: counts.stable },
            ] as const
          ).map(({ tab, label: tabLabel, n }) => {
            const params = new URLSearchParams();
            if (tab !== "all") params.set("label", tab);
            const q = params.toString();
            const href = q ? `/pr-checks/flaky?${q}` : "/pr-checks/flaky";
            const active =
              (tab === "all" && !label) || (tab !== "all" && label === tab);
            return (
              <a
                key={tab}
                href={href}
                className={`rounded-md border px-3 py-1.5 font-medium capitalize ${
                  active
                    ? "border-violet-200 bg-violet-50 text-violet-900"
                    : "border-[#EAEFF5] bg-white text-[#64748B] hover:bg-[#F9FAFB]"
                }`}
              >
                {tabLabel} ({n})
              </a>
            );
          })}
        </nav>

        {dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        {summary ? (
          <div className="mb-4 grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <PrE2ePanel title="Stability mix">
                <PrE2eStabilityDonut data={summary.stabilityDist} />
              </PrE2ePanel>
            </div>
            <div className="lg:col-span-3">
              <PrE2ePanel title="Flakiness by module">
                <PrE2eBarChartSimple data={summary.flakinessByModule} />
              </PrE2ePanel>
            </div>
          </div>
        ) : null}

        <section className={dashboardUi.panel}>
          <PrE2eStabilityTable rows={rows} firstSeen={firstSeen} />
        </section>
      </div>
    </main>
  );
}
