import { Suspense } from "react";
import { CredentialsExpirySection } from "@/components/CredentialsExpirySection";
import { DashboardHeader } from "@/components/DashboardHeader";
import { defaultIstDayString } from "@/lib/data";
import { StoppedCredentialsSection } from "@/components/StoppedCredentialsSection";
import {
  buildCredentialGroups,
  buildStoppedCredentialList,
  fetchAllCredentialRecords,
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
  parseCredentialSortMode,
  sortCredentialGroups,
} from "@/lib/credentials";
import { dashboardUi } from "@/lib/dashboardUi";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Credential expiry · Health dashboard",
  description: "Track credential renewal dates and ticket references",
};

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const dbReady = isHealthCheckMysqlConfigured();
  const sp = await searchParams;
  const sort = parseCredentialSortMode(sp.sort);
  const todayIst = defaultIstDayString();

  if (!dbReady) {
    return (
      <div
        className={`${dashboardUi.pageShell} flex min-h-full flex-col justify-center px-5 py-16 sm:px-8`}
      >
        <div className="mx-auto w-full max-w-lg rounded-[10px] border border-[#EAEFF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFE_100%)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-[#0B1220]">
            Database is not configured
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
            Add MySQL settings to <span className="text-[#0B1220]">.env.local</span>{" "}
            (see <code className="font-mono text-xs">.env.example</code>), then restart{" "}
            <code className="font-mono text-xs">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  const tableReady = await isCredentialExpiryTableAvailable();
  if (!tableReady) {
    return (
      <div className={`${dashboardUi.pageShell} pb-8 sm:pb-10`}>
        <div className={dashboardUi.content}>
          <DashboardHeader
            eyebrow="Operations"
            title="Credential expiry"
            description="Track renewal dates and Jira (or other) tickets for infrastructure credentials."
            alerts={null}
          />
          <div className="rounded-[10px] border border-[#EAEFF5] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <h2 className="text-sm font-semibold text-[#0B1220]">
              Table not found
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
              Run the migration on your MySQL database (
              <code className="font-mono text-xs">automation_testdata</code>):
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md border border-[#EAEFF5] bg-[#F9FAFB] p-3 font-mono text-[11px] text-[#374151]">
              mysql -h HOST -u USER -p automation_testdata &lt;
              scripts/create-credential-expiry-records.sql
            </pre>
          </div>
        </div>
      </div>
    );
  }

  const [records, alerts] = await Promise.all([
    fetchAllCredentialRecords(),
    getCredentialAlertCounts(todayIst),
  ]);
  const groups = sortCredentialGroups(buildCredentialGroups(records), sort);
  const stopped = buildStoppedCredentialList(records);

  return (
    <div className={`${dashboardUi.pageShell} pb-8 sm:pb-10`}>
      <div className={dashboardUi.content}>
        <DashboardHeader
          eyebrow="Operations"
          title="Credential expiry"
          description="Track credentials, renew before expiry, stop tracking to archive, or resume from the stopped list."
          alerts={alerts}
        />

        <Suspense
          fallback={
            <div
              className={`${dashboardUi.panel} min-h-[240px] animate-pulse`}
              aria-busy
            />
          }
        >
          <CredentialsExpirySection
            groups={groups}
            sort={sort}
            todayIst={todayIst}
            stats={alerts}
          />
          <StoppedCredentialsSection stopped={stopped} todayIst={todayIst} />
        </Suspense>
      </div>
    </div>
  );
}
