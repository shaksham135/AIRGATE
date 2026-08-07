-- Fix columns in user_question_solves table to match JPA entity UserQuestionSolve safely

DROP PROCEDURE IF EXISTS fix_solves_cols;

DELIMITER //
CREATE PROCEDURE fix_solves_cols()
BEGIN
    DECLARE col_opt INT;
    DECLARE col_time INT;
    DECLARE col_at INT;
    
    SELECT COUNT(*) INTO col_opt 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_question_solves' 
      AND COLUMN_NAME = 'selected_option';

    SELECT COUNT(*) INTO col_time 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_question_solves' 
      AND COLUMN_NAME = 'solving_time_seconds';

    SELECT COUNT(*) INTO col_at 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_question_solves' 
      AND COLUMN_NAME = 'solved_at';
      
    IF col_opt = 0 THEN
        ALTER TABLE user_question_solves ADD COLUMN selected_option VARCHAR(10) NOT NULL DEFAULT '';
    END IF;

    IF col_time = 0 THEN
        ALTER TABLE user_question_solves ADD COLUMN solving_time_seconds INT DEFAULT 0;
    END IF;

    IF col_at = 0 THEN
        ALTER TABLE user_question_solves ADD COLUMN solved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END //
DELIMITER ;

CALL fix_solves_cols();
DROP PROCEDURE IF EXISTS fix_solves_cols;
