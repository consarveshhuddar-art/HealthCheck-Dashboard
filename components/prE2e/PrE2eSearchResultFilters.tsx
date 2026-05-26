"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function PrE2eSearchResultFilters({
  tagQuery,
  services,
  authors,
  initialService = "",
  initialAuthor = "",
  resultCount,
  totalCount,
}: {
  tagQuery: string;
  services: string[];
  authors: string[];
  initialService?: string;
  initialAuthor?: string;
  resultCount: number;
  totalCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (service: string, author: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("q", tagQuery);
      if (service) next.set("service", service);
      else next.delete("service");
      if (author) next.set("author", author);
      else next.delete("author");
      const qs = next.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, router, searchParams, tagQuery],
  );

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-[10px] border border-[#EAEFF5] bg-[#F9FAFB] p-3">
      <label className="text-[10px] font-medium uppercase text-[#94A3B8]">
        Service
        <select
          value={initialService}
          disabled={pending}
          onChange={(e) => apply(e.target.value, initialAuthor)}
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
      <label className="text-[10px] font-medium uppercase text-[#94A3B8]">
        Git author
        <select
          value={initialAuthor}
          disabled={pending}
          onChange={(e) => apply(initialService, e.target.value)}
          className="mt-1 block min-w-[10rem] rounded-md border border-[#EAEFF5] bg-white px-2 py-1.5 text-[12px]"
        >
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <p className="ml-auto text-[11px] text-[#94A3B8]">
        {resultCount === totalCount
          ? `${resultCount} row(s)`
          : `${resultCount} of ${totalCount} row(s)`}
      </p>
    </div>
  );
}
