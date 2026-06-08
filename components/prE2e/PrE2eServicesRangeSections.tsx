"use client";

import { LoaderSpinner } from "@/components/LoaderSpinner";
import { PrE2eServiceCards } from "@/components/prE2e/PrE2eServiceCards";
import { PrE2eServiceHealthTable, PrE2ePanel } from "@/components/prE2e/PrE2eDataTables";
import { PrE2eServiceEnvFailureTable } from "@/components/prE2e/PrE2eServiceEnvFailureTable";
import { PrE2eRangePicker } from "@/components/prE2e/PrE2eRangePicker";
import { usePrE2eRangeQuery } from "@/components/prE2e/usePrE2eRangeQuery";
import type {
  PrE2ePassRatePoint,
  PrE2eServiceEnvFailurePct,
  PrE2eServiceHealth,
} from "@/lib/prE2e/types";
import { PR_E2E_TREND_DAYS_DEFAULT } from "@/lib/prE2e/trendFill";

export function PrE2eServicesHealthPanel({
  initialServices,
  sparklines,
}: {
  initialServices: PrE2eServiceHealth[];
  sparklines: Record<string, PrE2ePassRatePoint[]>;
}) {
  const healthQuery = usePrE2eRangeQuery<PrE2eServiceHealth[]>(
    "serviceHealth",
    PR_E2E_TREND_DAYS_DEFAULT,
  );
  const envFailQuery = usePrE2eRangeQuery<PrE2eServiceEnvFailurePct[]>(
    "serviceFailPctByEnv",
    PR_E2E_TREND_DAYS_DEFAULT,
  );
  const services = healthQuery.data ?? initialServices;

  return (
    <>
      <PrE2ePanel title="Service cards" className="mb-4">
        <PrE2eServiceCards
          services={services}
          sparklines={sparklines}
          days={healthQuery.days}
        />
      </PrE2ePanel>

      <PrE2ePanel
        title="Failure % by environment"
        description="Per service: failed runs / total runs and fail % in k8s-sdet-02, k8s-sdet-05, or ephemeral (PR-scoped) clusters."
        className="mb-4"
        headerActions={
          <PrE2eRangePicker
            value={envFailQuery.days}
            onChange={envFailQuery.setDays}
            loading={envFailQuery.loading}
          />
        }
      >
        {envFailQuery.loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#94A3B8]">
            <LoaderSpinner size="md" />
            Loading…
          </p>
        ) : envFailQuery.error ? (
          <p className="py-8 text-center text-sm text-rose-700">{envFailQuery.error}</p>
        ) : (
          <PrE2eServiceEnvFailureTable
            rows={envFailQuery.data ?? []}
            days={envFailQuery.days}
          />
        )}
      </PrE2ePanel>

      <PrE2ePanel
        title="Comparison table"
        description="Run stats for the selected range. Card sparklines use a fixed 7-day pass rate."
        headerActions={
          <PrE2eRangePicker
            value={healthQuery.days}
            onChange={healthQuery.setDays}
            loading={healthQuery.loading}
          />
        }
      >
        {healthQuery.loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#94A3B8]">
            <LoaderSpinner size="md" />
            Loading…
          </p>
        ) : healthQuery.error ? (
          <p className="py-8 text-center text-sm text-rose-700">{healthQuery.error}</p>
        ) : (
          <PrE2eServiceHealthTable rows={services} days={healthQuery.days} />
        )}
      </PrE2ePanel>
    </>
  );
}
