-- Fix question_revisions column mismatch between Java Entity (edited_at) and DB
ALTER TABLE question_revisions ADD COLUMN edited_at DATETIME NULL;
ALTER TABLE question_revisions MODIFY COLUMN edited_by BIGINT NULL;
UPDATE question_revisions SET edited_at = created_at WHERE edited_at IS NULL;
