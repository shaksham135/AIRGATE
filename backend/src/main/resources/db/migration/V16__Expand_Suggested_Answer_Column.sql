-- V16__Expand_Suggested_Answer_Column.sql
-- Expands suggested_answer column in question_ai_analysis to TEXT type to prevent Data truncation errors

ALTER TABLE question_ai_analysis MODIFY COLUMN suggested_answer TEXT;
