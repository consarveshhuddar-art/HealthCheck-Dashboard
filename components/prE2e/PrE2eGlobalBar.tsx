"use client";

import { useSearchParams } from "next/navigation";
import { DashboardNavButton } from "@/components/DashboardNavButton";
import { DashboardNavLink } from "@/components/DashboardNavLink";
import { useDashboardNavigate } from "@/components/DashboardNavProvider";
import { useDashboardNavState } from "@/components/DashboardNavProvider";

export function PrE2eGlobalBar() {
  const searchParams = useSearchParams();
  const navigate = useDashboardNavigate();
  const { isNavigatingToPath } = useDashboardNavState();
  const q = searchParams.get("q") ?? "";

  const resultsHref = q
    ? `/pr-checks/tests?q=${encodeURIComponent(q)}`
    : "";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <form
        className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const term = String(fd.get("q") ?? "").trim();
          if (!term) return;
          navigate(`/pr-checks/tests?q=${encodeURIComponent(term)}`);
        }}
      >
        <input
          name="q"
          type="search"
          key={q}
          defaultValue={q}
          placeholder="Search by tags (@smoke @service_video)…"
          className="w-full rounded-md border border-[#EAEFF5] bg-white px-3 py-1.5 text-[12px] text-[#1F2937] placeholder:text-[#94A3B8] focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-200"
        />
        <DashboardNavButton
          type="submit"
          pendingPathPrefix="/pr-checks/tests"
          className="shrink-0 rounded-md border border-[#EAEFF5] bg-white px-3 py-1.5 text-[11px] font-medium text-violet-800 hover:bg-[#F9FAFB] disabled:opacity-60"
        >
          {isNavigatingToPath("/pr-checks/tests") ? "Searching…" : "Search"}
        </DashboardNavButton>
        {resultsHref ? (
          <DashboardNavLink
            href={resultsHref}
            className="shrink-0 text-[11px] text-violet-800 underline"
          >
            Results
          </DashboardNavLink>
        ) : null}
      </form>
    </div>
  );
}
