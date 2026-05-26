"use client";

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
import { PrE2eScrollRegion } from "@/components/prE2e/PrE2eScrollRegion";
import { PR_E2E_ANALYTICS_MAX_ROWS } from "@/lib/prE2e/limits";
import type {
  PrE2eDailyPoint,
  PrE2eDurationPoint,
  PrE2eNamedCount,
  PrE2ePassRatePoint,
  PrE2eServicePoint,
  PrE2eTestCountPoint,
  PrE2eVolumePoint,
} from "@/lib/prE2e/types";
import { dashboardUi } from "@/lib/dashboardUi";
import { prE2eChartColors } from "@/lib/prE2e/chartColors";

const H = 200;
const C = prE2eChartColors;

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={dashboardUi.panel}>
      <div className={dashboardUi.panelHeaderDivider}>
        <h2 className={dashboardUi.panelTitle}>{title}</h2>
        <p className={dashboardUi.panelDesc}>{description}</p>
      </div>
      <div className={dashboardUi.chartWell}>{children}</div>
    </section>
  );
}

function EmptyChart() {
  return (
    <p className="py-12 text-center text-sm text-[#94A3B8]">No trend data yet.</p>
  );
}

export function PrE2eTrendChartsSection({
  daily,
  passRateTrend,
  volumeTrend,
  testCountTrend,
  durationTrend,
  byService,
  runsByTrigger,
  failuresByStatus,
  stabilityDist,
}: {
  daily: PrE2eDailyPoint[];
  passRateTrend: PrE2ePassRatePoint[];
  volumeTrend: PrE2eVolumePoint[];
  testCountTrend: PrE2eTestCountPoint[];
  durationTrend: PrE2eDurationPoint[];
  byService: PrE2eServicePoint[];
  runsByTrigger?: PrE2eNamedCount[];
  failuresByStatus?: PrE2eNamedCount[];
  stabilityDist?: PrE2eNamedCount[];
}) {
  const hasPassTrend = passRateTrend.some((p) => p.runs > 0 || p.passRate != null);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
        <ChartPanel
          title="Pass rate over time"
          description="Daily average Allure pass % with run volume overlay. Gaps = no runs that day."
        >
          {hasPassTrend ? (
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
        </ChartPanel>
        </div>
        <div className="lg:col-span-2">
        <ChartPanel
          title="Run volume by Jenkins result"
          description="Stacked daily outcomes: SUCCESS / FAILURE / UNSTABLE / ABORTED."
        >
          {volumeTrend.length ? (
            <ResponsiveContainer width="100%" height={H}>
              <BarChart data={volumeTrend} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" stackId="a" fill={C.pass} name="Success" />
                <Bar dataKey="failure" stackId="a" fill={C.failure} name="Failure" />
                <Bar dataKey="unstable" stackId="a" fill={C.flaky} name="Unstable" />
                <Bar dataKey="aborted" stackId="a" fill={C.aborted} name="Aborted" />
                <Bar dataKey="other" stackId="a" fill={C.unknown} name="Other" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartPanel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel
          title="Test count trends"
          description="Sum of passed / failed / broken / skipped across runs per day."
        >
          {testCountTrend.length ? (
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
        </ChartPanel>

        <ChartPanel
          title="Avg E2E duration"
          description="Mean e2e_duration_ms per day — detects suite bloat or infra slowdown."
        >
          {durationTrend.length ? (
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
        </ChartPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
        <ChartPanel
          title="E2E runs per day (pass/fail)"
          description="Passed vs failed Jenkins outcomes."
        >
          {daily.length ? (
            <ResponsiveContainer width="100%" height={H}>
              <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
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
        </ChartPanel>
        </div>
        <div className="lg:col-span-3">
        <ChartPanel
          title="Failures by service"
          description="Failed tests per service in selected range."
        >
          {byService.length ? (
            <ResponsiveContainer width="100%" height={H}>
              <BarChart
                data={byService}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 72, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="service"
                  width={68}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Bar dataKey="failures" fill={C.unknown} name="Failures" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartPanel>
        </div>
      </div>

      {(runsByTrigger?.length || failuresByStatus?.length || stabilityDist?.length) ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {runsByTrigger?.length ? (
            <ChartPanel title="Runs by trigger" description="How E2E jobs are started.">
              <ResponsiveContainer width="100%" height={H}>
                <PieChart>
                  <Pie
                    data={runsByTrigger}
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
                    {runsByTrigger.map((entry, i) => (
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
            </ChartPanel>
          ) : null}

          {failuresByStatus?.length ? (
            <ChartPanel
              title="Failed vs broken"
              description="Assertion failures vs infra/env issues."
            >
              <ResponsiveContainer width="100%" height={H}>
                <PieChart>
                  <Pie
                    data={failuresByStatus}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {failuresByStatus.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "failed"
                            ? C.failure
                            : entry.name === "broken"
                              ? C.broken
                              : C.unknown
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>
          ) : null}

          {stabilityDist?.length ? (
            <ChartPanel
              title="Stability distribution"
              description="30-day test labels across all services."
            >
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
            </ChartPanel>
          ) : null}
        </div>
      ) : null}
    </div>
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
