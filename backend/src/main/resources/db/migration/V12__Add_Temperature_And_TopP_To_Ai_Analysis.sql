-- Add missing temperature and top_p columns to question_ai_analysis table safely

DROP PROCEDURE IF EXISTS add_ai_analysis_cols;

DELIMITER //
CREATE PROCEDURE add_ai_analysis_cols()
BEGIN
    DECLARE col_temp_count INT;
    DECLARE col_topp_count INT;
    
    SELECT COUNT(*) INTO col_temp_count 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'question_ai_analysis' 
      AND COLUMN_NAME = 'temperature';

    SELECT COUNT(*) INTO col_topp_count 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'question_ai_analysis' 
      AND COLUMN_NAME = 'top_p';
      
    IF col_temp_count = 0 THEN
        ALTER TABLE question_ai_analysis ADD COLUMN temperature DOUBLE NULL;
    END IF;

    IF col_topp_count = 0 THEN
        ALTER TABLE question_ai_analysis ADD COLUMN top_p DOUBLE NULL;
    END IF;
END //
DELIMITER ;

CALL add_ai_analysis_cols();
DROP PROCEDURE IF EXISTS add_ai_analysis_cols;

