"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LoaderSpinner } from "@/components/LoaderSpinner";
import { PrE2eRangePicker } from "@/components/prE2e/PrE2eRangePicker";
import { PrE2eFailuresByServiceChart } from "@/components/prE2e/PrE2eFailuresByServiceChart";
import { PrE2eScrollRegion } from "@/components/prE2e/PrE2eScrollRegion";
import { useOverviewCharts } from "@/components/prE2e/PrE2eOverviewChartsContext";
import { usePrE2eRangeQuery } from "@/components/prE2e/usePrE2eRangeQuery";
import { PR_E2E_TREND_DAYS_DEFAULT, type PrE2eTrendDays } from "@/lib/prE2e/trendFill";
import { PR_E2E_ANALYTICS_MAX_ROWS } from "@/lib/prE2e/limits";
import type {
  PrE2eDailyPoint,
  PrE2eDurationPoint,
  PrE2eNamedCount,
  PrE2ePassRatePoint,
  PrE2eServicePoint,
  PrE2eTestCountPoint,
} from "@/lib/prE2e/types";
import { dashboardUi } from "@/lib/dashboardUi";
import { prE2eChartColors } from "@/lib/prE2e/chartColors";

const H = 200;
const C = prE2eChartColors;

export function PrE2eChartPanel({
  title,
  description,
  headerActions,
  children,
}: {
  title: string;
  description: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={dashboardUi.panel}>
      <div className={dashboardUi.panelHeaderDivider}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={dashboardUi.panelTitle}>{title}</h2>
            <p className={dashboardUi.panelDesc}>{description}</p>
          </div>
          {headerActions ? (
            <div className="shrink-0">{headerActions}</div>
          ) : null}
        </div>
      </div>
      <div className={dashboardUi.chartWell}>{children}</div>
    </section>
  );
}

export function EmptyChart() {
  return (
    <p className="py-12 text-center text-sm text-[#94A3B8]">No trend data yet.</p>
  );
}

export function ChartLoading() {
  return (
    <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#94A3B8]">
      <LoaderSpinner size="md" />
      Loading…
    </p>
  );
}

export function ChartError({ message }: { message: string }) {
  return (
    <p className="py-12 text-center text-sm text-rose-700">{message}</p>
  );
}

export function RangePicker({
  days,
  setDays,
  loading,
}: {
  days: number;
  setDays: (d: import("@/lib/prE2e/trendFill").PrE2eTrendDays) => void;
  loading: boolean;
}) {
  return (
    <PrE2eRangePicker
      value={days as import("@/lib/prE2e/trendFill").PrE2eTrendDays}
      onChange={setDays}
      loading={loading}
    />
  );
}

/** @deprecated Use PrE2eOverviewRangeCharts */
export function PrE2eTrendChartsSection(props: {
  stabilityDist?: PrE2eNamedCount[];
}) {
  return <PrE2eOverviewRangeCharts stabilityDist={props.stabilityDist ?? []} />;
}

export function PrE2eOverviewTrendCharts() {
  const [days, setDays] = useState<PrE2eTrendDays>(PR_E2E_TREND_DAYS_DEFAULT);
  const range = { days, setDays };

  const passRate = usePrE2eRangeQuery<PrE2ePassRatePoint[]>(
    "passRateTrend",
    PR_E2E_TREND_DAYS_DEFAULT,
    range,
  );
  const testCount = usePrE2eRangeQuery<PrE2eTestCountPoint[]>(
    "testCountTrend",
    PR_E2E_TREND_DAYS_DEFAULT,
    range,
  );
  const duration = usePrE2eRangeQuery<PrE2eDurationPoint[]>(
    "durationTrend",
    PR_E2E_TREND_DAYS_DEFAULT,
    range,
  );
  const daily = usePrE2eRangeQuery<PrE2eDailyPoint[]>(
    "daily",
    PR_E2E_TREND_DAYS_DEFAULT,
    range,
  );

  const passRateTrend = passRate.data ?? [];
  const testCountTrend = testCount.data ?? [];
  const durationTrend = duration.data ?? [];
  const dailyData = daily.data ?? [];

  const hasPassTrend = passRateTrend.some((p) => p.runs > 0 || p.passRate != null);
  const rangeLoading =
    passRate.loading ||
    testCount.loading ||
    duration.loading ||
    daily.loading;

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <RangePicker days={days} setDays={setDays} loading={rangeLoading} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
        <PrE2eChartPanel
          title="Pass rate over time"
          description="Daily average Allure pass % with run volume overlay. Gaps = no runs that day."
        >
          {passRate.loading ? (
            <ChartLoading />
          ) : passRate.error ? (
            <ChartError message={passRate.error} />
          ) : hasPassTrend ? (
            <ResponsiveContainer width="100%" height={H}>
              <ComposedChart data={passRateTrend} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="right" dataKey="runs" fill={C.volume} name="Runs" opacity={0.35} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="passRate"
                  stroke={C.pass}
                  strokeWidth={2}
                  name="Pass %"
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </PrE2eChartPanel>
        </div>
        <div className="lg:col-span-2">
        <PrE2eChartPanel
          title="E2E runs per day (pass/fail)"
          description="Passed vs failed Jenkins outcomes."
        >
          {daily.loading ? (
            <ChartLoading />
          ) : daily.error ? (
            <ChartError message={daily.error} />
          ) : dailyData.length ? (
            <ResponsiveContainer width="100%" height={H}>
              <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="passed" stackId="a" fill={C.pass} name="Passed" />
                <Bar dataKey="failed" stackId="a" fill={C.failure} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </PrE2eChartPanel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PrE2eChartPanel
          title="Test count trends"
          description="Sum of passed / failed / broken / skipped across runs per day."
        >
          {testCount.loading ? (
            <ChartLoading />
          ) : testCount.error ? (
            <ChartError message={testCount.error} />
          ) : testCountTrend.length ? (
            <ResponsiveContainer width="100%" height={H}>
              <AreaChart data={testCountTrend} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="passed"
                  stackId="1"
                  fill={C.passFill}
                  stroke={C.pass}
                  name="Passed"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stackId="1"
                  fill={C.failure}
                  stroke={C.failure}
                  fillOpacity={0.5}
                  name="Failed"
                />
                <Area
                  type="monotone"
                  dataKey="broken"
                  stackId="1"
                  fill={C.broken}
                  stroke={C.broken}
                  fillOpacity={0.5}
                  name="Broken"
                />
                <Area
                  type="monotone"
                  dataKey="skipped"
                  stackId="1"
                  fill={C.skipped}
                  stroke={C.skipped}
                  fillOpacity={0.4}
                  name="Skipped"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </PrE2eChartPanel>

        <PrE2eChartPanel
          title="Avg E2E duration"
          description="Mean e2e_duration_ms per day — detects suite bloat or infra slowdown."
        >
          {duration.loading ? (
            <ChartLoading />
          ) : duration.error ? (
            <ChartError message={duration.error} />
          ) : durationTrend.length ? (
            <ResponsiveContainer width="100%" height={H}>
              <LineChart data={durationTrend} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    v >= 60000 ? `${Math.round(v / 60000)}m` : `${Math.round(v / 1000)}s`
                  }
                />
                <Tooltip
                  formatter={(v) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (!Number.isFinite(n)) return "—";
                    return n >= 60000
                      ? `${(n / 60000).toFixed(1)} min`
                      : `${(n / 1000).toFixed(0)} sec`;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgMs"
                  stroke={C.duration}
                  name="Avg duration"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </PrE2eChartPanel>
      </div>
    </div>
  );
}

export function PrE2eOverviewBreakdownCharts({
  stabilityDist,
}: {
  stabilityDist: PrE2eNamedCount[];
}) {
  const { byService, runsByTrigger } = useOverviewCharts();
  const byServiceData = byService.data ?? [];
  const runsByTriggerData = runsByTrigger.data ?? [];

  return (
    <div className="space-y-4">
      <PrE2eChartPanel
        title="Failures by service"
        description="Which services contribute the most failed tests in the selected range."
        headerActions={
          <RangePicker
            days={byService.days}
            setDays={byService.setDays}
            loading={byService.loading}
          />
        }
      >
        {byService.loading ? (
          <ChartLoading />
        ) : byService.error ? (
          <ChartError message={byService.error} />
        ) : byServiceData.length ? (
          <PrE2eFailuresByServiceChart data={byServiceData} />
        ) : (
          <EmptyChart />
        )}
      </PrE2eChartPanel>

      <div className="grid gap-4 lg:grid-cols-2">
          <PrE2eChartPanel
            title="Runs by trigger"
            description="How E2E jobs are started."
            headerActions={
              <RangePicker
                days={runsByTrigger.days}
                setDays={runsByTrigger.setDays}
                loading={runsByTrigger.loading}
              />
            }
          >
            {runsByTrigger.loading ? (
              <ChartLoading />
            ) : runsByTrigger.error ? (
              <ChartError message={runsByTrigger.error} />
            ) : runsByTriggerData.length ? (
              <ResponsiveContainer width="100%" height={H}>
                <PieChart>
                  <Pie
                    data={runsByTriggerData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {runsByTriggerData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "unknown"
                            ? C.unknown
                            : [C.pass, C.flaky, C.failure, C.broken][i % 4]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </PrE2eChartPanel>

            <PrE2eChartPanel
              title="Stability distribution"
              description="30-day test labels across all services (fixed window)."
            >
              {stabilityDist.length ? (
              <ResponsiveContainer width="100%" height={H}>
                <PieChart>
                  <Pie
                    data={stabilityDist}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={72}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {stabilityDist.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "flaky"
                            ? C.flaky
                            : entry.name === "failing"
                              ? C.failure
                              : C.pass
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </PrE2eChartPanel>
      </div>
    </div>
  );
}

/** @deprecated Use PrE2eOverviewTrendCharts + PrE2eOverviewBreakdownCharts */
export function PrE2eOverviewRangeCharts({
  stabilityDist,
}: {
  stabilityDist: PrE2eNamedCount[];
}) {
  return (
    <>
      <PrE2eOverviewTrendCharts />
      <PrE2eOverviewBreakdownCharts stabilityDist={stabilityDist} />
    </>
  );
}

export function PrE2eStabilityDonut({ data }: { data: PrE2eNamedCount[] }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={36}
          outerRadius={64}
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={
                entry.name === "flaky"
                  ? C.flaky
                  : entry.name === "failing"
                    ? C.failure
                    : C.pass
              }
            />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PrE2eIngestCharts({
  ingestTrend,
}: {
  ingestTrend: { label: string; ok: number; error: number; skipped: number }[];
}) {
  if (!ingestTrend.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={H}>
      <BarChart data={ingestTrend} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="ok" stackId="a" fill={C.pass} name="OK" />
        <Bar dataKey="error" stackId="a" fill={C.failure} name="Error" />
        <Bar dataKey="skipped" stackId="a" fill={C.flaky} name="Skipped dup" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PrE2eBarChartSimple({
  data,
  layout = "vertical",
}: {
  data: PrE2eNamedCount[];
  layout?: "vertical" | "horizontal";
}) {
  if (!data.length) return <EmptyChart />;
  const visible = data.slice(0, PR_E2E_ANALYTICS_MAX_ROWS);
  const chartHeight = Math.min(Math.max(visible.length * 28, 160), 420);

  if (layout === "vertical") {
    return (
      <PrE2eScrollRegion>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={visible}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 80, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 9 }} />
            <Tooltip />
            <Bar dataKey="count" fill={C.unknown} name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </PrE2eScrollRegion>
    );
  }
  return (
    <PrE2eScrollRegion>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={visible} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={48} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" fill={C.unknown} />
        </BarChart>
      </ResponsiveContainer>
    </PrE2eScrollRegion>
  );
}
