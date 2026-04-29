export type HealthCheckRun = {
  id: string;
  created_at: string;
  checked_at_ist: string;
  build_number: number;
  build_url: string;
  jenkins_result: string;
  envs: string[];
  summary: Record<string, unknown>;
};

export type HealthCheckFailure = {
  id: string;
  run_id: string;
  env: string;
  service_name: string;
  http_code: number | null;
  detail: string | null;
};

export type FailureWithRunTime = HealthCheckFailure & {
  run_created_at: string;
};

export type RunWithFailures = HealthCheckRun & {
  health_check_failures: HealthCheckFailure[] | null;
};
