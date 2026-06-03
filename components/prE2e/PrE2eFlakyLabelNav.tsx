"use client";

import { DashboardNavLink } from "@/components/DashboardNavLink";

export function PrE2eFlakyLabelNav({
  activeLabel,
  counts,
  className = "mb-4",
}: {
  activeLabel?: "flaky" | "failing" | "stable";
  counts: { all: number; flaky: number; failing: number; stable: number };
  className?: string;
}) {
  const tabs = [
    { tab: "all" as const, label: "All", n: counts.all },
    { tab: "flaky" as const, label: "Flaky", n: counts.flaky },
    { tab: "failing" as const, label: "Failing", n: counts.failing },
    { tab: "stable" as const, label: "Stable", n: counts.stable },
  ];

  return (
    <nav
      className={`flex flex-wrap gap-2 text-[11px] ${className}`}
      aria-label="Stability label"
    >
      {tabs.map(({ tab, label: tabLabel, n }) => {
        const params = new URLSearchParams();
        if (tab !== "all") params.set("label", tab);
        const q = params.toString();
        const href = q ? `/pr-checks/flaky?${q}` : "/pr-checks/flaky";
        const active =
          (tab === "all" && !activeLabel) ||
          (tab !== "all" && activeLabel === tab);
        return (
          <DashboardNavLink
            key={tab}
            href={href}
            className={`rounded-md border px-3 py-1.5 font-medium capitalize ${
              active
                ? "border-violet-200 bg-violet-50 text-violet-900"
                : "border-[#EAEFF5] bg-white text-[#64748B] hover:bg-[#F9FAFB]"
            }`}
          >
            {tabLabel} ({n})
          </DashboardNavLink>
        );
      })}
    </nav>
  );
}
