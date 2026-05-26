import type { ReactNode } from "react";

export function PrE2eDataBanners({
  triggerUnknownPct,
  moduleUnknownPct,
  fingerprintCount,
  releaseRunCount,
}: {
  triggerUnknownPct: number | null;
  moduleUnknownPct: number | null;
  fingerprintCount: number;
  releaseRunCount?: number;
}) {
  const banners: { key: string; body: ReactNode; className: string }[] = [];

  if (triggerUnknownPct != null && triggerUnknownPct >= 80) {
    banners.push({
      key: "trigger",
      className: "border-amber-200/60 bg-amber-50/80 text-amber-950",
      body: (
        <>
          <span className="font-medium">Trigger type not ingested.</span>{" "}
          {triggerUnknownPct}% of runs show trigger_type as unknown — update
          prE2eIngest.groovy to parse upstream/manual/cron from Jenkins build
          cause.
        </>
      ),
    });
  }

  if (moduleUnknownPct != null && moduleUnknownPct >= 50) {
    banners.push({
      key: "module",
      className: "border-sky-200/60 bg-sky-50/80 text-sky-950",
      body: (
        <>
          <span className="font-medium">Module data mostly missing.</span>{" "}
          {moduleUnknownPct}% of failure rows have module unknown — tag cucumber
          scenarios with @service_* or populate module from Allure tags in ingest.
        </>
      ),
    });
  }

  if (fingerprintCount === 0) {
    banners.push({
      key: "fp",
      className: "border-[#EAEFF5] bg-[#F9FAFB] text-[#64748B]",
      body: (
        <>
          <span className="font-medium">No error fingerprints yet.</span>{" "}
          error_fingerprint is set during ingest when Allure error text is hashed —
          if empty, re-run ingest after pr_e2e_failures rows exist.
        </>
      ),
    });
  }

  if (releaseRunCount != null && releaseRunCount > 0) {
    banners.push({
      key: "release",
      className: "border-violet-200/60 bg-violet-50/80 text-violet-950",
      body: (
        <>
          <span className="font-medium">{releaseRunCount} release pipeline run(s)</span>{" "}
          exist in the DB but this dashboard filters to PR runs only (
          is_release_pipeline = 0).
        </>
      ),
    });
  }

  if (!banners.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {banners.map((b) => (
        <p
          key={b.key}
          className={`rounded-[10px] border px-4 py-2.5 text-[12px] leading-relaxed ${b.className}`}
        >
          {b.body}
        </p>
      ))}
    </div>
  );
}
