"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { DashboardNavButton } from "@/components/DashboardNavButton";
import { useDashboardNavigate } from "@/components/DashboardNavProvider";

export function PrE2eSearchResultFilters({
  tagQuery,
  services,
  initialService = "",
  resultCount,
  totalCount,
}: {
  tagQuery: string;
  services: string[];
  initialService?: string;
  resultCount: number;
  totalCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigate = useDashboardNavigate();

  const apply = useCallback(
    (service: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("q", tagQuery);
      if (service) next.set("service", service);
      else next.delete("service");
      next.delete("author");
      const qs = next.toString();
      navigate(qs ? `${pathname}?${qs}` : pathname);
    },
    [navigate, pathname, searchParams, tagQuery],
  );

  const filterHref = (service: string) => {
    const next = new URLSearchParams();
    next.set("q", tagQuery);
    if (service) next.set("service", service);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-[10px] border border-[#EAEFF5] bg-[#F9FAFB] p-3">
      <label className="text-[10px] font-medium uppercase text-[#94A3B8]">
        Service
        <select
          value={initialService}
          onChange={(e) => apply(e.target.value)}
          className="mt-1 block min-w-[10rem] rounded-md border border-[#EAEFF5] bg-white px-2 py-1.5 text-[12px]"
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {initialService && (
        <DashboardNavButton
          href={filterHref("")}
          className="rounded-md border border-[#EAEFF5] bg-white px-2.5 py-1.5 text-[11px] text-[#64748B] hover:bg-white"
        >
          Clear filters
        </DashboardNavButton>
      )}
      <p className="ml-auto text-[11px] text-[#94A3B8]">
        {resultCount === totalCount
          ? `${resultCount} row(s)`
          : `${resultCount} of ${totalCount} row(s)`}
      </p>
    </div>
  );
}
