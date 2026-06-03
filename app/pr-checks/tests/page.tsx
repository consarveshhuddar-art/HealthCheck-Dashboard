import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { PrE2eFailureHistoryList } from "@/components/prE2e/PrE2eFailureHistoryList";
import { PrE2ePageLink } from "@/components/prE2e/PrE2ePageLink";
import { PrE2eSearchResultFilters } from "@/components/prE2e/PrE2eSearchResultFilters";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { dashboardUi } from "@/lib/dashboardUi";
import {
  loadPrE2eFailuresByTags,
  loadPrE2eTestHistory,
} from "@/lib/prE2e/data";
import { parseTagSearchQuery } from "@/lib/prE2e/tags";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export default async function PrChecksTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; name?: string; service?: string }>;
}) {
  const sp = await searchParams;
  const testName = sp.name?.trim();
  const tagQuery = sp.q?.trim();
  const filters = {
    service: sp.service?.trim() || undefined,
  };

  if (!testName && !tagQuery) notFound();

  const dbReady = isHealthCheckMysqlConfigured();
  if (!dbReady) notFound();

  const credTableReady = await isCredentialExpiryTableAvailable();
  const alerts = credTableReady ? await getCredentialAlertCounts() : null;

  if (testName) {
    const history = await loadPrE2eTestHistory(testName, 100, filters);
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
            <PrE2ePageLink href="/pr-checks/analytics" className="text-violet-800 underline">
              ← Failure analytics
            </PrE2ePageLink>
          </p>

          <section className={dashboardUi.panel}>
            <PrE2eFailureHistoryList
              history={history}
              emptyMessage="No failure rows for this test name."
              showAuthor
            />
          </section>
        </div>
      </main>
    );
  }

  const requiredTags = parseTagSearchQuery(tagQuery!);
  if (!requiredTags.length) notFound();

  const { rows, totalCount, facets } = await loadPrE2eFailuresByTags(
    tagQuery!,
    150,
    filters,
  );

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="Tag search"
          title={requiredTags.join(" ")}
          description={`${rows.length} failure row(s) with all tags: ${requiredTags.map((t) => `"${t}"`).join(", ")} (space-separated = AND).`}
          alerts={alerts}
          showCredentialsNav={false}
        />

        <p className="mb-4 text-[11px]">
          <PrE2ePageLink href="/pr-checks/analytics" className="text-violet-800 underline">
            ← Failure analytics
          </PrE2ePageLink>
        </p>

        <section className={dashboardUi.panel}>
          <Suspense fallback={null}>
            <PrE2eSearchResultFilters
              tagQuery={tagQuery!}
              services={facets.services}
              initialService={filters.service ?? ""}
              resultCount={rows.length}
              totalCount={totalCount}
            />
          </Suspense>
          <PrE2eFailureHistoryList
            history={rows}
            showAuthor
            emptyMessage={
              filters.service
                ? "No rows match these tags with the selected service filter."
                : 'No test failures match all of these tags. Try fewer tags or check spelling (e.g. @service_video @smoke).'
            }
          />
        </section>
      </div>
    </main>
  );
}
