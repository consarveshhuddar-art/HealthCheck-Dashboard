-- created_by / renewed_by (run on existing credential_expiry_records)

ALTER TABLE credential_expiry_records
  ADD COLUMN created_by VARCHAR(255) NULL AFTER created_date,
  ADD COLUMN renewed_by VARCHAR(255) NULL AFTER created_by;

CREATE INDEX idx_credential_expiry_created_by
  ON credential_expiry_records (created_by);

UPDATE credential_expiry_records
SET created_by = 'Manoj Bagal'
WHERE created_by IS NULL OR TRIM(created_by) = '';

ALTER TABLE credential_expiry_records
  MODIFY COLUMN created_by VARCHAR(255) NOT NULL DEFAULT 'Manoj Bagal';
