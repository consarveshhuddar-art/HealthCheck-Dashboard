-- Run if credential_expiry_records was created without platform.

ALTER TABLE credential_expiry_records
  ADD COLUMN platform VARCHAR(100) NULL
  AFTER credential_name;

CREATE INDEX idx_credential_expiry_platform
  ON credential_expiry_records (platform);

UPDATE credential_expiry_records
SET platform = 'Jenkins';

ALTER TABLE credential_expiry_records
  MODIFY COLUMN platform VARCHAR(100) NOT NULL;

-- Optional: one active row per name + platform (if not already applied)
-- DROP INDEX uk_credential_one_active ON credential_expiry_records;
-- ALTER TABLE credential_expiry_records
--   ADD COLUMN platform_key VARCHAR(100) AS (LOWER(TRIM(platform))) STORED;
-- CREATE UNIQUE INDEX uk_credential_one_active
--   ON credential_expiry_records (credential_name_key, platform_key, active_slot);
