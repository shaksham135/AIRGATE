-- V15__Add_Sub50ms_Performance_Indexes.sql
-- Optimizes Question, Topic, Option, Solve & Bookmark queries for sub-50ms site load speed

CREATE INDEX idx_q_subject_status ON questions(subject_id, status);
CREATE INDEX idx_q_topic_status ON questions(topic_id, status);
CREATE INDEX idx_q_checksum ON questions(checksum_hash);
CREATE INDEX idx_q_pdf_source ON questions(pdf_source_name);

CREATE INDEX idx_topic_subject ON topics(subject_id);
CREATE INDEX idx_topic_parent ON topics(parent_topic_id);
CREATE INDEX idx_topic_name ON topics(name);

CREATE INDEX idx_uqs_user ON user_question_solves(user_id);
CREATE INDEX idx_uqs_question ON user_question_solves(question_id);
CREATE INDEX idx_uqs_user_correct ON user_question_solves(user_id, is_correct);

CREATE INDEX idx_bm_user ON bookmarks(user_id);
CREATE INDEX idx_bm_question ON bookmarks(question_id);

CREATE INDEX idx_qa_model_name ON question_ai_analysis(model_name);
