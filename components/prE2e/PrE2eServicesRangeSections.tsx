"use client";

import { LoaderSpinner } from "@/components/LoaderSpinner";
import { PrE2eServiceCards } from "@/components/prE2e/PrE2eServiceCards";
import { PrE2eServiceHealthTable, PrE2ePanel } from "@/components/prE2e/PrE2eDataTables";
import { PrE2eRangePicker } from "@/components/prE2e/PrE2eRangePicker";
import { usePrE2eRangeQuery } from "@/components/prE2e/usePrE2eRangeQuery";
import type { PrE2ePassRatePoint, PrE2eServiceHealth } from "@/lib/prE2e/types";
import { PR_E2E_TREND_DAYS_DEFAULT } from "@/lib/prE2e/trendFill";

export function PrE2eServicesHealthPanel({
  initialServices,
  sparklines,
}: {
  initialServices: PrE2eServiceHealth[];
  sparklines: Record<string, PrE2ePassRatePoint[]>;
}) {
  const { days, setDays, data, loading, error } = usePrE2eRangeQuery<PrE2eServiceHealth[]>(
    "serviceHealth",
    PR_E2E_TREND_DAYS_DEFAULT,
  );
  const services = data ?? initialServices;

  return (
    <>
      <PrE2ePanel title="Service cards" className="mb-4">
        <PrE2eServiceCards services={services} sparklines={sparklines} />
      </PrE2ePanel>

      <PrE2ePanel
        title="Comparison table"
        description="Run stats for the selected range. Card sparklines use a fixed 7-day pass rate."
        headerActions={
          <PrE2eRangePicker value={days} onChange={setDays} loading={loading} />
        }
      >
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#94A3B8]">
            <LoaderSpinner size="md" />
            Loading…
          </p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-700">{error}</p>
        ) : (
          <PrE2eServiceHealthTable rows={services} />
        )}
      </PrE2ePanel>
    </>
  );
}
