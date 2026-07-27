-- Fix columns in user_question_solves table to match JPA entity UserQuestionSolve
ALTER TABLE user_question_solves ADD COLUMN IF NOT EXISTS selected_option VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE user_question_solves ADD COLUMN IF NOT EXISTS solving_time_seconds INT DEFAULT 0;
ALTER TABLE user_question_solves ADD COLUMN IF NOT EXISTS solved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
