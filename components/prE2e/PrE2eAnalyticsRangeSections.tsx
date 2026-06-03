"use client";

import { LoaderSpinner } from "@/components/LoaderSpinner";
import { PrE2eBarChartSimple, PrE2eIngestCharts } from "@/components/prE2e/PrE2eDashboardCharts";
import {
  PrE2eHeatmapGrid,
  PrE2eNamedCountTable,
  PrE2ePanel,
} from "@/components/prE2e/PrE2eDataTables";
import { PrE2eRangePicker } from "@/components/prE2e/PrE2eRangePicker";
import { PrE2eTopFailingCompare } from "@/components/prE2e/PrE2eTopFailingCompare";
import { usePrE2eRangeQuery } from "@/components/prE2e/usePrE2eRangeQuery";
import { PR_E2E_ANALYTICS_MAX_ROWS } from "@/lib/prE2e/limits";
import type { TopFailingCompareRow } from "@/lib/prE2e/format";
import { dashboardUi } from "@/lib/dashboardUi";
import type { PrE2eHeatmapCell, PrE2eNamedCount } from "@/lib/prE2e/types";
import { PR_E2E_TREND_DAYS_DEFAULT } from "@/lib/prE2e/trendFill";

function PanelLoading() {
  return (
    <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#94A3B8]">
      <LoaderSpinner size="md" />
      Loading…
    </p>
  );
}

function PanelError({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-rose-700">{message}</p>;
}

function RangePanel<T>({
  title,
  description,
  metric,
  defaultDays = PR_E2E_TREND_DAYS_DEFAULT,
  children,
}: {
  title: string;
  description?: string;
  metric: import("@/lib/prE2e/rangeQuery").PrE2eRangeMetric;
  defaultDays?: import("@/lib/prE2e/trendFill").PrE2eTrendDays;
  children: (data: T) => React.ReactNode;
}) {
  const { days, setDays, data, loading, error } = usePrE2eRangeQuery<T>(
    metric,
    defaultDays,
  );
  return (
    <PrE2ePanel
      title={title}
      description={description}
      headerActions={
        <PrE2eRangePicker value={days} onChange={setDays} loading={loading} />
      }
    >
      {loading ? (
        <PanelLoading />
      ) : error ? (
        <PanelError message={error} />
      ) : (
        children(data as T)
      )}
    </PrE2ePanel>
  );
}

export function PrE2eAnalyticsTopFailingPanel() {
  const { data, loading, error } = usePrE2eRangeQuery<TopFailingCompareRow[]>(
    "topFailingCompare",
    30,
  );
  return (
    <PrE2ePanel
      title="Top failing tests (7d vs 30d)"
      description={`Fixed 7d / 30d comparison — not controlled by range. Up to ${PR_E2E_ANALYTICS_MAX_ROWS} rows.`}
    >
      {loading ? (
        <PanelLoading />
      ) : error ? (
        <PanelError message={error} />
      ) : (
        <PrE2eTopFailingCompare rows={data ?? []} />
      )}
    </PrE2ePanel>
  );
}

export function PrE2eAnalyticsHeatmapPanel() {
  const { data, loading, error } = usePrE2eRangeQuery<PrE2eHeatmapCell[]>(
    "heatmap",
    30,
  );
  return (
    <PrE2ePanel
      title="Failure heatmap"
      description="Top tests × date over the last 30 days — hover cells for full test name and count."
    >
      {loading ? (
        <PanelLoading />
      ) : error ? (
        <PanelError message={error} />
      ) : (
        <PrE2eHeatmapGrid cells={data ?? []} />
      )}
    </PrE2ePanel>
  );
}

export function PrE2eAnalyticsFailuresByModulePanel() {
  return (
    <RangePanel<PrE2eNamedCount[]>
      title="Failures by module"
      metric="failuresByModule"
    >
      {(rows) => <PrE2eBarChartSimple data={rows ?? []} />}
    </RangePanel>
  );
}

export function PrE2eAnalyticsPassRateByEnvPanel() {
  return (
    <RangePanel<PrE2eNamedCount[]>
      title="Pass rate by env"
      description="k8s-sdet-02 and k8s-sdet-05 shown separately; all other env_suffix values in the selected range roll up as ephemeral (PR-scoped clusters)."
      metric="passRateByEnv"
    >
      {(rows) => (
        <PrE2eNamedCountTable
          rows={rows ?? []}
          nameHeader="Env"
          countHeader="Runs"
          showExtra
          extraHeader="Avg pass %"
        />
      )}
    </RangePanel>
  );
}

export function PrE2eAnalyticsFailuresByAuthorPanel() {
  return (
    <RangePanel<PrE2eNamedCount[]>
      title="Failures by git author"
      metric="failuresByAuthor"
    >
      {(rows) => <PrE2eBarChartSimple data={rows ?? []} layout="horizontal" />}
    </RangePanel>
  );
}

export function PrE2eIngestTrendPanel() {
  return (
    <RangePanel<{ label: string; ok: number; error: number; skipped: number }[]>
      title="Ingest success rate over time"
      description="ok vs error vs skipped_duplicate per day."
      metric="ingestTrend"
    >
      {(rows) => (
        <div className={dashboardUi.chartWell}>
          <PrE2eIngestCharts ingestTrend={rows ?? []} />
        </div>
      )}
    </RangePanel>
  );
}
