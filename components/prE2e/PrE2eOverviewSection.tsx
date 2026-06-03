import type { ReactNode } from "react";
import { dashboardUi } from "@/lib/dashboardUi";

export function PrE2eOverviewSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-6 ${className}`}>
      <header className="mb-3 border-b border-[#EAEFF5] pb-2">
        <h2 className={dashboardUi.sectionLabel}>{title}</h2>
        {description ? (
          <p className={dashboardUi.sectionDesc}>{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
