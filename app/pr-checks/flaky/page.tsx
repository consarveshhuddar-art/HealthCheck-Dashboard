import { MysqlConnectionErrorBanner } from "@/components/MysqlConnectionErrorBanner";
import { PrE2eStabilityDonut } from "@/components/prE2e/PrE2eDashboardCharts";
import { PrE2eFlakyLabelNav } from "@/components/prE2e/PrE2eFlakyLabelNav";
import { PrE2eStabilityLegend } from "@/components/prE2e/PrE2eStabilityLegend";
import { PrE2eStabilityTable } from "@/components/prE2e/PrE2eStabilityTable";
import { PrE2ePanel } from "@/components/prE2e/PrE2eDataTables";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatCard } from "@/components/StatCard";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadStabilityFirstSeen } from "@/lib/prE2e/analytics";
import { loadPrE2eFullDashboard, loadPrE2eStability } from "@/lib/prE2e/data";
import { PR_E2E_STABILITY_TABLE_MAX_ROWS } from "@/lib/prE2e/limits";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured, isHealthCheckMysqlReachable } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

function tableTitle(label?: "flaky" | "failing" | "stable") {
  if (label === "flaky") return "Flaky tests";
  if (label === "failing") return "Failing tests";
  if (label === "stable") return "Stable tests";
  return "All tracked tests";
}

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
              rows: await loadPrE2eStability(label, PR_E2E_STABILITY_TABLE_MAX_ROWS),
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
  const hasMix = (summary?.stabilityDist.length ?? 0) > 0;

  const firstSeen: Record<string, string> = {};
  for (const [k, v] of firstSeenMap) firstSeen[k] = v;

  const tableTotal = label ? counts[label] : total;
  const tableDescription =
    tableTotal > rows.length
      ? `Showing ${rows.length} of ${tableTotal} test(s) (max ${PR_E2E_STABILITY_TABLE_MAX_ROWS}) · 30-day stability batch${
          label ? ` · filtered to ${label}` : ""
        }`
      : `${rows.length} test(s) · 30-day stability batch${
          label ? ` · filtered to ${label}` : ""
        }`;

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

        <div className={`mb-4 ${dashboardUi.statGrid} lg:grid-cols-4`}>
          <StatCard title="Tracked tests" value={total} hint="30-day batch" accent="slate" />
          <StatCard title="Flaky" value={counts.flaky} hint="Intermittent failures" accent="amber" />
          <StatCard title="Failing" value={counts.failing} hint="Fails every sampled build" accent="rose" />
          <StatCard title="Stable" value={counts.stable} hint="Passes or single failure" accent="emerald" />
        </div>

        <div className={`mb-4 ${dashboardUi.panel}`}>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
            Filter by label
          </p>
          <PrE2eFlakyLabelNav
            activeLabel={label}
            counts={{
              all: total,
              flaky: counts.flaky,
              failing: counts.failing,
              stable: counts.stable,
            }}
            className="mb-0"
          />
        </div>

        {dbConnectionError ? (
          <MysqlConnectionErrorBanner className="mb-4" />
        ) : null}

        <div
          className={
            hasMix
              ? "grid gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start"
              : "grid gap-4"
          }
        >
          {hasMix ? (
            <aside className="lg:sticky lg:top-4">
              <PrE2ePanel title="Stability mix">
                <PrE2eStabilityDonut data={summary!.stabilityDist} />
                <PrE2eStabilityLegend items={summary!.stabilityDist} total={total} />
              </PrE2ePanel>
            </aside>
          ) : null}

          <PrE2ePanel
            title={tableTitle(label)}
            description={tableDescription}
          >
            <PrE2eStabilityTable rows={rows} firstSeen={firstSeen} />
          </PrE2ePanel>
        </div>
      </div>
    </main>
  );
}
