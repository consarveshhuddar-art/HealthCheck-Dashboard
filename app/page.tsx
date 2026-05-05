import { ChartsSection } from "@/components/ChartsSection";
import { RunsTable } from "@/components/RunsTable";
import { ServicesByDaySection } from "@/components/ServicesByDaySection";
import { StatCard } from "@/components/StatCard";
import {
  aggregateDailyFailures,
  aggregateDailyRunOutcomes,
  aggregateWeeklyFailures,
  buildServiceEnvDayChart,
  defaultIstDayString,
  envFailureRangeCaption,
  fetchFailuresForEnvRange,
  fetchRecentRunsWithFailures,
  flattenFailuresWithRunTime,
  parseEnvFailureRangeMode,
  summarizeRuns,
  topFailingServices,
} from "@/lib/data";
import { dashboardUi } from "@/lib/dashboardUi";
import { RECENT_RUNS_LIMIT } from "@/lib/limits";
import { getSupabaseServer } from "@/lib/supabase/server";

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
  searchParams: Promise<{ day?: string; envRange?: string }>;
}) {
  const supabase = getSupabaseServer();
  const sp = await searchParams;
  const selectedDay = parseSelectedDay(sp.day);
  const envRange = parseEnvFailureRangeMode(sp.envRange);

  const runs = await fetchRecentRunsWithFailures(RECENT_RUNS_LIMIT);
  const failures = flattenFailuresWithRunTime(runs);
  const stats = summarizeRuns(runs);
  const daily = aggregateDailyFailures(failures, 14);
  const dailyOutcomes = aggregateDailyRunOutcomes(runs, 14);
  const weekly = aggregateWeeklyFailures(failures, 8);
  const services = topFailingServices(failures, 24);

  const envFailures = supabase
    ? await fetchFailuresForEnvRange(envRange, selectedDay)
    : [];
  const serviceEnvDayRows = buildServiceEnvDayChart(envFailures);
  const envCaption = envFailureRangeCaption(envRange, selectedDay);

  if (!supabase) {
    return (
      <div className={`${dashboardUi.pageShell} flex min-h-full flex-col justify-center px-3 py-16 sm:px-4`}>
        <div className="mx-auto w-full max-w-lg rounded-xl border border-amber-200/90 bg-gradient-to-b from-amber-50 to-white p-8 shadow-lg ring-1 ring-amber-950/[0.06] backdrop-blur-sm transition-shadow duration-300 hover:shadow-xl">
          <h1 className="text-lg font-semibold text-amber-900">
            Supabase is not configured
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-amber-800/90">
            Add{" "}
            <code className="rounded border border-amber-200 bg-white/90 px-1.5 py-0.5 font-mono text-xs">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="rounded border border-amber-200 bg-white/90 px-1.5 py-0.5 font-mono text-xs">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            to <span className="font-medium">.env.local</span> (see{" "}
            <code className="font-mono text-xs">.env.example</code>), then restart{" "}
            <code className="font-mono text-xs">npm run dev</code>.
          </p>
          <p className="mt-4 text-xs text-amber-700/80">
            The service role key is read only on the server and never sent to the browser.
            For production, prefer an anon key plus RLS policies if this app is public.
          </p>
        </div>
      </div>
    );
  }

  const lastHint = stats.lastRun
    ? `Build #${stats.lastRun.build_number} · ${stats.lastRun.jenkins_result}`
    : undefined;

  return (
    <div className={`${dashboardUi.pageShell} pb-16 pt-5 sm:pt-6`}>
      <div className={dashboardUi.content}>
        <header className={`${dashboardUi.headerBand} mb-6 md:mb-8`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Infrastructure
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Health check dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Jenkins health-check runs ingested into Supabase: pass/fail per service,
            failure trends, and env-level drill-down.
          </p>
        </header>

        <div className={`${dashboardUi.statGrid} mb-6 md:mb-8`}>
          <StatCard
            title="Runs loaded"
            value={stats.total}
            hint={`Newest first (cap ${RECENT_RUNS_LIMIT})`}
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
        />

        <div className="mt-6 md:mt-7">
          <ServicesByDaySection
            envRange={envRange}
            selectedDay={selectedDay}
            caption={envCaption}
            rows={serviceEnvDayRows}
          />
        </div>

        <section className={`${dashboardUi.panel} mt-6 md:mt-7`}>
          <div className="border-b border-slate-100/90 pb-3">
            <h2 className={dashboardUi.sectionLabel}>Recent runs</h2>
            <p className={dashboardUi.sectionDesc}>
              Newest runs first. Status uses failure row count from Supabase.
            </p>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-white/50 bg-white/55 shadow-inner ring-1 ring-slate-950/[0.04] backdrop-blur-sm transition-all duration-300 hover:bg-white/70">
            <RunsTable runs={runs} />
          </div>
        </section>
      </div>
    </div>
  );
}
