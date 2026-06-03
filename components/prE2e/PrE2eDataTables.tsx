"use client";

import type { ReactNode } from "react";
import { DashboardNavLink } from "@/components/DashboardNavLink";
import type {
  PrE2eFingerprintRow,
  PrE2eHeatmapCell,
  PrE2eIngestError,
  PrE2eNamedCount,
  PrE2eServiceHealth,
} from "@/lib/prE2e/types";
import { serviceHref, testHistoryHref } from "@/lib/prE2e/types";
import { passRateCellClass } from "@/lib/prE2e/chartColors";
import { formatIngestErrorMessage } from "@/lib/prE2e/format";
import { PrE2eScrollRegion } from "@/components/prE2e/PrE2eScrollRegion";
import { PR_E2E_ANALYTICS_MAX_ROWS } from "@/lib/prE2e/limits";
import { dashboardUi } from "@/lib/dashboardUi";

const ragColors = {
  green: "bg-emerald-50 text-emerald-900 border-emerald-200/50",
  amber: "bg-amber-50 text-amber-900 border-amber-200/50",
  red: "bg-rose-50 text-rose-900 border-rose-200/50",
};

export function PrE2eNamedCountTable({
  rows,
  nameHeader = "Name",
  countHeader = "Count",
  linkTests = false,
  linkServices = false,
  showExtra = false,
  extraHeader = "Pass %",
}: {
  rows: PrE2eNamedCount[];
  nameHeader?: string;
  countHeader?: string;
  linkTests?: boolean;
  linkServices?: boolean;
  showExtra?: boolean;
  extraHeader?: string;
}) {
  if (!rows.length) {
    return <EmptyState message="No data in this range." />;
  }
  const visible = rows.slice(0, PR_E2E_ANALYTICS_MAX_ROWS);
  return (
    <PrE2eScrollRegion>
      <table className="w-full min-w-[320px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#EAEFF5] bg-[#F9FAFB] text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
            <th className="px-3 py-2">{nameHeader}</th>
            <th className="px-3 py-2 text-right">{countHeader}</th>
            {showExtra ? (
              <th className="px-3 py-2 text-right">{extraHeader}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr
              key={`${row.name}-${i}`}
              className={`border-b border-[#EAEFF5] ${i % 2 ? "bg-[#F9FAFB]/80" : "bg-white"}`}
            >
              <td className="max-w-[280px] truncate px-3 py-2" title={row.name}>
                {linkTests ? (
                  <DashboardNavLink
                    href={testHistoryHref(row.name)}
                    className="text-violet-800 underline decoration-violet-200/60"
                  >
                    {row.name}
                  </DashboardNavLink>
                ) : linkServices ? (
                  <DashboardNavLink
                    href={serviceHref(row.name)}
                    className="text-violet-800 underline decoration-violet-200/60"
                  >
                    {row.name}
                  </DashboardNavLink>
                ) : (
                  row.name
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
              {showExtra ? (
                <td
                  className={`px-3 py-2 text-right tabular-nums ${passRateCellClass(row.extra)}`}
                >
                  {row.extra != null ? `${row.extra}%` : "—"}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </PrE2eScrollRegion>
  );
}

export function PrE2eFingerprintTable({ rows }: { rows: PrE2eFingerprintRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState message="No error fingerprints in this range. Fingerprints are hashed from Allure error_message during ingest — re-run ingest after pr_e2e_failures rows exist." />
    );
  }
  const visible = rows.slice(0, PR_E2E_ANALYTICS_MAX_ROWS);
  return (
    <PrE2eScrollRegion>
      <ul className="divide-y divide-[#EAEFF5]">
      {visible.map((row) => (
        <li key={row.fingerprint} className="py-3 px-1">
          <div className="flex items-center justify-between gap-2">
            <code className="text-[10px] text-violet-800">{row.fingerprint.slice(0, 16)}…</code>
            <span className="shrink-0 rounded bg-rose-50 px-2 py-0.5 text-[11px] tabular-nums text-rose-900">
              {row.count}×
            </span>
          </div>
          {row.sampleMessage ? (
            <p className="mt-1 line-clamp-2 font-mono text-[10px] text-[#64748B]">
              {row.sampleMessage}
            </p>
          ) : null}
        </li>
      ))}
      </ul>
    </PrE2eScrollRegion>
  );
}

export function PrE2eServiceHealthTable({ rows }: { rows: PrE2eServiceHealth[] }) {
  if (!rows.length) return <EmptyState message="No service runs yet." />;
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#EAEFF5] bg-[#F9FAFB] text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Service</th>
            <th className="px-3 py-2 text-right">Runs (30d)</th>
            <th className="px-3 py-2 text-right">Pass %</th>
            <th className="px-3 py-2 text-right">Flaky</th>
            <th className="px-3 py-2">Last result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.service}
              className={`border-b border-[#EAEFF5] hover:bg-[#F6F8FB] ${i % 2 ? "bg-[#F9FAFB]/80" : "bg-white"}`}
            >
              <td className="px-3 py-2">
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] capitalize ${ragColors[row.rag]}`}
                >
                  {row.rag}
                </span>
              </td>
              <td className="px-3 py-2">
                <DashboardNavLink
                  href={serviceHref(row.service)}
                  className="font-medium text-violet-800 underline"
                >
                  {row.service}
                </DashboardNavLink>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.runs}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.passRate != null ? `${row.passRate}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.flakyCount}</td>
              <td className="px-3 py-2 text-[#64748B]">{row.lastResult}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrE2eHeatmapGrid({ cells }: { cells: PrE2eHeatmapCell[] }) {
  if (!cells.length) return <EmptyState message="Not enough failure history for heatmap." />;

  const dates = [...new Set(cells.map((c) => c.date))];
  const tests = [...new Set(cells.map((c) => c.test))];
  const max = Math.max(...cells.map((c) => c.count), 1);
  const lookup = new Map(cells.map((c) => [`${c.date}|${c.test}`, c.count]));

  const visibleTests = tests.slice(0, PR_E2E_ANALYTICS_MAX_ROWS);

  return (
    <PrE2eScrollRegion>
      <table className="border-collapse text-[9px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-1 py-1 text-left text-[#94A3B8]" />
            {dates.map((d) => (
              <th key={d} className="px-0.5 py-1 font-normal text-[#94A3B8]">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleTests.map((test) => (
            <tr key={test}>
              <td
                className="sticky left-0 z-10 max-w-[200px] truncate bg-white px-1 py-0.5 text-[#64748B]"
                title={test}
              >
                <DashboardNavLink
                  href={testHistoryHref(test)}
                  className="hover:underline"
                  title={test}
                >
                  {test.length > 36 ? `${test.slice(0, 36)}…` : test}
                </DashboardNavLink>
              </td>
              {dates.map((d) => {
                const c = lookup.get(`${d}|${test}`) ?? 0;
                const intensity = c / max;
                return (
                  <td key={d} className="p-0.5">
                    <div
                      title={`${test} · ${d}: ${c} failure(s)`}
                      className="h-5 w-5 rounded-sm"
                      style={{
                        backgroundColor:
                          c === 0
                            ? "#F1F5F9"
                            : `rgba(244, 63, 94, ${0.15 + intensity * 0.85})`,
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </PrE2eScrollRegion>
  );
}

export function PrE2eIngestErrorsTable({ rows }: { rows: PrE2eIngestError[] }) {
  if (!rows.length) return <EmptyState message="No ingest errors." />;
  return (
    <ul className="divide-y divide-[#EAEFF5]">
      {rows.map((row) => (
        <li key={row.id} className="py-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded border border-rose-200/50 bg-rose-50 px-1.5 py-0.5 text-rose-900">
              {row.status}
            </span>
            <span className="font-medium">{row.e2e_job_name}</span>
            <span className="text-[#94A3B8]">#{row.build_number}</span>
            <span className="text-[#94A3B8]">
              {new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ")}
            </span>
          </div>
          {row.message ? (
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-[#64748B]">
              {formatIngestErrorMessage(row.message)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-[#94A3B8]">{message}</p>
  );
}

export function PrE2ePanel({
  title,
  description,
  headerActions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${dashboardUi.panel} ${className}`}>
      <div className={dashboardUi.panelHeaderDivider}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={dashboardUi.panelTitle}>{title}</h2>
            {description ? (
              <p className={dashboardUi.panelDesc}>{description}</p>
            ) : null}
          </div>
          {headerActions ? (
            <div className="shrink-0">{headerActions}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
