/** Deployment names without branch suffix (`:develop`), order preserved for charts. */
export const EXPECTED_SERVICES = [
  "fc-banner-vertx",
  "guardian",
  "fc-butler",
  "fc-mockingjay",
  "fc-core-vertx",
  "feed",
  "fc-livescores",
  "fc-video-vertx",
  "fc-core",
  "fc-crons",
  "fc-kong",
  "isotope",
  "fc-video-license-vertx",
  "fc-transcode",
  "user-nexus",
  "fc-salus-vertx",
  "fc-gringotts-vertx",
  "fc-coupon",
  "fc-gql",
  "fc-video-crons",
  "fc-pager",
  "fc-marketing",
  "fc-csl-vertx",
  "fc-search",
] as const;

export type ExpectedService = (typeof EXPECTED_SERVICES)[number];

/** Supabase `env` / namespace values we split in the UI */
export const ENV_SDET_02 = "k8s-sdet-02";
export const ENV_SDET_05 = "k8s-sdet-05";
