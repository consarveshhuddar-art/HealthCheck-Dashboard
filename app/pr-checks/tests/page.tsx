import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { PrE2eTestTags } from "@/components/prE2e/PrE2eTestTags";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { dashboardUi } from "@/lib/dashboardUi";
import {
  loadPrE2eFailuresByTags,
  loadPrE2eTestHistory,
  type PrE2eTestHistoryRow,
} from "@/lib/prE2e/data";
import { parseTagSearchQuery } from "@/lib/prE2e/tags";
import { testHistoryHref } from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

function FailureHistoryList({
  history,
  emptyMessage,
}: {
  history: PrE2eTestHistoryRow[];
  emptyMessage: string;
}) {
  if (!history.length) {
    return (
      <p className="py-8 text-center text-sm text-[#94A3B8]">{emptyMessage}</p>
    );
  }

  return (
    <ul className="divide-y divide-[#EAEFF5]">
      {history.map((row) => (
        <li key={row.id} className="py-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <Link
              href={testHistoryHref(row.test_name)}
              className="font-medium text-violet-800 underline"
            >
              {row.test_name}
            </Link>
            <span className="text-[#94A3B8]">·</span>
            <Link
              href={`/pr-checks/runs/${row.run_id}`}
              className="text-violet-800 underline"
            >
              {row.service_repo} #{row.e2e_build_number}
            </Link>
            <span className="rounded border border-[#EAEFF5] px-1.5 py-0.5 text-[10px] capitalize">
              {row.status}
            </span>
            <span className="rounded border border-[#EAEFF5] px-1.5 py-0.5 text-[10px]">
              {row.classification}
            </span>
            <span className="text-[#94A3B8]">
              {new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ")}
            </span>
          </div>
          <PrE2eTestTags tags={row.tags} className="mt-1.5" />
          {row.error_message ? (
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-[#F9FAFB] p-2 font-mono text-[10px] text-[#64748B] whitespace-pre-wrap">
              {row.error_message.slice(0, 1500)}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function PrChecksTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; name?: string }>;
}) {
  const sp = await searchParams;
  const testName = sp.name?.trim();
  const tagQuery = sp.q?.trim();

  if (!testName && !tagQuery) notFound();

  const dbReady = isHealthCheckMysqlConfigured();
  if (!dbReady) notFound();

  const credTableReady = await isCredentialExpiryTableAvailable();
  const alerts = credTableReady ? await getCredentialAlertCounts() : null;

  if (testName) {
    const history = await loadPrE2eTestHistory(testName);
    return (
      <main className={dashboardUi.pageShell}>
        <div className={dashboardUi.content}>
          <DashboardHeader
            eyebrow="Test history"
            title={testName}
            description={`${history.length} failure row(s) for this test across PR E2E runs.`}
            alerts={alerts}
            showCredentialsNav={false}
          />

          <p className="mb-4 text-[11px]">
            <Link href="/pr-checks/analytics" className="text-violet-800 underline">
              ← Failure analytics
            </Link>
          </p>

          <section className={dashboardUi.panel}>
            <FailureHistoryList
              history={history}
              emptyMessage="No failure rows for this test name."
            />
          </section>
        </div>
      </main>
    );
  }

  const requiredTags = parseTagSearchQuery(tagQuery!);
  if (!requiredTags.length) notFound();

  const history = await loadPrE2eFailuresByTags(tagQuery!);

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="Tag search"
          title={requiredTags.join(" ")}
          description={`${history.length} failure row(s) with all tags: ${requiredTags.map((t) => `"${t}"`).join(", ")} (space-separated = AND).`}
          alerts={alerts}
          showCredentialsNav={false}
        />

        <p className="mb-4 text-[11px]">
          <Link href="/pr-checks/analytics" className="text-violet-800 underline">
            ← Failure analytics
          </Link>
        </p>

        <section className={dashboardUi.panel}>
          <FailureHistoryList
            history={history}
            emptyMessage='No test failures match all of these tags. Try fewer tags or check spelling (e.g. @service_video @smoke).'
          />
        </section>
      </div>
    </main>
  );
}
