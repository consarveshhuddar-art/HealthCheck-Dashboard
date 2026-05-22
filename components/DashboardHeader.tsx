"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CredentialsBell } from "@/components/CredentialsBell";
import { useDashboardNavigate } from "@/components/DashboardNavProvider";
import type { CredentialAlertCounts } from "@/lib/types";

function navTabClass(active: boolean) {
  return `rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150 ease-out sm:px-3 ${
    active
      ? "bg-white text-[#0B1220] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[#EAEFF5]"
      : "text-[#64748B] hover:bg-[#F9FAFB] hover:text-[#334155]"
  }`;
}

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
  const pathname = usePathname();
  const navigate = useDashboardNavigate();
  const onHealth = pathname === "/";
  const onCredentials = pathname === "/credentials";

  return (
    <header className="mb-4 flex flex-col gap-3 sm:mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showCredentialsNav ? (
          <nav
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#EAEFF5] bg-[#F9FAFB] p-1"
            aria-label="Dashboard sections"
          >
            <button
              type="button"
              aria-current={onHealth ? "page" : undefined}
              className={navTabClass(onHealth)}
              onClick={() => navigate("/")}
            >
              Health checks
            </button>
            <button
              type="button"
              aria-current={onCredentials ? "page" : undefined}
              className={navTabClass(onCredentials)}
              onClick={() => navigate("/credentials")}
            >
              Credential expiry
            </button>
          </nav>
        ) : null}
        <CredentialsBell alerts={alerts} />
      </div>

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
