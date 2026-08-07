-- ⚡ Performance Index for Review Queue & AI Analysis queries

DROP PROCEDURE IF EXISTS add_idx_if_not_exists;

DELIMITER //
CREATE PROCEDURE add_idx_if_not_exists(
    IN tbl_name VARCHAR(64),
    IN idx_name VARCHAR(64),
    IN col_list VARCHAR(255)
)
BEGIN
    DECLARE idx_cnt INT;
    SELECT COUNT(*) INTO idx_cnt 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = tbl_name 
      AND INDEX_NAME = idx_name;

    IF idx_cnt = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', idx_name, ' ON ', tbl_name, '(', col_list, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL add_idx_if_not_exists('question_ai_analysis', 'idx_qaa_question_id', 'question_id');
CALL add_idx_if_not_exists('question_ai_analysis', 'idx_qaa_model_qstatus', 'model_name, id ASC');

DROP PROCEDURE IF EXISTS add_idx_if_not_exists;
