"use client";

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

export function DashboardTopNav({ alerts }: { alerts: CredentialAlertCounts | null }) {
  const pathname = usePathname();
  const navigate = useDashboardNavigate();
  const onHealth = pathname === "/";
  const onCredentials = pathname === "/credentials";
  const onPrChecks = pathname.startsWith("/pr-checks");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
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
        <button
          type="button"
          aria-current={onPrChecks ? "page" : undefined}
          className={navTabClass(onPrChecks)}
          onClick={() => navigate("/pr-checks")}
        >
          PR E2E checks
        </button>
      </nav>
      <CredentialsBell alerts={alerts} />
    </div>
  );
}
