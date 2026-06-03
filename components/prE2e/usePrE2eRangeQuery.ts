"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrE2eRangeMetric } from "@/lib/prE2e/rangeQuery";
import {
  PR_E2E_TREND_DAYS_DEFAULT,
  type PrE2eTrendDays,
} from "@/lib/prE2e/trendFill";

export type PrE2eRangeQueryDaysControl = {
  days: PrE2eTrendDays;
  setDays: (days: PrE2eTrendDays) => void;
};

type QueryState<T> = {
  days: PrE2eTrendDays;
  setDays: (days: PrE2eTrendDays) => void;
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function usePrE2eRangeQuery<T>(
  metric: PrE2eRangeMetric,
  defaultDays: PrE2eTrendDays = PR_E2E_TREND_DAYS_DEFAULT,
  daysControl?: PrE2eRangeQueryDaysControl,
): QueryState<T> {
  const [internalDays, setInternalDays] = useState<PrE2eTrendDays>(defaultDays);
  const days = daysControl?.days ?? internalDays;
  const setDays = daysControl?.setDays ?? setInternalDays;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/pr-e2e/query?metric=${metric}&days=${days}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const body = (await res.json()) as {
          ok?: boolean;
          data?: T;
          error?: string;
        };
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        if (!cancelled) setData(body.data ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [metric, days, tick]);

  return { days, setDays, data, loading, error, reload };
}
