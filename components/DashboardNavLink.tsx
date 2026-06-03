"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { LoaderSpinner } from "@/components/LoaderSpinner";
import {
  useDashboardNavigate,
  useDashboardNavState,
} from "@/components/DashboardNavProvider";

type DashboardNavLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "children"
> & {
  href: string;
  children: ReactNode;
};

export function DashboardNavLink({
  href,
  children,
  className = "",
  onClick,
  ...rest
}: DashboardNavLinkProps) {
  const navigate = useDashboardNavigate();
  const { isNavigatingTo } = useDashboardNavState();
  const loading = isNavigatingTo(href);

  return (
    <a
      href={href}
      aria-busy={loading}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      <span className="inline-flex items-center gap-1.5">
        {loading ? <LoaderSpinner size="sm" /> : null}
        {children}
      </span>
    </a>
  );
}
