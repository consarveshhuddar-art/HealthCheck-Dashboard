import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { PrE2eTestTags } from "@/components/prE2e/PrE2eTestTags";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { dashboardUi } from "@/lib/dashboardUi";
import { loadPrE2eRunById } from "@/lib/prE2e/data";
import {
  prE2eFailureDetailMessage,
  prE2eFailureDetailState,
} from "@/lib/prE2e/ingestDiagnostics";
import {
  effectivePassRatePct,
  jenkinsResultIsSuccess,
  prHistoryHref,
  testHistoryHref,
} from "@/lib/prE2e/types";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

function MetaItem({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <div className={span ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <p className="text-[10px] uppercase text-[#94A3B8]">{label}</p>
      <div className="text-sm text-[#1F2937]">{children}</div>
    </div>
  );
}

export default async function PrCheckRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dbReady = isHealthCheckMysqlConfigured();
  if (!dbReady) notFound();

  const run = await loadPrE2eRunById(id);
  if (!run) notFound();

  const failureState = prE2eFailureDetailState(run);
  const failureMessage = prE2eFailureDetailMessage(failureState);
  const passPct = effectivePassRatePct(run);

  const credTableReady = await isCredentialExpiryTableAvailable();
  const alerts = credTableReady ? await getCredentialAlertCounts() : null;

  const durationMin =
    run.e2e_duration_ms != null
      ? run.e2e_duration_ms >= 60000
        ? `${(run.e2e_duration_ms / 60000).toFixed(1)} min`
        : `${Math.round(run.e2e_duration_ms / 1000)} sec`
      : "—";

  return (
    <main className={dashboardUi.pageShell}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="PR E2E run"
          title={`${run.service_repo} #${run.e2e_build_number}`}
          description={`${run.e2e_job_name} · ${run.env_suffix}`}
          alerts={alerts}
          showCredentialsNav={false}
        />

        <p className="mb-4 text-[11px]">
          <Link href="/pr-checks/runs" className="text-violet-800 underline">
            ← All runs
          </Link>
          {run.pr_number != null ? (
            <>
              {" · "}
              <Link
                href={prHistoryHref(run.pr_number, run.service_repo)}
                className="text-violet-800 underline"
              >
                PR #{run.pr_number} history
              </Link>
            </>
          ) : null}
        </p>

        <div className={`mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${dashboardUi.panel}`}>
          <MetaItem label="Jenkins">
            <a
              href={run.e2e_build_url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-violet-800 underline"
            >
              Build #{run.e2e_build_number}
            </a>
          </MetaItem>
          <MetaItem label="Result">
            <span className="font-medium">{run.e2e_jenkins_result}</span>
          </MetaItem>
          <MetaItem label="Pass rate">
            <span className="tabular-nums">
              {passPct != null ? `${passPct}%` : "—"} ({run.passed_count}/
              {run.total_tests})
            </span>
          </MetaItem>
          <MetaItem label="Duration">{durationMin}</MetaItem>
          <MetaItem label="Test group">{run.test_group ?? "—"}</MetaItem>
          <MetaItem label="Pipeline">
            {run.is_release_pipeline ? "Release" : "PR"}
          </MetaItem>
          <MetaItem label="Trigger">
            {run.trigger_type ?? "—"}
            {run.trigger_user ? ` (${run.trigger_user})` : ""}
          </MetaItem>
          <MetaItem label="Retry / parallel">
            {run.retry_enabled ? "retry on" : "retry off"} ·{" "}
            {run.parallel_execution ? "parallel" : "sequential"}
          </MetaItem>
          {run.git_author ? (
            <MetaItem label="Git author">{run.git_author}</MetaItem>
          ) : null}
          {run.github_pr_link ? (
            <MetaItem label="PR" span>
              <a
                href={run.github_pr_link}
                target="_blank"
                rel="noreferrer"
                className="text-violet-800 underline break-all"
              >
                {run.github_pr_link}
              </a>
            </MetaItem>
          ) : null}
          {run.allure_url ? (
            <MetaItem label="Allure">
              <a
                href={run.allure_url}
                target="_blank"
                rel="noreferrer"
                className="text-violet-800 underline"
              >
                Report
              </a>
            </MetaItem>
          ) : null}
          {run.upstream_job_name ? (
            <MetaItem label="Upstream">{run.upstream_job_name}</MetaItem>
          ) : null}
          {run.cucumber_tags ? (
            <MetaItem label="Cucumber tags" span>
              <p className="break-all font-mono text-[11px] text-[#64748B]">
                {run.cucumber_tags}
              </p>
            </MetaItem>
          ) : null}
          {run.finished_at_ist ? (
            <MetaItem label="Finished (IST)">{run.finished_at_ist}</MetaItem>
          ) : null}
        </div>

        {failureState.kind !== "none" && failureState.kind !== "has_rows" ? (
          <p className="mb-4 rounded-[10px] border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-amber-950">
            <span className="font-medium">Jenkins: {run.e2e_jenkins_result}.</span>{" "}
            Per-test failure detail was not fully ingested into MySQL.
          </p>
        ) : null}

        <section className={dashboardUi.panel}>
          <div className={dashboardUi.panelHeaderDivider}>
            <h2 className={dashboardUi.panelTitle}>
              Per-test failures ({run.failures.length})
            </h2>
          </div>
          {run.failures.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
              {failureMessage}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[#EAEFF5]">
              {run.failures.map((f) => (
                <li key={f.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={testHistoryHref(f.test_name)}
                      className="font-medium text-violet-800 underline"
                    >
                      {f.test_name}
                    </Link>
                    <span className="rounded border border-[#EAEFF5] px-1.5 py-0.5 text-[10px] capitalize text-[#64748B]">
                      {f.classification}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">{f.status}</span>
                    {f.module ? (
                      <span className="text-[10px] text-[#94A3B8]">
                        module: {f.module}
                      </span>
                    ) : null}
                  </div>
                  <PrE2eTestTags tags={f.tags} className="mt-1.5" />
                  {f.error_message ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-[#F9FAFB] p-2 font-mono text-[10px] text-[#64748B] whitespace-pre-wrap">
                      {f.error_message.slice(0, 2000)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
