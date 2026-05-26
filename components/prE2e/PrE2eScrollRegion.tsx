import type { ReactNode } from "react";

/** Scrollable body for analytics panels — caps visual height while showing up to 50 rows. */
export function PrE2eScrollRegion({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`max-h-[min(420px,55vh)] overflow-auto overscroll-contain ${className}`}
    >
      {children}
    </div>
  );
}
