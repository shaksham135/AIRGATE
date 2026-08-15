-- Flyway Migration V36: Expand questions.image_path column to TEXT to support multiple photos per question
ALTER TABLE questions MODIFY COLUMN image_path TEXT;
