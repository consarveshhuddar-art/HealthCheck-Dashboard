"use client";

import type { ReactNode } from "react";
import { DashboardNavLink } from "@/components/DashboardNavLink";

/** Internal PR-checks / dashboard link with nav loading spinner. */
export function PrE2ePageLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashboardNavLink href={href} className={className}>
      {children}
    </DashboardNavLink>
  );
}
