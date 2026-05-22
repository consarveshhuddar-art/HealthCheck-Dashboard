-- Add 'stopped' status (run if table only allowed active/resolved)

ALTER TABLE credential_expiry_records
  DROP CHECK chk_credential_status;

ALTER TABLE credential_expiry_records
  ADD CONSTRAINT chk_credential_status
    CHECK (status IN ('active', 'resolved', 'stopped'));

UPDATE credential_expiry_records AS r
LEFT JOIN credential_expiry_records AS n
  ON n.supersedes_id = r.id
SET r.status = 'stopped'
WHERE r.status = 'resolved'
  AND n.id IS NULL;
