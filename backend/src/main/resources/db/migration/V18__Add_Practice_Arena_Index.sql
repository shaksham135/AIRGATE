-- V18__Add_Practice_Arena_Index.sql
-- Composite performance indexes for Practice Arena & Explorer pagination queries (< 30ms database execution)

CREATE INDEX idx_q_status_source_subj ON questions(status, pdf_source_name, subject_id);
CREATE INDEX idx_q_status_type_diff ON questions(status, question_type, difficulty);
