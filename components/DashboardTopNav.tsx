"use client";

import { usePathname } from "next/navigation";
import { DashboardNavButton } from "@/components/DashboardNavButton";
import { CredentialsBell } from "@/components/CredentialsBell";
import type { CredentialAlertCounts } from "@/lib/types";

function navTabClass(active: boolean) {
  return `rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150 ease-out sm:px-3 ${
    active
      ? "bg-white text-[#0B1220] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[#EAEFF5]"
      : "text-[#64748B] hover:bg-[#F9FAFB] hover:text-[#334155]"
  }`;
}

export function DashboardTopNav({ alerts }: { alerts: CredentialAlertCounts | null }) {
  const pathname = usePathname();
  const onHealth = pathname === "/";
  const onCredentials = pathname === "/credentials";
  const onPrChecks = pathname.startsWith("/pr-checks");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <nav
        className="inline-flex items-center gap-2 rounded-[10px] border border-[#EAEFF5] bg-[#F9FAFB] p-1"
        aria-label="Dashboard sections"
      >
        <DashboardNavButton
          href="/"
          aria-current={onHealth ? "page" : undefined}
          className={navTabClass(onHealth)}
        >
          Health checks
        </DashboardNavButton>
        <DashboardNavButton
          href="/credentials"
          aria-current={onCredentials ? "page" : undefined}
          className={navTabClass(onCredentials)}
        >
          Credential expiry
        </DashboardNavButton>
        <DashboardNavButton
          href="/pr-checks"
          aria-current={onPrChecks ? "page" : undefined}
          className={navTabClass(onPrChecks)}
        >
          PR E2E checks
        </DashboardNavButton>
      </nav>
      <CredentialsBell alerts={alerts} />
    </div>
  );
}
