-- Add missing temperature and top_p columns to question_ai_analysis table
ALTER TABLE question_ai_analysis ADD COLUMN temperature DOUBLE NULL;
ALTER TABLE question_ai_analysis ADD COLUMN top_p DOUBLE NULL;
