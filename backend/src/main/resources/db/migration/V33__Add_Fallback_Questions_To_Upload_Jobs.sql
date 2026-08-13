-- Add fallback_questions column to upload_jobs table
ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS fallback_questions INT NOT NULL DEFAULT 0;
