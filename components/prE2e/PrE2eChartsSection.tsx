"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PrE2eDailyPoint, PrE2eServicePoint } from "@/lib/prE2e/types";
import { dashboardUi } from "@/lib/dashboardUi";

const H = 220;

export function PrE2eChartsSection({
  daily,
  byService,
}: {
  daily: PrE2eDailyPoint[];
  byService: PrE2eServicePoint[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={dashboardUi.panel}>
        <div className={dashboardUi.panelHeaderDivider}>
          <h2 className={dashboardUi.panelTitle}>E2E runs per day (IST)</h2>
          <p className={dashboardUi.panelDesc}>
            Passed vs failed Jenkins outcomes — last 30 days.
          </p>
        </div>
        <div className={dashboardUi.chartWell}>
          {daily.length ? (
            <ResponsiveContainer width="100%" height={H}>
              <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="passed" stackId="a" fill="#10b981" name="Passed" />
                <Bar dataKey="failed" stackId="a" fill="#f43f5e" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-[#94A3B8]">No trend data yet.</p>
          )}
        </div>
      </section>

      <section className={dashboardUi.panel}>
        <div className={dashboardUi.panelHeaderDivider}>
          <h2 className={dashboardUi.panelTitle}>Failures by service</h2>
          <p className={dashboardUi.panelDesc}>
            Failed tests per service (last 30 days). Uses Allure counts or Jenkins
            outcome when per-test rows are not ingested yet.
          </p>
        </div>
        <div className={dashboardUi.chartWell}>
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
                <Bar dataKey="failures" fill="#8b5cf6" name="Failures" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-[#94A3B8]">No failure breakdown yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
