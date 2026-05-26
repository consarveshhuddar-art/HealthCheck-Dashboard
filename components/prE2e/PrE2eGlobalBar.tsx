"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

const RANGES = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
] as const;

function buildHref(pathname: string, params: URLSearchParams) {
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function PrE2eGlobalBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const days = searchParams.get("days") ?? "30";
  const q = searchParams.get("q") ?? "";

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      startTransition(() => {
        router.push(buildHref(pathname, next));
      });
    },
    [pathname, router, searchParams],
  );

  const goToTagSearch = useCallback(
    (raw: string) => {
      const term = raw.trim();
      if (!term) return;
      const params = new URLSearchParams();
      if (days !== "30") params.set("days", days);
      params.set("q", term);
      startTransition(() => {
        router.push(`/pr-checks/tests?${params.toString()}`);
      });
    },
    [router, days],
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
          Range
        </span>
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            disabled={pending}
            onClick={() => setParams({ days: r.key })}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              days === r.key
                ? "bg-[#0B1220] text-white"
                : "bg-[#F9FAFB] text-[#64748B] ring-1 ring-[#EAEFF5] hover:text-[#334155]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <form
        className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          goToTagSearch(String(fd.get("q") ?? ""));
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
        <button
          type="submit"
          className="shrink-0 rounded-md border border-[#EAEFF5] bg-white px-3 py-1.5 text-[11px] font-medium text-violet-800 hover:bg-[#F9FAFB]"
        >
          Search
        </button>
        {q ? (
          <Link
            href={`/pr-checks/tests?q=${encodeURIComponent(q)}`}
            className="shrink-0 text-[11px] text-violet-800 underline"
          >
            Results
          </Link>
        ) : null}
      </form>
    </div>
  );
}
