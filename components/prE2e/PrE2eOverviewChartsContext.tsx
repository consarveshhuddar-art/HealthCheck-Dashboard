"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePrE2eRangeQuery } from "@/components/prE2e/usePrE2eRangeQuery";
import type { PrE2eTrendDays } from "@/lib/prE2e/trendFill";
import { PR_E2E_TREND_DAYS_DEFAULT } from "@/lib/prE2e/trendFill";
import type {
  PrE2eNamedCount,
  PrE2eServicePoint,
} from "@/lib/prE2e/types";

type RangeQuery<T> = ReturnType<typeof usePrE2eRangeQuery<T>>;

type OverviewChartsContextValue = {
  byService: RangeQuery<PrE2eServicePoint[]>;
  runsByTrigger: RangeQuery<PrE2eNamedCount[]>;
};

const OverviewChartsContext = createContext<OverviewChartsContextValue | null>(
  null,
);

export function PrE2eOverviewChartsProvider({ children }: { children: ReactNode }) {
  const byService = usePrE2eRangeQuery<PrE2eServicePoint[]>(
    "byService",
    PR_E2E_TREND_DAYS_DEFAULT,
  );
  const runsByTrigger = usePrE2eRangeQuery<PrE2eNamedCount[]>(
    "runsByTrigger",
    PR_E2E_TREND_DAYS_DEFAULT,
  );
  return (
    <OverviewChartsContext.Provider
      value={{
        byService,
        runsByTrigger,
      }}
    >
      {children}
    </OverviewChartsContext.Provider>
  );
}

export function useOverviewCharts() {
  const ctx = useContext(OverviewChartsContext);
  if (!ctx) {
    throw new Error("useOverviewCharts must be used within PrE2eOverviewChartsProvider");
  }
  return ctx;
}

export type { PrE2eTrendDays };
