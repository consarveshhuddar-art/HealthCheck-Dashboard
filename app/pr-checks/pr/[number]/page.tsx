import { PrE2ePageLink } from "@/components/prE2e/PrE2ePageLink";
import { PrE2eTestNameLink } from "@/components/prE2e/PrE2eTestNameLink";
import { notFound } from "next/navigation";
import { PrE2eRunsTable } from "@/components/prE2e/PrE2eRunsTable";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadPrE2eRunsByPr } from "@/lib/prE2e/data";
import { effectivePassRatePct, runPasses } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export default async function PrCheckPrHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { number } = await params;
  const sp = await searchParams;
  const prNumber = parseInt(number, 10);
  if (!Number.isFinite(prNumber)) notFound();

  const dbReady = isHealthCheckMysqlConfigured();
  if (!dbReady) notFound();

  const runs = await loadPrE2eRunsByPr(prNumber, sp.service);
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

  const failedTests = new Map<string, number>();
  for (const run of runs) {
    for (const f of run.failures) {
      failedTests.set(f.test_name, (failedTests.get(f.test_name) ?? 0) + 1);
    }
  }
  const recurring = [...failedTests.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1]);

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR history"
          title={`PR #${prNumber}`}
          description={
            sp.service
              ? `E2E runs for ${sp.service} on this PR.`
              : "All E2E runs associated with this PR across services."
          }
          alerts={alerts}
          showCredentialsNav={false}
        />

        <p className="mb-4 text-[11px]">
          <PrE2ePageLink href="/pr-checks/runs" className="text-violet-800 underline">
            ← All runs
          </PrE2ePageLink>
        </p>

        <div className={`mb-4 grid gap-3 sm:grid-cols-3 ${dashboardUi.panel}`}>
          <div>
            <p className="text-[10px] uppercase text-[#94A3B8]">Runs</p>
            <p className="text-lg font-semibold tabular-nums">{runs.length}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#94A3B8]">Pass rate</p>
            <p className="text-lg font-semibold tabular-nums">
              {avgPass != null ? `${avgPass}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#94A3B8]">Passing runs</p>
            <p className="text-lg font-semibold tabular-nums">
              {passCount}/{runs.length}
            </p>
          </div>
        </div>

        {recurring.length ? (
          <section className={`mb-4 ${dashboardUi.panel}`}>
            <div className={dashboardUi.panelHeaderDivider}>
              <h2 className={dashboardUi.panelTitle}>Recurring failures</h2>
              <p className={dashboardUi.panelDesc}>
                Tests that failed on multiple runs for this PR.
              </p>
            </div>
            <ul className="mt-3 space-y-1 text-[13px]">
              {recurring.map(([name, count]) => (
                <li key={name}>
                  <PrE2eTestNameLink name={name} />
                  <span className="ml-2 text-[#94A3B8]">×{count}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={dashboardUi.panel}>
          <div className={dashboardUi.panelHeaderDivider}>
            <h2 className={dashboardUi.panelTitle}>E2E runs</h2>
          </div>
          <div className="mt-3">
            <PrE2eRunsTable runs={runs} />
          </div>
        </section>
      </div>
    </main>
  );
}
