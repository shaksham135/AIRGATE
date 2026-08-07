-- Fix question_revisions column mismatch between Java Entity (edited_at) and DB safely

DROP PROCEDURE IF EXISTS fix_revisions_cols;

DELIMITER //
CREATE PROCEDURE fix_revisions_cols()
BEGIN
    DECLARE col_cnt INT;
    DECLARE col_created INT;
    
    SELECT COUNT(*) INTO col_cnt 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'question_revisions' 
      AND COLUMN_NAME = 'edited_at';

    SELECT COUNT(*) INTO col_created 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'question_revisions' 
      AND COLUMN_NAME = 'created_at';

    IF col_cnt = 0 THEN
        ALTER TABLE question_revisions ADD COLUMN edited_at DATETIME NULL;
    END IF;

    IF col_created > 0 THEN
        UPDATE question_revisions SET edited_at = created_at WHERE edited_at IS NULL;
    ELSE
        UPDATE question_revisions SET edited_at = NOW() WHERE edited_at IS NULL;
    END IF;
END //
DELIMITER ;

CALL fix_revisions_cols();
DROP PROCEDURE IF EXISTS fix_revisions_cols;

ALTER TABLE question_revisions MODIFY COLUMN edited_by BIGINT NULL;
