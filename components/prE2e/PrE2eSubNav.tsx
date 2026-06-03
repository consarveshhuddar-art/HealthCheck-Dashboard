"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { DashboardNavLink } from "@/components/DashboardNavLink";

const TABS = [
  { href: "/pr-checks", label: "Overview", match: (p: string) => p === "/pr-checks" },
  {
    href: "/pr-checks/analytics",
    label: "Failures",
    match: (p: string) => p.startsWith("/pr-checks/analytics"),
  },
  {
    href: "/pr-checks/flaky",
    label: "Flakiness",
    match: (p: string) => p.startsWith("/pr-checks/flaky"),
  },
  {
    href: "/pr-checks/services",
    label: "Services",
    match: (p: string) => p.startsWith("/pr-checks/services"),
  },
  { href: "/pr-checks/runs", label: "Runs", match: (p: string) => p === "/pr-checks/runs" },
  {
    href: "/pr-checks/ingest",
    label: "Ingest",
    match: (p: string) => p.startsWith("/pr-checks/ingest"),
  },
] as const;

function tabHref(path: string, extra?: string) {
  if (!extra) return path;
  return `${path}?${extra}`;
}

export function PrE2eSubNav({ preserveParams = true }: { preserveParams?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const extra =
    preserveParams && searchParams.get("label")
      ? `label=${searchParams.get("label")}`
      : undefined;

  return (
    <nav className="flex flex-wrap gap-1.5 text-[11px]" aria-label="PR E2E sections">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const href = tabHref(
          tab.href,
          tab.href.includes("flaky") ? extra : undefined,
        );
        return (
          <DashboardNavLink
            key={tab.href}
            href={href}
            className={`rounded-md border px-3 py-1.5 font-medium transition-colors ${
              active
                ? "border-violet-200 bg-violet-50 text-violet-900"
                : "border-[#EAEFF5] bg-white text-[#64748B] hover:bg-[#F9FAFB]"
            }`}
          >
            {tab.label}
          </DashboardNavLink>
        );
      })}
    </nav>
  );
}
