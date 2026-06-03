import type { ReactNode } from "react";

const SCROLL_COLLAPSED =
  "max-h-[min(420px,55vh)] overflow-auto overscroll-contain";
const SCROLL_EXPANDED = "max-h-none overflow-visible";

/** Scrollable body for analytics panels — caps visual height while showing up to 50 rows. */
export function PrE2eScrollRegion({
  children,
  className = "",
  expanded = false,
  collapsedClass = SCROLL_COLLAPSED,
}: {
  children: ReactNode;
  className?: string;
  /** When true, show the full grid (page scrolls); when false, capped scroll area. */
  expanded?: boolean;
  /** Override collapsed scroll cap (default shared analytics height). */
  collapsedClass?: string;
}) {
  return (
    <div
      className={`${expanded ? SCROLL_EXPANDED : collapsedClass} ${className}`}
    >
      {children}
    </div>
  );
}
