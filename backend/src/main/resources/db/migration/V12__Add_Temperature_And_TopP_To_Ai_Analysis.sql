-- Add missing temperature and top_p columns to question_ai_analysis table
ALTER TABLE question_ai_analysis ADD COLUMN IF NOT EXISTS temperature DOUBLE;
ALTER TABLE question_ai_analysis ADD COLUMN IF NOT EXISTS top_p DOUBLE;
