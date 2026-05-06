import { Suspense } from "react";
import { ChartsSection } from "@/components/ChartsSection";
import { RunsTable } from "@/components/RunsTable";
import { RunsWindowControl } from "@/components/RunsWindowControl";
import { ServicesByDaySection } from "@/components/ServicesByDaySection";
import { StatCard } from "@/components/StatCard";
import { getOrSetDashboardMysqlCache } from "@/lib/dashboard-cache";
import {
  aggregateDailyFailures,
  aggregateWeeklyFailures,
  buildDailyRunOutcomesFromAggregates,
  buildServiceEnvDayChart,
  defaultIstDayString,
  envFailureRangeCaption,
  flattenFailuresWithRunTime,
  loadDashboardMysqlSnapshot,
  parseEnvFailureRangeMode,
  summarizeRuns,
  topFailingServices,
} from "@/lib/data";
import { dashboardUi } from "@/lib/dashboardUi";
import {
  parseRunDataWindow,
  runDataWindowLabel,
  runLimitForWindow,
  TREND_DAILY_DAYS,
  TREND_WEEKLY_BUCKETS,
} from "@/lib/limits";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";
import type {
  FailureWithRunTime,
  HealthCheckFailure,
  RunWithFailures,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function parseSelectedDay(raw: string | undefined): string {
  const fallback = defaultIstDayString();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return fallback;
  }
  return raw;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; envRange?: string; window?: string }>;
}) {
  const dbReady = isHealthCheckMysqlConfigured();
  const sp = await searchParams;
  const selectedDay = parseSelectedDay(sp.day);
  const envRange = parseEnvFailureRangeMode(sp.envRange);
  const runDataWindow = parseRunDataWindow(sp.window);
  const runsLimit = runLimitForWindow(runDataWindow);

  const { runs, envFailures, trendFailures, outcomeAggregates } = dbReady
    ? await getOrSetDashboardMysqlCache(
        `dash:mysql:v1:${runsLimit}:${envRange}:${selectedDay}`,
        () =>
          loadDashboardMysqlSnapshot({
            runsLimit,
            envRange,
            selectedIstDay: selectedDay,
          }),
      )
    : {
        runs: [] as RunWithFailures[],
        envFailures: [] as HealthCheckFailure[],
        trendFailures: [] as FailureWithRunTime[],
        outcomeAggregates: new Map<string, { total: number; failed: number }>(),
      };

  const failures = flattenFailuresWithRunTime(runs);
  const stats = summarizeRuns(runs);
  const daily = aggregateDailyFailures(trendFailures, TREND_DAILY_DAYS);
  const dailyOutcomes = buildDailyRunOutcomesFromAggregates(
    outcomeAggregates,
    TREND_DAILY_DAYS,
  );
  const weekly = aggregateWeeklyFailures(trendFailures, TREND_WEEKLY_BUCKETS);
  const services = topFailingServices(failures, 24);

  const serviceEnvDayRows = buildServiceEnvDayChart(envFailures);
  const envCaption = envFailureRangeCaption(envRange, selectedDay);

  if (!dbReady) {
    return (
      <div
        className={`${dashboardUi.pageShell} flex min-h-full flex-col justify-center px-5 py-16 sm:px-8`}
      >
        <div className="mx-auto w-full max-w-lg rounded-[10px] border border-[#EAEFF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFE_100%)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,0.045)]">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-[#0B1220]">
            Database is not configured
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
            Add MySQL settings to <span className="text-[#0B1220]">.env.local</span> (see{" "}
            <code className="font-mono text-xs text-[#374151]">.env.example</code>):{" "}
            <code className="rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-1.5 py-0.5 font-mono text-xs text-[#374151]">
              HEALTH_CHECK_MYSQL_HOST
            </code>
            ,{" "}
            <code className="rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-1.5 py-0.5 font-mono text-xs text-[#374151]">
              HEALTH_CHECK_MYSQL_USER
            </code>
            ,{" "}
            <code className="rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-1.5 py-0.5 font-mono text-xs text-[#374151]">
              HEALTH_CHECK_MYSQL_PASSWORD
            </code>
            ,{" "}
            <code className="rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-1.5 py-0.5 font-mono text-xs text-[#374151]">
              HEALTH_CHECK_MYSQL_DATABASE
            </code>
            , optionally{" "}
            <code className="rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-1.5 py-0.5 font-mono text-xs text-[#374151]">
              HEALTH_CHECK_MYSQL_PORT
            </code>
            . Internal hosts require VPN. Then restart{" "}
            <code className="font-mono text-xs text-[#374151]">npm run dev</code>.
          </p>
          <p className="mt-4 text-xs text-[#6B7280]">
            Credentials are server-only (never exposed as NEXT_PUBLIC_*).
          </p>
        </div>
      </div>
    );
  }

  const lastHint = stats.lastRun
    ? `Build #${stats.lastRun.build_number} · ${stats.lastRun.jenkins_result}`
    : undefined;

  const runsHint = `Newest first · ${runDataWindowLabel(runDataWindow)} (cap ${runsLimit})`;

  return (
    <div className={`${dashboardUi.pageShell} pb-8 sm:pb-10`}>
      <div className={dashboardUi.content}>
        <header className={`${dashboardUi.pageHeader} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#94A3B8]">
              Infrastructure
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-[-0.02em] text-[#0B1220] sm:text-[1.375rem]">
              Health check dashboard
            </h1>
            <p className="mt-1.5 max-w-3xl text-[11px] leading-relaxed text-[#64748B]/85">
              Jenkins health-check runs stored in MySQL (test DB): pass/fail per service,
              failure trends, and env-level drill-down. Chart data reloads from MySQL if
              older than 2 minutes.
            </p>
          </div>
          <Suspense
            fallback={
              <div
                className="h-9 shrink-0 self-start rounded-[10px] bg-[#F9FAFB] sm:self-center"
                style={{ width: "11rem" }}
                aria-hidden
              />
            }
          >
            <RunsWindowControl currentWindow={runDataWindow} />
          </Suspense>
        </header>

        <div className={`${dashboardUi.statGrid} mb-5`}>
          <StatCard
            title="Runs loaded"
            value={stats.total}
            hint={runsHint}
            accent="slate"
          />
          <StatCard
            title="Fully green"
            value={stats.clean}
            hint="No failure rows"
            accent="emerald"
          />
          <StatCard
            title="Runs with issues"
            value={stats.withFailures}
            accent="rose"
          />
          <StatCard
            title="Green rate"
            value={`${stats.successRate}%`}
            hint={lastHint}
            accent="sky"
          />
        </div>

        <ChartsSection
          daily={daily}
          weekly={weekly}
          dailyOutcomes={dailyOutcomes}
          services={services}
          runsCap={runsLimit}
          trendDailyDays={TREND_DAILY_DAYS}
          trendWeeklyBuckets={TREND_WEEKLY_BUCKETS}
        />

        <div className="mt-5">
          <Suspense
            fallback={
              <section
                className={`${dashboardUi.panel} min-h-[200px] animate-pulse bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFE_100%)]`}
                aria-busy
              />
            }
          >
            <ServicesByDaySection
              envRange={envRange}
              selectedDay={selectedDay}
              caption={envCaption}
              rows={serviceEnvDayRows}
            />
          </Suspense>
        </div>

        <section className={`${dashboardUi.panel} mt-5`}>
          <div className={dashboardUi.panelHeaderDivider}>
            <h2 className={dashboardUi.sectionLabel}>Recent runs</h2>
            <p className={dashboardUi.sectionDesc}>
              Newest runs first. Status uses failure row count from MySQL.
            </p>
          </div>
          <div className="mt-2 overflow-hidden rounded-[8px] bg-[#FFFFFF] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-[box-shadow] duration-150 ease-out hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <RunsTable runs={runs} />
          </div>
        </section>
      </div>
    </div>
  );
}
