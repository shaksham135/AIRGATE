-- Flyway Migration V38: Add Sub-10ms Indexes for Mock Attempt Answer Queries
CREATE INDEX IF NOT EXISTS idx_mock_attempts_user ON mock_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_maa_attempt_question ON mock_attempt_answers (attempt_id, question_id);
CREATE INDEX IF NOT EXISTS idx_maa_question ON mock_attempt_answers (question_id);
