-- Credential expiry (same DB as health_check_*)
-- Database: automation_testdata (HEALTH_CHECK_MYSQL_DATABASE)

CREATE TABLE IF NOT EXISTS credential_expiry_records (
  id VARCHAR(36) PRIMARY KEY,

  credential_name VARCHAR(255) NOT NULL,
  credential_name_key VARCHAR(255)
    AS (LOWER(TRIM(credential_name))) STORED,

  platform VARCHAR(100) NOT NULL,
  platform_key VARCHAR(100)
    AS (LOWER(TRIM(platform))) STORED,

  ticket_name VARCHAR(255) NOT NULL,
  ticket_link TEXT,

  created_date DATE NOT NULL,
  created_by VARCHAR(255) NOT NULL DEFAULT 'Manoj Bagal',
  renewed_by VARCHAR(255) NULL DEFAULT NULL,
  expiry_date DATE NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'active',

  active_slot TINYINT
    AS (IF(status = 'active', 1, NULL)) STORED,

  resolved_at TIMESTAMP NULL DEFAULT NULL,
  supersedes_id VARCHAR(36) NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_credential_supersedes
    FOREIGN KEY (supersedes_id)
    REFERENCES credential_expiry_records (id)
    ON DELETE SET NULL,

  CONSTRAINT chk_credential_status
    CHECK (status IN ('active', 'resolved', 'stopped'))
);

CREATE UNIQUE INDEX uk_credential_one_active
  ON credential_expiry_records (credential_name_key, platform_key, active_slot);

CREATE INDEX idx_credential_expiry_status_expiry
  ON credential_expiry_records (status, expiry_date);

CREATE INDEX idx_credential_expiry_name_key
  ON credential_expiry_records (credential_name_key);

CREATE INDEX idx_credential_expiry_platform
  ON credential_expiry_records (platform_key);

CREATE INDEX idx_credential_expiry_resolved_at
  ON credential_expiry_records (resolved_at);

CREATE INDEX idx_credential_expiry_created_date
  ON credential_expiry_records (created_date);
