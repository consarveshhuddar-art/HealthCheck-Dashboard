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

export type CredentialExpiryStatus = "active" | "resolved" | "stopped";

export type CredentialExpiryRecord = {
  id: string;
  credential_name: string;
  platform: string;
  ticket_name: string;
  ticket_link: string | null;
  created_date: string;
  created_by: string;
  renewed_by: string | null;
  expiry_date: string;
  status: CredentialExpiryStatus;
  resolved_at: string | null;
  supersedes_id: string | null;
  created_at: string;
};

export type CredentialExpiryGroup = {
  credential_name: string;
  platform: string;
  active: CredentialExpiryRecord | null;
  resolved: CredentialExpiryRecord[];
};

export type CredentialAlertCounts = {
  expiringSoon: number;
  expired: number;
  totalActive: number;
};

export type CredentialSortMode =
  | "created_desc"
  | "created_asc"
  | "expiry_desc"
  | "expiry_asc";
