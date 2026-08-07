-- Flyway migration V23: Ensure submitted_answer column exists in user_answers table safely

DROP PROCEDURE IF EXISTS fix_user_answers_col;

DELIMITER //
CREATE PROCEDURE fix_user_answers_col()
BEGIN
    DECLARE col_sub INT;
    DECLARE col_sel INT;
    
    SELECT COUNT(*) INTO col_sub 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_answers' 
      AND COLUMN_NAME = 'submitted_answer';

    SELECT COUNT(*) INTO col_sel 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_answers' 
      AND COLUMN_NAME = 'selected_option';

    IF col_sub = 0 THEN
        ALTER TABLE user_answers ADD COLUMN submitted_answer TEXT;
    END IF;

    IF col_sel > 0 THEN
        UPDATE user_answers SET submitted_answer = selected_option WHERE submitted_answer IS NULL AND selected_option IS NOT NULL;
    END IF;
END //
DELIMITER ;

CALL fix_user_answers_col();
DROP PROCEDURE IF EXISTS fix_user_answers_col;
