"use client";

import type { ReactNode } from "react";
import { DashboardTopNav } from "@/components/DashboardTopNav";
import type { CredentialAlertCounts } from "@/lib/types";

export function DashboardHeader({
  eyebrow,
  title,
  description,
  alerts,
  showCredentialsNav = true,
  trailing,
}: {
  eyebrow: string;
  title: string;
  description: string;
  alerts: CredentialAlertCounts | null;
  showCredentialsNav?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:mb-5">
      {showCredentialsNav ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DashboardTopNav alerts={alerts} />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#94A3B8]">
            {eyebrow}
          </p>
          <h1 className="mt-0.5 text-xl font-bold tracking-[-0.02em] text-[#0B1220] sm:text-[1.375rem]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-3xl text-[11px] leading-relaxed text-[#64748B]/85">
            {description}
          </p>
        </div>
        {trailing ? (
          <div className="shrink-0 self-start sm:self-center">{trailing}</div>
        ) : null}
      </div>
    </header>
  );
}
