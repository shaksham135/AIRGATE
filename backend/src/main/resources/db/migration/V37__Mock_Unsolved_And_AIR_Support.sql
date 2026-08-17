-- Flyway Migration V37: Add AIR, Percentile & Indexing for Mock Attempt Analytics
ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS estimated_rank INT DEFAULT NULL;
ALTER TABLE mock_attempts ADD COLUMN IF NOT EXISTS percentile DOUBLE DEFAULT NULL;

-- Create index on score and submitted_at for ultra-fast All-India Rank / Percentile calculations
CREATE INDEX IF NOT EXISTS idx_mock_attempts_score_submitted ON mock_attempts (score DESC, submitted_at DESC);
