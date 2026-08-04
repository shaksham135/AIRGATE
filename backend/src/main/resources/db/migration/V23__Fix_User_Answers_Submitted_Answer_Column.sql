-- Flyway migration V23: Ensure submitted_answer column exists in user_answers table
-- Matches UserAnswer.java entity definition

ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS submitted_answer TEXT;

-- If selected_option existed from V1__Initial_Schema.sql, populate submitted_answer
UPDATE user_answers SET submitted_answer = selected_option WHERE submitted_answer IS NULL AND selected_option IS NOT NULL;
