"use client";

import { DashboardNavLink } from "@/components/DashboardNavLink";
import { testHistoryHref } from "@/lib/prE2e/types";

export function PrE2eTestNameLink({
  name,
  className = "text-violet-800 underline",
}: {
  name: string;
  className?: string;
}) {
  return (
    <DashboardNavLink href={testHistoryHref(name)} className={className}>
      {name}
    </DashboardNavLink>
  );
}
