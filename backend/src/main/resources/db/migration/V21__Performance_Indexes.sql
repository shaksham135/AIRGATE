-- ⚡ Ultra Fast Database Performance Indexes for Sub-20ms Question & Practice Queries

-- 1. Index for User Question Solves subquery (solves N+1 and full table scans on /api/questions & /api/practice/questions)
CREATE INDEX IF NOT EXISTS idx_uqs_user_question ON user_question_solves(user_id, question_id);

-- 2. Index for Practice Arena Feed (pdf_source_name + status + id)
CREATE INDEX IF NOT EXISTS idx_q_pdf_status_id ON questions(pdf_source_name, status, id DESC);

-- 3. Composite Indexes for Question Filtering (subject, topic, difficulty, type, status)
CREATE INDEX IF NOT EXISTS idx_q_status_subject ON questions(status, subject_id);
CREATE INDEX IF NOT EXISTS idx_q_status_topic ON questions(status, topic_id);
CREATE INDEX IF NOT EXISTS idx_q_status_diff ON questions(status, difficulty);
CREATE INDEX IF NOT EXISTS idx_q_status_type ON questions(status, question_type);
