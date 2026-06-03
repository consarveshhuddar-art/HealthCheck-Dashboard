"use client";

import { DashboardNavLink } from "@/components/DashboardNavLink";
import { PrE2eScrollRegion } from "@/components/prE2e/PrE2eScrollRegion";
import { PrE2eTestTags } from "@/components/prE2e/PrE2eTestTags";
import type { PrE2eTestHistoryRow } from "@/lib/prE2e/data";
import { formatPrE2eDateTimeIst } from "@/lib/prE2e/format";
import { serviceHref, testHistoryHref } from "@/lib/prE2e/types";

export function PrE2eFailureHistoryList({
  history,
  emptyMessage,
  showAuthor = false,
}: {
  history: PrE2eTestHistoryRow[];
  emptyMessage: string;
  showAuthor?: boolean;
}) {
  if (!history.length) {
    return (
      <p className="py-8 text-center text-sm text-[#94A3B8]">{emptyMessage}</p>
    );
  }

  return (
    <PrE2eScrollRegion>
      <ul className="divide-y divide-[#EAEFF5]">
        {history.map((row) => (
          <li key={row.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <DashboardNavLink
                href={testHistoryHref(row.test_name)}
                className="font-medium text-violet-800 underline"
              >
                {row.test_name}
              </DashboardNavLink>
              <span className="text-[#94A3B8]">·</span>
              <DashboardNavLink
                href={serviceHref(row.service_repo)}
                className="text-violet-800 underline"
              >
                {row.service_repo}
              </DashboardNavLink>
              <span className="text-[#94A3B8]">#{row.e2e_build_number}</span>
              <span
                className="rounded border border-sky-200/60 bg-sky-50/80 px-1.5 py-0.5 text-[10px] text-sky-900"
                title={
                  row.env_suffix
                    ? `env_suffix: ${row.env_suffix}`
                    : "No env_suffix on run"
                }
              >
                {row.env_group}
              </span>
              {showAuthor && row.git_author !== "unknown" ? (
                <span className="rounded border border-[#EAEFF5] bg-white px-1.5 py-0.5 text-[10px] text-[#64748B]">
                  {row.git_author}
                </span>
              ) : null}
              <span className="rounded border border-[#EAEFF5] px-1.5 py-0.5 text-[10px] capitalize">
                {row.status}
              </span>
              <span className="rounded border border-[#EAEFF5] px-1.5 py-0.5 text-[10px]">
                {row.classification}
              </span>
              <span className="text-[#94A3B8]">
                {formatPrE2eDateTimeIst(row.created_at) ?? row.created_at}
              </span>
            </div>
            <PrE2eTestTags tags={row.tags} className="mt-1.5" />
            {row.error_message ? (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-[#F9FAFB] p-2 font-mono text-[10px] text-[#64748B] whitespace-pre-wrap">
                {row.error_message.slice(0, 1500)}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
    </PrE2eScrollRegion>
  );
}
