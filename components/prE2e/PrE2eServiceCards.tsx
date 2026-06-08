"use client";

import { DashboardNavLink } from "@/components/DashboardNavLink";
import { PrE2eServiceSparkline } from "@/components/prE2e/PrE2eServiceSparkline";
import type { PrE2ePassRatePoint, PrE2eServiceHealth } from "@/lib/prE2e/types";
import { serviceHref } from "@/lib/prE2e/types";
import { prE2eBadgeStyles } from "@/lib/prE2e/chartColors";

const ragDot = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

export function PrE2eServiceCards({
  services,
  sparklines,
  days = 30,
}: {
  services: PrE2eServiceHealth[];
  sparklines: Record<string, PrE2ePassRatePoint[]>;
  days?: number;
}) {
  if (!services.length) {
    return (
      <p className="py-8 text-center text-sm text-[#94A3B8]">No service runs yet.</p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <DashboardNavLink
          key={s.service}
          href={serviceHref(s.service)}
          className="block rounded-[10px] border border-[#EAEFF5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${ragDot[s.rag]}`} />
                <h3 className="truncate font-semibold text-[#0B1220]">{s.service}</h3>
              </div>
              <p className="mt-1 text-[11px] text-[#94A3B8]">
                Last: {s.lastResult} · {s.runs} runs ({days}d)
              </p>
            </div>
            <PrE2eServiceSparkline data={sparklines[s.service] ?? []} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="tabular-nums text-[#1F2937]">
              Pass {s.passRate != null ? `${s.passRate}%` : "—"}
            </span>
            <span className={`rounded border px-1.5 py-0.5 ${prE2eBadgeStyles.flaky}`}>
              {s.flakyCount} flaky
            </span>
            <span className={`rounded border px-1.5 py-0.5 ${prE2eBadgeStyles.failing}`}>
              {s.failureCount} unique fails
            </span>
          </div>
        </DashboardNavLink>
      ))}
    </div>
  );
}
