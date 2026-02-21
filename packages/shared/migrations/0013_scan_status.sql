-- D1 Migration: 0013_scan_status
-- Adds virus scan status column to jobs table

ALTER TABLE jobs ADD COLUMN scan_status TEXT DEFAULT NULL
  CHECK (scan_status IN ('scanning', 'clean', 'infected', 'error', NULL));
ALTER TABLE jobs ADD COLUMN scan_detail TEXT DEFAULT NULL;
