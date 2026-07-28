-- V14__Add_Review_Queue_Performance_Indexes.sql
-- Optimizes Admin Review Queue loading performance and subquery lookups

CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_status_year ON questions(status, year);
CREATE INDEX idx_question_options_question_id ON question_options(question_id);
CREATE INDEX idx_ai_analysis_question_id_created ON question_ai_analysis(question_id, created_at DESC);
CREATE INDEX idx_explanation_votes_question_type ON explanation_votes(question_id, vote_type);

