"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

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

function tabHref(path: string, searchParams: URLSearchParams, extra?: string) {
  const params = new URLSearchParams();
  const days = searchParams.get("days");
  if (days) params.set("days", days);
  if (extra) {
    for (const [k, v] of new URLSearchParams(extra)) params.set(k, v);
  }
  const q = params.toString();
  return q ? `${path}?${q}` : path;
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
            searchParams,
            tab.href.includes("flaky") ? extra : undefined,
          );
        return (
          <Link
            key={tab.href}
            href={href}
            className={`rounded-md border px-3 py-1.5 font-medium transition-colors ${
              active
                ? "border-violet-200 bg-violet-50 text-violet-900"
                : "border-[#EAEFF5] bg-white text-[#64748B] hover:bg-[#F9FAFB]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
