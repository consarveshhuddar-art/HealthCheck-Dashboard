import Link from "next/link";
import { PrE2eRunsTable } from "@/components/prE2e/PrE2eRunsTable";
import { PrE2eStabilityTable } from "@/components/prE2e/PrE2eStabilityTable";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { dashboardUi } from "@/lib/dashboardUi";
import { PrE2eServiceSparkline } from "@/components/prE2e/PrE2eServiceSparkline";
import { loadServicePassRateTrend } from "@/lib/prE2e/analytics";
import { fillPassRateTrend } from "@/lib/prE2e/trendFill";
import { loadPrE2eRunsByService, loadPrE2eStability } from "@/lib/prE2e/data";
import { loadStabilityFirstSeen } from "@/lib/prE2e/analytics";
import { effectivePassRatePct, runPasses } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export default async function PrCheckServiceDetailPage({
  params,
}: {
  params: Promise<{ repo: string }>;
}) {
  const { repo } = await params;
  const service = decodeURIComponent(repo);
  const dbReady = isHealthCheckMysqlConfigured();
  if (!dbReady) {
    return (
      <main className={dashboardUi.pageShell}>
        <div className={dashboardUi.content}>
          <p className="text-sm text-amber-950">MySQL not configured.</p>
        </div>
      </main>
    );
  }

  const [runs, allStability, sparkRaw, firstSeenMap] = await Promise.all([
    loadPrE2eRunsByService(service, 80),
    loadPrE2eStability(undefined, 500),
    loadServicePassRateTrend(service, 7),
    loadStabilityFirstSeen([]),
  ]);
  const sparkline = fillPassRateTrend(sparkRaw, 7);
  const firstSeen: Record<string, string> = {};
  for (const [k, v] of firstSeenMap) firstSeen[k] = v;
  const stability = allStability.filter((s) => s.service_repo === service);

  const credTableReady = await isCredentialExpiryTableAvailable();
  const alerts = credTableReady ? await getCredentialAlertCounts() : null;

  const passCount = runs.filter(runPasses).length;
  const rates = runs
    .map((r) => effectivePassRatePct(r))
    .filter((x): x is number => x != null);
  const avgPass =
    rates.length > 0
      ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100
      : null;

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="Service"
          title={service}
          description="Run history and 30-day stability for this service_repo."
          alerts={alerts}
          showCredentialsNav={false}
        />

        <p className="mb-4 text-[11px]">
          <Link href="/pr-checks/services" className="text-violet-800 underline">
            ← All services
          </Link>
        </p>

        <div className={`mb-4 flex flex-wrap items-center gap-4 ${dashboardUi.panel}`}>
          <div className="grid flex-1 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase text-[#94A3B8]">E2E runs</p>
              <p className="text-lg font-semibold tabular-nums">{runs.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[#94A3B8]">Avg pass %</p>
              <p className="text-lg font-semibold tabular-nums">
                {avgPass != null ? `${avgPass}%` : "—"}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] uppercase text-[#94A3B8]"
                title="Runs where Jenkins succeeded and no failed/broken tests"
              >
                Passing runs
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {passCount}/{runs.length}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[#94A3B8]">Flaky tests</p>
              <p className="text-lg font-semibold tabular-nums">
                {stability.filter((s) => s.stability_label === "flaky").length}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <p className="mb-1 text-[10px] uppercase text-[#94A3B8]">7d pass rate</p>
            <PrE2eServiceSparkline data={sparkline} />
          </div>
        </div>

        {stability.length ? (
          <section className={`mb-4 ${dashboardUi.panel}`}>
            <div className={dashboardUi.panelHeaderDivider}>
              <h2 className={dashboardUi.panelTitle}>Stability (30d)</h2>
            </div>
            <div className="mt-3">
              <PrE2eStabilityTable rows={stability.slice(0, 40)} firstSeen={firstSeen} />
            </div>
          </section>
        ) : null}

        <section className={dashboardUi.panel}>
          <div className={dashboardUi.panelHeaderDivider}>
            <h2 className={dashboardUi.panelTitle}>Recent runs</h2>
          </div>
          <div className="mt-3">
            <PrE2eRunsTable runs={runs} />
          </div>
        </section>
      </div>
    </main>
  );
}
