-- ⚡ Performance Index for Review Queue & AI Analysis queries
CREATE INDEX IF NOT EXISTS idx_qaa_question_id ON question_ai_analysis(question_id);
CREATE INDEX IF NOT EXISTS idx_qaa_model_qstatus ON question_ai_analysis(model_name, id ASC);
