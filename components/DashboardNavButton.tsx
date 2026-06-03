"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderSpinner } from "@/components/LoaderSpinner";
import {
  useDashboardNavigate,
  useDashboardNavState,
} from "@/components/DashboardNavProvider";

type DashboardNavButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  href?: string;
  children: ReactNode;
  /** Match navigation when pending target starts with this path (e.g. /pr-checks/tests). */
  pendingPathPrefix?: string;
};

export function DashboardNavButton({
  href,
  pendingPathPrefix,
  children,
  className = "",
  disabled,
  onClick,
  type = "button",
  ...rest
}: DashboardNavButtonProps) {
  const navigate = useDashboardNavigate();
  const { isNavigatingTo, isNavigatingToPath } = useDashboardNavState();

  const loading = href
    ? isNavigatingTo(href)
    : pendingPathPrefix
      ? isNavigatingToPath(pendingPathPrefix)
      : false;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && href) navigate(href);
      }}
      {...rest}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        {loading ? <LoaderSpinner size="sm" /> : null}
        {children}
      </span>
    </button>
  );
}
