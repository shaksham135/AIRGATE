-- Add has_used_pdf_trial column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_used_pdf_trial BOOLEAN NOT NULL DEFAULT FALSE;
